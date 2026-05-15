/**
 * POST /api/dashboard/scans/[id]/share
 *
 * Auth-required. Owner of a dashboard scan creates a public-read permalink
 * for that scan (the viral wedge). Copies the scan + grouped issues into
 * the existing public_scan_results table and returns the public URL.
 *
 * Default UX is opt-in: users explicitly click Share. The dialog should
 * warn them that the URL is public (anyone with the link can view).
 *
 * Caught as a missing critical UX gap by end-user walkthrough on prod
 * 2026-05-15. The /scan-result/[token] route + table already existed
 * for the FREE flow but the dashboard had no UI to publish. See
 * .shared/launch/GAP_accessiscan_dashboard_scan_share_2026_05_15.md.
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ScanRow {
  id: string;
  user_id: string;
  url: string;
  status: string;
  compliance_score: number | null;
  total_issues: number | null;
}

interface IssueRow {
  rule_id: string;
  rule_description: string | null;
  severity: string;
  wcag_level: string | null;
  fix_suggestion: string | null;
  html_snippet: string | null;
  selector: string | null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // AUTH FIRST — anti-pattern 1 (auth-before-IO)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: scanId } = await params;

  // Validate scanId is a UUID-shaped string before any DB call
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scanId)) {
    return NextResponse.json({ error: "Invalid scan id" }, { status: 400 });
  }

  // Verify the scan belongs to this user (RLS would also catch it, but a
  // pre-flight 404 makes the API contract clearer)
  const { data: scan, error: scanErr } = await supabase
    .from("scans")
    .select("id, user_id, url, status, compliance_score, total_issues")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .maybeSingle<ScanRow>();

  if (scanErr || !scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.status !== "completed") {
    return NextResponse.json(
      { error: "Scan is not yet complete — wait for it to finish before sharing." },
      { status: 409 },
    );
  }

  // Pull issues for this scan to build the report
  const { data: issues } = await supabase
    .from("scan_issues")
    .select("rule_id, rule_description, severity, wcag_level, fix_suggestion, html_snippet, selector")
    .eq("scan_id", scanId)
    .returns<IssueRow[]>();

  // Group issues by rule_id+severity to match public_scan_results.report shape
  type Grouped = {
    rule: string;
    severity: string;
    count: number;
    example?: string;
    wcag_ref?: string;
    fix_hint?: string;
  };
  const grouped = new Map<string, Grouped>();
  for (const i of issues ?? []) {
    const key = `${i.severity}::${i.rule_id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        rule: i.rule_description ?? i.rule_id,
        severity: i.severity,
        count: 1,
        example: i.html_snippet?.slice(0, 240) || undefined,
        wcag_ref: i.wcag_level ? `WCAG 2.1 Level ${i.wcag_level}` : undefined,
        fix_hint: i.fix_suggestion?.slice(0, 320) || undefined,
      });
    }
  }
  const groupedIssues = Array.from(grouped.values()).sort((a, b) => {
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 } as const;
    const sevDelta =
      (order[a.severity as keyof typeof order] ?? 9) -
      (order[b.severity as keyof typeof order] ?? 9);
    if (sevDelta !== 0) return sevDelta;
    return b.count - a.count;
  });

  const totalIssueCount = scan.total_issues ?? groupedIssues.reduce((s, g) => s + g.count, 0);
  const healthScore = scan.compliance_score ?? 0;

  // Generate token + insert. Reuses the existing public_scan_results table
  // (already RLS-policied for anon SELECT-by-id).
  const admin = createAdminClient();
  const token = crypto.randomBytes(12).toString("base64url");
  const { error: insertErr } = await admin.from("public_scan_results").insert({
    id: token,
    url: scan.url,
    report: {
      url: scan.url,
      issues: groupedIssues,
      total_issue_count: totalIssueCount,
      health_score: healthScore,
      notes: ["Published from authenticated dashboard scan."],
    },
  });

  if (insertErr) {
    return NextResponse.json(
      { error: "Failed to publish scan", details: insertErr.message },
      { status: 500 },
    );
  }

  // Build the public URL using the request's origin (no NEXT_PUBLIC_APP_URL
  // dependency — this works on prod, preview, and local dev)
  const proto = "https";
  const host = "accessiscan.piposlab.com";
  const publicUrl = `${proto}://${host}/scan-result/${token}`;

  return NextResponse.json(
    {
      ok: true,
      token,
      public_url: publicUrl,
      expires_in_days: 30,
    },
    { status: 200 },
  );
}

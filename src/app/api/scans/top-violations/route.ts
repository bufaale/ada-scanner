import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  domain: z.string().trim().max(253).optional(),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    days: searchParams.get("days") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    domain: searchParams.get("domain") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const since = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();

  let scanQuery = supabase
    .from("scans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("created_at", since)
    .limit(500);
  if (parsed.data.domain) scanQuery = scanQuery.eq("domain", parsed.data.domain);

  const { data: scans, error: scanErr } = await scanQuery;
  if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 });

  const scanIds = (scans ?? []).map((s) => s.id);
  if (scanIds.length === 0) {
    return NextResponse.json({ violations: [], scans_considered: 0 });
  }

  const { data: issues, error: issueErr } = await supabase
    .from("scan_issues")
    .select("rule_id, severity, wcag_level, rule_description")
    .in("scan_id", scanIds)
    .limit(5000);
  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });

  const byRule = new Map<
    string,
    { rule_id: string; count: number; severity: string; wcag_level: string | null; description: string | null }
  >();
  for (const issue of issues ?? []) {
    const k = issue.rule_id;
    if (!k) continue;
    const cur = byRule.get(k);
    if (cur) {
      cur.count += 1;
    } else {
      byRule.set(k, {
        rule_id: k,
        count: 1,
        severity: issue.severity,
        wcag_level: issue.wcag_level ?? null,
        description: issue.rule_description ?? null,
      });
    }
  }

  const violations = Array.from(byRule.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, parsed.data.limit);

  return NextResponse.json({
    violations,
    scans_considered: scanIds.length,
    days: parsed.data.days,
  });
}

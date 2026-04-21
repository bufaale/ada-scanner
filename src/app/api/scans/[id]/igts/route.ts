import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IGT_TEMPLATES } from "@/lib/igt/templates";

/**
 * Returns the full catalog of Intelligent Guided Tests for this scan,
 * merged with any per-scan results the auditor has recorded. Pending entries
 * are synthesized from the catalog; only stored rows carry actual status.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: scan } = await supabase
    .from("scans")
    .select("id")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .single();
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const { data: results } = await supabase
    .from("scan_igt_results")
    .select("template_id, status, auditor_notes, evidence_url, reviewed_at, updated_at")
    .eq("scan_id", scanId)
    .eq("user_id", user.id);

  const byTemplate = new Map(results?.map((r) => [r.template_id, r]) ?? []);

  const items = IGT_TEMPLATES.map((t) => ({
    template_id: t.id,
    wcag_criterion: t.wcagCriterion,
    wcag_level: t.wcagLevel,
    wcag_version: t.wcagVersion,
    category: t.category,
    title: t.title,
    question: t.question,
    guidance: t.guidance,
    pass_criteria: t.passCriteria,
    common_failures: t.commonFailures,
    status: byTemplate.get(t.id)?.status ?? "pending",
    auditor_notes: byTemplate.get(t.id)?.auditor_notes ?? "",
    evidence_url: byTemplate.get(t.id)?.evidence_url ?? "",
    reviewed_at: byTemplate.get(t.id)?.reviewed_at ?? null,
  }));

  const summary = items.reduce(
    (acc, i) => {
      acc[i.status as "pending" | "passed" | "failed" | "not_applicable"]++;
      acc.total++;
      return acc;
    },
    { total: 0, pending: 0, passed: 0, failed: 0, not_applicable: 0 } as Record<string, number>,
  );

  return NextResponse.json({ items, summary });
}

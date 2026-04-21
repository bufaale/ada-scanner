import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { findTemplate } from "@/lib/igt/templates";

const updateSchema = z.object({
  status: z.enum(["pending", "passed", "failed", "not_applicable"]),
  auditor_notes: z.string().max(2000).optional(),
  evidence_url: z.string().url().max(500).optional().or(z.literal("")),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  const { id: scanId, templateId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = findTemplate(templateId);
  if (!template) return NextResponse.json({ error: "Unknown template" }, { status: 404 });

  const { data: scan } = await supabase
    .from("scans")
    .select("id")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .single();
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    scan_id: scanId,
    user_id: user.id,
    template_id: templateId,
    wcag_criterion: template.wcagCriterion,
    status: parsed.data.status,
    auditor_notes: parsed.data.auditor_notes ?? null,
    evidence_url: parsed.data.evidence_url || null,
    reviewed_at: parsed.data.status === "pending" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("scan_igt_results")
    .upsert(payload, { onConflict: "scan_id,template_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ result: data });
}

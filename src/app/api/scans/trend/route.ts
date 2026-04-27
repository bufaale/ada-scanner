import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  domain: z.string().trim().max(253).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    domain: searchParams.get("domain") ?? undefined,
    days: searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const since = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("scans")
    .select("id, domain, compliance_score, critical_count, serious_count, created_at, completed_at")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500);

  if (parsed.data.domain) query = query.eq("domain", parsed.data.domain);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const points = (data ?? []).map((row) => ({
    scan_id: row.id,
    domain: row.domain,
    score: row.compliance_score,
    critical: row.critical_count,
    serious: row.serious_count,
    t: row.completed_at ?? row.created_at,
  }));

  return NextResponse.json({ points, days: parsed.data.days });
}

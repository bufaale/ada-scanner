import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's completed scan IDs for the issues subquery
  const [sitesResult, scansResult] = await Promise.all([
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("scans")
      .select("id, compliance_score")
      .eq("user_id", user.id)
      .eq("status", "completed"),
  ]);

  const scanIds = scansResult.data?.map((s) => s.id) ?? [];

  // Count critical/serious issues across user's scans
  let criticalIssues = 0;
  if (scanIds.length > 0) {
    const { count } = await supabase
      .from("scan_issues")
      .select("id", { count: "exact", head: true })
      .in("scan_id", scanIds)
      .in("severity", ["critical", "serious"]);
    criticalIssues = count ?? 0;
  }

  const totalScans = scansResult.data?.length ?? 0;
  const scores = scansResult.data
    ?.map((s) => s.compliance_score)
    .filter((s): s is number => s !== null) ?? [];
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return NextResponse.json({
    sitesTracked: sitesResult.count ?? 0,
    totalScans,
    avgScore,
    criticalIssues,
  });
}

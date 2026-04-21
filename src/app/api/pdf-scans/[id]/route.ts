import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: scan } = await supabase
    .from("pdf_scans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: issues } = await supabase
    .from("pdf_scan_issues")
    .select("*")
    .eq("pdf_scan_id", id)
    .order("severity", { ascending: true });

  return NextResponse.json({ scan, issues: issues ?? [] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("pdf_scans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

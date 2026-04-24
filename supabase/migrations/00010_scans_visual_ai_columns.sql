-- AccessiScan — add visual AI result columns to scans table.
-- The railway worker writes these fields after running Claude Vision on the
-- screenshot (see worker.ts processQuickScan / processDeepScan), and the UI
-- reads `scan.visual_score` to gate the Visual AI Analysis card. Without
-- these columns the worker's supabase.from("scans").update({...}) silently
-- drops visual data, leaving scan_visual_issues empty for paying-tier users.

alter table public.scans
  add column if not exists visual_score integer check (visual_score is null or (visual_score >= 0 and visual_score <= 100)),
  add column if not exists visual_ai_summary text;

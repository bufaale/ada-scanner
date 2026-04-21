-- AccessiScan — Intelligent Guided Tests (IGTs).
--
-- Automated axe-core scanning catches ~30-40% of WCAG violations. The
-- remaining 60-70% require human judgment (screen-reader operation,
-- keyboard flow, sensory characteristics, context-dependent use of color).
-- Deque shipped these Q1 2026; the April 2026 competitive research flagged
-- this as the #4 impact gap for AccessiScan with build cost 3.
--
-- Design: the template catalog lives in code (src/lib/igt/templates.ts);
-- this table only stores PER-SCAN results. That keeps the catalog
-- version-controlled and DB-light.

create table if not exists public.scan_igt_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references public.scans(id) on delete cascade not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null,
  wcag_criterion text not null,
  status text not null default 'pending'
    check (status in ('pending', 'passed', 'failed', 'not_applicable')),
  auditor_notes text,
  evidence_url text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One result per (scan, template) — upsert semantics on update.
create unique index if not exists idx_scan_igt_unique
  on public.scan_igt_results(scan_id, template_id);
create index if not exists idx_scan_igt_user
  on public.scan_igt_results(user_id, updated_at desc);

alter table public.scan_igt_results enable row level security;

drop policy if exists "scan_igt_results_owner" on public.scan_igt_results;
create policy "scan_igt_results_owner" on public.scan_igt_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

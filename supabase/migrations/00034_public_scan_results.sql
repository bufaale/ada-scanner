-- Public shareable scan results — the viral wedge.
--
-- Visitor runs /free/wcag-scanner, gets a scan report, gets a unique
-- token-based permalink they can share. Anyone with the link can view
-- the report without signup.
--
-- Why: research (May 2026) flagged that ZERO of our 4 zero-customer
-- apps let users create shareable proof-of-result before signup. This
-- table powers the AccessiScan version of that pattern.

create table if not exists public.public_scan_results (
  id text primary key,
  url text not null,
  report jsonb not null,
  email_captured text,
  created_at timestamptz not null default now(),
  view_count int not null default 0,
  expires_at timestamptz not null default (now() + interval '30 days')
);

-- Index for cleanup of expired rows (run by a cron eventually)
create index if not exists idx_public_scan_results_expires on public.public_scan_results (expires_at);

-- RLS: anyone with the token (= the id) can read. We control access
-- by the un-guessability of the token itself; no row-level policy
-- needs to check user_id because there isn't one.
alter table public.public_scan_results enable row level security;

-- Anonymous + authenticated can SELECT (need the random token to find it)
drop policy if exists "Public read by token" on public.public_scan_results;
create policy "Public read by token"
  on public.public_scan_results
  for select
  using (true);

-- Anonymous + authenticated can INSERT (the API enforces input validation)
drop policy if exists "Public insert" on public.public_scan_results;
create policy "Public insert"
  on public.public_scan_results
  for insert
  with check (true);

-- Only service-role can UPDATE (for view_count increments)
drop policy if exists "Service role update" on public.public_scan_results;
create policy "Service role update"
  on public.public_scan_results
  for update
  using (false);

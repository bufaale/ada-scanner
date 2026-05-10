-- Enterprise lead capture from /enterprise discovery form.
-- Lightweight: stores raw payload + provenance for the operator to follow up.
-- No auth required (public form), but RLS-locked: only service_role can read/write.

create table if not exists public.enterprise_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name        text not null,
  work_email  text not null,
  company     text not null,
  role        text,
  frameworks  text[] not null default '{}',
  scope       text,

  -- provenance + abuse triage
  ip_hash     text,
  user_agent  text,
  referrer    text,

  -- operator workflow
  status      text not null default 'new'
    check (status in ('new','contacted','qualified','disqualified','closed')),
  notes       text
);

create index if not exists idx_enterprise_leads_created_at
  on public.enterprise_leads (created_at desc);
create index if not exists idx_enterprise_leads_status
  on public.enterprise_leads (status)
  where status <> 'closed';

alter table public.enterprise_leads enable row level security;

-- No public read/write. Service-role bypasses RLS, so the API route can insert
-- and the operator can read via Pilotdeck dashboard with admin client.
-- Intentionally NO policies — anon and authenticated users have zero access.

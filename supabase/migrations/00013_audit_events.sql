-- Boilerplate cross-app shared infra: audit_events table.
--
-- Apps that opt in (AccessiScan / AIComply / CallSpark, etc.) copy this
-- migration into their own supabase/migrations/ tree to gain enterprise-
-- grade audit trail without writing the schema themselves.
--
-- Pattern: row-per-event, immutable (no UPDATE / DELETE policies), append-
-- only via service-role inserts from `src/lib/audit/log.ts`. Owners can
-- read their own org's events via RLS.

create table if not exists public.audit_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- e.g. "scan.created", "billing.subscription_canceled", "auto_fix.pr_opened"
  event_type text not null,
  -- "user", "system", "webhook", "cron", "admin"
  actor_type text not null default 'user' check (actor_type in ('user', 'system', 'webhook', 'cron', 'admin')),
  actor_id text,
  -- Free-form scoped resource pointer: "scan:abc-123", "subscription:sub_xyz".
  resource text,
  -- The change in human-readable form. Keep PII out — use meta for IDs.
  summary text,
  -- Structured detail. Indexed for the most common filter (event_type).
  meta jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_user_created
  on public.audit_events (user_id, created_at desc);

create index if not exists idx_audit_events_event_type_created
  on public.audit_events (event_type, created_at desc);

alter table public.audit_events enable row level security;

create policy "audit_events_owner_read"
  on public.audit_events for select
  using (auth.uid() = user_id);

-- NOTE: NO insert/update/delete policies. Inserts go through the service
-- role from `lib/audit/log.ts` to guarantee tamper-resistance. Updates are
-- never allowed; the table is append-only.

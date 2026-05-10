-- Threshold alert deduplication + tally view for the buyer-language
-- experiment (aryan_sinh follow-up, May 10 2026).
--
-- alerts_fired:
--   single source of truth for "did we already send this alert?"
--   PK = name, so the second insert with the same alert name fails
--   with a 23505 unique-violation. That race is exactly what we want
--   for fire-once semantics.
--
-- buyer_language_tally:
--   convenience view for any future dashboard or one-off SQL audit.
--   Returns one row per non-null language_bucket with the classified
--   count + the count of distinct prospects (email-deduped) in that
--   bucket. Cheap to query, zero maintenance — Postgres view.

create table if not exists public.alerts_fired (
  name text primary key,
  fired_at timestamptz not null default now(),
  payload jsonb
);

alter table public.alerts_fired enable row level security;

-- Service-role only — no policies. Anon and authenticated have zero
-- access. The threshold-check in /api/enterprise-lead and any future
-- cron uses createAdminClient() which bypasses RLS.

create or replace view public.buyer_language_tally as
  select
    language_bucket,
    count(*)::int as classified_count,
    count(distinct work_email)::int as distinct_prospects
  from public.enterprise_leads
  where language_bucket is not null
  group by language_bucket;

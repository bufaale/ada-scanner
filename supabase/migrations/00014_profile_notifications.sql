-- ============================================
-- Profile rich-fields migration (Phase A7)
-- ============================================
-- Adds the columns the rich /settings/profile page reads + writes:
--   * notification_preferences (jsonb)  - granular email toggles
--   * company (text)                    - for VPAT/Section 508 export attribution
--   * country (text)                    - optional, ISO 3166-1 alpha-2
--   * timezone (text)                   - IANA tz, e.g. "America/Argentina/Buenos_Aires"
--
-- All columns are nullable + idempotent (IF NOT EXISTS) so this migration is
-- safe to apply multiple times and against existing prod data.
--
-- RLS: profiles already has owner-write policies from 00001_initial_schema —
-- the new columns inherit those automatically.

set search_path to public, extensions;

alter table public.profiles
  add column if not exists notification_preferences jsonb
    not null default jsonb_build_object(
      'scan_complete', true,
      'weekly_summary', true,
      'compliance_alerts', true,
      'marketing_emails', false
    );

alter table public.profiles
  add column if not exists company text;

alter table public.profiles
  add column if not exists country text;

alter table public.profiles
  add column if not exists timezone text;

-- Backfill any pre-existing rows that were created before the default existed
-- (jsonb default only applies to new INSERTs, not existing rows).
update public.profiles
  set notification_preferences = jsonb_build_object(
    'scan_complete', true,
    'weekly_summary', true,
    'compliance_alerts', true,
    'marketing_emails', false
  )
  where notification_preferences is null;

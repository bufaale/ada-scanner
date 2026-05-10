-- Buyer-language classification on enterprise leads.
--
-- We track whether procurement-led prospects describe AccessiScan in
-- "scanner tool" language (audit, scan, check) or "infrastructure"
-- language (continuous, compliance, evidence, remediation, audit-trail).
--
-- The bet — surfaced by aryan_sinh on the IH launch thread (May 9-10
-- 2026) — is that the page successfully reframes the buyer category but
-- the name "AccessiScan" still anchors them in the scanner box. If the
-- "infrastructure" bucket wins by call ~10, the page is doing real work
-- and the name is fine. If the "scanner" bucket wins, the page is
-- compensating forever and the rebrand is on the table.
--
-- Classification fires automatically from /api/enterprise-lead on
-- form submit, and from a Pilotdeck cron on inbound email replies.

alter table public.enterprise_leads
  add column if not exists language_bucket text
    check (language_bucket in ('scanner','infrastructure','mixed','unclear')),
  add column if not exists language_keywords text[],
  add column if not exists language_evidence text,
  add column if not exists classified_at timestamptz;

-- Partial index — only the rows that have been classified are interesting
-- to query for the running tally. Skipping null rows keeps the index tight
-- (most rows pre-Aryan-experiment have null and never will).
create index if not exists idx_enterprise_leads_language
  on public.enterprise_leads (language_bucket)
  where language_bucket is not null;

-- 00035_followup_sent_at — track per-row state for the lead-claim
-- follow-up cron at /api/cron/lead-followups.
--
-- After a visitor claims their scan (POST /api/free/scan-result/[token]/claim
-- with their email), we wait 3 days then send a polite "did the report
-- help — want to chat?" follow-up. This column records when that nudge
-- went out so we never double-send.

alter table public.public_scan_results
  add column if not exists followup_sent_at timestamptz;

comment on column public.public_scan_results.followup_sent_at is
  '3-day captured-email follow-up tracker. Set when /api/cron/lead-followups sends the nudge email. NULL = either no email captured yet, OR captured but follow-up pending.';

-- Partial index covers the cron's hot-path query: "captured but not yet
-- followed up". Far fewer rows than a full index over the table.
create index if not exists idx_public_scan_results_followup_pending
  on public.public_scan_results (created_at)
  where email_captured is not null and followup_sent_at is null;

-- AccessiScan — POUR per-principle scores.
--
-- WCAG groups its success criteria into 4 principles: Perceivable, Operable,
-- Understandable, Robust. The scan worker now computes a 0-100 score per
-- principle so the UI can render a 4-up breakdown alongside the overall
-- compliance score (see scorer.ts → calculatePrincipleScore).

alter table public.scans
  add column if not exists pour_scores jsonb;

comment on column public.scans.pour_scores is
  'POUR per-principle scores: { perceivable, operable, understandable, robust }, each 0-100';

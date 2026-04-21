-- AccessiScan — PDF accessibility scanning (PDF/UA-1 + WCAG + EN 301 549 §10).
--
-- Scans an uploaded PDF for tagged-structure, language declaration, title,
-- image alt text coverage, form field labels, table header identification,
-- and OCR-on-scans. Parallel to the existing web scans pipeline but with
-- a distinct schema because the issue model is different (criterion-centric
-- not rule-id-centric).

create table if not exists public.pdf_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_size_bytes bigint not null,
  page_count integer,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  score integer,
  error_message text,

  -- Document-level facts collected during analysis (for the report).
  is_tagged boolean,
  has_language boolean,
  declared_language text,
  has_title boolean,
  has_marked_flag boolean,
  image_total_count integer default 0,
  image_with_alt_count integer default 0,
  form_field_total_count integer default 0,
  form_field_with_label_count integer default 0,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_pdf_scans_user
  on public.pdf_scans(user_id, created_at desc);

alter table public.pdf_scans enable row level security;

drop policy if exists "pdf_scans_owner" on public.pdf_scans;
create policy "pdf_scans_owner" on public.pdf_scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Per-issue table (each failed criterion or per-image failure).
create table if not exists public.pdf_scan_issues (
  id uuid primary key default gen_random_uuid(),
  pdf_scan_id uuid not null references public.pdf_scans(id) on delete cascade,
  criterion text not null,
  wcag_criterion text,
  severity text not null check (severity in ('critical', 'serious', 'moderate', 'minor')),
  description text not null,
  remediation text,
  page_number integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_pdf_issues_scan
  on public.pdf_scan_issues(pdf_scan_id);

alter table public.pdf_scan_issues enable row level security;

drop policy if exists "pdf_scan_issues_owner" on public.pdf_scan_issues;
create policy "pdf_scan_issues_owner" on public.pdf_scan_issues
  for select using (
    exists (
      select 1 from public.pdf_scans
      where pdf_scans.id = pdf_scan_issues.pdf_scan_id
        and pdf_scans.user_id = auth.uid()
    )
  );

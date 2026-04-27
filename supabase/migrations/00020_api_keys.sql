-- AccessiScan — user-issued API keys.
--
-- Business-tier customers can generate keys to call the scan API from CI
-- pipelines, GitHub Actions, or third-party tools. Plaintext is shown ONCE
-- on creation; only the SHA-256 hash + a short prefix is persisted, so we
-- never store the raw secret.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user on public.api_keys(user_id) where revoked_at is null;
create unique index if not exists idx_api_keys_hash on public.api_keys(key_hash);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_owner_read" on public.api_keys;
create policy "api_keys_owner_read" on public.api_keys
  for select using (auth.uid() = user_id);

drop policy if exists "api_keys_owner_insert" on public.api_keys;
create policy "api_keys_owner_insert" on public.api_keys
  for insert with check (auth.uid() = user_id);

drop policy if exists "api_keys_owner_revoke" on public.api_keys;
create policy "api_keys_owner_revoke" on public.api_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

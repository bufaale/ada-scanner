-- 00022_default_free_subscription_plan.sql
--
-- BUG: profiles.subscription_plan had no DEFAULT value, so new users created
-- by the handle_new_user trigger ended up with subscription_plan = NULL.
-- Routes like /api/scans/[id]/vpat gate with `subscription_plan === "free"`
-- which evaluates false when the column is NULL, letting NULL users bypass
-- the upgrade gate as if they were paid customers.
--
-- Found during the launch-night audit on 2026-05-07 when the
-- signup-real-roundtrip e2e spec asserted profile.subscription_plan === 'free'
-- but the actual value was null.
--
-- Fix:
--   1. Set default to 'free' on the column.
--   2. Backfill any existing NULL rows to 'free'.
--   3. Update the handle_new_user trigger to set subscription_plan = 'free'
--      explicitly (defense in depth — the column default also covers it).

-- Step 1: column default
alter table public.profiles
  alter column subscription_plan set default 'free';

-- Step 2: backfill NULL rows
update public.profiles
set subscription_plan = 'free'
where subscription_plan is null;

-- Step 3: update the trigger to set subscription_plan explicitly
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, subscription_plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    'free'
  );
  return new;
end;
$$ language plpgsql security definer;

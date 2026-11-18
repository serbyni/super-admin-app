-- The café an owner runs, by its public slug (<slug>.serbi.me / /<slug>/dashboard).
-- Set during onboarding; null until then. Used by the tenant route guard.
alter table platform.owner_accounts
  add column if not exists cafe_slug text unique
    check (cafe_slug ~ '^[a-z][a-z0-9-]{1,30}[a-z0-9]$');

-- Signed-in user's owner context in one call (null row → not an owner).
create or replace function public.get_my_owner()
returns table (status text, cafe_slug text)
language sql stable security definer set search_path = '' as $$
  select a.status::text, a.cafe_slug from platform.owner_accounts a where a.user_id = auth.uid()
$$;
revoke all on function public.get_my_owner() from public, anon;
grant execute on function public.get_my_owner() to authenticated;

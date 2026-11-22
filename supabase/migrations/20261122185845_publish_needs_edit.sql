-- Publishing the website saves the draft first: website.publish also needs website.edit (same
-- rule as src/lib/access/permissions.ts NEEDS). Applied when roles are saved.
create or replace function platform.with_implied(p text[])
returns text[] language sql immutable set search_path = '' as $$
  with base as (
    select unnest(coalesce(p, '{}')) x
    union
    select 'website.edit' where 'website.publish' = any (coalesce(p, '{}'))
  )
  select coalesce(array_agg(distinct x order by x), '{}') from (
    select x from base
    union
    select split_part(x, '.', 1) || '.read' from base
     where split_part(x, '.', 1) || '.read' = any (platform.permission_keys())
  ) s
$$;
revoke all on function platform.with_implied(text[]) from public;

update public.cafe_roles set permissions = platform.with_implied(permissions), updated_at = now()
 where not is_locked and permissions is distinct from platform.with_implied(permissions);

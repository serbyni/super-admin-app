-- Promote an existing auth user to super admin. Callable ONLY with the service/secret key
-- (scripts/create-super-admin.mjs); never from browsers.
create or replace function public.grant_platform_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into platform.platform_admins (user_id) values (p_user_id) on conflict do nothing;
end $$;
revoke all on function public.grant_platform_admin(uuid) from public, anon, authenticated;
grant execute on function public.grant_platform_admin(uuid) to service_role;

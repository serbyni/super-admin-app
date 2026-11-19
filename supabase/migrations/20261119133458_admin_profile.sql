-- Super admins get a profile too (name + phone), managed in /admin/settings.
alter table platform.platform_admins
  add column full_name text check (char_length(full_name) between 2 and 80),
  add column phone     text check (phone ~ '^\+[1-9][0-9]{6,14}$');

-- Backfill the name from the account metadata when it is valid.
update platform.platform_admins pa
   set full_name = btrim(u.raw_user_meta_data ->> 'full_name')
  from auth.users u
 where u.id = pa.user_id
   and char_length(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) between 2 and 80;

/** Name, phone and sign-in email of the caller — café owner or super admin. */
create or replace function public.get_my_profile()
returns table (full_name text, phone text, email text)
language sql stable security definer set search_path = '' as $$
  select coalesce(a.full_name, pa.full_name), coalesce(a.phone, pa.phone), u.email::text
    from auth.users u
    left join platform.owner_accounts a on a.user_id = u.id
    left join platform.platform_admins pa on pa.user_id = u.id
   where u.id = auth.uid();
$$;

/**
 * Update the caller's name + phone (owner account and/or super-admin record).
 * Raises not_authenticated, forbidden (neither), invalid_input (DETAIL = field).
 */
create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
  n_owner integer;
  n_admin integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'full_name';
  end if;
  if coalesce(p_phone, '') !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'phone';
  end if;
  update platform.owner_accounts set full_name = v_name, phone = p_phone, updated_at = now()
   where user_id = uid;
  get diagnostics n_owner = row_count;
  update platform.platform_admins set full_name = v_name, phone = p_phone where user_id = uid;
  get diagnostics n_admin = row_count;
  if n_owner + n_admin = 0 then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;

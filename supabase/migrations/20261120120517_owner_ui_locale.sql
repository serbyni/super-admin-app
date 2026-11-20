-- Owner dashboard language (EN/FR/AR): get_my_owner also returns it; set_my_ui_locale changes it.
-- owner_accounts.locale is also the language of the owner's e-mails.
drop function public.get_my_owner();
create function public.get_my_owner()
returns table (status text, cafe_slug text, locale text)
language sql stable security definer set search_path = '' as $$
  select a.status::text, a.cafe_slug, a.locale from platform.owner_accounts a where a.user_id = auth.uid()
$$;
revoke all on function public.get_my_owner() from public, anon;
grant execute on function public.get_my_owner() to authenticated;

create or replace function public.set_my_ui_locale(p_locale text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_locale is null or p_locale not in ('en', 'fr', 'ar') then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'locale';
  end if;
  update platform.owner_accounts set locale = p_locale, updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;
revoke all on function public.set_my_ui_locale(text) from public, anon;
grant execute on function public.set_my_ui_locale(text) to authenticated;

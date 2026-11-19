-- Sanitize sign-up metadata: values failing the table checks become NULL (→ profile_incomplete)
-- instead of aborting the auth sign-up with a generic database error. Only ACTIVE business
-- types are kept.
create or replace function platform.handle_new_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_name text := btrim(m ->> 'full_name');
  v_phone text := btrim(m ->> 'phone');
  v_business text := btrim(m ->> 'business_name');
  v_country text := btrim(m ->> 'country');
  v_city text := btrim(m ->> 'city');
  v_locale text := m ->> 'locale';
  btype text;
  acc platform.owner_accounts;
begin
  if coalesce(m ->> 'signup_source', '') <> 'owner' and provider = 'email' then
    return new;
  end if;

  select t.slug into btype from platform.business_types t
   where t.slug = nullif(m ->> 'business_type', '') and t.is_active;

  insert into platform.owner_accounts (
    user_id, status, full_name, phone, business_name, business_type, country, city,
    locale, terms_version, terms_accepted_at, signup_provider
  ) values (
    new.id, 'email_unverified',
    case when char_length(v_name) between 2 and 80 then v_name end,
    case when v_phone ~ '^\+[1-9][0-9]{6,14}$' then v_phone end,
    case when char_length(v_business) between 2 and 80 then v_business end,
    btype,
    case when char_length(v_country) between 2 and 60 then v_country end,
    case when char_length(v_city) between 1 and 80 then v_city end,
    case when v_locale in ('en', 'fr', 'ar') then v_locale else 'en' end,
    nullif(m ->> 'terms_version', ''),
    case when nullif(m ->> 'terms_version', '') is not null then now() end,
    provider
  )
  on conflict (user_id) do nothing
  returning * into acc;

  if acc.user_id is not null then
    update platform.owner_accounts
       set status = case
             when not platform.owner_profile_complete(acc) then 'profile_incomplete'::platform.owner_status
             when new.email_confirmed_at is null then 'email_unverified'::platform.owner_status
             else 'pending_approval'::platform.owner_status end,
           submitted_at = case when platform.owner_profile_complete(acc) and new.email_confirmed_at is not null then now() end
     where user_id = new.id;
  end if;
  return new;
end $$;
revoke all on function platform.handle_new_owner() from public, anon, authenticated;

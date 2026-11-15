-- Business location from Google Maps (place search, pin on map, or typed coordinates).
alter table platform.owner_accounts
  add column if not exists location_source   text check (location_source in ('google_place', 'map_pin', 'coordinates')),
  add column if not exists place_id          text check (char_length(place_id) <= 300),
  add column if not exists formatted_address text check (char_length(formatted_address) <= 300),
  add column if not exists street            text check (char_length(street) <= 120),
  add column if not exists postal_code       text check (char_length(postal_code) <= 20),
  add column if not exists region            text check (char_length(region) <= 80),
  add column if not exists country_code      text check (country_code ~ '^[A-Z]{2}$'),
  add column if not exists latitude          double precision check (latitude between -90 and 90),
  add column if not exists longitude         double precision check (longitude between -180 and 180);

-- A complete profile now needs a located business (coordinates + country code + city).
create or replace function platform.owner_profile_complete(a platform.owner_accounts)
returns boolean language sql immutable set search_path = '' as $$
  select a.full_name is not null and a.phone is not null and a.business_name is not null
     and a.business_type is not null and a.city is not null and a.country_code is not null
     and a.latitude is not null and a.longitude is not null
     and a.terms_accepted_at is not null
$$;
revoke all on function platform.owner_profile_complete(platform.owner_accounts) from public, anon, authenticated;

-- Validate a location JSON and write it onto the owner account. Returns false (and writes
-- nothing) when coordinates / country code / city are missing or invalid.
-- Expected keys: source, place_id, formatted_address, street, postal_code, city, region,
--                country, country_code, lat, lng
create or replace function platform.apply_owner_location(p_user uuid, p jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_cc text := upper(btrim(p ->> 'country_code'));
  v_city text := btrim(p ->> 'city');
  v_src text := p ->> 'source';
  t text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  begin
    v_lat := (p ->> 'lat')::double precision;
    v_lng := (p ->> 'lng')::double precision;
  exception when others then return false;
  end;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180
     or coalesce(v_cc, '') !~ '^[A-Z]{2}$' or char_length(coalesce(v_city, '')) not between 1 and 80
     or coalesce(v_src, '') not in ('google_place', 'map_pin', 'coordinates') then
    return false;
  end if;

  update platform.owner_accounts set
    location_source   = v_src,
    place_id          = left(nullif(btrim(p ->> 'place_id'), ''), 300),
    formatted_address = left(nullif(btrim(p ->> 'formatted_address'), ''), 300),
    street            = left(nullif(btrim(p ->> 'street'), ''), 120),
    postal_code       = left(nullif(btrim(p ->> 'postal_code'), ''), 20),
    city              = v_city,
    region            = left(nullif(btrim(p ->> 'region'), ''), 80),
    country           = coalesce(left(nullif(btrim(p ->> 'country'), ''), 60), v_cc),
    country_code      = v_cc,
    latitude          = round(v_lat::numeric, 7),
    longitude         = round(v_lng::numeric, 7),
    updated_at        = now()
  where user_id = p_user;
  return true;
end $$;
revoke all on function platform.apply_owner_location(uuid, jsonb) from public, anon, authenticated;

-- Sign-up trigger: business fields + location from metadata (invalid values are dropped).
create or replace function platform.handle_new_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_name text := btrim(m ->> 'full_name');
  v_phone text := btrim(m ->> 'phone');
  v_business text := btrim(m ->> 'business_name');
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
    user_id, status, full_name, phone, business_name, business_type,
    locale, terms_version, terms_accepted_at, signup_provider
  ) values (
    new.id, 'email_unverified',
    case when char_length(v_name) between 2 and 80 then v_name end,
    case when v_phone ~ '^\+[1-9][0-9]{6,14}$' then v_phone end,
    case when char_length(v_business) between 2 and 80 then v_business end,
    btype,
    case when v_locale in ('en', 'fr', 'ar') then v_locale else 'en' end,
    nullif(m ->> 'terms_version', ''),
    case when nullif(m ->> 'terms_version', '') is not null then now() end,
    provider
  )
  on conflict (user_id) do nothing;

  perform platform.apply_owner_location(new.id, m -> 'location');

  select * into acc from platform.owner_accounts where user_id = new.id;
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

-- Social sign-up completion now takes a location object instead of country/city text.
drop function if exists public.complete_owner_profile(text, text, text, text, text, text, text, text);

create or replace function public.complete_owner_profile(
  p_full_name text, p_phone text, p_business_name text, p_business_type text,
  p_location jsonb, p_locale text, p_terms_version text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  st platform.owner_status;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from platform.business_types where slug = p_business_type and is_active) then
    raise exception 'invalid_business_type' using errcode = 'P0001';
  end if;

  insert into platform.owner_accounts (user_id, status, signup_provider)
  values (uid, 'profile_incomplete', 'oauth')
  on conflict (user_id) do nothing;

  select status into st from platform.owner_accounts where user_id = uid for update;
  if st <> 'profile_incomplete' then raise exception 'profile_already_completed' using errcode = 'P0001'; end if;

  if not platform.apply_owner_location(uid, p_location) then
    raise exception 'invalid_location' using errcode = 'P0001';
  end if;

  update platform.owner_accounts
     set full_name = p_full_name, phone = p_phone, business_name = p_business_name,
         business_type = p_business_type,
         locale = coalesce(nullif(p_locale, ''), 'en'), terms_version = p_terms_version,
         terms_accepted_at = now(),
         status = 'pending_approval', submitted_at = now(), updated_at = now()
   where user_id = uid;
  return 'pending_approval';
end $$;
revoke all on function public.complete_owner_profile(text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.complete_owner_profile(text, text, text, text, jsonb, text, text) to authenticated;

-- Provider-neutral name for "picked from search results" (Geoapify or Google).
alter table platform.owner_accounts drop constraint if exists owner_accounts_location_source_check;
update platform.owner_accounts set location_source = 'place_search' where location_source = 'google_place';
alter table platform.owner_accounts
  add constraint owner_accounts_location_source_check
  check (location_source in ('place_search', 'map_pin', 'coordinates'));

create or replace function platform.apply_owner_location(p_user uuid, p jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_cc text := upper(btrim(p ->> 'country_code'));
  v_city text := btrim(p ->> 'city');
  v_src text := p ->> 'source';
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  begin
    v_lat := (p ->> 'lat')::double precision;
    v_lng := (p ->> 'lng')::double precision;
  exception when others then return false;
  end;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180
     or coalesce(v_cc, '') !~ '^[A-Z]{2}$' or char_length(coalesce(v_city, '')) not between 1 and 80
     or coalesce(v_src, '') not in ('place_search', 'map_pin', 'coordinates') then
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

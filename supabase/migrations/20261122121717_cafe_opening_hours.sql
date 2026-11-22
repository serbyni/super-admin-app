-- Opening hours become café configuration (Settings → Opening hours), saved directly: ordering
-- (cafe_open_now) and the website footer read cafes.opening_hours. Null = no fixed hours (always
-- open). The old copy inside the website document (footer.hours) is no longer read; it stays in
-- the documents until every app is deployed (the café site still being replaced requires it).

/** 7 days (Monday first) of {closed, open "HH:MM", close "HH:MM"}; an open day needs open ≠ close. */
create or replace function platform.valid_hours(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'array' and jsonb_array_length(p) = 7
    and not exists (
      select 1 from jsonb_array_elements(p) d
       where jsonb_typeof(d) <> 'object'
          or jsonb_typeof(d -> 'closed') <> 'boolean'
          or coalesce(d ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          or coalesce(d ->> 'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          or (not (d ->> 'closed')::boolean and d ->> 'open' = d ->> 'close')))
$$;

alter table public.cafes
  add column opening_hours jsonb check (platform.valid_hours(opening_hours));

-- Move: the published hours (what customers saw), else the draft's; only well-formed ones.
update public.cafes c
   set opening_hours = h.hours
  from (select w.cafe_id,
               coalesce(w.published -> 'footer' -> 'hours', w.draft -> 'footer' -> 'hours') as hours
          from public.cafe_websites w) h
 where h.cafe_id = c.id and h.hours is not null and platform.valid_hours(h.hours);

/** Is the café open right now (opening hours in Settings, café time zone)? No hours → always open. */
create or replace function platform.cafe_open_now(p_cafe uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_hours jsonb;
  v_now timestamp;
  v_dow int;
  v_time text;
  d jsonb;
  p jsonb;
  i int;
begin
  select c.timezone, c.opening_hours into v_tz, v_hours from public.cafes c where c.id = p_cafe;
  if v_hours is null or jsonb_typeof(v_hours) <> 'array' or jsonb_array_length(v_hours) <> 7 then
    return jsonb_build_object('openNow', true);
  end if;
  v_now := now() at time zone coalesce(v_tz, 'UTC');
  v_dow := extract(isodow from v_now)::int - 1;
  v_time := to_char(v_now, 'HH24:MI');
  d := v_hours -> v_dow;
  p := v_hours -> ((v_dow + 6) % 7);
  -- Yesterday's hours running past midnight (e.g. 18:00–02:00).
  if not coalesce((p ->> 'closed')::boolean, false) and (p ->> 'close') < (p ->> 'open')
     and v_time < (p ->> 'close') then
    return jsonb_build_object('openNow', true, 'closesAt', p ->> 'close');
  end if;
  if not coalesce((d ->> 'closed')::boolean, false) then
    if (d ->> 'close') < (d ->> 'open') then
      if v_time >= (d ->> 'open') then
        return jsonb_build_object('openNow', true, 'closesAt', d ->> 'close');
      end if;
    elsif v_time >= (d ->> 'open') and v_time < (d ->> 'close') then
      return jsonb_build_object('openNow', true, 'closesAt', d ->> 'close');
    end if;
    if v_time < (d ->> 'open') then
      return jsonb_build_object('openNow', false, 'opensAt', d ->> 'open', 'opensDay', v_dow);
    end if;
  end if;
  for i in 1..7 loop
    d := v_hours -> ((v_dow + i) % 7);
    if not coalesce((d ->> 'closed')::boolean, false) then
      return jsonb_build_object('openNow', false, 'opensAt', d ->> 'open', 'opensDay', (v_dow + i) % 7);
    end if;
  end loop;
  return jsonb_build_object('openNow', false);
end $$;

/** Owner: set (or clear with null = always open) the café's opening hours. */
create or replace function public.set_my_opening_hours(p_slug text, p_hours jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if p_hours = 'null'::jsonb then p_hours := null; end if;
  if not platform.valid_hours(p_hours) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'hours';
  end if;
  update public.cafes set opening_hours = p_hours, updated_at = now() where id = v_cafe;
end $$;

/* Public café page: + opening hours (footer), shown even before the website is published. */
drop function public.get_public_cafe(text);
create function public.get_public_cafe(p_slug text)
returns table (
  slug text, name text, status text, theme jsonb, default_locale text, currency text,
  country_code text, city text, address text, latitude double precision, longitude double precision,
  phone text, contact_email text, facebook_url text, instagram_url text, website jsonb, locales text[],
  opening_hours jsonb
)
language sql stable security definer set search_path = '' as $$
  select c.slug, c.name, c.status, c.theme, c.default_locale,
         case when c.status = 'active' then c.currency end,
         case when c.status = 'active' then c.country_code end,
         case when c.status = 'active' then c.city end,
         case when c.status = 'active' then c.address end,
         case when c.status = 'active' then c.latitude end,
         case when c.status = 'active' then c.longitude end,
         case when c.status = 'active' then c.phone end,
         case when c.status = 'active' then c.contact_email end,
         case when c.status = 'active' then c.facebook_url end,
         case when c.status = 'active' then c.instagram_url end,
         case when c.status = 'active' then w.published end,
         platform.offered_locales(c.default_locale, c.locales),
         case when c.status = 'active' then c.opening_hours end
    from public.cafes c
    left join public.cafe_websites w on w.cafe_id = c.id
   where c.slug = lower(btrim(coalesce(p_slug, '')))
     and c.status in ('active', 'suspended');
$$;
comment on function public.get_public_cafe(text) is
  'Public café page data (anon). Customer-facing fields, the PUBLISHED website, opening hours and the offered languages (main first); suspended cafés: name/status/theme/languages only.';

revoke all on function platform.valid_hours(jsonb) from public;
revoke all on function public.set_my_opening_hours(text, jsonb) from public;
revoke all on function public.get_public_cafe(text) from public;
grant execute on function platform.valid_hours(jsonb) to anon, authenticated;
grant execute on function public.set_my_opening_hours(text, jsonb) to authenticated;
grant execute on function public.get_public_cafe(text) to anon, authenticated;

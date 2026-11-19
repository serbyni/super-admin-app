-- Café contact details (phone, email, Facebook, Instagram), collected during onboarding and
-- editable in the café settings; owner profile (name, phone) editable by the owner.

/* ── Café contact columns ─────────────────────────────────────────────────── */

alter table public.cafes
  add column phone         text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  add column contact_email text check (char_length(contact_email) <= 254
                                       and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column facebook_url  text check (facebook_url ~ '^https://www\.facebook\.com/[A-Za-z0-9._/-]{1,100}$'),
  add column instagram_url text check (instagram_url ~ '^https://www\.instagram\.com/[A-Za-z0-9._]{1,30}$');

/** Raises invalid_input (with the field in DETAIL) for bad café details. Shared by create + update. */
create or replace function platform.check_cafe_input(
  p_name text, p_country_code text, p_currency text, p_timezone text, p_locale text, p_seed text,
  p_phone text, p_email text, p_facebook text, p_instagram text
) returns void language plpgsql stable set search_path = '' as $$
declare bad text;
begin
  bad := case
    when char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then 'name'
    when coalesce(p_country_code, '') !~ '^[A-Z]{2}$' then 'country_code'
    when coalesce(p_currency, '') !~ '^[A-Z]{3}$' then 'currency'
    when not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_timezone) then 'timezone'
    when coalesce(p_locale, '') not in ('en', 'fr', 'ar') then 'locale'
    when coalesce(p_seed, '') !~ '^#[0-9a-f]{6}$' then 'seed'
    when coalesce(p_phone, '') !~ '^\+[1-9][0-9]{6,14}$' then 'phone'
    when char_length(coalesce(p_email, '')) > 254
         or coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'email'
    when p_facebook is not null
         and p_facebook !~ '^https://www\.facebook\.com/[A-Za-z0-9._/-]{1,100}$' then 'facebook'
    when p_instagram is not null
         and p_instagram !~ '^https://www\.instagram\.com/[A-Za-z0-9._]{1,30}$' then 'instagram'
  end;
  if bad is not null then
    raise exception 'invalid_input' using errcode = 'P0001', detail = bad;
  end if;
end $$;

/* ── Onboarding: wizard has 6 steps now (contact = step 2), done = 7 ─────── */

create or replace function public.save_onboarding(p_step integer, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a platform.owner_accounts;
begin
  a := platform.onboarding_owner(true);
  if p_step not between 1 and 7 then raise exception 'invalid_step' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_data, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_data, '{}'::jsonb)::text) > 8192 then
    raise exception 'invalid_draft' using errcode = 'P0001';
  end if;
  update platform.owner_accounts
     set onboarding = jsonb_build_object(
           'step', p_step,
           'data', coalesce(onboarding -> 'data', '{}'::jsonb) || coalesce(p_data, '{}'::jsonb),
           'saved_at', now()),
         status = 'onboarding',
         updated_at = now()
   where user_id = a.user_id;
end $$;

-- Prefill also the café phone + email from the registration.
create or replace function public.get_my_onboarding()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a platform.owner_accounts;
  r platform.slug_reservations;
  v_email text;
begin
  a := platform.onboarding_owner();
  select * into r from platform.slug_reservations where user_id = a.user_id and expires_at > now();
  select u.email::text into v_email from auth.users u where u.id = a.user_id;
  return jsonb_build_object(
    'status', a.status,
    'step', coalesce((a.onboarding ->> 'step')::integer, 1),
    'draft', coalesce(a.onboarding -> 'data', '{}'::jsonb),
    'prefill', jsonb_strip_nulls(jsonb_build_object(
      'name', a.business_name, 'country_code', a.country_code, 'city', a.city,
      'address', a.formatted_address, 'latitude', a.latitude, 'longitude', a.longitude,
      'locale', a.locale, 'phone', a.phone, 'email', v_email)),
    'reservation', case when r.slug is null then null
                        else jsonb_build_object('slug', r.slug, 'expires_at', r.expires_at) end
  );
end $$;

/* ── provision_cafe: + contact details ───────────────────────────────────── */

drop function public.provision_cafe(text, text, text, text, text, text, text, text, jsonb, text, text);

/**
 * Create the caller's café (owner status approved/onboarding). Idempotent: an owner who already
 * has a café gets its id back. Raises not_authenticated, not_onboarding,
 * slug_<format|reserved|blocked|taken|held>, invalid_input (DETAIL = field), terms_required.
 */
create function public.provision_cafe(
  p_name text, p_slug text, p_country_code text, p_city text, p_address text,
  p_currency text, p_timezone text, p_locale text, p_theme jsonb,
  p_terms_version text, p_dpa_version text,
  p_phone text, p_email text, p_facebook text default null, p_instagram text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a platform.owner_accounts;
  existing uuid;
  n text := platform.normalize_slug(p_slug);
  problem text;
  cafe uuid;
  ev uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_cc text := upper(btrim(coalesce(p_country_code, '')));
  v_cur text := upper(btrim(coalesce(p_currency, '')));
  v_seed text := lower(coalesce(p_theme ->> 'seed', ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_fb text := nullif(btrim(coalesce(p_facebook, '')), '');
  v_ig text := nullif(btrim(coalesce(p_instagram, '')), '');
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select m.cafe_id into existing from public.cafe_members m where m.user_id = uid and m.role = 'owner';
  if existing is not null then return existing; end if;

  a := platform.onboarding_owner(true);

  problem := platform.slug_problem(n, uid);
  if problem is not null then raise exception 'slug_%', problem using errcode = 'P0001'; end if;
  perform platform.check_cafe_input(v_name, v_cc, v_cur, p_timezone, p_locale, v_seed,
                                    p_phone, v_email, v_fb, v_ig);
  if nullif(btrim(p_terms_version), '') is null or nullif(btrim(p_dpa_version), '') is null then
    raise exception 'terms_required' using errcode = 'P0001';
  end if;

  insert into public.cafes (
    slug, name, status, country_code, city, address, latitude, longitude, currency, timezone,
    default_locale, theme, terms_version, dpa_version, agreed_at, created_by,
    phone, contact_email, facebook_url, instagram_url
  ) values (
    n, v_name, 'active', v_cc,
    left(nullif(btrim(p_city), ''), 80), left(nullif(btrim(p_address), ''), 300),
    a.latitude, a.longitude, v_cur, p_timezone, p_locale,
    jsonb_build_object('seed', v_seed), btrim(p_terms_version), btrim(p_dpa_version), now(), uid,
    p_phone, v_email, v_fb, v_ig
  ) returning id into cafe;

  insert into public.cafe_members (cafe_id, user_id, role) values (cafe, uid, 'owner');

  update platform.owner_accounts
     set status = 'active', cafe_slug = n, onboarding = '{}'::jsonb, updated_at = now()
   where user_id = uid;

  delete from platform.slug_reservations where user_id = uid or slug = n;

  -- Event → owner email ("Your café is ready") + real-time notification to every super admin.
  insert into platform.events (type, subject_user_id, actor_user_id, payload)
  values ('cafe_created', uid, uid,
          jsonb_build_object('cafe_id', cafe, 'cafe_slug', n, 'cafe_name', v_name,
                             'business_name', v_name))
  returning id into ev;
  insert into platform.email_deliveries (event_id, template, recipient_user_id)
  values (ev, 'cafe_created', uid);
  insert into platform.notifications (recipient_user_id, type, event_id, data)
  select pa.user_id, 'cafe_created', ev,
         jsonb_build_object('owner_user_id', uid, 'business_name', v_name, 'cafe_slug', n)
    from platform.platform_admins pa;

  return cafe;
end $$;

/* ── Café settings (owner only) ───────────────────────────────────────────── */

/**
 * Update the caller's café (identified by its current slug). Only its OWNER may do it.
 * The address (slug) is not changed here. Raises forbidden, invalid_input (DETAIL = field).
 */
create or replace function public.update_my_cafe(
  p_slug text, p_name text, p_country_code text, p_city text, p_address text,
  p_currency text, p_timezone text, p_locale text, p_seed text,
  p_phone text, p_email text, p_facebook text default null, p_instagram text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_cafe uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_cc text := upper(btrim(coalesce(p_country_code, '')));
  v_cur text := upper(btrim(coalesce(p_currency, '')));
  v_seed text := lower(btrim(coalesce(p_seed, '')));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_fb text := nullif(btrim(coalesce(p_facebook, '')), '');
  v_ig text := nullif(btrim(coalesce(p_instagram, '')), '');
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select c.id into v_cafe
    from public.cafes c
    join public.cafe_members m on m.cafe_id = c.id and m.user_id = uid and m.role = 'owner'
   where c.slug = lower(btrim(coalesce(p_slug, '')))
   for update of c;
  if v_cafe is null then raise exception 'forbidden' using errcode = '42501'; end if;

  perform platform.check_cafe_input(v_name, v_cc, v_cur, p_timezone, p_locale, v_seed,
                                    p_phone, v_email, v_fb, v_ig);

  update public.cafes
     set name = v_name, country_code = v_cc,
         city = left(nullif(btrim(p_city), ''), 80), address = left(nullif(btrim(p_address), ''), 300),
         currency = v_cur, timezone = p_timezone, default_locale = p_locale,
         theme = coalesce(theme, '{}'::jsonb) || jsonb_build_object('seed', v_seed),
         phone = p_phone, contact_email = v_email, facebook_url = v_fb, instagram_url = v_ig,
         updated_at = now()
   where id = v_cafe;
end $$;

/* ── Owner profile (name + phone) ─────────────────────────────────────────── */

create or replace function public.get_my_profile()
returns table (full_name text, phone text, email text)
language sql stable security definer set search_path = '' as $$
  select a.full_name, a.phone, u.email::text
    from auth.users u
    left join platform.owner_accounts a on a.user_id = u.id
   where u.id = auth.uid();
$$;

/** Raises not_authenticated, forbidden (no owner account), invalid_input (DETAIL = field). */
create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'full_name';
  end if;
  if coalesce(p_phone, '') !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'phone';
  end if;
  update platform.owner_accounts
     set full_name = v_name, phone = p_phone, updated_at = now()
   where user_id = uid;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

/* ── Super admin café detail: + contact ───────────────────────────────────── */

drop function public.admin_get_cafe(text);

create function public.admin_get_cafe(p_slug text)
returns table (
  id uuid, slug text, name text, status text,
  country_code text, city text, address text, latitude double precision, longitude double precision,
  currency text, timezone text, default_locale text, theme jsonb,
  terms_version text, dpa_version text, agreed_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  owner_user_id uuid, owner_email text, owner_name text, owner_phone text,
  members_count integer,
  phone text, contact_email text, facebook_url text, instagram_url text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select c.id, c.slug, c.name, c.status,
           c.country_code, c.city, c.address, c.latitude, c.longitude,
           c.currency, c.timezone, c.default_locale, c.theme,
           c.terms_version, c.dpa_version, c.agreed_at,
           c.created_at, c.updated_at,
           m.user_id, u.email::text, o.full_name, o.phone,
           (select count(*)::integer from public.cafe_members x where x.cafe_id = c.id),
           c.phone, c.contact_email, c.facebook_url, c.instagram_url
      from public.cafes c
      left join public.cafe_members m on m.cafe_id = c.id and m.role = 'owner'
      left join auth.users u on u.id = m.user_id
      left join platform.owner_accounts o on o.user_id = m.user_id
     where c.slug = lower(btrim(p_slug));
end $$;

/* ── Grants ───────────────────────────────────────────────────────────────── */

revoke all on function platform.check_cafe_input(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;

revoke all on function public.provision_cafe(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) from public, anon;
revoke all on function public.update_my_cafe(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.update_my_profile(text, text) from public, anon;
revoke all on function public.admin_get_cafe(text) from public, anon;
grant execute on function public.provision_cafe(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_my_cafe(text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.admin_get_cafe(text) to authenticated;

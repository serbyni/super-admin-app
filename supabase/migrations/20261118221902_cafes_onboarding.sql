-- Onboarding: cafés, membership, café-address (slug) rules, reservations, wizard draft,
-- provisioning, and the super-admin café list.
--
-- Café data (public.cafes, public.cafe_members) belongs to the café: RLS lets only its members
-- read it; nothing writes it directly — provision_cafe (security definer) creates it.
-- Platform bookkeeping (reservations, onboarding draft) stays in the private `platform` schema.

create extension if not exists unaccent with schema extensions;

/* ── Event type ───────────────────────────────────────────────────────────── */
alter type platform.event_type add value if not exists 'cafe_created';

/* ── Cafés + members ──────────────────────────────────────────────────────── */

create table public.cafes (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                   check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' and slug !~ '--'),
  name           text not null check (char_length(btrim(name)) between 2 and 80),
  status         text not null default 'active' check (status in ('active', 'suspended')),
  country_code   text not null check (country_code ~ '^[A-Z]{2}$'),
  city           text check (char_length(city) between 1 and 80),
  address        text check (char_length(address) <= 300),
  latitude       double precision check (latitude between -90 and 90),
  longitude      double precision check (longitude between -180 and 180),
  currency       text not null check (currency ~ '^[A-Z]{3}$'),
  timezone       text not null check (char_length(timezone) between 3 and 64),
  default_locale text not null default 'en' check (default_locale in ('en', 'fr', 'ar')),
  theme          jsonb not null default '{}'::jsonb,
  terms_version  text not null,
  dpa_version    text not null,
  agreed_at      timestamptz not null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.cafes is
  'Cafés (tenants). Café business data: readable by its members only (RLS); created by provision_cafe.';

create table public.cafe_members (
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (cafe_id, user_id)
);
create index cafe_members_user_idx on public.cafe_members (user_id);
-- MVP: one café per owner.
create unique index cafe_members_one_owned_cafe on public.cafe_members (user_id) where role = 'owner';

alter table public.cafes enable row level security;
alter table public.cafe_members enable row level security;

/** True when the signed-in user is a member of the café (used by RLS; avoids policy recursion). */
create or replace function public.is_cafe_member(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cafe_members m where m.cafe_id = p_cafe_id and m.user_id = auth.uid()
  )
$$;
revoke all on function public.is_cafe_member(uuid) from public, anon;
grant execute on function public.is_cafe_member(uuid) to authenticated;

create policy "members read their café" on public.cafes
  for select to authenticated using (public.is_cafe_member(id));
create policy "members read their memberships" on public.cafe_members
  for select to authenticated using (user_id = (select auth.uid()));

-- Read only for signed-in members (policies above); no direct writes, no anonymous access.
revoke all on public.cafes, public.cafe_members from anon, authenticated;
grant select on public.cafes, public.cafe_members to authenticated;

/* ── Café address (slug) rules — single source of truth ───────────────────── */

-- Words a café address may never be: system names + this app's top-level pages.
create table platform.reserved_slugs (slug text primary key);
insert into platform.reserved_slugs (slug) values
  ('admin'), ('www'), ('app'), ('api'), ('q'), ('mail'), ('static'), ('assets'), ('cdn'),
  ('status'), ('staging'), ('admin-staging'), ('support'), ('help'), ('docs'), ('blog'),
  ('billing'), ('auth'), ('login'), ('logout'), ('dashboard'), ('serbi'), ('register'),
  ('onboarding'), ('pending'), ('about'), ('contact'), ('privacy'), ('terms'), ('dpa'),
  ('forgot-password'), ('reset-password'), ('account'), ('settings'), ('menu'), ('send'),
  ('rsend'), ('dev'), ('test');
-- Offensive words / third-party brands (filled by the team; substring match).
create table platform.slug_blocklist (word text primary key check (word ~ '^[a-z0-9-]{3,30}$'));
alter table platform.reserved_slugs enable row level security;
alter table platform.slug_blocklist enable row level security;

create table platform.slug_reservations (
  slug       text primary key,
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
alter table platform.slug_reservations enable row level security;

/** 'Café Lune  Tunis' → 'cafe-lune-tunis' (lowercase, accents removed, separators → '-'). */
create or replace function platform.normalize_slug(p text)
returns text language sql stable set search_path = '' as $$
  select btrim(
    regexp_replace(
      regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'),
    '-')
$$;

/**
 * Why `p_slug` (already normalized) cannot be used by `p_user`, or null when it can:
 * 'format' | 'reserved' | 'blocked' | 'taken' | 'held'.
 */
create or replace function platform.slug_problem(p_slug text, p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_slug is null
      or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' or p_slug ~ '--' then 'format'
    when exists (select 1 from platform.reserved_slugs r where r.slug = p_slug)
      or p_slug ~ '-dev$' then 'reserved'
    when exists (select 1 from platform.slug_blocklist b where position(b.word in p_slug) > 0)
      then 'blocked'
    when exists (select 1 from public.cafes c where c.slug = p_slug) then 'taken'
    when exists (
      select 1 from platform.slug_reservations s
       where s.slug = p_slug and s.expires_at > now() and s.user_id <> p_user
    ) then 'held'
  end
$$;

/** Owner context for onboarding RPCs: the caller's owner row, locked, with an allowed status. */
create or replace function platform.onboarding_owner(p_lock boolean default false)
returns platform.owner_accounts language plpgsql security definer set search_path = '' as $$
declare
  a platform.owner_accounts;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_lock then
    select * into a from platform.owner_accounts where user_id = auth.uid() for update;
  else
    select * into a from platform.owner_accounts where user_id = auth.uid();
  end if;
  if a.user_id is null or a.status not in ('approved', 'onboarding') then
    raise exception 'not_onboarding' using errcode = 'P0001';
  end if;
  return a;
end $$;

/**
 * Live check for the wizard. Returns
 * {normalized, available, reason?, suggestions: [..]} — suggestions only when unavailable.
 */
create or replace function public.check_slug(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a platform.owner_accounts;
  n text := platform.normalize_slug(p_slug);
  problem text;
  base text;
  city text;
  cand text;
  suggestions text[] := '{}';
begin
  a := platform.onboarding_owner();
  problem := platform.slug_problem(n, uid);
  if problem is null then
    return jsonb_build_object('normalized', n, 'available', true);
  end if;

  base := left(coalesce(nullif(n, ''), platform.normalize_slug(a.business_name), 'cafe'), 22);
  base := btrim(base, '-');
  city := left(platform.normalize_slug(a.city), 10);
  foreach cand in array array[
    base || '-' || city, base || '-cafe', 'cafe-' || base, base || '-2', base || '-3', base || '-4'
  ] loop
    cand := btrim(regexp_replace(cand, '-{2,}', '-', 'g'), '-');
    if cand <> n and platform.slug_problem(cand, uid) is null and not (cand = any (suggestions)) then
      suggestions := suggestions || cand;
    end if;
    exit when array_length(suggestions, 1) >= 3;
  end loop;

  return jsonb_build_object(
    'normalized', n, 'available', false, 'reason', problem, 'suggestions', to_jsonb(suggestions)
  );
end $$;

/** Hold an available address for the caller for 30 minutes (replaces their previous hold). */
create or replace function public.reserve_slug(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n text := platform.normalize_slug(p_slug);
  problem text;
  until timestamptz := now() + interval '30 minutes';
begin
  perform platform.onboarding_owner();
  problem := platform.slug_problem(n, uid);
  if problem is not null then raise exception 'slug_%', problem using errcode = 'P0001'; end if;
  delete from platform.slug_reservations where user_id = uid or (slug = n and expires_at <= now());
  insert into platform.slug_reservations (slug, user_id, expires_at) values (n, uid, until);
  return jsonb_build_object('slug', n, 'expires_at', until);
end $$;

/* ── Wizard draft (resume after leaving) ──────────────────────────────────── */

alter table platform.owner_accounts
  add column if not exists onboarding jsonb not null default '{}'::jsonb;

/** Save the wizard step + draft (merged). Moves an approved owner to 'onboarding'. */
create or replace function public.save_onboarding(p_step integer, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a platform.owner_accounts;
begin
  a := platform.onboarding_owner(true);
  if p_step not between 1 and 6 then raise exception 'invalid_step' using errcode = 'P0001'; end if;
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

/** Wizard state: saved draft + registration data to pre-fill + the caller's current hold. */
create or replace function public.get_my_onboarding()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a platform.owner_accounts;
  r platform.slug_reservations;
begin
  a := platform.onboarding_owner();
  select * into r from platform.slug_reservations where user_id = a.user_id and expires_at > now();
  return jsonb_build_object(
    'status', a.status,
    'step', coalesce((a.onboarding ->> 'step')::integer, 1),
    'draft', coalesce(a.onboarding -> 'data', '{}'::jsonb),
    'prefill', jsonb_strip_nulls(jsonb_build_object(
      'name', a.business_name, 'country_code', a.country_code, 'city', a.city,
      'address', a.formatted_address, 'latitude', a.latitude, 'longitude', a.longitude,
      'locale', a.locale)),
    'reservation', case when r.slug is null then null
                        else jsonb_build_object('slug', r.slug, 'expires_at', r.expires_at) end
  );
end $$;

/* ── Provisioning ─────────────────────────────────────────────────────────── */

/**
 * Create the caller's café in ONE transaction and make them an active owner.
 * Idempotent: if the caller already owns a café, returns its id. One café per owner (MVP).
 * Raises: not_authenticated, not_onboarding, slug_<format|reserved|blocked|taken|held>,
 * invalid_name, invalid_currency, invalid_timezone, invalid_locale, invalid_theme, terms_required.
 */
create or replace function public.provision_cafe(
  p_name text, p_slug text, p_country_code text, p_city text, p_address text,
  p_currency text, p_timezone text, p_locale text, p_theme jsonb,
  p_terms_version text, p_dpa_version text
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
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  -- Idempotent: already provisioned → same café.
  select m.cafe_id into existing from public.cafe_members m where m.user_id = uid and m.role = 'owner';
  if existing is not null then return existing; end if;

  a := platform.onboarding_owner(true);

  problem := platform.slug_problem(n, uid);
  if problem is not null then raise exception 'slug_%', problem using errcode = 'P0001'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if v_cc !~ '^[A-Z]{2}$' then raise exception 'invalid_country' using errcode = 'P0001'; end if;
  if v_cur !~ '^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode = 'P0001'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = 'P0001';
  end if;
  if coalesce(p_locale, '') not in ('en', 'fr', 'ar') then raise exception 'invalid_locale' using errcode = 'P0001'; end if;
  if v_seed !~ '^#[0-9a-f]{6}$' then raise exception 'invalid_theme' using errcode = 'P0001'; end if;
  if nullif(btrim(p_terms_version), '') is null or nullif(btrim(p_dpa_version), '') is null then
    raise exception 'terms_required' using errcode = 'P0001';
  end if;

  insert into public.cafes (
    slug, name, status, country_code, city, address, latitude, longitude, currency, timezone,
    default_locale, theme, terms_version, dpa_version, agreed_at, created_by
  ) values (
    n, v_name, 'active', v_cc,
    left(nullif(btrim(p_city), ''), 80), left(nullif(btrim(p_address), ''), 300),
    a.latitude, a.longitude, v_cur, p_timezone, p_locale,
    jsonb_build_object('seed', v_seed), btrim(p_terms_version), btrim(p_dpa_version), now(), uid
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

/* ── Super admin: café list (platform data only — no menus, orders, customers) ─ */

create or replace function public.admin_list_cafes()
returns table (
  id uuid, slug text, name text, status text, country_code text, city text,
  owner_user_id uuid, owner_email text, owner_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select c.id, c.slug, c.name, c.status, c.country_code, c.city,
           m.user_id, u.email::text, o.full_name, c.created_at
      from public.cafes c
      left join public.cafe_members m on m.cafe_id = c.id and m.role = 'owner'
      left join auth.users u on u.id = m.user_id
      left join platform.owner_accounts o on o.user_id = m.user_id
     order by c.created_at desc
     limit 500;
end $$;

/* ── Grants ───────────────────────────────────────────────────────────────── */

revoke all on function platform.normalize_slug(text) from public, anon, authenticated;
revoke all on function platform.slug_problem(text, uuid) from public, anon, authenticated;
revoke all on function platform.onboarding_owner(boolean) from public, anon, authenticated;

revoke all on function public.check_slug(text) from public, anon;
revoke all on function public.reserve_slug(text) from public, anon;
revoke all on function public.save_onboarding(integer, jsonb) from public, anon;
revoke all on function public.get_my_onboarding() from public, anon;
revoke all on function public.provision_cafe(text, text, text, text, text, text, text, text, jsonb, text, text) from public, anon;
revoke all on function public.admin_list_cafes() from public, anon;
grant execute on function public.check_slug(text) to authenticated;
grant execute on function public.reserve_slug(text) to authenticated;
grant execute on function public.save_onboarding(integer, jsonb) to authenticated;
grant execute on function public.get_my_onboarding() to authenticated;
grant execute on function public.provision_cafe(text, text, text, text, text, text, text, text, jsonb, text, text) to authenticated;
grant execute on function public.admin_list_cafes() to authenticated;

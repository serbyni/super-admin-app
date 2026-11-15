-- ── Platform admins ──────────────────────────────────────────────────────────
create table if not exists platform.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform.platform_admins enable row level security;
comment on table platform.platform_admins is 'Serbi super admins. RLS on, no policies: managed by SQL/service scripts only.';

-- TODO(MFA): require auth.jwt()->>'aal' = 'aal2' once TOTP enrolment exists (architecture 04).
create or replace function platform.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from platform.platform_admins where user_id = auth.uid())
$$;
revoke all on function platform.is_platform_admin() from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select platform.is_platform_admin()
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- ── Business types (managed by super admins, used by the register form) ─────
create table if not exists platform.business_types (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z][a-z0-9_]{1,30}$'),
  name       jsonb not null check (name ? 'en' and char_length(name ->> 'en') between 2 and 60),
  icon       text not null default 'storefront' check (icon ~ '^[a-z0-9_]{2,40}$'),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table platform.business_types enable row level security;
comment on table platform.business_types is 'Business categories offered at sign-up. Access via list_business_types / admin_* RPCs only.';

insert into platform.business_types (slug, name, icon, sort_order) values
  ('cafe',       '{"en":"Café / coffee shop","fr":"Café / coffee shop","ar":"مقهى"}', 'local_cafe', 10),
  ('restaurant', '{"en":"Restaurant","fr":"Restaurant","ar":"مطعم"}',                'restaurant', 20),
  ('bakery',     '{"en":"Bakery","fr":"Boulangerie / pâtisserie","ar":"مخبزة"}',      'bakery_dining', 30),
  ('other',      '{"en":"Other","fr":"Autre","ar":"أخرى"}',                           'storefront', 100)
on conflict (slug) do nothing;

-- owner_accounts.business_type now references the managed list.
alter table platform.owner_accounts drop constraint if exists owner_accounts_business_type_check;
alter table platform.owner_accounts drop constraint if exists owner_accounts_business_type_fkey;
alter table platform.owner_accounts
  add constraint owner_accounts_business_type_fkey
  foreign key (business_type) references platform.business_types (slug) on update cascade;

-- Public: active types for the register form (anyone, incl. signed-out visitors).
create or replace function public.list_business_types()
returns table (slug text, name jsonb, icon text)
language sql stable security definer set search_path = '' as $$
  select t.slug, t.name, t.icon from platform.business_types t where t.is_active order by t.sort_order, t.slug
$$;
revoke all on function public.list_business_types() from public;
grant execute on function public.list_business_types() to anon, authenticated;

-- Admin: full list with usage counts.
create or replace function public.admin_list_business_types()
returns table (id uuid, slug text, name jsonb, icon text, sort_order int, is_active boolean, owners_count bigint, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select t.id, t.slug, t.name, t.icon, t.sort_order, t.is_active,
           (select count(*) from platform.owner_accounts o where o.business_type = t.slug),
           t.updated_at
      from platform.business_types t
     order by t.sort_order, t.slug;
end $$;

-- Admin: create (p_id null) or update.
create or replace function public.admin_save_business_type(
  p_id uuid, p_slug text, p_name jsonb, p_icon text, p_sort_order int, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_id is null then
    insert into platform.business_types (slug, name, icon, sort_order, is_active, updated_by)
    values (p_slug, p_name, p_icon, p_sort_order, p_is_active, auth.uid())
    returning id into rid;
  else
    update platform.business_types
       set slug = p_slug, name = p_name, icon = p_icon, sort_order = p_sort_order,
           is_active = p_is_active, updated_at = now(), updated_by = auth.uid()
     where id = p_id
    returning id into rid;
    if rid is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  return rid;
end $$;

-- Admin: delete when unused; otherwise refuse (deactivate instead).
create or replace function public.admin_delete_business_type(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select slug into s from platform.business_types where id = p_id;
  if s is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from platform.owner_accounts where business_type = s) then
    raise exception 'in_use' using errcode = 'P0001';
  end if;
  delete from platform.business_types where id = p_id;
end $$;

revoke all on function public.admin_list_business_types() from public, anon;
revoke all on function public.admin_save_business_type(uuid, text, jsonb, text, int, boolean) from public, anon;
revoke all on function public.admin_delete_business_type(uuid) from public, anon;
grant execute on function public.admin_list_business_types() to authenticated;
grant execute on function public.admin_save_business_type(uuid, text, jsonb, text, int, boolean) to authenticated;
grant execute on function public.admin_delete_business_type(uuid) to authenticated;

-- complete_owner_profile: only active business types are accepted.
create or replace function public.complete_owner_profile(
  p_full_name text, p_phone text, p_business_name text, p_business_type text,
  p_country text, p_city text, p_locale text, p_terms_version text
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

  update platform.owner_accounts
     set full_name = p_full_name, phone = p_phone, business_name = p_business_name,
         business_type = p_business_type, country = p_country, city = p_city,
         locale = coalesce(nullif(p_locale, ''), 'en'), terms_version = p_terms_version,
         terms_accepted_at = now(),
         status = 'pending_approval', submitted_at = now(), updated_at = now()
   where user_id = uid;
  return 'pending_approval';
end $$;

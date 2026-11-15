-- Platform schema: café-owner accounts (the platform's own customers).
-- Not exposed through the Data API; clients only use the public RPCs below.

create schema if not exists platform;
revoke all on schema platform from public, anon, authenticated;

do $$ begin
  create type platform.owner_status as enum (
    'profile_incomplete', -- signed up with Google/Facebook, business details still missing
    'email_unverified',   -- signed up with email, link not clicked yet
    'pending_approval',   -- waiting for the Serbi team
    'approved',           -- may start onboarding
    'rejected',
    'onboarding',
    'active',
    'suspended'
  );
exception when duplicate_object then null; end $$;

create table if not exists platform.owner_accounts (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  status            platform.owner_status not null,
  full_name         text check (char_length(full_name) between 2 and 80),
  phone             text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  business_name     text check (char_length(business_name) between 2 and 80),
  business_type     text check (business_type in ('cafe', 'restaurant', 'bakery', 'other')),
  country           text check (char_length(country) between 2 and 60),
  city              text check (char_length(city) between 1 and 80),
  locale            text not null default 'en' check (locale in ('en', 'fr', 'ar')),
  terms_version     text,
  terms_accepted_at timestamptz,
  signup_provider   text not null default 'email',
  submitted_at      timestamptz,
  decided_by        uuid references auth.users (id),
  decided_at        timestamptz,
  rejection_reason  text,
  reapply_count     int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table platform.owner_accounts enable row level security;
-- No policies on purpose: only security-definer functions below may read/write.

create index if not exists owner_accounts_status_idx on platform.owner_accounts (status, submitted_at);

-- True when all business details required for review are present.
create or replace function platform.owner_profile_complete(a platform.owner_accounts)
returns boolean language sql immutable as $$
  select a.full_name is not null and a.phone is not null and a.business_name is not null
     and a.business_type is not null and a.country is not null and a.city is not null
     and a.terms_accepted_at is not null
$$;

-- New auth user → owner account (only for sign-ups coming from the owner register flow).
create or replace function platform.handle_new_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  acc platform.owner_accounts;
begin
  if coalesce(m ->> 'signup_source', '') <> 'owner' and provider = 'email' then
    return new; -- not an owner sign-up (e.g. invited staff later)
  end if;

  insert into platform.owner_accounts (
    user_id, status, full_name, phone, business_name, business_type, country, city,
    locale, terms_version, terms_accepted_at, signup_provider
  ) values (
    new.id, 'email_unverified',
    nullif(m ->> 'full_name', ''), nullif(m ->> 'phone', ''), nullif(m ->> 'business_name', ''),
    nullif(m ->> 'business_type', ''), nullif(m ->> 'country', ''), nullif(m ->> 'city', ''),
    coalesce(nullif(m ->> 'locale', ''), 'en'), nullif(m ->> 'terms_version', ''),
    case when m ? 'terms_version' then now() end, provider
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

drop trigger if exists on_auth_user_created_owner on auth.users;
create trigger on_auth_user_created_owner
  after insert on auth.users
  for each row execute function platform.handle_new_owner();

-- Email confirmed → submit the application.
create or replace function platform.handle_owner_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update platform.owner_accounts
     set status = 'pending_approval', submitted_at = now(), updated_at = now()
   where user_id = new.id and status = 'email_unverified';
  return new;
end $$;

drop trigger if exists on_auth_user_email_confirmed_owner on auth.users;
create trigger on_auth_user_email_confirmed_owner
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function platform.handle_owner_email_confirmed();

-- ── Public RPCs (the only way clients touch owner accounts) ──────────────────

-- Current user's owner status, or null if not an owner.
create or replace function public.get_my_owner_status()
returns text language sql stable security definer set search_path = '' as $$
  select status::text from platform.owner_accounts where user_id = auth.uid()
$$;

-- Social sign-up: fill the missing business details, then submit for review.
create or replace function public.complete_owner_profile(
  p_full_name text, p_phone text, p_business_name text, p_business_type text,
  p_country text, p_city text, p_locale text, p_terms_version text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  st platform.owner_status;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

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

revoke all on function public.get_my_owner_status() from public, anon;
revoke all on function public.complete_owner_profile(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.get_my_owner_status() to authenticated;
grant execute on function public.complete_owner_profile(text, text, text, text, text, text, text, text) to authenticated;
revoke all on function platform.handle_new_owner() from public, anon, authenticated;
revoke all on function platform.handle_owner_email_confirmed() from public, anon, authenticated;

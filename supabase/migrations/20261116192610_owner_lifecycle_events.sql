-- Owner lifecycle events (transactional outbox) → emails (Resend) + in-app notifications.
--
-- One trigger on platform.owner_accounts turns every status change into an event, in the SAME
-- transaction as the change:
--   pending_approval → register_new_user   email to owner ("application received"),
--                                          notification to every super admin
--   approved         → admin_approve_user  email to owner + notification to owner
--   rejected         → admin_declined_user email to owner (with the reason)
-- The app's dispatcher (service role only) claims due email deliveries, sends them and records
-- the result; failures are retried with exponential backoff.

create type platform.event_type as enum (
  'register_new_user',
  'admin_approve_user',
  'admin_declined_user'
);

create table platform.events (
  id              uuid primary key default gen_random_uuid(),
  type            platform.event_type not null,
  subject_user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id   uuid references auth.users (id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index events_subject_idx on platform.events (subject_user_id, created_at desc);

create table platform.email_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references platform.events (id) on delete cascade,
  template            text not null,
  recipient_user_id   uuid not null references auth.users (id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts            integer not null default 0,
  next_attempt_at     timestamptz not null default now(),
  locked_until        timestamptz,
  sent_at             timestamptz,
  provider_message_id text,
  last_error          text,
  created_at          timestamptz not null default now()
);
create index email_deliveries_due_idx on platform.email_deliveries (next_attempt_at)
  where status = 'pending';

create table platform.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  type              platform.event_type not null,
  event_id          uuid references platform.events (id) on delete cascade,
  data              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  read_at           timestamptz
);
create index notifications_recipient_idx on platform.notifications (recipient_user_id, created_at desc);
create index notifications_unread_idx on platform.notifications (recipient_user_id)
  where read_at is null;

-- Private schema, accessed only through the functions below.
alter table platform.events enable row level security;
alter table platform.email_deliveries enable row level security;
alter table platform.notifications enable row level security;

/* ── Trigger: status change → event + email delivery + notifications ───────── */

create or replace function platform.on_owner_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type  platform.event_type;
  v_event uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  v_type := case new.status::text
    when 'pending_approval' then 'register_new_user'
    when 'approved'         then 'admin_approve_user'
    when 'rejected'         then 'admin_declined_user'
  end;
  if v_type is null then return new; end if;

  insert into platform.events (type, subject_user_id, actor_user_id, payload)
  values (
    v_type,
    new.user_id,
    case when v_type = 'register_new_user' then null else new.decided_by end,
    jsonb_strip_nulls(jsonb_build_object(
      'business_name', new.business_name,
      'reason', case when v_type = 'admin_declined_user' then new.rejection_reason end
    ))
  )
  returning id into v_event;

  insert into platform.email_deliveries (event_id, template, recipient_user_id)
  values (v_event, v_type::text, new.user_id);

  if v_type = 'register_new_user' then
    insert into platform.notifications (recipient_user_id, type, event_id, data)
    select a.user_id, v_type, v_event,
           jsonb_build_object('owner_user_id', new.user_id, 'business_name', new.business_name)
      from platform.platform_admins a;
  elsif v_type = 'admin_approve_user' then
    insert into platform.notifications (recipient_user_id, type, event_id, data)
    values (new.user_id, v_type, v_event, jsonb_build_object('business_name', new.business_name));
  end if;

  return new;
end $$;

create trigger on_owner_status_change
  after insert or update of status on platform.owner_accounts
  for each row execute function platform.on_owner_status_change();

/* ── Super admin: user management ─────────────────────────────────────────── */

create or replace function public.admin_list_owners(p_status text default null)
returns table (
  user_id uuid, email text, status text, full_name text, phone text, business_name text,
  business_type text, city text, country_code text, signup_provider text,
  submitted_at timestamptz, decided_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden'; end if;
  return query
    select a.user_id, u.email::text, a.status::text, a.full_name, a.phone, a.business_name,
           a.business_type, a.city, a.country_code, a.signup_provider,
           a.submitted_at, a.decided_at, a.created_at
      from platform.owner_accounts a
      join auth.users u on u.id = a.user_id
     where p_status is null or a.status::text = p_status
     order by (a.status = 'pending_approval') desc,
              coalesce(a.submitted_at, a.created_at) desc
     limit 500;
end $$;

create or replace function public.admin_owner_stats()
returns table (pending bigint, approved bigint, rejected bigint, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden'; end if;
  return query
    select count(*) filter (where status = 'pending_approval'),
           count(*) filter (where status = 'approved'),
           count(*) filter (where status = 'rejected'),
           count(*)
      from platform.owner_accounts;
end $$;

create or replace function public.admin_get_owner(p_user_id uuid)
returns table (
  user_id uuid, email text, email_confirmed boolean, status text, full_name text, phone text,
  business_name text, business_type text, signup_provider text, locale text,
  formatted_address text, street text, postal_code text, city text, region text, country text,
  country_code text, latitude double precision, longitude double precision,
  location_source text, submitted_at timestamptz, decided_at timestamptz,
  decided_by_email text, rejection_reason text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden'; end if;
  return query
    select a.user_id, u.email::text, u.email_confirmed_at is not null, a.status::text,
           a.full_name, a.phone, a.business_name, a.business_type, a.signup_provider, a.locale,
           a.formatted_address, a.street, a.postal_code, a.city, a.region, a.country,
           a.country_code, a.latitude, a.longitude, a.location_source, a.submitted_at,
           a.decided_at, d.email::text, a.rejection_reason, a.created_at
      from platform.owner_accounts a
      join auth.users u on u.id = a.user_id
      left join auth.users d on d.id = a.decided_by
     where a.user_id = p_user_id;
end $$;

create or replace function public.admin_approve_owner(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden'; end if;
  update platform.owner_accounts
     set status = 'approved', decided_by = auth.uid(), decided_at = now(),
         rejection_reason = null, updated_at = now()
   where user_id = p_user_id and status = 'pending_approval';
  if not found then raise exception 'invalid_status'; end if;
end $$;

create or replace function public.admin_decline_owner(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not platform.is_platform_admin() then raise exception 'forbidden'; end if;
  if char_length(v_reason) not between 10 and 1000 then raise exception 'invalid_reason'; end if;
  update platform.owner_accounts
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
         rejection_reason = v_reason, updated_at = now()
   where user_id = p_user_id and status = 'pending_approval';
  if not found then raise exception 'invalid_status'; end if;
end $$;

/* ── Notifications of the signed-in user (owners and admins) ──────────────── */

create or replace function public.my_notifications(p_limit integer default 20)
returns table (id uuid, type text, data jsonb, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.type::text, n.data, n.created_at, n.read_at
    from platform.notifications n
   where n.recipient_user_id = auth.uid()
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create or replace function public.my_unread_notification_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from platform.notifications
   where recipient_user_id = auth.uid() and read_at is null;
$$;

/** p_ids null → mark all as read. */
create or replace function public.mark_my_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = '' as $$
  update platform.notifications set read_at = now()
   where recipient_user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
$$;

/* ── Email dispatcher (service role only) ─────────────────────────────────── */

/** Claim up to p_limit due deliveries for p_lease_seconds (concurrent dispatchers skip them). */
create or replace function public.email_claim_deliveries(p_limit integer default 20, p_lease_seconds integer default 120)
returns table (
  delivery_id uuid, template text, attempts integer, recipient_email text, recipient_name text,
  business_name text, locale text, reason text
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    with due as (
      select d.id
        from platform.email_deliveries d
       where d.status = 'pending' and d.next_attempt_at <= now()
         and (d.locked_until is null or d.locked_until < now())
       order by d.next_attempt_at
       limit least(greatest(coalesce(p_limit, 20), 1), 100)
       for update skip locked
    ), claimed as (
      update platform.email_deliveries d
         set locked_until = now() + make_interval(secs => p_lease_seconds),
             attempts = d.attempts + 1
        from due
       where d.id = due.id
      returning d.id, d.template, d.attempts, d.recipient_user_id, d.event_id
    )
    select c.id, c.template, c.attempts, u.email::text, a.full_name,
           coalesce(a.business_name, e.payload ->> 'business_name'), coalesce(a.locale, 'en'),
           e.payload ->> 'reason'
      from claimed c
      join auth.users u on u.id = c.recipient_user_id
      join platform.events e on e.id = c.event_id
      left join platform.owner_accounts a on a.user_id = c.recipient_user_id;
end $$;

/** Record the result of one send. Errors are retried with backoff (1, 2, 4 … min), max 8 attempts. */
create or replace function public.email_complete_delivery(
  p_delivery_id uuid, p_provider_message_id text default null, p_error text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_error is null then
    update platform.email_deliveries
       set status = 'sent', sent_at = now(), provider_message_id = p_provider_message_id,
           locked_until = null, last_error = null
     where id = p_delivery_id;
  else
    update platform.email_deliveries
       set status = case when attempts >= 8 then 'failed' else 'pending' end,
           next_attempt_at = now() + make_interval(mins => power(2, greatest(attempts - 1, 0))::integer),
           locked_until = null,
           last_error = left(p_error, 500)
     where id = p_delivery_id;
  end if;
end $$;

/* ── Grants ───────────────────────────────────────────────────────────────── */

revoke all on function platform.on_owner_status_change() from public, anon, authenticated;

revoke all on function public.admin_list_owners(text) from public, anon;
revoke all on function public.admin_owner_stats() from public, anon;
revoke all on function public.admin_get_owner(uuid) from public, anon;
revoke all on function public.admin_approve_owner(uuid) from public, anon;
revoke all on function public.admin_decline_owner(uuid, text) from public, anon;
grant execute on function public.admin_list_owners(text) to authenticated;
grant execute on function public.admin_owner_stats() to authenticated;
grant execute on function public.admin_get_owner(uuid) to authenticated;
grant execute on function public.admin_approve_owner(uuid) to authenticated;
grant execute on function public.admin_decline_owner(uuid, text) to authenticated;

revoke all on function public.my_notifications(integer) from public, anon;
revoke all on function public.my_unread_notification_count() from public, anon;
revoke all on function public.mark_my_notifications_read(uuid[]) from public, anon;
grant execute on function public.my_notifications(integer) to authenticated;
grant execute on function public.my_unread_notification_count() to authenticated;
grant execute on function public.mark_my_notifications_read(uuid[]) to authenticated;

revoke all on function public.email_claim_deliveries(integer, integer) from public, anon, authenticated;
revoke all on function public.email_complete_delivery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.email_claim_deliveries(integer, integer) to service_role;
grant execute on function public.email_complete_delivery(uuid, text, text) to service_role;

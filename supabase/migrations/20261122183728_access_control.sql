-- Access control: per-café roles with permissions (the owner edits them) and shifts (time-based
-- access). One permission catalogue (keep in sync with src/lib/access/permissions.ts) is checked
-- by every café function through platform.cafe_for(slug, permission). The Owner role is locked
-- and can do everything; members on "shifts" have no access outside their shifts.

/* ── Catalogue ───────────────────────────────────────────────────────────── */

/** Every permission (section.action). "staff.manage" belongs to the locked Owner role only. */
create or replace function platform.permission_keys()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'dashboard.read',
    'orders.read', 'orders.handle', 'orders.settings',
    'menu.read', 'menu.availability', 'menu.edit',
    'tables.read', 'tables.edit', 'tables.qr',
    'website.read', 'website.edit', 'website.publish',
    'settings.cafe', 'settings.hours', 'settings.display', 'settings.languages',
    'staff.manage'
  ]
$$;

/** Adds the section's ".read" for every other action of a section that has one (edit ⇒ read). */
create or replace function platform.with_implied(p text[])
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct x order by x), '{}') from (
    select unnest(coalesce(p, '{}')) x
    union
    select split_part(k, '.', 1) || '.read'
      from unnest(coalesce(p, '{}')) k
     where split_part(k, '.', 1) || '.read' = any (platform.permission_keys())
  ) s
$$;

/* ── Roles ───────────────────────────────────────────────────────────────── */

create table public.cafe_roles (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes (id) on delete cascade,
  key         text check (key in ('owner', 'manager', 'waiter')),
  name        text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 200),
  permissions text[] not null default '{}' check (permissions <@ platform.permission_keys()),
  is_locked   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cafe_id, key),
  unique (cafe_id, id)
);
create unique index cafe_roles_name_idx on public.cafe_roles (cafe_id, lower(name));
alter table public.cafe_roles enable row level security;
revoke all on public.cafe_roles from anon, authenticated;

/* ── Shifts ──────────────────────────────────────────────────────────────── */

create table public.cafe_shifts (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  -- 0 = Monday … 6 = Sunday; a shift ending before it starts runs past midnight.
  days       int[] not null check (cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]),
  starts     time not null,
  ends       time not null check (ends <> starts),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cafe_id, id)
);
create unique index cafe_shifts_name_idx on public.cafe_shifts (cafe_id, lower(name));
alter table public.cafe_shifts enable row level security;
revoke all on public.cafe_shifts from anon, authenticated;

/* ── Members: role + access mode + shifts ───────────────────────────────── */

alter table public.cafe_members
  add column role_id uuid,
  add column access text not null default 'always' check (access in ('always', 'shifts')),
  add constraint cafe_members_role_fk foreign key (cafe_id, role_id)
    references public.cafe_roles (cafe_id, id) on delete restrict;

create table public.cafe_member_shifts (
  cafe_id  uuid not null,
  user_id  uuid not null,
  shift_id uuid not null,
  primary key (user_id, shift_id),
  foreign key (cafe_id, user_id) references public.cafe_members (cafe_id, user_id) on delete cascade,
  foreign key (cafe_id, shift_id) references public.cafe_shifts (cafe_id, id) on delete cascade
);
alter table public.cafe_member_shifts enable row level security;
revoke all on public.cafe_member_shifts from anon, authenticated;

/** Owner, Manager and Waiter of a café (idempotent). */
create or replace function platform.seed_cafe_roles(p_cafe uuid)
returns void language sql set search_path = '' as $$
  insert into public.cafe_roles (cafe_id, key, name, description, permissions, is_locked, sort_order)
  values
    (p_cafe, 'owner', 'Owner', '', platform.permission_keys(), true, 0),
    (p_cafe, 'manager', 'Manager', '',
     array['dashboard.read','orders.read','orders.handle','orders.settings','menu.read','menu.availability',
           'menu.edit','tables.read','tables.edit','tables.qr','website.read','website.edit',
           'website.publish','settings.hours','settings.display'], false, 1),
    (p_cafe, 'waiter', 'Waiter', '',
     array['dashboard.read','orders.read','orders.handle','menu.read','menu.availability','tables.read'],
     false, 2)
  on conflict (cafe_id, key) do nothing
$$;

create or replace function platform.seed_cafe_roles_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform platform.seed_cafe_roles(new.id);
  return new;
end $$;
create trigger cafes_seed_roles after insert on public.cafes
  for each row execute function platform.seed_cafe_roles_trigger();

/** A new owner membership gets the café's Owner role. */
create or replace function platform.member_default_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role_id is null and new.role = 'owner' then
    select id into new.role_id from public.cafe_roles where cafe_id = new.cafe_id and key = 'owner';
  end if;
  return new;
end $$;
create trigger cafe_members_default_role before insert on public.cafe_members
  for each row execute function platform.member_default_role();

select platform.seed_cafe_roles(id) from public.cafes;
update public.cafe_members m
   set role_id = r.id
  from public.cafe_roles r
 where r.cafe_id = m.cafe_id and r.key = 'owner' and m.role = 'owner' and m.role_id is null;

/* ── Checks ──────────────────────────────────────────────────────────────── */

/** Is the member inside one of their shifts now (café time; overnight shifts included)? */
create or replace function platform.on_shift(p_cafe uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  with x as (
    select (extract(isodow from t)::int - 1) as dow, t::time as tm
      from (select now() at time zone c.timezone as t from public.cafes c where c.id = p_cafe) n
  )
  select exists (
    select 1
      from public.cafe_member_shifts ms
      join public.cafe_shifts s on s.id = ms.shift_id
      cross join x
     where ms.cafe_id = p_cafe and ms.user_id = p_user
       and ((s.starts < s.ends and x.dow = any (s.days) and x.tm >= s.starts and x.tm < s.ends)
         or (s.starts > s.ends and x.dow = any (s.days) and x.tm >= s.starts)
         or (s.starts > s.ends and ((x.dow + 6) % 7) = any (s.days) and x.tm < s.ends)))
$$;

/** The member's next shift start: {name, inDays (0 = today), day (0 = Monday), starts "HH:MM"}. */
create or replace function platform.next_shift(p_cafe uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with x as (
    select (extract(isodow from t)::int - 1) as dow, t::time as tm
      from (select now() at time zone c.timezone as t from public.cafes c where c.id = p_cafe) n
  )
  select jsonb_build_object('name', s.name, 'inDays', d, 'day', (x.dow + d) % 7,
                            'starts', to_char(s.starts, 'HH24:MI'))
    from public.cafe_member_shifts ms
    join public.cafe_shifts s on s.id = ms.shift_id
    cross join x
    cross join generate_series(0, 7) d
   where ms.cafe_id = p_cafe and ms.user_id = p_user
     and ((x.dow + d) % 7) = any (s.days)
     and (d > 0 or s.starts > x.tm)
   order by d, s.starts
   limit 1
$$;

/**
 * May this user do `p_perm` (or one of "a|b") in this café now? Owner role: always. Others: the
 * role has it (a section's ".read" is granted by any action of that section) and the member is
 * "always" or inside a shift.
 */
create or replace function platform.can(p_cafe uuid, p_user uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.role = 'owner' or coalesce(r.is_locked, false) or (
      r.id is not null
      and (m.access = 'always' or platform.on_shift(p_cafe, p_user))
      and exists (
        select 1 from unnest(string_to_array(p_perm, '|')) want
         where want = any (r.permissions)
            or (want like '%.read' and exists (
                  select 1 from unnest(r.permissions) have
                   where split_part(have, '.', 1) = split_part(want, '.', 1)))))
      from public.cafe_members m
      left join public.cafe_roles r on r.id = m.role_id
     where m.cafe_id = p_cafe and m.user_id = p_user), false)
$$;

/** Signed-in user's café for `p_perm` (forbidden otherwise); p_lock locks the café row. */
create or replace function platform.cafe_for(p_slug text, p_perm text, p_lock boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_cafe uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select c.id into v_cafe
    from public.cafes c
    join public.cafe_members m on m.cafe_id = c.id and m.user_id = uid
   where c.slug = lower(btrim(coalesce(p_slug, '')));
  if v_cafe is null or not platform.can(v_cafe, uid, p_perm) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_lock then perform 1 from public.cafes where id = v_cafe for update; end if;
  return v_cafe;
end $$;

/** For RLS policies (runs as the signed-in user). */
create or replace function public.i_can(p_cafe uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and platform.can(p_cafe, auth.uid(), p_perm)
$$;

/* ── Signed-in member's access (feeds the app's CASL ability) ───────────── */

create or replace function public.get_my_access(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.cafe_members;
  r public.cafe_roles;
  v_cafe uuid;
  v_owner boolean;
  v_on boolean;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select c.id into v_cafe from public.cafes c where c.slug = lower(btrim(coalesce(p_slug, '')));
  select * into m from public.cafe_members where cafe_id = v_cafe and user_id = uid;
  if m.user_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.cafe_roles where id = m.role_id;
  v_owner := m.role = 'owner' or coalesce(r.is_locked, false);
  v_on := v_owner or m.access = 'always' or platform.on_shift(v_cafe, uid);
  return jsonb_build_object(
    'roleId', r.id, 'roleKey', r.key, 'roleName', r.name, 'isOwner', v_owner,
    'access', m.access, 'onShift', v_on,
    'nextShift', case when v_on then null else platform.next_shift(v_cafe, uid) end,
    'permissions', to_jsonb(case
      when v_owner then platform.permission_keys()
      when not v_on or r.id is null then '{}'::text[]
      else platform.with_implied(r.permissions) end));
end $$;

/* ── Owner: roles ────────────────────────────────────────────────────────── */

create or replace function public.get_my_roles(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'key', r.key, 'name', r.name, 'description', r.description,
             'permissions', to_jsonb(r.permissions), 'isLocked', r.is_locked, 'sortOrder', r.sort_order,
             'memberCount', (select count(*) from public.cafe_members m where m.role_id = r.id))
           order by r.sort_order, r.created_at)
      from public.cafe_roles r where r.cafe_id = v_cafe), '[]'::jsonb);
end $$;

/** Create (p_id null) or update a role. Owner role locked; "staff.manage" not grantable. */
create or replace function public.save_my_role(
  p_slug text, p_id uuid, p_name text, p_description text, p_permissions text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage', true);
  v_name text := btrim(coalesce(p_name, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_perms text[] := platform.with_implied(p_permissions);
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if char_length(v_desc) > 200 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'description';
  end if;
  if not (v_perms <@ platform.permission_keys()) or 'staff.manage' = any (v_perms) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'permissions';
  end if;
  if exists (select 1 from public.cafe_roles
              where cafe_id = v_cafe and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'name_taken' using errcode = 'P0001';
  end if;
  if p_id is null then
    if (select count(*) from public.cafe_roles where cafe_id = v_cafe) >= 20 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.cafe_roles (cafe_id, name, description, permissions, sort_order)
    values (v_cafe, v_name, v_desc, v_perms,
            coalesce((select max(sort_order) + 1 from public.cafe_roles where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    if (select is_locked from public.cafe_roles where id = p_id and cafe_id = v_cafe) then
      raise exception 'invalid_state' using errcode = 'P0001';
    end if;
    update public.cafe_roles
       set name = v_name, description = v_desc, permissions = v_perms, updated_at = now()
     where id = p_id and cafe_id = v_cafe returning id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.delete_my_role(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage', true); r public.cafe_roles;
begin
  select * into r from public.cafe_roles where id = p_id and cafe_id = v_cafe;
  if r.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.is_locked then raise exception 'invalid_state' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cafe_members where role_id = p_id) then
    raise exception 'in_use' using errcode = 'P0001';
  end if;
  delete from public.cafe_roles where id = p_id;
end $$;

create or replace function public.reorder_my_roles(p_slug text, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage', true);
begin
  if p_ids is null or cardinality(p_ids) <> (select count(*) from public.cafe_roles where cafe_id = v_cafe)
     or exists (select 1 from unnest(p_ids) x where not exists (
                  select 1 from public.cafe_roles where id = x and cafe_id = v_cafe))
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update public.cafe_roles r set sort_order = o.ord - 1, updated_at = now()
    from unnest(p_ids) with ordinality o(id, ord) where r.id = o.id;
end $$;

/* ── Owner: shifts ───────────────────────────────────────────────────────── */

create or replace function public.get_my_shifts(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'days', to_jsonb(s.days),
             'starts', to_char(s.starts, 'HH24:MI'), 'ends', to_char(s.ends, 'HH24:MI'),
             'sortOrder', s.sort_order,
             'memberCount', (select count(*) from public.cafe_member_shifts ms where ms.shift_id = s.id))
           order by s.sort_order, s.created_at)
      from public.cafe_shifts s where s.cafe_id = v_cafe), '[]'::jsonb);
end $$;

create or replace function public.save_my_shift(
  p_slug text, p_id uuid, p_name text, p_days int[], p_starts text, p_ends text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage', true);
  v_name text := btrim(coalesce(p_name, ''));
  v_days int[] := (select array_agg(distinct d order by d) from unnest(coalesce(p_days, '{}')) d);
  v_starts time;
  v_ends time;
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if v_days is null or not (v_days <@ array[0,1,2,3,4,5,6]) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'days';
  end if;
  if coalesce(p_starts, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(p_ends, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_starts = p_ends then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'hours';
  end if;
  v_starts := p_starts::time;
  v_ends := p_ends::time;
  if exists (select 1 from public.cafe_shifts
              where cafe_id = v_cafe and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'name_taken' using errcode = 'P0001';
  end if;
  if p_id is null then
    if (select count(*) from public.cafe_shifts where cafe_id = v_cafe) >= 30 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.cafe_shifts (cafe_id, name, days, starts, ends, sort_order)
    values (v_cafe, v_name, v_days, v_starts, v_ends,
            coalesce((select max(sort_order) + 1 from public.cafe_shifts where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    update public.cafe_shifts
       set name = v_name, days = v_days, starts = v_starts, ends = v_ends, updated_at = now()
     where id = p_id and cafe_id = v_cafe returning id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.delete_my_shift(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage', true);
begin
  delete from public.cafe_shifts where id = p_id and cafe_id = v_cafe;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.reorder_my_shifts(p_slug text, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.cafe_for(p_slug, 'staff.manage', true);
begin
  if p_ids is null or cardinality(p_ids) <> (select count(*) from public.cafe_shifts where cafe_id = v_cafe)
     or exists (select 1 from unnest(p_ids) x where not exists (
                  select 1 from public.cafe_shifts where id = x and cafe_id = v_cafe))
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update public.cafe_shifts s set sort_order = o.ord - 1, updated_at = now()
    from unnest(p_ids) with ordinality o(id, ord) where s.id = o.id;
end $$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.permission_keys() from public;
revoke all on function platform.with_implied(text[]) from public;
revoke all on function platform.seed_cafe_roles(uuid) from public;
revoke all on function platform.seed_cafe_roles_trigger() from public;
revoke all on function platform.member_default_role() from public;
revoke all on function platform.on_shift(uuid, uuid) from public;
revoke all on function platform.next_shift(uuid, uuid) from public;
revoke all on function platform.can(uuid, uuid, text) from public;
revoke all on function platform.cafe_for(text, text, boolean) from public;
revoke all on function public.i_can(uuid, text) from public;
revoke all on function public.get_my_access(text) from public;
revoke all on function public.get_my_roles(text) from public;
revoke all on function public.save_my_role(text, uuid, text, text, text[]) from public;
revoke all on function public.delete_my_role(text, uuid) from public;
revoke all on function public.reorder_my_roles(text, uuid[]) from public;
revoke all on function public.get_my_shifts(text) from public;
revoke all on function public.save_my_shift(text, uuid, text, int[], text, text) from public;
revoke all on function public.delete_my_shift(text, uuid) from public;
revoke all on function public.reorder_my_shifts(text, uuid[]) from public;

-- Table checks (permissions ⊆ catalogue) run as whoever writes the row.
grant execute on function platform.permission_keys() to authenticated, service_role;
grant execute on function public.i_can(uuid, text) to authenticated;
grant execute on function public.get_my_access(text) to authenticated;
grant execute on function public.get_my_roles(text) to authenticated;
grant execute on function public.save_my_role(text, uuid, text, text, text[]) to authenticated;
grant execute on function public.delete_my_role(text, uuid) to authenticated;
grant execute on function public.reorder_my_roles(text, uuid[]) to authenticated;
grant execute on function public.get_my_shifts(text) to authenticated;
grant execute on function public.save_my_shift(text, uuid, text, int[], text, text) to authenticated;
grant execute on function public.delete_my_shift(text, uuid) to authenticated;
grant execute on function public.reorder_my_shifts(text, uuid[]) to authenticated;

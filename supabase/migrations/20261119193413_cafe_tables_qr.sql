-- Tables & QR codes.
--   AREAS (Inside, Terrace, …: one floor plan each) hold TABLES.
--   QR CODES are short codes printed as <root>/q/<code>:
--     · a TABLE code   → <slug>.<root>/menu?table=<code>   (the menu knows the table: "Table 7")
--     · the MENU code  → <slug>.<root>/menu                (café-wide: counter, window, flyers)
--   The QR never contains the café address, so printed codes survive address changes.
--   A new code RETIRES the old one: a retired code still opens the café's menu, without the table
--   (an old sticker never shows an error, it just no longer identifies the table).
-- Positions are metres from the area's top-left corner; rotation in degrees.
-- RPC-only (RLS on, no policies, no grants), like cafe_websites.

/* ── Tables ──────────────────────────────────────────────────────────────── */

create table public.cafe_areas (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  sort_order int  not null default 0,
  width_m    numeric(4,1) not null default 12 check (width_m between 3 and 60),
  depth_m    numeric(4,1) not null default 8  check (depth_m between 3 and 60),
  created_at timestamptz not null default now(),
  unique (cafe_id, id),
  unique (cafe_id, name)
);

create table public.cafe_tables (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  area_id    uuid not null,
  label      text not null check (char_length(label) between 1 and 20),
  seats      int  not null default 2 check (seats between 1 and 20),
  shape      text not null default 'square' check (shape in ('round', 'square', 'rect', 'bar')),
  x          numeric(5,2) not null default 1 check (x >= 0),
  y          numeric(5,2) not null default 1 check (y >= 0),
  rotation   int  not null default 0 check (rotation between 0 and 359),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cafe_id, id),
  unique (cafe_id, label),
  -- A table always belongs to an area of the SAME café.
  foreign key (cafe_id, area_id) references public.cafe_areas (cafe_id, id) on delete restrict
);
create index cafe_tables_area_idx on public.cafe_tables (area_id);

/** Printed QR short codes. table_id null = the café's menu code. */
create table public.qr_codes (
  code       text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  table_id   uuid,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  foreign key (cafe_id, table_id) references public.cafe_tables (cafe_id, id) on delete cascade
);
-- One live code per table, one live menu code per café.
create unique index qr_codes_live_table_idx on public.qr_codes (table_id) where retired_at is null and table_id is not null;
create unique index qr_codes_live_menu_idx  on public.qr_codes (cafe_id)  where retired_at is null and table_id is null;
create index qr_codes_cafe_idx on public.qr_codes (cafe_id);

/** Scans per QR code per day (counts only — no visitor data). */
create table public.qr_scans (
  code    text not null references public.qr_codes (code) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  day     date not null,
  scans   int  not null default 0,
  primary key (code, day)
);
create index qr_scans_cafe_day_idx on public.qr_scans (cafe_id, day);

alter table public.cafe_areas  enable row level security;
alter table public.cafe_tables enable row level security;
alter table public.qr_codes    enable row level security;
alter table public.qr_scans    enable row level security;
revoke all on table public.cafe_areas, public.cafe_tables, public.qr_codes, public.qr_scans
  from anon, authenticated;

comment on table public.cafe_areas  is 'Café areas (floor plans). RPC-only.';
comment on table public.cafe_tables is 'Café tables (floor positions). RPC-only.';
comment on table public.qr_codes    is 'Printed QR short codes: one live per table + one live café menu code; retired codes open the menu without a table. RPC-only; resolve_qr (anon).';
comment on table public.qr_scans    is 'QR scans per code per day (aggregated counts, no personal data).';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Random 6-char code without look-alike characters (no 0/O/1/I/L): 31^6 ≈ 887 M codes. */
create or replace function platform.new_qr_code(p_cafe uuid, p_table uuid)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea;
  v text;
begin
  loop
    b := extensions.gen_random_bytes(6);
    v := '';
    for i in 0..5 loop
      v := v || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.qr_codes q where q.code = v);
  end loop;
  -- Retire the current live code of this table / of the café menu.
  update public.qr_codes set retired_at = now()
   where cafe_id = p_cafe and retired_at is null
     and table_id is not distinct from p_table;
  insert into public.qr_codes (code, cafe_id, table_id) values (v, p_cafe, p_table);
  return v;
end $$;

/** Scans of a café's codes in the last 30 days, keyed by table id ('menu' for the menu code). */
create or replace function platform.scans_30d(p_cafe uuid)
returns table (key text, scans bigint) language sql stable set search_path = '' as $$
  select coalesce(q.table_id::text, 'menu'), sum(s.scans)
    from public.qr_scans s join public.qr_codes q on q.code = s.code
   where s.cafe_id = p_cafe and s.day > current_date - 30
   group by 1
$$;

/* ── Owner: read ─────────────────────────────────────────────────────────── */

/**
 * Areas, tables (with their live QR code) and the café menu code of my café, plus QR scans of
 * the last 30 days. Creates the menu code on first use.
 */
create or replace function public.get_my_floor(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_menu text;
begin
  select code into v_menu from public.qr_codes
   where cafe_id = v_cafe and table_id is null and retired_at is null;
  if v_menu is null then v_menu := platform.new_qr_code(v_cafe, null); end if;

  return jsonb_build_object(
    'menu', jsonb_build_object(
      'code', v_menu,
      'scans30d', coalesce((select scans from platform.scans_30d(v_cafe) where key = 'menu'), 0)),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'sortOrder', a.sort_order,
               'widthM', a.width_m, 'depthM', a.depth_m) order by a.sort_order, a.created_at)
        from public.cafe_areas a where a.cafe_id = v_cafe), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'areaId', t.area_id, 'label', t.label, 'seats', t.seats,
               'shape', t.shape, 'x', t.x, 'y', t.y, 'rotation', t.rotation,
               'isActive', t.is_active, 'code', q.code,
               'scans30d', coalesce(s.scans, 0))
               order by t.label)
        from public.cafe_tables t
        left join public.qr_codes q on q.table_id = t.id and q.retired_at is null
        left join platform.scans_30d(v_cafe) s on s.key = t.id::text
       where t.cafe_id = v_cafe), '[]'::jsonb)
  );
end $$;

/* ── Owner: areas ────────────────────────────────────────────────────────── */

/** Create (p_id null) or update an area. Raises invalid_input (DETAIL = field) / conflict (name). */
create or replace function public.save_my_area(
  p_slug text, p_id uuid, p_name text, p_width_m numeric, p_depth_m numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if p_width_m is null or p_width_m not between 3 and 60 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'width_m';
  end if;
  if p_depth_m is null or p_depth_m not between 3 and 60 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'depth_m';
  end if;

  if p_id is null then
    if (select count(*) from public.cafe_areas where cafe_id = v_cafe) >= 20 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.cafe_areas (cafe_id, name, width_m, depth_m, sort_order)
    values (v_cafe, v_name, p_width_m, p_depth_m,
            coalesce((select max(sort_order) + 1 from public.cafe_areas where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    update public.cafe_areas set name = v_name, width_m = p_width_m, depth_m = p_depth_m
     where id = p_id and cafe_id = v_cafe returning id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
    -- Keep tables inside a smaller floor.
    update public.cafe_tables
       set x = least(x, p_width_m), y = least(y, p_depth_m), updated_at = now()
     where area_id = v_id and (x > p_width_m or y > p_depth_m);
  end if;
  return v_id;
end $$;

/** Deletes an EMPTY area (raises in_use while it still has tables — their QR codes are printed). */
create or replace function public.delete_my_area(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if exists (select 1 from public.cafe_tables where area_id = p_id and cafe_id = v_cafe) then
    raise exception 'in_use' using errcode = 'P0001';
  end if;
  delete from public.cafe_areas where id = p_id and cafe_id = v_cafe;
end $$;

/** New order of all areas of my café (raises stale_list when the list does not match). */
create or replace function public.reorder_my_areas(p_slug text, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if (select array_agg(id order by id) from public.cafe_areas where cafe_id = v_cafe)
     is distinct from (select array_agg(i order by i) from unnest(p_ids) i) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update public.cafe_areas a set sort_order = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where a.id = o.id and a.cafe_id = v_cafe;
end $$;

/* ── Owner: tables ───────────────────────────────────────────────────────── */

/**
 * Create (p_id null: gets a QR code, placed at the area's next free spot) or update a table's
 * details. Positions go through save_my_layout. Raises invalid_input (DETAIL = field),
 * conflict (label already used).
 */
create or replace function public.save_my_table(
  p_slug text, p_id uuid, p_area_id uuid, p_label text, p_seats int, p_shape text, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_label text := btrim(coalesce(p_label, ''));
  v_area public.cafe_areas;
  v_id uuid;
  v_n int;
  v_cols int;
begin
  select * into v_area from public.cafe_areas where id = p_area_id and cafe_id = v_cafe;
  if v_area.id is null then raise exception 'invalid_input' using errcode = 'P0001', detail = 'area_id'; end if;
  if char_length(v_label) not between 1 and 20 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'label';
  end if;
  if p_seats is null or p_seats not between 1 and 20 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'seats';
  end if;
  if p_shape is null or p_shape not in ('round', 'square', 'rect', 'bar') then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'shape';
  end if;

  if p_id is null then
    if (select count(*) from public.cafe_tables where cafe_id = v_cafe) >= 200 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    -- Next free spot on a 2 m grid so new tables don't stack on each other.
    select count(*) into v_n from public.cafe_tables where area_id = v_area.id;
    v_cols := greatest(floor((v_area.width_m - 1) / 2)::int, 1);
    insert into public.cafe_tables (cafe_id, area_id, label, seats, shape, is_active, x, y)
    values (v_cafe, v_area.id, v_label, p_seats, p_shape, coalesce(p_is_active, true),
            least(1 + (v_n % v_cols) * 2, v_area.width_m - 1),
            least(1 + (v_n / v_cols) * 2, v_area.depth_m - 1))
    returning id into v_id;
    perform platform.new_qr_code(v_cafe, v_id);
  else
    update public.cafe_tables t
       set area_id = v_area.id, label = v_label, seats = p_seats, shape = p_shape,
           is_active = coalesce(p_is_active, t.is_active),
           x = case when t.area_id = v_area.id then t.x else 1 end,
           y = case when t.area_id = v_area.id then t.y else 1 end,
           updated_at = now()
     where t.id = p_id and t.cafe_id = v_cafe returning t.id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

/**
 * Saves positions from the floor editor: [{id, x, y, rotation}, …]. Every id must be a table of
 * my café; positions are clamped to the table's area. Raises invalid_input (DETAIL = 'layout').
 */
create or replace function public.save_my_layout(p_slug text, p_layout jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_bad int;
begin
  if jsonb_typeof(p_layout) is distinct from 'array' or jsonb_array_length(p_layout) > 200 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'layout';
  end if;
  select count(*) into v_bad
    from jsonb_array_elements(p_layout) e
    left join public.cafe_tables t
           on t.cafe_id = v_cafe
          and (e ->> 'id') ~ '^[0-9a-f-]{36}$' and t.id = (e ->> 'id')::uuid
   where t.id is null
      or jsonb_typeof(e -> 'x') is distinct from 'number'
      or jsonb_typeof(e -> 'y') is distinct from 'number'
      or jsonb_typeof(e -> 'rotation') is distinct from 'number';
  if v_bad > 0 then raise exception 'invalid_input' using errcode = 'P0001', detail = 'layout'; end if;

  update public.cafe_tables t
     set x = round(least(greatest((e ->> 'x')::numeric, 0), a.width_m), 2),
         y = round(least(greatest((e ->> 'y')::numeric, 0), a.depth_m), 2),
         rotation = ((round((e ->> 'rotation')::numeric)::int % 360) + 360) % 360,
         updated_at = now()
    from jsonb_array_elements(p_layout) e, public.cafe_areas a
   where t.id = (e ->> 'id')::uuid and t.cafe_id = v_cafe and a.id = t.area_id;
end $$;

/** Deletes a table; its QR codes go with it (scanning them then shows "unknown code"). */
create or replace function public.delete_my_table(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  delete from public.cafe_tables where id = p_id and cafe_id = v_cafe;
end $$;

/**
 * New QR code for a table (p_table_id) or for the café menu (p_table_id null). The old code is
 * retired: it still opens the café's menu, but no longer identifies the table.
 */
create or replace function public.regenerate_my_qr_code(p_slug text, p_table_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if p_table_id is not null
     and not exists (select 1 from public.cafe_tables where id = p_table_id and cafe_id = v_cafe) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return platform.new_qr_code(v_cafe, p_table_id);
end $$;

/* ── Public: QR scan ─────────────────────────────────────────────────────── */

/**
 * Printed QR → where to go (anyone). Counts the scan for live codes of active cafés.
 * table_code/table_label are set only for a LIVE code of an ACTIVE table; otherwise the visitor
 * lands on the café menu without a table. No row = unknown code.
 */
create or replace function public.resolve_qr(p_code text)
returns table (cafe_slug text, table_code text, table_label text)
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  r record;
begin
  if v_code !~ '^[A-HJKMNP-Z2-9]{6}$' then return; end if;
  select q.code, q.cafe_id, q.retired_at, c.slug, c.status, t.label, t.is_active, q.table_id
    into r
    from public.qr_codes q
    join public.cafes c on c.id = q.cafe_id
    left join public.cafe_tables t on t.id = q.table_id
   where q.code = v_code and c.status in ('active', 'suspended');
  if r.code is null then return; end if;

  if r.status = 'active' and r.retired_at is null then
    insert into public.qr_scans as s (code, cafe_id, day, scans)
    values (r.code, r.cafe_id, current_date, 1)
    on conflict (code, day) do update set scans = s.scans + 1;
  end if;

  if r.table_id is not null and r.retired_at is null and r.is_active and r.status = 'active' then
    return query select r.slug, r.code, r.label;
  else
    return query select r.slug, null::text, null::text;
  end if;
end $$;

/** Table of a live table code, for the menu banner ("Table 7"). Public, no counting. */
create or replace function public.get_public_table(p_slug text, p_code text)
returns table (label text)
language sql stable security definer set search_path = '' as $$
  select t.label
    from public.qr_codes q
    join public.cafe_tables t on t.id = q.table_id
    join public.cafes c on c.id = q.cafe_id
   where c.slug = lower(btrim(coalesce(p_slug, '')))
     and q.code = upper(btrim(coalesce(p_code, '')))
     and q.retired_at is null and t.is_active and c.status = 'active';
$$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.new_qr_code(uuid, uuid) from public;
revoke all on function platform.scans_30d(uuid) from public;
revoke all on function public.get_my_floor(text) from public;
revoke all on function public.save_my_area(text, uuid, text, numeric, numeric) from public;
revoke all on function public.delete_my_area(text, uuid) from public;
revoke all on function public.reorder_my_areas(text, uuid[]) from public;
revoke all on function public.save_my_table(text, uuid, uuid, text, int, text, boolean) from public;
revoke all on function public.save_my_layout(text, jsonb) from public;
revoke all on function public.delete_my_table(text, uuid) from public;
revoke all on function public.regenerate_my_qr_code(text, uuid) from public;
revoke all on function public.resolve_qr(text) from public;
revoke all on function public.get_public_table(text, text) from public;

grant execute on function public.get_my_floor(text) to authenticated;
grant execute on function public.save_my_area(text, uuid, text, numeric, numeric) to authenticated;
grant execute on function public.delete_my_area(text, uuid) to authenticated;
grant execute on function public.reorder_my_areas(text, uuid[]) to authenticated;
grant execute on function public.save_my_table(text, uuid, uuid, text, int, text, boolean) to authenticated;
grant execute on function public.save_my_layout(text, jsonb) to authenticated;
grant execute on function public.delete_my_table(text, uuid) to authenticated;
grant execute on function public.regenerate_my_qr_code(text, uuid) to authenticated;
grant execute on function public.resolve_qr(text) to anon, authenticated;
grant execute on function public.get_public_table(text, text) to anon, authenticated;

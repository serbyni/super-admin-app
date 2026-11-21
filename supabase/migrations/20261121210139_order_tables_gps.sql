-- Orders: change table (customer before/after sending, staff on the board) + GPS check for table
-- orders (the phone must be within the café's radius). The customer's position is only compared,
-- never stored.

/* ── Café position (required) + radius ───────────────────────────────────── */

do $$
begin
  if exists (select 1 from public.cafes where latitude is null or longitude is null) then
    raise exception 'A café has no saved position: fix it before making latitude/longitude required';
  end if;
end $$;
alter table public.cafes
  alter column latitude set not null,
  alter column longitude set not null,
  add column order_radius_m int not null default 100 check (order_radius_m between 50 and 500);

alter table public.orders
  add column moved_from_label text,
  add column moved_at timestamptz,
  add column push_moved_sent_at timestamptz;

/** Distance in metres between two points (haversine, Earth radius 6 371 km). */
create or replace function platform.distance_m(lat1 double precision, lng1 double precision,
                                               lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

/**
 * Switch for the GPS rule: false while the old café site (which sends no position) may still be
 * live; a follow-up migration turns it on once the new café site is deployed. A position that is
 * sent is always checked.
 */
create or replace function platform.gps_required()
returns boolean language sql stable set search_path = '' as $$ select false $$;

/**
 * The phone must be within the café's radius. GPS accuracy is forgiven up to 100 m only.
 * Errors: location_required | too_far (detail = {"distance": m, "radius": m}).
 */
create or replace function platform.check_near(c public.cafes, p_lat double precision,
                                               p_lng double precision, p_accuracy double precision)
returns void language plpgsql stable set search_path = '' as $$
declare v_d double precision;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    if p_lat is null and p_lng is null and not platform.gps_required() then return; end if;
    raise exception 'location_required' using errcode = 'P0001';
  end if;
  v_d := platform.distance_m(c.latitude, c.longitude, p_lat, p_lng);
  if v_d - least(greatest(coalesce(p_accuracy, 0), 0), 100) > c.order_radius_m then
    raise exception 'too_far' using errcode = 'P0001',
      detail = jsonb_build_object('distance', round(v_d)::int, 'radius', c.order_radius_m)::text;
  end if;
end $$;

/** A table has an open order (new → ready). */
create or replace function platform.table_busy(p_table uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.orders
                  where table_id = p_table and status in ('new','accepted','preparing','ready'))
$$;

/* ── Public: tables a customer can pick ─────────────────────────────────── */

/** Active tables of an active café (labels only, never QR codes), with whether they are free. */
create or replace function public.get_public_tables(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'label', t.label, 'seats', t.seats, 'area', a.name,
           'free', not platform.table_busy(t.id))
         order by a.sort_order, a.name, t.label), '[]'::jsonb)
    from public.cafes c
    join public.cafe_tables t on t.cafe_id = c.id and t.is_active
    join public.cafe_areas a on a.id = t.area_id
   where c.slug = lower(btrim(coalesce(p_slug, ''))) and c.status = 'active'
$$;

/* ── place_order: table from the QR code or from the list, GPS for table orders ── */

drop function public.place_order(text, text, text, jsonb, text, text, text);
create function public.place_order(
  p_slug text, p_table_code text, p_customer_name text, p_items jsonb, p_note text, p_locale text,
  p_customer_email text default null, p_table_id uuid default null,
  p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.cafes;
  v_open jsonb;
  v_table_id uuid;
  v_table_label text;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_note text := btrim(coalesce(p_note, ''));
  v_email text := nullif(lower(btrim(coalesce(p_customer_email, ''))), '');
  v_locale text := coalesce(nullif(p_locale, ''), 'en');
  v_order public.orders;
  v_line jsonb;
  v_item public.menu_items;
  v_qty int;
  v_choices text[];
  v_opts jsonb;
  v_unit numeric;
  v_sub numeric := 0;
  v_pos int := 0;
  g jsonb;
  ch jsonb;
  v_picked int;
  v_today date;
begin
  select * into c from public.cafes where slug = lower(btrim(coalesce(p_slug, ''))) and status = 'active'
     for update;
  if c.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_open := platform.cafe_open_now(c.id);
  if not c.accepting_orders or not (v_open ->> 'openNow')::boolean then
    raise exception 'ordering_closed' using errcode = 'P0001';
  end if;
  if not (v_locale = any (platform.content_languages())) then v_locale := c.default_locale; end if;
  if char_length(v_note) > 300 then raise exception 'invalid_input' using errcode = 'P0001', detail = 'note'; end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'customer_email';
  end if;

  if p_table_id is not null then
    -- Picked from the list of tables.
    select t.id, t.label into v_table_id, v_table_label
      from public.cafe_tables t where t.id = p_table_id and t.cafe_id = c.id and t.is_active;
    if v_table_id is null then raise exception 'invalid_input' using errcode = 'P0001', detail = 'table'; end if;
  elsif coalesce(btrim(p_table_code), '') <> '' then
    select t.id, t.label into v_table_id, v_table_label
      from public.qr_codes q join public.cafe_tables t on t.id = q.table_id
     where q.code = upper(btrim(p_table_code)) and q.cafe_id = c.id and q.retired_at is null and t.is_active;
    if v_table_id is null then raise exception 'invalid_input' using errcode = 'P0001', detail = 'table'; end if;
  elsif char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'customer_name';
  end if;
  if v_table_id is not null then
    if (select count(*) from public.orders
         where table_id = v_table_id and status in ('new','accepted','preparing','ready')) >= 3 then
      raise exception 'too_many_orders' using errcode = 'P0001', detail = 'table';
    end if;
    perform platform.check_near(c, p_lat, p_lng, p_accuracy);
  end if;
  if (select count(*) from public.orders where cafe_id = c.id and created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'too_many_orders' using errcode = 'P0001', detail = 'cafe';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'items';
  end if;

  v_today := (now() at time zone c.timezone)::date;
  insert into public.orders (cafe_id, number, kind, table_id, table_label, customer_name, note, locale,
                             subtotal, currency, customer_email)
  values (c.id,
          coalesce((select max(number) from public.orders
                     where cafe_id = c.id and (created_at at time zone c.timezone)::date = v_today), 0) + 1,
          case when v_table_id is null then 'takeaway' else 'table' end,
          v_table_id, v_table_label, case when v_table_id is null then v_name else '' end,
          v_note, v_locale, 0, c.currency, v_email)
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    begin
      v_qty := (v_line ->> 'quantity')::int;
    exception when others then v_qty := 0;
    end;
    if v_qty is null or v_qty not between 1 and 20
       or char_length(coalesce(v_line ->> 'note', '')) > 140
       or (v_line ? 'choices' and jsonb_typeof(v_line -> 'choices') <> 'array') then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'items';
    end if;
    select i.* into v_item
      from public.menu_items i join public.menu_categories mc on mc.id = i.category_id
     where i.id::text = (v_line ->> 'itemId') and i.cafe_id = c.id
       and i.is_visible and mc.is_visible and i.price is not null;
    if v_item.id is null or not v_item.is_available then
      raise exception 'item_unavailable' using errcode = 'P0001', detail = coalesce(v_line ->> 'itemId', '');
    end if;
    v_choices := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_line -> 'choices', '[]')) x), '{}');
    v_unit := v_item.price;
    v_opts := '[]';
    for g in select * from jsonb_array_elements(v_item.options) loop
      v_picked := 0;
      for ch in select * from jsonb_array_elements(g -> 'choices') loop
        if (ch ->> 'id') = any (v_choices) then
          if not (ch ->> 'isAvailable')::boolean then
            raise exception 'item_unavailable' using errcode = 'P0001', detail = v_item.id::text;
          end if;
          v_picked := v_picked + 1;
          v_unit := v_unit + (ch ->> 'price')::numeric;
          v_opts := v_opts || jsonb_build_object('group', g ->> 'name', 'choice', ch ->> 'name',
                                                 'price', (ch ->> 'price')::numeric);
        end if;
      end loop;
      if v_picked < (g ->> 'min')::int or v_picked > (g ->> 'max')::int then
        raise exception 'invalid_input' using errcode = 'P0001', detail = 'options';
      end if;
    end loop;
    if cardinality(v_choices) <> jsonb_array_length(v_opts) then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'options';
    end if;
    insert into public.order_items (order_id, item_id, name, unit_price, options, quantity, note, line_total, position)
    values (v_order.id, v_item.id, v_item.name, v_unit, v_opts, v_qty,
            btrim(coalesce(v_line ->> 'note', '')), v_unit * v_qty, v_pos);
    v_sub := v_sub + v_unit * v_qty;
  end loop;

  update public.orders set subtotal = v_sub where id = v_order.id;
  return jsonb_build_object('token', v_order.token, 'number', v_order.number);
end $$;

/* ── Moving an order to another table ───────────────────────────────────── */

/** Shared by both moves: sets the new table and remembers the previous one. */
create or replace function platform.move_order(o public.orders, t public.cafe_tables)
returns void language sql set search_path = '' as $$
  update public.orders
     set table_id = t.id, table_label = t.label, moved_from_label = o.table_label,
         moved_at = now(), updated_at = now()
   where id = o.id
$$;

/**
 * Customer (anon, the order token is the proof): a table order still open (new → ready) moves to
 * another active, free table of the café; the phone must be near the café.
 * Errors: forbidden | invalid_status | invalid_input (table) | table_taken | location_required | too_far.
 */
create or replace function public.move_order_table(p_slug text, p_token text, p_table_id uuid,
  p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.cafes; o public.orders; t public.cafe_tables;
begin
  select * into c from public.cafes where slug = lower(btrim(coalesce(p_slug, ''))) and status = 'active';
  select * into o from public.orders where token = p_token and cafe_id = c.id for update;
  if c.id is null or o.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.kind <> 'table' or o.status not in ('new','accepted','preparing','ready') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into t from public.cafe_tables where id = p_table_id and cafe_id = c.id and is_active for update;
  if t.id is null or t.id = o.table_id then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'table';
  end if;
  if platform.table_busy(t.id) then raise exception 'table_taken' using errcode = 'P0001'; end if;
  perform platform.check_near(c, p_lat, p_lng, p_accuracy);
  perform platform.move_order(o, t);
  return jsonb_build_object('tableLabel', t.label, 'movedFromLabel', o.table_label);
end $$;

/** Staff (board): any active table of the café, no GPS, busy tables allowed. Returns the order id. */
create or replace function public.move_my_order_table(p_slug text, p_id uuid, p_table_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.member_cafe(p_slug); o public.orders; t public.cafe_tables;
begin
  select * into o from public.orders where id = p_id and cafe_id = v_cafe for update;
  if o.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.kind <> 'table' or o.status not in ('new','accepted','preparing','ready') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into t from public.cafe_tables where id = p_table_id and cafe_id = v_cafe and is_active;
  if t.id is null or t.id = o.table_id then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'table';
  end if;
  perform platform.move_order(o, t);
end $$;

/** Owner: how far from the café a table order may be placed (50–500 m). */
create or replace function public.set_my_order_radius(p_slug text, p_metres int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if p_metres is null or p_metres not between 50 and 500 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'radius';
  end if;
  update public.cafes set order_radius_m = p_metres, updated_at = now() where id = v_cafe;
end $$;

/** Staff push after a customer moved: once per move, within 5 minutes. */
create or replace function public.push_table_moved_targets(p_slug text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.cafes;
begin
  select ord.* into o from public.orders ord join public.cafes cf on cf.id = ord.cafe_id
   where ord.token = p_token and cf.slug = lower(btrim(coalesce(p_slug, '')))
     and ord.moved_at > now() - interval '5 minutes'
     and (ord.push_moved_sent_at is null or ord.push_moved_sent_at < ord.moved_at)
   for update of ord;
  if o.id is null then return null; end if;
  update public.orders set push_moved_sent_at = now() where id = o.id;
  select * into c from public.cafes where id = o.cafe_id;
  return jsonb_build_object(
    'order', jsonb_build_object('number', o.number, 'tableLabel', o.table_label,
                                'movedFromLabel', o.moved_from_label),
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh,
                                                                   'auth', s.auth, 'locale', s.locale))
                                 from platform.push_subscriptions s where s.cafe_id = o.cafe_id and s.kind = 'owner'),
                              '[]'::jsonb));
end $$;

/* ── Read models: previous table on orders, radius on the board ────────── */

create or replace function platform.order_json(o public.orders, p_private boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', case when p_private then o.id end,
    'number', o.number, 'kind', o.kind, 'tableLabel', o.table_label,
    'movedFromLabel', o.moved_from_label,
    'customerName', o.customer_name, 'note', o.note, 'status', o.status,
    'declineReason', o.decline_reason, 'subtotal', o.subtotal, 'currency', o.currency,
    'isPaid', o.is_paid, 'locale', o.locale,
    'createdAt', o.created_at, 'acceptedAt', o.accepted_at, 'readyAt', o.ready_at,
    'servedAt', o.served_at, 'closedAt', o.closed_at,
    'customerEmail', case when p_private then o.customer_email end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'itemId', li.item_id, 'name', li.name, 'unitPrice', li.unit_price,
               'options', li.options, 'quantity', li.quantity, 'note', li.note,
               'lineTotal', li.line_total) order by li.position)
        from public.order_items li where li.order_id = o.id), '[]'::jsonb))
$$;

create or replace function public.get_my_orders(p_slug text, p_scope text, p_day date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  v_tz text;
  v_accepting boolean;
  v_radius int;
begin
  select timezone, accepting_orders, order_radius_m into v_tz, v_accepting, v_radius
    from public.cafes where id = v_cafe;
  return jsonb_build_object(
    'acceptingOrders', v_accepting,
    'orderRadiusM', v_radius,
    'ordering', platform.cafe_open_now(v_cafe),
    'today', (now() at time zone v_tz)::date,
    'orders', coalesce((
      select jsonb_agg(platform.order_json(o, true) order by o.created_at desc)
        from public.orders o
       where o.cafe_id = v_cafe
         and case when p_scope = 'active'
                  then o.status in ('new','accepted','preparing','ready')
                  else (o.created_at at time zone v_tz)::date = coalesce(p_day, (now() at time zone v_tz)::date)
             end), '[]'::jsonb));
end $$;

/** Status change and table moves by staff: the customer's phones. */
create or replace function public.push_order_update_targets(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order', jsonb_build_object('number', o.number, 'status', o.status, 'reason', o.decline_reason,
                                'kind', o.kind, 'tableLabel', o.table_label, 'customerName', o.customer_name,
                                'movedFromLabel', o.moved_from_label, 'token', o.token),
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh,
                                                                   'auth', s.auth, 'locale', s.locale))
                                 from platform.push_subscriptions s where s.order_id = o.id), '[]'::jsonb))
    from public.orders o join public.cafes c on c.id = o.cafe_id
   where o.id = p_order_id;
$$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.distance_m(double precision, double precision, double precision, double precision) from public;
revoke all on function platform.gps_required() from public;
revoke all on function platform.check_near(public.cafes, double precision, double precision, double precision) from public;
revoke all on function platform.table_busy(uuid) from public;
revoke all on function platform.move_order(public.orders, public.cafe_tables) from public;
revoke all on function public.get_public_tables(text) from public;
revoke all on function public.place_order(text, text, text, jsonb, text, text, text, uuid, double precision, double precision, double precision) from public;
revoke all on function public.move_order_table(text, text, uuid, double precision, double precision, double precision) from public;
revoke all on function public.move_my_order_table(text, uuid, uuid) from public;
revoke all on function public.set_my_order_radius(text, int) from public;
revoke all on function public.push_table_moved_targets(text, text) from public, anon, authenticated;
revoke all on function public.push_order_update_targets(uuid) from public, anon, authenticated;

grant execute on function public.get_public_tables(text) to anon, authenticated;
grant execute on function public.place_order(text, text, text, jsonb, text, text, text, uuid, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.move_order_table(text, text, uuid, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.move_my_order_table(text, uuid, uuid) to authenticated;
grant execute on function public.set_my_order_radius(text, int) to authenticated;
grant execute on function public.push_table_moved_targets(text, text) to service_role;
grant execute on function public.push_order_update_targets(uuid) to service_role;

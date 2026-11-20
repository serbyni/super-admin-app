-- Orders: item options, ordering switch + opening hours, orders and their lines, public ordering
-- (anon, prices always recomputed here), owner board, and real-time updates
-- (private 'orders:<cafe_id>' for the café, public 'order:<token>' for the customer's phone).

/* ── Item options ────────────────────────────────────────────────────────── */

alter table public.menu_items add column options jsonb not null default '[]';

/**
 * Option groups of an item: [{id, name, i18n, min, max, choices: [{id, name, i18n, price, isAvailable}]}].
 * min = 1 → required; max = how many choices a customer may pick.
 */
create or replace function platform.check_options(p jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  g jsonb;
  ch jsonb;
  v_ids text[] := '{}';
  v_n int;
begin
  if p is null then return; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 6 or octet_length(p::text) > 32768 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'options';
  end if;
  for g in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(g) <> 'object'
       or jsonb_typeof(g -> 'id') <> 'string' or char_length(g ->> 'id') not between 1 and 40
       or jsonb_typeof(g -> 'name') <> 'string' or char_length(btrim(g ->> 'name')) not between 1 and 40
       or jsonb_typeof(g -> 'min') <> 'number' or jsonb_typeof(g -> 'max') <> 'number'
       or jsonb_typeof(g -> 'choices') <> 'array' then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'options';
    end if;
    v_n := jsonb_array_length(g -> 'choices');
    if v_n not between 1 and 12
       or (g ->> 'min')::numeric not between 0 and 1
       or (g ->> 'max')::numeric < 1 or (g ->> 'max')::numeric > v_n
       or (g ->> 'max')::numeric <> round((g ->> 'max')::numeric) then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'options';
    end if;
    perform platform.check_i18n(g -> 'i18n', array['name'], array[40]);
    if (g ->> 'id') = any (v_ids) then raise exception 'invalid_input' using errcode = 'P0001', detail = 'options'; end if;
    v_ids := v_ids || (g ->> 'id');
    for ch in select * from jsonb_array_elements(g -> 'choices') loop
      if jsonb_typeof(ch) <> 'object'
         or jsonb_typeof(ch -> 'id') <> 'string' or char_length(ch ->> 'id') not between 1 and 40
         or (ch ->> 'id') = any (v_ids)
         or jsonb_typeof(ch -> 'name') <> 'string' or char_length(btrim(ch ->> 'name')) not between 1 and 40
         or jsonb_typeof(ch -> 'price') <> 'number'
         or (ch ->> 'price')::numeric < 0 or (ch ->> 'price')::numeric >= 100000
         or (ch ->> 'price')::numeric <> round((ch ->> 'price')::numeric, 3)
         or jsonb_typeof(ch -> 'isAvailable') <> 'boolean' then
        raise exception 'invalid_input' using errcode = 'P0001', detail = 'options';
      end if;
      perform platform.check_i18n(ch -> 'i18n', array['name'], array[40]);
      v_ids := v_ids || (ch ->> 'id');
    end loop;
  end loop;
end $$;

drop function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb);
create function public.save_my_menu_item(
  p_slug text, p_id uuid, p_category_id uuid, p_name text, p_description text, p_price numeric,
  p_image jsonb, p_tags text[], p_is_available boolean, p_is_visible boolean, p_is_featured boolean,
  p_i18n jsonb default null, p_options jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := btrim(coalesce(p_name, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_tags text[] := coalesce((select array_agg(distinct t order by t) from unnest(p_tags) t), '{}');
  v_old public.menu_items;
  v_id uuid;
begin
  if not exists (select 1 from public.menu_categories where id = p_category_id and cafe_id = v_cafe) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'category_id';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if char_length(v_desc) > 500 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'description';
  end if;
  if p_price is not null and (p_price < 0 or p_price >= 1000000 or p_price <> round(p_price, 3)) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'price';
  end if;
  if not (v_tags <@ array['vegetarian','vegan','gluten_free','spicy','new','popular']::text[]) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'tags';
  end if;
  perform platform.check_menu_image(v_cafe, p_image);
  perform platform.check_i18n(p_i18n, array['name','description'], array[80,500]);
  perform platform.check_options(p_options);

  if p_id is null then
    if (select count(*) from public.menu_items where cafe_id = v_cafe) >= 500 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_items (cafe_id, category_id, name, description, price, image, tags,
                                   is_available, is_visible, is_featured, i18n, options, sort_order)
    values (v_cafe, p_category_id, v_name, v_desc, p_price, p_image, v_tags,
            coalesce(p_is_available, true), coalesce(p_is_visible, true), coalesce(p_is_featured, false),
            coalesce(p_i18n, '{}'), coalesce(p_options, '[]'),
            coalesce((select max(sort_order) + 1 from public.menu_items where category_id = p_category_id), 0))
    returning id into v_id;
  else
    select * into v_old from public.menu_items where id = p_id and cafe_id = v_cafe for update;
    if v_old.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.menu_items
       set category_id = p_category_id, name = v_name, description = v_desc, price = p_price,
           image = p_image, tags = v_tags,
           is_available = coalesce(p_is_available, is_available),
           is_visible = coalesce(p_is_visible, is_visible),
           is_featured = coalesce(p_is_featured, is_featured),
           i18n = coalesce(p_i18n, i18n),
           options = coalesce(p_options, options),
           sort_order = case when v_old.category_id = p_category_id then sort_order
                             else coalesce((select max(sort_order) + 1 from public.menu_items
                                             where category_id = p_category_id), 0) end,
           updated_at = now()
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.get_my_menu(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'sortOrder', c.sort_order, 'isVisible', c.is_visible,
               'i18n', c.i18n)
               order by c.sort_order, c.created_at)
        from public.menu_categories c where c.cafe_id = v_cafe), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'categoryId', i.category_id, 'name', i.name,
               'description', i.description, 'price', i.price, 'image', i.image, 'tags', to_jsonb(i.tags),
               'isAvailable', i.is_available, 'isVisible', i.is_visible, 'isFeatured', i.is_featured,
               'sortOrder', i.sort_order, 'i18n', i.i18n, 'options', i.options)
               order by i.sort_order, i.created_at)
        from public.menu_items i where i.cafe_id = v_cafe), '[]'::jsonb)
  );
end $$;

/* ── Ordering switch + opening hours ─────────────────────────────────────── */

alter table public.cafes add column accepting_orders boolean not null default false;

/**
 * Is the café open right now (published website hours, café time zone)? No published hours →
 * always open. Returns {openNow, closesAt, opensAt, opensDay (0 = Monday)}.
 */
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
  select c.timezone, w.published -> 'footer' -> 'hours' into v_tz, v_hours
    from public.cafes c left join public.cafe_websites w on w.cafe_id = c.id
   where c.id = p_cafe;
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

/** Ordering state for the café site: the owner's switch + opening hours. */
create or replace function public.get_public_ordering(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.cafes;
begin
  select * into c from public.cafes where slug = lower(btrim(coalesce(p_slug, ''))) and status = 'active';
  if c.id is null then return null; end if;
  return jsonb_build_object('acceptingOrders', c.accepting_orders) || platform.cafe_open_now(c.id);
end $$;

/** Owner: same state plus the switch, without locking (polled by the board). */
create or replace function platform.member_cafe(p_slug text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_cafe uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select c.id into v_cafe
    from public.cafes c
    join public.cafe_members m on m.cafe_id = c.id and m.user_id = auth.uid()
   where c.slug = lower(btrim(coalesce(p_slug, '')));
  if v_cafe is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return v_cafe;
end $$;

create or replace function public.set_my_accepting_orders(p_slug text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  update public.cafes set accepting_orders = coalesce(p_on, false), updated_at = now() where id = v_cafe;
end $$;

/* ── Orders ──────────────────────────────────────────────────────────────── */

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  cafe_id        uuid not null references public.cafes (id) on delete cascade,
  number         int  not null check (number > 0),
  kind           text not null check (kind in ('table', 'takeaway')),
  table_id       uuid,
  table_label    text,
  customer_name  text not null default '' check (char_length(customer_name) <= 40),
  note           text not null default '' check (char_length(note) <= 300),
  locale         text not null default 'en',
  status         text not null default 'new'
                 check (status in ('new','accepted','preparing','ready','served','declined','cancelled')),
  decline_reason text not null default '' check (char_length(decline_reason) <= 200),
  subtotal       numeric(12,3) not null check (subtotal >= 0),
  currency       text not null,
  is_paid        boolean not null default false,
  paid_at        timestamptz,
  token          text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at     timestamptz not null default now(),
  accepted_at    timestamptz,
  ready_at       timestamptz,
  served_at      timestamptz,
  closed_at      timestamptz,
  updated_at     timestamptz not null default now(),
  check (kind = 'takeaway' or table_label is not null)
);
create index orders_cafe_created_idx on public.orders (cafe_id, created_at desc);
create index orders_cafe_open_idx on public.orders (cafe_id) where status in ('new','accepted','preparing','ready');

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  item_id    uuid references public.menu_items (id) on delete set null,
  name       text not null,
  unit_price numeric(12,3) not null check (unit_price >= 0),
  options    jsonb not null default '[]',
  quantity   int not null check (quantity between 1 and 20),
  note       text not null default '' check (char_length(note) <= 140),
  line_total numeric(12,3) not null check (line_total >= 0),
  position   int not null default 0
);
create index order_items_order_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;

/** Lines + header of an order as JSON (owner board and customer page). */
create or replace function platform.order_json(o public.orders, p_private boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', case when p_private then o.id end,
    'number', o.number, 'kind', o.kind, 'tableLabel', o.table_label,
    'customerName', o.customer_name, 'note', o.note, 'status', o.status,
    'declineReason', o.decline_reason, 'subtotal', o.subtotal, 'currency', o.currency,
    'isPaid', o.is_paid, 'locale', o.locale,
    'createdAt', o.created_at, 'acceptedAt', o.accepted_at, 'readyAt', o.ready_at,
    'servedAt', o.served_at, 'closedAt', o.closed_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'itemId', li.item_id, 'name', li.name, 'unitPrice', li.unit_price,
               'options', li.options, 'quantity', li.quantity, 'note', li.note,
               'lineTotal', li.line_total) order by li.position)
        from public.order_items li where li.order_id = o.id), '[]'::jsonb))
$$;

/**
 * Customer order (anon). p_items: [{itemId, quantity, choices: [choiceId…], note}]. Prices,
 * availability and options are taken from the menu here — nothing from the browser is trusted.
 */
create or replace function public.place_order(
  p_slug text, p_table_code text, p_customer_name text, p_items jsonb, p_note text, p_locale text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.cafes;
  v_open jsonb;
  v_table_id uuid;
  v_table_label text;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_note text := btrim(coalesce(p_note, ''));
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

  if coalesce(btrim(p_table_code), '') <> '' then
    select t.id, t.label into v_table_id, v_table_label
      from public.qr_codes q join public.cafe_tables t on t.id = q.table_id
     where q.code = upper(btrim(p_table_code)) and q.cafe_id = c.id and q.retired_at is null and t.is_active;
    if v_table_id is null then raise exception 'invalid_input' using errcode = 'P0001', detail = 'table'; end if;
    if (select count(*) from public.orders
         where table_id = v_table_id and status in ('new','accepted','preparing','ready')) >= 3 then
      raise exception 'too_many_orders' using errcode = 'P0001', detail = 'table';
    end if;
  elsif char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'customer_name';
  end if;
  if (select count(*) from public.orders where cafe_id = c.id and created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'too_many_orders' using errcode = 'P0001', detail = 'cafe';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'items';
  end if;

  v_today := (now() at time zone c.timezone)::date;
  insert into public.orders (cafe_id, number, kind, table_id, table_label, customer_name, note, locale,
                             subtotal, currency)
  values (c.id,
          coalesce((select max(number) from public.orders
                     where cafe_id = c.id and (created_at at time zone c.timezone)::date = v_today), 0) + 1,
          case when v_table_id is null then 'takeaway' else 'table' end,
          v_table_id, v_table_label, case when v_table_id is null then v_name else '' end,
          v_note, v_locale, 0, c.currency)
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
    -- Every chosen id must belong to this item.
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

/** Customer's order page (anon): only with the order's secret token. */
create or replace function public.get_public_order(p_slug text, p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select platform.order_json(o, false)
    from public.orders o join public.cafes c on c.id = o.cafe_id
   where o.token = p_token and c.slug = lower(btrim(coalesce(p_slug, '')));
$$;

/** Owner board / history. scope 'active' = open orders; 'day' = all orders of p_day (café time). */
create or replace function public.get_my_orders(p_slug text, p_scope text, p_day date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  v_tz text;
  v_accepting boolean;
begin
  select timezone, accepting_orders into v_tz, v_accepting from public.cafes where id = v_cafe;
  return jsonb_build_object(
    'acceptingOrders', v_accepting,
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

/** Board actions: new → accepted | declined; then forward to preparing → ready → served; cancel any open. */
create or replace function public.set_my_order_status(p_slug text, p_id uuid, p_status text, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  o public.orders;
  v_rank jsonb := '{"new":0,"accepted":1,"preparing":2,"ready":3,"served":4}';
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into o from public.orders where id = p_id and cafe_id = v_cafe for update;
  if o.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_reason) > 200 then raise exception 'invalid_input' using errcode = 'P0001', detail = 'reason'; end if;
  if not (
       (o.status = 'new' and p_status in ('accepted', 'declined', 'cancelled'))
       or (o.status in ('accepted', 'preparing', 'ready')
           and (p_status = 'cancelled'
                or (p_status in ('preparing', 'ready', 'served')
                    and (v_rank ->> p_status)::int > (v_rank ->> o.status)::int)))
     ) then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.orders
     set status = p_status,
         decline_reason = case when p_status in ('declined','cancelled') then v_reason else decline_reason end,
         accepted_at = case when p_status in ('accepted','preparing','ready','served') then coalesce(accepted_at, now()) else accepted_at end,
         ready_at = case when p_status in ('ready','served') then coalesce(ready_at, now()) else ready_at end,
         served_at = case when p_status = 'served' then now() else served_at end,
         closed_at = case when p_status in ('served','declined','cancelled') then now() else closed_at end,
         updated_at = now()
   where id = o.id;
end $$;

create or replace function public.set_my_order_paid(p_slug text, p_id uuid, p_paid boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.member_cafe(p_slug);
begin
  update public.orders
     set is_paid = coalesce(p_paid, false),
         paid_at = case when coalesce(p_paid, false) then coalesce(paid_at, now()) end,
         updated_at = now()
   where id = p_id and cafe_id = v_cafe;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

/* ── Real-time ───────────────────────────────────────────────────────────── */

create or replace function platform.broadcast_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'number', new.number, 'status', new.status,
                       'isNew', tg_op = 'INSERT'),
    'order', 'orders:' || new.cafe_id::text, true);
  perform realtime.send(
    jsonb_build_object('status', new.status), 'order', 'order:' || new.token, false);
  return new;
exception when others then
  raise warning 'broadcast_order failed: %', sqlerrm;
  return new;
end $$;

create trigger on_order_broadcast
  after insert or update of status, is_paid, subtotal on public.orders
  for each row execute function platform.broadcast_order();

drop policy if exists "cafe members receive their orders" on realtime.messages;
create policy "cafe members receive their orders"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (select 1 from public.cafe_members m
                 where m.user_id = (select auth.uid())
                   and realtime.topic() = 'orders:' || m.cafe_id::text)
  );

/* ── Public menu with options ────────────────────────────────────────────── */

create or replace function public.get_public_menu(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'currency', c.currency,
           'locale', c.default_locale,
           'locales', to_jsonb(platform.offered_locales(c.default_locale, c.locales)),
           'categories', coalesce((
             select jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name, 'i18n', mc.i18n, 'items', its.items)
                              order by mc.sort_order, mc.created_at)
               from public.menu_categories mc
               cross join lateral (
                 select jsonb_agg(jsonb_build_object(
                          'id', mi.id, 'name', mi.name, 'description', mi.description,
                          'price', mi.price, 'image', mi.image, 'tags', to_jsonb(mi.tags),
                          'isAvailable', mi.is_available, 'isFeatured', mi.is_featured, 'i18n', mi.i18n,
                          'options', mi.options)
                          order by mi.sort_order, mi.created_at) as items
                   from public.menu_items mi
                  where mi.category_id = mc.id and mi.is_visible and mi.price is not null
               ) its
              where mc.cafe_id = c.id and mc.is_visible and its.items is not null), '[]'::jsonb))
    from public.cafes c
   where c.slug = lower(btrim(coalesce(p_slug, ''))) and c.status = 'active';
$$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.check_options(jsonb) from public;
revoke all on function platform.cafe_open_now(uuid) from public;
revoke all on function platform.member_cafe(text) from public;
revoke all on function platform.order_json(public.orders, boolean) from public;
revoke all on function platform.broadcast_order() from public, anon, authenticated;
revoke all on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb, jsonb) from public;
revoke all on function public.get_public_ordering(text) from public;
revoke all on function public.set_my_accepting_orders(text, boolean) from public;
revoke all on function public.place_order(text, text, text, jsonb, text, text) from public;
revoke all on function public.get_public_order(text, text) from public;
revoke all on function public.get_my_orders(text, text, date) from public;
revoke all on function public.set_my_order_status(text, uuid, text, text) from public;
revoke all on function public.set_my_order_paid(text, uuid, boolean) from public;

grant execute on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb, jsonb) to authenticated;
grant execute on function public.get_public_ordering(text) to anon, authenticated;
grant execute on function public.place_order(text, text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.get_public_order(text, text) to anon, authenticated;
grant execute on function public.set_my_accepting_orders(text, boolean) to authenticated;
grant execute on function public.get_my_orders(text, text, date) to authenticated;
grant execute on function public.set_my_order_status(text, uuid, text, text) to authenticated;
grant execute on function public.set_my_order_paid(text, uuid, boolean) to authenticated;

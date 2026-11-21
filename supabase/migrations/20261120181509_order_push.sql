-- Order notifications: web push subscriptions (owners per device, customers per order), one-time
-- new-order push, and the optional e-mail receipt (sent once when the order is accepted).

create table platform.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('owner', 'order')),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,
  order_id   uuid references public.orders (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 10 and 100),
  locale     text not null default 'en',
  failures   int not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'owner' and user_id is not null) or (kind = 'order' and order_id is not null))
);
create index push_subscriptions_cafe_idx on platform.push_subscriptions (cafe_id) where kind = 'owner';
create index push_subscriptions_order_idx on platform.push_subscriptions (order_id) where kind = 'order';
alter table platform.push_subscriptions enable row level security;

alter table public.orders
  add column push_new_sent_at timestamptz,
  add column customer_email text check (customer_email is null or (char_length(customer_email) <= 254
                                        and customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column receipt_sent_at timestamptz;

/* ── Subscriptions ───────────────────────────────────────────────────────── */

create or replace function platform.check_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 20 and 200
     or char_length(coalesce(p_auth, '')) not between 10 and 100 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'subscription';
  end if;
end $$;

/** Owner device (café members): notified of new orders. Re-subscribing moves the endpoint. */
create or replace function public.save_my_push_subscription(p_slug text, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  v_locale text := coalesce((select locale from platform.owner_accounts where user_id = auth.uid()), 'en');
begin
  perform platform.check_push(p_endpoint, p_p256dh, p_auth);
  insert into platform.push_subscriptions (kind, cafe_id, user_id, endpoint, p256dh, auth, locale)
  values ('owner', v_cafe, auth.uid(), p_endpoint, p_p256dh, p_auth, v_locale)
  on conflict (endpoint) do update
     set kind = 'owner', cafe_id = excluded.cafe_id, user_id = excluded.user_id, order_id = null,
         p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale, failures = 0;
end $$;

create or replace function public.delete_my_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from platform.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $$;

/** Customer phone (anon, with the order's secret token): notified of every status change. */
create or replace function public.save_order_push_subscription(
  p_slug text, p_token text, p_endpoint text, p_p256dh text, p_auth text
) returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  perform platform.check_push(p_endpoint, p_p256dh, p_auth);
  select ord.* into o from public.orders ord join public.cafes c on c.id = ord.cafe_id
   where ord.token = p_token and c.slug = lower(btrim(coalesce(p_slug, '')));
  if o.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.status not in ('new', 'accepted', 'preparing', 'ready') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if (select count(*) from platform.push_subscriptions where order_id = o.id and endpoint <> p_endpoint) >= 3 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
  end if;
  insert into platform.push_subscriptions (kind, cafe_id, order_id, endpoint, p256dh, auth, locale)
  values ('order', o.cafe_id, o.id, p_endpoint, p_p256dh, p_auth, o.locale)
  on conflict (endpoint) do update
     set kind = 'order', cafe_id = excluded.cafe_id, order_id = excluded.order_id, user_id = null,
         p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale, failures = 0;
end $$;

/* ── Targets for the sender (service role only) ──────────────────────────── */

/** New order: once per order, only while fresh. Marks it sent. */
create or replace function public.push_new_order_targets(p_slug text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.cafes;
begin
  select ord.* into o from public.orders ord join public.cafes cf on cf.id = ord.cafe_id
   where ord.token = p_token and cf.slug = lower(btrim(coalesce(p_slug, '')))
     and ord.push_new_sent_at is null and ord.created_at > now() - interval '5 minutes'
   for update of ord;
  if o.id is null then return null; end if;
  update public.orders set push_new_sent_at = now() where id = o.id;
  select * into c from public.cafes where id = o.cafe_id;
  return jsonb_build_object(
    'order', jsonb_build_object('number', o.number, 'kind', o.kind, 'tableLabel', o.table_label,
                                'customerName', o.customer_name, 'subtotal', o.subtotal, 'currency', o.currency),
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh,
                                                                   'auth', s.auth, 'locale', s.locale))
                                 from platform.push_subscriptions s where s.cafe_id = o.cafe_id and s.kind = 'owner'),
                              '[]'::jsonb));
end $$;

/** Status change: the customer's phones. */
create or replace function public.push_order_update_targets(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order', jsonb_build_object('number', o.number, 'status', o.status, 'reason', o.decline_reason,
                                'kind', o.kind, 'tableLabel', o.table_label, 'customerName', o.customer_name,
                                'token', o.token),
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh,
                                                                   'auth', s.auth, 'locale', s.locale))
                                 from platform.push_subscriptions s where s.order_id = o.id), '[]'::jsonb))
    from public.orders o join public.cafes c on c.id = o.cafe_id
   where o.id = p_order_id;
$$;

/** Gone (404/410) → delete; other failures counted, deleted after 5. */
create or replace function public.push_drop_subscription(p_endpoint text, p_gone boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_gone then
    delete from platform.push_subscriptions where endpoint = p_endpoint;
  else
    update platform.push_subscriptions set failures = failures + 1 where endpoint = p_endpoint;
    delete from platform.push_subscriptions where endpoint = p_endpoint and failures >= 5;
  end if;
end $$;

/** E-mail receipt: once per order (marks it sent). Null when no e-mail or already sent. */
create or replace function public.receipt_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.cafes;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.customer_email is null or o.receipt_sent_at is not null then return null; end if;
  update public.orders set receipt_sent_at = now() where id = o.id;
  select * into c from public.cafes where id = o.cafe_id;
  return platform.order_json(o, false) || jsonb_build_object(
    'email', o.customer_email, 'token', o.token,
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug, 'address', c.address, 'city', c.city,
                               'phone', c.phone, 'timezone', c.timezone, 'seed', c.theme ->> 'seed'));
end $$;

/* ── place_order + optional e-mail ───────────────────────────────────────── */

drop function public.place_order(text, text, text, jsonb, text, text);
create function public.place_order(
  p_slug text, p_table_code text, p_customer_name text, p_items jsonb, p_note text, p_locale text,
  p_customer_email text default null
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

/** The owner's own order view: also shows whether a receipt e-mail was given (never the address to anon). */
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
    'customerEmail', case when p_private then o.customer_email end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'itemId', li.item_id, 'name', li.name, 'unitPrice', li.unit_price,
               'options', li.options, 'quantity', li.quantity, 'note', li.note,
               'lineTotal', li.line_total) order by li.position)
        from public.order_items li where li.order_id = o.id), '[]'::jsonb))
$$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on platform.push_subscriptions from anon, authenticated;
revoke all on function platform.check_push(text, text, text) from public;
revoke all on function public.save_my_push_subscription(text, text, text, text) from public;
revoke all on function public.delete_my_push_subscription(text) from public;
revoke all on function public.save_order_push_subscription(text, text, text, text, text) from public;
revoke all on function public.push_new_order_targets(text, text) from public, anon, authenticated;
revoke all on function public.push_order_update_targets(uuid) from public, anon, authenticated;
revoke all on function public.push_drop_subscription(text, boolean) from public, anon, authenticated;
revoke all on function public.receipt_order(uuid) from public, anon, authenticated;
revoke all on function public.place_order(text, text, text, jsonb, text, text, text) from public;

grant execute on function public.save_my_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_my_push_subscription(text) to authenticated;
grant execute on function public.save_order_push_subscription(text, text, text, text, text) to anon, authenticated;
grant execute on function public.push_new_order_targets(text, text) to service_role;
grant execute on function public.push_order_update_targets(uuid) to service_role;
grant execute on function public.push_drop_subscription(text, boolean) to service_role;
grant execute on function public.receipt_order(uuid) to service_role;
grant execute on function public.place_order(text, text, text, jsonb, text, text, text) to anon, authenticated;

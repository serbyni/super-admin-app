-- 1) Tags cleanup: both apps read menu_items.tag_ids now, so the old built-in key column
--    (menu_items.tags) and the matching public field go. save_my_menu_item keeps its p_tags
--    parameter (still accepted as built-in keys when p_tag_ids is not given).
-- 2) Menu display: an owner can turn the café into "menu only" (no online ordering) and show
--    the menu as a 3D book. A menu-only café can never have ordering switched on.

/* ── 1. Tags cleanup ─────────────────────────────────────────────────────── */

create or replace function public.save_my_menu_item(
  p_slug text, p_id uuid, p_category_id uuid, p_name text, p_description text, p_price numeric,
  p_image jsonb, p_tags text[], p_is_available boolean, p_is_visible boolean, p_is_featured boolean,
  p_i18n jsonb default null, p_options jsonb default null, p_tag_ids uuid[] default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := btrim(coalesce(p_name, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_tag_ids uuid[];
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
  if p_tag_ids is not null then
    -- Only this café's tags, each once, in the café's tag order.
    if exists (select 1 from unnest(p_tag_ids) x
                where not exists (select 1 from public.menu_tags where id = x and cafe_id = v_cafe)) then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'tags';
    end if;
    v_tag_ids := coalesce((select array_agg(t.id order by t.sort_order) from public.menu_tags t
                            where t.cafe_id = v_cafe and t.id = any (p_tag_ids)), '{}');
  else
    -- Previous app version: built-in keys.
    if not (coalesce(p_tags, '{}') <@ array['vegetarian','vegan','gluten_free','spicy','new','popular']::text[]) then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'tags';
    end if;
    v_tag_ids := coalesce((select array_agg(t.id order by t.sort_order) from public.menu_tags t
                            where t.cafe_id = v_cafe and t.key = any (coalesce(p_tags, '{}'))), '{}');
  end if;
  perform platform.check_menu_image(v_cafe, p_image);
  perform platform.check_i18n(p_i18n, array['name','description'], array[80,500]);
  perform platform.check_options(p_options);

  if p_id is null then
    if (select count(*) from public.menu_items where cafe_id = v_cafe) >= 500 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_items (cafe_id, category_id, name, description, price, image, tag_ids,
                                   is_available, is_visible, is_featured, i18n, options, sort_order)
    values (v_cafe, p_category_id, v_name, v_desc, p_price, p_image, v_tag_ids,
            coalesce(p_is_available, true), coalesce(p_is_visible, true), coalesce(p_is_featured, false),
            coalesce(p_i18n, '{}'), coalesce(p_options, '[]'),
            coalesce((select max(sort_order) + 1 from public.menu_items where category_id = p_category_id), 0))
    returning id into v_id;
  else
    select * into v_old from public.menu_items where id = p_id and cafe_id = v_cafe for update;
    if v_old.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.menu_items
       set category_id = p_category_id, name = v_name, description = v_desc, price = p_price,
           image = p_image, tag_ids = v_tag_ids,
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

create or replace function public.delete_my_menu_tag(p_slug text, p_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug); v_n int;
begin
  if not exists (select 1 from public.menu_tags where id = p_id and cafe_id = v_cafe) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.menu_items
     set tag_ids = array_remove(tag_ids, p_id), updated_at = now()
   where cafe_id = v_cafe and p_id = any (tag_ids);
  get diagnostics v_n = row_count;
  delete from public.menu_tags where id = p_id;
  return v_n;
end $$;

alter table public.menu_items drop column tags;
drop function platform.tag_keys(uuid[]);

/* ── 2. Menu display ─────────────────────────────────────────────────────── */

alter table public.cafes
  add column menu_mode text not null default 'order' check (menu_mode in ('order', 'menu_only')),
  add column menu_display text not null default 'list' check (menu_display in ('list', 'book')),
  add constraint cafes_menu_only_no_orders check (menu_mode = 'order' or not accepting_orders);

/** Owner: ordering on the site or menu only, and how the menu is shown (book: menu-only cafés). */
create or replace function public.set_my_menu_display(p_slug text, p_mode text, p_display text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if p_mode is null or p_mode not in ('order', 'menu_only') then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'mode';
  end if;
  if p_display is null or p_display not in ('list', 'book') then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'display';
  end if;
  update public.cafes
     set menu_mode = p_mode, menu_display = p_display,
         accepting_orders = case when p_mode = 'menu_only' then false else accepting_orders end,
         updated_at = now()
   where id = v_cafe;
end $$;

/** "Accepting orders" switch: refused while the café is in menu-only mode. */
create or replace function public.set_my_accepting_orders(p_slug text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if coalesce(p_on, false) and (select menu_mode from public.cafes where id = v_cafe) = 'menu_only' then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  update public.cafes set accepting_orders = coalesce(p_on, false), updated_at = now() where id = v_cafe;
end $$;

/** Ordering state for the café site: + menuOnly. */
create or replace function public.get_public_ordering(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.cafes;
begin
  select * into c from public.cafes where slug = lower(btrim(coalesce(p_slug, ''))) and status = 'active';
  if c.id is null then return null; end if;
  return jsonb_build_object('acceptingOrders', c.accepting_orders, 'menuOnly', c.menu_mode = 'menu_only')
         || platform.cafe_open_now(c.id);
end $$;

create or replace function public.get_my_menu(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'sortOrder', c.sort_order, 'isVisible', c.is_visible,
               'i18n', c.i18n, 'icon', c.icon,
               'itemCount', (select count(*) from public.menu_items i where i.category_id = c.id))
               order by c.sort_order, c.created_at)
        from public.menu_categories c where c.cafe_id = v_cafe), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(platform.tag_json(t) || jsonb_build_object(
               'itemCount', (select count(*) from public.menu_items i
                              where i.cafe_id = v_cafe and t.id = any (i.tag_ids)))
               order by t.sort_order, t.created_at)
        from public.menu_tags t where t.cafe_id = v_cafe), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'categoryId', i.category_id, 'name', i.name,
               'description', i.description, 'price', i.price, 'image', i.image,
               'tagIds', to_jsonb(i.tag_ids),
               'isAvailable', i.is_available, 'isVisible', i.is_visible, 'isFeatured', i.is_featured,
               'sortOrder', i.sort_order, 'i18n', i.i18n, 'options', i.options)
               order by i.sort_order, i.created_at)
        from public.menu_items i where i.cafe_id = v_cafe), '[]'::jsonb)
  );
end $$;

create or replace function public.get_public_menu(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'currency', c.currency,
           -- Menu-only cafés can show the 3D book; ordering cafés always show the list.
           'menuOnly', c.menu_mode = 'menu_only',
           'display', case when c.menu_mode = 'menu_only' then c.menu_display else 'list' end,
           'locale', c.default_locale,
           'locales', to_jsonb(platform.offered_locales(c.default_locale, c.locales)),
           'tagList', coalesce((
             select jsonb_agg(jsonb_build_object('id', t.id, 'key', t.key, 'name', t.name,
                                                 'icon', t.icon, 'i18n', t.i18n)
                              order by t.sort_order, t.created_at)
               from public.menu_tags t where t.cafe_id = c.id and t.is_visible), '[]'::jsonb),
           'categories', coalesce((
             select jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name, 'i18n', mc.i18n, 'icon', mc.icon,
                                                 'items', its.items)
                              order by mc.sort_order, mc.created_at)
               from public.menu_categories mc
               cross join lateral (
                 select jsonb_agg(jsonb_build_object(
                          'id', mi.id, 'name', mi.name, 'description', mi.description,
                          'price', mi.price, 'image', mi.image,
                          'tagIds', to_jsonb(coalesce((select array_agg(t.id order by t.sort_order)
                                                        from public.menu_tags t
                                                       where t.id = any (mi.tag_ids) and t.is_visible), '{}')),
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

revoke all on function public.set_my_menu_display(text, text, text) from public;
grant execute on function public.set_my_menu_display(text, text, text) to authenticated;

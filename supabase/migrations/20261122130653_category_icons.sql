-- Category icons (same idea as tag icons): an optional icon per menu category, from a curated
-- list of food & drink icons, shown in the dashboard and on the café menu.

/** Icons a category may use (keep in sync with CATEGORY_ICONS in src/lib/menu/tags.ts). */
create or replace function platform.category_icons()
returns text[] language sql immutable set search_path = '' as $$
  select array['local_cafe','coffee','emoji_food_beverage','local_drink','sports_bar','wine_bar',
               'liquor','icecream','cake','bakery_dining','cookie','breakfast_dining',
               'egg_alt','lunch_dining','local_pizza','ramen_dining','rice_bowl','set_meal',
               'kebab_dining','tapas','soup_kitchen','restaurant','eco','star']
$$;

alter table public.menu_categories
  add column icon text check (icon is null or icon = any (platform.category_icons()));

/**
 * Category save: + p_icon (null = keep the current icon, '' = no icon, else one of the list).
 */
drop function public.save_my_menu_category(text, uuid, text, boolean, jsonb);
create function public.save_my_menu_category(
  p_slug text, p_id uuid, p_name text, p_is_visible boolean, p_i18n jsonb default null,
  p_icon text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := btrim(coalesce(p_name, ''));
  v_icon text := nullif(btrim(coalesce(p_icon, '')), '');
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if v_icon is not null and not (v_icon = any (platform.category_icons())) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'icon';
  end if;
  perform platform.check_i18n(p_i18n, array['name'], array[60]);
  if p_id is null then
    if (select count(*) from public.menu_categories where cafe_id = v_cafe) >= 50 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_categories (cafe_id, name, is_visible, i18n, icon, sort_order)
    values (v_cafe, v_name, coalesce(p_is_visible, true), coalesce(p_i18n, '{}'), v_icon,
            coalesce((select max(sort_order) + 1 from public.menu_categories where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    update public.menu_categories
       set name = v_name, is_visible = coalesce(p_is_visible, is_visible),
           i18n = coalesce(p_i18n, i18n),
           icon = case when p_icon is null then icon else v_icon end,
           updated_at = now()
     where id = p_id and cafe_id = v_cafe returning id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
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
               'description', i.description, 'price', i.price, 'image', i.image, 'tags', to_jsonb(i.tags),
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
                          -- Old café site: built-in keys of visible tags.
                          'tags', to_jsonb(coalesce((select array_agg(t.key) from public.menu_tags t
                                                      where t.id = any (mi.tag_ids) and t.is_visible
                                                        and t.key is not null), '{}')),
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

revoke all on function platform.category_icons() from public;
revoke all on function public.save_my_menu_category(text, uuid, text, boolean, jsonb, text) from public;
grant execute on function platform.category_icons() to anon, authenticated;
grant execute on function public.save_my_menu_category(text, uuid, text, boolean, jsonb, text) to authenticated;

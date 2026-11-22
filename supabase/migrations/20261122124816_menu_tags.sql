-- Owner-managed menu tags. Every café starts with the 6 built-ins (popular, new, vegetarian,
-- vegan, gluten_free, spicy — named by the apps' translations until the owner renames them) and can
-- add its own (name + translations + an icon from a curated list), hide, reorder or delete them.
-- Items point to tags by id (menu_items.tag_ids). The old menu_items.tags (built-in keys) is kept
-- in sync and still returned until every app reads tag_ids; a later cleanup drops it.

/** Icons a tag may use (keep in sync with TAG_ICONS in src/lib/menu/tags.ts). */
create or replace function platform.tag_icons()
returns text[] language sql immutable set search_path = '' as $$
  select array['local_fire_department','new_releases','eco','spa','grain','whatshot',
               'star','favorite','recommend','workspace_premium','home','cooking',
               'local_cafe','emoji_food_beverage','icecream','ac_unit','cake','bakery_dining',
               'egg','nutrition','water_drop','no_food','sell','sports_bar']
$$;

create table public.menu_tags (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  key        text check (key in ('popular','new','vegetarian','vegan','gluten_free','spicy')),
  name       text check (char_length(name) between 1 and 40),
  icon       text not null check (icon = any (platform.tag_icons())),
  i18n       jsonb not null default '{}',
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A custom tag needs a name; a built-in without one uses the default translation.
  check (key is not null or name is not null),
  unique (cafe_id, key)
);
create unique index menu_tags_name_idx on public.menu_tags (cafe_id, lower(name)) where name is not null;
create index menu_tags_cafe_idx on public.menu_tags (cafe_id, sort_order);
alter table public.menu_tags enable row level security;
revoke all on public.menu_tags from anon, authenticated;
comment on table public.menu_tags is
  'Menu tags of a café (built-ins have a key; name null = default translation). RLS on, no policies: RPC only.';

alter table public.menu_items add column tag_ids uuid[] not null default '{}';

/** The 6 built-in tags of a café (idempotent). */
create or replace function platform.seed_menu_tags(p_cafe uuid)
returns void language sql set search_path = '' as $$
  insert into public.menu_tags (cafe_id, key, icon, sort_order)
  select p_cafe, b.key, b.icon, b.ord
    from (values ('popular','local_fire_department',0), ('new','new_releases',1), ('vegetarian','eco',2),
                 ('vegan','spa',3), ('gluten_free','grain',4), ('spicy','whatshot',5)) b(key, icon, ord)
  on conflict (cafe_id, key) do nothing
$$;

create or replace function platform.seed_menu_tags_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform platform.seed_menu_tags(new.id);
  return new;
end $$;
create trigger cafes_seed_menu_tags after insert on public.cafes
  for each row execute function platform.seed_menu_tags_trigger();

-- Existing cafés + items: built-ins seeded, item keys → tag ids.
select platform.seed_menu_tags(id) from public.cafes;
update public.menu_items i
   set tag_ids = coalesce((select array_agg(t.id order by t.sort_order)
                             from public.menu_tags t
                            where t.cafe_id = i.cafe_id and t.key = any (i.tags)), '{}')
 where cardinality(i.tags) > 0;

/** Built-in keys of a list of tag ids (keeps the old menu_items.tags column right). */
create or replace function platform.tag_keys(p_ids uuid[])
returns text[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(t.key order by t.key) filter (where t.key is not null), '{}')
    from public.menu_tags t where t.id = any (p_ids)
$$;

/* ── Owner: tags ─────────────────────────────────────────────────────────── */

/**
 * Create (p_id null) or update a tag. A built-in with an empty name goes back to its default
 * translation. Errors: invalid_input (name | icon | i18n | limit) · name_taken · forbidden.
 */
create or replace function public.save_my_menu_tag(
  p_slug text, p_id uuid, p_name text, p_icon text, p_i18n jsonb, p_is_visible boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_old public.menu_tags;
  v_id uuid;
begin
  if v_name is not null and char_length(v_name) > 40 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if p_icon is null or not (p_icon = any (platform.tag_icons())) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'icon';
  end if;
  perform platform.check_i18n(p_i18n, array['name'], array[40]);
  if v_name is not null and exists (
       select 1 from public.menu_tags
        where cafe_id = v_cafe and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'name_taken' using errcode = 'P0001';
  end if;
  if p_id is null then
    if v_name is null then raise exception 'invalid_input' using errcode = 'P0001', detail = 'name'; end if;
    if (select count(*) from public.menu_tags where cafe_id = v_cafe) >= 40 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_tags (cafe_id, name, icon, i18n, is_visible, sort_order)
    values (v_cafe, v_name, p_icon, coalesce(p_i18n, '{}'), coalesce(p_is_visible, true),
            coalesce((select max(sort_order) + 1 from public.menu_tags where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    select * into v_old from public.menu_tags where id = p_id and cafe_id = v_cafe for update;
    if v_old.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
    if v_name is null and v_old.key is null then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
    end if;
    update public.menu_tags
       set name = v_name, icon = p_icon,
           -- Back to the default name: its translations go too.
           i18n = case when v_name is null then '{}'::jsonb else coalesce(p_i18n, i18n) end,
           is_visible = coalesce(p_is_visible, is_visible), updated_at = now()
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

/** Deletes a tag and removes it from its items. Returns how many items had it. */
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
  update public.menu_items
     set tags = platform.tag_keys(tag_ids)
   where cafe_id = v_cafe and tags is distinct from platform.tag_keys(tag_ids);
  return v_n;
end $$;

/** New order of ALL tags (raises stale_list when the list does not match). */
create or replace function public.reorder_my_menu_tags(p_slug text, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if p_ids is null or cardinality(p_ids) <> (select count(*) from public.menu_tags where cafe_id = v_cafe)
     or exists (select 1 from unnest(p_ids) x where not exists (
                  select 1 from public.menu_tags where id = x and cafe_id = v_cafe))
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update public.menu_tags t set sort_order = o.ord - 1, updated_at = now()
    from unnest(p_ids) with ordinality o(id, ord)
   where t.id = o.id;
end $$;

/* ── Items: tags by id (old key list still accepted from the previous app version) ── */

drop function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb, jsonb);
create function public.save_my_menu_item(
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
    insert into public.menu_items (cafe_id, category_id, name, description, price, image, tags, tag_ids,
                                   is_available, is_visible, is_featured, i18n, options, sort_order)
    values (v_cafe, p_category_id, v_name, v_desc, p_price, p_image, platform.tag_keys(v_tag_ids), v_tag_ids,
            coalesce(p_is_available, true), coalesce(p_is_visible, true), coalesce(p_is_featured, false),
            coalesce(p_i18n, '{}'), coalesce(p_options, '[]'),
            coalesce((select max(sort_order) + 1 from public.menu_items where category_id = p_category_id), 0))
    returning id into v_id;
  else
    select * into v_old from public.menu_items where id = p_id and cafe_id = v_cafe for update;
    if v_old.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.menu_items
       set category_id = p_category_id, name = v_name, description = v_desc, price = p_price,
           image = p_image, tags = platform.tag_keys(v_tag_ids), tag_ids = v_tag_ids,
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

/* ── Reads ───────────────────────────────────────────────────────────────── */

create or replace function platform.tag_json(t public.menu_tags)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'key', t.key, 'name', t.name, 'icon', t.icon, 'i18n', t.i18n,
                            'sortOrder', t.sort_order, 'isVisible', t.is_visible)
$$;

create or replace function public.get_my_menu(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'sortOrder', c.sort_order, 'isVisible', c.is_visible,
               'i18n', c.i18n,
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

/** Public menu: + the café's visible tags (tagList) and each item's visible tag ids (tagIds). */
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
             select jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name, 'i18n', mc.i18n, 'items', its.items)
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

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.tag_icons() from public;
revoke all on function platform.seed_menu_tags(uuid) from public;
revoke all on function platform.seed_menu_tags_trigger() from public;
revoke all on function platform.tag_keys(uuid[]) from public;
revoke all on function platform.tag_json(public.menu_tags) from public;
revoke all on function public.save_my_menu_tag(text, uuid, text, text, jsonb, boolean) from public;
revoke all on function public.delete_my_menu_tag(text, uuid) from public;
revoke all on function public.reorder_my_menu_tags(text, uuid[]) from public;
revoke all on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb, jsonb, uuid[]) from public;

grant execute on function platform.tag_icons() to anon, authenticated;
grant execute on function public.save_my_menu_tag(text, uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.delete_my_menu_tag(text, uuid) to authenticated;
grant execute on function public.reorder_my_menu_tags(text, uuid[]) to authenticated;
grant execute on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb, jsonb, uuid[]) to authenticated;

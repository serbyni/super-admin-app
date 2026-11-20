-- Menu: CATEGORIES (Coffee, Tea, …) and ITEMS of a café. One menu language for now (the café's
-- default_locale); name/description are plain text so per-locale translations can be added later
-- in a separate table without moving data.
--   · price: exact decimal (numeric, up to 3 decimals — TND/KWD…); NULL = not priced yet → the
--     item is not shown to customers.
--   · image: {path, alt} in the shared café media folder (platform.check_media_path).
--   · is_available = false → "Sold out" (still listed); is_visible = false → hidden.
--   · is_featured → website "Signature specialties".
-- Changes are live (no draft): get_public_menu reads the current state.
-- RPC-only (RLS on, no policies, no grants), like the website and tables.

/* ── Tables ──────────────────────────────────────────────────────────────── */

create table public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  sort_order int  not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cafe_id, id)
);
create unique index menu_categories_name_idx on public.menu_categories (cafe_id, lower(name));

create table public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  cafe_id      uuid not null references public.cafes (id) on delete cascade,
  category_id  uuid not null,
  name         text not null check (char_length(name) between 1 and 80),
  description  text not null default '' check (char_length(description) <= 500),
  price        numeric(12,3) check (price >= 0 and price < 1000000),
  image        jsonb,
  tags         text[] not null default '{}'
               check (tags <@ array['vegetarian','vegan','gluten_free','spicy','new','popular']::text[]),
  is_available boolean not null default true,
  is_visible   boolean not null default true,
  is_featured  boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- An item always belongs to a category of the SAME café.
  foreign key (cafe_id, category_id) references public.menu_categories (cafe_id, id) on delete restrict
);
create index menu_items_category_idx on public.menu_items (category_id, sort_order);
create index menu_items_cafe_idx on public.menu_items (cafe_id);

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
revoke all on table public.menu_categories, public.menu_items from anon, authenticated;

comment on table public.menu_categories is 'Menu categories of a café. RPC-only.';
comment on table public.menu_items is 'Menu items (price NULL = not priced → not public). RPC-only; get_public_menu (anon).';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Raises invalid_input (DETAIL = field) for a bad item image ({path, alt} of this café). */
create or replace function platform.check_menu_image(p_cafe uuid, p_image jsonb)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_image is null then return; end if;
  if jsonb_typeof(p_image) <> 'object'
     or jsonb_typeof(p_image -> 'path') is distinct from 'string'
     or not platform.check_media_path(p_cafe, p_image ->> 'path')
     or char_length(coalesce(p_image ->> 'alt', '')) > 150 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'image';
  end if;
end $$;

/* ── Owner: read ─────────────────────────────────────────────────────────── */

create or replace function public.get_my_menu(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'sortOrder', c.sort_order, 'isVisible', c.is_visible)
               order by c.sort_order, c.created_at)
        from public.menu_categories c where c.cafe_id = v_cafe), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'categoryId', i.category_id, 'name', i.name,
               'description', i.description, 'price', i.price, 'image', i.image, 'tags', to_jsonb(i.tags),
               'isAvailable', i.is_available, 'isVisible', i.is_visible, 'isFeatured', i.is_featured,
               'sortOrder', i.sort_order)
               order by i.sort_order, i.created_at)
        from public.menu_items i where i.cafe_id = v_cafe), '[]'::jsonb)
  );
end $$;

/* ── Owner: categories ───────────────────────────────────────────────────── */

/** Create (p_id null, added last) or rename/show/hide a category. Raises invalid_input / conflict. */
create or replace function public.save_my_menu_category(
  p_slug text, p_id uuid, p_name text, p_is_visible boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  if p_id is null then
    if (select count(*) from public.menu_categories where cafe_id = v_cafe) >= 50 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_categories (cafe_id, name, is_visible, sort_order)
    values (v_cafe, v_name, coalesce(p_is_visible, true),
            coalesce((select max(sort_order) + 1 from public.menu_categories where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    update public.menu_categories
       set name = v_name, is_visible = coalesce(p_is_visible, is_visible), updated_at = now()
     where id = p_id and cafe_id = v_cafe returning id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

/** Deletes an EMPTY category (raises in_use while it has items). */
create or replace function public.delete_my_menu_category(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if exists (select 1 from public.menu_items where category_id = p_id and cafe_id = v_cafe) then
    raise exception 'in_use' using errcode = 'P0001';
  end if;
  delete from public.menu_categories where id = p_id and cafe_id = v_cafe;
end $$;

/** New order of ALL categories (raises stale_list when the list does not match). */
create or replace function public.reorder_my_menu_categories(p_slug text, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if (select array_agg(id order by id) from public.menu_categories where cafe_id = v_cafe)
     is distinct from (select array_agg(i order by i) from unnest(p_ids) i) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update public.menu_categories c set sort_order = o.ord - 1, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord)
   where c.id = o.id and c.cafe_id = v_cafe;
end $$;

/* ── Owner: items ────────────────────────────────────────────────────────── */

/**
 * Create (p_id null, added last in its category) or update an item. Moving to another category
 * puts it last there. Raises invalid_input (DETAIL = field) / forbidden.
 */
create or replace function public.save_my_menu_item(
  p_slug text, p_id uuid, p_category_id uuid, p_name text, p_description text, p_price numeric,
  p_image jsonb, p_tags text[], p_is_available boolean, p_is_visible boolean, p_is_featured boolean
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

  if p_id is null then
    if (select count(*) from public.menu_items where cafe_id = v_cafe) >= 500 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_items (cafe_id, category_id, name, description, price, image, tags,
                                   is_available, is_visible, is_featured, sort_order)
    values (v_cafe, p_category_id, v_name, v_desc, p_price, p_image, v_tags,
            coalesce(p_is_available, true), coalesce(p_is_visible, true), coalesce(p_is_featured, false),
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
           sort_order = case when v_old.category_id = p_category_id then sort_order
                             else coalesce((select max(sort_order) + 1 from public.menu_items
                                             where category_id = p_category_id), 0) end,
           updated_at = now()
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

/** Quick "Sold out" / "Available" switch. */
create or replace function public.set_my_menu_item_available(p_slug text, p_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  update public.menu_items set is_available = coalesce(p_available, true), updated_at = now()
   where id = p_id and cafe_id = v_cafe;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.delete_my_menu_item(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  delete from public.menu_items where id = p_id and cafe_id = v_cafe;
end $$;

/** New order of ALL items of one category (raises stale_list when the list does not match). */
create or replace function public.reorder_my_menu_items(p_slug text, p_category_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  if (select array_agg(id order by id) from public.menu_items
       where cafe_id = v_cafe and category_id = p_category_id)
     is distinct from (select array_agg(i order by i) from unnest(p_ids) i) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update public.menu_items m set sort_order = o.ord - 1, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord)
   where m.id = o.id and m.cafe_id = v_cafe;
end $$;

/**
 * Starter menu for an EMPTY menu (raises invalid_state otherwise), in the café's menu language.
 * Items come without prices → hidden from customers until the owner sets a price.
 */
create or replace function public.apply_my_menu_template(p_slug text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_locale text;
  v_cat uuid;
  r record;
begin
  if exists (select 1 from public.menu_categories where cafe_id = v_cafe) then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  select default_locale into v_locale from public.cafes where id = v_cafe;
  for r in
    select * from (values
      (1, 'Coffee', 'Café', 'القهوة',
          array['Espresso', 'Cappuccino', 'Latte'],
          array['Espresso', 'Cappuccino', 'Café latte'],
          array['إسبريسو', 'كابتشينو', 'لاتيه']),
      (2, 'Tea', 'Thé', 'الشاي',
          array['Mint tea', 'Green tea'],
          array['Thé à la menthe', 'Thé vert'],
          array['شاي بالنعناع', 'شاي أخضر']),
      (3, 'Pastries', 'Viennoiseries', 'المعجنات',
          array['Croissant', 'Pain au chocolat'],
          array['Croissant', 'Pain au chocolat'],
          array['كرواسون', 'خبز بالشوكولاتة']),
      (4, 'Cold drinks', 'Boissons fraîches', 'المشروبات الباردة',
          array['Fresh orange juice', 'Water'],
          array['Jus d''orange pressé', 'Eau minérale'],
          array['عصير برتقال طازج', 'ماء'])
    ) t(ord, en, fr, ar, items_en, items_fr, items_ar)
    order by ord
  loop
    insert into public.menu_categories (cafe_id, name, sort_order)
    values (v_cafe, case v_locale when 'fr' then r.fr when 'ar' then r.ar else r.en end, r.ord - 1)
    returning id into v_cat;
    insert into public.menu_items (cafe_id, category_id, name, sort_order)
    select v_cafe, v_cat, n, o - 1
      from unnest(case v_locale when 'fr' then r.items_fr when 'ar' then r.items_ar else r.items_en end)
           with ordinality as x(n, o);
  end loop;
end $$;

/* ── Public ──────────────────────────────────────────────────────────────── */

/**
 * Customer menu (anyone). Active cafés only (null otherwise). Visible categories with at least
 * one visible, PRICED item; sold-out items are included (shown greyed).
 */
create or replace function public.get_public_menu(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'currency', c.currency,
           'locale', c.default_locale,
           'categories', coalesce((
             select jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name, 'items', its.items)
                              order by mc.sort_order, mc.created_at)
               from public.menu_categories mc
               cross join lateral (
                 select jsonb_agg(jsonb_build_object(
                          'id', mi.id, 'name', mi.name, 'description', mi.description,
                          'price', mi.price, 'image', mi.image, 'tags', to_jsonb(mi.tags),
                          'isAvailable', mi.is_available, 'isFeatured', mi.is_featured)
                          order by mi.sort_order, mi.created_at) as items
                   from public.menu_items mi
                  where mi.category_id = mc.id and mi.is_visible and mi.price is not null
               ) its
              where mc.cafe_id = c.id and mc.is_visible and its.items is not null), '[]'::jsonb))
    from public.cafes c
   where c.slug = lower(btrim(coalesce(p_slug, ''))) and c.status = 'active';
$$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.check_menu_image(uuid, jsonb) from public;
revoke all on function public.get_my_menu(text) from public;
revoke all on function public.save_my_menu_category(text, uuid, text, boolean) from public;
revoke all on function public.delete_my_menu_category(text, uuid) from public;
revoke all on function public.reorder_my_menu_categories(text, uuid[]) from public;
revoke all on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean) from public;
revoke all on function public.set_my_menu_item_available(text, uuid, boolean) from public;
revoke all on function public.delete_my_menu_item(text, uuid) from public;
revoke all on function public.reorder_my_menu_items(text, uuid, uuid[]) from public;
revoke all on function public.apply_my_menu_template(text) from public;
revoke all on function public.get_public_menu(text) from public;

grant execute on function public.get_my_menu(text) to authenticated;
grant execute on function public.save_my_menu_category(text, uuid, text, boolean) to authenticated;
grant execute on function public.delete_my_menu_category(text, uuid) to authenticated;
grant execute on function public.reorder_my_menu_categories(text, uuid[]) to authenticated;
grant execute on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean) to authenticated;
grant execute on function public.set_my_menu_item_available(text, uuid, boolean) to authenticated;
grant execute on function public.delete_my_menu_item(text, uuid) to authenticated;
grant execute on function public.reorder_my_menu_items(text, uuid, uuid[]) to authenticated;
grant execute on function public.apply_my_menu_template(text) to authenticated;
grant execute on function public.get_public_menu(text) to anon, authenticated;

-- Languages.
--   · CONTENT languages (menu, website texts): 12 supported; EN/FR/AR are available to every café,
--     the others ("extras") only when the Serbi admin adds them to the café (extra_locales).
--   · cafes.locales = languages the café OFFERS (owner's choice among its available ones); its
--     main language (default_locale) is always included (trigger).
--   · Owners REQUEST extras (platform.language_requests) → admins are notified → approve/decline →
--     the owner is notified (decision e-mail comes with its template).
--   · Translations: i18n jsonb on menu categories/items {"en": {"name": "…", "description": "…"}};
--     website translations live inside the website document (draft/publish), validated by the app.

alter type platform.event_type add value if not exists 'language_requested';
alter type platform.event_type add value if not exists 'language_request_decided';

/* ── Catalogue ───────────────────────────────────────────────────────────── */

create or replace function platform.content_languages()
returns text[] language sql immutable set search_path = '' as $$
  select array['en','fr','ar','es','it','de','tr','pt','ru','zh','nl','ja']
$$;

create or replace function platform.base_languages()
returns text[] language sql immutable set search_path = '' as $$
  select array['en','fr','ar']
$$;

/* ── Café languages ──────────────────────────────────────────────────────── */

alter table public.cafes
  add column extra_locales text[] not null default '{}',
  add column locales text[] not null default '{en,fr,ar}';
alter table public.cafes
  add constraint cafes_extra_locales_check check (extra_locales <@ platform.content_languages()),
  add constraint cafes_locales_check check (locales <@ platform.content_languages());

/** Keeps the main language in the offered list (and the list without duplicates). */
create or replace function platform.cafe_locales_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not (new.default_locale = any (new.locales)) then
    new.locales := array_append(new.locales, new.default_locale);
  end if;
  new.locales := array(select distinct unnest(new.locales) order by 1);
  return new;
end $$;

create trigger cafes_locales_guard
  before insert or update of default_locale, locales on public.cafes
  for each row execute function platform.cafe_locales_guard();

update public.cafes set locales = locales; -- run the guard once on existing cafés

/** Languages offered by a café, main language first. */
create or replace function platform.offered_locales(p_main text, p_locales text[])
returns text[] language sql immutable set search_path = '' as $$
  select array[p_main] || coalesce(array(select l from unnest(p_locales) l where l <> p_main order by 1), '{}')
$$;

/* ── Language requests ───────────────────────────────────────────────────── */

create table platform.language_requests (
  id            uuid primary key default gen_random_uuid(),
  cafe_id       uuid not null references public.cafes (id) on delete cascade,
  locale        text not null check (locale = any (platform.content_languages())
                                     and not (locale = any (platform.base_languages()))),
  note          text not null default '' check (char_length(note) <= 300),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by  uuid references auth.users (id) on delete set null,
  decided_by    uuid references auth.users (id) on delete set null,
  decision_note text not null default '' check (char_length(decision_note) <= 300),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create unique index language_requests_pending_idx
  on platform.language_requests (cafe_id, locale) where status = 'pending';
alter table platform.language_requests enable row level security;
comment on table platform.language_requests is
  'Owner requests for extra content languages. RLS on, no policies: request_my_language / admin_* RPCs only.';

/* ── Translations ────────────────────────────────────────────────────────── */

alter table public.menu_categories add column i18n jsonb not null default '{}';
alter table public.menu_items add column i18n jsonb not null default '{}';

/**
 * Raises invalid_input (DETAIL = 'i18n') unless p is {locale: {field: text}} with supported
 * locales, only the given fields and texts within their maximum lengths.
 */
create or replace function platform.check_i18n(p jsonb, p_fields text[], p_max int[])
returns void language plpgsql immutable set search_path = '' as $$
declare
  l text;
  v jsonb;
  f text;
  i int;
begin
  if p is null then return; end if;
  if jsonb_typeof(p) <> 'object' or octet_length(p::text) > 32768 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'i18n';
  end if;
  for l, v in select * from jsonb_each(p) loop
    if not (l = any (platform.content_languages())) or jsonb_typeof(v) <> 'object' then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'i18n';
    end if;
    for f in select jsonb_object_keys(v) loop
      i := array_position(p_fields, f);
      if i is null or jsonb_typeof(v -> f) <> 'string' or char_length(v ->> f) > p_max[i] then
        raise exception 'invalid_input' using errcode = 'P0001', detail = 'i18n';
      end if;
    end loop;
  end loop;
end $$;

/* Category / item save: + p_i18n (NULL = keep the current translations). */

drop function public.save_my_menu_category(text, uuid, text, boolean);
create function public.save_my_menu_category(
  p_slug text, p_id uuid, p_name text, p_is_visible boolean, p_i18n jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'name';
  end if;
  perform platform.check_i18n(p_i18n, array['name'], array[60]);
  if p_id is null then
    if (select count(*) from public.menu_categories where cafe_id = v_cafe) >= 50 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_categories (cafe_id, name, is_visible, i18n, sort_order)
    values (v_cafe, v_name, coalesce(p_is_visible, true), coalesce(p_i18n, '{}'),
            coalesce((select max(sort_order) + 1 from public.menu_categories where cafe_id = v_cafe), 0))
    returning id into v_id;
  else
    update public.menu_categories
       set name = v_name, is_visible = coalesce(p_is_visible, is_visible),
           i18n = coalesce(p_i18n, i18n), updated_at = now()
     where id = p_id and cafe_id = v_cafe returning id into v_id;
    if v_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

drop function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean);
create function public.save_my_menu_item(
  p_slug text, p_id uuid, p_category_id uuid, p_name text, p_description text, p_price numeric,
  p_image jsonb, p_tags text[], p_is_available boolean, p_is_visible boolean, p_is_featured boolean,
  p_i18n jsonb default null
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

  if p_id is null then
    if (select count(*) from public.menu_items where cafe_id = v_cafe) >= 500 then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'limit';
    end if;
    insert into public.menu_items (cafe_id, category_id, name, description, price, image, tags,
                                   is_available, is_visible, is_featured, i18n, sort_order)
    values (v_cafe, p_category_id, v_name, v_desc, p_price, p_image, v_tags,
            coalesce(p_is_available, true), coalesce(p_is_visible, true), coalesce(p_is_featured, false),
            coalesce(p_i18n, '{}'),
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
               'sortOrder', i.sort_order, 'i18n', i.i18n)
               order by i.sort_order, i.created_at)
        from public.menu_items i where i.cafe_id = v_cafe), '[]'::jsonb)
  );
end $$;

/* Website: translations live in the document → allow a bigger document (4 languages+). */
create or replace function platform.check_website(p_cafe uuid, p_doc jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_types text[];
  v_bad int;
begin
  if p_doc is null or jsonb_typeof(p_doc) <> 'object'
     or octet_length(p_doc::text) > 262144
     or jsonb_typeof(p_doc -> 'hero') is distinct from 'object'
     or jsonb_typeof(p_doc -> 'sections') is distinct from 'array'
     or jsonb_typeof(p_doc -> 'footer') is distinct from 'object'
     or jsonb_array_length(p_doc -> 'sections') > 10
     or (p_doc ? 'i18n' and jsonb_typeof(p_doc -> 'i18n') <> 'object')
     or exists (select 1 from jsonb_object_keys(coalesce(p_doc -> 'i18n', '{}')) k
                 where not (k = any (platform.content_languages()))) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'website';
  end if;

  select array_agg(s ->> 'type') into v_types from jsonb_array_elements(p_doc -> 'sections') s;
  if exists (select 1 from unnest(coalesce(v_types, '{}')) t
              where t is null or t not in ('how_it_works', 'story', 'gallery', 'specialties'))
     or cardinality(coalesce(v_types, '{}')) <> (select count(distinct t) from unnest(coalesce(v_types, '{}')) t) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'website';
  end if;

  select count(*) into v_bad
    from jsonb_path_query(p_doc, 'strict $.**.path') p
   where jsonb_typeof(p) <> 'string' or not platform.check_media_path(p_cafe, p #>> '{}');
  if v_bad > 0 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'image';
  end if;
end $$;

/* ── Owner: languages ────────────────────────────────────────────────────── */

/** Main, offered and available languages of my café, plus my language requests. */
create or replace function public.get_my_languages(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  c public.cafes;
begin
  select * into c from public.cafes where id = v_cafe;
  return jsonb_build_object(
    'main', c.default_locale,
    'offered', to_jsonb(platform.offered_locales(c.default_locale, c.locales)),
    'available', to_jsonb(array(select distinct unnest(platform.base_languages() || c.extra_locales) order by 1)),
    'extras', to_jsonb(c.extra_locales),
    'supported', to_jsonb(platform.content_languages()),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'locale', r.locale, 'status', r.status, 'note', r.note,
               'decisionNote', r.decision_note, 'createdAt', r.created_at, 'decidedAt', r.decided_at)
               order by r.created_at desc)
        from platform.language_requests r where r.cafe_id = v_cafe), '[]'::jsonb)
  );
end $$;

/** Languages my café offers (any of its available ones; the main language is always kept). */
create or replace function public.set_my_languages(p_slug text, p_locales text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_available text[];
begin
  select platform.base_languages() || extra_locales into v_available from public.cafes where id = v_cafe;
  if p_locales is null or not (p_locales <@ v_available) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'locales';
  end if;
  update public.cafes set locales = p_locales, updated_at = now() where id = v_cafe;
end $$;

/** Asks Serbi for an extra language; notifies the admins. Raises invalid_input / conflict. */
create or replace function public.request_my_language(p_slug text, p_locale text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  c public.cafes;
  v_note text := btrim(coalesce(p_note, ''));
  v_id uuid;
  v_event uuid;
begin
  select * into c from public.cafes where id = v_cafe;
  if p_locale is null or not (p_locale = any (platform.content_languages()))
     or p_locale = any (platform.base_languages()) or p_locale = any (c.extra_locales) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'locale';
  end if;
  if char_length(v_note) > 300 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'note';
  end if;
  insert into platform.language_requests (cafe_id, locale, note, requested_by)
  values (v_cafe, p_locale, v_note, auth.uid())
  returning id into v_id; -- a second pending request for the same language → conflict (23505)

  insert into platform.events (type, subject_user_id, actor_user_id, payload)
  values ('language_requested', auth.uid(), auth.uid(),
          jsonb_build_object('cafe_slug', c.slug, 'cafe_name', c.name, 'locale', p_locale, 'request_id', v_id))
  returning id into v_event;
  insert into platform.notifications (recipient_user_id, type, event_id, data)
  select a.user_id, 'language_requested', v_event,
         jsonb_build_object('cafe_slug', c.slug, 'cafe_name', c.name, 'locale', p_locale,
                            'request_id', v_id, 'note', v_note)
    from platform.platform_admins a;
  return v_id;
end $$;

/* ── Admin: languages ────────────────────────────────────────────────────── */

create or replace function public.admin_list_language_requests(p_status text default 'pending')
returns table (id uuid, cafe_slug text, cafe_name text, locale text, note text, status text,
               decision_note text, owner_email text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.id, c.slug, c.name, r.locale, r.note, r.status, r.decision_note, u.email::text,
           r.created_at, r.decided_at
      from platform.language_requests r
      join public.cafes c on c.id = r.cafe_id
      left join auth.users u on u.id = r.requested_by
     where p_status is null or r.status = p_status
     order by r.created_at desc
     limit 500;
end $$;

/**
 * Approves (adds the language to the café's extras and turns it on) or declines a pending
 * request; notifies the owner. Raises invalid_status when it is no longer pending.
 */
create or replace function public.admin_decide_language_request(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r platform.language_requests;
  c public.cafes;
  v_event uuid;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_note) > 300 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'note';
  end if;
  select * into r from platform.language_requests where id = p_id for update;
  if r.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'invalid_status' using errcode = 'P0001'; end if;

  update platform.language_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_by = auth.uid(), decision_note = v_note, decided_at = now()
   where id = p_id;
  if p_approve then
    update public.cafes
       set extra_locales = array(select distinct unnest(extra_locales || r.locale) order by 1),
           locales = locales || r.locale, updated_at = now()
     where id = r.cafe_id;
  end if;

  select * into c from public.cafes where id = r.cafe_id;
  insert into platform.events (type, subject_user_id, actor_user_id, payload)
  values ('language_request_decided', r.requested_by, auth.uid(),
          jsonb_strip_nulls(jsonb_build_object('cafe_slug', c.slug, 'cafe_name', c.name, 'locale', r.locale,
                                               'approved', p_approve, 'note', nullif(v_note, ''))))
  returning id into v_event;
  if r.requested_by is not null then
    insert into platform.notifications (recipient_user_id, type, event_id, data)
    values (r.requested_by, 'language_request_decided', v_event,
            jsonb_strip_nulls(jsonb_build_object('cafe_slug', c.slug, 'cafe_name', c.name, 'locale', r.locale,
                                                 'approved', p_approve, 'note', nullif(v_note, ''))));
  end if;
end $$;

/** Café languages for the admin café page. */
create or replace function public.admin_get_cafe_languages(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.cafes;
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.cafes where slug = lower(btrim(coalesce(p_slug, '')));
  if c.id is null then return null; end if;
  return jsonb_build_object(
    'main', c.default_locale,
    'offered', to_jsonb(platform.offered_locales(c.default_locale, c.locales)),
    'extras', to_jsonb(c.extra_locales),
    'supported', to_jsonb(platform.content_languages()),
    'base', to_jsonb(platform.base_languages()));
end $$;

/** Sets a café's extra languages; removed extras are also removed from what it offers. */
create or replace function public.admin_set_cafe_extra_locales(p_slug text, p_locales text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_extras text[];
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_extras := array(select distinct l from unnest(coalesce(p_locales, '{}')) l
                     where not (l = any (platform.base_languages())) order by 1);
  if not (v_extras <@ platform.content_languages()) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'locales';
  end if;
  update public.cafes
     set extra_locales = v_extras,
         locales = array(select l from unnest(locales) l
                          where l = any (platform.base_languages() || v_extras) or l = default_locale),
         updated_at = now()
   where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

/* ── Public ──────────────────────────────────────────────────────────────── */

drop function public.get_public_cafe(text);
create function public.get_public_cafe(p_slug text)
returns table (
  slug text, name text, status text, theme jsonb, default_locale text, currency text,
  country_code text, city text, address text, latitude double precision, longitude double precision,
  phone text, contact_email text, facebook_url text, instagram_url text, website jsonb, locales text[]
)
language sql stable security definer set search_path = '' as $$
  select c.slug, c.name, c.status, c.theme, c.default_locale,
         case when c.status = 'active' then c.currency end,
         case when c.status = 'active' then c.country_code end,
         case when c.status = 'active' then c.city end,
         case when c.status = 'active' then c.address end,
         case when c.status = 'active' then c.latitude end,
         case when c.status = 'active' then c.longitude end,
         case when c.status = 'active' then c.phone end,
         case when c.status = 'active' then c.contact_email end,
         case when c.status = 'active' then c.facebook_url end,
         case when c.status = 'active' then c.instagram_url end,
         case when c.status = 'active' then w.published end,
         platform.offered_locales(c.default_locale, c.locales)
    from public.cafes c
    left join public.cafe_websites w on w.cafe_id = c.id
   where c.slug = lower(btrim(coalesce(p_slug, '')))
     and c.status in ('active', 'suspended');
$$;
comment on function public.get_public_cafe(text) is
  'Public café page data (anon). Customer-facing fields, the PUBLISHED website and the offered languages (main first); suspended cafés: name/status/theme/languages only.';

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
                          'isAvailable', mi.is_available, 'isFeatured', mi.is_featured, 'i18n', mi.i18n)
                          order by mi.sort_order, mi.created_at) as items
                   from public.menu_items mi
                  where mi.category_id = mc.id and mi.is_visible and mi.price is not null
               ) its
              where mc.cafe_id = c.id and mc.is_visible and its.items is not null), '[]'::jsonb))
    from public.cafes c
   where c.slug = lower(btrim(coalesce(p_slug, ''))) and c.status = 'active';
$$;

/* ── Grants ──────────────────────────────────────────────────────────────── */

revoke all on function platform.content_languages() from public;
revoke all on function platform.base_languages() from public;
revoke all on function platform.cafe_locales_guard() from public;
revoke all on function platform.offered_locales(text, text[]) from public;
revoke all on function platform.check_i18n(jsonb, text[], int[]) from public;
revoke all on function public.save_my_menu_category(text, uuid, text, boolean, jsonb) from public;
revoke all on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb) from public;
revoke all on function public.get_my_languages(text) from public;
revoke all on function public.set_my_languages(text, text[]) from public;
revoke all on function public.request_my_language(text, text, text) from public;
revoke all on function public.admin_list_language_requests(text) from public;
revoke all on function public.admin_decide_language_request(uuid, boolean, text) from public;
revoke all on function public.admin_get_cafe_languages(text) from public;
revoke all on function public.admin_set_cafe_extra_locales(text, text[]) from public;
revoke all on function public.get_public_cafe(text) from public;

grant execute on function public.save_my_menu_category(text, uuid, text, boolean, jsonb) to authenticated;
grant execute on function public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb) to authenticated;
grant execute on function public.get_my_languages(text) to authenticated;
grant execute on function public.set_my_languages(text, text[]) to authenticated;
grant execute on function public.request_my_language(text, text, text) to authenticated;
grant execute on function public.admin_list_language_requests(text) to authenticated;
grant execute on function public.admin_decide_language_request(uuid, boolean, text) to authenticated;
grant execute on function public.admin_get_cafe_languages(text) to authenticated;
grant execute on function public.admin_set_cafe_extra_locales(text, text[]) to authenticated;
grant execute on function public.get_public_cafe(text) to anon, authenticated;

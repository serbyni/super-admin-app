-- Café website (cafe-app landing page at <slug>.<root>/): sections the owner edits as a DRAFT and
-- then PUBLISHES. Customers only ever see the published document.
--
-- Document shape (validated in full by the app, zod `websiteSchema`; the DB checks structure, size
-- and that every image belongs to this café):
--   { "version": 1,
--     "hero":     { title, subtitle, badge?, image?: {path, alt}, highlights: [{icon, label}] },
--     "sections": [ { "type": "how_it_works" | "story" | "gallery", "enabled": bool, ... } ],  -- order = display order
--     "footer":   { "hours": [7 × {closed, open, close}] } }
-- Images live in Storage bucket `cafe-media` at <cafe_id>/website/<file>.

create table public.cafe_websites (
  cafe_id          uuid primary key references public.cafes (id) on delete cascade,
  draft            jsonb not null,
  published        jsonb,
  draft_updated_at timestamptz not null default now(),
  published_at     timestamptz,
  updated_by       uuid references auth.users (id) on delete set null
);

alter table public.cafe_websites enable row level security;
comment on table public.cafe_websites is
  'Café website (draft + published). RLS on, no policies: access only via get_my_website / save_my_website / publish_my_website / discard_my_website_draft and get_public_cafe (published only).';

/* ── Validation ──────────────────────────────────────────────────────────── */

/** Raises invalid_input (DETAIL = 'website') when the document is malformed. */
create or replace function platform.check_website(p_cafe uuid, p_doc jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_types text[];
  v_bad int;
begin
  if p_doc is null or jsonb_typeof(p_doc) <> 'object'
     or octet_length(p_doc::text) > 65536
     or jsonb_typeof(p_doc -> 'hero') is distinct from 'object'
     or jsonb_typeof(p_doc -> 'sections') is distinct from 'array'
     or jsonb_typeof(p_doc -> 'footer') is distinct from 'object'
     or jsonb_array_length(p_doc -> 'sections') > 10 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'website';
  end if;

  select array_agg(s ->> 'type') into v_types from jsonb_array_elements(p_doc -> 'sections') s;
  if exists (select 1 from unnest(coalesce(v_types, '{}')) t
              where t is null or t not in ('how_it_works', 'story', 'gallery'))
     or cardinality(coalesce(v_types, '{}')) <> (select count(distinct t) from unnest(coalesce(v_types, '{}')) t) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'website';
  end if;

  -- Every image must be a file of THIS café's website folder.
  select count(*) into v_bad
    from jsonb_path_query(p_doc, 'strict $.**.path') p
   where jsonb_typeof(p) <> 'string'
      or (p #>> '{}') !~ ('^' || p_cafe::text || '/website/[A-Za-z0-9_-]{1,64}\.(webp|jpe?g|png)$');
  if v_bad > 0 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'image';
  end if;
end $$;

/** Owner's café id for a slug (locks the café row), or raises not_authenticated / forbidden. */
create or replace function platform.owned_cafe(p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_cafe uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select c.id into v_cafe
    from public.cafes c
    join public.cafe_members m on m.cafe_id = c.id and m.user_id = uid and m.role = 'owner'
   where c.slug = lower(btrim(coalesce(p_slug, '')))
   for update of c;
  if v_cafe is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return v_cafe;
end $$;

/* ── Owner RPCs ──────────────────────────────────────────────────────────── */

/** Draft + published website of my café. No row = never edited (the app shows defaults). */
create or replace function public.get_my_website(p_slug text)
returns table (draft jsonb, published jsonb, draft_updated_at timestamptz, published_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  return query
    select w.draft, w.published, w.draft_updated_at, w.published_at
      from public.cafe_websites w where w.cafe_id = v_cafe;
end $$;

/** Saves the draft (not visible to customers). Returns the new draft_updated_at. */
create or replace function public.save_my_website(p_slug text, p_draft jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_at timestamptz := now();
begin
  perform platform.check_website(v_cafe, p_draft);
  insert into public.cafe_websites as w (cafe_id, draft, draft_updated_at, updated_by)
  values (v_cafe, p_draft, v_at, auth.uid())
  on conflict (cafe_id) do update
     set draft = excluded.draft, draft_updated_at = v_at, updated_by = excluded.updated_by;
  return v_at;
end $$;

/** Publishes the current draft. Raises invalid_state when there is nothing to publish. */
create or replace function public.publish_my_website(p_slug text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.owned_cafe(p_slug);
  v_at timestamptz := now();
  v_draft jsonb;
begin
  select w.draft into v_draft from public.cafe_websites w where w.cafe_id = v_cafe for update;
  if v_draft is null then raise exception 'invalid_state' using errcode = 'P0001'; end if;
  perform platform.check_website(v_cafe, v_draft);
  update public.cafe_websites
     set published = v_draft, published_at = v_at, updated_by = auth.uid()
   where cafe_id = v_cafe;
  return v_at;
end $$;

/** Drops unpublished changes (draft = published; never published → back to defaults). */
create or replace function public.discard_my_website_draft(p_slug text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cafe uuid := platform.owned_cafe(p_slug);
begin
  delete from public.cafe_websites where cafe_id = v_cafe and published is null;
  update public.cafe_websites
     set draft = published, draft_updated_at = now(), updated_by = auth.uid()
   where cafe_id = v_cafe and published is not null;
end $$;

revoke all on function platform.check_website(uuid, jsonb) from public;
revoke all on function platform.owned_cafe(text) from public;
revoke all on function public.get_my_website(text) from public;
revoke all on function public.save_my_website(text, jsonb) from public;
revoke all on function public.publish_my_website(text) from public;
revoke all on function public.discard_my_website_draft(text) from public;
grant execute on function public.get_my_website(text) to authenticated;
grant execute on function public.save_my_website(text, jsonb) to authenticated;
grant execute on function public.publish_my_website(text) to authenticated;
grant execute on function public.discard_my_website_draft(text) to authenticated;

/* ── Public café page: + published website ───────────────────────────────── */

drop function public.get_public_cafe(text);

create function public.get_public_cafe(p_slug text)
returns table (
  slug text, name text, status text, theme jsonb, default_locale text, currency text,
  country_code text, city text, address text, latitude double precision, longitude double precision,
  phone text, contact_email text, facebook_url text, instagram_url text, website jsonb
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
         case when c.status = 'active' then w.published end
    from public.cafes c
    left join public.cafe_websites w on w.cafe_id = c.id
   where c.slug = lower(btrim(coalesce(p_slug, '')))
     and c.status in ('active', 'suspended');
$$;

comment on function public.get_public_cafe(text) is
  'Public café page data (anon). Only customer-facing fields + the PUBLISHED website; suspended cafés: name/status/theme only.';

revoke all on function public.get_public_cafe(text) from public;
grant execute on function public.get_public_cafe(text) to anon, authenticated;

/* ── Storage: café media (website photos now, menu photos later) ─────────── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cafe-media', 'cafe-media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

/** True when the signed-in user owns the café whose id is the first folder of a Storage path. */
create or replace function public.owns_cafe_folder(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cafe_members m
     where m.user_id = auth.uid() and m.role = 'owner'
       and m.cafe_id::text = split_part(coalesce(p_name, ''), '/', 1)
  )
$$;
revoke all on function public.owns_cafe_folder(text) from public;
grant execute on function public.owns_cafe_folder(text) to authenticated;

-- Public bucket: files are readable by URL without a policy. These policies only let a café's owner
-- list/upload/replace/delete inside <cafe_id>/ (no anon listing).
create policy "cafe-media: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'cafe-media' and public.owns_cafe_folder(name));
create policy "cafe-media: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cafe-media' and public.owns_cafe_folder(name));
create policy "cafe-media: owner updates own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'cafe-media' and public.owns_cafe_folder(name))
  with check (bucket_id = 'cafe-media' and public.owns_cafe_folder(name));
create policy "cafe-media: owner deletes from own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cafe-media' and public.owns_cafe_folder(name));

-- Shared café media rule (website now, menu/branding later): files live in the café's own folder,
--   <cafe_id>/media/<sha256>.<webp|jpg>   (content-named, stored once per café, reused)
--   <cafe_id>/website/<name>.<ext>        (paths saved before the shared folder; still accepted)
-- Same rule as MEDIA_PATH in src/lib/media/config.ts.
create or replace function platform.check_media_path(p_cafe uuid, p_path text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_path, '') ~ (
    '^' || p_cafe::text ||
    '/(media/[0-9a-f]{64}\.(webp|jpg)|website/[A-Za-z0-9_-]{1,64}\.(webp|jpe?g|png))$'
  )
$$;
revoke all on function platform.check_media_path(uuid, text) from public;

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

  -- Every image must be a file of THIS café's media folder.
  select count(*) into v_bad
    from jsonb_path_query(p_doc, 'strict $.**.path') p
   where jsonb_typeof(p) <> 'string' or not platform.check_media_path(p_cafe, p #>> '{}');
  if v_bad > 0 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'image';
  end if;
end $$;

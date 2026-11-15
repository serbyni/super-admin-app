-- Order is managed by drag & drop in the admin list (admin_reorder_business_types).
-- Save without an explicit order: new types go to the end, edits keep their position.
drop function if exists public.admin_save_business_type(uuid, text, jsonb, text, int, boolean);

create or replace function public.admin_save_business_type(
  p_id uuid, p_slug text, p_name jsonb, p_icon text, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_id is null then
    insert into platform.business_types (slug, name, icon, sort_order, is_active, updated_by)
    values (p_slug, p_name, p_icon,
            coalesce((select max(sort_order) from platform.business_types), 0) + 10,
            p_is_active, auth.uid())
    returning id into rid;
  else
    update platform.business_types
       set slug = p_slug, name = p_name, icon = p_icon,
           is_active = p_is_active, updated_at = now(), updated_by = auth.uid()
     where id = p_id
    returning id into rid;
    if rid is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  return rid;
end $$;

-- Full new order: p_ids lists EVERY business type id, top to bottom.
create or replace function public.admin_reorder_business_types(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from platform.business_types) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from platform.business_types t where not (t.id = any (p_ids))) then
    raise exception 'stale_list' using errcode = 'P0001';
  end if;
  update platform.business_types t
     set sort_order = o.ord * 10, updated_at = now(), updated_by = auth.uid()
    from unnest(p_ids) with ordinality as o(id, ord)
   where t.id = o.id and t.sort_order is distinct from o.ord * 10;
end $$;

revoke all on function public.admin_save_business_type(uuid, text, jsonb, text, boolean) from public, anon;
revoke all on function public.admin_reorder_business_types(uuid[]) from public, anon;
grant execute on function public.admin_save_business_type(uuid, text, jsonb, text, boolean) to authenticated;
grant execute on function public.admin_reorder_business_types(uuid[]) to authenticated;

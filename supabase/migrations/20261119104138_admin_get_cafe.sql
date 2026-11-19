-- Super admin: one café's platform-side record (identity, location, settings, agreements, owner).
-- No café business data (menus, orders, customers) — those will never be readable by admins here.

create or replace function public.admin_get_cafe(p_slug text)
returns table (
  id uuid, slug text, name text, status text,
  country_code text, city text, address text, latitude double precision, longitude double precision,
  currency text, timezone text, default_locale text, theme jsonb,
  terms_version text, dpa_version text, agreed_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  owner_user_id uuid, owner_email text, owner_name text, owner_phone text,
  members_count integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select c.id, c.slug, c.name, c.status,
           c.country_code, c.city, c.address, c.latitude, c.longitude,
           c.currency, c.timezone, c.default_locale, c.theme,
           c.terms_version, c.dpa_version, c.agreed_at,
           c.created_at, c.updated_at,
           m.user_id, u.email::text, o.full_name, o.phone,
           (select count(*)::integer from public.cafe_members x where x.cafe_id = c.id)
      from public.cafes c
      left join public.cafe_members m on m.cafe_id = c.id and m.role = 'owner'
      left join auth.users u on u.id = m.user_id
      left join platform.owner_accounts o on o.user_id = m.user_id
     where c.slug = lower(btrim(p_slug));
end $$;

revoke all on function public.admin_get_cafe(text) from public, anon;
grant execute on function public.admin_get_cafe(text) to authenticated;

-- Public café page data (cafe-app: <slug>.serbi.me), readable by anyone incl. signed-out visitors.
-- Only what the café shows its customers. Never: owners, members, agreements, created_by.
-- Suspended cafés: only slug, name, status and theme (the page says "temporarily unavailable").
-- Unknown slug: no row.

create or replace function public.get_public_cafe(p_slug text)
returns table (
  slug text, name text, status text, theme jsonb, default_locale text, currency text,
  country_code text, city text, address text, latitude double precision, longitude double precision,
  phone text, contact_email text, facebook_url text, instagram_url text
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
         case when c.status = 'active' then c.instagram_url end
    from public.cafes c
   where c.slug = lower(btrim(coalesce(p_slug, '')))
     and c.status in ('active', 'suspended');
$$;

comment on function public.get_public_cafe(text) is
  'Public café page data (anon). Only customer-facing fields; suspended cafés: name/status/theme only.';

revoke all on function public.get_public_cafe(text) from public;
grant execute on function public.get_public_cafe(text) to anon, authenticated;

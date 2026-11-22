-- Slugs of the cafés the signed-in user is a member of (staff sign-in: where to land).
create or replace function public.get_my_cafe_slugs()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(c.slug order by c.name), '{}')
    from public.cafe_members m join public.cafes c on c.id = m.cafe_id
   where m.user_id = auth.uid()
$$;
revoke all on function public.get_my_cafe_slugs() from public;
grant execute on function public.get_my_cafe_slugs() to authenticated;

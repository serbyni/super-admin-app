-- Receipt e-mail is rendered in a route handler (React Email can't run in server actions):
-- the route finds the order by its secret token. Only accepted (or later) orders with an
-- e-mail and no receipt yet; mark_receipt_sent(order id) after the provider accepted it.
drop function public.receipt_order(uuid);
create function public.receipt_order(p_slug text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders; c public.cafes;
begin
  select ord.* into o from public.orders ord join public.cafes cf on cf.id = ord.cafe_id
   where ord.token = p_token and cf.slug = lower(btrim(coalesce(p_slug, '')));
  if o.id is null or o.customer_email is null or o.receipt_sent_at is not null
     or o.status not in ('accepted', 'preparing', 'ready', 'served') then
    return null;
  end if;
  select * into c from public.cafes where id = o.cafe_id;
  return platform.order_json(o, false) || jsonb_build_object(
    'orderId', o.id, 'email', o.customer_email, 'token', o.token,
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug, 'address', c.address, 'city', c.city,
                               'phone', c.phone, 'timezone', c.timezone, 'seed', c.theme ->> 'seed'));
end $$;
revoke all on function public.receipt_order(text, text) from public, anon, authenticated;
grant execute on function public.receipt_order(text, text) to service_role;

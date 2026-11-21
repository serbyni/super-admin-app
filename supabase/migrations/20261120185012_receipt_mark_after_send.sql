-- Receipt: read first, mark as sent only after the e-mail provider accepted it (a failed send
-- no longer uses up the receipt).
create or replace function public.receipt_order(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders; c public.cafes;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null or o.customer_email is null or o.receipt_sent_at is not null then return null; end if;
  select * into c from public.cafes where id = o.cafe_id;
  return platform.order_json(o, false) || jsonb_build_object(
    'email', o.customer_email, 'token', o.token,
    'cafe', jsonb_build_object('name', c.name, 'slug', c.slug, 'address', c.address, 'city', c.city,
                               'phone', c.phone, 'timezone', c.timezone, 'seed', c.theme ->> 'seed'));
end $$;

/** Marks the receipt sent; false when it already was (another send won). */
create or replace function public.mark_receipt_sent(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set receipt_sent_at = now() where id = p_order_id and receipt_sent_at is null;
  return found;
end $$;

revoke all on function public.mark_receipt_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_receipt_sent(uuid) to service_role;

-- Page statistics: per menu item / category / option and per table / QR code, for a period and
-- the previous period of the same length. Read-only, café members only, café time zone.
-- Declined/cancelled orders are never counted.

/** Period bounds (instants) of [from, to] and of the previous period of the same length. */
create or replace function platform.stats_bounds(p_cafe uuid, p_from date, p_to date,
  out lo timestamptz, out hi timestamptz, out plo timestamptz, out pfrom date, out pto date)
language plpgsql stable set search_path = '' as $$
declare v_tz text; v_days int;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 365 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'period';
  end if;
  select timezone into v_tz from public.cafes where id = p_cafe;
  v_days := p_to - p_from + 1;
  pfrom := p_from - v_days;
  pto := p_from - 1;
  lo := p_from::timestamp at time zone v_tz;
  hi := (p_to + 1)::timestamp at time zone v_tz;
  plo := pfrom::timestamp at time zone v_tz;
end $$;

create or replace function public.get_my_menu_stats(p_slug text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  b record;
  v_res jsonb;
begin
  select * into b from platform.stats_bounds(v_cafe, p_from, p_to);
  with li as (
    select l.item_id, l.quantity, l.line_total, l.options, o.created_at >= b.lo as cur
      from public.order_items l join public.orders o on o.id = l.order_id
     where o.cafe_id = v_cafe and o.created_at >= b.plo and o.created_at < b.hi
       and o.status not in ('declined', 'cancelled')
  ),
  per_item as (
    select item_id,
           coalesce(sum(quantity) filter (where cur), 0)::int as sold,
           coalesce(sum(line_total) filter (where cur), 0) as revenue,
           coalesce(sum(quantity) filter (where not cur), 0)::int as prev_sold,
           coalesce(sum(line_total) filter (where not cur), 0) as prev_revenue
      from li where item_id is not null group by item_id
  ),
  lines_cur as (select count(*) as n, item_id from li where cur and item_id is not null group by item_id),
  opts as (
    select li.item_id, ch ->> 'group' as grp, ch ->> 'choice' as choice, count(*)::int as n
      from li cross join lateral jsonb_array_elements(li.options) ch
     where li.cur and li.item_id is not null
     group by 1, 2, 3
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'previousFrom', b.pfrom, 'previousTo', b.pto,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('itemId', item_id, 'sold', sold, 'revenue', revenue,
                                                         'prevSold', prev_sold, 'prevRevenue', prev_revenue)), '[]'::jsonb)
                from per_item),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('categoryId', category_id, 'sold', sold, 'revenue', revenue)), '[]'::jsonb)
                     from (select mi.category_id, sum(p.sold)::int as sold, sum(p.revenue) as revenue
                             from per_item p join public.menu_items mi on mi.id = p.item_id
                            where p.sold > 0 group by mi.category_id) x),
    'options', (select coalesce(jsonb_agg(jsonb_build_object('itemId', o.item_id, 'group', o.grp, 'choice', o.choice,
                                                           'count', o.n, 'share', round(o.n::numeric / lc.n, 3))), '[]'::jsonb)
                  from opts o join lines_cur lc using (item_id)),
    'totals', (select jsonb_build_object('sold', coalesce(sum(quantity), 0)::int, 'revenue', coalesce(sum(line_total), 0),
                                         'items', count(distinct item_id)) from li where cur),
    'previous', (select jsonb_build_object('sold', coalesce(sum(quantity), 0)::int, 'revenue', coalesce(sum(line_total), 0),
                                           'items', count(distinct item_id)) from li where not cur)
  ) into v_res;
  return v_res;
end $$;

create or replace function public.get_my_table_stats(p_slug text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  b record;
  v_res jsonb;
begin
  select * into b from platform.stats_bounds(v_cafe, p_from, p_to);
  with o as (
    select table_id, kind, subtotal, created_at >= b.lo as cur
      from public.orders
     where cafe_id = v_cafe and created_at >= b.plo and created_at < b.hi
       and status not in ('declined', 'cancelled')
  ),
  -- Scans per code owner (table id, or null for the café menu code), retired codes included.
  sc as (
    select q.table_id, s.day, s.scans, s.day >= p_from as cur
      from public.qr_scans s join public.qr_codes q on q.code = s.code
     where s.cafe_id = v_cafe and s.day between b.pfrom and p_to
  ),
  days as (select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d)
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'previousFrom', b.pfrom, 'previousTo', b.pto,
    'tables', (select coalesce(jsonb_agg(jsonb_build_object(
        'tableId', t.id,
        'scans', (select coalesce(sum(scans), 0)::int from sc where sc.table_id = t.id and cur),
        'prevScans', (select coalesce(sum(scans), 0)::int from sc where sc.table_id = t.id and not cur),
        'orders', (select count(*) from o where o.table_id = t.id and cur),
        'prevOrders', (select count(*) from o where o.table_id = t.id and not cur),
        'revenue', (select coalesce(sum(subtotal), 0) from o where o.table_id = t.id and cur),
        'series', (select jsonb_agg((select coalesce(sum(scans), 0)::int from sc where sc.table_id = t.id and sc.day = d.day)
                                    order by d.day) from days d))), '[]'::jsonb)
        from public.cafe_tables t where t.cafe_id = v_cafe),
    'menu', jsonb_build_object(
        'scans', (select coalesce(sum(scans), 0)::int from sc where table_id is null and cur),
        'prevScans', (select coalesce(sum(scans), 0)::int from sc where table_id is null and not cur),
        'takeawayOrders', (select count(*) from o where kind = 'takeaway' and cur),
        'takeawayRevenue', (select coalesce(sum(subtotal), 0) from o where kind = 'takeaway' and cur)),
    'totals', jsonb_build_object(
        'scans', (select coalesce(sum(scans), 0)::int from sc where cur),
        'tableOrders', (select count(*) from o where kind = 'table' and cur),
        'orders', (select count(*) from o where cur),
        'revenue', (select coalesce(sum(subtotal), 0) from o where kind = 'table' and cur)),
    'previous', jsonb_build_object(
        'scans', (select coalesce(sum(scans), 0)::int from sc where not cur),
        'tableOrders', (select count(*) from o where kind = 'table' and not cur),
        'orders', (select count(*) from o where not cur),
        'revenue', (select coalesce(sum(subtotal), 0) from o where kind = 'table' and not cur))
  ) into v_res;
  return v_res;
end $$;

revoke all on function platform.stats_bounds(uuid, date, date) from public;
revoke all on function public.get_my_menu_stats(text, date, date) from public;
revoke all on function public.get_my_table_stats(text, date, date) from public;
grant execute on function public.get_my_menu_stats(text, date, date) to authenticated;
grant execute on function public.get_my_table_stats(text, date, date) to authenticated;

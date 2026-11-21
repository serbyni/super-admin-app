-- Dashboard statistics: one read-only function for the owner's dashboard home.
-- Days and hours are in the café's time zone. Declined/cancelled orders count only in their own
-- figures, never in orders/revenue.

create or replace function public.get_my_stats(p_slug text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cafe uuid := platform.member_cafe(p_slug);
  v_tz text;
  v_days int;
  v_pfrom date;
  v_pto date;
  v_hourly boolean;
  v_lo timestamptz;
  v_hi timestamptz;
  v_plo timestamptz;
  v_res jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 365 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'period';
  end if;
  select timezone into v_tz from public.cafes where id = v_cafe;
  v_days := p_to - p_from + 1;
  v_pto := p_from - 1;
  v_pfrom := p_from - v_days;
  v_hourly := v_days = 1;
  -- Period bounds as instants (start of day in café time).
  v_lo := p_from::timestamp at time zone v_tz;
  v_hi := (p_to + 1)::timestamp at time zone v_tz;
  v_plo := v_pfrom::timestamp at time zone v_tz;

  with o as (
    select o.*, (o.created_at at time zone v_tz) as local_at,
           o.status not in ('declined', 'cancelled') as counted
      from public.orders o
     where o.cafe_id = v_cafe and o.created_at >= v_lo and o.created_at < v_hi
  ),
  prev as (
    select o.subtotal, o.is_paid, o.status, o.status not in ('declined', 'cancelled') as counted
      from public.orders o
     where o.cafe_id = v_cafe and o.created_at >= v_plo and o.created_at < v_lo
  ),
  li as (
    select l.*, o.local_at from public.order_items l join o on o.id = l.order_id where o.counted
  ),
  buckets as (
    select b as at
      from generate_series(
             p_from::timestamp,
             case when v_hourly then p_from::timestamp + interval '23 hours' else p_to::timestamp end,
             case when v_hourly then interval '1 hour' else interval '1 day' end) b
  ),
  items as (
    select coalesce(li.item_id::text, li.name) as k,
           coalesce(max(mi.name), max(li.name)) as name,
           sum(li.quantity)::int as quantity,
           sum(li.line_total) as revenue
      from li left join public.menu_items mi on mi.id = li.item_id
     group by 1
  ),
  opts as (
    select coalesce(max(mi.name), max(li.name)) as item,
           ch ->> 'group' as grp, ch ->> 'choice' as choice,
           sum(li.quantity)::int as quantity,
           coalesce(li.item_id::text, li.name) as k
      from li
      left join public.menu_items mi on mi.id = li.item_id
      cross join lateral jsonb_array_elements(li.options) ch
     group by coalesce(li.item_id::text, li.name), ch ->> 'group', ch ->> 'choice'
  ),
  item_qty as (select k, quantity from items)
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'previousFrom', v_pfrom, 'previousTo', v_pto,
    'hourly', v_hourly,
    'today', (now() at time zone v_tz)::date,
    'totals', (select jsonb_build_object(
        'orders', count(*) filter (where counted),
        'revenue', coalesce(sum(subtotal) filter (where counted), 0),
        'paidRevenue', coalesce(sum(subtotal) filter (where counted and is_paid), 0),
        'unpaid', count(*) filter (where counted and not is_paid),
        'declined', count(*) filter (where status = 'declined'),
        'cancelled', count(*) filter (where status = 'cancelled')) from o),
    'previous', (select jsonb_build_object(
        'orders', count(*) filter (where counted),
        'revenue', coalesce(sum(subtotal) filter (where counted), 0),
        'paidRevenue', coalesce(sum(subtotal) filter (where counted and is_paid), 0),
        'unpaid', count(*) filter (where counted and not is_paid),
        'declined', count(*) filter (where status = 'declined'),
        'cancelled', count(*) filter (where status = 'cancelled')) from prev),
    'series', (select coalesce(jsonb_agg(jsonb_build_object(
          'at', case when v_hourly then to_char(b.at, 'HH24') else to_char(b.at, 'YYYY-MM-DD') end,
          'orders', (select count(*) from o
                      where o.counted and date_trunc(case when v_hourly then 'hour' else 'day' end, o.local_at) = b.at),
          'revenue', (select coalesce(sum(o.subtotal), 0) from o
                      where o.counted and date_trunc(case when v_hourly then 'hour' else 'day' end, o.local_at) = b.at))
        order by b.at), '[]'::jsonb) from buckets b),
    'topByQuantity', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'revenue', revenue)
                                              order by quantity desc, revenue desc, name), '[]'::jsonb)
                        from (select * from items order by quantity desc, revenue desc, name limit 8) x),
    'topByRevenue', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'revenue', revenue)
                                             order by revenue desc, quantity desc, name), '[]'::jsonb)
                       from (select * from items order by revenue desc, quantity desc, name limit 8) x),
    'topOptions', (select coalesce(jsonb_agg(jsonb_build_object('item', item, 'group', grp, 'choice', choice,
                                                              'quantity', quantity, 'share', share)
                                           order by quantity desc, item, choice), '[]'::jsonb)
                     from (select opts.*, round(opts.quantity::numeric / nullif(iq.quantity, 0), 3) as share
                             from opts join item_qty iq using (k)
                            order by opts.quantity desc, opts.item, opts.choice limit 8) x),
    'heatmap', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'hour', h, 'orders', n)), '[]'::jsonb)
                  from (select extract(isodow from local_at)::int - 1 as d, extract(hour from local_at)::int as h,
                               count(*)::int as n
                          from o where counted group by 1, 2) x),
    'channels', (select jsonb_build_object(
        'table', jsonb_build_object('orders', count(*) filter (where kind = 'table'),
                                    'revenue', coalesce(sum(subtotal) filter (where kind = 'table'), 0)),
        'takeaway', jsonb_build_object('orders', count(*) filter (where kind = 'takeaway'),
                                       'revenue', coalesce(sum(subtotal) filter (where kind = 'takeaway'), 0)))
        from o where counted),
    'topTables', (select coalesce(jsonb_agg(jsonb_build_object('label', table_label, 'orders', n, 'revenue', r)
                                          order by n desc, r desc, table_label), '[]'::jsonb)
                    from (select table_label, count(*)::int as n, sum(subtotal) as r
                            from o where counted and kind = 'table'
                           group by table_label order by n desc, r desc, table_label limit 5) x),
    'qrScans', (select coalesce(sum(s.scans), 0)::int from public.qr_scans s
                 where s.cafe_id = v_cafe and s.day between p_from and p_to),
    'timing', (select jsonb_build_object(
        'toAccept', round((percentile_cont(0.5) within group (order by extract(epoch from accepted_at - created_at))
                           filter (where accepted_at is not null) / 60)::numeric, 1),
        'toReady', round((percentile_cont(0.5) within group (order by extract(epoch from ready_at - accepted_at))
                          filter (where ready_at is not null and accepted_at is not null) / 60)::numeric, 1),
        'toServe', round((percentile_cont(0.5) within group (order by extract(epoch from served_at - ready_at))
                          filter (where served_at is not null and ready_at is not null) / 60)::numeric, 1))
        from o where counted)
  ) into v_res;
  return v_res;
end $$;

revoke all on function public.get_my_stats(text, date, date) from public;
grant execute on function public.get_my_stats(text, date, date) to authenticated;

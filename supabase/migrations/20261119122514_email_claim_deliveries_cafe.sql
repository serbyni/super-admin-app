-- "Your café is ready" email (cafe_created) needs the café name, its address (slug) and when
-- the event happened. Same columns as before + cafe_name, cafe_slug, event_at.
drop function public.email_claim_deliveries(integer, integer);

create function public.email_claim_deliveries(p_limit integer default 20, p_lease_seconds integer default 120)
returns table (
  delivery_id uuid, template text, attempts integer, recipient_email text, recipient_name text,
  business_name text, business_address text, locale text, reason text,
  submitted_at timestamptz, decided_at timestamptz,
  cafe_name text, cafe_slug text, event_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    with due as (
      select d.id
        from platform.email_deliveries d
       where d.status = 'pending' and d.next_attempt_at <= now()
         and (d.locked_until is null or d.locked_until < now())
       order by d.next_attempt_at
       limit least(greatest(coalesce(p_limit, 20), 1), 100)
       for update skip locked
    ), claimed as (
      update platform.email_deliveries d
         set locked_until = now() + make_interval(secs => p_lease_seconds),
             attempts = d.attempts + 1
        from due
       where d.id = due.id
      returning d.id, d.template, d.attempts, d.recipient_user_id, d.event_id
    )
    select c.id, c.template, c.attempts, u.email::text, a.full_name,
           coalesce(a.business_name, e.payload ->> 'business_name'),
           coalesce(a.formatted_address,
                    nullif(concat_ws(', ', a.street, nullif(concat_ws(' ', a.postal_code, a.city), '')), '')),
           coalesce(a.locale, 'en'),
           e.payload ->> 'reason',
           a.submitted_at,
           a.decided_at,
           e.payload ->> 'cafe_name',
           e.payload ->> 'cafe_slug',
           e.created_at
      from claimed c
      join auth.users u on u.id = c.recipient_user_id
      join platform.events e on e.id = c.event_id
      left join platform.owner_accounts a on a.user_id = c.recipient_user_id;
end $$;

revoke all on function public.email_claim_deliveries(integer, integer) from public, anon, authenticated;
grant execute on function public.email_claim_deliveries(integer, integer) to service_role;

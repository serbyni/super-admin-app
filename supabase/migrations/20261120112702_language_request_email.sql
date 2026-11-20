-- Language-request decision e-mail to the owner:
--   · email_claim_deliveries also returns the event payload (generic: new e-mails need no change here);
--   · admin_decide_language_request queues the 'language_request_decided' e-mail.
drop function public.email_claim_deliveries(integer, integer);

create function public.email_claim_deliveries(p_limit integer default 20, p_lease_seconds integer default 120)
returns table (
  delivery_id uuid, template text, attempts integer, recipient_email text, recipient_name text,
  business_name text, business_address text, locale text, reason text,
  submitted_at timestamptz, decided_at timestamptz,
  cafe_name text, cafe_slug text, event_at timestamptz, payload jsonb
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
           e.created_at,
           e.payload
      from claimed c
      join auth.users u on u.id = c.recipient_user_id
      join platform.events e on e.id = c.event_id
      left join platform.owner_accounts a on a.user_id = c.recipient_user_id;
end $$;

revoke all on function public.email_claim_deliveries(integer, integer) from public, anon, authenticated;
grant execute on function public.email_claim_deliveries(integer, integer) to service_role;

create or replace function public.admin_decide_language_request(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r platform.language_requests;
  c public.cafes;
  v_event uuid;
  v_note text := btrim(coalesce(p_note, ''));
  v_data jsonb;
begin
  if not platform.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_note) > 300 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'note';
  end if;
  select * into r from platform.language_requests where id = p_id for update;
  if r.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'invalid_status' using errcode = 'P0001'; end if;

  update platform.language_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_by = auth.uid(), decision_note = v_note, decided_at = now()
   where id = p_id;
  if p_approve then
    update public.cafes
       set extra_locales = array(select distinct unnest(extra_locales || r.locale) order by 1),
           locales = locales || r.locale, updated_at = now()
     where id = r.cafe_id;
  end if;

  select * into c from public.cafes where id = r.cafe_id;
  v_data := jsonb_strip_nulls(jsonb_build_object('cafe_slug', c.slug, 'cafe_name', c.name, 'locale', r.locale,
                                                 'approved', p_approve, 'note', nullif(v_note, '')));
  insert into platform.events (type, subject_user_id, actor_user_id, payload)
  values ('language_request_decided', r.requested_by, auth.uid(), v_data)
  returning id into v_event;
  if r.requested_by is not null then
    insert into platform.notifications (recipient_user_id, type, event_id, data)
    values (r.requested_by, 'language_request_decided', v_event, v_data);
    insert into platform.email_deliveries (event_id, template, recipient_user_id)
    values (v_event, 'language_request_decided', r.requested_by);
  end if;
end $$;

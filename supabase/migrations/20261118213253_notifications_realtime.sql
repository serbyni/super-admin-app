-- Real-time notifications (Supabase Realtime, private Broadcast channels).
-- Every new platform.notifications row is broadcast to the private topic
-- 'notifications:<recipient_user_id>'. Only that signed-in user may subscribe (policy below);
-- the platform schema stays unexposed.

create or replace function platform.broadcast_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id,
      'type', new.type::text,
      'data', new.data,
      'created_at', new.created_at
    ),
    'notification',                                  -- event
    'notifications:' || new.recipient_user_id::text, -- topic
    true                                             -- private channel
  );
  return new;
exception when others then
  -- Never block the business transaction (approval, sign-up) because of realtime.
  raise warning 'broadcast_notification failed: %', sqlerrm;
  return new;
end $$;
revoke all on function platform.broadcast_notification() from public, anon, authenticated;

drop trigger if exists on_notification_broadcast on platform.notifications;
create trigger on_notification_broadcast
  after insert on platform.notifications
  for each row execute function platform.broadcast_notification();

-- Signed-in users may receive Broadcast messages only on their own notifications topic.
drop policy if exists "receive own notifications" on realtime.messages;
create policy "receive own notifications"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'notifications:' || (select auth.uid())::text
  );

-- New super admins also get notified about applications that are still waiting.
create or replace function public.grant_platform_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into platform.platform_admins (user_id) values (p_user_id) on conflict do nothing;

  insert into platform.notifications (recipient_user_id, type, event_id, data, created_at)
  select p_user_id, e.type, e.id,
         jsonb_build_object('owner_user_id', a.user_id, 'business_name', a.business_name),
         e.created_at
    from platform.owner_accounts a
    join lateral (
      select ev.* from platform.events ev
       where ev.subject_user_id = a.user_id and ev.type = 'register_new_user'
       order by ev.created_at desc limit 1
    ) e on true
   where a.status = 'pending_approval'
     and not exists (
       select 1 from platform.notifications n
        where n.recipient_user_id = p_user_id and n.event_id = e.id
     );
end $$;
revoke all on function public.grant_platform_admin(uuid) from public, anon, authenticated;
grant execute on function public.grant_platform_admin(uuid) to service_role;

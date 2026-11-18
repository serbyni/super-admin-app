-- Applied to the remote project `serbi` on 2026-11-15 as version 20261115124627.
-- 2026-11-18: project moved to the new Supabase org (ref cjxlyomshhmnohrthbvm); all migrations
-- re-applied there with the same version numbers.
--
-- Supabase created public.rls_auto_enable() + event trigger `ensure_rls` at project setup
-- ("auto-enable RLS on new tables"). We keep that safety net, but the function was callable
-- by anon/authenticated through /rest/v1/rpc (advisor lints 0028/0029).
--
-- Locally (supabase db reset) the function does not exist yet, so we recreate it idempotently
-- to keep local and remote identical, then lock it down.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public') then
      begin
        select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
        execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (schema %)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$function$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
  end if;
end $$;

-- Not callable through the API; the event trigger fires regardless of EXECUTE grants.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- The new café site (sends the phone's position with table orders and table changes) is live:
-- a table order without a position is now refused (location_required).
create or replace function platform.gps_required()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function platform.gps_required() from public;

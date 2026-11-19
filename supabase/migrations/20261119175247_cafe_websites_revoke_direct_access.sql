-- Defense in depth: cafe_websites is RPC-only (RLS on, no policies). Also drop the default grants.
revoke all on table public.cafe_websites from anon, authenticated;

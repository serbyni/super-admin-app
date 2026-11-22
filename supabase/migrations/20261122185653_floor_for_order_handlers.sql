-- The orders board lists the café's tables to move an order: members who handle orders may read
-- the floor too (not only tables.read).
do $$
declare before text := pg_get_functiondef('public.get_my_floor(text)'::regprocedure); def text;
begin
  def := replace(before, 'platform.cafe_for(p_slug, ''tables.read'', true)', 'platform.cafe_for(p_slug, ''tables.read|orders.handle'', true)');
  if def = before then raise exception 'get_my_floor was not rewritten'; end if;
  execute def;
end $$;

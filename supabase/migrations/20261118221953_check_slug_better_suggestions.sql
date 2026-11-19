-- Suggestions: start from the business name when the typed value cannot be used at all
-- (format/reserved/blocked); avoid repeating "cafe" (cafe-cafe-lune, cafe-lune-cafe).
create or replace function public.check_slug(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a platform.owner_accounts;
  n text := platform.normalize_slug(p_slug);
  problem text;
  base text;
  city text;
  cand text;
  candidates text[];
  suggestions text[] := '{}';
begin
  a := platform.onboarding_owner();
  problem := platform.slug_problem(n, uid);
  if problem is null then
    return jsonb_build_object('normalized', n, 'available', true);
  end if;

  base := case when problem in ('taken', 'held') then n
               else coalesce(nullif(platform.normalize_slug(a.business_name), ''), 'my-cafe') end;
  base := btrim(left(base, 22), '-');
  city := left(platform.normalize_slug(a.city), 10);
  candidates := array[base, base || '-' || city];
  if base !~ '(^|-)(cafe|coffee)(-|$)' then
    candidates := candidates || array[base || '-cafe', 'cafe-' || base];
  end if;
  candidates := candidates || array[base || '-2', base || '-3', base || '-4'];

  foreach cand in array candidates loop
    cand := btrim(regexp_replace(cand, '-{2,}', '-', 'g'), '-');
    if cand <> n and platform.slug_problem(cand, uid) is null and not (cand = any (suggestions)) then
      suggestions := suggestions || cand;
    end if;
    exit when array_length(suggestions, 1) >= 3;
  end loop;

  return jsonb_build_object(
    'normalized', n, 'available', false, 'reason', problem, 'suggestions', to_jsonb(suggestions)
  );
end $$;
revoke all on function public.check_slug(text) from public, anon;
grant execute on function public.check_slug(text) to authenticated;

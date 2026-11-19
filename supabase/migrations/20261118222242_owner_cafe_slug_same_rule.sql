-- owner_accounts.cafe_slug must accept exactly the café address format (public.cafes.slug):
-- 3–30 chars, a–z 0–9 '-', may start with a digit, no leading/trailing '-', no '--'.
alter table platform.owner_accounts drop constraint if exists owner_accounts_cafe_slug_check;
alter table platform.owner_accounts
  add constraint owner_accounts_cafe_slug_check
  check (cafe_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' and cafe_slug !~ '--');

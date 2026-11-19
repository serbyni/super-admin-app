-- Pin search_path (advisor lint 0011) and keep the helper private.
alter function platform.owner_profile_complete(platform.owner_accounts) set search_path = '';
revoke all on function platform.owner_profile_complete(platform.owner_accounts) from public, anon, authenticated;
comment on table platform.owner_accounts is
  'Café-owner accounts (platform customers). RLS on with no policies by design: access only via security-definer functions (get_my_owner_status, complete_owner_profile, platform admin RPCs).';

-- Signed-in members only (Supabase grants new public functions to anon by default).
revoke execute on function public.i_can(uuid, text) from anon;
revoke execute on function public.get_my_access(text) from anon;
revoke execute on function public.get_my_cafe_slugs() from anon;
revoke execute on function public.get_my_roles(text) from anon;
revoke execute on function public.save_my_role(text, uuid, text, text, text[]) from anon;
revoke execute on function public.delete_my_role(text, uuid) from anon;
revoke execute on function public.reorder_my_roles(text, uuid[]) from anon;
revoke execute on function public.get_my_shifts(text) from anon;
revoke execute on function public.save_my_shift(text, uuid, text, int[], text, text) from anon;
revoke execute on function public.delete_my_shift(text, uuid) from anon;
revoke execute on function public.reorder_my_shifts(text, uuid[]) from anon;

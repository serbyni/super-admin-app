-- Access control, part 2: every café function checks a permission instead of "is the owner" /
-- "is a member". Each function is re-created from its current definition with only that call
-- changed (owned_cafe → cafe_for(…, lock), member_cafe → cafe_for(…)). The list below is the
-- checklist: function → permission ("a|b" = either).

do $$
declare
  r record;
  def text;
  before text;
begin
  for r in select * from (values
    ('public.apply_my_menu_template(text)',                     'menu.edit'),
    ('public.delete_my_area(text, uuid)',                       'tables.edit'),
    ('public.delete_my_menu_category(text, uuid)',              'menu.edit'),
    ('public.delete_my_menu_item(text, uuid)',                  'menu.edit'),
    ('public.delete_my_menu_tag(text, uuid)',                   'menu.edit'),
    ('public.delete_my_table(text, uuid)',                      'tables.edit'),
    ('public.discard_my_website_draft(text)',                   'website.edit'),
    ('public.get_my_floor(text)',                               'tables.read'),
    ('public.get_my_languages(text)',                           'menu.read|website.read|settings.languages'),
    ('public.get_my_menu(text)',                                'menu.read'),
    ('public.get_my_menu_stats(text, date, date)',              'menu.read'),
    ('public.get_my_orders(text, text, date)',                  'orders.read'),
    ('public.get_my_stats(text, date, date)',                   'dashboard.read|orders.read'),
    ('public.get_my_table_stats(text, date, date)',             'tables.read'),
    ('public.get_my_website(text)',                             'website.read'),
    ('public.move_my_order_table(text, uuid, uuid)',            'orders.handle'),
    ('public.publish_my_website(text)',                         'website.publish'),
    ('public.regenerate_my_qr_code(text, uuid)',                'tables.qr'),
    ('public.reorder_my_areas(text, uuid[])',                   'tables.edit'),
    ('public.reorder_my_menu_categories(text, uuid[])',         'menu.edit'),
    ('public.reorder_my_menu_items(text, uuid, uuid[])',        'menu.edit'),
    ('public.reorder_my_menu_tags(text, uuid[])',               'menu.edit'),
    ('public.request_my_language(text, text, text)',            'settings.languages'),
    ('public.save_my_area(text, uuid, text, numeric, numeric)', 'tables.edit'),
    ('public.save_my_layout(text, jsonb)',                      'tables.edit'),
    ('public.save_my_menu_category(text, uuid, text, boolean, jsonb, text)', 'menu.edit'),
    ('public.save_my_menu_item(text, uuid, uuid, text, text, numeric, jsonb, text[], boolean, boolean, boolean, jsonb, jsonb, uuid[])', 'menu.edit'),
    ('public.save_my_menu_tag(text, uuid, text, text, jsonb, boolean)', 'menu.edit'),
    ('public.save_my_push_subscription(text, text, text, text)', 'orders.read'),
    ('public.save_my_table(text, uuid, uuid, text, integer, text, boolean)', 'tables.edit'),
    ('public.save_my_website(text, jsonb)',                     'website.edit'),
    ('public.set_my_accepting_orders(text, boolean)',           'orders.settings'),
    ('public.set_my_languages(text, text[])',                   'settings.languages'),
    ('public.set_my_menu_display(text, text, text)',            'settings.display'),
    ('public.set_my_menu_item_available(text, uuid, boolean)',  'menu.availability|menu.edit'),
    ('public.set_my_opening_hours(text, jsonb)',                'settings.hours'),
    ('public.set_my_order_paid(text, uuid, boolean)',           'orders.handle'),
    ('public.set_my_order_radius(text, integer)',               'orders.settings'),
    ('public.set_my_order_status(text, uuid, text, text)',      'orders.handle')
  ) m(sig, perm) loop
    before := pg_get_functiondef(r.sig::regprocedure);
    def := replace(before, 'platform.owned_cafe(p_slug)', format('platform.cafe_for(p_slug, %L, true)', r.perm));
    def := replace(def, 'platform.member_cafe(p_slug)', format('platform.cafe_for(p_slug, %L)', r.perm));
    if def = before or def ~ 'platform\.(owned_cafe|member_cafe)\(' then
      raise exception 'access control: % was not rewritten', r.sig;
    end if;
    execute def;
  end loop;

  -- Café settings: inline owner check → settings.cafe.
  before := pg_get_functiondef('public.update_my_cafe(text, text, text, text, text, text, text, text, text, text, text, text, text)'::regprocedure);
  def := replace(before, 'm.user_id = uid and m.role = ''owner''',
                 'm.user_id = uid and platform.can(c.id, uid, ''settings.cafe'')');
  if def = before then raise exception 'access control: update_my_cafe was not rewritten'; end if;
  execute def;

  -- New-order / table-moved pushes: only members who may read orders now (role + shift).
  for r in select * from (values ('public.push_new_order_targets(text, text)'),
                                 ('public.push_table_moved_targets(text, text)')) m(sig) loop
    before := pg_get_functiondef(r.sig::regprocedure);
    def := replace(before, 's.cafe_id = o.cafe_id and s.kind = ''owner''',
                   's.cafe_id = o.cafe_id and s.kind = ''owner'' and platform.can(o.cafe_id, s.user_id, ''orders.read'')');
    if def = before then raise exception 'access control: % was not rewritten', r.sig; end if;
    execute def;
  end loop;
end $$;

-- Photo uploads (storage): members who may edit the menu, the website or the café settings.
create or replace function public.owns_cafe_folder(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cafe_members m
     where m.user_id = auth.uid()
       and m.cafe_id::text = split_part(coalesce(p_name, ''), '/', 1)
       and platform.can(m.cafe_id, m.user_id, 'menu.edit|website.edit|settings.cafe')
  )
$$;

-- Live orders (Realtime): members who may read orders now.
drop policy "cafe members receive their orders" on realtime.messages;
create policy "cafe members receive their orders" on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and exists (
      select 1 from public.cafe_members m
       where m.user_id = (select auth.uid())
         and realtime.topic() = 'orders:' || m.cafe_id::text
         and public.i_can(m.cafe_id, 'orders.read'))
  );

-- Nothing may still use the old checks.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'platform') and p.prokind = 'f'
       and p.proname not in ('owned_cafe', 'member_cafe')
       and pg_get_functiondef(p.oid) ~ 'platform\.(owned_cafe|member_cafe)\(') then
    raise exception 'access control: a function still calls owned_cafe/member_cafe';
  end if;
end $$;

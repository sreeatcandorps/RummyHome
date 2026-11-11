\pset pager off
select p.id as "uid", p.email as "email" from public.profiles p where p.email = 'user1@example.com' \gset
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'email', :'email', 'role', 'authenticated')::text, false);
\echo '################ V1 list_visible_game_ids REWRITE, email branch via existing lower(btrim(email)) partial index'
explain (analyze, buffers)
  select g.id from public.games g where g.created_by = auth.uid()
  union
  select gp.game_id from public.game_players gp where gp.profile_id = auth.uid() and gp.is_active
  union
  select gp.game_id from public.game_players gp
  join public.profiles p on p.id = gp.profile_id
  where gp.is_active and p.email is not null and p.managed_by is null
    and lower(btrim(p.email)) = lower(btrim(auth.jwt() ->> 'email'));
\echo '################ V2 rewrite WITHOUT the email branch (functionality change: seats matched by email only are not listed)'
explain (analyze, buffers)
  select g.id from public.games g where g.created_by = auth.uid()
  union
  select gp.game_id from public.game_players gp where gp.profile_id = auth.uid() and gp.is_active;
\echo '################ V3 full function call as shipped, for reference'
explain (analyze, buffers) select * from public.list_visible_game_ids();

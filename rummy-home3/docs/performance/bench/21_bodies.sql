\pset pager off
select p.id as "uid", p.email as "email" from public.profiles p where p.email = 'user1@example.com' \gset
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'email', :'email', 'role', 'authenticated')::text, false);

\echo '################ list_visible_game_ids BODY (as written in 006)'
explain (analyze, buffers)
  select g.id
  from public.games g
  where auth.uid() is not null
    and (
      g.created_by = auth.uid()
      or exists (
        select 1
        from public.game_players gp
        join public.profiles p on p.id = gp.profile_id
        where gp.game_id = g.id
          and gp.is_active = true
          and (
            gp.profile_id = auth.uid()
            or lower(p.email) = lower(auth.jwt() ->> 'email')
          )
      )
    );

\echo '################ list_visible_game_ids REWRITE (union, index-driven)'
explain (analyze, buffers)
  select g.id from public.games g where g.created_by = auth.uid()
  union
  select gp.game_id from public.game_players gp where gp.profile_id = auth.uid() and gp.is_active
  union
  select gp.game_id from public.game_players gp
  join public.profiles p on p.id = gp.profile_id
  where gp.is_active and lower(p.email) = lower(auth.jwt() ->> 'email');

\echo '################ list_new_game_candidates BODY (012)'
explain (analyze, buffers)
  with my_games as (
    select g.id, g.created_at from public.games g
    where g.created_by = auth.uid()
       or exists (select 1 from public.game_players a where a.game_id = g.id and a.profile_id = auth.uid() and a.role = 'game_admin')
  ),
  stats as (
    select gp.profile_id, count(*)::int as total_games, max(mg.created_at) as last_played_at
    from my_games mg join public.game_players gp on gp.game_id = mg.id
    where gp.profile_id <> auth.uid() and gp.role <> 'spectator' and coalesce(gp.seated, true)
    group by gp.profile_id
  ),
  everyone as (
    select s.profile_id, s.total_games, s.last_played_at from stats s
    union all
    select m.player_id, 0, null from public.my_players m
    where m.owner_id = auth.uid() and not exists (select 1 from stats s where s.profile_id = m.player_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit 100;

\echo '################ list_new_game_candidates REWRITE (my_games via union)'
explain (analyze, buffers)
  with my_games as (
    select g.id, g.created_at from public.games g where g.created_by = auth.uid()
    union
    select g.id, g.created_at from public.game_players a join public.games g on g.id = a.game_id
    where a.profile_id = auth.uid() and a.role = 'game_admin'
  ),
  stats as (
    select gp.profile_id, count(*)::int as total_games, max(mg.created_at) as last_played_at
    from my_games mg join public.game_players gp on gp.game_id = mg.id
    where gp.profile_id <> auth.uid() and gp.role <> 'spectator' and coalesce(gp.seated, true)
    group by gp.profile_id
  ),
  everyone as (
    select s.profile_id, s.total_games, s.last_played_at from stats s
    union all
    select m.player_id, 0, null from public.my_players m
    where m.owner_id = auth.uid() and not exists (select 1 from stats s where s.profile_id = m.player_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit 100;

\echo '################ list_game_results_page BODY (013): visibility filter over ALL results'
explain (analyze, buffers)
  select * from public.game_results gr
  where public.can_see_game_result(gr.id)
  order by gr.declared_at desc limit 5 offset 0;

\echo '################ list_game_results_page REWRITE: candidate results from my games first'
explain (analyze, buffers)
  with mine as (
    select r.id from public.game_results r where r.declared_by = auth.uid()
    union
    select grg.result_id from public.game_result_games grg
    join public.game_players gp on gp.game_id = grg.game_id and gp.profile_id = auth.uid() and gp.is_active
    union
    select grg.result_id from public.game_result_games grg
    join public.games g on g.id = grg.game_id and g.created_by = auth.uid()
  )
  select gr.* from public.game_results gr join mine on mine.id = gr.id
  order by gr.declared_at desc limit 5 offset 0;

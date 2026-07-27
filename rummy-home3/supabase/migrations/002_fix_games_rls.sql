-- Fix: creators must be able to read games they just created (RETURNING / .select()).
-- Also re-assert insert + membership policies used by New Game.

drop policy if exists "members read games" on public.games;
create policy "members read games"
on public.games for select
to authenticated
using (
  public.is_app_admin()
  or created_by = auth.uid()
  or public.is_game_member(id)
  or spectator_access = true
);

drop policy if exists "authenticated users create games" on public.games;
create policy "authenticated users create games"
on public.games for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "game admins update games" on public.games;
create policy "game admins update games"
on public.games for update
to authenticated
using (public.is_app_admin() or public.is_game_admin(id) or created_by = auth.uid())
with check (public.is_app_admin() or public.is_game_admin(id) or created_by = auth.uid());

drop policy if exists "members read game players" on public.game_players;
create policy "members read game players"
on public.game_players for select
to authenticated
using (
  public.is_app_admin()
  or public.is_game_member(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
);

drop policy if exists "game admins manage game players" on public.game_players;
create policy "game admins manage game players"
on public.game_players for all
to authenticated
using (
  public.is_app_admin()
  or public.is_game_admin(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
)
with check (
  public.is_app_admin()
  or public.is_game_admin(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
);

drop policy if exists "members read rounds" on public.rounds;
create policy "members read rounds"
on public.rounds for select
to authenticated
using (public.is_app_admin() or public.is_game_member(game_id));

drop policy if exists "game admins insert rounds" on public.rounds;
create policy "game admins insert rounds"
on public.rounds for insert
to authenticated
with check (public.is_app_admin() or public.is_game_admin(game_id));

drop policy if exists "game admins update rounds" on public.rounds;
create policy "game admins update rounds"
on public.rounds for update
to authenticated
using (public.is_app_admin() or public.is_game_admin(game_id))
with check (public.is_app_admin() or public.is_game_admin(game_id));

drop policy if exists "members read scores" on public.scores;
create policy "members read scores"
on public.scores for select
to authenticated
using (public.is_app_admin() or public.is_game_member(game_id));

drop policy if exists "game admins insert scores" on public.scores;
create policy "game admins insert scores"
on public.scores for insert
to authenticated
with check (public.is_app_admin() or public.is_game_admin(game_id));

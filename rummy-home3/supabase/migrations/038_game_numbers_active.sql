-- 038 (PR 5, D5.1 as Sree decided Nov 13): short game numbers are reused.
--
-- A game's label (S1 / P1, migration 028) only has to be unique among the ACTIVE games in the
-- creator's circle (the creator plus everyone in their My players list, created by or seated).
-- The moment a game leaves Active — Completed, Closed (part of a result) or Deleted — its number
-- is free again, so a new day starts at S1, S2, S3 again. Someone outside the circle can hold
-- their own S1 at the same time. The long id (uuid) and the share code stay unique forever.
--
-- 028 also blocked on Completed games; that is the only change here. Existing labels are not
-- touched (D5.2: the old S10s stay), a label still never changes (028 lock trigger), and the
-- assignment still runs under the 028 advisory lock. Rolled back by
-- supabase/rollback/rollback_038_game_numbers_active.sql (puts the 028 body back). Safe to re-run.
--
-- Flagged for Sree: a game that is Reopened (Completed → Active) keeps its own label even when a
-- newer active game has taken the same number, so two active games in one circle can briefly
-- share a label; both still have their own share code and date.

create or replace function public.next_game_number(p_creator uuid, p_prefix text)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with circle as (
    select p_creator as id
    union
    select m.player_id from public.my_players m where m.owner_id = p_creator and m.removed_at is null
  ),
  taken as (
    select distinct g.game_number
    from public.games g
    where g.game_label is not null
      and left(g.game_label, 1) = p_prefix
      and g.game_number is not null
      and g.deleted_at is null
      and g.closed_at is null
      and g.status = 'active'
      and (g.created_by in (select id from circle)
           or exists (select 1 from public.game_players gp
                      where gp.game_id = g.id and gp.is_active and gp.profile_id in (select id from circle)))
  )
  select min(n)::integer
  from generate_series(1, (select count(*) from taken) + 1) n
  where n not in (select game_number from taken);
$$;
revoke all on function public.next_game_number(uuid, text) from public, anon, authenticated;

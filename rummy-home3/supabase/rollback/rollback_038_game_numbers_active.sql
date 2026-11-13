-- Rollback for 038_game_numbers_active.sql: the 028 rule again (Completed games hold their
-- number until they are Closed or Deleted). Labels already assigned under 038 are not changed:
-- a label never changes (028 lock trigger), and nothing reads a label as unique.
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
      and g.status in ('active', 'completed')
      and (g.created_by in (select id from circle)
           or exists (select 1 from public.game_players gp
                      where gp.game_id = g.id and gp.is_active and gp.profile_id in (select id from circle)))
  )
  select min(n)::integer
  from generate_series(1, (select count(*) from taken) + 1) n
  where n not in (select game_number from taken);
$$;
revoke all on function public.next_game_number(uuid, text) from public, anon, authenticated;

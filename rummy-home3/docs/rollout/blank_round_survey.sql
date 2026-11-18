-- READ-ONLY: find live rounds that have no scores (the "blank round 6" symptom) so you know what the
-- in-app repair (Edit round on that round) needs to fix. Nothing here writes; 014 does not touch these
-- rows either — the next save of that round number reuses the empty row.
select r.game_id, g.game_number, r.round_number, r.created_at
  from public.rounds r
  join public.games g on g.id = r.game_id
 where r.undone_at is null
   and r.round_number < 1000
   and not exists (select 1 from public.scores s where s.round_id = r.id)
 order by r.created_at desc;

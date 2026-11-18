-- Rollback for 037_rummy_negative_share.sql: puts the "rummy >= 0" rule back for NEW rows.
-- Rounds already saved with a negative Rummy share are kept as they are (they balance to 0 and
-- the scorecard shows them correctly), so the constraint is added NOT VALID: it is enforced on
-- every insert and update from now on and never fails because of history. Safe to re-run.

alter table public.scores drop constraint if exists scores_check;
alter table public.scores add constraint scores_check check (
  (score_type in ('drop', 'middle_drop', 'count', 'expense') and value <= 0)
  or (score_type = 'rummy' and value >= 0)
) not valid;

notify pgrst, 'reload schema';

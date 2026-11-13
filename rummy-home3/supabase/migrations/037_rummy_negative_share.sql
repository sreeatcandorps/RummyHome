-- 037: Rummy share may be negative (PR 3 of the Nov 12 feedback plan; D3.1–D3.3 approved)
--
-- Rummy winners share whatever brings the round back to 0. When the other players add up to
-- a plus (someone typed +50, two drops of -10 → +30), the Rummy share is -30: the only way the
-- round balances. Until now the scores check constraint insisted a rummy row be >= 0, so such
-- a round could not be saved at all (the app showed Balance +30 and Save round stayed off).
--
-- Drop / middle drop / count / expense stay <= 0; rummy may now carry any sign. The sum-to-0
-- rule lives in save_round and is unchanged. Safe to re-run.

alter table public.scores drop constraint if exists scores_check;
alter table public.scores add constraint scores_check check (
  (score_type in ('drop', 'middle_drop', 'count', 'expense') and value <= 0)
  or score_type = 'rummy'
);

notify pgrst, 'reload schema';

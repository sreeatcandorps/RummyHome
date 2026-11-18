-- 006 public_scorecard: the 48-hex view token is the only secret. Anon reads the card with it
-- and nothing else; a wrong token returns null, not an error.
begin;
select plan(8);

-- grab the real token and the share code while still the owner
select set_config('tests.token', (select view_token from public.games where id = '10000000-0000-4000-8000-00000000000a'), true);
select set_config('tests.code', (select share_code from public.games where id = '10000000-0000-4000-8000-00000000000a'), true);

select tests.anon();
select is((select count(*) from public.games)::int, 0, 'anon cannot list games');
select is((select count(*) from public.scores)::int, 0, 'anon cannot read scores');
select ok((select public.public_scorecard(current_setting('tests.token'))) is not null, 'anon opens the scorecard with the right token');
select is((select public.public_scorecard(current_setting('tests.token')) ->> 'gameId'), current_setting('tests.code'), 'the card carries the 6-character game id');
select is(
  (select count(distinct s ->> 'round') from jsonb_array_elements(public.public_scorecard(current_setting('tests.token')) -> 'scores') s)::int,
  2, 'the card lists scores for the two live rounds only (the undone one is not shown)');
select ok(public.public_scorecard(repeat('a', 48)) is null, 'a wrong 48-hex token returns null');
select ok(public.public_scorecard(current_setting('tests.code')) is null, 'the 6-character game id is not a token');
select ok(public.public_scorecard('') is null, 'an empty token returns null');

select * from finish();
rollback;

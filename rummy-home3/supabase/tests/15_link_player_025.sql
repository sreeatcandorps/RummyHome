-- 025: Link to Player ID is a request. The organiser types only the Player ID; the server records
-- a pending link_request, queues a Yes/No email to the account owner and shows it in-app; nothing
-- moves until the owner says Yes (conflicts re-checked then). The conflict sentence names every
-- blocking game with its G-number, full game ID and creator. Requests can be cancelled and expire
-- after 7 days. On Yes the organiser gets a one-time "R K (RK) is now linked to #n." notice.
begin;
select plan(95);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set VIEWER '''00000000-0000-4000-8000-000000000004'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set COADMIN '''00000000-0000-4000-8000-000000000006'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set CD '''00000000-0000-4000-8000-0000000000a3'''

-- Player IDs are assigned by sequence; read them rather than guess.
create temp table t_no as
  select (select public_player_no from public.profiles where id = :PRIYA) as priya,
         (select public_player_no from public.profiles where id = :COADMIN) as coadmin,
         (select public_player_no from public.profiles where id = :OUTSIDER) as outsider,
         (select public_player_no from public.profiles where id = :VIEWER) as viewer,
         (select public_player_no from public.profiles where id = :RK) as rk;
grant select on t_no to authenticated, anon;

-- ---------- objects and grants ----------
select has_column('public', 'player_links', 'target_id', 'player_links.target_id (the account asked)');
select has_column('public', 'creator_notices', 'kind', 'creator_notices.kind (notice | linked)');
select has_function('public', 'link_player_check', array['uuid', 'bigint']);
select has_function('public', 'request_player_link', array['uuid', 'bigint']);
select has_function('public', 'cancel_player_link_request', array['uuid']);
select has_function('public', 'list_my_link_requests', array['uuid']);
select has_function('public', 'list_link_requests_for_me', array[]::text[]);
select has_function('public', 'answer_player_link_request', array['uuid', 'boolean']);
select has_function('public', 'answer_link_request_by_token', array['text', 'boolean']);
select hasnt_function('public', 'link_player_to_account', array['uuid', 'bigint', 'text'], 'the immediate-merge function is gone');
select hasnt_function('public', 'link_player_check', array['uuid', 'bigint', 'text'], 'the email parameter is gone');
select ok(has_function_privilege('authenticated', 'public.request_player_link(uuid, bigint)', 'execute'), 'signed-in accounts may send a request');
select ok(not has_function_privilege('anon', 'public.request_player_link(uuid, bigint)', 'execute'), 'anon may not');
select ok(has_function_privilege('anon', 'public.answer_link_request_by_token(text, boolean)', 'execute'), 'the email Yes/No works signed out (by token)');
select ok(has_function_privilege('anon', 'public.peek_link_request(text)', 'execute'), 'the email page can show the request (by token)');
select ok(not has_function_privilege('authenticated', 'public.perform_player_link(uuid)', 'execute'), 'the move itself is internal');
select ok(not has_function_privilege('authenticated', 'public.link_target_for(bigint)', 'execute'), 'the raw lookup is internal');
select is(public.link_request_days(), 7, 'requests stay open 7 days');

-- ---------- who may ask, and about whom ----------
select throws_like($$ select public.link_player_check('00000000-0000-4000-8000-0000000000a1', 1) $$, '%Sign in required%', 'anonymous: refused');
select tests.login(:HARISH);
select throws_like(format($$ select public.link_player_check(%L, (select coadmin from t_no)) $$, :RK), '%own unregistered players%', 'another organiser cannot link my player');
select tests.logout();
select tests.login(:SREE);
select throws_like(format($$ select public.link_player_check(%L, (select coadmin from t_no)) $$, :HARISH), '%own unregistered players%', 'a registered account is not linkable');
select throws_like(format($$ select public.link_player_check(%L, 999999) $$, :RK), '%No registered player has that Player ID%', 'unknown number');
select throws_like(format($$ select public.link_player_check(%L, (select rk from t_no)) $$, :RK), '%No registered player has that Player ID%', 'an unregistered player''s own number is not a registered account');
select throws_like(format($$ select public.link_player_check(%L, null) $$, :RK), '%Type the Player ID%', 'no number: refused');
select is((select public.link_player_check(:RK, (select outsider from t_no))->'target'->>'name'), 'Otto Outsider', 'the preview names the account from the number alone');
select is((select public.link_player_check(:RK, (select outsider from t_no))->'pending'), 'null'::jsonb, 'no request open yet');

-- ---------- conflicts: every game, the full sentence ----------
create temp table t_clash as select public.link_player_check(:RK, (select priya from t_no)) as r;
grant select on t_clash to authenticated, anon;
select is((select r->'conflicts'->0->>'gameId' from t_clash), '10000000-0000-4000-8000-00000000000a', 'priya already plays in A with rk: A is a conflict');
select is((select r->'conflicts'->0->>'creatorName' from t_clash), 'Sree Test', 'the conflict carries the creator name');
select is((select r->>'conflictMessage' from t_clash),
  format('Can''t link yet. G1 (game ID 10000000-0000-4000-8000-00000000000a, creator Sree Test) has both R K and #%s. In that game, clear one of their scores to zero and remove them from the game first.', (select priya from t_no)),
  'the sentence names the G-number, the full game ID, the creator, both players, and what to do');
select throws_like(format($$ select public.request_player_link(%L, (select priya from t_no)) $$, :RK), 'Can''t link yet. G1 (game ID 10000000-0000-4000-8000-00000000000a, creator Sree Test) has both R K and #%', 'sending a request onto a conflict is refused with the same sentence');
select is((select count(*)::int from public.player_links where player_id = :RK and kind = 'link_request'), 0, 'no request row was written');
select is((select profile_id from public.game_players where game_id = :A and profile_id = :RK), :RK::uuid, 'nothing moved');
select is((select public.link_player_check(:RK, (select viewer from t_no))->>'conflictMessage'), null, 'a viewer of A is not a conflict (they would take the seat)');
select is((select public.link_player_check(:RK, (select coadmin from t_no))->>'conflictMessage'), null, 'a non-playing admin of A is not a conflict');

-- ---------- the request: rk -> coadmin ----------
create temp table t_req as select public.request_player_link(:RK, (select coadmin from t_no)) as r;
grant select on t_req to authenticated, anon;
select is((select r->'target'->>'id' from t_req), :COADMIN, 'the answer names the account');
select is((select r->>'emailQueued' from t_req), 'true', 'an email was queued for the account owner');
select ok((select (r->>'expiresAt')::timestamptz between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from t_req), 'the request expires in 7 days');
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_req)), 'pending', 'a pending link_request row');
select is((select kind from public.player_links where id = (select (r->>'linkId')::uuid from t_req)), 'link_request');
select is((select target_id from public.player_links where id = (select (r->>'linkId')::uuid from t_req)), :COADMIN::uuid, 'aimed at the account');
select is((select player_status from public.profiles where id = :RK), 'pending', 'rk shows as pending (Link pending in the app)');
select is((select profile_id from public.game_players where game_id = :A and player_order = 2), :RK::uuid, 'NOTHING moved: rk still holds seat 2 of A');
select is((select count(*)::int from public.scores where game_id = :A and profile_id = :RK), 2, 'rk''s scores are still rk''s');
select is((select (r->>'pending') is not null from (select public.link_player_check(:RK, (select coadmin from t_no)) as r) x), true, 'check now reports the open request');
select is((select count(*)::int from public.list_my_link_requests()), 1, 'sree sees her open request');
select is((select target_name from public.list_my_link_requests() limit 1), 'Cora Coadmin', 'with the account''s name');
select tests.logout();
select isnt((select token_hash from public.player_links where id = (select (r->>'linkId')::uuid from t_req)), null, 'a hashed single-use token for the email link (never readable through the API)');
select is((select count(*)::int from public.email_outbox where kind = 'link_request' and to_email = 'coadmin@test.local'), 1, 'one outbox row to the account''s email');
select ok((select payload->>'yesUrl' like 'https://ezscore.mindweavetech.com/link.html?t=%&a=yes' from public.email_outbox where kind = 'link_request'), 'the Yes link points at the share site with the raw token');
select is((select payload->>'playerNo' from public.email_outbox where kind = 'link_request'), (select coadmin::text from t_no), 'the email names the Player ID being linked to');
select is((select payload->>'requesterName' from public.email_outbox where kind = 'link_request'), 'Sree Test', 'and who asked');
select tests.login(:HARISH);
select is((select count(*)::int from public.list_my_link_requests(:A)), 1, 'another member of A sees the open request for its row (Link pending)');
select throws_like(format($$ select public.cancel_player_link_request(%L) $$, (select r->>'linkId' from t_req)), '%not yours to cancel%', 'only the organiser cancels');
select throws_like(format($$ select public.answer_player_link_request(%L, true) $$, (select r->>'linkId' from t_req)), '%for another account%', 'only the account asked can answer');
select tests.logout();
select tests.login(:OUTSIDER);
select is((select count(*)::int from public.list_my_link_requests(:A)), 0, 'a stranger to A sees nothing');
select is((select count(*)::int from public.list_link_requests_for_me()), 0, 'and has no requests waiting');
select tests.logout();

-- ---------- a second send replaces the first; cancel ----------
select tests.login(:SREE);
create temp table t_req2 as select public.request_player_link(:RK, (select coadmin from t_no)) as r;
grant select on t_req2 to authenticated, anon;
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_req)), 'cancelled', 'sending again cancels the earlier request');
select tests.logout();
select is((select count(*)::int from public.email_outbox where kind = 'link_request'), 1, 'and its unsent email is dropped: one row stays');
select tests.login(:SREE);
select lives_ok(format($$ select public.cancel_player_link_request(%L) $$, (select r->>'linkId' from t_req2)), 'the organiser cancels');
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_req2)), 'cancelled');
select is((select player_status from public.profiles where id = :RK), 'unregistered', 'rk is unregistered again');
select tests.logout();
select is((select count(*)::int from public.email_outbox where kind = 'link_request'), 0, 'the unsent email went with it');

-- ---------- the account owner: in-app list, conflict re-checked at Yes ----------
select tests.login(:SREE);
create temp table t_req3 as select public.request_player_link(:RK, (select coadmin from t_no)) as r;
grant select on t_req3 to authenticated, anon;
select tests.logout();
select tests.login(:COADMIN);
select is((select count(*)::int from public.list_link_requests_for_me()), 1, 'coadmin sees the request waiting for her');
select is((select owner_name from public.list_link_requests_for_me()), 'Sree Test', 'who asked');
select is((select player_initials from public.list_link_requests_for_me()), 'RK', 'with the player''s initials');
select is(jsonb_array_length(public.get_home_bundle(50)->'link_requests'), 1, 'the Home bundle carries it');
select tests.logout();
-- Make a conflict appear after the request was sent: coadmin takes a seat in A.
update public.game_players set seated = true, role = 'player' where game_id = :A and profile_id = :COADMIN;
select tests.login(:COADMIN);
select alike((select conflict_message from public.list_link_requests_for_me()), 'Can''t link yet. G1 (game ID 10000000-0000-4000-8000-00000000000a, creator Sree Test) has both R K and #%', 'the card can say why Yes would fail');
select throws_like(format($$ select public.answer_player_link_request(%L, true) $$, (select r->>'linkId' from t_req3)), 'Can''t link yet. G1 (game ID%', 'Yes re-runs the conflict check and refuses');
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_req3)), 'pending', 'the request stays open');
select tests.logout();
update public.game_players set seated = false, role = 'game_admin' where game_id = :A and profile_id = :COADMIN;

-- ---------- Yes from the email (by token), signed out ----------
update public.player_links set token_hash = encode(digest('test-token-for-025-aaaaaaaaaa', 'sha256'), 'hex') where id = (select (r->>'linkId')::uuid from t_req3);
select tests.anon();
select is((select public.peek_link_request('test-token-for-025-aaaaaaaaaa')->>'requesterName'), 'Sree Test', 'the page shows who asked');
select is((select public.peek_link_request('wrong-token-xxxxxxxxxxxxxxxxx')), null, 'a wrong token shows nothing');
select is((select public.answer_link_request_by_token('wrong-token-xxxxxxxxxxxxxxxxx', true)->>'ok'), 'false', 'a wrong token does nothing');
create temp table t_yes as select public.answer_link_request_by_token('test-token-for-025-aaaaaaaaaa', true) as r;
select is((select r->>'accepted' from t_yes), 'true', 'Yes by token accepted');
select is((select r->'movedGameIds' from t_yes), to_jsonb(array[:A::uuid]), 'A moved');
select tests.logout();
select is((select count(*)::int from public.game_players where game_id = :A and profile_id = :COADMIN), 1, 'one membership for coadmin in A');
select is((select role from public.game_players where game_id = :A and profile_id = :COADMIN), 'game_admin', 'coadmin keeps the admin role');
select is((select seated from public.game_players where game_id = :A and profile_id = :COADMIN), true, 'and is seated now');
select is((select count(*)::int from public.game_players where profile_id = :RK), 0, 'rk has no seats left');
select is((select value from public.scores where round_id = '30000000-0000-4000-8000-0000000000a1' and profile_id = :COADMIN), 30, 'rk''s round-1 rummy score is coadmin''s');
select is((select player_status from public.profiles where id = :RK), 'merged', 'rk is merged');
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_req3)), 'claimed', 'the request is the claimed link row (unlink_player can undo it)');
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :COADMIN), 1, 'sree''s My players: coadmin added with the moved game');
select is((select count(*)::int from public.my_players where owner_id = :SREE and player_id = :RK), 0, 'and rk left the list');
select is((select text from public.creator_notices where owner_id = :SREE and kind = 'linked'), format('R K (RK) is now linked to #%s.', (select coadmin from t_no)), 'the organiser''s one-time pop-up text');
select is((select public.answer_link_request_by_token('test-token-for-025-aaaaaaaaaa', true)->>'ok'), 'false', 'the token is single use');
select tests.login(:SREE);
select is((select kind from public.take_creator_notices() where text like '% is now linked to #%'), 'linked', 'take_creator_notices hands the kind to the app');
select lives_ok(format($$ select public.unlink_player(%L) $$, (select r->>'linkId' from t_req3)), '011 unlink_player accepts the claimed request row');
select is((select profile_id from public.game_players where game_id = :A and player_order = 2), :RK::uuid, 'rk is back in seat 2 of A');
select tests.logout();

-- ---------- No in the app; expiry ----------
select tests.login(:SREE);
create temp table t_cd as select public.request_player_link(:CD, (select outsider from t_no)) as r;
grant select on t_cd to authenticated, anon;
select tests.logout();
select tests.login(:OUTSIDER);
select is((select (public.answer_player_link_request((select (r->>'linkId')::uuid from t_cd), false))->>'accepted'), 'false', 'the account says No');
select tests.logout();
select is((select player_status from public.profiles where id = :CD), 'unregistered', 'cd is unregistered again; nothing moved');
select is((select text from public.creator_notices where owner_id = :SREE and player_id = :CD and text like '%said No%'),
  format('Otto Outsider (#%s) said No to linking C D. C D is still unregistered.', (select outsider from t_no)), 'the organiser is told');
select tests.login(:SREE);
create temp table t_cd2 as select public.request_player_link(:CD, (select outsider from t_no)) as r;
grant select on t_cd2 to authenticated, anon;
select tests.logout();
update public.player_links set expires_at = now() - interval '1 second' where id = (select (r->>'linkId')::uuid from t_cd2);
select tests.login(:OUTSIDER);
select is((select count(*)::int from public.list_link_requests_for_me()), 0, 'an expired request is not offered');
select tests.logout();
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_cd2)), 'expired', 'and is marked expired');
select is((select player_status from public.profiles where id = :CD), 'unregistered', 'cd is unregistered again');
select alike((select text from public.creator_notices where owner_id = :SREE and player_id = :CD and text like '%not answered%'), 'C D: the link request to #% was not answered in 7 days. C D is unregistered again.', 'the organiser is told once');

select * from finish();
rollback;

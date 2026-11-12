-- Rollback 028: drops the label column, the numbering helpers and the labels on link requests,
-- puts back the 009 per-creator trigger body and the 023/024/025 reader bodies. Games keep the
-- game_number they have (009's rule, max per creator + 1, continues from there). Safe to re-run.

drop trigger if exists games_lock_label on public.games;
drop function if exists public.lock_game_label();
drop trigger if exists player_links_fill_labels on public.player_links;
drop function if exists public.player_links_fill_labels();
drop function if exists public.game_labels_for(uuid);
drop function if exists public.next_game_number(uuid, text);
drop function if exists public.link_conflicts_detail(uuid, uuid);
drop function if exists public.list_my_link_requests_v2(uuid);
drop function if exists public.list_link_requests_for_me_v2();

-- 009 body
create or replace function public.assign_game_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_num integer;
begin
  select coalesce(max(game_number), 0) + 1
  into next_num
  from public.games
  where created_by = new.created_by;

  new.game_number := next_num;
  return new;
end;
$$;

drop trigger if exists games_assign_number on public.games;
create trigger games_assign_number
before insert on public.games
for each row
when (new.game_number is null)
execute function public.assign_game_number();

-- 023 / 024 bodies
create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  select case
    when auth.uid() is null then null
    when exists (select 1 from public.game_results r where r.id = p_id and r.deleted_at is not null)
         and (public.is_app_admin()
              or exists (select 1 from public.game_results r where r.id = p_id and (r.declared_by = auth.uid() or r.deleted_by = auth.uid()))
              or exists (select 1 from public.game_result_games grg where grg.result_id = p_id and public.is_game_member(grg.game_id))
              or exists (select 1 from public.game_result_games grg join public.games g on g.id = grg.game_id where grg.result_id = p_id and g.created_by = auth.uid()))
      then (select jsonb_build_object('id', r.id, 'deleted', true, 'deletedAt', r.deleted_at, 'declaredAt', r.declared_at,
                                      'canRestore', r.deleted_by = auth.uid() or public.can_manage_result(r.id))
            from public.game_results r where r.id = p_id)
    when not public.can_see_game_result(p_id) then null
    else (
      select jsonb_build_object(
        'id', r.id,
        'declaredAt', r.declared_at,
        'declaredBy', r.declared_by,
        'gameIds', coalesce((
          select jsonb_agg(g.game_id)
          from public.game_result_games g
          where g.result_id = r.id and g.removed_at is null
        ), '[]'::jsonb),
        'removedGameIds', coalesce((
          select jsonb_agg(g.game_id)
          from public.game_result_games g
          where g.result_id = r.id and g.removed_at is not null
        ), '[]'::jsonb),
        'reusedGameIds', public.reused_game_ids(r.id),
        'canManage', public.can_manage_result(r.id),
        'standings', coalesce(pl->'standings', '[]'::jsonb),
        'sheet', jsonb_build_object(
          'players', coalesce((
            select jsonb_agg(
              e || jsonb_build_object('playerNo', pr.public_player_no)
              order by t.ord)
            from jsonb_array_elements(coalesce(pl->'players', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.profiles pr on pr.id::text = t.e->>'id'
          ), '[]'::jsonb),
          'games', coalesce((
            select jsonb_agg(
              e
              || case when g.game_number is not null then jsonb_build_object('label', 'G' || g.game_number::text) else '{}'::jsonb end
              || case when g.id is not null and public.can_read_game(g.id)
                      then jsonb_build_object('rounds', public.game_rounds_json(g.id, e->'scores'))
                      else '{}'::jsonb end
              order by t.ord)
            from jsonb_array_elements(coalesce(pl->'games', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.games g on g.id::text = t.e->>'id'
          ), '[]'::jsonb)
        )
      )
      from public.game_results r, lateral (select public.result_places_json(r.id) as pl) x
      where r.id = p_id
    )
  end;
$$;

create or replace function public.list_hidden_and_deleted()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'hidden', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'hiddenAt', h.hidden_at,
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)))
                       order by h.hidden_at desc)
      from public.hidden_games h join public.games g on g.id = h.game_id left join public.profiles p on p.id = g.created_by
      where h.owner_id = auth.uid() and g.deleted_at is null
    ), '[]'::jsonb),
    'deletedGames', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'deletedAt', g.deleted_at,
                                          'deletedByMe', g.deleted_by = auth.uid(),
                                          'deletedByName', coalesce(nullif(d.display_name, ''), 'Rummy Player'),
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)),
                                          'removedFromResults', (select count(*) from public.game_result_games grg join public.game_results r on r.id = grg.result_id where grg.game_id = g.id and grg.removed_at is not null and r.deleted_at is null))
                       order by g.deleted_at desc)
      from public.games g left join public.profiles p on p.id = g.created_by left join public.profiles d on d.id = g.deleted_by
      where g.deleted_at is not null and (g.deleted_by = auth.uid() or public.can_manage_game(g.id))
    ), '[]'::jsonb),
    'deletedResults', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'declaredAt', r.declared_at, 'deletedAt', r.deleted_at,
                                          'deletedByMe', r.deleted_by = auth.uid(),
                                          'deletedByName', coalesce(nullif(d.display_name, ''), 'Rummy Player'),
                                          'gameCount', (select count(*) from public.game_result_games g where g.result_id = r.id and g.removed_at is null),
                                          'playerCount', jsonb_array_length(coalesce(public.result_places_json(r.id)->'standings', '[]'::jsonb)))
                       order by r.deleted_at desc)
      from public.game_results r left join public.profiles d on d.id = r.deleted_by
      where r.deleted_at is not null and (r.deleted_by = auth.uid() or public.can_manage_result(r.id))
    ), '[]'::jsonb)
  ) end;
$$;

create or replace function public.get_game_bundle(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_admin boolean;
  v_member boolean;
  v_seats jsonb := '[]'::jsonb;
  v_scores jsonb := '[]'::jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_game from public.games g where g.id = p_game_id;
  if v_game.id is null then return null; end if;

  v_admin := public.is_app_admin();
  v_member := v_game.created_by = v_uid
    or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = v_uid and gp.is_active);
  if not (v_admin or v_member or v_game.spectator_access) then return null; end if;

  if v_game.deleted_at is not null then
    return jsonb_build_object(
      'deleted', true,
      'game', jsonb_build_object('id', v_game.id, 'game_number', v_game.game_number, 'deleted_at', v_game.deleted_at,
                                 'can_restore', v_game.deleted_by = v_uid or public.can_manage_game(p_game_id))
    );
  end if;

  if v_admin or v_member then
    select coalesce(s.seats, '[]'::jsonb) into v_seats
    from public.seat_rows_json(array[p_game_id], case when v_member then array[p_game_id] else '{}'::uuid[] end, true) s;
    v_seats := coalesce(v_seats, '[]'::jsonb);

    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', s.profile_id,
             'score_type', s.score_type,
             'value', s.value,
             'round_number', r.round_number
           ) order by r.round_number, s.created_at), '[]'::jsonb)
      into v_scores
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = p_game_id
      and r.undone_at is null;
  end if;

  return jsonb_build_object(
    'game', to_jsonb(v_game),
    'game_players', v_seats,
    'scores', v_scores
  );
end;
$$;

create or replace function public.public_scorecard(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;

  select * into g from public.games where view_token = p_token;
  if not found then
    return null;
  end if;
  if g.deleted_at is not null then
    return jsonb_build_object('gameId', g.share_code, 'deleted', true);
  end if;

  return jsonb_build_object(
    'gameId', g.share_code,
    'startedAt', g.created_at,
    'gameType', g.game_type,
    'status', g.status,
    'currentRound', g.current_round,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', pr.display_name,
        'order', gp.player_order
      ) order by gp.player_order), '[]'::jsonb)
      from public.game_players gp
      join public.profiles pr on pr.id = gp.profile_id
      where gp.game_id = g.id
        and gp.is_active
        and gp.role <> 'spectator'
    ),
    'scores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId', s.profile_id,
        'name', pr.display_name,
        'round', r.round_number,
        'type', s.score_type,
        'value', s.value
      ) order by r.round_number, gp.player_order), '[]'::jsonb)
      from public.scores s
      join public.rounds r on r.id = s.round_id
      left join public.game_players gp on gp.game_id = s.game_id and gp.profile_id = s.profile_id
      left join public.profiles pr on pr.id = s.profile_id
      where s.game_id = g.id
        and r.undone_at is null
    )
  );
end;
$$;

create or replace function public.queue_game_started_emails(p_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_added integer := 0;
  v_creator text;
  v_url text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_game from public.games g where g.id = p_game_id and g.deleted_at is null;
  if v_game.id is null then raise exception 'This game is not available.'; end if;
  if not public.can_manage_game(p_game_id) then raise exception 'Only the creator or a game admin can send the game-started email.'; end if;
  if v_game.status <> 'active' then return 0; end if;

  if v_game.view_token is null then
    update public.games set view_token = encode(gen_random_bytes(24), 'hex') where id = p_game_id returning view_token into v_game.view_token;
  end if;
  v_url := public.site_base_url() || '/scorecard.html?t=' || v_game.view_token
           || case when v_game.game_number is not null then '&g=' || v_game.game_number::text else '' end;
  select coalesce(nullif(p.display_name, ''), 'A player') into v_creator from public.profiles p where p.id = v_game.created_by;

  with recipients as (
    select p.id, p.email, p.display_name, p.email_token
    from public.game_players gp
    join public.profiles p on p.id = gp.profile_id
    where gp.game_id = p_game_id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)
      and p.player_status = 'registered' and p.deleted_at is null
      and p.email is not null and p.email <> ''
      and p.email_game_started
  ), ins as (
    insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload)
    select 'game_started:' || p_game_id::text || ':' || r.id::text, 'game_started', r.id, r.email,
           jsonb_build_object(
             'gameId', p_game_id, 'gameNumber', v_game.game_number, 'creatorName', v_creator,
             'playerName', coalesce(nullif(r.display_name, ''), 'there'), 'url', v_url,
             'startedAt', v_game.created_at, 'unsubscribeToken', r.email_token)
    from recipients r
    on conflict (event_key) do nothing
    returning 1
  )
  select count(*) into v_added from ins;
  return v_added;
end;
$$;

create or replace function public.public_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (select * from public.game_results where id = p_id),
  pl as (select public.result_places_json(p_id) as v),
  players as (
    select t.ord - 1 as pos, t.e->>'id' as id, coalesce(t.e->>'name', 'Player') as name, pr.public_player_no as player_no,
           (select gp.label from public.game_result_games grg join public.game_players gp on gp.game_id = grg.game_id and gp.profile_id::text = t.e->>'id'
             where grg.result_id = p_id and grg.removed_at is null and gp.label is not null order by grg.game_id limit 1) as label
    from pl, jsonb_array_elements(coalesce(pl.v->'players', '[]'::jsonb)) with ordinality t(e, ord)
    left join public.profiles pr on pr.id::text = t.e->>'id'
  )
  select case
    when not exists (select 1 from r) then null
    when (select deleted_at from r) is not null then jsonb_build_object('id', p_id, 'deleted', true)
    else jsonb_build_object(
      'id', p_id,
      'declaredAt', (select declared_at from r),
      'declarerName', (select coalesce(nullif(p.display_name, ''), 'Player') from r join public.profiles p on p.id = r.declared_by),
      'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'playerNo', player_no, 'label', label) order by pos) from players), '[]'::jsonb),
      'standings', coalesce((
        select jsonb_agg(jsonb_build_object('player', p.pos, 'name', p.name, 'points', (s->>'points')::int, 'games', (s->>'games')::int, 'place', (s->>'place')::int) order by (s->>'place')::int, p.name)
        from pl, jsonb_array_elements(coalesce(pl.v->'standings', '[]'::jsonb)) s
        join players p on p.id = s->>'id'
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', case when g.game_number is not null then 'G' || g.game_number::text else coalesce(e->>'name', '') end,
          'date', e->>'date',
          'reused', (e->>'id')::uuid = any(array(select jsonb_array_elements_text(public.reused_game_ids(p_id))::uuid)),
          'scores', coalesce((select jsonb_object_agg(p.pos::text, k.value::int) from jsonb_each_text(coalesce(e->'scores', '{}'::jsonb)) k join players p on p.id = k.key), '{}'::jsonb)
        ) order by t.ord)
        from pl, jsonb_array_elements(coalesce(pl.v->'games', '[]'::jsonb)) with ordinality t(e, ord)
        left join public.games g on g.id::text = t.e->>'id'
      ), '[]'::jsonb),
      'reusedCount', jsonb_array_length(public.reused_game_ids(p_id)),
      'removedCount', (select count(*) from public.game_result_games g where g.result_id = p_id and g.removed_at is not null)
    )
  end;
$$;

-- 025 bodies
create or replace function public.link_conflict_message(p_player_id uuid, p_target uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  n integer;
  pname text;
  tno bigint;
  listed text;
begin
  select coalesce(array_agg(
           coalesce('G' || c.game_number::text, 'a game') || ' (game ID ' || c.game_id::text || ', creator ' || c.creator_name || ')'
           order by c.game_number nulls last), '{}')
    into parts
  from public.link_conflicts(p_player_id, p_target) c;
  n := coalesce(array_length(parts, 1), 0);
  if n = 0 then return null; end if;
  select coalesce(nullif(display_name, ''), 'This player') into pname from public.profiles where id = p_player_id;
  select public_player_no into tno from public.profiles where id = p_target;
  listed := case when n = 1 then parts[1]
                 else array_to_string(parts[1:n-1], ', ') || ' and ' || parts[n] end;
  return format('Can''t link yet. %s %s both %s and #%s. In %s, clear one of their scores to zero and remove them from the game first.',
                listed, case when n = 1 then 'has' else 'have' end, pname, coalesce(tno::text, '?'),
                case when n = 1 then 'that game' else 'those games' end);
end;
$$;

create or replace function public.link_player_check(p_player_id uuid, p_player_no bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seat public.profiles := public.link_seat_for(p_player_id);
  t public.profiles := public.link_target_for(p_player_no);
  n_games integer;
  open_req public.player_links;
begin
  if t.id = seat.id then raise exception 'That is this same player.'; end if;
  select count(*)::int into n_games from public.game_players gp
  where gp.profile_id = seat.id and gp.role <> 'spectator' and coalesce(gp.seated, true);
  select * into open_req from public.player_links l
  where l.player_id = seat.id and l.kind = 'link_request' and l.status = 'pending' and l.expires_at > now();
  return jsonb_build_object(
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'gameCount', n_games,
    'gameNumbers', public.game_numbers_for(seat.id),
    'conflicts', coalesce((select jsonb_agg(jsonb_build_object('gameId', c.game_id, 'gameNumber', c.game_number, 'creatorName', c.creator_name)) from public.link_conflicts(seat.id, t.id) c), '[]'::jsonb),
    'conflictMessage', public.link_conflict_message(seat.id, t.id),
    'pending', case when open_req.id is null then null else jsonb_build_object(
      'id', open_req.id, 'expiresAt', open_req.expires_at, 'targetId', open_req.target_id,
      'targetNo', (select public_player_no from public.profiles where id = open_req.target_id),
      'targetName', (select coalesce(nullif(display_name, ''), 'Rummy Player') from public.profiles where id = open_req.target_id)) end
  );
end;
$$;

create or replace function public.request_player_link(p_player_id uuid, p_player_no bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  seat public.profiles := public.link_seat_for(p_player_id);
  t public.profiles := public.link_target_for(p_player_no);
  clash text;
  raw text := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  expiry timestamptz := now() + make_interval(days => public.link_request_days());
  link_id uuid;
  numbers integer[];
  n_games integer;
  requester text;
  queued boolean := false;
begin
  if t.id = seat.id then raise exception 'That is this same player.'; end if;
  clash := public.link_conflict_message(seat.id, t.id);
  if clash is not null then raise exception '%', clash; end if;

  -- One open request per player: a new one replaces the older (its email link stops working).
  update public.player_links set status = 'cancelled' where player_id = seat.id and kind = 'link_request' and status = 'pending';
  delete from public.email_outbox o where o.kind = 'link_request' and o.sent_at is null
    and o.event_key in (select 'link_request:' || l.id::text from public.player_links l where l.player_id = seat.id and l.kind = 'link_request' and l.status = 'cancelled');

  numbers := public.game_numbers_for(seat.id);
  select count(*)::int into n_games from public.game_players gp
  where gp.profile_id = seat.id and gp.role <> 'spectator' and coalesce(gp.seated, true);
  select coalesce(nullif(display_name, ''), 'A player') into requester from public.profiles where id = auth.uid();

  insert into public.player_links (owner_id, player_id, kind, status, target_id, token_hash, expires_at, game_numbers)
  values (auth.uid(), seat.id, 'link_request', 'pending', t.id, encode(digest(raw, 'sha256'), 'hex'), expiry, numbers)
  returning id into link_id;
  update public.profiles set player_status = 'pending' where id = seat.id;

  if t.email is not null and t.email <> '' then
    insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload)
    values ('link_request:' || link_id::text, 'link_request', t.id, t.email, jsonb_build_object(
      'linkId', link_id, 'requesterName', requester,
      'playerName', coalesce(nullif(seat.display_name, ''), 'Player'),
      'playerInitials', (select m.initials from public.my_players m where m.owner_id = auth.uid() and m.player_id = seat.id),
      'targetName', coalesce(nullif(t.display_name, ''), 'there'), 'playerNo', t.public_player_no,
      'gameCount', n_games, 'gameNumbers', to_jsonb(numbers), 'expiresAt', expiry,
      'yesUrl', public.site_base_url() || '/link.html?t=' || raw || '&a=yes',
      'noUrl', public.site_base_url() || '/link.html?t=' || raw || '&a=no'))
    on conflict (event_key) do nothing;
    queued := true;
  end if;

  return jsonb_build_object(
    'linkId', link_id, 'expiresAt', expiry, 'emailQueued', queued,
    'playerName', coalesce(nullif(seat.display_name, ''), 'Player'),
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'gameCount', n_games, 'gameNumbers', to_jsonb(numbers)
  );
end;
$$;

create or replace function public.get_home_bundle(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
set jit = off
as $$
declare
  v_admin boolean;
  v_games jsonb;
  v_notices jsonb;
  v_claims jsonb;
  v_link_requests jsonb;
  v_roster jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_admin := public.is_app_admin();

  with vg as (
    select (v.game).*, v.member from public.visible_games(p_limit, false) v
  ),
  detail as (
    select vg.id from vg where v_admin or vg.member
  ),
  seats as (
    select * from public.seat_rows_json((select coalesce(array_agg(id), '{}'::uuid[]) from detail), '{}'::uuid[], false)
  )
  select coalesce(jsonb_agg(
           to_jsonb(vg) - 'member' || jsonb_build_object('game_players', coalesce(s.seats, '[]'::jsonb))
           order by vg.created_at desc, vg.id desc), '[]'::jsonb)
    into v_games
  from vg
  left join seats s on s.game_id = vg.id;

  select coalesce(jsonb_agg(jsonb_build_object('player_id', n.player_id, 'text', n.text, 'kind', n.kind)), '[]'::jsonb)
    into v_notices
  from public.take_creator_notices() n;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.invited_at), '[]'::jsonb)
    into v_claims
  from public.list_claim_requests() c;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.invited_at), '[]'::jsonb)
    into v_link_requests
  from public.list_link_requests_for_me() r;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_roster
  from public.list_my_players() m;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'games', v_games,
    'notices', v_notices,
    'claim_requests', v_claims,
    'link_requests', v_link_requests,
    'my_players', v_roster,
    'hidden_count', (select count(*) from public.hidden_games h join public.games g on g.id = h.game_id where h.owner_id = auth.uid() and g.deleted_at is null)
  );
end;
$$;

create or replace function public.peek_link_request(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when l.id is null then null else jsonb_build_object(
    'requesterName', coalesce(nullif(o.display_name, ''), 'A player'),
    'playerName', coalesce(nullif(p.display_name, ''), 'Player'),
    'playerInitials', (select m.initials from public.my_players m where m.owner_id = l.owner_id and m.player_id = l.player_id),
    'playerNo', t.public_player_no,
    'gameNumbers', to_jsonb(l.game_numbers),
    'expiresAt', l.expires_at,
    'conflictMessage', public.link_conflict_message(l.player_id, l.target_id)) end
  from (select 1) anchor
  left join public.player_links l on l.kind = 'link_request' and l.status = 'pending' and l.expires_at > now()
    and l.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  left join public.profiles o on o.id = l.owner_id
  left join public.profiles p on p.id = l.player_id
  left join public.profiles t on t.id = l.target_id;
$$;

drop index if exists public.games_label_open_idx;
alter table public.player_links drop column if exists game_labels;
alter table public.games drop column if exists game_label;
drop function if exists public.game_label_text(text, integer);
drop function if exists public.game_label_prefix(public.game_type);

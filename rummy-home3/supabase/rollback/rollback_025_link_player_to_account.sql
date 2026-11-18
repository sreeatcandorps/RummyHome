-- Rollback 025: removes the link-request flow. Links already accepted stay linked (the moved rows
-- and their 'claimed' player_links rows remain, so 011 unlink_player still undoes them one by one).
-- Open requests are cancelled and their players set back to unregistered; queued Yes/No emails are
-- dropped. Puts back the 012 expire_player_requests, the 011 take_creator_notices, the 023
-- get_home_bundle and the 012 player_links read policy. Safe to re-run.

-- Open requests and the emails for them.
update public.player_links set status = 'cancelled' where kind = 'link_request' and status = 'pending';
update public.profiles p set player_status = 'unregistered'
where p.player_status = 'pending' and not exists (select 1 from public.player_links l where l.player_id = p.id and l.status = 'pending');
delete from public.email_outbox where kind = 'link_request';

-- Functions.
drop function if exists public.answer_link_request_by_token(text, boolean);
drop function if exists public.peek_link_request(text);
drop function if exists public.answer_player_link_request(uuid, boolean);
drop function if exists public.list_link_requests_for_me();
drop function if exists public.decline_player_link(uuid);
drop function if exists public.perform_player_link(uuid);
drop function if exists public.list_my_link_requests(uuid);
drop function if exists public.cancel_player_link_request(uuid);
drop function if exists public.request_player_link(uuid, bigint);
drop function if exists public.link_player_check(uuid, bigint);
drop function if exists public.link_conflict_message(uuid, uuid);
drop function if exists public.link_conflicts(uuid, uuid);
drop function if exists public.link_seat_for(uuid);
drop function if exists public.link_target_for(bigint);
drop function if exists public.expire_link_requests();
drop function if exists public.link_request_days();
-- Earlier (unapplied) shapes of 025.
drop function if exists public.link_player_to_account(uuid, bigint, text);
drop function if exists public.link_player_check(uuid, bigint, text);
drop function if exists public.link_target_for(bigint, text);

-- 012 body.
create or replace function public.expire_player_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l record;
begin
  for l in select * from public.player_links where owner_id = auth.uid() and status = 'pending' and expires_at <= now() loop
    update public.player_links set status = 'expired' where id = l.id;
    perform public.reset_if_no_live_claims(l.player_id);
    insert into public.creator_notices (owner_id, player_id, text)
    values (l.owner_id, l.player_id, (select display_name from public.profiles where id = l.player_id)
      || ': the ' || case when l.kind = 'link' then 'claim link' else 'claim request' end || ' expired. They are unregistered again.');
  end loop;
end;
$$;
grant execute on function public.expire_player_requests() to anon, authenticated;

-- 011 body (two columns).
drop function if exists public.take_creator_notices();
create function public.take_creator_notices()
returns table (player_id uuid, text text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.creator_notices n set read_at = now()
    where n.owner_id = auth.uid() and n.read_at is null
    returning n.player_id, n.text;
end;
$$;
grant execute on function public.take_creator_notices() to anon, authenticated;

-- 023 body.
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

  select coalesce(jsonb_agg(jsonb_build_object('player_id', n.player_id, 'text', n.text)), '[]'::jsonb)
    into v_notices
  from public.take_creator_notices() n;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.invited_at), '[]'::jsonb)
    into v_claims
  from public.list_claim_requests() c;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_roster
  from public.list_my_players() m;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'games', v_games,
    'notices', v_notices,
    'claim_requests', v_claims,
    'my_players', v_roster,
    'hidden_count', (select count(*) from public.hidden_games h join public.games g on g.id = h.game_id where h.owner_id = auth.uid() and g.deleted_at is null)
  );
end;
$$;

-- Schema: 012 policy and kinds, 024 outbox kinds, no notice kinds.
drop policy if exists player_links_read on public.player_links;
create policy player_links_read on public.player_links
for select to authenticated
using (owner_id = auth.uid() or requester_id = auth.uid());
update public.player_links set kind = 'link' where kind = 'link_request';
alter table public.player_links drop constraint if exists player_links_kind_check;
alter table public.player_links add constraint player_links_kind_check
  check (kind in ('signup','existing','link','id_request'));
drop index if exists public.player_links_one_pending_link_request;
drop index if exists public.player_links_target_pending;
alter table public.player_links drop column if exists target_id;

alter table public.creator_notices drop constraint if exists creator_notices_kind_check;
alter table public.creator_notices drop column if exists kind;

alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('game_started', 'result_saved'));

notify pgrst, 'reload schema';

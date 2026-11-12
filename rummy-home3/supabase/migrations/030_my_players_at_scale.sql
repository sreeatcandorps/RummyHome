-- 030 My players at scale: paged loading and server-side search.
--
-- list_my_players (027) returns the whole roster, which is fine for a few dozen rows and slow
-- for the 2,000 the guardrail allows. The app now loads a page at a time (keyset paging, so
-- page 20 costs the same as page 1) in the order the screen shows (A-Z or Frequent), asks the
-- server to search when the user types, and reads one count for the header. The New game
-- picker keeps list_new_game_candidates (recent partners first, 100 rows) and uses the same
-- search for anyone beyond those.
--
-- Backward compatible with the APK on phones: list_my_players and list_new_game_candidates are
-- untouched; everything here is new. Safe to re-run.

-- Case-folded name order needs an index on the join target to stay fast at 2,000+ rows.
create index if not exists profiles_display_name_lower_idx on public.profiles (lower(display_name), id);
create index if not exists my_players_owner_active_idx on public.my_players (owner_id, games_together desc) where removed_at is null;

-- ---------- count ----------
create or replace function public.count_my_players()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid() and m.removed_at is null
    and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged');
$$;
revoke all on function public.count_my_players() from public, anon;
grant execute on function public.count_my_players() to authenticated;

-- ---------- one page ----------
-- p_sort 'name': A-Z by lower(display_name), then id. Cursor = (p_after_name, p_after_id) of the last row shown.
-- p_sort 'frequent': games_together desc, then lower(name), then id. Cursor adds p_after_games.
-- Pass no cursor for the first page. p_limit is clamped to 1..200.
create or replace function public.list_my_players_page(
  p_sort text default 'name',
  p_limit integer default 100,
  p_after_name text default null,
  p_after_id uuid default null,
  p_after_games integer default null
)
returns table (id uuid, display_name text, player_code text, player_status text, games_together integer, initials text, added_at timestamptz, sort_name text)
language sql
stable
security definer
set search_path = public
as $$
  with rows_ as (
    select p.id,
           coalesce(nullif(p.display_name, ''), 'Rummy Player') as display_name,
           public.player_label(p) as player_code,
           p.player_status,
           m.games_together,
           m.initials,
           m.created_at as added_at,
           lower(coalesce(nullif(p.display_name, ''), 'Rummy Player')) as sort_name
    from public.my_players m
    join public.profiles p on p.id = m.player_id
    where m.owner_id = auth.uid() and m.removed_at is null
      and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  )
  select r.id, r.display_name, r.player_code, r.player_status, r.games_together, r.initials, r.added_at, r.sort_name
  from rows_ r
  where case
          when p_after_id is null then true
          when coalesce(p_sort, 'name') = 'frequent' then
            (-(r.games_together), r.sort_name, r.id) > (-(coalesce(p_after_games, 0)), coalesce(p_after_name, ''), p_after_id)
          else (r.sort_name, r.id) > (coalesce(p_after_name, ''), p_after_id)
        end
  order by case when coalesce(p_sort, 'name') = 'frequent' then -(r.games_together) else 0 end, r.sort_name, r.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;
revoke all on function public.list_my_players_page(text, integer, text, uuid, integer) from public, anon;
grant execute on function public.list_my_players_page(text, integer, text, uuid, integer) to authenticated;

-- ---------- search ----------
-- Name (any part), the initials on your scorecard, or the Player ID with or without #.
-- An email address matches nobody (the Find player in database screen handles those).
create or replace function public.search_my_players(p_query text, p_limit integer default 50)
returns table (id uuid, display_name text, player_code text, player_status text, games_together integer, initials text, added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as raw,
           lower(btrim(coalesce(p_query, ''))) as text_,
           nullif(regexp_replace(btrim(coalesce(p_query, '')), '^#', ''), '') as bare
  )
  select p.id,
         coalesce(nullif(p.display_name, ''), 'Rummy Player'),
         public.player_label(p),
         p.player_status,
         m.games_together,
         m.initials,
         m.created_at
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  cross join q
  where m.owner_id = auth.uid() and m.removed_at is null
    and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
    and q.text_ <> '' and position('@' in q.text_) = 0
    and (
      lower(coalesce(p.display_name, '')) like '%' || q.text_ || '%'
      or lower(coalesce(p.first_name, '')) like q.text_ || '%'
      or lower(coalesce(p.last_name, '')) like q.text_ || '%'
      or (m.initials is not null and lower(m.initials) like q.text_ || '%')
      or (q.bare ~ '^\d{1,12}$' and p.public_player_no = q.bare::bigint)
      or (q.bare <> '' and lower(coalesce(p.player_code, '')) = lower(q.bare))
    )
  order by (q.bare ~ '^\d{1,12}$' and p.public_player_no = q.bare::bigint) desc,
           (lower(coalesce(p.display_name, '')) like q.text_ || '%') desc,
           m.games_together desc,
           lower(coalesce(nullif(p.display_name, ''), 'Rummy Player')), p.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke all on function public.search_my_players(text, integer) from public, anon;
grant execute on function public.search_my_players(text, integer) to authenticated;

comment on function public.list_my_players_page(text, integer, text, uuid, integer) is
  '030: one page of the caller''s active My players in A-Z or Frequent order (keyset cursor). list_my_players stays for older apps and the home bundle.';
comment on function public.search_my_players(text, integer) is
  '030: the caller''s active My players matching a name part, initials prefix or Player ID; exact ID first, then name-starts-with, then most games together.';

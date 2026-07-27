create extension if not exists "pgcrypto";

create type public.app_role as enum ('app_admin', 'player');
create type public.game_status as enum ('active', 'completed', 'cancelled');
create type public.game_type as enum ('stake', 'pool');
create type public.game_member_role as enum ('game_admin', 'player', 'spectator');
create type public.score_type as enum ('drop', 'middle_drop', 'rummy', 'count', 'expense');
create type public.token_entry_type as enum ('deposit', 'prize', 'transfer', 'adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text unique,
  phone text,
  first_name text,
  last_name text,
  display_name text not null,
  avatar_url text,
  role public.app_role not null default 'player',
  default_settings jsonb not null default '{
    "gameType": "stake",
    "expenseEnabled": true,
    "expenseAmount": -10,
    "stakeDrop": -10,
    "stakeMiddleDrop": -30,
    "poolDrop": -25,
    "poolMiddleDrop": -50,
    "maxCount": -80,
    "poolAmount": 100,
    "poolDefaultDeposit": -100
  }'::jsonb
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  status public.game_status not null default 'active',
  game_type public.game_type not null,
  settings jsonb not null,
  current_round integer not null default 1 check (current_round >= 1),
  share_code text not null unique,
  spectator_access boolean not null default false,
  completed_at timestamptz
);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  player_order integer not null check (player_order >= 0),
  display_number integer,
  color_code text,
  role public.game_member_role not null default 'player',
  is_active boolean not null default true,
  unique (game_id, profile_id),
  unique (game_id, player_order)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  round_number integer not null check (round_number >= 1),
  dealer_profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  undone_at timestamptz,
  undone_by uuid references public.profiles(id) on delete set null,
  undo_reason text,
  unique (game_id, round_number)
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete restrict,
  score_type public.score_type not null,
  value integer not null,
  created_at timestamptz not null default now(),
  check (
    (score_type in ('drop', 'middle_drop', 'count', 'expense') and value <= 0)
    or (score_type = 'rummy' and value >= 0)
  )
);

create table public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  counterparty_profile_id uuid references public.profiles(id) on delete set null,
  amount integer not null,
  entry_type public.token_entry_type not null,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles(email);
create index games_created_by_idx on public.games(created_by);
create index game_players_profile_idx on public.game_players(profile_id);
create index game_players_game_idx on public.game_players(game_id);
create index rounds_game_idx on public.rounds(game_id);
create index scores_game_idx on public.scores(game_id);
create index scores_round_idx on public.scores(round_id);
create index token_ledger_profile_idx on public.token_ledger(profile_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger games_touch_updated_at
before update on public.games
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'Rummy Player')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'app_admin'
  );
$$;

create or replace function public.is_game_member(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.game_players
    where game_id = target_game_id
      and profile_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.is_game_admin(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.game_players
    where game_id = target_game_id
      and profile_id = auth.uid()
      and role = 'game_admin'
      and is_active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.rounds enable row level security;
alter table public.scores enable row level security;
alter table public.token_ledger enable row level security;

create policy "profiles are readable by signed in users"
on public.profiles for select
to authenticated
using (true);

create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "members read games"
on public.games for select
to authenticated
using (
  public.is_app_admin()
  or created_by = auth.uid()
  or public.is_game_member(id)
  or spectator_access = true
);

create policy "authenticated users create games"
on public.games for insert
to authenticated
with check (created_by = auth.uid());

create policy "game admins update games"
on public.games for update
to authenticated
using (public.is_app_admin() or public.is_game_admin(id) or created_by = auth.uid())
with check (public.is_app_admin() or public.is_game_admin(id) or created_by = auth.uid());

create policy "members read game players"
on public.game_players for select
to authenticated
using (
  public.is_app_admin()
  or public.is_game_member(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
);

create policy "game admins manage game players"
on public.game_players for all
to authenticated
using (
  public.is_app_admin()
  or public.is_game_admin(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
)
with check (
  public.is_app_admin()
  or public.is_game_admin(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
);

create policy "members read rounds"
on public.rounds for select
to authenticated
using (public.is_app_admin() or public.is_game_member(game_id));

create policy "game admins insert rounds"
on public.rounds for insert
to authenticated
with check (public.is_app_admin() or public.is_game_admin(game_id));

create policy "game admins update rounds"
on public.rounds for update
to authenticated
using (public.is_app_admin() or public.is_game_admin(game_id))
with check (public.is_app_admin() or public.is_game_admin(game_id));

create policy "members read scores"
on public.scores for select
to authenticated
using (public.is_app_admin() or public.is_game_member(game_id));

create policy "game admins insert scores"
on public.scores for insert
to authenticated
with check (public.is_app_admin() or public.is_game_admin(game_id));

create policy "members read token ledger"
on public.token_ledger for select
to authenticated
using (
  public.is_app_admin()
  or profile_id = auth.uid()
  or counterparty_profile_id = auth.uid()
  or (game_id is not null and public.is_game_member(game_id))
);

create policy "game admins insert token ledger"
on public.token_ledger for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_app_admin()
    or (game_id is not null and public.is_game_admin(game_id))
  )
);

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.token_ledger;

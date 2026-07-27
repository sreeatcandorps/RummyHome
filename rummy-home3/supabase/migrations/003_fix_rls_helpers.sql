-- Fix RLS recursion: helper checks must bypass RLS (SECURITY DEFINER).
-- Without this, is_game_member -> game_players policies -> is_game_member loops
-- and inserts into rounds/scores fail with "stack depth limit exceeded".

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

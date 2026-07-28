-- Public, shareable player IDs.
--
-- Every profile gets a short unique code (e.g. "K7M2QB") that players can hand
-- out instead of an email or phone number. Codes are only checked against live
-- profiles, so a code frees up again if an account is deleted.

alter table public.profiles add column if not exists player_code text;

create or replace function public.generate_player_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  position int;
begin
  loop
    candidate := '';
    for position in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.profiles where player_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

-- Backfill one row at a time so each new code sees the codes already assigned.
do $$
declare
  target record;
begin
  for target in select id from public.profiles where player_code is null loop
    update public.profiles
    set player_code = public.generate_player_code()
    where id = target.id;
  end loop;
end $$;

create unique index if not exists profiles_player_code_key
on public.profiles(player_code);

alter table public.profiles
alter column player_code set default public.generate_player_code();

alter table public.profiles
alter column player_code set not null;

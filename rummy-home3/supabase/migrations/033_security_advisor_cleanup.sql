-- 033: Supabase security advisor cleanup (final launch batch add-on). Three findings:
--
-- 1. security_definer_view on public.my_profile. The view is recreated WITH
--    (security_invoker = true). Because the owner's private columns (email, phone, zip_code,
--    email_game_started, email_results, email_token) are deliberately NOT granted to
--    `authenticated` on public.profiles (019/024), a security-invoker view straight over the
--    table would refuse `select * from my_profile` for everyone. The view therefore reads
--    its single row from a small SECURITY DEFINER function, my_profile_rows(), whose body is
--    exactly the old view body (`select p.* from profiles p where p.id = auth.uid()`), with a
--    fixed search_path and EXECUTE for `authenticated` only. Columns, order and types are
--    identical to before (a `create or replace view` would fail otherwise). The row policy
--    on profiles still governs direct table reads; the function returns at most the caller's
--    own row and nothing for anon (auth.uid() is null). The view is now read-only
--    (select only; the app never wrote through it).
--
-- 2. function_search_path_mutable. `set search_path = public, pg_temp` on every function
--    of ours that had none: initials_words, initials_push, initials_candidates (022),
--    player_label (012), site_base_url (024), link_request_days (025), lock_profile_email and
--    lock_public_player_no (021/026), touch_updated_at (001), plus the three from 028
--    (game_label_text, game_label_prefix, lock_game_label). ALTER FUNCTION ... SET keeps the
--    bodies as they are, so this is safe to run in any order relative to 027–032.
--
-- 3. SECURITY DEFINER functions executable by `anon`. Supabase's default privileges grant
--    EXECUTE on every new function to anon, authenticated and service_role, so every RPC that
--    did not revoke it explicitly is callable with the anon key. Only five are meant to be:
--    public_scorecard (web /scorecard.html), public_result (web /r/), unsubscribe_email
--    (web /unsubscribe.html), peek_link_request and answer_link_request_by_token
--    (web /link.html). The four helpers referenced by row policies (is_app_admin,
--    is_game_admin, is_game_member, can_see_profile) keep anon EXECUTE too, so an anon read of
--    a table keeps returning zero rows instead of "permission denied for function". EXECUTE is
--    revoked from anon on every other SECURITY DEFINER function in public (38 today, listed in
--    docs/migrations-to-apply.md). The app always calls RPCs as a signed-in user, so nothing
--    the APK does changes.
--
-- Re-runnable. Rollback: supabase/rollback/rollback_033_security_advisor_cleanup.sql.

-- ---------- 1. my_profile as a security-invoker view ----------

create or replace function public.my_profile_rows()
returns setof public.profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.* from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.my_profile_rows() from public, anon;
grant execute on function public.my_profile_rows() to authenticated, service_role;

create or replace view public.my_profile
with (security_invoker = true, security_barrier = true) as
  select p.* from public.my_profile_rows() p;

revoke all on public.my_profile from public, anon, authenticated;
grant select on public.my_profile to authenticated, service_role;

-- ---------- 2. a fixed search_path on the functions that had none ----------

alter function public.initials_words(text) set search_path = public, pg_temp;
alter function public.initials_push(text[], text) set search_path = public, pg_temp;
alter function public.initials_candidates(text) set search_path = public, pg_temp;
alter function public.player_label(public.profiles) set search_path = public, pg_temp;
alter function public.site_base_url() set search_path = public, pg_temp;
alter function public.link_request_days() set search_path = public, pg_temp;
alter function public.lock_profile_email() set search_path = public, pg_temp;
alter function public.lock_public_player_no() set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = public, pg_temp;

do $$
begin
  -- 028 (same batch) may or may not be applied yet; cover its three functions when it is.
  if to_regprocedure('public.game_label_text(text, integer)') is not null then
    alter function public.game_label_text(text, integer) set search_path = public, pg_temp;
  end if;
  if to_regprocedure('public.game_label_prefix(public.game_type)') is not null then
    alter function public.game_label_prefix(public.game_type) set search_path = public, pg_temp;
  end if;
  if to_regprocedure('public.lock_game_label()') is not null then
    alter function public.lock_game_label() set search_path = public, pg_temp;
  end if;
end;
$$;

-- ---------- 3. anon may only call the five public RPCs (and the policy helpers) ----------

do $$
declare
  r record;
  v_keep text[] := array[
    'public_scorecard', 'public_result', 'unsubscribe_email',
    'peek_link_request', 'answer_link_request_by_token',
    'is_app_admin', 'is_game_admin', 'is_game_member', 'can_see_profile'
  ];
  v_revoked int := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname <> all (v_keep)
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'execute')
    order by p.proname
  loop
    -- PUBLIC too: trigger functions created without an explicit revoke carry Postgres's
    -- built-in "=X" grant as well as Supabase's per-role defaults (a trigger firing does not
    -- check EXECUTE, so nothing stops working).
    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
    v_revoked := v_revoked + 1;
    if has_function_privilege('anon', r.oid, 'execute') then
      raise warning '033: anon still executes %(%)', r.proname, r.args;
    end if;
  end loop;
  raise notice '033: revoked anon EXECUTE on % security definer function(s)', v_revoked;
end;
$$;

-- The five public RPCs stay callable with the anon key (explicit, so a re-run after the
-- rollback leaves the same state).
grant execute on function public.public_scorecard(text) to anon, authenticated;
grant execute on function public.public_result(uuid) to anon, authenticated;
grant execute on function public.unsubscribe_email(text, text) to anon, authenticated;
grant execute on function public.peek_link_request(text) to anon, authenticated;
grant execute on function public.answer_link_request_by_token(text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

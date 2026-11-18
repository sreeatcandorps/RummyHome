-- ROLLBACK for 021_email_uniqueness.sql. Safe to re-run.
-- Removes the normalising trigger, the case-insensitive unique index over every profile
-- email, and the duplicate report function. 001's plain unique(email) and 011's
-- accounts-only index (profiles_email_normalized_key, if it was created) stay, so the
-- database is exactly as it was before 021. No data is changed: 021 never edited rows.
drop trigger if exists profiles_normalize_email on public.profiles;
drop function if exists public.normalize_profile_email();
drop index if exists public.profiles_email_ci_key;
drop function if exists public.duplicate_profile_emails();

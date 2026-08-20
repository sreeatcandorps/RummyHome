export function formatSupabaseError(error: unknown): string {
  if (!error) return 'Unknown error';

  const err = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  const message = err.message ?? String(error);
  const code = err.code ?? '';

  if (code === 'PGRST303' || /JWT issued at future/i.test(message)) {
    return 'Your saved sign-in is out of sync with the server (common after Supabase was paused). Sign out and sign back in.';
  }

  if (code === '22P02' || /invalid input syntax for type uuid/i.test(message)) {
    return 'Something went wrong creating the game ID. Please update the app and try again.';
  }

  if (/Failed to fetch|Network request failed|network/i.test(message)) {
    return 'Network error — check Wi‑Fi and that the Supabase project is not paused.';
  }

  return message;
}

/** Stale/skewed JWT that PostgREST rejects (often after a paused project wakes up). */
export function isClockSkewError(error: unknown): boolean {
  const err = error as { message?: string; code?: string };
  return err?.code === 'PGRST303' || /JWT issued at future/i.test(err?.message ?? '');
}

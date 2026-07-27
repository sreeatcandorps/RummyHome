type AuthErrorLike = {
  message?: string;
  name?: string;
  status?: number;
};

export function formatAuthError(error: unknown): string {
  const authError = error as AuthErrorLike;
  const message = authError?.message ?? (error instanceof Error ? error.message : String(error));
  const lower = message.toLowerCase();

  if (
    lower.includes('fetch failed') ||
    lower.includes('network request failed') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch')
  ) {
    return 'Cannot reach the server. Check your internet connection, then try again. If this keeps happening, your Supabase project may be paused.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Wrong email or passcode. Use the same 6-digit passcode you chose when creating the account.';
  }

  if (lower.includes('email not confirmed')) {
    return 'This email is not confirmed yet. Check your inbox for the confirmation link, then try signing in again.';
  }

  if (lower.includes('user already registered')) {
    return 'This email already has an account. Try signing in instead.';
  }

  if (lower.includes('password should be at least')) {
    return 'Passcode must be at least 6 digits.';
  }

  if (lower.includes('unable to validate email address')) {
    return 'That email address is not allowed. Try a real email address you can access.';
  }

  if (lower.includes('jwt issued at future')) {
    return 'Your phone clock appears ahead of the server. Set Date & Time to Automatic, then try again.';
  }

  return message || 'Something went wrong. Please try again.';
}

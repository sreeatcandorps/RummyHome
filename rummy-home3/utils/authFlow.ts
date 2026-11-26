/**
 * While a passcode recovery is running, Supabase signs the person in (to set the new passcode)
 * and out again. The root layout normally reacts to those events by changing screens; this
 * flag tells it to stay put until the flow finishes its own navigation.
 */
let recovering = false;

export const passcodeRecovery = {
  begin() { recovering = true; },
  end() { recovering = false; },
  inProgress() { return recovering; },
};

/**
 * The same for every other code step: `verifyOtp` reports SIGNED_IN for a sign-up code, a number change and an
 * email change alike, and the root layout would jump to Home in the middle of the backup step or Profile.
 * A count, so two screens holding at once (the backup step over Create account) release in either order.
 */
let holds = 0;

export const authNavigationHold = {
  begin() { holds += 1; },
  end() { holds = Math.max(0, holds - 1); },
  active() { return holds > 0 || recovering; },
};

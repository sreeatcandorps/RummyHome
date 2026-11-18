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

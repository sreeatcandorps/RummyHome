import React from 'react';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { SignInMethod } from '@/utils/signInDefaults';

/**
 * The WhatsApp · Email switch at the top of the card on Create account, Sign in and Forgot passcode
 * (WhatsApp spec §8). Where it starts is D125's rule; it always works.
 */
export function SignInMethodSwitch({ value, onChange, disabled, testIDPrefix }: {
  value: SignInMethod;
  onChange: (value: SignInMethod) => void;
  disabled?: boolean;
  testIDPrefix: string;
}) {
  return (
    <SegmentedChoice
      value={value}
      onChange={onChange}
      disabled={disabled}
      accessibilityLabel="Sign in with"
      options={[
        { value: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', testID: `${testIDPrefix}-way-whatsapp`, accessibilityLabel: 'WhatsApp' },
        { value: 'email', label: 'Email', icon: 'email-outline', testID: `${testIDPrefix}-way-email`, accessibilityLabel: 'Email' },
      ]}
    />
  );
}

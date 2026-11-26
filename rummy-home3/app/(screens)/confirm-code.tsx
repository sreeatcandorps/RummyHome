import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { CodeStep } from '@/components/ui/CodeStep';
import { emailChange, whatsAppAuth } from '@/services/auth';
import { authNavigationHold } from '@/utils/authFlow';
import { maskWhatsAppNumber } from '@/utils/countries';

/**
 * The code step for Profile › Sign-in methods (flow 6): the D101 screen, opened after the sheet sent a code to
 * the new number or address. Confirm → back to Profile, which shows the new one. The code signs the session in
 * again (SIGNED_IN), so the root layout is held while this screen is open.
 */
export default function ConfirmCodeScreen() {
  const params = useLocalSearchParams<{ channel?: string; to?: string }>();
  const channel = params.channel === 'whatsapp' ? 'whatsapp' : 'email';
  const to = typeof params.to === 'string' ? params.to : '';

  useEffect(() => {
    authNavigationHold.begin();
    return () => authNavigationHold.end();
  }, []);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/me');
  };

  return (
    <CodeStep
      channel={channel}
      to={channel === 'whatsapp' ? maskWhatsAppNumber(to) : to}
      verifyLabel="Confirm"
      help="me"
      testIDPrefix="confirm"
      onVerify={async (code) => {
        const outcome = channel === 'whatsapp' ? await whatsAppAuth.verifyCode('change', to, code) : await emailChange.verifyCode(to, code);
        if (outcome.ok) back();
        return outcome;
      }}
      onResend={() => (channel === 'whatsapp' ? whatsAppAuth.sendCode('change', to) : emailChange.sendCode(to))}
      onBack={back}
    />
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput as NativeInput, View } from 'react-native';
import { TextInput, Text, HelperText } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams } from 'expo-router';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { AuthShell } from '../../components/ui/AuthShell';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../constants/theme';
import { takeStartupNotice } from '../../utils/startupNotice';
import { HELP } from '@/constants/help';

export default function LoginScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(typeof params.notice === 'string' ? params.notice : '');

  const emailRef = useRef<NativeInput>(null);

  useEffect(() => {
    const startup = takeStartupNotice();
    if (startup) setError(startup);
  }, []);

  // Cursor in Email on launch. Android ignores autoFocus on a screen that mounts mid-transition, so focus once laid out.
  useEffect(() => {
    if (email) return;
    const timer = setTimeout(() => emailRef.current?.focus(), Platform.OS === 'web' ? 0 : 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailLogin = async () => {
    if (!email || !passcode) {
      setError('Email and passcode are required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (passcode.length !== 6) {
      setError('Passcode must be exactly 6 digits');
      return;
    }

    if (!/^\d{6}$/.test(passcode)) {
      setError('Passcode must contain only numbers');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSupabaseConfigured) {
        await authService.signIn(email, passcode);
      } else {
        // Get player data from storage
        const players = await storage.getPlayers();
        let currentPlayer = players.find(p => p.email === email.trim());

        if (!currentPlayer) {
          // Create new player if not found
          currentPlayer = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email: email.trim(),
            name: email.split('@')[0] || 'Player',
            gamesPlayed: 0,
            gamesWon: 0,
            role: 'player' as const
          };
          await storage.savePlayers([...players, currentPlayer]);
        }

        // Set as current player
        await storage.setCurrentPlayer(currentPlayer.id);
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Login error:', err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="EZ Score: Rummy"
      subtitle="Sign in to keep score with your table"
      help={HELP.signIn}
      footer={
        <>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              New here?
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
          </View>

          <Button
            mode="outlined"
            onPress={() => router.push('/(auth)/register')}
            icon="account-plus-outline"
            style={styles.pill}
            contentStyle={styles.secondaryContent}
          >
            Create account
          </Button>

          <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
            {isSupabaseConfigured
              ? 'Secure sign-in enabled'
              : 'Local prototype mode: add Supabase env vars for production auth'}
          </Text>
        </>
      }
    >
      <TextInput
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus={!email}
        returnKeyType="next"
        cursorColor={theme.colors.primary}
        selectionColor={theme.colors.primary}
        left={<TextInput.Icon icon="email-outline" />}
      />

      <PasscodeField value={passcode} onChangeText={setPasscode} disabled={loading} />
      {notice ? (
        <HelperText type="info" visible style={styles.notice} onPress={() => setNotice('')}>
          {notice}
        </HelperText>
      ) : null}

      {error ? (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleEmailLogin}
        loading={loading}
        disabled={loading}
        style={styles.pill}
        contentStyle={styles.primaryContent}
        labelStyle={styles.primaryLabel}
      >
        Sign in
      </Button>

      <Button
        mode="text"
        onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: email ? { email: email.trim() } : {} })}
        contentStyle={styles.secondaryContent}
      >
        Forgot passcode?
      </Button>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  notice: { fontWeight: '700' },
  pill: {
    borderRadius: radius.full,
  },
  primaryContent: {
    height: 56,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryContent: {
    height: MIN_TOUCH_TARGET,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  footer: {
    textAlign: 'center',
  },
});

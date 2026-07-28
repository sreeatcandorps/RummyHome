import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Icon, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../constants/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={[styles.brandBadge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="cards-playing-outline" size={40} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="headlineMedium" style={styles.brandTitle}>
            Rummy Home
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Sign in to keep score with your table
          </Text>
        </View>

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              left={<TextInput.Icon icon="email-outline" />}
            />

            <View>
              <TextInput
                label="6-digit passcode"
                value={passcode}
                onChangeText={(text) => {
                  const numericText = text.replace(/[^0-9]/g, '');
                  if (numericText.length <= 6) {
                    setPasscode(numericText);
                  }
                }}
                mode="outlined"
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry
                left={<TextInput.Icon icon="lock-outline" />}
              />
              <HelperText type="info" visible>
                Use the same passcode you chose when creating your account.
              </HelperText>
            </View>

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
              contentStyle={styles.primaryContent}
              labelStyle={styles.primaryLabel}
            >
              Sign in
            </Button>

            <Button
              mode="text"
              onPress={() => router.push('/(auth)/forgot-password')}
              contentStyle={styles.secondaryContent}
            >
              Forgot passcode?
            </Button>
          </Card.Content>
        </Card>

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
          contentStyle={styles.secondaryContent}
        >
          Create account
        </Button>

        <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
          {isSupabaseConfigured
            ? 'Secure sign-in enabled'
            : 'Local prototype mode: add Supabase env vars for production auth'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  brandBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandTitle: {
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  primaryContent: {
    height: 56,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
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
    marginTop: spacing.sm,
  },
});

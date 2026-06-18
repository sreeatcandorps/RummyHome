import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, HelperText, Card } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';

export default function LoginScreen() {
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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Welcome Back
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in to your Rummy Score Keeper account
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Enter your email"
          />

          <TextInput
            label="6-Digit Passcode"
            value={passcode}
            onChangeText={(text) => {
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 6) {
                setPasscode(numericText);
              }
            }}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            placeholder="Enter your 6-digit passcode"
          />

          {error ? (
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleEmailLogin}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            Sign In
          </Button>

          <Button
            mode="text"
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.textButton}
          >
            Forgot Passcode?
          </Button>

          <View style={styles.divider}>
            <Text variant="bodyMedium" style={styles.dividerText}>
              Don't have an account?
            </Text>
          </View>

          <Button
            mode="outlined"
            onPress={() => router.push('/(auth)/register')}
            style={styles.button}
          >
            Create Account
          </Button>

          <View style={styles.devSection}>
            <Text variant="bodySmall" style={styles.localModeText}>
              {isSupabaseConfigured ? 'Supabase auth enabled' : 'Local prototype mode: add Supabase env vars for production auth'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  textButton: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
    alignItems: 'center',
  },
  dividerText: {
    opacity: 0.7,
  },
  devSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  localModeText: {
    textAlign: 'center',
    opacity: 0.6,
  },
}); 
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../constants/theme';
// import * as Location from 'expo-location';

interface SimpleCountry {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

export default function RegisterScreen() {
  const theme = useTheme();
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [passcode, setPasscode] = React.useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Country state
  const [selectedCountry, setSelectedCountry] = useState<SimpleCountry | null>(null);
  const [locationLoading, setLocationLoading] = useState(false); // Changed to false

  // Default to US if location detection fails
  const defaultCountry: SimpleCountry = {
    code: 'US',
    name: 'United States',
    callingCode: '1',
    flag: '🇺🇸',
  };

  useEffect(() => {
    // Temporarily disable location detection
    setSelectedCountry(defaultCountry);
    // detectUserLocation();
  }, []);

  const getCountryByCode = (isoCode: string): SimpleCountry | null => {
    // Common countries mapping
    const countries: { [key: string]: SimpleCountry } = {
      'US': { code: 'US', name: 'United States', callingCode: '1', flag: '🇺🇸' },
      'CA': { code: 'CA', name: 'Canada', callingCode: '1', flag: '🇨🇦' },
      'GB': { code: 'GB', name: 'United Kingdom', callingCode: '44', flag: '🇬🇧' },
      'IN': { code: 'IN', name: 'India', callingCode: '91', flag: '🇮🇳' },
      'AU': { code: 'AU', name: 'Australia', callingCode: '61', flag: '🇦🇺' },
      'DE': { code: 'DE', name: 'Germany', callingCode: '49', flag: '🇩🇪' },
      'FR': { code: 'FR', name: 'France', callingCode: '33', flag: '🇫🇷' },
      'JP': { code: 'JP', name: 'Japan', callingCode: '81', flag: '🇯🇵' },
      'BR': { code: 'BR', name: 'Brazil', callingCode: '55', flag: '🇧🇷' },
      'MX': { code: 'MX', name: 'Mexico', callingCode: '52', flag: '🇲🇽' },
    };
    
    return countries[isoCode] || null;
  };

  const clearFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPasscode('');
    setError('');
  };

  const validateForm = () => {
    if (!firstName || !lastName) {
      setError('First and last name are required');
      return false;
    }
    
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!passcode) {
      setError('Passcode is required');
      return false;
    }
    if (passcode.length !== 6) {
      setError('Passcode must be exactly 6 digits');
      return false;
    }
    if (!/^\d{6}$/.test(passcode)) {
      setError('Passcode must contain only numbers');
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');

    try {
      // Format phone number with country code if provided
      let formattedPhone = phone.trim();
      if (formattedPhone && selectedCountry) {
        // Remove any existing country code and add the selected one
        formattedPhone = formattedPhone.replace(/^\+?\d{1,4}/, ''); // Remove existing country code
        formattedPhone = `+${selectedCountry.callingCode}${formattedPhone}`;
      }

      const displayName = `${firstName} ${lastName}`;
      const authData = isSupabaseConfigured
        ? await authService.signUp(email, passcode, displayName)
        : { user: { id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }, session: null };

      if (!authData.user) throw new Error('Failed to create user');

      if (isSupabaseConfigured && authData.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: formattedPhone || null,
            display_name: displayName,
            email: email.trim(),
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.warn('Profile update after signup failed:', profileError.message);
        }
      }

      if (!isSupabaseConfigured) {
        const newPlayer = {
          id: authData.user.id,
          email: email.trim(),
          phone: formattedPhone || undefined,
          name: displayName,
          gamesPlayed: 0,
          gamesWon: 0,
          role: 'player' as const
        };

        const players = await storage.getPlayers();
        await storage.savePlayers([...players, newPlayer]);
      }

      if (isSupabaseConfigured && !authData.session) {
        Alert.alert(
          'Confirm Your Email',
          'Your account was created, but you must confirm your email before you can sign in. Check your inbox, then return here and sign in with your email and 6-digit passcode.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
        return;
      }

      if (isSupabaseConfigured && authData.session) {
        Alert.alert(
          'Account Created Successfully',
          'You are signed in and ready to play.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      Alert.alert(
        'Account Created Successfully',
        'Your account has been created. You can now login using your email and 6-digit passcode.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );

    } catch (err) {
      console.error('Registration error:', err);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Create account
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            You'll use your email and a 6-digit passcode to sign in.
          </Text>
        </View>

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall" style={styles.groupLabel}>
              Your name
            </Text>
            <View style={styles.nameRow}>
              <TextInput
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                mode="outlined"
                disabled={loading}
                style={styles.nameInput}
              />
              <TextInput
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                mode="outlined"
                disabled={loading}
                style={styles.nameInput}
              />
            </View>

            <Text variant="titleSmall" style={styles.groupLabel}>
              Sign-in details
            </Text>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              disabled={loading}
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
                disabled={loading}
                left={<TextInput.Icon icon="lock-outline" />}
              />
              <HelperText type="info" visible>
                Numbers only — this is your quick login code.
              </HelperText>
            </View>

            <Text variant="titleSmall" style={styles.groupLabel}>
              Contact (optional)
            </Text>
            <View>
              <TextInput
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                mode="outlined"
                keyboardType="phone-pad"
                disabled={loading}
                left={<TextInput.Icon icon="phone-outline" />}
              />
              {selectedCountry && (
                <HelperText type="info" visible>
                  {selectedCountry.flag} {selectedCountry.name} (+{selectedCountry.callingCode})
                </HelperText>
              )}
            </View>

            {error ? (
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              contentStyle={styles.primaryContent}
              labelStyle={styles.primaryLabel}
            >
              Create account
            </Button>

            <Button
              mode="text"
              onPress={clearFields}
              disabled={loading}
              contentStyle={styles.secondaryContent}
            >
              Clear form
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footerRow}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Already have an account?
          </Text>
          <Button
            mode="text"
            onPress={() => router.push('/(auth)/login')}
            disabled={loading}
            compact
          >
            Sign in
          </Button>
        </View>
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
  header: {
    gap: spacing.xs,
  },
  title: {
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  groupLabel: {
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameInput: {
    flex: 1,
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});

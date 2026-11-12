import { normalizeEmail, parsePlayerNo } from '@/utils/playerIdentity';
import { COUNTRIES, Country, DEFAULT_COUNTRY, internationalPhone, phoneForCountryProblem, postalProblem } from '@/utils/countries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_PLAYER_NO_KEY } from '@/services/playerIdentity';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Text, HelperText, Menu } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { AuthShell } from '../../components/ui/AuthShell';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { sendWelcomeEmail } from '@/services/mail';
import { HELP } from '@/constants/help';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../constants/theme';
// import * as Location from 'expo-location';

export default function RegisterScreen() {
  const theme = useAppTheme();
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [zip, setZip] = React.useState('');
  const [playerIdText, setPlayerIdText] = React.useState('');
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [passcode, setPasscode] = React.useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryOpen, setCountryOpen] = useState(false);

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
      const phoneIssue = phoneForCountryProblem(country, phone);
      if (phoneIssue) throw new Error(phoneIssue);
      const postalIssue = postalProblem(country, zip);
      if (postalIssue) throw new Error(postalIssue);
      const formattedPhone = internationalPhone(country, phone) ?? '';

      const displayName = `${firstName} ${lastName}`;
      const zipCode = zip.trim() || null;
      const claimNo = playerIdText.trim() ? parsePlayerNo(playerIdText) : null;
      if (playerIdText.trim() && claimNo == null) throw new Error('A player ID is a number, like #42.');
      // Sent to the creator after the first sign-in (once the email is confirmed).
      if (claimNo != null) await AsyncStorage.setItem(PENDING_PLAYER_NO_KEY, String(claimNo));
      const cleanEmail = normalizeEmail(email);
      const authData = isSupabaseConfigured
        ? await authService.signUp(cleanEmail, passcode, displayName, { phone: formattedPhone || null, zip_code: zipCode })
        : { user: { id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }, session: null };

      if (!authData.user) throw new Error('Failed to create user');

      if (isSupabaseConfigured && authData.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: formattedPhone || null,
            zip_code: zipCode,
            display_name: displayName,
            email: cleanEmail,
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.warn('Profile update after signup failed:', profileError.message);
        }
      }

      if (!isSupabaseConfigured) {
        const newPlayer = {
          id: authData.user.id,
          email: cleanEmail,
          phone: formattedPhone || undefined,
          zipCode: zipCode || undefined,
          status: 'registered' as const,
          emailVerified: true,
          name: displayName,
          gamesPlayed: 0,
          gamesWon: 0,
          role: 'player' as const
        };

        const players = await storage.getPlayers();
        await storage.savePlayers([...players, newPlayer]);
      }

      if (isSupabaseConfigured) {
        sendWelcomeEmail(cleanEmail, displayName).catch(() => {});
      }

      if (isSupabaseConfigured && !authData.session) {
        setCheckEmail(cleanEmail);
        return;
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

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${checkEmail}.`} help={HELP.createAccount}>
        <Text variant="bodyMedium">
          Open the link to confirm your email, then sign in with your email and 6-digit passcode. If you opened a link from a friend, you will be asked “Is this you?” the first time you sign in.
        </Text>
        <Button mode="outlined" icon="email-sync-outline" style={{ marginTop: 16 }}
          onPress={() => authService.resendConfirmation(checkEmail).then(() => setError('Sent again.')).catch((e) => setError(formatAuthError(e)))}>
          Resend the link
        </Button>
        {error ? <HelperText type="info" visible>{error}</HelperText> : null}
        <Button mode="contained" style={{ marginTop: 8 }} onPress={() => router.replace({ pathname: '/(auth)/login', params: { email: checkEmail } })}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="You'll use your email and a 6-digit passcode to sign in."
      help={HELP.createAccount}
      footer={
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
      }
    >
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

      <HelperText type="info" visible>
        We send a link to confirm this email. It is how you sign in.
      </HelperText>
      <PasscodeField value={passcode} onChangeText={setPasscode} disabled={loading} />
      <HelperText type="info" visible>
        Numbers only. This is what you sign in with.
      </HelperText>

      <Text variant="titleSmall" style={styles.groupLabel}>
        Player ID <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Optional</Text>
      </Text>
      <TextInput
        label="Player ID"
        placeholder="#42"
        value={playerIdText}
        onChangeText={(t) => setPlayerIdText(t.replace(/[^0-9#]/g, '').slice(0, 13))}
        mode="outlined"
        keyboardType="number-pad"
        disabled={loading}
        left={<TextInput.Icon icon="pound" />}
      />
      <HelperText type="info" visible>
        Enter your player ID if you were given one by an organizer; otherwise leave it empty.
      </HelperText>

      <Button mode="text" onPress={() => setPhoneOpen((open) => !open)} icon={phoneOpen ? 'chevron-up' : 'chevron-down'}>
        Optional: country, phone and {country.postalLabel.toLowerCase()}
      </Button>
      {phoneOpen ? (
        <View style={styles.contact}>
          <HelperText type="info" visible>
            All optional. We never text you and never ask for your address.
          </HelperText>
          <Menu
            visible={countryOpen}
            onDismiss={() => setCountryOpen(false)}
            anchor={(
              <Button
                mode="outlined"
                icon="chevron-down"
                contentStyle={styles.countryButton}
                onPress={() => setCountryOpen(true)}
                disabled={loading}
                accessibilityLabel="Country"
              >
                {country.flag} {country.name}{country.callingCode ? ` (+${country.callingCode})` : ''}
              </Button>
            )}
          >
            {COUNTRIES.map((item) => (
              <Menu.Item
                key={item.code}
                title={`${item.flag} ${item.name}${item.callingCode ? ` (+${item.callingCode})` : ''}`}
                onPress={() => { setCountry(item); setCountryOpen(false); }}
              />
            ))}
          </Menu>
          <TextInput
            label={country.callingCode ? `Phone (+${country.callingCode})` : 'Phone with country code'}
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            autoComplete="tel"
            disabled={loading}
            left={<TextInput.Icon icon="phone-outline" />}
            accessibilityLabel="Phone"
          />
          <TextInput
            label={country.postalLabel}
            placeholder={country.postalExample}
            value={zip}
            onChangeText={(t) => setZip(t.replace(/[^0-9A-Za-z -]/g, '').slice(0, 12))}
            mode="outlined"
            autoCapitalize="characters"
            keyboardType={/^\d+$/.test(country.postalExample) ? 'number-pad' : 'default'}
            disabled={loading}
            left={<TextInput.Icon icon="map-marker-outline" />}
            accessibilityLabel={country.postalLabel}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.signInError}>
          <HelperText type="error" visible>
            {error}
          </HelperText>
          {/sign(?:ing)? in/i.test(error) ? (
            <Button
              mode="contained-tonal"
              icon="login"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { email: email.trim() } })}
            >
              Sign in
            </Button>
          ) : null}
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={handleRegister}
        loading={loading}
        disabled={loading}
        style={styles.pill}
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
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  contact: { gap: 8 },
  countryButton: { justifyContent: 'flex-start', height: 48 },
  groupLabel: {
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameInput: {
    flex: 1,
  },
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  signInError: {
    gap: spacing.xs,
  },
});

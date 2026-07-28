import React, { useState } from 'react';
import { View, StyleSheet, Linking, Alert, Platform, ActivityIndicator } from 'react-native';
import { Text, TextInput, Button, Avatar, HelperText, Icon, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import * as SMS from 'expo-sms';
import { playersService } from '@/services/players';
import { Player } from '@/types/player';
import { isSupabaseConfigured } from '@/services/supabase';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/constants/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_MESSAGE =
  'Join me on Rummy Home! Create an account with your email, then I can add you when we start a game.';

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

export default function FindPlayersScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setError('');

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured on this device.');
      setResults([]);
      return;
    }

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const players = await playersService.searchPlayers(query);
      setResults(players);
    } catch (err: any) {
      console.error('Player search failed:', err);
      setError(err?.message ?? 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const sendEmailInvite = async () => {
    setInviteError('');
    const email = inviteEmail.trim();
    if (!EMAIL_REGEX.test(email)) {
      setInviteError('Enter a valid email address to send an email invite.');
      return;
    }

    const subject = encodeURIComponent('Join me on Rummy Home');
    const body = encodeURIComponent(INVITE_MESSAGE);
    try {
      await Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert('Could not open email', 'Copy this message and send it yourself.');
    }
  };

  const sendWhatsAppInvite = async () => {
    setInviteError('');
    const phone = digitsOnly(invitePhone);
    if (phone.length < 8) {
      setInviteError('Enter a phone number with country code for WhatsApp (digits only is fine).');
      return;
    }

    const text = encodeURIComponent(INVITE_MESSAGE);
    // The whatsapp:// scheme opens the standard app directly; wa.me links let
    // Android offer WhatsApp Business as well.
    const appUrl = `whatsapp://send?phone=${phone}&text=${text}`;
    const webUrl = `https://wa.me/${phone}?text=${text}`;

    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('Could not open WhatsApp', 'Try Text or Email instead.');
    }
  };

  const sendTextInvite = async () => {
    setInviteError('');
    const phone = invitePhone.trim();
    if (digitsOnly(phone).length < 8) {
      setInviteError('Enter a phone number to send a text invite.');
      return;
    }

    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([phone], INVITE_MESSAGE);
        return;
      }

      // Fallback: open the platform SMS composer via URL
      const separator = Platform.OS === 'ios' ? '&' : '?';
      await Linking.openURL(`sms:${phone}${separator}body=${encodeURIComponent(INVITE_MESSAGE)}`);
    } catch {
      Alert.alert('Could not open Messages', 'Try WhatsApp or Email instead.');
    }
  };

  const showNoMatches = searchQuery.trim().length >= 3 && !searching && results.length === 0;

  return (
    <Screen>
      <SectionCard
        title="Search registered players"
        supportingText="Look someone up by their exact email, phone number, or player ID."
      >
        <TextInput
          mode="outlined"
          value={searchQuery}
          onChangeText={handleSearch}
          label="Email, phone, or player ID"
          autoCapitalize="characters"
          autoCorrect={false}
          left={<TextInput.Icon icon="account-search" />}
        />

        <View style={styles.privacyNote}>
          <Icon source="shield-check-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodySmall" style={[styles.privacyText, { color: theme.colors.onSurfaceVariant }]}>
            Names aren’t searchable on purpose. Everyone can find their own player ID under Profile
            and share it with you.
          </Text>
        </View>
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}

        {searching ? (
          <View style={styles.searchingRow}>
            <ActivityIndicator size="small" />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Searching…
            </Text>
          </View>
        ) : null}

        {results.length > 0 ? (
          <View style={styles.results}>
            {results.map((player) => (
              <View key={player.id} style={styles.resultRow}>
                <Avatar.Text
                  size={40}
                  label={(player.name?.[0] ?? '?').toUpperCase()}
                  style={{ backgroundColor: theme.colors.secondaryContainer }}
                  color={theme.colors.onSecondaryContainer}
                />
                <View style={styles.resultText}>
                  <Text variant="bodyLarge" numberOfLines={1}>
                    {player.name}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    numberOfLines={1}
                  >
                    {player.playerCode ? `Player ID ${player.playerCode}` : 'Registered player'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {showNoMatches ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
            Nothing matched “{searchQuery}”. Check the spelling, or invite them below if they haven’t
            signed up yet.
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Invite someone new"
        supportingText="They register in the app, then appear in the player list when you start a game."
      >
        <TextInput
          mode="outlined"
          label="Email"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          left={<TextInput.Icon icon="email-outline" />}
        />
        <Button
          mode="contained"
          icon="email-fast-outline"
          onPress={sendEmailInvite}
          contentStyle={styles.buttonContent}
        >
          Invite by email
        </Button>

        <TextInput
          mode="outlined"
          label="Phone with country code"
          value={invitePhone}
          onChangeText={setInvitePhone}
          keyboardType="phone-pad"
          left={<TextInput.Icon icon="phone-outline" />}
        />
        <View style={styles.inviteRow}>
          <Button
            mode="contained-tonal"
            icon="whatsapp"
            onPress={sendWhatsAppInvite}
            style={styles.inviteButton}
            contentStyle={styles.buttonContent}
          >
            WhatsApp
          </Button>
          <Button
            mode="contained-tonal"
            icon="message-text-outline"
            onPress={sendTextInvite}
            style={styles.inviteButton}
            contentStyle={styles.buttonContent}
          >
            Text
          </Button>
        </View>

        {inviteError ? (
          <HelperText type="error" visible>
            {inviteError}
          </HelperText>
        ) : null}
      </SectionCard>

      <Button
        mode="outlined"
        icon="cards-playing-outline"
        onPress={() => router.push('/(screens)/games/new')}
        contentStyle={styles.buttonContent}
      >
        Go to New Game
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  privacyText: {
    flex: 1,
    lineHeight: 18,
  },
  results: {
    gap: spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 64,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inviteButton: {
    flex: 1,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
});

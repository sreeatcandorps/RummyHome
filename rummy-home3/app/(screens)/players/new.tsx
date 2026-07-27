import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, Platform } from 'react-native';
import { Text, TextInput, Button, List, Avatar, Surface, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import * as SMS from 'expo-sms';
import { playersService } from '@/services/players';
import { Player } from '@/types/player';
import { isSupabaseConfigured } from '@/services/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_MESSAGE =
  'Join me on Rummy Home! Create an account with your email, then I can add you when we start a game.';

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

export default function FindPlayersScreen() {
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

    if (query.trim().length < 2) {
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

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(INVITE_MESSAGE)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('WhatsApp not available', 'Install WhatsApp or use Text / email instead.');
        return;
      }
      await Linking.openURL(url);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Find Players</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Search people who already have a Rummy Home account. To bring someone new in, invite them
        below — then add them from New Game after they register.
      </Text>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Search registered players</Text>
        <Text variant="bodySmall" style={styles.hint}>
          Search by name, email, or phone.
        </Text>
        <TextInput
          mode="outlined"
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Name, email, or phone"
          left={<TextInput.Icon icon="account-search" />}
          style={styles.input}
        />
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        {searching ? <Text style={styles.hint}>Searching…</Text> : null}

        <View style={styles.results}>
          {results.map((player) => (
            <List.Item
              key={player.id}
              title={player.name}
              description={[player.email, player.phone].filter(Boolean).join(' · ') || 'Registered player'}
              left={(props) => (
                <Avatar.Text
                  {...props}
                  size={40}
                  label={(player.name?.[0] ?? '?').toUpperCase()}
                />
              )}
            />
          ))}
          {searchQuery.trim().length >= 2 && !searching && results.length === 0 ? (
            <Text style={styles.hint}>
              No registered players matched “{searchQuery}”. Invite them below if they’re new.
            </Text>
          ) : null}
        </View>
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Invite someone new</Text>
        <Text variant="bodySmall" style={styles.hint}>
          Choose email, WhatsApp, or text. They register in the app, then appear under Select Players.
        </Text>

        <TextInput
          mode="outlined"
          label="Email (for email invite)"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Phone (for WhatsApp / text)"
          value={invitePhone}
          onChangeText={setInvitePhone}
          keyboardType="phone-pad"
          style={styles.input}
          placeholder="+1 555 123 4567"
        />
        {inviteError ? <HelperText type="error" visible>{inviteError}</HelperText> : null}

        <Button mode="contained" icon="email" onPress={sendEmailInvite} style={styles.button}>
          Invite by Email
        </Button>
        <Button mode="contained" icon="whatsapp" onPress={sendWhatsAppInvite} style={styles.button}>
          Invite by WhatsApp
        </Button>
        <Button mode="contained" icon="message-text" onPress={sendTextInvite} style={styles.button}>
          Invite by Text
        </Button>
      </Surface>

      <Button mode="outlined" onPress={() => router.push('/(screens)/games/new')} style={styles.button}>
        Go to New Game
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 16,
    color: '#555',
    lineHeight: 20,
  },
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  input: {
    marginBottom: 8,
  },
  results: {
    maxHeight: 240,
  },
  hint: {
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  button: {
    marginTop: 8,
  },
});

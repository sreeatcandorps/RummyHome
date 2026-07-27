import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../../utils/storage';
import { Player } from '../../../../types/player';
import { authService } from '../../../../services/auth';
import { isSupabaseConfigured, supabase } from '../../../../services/supabase';
import { formatSupabaseError } from '../../../../utils/supabaseErrors';

export default function EditPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    setLoading(true);
    setError('');
    try {
      if (!id || typeof id !== 'string') {
        setError('Player not found');
        return;
      }

      if (isSupabaseConfigured) {
        const currentId = await authService.getCurrentUserId();
        setIsSelf(currentId === id);

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!data) {
          setError('Player not found');
          return;
        }

        setName(data.display_name ?? '');
        setEmail(data.email ?? '');
        setPhone(data.phone ?? '');
        return;
      }

      const players = await storage.getPlayers();
      const player = players.find((p) => p.id === id);
      if (!player) {
        setError('Player not found');
        return;
      }
      setName(player.name);
      setEmail(player.email || '');
      setPhone(player.phone || '');
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlayer = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isSupabaseConfigured) {
        if (!isSelf) {
          setError('You can only edit your own profile.');
          return;
        }

        await authService.updateProfile({
          displayName: name.trim(),
          phone: phone.trim() || undefined,
          // Email changes go through the dedicated Change Email flow (needs confirmation).
        });

        // Keep profiles.email in sync if present; do not change auth email here.
        if (email.trim()) {
          const userId = await authService.getCurrentUserId();
          if (userId) {
            await supabase
              .from('profiles')
              .update({ email: email.trim() })
              .eq('id', userId);
          }
        }

        Alert.alert('Saved', 'Your profile was updated.');
        router.back();
        return;
      }

      const players = await storage.getPlayers();
      const playerIndex = players.findIndex((p) => p.id === id);
      if (playerIndex === -1) {
        setError('Player not found');
        return;
      }

      const updatedPlayer: Player = {
        ...players[playerIndex],
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      players[playerIndex] = updatedPlayer;
      await storage.savePlayers(players);
      router.back();
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Edit Profile
      </Text>

      <TextInput
        label="Display name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError('');
        }}
        mode="outlined"
        style={styles.input}
        error={!!error && !name.trim()}
      />

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        disabled={isSupabaseConfigured}
      />
      {isSupabaseConfigured ? (
        <HelperText type="info" visible>
          To change login email, use Change Email on your profile screen.
        </HelperText>
      ) : null}

      <TextInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        mode="outlined"
        style={styles.input}
        keyboardType="phone-pad"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        mode="contained"
        onPress={handleUpdatePlayer}
        style={styles.button}
        loading={saving}
        disabled={saving || !!error && error === 'Player not found'}
      >
        Save
      </Button>

      <Button mode="outlined" onPress={() => router.back()} style={styles.button}>
        Cancel
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
});

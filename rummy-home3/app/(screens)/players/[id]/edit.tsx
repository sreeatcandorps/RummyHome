import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../../utils/storage';
import { Player } from '../../../../types/player';
import { authService } from '../../../../services/auth';
import { isSupabaseConfigured, supabase } from '../../../../services/supabase';
import { formatSupabaseError } from '../../../../utils/supabaseErrors';
import { Screen } from '../../../../components/ui/Screen';
import { SectionCard } from '../../../../components/ui/SectionCard';
import { MIN_TOUCH_TARGET, spacing } from '../../../../constants/theme';

export default function EditPlayerScreen() {
  const theme = useTheme();
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
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <SectionCard
        title="Your details"
        supportingText="This name is what other players see in games and invites."
      >
        <TextInput
          label="Display name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError('');
          }}
          mode="outlined"
          error={!!error && !name.trim()}
          left={<TextInput.Icon icon="account-outline" />}
        />

        <View>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            disabled={isSupabaseConfigured}
            left={<TextInput.Icon icon="email-outline" />}
          />
          {isSupabaseConfigured ? (
            <HelperText type="info" visible>
              To change your login email, use Change Email on the profile screen.
            </HelperText>
          ) : null}
        </View>

        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          mode="outlined"
          keyboardType="phone-pad"
          left={<TextInput.Icon icon="phone-outline" />}
        />

        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </SectionCard>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={handleUpdatePlayer}
          loading={saving}
          disabled={saving || (!!error && error === 'Player not found')}
          icon="content-save-outline"
          contentStyle={styles.primaryContent}
          labelStyle={styles.primaryLabel}
        >
          Save changes
        </Button>

        <Button mode="text" onPress={() => router.back()} contentStyle={styles.secondaryContent}>
          Cancel
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: spacing.sm,
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
});

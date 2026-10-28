import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Menu, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PrizeSession, sessionsService } from '@/services/sessions';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { balancesAfterEntries, coinSum, isSettled, openingBalances, PrizeLeg } from '@/utils/prizeSession';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';

type DraftLeg = { profileId: string; amount: string };

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

export default function PrizeSessionScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams();
  const [session, setSession] = useState<PrizeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [legs, setLegs] = useState<DraftLeg[]>([
    { profileId: '', amount: '' },
    { profileId: '', amount: '' },
  ]);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (typeof id !== 'string') return;
    setError(null);
    try {
      const next = await sessionsService.get(id);
      setSession(next);
      if (!next) setError('This session could not be found.');
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="scale-balance" title="No session" message={error ?? 'This prize distribution is missing.'} />
      </Screen>
    );
  }

  const names = new Map<string, string>();
  session.games.forEach((game) => game.players.forEach((player) => names.set(player.id, player.name ?? 'Player')));
  const people = [...names.entries()].map(([profileId, name]) => ({ profileId, name }));
  const opening = openingBalances(session.games);
  const balances = balancesAfterEntries(opening, session.entries);
  const settled = session.status === 'settled' || isSettled(balances);
  const draftTotal = legs.reduce((sum, leg) => sum + (Number(leg.amount) || 0), 0);

  const saveEntry = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: PrizeLeg[] = legs
        .filter((leg) => leg.profileId)
        .map((leg) => ({ profileId: leg.profileId, amount: Number(leg.amount) }));
      const next = await sessionsService.addEntry(session.id, payload, note.trim());
      setSession(next);
      setNote('');
      setLegs([
        { profileId: '', amount: '' },
        { profileId: '', amount: '' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SectionCard
        title={settled ? 'Settled' : 'Open'}
        icon={settled ? 'check-decagram' : 'scale-balance'}
        supportingText="Coins start from the game points or pool prize. Each entry must add to 0."
      >
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Starting coins add to {coinSum(opening)}. Current balances add to {coinSum(balances)}.
        </Text>
        {people.map((person) => (
          <View key={person.profileId} style={styles.balanceRow}>
            <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>{person.name}</Text>
            <Text variant="bodyMedium" style={[tabularNums, { color: colors.onSurfaceVariant }]}>
              {signed(opening[person.profileId] ?? 0)}
            </Text>
            <Text variant="titleMedium" style={tabularNums}>
              {signed(balances[person.profileId] ?? 0)}
            </Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Ledger" icon="format-list-bulleted">
        {session.entries.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            No entries yet.
          </Text>
        ) : (
          session.entries.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text variant="labelLarge">{entry.note || 'Entry'}</Text>
              {entry.legs.map((leg, index) => (
                <Text key={`${entry.id}-${index}`} variant="bodyMedium" style={tabularNums}>
                  {names.get(leg.profileId) ?? 'Player'} {signed(leg.amount)}
                </Text>
              ))}
            </View>
          ))
        )}
      </SectionCard>

      {settled ? null : (
        <SectionCard title="Add entry" icon="plus" supportingText="One entry can have several legs. They must add to 0.">
          {legs.map((leg, index) => (
            <View key={index} style={styles.legRow}>
              <Menu
                visible={menuIndex === index}
                onDismiss={() => setMenuIndex(null)}
                anchor={
                  <Button mode="outlined" onPress={() => setMenuIndex(index)} style={styles.personButton}>
                    {names.get(leg.profileId) ?? 'Player'}
                  </Button>
                }
              >
                {people.map((person) => (
                  <Menu.Item
                    key={person.profileId}
                    title={person.name}
                    onPress={() => {
                      setLegs((current) => current.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, profileId: person.profileId } : item
                      )));
                      setMenuIndex(null);
                    }}
                  />
                ))}
              </Menu>
              <TextInput
                mode="outlined"
                dense
                label="Coins"
                value={leg.amount}
                keyboardType="numbers-and-punctuation"
                onChangeText={(text) => setLegs((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, amount: text.replace(/[^0-9-]/g, '') } : item
                )))}
                style={styles.amount}
              />
            </View>
          ))}
          <Button mode="text" icon="plus" onPress={() => setLegs((current) => [...current, { profileId: '', amount: '' }])}>
            Add leg
          </Button>
          <TextInput mode="outlined" label="Note" value={note} onChangeText={setNote} />
          <Text variant="bodySmall" style={{ color: draftTotal === 0 ? colors.onSurfaceVariant : colors.error }}>
            These legs add to {draftTotal}.
          </Text>
          {error ? <Text variant="bodySmall" style={{ color: colors.error }}>{error}</Text> : null}
          <Button mode="contained" onPress={saveEntry} loading={saving} disabled={saving}>
            Save entry
          </Button>
        </SectionCard>
      )}
      {error && settled ? <Text variant="bodySmall" style={{ color: colors.error }}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  name: {
    flex: 1,
    fontWeight: '600',
  },
  entry: {
    gap: 2,
    paddingVertical: spacing.sm,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personButton: {
    flex: 1,
  },
  amount: {
    width: 110,
  },
});

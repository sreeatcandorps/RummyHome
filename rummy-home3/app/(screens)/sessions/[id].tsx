import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { settleEnabled } from '@/constants/features';
import { PrizeSession, sessionsService } from '@/services/sessions';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { balancesAfterEntries, coinSum, isSettled, openingBalances, PrizeLeg, validateLegs } from '@/utils/prizeSession';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

export default function SettleLedger() {
  if (!settleEnabled) return <Redirect href="/(tabs)" />;
  return <SettleLedgerBody />;
}

function SettleLedgerBody() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams();
  const [session, setSession] = useState<PrizeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [coins, setCoins] = useState('');
  const [multi, setMulti] = useState(false);
  const [extra, setExtra] = useState<{ profileId: string; amount: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (typeof id !== 'string') return;
    setError(null);
    try {
      const next = await sessionsService.get(id);
      setSession(next);
      if (!next) setError('This settlement could not be found.');
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (loading && !session) return <Screen><LoadingRows /></Screen>;
  if (!session) {
    return (
      <Screen>
        <EmptyState icon="scale-balance" title="No settlement" message={error ?? 'This settlement is missing.'} actionLabel="Retry" onAction={load} />
      </Screen>
    );
  }

  const names = new Map<string, string>();
  session.games.forEach((game) => game.players.forEach((player) => names.set(player.id, player.name ?? 'Player')));
  const people = [...names.entries()].map(([profileId, name]) => ({ profileId, name }));
  const opening = openingBalances(session.games);
  const balances = balancesAfterEntries(opening, session.entries);
  const settled = session.status === 'settled' || isSettled(balances);
  const openingSum = coinSum(opening);

  const clearForm = () => {
    setFromId('');
    setToId('');
    setCoins('');
    setMulti(false);
    setExtra([]);
    setEditingId(null);
  };

  const draftLegs = (): PrizeLeg[] => {
    if (!multi) {
      const amount = Number(coins);
      if (!fromId || !toId || !Number.isInteger(amount) || amount <= 0) return [];
      return [
        { profileId: fromId, amount: -amount },
        { profileId: toId, amount },
      ];
    }
    return extra
      .filter((leg) => leg.profileId && leg.amount !== '' && leg.amount !== '-')
      .map((leg) => ({ profileId: leg.profileId, amount: Number(leg.amount) }));
  };

  const legs = draftLegs();
  const check = validateLegs(legs);
  const noteFor = (payload: PrizeLeg[]) => {
    if (payload.length === 2) {
      const payer = payload.find((leg) => leg.amount < 0);
      const payee = payload.find((leg) => leg.amount > 0);
      if (payer && payee) {
        return `${names.get(payer.profileId) ?? 'Player'} paid ${names.get(payee.profileId) ?? 'Player'} ${Math.abs(payee.amount)}`;
      }
    }
    return 'Payment';
  };

  const save = async () => {
    if (!check.ok) return;
    setSaving(true);
    setError(null);
    try {
      const note = noteFor(legs);
      const next = editingId
        ? await sessionsService.updateEntry(session.id, editingId, legs, note)
        : await sessionsService.addEntry(session.id, legs, note);
      setSession(next);
      clearForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const editEntry = (entryId: string) => {
    if (settled) return;
    const entry = session.entries.find((item) => item.id === entryId);
    if (!entry) return;
    setEditingId(entry.id);
    if (entry.legs.length === 2) {
      const payer = entry.legs.find((leg) => leg.amount < 0);
      const payee = entry.legs.find((leg) => leg.amount > 0);
      if (payer && payee && payer.amount === -payee.amount) {
        setMulti(false);
        setFromId(payer.profileId);
        setToId(payee.profileId);
        setCoins(String(payee.amount));
        return;
      }
    }
    setMulti(true);
    setExtra(entry.legs.map((leg) => ({ profileId: leg.profileId, amount: String(leg.amount) })));
  };

  return (
    <Screen>
      <Text variant="titleMedium">{session.games.length} {session.games.length === 1 ? 'game' : 'games'} · {settled ? 'Settled' : 'not settled'}</Text>
      {openingSum !== 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          These coins add to {openingSum}. The expense column is not a person, so payments between people keep that total.
        </Text>
      ) : null}
      <View style={styles.head}>
        <Text style={styles.name}>Name</Text>
        <Text style={[tabularNums, styles.col]}>Start</Text>
        <Text style={[tabularNums, styles.col]}>Now</Text>
      </View>
      {people.map((person) => (
        <View key={person.profileId} style={styles.balanceRow}>
          <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>{person.name}</Text>
          <Text style={[tabularNums, styles.col]}>{signed(opening[person.profileId] ?? 0)}</Text>
          <Text variant="titleMedium" style={[tabularNums, styles.col]}>{signed(balances[person.profileId] ?? 0)}</Text>
        </View>
      ))}

      {settled ? null : (
        <View style={styles.form}>
          <Text variant="titleMedium">{editingId ? 'Change payment' : 'Record a payment'}</Text>
          {multi ? (
            extra.map((leg, index) => (
              <View key={index} style={styles.multi}>
                <View style={styles.people}>
                  {people.map((person) => (
                    <Button
                      key={person.profileId}
                      compact
                      mode={leg.profileId === person.profileId ? 'contained' : 'outlined'}
                      onPress={() => setExtra((current) => current.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, profileId: person.profileId } : item
                      )))}
                    >
                      {person.name}
                    </Button>
                  ))}
                </View>
                <TextInput
                  mode="outlined"
                  dense
                  label="Coins"
                  value={leg.amount}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(text) => setExtra((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, amount: text.replace(/[^0-9-]/g, '') } : item
                  )))}
                />
              </View>
            ))
          ) : (
            <View>
              <Text variant="labelLarge">From</Text>
              <View style={styles.people}>
                {people.map((person) => (
                  <Button key={person.profileId} compact mode={fromId === person.profileId ? 'contained' : 'outlined'} onPress={() => setFromId(person.profileId)}>
                    {person.name}
                  </Button>
                ))}
              </View>
              <Text variant="labelLarge">To</Text>
              <View style={styles.people}>
                {people.map((person) => (
                  <Button key={person.profileId} compact mode={toId === person.profileId ? 'contained' : 'outlined'} onPress={() => setToId(person.profileId)}>
                    {person.name}
                  </Button>
                ))}
              </View>
              <TextInput mode="outlined" label="Coins" value={coins} keyboardType="number-pad" onChangeText={(text) => setCoins(text.replace(/[^0-9]/g, ''))} />
            </View>
          )}
          <Text variant="bodySmall" style={{ color: check.ok ? colors.onSurfaceVariant : colors.error }}>
            {legs.length === 0 ? 'Adds to 0.' : check.ok ? 'Adds to 0.' : check.error}
          </Text>
          {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
          <Button mode="contained" onPress={save} loading={saving} disabled={!check.ok || saving}>
            Save payment
          </Button>
          <Button mode="text" onPress={() => {
            if (multi) {
              setMulti(false);
              return;
            }
            setMulti(true);
            setExtra(people.map((person) => ({ profileId: person.profileId, amount: '' })));
          }}>
            More than two people?
          </Button>
        </View>
      )}

      <Text variant="titleMedium" style={styles.payments}>Payments</Text>
      {session.entries.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>None yet — tap a row to edit</Text>
      ) : (
        [...session.entries].reverse().map((entry) => (
          <Pressable key={entry.id} onPress={() => editEntry(entry.id)} disabled={settled} style={styles.entry} accessibilityRole="button">
            <Text variant="titleSmall">{entry.note || 'Payment'}</Text>
            {entry.legs.map((leg, index) => (
              <Text key={`${entry.id}-${index}`} style={tabularNums}>
                {names.get(leg.profileId) ?? 'Player'} {signed(leg.amount)}
              </Text>
            ))}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  name: {
    flex: 1,
  },
  col: {
    width: 64,
    textAlign: 'right',
  },
  form: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  people: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  multi: {
    marginBottom: spacing.sm,
  },
  payments: {
    marginTop: spacing.lg,
  },
  entry: {
    paddingVertical: spacing.sm,
  },
});

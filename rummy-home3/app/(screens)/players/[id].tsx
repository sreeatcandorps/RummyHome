import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Dialog, IconButton, List, Portal, Text, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import { playersService } from '../../../services/players';
import { authService } from '../../../services/auth';
import { isSupabaseConfigured } from '../../../services/supabase';
import { Screen } from '../../../components/ui/Screen';
import { SectionCard } from '../../../components/ui/SectionCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../../constants/theme';

export default function PlayerDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showIdInfo, setShowIdInfo] = useState(false);

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    try {
      if (isSupabaseConfigured) {
        const [found, currentUserId] = await Promise.all([
          playersService.getPlayer(String(id)),
          authService.getCurrentUserId(),
        ]);
        setPlayer(found);
        setIsSelf(!!found && found.id === currentUserId);
        return;
      }

      const players = await storage.getPlayers();
      setPlayer(players.find((candidate) => candidate.id === id) ?? null);
    } catch (error) {
      console.error('Error loading player:', error);
    } finally {
      setLoading(false);
    }
  };

  const sharePlayerId = async () => {
    if (!player?.playerCode) return;

    try {
      await Share.share({
        message: isSelf
          ? `Add me on Rummy Home. My player ID is ${player.playerCode}.`
          : `${player.name} on Rummy Home — player ID ${player.playerCode}.`,
      });
    } catch (error) {
      console.error('Share player ID failed:', error);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!player) {
    return (
      <Screen>
        <EmptyState
          icon="account-question-outline"
          title="Player not found"
          message="This player may have been removed."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card mode="contained" style={[styles.hero, { backgroundColor: theme.colors.elevation.level2 }]}>
        <Card.Content style={styles.heroContent}>
          <Avatar.Text
            size={72}
            label={getInitials(player.name)}
            style={{
              backgroundColor: player.role === 'admin' ? theme.colors.error : theme.colors.primary,
            }}
          />
          <Text variant="headlineSmall" style={styles.heroName}>
            {player.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {player.role === 'admin' ? 'App admin' : 'Player'}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.idCard}>
        <Card.Content style={styles.idContent}>
          <View style={styles.idHeader}>
            <Text variant="titleMedium" style={styles.idTitle}>
              Player ID
            </Text>
            <IconButton
              icon="information-outline"
              size={20}
              accessibilityLabel="What is a player ID?"
              onPress={() => setShowIdInfo(true)}
            />
          </View>

          <View style={styles.idRow}>
            <View style={[styles.idPill, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Text variant="headlineSmall" style={[styles.idText, { color: theme.colors.onSecondaryContainer }]}>
                {player.playerCode ?? '—'}
              </Text>
            </View>

            <Button
              mode="contained-tonal"
              icon="share-variant"
              onPress={sharePlayerId}
              disabled={!player.playerCode}
              contentStyle={styles.buttonContent}
            >
              Share
            </Button>
          </View>
        </Card.Content>
      </Card>

      {isSelf && (player.email || player.phone) ? (
        <SectionCard title="Contact information">
          {player.email ? (
            <List.Item
              title={player.email}
              description="Email"
              left={(props) => <List.Icon {...props} icon="email-outline" />}
              style={styles.infoItem}
            />
          ) : null}
          {player.phone ? (
            <List.Item
              title={player.phone}
              description="Phone"
              left={(props) => <List.Icon {...props} icon="phone-outline" />}
              style={styles.infoItem}
            />
          ) : null}
        </SectionCard>
      ) : null}

      {isSelf ? (
        <Button
          mode="contained"
          icon="account-edit-outline"
          onPress={() => router.push(`/players/${player.id}/edit`)}
          contentStyle={styles.buttonContent}
        >
          Edit profile
        </Button>
      ) : null}

      <Portal>
        <Dialog visible={showIdInfo} onDismiss={() => setShowIdInfo(false)} style={styles.dialog}>
          <Dialog.Icon icon="badge-account-horizontal-outline" />
          <Dialog.Title style={styles.dialogTitle}>About player IDs</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogBody}>
              Each player has a permanent short ID. Searching by ID is the safest way to add someone
              to a game, because names are never searchable.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setShowIdInfo(false)}>
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    borderRadius: radius.lg,
  },
  heroContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  heroName: {
    fontWeight: '700',
    textAlign: 'center',
  },
  idCard: {
    borderRadius: radius.lg,
  },
  idContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  idHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idTitle: {
    fontWeight: '600',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  idPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  idText: {
    fontWeight: '700',
    letterSpacing: 4,
  },
  infoItem: {
    paddingHorizontal: 0,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
  dialog: {
    borderRadius: radius.lg,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogBody: {
    lineHeight: 20,
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import { playersService } from '../../../services/players';
import { authService } from '../../../services/auth';
import { isSupabaseConfigured } from '../../../services/supabase';
import { Screen } from '../../../components/ui/Screen';
import { SectionCard } from '../../../components/ui/SectionCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListRow } from '../../../components/ui/ListRow';
import { SeatAvatar } from '../../../components/ui/SeatAvatar';
import { Tag } from '../../../components/ui/Tag';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../../constants/theme';
import { useLayout } from '../../../hooks/useLayout';

export default function PlayerDetailScreen() {
  const { colors } = useAppTheme();
  const { isWide } = useLayout();
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

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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

  const hero = (
    <View style={[styles.hero, { backgroundColor: colors.felt }]}>
      <SeatAvatar
        name={player.name}
        size={80}
        color={player.role === 'admin' ? colors.error : colors.primary}
        style={{ ...styles.heroAvatar, borderColor: colors.onFelt }}
      />
      <Text variant="headlineSmall" style={[styles.heroName, { color: colors.onFelt }]}>
        {player.name}
      </Text>
      <Tag label={player.role === 'admin' ? 'App admin' : 'Player'} tone={player.role === 'admin' ? 'danger' : 'primary'} />
    </View>
  );

  const idCard = (
    <SectionCard
      title="Player ID"
      icon="badge-account-horizontal-outline"
      right={
        <IconButton
          icon="information-outline"
          size={20}
          accessibilityLabel="What is a player ID?"
          onPress={() => setShowIdInfo(true)}
          style={styles.noMargin}
        />
      }
    >
      <View style={styles.idRow}>
        <View style={[styles.idPill, { backgroundColor: colors.secondaryContainer }]}>
          <Text variant="headlineSmall" style={[styles.idText, { color: colors.onSecondaryContainer }]}>
            {player.playerCode ?? '—'}
          </Text>
        </View>

        <Button
          mode="contained-tonal"
          icon="share-variant"
          onPress={sharePlayerId}
          disabled={!player.playerCode}
          style={styles.pillButton}
          contentStyle={styles.buttonContent}
        >
          Share
        </Button>
      </View>
    </SectionCard>
  );

  const details = (
    <>
      {isSelf && (player.email || player.phone) ? (
        <SectionCard title="Contact information" icon="card-account-details-outline">
          {player.email ? <ListRow title={player.email} description="Email" icon="email-outline" /> : null}
          {player.phone ? <ListRow title={player.phone} description="Phone" icon="phone-outline" /> : null}
        </SectionCard>
      ) : null}

      {isSelf ? (
        <Button
          mode="contained"
          icon="account-edit-outline"
          onPress={() => router.push(`/players/${player.id}/edit`)}
          style={styles.pillButton}
          contentStyle={styles.buttonContent}
        >
          Edit profile
        </Button>
      ) : null}
    </>
  );

  return (
    <Screen>
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>{hero}</View>
          <View style={styles.column}>
            {idCard}
            {details}
          </View>
        </View>
      ) : (
        <>
          {hero}
          {idCard}
          {details}
        </>
      )}

      <Portal>
        <Dialog
          visible={showIdInfo}
          onDismiss={() => setShowIdInfo(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Icon icon="badge-account-horizontal-outline" />
          <Dialog.Title style={styles.dialogTitle}>About player IDs</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
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
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  column: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  noMargin: {
    margin: 0,
  },
  hero: {
    borderRadius: radius.xl,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  heroAvatar: {
    borderWidth: 3,
  },
  heroName: {
    fontWeight: '800',
    textAlign: 'center',
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
  pillButton: {
    borderRadius: radius.full,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 440,
    width: '90%',
    alignSelf: 'center',
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogBody: {
    lineHeight: 20,
    textAlign: 'center',
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});

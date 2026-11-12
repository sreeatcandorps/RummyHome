import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isSupabaseConfigured } from '@/services/supabase';
import { playersService } from '@/services/players';
import { storage } from '@/utils/storage';
import { gameOwnersLine } from '@/utils/gameOwners';
import { spacing, useAppTheme } from '@/constants/theme';

export const GAME_ID_COPIED = 'Game ID copied.';

/**
 * Bottom-right of the scorecard table: the G-number with the creator and admin names, and the
 * full game ID in small text. Tapping the ID copies it (support asks for it when something is off).
 */
export function GameIdFooter({ game, members, onCopied }: { game: Game; members: Player[]; onCopied: (note: string) => void }) {
  const { colors } = useAppTheme();
  const [creatorName, setCreatorName] = useState<string | null>(null);

  // The creator is often not seated (and so not among the members); look the name up once.
  useEffect(() => {
    let live = true;
    const known = members.find((m) => m.id === game.createdBy);
    if (known || !game.createdBy) { setCreatorName(known?.name ?? null); return; }
    (async () => {
      const name = isSupabaseConfigured
        ? (await playersService.getPlayer(game.createdBy as string).catch(() => null))?.name ?? null
        : (await storage.getPlayers()).find((p) => p.id === game.createdBy)?.name ?? null;
      if (live) setCreatorName(name);
    })();
    return () => { live = false; };
  }, [game.createdBy, members]);

  const copy = async () => {
    await Clipboard.setStringAsync(game.id);
    onCopied(GAME_ID_COPIED);
  };

  return (
    <View style={styles.wrap} testID="game-id-footer">
      <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
        {gameOwnersLine(game, members, creatorName)}
      </Text>
      <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={`Game ID ${game.id}. Tap to copy`} style={styles.idRow} hitSlop={8}>
        <Text variant="labelSmall" style={[styles.id, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{`ID ${game.id}`}</Text>
        <Icon source="content-copy" size={12} color={colors.onSurfaceVariant} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 2, paddingTop: spacing.xs },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  id: { fontVariant: ['tabular-nums'], letterSpacing: 0.2 },
});

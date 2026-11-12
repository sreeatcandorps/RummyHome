import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isSupabaseConfigured } from '@/services/supabase';
import { playersService } from '@/services/players';
import { storage } from '@/utils/storage';
import { gameOwnersLines } from '@/utils/gameOwners';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Bottom-right of the scorecard table: "Game S3", then the creator, then the admins, each on
 * its own line (028 / final batch items 2 and 7). The long game id is internal and never shown.
 */
export function GameIdFooter({ game, members }: { game: Game; members: Player[] }) {
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

  const lines = gameOwnersLines(game, members, creatorName);
  return (
    <View style={styles.wrap} testID="game-id-footer" accessibilityLabel={lines.join('. ')}>
      {lines.map((line, index) => (
        <Text
          key={line}
          variant="labelMedium"
          style={[index === 0 ? styles.label : null, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
          testID={index === 0 ? 'game-label' : undefined}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 2, paddingTop: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.md },
  label: { fontWeight: '800', fontVariant: ['tabular-nums'] },
});

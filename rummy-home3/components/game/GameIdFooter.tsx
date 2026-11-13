import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isSupabaseConfigured } from '@/services/supabase';
import { playersService } from '@/services/players';
import { storage } from '@/utils/storage';
import { footerOneLine, scorecardFooterLines } from '@/utils/scorecardLayout';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Under the scorecard table: "Creator: Sree Koneru", one "Admin: …" line per admin, and
 * "Unique game ID: 7F3A2C" (the share code, D4.1). The game label is in the strip above, so it
 * is not repeated here; the long UUID is internal and never shown. Landscape joins the pieces
 * on one line so the rows keep the height.
 */
export function GameIdFooter({ game, members, compact = false }: { game: Game; members: Player[]; compact?: boolean }) {
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

  const lines = scorecardFooterLines(game, members, creatorName);
  if (!lines.length) return null;
  const spoken = footerOneLine(lines);

  if (compact) {
    return (
      <View style={styles.wrapCompact} testID="game-id-footer" accessibilityLabel={spoken}>
        <Text variant="labelMedium" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
          {lines.map((line, index) => (
            <Text key={`${line.label}-${index}`} variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
              {index > 0 ? ' · ' : ''}
              <Text variant="labelMedium" style={[styles.label, { color: colors.onSurface }]}>{line.label}:</Text>
              {` ${line.value}`}
            </Text>
          ))}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="game-id-footer" accessibilityLabel={spoken}>
      {lines.map((line, index) => (
        <Text
          key={`${line.label}-${index}`}
          variant="labelLarge"
          numberOfLines={1}
          style={{ color: colors.onSurfaceVariant }}
          testID={line.label === 'Unique game ID' ? 'game-unique-id' : undefined}
        >
          <Text variant="labelLarge" style={[styles.label, { color: colors.onSurface }]}>{line.label}:</Text>
          {` ${line.value}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: 2, paddingTop: spacing.sm, paddingHorizontal: spacing.xs },
  wrapCompact: { paddingTop: spacing.xs, paddingHorizontal: spacing.xs },
  label: { fontWeight: '800' },
});

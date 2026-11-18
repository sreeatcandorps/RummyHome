import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isSupabaseConfigured } from '@/services/supabase';
import { playersService } from '@/services/players';
import { storage } from '@/utils/storage';
import { footerOneLine, footerType, scorecardFooterLines } from '@/utils/scorecardLayout';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Inside the scorecard card, right under the last round row (PR 24): "Creator: Sree Koneru", one
 * "Admin: …" line per admin, and "Unique game ID: 7F3A2C" (the share code, D4.1). The game label is
 * in the strip above, so it is not repeated here; the long UUID is internal and never shown.
 * Quiet type — 70% of the old size, italic, never bold — so the rounds stay the point of the card.
 * Landscape joins the pieces on one line.
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
  const type = footerType();
  const text = [styles.text, type, { color: colors.onSurfaceVariant }];

  if (compact) {
    return (
      <View style={styles.wrap} testID="game-id-footer" accessibilityLabel={spoken}>
        <Text numberOfLines={1} style={text} testID="game-unique-id">
          {spoken}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="game-id-footer" accessibilityLabel={spoken}>
      {lines.map((line, index) => (
        <Text
          key={`${line.label}-${index}`}
          numberOfLines={1}
          style={text}
          testID={line.label === 'Unique game ID' ? 'game-unique-id' : undefined}
        >
          {`${line.label}: ${line.value}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: 1, paddingHorizontal: spacing.xs },
  text: { includeFontPadding: false },
});

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { BoldName } from '@/components/ui/BoldName';
import { DraftPick } from '@/utils/newGameDraft';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type Props = {
  picks: DraftPick[];
  meId?: string | null;
  onRemove: (id: string) => void;
  /** Compact header shown above the chips, e.g. on Add New Players. Omit on New game, which has its own Playing count. */
  title?: string;
  emptyText?: string;
};

/** One chip per seated player. Tap a chip to take that person out. Shared by New game and the screens it opens. */
export function SelectedPlayersStrip({ picks, meId, onRemove, title, emptyText }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.root}>
      {title ? (
        <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>
          {title} · {picks.length}
        </Text>
      ) : null}
      {picks.length === 0 && emptyText ? (
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{emptyText}</Text>
      ) : null}
      <View style={styles.chips}>
        {picks.map((pick) => {
          const isMe = pick.id === meId;
          return (
            <Pressable
              key={pick.id}
              onPress={() => onRemove(pick.id)}
              accessibilityRole="button"
              hitSlop={6}
              accessibilityLabel={`Remove ${pick.name}${isMe ? ' (you)' : ''}`}
              style={[styles.chip, { backgroundColor: colors.primaryContainer, borderColor: isMe ? colors.primary : 'transparent' }]}
            >
              <BoldName name={pick.name} suffix={isMe ? ' (you)' : undefined} variant="labelLarge" numberOfLines={1} color={colors.onPrimaryContainer} style={styles.chipName} />
              <Text style={[styles.chipX, { color: colors.onPrimaryContainer }]}>×</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 42,
  },
  chipName: { maxWidth: 200 },
  chipX: { fontSize: 18, fontWeight: '700' },
});

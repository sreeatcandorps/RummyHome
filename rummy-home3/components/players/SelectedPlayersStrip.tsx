import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { BoldName } from '@/components/ui/BoldName';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { DraftPick } from '@/utils/newGameDraft';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';

type Props = {
  picks: DraftPick[];
  meId?: string | null;
  /** The × on a chip. */
  onRemove: (id: string) => void;
  /** Tapping the face sends the player back to the list. Defaults to onRemove. */
  onReturn?: (id: string) => void;
  /** Compact header shown above the chips, e.g. on Add New Players. Omit on New game, which has its own Playing count. */
  title?: string;
  emptyText?: string;
  /** Ids that are already saved in a game (mid-game add); drawn with a firmer border. */
  savedIds?: ReadonlySet<string>;
  /** A chip being removed on the server; it dims and ignores taps. */
  busyId?: string | null;
};

/**
 * One compact chip per seated player: a small coloured avatar (tap it to send
 * the person back to the list), the name, and the × that takes them out.
 * Shared by New game, Add players to game, and the screens they open.
 */
export function SelectedPlayersStrip({ picks, onRemove, onReturn, title, emptyText, savedIds, busyId }: Props) {
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
        {picks.map((pick, index) => (
          <Chip
            key={pick.id}
            pick={pick}
            color={seatColor(index)}
            saved={savedIds?.has(pick.id) ?? false}
            busy={busyId === pick.id}
            onRemove={() => onRemove(pick.id)}
            onReturn={() => (onReturn ?? onRemove)(pick.id)}
          />
        ))}
      </View>
    </View>
  );
}

function Chip({ pick, color, saved, busy, onRemove, onReturn }: {
  pick: DraftPick; color: string; saved: boolean; busy: boolean; onRemove: () => void; onReturn: () => void;
}) {
  const { colors } = useAppTheme();
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: false }).start();
  }, [enter]);
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor: colors.primaryContainer, borderColor: saved ? colors.primary : 'transparent', opacity: busy ? 0.5 : enter, transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={onReturn}
        disabled={busy}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Send ${pick.name} back to the list`}
        style={styles.face}
      >
        <SeatAvatar name={pick.name} color={color} size={28} />
      </Pressable>
      <BoldName name={pick.name} variant="labelLarge" numberOfLines={1} color={colors.onPrimaryContainer} style={styles.chipName} />
      <Pressable
        onPress={onRemove}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${pick.name}`}
        style={styles.x}
      >
        <Text style={[styles.chipX, { color: colors.onPrimaryContainer }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    borderWidth: 1.5,
    paddingLeft: 3,
    paddingRight: 4,
    minHeight: 36,
  },
  face: { borderRadius: radius.full },
  chipName: { maxWidth: 140, fontSize: 13 },
  x: { paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  chipX: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
});

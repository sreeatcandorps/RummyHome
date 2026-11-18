import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { BoldName } from '@/components/ui/BoldName';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { Tag } from '@/components/ui/Tag';
import { playerIdBadge, registrationLabel, REGISTRATION_TONE, visibleRegistration } from '@/utils/myPlayersList';
import { Candidate } from '@/utils/playerIdentity';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';

type Props = {
  candidate: Candidate;
  /** Position in the list; picks the avatar colour the same way Players in this game does. */
  index: number;
  disabled?: boolean;
  /** The signed-in organiser: pinned first; the spoken label says "(you)". No tag is drawn (PR 7, D7.2). */
  isMe?: boolean;
  onPress: () => void;
};

/**
 * One player per row on the picker: coloured avatar, full name with bold
 * initials, Player ID and — only for Unregistered / Pending — a registration
 * pill; the same shape as a row on Players in this game. Fades in when it
 * (re)appears in the list.
 */
export function PlayerPickerRow({ candidate, index, disabled, isMe = false, onPress }: Props) {
  const { colors } = useAppTheme();
  const status = visibleRegistration(registrationLabel(candidate.status));
  const badge = playerIdBadge(candidate);
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [enter]);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={isMe ? `Add ${candidate.name} (you)` : `Add ${candidate.name}`}
        style={({ pressed }) => [
          styles.row,
          { borderColor: colors.outlineVariant, backgroundColor: pressed ? colors.primaryContainer : colors.surface, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <SeatAvatar name={candidate.name} color={seatColor(index)} size={36} />
        <View style={styles.text}>
          <BoldName name={candidate.name} variant="bodyLarge" numberOfLines={1} />
          <View style={styles.meta}>
            {badge ? <Tag small label={badge} /> : null}
            {status ? <Tag small label={status} tone={REGISTRATION_TONE[status]} /> : null}
          </View>
        </View>
        <Text style={[styles.plus, { color: colors.primary }]}>+</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 60,
  },
  text: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  plus: { fontSize: 24, fontWeight: '700', paddingHorizontal: 4 },
});

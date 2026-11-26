import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { HOW_TO_ADD_DISMISSED_KEY, HOW_TO_ADD_LINES } from '@/utils/addPlayers';

/** D108: two lines on how to add someone, at the top of My players until closed (once per phone). */
export function HowToAddCard() {
  const { colors } = useAppTheme();
  // Hidden until the saved answer is read, so a closed card never flashes.
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(HOW_TO_ADD_DISMISSED_KEY)
      .then((raw) => { if (alive) setShow(raw !== '1'); })
      .catch(() => { if (alive) setShow(true); });
    return () => { alive = false; };
  }, []);

  if (!show) return null;
  const close = () => {
    setShow(false);
    AsyncStorage.setItem(HOW_TO_ADD_DISMISSED_KEY, '1').catch(() => {});
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceVariant, borderColor: colors.outlineVariant }]} testID="how-to-add-card">
      <View style={styles.text}>
        {HOW_TO_ADD_LINES.map((line) => (
          <Text key={line} variant="bodySmall" style={{ color: colors.onSurface }}>{line}</Text>
        ))}
      </View>
      <IconButton icon="close" size={18} onPress={close} accessibilityLabel="Close how to add players" testID="how-to-add-close" style={styles.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.md, paddingLeft: spacing.md, paddingVertical: spacing.xs },
  text: { flex: 1, gap: spacing.xxs, paddingVertical: spacing.xs },
  close: { margin: 0 },
});

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { radius } from '@/constants/theme';

/** Bridge-size proportions (2¼ × 3½); Sree, Nov 23: "the regular ones that are smaller in looking size". */
export const JOKER_CARD_RATIO = 2.25 / 3.5;
const LETTERS = ['J', 'O', 'K', 'E', 'R'];

type JokerCardProps = {
  /** Card height in dp; the width follows the bridge ratio. */
  height?: number;
  /** Degrees; the Sign-in hero sits at −6. */
  tilt?: number;
  testID?: string;
};

/**
 * The Joker playing card on the sign-in band (D69). An original jester drawn for EZ Score in the classic
 * engraving style — not the Bicycle company's artwork (Sree: "ok" to that). The frame, the stacked
 * "JOKER" indices and the shadow are drawn here so edges stay crisp at every density and dark mode
 * needs no second asset; the figure is the only bitmap. Real card faces have no inner frame (Sree, Nov 23).
 */
export function JokerCard({ height = 140, tilt = -6, testID = 'joker-card' }: JokerCardProps) {
  const width = Math.round(height * JOKER_CARD_RATIO);
  const unit = height / 140;
  const index = (
    <View style={styles.index} pointerEvents="none">
      {LETTERS.map((letter) => (
        <Text key={letter} style={[styles.letter, { fontSize: 9 * unit, lineHeight: 9.5 * unit }]} allowFontScaling={false}>
          {letter}
        </Text>
      ))}
    </View>
  );
  return (
    <View
      style={[styles.card, { width, height, borderRadius: radius.xs * unit, transform: [{ rotate: `${tilt}deg` }] }]}
      accessibilityRole="image"
      accessibilityLabel="Joker playing card"
      testID={testID}
    >
      <View style={[styles.corner, { left: 6 * unit, top: 7 * unit }]}>{index}</View>
      <Image
        source={require('../../assets/joker-figure.png')}
        style={{ height: 112 * unit, width: 112 * unit * (254 / 480), marginLeft: 8 * unit }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={[styles.corner, { right: 6 * unit, bottom: 7 * unit, transform: [{ rotate: '180deg' }] }]}>{index}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  corner: { position: 'absolute' },
  index: { alignItems: 'center' },
  letter: { color: '#111111', fontWeight: '700', fontFamily: 'serif' },
});

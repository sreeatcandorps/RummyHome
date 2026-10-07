import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  /** Shown in place of the app icon, e.g. a lock for password reset. */
  icon?: string;
  children: React.ReactNode;
  /** Rendered under the form card, e.g. "Create account" links. */
  footer?: React.ReactNode;
};

const FORM_MAX_WIDTH = 460;

/** Shared chrome for sign-in screens: felt brand panel plus a form card. Side by side in landscape. */
export function AuthShell({ title, subtitle, icon, children, footer }: AuthShellProps) {
  const { colors } = useAppTheme();
  const { insets, isShort, gutterLeft, gutterRight } = useLayout();

  const badge = (
    <View style={[styles.badge, { backgroundColor: colors.onFelt }]}>
      {icon ? (
        <Icon source={icon} size={34} color={colors.felt} />
      ) : (
        <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
      )}
    </View>
  );

  const brand = (
    <View style={styles.brandText}>
      {badge}
      <Text variant="headlineMedium" style={[styles.title, { color: colors.onFelt }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.onFeltMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  const card = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
      {children}
    </View>
  );

  if (isShort) {
    return (
      <KeyboardAvoidingView
        style={[styles.row, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.sidePanel,
            {
              backgroundColor: colors.felt,
              paddingLeft: gutterLeft,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          {brand}
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.sideContent,
            {
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              paddingRight: gutterRight,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formColumn}>
            {card}
            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.stackContent, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.band,
            {
              backgroundColor: colors.felt,
              paddingTop: insets.top + spacing.xl,
              paddingLeft: gutterLeft,
              paddingRight: gutterRight,
            },
          ]}
        >
          <View style={styles.suit} pointerEvents="none">
            <Icon source="cards-club" size={150} color="rgba(251, 241, 225, 0.05)" />
          </View>
          {brand}
        </View>
        <View style={[styles.overlap, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
          <View style={styles.formColumn}>
            {card}
            {footer}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  stackContent: {
    flexGrow: 1,
  },
  band: {
    paddingBottom: spacing.xxl + spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  suit: {
    position: 'absolute',
    right: -30,
    bottom: -30,
    transform: [{ rotate: '-12deg' }],
  },
  brandText: {
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: FORM_MAX_WIDTH,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  logo: {
    width: 68,
    height: 68,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  overlap: {
    marginTop: -spacing.xxl - spacing.md,
  },
  formColumn: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sidePanel: {
    width: '38%',
    maxWidth: 340,
    paddingRight: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  sideContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingLeft: spacing.lg,
  },
});

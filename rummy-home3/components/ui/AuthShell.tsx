import React, { useEffect, useRef } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { HelpTopicKey } from '@/constants/helpTopics';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  /** Shown in place of the app icon, e.g. a lock for password reset. */
  icon?: string;
  /** Replaces the badge altogether, e.g. the Joker card on Sign in (D69). */
  hero?: React.ReactNode;
  children: React.ReactNode;
  /** Rendered under the form card, e.g. "Create account" links. */
  footer?: React.ReactNode;
  /** The help page the ? opens (sign-in pages share one). */
  help?: HelpTopicKey;
  helpAnchor?: string;
  /** When the keyboard opens, scroll so the bottom of the form card sits just above it (a short code form whose
   * buttons and links must stay reachable with the number pad up on a small phone). */
  keepCardInView?: boolean;
};

const FORM_MAX_WIDTH = 460;

/**
 * Both platforms pad for the keyboard. Android used to be left to the window (`adjustResize`), but with the
 * edge-to-edge window of SDK 54 the window no longer shrinks, so the passcode field on Create account sat under
 * the keyboard (staging build 2, bug 8). Padding shrinks the ScrollView; `useScrollToFocusedInput` then brings the
 * focused field above the keyboard once the keyboard has its final height.
 */
export const KEYBOARD_BEHAVIOR = 'padding' as const;

/** Space kept between the focused field's bottom edge and the keyboard. */
export const FOCUSED_INPUT_GAP = spacing.lg;

/**
 * Once the keyboard is up, a focused input that it covers is scrolled to sit just above it; one already in view
 * is left alone. Android's own ScrollView does this when it shrinks, but not reliably for a field tapped low on
 * the screen (the case bug 8 described), so it is done here too, on `keyboardDidShow` — the padding has settled.
 */
export function useScrollToFocusedInput(scrollRef: React.RefObject<ScrollView | null>) {
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;
      input.measureInWindow((_x, y, _w, h) => {
        if (y + h + FOCUSED_INPUT_GAP <= e.endCoordinates.screenY) return;
        scroll.getScrollResponder().scrollResponderScrollNativeHandleToKeyboard(input, FOCUSED_INPUT_GAP, true);
      });
    });
    return () => sub.remove();
  }, [scrollRef]);
}

/** Shared chrome for sign-in screens: felt brand panel plus a form card. Side by side in landscape. */
export function AuthShell({ title, subtitle, icon, hero, children, footer, help, helpAnchor, keepCardInView }: AuthShellProps) {
  const { colors } = useAppTheme();
  const { insets, isShort, gutterLeft, gutterRight } = useLayout();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToFocusedInput(scrollRef);
  const viewportHeight = useRef(0);
  const cardTop = useRef(0);
  const cardBottom = useRef(0);
  const keyboardOpen = useRef(false);

  const scrollCardIntoView = () => {
    const overflow = cardTop.current + cardBottom.current + spacing.md - viewportHeight.current;
    if (overflow > 0) scrollRef.current?.scrollTo({ y: overflow, animated: true });
  };

  const followCard = () => {
    if (keepCardInView && keyboardOpen.current) scrollCardIntoView();
  };

  useEffect(() => {
    if (!keepCardInView) return;
    const ios = Platform.OS === 'ios';
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The window shrinks after the keyboard event on Android; measure once the new height has landed.
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      keyboardOpen.current = true;
      timer = setTimeout(scrollCardIntoView, 80);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardOpen.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
      if (timer) clearTimeout(timer);
    };
  }, [keepCardInView]);

  const badge = (
    <View style={[styles.badge, { backgroundColor: colors.onFelt }]}>
      {icon ? (
        <Icon source={icon} size={34} color={colors.felt} />
      ) : (
        <Image source={require('../../assets/icon-small.png')} style={styles.logo} accessibilityIgnoresInvertColors />
      )}
    </View>
  );

  const brand = (
    <View style={styles.brandText}>
      {hero ? <View style={styles.hero}>{hero}</View> : badge}
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
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
      onLayout={(e) => {
        cardBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
        followCard();
      }}
    >
      {children}
    </View>
  );

  const helpButton = help ? (
    <View style={[styles.help, { top: insets.top + spacing.xs, right: spacing.sm }]}>
      <HelpButton topic={help} anchor={helpAnchor} color={isShort ? colors.onSurface : colors.onFelt} />
    </View>
  ) : null;

  if (isShort) {
    return (
      <KeyboardAvoidingView style={[styles.row, { backgroundColor: colors.background }]} behavior={KEYBOARD_BEHAVIOR}>
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
          ref={scrollRef}
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
            followCard();
          }}
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
          <View
            style={styles.formColumn}
            onLayout={(e) => {
              cardTop.current = e.nativeEvent.layout.y;
            }}
          >
            {card}
            {footer}
          </View>
        </ScrollView>
        {helpButton}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={KEYBOARD_BEHAVIOR}>
      <ScrollView
        ref={scrollRef}
        onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
          followCard();
        }}
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
        <View
          style={[styles.overlap, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}
          onLayout={(e) => {
            cardTop.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.formColumn}>
            {card}
            {footer}
          </View>
        </View>
      </ScrollView>
      {helpButton}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  help: {
    position: 'absolute',
    zIndex: 5,
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
  hero: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
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

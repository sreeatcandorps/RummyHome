import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router, Tabs, usePathname } from 'expo-router';
import { IconButton, Text } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { PillTabBar } from '@/components/ui/TabBarButtons';
import { HELP } from '@/constants/help';
import { authService } from '@/services/auth';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
/** The logo and the name, nothing else (final batch item 11: no version number beside the icon). The version is at the foot of Profile. */
function BrandTitle() {
  const theme = useAppTheme();
  return (
    <View style={styles.brand}>
      <View style={[styles.brandDisc, { backgroundColor: theme.colors.secondaryContainer }]}>
        <Image source={require('../../assets/icon-small.png')} style={styles.brandLogo} />
      </View>
      <Text variant="titleLarge" numberOfLines={1} style={[styles.brandText, { color: theme.colors.onSurface }]}>
        EZ Score: Rummy
      </Text>
    </View>
  );
}

/** The signed-in person's initials, refreshed on every tab change so a renamed profile shows up. */
function useMyName() {
  const path = usePathname();
  const [name, setName] = useState('?');
  useEffect(() => {
    authService.getCurrentPlayer().then((player) => setName(player?.name ?? '?')).catch(() => {});
  }, [path]);
  return name;
}

function HeaderTools() {
  const path = usePathname();
  const text = path.includes('/players')
    ? HELP.players
    : path.includes('/me')
      ? HELP.me
      : HELP.home;

  // Tab pages already carry the account chip in the bottom bar; the header keeps only Help.
  return (
    <View style={styles.headerRight}>
      <HelpButton text={text} />
    </View>
  );
}

/** The My players page is reached from Home (PR 5), so its header carries a back arrow to Home. */
function BackToHome() {
  const theme = useAppTheme();
  return <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} onPress={() => router.navigate('/(tabs)')} accessibilityLabel="Back to Home" style={styles.back} />;
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { isShort } = useLayout();
  const myName = useMyName();

  // PR 5: two bottom buttons (Home, Profile). The players route stays (href null) and is opened
  // from the My players button on Home, which carries the count badge.
  return (
    <Tabs
      tabBar={(props) => (
        <PillTabBar
          {...props}
          compact={isShort}
          items={{
            index: { kind: 'icon', icon: 'home-variant', label: 'Home' },
            me: { kind: 'avatar', name: myName, label: 'Your profile' },
          }}
        />
      )}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 22, fontWeight: '700' },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: theme.colors.background },
        headerRight: () => <HeaderTools />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <BrandTitle />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'My players',
          href: null,
          headerLeft: () => <BackToHome />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Your profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandDisc: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
  },
  brandText: {
    flexShrink: 1,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    marginLeft: spacing.xs,
  },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { HELP_SCREENSHOTS } from '@/assets/help';
import { HelpBullets, HelpLine } from '@/components/help/HelpRich';
import { Tag } from '@/components/ui/Tag';
import { HELP_TOPICS, HelpFamily, HelpTopic } from '@/constants/helpTopics';
import { MAX_CONTENT_WIDTH, radius, spacing, useAppTheme } from '@/constants/theme';

export const NEED_TO_KNOW = 'Need to know';
export const FULL_GUIDE = 'Full guide';
export const TRICKY_CASES = 'Tricky cases';
export const ALSO_SEE = 'Also see';
export const ON_THE_SCREEN = 'On the screen';

export const helpRoute = (key: HelpTopic['key'], anchor?: string) =>
  anchor ? `/(screens)/help/${key}?anchor=${encodeURIComponent(anchor)}` : `/(screens)/help/${key}`;

export const openHelp = (key: HelpTopic['key'], anchor?: string) => router.push(helpRoute(key, anchor) as never);

/** Yellow = games, green = results, grey = people / you, blue = rules (H00). */
export function useFamilyColors(family: HelpFamily) {
  const { colors, gameTypes } = useAppTheme();
  switch (family) {
    case 'games':
      return { bg: gameTypes.stake.container, fg: gameTypes.stake.on, rule: gameTypes.stake.accent };
    case 'results':
      return { bg: colors.primaryContainer, fg: colors.onPrimaryContainer, rule: colors.primary };
    case 'rules':
      return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer, rule: colors.tertiary };
    default:
      return { bg: colors.surfaceVariant, fg: colors.onSurfaceVariant, rule: colors.outline };
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function Card({ title, rule, children, testID }: { title: string; rule: string; children: React.ReactNode; testID?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderLeftColor: rule }]} testID={testID}>
      <Text variant="labelLarge" style={[styles.cardTitle, { color: colors.onSurfaceVariant }]}>{title}</Text>
      {children}
    </View>
  );
}

export function HelpPage({ topic, anchor }: { topic: HelpTopic; anchor?: string }) {
  const { colors } = useAppTheme();
  const family = useFamilyColors(topic.family);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const shot = topic.screenshot ? HELP_SCREENSHOTS[topic.screenshot.file] : undefined;

  const mark = useCallback((id: string) => (e: LayoutChangeEvent) => {
    positions.current[id] = e.nativeEvent.layout.y;
    if (anchor && id === anchor) setReady(true);
  }, [anchor]);

  useEffect(() => {
    if (!anchor || !ready) return;
    const y = positions.current[anchor];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
  }, [anchor, ready]);

  return (
    <ScrollView ref={scrollRef} style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} testID={`help-page-${topic.key}`}>
      <View style={styles.column}>
        <View style={[styles.hero, { backgroundColor: family.bg }]} testID="help-hero">
          <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
            <Icon source={topic.icon} size={26} color={family.fg} />
          </View>
          <View style={styles.heroText}>
            <Text variant="headlineSmall" style={[styles.heroTitle, { color: family.fg }]}>{topic.title}</Text>
            <Text variant="bodyMedium" style={{ color: family.fg }}>{topic.purpose}</Text>
          </View>
        </View>

        <Card title={NEED_TO_KNOW} rule={colors.primary} testID="help-need-to-know">
          <HelpBullets lines={topic.needToKnow} />
        </Card>

        {topic.screenshot ? (
          <Card title={ON_THE_SCREEN} rule={family.rule} testID="help-screenshot">
            {shot ? (
              <Image source={shot} style={[styles.shot, { borderColor: colors.outlineVariant }]} resizeMode="contain" accessibilityLabel={`${topic.title}, annotated`} />
            ) : null}
            <HelpBullets lines={topic.screenshot.legend} numbered />
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Screenshots are shown in the light theme.</Text>
          </Card>
        ) : null}

        <Card title={FULL_GUIDE} rule={family.rule} testID="help-full-guide">
          <View style={styles.sections}>
            {topic.sections.map((s) => (
              <View key={s.title} style={styles.section} onLayout={mark(slug(s.title))}>
                <Text variant="titleMedium" style={styles.sectionTitle}>{s.title}</Text>
                <HelpBullets lines={s.bullets} />
              </View>
            ))}
            {topic.menu ? (
              <View style={styles.section} onLayout={mark('menu')}>
                <Text variant="titleMedium" style={styles.sectionTitle}>{topic.menu.title}</Text>
                <View style={[styles.table, { borderColor: colors.outlineVariant }]}>
                  {topic.menu.rows.map((row, i) => (
                    <View key={row.item} style={[styles.tr, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant }]}>
                      <View style={styles.trHead}>
                        <Text variant="titleSmall" style={styles.trItem}>{row.item}</Text>
                        <Tag label={row.who} small />
                      </View>
                      <HelpLine text={row.does} variant="bodySmall" />
                      {row.hidden ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Hidden: {row.hidden}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.section} onLayout={mark('tricky')}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{TRICKY_CASES}</Text>
              <View style={styles.tricky}>
                {topic.tricky.map((t) => (
                  <View key={t.id} style={[styles.qa, { backgroundColor: colors.surfaceVariant }]} onLayout={mark(t.id)} testID={`help-tricky-${t.id}`}>
                    <Text variant="titleSmall" style={styles.q}>{t.q}</Text>
                    <HelpLine text={t.a} variant="bodySmall" />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.alsoSee} testID="help-also-see">
          <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>{ALSO_SEE}</Text>
          <View style={styles.chips}>
            {topic.alsoSee.map((k) => {
              const t = HELP_TOPICS[k];
              return <AlsoSeeChip key={k} topic={t} />;
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function AlsoSeeChip({ topic }: { topic: HelpTopic }) {
  const family = useFamilyColors(topic.family);
  return (
    <Pressable onPress={() => router.push(helpRoute(topic.key) as never)} style={[styles.chip, { backgroundColor: family.bg }]} accessibilityRole="button" accessibilityLabel={`Help: ${topic.title}`}>
      <Icon source={topic.icon} size={16} color={family.fg} />
      <Text variant="labelLarge" style={{ color: family.fg }}>{topic.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  heroIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 2 },
  heroTitle: { fontWeight: '800' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderLeftWidth: 4, padding: spacing.lg, gap: spacing.md },
  cardTitle: { textTransform: 'uppercase', letterSpacing: 0.8 },
  shot: { width: '100%', aspectRatio: 0.72, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  sections: { gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: { fontWeight: '700' },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
  tr: { padding: spacing.md, gap: spacing.xs },
  trHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  trItem: { fontWeight: '700', flexShrink: 1 },
  tricky: { gap: spacing.sm },
  qa: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  q: { fontWeight: '700' },
  alsoSee: { gap: spacing.sm, paddingTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: radius.full },
});

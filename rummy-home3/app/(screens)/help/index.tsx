import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { Icon, Text } from 'react-native-paper';
import { helpRoute, useFamilyColors } from '@/components/help/HelpPage';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { HELP_INDEX_TITLE, helpIndex, HelpTopic, searchHelp } from '@/constants/helpTopics';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { router } from 'expo-router';

export const HELP_SEARCH_PLACEHOLDER = 'Search help';

/** Help & guide index (H10): grouped Playing → Results → People → You → Rules, with local search. */
export default function HelpIndexScreen() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => helpIndex(), []);
  const hits = useMemo(() => (query.trim() ? searchHelp(query) : null), [query]);

  return (
    <>
      <Stack.Screen options={{ title: HELP_INDEX_TITLE }} />
      <Screen contentStyle={styles.content}>
        <SearchField value={query} onChangeText={setQuery} placeholder={HELP_SEARCH_PLACEHOLDER} testID="help-search" />
        {hits ? (
          <View style={styles.group} testID="help-search-results">
            <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>
              {hits.length === 0 ? 'Nothing matches' : hits.length === 1 ? '1 page' : `${hits.length} pages`}
            </Text>
            {hits.map((t) => <TopicRow key={t.key} topic={t} />)}
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.group} style={styles.group} testID={`help-group-${g.group.toLowerCase()}`}>
              <Text variant="labelLarge" style={[styles.groupTitle, { color: colors.onSurfaceVariant }]}>{g.group}</Text>
              {g.topics.map((t) => <TopicRow key={t.key} topic={t} />)}
            </View>
          ))
        )}
      </Screen>
    </>
  );
}

function TopicRow({ topic }: { topic: HelpTopic }) {
  const { colors } = useAppTheme();
  const family = useFamilyColors(topic.family);
  return (
    <Pressable
      onPress={() => router.push(helpRoute(topic.key) as never)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceVariant : colors.surface, borderColor: colors.outlineVariant }]}
      accessibilityRole="button"
      accessibilityLabel={`Help: ${topic.title}`}
      testID={`help-topic-${topic.key}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: family.bg }]}>
        <Icon source={topic.icon} size={20} color={family.fg} />
      </View>
      <View style={styles.rowText}>
        <Text variant="titleSmall" style={styles.rowTitle}>{topic.title}</Text>
        <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.onSurfaceVariant }}>{topic.purpose}</Text>
      </View>
      <Icon source="chevron-right" size={22} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupTitle: { textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: '700' },
});

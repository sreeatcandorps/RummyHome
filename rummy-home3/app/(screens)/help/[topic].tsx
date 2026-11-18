import React from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { IconButton } from 'react-native-paper';
import { HelpPage } from '@/components/help/HelpPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { HELP_TOPICS, HelpTopicKey } from '@/constants/helpTopics';

export const HELP_INDEX_LINK = 'Index';

/** One help page per screen (docs/help-design.md §3). `?anchor=` scrolls to a section or Tricky case. */
export default function HelpTopicScreen() {
  const { topic: raw, anchor } = useLocalSearchParams<{ topic: string; anchor?: string }>();
  const topic = raw && raw in HELP_TOPICS ? HELP_TOPICS[raw as HelpTopicKey] : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: topic ? `Help · ${topic.title}` : 'Help',
          headerRight: () => (
            <IconButton icon="book-open-variant" onPress={() => router.push('/(screens)/help' as never)} accessibilityLabel={`Help ${HELP_INDEX_LINK.toLowerCase()}`} testID="help-index-link" />
          ),
        }}
      />
      {topic ? (
        <HelpPage topic={topic} anchor={typeof anchor === 'string' ? anchor : undefined} />
      ) : (
        <EmptyState icon="help-circle-outline" title="No such help page" message="Open the index to find the page you need." actionLabel={HELP_INDEX_LINK} onAction={() => router.replace('/(screens)/help' as never)} />
      )}
    </>
  );
}

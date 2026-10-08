import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { SeatAvatar } from '@/components/ui/SeatAvatar';

export type Standing = {
  id: string;
  name: string;
  label: string;
  color: string;
  total: number;
  /** Competition rank: tied totals share a place. */
  rank: number;
  isLeader: boolean;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const signedTotal = (total: number) => (total > 0 ? `+${total}` : `${total}`);

type StandingsProps = {
  standings: Standing[];
  layout: 'rail' | 'list';
  style?: ViewStyle;
};

/** Leaderboard of running totals; the rail scrolls sideways, the list fills a side panel. */
export function Standings({ standings, layout, style }: StandingsProps) {
  const theme = useAppTheme();
  const { colors } = theme;

  const totalColor = (entry: Standing) =>
    entry.isLeader ? colors.onLeaderContainer : entry.total > 0 ? colors.positive : entry.total < 0 ? colors.negative : colors.onSurfaceVariant;

  if (layout === 'list') {
    return (
      <ScrollView style={style} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {standings.map((entry) => (
          <View
            key={entry.id}
            style={[
              styles.listRow,
              { backgroundColor: entry.isLeader ? colors.leaderContainer : 'transparent' },
            ]}
            accessible
            accessibilityLabel={`${entry.rank}. ${entry.name}, ${entry.total}${entry.isLeader ? ', leading' : ''}`}
          >
            <Text style={[styles.rank, tabularNums, { color: entry.isLeader ? colors.onLeaderContainer : colors.onSurfaceVariant }]}>
              {entry.rank}
            </Text>
            <SeatAvatar name={entry.name} label={entry.label} color={entry.color} size={26} />
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={[styles.listName, { color: entry.isLeader ? colors.onLeaderContainer : colors.onSurface }]}
            >
              {entry.name}
            </Text>
            {entry.isLeader ? <Icon source="crown" size={14} color={colors.leader} /> : null}
            <Text style={[styles.listTotal, tabularNums, { color: totalColor(entry) }]}>{signedTotal(entry.total)}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.railScroll, style]}
      contentContainerStyle={styles.rail}
    >
      {standings.map((entry) => (
        <View
          key={entry.id}
          style={[
            styles.chip,
            {
              backgroundColor: entry.isLeader ? colors.leaderContainer : colors.surface,
              borderColor: entry.isLeader ? colors.leader : colors.outlineVariant,
            },
          ]}
          accessible
          accessibilityLabel={`${entry.rank}. ${entry.name}, ${entry.total}${entry.isLeader ? ', leading' : ''}`}
        >
          <View>
            <SeatAvatar name={entry.name} label={entry.label} color={entry.color} size={30} />
            {entry.isLeader ? (
              <View style={[styles.crown, { backgroundColor: colors.leader }]}>
                <Icon source="crown" size={10} color={colors.surface} />
              </View>
            ) : null}
          </View>
          <View style={styles.chipText}>
            <Text
              variant="labelMedium"
              numberOfLines={1}
              style={{ color: entry.isLeader ? colors.onLeaderContainer : colors.onSurfaceVariant }}
            >
              {entry.rank}. {firstName(entry.name)}
            </Text>
            <Text style={[styles.chipTotal, tabularNums, { color: totalColor(entry) }]}>{signedTotal(entry.total)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  railScroll: {
    flexGrow: 0,
  },
  rail: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 104,
  },
  crown: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    maxWidth: 110,
  },
  chipTotal: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  list: {
    gap: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 38,
    borderRadius: radius.sm,
  },
  rank: {
    width: 16,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  listName: {
    flex: 1,
    fontWeight: '600',
  },
  listTotal: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
});

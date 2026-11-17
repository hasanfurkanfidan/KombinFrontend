import { StyleSheet, Text, View } from 'react-native';

import type { LeagueTable as Table, LeagueTableRow } from '@/api/models';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { tierName } from './labels';

/** What the player's own row says under "Sen": where they stand against the lines, in words. */
export function mySituation(table: Table, myRank: number, myPoints: number): string | null {
  const promote = table.tierUp !== null ? toNumber(table.promoteCount) : 0;
  const relegate = table.tierDown !== null ? toNumber(table.relegateCount) : 0;
  const size = table.rows.length;
  // Falling matters more than the way up: someone in the bottom band is told that first.
  if (relegate > 0 && myRank > size - relegate && myRank > promote) {
    return tr.leagueInRelegation;
  }
  if (promote > 0) {
    if (myRank <= promote) {
      return tr.leagueInPromotion;
    }
    const line = table.rows[promote - 1];
    const gap = line ? toNumber(line.points) - myPoints : 0;
    if (gap > 0) {
      return tr.leagueGapToRank(promote, gap);
    }
  }
  return null;
}

/**
 * The group table (design 05): the rows by alias, a line under the last row that goes up and a line above the first row that
 * goes down (each with its words: the color is never the only sign), and the player's own row as "Sen" on chalk. No name
 * of any player appears: the contract gives a per-week alias and nothing else.
 */
export function LeagueTable({ table }: { table: Table }) {
  const promote = table.tierUp !== null ? toNumber(table.promoteCount) : 0;
  const relegate = table.tierDown !== null ? toNumber(table.relegateCount) : 0;
  const size = table.rows.length;
  const firstRelegated = size - relegate + 1;
  // The two bands never overlap by the server's rule; a table that says otherwise gets no relegation label.
  const showRelegation = relegate > 0 && firstRelegated > promote;

  return (
    <View style={styles.card} testID="league-table">
      {promote > 0 && table.tierUp ? (
        <Text style={styles.promote} testID="table-promote-label">
          {tr.leaguePromoteLine(promote, tierName(table.tierUp))}
        </Text>
      ) : null}
      {table.rows.map((row) => {
        const rank = toNumber(row.rank);
        return (
          <View key={rank}>
            {showRelegation && rank === firstRelegated && table.tierDown ? (
              <Text style={styles.relegate} testID="table-relegate-label">
                {tr.leagueRelegateLine(relegate, tierName(table.tierDown))}
              </Text>
            ) : null}
            <Row
              row={row}
              rank={rank}
              table={table}
              promoteLine={promote > 0 && rank === promote}
            />
          </View>
        );
      })}
      <Text style={styles.footer}>{tr.leagueGroupSize(toNumber(table.size))}</Text>
    </View>
  );
}

interface RowProps {
  row: LeagueTableRow;
  rank: number;
  table: Table;
  promoteLine: boolean;
}

function Row({ row, rank, table, promoteLine }: RowProps) {
  const points = toNumber(row.points);
  if (row.isMe) {
    const note = mySituation(table, rank, points);
    return (
      <View
        style={styles.me}
        accessible
        accessibilityLabel={tr.leagueMeRowLabel(rank, points, note)}
        testID="table-me"
      >
        <Text style={styles.meRank}>{rank}</Text>
        <View style={styles.name}>
          <Text style={styles.meName}>{tr.leagueMe}</Text>
          {note ? <Text style={styles.meNote}>{note}</Text> : null}
        </View>
        <Text style={styles.mePoints}>{points}</Text>
      </View>
    );
  }
  return (
    <View
      style={[styles.row, promoteLine && styles.promoteLine]}
      accessible
      accessibilityLabel={tr.leagueRowLabel(rank, row.alias, points)}
      testID={`table-row-${rank}`}
    >
      <Text style={styles.rank}>{rank}</Text>
      <Text style={styles.alias}>{row.alias}</Text>
      <Text style={styles.points}>{points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.panel,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  promote: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
  },
  relegate: {
    ...theme.typography.captionStrong,
    color: theme.colors.muted,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    borderTopWidth: 2,
    borderTopColor: theme.colors.muted,
  },
  row: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  // The line under the last row that goes up: heavier than a hairline, in the colour of the user's choices.
  promoteLine: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  rank: {
    ...theme.typography.numeric,
    width: theme.sizes.arenaStepNumber,
    color: theme.colors.ink,
  },
  alias: {
    ...theme.typography.body,
    flex: 1,
    color: theme.colors.ink,
  },
  points: {
    ...theme.typography.label,
    fontVariant: ['tabular-nums'],
    color: theme.colors.ink,
  },
  me: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    marginHorizontal: -theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.chalk,
  },
  meRank: {
    ...theme.typography.numeric,
    width: theme.sizes.arenaStepNumber,
    color: theme.colors.chalkInk,
  },
  name: {
    flex: 1,
    gap: 2,
  },
  meName: {
    ...theme.typography.label,
    color: theme.colors.chalkInk,
  },
  meNote: {
    ...theme.typography.caption,
    color: theme.colors.chalkInk,
  },
  mePoints: {
    ...theme.typography.label,
    fontVariant: ['tabular-nums'],
    color: theme.colors.chalkInk,
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
});

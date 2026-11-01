import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PriceSummary as PriceSummaryData } from '@/api/models';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { PriceHistoryChart } from './PriceHistoryChart';
import type { ChartPoint } from './priceHistory';

interface PriceSummaryProps {
  summary: PriceSummaryData;
  history: { status: 'loading' | 'error' | 'ready'; points: readonly ChartPoint[] };
}

/** The two cards under the title: lowest price now, and the price-history sparkline (tap to expand). */
export function PriceSummary({ summary, history }: PriceSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const lowestNow = summary.lowestNow === null ? null : toNumber(summary.lowestNow);
  const highest = summary.highestLast90Days === null ? null : toNumber(summary.highestLast90Days);
  const low90 = summary.lowestLast90Days === null ? undefined : toNumber(summary.lowestLast90Days);
  const canExpand = history.status === 'ready' && history.points.length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.cards}>
        <View style={[styles.card, styles.lowest]}>
          <Text style={[styles.overline, styles.overlineAccent]}>{tr.productLowestPrice}</Text>
          {lowestNow === null ? (
            <Text style={styles.noStock}>{tr.productNoStock}</Text>
          ) : (
            <Text style={styles.price} numberOfLines={1} testID="lowest-price">
              {formatTry(lowestNow)}
            </Text>
          )}
          {summary.isLowestOfLast90Days ? (
            <Text style={styles.captionAccent}>{tr.productLowestOf90Days}</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded, disabled: !canExpand }}
          disabled={!canExpand}
          onPress={() => setExpanded((value) => !value)}
          style={[styles.card, styles.history]}
          testID="price-history-card"
        >
          <Text style={styles.overline}>{tr.productPriceHistory}</Text>
          <View style={styles.miniChart}>
            {history.status === 'loading' ? (
              <Skeleton height={theme.sizes.chartMiniHeight} radius={theme.radius.sm} />
            ) : history.status === 'error' ? (
              <Text style={styles.caption}>{tr.productPriceHistoryFailed}</Text>
            ) : history.points.length === 0 ? (
              <Text style={styles.caption}>{tr.productPriceHistoryEmpty}</Text>
            ) : (
              <PriceHistoryChart points={history.points} variant="mini" lowPrice={low90} />
            )}
          </View>
          {highest !== null && lowestNow !== null ? (
            <Text style={styles.caption} numberOfLines={1}>
              {`${formatTry(highest)} → ${formatTry(lowestNow)}`}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {expanded && canExpand ? (
        <View style={styles.expanded}>
          <PriceHistoryChart points={history.points} variant="full" lowPrice={low90} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.md,
  },
  cards: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  lowest: {
    backgroundColor: theme.colors.accentSoft,
  },
  history: {
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'space-between',
  },
  overline: {
    ...theme.typography.overline,
    color: theme.colors.inkMuted,
  },
  overlineAccent: {
    color: theme.colors.accent,
  },
  price: {
    ...theme.typography.priceLarge,
    color: theme.colors.accent,
  },
  noStock: {
    ...theme.typography.heading,
    color: theme.colors.inkMuted,
  },
  captionAccent: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  miniChart: {
    minHeight: theme.sizes.chartMiniHeight,
    justifyContent: 'center',
  },
  expanded: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
});

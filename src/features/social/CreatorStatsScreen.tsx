import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/api/client';
import type { CreatorStats } from '@/api/models';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatAmount, formatTry, toNumber } from '@/utils/money';

import { useCreatorStats } from './hooks';
import { stableImageUrl } from './imageUrl';
import { SocialHeader } from './SocialHeader';

/**
 * "Kazançlarım": clicks and what they are expected to earn. The amount is an estimate and is always labelled so:
 * conversions are imported later, so nothing here is a confirmed payout unless `confirmedEarnings` says so.
 */
export function CreatorStatsScreen() {
  const stats = useCreatorStats();
  const forbidden = stats.error instanceof ApiError && stats.error.status === 403;

  return (
    <Screen padded={false}>
      <SocialHeader title={tr.creatorEarningsRow} fallback="/profile" />
      {stats.data ? (
        <StatsBody stats={stats.data} />
      ) : stats.isError ? (
        <ErrorState
          title={forbidden ? tr.creatorNotCreator : tr.creatorStatsFailed}
          onRetry={forbidden ? undefined : () => void stats.refetch()}
        />
      ) : (
        <View style={styles.skeleton} testID="stats-skeleton">
          <Skeleton height={theme.sizes.postThumbHeight} radius={theme.radius.xl} />
        </View>
      )}
    </Screen>
  );
}

function StatsBody({ stats }: { stats: CreatorStats }) {
  const router = useRouter();
  const estimate = stats.estimatedEarnings;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero} testID="stats-estimate">
        <Text style={styles.heroLabel}>{tr.creatorDays(toNumber(stats.days))}</Text>
        <Text style={styles.heroAmount}>{formatTry(estimate.amount)}</Text>
        <View style={styles.estimateChip}>
          <Text style={styles.estimateText}>{tr.creatorEstimated}</Text>
        </View>
      </View>
      <Text style={styles.note}>
        {tr.creatorHow(
          toNumber(estimate.clicks),
          formatAmount(estimate.conversionRatePercent),
          formatTry(estimate.averageOrderValue),
          formatAmount(estimate.commissionPercent),
          formatAmount(estimate.sharePercent),
        )}
      </Text>
      <Text style={styles.note}>{tr.creatorEarningsNote}</Text>

      <View style={styles.counters}>
        <Counter label={tr.creatorClicks} value={String(toNumber(stats.clicks))} />
        <Counter label={tr.creatorConfirmed} value={formatTry(stats.confirmedEarnings)} />
        <Counter label={tr.creatorFollowersLabel} value={String(toNumber(stats.followerCount))} />
      </View>

      {stats.topPosts.length > 0 ? (
        <>
          <Text style={styles.section}>{tr.creatorTopPosts}</Text>
          {stats.topPosts.map((post) => (
            <Pressable
              key={post.postId}
              accessibilityRole="button"
              onPress={() => router.push(`/posts/${post.postId}`)}
              style={styles.topPost}
              testID={`top-post-${post.postId}`}
            >
              <View style={styles.thumb}>
                {post.previewUrl ? (
                  <Image
                    source={{ uri: stableImageUrl(`${post.postId}:preview`, post.previewUrl) }}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Icon
                    name="shirt"
                    size={22}
                    color={theme.colors.borderStrong}
                    strokeWidth={1.4}
                  />
                )}
              </View>
              <Text style={styles.topPostText}>
                {tr.creatorTopPostStats(toNumber(post.clicks), toNumber(post.likeCount))}
              </Text>
              <Icon name="chevronRight" size={18} color={theme.colors.inkMuted} />
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    paddingHorizontal: theme.screenPaddingX,
  },
  content: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  hero: {
    gap: theme.spacing.xs,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.ink,
  },
  heroLabel: {
    ...theme.typography.caption,
    color: theme.colors.onInk,
  },
  heroAmount: {
    ...theme.typography.display,
    color: theme.colors.onInk,
  },
  estimateChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  estimateText: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  note: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  counters: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  counter: {
    flex: 1,
    gap: 2,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
  },
  counterValue: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  counterLabel: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  section: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  topPost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.sizes.touch,
  },
  thumb: {
    width: theme.sizes.postThumbWidth,
    height: theme.sizes.postThumbHeight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  topPostText: {
    flex: 1,
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
});

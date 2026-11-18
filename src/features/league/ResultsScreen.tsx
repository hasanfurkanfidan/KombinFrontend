import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import type { LeagueResults } from '@/api/models';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { announce } from '@/utils/a11y';
import { formatWeekday } from '@/utils/dates';
import { toNumber } from '@/utils/money';
import { rateLimitedText } from '@/utils/rateLimit';

import { ArenaHeader, ArenaMessage, ArenaScreen } from './ArenaScreen';
import { useLeagueMe, useLeagueResults, useNow } from './hooks';
import { istanbulClock, tierName, weekTimeLeft } from './labels';
import { LeagueFigure } from './LeagueFigure';

interface ResultsScreenProps {
  /** `yyyy-MM-dd` from a deep link (`kombin://league/results?day=…`); `null` is the latest closed day. */
  day: string | null;
}

/**
 * The evening result (design 04): the big rank and the comparisons, the day's points, the week line. What is shown
 * follows what the day was: ranked (the rank), not ranked ("Yeterli oy toplanamadı"), not competed (what to do tomorrow),
 * under review or removed (the server's message, no rank), or no result yet (when it comes).
 */
export function ResultsScreen({ day }: ResultsScreenProps) {
  const router = useRouter();
  const query = useLeagueResults(day);
  const me = useLeagueMe().data ?? undefined;
  const now = useNow(60_000);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const result = query.data ?? null;

  // Once per opening, when the result itself has settled (not for "no result yet" or an error).
  const viewed = useRef(false);
  const resultStatus = result?.status ?? null;
  useEffect(() => {
    if (resultStatus && !viewed.current) {
      viewed.current = true;
      track('league_results_view', { status: resultStatus });
    }
  }, [resultStatus]);
  const subtitle = result
    ? tr.leagueResultsTitle(formatWeekday(result.day))
    : tr.leagueResultsDefaultTitle;

  let body;
  let footer;
  if (query.isPending) {
    body = <Loading />;
  } else if (query.isError) {
    body = (
      <ArenaMessage
        title={tr.errorTitle}
        body={rateLimitedText(query.error) ?? tr.errorBody}
        actions={
          <Button
            label={tr.retry}
            variant="chalk"
            onPress={() => void query.refetch()}
            testID="results-retry"
          />
        }
      />
    );
  } else if (result === null) {
    const closesAt = me?.today.closesAt ?? null;
    const afterClose = closesAt !== null && new Date(closesAt).getTime() <= now.getTime();
    body = afterClose ? (
      <ArenaMessage
        title={tr.leagueResultsPreparingTitle}
        body={tr.leagueResultsPreparingBody}
        actions={
          <>
            <Button
              label={tr.leagueRefresh}
              variant="chalk"
              onPress={() => void query.refetch()}
              testID="results-refresh"
            />
            <Button
              label={tr.leagueBackToLeague}
              variant="onArena"
              onPress={() => router.replace('/league')}
            />
          </>
        }
      />
    ) : (
      <ArenaMessage
        title={tr.leagueNoResultTitle}
        body={tr.leagueNoResultBody(closesAt ? istanbulClock(closesAt) : '21:00')}
        actions={
          <Button
            label={tr.leagueBackToLeague}
            variant="chalk"
            onPress={() => router.replace('/league')}
            testID="results-back"
          />
        }
      />
    );
  } else {
    body = <ResultBody result={result} now={now} />;
    footer = (
      <Button
        label={tr.leagueSeeTable}
        variant="chalk"
        onPress={() => router.push('/league')}
        testID="results-table"
      />
    );
  }

  return (
    <ArenaScreen scroll contentStyle={styles.screen} footer={footer}>
      <ArenaHeader leading="close" onLeading={close} subtitle={subtitle} />
      <View style={styles.body}>{body}</View>
    </ArenaScreen>
  );
}

function Loading() {
  useEffect(() => {
    announce(tr.a11yLoading);
  }, []);
  return <View style={styles.skeleton} accessibilityElementsHidden testID="results-loading" />;
}

type Kind = 'ranked' | 'notRanked' | 'notCompeted' | 'underReview' | 'removed';

function kindOf(result: LeagueResults): Kind {
  if (result.status === 'Removed') {
    return 'removed';
  }
  if (result.status === 'UnderReview') {
    return 'underReview';
  }
  if (!result.competed) {
    return 'notCompeted';
  }
  return result.ranked === true && result.rank !== null ? 'ranked' : 'notRanked';
}

function ResultBody({ result, now }: { result: LeagueResults; now: Date }) {
  const kind = kindOf(result);
  return (
    <View style={styles.result} testID={`results-${kind}`}>
      <Hero result={result} kind={kind} />
      <PointsCard result={result} kind={kind} />
      {result.week ? <WeekLine week={result.week} now={now} /> : null}
    </View>
  );
}

function Hero({ result, kind }: { result: LeagueResults; kind: Kind }) {
  const comparisons = toNumber(result.comparisons);
  const comparedLine = comparisons > 0 ? tr.leagueCompared(comparisons) : null;

  let text;
  if (kind === 'ranked') {
    const rank = toNumber(result.rank ?? 0);
    const count = toNumber(result.rankedCount);
    text = (
      <View
        style={styles.heroText}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${tr.leagueRankSpoken(rank, count)}. ${comparedLine ?? ''}`.trim()}
        testID="results-rank"
      >
        {/* A display figure: it is already 96 pt, and the sentence under it says the same at any size. */}
        <Text style={styles.rank} maxFontSizeMultiplier={1.3}>
          {tr.leagueRank(rank)}
        </Text>
        <Text style={styles.among}>{tr.leagueRankedAmong(count)}</Text>
        {comparedLine ? <Text style={styles.detail}>{comparedLine}</Text> : null}
      </View>
    );
  } else {
    const title =
      kind === 'notRanked'
        ? tr.leagueNotRankedTitle
        : kind === 'notCompeted'
          ? tr.leagueNotCompetedTitle
          : kind === 'removed'
            ? // The server's sentence as it is; with none there is no paragraph.
              (result.message ?? null)
            : (result.message ?? tr.leagueUnderReviewFallback);
    const detail =
      kind === 'notRanked'
        ? tr.leagueNotRankedBody
        : kind === 'notCompeted'
          ? tr.leagueNotCompetedBody
          : null;
    text = (
      <View style={styles.heroText}>
        {title ? (
          <Text
            accessibilityRole="header"
            style={kind === 'underReview' || kind === 'removed' ? styles.message : styles.headline}
            testID="results-headline"
          >
            {title}
          </Text>
        ) : null}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {kind === 'notRanked' && comparedLine ? (
          <Text style={styles.detail}>{comparedLine}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      {text}
      {result.entry ? (
        <View style={styles.figurePanel} testID="results-figure">
          <LeagueFigure pieces={result.entry.pieces} />
        </View>
      ) : null}
    </View>
  );
}

interface PointRowProps {
  title: string;
  hint?: string | null;
  value: number;
  muted?: boolean;
  last?: boolean;
  testID: string;
}

function PointRow({ title, hint, value, muted = false, last = false, testID }: PointRowProps) {
  return (
    <View
      style={[styles.row, !last && styles.rowLine]}
      accessible
      accessibilityLabel={`${title}${hint ? `. ${hint}` : ''}. ${value} puan`}
      testID={testID}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, muted && styles.rowMuted]}>{title}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.rowValue, muted && styles.rowMuted]}>{value}</Text>
    </View>
  );
}

function PointsCard({ result, kind }: { result: LeagueResults; kind: Kind }) {
  const { points } = result;
  const votes = points.votes === null ? null : toNumber(points.votes);
  const voting = toNumber(points.voting);
  const worn = toNumber(points.worn);
  const pieces = toNumber(points.pieces);
  // The vote points exist only for an outfit that competed and is not held back or taken out.
  const showVotes = votes !== null && kind !== 'notCompeted' && kind !== 'removed';
  return (
    <View style={styles.card} testID="results-points">
      {showVotes ? (
        <PointRow
          title={tr.leaguePointsVotes}
          hint={tr.leaguePointsVotesHint}
          value={votes}
          testID="points-votes"
        />
      ) : null}
      <PointRow
        title={voting > 0 ? tr.leaguePointsVoting : tr.leaguePointsVotingNone}
        value={voting}
        muted={voting === 0}
        testID="points-voting"
      />
      <PointRow
        title={worn > 0 ? tr.leaguePointsWorn : tr.leaguePointsWornNone}
        value={worn}
        muted={worn === 0}
        testID="points-worn"
      />
      <PointRow
        title={pieces > 0 ? tr.leaguePointsPieces : tr.leaguePointsPiecesNone}
        hint={pieces === 0 && result.piecePointsAvailable ? tr.leaguePointsPiecesHint : null}
        value={pieces}
        muted={pieces === 0}
        last
        testID="points-pieces"
      />
      <View style={styles.total} testID="points-total">
        <Text style={styles.totalLabel}>{tr.leaguePointsTotal}</Text>
        <Text
          style={styles.totalValue}
          accessibilityLabel={`${toNumber(points.total)} puan`}
          testID="points-total-value"
        >
          {toNumber(points.total)}
        </Text>
      </View>
    </View>
  );
}

function WeekLine({ week, now }: { week: NonNullable<LeagueResults['week']>; now: Date }) {
  const toPromotion = week.pointsToPromotion === null ? null : toNumber(week.pointsToPromotion);
  const second = [
    toPromotion !== null && toPromotion > 0 ? tr.leagueToPromotion(toPromotion) : null,
    weekTimeLeft(week.endsAt, now),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.week} accessible testID="results-week">
      <Text style={styles.weekTitle}>
        {tr.leagueWeekRank(tierName(week.tier), toNumber(week.groupRank))}
      </Text>
      <Text style={styles.detail}>{second}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  skeleton: {
    height: theme.sizes.arenaResultFigureHeight,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.arena.raised,
  },
  result: {
    gap: theme.spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.lg,
  },
  heroText: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  rank: {
    ...theme.typography.arenaHero,
    color: theme.colors.chalk,
  },
  among: {
    ...theme.typography.subhead,
    color: theme.arena.text,
  },
  detail: {
    ...theme.typography.body,
    color: theme.arena.textSoft,
  },
  headline: {
    ...theme.typography.title,
    color: theme.arena.text,
  },
  message: {
    ...theme.typography.heading,
    color: theme.arena.text,
  },
  figurePanel: {
    width: theme.sizes.arenaResultFigureWidth,
    height: theme.sizes.arenaResultFigureHeight,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.tile,
    padding: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.panel,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
  },
  row: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  rowHint: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  rowValue: {
    ...theme.typography.priceLarge,
    color: theme.colors.ink,
  },
  rowMuted: {
    color: theme.colors.muted,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 2,
    borderTopColor: theme.colors.ink,
  },
  totalLabel: {
    ...theme.typography.label,
    flex: 1,
    color: theme.colors.ink,
  },
  totalValue: {
    ...theme.typography.priceHero,
    color: theme.colors.primary,
  },
  week: {
    gap: theme.spacing.xs,
  },
  weekTitle: {
    ...theme.typography.label,
    color: theme.arena.text,
  },
});

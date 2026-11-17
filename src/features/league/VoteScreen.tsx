import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/api/client';
import type { LeagueNextPair, LeaguePair, LeagueVoteResult } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { LiveText } from '@/components/LiveText';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { announce, lines } from '@/utils/a11y';
import { toNumber } from '@/utils/money';
import { rateLimitedText } from '@/utils/rateLimit';

import { ArenaHeader, ArenaMessage, ArenaScreen } from './ArenaScreen';
import { useLeagueMe, useNextPair, useNow, useReportPair, useVote } from './hooks';
import { formatCountdown, istanbulClock, tierLeague } from './labels';
import { ResultCard, SIDE_NAMES, VoteCard, type Side } from './LeagueCard';
import { Reveal } from './Reveal';
import { VoteProgress } from './VoteProgress';

type Choice = Side | 'skip';

type Phase =
  { kind: 'voting' } | { kind: 'voted'; choice: Side; result: LeagueVoteResult; pair: LeaguePair };

/** A picture that never reports back must not hold the vote for ever. */
const DISPLAY_FALLBACK_MS = 5000;
/** The countdown to the results is shown in whole minutes: ask the clock twice a minute. */
const CLOCK_MS = 30_000;

function errorCodeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.errorCode : null;
}

/**
 * Voting (design 02 and 03). One pair at a time: tap a figure to vote ("Karar veremedim" skips). The time to decide is
 * measured from the moment both figures are fully displayed (every picture settled) to the tap, and sent as `decisionMs`.
 * After the vote the chosen outfit's real win rate today is shown with "Sıradaki çift"; after the day's closing time, or
 * when the server says the day is closed, the results open instead.
 */
export function VoteScreen() {
  const router = useRouter();
  const meQuery = useLeagueMe();
  const me = meQuery.data ?? undefined;
  const [serial, setSerial] = useState(0);
  const pairQuery = useNextPair(serial);
  const [phase, setPhase] = useState<Phase>({ kind: 'voting' });
  const [pending, setPending] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuSide, setMenuSide] = useState<Side | null>(null);
  const vote = useVote();
  const report = useReportPair();
  const now = useNow(CLOCK_MS);

  /** The moment both figures were fully displayed; null until then. */
  const shownAt = useRef<number | null>(null);
  /** A vote or a report is out: a second tap must not send another. */
  const busy = useRef(false);

  const data: LeagueNextPair | undefined = pairQuery.data;
  const pair = phase.kind === 'voted' ? phase.pair : (data?.pair ?? null);
  const closesAt = data?.closesAt ?? me?.today.closesAt ?? null;
  const closed = closesAt !== null && new Date(closesAt).getTime() <= now.getTime();

  const queryError = pairQuery.error;
  const queryStatus = queryError instanceof ApiError ? queryError.status : null;
  const dayClosed = queryStatus === 409 || errorCodeOf(queryError) === 'League.DayClosed';
  const notJoined = errorCodeOf(queryError) === 'League.NotJoined';
  // Not in the league at all (or never joined): there is nothing to vote on here.
  const noLeague = meQuery.data === null;
  const notJoinedYet = me !== undefined && !me.joined;

  useEffect(() => {
    if (closed || dayClosed) {
      router.replace('/league/results');
    } else if (notJoined || notJoinedYet) {
      router.replace('/league/join');
    } else if (noLeague) {
      router.replace('/');
    }
  }, [closed, dayClosed, notJoined, notJoinedYet, noLeague, router]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/league'));

  /** The next pair: a fresh query, so an answered pair is never shown again. */
  const advance = useCallback(() => {
    shownAt.current = null;
    busy.current = false;
    setPhase({ kind: 'voting' });
    setPending(null);
    setError(null);
    setSerial((current) => current + 1);
  }, []);

  const onShown = useCallback(() => {
    if (shownAt.current === null) {
      shownAt.current = Date.now();
    }
  }, []);

  const handleVoteError = (cause: unknown) => {
    const code = errorCodeOf(cause);
    if (code === 'League.DayClosed') {
      router.replace('/league/results');
    } else if (code === 'League.AlreadyVoted' || code === 'League.PairNotFound') {
      // Answered somewhere else, or gone: ask for the pair that is current now.
      advance();
    } else {
      // The pair stays exactly as it was; the player can tap again.
      setError(rateLimitedText(cause) ?? tr.leagueVoteFailed);
    }
  };

  const send = (choice: Choice) => {
    const current = data?.pair;
    if (!current || busy.current || phase.kind === 'voted') {
      return;
    }
    busy.current = true;
    setError(null);
    if (choice !== 'skip') {
      setPending(choice);
    }
    const decisionMs = shownAt.current === null ? 0 : Math.max(0, Date.now() - shownAt.current);
    vote.mutate(
      { pairId: current.id, choice, decisionMs },
      {
        onSuccess: (result) => {
          busy.current = false;
          setPending(null);
          if (choice === 'skip') {
            advance();
          } else {
            setPhase({ kind: 'voted', choice, result, pair: current });
          }
        },
        onError: (cause) => {
          busy.current = false;
          setPending(null);
          handleVoteError(cause);
        },
      },
    );
  };

  const reportSide = (side: Side) => {
    setMenuSide(null);
    const current = data?.pair;
    if (!current || busy.current) {
      return;
    }
    busy.current = true;
    report.mutate(
      { pairId: current.id, side, reason: 'Inappropriate' },
      {
        onSuccess: () => {
          showToast(tr.leagueReported);
          advance();
        },
        onError: (cause) => {
          const code = errorCodeOf(cause);
          if (code === 'League.AlreadyReported' || code === 'League.PairNotFound') {
            advance();
          } else {
            busy.current = false;
            showToast(tr.leagueReportFailed);
          }
        },
      },
    );
  };

  const source = phase.kind === 'voted' ? phase.result : data;
  const target = Math.max(1, toNumber(source?.target ?? me?.today.target ?? 10));
  const counted = Math.min(target, toNumber(source?.countedToday ?? me?.today.countedVotes ?? 0));
  const subtitle = me
    ? [tierLeague(me.tier), me.week ? tr.leagueRankYou(toNumber(me.week.groupRank)) : null]
        .filter(Boolean)
        .join(' · ')
    : null;
  const votesText = tr.leagueEntryVotes(counted, target);

  let body;
  let footer;
  if (pairQuery.isPending) {
    body = <Loading />;
  } else if (pairQuery.isError) {
    body =
      dayClosed || notJoined ? null : (
        <ArenaMessage
          title={tr.errorTitle}
          body={rateLimitedText(queryError) ?? tr.errorBody}
          actions={
            <>
              <Button
                label={tr.retry}
                variant="chalk"
                onPress={() => void pairQuery.refetch()}
                testID="vote-retry"
              />
              <Button label={tr.leagueBackToLeague} variant="onArena" onPress={leave} />
            </>
          }
        />
      );
  } else if (data && data.pair === null && data.reason === 'DailyLimit') {
    body = (
      <ArenaMessage
        title={tr.leagueDailyLimitTitle}
        body={tr.leagueDailyLimitBody(closesAt ? istanbulClock(closesAt) : '21:00')}
        actions={<Button label={tr.leagueBackToLeague} variant="chalk" onPress={leave} />}
      />
    );
  } else if (data && pair === null) {
    // `NoPairs`, or an answer with neither a pair nor a reason: nothing to show right now.
    body = (
      <ArenaMessage
        title={tr.leagueNoPairsTitle}
        body={tr.leagueNoPairsBody}
        actions={
          <>
            <Button
              label={tr.leagueNoPairsRetry}
              variant="chalk"
              onPress={() => void pairQuery.refetch()}
              testID="vote-no-pairs-retry"
            />
            <Button label={tr.leagueBackToLeague} variant="onArena" onPress={leave} />
          </>
        }
      />
    );
  } else if (pair && phase.kind === 'voted') {
    body = <VotedBoard pair={pair} choice={phase.choice} result={phase.result} />;
    footer = (
      <VotedFooter
        rate={phase.result.chosenWinRate === null ? null : toNumber(phase.result.chosenWinRate)}
        counted={phase.result.counted}
        reachedTarget={counted >= target}
        onNext={advance}
      />
    );
  } else if (pair) {
    body = (
      <PairBoard
        key={pair.id}
        pair={pair}
        pending={pending}
        error={error}
        onVote={(side) => send(side)}
        onMenu={setMenuSide}
        onShown={onShown}
      />
    );
    footer = (
      <View style={styles.footer}>
        <VoteProgress counted={counted} target={target} />
        <View style={styles.footerRow}>
          <Button
            label={tr.leagueSkip}
            variant="onArena"
            wrap
            disabled={pending !== null}
            onPress={() => send('skip')}
            style={styles.skip}
            testID="vote-skip"
          />
          {closesAt ? (
            <Text
              style={styles.countdown}
              accessibilityLabel={tr.leagueClosesIn(
                formatCountdown(new Date(closesAt).getTime() - now.getTime()),
              )}
              testID="vote-countdown"
            >
              {tr.leagueClosesPrefix}{' '}
              <Text style={styles.countdownTime}>
                {formatCountdown(new Date(closesAt).getTime() - now.getTime())}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ArenaScreen scroll contentStyle={styles.screen} footer={footer}>
      <ArenaHeader
        leading="close"
        onLeading={leave}
        subtitle={subtitle}
        trailing={
          <Text style={styles.votes} accessibilityLabel={votesText} testID="vote-count">
            {votesText}
          </Text>
        }
      />
      <View style={styles.body}>{body}</View>
      <ReportMenu
        side={menuSide}
        onClose={() => setMenuSide(null)}
        onReport={(side) => reportSide(side)}
      />
    </ArenaScreen>
  );
}

function Loading() {
  useEffect(() => {
    announce(tr.leagueVotePicking);
  }, []);
  return (
    <View style={styles.board} accessibilityElementsHidden testID="vote-loading">
      <Text accessibilityRole="header" style={styles.title}>
        {tr.leagueVoteTitle}
      </Text>
      <View style={styles.cards}>
        <View style={styles.placeholder} />
        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

interface PairBoardProps {
  pair: LeaguePair;
  pending: Side | null;
  error: string | null;
  onVote: (side: Side) => void;
  onMenu: (side: Side) => void;
  onShown: () => void;
}

/**
 * The two figures. Votes open once every picture of both has loaded (or failed): that moment is when the player can
 * first compare them, and what `decisionMs` is counted from. A fallback timer opens them anyway.
 */
function PairBoard({ pair, pending, error, onVote, onMenu, onShown }: PairBoardProps) {
  const total = [...pair.left.pieces, ...pair.right.pieces].filter(
    (piece) => piece.imageUrl,
  ).length;
  const [settled, setSettled] = useState(0);
  const [forced, setForced] = useState(false);
  const ready = forced || settled >= total;

  useEffect(() => {
    const timer = setTimeout(() => setForced(true), DISPLAY_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) {
      onShown();
    }
  }, [ready, onShown]);

  const imageSettled = useCallback(() => setSettled((count) => count + 1), []);
  const disabled = !ready || pending !== null;

  return (
    <View style={styles.board} testID="vote-board">
      <Text accessibilityRole="header" style={styles.title}>
        {tr.leagueVoteTitle}
      </Text>
      <View style={styles.cards}>
        <VoteCard
          side="left"
          pieces={pair.left.pieces}
          disabled={disabled}
          pending={pending === 'left'}
          onVote={() => onVote('left')}
          onMenu={() => onMenu('left')}
          onImageSettled={imageSettled}
        />
        <VoteCard
          side="right"
          pieces={pair.right.pieces}
          disabled={disabled}
          pending={pending === 'right'}
          onVote={() => onVote('right')}
          onMenu={() => onMenu('right')}
          onImageSettled={imageSettled}
        />
      </View>
      {error ? (
        <LiveText style={styles.error} testID="vote-error">
          {error}
        </LiveText>
      ) : null}
    </View>
  );
}

interface VotedBoardProps {
  pair: LeaguePair;
  choice: Side;
  result: LeagueVoteResult;
}

/** After the vote: the win rate of the outfit the player picked (never a claim about what others thought), the pair below. */
function VotedBoard({ pair, choice, result }: VotedBoardProps) {
  const rate = result.chosenWinRate === null ? null : toNumber(result.chosenWinRate);
  return (
    <View style={styles.board} testID="vote-result">
      <Reveal>
        {rate === null ? (
          <Text accessibilityRole="header" style={styles.title} testID="vote-first-votes">
            {tr.leagueFirstVotes}
          </Text>
        ) : (
          <View
            style={styles.rateRow}
            accessible
            accessibilityRole="header"
            accessibilityLabel={tr.leagueWinRate(rate)}
            testID="vote-win-rate"
          >
            {/* A display figure: it is already 56 pt, and the words next to it say the same thing at any size. */}
            <Text style={styles.rateFigure} maxFontSizeMultiplier={1.3}>
              {`%${rate}`}
            </Text>
            <Text style={styles.rateUnit}>{tr.leagueWinRateUnit}</Text>
          </View>
        )}
      </Reveal>
      <View style={styles.cards}>
        <ResultCard side="left" pieces={pair.left.pieces} chosen={choice === 'left'} />
        <ResultCard side="right" pieces={pair.right.pieces} chosen={choice === 'right'} />
      </View>
      {!result.counted ? (
        <LiveText style={styles.notCounted} testID="vote-not-counted">
          {tr.leagueNotCounted}
        </LiveText>
      ) : null}
    </View>
  );
}

interface VotedFooterProps {
  rate: number | null;
  counted: boolean;
  reachedTarget: boolean;
  onNext: () => void;
}

function VotedFooter({ rate, counted, reachedTarget, onNext }: VotedFooterProps) {
  return (
    <View style={styles.footer}>
      {rate !== null ? (
        <View
          style={styles.rateBar}
          accessible
          accessibilityRole="image"
          accessibilityLabel={tr.leagueWinRateBar(rate)}
          testID="vote-win-bar"
        >
          <View style={[styles.rateBarWon, { flex: rate }]} />
          <View style={[styles.rateBarRest, { flex: 100 - rate }]} />
        </View>
      ) : null}
      {reachedTarget && counted ? (
        <LiveText style={styles.targetDone} testID="vote-target-done">
          {tr.leagueTargetDone}
        </LiveText>
      ) : null}
      <Button label={tr.leagueNextPair} variant="chalk" onPress={onNext} testID="vote-next" />
    </View>
  );
}

interface ReportMenuProps {
  side: Side | null;
  onClose: () => void;
  onReport: (side: Side) => void;
}

/** The menu of one figure: one row, "Uygunsuz içerik bildir". */
function ReportMenu({ side, onClose, onReport }: ReportMenuProps) {
  return (
    <BottomSheet visible={side !== null} title={tr.leagueMenuTitle} onClose={onClose}>
      {side ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr.leagueReport}. ${SIDE_NAMES[side]} kombin`}
          onPress={() => onReport(side)}
          style={styles.menuRow}
          testID="menu-report"
        >
          <Icon name="flag" size={20} color={theme.colors.ink} />
          <Text style={styles.menuRowText} numberOfLines={lines(2)}>
            {tr.leagueReport}
          </Text>
        </Pressable>
      ) : null}
    </BottomSheet>
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
  board: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  title: {
    ...theme.typography.display,
    color: theme.arena.text,
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  placeholder: {
    flex: 1,
    minHeight: theme.sizes.arenaCardMinHeight,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.arena.raised,
  },
  votes: {
    ...theme.typography.label,
    color: theme.colors.chalk,
    textAlign: 'right',
  },
  error: {
    ...theme.typography.bodyMedium,
    color: theme.colors.chalk,
  },
  footer: {
    gap: theme.spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: theme.spacing.md,
  },
  skip: {
    paddingHorizontal: 0,
  },
  countdown: {
    ...theme.typography.body,
    color: theme.arena.text,
  },
  countdownTime: {
    ...theme.typography.label,
    color: theme.colors.chalk,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing.md,
  },
  rateFigure: {
    ...theme.typography.arenaFigure,
    color: theme.colors.chalk,
  },
  rateUnit: {
    ...theme.typography.label,
    color: theme.arena.text,
    flexShrink: 1,
  },
  notCounted: {
    ...theme.typography.body,
    color: theme.arena.textSoft,
  },
  rateBar: {
    flexDirection: 'row',
    height: theme.sizes.arenaProgress,
    borderRadius: theme.sizes.arenaProgress / 2,
    overflow: 'hidden',
  },
  rateBarWon: {
    backgroundColor: theme.colors.chalk,
  },
  rateBarRest: {
    backgroundColor: theme.arena.track,
  },
  targetDone: {
    ...theme.typography.bodyMedium,
    color: theme.arena.textSoft,
  },
  menuRow: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  menuRowText: {
    ...theme.typography.bodyMedium,
    flex: 1,
    color: theme.colors.ink,
  },
});

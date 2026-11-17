import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getLeagueMe,
  getLeagueResults,
  getLeagueTable,
  getNextPair,
  joinLeague,
  leaveLeague,
  reportPair,
  voteOnPair,
  withdrawLeagueEntry,
  type ReportBody,
  type VoteBody,
} from '@/api/endpoints/league';
import type { LeagueMe, LeagueVoteResult } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

import { isActivePlayer } from './labels';

/** The league's state rarely changes under the player; the vote and the join patch it themselves. */
const ME_STALE_MS = 30_000;
/** "There is no league" is a property of the server's configuration: asking again every half minute is wasted. */
const NO_LEAGUE_STALE_MS = 10 * 60_000;
/** A pending outfit waits for the image safety check; ask again now and then so the line can change. */
const PENDING_POLL_MS = 30_000;

interface LeagueMeOptions {
  /** Ask again even when the cached answer is fresh (the morning card does, because the player has just worn an outfit). */
  refetchOnMount?: 'always';
}

/**
 * `GET /league/me`. **`null` data means there is no league** (the server answers 404 while the league is switched off):
 * nothing on screen, no error. Signed-out visitors never ask. While `entry.status` is `Pending` it is asked again every
 * 30 seconds.
 */
export function useLeagueMe(options: LeagueMeOptions = {}) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.leagueMe,
    queryFn: ({ signal }) => getLeagueMe(signal),
    enabled: isSignedIn,
    staleTime: (query) => (query.state.data === null ? NO_LEAGUE_STALE_MS : ME_STALE_MS),
    refetchOnMount: options.refetchOnMount,
    refetchInterval: (query) =>
      query.state.data?.today.entry?.status === 'Pending' ? PENDING_POLL_MS : false,
  });
}

/** The caller's league state, or `undefined` while it loads, when there is no league and when asking failed. */
export function useLeagueState(): LeagueMe | undefined {
  return useLeagueMe().data ?? undefined;
}

/** There is a league **and** the player takes part in it (joined, current consent accepted). */
export function useIsLeaguePlayer(): boolean {
  const me = useLeagueState();
  return me !== undefined && isActivePlayer(me);
}

function patchMe(
  queryClient: ReturnType<typeof useQueryClient>,
  change: (me: LeagueMe) => LeagueMe,
): void {
  queryClient.setQueryData<LeagueMe | null>(queryKeys.leagueMe, (me) => (me ? change(me) : me));
}

/** `POST /league/join`: the answer is the new state, which replaces the cached one. */
export function useJoinLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (consentVersion: string) => joinLeague(consentVersion),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.leagueMe, me);
      // Their group, table and pairs are theirs from now on.
      void queryClient.invalidateQueries({ queryKey: queryKeys.leagueAll, refetchType: 'none' });
    },
  });
}

/** `POST /league/leave`: everything the league showed is stale, and so is the row on Keşfet. */
export function useLeaveLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveLeague(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.leagueAll }),
  });
}

/** `DELETE /league/me/entry`: today's outfit leaves the day's competition. */
export function useWithdrawEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => withdrawLeagueEntry(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.leagueMe }),
  });
}

/**
 * The next pair to vote on. Asking again for an unanswered pair returns the same one (the server never re-rolls), so a
 * screen that is reopened simply gets its pair back. Each serial is its own query and is dropped as soon as nobody
 * watches it: an answered pair is never shown again from the cache.
 */
export function useNextPair(serial: number) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.leaguePair(serial),
    queryFn: ({ signal }) => getNextPair(signal),
    enabled: isSignedIn,
    staleTime: 0,
    gcTime: 0,
  });
}

export interface VoteInput extends VoteBody {
  pairId: string;
}

/** `POST /league/pairs/{id}/vote`. The progress counters go into the cached state so Keşfet's row follows along. */
export function useVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pairId, ...body }: VoteInput) => voteOnPair(pairId, body),
    onSuccess: (result: LeagueVoteResult) =>
      patchMe(queryClient, (me) => ({
        ...me,
        today: { ...me.today, countedVotes: result.countedToday, servedPairs: result.servedToday },
      })),
  });
}

export interface ReportInput extends ReportBody {
  pairId: string;
}

/** `POST /league/pairs/{id}/report`: reporting uses the pair up, like a skip. */
export function useReportPair() {
  return useMutation({
    mutationFn: ({ pairId, ...body }: ReportInput) => reportPair(pairId, body),
  });
}

/** One closed day's result; `null` day is the latest. Data `null` is "no result yet". */
export function useLeagueResults(day: string | null) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.leagueResults(day),
    queryFn: ({ signal }) => getLeagueResults(day, signal),
    enabled: isSignedIn,
    staleTime: 60_000,
  });
}

/** The group table of this week. Data `null` is "no group yet" (404 `League.NoGroup`). */
export function useLeagueTable(enabled = true) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.leagueTable,
    queryFn: ({ signal }) => getLeagueTable(signal),
    enabled: isSignedIn && enabled,
    staleTime: 30_000,
  });
}

/**
 * The current time, moving on every `intervalMs` while mounted. Countdowns use it; the interval is the only timer and is
 * cleared with the component.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

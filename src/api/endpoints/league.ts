import { ApiError, request } from '../client';
import type {
  LeagueMe,
  LeagueNextPair,
  LeagueResults,
  LeagueTable,
  LeagueVoteResult,
} from '../models';

const BASE = '/api/v1/league';

/** A 404 from the league's routes means "nothing here" (the league is switched off, no result yet, no group). */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * The caller's league state. **A 404 means there is no league** (it is switched off on the server): the answer is `null`
 * and the app shows no entry point and no error. Every other failure is thrown as usual.
 */
export async function getLeagueMe(signal?: AbortSignal): Promise<LeagueMe | null> {
  try {
    return await request<LeagueMe>(`${BASE}/me`, { auth: true, signal });
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Joins with the consent version the player was shown; the answer is the new `GET /league/me`. */
export function joinLeague(consentVersion: string): Promise<LeagueMe> {
  return request<LeagueMe>(`${BASE}/join`, {
    method: 'POST',
    body: { consentVersion },
    auth: true,
  });
}

export function leaveLeague(): Promise<void> {
  return request<void>(`${BASE}/leave`, { method: 'POST', auth: true });
}

/** Takes today's outfit out of the day's competition; final for the day. */
export function withdrawLeagueEntry(): Promise<void> {
  return request<void>(`${BASE}/me/entry`, { method: 'DELETE', auth: true });
}

export function getNextPair(signal?: AbortSignal): Promise<LeagueNextPair> {
  return request<LeagueNextPair>(`${BASE}/pairs/next`, { auth: true, signal });
}

export interface VoteBody {
  /** `left`, `right`, or `skip` ("Karar veremedim"). */
  choice: 'left' | 'right' | 'skip';
  /** Milliseconds from the moment both figures were fully displayed to the tap. */
  decisionMs: number;
}

export function voteOnPair(pairId: string, body: VoteBody): Promise<LeagueVoteResult> {
  return request<LeagueVoteResult>(`${BASE}/pairs/${encodeURIComponent(pairId)}/vote`, {
    method: 'POST',
    body,
    auth: true,
  });
}

export interface ReportBody {
  side: 'left' | 'right';
  reason?: 'Inappropriate' | 'NotClothing' | 'Other';
}

export function reportPair(pairId: string, body: ReportBody): Promise<{ reported: boolean }> {
  return request<{ reported: boolean }>(`${BASE}/pairs/${encodeURIComponent(pairId)}/report`, {
    method: 'POST',
    body,
    auth: true,
  });
}

/**
 * The caller's result for one closed day, or for the latest one when `day` is `null`. `null` is "no result yet" (404
 * `League.ResultsNotReady`: the day is not closed, or the caller has no row; also a day the server calls invalid).
 */
export async function getLeagueResults(
  day: string | null,
  signal?: AbortSignal,
): Promise<LeagueResults | null> {
  try {
    return await (day === null
      ? request<LeagueResults>(`${BASE}/results/latest`, { auth: true, signal })
      : request<LeagueResults>(`${BASE}/results`, { query: { day }, auth: true, signal }));
  } catch (error) {
    if (
      isNotFound(error) ||
      (error instanceof ApiError && error.errorCode === 'League.InvalidDay')
    ) {
      return null;
    }
    throw error;
  }
}

/** The caller's group table this week, or `null` when the group is not formed yet (404 `League.NoGroup`). */
export async function getLeagueTable(signal?: AbortSignal): Promise<LeagueTable | null> {
  try {
    return await request<LeagueTable>(`${BASE}/table`, { auth: true, signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.errorCode === 'League.NoGroup') {
      return null;
    }
    throw error;
  }
}

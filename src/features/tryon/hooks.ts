import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { getTryOn, reportTryOn, type TryOnSubject } from '@/api/endpoints/tryon';
import type { ReportTryOnRequest, TryOn } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

import { isTryOnOff, noteTryOnDisabled, noteTryOnRateLimited, tryOnBlockedUntil } from './gate';

/**
 * The rules of asking (a request can make the server draw a new image, and a user gets 30 an hour):
 *
 * - only a screen that shows an outfit sheet asks, never a list, a card or a
 *   prefetch, and one subject at a time;
 * - a subject that changes (a shuffle, a swipe to the next outfit) is asked about only after it stood still for
 *   `delayMs`;
 * - the answer is kept per subject for the session (an hour at most for a picture, whose link lives an hour);
 * - `Unavailable`, a 404, a 429, a 5xx and a network error all mean "hide it": the answer is kept as hidden, so the same
 *   subject is not asked again; a 429 also blocks every other ask until its `Retry-After` has passed, and a 404
 *   `TryOn.Disabled` (the server's switch is off) blocks them for the rest of the session;
 * - `Preparing` is asked again every `TRYON_POLL_MS`, at most `TRYON_MAX_POLLS` times, and then hides too.
 */
export const TRYON_ASK_DELAY_MS = 600;
export const TRYON_POLL_MS = 3000;
export const TRYON_MAX_POLLS = 10;
/** A picture's link lives an hour; the server answers a repeated ask from its own cache for free, with a new link. */
const READY_STALE_MS = 50 * 60_000;
/** A 5xx or a lost connection: the same subject may be asked again after this. */
const TRANSIENT_RETRY_MS = 60_000;
const KEEP_MS = 60 * 60_000;

/** What the cache holds per subject: the answer, or `null` for "hidden" (and when it may be asked again, if ever). */
interface TryOnEntry {
  answer: TryOn | null;
  retryAt: number | null;
  /** How many times `Preparing` was asked about again (0 at the first answer). */
  polls: number;
}

const hidden = (retryAt: number | null): TryOnEntry => ({ answer: null, retryAt, polls: 0 });

async function ask(
  subject: TryOnSubject,
  signal: AbortSignal,
  previous: TryOnEntry | undefined,
): Promise<TryOnEntry> {
  const blockedUntil = tryOnBlockedUntil();
  if (blockedUntil > 0) {
    return hidden(blockedUntil);
  }
  try {
    const answer = await getTryOn(subject, signal);
    if (answer.status === 'Unavailable') {
      return hidden(null);
    }
    const polls = previous?.answer?.status === 'Preparing' ? previous.polls + 1 : 0;
    return { answer, retryAt: null, polls };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    if (error instanceof ApiError) {
      if (error.status === 404 && error.errorCode === 'TryOn.Disabled') {
        noteTryOnDisabled();
        return hidden(null);
      }
      if (error.isRateLimited) {
        return hidden(noteTryOnRateLimited(error.retryAfterSeconds));
      }
      if (error.status === 0 || error.status >= 500) {
        return hidden(Date.now() + TRANSIENT_RETRY_MS);
      }
      // 400, 401, any other 404 (an outfit that is gone): nothing to show for this subject.
      return hidden(null);
    }
    return hidden(Date.now() + TRANSIENT_RETRY_MS);
  }
}

/** `value` once it has stayed the same for `delayMs`; `undefined` while it is still changing (and on the first render). */
function useSettled<T>(value: T, delayMs: number): T | undefined {
  const [settled, setSettled] = useState<{ value: T } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ value }), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled !== null && Object.is(settled.value, value) ? value : undefined;
}

export type TryOnPhase = 'hidden' | 'preparing' | 'ready';

export interface TryOnState {
  phase: TryOnPhase;
  /** The server's answer while `phase` is `preparing` or `ready`. */
  answer: TryOn | null;
}

const NOTHING: TryOnState = { phase: 'hidden', answer: null };

/**
 * Whether to show "Manken üstünde gör" for this outfit or product, and what it shows. Pass `null` while there is nothing to
 * ask about. The caller is the screen that has the sheet open; see the rules above.
 */
export function useTryOn(subject: TryOnSubject | null, delayMs = TRYON_ASK_DELAY_MS): TryOnState {
  const { isSignedIn } = useSession();
  const key = subject ? `${subject.kind}:${subject.id}` : null;
  const settled = useSettled(key, delayMs);
  const queryClient = useQueryClient();
  const queryKey = queryKeys.tryOn(subject?.kind ?? 'outfit', subject?.id ?? '');
  const enabled = isSignedIn && subject !== null && settled === key && !isTryOnOff();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      subject
        ? ask(subject, signal, queryClient.getQueryData<TryOnEntry>(queryKey))
        : Promise.resolve(hidden(null)),
    enabled,
    retry: false,
    gcTime: KEEP_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: (current) => {
      const entry = current.state.data;
      if (!entry) {
        return 0;
      }
      if (entry.answer) {
        return entry.answer.status === 'Ready' ? READY_STALE_MS : 0;
      }
      return entry.retryAt === null ? Infinity : Math.max(0, entry.retryAt - Date.now());
    },
    refetchInterval: (current) =>
      current.state.data?.answer?.status === 'Preparing' &&
      current.state.data.polls < TRYON_MAX_POLLS
        ? TRYON_POLL_MS
        : false,
  });

  // Measurements, sizes or the wardrobe changed on another screen (`invalidateTryOn` marks the answers without asking):
  // the mannequin is asked for again only when this screen is in front again, the sheet being what the user looks at.
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (enabled && queryClient.getQueryState(queryKey)?.isInvalidated) {
        void refetch();
      }
      // `queryKey` is rebuilt every render; its parts are what matter.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, queryClient, refetch, subject?.kind, subject?.id]),
  );

  const answer = query.data?.answer ?? null;
  if (!isSignedIn || !subject || !answer) {
    return NOTHING;
  }
  if (answer.status === 'Ready' && answer.imageUrl) {
    return { phase: 'ready', answer };
  }
  // Ten asks after the first answer, and it still says "Preparing": that is no answer, and the action goes away.
  if (answer.status === 'Preparing' && (query.data?.polls ?? 0) < TRYON_MAX_POLLS) {
    return { phase: 'preparing', answer };
  }
  return NOTHING;
}

/**
 * The server draws another image after a change of measurements, sizes or wardrobe. Marks every answer as out of date
 * without asking (nothing is drawn for a screen the user is not looking at); `useTryOn` asks again when its screen is back.
 */
export function invalidateTryOn(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tryOnAll, refetchType: 'none' });
}

/** "Yanlış görünüyor": one request, no form. */
export function useReportTryOn() {
  return useMutation({ mutationFn: (body: ReportTryOnRequest) => reportTryOn(body) });
}

/** The report for a drawing: what was asked about, the pieces the answer drew and the renderer, when the answer names one. */
export function buildReport(subject: TryOnSubject, answer: TryOn): ReportTryOnRequest {
  return {
    outfitId: subject.kind === 'outfit' ? subject.id : null,
    productId: subject.kind === 'product' ? subject.id : null,
    garmentIds: answer.garments.map((garment) => garment.id),
    // The contract's answer has no renderer: `null` is what it allows (the backend asks for a value; see the task notes).
    renderer: answer.renderer ?? null,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { getTryOn, reportTryOn, type TryOnSubject } from '@/api/endpoints/tryon';
import type { ReportTryOnRequest, TryOn } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';

import {
  UNKNOWN_RETRY_AFTER_MS,
  didDrawFail,
  isTryOnOff,
  markDrawFailed,
  noteTryOnDisabled,
  noteTryOnRateLimited,
  tryOnBlockedUntil,
} from './gate';

/**
 * The rules of asking (a request without `check` can make the server draw a new image, and a user gets 30 an hour):
 *
 * - **Availability is asked with `check=true`**: the server answers status and reason only, never draws and never spends
 *   the allowance (`useTryOnAvailable`). `Ready` and `Preparing` mean "show the action"; `Unavailable`, a 404, a 429, a
 *   5xx and a network error all mean "hide it", and the answer is kept as hidden, so the same subject is not asked again;
 *   a 404 `TryOn.Disabled` (the server's switch is off) stops every check for the rest of the session;
 * - **The drawing is asked only when the user taps the action** (`useTryOnDraw`, `wanted`): never from a list, a card, a
 *   prefetch or just because a sheet opened. While it draws the panel shows its shimmer. A drawing that fails, answers
 *   `Unavailable` or never finishes closes the panel quietly, hides the action for the session and shows the generic toast
 *   once. A 429 also blocks every other drawing until its `Retry-After` has passed;
 * - only a screen that shows an outfit sheet asks, one subject at a time, and a subject that changes (a shuffle, a swipe
 *   to the next outfit) is checked only after it stood still for `delayMs`;
 * - answers are kept per subject for the session (a picture at most 50 minutes, because its link lives an hour);
 * - `Preparing` is asked again every `TRYON_POLL_MS`, at most `TRYON_MAX_POLLS` times, and then counts as a failure.
 */
export const TRYON_ASK_DELAY_MS = 600;
export const TRYON_POLL_MS = 3000;
export const TRYON_MAX_POLLS = 10;
/** A picture's link lives an hour; the server answers a repeated ask from its own cache for free, with a new link. */
const READY_STALE_MS = 50 * 60_000;
/** A 5xx or a lost connection: the same subject may be asked again after this. */
const TRANSIENT_RETRY_MS = 60_000;
const KEEP_MS = 60 * 60_000;

/** What the cache holds per subject for a drawing: the answer, or `null` for "hidden" (and when it may be asked again, if ever). */
interface TryOnEntry {
  answer: TryOn | null;
  retryAt: number | null;
  /** How many times `Preparing` was asked about again (0 at the first answer). */
  polls: number;
}

const hidden = (retryAt: number | null): TryOnEntry => ({ answer: null, retryAt, polls: 0 });

/** What the cache holds per subject for the availability check. */
interface CheckEntry {
  available: boolean;
  retryAt: number | null;
}

const subjectKey = (subject: TryOnSubject) => `${subject.kind}:${subject.id}`;

/** What a failed ask means for this subject, by the error alone (the same for a check and a drawing). */
function failureRetryAt(error: unknown): number | null {
  if (error instanceof ApiError) {
    if (error.isRateLimited) {
      return Date.now() + (error.retryAfterSeconds ?? UNKNOWN_RETRY_AFTER_MS / 1000) * 1000;
    }
    if (error.status === 0 || error.status >= 500) {
      return Date.now() + TRANSIENT_RETRY_MS;
    }
    // 400, 401, any 404 (an outfit that is gone): nothing to show for this subject.
    return null;
  }
  return Date.now() + TRANSIENT_RETRY_MS;
}

async function askAvailable(subject: TryOnSubject, signal: AbortSignal): Promise<CheckEntry> {
  if (isTryOnOff() || didDrawFail(subjectKey(subject))) {
    return { available: false, retryAt: null };
  }
  try {
    const answer = await getTryOn(subject, signal, { check: true });
    return { available: answer.status !== 'Unavailable', retryAt: null };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    if (error instanceof ApiError && error.status === 404 && error.errorCode === 'TryOn.Disabled') {
      noteTryOnDisabled();
      return { available: false, retryAt: null };
    }
    return { available: false, retryAt: failureRetryAt(error) };
  }
}

async function draw(
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
    if (answer.status === 'Unavailable' || (answer.status === 'Ready' && !answer.imageUrl)) {
      return hidden(null);
    }
    const polls = previous?.answer?.status === 'Preparing' ? previous.polls + 1 : 0;
    if (answer.status === 'Preparing' && polls >= TRYON_MAX_POLLS) {
      // Still preparing after the last poll: that is no answer, so it counts as a failure like the others.
      return hidden(null);
    }
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
    }
    return hidden(failureRetryAt(error));
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

/**
 * Whether "Manken üstünde gör" is offered for this outfit or product. Asks with `check=true` (nothing is drawn, nothing
 * is counted) once the subject stood still for `delayMs`; `false` until the answer is in, and for anything but
 * `Ready`/`Preparing`. Pass `null` while there is nothing to ask about. The caller is the screen that has the sheet open.
 */
export function useTryOnAvailable(
  subject: TryOnSubject | null,
  delayMs = TRYON_ASK_DELAY_MS,
): boolean {
  const { isSignedIn } = useSession();
  const key = subject ? subjectKey(subject) : null;
  const settled = useSettled(key, delayMs);
  const queryClient = useQueryClient();
  const queryKey = queryKeys.tryOnCheck(subject?.kind ?? 'outfit', subject?.id ?? '');
  const enabled = isSignedIn && subject !== null && settled === key && !isTryOnOff();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      subject
        ? askAvailable(subject, signal)
        : Promise.resolve({ available: false, retryAt: null }),
    enabled,
    retry: false,
    gcTime: KEEP_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: (current) => {
      const entry = current.state.data;
      if (!entry || entry.available || entry.retryAt === null) {
        return entry ? Infinity : 0;
      }
      return Math.max(0, entry.retryAt - Date.now());
    },
  });

  // Measurements, sizes or the wardrobe changed on another screen (`invalidateTryOn` marks the answers without asking):
  // the check is asked again only when this screen is in front again. It is free, unlike a drawing.
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

  return (
    isSignedIn &&
    subject !== null &&
    !didDrawFail(subjectKey(subject)) &&
    query.data?.available === true
  );
}

export type TryOnPhase = 'hidden' | 'preparing' | 'ready';

export interface TryOnState {
  phase: TryOnPhase;
  /** The server's answer while `phase` is `ready` (`null` while it is still drawing). */
  answer: TryOn | null;
}

const NOTHING: TryOnState = { phase: 'hidden', answer: null };

/**
 * The drawing, asked for only while `wanted` is true (the user tapped the action, or switched to the mannequin). While it
 * draws `phase` is `preparing` (the shimmer). If it fails, answers `Unavailable` or never finishes, the action is hidden for
 * the session, the generic toast shows once and `onFail` runs so the caller can close the panel.
 */
export function useTryOnDraw(
  subject: TryOnSubject | null,
  wanted: boolean,
  onFail: () => void,
): TryOnState {
  const { isSignedIn } = useSession();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.tryOn(subject?.kind ?? 'outfit', subject?.id ?? '');
  const enabled = isSignedIn && subject !== null && wanted && !isTryOnOff();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      subject
        ? draw(subject, signal, queryClient.getQueryData<TryOnEntry>(queryKey))
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
      current.state.data?.answer?.status === 'Preparing' ? TRYON_POLL_MS : false,
  });

  const entry = query.data;
  const failed =
    isSignedIn &&
    subject !== null &&
    wanted &&
    !query.isFetching &&
    entry !== undefined &&
    entry.answer === null;
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);
  const handled = useRef<TryOnEntry | null>(null);
  const failedKey = subject ? subjectKey(subject) : null;
  useEffect(() => {
    if (!failed || !entry || handled.current === entry || failedKey === null) {
      return;
    }
    handled.current = entry;
    markDrawFailed(failedKey);
    // Hide the action everywhere it is shown, not only where it was tapped.
    queryClient.setQueryData<CheckEntry>(
      queryKeys.tryOnCheck(subject?.kind ?? 'outfit', subject?.id ?? ''),
      { available: false, retryAt: null },
    );
    showToast(tr.outfitActionFailed);
    onFailRef.current();
    // The subject's parts are what matter, not the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, entry, failedKey, queryClient]);

  if (!enabled || failed) {
    return NOTHING;
  }
  const answer = entry?.answer ?? null;
  if (answer?.status === 'Ready') {
    return { phase: 'ready', answer };
  }
  // Nothing yet, or `Preparing`: the shimmer. (Ten asks that still say "Preparing" end as a failure in `draw`.)
  return { phase: 'preparing', answer: null };
}

/**
 * The server draws another image after a change of measurements, sizes or wardrobe. Marks every answer as out of date
 * without asking (nothing is drawn for a screen the user is not looking at); `useTryOnAvailable` checks again when its screen is back; a drawing is asked again at the next tap.
 */
export function invalidateTryOn(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tryOnAll, refetchType: 'none' });
}

/** "Yanlış görünüyor": one request, no form. */
export function useReportTryOn() {
  return useMutation({ mutationFn: (body: ReportTryOnRequest) => reportTryOn(body) });
}

/**
 * The renderer the answer names (a Ready answer with an image always does), or `null` when it names none: the backend
 * refuses a report without one, so the app offers no "Yanlış görünüyor" for such an answer.
 */
export function reportableRenderer(answer: TryOn): string | null {
  const renderer = answer.renderer?.trim();
  return renderer ? renderer : null;
}

/** The report for a drawing: what was asked about, the pieces the answer drew and the renderer that drew them. */
export function buildReport(
  subject: TryOnSubject,
  answer: TryOn,
  renderer: string,
): ReportTryOnRequest {
  return {
    outfitId: subject.kind === 'outfit' ? subject.id : null,
    productId: subject.kind === 'product' ? subject.id : null,
    garmentIds: answer.garments.map((garment) => garment.id),
    renderer,
  };
}

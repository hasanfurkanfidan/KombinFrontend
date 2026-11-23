import { ApiError } from '@/api/client';
import { isBulkDisabled } from '@/api/endpoints/bulkAdd';
import type { BulkBatch, BulkConfirmPiece, BulkPiece, ProductColor } from '@/api/models';
import type { EventProps } from '@/analytics/events';
import { tr } from '@/i18n/tr';
import { rateLimitedText } from '@/utils/rateLimit';
import { toNumber } from '@/utils/money';

/**
 * The pure part of bulk add: the ticks and edits of the review grid, what confirm sends, what analytics counts, and
 * what each answer of the server means for the screen. `BulkAddScreen` only wires these to views.
 */

/** Polling while the server separates the pieces (the note: "the app polls every ~1 s"). */
export const POLL_INTERVAL_MS = 1000;
/** After this long the poll stops and the screen offers to keep waiting (`Timeout` in analytics). */
export const WAIT_LIMIT_MS = 60_000;
/** When the second, calmer waiting line appears. */
export const WAIT_LONG_MS = 10_000;
/** The review asks for fresh picture links this long before they expire. */
export const URL_REFRESH_LEAD_MS = 60_000;

/** What the user decided about one piece. Edits start from the server's values; only differences are sent. */
export interface PieceDraft {
  ticked: boolean;
  categorySlug: string | null;
  color: ProductColor;
}

export type Drafts = Readonly<Record<string, PieceDraft>>;

/** What the user changed on each piece, by piece id; everything else is the server's. */
export type PieceEdits = Readonly<Record<string, Partial<PieceDraft>>>;

/**
 * Pre-ticked pieces start ticked, the others unticked (vision's `preTicked` is "no reason against it"); the user's
 * edits sit on top. A refetch of the status (fresh picture links) keeps them, because they are kept by piece id.
 */
export function initialDrafts(pieces: readonly BulkPiece[], edits: PieceEdits = {}): Drafts {
  const drafts: Record<string, PieceDraft> = {};
  for (const piece of pieces) {
    drafts[piece.id] = {
      ticked: piece.preTicked,
      categorySlug: piece.category?.slug ?? null,
      color: piece.primaryColor,
      ...edits[piece.id],
    };
  }
  return drafts;
}

/** One tap: the tick flips, nothing else changes (a wrong pre-tick is one tap to undo). */
export function toggleTick(drafts: Drafts, id: string): Drafts {
  const draft = drafts[id];
  return draft ? { ...drafts, [id]: { ...draft, ticked: !draft.ticked } } : drafts;
}

export function editDraft(drafts: Drafts, id: string, patch: Partial<PieceDraft>): Drafts {
  const draft = drafts[id];
  return draft ? { ...drafts, [id]: { ...draft, ...patch } } : drafts;
}

export function tickedCount(pieces: readonly BulkPiece[], drafts: Drafts): number {
  return pieces.filter((piece) => drafts[piece.id]?.ticked).length;
}

function categoryChanged(piece: BulkPiece, draft: PieceDraft): boolean {
  return draft.categorySlug !== null && draft.categorySlug !== (piece.category?.slug ?? null);
}

/**
 * The confirm list, in reading order: only ticked pieces, each with the fields the user changed (`PATCH`'s own names),
 * exactly as the single add sends only what changed.
 */
export function confirmEntries(pieces: readonly BulkPiece[], drafts: Drafts): BulkConfirmPiece[] {
  return pieces.flatMap((piece) => {
    const draft = drafts[piece.id];
    if (!draft?.ticked) {
      return [];
    }
    // A null field is left as the analysis said it.
    return [
      {
        id: piece.id,
        categorySlug:
          categoryChanged(piece, draft) && draft.categorySlug ? draft.categorySlug : null,
        primaryColor: draft.color !== piece.primaryColor ? draft.color : null,
        secondaryColor: null,
        clear: null,
      },
    ];
  });
}

const MAX_COUNT = 12;
const count = (value: number) => Math.max(0, Math.min(MAX_COUNT, Math.round(value)));

/** `bulk_add_confirm` without its duration: counts only, each 0-12. */
export function confirmStats(
  pieces: readonly BulkPiece[],
  drafts: Drafts,
): Omit<EventProps['bulk_add_confirm'], 'durationMs'> {
  let ticked = 0;
  let preTickedTicked = 0;
  let preTickedLeft = 0;
  let extraTicked = 0;
  let categoryEdits = 0;
  let colourEdits = 0;
  for (const piece of pieces) {
    const draft = drafts[piece.id];
    if (!draft) continue;
    if (draft.ticked) {
      ticked += 1;
      if (piece.preTicked) preTickedTicked += 1;
      else extraTicked += 1;
      if (categoryChanged(piece, draft)) categoryEdits += 1;
      if (draft.color !== piece.primaryColor) colourEdits += 1;
    } else if (piece.preTicked) {
      preTickedLeft += 1;
    }
  }
  return {
    shown: count(pieces.length),
    ticked: count(ticked),
    preTickedTicked: count(preTickedTicked),
    preTickedLeft: count(preTickedLeft),
    extraTicked: count(extraTicked),
    categoryEdits: count(categoryEdits),
    colourEdits: count(colourEdits),
  };
}

const REFUSALS = [
  'closet',
  'rail',
  'pile',
  'worn',
  'nothing_found',
  'too_dark',
  'too_blurry',
] as const;
const FAILURES = [
  'VisionBusy',
  'VisionUnavailable',
  'PhotoUnreadable',
  'AnalysisFailed',
  'Interrupted',
] as const;

function known<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return values.find((candidate) => candidate === value);
}

/**
 * `bulk_add_result` for a settled batch (or a timeout): enums and counts only. A refusal or failure code the
 * allow-list does not know (a newer server) is left out rather than getting the whole event rejected.
 */
export function resultEvent(
  batch: BulkBatch | undefined,
  status: EventProps['bulk_add_result']['status'],
  durationMs: number,
): EventProps['bulk_add_result'] {
  const pieces = batch?.pieces ?? [];
  const event: EventProps['bulk_add_result'] = {
    status,
    durationMs: Math.max(0, Math.round(durationMs)),
    pieces: count(pieces.length),
    preTicked: count(pieces.filter((piece) => piece.preTicked).length),
    unseparated: count(batch?.unseparated ? toNumber(batch.unseparated.count) : 0),
    duplicateHints: count(pieces.filter((piece) => piece.likelyDuplicate !== null).length),
  };
  const refusal = known(REFUSALS, batch?.refusal?.code);
  const failure = known(FAILURES, batch?.failure?.code);
  if (status === 'Refused' && refusal) event.refusal = refusal;
  if (status === 'Failed' && failure) event.failure = failure;
  return event;
}

/** The one way out of a problem: a new photo, the same request again, the single add, or keep waiting. */
export type ProblemAction = 'newPhoto' | 'retry' | 'single' | 'wait';

export interface Problem {
  message: string;
  action: ProblemAction;
}

/** What a status answer means: `null` while it is still on its way or ready for review. */
export function problemFromBatch(batch: BulkBatch): Problem | null {
  switch (batch.status) {
    case 'Refused':
      // The server's own sentence, as it is (it also covers a refusal code newer than this app).
      return { message: batch.refusal?.message ?? tr.bulkUnreadable, action: 'newPhoto' };
    case 'Failed':
      return {
        message: batch.failure?.message ?? tr.bulkUploadFailed,
        action: batch.failure?.retryable === false ? 'newPhoto' : 'retry',
      };
    case 'Cancelled':
    case 'Expired':
      return { message: tr.bulkExpired, action: 'newPhoto' };
    default:
      return null;
  }
}

/** Where a request failed: before the batch exists, at `process`, while polling, or at confirm. */
export type RequestStage = 'upload' | 'process' | 'poll' | 'confirm';

/**
 * What a failed request means. `'disabled'`: the server switched the feature off (every route answers 404
 * `Wardrobe.BulkDisabled`), so the screen closes and the entry disappears without a word.
 */
export function problemFromError(error: unknown, stage: RequestStage): Problem | 'disabled' {
  if (isBulkDisabled(error)) {
    return 'disabled';
  }
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case 'Wardrobe.BulkDailyLimit':
        return { message: tr.bulkDailyLimit, action: 'single' };
      case 'Wardrobe.BulkTooManyOpen':
        return { message: tr.bulkTooManyOpen, action: 'single' };
      case 'Wardrobe.BulkAlreadyConfirmed':
        return { message: tr.bulkAlreadyConfirmed, action: 'newPhoto' };
      case 'Wardrobe.BulkNotReady':
        return { message: tr.bulkNotReady, action: 'newPhoto' };
      case 'Wardrobe.StorageUnavailable':
        return { message: tr.bulkStorageUnavailable, action: 'retry' };
      case 'Wardrobe.BulkNotFound':
      case 'Wardrobe.BulkExpired':
      case 'Wardrobe.UploadMissing':
        return { message: tr.bulkExpired, action: 'newPhoto' };
      case 'Wardrobe.ImageTooLarge':
        return { message: tr.bulkUnreadable, action: 'newPhoto' };
      default:
        break;
    }
    // The server's `detail` is English (only the refusal and failure messages of a batch come in Turkish): never shown.
    if (stage === 'confirm' && error.status === 409) {
      return { message: tr.bulkExpired, action: 'newPhoto' };
    }
    const limited = rateLimitedText(error);
    if (limited) {
      return { message: limited, action: 'single' };
    }
    if (error.status === 400) {
      return { message: tr.bulkUnreadable, action: 'newPhoto' };
    }
  }
  if (stage === 'confirm') {
    return { message: tr.bulkConfirmFailed, action: 'retry' };
  }
  // Offline, 5xx, a storage PUT that failed, a photo the phone could not re-encode: the same photo can go again.
  return { message: tr.bulkUploadFailed, action: 'retry' };
}

/** When the review should ask for fresh picture links (a minute before the first one expires), in ms from now. */
export function msUntilUrlRefresh(batch: BulkBatch, now: number): number | null {
  const expiries = batch.pieces
    .map((piece) => Date.parse(piece.urlsExpireAt))
    .filter((time) => Number.isFinite(time));
  if (expiries.length === 0) {
    return null;
  }
  return Math.max(30_000, Math.min(...expiries) - URL_REFRESH_LEAD_MS - now);
}

import { ApiError } from '@/api/client';
import { tr } from '@/i18n/tr';

import {
  WAIT_LIMIT_MS,
  confirmEntries,
  confirmStats,
  editDraft,
  initialDrafts,
  msUntilUrlRefresh,
  problemFromBatch,
  problemFromError,
  resultEvent,
  tickedCount,
  toggleTick,
} from '@/features/bulkAdd/flow';

import { batch, piece } from './support';

const api = (
  status: number,
  errorCode: string | null = null,
  retryAfterSeconds: number | null = null,
) => new ApiError({ status, errorCode, correlationId: 'c', retryAfterSeconds });

const entry = (id: string, fields: Record<string, string> = {}) => ({
  id,
  categorySlug: null,
  primaryColor: null,
  secondaryColor: null,
  clear: null,
  ...fields,
});

const pre = piece({ id: 'a', preTicked: true });
const held = piece({
  id: 'b',
  preTicked: false,
  reasons: [
    { code: 'touching', message: 'Bu parça yanındakine değiyor; kesimini kontrol et.' },
    { code: 'too_small', message: 'ikinci' },
  ],
});
const pieces = [pre, held];

describe('initialDrafts / toggleTick / editDraft', () => {
  it('starts pre-ticked pieces ticked and the others unticked, with the server values', () => {
    const drafts = initialDrafts(pieces);
    expect(drafts.a).toEqual({ ticked: true, categorySlug: 'ust-giyim/tisort', color: 'Blue' });
    expect(drafts.b?.ticked).toBe(false);
  });

  it('puts the user edits on top, by piece id', () => {
    const drafts = initialDrafts(pieces, { b: { ticked: true, color: 'Red' } });
    expect(drafts.b).toMatchObject({
      ticked: true,
      color: 'Red',
      categorySlug: 'ust-giyim/tisort',
    });
    expect(drafts.a?.ticked).toBe(true);
  });

  it('keeps a missing category as null', () => {
    expect(initialDrafts([piece({ id: 'n', category: null })]).n?.categorySlug).toBeNull();
  });

  it('flips one tick with one toggle and flips back with another (undo of a pre-tick)', () => {
    const drafts = initialDrafts(pieces);
    const once = toggleTick(drafts, 'a');
    expect(once.a?.ticked).toBe(false);
    expect(once.b).toBe(drafts.b);
    expect(toggleTick(once, 'a').a?.ticked).toBe(true);
    expect(toggleTick(drafts, 'missing')).toBe(drafts);
  });

  it('edits only the named piece', () => {
    const drafts = initialDrafts(pieces);
    const next = editDraft(drafts, 'b', { color: 'Green' });
    expect(next.b?.color).toBe('Green');
    expect(next.a).toBe(drafts.a);
    expect(editDraft(drafts, 'zzz', { color: 'Red' })).toBe(drafts);
  });

  it('counts the ticked pieces', () => {
    const drafts = initialDrafts(pieces);
    expect(tickedCount(pieces, drafts)).toBe(1);
    expect(tickedCount(pieces, toggleTick(drafts, 'b'))).toBe(2);
    expect(tickedCount([], {})).toBe(0);
  });
});

describe('confirmEntries', () => {
  it('sends only ticked pieces, in order, with just the id when nothing changed', () => {
    const drafts = toggleTick(initialDrafts(pieces), 'b');
    expect(confirmEntries(pieces, drafts)).toEqual([entry('a'), entry('b')]);
    expect(confirmEntries(pieces, toggleTick(drafts, 'a'))).toEqual([entry('b')]);
  });

  it('sends nothing when nothing is ticked', () => {
    expect(confirmEntries(pieces, toggleTick(initialDrafts(pieces), 'a'))).toEqual([]);
  });

  it('adds categorySlug and primaryColor only for the fields that changed', () => {
    let drafts = initialDrafts(pieces);
    drafts = editDraft(drafts, 'a', { categorySlug: 'ust-giyim/gomlek' });
    expect(confirmEntries(pieces, drafts)).toEqual([
      entry('a', { categorySlug: 'ust-giyim/gomlek' }),
    ]);
    drafts = editDraft(drafts, 'a', { color: 'Red' });
    expect(confirmEntries(pieces, drafts)).toEqual([
      entry('a', { categorySlug: 'ust-giyim/gomlek', primaryColor: 'Red' }),
    ]);
  });

  it('sends nothing for an edit put back to the server value', () => {
    let drafts = initialDrafts(pieces);
    drafts = editDraft(drafts, 'a', { color: 'Red' });
    drafts = editDraft(drafts, 'a', { color: 'Blue' });
    expect(confirmEntries(pieces, drafts)).toEqual([entry('a')]);
  });

  it('never sends the edits of an unticked piece', () => {
    const drafts = editDraft(initialDrafts(pieces), 'b', { color: 'Red' });
    expect(confirmEntries(pieces, drafts)).toEqual([entry('a')]);
  });

  it('sends a category chosen for a piece the server could not categorise', () => {
    const none = piece({ id: 'n', category: null, needsCategory: true });
    const drafts = editDraft(initialDrafts([none]), 'n', { categorySlug: 'alt-giyim/pantolon' });
    expect(confirmEntries([none], drafts)).toEqual([
      entry('n', { categorySlug: 'alt-giyim/pantolon' }),
    ]);
  });
});

describe('confirmStats', () => {
  it('counts shown, ticked, pre-ticks kept and left, extras and edits', () => {
    const three = [
      pre,
      piece({ id: 'p2', preTicked: true }),
      held,
      piece({ id: 'p4', preTicked: false }),
    ];
    let drafts = initialDrafts(three);
    drafts = toggleTick(drafts, 'p2'); // a pre-tick left
    drafts = toggleTick(drafts, 'b'); // an extra
    drafts = editDraft(drafts, 'a', { color: 'Red', categorySlug: 'ust-giyim/gomlek' });
    drafts = editDraft(drafts, 'p2', { color: 'Red' }); // unticked: not counted
    expect(confirmStats(three, drafts)).toEqual({
      shown: 4,
      ticked: 2,
      preTickedTicked: 1,
      preTickedLeft: 1,
      extraTicked: 1,
      categoryEdits: 1,
      colourEdits: 1,
    });
  });

  it('keeps every count between 0 and 12', () => {
    const many = Array.from({ length: 15 }, (_, index) => piece({ id: `m${index}` }));
    const stats = confirmStats(many, initialDrafts(many));
    expect(stats.shown).toBe(12);
    expect(stats.ticked).toBe(12);
    expect(stats.preTickedTicked).toBe(12);
    expect(confirmStats([], {})).toMatchObject({ shown: 0, ticked: 0 });
  });
});

describe('resultEvent', () => {
  it('counts pieces, pre-ticks, unseparated and duplicate hints; enums only, no ids', () => {
    const answer = batch({
      pieces: [
        pre,
        piece({
          id: 'd',
          preTicked: false,
          likelyDuplicate: { itemId: 'item-9', thumbUrl: 'x', message: 'Dolabında benzeri var.' },
        }),
      ],
      unseparated: { count: 2, message: 's', regions: [] },
    });
    const event = resultEvent(answer, 'Ready', 1234.6);
    expect(event).toEqual({
      status: 'Ready',
      durationMs: 1235,
      pieces: 2,
      preTicked: 1,
      unseparated: 2,
      duplicateHints: 1,
    });
    expect(JSON.stringify(event)).not.toMatch(/batch-1|item-9|pc1/);
  });

  it('adds the refusal code on Refused and the failure code on Failed only', () => {
    const refused = batch({ status: 'Refused', refusal: { code: 'too_dark', message: 'm' } });
    expect(resultEvent(refused, 'Refused', 5).refusal).toBe('too_dark');
    expect(resultEvent(refused, 'Ready', 5).refusal).toBeUndefined();
    const failed = batch({
      status: 'Failed',
      failure: { code: 'VisionBusy', message: 'm', retryable: true },
    });
    expect(resultEvent(failed, 'Failed', 5).failure).toBe('VisionBusy');
    expect(resultEvent(failed, 'Refused', 5).failure).toBeUndefined();
  });

  it('leaves out a code the allow-list does not know', () => {
    const odd = batch({ status: 'Refused', refusal: { code: 'brand_new', message: 'm' } });
    expect(resultEvent(odd, 'Refused', 5)).not.toHaveProperty('refusal');
  });

  it('is valid for a timeout, which has no batch', () => {
    expect(resultEvent(undefined, 'Timeout', WAIT_LIMIT_MS)).toEqual({
      status: 'Timeout',
      durationMs: WAIT_LIMIT_MS,
      pieces: 0,
      preTicked: 0,
      unseparated: 0,
      duplicateHints: 0,
    });
  });

  it('clamps counts to 12 and the duration to 0 or more', () => {
    const big = batch({
      pieces: Array.from({ length: 14 }, (_, index) => piece({ id: `x${index}` })),
      unseparated: { count: 40, message: 's', regions: [] },
    });
    const event = resultEvent(big, 'Ready', -50);
    expect(event.pieces).toBe(12);
    expect(event.preTicked).toBe(12);
    expect(event.unseparated).toBe(12);
    expect(event.durationMs).toBe(0);
  });
});

describe('problemFromBatch', () => {
  it('is null while waiting, ready or confirmed', () => {
    for (const status of ['Created', 'Processing', 'Ready', 'Confirmed'] as const) {
      expect(problemFromBatch(batch({ status }))).toBeNull();
    }
  });

  it('shows the refusal sentence as it is, with a new photo', () => {
    const answer = batch({
      status: 'Refused',
      refusal: { code: 'rail', message: 'Askıdaki kıyafetleri ayıramıyoruz; yere serip çek.' },
    });
    expect(problemFromBatch(answer)).toEqual({
      message: 'Askıdaki kıyafetleri ayıramıyoruz; yere serip çek.',
      action: 'newPhoto',
    });
  });

  it('shows a refusal code this app never heard of with the server sentence', () => {
    const answer = batch({ status: 'Refused', refusal: { code: 'xyz', message: 'Yeni cümle.' } });
    expect(problemFromBatch(answer)).toEqual({ message: 'Yeni cümle.', action: 'newPhoto' });
  });

  it('offers retry for a retryable failure and a new photo for one that is not', () => {
    const retryable = batch({
      status: 'Failed',
      failure: { code: 'VisionBusy', message: 'Meşgul.', retryable: true },
    });
    expect(problemFromBatch(retryable)).toEqual({ message: 'Meşgul.', action: 'retry' });
    const final = batch({
      status: 'Failed',
      failure: { code: 'PhotoUnreadable', message: 'Okunamadı.', retryable: false },
    });
    expect(problemFromBatch(final)).toEqual({ message: 'Okunamadı.', action: 'newPhoto' });
  });

  it('says a cancelled or expired batch is over, with a new photo', () => {
    for (const status of ['Cancelled', 'Expired'] as const) {
      expect(problemFromBatch(batch({ status }))).toEqual({
        message: tr.bulkExpired,
        action: 'newPhoto',
      });
    }
  });
});

describe('problemFromError', () => {
  it('reads 404 Wardrobe.BulkDisabled as "disabled" at every stage', () => {
    for (const stage of ['upload', 'process', 'poll', 'confirm'] as const) {
      expect(problemFromError(api(404, 'Wardrobe.BulkDisabled'), stage)).toBe('disabled');
    }
  });

  it('gives the daily limit and too-many-open their own lines with the single add', () => {
    expect(problemFromError(api(429, 'Wardrobe.BulkDailyLimit'), 'upload')).toEqual({
      message: tr.bulkDailyLimit,
      action: 'single',
    });
    expect(problemFromError(api(409, 'Wardrobe.BulkTooManyOpen'), 'upload')).toEqual({
      message: tr.bulkTooManyOpen,
      action: 'single',
    });
  });

  it('turns not found, expired and the like into "expired, take a new photo"', () => {
    for (const code of [
      'Wardrobe.BulkNotFound',
      'Wardrobe.BulkExpired',
      'Wardrobe.UploadMissing',
    ]) {
      expect(problemFromError(api(404, code), 'poll')).toEqual({
        message: tr.bulkExpired,
        action: 'newPhoto',
      });
    }
  });

  it('keeps a generic 429 as a rate-limit line with the single add', () => {
    const problem = problemFromError(api(429, 'RateLimited', 30), 'upload');
    expect(problem).toMatchObject({ action: 'single' });
  });

  it('asks for a different photo after a 400 or an oversized photo', () => {
    expect(problemFromError(api(400, null), 'upload')).toEqual({
      message: tr.bulkUnreadable,
      action: 'newPhoto',
    });
    expect(problemFromError(api(413, 'Wardrobe.ImageTooLarge'), 'upload')).toEqual({
      message: tr.bulkUnreadable,
      action: 'newPhoto',
    });
  });

  it('offers retry for offline, 5xx and a failed storage PUT; confirm has its own line', () => {
    expect(problemFromError(new Error('network'), 'upload')).toEqual({
      message: tr.bulkUploadFailed,
      action: 'retry',
    });
    expect(problemFromError(api(503), 'process')).toEqual({
      message: tr.bulkUploadFailed,
      action: 'retry',
    });
    expect(problemFromError(api(500), 'confirm')).toEqual({
      message: tr.bulkConfirmFailed,
      action: 'retry',
    });
  });
});

describe('msUntilUrlRefresh', () => {
  const now = Date.parse('2026-11-23T10:00:00Z');

  it('is null with no pieces', () => {
    expect(msUntilUrlRefresh(batch(), now)).toBeNull();
  });

  it('asks one minute before the earliest link expires', () => {
    const answer = batch({
      pieces: [
        piece({ id: 'a', urlsExpireAt: '2026-11-23T11:00:00Z' }),
        piece({ id: 'b', urlsExpireAt: '2026-11-23T10:30:00Z' }),
      ],
    });
    expect(msUntilUrlRefresh(answer, now)).toBe(30 * 60_000 - 60_000);
  });

  it('never asks sooner than 30 s (links already about to expire)', () => {
    const answer = batch({ pieces: [piece({ urlsExpireAt: '2026-11-23T10:00:10Z' })] });
    expect(msUntilUrlRefresh(answer, now)).toBe(30_000);
  });

  describe('confirm answers never show the English server detail', () => {
    const confirmError = (status: number, errorCode: string | null) =>
      new ApiError({ status, errorCode, detail: 'English server sentence.', correlationId: 'c' });

    it('BulkAlreadyConfirmed: already added, take a new photo', () => {
      expect(problemFromError(confirmError(409, 'Wardrobe.BulkAlreadyConfirmed'), 'confirm')).toEqual({
        message: tr.bulkAlreadyConfirmed,
        action: 'newPhoto',
      });
    });

    it('BulkNotReady: nothing to add yet, take a new photo', () => {
      expect(problemFromError(confirmError(409, 'Wardrobe.BulkNotReady'), 'confirm')).toEqual({
        message: tr.bulkNotReady,
        action: 'newPhoto',
      });
    });

    it('BulkExpired: expired, take a new photo', () => {
      expect(problemFromError(confirmError(409, 'Wardrobe.BulkExpired'), 'confirm')).toEqual({
        message: tr.bulkExpired,
        action: 'newPhoto',
      });
    });

    it('BulkTooManyOpen: the single add is offered', () => {
      expect(problemFromError(confirmError(409, 'Wardrobe.BulkTooManyOpen'), 'confirm')).toEqual({
        message: tr.bulkTooManyOpen,
        action: 'single',
      });
    });

    it('StorageUnavailable: try again', () => {
      expect(problemFromError(confirmError(503, 'Wardrobe.StorageUnavailable'), 'confirm')).toEqual({
        message: tr.bulkStorageUnavailable,
        action: 'retry',
      });
    });

    it('an unknown 409 or 503 falls back to local Turkish texts', () => {
      expect(problemFromError(confirmError(409, 'X'), 'confirm')).toEqual({
        message: tr.bulkExpired,
        action: 'newPhoto',
      });
      expect(problemFromError(confirmError(503, 'X'), 'confirm')).toEqual({
        message: tr.bulkConfirmFailed,
        action: 'retry',
      });
    });
  });
});

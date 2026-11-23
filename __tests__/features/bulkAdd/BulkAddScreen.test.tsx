import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import {
  cancelBulkBatch,
  confirmBulkBatch,
  createBulkUploadUrl,
  getBulkBatch,
  processBulkBatch,
} from '@/api/endpoints/bulkAdd';
import { putPhoto } from '@/api/endpoints/wardrobe';
import type { BulkBatch } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useToastStore } from '@/components/toastStore';
import { BulkAddScreen } from '@/features/bulkAdd/BulkAddScreen';
import { pieceName } from '@/features/bulkAdd/BulkPieceTile';
import { useBulkStore } from '@/features/bulkAdd/bulkStore';
import { tr } from '@/i18n/tr';

import { renderWithQuery, reply, resetSession, signedInSession } from '../../testUtils';
import { batch, piece } from './support';

jest.mock('@/api/endpoints/bulkAdd', () => ({
  ...jest.requireActual('@/api/endpoints/bulkAdd'),
  createBulkUploadUrl: jest.fn(),
  processBulkBatch: jest.fn(),
  getBulkBatch: jest.fn(),
  confirmBulkBatch: jest.fn(),
  cancelBulkBatch: jest.fn(),
}));
jest.mock('@/api/endpoints/wardrobe', () => ({
  ...jest.requireActual('@/api/endpoints/wardrobe'),
  putPhoto: jest.fn(),
}));

const uploadMock = jest.mocked(createBulkUploadUrl);
const processMock = jest.mocked(processBulkBatch);
const statusMock = jest.mocked(getBulkBatch);
const putMock = jest.mocked(putPhoto);
const confirmMock = jest.mocked(confirmBulkBatch);
const cancelMock = jest.mocked(cancelBulkBatch);
const trackMock = jest.mocked(track);
const cameraMock = jest.mocked(ImagePicker.launchCameraAsync);
const libraryMock = jest.mocked(ImagePicker.launchImageLibraryAsync);

const PHOTO = { uri: 'file:///cache/ImagePicker/floor.jpg', width: 3000, height: 4000 };
const picked = { canceled: false, assets: [PHOTO] } as unknown as ImagePicker.ImagePickerResult;

const apiError = (status: number, errorCode: string | null, detail: string | null = null) =>
  new ApiError({ status, errorCode, detail, correlationId: 'test' });

const ENTRY = (id: string) => ({
  id,
  categorySlug: null,
  primaryColor: null,
  secondaryColor: null,
  clear: null,
});

const twoPieces = () =>
  batch({
    pieces: [
      piece({ id: 'a', preTicked: true }),
      piece({
        id: 'b',
        preTicked: false,
        category: { slug: 'alt-giyim/pantolon', name: 'Pantolon' },
        reasons: [
          { code: 'worn', message: 'Bu parça giyili görünüyor.' },
          { code: 'second', message: 'İkinci sebep.' },
        ],
        likelyDuplicate: {
          itemId: 'w1',
          thumbUrl: 'http://img.test/w1.webp',
          message: 'Dolabında benzeri var.',
        },
      }),
    ],
  });

function tracked(name: string) {
  return trackMock.mock.calls.filter(([event]) => event === name).map(([, props]) => props);
}

/** Opens the screen and takes a photo; the status answers come from `statusMock`. */
async function startWith(...answers: (BulkBatch | Error)[]) {
  for (const answer of answers) {
    if (answer instanceof Error) statusMock.mockRejectedValueOnce(answer);
    else statusMock.mockResolvedValueOnce(answer);
  }
  const view = await renderWithQuery(<BulkAddScreen />);
  await fireEvent.press(screen.getByTestId('bulk-camera'));
  return view;
}

beforeEach(async () => {
  jest.clearAllMocks();
  // The single add's sheet and the category list ask the catalog; an empty answer keeps them quiet.
  globalThis.fetch = jest.fn(async (url: string) =>
    reply(
      200,
      String(url).includes('/categories')
        ? []
        : { items: [], page: 1, pageSize: 20, totalCount: 0 },
    ),
  ) as unknown as typeof fetch;
  useBulkStore.getState().reset();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  cameraMock.mockResolvedValue(picked);
  libraryMock.mockResolvedValue(picked);
  uploadMock.mockResolvedValue({
    batchId: 'batch-1',
    uploadUrl: 'http://storage.test/put',
    headers: { 'Content-Type': 'image/jpeg' },
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  putMock.mockResolvedValue(undefined);
  processMock.mockResolvedValue({ batchId: 'batch-1', status: 'Processing' });
  confirmMock.mockResolvedValue(batch({ status: 'Confirmed' }));
  cancelMock.mockResolvedValue(undefined);
});

describe('capture', () => {
  it('shows the drawing, the six advice lines and one camera action the first time', async () => {
    await renderWithQuery(<BulkAddScreen />);
    expect(screen.getByRole('header', { name: tr.bulkTitle })).toBeTruthy();
    for (const line of tr.bulkAdvice) expect(screen.getByText(line)).toBeTruthy();
    expect(tr.bulkAdvice).toHaveLength(6);
    expect(screen.getByRole('image', { name: tr.bulkDrawingLabel })).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkCamera })).toBeTruthy();
  });

  it('keeps the advice one tap away after the first successful batch', async () => {
    useBulkStore.getState().markAdviceSeen();
    await renderWithQuery(<BulkAddScreen />);
    expect(screen.queryByText(tr.bulkAdvice[0]!)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkAdviceShow }));
    expect(screen.getByText(tr.bulkAdvice[0]!)).toBeTruthy();
  });

  it('on web offers the library only, and the flow runs without a camera', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      statusMock.mockResolvedValueOnce(twoPieces());
      await renderWithQuery(<BulkAddScreen />);
      expect(screen.queryByTestId('bulk-camera')).toBeNull();
      await fireEvent.press(screen.getByTestId('bulk-library'));
      await screen.findByTestId('bulk-review');
      expect(cameraMock).not.toHaveBeenCalled();
      expect(tracked('bulk_add_start')).toEqual([{ source: 'library' }]);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});

describe('waiting (Created, Processing)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the user photo and a calm line, no percentage; a second line after 10 s; a choice after 60 s', async () => {
    statusMock.mockResolvedValue(batch({ status: 'Processing' }));
    statusMock.mockResolvedValueOnce(batch({ status: 'Created' }));
    await startWith();
    expect(await screen.findByText(tr.bulkWaiting)).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(tr.bulkWaitingLong)).toBeNull();

    await act(() => jest.advanceTimersByTimeAsync(10_000));
    expect(screen.getByText(tr.bulkWaitingLong)).toBeTruthy();
    expect(statusMock.mock.calls.length).toBeGreaterThan(5);

    await act(() => jest.advanceTimersByTimeAsync(50_000));
    expect(screen.getByText(tr.bulkTimeout)).toBeTruthy();
    expect(tracked('bulk_add_result')).toEqual([expect.objectContaining({ status: 'Timeout' })]);
    const calls = statusMock.mock.calls.length;
    await act(() => jest.advanceTimersByTimeAsync(5_000));
    expect(statusMock.mock.calls.length).toBe(calls);

    // "Beklemeye devam et" asks again.
    statusMock.mockResolvedValue(twoPieces());
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkKeepWaiting }));
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(screen.getByTestId('bulk-review')).toBeTruthy();
  });

  it('leaving while waiting cancels the batch and reports Processing', async () => {
    statusMock.mockResolvedValue(batch({ status: 'Processing' }));
    const view = await startWith();
    await screen.findByText(tr.bulkWaiting);
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkClose }));
    expect(router.back).toHaveBeenCalled();
    await view.unmount();
    expect(cancelMock).toHaveBeenCalledWith('batch-1');
    expect(tracked('bulk_add_cancel')).toEqual([{ stage: 'Processing' }]);
  });
});

describe('review (Ready)', () => {
  it('ticks pre-ticked pieces, leaves the others with their first reason, and shows the duplicate hint', async () => {
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    const [a, b] = screen.getAllByRole('checkbox');
    expect(a!.props.accessibilityState).toEqual({ checked: true });
    expect(b!.props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByText('Bu parça giyili görünüyor.')).toBeTruthy();
    expect(screen.queryByText('İkinci sebep.')).toBeNull();
    expect(screen.getByText('Dolabında benzeri var.')).toBeTruthy();
    expect(screen.getByRole('image', { name: tr.bulkSimilarThumb })).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkConfirm(1) })).toBeTruthy();
    expect(tracked('bulk_add_result')).toEqual([
      expect.objectContaining({ status: 'Ready', pieces: 2, preTicked: 1, duplicateHints: 1 }),
    ]);
  });

  it('flips a tick with one tap, its checked state is what a screen reader hears, and zero disables the button', async () => {
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    const shirt = () => screen.getByRole('checkbox', { name: /^Tişört/ });
    const trousers = () => screen.getByRole('checkbox', { name: /^Pantolon/ });
    await fireEvent.press(shirt());
    expect(shirt().props.accessibilityState).toEqual({ checked: false });
    expect(trousers().props.accessibilityState).toEqual({ checked: false });
    const button = screen.getByRole('button', { name: tr.bulkConfirm(0) });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    await fireEvent.press(trousers());
    expect(trousers().props.accessibilityState).toEqual({ checked: true });
    // Ticked, the reason under the piece goes away; the spoken name loses it too.
    expect(screen.queryByText('Bu parça giyili görünüyor.')).toBeNull();
    await fireEvent.press(shirt());
    expect(screen.getByRole('button', { name: tr.bulkConfirm(2) })).toBeTruthy();
  });

  it('a long press opens the larger cut-out with the category and colour of the single add', async () => {
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent(screen.getByTestId('bulk-tick-a'), 'longPress');
    expect(await screen.findByRole('button', { name: 'Gömlek' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gömlek' }));
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkSheetDone }));
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    await waitFor(() =>
      expect(confirmMock).toHaveBeenCalledWith('batch-1', {
        pieces: [{ ...ENTRY('a'), categorySlug: 'ust-giyim/gomlek' }],
      }),
    );
  });

  it('shows the unseparated and cut-off sentences above the grid with a way to the single add', async () => {
    await startWith(
      batch({
        pieces: [piece({ id: 'a' })],
        unseparated: { count: 2, message: 'İki parça birbirine değiyor.', regions: [] },
        cutOff: { count: 1, message: 'Bir parça kenardan taşıyor.' },
      }),
    );
    await screen.findByTestId('bulk-notes');
    expect(screen.getByText('İki parça birbirine değiyor.')).toBeTruthy();
    expect(screen.getByText('Bir parça kenardan taşıyor.')).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkSingleAdd })).toBeTruthy();
  });

  it('with no piece but an unseparated sentence offers the single add and a new photo, no confirm', async () => {
    await startWith(
      batch({ pieces: [], unseparated: { count: 3, message: 'Parçalar üst üste.', regions: [] } }),
    );
    await screen.findByText('Parçalar üst üste.');
    expect(screen.getByRole('button', { name: tr.bulkSingleAdd })).toBeTruthy();
    expect(screen.queryByTestId('bulk-confirm')).toBeNull();
  });

  it('with nothing at all says so and offers a new photo', async () => {
    await startWith(batch({ pieces: [] }));
    expect(await screen.findByText(tr.bulkNothing)).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkNewPhoto })).toBeTruthy();
  });

  it('confirm adds the ticked pieces, refetches nothing staged, and lands in Dolap with a quiet line', async () => {
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(confirmMock).toHaveBeenCalledWith('batch-1', { pieces: [ENTRY('a')] });
    expect(useToastStore.getState().message).toBe(tr.bulkAdded(1));
    expect(useBulkStore.getState().adviceSeen).toBe(true);
    expect(tracked('bulk_add_confirm')).toEqual([
      expect.objectContaining({ shown: 2, ticked: 1, preTickedTicked: 1, preTickedLeft: 0 }),
    ]);
    // A confirmed batch is not cancelled on the way out.
    await screen.unmount();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(tracked('bulk_add_cancel')).toEqual([]);
  });

  it('a failed confirm keeps the review with a line above the same button', async () => {
    confirmMock.mockRejectedValueOnce(apiError(503, null));
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    expect(await screen.findByText(tr.bulkConfirmFailed)).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkConfirm(1) })).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('a confirm 503 shows its own line (never the English detail) above the same button', async () => {
    confirmMock.mockRejectedValueOnce(
      apiError(503, 'Wardrobe.StorageUnavailable', 'English server sentence.'),
    );
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    expect(await screen.findByText(tr.bulkStorageUnavailable)).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkConfirm(1) })).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('a confirm 409 says the photo is over (never the English detail) and offers a new photo', async () => {
    confirmMock.mockRejectedValueOnce(
      apiError(409, 'Wardrobe.BulkExpired', 'English server sentence.'),
    );
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    expect(await screen.findByText(tr.bulkExpired)).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkNewPhoto })).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('a confirm 400 (unknown piece or category) keeps the review with a fitting line', async () => {
    confirmMock.mockRejectedValueOnce(apiError(400, 'Wardrobe.UnknownCategory', 'English.'));
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    expect(await screen.findByText(tr.bulkConfirmRejected)).toBeTruthy();
    expect(screen.getByTestId('bulk-review')).toBeTruthy();
    expect(screen.queryByText(tr.bulkUnreadable)).toBeNull();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('a second tap on confirm while the first is on its way sends nothing', async () => {
    let answer: (value: BulkBatch) => void = () => undefined;
    confirmMock.mockImplementationOnce(
      () => new Promise<BulkBatch>((resolve) => (answer = resolve)),
    );
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    const button = screen.getByTestId('bulk-confirm');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expect(confirmMock).toHaveBeenCalledTimes(1);
    await act(async () => answer(batch({ status: 'Confirmed' })));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('counts the confirmed items of the answer in the quiet line', async () => {
    confirmMock.mockResolvedValueOnce(
      batch({ status: 'Confirmed', items: [{ id: 'i1' }] as unknown as BulkBatch['items'] }),
    );
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useToastStore.getState().message).toBe(tr.bulkAdded(1));
  });

  it('leaving the review cancels the batch and reports Review', async () => {
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await screen.unmount();
    expect(cancelMock).toHaveBeenCalledWith('batch-1');
    expect(tracked('bulk_add_cancel')).toEqual([{ stage: 'Review' }]);
  });
});

describe('settled problems', () => {
  it('Refused: the server sentence as it is, a new photo, the batch let go', async () => {
    await startWith(
      batch({ status: 'Refused', refusal: { code: 'pile', message: 'Kıyafetler yığın halinde.' } }),
    );
    expect(await screen.findByText('Kıyafetler yığın halinde.')).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkNewPhoto })).toBeTruthy();
    expect(cancelMock).toHaveBeenCalledWith('batch-1');
    expect(tracked('bulk_add_result')).toEqual([
      expect.objectContaining({ status: 'Refused', refusal: 'pile' }),
    ]);
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkNewPhoto }));
    expect(screen.getByTestId('bulk-capture')).toBeTruthy();
  });

  it('Failed and retryable: "Tekrar dene" processes again without a second upload', async () => {
    jest.useFakeTimers();
    try {
      await startWith(
        batch({
          status: 'Failed',
          failure: { code: 'VisionBusy', message: 'Şu an yoğunuz.', retryable: true },
        }),
        twoPieces(),
      );
      await act(() => jest.advanceTimersByTimeAsync(0));
      expect(screen.getByText('Şu an yoğunuz.')).toBeTruthy();
      expect(cancelMock).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: tr.retry }));
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(screen.getByTestId('bulk-review')).toBeTruthy();
      expect(processMock).toHaveBeenCalledTimes(2);
      expect(uploadMock).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Failed and not retryable: the sentence and a new photo', async () => {
    await startWith(
      batch({
        status: 'Failed',
        failure: { code: 'PhotoUnreadable', message: 'Fotoğraf okunamadı.', retryable: false },
      }),
    );
    expect(await screen.findByText('Fotoğraf okunamadı.')).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkNewPhoto })).toBeTruthy();
  });

  it.each(['Cancelled', 'Expired'] as const)(
    '%s: the photo is over, a new photo',
    async (status) => {
      await startWith(batch({ status }));
      expect(await screen.findByText(tr.bulkExpired)).toBeTruthy();
      expect(screen.getByRole('button', { name: tr.bulkNewPhoto })).toBeTruthy();
    },
  );

  it('a poll that answers 404 BulkNotFound says the photo is over', async () => {
    await startWith(apiError(404, 'Wardrobe.BulkNotFound'));
    expect(await screen.findByText(tr.bulkExpired)).toBeTruthy();
  });

  it('a poll refused with a 4xx stops polling and sends no false Timeout', async () => {
    jest.useFakeTimers();
    try {
      await startWith(apiError(404, 'Wardrobe.BulkNotFound'));
      await act(() => jest.advanceTimersByTimeAsync(0));
      expect(screen.getByText(tr.bulkExpired)).toBeTruthy();
      await act(() => jest.advanceTimersByTimeAsync(70_000));
      expect(statusMock).toHaveBeenCalledTimes(1);
      expect(tracked('bulk_add_result')).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a poll answered 429 waits for Retry-After and keeps the batch', async () => {
    jest.useFakeTimers();
    try {
      await startWith(
        new ApiError({
          status: 429,
          errorCode: 'RateLimited',
          detail: null,
          correlationId: 'test',
          retryAfterSeconds: 5,
        }),
        twoPieces(),
      );
      await act(() => jest.advanceTimersByTimeAsync(0));
      expect(screen.getByTestId('bulk-waiting')).toBeTruthy();
      expect(screen.queryByTestId('bulk-problem')).toBeNull();
      await act(() => jest.advanceTimersByTimeAsync(2_000));
      expect(statusMock).toHaveBeenCalledTimes(1);
      await act(() => jest.advanceTimersByTimeAsync(3_500));
      expect(screen.getByTestId('bulk-review')).toBeTruthy();
      expect(cancelMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('"Tekrar dene" tapped twice processes once', async () => {
    let processed: () => void = () => undefined;
    statusMock.mockResolvedValueOnce(
      batch({
        status: 'Failed',
        failure: { code: 'VisionBusy', message: 'Şu an yoğunuz.', retryable: true },
      }),
    );
    await startWith();
    expect(await screen.findByText('Şu an yoğunuz.')).toBeTruthy();
    processMock.mockImplementationOnce(
      () => new Promise((resolve) => (processed = () => resolve(undefined as never))),
    );
    const button = screen.getByRole('button', { name: tr.retry });
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expect(processMock).toHaveBeenCalledTimes(2);
    await act(async () => processed());
  });

  it('404 BulkDisabled on any route closes the screen and hides the entry, without a word', async () => {
    const view = await startWith(apiError(404, 'Wardrobe.BulkDisabled'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(view.client.getQueryData(queryKeys.bulkAvailable)).toBe(false);
    expect(screen.queryByTestId('bulk-problem')).toBeNull();
  });
});

describe('request refusals', () => {
  it('429 BulkDailyLimit: its sentence and the single add', async () => {
    uploadMock.mockRejectedValueOnce(apiError(429, 'Wardrobe.BulkDailyLimit'));
    await startWith();
    expect(await screen.findByText(tr.bulkDailyLimit)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkSingleAdd }));
    expect(await screen.findByText(tr.wardrobeAddCatalog)).toBeTruthy();
  });

  it('409 BulkTooManyOpen: its sentence and the single add', async () => {
    uploadMock.mockRejectedValueOnce(apiError(409, 'Wardrobe.BulkTooManyOpen'));
    await startWith();
    expect(await screen.findByText(tr.bulkTooManyOpen)).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.bulkSingleAdd })).toBeTruthy();
  });

  it('leaving during the photo upload never asks the server to process the batch', async () => {
    let uploaded: () => void = () => undefined;
    putMock.mockImplementationOnce(
      () => new Promise((resolve) => (uploaded = () => resolve(undefined as never))),
    );
    const view = await startWith();
    await waitFor(() => expect(putMock).toHaveBeenCalled());
    await view.unmount();
    expect(cancelMock).toHaveBeenCalledWith('batch-1');
    await act(async () => uploaded());
    expect(processMock).not.toHaveBeenCalled();
  });

  it('a failed upload offers to send the same photo again', async () => {
    putMock.mockRejectedValueOnce(new Error('storage 500'));
    statusMock.mockResolvedValueOnce(twoPieces());
    await startWith();
    expect(await screen.findByText(tr.bulkUploadFailed)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: tr.retry }));
    await screen.findByTestId('bulk-review');
    expect(cameraMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledTimes(2);
  });

  it('a refused camera shows the usual line and stays on capture', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as never);
    await renderWithQuery(<BulkAddScreen />);
    await fireEvent.press(screen.getByTestId('bulk-camera'));
    await waitFor(() => expect(useToastStore.getState().message).toBe(tr.wardrobeCameraDenied));
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe('analytics', () => {
  it('sends enums and counts only: no id, url or sentence in any bulk event', async () => {
    await startWith(twoPieces());
    await screen.findByTestId('bulk-review');
    await fireEvent.press(screen.getByRole('button', { name: tr.bulkConfirm(1) }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const events = trackMock.mock.calls.filter(([name]) => String(name).startsWith('bulk_add_'));
    expect(events.map(([name]) => name)).toEqual([
      'bulk_add_start',
      'bulk_add_result',
      'bulk_add_confirm',
    ]);
    for (const [, props] of events) {
      for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
        expect(key).not.toMatch(/id$|url|message/i);
        expect(['number', 'string']).toContain(typeof value);
        if (typeof value === 'string') expect(value).toMatch(/^[A-Za-z_]+$/);
      }
    }
  });
});

describe('piece names', () => {
  const tree = [
    {
      slug: 'ust-giyim',
      name: 'Üst giyim',
      children: [{ slug: 'ust-giyim/gomlek', name: 'Gömlek', children: [] }],
    },
  ] as never;
  const draft = { ticked: true, categorySlug: 'ust-giyim/gomlek', color: 'Black' } as const;

  it('names a category picked from the full list by the category tree, never by its slug', () => {
    const bare = piece({ category: null, categoryCandidates: [] });
    expect(pieceName(bare, draft, tree)).toBe('Gömlek');
    expect(pieceName(bare, draft)).toBe(tr.bulkPieceFallback);
  });
});

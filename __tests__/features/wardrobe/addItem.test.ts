import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import {
  addItemFromProduct,
  createUploadUrl,
  getWardrobeItem,
  processWardrobeItem,
  putPhoto,
} from '@/api/endpoints/wardrobe';
import type { WardrobeItemPage } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  addFromCatalog,
  addPhotos,
  prepareImage,
  resizeActions,
  retryItem,
} from '@/features/wardrobe/addItem';
import { useAddStore } from '@/features/wardrobe/addStore';

import { wardrobeItem } from '../../fixtures';

jest.mock('@/api/endpoints/wardrobe');

const createUploadUrlMock = jest.mocked(createUploadUrl);
const putPhotoMock = jest.mocked(putPhoto);
const processMock = jest.mocked(processWardrobeItem);
const getItemMock = jest.mocked(getWardrobeItem);
const fromProductMock = jest.mocked(addItemFromProduct);
const manipulateMock = jest.mocked(ImageManipulator.manipulateAsync);
const trackMock = jest.mocked(track);
const getInfoMock = jest.mocked(FileSystem.getInfoAsync);

type ItemsData = InfiniteData<WardrobeItemPage, number>;

const photo = { uri: 'file:///photo-1.heic', width: 4000, height: 3000 };
const PHOTO_BYTES = 321_000;

let queryClient: QueryClient;

function seedList(filters: { category?: string; color?: string } = {}) {
  const data: ItemsData = {
    pages: [{ items: [], page: 1, pageSize: 24, totalCount: 0, totalPages: 0 }],
    pageParams: [1],
  };
  queryClient.setQueryData(queryKeys.wardrobeItems(filters), data);
}

const cards = (filters: { category?: string; color?: string } = {}) =>
  queryClient.getQueryData<ItemsData>(queryKeys.wardrobeItems(filters))?.pages[0]?.items ?? [];

function uploadFor(itemId: string) {
  return {
    itemId,
    uploadUrl: `http://storage.test/${itemId}`,
    headers: { 'Content-Type': 'image/jpeg' },
    expiresAt: '2026-11-02T10:15:00Z',
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useAddStore.getState().reset();
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  seedList();
  getInfoMock.mockResolvedValue({
    exists: true,
    uri: 'file:///photo-1.heic#resized',
    size: PHOTO_BYTES,
    isDirectory: false,
    modificationTime: 0,
  });
  createUploadUrlMock.mockResolvedValue(uploadFor('w-new'));
  putPhotoMock.mockResolvedValue(undefined);
  processMock.mockResolvedValue({ itemId: 'w-new', status: 'Processing' });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Lets the pending promise chain run, then moves the clock so one poll happens. */
async function pollOnce() {
  await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
}

describe('resizing before the upload', () => {
  it('shrinks the longer edge to 1600 px and leaves smaller photos alone', () => {
    expect(resizeActions(4000, 3000)).toEqual([{ resize: { width: 1600 } }]);
    expect(resizeActions(3000, 4000)).toEqual([{ resize: { height: 1600 } }]);
    expect(resizeActions(1600, 900)).toEqual([]);
    expect(resizeActions(undefined, undefined)).toEqual([]);
  });

  it('re-encodes as JPEG at 0.85 and measures the file it will send', async () => {
    const prepared = await prepareImage(photo);

    expect(manipulateMock).toHaveBeenCalledWith(
      'file:///photo-1.heic',
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: 'jpeg' },
    );
    expect(getInfoMock).toHaveBeenCalledWith('file:///photo-1.heic#resized');
    expect(prepared.sizeBytes).toBe(PHOTO_BYTES);
    expect(prepared.contentType).toBe('image/jpeg');
    expect(prepared.uri).toBe('file:///photo-1.heic#resized');
  });

  it('refuses a re-encoded file that is missing or empty instead of uploading nothing', async () => {
    getInfoMock.mockResolvedValueOnce({ exists: false, uri: 'x', isDirectory: false });
    await expect(prepareImage(photo)).rejects.toThrow('missing or empty');

    getInfoMock.mockResolvedValueOnce({
      exists: true,
      uri: 'x',
      size: 0,
      isDirectory: false,
      modificationTime: 0,
    });
    await expect(prepareImage(photo)).rejects.toThrow('missing or empty');
  });
});

describe('add flow: upload, process, poll', () => {
  it('shows the card at once, uploads with the size and headers, then fills it in when Ready', async () => {
    getItemMock
      .mockResolvedValueOnce(wardrobeItem({ id: 'w-new', status: 'Processing' }))
      .mockResolvedValueOnce(wardrobeItem({ id: 'w-new', status: 'Ready' }));

    const done = addPhotos(queryClient, [photo], 'library');

    // Before any network call has answered, the grid already has a Processing card for the local photo.
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.status).toBe('Processing');
    expect(cards()[0]?.id).toMatch(/^local-/);

    await jest.advanceTimersByTimeAsync(0);
    expect(createUploadUrlMock).toHaveBeenCalledWith({
      contentType: 'image/jpeg',
      sizeBytes: PHOTO_BYTES,
    });
    // The file on disk is what gets uploaded, by URI.
    expect(putPhotoMock).toHaveBeenCalledWith(uploadFor('w-new'), 'file:///photo-1.heic#resized');
    expect(processMock).toHaveBeenCalledWith('w-new');
    // The local card took the server id and kept its local photo for the shimmer.
    expect(cards()[0]?.id).toBe('w-new');
    expect(useAddStore.getState().localUris['w-new']).toBe('file:///photo-1.heic');

    await pollOnce();
    expect(cards()[0]?.status).toBe('Processing');
    await pollOnce();
    const [outcome] = await done;

    expect(outcome).toMatchObject({ id: 'w-new', status: 'Ready' });
    expect(getItemMock).toHaveBeenCalledTimes(2);
    expect(cards()[0]).toMatchObject({
      id: 'w-new',
      status: 'Ready',
      categorySlug: 'ust-giyim/blazer',
    });
    expect(queryClient.getQueryData(queryKeys.wardrobeItem('w-new'))).toMatchObject({
      status: 'Ready',
    });
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_start', { source: 'library' });
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_done', {
      status: 'Ready',
      durationMs: expect.any(Number),
    });
  });

  it('queues the confirm sheet only while the wardrobe tab is on screen', async () => {
    getItemMock.mockResolvedValue(wardrobeItem({ id: 'w-new', status: 'Ready' }));

    const away = addPhotos(queryClient, [photo], 'camera');
    await pollOnce();
    await away;
    expect(useAddStore.getState().confirmQueue).toEqual([]);

    useAddStore.getState().reset();
    seedList();
    useAddStore.getState().setOnWardrobeScreen(true);
    const here = addPhotos(queryClient, [photo], 'camera');
    await pollOnce();
    await here;
    expect(useAddStore.getState().confirmQueue).toEqual(['w-new']);
  });

  it('ends a Failed analysis as a failed card, without opening the confirm sheet', async () => {
    useAddStore.getState().setOnWardrobeScreen(true);
    getItemMock.mockResolvedValue(
      wardrobeItem({ id: 'w-new', status: 'Failed', failureReason: 'unsupported_image' }),
    );

    const done = addPhotos(queryClient, [photo], 'library');
    await pollOnce();
    const [outcome] = await done;

    expect(outcome?.status).toBe('Failed');
    expect(cards()[0]?.status).toBe('Failed');
    expect(useAddStore.getState().failureReasons['w-new']).toBe('unsupported_image');
    expect(useAddStore.getState().confirmQueue).toEqual([]);
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_done', {
      status: 'Failed',
      durationMs: expect.any(Number),
    });
  });

  it('gives up after 40 s: the card turns failed and the add reports a timeout', async () => {
    getItemMock.mockResolvedValue(wardrobeItem({ id: 'w-new', status: 'Processing' }));

    const done = addPhotos(queryClient, [photo], 'library');
    await jest.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);
    const [outcome] = await done;

    expect(outcome?.status).toBe('Timeout');
    // One poll every 1.5 s until the 40 s are used up.
    expect(getItemMock).toHaveBeenCalledTimes(Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS));
    expect(cards()[0]?.status).toBe('Failed');
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_done', {
      status: 'Timeout',
      durationMs: expect.any(Number),
    });
  });

  it('keeps polling through a failed poll and stops when the item no longer exists', async () => {
    getItemMock
      .mockRejectedValueOnce(new ApiError({ status: 0, correlationId: 'c' }))
      .mockRejectedValueOnce(new ApiError({ status: 404, correlationId: 'c' }));

    const done = addPhotos(queryClient, [photo], 'library');
    await pollOnce();
    expect(cards()[0]?.status).toBe('Processing');
    await pollOnce();
    const [outcome] = await done;

    expect(outcome?.status).toBe('Failed');
    expect(getItemMock).toHaveBeenCalledTimes(2);
  });

  it('leaves a failed card behind when the upload breaks, and a tap sends the same photo again', async () => {
    putPhotoMock.mockRejectedValueOnce(new Error('offline'));

    const [first] = await addPhotos(queryClient, [photo], 'library');

    expect(first).toMatchObject({ id: 'w-new', status: 'Failed' });
    expect(cards()[0]).toMatchObject({ id: 'w-new', status: 'Failed' });
    expect(processMock).not.toHaveBeenCalled();
    expect(useAddStore.getState().retryPhotos['w-new']?.photo).toEqual(photo);
    expect(useAddStore.getState().failureReasons['w-new']).toBe('offline');

    createUploadUrlMock.mockResolvedValue(uploadFor('w-second'));
    processMock.mockResolvedValue({ itemId: 'w-second', status: 'Processing' });
    getItemMock.mockResolvedValue(wardrobeItem({ id: 'w-second', status: 'Ready' }));
    const retried = retryItem(queryClient, 'w-new');
    await pollOnce();
    const outcome = await retried;

    expect(outcome).toMatchObject({ id: 'w-second', status: 'Ready' });
    // The failed card is gone, replaced by the new one.
    expect(cards().map((card) => card.id)).toEqual(['w-second']);
    expect(useAddStore.getState().retryPhotos['w-new']).toBeUndefined();
    expect(useAddStore.getState().failureReasons['w-new']).toBeUndefined();
  });

  it('retries a server-side failure by asking for the analysis again', async () => {
    queryClient.setQueryData<ItemsData>(queryKeys.wardrobeItems({}), {
      pages: [
        {
          items: [
            {
              id: 'w9',
              status: 'Failed',
              name: null,
              categorySlug: null,
              needsCategory: false,
              primaryColor: 'Other',
              thumbUrl: null,
              wearCount: 0,
              lastWornAt: null,
              isArchived: false,
              createdAt: '2026-11-02T10:00:00Z',
            },
          ],
          page: 1,
          pageSize: 24,
          totalCount: 1,
          totalPages: 1,
        },
      ],
      pageParams: [1],
    });
    processMock.mockResolvedValue({ itemId: 'w9', status: 'Processing' });
    getItemMock.mockResolvedValue(wardrobeItem({ id: 'w9', status: 'Ready' }));

    const retried = retryItem(queryClient, 'w9');
    expect(cards()[0]?.status).toBe('Processing');
    await pollOnce();

    expect(await retried).toMatchObject({ id: 'w9', status: 'Ready' });
    expect(processMock).toHaveBeenCalledWith('w9');
    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('uploads several photos one after another and reports "3/3"', async () => {
    const seen: (string | null)[] = [];
    const unsubscribe = useAddStore.subscribe((state) => {
      const progress = state.uploading;
      const label = progress ? `${progress.current}/${progress.total}` : null;
      if (seen[seen.length - 1] !== label) {
        seen.push(label);
      }
    });
    createUploadUrlMock
      .mockResolvedValueOnce(uploadFor('a'))
      .mockResolvedValueOnce(uploadFor('b'))
      .mockResolvedValueOnce(uploadFor('c'));
    getItemMock.mockImplementation(async (id) => wardrobeItem({ id, status: 'Ready' }));

    const done = addPhotos(
      queryClient,
      [photo, { uri: 'file:///2.jpg' }, { uri: 'file:///3.jpg' }],
      'library',
    );
    await jest.advanceTimersByTimeAsync(0);
    await pollOnce();
    const outcomes = await done;
    unsubscribe();

    expect(seen).toEqual(['1/3', '2/3', '3/3', null]);
    expect(createUploadUrlMock).toHaveBeenCalledTimes(3);
    expect(outcomes.map((outcome) => outcome.id)).toEqual(['a', 'b', 'c']);
    expect(cards().map((card) => card.id)).toEqual(['c', 'b', 'a']);
    expect(trackMock.mock.calls.filter(([name]) => name === 'wardrobe_add_start')).toHaveLength(3);
  });

  it('accepts at most ten photos', async () => {
    getItemMock.mockImplementation(async (id) => wardrobeItem({ id, status: 'Ready' }));
    createUploadUrlMock.mockImplementation(async () =>
      uploadFor(`i${createUploadUrlMock.mock.calls.length}`),
    );

    const done = addPhotos(
      queryClient,
      Array.from({ length: 12 }, (_, index) => ({ uri: `file:///${index}.jpg` })),
      'library',
    );
    await jest.advanceTimersByTimeAsync(0);
    await pollOnce();
    await done;

    expect(createUploadUrlMock).toHaveBeenCalledTimes(10);
  });
});

describe('adding from the catalog', () => {
  it('posts the product, shows the ready card and reports the add', async () => {
    fromProductMock.mockResolvedValue(wardrobeItem({ id: 'w-cat', fromCatalog: true }));

    const item = await addFromCatalog(queryClient, 'p1');

    expect(fromProductMock).toHaveBeenCalledWith({ productId: 'p1', size: null });
    expect(item.id).toBe('w-cat');
    expect(cards()[0]).toMatchObject({ id: 'w-cat', status: 'Ready' });
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_start', { source: 'catalog' });
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_done', {
      status: 'Ready',
      durationMs: expect.any(Number),
    });
  });

  it('reports a failed add and rethrows', async () => {
    fromProductMock.mockRejectedValue(new Error('nope'));

    await expect(addFromCatalog(queryClient, 'p1')).rejects.toThrow('nope');
    expect(trackMock).toHaveBeenCalledWith('wardrobe_add_done', {
      status: 'Failed',
      durationMs: expect.any(Number),
    });
  });
});

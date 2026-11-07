import * as FileSystem from 'expo-file-system/legacy';

import {
  getDailyOutfit,
  getHowToWear,
  dismissOutfit,
  listSavedOutfits,
} from '@/api/endpoints/outfits';
import {
  getWardrobePairings,
  listWardrobeItems,
  putPhoto,
  recordWear,
  undoWear,
  updateWardrobeItem,
} from '@/api/endpoints/wardrobe';

import { pairings } from '../fixtures';
import { API, authHeader, reply, resetSession, signedInSession } from '../testUtils';

const uploadAsyncMock = jest.mocked(FileSystem.uploadAsync);
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(reply(200, {}));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
  await signedInSession();
});

const lastCall = () => fetchMock.mock.calls[0] as [string, RequestInit];

describe('wardrobe endpoints', () => {
  it('lists items with the filters as the contract names them', async () => {
    await listWardrobeItems({ category: 'dis-giyim', color: 'Black', page: 2, pageSize: 24 });

    expect(lastCall()[0]).toBe(
      `${API}/api/v1/me/wardrobe/items?Category=dis-giyim&Color=Black&Page=2&PageSize=24`,
    );
    expect(authHeader(lastCall())).toBe('Bearer access-old');
  });

  it('asks for the pairings of one item with the bearer token and no persona', async () => {
    fetchMock.mockResolvedValue(reply(200, pairings()));

    const result = await getWardrobePairings('w1');

    expect(lastCall()[0]).toBe(`${API}/api/v1/me/wardrobe/items/w1/pairings`);
    expect(authHeader(lastCall())).toBe('Bearer access-old');
    expect(result.companions.map((slot) => slot.slot)).toEqual([
      'Top',
      'Bottom',
      'Outerwear',
      'Shoes',
      'Accessory',
    ]);
    expect(result.unlock).toBeNull();
  });

  it('escapes the id in the pairings path', async () => {
    await getWardrobePairings('a/b');

    expect(lastCall()[0]).toBe(`${API}/api/v1/me/wardrobe/items/a%2Fb/pairings`);
  });

  it('uploads the photo file itself to the presigned URL: PUT, binary body, the given headers, no bearer token', async () => {
    await putPhoto(
      {
        uploadUrl: 'http://storage.test/bucket/key?sig=1',
        headers: { 'Content-Type': 'image/jpeg' },
      },
      'file:///cache/photo.jpg',
    );

    expect(uploadAsyncMock).toHaveBeenCalledWith(
      'http://storage.test/bucket/key?sig=1',
      'file:///cache/photo.jpg',
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': 'image/jpeg' },
      },
    );
    // The file goes through the native uploader: neither `fetch` nor the API client is involved.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails when the storage refuses the photo', async () => {
    uploadAsyncMock.mockResolvedValueOnce({ status: 403, headers: {}, mimeType: null, body: '' });

    await expect(
      putPhoto({ uploadUrl: 'http://storage.test/x', headers: {} }, 'file:///cache/photo.jpg'),
    ).rejects.toThrow('HTTP 403');
  });

  it('fails when the native upload itself throws', async () => {
    uploadAsyncMock.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(
      putPhoto({ uploadUrl: 'http://storage.test/x', headers: {} }, 'file:///cache/photo.jpg'),
    ).rejects.toThrow('Network request failed');
  });

  it('sends a patch with every field present, so {} is the confirmation', async () => {
    await updateWardrobeItem('w1', {});

    expect(lastCall()[1].method).toBe('PATCH');
    const body = JSON.parse(String(lastCall()[1].body));
    expect(Object.values(body).every((value) => value === null)).toBe(true);

    fetchMock.mockClear();
    await updateWardrobeItem('w1', { categorySlug: 'ust-giyim/blazer', clear: ['name'] });
    expect(JSON.parse(String(lastCall()[1].body))).toMatchObject({
      categorySlug: 'ust-giyim/blazer',
      clear: ['name'],
      name: null,
    });
  });

  it('wears today without a body, or on a given day, and undoes by day', async () => {
    await recordWear('w1');
    expect(lastCall()[0]).toBe(`${API}/api/v1/me/wardrobe/items/w1/wear`);
    expect(lastCall()[1].body).toBeUndefined();

    fetchMock.mockClear();
    await recordWear('w1', '2026-11-01');
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({ wornOn: '2026-11-01' });

    fetchMock.mockClear();
    await undoWear('w1', '2026-11-01');
    expect(lastCall()[0]).toBe(`${API}/api/v1/me/wardrobe/items/w1/wear/2026-11-01`);
    expect(lastCall()[1].method).toBe('DELETE');
  });
});

describe('outfit endpoints', () => {
  it('asks for the daily outfit by date, occasion and seed', async () => {
    await getDailyOutfit({ date: 'tomorrow', occasion: 'evening', seed: 2 });

    expect(lastCall()[0]).toBe(
      `${API}/api/v1/me/outfits/daily?Date=tomorrow&Occasion=evening&Seed=2`,
    );
    expect(authHeader(lastCall())).toBe('Bearer access-old');
  });

  it('keeps seed 0 in the query: it is the plain ranking', async () => {
    await getDailyOutfit({ seed: 0 });

    expect(lastCall()[0]).toBe(`${API}/api/v1/me/outfits/daily?Seed=0`);
  });

  it('asks for how-to-wear around a product or an item', async () => {
    await getHowToWear({ productId: 'p1', count: 5 });
    expect(lastCall()[0]).toBe(`${API}/api/v1/me/outfits/how-to-wear?ProductId=p1&Count=5`);

    fetchMock.mockClear();
    await getHowToWear({ wardrobeItemId: 'w1', count: 5 });
    expect(lastCall()[0]).toBe(`${API}/api/v1/me/outfits/how-to-wear?WardrobeItemId=w1&Count=5`);
  });

  it('dismisses with the reason as a query parameter', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
    } as unknown as Response);

    await dismissOutfit('o1', 'TooFormal');

    expect(lastCall()[0]).toBe(`${API}/api/v1/me/outfits/o1?Reason=TooFormal`);
    expect(lastCall()[1].method).toBe('DELETE');
  });

  it('pages the saved outfits', async () => {
    await listSavedOutfits(2, 20);

    expect(lastCall()[0]).toBe(`${API}/api/v1/me/outfits/saved?Page=2&PageSize=20`);
  });
});

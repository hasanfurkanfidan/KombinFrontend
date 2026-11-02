import {
  getDailyOutfit,
  getHowToWear,
  dismissOutfit,
  listSavedOutfits,
} from '@/api/endpoints/outfits';
import {
  listWardrobeItems,
  putPhoto,
  recordWear,
  undoWear,
  updateWardrobeItem,
} from '@/api/endpoints/wardrobe';

import { API, authHeader, reply, resetSession, signedInSession } from '../testUtils';

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

  it('puts the photo to the presigned URL with exactly the given headers, and no bearer token', async () => {
    const blob = { size: 10 } as unknown as Blob;
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);

    await putPhoto(
      {
        uploadUrl: 'http://storage.test/bucket/key?sig=1',
        headers: { 'Content-Type': 'image/jpeg' },
      },
      blob,
    );

    expect(lastCall()[0]).toBe('http://storage.test/bucket/key?sig=1');
    expect(lastCall()[1]).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
    expect(authHeader(lastCall())).toBeUndefined();
  });

  it('fails when the storage refuses the photo', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(
      putPhoto({ uploadUrl: 'http://storage.test/x', headers: {} }, {} as Blob),
    ).rejects.toThrow('HTTP 403');
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

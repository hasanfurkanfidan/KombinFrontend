import { listProducts, getProduct, searchBrands } from '@/api/endpoints/catalog';
import { listTriggers, updateAlert } from '@/api/endpoints/engagement';
import { createPersona, getStyleCards, submitSwipes, updatePersona } from '@/api/endpoints/profile';

import { API, authHeader, reply, resetSession, signedInSession } from '../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(reply(200, {}));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
});

const lastCall = () => fetchMock.mock.calls[0] as [string, RequestInit];

describe('endpoints with query or body shaping', () => {
  it('lists products publicly, and with the token once a persona is involved', async () => {
    await listProducts({ Page: 1, PageSize: 20 });
    expect(lastCall()[0]).toBe(`${API}/api/v1/catalog/products?Page=1&PageSize=20`);
    expect(authHeader(lastCall())).toBeUndefined();

    await signedInSession();
    fetchMock.mockClear();
    await listProducts({ PersonaId: 'pe1', Sort: 'match', Page: 1 });
    expect(lastCall()[0]).toBe(`${API}/api/v1/catalog/products?PersonaId=pe1&Sort=match&Page=1`);
    expect(authHeader(lastCall())).toBe('Bearer access-old');
  });

  it('sends the persona and the token to the product detail only when asked', async () => {
    await getProduct('p 1');
    expect(lastCall()[0]).toBe(`${API}/api/v1/catalog/products/p%201`);
    expect(authHeader(lastCall())).toBeUndefined();

    await signedInSession();
    fetchMock.mockClear();
    await getProduct('p1', { personaId: 'pe1', auth: true });
    expect(lastCall()[0]).toBe(`${API}/api/v1/catalog/products/p1?personaId=pe1`);
    expect(authHeader(lastCall())).toBe('Bearer access-old');
  });

  it('asks for style cards with a limit', async () => {
    await signedInSession();
    await getStyleCards('pe1', 20);
    expect(lastCall()[0]).toBe(`${API}/api/v1/me/personas/pe1/style-cards?limit=20`);
  });

  it('posts swipes as { swipes: [...] }', async () => {
    await signedInSession();
    await submitSwipes('pe1', [{ styleCardId: 'c1', decision: 'Like' }]);
    expect(lastCall()[1].method).toBe('POST');
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      swipes: [{ styleCardId: 'c1', decision: 'Like' }],
    });
  });

  it('creates a persona with name and icon and leaves every preference at null', async () => {
    await signedInSession();
    await createPersona({ name: 'Ofis', icon: 'office' });
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      name: 'Ofis',
      icon: 'office',
      budgetMin: null,
      budgetMax: null,
      formalityMin: null,
      formalityMax: null,
      preferredColors: null,
      avoidedColors: null,
      preferredFits: null,
      seasons: null,
    });
  });

  it('patches only what changed: everything else is explicitly null', async () => {
    await signedInSession();
    await updatePersona('pe1', { name: 'Gece' });
    expect(lastCall()[1].method).toBe('PATCH');
    const body = JSON.parse(String(lastCall()[1].body)) as Record<string, unknown>;
    expect(body.name).toBe('Gece');
    expect(
      Object.entries(body)
        .filter(([key]) => key !== 'name')
        .every(([, value]) => value === null),
    ).toBe(true);

    fetchMock.mockClear();
    await updateAlert('a1', { isActive: false });
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      targetPrice: null,
      sizes: null,
      isActive: false,
    });
  });

  it('asks for 50 triggers on the first page and searches brands by name', async () => {
    await signedInSession();
    await listTriggers(50);
    expect(lastCall()[0]).toBe(`${API}/api/v1/me/alerts/triggers?Page=1&PageSize=50`);

    fetchMock.mockClear();
    await searchBrands('mav i');
    expect(lastCall()[0]).toBe(`${API}/api/v1/catalog/brands?Query=mav%20i&PageSize=20`);
  });
});

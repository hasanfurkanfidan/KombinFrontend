import * as SecureStore from 'expo-secure-store';

import { ApiError, request } from '@/api/client';
import { useSessionStore } from '@/session/sessionStore';

import {
  API,
  authHeader,
  problem,
  reply,
  resetSession,
  signedInSession,
  tokens,
} from '../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
const REFRESH_URL = `${API}/api/v1/auth/refresh`;

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
});

describe('request basics', () => {
  it('sends Accept and a fresh X-Correlation-ID, and no bearer for public calls', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));

    await request('/api/v1/catalog/categories');
    await request('/api/v1/catalog/categories');

    const [first, second] = fetchMock.mock.calls.map(
      ([, init]) => init.headers as Record<string, string>,
    );
    expect(first?.Accept).toBe('application/json');
    expect(first?.['X-Correlation-ID']).toMatch(/^[0-9a-f-]{36}$/);
    expect(first?.['X-Correlation-ID']).not.toBe(second?.['X-Correlation-ID']);
    expect(first?.Authorization).toBeUndefined();
  });

  it('serializes query parameters and skips empty ones', async () => {
    fetchMock.mockResolvedValue(reply(200, []));

    await request('/api/v1/catalog/products', {
      query: { CategorySlug: 'ust giyim', Color: undefined, Sort: '', Page: 2 },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API}/api/v1/catalog/products?CategorySlug=ust%20giyim&Page=2`,
    );
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValue(reply(204));
    await expect(request('/x', { method: 'POST', body: {} })).resolves.toBeUndefined();
  });

  it('parses problem+json into an ApiError with field errors', async () => {
    fetchMock.mockResolvedValue(
      problem(400, 'Validation.Failed', { errors: { email: ['Invalid email.'] } }),
    );

    const error = await request('/x', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      errorCode: 'Validation.Failed',
      detail: 'Validation.Failed detail',
      fieldErrors: { email: ['Invalid email.'] },
    });
  });

  it('turns a connection failure into an ApiError with status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await request('/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetworkError).toBe(true);
  });
});

describe('token refresh', () => {
  it('refreshes once on 401 and retries the original request with the new token', async () => {
    await signedInSession('old');
    fetchMock
      .mockResolvedValueOnce(problem(401, 'Unauthorized'))
      .mockResolvedValueOnce(reply(200, tokens('new')))
      .mockResolvedValueOnce(reply(200, { id: 'me' }));

    await expect(request('/api/v1/me', { auth: true })).resolves.toEqual({ id: 'me' });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${API}/api/v1/me`,
      REFRESH_URL,
      `${API}/api/v1/me`,
    ]);
    expect(authHeader(fetchMock.mock.calls[0] as unknown[])).toBe('Bearer access-old');
    expect(authHeader(fetchMock.mock.calls[2] as unknown[])).toBe('Bearer access-new');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body as string)).toEqual({
      refreshToken: 'refresh-old',
    });
    // The rotated refresh token replaces the old one in secure storage.
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-new');
    expect(useSessionStore.getState().accessToken).toBe('access-new');
  });

  it('shares one in-flight refresh between concurrent 401s', async () => {
    await signedInSession('old');
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url, init) => {
      if (url === REFRESH_URL) {
        refreshCalls += 1;
        return reply(200, tokens('new'));
      }
      return authHeader([url, init]) === 'Bearer access-new'
        ? reply(200, { url })
        : problem(401, 'Unauthorized');
    });

    const results = await Promise.all([
      request('/api/v1/a', { auth: true }),
      request('/api/v1/b', { auth: true }),
      request('/api/v1/c', { auth: true }),
    ]);

    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  it('refreshes proactively when less than 60 seconds remain', async () => {
    await signedInSession('old', 30);
    fetchMock
      .mockResolvedValueOnce(reply(200, tokens('new')))
      .mockResolvedValueOnce(reply(200, { ok: true }));

    await request('/api/v1/me', { auth: true });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([REFRESH_URL, `${API}/api/v1/me`]);
    expect(authHeader(fetchMock.mock.calls[1] as unknown[])).toBe('Bearer access-new');
  });

  it('does not refresh while the token has plenty of time left', async () => {
    await signedInSession('old', 900);
    fetchMock.mockResolvedValue(reply(200, { ok: true }));

    await request('/api/v1/me', { auth: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the session and flags it expired when the refresh is rejected', async () => {
    await signedInSession('old');
    fetchMock
      .mockResolvedValueOnce(problem(401, 'Unauthorized'))
      .mockResolvedValueOnce(problem(401, 'Identity.InvalidRefreshToken'));

    const error = await request('/api/v1/me', { auth: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errorCode).toBe('Identity.InvalidRefreshToken');
    expect(useSessionStore.getState()).toMatchObject({
      status: 'signedOut',
      accessToken: null,
      endReason: 'expired',
    });
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });

  it('retries only once: a second 401 ends the session', async () => {
    await signedInSession('old');
    fetchMock
      .mockResolvedValueOnce(problem(401, 'Unauthorized'))
      .mockResolvedValueOnce(reply(200, tokens('new')))
      .mockResolvedValueOnce(problem(401, 'Unauthorized'));

    await expect(request('/api/v1/me', { auth: true })).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useSessionStore.getState().status).toBe('signedOut');
  });

  it('keeps the session when the refresh fails because the network is down', async () => {
    await signedInSession('old');
    fetchMock
      .mockResolvedValueOnce(problem(401, 'Unauthorized'))
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    const error = await request('/api/v1/me', { auth: true }).catch((e: unknown) => e);

    expect((error as ApiError).isNetworkError).toBe(true);
    expect(useSessionStore.getState().status).toBe('signedIn');
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-old');
  });

  it('fails fast with 401 when there is no session at all', async () => {
    const error = await request('/api/v1/me', { auth: true }).catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

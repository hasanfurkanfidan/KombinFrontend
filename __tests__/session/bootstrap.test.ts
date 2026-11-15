import { waitFor } from '@testing-library/react-native';

import { trackQueryClient } from '../support/leakGuard';
import { API, authHeader, problem, reply, tokens } from '../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

const me = { id: 'u1', email: 'a@b.co', displayName: 'Ayşe', createdAt: '2026-11-01T10:00:00Z' };

/** The bootstrap is memoized per module instance, so every test loads a fresh copy of the session layer. */
function load() {
  let loaded!: {
    bootstrapSession: () => Promise<void>;
    useSessionStore: typeof import('@/session/sessionStore').useSessionStore;
    queryClient: typeof import('@/api/queryClient').queryClient;
    // The isolated registry gets its own in-memory keystore, so tests must use this one.
    SecureStore: typeof import('expo-secure-store');
  };
  jest.isolateModules(() => {
    loaded = {
      bootstrapSession:
        jest.requireActual<typeof import('@/session/useSession')>('@/session/useSession')
          .bootstrapSession,
      useSessionStore:
        jest.requireActual<typeof import('@/session/sessionStore')>('@/session/sessionStore')
          .useSessionStore,
      queryClient:
        jest.requireActual<typeof import('@/api/queryClient')>('@/api/queryClient').queryClient,
      SecureStore: jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store'),
    };
  });
  // Cleared (and checked for work left in flight) by the leak guard when the test ends.
  trackQueryClient(loaded.queryClient);
  return loaded;
}

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('bootstrapSession', () => {
  it('goes straight to signed-out without touching the network when nothing is stored', async () => {
    const { bootstrapSession, useSessionStore } = load();

    await bootstrapSession();

    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes, ends up signed in, and warms /me without holding the splash for it', async () => {
    const env = load();
    await env.SecureStore.setItemAsync('kombin.refreshToken', 'refresh-stored');
    fetchMock
      .mockResolvedValueOnce(reply(200, tokens('fresh')))
      .mockResolvedValueOnce(reply(200, me));

    await env.bootstrapSession();

    expect(env.useSessionStore.getState().status).toBe('signedIn');
    await waitFor(() => expect(env.queryClient.getQueryData(['me'])).toEqual(me));
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${API}/api/v1/auth/refresh`,
      `${API}/api/v1/me`,
    ]);
    expect(authHeader(fetchMock.mock.calls[1] as unknown[])).toBe('Bearer access-fresh');
    expect(await env.SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-fresh');
  });

  it('opens signed out after the boot timeout when the refresh hangs, and signs in when it finally answers', async () => {
    jest.useFakeTimers();
    try {
      const env = load();
      await env.SecureStore.setItemAsync('kombin.refreshToken', 'refresh-stored');
      let answer!: (response: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (answer = resolve)));
      fetchMock.mockResolvedValue(reply(200, me));

      const boot = env.bootstrapSession();
      await jest.advanceTimersByTimeAsync(6000);
      await boot;
      expect(env.useSessionStore.getState().status).toBe('signedOut');

      answer(reply(200, tokens('late')));
      await jest.advanceTimersByTimeAsync(0);
      expect(env.useSessionStore.getState().status).toBe('signedIn');
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears a rejected refresh token quietly: signed out, no redirect to login', async () => {
    const env = load();
    await env.SecureStore.setItemAsync('kombin.refreshToken', 'refresh-revoked');
    fetchMock.mockResolvedValueOnce(problem(401, 'Identity.InvalidRefreshToken'));

    await env.bootstrapSession();

    expect(env.useSessionStore.getState()).toMatchObject({ status: 'signedOut', endReason: null });
    expect(await env.SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });

  it('keeps the stored token when the server is unreachable', async () => {
    const env = load();
    await env.SecureStore.setItemAsync('kombin.refreshToken', 'refresh-stored');
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await env.bootstrapSession();

    expect(env.useSessionStore.getState().status).toBe('signedOut');
    expect(await env.SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-stored');
  });

  it('runs once even when called repeatedly', async () => {
    const env = load();
    await env.SecureStore.setItemAsync('kombin.refreshToken', 'refresh-stored');
    fetchMock
      .mockResolvedValueOnce(reply(200, tokens('fresh')))
      .mockResolvedValueOnce(reply(200, me));

    await Promise.all([env.bootstrapSession(), env.bootstrapSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

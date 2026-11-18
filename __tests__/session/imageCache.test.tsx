import { Image } from 'expo-image';

import * as SecureStore from 'expo-secure-store';

import { refreshSession } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { usePrefsStore } from '@/session/prefsStore';
import { endSession, useSessionStore } from '@/session/sessionStore';
import { bootstrapSession, clearLocalSession, completeSignIn, signOut } from '@/session/useSession';
import { installUserScopeReset } from '@/session/userScope';
import { clearImageCache } from '@/utils/imageCache';

import { problem, resetSession, signedInSession, tokens } from '../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
const realFetch = globalThis.fetch;

let uninstall: () => void = () => undefined;
let clearMemory: jest.SpyInstance;
let clearDisk: jest.SpyInstance;

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  clearMemory = jest.spyOn(Image, 'clearMemoryCache').mockResolvedValue(true);
  clearDisk = jest.spyOn(Image, 'clearDiskCache').mockResolvedValue(true);
  await resetSession();
  usePrefsStore.getState().reset();
  uninstall = installUserScopeReset();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  uninstall();
  queryClient.clear();
  jest.restoreAllMocks();
});

describe('the image cache belongs to the account that downloaded it', () => {
  it('empties the memory and the disk cache when the session ends', async () => {
    await signedInSession('a');
    expect(clearMemory).not.toHaveBeenCalled();

    await endSession();

    expect(clearMemory).toHaveBeenCalledTimes(1);
    expect(clearDisk).toHaveBeenCalledTimes(1);
  });

  it('does the same on the way out of an account deletion', async () => {
    await signedInSession('a');

    // The delete flow ends the local session without a logout call.
    await clearLocalSession();

    expect(clearMemory).toHaveBeenCalledTimes(1);
    expect(clearDisk).toHaveBeenCalledTimes(1);
  });

  it('leaves the cache alone while the session goes on', async () => {
    await signedInSession('a');
    await signedInSession('a-refreshed');

    expect(clearMemory).not.toHaveBeenCalled();
    expect(clearDisk).not.toHaveBeenCalled();
  });

  it('never lets a failing cache stop a sign-out', async () => {
    clearDisk.mockRejectedValue(new Error('disk'));

    await expect(clearImageCache()).resolves.toBeUndefined();
  });
});

/** Both halves of the cache, each emptied exactly once: the memory one and the one on disk. */
function expectBothCachesCleared() {
  expect(clearMemory).toHaveBeenCalledTimes(1);
  expect(clearDisk).toHaveBeenCalledTimes(1);
}

describe('every way a session can end empties the memory and the disk cache', () => {
  it('the user signs out with the button', async () => {
    await signedInSession('a');
    fetchMock.mockRejectedValue(new TypeError('offline'));

    await signOut();

    expectBothCachesCleared();
  });

  it('the server rejects the refresh token while the app is open', async () => {
    await signedInSession('a');
    fetchMock.mockResolvedValue(problem(401, 'Identity.InvalidRefreshToken'));

    await expect(refreshSession()).rejects.toBeDefined();

    expect(useSessionStore.getState().status).toBe('signedOut');
    expectBothCachesCleared();
  });

  it('the server rejects the stored refresh token at start-up', async () => {
    await SecureStore.setItemAsync('kombin.refreshToken', 'refresh-old');
    fetchMock.mockResolvedValue(problem(401, 'Identity.InvalidRefreshToken'));
    expect(useSessionStore.getState().status).toBe('booting');

    await bootstrapSession();

    expect(useSessionStore.getState().status).toBe('signedOut');
    expectBothCachesCleared();
  });

  it('a start-up with no stored session keeps the disk cache (a visitor’s pictures are nobody’s secret)', async () => {
    useSessionStore.getState().setSignedOut();

    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(clearMemory).not.toHaveBeenCalled();
    expect(clearDisk).not.toHaveBeenCalled();
  });

  it('the account is deleted', async () => {
    await signedInSession('a');

    await clearLocalSession();

    expectBothCachesCleared();
  });

  it('another user signs in while the first one’s session is still open', async () => {
    await signedInSession('a');

    await completeSignIn(tokens('b'), 'password');

    expect(useSessionStore.getState().status).toBe('signedIn');
    expectBothCachesCleared();
  });

  it('an ordinary sign-in from a signed-out phone empties nothing', async () => {
    useSessionStore.getState().setSignedOut();

    await completeSignIn(tokens('a'), 'password');

    expect(clearMemory).not.toHaveBeenCalled();
    expect(clearDisk).not.toHaveBeenCalled();
  });
});

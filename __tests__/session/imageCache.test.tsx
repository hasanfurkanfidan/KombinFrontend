import { Image } from 'expo-image';

import { usePrefsStore } from '@/session/prefsStore';
import { endSession } from '@/session/sessionStore';
import { clearLocalSession } from '@/session/useSession';
import { installUserScopeReset } from '@/session/userScope';
import { clearImageCache } from '@/utils/imageCache';
import { queryClient } from '@/api/queryClient';

import { resetSession, signedInSession } from '../testUtils';

let uninstall: () => void = () => undefined;
let clearMemory: jest.SpyInstance;
let clearDisk: jest.SpyInstance;

beforeEach(async () => {
  clearMemory = jest.spyOn(Image, 'clearMemoryCache').mockResolvedValue(true);
  clearDisk = jest.spyOn(Image, 'clearDiskCache').mockResolvedValue(true);
  await resetSession();
  usePrefsStore.getState().reset();
  uninstall = installUserScopeReset();
});

afterEach(() => {
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

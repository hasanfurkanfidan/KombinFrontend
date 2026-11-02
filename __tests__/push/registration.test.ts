import * as Notifications from 'expo-notifications';

import { logout } from '@/api/endpoints/auth';
import { registerDevice } from '@/api/endpoints/notifications';
import {
  registerPushToken,
  requestPushPermission,
  resetPushRegistration,
  syncPushRegistration,
} from '@/push';
import { usePrefsStore } from '@/session/prefsStore';
import { signOut } from '@/session/useSession';

import { resetSession, signedInSession } from '../testUtils';

jest.mock('@/api/endpoints/notifications');
jest.mock('@/api/endpoints/auth');

const registerDeviceMock = jest.mocked(registerDevice);
const logoutMock = jest.mocked(logout);
const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);

const TOKEN = 'ExponentPushToken[test-token]';

describe('push registration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    registerDeviceMock.mockResolvedValue(undefined);
    getPermissions.mockResolvedValue({ status: 'undetermined' } as never);
    requestPermissions.mockResolvedValue({ status: 'granted' } as never);
    usePrefsStore.getState().reset();
    resetPushRegistration();
    await resetSession();
  });

  it('registers the token with the platform, app version and device name once permission is granted', async () => {
    await signedInSession();

    await expect(requestPushPermission()).resolves.toBe('granted');

    expect(usePrefsStore.getState().pushToken).toBe(TOKEN);
    expect(registerDeviceMock).toHaveBeenCalledTimes(1);
    expect(registerDeviceMock).toHaveBeenCalledWith({
      expoPushToken: TOKEN,
      platform: 'Ios',
      appVersion: expect.any(String),
      deviceName: 'Test Phone',
    });
  });

  it('does not register while signed out, and registers after sign-in', async () => {
    await requestPushPermission();
    expect(registerDeviceMock).not.toHaveBeenCalled();

    await signedInSession();
    await registerPushToken();
    expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  });

  it('does not repeat the request for the same token within a launch', async () => {
    await signedInSession();
    usePrefsStore.getState().setPushToken(TOKEN);

    await registerPushToken();
    await registerPushToken();

    expect(registerDeviceMock).toHaveBeenCalledTimes(1);
  });

  it('survives a failing backend and tries again later', async () => {
    await signedInSession();
    usePrefsStore.getState().setPushToken(TOKEN);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    registerDeviceMock.mockRejectedValueOnce(new Error('503'));

    await expect(registerPushToken()).resolves.toBeUndefined();
    await registerPushToken();

    expect(registerDeviceMock).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  describe('cold start (syncPushRegistration)', () => {
    it('reads the token and registers it when the OS permission is already granted', async () => {
      await signedInSession();
      getPermissions.mockResolvedValue({ status: 'granted' } as never);

      await syncPushRegistration();

      expect(requestPermissions).not.toHaveBeenCalled();
      expect(usePrefsStore.getState().pushToken).toBe(TOKEN);
      expect(registerDeviceMock).toHaveBeenCalledTimes(1);
    });

    it('never prompts: nothing happens while the permission is undetermined or denied', async () => {
      await signedInSession();

      await syncPushRegistration();
      getPermissions.mockResolvedValue({ status: 'denied' } as never);
      await syncPushRegistration();

      expect(requestPermissions).not.toHaveBeenCalled();
      expect(registerDeviceMock).not.toHaveBeenCalled();
    });
  });

  describe('sign-out', () => {
    it('sends the push token in the logout body so the backend deactivates the device', async () => {
      await signedInSession();
      logoutMock.mockResolvedValue(undefined);
      usePrefsStore.getState().setPushToken(TOKEN);

      await signOut();

      expect(logoutMock).toHaveBeenCalledWith('refresh-old', TOKEN);
    });

    it('registers again for whoever signs in next', async () => {
      await signedInSession();
      logoutMock.mockResolvedValue(undefined);
      usePrefsStore.getState().setPushToken(TOKEN);
      await registerPushToken();
      await signOut();

      await signedInSession('new');
      await registerPushToken();

      expect(registerDeviceMock).toHaveBeenCalledTimes(2);
    });
  });
});

import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { registerDevice } from '@/api/endpoints/notifications';
import { usePrefsStore } from '@/session/prefsStore';
import { useSessionStore } from '@/session/sessionStore';
import { apiPlatform, appVersion } from '@/utils/appInfo';

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Push needs a physical device; simulators and emulators cannot receive remote notifications. */
function isSupported(): boolean {
  return Device.isDevice;
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!isSupported()) {
    return 'unavailable';
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

async function fetchExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: AndroidImportance.DEFAULT,
      });
    }
    const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      typeof projectId === 'string' ? { projectId } : undefined,
    );
    return token.data;
  } catch (error) {
    // No EAS project id yet, or the push service is unreachable: the app works without a token.
    if (__DEV__) {
      console.warn('[push] could not get an Expo push token', error);
    }
    return null;
  }
}

/**
 * Shows the OS permission prompt (only if the user has not decided yet). On grant it stores the Expo push token
 * in `prefsStore` and calls `registerPushToken()`. Call it from a contextual prompt, never on app start.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!isSupported()) {
    return 'unavailable';
  }
  const current = await getPushPermission();
  if (current === 'denied') {
    return current;
  }
  let status: PushPermission = current;
  if (current === 'undetermined') {
    const result = await Notifications.requestPermissionsAsync();
    status = result.status === 'granted' ? 'granted' : 'denied';
  }
  if (status === 'granted') {
    const token = await fetchExpoPushToken();
    usePrefsStore.getState().setPushToken(token);
    await registerPushToken();
  }
  return status;
}

/** The token the backend already knows from this launch, so a re-render or a second call does not repeat the request. */
let registeredToken: string | null = null;

/**
 * Hands the device's push token to the backend (`PUT /me/devices`, idempotent). Needs a token and a signed-in user;
 * best effort: a failure only means no push until the next launch registers again.
 */
export async function registerPushToken(): Promise<void> {
  const token = usePrefsStore.getState().pushToken;
  if (!token || useSessionStore.getState().status !== 'signedIn' || registeredToken === token) {
    return;
  }
  try {
    await registerDevice({
      expoPushToken: token,
      platform: apiPlatform(),
      appVersion: appVersion(),
      deviceName: Device.deviceName ?? null,
    });
    registeredToken = token;
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] could not register the device', error);
    }
  }
}

/** Forgets that the token was registered (sign-out): the next sign-in registers it again, for whoever signs in. */
export function resetPushRegistration(): void {
  registeredToken = null;
}

/**
 * Cold start / sign-in: when the OS permission is already granted, reads the Expo push token (no prompt) and registers
 * it. The token itself is not persisted; asking the OS for it again is cheap.
 */
export async function syncPushRegistration(): Promise<void> {
  if ((await getPushPermission()) !== 'granted') {
    return;
  }
  if (!usePrefsStore.getState().pushToken) {
    usePrefsStore.getState().setPushToken(await fetchExpoPushToken());
  }
  await registerPushToken();
}

/** Opens the OS settings page of the app: the only way to turn notifications back on after a denial. */
export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

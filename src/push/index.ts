import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { usePrefsStore } from '@/session/prefsStore';

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
    registerPushToken();
  }
  return status;
}

/**
 * Hands the device's push token to the backend.
 * TODO(backend): POST /me/devices { token, platform } once the endpoint exists. Until then this only logs in dev.
 */
export function registerPushToken(): void {
  const token = usePrefsStore.getState().pushToken;
  if (__DEV__) {
    console.log(
      token
        ? `[push] token ready, not registered (no backend endpoint yet): ${token.slice(0, 24)}…`
        : '[push] no push token to register',
    );
  }
}

/** Opens the OS settings page of the app: the only way to turn notifications back on after a denial. */
export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

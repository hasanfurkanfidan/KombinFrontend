import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** The platform names the backend's device and analytics contracts use. */
export type ApiPlatform = 'Ios' | 'Android';

export function apiPlatform(): ApiPlatform {
  return Platform.OS === 'ios' ? 'Ios' : 'Android';
}

/** The app's own version from `app.json`; the backend stores at most 40 characters of it. */
export function appVersion(): string {
  return (Constants.expoConfig?.version ?? '0.0.0').slice(0, 40);
}

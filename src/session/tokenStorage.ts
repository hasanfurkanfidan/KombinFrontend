import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'kombin.refreshToken';

/** The refresh token is the only credential persisted on the device, and only in the OS keystore. */
export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

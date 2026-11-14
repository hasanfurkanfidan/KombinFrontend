import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'kombin.refreshToken';
const SIGN_IN_METHOD_KEY = 'kombin.signInMethod';

/** How the user proved who they are: an e-mail and password, or a Google/Apple ID token. */
export type SignInMethod = 'password' | 'external';

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

/**
 * Not a credential, only a hint kept beside the refresh token: the contract has no "has a password" flag, and the
 * delete-account screen needs to know whether to ask for one.
 */
export async function getSignInMethod(): Promise<SignInMethod | null> {
  const value = await SecureStore.getItemAsync(SIGN_IN_METHOD_KEY);
  return value === 'password' || value === 'external' ? value : null;
}

export function setStoredSignInMethod(method: SignInMethod): Promise<void> {
  return SecureStore.setItemAsync(SIGN_IN_METHOD_KEY, method);
}

export function clearSignInMethod(): Promise<void> {
  return SecureStore.deleteItemAsync(SIGN_IN_METHOD_KEY);
}

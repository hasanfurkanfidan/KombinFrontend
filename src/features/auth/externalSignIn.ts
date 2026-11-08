import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getAnonymousId, track } from '@/analytics';
import { ApiError } from '@/api/client';
import { externalSignIn } from '@/api/endpoints/auth';
import type { ExternalSignInRequest } from '@/api/models';
import { tr } from '@/i18n/tr';
import { completeSignIn } from '@/session/useSession';

/**
 * Sign in with Google and Apple: the device obtains an ID token, `POST /auth/external` swaps it for our own tokens,
 * which are stored exactly like a password login's (`completeSignIn`, the same session store and refresh path).
 *
 * The two native modules are loaded with `require()` **inside** the functions (not dynamic `import()`, which Jest cannot run). A top-level import would crash Expo Go, the web
 * export and anything else without the native code the moment this file is loaded, even if nobody taps a button.
 */

export type ExternalProvider = 'google' | 'apple';

export interface ExternalSignInResult {
  provider: ExternalProvider;
  isNewUser: boolean;
}

/* eslint-disable @typescript-eslint/no-require-imports -- inline require() keeps the native modules out of module load; see above. */
function requireGoogle() {
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}

function requireApple() {
  return require('expo-apple-authentication') as typeof import('expo-apple-authentication');
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Expo Go has neither native module (and no way to add them): social sign-in only exists in a development build. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Whether the Google button can work here at all: a real native build, not Expo Go and not the web export. */
export function externalSignInSupported(): boolean {
  return Platform.OS !== 'web' && !isExpoGo();
}

/**
 * The Apple module when "Continue with Apple" can be shown, otherwise `null`: iOS only, never in Expo Go, and only
 * when the device says it can (`isAvailableAsync`).
 */
export async function loadAppleAuthentication(): Promise<
  typeof import('expo-apple-authentication') | null
> {
  if (Platform.OS !== 'ios' || !externalSignInSupported()) {
    return null;
  }
  try {
    const AppleAuthentication = requireApple();
    return (await AppleAuthentication.isAvailableAsync()) ? AppleAuthentication : null;
  } catch {
    return null;
  }
}

function errorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/** Google's `SIGN_IN_CANCELLED`, and `IN_PROGRESS` (a second tap while the sheet is open): nothing to tell the user. */
const GOOGLE_SILENT_CODES = new Set(['SIGN_IN_CANCELLED', 'IN_PROGRESS']);

async function exchange(
  body: ExternalSignInRequest,
  provider: ExternalProvider,
): Promise<ExternalSignInResult> {
  const tokens = await externalSignIn({
    ...body,
    deviceName: Device.deviceName ?? null,
    anonymousId: await getAnonymousId(),
  });
  await completeSignIn(tokens);
  track('auth_external', { provider, isNewUser: tokens.isNewUser });
  return { provider, isNewUser: tokens.isNewUser };
}

/** Resolves `null` when the user closed the Google sheet. */
export async function signInWithGoogle(): Promise<ExternalSignInResult | null> {
  const { GoogleSignin } = requireGoogle();
  let idToken: string | null;
  try {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      return null;
    }
    idToken = response.data.idToken;
  } catch (error) {
    const code = errorCode(error);
    if (code !== null && GOOGLE_SILENT_CODES.has(code)) {
      return null;
    }
    throw error;
  }
  if (!idToken) {
    throw new Error('Google returned no ID token');
  }
  return exchange({ provider: 'google', idToken }, 'google');
}

/** Resolves `null` when the user closed the Apple sheet. */
export async function signInWithApple(): Promise<ExternalSignInResult | null> {
  const AppleAuthentication = requireApple();
  let credential: Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if (errorCode(error) === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw error;
  }
  if (!credential.identityToken) {
    throw new Error('Apple returned no identity token');
  }
  // Apple hands over the name once, on the account's very first sign-in; the backend only uses it to create the account.
  const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return exchange(
    { provider: 'apple', idToken: credential.identityToken, displayName: displayName || null },
    'apple',
  );
}

/** Turkish copy for whatever went wrong after the user did pick an account. */
export function externalSignInMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case 'Identity.ExternalTokenInvalid':
        return tr.authExternalTokenInvalid;
      case 'Identity.ExternalEmailMissing':
        return tr.authExternalEmailMissing;
      case 'Identity.ExternalProviderDisabled':
        return tr.authExternalProviderDisabled;
      case 'Identity.ExternalProviderUnavailable':
        return tr.authExternalProviderUnavailable;
      default:
        return error.isNetworkError ? tr.errorNetwork : tr.authExternalFailed;
    }
  }
  return tr.authExternalFailed;
}

import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { ApiError } from '@/api/client';
import { externalSignIn } from '@/api/endpoints/auth';
import {
  externalSignInMessage,
  loadAppleAuthentication,
  signInWithApple,
  signInWithGoogle,
} from '@/features/auth/externalSignIn';
import { useSessionStore } from '@/session/sessionStore';

import { resetSession, tokens } from '../../testUtils';

jest.mock('@/api/endpoints/auth');

// Mutable stand-in: tests flip `appOwnership` to pretend to be Expo Go.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, expoConfig: { version: '1.0.0' } },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));

const externalSignInMock = jest.mocked(externalSignIn);
const google = jest.mocked(GoogleSignin);
const apple = jest.mocked(AppleAuthentication);
const constants = Constants as unknown as { appOwnership: string | null };

function nativeError(code: string) {
  return Object.assign(new Error(code), { code });
}

function apiError(errorCode: string, status = 401) {
  return new ApiError({ status, errorCode, correlationId: 'c' });
}

const originalPlatform = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  constants.appOwnership = null;
  Platform.OS = originalPlatform;
  google.hasPlayServices.mockResolvedValue(true);
  apple.isAvailableAsync.mockResolvedValue(true);
  externalSignInMock.mockResolvedValue({ ...tokens('g'), isNewUser: false });
});

afterAll(() => {
  Platform.OS = originalPlatform;
});

describe('signInWithGoogle', () => {
  it('configures Google from the env client ids, posts the ID token and stores the session', async () => {
    google.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-id-token' },
    } as never);
    externalSignInMock.mockResolvedValue({ ...tokens('g'), isNewUser: true });

    const result = await signInWithGoogle();

    expect(google.configure).toHaveBeenCalledWith({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    expect(google.hasPlayServices).toHaveBeenCalled();
    expect(externalSignInMock).toHaveBeenCalledWith({
      provider: 'google',
      idToken: 'google-id-token',
      deviceName: 'Test Phone',
      anonymousId: 'anon-test',
    });
    expect(result).toEqual({ provider: 'google', isNewUser: true });
    // Same storage as a password login.
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-g');
    expect(useSessionStore.getState().status).toBe('signedIn');
  });

  it('is silent when the user closes the sheet (cancelled response)', async () => {
    google.signIn.mockResolvedValue({ type: 'cancelled', data: null } as never);

    await expect(signInWithGoogle()).resolves.toBeNull();

    expect(externalSignInMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).not.toBe('signedIn');
  });

  it('is silent when Google rejects with SIGN_IN_CANCELLED', async () => {
    google.signIn.mockRejectedValue(nativeError('SIGN_IN_CANCELLED'));

    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(externalSignInMock).not.toHaveBeenCalled();
  });

  it('lets other native failures through', async () => {
    google.signIn.mockRejectedValue(nativeError('PLAY_SERVICES_NOT_AVAILABLE'));

    await expect(signInWithGoogle()).rejects.toThrow('PLAY_SERVICES_NOT_AVAILABLE');
  });

  it('fails when Google returns no ID token', async () => {
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: null } } as never);

    await expect(signInWithGoogle()).rejects.toThrow();
    expect(externalSignInMock).not.toHaveBeenCalled();
  });

  it('does not store a session when the backend refuses the token', async () => {
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 't' } } as never);
    externalSignInMock.mockRejectedValue(apiError('Identity.ExternalTokenInvalid'));

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(ApiError);
    expect(useSessionStore.getState().status).not.toBe('signedIn');
  });
});

describe('signInWithApple', () => {
  it('asks for name and e-mail, and sends the identity token with the one-time name', async () => {
    apple.signInAsync.mockResolvedValue({
      identityToken: 'apple-identity-token',
      fullName: { givenName: 'Ayşe', familyName: 'Yılmaz' },
    } as never);
    externalSignInMock.mockResolvedValue({ ...tokens('a'), isNewUser: true });

    const result = await signInWithApple();

    expect(apple.signInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1] });
    expect(externalSignInMock).toHaveBeenCalledWith({
      provider: 'apple',
      idToken: 'apple-identity-token',
      displayName: 'Ayşe Yılmaz',
      deviceName: 'Test Phone',
      anonymousId: 'anon-test',
    });
    expect(result).toEqual({ provider: 'apple', isNewUser: true });
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-a');
  });

  it('sends no display name when Apple does not give one (every sign-in after the first)', async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: 'tok', fullName: null } as never);

    await signInWithApple();

    expect(externalSignInMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple', displayName: null }),
    );
  });

  it('is silent on ERR_REQUEST_CANCELED', async () => {
    apple.signInAsync.mockRejectedValue(nativeError('ERR_REQUEST_CANCELED'));

    await expect(signInWithApple()).resolves.toBeNull();
    expect(externalSignInMock).not.toHaveBeenCalled();
  });

  it('lets other failures through', async () => {
    apple.signInAsync.mockRejectedValue(nativeError('ERR_REQUEST_FAILED'));

    await expect(signInWithApple()).rejects.toThrow('ERR_REQUEST_FAILED');
  });
});

describe('loadAppleAuthentication', () => {
  it('returns the module on an iOS device that supports Apple sign-in', async () => {
    Platform.OS = 'ios';

    await expect(loadAppleAuthentication()).resolves.toMatchObject({
      signInAsync: apple.signInAsync,
    });
  });

  it('is null on Android', async () => {
    Platform.OS = 'android';

    await expect(loadAppleAuthentication()).resolves.toBeNull();
    expect(apple.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('is null in Expo Go', async () => {
    Platform.OS = 'ios';
    constants.appOwnership = 'expo';

    await expect(loadAppleAuthentication()).resolves.toBeNull();
    expect(apple.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('is null when the device says Apple sign-in is unavailable', async () => {
    Platform.OS = 'ios';
    apple.isAvailableAsync.mockResolvedValue(false);

    await expect(loadAppleAuthentication()).resolves.toBeNull();
  });
});

describe('externalSignInMessage', () => {
  it.each([
    ['Identity.ExternalTokenInvalid', 'Giriş doğrulanamadı. Lütfen tekrar dene.'],
    [
      'Identity.ExternalEmailMissing',
      'Hesabından e-posta adresi alınamadı. E-posta ile hesap oluşturarak devam edebilirsin.',
    ],
    ['Identity.ExternalProviderDisabled', 'Bu giriş yöntemi şu an kullanılamıyor.'],
    [
      'Identity.ExternalProviderUnavailable',
      'Giriş servisine şu an ulaşılamıyor. Biraz sonra tekrar dene.',
    ],
  ])('maps %s to Turkish copy', (code, message) => {
    expect(externalSignInMessage(apiError(code))).toBe(message);
  });

  it('falls back to a generic message for unknown codes and native errors', () => {
    expect(externalSignInMessage(apiError('Something.Else', 500))).toBe(
      'Giriş tamamlanamadı. Lütfen tekrar dene.',
    );
    expect(externalSignInMessage(new Error('boom'))).toBe(
      'Giriş tamamlanamadı. Lütfen tekrar dene.',
    );
  });

  it('tells the user when the server could not be reached', () => {
    expect(externalSignInMessage(apiError('', 0))).toBe(
      'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',
    );
  });
});

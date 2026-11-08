import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { ApiError } from '@/api/client';
import { externalSignIn } from '@/api/endpoints/auth';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { RegisterScreen } from '@/features/auth/RegisterScreen';
import { useSessionStore } from '@/session/sessionStore';

import { renderWithQuery, resetSession, tokens } from '../../testUtils';

jest.mock('@/api/endpoints/auth');

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, expoConfig: { version: '1.0.0' } },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));

jest.mock('expo-apple-authentication', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return {
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { BLACK: 2 },
    AppleAuthenticationButton: (props: { onPress: () => void }) =>
      createElement(Pressable, { testID: 'apple-button', onPress: props.onPress }),
    isAvailableAsync: jest.fn(),
    signInAsync: jest.fn(),
  };
});

const externalSignInMock = jest.mocked(externalSignIn);
const google = jest.mocked(GoogleSignin);
const apple = jest.mocked(AppleAuthentication);
const constants = Constants as unknown as { appOwnership: string | null };
const originalPlatform = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  constants.appOwnership = null;
  Platform.OS = 'ios';
  google.hasPlayServices.mockResolvedValue(true);
  google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'g-token' } } as never);
  apple.isAvailableAsync.mockResolvedValue(true);
  externalSignInMock.mockResolvedValue({ ...tokens('g'), isNewUser: false });
});

afterAll(() => {
  Platform.OS = originalPlatform;
});

describe('social sign-in buttons', () => {
  it('shows Google, Apple and the "veya" divider above the e-mail form on iOS', async () => {
    await renderWithQuery(<LoginScreen />);

    expect(screen.getByText('Google ile devam et')).toBeTruthy();
    expect(await screen.findByTestId('apple-button')).toBeTruthy();
    expect(screen.getByText('veya')).toBeTruthy();
    expect(screen.getByTestId('login-email')).toBeTruthy();
  });

  it('shows them on the register screen too', async () => {
    await renderWithQuery(<RegisterScreen />);

    expect(screen.getByText('Google ile devam et')).toBeTruthy();
    expect(await screen.findByTestId('apple-button')).toBeTruthy();
    expect(screen.getByText('veya')).toBeTruthy();
  });

  it('hides the Apple button on Android but keeps Google', async () => {
    Platform.OS = 'android';
    await renderWithQuery(<LoginScreen />);

    expect(screen.getByText('Google ile devam et')).toBeTruthy();
    await waitFor(() => expect(apple.isAvailableAsync).not.toHaveBeenCalled());
    expect(screen.queryByTestId('apple-button')).toBeNull();
  });

  it('hides the Apple button when the device cannot do Apple sign-in', async () => {
    apple.isAvailableAsync.mockResolvedValue(false);
    await renderWithQuery(<LoginScreen />);

    await waitFor(() => expect(apple.isAvailableAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('apple-button')).toBeNull();
    expect(screen.getByText('Google ile devam et')).toBeTruthy();
  });

  it('hides every social button and the divider in Expo Go, leaving the e-mail form', async () => {
    constants.appOwnership = 'expo';
    await renderWithQuery(<LoginScreen />);

    expect(screen.queryByText('Google ile devam et')).toBeNull();
    expect(screen.queryByTestId('apple-button')).toBeNull();
    expect(screen.queryByText('veya')).toBeNull();
    expect(screen.getByTestId('login-email')).toBeTruthy();
    expect(apple.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('signs in with Google and leaves the auth screens (existing user)', async () => {
    await renderWithQuery(<LoginScreen />);

    await fireEvent.press(screen.getByTestId('external-google'));

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(useSessionStore.getState().status).toBe('signedIn');
  });

  it('sends a new user the same way registration does: back to the tabs, where the onboarding gate takes over', async () => {
    externalSignInMock.mockResolvedValue({ ...tokens('n'), isNewUser: true });
    await renderWithQuery(<RegisterScreen />);

    await fireEvent.press(screen.getByTestId('external-google'));

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(router.replace).not.toHaveBeenCalledWith('/audience');
  });

  it('signs in with Apple through the Apple button', async () => {
    apple.signInAsync.mockResolvedValue({
      identityToken: 'a-token',
      fullName: { givenName: 'Ayşe', familyName: null },
    } as never);
    await renderWithQuery(<LoginScreen />);

    await fireEvent.press(await screen.findByTestId('apple-button'));

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(externalSignInMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple', idToken: 'a-token', displayName: 'Ayşe' }),
    );
  });

  it('shows no error and stays on the screen when the user cancels', async () => {
    google.signIn.mockResolvedValue({ type: 'cancelled', data: null } as never);
    await renderWithQuery(<LoginScreen />);

    await fireEvent.press(screen.getByTestId('external-google'));

    await waitFor(() => expect(google.signIn).toHaveBeenCalled());
    expect(screen.queryByTestId('external-error')).toBeNull();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(externalSignInMock).not.toHaveBeenCalled();
  });

  it('shows the Turkish message for a backend error code', async () => {
    externalSignInMock.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: 'Identity.ExternalProviderDisabled',
        correlationId: 'c',
      }),
    );
    await renderWithQuery(<LoginScreen />);

    await fireEvent.press(screen.getByTestId('external-google'));

    expect(await screen.findByText('Bu giriş yöntemi şu an kullanılamıyor.')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).not.toBe('signedIn');
  });
});

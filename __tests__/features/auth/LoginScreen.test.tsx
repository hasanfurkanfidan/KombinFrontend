import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { login } from '@/api/endpoints/auth';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { useSessionStore } from '@/session/sessionStore';

import { renderWithQuery, resetSession, tokens } from '../../testUtils';

jest.mock('@/api/endpoints/auth');

const loginMock = jest.mocked(login);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('login-email'), email);
  await fireEvent.changeText(screen.getByTestId('login-password'), password);
  await fireEvent.press(screen.getByTestId('login-submit'));
}

describe('LoginScreen', () => {
  it('renders the form', async () => {
    await renderWithQuery(<LoginScreen />);

    expect(screen.getByText('Tekrar hoş geldin')).toBeTruthy();
    expect(screen.getByText('E-posta')).toBeTruthy();
    expect(screen.getByText('Şifre')).toBeTruthy();
    expect(screen.getByText('Hesap oluştur')).toBeTruthy();
  });

  it('validates in Turkish before calling the API', async () => {
    await renderWithQuery(<LoginScreen />);

    await fill('not-an-email', '');

    expect(await screen.findByText('Geçerli bir e-posta adresi gir')).toBeTruthy();
    expect(screen.getByText('Şifreni gir')).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('stores the session and leaves the auth screens on success', async () => {
    loginMock.mockResolvedValue(tokens('a'));
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'sifre1234');

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    // The device's analytics id travels with the credentials so pre-login events join the user.
    expect(loginMock).toHaveBeenCalledWith({
      email: 'ayse@example.com',
      password: 'sifre1234',
      anonymousId: expect.any(String),
    });
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-a');
    expect(useSessionStore.getState().status).toBe('signedIn');
  });

  it('shows a form-level error for Identity.InvalidCredentials', async () => {
    loginMock.mockRejectedValue(
      new ApiError({ status: 401, errorCode: 'Identity.InvalidCredentials', correlationId: 'c' }),
    );
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'wrongpass1');

    expect(await screen.findByText('E-posta veya şifre hatalı')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});

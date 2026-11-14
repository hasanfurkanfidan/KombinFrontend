import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { login } from '@/api/endpoints/auth';
import { getLegal } from '@/api/endpoints/legal';
import { queryClient } from '@/api/queryClient';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { useSessionStore } from '@/session/sessionStore';

import { renderWithQuery, resetSession, tokens } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/legal');

const loginMock = jest.mocked(login);

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  await resetSession();
});

const LEGAL = {
  version: '1',
  privacyUrl: 'https://kombin.test/legal/privacy',
  termsUrl: 'https://kombin.test/legal/terms',
  deleteAccountUrl: 'https://kombin.test/legal/delete-account',
};

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
  it('says the account is closed, with the support contact when /legal has one', async () => {
    jest.mocked(getLegal).mockResolvedValue({ ...LEGAL, contactEmail: 'destek@kombin.test' });
    loginMock.mockRejectedValue(
      new ApiError({ status: 403, errorCode: 'Identity.AccountDisabled', correlationId: 'c' }),
    );
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'sifre1234');

    expect(
      await screen.findByText('Bu hesap kapatıldı. Destek için destek@kombin.test'),
    ).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).not.toBe('signedIn');
  });

  it('leaves out the second sentence when /legal has no contact', async () => {
    jest.mocked(getLegal).mockResolvedValue(LEGAL);
    loginMock.mockRejectedValue(
      new ApiError({ status: 403, errorCode: 'Identity.AccountDisabled', correlationId: 'c' }),
    );
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'sifre1234');

    expect(await screen.findByText('Bu hesap kapatıldı.')).toBeTruthy();
  });

  it('still says the account is closed when /legal cannot be fetched', async () => {
    jest.mocked(getLegal).mockRejectedValue(new Error('offline'));
    loginMock.mockRejectedValue(
      new ApiError({ status: 403, errorCode: 'Identity.AccountDisabled', correlationId: 'c' }),
    );
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'sifre1234');

    expect(await screen.findByText('Bu hesap kapatıldı.')).toBeTruthy();
  });

  it('shows the rate-limit sentence in seconds under a minute', async () => {
    loginMock.mockRejectedValue(
      new ApiError({
        status: 429,
        errorCode: 'RateLimited',
        retryAfterSeconds: 45,
        correlationId: 'c',
      }),
    );
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'sifre1234');

    expect(
      await screen.findByText('Çok fazla deneme yaptın. 45 saniye sonra tekrar dene.'),
    ).toBeTruthy();
  });

  it('remembers that this session was opened with a password', async () => {
    loginMock.mockResolvedValue(tokens('a'));
    await renderWithQuery(<LoginScreen />);

    await fill('ayse@example.com', 'sifre1234');

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(useSessionStore.getState().signInMethod).toBe('password');
    expect(await SecureStore.getItemAsync('kombin.signInMethod')).toBe('password');
  });
});

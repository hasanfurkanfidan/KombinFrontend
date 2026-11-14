import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { cancelDeletion, login } from '@/api/endpoints/auth';
import { getLegal } from '@/api/endpoints/legal';
import { queryClient } from '@/api/queryClient';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { PendingDeletionScreen } from '@/features/auth/PendingDeletionScreen';
import { usePendingDeletionStore } from '@/features/auth/pendingDeletion';
import { useSessionStore } from '@/session/sessionStore';

import { renderWithQuery, resetSession, tokens } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/legal');

const loginMock = jest.mocked(login);
const cancelMock = jest.mocked(cancelDeletion);
const legalMock = jest.mocked(getLegal);

const LEGAL = {
  version: '1',
  privacyUrl: 'https://kombin.test/legal/privacy',
  termsUrl: 'https://kombin.test/legal/terms',
  deleteAccountUrl: 'https://kombin.test/legal/delete-account',
};

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  usePendingDeletionStore.getState().clear();
  await resetSession();
  legalMock.mockResolvedValue(LEGAL);
});

const pending = (scheduledFor = '2026-11-21T12:00:00Z') =>
  new ApiError({
    status: 403,
    errorCode: 'Identity.AccountPendingDeletion',
    deletionScheduledFor: scheduledFor,
    correlationId: 'c',
  });

describe('login answering AccountPendingDeletion', () => {
  it('opens the pending screen with the credentials in memory and signs nobody in', async () => {
    loginMock.mockRejectedValue(pending());
    await renderWithQuery(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'ayse@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'sifre1234');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/pending-deletion'));
    expect(usePendingDeletionStore.getState()).toMatchObject({
      scheduledFor: '2026-11-21T12:00:00Z',
      credentials: { kind: 'password', email: 'ayse@example.com', password: 'sifre1234' },
    });
    expect(useSessionStore.getState().status).not.toBe('signedIn');
    expect(cancelMock).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });
});

describe('PendingDeletionScreen', () => {
  const begin = () =>
    usePendingDeletionStore.getState().begin('2026-11-21T12:00:00Z', {
      kind: 'password',
      email: 'ayse@example.com',
      password: 'sifre1234',
    });

  it('shows the date, one primary action and a quiet way out, and cancels nothing on its own', async () => {
    begin();
    await renderWithQuery(<PendingDeletionScreen />);

    expect(screen.getByText('Hesabın 21 Kasım 2026 tarihinde silinecek')).toBeTruthy();
    expect(screen.getByText('Silmeyi iptal et ve giriş yap')).toBeTruthy();
    expect(screen.getByText('Vazgeç')).toBeTruthy();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('cancels with the same credentials and continues as a normal sign-in', async () => {
    begin();
    cancelMock.mockResolvedValue(tokens('c'));
    await renderWithQuery(<PendingDeletionScreen />);

    await fireEvent.press(screen.getByTestId('pending-cancel'));

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(cancelMock).toHaveBeenCalledWith({
      email: 'ayse@example.com',
      password: 'sifre1234',
      deviceName: 'Test Phone',
      anonymousId: 'anon-test',
    });
    expect(useSessionStore.getState().status).toBe('signedIn');
    expect(useSessionStore.getState().signInMethod).toBe('password');
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-c');
    expect(usePendingDeletionStore.getState().credentials).toBeNull();
  });

  it('sends the ID token of a Google or Apple sign-in instead of a password', async () => {
    usePendingDeletionStore
      .getState()
      .begin('2026-11-21T12:00:00Z', { kind: 'external', provider: 'google', idToken: 'idt' });
    cancelMock.mockResolvedValue(tokens('g'));
    await renderWithQuery(<PendingDeletionScreen />);

    await fireEvent.press(screen.getByTestId('pending-cancel'));

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(cancelMock).toHaveBeenCalledWith({
      provider: 'google',
      idToken: 'idt',
      deviceName: 'Test Phone',
      anonymousId: 'anon-test',
    });
    expect(useSessionStore.getState().signInMethod).toBe('external');
  });

  it('"Vazgeç" forgets the credentials and goes back without calling the API', async () => {
    begin();
    await renderWithQuery(<PendingDeletionScreen />);

    await fireEvent.press(screen.getByTestId('pending-dismiss'));

    expect(router.back).toHaveBeenCalled();
    expect(usePendingDeletionStore.getState().credentials).toBeNull();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('keeps the screen and says so when the cancel fails', async () => {
    begin();
    cancelMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Identity.NotPendingDeletion', correlationId: 'c' }),
    );
    await renderWithQuery(<PendingDeletionScreen />);

    await fireEvent.press(screen.getByTestId('pending-cancel'));

    expect(await screen.findByText('Silme iptal edilemedi. Lütfen tekrar dene.')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).not.toBe('signedIn');
  });

  it('sends a screen opened without a sign-in attempt to the login screen', async () => {
    await renderWithQuery(<PendingDeletionScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
});

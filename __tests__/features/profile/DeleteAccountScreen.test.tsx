import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { deleteAccount, logout } from '@/api/endpoints/auth';
import { useToastStore } from '@/components/toastStore';
import { matchesDeleteWord } from '@/features/profile/deleteAccount';
import { DeleteAccountScreen } from '@/features/profile/DeleteAccountScreen';
import { useSessionStore } from '@/session/sessionStore';

import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');

const deleteMock = jest.mocked(deleteAccount);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  useSessionStore.getState().setSignInMethod('password');
  useToastStore.getState().hide();
});

const enabled = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.disabled !== true;

describe('matchesDeleteWord', () => {
  it.each(['SİL', 'sil', 'SIL', 'Sil', ' sil ', 'sıl'])('accepts %j', (text) => {
    expect(matchesDeleteWord(text)).toBe(true);
  });

  it.each(['', 'si', 'sill', 'sol', 'SİLL', 'sil me'])('rejects %j', (text) => {
    expect(matchesDeleteWord(text)).toBe(false);
  });
});

describe('DeleteAccountScreen', () => {
  it('says what happens and keeps the danger button off until the word is typed', async () => {
    await renderWithQuery(<DeleteAccountScreen />);

    expect(screen.getByText(/7 gün sonra tamamen silinir/)).toBeTruthy();
    expect(screen.getByText('Paylaşımların hemen herkese gizlenir.')).toBeTruthy();
    expect(screen.getByText(/silmeyi iptal edebilirsin/)).toBeTruthy();
    expect(enabled('delete-submit')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('delete-password'), 'sifre1234');
    await fireEvent.changeText(screen.getByTestId('delete-word'), 'SI');
    expect(enabled('delete-submit')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('delete-word'), 'SİL');
    expect(enabled('delete-submit')).toBe(true);
    expect(screen.getByText('Hesabımı kalıcı olarak sil')).toBeTruthy();
  });

  it('asks for the password of a password account and needs it before the button works', async () => {
    await renderWithQuery(<DeleteAccountScreen />);

    await fireEvent.changeText(screen.getByTestId('delete-word'), 'SİL');

    expect(screen.getByTestId('delete-password')).toBeTruthy();
    expect(enabled('delete-submit')).toBe(false);
    await fireEvent.press(screen.getByTestId('delete-submit'));
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('skips the password for a Google or Apple account', async () => {
    useSessionStore.getState().setSignInMethod('external');
    deleteMock.mockResolvedValue({
      deletionRequestedAt: '2026-11-14T10:00:00Z',
      deletionScheduledFor: '2026-11-21T10:00:00Z',
    });
    await renderWithQuery(<DeleteAccountScreen />);

    expect(screen.queryByTestId('delete-password')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('delete-word'), 'sil');
    await fireEvent.press(screen.getByTestId('delete-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(deleteMock).toHaveBeenCalledWith({ password: null, confirm: 'SİL' });
  });

  it('clears the session like a logout and lands on login with the date in a toast', async () => {
    deleteMock.mockResolvedValue({
      deletionRequestedAt: '2026-11-14T12:00:00Z',
      deletionScheduledFor: '2026-11-21T12:00:00Z',
    });
    await renderWithQuery(<DeleteAccountScreen />);

    await fireEvent.changeText(screen.getByTestId('delete-word'), 'SİL');
    await fireEvent.changeText(screen.getByTestId('delete-password'), 'sifre1234');
    await fireEvent.press(screen.getByTestId('delete-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(deleteMock).toHaveBeenCalledWith({ password: 'sifre1234', confirm: 'SİL' });
    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
    expect(await SecureStore.getItemAsync('kombin.signInMethod')).toBeNull();
    expect(useToastStore.getState().message).toBe('Hesabın 21 Kasım 2026 tarihinde silinecek');
    // The server ended every session itself: there is no token left to log out with.
    expect(jest.mocked(logout)).not.toHaveBeenCalled();
  });

  it.each(['Identity.InvalidCredentials', 'Identity.PasswordIncorrect'])(
    'puts %s on the password field and keeps the session',
    async (errorCode) => {
      deleteMock.mockRejectedValue(new ApiError({ status: 403, errorCode, correlationId: 'c' }));
      await renderWithQuery(<DeleteAccountScreen />);

      await fireEvent.changeText(screen.getByTestId('delete-word'), 'SİL');
      await fireEvent.changeText(screen.getByTestId('delete-password'), 'yanlis123');
      await fireEvent.press(screen.getByTestId('delete-submit'));

      expect(await screen.findByText('Şifre hatalı')).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
      expect(useSessionStore.getState().status).toBe('signedIn');
    },
  );

  it('shows the rate-limit sentence with minutes', async () => {
    deleteMock.mockRejectedValue(
      new ApiError({
        status: 429,
        errorCode: 'RateLimited',
        retryAfterSeconds: 130,
        correlationId: 'c',
      }),
    );
    await renderWithQuery(<DeleteAccountScreen />);

    await fireEvent.changeText(screen.getByTestId('delete-word'), 'SİL');
    await fireEvent.changeText(screen.getByTestId('delete-password'), 'sifre1234');
    await fireEvent.press(screen.getByTestId('delete-submit'));

    expect(
      await screen.findByText('Çok fazla deneme yaptın. 3 dakika sonra tekrar dene.'),
    ).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('signedIn');
  });
});

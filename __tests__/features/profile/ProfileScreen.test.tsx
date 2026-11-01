import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { getMe, logout } from '@/api/endpoints/auth';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { useSessionStore } from '@/session/sessionStore';

import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');

const getMeMock = jest.mocked(getMe);
const logoutMock = jest.mocked(logout);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
});

describe('ProfileScreen', () => {
  it('offers sign-in when logged out', async () => {
    useSessionStore.getState().setSignedOut();

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-sign-in'));

    expect(screen.getAllByText('Giriş yap').length).toBeGreaterThan(0);
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it('shows /me when signed in', async () => {
    await signedInSession();
    getMeMock.mockResolvedValue({
      id: 'u1',
      email: 'ayse@example.com',
      displayName: 'Ayşe Yılmaz',
      createdAt: '2026-11-01T10:00:00',
    });

    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByText('Ayşe Yılmaz')).toBeTruthy();
    expect(screen.getByText('ayse@example.com')).toBeTruthy();
    expect(screen.getByText('Üyelik: Kasım 2026')).toBeTruthy();
  });

  it('logs out with the refresh token and falls back to the logged-out view', async () => {
    await signedInSession();
    getMeMock.mockResolvedValue({
      id: 'u1',
      email: 'ayse@example.com',
      displayName: 'Ayşe Yılmaz',
      createdAt: '2026-11-01T10:00:00',
    });
    logoutMock.mockResolvedValue(undefined);

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('profile-sign-out'));

    await waitFor(() => expect(screen.getByTestId('profile-sign-in')).toBeTruthy());
    expect(logoutMock).toHaveBeenCalledWith('refresh-old');
    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });

  it('still signs out locally when the server cannot be reached', async () => {
    await signedInSession();
    getMeMock.mockResolvedValue({
      id: 'u1',
      email: 'a@b.co',
      displayName: 'Ayşe',
      createdAt: '2026-11-01T10:00:00',
    });
    logoutMock.mockRejectedValue(new Error('offline'));

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('profile-sign-out'));

    await waitFor(() => expect(screen.getByTestId('profile-sign-in')).toBeTruthy());
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });
});

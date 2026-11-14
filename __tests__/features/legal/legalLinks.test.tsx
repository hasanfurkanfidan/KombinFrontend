import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { getMe } from '@/api/endpoints/auth';
import { getLegal } from '@/api/endpoints/legal';
import { listSavedIds } from '@/api/endpoints/engagement';
import { getProfile, listPersonas, listSizes } from '@/api/endpoints/profile';
import { getCreatorStats } from '@/api/endpoints/social';
import { queryClient } from '@/api/queryClient';
import { useToastStore } from '@/components/toastStore';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { useSessionStore } from '@/session/sessionStore';

import { profile } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/social');
jest.mock('@/api/endpoints/legal');

const LEGAL = {
  version: '1',
  privacyUrl: 'https://kombin.test/legal/privacy',
  termsUrl: 'https://kombin.test/legal/terms',
  deleteAccountUrl: 'https://kombin.test/legal/delete-account',
};

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  await resetSession();
  useToastStore.getState().hide();
  jest.mocked(getLegal).mockResolvedValue(LEGAL);
  jest.mocked(getMe).mockResolvedValue({
    id: 'u1',
    email: 'ayse@example.com',
    displayName: 'Ayşe Yılmaz',
    createdAt: '2026-11-01T10:00:00',
  });
  jest.mocked(getProfile).mockResolvedValue(profile({ personaCount: 0 }));
  jest.mocked(listPersonas).mockResolvedValue({ items: [] });
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
  jest.mocked(listSizes).mockResolvedValue({ items: [] });
  jest.mocked(getCreatorStats).mockRejectedValue(new Error('not a creator'));
});

describe('Profil "Hesap" section', () => {
  it('shows only the two legal pages when signed out, and opens them from the backend URLs', async () => {
    useSessionStore.getState().setSignedOut();
    await renderWithQuery(<ProfileScreen />);

    expect(screen.getByText('Hesap')).toBeTruthy();
    expect(screen.queryByTestId('profile-sign-out')).toBeNull();
    expect(screen.queryByTestId('profile-delete-account')).toBeNull();

    await fireEvent.press(screen.getByText('Gizlilik politikası'));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(LEGAL.privacyUrl));
    await fireEvent.press(screen.getByText('Kullanım şartları'));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(LEGAL.termsUrl));
  });

  it('shows the legal pages, "Çıkış yap" and a quiet "Hesabımı sil" when signed in', async () => {
    await signedInSession();
    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByTestId('profile-privacy')).toBeTruthy();
    expect(screen.getByTestId('profile-terms')).toBeTruthy();
    expect(screen.getByTestId('profile-sign-out')).toBeTruthy();
    expect(screen.getByText('Çıkış yap')).toBeTruthy();
    expect(screen.getByText('Hesabımı sil')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('profile-delete-account'));
    expect(router.push).toHaveBeenCalledWith('/profile/delete-account');
  });

  it('says so with a toast when the legal pages cannot be fetched', async () => {
    jest.mocked(getLegal).mockRejectedValue(new Error('offline'));
    useSessionStore.getState().setSignedOut();
    await renderWithQuery(<ProfileScreen />);

    await fireEvent.press(screen.getByText('Gizlilik politikası'));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe(
        'Sayfa şu an açılamadı. Biraz sonra tekrar dene.',
      ),
    );
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});

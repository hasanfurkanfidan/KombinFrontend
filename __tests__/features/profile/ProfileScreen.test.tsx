import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { getMe, logout } from '@/api/endpoints/auth';
import { listSavedIds } from '@/api/endpoints/engagement';
import { getLeagueMe } from '@/api/endpoints/league';
import {
  activatePersona,
  archivePersona,
  getProfile,
  listPersonas,
  listSizes,
  updatePersona,
} from '@/api/endpoints/profile';
import { ApiError } from '@/api/client';
import { getCreatorStats } from '@/api/endpoints/social';
import {
  isErrorReportingAvailable,
  setErrorReportingEnabled,
  useErrorReportingStore,
} from '@/errorReporting';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { useSessionStore } from '@/session/sessionStore';
import { theme } from '@/theme';

import { persona, profile, sizeEntry } from '../../fixtures';
import { HIDDEN } from '../../a11y/support';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { leagueMe, notJoined } from '../league/fixtures';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/social');
// The real store and hook; availability and the setter are controlled per test (no DSN under Jest).
jest.mock('@/errorReporting', () => ({
  ...jest.requireActual('@/errorReporting'),
  isErrorReportingAvailable: jest.fn(() => false),
  setErrorReportingEnabled: jest.fn(() => Promise.resolve()),
}));

const getMeMock = jest.mocked(getMe);
const logoutMock = jest.mocked(logout);
const listPersonasMock = jest.mocked(listPersonas);

const me = {
  id: 'u1',
  email: 'ayse@example.com',
  displayName: 'Ayşe Yılmaz',
  createdAt: '2026-11-01T10:00:00',
};

const ofis = persona({ id: 'pe1', name: 'Ofis', isActive: true });
const hafta = persona({
  id: 'pe2',
  name: 'Hafta sonu',
  isActive: false,
  budgetMin: 300,
  budgetMax: null,
  styleSummary: {
    confidence: 0.5,
    likeCount: 4,
    topColors: ['Blue', 'Beige'],
    formalityMean: 2,
    topFamilies: ['Sporty'],
  },
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  // No league unless a test says so (the server has it switched off by default).
  jest.mocked(getLeagueMe).mockResolvedValue(null);
  getMeMock.mockResolvedValue(me);
  // Not a creator unless a test says so.
  jest
    .mocked(getCreatorStats)
    .mockRejectedValue(
      new ApiError({ status: 403, errorCode: 'Social.NotACreator', correlationId: 'c' }),
    );
  jest.mocked(getProfile).mockResolvedValue(profile({ personaCount: 2 }));
  listPersonasMock.mockResolvedValue({ items: [ofis, hafta] });
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: ['p1', 'p2', 'p3'] });
  jest.mocked(listSizes).mockResolvedValue({
    items: [
      sizeEntry({ id: '1' }),
      sizeEntry({ id: '2', group: 'Shoes', size: '43' }),
      sizeEntry({ id: '3', brand: { id: 'b2', name: 'Zara', slug: 'zara' } }),
    ],
  });
});

describe('ProfileScreen', () => {
  it('offers sign-in when logged out', async () => {
    useSessionStore.getState().setSignedOut();

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-sign-in'));

    expect(screen.getAllByText('Giriş yap').length).toBeGreaterThan(0);
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(getMeMock).not.toHaveBeenCalled();
    expect(listPersonasMock).not.toHaveBeenCalled();
  });

  it('shows /me with an avatar initial and the persona and saved counts', async () => {
    await signedInSession();

    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByText('Ayşe Yılmaz')).toBeTruthy();
    expect(screen.getByText('A', HIDDEN)).toBeTruthy();
    // The initial sits on the `surface` circle (it used to be `bg`, i.e. no circle at all).
    const avatar = screen.getByTestId('profile-avatar', HIDDEN).props.style as object | object[];
    const avatarStyle = Object.assign(
      {},
      ...(Array.isArray(avatar) ? avatar.flat(Infinity) : [avatar]),
    );
    expect(avatarStyle.backgroundColor).toBe(theme.colors.surface);
    expect(avatarStyle.width).toBe(theme.sizes.avatar);
    expect(screen.getByText('ayse@example.com')).toBeTruthy();
    expect(screen.getByText('Üyelik: Kasım 2026')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('profile-summary').props.children).toBe('2 tarz · 3 kayıtlı ürün'),
    );
  });

  it('logs out with the refresh token and falls back to the logged-out view', async () => {
    await signedInSession();
    logoutMock.mockResolvedValue(undefined);

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('profile-sign-out'));

    await waitFor(() => expect(screen.getByTestId('profile-sign-in')).toBeTruthy());
    expect(logoutMock).toHaveBeenCalledWith('refresh-old', null);
    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });

  it('still signs out locally when the server cannot be reached', async () => {
    await signedInSession();
    logoutMock.mockRejectedValue(new Error('offline'));

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('profile-sign-out'));

    await waitFor(() => expect(screen.getByTestId('profile-sign-in')).toBeTruthy());
    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
  });
});

describe('Tarzlarım', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('lists the personas with captions, the budget range and an "Aktif" pill on the active one', async () => {
    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByText('Ofis')).toBeTruthy();
    expect(screen.getByText('Minimal, Klasik · 800–2.500 ₺')).toBeTruthy();
    expect(screen.getByText('Hafta sonu')).toBeTruthy();
    expect(screen.getByText('Sportif · 300 ₺ üzeri')).toBeTruthy();
    expect(screen.getAllByText('Seçili')).toHaveLength(1);
  });

  it('opens the new-persona flow from the dashed row, returning to the profile', async () => {
    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('profile-new-persona'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/persona',
      params: { flow: 'new', returnTo: '/profile' },
    });
  });

  it('hides the dashed row at the limit of 6 personas', async () => {
    listPersonasMock.mockResolvedValue({
      items: Array.from({ length: 6 }, (_, index) =>
        persona({ id: `p${index}`, name: `Tarz ${index}`, isActive: index === 0 }),
      ),
    });

    await renderWithQuery(<ProfileScreen />);
    await screen.findByText('Tarz 5');

    expect(screen.queryByTestId('profile-new-persona')).toBeNull();
  });

  it('activates a persona from its sheet', async () => {
    jest.mocked(activatePersona).mockResolvedValue(undefined);

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('persona-row-pe2'));
    await fireEvent.press(await screen.findByTestId('persona-sheet-activate'));

    await waitFor(() => expect(activatePersona).toHaveBeenCalledWith('pe2'));
  });

  it('has no "activate" action for the active persona', async () => {
    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('persona-row-pe1'));

    expect(await screen.findByTestId('persona-sheet-rename')).toBeTruthy();
    expect(screen.queryByTestId('persona-sheet-activate')).toBeNull();
  });

  it('renames a persona', async () => {
    jest.mocked(updatePersona).mockResolvedValue({ ...hafta, name: 'Cumartesi' });

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('persona-row-pe2'));
    await fireEvent.press(await screen.findByTestId('persona-sheet-rename'));
    await fireEvent.changeText(screen.getByTestId('persona-rename-input'), 'Cumartesi');
    await fireEvent.press(screen.getByTestId('persona-rename-save'));

    await waitFor(() => expect(updatePersona).toHaveBeenCalledWith('pe2', { name: 'Cumartesi' }));
  });

  it('validates the new name', async () => {
    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('persona-row-pe2'));
    await fireEvent.press(await screen.findByTestId('persona-sheet-rename'));
    await fireEvent.changeText(screen.getByTestId('persona-rename-input'), 'x');
    await fireEvent.press(screen.getByTestId('persona-rename-save'));

    expect(await screen.findByText('Ad 2 ile 40 karakter arasında olmalı')).toBeTruthy();
    expect(updatePersona).not.toHaveBeenCalled();
  });

  it('re-teaches a persona by opening the swipe step for it', async () => {
    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('persona-row-pe2'));
    await fireEvent.press(await screen.findByTestId('persona-sheet-retrain'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/swipe',
      params: { personaId: 'pe2', flow: 'retrain', returnTo: '/profile' },
    });
  });

  it('archives only after a confirmation', async () => {
    jest.mocked(archivePersona).mockResolvedValue(undefined);

    await renderWithQuery(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId('persona-row-pe2'));
    await fireEvent.press(await screen.findByTestId('persona-sheet-archive'));

    expect(await screen.findByText('"Hafta sonu" kaldırılsın mı?')).toBeTruthy();
    expect(archivePersona).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('persona-archive-confirm'));

    await waitFor(() => expect(archivePersona).toHaveBeenCalledWith('pe2'));
  });

  it('links to the size map with the brand count and shows placeholders for the rest', async () => {
    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByText('2 marka tanımlı')).toBeTruthy();
    // Only the stores row is still a placeholder; notification preferences open their own sheet.
    expect(screen.getAllByText('Yakında')).toHaveLength(1);
    expect(screen.getByText('Bildirim tercihleri')).toBeTruthy();
    expect(screen.getByText('Bağlı mağazalar')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('profile-size-map'));
    expect(router.push).toHaveBeenCalledWith('/profile/sizes');
  });

  it('links to the saved outfits', async () => {
    await renderWithQuery(<ProfileScreen />);

    await fireEvent.press(await screen.findByTestId('profile-saved-outfits'));

    expect(screen.getByText('Kaydedilen kombinler')).toBeTruthy();
    expect(router.push).toHaveBeenCalledWith('/outfits/saved');
  });

  it('links to my posts and the blocked people, and shows "Kazançlarım" only for a creator', async () => {
    await renderWithQuery(<ProfileScreen />);

    await fireEvent.press(await screen.findByTestId('profile-my-posts'));
    expect(router.push).toHaveBeenCalledWith('/posts/mine');
    await fireEvent.press(screen.getByTestId('profile-blocks'));
    expect(router.push).toHaveBeenCalledWith('/profile/blocks');
    expect(screen.queryByTestId('profile-creator-stats')).toBeNull();
  });

  it('adds "Kazançlarım" when the creator stats answer', async () => {
    jest.mocked(getCreatorStats).mockResolvedValue({
      days: 30,
      since: '2026-10-08T00:00:00Z',
      clicks: 0,
      estimatedEarnings: {
        amount: 0,
        currency: 'TRY',
        isEstimate: true,
        clicks: 0,
        conversionRatePercent: 3,
        averageOrderValue: 750,
        commissionPercent: 8,
        sharePercent: 40,
      },
      confirmedEarnings: 0,
      followerCount: 0,
      topPosts: [],
    });
    await renderWithQuery(<ProfileScreen />);

    await fireEvent.press(await screen.findByTestId('profile-creator-stats'));

    expect(router.push).toHaveBeenCalledWith('/profile/creator');
  });
});

describe('the league row', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('is not there when the league does not exist', async () => {
    await renderWithQuery(<ProfileScreen />);

    await screen.findByText('Ayşe Yılmaz');
    await waitFor(() => expect(jest.mocked(getLeagueMe)).toHaveBeenCalled());
    expect(screen.queryByTestId('profile-league')).toBeNull();
    expect(screen.queryByText('Kombin Ligi')).toBeNull();
  });

  it('offers the league to someone who has not joined, and opens the join screen', async () => {
    jest.mocked(getLeagueMe).mockResolvedValue(notJoined());
    await renderWithQuery(<ProfileScreen />);

    const row = await screen.findByTestId('profile-league');
    expect(screen.getByText('Bugünkü kombinin yarışsın')).toBeTruthy();
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/league/join');
  });

  it('shows the tier and the place to a player, and opens the league home', async () => {
    jest.mocked(getLeagueMe).mockResolvedValue(leagueMe());
    await renderWithQuery(<ProfileScreen />);

    await fireEvent.press(await screen.findByTestId('profile-league'));
    expect(screen.getByText('Altın lig · 7. sıra')).toBeTruthy();
    expect(router.push).toHaveBeenCalledWith('/league');
  });
});

describe('the error-report switch', () => {
  const availableMock = jest.mocked(isErrorReportingAvailable);
  const setEnabledMock = jest.mocked(setErrorReportingEnabled);

  beforeEach(async () => {
    await signedInSession();
    availableMock.mockReturnValue(false);
    useErrorReportingStore.setState({ enabled: true });
  });

  it('is not there when reporting is not available', async () => {
    await renderWithQuery(<ProfileScreen />);

    await screen.findByText('Ayşe Yılmaz');
    expect(screen.getByTestId('profile-privacy')).toBeTruthy();
    expect(screen.queryByTestId('profile-error-reports')).toBeNull();
    expect(screen.queryByText('Hata raporları')).toBeNull();
  });

  it('shows in "Hesap", on by default, with its privacy line, and turns reporting off', async () => {
    availableMock.mockReturnValue(true);
    await renderWithQuery(<ProfileScreen />);

    const toggle = await screen.findByRole('switch', { name: 'Hata raporları' });
    expect(within(screen.getByTestId('profile-account')).getByTestId('profile-error-reports')).toBe(
      toggle,
    );
    expect(toggle).toBeChecked();
    expect(
      screen.getByText(
        'Uygulamada bir hata olursa ne olduğunu bize bildirir; adın, e-postan, fotoğrafların ve yazdıkların gönderilmez.',
      ),
    ).toBeTruthy();

    await fireEvent(toggle, 'valueChange', false);
    expect(setEnabledMock).toHaveBeenCalledWith(false);
  });

  it('reflects the stored choice', async () => {
    availableMock.mockReturnValue(true);
    useErrorReportingStore.setState({ enabled: false });
    await renderWithQuery(<ProfileScreen />);

    const toggle = await screen.findByRole('switch', { name: 'Hata raporları' });
    expect(toggle).not.toBeChecked();

    await act(async () => useErrorReportingStore.setState({ enabled: true }));
    expect(screen.getByRole('switch', { name: 'Hata raporları' })).toBeChecked();
  });

  it('shows signed out too, since the switch belongs to the device', async () => {
    availableMock.mockReturnValue(true);
    useSessionStore.getState().setSignedOut();
    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByRole('switch', { name: 'Hata raporları' })).toBeTruthy();
    expect(screen.queryByTestId('profile-sign-out')).toBeNull();
  });
});

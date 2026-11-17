import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { getLeagueMe } from '@/api/endpoints/league';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/api/endpoints/notifications';
import { PreferencesSheet } from '@/features/notifications/PreferencesSheet';

import { preferences } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { leagueMe } from './fixtures';

jest.mock('@/api/endpoints/notifications');

const getMock = jest.mocked(getNotificationPreferences);
const updateMock = jest.mocked(updateNotificationPreferences);
const meMock = jest.mocked(getLeagueMe);

beforeEach(async () => {
  [meMock, getMock, updateMock].forEach((mock) => mock.mockReset());
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  getMock.mockResolvedValue(preferences);
  updateMock.mockImplementation(async (patch) => ({ ...preferences, ...patch }) as never);
  meMock.mockResolvedValue(leagueMe());
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
});

describe('the league results switch', () => {
  it('sits with the other switches when the league exists, on as the server has it', async () => {
    await renderWithQuery(<PreferencesSheet visible onClose={jest.fn()} />);

    expect(await screen.findByText('Kombin Ligi sonuçları')).toBeTruthy();
    expect(screen.getByText('Akşam sonuçların hazır olunca')).toBeTruthy();
    expect(screen.getByTestId('prefs-league').props.value).toBe(true);
    expect(screen.getByTestId('prefs-league').props.accessibilityLabel).toBe(
      'Kombin Ligi sonuçları',
    );
  });

  it('is not there at all when there is no league', async () => {
    meMock.mockResolvedValue(null);
    await renderWithQuery(<PreferencesSheet visible onClose={jest.fn()} />);

    await screen.findByText('Fiyat alarmları');
    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(screen.queryByText('Kombin Ligi sonuçları')).toBeNull();
    expect(screen.queryByTestId('prefs-league')).toBeNull();
  });

  it('is saved with the rest, in the one request', async () => {
    await renderWithQuery(<PreferencesSheet visible onClose={jest.fn()} />);
    await screen.findByText('Kombin Ligi sonuçları');

    await fireEvent(screen.getByTestId('prefs-league'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('prefs-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({ leagueResults: false });
  });

  it('shows what the server holds when the player had switched it off', async () => {
    getMock.mockResolvedValue({ ...preferences, leagueResults: false });
    await renderWithQuery(<PreferencesSheet visible onClose={jest.fn()} />);

    await screen.findByText('Kombin Ligi sonuçları');
    expect(screen.getByTestId('prefs-league').props.value).toBe(false);
  });
});

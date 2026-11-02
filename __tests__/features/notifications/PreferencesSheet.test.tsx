import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/api/endpoints/notifications';
import { useToastStore } from '@/components/toastStore';
import { PreferencesSheet, toDraft, toRequest } from '@/features/notifications/PreferencesSheet';

import { preferences } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/notifications');

const getMock = jest.mocked(getNotificationPreferences);
const updateMock = jest.mocked(updateNotificationPreferences);

const onClose = jest.fn();

describe('PreferencesSheet', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetSession();
    await signedInSession();
    getMock.mockResolvedValue(preferences);
    updateMock.mockImplementation(async (patch) => ({ ...preferences, ...patch }) as never);
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as never);
    useToastStore.getState().hide();
  });

  it('does not fetch anything while closed', async () => {
    await renderWithQuery(<PreferencesSheet visible={false} onClose={onClose} />);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('shows the saved toggles, the weekly limit and no quiet-hour pickers', async () => {
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);

    expect(await screen.findByText('Fiyat alarmları')).toBeTruthy();
    expect(screen.getByText('Stok alarmları')).toBeTruthy();
    expect(screen.getByText('Öneriler')).toBeTruthy();
    expect(screen.getByTestId('prefs-weekly-value').props.children).toBe('3');
    expect(screen.getByTestId('prefs-price').props.value).toBe(true);
    expect(screen.getByTestId('prefs-quiet').props.value).toBe(false);
    expect(screen.queryByTestId('prefs-quiet-start-hours-value')).toBeNull();
  });

  it('saves the toggles, the stepper and the quiet hours in one request', async () => {
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);
    await screen.findByText('Fiyat alarmları');

    await fireEvent(screen.getByTestId('prefs-stock'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('prefs-weekly-inc'));
    await fireEvent(screen.getByTestId('prefs-quiet'), 'valueChange', true);

    // Quiet hours start at 22:00-08:00; move the start to 23:15.
    expect(screen.getByTestId('prefs-quiet-start-hours-value').props.children).toBe('22');
    await fireEvent.press(screen.getByTestId('prefs-quiet-start-hours-inc'));
    await fireEvent.press(screen.getByTestId('prefs-quiet-start-minutes-inc'));

    await fireEvent.press(screen.getByTestId('prefs-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith({
      priceAlerts: true,
      stockAlerts: false,
      recommendations: true,
      maxRecommendationsPerWeek: 4,
      quietHoursStart: '23:15',
      quietHoursEnd: '08:00',
      clearQuietHours: false,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useToastStore.getState().message).toBe('Tercihlerin kaydedildi');
  });

  it('keeps the weekly limit between 1 and 7', async () => {
    getMock.mockResolvedValue({ ...preferences, maxRecommendationsPerWeek: 7 });
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);
    await screen.findByText('Fiyat alarmları');

    expect(screen.getByTestId('prefs-weekly-inc').props.accessibilityState.disabled).toBe(true);
    for (let i = 0; i < 9; i += 1) {
      await fireEvent.press(screen.getByTestId('prefs-weekly-dec'));
    }
    expect(screen.getByTestId('prefs-weekly-value').props.children).toBe('1');
    expect(screen.getByTestId('prefs-weekly-dec').props.accessibilityState.disabled).toBe(true);
  });

  it('wraps hours and minutes around', async () => {
    getMock.mockResolvedValue({ ...preferences, quietHoursStart: '23:45', quietHoursEnd: '00:00' });
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);
    await screen.findByText('Fiyat alarmları');

    await fireEvent.press(screen.getByTestId('prefs-quiet-start-hours-inc'));
    await fireEvent.press(screen.getByTestId('prefs-quiet-start-minutes-inc'));
    await fireEvent.press(screen.getByTestId('prefs-quiet-end-hours-dec'));
    await fireEvent.press(screen.getByTestId('prefs-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({
      quietHoursStart: '00:00',
      quietHoursEnd: '23:00',
    });
  });

  it('clears the quiet hours when they are switched off', async () => {
    getMock.mockResolvedValue({ ...preferences, quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);
    await screen.findByText('Fiyat alarmları');

    expect(screen.getByTestId('prefs-quiet').props.value).toBe(true);
    await fireEvent(screen.getByTestId('prefs-quiet'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('prefs-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const body = updateMock.mock.calls[0]?.[0];
    expect(body).toMatchObject({ clearQuietHours: true });
    expect(body).not.toHaveProperty('quietHoursStart');
  });

  it('keeps the sheet open and says so when saving fails', async () => {
    updateMock.mockRejectedValue(new Error('500'));
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);
    await screen.findByText('Fiyat alarmları');

    await fireEvent.press(screen.getByTestId('prefs-save'));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Kaydedilemedi, tekrar dene'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a link to the OS settings when the permission is denied', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);

    expect(await screen.findByTestId('prefs-permission')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ayarları aç'));
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('shows nothing about permissions when notifications are allowed', async () => {
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);
    await screen.findByText('Fiyat alarmları');
    expect(screen.queryByTestId('prefs-permission')).toBeNull();
  });

  it('retries when the preferences cannot be loaded', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'));
    await renderWithQuery(<PreferencesSheet visible onClose={onClose} />);

    await fireEvent.press(await screen.findByText('Tekrar dene'));
    expect(await screen.findByText('Fiyat alarmları')).toBeTruthy();
  });
});

describe('draft mapping', () => {
  it('reads the backend times (with or without seconds) and clamps the weekly limit', () => {
    const draft = toDraft({
      ...preferences,
      maxRecommendationsPerWeek: 0,
      quietHoursStart: '21:30:00',
      quietHoursEnd: '07:00',
    });
    expect(draft).toMatchObject({
      weeklyMax: 1,
      quiet: true,
      quietStart: '21:30',
      quietEnd: '07:00',
    });
  });

  it('sends both quiet-hour times or clears them, never one alone', () => {
    const base = toDraft(preferences);
    expect(toRequest({ ...base, quiet: true })).toMatchObject({
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    });
    expect(toRequest({ ...base, quiet: false })).toEqual(
      expect.objectContaining({ clearQuietHours: true }),
    );
  });
});

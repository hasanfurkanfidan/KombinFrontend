import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getUnreadCount } from '@/api/endpoints/notifications';
import { NotificationBell } from '@/features/notifications/NotificationBell';

import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/notifications');

const unreadMock = jest.mocked(getUnreadCount);

describe('NotificationBell', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetSession();
  });

  it('shows the unread count as a badge', async () => {
    await signedInSession();
    unreadMock.mockResolvedValue(3);

    await renderWithQuery(<NotificationBell />);

    expect(await screen.findByTestId('notification-badge')).toBeTruthy();
    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Bildirimler, 3 okunmamış')).toBeTruthy();
  });

  it('caps the badge at 99+', async () => {
    await signedInSession();
    unreadMock.mockResolvedValue(250);

    await renderWithQuery(<NotificationBell />);

    expect(await screen.findByText('99+')).toBeTruthy();
  });

  it('shows no badge when everything is read', async () => {
    await signedInSession();
    unreadMock.mockResolvedValue(0);

    await renderWithQuery(<NotificationBell />);
    await fireEvent.press(await screen.findByLabelText('Bildirimler'));

    expect(screen.queryByTestId('notification-badge')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });

  it('refetches when the screen comes into focus, joining the fetch of the first mount', async () => {
    await signedInSession();
    unreadMock.mockResolvedValue(1);

    await renderWithQuery(<NotificationBell />);
    await screen.findByText('1');

    // The focus effect ran at mount: one request, not two.
    expect(unreadMock).toHaveBeenCalledTimes(1);
  });

  it('does not ask the backend while signed out, but still opens the screen', async () => {
    await renderWithQuery(<NotificationBell />);

    await fireEvent.press(screen.getByTestId('notification-bell'));

    expect(unreadMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('notification-badge')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });
});

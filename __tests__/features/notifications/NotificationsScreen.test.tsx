import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/endpoints/notifications';
import { activatePersona } from '@/api/endpoints/profile';
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';

import { notification, notificationPage, preferences } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/notifications');
jest.mock('@/api/endpoints/profile');

const listMock = jest.mocked(listNotifications);
const readMock = jest.mocked(markNotificationRead);
const readAllMock = jest.mocked(markAllNotificationsRead);

const now = new Date();
const atNoon = (daysAgo: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0).toISOString();

const todayDrop = notification({
  id: 101,
  kind: 'PriceDrop',
  title: 'Takip ettiğin blazer 850 ₺ düştü',
  createdAt: now.toISOString(),
});
const todayStock = notification({
  id: 102,
  kind: 'BackInStock',
  title: 'L bedeni tekrar stokta',
  body: 'Beklediğin deri loafer, bedeninde yeniden satışta.',
  data: { productId: 'p2', deepLink: 'kombin://product/p2' },
  createdAt: now.toISOString(),
});
const yesterdayMatches = notification({
  id: 103,
  kind: 'NewMatches',
  title: 'Tam sana göre 3 yeni parça',
  data: { personaId: 'pe2', deepLink: 'kombin://matches/pe2' },
  createdAt: atNoon(1),
  readAt: atNoon(1),
});
const olderSystem = notification({
  id: 104,
  kind: 'System',
  title: "Kombin'e hoş geldin",
  data: { deepLink: 'kombin://notifications' },
  createdAt: atNoon(6),
  readAt: atNoon(5),
});

describe('NotificationsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetSession();
    await signedInSession();
    listMock.mockResolvedValue(
      notificationPage([todayDrop, todayStock, yesterdayMatches, olderSystem]),
    );
    readMock.mockResolvedValue(undefined);
    readAllMock.mockResolvedValue(undefined);
    jest.mocked(getUnreadCount).mockResolvedValue(2);
    jest.mocked(getNotificationPreferences).mockResolvedValue(preferences);
    jest.mocked(activatePersona).mockResolvedValue(undefined);
  });

  it('groups the feed into Bugün / Dün / Daha önce, newest first', async () => {
    await renderWithQuery(<NotificationsScreen />);

    expect(await screen.findByText('BUGÜN')).toBeTruthy();
    expect(screen.getByText('DÜN')).toBeTruthy();
    expect(screen.getByText('DAHA ÖNCE')).toBeTruthy();
    expect(screen.getByText('Takip ettiğin blazer 850 ₺ düştü')).toBeTruthy();
    expect(screen.getByText('L bedeni tekrar stokta')).toBeTruthy();
    expect(screen.getByText('Tam sana göre 3 yeni parça')).toBeTruthy();
    expect(screen.getByText('Fiyat alarmı · Az önce')).toBeTruthy();
    expect(screen.getByText('Haftalık seçki · Dün')).toBeTruthy();
  });

  it('filters by Fiyat, Stok and Öneri, and back to Tümü', async () => {
    await renderWithQuery(<NotificationsScreen />);
    await screen.findByText('BUGÜN');

    await fireEvent.press(screen.getByTestId('notifications-filter-price'));
    expect(screen.getByText('Takip ettiğin blazer 850 ₺ düştü')).toBeTruthy();
    expect(screen.queryByText('L bedeni tekrar stokta')).toBeNull();
    expect(screen.queryByText('DÜN')).toBeNull();

    await fireEvent.press(screen.getByTestId('notifications-filter-stock'));
    expect(screen.getByText('L bedeni tekrar stokta')).toBeTruthy();
    expect(screen.queryByText('Takip ettiğin blazer 850 ₺ düştü')).toBeNull();

    await fireEvent.press(screen.getByTestId('notifications-filter-recommendation'));
    expect(screen.getByText('Tam sana göre 3 yeni parça')).toBeTruthy();
    expect(screen.queryByText('BUGÜN')).toBeNull();

    await fireEvent.press(screen.getByTestId('notifications-filter-all'));
    expect(screen.getByText("Kombin'e hoş geldin")).toBeTruthy();
  });

  it('shows an empty state, and a filter-specific one when a chip has nothing', async () => {
    listMock.mockResolvedValue(notificationPage([todayDrop]));
    await renderWithQuery(<NotificationsScreen />);
    await screen.findByText('BUGÜN');

    await fireEvent.press(screen.getByTestId('notifications-filter-stock'));
    expect(screen.getByText('Bu başlık altında bildirim yok.')).toBeTruthy();
    // One way out: back to every notification.
    await fireEvent.press(screen.getByText('Tüm bildirimleri göster'));
    expect(screen.queryByText('Bu başlık altında bildirim yok.')).toBeNull();
  });

  it('shows the empty state for a user without notifications', async () => {
    listMock.mockResolvedValue(notificationPage([]));
    await renderWithQuery(<NotificationsScreen />);

    expect(await screen.findByText('Henüz bildirimin yok')).toBeTruthy();
    expect(screen.queryByText('BUGÜN')).toBeNull();
    await fireEvent.press(screen.getByText('Ürünlere göz at'));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('offers a retry when the feed cannot be loaded', async () => {
    listMock.mockRejectedValueOnce(new Error('boom'));
    await renderWithQuery(<NotificationsScreen />);

    expect(await screen.findByText('Bildirimlerin yüklenemedi')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(await screen.findByText('BUGÜN')).toBeTruthy();
  });

  it('asks a signed-out user to log in and never calls the feed', async () => {
    await resetSession();
    await renderWithQuery(<NotificationsScreen />);

    expect(await screen.findByText('Bildirimler için giriş yap')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Giriş yap'));
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('opens the product, marks the row read and reports notification_open', async () => {
    await renderWithQuery(<NotificationsScreen />);

    await fireEvent.press(await screen.findByTestId('notification-102'));

    expect(router.push).toHaveBeenCalledWith('/product/p2?source=notification');
    await waitFor(() => expect(readMock).toHaveBeenCalledWith(102));
    expect(track).toHaveBeenCalledWith('notification_open', {
      notificationId: 102,
      kind: 'BackInStock',
    });
  });

  it('does not mark an already read notification again', async () => {
    await renderWithQuery(<NotificationsScreen />);

    await fireEvent.press(await screen.findByTestId('notification-103'));

    expect(readMock).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('notification_open', {
      notificationId: 103,
      kind: 'NewMatches',
    });
  });

  it('opens the persona behind a "new matches" notification: activates it and goes to Keşfet', async () => {
    await renderWithQuery(<NotificationsScreen />);

    await fireEvent.press(await screen.findByTestId('notification-103'));

    await waitFor(() => expect(activatePersona).toHaveBeenCalledWith('pe2'));
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/'));
  });

  it('marks every notification read from the header menu', async () => {
    await renderWithQuery(<NotificationsScreen />);
    await screen.findByText('BUGÜN');

    await fireEvent.press(screen.getByTestId('notifications-menu'));
    await fireEvent.press(await screen.findByText('Tümünü okundu işaretle'));

    await waitFor(() => expect(readAllMock).toHaveBeenCalledTimes(1));
  });

  it('opens the preferences sheet from the header button', async () => {
    await renderWithQuery(<NotificationsScreen />);
    await screen.findByText('BUGÜN');

    await fireEvent.press(screen.getByTestId('notifications-preferences'));

    expect(await screen.findByTestId('prefs-save')).toBeTruthy();
    expect(getNotificationPreferences).toHaveBeenCalled();
  });

  it('shows unread rows differently from read ones', async () => {
    await renderWithQuery(<NotificationsScreen />);

    const unread = await screen.findByTestId('notification-101');
    const read = screen.getByTestId('notification-103');
    expect(unread.props.accessibilityState).toMatchObject({ selected: true });
    expect(read.props.accessibilityState).toMatchObject({ selected: false });
    expect(within(unread).getByText('Takip ettiğin blazer 850 ₺ düştü')).toBeTruthy();
  });
});

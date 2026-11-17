import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { listNotifications, markNotificationRead } from '@/api/endpoints/notifications';
import { deepLinkOf, parseDeepLink, targetOf } from '@/features/notifications/navigation';
import { NotificationRow } from '@/features/notifications/NotificationRow';
import { handlePushTap } from '@/features/notifications/pushTap';
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';

import { notification, notificationPage } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/notifications');

const listMock = jest.mocked(listNotifications);
const readMock = jest.mocked(markNotificationRead);

const LINK = 'kombin://league/results?day=2026-11-02';

const result = (overrides = {}) =>
  notification({
    id: 700,
    kind: 'LeagueResult',
    title: 'Akşamki sonucun hazır',
    body: 'Bugünkü kombinin 12. oldu.',
    data: { deepLink: LINK },
    ...overrides,
  });

describe('the deep link of a league result', () => {
  it('parses the day', () => {
    expect(parseDeepLink(LINK)).toEqual({ type: 'league-results', day: '2026-11-02' });
    expect(parseDeepLink('kombin://league/results')).toEqual({ type: 'league-results', day: null });
    expect(parseDeepLink('kombin://league/results/')).toEqual({
      type: 'league-results',
      day: null,
    });
  });

  it('opens the latest result for a day that is not a real date, and refuses anything else', () => {
    expect(parseDeepLink('kombin://league/results?day=2026-02-31')).toEqual({
      type: 'league-results',
      day: null,
    });
    expect(parseDeepLink('kombin://league/results?day=latest')).toEqual({
      type: 'league-results',
      day: null,
    });
    expect(parseDeepLink('kombin://league/results?day=2026-11-02&x=1')).toBeNull();
    expect(parseDeepLink('kombin://league/vote')).toBeNull();
    // Whatever follows the day is not a place to go: the route is fixed, the odd value only means "latest".
    expect(parseDeepLink('kombin://league/results?day=2026-11-02/../../x')).toEqual({
      type: 'league-results',
      day: null,
    });
    expect(parseDeepLink('https://example.com/league/results')).toBeNull();
  });

  it('is read from a notification’s data', () => {
    expect(deepLinkOf(result().data)).toBe(LINK);
    expect(targetOf(result())).toEqual({ type: 'league-results', day: '2026-11-02' });
  });
});

describe('the push and the notification list open the results of that day', () => {
  beforeEach(async () => {
    [listMock, readMock].forEach((mock) => mock.mockReset());
    jest.clearAllMocks();
    await resetSession();
    await signedInSession();
    listMock.mockResolvedValue(notificationPage([result()]));
    readMock.mockResolvedValue(undefined);
  });

  it('a tap on the push goes to /league/results with the day, and marks the entry read', async () => {
    await handlePushTap(router, LINK);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/league/results',
      params: { day: '2026-11-02' },
    });
    expect(track).toHaveBeenCalledWith('notification_open', {
      notificationId: 700,
      kind: 'LeagueResult',
    });
    expect(readMock).toHaveBeenCalledWith(700);
  });

  it('a push without a day opens the latest result', async () => {
    listMock.mockResolvedValue(notificationPage([]));
    await handlePushTap(router, 'kombin://league/results');

    expect(router.push).toHaveBeenCalledWith('/league/results');
  });

  it('a tap on its row in the list does the same', async () => {
    await renderWithQuery(<NotificationsScreen />);

    await fireEvent.press(await screen.findByTestId('notification-700'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/league/results',
      params: { day: '2026-11-02' },
    });
    await waitFor(() => expect(readMock).toHaveBeenCalledWith(700));
  });

  it('shows the row with its own icon square, name and the title', async () => {
    await render(<NotificationRow notification={result()} now={new Date()} onPress={jest.fn()} />);

    expect(screen.getByText('Akşamki sonucun hazır')).toBeTruthy();
    expect(screen.getByText(/^Kombin Ligi · /)).toBeTruthy();
  });
});

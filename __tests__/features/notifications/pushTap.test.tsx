import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { track } from '@/analytics';
import {
  listNotifications,
  markNotificationRead,
  registerDevice,
} from '@/api/endpoints/notifications';
import { activatePersona } from '@/api/endpoints/profile';
import { handlePushTap } from '@/features/notifications/pushTap';
import { NotificationHandler, PushRegistration } from '@/push/PushLifecycle';
import { usePrefsStore } from '@/session/prefsStore';
import { resetPushRegistration } from '@/push';

import { notification, notificationPage } from '../../fixtures';
import { resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/notifications');
jest.mock('@/api/endpoints/profile');

const listMock = jest.mocked(listNotifications);
const readMock = jest.mocked(markNotificationRead);

const drop = notification({
  id: 301,
  kind: 'PriceDrop',
  data: { productId: 'p9', deepLink: 'kombin://product/p9' },
});
const alreadyRead = notification({
  id: 300,
  kind: 'PriceDrop',
  data: { productId: 'p9', deepLink: 'kombin://product/p9' },
  readAt: '2026-11-01T10:00:00Z',
});

describe('handlePushTap', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetSession();
    await signedInSession();
    listMock.mockResolvedValue(notificationPage([alreadyRead, drop]));
    readMock.mockResolvedValue(undefined);
    jest.mocked(activatePersona).mockResolvedValue(undefined);
  });

  it('opens the product at once, then reports notification_open for the matching unread entry and marks it read', async () => {
    await handlePushTap(router, 'kombin://product/p9');

    expect(router.push).toHaveBeenCalledWith('/product/p9?source=push');
    expect(track).toHaveBeenCalledWith('notification_open', {
      notificationId: 301,
      kind: 'PriceDrop',
    });
    expect(readMock).toHaveBeenCalledWith(301);
  });

  it('opens the notifications screen for a system push', async () => {
    listMock.mockResolvedValue(notificationPage([]));

    await handlePushTap(router, 'kombin://notifications');

    expect(router.push).toHaveBeenCalledWith('/notifications');
    expect(track).not.toHaveBeenCalled();
  });

  it('switches to the persona of a "new matches" push', async () => {
    listMock.mockResolvedValue(notificationPage([]));

    await handlePushTap(router, 'kombin://matches/pe2');

    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/'));
    expect(activatePersona).toHaveBeenCalledWith('pe2');
  });

  it('still opens the target when the feed cannot be read', async () => {
    listMock.mockRejectedValue(new Error('offline'));

    await expect(handlePushTap(router, 'kombin://product/p9')).resolves.toBeUndefined();

    expect(router.push).toHaveBeenCalledWith('/product/p9?source=push');
    expect(track).not.toHaveBeenCalled();
  });

  it('only opens the target while signed out', async () => {
    await resetSession();

    await handlePushTap(router, 'kombin://product/p9');

    expect(router.push).toHaveBeenCalledWith('/product/p9?source=push');
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe('NotificationHandler', () => {
  const lastResponse = jest.mocked(Notifications.useLastNotificationResponse);

  const tap = (identifier: string, deepLink: string) =>
    ({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { identifier, content: { data: { deepLink } } } },
    }) as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetSession();
    await signedInSession();
    listMock.mockResolvedValue(notificationPage([drop]));
    readMock.mockResolvedValue(undefined);
  });

  it('shows foreground pushes as a banner', async () => {
    lastResponse.mockReturnValue(null);
    await render(<NotificationHandler />);

    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];
    await expect(handler?.handleNotification({} as never)).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
    });
  });

  it('routes a tapped push by its deepLink, once', async () => {
    lastResponse.mockReturnValue(tap('push-1', 'kombin://product/p9'));
    const screen = await render(<NotificationHandler />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/product/p9?source=push'));
    await screen.rerender(<NotificationHandler />);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('ignores other actions and payloads without a deepLink', async () => {
    lastResponse.mockReturnValue({
      actionIdentifier: 'dismiss',
      notification: { request: { identifier: 'x', content: { data: {} } } },
    } as never);
    await render(<NotificationHandler />);
    lastResponse.mockReturnValue(tap('push-2', 'not-a-link') as never);
    await render(<NotificationHandler />);

    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('PushRegistration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(registerDevice).mockResolvedValue(undefined);
    usePrefsStore.getState().reset();
    resetPushRegistration();
    await resetSession();
  });

  it('registers on a cold start when the permission is already granted and the user is signed in', async () => {
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as never);
    await signedInSession();

    await render(<PushRegistration />);

    await waitFor(() => expect(registerDevice).toHaveBeenCalledTimes(1));
  });

  it('does nothing while signed out', async () => {
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as never);

    await render(<PushRegistration />);

    expect(registerDevice).not.toHaveBeenCalled();
  });
});

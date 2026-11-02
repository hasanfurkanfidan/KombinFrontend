import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { deepLinkOf } from '@/features/notifications/navigation';
import { handlePushTap } from '@/features/notifications/pushTap';
import { useSession } from '@/session/useSession';

import { resetPushRegistration, syncPushRegistration } from './index';

/**
 * Registers the phone's push token with the backend on every cold start and sign-in (when the OS permission is
 * already granted; the permission prompt itself stays contextual, see `usePushPrimer`). Renders nothing.
 */
export function PushRegistration() {
  const { isSignedIn } = useSession();

  useEffect(() => {
    if (isSignedIn) {
      void syncPushRegistration();
    } else {
      resetPushRegistration();
    }
  }, [isSignedIn]);

  return null;
}

/**
 * Foreground pushes show as a banner (and refresh the bell and the feed); a tap, including the one that cold-started
 * the app, routes by `data.deepLink`. Renders nothing.
 */
export function NotificationHandler() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const { identifier, content } = response.notification.request;
    if (handled.current === identifier) {
      return;
    }
    handled.current = identifier;
    const deepLink = deepLinkOf(content.data);
    if (deepLink) {
      void handlePushTap(router, deepLink);
    }
  }, [response, router]);

  return null;
}

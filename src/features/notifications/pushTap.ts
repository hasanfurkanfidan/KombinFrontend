import type { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { listNotifications, markNotificationRead } from '@/api/endpoints/notifications';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { useSessionStore } from '@/session/sessionStore';
import { toNumber } from '@/utils/money';

import { deepLinkOf, goToTarget, parseDeepLink } from './navigation';

type Router = ReturnType<typeof useRouter>;

/** How far back in the feed a tapped push is looked up. */
const LOOKUP_PAGE_SIZE = 20;

/**
 * The user tapped a push notification. Opens what its `deepLink` points at, then (best effort) finds the matching feed
 * entry: the push payload is the notification's `data`, which carries no id or kind, so `notification_open` and the
 * read mark come from the newest unread entry with the same deep link.
 */
export async function handlePushTap(router: Router, deepLink: string): Promise<void> {
  const target = parseDeepLink(deepLink);
  if (target) {
    void goToTarget(router, target, 'push');
  }
  if (useSessionStore.getState().status !== 'signedIn') {
    return;
  }
  try {
    const feed = await listNotifications(1, LOOKUP_PAGE_SIZE);
    const match = feed.items.find(
      (item) => item.readAt === null && deepLinkOf(item.data) === deepLink,
    );
    if (!match) {
      return;
    }
    track('notification_open', { notificationId: toNumber(match.id), kind: match.kind });
    await markNotificationRead(match.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll });
  } catch {
    // The screen already opened; the feed catches up the next time it is shown.
  }
}

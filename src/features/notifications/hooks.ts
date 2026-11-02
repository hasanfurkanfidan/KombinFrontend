import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';

import { track } from '@/analytics';
import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '@/api/endpoints/notifications';
import type { Notification, NotificationPage, NotificationPreferences } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

import { goToTarget, targetOf } from './navigation';

export const NOTIFICATIONS_PAGE_SIZE = 30;

/** The feed, newest first, a page at a time. Disabled while logged out. */
export function useNotifications() {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam, signal }) =>
      listNotifications(pageParam, NOTIFICATIONS_PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      toNumber(last.page) < toNumber(last.totalPages ?? 0) ? toNumber(last.page) + 1 : undefined,
    enabled: isSignedIn,
    staleTime: 0,
  });
}

/** The bell's badge: unread notifications, 0 while logged out. Refetched every time the screen comes into focus. */
export function useUnreadCount(): number {
  const { isSignedIn } = useSession();
  const query = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: ({ signal }) => getUnreadCount(signal),
    enabled: isSignedIn,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) {
        // Joins a fetch that is already running (first mount) instead of restarting it.
        void refetch({ cancelRefetch: false });
      }
    }, [isSignedIn, refetch]),
  );
  return query.data ?? 0;
}

type Feed = InfiniteData<NotificationPage>;

function mapFeed(queryClient: QueryClient, change: (item: Notification) => Notification) {
  queryClient.setQueryData<Feed>(queryKeys.notifications, (feed) =>
    feed
      ? { ...feed, pages: feed.pages.map((page) => ({ ...page, items: page.items.map(change) })) }
      : feed,
  );
}

/** Marks one notification read: the feed and the badge update at once, and are refetched afterwards. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: Notification['id']) => markNotificationRead(id),
    onMutate: (id) => {
      const readAt = new Date().toISOString();
      mapFeed(queryClient, (item) =>
        String(item.id) === String(id) && item.readAt === null ? { ...item, readAt } : item,
      );
      queryClient.setQueryData<number>(queryKeys.unreadCount, (count) =>
        count === undefined ? count : Math.max(0, count - 1),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: () => {
      const readAt = new Date().toISOString();
      mapFeed(queryClient, (item) => (item.readAt === null ? { ...item, readAt } : item));
      queryClient.setQueryData<number>(queryKeys.unreadCount, 0);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  });
}

/** Tap on a row: reports the open, marks it read and goes where its deep link points. */
export function useOpenNotification() {
  const router = useRouter();
  const markRead = useMarkRead();
  const { mutate } = markRead;
  return useCallback(
    (notification: Notification) => {
      track('notification_open', {
        notificationId: toNumber(notification.id),
        kind: notification.kind,
      });
      if (notification.readAt === null) {
        mutate(notification.id);
      }
      const target = targetOf(notification);
      if (target) {
        void goToTarget(router, target, 'notification');
      }
    },
    [router, mutate],
  );
}

/** Preferences are only fetched while the sheet that edits them is open. */
export function useNotificationPreferences(enabled: boolean) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: ({ signal }) => getNotificationPreferences(signal),
    enabled: enabled && isSignedIn,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateNotificationPreferences>[0]) =>
      updateNotificationPreferences(patch),
    onSuccess: (saved: NotificationPreferences) =>
      queryClient.setQueryData(queryKeys.notificationPreferences, saved),
  });
}

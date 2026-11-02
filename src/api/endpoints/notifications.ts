import { request } from '../client';
import type {
  NotificationPage,
  NotificationPreferences,
  RegisterDeviceRequest,
  UpdateNotificationPreferencesRequest,
} from '../models';

/** Upserts this phone's Expo push token for the signed-in user (204, idempotent). */
export function registerDevice(body: RegisterDeviceRequest): Promise<void> {
  return request<void>('/api/v1/me/devices', { method: 'PUT', body, auth: true });
}

export function listNotifications(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<NotificationPage> {
  return request<NotificationPage>('/api/v1/me/notifications', {
    query: { Page: page, PageSize: pageSize },
    auth: true,
    signal,
  });
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  const response = await request<{ count: number | string }>(
    '/api/v1/me/notifications/unread-count',
    { auth: true, signal },
  );
  return Number(response.count);
}

export function markNotificationRead(id: number | string): Promise<void> {
  return request<void>(`/api/v1/me/notifications/${encodeURIComponent(String(id))}/read`, {
    method: 'POST',
    auth: true,
  });
}

export function markAllNotificationsRead(): Promise<void> {
  return request<void>('/api/v1/me/notifications/read-all', { method: 'POST', auth: true });
}

export function getNotificationPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
  return request<NotificationPreferences>('/api/v1/me/notification-preferences', {
    auth: true,
    signal,
  });
}

/** Every field is optional on the wire; the generated type wants them all, so the rest default to "leave as is". */
export function updateNotificationPreferences(
  patch: Partial<UpdateNotificationPreferencesRequest>,
): Promise<NotificationPreferences> {
  const body: UpdateNotificationPreferencesRequest = {
    priceAlerts: null,
    stockAlerts: null,
    recommendations: null,
    maxRecommendationsPerWeek: null,
    quietHoursStart: null,
    quietHoursEnd: null,
    clearQuietHours: null,
    ...patch,
  };
  return request<NotificationPreferences>('/api/v1/me/notification-preferences', {
    method: 'PUT',
    body,
    auth: true,
  });
}

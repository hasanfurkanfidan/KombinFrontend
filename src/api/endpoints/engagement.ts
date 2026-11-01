import { request } from '../client';
import type {
  Alert,
  AlertList,
  CreateAlertRequest,
  SavedIds,
  SavedPage,
  TriggerPage,
  UpdateAlertRequest,
} from '../models';

export function listSavedIds(signal?: AbortSignal): Promise<SavedIds> {
  return request<SavedIds>('/api/v1/me/saved/ids', { auth: true, signal });
}

export function listSaved(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<SavedPage> {
  return request<SavedPage>('/api/v1/me/saved', {
    query: { Page: page, PageSize: pageSize },
    auth: true,
    signal,
  });
}

export function saveProduct(productId: string): Promise<void> {
  return request<void>(`/api/v1/me/saved/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    auth: true,
  });
}

export function unsaveProduct(productId: string): Promise<void> {
  return request<void>(`/api/v1/me/saved/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function createAlert(body: CreateAlertRequest): Promise<Alert> {
  return request<Alert>('/api/v1/me/alerts', { method: 'POST', body, auth: true });
}

export function listAlerts(signal?: AbortSignal): Promise<AlertList> {
  return request<AlertList>('/api/v1/me/alerts', { auth: true, signal });
}

export function updateAlert(id: string, patch: Partial<UpdateAlertRequest>): Promise<Alert> {
  const body: UpdateAlertRequest = { targetPrice: null, sizes: null, isActive: null, ...patch };
  return request<Alert>(`/api/v1/me/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
}

export function deleteAlert(id: string): Promise<void> {
  return request<void>(`/api/v1/me/alerts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function listTriggers(pageSize: number, signal?: AbortSignal): Promise<TriggerPage> {
  return request<TriggerPage>('/api/v1/me/alerts/triggers', {
    query: { Page: 1, PageSize: pageSize },
    auth: true,
    signal,
  });
}

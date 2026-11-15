import { request } from '../client';
import type { SaveTripRequest, Trip, TripList, TripPlan, TripPlanRequest } from '../models';

const BASE = '/api/v1/me/trips';

/** Plans without saving: the answer is the plan itself. */
export function planTrip(body: TripPlanRequest): Promise<TripPlan> {
  return request<TripPlan>(`${BASE}/plan`, { method: 'POST', body, auth: true });
}

/** The server plans again from `request` and stores its own result, never a client snapshot. */
export function saveTrip(body: SaveTripRequest): Promise<Trip> {
  return request<Trip>(BASE, { method: 'POST', body, auth: true });
}

export function listTrips(signal?: AbortSignal): Promise<TripList> {
  return request<TripList>(BASE, { auth: true, signal });
}

export function getTrip(id: string, signal?: AbortSignal): Promise<Trip> {
  return request<Trip>(`${BASE}/${encodeURIComponent(id)}`, { auth: true, signal });
}

export function deleteTrip(id: string): Promise<void> {
  return request<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/** From today when the trip has started; 409 `Recommendation.TripOver` when it is over. */
export function replanTrip(id: string): Promise<Trip> {
  return request<Trip>(`${BASE}/${encodeURIComponent(id)}/replan`, { method: 'POST', auth: true });
}

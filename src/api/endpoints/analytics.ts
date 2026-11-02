import { request } from '../client';
import type { RecordEventsRequest, RecordEventsResponse } from '../models';

/**
 * Sends a batch of analytics events (1-50). Anonymous callers are fine: every event carries the device's
 * `anonymousId`; a signed-in caller (`auth: true`) is attributed by its bearer token instead.
 */
export function sendEvents(
  body: RecordEventsRequest,
  options: { auth: boolean },
): Promise<RecordEventsResponse> {
  return request<RecordEventsResponse>('/api/v1/events', {
    method: 'POST',
    body,
    auth: options.auth,
  });
}

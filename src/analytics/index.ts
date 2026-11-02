import { sendEvents } from '@/api/endpoints/analytics';
import type { EventItem } from '@/api/models';
import { useSessionStore } from '@/session/sessionStore';
import { apiPlatform, appVersion } from '@/utils/appInfo';

import { findEventProblems, type EventName, type EventProps } from './events';
import { getAnonymousId, getSessionId } from './identity';
import { createEventQueue } from './queue';

export type { EventName, EventProps } from './events';
export { getAnonymousId } from './identity';

const queue = createEventQueue({
  send: async (events) => {
    const response = await sendEvents(
      { events },
      { auth: useSessionStore.getState().status === 'signedIn' },
    );
    if (__DEV__ && response.rejected.length > 0) {
      // The backend judges events one by one; a rejected one never costs the rest of the batch.
      console.warn('[analytics] rejected events', response.rejected);
    }
  },
});

/**
 * Records one analytics event. Fire and forget: it returns at once, never throws in production and never blocks the UI.
 * In development a wrong event name or property key throws (the allow-list guard in `events.ts`); in production such an
 * event is dropped silently.
 */
export function track<Name extends EventName>(name: Name, properties: EventProps[Name]): void {
  const problems = findEventProblems(name, properties);
  if (problems.length > 0) {
    if (__DEV__) {
      throw new Error(`Invalid analytics event: ${problems.join('; ')}`);
    }
    return;
  }

  const occurredAt = new Date().toISOString();
  void (async () => {
    try {
      const event: EventItem = {
        name,
        properties,
        sessionId: getSessionId(),
        platform: apiPlatform(),
        appVersion: appVersion(),
        occurredAt,
        anonymousId: await getAnonymousId(),
      };
      queue.push(event);
    } catch {
      // Analytics must never surface an error.
    }
  })();
}

/** Sends what is queued now (the app is going to the background). */
export function flushAnalytics(): Promise<void> {
  return queue.flush();
}

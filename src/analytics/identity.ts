import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ANONYMOUS_ID_KEY = 'kombin.anonymousId';

let anonymousId: Promise<string> | null = null;

async function loadAnonymousId(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(ANONYMOUS_ID_KEY);
    if (stored) {
      return stored;
    }
    const created = Crypto.randomUUID();
    await SecureStore.setItemAsync(ANONYMOUS_ID_KEY, created);
    return created;
  } catch {
    // The keystore is unavailable: this launch still gets a stable id, the next one starts over.
    return Crypto.randomUUID();
  }
}

/**
 * A random id the app creates once and keeps in the secure store, so events sent before login can be attached to the
 * user afterwards (it travels in every event and in the login/register bodies). Never rejects.
 */
export function getAnonymousId(): Promise<string> {
  anonymousId ??= loadAnonymousId();
  return anonymousId;
}

let sessionId: string | null = null;

/** One id per cold start, shared by every event of the launch. */
export function getSessionId(): string {
  sessionId ??= Crypto.randomUUID();
  return sessionId;
}

/** Test hook: forget the cached ids. */
export function resetAnalyticsIdentity(): void {
  anonymousId = null;
  sessionId = null;
}

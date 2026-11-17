import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useSessionStore } from '@/session/sessionStore';

import { trackQueryClient } from './support/leakGuard';

export { heldOpen } from './support/leakGuard';

export const API = 'http://api.test';

/** Minimal `Response` double: enough for the client (ok, status, headers.get, json). */
export function reply(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => {
      if (body === undefined) {
        throw new Error('empty body');
      }
      return body;
    },
  } as unknown as Response;
}

export function problem(status: number, errorCode: string, extra: Record<string, unknown> = {}) {
  return reply(status, {
    status,
    title: errorCode,
    detail: `${errorCode} detail`,
    errorCode,
    ...extra,
  });
}

export const tokens = (suffix: string, expiresIn = 900) => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  expiresIn,
  isNewUser: false,
});

export async function resetSession() {
  useSessionStore.setState({
    status: 'booting',
    accessToken: null,
    expiresAt: null,
    endReason: null,
    signInMethod: null,
  });
  await SecureStore.deleteItemAsync('kombin.refreshToken');
  await SecureStore.deleteItemAsync('kombin.signInMethod');
}

export async function signedInSession(suffix = 'old', expiresInSeconds = 900) {
  useSessionStore.getState().setSignedIn(`access-${suffix}`, expiresInSeconds);
  await SecureStore.setItemAsync('kombin.refreshToken', `refresh-${suffix}`);
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    // `gcTime: Infinity` also keeps react-query from leaving 5-minute garbage-collection timers behind.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  trackQueryClient(client);
  // The app root provides the gesture root view; gesture components in a screen need it in tests too.
  const result = render(
    <GestureHandlerRootView>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </GestureHandlerRootView>,
  );
  // `render` is async in this version of the library: hand the client over once it has rendered, for tests that
  // write into the cache themselves.
  return Promise.resolve(result).then((rendered) => Object.assign(rendered, { client }));
}

export function authHeader(call: unknown[]): string | undefined {
  const init = call[1] as { headers: Record<string, string> };
  return init.headers.Authorization;
}

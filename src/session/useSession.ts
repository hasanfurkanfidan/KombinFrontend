import { useEffect } from 'react';

import { ensureFreshAccessToken, refreshSession } from '@/api/client';
import { getMe, logout } from '@/api/endpoints/auth';
import type { AuthTokens } from '@/api/models';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { resetPushRegistration } from '@/push';

import { usePrefsStore } from './prefsStore';
import { applyAuthTokens, endSession, useSessionStore } from './sessionStore';
import { getRefreshToken } from './tokenStorage';

let bootstrapPromise: Promise<void> | null = null;

/**
 * Restores a previous session: stored refresh token -> refresh -> GET /me.
 * Always resolves with the store out of `booting`, so the splash can be dismissed.
 */
export function bootstrapSession(): Promise<void> {
  bootstrapPromise ??= (async () => {
    try {
      if (!(await getRefreshToken())) {
        return;
      }
      await refreshSession();
      await queryClient.fetchQuery({
        queryKey: queryKeys.me,
        queryFn: ({ signal }) => getMe(signal),
      });
    } catch {
      // A 4xx has already cleared the session. Anything else (offline, 5xx) keeps the stored token for
      // the next launch; if only /me failed, the Profile screen refetches it.
    } finally {
      if (useSessionStore.getState().status === 'booting') {
        useSessionStore.getState().setSignedOut();
      }
    }
  })();
  return bootstrapPromise;
}

/** Starts the bootstrap once and reports whether it has finished. */
export function useBootstrapSession(): boolean {
  const status = useSessionStore((state) => state.status);
  useEffect(() => {
    void bootstrapSession();
  }, []);
  return status !== 'booting';
}

export function useSession() {
  const status = useSessionStore((state) => state.status);
  return { status, isSignedIn: status === 'signedIn' };
}

/** Called by the auth forms after a successful register/login response. */
export async function completeSignIn(tokens: AuthTokens): Promise<void> {
  await applyAuthTokens(tokens);
  await queryClient.invalidateQueries({ queryKey: queryKeys.me });
}

/** Revokes the refresh token on the server (best effort), then always clears the local session. */
export async function signOut(): Promise<void> {
  try {
    // Refresh first if needed: that rotates the refresh token, so it must be read afterwards.
    await ensureFreshAccessToken();
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // The push token makes the backend stop pushing to this phone for the account that is leaving.
      await logout(refreshToken, usePrefsStore.getState().pushToken);
    }
  } catch {
    // Offline or already expired: the user still leaves, the server-side token ages out on its own.
  } finally {
    resetPushRegistration();
    await endSession();
    queryClient.removeQueries({ queryKey: queryKeys.me });
  }
}

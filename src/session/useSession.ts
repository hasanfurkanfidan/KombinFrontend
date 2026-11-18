import { useEffect } from 'react';

import { flushAnalytics } from '@/analytics';
import { ensureFreshAccessToken, refreshSession } from '@/api/client';
import { getMe, logout } from '@/api/endpoints/auth';
import type { AuthTokens } from '@/api/models';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { resetPushRegistration } from '@/push';

import { usePrefsStore } from './prefsStore';
import { applyAuthTokens, endSession, rememberSignInMethod, useSessionStore } from './sessionStore';
import { getRefreshToken, getSignInMethod, type SignInMethod } from './tokenStorage';

let bootstrapPromise: Promise<void> | null = null;

/** Sign-out waits at most this long for the analytics queue to go out. */
const FLUSH_WAIT_MS = 1500;

/**
 * The splash waits at most this long for the stored session to be restored. A refresh that is still out after that
 * (a phone on a bad network) no longer holds the first screen: the app opens signed out and switches to signed in the
 * moment the refresh answers.
 */
export const BOOT_TIMEOUT_MS = 6000;

/** Resolves when `work` settles or after `ms`, whichever comes first; never rejects. */
function withinMs(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

/**
 * Restores a previous session: stored refresh token -> refresh -> GET /me.
 * Always resolves with the store out of `booting`, so the splash can be dismissed.
 */
export function bootstrapSession(): Promise<void> {
  bootstrapPromise ??= (async () => {
    const restore = (async () => {
      if (!(await getRefreshToken())) {
        return;
      }
      await refreshSession();
      useSessionStore.getState().setSignInMethod(await getSignInMethod());
      // `/me` is not needed to draw the first screen: it is warmed in the background, not awaited behind the splash.
      void queryClient.prefetchQuery({
        queryKey: queryKeys.me,
        queryFn: ({ signal }) => getMe(signal),
      });
    })().catch(() => {
      // A 4xx has already cleared the session. Anything else (offline, 5xx) keeps the stored token for
      // the next launch.
    });
    try {
      await withinMs(restore, BOOT_TIMEOUT_MS);
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

/** Called by the auth forms after a successful register/login response; `method` says which credentials opened it. */
export async function completeSignIn(tokens: AuthTokens, method?: SignInMethod): Promise<void> {
  if (useSessionStore.getState().status === 'signedIn') {
    // A sign-in that replaces a session still open (the store never leaves `signedIn`, so the usual trigger would not
    // fire): `installUserScopeReset` forgets what belonged to the first account before the second one's tokens apply.
    useSessionStore.getState().markSessionReplaced();
  }
  await applyAuthTokens(tokens);
  if (method) {
    await rememberSignInMethod(method);
  }
  await queryClient.invalidateQueries({ queryKey: queryKeys.me });
}

/** Revokes the refresh token on the server (best effort), then always clears the local session. */
export async function signOut(): Promise<void> {
  // What this account did last goes out with its own token, before the session is gone (never longer than a moment).
  await withinMs(flushAnalytics(), FLUSH_WAIT_MS);
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
    await clearLocalSession();
  }
}

/** Forgets the session on this phone without asking the server: logout's last step, and what a deleted account needs (its tokens are already gone). */
export async function clearLocalSession(): Promise<void> {
  resetPushRegistration();
  await endSession();
  queryClient.removeQueries({ queryKey: queryKeys.me });
}

/** Whether the signed-in account has a password: `false` for a Google/Apple account, `null` when this session cannot tell. */
export function useHasPassword(): boolean | null {
  const method = useSessionStore((state) => state.signInMethod);
  return method === null ? null : method === 'password';
}

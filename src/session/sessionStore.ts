import { create } from 'zustand';

import type { AuthTokens } from '@/api/models';
import { toNumber } from '@/utils/money';

import {
  clearRefreshToken,
  clearSignInMethod,
  setRefreshToken,
  setStoredSignInMethod,
  type SignInMethod,
} from './tokenStorage';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

/** Why a signed-in session ended without the user asking for it. */
export type SessionEndReason = 'expired';

interface SessionState {
  status: SessionStatus;
  /** Kept in memory only; the refresh token lives in secure storage. */
  accessToken: string | null;
  /** Epoch milliseconds at which the access token expires. */
  expiresAt: number | null;
  endReason: SessionEndReason | null;
  /**
   * How many times `endSession` has dropped credentials. It tells "a stored session was rejected at start-up" (the
   * counter moves while the status goes from `booting` to `signedOut`) from "nobody was ever signed in on this start".
   */
  sessionsEnded: number;
  /** How many times a sign-in has replaced a session that was still open (another account taking over the phone). */
  sessionsReplaced: number;
  markSessionReplaced: () => void;
  /** `null` while unknown (a session from before the hint was stored). */
  signInMethod: SignInMethod | null;
  setSignInMethod: (method: SignInMethod | null) => void;
  setSignedIn: (accessToken: string, expiresInSeconds: number, now?: number) => void;
  setSignedOut: (reason?: SessionEndReason, endedStoredSession?: boolean) => void;
  clearEndReason: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'booting',
  accessToken: null,
  expiresAt: null,
  endReason: null,
  sessionsEnded: 0,
  sessionsReplaced: 0,
  markSessionReplaced: () => set((state) => ({ sessionsReplaced: state.sessionsReplaced + 1 })),
  signInMethod: null,
  setSignInMethod: (signInMethod) => set({ signInMethod }),
  setSignedIn: (accessToken, expiresInSeconds, now = Date.now()) =>
    set({
      status: 'signedIn',
      accessToken,
      expiresAt: now + expiresInSeconds * 1000,
      endReason: null,
    }),
  setSignedOut: (reason, endedStoredSession = false) =>
    set((state) => ({
      status: 'signedOut',
      accessToken: null,
      expiresAt: null,
      endReason: reason ?? null,
      signInMethod: null,
      sessionsEnded: state.sessionsEnded + (endedStoredSession ? 1 : 0),
    })),
  clearEndReason: () => set({ endReason: null }),
}));

/** Persists the rotated refresh token first, then publishes the new access token to the store. */
export async function applyAuthTokens(tokens: AuthTokens): Promise<void> {
  await setRefreshToken(tokens.refreshToken);
  useSessionStore.getState().setSignedIn(tokens.accessToken, toNumber(tokens.expiresIn));
}

/** Remembers how this session was opened (see `getSignInMethod`). */
export async function rememberSignInMethod(method: SignInMethod): Promise<void> {
  useSessionStore.getState().setSignInMethod(method);
  await setStoredSignInMethod(method);
}

/** Drops every credential. A `reason` makes the root layout send the user to the login screen. */
export async function endSession(reason?: SessionEndReason): Promise<void> {
  useSessionStore.getState().setSignedOut(reason, true);
  await clearRefreshToken();
  await clearSignInMethod();
}

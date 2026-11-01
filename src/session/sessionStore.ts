import { create } from 'zustand';

import type { AuthTokens } from '@/api/models';
import { toNumber } from '@/utils/money';

import { clearRefreshToken, setRefreshToken } from './tokenStorage';

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
  setSignedIn: (accessToken: string, expiresInSeconds: number, now?: number) => void;
  setSignedOut: (reason?: SessionEndReason) => void;
  clearEndReason: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'booting',
  accessToken: null,
  expiresAt: null,
  endReason: null,
  setSignedIn: (accessToken, expiresInSeconds, now = Date.now()) =>
    set({
      status: 'signedIn',
      accessToken,
      expiresAt: now + expiresInSeconds * 1000,
      endReason: null,
    }),
  setSignedOut: (reason) =>
    set({ status: 'signedOut', accessToken: null, expiresAt: null, endReason: reason ?? null }),
  clearEndReason: () => set({ endReason: null }),
}));

/** Persists the rotated refresh token first, then publishes the new access token to the store. */
export async function applyAuthTokens(tokens: AuthTokens): Promise<void> {
  await setRefreshToken(tokens.refreshToken);
  useSessionStore.getState().setSignedIn(tokens.accessToken, toNumber(tokens.expiresIn));
}

/** Drops every credential. A `reason` makes the root layout send the user to the login screen. */
export async function endSession(reason?: SessionEndReason): Promise<void> {
  useSessionStore.getState().setSignedOut(reason);
  await clearRefreshToken();
}

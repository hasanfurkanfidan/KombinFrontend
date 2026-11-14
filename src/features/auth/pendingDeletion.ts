import { create } from 'zustand';

import { ApiError } from '@/api/client';
import type { ExternalProvider } from './externalSignIn';

/**
 * What the user just signed in with, kept **in memory only** so "Silmeyi iptal et ve giriş yap" can send the very same
 * proof to `POST /auth/cancel-deletion`. A password never travels in a route param or touches storage.
 */
export type PendingCredentials =
  | { kind: 'password'; email: string; password: string }
  | { kind: 'external'; provider: ExternalProvider; idToken: string };

interface PendingDeletionState {
  scheduledFor: string | null;
  credentials: PendingCredentials | null;
  begin: (scheduledFor: string | null, credentials: PendingCredentials) => void;
  clear: () => void;
}

export const usePendingDeletionStore = create<PendingDeletionState>((set) => ({
  scheduledFor: null,
  credentials: null,
  begin: (scheduledFor, credentials) => set({ scheduledFor, credentials }),
  clear: () => set({ scheduledFor: null, credentials: null }),
}));

/** 403 `Identity.AccountPendingDeletion`: the credentials were right, the account is waiting to be deleted. */
export function isPendingDeletion(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'Identity.AccountPendingDeletion';
}

/** 403 `Identity.AccountDisabled`: the founder closed the account. */
export function isAccountDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'Identity.AccountDisabled';
}

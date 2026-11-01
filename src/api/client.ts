import * as Crypto from 'expo-crypto';

import { tr } from '@/i18n/tr';
import { applyAuthTokens, endSession, useSessionStore } from '@/session/sessionStore';
import { getRefreshToken } from '@/session/tokenStorage';

import type { AuthTokens, ProblemBody } from './models';

/** Access tokens with less than this left are refreshed before the request is sent. */
export const REFRESH_MARGIN_MS = 60_000;

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string | null;
  readonly detail: string | null;
  readonly fieldErrors: Record<string, string[]>;
  readonly correlationId: string;

  constructor(init: {
    status: number;
    errorCode?: string | null;
    detail?: string | null;
    title?: string | null;
    fieldErrors?: Record<string, string[]>;
    correlationId: string;
  }) {
    super(init.detail ?? init.title ?? `HTTP ${init.status}`);
    this.name = 'ApiError';
    this.status = init.status;
    this.errorCode = init.errorCode ?? null;
    this.detail = init.detail ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.correlationId = init.correlationId;
  }

  /** `true` for connection failures: the server was never reached. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Protected call: sends the bearer token, refreshes it proactively and once more on 401. */
  auth?: boolean;
  signal?: AbortSignal;
}

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.');
  }
  return url.replace(/\/+$/, '');
}

function buildQuery(query: RequestOptions['query']): string {
  if (!query) {
    return '';
  }
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

async function readProblem(response: Response): Promise<ProblemBody | null> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === 'object' && parsed !== null ? (parsed as ProblemBody) : null;
  } catch {
    return null;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function send<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  const method = options.method ?? 'GET';
  const correlationId = Crypto.randomUUID();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Correlation-ID': correlationId,
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}${buildQuery(options.query)}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    if (isAbort(cause)) {
      throw cause;
    }
    if (__DEV__) {
      console.warn(
        `[api] ${method} ${path} failed: network error (correlationId=${correlationId})`,
      );
    }
    throw new ApiError({
      status: 0,
      errorCode: 'Network.Unreachable',
      detail: tr.errorNetwork,
      correlationId,
    });
  }

  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  const problem = await readProblem(response);
  const error = new ApiError({
    status: response.status,
    errorCode: problem?.errorCode,
    detail: problem?.detail,
    title: problem?.title,
    fieldErrors: problem?.errors,
    correlationId: response.headers.get('X-Correlation-ID') ?? correlationId,
  });
  if (__DEV__) {
    console.warn(
      `[api] ${method} ${path} -> ${error.status} ${error.errorCode ?? ''} (correlationId=${correlationId})`,
    );
  }
  throw error;
}

async function performRefresh(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new ApiError({
      status: 401,
      errorCode: 'Identity.InvalidRefreshToken',
      correlationId: 'local',
    });
  }
  const wasSignedIn = useSessionStore.getState().status === 'signedIn';
  try {
    const tokens = await send<AuthTokens>(
      '/api/v1/auth/refresh',
      { method: 'POST', body: { refreshToken } },
      null,
    );
    await applyAuthTokens(tokens);
    return tokens.accessToken;
  } catch (error) {
    // Only a definitive rejection ends the session; being offline must not log the user out.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      await endSession(wasSignedIn ? 'expired' : undefined);
    }
    throw error;
  }
}

let refreshInFlight: Promise<string> | null = null;

/** Rotates the tokens. Concurrent callers share one request: the refresh token is single-use. */
export function refreshSession(): Promise<string> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Returns a usable access token, refreshing first when it is missing or about to expire. */
export async function ensureFreshAccessToken(): Promise<string> {
  const { accessToken, expiresAt } = useSessionStore.getState();
  const expiring = expiresAt !== null && expiresAt - Date.now() < REFRESH_MARGIN_MS;
  if (accessToken && !expiring) {
    return accessToken;
  }
  return refreshSession();
}

async function sendAuthenticated<T>(path: string, options: RequestOptions): Promise<T> {
  const usedToken = await ensureFreshAccessToken();
  try {
    return await send<T>(path, options, usedToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    // Another request may already have rotated the tokens while this one was in flight.
    const current = useSessionStore.getState().accessToken;
    const retryToken = current && current !== usedToken ? current : await refreshSession();
    try {
      return await send<T>(path, options, retryToken);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        await endSession('expired');
      }
      throw retryError;
    }
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return options.auth ? sendAuthenticated<T>(path, options) : send<T>(path, options, null);
}

import { request } from '../client';
import type { AuthTokens, LoginRequest, LogoutRequest, Me, RegisterRequest } from '../models';

export function register(body: RegisterRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/register', { method: 'POST', body });
}

export function login(body: LoginRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/login', { method: 'POST', body });
}

/** `expoPushToken` makes the backend deactivate this phone's push device for the account. */
export function logout(refreshToken: string, expoPushToken?: string | null): Promise<void> {
  const body: LogoutRequest = expoPushToken ? { refreshToken, expoPushToken } : { refreshToken };
  return request<void>('/api/v1/auth/logout', { method: 'POST', body, auth: true });
}

export function getMe(signal?: AbortSignal): Promise<Me> {
  return request<Me>('/api/v1/me', { auth: true, signal });
}

import { request } from '../client';
import type { AuthTokens, LoginRequest, Me, RegisterRequest } from '../models';

export function register(body: RegisterRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/register', { method: 'POST', body });
}

export function login(body: LoginRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/login', { method: 'POST', body });
}

export function logout(refreshToken: string): Promise<void> {
  return request<void>('/api/v1/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    auth: true,
  });
}

export function getMe(signal?: AbortSignal): Promise<Me> {
  return request<Me>('/api/v1/me', { auth: true, signal });
}

import { request } from '../client';
import type {
  AuthTokens,
  CancelDeletionRequest,
  DeleteAccountRequest,
  DeleteAccountResponse,
  ExternalSignInRequest,
  LoginRequest,
  LogoutRequest,
  Me,
  RegisterRequest,
} from '../models';

export function register(body: RegisterRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/register', { method: 'POST', body });
}

export function login(body: LoginRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/login', { method: 'POST', body });
}

/** Sign in with a Google or Apple ID token from the device; `isNewUser` is true when this call created the account. */
export function externalSignIn(body: ExternalSignInRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/external', { method: 'POST', body });
}

/** `expoPushToken` makes the backend deactivate this phone's push device for the account. */
export function logout(refreshToken: string, expoPushToken?: string | null): Promise<void> {
  const body: LogoutRequest = expoPushToken ? { refreshToken, expoPushToken } : { refreshToken };
  return request<void>('/api/v1/auth/logout', { method: 'POST', body, auth: true });
}

export function getMe(signal?: AbortSignal): Promise<Me> {
  return request<Me>('/api/v1/me', { auth: true, signal });
}

/** `DELETE /me`: starts the 7-day deletion. A password account sends its password; `confirm` is the word "SİL". */
export function deleteAccount(body: DeleteAccountRequest): Promise<DeleteAccountResponse> {
  return request<DeleteAccountResponse>('/api/v1/me', { method: 'DELETE', body, auth: true });
}

/** Takes a pending deletion back and signs in: the same credentials as the sign-in that answered 403 `AccountPendingDeletion`. */
export function cancelDeletion(body: CancelDeletionRequest): Promise<AuthTokens> {
  return request<AuthTokens>('/api/v1/auth/cancel-deletion', { method: 'POST', body });
}

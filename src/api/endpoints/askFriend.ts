import type { AskConsent, AskResponse, CreateAskRequest } from '@/features/askFriend/types';

import { request } from '../client';

const BASE = '/api/v1/me/asks';

/** The current consent text and whether the caller accepted it. A 404 `AskFriend.Disabled` means the feature is off. */
export function getAskConsent(signal?: AbortSignal): Promise<AskConsent> {
  return request<AskConsent>(`${BASE}/consent`, { auth: true, signal });
}

/** Creates an ask (201); `consentVersion` accepts the consent in the same call. */
export function createAsk(body: CreateAskRequest): Promise<AskResponse> {
  return request<AskResponse>(BASE, { method: 'POST', body, auth: true });
}

import { request } from '../client';
import type { AnswerSizePromptResponse, SizePromptAnswer, SizePromptList } from '../models';

const BASE = '/api/v1/me/size-prompts';

/** At most three open "did the size fit?" questions, newest click first; empty when the user turned them off. */
export function listSizePrompts(signal?: AbortSignal): Promise<SizePromptList> {
  return request<SizePromptList>(BASE, { auth: true, signal });
}

/** `size` is required for `BoughtFits` and optional for the other answers. 409: answered already or expired. */
export function answerSizePrompt(
  id: string,
  body: { answer: SizePromptAnswer; size: string | null },
): Promise<AnswerSizePromptResponse> {
  return request<AnswerSizePromptResponse>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'POST',
    body,
    auth: true,
  });
}

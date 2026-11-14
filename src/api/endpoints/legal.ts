import { request } from '../client';
import type { Legal } from '../models';

/** `GET /legal`: absolute URLs of the privacy policy, the terms and the deletion page. Public. */
export function getLegal(signal?: AbortSignal): Promise<Legal> {
  return request<Legal>('/api/v1/legal', { signal });
}

import * as WebBrowser from 'expo-web-browser';

import { baseUrl } from '@/api/client';
import { getLegal } from '@/api/endpoints/legal';
import type { Legal } from '@/api/models';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';

export type LegalPage = 'privacy' | 'terms';

const LEGAL_STALE_MS = 60 * 60_000;

/** `GET /legal` through the shared cache (public, no token); the URLs rarely change, so it is asked for at most hourly. */
export function fetchLegal(): Promise<Legal> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.legal,
    queryFn: ({ signal }) => getLegal(signal),
    staleTime: LEGAL_STALE_MS,
    // The app-wide default would retry a failure with back-off; the callers just fall back to a shorter message.
    retry: false,
  });
}

/** The support contact when the backend publishes one, otherwise `null`. */
export function legalContact(legal: Legal | null): string | null {
  const contact = legal?.contactEmail?.trim();
  return contact ? contact : null;
}

/**
 * Hosts besides the API's own that may serve the legal pages (e.g. a marketing site). Empty: the backend serves them
 * itself under `/legal/*`. Add a host here only together with the backend change that starts using it.
 */
export const LEGAL_HOSTS: readonly string[] = [];

/** A legal URL is opened only when it is on the API's own origin, or `https` on an allow-listed host. */
export function isAllowedLegalUrl(url: string, apiOrigin: string = baseUrl()): boolean {
  let parsed: URL;
  let api: URL;
  try {
    parsed = new URL(url);
    api = new URL(apiOrigin);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  if (parsed.origin === api.origin) {
    return true;
  }
  return parsed.protocol === 'https:' && LEGAL_HOSTS.includes(parsed.hostname.toLowerCase());
}

/**
 * Opens a legal page in the in-app browser, signed in or out. The address comes from the backend (never hard-coded here);
 * when it cannot be fetched or the browser cannot open, a toast says so and nothing else happens.
 */
export async function openLegalPage(page: LegalPage): Promise<void> {
  try {
    const legal = await fetchLegal();
    const url = page === 'privacy' ? legal.privacyUrl : legal.termsUrl;
    if (!isAllowedLegalUrl(url)) {
      throw new Error('Legal URL outside the allowed origins');
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    showToast(tr.legalOpenFailed);
  }
}

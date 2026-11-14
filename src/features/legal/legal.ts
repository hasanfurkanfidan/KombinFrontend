import * as WebBrowser from 'expo-web-browser';

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
 * Opens a legal page in the in-app browser, signed in or out. The address comes from the backend (never hard-coded here);
 * when it cannot be fetched or the browser cannot open, a toast says so and nothing else happens.
 */
export async function openLegalPage(page: LegalPage): Promise<void> {
  try {
    const legal = await fetchLegal();
    await WebBrowser.openBrowserAsync(page === 'privacy' ? legal.privacyUrl : legal.termsUrl);
  } catch {
    showToast(tr.legalOpenFailed);
  }
}

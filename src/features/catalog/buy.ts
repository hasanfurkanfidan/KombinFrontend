import * as WebBrowser from 'expo-web-browser';

import { baseUrl } from '@/api/client';
import type { Offer } from '@/api/models';

/** Where a buy click comes from; the backend records it with the click. */
export type ClickSource = 'product_detail' | 'saved' | 'alert';

/**
 * The only way the app sends a user to a seller: the backend's `/go` redirect, built from the offer's `goPath`.
 * A seller URL is never built or opened directly; the redirect records the click and adds the affiliate parameters.
 */
export function buildGoUrl(
  goPath: string,
  options: { source?: ClickSource; personaId?: string } = {},
): string {
  const params = [`src=${encodeURIComponent(options.source ?? 'product_detail')}`];
  if (options.personaId) {
    params.push(`personaId=${encodeURIComponent(options.personaId)}`);
  }
  return `${baseUrl()}${goPath}${goPath.includes('?') ? '&' : '?'}${params.join('&')}`;
}

/** Opens the in-app browser on the redirect; the browser follows the 302 to the seller. */
export async function openOffer(
  offer: Pick<Offer, 'goPath'>,
  options: { source?: ClickSource; personaId?: string } = {},
): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(buildGoUrl(offer.goPath, options));
  } catch {
    // The in-app browser could not be opened; the offer list stays usable.
  }
}

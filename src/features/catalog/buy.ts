import * as WebBrowser from 'expo-web-browser';

import { track } from '@/analytics';
import { baseUrl } from '@/api/client';
import type { Offer } from '@/api/models';

/** Where a buy click comes from; the backend records it with the click. */
export type ClickSource =
  'product_detail' | 'saved' | 'alert' | 'outfit' | 'feed' | 'budget' | 'trip' | 'wardrobe_summary';

/**
 * The only way the app sends a user to a seller: the backend's `/go` redirect, built from the offer's `goPath`.
 * A seller URL is never built or opened directly; the redirect records the click and adds the affiliate parameters.
 */
/**
 * A `goPath` is the API's own redirect path (`/api/v1/go/{offerId}`, optionally with a query). Anything else is refused:
 * the path is glued to the API origin, so a value such as `@evil.example` or `//evil.example` would turn the link into
 * another host.
 */
export function isGoPath(goPath: string): boolean {
  return /^\/api\/v1\/go\/[A-Za-z0-9-]+(\?[^#\s]*)?$/.test(goPath);
}

/**
 * The offer id inside a `goPath` (`/api/v1/go/{offerId}`), for the `buy_click` event of a link that comes without an
 * offer object (the wardrobe's unlock suggestion). Reading an id from the API's own path builds no seller URL.
 */
export function offerIdFromGoPath(goPath: string): string | null {
  return /^\/api\/v1\/go\/([A-Za-z0-9-]+)/.exec(goPath)?.[1] ?? null;
}

export function buildGoUrl(
  goPath: string,
  options: { source?: ClickSource; personaId?: string } = {},
): string {
  if (!isGoPath(goPath)) {
    throw new Error('Not a /go path');
  }
  // A feed post's `goPath` already says `?src=feed&post=…` (the post is what the creator is paid for): the link is used as is.
  const hasSource = /[?&]src=/.test(goPath);
  const params = hasSource ? [] : [`src=${encodeURIComponent(options.source ?? 'product_detail')}`];
  if (options.personaId) {
    params.push(`personaId=${encodeURIComponent(options.personaId)}`);
  }
  if (params.length === 0) {
    return `${baseUrl()}${goPath}`;
  }
  return `${baseUrl()}${goPath}${goPath.includes('?') ? '&' : '?'}${params.join('&')}`;
}

/** Opens the in-app browser on the redirect; the browser follows the 302 to the seller. */
export async function openOffer(
  offer: Pick<Offer, 'id' | 'goPath'>,
  options: { source?: ClickSource; personaId?: string } = {},
): Promise<void> {
  if (!isGoPath(offer.goPath)) {
    return;
  }
  track('buy_click', { offerId: offer.id, source: options.source ?? 'product_detail' });
  try {
    await WebBrowser.openBrowserAsync(buildGoUrl(offer.goPath, options));
  } catch {
    // The in-app browser could not be opened; the offer list stays usable.
  }
}

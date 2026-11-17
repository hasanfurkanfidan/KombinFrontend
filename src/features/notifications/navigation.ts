import type { useRouter } from 'expo-router';

import { activatePersona } from '@/api/endpoints/profile';
import type { Notification } from '@/api/models';
import { queryClient } from '@/api/queryClient';
import { productHref, type ProductSource } from '@/features/catalog/productLink';
import { parseResultsDay } from '@/features/league/labels';
import { refreshPersonaDependents } from '@/features/personas/hooks';

type Router = ReturnType<typeof useRouter>;

/** What a notification (or a push tap) opens. Parsed from `data.deepLink`; the backend sends these three shapes. */
export type DeepLinkTarget =
  | { type: 'product'; id: string }
  | { type: 'matches'; personaId: string }
  | { type: 'notifications' }
  /** The evening result of a league day; `day` is `yyyy-MM-dd`, or `null` for the latest one. */
  | { type: 'league-results'; day: string | null };

/** Every id the backend puts in a deep link is a uuid; nothing else is accepted. */
const ID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * `kombin://product/{id}`, `kombin://matches/{personaId}`, `kombin://notifications` or `kombin://league/results?day=yyyy-MM-dd`
 * (the day is optional); anything else is `null`.
 */
export function parseDeepLink(url: string | null | undefined): DeepLinkTarget | null {
  if (!url) {
    return null;
  }
  const product = new RegExp(`^kombin://product/(${ID})/?$`).exec(url);
  if (product?.[1]) {
    return { type: 'product', id: product[1] };
  }
  const matches = new RegExp(`^kombin://matches/(${ID})/?$`).exec(url);
  if (matches?.[1]) {
    return { type: 'matches', personaId: matches[1] };
  }
  if (/^kombin:\/\/notifications\/?$/.test(url)) {
    return { type: 'notifications' };
  }
  const league = /^kombin:\/\/league\/results\/?(?:\?day=([^&#]*))?$/.exec(url);
  if (league) {
    const day = parseResultsDay(league[1]);
    // A day that is not a real date is not a link to some other day: it opens the latest result.
    return { type: 'league-results', day };
  }
  return null;
}

/** `data.deepLink` of a notification or push payload (`data` is untyped JSON). */
export function deepLinkOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const link = (data as { deepLink?: unknown }).deepLink;
  return typeof link === 'string' ? link : null;
}

export function targetOf(notification: Pick<Notification, 'data'>): DeepLinkTarget | null {
  return parseDeepLink(deepLinkOf(notification.data));
}

/**
 * Opens a target. A product opens its detail; "new matches" makes that persona the active one (so Keşfet shows its
 * scored list; best effort) and goes to Keşfet; the feed itself opens the notifications screen.
 */
export async function goToTarget(
  router: Router,
  target: DeepLinkTarget,
  source: ProductSource,
): Promise<void> {
  if (target.type === 'product') {
    router.push(productHref(target.id, source));
  } else if (target.type === 'notifications') {
    router.push('/notifications');
  } else if (target.type === 'league-results') {
    router.push(
      target.day ? { pathname: '/league/results', params: { day: target.day } } : '/league/results',
    );
  } else {
    try {
      await activatePersona(target.personaId);
      await refreshPersonaDependents(queryClient);
    } catch {
      // Not signed in or offline: Keşfet still opens, just with the persona that is active now.
    }
    router.navigate('/');
  }
}

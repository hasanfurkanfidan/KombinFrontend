import type { Outfit } from '@/api/models';

/**
 * What the outfit card on Keşfet shows. The outfit is only asked for when the user is signed in and has at least one
 * piece; a signed-in user with an empty wardrobe gets the first-morning card (add photos, or look at shopping ideas),
 * a visitor (or a user whose piece count never came) gets the prompt to fill the wardrobe, and the card waits while the
 * piece count is still unknown.
 */
export type HomeCardState = 'prompt' | 'empty' | 'loading' | 'outfit';

export function homeCardState(input: {
  isSignedIn: boolean;
  /** `undefined` while the wardrobe stats are loading (or failed). */
  itemCount: number | undefined;
  statsPending: boolean;
}): HomeCardState {
  if (!input.isSignedIn) {
    return 'prompt';
  }
  if (input.statsPending) {
    return 'loading';
  }
  if (input.itemCount === undefined) {
    return 'prompt';
  }
  return input.itemCount > 0 ? 'outfit' : 'empty';
}

/**
 * From this hour on (local time) the card is about tomorrow ("Yarın için"). Until then it is about today, worn or not:
 * an outfit that was worn stays on the card as "Bugün giyiyorsun" (the settled state) and does not hand over to
 * tomorrow's outfit when the app comes back to the front at lunchtime.
 */
export const HOME_CARD_SWITCH_HOUR = 18;

export type HomeCardDay = 'today' | 'tomorrow';

/** Which day the card is about: today until `HOME_CARD_SWITCH_HOUR`, then tomorrow. Nothing else moves it. */
export function homeCardDay(now: Date): HomeCardDay {
  return now.getHours() >= HOME_CARD_SWITCH_HOUR ? 'tomorrow' : 'today';
}

/** Turkey has no daylight saving time since 2016: Europe/Istanbul is always UTC+3. */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * The calendar day in Europe/Istanbul as `yyyy-MM-dd`, the day the backend's outfits (`outfit.date`) are about and
 * what "worn today" is remembered against. Plain arithmetic, so it does not depend on `Intl` time-zone support.
 */
export function istanbulDay(now: Date): string {
  return new Date(now.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The card's one filled action. A user can only wear what they own, so "Bunu giyiyorum" needs a `Complete` outfit and
 * today; everything else (a missing piece, a tomorrow card, nothing to show) opens the outfit.
 */
export function homeCardPrimary(
  outfit: Pick<Outfit, 'completeness'> | null,
  day: HomeCardDay,
): 'wear' | 'open' {
  return day === 'today' && outfit?.completeness === 'Complete' ? 'wear' : 'open';
}

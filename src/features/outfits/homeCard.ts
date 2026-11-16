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
 * From this hour on (local time) the card is about tomorrow ("Yarın için"), whether or not today's outfit was worn.
 * It used to be noon, which left someone dressing at 12:30 without today's outfit.
 */
export const HOME_CARD_SWITCH_HOUR = 18;

export type HomeCardDay = 'today' | 'tomorrow';

/** Which day the card is about: today until today's outfit is marked worn or the switch hour, then tomorrow. */
export function homeCardDay(now: Date, todayWorn = false): HomeCardDay {
  return todayWorn || now.getHours() >= HOME_CARD_SWITCH_HOUR ? 'tomorrow' : 'today';
}

/** The device's local calendar day as `yyyy-MM-dd`: what "marked worn today" is remembered against. */
export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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

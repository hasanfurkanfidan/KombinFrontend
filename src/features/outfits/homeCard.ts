import type { Outfit } from '@/api/models';
import { istanbulDay, istanbulHour } from '@/utils/istanbulTime';

export { istanbulDay, istanbulHour };

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
 * From this hour on (Europe/Istanbul time, whatever the phone's zone) the card is about tomorrow ("Yarın için"). Until then it is about today, worn or not:
 * an outfit that was worn stays on the card as "Bugün giyiyorsun" (the settled state) and does not hand over to
 * tomorrow's outfit when the app comes back to the front at lunchtime.
 */
export const HOME_CARD_SWITCH_HOUR = 18;

export type HomeCardDay = 'today' | 'tomorrow';

/** Which day the card is about: today until `HOME_CARD_SWITCH_HOUR`, then tomorrow. Nothing else moves it. */
export function homeCardDay(now: Date): HomeCardDay {
  return istanbulHour(now) >= HOME_CARD_SWITCH_HOUR ? 'tomorrow' : 'today';
}

/**
 * The card's one filled action. A user can only wear what they own, so "Bunu giyiyorum" needs a `Complete` outfit and
 * today; everything else (a missing piece, a tomorrow card, nothing to show) opens the outfit.
 */
export function homeCardPrimary(
  outfit: Pick<Outfit, 'completeness' | 'date'> | null,
  day: HomeCardDay,
  now: Date = new Date(),
): 'wear' | 'open' {
  return day === 'today' && outfit?.completeness === 'Complete' && canWearOutfit(outfit, now)
    ? 'wear'
    : 'open';
}

/**
 * The backend records "worn" (`POST /worn`) for **today**, whatever the outfit's own day, and has no undo. So wearing is
 * offered only for an outfit that is about today in Istanbul; for any other day the action is not shown.
 */
export function canWearOutfit(outfit: Pick<Outfit, 'date'>, now: Date = new Date()): boolean {
  return outfit.date === istanbulDay(now);
}

/**
 * Is this outfit worn today? Both must be today in Istanbul: the outfit's day and the moment it was worn. A wear mark
 * from yesterday evening on today's outfit, or a mark made today on another day's outfit, does not count.
 */
export function wornToday(
  outfit: Pick<Outfit, 'date' | 'wornAt'>,
  now: Date = new Date(),
): boolean {
  return (
    canWearOutfit(outfit, now) &&
    outfit.wornAt !== null &&
    istanbulDay(new Date(outfit.wornAt)) === istanbulDay(now)
  );
}

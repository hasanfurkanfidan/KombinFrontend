/**
 * What the "Yarın için" card on Keşfet shows. The outfit is only asked for when the user is signed in and has at least
 * one piece (an empty wardrobe would answer with shopping ideas, which is not "your outfit for tomorrow"); every other
 * case shows the prompt to fill the wardrobe, and the card waits while the piece count is still unknown.
 */
export type HomeCardState = 'prompt' | 'loading' | 'outfit';

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
  return (input.itemCount ?? 0) > 0 ? 'outfit' : 'prompt';
}

/** Until this hour the card shows today's outfit ("Bugün için"); from it on, tomorrow's ("Yarın için"). */
export const HOME_CARD_SWITCH_HOUR = 12;

export type HomeCardDay = 'today' | 'tomorrow';

/** Which day the card is about, by the device's local time. */
export function homeCardDay(now: Date): HomeCardDay {
  return now.getHours() < HOME_CARD_SWITCH_HOUR ? 'today' : 'tomorrow';
}

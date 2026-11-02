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

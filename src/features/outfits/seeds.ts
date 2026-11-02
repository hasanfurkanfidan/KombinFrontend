/** How many earlier seeds "Önceki kombin" can step back through. */
export const SEED_HISTORY_LIMIT = 3;

export interface SeedState {
  seed: number;
  /** Earlier seeds, most recent last; at most `SEED_HISTORY_LIMIT`. */
  history: number[];
  /** The largest seed shown so far, so a shuffle after "back" never lands on an outfit that was already skipped. */
  highest: number;
}

export function initialSeedState(seed = 0): SeedState {
  return { seed, history: [], highest: seed };
}

/** "Başka kombin": a new seed, with the one being left behind remembered. */
export function shuffleSeed(state: SeedState): SeedState {
  const seed = state.highest + 1;
  return {
    seed,
    history: [...state.history, state.seed].slice(-SEED_HISTORY_LIMIT),
    highest: seed,
  };
}

/** "Önceki kombin": the last remembered seed; unchanged when there is none. */
export function previousSeed(state: SeedState): SeedState {
  const seed = state.history[state.history.length - 1];
  if (seed === undefined) {
    return state;
  }
  return { ...state, seed, history: state.history.slice(0, -1) };
}

/** The `seed` route param: a non-negative integer, else 0. */
export function parseSeed(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

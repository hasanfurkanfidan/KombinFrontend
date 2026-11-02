import {
  SEED_HISTORY_LIMIT,
  initialSeedState,
  parseSeed,
  previousSeed,
  shuffleSeed,
} from '@/features/outfits/seeds';

describe('seed history', () => {
  it('starts at the given seed with nothing to go back to', () => {
    expect(initialSeedState(0)).toEqual({ seed: 0, history: [], highest: 0 });
    expect(previousSeed(initialSeedState(4))).toEqual(initialSeedState(4));
  });

  it('shuffles to a new seed and remembers the one it left', () => {
    const state = shuffleSeed(initialSeedState(0));
    expect(state).toEqual({ seed: 1, history: [0], highest: 1 });
  });

  it('keeps only the last three seeds', () => {
    let state = initialSeedState(0);
    for (let step = 0; step < 6; step += 1) {
      state = shuffleSeed(state);
    }
    expect(state.seed).toBe(6);
    expect(state.history).toHaveLength(SEED_HISTORY_LIMIT);
    expect(state.history).toEqual([3, 4, 5]);
  });

  it('steps back through the history, newest first', () => {
    let state = initialSeedState(0);
    state = shuffleSeed(shuffleSeed(shuffleSeed(state)));
    expect(state.seed).toBe(3);

    state = previousSeed(state);
    expect(state.seed).toBe(2);
    state = previousSeed(state);
    expect(state.seed).toBe(1);
    state = previousSeed(state);
    expect(state.seed).toBe(0);
    expect(previousSeed(state)).toBe(state);
  });

  it('never repeats a skipped outfit: shuffling after going back moves past the highest seed', () => {
    let state = shuffleSeed(shuffleSeed(initialSeedState(0)));
    state = previousSeed(state);
    expect(state.seed).toBe(1);

    state = shuffleSeed(state);
    expect(state.seed).toBe(3);
  });

  it('reads the seed route param as a non-negative integer, else 0', () => {
    expect(parseSeed('4')).toBe(4);
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('-1')).toBe(0);
    expect(parseSeed('1.5')).toBe(0);
    expect(parseSeed('abc')).toBe(0);
    expect(parseSeed(undefined)).toBe(0);
  });
});

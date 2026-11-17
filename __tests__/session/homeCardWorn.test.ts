import { writeAsStringAsync, documentDirectory } from 'expo-file-system/legacy';

import { usePrefsStore } from '@/session/prefsStore';
import { endSession, useSessionStore } from '@/session/sessionStore';
import { installUserScopeReset } from '@/session/userScope';
import { readStoredWornOutfit, writeStoredWornOutfit } from '@/session/wornOutfitStorage';

import { freezeClockAt, MORNING, moveClockTo, TODAY, unfreezeClock } from '../support/fakeClock';
import { resetSession } from '../testUtils';

const ME = 'user-a';
const OTHER = 'user-b';
const FILE = `${documentDirectory}kombin-worn-outfit.json`;

/** `hydrate` as the card calls it, then the state the card reads. */
async function hydrate(userId: string | null) {
  await usePrefsStore.getState().hydrateHomeCardWorn(userId);
  return usePrefsStore.getState();
}

beforeEach(async () => {
  await resetSession();
  usePrefsStore.getState().reset();
  usePrefsStore.setState({ homeCardWorn: null, homeCardWornLoaded: false });
  await writeStoredWornOutfit(null);
  freezeClockAt(MORNING);
});

afterEach(() => {
  unfreezeClock();
});

describe('the remembered worn outfit belongs to one account', () => {
  it('is kept for the user it was written for, on the day it was written', async () => {
    await writeStoredWornOutfit({ userId: ME, day: TODAY, outfitId: 'o1' });

    const state = await hydrate(ME);

    expect(state.homeCardWorn).toEqual({ userId: ME, day: TODAY, outfitId: 'o1' });
    expect(state.homeCardWornLoaded).toBe(true);
  });

  it('is ignored and deleted when another account signed in on this phone', async () => {
    await writeStoredWornOutfit({ userId: OTHER, day: TODAY, outfitId: 'o1' });

    const state = await hydrate(ME);

    expect(state.homeCardWorn).toBeNull();
    expect(state.homeCardWornLoaded).toBe(true);
    await expect(readStoredWornOutfit()).resolves.toBeNull();
  });

  it('treats an old file without a user id as stale: ignored and deleted', async () => {
    await writeAsStringAsync(FILE, JSON.stringify({ day: TODAY, outfitId: 'o1' }));

    const state = await hydrate(ME);

    expect(state.homeCardWorn).toBeNull();
    await expect(readStoredWornOutfit()).resolves.toBeNull();
    await expect(
      jest.requireMock('expo-file-system/legacy').readAsStringAsync(FILE),
    ).rejects.toThrow();
  });

  it('is not used while the account is unknown, and the file is left alone', async () => {
    await writeStoredWornOutfit({ userId: ME, day: TODAY, outfitId: 'o1' });

    const state = await hydrate(null);

    expect(state.homeCardWorn).toBeNull();
    expect(state.homeCardWornLoaded).toBe(true);
    await expect(readStoredWornOutfit()).resolves.toMatchObject({ outfitId: 'o1' });
  });

  it('is deleted when the session goes from booting to signed out (nobody is signed in to own it)', async () => {
    await writeStoredWornOutfit({ userId: ME, day: TODAY, outfitId: 'o1' });
    const uninstall = installUserScopeReset();
    try {
      expect(useSessionStore.getState().status).toBe('booting');
      await endSession();
    } finally {
      uninstall();
    }

    await expect(readStoredWornOutfit()).resolves.toBeNull();
    expect(usePrefsStore.getState().homeCardWorn).toBeNull();
  });
});

describe('a value is stale only when its day is before the real Istanbul day', () => {
  it('drops a value from yesterday and deletes its file', async () => {
    await writeStoredWornOutfit({ userId: ME, day: '2026-11-01', outfitId: 'old' });

    const state = await hydrate(ME);

    expect(state.homeCardWorn).toBeNull();
    await expect(readStoredWornOutfit()).resolves.toBeNull();
  });

  it('keeps a value for the day that has just begun, even when the card still thinks it is yesterday', async () => {
    // The card's own "now" was read before midnight; the check reads the clock itself, at the moment of the check.
    await writeStoredWornOutfit({ userId: ME, day: '2026-11-03', outfitId: 'after-midnight' });
    // 00:05 on the 3rd, Istanbul time.
    moveClockTo('2026-11-02T21:05:00Z');

    const state = await hydrate(ME);

    expect(state.homeCardWorn).toEqual({
      userId: ME,
      day: '2026-11-03',
      outfitId: 'after-midnight',
    });
  });

  it('answers "is it over?" from the clock at that moment', () => {
    const worn = { userId: ME, day: TODAY, outfitId: 'o1' };
    expect(usePrefsStore.getState().isHomeCardWornStale(worn)).toBe(false);
    // 23:59 Istanbul, then 00:00 of the next day.
    moveClockTo('2026-11-02T20:59:00Z');
    expect(usePrefsStore.getState().isHomeCardWornStale(worn)).toBe(false);
    moveClockTo('2026-11-02T21:00:00Z');
    expect(usePrefsStore.getState().isHomeCardWornStale(worn)).toBe(true);
  });
});

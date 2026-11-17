import {
  deleteAsync,
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

/**
 * The outfit the user marked worn from Keşfet's card or the daily screen, the Istanbul day it was for and the account
 * that did it (another account on the same phone must never see it). Not a secret (ids and a date), so it lives in a
 * small file in the app's own document folder, never in the token storage. It goes away with the app and with the
 * session (`prefsStore.reset`).
 */
export interface StoredWornOutfit {
  /** The id of the account (`GET /me`) the outfit was worn by. */
  userId: string;
  /** `yyyy-MM-dd`, the Europe/Istanbul day the outfit was worn on. */
  day: string;
  outfitId: string;
}

const FILE_NAME = 'kombin-worn-outfit.json';

function fileUri(): string | null {
  return documentDirectory ? `${documentDirectory}${FILE_NAME}` : null;
}

/**
 * What was read. A file from before the account id was stored has `userId: null`: it cannot be tied to anyone, so the
 * reader hands it over as such and the caller treats it as stale.
 */
export interface ReadWornOutfit {
  userId: string | null;
  day: string;
  outfitId: string;
}

function toReadWornOutfit(value: unknown): ReadWornOutfit | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { userId, day, outfitId } = value as Record<string, unknown>;
  if (typeof day !== 'string' || typeof outfitId !== 'string' || outfitId.length === 0) {
    return null;
  }
  return { userId: typeof userId === 'string' && userId.length > 0 ? userId : null, day, outfitId };
}

/** Reads the stored value; a missing, unreadable or malformed file is simply "nothing stored". Never throws. */
export async function readStoredWornOutfit(): Promise<ReadWornOutfit | null> {
  const uri = fileUri();
  if (!uri) {
    return null;
  }
  try {
    return toReadWornOutfit(JSON.parse(await readAsStringAsync(uri)));
  } catch {
    return null;
  }
}

/** Writes the value, or deletes the file for `null`. Best effort: the card still works for this launch if it fails. */
export async function writeStoredWornOutfit(value: StoredWornOutfit | null): Promise<void> {
  const uri = fileUri();
  if (!uri) {
    return;
  }
  try {
    if (value) {
      await writeAsStringAsync(uri, JSON.stringify(value));
    } else {
      await deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Nothing to do: the next launch just asks the card's normal question again.
  }
}

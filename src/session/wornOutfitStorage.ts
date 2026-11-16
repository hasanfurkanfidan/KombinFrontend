import {
  deleteAsync,
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

/**
 * The outfit the user marked worn from Keşfet's card or the daily screen, and the Istanbul day it was for. Not a
 * secret (an id and a date), so it lives in a small file in the app's own document folder, never in the token storage.
 * It goes away with the app and with the session (`prefsStore.reset`).
 */
export interface StoredWornOutfit {
  /** `yyyy-MM-dd`, the Europe/Istanbul day the outfit was worn on. */
  day: string;
  outfitId: string;
}

const FILE_NAME = 'kombin-worn-outfit.json';

function fileUri(): string | null {
  return documentDirectory ? `${documentDirectory}${FILE_NAME}` : null;
}

function isStoredWornOutfit(value: unknown): value is StoredWornOutfit {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { day, outfitId } = value as Record<string, unknown>;
  return typeof day === 'string' && typeof outfitId === 'string' && outfitId.length > 0;
}

/** Reads the stored value; a missing, unreadable or malformed file is simply "nothing stored". Never throws. */
export async function readStoredWornOutfit(): Promise<StoredWornOutfit | null> {
  const uri = fileUri();
  if (!uri) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(await readAsStringAsync(uri));
    return isStoredWornOutfit(parsed) ? { day: parsed.day, outfitId: parsed.outfitId } : null;
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

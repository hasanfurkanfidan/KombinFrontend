import type { OutfitSlot, TripOutfit, TripOutfitPiece, TripPlan, TripWeather } from '@/api/models';
import { sortPieces, weatherLabel } from '@/features/outfits/labels';
import { tr } from '@/i18n/tr';
import { withPossessive } from '@/utils/turkish';
import { toNumber } from '@/utils/money';

/** "7 günün 6'sı hazır". */
export function coverageSentence(coverage: TripPlan['coverage']): string {
  return tr.tripCoverage(toNumber(coverage.total), withPossessive(toNumber(coverage.covered)));
}

const GROUPS: Record<OutfitSlot, string> = {
  Top: tr.pairingsGroupTop,
  Bottom: tr.pairingsGroupBottom,
  Outerwear: tr.pairingsGroupOuterwear,
  Shoes: tr.pairingsGroupShoes,
  Accessory: tr.pairingsGroupAccessory,
};

/** "Üstler", "Altlar", "Dış giyim", "Ayakkabı", "Aksesuar". */
export function slotGroupLabel(slot: OutfitSlot): string {
  return GROUPS[slot];
}

/**
 * The day's weather: "14° yağmurlu" for a forecast; for the climate normals or the season the same words with a note
 * saying where they come from (the season has no temperature at all).
 */
export function tripWeatherText(weather: TripWeather): { text: string; note: string | null } {
  const note =
    weather.source === 'Normal'
      ? tr.tripWeatherNormal
      : weather.source === 'Season'
        ? tr.tripWeatherSeason
        : null;
  if (weather.temperatureC === null || weather.band === null) {
    return { text: note ?? '', note: null };
  }
  return {
    text: tr.outfitSubtitleWeather(
      toNumber(weather.temperatureC),
      weatherLabel({ band: weather.band, rain: weather.rain }),
    ),
    note,
  };
}

/** A piece that was in the wardrobe when the trip was planned and is not any more. */
export function hasMissingPieces(plan: TripPlan): boolean {
  return (
    plan.pieces.some((group) => group.items.some((item) => item.missing)) ||
    plan.days.some((day) => day.outfit?.pieces.some((piece) => piece.missing))
  );
}

/** Every piece of a day's outfit in slot order (top, bottom, outerwear, shoes, accessories). */
export function dayPieces(outfit: TripOutfit): TripOutfitPiece[] {
  return sortPieces(outfit.pieces);
}

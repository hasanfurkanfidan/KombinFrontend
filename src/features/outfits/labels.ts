import type {
  DailyOutfit,
  Occasion,
  Outfit,
  OutfitPiece,
  OutfitSlot,
  OutfitWeather,
} from '@/api/models';
import { tr } from '@/i18n/tr';
import { formatWeekday } from '@/utils/dates';
import { toNumber } from '@/utils/money';

/** The occasion chips: the query value the backend takes, and the label. */
export const OCCASIONS = [
  { value: 'office', label: tr.occasionOffice },
  { value: 'weekend', label: tr.occasionWeekend },
  { value: 'evening', label: tr.occasionEvening },
  { value: 'sport', label: tr.occasionSport },
  { value: 'event', label: tr.occasionEvent },
] as const;

export type OccasionValue = (typeof OCCASIONS)[number]['value'];

/** The `occasion` route param, or undefined when it is missing or not one of ours. */
export function parseOccasion(value: unknown): OccasionValue | undefined {
  return OCCASIONS.find((occasion) => occasion.value === value)?.value;
}

/** An outfit's own occasion (`Office`) as the label ("Ofis"). */
export function occasionLabel(occasion: Occasion | null): string | null {
  return OCCASIONS.find((entry) => entry.value === occasion?.toLowerCase())?.label ?? null;
}

const BAND_LABELS: Record<OutfitWeather['band'], string> = {
  Hot: tr.weatherHot,
  Warm: tr.weatherWarm,
  Mild: tr.weatherMild,
  Cool: tr.weatherCool,
  Cold: tr.weatherCold,
};

/** "yağmurlu" when rain is expected, else how warm it is. */
export function weatherLabel(weather: Pick<OutfitWeather, 'band' | 'rain'>): string {
  return weather.rain ? tr.weatherRain : BAND_LABELS[weather.band];
}

/** Grid order: the outfit reads top to bottom, then outerwear and shoes. */
const SLOT_ORDER: OutfitSlot[] = ['Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory'];

export function sortPieces(pieces: readonly OutfitPiece[]): OutfitPiece[] {
  return [...pieces].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
}

export type FigureBand =
  | { kind: 'torso'; pieces: OutfitPiece[] }
  | { kind: 'bottom'; pieces: [OutfitPiece] }
  | { kind: 'shoes'; pieces: [OutfitPiece] };

/**
 * The outfit as a standing figure, head to toe: the torso band (a top, outerwear, or outerwear layered over a top:
 * `[outerwear, top]`), then the bottom, then the shoes; bands without a piece are left out. Accessories (and any
 * second piece of a slot) are not on the figure; they become side tiles.
 */
export function figureBands(pieces: readonly OutfitPiece[]): {
  bands: FigureBand[];
  accessories: OutfitPiece[];
} {
  const sorted = sortPieces(pieces);
  const first = (slot: OutfitSlot) => sorted.find((piece) => piece.slot === slot);
  const top = first('Top');
  const outer = first('Outerwear');
  const bottom = first('Bottom');
  const shoes = first('Shoes');
  const placed = new Set([top, outer, bottom, shoes].filter(Boolean));

  const bands: FigureBand[] = [];
  const torso = [outer, top].filter((piece): piece is OutfitPiece => Boolean(piece));
  if (torso.length > 0) {
    bands.push({ kind: 'torso', pieces: torso });
  }
  if (bottom) {
    bands.push({ kind: 'bottom', pieces: [bottom] });
  }
  if (shoes) {
    bands.push({ kind: 'shoes', pieces: [shoes] });
  }
  return { bands, accessories: sorted.filter((piece) => !placed.has(piece)) };
}

/**
 * The home card's small figure: at most three stacked pieces, head to toe (the top, or the outerwear when there is no
 * top; the bottom; the shoes). Falls back to the first pieces in grid order when the outfit has fewer of those slots.
 */
export function miniFigurePieces(pieces: readonly OutfitPiece[]): OutfitPiece[] {
  const { bands } = figureBands(pieces);
  const stacked = bands.map((band) => band.pieces[band.pieces.length - 1] as OutfitPiece);
  if (stacked.length >= 3) {
    return stacked.slice(0, 3);
  }
  const rest = sortPieces(pieces).filter((piece) => !stacked.includes(piece));
  return sortPieces([...stacked, ...rest].slice(0, 3));
}

/** The pieces that still have to be bought (role `Gap`), each with its cheapest offer. */
export function gapPieces(pieces: readonly OutfitPiece[]): OutfitPiece[] {
  return pieces.filter((piece) => piece.role === 'Gap');
}

/** Header title: "Pazartesi ofis" (the day and the occasion of the outfit on screen). */
export function outfitTitle(outfit: Outfit | null | undefined, fallbackDate: string): string {
  const weekday = formatWeekday(outfit?.date ?? fallbackDate);
  const occasion = occasionLabel(outfit?.occasion ?? null);
  return occasion
    ? tr.outfitTitle(weekday, occasion.toLocaleLowerCase('tr-TR'))
    : tr.outfitTitleNoOccasion(weekday);
}

/** Header subtitle: "Ofis · 9° yağmurlu"; the persona is left out when there is none, nothing when there is no forecast. */
export function outfitSubtitle(
  weather: DailyOutfit['weather'],
  persona: string | undefined,
): string | null {
  if (!weather) {
    return persona ?? null;
  }
  const label = weatherLabel(weather);
  return persona
    ? tr.outfitSubtitle(persona, toNumber(weather.temperatureC), label)
    : tr.outfitSubtitleWeather(toNumber(weather.temperatureC), label);
}

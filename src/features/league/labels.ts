import type { LeagueMe, LeaguePiece, LeagueTier, LeagueTodayEntry, OutfitSlot } from '@/api/models';
import type { FigurePiece } from '@/features/outfits/OutfitPieces';
import { tr } from '@/i18n/tr';
import { formatWeekday } from '@/utils/dates';
import { istanbulDay, istanbulHour } from '@/utils/istanbulTime';

const TIER_NAMES: Record<LeagueTier, string> = {
  Bronze: tr.leagueTierBronze,
  Silver: tr.leagueTierSilver,
  Gold: tr.leagueTierGold,
  Platinum: tr.leagueTierPlatinum,
  Diamond: tr.leagueTierDiamond,
};

/** "Altın". */
export function tierName(tier: LeagueTier | null | undefined): string {
  return tier ? TIER_NAMES[tier] : TIER_NAMES.Bronze;
}

/** "Altın lig". */
export function tierLeague(tier: LeagueTier | null | undefined): string {
  return tr.leagueTierLeague(tierName(tier));
}

const SLOT_NAMES: Record<OutfitSlot, string> = {
  Top: tr.leagueSlotTop,
  Bottom: tr.leagueSlotBottom,
  Outerwear: tr.leagueSlotOuterwear,
  Shoes: tr.leagueSlotShoes,
  Accessory: tr.leagueSlotAccessory,
};

export function slotName(slot: OutfitSlot): string {
  return SLOT_NAMES[slot];
}

/**
 * A league outfit's pieces as the figure components take them. The league says only a slot and a picture, so the slot's
 * name stands in for the piece's name (it is what a screen reader hears), and every piece is a plain, owned one:
 * nothing is missing, nothing is for sale (buying is not part of the league).
 */
export function figurePieces(pieces: readonly LeaguePiece[]): FigurePiece[] {
  return pieces.map((piece) => ({
    slot: piece.slot,
    imageUrl: piece.imageUrl,
    role: 'Wardrobe',
    name: slotName(piece.slot),
    offer: null,
  }));
}

/** "Üst, Alt, Ayakkabı": what a screen reader hears for a figure. */
export function spokenSlots(pieces: readonly LeaguePiece[]): string {
  return pieces.map((piece) => slotName(piece.slot)).join(', ');
}

/** The player is in the league now and has accepted the current text: their outfit enters and they take part fully. */
export function isActivePlayer(me: LeagueMe): boolean {
  return me.joined && !me.consentRequired;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "2 sa 14 dk", "14 dk", or "birazdan" for the last minute. Never negative. */
export function formatCountdown(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  if (minutes < 1) {
    return tr.leagueSoon;
  }
  if (minutes < 60) {
    return tr.leagueMinutesOnly(minutes);
  }
  return tr.leagueHoursMinutes(Math.floor(minutes / 60), minutes % 60);
}

/** "3 gün kaldı", "5 sa 20 dk kaldı", or "Hafta bitti" once the week's end has passed. */
export function weekTimeLeft(endsAt: string, now: Date): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) {
    return tr.leagueWeekEnded;
  }
  if (ms >= DAY_MS) {
    return tr.leagueDaysLeft(Math.floor(ms / DAY_MS));
  }
  return tr.leagueTimeLeft(formatCountdown(ms));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "21:00": the clock time in Istanbul (the offset is whole hours, so the UTC minutes are the local minutes). */
export function istanbulClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(istanbulHour(date))}:${pad(date.getUTCMinutes())}`;
}

/** "Pazar": the weekday in Istanbul. */
export function istanbulWeekday(iso: string): string {
  return formatWeekday(istanbulDay(new Date(iso)));
}

/**
 * The one line under "Bugün giyiyorsun": what today's worn outfit is doing in the league. For a kombin that does not
 * compete (every reason) and for a removed one the line is the server's own `message`, shown exactly as it is; with no
 * message there is no line. Competing, pending and withdrawn (the server sends no message for them) keep our short lines.
 */
export function entryNote(entry: LeagueTodayEntry | null): string | null {
  if (!entry) {
    return null;
  }
  switch (entry.status) {
    case 'Competing':
      return tr.leagueLineCompeting;
    case 'Pending':
      return tr.leagueLinePending;
    case 'Withdrawn':
      return tr.leagueLineWithdrawn;
    case 'Removed':
    case 'NotCompeting':
      return entry.message || null;
  }
}

/** A `?day=` value from a link: a real calendar date as `yyyy-MM-dd`, or `null`. */
export function parseResultsDay(value: string | string[] | undefined): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  const match = one ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(one) : null;
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? (one ?? null) : null;
}

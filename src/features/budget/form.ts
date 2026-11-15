import type {
  AnonymousBudgetOutfitsRequest,
  Audience,
  BudgetOutfits,
  BudgetOutfitsRequest,
  WardrobeStats,
} from '@/api/models';
import { tr } from '@/i18n/tr';
import type { OccasionValue } from '@/features/outfits/labels';
import { formatShortWeekday, formatWeekday } from '@/utils/dates';

export const MIN_BUDGET = 100;
export const MAX_BUDGET = 100_000;
/** The backend's default; the screen shows three outfits at a time. */
export const BUDGET_COUNT = 3;
/** The contract allows a date up to a week ahead. */
export const BUDGET_DAYS_AHEAD = 7;
export const QUICK_AMOUNTS = [1000, 2500, 5000, 10000] as const;

/** A visitor says who the outfits are for; the other audiences are not offered. */
export type BudgetAudience = Extract<Audience, 'Women' | 'Men' | 'Unisex'>;
export const BUDGET_AUDIENCES: readonly { value: BudgetAudience; label: string }[] = [
  { value: 'Women', label: tr.audienceWomen },
  { value: 'Men', label: tr.audienceMen },
  { value: 'Unisex', label: tr.audienceUnisex },
];

/** What the sheet edits. `amount` holds digits only. */
export interface BudgetForm {
  amount: string;
  occasion?: OccasionValue;
  /** `today`, `tomorrow` or `yyyy-MM-dd`. */
  date: string;
  useWardrobe: boolean;
  /** "Ayakkabım var": the outfits come without shoes. */
  haveShoes: boolean;
  audience: BudgetAudience | null;
}

export const EMPTY_BUDGET_FORM: BudgetForm = {
  amount: '',
  date: 'today',
  useWardrobe: true,
  haveShoes: false,
  audience: null,
};

/** Keeps the digits, at most six of them (100.000 is the ceiling). */
export function sanitizeAmount(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
}

export function parseAmount(amount: string): number | null {
  return amount === '' ? null : Number(amount);
}

export interface BudgetErrors {
  amount?: string;
  audience?: string;
}

/** Validated on submit, never by disabling the button: the message says what is wrong next to the field. */
export function validateBudget(form: BudgetForm, signedIn: boolean): BudgetErrors {
  const errors: BudgetErrors = {};
  const amount = parseAmount(form.amount);
  if (amount === null || amount < MIN_BUDGET || amount > MAX_BUDGET) {
    errors.amount = tr.budgetAmountInvalid;
  }
  if (!signedIn && form.audience === null) {
    errors.audience = tr.budgetAudienceRequired;
  }
  return errors;
}

/** Everything the answer depends on; also the query key, so a new seed is a new request. */
export interface BudgetAsk {
  signedIn: boolean;
  budget: number;
  occasion?: OccasionValue;
  date: string;
  useWardrobe: boolean;
  /** `false` when the user has shoes. */
  includeShoes: boolean;
  audience: BudgetAudience | null;
  personaId?: string;
  seed: number;
}

export function toAsk(
  form: BudgetForm,
  options: { signedIn: boolean; personaId?: string; seed: number },
): BudgetAsk {
  return {
    signedIn: options.signedIn,
    budget: parseAmount(form.amount) ?? MIN_BUDGET,
    occasion: form.occasion,
    date: form.date,
    // A visitor has no wardrobe, whatever the form says.
    useWardrobe: options.signedIn && form.useWardrobe,
    includeShoes: !form.haveShoes,
    audience: options.signedIn ? null : form.audience,
    personaId: options.signedIn ? options.personaId : undefined,
    seed: options.seed,
  };
}

export function signedInBody(ask: BudgetAsk): BudgetOutfitsRequest {
  return {
    budget: ask.budget,
    occasion: ask.occasion ?? null,
    date: ask.date,
    useWardrobe: ask.useWardrobe,
    seed: ask.seed,
    count: BUDGET_COUNT,
    personaId: ask.personaId ?? null,
    includeShoes: ask.includeShoes,
  };
}

export function anonymousBody(ask: BudgetAsk): AnonymousBudgetOutfitsRequest {
  return {
    budget: ask.budget,
    audience: ask.audience,
    occasion: ask.occasion ?? null,
    date: ask.date,
    seed: ask.seed,
    count: BUDGET_COUNT,
    includeShoes: ask.includeShoes,
  };
}

/** The budget as the analytics band; the amount itself never leaves the phone. */
export function budgetBand(budget: number): 'under500' | '500to1500' | '1500to5000' | 'over5000' {
  if (budget < 500) {
    return 'under500';
  }
  if (budget < 1500) {
    return '500to1500';
  }
  return budget < 5000 ? '1500to5000' : 'over5000';
}

/**
 * How the answer ended, for analytics. `withoutShoes` means the engine had to drop the shoes because the budget did not
 * reach them; a user who said "Ayakkabım var" asked for outfits without shoes, so that is a plain `fits`.
 */
export function budgetResult(
  response: BudgetOutfits,
  ask: BudgetAsk,
): 'fits' | 'withoutShoes' | 'overBudget' | 'none' {
  if (response.outfits.length === 0) {
    return 'none';
  }
  if (response.overBudget) {
    return 'overBudget';
  }
  return response.withoutShoes && ask.includeShoes ? 'withoutShoes' : 'fits';
}

/** Does the wardrobe hold a pair of shoes? The default of "Ayakkabım var". */
export function wardrobeHasShoes(stats: WardrobeStats | undefined): boolean {
  return (stats?.byCategory ?? []).some(
    (entry) => entry.slug?.split('/')[0] === 'ayakkabi' && Number(entry.count) > 0,
  );
}

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface DateOption {
  value: string;
  label: string;
  /** Spoken in full: "Cuma, 20 Kasım". */
  spoken: string;
}

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/** Bugün, Yarın, then each day up to a week ahead as "Cum 20". */
export function dateOptions(now: Date): DateOption[] {
  const options: DateOption[] = [
    { value: 'today', label: tr.budgetDateToday, spoken: tr.budgetDateToday },
    { value: 'tomorrow', label: tr.budgetDateTomorrow, spoken: tr.budgetDateTomorrow },
  ];
  for (let ahead = 2; ahead <= BUDGET_DAYS_AHEAD; ahead += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    const weekday = formatWeekday(isoOf(day));
    options.push({
      value: isoOf(day),
      label: tr.budgetDateChip(formatShortWeekday(isoOf(day)), day.getDate()),
      spoken: `${weekday}, ${day.getDate()} ${MONTHS[day.getMonth()] ?? ''}`,
    });
  }
  return options;
}

/** "Bugün", "Yarın" or the chip's own label, for the summary under the header. */
export function dateLabel(date: string, now: Date): string {
  return dateOptions(now).find((option) => option.value === date)?.label ?? date;
}

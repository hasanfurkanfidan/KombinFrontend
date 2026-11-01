/** The target price is pre-filled this far below the current lowest price. */
export const TARGET_DISCOUNT = 0.1;

export type TargetError = 'required' | 'invalid' | 'notBelow';

/** 10 % below the current lowest price, in whole liras (never below a kuruş). */
export function prefillTarget(lowestPrice: number): number {
  const exact = lowestPrice * (1 - TARGET_DISCOUNT);
  const whole = Math.floor(exact);
  return whole > 0 ? whole : Math.max(0.01, Math.round(exact * 100) / 100);
}

/** Reads "1.934", "1934,50" or "1934.5" (a trailing ₺ and spaces are ignored). Null when it is not a number. */
export function parseAmountInput(text: string): number | null {
  const cleaned = text.replace(/[₺\s]/g, '');
  if (cleaned === '') {
    return null;
  }
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Number(normalized);
}

export function validateTarget(
  text: string,
  lowestPrice: number,
): { value: number | null; error: TargetError | null } {
  if (text.trim() === '') {
    return { value: null, error: 'required' };
  }
  const value = parseAmountInput(text);
  if (value === null || value <= 0) {
    return { value: null, error: 'invalid' };
  }
  if (value >= lowestPrice) {
    return { value, error: 'notBelow' };
  }
  return { value, error: null };
}

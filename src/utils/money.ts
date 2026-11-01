/**
 * The contract types decimals as `number | string` (OpenAPI 3.1 allows both on the wire);
 * the API sends numbers, but every consumer normalizes through this helper.
 */
export function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

/** 2149 -> "2.149", 649.9 -> "649,90". Whole amounts drop the decimals. */
export function formatAmount(value: number | string): string {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) {
    return '';
  }
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = amount < 0 && cents > 0 ? '-' : '';
  return fraction === 0
    ? `${sign}${grouped}`
    : `${sign}${grouped},${String(fraction).padStart(2, '0')}`;
}

/** TRY formatting used everywhere a price is shown: "2.149 ₺". */
export function formatTry(value: number | string): string {
  return `${formatAmount(value)} ₺`;
}

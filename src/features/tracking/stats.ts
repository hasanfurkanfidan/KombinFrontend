import type { Alert, AlertTrigger } from '@/api/models';
import { toNumber } from '@/utils/money';

const DAY_MS = 86_400_000;

/**
 * How long a trigger counts as unseen. The contract has no per-trigger "seen" flag (`consumedAt` is the backend's
 * notification bookkeeping, not the user's), so an alert that fired within this many days is the one to point at.
 */
export const RECENT_TRIGGER_DAYS = 7;

interface PriceChange {
  before: number;
  after: number;
}

function priceChange(trigger: AlertTrigger): PriceChange | null {
  if (trigger.priceBefore === null || trigger.priceAfter === null) {
    return null;
  }
  return { before: toNumber(trigger.priceBefore), after: toNumber(trigger.priceAfter) };
}

function priceDrops(triggers: readonly AlertTrigger[]): PriceChange[] {
  return triggers
    .filter((trigger) => trigger.kind === 'PriceDrop')
    .map(priceChange)
    .filter((change): change is PriceChange => change !== null && change.before > change.after);
}

/** Sum of `priceBefore − priceAfter` over the price-drop triggers. */
export function totalSavings(triggers: readonly AlertTrigger[]): number {
  return priceDrops(triggers).reduce((sum, change) => sum + (change.before - change.after), 0);
}

/** Average percent saved per price-drop trigger; null when nothing was caught yet. */
export function averageDiscountPercent(triggers: readonly AlertTrigger[]): number | null {
  const drops = priceDrops(triggers);
  if (drops.length === 0) {
    return null;
  }
  const percents = drops.map((change) => ((change.before - change.after) / change.before) * 100);
  return percents.reduce((sum, percent) => sum + percent, 0) / drops.length;
}

export function isBelowTarget(alert: Alert): boolean {
  return (
    alert.kind === 'PriceDrop' &&
    alert.targetPrice !== null &&
    alert.product.lowestPrice !== null &&
    toNumber(alert.product.lowestPrice) <= toNumber(alert.targetPrice)
  );
}

export function hasRecentTrigger(alert: Alert, now: Date): boolean {
  return (
    alert.lastTriggeredAt !== null &&
    now.getTime() - new Date(alert.lastTriggeredAt).getTime() <= RECENT_TRIGGER_DAYS * DAY_MS
  );
}

/** Headline numbers: products being watched, and how many of them are at or below their target price. */
export function watchSummary(alerts: readonly Alert[]): { watched: number; belowTarget: number } {
  const active = alerts.filter((alert) => alert.isActive);
  return {
    watched: new Set(active.map((alert) => alert.product.id)).size,
    belowTarget: new Set(active.filter(isBelowTarget).map((alert) => alert.product.id)).size,
  };
}

export type AlertStatus =
  | { kind: 'soldOut' }
  | { kind: 'belowTarget' }
  | { kind: 'increase'; amount: number }
  | { kind: 'drop'; amount: number }
  | { kind: 'backInStock' }
  | { kind: 'unchanged' };

/**
 * The status line of an alert row, from its current price and its most recent trigger. With an unseen trigger the
 * news itself ("850 ₺ düştü", back in stock) is the line, even when the price now also sits under the target.
 */
export function alertStatus(
  alert: Alert,
  triggers: readonly AlertTrigger[],
  hasUnseenTrigger = false,
): AlertStatus {
  // No offer in stock: the product has no lowest price.
  if (alert.product.lowestPrice === null) {
    return { kind: 'soldOut' };
  }
  const news = latestNews(alert, triggers);
  if (hasUnseenTrigger && (news?.kind === 'drop' || news?.kind === 'backInStock')) {
    return news;
  }
  if (isBelowTarget(alert)) {
    return { kind: 'belowTarget' };
  }
  return news ?? { kind: 'unchanged' };
}

/** What the alert's most recent trigger says, or null when it has none (or none that moved a price). */
function latestNews(alert: Alert, triggers: readonly AlertTrigger[]): AlertStatus | null {
  const last = triggers
    .filter((trigger) => trigger.alertId === alert.id)
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))[0];
  if (last?.kind === 'BackInStock') {
    return { kind: 'backInStock' };
  }
  const change = last ? priceChange(last) : null;
  if (change && change.after > change.before) {
    return { kind: 'increase', amount: change.after - change.before };
  }
  if (change && change.after < change.before) {
    return { kind: 'drop', amount: change.before - change.after };
  }
  return null;
}

/**
 * The one chalk rule of a Fiyatlar card: the chalk border and the chalk tag ("850 ₺ düştü", "Hedefin altında", "Stokta")
 * appear together, and only when the alert has an unseen trigger that is good news. Every other state is a plain card
 * with its status line (a price rise and "Tükendi" in `danger`, with their words).
 */
export function isChalkStatus(status: AlertStatus, hasUnseenTrigger: boolean): boolean {
  return (
    hasUnseenTrigger &&
    (status.kind === 'drop' || status.kind === 'belowTarget' || status.kind === 'backInStock')
  );
}

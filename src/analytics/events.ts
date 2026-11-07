import type { AlertKind, NotificationKind, OutfitCompleteness, OutfitKind } from '@/api/models';

/**
 * The analytics allow-list, mirrored from the backend README ("Analytics" table, `AnalyticsEventCatalog`).
 * Keep the two in step: an event or a property the backend does not list is rejected there, one by one.
 * `EventProps` makes call sites type-check; `EVENT_KEYS` is what the dev-only guard checks at runtime.
 */
export interface EventProps {
  app_open: Record<string, never>;
  app_background: Record<string, never>;
  screen_view: { screen: string };
  product_view: { productId: string; personaId?: string; source: string };
  /** `sort` is a catalog sort; `filters` is a comma-separated list of the filter names in use (may be empty). */
  product_list_view: { sort: string; filters: string };
  swipe: { personaId: string; decision: 'Like' | 'Dislike' | 'Skip' };
  onboarding_step: { step: string; action: 'next' | 'skip' | 'done' };
  alert_created: { kind: AlertKind };
  buy_click: { offerId: string; source: string };
  /** Only the length of what was typed, never the text. */
  search: { queryLength: number };
  notification_open: { notificationId: number; kind: NotificationKind };
  wardrobe_add_start: { source: 'camera' | 'library' | 'catalog' };
  /** `status` is how the add ended: `Ready`, `Failed` or `Timeout` (the analysis did not finish in time). */
  wardrobe_add_done: { status: 'Ready' | 'Failed' | 'Timeout'; durationMs: number };
  /** `status` is the outfit's completeness (`Complete`, `NeedsOne`, `CatalogOnly`): that is what the product learns from. */
  outfit_view: { kind: OutfitKind; status: OutfitCompleteness; occasion?: string };
  outfit_shuffle: Record<string, never>;
  outfit_feedback: { action: 'Save' | 'Dismiss' | 'Worn' | 'Shuffle'; reason?: string };
  outfit_gap_click: Record<string, never>;
  /** The pairing screen of a wardrobe item is on screen: how many pieces it goes with, and whether a catalog suggestion is shown. */
  wardrobe_pairings_view: { companionTotal: number; hasUnlock: boolean };
  /** "İncele" on the unlock card. */
  wardrobe_unlock_click: Record<string, never>;
}

export type EventName = keyof EventProps;

interface KeySpec {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

export const EVENT_KEYS: Record<EventName, KeySpec> = {
  app_open: { required: [], optional: [] },
  app_background: { required: [], optional: [] },
  screen_view: { required: ['screen'], optional: [] },
  product_view: { required: ['productId', 'source'], optional: ['personaId'] },
  product_list_view: { required: ['sort', 'filters'], optional: [] },
  swipe: { required: ['personaId', 'decision'], optional: [] },
  onboarding_step: { required: ['step', 'action'], optional: [] },
  alert_created: { required: ['kind'], optional: [] },
  buy_click: { required: ['offerId', 'source'], optional: [] },
  search: { required: ['queryLength'], optional: [] },
  notification_open: { required: ['notificationId', 'kind'], optional: [] },
  wardrobe_add_start: { required: ['source'], optional: [] },
  wardrobe_add_done: { required: ['status', 'durationMs'], optional: [] },
  outfit_view: { required: ['kind', 'status'], optional: ['occasion'] },
  outfit_shuffle: { required: [], optional: [] },
  outfit_feedback: { required: ['action'], optional: ['reason'] },
  outfit_gap_click: { required: [], optional: [] },
  wardrobe_pairings_view: { required: ['companionTotal', 'hasUnlock'], optional: [] },
  wardrobe_unlock_click: { required: [], optional: [] },
};

/** Property keys that name personal data; refused on every event. */
const FORBIDDEN_KEYS = new Set(['email', 'name', 'phone', 'address', 'token']);

/** The backend caps the serialized properties at 2 KB. */
export const MAX_PROPERTIES_BYTES = 2048;

/** Same normalisation as the backend: case-insensitive, ignoring `_` and `-` (so `E-Mail` is caught too). */
export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key.replace(/[_-]/g, '').toLowerCase());
}

export function isEventName(name: string): name is EventName {
  return Object.hasOwn(EVENT_KEYS, name);
}

/**
 * What is wrong with an event, as readable messages; empty when it is fine. This is the dev-only guard: `track()`
 * throws on a non-empty result in development and silently drops the event in production.
 */
export function findEventProblems(name: string, properties: Record<string, unknown>): string[] {
  if (!isEventName(name)) {
    return [`'${name}' is not an allowed analytics event`];
  }
  const spec = EVENT_KEYS[name];
  const problems: string[] = [];

  for (const [key, value] of Object.entries(properties)) {
    if (isForbiddenKey(key)) {
      problems.push(`'${key}' is not allowed: events carry no personal data`);
    } else if (!spec.required.includes(key) && !spec.optional.includes(key)) {
      problems.push(`'${key}' is not a property of '${name}'`);
    } else if (typeof value === 'object' && value !== null) {
      problems.push(`'${key}' must be a flat value`);
    }
  }
  for (const key of spec.required) {
    if (properties[key] === undefined || properties[key] === null) {
      problems.push(`'${key}' is required for '${name}'`);
    }
  }
  if (JSON.stringify(properties).length > MAX_PROPERTIES_BYTES) {
    problems.push(`properties of '${name}' are over ${MAX_PROPERTIES_BYTES} bytes`);
  }
  return problems;
}

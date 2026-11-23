import type {
  AlertKind,
  CategoryFamily,
  NotificationKind,
  OutfitCompleteness,
  OutfitKind,
  OutfitSlot,
  PostKind,
  PostTagKind,
  PostVisibility,
  ReportReason,
  SizePromptAnswer,
} from '@/api/models';

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
  /** A post came on screen. Ids and enums only; `position` is its index in the list (0-500). */
  post_view: {
    postId: string;
    source: 'feed' | 'profile' | 'creator' | 'mine' | 'link';
    position?: number;
  };
  post_tag_tap: { postId: string; tagKind: PostTagKind; hasOffer: boolean };
  post_like: { postId: string; liked: boolean };
  post_create_start: { kind: PostKind; source: 'camera' | 'library' | 'outfit' };
  post_create_done: {
    kind: PostKind;
    status: 'Live' | 'Draft' | 'NeedsReview' | 'Blocked' | 'Failed' | 'Cancelled';
    tagCount: number;
    visibility?: PostVisibility;
    durationMs: number;
  };
  post_report: { postId: string; reason: ReportReason };
  creator_profile_view: { creatorId: string };
  try_with_wardrobe: { postId: string; anchorCount: number; outfitCount: number };
  /** A Google or Apple sign-in succeeded. Not in the backend allow-list yet, so nothing emits it (see `externalSignIn.ts`). */
  auth_external: { provider: 'google' | 'apple'; isNewUser: boolean };
  /** "Görselden bul" opened: from the camera in Keşfet's search field (`explore`), elsewhere (`other`); `home` was the removed Keşfet tile. */
  lens_open: { entry: 'explore' | 'home' | 'other' };
  /** One search: counts, the time on the device (downscale + upload + answer) and where the photo came from. Never image data. */
  lens_search: {
    regionCount: number;
    resultCount: number;
    durationMs: number;
    source: 'camera' | 'gallery';
  };
  /** A product in a region's rail: its position (0-11) and the result's `level`. */
  lens_result_tap: { productId: string; position: number; similarity: 'close' | 'similar' };
  /** "Dolabıma ekle" on a region; `family` is absent for the whole photo. */
  lens_add_to_wardrobe: { family?: CategoryFamily };
  /**
   * A budget answer came on screen. The budget is a band, never the amount; `result` says whether outfits fit, fit only
   * without shoes (the engine fell back), only the closest one over the budget came back, or nothing did.
   */
  budget_outfit_view: {
    budgetBand: 'under500' | '500to1500' | '1500to5000' | 'over5000';
    outfitCount: number;
    result: 'fits' | 'withoutShoes' | 'overBudget' | 'none';
    occasion?: string;
  };
  /** "Başka göster": the seed that was asked for (0-1000). */
  budget_outfit_shuffle: { seed: number };
  /** A trip was planned: numbers only, never the destination or the dates. */
  trip_plan_create: {
    days: number;
    pieceCount: number;
    coveragePercent: number;
    gapCount: number;
  };
  /** A plan is on screen: just planned (`plan`) or a saved one opened (`saved`). */
  trip_plan_view: { days: number; source: 'plan' | 'saved' };
  /** "Satın al" on a gap's suggestion; the slot of the suggested piece. */
  trip_gap_click: { slot: OutfitSlot };
  /** "Dolap özeti" is on screen. Counts and one flag, never an amount; the backend caps both counts at 2000. */
  wardrobe_summary_view: { pieceCount: number; unwornCount: number; hasEstimate: boolean };
  /** A "did the size fit?" question came on screen (once per question). */
  size_prompt_view: { promptId: string };
  /** The question was answered; `answer` is the enum name, never the size. */
  size_prompt_answer: { promptId: string; answer: SizePromptAnswer };
  /** Kombin Ligi. No pair, entry, picture or player identifier is ever a property. */
  league_join: Record<string, never>;
  league_leave: Record<string, never>;
  /** One answered pair: `counted` is whether the vote's response counted it. */
  league_vote: { choice: 'left' | 'right' | 'skip'; counted: boolean };
  league_report: Record<string, never>;
  /** The results screen settled with data; `status` is the results' own status. */
  league_results_view: { status: 'Final' | 'UnderReview' | 'Removed' };
  league_table_view: Record<string, never>;
  /** Ask a friend: an ask was created (201). Never the link, token or outfit contents. */
  ask_create: { askId: string; kind: 'Single' | 'Pair' };
  /** The share sheet completed (not dismissed). */
  ask_share: { askId: string };
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
  post_view: { required: ['postId', 'source'], optional: ['position'] },
  post_tag_tap: { required: ['postId', 'tagKind', 'hasOffer'], optional: [] },
  post_like: { required: ['postId', 'liked'], optional: [] },
  post_create_start: { required: ['kind', 'source'], optional: [] },
  post_create_done: {
    required: ['kind', 'status', 'tagCount', 'durationMs'],
    optional: ['visibility'],
  },
  post_report: { required: ['postId', 'reason'], optional: [] },
  creator_profile_view: { required: ['creatorId'], optional: [] },
  try_with_wardrobe: { required: ['postId', 'anchorCount', 'outfitCount'], optional: [] },
  auth_external: { required: ['provider', 'isNewUser'], optional: [] },
  lens_open: { required: ['entry'], optional: [] },
  lens_search: {
    required: ['regionCount', 'resultCount', 'durationMs', 'source'],
    optional: [],
  },
  lens_result_tap: { required: ['productId', 'position', 'similarity'], optional: [] },
  lens_add_to_wardrobe: { required: [], optional: ['family'] },
  budget_outfit_view: {
    required: ['budgetBand', 'outfitCount', 'result'],
    optional: ['occasion'],
  },
  budget_outfit_shuffle: { required: ['seed'], optional: [] },
  trip_plan_create: {
    required: ['days', 'pieceCount', 'coveragePercent', 'gapCount'],
    optional: [],
  },
  trip_plan_view: { required: ['days', 'source'], optional: [] },
  trip_gap_click: { required: ['slot'], optional: [] },
  wardrobe_summary_view: {
    required: ['pieceCount', 'unwornCount', 'hasEstimate'],
    optional: [],
  },
  size_prompt_view: { required: ['promptId'], optional: [] },
  size_prompt_answer: { required: ['promptId', 'answer'], optional: [] },
  league_join: { required: [], optional: [] },
  league_leave: { required: [], optional: [] },
  league_vote: { required: ['choice', 'counted'], optional: [] },
  league_report: { required: [], optional: [] },
  league_results_view: { required: ['status'], optional: [] },
  league_table_view: { required: [], optional: [] },
  ask_create: { required: ['askId', 'kind'], optional: [] },
  ask_share: { required: ['askId'], optional: [] },
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

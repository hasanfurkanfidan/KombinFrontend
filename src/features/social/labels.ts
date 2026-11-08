import type {
  Post,
  PostStatus,
  PostSummary,
  PostTag,
  PostVisibility,
  ReportReason,
} from '@/api/models';
import { matchBadgeScore } from '@/features/catalog/matchBadge';
import { tr } from '@/i18n/tr';
import { formatTry, toNumber } from '@/utils/money';
import { withPossessive } from '@/utils/turkish';

/** A post can carry at most this many tags (the backend refuses more). */
export const MAX_TAGS = 6;
/** Caption and label limits of the contract. */
export const MAX_CAPTION = 300;
export const MAX_LABEL = 60;

export const VISIBILITY_OPTIONS: readonly {
  value: PostVisibility;
  label: string;
  hint: string;
}[] = [
  {
    value: 'Private',
    label: tr.postVisibilityPrivate,
    hint: tr.postVisibilityPrivateHint,
  },
  {
    value: 'Followers',
    label: tr.postVisibilityFollowers,
    hint: tr.postVisibilityFollowersHint,
  },
  {
    value: 'Public',
    label: tr.postVisibilityPublic,
    hint: tr.postVisibilityPublicHint,
  },
];

/** New posts are private until the author chooses otherwise. */
export const DEFAULT_VISIBILITY: PostVisibility = 'Private';

export const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'Nudity', label: tr.reportNudity },
  { value: 'Violence', label: tr.reportViolence },
  { value: 'Hate', label: tr.reportHate },
  { value: 'Harassment', label: tr.reportHarassment },
  { value: 'Spam', label: tr.reportSpam },
  { value: 'Scam', label: tr.reportScam },
  { value: 'Other', label: tr.reportOther },
];

const STATUS_LABELS: Record<PostStatus, string> = {
  Processing: tr.postStatusProcessing,
  Draft: tr.postStatusDraft,
  NeedsReview: tr.postStatusNeedsReview,
  Blocked: tr.postStatusBlocked,
  Live: tr.postStatusLive,
  Hidden: tr.postStatusHidden,
  Deleted: tr.postStatusDeleted,
  Failed: tr.postStatusFailed,
};

export function statusLabel(status: PostStatus): string {
  return STATUS_LABELS[status];
}

/** The line under a post's status in "Gönderilerim": the backend's own message wins over our fallback. */
export function statusMessage(post: Pick<Post, 'status' | 'statusMessage'>): string | null {
  if (post.statusMessage) {
    return post.statusMessage;
  }
  switch (post.status) {
    case 'NeedsReview':
      return tr.postStatusNeedsReviewHint;
    case 'Hidden':
      return tr.postStatusHiddenHint;
    case 'Failed':
      return tr.postStatusFailedHint;
    default:
      return null;
  }
}

export function visibilityLabel(visibility: PostVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? visibility;
}

/**
 * The line under the photo: "Bu kombin toplam 4.829 ₺ · 4 parça · 2'si dolabında var". The numbers are the
 * backend's, per viewer; nothing is recomputed here. The price is left out when no tagged piece has an offer, and
 * the last part when the viewer is signed out (`ownedCount` is `null`).
 */
export function postBand(summary: PostSummary): string {
  const pieces = toNumber(summary.pieceCount);
  const head =
    summary.totalPrice === null
      ? `Bu kombin ${pieces} parça`
      : tr.postBandTotal(formatTry(summary.totalPrice), pieces);
  if (summary.ownedCount === null) {
    return head;
  }
  const owned = toNumber(summary.ownedCount);
  return `${head} · ${owned === 0 ? 'hiçbiri dolabında yok' : tr.postBandOwned(withPossessive(owned))}`;
}

export function matchText(score: number | string | null): string | null {
  const value = matchBadgeScore(score);
  return value === null ? null : tr.postMatch(value);
}

/** The centre of a tag's box as fractions of the picture: where its dot sits (rounded, so 0.1 + 0.4 / 2 is 0.3). */
export function dotCenter(box: {
  x: number | string;
  y: number | string;
  w: number | string;
  h: number | string;
}): {
  left: number;
  top: number;
} {
  const round = (value: number) => Math.round(value * 10_000) / 10_000;
  return {
    left: round(toNumber(box.x) + toNumber(box.w) / 2),
    top: round(toNumber(box.y) + toNumber(box.h) / 2),
  };
}

export function isOutfitPost(post: Pick<Post, 'kind' | 'image'>): boolean {
  return post.image === null || post.kind === 'Outfit';
}

/** A tag's offer as the `openOffer` helper wants it. */
export function tagOffer(tag: Pick<PostTag, 'offer'>): { id: string; goPath: string } | null {
  return tag.offer ? { id: tag.offer.offerId, goPath: tag.offer.goPath } : null;
}

export function initialOf(name: string): string {
  return (name.trim().charAt(0) || '?').toLocaleUpperCase('tr-TR');
}

/** The product ids a post's tags point at (a wardrobe piece that came from the catalog has one too). */
export function taggedProductIds(post: Pick<Post, 'tags'>): string[] {
  return [...new Set(post.tags.flatMap((tag) => (tag.productId ? [tag.productId] : [])))];
}

/** A 0-1 fraction as a style percentage without float noise: 0.30000000000000004 -> "30%". */
export function pct(fraction: number): `${number}%` {
  return `${Math.round(fraction * 10_000) / 100}%`;
}

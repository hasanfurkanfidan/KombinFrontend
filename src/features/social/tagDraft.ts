import type { PostProposal, ProductColor, PublishTag } from '@/api/models';
import { toNumber } from '@/utils/money';

import { MAX_LABEL, MAX_TAGS } from './labels';

/** What the author decided a dot is. Only a dot with a choice is ever published. */
export type DotChoice =
  | { kind: 'Wardrobe'; wardrobeItemId: string; name: string }
  | { kind: 'Product'; productId: string; name: string }
  | { kind: 'Unknown'; label: string };

export interface DraftDot {
  /** Local key: proposals keep their server id, dots the author adds get a `new-…` one. */
  key: string;
  source: PostProposal['source'];
  /** Box in 0-1 fractions of the picture; the dot is drawn at its centre. */
  x: number;
  y: number;
  w: number;
  h: number;
  categorySlug: string | null;
  color: ProductColor | null;
  /** The author's decision. `null` is a proposal nobody has confirmed: it is never sent. */
  choice: DotChoice | null;
  /** A target the proposal already points at (a saved outfit's pieces): one tap confirms it, nothing is assumed. */
  suggestion: DotChoice | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/** The size a dot added by hand gets: roughly a garment's share of a full-length photo. */
const NEW_DOT = { w: 0.3, h: 0.25 } as const;

/**
 * The editor starts from the proposals. None of them is confirmed: `choice` stays empty until the author picks what
 * the dot is (or accepts the suggestion the proposal carries, which is its own explicit tap).
 */
export function dotsFromProposals(proposals: readonly PostProposal[]): DraftDot[] {
  return proposals.map((proposal) => ({
    key: proposal.id,
    source: proposal.source,
    x: toNumber(proposal.x),
    y: toNumber(proposal.y),
    w: toNumber(proposal.w),
    h: toNumber(proposal.h),
    categorySlug: proposal.categorySlug,
    color: proposal.color,
    choice: null,
    suggestion: proposal.wardrobeItemId
      ? {
          kind: 'Wardrobe',
          wardrobeItemId: proposal.wardrobeItemId,
          name: proposal.categorySlug ?? '',
        }
      : proposal.productId
        ? { kind: 'Product', productId: proposal.productId, name: proposal.categorySlug ?? '' }
        : null,
  }));
}

let counter = 0;

/** A dot the author adds: in the middle of the picture, unconfirmed like every other. `null` when the limit is reached. */
export function addDot(dots: readonly DraftDot[]): DraftDot[] {
  if (dots.length >= MAX_TAGS) {
    return [...dots];
  }
  counter += 1;
  return [
    ...dots,
    {
      key: `new-${counter}`,
      source: 'User',
      x: round((1 - NEW_DOT.w) / 2),
      y: round((1 - NEW_DOT.h) / 2),
      w: NEW_DOT.w,
      h: NEW_DOT.h,
      categorySlug: null,
      color: null,
      choice: null,
      suggestion: null,
    },
  ];
}

export function removeDot(dots: readonly DraftDot[], key: string): DraftDot[] {
  return dots.filter((dot) => dot.key !== key);
}

/** Moves a dot's centre to a point of the picture (fractions), keeping its box inside 0-1. */
export function moveDot(
  dots: readonly DraftDot[],
  key: string,
  center: { left: number; top: number },
): DraftDot[] {
  return dots.map((dot) =>
    dot.key === key
      ? {
          ...dot,
          x: round(clamp(center.left - dot.w / 2, 0, 1 - dot.w)),
          y: round(clamp(center.top - dot.h / 2, 0, 1 - dot.h)),
        }
      : dot,
  );
}

export function chooseDot(dots: readonly DraftDot[], key: string, choice: DotChoice): DraftDot[] {
  return dots.map((dot) => (dot.key === key ? { ...dot, choice: normalise(choice) } : dot));
}

function normalise(choice: DotChoice): DotChoice {
  return choice.kind === 'Unknown'
    ? { kind: 'Unknown', label: choice.label.trim().slice(0, MAX_LABEL) }
    : choice;
}

export function unconfirmedCount(dots: readonly DraftDot[]): number {
  return dots.filter((dot) => dot.choice === null).length;
}

/** Publishing waits until every dot is either confirmed or deleted. */
export function canPublish(dots: readonly DraftDot[]): boolean {
  return unconfirmedCount(dots) === 0 && dots.length <= MAX_TAGS;
}

/**
 * The tags of the publish request: **only dots the author confirmed**. This is the last line of defence for the
 * rule that no proposal reaches a viewer on its own: even if the screen let an unconfirmed dot through, it is
 * dropped here and never serialised.
 */
export function toPublishTags(dots: readonly DraftDot[]): PublishTag[] {
  return dots.flatMap((dot): PublishTag[] => {
    const choice = dot.choice;
    if (choice === null) {
      return [];
    }
    const box = { x: dot.x, y: dot.y, w: dot.w, h: dot.h };
    switch (choice.kind) {
      case 'Wardrobe':
        return [
          {
            kind: 'Wardrobe',
            ...box,
            wardrobeItemId: choice.wardrobeItemId,
            productId: null,
            label: null,
          },
        ];
      case 'Product':
        return [
          {
            kind: 'Product',
            ...box,
            wardrobeItemId: null,
            productId: choice.productId,
            label: null,
          },
        ];
      case 'Unknown':
        return [
          {
            kind: 'Unknown',
            ...box,
            wardrobeItemId: null,
            productId: null,
            label: choice.label || null,
          },
        ];
    }
  });
}

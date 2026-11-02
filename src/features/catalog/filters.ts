import { tr } from '@/i18n/tr';

import type { Audience, ListProductsQuery, ProductColor } from '@/api/models';

/** Page size used by the Keşfet grid. */
export const PAGE_SIZE = 20;

/** The contract types `Sort` as a free string; these are the values the backend accepts. */
export const SORT_VALUES = ['match', 'relevance', 'priceAsc', 'priceDesc', 'newest'] as const;
export type SortValue = (typeof SORT_VALUES)[number];

export interface ProductFilters {
  categorySlug?: string;
  color?: ProductColor;
  audience?: Audience;
  sort?: SortValue;
  /** The active persona: adds match scores and makes `sort=match` available. Not a user-facing filter. */
  personaId?: string;
}

export const sortLabels: Record<SortValue, string> = {
  match: tr.sortMatch,
  relevance: tr.sortRelevance,
  priceAsc: tr.sortPriceAsc,
  priceDesc: tr.sortPriceDesc,
  newest: tr.sortNewest,
};

// Typed as Records over the generated unions: a new backend enum value fails the typecheck until labelled.
export const audienceLabels: Record<Audience, string> = {
  Women: tr.audienceWomen,
  Men: tr.audienceMen,
  Unisex: tr.audienceUnisex,
  Kids: tr.audienceKids,
};

export const colorLabels: Record<ProductColor, string> = {
  Black: tr.colorBlack,
  White: tr.colorWhite,
  Grey: tr.colorGrey,
  Navy: tr.colorNavy,
  Blue: tr.colorBlue,
  Green: tr.colorGreen,
  Beige: tr.colorBeige,
  Brown: tr.colorBrown,
  Red: tr.colorRed,
  Pink: tr.colorPink,
  Purple: tr.colorPurple,
  Yellow: tr.colorYellow,
  Orange: tr.colorOrange,
  Multi: tr.colorMulti,
  Other: tr.colorOther,
};

export function hasActiveFilters(filters: ProductFilters): boolean {
  return Boolean(filters.categorySlug ?? filters.color ?? filters.audience ?? filters.sort);
}

/** Names (never values) of the filters in use, comma-separated: what `product_list_view` reports. */
export function filterNames(filters: ProductFilters): string {
  return [
    filters.categorySlug ? 'category' : null,
    filters.color ? 'color' : null,
    filters.audience ? 'audience' : null,
  ]
    .filter(Boolean)
    .join(',');
}

/** Maps app filters onto the contract's query parameters. */
export function toListQuery(filters: ProductFilters, page?: number): ListProductsQuery {
  return {
    CategorySlug: filters.categorySlug,
    Color: filters.color,
    Audience: filters.audience,
    Sort: filters.sort,
    PersonaId: filters.personaId,
    Page: page,
    PageSize: PAGE_SIZE,
  };
}

/** `match` is the default order while a persona is active; without one the backend rejects it. */
export function defaultSort(personaId: string | undefined): SortValue {
  return personaId ? 'match' : 'relevance';
}

/** Filters as the product query sees them: the persona joined in, and the sort resolved to a usable value. */
export function withPersona(
  filters: ProductFilters,
  personaId: string | undefined,
): ProductFilters {
  const requested = filters.sort;
  const sort = requested === 'match' && !personaId ? undefined : requested;
  return {
    ...filters,
    personaId,
    sort: sort ?? (personaId ? 'match' : undefined),
  };
}

/** Reads filters from raw route search params, dropping anything that is not a known value. */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ProductFilters {
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const category = single(params.category);
  const color = single(params.color);
  const audience = single(params.audience);
  const sort = single(params.sort);
  return {
    categorySlug: category || undefined,
    color: color && Object.hasOwn(colorLabels, color) ? (color as ProductColor) : undefined,
    audience:
      audience && Object.hasOwn(audienceLabels, audience) ? (audience as Audience) : undefined,
    sort: SORT_VALUES.find((value) => value === sort),
  };
}

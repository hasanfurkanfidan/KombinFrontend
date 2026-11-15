const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Dynamic segments that are not uuids. A creator's handle names a person and must never reach analytics, so the
 * segment is replaced whatever it holds; the same goes for any id route, in case an id is ever not a uuid.
 */
const DYNAMIC_SEGMENTS: readonly [RegExp, string][] = [
  [/^creators\/[^/]+/, 'creators/:handle'],
  [/^(product|wardrobe|posts|users)\/(?!new$|mine$)[^/]+/, '$1/:id'],
  [/^outfits\/(?!daily$|how-to-wear$|saved$)[^/]+/, 'outfits/:id'],
];

/**
 * `screen_view`'s `screen` value for a route path: ids and handles are replaced so one screen is one value
 * (`/product/6f1c…` -> `product/:id`, `/creators/ayse` -> `creators/:handle`), the root is `home`.
 */
export function screenName(pathname: string): string {
  let name = pathname.replace(UUID, ':id').replace(/^\/+|\/+$/g, '');
  for (const [pattern, replacement] of DYNAMIC_SEGMENTS) {
    name = name.replace(pattern, replacement);
  }
  return name === '' ? 'home' : name.slice(0, 60);
}

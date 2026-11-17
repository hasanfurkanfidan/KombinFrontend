/**
 * Query parameters that only sign a private link (S3 / MinIO / R2 presigned GETs, Google and Azure signed URLs). They
 * change on every response while the object behind them does not.
 */
const SIGNING_PARAMS = new Set([
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-algorithm',
  'x-goog-signature',
  'signature',
  'awsaccesskeyid',
  'sig',
]);

function isSigned(query: string): boolean {
  return query
    .split('&')
    .some((pair) => SIGNING_PARAMS.has(decodeSafe(pair.split('=')[0] ?? '').toLowerCase()));
}

function decodeSafe(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * The disk-cache key of a remote image, or `undefined` when the plain address is already the right key.
 *
 * The backend serves private pictures (a post's feed image and preview, a try-on render, an original) as presigned
 * links whose query string carries a new signature and expiry on every response; the cache would take each one for a
 * new image and download it again. For such a link the key is the address **without its query string**: origin and
 * path, which the backend builds as `{area}/{userId}/{ownerId}/{variant}.{ext}` (every id a random GUID, an object is
 * never rewritten with different bytes once a client can see it; league copies have a random key of their own).
 *
 * The query is dropped **only when it carries a signature**. A catalog image from a retailer's CDN may choose its size
 * or crop by query (`?w=300`), and two such links are different pictures: they keep the full address as the key.
 * The origin stays part of the key, so the same path on two hosts never collides. A fragment is never part of it.
 * Local files and `data:` URIs have nothing to cache by key and get `undefined`.
 */
export function imageCacheKey(uri: string): string | undefined {
  if (!/^https?:\/\//i.test(uri)) {
    return undefined;
  }
  const hash = uri.indexOf('#');
  const withoutFragment = hash === -1 ? uri : uri.slice(0, hash);
  const questionMark = withoutFragment.indexOf('?');
  if (questionMark === -1) {
    return undefined;
  }
  const query = withoutFragment.slice(questionMark + 1);
  return isSigned(query) ? withoutFragment.slice(0, questionMark) : undefined;
}

/**
 * Query parameters that mark a link as signed (S3 / MinIO / R2 presigned GETs, Google signed URLs, the generic
 * `Signature` pair, `sig`). They change on every response while the object behind them does not.
 */
const SIGNATURE_MARKERS = new Set([
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-algorithm',
  'x-goog-signature',
  'signature',
  'awsaccesskeyid',
  'sig',
]);

/** Parameters that only sign a link or say how long it lives, besides the markers and the `x-amz-` / `x-goog-` families. */
const OTHER_SIGNING_PARAMS = new Set(['expires', 'googleaccessid']);
const SIGNING_PREFIXES = ['x-amz-', 'x-goog-'];

/** The rest of an Azure SAS token. They count as signing only when the token's `sv` (version) is there too. */
const SAS_PARAMS = new Set([
  'sv',
  'st',
  'se',
  'sr',
  'sp',
  'spr',
  'sip',
  'ss',
  'srt',
  'skoid',
  'sktid',
  'skt',
  'ske',
  'sks',
  'skv',
]);

function decodeSafe(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function paramName(pair: string): string {
  return decodeSafe(pair.split('=')[0] ?? '').toLowerCase();
}

function isSigningParam(name: string, isSas: boolean): boolean {
  return (
    SIGNATURE_MARKERS.has(name) ||
    OTHER_SIGNING_PARAMS.has(name) ||
    SIGNING_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    (isSas && SAS_PARAMS.has(name))
  );
}

/**
 * The disk-cache key of a remote image, or `undefined` when the plain address is already the right key.
 *
 * The backend serves private pictures (a post's feed image and preview, a try-on render, an original) as presigned
 * links whose query string carries a new signature and expiry on every response; the cache would take each one for a
 * new image and download it again. For such a link the key is the address **without its signing parameters**: origin
 * and path, which the backend builds as `{area}/{userId}/{ownerId}/{variant}.{ext}` (every id a random GUID, an object
 * is never rewritten with different bytes once a client can see it; league copies have a random key of their own). The
 * backend's links carry nothing but signing parameters, so its key is just origin and path.
 *
 * Only the signing and expiry parameters are dropped. A signed link from a CDN may choose its size or crop by query
 * (`?w=300&sig=…`), and two such links are different pictures: the other parameters stay in the key, sorted so their
 * order does not matter. An address that carries no signature keeps its full URL as the key (`undefined`). The origin
 * stays part of the key, so the same path on two hosts never collides. A fragment is never part of it. Local files and
 * `data:` URIs have nothing to cache by key and get `undefined`.
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
  const pairs = withoutFragment
    .slice(questionMark + 1)
    .split('&')
    .filter((pair) => pair !== '');
  if (!pairs.some((pair) => SIGNATURE_MARKERS.has(paramName(pair)))) {
    return undefined;
  }
  const isSas = pairs.some((pair) => paramName(pair) === 'sv');
  const kept = pairs.filter((pair) => !isSigningParam(paramName(pair), isSas)).sort();
  const base = withoutFragment.slice(0, questionMark);
  return kept.length === 0 ? base : `${base}?${kept.join('&')}`;
}

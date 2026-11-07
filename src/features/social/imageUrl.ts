/**
 * Post photos are presigned URLs that expire after an hour, and every response carries a new one. The native image
 * cache is keyed by URL, so a refetch would download the same photo again. Instead the first URL seen for a post
 * (the key is the post id) keeps being used for 45 minutes, which is inside the hour it is valid for; after that the
 * newest URL replaces it.
 */
const REUSE_MS = 45 * 60_000;
const MAX_ENTRIES = 300;

const seen = new Map<string, { url: string; at: number }>();

export function stableImageUrl(postId: string, url: string, now: number = Date.now()): string {
  const known = seen.get(postId);
  if (known && now - known.at < REUSE_MS) {
    return known.url;
  }
  seen.delete(postId);
  seen.set(postId, { url, at: now });
  if (seen.size > MAX_ENTRIES) {
    const oldest = seen.keys().next().value;
    if (oldest !== undefined) {
      seen.delete(oldest);
    }
  }
  return url;
}

/** For tests. */
export function resetImageUrls(): void {
  seen.clear();
}

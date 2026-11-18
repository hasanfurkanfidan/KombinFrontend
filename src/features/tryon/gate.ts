// Session-wide facts about the try-on that no single screen owns. Nothing here is a secret or a body value: it is only
// "the server said no / not yet" and "this one was already reported". Forgotten with the session (`userScope`).

/** The server's switch is off (404 `TryOn.Disabled`): nobody asks again until the app restarts or another user signs in. */
let featureOff = false;
/** The hourly allowance ran out (429): nothing is asked before this moment (epoch ms). */
let blockedUntil = 0;
const reported = new Set<string>();
const failedDraws = new Set<string>();

/** With no `Retry-After` the wait is long: the allowance is per hour, and a later screen can try again. */
export const UNKNOWN_RETRY_AFTER_MS = 10 * 60_000;

export function noteTryOnDisabled(): void {
  featureOff = true;
}

/** Remembers a 429; returns the moment the next ask is allowed. */
export function noteTryOnRateLimited(retryAfterSeconds: number | null): number {
  const wait = retryAfterSeconds === null ? UNKNOWN_RETRY_AFTER_MS : retryAfterSeconds * 1000;
  blockedUntil = Math.max(blockedUntil, Date.now() + wait);
  return blockedUntil;
}

export function isTryOnOff(): boolean {
  return featureOff;
}

/** The moment asking is allowed again after a 429, or `0` when it is allowed now. */
export function tryOnBlockedUntil(): number {
  return blockedUntil > Date.now() ? blockedUntil : 0;
}

/** Subjects ("outfit:<id>", "product:<id>") the user already reported in this session. */
export function markReported(key: string): void {
  reported.add(key);
}

export function wasReported(key: string): boolean {
  return reported.has(key);
}

/** A drawing the user asked for failed (or came back Unavailable): its action stays hidden for the rest of the session. */
export function markDrawFailed(key: string): void {
  failedDraws.add(key);
}

export function didDrawFail(key: string): boolean {
  return failedDraws.has(key);
}

export function resetTryOnGate(): void {
  featureOff = false;
  blockedUntil = 0;
  reported.clear();
  failedDraws.clear();
}

/**
 * Route params arrive from outside the app too: any `kombin://…` link opens a route with whatever params it carries.
 * Everything a screen sends to the API or navigates to is checked here first; a param that does not have the expected
 * shape is treated as missing (the route then goes home instead of asking the backend about nonsense).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The backend's creator handle rule: 3-30 characters of a-z, 0-9, '.' and '_' (compared case-insensitively). */
const HANDLE = /^[a-z0-9._]{3,30}$/i;

/** An in-app path: one leading slash (never `//host`), then route characters only. No scheme, query or fragment. */
const IN_APP_PATH = /^\/(?!\/)[A-Za-z0-9/_\-()[\]]*$/;

type Param = string | string[] | undefined;

function single(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** The param when it is a uuid (every id the API hands out is one), otherwise `null`. */
export function uuidParam(value: Param): string | null {
  const one = single(value);
  return isUuid(one) ? one : null;
}

/** A creator handle param, or `null` when it cannot be one. */
export function handleParam(value: Param): string | null {
  const one = single(value);
  return one !== undefined && HANDLE.test(one) ? one : null;
}

/** A `returnTo` param, only when it is a path inside the app; anything else (a URL, `//host`) is dropped. */
export function inAppPath(value: Param): string | undefined {
  const one = single(value);
  return one !== undefined && IN_APP_PATH.test(one) ? one : undefined;
}

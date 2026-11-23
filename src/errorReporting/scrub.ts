import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

/**
 * The privacy filter of error reporting: every event and breadcrumb passes through here before it leaves the phone.
 * Everything is built anew from an allow-list, so a field the SDK adds in a later version is dropped, not sent.
 * Nothing personal may survive: no user, no request, no device name, no URLs with their queries, no typed text.
 */

const MAX_TEXT = 300;
const MAX_INPUT = 2000;

type Dict = Record<string, unknown>;
type Primitive = string | number | boolean;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function primitive(value: unknown): Primitive | undefined {
  return str(value) ?? num(value) ?? bool(value);
}

/** Copies the listed keys whose values are strings, numbers or booleans; `undefined` when none is left. */
function pickPrimitives(source: unknown, keys: readonly string[]): Dict | undefined {
  if (!isDict(source)) {
    return undefined;
  }
  const out: Dict = {};
  for (const key of keys) {
    const value = primitive(source[key]);
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Drops `undefined` values so the built object carries only what was allowed and present. */
function compact<T extends Dict>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------------------------

// Letters (Turkish included) and digits: a quote right after one of them is an apostrophe ("Ayşe'nin", "can't").
const WORD_CHAR = 'A-Za-z0-9ÇĞİÖŞÜçğıöşüÂÎÛâîû';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const URL_LIKE = /\b(?:https?|file|content|ph|data|s3|blob|assets-library|kombin):[^\s"'“”«»<>]*/gi;
const WWW = /\bwww\.[^\s"'“”«»<>]+/gi;
/** An object key or file path with an image/file extension (`u/123/abc/thumb.jpg`): picture names are personal. */
const FILE_KEY = new RegExp(
  `[${WORD_CHAR}_.-]*(?:/[${WORD_CHAR}_.-]+)*\\.(?:jpe?g|png|webp|heic|heif|gif|bmp|mp4|mov|pdf)\\b`,
  'gi',
);
const EMAIL = new RegExp(`[${WORD_CHAR}._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}`, 'g');
const QUOTED: readonly RegExp[] = [
  /"[^"\n]*"/g,
  /“[^”\n]*”/g,
  /„[^“”\n]*[“”]/g,
  /«[^»\n]*»/g,
  /‘[^’\n]*’/g,
  /`[^`\n]*`/g,
];
const SINGLE_QUOTED = new RegExp(`(^|[^${WORD_CHAR}])'[^'\\n]*'`, 'g');
/** `@handle` (not an e-mail, which is replaced first, and not a package scope such as `@sentry/…`). */
const HANDLE = /(^|[^A-Za-z0-9._%+-])@[A-Za-z0-9_.]+(?![A-Za-z0-9_./])/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6 =
  /\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:)+:(?:[0-9a-f]{1,4}\b:?)*/gi;
/** The query or fragment of a path that is not a full URL (`/outfits#…`, `/search?q=…`). */
const PATH_QUERY = /(\/[^\s?#"'“”«»<>`]*)[?#][^\s"'“”«»<>`]*/g;
const LONG_HEX = /\b[0-9a-f]{16,}\b/gi;
/** A run of digits with optional phone separators; the callback decides between a phone number and an id. */
const NUMBER_RUN = /(?:\+|\b)\d[\d ().-]{4,}\d\b/g;

function replaceNumberRun(match: string): string {
  const digits = match.replace(/\D/g, '');
  const hasSeparator = /[ ().-]/.test(match);
  const phoneLike =
    digits.length >= 10 &&
    digits.length <= 15 &&
    (match.startsWith('+') || digits.startsWith('0') || hasSeparator);
  if (phoneLike) {
    return '[number]';
  }
  return match.replace(/\d{6,}/g, ':id');
}

/**
 * Removes what could identify a person from free text (an error message): URLs and file keys, e-mail addresses,
 * tokens, quoted text (often what the user typed), ids, phone numbers. At most 300 characters are kept.
 */
export function scrubText(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  // Long input is cut first so no pattern ever scans an unbounded string.
  let out = text
    .slice(0, MAX_INPUT)
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(URL_LIKE, '[url]')
    .replace(WWW, '[url]')
    .replace(EMAIL, '[email]')
    .replace(HANDLE, '$1[handle]')
    .replace(FILE_KEY, '[url]')
    .replace(PATH_QUERY, '$1')
    .replace(IPV6, '[ip]')
    .replace(IPV4, '[ip]');
  for (const pattern of QUOTED) {
    out = out.replace(pattern, '"[text]"');
  }
  out = out
    .replace(SINGLE_QUOTED, '$1"[text]"')
    .replace(UUID, ':id')
    .replace(LONG_HEX, ':id')
    .replace(NUMBER_RUN, replaceNumberRun)
    .replace(/\d{6,}/g, ':id');
  return out.length > MAX_TEXT ? out.slice(0, MAX_TEXT) : out;
}

// ---------------------------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------------------------

const SEGMENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENT_HEX = /^[0-9a-f]{16,}$/i;
const SEGMENT_TOKEN = /^[A-Za-z0-9_+=~.-]{16,}$/;
/** Route segments of our own never contain a dot, a percent escape or a non-ASCII letter. */
const SEGMENT_FREE_TEXT = /[.%]|[^\x20-\x7e]/;
/** Collections whose next segment names a person (a creator's handle) rather than an id. */
const HANDLE_COLLECTIONS = new Set(['creators']);

function isIdSegment(segment: string): boolean {
  const lower = segment.toLowerCase();
  return (
    SEGMENT_UUID.test(segment) ||
    /^\d+$/.test(segment) ||
    SEGMENT_HEX.test(segment) ||
    // A base64-ish key: long, and mixes letters with digits (route words never carry digits).
    (SEGMENT_TOKEN.test(segment) && /\d/.test(segment) && /[A-Za-z]/.test(segment)) ||
    segment.includes('@') ||
    lower.includes('%40') ||
    // A file name (`abc.jpg`), a dotted handle or encoded free text (a search term): all personal.
    SEGMENT_FREE_TEXT.test(segment)
  );
}

/**
 * The route of a path or URL with everything personal removed: no scheme, host or credentials (a presigned link's
 * bucket never shows), no query or fragment, and every segment that is an id, a key, an e-mail, a handle or a file
 * name replaced by `:id` (`https://b.s3.amazonaws.com/u/abc.jpg?X-Amz-Signature=…` -> `/u/:id`).
 */
export function routeTemplate(pathOrUrl: string): string {
  if (typeof pathOrUrl !== 'string') {
    return '/';
  }
  let path = pathOrUrl.trim();
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(path);
  if (scheme) {
    const rest = path.slice(scheme[0].length);
    // `data:`, `mailto:` and the like have no path: what follows the scheme is the content itself.
    path = rest.startsWith('//') ? rest.slice(2).replace(/^[^/?#]*/, '') : '';
  } else if (path.startsWith('//')) {
    path = path.slice(2).replace(/^[^/?#]*/, '');
  }
  path = path.replace(/[?#].*$/, '');
  const segments = path.split('/').filter((segment) => segment !== '');
  const out = segments.map((segment, index) => {
    if (
      index > 0 &&
      HANDLE_COLLECTIONS.has(segments[index - 1] ?? '') &&
      !segment.startsWith(':')
    ) {
      return ':id';
    }
    return isIdSegment(segment) ? ':id' : segment;
  });
  return out.length === 0 ? '/' : `/${out.join('/')}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------------------------------------------

const LEVELS = new Set(['fatal', 'error', 'warning', 'log', 'info', 'debug']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const HTTP_CATEGORIES = new Set(['fetch', 'xhr', 'http']);

function level(value: unknown): Breadcrumb['level'] {
  return typeof value === 'string' && LEVELS.has(value)
    ? (value as Breadcrumb['level'])
    : undefined;
}

/**
 * Keeps navigation (the route template only) and HTTP breadcrumbs (method, route template, status code); every other
 * breadcrumb (console, touches, UI, lifecycle, custom messages) is dropped. A breadcrumb never keeps its `message`.
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  try {
    if (!isDict(crumb)) {
      return null;
    }
    const data = isDict(crumb.data) ? crumb.data : {};
    const category = str(crumb.category);

    if (category === 'navigation') {
      const to = str(data.to) ?? str(data.route);
      if (to === undefined) {
        return null;
      }
      return compact({
        category: 'navigation',
        type: 'navigation',
        level: level(crumb.level),
        timestamp: num(crumb.timestamp),
        data: { to: routeTemplate(to) },
      });
    }

    if (category !== undefined && HTTP_CATEGORIES.has(category)) {
      const url = str(data.url) ?? str(data.route) ?? str(data.path);
      if (url === undefined) {
        return null;
      }
      const method = str(data.method)?.toUpperCase();
      const statusCode = num(data.status_code);
      return compact({
        category: 'http',
        type: 'http',
        level: level(crumb.level),
        timestamp: num(crumb.timestamp),
        data: compact({
          method: method !== undefined && METHODS.has(method) ? method : undefined,
          route: routeTemplate(url),
          status_code: statusCode,
        }),
      });
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------------

const FRAME_STRINGS = [
  'filename',
  'abs_path',
  'function',
  'module',
  'platform',
  'instruction_addr',
  'image_addr',
  'symbol_addr',
  'package',
] as const;

/** Install paths carry a per-install container id (`/Application/<uuid>/Kombin.app`). */
function scrubPath(value: unknown): string | undefined {
  const text = str(value);
  return text === undefined
    ? undefined
    : text
        .replace(UUID, ':id')
        .replace(EMAIL, '[email]')
        .replace(/\/(Users|home)\/[^/]+/g, '/$1/:user');
}

function scrubFrame(frame: unknown): Dict | null {
  if (!isDict(frame)) {
    return null;
  }
  const out: Dict = {};
  for (const key of FRAME_STRINGS) {
    out[key] =
      key === 'filename' || key === 'abs_path' || key === 'package'
        ? scrubPath(frame[key])
        : str(frame[key]);
  }
  out.lineno = num(frame.lineno);
  out.colno = num(frame.colno);
  out.in_app = bool(frame.in_app);
  return compact(out);
}

function scrubStacktrace(stacktrace: unknown): Dict | undefined {
  if (!isDict(stacktrace) || !Array.isArray(stacktrace.frames)) {
    return undefined;
  }
  return { frames: stacktrace.frames.map(scrubFrame).filter((frame) => frame !== null) };
}

function scrubException(exception: unknown): Dict | null {
  if (!isDict(exception)) {
    return null;
  }
  const mechanism = isDict(exception.mechanism)
    ? compact({ type: str(exception.mechanism.type), handled: bool(exception.mechanism.handled) })
    : undefined;
  const type = str(exception.type);
  const value = str(exception.value);
  return compact({
    type: type === undefined ? undefined : scrubText(type),
    value: value === undefined ? undefined : scrubText(value),
    mechanism,
    stacktrace: scrubStacktrace(exception.stacktrace),
  });
}

function scrubThread(thread: unknown): Dict | null {
  if (!isDict(thread)) {
    return null;
  }
  return compact({
    id: str(thread.id) ?? num(thread.id),
    crashed: bool(thread.crashed),
    current: bool(thread.current),
    stacktrace: scrubStacktrace(thread.stacktrace),
  });
}

const DEBUG_IMAGE_STRINGS = [
  'type',
  'debug_id',
  'code_id',
  'arch',
  'image_addr',
  'image_vmaddr',
  'uuid',
] as const;

function scrubDebugMeta(debugMeta: unknown): Dict | undefined {
  if (!isDict(debugMeta) || !Array.isArray(debugMeta.images)) {
    return undefined;
  }
  const images = debugMeta.images.filter(isDict).map((image) => {
    const out: Dict = {};
    for (const key of DEBUG_IMAGE_STRINGS) {
      out[key] = str(image[key]);
    }
    out.image_size = num(image.image_size);
    out.code_file = scrubPath(image.code_file);
    out.debug_file = scrubPath(image.debug_file);
    return compact(out);
  });
  return { images };
}

const CONTEXT_KEYS: Record<string, readonly string[]> = {
  os: ['name', 'version', 'build', 'kernel_version'],
  // Never `name`: it is often the owner's name ("Ayşe'nin iPhone'u").
  device: ['family', 'model', 'model_id', 'arch', 'simulator', 'manufacturer', 'brand'],
  app: ['app_version', 'app_build', 'build_type'],
  runtime: ['name', 'version'],
  react_native_context: ['js_engine', 'hermes_version', 'react_native_version', 'expo'],
};

function scrubContexts(contexts: unknown): Dict | undefined {
  if (!isDict(contexts)) {
    return undefined;
  }
  const out: Dict = {};
  for (const [name, keys] of Object.entries(CONTEXT_KEYS)) {
    const picked = pickPrimitives(contexts[name], keys);
    if (picked) {
      out[name] = picked;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Tags the SDK or the app sets that describe the error, never the user. */
const TAG_KEYS = ['event.environment', 'event.origin', 'platform', 'error_boundary', 'hermes'];

function scrubTags(tags: unknown): Dict | undefined {
  if (!isDict(tags)) {
    return undefined;
  }
  const out: Dict = {};
  for (const key of TAG_KEYS) {
    const value = primitive(tags[key]);
    if (value !== undefined) {
      out[key] = typeof value === 'string' ? scrubText(value) : value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function scrubSdk(sdk: unknown): Dict | undefined {
  if (!isDict(sdk)) {
    return undefined;
  }
  return compact({
    name: str(sdk.name),
    version: str(sdk.version),
    integrations: Array.isArray(sdk.integrations)
      ? sdk.integrations.filter((name) => typeof name === 'string')
      : undefined,
    packages: Array.isArray(sdk.packages)
      ? sdk.packages
          .filter(isDict)
          .map((pkg) => compact({ name: str(pkg.name), version: str(pkg.version) }))
      : undefined,
  });
}

function scrubMessage(message: unknown): string | undefined {
  if (typeof message === 'string') {
    return scrubText(message);
  }
  if (isDict(message)) {
    // A parameterised message: its formatted text only, never the params.
    const text = str(message.formatted) ?? str(message.message);
    return text === undefined ? undefined : scrubText(text);
  }
  return undefined;
}

/**
 * The event that may leave the phone, built from an allow-list (see the file comment). Returns `null`, so the event is
 * dropped, when anything goes wrong while scrubbing: an unscrubbed event is never sent.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  try {
    if (!isDict(event)) {
      return null;
    }
    const source = event as unknown as Dict;
    const exception =
      isDict(source.exception) && Array.isArray(source.exception.values)
        ? { values: source.exception.values.map(scrubException).filter((value) => value !== null) }
        : undefined;
    const threads =
      isDict(source.threads) && Array.isArray(source.threads.values)
        ? { values: source.threads.values.map(scrubThread).filter((value) => value !== null) }
        : undefined;
    const logentryText = isDict(source.logentry) ? scrubMessage(source.logentry) : undefined;
    const breadcrumbs = Array.isArray(source.breadcrumbs)
      ? source.breadcrumbs
          .map((crumb) => scrubBreadcrumb(crumb as Breadcrumb))
          .filter((crumb): crumb is Breadcrumb => crumb !== null)
      : undefined;
    const fingerprint = Array.isArray(source.fingerprint)
      ? source.fingerprint.filter((part) => typeof part === 'string')
      : undefined;

    const out = compact({
      type: undefined,
      event_id: str(source.event_id),
      timestamp: num(source.timestamp),
      level: level(source.level),
      platform: str(source.platform),
      release: str(source.release),
      dist: str(source.dist),
      environment: str(source.environment),
      sdk: scrubSdk(source.sdk),
      debug_meta: scrubDebugMeta(source.debug_meta),
      fingerprint,
      exception,
      message: scrubMessage(source.message),
      logentry: logentryText === undefined ? undefined : { message: logentryText },
      threads,
      contexts: scrubContexts(source.contexts),
      tags: scrubTags(source.tags),
      breadcrumbs,
    });
    return out as unknown as ErrorEvent;
  } catch {
    return null;
  }
}

import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

import { routeTemplate, scrubBreadcrumb, scrubEvent, scrubText } from '@/errorReporting/scrub';

// Privacy contract for crash reports: nothing personal may leave the phone. Every personal value below is a unique
// sentinel; the tests feed them in everywhere a real crash could carry them and assert none of them comes out, while the
// parts that make a crash report useful (exception type, frame function/line, route templates, HTTP method/status) do.

const UUID_L = '3f2c9a1e-7b4d-4c2a-9e8f-1a2b3c4d5e6f';
const UUID_U = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D';
const NUM_ID = '98765432';
const EMAIL = 'ayse.yilmaz+kombin@example.com.tr';
const EMAIL_UPPER = 'MEHMET.KAYA@KOMBIN.APP';
const IP = '85.105.12.34';
const IPV6 = '2a02:e0:1234:5678::9';
const FULL_NAME = 'Ayşegül Yıldırımoğlu';
const HANDLE = 'aysegul_style_34';
const CAPTION = 'Kapadokyada şık çiçekli elbise';
const SEARCH = 'kırmızı deri çanta';
const CITY = 'Eskişehir';
const DEVICE_NAME = "Ayşe'nin iPhone'u";
const QUERY_TOKEN = 'tokQ7zXk9sentinel';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJlX3NlbnRpbmVs';
const BEARER = 'opaqueBearerSentinel123';
const AMZ_SIG = 'a9f8e7d6c5b4amzsig';
const AMZ_CRED = 'AKIASENTINELCRED';
const S3_USER_ID = '7310042';
const PHOTO_NAME = 'dugun_elbisem_foto';
const COOKIE = 'sessidCookieSentinel';
const BODY = 'govdeSentinelŞifre';
const FRAG = 'fragmentSentinel';
const LOCAL_VAR = 'localVarSentinel';
const CONTEXT_LINE = 'contextLineSentinel';
const CUSTOM_CTX = 'customCtxSentinel';
const SERVER = 'serverNameSentinel';
const TAG_VAL = 'tagValueSentinel';
const EXTRA_VAL = 'extraValueSentinel';
const MECH_VAL = 'mechanismSentinel';
const CONSOLE_VAL = 'consoleLogSentinel';
const CLICK_VAL = 'clickTargetSentinel';

const PRESIGNED =
  `https://kombin-media.s3.eu-central-1.amazonaws.com/u/${S3_USER_ID}/${PHOTO_NAME}.jpg` +
  `?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${AMZ_CRED}%2F20261123%2Feu-central-1%2Fs3%2Faws4_request` +
  `&X-Amz-Signature=${AMZ_SIG}`;
const FILE_URI = `file:///data/user/0/app.kombin/cache/ImagePicker/${PHOTO_NAME}_file.jpg`;
const CONTENT_URI = `content://media/external/images/media/${NUM_ID}`;
const IOS_PHOTO = `ph://${UUID_U}/L0/001`;

/** Every value that must never appear in what leaves the phone (case-insensitive where casing is irrelevant). */
const SENTINELS = [
  UUID_L,
  UUID_U,
  NUM_ID,
  EMAIL,
  'ayse.yilmaz',
  EMAIL_UPPER,
  'MEHMET.KAYA',
  IP,
  IPV6,
  FULL_NAME,
  'Ayşegül',
  'Yıldırımoğlu',
  HANDLE,
  CAPTION,
  'Kapadokyada',
  'çiçekli',
  SEARCH,
  'kırmızı',
  CITY,
  DEVICE_NAME,
  "Ayşe'nin",
  QUERY_TOKEN,
  JWT,
  'eyJhbGciOiJIUzI1NiJ9',
  BEARER,
  AMZ_SIG,
  AMZ_CRED,
  'X-Amz',
  'amazonaws',
  S3_USER_ID,
  PHOTO_NAME,
  COOKIE,
  BODY,
  FRAG,
  LOCAL_VAR,
  CONTEXT_LINE,
  CUSTOM_CTX,
  SERVER,
  TAG_VAL,
  EXTRA_VAL,
  MECH_VAL,
  CONSOLE_VAL,
  CLICK_VAL,
  'file://',
  'content://',
  'ph://',
  'api.kombin.app',
];

function leaks(value: unknown): string[] {
  const json = JSON.stringify(value) ?? '';
  const lower = json.toLowerCase();
  // JSON escapes nothing in these sentinels except the apostrophe-free ones; compare on raw and lower-cased text.
  return SENTINELS.filter((s) => json.includes(s) || lower.includes(s.toLowerCase()));
}

function expectNoLeaks(value: unknown): void {
  expect(leaks(value)).toEqual([]);
}

const now = 1763900000;

function personalCrumbs(): Breadcrumb[] {
  return [
    {
      type: 'navigation',
      category: 'navigation',
      message: `Navigation to /outfits/${UUID_L} for ${EMAIL}`,
      data: { from: `/u/@${HANDLE}`, to: `/outfits/${UUID_L}` },
      timestamp: now,
    },
    {
      type: 'http',
      category: 'xhr',
      data: {
        method: 'GET',
        url: `https://api.kombin.app/api/v1/outfits/${UUID_U}?q=${encodeURIComponent(SEARCH)}&token=${QUERY_TOKEN}#${FRAG}`,
        status_code: 404,
        request_body_size: 0,
        response_body_size: 120,
      },
      timestamp: now,
    },
    {
      type: 'http',
      category: 'fetch',
      data: { method: 'PUT', url: PRESIGNED, status_code: 403, request_body: BODY },
      timestamp: now,
    },
    {
      category: 'console',
      level: 'log',
      message: `${CONSOLE_VAL} user ${EMAIL} typed "${CAPTION}"`,
      data: { arguments: [CONSOLE_VAL, { email: EMAIL }], logger: 'console' },
      timestamp: now,
    },
    { category: 'touch', message: `Touch event within element: ${CLICK_VAL}`, data: { target: FULL_NAME }, timestamp: now },
    { category: 'ui.click', message: CLICK_VAL, timestamp: now },
    { category: 'redux.action', data: { payload: { caption: CAPTION } }, timestamp: now },
  ];
}

function personalEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: '0123456789abcdef0123456789abcdef',
    timestamp: now,
    platform: 'javascript',
    level: 'error',
    release: 'app.kombin@1.4.0+120',
    environment: 'production',
    server_name: SERVER,
    transaction: `/outfits/${UUID_L}`,
    user: { id: UUID_L, email: EMAIL, ip_address: IP, username: HANDLE, name: FULL_NAME } as ErrorEvent['user'],
    request: {
      url: `https://api.kombin.app/api/v1/outfits/${UUID_L}?token=${QUERY_TOKEN}#${FRAG}`,
      method: 'POST',
      data: { caption: CAPTION, body: BODY },
      query_string: `q=${SEARCH}`,
      cookies: { sessid: COOKIE },
      headers: { Authorization: `Bearer ${JWT}`, 'X-Forwarded-For': IP, Cookie: `sessid=${COOKIE}` },
    },
    extra: { caption: CAPTION, email: EMAIL, note: EXTRA_VAL },
    tags: { userId: UUID_U, email: EMAIL, city: CITY, handle: HANDLE, debug: TAG_VAL },
    contexts: {
      device: { name: DEVICE_NAME, model: 'iPhone15,2', family: 'iOS' },
      os: { name: 'iOS', version: '18.1' },
      custom: { caption: CAPTION, marker: CUSTOM_CTX },
      profile: { email: EMAIL, ip: IP },
    },
    exception: {
      values: [
        {
          type: 'TypeError',
          value:
            `Failed to load "${CAPTION}" for ${EMAIL} at https://api.kombin.app/api/v1/outfits/${UUID_L}?token=${QUERY_TOKEN} ` +
            `(item ${NUM_ID}, city “${CITY}”, search ‘${SEARCH}’, name «${FULL_NAME}», ip ${IP}, auth Bearer ${BEARER}, ` +
            `jwt ${JWT}, photo ${PRESIGNED}, local ${FILE_URI}, gallery ${CONTENT_URI}, ios ${IOS_PHOTO}, ` +
            `cc ${EMAIL_UPPER}, item ${UUID_U}, device "${DEVICE_NAME}")`,
          mechanism: { type: 'onerror', handled: false, data: { info: MECH_VAL, email: EMAIL } },
          stacktrace: {
            frames: [
              {
                filename: 'app:///index.android.bundle',
                function: 'loadOutfitDetail',
                lineno: 4242,
                colno: 17,
                in_app: true,
                vars: { email: EMAIL, local: LOCAL_VAR },
                context_line: `const caption = "${CAPTION}"; // ${CONTEXT_LINE}`,
                pre_context: [`fetch("/outfits/${UUID_L}") ${CONTEXT_LINE}`],
                post_context: [`log("${EMAIL}") ${CONTEXT_LINE}`],
              },
            ],
          },
        },
      ],
    },
    breadcrumbs: personalCrumbs(),
  } as unknown as ErrorEvent;
}

describe('scrubEvent', () => {
  let out: ErrorEvent;

  beforeEach(() => {
    const scrubbed = scrubEvent(personalEvent());
    expect(scrubbed).not.toBeNull();
    out = scrubbed as ErrorEvent;
  });

  it('lets no personal value out anywhere in the event', () => {
    expectNoLeaks(out);
  });

  it('does not send the user at all', () => {
    expect(out.user).toBeUndefined();
  });

  it('drops request, extra and server_name', () => {
    expect(out.request).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.server_name).toBeUndefined();
  });

  it('drops unknown tags', () => {
    const tags = (out.tags ?? {}) as Record<string, unknown>;
    for (const key of ['userId', 'email', 'city', 'handle', 'debug']) expect(tags).not.toHaveProperty(key);
  });

  it('drops unknown contexts and the device name', () => {
    const contexts = (out.contexts ?? {}) as Record<string, Record<string, unknown> | undefined>;
    expect(contexts.custom).toBeUndefined();
    expect(contexts.profile).toBeUndefined();
    expect(contexts.device?.name).toBeUndefined();
  });

  it('keeps the exception type and the frame location', () => {
    const exc = out.exception?.values?.[0];
    expect(exc?.type).toBe('TypeError');
    const frame = exc?.stacktrace?.frames?.[0];
    expect(frame?.function).toBe('loadOutfitDetail');
    expect(frame?.lineno).toBe(4242);
    expect(frame?.colno).toBe(17);
    expect(frame?.in_app).toBe(true);
  });

  it('drops frame variables and source context', () => {
    const frame = out.exception?.values?.[0]?.stacktrace?.frames?.[0] as Record<string, unknown> | undefined;
    expect(frame?.vars).toBeUndefined();
    expect(frame?.context_line).toBeUndefined();
    expect(frame?.pre_context).toBeUndefined();
    expect(frame?.post_context).toBeUndefined();
  });

  it('turns the transaction into a route template', () => {
    if (out.transaction !== undefined) expect(out.transaction).toBe('/outfits/:id');
  });

  it('keeps only allowed breadcrumbs: navigation and http, nothing else', () => {
    const crumbs = out.breadcrumbs ?? [];
    const categories = crumbs.map((c) => c.category);
    for (const dropped of ['console', 'touch', 'ui.click', 'redux.action']) expect(categories).not.toContain(dropped);
    for (const c of crumbs) expect(c.message).toBeUndefined();
  });

  it('keeps an http breadcrumb useful: method, status and route template', () => {
    const http = (out.breadcrumbs ?? []).find((c) => c.data?.method === 'GET');
    expect(http).toBeDefined();
    expect(http?.data?.status_code).toBe(404);
    expect(JSON.stringify(http)).toContain('/api/v1/outfits/:id');
  });

  it('keeps a navigation breadcrumb useful: the route template', () => {
    const nav = (out.breadcrumbs ?? []).find((c) => c.category === 'navigation');
    expect(nav).toBeDefined();
    expect(JSON.stringify(nav)).toContain('/outfits/:id');
  });
});

describe('scrubEvent on other shapes', () => {
  it('scrubs a message-only event (event.message and logentry)', () => {
    const event = {
      type: undefined,
      message: `Could not post "${CAPTION}" as ${EMAIL} from ${IP}: ${PRESIGNED}`,
      logentry: { message: `Search ‘${SEARCH}’ in “${CITY}” failed for %s`, params: [EMAIL, FULL_NAME] },
      level: 'warning',
    } as ErrorEvent;
    const out = scrubEvent(event);
    expect(out).not.toBeNull();
    expectNoLeaks(out);
    // The event stays meaningful: the non-personal wording survives.
    expect(JSON.stringify(out)).toMatch(/Could not post/);
  });

  it('handles a minimal event without throwing', () => {
    const out = scrubEvent({ type: undefined } as ErrorEvent);
    expect(out).not.toBeNull();
  });

  it('drops a user that only has an anonymous id', () => {
    const out = scrubEvent({ type: undefined, user: { id: UUID_U } } as ErrorEvent);
    expect(out?.user).toBeUndefined();
    expectNoLeaks(out);
  });

  it('drops the event (null) when scrubbing fails, never sends it unscrubbed', () => {
    const event = personalEvent();
    Object.defineProperty(event, 'exception', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(scrubEvent(event)).toBeNull();
  });

  it('drops the event when a nested getter throws', () => {
    const event = personalEvent();
    const frame = event.exception!.values![0]!.stacktrace!.frames![0]!;
    Object.defineProperty(frame, 'function', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(scrubEvent(event)).toBeNull();
  });

  it('drops the event when the message getter throws', () => {
    const event = { type: undefined } as ErrorEvent;
    Object.defineProperty(event, 'message', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(scrubEvent(event)).toBeNull();
  });

  it('hides e-mails in odd places: frame filename, mailto value, tag key', () => {
    const event = {
      type: undefined,
      tags: { [EMAIL]: 'x' },
      exception: {
        values: [
          {
            type: 'Error',
            value: `mailto:${EMAIL}`,
            stacktrace: {
              frames: [
                { filename: `/Users/${EMAIL}/app/main.jsbundle`, function: 'f', lineno: 1, colno: 1, in_app: true },
              ],
            },
          },
        ],
      },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(leaks(out)).toEqual([]);
  });

  it('scrubs personal text inside event.breadcrumbs even if they were never passed through beforeBreadcrumb', () => {
    const event = { type: undefined, breadcrumbs: personalCrumbs() } as ErrorEvent;
    const out = scrubEvent(event);
    expect(out).not.toBeNull();
    expectNoLeaks(out);
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console, touch, ui.click and unknown crumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: CONSOLE_VAL, level: 'log' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'touch', message: CLICK_VAL })).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: CLICK_VAL })).toBeNull();
    expect(scrubBreadcrumb({ category: 'redux.action', data: { caption: CAPTION } })).toBeNull();
    expect(scrubBreadcrumb({ category: 'app.lifecycle', message: 'foreground' })).toBeNull();
    expect(scrubBreadcrumb({ message: `${EMAIL}` })).toBeNull();
  });

  it('keeps a navigation crumb as a route template only', () => {
    const out = scrubBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: `Navigation to /items/${NUM_ID}`,
      data: { from: `/u/@${HANDLE}`, to: `/items/${NUM_ID}?ref=${QUERY_TOKEN}#${FRAG}` },
    });
    expect(out).not.toBeNull();
    expect(out?.message).toBeUndefined();
    expectNoLeaks(out);
    expect(JSON.stringify(out)).toContain('/items/:id');
  });

  it('scrubs a navigation crumb that carries route params objects', () => {
    const out = scrubBreadcrumb({
      category: 'navigation',
      data: {
        from: { name: 'Wardrobe', params: { search: SEARCH } },
        to: { name: 'OutfitDetail', params: { id: UUID_L, caption: CAPTION, owner: EMAIL } },
      },
    });
    expectNoLeaks(out);
    if (out) expect(out.message).toBeUndefined();
  });

  it('keeps an xhr crumb as method + route template + status, without host, query or fragment', () => {
    const out = scrubBreadcrumb({
      type: 'http',
      category: 'xhr',
      data: {
        method: 'DELETE',
        url: `https://api.kombin.app/api/v1/wardrobe/items/${UUID_U}?q=${QUERY_TOKEN}#${FRAG}`,
        status_code: 500,
        request_body_size: 42,
      },
    });
    expect(out).not.toBeNull();
    expect(out?.message).toBeUndefined();
    expect(out?.data?.method).toBe('DELETE');
    expect(out?.data?.status_code).toBe(500);
    expectNoLeaks(out);
    const json = JSON.stringify(out);
    expect(json).toContain('/api/v1/wardrobe/items/:id');
    expect(json).not.toContain('?');
    expect(json).not.toContain('#');
    expect(json).not.toContain('https://');
  });

  it('keeps nothing but method, template and status in an http crumb', () => {
    const out = scrubBreadcrumb({
      type: 'http',
      category: 'http',
      data: {
        method: 'POST',
        url: `https://api.kombin.app/api/v1/posts`,
        status_code: 201,
        request_body: { caption: CAPTION },
        response_body: { author: FULL_NAME },
        reason: `“${CAPTION}”`,
      },
    });
    expectNoLeaks(out);
    for (const value of Object.values(out?.data ?? {})) {
      const ok = value === 'POST' || value === 201 || (typeof value === 'string' && value.startsWith('/'));
      expect(ok).toBe(true);
    }
  });

  it('strips a presigned S3 upload URL in a fetch crumb', () => {
    const out = scrubBreadcrumb({ type: 'http', category: 'fetch', data: { method: 'PUT', url: PRESIGNED, status_code: 403 } });
    expectNoLeaks(out);
    if (out) {
      expect(out.data?.method).toBe('PUT');
      expect(out.data?.status_code).toBe(403);
    }
  });

  it('strips file:// and content:// photo URIs in a fetch crumb', () => {
    for (const url of [FILE_URI, CONTENT_URI, IOS_PHOTO]) {
      expectNoLeaks(scrubBreadcrumb({ type: 'http', category: 'fetch', data: { method: 'GET', url, status_code: 0 } }));
    }
  });

  it('returns null when scrubbing a crumb fails', () => {
    const crumb = { category: 'xhr' } as Breadcrumb;
    Object.defineProperty(crumb, 'data', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(scrubBreadcrumb(crumb)).toBeNull();
  });
});

describe('scrubText', () => {
  const cases: [string, string][] = [
    ['e-mail', `Sign-in failed for ${EMAIL}`],
    ['upper-case e-mail', `Invite sent to ${EMAIL_UPPER}`],
    ['lower-case uuid', `Outfit ${UUID_L} not found`],
    ['upper-case uuid', `Item ${UUID_U} not found`],
    ['numeric id in a path', `GET /api/v1/items/${NUM_ID} failed`],
    ['numeric id in a query', `request id=${NUM_ID} failed`],
    ['ip address', `connect ECONNREFUSED ${IP}:443`],
    ['presigned S3 URL', `Upload failed: ${PRESIGNED}`],
    ['file:// photo URI', `Cannot read ${FILE_URI}`],
    ['content:// photo URI', `Cannot read ${CONTENT_URI}`],
    ['ph:// photo URI', `Cannot read ${IOS_PHOTO}`],
    ['JWT', `Invalid token ${JWT}`],
    ['bearer token', `Authorization: Bearer ${BEARER}`],
    ['query string', `GET https://api.kombin.app/api/v1/search?q=${QUERY_TOKEN}`],
    ['url fragment', `Open /outfits#${FRAG}`],
    ['straight double quotes', `No results for "${SEARCH}"`],
    ['curly double quotes', `Caption “${CAPTION}” too long`],
    ['curly single quotes', `City ‘${CITY}’ unknown`],
    ['guillemets', `Name «${FULL_NAME}» invalid`],
    ['low-9 quotes', `Etiket „${CAPTION}“ geçersiz`],
    ['device name with apostrophes in quotes', `Device "${DEVICE_NAME}" not registered`],
    ['backticks', `Template \`${SEARCH}\` failed`],
  ];

  it.each(cases)('removes %s', (_label, input) => {
    expectNoLeaks(scrubText(input));
  });

  it('removes a handle', () => {
    expect(scrubText(`Profile @${HANDLE} is private`)).not.toContain(HANDLE);
  });

  it('keeps benign text unchanged', () => {
    expect(scrubText('Network request failed')).toBe('Network request failed');
    expect(scrubText('Kombin yüklenemedi')).toBe('Kombin yüklenemedi');
  });

  it('keeps the useful part around a removed value', () => {
    const out = scrubText(`Outfit ${UUID_L} not found`);
    expect(out).toMatch(/^Outfit .* not found$/);
  });

  it('truncates very long text', () => {
    const long = 'Hata '.repeat(20000);
    const out = scrubText(long);
    expect(out.length).toBeLessThan(long.length);
    expect(out.length).toBeLessThanOrEqual(2048);
  });

  it('does not let a personal value survive by straddling the truncation point', () => {
    const out = scrubText('x'.repeat(5000) + ` ${EMAIL} ` + 'y'.repeat(5000));
    expect(out).not.toContain(EMAIL);
    const out2 = scrubText(`${EMAIL} ${'z'.repeat(50000)}`);
    expectNoLeaks(out2);
  });

  it('is idempotent', () => {
    for (const [, input] of cases) {
      const once = scrubText(input);
      expect(scrubText(once)).toBe(once);
    }
    const long = scrubText(`"${CAPTION}" ` + 'a'.repeat(30000));
    expect(scrubText(long)).toBe(long);
  });

  it('handles the empty string', () => {
    expect(scrubText('')).toBe('');
  });
});

describe('routeTemplate', () => {
  it('keeps the root', () => {
    expect(routeTemplate('/')).toBe('/');
  });

  it('keeps static routes as they are', () => {
    expect(routeTemplate('/wardrobe/add')).toBe('/wardrobe/add');
    expect(routeTemplate('/settings/privacy')).toBe('/settings/privacy');
  });

  it('replaces ids with :id (lower/upper-case UUIDs, numeric ids)', () => {
    expect(routeTemplate(`/outfits/${UUID_L}`)).toBe('/outfits/:id');
    expect(routeTemplate(`/outfits/${UUID_U}/edit`)).toBe('/outfits/:id/edit');
    expect(routeTemplate(`/items/${NUM_ID}`)).toBe('/items/:id');
    expect(routeTemplate(`/posts/${UUID_L}/comments/${NUM_ID}`)).toBe('/posts/:id/comments/:id');
  });

  it('drops host, scheme, query and fragment from a full URL', () => {
    expect(routeTemplate(`https://api.kombin.app/api/v1/outfits/${UUID_L}?token=${QUERY_TOKEN}#${FRAG}`)).toBe(
      '/api/v1/outfits/:id',
    );
    expect(routeTemplate(`https://api.kombin.app/api/v1/search?q=${encodeURIComponent(SEARCH)}`)).toBe('/api/v1/search');
  });

  it('ignores a trailing slash', () => {
    // A trailing slash carries no meaning for the route; the template is the same with or without it.
    expect(routeTemplate(`/outfits/${NUM_ID}/`)).toMatch(/^\/outfits\/:id\/?$/);
    expect(routeTemplate(`/outfits/${NUM_ID}/`)).not.toContain(NUM_ID);
  });

  it('hides user handles: a handle identifies a person just like an id does', () => {
    // /u/@ayse and /creators/ayse.yilmaz name a user; route segments of our own never contain '@' or '.', so such
    // segments must be replaced, not kept.
    const a = routeTemplate(`/u/@${HANDLE}`);
    expect(a).not.toContain(HANDLE);
    expect(a.startsWith('/u/')).toBe(true);
    const b = routeTemplate('/creators/ayse.yilmaz');
    expect(b).not.toContain('ayse');
    expect(b.startsWith('/creators/')).toBe(true);
    const c = routeTemplate(`/u/@${HANDLE}/outfits/${UUID_L}`);
    expect(c).not.toContain(HANDLE);
    expect(c.endsWith('/outfits/:id')).toBe(true);
  });

  it('hides an e-mail used as a path segment', () => {
    expect(routeTemplate(`/users/${EMAIL}/outfits`)).not.toContain('ayse');
  });

  it('hides a presigned S3 photo URL down to a template without user id, file name or signature', () => {
    const t = routeTemplate(PRESIGNED);
    expectNoLeaks(t);
    expect(t.startsWith('/')).toBe(true);
  });

  it('hides percent-encoded Turkish free text in a path', () => {
    const t = routeTemplate(`/search/${encodeURIComponent(SEARCH)}`);
    expect(t).not.toContain(encodeURIComponent('kırmızı'));
    expect(t).not.toContain('kırmızı');
  });

  it('hides photo URIs', () => {
    for (const uri of [FILE_URI, CONTENT_URI, IOS_PHOTO]) expectNoLeaks(routeTemplate(uri));
  });
});

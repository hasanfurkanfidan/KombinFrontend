# Mobile review S2: security and performance (closed beta)

Branch `task-s2-mobile-review`, 15 November 2026. A review of our own Expo app before the closed beta: every file under `src/` and `app/`,
`app.json`, `eas.json`, `.env.example`, the git history, the exported Android bundle and its source map, and the backend's
`docs/security-review.md` (S1), so nothing the backend already enforces is counted twice. Each High and every cheap Medium is fixed in this
branch with a test; the rest is planned or accepted below, with the reason.

**How each claim was established.** _Measured_ means a number from a command in this branch (export, source map, `npm audit`,
`expo-doctor`, `expo config --type introspect`, Jest). _Reasoned_ means read from code and the platform's documented behaviour; those are the
ones the founder should confirm on a phone with the steps in the last section.

**Counts.**

|             | High | Medium | Low | Info |
| ----------- | ---- | ------ | --- | ---- |
| Security    | 2    | 8      | 7   | 9    |
| Performance | 1    | 9      | 6   | 5    |

**Fixed in this branch:** both security Highs and the performance High; security Mediums S3-S9 (S10 is planned); performance Mediums P2-P6
and P10 (P7, P8 and P9 are planned); security Lows S11, S12, S13 and S17.

**The three that matter most, in plain words.**

1. **Signing out did not forget the previous person (S1).** Logout cleared the tokens and the `me` query and nothing else. The next person who
   signed in on the same phone could see the previous user's wardrobe, styles, saved products, alerts, outfits, notifications and per-viewer
   feed fields from the cache until each list refetched (instantly for anything fetched less than a minute earlier), plus their recent
   searches, their pending uploads and their photos in the cache folder. Now one reset runs whenever a signed-in session ends.
2. **Photo lists kept far too many decoded photos in memory (P1).** React Native's lists keep 21 screens of rows mounted by default, and React
   Native's `Image` decodes on Android at full size unless told otherwise. On Keşfet that is about 120 product photos held as bitmaps;
   the feed's photos are 1600 px JPEGs (about 10 MB each when decoded at full size). Every photo list now keeps 7 screens, Android detaches
   off-screen rows, and every image decodes at the size of its box.
3. **Nothing stopped a release build from sending tokens over plain http (S2).** A preview build made with a LAN `http://` address would have
   worked and sent the bearer and refresh tokens in clear text. A release build now refuses any non-`https` API address at start-up, Android
   release builds forbid cleartext traffic, and iOS release builds have no App Transport Security exception.

**Bundle:** Android Hermes bytecode **4,966,956 → 4,695,272 bytes (−265 KB, −5.5 %)**, minified JS 4,035,004 → 3,701,921 bytes (−8.3 %),
fonts 6 → 5 faces (−121 KB of assets). **Needs a new native build:** nothing in this branch. Adopting `expo-image` (P8) would, and so would the
`expo-doctor` patch updates (S16). The config changes in `app.json` / `app.config.js` (permissions, ATS, cleartext) take effect with the
next EAS build of each profile.

---

## Part 1: Security

### Findings

| ID  | Sev.   | Title                                                                               | Where                                                                          | Status                    |
| --- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| S1  | High   | The previous user's data survives sign-out, expiry and deletion                     | `src/session/useSession.ts:119` (was: only `me` removed)                       | Fixed                     |
| S2  | High   | A release build could talk plain http; no cleartext/ATS policy                      | `src/api/client.ts:81`, `app.config.js`, `plugins/withNetworkPolicy.js`        | Fixed                     |
| S3  | Medium | Upload polls outlive the session and write into the next user's cache               | `src/features/wardrobe/addItem.ts:117`, `src/features/social/createPost.ts:57` | Fixed                     |
| S4  | Medium | Picked photos and re-encoded copies are never deleted from the phone                | `addItem.ts:193`, `createPost.ts`, `LensScreen.tsx:60`, `AppProviders.tsx:40`  | Fixed                     |
| S5  | Medium | Route params and push deep links are not validated; `returnTo` is followed as given | `app/**/[id].tsx`, `navigation.ts:18`, `flow.ts:33`                            | Fixed                     |
| S6  | Medium | A creator's handle reaches analytics in `screen_view`                               | `src/analytics/screenName.ts:7`                                                | Fixed                     |
| S7  | Medium | Analytics mix accounts on a shared phone (queue and anonymous id)                   | `src/session/useSession.ts:100`, `src/analytics/identity.ts:36`                | Fixed                     |
| S8  | Medium | Unused permissions and English purpose strings in the native config                 | `app.json:24`, `app.json:32`, `app.config.js`                                  | Fixed                     |
| S9  | Medium | "Takipçilerime" is not private, the helper line under-says it (backend M5)          | `src/i18n/tr.ts:802`                                                           | Fixed                     |
| S10 | Medium | `eas.json` sets no API address per profile                                          | `eas.json:20`                                                                  | Planned                   |
| S11 | Low    | Legal URLs are opened as the API returns them                                       | `src/features/legal/legal.ts:39`                                               | Fixed                     |
| S12 | Low    | Creator links allow `http` and show a truncated raw URL                             | `src/features/social/ProfileScreens.tsx:30`                                    | Fixed                     |
| S13 | Low    | `goPath` is glued to the API origin without a shape check                           | `src/features/catalog/buy.ts:19`                                               | Fixed                     |
| S14 | Low    | Screenshots and the app-switcher snapshot of sensitive screens                      | size map, delete account                                                       | Accepted                  |
| S15 | Low    | The server's `detail` is shown verbatim in forms                                    | `src/api/client.ts:33`                                                         | Accepted                  |
| S16 | Low    | Dependencies: 9 moderate advisories in build tooling; 15 Expo patch updates pending | `package.json`                                                                 | Accepted (gate) / Planned |
| S17 | Low    | Pending-deletion credentials stay in memory until "Vazgeç"                          | `src/features/auth/pendingDeletion.ts:16`                                      | Fixed                     |

#### S1 · The previous user's data survives sign-out (High, Fixed)

_What happened._ `clearLocalSession` (logout and account deletion) and `endSession` (a rejected refresh) ended the tokens and removed
`queryKeys.me`. Every other query stayed: the wardrobe, personas, outfits, saved ids, alerts and triggers, notifications, `GET /me/profile`,
creator stats, blocks, the scored catalog lists and the feed (whose key has `signedIn` but no user, so `likedByMe`, `inWardrobe` and
`matchScore` belonged to the previous viewer). Queries fetched less than `staleTime` ago (60 s by default, up to an hour for outfits) were
shown to the next user without even a refetch. The Zustand stores kept recent searches (search terms), the onboarding skip, the push token,
the wardrobe add queue with its local photo paths and failure reasons, and the pending-deletion credentials. The post photo URL map kept the
previous viewer's presigned URLs.

_Fix._ `src/session/userScope.ts:29` `resetUserScopedState()`: cancels and clears every query and mutation, resets `prefsStore`,
`addStore`, the pending-deletion store and the photo URL map, empties the temporary photo folders (S4) and starts a new anonymous id (S7). It
runs from one place, a store subscription installed once at app start (`AppProviders.tsx:36`), whenever the session leaves `signedIn`, so
logout, deletion and an expired refresh are all covered and a new sign-out path cannot forget it. A `userScopeEpoch()` counter lets
background work notice (S3).

_Proof._ `__tests__/session/userScope.test.tsx`: renders the real Dolap screen on the app's own query client with user A's wardrobe, signs
out, signs in as B while B's list is still loading, and asserts that A's piece never renders, then that B's does. A second test checks the
cache, every store, the URL map, the temp folders and the anonymous id; a third that a cold start that was never signed in clears nothing.

#### S2 · A release build could talk plain http (High, Fixed)

_What happened._ `baseUrl()` accepted any `EXPO_PUBLIC_API_URL`. Expo's templates do not set a cleartext policy we control, and `eas.json`
has no per-profile address (S10), so a preview build made on a machine whose `.env` points at a LAN address would ship tokens over http.

_Fix._

- `apiUrlProblem()` (`src/api/client.ts:81`): a release build (`__DEV__` false: preview and production) accepts `https` only; development may
  use `http` (LAN, `10.0.2.2`). The address must be a plain origin (no credentials, query or fragment). `baseUrl()` refuses a bad address on
  every request, and `AppProviders.tsx:27` throws at start-up in a release build, so a misconfigured build fails on its first launch
  instead of leaking traffic.
- `plugins/withNetworkPolicy.js` + `app.config.js`: for `EAS_BUILD_PROFILE` `preview`/`production`, Android `usesCleartextTraffic="false"`
  and iOS `NSAppTransportSecurity = { NSAllowsArbitraryLoads: false }` with no exception; development builds keep cleartext and
  `NSAllowsLocalNetworking`. A config plugin edits the generated manifest/plist; it is not native code and needs no `prebuild`.

_Proof._ `__tests__/security/guards.test.ts` ("the API address"). Measured with `EAS_BUILD_PROFILE=production npx expo config --type
introspect`: manifest `usesCleartextTraffic=false`, plist ATS `{NSAllowsArbitraryLoads: false}`; without a profile: `true` and
`NSAllowsLocalNetworking`.

_Consequence to know._ `npx expo export` builds a release bundle: with today's `.env` (`http://…`) that bundle now refuses to start. Preview
builds for testers must point at the tunnel's `https` address (backend `docs/deploy.md` §10).

#### S3 · Upload polls outlive the session (Medium, Fixed)

`watchItem` (40 s) and `watchPost` (120 s) are module-level loops: they kept polling after sign-out (each poll then failing its refresh)
and, if the next user signed in meanwhile, `commit()` wrote the result into the new cache and could open the confirm sheet for the wrong
account. Both now capture `userScopeEpoch()` when they start and stop quietly when it changed, without touching the cache
(`addItem.ts:117`, `createPost.ts:57`). _Proof:_ `addItem.test.ts` "stops polling when the account signs out…".

#### S4 · Photos stay on the phone (Medium, Fixed)

The picker copies every picked photo into `cache/ImagePicker/` and the image manipulator writes every re-encode and crop into
`cache/ImageManipulator/` (checked in both modules' native sources). Nothing deleted them: camera originals with GPS EXIF, photos of people
for posts, Lens photos and crops piled up until the OS purged the cache. Now:

- the re-encoded copy is deleted right after its upload, success or failure (`addItem.ts:193`, `createPost.ts`);
- a wardrobe pick is deleted when its item turns `Ready` with a server thumbnail; a post pick once the upload went through; a failed upload
  keeps the pick for the retry;
- Lens deletes its pick and its re-encode on "Yeni fotoğraf" and when the screen closes (`LensScreen.tsx:60`); crops handed to the
  wardrobe follow the wardrobe rule;
- both folders are emptied on every cold start, before any screen exists (`AppProviders.tsx:40`), and when a session ends (S1).
  `discardTempFile` only ever deletes inside those two folders of the app's own cache (`src/utils/tempFiles.ts`), never a gallery URI.
  _Proof:_ `guards.test.ts` ("temporary photos"), `addItem.test.ts` and `createPost.test.ts` ("photos on the phone").

**EXIF (Info, verified).** Wardrobe, posts and Lens always go through `manipulateAsync` with `format: JPEG`, even when no resize is needed;
the module re-encodes from a bitmap (`Bitmap.compress` on Android, `UIImage.jpegData` on iOS: no metadata is written), so EXIF and GPS
never leave the phone. The backend strips posts again (S1 I9).

#### S5 · Route params and deep links (Medium, Fixed)

Any `kombin://…` link opens a route with the params it carries. Ids went into requests unchecked (path segments were already
`encodeURIComponent`-ed, so the worst case was a pointless request), push deep links accepted `[A-Za-z0-9-]+`, and `returnTo` went straight
into `router.dismissTo`, which hands an absolute URL to the OS. Now `src/utils/routeParams.ts` checks: ids must be uuids (every id the API
issues is one), handles must match the backend rule (3-30 of `a-z0-9._`), `returnTo` must be an in-app path (`/…`, never `//host`, a scheme
or a query). Every dynamic route redirects home on a bad param; `how-to-wear` and `posts/new` drop it; `leaveOnboarding` re-checks
`returnTo`; `parseDeepLink` accepts uuid ids only (`navigation.ts:18`).

_No route acts without a tap (Info, verified)._ Every `useEffect` in `src/features` was read: none likes, follows, deletes, cancels a
deletion or creates anything on mount. `TrySheet` calls `POST /posts/{id}/try` when the sheet opens after a tap, and it only computes. A
"new matches" notification activates its persona only after the user tapped that notification. The pending-deletion screen opened by a link
has no credentials and sends the user to login.

#### S6 · Handle in `screen_view` (Medium, Fixed)

`screenName` replaced uuids only, so `/creators/ayse.style` was sent as `creators/ayse.style`. Now every dynamic segment is replaced
(`creators/:handle`, `product/:id`, `users/:id`, … `screenName.ts:7`), whatever it holds. _Proof:_ `guards.test.ts`.

#### S7 · Analytics across accounts (Medium, Fixed)

The queue attaches the token when it flushes (up to 15 s later), so events of user A were sent with B's token when B signed in quickly, and
the anonymous id survived sign-out and deletion, so the backend linked A's and B's pre-login events to the same device id. Now `signOut`
flushes the queue first, with A's token (bounded to 1.5 s, `useSession.ts:100`), and every session end starts a new anonymous id
(`identity.ts:36`). The allow-list guard runs in production too (it drops instead of throwing, `analytics/index.ts:32`); events carry ids and
enums only (verified against `events.ts`; the backend allow-list rejects anything else).

#### S8 · Native permissions (Medium, Fixed)

Measured with `expo config --type introspect`: the Android manifest asked for `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`,
`WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW`; none is used (the photo picker needs no storage permission, the camera intent records no
audio). iOS carried `expo-secure-store`'s English Face ID string although nothing uses biometrics, and the dev launcher's English local-network
string and Bonjour service in release builds. Now `android.blockedPermissions` removes the first three everywhere and `app.config.js` removes
`SYSTEM_ALERT_WINDOW` in release builds; `faceIDPermission: false`; the network plugin drops the local-network keys in release builds.
What remains: camera and photo library (Turkish strings), notifications (asked only in context, never at launch: `usePushPrimer` and the
preferences sheet), `INTERNET`, `VIBRATE`.

#### S9 · "Takipçilerime" wording (Medium, Fixed)

The backend accepted its M5 (following needs no approval, so "Followers" is not a privacy boundary) and asked the app to reword. The helper
line now says "Seni takip eden herkes görür. Takip etmek onay istemediği için bu gizli bir paylaşım değildir." (`tr.ts:802`).

#### S10 · No API address per build profile (Medium, Planned)

`eas.json` has no `env`, so an EAS build takes whatever `EXPO_PUBLIC_API_URL` the build machine provides. _Plan:_ set it as an EAS
environment variable per profile (`preview`: the tunnel's `https` address; `production`: `https://api.<domain>`), not in `.env`. S2's guard
turns a mistake into a build that refuses to start instead of one that leaks.

#### S11-S13 · Outgoing URLs (Low, Fixed)

Every `openBrowserAsync` / `Linking` call site:

- **Buy** (`buy.ts:19`): only `EXPO_PUBLIC_API_URL + goPath`; `goPath` must now be `/api/v1/go/{id}` with an optional query. Glued to the
  origin, a value like `@evil.example` would have turned `https://api…@evil.example` into another host. A bad one is not opened. No seller URL
  is ever built on the phone.
- **Legal** (`legal.ts:39`): opened only when on the API's own origin (the backend serves `/legal/*` itself) or `https` on `LEGAL_HOSTS`
  (empty today).
- **Creator link** (`ProfileScreens.tsx:30`): `https` only, no credentials, and the card shows the host instead of the raw URL, so
  `https://instagram.com.evil.example/…` cannot hide behind a truncated line. Creator profiles are set by the founder today, which is why
  this is Low.
- `Linking.openSettings()` (push) opens the OS settings page only.

#### S14 · Screenshots (Low, Accepted)

The size map (measurements) and the delete-account screen can appear in screenshots and the app switcher. Blocking that needs
`expo-screen-capture` (a native module and a new build) and would also block harmless screenshots that users share. Passwords are
`secureTextEntry` already. Decision: accepted for the beta; revisit if measurements become more sensitive (e.g. body photos).

#### S15 · Server details in errors (Low, Accepted)

Forms show the problem document's `detail`. The backend hides exception details outside Development (`GlobalExceptionHandler`, S1 I10) and
writes `detail` for users; network errors show our own Turkish line. Accepted.

#### S16 · Dependencies (Low)

Measured: `npm audit --omit=dev` reports 9 moderate, 0 high, 0 critical, all in Expo's build tooling (`@expo/cli`, `@expo/config`,
`@expo/config-plugins`, `@expo/fingerprint`, `@expo/metro-config`, `glob`, `minimatch`, `node-forge`). None is in the bundle (checked
against the export's source map; only `@expo/cli`'s Metro module runtime is, not the vulnerable code). **Accepted** with a gate:
`npm run audit:ci` fails on any advisory outside `scripts/audit-allowlist.json` (each entry an advisory at its root package, with its
reason and review date; dependants of a listed root pass without being listed; since 17.11.2026, see CLAUDE.md "Dependencies"). `npx expo-doctor`: 18/20 checks pass; 15 packages are a patch behind SDK 58 and `react-native-safe-area-context` a minor
(the other failure is the React Native Directory server being unreachable). **Planned:** `npx expo install --check` in its own branch; several
of those packages are native, so it needs a new development build and a device check.

#### S17 · Pending-deletion credentials (Low, Fixed)

The password or ID token for "Silmeyi iptal et ve giriş yap" lives in a memory-only store until success or "Vazgeç". It is now also cleared
whenever a session ends (S1).

### Checked, nothing to fix (Info)

- **Tokens.** Refresh token only in `expo-secure-store` (`tokenStorage.ts`); access token only in memory; no query persister exists, so
  nothing from the cache reaches the disk. Never logged: the client logs method, path, status and correlation id, in development only, and
  the refresh token travels in a body. Never in analytics (allow-list plus `token` as a forbidden key), never in a route param.
- **Secrets.** Nothing secret in the bundle, `app.json`, `eas.json`, `.env.example` or the git history (searched every added line for keys,
  tokens and private-key headers; only test fixtures matched). `EXPO_PUBLIC_*` inlines the API URL and the two Google OAuth client ids, which
  are public by design; the EAS project id is public too.
- **Logging.** Every `console.*` in `src` sits behind `__DEV__`; `guards.test.ts` ("logging") fails on a new ungated call.
- **Clipboard.** Not used.
- **EXIF.** See S4.
- **Allow-list guard** cannot be bypassed in production: `track()` runs `findEventProblems` in every build and drops what fails.
- **No action without a tap.** See S5.
- **Push.** Registration is reset at sign-out and logout sends the push token so the backend deactivates the device (backend L7 accepted).
- **Deep links.** expo-router maps `kombin://` paths to routes only; an unknown path lands on the not-found screen, and every param is
  checked (S5).

---

## Part 2: Performance and memory

### Bundle (measured)

`npx expo export --platform android --source-maps`; module sizes by attributing the minified bundle's bytes through its source map
(`--no-bytecode` export, VLQ-decoded, sections format).

|                                      | Before          | After                    |
| ------------------------------------ | --------------- | ------------------------ |
| Android Hermes bytecode (`.hbc`)     | 4,966,956 B     | **4,695,272 B** (−5.5 %) |
| Minified JS (same code, no bytecode) | 4,035,004 B     | 3,701,921 B (−8.3 %)     |
| Fonts shipped                        | 6 faces, 724 KB | 5 faces, 603 KB          |

The 15 largest modules after the change (minified bytes): React Native's Fabric renderer 130 KB, `expo/virtual/streams.js` 61 KB (the
streams polyfill under `expo/fetch`), `react-hook-form` 47 KB, `zod/v4/core/schemas.js` 47 KB, our `src/i18n/tr.ts` 36 KB,
`zod/v4/classic/schemas.js` 32 KB, `whatwg-url-minimum` 30 KB (Expo's URL polyfill), `zod/v4/core/compile.js` 29 KB, React Native's
`VirtualizedList` 27 KB, and five Reanimated / gesture-handler files of 17-21 KB each (`backgroundImage` style processor,
`ReanimatedSwipeable`, the Reanimated index, `Zoom` layout animations, `Colors`). By package: Reanimated 625 KB, React Native 598 KB,
expo-router 457 KB, our own code 420 KB, zod 228 KB, gesture-handler 193 KB, react-native-svg 108 KB, worklets 97 KB.

Imports by path: the Archivo fonts are imported per weight (Task 15b-B), and no other package is imported from a root that drags in
siblings. Dead code: none found in `src` (every module is reached from a route). An `.hbc` exported **without** `--source-maps` is
5,745,680 B because it keeps debug info inline; EAS release builds strip it, so the budget uses the `--source-maps` figure.

### Findings

| ID  | Sev.   | Title                                                                                       | Where                                                               | Status                               |
| --- | ------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| P1  | High   | Photo lists keep ~21 screens mounted and decode photos at full size                         | every photo list; `Image` everywhere                                | Fixed                                |
| P2  | Medium | Grid and feed cards re-render on every keystroke, page and refetch                          | `ProductCard.tsx:31`, `PostCard.tsx:33`, `ItemTile.tsx:40`          | Fixed                                |
| P3  | Medium | Two copies of react-hook-form; zod ships 40+ locales                                        | `metro.config.js`                                                   | Fixed                                |
| P4  | Medium | An unused font face is loaded before first paint                                            | `AppProviders.tsx:59`                                               | Fixed                                |
| P5  | Medium | The splash waits for refresh **and** `/me`, with no time limit                              | `useSession.ts:48`                                                  | Fixed                                |
| P6  | Medium | Pull-to-refresh refetches every loaded page in sequence                                     | `DiscoverScreen.tsx`, `FeedSection.tsx:131`                         | Fixed (Keşfet, Akış); Planned (rest) |
| P7  | Medium | Infinite queries keep every page (`maxPages` unset)                                         | `catalog/hooks.ts:36`, `social/hooks.ts:51`, `wardrobe/hooks.ts:43` | Planned                              |
| P8  | Medium | React Native `Image` has no disk cache across launches and no recycling                     | `src/components/AppImage.tsx`                                       | Planned (needs a new build)          |
| P9  | Medium | Product cards get the original catalog image: the API has no thumbnail                      | `ProductCard.tsx`                                                   | Planned (backend)                    |
| P10 | Medium | Shimmer and skeleton loops ignore reduced motion                                            | `Shimmer.tsx`, `Skeleton.tsx`                                       | Fixed                                |
| P11 | Low    | React Compiler is off                                                                       | `app.json` (`experiments.reactCompiler`)                            | Planned                              |
| P12 | Low    | Reanimated + gesture-handler + worklets: ~915 KB for two gestures                           | swipe deck, swipe-to-delete                                         | Planned (evaluate)                   |
| P13 | Low    | zod's core is still 228 KB                                                                  | forms                                                               | Accepted                             |
| P14 | Low    | `pretty-format` (Expo HMR client) and `semver` (Reanimated's version check) ship in release | third-party                                                         | Accepted                             |
| P15 | Low    | Upload polls keep running while the app is in the background                                | `addItem.ts`, `createPost.ts`                                       | Accepted                             |
| P16 | Low    | Two pickers map one page inside a sheet's ScrollView                                        | `TagPickerSheet.tsx:65`, `CreatePostScreen.tsx`                     | Accepted (guarded)                   |

#### P1 · Photo lists (High, Fixed; reasoned, measure on device)

React Native's `VirtualizedList` keeps `windowSize: 21` (10 screens above and below the visible one) mounted, and each mounted `Image` holds
its decoded bitmap. On Android, RN's `Image` decodes at full resolution unless `resizeMethod="resize"` is set. Keşfet's 2-column grid
shows about 6 cards per screen, so about 120 photos stayed decoded; feed photos are the backend's 1600 px JPEG (about 1600×2000×4 B = 12.8 MB
each at full size). Fix:

- `src/components/listTuning.ts` `IMAGE_LIST_TUNING` (`initialNumToRender 6`, `maxToRenderPerBatch 6`, `windowSize 7`,
  `removeClippedSubviews` on Android) on the Keşfet/search/saved grid, Akış, profile and creator posts, Gönderilerim, Dolap, saved outfits
  and Fiyatlar. About a third of the mounted rows.
- `src/components/AppImage.tsx`, now the only image component (every `Image` was moved to it), always sets `resizeMethod="resize"`: a 1600 px
  photo in a 120 px tile costs about 60 KB instead of 10 MB. Every call site sizes the image by its style (fill a box or explicit
  width/height).
- Thumbnails where the API has them: the wardrobe grid and pairings use `thumbUrl`, Gönderilerim and creator stats `previewUrl` (400 px),
  outfit and tag images the cutout/thumbnail. Feed cards are full width, where the 400 px preview would look soft on a 3x screen, so they
  keep the 1600 px rendition, now decoded at card size. Product images: P9.
- `stableImageUrl` stays bounded at 300 entries and is now cleared at sign-out.

_Guard:_ `__tests__/performance/lists.test.ts` fails when a screen that renders a paged query's pages does not use
`FlatList`/`SectionList`/`ProductGrid`, or when a photo list drops `IMAGE_LIST_TUNING`.

#### P2 · Re-renders (Medium, Fixed; measured in Jest)

The React Compiler is off (P11), so nothing was memoised: `ProductGrid` and the feed passed inline `renderItem`s and new `onPress` arrows,
and the search screen re-renders on every keystroke (its state is the term). Every mounted card re-rendered on each keystroke, page,
refetch and query status change. Now `ProductCard`, `PostCard` and `ItemTile` are `memo`; `ProductGrid` hands cards one stable
`onPress` that calls the caller's latest function (callers need not memoise); post lists use module-level `renderPost` / `postKey`; Dolap
memoises its handlers. The cache patches already replace only the post or item they touch, so a like re-renders one card. Zustand stores
are read through selectors everywhere (checked); there are no context-based stores.

_Guard:_ `__tests__/performance/renderCounts.test.tsx` counts renders of the Keşfet grid card and the feed card: a parent re-render with
new callbacks and a new header renders no card; a changed product or post renders exactly that one. Removing either `memo` makes it fail
(checked).

#### P3 · Duplicate and unused dependency code (Medium, Fixed; measured)

- `@hookform/resolvers` is CommonJS and `require`s `react-hook-form`, which resolved to its CJS build while our imports got the ESM one: two
  copies (46 KB). `metro.config.js` resolves every `react-hook-form` to the ESM build.
- zod's entry points re-export all 40+ locales (`export * as locales`), about 300 KB of source; the app writes its own Turkish messages and
  never calls `z.locales.*`. `metro.config.js` points zod's `../locales/index.js` at `src/shims/zodLocales.js`, which keeps English (zod's
  own default, imported directly by its schemas). zod went from 506 KB to 228 KB in the bundle.
- Jest does not use Metro, so tests run the untouched packages; the resolver only shapes the app bundle.

#### P4 · Unused font (Medium, Fixed)

`Archivo_700Bold` was loaded by `useFonts` before the splash hid, and shipped (121 KB), but no style used it (`fontFamilies.bold` had no
reader). Removed; the two narrow bold cuts carry every bold text.

#### P5 · Splash (Medium, Fixed)

`bootstrapSession` awaited the refresh and then `GET /me` before the splash could hide; `fetch` has no timeout, so on a poor network the
splash stayed up for as long as the OS kept the connection open. Now `/me` is prefetched in the background (nothing on the first screen
needs it), and the splash waits at most `BOOT_TIMEOUT_MS` (6 s) for the refresh: after that the app opens signed out and switches to signed
in the moment the refresh answers (`useSession.ts:48`). _Proof:_ `bootstrap.test.ts` (both cases). Other start-up work: fonts (5 faces) and
the session block the splash on purpose; the legal fetch, personas, push sync and the temp purge do not (push sync runs after sign-in,
personas when a screen asks, legal when a row is tapped, the purge natively at module load).

#### P6 · Refresh refetches every page (Medium, Fixed for Keşfet and Akış)

`refetch()` of an infinite query asks for every loaded page, one after another (40 requests after 40 pages). `src/api/infinite.ts`
`refetchFromFirstPage` cuts the list back to its first page and refetches that one; the old first page stays on screen meanwhile. Used by
Keşfet's and Akış's pull-to-refresh. _Planned:_ the same for Dolap, Gönderilerim, profile posts and saved outfits (each needs its query key at
the call site), and for invalidations after a mutation (`invalidateWardrobe` refetches every loaded page of the wardrobe list).

#### P7 · `maxPages` (Medium, Planned)

Unbounded pages are not the RAM risk here: a product or post item is 1-3 KB of JS, so 1,000 scrolled items are a few MB; the photos are
what costs (P1). Setting `maxPages` drops pages from the **top** of a `FlatList` while the user scrolls down, which jumps the list unless
we also add `getPreviousPageParam`, `onStartReached` and `maintainVisibleContentPosition`, and that needs a device to verify. Inactive lists
are already freed: TanStack's default `gcTime` (5 minutes) removes a list once its screen is gone, and sign-out clears everything (S1).
_Plan:_ measure the JS heap after Akış 50 posts and Keşfet 200 products (last section); if it grows by more than ~30 MB beyond the
image memory, add `maxPages: 10` with backward paging and test it on a device.

#### P8 · `expo-image` (Medium, Planned; needs a new development build)

RN's `Image` caches decoded images in memory only (and on Android through Fresco's small disk cache), so every cold start downloads Keşfet's
and Akış's photos again, and list cells are not recycled. `expo-image` brings a memory and disk cache across launches, decode-time
downsampling on both platforms, `recyclingKey` for list cells and placeholders. Expected gain, reasoned: on a warm start, Keşfet's first
screen (about 12 product photos plus the daily card) comes from disk instead of the network; scrolling back up a long list re-renders
without re-downloading; memory is about what P1 already gives. It is a native module: adding it requires a new EAS development build and
new preview builds for testers. **The swap is one file:** `AppImage` already takes `uri`, `style` and `contentFit` with `expo-image`'s names;
replace its body with `<Image source={uri} contentFit={contentFit} recyclingKey={uri} cachePolicy="memory-disk" … />`.
Recommendation: do it with the next native rebuild (it can ride along with S16's patch updates).

#### P9 · Product thumbnails (Medium, Planned: backend)

`ProductListItem` has only `primaryImageUrl`, the retailer's original image (often 1000-2000 px). Every card downloads it in full even though
it is decoded at card size. _Plan (backend):_ store a 400 px rendition of the primary image when an offer is upserted (the embedding job
downloads it already) and add `thumbnailUrl` to `ProductListItem`; the app then uses it in grids and keeps the original on the detail
screen. This is the largest network saving left on Keşfet.

#### P10 · Reduced motion (Medium, Fixed)

Only `PressableScale` honoured the OS setting; `Shimmer` (every processing wardrobe tile, Lens scanning) and `Skeleton` looped forever. Both
now stand still under reduced motion (`useReducedMotion`). All animations run on the native driver / UI thread and animate `transform`
or `opacity` only (checked: the swipe deck and swipe rows use Reanimated transforms; the shimmer a `translateX`; the skeleton `opacity`).

#### P11 · React Compiler (Low, Planned)

`babel-preset-expo` turns the compiler on only with `experiments.reactCompiler` in `app.json`, which is not set. It would memoise components
and callbacks automatically (P2 by hand covers the hot paths). JavaScript only, no native build, but it changes the whole app's render
behaviour: turn it on in its own branch with a full test run and a device pass.

#### P12 · Gesture libraries (Low, Planned evaluation)

Reanimated (625 KB), gesture-handler (193 KB) and worklets (97 KB) serve two gestures: the onboarding swipe deck and swipe-to-delete on
Fiyatlar. Both could be built on React Native's `PanResponder` + `Animated` (as the outfit sheet already is). Not done: those libraries are
native, so removing them needs a new build, and the deck's feel must be checked by hand. Evaluate before the public launch; Metro's
experimental tree shaking is the other route.

#### P13-P16 (Low, Accepted)

- zod's core (schemas, the JIT `compile.js`, JSON-schema conversion) is 228 KB; `zod/mini` shares the same core. CLAUDE.md fixes
  react-hook-form + zod; accepted.
- `pretty-format` (17 KB, imported by Expo's HMR client) and `semver` (18 KB, Reanimated's worklets version check) ship in release bundles.
  Third-party imports; aliasing them away is not worth the risk.
- Upload polls continue in the background for at most 40 s / 120 s (iOS suspends JS anyway); they stop on timeout, 404, unmount (posts) and
  sign-out (S3).
- The tag picker and the saved-outfit picker map the first page of their query inside a bottom sheet's ScrollView; they never load a second
  page, so the list is bounded. `lists.test.ts` fails if either starts calling `fetchNextPage`.

### Checked, nothing to fix (Info)

- **Leaks.** `AnalyticsTracker`'s `AppState` listener, `NotificationHandler`'s received-listener and the shimmer/skeleton loops are removed on
  unmount; the analytics queue clears its timer and caps its backlog at 500; PanResponders live in refs; Reanimated shared values are local
  to their components; `stableImageUrl` is capped at 300; the wardrobe add store's maps are per upload and now reset at sign-out.
- **Query cache per family.** Default `staleTime` 60 s, `gcTime` 5 min. Catalog categories and brands 10 min fresh; personas, profile, saved
  ids 5 min; notifications 0 (refetched on focus); outfits 1 h (`keepPreviousData` for shuffles); the feed and post lists default. Inactive
  queries leave after 5 minutes, so search terms do not pile up; tab screens stay mounted, so their active lists are bounded by what the user
  scrolled (P7).
- **Polling.** Only the two upload watches poll (no `refetchInterval` anywhere); see P15.
- **Keystrokes.** The search screen debounces queries by 300 ms; with P2 a keystroke re-renders the field and the grid shell, not the cards.
- **Animations.** See P10.

---

## CI guards added

| Command / test                                | Fails when                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run size:check`                          | the Android Hermes bundle exceeds `scripts/size-budget.json` (fixed limit 10,240,000 B = 10000 KB since 17.11.2026); `-- --update` re-measures |
| `npm run audit:ci`                            | `npm audit --omit=dev` reports a high/critical advisory, or any advisory outside `scripts/audit-allowlist.json`                                |
| `__tests__/performance/renderCounts.test.tsx` | a Keşfet grid card or a feed card re-renders when its props did not change                                                                     |
| `__tests__/performance/lists.test.ts`         | a paged screen renders without a virtualised list, or a photo list drops `IMAGE_LIST_TUNING`                                                   |
| `__tests__/session/userScope.test.tsx`        | anything of the previous user can render, or stay in a store, after sign-out                                                                   |
| `__tests__/security/guards.test.ts`           | an ungated `console.*` appears; a validator (API URL, route params, `goPath`, legal URL, temp files, screen names) lets something through      |

---

## What must be measured on a real device

Nothing in this branch needs a new native build, but the numbers below are only real on a phone. Use a **preview** build (release JS, no
dev tools: `eas build --profile preview --platform android`) pointed at the tunnel's `https` address, signed in with a test account that
has a wardrobe of 20+ pieces. Run every step on the build **before** this branch (main) and **after** it, on the same phone, after a
reboot, with nothing else open.

### Android memory (adb)

1. Connect the phone (USB debugging on). Check: `adb devices`.
2. Cold start: `adb shell am force-stop app.kombin.mobile`, open the app, wait on Keşfet for 10 s.
3. Baseline: `adb shell dumpsys meminfo app.kombin.mobile > before-keşfet.txt`. Note **TOTAL PSS**, **Java Heap**, **Native Heap** and
   **Graphics** (decoded bitmaps live in Native/Graphics).
4. **Keşfet, 200 products:** scroll down steadily until about 200 products have passed (10 pages of 20, 100 rows of two), then wait 5 s
   and run `adb shell dumpsys meminfo app.kombin.mobile > after-keşfet.txt`.
5. Scroll back to the top, wait 10 s, dump again (`back-keşfet.txt`): memory should fall back towards the baseline.
6. **Akış, 50 posts:** open Akış (Herkes), dump (`before-akis.txt`), scroll through 50 posts (3 pages of 20), wait 5 s, dump
   (`after-akis.txt`).
7. **Lens 5 times:** from Keşfet tap the camera in the search field, pick a gallery photo, wait for results, go back; repeat 5 times, then
   dump (`after-lens.txt`). Also check the cache folder stays empty afterwards:
   `adb shell run-as app.kombin.mobile ls cache/ImagePicker cache/ImageManipulator` (preview builds are not debuggable; use a development
   build for this one check, or skip it).
8. Expected after this branch (reasoned): Keşfet's Graphics + Native growth in step 4 well under main's (about a third of the decoded photos);
   Akış's growth per post far lower (photos decoded at card size); after-lens close to before-lens.

### Android Studio profiler (frame times and allocations)

1. Android Studio → **Profiler** → `+` → the phone → `app.kombin.mobile` (preview builds: enable "profileable" or use a development build
   with JS dev mode off: `npx expo start --no-dev --minify`).
2. **Memory** track: record while repeating steps 4 and 6; note the peak and whether it returns after scrolling back.
3. **CPU** → _System Trace_ while typing "blazer" quickly on the search screen with results visible: look for long frames (>16 ms) on the
   JS and UI threads. With P2, keystrokes should no longer re-render the grid's cards.
4. In the app: Settings → Developer options → **Profile HWUI rendering** "On screen as bars" while flinging Keşfet and Akış: bars should stay
   under the green line most of the time.

### Start-up

1. `adb shell am force-stop app.kombin.mobile && adb shell am start -W -n app.kombin.mobile/.MainActivity` → note **TotalTime**; repeat 5
   times and take the median, signed in and signed out.
2. Poor network: turn on airplane mode, start the app: the splash must hide within ~6 s (P5) and show the signed-out Keşfet; turn the
   network back on: the app switches to signed in without a restart.

### Sign-out, two accounts (manual check of S1)

Sign in as A, open Dolap, Kaydedilenler, Fiyatlar, Bildirimler and search for "blazer"; sign out; sign in as B: none of A's pieces, saved
products, alerts, notifications or recent searches may appear at any moment, not even while B's lists load.

### iOS (if an iPhone is at hand)

Xcode → Open Developer Tool → **Instruments** → _Allocations_ and _VM Tracker_ on the preview build; repeat steps 4, 6 and 7 and compare
"All Heap & Anonymous VM" before and after.

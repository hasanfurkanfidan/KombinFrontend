# Kombin mobile — agent guide

Kombin is a mobile app that learns a user's style(s), manages their wardrobe, suggests outfits, compares prices across Turkish retailers (Trendyol, Hepsiburada, brand sites) and redirects users to buy through affiliate links. **The app never sells anything itself.** The backend is a .NET Minimal API (`../kombin-backend`); its contract is `docs/openapi.json`.

This repo is the Expo (React Native) client. Implemented so far:

- shared foundation (theme, navigation, API client, session);
- **Auth** (register, login, session persistence, token refresh, logout);
- **Catalog** (Keşfet product list with filters, product detail with offers and price history);
- **Personas & onboarding** (audience → persona name → swipe → summary; persona chips on Keşfet; match scores);
- **Saved products** (bookmark on cards and detail, Kaydedilenler grid);
- **Price/stock alerts** (alert sheet on detail, **Takip** tab with stats, status lines and swipe-to-delete);
- **Profile** (persona list and actions) and the **size map** (measurements, per-brand sizes, size hint on detail);
- **Buying** through the backend `/go` redirect;
- **Push** (permission, Expo push token, device registration, foreground banner, tap routing; see below);
- **Notifications** (bell badge on Keşfet, notifications screen, preferences sheet);
- **Analytics** (batched event client, anonymous id, see below).

Nothing else exists yet (wardrobe, outfits, social feed, visual search); do not scaffold screens for features the backend does not have.

## Stack and hard constraints

- Expo SDK (managed workflow, **no `expo prebuild`**, no custom native modules), TypeScript `strict`, **Expo Router**.
- Server data: **TanStack Query**. Client state: **Zustand** (session only for now). No Redux, no MobX, no context-based global stores.
- Styling: plain `StyleSheet` + the central theme. **No Tailwind/NativeWind, no UI kit** (Paper, Tamagui, …). Components are custom and live in `src/components`.
- HTTP: `fetch` wrapped in **one** typed client, `src/api/client.ts`. No axios.
- Tokens: access token in memory (Zustand), refresh token in `expo-secure-store`. **Never `AsyncStorage` for tokens.**
- Forms: `react-hook-form` + `zod` (`@hookform/resolvers` is the glue). Validation messages are Turkish.
- Charts: one small custom SVG chart (`react-native-svg`). No charting library.
- Lint/format: ESLint (`eslint-config-expo`) + Prettier. `npm run lint` (zero warnings) and `npm run typecheck` must pass.
- Tests: Jest (`jest-expo`) + React Native Testing Library.
- All code, comments and docs are English. **All user-facing copy is Turkish** and lives in `src/i18n/tr.ts` (one flat object, no i18n library).
- Do not add a package unless it is strictly required; say why in the PR/summary. Added for personas/alerts: `expo-notifications` + `expo-device` (push permission and token), `react-native-gesture-handler` + `react-native-reanimated` + `react-native-worklets` (the swipe deck and swipe-to-delete rows; `worklets` is reanimated 4's required peer).
- Installing those needed `npm install --legacy-peer-deps` once (npm tried to resolve the optional `react-dom` peer to a version that wants a newer React). Afterwards a plain `npm install` works.
- `jest-expo` 58 needs `@react-native/jest-preset` as a peer. An install with `--legacy-peer-deps` skips peers and prunes it, and then `npm test` dies with "The React Native Jest preset ... has moved". Restore it without touching the manifest: `npm install --no-save --legacy-peer-deps @react-native/jest-preset@0.88.1`.
- The notifications preferences have no native time picker (it would need an extra package for one setting): quiet hours use two `Stepper`s per time (`features/notifications/TimeStepper`).

## Layout: `app/` vs `src/`

- `app/` holds **Expo Router route files only** (groups: `(tabs)`, `(auth)` modal, `(onboarding)` modal; plus `product/[id]`, `profile/sizes` and `notifications`). A route file wires a route to a screen component from `src/` (usually a one-line re-export). No logic, no UI, no styles in `app/`. The one non-trivial file is `app/_layout.tsx`, and even that only composes `src/components/AppProviders`.
- All logic and UI live in `src/`:
  - `src/theme` — tokens, spacing, typography (`import { theme } from '@/theme'`).
  - `src/api` — `client.ts`, `endpoints/*`, `queryKeys.ts`, `queryClient.ts`, `models.ts`, `types.gen.ts` (generated).
  - `src/session` — Zustand `sessionStore`, secure-store `tokenStorage`, `useSession` (bootstrap, sign-in/out helpers).
  - `src/features/<feature>` — screens, components and hooks of one feature (`auth`, `catalog`, `onboarding`, `personas`, `saved`, `alerts`, `tracking`, `sizes`, `profile`, `notifications`, `placeholder`).
  - `src/push` — permission, token, device registration, `PushLifecycle` (registration on cold start/sign-in, foreground banner, tap routing). `src/session/prefsStore.ts` — small Zustand store for local preferences.
  - `src/analytics` — event queue, allow-list guard, anonymous/session ids, `AnalyticsTracker` (see "Analytics" below).
  - `src/components` — shared, feature-agnostic UI (`Button`, `TextField`, `Chip`, `Screen`, …).
  - `src/i18n/tr.ts`, `src/utils`.
- `@/` is an alias for `src/` (tsconfig paths + Jest `moduleNameMapper`).
- Tests live in `__tests__/` and mirror `src/`.

## Theme-token rule

No hard-coded colours, font sizes, radii or spacing in components. Use `theme.colors`, `theme.spacing`, `theme.radius`, `theme.sizes`, `theme.typography`. Missing a value that the design needs? Add a token, then use it. `accent` (green) is **only** for positive price/stock signals (price drop, in stock, savings); `warning` is for price increases, sold-out and form errors. Touch targets are at least 44 px. The visual reference is `docs/design/kombin-app-tasarimi.pdf`; when it disagrees with a task document, the PDF wins for layout/visuals, the task wins for behaviour and data.

## Types come from `docs/openapi.json`

`src/api/types.gen.ts` is generated by `openapi-typescript`; **never edit it and never hand-write a type the contract already defines**. When the backend changes, copy its new `/openapi/v1.json` over `docs/openapi.json` and run `npm run api:types`. `src/api/models.ts` only re-exports named picks from the generated types. Two contract quirks to know:

- Decimals/ints are typed `number | string` (OpenAPI 3.1 from .NET); the API really sends numbers. Normalize with `toNumber()` from `src/utils/money.ts` before doing arithmetic or formatting.
- `ProblemDetails` in the contract has no `errorCode`/`errors`; the backend adds them. `ProblemBody` in `models.ts` extends the generated type with those two extensions.

## Personas, `personaId` and match scores

- A **persona** is one of the user's styles (Ofis, Hafta sonu, …; at most 6, `MAX_PERSONAS`). Exactly one is _active_ (`GET /me/personas` → `isActive`); the backend activates the first one automatically, later ones are created inactive and activated with `PUT /me/personas/{id}/activate`. `useCreatePersona` does that activation right after creating a persona that came back inactive (a failure is swallowed: the chip row can switch later), so Keşfet switches to the persona the user is training.
- **`personaId` convention:** the active persona's id is the only thing that makes the backend personalise. Send it as `PersonaId` on `GET /catalog/products` (adds `matchScore`, allows `sort=match`) and as `personaId` on `GET /catalog/products/{id}` and on the `/go` link. It needs a bearer token, so calls that carry it use `auth: true`. Logged out, or without personas, send none: Keşfet and detail must keep working.
- `usePersonas()` / `useActivePersona()` (`features/personas/hooks`) are the one way to read it. Signed-in screens wait for the persona query before fetching products, so a list is fetched once, already scored. `withPersona(filters, personaId)` (`features/catalog/filters`) joins it into the query and makes `match` ("Sana göre") the default order; `sort=match` without a persona is dropped (the backend answers 400).
- Match badge: shown only when `matchScore ≥ 40` (`matchBadgeScore`); below that nothing is shown.
- Card footer: with more than one seller it reads `En ucuzu {cheapestSeller.name} · {n} satıcı` (the seller of the offer behind `lowestPrice`), or `{n} satıcıda en ucuzu` when `cheapestSeller` is `null`; with one seller there is no footer.
- `PUT /me/profile` **replaces** the measurements (a field left out is cleared) and keeps the audience when it is `null`. Always build the body with `toUpdateRequest(profile, patch)` (`features/profile/hooks`).
- Swipes: `createSwipeOutbox` (`features/onboarding/swipeOutbox`) batches every 5 swipes, flushes when the screen is left, retries a failed batch once and then drops it silently. Only the first run moves on as soon as the backend says `onboardingCompleted`; re-training a persona runs until the cards are used up.

## Onboarding entry rule

`OnboardingGate` (mounted in `AppProviders`) fires **once per sign-in**: when `GET /me/profile` says `personaCount === 0`, the user is sent to `/audience` (`app/(onboarding)`) instead of the tabs. It does not fire again later in the session (e.g. after archiving the last persona), while already inside onboarding, or after "Atla". Skipping creates nothing and sets `prefsStore.onboardingSkipped`, which is **kept in memory only**: a skipped onboarding is asked again on the next launch. The same screens run as a modal for "+" on Keşfet and "Yeni tarz oluştur" on Profil (`flow=new`) and for "Tarzını yeniden öğret" (`flow=retrain`); `flow`/`returnTo` are route params (`features/onboarding/flow`).

## Buying: `goPath` only

The app never builds or opens a seller URL. Every buy action (the detail bar button and the "Git" link on each offer) opens `EXPO_PUBLIC_API_URL + offer.goPath + '?src=product_detail' (+ '&personaId=…')` in `expo-web-browser`; the backend records the click and answers `302` to the affiliate URL, which the browser follows. Use `openOffer` / `buildGoUrl` (`features/catalog/buy`); the contract's `OfferResponse` has no seller `url` on purpose. `openOffer` also reports `buy_click { offerId, source }`.

## Push (`src/push`)

- `requestPushPermission()` asks for the OS permission (skipped on simulators via `expo-device`) and, on grant, stores the Expo push token in `prefsStore.pushToken` (memory only) and registers it. It is only called from the contextual sheet "Fiyat düşünce haber verelim mi?", shown **once after the user's first alert** (`usePushPrimer`), and from the "İzin ver" button in the preferences sheet; never on app start.
- `registerPushToken()` → `PUT /me/devices { expoPushToken, platform: Ios|Android, appVersion, deviceName }` (204, idempotent), signed-in only, best effort, **once per token per launch**. `syncPushRegistration()` (run by `PushRegistration` in `AppProviders` on every cold start and sign-in) reads the token **without prompting** when the OS permission is already granted and registers it. Sign-out calls `resetPushRegistration()` so the next sign-in registers again.
- Logout sends the push token in the body (`POST /auth/logout { refreshToken, expoPushToken }`); the backend deactivates that device. If the token is not known yet, logout simply omits it.
- `NotificationHandler` (also in `AppProviders`) shows foreground pushes as a banner (and refreshes the bell/feed) and routes a tap, including the one that cold-started the app, by `data.deepLink`. The backend's push payload **is** the notification's `data` (`deepLink` plus ids): it carries no notification id or kind, so `handlePushTap` (`features/notifications/pushTap`) finds the newest unread feed entry with the same `deepLink` to report `notification_open` and to mark it read; if that lookup fails the screen has already opened and nothing else happens.
- `openNotificationSettings()` opens the OS settings page for the denied state (used by the preferences sheet).
- There is no EAS project id yet, so on a real device `getExpoPushTokenAsync` may fail until `extra.eas.projectId` is configured; the app then simply has no token.

## Notifications (`features/notifications`)

- Route `app/notifications.tsx`, opened from the bell on Keşfet (`NotificationBell`: badge from `GET /me/notifications/unread-count`, refetched on every focus with `useFocusEffect`, joining an in-flight fetch). Signed out, the bell still opens the screen, which shows a login prompt.
- The screen (design screen 06) is a `SectionList` of the feed (`GET /me/notifications`, 30 per page, infinite) grouped Bugün / Dün / Daha önce by device-local day (`groupByDay`), with client-side filter chips Tümü / Fiyat (`PriceDrop`, `AnyChange`) / Stok (`BackInStock`) / Öneri (`NewMatches`); `System` shows only under Tümü. Unread rows are filled cards (green icon square for a price drop, the one positive signal), read rows are outlined.
- A tap runs `useOpenNotification`: `notification_open` event, `POST /me/notifications/{id}/read` (optimistic, only if unread) and `goToTarget` by `data.deepLink`: `kombin://product/{id}` → product detail (`source=notification`), `kombin://matches/{personaId}` → **activates that persona and goes to Keşfet** (there is no persona screen), `kombin://notifications` → the screen itself. `parseDeepLink` accepts only those three shapes.
- The header menu has "Tümünü okundu işaretle" (`POST /me/notifications/read-all`); the sliders button and the Profil row "Bildirim tercihleri" open `PreferencesSheet` (`GET/PUT /me/notification-preferences`): toggles for price/stock/recommendations, weekly maximum 1-7, quiet hours (both times or `clearQuietHours`), and a notice with a link to the OS settings (denied) or an "İzin ver" button (not asked yet). The form edits a local draft and sends **one** PUT on "Kaydet"; times are `HH:mm`, Istanbul time (the backend's `timeZone`).

## Analytics (`src/analytics`)

- `track(name, props)` is fire-and-forget (never awaits, never blocks the UI). Events go into a queue that flushes at **20 events or 15 s after the first queued one**, and on `app_background`; at most 50 per request; a failed batch is tried once more on the next flush and then dropped; the backlog is capped at 500. `POST /api/v1/events` is sent with the bearer token when signed in, anonymously otherwise.
- **Allow-list guard** (`events.ts`): `EventProps` types every call site and `EVENT_KEYS` mirrors the backend README table exactly (event names and property keys; `__tests__/analytics/events.test.ts` repeats that table). In development `track` **throws** on an unknown event, a key outside the event's set, a missing required key, a nested value, or a key named `email`/`name`/`phone`/`address`/`token`; in production such an event is dropped silently. `search` carries `queryLength` only, never the text (nothing emits it yet: there is no search UI). Change the client table whenever the backend's changes. The backend judges events one by one: a rejected one is logged in dev and never costs the rest of the batch.
- `anonymousId` is generated once and kept in secure store (`kombin.anonymousId`), sent **on every event** (not per batch) and in the login/register bodies so the backend attaches the pre-login events to the user. `sessionId` is a new id per cold start.
- Emitted: `app_open` (cold start and each return from the background) / `app_background` / `screen_view` (`AnalyticsTracker`, `usePathname`, uuids replaced by `:id`), `product_view` (detail, once per opened product, `source` from the `?source=` route param: `discover`, `saved`, `alert`, `notification`, `push` or `direct`; build links with `productHref`), `product_list_view` (Keşfet, once per filter set; filter _names_ only), `swipe`, `onboarding_step` (first run only: `audience`, `persona`, `swipe` with `next`/`skip`, then `done` + `done` on the summary button), `alert_created`, `buy_click`, `notification_open`.
- Jest replaces `@/analytics` with a no-op in `jest.setup.ts` (the real queue owns a timer); tests of the module itself use `jest.requireActual('@/analytics')`, and screen tests assert on `track`.

## Session and refresh behaviour (summary)

- `request(path, { auth: true })` sends the bearer token. Public catalog calls send none, so Keşfet and product detail work logged out.
- Every request carries `Accept: application/json` and a fresh `X-Correlation-ID` (uuid v4); failed requests log the id in dev.
- Errors are parsed from `application/problem+json` into `ApiError { status, errorCode, detail, fieldErrors, correlationId }`; `status 0` means the network was unreachable. Forms map `fieldErrors` onto fields (`features/auth/formErrors.ts`), otherwise show `detail`.
- Proactive refresh: if the access token has < 60 s left, refresh before sending. On a 401: refresh once, retry the request once. Concurrent refreshes share **one** in-flight promise (refresh tokens are single-use/rotated). A second 401 or a rejected (4xx) refresh clears the session and the root layout routes to login; a network failure during refresh does **not** log the user out.
- Bootstrap (`bootstrapSession`, run from `AppProviders`): stored refresh token → refresh → `GET /me` → ready. The native splash stays up until fonts and the session are ready, so a logged-in user never sees the login screen flash.
- Logout: `POST /auth/logout` with the refresh token and the push token (best effort), then always clear local state.

## How to add a screen

1. **Route file** in `app/` (e.g. `app/(tabs)/wardrobe.tsx`) that only exports/wires the screen from `src/`.
2. **Screen component** in `src/features/<feature>/<Name>Screen.tsx`.
3. **Feature folder**: its components, filters/helpers, and copy added to `src/i18n/tr.ts`.
4. **Query hook** in `src/features/<feature>/hooks.ts` using `queryKeys` and an endpoint function in `src/api/endpoints/<feature>.ts` (typed from `models.ts`). Add the query key to `src/api/queryKeys.ts`.
5. **Test** in `__tests__/features/<feature>/` — at least one render test of the screen (mock `@/api/endpoints/...`; helpers in `__tests__/testUtils.tsx`).

## Commands

```bash
npm start            # Expo dev server
npm run android      # open on Android
npm run ios          # open on iOS
npm run lint         # eslint, zero warnings allowed
npm run typecheck    # tsc --noEmit
npm test             # jest
npm run api:types    # regenerate src/api/types.gen.ts from docs/openapi.json
npm run format       # prettier --write
npx expo export --platform android   # proves the bundle builds without a device
```

Configure the backend URL in `.env` (`EXPO_PUBLIC_API_URL`, see `.env.example`). On the Android emulator `localhost` is the emulator itself: use `http://10.0.2.2:<port>`; on a physical device use the machine's LAN address.

## Working rules

- **Do not abstract until the third repetition.** Two similar pieces of code are fine; extract on the third.
- **Do not commit unless asked** (a task document that says "commit on the branch" counts as asking). Leave the working tree for review otherwise.
- Keep `npm run lint`, `npm run typecheck` and `npm test` green before declaring work done.
- Jest cannot run Reanimated/worklets natively: `jest.config.js` uses Reanimated's resolver, `jest.setup.ts` mocks Reanimated (its official mock), the worklets runtime holder and `ReanimatedSwipeable`, and `renderWithQuery` wraps screens in `GestureHandlerRootView`. The deck's drag gesture therefore is not covered by tests (the buttons path is); check it on a device.

## Out of scope (do not add)

Push _delivery_ (the backend sends; the app only registers and handles taps), offline cache/persisted queries, crash reporting and any analytics beyond the allow-listed events above, deep links/universal links beyond routing a push tap by `data.deepLink`, any UI kit or styling library, Redux/MobX or context-based global stores, i18n libraries, `expo prebuild`/native code, social login, dark mode.

# Handover: Task S2 (mobile Sentry), branch `task-s2-sentry`

## Done

- `@sentry/react-native` ~8.28 (MIT; Expo SDK 58's pin), `src/errorReporting/` (`index.ts` init + switch, `scrub.ts` allow-list scrubber). Off unless `EXPO_PUBLIC_SENTRY_DSN` is set; not started on web; `Sentry.init` in try/catch, so a missing native module means no reporting. No DSN in the repo.
- Reports: native crashes, unhandled JS errors and promise rejections, errors caught by the new root `ErrorBoundary` (`app/_layout.tsx`, `RootErrorFallback`). No tracing, replay, screenshots, view hierarchy, sessions; native auto-breadcrumbs off.
- Scrubber: allow-list event (exception type, scrubbed value, stack frames, os/device model/app version contexts, debug images); drops user, request, extra, device name, unknown tags/contexts. Breadcrumbs: navigation route template; HTTP method + route template + status. Release = native default `<bundleId>@<version>+<build>`.
- Tests: `__tests__/errorReporting/init.test.ts` and `scrub.test.ts` (66 tests written blind by an independent agent from the rules only; it found 8 leaks, all fixed in `scrub.ts`).
- Profil > Hesap: device-level "Hata raporları" switch (default on, survives sign-out), shown only when a DSN is set. No analytics opt-out exists in the app, so the switch covers error reports only.
- `docs/error-reporting.md`: what is sent, Sentry project settings, later EAS source-map step. CLAUDE.md updated.
- `package-lock.json` resynced (on main `npm ci` failed and jest could not start: `@react-native/jest-preset` missing).

## State

`npm run verify` passed in full before the commits: 116/116 suites, 1550/1550 tests, Android bundle 6471 KB / 10000 KB (Sentry adds about 1.6 MB). After that only the root fallback's body text changed (`app` + `i18n` tests rerun: pass).

## Remaining (owner)

- Create a Sentry project (React Native) in the EU region; turn on "Prevent storing IP addresses", server-side scrubbing and a rule removing `$user.*` (native crash reports skip the JS scrubber and may carry the native SDK's random installation id).
- Set `EXPO_PUBLIC_SENTRY_DSN` in the EAS environment; **yeni telefon derlemesi gerekir** (native module).
- Add Sentry to the privacy policy served by the backend (`GET /legal`); the app has no bundled privacy text.
- Later: source maps (plugin + metro + `SENTRY_AUTH_TOKEN` as an EAS secret), see `docs/error-reporting.md`.
- Optional: remove GHSA-fc5q-39xc-vjpf from the audit allow-list (no longer reported).

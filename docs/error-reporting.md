# Error reporting (Sentry)

Crash and unhandled-error reports for the phone app, through `@sentry/react-native` (~8.28, MIT). Code: `src/errorReporting/`
(`index.ts` starts it, `scrub.ts` is the privacy filter). Reports go to a Sentry project the owner creates; nothing is sent until then.

## What it is

- **Off unless `EXPO_PUBLIC_SENTRY_DSN` is set.** The DSN is an EAS environment variable (preview and production), not a file in the repo.
- **Not on web.** Only iOS and Android start it.
- **No native module, no reporting.** In Expo Go or any build without the module the app runs normally; init failures are swallowed.
- **Native code.** Adding the package (or later changing its Expo plugin) needs a new phone build with EAS. An OTA update cannot carry it.

## What is sent, and what never is

Every event and breadcrumb goes through `beforeSend` / `beforeBreadcrumb` (`scrub.ts`) and is rebuilt from an allow-list: a field the SDK
adds in a later version is dropped, not sent. If scrubbing throws, the event is dropped.

Sent:

- Exception type and message (message text scrubbed: URLs, file keys, e-mails, handles, IPs, tokens, quoted text, ids and phone numbers are
  replaced; at most 300 characters), mechanism, stack frames (file, function, line, column, `in_app`), thread info, debug image ids.
- Event id, timestamp, level, platform, `release`, `dist`, `environment` (`development` or `production`), SDK name and version.
- Device and OS context: OS name/version/build, device family/model/arch/simulator flag, app version/build, runtime and React Native/Hermes
  versions.
- Tags: environment/origin/platform, `hermes`, `error_boundary` (set when the root error boundary caught the error).
- Breadcrumbs, only two kinds: navigation (the route template, e.g. `/item/:id`) and HTTP (method, route template, status code). Ids, hosts,
  queries and fragments are removed from routes. Every other breadcrumb (console, touches, UI, lifecycle, custom) is dropped.
- `release` is the native default `<bundleId>@<version>+<buildNumber>`, i.e. the app version and the EAS build number.

Never sent: user object, IP address, e-mail, account or item ids, URLs with queries, request or response bodies, typed text, device name
(the owner's name is often in it), screenshots, view hierarchy, session replay, tracing/performance data, release-health sessions.
Default integrations that would collect more (HTTP context, failed-request capture, modules list, Expo constants, screenshot, view
hierarchy, replay, React Navigation and user-interaction tracing) are removed, and `sendDefaultPii` is `false`.

## Known limit: native crashes

A native crash (the app dying in native code, before JS can react) is written and sent by the native SDK, so it **bypasses the JS scrubber**.
The native SDKs may attach their own random installation id as `user.id` and their native device context. The app disables native
breadcrumbs and session tracking to keep these reports small, but cannot remove the installation id from the phone side.

Mitigation, in the Sentry project settings:

- Create the project in the **EU data region**.
- Turn **"Prevent storing of IP addresses"** on.
- Turn **server-side data scrubbing** on, with the default PII scrubbers on.
- Add an **Advanced Data Scrubbing** rule that removes `$user.id` (and `$user.*`) from all events.

## User switch

Profil > Hesap > the error-reports switch. It is device-level, on by default, and survives sign-out (stored in secure store under
`kombin.errorReporting`). Turning it off stops sending at once and closes the SDK; it is also checked in `beforeSend`, so an event queued
before the switch is dropped. At app start the stored choice is read before Sentry starts, so a user who said no never gets a native crash
handler.

## Owner setup

1. Create a Sentry project (platform React Native) in the **EU region** and apply the project settings above.
2. Copy its DSN into EAS: `eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --environment preview --environment production
   --visibility plaintext` (a DSN is a public client key, not a secret, but keep it out of the repo).
3. Build the phones again with EAS (the native module is part of the build).
4. Check: trigger a test error in a preview build and look for it in the project, with no user or IP shown.

## Source maps (later, not done now)

Until this is done there is no Sentry plugin and no upload step, so builds need no token, and stack traces from release builds are
**unsymbolicated** (Hermes bytecode offsets). They still group and count correctly.

When the owner wants readable traces:

1. Add the Expo plugin to `plugins` in `app.json`, with placeholders replaced by the real values:
   ```json
   ["@sentry/react-native/expo", { "url": "https://de.sentry.io/", "organization": "<org-slug>", "project": "<project-slug>" }]
   ```
   Use the URL of the EU region the project lives in. The plugin writes these into the native build's `sentry.properties`; the token is
   never put in app config.
2. Wrap `metro.config.js` (it already exists here and sets two resolver overrides, which must be kept): replace
   `getDefaultConfig` from `expo/metro-config` with
   ```js
   const { getSentryExpoConfig } = require('@sentry/react-native/metro');
   const config = getSentryExpoConfig(__dirname);
   ```
   and keep the rest of the file as is. This adds debug ids to bundles so source maps match.
3. Store the token as an EAS secret, never in the repo:
   `eas env:create --name SENTRY_AUTH_TOKEN --value <token> --environment production --environment preview --visibility secret`.
   The upload also reads `SENTRY_ORG`, `SENTRY_PROJECT` and, for the EU region, `SENTRY_URL` (e.g. `https://de.sentry.io/`) when they are
   not set in the plugin. `SENTRY_DISABLE_AUTO_UPLOAD=true` skips the upload (for example for a local or throwaway build).
4. Build with EAS; the native build steps upload the source maps and debug files.

**OTA updates.** If EAS Update (`eas update`) is used later, its JS bundles are not covered by the native build. After exporting
(`npx expo export --platform ios --platform android`) upload them with `npx sentry-expo-upload-sourcemaps dist`, with the same
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_URL` set in that shell.

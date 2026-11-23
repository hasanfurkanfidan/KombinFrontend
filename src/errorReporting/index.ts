import * as Sentry from '@sentry/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { scrubBreadcrumb, scrubEvent } from './scrub';

/**
 * Error reporting (Sentry). Crashes and unhandled errors only: no tracing, no replay, no screenshots, no sessions, and
 * every event and breadcrumb goes through `scrub.ts` first. Off without a DSN, on web, in Expo Go (no native module)
 * and when the user turned it off. The switch is the device's, not the account's: it survives sign-out.
 */

/** Device-level switch in secure store: `'off'` when the user turned reporting off; absent means on. */
export const ERROR_REPORTING_KEY = 'kombin.errorReporting';

/** Default integrations that would collect more than a scrubbed crash needs. */
const DROPPED_INTEGRATIONS = new Set([
  // Console, fetch/XHR and UI breadcrumbs: the app adds its own scrubbed navigation and HTTP breadcrumbs instead.
  'Breadcrumbs',
  // `request` with the user agent and URL.
  'HttpContext',
  // Failed-request events carry full URLs and headers.
  'HttpClient',
  // The list of native modules: not needed for a crash.
  'ModulesLoader',
  // Expo constants context (app name, session id, project id): not needed for a crash.
  'ExpoConstants',
  // Pictures of the screen and its contents.
  'Screenshot',
  'ViewHierarchy',
  'MobileReplay',
  // Tracing.
  'ReactNavigation',
  'UserInteraction',
]);

interface ErrorReportingState {
  /** The user's choice; `true` until the stored value is read (the default is on). */
  enabled: boolean;
}

export const useErrorReportingStore = create<ErrorReportingState>(() => ({ enabled: true }));

/** The user's choice, for the settings toggle. */
export function useErrorReportingEnabled(): boolean {
  return useErrorReportingStore((state) => state.enabled);
}

let initialised = false;
let ready: Promise<void> = Promise.resolve();

function dsn(): string | null {
  const value = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** `true` when there is something to turn off: a DSN is configured and the app runs on a phone (not web). */
export function isErrorReportingAvailable(): boolean {
  return dsn() !== null && (Platform.OS === 'ios' || Platform.OS === 'android');
}

async function readEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ERROR_REPORTING_KEY)) !== 'off';
  } catch {
    return true;
  }
}

/** The user's stored choice (on unless turned off). */
export async function isErrorReportingEnabled(): Promise<boolean> {
  const enabled = await readEnabled();
  useErrorReportingStore.setState({ enabled });
  return enabled;
}

function startSentry(): void {
  const key = dsn();
  if (initialised || key === null || !isErrorReportingAvailable()) {
    return;
  }
  try {
    Sentry.init({
      dsn: key,
      // `release` and `dist` stay unset: the native SDK fills `<bundleId>@<version>+<buildNumber>`, i.e. the app
      // version and the EAS build number (app.json has no build number of its own: EAS keeps it remotely).
      environment: __DEV__ ? 'development' : 'production',
      sendDefaultPii: false,
      // No tracing: no `tracesSampleRate`/`tracesSampler`, so no performance integration is installed.
      tracesSampleRate: undefined,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      attachScreenshot: false,
      attachViewHierarchy: false,
      attachStacktrace: true,
      enableAutoSessionTracking: false,
      enableNative: true,
      enableNativeCrashHandling: true,
      enableAppStartTracking: false,
      enableNativeFramesTracking: false,
      enableStallTracking: false,
      enableUserInteractionTracing: false,
      enableAutoPerformanceTracing: false,
      enableCaptureFailedRequests: false,
      // Native breadcrumbs reach native crash reports without passing `beforeBreadcrumb`: all of them are off.
      enableAutoBreadcrumbTracking: false,
      enableNetworkBreadcrumbs: false,
      enableNetworkEventBreadcrumbs: false,
      enableActivityLifecycleBreadcrumbs: false,
      enableAppLifecycleBreadcrumbs: false,
      enableSystemEventBreadcrumbs: false,
      enableAppComponentBreadcrumbs: false,
      maxBreadcrumbs: 50,
      integrations: (defaults) =>
        defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
      // The switch is checked again here, so an event already queued when the user turned reporting off is dropped.
      beforeSend: (event) => (useErrorReportingStore.getState().enabled ? scrubEvent(event) : null),
      beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
    });
    initialised = true;
  } catch {
    // No native module (Expo Go, web) or a bad DSN: the app runs without reporting.
    initialised = false;
  }
}

/** Starts reporting once at app start; does nothing without a DSN, off a phone, or when the user turned it off. */
export function initErrorReporting(): void {
  if (!isErrorReportingAvailable()) {
    return;
  }
  // The stored choice is read first: a native crash handler installed for a user who said no would still report.
  ready = isErrorReportingEnabled().then((enabled) => {
    if (enabled) {
      startSentry();
    }
  });
}

/** Settles when `initErrorReporting`'s read of the stored choice (and the start that follows) is done. */
export function errorReportingReady(): Promise<void> {
  return ready;
}

/** Turns reporting on or off for this device. Off stops sending at once; on starts reporting if it is not running. */
export async function setErrorReportingEnabled(enabled: boolean): Promise<void> {
  useErrorReportingStore.setState({ enabled });
  try {
    if (enabled) {
      await SecureStore.deleteItemAsync(ERROR_REPORTING_KEY);
    } else {
      await SecureStore.setItemAsync(ERROR_REPORTING_KEY, 'off');
    }
  } catch {
    // The choice still holds for this launch.
  }
  if (enabled) {
    startSentry();
    return;
  }
  if (initialised) {
    initialised = false;
    try {
      await Sentry.close();
    } catch {
      // Already closed or never had a native side.
    }
  }
}

function active(): boolean {
  return initialised && useErrorReportingStore.getState().enabled;
}

/** Reports an error the root error boundary caught. Never throws. */
export function reportBoundaryError(error: unknown): void {
  if (!active()) {
    return;
  }
  try {
    Sentry.captureException(error, { tags: { error_boundary: 'root' } });
  } catch {
    // Reporting must never break the fallback screen.
  }
}

/** Records the screen the user went to (a safe screen name, see `analytics/screenName`). */
export function addNavigationBreadcrumb(screenName: string): void {
  if (!active()) {
    return;
  }
  const crumb = scrubBreadcrumb({
    category: 'navigation',
    type: 'navigation',
    level: 'info',
    data: { to: screenName },
  });
  if (crumb) {
    Sentry.addBreadcrumb(crumb);
  }
}

/** Records an API call: method, route template (no ids, no query) and status, or a network failure. */
export function addHttpBreadcrumb(
  method: string,
  path: string,
  status: number | 'network_error',
): void {
  if (!active()) {
    return;
  }
  const failed = status === 'network_error';
  const crumb = scrubBreadcrumb({
    category: 'http',
    type: 'http',
    level: failed || status >= 500 ? 'error' : status >= 400 ? 'warning' : 'info',
    data: { method, url: path, ...(failed ? {} : { status_code: status }) },
  });
  if (crumb) {
    Sentry.addBreadcrumb(crumb);
  }
}

/** Test seam: forgets that reporting was started. */
export function resetErrorReportingForTests(): void {
  initialised = false;
  ready = Promise.resolve();
  useErrorReportingStore.setState({ enabled: true });
}

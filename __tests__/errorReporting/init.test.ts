import * as Sentry from '@sentry/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ErrorEvent } from '@sentry/react-native';

import {
  ERROR_REPORTING_KEY,
  addHttpBreadcrumb,
  addNavigationBreadcrumb,
  errorReportingReady,
  initErrorReporting,
  isErrorReportingAvailable,
  isErrorReportingEnabled,
  reportBoundaryError,
  resetErrorReportingForTests,
  setErrorReportingEnabled,
  useErrorReportingStore,
} from '@/errorReporting';

type Integration = { name: string };

const DSN = 'https://public@o0.ingest.example/1';
const originalOS = Platform.OS;

function setOS(os: string): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

async function start(): Promise<void> {
  initErrorReporting();
  await errorReportingReady();
}

function initOptions(): Sentry.ReactNativeOptions {
  const calls = jest.mocked(Sentry.init).mock.calls;
  const last = calls[calls.length - 1];
  if (!last) {
    throw new Error('Sentry.init was not called');
  }
  return last[0];
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetErrorReportingForTests();
  await SecureStore.deleteItemAsync(ERROR_REPORTING_KEY);
  process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
  setOS('ios');
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  setOS(originalOS);
});

describe('initErrorReporting', () => {
  it('does nothing without a DSN', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '';
    await start();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isErrorReportingAvailable()).toBe(false);
  });

  it('does nothing on web', async () => {
    setOS('web');
    await start();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isErrorReportingAvailable()).toBe(false);
  });

  it('does nothing when the user turned reporting off', async () => {
    await SecureStore.setItemAsync(ERROR_REPORTING_KEY, 'off');
    await start();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(useErrorReportingStore.getState().enabled).toBe(false);
  });

  it('starts on a phone with a DSN, with the privacy options', async () => {
    setOS('android');
    await start();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = initOptions();
    expect(options.dsn).toBe(DSN);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options).not.toHaveProperty('tracesSampler');
    expect(options.attachScreenshot).toBe(false);
    expect(options.attachViewHierarchy).toBe(false);
    expect(options.enableAutoSessionTracking).toBe(false);
    expect(options.replaysSessionSampleRate ?? 0).toBe(0);
    expect(options.replaysOnErrorSampleRate ?? 0).toBe(0);
    expect(options.enableNativeCrashHandling).toBe(true);
    expect(options.maxBreadcrumbs).toBe(50);
    expect(options.release).toBeUndefined();
    expect(options.dist).toBeUndefined();
  });

  it('scrubs every event and breadcrumb before sending', async () => {
    await start();
    const { beforeSend, beforeBreadcrumb } = initOptions();
    const event = {
      type: undefined,
      event_id: 'e1',
      user: { id: 'u1', email: 'ayse@example.com', ip_address: '1.2.3.4' },
      request: { url: 'https://api.kombin.test/api/v1/me?token=x' },
      extra: { body: 'secret' },
      contexts: { device: { name: "Ayşe'nin iPhone'u", model: 'iPhone15,2' } },
      exception: { values: [{ type: 'Error', value: 'Failed for ayse@example.com' }] },
    } as unknown as ErrorEvent;
    const sent = beforeSend!(event, {}) as ErrorEvent;
    expect(sent.user).toBeUndefined();
    expect(sent.request).toBeUndefined();
    expect(sent.extra).toBeUndefined();
    expect(sent.contexts?.device).toEqual({ model: 'iPhone15,2' });
    expect(JSON.stringify(sent)).not.toContain('ayse');

    expect(beforeBreadcrumb!({ category: 'console', message: 'hello Ayşe' }, {})).toBeNull();
  });

  it('drops default integrations that collect more than needed, keeps the error handlers', async () => {
    await start();
    const { integrations } = initOptions();
    const named = (name: string) => ({ name }) as Integration;
    const kept = (integrations as (d: Integration[]) => Integration[])(
      [
        'ReactNativeErrorHandlers',
        'Breadcrumbs',
        'HttpContext',
        'ModulesLoader',
        'DeviceContext',
      ].map(named),
    ).map((integration) => integration.name);
    expect(kept).toEqual(['ReactNativeErrorHandlers', 'DeviceContext']);
  });

  it('runs without reporting when the native SDK throws', async () => {
    jest.mocked(Sentry.init).mockImplementationOnce(() => {
      throw new Error('Native module RNSentry not found');
    });
    await expect(start()).resolves.toBeUndefined();
    addNavigationBreadcrumb('home');
    reportBoundaryError(new Error('x'));
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('the device switch', () => {
  it('is on by default and remembers "off"', async () => {
    await expect(isErrorReportingEnabled()).resolves.toBe(true);
    await setErrorReportingEnabled(false);
    expect(await SecureStore.getItemAsync(ERROR_REPORTING_KEY)).toBe('off');
    await expect(isErrorReportingEnabled()).resolves.toBe(false);
  });

  it('stops sending at once when turned off and starts again when turned on', async () => {
    await start();
    const { beforeSend } = initOptions();
    await setErrorReportingEnabled(false);
    expect(Sentry.close).toHaveBeenCalled();
    expect(beforeSend!({ type: undefined, event_id: 'e' }, {})).toBeNull();
    reportBoundaryError(new Error('x'));
    expect(Sentry.captureException).not.toHaveBeenCalled();

    await setErrorReportingEnabled(true);
    expect(await SecureStore.getItemAsync(ERROR_REPORTING_KEY)).toBeNull();
    expect(Sentry.init).toHaveBeenCalledTimes(2);
  });
});

describe('reportBoundaryError', () => {
  it('captures with the root boundary tag and never throws', async () => {
    await start();
    const error = new Error('render failed');
    reportBoundaryError(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { error_boundary: 'root' },
    });
    jest.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => reportBoundaryError(error)).not.toThrow();
  });

  it('does nothing before reporting started', () => {
    reportBoundaryError(new Error('x'));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('breadcrumb helpers', () => {
  it('are no-ops before reporting started', () => {
    addNavigationBreadcrumb('product/:id');
    addHttpBreadcrumb('GET', '/api/v1/me', 200);
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('record the safe screen name', async () => {
    await start();
    addNavigationBreadcrumb('product/:id');
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'navigation',
        type: 'navigation',
        data: { to: '/product/:id' },
      }),
    );
  });

  it('record method, route template and status, never ids, queries or hosts', async () => {
    await start();
    const id = '6f1c2a8e-1b2c-4d3e-8f90-123456789abc';
    addHttpBreadcrumb('get', `/api/v1/catalog/products/${id}?q=kırmızı elbise`, 404);
    expect(Sentry.addBreadcrumb).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: 'http',
        level: 'warning',
        data: { method: 'GET', route: '/api/v1/catalog/products/:id', status_code: 404 },
      }),
    );

    addHttpBreadcrumb('POST', '/api/v1/creators/ayse.style/follow', 'network_error');
    const crumb = jest.mocked(Sentry.addBreadcrumb).mock.calls.at(-1)![0];
    expect(crumb.level).toBe('error');
    expect(crumb.data).toEqual({ method: 'POST', route: '/api/v1/creators/:id/follow' });
    expect(crumb).not.toHaveProperty('message');
  });
});

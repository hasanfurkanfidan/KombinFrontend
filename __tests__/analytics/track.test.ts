import { sendEvents } from '@/api/endpoints/analytics';
import { resetAnalyticsIdentity } from '@/analytics/identity';
import { useSessionStore } from '@/session/sessionStore';

jest.mock('@/api/endpoints/analytics');

// The setup file replaces `@/analytics` with a no-op; these tests exercise the real module.
const { track, flushAnalytics } = jest.requireActual<typeof import('@/analytics')>('@/analytics');

const sendEventsMock = jest.mocked(sendEvents);

/** `track` is fire-and-forget; let its async identity lookup settle before flushing. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
}

describe('track', () => {
  beforeEach(() => {
    sendEventsMock.mockReset();
    sendEventsMock.mockResolvedValue({ accepted: 1, rejected: [] });
    resetAnalyticsIdentity();
    useSessionStore.setState({ status: 'signedOut', accessToken: null, expiresAt: null });
  });

  it('queues events with the device identity and sends them in one anonymous batch', async () => {
    track('app_open', {});
    track('screen_view', { screen: 'home' });
    await settle();
    await flushAnalytics();

    expect(sendEventsMock).toHaveBeenCalledTimes(1);
    const [body, options] = sendEventsMock.mock.calls[0]!;
    expect(options).toEqual({ auth: false });
    expect(body.events.map((item) => item.name)).toEqual(['app_open', 'screen_view']);
    for (const item of body.events) {
      expect(item.platform).toBe('Ios');
      expect(item.appVersion).toEqual(expect.any(String));
      expect(item.anonymousId).toEqual(expect.any(String));
      expect(new Date(item.occurredAt ?? '').toISOString()).toBe(item.occurredAt);
    }
    // One anonymous id and one session id for the whole launch.
    expect(new Set(body.events.map((item) => item.anonymousId)).size).toBe(1);
    expect(new Set(body.events.map((item) => item.sessionId)).size).toBe(1);
    expect(body.events[1]?.properties).toEqual({ screen: 'home' });
  });

  it('keeps the same anonymous id across batches and still sends it once signed in', async () => {
    track('app_open', {});
    await settle();
    await flushAnalytics();

    useSessionStore.setState({ status: 'signedIn', accessToken: 'a', expiresAt: Date.now() + 9e5 });
    track('app_background', {});
    await settle();
    await flushAnalytics();

    const [first, second] = sendEventsMock.mock.calls;
    expect(first?.[1]).toEqual({ auth: false });
    expect(second?.[1]).toEqual({ auth: true });
    expect(second?.[0].events[0]?.anonymousId).toBe(first?.[0].events[0]?.anonymousId);
  });

  it('throws in development on a property outside the allow-list, and sends nothing', async () => {
    expect(__DEV__).toBe(true);
    expect(() => track('search', { queryLength: 3, query: 'blazer' } as never)).toThrow(
      /not a property of 'search'/,
    );
    expect(() => track('screen_view', { screen: 'home', email: 'a@b.c' } as never)).toThrow(
      /personal data/,
    );
    await settle();
    await flushAnalytics();
    expect(sendEventsMock).not.toHaveBeenCalled();
  });

  it('never rejects or throws when the network is down', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    sendEventsMock.mockRejectedValue(new Error('offline'));

    track('app_open', {});
    await settle();
    await expect(flushAnalytics()).resolves.toBeUndefined();
    jest.restoreAllMocks();
    // Drain what is left (a retry is pending) so no timer outlives the test.
    sendEventsMock.mockResolvedValue({ accepted: 1, rejected: [] });
    await flushAnalytics();
  });
});

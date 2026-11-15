// Fails a test that leaves work behind: a real timer or interval that is still pending, or a query/mutation that is
// still in flight, once the test and its cleanup are over. Such work does not die with the test; it fires during a
// later one (or after the worker has moved on) and shows up as a timeout or a wrong answer somewhere else, only
// when the machine is busy. Installed for every test file from `jest.setup.ts`.
import type { QueryClient } from '@tanstack/react-query';

// Typed by hand: the project has no Node types to import `fs` with (see __tests__/security/guards.test.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };

// The environment's own timer functions, captured before any test can install fake ones.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;

type Pending = { kind: 'timeout' | 'interval'; delay: number; stack: string };
const pending = new Map<unknown, Pending>();
const clients = new Set<QueryClient>();
const holds = new Set<() => void>();

const shortStack = () =>
  (new Error().stack ?? '')
    .split('\n')
    .slice(2)
    .filter((line) => !line.includes('leakGuard') && !line.includes('node_modules'))
    .slice(0, 3)
    .map((line) => line.trim())
    .join(' <- ');

type Fn = (...args: unknown[]) => void;
type Handle = ReturnType<typeof setTimeout>;
const asGlobal = globalThis as unknown as Record<string, unknown>;

/** Wraps the real timer functions so that every pending one is known. Safe to call again after `useRealTimers`. */
function installTracking() {
  // Fake timers never fire on their own, so there is nothing to leak while they are installed.
  if ((globalThis.setTimeout as unknown as { clock?: unknown }).clock) return;
  if ((globalThis.setTimeout as unknown as { tracked?: boolean }).tracked) return;

  const trackedSetTimeout = (fn: Fn, delay?: number, ...args: unknown[]) => {
    const handle: Handle = realSetTimeout(
      (...a: unknown[]) => {
        pending.delete(handle);
        fn(...a);
      },
      delay,
      ...args,
    );
    pending.set(handle, { kind: 'timeout', delay: delay ?? 0, stack: shortStack() });
    return handle;
  };
  const trackedSetInterval = (fn: Fn, delay?: number, ...args: unknown[]) => {
    const handle = realSetInterval(fn, delay, ...args);
    pending.set(handle, { kind: 'interval', delay: delay ?? 0, stack: shortStack() });
    return handle;
  };
  const trackedClear = (clear: (handle: never) => void) => (handle: unknown) => {
    pending.delete(handle);
    clear(handle as never);
  };
  trackedSetTimeout.tracked = true;
  asGlobal.setTimeout = trackedSetTimeout;
  asGlobal.setInterval = trackedSetInterval;
  asGlobal.clearTimeout = trackedClear(realClearTimeout as (handle: never) => void);
  asGlobal.clearInterval = trackedClear(realClearInterval as (handle: never) => void);
}

/** A query client whose in-flight work is checked when the test ends (`renderWithQuery` registers its own). */
export function trackQueryClient(client: QueryClient) {
  clients.add(client);
}

/**
 * A promise that stays open until the test is over (a screen's loading state needs a request that has not
 * answered), then resolves, so the request does not count as left behind.
 */
export function heldOpen<T = unknown>(): Promise<T> {
  return new Promise<T>((resolve) => {
    holds.add(() => resolve(undefined as T));
  });
}

const settle = (ms = 0) => new Promise<void>((resolve) => realSetTimeout(resolve, ms));

// A timer this short is a frame of an animation that was just stopped or a batched update: it ends on its own within
// a few milliseconds. Waiting for those separates them from a loop that is still running (it schedules the next one)
// and from a long timer that would fire in a later test.
const SHORT_TIMER_MS = 50;
const SHORT_TIMER_WAIT_ROUNDS = 5;
const hasShortTimer = () =>
  [...pending.values()].some((timer) => timer.kind === 'timeout' && timer.delay <= SHORT_TIMER_MS);

const usesRntl = new Map<string, boolean>();
function testUsesRntl(testPath: string) {
  let uses = usesRntl.get(testPath);
  if (uses === undefined) {
    uses = fs.readFileSync(testPath, 'utf8').includes('@testing-library/react-native');
    usesRntl.set(testPath, uses);
  }
  return uses;
}

export function installLeakGuard() {
  beforeEach(() => {
    installTracking();
  });

  afterEach(async () => {
    // Runs before the testing library's own cleanup (it is registered later), so unmount here: a screen still
    // mounted holds its timers and observers by design.
    const { testPath } = expect.getState();
    if (testPath && testUsesRntl(testPath)) {
      // Loaded here, not at the top: a test that renders nothing never pays for React Native.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cleanup } = require('@testing-library/react-native/pure') as {
        cleanup: () => Promise<void>;
      };
      await cleanup();
      // The app's own shared client (the legal pages, the session) lives for the whole worker: whatever a screen put
      // into it would keep its 5-minute garbage-collection timers, and so the worker, alive.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const shared = require('@/api/queryClient') as typeof import('@/api/queryClient');
      trackQueryClient(shared.queryClient);
    }
    holds.forEach((release) => release());
    holds.clear();
    // Let what is already on its way land (a mocked answer, a batched update) before counting.
    await settle();

    const problems: string[] = [];
    for (const client of clients) {
      const queries = client.isFetching();
      const mutations = client.isMutating();
      if (queries > 0)
        problems.push(`${queries} quer${queries === 1 ? 'y is' : 'ies are'} still in flight`);
      if (mutations > 0) problems.push(`${mutations} mutation(s) still in flight`);
      // A cache keeps a garbage-collection timer (5 minutes by default) per query: empty it before counting timers.
      client.clear();
    }
    clients.clear();

    for (let round = 0; round < SHORT_TIMER_WAIT_ROUNDS && hasShortTimer(); round += 1) {
      await settle(SHORT_TIMER_MS / 2);
    }
    for (const [handle, timer] of pending) {
      problems.push(
        `a real ${timer.kind} of ${timer.delay} ms is still pending, set at ${timer.stack}`,
      );
      if (timer.kind === 'interval') realClearInterval(handle as Handle);
      else realClearTimeout(handle as Handle);
    }
    pending.clear();

    if (problems.length > 0) {
      throw new Error(
        `The test left work behind (it would fire during a later test):\n  - ${problems.join('\n  - ')}`,
      );
    }
  });
}

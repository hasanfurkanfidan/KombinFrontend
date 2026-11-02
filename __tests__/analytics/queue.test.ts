import type { EventItem } from '@/api/models';
import { createEventQueue, FLUSH_INTERVAL_MS, FLUSH_SIZE } from '@/analytics/queue';

function event(n: number): EventItem {
  return {
    name: 'screen_view',
    properties: { screen: `s${n}` },
    sessionId: 'session',
    platform: 'Ios',
    appVersion: '1.0.0',
    occurredAt: new Date(2026, 10, 2, 10, 0, n).toISOString(),
    anonymousId: 'anon',
  };
}

describe('createEventQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends nothing until 20 events have piled up, then sends them as one batch', async () => {
    const send = jest.fn(async (_events: EventItem[]) => undefined);
    const queue = createEventQueue({ send });

    for (let n = 1; n < FLUSH_SIZE; n += 1) {
      queue.push(event(n));
    }
    expect(send).not.toHaveBeenCalled();
    expect(queue.size).toBe(FLUSH_SIZE - 1);

    queue.push(event(FLUSH_SIZE));
    await queue.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toHaveLength(FLUSH_SIZE);
    expect(queue.size).toBe(0);
  });

  it('flushes 15 seconds after the first queued event', async () => {
    const send = jest.fn(async (_events: EventItem[]) => undefined);
    const queue = createEventQueue({ send });

    queue.push(event(1));
    queue.push(event(2));
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS - 1);
    expect(send).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith([event(1), event(2)]);
  });

  it('flushes on demand (the app goes to the background) and keeps the order', async () => {
    const send = jest.fn(async (_events: EventItem[]) => undefined);
    const queue = createEventQueue({ send });

    queue.push(event(1));
    queue.push(event(2));
    queue.push(event(3));
    await queue.flush();

    expect(send).toHaveBeenCalledWith([event(1), event(2), event(3)]);
    // The 15 s timer was cleared by the flush: nothing is sent later.
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not run a timer while the queue is empty', async () => {
    const queue = createEventQueue({ send: jest.fn(async (_events: EventItem[]) => undefined) });
    await queue.flush();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('splits a long backlog into requests of at most 50 events', async () => {
    const send = jest.fn(async (_events: EventItem[]) => undefined);
    const queue = createEventQueue({ send, flushSize: 1000 });

    for (let n = 0; n < 120; n += 1) {
      queue.push(event(n));
    }
    await queue.flush();

    expect(send.mock.calls.map(([batch]) => (batch as EventItem[]).length)).toEqual([50, 50, 20]);
  });

  it('tries a failed batch again on the next flush, then drops it', async () => {
    const send = jest.fn(async (_events: EventItem[]): Promise<void> => {
      throw new Error('offline');
    });
    const queue = createEventQueue({ send });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    queue.push(event(1));
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(1);

    // The retry is scheduled by the queue itself.
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);

    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 4);
    expect(send).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  it('keeps events queued behind a failed batch and delivers them once the network is back', async () => {
    const send = jest
      .fn<Promise<unknown>, [EventItem[]]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const queue = createEventQueue({ send, flushSize: 1000 });

    queue.push(event(1));
    await queue.flush();
    queue.push(event(2));
    await queue.flush();

    expect(send).toHaveBeenLastCalledWith([event(1), event(2)]);
    expect(queue.size).toBe(0);
  });

  it('never lets the backlog grow without bound while offline', async () => {
    const queue = createEventQueue({
      send: jest.fn(async (_events: EventItem[]) => undefined),
      flushSize: 10_000,
    });
    for (let n = 0; n < 700; n += 1) {
      queue.push(event(n));
    }
    expect(queue.size).toBe(500);
    await queue.flush();
  });
});

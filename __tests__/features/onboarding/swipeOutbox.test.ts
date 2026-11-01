import type { SubmitSwipesResponse, SwipeItem } from '@/api/models';
import { createSwipeOutbox, SWIPE_BATCH_SIZE } from '@/features/onboarding/swipeOutbox';

const response = (completed = false): SubmitSwipesResponse => ({
  onboardingCompleted: completed,
  styleSummary: {
    confidence: 0.5,
    likeCount: 1,
    topColors: [],
    formalityMean: 3,
    topFamilies: [],
  },
});

const swipe = (n: number): SwipeItem => ({ styleCardId: `card-${n}`, decision: 'Like' });

describe('swipe outbox', () => {
  it('sends a batch every 5 swipes and keeps the rest queued', async () => {
    const send = jest.fn().mockResolvedValue(response());
    const outbox = createSwipeOutbox({ send });

    for (let n = 1; n <= 4; n += 1) outbox.push(swipe(n));
    expect(send).not.toHaveBeenCalled();
    expect(outbox.pending).toBe(4);

    outbox.push(swipe(5));
    await outbox.flush();
    expect(SWIPE_BATCH_SIZE).toBe(5);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toHaveLength(5);

    outbox.push(swipe(6));
    expect(outbox.pending).toBe(1);
  });

  it('flushes the remainder when the user leaves the screen', async () => {
    const send = jest.fn().mockResolvedValue(response());
    const outbox = createSwipeOutbox({ send });

    outbox.push(swipe(1));
    outbox.push(swipe(2));
    await outbox.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toEqual([swipe(1), swipe(2)]);
    expect(outbox.pending).toBe(0);
  });

  it('does nothing when flushed empty', async () => {
    const send = jest.fn();
    await createSwipeOutbox({ send }).flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('retries a failed batch once and then succeeds', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(response());
    const onResponse = jest.fn();
    const outbox = createSwipeOutbox({ send, onResponse });

    outbox.push(swipe(1));
    await outbox.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toEqual([swipe(1)]);
    expect(onResponse).toHaveBeenCalledTimes(1);
  });

  it('drops a batch silently after the retry fails, and keeps going', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValue(response());
    const outbox = createSwipeOutbox({ send, batchSize: 1 });

    outbox.push(swipe(1));
    await outbox.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(outbox.pending).toBe(0);

    outbox.push(swipe(2));
    await outbox.flush();
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2]?.[0]).toEqual([swipe(2)]);
    warn.mockRestore();
  });

  it('never runs two requests at the same time and loses nothing', async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: string[] = [];
    const send = jest.fn(async (swipes: readonly SwipeItem[]) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      seen.push(...swipes.map((item) => item.styleCardId));
      inFlight -= 1;
      return response();
    });
    const outbox = createSwipeOutbox({ send });

    for (let n = 1; n <= 12; n += 1) outbox.push(swipe(n));
    await outbox.flush();

    expect(peak).toBe(1);
    expect(seen).toEqual(Array.from({ length: 12 }, (_, index) => `card-${index + 1}`));
  });

  it('reports the response of every batch', async () => {
    const onResponse = jest.fn();
    const outbox = createSwipeOutbox({
      send: jest.fn().mockResolvedValue(response(true)),
      onResponse,
      batchSize: 2,
    });

    outbox.push(swipe(1));
    outbox.push(swipe(2));
    await outbox.flush();

    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ onboardingCompleted: true }));
  });
});

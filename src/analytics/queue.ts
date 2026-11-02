import type { EventItem } from '@/api/models';

/** A batch goes out as soon as this many events are waiting... */
export const FLUSH_SIZE = 20;
/** ...or this long after the first one was queued, whichever comes first. */
export const FLUSH_INTERVAL_MS = 15_000;

/** The backend takes at most 50 events per request. */
const MAX_REQUEST_SIZE = 50;
/** A phone that stays offline for long must not grow the queue without bound: the oldest events go first. */
const MAX_QUEUED = 500;

export interface EventQueueOptions {
  send: (events: EventItem[]) => Promise<unknown>;
  flushSize?: number;
  flushIntervalMs?: number;
  /** How often a batch is tried before it is dropped. */
  maxAttempts?: number;
}

export interface EventQueue {
  push: (event: EventItem) => void;
  /** Sends everything queued. Never rejects; a failed batch waits for the next flush (or is dropped). */
  flush: () => Promise<void>;
  /** Events waiting to be sent (not counting a batch that is in flight). */
  readonly size: number;
}

interface Entry {
  event: EventItem;
  attempts: number;
}

/**
 * Batches analytics events so the UI never waits on the network: `push` is synchronous and returns at once.
 * Flushes at `flushSize` events or `flushIntervalMs` after the first queued one (the owner also flushes when the app
 * goes to the background). A failed batch is tried again on the next flush and dropped after `maxAttempts` tries:
 * analytics must never pile up or surface errors. Batches are sent one after another, never concurrently.
 */
export function createEventQueue({
  send,
  flushSize = FLUSH_SIZE,
  flushIntervalMs = FLUSH_INTERVAL_MS,
  maxAttempts = 2,
}: EventQueueOptions): EventQueue {
  let queue: Entry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    if (timer === null && queue.length > 0) {
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, flushIntervalMs);
    }
  };

  /** Sends the next batch; `false` when it failed (it is back in the queue unless it ran out of attempts). */
  const sendOne = async (): Promise<boolean> => {
    const batch = queue.splice(0, MAX_REQUEST_SIZE);
    try {
      await send(batch.map((entry) => entry.event));
      return true;
    } catch {
      const retry = batch
        .map((entry) => ({ ...entry, attempts: entry.attempts + 1 }))
        .filter((entry) => entry.attempts < maxAttempts);
      if (__DEV__ && retry.length < batch.length) {
        console.warn(`[analytics] dropped ${batch.length - retry.length} events after retrying`);
      }
      queue = [...retry, ...queue];
      return false;
    }
  };

  const flush = (): Promise<void> => {
    clearTimer();
    chain = chain.then(async () => {
      while (queue.length > 0) {
        // One failed batch ends the run: the retry comes with the next flush, not in a tight loop.
        if (!(await sendOne())) {
          break;
        }
      }
      schedule();
    });
    return chain;
  };

  return {
    push: (event) => {
      queue.push({ event, attempts: 0 });
      if (queue.length > MAX_QUEUED) {
        queue = queue.slice(queue.length - MAX_QUEUED);
      }
      if (queue.length >= flushSize) {
        void flush();
      } else {
        schedule();
      }
    },
    flush,
    get size() {
      return queue.length;
    },
  };
}

import type { SubmitSwipesResponse, SwipeItem } from '@/api/models';

/** A batch goes out every time this many swipes have piled up. */
export const SWIPE_BATCH_SIZE = 5;

/** The backend accepts at most 50 swipes per request. */
const MAX_REQUEST_SIZE = 50;

export interface SwipeOutboxOptions {
  send: (swipes: readonly SwipeItem[]) => Promise<SubmitSwipesResponse>;
  /** Called with every successful response (it carries `onboardingCompleted`). */
  onResponse?: (response: SubmitSwipesResponse) => void;
  batchSize?: number;
}

export interface SwipeOutbox {
  push: (swipe: SwipeItem) => void;
  /** Sends everything still queued. Never rejects; resolves once the queue is empty. */
  flush: () => Promise<void>;
  /** Swipes waiting to be sent (not counting a batch that is in flight). */
  readonly pending: number;
}

/**
 * Collects swipes and sends them in batches so the deck never waits on the network.
 * A failed batch is retried once; if that fails too it is dropped silently (a lost swipe only means
 * a slightly less precise style profile). Batches are sent one after another, never concurrently.
 */
export function createSwipeOutbox({
  send,
  onResponse,
  batchSize = SWIPE_BATCH_SIZE,
}: SwipeOutboxOptions): SwipeOutbox {
  const queue: SwipeItem[] = [];
  let chain: Promise<void> = Promise.resolve();

  const sendBatch = async (batch: readonly SwipeItem[]) => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        // Awaited on its own: `onResponse?.(await send(...))` would skip the request when there is no handler.
        const response = await send(batch);
        onResponse?.(response);
        return;
      } catch (error) {
        if (attempt === 2 && __DEV__) {
          console.warn(`[swipes] dropped ${batch.length} swipes after a retry`, error);
        }
      }
    }
  };

  const flush = () => {
    chain = chain.then(async () => {
      while (queue.length > 0) {
        await sendBatch(queue.splice(0, MAX_REQUEST_SIZE));
      }
    });
    return chain;
  };

  return {
    push: (swipe) => {
      queue.push(swipe);
      if (queue.length >= batchSize) {
        void flush();
      }
    },
    flush,
    get pending() {
      return queue.length;
    },
  };
}

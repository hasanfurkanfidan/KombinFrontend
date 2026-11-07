import { useState } from 'react';

import { track } from '@/analytics';

export type PostViewSource = 'feed' | 'profile' | 'creator' | 'mine' | 'link';

/**
 * Reports `post_view` once per post per list: the first time a post is really on screen (the list's viewability
 * callback), with its position in the list. Ids and an enum only: nothing a person wrote.
 */
export function createViewTracker(source: PostViewSource) {
  const reported = new Set<string>();
  return (items: readonly { id: string; index: number | null }[]): void => {
    for (const { id, index } of items) {
      if (reported.has(id)) {
        continue;
      }
      reported.add(id);
      track('post_view', {
        postId: id,
        source,
        ...(index === null ? {} : { position: Math.min(500, Math.max(0, index)) }),
      });
    }
  };
}

/** A post counts as seen when most of it is on screen for a moment. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 400 };

interface ViewableToken {
  item?: { id: string } | null;
  index?: number | null;
}

/**
 * The two props a post list needs to report `post_view`. A `FlatList` refuses a changing `onViewableItemsChanged`, so
 * both are created once per mounted list.
 */
export function usePostViewTracking(source: PostViewSource) {
  const [props] = useState(() => {
    const report = createViewTracker(source);
    return {
      viewabilityConfig: VIEWABILITY,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewableToken[] }) =>
        report(
          viewableItems.flatMap((token) =>
            token.item ? [{ id: token.item.id, index: token.index ?? null }] : [],
          ),
        ),
    };
  });
  return props;
}

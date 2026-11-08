import { QueryClient } from '@tanstack/react-query';

import { track } from '@/analytics';
import { queryKeys } from '@/api/queryKeys';
import {
  patchAuthorPosts,
  patchPost,
  patchProfile,
  removeAuthorPosts,
  removePost,
} from '@/features/social/cache';
import { resetImageUrls, stableImageUrl } from '@/features/social/imageUrl';
import {
  dotCenter,
  matchText,
  pct,
  statusMessage,
  taggedProductIds,
} from '@/features/social/labels';
import { createViewTracker } from '@/features/social/postViews';

import { post, postAuthor, postTag, userProfile } from '../../fixtures';

describe('post_view tracking', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports each post once, with its position, and nothing that a person wrote', () => {
    const report = createViewTracker('feed');

    report([
      { id: 'a', index: 0 },
      { id: 'b', index: 1 },
    ]);
    report([
      { id: 'b', index: 1 },
      { id: 'c', index: null },
    ]);

    expect(jest.mocked(track).mock.calls).toEqual([
      ['post_view', { postId: 'a', source: 'feed', position: 0 }],
      ['post_view', { postId: 'b', source: 'feed', position: 1 }],
      ['post_view', { postId: 'c', source: 'feed' }],
    ]);
  });
});

describe('stable image URLs', () => {
  beforeEach(resetImageUrls);

  it('keeps the first URL of a post for 45 minutes, so the image cache is keyed by the post and not the signature', () => {
    const t0 = 1_000_000;
    expect(stableImageUrl('post1', 'http://img/a?sig=1', t0)).toBe('http://img/a?sig=1');
    expect(stableImageUrl('post1', 'http://img/a?sig=2', t0 + 30 * 60_000)).toBe(
      'http://img/a?sig=1',
    );
    // Another post is its own key.
    expect(stableImageUrl('post2', 'http://img/b?sig=9', t0)).toBe('http://img/b?sig=9');
    // The presigned URL is good for an hour: after 45 minutes the fresh one takes over.
    expect(stableImageUrl('post1', 'http://img/a?sig=3', t0 + 46 * 60_000)).toBe(
      'http://img/a?sig=3',
    );
  });
});

describe('labels', () => {
  it('computes a dot at the centre of the box without float noise', () => {
    expect(dotCenter({ x: 0.1, y: 0.1, w: 0.4, h: 0.3 })).toEqual({ left: 0.3, top: 0.25 });
    expect(pct(0.30000000000000004)).toBe('30%');
    expect(pct(1 / 3)).toBe('33.33%');
  });

  it('formats the match and falls back for statuses without a backend message', () => {
    expect(matchText(92)).toBe('Sana uygun %92');
    expect(matchText(null)).toBeNull();
    expect(statusMessage({ status: 'Blocked', statusMessage: 'Sebep' })).toBe('Sebep');
    expect(statusMessage({ status: 'NeedsReview', statusMessage: null })).toMatch(/incelemede/);
    expect(statusMessage({ status: 'Live', statusMessage: null })).toBeNull();
  });

  it('lists each tagged product once', () => {
    const tags = [
      postTag({ productId: 'p1' }),
      postTag({ productId: 'p1' }),
      postTag({ productId: null }),
    ];
    expect(taggedProductIds({ tags })).toEqual(['p1']);
  });
});

describe('social cache', () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const feedKey = queryKeys.feed('forYou', null, true);
  const feedPages = () =>
    client.getQueryData<{ pages: { items: ReturnType<typeof post>[] }[] }>(feedKey)?.pages[0]
      ?.items;

  beforeEach(() => {
    client.clear();
    client.setQueryData(feedKey, {
      pages: [
        {
          items: [
            post({ id: 'a', author: postAuthor({ id: 'u1' }), likeCount: 1 }),
            post({ id: 'b', author: postAuthor({ id: 'u2' }) }),
            post({ id: 'c', author: postAuthor({ id: 'u2' }) }),
          ],
        },
      ],
      pageParams: [1],
    });
    client.setQueryData(queryKeys.post('a'), post({ id: 'a', author: postAuthor({ id: 'u1' }) }));
    client.setQueryData(queryKeys.userProfile('u1'), userProfile({ id: 'u1', followerCount: 5 }));
  });

  it('patches one post everywhere it is cached', () => {
    patchPost(client, 'a', { likedByMe: true, likeCount: 2 });

    expect(feedPages()?.[0]).toMatchObject({ likedByMe: true, likeCount: 2 });
    expect(client.getQueryData<{ likeCount: number }>(queryKeys.post('a'))?.likeCount).toBe(2);
  });

  it('patches every post of one author, and their profile', () => {
    patchAuthorPosts(client, 'u2', { followingAuthor: true });
    patchProfile(client, 'u1', { isFollowing: true, followerCount: 6 });

    expect(feedPages()?.map((p) => p.followingAuthor)).toEqual([false, true, true]);
    expect(
      client.getQueryData<{ followerCount: number }>(queryKeys.userProfile('u1')),
    ).toMatchObject({
      isFollowing: true,
      followerCount: 6,
    });
  });

  it("drops a blocked author's posts and a deleted post", () => {
    removeAuthorPosts(client, 'u2');
    expect(feedPages()?.map((p) => p.id)).toEqual(['a']);

    removePost(client, 'a');
    expect(feedPages()).toEqual([]);
    expect(client.getQueryData(queryKeys.post('a'))).toBeUndefined();
  });

  it('leaves caches that only look like lists alone (products have `items` too)', () => {
    client.setQueryData(['social', 'odd'], { items: [{ id: 'p1', name: 'Blazer' }] });

    expect(() => removeAuthorPosts(client, 'u2')).not.toThrow();
    expect(client.getQueryData(['social', 'odd'])).toEqual({
      items: [{ id: 'p1', name: 'Blazer' }],
    });
  });
});

import type { QueryClient } from '@tanstack/react-query';

import type { CreatorPage, Post, UserProfile } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';

type Rewrite = (posts: Post[]) => Post[];

interface PostList {
  items: Post[];
}

function isPostList(value: unknown): value is PostList {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PostList).items) &&
    (value as PostList).items.every(isPost)
  );
}

function isInfinite(value: unknown): value is { pages: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { pages: unknown[] }).pages)
  );
}

function isPost(value: unknown): value is Post {
  const candidate = value as Partial<Post> | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    Array.isArray(candidate.tags) &&
    'author' in candidate
  );
}

function isCreatorPage(value: unknown): value is CreatorPage {
  const candidate = value as Partial<CreatorPage> | null;
  return typeof candidate === 'object' && candidate !== null && isPostList(candidate.posts);
}

function rewritePage<T>(page: T, rewrite: Rewrite): T {
  return isPostList(page) ? { ...page, items: rewrite(page.items) } : page;
}

/** Applies `rewrite` to the posts of every cached place a post can be: feed, profile lists, mine, creator page. */
function rewriteEverywhere(queryClient: QueryClient, rewrite: Rewrite): void {
  queryClient.setQueriesData({ queryKey: queryKeys.socialAll }, (data: unknown) => {
    if (isInfinite(data)) {
      return { ...data, pages: data.pages.map((page) => rewritePage(page, rewrite)) };
    }
    if (isCreatorPage(data)) {
      return { ...data, posts: rewritePage(data.posts, rewrite) };
    }
    if (isPost(data)) {
      const [next] = rewrite([data]);
      // A post that a rewrite drops stays as it is: its screen is leaving, and the server answers 404 on a refetch.
      return next ?? data;
    }
    return data;
  });
}

/** Writes a changed post (liked, followed author, …) into every list and detail it is cached in. */
export function patchPost(queryClient: QueryClient, id: string, patch: Partial<Post>): void {
  rewriteEverywhere(queryClient, (posts) =>
    posts.map((post) => (post.id === id ? { ...post, ...patch } : post)),
  );
}

/** The follow state is per author, so every post of that author changes with it. */
export function patchAuthorPosts(
  queryClient: QueryClient,
  authorId: string,
  patch: Partial<Post>,
): void {
  rewriteEverywhere(queryClient, (posts) =>
    posts.map((post) => (post.author.id === authorId ? { ...post, ...patch } : post)),
  );
}

/** Blocking hides an author at once, without waiting for the lists to be refetched. */
export function removeAuthorPosts(queryClient: QueryClient, authorId: string): void {
  rewriteEverywhere(queryClient, (posts) => posts.filter((post) => post.author.id !== authorId));
  queryClient.removeQueries({ queryKey: queryKeys.userPosts(authorId) });
}

export function removePost(queryClient: QueryClient, id: string): void {
  rewriteEverywhere(queryClient, (posts) => posts.filter((post) => post.id !== id));
  queryClient.removeQueries({ queryKey: queryKeys.post(id) });
}

function isProfile(value: unknown): value is UserProfile {
  const candidate = value as Partial<UserProfile> | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'isFollowing' in candidate &&
    'followerCount' in candidate
  );
}

/** A follow changes the profile's counter and button wherever the profile is cached (profile screen, creator page). */
export function patchProfile(
  queryClient: QueryClient,
  userId: string,
  patch: Partial<UserProfile>,
): void {
  queryClient.setQueriesData({ queryKey: queryKeys.socialAll }, (data: unknown) => {
    if (isProfile(data) && data.id === userId) {
      return { ...data, ...patch };
    }
    if (isCreatorPage(data) && data.profile.id === userId) {
      return { ...data, profile: { ...data.profile, ...patch } };
    }
    return data;
  });
}

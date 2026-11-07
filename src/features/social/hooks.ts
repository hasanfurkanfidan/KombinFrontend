import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { saveProduct, unsaveProduct } from '@/api/endpoints/engagement';
import {
  acceptConsent,
  blockUser,
  deletePost,
  followUser,
  getConsent,
  getCreator,
  getCreatorStats,
  getFeed,
  getPost,
  getUserProfile,
  likePost,
  listBlocks,
  listMyPosts,
  listUserPosts,
  reportPost,
  tryPost,
  unblockUser,
  unfollowUser,
  unlikePost,
  type FeedMode,
} from '@/api/endpoints/social';
import type { Post, PostPage, ReportReason } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { showToast } from '@/components/toastStore';
import { useSavedIds } from '@/features/saved/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

import { patchAuthorPosts, patchPost, patchProfile, removeAuthorPosts, removePost } from './cache';
import { taggedProductIds } from './labels';

/** The next page of a classic paged list, or `undefined` after the last. */
function nextPage(last: PostPage): number | undefined {
  const page = toNumber(last.page);
  const pages = Math.ceil(toNumber(last.totalCount) / Math.max(1, toNumber(last.pageSize)));
  return page < pages ? page + 1 : undefined;
}

/**
 * The feed. `following` has no signed-out version: the screen shows a sign-in prompt, and this query stays off so
 * the 401 is never provoked. A signed-in caller's token goes along so likes, wardrobe marks and scores are theirs.
 */
export function useFeed(mode: FeedMode, personaId: string | undefined, enabled = true) {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.feed(mode, personaId ?? null, isSignedIn),
    queryFn: ({ pageParam, signal }) =>
      getFeed(mode, pageParam, personaId, { auth: isSignedIn }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? toNumber(last.page) + 1 : undefined),
    enabled: enabled && (mode === 'forYou' || isSignedIn),
  });
}

export function usePost(id: string | undefined) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.post(id ?? ''),
    queryFn: ({ signal }) => getPost(id ?? '', isSignedIn, signal),
    enabled: Boolean(id),
  });
}

/** Sends a signed-out user to the login screen; otherwise runs the action. */
function useRequireSignIn() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  return (action: () => void) => {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    action();
  };
}

/** Like toggle: the heart and the counter change at once and roll back if the server says no. */
export function useLikeToggle(post: Pick<Post, 'id' | 'likedByMe' | 'likeCount'>) {
  const queryClient = useQueryClient();
  const requireSignIn = useRequireSignIn();
  const mutation = useMutation({
    mutationFn: (like: boolean) => (like ? likePost(post.id) : unlikePost(post.id)),
    onMutate: (like) => {
      const previous = { likedByMe: post.likedByMe, likeCount: post.likeCount };
      patchPost(queryClient, post.id, {
        likedByMe: like,
        likeCount: Math.max(0, toNumber(post.likeCount) + (like ? 1 : -1)),
      });
      return { previous };
    },
    onError: (_error, _like, context) => {
      if (context) {
        patchPost(queryClient, post.id, context.previous);
      }
      showToast(tr.postLikeFailed);
    },
    onSuccess: (result) =>
      patchPost(queryClient, post.id, { likedByMe: result.liked, likeCount: result.likeCount }),
  });

  return {
    liked: post.likedByMe,
    pending: mutation.isPending,
    toggle: () =>
      requireSignIn(() => {
        const next = !post.likedByMe;
        track('post_like', { postId: post.id, liked: next });
        mutation.mutate(next);
      }),
  };
}

/** Follow / unfollow one user; every post of theirs and their profile change with it. */
export function useFollowToggle(userId: string, following: boolean) {
  const queryClient = useQueryClient();
  const requireSignIn = useRequireSignIn();
  const mutation = useMutation({
    mutationFn: (follow: boolean) => (follow ? followUser(userId) : unfollowUser(userId)),
    onMutate: (follow) => {
      patchAuthorPosts(queryClient, userId, { followingAuthor: follow });
      patchProfile(queryClient, userId, { isFollowing: follow });
      return { previous: following };
    },
    onError: (_error, _follow, context) => {
      patchAuthorPosts(queryClient, userId, { followingAuthor: context?.previous ?? following });
      patchProfile(queryClient, userId, { isFollowing: context?.previous ?? following });
      showToast(tr.postFollowFailed);
    },
    onSuccess: (result) => {
      patchAuthorPosts(queryClient, userId, { followingAuthor: result.following });
      patchProfile(queryClient, userId, {
        isFollowing: result.following,
        followerCount: result.followerCount,
      });
      // Who is followed decides what the "Takip" feed holds.
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.feedAll, 'following'] });
    },
  });

  return {
    following,
    pending: mutation.isPending,
    toggle: () => requireSignIn(() => mutation.mutate(!following)),
  };
}

/**
 * "Save" on a post saves the products it tags (there is no post save): all of them, or, when they are all saved
 * already, takes them off the list again.
 */
export function usePostSave(post: Pick<Post, 'tags'>) {
  const queryClient = useQueryClient();
  const requireSignIn = useRequireSignIn();
  const savedIds = useSavedIds().data;
  const productIds = taggedProductIds(post);
  const allSaved = productIds.length > 0 && productIds.every((id) => savedIds?.has(id));

  const mutation = useMutation({
    mutationFn: async (save: boolean) => {
      const targets = save ? productIds.filter((id) => !savedIds?.has(id)) : productIds;
      await Promise.all(targets.map((id) => (save ? saveProduct(id) : unsaveProduct(id))));
      return targets.length;
    },
    onSuccess: (count, save) => showToast(save ? tr.postSavedToast(count) : tr.postUnsavedToast),
    onError: () => showToast(tr.postSaveFailed),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.savedIds }),
        queryClient.invalidateQueries({ queryKey: queryKeys.saved }),
      ]);
    },
  });

  return {
    available: productIds.length > 0,
    saved: allSaved,
    pending: mutation.isPending,
    toggle: () => requireSignIn(() => mutation.mutate(!allSaved)),
  };
}

export function useReportPost(postId: string, onDone: () => void) {
  return useMutation({
    mutationFn: (reason: ReportReason) => reportPost(postId, reason).then(() => reason),
    onSuccess: (reason) => {
      track('post_report', { postId, reason });
      showToast(tr.reportDone);
      onDone();
    },
    onError: (error) => {
      // A second report of the same post is a 409: nothing is wrong, it was counted the first time.
      showToast(
        error instanceof ApiError && error.status === 409 ? tr.reportAlready : tr.reportFailed,
      );
      onDone();
    },
  });
}

/** Blocks the author and drops their posts from every cached list at once. */
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockUser(userId).then(() => userId),
    onSuccess: (userId) => {
      removeAuthorPosts(queryClient, userId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocks });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.feedAll, 'following'] });
      showToast(tr.blockDone);
    },
    onError: () => showToast(tr.blockFailed),
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      showToast(tr.blocksUnblocked);
      // The unblocked author's posts may come back everywhere.
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedAll });
    },
    onError: () => showToast(tr.blockFailed),
  });
}

/** "Dolabımla dene": one request when the sheet opens; the result is not cached (the wardrobe changes). */
export function useTryPost() {
  return useMutation({
    mutationFn: (postId: string) => tryPost(postId),
    onSuccess: (result) =>
      track('try_with_wardrobe', {
        postId: result.postId,
        anchorCount: Math.min(3, result.groups.length),
        outfitCount: Math.min(
          10,
          result.groups.reduce((sum, group) => sum + group.outfits.length, 0),
        ),
      }),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deletePost(postId).then(() => postId),
    onSuccess: (postId) => {
      removePost(queryClient, postId);
      showToast(tr.myPostsDeleted);
    },
    onError: () => showToast(tr.myPostsDeleteFailed),
  });
}

export function useMyPosts() {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.myPosts,
    queryFn: ({ pageParam, signal }) => listMyPosts(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: isSignedIn,
  });
}

export function useUserProfile(id: string | undefined) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.userProfile(id ?? ''),
    queryFn: ({ signal }) => getUserProfile(id ?? '', isSignedIn, signal),
    enabled: Boolean(id),
  });
}

/** `seed` is a first page the caller already has (the creator page carries one), shown without a second request. */
export function useUserPosts(id: string | undefined, seed?: PostPage) {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.userPosts(id ?? ''),
    queryFn: ({ pageParam, signal }) => listUserPosts(id ?? '', pageParam, isSignedIn, signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: Boolean(id),
    initialData: seed ? { pages: [seed], pageParams: [1] } : undefined,
    // A seeded first page is current: no second request for what the creator page just returned.
    staleTime: seed ? 30_000 : 0,
  });
}

export function useCreator(handle: string | undefined) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.creator(handle ?? ''),
    queryFn: ({ signal }) => getCreator(handle ?? '', isSignedIn, signal),
    enabled: Boolean(handle),
  });
}

export const STATS_DAYS = 30;

/** Succeeds only for a creator; a 403 (not a creator) is an ordinary "no" and is not retried. */
export function useCreatorStats() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.creatorStats,
    queryFn: ({ signal }) => getCreatorStats(STATS_DAYS, signal),
    enabled: isSignedIn,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useBlocks() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.blocks,
    queryFn: ({ signal }) => listBlocks(signal),
    enabled: isSignedIn,
  });
}

export function useConsent(enabled = true) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.consent,
    queryFn: ({ signal }) => getConsent(signal),
    enabled: enabled && isSignedIn,
    // The text is versioned; a new one must be seen, so it is never served from a stale cache.
    staleTime: 0,
  });
}

export function useAcceptConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: string) => acceptConsent(version),
    onSuccess: (consent) => queryClient.setQueryData(queryKeys.consent, consent),
  });
}

export type { FeedMode };

import { request } from '../client';
import type {
  BlockedUser,
  Consent,
  CreatorPage,
  CreatorStats,
  Feed,
  FollowResponse,
  LikeResponse,
  Post,
  PostPage,
  PostUploadUrl,
  PostUploadUrlRequest,
  ProcessPostResponse,
  PublishPostRequest,
  ReportReason,
  TryResult,
  UserProfile,
} from '../models';

export type FeedMode = 'forYou' | 'following';

export const FEED_PAGE_SIZE = 20;

export function getConsent(signal?: AbortSignal): Promise<Consent> {
  return request<Consent>('/api/v1/social/consent', { auth: true, signal });
}

export function acceptConsent(version: string): Promise<Consent> {
  return request<Consent>('/api/v1/social/consent', {
    method: 'POST',
    body: { version },
    auth: true,
  });
}

export function createPostUploadUrl(body: PostUploadUrlRequest): Promise<PostUploadUrl> {
  return request<PostUploadUrl>('/api/v1/posts/upload-url', { method: 'POST', body, auth: true });
}

export function processPost(id: string): Promise<ProcessPostResponse> {
  return request<ProcessPostResponse>(`/api/v1/posts/${encodeURIComponent(id)}/process`, {
    method: 'POST',
    auth: true,
  });
}

export function createOutfitPost(outfitId: string): Promise<Post> {
  return request<Post>('/api/v1/posts/from-outfit', {
    method: 'POST',
    body: { outfitId },
    auth: true,
  });
}

export function publishPost(id: string, body: PublishPostRequest): Promise<Post> {
  return request<Post>(`/api/v1/posts/${encodeURIComponent(id)}/publish`, {
    method: 'PUT',
    body,
    auth: true,
  });
}

/**
 * Public for live posts. `auth` is whether there is a session: the token then goes along so the author sees a draft and
 * everyone gets their own `likedByMe` / `inWardrobe` / `matchScore`. A signed-out call must not ask for a token.
 */
export function getPost(id: string, auth: boolean, signal?: AbortSignal): Promise<Post> {
  return request<Post>(`/api/v1/posts/${encodeURIComponent(id)}`, { auth, signal });
}

export function deletePost(id: string): Promise<void> {
  return request<void>(`/api/v1/posts/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

export function likePost(id: string): Promise<LikeResponse> {
  return request<LikeResponse>(`/api/v1/posts/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    auth: true,
  });
}

export function unlikePost(id: string): Promise<LikeResponse> {
  return request<LikeResponse>(`/api/v1/posts/${encodeURIComponent(id)}/like`, {
    method: 'DELETE',
    auth: true,
  });
}

export function reportPost(id: string, reason: ReportReason): Promise<{ reported: boolean }> {
  return request<{ reported: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    body: { reason },
    auth: true,
  });
}

/** The caller's wardrobe against the post's tagged products; the persona is the backend's active one. */
export function tryPost(id: string): Promise<TryResult> {
  return request<TryResult>(`/api/v1/posts/${encodeURIComponent(id)}/try`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

export function listMyPosts(page: number, signal?: AbortSignal): Promise<PostPage> {
  return request<PostPage>('/api/v1/me/posts', {
    query: { page, pageSize: FEED_PAGE_SIZE },
    auth: true,
    signal,
  });
}

/**
 * Public, but only the signed-in caller gets followed-author posts, `likedByMe` and `matchScore`, so the token goes
 * along whenever there is a session. `following` needs one; the screen asks for sign-in instead of calling it.
 */
export function getFeed(
  mode: FeedMode,
  page: number,
  personaId: string | undefined,
  options: { auth: boolean },
  signal?: AbortSignal,
): Promise<Feed> {
  return request<Feed>('/api/v1/feed', {
    query: { Mode: mode, Page: page, PersonaId: personaId },
    auth: options.auth,
    signal,
  });
}

export function getUserProfile(
  id: string,
  auth: boolean,
  signal?: AbortSignal,
): Promise<UserProfile> {
  return request<UserProfile>(`/api/v1/users/${encodeURIComponent(id)}`, { auth, signal });
}

export function listUserPosts(
  id: string,
  page: number,
  auth: boolean,
  signal?: AbortSignal,
): Promise<PostPage> {
  return request<PostPage>(`/api/v1/users/${encodeURIComponent(id)}/posts`, {
    query: { page, pageSize: FEED_PAGE_SIZE },
    auth,
    signal,
  });
}

export function followUser(id: string): Promise<FollowResponse> {
  return request<FollowResponse>(`/api/v1/users/${encodeURIComponent(id)}/follow`, {
    method: 'POST',
    auth: true,
  });
}

export function unfollowUser(id: string): Promise<FollowResponse> {
  return request<FollowResponse>(`/api/v1/users/${encodeURIComponent(id)}/follow`, {
    method: 'DELETE',
    auth: true,
  });
}

export function blockUser(id: string): Promise<void> {
  return request<void>(`/api/v1/users/${encodeURIComponent(id)}/block`, {
    method: 'POST',
    auth: true,
  });
}

export function unblockUser(id: string): Promise<void> {
  return request<void>(`/api/v1/users/${encodeURIComponent(id)}/block`, {
    method: 'DELETE',
    auth: true,
  });
}

export function listBlocks(signal?: AbortSignal): Promise<BlockedUser[]> {
  return request<BlockedUser[]>('/api/v1/me/blocks', { auth: true, signal });
}

export function getCreator(
  handle: string,
  auth: boolean,
  signal?: AbortSignal,
): Promise<CreatorPage> {
  return request<CreatorPage>(`/api/v1/creators/${encodeURIComponent(handle)}`, {
    auth,
    signal,
  });
}

export function getCreatorStats(days: number, signal?: AbortSignal): Promise<CreatorStats> {
  return request<CreatorStats>('/api/v1/me/creator/stats', {
    query: { days },
    auth: true,
    signal,
  });
}

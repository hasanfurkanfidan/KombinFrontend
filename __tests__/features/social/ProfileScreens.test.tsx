import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getMe } from '@/api/endpoints/auth';
import {
  followUser,
  getCreator,
  getCreatorStats,
  getUserProfile,
  listBlocks,
  listUserPosts,
  unblockUser,
} from '@/api/endpoints/social';
import type { CreatorStats } from '@/api/models';
import { BlockedUsersScreen } from '@/features/social/BlockedUsersScreen';
import { CreatorStatsScreen } from '@/features/social/CreatorStatsScreen';
import { CreatorScreen, UserProfileScreen, isWebLink } from '@/features/social/ProfileScreens';

import { post, postAuthor, userProfile } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/social');

const creatorMock = jest.mocked(getCreator);
const profileMock = jest.mocked(getUserProfile);
const userPostsMock = jest.mocked(listUserPosts);
const followMock = jest.mocked(followUser);
const statsMock = jest.mocked(getCreatorStats);

function postsPage(posts: ReturnType<typeof post>[]) {
  return { items: posts, page: 1, pageSize: 20, totalCount: posts.length, totalPages: 1 };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  jest.mocked(getMe).mockResolvedValue({
    id: 'me-1',
    email: 'ben@kombin.test',
    displayName: 'Ben',
    createdAt: '2026-11-01T10:00:00Z',
  });
});

describe('creator page', () => {
  const creator = userProfile({
    id: 'u-creator',
    displayName: 'Elif Yıldız',
    handle: 'elif.stil',
    isCreator: true,
    bio: 'Ofis ve hafta sonu kombinleri',
    link: 'https://example.com/elif',
    followerCount: 1200,
    postCount: 2,
  });

  it('shows handle, bio, link, the disclosure and the posts, and reports one creator_profile_view', async () => {
    creatorMock.mockResolvedValue({
      profile: creator,
      disclosure: 'Bu içerikten komisyon kazanabilir',
      posts: postsPage([
        post({ id: 'c1', author: postAuthor({ id: 'u-creator', isCreator: true }) }),
      ]),
    });

    await renderWithQuery(<CreatorScreen handle="elif.stil" />);

    const card = await screen.findByTestId('profile-card');
    expect(within(card).getByText('@elif.stil')).toBeTruthy();
    expect(within(card).getByText('Ofis ve hafta sonu kombinleri')).toBeTruthy();
    expect(within(card).getByText('Bu içerikten komisyon kazanabilir')).toBeTruthy();
    expect(within(card).getByText('1200 takipçi')).toBeTruthy();
    expect(await screen.findByTestId('post-c1')).toBeTruthy();
    // The first page came with the creator page: no second request for it.
    expect(userPostsMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('profile-link'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com/elif');

    const views = jest.mocked(track).mock.calls.filter(([name]) => name === 'creator_profile_view');
    expect(views).toEqual([['creator_profile_view', { creatorId: 'u-creator' }]]);
  });

  it('says when the creator does not exist', async () => {
    creatorMock.mockRejectedValue(
      new ApiError({ status: 404, errorCode: 'Social.CreatorNotFound', correlationId: 'c' }),
    );

    await renderWithQuery(<CreatorScreen handle="nobody" />);

    expect(await screen.findByText('Bu kreatör bulunamadı')).toBeTruthy();
    expect(track).not.toHaveBeenCalledWith('creator_profile_view', expect.anything());
  });

  it('only opens web links', () => {
    expect(isWebLink('https://example.com')).toBe(true);
    expect(isWebLink('javascript:alert(1)')).toBe(false);
    expect(isWebLink('kombin://x')).toBe(false);
  });
});

describe("a person's profile", () => {
  it('shows the counters and follows', async () => {
    await signedInSession();
    profileMock.mockResolvedValue(
      userProfile({ id: 'u-elif', followerCount: 10, followsYou: true }),
    );
    userPostsMock.mockResolvedValue(postsPage([post({ id: 'up1' })]));
    followMock.mockResolvedValue({ following: true, followerCount: 11 });

    await renderWithQuery(<UserProfileScreen id="u-elif" />);

    expect(await screen.findByText('10 takipçi')).toBeTruthy();
    expect(screen.getByText('Seni takip ediyor')).toBeTruthy();
    expect(await screen.findByTestId('post-up1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('profile-follow'));
    await waitFor(() => expect(followMock).toHaveBeenCalledWith('u-elif'));
    expect(await screen.findByText('11 takipçi')).toBeTruthy();
  });

  it("has no follow button on one's own profile", async () => {
    await signedInSession();
    profileMock.mockResolvedValue(userProfile({ id: 'me-1', displayName: 'Ben' }));
    userPostsMock.mockResolvedValue(postsPage([]));

    await renderWithQuery(<UserProfileScreen id="me-1" />);

    await screen.findByTestId('profile-card');
    await waitFor(() => expect(screen.queryByTestId('profile-follow')).toBeNull());
  });

  it('is not found across a block (404)', async () => {
    profileMock.mockRejectedValue(new ApiError({ status: 404, correlationId: 'c' }));
    userPostsMock.mockResolvedValue(postsPage([]));

    await renderWithQuery(<UserProfileScreen id="u-x" />);

    expect(await screen.findByText('Bu kullanıcı bulunamadı')).toBeTruthy();
  });
});

describe('Kazançlarım', () => {
  const stats: CreatorStats = {
    days: 30,
    since: '2026-10-08T00:00:00Z',
    clicks: 120,
    estimatedEarnings: {
      amount: 86.4,
      currency: 'TRY',
      isEstimate: true,
      clicks: 120,
      conversionRatePercent: 3,
      averageOrderValue: 750,
      commissionPercent: 8,
      sharePercent: 40,
    },
    confirmedEarnings: 0,
    followerCount: 1200,
    topPosts: [{ postId: 'tp1', clicks: 40, likeCount: 12, previewUrl: null }],
  };

  it('always labels the earnings as an estimate and explains how it is computed', async () => {
    await signedInSession();
    statsMock.mockResolvedValue(stats);

    await renderWithQuery(<CreatorStatsScreen />);

    const estimate = await screen.findByTestId('stats-estimate');
    expect(within(estimate).getByText('86,40 ₺')).toBeTruthy();
    expect(within(estimate).getByText('tahmini')).toBeTruthy();
    expect(screen.getByText(/120 tıklama × %3 satın alma × 750 ₺ ortalama sepet/)).toBeTruthy();
    expect(screen.getByText(/Bu tutar bir tahmindir/)).toBeTruthy();
    expect(screen.getByText('40 tıklama · 12 beğeni')).toBeTruthy();
  });

  it('tells a non-creator that the page is for creators (403)', async () => {
    await signedInSession();
    statsMock.mockRejectedValue(
      new ApiError({ status: 403, errorCode: 'Social.NotACreator', correlationId: 'c' }),
    );

    await renderWithQuery(<CreatorStatsScreen />);

    expect(await screen.findByText('Bu sayfa yalnızca kreatörler içindir')).toBeTruthy();
  });
});

describe('Engellenenler', () => {
  it('lists the blocked people and unblocks one', async () => {
    await signedInSession();
    jest
      .mocked(listBlocks)
      .mockResolvedValue([
        { id: 'b1', displayName: 'Kaan Demir', blockedAt: '2026-11-03T10:00:00Z' },
      ]);
    jest.mocked(unblockUser).mockResolvedValue(undefined);

    await renderWithQuery(<BlockedUsersScreen />);

    expect(await screen.findByText('Kaan Demir')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('unblock-b1'));
    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith('b1'));
  });

  it('says so when nobody is blocked', async () => {
    await signedInSession();
    jest.mocked(listBlocks).mockResolvedValue([]);

    await renderWithQuery(<BlockedUsersScreen />);

    expect(await screen.findByText('Kimseyi engellemedin')).toBeTruthy();
  });
});

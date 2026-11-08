import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { getMe } from '@/api/endpoints/auth';
import { listCategories, listProducts } from '@/api/endpoints/catalog';
import { listSavedIds } from '@/api/endpoints/engagement';
import { getUnreadCount } from '@/api/endpoints/notifications';
import { listPersonas } from '@/api/endpoints/profile';
import { blockUser, getFeed } from '@/api/endpoints/social';
import { DiscoverScreen } from '@/features/catalog/DiscoverScreen';
import { FeedScreen } from '@/features/social/FeedScreen';

import { categories, listItem, page, persona, post, postAuthor } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/notifications');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/social');

const getFeedMock = jest.mocked(getFeed);
const paramsMock = jest.mocked(useLocalSearchParams);

function feedPage(posts: ReturnType<typeof post>[], hasMore = false) {
  return { mode: 'forYou', items: posts, page: 1, pageSize: 20, hasMore };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  paramsMock.mockReturnValue({});
  jest.mocked(listCategories).mockResolvedValue(categories);
  jest.mocked(listProducts).mockResolvedValue(page([listItem()]));
  jest.mocked(getMe).mockResolvedValue({
    id: 'me-1',
    email: 'ben@kombin.test',
    displayName: 'Ben',
    createdAt: '2026-11-01T10:00:00Z',
  });
  jest.mocked(listPersonas).mockResolvedValue({
    items: [persona({ id: 'pe1', name: 'Ofis', isActive: true })],
  });
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
  jest.mocked(getUnreadCount).mockResolvedValue(0);
});

describe('The Akış tab', () => {
  it('sends an old Keşfet "?view=feed" link to the Akış tab', async () => {
    paramsMock.mockReturnValue({ view: 'feed', mode: 'following' });

    await renderWithQuery(<DiscoverScreen />);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/feed',
      params: { mode: 'following' },
    });
    expect(jest.mocked(listProducts)).not.toHaveBeenCalled();
  });

  it('has one primary action, "Paylaş", and a mode toggle, and asks for no products', async () => {
    getFeedMock.mockResolvedValue(
      feedPage([post({ id: 'a1' }), post({ id: 'a2', author: postAuthor({ id: 'u-kaan' }) })]),
    );

    await renderWithQuery(<FeedScreen />);

    expect(await screen.findByTestId('post-a1')).toBeTruthy();
    expect(screen.getByTestId('post-a2')).toBeTruthy();
    // Signed out: the public feed, no token.
    expect(getFeedMock.mock.calls[0]?.slice(0, 4)).toEqual([
      'forYou',
      1,
      undefined,
      { auth: false },
    ]);
    expect(jest.mocked(listProducts)).not.toHaveBeenCalled();
    expect(screen.getByText('Paylaş')).toBeTruthy();
    expect(screen.getByText('Herkes')).toBeTruthy();
    expect(screen.getByText('Takip ettiklerim')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('segment-following'));
    expect(router.setParams).toHaveBeenCalledWith({ mode: 'following' });
    await fireEvent.press(screen.getByTestId('feed-share'));
    expect(router.push).toHaveBeenCalledWith('/posts/new');
  });

  it('asks a signed-out visitor to sign in for "Takip ettiklerim" instead of calling the endpoint', async () => {
    paramsMock.mockReturnValue({ mode: 'following' });

    await renderWithQuery(<FeedScreen />);

    expect(await screen.findByText('Takip ettiklerini görmek için giriş yap')).toBeTruthy();
    expect(getFeedMock).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Giriş yap'));
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('asks for the following feed with the token and the active persona once signed in', async () => {
    await signedInSession();
    paramsMock.mockReturnValue({ mode: 'following' });
    getFeedMock.mockResolvedValue(feedPage([post({ id: 'f1', followingAuthor: true })]));

    await renderWithQuery(<FeedScreen />);

    expect(await screen.findByTestId('post-f1')).toBeTruthy();
    expect(getFeedMock.mock.calls[0]?.slice(0, 4)).toEqual(['following', 1, 'pe1', { auth: true }]);
  });

  it('says so when nobody posted yet, and points at the one Paylaş button', async () => {
    getFeedMock.mockResolvedValue(feedPage([]));

    await renderWithQuery(<FeedScreen />);

    expect(await screen.findByText('Henüz kimse paylaşmadı')).toBeTruthy();
    // The header's "Paylaş" is the one button for it: the empty state points at it instead of repeating it.
    expect(screen.getByText('İlk kombini sen paylaş.')).toBeTruthy();
    expect(screen.getAllByText('Paylaş')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('feed-share'));
    expect(router.push).toHaveBeenCalledWith('/posts/new');
  });

  it('shows a retry when the feed cannot load', async () => {
    getFeedMock.mockRejectedValueOnce(new Error('boom'));
    getFeedMock.mockResolvedValue(feedPage([post({ id: 'r1' })]));

    await renderWithQuery(<FeedScreen />);

    await fireEvent.press(await screen.findByText('Tekrar dene'));
    expect(await screen.findByTestId('post-r1')).toBeTruthy();
  });

  it("removes a blocked author's posts from the feed at once", async () => {
    await signedInSession();
    getFeedMock.mockResolvedValue(
      feedPage([
        post({ id: 'keep', author: postAuthor({ id: 'u-elif' }) }),
        post({ id: 'gone', author: postAuthor({ id: 'u-kaan', displayName: 'Kaan' }) }),
        post({ id: 'gone-too', author: postAuthor({ id: 'u-kaan', displayName: 'Kaan' }) }),
      ]),
    );
    jest.mocked(blockUser).mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });

    await renderWithQuery(<FeedScreen />);
    await screen.findByTestId('post-gone');

    await fireEvent.press(screen.getAllByTestId('post-menu')[1] as never);
    await fireEvent.press(await screen.findByTestId('menu-block'));

    await waitFor(() => expect(screen.queryByTestId('post-gone')).toBeNull());
    expect(screen.queryByTestId('post-gone-too')).toBeNull();
    expect(screen.getByTestId('post-keep')).toBeTruthy();
    expect(blockUser).toHaveBeenCalledWith('u-kaan');
    // Local removal, not a refetch of the list.
    expect(getFeedMock).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});

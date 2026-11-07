import { Alert } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { deletePost, listMyPosts } from '@/api/endpoints/social';
import { useToastStore } from '@/components/toastStore';
import { MyPostsScreen } from '@/features/social/MyPostsScreen';

import { post } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/social');

const listMock = jest.mocked(listMyPosts);
const deleteMock = jest.mocked(deletePost);

function mine(posts: ReturnType<typeof post>[]) {
  return { items: posts, page: 1, pageSize: 20, totalCount: posts.length, totalPages: 1 };
}

beforeEach(async () => {
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
});

describe('Gönderilerim', () => {
  it('shows every status with the backend message, and a fallback for the ones that have none', async () => {
    listMock.mockResolvedValue(
      mine([
        post({ id: 'live', status: 'Live', visibility: 'Public', likeCount: 7 }),
        post({ id: 'draft', status: 'Draft', visibility: 'Private', statusMessage: null }),
        post({
          id: 'blocked',
          status: 'Blocked',
          statusMessage: 'Fotoğraf topluluk kurallarına uymuyor.',
        }),
        post({ id: 'review', status: 'NeedsReview', statusMessage: null }),
        post({ id: 'hidden', status: 'Hidden', statusMessage: null }),
      ]),
    );

    await renderWithQuery(<MyPostsScreen />);

    const live = await screen.findByTestId('my-post-live');
    expect(within(live).getByText('Yayında')).toBeTruthy();
    expect(within(live).getByText('Herkese açık')).toBeTruthy();
    expect(within(live).getByText('7 beğeni')).toBeTruthy();

    expect(within(screen.getByTestId('my-post-draft')).getByText('Taslak')).toBeTruthy();
    const blocked = screen.getByTestId('my-post-blocked');
    expect(within(blocked).getByText('Yayınlanamadı')).toBeTruthy();
    expect(within(blocked).getByText('Fotoğraf topluluk kurallarına uymuyor.')).toBeTruthy();
    const review = screen.getByTestId('my-post-review');
    expect(within(review).getByText('İncelemede')).toBeTruthy();
    expect(within(review).getByText(/incelemede/)).toBeTruthy();
    expect(within(screen.getByTestId('my-post-hidden')).getByText('Gizlendi')).toBeTruthy();
  });

  it('picks an unfinished draft back up and opens a live post', async () => {
    listMock.mockResolvedValue(
      mine([post({ id: 'draft', status: 'Draft' }), post({ id: 'live', status: 'Live' })]),
    );
    await renderWithQuery(<MyPostsScreen />);

    await fireEvent.press(within(await screen.findByTestId('my-post-draft')).getByText('Devam et'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/posts/new',
      params: { postId: 'draft' },
    });

    await fireEvent.press(within(screen.getByTestId('my-post-live')).getByText('Yayında'));
    expect(router.push).toHaveBeenCalledWith('/posts/live');
  });

  it('deletes after a confirmation and drops the row', async () => {
    listMock.mockResolvedValue(mine([post({ id: 'a' }), post({ id: 'b' })]));
    deleteMock.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderWithQuery(<MyPostsScreen />);

    await fireEvent.press(await screen.findByTestId('my-post-delete-a'));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(screen.queryByTestId('my-post-a')).toBeNull());
    expect(screen.getByTestId('my-post-b')).toBeTruthy();
    expect(useToastStore.getState().message).toBe('Gönderi silindi');
    alert.mockRestore();
  });

  it('does not delete when the confirmation is declined', async () => {
    listMock.mockResolvedValue(mine([post({ id: 'a' })]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithQuery(<MyPostsScreen />);

    await fireEvent.press(await screen.findByTestId('my-post-delete-a'));

    expect(alert).toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('has a way to share when there is nothing yet', async () => {
    listMock.mockResolvedValue(mine([]));
    await renderWithQuery(<MyPostsScreen />);

    expect(await screen.findByText('Henüz gönderin yok')).toBeTruthy();
    await fireEvent.press(screen.getByText('Gönderi paylaş'));
    expect(router.push).toHaveBeenCalledWith('/posts/new');
  });
});

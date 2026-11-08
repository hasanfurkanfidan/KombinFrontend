import { Alert } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getMe } from '@/api/endpoints/auth';
import { listSavedIds, saveProduct } from '@/api/endpoints/engagement';
import {
  blockUser,
  followUser,
  likePost,
  reportPost,
  tryPost,
  unlikePost,
} from '@/api/endpoints/social';
import type { Me } from '@/api/models';
import { useToastStore } from '@/components/toastStore';
import { PostCard } from '@/features/social/PostCard';
import { postBand } from '@/features/social/labels';
import { resetImageUrls } from '@/features/social/imageUrl';

import {
  gapPiece,
  needsOneOutfit,
  outfit,
  post,
  postAuthor,
  postTag,
  tryResult,
} from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/social');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/auth');

const likeMock = jest.mocked(likePost);
const unlikeMock = jest.mocked(unlikePost);
const followMock = jest.mocked(followUser);
const reportMock = jest.mocked(reportPost);
const blockMock = jest.mocked(blockUser);
const tryMock = jest.mocked(tryPost);
const savedIdsMock = jest.mocked(listSavedIds);
const saveMock = jest.mocked(saveProduct);
const meMock = jest.mocked(getMe);
const openBrowser = jest.mocked(WebBrowser.openBrowserAsync);

const me = { id: 'me-1', email: 'ben@kombin.test', displayName: 'Ben' } as unknown as Me;

beforeEach(async () => {
  jest.clearAllMocks();
  resetImageUrls();
  useToastStore.getState().hide();
  await resetSession();
  meMock.mockResolvedValue(me);
  savedIdsMock.mockResolvedValue({ productIds: [] });
});

describe('the price band under the photo', () => {
  it('formats the viewer-specific numbers the backend sends', () => {
    expect(postBand({ totalPrice: 4829, pieceCount: 4, ownedCount: 2 })).toBe(
      "Bu kombin toplam 4.829 ₺ · 4 parça · 2'si dolabında var",
    );
    // The suffix follows how the number is read: altı → sı, bir → i.
    expect(postBand({ totalPrice: 100, pieceCount: 6, ownedCount: 6 })).toContain("6'sı");
    expect(postBand({ totalPrice: 100, pieceCount: 3, ownedCount: 1 })).toContain("1'i");
  });

  it('hides the owned part when ownedCount is null (signed out), and the price when no piece has an offer', () => {
    expect(postBand({ totalPrice: 1200, pieceCount: 3, ownedCount: null })).toBe(
      'Bu kombin toplam 1.200 ₺ · 3 parça',
    );
    expect(postBand({ totalPrice: null, pieceCount: 2, ownedCount: null })).toBe(
      'Bu kombin 2 parça',
    );
    expect(postBand({ totalPrice: 500, pieceCount: 2, ownedCount: 0 })).toContain(
      'hiçbiri dolabında yok',
    );
  });

  it('is drawn on the card from the summary, and opens the list of every tagged piece', async () => {
    await renderWithQuery(
      <PostCard post={post({ summary: { totalPrice: 4829, pieceCount: 2, ownedCount: 1 } })} />,
    );

    expect(
      within(screen.getByTestId('post-band')).getByText(/Bu kombin toplam 4\.829 ₺/),
    ).toBeTruthy();
    expect(screen.getByText(/2 parça · 1'i dolabında var/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('post-band'));
    expect(await screen.findByTestId('tag-row-t1')).toBeTruthy();
    expect(screen.getByTestId('tag-row-t2')).toBeTruthy();
  });
});

describe('author row, creator chip, match and disclosure', () => {
  it('shows the creator chip, the handle and the commission disclosure only for a creator', async () => {
    const creator = post({
      author: postAuthor({ handle: 'elif.stil', isCreator: true }),
      disclosure: 'Bu içerikten komisyon kazanabilir',
      matchScore: 92,
    });
    await renderWithQuery(<PostCard post={creator} />);

    expect(screen.getByTestId('creator-chip')).toBeTruthy();
    expect(screen.getByText('Kreatör')).toBeTruthy();
    expect(screen.getByTestId('post-author-sub').props.children).toBe(
      '@elif.stil · Sana uygun %92',
    );
    expect(screen.getByTestId('post-disclosure')).toHaveTextContent(
      'Bu içerikten komisyon kazanabilir',
    );
  });

  it('shows neither chip nor disclosure for an ordinary author, and no match line without a score', async () => {
    await renderWithQuery(<PostCard post={post()} />);

    expect(screen.queryByTestId('creator-chip')).toBeNull();
    expect(screen.queryByTestId('post-disclosure')).toBeNull();
    expect(screen.queryByTestId('post-author-sub')).toBeNull();
    expect(screen.getByTestId('post-caption')).toHaveTextContent(
      'Elif Yıldız Pazartesi toplantı kombini',
    );
  });

  it('opens a creator on the creator page and anyone else on the profile', async () => {
    const creator = post({ author: postAuthor({ handle: 'elif.stil', isCreator: true }) });
    const view = await renderWithQuery(<PostCard post={creator} />);
    await fireEvent.press(screen.getByTestId('post-author'));
    expect(router.push).toHaveBeenLastCalledWith('/creators/elif.stil');
    await view.unmount();

    await renderWithQuery(<PostCard post={post()} />);
    await fireEvent.press(screen.getByTestId('post-author'));
    expect(router.push).toHaveBeenLastCalledWith('/users/u-elif');
  });
});

describe('tag dots', () => {
  it('puts one dot at each box centre and opens name, price and seller with a buy button on goPath', async () => {
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);

    // t1: x 0.1 + w 0.4 / 2 = 0.3, y 0.1 + h 0.3 / 2 = 0.25.
    const dot = screen.getByTestId('tag-dot-0');
    expect(dot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ left: '30%', top: '25%' })]),
    );

    await fireEvent.press(dot);
    const row = await screen.findByTestId('tag-row-t1');
    expect(within(row).getByText('Yün karışımlı blazer')).toBeTruthy();
    expect(within(row).getByText('2.149 ₺ · En ucuzu Trendyol')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('post_tag_tap', {
      postId: 'post1',
      tagKind: 'Product',
      hasOffer: true,
    });

    await fireEvent.press(screen.getByTestId('tag-buy-t1'));
    // The backend's own link, as given: no second `src`, no seller URL.
    expect(openBrowser).toHaveBeenLastCalledWith(
      'http://api.test/api/v1/go/o-trendyol?src=feed&post=post1',
    );
    expect(track).toHaveBeenCalledWith('buy_click', { offerId: 'o-trendyol', source: 'feed' });
  });

  it('marks pieces the viewer owns, exactly or only similar, and offers no buy button without an offer', async () => {
    const tags = [
      postTag({ id: 'ta', inWardrobe: 'exact' }),
      postTag({ id: 'tb', inWardrobe: 'similar', offer: null, name: 'Bej kazak' }),
    ];
    await renderWithQuery(<PostCard post={post({ tags })} />);
    await fireEvent.press(screen.getByTestId('post-band'));

    expect(within(await screen.findByTestId('tag-row-ta')).getByText('Dolabında var')).toBeTruthy();
    const similar = screen.getByTestId('tag-row-tb');
    expect(within(similar).getByText('Benzeri dolabında var')).toBeTruthy();
    expect(within(similar).getByText('Şu an satışta değil')).toBeTruthy();
    expect(screen.queryByTestId('tag-buy-tb')).toBeNull();
  });
});

describe('outfit posts', () => {
  it('draw a collage from the tags images at their boxes when there is no photo', async () => {
    const collage = post({
      kind: 'Outfit',
      image: null,
      tags: [
        postTag({ id: 'c1', x: 0, y: 0, w: 0.5, h: 0.5 }),
        postTag({ id: 'c2', x: 0.5, y: 0, w: 0.5, h: 0.5, imageUrl: 'http://img.test/c2.webp' }),
      ],
    });
    await renderWithQuery(<PostCard post={collage} />);

    expect(screen.getByTestId('post-collage')).toBeTruthy();
    const second = screen.getByTestId('collage-tile-c2');
    expect(second.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ left: '50%', top: '0%', width: '50%', height: '50%' }),
      ]),
    );
  });
});

describe('like, follow and save', () => {
  it('likes at once, and takes the like back', async () => {
    await signedInSession();
    likeMock.mockResolvedValue({ liked: true, likeCount: 13 });
    unlikeMock.mockResolvedValue({ liked: false, likeCount: 12 });
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);

    await fireEvent.press(screen.getByTestId('post-like'));
    await waitFor(() => expect(likeMock).toHaveBeenCalledWith('post1'));
    expect(track).toHaveBeenCalledWith('post_like', { postId: 'post1', liked: true });
  });

  it('rolls the counter back when the server refuses', async () => {
    await signedInSession();
    likeMock.mockRejectedValue(new ApiError({ status: 500, correlationId: 'c' }));
    await renderWithQuery(<PostCard post={post({ id: 'post1', likeCount: 12 })} />);

    await fireEvent.press(screen.getByTestId('post-like'));
    await waitFor(() => expect(useToastStore.getState().message).toBe('Beğeni kaydedilemedi'));
    expect(screen.getByTestId('post-like-count')).toHaveTextContent('12');
  });

  it('sends a signed-out viewer to the login screen instead of calling the API', async () => {
    await renderWithQuery(<PostCard post={post()} />);

    await fireEvent.press(screen.getByTestId('post-like'));
    await fireEvent.press(screen.getByTestId('post-follow'));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(likeMock).not.toHaveBeenCalled();
    expect(followMock).not.toHaveBeenCalled();
  });

  it("follows the author, and hides the follow button on one's own post", async () => {
    await signedInSession();
    followMock.mockResolvedValue({ following: true, followerCount: 11 });
    const view = await renderWithQuery(
      <PostCard post={post({ author: postAuthor({ id: 'u-elif' }) })} />,
    );

    await fireEvent.press(screen.getByTestId('post-follow'));
    await waitFor(() => expect(followMock).toHaveBeenCalledWith('u-elif'));
    await view.unmount();

    await renderWithQuery(<PostCard post={post({ author: postAuthor({ id: 'me-1' }) })} />);
    await waitFor(() => expect(screen.queryByTestId('post-follow')).toBeNull());
  });

  it('saves the tagged products through the saved list, since a post has no save of its own', async () => {
    await signedInSession();
    saveMock.mockResolvedValue(undefined as never);
    await renderWithQuery(<PostCard post={post()} />);

    await fireEvent.press(await screen.findByTestId('post-save'));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
    expect(saveMock).toHaveBeenCalledWith('p1');
    expect(saveMock).toHaveBeenCalledWith('p2');
  });
});

describe('report and block', () => {
  it('reports with the chosen reason and tells the viewer', async () => {
    await signedInSession();
    reportMock.mockResolvedValue({ reported: true });
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);

    await fireEvent.press(screen.getByTestId('post-menu'));
    await fireEvent.press(await screen.findByTestId('menu-report'));
    await fireEvent.press(await screen.findByTestId('report-Spam'));

    await waitFor(() => expect(reportMock).toHaveBeenCalledWith('post1', 'Spam'));
    expect(track).toHaveBeenCalledWith('post_report', { postId: 'post1', reason: 'Spam' });
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Şikayetin alındı, teşekkürler'),
    );
  });

  it('says "zaten şikayet ettin" on a 409', async () => {
    await signedInSession();
    reportMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Social.AlreadyReported', correlationId: 'c' }),
    );
    await renderWithQuery(<PostCard post={post()} />);

    await fireEvent.press(screen.getByTestId('post-menu'));
    await fireEvent.press(await screen.findByTestId('menu-report'));
    await fireEvent.press(await screen.findByTestId('report-Scam'));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Bu gönderiyi zaten şikayet ettin'),
    );
    expect(track).not.toHaveBeenCalledWith('post_report', expect.anything());
  });

  it('blocks the author after a confirmation', async () => {
    await signedInSession();
    blockMock.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderWithQuery(<PostCard post={post({ author: postAuthor({ id: 'u-kaan' }) })} />);

    await fireEvent.press(screen.getByTestId('post-menu'));
    await fireEvent.press(await screen.findByTestId('menu-block'));

    await waitFor(() => expect(blockMock).toHaveBeenCalledWith('u-kaan'));
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
  });
});

describe('"Dolabımla dene"', () => {
  it('shows the groups and outfits, and a missing piece with its price and a buy button on goPath', async () => {
    await signedInSession();
    const oneMissing = needsOneOutfit({
      id: 'try-of-1',
      pieces: [gapPiece],
      completionPrice: 649,
    });
    tryMock.mockResolvedValue(
      tryResult({
        postId: 'post1',
        groups: [
          {
            tagId: 't1',
            productId: 'p1',
            owned: false,
            outfits: [oneMissing, outfit({ id: 'try-of-2' })],
            message: 'Blazer ile dolabından 2 kombin',
          },
        ],
      }),
    );
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);

    await fireEvent.press(screen.getByTestId('post-try'));

    expect(await screen.findByText('Blazer ile dolabından 2 kombin')).toBeTruthy();
    expect(screen.getByText('1 parça eksik · 649 ₺')).toBeTruthy();
    expect(screen.getByText('Tamamen dolabından')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('try_with_wardrobe', {
      postId: 'post1',
      anchorCount: 1,
      outfitCount: 2,
    });

    await fireEvent.press(screen.getByTestId('try-buy-o-koton'));
    expect(openBrowser).toHaveBeenLastCalledWith('http://api.test/api/v1/go/o-koton?src=feed');
  });

  it('says so when nothing could be built from the wardrobe (409)', async () => {
    await signedInSession();
    tryMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Social.NothingToTry', correlationId: 'c' }),
    );
    await renderWithQuery(<PostCard post={post()} />);

    await fireEvent.press(screen.getByTestId('post-try'));
    expect(await screen.findByText(/dolabından kombin çıkmadı/)).toBeTruthy();
  });

  it('asks a signed-out viewer to sign in', async () => {
    await renderWithQuery(<PostCard post={post()} />);
    await fireEvent.press(screen.getByTestId('post-try'));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(tryMock).not.toHaveBeenCalled();
  });
});

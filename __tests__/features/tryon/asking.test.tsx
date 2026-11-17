// Where "Manken üstünde gör" asks the backend, and where it must not: a request can make the server draw an image, and a
// user gets 30 of those an hour.
import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { getMe } from '@/api/endpoints/auth';
import { getPriceHistory, getProduct } from '@/api/endpoints/catalog';
import { listAlerts, listSavedIds } from '@/api/endpoints/engagement';
import {
  getDailyOutfit,
  getHowToWear,
  listSavedOutfits,
  recordOutfitFeedback,
} from '@/api/endpoints/outfits';
import { listPersonas } from '@/api/endpoints/profile';
import { tryPost } from '@/api/endpoints/social';
import { getTryOn } from '@/api/endpoints/tryon';
import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';
import { DailyOutfitScreen } from '@/features/outfits/DailyOutfitScreen';
import { HowToWearScreen } from '@/features/outfits/HowToWearScreen';
import { SavedOutfitsScreen } from '@/features/outfits/SavedOutfitsScreen';
import { resetTryOnGate } from '@/features/tryon/gate';
import { TRYON_ASK_DELAY_MS, TRYON_PRODUCT_DWELL_MS } from '@/features/tryon/hooks';
import { PostCard } from '@/features/social/PostCard';

import {
  dailyOutfit,
  history,
  howToWear,
  me,
  outfit,
  outfitPiece,
  persona,
  post,
  product,
  tryResult,
} from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { flush, tryOn, unavailable } from './support';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/social');

const getTryOnMock = jest.mocked(getTryOn);
const asked = () => getTryOnMock.mock.calls.map(([subject]) => subject);

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetTryOnGate();
  await resetSession();
  await signedInSession();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  getTryOnMock.mockResolvedValue(unavailable());
  jest.mocked(listPersonas).mockResolvedValue({ items: [persona({ id: 'pe1', isActive: true })] });
  jest.mocked(getMe).mockResolvedValue(me());
  jest.mocked(recordOutfitFeedback).mockResolvedValue(outfit());
});

afterEach(() => {
  jest.useRealTimers();
});

const sized = (id: string) =>
  outfit({
    id,
    pieces: [
      outfitPiece({ wardrobeItemId: `${id}-top`, name: `Üst ${id}` }),
      outfitPiece({ slot: 'Bottom', wardrobeItemId: `${id}-bottom`, name: `Alt ${id}` }),
    ],
  });

describe('lists and cards never ask', () => {
  it('the saved outfits grid asks nothing for any of its cards', async () => {
    jest.mocked(listSavedOutfits).mockResolvedValue({
      items: [sized('s1'), sized('s2'), sized('s3')],
      page: 1,
      pageSize: 20,
      totalCount: 3,
      totalPages: 1,
    } as never);

    await renderWithQuery(<SavedOutfitsScreen />);
    await flush(TRYON_ASK_DELAY_MS * 10);

    expect(screen.getByTestId('saved-outfit-s3')).toBeTruthy();
    expect(getTryOnMock).not.toHaveBeenCalled();
  });
});

describe('the outfit sheet', () => {
  it('daily: rapid shuffles cost one request, for the outfit the user stopped on', async () => {
    jest
      .mocked(getDailyOutfit)
      .mockImplementation(async (query) =>
        dailyOutfit({ outfit: sized(`seed${query.seed}`), alternatives: [] }),
      );
    getTryOnMock.mockResolvedValue(
      tryOn({ garments: [{ id: 'seed3-top', fitLevel: 'TrueToSize' }] }),
    );

    await renderWithQuery(<DailyOutfitScreen />);
    await flush(100);
    for (let shuffle = 0; shuffle < 3; shuffle += 1) {
      await fireEvent.press(screen.getByTestId('outfit-shuffle'));
      await flush(100);
    }
    expect(getTryOnMock).not.toHaveBeenCalled();

    await flush(TRYON_ASK_DELAY_MS);

    expect(asked()).toEqual([{ kind: 'outfit', id: 'seed3' }]);
    // The quiet action sits in the sheet header, next to what the outfit needs.
    expect(screen.getByTestId('tryon-action')).toHaveTextContent('Manken üstünde gör');
  });

  it('daily: an Unavailable answer leaves the sheet exactly as it was', async () => {
    jest
      .mocked(getDailyOutfit)
      .mockResolvedValue(dailyOutfit({ outfit: sized('o1'), alternatives: [] }));

    await renderWithQuery(<DailyOutfitScreen />);
    await flush(TRYON_ASK_DELAY_MS + 100);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('outfit-sheet')).toBeTruthy();
    expect(screen.getByTestId('outfit-save')).toBeTruthy();
    expect(screen.queryByTestId('tryon-action')).toBeNull();
    expect(screen.queryByText(/Manken/)).toBeNull();
  });

  it('how-to-wear: five outfits in a pager, one request, for the page on screen', async () => {
    jest
      .mocked(getHowToWear)
      .mockResolvedValue(
        howToWear([sized('h1'), sized('h2'), sized('h3'), sized('h4'), sized('h5')]),
      );

    await renderWithQuery(<HowToWearScreen productId="p1" />);
    await flush(TRYON_ASK_DELAY_MS * 5);

    expect(asked()).toEqual([{ kind: 'outfit', id: 'h1' }]);
  });
});

describe('product detail', () => {
  beforeEach(() => {
    jest.mocked(getProduct).mockResolvedValue(product());
    jest.mocked(getPriceHistory).mockResolvedValue(history);
    jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
    jest.mocked(listAlerts).mockResolvedValue({ items: [] });
  });

  it('asks only after the user stayed on the product, and shows the outlined action for Ready', async () => {
    getTryOnMock.mockResolvedValue(tryOn({ garments: [{ id: 'p1', fitLevel: 'TrueToSize' }] }));

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    // The wait starts when the product is on screen, not when the screen opens (the personas load first).
    await flush(100);
    expect(screen.getByTestId('how-to-wear')).toBeTruthy();
    await flush(TRYON_PRODUCT_DWELL_MS - 300);
    expect(getTryOnMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('detail-tryon')).toBeNull();

    await flush(400);
    expect(asked()).toEqual([{ kind: 'product', id: 'p1' }]);
    expect(screen.getByTestId('detail-tryon')).toHaveTextContent('Manken üstünde gör');
  });

  it('a product the backend cannot draw shows nothing in its place', async () => {
    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await flush(TRYON_PRODUCT_DWELL_MS + 100);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('detail-tryon')).toBeNull();
    expect(screen.getByTestId('how-to-wear')).toBeTruthy();
  });

  it('a visitor never asks', async () => {
    await resetSession();
    getTryOnMock.mockResolvedValue(tryOn());

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await flush(TRYON_PRODUCT_DWELL_MS * 3);

    expect(getTryOnMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('detail-tryon')).toBeNull();
  });
});

describe('inside "Dolabımla dene"', () => {
  const group = (outfits: ReturnType<typeof outfit>[]) =>
    tryResult({
      postId: 'post1',
      groups: [{ tagId: 't1', productId: 'p1', owned: false, outfits, message: 'Blazer ile' }],
    });

  it('asks about the first outfit only, and the switch swaps the figure for the mannequin', async () => {
    jest.mocked(tryPost).mockResolvedValue(group([sized('t1'), sized('t2'), sized('t3')]));
    getTryOnMock.mockResolvedValue(tryOn({ garments: [{ id: 't1-top', fitLevel: 'Tight' }] }));
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);

    // A post card in the feed asks nothing until its sheet is open.
    await flush(TRYON_ASK_DELAY_MS * 3);
    expect(getTryOnMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('post-try'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(asked()).toEqual([{ kind: 'outfit', id: 't1' }]);

    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('try-switch-mannequin'));
    expect(screen.queryByTestId('try-outfit-t1')).toBeNull();
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(screen.getByTestId('tryon-fit-t1-top')).toHaveTextContent(/Dar gelebilir/);

    await fireEvent.press(screen.getByTestId('try-switch-figure'));
    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
    expect(screen.queryByTestId('tryon-image')).toBeNull();
  });

  it('has no switch when the backend cannot draw it', async () => {
    jest.mocked(tryPost).mockResolvedValue(group([sized('t1')]));
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);
    await fireEvent.press(screen.getByTestId('post-try'));
    await flush(TRYON_ASK_DELAY_MS + 100);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('try-switch')).toBeNull();
    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
  });
});

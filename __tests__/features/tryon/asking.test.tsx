// Where "Manken üstünde gör" asks the backend, and where it must not: a request can make the server draw an image, and a
// user gets 30 of those an hour.
import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { getMe } from '@/api/endpoints/auth';
import {
  getDailyOutfit,
  getHowToWear,
  listSavedOutfits,
  recordOutfitFeedback,
} from '@/api/endpoints/outfits';
import { listPersonas } from '@/api/endpoints/profile';
import { tryPost } from '@/api/endpoints/social';
import { getTryOn } from '@/api/endpoints/tryon';
import { useToastStore } from '@/components/toastStore';
import { DailyOutfitScreen } from '@/features/outfits/DailyOutfitScreen';
import { HowToWearScreen } from '@/features/outfits/HowToWearScreen';
import { SavedOutfitsScreen } from '@/features/outfits/SavedOutfitsScreen';
import { resetTryOnGate } from '@/features/tryon/gate';
import { TRYON_ASK_DELAY_MS } from '@/features/tryon/hooks';
import { PostCard } from '@/features/social/PostCard';

import {
  dailyOutfit,
  howToWear,
  me,
  outfit,
  outfitPiece,
  persona,
  post,
  tryResult,
} from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { checkCalls, checkReady, drawCalls, flush, mockTryOn, tryOn, unavailable } from './support';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/social');

const getTryOnMock = jest.mocked(getTryOn);
/** The subjects of every availability check; a drawing request (no `check` option) is counted by `drawCalls`. */
const asked = () => checkCalls().map(([subject]) => subject);

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetTryOnGate();
  await resetSession();
  await signedInSession();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  mockTryOn({ check: unavailable() });
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
  it('daily: rapid shuffles cost one check, for the outfit the user stopped on, and no drawing', async () => {
    jest
      .mocked(getDailyOutfit)
      .mockImplementation(async (query) =>
        dailyOutfit({ outfit: sized(`seed${query.seed}`), alternatives: [] }),
      );
    mockTryOn({
      check: checkReady(),
      draw: tryOn({ garments: [{ id: 'seed3-top', fitLevel: 'TrueToSize' }] }),
    });

    await renderWithQuery(<DailyOutfitScreen />);
    await flush(100);
    for (let shuffle = 0; shuffle < 3; shuffle += 1) {
      await fireEvent.press(screen.getByTestId('outfit-shuffle'));
      await flush(100);
    }
    expect(getTryOnMock).not.toHaveBeenCalled();

    await flush(TRYON_ASK_DELAY_MS);

    expect(asked()).toEqual([{ kind: 'outfit', id: 'seed3' }]);
    // Nothing is drawn until the user taps the quiet action in the sheet header.
    expect(drawCalls()).toHaveLength(0);
    expect(screen.getByTestId('tryon-action')).toHaveTextContent('Manken üstünde gör');
  });

  it('daily: a morning with three shuffles and one tap costs four checks and one drawing', async () => {
    jest
      .mocked(getDailyOutfit)
      .mockImplementation(async (query) =>
        dailyOutfit({ outfit: sized(`seed${query.seed}`), alternatives: [] }),
      );
    mockTryOn();

    await renderWithQuery(<DailyOutfitScreen />);
    await flush(TRYON_ASK_DELAY_MS + 50);
    for (let shuffle = 0; shuffle < 3; shuffle += 1) {
      await fireEvent.press(screen.getByTestId('outfit-shuffle'));
      // Each outfit stands still for the whole delay before it is checked.
      await flush(TRYON_ASK_DELAY_MS + 50);
    }
    expect(asked()).toEqual([0, 1, 2, 3].map((seed) => ({ kind: 'outfit', id: `seed${seed}` })));
    expect(checkCalls()).toHaveLength(4);
    expect(drawCalls()).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('tryon-action'));
    await flush(0);

    expect(checkCalls()).toHaveLength(4);
    expect(drawCalls()).toHaveLength(1);
    expect(drawCalls()[0]?.[0]).toEqual({ kind: 'outfit', id: 'seed3' });
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
  });

  it('daily: an Unavailable check leaves the sheet exactly as it was', async () => {
    jest
      .mocked(getDailyOutfit)
      .mockResolvedValue(dailyOutfit({ outfit: sized('o1'), alternatives: [] }));

    await renderWithQuery(<DailyOutfitScreen />);
    await flush(TRYON_ASK_DELAY_MS + 100);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(drawCalls()).toHaveLength(0);
    expect(screen.getByTestId('outfit-sheet')).toBeTruthy();
    expect(screen.getByTestId('outfit-save')).toBeTruthy();
    expect(screen.queryByTestId('tryon-action')).toBeNull();
    expect(screen.queryByText(/Manken/)).toBeNull();
  });

  it('how-to-wear: five outfits in a pager, one check, for the page on screen', async () => {
    jest
      .mocked(getHowToWear)
      .mockResolvedValue(
        howToWear([sized('h1'), sized('h2'), sized('h3'), sized('h4'), sized('h5')]),
      );
    mockTryOn();

    await renderWithQuery(<HowToWearScreen productId="p1" />);
    await flush(TRYON_ASK_DELAY_MS * 5);

    expect(asked()).toEqual([{ kind: 'outfit', id: 'h1' }]);
    expect(drawCalls()).toHaveLength(0);
  });
});

describe('inside "Dolabımla dene"', () => {
  const group = (outfits: ReturnType<typeof outfit>[]) =>
    tryResult({
      postId: 'post1',
      groups: [{ tagId: 't1', productId: 'p1', owned: false, outfits, message: 'Blazer ile' }],
    });

  it('checks the first outfit only; the switch asks for the drawing and swaps the figure for the mannequin', async () => {
    jest.mocked(tryPost).mockResolvedValue(group([sized('t1'), sized('t2'), sized('t3')]));
    mockTryOn({ draw: tryOn({ garments: [{ id: 't1-top', fitLevel: 'Tight' }] }) });
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);

    // A post card in the feed asks nothing until its sheet is open.
    await flush(TRYON_ASK_DELAY_MS * 3);
    expect(getTryOnMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('post-try'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(asked()).toEqual([{ kind: 'outfit', id: 't1' }]);
    // The switch exists, but nothing is drawn until the user picks the mannequin.
    expect(screen.getByTestId('try-switch')).toBeTruthy();
    await flush(60_000);
    expect(drawCalls()).toHaveLength(0);

    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('try-switch-mannequin'));
    await flush(0);
    expect(drawCalls()).toHaveLength(1);
    expect(drawCalls()[0]?.[0]).toEqual({ kind: 'outfit', id: 't1' });
    expect(drawCalls()[0]?.[2]).toBeUndefined();
    expect(screen.queryByTestId('try-outfit-t1')).toBeNull();
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(screen.getByTestId('tryon-fit-t1-top')).toHaveTextContent(/Dar gelebilir/);

    await fireEvent.press(screen.getByTestId('try-switch-figure'));
    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
    expect(screen.queryByTestId('tryon-image')).toBeNull();

    // Back to the mannequin: the answer is kept, so there is no second drawing.
    await fireEvent.press(screen.getByTestId('try-switch-mannequin'));
    await flush(0);
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(drawCalls()).toHaveLength(1);
  });

  it('a failed drawing brings the figure back, removes the switch and shows one toast', async () => {
    jest.mocked(tryPost).mockResolvedValue(group([sized('t1'), sized('t2')]));
    mockTryOn({ draw: new Error('boom') });
    useToastStore.getState().hide();
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);
    await fireEvent.press(screen.getByTestId('post-try'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(screen.getByTestId('try-switch')).toBeTruthy();
    const before = useToastStore.getState().id;

    await fireEvent.press(screen.getByTestId('try-switch-mannequin'));
    await flush(0);

    expect(drawCalls()).toHaveLength(1);
    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
    expect(screen.queryByTestId('tryon-image')).toBeNull();
    expect(screen.queryByTestId('tryon-preparing')).toBeNull();
    expect(screen.queryByTestId('try-switch')).toBeNull();
    expect(useToastStore.getState().message).toBe('İşlem yapılamadı, tekrar dene');
    expect(useToastStore.getState().id).toBe(before + 1);

    // Nothing is asked again for that outfit in the session.
    await flush(60 * 60_000);
    expect(checkCalls()).toHaveLength(1);
    expect(drawCalls()).toHaveLength(1);
  });

  it('has no switch when the backend cannot draw it', async () => {
    jest.mocked(tryPost).mockResolvedValue(group([sized('t1')]));
    await renderWithQuery(<PostCard post={post({ id: 'post1' })} />);
    await fireEvent.press(screen.getByTestId('post-try'));
    await flush(TRYON_ASK_DELAY_MS + 100);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(drawCalls()).toHaveLength(0);
    expect(screen.queryByTestId('try-switch')).toBeNull();
    expect(screen.getByTestId('try-outfit-t1')).toBeTruthy();
  });
});

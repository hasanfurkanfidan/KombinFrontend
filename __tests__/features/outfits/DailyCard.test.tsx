/**
 * The device is in Tokyo (UTC+9) for this whole file: the card must follow Istanbul time, never the phone's own clock.
 *
 * @jest-environment <rootDir>/__tests__/support/timeZoneEnvironment.js
 * @jest-environment-options {"timeZone": "Asia/Tokyo"}
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import {
  getDailyOutfit,
  getOutfit,
  recordOutfitFeedback,
  wearOutfit,
} from '@/api/endpoints/outfits';
import { getMe } from '@/api/endpoints/auth';
import { queryKeys } from '@/api/queryKeys';
import { getWardrobeStats } from '@/api/endpoints/wardrobe';
import { useToastStore } from '@/components/toastStore';
import { DailyCard } from '@/features/outfits/DailyCard';
import { addPhotos } from '@/features/wardrobe/addItem';
import { pickPhotos } from '@/features/wardrobe/picker';
import { usePrefsStore } from '@/session/prefsStore';
import { readStoredWornOutfit, writeStoredWornOutfit } from '@/session/wornOutfitStorage';

import { dailyOutfit, me, needsOneOutfit, outfit, wardrobeStats } from '../../fixtures';
import {
  EVENING,
  freezeClockAt,
  MORNING,
  moveClockTo,
  TODAY,
  unfreezeClock,
} from '../../support/fakeClock';
import { heldOpen, renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/features/wardrobe/picker');
jest.mock('@/features/wardrobe/addItem', () => ({
  ...jest.requireActual('@/features/wardrobe/addItem'),
  addPhotos: jest.fn(),
}));

const meMock = jest.mocked(getMe);
const dailyMock = jest.mocked(getDailyOutfit);
const wearMock = jest.mocked(wearOutfit);
const getOutfitMock = jest.mocked(getOutfit);
const feedbackMock = jest.mocked(recordOutfitFeedback);
const statsMock = jest.mocked(getWardrobeStats);
const pickMock = jest.mocked(pickPhotos);
const addMock = jest.mocked(addPhotos);

const WORN_AT = '2026-11-02T09:00:00Z';

/** Today in Istanbul (the clock is frozen on it), and the account the stored value belongs to. */
const today = () => TODAY;
const USER = me().id;

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  usePrefsStore.getState().reset();
  useToastStore.getState().hide();
  dailyMock.mockResolvedValue(dailyOutfit());
  statsMock.mockResolvedValue(wardrobeStats({ itemCount: 48 }));
  feedbackMock.mockResolvedValue(outfit());
  meMock.mockResolvedValue(me());
  // The evening: after 18:00 in Istanbul (and past midnight on a phone in Tokyo), the card is about tomorrow.
  freezeClockAt(EVENING);
});

afterEach(() => {
  jest.restoreAllMocks();
  unfreezeClock();
});

describe('which day the card is about', () => {
  it('is today in the morning, and opens the daily screen on today', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('tomorrow-card');
    expect(screen.getByText('Bugün için')).toBeTruthy();
    expect(dailyMock.mock.calls[0]?.[0]).toMatchObject({ date: 'today', seed: 0 });
    await fireEvent.press(screen.getByTestId('home-card-title'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'today', seed: '0' },
    });
  });

  it('is still today at 12:30, which the old noon rule had already given up on', async () => {
    freezeClockAt('2026-11-02T09:30:00Z');
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('tomorrow-card');
    expect(screen.getByText('Bugün için')).toBeTruthy();
  });

  it('is tomorrow in the evening, with its weather and figure, and opens the daily screen on tomorrow', async () => {
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    const card = await screen.findByTestId('tomorrow-card');
    expect(within(card).getByText('Yarın için')).toBeTruthy();
    expect(within(card).getByText('Dolabından hazır bir kombin')).toBeTruthy();
    expect(within(screen.getByTestId('tomorrow-weather')).getByText('9° · Yağmurlu')).toBeTruthy();
    expect(
      within(screen.getByTestId('tomorrow-figure')).getAllByTestId(/^figure-cell-/),
    ).toHaveLength(3);
    expect(dailyMock.mock.calls[0]?.[0]).toEqual({
      date: 'tomorrow',
      occasion: undefined,
      seed: 0,
    });

    await fireEvent.press(screen.getByTestId('home-card-figure'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'tomorrow', seed: '0' },
    });
  });

  it('stays on today, settled, when the backend says today’s plain outfit is worn', async () => {
    freezeClockAt(MORNING);
    dailyMock.mockImplementation(async (query) =>
      query.date === 'today' ? dailyOutfit({ outfit: outfit({ wornAt: WORN_AT }) }) : dailyOutfit(),
    );
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    expect(screen.queryByText('Yarın için')).toBeNull();
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
  });

  it('stays settled on today when the app comes back to the front later in the day', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: (state: string) => void,
    ) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    }) as never);
    const current = outfit({ id: 'wear-me', date: today() });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));
    wearMock.mockResolvedValue({ ...current, wornAt: WORN_AT });

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-wear'));
    await waitFor(() => expect(usePrefsStore.getState().homeCardWorn).not.toBeNull());
    dailyMock.mockClear();

    moveClockTo('2026-11-02T10:00:00Z');
    await act(async () => listeners.forEach((listener) => listener('active')));

    expect(screen.getByText('Bugün giyiyorsun')).toBeTruthy();
    expect(screen.queryByText('Yarın için')).toBeNull();
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(dailyMock).not.toHaveBeenCalledWith(expect.objectContaining({ date: 'tomorrow' }));
  });

  it('turns to tomorrow at 18:00 even though today’s outfit was worn', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: (state: string) => void,
    ) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    }) as never);
    usePrefsStore.getState().markHomeCardWorn({ userId: USER, day: today(), outfitId: 'worn-1' });
    getOutfitMock.mockResolvedValue(outfit({ id: 'worn-1', date: today(), wornAt: WORN_AT }));

    await renderWithQuery(<DailyCard />);
    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();

    moveClockTo('2026-11-02T15:00:00Z');
    await act(async () => listeners.forEach((listener) => listener('active')));

    expect(await screen.findByText('Yarın için')).toBeTruthy();
    expect(screen.queryByText('Bugün giyiyorsun')).toBeNull();
    expect(dailyMock.mock.calls.at(-1)?.[0]).toMatchObject({ date: 'tomorrow', seed: 0 });
  });
});

describe('the worn outfit survives a restart', () => {
  /** A fresh launch: the store has not read its file yet, whatever the file holds. */
  function coldStart() {
    usePrefsStore.setState({ homeCardWorn: null, homeCardWornLoaded: false });
  }

  it('settles at once on the outfit that was worn (seed 2), loaded by its id, without the wear action', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await writeStoredWornOutfit({ userId: USER, day: today(), outfitId: 'seed-two' });
    coldStart();
    getOutfitMock.mockResolvedValue(
      outfit({
        id: 'seed-two',
        seed: 2,
        date: today(),
        wornAt: WORN_AT,
        pieces: outfit().pieces.slice(0, 2),
      }),
    );

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    await waitFor(() =>
      expect(
        within(screen.getByTestId('tomorrow-figure')).getAllByTestId(/^figure-cell-/),
      ).toHaveLength(2),
    );
    expect(getOutfitMock.mock.calls[0]?.[0]).toBe('seed-two');
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(screen.queryByTestId('home-card-shuffle')).toBeNull();
    // The plain seed-0 outfit is never asked for.
    expect(dailyMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('home-card-open'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/[id]',
      params: { id: 'seed-two' },
    });
  });

  it('shows the settled frame, not the actions, while the outfit loads', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await writeStoredWornOutfit({ userId: USER, day: today(), outfitId: 'seed-two' });
    coldStart();
    getOutfitMock.mockReturnValue(heldOpen());

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(screen.queryByTestId('home-card-shuffle')).toBeNull();
    expect(screen.queryByTestId('home-card-occasion')).toBeNull();
  });

  it('keeps the settled frame when the load fails for another reason than "gone"', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await writeStoredWornOutfit({ userId: USER, day: today(), outfitId: 'seed-two' });
    coldStart();
    getOutfitMock.mockRejectedValue(
      new ApiError({ status: 503, correlationId: '00000000-0000-4000-8000-0000000000aa' }),
    );

    await renderWithQuery(<DailyCard />);

    await waitFor(() => expect(getOutfitMock).toHaveBeenCalled());
    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(usePrefsStore.getState().homeCardWorn).not.toBeNull();
  });

  it('ignores a value from yesterday, and clears it', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await writeStoredWornOutfit({ userId: USER, day: '2020-01-01', outfitId: 'old' });
    coldStart();

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByTestId('home-card-wear')).toBeTruthy();
    expect(screen.getByText('Bugün için')).toBeTruthy();
    expect(getOutfitMock).not.toHaveBeenCalled();
    expect(usePrefsStore.getState().homeCardWorn).toBeNull();
    await waitFor(async () => expect(await readStoredWornOutfit()).toBeNull());
  });

  it('drops the value and shows the normal card when the stored outfit is gone (404)', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await writeStoredWornOutfit({ userId: USER, day: today(), outfitId: 'deleted' });
    coldStart();
    getOutfitMock.mockRejectedValue(
      new ApiError({ status: 404, correlationId: '00000000-0000-4000-8000-0000000000bb' }),
    );

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByTestId('home-card-wear')).toBeTruthy();
    expect(screen.getByText('Bugün için')).toBeTruthy();
    expect(usePrefsStore.getState().homeCardWorn).toBeNull();
    await waitFor(async () => expect(await readStoredWornOutfit()).toBeNull());
  });

  it('does not use the stored outfit for tomorrow’s card', async () => {
    await signedInSession();
    await writeStoredWornOutfit({ userId: USER, day: today(), outfitId: 'seed-two' });
    coldStart();

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByText('Yarın için')).toBeTruthy();
    expect(getOutfitMock).not.toHaveBeenCalled();
  });

  it('remembers the outfit it was worn from, for the next launch', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    const current = outfit({ id: 'wear-me', date: today() });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));
    wearMock.mockResolvedValue({ ...current, wornAt: WORN_AT });

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-wear'));

    await waitFor(async () =>
      expect(await readStoredWornOutfit()).toEqual({
        userId: USER,
        day: today(),
        outfitId: 'wear-me',
      }),
    );
  });
});

describe('"Bunu giyiyorum": one tap', () => {
  it('marks the outfit worn once and settles the card without leaving Keşfet', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    const current = outfit({ id: 'wear-me', date: today() });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));
    wearMock.mockResolvedValue({ ...current, wornAt: WORN_AT });

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-wear'));

    await waitFor(() => expect(screen.getByText('Bugün giyiyorsun')).toBeTruthy());
    expect(wearMock).toHaveBeenCalledTimes(1);
    expect(wearMock).toHaveBeenCalledWith('wear-me');
    expect(track).toHaveBeenCalledWith('outfit_feedback', { action: 'Worn' });
    expect(router.push).not.toHaveBeenCalled();
    // Same figure, no actions but opening it, and the confirmation is not said twice.
    expect(screen.getByTestId('tomorrow-figure')).toBeTruthy();
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(screen.queryByTestId('home-card-shuffle')).toBeNull();
    expect(screen.queryByTestId('home-card-occasion')).toBeNull();
    expect(useToastStore.getState().message).toBeNull();
    // It stays settled after the request answers, and is remembered for the rest of the day.
    await waitFor(() =>
      expect(usePrefsStore.getState().homeCardWorn).toEqual({
        userId: USER,
        day: today(),
        outfitId: 'wear-me',
      }),
    );
    expect(screen.getByText('Bugün giyiyorsun')).toBeTruthy();
    // The worn outfit came back with the answer, so the settled card did not ask for it again.
    expect(screen.getByTestId('tomorrow-figure')).toBeTruthy();
    expect(getOutfitMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('home-card-open'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/[id]',
      params: { id: 'wear-me' },
    });
  });

  it('shows the settled state while the request is out', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    wearMock.mockReturnValue(heldOpen());

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-wear'));

    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    expect(usePrefsStore.getState().homeCardWorn).toBeNull();
  });

  it('puts the actions back and shows the usual error when the call fails', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    wearMock.mockRejectedValue(new Error('boom'));

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-wear'));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('İşlem yapılamadı, tekrar dene'),
    );
    expect(screen.getByTestId('home-card-wear')).toBeTruthy();
    expect(screen.getByTestId('home-card-shuffle')).toBeTruthy();
    expect(screen.getByText('Bugün için')).toBeTruthy();
    expect(usePrefsStore.getState().homeCardWorn).toBeNull();
  });

  it.each([
    ['NeedsOne', needsOneOutfit()],
    ['CatalogOnly', outfit({ completeness: 'CatalogOnly' })],
  ])('is not offered for a %s outfit: the primary action opens it', async (_name, current) => {
    freezeClockAt(MORNING);
    await signedInSession();
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));

    await renderWithQuery(<DailyCard />);
    const open = await screen.findByTestId('home-card-open');

    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(screen.queryByText('Dolabından hazır bir kombin')).toBeNull();
    await fireEvent.press(open);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'today', seed: '0' },
    });
    expect(wearMock).not.toHaveBeenCalled();
  });

  it('is not offered on tomorrow’s card: the actions are "Başka göster" and opening it', async () => {
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('home-card-open');
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(screen.getByTestId('home-card-shuffle')).toBeTruthy();
  });
});

describe('"Başka göster"', () => {
  it('asks for the next seed in place, keeps the old outfit until the new one arrives, and reports it', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    const first = outfit({ id: 'first' });
    // Two pieces instead of three, so the screen shows when the new outfit has replaced the old one.
    const second = outfit({ id: 'second', pieces: outfit().pieces.slice(0, 2) });
    let release: () => void = () => undefined;
    const later = new Promise<ReturnType<typeof dailyOutfit>>((resolve) => {
      release = () => resolve(dailyOutfit({ outfit: second, alternatives: [] }));
    });
    dailyMock.mockImplementation(async (query) =>
      query.seed === 0 ? dailyOutfit({ outfit: first, alternatives: [] }) : later,
    );
    wearMock.mockImplementation(async (id) => outfit({ id, wornAt: WORN_AT }));

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-shuffle'));

    // The old outfit and its actions stay on screen while the next one is on its way.
    expect(dailyMock.mock.calls.at(-1)?.[0]).toMatchObject({ date: 'today', seed: 1 });
    expect(screen.getByTestId('tomorrow-figure')).toBeTruthy();
    expect(screen.getByTestId('home-card-wear')).toBeTruthy();
    expect(feedbackMock).toHaveBeenCalledWith('first', { action: 'Shuffle', reason: null });
    expect(track).toHaveBeenCalledWith('outfit_shuffle', {});
    expect(track).toHaveBeenCalledWith('outfit_feedback', { action: 'Shuffle' });

    await act(async () => release());
    await waitFor(() =>
      expect(
        within(screen.getByTestId('tomorrow-figure')).getAllByTestId(/^figure-cell-/),
      ).toHaveLength(2),
    );
    await fireEvent.press(screen.getByTestId('home-card-wear'));
    await waitFor(() => expect(wearMock).toHaveBeenCalledWith('second'));
  });

  it('opens the daily screen on the shuffled seed', async () => {
    await signedInSession();
    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-shuffle'));
    await waitFor(() => expect(dailyMock.mock.calls.at(-1)?.[0]).toMatchObject({ seed: 1 }));

    await fireEvent.press(screen.getByTestId('home-card-title'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'tomorrow', seed: '1' },
    });
  });
});

describe('"Nereye?"', () => {
  it('sends no occasion by default and shows the one the backend used', async () => {
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('tomorrow-card');
    expect(dailyMock.mock.calls[0]?.[0].occasion).toBeUndefined();
    expect(within(screen.getByTestId('home-card-occasion')).getByText(/Ofis/)).toBeTruthy();
    expect(screen.getByLabelText('Nereye: Ofis. Değiştir')).toBeTruthy();
  });

  it('shows "Nereye?" alone when the response names no occasion', async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: outfit({ occasion: null }) }));
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('tomorrow-card');
    expect(screen.getByTestId('home-card-occasion')).toHaveTextContent(/^Nereye\?$/);
  });

  it('sends the chosen occasion from the plain ranking, carries it to the daily screen, and clears it', async () => {
    await signedInSession();
    await renderWithQuery(<DailyCard />);
    await screen.findByTestId('tomorrow-card');
    await fireEvent.press(screen.getByTestId('home-card-shuffle'));
    await waitFor(() => expect(dailyMock.mock.calls.at(-1)?.[0]).toMatchObject({ seed: 1 }));

    await fireEvent.press(screen.getByTestId('home-card-occasion'));
    expect(screen.getByText('Nereye gidiyorsun?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-occasion-sport'));

    await waitFor(() =>
      expect(dailyMock.mock.calls.at(-1)?.[0]).toEqual({
        date: 'tomorrow',
        occasion: 'sport',
        seed: 0,
      }),
    );
    expect(screen.getByTestId('home-card-occasion')).toHaveTextContent('Nereye? Spor');
    await fireEvent.press(screen.getByTestId('home-card-title'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'tomorrow', seed: '0', occasion: 'sport' },
    });

    await fireEvent.press(screen.getByTestId('home-card-occasion'));
    await fireEvent.press(screen.getByTestId('home-occasion-auto'));
    // Back to the backend's own pick (the plain query is still cached), and nothing is carried to the daily screen.
    await waitFor(() =>
      expect(screen.getByTestId('home-card-occasion')).toHaveTextContent('Nereye? Ofis'),
    );
    await fireEvent.press(screen.getByTestId('home-card-title'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'tomorrow', seed: '0' },
    });
  });
});

describe('first morning, empty wardrobe', () => {
  beforeEach(async () => {
    await signedInSession();
    statsMock.mockResolvedValue(wardrobeStats({ itemCount: 0 }));
  });

  it('adds photos at once through the multi-photo picker and goes to the wardrobe', async () => {
    const photos = [{ uri: 'file:///a.jpg', width: 800, height: 600 }];
    pickMock.mockResolvedValue(photos);
    await renderWithQuery(<DailyCard />);

    await fireEvent.press(await screen.findByTestId('home-empty-add'));

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    expect(addMock.mock.calls[0]?.[1]).toEqual(photos);
    expect(addMock.mock.calls[0]?.[2]).toBe('library');
    expect(router.navigate).toHaveBeenCalledWith('/wardrobe');
    expect(dailyMock).not.toHaveBeenCalled();
  });

  it('stays here when the picker is closed without a photo', async () => {
    pickMock.mockResolvedValue([]);
    await renderWithQuery(<DailyCard />);

    await fireEvent.press(await screen.findByTestId('home-empty-add'));

    await waitFor(() => expect(pickMock).toHaveBeenCalled());
    expect(addMock).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the daily screen for the shopping outfit', async () => {
    await renderWithQuery(<DailyCard />);

    await fireEvent.press(await screen.findByText('Mağazadan kombin gör'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'tomorrow', seed: '0' },
    });
    expect(screen.getByText('Dolabına 5 parça ekle, sana kombin hazırlayalım')).toBeTruthy();
  });
});

describe('the rest of the card', () => {
  it('asks for the outfit only once the wardrobe is known to have pieces', async () => {
    await signedInSession();
    let resolveStats: (value: ReturnType<typeof wardrobeStats>) => void = () => undefined;
    statsMock.mockReturnValue(new Promise((resolve) => (resolveStats = resolve)));

    await renderWithQuery(<DailyCard />);
    expect(screen.getByTestId('tomorrow-loading')).toBeTruthy();
    expect(dailyMock).not.toHaveBeenCalled();

    resolveStats(wardrobeStats({ itemCount: 3 }));
    await screen.findByTestId('tomorrow-card');
    expect(dailyMock).toHaveBeenCalledTimes(1);
  });

  it('shows the old prompt when the piece count never came', async () => {
    await signedInSession();
    statsMock.mockRejectedValue(new Error('down'));

    await renderWithQuery(<DailyCard />);

    expect(
      await screen.findByText('Dolabına 5 parça ekle, her gün sana kombin hazırlayalım'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tomorrow-add'));
    expect(router.navigate).toHaveBeenCalledWith('/wardrobe');
  });

  it('shows a visitor the prompt, without calling the backend', async () => {
    await renderWithQuery(<DailyCard />);

    expect(screen.getByTestId('tomorrow-prompt')).toBeTruthy();
    expect(
      screen.getByText('Dolabına 5 parça ekle, her gün sana kombin hazırlayalım'),
    ).toBeTruthy();
    expect(statsMock).not.toHaveBeenCalled();
    expect(dailyMock).not.toHaveBeenCalled();
  });

  it('says so when nothing wearable came out, and offers only to open the screen', async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: null, alternatives: [], weather: null }));

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByText('Kombin çıkmadı; birkaç parça daha ekle')).toBeTruthy();
    expect(screen.queryByTestId('tomorrow-figure')).toBeNull();
    expect(screen.queryByTestId('tomorrow-weather')).toBeNull();
    expect(screen.queryByTestId('home-card-shuffle')).toBeNull();
    expect(screen.getByTestId('home-card-open')).toBeTruthy();
  });

  it('gives every action a spoken name', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('home-card-wear');
    expect(screen.getByLabelText(/^Bunu giyiyorum/)).toBeTruthy();
    expect(screen.getByLabelText(/^Başka göster/)).toBeTruthy();
    expect(screen.getByLabelText(/^Nereye/)).toBeTruthy();
  });
});

describe('the card follows Istanbul time, not the phone', () => {
  // The phone is in Tokyo: 17:59 in Istanbul is 23:59 there, and 18:00 is already the next day's 00:00.
  it.each([
    ['17:59', '2026-11-02T14:59:00Z', 'Bugün için'],
    ['18:00', '2026-11-02T15:00:00Z', 'Yarın için'],
  ])('at %s Istanbul time it says "%s"', async (_clock, instant, label) => {
    freezeClockAt(instant);
    await signedInSession();

    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('tomorrow-card');
    expect(screen.getByText(label)).toBeTruthy();
    expect(dailyMock.mock.calls[0]?.[0]).toMatchObject({
      date: label === 'Bugün için' ? 'today' : 'tomorrow',
    });
  });

  it('is still the new day’s card at 00:30 Istanbul time', async () => {
    freezeClockAt('2026-11-02T21:30:00Z');
    await signedInSession();

    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('tomorrow-card');
    expect(screen.getByText('Bugün için')).toBeTruthy();
  });
});

describe('an outfit counts as worn today only when both its day and its wearing are today', () => {
  beforeEach(() => {
    freezeClockAt(MORNING);
  });

  it('is not settled by a wear mark from yesterday evening', async () => {
    await signedInSession();
    // 21:30 Istanbul time on the 1st: the outfit of today carries yesterday's wear mark.
    dailyMock.mockResolvedValue(
      dailyOutfit({ outfit: outfit({ wornAt: '2026-11-01T18:30:00Z' }), alternatives: [] }),
    );

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByTestId('home-card-wear')).toBeTruthy();
    expect(screen.queryByText('Bugün giyiyorsun')).toBeNull();
  });

  it('is not settled when the outfit is for another day, even if it was worn today', async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(
      dailyOutfit({
        outfit: outfit({ date: '2026-11-03', wornAt: '2026-11-02T05:00:00Z' }),
        alternatives: [],
      }),
    );

    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('home-card-open');
    expect(screen.queryByText('Bugün giyiyorsun')).toBeNull();
  });

  it('does not offer "Bunu giyiyorum" for an outfit whose day is not today', async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(
      dailyOutfit({ outfit: outfit({ date: '2026-11-03' }), alternatives: [] }),
    );

    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('home-card-open');
    expect(screen.queryByTestId('home-card-wear')).toBeNull();
    expect(wearMock).not.toHaveBeenCalled();
  });
});

describe('wearing during a shuffle', () => {
  beforeEach(() => {
    freezeClockAt(MORNING);
  });

  const first = () => outfit({ id: 'first', date: today() });
  // Two pieces instead of three, so the figure shows which outfit the card holds.
  const second = () => outfit({ id: 'second', date: today(), pieces: outfit().pieces.slice(0, 2) });
  const figureCells = () =>
    within(screen.getByTestId('tomorrow-figure')).getAllByTestId(/^figure-cell-/).length;

  it('turns both actions off while the next outfit is on its way', async () => {
    await signedInSession();
    dailyMock.mockImplementation(async (query) =>
      query.seed === 0 ? dailyOutfit({ outfit: first(), alternatives: [] }) : (heldOpen() as never),
    );

    await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-shuffle'));

    await waitFor(() => expect(dailyMock.mock.calls.at(-1)?.[0]).toMatchObject({ seed: 1 }));
    expect(screen.getByTestId('home-card-wear').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('home-card-shuffle').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('home-card-wear'));
    expect(wearMock).not.toHaveBeenCalled();
  });

  it('keeps the outfit that was tapped on the settled card while the request runs and after it answers', async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: first(), alternatives: [] }));
    let answer: (worn: ReturnType<typeof outfit>) => void = () => undefined;
    wearMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const { client } = await renderWithQuery(<DailyCard />);
    await fireEvent.press(await screen.findByTestId('home-card-wear'));
    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    expect(figureCells()).toBe(3);

    // The card's own daily query hands over a different outfit meanwhile (a refetch, a shuffle that landed).
    await act(async () => {
      client.setQueryData(
        queryKeys.dailyOutfit({ date: 'today', occasion: null, seed: 0 }),
        dailyOutfit({ outfit: second(), alternatives: [] }),
      );
    });
    expect(screen.getByText('Bugün giyiyorsun')).toBeTruthy();
    expect(figureCells()).toBe(3);

    await act(async () => answer({ ...first(), wornAt: WORN_AT }));
    await waitFor(() => expect(usePrefsStore.getState().homeCardWorn?.outfitId).toBe('first'));
    expect(screen.getByText('Bugün giyiyorsun')).toBeTruthy();
    expect(figureCells()).toBe(3);
    expect(wearMock).toHaveBeenCalledWith('first');
  });
});

describe('midnight with the card open', () => {
  it('keeps what was worn just after midnight, although the card still holds the evening’s clock', async () => {
    freezeClockAt('2026-11-02T14:30:00Z'); // 17:30 Istanbul time: still today's card
    await signedInSession();
    const current = outfit({ id: 'after-midnight', date: '2026-11-03' });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));
    getOutfitMock.mockResolvedValue({ ...current, wornAt: '2026-11-02T21:10:00Z' });

    await renderWithQuery(<DailyCard />);
    await screen.findByTestId('tomorrow-card');
    // 00:10 on the 3rd. The app never left the front, so the card's own "now" is still 17:30 on the 2nd.
    moveClockTo('2026-11-02T21:10:00Z');
    await act(async () => {
      usePrefsStore
        .getState()
        .markHomeCardWorn({ userId: USER, day: '2026-11-03', outfitId: 'after-midnight' });
    });

    expect(await screen.findByText('Bugün giyiyorsun')).toBeTruthy();
    expect(usePrefsStore.getState().homeCardWorn).toMatchObject({ outfitId: 'after-midnight' });
    await waitFor(async () =>
      expect(await readStoredWornOutfit()).toMatchObject({ outfitId: 'after-midnight' }),
    );
  });
});

describe('another account on the same phone', () => {
  it('never sees the previous account’s settled card', async () => {
    freezeClockAt(MORNING);
    await signedInSession();
    await writeStoredWornOutfit({ userId: 'someone-else', day: today(), outfitId: 'theirs' });
    usePrefsStore.setState({ homeCardWorn: null, homeCardWornLoaded: false });

    await renderWithQuery(<DailyCard />);

    expect(await screen.findByTestId('home-card-wear')).toBeTruthy();
    expect(screen.queryByText('Bugün giyiyorsun')).toBeNull();
    expect(getOutfitMock).not.toHaveBeenCalled();
    await waitFor(async () => expect(await readStoredWornOutfit()).toBeNull());
  });
});

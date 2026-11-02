import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';

import { track } from '@/analytics';
import {
  dismissOutfit,
  getDailyOutfit,
  recordOutfitFeedback,
  saveOutfit,
  wearOutfit,
} from '@/api/endpoints/outfits';
import { listPersonas } from '@/api/endpoints/profile';
import { useToastStore } from '@/components/toastStore';
import { DailyOutfitScreen } from '@/features/outfits/DailyOutfitScreen';

import { dailyOutfit, needsOneOutfit, outfit, outfitPiece, persona } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/profile');

const dailyMock = jest.mocked(getDailyOutfit);
const saveMock = jest.mocked(saveOutfit);
const wearMock = jest.mocked(wearOutfit);
const dismissMock = jest.mocked(dismissOutfit);
const feedbackMock = jest.mocked(recordOutfitFeedback);
const trackMock = jest.mocked(track);
const openBrowserMock = jest.mocked(WebBrowser.openBrowserAsync);

beforeEach(async () => {
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(listPersonas).mockResolvedValue({
    items: [persona({ id: 'pe1', name: 'Ofis', isActive: true })],
  });
  dailyMock.mockResolvedValue(dailyOutfit());
  feedbackMock.mockResolvedValue(outfit());
});

/** The header is there from the first render; the narration only once the outfit has loaded. */
const outfitLoaded = () => screen.findByTestId('outfit-narration');

describe('daily outfit logged out', () => {
  it('asks to sign in and loads nothing', async () => {
    await renderWithQuery(<DailyOutfitScreen />);

    expect(screen.getByText('Kombin için giriş yap')).toBeTruthy();
    expect(dailyMock).not.toHaveBeenCalled();
  });
});

describe('daily outfit with everything in the wardrobe (Complete)', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('shows the day and occasion, the persona with the weather, the pieces and the narration', async () => {
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();

    expect(screen.getByTestId('outfit-title').props.children).toBe('Pazartesi ofis');
    expect(screen.getByTestId('outfit-subtitle').props.children).toBe('Ofis · 9° yağmurlu');
    expect(screen.getByText('Koyu yeşil blazer')).toBeTruthy();
    expect(screen.getByText('Siyah kumaş pantolon')).toBeTruthy();
    // Every piece is from the wardrobe: the white pill, no gap pill.
    expect(within(screen.getByTestId('piece-pill-Top')).getByText('Dolabında')).toBeTruthy();
    expect(within(screen.getByTestId('piece-pill-Shoes')).getByText('Dolabında')).toBeTruthy();
    expect(screen.queryByText(/Eksik ·/)).toBeNull();
    expect(
      within(screen.getByTestId('outfit-narration')).getByText(
        'Koyu yeşil blazer yağmurlu havada şık durur.',
      ),
    ).toBeTruthy();
    expect(dailyMock.mock.calls[0]?.[0]).toEqual({ date: 'today', occasion: undefined, seed: 0 });
    expect(trackMock).toHaveBeenCalledWith('outfit_view', {
      kind: 'Daily',
      status: 'Complete',
      occasion: 'office',
    });
  });

  it('offers to save it and to mark it worn today', async () => {
    const current = outfit({ id: 'current' });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));
    saveMock.mockResolvedValue({ ...current, savedAt: '2026-11-02T09:00:00Z' });
    wearMock.mockResolvedValue({ ...current, wornAt: '2026-11-02T09:00:00Z' });
    await renderWithQuery(<DailyOutfitScreen />);

    await fireEvent.press(await screen.findByTestId('outfit-save'));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(trackMock).toHaveBeenCalledWith('outfit_feedback', { action: 'Save' });
    await waitFor(() =>
      expect(within(screen.getByTestId('outfit-save')).getByText('Kaydedildi')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByTestId('outfit-wear'));
    await waitFor(() => expect(wearMock).toHaveBeenCalledTimes(1));
    expect(trackMock).toHaveBeenCalledWith('outfit_feedback', { action: 'Worn' });
    await waitFor(() =>
      expect(within(screen.getByTestId('outfit-wear')).getByText('Bugün giydin')).toBeTruthy(),
    );
  });

  it('refetches with the chosen occasion, from seed 0', async () => {
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();

    await fireEvent.press(screen.getByTestId('occasion-evening'));

    await waitFor(() =>
      expect(dailyMock).toHaveBeenLastCalledWith(
        { date: 'today', occasion: 'evening', seed: 0 },
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('occasion-evening').props.accessibilityState.selected).toBe(true);
  });

  it('starts from the route params the home card passes: same date and seed', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: 'tomorrow', seed: '0' });
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();

    expect(dailyMock.mock.calls[0]?.[0]).toEqual({
      date: 'tomorrow',
      occasion: undefined,
      seed: 0,
    });
  });

  it('shuffles to the next seed, reports it, and steps back to the previous one', async () => {
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();
    expect(screen.queryByTestId('outfit-previous')).toBeNull();

    await fireEvent.press(screen.getByTestId('outfit-shuffle'));

    await waitFor(() =>
      expect(dailyMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ seed: 1 }),
        expect.anything(),
      ),
    );
    expect(trackMock).toHaveBeenCalledWith('outfit_shuffle', {});
    expect(trackMock).toHaveBeenCalledWith('outfit_feedback', { action: 'Shuffle' });
    expect(feedbackMock).toHaveBeenCalledWith(expect.any(String), {
      action: 'Shuffle',
      reason: null,
    });

    await fireEvent.press(await screen.findByTestId('outfit-previous'));
    // Seed 0 is still cached: no new request, and the back button is gone again.
    await waitFor(() => expect(screen.queryByTestId('outfit-previous')).toBeNull());
    expect(dailyMock.mock.calls.filter(([query]) => query.seed === 0)).toHaveLength(1);
  });

  it('asks why when closed, dismisses with the reason and shows the next alternative', async () => {
    const first = outfit({ id: 'first' });
    const second = outfit({
      id: 'second',
      occasion: 'Weekend',
      narration: { text: 'İkinci kombin.', provider: 'Template' },
    });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: first, alternatives: [second] }));
    dismissMock.mockResolvedValue(undefined);
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();

    await fireEvent.press(screen.getByTestId('outfit-close'));
    expect(await screen.findByText('Neden beğenmedin?')).toBeTruthy();
    for (const reason of ['DontLikeColors', 'TooFormal', 'TooCasual', 'WrongWeather']) {
      expect(screen.getByTestId(`dismiss-${reason}`)).toBeTruthy();
    }
    await fireEvent.press(screen.getByTestId('dismiss-TooFormal'));

    await waitFor(() => expect(dismissMock).toHaveBeenCalledWith('first', 'TooFormal'));
    expect(trackMock).toHaveBeenCalledWith('outfit_feedback', {
      action: 'Dismiss',
      reason: 'TooFormal',
    });
    // The next alternative is on screen.
    expect(await screen.findByText('İkinci kombin.')).toBeTruthy();
    expect((await screen.findByTestId('outfit-title')).props.children).toBe('Pazartesi hafta sonu');
  });

  it('closes without a reason from the sheet', async () => {
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();

    await fireEvent.press(screen.getByTestId('outfit-close'));
    await fireEvent.press(await screen.findByTestId('dismiss-close'));

    expect(dismissMock).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('says when every alternative has been dismissed', async () => {
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: outfit({ id: 'only' }), alternatives: [] }));
    dismissMock.mockResolvedValue(undefined);
    await renderWithQuery(<DailyOutfitScreen />);
    await outfitLoaded();

    await fireEvent.press(screen.getByTestId('outfit-close'));
    await fireEvent.press(await screen.findByTestId('dismiss-TooCasual'));

    expect(await screen.findByText('Başka kombin kalmadı')).toBeTruthy();
  });

  it('shows the message when nothing wearable could be built', async () => {
    dailyMock.mockResolvedValue(
      dailyOutfit({ outfit: null, alternatives: [], message: 'Bu gün için uygun kombin çıkmadı.' }),
    );
    await renderWithQuery(<DailyOutfitScreen />);

    expect(await screen.findByText('Bu gün için kombin çıkmadı')).toBeTruthy();
    expect(screen.getByText('Bu gün için uygun kombin çıkmadı.')).toBeTruthy();
  });

  it('shows an accessory as a small fifth tile', async () => {
    dailyMock.mockResolvedValue(
      dailyOutfit({
        outfit: outfit({
          pieces: [
            outfitPiece(),
            outfitPiece({ slot: 'Accessory', name: 'Deri kemer', wardrobeItemId: 'w7' }),
          ],
        }),
      }),
    );
    await renderWithQuery(<DailyOutfitScreen />);

    const accessory = await screen.findByTestId('piece-accessory');
    expect(within(accessory).getByText('Deri kemer')).toBeTruthy();
  });
});

describe('daily outfit that needs one piece (NeedsOne)', () => {
  beforeEach(async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: needsOneOutfit() }));
  });

  it('marks the gap piece with its price and cheapest seller, and totals the missing piece', async () => {
    await renderWithQuery(<DailyOutfitScreen />);

    expect(
      within(await screen.findByTestId('piece-pill-Top')).getByText('Eksik · 649 ₺'),
    ).toBeTruthy();
    expect(screen.getByText('En ucuzu Koton')).toBeTruthy();
    // The other pieces are still the user's own.
    expect(within(screen.getByTestId('piece-pill-Bottom')).getByText('Dolabında')).toBeTruthy();
    expect(screen.getByText('Eksik 1 parçayı tamamla')).toBeTruthy();
    expect(screen.getByTestId('outfit-price').props.children).toBe('649 ₺');
    expect(
      within(screen.getByTestId('outfit-gap-Top')).getByText('Koton · Bej boğazlı triko'),
    ).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith('outfit_view', {
      kind: 'Daily',
      status: 'NeedsOne',
      occasion: 'office',
    });
  });

  it('buys through the backend redirect with src=outfit and the persona', async () => {
    await renderWithQuery(<DailyOutfitScreen />);
    await screen.findByTestId('outfit-price');
    await waitFor(() => expect(listPersonasCalled()).toBe(true));

    await fireEvent.press(screen.getByTestId('outfit-buy'));

    expect(trackMock).toHaveBeenCalledWith('outfit_gap_click', {});
    expect(trackMock).toHaveBeenCalledWith('buy_click', { offerId: 'o-koton', source: 'outfit' });
    await waitFor(() =>
      expect(openBrowserMock).toHaveBeenCalledWith(
        'http://api.test/api/v1/go/o-koton?src=outfit&personaId=pe1',
      ),
    );
  });

  it('still offers to save it', async () => {
    const current = needsOneOutfit({ id: 'needs-one' });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: current, alternatives: [] }));
    saveMock.mockResolvedValue({ ...current, savedAt: '2026-11-02T09:00:00Z' });
    await renderWithQuery(<DailyOutfitScreen />);

    await fireEvent.press(await screen.findByTestId('outfit-save'));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('outfit-wear')).toBeNull();
  });
});

function listPersonasCalled() {
  return jest.mocked(listPersonas).mock.calls.length > 0;
}

describe('daily outfit with an empty wardrobe', () => {
  beforeEach(async () => {
    await signedInSession();
    const shopping = outfit({
      kind: 'Shopping',
      completeness: 'CatalogOnly',
      pieces: [
        outfitPiece({
          role: 'Gap',
          source: 'Catalog',
          wardrobeItemId: null,
          productId: 'sp1',
          offer: {
            offerId: 'o1',
            seller: { name: 'Koton', slug: 'koton' },
            price: 649,
            goPath: '/api/v1/go/o1',
          },
        }),
        outfitPiece({
          slot: 'Bottom',
          role: 'Gap',
          source: 'Catalog',
          wardrobeItemId: null,
          productId: 'sp2',
          name: 'Siyah pantolon',
          offer: {
            offerId: 'o2',
            seller: { name: 'Mavi', slug: 'mavi' },
            price: 899,
            goPath: '/api/v1/go/o2',
          },
        }),
      ],
      totalPrice: 1548,
    });
    dailyMock.mockResolvedValue(
      dailyOutfit({
        outfit: shopping,
        alternatives: [],
        wardrobeEmpty: true,
        message: 'Dolabın henüz boş: bunlar katalogdan alışveriş fikirleri.',
      }),
    );
  });

  it('explains, shows the store ideas with their total, and sends the user to fill the wardrobe', async () => {
    await renderWithQuery(<DailyOutfitScreen />);

    expect(
      await screen.findByText('Dolabın henüz boş: bunlar katalogdan alışveriş fikirleri.'),
    ).toBeTruthy();
    const shopping = screen.getByTestId('shopping-outfit');
    expect(within(shopping).getByText('Mağazadan')).toBeTruthy();
    expect(within(shopping).getByText('Toplam 1.548 ₺')).toBeTruthy();
    // Nothing is "missing" here: the pieces carry just their price.
    expect(within(screen.getByTestId('piece-pill-Top')).getByText('649 ₺')).toBeTruthy();
    expect(screen.queryByTestId('outfit-sheet')).toBeNull();

    await fireEvent.press(screen.getByTestId('outfit-fill-wardrobe'));
    expect(router.navigate).toHaveBeenCalledWith('/wardrobe');
  });

  it('closes straight away, without asking why', async () => {
    await renderWithQuery(<DailyOutfitScreen />);
    await screen.findByTestId('shopping-outfit');

    await fireEvent.press(screen.getByTestId('outfit-close'));

    expect(router.back).toHaveBeenCalled();
    expect(screen.queryByText('Neden beğenmedin?')).toBeNull();
  });
});

import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getProfile, listPersonas } from '@/api/endpoints/profile';
import { planTrip, replanTrip, saveTrip } from '@/api/endpoints/trips';
import { useToastStore } from '@/components/toastStore';
import { TripPlannerScreen } from '@/features/trips/TripPlannerScreen';

import { packItem, persona, profile, trip, tripDay, tripGap, tripPlan } from '../../fixtures';
import { heldOpen, renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/trips');
jest.mock('@/api/endpoints/profile');

const planMock = jest.mocked(planTrip);
const saveMock = jest.mocked(saveTrip);
const replanMock = jest.mocked(replanTrip);
const trackMock = jest.mocked(track);
const openBrowserMock = jest.mocked(WebBrowser.openBrowserAsync);

// Only the date is faked, so the picker shows November 2026 whatever day the suite runs; timers stay real.
beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date(2026, 10, 10, 12),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  jest.mocked(listPersonas).mockResolvedValue({
    items: [persona({ id: 'pe1', name: 'Ofis', isActive: true })],
  });
  jest.mocked(getProfile).mockResolvedValue(profile());
  planMock.mockResolvedValue(tripPlan());
});

afterEach(() => {
  jest.useRealTimers();
});

/** City and the three days of the default plan (12-14 November), then the button. */
async function fillAndPlan(city = 'Roma') {
  await fireEvent.changeText(await screen.findByTestId('trip-city'), city);
  await fireEvent.press(screen.getByTestId('trip-dates'));
  await fireEvent.press(await screen.findByTestId('trip-day-2026-11-12'));
  await fireEvent.press(screen.getByTestId('trip-day-2026-11-14'));
  await fireEvent.press(screen.getByTestId('trip-dates-done'));
  await fireEvent.press(screen.getByTestId('trip-submit'));
}

describe('Valiz hazırla, signed out', () => {
  it('shows the sign-in prompt and asks nothing', async () => {
    await renderWithQuery(<TripPlannerScreen />);

    expect(screen.getByText('Valiz için giriş yap')).toBeTruthy();
    expect(screen.queryByTestId('trip-city')).toBeNull();
    await fireEvent.press(screen.getByText('Giriş yap'));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(planMock).not.toHaveBeenCalled();
  });
});

describe('the form', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('is city, dates and one button: the rest has defaults', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    await waitFor(() => expect(planMock).toHaveBeenCalledTimes(1));
    expect(planMock.mock.calls[0]?.[0]).toEqual({
      city: 'Roma',
      startDate: '2026-11-12',
      endDate: '2026-11-14',
      occasions: null,
      maxPieces: 20,
      allowRepeatShoes: true,
      laundry: false,
      personaId: 'pe1',
    });
  });

  it('starts the city from the profile, and the user can change it', async () => {
    jest.mocked(getProfile).mockResolvedValue(profile({ city: 'İstanbul' }));
    await renderWithQuery(<TripPlannerScreen />);

    await waitFor(() => expect(screen.getByTestId('trip-city').props.value).toBe('İstanbul'));
    await fireEvent.changeText(screen.getByTestId('trip-city'), 'Roma');
    expect(screen.getByTestId('trip-city').props.value).toBe('Roma');
  });

  it('says what is missing next to the fields and sends nothing', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fireEvent.press(await screen.findByTestId('trip-submit'));

    expect(screen.getByText('Gideceğin şehri yaz')).toBeTruthy();
    expect(screen.getByTestId('trip-dates-error')).toHaveTextContent('Gidiş ve dönüş gününü seç');
    expect(planMock).not.toHaveBeenCalled();
  });

  it('shows the limits in the picker instead of failing: no past days, at most 14 days', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fireEvent.press(await screen.findByTestId('trip-dates'));

    expect(screen.getByText('En fazla 14 gün seçebilirsin.')).toBeTruthy();
    expect(screen.getByTestId('trip-month-title')).toHaveTextContent('Kasım 2026');
    expect(screen.getByTestId('trip-day-2026-11-09').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('trip-day-2026-11-10').props.accessibilityState.disabled).toBe(false);
    // "Done" waits for both ends.
    expect(screen.getByTestId('trip-dates-done').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('trip-day-2026-11-12'));
    expect(screen.getByTestId('trip-dates-hint')).toHaveTextContent(/Şimdi dönüş gününe dokun/);
    // The 14th day (25 November) is the last; the 15th is out.
    expect(screen.getByTestId('trip-day-2026-11-25').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('trip-day-2026-11-26').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('trip-day-2026-11-14'));
    expect(screen.getByTestId('trip-dates-hint')).toHaveTextContent('12 – 14 Kasım · 3 gün');
    expect(screen.getByTestId('trip-dates-done').props.accessibilityState.disabled).toBe(false);
  });

  it('sends a plan for one day and the piece limit and switches the user chose', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fireEvent.changeText(await screen.findByTestId('trip-city'), 'Roma');
    await fireEvent.press(screen.getByTestId('trip-dates'));
    await fireEvent.press(await screen.findByTestId('trip-day-2026-11-12'));
    await fireEvent.press(screen.getByTestId('trip-day-2026-11-14'));
    await fireEvent.press(screen.getByTestId('trip-dates-done'));

    expect(screen.getByTestId('trip-plans-toggle')).toHaveTextContent(
      /Her gün için ayrı seçebilirsin/,
    );
    await fireEvent.press(screen.getByTestId('trip-plans-toggle'));
    await fireEvent.press(screen.getByTestId('trip-plan-2026-11-13'));
    await fireEvent.press(await screen.findByTestId('option-evening'));
    expect(screen.getByTestId('trip-plans-toggle')).toHaveTextContent(/1 günde plan var/);
    expect(within(screen.getByTestId('trip-plan-2026-11-13')).getByText('Gece')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('trip-max-pieces-dec'));
    await fireEvent(screen.getByTestId('trip-repeat-shoes'), 'valueChange', false);
    await fireEvent(screen.getByTestId('trip-laundry'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('trip-submit'));

    await waitFor(() => expect(planMock).toHaveBeenCalledTimes(1));
    expect(planMock.mock.calls[0]?.[0]).toMatchObject({
      occasions: [{ date: '2026-11-13', occasion: 'evening' }],
      maxPieces: 19,
      allowRepeatShoes: false,
      laundry: true,
    });
  });

  it('says why it failed, and keeps the form so the button can be pressed again', async () => {
    planMock.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        errorCode: 'RateLimited',
        correlationId: 'c',
        retryAfterSeconds: 90,
      }),
    );
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    expect(await screen.findByTestId('trip-plan-error')).toHaveTextContent(
      'Çok fazla deneme yaptın. 2 dakika sonra tekrar dene.',
    );
    expect(screen.getByTestId('trip-city').props.value).toBe('Roma');

    planMock.mockRejectedValueOnce(new ApiError({ status: 0, correlationId: 'c' }));
    await fireEvent.press(screen.getByTestId('trip-submit'));
    expect(
      await screen.findByText('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'),
    ).toBeTruthy();
  });

  it('says it is working, in words', async () => {
    planMock.mockReturnValue(heldOpen());
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    expect(await screen.findByText('Valizin hazırlanıyor')).toBeTruthy();
  });
});

describe('the plan', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('says the coverage as a sentence and lists what to pack with the days each piece is worn', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    expect(await screen.findByTestId('trip-coverage')).toHaveTextContent("3 günün 2'si hazır");
    expect(screen.getByTestId('trip-title')).toHaveTextContent('Roma');
    expect(screen.getByTestId('trip-subtitle')).toHaveTextContent('20 – 22 Kasım · 3 gün');
    expect(screen.getByText('Üstler')).toBeTruthy();
    expect(screen.getByText('Altlar')).toBeTruthy();
    expect(within(screen.getByTestId('trip-pack-w1')).getByText('3 gün giyilir')).toBeTruthy();
    expect(within(screen.getByTestId('trip-pack-w2')).getByText('2 gün giyilir')).toBeTruthy();
    // The backend's partial message repeats the sentence, so it is not shown twice.
    expect(screen.queryByTestId('trip-note')).toBeNull();
    expect(trackMock).toHaveBeenCalledWith('trip_plan_create', {
      days: 3,
      pieceCount: 2,
      coveragePercent: 67,
      gapCount: 0,
    });
    expect(trackMock).toHaveBeenCalledWith('trip_plan_view', { days: 3, source: 'plan' });
  });

  it('shows the same plan day by day with the weather, and says so when a day has no outfit', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    await fireEvent.press(await screen.findByTestId('segment-days'));
    const first = screen.getByTestId('trip-day-2026-11-20');
    expect(within(first).getByText('Cuma, 20 Kasım')).toBeTruthy();
    expect(within(first).getByText('12° yağmurlu')).toBeTruthy();
    expect(within(first).getByText('Yağmurlu günde koyu tonlar rahat eder.')).toBeTruthy();
    // The day names its pieces; there is no picture-only figure to decode.
    expect(within(first).getByText('Koyu yeşil blazer')).toBeTruthy();
    expect(within(first).getByText('Siyah kumaş pantolon')).toBeTruthy();
    expect(screen.getByTestId('trip-day-empty-2026-11-22')).toHaveTextContent(
      'Bu gün için kombin çıkmadı',
    );
    expect(screen.queryByTestId('trip-pack')).toBeNull();

    await fireEvent.press(screen.getByTestId('segment-pack'));
    expect(screen.getByTestId('trip-pack')).toBeTruthy();
  });

  it('names every piece of a day in slot order, four pieces included, and marks a missing one', async () => {
    const piece = (
      slot: 'Top' | 'Bottom' | 'Outerwear' | 'Shoes',
      id: string,
      name: string,
      missing = false,
    ) => ({
      slot,
      wardrobeItemId: id,
      name,
      categorySlug: null,
      color: 'Black' as const,
      imageUrl: null,
      missing,
    });
    const day = tripDay('2026-11-20');
    planMock.mockResolvedValue(
      tripPlan({
        days: [
          {
            ...day,
            outfit: {
              ...day.outfit!,
              // Deliberately out of order: the screen sorts them.
              pieces: [
                piece('Shoes', 'w4', 'Kahverengi bot'),
                piece('Outerwear', 'w3', 'Yün palto', true),
                piece('Bottom', 'w2', 'Siyah pantolon'),
                piece('Top', 'w1', 'Bej kazak'),
              ],
            },
          },
        ],
      }),
    );
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    await fireEvent.press(await screen.findByTestId('segment-days'));
    const pieces = within(screen.getByTestId('trip-day-pieces-2026-11-20'));
    expect(
      pieces
        .getAllByText(/Bej kazak|Siyah pantolon|Yün palto|Kahverengi bot/)
        .map((n) => n.props.children),
    ).toEqual(['Bej kazak', 'Siyah pantolon', 'Yün palto', 'Kahverengi bot']);
    expect(screen.getByTestId('trip-day-missing-2026-11-20-w3')).toHaveTextContent('Dolabında yok');
    expect(screen.queryByTestId('trip-day-missing-2026-11-20-w1')).toBeNull();
  });

  it("explains a thin wardrobe with the backend's sentence", async () => {
    planMock.mockResolvedValue(
      tripPlan({
        coverage: { covered: 0, total: 3, percent: 0 },
        message: 'Dolabında bu gezi için yeterli parça yok.',
        pieces: [],
      }),
    );
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    expect(await screen.findByTestId('trip-coverage')).toHaveTextContent("3 günün 0'ı hazır");
    expect(screen.getByTestId('trip-note')).toHaveTextContent(
      'Dolabında bu gezi için yeterli parça yok.',
    );
  });

  it('shows each gap with the product, price and seller, and buys through its goPath', async () => {
    planMock.mockResolvedValue(tripPlan({ gaps: [tripGap()] }));
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    const gap = await screen.findByTestId('trip-gap-Shoes');
    expect(within(gap).getByText('Dolabında hiç ayakkabı yok.')).toBeTruthy();
    expect(within(gap).getByText('Siyah deri bot')).toBeTruthy();
    expect(within(gap).getByText('Hepsiburada · 1.899 ₺')).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith(
      'trip_plan_create',
      expect.objectContaining({ gapCount: 1 }),
    );

    // A 52-point button: well over the 44-point minimum.
    expect(
      StyleSheet.flatten(screen.getByTestId('trip-gap-buy-Shoes').props.style).height,
    ).toBeGreaterThanOrEqual(44);
    await fireEvent.press(screen.getByTestId('trip-gap-buy-Shoes'));
    expect(trackMock).toHaveBeenCalledWith('trip_gap_click', { slot: 'Shoes' });
    await waitFor(() => expect(openBrowserMock).toHaveBeenCalledTimes(1));
    // The path already carries `src=trip`; the app adds nothing and builds no seller URL.
    expect(openBrowserMock).toHaveBeenCalledWith('http://api.test/api/v1/go/o-tp1?src=trip');
    expect(trackMock).toHaveBeenCalledWith('buy_click', { offerId: 'o-tp1', source: 'trip' });
  });

  it('shows a gap without a suggestion as one sentence, no buy button', async () => {
    planMock.mockResolvedValue(tripPlan({ gaps: [tripGap({ suggestion: null })] }));
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    expect(await screen.findByText('Dolabında hiç ayakkabı yok.')).toBeTruthy();
    expect(screen.queryByTestId('trip-gap-buy-Shoes')).toBeNull();
  });

  it('marks a piece that left the wardrobe and plans again on request', async () => {
    planMock.mockResolvedValueOnce(
      tripPlan({
        pieces: [{ slot: 'Top', items: [packItem({ missing: true, days: 2 })] }],
      }),
    );
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    expect(await screen.findByTestId('trip-missing-w1')).toHaveTextContent('Dolabında yok');
    expect(screen.queryByText('2 gün giyilir')).toBeNull();
    expect(screen.getByTestId('trip-missing-banner')).toHaveTextContent(
      /Bazı parçalar artık dolabında yok./,
    );

    await fireEvent.press(screen.getByTestId('trip-replan'));
    await waitFor(() => expect(planMock).toHaveBeenCalledTimes(2));
    expect(planMock.mock.calls[1]?.[0]).toEqual(planMock.mock.calls[0]?.[0]);
    await waitFor(() => expect(screen.queryByTestId('trip-missing-banner')).toBeNull());
    expect(useToastStore.getState().message).toBe('Valiz yeniden planlandı');
  });
});

describe('saving', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('asks for a name, saves the request and then reads "Kaydedildi"', async () => {
    saveMock.mockResolvedValue(trip({ id: 'tr9' }));
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    await fireEvent.press(await screen.findByTestId('trip-save'));
    expect(screen.getByTestId('trip-name').props.value).toBe('Roma gezisi');
    await fireEvent.changeText(screen.getByTestId('trip-name'), 'Roma, kasım');
    await fireEvent.press(screen.getByTestId('trip-save-confirm'));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0]?.[0]).toMatchObject({
      name: 'Roma, kasım',
      request: { city: 'Roma', startDate: '2026-11-12', endDate: '2026-11-14' },
    });
    await waitFor(() => expect(useToastStore.getState().message).toBe('Valiz kaydedildi'));
    expect(within(screen.getByTestId('trip-save')).getByText('Kaydedildi')).toBeTruthy();
  });

  it('wants a name', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    await fireEvent.press(await screen.findByTestId('trip-save'));
    await fireEvent.changeText(screen.getByTestId('trip-name'), '   ');
    await fireEvent.press(screen.getByTestId('trip-save-confirm'));

    expect(screen.getByText('Bir ad yaz')).toBeTruthy();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('says the limit as a sentence and points at the saved trips', async () => {
    saveMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Recommendation.TooManyTrips', correlationId: 'c' }),
    );
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();

    await fireEvent.press(await screen.findByTestId('trip-save'));
    await fireEvent.press(screen.getByTestId('trip-save-confirm'));

    expect(await screen.findByTestId('trip-save-error')).toHaveTextContent(
      'En fazla 50 valiz kaydedebilirsin. Birini silip tekrar dene.',
    );
    await fireEvent.press(screen.getByTestId('trip-save-open-list'));
    expect(router.push).toHaveBeenCalledWith('/trips/saved');
  });

  it('plans a saved trip through its own endpoint, and says so when the trip is over', async () => {
    saveMock.mockResolvedValue(trip({ id: 'tr9' }));
    planMock.mockResolvedValue(
      tripPlan({ pieces: [{ slot: 'Top', items: [packItem({ missing: true })] }] }),
    );
    replanMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Recommendation.TripOver', correlationId: 'c' }),
    );
    await renderWithQuery(<TripPlannerScreen />);
    await fillAndPlan();
    await fireEvent.press(await screen.findByTestId('trip-save'));
    await fireEvent.press(screen.getByTestId('trip-save-confirm'));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(screen.getByTestId('trip-save')).getByText('Kaydedildi')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByTestId('trip-replan'));

    await waitFor(() => expect(replanMock).toHaveBeenCalledWith('tr9'));
    expect(await screen.findByTestId('trip-replan-error')).toHaveTextContent(
      'Bu gezi bitti, yeniden planlanamaz.',
    );
    expect(planMock).toHaveBeenCalledTimes(1);
  });

  it('opens the saved trips from the form', async () => {
    await renderWithQuery(<TripPlannerScreen />);
    await fireEvent.press(await screen.findByTestId('trip-saved-link'));
    expect(router.push).toHaveBeenCalledWith('/trips/saved');
  });
});

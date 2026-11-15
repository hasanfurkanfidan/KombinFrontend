import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { deleteTrip, getTrip, listTrips, replanTrip } from '@/api/endpoints/trips';
import { useToastStore } from '@/components/toastStore';
import { SavedTripScreen } from '@/features/trips/SavedTripScreen';
import { SavedTripsScreen } from '@/features/trips/SavedTripsScreen';

import { packItem, trip, tripPlan, tripSummary } from '../../fixtures';
import { heldOpen, renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/trips');

const listMock = jest.mocked(listTrips);
const getMock = jest.mocked(getTrip);
const deleteMock = jest.mocked(deleteTrip);
const replanMock = jest.mocked(replanTrip);
const trackMock = jest.mocked(track);

// Only the date is faked (see TripPlannerScreen.test): the trips below start on 20 November 2026.
function fakeToday(date: Date) {
  jest.useFakeTimers({
    now: date,
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
}

beforeEach(async () => {
  fakeToday(new Date(2026, 10, 10, 12));
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('saved trips', () => {
  it('asks a visitor to sign in and loads nothing', async () => {
    await renderWithQuery(<SavedTripsScreen />);

    expect(screen.getByText('Valiz için giriş yap')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('lists each trip with its dates, coverage and pieces, and opens one', async () => {
    await signedInSession();
    listMock.mockResolvedValue({
      items: [
        tripSummary(),
        tripSummary({
          id: 'tr2',
          name: 'Paris',
          city: 'Paris',
          coverage: { covered: 6, total: 7, percent: 86 },
        }),
      ],
    });
    await renderWithQuery(<SavedTripsScreen />);

    const row = await screen.findByTestId('trip-row-tr1');
    expect(within(row).getByText('Roma gezisi')).toBeTruthy();
    expect(within(row).getByText('Roma · 20 – 22 Kasım')).toBeTruthy();
    expect(within(row).getByText("3 günün 2'si hazır · 2 parça")).toBeTruthy();
    expect(
      within(screen.getByTestId('trip-row-tr2')).getByText("7 günün 6'sı hazır · 2 parça"),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('trip-open-tr2'));
    expect(router.push).toHaveBeenCalledWith('/trips/tr2');
  });

  it('says what to do when there are none', async () => {
    await signedInSession();
    listMock.mockResolvedValue({ items: [] });
    await renderWithQuery(<SavedTripsScreen />);

    expect(await screen.findByText('Kayıtlı valizin yok')).toBeTruthy();
    await fireEvent.press(screen.getByText('Valiz hazırla'));
    expect(router.replace).toHaveBeenCalledWith('/trips');
  });

  it('says it is loading, in words', async () => {
    await signedInSession();
    listMock.mockReturnValue(heldOpen());
    await renderWithQuery(<SavedTripsScreen />);

    expect(await screen.findByText('Valizin hazırlanıyor')).toBeTruthy();
  });

  it('says when it could not load, and offers to try again', async () => {
    await signedInSession();
    listMock.mockRejectedValue(new ApiError({ status: 0, correlationId: 'c' }));
    await renderWithQuery(<SavedTripsScreen />);

    expect(await screen.findByText('Valizlerin yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('deletes only after a confirmation that says it cannot be undone', async () => {
    await signedInSession();
    listMock.mockResolvedValueOnce({
      items: [tripSummary(), tripSummary({ id: 'tr2', name: 'Paris' })],
    });
    listMock.mockResolvedValue({ items: [tripSummary({ id: 'tr2', name: 'Paris' })] });
    deleteMock.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithQuery(<SavedTripsScreen />);

    await fireEvent.press(await screen.findByTestId('trip-delete-tr1'));
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alert.mock.calls[0]!;
    expect(title).toBe('Valiz silinsin mi?');
    expect(body).toBe('"Roma gezisi" kalıcı olarak silinecek. Bu işlem geri alınamaz.');
    // Declined: nothing is sent.
    expect(deleteMock).not.toHaveBeenCalled();

    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('tr1'));
    await waitFor(() => expect(screen.queryByTestId('trip-row-tr1')).toBeNull());
    expect(screen.getByTestId('trip-row-tr2')).toBeTruthy();
    expect(useToastStore.getState().message).toBe('Valiz silindi');
    alert.mockRestore();
  });

  it('names the failure when deleting does not work, and keeps the row', async () => {
    await signedInSession();
    listMock.mockResolvedValue({ items: [tripSummary()] });
    deleteMock.mockRejectedValue(new ApiError({ status: 500, correlationId: 'c' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderWithQuery(<SavedTripsScreen />);

    await fireEvent.press(await screen.findByTestId('trip-delete-tr1'));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Valiz silinemedi, tekrar dene'),
    );
    expect(screen.getByTestId('trip-row-tr1')).toBeTruthy();
    alert.mockRestore();
  });
});

describe('one saved trip', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('opens the same two views, counts the view once as "saved" and says when it was planned', async () => {
    getMock.mockResolvedValue(trip());
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    expect(await screen.findByTestId('trip-coverage')).toHaveTextContent("3 günün 2'si hazır");
    expect(screen.getByTestId('trip-title')).toHaveTextContent('Roma gezisi');
    expect(screen.getByTestId('trip-subtitle')).toHaveTextContent('Roma · 20 – 22 Kasım · 3 gün');
    expect(screen.getByText('Son planlama: 15 Kasım 2026')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('segment-days'));
    expect(screen.getByTestId('trip-day-2026-11-20')).toBeTruthy();
    expect(trackMock.mock.calls.filter(([name]) => name === 'trip_plan_view')).toEqual([
      ['trip_plan_view', { days: 3, source: 'saved' }],
    ]);
    expect(getMock).toHaveBeenCalledWith('tr1', expect.anything());
  });

  it('marks a piece that left the wardrobe and plans the saved trip again', async () => {
    getMock.mockResolvedValue(
      trip({ plan: tripPlan({ pieces: [{ slot: 'Top', items: [packItem({ missing: true })] }] }) }),
    );
    replanMock.mockResolvedValue(trip({ plannedAt: '2026-11-16T09:00:00Z' }));
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    expect(await screen.findByTestId('trip-missing-w1')).toHaveTextContent('Dolabında yok');
    await fireEvent.press(screen.getByTestId('trip-replan'));

    await waitFor(() => expect(replanMock).toHaveBeenCalledWith('tr1'));
    await waitFor(() => expect(screen.queryByTestId('trip-missing-banner')).toBeNull());
    expect(screen.getByText('Son planlama: 16 Kasım 2026')).toBeTruthy();
    expect(useToastStore.getState().message).toBe('Valiz yeniden planlandı');
  });

  it('does not offer to plan again once the trip is over, and says why', async () => {
    fakeToday(new Date(2026, 11, 1, 12));
    getMock.mockResolvedValue(
      trip({ plan: tripPlan({ pieces: [{ slot: 'Top', items: [packItem({ missing: true })] }] }) }),
    );
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    expect(await screen.findByTestId('trip-over')).toHaveTextContent(
      'Bu gezi bitti, yeniden planlanamaz.',
    );
    expect(screen.queryByTestId('trip-replan')).toBeNull();
  });

  it('says it when the backend refuses a replan of a trip that just ended', async () => {
    getMock.mockResolvedValue(
      trip({ plan: tripPlan({ pieces: [{ slot: 'Top', items: [packItem({ missing: true })] }] }) }),
    );
    replanMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Recommendation.TripOver', correlationId: 'c' }),
    );
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    await fireEvent.press(await screen.findByTestId('trip-replan'));

    expect(await screen.findByTestId('trip-replan-error')).toHaveTextContent(
      'Bu gezi bitti, yeniden planlanamaz.',
    );
  });

  it('deletes after a confirmation and goes back', async () => {
    getMock.mockResolvedValue(trip());
    deleteMock.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    await fireEvent.press(await screen.findByTestId('trip-delete'));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('tr1'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useToastStore.getState().message).toBe('Valiz silindi');
    alert.mockRestore();
  });

  it('says a trip is gone on a 404, with a way to the list', async () => {
    getMock.mockRejectedValue(
      new ApiError({ status: 404, errorCode: 'Recommendation.TripNotFound', correlationId: 'c' }),
    );
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    expect(await screen.findByText('Bu valiz bulunamadı')).toBeTruthy();
    await fireEvent.press(screen.getByText('Kayıtlı valizler'));
    expect(router.replace).toHaveBeenCalledWith('/trips/saved');
  });

  it('retries a failed load', async () => {
    getMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    getMock.mockResolvedValue(trip());
    await renderWithQuery(<SavedTripScreen id="tr1" />);

    expect(await screen.findByText('Valiz yüklenemedi')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(await screen.findByTestId('trip-coverage')).toBeTruthy();
  });
});

import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@/api/client';
import { getLeagueMe, getLeagueResults } from '@/api/endpoints/league';
import ResultsRoute from '../../../app/league/results';
import { ResultsScreen } from '@/features/league/ResultsScreen';

import { freezeClockAt, unfreezeClock } from '../../support/fakeClock';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { DAY_CLOSE, leagueMe, results, todayWith } from './fixtures';

const resultsMock = jest.mocked(getLeagueResults);
const meMock = jest.mocked(getLeagueMe);

beforeEach(async () => {
  [resultsMock, meMock].forEach((mock) => mock.mockReset());
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  meMock.mockResolvedValue(leagueMe());
  resultsMock.mockResolvedValue(results());
  freezeClockAt('2026-11-05T10:00:00Z');
});

afterEach(() => unfreezeClock());

describe('a ranked day (design 04)', () => {
  it('shows the big rank, the field, the comparisons, the figure and the points', async () => {
    await renderWithQuery(<ResultsScreen day={null} />);

    const rank = await screen.findByTestId('results-rank');
    expect(within(rank).getByText('12.')).toBeTruthy();
    expect(within(rank).getByText('86 kombin arasında')).toBeTruthy();
    expect(within(rank).getByText('Kombinin 22 kez karşılaştırıldı')).toBeTruthy();
    expect(rank.props.accessibilityLabel).toBe(
      '12. sıradasın, 86 kombin arasında. Kombinin 22 kez karşılaştırıldı',
    );
    expect(screen.getByTestId('results-figure')).toBeTruthy();
    expect(screen.getByText('Pazartesi sonuçları')).toBeTruthy();

    expect(within(screen.getByTestId('points-votes')).getByText('61')).toBeTruthy();
    expect(screen.getByText('Sıralamana göre, en çok 70')).toBeTruthy();
    expect(within(screen.getByTestId('points-voting')).getByText('15')).toBeTruthy();
    expect(screen.getByText('On çifte oy verdin')).toBeTruthy();
    expect(within(screen.getByTestId('points-worn')).getByText('10')).toBeTruthy();
    expect(screen.getByText('Kombinini giydin')).toBeTruthy();
    // Nothing added to the wardrobe: muted, with what it would have earned.
    expect(screen.getByText('Dolaba parça eklemedin')).toBeTruthy();
    expect(screen.getByText('Eklersen 5 puan')).toBeTruthy();
    expect(within(screen.getByTestId('points-total')).getByText('Günlük puanın')).toBeTruthy();
    expect(screen.getByTestId('points-total-value')).toHaveTextContent('86');
  });

  it('adds the week line from `week`: the league, the place, the gap to promotion, the time left', async () => {
    await renderWithQuery(<ResultsScreen day={null} />);

    const week = await screen.findByTestId('results-week');
    expect(within(week).getByText('Altın ligde 7. sıradasın')).toBeTruthy();
    expect(within(week).getByText('Yükselmeye 17 puan kaldı · 3 gün kaldı')).toBeTruthy();
  });

  it('leaves the week line out for a player who was in no group, and the gap inside the promotion band', async () => {
    resultsMock.mockResolvedValue(results({ week: null }));
    await renderWithQuery(<ResultsScreen day={null} />);
    await screen.findByTestId('results-ranked');
    expect(screen.queryByTestId('results-week')).toBeNull();
  });

  it('says what a piece earned when one was added, and hides the hint when the cap is reached', async () => {
    resultsMock.mockResolvedValue(
      results({
        points: { votes: 61, voting: 0, worn: 0, pieces: 5, total: 66 },
        piecePointsAvailable: false,
      }),
    );
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Dolaba parça ekledin')).toBeTruthy();
    expect(screen.getByText('On çifte oy vermedin')).toBeTruthy();
    expect(screen.getByText('Kombinini giymedin')).toBeTruthy();
    expect(screen.queryByText('Eklersen 5 puan')).toBeNull();
  });

  it('opens the table from "Lig tablosunu gör"', async () => {
    await renderWithQuery(<ResultsScreen day={null} />);

    await fireEvent.press(await screen.findByTestId('results-table'));
    expect(router.push).toHaveBeenCalledWith('/league');
  });
});

describe('the other days', () => {
  it('not ranked: "Yeterli oy toplanamadı", the usage points, and no rank', async () => {
    resultsMock.mockResolvedValue(
      results({
        ranked: false,
        rank: null,
        comparisons: 5,
        points: { votes: 0, voting: 15, worn: 10, pieces: 0, total: 25 },
      }),
    );
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Yeterli oy toplanamadı')).toBeTruthy();
    expect(screen.getByText(/sıralamaya girecek kadar karşılaştırılmadı/)).toBeTruthy();
    expect(screen.queryByTestId('results-rank')).toBeNull();
    expect(screen.getByTestId('points-total-value')).toHaveTextContent('25');
    expect(screen.getByTestId('results-figure')).toBeTruthy();
  });

  it('did not compete: the usage points and how to take part tomorrow', async () => {
    resultsMock.mockResolvedValue(
      results({
        competed: false,
        ranked: false,
        rank: null,
        entry: null,
        comparisons: 0,
        points: { votes: 0, voting: 15, worn: 0, pieces: 0, total: 15 },
      }),
    );
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Kombinin yarışmadı')).toBeTruthy();
    expect(
      screen.getByText(
        "Yarın 21:00'den önce kombinini “Bunu giyiyorum” diye işaretle; kendiliğinden yarışır.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('results-figure')).toBeNull();
    // No outfit, no vote points to show.
    expect(screen.queryByTestId('points-votes')).toBeNull();
    expect(screen.getByTestId('points-total-value')).toHaveTextContent('15');
  });

  it('under review: the server’s message, no rank and no vote points', async () => {
    const message = 'Kombinin inceleniyor. Sonuç inceleme bitince görünecek.';
    resultsMock.mockResolvedValue(
      results({
        status: 'UnderReview',
        message,
        ranked: null,
        rank: null,
        points: { votes: null, voting: 15, worn: 10, pieces: 0, total: 25 },
      }),
    );
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByTestId('results-rank')).toBeNull();
    expect(screen.queryByTestId('points-votes')).toBeNull();
    expect(screen.getByTestId('points-total-value')).toHaveTextContent('25');
  });

  it('removed after a review: a sentence of ours when the server sent none, and no vote points', async () => {
    resultsMock.mockResolvedValue(
      results({
        status: 'Removed',
        message: null,
        ranked: false,
        rank: null,
        points: { votes: 0, voting: 15, worn: 10, pieces: 0, total: 25 },
      }),
    );
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(
      await screen.findByText('Kombin incelemeden sonra yarıştan çıkarıldı, oy puanı verilmedi.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('results-rank')).toBeNull();
    expect(screen.queryByTestId('points-votes')).toBeNull();
  });

  it('removed with a message from the server: the server’s message', async () => {
    resultsMock.mockResolvedValue(
      results({ status: 'Removed', message: 'Sunucunun cümlesi.', ranked: false, rank: null }),
    );
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Sunucunun cümlesi.')).toBeTruthy();
  });
});

describe('no result yet', () => {
  beforeEach(() => {
    resultsMock.mockResolvedValue(null);
  });

  it('says when results come, before the closing time', async () => {
    freezeClockAt('2026-11-02T10:00:00Z');
    meMock.mockResolvedValue(leagueMe({ today: todayWith({ closesAt: DAY_CLOSE }) }));
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Sonuç henüz yok')).toBeTruthy();
    expect(screen.getByText('Sonuçlar her akşam saat 21:00 sonrası açıklanır.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('results-back'));
    expect(router.replace).toHaveBeenCalledWith('/league');
  });

  it('says they are being prepared after the closing time, and can refresh', async () => {
    freezeClockAt('2026-11-02T18:02:00Z');
    meMock.mockResolvedValue(leagueMe({ today: todayWith({ closesAt: DAY_CLOSE }) }));
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Sonuçlar hazırlanıyor')).toBeTruthy();
    resultsMock.mockResolvedValue(results());
    await fireEvent.press(screen.getByTestId('results-refresh'));
    expect(await screen.findByTestId('results-ranked')).toBeTruthy();
  });

  it('shows an error with a retry when the result cannot be loaded', async () => {
    resultsMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    resultsMock.mockResolvedValueOnce(results());
    await renderWithQuery(<ResultsScreen day={null} />);

    expect(await screen.findByText('Bir şeyler ters gitti')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('results-retry'));
    expect(await screen.findByTestId('results-ranked')).toBeTruthy();
  });
});

describe('the deep link (kombin://league/results?day=…)', () => {
  const params = jest.mocked(useLocalSearchParams);

  it('asks for the day that the link names', async () => {
    params.mockReturnValue({ day: '2026-11-02' });
    await renderWithQuery(<ResultsRoute />);

    await screen.findByTestId('results-ranked');
    expect(resultsMock).toHaveBeenCalledWith('2026-11-02', expect.anything());
  });

  it('asks for the latest result when there is no day, or the day is not a real date', async () => {
    params.mockReturnValue({ day: '2026-02-31' });
    await renderWithQuery(<ResultsRoute />);

    await waitFor(() => expect(resultsMock).toHaveBeenCalled());
    expect(resultsMock.mock.calls[0]?.[0]).toBeNull();
  });

  it('opens the latest result for the bare screen', async () => {
    await renderWithQuery(<ResultsScreen day={null} />);

    await screen.findByTestId('results-ranked');
    expect(resultsMock.mock.calls[0]?.[0]).toBeNull();
  });
});

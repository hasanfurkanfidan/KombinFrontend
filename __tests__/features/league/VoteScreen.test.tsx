import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getLeagueMe, getNextPair, reportPair, voteOnPair } from '@/api/endpoints/league';
import type { LeagueVoteResult } from '@/api/models';
import { useToastStore } from '@/components/toastStore';
import { VoteScreen } from '@/features/league/VoteScreen';

import { freezeClockAt, moveClockTo, unfreezeClock } from '../../support/fakeClock';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { leagueMe, nextPair, NEXT_PAIR_ID, PAIR_ID, piece, voteResult } from './fixtures';

const meMock = jest.mocked(getLeagueMe);
const pairMock = jest.mocked(getNextPair);
const voteMock = jest.mocked(voteOnPair);
const reportMock = jest.mocked(reportPair);

const NOW = '2026-11-02T10:00:00Z';

/** What `expo-image` hands its `onLoad` / `onError` (a fresh object each time: it defines a property on it). */
const imageLoaded = () => ({
  nativeEvent: { cacheType: 'none', source: { url: 'x', width: 1, height: 1 } },
});
const imageFailed = () => ({ nativeEvent: { error: 'failed' } });

/** Both figures on screen: every picture has loaded. */
async function settleImages() {
  for (const image of screen.getAllByTestId(/^piece-image-/)) {
    await fireEvent(image, 'load', imageLoaded());
  }
}

async function showPair() {
  await renderWithQuery(<VoteScreen />);
  await screen.findByTestId('vote-board');
  await settleImages();
}

function apiError(status: number, errorCode: string) {
  return new ApiError({ status, errorCode, correlationId: 'x' });
}

beforeEach(async () => {
  // A queued `...Once` answer of one test must never reach the next.
  [meMock, pairMock, voteMock, reportMock].forEach((mock) => mock.mockReset());
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  meMock.mockResolvedValue(leagueMe());
  pairMock.mockResolvedValue(nextPair());
  voteMock.mockResolvedValue(voteResult());
  reportMock.mockResolvedValue({ reported: true });
});

afterEach(() => unfreezeClock());

describe('the pair', () => {
  it('shows two standing figures, the header, the progress and the countdown', async () => {
    freezeClockAt(NOW);
    pairMock.mockResolvedValue(nextPair({ closesAt: '2026-11-02T12:14:30Z' }));
    await showPair();

    expect(screen.getByText('Hangisi daha iyi?')).toBeTruthy();
    expect(screen.getByTestId('figure-left')).toBeTruthy();
    expect(screen.getByTestId('figure-right')).toBeTruthy();
    expect(screen.getByTestId('vote-left').props.accessibilityLabel).toBe(
      'Soldaki kombini seç. Parçalar: Üst, Alt, Ayakkabı',
    );
    expect(await screen.findByText('Altın lig · 7. sıradasın')).toBeTruthy();
    expect(screen.getByTestId('vote-count')).toHaveTextContent('3/10 oy');
    expect(screen.getByTestId('vote-progress').props.accessibilityValue).toMatchObject({
      min: 0,
      max: 10,
      now: 3,
    });
    expect(screen.getByTestId('vote-countdown').props.accessibilityLabel).toBe(
      'Sonuçlara 2 sa 14 dk',
    );
    expect(screen.getByText('Karar veremedim')).toBeTruthy();
  });

  it('draws each outfit from its slots with the slot’s picture, and a slot’s placeholder when it has none', async () => {
    const piece = (slot: 'Top' | 'Bottom' | 'Shoes', imageUrl: string | null) => ({
      slot,
      imageUrl,
    });
    const base = nextPair();
    pairMock.mockResolvedValue({
      ...base,
      pair: {
        id: PAIR_ID,
        sequence: 1,
        left: { pieces: [piece('Top', 'https://img.test/a.jpg'), piece('Bottom', null)] },
        right: { pieces: [piece('Top', 'https://img.test/b.jpg')] },
      },
    });
    await renderWithQuery(<VoteScreen />);
    await screen.findByTestId('vote-board');

    // Two pictures to load, and a placeholder where the image is missing.
    expect(screen.getAllByTestId(/^piece-image-/)).toHaveLength(2);
    const left = within(screen.getByTestId('figure-left'));
    expect(left.getAllByTestId(/^piece-(Top|Bottom|Shoes|Outerwear|Accessory)$/)).toHaveLength(2);
  });
});

describe('voting', () => {
  it('sends the side and the time from the moment both figures were fully displayed', async () => {
    freezeClockAt(NOW);
    await renderWithQuery(<VoteScreen />);
    await screen.findByTestId('vote-board');

    // Time passes while the pictures load: it is not the player's deciding time.
    moveClockTo('2026-11-02T10:00:02Z');
    await settleImages();
    moveClockTo('2026-11-02T10:00:02.700Z');
    await fireEvent.press(screen.getByTestId('vote-right'));

    await waitFor(() => expect(voteMock).toHaveBeenCalledTimes(1));
    expect(voteMock).toHaveBeenCalledWith(PAIR_ID, { choice: 'right', decisionMs: 700 });
  });

  it('opens the votes only when every picture has loaded', async () => {
    await renderWithQuery(<VoteScreen />);
    await screen.findByTestId('vote-board');

    await fireEvent.press(screen.getByTestId('vote-left'));
    expect(voteMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('vote-left').props.accessibilityState.disabled).toBe(true);

    const images = screen.getAllByTestId(/^piece-image-/);
    for (const image of images.slice(0, -1)) {
      await fireEvent(image, 'load', imageLoaded());
    }
    await fireEvent.press(screen.getByTestId('vote-left'));
    expect(voteMock).not.toHaveBeenCalled();

    // A picture that fails counts too: the vote must not wait for ever.
    await fireEvent(images.at(-1)!, 'error', imageFailed());
    await fireEvent.press(screen.getByTestId('vote-left'));
    await waitFor(() => expect(voteMock).toHaveBeenCalledTimes(1));
  });

  it('does not wait for pictures the figure never draws (only three accessories fit)', async () => {
    jest.useFakeTimers();
    try {
      const crowded = [
        ...nextPair().pair!.left.pieces,
        piece('Accessory', 'https://img.test/acc-1.jpg'),
        piece('Accessory', 'https://img.test/acc-2.jpg'),
        piece('Accessory', 'https://img.test/acc-3.jpg'),
        piece('Accessory', 'https://img.test/acc-4.jpg'),
        piece('Accessory', 'https://img.test/acc-5.jpg'),
      ];
      pairMock.mockResolvedValue(
        nextPair({ pair: { ...nextPair().pair!, left: { pieces: crowded } } }),
      );
      await renderWithQuery(<VoteScreen />);
      await screen.findByTestId('vote-board');

      // Six pictures are on screen on the left (three pieces and three accessories) and three on the right.
      const images = screen.getAllByTestId(/^piece-image-/);
      expect(images).toHaveLength(9);
      for (const image of images) {
        await fireEvent(image, 'load', imageLoaded());
      }

      // Every picture that is drawn has loaded: the votes are open well before the 5-second fallback.
      expect(screen.getByTestId('vote-left').props.accessibilityState.disabled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends one vote for a double tap', async () => {
    let resolve: (result: LeagueVoteResult) => void = () => undefined;
    voteMock.mockImplementation(() => new Promise((done) => (resolve = done)));
    await showPair();

    const card = screen.getByTestId('vote-left');
    await fireEvent.press(card);
    // The answer is still on its way: a second tap, and a tap on the other card, send nothing.
    await fireEvent.press(card);
    await fireEvent.press(screen.getByTestId('vote-right'));
    await fireEvent.press(screen.getByTestId('vote-skip'));

    expect(voteMock).toHaveBeenCalledTimes(1);
    expect(track).not.toHaveBeenCalledWith('league_vote', expect.anything());
    await act(async () => resolve(voteResult()));
    expect(await screen.findByTestId('vote-result')).toBeTruthy();
    expect(voteMock).toHaveBeenCalledTimes(1);
    expect(jest.mocked(track).mock.calls.filter(([name]) => name === 'league_vote')).toEqual([
      ['league_vote', { choice: 'left', counted: true }],
    ]);
  });

  it('puts the pair back, with a message, when the vote fails, and lets the player try again', async () => {
    voteMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    await showPair();

    await fireEvent.press(screen.getByTestId('vote-left'));

    expect(await screen.findByTestId('vote-error')).toHaveTextContent(
      'Oyun gönderilemedi, tekrar dene.',
    );
    expect(screen.queryByTestId('vote-result')).toBeNull();
    expect(screen.getByTestId('vote-left').props.accessibilityState.disabled).toBe(false);
    // A failed attempt is not a vote.
    expect(track).not.toHaveBeenCalledWith('league_vote', expect.anything());

    await fireEvent.press(screen.getByTestId('vote-left'));
    expect(await screen.findByTestId('vote-result')).toBeTruthy();
    expect(voteMock).toHaveBeenCalledTimes(2);
    expect(jest.mocked(track).mock.calls.filter(([name]) => name === 'league_vote')).toHaveLength(
      1,
    );
    // The same pair both times: nothing was skipped or re-asked.
    expect(voteMock.mock.calls.map((call) => call[0])).toEqual([PAIR_ID, PAIR_ID]);
    expect(pairMock).toHaveBeenCalledTimes(1);
  });

  it('"Karar veremedim" sends skip and goes straight to the next pair', async () => {
    pairMock
      .mockResolvedValueOnce(nextPair())
      .mockResolvedValueOnce(nextPair({ pair: { ...nextPair().pair!, id: NEXT_PAIR_ID } }));
    voteMock.mockResolvedValue(
      voteResult({ counted: false, chosenWinRate: null, chosenGames: null }),
    );
    await showPair();

    await fireEvent.press(screen.getByTestId('vote-skip'));

    await waitFor(() => expect(voteMock).toHaveBeenCalledTimes(1));
    expect(voteMock.mock.calls[0]?.[1]).toMatchObject({ choice: 'skip' });
    expect(track).toHaveBeenCalledWith('league_vote', { choice: 'skip', counted: false });
    expect(track).toHaveBeenCalledTimes(
      jest.mocked(track).mock.calls.filter(([name]) => name !== 'league_vote').length + 1,
    );
    await waitFor(() => expect(pairMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('vote-result')).toBeNull();
    expect(await screen.findByTestId('vote-board')).toBeTruthy();
  });

  it('carries on to the next pair when the server says this one was already answered or is gone', async () => {
    pairMock
      .mockResolvedValueOnce(nextPair())
      .mockResolvedValueOnce(nextPair({ pair: { ...nextPair().pair!, id: NEXT_PAIR_ID } }));
    voteMock.mockRejectedValueOnce(apiError(409, 'League.AlreadyVoted'));
    await showPair();

    await fireEvent.press(screen.getByTestId('vote-left'));

    await waitFor(() => expect(pairMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('vote-error')).toBeNull();
  });
});

describe('after the vote (design 03)', () => {
  it('shows the real win rate of the chosen outfit, marks it, and never claims agreement', async () => {
    await showPair();
    await fireEvent.press(screen.getByTestId('vote-left'));

    const headline = await screen.findByTestId('vote-win-rate');
    expect(headline.props.accessibilityLabel).toBe('%72 bugünkü galibiyet oranı');
    expect(within(headline).getByText('%72')).toBeTruthy();
    expect(within(headline).getByText('bugünkü galibiyet oranı')).toBeTruthy();
    expect(screen.getByText('Senin seçimin')).toBeTruthy();
    expect(screen.getByTestId('result-left-chosen')).toBeTruthy();
    expect(screen.getByTestId('result-right')).toBeTruthy();
    expect(screen.getByTestId('vote-win-bar').props.accessibilityLabel).toBe(
      'Seçtiğin kombinin bugünkü galibiyet oranı yüzde 72',
    );
    // The header's count follows the answer.
    expect(screen.getByTestId('vote-count')).toHaveTextContent('4/10 oy');
    expect(screen.queryByText(/seninle aynı fikirde/i)).toBeNull();
    expect(screen.queryByTestId('vote-not-counted')).toBeNull();
    // Nothing to vote on while the answer is shown.
    expect(screen.queryByTestId('vote-left')).toBeNull();
  });

  it('says "İlk oylardan biri seninki" when there is no rate yet', async () => {
    voteMock.mockResolvedValue(voteResult({ chosenWinRate: null, chosenGames: 2 }));
    await showPair();
    await fireEvent.press(screen.getByTestId('vote-right'));

    expect(await screen.findByText('İlk oylardan biri seninki')).toBeTruthy();
    expect(screen.queryByTestId('vote-win-rate')).toBeNull();
    expect(screen.queryByTestId('vote-win-bar')).toBeNull();
    expect(screen.getByTestId('result-right-chosen')).toBeTruthy();
  });

  it('says quietly that a vote did not count', async () => {
    voteMock.mockResolvedValue(voteResult({ counted: false, countedToday: 3 }));
    await showPair();
    await fireEvent.press(screen.getByTestId('vote-left'));

    expect(await screen.findByTestId('vote-not-counted')).toHaveTextContent(
      'Bu oy sayılmadı, biraz daha bakarak seç',
    );
    expect(track).toHaveBeenCalledWith('league_vote', { choice: 'left', counted: false });
    expect(screen.getByTestId('vote-count')).toHaveTextContent('3/10 oy');
  });

  it('loads the next pair on "Sıradaki çift", and the vote is open again for it', async () => {
    pairMock
      .mockResolvedValueOnce(nextPair())
      .mockResolvedValueOnce(nextPair({ pair: { ...nextPair().pair!, id: NEXT_PAIR_ID } }));
    await showPair();
    await fireEvent.press(screen.getByTestId('vote-left'));
    await fireEvent.press(await screen.findByTestId('vote-next'));

    await screen.findByTestId('vote-board');
    expect(pairMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('vote-result')).toBeNull();
    await settleImages();
    await fireEvent.press(screen.getByTestId('vote-left'));
    await waitFor(() => expect(voteMock).toHaveBeenCalledTimes(2));
    expect(voteMock.mock.calls[1]?.[0]).toBe(NEXT_PAIR_ID);
  });

  it('tells the player they may go on once the day’s target is reached', async () => {
    voteMock.mockResolvedValue(voteResult({ countedToday: 10, servedToday: 10 }));
    await showPair();
    await fireEvent.press(screen.getByTestId('vote-left'));

    expect(await screen.findByTestId('vote-target-done')).toHaveTextContent(
      'Günlük oy hedefin tamam. İstersen devam edebilirsin.',
    );
    expect(screen.getByTestId('vote-count')).toHaveTextContent('10/10 oy');
  });
});

describe('reporting', () => {
  it('reports the side from the figure’s own menu, then shows the next pair', async () => {
    pairMock
      .mockResolvedValueOnce(nextPair())
      .mockResolvedValueOnce(nextPair({ pair: { ...nextPair().pair!, id: NEXT_PAIR_ID } }));
    await showPair();

    expect(screen.getByTestId('menu-right').props.accessibilityLabel).toBe(
      'Sağdaki kombin için seçenekler',
    );
    await fireEvent.press(screen.getByTestId('menu-right'));
    expect(await screen.findByText('Uygunsuz içerik bildir')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('menu-report'));

    await waitFor(() => expect(reportMock).toHaveBeenCalledTimes(1));
    expect(reportMock).toHaveBeenCalledWith(PAIR_ID, { side: 'right', reason: 'Inappropriate' });
    expect(voteMock).not.toHaveBeenCalled();
    await waitFor(() => expect(pairMock).toHaveBeenCalledTimes(2));
    expect(jest.mocked(track).mock.calls.filter(([name]) => name === 'league_report')).toEqual([
      ['league_report', {}],
    ]);
    expect(useToastStore.getState().message).toBe(
      'Bildirdin, teşekkürler. Bu kombini bir daha görmeyeceksin.',
    );
  });

  it('keeps the menu a sibling of the card, so a screen reader can reach both', async () => {
    await showPair();
    const card = screen.getByTestId('vote-left');
    const menu = screen.getByTestId('menu-left');
    expect(within(card).queryByTestId('menu-left')).toBeNull();
    expect(menu.props.accessibilityRole).toBe('button');
  });

  it('moves on when the pair was already reported, and says so when it could not be reported', async () => {
    reportMock.mockRejectedValueOnce(apiError(409, 'League.AlreadyReported'));
    pairMock
      .mockResolvedValueOnce(nextPair())
      .mockResolvedValueOnce(nextPair({ pair: { ...nextPair().pair!, id: NEXT_PAIR_ID } }));
    await showPair();
    await fireEvent.press(screen.getByTestId('menu-left'));
    await fireEvent.press(await screen.findByTestId('menu-report'));
    await waitFor(() => expect(pairMock).toHaveBeenCalledTimes(2));

    reportMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    await screen.findByTestId('vote-board');
    await settleImages();
    await fireEvent.press(screen.getByTestId('menu-left'));
    await fireEvent.press(await screen.findByTestId('menu-report'));
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Bildirilemedi, tekrar dene.'),
    );
    expect(pairMock).toHaveBeenCalledTimes(2);
    // Neither the repeat (409) nor the failed report is a sent report.
    expect(track).not.toHaveBeenCalledWith('league_report', expect.anything());
  });
});

describe('when there is nothing to vote on', () => {
  it('says "Bugünlük bitti" at the daily limit, with the time of the results and a way back', async () => {
    pairMock.mockResolvedValue(
      nextPair({ pair: null, reason: 'DailyLimit', closesAt: '2026-11-02T18:00:00Z' }),
    );
    freezeClockAt(NOW);
    await renderWithQuery(<VoteScreen />);

    expect(await screen.findByText('Bugünlük bitti')).toBeTruthy();
    expect(screen.getByText('Yeni çiftler yarın geliyor. Sonuçlar bugün saat 21:00.')).toBeTruthy();
    expect(screen.queryByTestId('vote-board')).toBeNull();
    await fireEvent.press(screen.getByText('Lige dön'));
    expect(router.back).toHaveBeenCalled();
  });

  it('says "Şu an gösterilecek kombin yok" when no pair can be made, and can look again', async () => {
    pairMock
      .mockResolvedValueOnce(nextPair({ pair: null, reason: 'NoPairs' }))
      .mockResolvedValueOnce(nextPair());
    await renderWithQuery(<VoteScreen />);

    expect(await screen.findByText('Şu an gösterilecek kombin yok')).toBeTruthy();
    expect(screen.getByText('Lige dön')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vote-no-pairs-retry'));

    expect(await screen.findByTestId('vote-board')).toBeTruthy();
    expect(pairMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error with "Tekrar dene" when the pair cannot be loaded', async () => {
    pairMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    pairMock.mockResolvedValueOnce(nextPair());
    await renderWithQuery(<VoteScreen />);

    expect(await screen.findByText('Bir şeyler ters gitti')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vote-retry'));
    expect(await screen.findByTestId('vote-board')).toBeTruthy();
  });
});

describe('when the day is over', () => {
  it('opens the results when the server says the day is closed (409 on the pair)', async () => {
    pairMock.mockRejectedValue(apiError(409, 'League.DayClosed'));
    await renderWithQuery(<VoteScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/league/results'));
  });

  it('opens the results when the vote is refused because the day closed meanwhile', async () => {
    voteMock.mockRejectedValue(apiError(409, 'League.DayClosed'));
    await showPair();
    await fireEvent.press(screen.getByTestId('vote-left'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/league/results'));
  });

  it('opens the results once the closing time has passed', async () => {
    freezeClockAt('2026-11-02T18:00:01Z');
    pairMock.mockResolvedValue(nextPair({ closesAt: '2026-11-02T18:00:00Z' }));
    await renderWithQuery(<VoteScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/league/results'));
  });

  it('sends a player who is not in the league to the join screen', async () => {
    pairMock.mockRejectedValue(apiError(403, 'League.NotJoined'));
    await renderWithQuery(<VoteScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/league/join'));
  });

  it('sends anyone without a league home', async () => {
    meMock.mockResolvedValue(null);
    await renderWithQuery(<VoteScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });
});

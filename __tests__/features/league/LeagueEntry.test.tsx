import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { getLeagueMe } from '@/api/endpoints/league';
import { LeagueEntry } from '@/features/league/LeagueEntry';
import { LeagueEntryLine } from '@/features/league/LeagueEntryLine';

import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { freezeClockAt, unfreezeClock } from '../../support/fakeClock';
import { DAY_CLOSE, leagueMe, notJoined, todayWith } from './fixtures';

const meMock = jest.mocked(getLeagueMe);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  meMock.mockResolvedValue(leagueMe());
});

afterEach(() => unfreezeClock());

describe('Keşfet’s league row', () => {
  it('is not there at all when the league does not exist (404 becomes "no league")', async () => {
    meMock.mockResolvedValue(null);
    await renderWithQuery(<LeagueEntry />);

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(screen.queryByTestId('league-entry-join')).toBeNull();
    expect(screen.queryByTestId('league-entry-joined')).toBeNull();
    expect(screen.queryByText('Kombin Ligi')).toBeNull();
    expect(screen.queryByText('Tekrar dene')).toBeNull();
  });

  it('shows nothing, and no error, when the league cannot be asked right now', async () => {
    meMock.mockRejectedValue(new ApiError({ status: 500, correlationId: 'x' }));
    await renderWithQuery(<LeagueEntry />);

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(screen.queryByText('Kombin Ligi')).toBeNull();
    expect(screen.queryByText('Bir şeyler ters gitti')).toBeNull();
  });

  it('does not ask a visitor', async () => {
    await resetSession();
    await renderWithQuery(<LeagueEntry />);

    expect(meMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Kombin Ligi')).toBeNull();
  });

  it('offers a player who has not joined the league, and opens the join screen', async () => {
    meMock.mockResolvedValue(notJoined());
    await renderWithQuery(<LeagueEntry />);

    const row = await screen.findByTestId('league-entry-join');
    expect(screen.getByText('Kombin Ligi')).toBeTruthy();
    expect(screen.getByText('Bugünkü kombinin yarışsın')).toBeTruthy();
    expect(row.props.accessibilityLabel).toBe('Kombin Ligi. Bugünkü kombinin yarışsın');
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/league/join');
  });

  it('shows the tier, the place in the group and today’s votes to a player, and opens the league home', async () => {
    await renderWithQuery(<LeagueEntry />);

    const row = await screen.findByTestId('league-entry-joined');
    expect(screen.getByText('Altın · 7. sırada · 3/10 oy')).toBeTruthy();
    await fireEvent.press(row);
    // One tap to the league; "Oy vermeye başla" there is the second (see LeagueHomeScreen.test).
    expect(router.push).toHaveBeenCalledWith('/league');
  });

  it('leaves the rank out while the player is in no group, and never counts past the target', async () => {
    meMock.mockResolvedValue(leagueMe({ week: null, today: todayWith({ countedVotes: 14 }) }));
    await renderWithQuery(<LeagueEntry />);

    expect(await screen.findByText('Altın · 10/10 oy')).toBeTruthy();
  });

  it('asks a joined player for the new text, on the join screen', async () => {
    meMock.mockResolvedValue(leagueMe({ consentRequired: true }));
    await renderWithQuery(<LeagueEntry />);

    await fireEvent.press(await screen.findByTestId('league-entry-join'));
    expect(screen.getByText('Devam etmek için yeni metni onayla')).toBeTruthy();
    expect(router.push).toHaveBeenCalledWith('/league/join');
  });

  it('opens the evening result once the day has closed', async () => {
    freezeClockAt('2026-11-02T18:05:00Z');
    meMock.mockResolvedValue(leagueMe({ today: todayWith({ closesAt: DAY_CLOSE }) }));
    await renderWithQuery(<LeagueEntry />);

    const row = await screen.findByTestId('league-entry-joined');
    expect(screen.getByText('Altın · 7. sırada · Sonuçlar hazır')).toBeTruthy();
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/league/results');
  });
});

describe('the line on the morning card', () => {
  const withEntry = (entry: NonNullable<ReturnType<typeof leagueMe>['today']['entry']>) =>
    meMock.mockResolvedValue(leagueMe({ today: todayWith({ entry }) }));

  it('says the outfit is competing', async () => {
    withEntry({ status: 'Competing', reason: null, message: null, pieces: [] });
    await renderWithQuery(<LeagueEntryLine />);

    expect(await screen.findByText('Kombinin ligde yarışıyor')).toBeTruthy();
  });

  it('shows the server’s message for an outfit that does not compete', async () => {
    withEntry({
      status: 'NotCompeting',
      reason: 'RecentlyCompeted',
      message: 'Bu kombin yakın zamanda yarıştı, bugün yarışmıyor.',
      pieces: [],
    });
    await renderWithQuery(<LeagueEntryLine />);

    expect(
      await screen.findByText('Bu kombin yakın zamanda yarıştı, bugün yarışmıyor.'),
    ).toBeTruthy();
  });

  it('is silent without a league', async () => {
    meMock.mockResolvedValue(null);
    await renderWithQuery(<LeagueEntryLine />);

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(screen.queryByTestId('league-line')).toBeNull();
  });

  it('is silent for a player who has not joined', async () => {
    meMock.mockResolvedValue(notJoined());
    await renderWithQuery(<LeagueEntryLine />);

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(screen.queryByTestId('league-line')).toBeNull();
  });

  it('is silent while no worn outfit has entered', async () => {
    await renderWithQuery(<LeagueEntryLine />);

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(screen.queryByTestId('league-line')).toBeNull();
  });
});

describe('a pending outfit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('says "Lige hazırlanıyor" while the image check runs, and asks again every 30 seconds', async () => {
    meMock.mockResolvedValue(
      leagueMe({
        today: todayWith({
          entry: { status: 'Pending', reason: null, message: null, pieces: [] },
        }),
      }),
    );
    await renderWithQuery(<LeagueEntryLine />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText('Lige hazırlanıyor')).toBeTruthy();
    expect(meMock).toHaveBeenCalledTimes(1);

    meMock.mockResolvedValue(
      leagueMe({
        today: todayWith({
          entry: { status: 'Competing', reason: null, message: null, pieces: [] },
        }),
      }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(meMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Kombinin ligde yarışıyor')).toBeTruthy();
  });
});

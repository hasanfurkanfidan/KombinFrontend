import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import {
  getLeagueMe,
  getLeagueTable,
  leaveLeague,
  withdrawLeagueEntry,
} from '@/api/endpoints/league';
import { useToastStore } from '@/components/toastStore';
import { LeagueHomeScreen } from '@/features/league/LeagueHomeScreen';
import { LeagueTable, mySituation } from '@/features/league/LeagueTable';

import { freezeClockAt, unfreezeClock } from '../../support/fakeClock';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { DAY_CLOSE, leagueMe, notJoined, table, todayWith } from './fixtures';

const meMock = jest.mocked(getLeagueMe);
const tableMock = jest.mocked(getLeagueTable);
const leaveMock = jest.mocked(leaveLeague);
const withdrawMock = jest.mocked(withdrawLeagueEntry);

/** Thursday 5 November 2026, 13:00 in Istanbul: three days to the Sunday-21:00 close. */
const THURSDAY = '2026-11-05T10:00:00Z';

beforeEach(async () => {
  [meMock, tableMock, leaveMock, withdrawMock].forEach((mock) => mock.mockReset());
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  meMock.mockResolvedValue(leagueMe());
  tableMock.mockResolvedValue(table());
  leaveMock.mockResolvedValue(undefined);
  withdrawMock.mockResolvedValue(undefined);
  freezeClockAt(THURSDAY);
});

afterEach(() => unfreezeClock());

describe('the table (design 05)', () => {
  it('reports one table view per opening, with no properties, once the table is on screen', async () => {
    await renderWithQuery(<LeagueHomeScreen />);
    expect(await screen.findByTestId('league-table')).toBeTruthy();

    expect(jest.mocked(track).mock.calls.filter(([name]) => name === 'league_table_view')).toEqual([
      ['league_table_view', {}],
    ]);
  });

  it('reports no table view while there is no table (group not formed yet)', async () => {
    tableMock.mockResolvedValue(null);
    await renderWithQuery(<LeagueHomeScreen />);
    await screen.findByText('Grubun Pazartesi kurulacak');

    expect(track).not.toHaveBeenCalledWith('league_table_view', expect.anything());
  });

  it('shows the league, the time left and today’s points', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByText('Altın lig')).toBeTruthy();
    expect(screen.getByTestId('league-ends')).toHaveTextContent(
      "Pazar 21:00'de biter · 3 gün kaldı",
    );
    const today = screen.getByTestId('league-today');
    expect(within(today).getByText('Bugünkü puanın')).toBeTruthy();
    expect(within(today).getByText('74')).toBeTruthy();
    // The day is closed: the number is final, nothing says "şimdilik".
    expect(screen.queryByTestId('league-today-provisional')).toBeNull();
  });

  it('says the week is over while its results are worked out (state Ending)', async () => {
    tableMock.mockResolvedValue(table({ state: 'Ending' }));
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByTestId('league-ends')).toHaveTextContent(
      'Hafta bitti, sonuçlar hazırlanıyor',
    );
    expect(screen.getByTestId('league-table')).toBeTruthy();
  });

  it('labels the table as last week’s once the week is final (state Final)', async () => {
    tableMock.mockResolvedValue(table({ state: 'Final' }));
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByTestId('league-ends')).toHaveTextContent('Geçen haftanın tablosu');
    expect(screen.getByTestId('league-table')).toBeTruthy();
    expect(screen.queryByText(/biter/)).toBeNull();
  });

  it('marks today’s points as provisional until the day is final', async () => {
    tableMock.mockResolvedValue(table({ todayIsFinal: false, todayPoints: 25 }));
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByTestId('league-today-provisional')).toHaveTextContent('şimdilik');
    expect(screen.getByTestId('league-today').props.accessibilityLabel).toBe(
      'Bugünkü puanın, şimdilik: 25',
    );
  });

  it('lists the rows by alias, the player’s own as "Sen" with the gap to promotion', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByText('Yeşil Trençkot')).toBeTruthy();
    expect(screen.getByText('486')).toBeTruthy();
    expect(screen.getByText('Haki Parka')).toBeTruthy();
    const me = screen.getByTestId('table-me');
    expect(within(me).getByText('Sen')).toBeTruthy();
    expect(within(me).getByText('414')).toBeTruthy();
    // 431 (5th) − 414.
    expect(within(me).getByText('5. sıraya 17 puan')).toBeTruthy();
    expect(me.props.accessibilityLabel).toBe('7. sıra, sen, 414 puan. 5. sıraya 17 puan');
    expect(screen.getByTestId('table-row-1').props.accessibilityLabel).toBe(
      '1. sıra, Yeşil Trençkot, 486 puan',
    );
    // The player's own alias is never drawn: the table has "Sen" instead.
    expect(screen.queryByText('Siyah Ceket Sen')).toBeNull();
  });

  it('draws the promotion and relegation lines with their words and the tier names', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByTestId('table-promote-label')).toHaveTextContent(
      'İlk 5 Platin lige çıkar',
    );
    expect(screen.getByTestId('table-relegate-label')).toHaveTextContent('Son 2 Gümüş lige düşer');
    expect(screen.getByText('30 oyuncu')).toBeTruthy();
  });

  it('has no promotion line at the top league', async () => {
    tableMock.mockResolvedValue(table({ tier: 'Diamond', tierUp: null }));
    await renderWithQuery(<LeagueHomeScreen />);

    await screen.findByTestId('league-table');
    expect(screen.queryByTestId('table-promote-label')).toBeNull();
    expect(screen.getByTestId('table-relegate-label')).toHaveTextContent('Son 2 Gümüş lige düşer');
  });

  it('has no relegation line at the bottom league', async () => {
    tableMock.mockResolvedValue(table({ tier: 'Bronze', tierDown: null }));
    await renderWithQuery(<LeagueHomeScreen />);

    await screen.findByTestId('league-table');
    expect(screen.queryByTestId('table-relegate-label')).toBeNull();
    expect(screen.getByTestId('table-promote-label')).toBeTruthy();
  });

  it('says in words where the player stands against the lines', () => {
    const rows = table().rows;
    const inside = table({ rows: rows.map((row) => ({ ...row, isMe: row.rank === 3 })) });
    expect(mySituation(inside, 3, 455)).toBe('Yükselme hattındasın');
    const bottom = table({ rows: rows.map((row) => ({ ...row, isMe: row.rank === 9 })) });
    expect(mySituation(bottom, 9, 388)).toBe('Düşme hattındasın');
    expect(mySituation(table(), 7, 414)).toBe('5. sıraya 17 puan');
    // Level with the line: nothing to promise.
    expect(mySituation(table(), 7, 431)).toBeNull();
  });

  it('draws only rows of the table that the server sent: aliases, "Sen" and numbers', async () => {
    await renderWithQuery(<LeagueTable table={table()} />);

    expect(screen.getAllByTestId(/^table-row-/)).toHaveLength(8);
    expect(screen.getAllByTestId('table-me')).toHaveLength(1);
  });

  it('draws two rows that share a rank without a key collision', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const rows = table().rows.map((row) => (row.rank === 4 ? { ...row, rank: 3 } : row));
      await renderWithQuery(<LeagueTable table={table({ rows })} />);

      expect(screen.getAllByTestId(/^table-row-/).length).toBeGreaterThanOrEqual(8);
      const keyWarnings = errors.mock.calls.filter((call) => String(call[0]).includes('same key'));
      expect(keyWarnings).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('shows a calm note when the group has not been formed yet', async () => {
    tableMock.mockResolvedValue(null);
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByText('Grubun Pazartesi kurulacak')).toBeTruthy();
    expect(screen.getByText(/yaklaşık otuz kişilik gruplar kurulur/)).toBeTruthy();
    expect(screen.queryByTestId('league-table')).toBeNull();
    expect(screen.queryByText('Bir şeyler ters gitti')).toBeNull();
    // Voting is open all the same.
    expect(screen.getByText('Oy vermeye başla')).toBeTruthy();
  });

  it('shows an error with a retry when the table cannot be loaded', async () => {
    tableMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByText('Bir şeyler ters gitti')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('league-table-retry'));
    expect(await screen.findByTestId('league-table')).toBeTruthy();
  });
});

describe('the way in and out', () => {
  it('starts voting with the primary action: two taps from Keşfet (the row, then this)', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    await fireEvent.press(await screen.findByTestId('league-primary'));
    expect(screen.getByText('Oy vermeye başla')).toBeTruthy();
    expect(router.push).toHaveBeenCalledWith('/league/vote');
  });

  it('opens the latest result from the quiet link', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    await fireEvent.press(await screen.findByTestId('league-results'));
    expect(router.push).toHaveBeenCalledWith('/league/results');
  });

  it('offers the result instead of voting once the day has closed', async () => {
    freezeClockAt('2026-11-02T18:30:00Z');
    meMock.mockResolvedValue(leagueMe({ today: todayWith({ closesAt: DAY_CLOSE }) }));
    await renderWithQuery(<LeagueHomeScreen />);

    const primary = await screen.findByTestId('league-primary');
    expect(within(primary).getByText('Son sonucu gör')).toBeTruthy();
    expect(screen.queryByText('Oy vermeye başla')).toBeNull();
    await fireEvent.press(primary);
    expect(router.push).toHaveBeenCalledWith('/league/results');
  });

  it('sends someone who is not in the league to the join screen', async () => {
    meMock.mockResolvedValue(notJoined());
    await renderWithQuery(<LeagueHomeScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/league/join'));
    expect(tableMock).not.toHaveBeenCalled();
  });

  it('sends anyone without a league home', async () => {
    meMock.mockResolvedValue(null);
    await renderWithQuery(<LeagueHomeScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('lets a player who must accept the new text do so, and still shows the table', async () => {
    meMock.mockResolvedValue(leagueMe({ consentRequired: true }));
    await renderWithQuery(<LeagueHomeScreen />);

    expect(await screen.findByTestId('league-table')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('league-reconsent'));
    expect(router.push).toHaveBeenCalledWith('/league/join');
  });
});

describe('settings', () => {
  const alertSpy = jest.spyOn(Alert, 'alert');

  /** Presses the destructive button of the confirmation that was just shown. */
  async function confirm() {
    const buttons = alertSpy.mock.calls.at(-1)?.[2] ?? [];
    const destructive = buttons.find((button) => button.style === 'destructive');
    destructive?.onPress?.();
  }

  beforeEach(() => alertSpy.mockClear());
  afterAll(() => alertSpy.mockRestore());

  const competing = () =>
    meMock.mockResolvedValue(
      leagueMe({
        today: todayWith({
          entry: { status: 'Competing', reason: null, message: null, pieces: [] },
        }),
      }),
    );

  it('takes today’s outfit out of the day, after a confirmation that says it is final', async () => {
    competing();
    await renderWithQuery(<LeagueHomeScreen />);

    await fireEvent.press(await screen.findByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-withdraw'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0]?.[0]).toBe('Kombin yarıştan çıkarılsın mı?');
    expect(alertSpy.mock.calls[0]?.[1]).toBe(
      'Bugünkü kombinin bu günlük yarışmaz. Bu işlem geri alınamaz.',
    );
    expect(withdrawMock).not.toHaveBeenCalled();
    await confirm();

    await waitFor(() => expect(withdrawMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Kombinin bugünkü yarıştan çıkarıldı'),
    );
  });

  it('says why when there was nothing to take out, or the day had closed', async () => {
    competing();
    withdrawMock.mockRejectedValueOnce(
      new ApiError({ status: 404, errorCode: 'League.NoEntryToday', correlationId: 'x' }),
    );
    await renderWithQuery(<LeagueHomeScreen />);
    await fireEvent.press(await screen.findByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-withdraw'));
    await confirm();
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Bugün için yarışan bir kombinin yok.'),
    );

    withdrawMock.mockRejectedValueOnce(
      new ApiError({ status: 409, errorCode: 'League.DayClosed', correlationId: 'x' }),
    );
    await fireEvent.press(screen.getByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-withdraw'));
    await confirm();
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Bugün kapandı, kombin artık çıkarılamaz.'),
    );
  });

  it('offers to take the outfit out only while it is in the day', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    await fireEvent.press(await screen.findByTestId('league-settings'));

    expect(await screen.findByTestId('league-leave')).toBeTruthy();
    expect(screen.queryByTestId('league-withdraw')).toBeNull();
  });

  it('leaves the league after a confirmation that says what leaving means, then goes home', async () => {
    await renderWithQuery(<LeagueHomeScreen />);

    await fireEvent.press(await screen.findByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-leave'));

    expect(alertSpy.mock.calls[0]?.[0]).toBe('Ligden ayrılmak istiyor musun?');
    const body = String(alertSpy.mock.calls[0]?.[1]);
    expect(body).toContain('grubundan çıkarılırsın');
    expect(body).toContain('bugünkü kombinin yarıştan çekilir');
    expect(body).toContain('Puanların ve ligin saklanır');
    expect(leaveMock).not.toHaveBeenCalled();
    await confirm();

    await waitFor(() => expect(leaveMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(useToastStore.getState().message).toBe('Ligden ayrıldın');
    expect(jest.mocked(track).mock.calls.filter(([name]) => name === 'league_leave')).toEqual([
      ['league_leave', {}],
    ]);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    await renderWithQuery(<LeagueHomeScreen />);
    await fireEvent.press(await screen.findByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-leave'));

    const cancel = alertSpy.mock.calls[0]?.[2]?.find((button) => button.style === 'cancel');
    expect(cancel?.text).toBe('Vazgeç');
    expect(leaveMock).not.toHaveBeenCalled();
  });

  it('treats "not joined" as having left, and says so plainly for any other failure', async () => {
    leaveMock.mockRejectedValueOnce(
      new ApiError({ status: 403, errorCode: 'League.NotJoined', correlationId: 'x' }),
    );
    await renderWithQuery(<LeagueHomeScreen />);
    await fireEvent.press(await screen.findByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-leave'));
    await confirm();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));

    jest.clearAllMocks();
    leaveMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    await fireEvent.press(screen.getByTestId('league-settings'));
    await fireEvent.press(await screen.findByTestId('league-leave'));
    await confirm();
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('İşlem yapılamadı, tekrar dene.'),
    );
    expect(router.replace).not.toHaveBeenCalledWith('/');
    // Neither "not joined" nor a failure is a confirmed leave.
    expect(track).not.toHaveBeenCalledWith('league_leave', expect.anything());
  });
});

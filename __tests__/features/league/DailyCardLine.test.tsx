import { fireEvent, screen, within } from '@testing-library/react-native';

import { getMe } from '@/api/endpoints/auth';
import { getLeagueMe } from '@/api/endpoints/league';
import { getDailyOutfit, getOutfit, recordOutfitFeedback } from '@/api/endpoints/outfits';
import { getWardrobeStats } from '@/api/endpoints/wardrobe';
import { DailyCard } from '@/features/outfits/DailyCard';
import { usePrefsStore } from '@/session/prefsStore';

import { dailyOutfit, me, outfit, wardrobeStats } from '../../fixtures';
import { freezeClockAt, MORNING, TODAY, unfreezeClock } from '../../support/fakeClock';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { leagueMe, notJoined, todayWith } from './fixtures';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/wardrobe');

const leagueMock = jest.mocked(getLeagueMe);
const WORN_AT = '2026-11-02T09:00:00Z';

beforeEach(async () => {
  leagueMock.mockReset();
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  usePrefsStore.getState().reset();
  freezeClockAt(MORNING);
  jest.mocked(getMe).mockResolvedValue(me());
  jest.mocked(getWardrobeStats).mockResolvedValue(wardrobeStats({ itemCount: 48 }));
  jest.mocked(recordOutfitFeedback).mockResolvedValue(outfit());
  jest.mocked(getOutfit).mockResolvedValue(outfit({ id: 'worn-1', date: TODAY, wornAt: WORN_AT }));
  // Today's outfit is worn: the card is settled ("Bugün giyiyorsun").
  jest
    .mocked(getDailyOutfit)
    .mockResolvedValue(dailyOutfit({ outfit: outfit({ date: TODAY, wornAt: WORN_AT }) }));
  leagueMock.mockResolvedValue(null);
});

afterEach(() => unfreezeClock());

const entry = (status: 'Competing' | 'Pending' | 'NotCompeting', message: string | null = null) =>
  leagueMock.mockResolvedValue(
    leagueMe({
      today: todayWith({ entry: { status, reason: null, message, pieces: [] } }),
    }),
  );

/** The line sits under "Bugün giyiyorsun" and above the title of the settled card. */
async function settledCard() {
  await renderWithQuery(<DailyCard />);
  await screen.findByText('Bugün giyiyorsun');
  return screen.getByTestId('tomorrow-card');
}

describe('the settled morning card and the league', () => {
  it('says the outfit is competing, under "Bugün giyiyorsun"', async () => {
    entry('Competing');
    const card = await settledCard();

    expect(await within(card).findByText('Kombinin ligde yarışıyor')).toBeTruthy();
    expect(within(card).getByText('Bugün giyiyorsun')).toBeTruthy();
  });

  it('says the server’s message when the repeat rule keeps it out', async () => {
    entry('NotCompeting', 'Bu kombin yakın zamanda yarıştı, bugün yarışmıyor.');
    const card = await settledCard();

    expect(
      await within(card).findByText('Bu kombin yakın zamanda yarıştı, bugün yarışmıyor.'),
    ).toBeTruthy();
  });

  it('says "Lige hazırlanıyor" while the outfit waits for its image check', async () => {
    entry('Pending');
    const card = await settledCard();

    expect(await within(card).findByText('Lige hazırlanıyor')).toBeTruthy();
  });

  it('adds nothing when there is no league, and nothing for someone who has not joined', async () => {
    const card = await settledCard();
    expect(leagueMock).toHaveBeenCalled();
    expect(within(card).queryByTestId('league-line')).toBeNull();
    expect(within(card).getAllByText(/./).length).toBeGreaterThan(0);
  });

  it('adds nothing for a player who has not joined', async () => {
    leagueMock.mockResolvedValue(notJoined());
    const card = await settledCard();

    expect(await within(card).queryByTestId('league-line')).toBeNull();
  });

  it('asks for the league again when the card settles, because the outfit was only just worn', async () => {
    entry('Competing');
    await settledCard();

    expect(leagueMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Kombini gör')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-card-open'));
  });

  it('does not show a line on the card that has not been settled yet', async () => {
    entry('Competing');
    jest.mocked(getDailyOutfit).mockResolvedValue(dailyOutfit({ outfit: outfit({ date: TODAY }) }));
    await renderWithQuery(<DailyCard />);

    await screen.findByTestId('home-card-wear');
    expect(screen.queryByTestId('league-line')).toBeNull();
  });
});

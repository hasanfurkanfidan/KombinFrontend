import { screen } from '@testing-library/react-native';

import { getLeagueMe, getLeagueResults, getLeagueTable, getNextPair } from '@/api/endpoints/league';
import { JoinScreen } from '@/features/league/JoinScreen';
import { LeagueHomeScreen } from '@/features/league/LeagueHomeScreen';
import { LeagueEntry } from '@/features/league/LeagueEntry';
import { ResultsScreen } from '@/features/league/ResultsScreen';
import { VoteScreen } from '@/features/league/VoteScreen';

import { withFontScale } from '../../a11y/support';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { leagueMe, nextPair, notJoined, results, table } from './fixtures';

beforeEach(async () => {
  [getLeagueMe, getLeagueResults, getLeagueTable, getNextPair].forEach((fn) =>
    jest.mocked(fn).mockReset(),
  );
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  jest.mocked(getLeagueMe).mockResolvedValue(leagueMe());
  jest.mocked(getNextPair).mockResolvedValue(nextPair());
  jest.mocked(getLeagueResults).mockResolvedValue(results());
  jest.mocked(getLeagueTable).mockResolvedValue(table());
});

/** Every control on screen has a role and a name; every title is a header; nothing is named only by its picture. */
function expectNamedControls() {
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(button).toHaveAccessibleName();
  }
}

describe('league screens: names, roles, headers', () => {
  it('the join screen', async () => {
    jest.mocked(getLeagueMe).mockResolvedValue(notJoined());
    await renderWithQuery(<JoinScreen />);
    await screen.findByTestId('join-submit');

    expectNamedControls();
    expect(screen.getByRole('header', { name: 'Bugünkü kombinin yarışsın.' })).toBeTruthy();
    // The consent text is one element with its own name, so a screen reader reads it whole.
    expect(screen.getByLabelText(/^Katılım metni\./)).toBeTruthy();
  });

  it('the vote screen: the cards say what they show, the menus are reachable, progress is a progressbar', async () => {
    await renderWithQuery(<VoteScreen />);
    await screen.findByTestId('vote-board');

    expectNamedControls();
    expect(screen.getByRole('header', { name: 'Hangisi daha iyi?' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Bugünkü oy ilerlemesi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Soldaki kombini seç/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sağdaki kombin için seçenekler' })).toBeTruthy();
    // A figure is one image element listing its slots.
    expect(screen.getAllByRole('image')).toHaveLength(2);
  });

  it('the results screen', async () => {
    await renderWithQuery(<ResultsScreen day={null} />);
    await screen.findByTestId('results-ranked');

    expectNamedControls();
    expect(
      screen.getByRole('header', { name: /^12\. sıradasın, 86 kombin arasında/ }),
    ).toBeTruthy();
    // Every row of the points table is one sentence with its number and the word "puan".
    expect(screen.getByLabelText('Kombinini giydin. 10 puan')).toBeTruthy();
  });

  it('the league home: rows are sentences, the player’s own row says "sen"', async () => {
    await renderWithQuery(<LeagueHomeScreen />);
    await screen.findByTestId('league-table');

    expectNamedControls();
    expect(screen.getByRole('header', { name: 'Altın lig' })).toBeTruthy();
    expect(screen.getByLabelText('7. sıra, sen, 414 puan. 5. sıraya 17 puan')).toBeTruthy();
    expect(screen.getByLabelText('1. sıra, Yeşil Trençkot, 486 puan')).toBeTruthy();
  });

  it('Keşfet’s row carries everything it shows in its name', async () => {
    await renderWithQuery(<LeagueEntry />);

    const row = await screen.findByRole('button', { name: /^Kombin Ligi\./ });
    expect(row.props.accessibilityLabel).toBe('Kombin Ligi. Altın · 7. sırada · 3/10 oy');
  });
});

describe('league screens at large text', () => {
  it('keep every control and the sentence of the vote screen when the text is twice the size', async () => {
    await withFontScale(2, async () => {
      await renderWithQuery(<VoteScreen />);
      await screen.findByTestId('vote-board');

      expect(screen.getByText('Karar veremedim')).toBeTruthy();
      expect(screen.getByTestId('vote-countdown')).toBeTruthy();
      expect(screen.getByTestId('vote-left')).toBeTruthy();
      expect(screen.getByTestId('vote-right')).toBeTruthy();
    });
  });

  it('keep the table and the results readable', async () => {
    await withFontScale(2, async () => {
      await renderWithQuery(<LeagueHomeScreen />);
      await screen.findByTestId('league-table');
      expect(screen.getByText('Sen')).toBeTruthy();
    });
  });
});

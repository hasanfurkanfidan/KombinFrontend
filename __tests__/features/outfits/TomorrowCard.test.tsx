import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getDailyOutfit } from '@/api/endpoints/outfits';
import { getWardrobeStats } from '@/api/endpoints/wardrobe';
import { TomorrowCard } from '@/features/outfits/TomorrowCard';

import { dailyOutfit, wardrobeStats } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/wardrobe');

const dailyMock = jest.mocked(getDailyOutfit);
const statsMock = jest.mocked(getWardrobeStats);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  dailyMock.mockResolvedValue(dailyOutfit());
  statsMock.mockResolvedValue(wardrobeStats({ itemCount: 48 }));
});

describe('home card "Yarın için"', () => {
  it('shows tomorrow with its weather pill and piece thumbnails, and opens the daily screen on the same seed', async () => {
    await signedInSession();

    await renderWithQuery(<TomorrowCard />);

    const card = await screen.findByTestId('tomorrow-card');
    expect(within(card).getByText('Dolabından bir kombin')).toBeTruthy();
    expect(within(screen.getByTestId('tomorrow-weather')).getByText('9° · Yağmurlu')).toBeTruthy();
    // The three wardrobe pieces of the fixture outfit, side by side.
    expect(
      within(screen.getByTestId('tomorrow-collage')).getAllByTestId(/^collage-cell-/),
    ).toHaveLength(3);
    expect(dailyMock.mock.calls[0]?.[0]).toEqual({
      date: 'tomorrow',
      occasion: undefined,
      seed: 0,
    });

    await fireEvent.press(within(card).getByText('Kombini gör ve düzenle'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/outfits/daily',
      params: { date: 'tomorrow', seed: '0' },
    });
  });

  it('asks for the outfit only once the wardrobe is known to have pieces', async () => {
    await signedInSession();
    let resolveStats: (value: ReturnType<typeof wardrobeStats>) => void = () => undefined;
    statsMock.mockReturnValue(new Promise((resolve) => (resolveStats = resolve)));

    await renderWithQuery(<TomorrowCard />);
    expect(screen.getByTestId('tomorrow-loading')).toBeTruthy();
    expect(dailyMock).not.toHaveBeenCalled();

    resolveStats(wardrobeStats({ itemCount: 3 }));
    await screen.findByTestId('tomorrow-card');
    expect(dailyMock).toHaveBeenCalledTimes(1);
  });

  it('prompts to add pieces when the wardrobe is empty, without asking for an outfit', async () => {
    await signedInSession();
    statsMock.mockResolvedValue(wardrobeStats({ itemCount: 0 }));

    await renderWithQuery(<TomorrowCard />);

    expect(
      await screen.findByText('Dolabına 5 parça ekle, yarının kombinini hazırlayalım'),
    ).toBeTruthy();
    await waitFor(() => expect(statsMock).toHaveBeenCalled());
    expect(dailyMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('tomorrow-add'));
    expect(router.navigate).toHaveBeenCalledWith('/wardrobe');
  });

  it('prompts when logged out, without calling the backend', async () => {
    await renderWithQuery(<TomorrowCard />);

    expect(screen.getByTestId('tomorrow-prompt')).toBeTruthy();
    expect(statsMock).not.toHaveBeenCalled();
    expect(dailyMock).not.toHaveBeenCalled();
  });

  it('says so when nothing wearable came out for tomorrow', async () => {
    await signedInSession();
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: null, alternatives: [], weather: null }));

    await renderWithQuery(<TomorrowCard />);

    expect(await screen.findByText('Yarın için kombin çıkmadı')).toBeTruthy();
    expect(screen.queryByTestId('tomorrow-collage')).toBeNull();
    expect(screen.queryByTestId('tomorrow-weather')).toBeNull();
  });
});

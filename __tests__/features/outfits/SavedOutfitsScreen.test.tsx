import { fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { listSavedOutfits } from '@/api/endpoints/outfits';
import { SavedOutfitsScreen } from '@/features/outfits/SavedOutfitsScreen';

import { outfit, outfitPiece } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/outfits');

const listSavedMock = jest.mocked(listSavedOutfits);

const pagedOf = (items: ReturnType<typeof outfit>[]) => ({
  items,
  page: 1,
  pageSize: 20,
  totalCount: items.length,
  totalPages: 1,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
});

describe('saved outfits', () => {
  it('asks to sign in when logged out', async () => {
    await renderWithQuery(<SavedOutfitsScreen />);

    expect(screen.getByText('Kombin için giriş yap')).toBeTruthy();
    expect(listSavedMock).not.toHaveBeenCalled();
  });

  it('shows a grid of mini collages and opens one', async () => {
    await signedInSession();
    const first = outfit({
      id: 's1',
      occasion: 'Office',
      date: '2026-11-02',
      savedAt: '2026-11-02T08:00:00Z',
    });
    const second = outfit({
      id: 's2',
      occasion: 'Weekend',
      date: '2026-11-07',
      savedAt: '2026-11-02T09:00:00Z',
      pieces: [
        outfitPiece(),
        outfitPiece({ slot: 'Bottom', name: 'Jean', color: 'Blue' }),
        outfitPiece({ slot: 'Outerwear', name: 'Mont', color: 'Navy' }),
        outfitPiece({ slot: 'Shoes', name: 'Sneaker', color: 'White' }),
        outfitPiece({ slot: 'Accessory', name: 'Kemer', color: 'Brown' }),
      ],
    });
    listSavedMock.mockResolvedValue(pagedOf([first, second]));

    await renderWithQuery(<SavedOutfitsScreen />);

    const card = await screen.findByTestId('saved-outfit-s1');
    expect(within(card).getByText('Pazartesi ofis')).toBeTruthy();
    const other = screen.getByTestId('saved-outfit-s2');
    expect(within(other).getByText('Cumartesi hafta sonu')).toBeTruthy();
    // A 2×2 collage: at most four cells even when there are five pieces.
    expect(within(other).getAllByTestId(/^collage-cell-/)).toHaveLength(4);
    expect(within(card).getAllByTestId(/^collage-cell-/)).toHaveLength(3);

    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith('/outfits/s1');
  });

  it('shows an empty state', async () => {
    await signedInSession();
    listSavedMock.mockResolvedValue(pagedOf([]));

    await renderWithQuery(<SavedOutfitsScreen />);

    expect(await screen.findByText('Kaydettiğin kombin yok')).toBeTruthy();
  });

  it('goes back from the header', async () => {
    await signedInSession();
    listSavedMock.mockResolvedValue(pagedOf([]));
    await renderWithQuery(<SavedOutfitsScreen />);

    await fireEvent.press(screen.getByTestId('saved-back'));

    expect(router.back).toHaveBeenCalled();
  });
});

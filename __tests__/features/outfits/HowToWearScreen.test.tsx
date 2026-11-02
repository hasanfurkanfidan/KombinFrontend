import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { getHowToWear } from '@/api/endpoints/outfits';
import { listPersonas } from '@/api/endpoints/profile';
import { HowToWearScreen } from '@/features/outfits/HowToWearScreen';

import { howToWear, needsOneOutfit, outfit, outfitPiece } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/profile');

const howToWearMock = jest.mocked(getHowToWear);
const trackMock = jest.mocked(track);

const anchor = outfitPiece({
  role: 'Anchor',
  source: 'Catalog',
  wardrobeItemId: null,
  productId: 'p1',
  name: 'Yün karışımlı blazer',
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  jest.mocked(listPersonas).mockResolvedValue({ items: [] });
});

describe('how to wear', () => {
  it('asks to sign in when logged out', async () => {
    await renderWithQuery(<HowToWearScreen productId="p1" />);

    expect(screen.getByText('Kombin için giriş yap')).toBeTruthy();
    expect(howToWearMock).not.toHaveBeenCalled();
  });

  describe('signed in', () => {
    beforeEach(async () => {
      await signedInSession();
    });

    it('asks for five outfits around the product', async () => {
      howToWearMock.mockResolvedValue(howToWear([outfit({ pieces: [anchor] })]));

      await renderWithQuery(<HowToWearScreen productId="p1" />);
      await screen.findByTestId('outfit-page');

      expect(howToWearMock.mock.calls[0]?.[0]).toEqual({
        productId: 'p1',
        wardrobeItemId: undefined,
        count: 5,
      });
    });

    it('asks around a wardrobe item when opened from one', async () => {
      howToWearMock.mockResolvedValue(howToWear([outfit({ pieces: [anchor] })]));

      await renderWithQuery(<HowToWearScreen wardrobeItemId="w1" />);
      await screen.findByTestId('outfit-page');

      expect(howToWearMock.mock.calls[0]?.[0]).toMatchObject({ wardrobeItemId: 'w1', count: 5 });
    });

    it('pages through the outfits with dots, highlights the anchor and follows the page in the sheet', async () => {
      const complete = outfit({
        id: 'a',
        pieces: [anchor, outfitPiece({ slot: 'Bottom', name: 'Siyah pantolon' })],
      });
      const needsOne = needsOneOutfit({
        id: 'b',
        pieces: [anchor, ...needsOneOutfit().pieces.slice(0, 1)],
        completionPrice: 649,
      });
      const third = outfit({ id: 'c', pieces: [anchor] });
      howToWearMock.mockResolvedValue(howToWear([complete, needsOne, third]));

      await renderWithQuery(<HowToWearScreen productId="p1" />);

      const pages = await screen.findAllByTestId('outfit-page');
      expect(pages).toHaveLength(3);
      expect(screen.getByTestId('outfit-dots').children).toHaveLength(3);
      expect(screen.getByTestId('outfit-subtitle').props.children).toBe('Kombin 1 / 3');
      // The anchor piece is the highlighted one.
      expect(within(pages[0] as never).getAllByText('Ana parça').length).toBeGreaterThan(0);
      // First page is complete: nothing to buy.
      expect(screen.getByText('Bu kombin dolabından hazır')).toBeTruthy();
      expect(screen.queryByTestId('outfit-price')).toBeNull();

      // Swipe to the second page: the sheet now shows what is missing and its price.
      await fireEvent(pages[0]?.parent?.parent as never, 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: 750 } },
      });

      await waitFor(() =>
        expect(screen.getByTestId('outfit-subtitle').props.children).toBe('Kombin 2 / 3'),
      );
      expect(screen.getByTestId('outfit-price').props.children).toBe('649 ₺');
      expect(trackMock).toHaveBeenCalledWith('outfit_view', {
        kind: 'Daily',
        status: 'NeedsOne',
        occasion: 'office',
      });
    });

    it('says so when no outfit could be built', async () => {
      howToWearMock.mockResolvedValue(
        howToWear([], { message: 'Bu ürün için kombin bulunamadı.' }),
      );

      await renderWithQuery(<HowToWearScreen productId="p1" />);

      expect(await screen.findByText('Bu parça için kombin bulamadık')).toBeTruthy();
      expect(screen.getByText('Bu ürün için kombin bulunamadı.')).toBeTruthy();
    });

    it('closes with the ✕', async () => {
      howToWearMock.mockResolvedValue(howToWear([outfit({ pieces: [anchor] })]));
      await renderWithQuery(<HowToWearScreen productId="p1" />);

      await fireEvent.press(await screen.findByTestId('outfit-close'));

      expect(router.back).toHaveBeenCalled();
    });
  });
});

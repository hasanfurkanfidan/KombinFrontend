import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getWardrobeSummary } from '@/api/endpoints/wardrobe';
import { WardrobeSummaryScreen } from '@/features/wardrobe/WardrobeSummaryScreen';

import {
  costPerWearItem,
  pairingUnlock,
  smallOverview,
  unwornItem,
  wardrobeOverview,
  wardrobeValue,
} from '../../fixtures';
import { heldOpen, renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/wardrobe');

const summaryMock = jest.mocked(getWardrobeSummary);
const trackMock = jest.mocked(track);
const openBrowserMock = jest.mocked(WebBrowser.openBrowserAsync);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  summaryMock.mockResolvedValue(wardrobeOverview());
});

describe('a small wardrobe', () => {
  it('shows the backend sentence and one way to add a piece, and no figure at all', async () => {
    summaryMock.mockResolvedValue(smallOverview());
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByTestId('summary-small-message')).toHaveTextContent(
      /^Dolabında 2 parça var/,
    );
    expect(screen.queryByTestId('summary-value')).toBeNull();
    expect(screen.queryByTestId('summary-cpw')).toBeNull();
    expect(screen.queryByTestId('summary-unworn')).toBeNull();
    // Nothing that could pass for data: no price, no zero.
    expect(screen.queryByText(/₺/)).toBeNull();
    expect(screen.queryByText('0')).toBeNull();

    await fireEvent.press(screen.getByTestId('summary-add'));
    expect(router.navigate).toHaveBeenCalledWith('/wardrobe');
  });

  it('reports the view with counts only', async () => {
    summaryMock.mockResolvedValue(smallOverview());
    await renderWithQuery(<WardrobeSummaryScreen />);
    await screen.findByTestId('summary-small');

    expect(trackMock).toHaveBeenCalledWith('wardrobe_summary_view', {
      pieceCount: 2,
      unwornCount: 0,
      hasEstimate: false,
    });
  });
});

describe('the value', () => {
  it('labels an estimated total, and every estimated category, "tahmini"', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);

    const total = await screen.findByTestId('summary-total');
    expect(total).toHaveTextContent('7.400 ₺');
    expect(screen.getByTestId('summary-total-estimated')).toHaveTextContent('tahmini');
    // The headline reads as one thing to a screen reader, "tahmini" included.
    expect(screen.getByLabelText('Dolabının değeri, tahmini, 7.400 ₺')).toBeTruthy();

    // Alt giyim is made of estimates; Üst giyim is the user's own prices.
    expect(screen.getByTestId('summary-category-estimated-alt-giyim')).toBeTruthy();
    expect(screen.queryByTestId('summary-category-estimated-ust-giyim')).toBeNull();
    expect(screen.getByLabelText(/^Alt giyim, 2 parça, tahmini, 1\.400 ₺$/)).toBeTruthy();
  });

  it('says nothing is estimated when every price is the user’s own', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        value: wardrobeValue({
          isEstimate: false,
          estimatedTotal: 0,
          counts: { priced: 6, estimated: 0, unpriced: 0 },
          byCategory: [
            {
              slug: 'ust-giyim',
              name: 'Üst giyim',
              pieceCount: 6,
              unpricedCount: 0,
              total: 7400,
              estimatedTotal: 0,
              isEstimate: false,
            },
          ],
        }),
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);

    await screen.findByTestId('summary-total');
    expect(screen.queryByTestId('summary-total-estimated')).toBeNull();
    expect(screen.queryByTestId('summary-category-estimated-ust-giyim')).toBeNull();
  });

  it('builds one sentence from the counts and leaves out an empty clause', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);
    expect(await screen.findByTestId('summary-counts')).toHaveTextContent(
      '3 parçanın fiyatı kayıtlı, 2 parçanın fiyatı tahmini, 1 parçanın fiyatı yok.',
    );
  });

  it('leaves out clauses that count nothing', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        value: wardrobeValue({ counts: { priced: 4, estimated: 0, unpriced: 2 } }),
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);
    expect(await screen.findByTestId('summary-counts')).toHaveTextContent(
      '4 parçanın fiyatı kayıtlı, 2 parçanın fiyatı yok.',
    );
  });

  it('lists the categories largest first', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);
    const list = await screen.findByTestId('summary-categories');
    const names = within(list)
      .getAllByTestId(/^summary-category-(?!estimated)/)
      .map((row) => row.props.testID);
    // Üst giyim (6.000 ₺) comes before Alt giyim (1.400 ₺) although the backend sent them the other way round.
    expect(names).toEqual(['summary-category-ust-giyim', 'summary-category-alt-giyim']);
  });

  it('offers a way to add prices only while some piece has none', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);
    await fireEvent.press(await screen.findByTestId('summary-unpriced'));
    expect(router.navigate).toHaveBeenCalledWith('/wardrobe');
  });

  it('shows no such action when every piece has a price', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        value: wardrobeValue({ counts: { priced: 6, estimated: 0, unpriced: 0 } }),
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);
    await screen.findByTestId('summary-counts');
    expect(screen.queryByTestId('summary-unpriced')).toBeNull();
  });

  it('shows the note, and no total, when nothing is priced', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        costPerWear: [],
        value: wardrobeValue({
          total: null,
          knownTotal: 0,
          estimatedTotal: 0,
          isEstimate: false,
          counts: { priced: 0, estimated: 0, unpriced: 6 },
          byCategory: [],
          note: 'Fiyatını bildiğin parçalar olunca dolap değerin burada görünür.',
        }),
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByTestId('summary-note')).toHaveTextContent(/^Fiyatını bildiğin/);
    expect(screen.queryByTestId('summary-total')).toBeNull();
    expect(screen.queryByText(/₺/)).toBeNull();
  });
});

describe('cost per wear', () => {
  it('shows each piece with its cost, marks an estimated price and opens the piece', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        costPerWear: [
          costPerWearItem(),
          costPerWearItem({
            item: costPerWearItem().item,
            priceIsEstimate: true,
            costPerWear: 120.5,
          }),
        ].map((entry, index) => ({
          ...entry,
          item: {
            ...entry.item,
            id: `cw${index + 1}`,
            name: index === 0 ? 'Siyah bot' : 'Beyaz gömlek',
          },
        })),
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByText('Siyah bot')).toBeTruthy();
    expect(screen.getByTestId('summary-cpw-caption-cw1')).toHaveTextContent('12 kez giyildi');
    expect(screen.getByTestId('summary-cpw-caption-cw1')).not.toHaveTextContent('tahmini');
    expect(screen.getByTestId('summary-cpw-caption-cw2')).toHaveTextContent(
      '12 kez giyildi · tahmini fiyat',
    );
    expect(screen.getByText('120,50 ₺')).toBeTruthy();
    expect(screen.getByText('Giyim başına maliyet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('summary-cpw-cw2'));
    expect(router.push).toHaveBeenCalledWith('/wardrobe/cw2');
  });

  it('says how a piece gets here when nothing has been worn', async () => {
    summaryMock.mockResolvedValue(wardrobeOverview({ costPerWear: [] }));
    await renderWithQuery(<WardrobeSummaryScreen />);
    expect(await screen.findByText(/Bugün giydim/)).toBeTruthy();
  });
});

describe('what has never been worn', () => {
  const unlock = pairingUnlock({
    productId: 'p77',
    goPath: '/api/v1/go/11111111-1111-1111-1111-111111111111',
    cheapestSeller: { name: 'Trendyol', slug: 'trendyol' },
    lowestPrice: 1299,
    unlocksEstimate: 8,
    slot: 'Shoes',
  });

  beforeEach(() => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        unworn: {
          totalCount: 4,
          message: 'En eski parçalarını gösteriyoruz.',
          items: [
            unwornItem({
              reason: 'NoPartner',
              reasonText: 'eşi yok',
              unlock,
            }),
            unwornItem({
              item: { ...unwornItem().item, id: 'uw2', name: 'Keten gömlek' },
              reason: 'OutOfSeason',
              reasonText: 'mevsimi değil',
            }),
            unwornItem({ item: { ...unwornItem().item, id: 'uw3', name: 'Gri kazak' } }),
          ],
        },
      }),
    );
  });

  it('counts them in a sentence and gives the reasons that exist', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByTestId('summary-unworn-lead')).toHaveTextContent(
      '30 günden uzun süredir dolabında olup hiç giymediğin 4 parça',
    );
    expect(screen.getByTestId('summary-unworn-message')).toHaveTextContent(
      'En eski parçalarını gösteriyoruz.',
    );
    expect(screen.getByTestId('summary-reason-uw1')).toHaveTextContent('eşi yok');
    expect(screen.getByTestId('summary-reason-uw2')).toHaveTextContent('mevsimi değil');
    // A piece with no likely reason shows none.
    expect(screen.queryByTestId('summary-reason-uw3')).toBeNull();
    expect(screen.getAllByText('45 gündür dolabında')).toHaveLength(3);
  });

  it('opens the piece on a tap', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);
    await fireEvent.press(await screen.findByTestId('summary-unworn-open-uw2'));
    expect(router.push).toHaveBeenCalledWith('/wardrobe/uw2');
  });

  it('shows the suggestion only for a piece that has one, with its price and seller', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);

    const row = await screen.findByTestId('summary-unlock-uw1');
    expect(within(row).getByText('Bir ayakkabı eklersen 8 kombin daha çıkar')).toBeTruthy();
    expect(within(row).getByText('Beyaz sneaker')).toBeTruthy();
    expect(within(row).getByText('Trendyol · 1.299 ₺')).toBeTruthy();
    expect(screen.queryByTestId('summary-unlock-uw2')).toBeNull();
    expect(screen.queryByTestId('summary-unlock-uw3')).toBeNull();
  });

  it('buys through the backend redirect and never a seller address', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);
    await fireEvent.press(await screen.findByTestId('summary-unlock-buy-uw1'));

    await waitFor(() => expect(openBrowserMock).toHaveBeenCalledTimes(1));
    expect(openBrowserMock).toHaveBeenCalledWith(
      'http://api.test/api/v1/go/11111111-1111-1111-1111-111111111111?src=wardrobe_summary',
    );
    expect(trackMock).toHaveBeenCalledWith('buy_click', {
      offerId: '11111111-1111-1111-1111-111111111111',
      source: 'wardrobe_summary',
    });
  });

  it('refuses a path that is not the backend redirect', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        unworn: {
          totalCount: 1,
          message: null,
          items: [unwornItem({ unlock: { ...unlock, goPath: '//evil.example/x' } })],
        },
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);
    await fireEvent.press(await screen.findByTestId('summary-unlock-buy-uw1'));

    expect(openBrowserMock).not.toHaveBeenCalled();
  });

  it('shows the backend message alone when there is nothing unworn', async () => {
    summaryMock.mockResolvedValue(
      wardrobeOverview({
        unworn: {
          totalCount: 0,
          items: [],
          message: 'Giymediğin ya da kombinlerine koymadığın parça yok.',
        },
      }),
    );
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByTestId('summary-unworn-message')).toHaveTextContent(
      'Giymediğin ya da kombinlerine koymadığın parça yok.',
    );
    expect(screen.queryByTestId('summary-unworn-lead')).toBeNull();
  });
});

describe('states', () => {
  it('shows a skeleton while loading', async () => {
    summaryMock.mockReturnValue(heldOpen());
    await renderWithQuery(<WardrobeSummaryScreen />);
    expect(await screen.findByTestId('summary-skeleton')).toBeTruthy();
  });

  it('shows an error with a retry that asks again', async () => {
    summaryMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c1' }));
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByText('Dolap özeti yüklenemedi')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tekrar dene'));

    expect(await screen.findByTestId('summary-total')).toBeTruthy();
    expect(summaryMock).toHaveBeenCalledTimes(2);
  });

  it('says so when the server cannot be reached', async () => {
    summaryMock.mockRejectedValueOnce(new ApiError({ status: 0, correlationId: 'c2' }));
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(
      await screen.findByText('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'),
    ).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('reports one view with counts and the estimate flag, never an amount', async () => {
    await renderWithQuery(<WardrobeSummaryScreen />);
    await screen.findByTestId('summary-total');

    const calls = trackMock.mock.calls.filter(([name]) => name === 'wardrobe_summary_view');
    expect(calls).toEqual([
      ['wardrobe_summary_view', { pieceCount: 6, unwornCount: 1, hasEstimate: true }],
    ]);
  });

  it('asks a signed-out user to sign in and calls nothing', async () => {
    await resetSession();
    await renderWithQuery(<WardrobeSummaryScreen />);

    expect(await screen.findByText('Dolabın için giriş yap')).toBeTruthy();
    expect(summaryMock).not.toHaveBeenCalled();
  });
});

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { listCategories, listProducts } from '@/api/endpoints/catalog';
import { DiscoverScreen } from '@/features/catalog/DiscoverScreen';

import { categories, listItem, page } from '../../fixtures';
import { renderWithQuery, resetSession } from '../../testUtils';

jest.mock('@/api/endpoints/catalog');

const listProductsMock = jest.mocked(listProducts);
const listCategoriesMock = jest.mocked(listCategories);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  listCategoriesMock.mockResolvedValue(categories);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('DiscoverScreen', () => {
  it('renders the product grid with prices, discount and seller count', async () => {
    listProductsMock.mockResolvedValue(
      page([
        listItem(),
        listItem({
          id: 'p2',
          name: 'Bej boğazlı triko',
          lowestPrice: 649,
          lowestOriginalPrice: null,
          offerCount: 1,
          discountPercent: 0,
        }),
      ]),
    );

    await renderWithQuery(<DiscoverScreen />);

    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
    expect(screen.getByText('2.149 ₺')).toBeTruthy();
    expect(screen.getByText('2.999 ₺')).toBeTruthy();
    expect(screen.getByText('−28%')).toBeTruthy();
    expect(screen.getByText('3 satıcıda en ucuzu')).toBeTruthy();
    expect(screen.getByText('649 ₺')).toBeTruthy();
    expect(screen.getAllByText('Tam sana göre')).toHaveLength(1);
    // Page 1 of 20 is requested with no filters.
    expect(listProductsMock.mock.calls[0]?.[0]).toMatchObject({ Page: 1, PageSize: 20 });
  });

  it('names the cheapest seller in the card footer, falling back to the seller count', async () => {
    listProductsMock.mockResolvedValue(
      page([
        listItem({ cheapestSeller: { name: 'Trendyol', slug: 'trendyol' } }),
        listItem({ id: 'p2', name: 'Bej boğazlı triko', offerCount: 2, cheapestSeller: null }),
        listItem({
          id: 'p3',
          name: 'Tek satıcılı pantolon',
          offerCount: 1,
          cheapestSeller: { name: 'Mavi', slug: 'mavi' },
        }),
      ]),
    );

    await renderWithQuery(<DiscoverScreen />);

    expect(await screen.findByText('En ucuzu Trendyol · 3 satıcı')).toBeTruthy();
    expect(screen.getByText('2 satıcıda en ucuzu')).toBeTruthy();
    // One seller is no comparison: no footer at all.
    expect(screen.queryByText(/Mavi ·/)).toBeNull();
  });

  it('reports product_list_view once the list is on screen, with filter names only', async () => {
    listProductsMock.mockResolvedValue(page([listItem()]));
    jest.mocked(useLocalSearchParams).mockReturnValue({ category: 'ust-giyim', color: 'Green' });

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByText('Yün karışımlı blazer');

    const views = jest.mocked(track).mock.calls.filter(([name]) => name === 'product_list_view');
    expect(views).toEqual([
      ['product_list_view', { sort: 'relevance', filters: 'category,color' }],
    ]);
  });

  it('shows the category chips and writes the chosen filter to the URL params', async () => {
    listProductsMock.mockResolvedValue(page([listItem()]));

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('filter-category-ust-giyim'));

    expect(router.setParams).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'ust-giyim' }),
    );
  });

  it('queries with the filters found in the URL params', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ category: 'ust-giyim', sort: 'priceAsc', color: 'Green' });
    listProductsMock.mockResolvedValue(page([listItem()]));

    await renderWithQuery(<DiscoverScreen />);

    await waitFor(() => expect(listProductsMock).toHaveBeenCalled());
    expect(listProductsMock.mock.calls[0]?.[0]).toMatchObject({
      CategorySlug: 'ust-giyim',
      Sort: 'priceAsc',
      Color: 'Green',
    });
  });

  it('opens the product detail when a card is pressed', async () => {
    listProductsMock.mockResolvedValue(page([listItem()]));

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('product-card-p1'));

    expect(router.push).toHaveBeenCalledWith('/product/p1?source=discover');
  });

  it('shows the empty state', async () => {
    listProductsMock.mockResolvedValue(page([]));

    await renderWithQuery(<DiscoverScreen />);

    expect(await screen.findByText('Bu seçimde ürün yok')).toBeTruthy();
  });

  it('shows an error state and retries', async () => {
    listProductsMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    listProductsMock.mockResolvedValueOnce(page([listItem()]));

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByText('Tekrar dene'));

    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
  });
});

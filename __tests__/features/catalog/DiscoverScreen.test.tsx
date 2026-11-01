import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

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

    expect(router.push).toHaveBeenCalledWith('/product/p1');
  });

  it('shows the empty state', async () => {
    listProductsMock.mockResolvedValue(page([]));

    await renderWithQuery(<DiscoverScreen />);

    expect(await screen.findByText('Sonuç bulunamadı')).toBeTruthy();
  });

  it('shows an error state and retries', async () => {
    listProductsMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    listProductsMock.mockResolvedValueOnce(page([listItem()]));

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByText('Tekrar dene'));

    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
  });
});

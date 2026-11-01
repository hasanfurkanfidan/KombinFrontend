import { fireEvent, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { ApiError } from '@/api/client';
import { getPriceHistory, getProduct } from '@/api/endpoints/catalog';
import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';

import { history, product, trendyol } from '../../fixtures';
import { renderWithQuery } from '../../testUtils';

jest.mock('@/api/endpoints/catalog');

const getProductMock = jest.mocked(getProduct);
const getPriceHistoryMock = jest.mocked(getPriceHistory);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProductDetailScreen', () => {
  it('renders summary cards, offers and the buy button for the cheapest offer', async () => {
    getProductMock.mockResolvedValue(product());
    getPriceHistoryMock.mockResolvedValue(history);

    await renderWithQuery(<ProductDetailScreen id="p1" />);

    expect(await screen.findByText('Yün karışımlı blazer, koyu yeşil')).toBeTruthy();
    expect(screen.getByText('Mavi')).toBeTruthy();
    expect(screen.getByText('EN DÜŞÜK FİYAT')).toBeTruthy();
    expect(screen.getByTestId('lowest-price').props.children).toBe('2.149 ₺');
    expect(screen.getByText('Son 90 günün en ucuzu')).toBeTruthy();
    expect(screen.getByText('3 satıcıda bulundu')).toBeTruthy();
    expect(screen.getByText('Kargo bedava')).toBeTruthy();
    expect(screen.getByText('+49 ₺ kargo')).toBeTruthy();
    expect(screen.getByText('Tükendi')).toBeTruthy();
    expect(screen.getByText("Trendyol'dan al · 2.149 ₺")).toBeTruthy();
    // The chart fills in once the history arrives.
    expect(await screen.findByTestId('price-chart-mini')).toBeTruthy();
    expect(screen.getByText('2.999 ₺ → 2.149 ₺')).toBeTruthy();
  });

  it('renders the detail before the history has arrived', async () => {
    getProductMock.mockResolvedValue(product());
    getPriceHistoryMock.mockReturnValue(new Promise(() => undefined));

    await renderWithQuery(<ProductDetailScreen id="p1" />);

    expect(await screen.findByText('Yün karışımlı blazer, koyu yeşil')).toBeTruthy();
    expect(screen.queryByTestId('price-chart-mini')).toBeNull();
  });

  it('opens the offer link in the in-app browser', async () => {
    getProductMock.mockResolvedValue(product());
    getPriceHistoryMock.mockResolvedValue(history);

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('buy-button'));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(trendyol.url);
  });

  it('expands the full chart when the history card is pressed', async () => {
    getProductMock.mockResolvedValue(product());
    getPriceHistoryMock.mockResolvedValue(history);

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await screen.findByTestId('price-chart-mini');
    await fireEvent.press(screen.getByTestId('price-history-card'));

    expect(screen.getByTestId('price-chart-full')).toBeTruthy();
  });

  it('shows "Ürün bulunamadı" on 404', async () => {
    getProductMock.mockRejectedValue(
      new ApiError({ status: 404, errorCode: 'Catalog.ProductNotFound', correlationId: 'c' }),
    );
    getPriceHistoryMock.mockRejectedValue(new ApiError({ status: 404, correlationId: 'c' }));

    await renderWithQuery(<ProductDetailScreen id="missing" />);

    expect(await screen.findByText('Ürün bulunamadı')).toBeTruthy();
  });

  it('disables the buy button when nothing is in stock', async () => {
    getProductMock.mockResolvedValue(
      product({
        offers: [{ ...trendyol, stockStatus: 'OutOfStock' }],
        priceSummary: {
          lowestNow: null,
          lowestLast90Days: null,
          highestLast90Days: null,
          isLowestOfLast90Days: false,
        },
      }),
    );
    getPriceHistoryMock.mockResolvedValue([]);

    await renderWithQuery(<ProductDetailScreen id="p1" />);

    expect((await screen.findAllByText('Stokta yok')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('buy-button')).toBeNull();
  });
});

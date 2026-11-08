import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getPriceHistory, getProduct } from '@/api/endpoints/catalog';
import { createAlert, listAlerts, listSavedIds } from '@/api/endpoints/engagement';
import { listPersonas, upsertSize } from '@/api/endpoints/profile';
import { ToastHost } from '@/components/ToastHost';
import { useToastStore } from '@/components/toastStore';
import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';
import { usePrefsStore } from '@/session/prefsStore';
import { useSessionStore } from '@/session/sessionStore';

import { alert, history, persona, product } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/profile');

const getProductMock = jest.mocked(getProduct);
const createAlertMock = jest.mocked(createAlert);
const listAlertsMock = jest.mocked(listAlerts);
const upsertSizeMock = jest.mocked(upsertSize);

const knownSize = {
  group: 'Tops',
  size: 'L',
  source: 'UserEntered',
  confidence: 1,
  suggestion: null,
} as const;

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  usePrefsStore.getState().reset();
  useToastStore.getState().hide();
  jest.mocked(getPriceHistory).mockResolvedValue(history);
  jest.mocked(listPersonas).mockResolvedValue({ items: [persona({ id: 'pe1' })] });
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
  listAlertsMock.mockResolvedValue({ items: [] });
  getProductMock.mockResolvedValue(product({ matchScore: 87, sizeHint: knownSize }));
});

describe('detail: match and size', () => {
  it('asks for the product with the active persona and the token', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await screen.findByText('Yün karışımlı blazer, koyu yeşil');

    expect(getProductMock).toHaveBeenCalledWith(
      'p1',
      { personaId: 'pe1', auth: true },
      expect.anything(),
    );
  });

  it('shows the match pill next to the brand line', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);

    expect(await screen.findByText('Sana uygun %87')).toBeTruthy();
  });

  it('hides a match score under 70', async () => {
    await signedInSession();
    getProductMock.mockResolvedValue(product({ matchScore: 58 }));

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await screen.findByText('Yün karışımlı blazer, koyu yeşil');

    expect(screen.queryByTestId('detail-match')).toBeNull();
  });

  it('shows the solid size pill for an entered size', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);

    expect(await screen.findByTestId('size-pill')).toBeTruthy();
    expect(screen.getByText('Senin bedenin')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.queryByTestId('size-add')).toBeNull();
  });

  it('writes a suggestion out as "Tahmini beden: M"', async () => {
    await signedInSession();
    getProductMock.mockResolvedValue(
      product({
        sizeHint: {
          group: 'Tops',
          size: null,
          source: null,
          confidence: null,
          suggestion: { size: 'M', source: 'Inferred', confidence: 0.6 },
        },
      }),
    );

    await renderWithQuery(<ProductDetailScreen id="p1" />);

    expect(await screen.findByTestId('size-pill-inferred')).toBeTruthy();
    expect(screen.getByText('Tahmini beden: M')).toBeTruthy();
    expect(screen.queryByText('M?')).toBeNull();
    // 0.6 is confident enough: no "emin değiliz".
    expect(screen.queryByTestId('size-unsure')).toBeNull();
  });

  it('offers "Bedenini ekle", which opens the size sheet with the product brand', async () => {
    await signedInSession();
    getProductMock.mockResolvedValue(
      product({
        sizeHint: {
          group: 'Bottoms',
          size: null,
          source: null,
          confidence: null,
          suggestion: null,
        },
      }),
    );
    upsertSizeMock.mockResolvedValue({
      id: 's1',
      brand: { id: 'b1', name: 'Mavi', slug: 'mavi' },
      group: 'Bottoms',
      size: '32/32',
      source: 'UserEntered',
      confidence: 1,
      updatedAt: '2026-11-01T10:00:00Z',
    });

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('size-add'));

    expect(await screen.findByTestId('size-brand-selected')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('size-value'), '32/32');
    await fireEvent.press(screen.getByTestId('size-submit'));

    await waitFor(() =>
      expect(upsertSizeMock).toHaveBeenCalledWith({
        brandSlug: 'mavi',
        group: 'Bottoms',
        size: '32/32',
      }),
    );
  });

  it('sends a logged-out user to login instead of opening the size sheet', async () => {
    useSessionStore.getState().setSignedOut();
    getProductMock.mockResolvedValue(product({ sizeHint: null }));

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('size-add'));

    expect(router.push).toHaveBeenCalledWith('/login');
  });
});

describe('detail: product_view', () => {
  it('reports one product_view with the persona and where the user came from', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" source="push" />);
    await screen.findByTestId('buy-button');

    const views = jest.mocked(track).mock.calls.filter(([name]) => name === 'product_view');
    expect(views).toEqual([
      ['product_view', { productId: 'p1', personaId: 'pe1', source: 'push' }],
    ]);
  });

  it('defaults the source to "direct" and has no persona while signed out', async () => {
    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await screen.findByTestId('buy-button');

    expect(track).toHaveBeenCalledWith('product_view', {
      productId: 'p1',
      personaId: undefined,
      source: 'direct',
    });
  });
});

describe('detail: buy through /go', () => {
  it('opens the redirect with the persona, never a seller URL', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('buy-button'));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'http://api.test/api/v1/go/o1?src=product_detail&personaId=pe1',
    );
    expect(track).toHaveBeenCalledWith('buy_click', { offerId: 'o1', source: 'product_detail' });
  });

  it('opens an offer from its whole row, with no separate "Git" link', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('offer-row-o2'));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'http://api.test/api/v1/go/o2?src=product_detail&personaId=pe1',
    );
    expect(screen.queryByText('Git')).toBeNull();
    // The sold-out offer cannot be opened.
    expect(screen.getByTestId('offer-row-o3').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('detail: alert sheet', () => {
  const openSheet = async () => {
    await fireEvent.press(await screen.findByTestId('detail-bell'));
    return screen.findByTestId('alert-target');
  };

  it('sends a logged-out user to login from the bell', async () => {
    useSessionStore.getState().setSignedOut();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('detail-bell'));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(screen.queryByTestId('alert-target')).toBeNull();
  });

  it('offers the three alert kinds with the target pre-filled 10 % below the lowest price', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    const target = await openSheet();

    expect(target.props.value).toBe('1934');
    expect(screen.getByText('Fiyat düşünce')).toBeTruthy();
    expect(screen.getByText('Bedenim stoğa girince')).toBeTruthy();
    expect(screen.getByText('Her değişiklikte')).toBeTruthy();
  });

  it('creates a price-drop alert and fills the bell', async () => {
    await signedInSession();
    createAlertMock.mockImplementation(async () => {
      listAlertsMock.mockResolvedValue({
        items: [alert({ product: { ...alert().product, id: 'p1' } })],
      });
      return alert({ product: { ...alert().product, id: 'p1' } });
    });

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    expect((await screen.findByTestId('detail-bell')).props.accessibilityLabel).toBe(
      'Fiyat alarmı kur',
    );
    await openSheet();
    await fireEvent.press(screen.getByTestId('alert-submit'));

    await waitFor(() =>
      expect(createAlertMock).toHaveBeenCalledWith({
        productId: 'p1',
        kind: 'PriceDrop',
        targetPrice: 1934,
        sizes: null,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('detail-bell').props.accessibilityLabel).toBe('Alarmın kurulu'),
    );
    expect(track).toHaveBeenCalledWith('alert_created', { kind: 'PriceDrop' });
  });

  it('validates the target: required, a number, and below the current price', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    const target = await openSheet();

    await fireEvent.changeText(target, '');
    await fireEvent.press(screen.getByTestId('alert-submit'));
    expect(await screen.findByText('Hedef fiyatı gir')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('alert-target'), 'abc');
    await fireEvent.press(screen.getByTestId('alert-submit'));
    expect(await screen.findByText('Geçerli bir tutar gir')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('alert-target'), '2149');
    await fireEvent.press(screen.getByTestId('alert-submit'));
    expect(
      await screen.findByText('Hedef, güncel en düşük fiyattan (2.149 ₺) düşük olmalı'),
    ).toBeTruthy();

    expect(createAlertMock).not.toHaveBeenCalled();
  });

  it('creates a back-in-stock alert for the chosen sizes (union of the offers)', async () => {
    await signedInSession();
    createAlertMock.mockResolvedValue(alert({ kind: 'BackInStock', targetPrice: null }));

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await openSheet();
    await fireEvent.press(screen.getByTestId('alert-kind-BackInStock'));
    await fireEvent.press(screen.getByTestId('alert-size-L'));
    await fireEvent.press(screen.getByTestId('alert-size-M'));
    await fireEvent.press(screen.getByTestId('alert-size-M'));
    await fireEvent.press(screen.getByTestId('alert-submit'));

    await waitFor(() =>
      expect(createAlertMock).toHaveBeenCalledWith({
        productId: 'p1',
        kind: 'BackInStock',
        targetPrice: null,
        sizes: ['L'],
      }),
    );
  });

  it('creates an any-change alert without a target or sizes', async () => {
    await signedInSession();
    createAlertMock.mockResolvedValue(alert({ kind: 'AnyChange', targetPrice: null }));

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await openSheet();
    await fireEvent.press(screen.getByTestId('alert-kind-AnyChange'));
    await fireEvent.press(screen.getByTestId('alert-submit'));

    await waitFor(() =>
      expect(createAlertMock).toHaveBeenCalledWith({
        productId: 'p1',
        kind: 'AnyChange',
        targetPrice: null,
        sizes: null,
      }),
    );
  });

  it('shows a toast on 409: the product already has an alert', async () => {
    await signedInSession();
    createAlertMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Engagement.AlertExists', correlationId: 'c' }),
    );

    await renderWithQuery(
      <>
        <ProductDetailScreen id="p1" />
        <ToastHost />
      </>,
    );
    await openSheet();
    await fireEvent.press(screen.getByTestId('alert-submit'));

    expect(await screen.findByText('Bu ürün için zaten bir alarmın var')).toBeTruthy();
  });

  it('shows the server-side target rule on the field', async () => {
    await signedInSession();
    createAlertMock.mockRejectedValue(
      new ApiError({
        status: 400,
        errorCode: 'Engagement.TargetNotBelowCurrent',
        correlationId: 'c',
      }),
    );

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await openSheet();
    await fireEvent.press(screen.getByTestId('alert-submit'));

    expect(
      await screen.findByText('Hedef, güncel en düşük fiyattan (2.149 ₺) düşük olmalı'),
    ).toBeTruthy();
  });

  it('offers the push prompt after the first alert, not before', async () => {
    await signedInSession();
    createAlertMock.mockResolvedValue(alert());
    const notifications = jest.requireMock('expo-notifications');

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await openSheet();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('alert-submit'));

    expect(await screen.findByText('Fiyat düşünce haber verelim mi?')).toBeTruthy();
    // The OS prompt only comes after the user agrees.
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('push-primer-allow'));

    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalled());
    await waitFor(() =>
      expect(usePrefsStore.getState().pushToken).toBe('ExponentPushToken[test-token]'),
    );
  });
});

describe('detail: "Bunu nasıl giyerim?"', () => {
  it('opens the outfits built around the product', async () => {
    await signedInSession();

    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('how-to-wear'));

    expect(router.push).toHaveBeenCalledWith('/outfits/how-to-wear?productId=p1');
  });

  it('asks a logged-out user to sign in first', async () => {
    await renderWithQuery(<ProductDetailScreen id="p1" />);
    await fireEvent.press(await screen.findByTestId('how-to-wear'));

    expect(router.push).toHaveBeenCalledWith('/login');
  });
});

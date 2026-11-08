import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  deleteAlert,
  listAlerts,
  listSaved,
  listSavedIds,
  listTriggers,
  updateAlert,
} from '@/api/endpoints/engagement';
import { TrackingScreen } from '@/features/tracking/TrackingScreen';
import { useSessionStore } from '@/session/sessionStore';

import { alert, page, savedProduct, trigger } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/engagement');

const listAlertsMock = jest.mocked(listAlerts);
const listTriggersMock = jest.mocked(listTriggers);
const listSavedMock = jest.mocked(listSaved);
const updateAlertMock = jest.mocked(updateAlert);
const deleteAlertMock = jest.mocked(deleteAlert);

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const mavi = alert({
  id: 'a1',
  targetPrice: 2300,
  triggerCount: 1,
  lastTriggeredAt: daysAgo(1),
});
const zara = alert({
  id: 'a2',
  targetPrice: 999,
  product: {
    id: 'p2',
    name: 'Keten gömlek, mavi',
    brandName: 'Zara',
    primaryImageUrl: null,
    lowestPrice: 1290,
  },
});
const levis = alert({
  id: 'a3',
  kind: 'BackInStock',
  targetPrice: null,
  sizes: ['32/32', '34'],
  product: {
    id: 'p3',
    name: '511 Slim, siyah',
    brandName: "Levi's",
    primaryImageUrl: null,
    lowestPrice: 2499,
  },
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  listSavedIdsMockDefault();
});

function listSavedIdsMockDefault() {
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: ['p1'] });
}

describe('Takip logged out', () => {
  it('asks to sign in and loads nothing', async () => {
    useSessionStore.getState().setSignedOut();

    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByText('Giriş yap'));

    expect(screen.getByText('Fiyatları izlemek için giriş yap')).toBeTruthy();
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listAlertsMock).not.toHaveBeenCalled();
  });
});

describe('Takip: Alarmlar', () => {
  beforeEach(async () => {
    await signedInSession();
    listAlertsMock.mockResolvedValue({ items: [mavi, zara, levis] });
    listTriggersMock.mockResolvedValue({
      items: [
        trigger({ id: 1, alertId: 'a1', priceBefore: 2999, priceAfter: 2149 }),
        trigger({ id: 2, alertId: 'a2', kind: 'AnyChange', priceBefore: 1000, priceAfter: 1290 }),
      ],
      page: 1,
      pageSize: 50,
      totalCount: 2,
      totalPages: 1,
    });
  });

  it('shows the headline numbers: watched, below target, savings and average discount', async () => {
    await renderWithQuery(<TrackingScreen />);

    // 3 watched; only the Mavi alert (2.149 ≤ 2.300) is at its target.
    expect(await screen.findByText("3 ürün izleniyor · 1'i hedef fiyatın altında")).toBeTruthy();
    expect(screen.getByTestId('track-savings').props.children).toBe('850 ₺');
    expect(screen.getByTestId('track-average').props.children).toBe('%28');
    expect(screen.getByText('Fiyat izleyerek kazandığın')).toBeTruthy();
    expect(screen.getByText('Yakaladığın ortalama indirim')).toBeTruthy();
  });

  it('lists each alert with its price, caption and status line', async () => {
    await renderWithQuery(<TrackingScreen />);

    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
    expect(screen.getByText('hedef 2.300 ₺')).toBeTruthy();
    expect(screen.getByText('Hedefin altında · şimdi al')).toBeTruthy();

    expect(screen.getByText('hedef 999 ₺')).toBeTruthy();
    expect(screen.getByText('+290 ₺ arttı')).toBeTruthy();

    expect(screen.getByText('32/32, 34 stoğa girince')).toBeTruthy();
    expect(screen.getByText('Son 30 günde değişmedi')).toBeTruthy();
  });

  it('draws the accent border only on rows with a trigger in the last 7 days', async () => {
    await renderWithQuery(<TrackingScreen />);

    const border = (id: string) => {
      const style = screen.getByTestId(`alert-row-${id}`).props.style as object | object[];
      return Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]))
        .borderColor;
    };
    await screen.findByTestId('alert-row-a1');

    expect(border('a1')).toBe('#0F5C3F');
    expect(border('a2')).not.toBe('#0F5C3F');
  });

  it('hides the average card and shows 0 ₺ savings without triggers', async () => {
    listTriggersMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0,
    });

    await renderWithQuery(<TrackingScreen />);

    expect(await screen.findByTestId('track-savings')).toBeTruthy();
    expect(screen.getByTestId('track-savings').props.children).toBe('0 ₺');
    expect(screen.queryByTestId('track-average')).toBeNull();
  });

  it('opens the product when a row is pressed', async () => {
    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByTestId('alert-row-a2'));

    expect(router.push).toHaveBeenCalledWith('/product/p2?source=alert');
  });

  it('deletes an alert from the swipe action', async () => {
    // Like the server: the next list no longer has it.
    deleteAlertMock.mockImplementation(async () => {
      listAlertsMock.mockResolvedValue({ items: [mavi, levis] });
    });

    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByTestId('alert-delete-a2'));

    await waitFor(() => expect(deleteAlertMock).toHaveBeenCalledWith('a2'));
    await waitFor(() => expect(screen.queryByTestId('alert-row-a2')).toBeNull());
  });

  it('switches an alert off from the settings sheet (long press)', async () => {
    updateAlertMock.mockResolvedValue({ ...zara, isActive: false });

    await renderWithQuery(<TrackingScreen />);
    await fireEvent(await screen.findByTestId('alert-row-a2'), 'longPress');
    await fireEvent(await screen.findByTestId('alert-switch-a2'), 'valueChange', false);

    await waitFor(() => expect(updateAlertMock).toHaveBeenCalledWith('a2', { isActive: false }));
  });

  it('shows an empty state without alerts', async () => {
    listAlertsMock.mockResolvedValue({ items: [] });
    listTriggersMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0,
    });

    await renderWithQuery(<TrackingScreen />);

    expect(await screen.findByText('Henüz alarmın yok')).toBeTruthy();
    expect(screen.getByText("0 ürün izleniyor · 0'ı hedef fiyatın altında")).toBeTruthy();
  });

  it('shows an error with retry when the alerts cannot be loaded', async () => {
    listAlertsMock.mockRejectedValueOnce(new Error('boom'));

    await renderWithQuery(<TrackingScreen />);

    expect(await screen.findByText('Listen yüklenemedi')).toBeTruthy();
  });
});

describe('Takip: Kaydedilenler', () => {
  beforeEach(async () => {
    await signedInSession();
    listAlertsMock.mockResolvedValue({ items: [] });
    listTriggersMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it('shows saved products as cards with a filled bookmark and a muted overlay when off the market', async () => {
    listSavedMock.mockResolvedValue(
      page([
        savedProduct({ id: 'p1' }),
        savedProduct({ id: 'p9', name: 'Eski ceket', isActive: false }),
      ]) as never,
    );

    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByTestId('segment-saved'));

    expect(await screen.findByTestId('product-card-p1')).toBeTruthy();
    expect(screen.getByText('Eski ceket')).toBeTruthy();
    expect(screen.getByTestId('inactive-p9')).toBeTruthy();
    expect(screen.getByText('Artık satışta değil')).toBeTruthy();
    expect(screen.queryByTestId('inactive-p1')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('save-p1-card').props.accessibilityState.selected).toBe(true),
    );
    expect(listSavedMock.mock.calls[0]?.slice(0, 2)).toEqual([1, 20]);
  });

  it('opens a saved product', async () => {
    listSavedMock.mockResolvedValue(page([savedProduct({ id: 'p1' })]) as never);

    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByTestId('segment-saved'));
    await fireEvent.press(await screen.findByTestId('product-card-p1'));

    expect(router.push).toHaveBeenCalledWith('/product/p1?source=saved');
  });

  it('shows an empty state without saved products', async () => {
    listSavedMock.mockResolvedValue(page([]) as never);

    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByTestId('segment-saved'));

    expect(await screen.findByText('Kaydettiğin ürün yok')).toBeTruthy();
  });

  it('goes back to the alerts', async () => {
    listSavedMock.mockResolvedValue(page([]) as never);

    await renderWithQuery(<TrackingScreen />);
    await fireEvent.press(await screen.findByTestId('segment-saved'));
    await fireEvent.press(await screen.findByTestId('segment-alerts'));

    expect(await screen.findByText('Henüz alarmın yok')).toBeTruthy();
  });
});

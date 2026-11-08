import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { listCategories } from '@/api/endpoints/catalog';
import {
  archiveWardrobeItem,
  getWardrobeItem,
  getWardrobePairings,
  recordWear,
  undoWear,
} from '@/api/endpoints/wardrobe';
import { useToastStore } from '@/components/toastStore';
import { WardrobeItemScreen } from '@/features/wardrobe/WardrobeItemScreen';

import { pairingUnlock, pairings, wardrobeItem } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/api/endpoints/catalog');

const getItemMock = jest.mocked(getWardrobeItem);
const pairingsMock = jest.mocked(getWardrobePairings);
const wearMock = jest.mocked(recordWear);
const undoMock = jest.mocked(undoWear);
const archiveMock = jest.mocked(archiveWardrobeItem);
const trackMock = jest.mocked(track);

beforeEach(async () => {
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  jest.mocked(listCategories).mockResolvedValue([
    {
      id: 'c-top',
      slug: 'ust-giyim',
      name: 'Üst Giyim',
      children: [{ id: 'c-blazer', slug: 'ust-giyim/blazer', name: 'Blazer', children: [] }],
    },
  ]);
  getItemMock.mockResolvedValue(
    wardrobeItem({ name: 'Koyu yeşil blazer', wearCount: 3, lastWornAt: '2026-10-20' }),
  );
  pairingsMock.mockResolvedValue(pairings());
});

describe('wardrobe item detail: pairings', () => {
  it('shows the companions per slot with a tiny reason label, and a dashed tile for an empty slot', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    expect((await screen.findByTestId('item-title')).props.children).toBe('Koyu yeşil blazer');
    expect(await screen.findByText('Bununla giyilir')).toBeTruthy();
    expect(pairingsMock).toHaveBeenCalledWith('w1', expect.anything());

    const bottoms = await screen.findByTestId('pairing-row-Bottom');
    expect(within(bottoms).getByText('Alt')).toBeTruthy();
    expect(screen.getByTestId('pairing-reason-b1')).toHaveTextContent(
      'Sade bir renk, her şeyle giyilir',
    );
    expect(screen.getByTestId('pairing-reason-b2')).toHaveTextContent(
      'Zıt renkler birbirini öne çıkarır',
    );
    expect(screen.getByTestId('pairing-reason-s1')).toHaveTextContent('Kombine renk katar');

    // Top, outerwear and accessories have nobody.
    for (const slot of ['Top', 'Outerwear', 'Accessory']) {
      expect(
        within(screen.getByTestId(`pairing-empty-${slot}`)).getByText('Dolabında buna uyan yok'),
      ).toBeTruthy();
    }
    expect(screen.queryByTestId('pairing-empty-Bottom')).toBeNull();
    for (const label of ['Üst', 'Alt', 'Dış giyim', 'Ayakkabı', 'Aksesuar']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('opens a companion', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('pairing-item-b1'));

    expect(router.push).toHaveBeenCalledWith('/wardrobe/b1');
  });

  it('says how many outfits the piece is in, and makes an outfit around it', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    expect(await screen.findByTestId('pairing-outfit-count')).toHaveTextContent(
      '6 kombinde yer alıyor',
    );
    await fireEvent.press(screen.getByTestId('item-make-outfit'));

    expect(router.push).toHaveBeenCalledWith('/outfits/how-to-wear?wardrobeItemId=w1');
  });

  it('reports one pairings view with the companion total and no unlock', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await screen.findByTestId('pairing-rows');
    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('wardrobe_pairings_view', {
        companionTotal: 3,
        hasUnlock: false,
      }),
    );
    expect(trackMock.mock.calls.filter(([name]) => name === 'wardrobe_pairings_view')).toHaveLength(
      1,
    );
    expect(screen.queryByTestId('pairing-unlock')).toBeNull();
  });

  it('shows the black unlock card and sends the user to the product detail', async () => {
    pairingsMock.mockResolvedValue(pairings({ unlock: pairingUnlock() }));
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    const card = await screen.findByTestId('pairing-unlock');
    expect(within(card).getByText('Bir ayakkabı eklersen 8 kombin daha çıkar')).toBeTruthy();
    expect(within(card).getByText('Beyaz sneaker')).toBeTruthy();
    expect(within(card).getByText('1.299 ₺ · Trendyol')).toBeTruthy();
    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('wardrobe_pairings_view', {
        companionTotal: 3,
        hasUnlock: true,
      }),
    );

    await fireEvent.press(screen.getByTestId('pairing-unlock-inspect'));

    expect(trackMock).toHaveBeenCalledWith('wardrobe_unlock_click', {});
    expect(router.push).toHaveBeenCalledWith('/product/p77?source=direct');
  });

  it('explains why a piece without a category has no pairings', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    pairingsMock.mockRejectedValue(new ApiError({ status: 404, correlationId: 'c' }));
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    expect(
      await screen.findByText('Neyle giyileceğini görmek için önce parçanın türünü onayla.'),
    ).toBeTruthy();
    expect(trackMock).not.toHaveBeenCalledWith('wardrobe_pairings_view', expect.anything());
  });

  it('keeps the rest of the screen when the pairings cannot be loaded, and retries', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    pairingsMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    expect(await screen.findByText('Bununla giyilenler yüklenemedi')).toBeTruthy();
    expect(screen.getByTestId('item-title')).toBeTruthy();

    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(await screen.findByTestId('pairing-rows')).toBeTruthy();
  });
});

describe('wardrobe item detail: overflow menu', () => {
  it('has no wear button or wear history on the page itself', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);
    await screen.findByTestId('pairing-rows');

    expect(screen.queryByText('Bugün giydim')).toBeNull();
    expect(screen.queryByText('3 kez giyildi')).toBeNull();
    expect(screen.queryByText('Son giyilen: 20 Eki')).toBeNull();
  });

  it('shows the wear count and last worn inside the menu only', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('item-menu'));

    const history = await screen.findByTestId('item-wear-history');
    expect(within(history).getByText('3 kez giyildi')).toBeTruthy();
    expect(within(history).getByText('Son giyilen: 20 Eki')).toBeTruthy();
    expect(within(history).getByText('Bugün giydim')).toBeTruthy();
  });

  it('wears the piece today from the menu and offers an undo that removes that day', async () => {
    wearMock.mockResolvedValue({
      itemId: 'w1',
      wornOn: '2026-11-02',
      wearCount: 4,
      lastWornAt: '2026-11-02',
    });
    undoMock.mockResolvedValue({
      itemId: 'w1',
      wornOn: null,
      wearCount: 3,
      lastWornAt: '2026-10-20',
    });
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('item-menu'));
    await fireEvent.press(await screen.findByTestId('item-menu-wear'));

    await waitFor(() => expect(wearMock).toHaveBeenCalledWith('w1'));
    const toast = useToastStore.getState();
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe('Bugün giydin olarak işaretlendi'),
    );
    expect(toast.action).toBeDefined();
    expect(useToastStore.getState().action?.label).toBe('Geri al');

    // The menu shows the new count when it is opened again.
    await fireEvent.press(screen.getByTestId('item-menu'));
    expect(await screen.findByText('4 kez giyildi')).toBeTruthy();

    useToastStore.getState().action?.onPress();

    await waitFor(() => expect(undoMock).toHaveBeenCalledWith('w1', '2026-11-02'));
  });

  it('archives from the header menu after a confirmation', async () => {
    archiveMock.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('item-menu'));
    await fireEvent.press(await screen.findByTestId('item-menu-archive'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(archiveMock).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0]?.[2];
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();

    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it('opens the edit sheet from the menu', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('item-menu'));
    await fireEvent.press(await screen.findByTestId('item-menu-edit'));

    expect(await screen.findByText('Parçayı düzenle')).toBeTruthy();
  });
});

describe('wardrobe item detail: details', () => {
  it('collapses the attributes into a "Detaylar" row that opens the edit sheet', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);
    await screen.findByTestId('pairing-rows');

    // The attribute table is gone from the page.
    expect(screen.queryByText('Sonbahar, Kış')).toBeNull();
    expect(screen.queryByText('Resmiyet')).toBeNull();

    await fireEvent.press(screen.getByTestId('item-details'));

    expect(await screen.findByText('Parçayı düzenle')).toBeTruthy();
  });

  it('links an item that came from the catalog to its product', async () => {
    getItemMock.mockResolvedValue(wardrobeItem({ fromCatalog: true, productId: 'p9' }));
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('item-product-link'));

    expect(router.push).toHaveBeenCalledWith('/product/p9?source=direct');
  });

  it('says so when the piece does not exist', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    getItemMock.mockRejectedValue(new ApiError({ status: 404, correlationId: 'c' }));
    await renderWithQuery(<WardrobeItemScreen id="gone" />);

    expect(await screen.findByText('Bu parça bulunamadı')).toBeTruthy();
  });
});

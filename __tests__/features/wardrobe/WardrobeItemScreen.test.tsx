import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { listCategories } from '@/api/endpoints/catalog';
import {
  archiveWardrobeItem,
  getWardrobeItem,
  recordWear,
  undoWear,
} from '@/api/endpoints/wardrobe';
import { useToastStore } from '@/components/toastStore';
import { WardrobeItemScreen } from '@/features/wardrobe/WardrobeItemScreen';

import { wardrobeItem } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/api/endpoints/catalog');

const getItemMock = jest.mocked(getWardrobeItem);
const wearMock = jest.mocked(recordWear);
const undoMock = jest.mocked(undoWear);
const archiveMock = jest.mocked(archiveWardrobeItem);

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
});

describe('wardrobe item detail', () => {
  it('shows the cutout, the attributes and the wear history', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    expect((await screen.findByTestId('item-title')).props.children).toBe('Koyu yeşil blazer');
    expect(screen.getByText('Blazer')).toBeTruthy();
    expect(screen.getByText('Yeşil')).toBeTruthy();
    expect(screen.getByText('Sonbahar, Kış')).toBeTruthy();
    expect(screen.getByText('3 kez giyildi')).toBeTruthy();
    expect(screen.getByText('Son giyilen: 20 Eki')).toBeTruthy();
  });

  it('wears the piece today and offers an undo that removes that day', async () => {
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

    await fireEvent.press(await screen.findByTestId('item-wear'));

    await waitFor(() => expect(wearMock).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(screen.getByText('4 kez giyildi')).toBeTruthy());
    const toast = useToastStore.getState();
    expect(toast.message).toBe('Bugün giydin olarak işaretlendi');
    expect(toast.action?.label).toBe('Geri al');

    toast.action?.onPress();

    await waitFor(() => expect(undoMock).toHaveBeenCalledWith('w1', '2026-11-02'));
    await waitFor(() => expect(screen.getByText('3 kez giyildi')).toBeTruthy());
  });

  it('makes an outfit around the piece', async () => {
    await renderWithQuery(<WardrobeItemScreen id="w1" />);

    await fireEvent.press(await screen.findByTestId('item-make-outfit'));

    expect(router.push).toHaveBeenCalledWith('/outfits/how-to-wear?wardrobeItemId=w1');
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

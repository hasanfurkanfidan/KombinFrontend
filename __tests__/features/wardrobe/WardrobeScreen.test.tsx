import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { listCategories, listProducts } from '@/api/endpoints/catalog';
import { listSavedIds } from '@/api/endpoints/engagement';
import {
  getWardrobeGaps,
  getWardrobeItem,
  getWardrobeStats,
  listWardrobeItems,
  processWardrobeItem,
} from '@/api/endpoints/wardrobe';
import type { WardrobeItemSummary } from '@/api/models';
import { useAddStore } from '@/features/wardrobe/addStore';
import { WardrobeScreen } from '@/features/wardrobe/WardrobeScreen';

import {
  categories,
  page,
  wardrobeGaps,
  wardrobeItem,
  wardrobeStats,
  wardrobeSummary,
} from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');

const listItemsMock = jest.mocked(listWardrobeItems);
const statsMock = jest.mocked(getWardrobeStats);
const gapsMock = jest.mocked(getWardrobeGaps);
const getItemMock = jest.mocked(getWardrobeItem);
const processMock = jest.mocked(processWardrobeItem);

function itemsPage(items: WardrobeItemSummary[]) {
  return { items, page: 1, pageSize: 24, totalCount: items.length, totalPages: 1 };
}

const normal = wardrobeSummary({ id: 'w1', companionCount: 5 });
// A finished piece that goes with nothing: the third stat card counts it.
const lonely = wardrobeSummary({
  id: 'w2',
  name: 'Kahverengi ceket',
  primaryColor: 'Brown',
  companionCount: 0,
});
const processing = wardrobeSummary({
  id: 'w3',
  status: 'Processing',
  name: null,
  categorySlug: null,
  thumbUrl: null,
  companionCount: 0,
});
const failed = wardrobeSummary({
  id: 'w4',
  status: 'Failed',
  name: null,
  thumbUrl: null,
  companionCount: 0,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  useAddStore.getState().reset();
  listItemsMock.mockResolvedValue(itemsPage([processing, normal, lonely, failed]));
  statsMock.mockResolvedValue(wardrobeStats());
  gapsMock.mockResolvedValue(wardrobeGaps());
  jest.mocked(listCategories).mockResolvedValue(categories);
  jest.mocked(listProducts).mockResolvedValue(page([]));
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
});

describe('Dolap logged out', () => {
  it('asks to sign in and loads nothing', async () => {
    await renderWithQuery(<WardrobeScreen />);

    expect(screen.getByText('Dolabın için giriş yap')).toBeTruthy();
    await fireEvent.press(screen.getByText('Giriş yap'));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listItemsMock).not.toHaveBeenCalled();
  });
});

describe('Dolap grid', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('shows processing and failed pieces differently, a pairing caption under the rest, and a dashed "+" last', async () => {
    await renderWithQuery(<WardrobeScreen />);

    // Processing: shimmer over the thumbnail and an "İşleniyor" pill.
    const processingTile = await screen.findByTestId('wardrobe-item-w3');
    expect(within(processingTile).getByTestId('shimmer')).toBeTruthy();
    expect(screen.getByTestId('wardrobe-processing-w3')).toBeTruthy();
    expect(processingTile.props.accessibilityState.disabled).toBe(true);

    // A piece that pairs: a muted caption under the tile, no wear pill on it.
    expect(screen.getByTestId('wardrobe-companions-w1')).toHaveTextContent('5 parçayla gider');
    expect(screen.queryByText('12×')).toBeNull();
    expect(screen.queryByText('6 ay')).toBeNull();
    // One that pairs with nothing says so; processing and failed cards have no caption.
    expect(screen.getByTestId('wardrobe-companions-w2')).toHaveTextContent('Eşleşen parça yok');
    expect(screen.queryByTestId('wardrobe-companions-w3')).toBeNull();
    expect(screen.queryByTestId('wardrobe-companions-w4')).toBeNull();
    // Failed: the warning badge.
    expect(screen.getByTestId('wardrobe-failed-w4')).toBeTruthy();
    expect(screen.getByTestId('wardrobe-add-tile')).toBeTruthy();
  });

  it('shows no caption for a card the backend has not counted yet', async () => {
    listItemsMock.mockResolvedValue(
      itemsPage([wardrobeSummary({ id: 'w5', companionCount: undefined })]),
    );
    await renderWithQuery(<WardrobeScreen />);

    await screen.findByTestId('wardrobe-item-w5');
    expect(screen.queryByTestId('wardrobe-companions-w5')).toBeNull();
  });

  it('prints the reason under a failed card when one is known', async () => {
    useAddStore.getState().setFailureReason('w4', 'vision_400: unsupported_image');
    await renderWithQuery(<WardrobeScreen />);

    expect(await screen.findByTestId('wardrobe-failure-reason-w4')).toHaveTextContent(
      'vision_400: unsupported_image',
    );
    expect(screen.queryByTestId('wardrobe-failure-reason-w1')).toBeNull();
  });

  it('opens a piece, and retries a failed one by asking for the analysis again', async () => {
    processMock.mockResolvedValue({ itemId: 'w4', status: 'Processing' });
    await renderWithQuery(<WardrobeScreen />);

    await fireEvent.press(await screen.findByTestId('wardrobe-item-w1'));
    expect(router.push).toHaveBeenCalledWith('/wardrobe/w1');

    await fireEvent.press(screen.getByTestId('wardrobe-item-w4'));
    await waitFor(() => expect(processMock).toHaveBeenCalledWith('w4'));
  });

  it('shows the three stat cards, with "—" while the outfit count is unknown', async () => {
    statsMock.mockResolvedValue(wardrobeStats({ possibleOutfits: null }));
    await renderWithQuery(<WardrobeScreen />);

    const stats = await screen.findByTestId('wardrobe-stats');
    await waitFor(() => expect(within(stats).getByText('48')).toBeTruthy());
    expect(within(stats).getByText('parça')).toBeTruthy();
    expect(within(stats).getByText('olası kombin')).toBeTruthy();
    expect(screen.getByTestId('stat-outfits').props.children).toBe('—');
    // Only the finished piece that pairs with nothing counts (not the processing or failed ones).
    await waitFor(() => expect(screen.getByTestId('stat-unmatched-count').props.children).toBe(1));
    expect(within(stats).getByText('parça eşleşmiyor')).toBeTruthy();
    expect(within(stats).queryByText('6 aydır giyilmedi')).toBeNull();
  });

  it('counts the unmatched pieces over every page, not only the first', async () => {
    const second = wardrobeSummary({ id: 'w6', companionCount: 0 });
    listItemsMock.mockImplementation(async (query) =>
      query.pageSize === 100 && query.page === 2
        ? { items: [second], page: 2, pageSize: 100, totalCount: 101, totalPages: 2 }
        : query.pageSize === 100
          ? { items: [lonely], page: 1, pageSize: 100, totalCount: 101, totalPages: 2 }
          : itemsPage([normal]),
    );
    await renderWithQuery(<WardrobeScreen />);

    await waitFor(() => expect(screen.getByTestId('stat-unmatched-count').props.children).toBe(2));
  });

  it('filters the grid to the unmatched pieces when the third card is pressed, and back', async () => {
    await renderWithQuery(<WardrobeScreen />);
    await screen.findByTestId('wardrobe-item-w1');
    await waitFor(() => expect(screen.getByTestId('stat-unmatched-count').props.children).toBe(1));

    await fireEvent.press(screen.getByTestId('stat-unmatched'));
    await waitFor(() => expect(screen.queryByTestId('wardrobe-item-w1')).toBeNull());
    expect(screen.getByTestId('wardrobe-item-w2')).toBeTruthy();
    expect(screen.queryByTestId('wardrobe-item-w3')).toBeNull();
    expect(screen.getByTestId('stat-unmatched').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(screen.getByTestId('stat-unmatched'));
    expect(await screen.findByTestId('wardrobe-item-w1')).toBeTruthy();
  });

  it('leaves the unmatched filter when a category chip is chosen', async () => {
    await renderWithQuery(<WardrobeScreen />);
    await screen.findByTestId('wardrobe-item-w1');
    await waitFor(() => expect(screen.getByTestId('stat-unmatched-count').props.children).toBe(1));

    await fireEvent.press(screen.getByTestId('stat-unmatched'));
    await waitFor(() => expect(screen.queryByTestId('wardrobe-item-w1')).toBeNull());
    await fireEvent.press(screen.getByTestId('wardrobe-filter-all'));

    expect(await screen.findByTestId('wardrobe-item-w1')).toBeTruthy();
    expect(screen.getByTestId('stat-unmatched').props.accessibilityState.selected).toBe(false);
  });

  it('cannot be pressed when every piece pairs with something', async () => {
    listItemsMock.mockResolvedValue(itemsPage([normal]));
    await renderWithQuery(<WardrobeScreen />);

    await waitFor(() => expect(screen.getByTestId('stat-unmatched-count').props.children).toBe(0));
    expect(screen.getByTestId('stat-unmatched').props.accessibilityState.disabled).toBe(true);
  });

  it('shows the olası kombin count once the backend has it', async () => {
    await renderWithQuery(<WardrobeScreen />);

    await waitFor(() => expect(screen.getByTestId('stat-outfits').props.children).toBe(212));
  });

  it('shows the first gap on the black card and lists the suggested products in a sheet', async () => {
    await renderWithQuery(<WardrobeScreen />);

    const card = await screen.findByTestId('gap-card');
    expect(within(card).getByText('Eksik parça: bej tonlarda üst')).toBeTruthy();
    expect(within(card).getByText('Dolabına eklersen 15 yeni kombin açılıyor.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('gap-suggestions'));
    expect(await screen.findByText('Dolabını tamamlayan parçalar')).toBeTruthy();
    const product = screen.getByTestId('product-card-gp1');
    await fireEvent.press(product);
    expect(router.push).toHaveBeenCalledWith('/product/gp1?source=direct');
  });

  it('hides the gap card when there are no gaps', async () => {
    gapsMock.mockResolvedValue(wardrobeGaps({ gaps: [], suggestedProducts: [] }));
    await renderWithQuery(<WardrobeScreen />);
    await screen.findByTestId('wardrobe-item-w1');

    await waitFor(() => expect(gapsMock).toHaveBeenCalled());
    expect(screen.queryByTestId('gap-card')).toBeNull();
  });

  it('filters by top-level category and by colour', async () => {
    await renderWithQuery(<WardrobeScreen />);
    await screen.findByTestId('wardrobe-item-w1');
    expect(listItemsMock).toHaveBeenCalledWith({ page: 1, pageSize: 24 }, expect.anything());

    await fireEvent.press(screen.getByTestId('wardrobe-filter-dis-giyim'));
    await waitFor(() =>
      expect(listItemsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'dis-giyim' }),
        expect.anything(),
      ),
    );

    await fireEvent.press(screen.getByTestId('wardrobe-filter-color'));
    await fireEvent.press(await screen.findByTestId('option-Black'));
    await waitFor(() =>
      expect(listItemsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'dis-giyim', color: 'Black' }),
        expect.anything(),
      ),
    );
  });

  it('shows the pitch and the add button for an empty wardrobe, and the add sheet opens', async () => {
    listItemsMock.mockResolvedValue(itemsPage([]));
    await renderWithQuery(<WardrobeScreen />);

    expect(await screen.findByText('5 parçayla başla')).toBeTruthy();
    // The header's add button and the empty state's own.
    await fireEvent.press(screen.getAllByText('Parça ekle')[1] as never);
    expect(await screen.findByTestId('add-source-camera')).toBeTruthy();
    expect(screen.getByTestId('add-source-library')).toBeTruthy();
    expect(screen.getByTestId('add-source-catalog')).toBeTruthy();
  });

  it('shows "3/10 yükleniyor" while several photos go up', async () => {
    await renderWithQuery(<WardrobeScreen />);
    await screen.findByTestId('wardrobe-item-w1');

    await act(async () => {
      useAddStore.getState().setUploading({ current: 3, total: 10 });
    });
    expect(within(screen.getByTestId('upload-progress')).getByText('3/10 yükleniyor')).toBeTruthy();

    await act(async () => {
      useAddStore.getState().setUploading(null);
    });
    expect(screen.queryByTestId('upload-progress')).toBeNull();
  });

  it('opens the confirm sheet by itself when an item turns ready while the tab is on screen', async () => {
    getItemMock.mockResolvedValue(wardrobeItem({ id: 'w1' }));
    await renderWithQuery(<WardrobeScreen />);
    await screen.findByTestId('wardrobe-item-w1');
    expect(screen.queryByText('Bu parçayı onayla')).toBeNull();

    await act(async () => {
      useAddStore.getState().enqueueConfirm('w1');
    });

    expect(await screen.findByText('Bu parçayı onayla')).toBeTruthy();
    expect(getItemMock).toHaveBeenCalledWith('w1', expect.anything());
  });
});

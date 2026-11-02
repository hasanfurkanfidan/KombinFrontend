import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { listCategories, listProducts, searchBrands } from '@/api/endpoints/catalog';
import { archiveWardrobeItem, getWardrobeItem, updateWardrobeItem } from '@/api/endpoints/wardrobe';
import { ConfirmItemSheet } from '@/features/wardrobe/ConfirmItemSheet';

import { wardrobeItem } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/api/endpoints/catalog');

const getItemMock = jest.mocked(getWardrobeItem);
const updateMock = jest.mocked(updateWardrobeItem);
const archiveMock = jest.mocked(archiveWardrobeItem);

const onClose = jest.fn();
const onDone = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  jest.mocked(listCategories).mockResolvedValue([
    {
      id: 'c-top',
      slug: 'ust-giyim',
      name: 'Üst Giyim',
      children: [
        { id: 'c-blazer', slug: 'ust-giyim/blazer', name: 'Blazer', children: [] },
        { id: 'c-gomlek', slug: 'ust-giyim/gomlek', name: 'Gömlek', children: [] },
        { id: 'c-tisort', slug: 'ust-giyim/tisort', name: 'Tişört', children: [] },
      ],
    },
    {
      id: 'c-out',
      slug: 'dis-giyim',
      name: 'Dış Giyim',
      children: [{ id: 'c-ceket', slug: 'dis-giyim/ceket', name: 'Ceket', children: [] }],
    },
  ]);
  jest
    .mocked(listProducts)
    .mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  jest.mocked(searchBrands).mockResolvedValue({
    items: [{ id: 'b-mavi', name: 'Mavi', slug: 'mavi', logoUrl: null, websiteUrl: null }],
    page: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
  });
  updateMock.mockResolvedValue(wardrobeItem());
});

const open = (mode: 'confirm' | 'edit' = 'confirm') =>
  renderWithQuery(<ConfirmItemSheet itemId="w1" mode={mode} onClose={onClose} onDone={onDone} />);

describe('confirm sheet', () => {
  it('preselects the top category candidate and the primary colour; Kaydet is the one-tap confirmation', async () => {
    getItemMock.mockResolvedValue(wardrobeItem());
    await open();

    expect(
      (await screen.findByTestId('item-category-ust-giyim/blazer')).props.accessibilityState
        .selected,
    ).toBe(true);
    // The photo's other guesses are offered as chips too.
    expect(screen.getByTestId('item-category-ust-giyim/gomlek')).toBeTruthy();
    expect(screen.getByTestId('item-category-dis-giyim/ceket')).toBeTruthy();
    expect(screen.getByTestId('item-color-Green').props.accessibilityState.selected).toBe(true);
    // Pattern, fit, formality and seasons are collapsed under "Detaylar".
    expect(screen.queryByTestId('item-pattern-Solid')).toBeNull();

    await fireEvent.press(screen.getByTestId('item-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('w1', {}));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('sends only what the user corrected', async () => {
    getItemMock.mockResolvedValue(wardrobeItem());
    await open();

    await fireEvent.press(await screen.findByTestId('item-category-dis-giyim/ceket'));
    await fireEvent.press(screen.getByTestId('item-color-Navy'));
    await fireEvent.press(screen.getByTestId('item-details-toggle'));
    await fireEvent.press(screen.getByTestId('item-pattern-Striped'));
    await fireEvent.press(screen.getByTestId('item-formality-2'));
    await fireEvent.press(screen.getByTestId('item-season-Summer'));
    await fireEvent.changeText(screen.getByTestId('item-name'), ' Lacivert ceket ');
    await fireEvent.press(screen.getByTestId('item-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith('w1', {
      categorySlug: 'dis-giyim/ceket',
      primaryColor: 'Navy',
      pattern: 'Striped',
      formality: 2,
      seasons: ['Autumn', 'Winter', 'Summer'],
      name: 'Lacivert ceket',
    });
  });

  it('shows a one-line hint for a poor photo', async () => {
    getItemMock.mockResolvedValue(
      wardrobeItem({
        warnings: ['person_wearing'],
      }),
    );
    await open();

    expect(await screen.findByText('Kıyafeti düz bir zeminde çek')).toBeTruthy();
  });

  it('asks for the category when the photo did not give one, and waits for a pick', async () => {
    getItemMock.mockResolvedValue(wardrobeItem({ category: null, needsCategory: true }));
    await open();

    expect(await screen.findByText('Bu parça hangisi?')).toBeTruthy();
    for (const slug of ['ust-giyim/blazer', 'ust-giyim/gomlek', 'dis-giyim/ceket']) {
      expect(screen.getByTestId(`item-category-${slug}`).props.accessibilityState.selected).toBe(
        false,
      );
    }
    expect(screen.getByTestId('item-save').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('item-category-ust-giyim/gomlek'));
    await waitFor(() =>
      expect(screen.getByTestId('item-save').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(screen.getByTestId('item-save'));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('w1', { categorySlug: 'ust-giyim/gomlek' }),
    );
  });

  it('says a non-garment photo does not look like clothing, and offers to keep it or delete it', async () => {
    getItemMock.mockResolvedValue(
      wardrobeItem({
        warnings: ['not_garment'],
        analysis: {
          ...(wardrobeItem().analysis as NonNullable<ReturnType<typeof wardrobeItem>['analysis']>),
          quality: { isGarment: false, confidence: 0.9, warnings: ['not_garment'] },
        },
      }),
    );
    archiveMock.mockResolvedValue(undefined);
    await open();

    expect(await screen.findByText('Bu bir kıyafete benzemiyor')).toBeTruthy();
    expect(screen.queryByTestId('item-save')).toBeNull();

    await fireEvent.press(screen.getByTestId('item-keep-anyway'));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('w1', {}));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId('item-delete'));
    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(2));
  });
});

describe('edit mode', () => {
  it('has brand, size and price, opens the details, and validates the price', async () => {
    getItemMock.mockResolvedValue(wardrobeItem());
    await open('edit');

    expect(screen.getByText('Parçayı düzenle')).toBeTruthy();
    // Details are open from the start when editing.
    expect(await screen.findByTestId('item-pattern-Solid')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('item-brand-search'), 'mav');
    await fireEvent.press(await screen.findByTestId('item-brand-mavi'));
    await fireEvent.changeText(screen.getByTestId('item-size'), 'M');
    await fireEvent.changeText(screen.getByTestId('item-price'), 'abc');
    await fireEvent.press(screen.getByTestId('item-save'));
    expect(await screen.findByText('Geçerli bir tutar gir')).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('item-price'), '1.299,5');
    await fireEvent.changeText(screen.getByTestId('item-price'), '1299,5');
    await fireEvent.press(screen.getByTestId('item-save'));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('w1', {
        brandId: 'b-mavi',
        size: 'M',
        purchasePrice: 1299.5,
      }),
    );
  });

  it('clears a field the user emptied', async () => {
    getItemMock.mockResolvedValue(wardrobeItem({ name: 'Eski isim', size: 'L' }));
    await open('edit');

    await fireEvent.changeText(await screen.findByTestId('item-name'), '');
    await fireEvent.changeText(screen.getByTestId('item-size'), '');
    await fireEvent.press(screen.getByTestId('item-save'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('w1', { clear: ['name', 'size'] }));
  });
});

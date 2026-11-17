import { fireEvent, screen } from '@testing-library/react-native';

import { listCategories } from '@/api/endpoints/catalog';
import { OfferRow } from '@/features/catalog/OfferRow';
import { ItemTile } from '@/features/wardrobe/ItemTile';
import { TagEditor } from '@/features/social/TagEditor';
import { addDot } from '@/features/social/tagDraft';
import { useAddStore } from '@/features/wardrobe/addStore';

import { brandStore, hepsiburada, post, trendyol, wardrobeSummary } from '../fixtures';
import { renderWithQuery } from '../testUtils';

jest.mock('@/api/endpoints/catalog');

beforeEach(() => {
  jest.mocked(listCategories).mockResolvedValue([]);
});

describe('the offer row says what it shows', () => {
  it('names the seller, the price, the shipping and the cheapest one', async () => {
    await renderWithQuery(<OfferRow offer={trendyol} highlighted onPress={jest.fn()} />);

    const row = screen.getByTestId('offer-row-o1');
    expect(row.props.accessibilityLabel).toBe('Trendyol, 2.149 ₺, Kargo bedava, En düşük fiyat');
    expect(row.props.accessibilityRole).toBe('link');
    expect(row.props.accessibilityHint).toBe('Satıcının sitesi açılır');
  });

  it('adds the shipping fee, and says "Tükendi" with a disabled state and no hint', async () => {
    await renderWithQuery(
      <>
        <OfferRow offer={brandStore} highlighted={false} onPress={jest.fn()} />
        <OfferRow offer={hepsiburada} highlighted={false} onPress={jest.fn()} />
      </>,
    );

    expect(screen.getByTestId('offer-row-o2').props.accessibilityLabel).toBe(
      'Marka sitesi, 2.299 ₺, +49 ₺ kargo',
    );
    const soldOut = screen.getByTestId('offer-row-o3');
    expect(soldOut.props.accessibilityLabel).toBe('Hepsiburada, 2.449 ₺, Tükendi');
    expect(soldOut.props.accessibilityState).toMatchObject({ disabled: true });
    expect(soldOut.props.accessibilityHint).toBeUndefined();
  });
});

describe('a card that is being added speaks its state', () => {
  const onPress = jest.fn();
  const onRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAddStore.setState({ localUris: {}, failureReasons: {} });
  });

  it('says "Hazırlanıyor" and is busy while it processes', async () => {
    await renderWithQuery(
      <ItemTile
        item={wardrobeSummary({ id: 'w9', status: 'Processing', name: null })}
        width={100}
        onPress={onPress}
        onRetry={onRetry}
      />,
    );

    const tile = screen.getByTestId('wardrobe-item-w9');
    expect(tile.props.accessibilityLabel).toBe('İsimsiz parça, Hazırlanıyor');
    expect(tile.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('says it failed, why, and that a tap tries again', async () => {
    useAddStore.setState({ failureReasons: { w9: 'Fotoğraf okunamadı' } });
    await renderWithQuery(
      <ItemTile
        item={wardrobeSummary({ id: 'w9', status: 'Failed', name: 'Mavi gömlek' })}
        width={100}
        onPress={onPress}
        onRetry={onRetry}
      />,
    );

    const tile = screen.getByTestId('wardrobe-item-w9');
    expect(tile.props.accessibilityLabel).toBe('Mavi gömlek, Eklenemedi: Fotoğraf okunamadı');
    expect(tile.props.accessibilityHint).toBe('Tekrar denemek için dokun');
    await fireEvent.press(tile);
    expect(onRetry).toHaveBeenCalledWith('w9');
  });

  it('is just its name once it is ready', async () => {
    await renderWithQuery(
      <ItemTile
        item={wardrobeSummary({ id: 'w9', status: 'Ready', name: 'Mavi gömlek' })}
        width={100}
        onPress={onPress}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId('wardrobe-item-w9').props.accessibilityLabel).toBe('Mavi gömlek');
  });
});

describe('a tag dot can be placed without dragging', () => {
  it('moves up, down, left and right by 5 % through the screen reader’s actions', async () => {
    const dots = addDot([]);
    const onChange = jest.fn();
    await renderWithQuery(
      <TagEditor post={post({ id: 'po1' })} dots={dots} onChange={onChange} onNext={jest.fn()} />,
    );

    const dot = screen.getByTestId(`edit-dot-${dots[0]?.key}`);
    expect(dot.props.accessibilityRole).toBe('adjustable');
    expect(dot.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
      'moveUp',
      'moveDown',
      'moveLeft',
      'moveRight',
    ]);

    const before = dots[0]!;
    await fireEvent(dot, 'accessibilityAction', { nativeEvent: { actionName: 'moveRight' } });
    const moved = (onChange.mock.calls[0]?.[0] as typeof dots)[0]!;
    expect(moved.x - before.x).toBeCloseTo(0.05, 2);
    expect(moved.y).toBeCloseTo(before.y, 5);

    await fireEvent(dot, 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    const up = (onChange.mock.calls[1]?.[0] as typeof dots)[0]!;
    expect(up.y - before.y).toBeCloseTo(-0.05, 2);
  });
});

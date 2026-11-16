import { fireEvent, render, screen } from '@testing-library/react-native';

import { PieceLabel } from '@/features/budget/BudgetOutfitSection';
import { SHIPPING_NOTE_ENABLED, shippingNote } from '@/features/budget/shipping';

import { boughtPiece } from '../../fixtures';

const noop = () => undefined;

describe('the "kargo dahil" line under a piece’s price', () => {
  it('is drawn under the price, above the seller, when the row is given a note', async () => {
    await render(
      <PieceLabel
        piece={boughtPiece()}
        shippingNote="kargo dahil"
        signedIn
        onBuy={noop}
        onAddSize={noop}
      />,
    );

    expect(screen.getByTestId('budget-shipping-Bottom')).toHaveTextContent('kargo dahil');
    // The buy link still names the piece, price and seller.
    expect(screen.getByTestId('budget-buy-Bottom')).toBeTruthy();
  });

  it('is part of the buy link, so pressing it still buys', async () => {
    const onBuy = jest.fn();
    await render(
      <PieceLabel
        piece={boughtPiece()}
        shippingNote="kargo dahil"
        signedIn
        onBuy={onBuy}
        onAddSize={noop}
      />,
    );
    await fireEvent.press(screen.getByTestId('budget-shipping-Bottom'));
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('is not drawn without a note', async () => {
    await render(<PieceLabel piece={boughtPiece()} signedIn onBuy={noop} onAddSize={noop} />);
    expect(screen.queryByTestId('budget-shipping-Bottom')).toBeNull();
    expect(screen.queryByText('kargo dahil')).toBeNull();
  });

  it('says "kargo dahil" for a free-shipping offer', () => {
    expect(SHIPPING_NOTE_ENABLED).toBe(true);
    expect(shippingNote(boughtPiece())).toBe('kargo dahil');
  });

  it('names the fee when the price already carries one', () => {
    const piece = boughtPiece();
    const withFee = { ...piece, offer: piece.offer && { ...piece.offer, shippingCost: 49.9 } };
    expect(shippingNote(withFee)).toBe('49,90 ₺ kargo dahil');
  });

  it('has no note for an owned piece, which has no offer', () => {
    expect(shippingNote(boughtPiece({ offer: null }))).toBeNull();
  });
});

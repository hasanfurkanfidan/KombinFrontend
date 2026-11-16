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

  it('stays off until the contract has the field: the switch is false and no piece gets a note', async () => {
    expect(SHIPPING_NOTE_ENABLED).toBe(false);
    expect(shippingNote(boughtPiece())).toBeNull();
  });
});

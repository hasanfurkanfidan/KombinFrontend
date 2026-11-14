import { render, screen, within } from '@testing-library/react-native';

import { figureBands, miniFigurePieces } from '@/features/outfits/labels';
import { OutfitPieces } from '@/features/outfits/OutfitPieces';

import { gapPiece, outfitPiece } from '../../fixtures';

const top = outfitPiece({ slot: 'Top', name: 'Triko' });
const outer = outfitPiece({ slot: 'Outerwear', name: 'Trençkot' });
const bottom = outfitPiece({ slot: 'Bottom', name: 'Pantolon' });
const shoes = outfitPiece({ slot: 'Shoes', name: 'Loafer' });
const belt = outfitPiece({ slot: 'Accessory', name: 'Kemer' });

describe('figureBands', () => {
  it('stands the outfit head to toe and layers outerwear over the top', () => {
    const { bands, accessories } = figureBands([shoes, belt, bottom, top, outer]);
    expect(bands.map((band) => band.kind)).toEqual(['torso', 'bottom', 'shoes']);
    expect(bands[0]?.pieces.map((piece) => piece.name)).toEqual(['Trençkot', 'Triko']);
    expect(accessories.map((piece) => piece.name)).toEqual(['Kemer']);
  });

  it('leaves out bands without a piece and sends a second piece of a slot to the side', () => {
    const second = outfitPiece({ slot: 'Top', name: 'Gömlek' });
    const { bands, accessories } = figureBands([top, second, shoes]);
    expect(bands.map((band) => band.kind)).toEqual(['torso', 'shoes']);
    expect(accessories.map((piece) => piece.name)).toEqual(['Gömlek']);
  });
});

describe('miniFigurePieces', () => {
  it('stacks three pieces: the top (not the outerwear), the bottom and the shoes', () => {
    expect(miniFigurePieces([outer, top, bottom, shoes, belt]).map((piece) => piece.name)).toEqual([
      'Triko',
      'Pantolon',
      'Loafer',
    ]);
  });

  it('uses the outerwear when there is no top, and fills up from the rest', () => {
    expect(miniFigurePieces([belt, outer]).map((piece) => piece.name)).toEqual([
      'Trençkot',
      'Kemer',
    ]);
  });
});

describe('OutfitPieces (the standing figure)', () => {
  it('draws a missing piece as a ghost that carries "Eksik · price", with the seller beside it', async () => {
    await render(<OutfitPieces pieces={[gapPiece, bottom, shoes]} width={342} />);

    const ghost = screen.getByTestId(`piece-${gapPiece.slot}`);
    expect(within(ghost).getByTestId(`piece-pill-${gapPiece.slot}`)).toBeTruthy();
    expect(within(ghost).getByText(/^Eksik · /)).toBeTruthy();
    expect(screen.getByText(/^En ucuzu /)).toBeTruthy();
    expect(within(screen.getByTestId('piece-pill-Bottom')).getByText('Dolabında var')).toBeTruthy();
  });

  it('sizes the wells by role: the shoes are smaller than the bottom', async () => {
    await render(<OutfitPieces pieces={[top, bottom, shoes]} width={342} />);

    const height = (slot: string) => {
      const style = screen.getByTestId(`piece-${slot}`).props.style as object[];
      return Object.assign({}, ...style.flat(Infinity).filter(Boolean)).height as number;
    };
    expect(height('Shoes')).toBeLessThan(height('Bottom'));
    expect(height('Top')).toBeLessThan(height('Bottom'));
  });
});

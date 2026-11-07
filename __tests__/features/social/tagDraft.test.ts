import {
  addDot,
  canPublish,
  chooseDot,
  dotsFromProposals,
  moveDot,
  removeDot,
  toPublishTags,
  unconfirmedCount,
} from '@/features/social/tagDraft';

import { proposal } from '../../fixtures';

describe('tag draft', () => {
  it('starts from the proposals with nothing confirmed', () => {
    const dots = dotsFromProposals([proposal({ id: 'a' }), proposal({ id: 'b', x: 0.4 })]);

    expect(dots.map((dot) => dot.key)).toEqual(['a', 'b']);
    expect(dots.every((dot) => dot.choice === null)).toBe(true);
    expect(unconfirmedCount(dots)).toBe(2);
    expect(canPublish(dots)).toBe(false);
  });

  it('never serialises a dot the author did not confirm', () => {
    const dots = dotsFromProposals([
      proposal({ id: 'a' }),
      proposal({ id: 'b' }),
      proposal({ id: 'c' }),
    ]);
    const confirmed = chooseDot(dots, 'b', {
      kind: 'Wardrobe',
      wardrobeItemId: 'w1',
      name: 'Blazer',
    });

    const tags = toPublishTags(confirmed);

    // Exactly the one dot with a choice: a and c are proposals nobody confirmed.
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ kind: 'Wardrobe', wardrobeItemId: 'w1', productId: null });
    expect(toPublishTags(dots)).toEqual([]);
  });

  it("does not treat a proposal's own target as confirmed (a saved outfit's pieces)", () => {
    const dots = dotsFromProposals([proposal({ id: 'a', source: 'Outfit', wardrobeItemId: 'w9' })]);

    expect(dots[0]?.suggestion).toMatchObject({ kind: 'Wardrobe', wardrobeItemId: 'w9' });
    expect(dots[0]?.choice).toBeNull();
    expect(toPublishTags(dots)).toEqual([]);

    // One explicit tap confirms the suggestion.
    const tapped = chooseDot(dots, 'a', dots[0]?.suggestion ?? { kind: 'Unknown', label: '' });
    expect(toPublishTags(tapped)).toHaveLength(1);
  });

  it('can be published once every dot is confirmed or deleted', () => {
    let dots = dotsFromProposals([proposal({ id: 'a' }), proposal({ id: 'b' })]);
    dots = chooseDot(dots, 'a', { kind: 'Product', productId: 'p1', name: 'Blazer' });
    expect(canPublish(dots)).toBe(false);

    dots = removeDot(dots, 'b');
    expect(canPublish(dots)).toBe(true);
    expect(toPublishTags(dots)).toEqual([
      expect.objectContaining({ kind: 'Product', productId: 'p1', wardrobeItemId: null }),
    ]);
  });

  it('trims an unknown label to 60 characters and sends none when it is empty', () => {
    let dots = dotsFromProposals([proposal({ id: 'a' }), proposal({ id: 'b' })]);
    dots = chooseDot(dots, 'a', { kind: 'Unknown', label: `  ${'x'.repeat(80)}  ` });
    dots = chooseDot(dots, 'b', { kind: 'Unknown', label: '   ' });

    const [first, second] = toPublishTags(dots);
    expect(first?.label).toHaveLength(60);
    expect(second?.label).toBeNull();
  });

  it('adds an unconfirmed dot in the middle, up to six', () => {
    let dots = addDot([]);
    expect(dots).toHaveLength(1);
    expect(dots[0]).toMatchObject({ source: 'User', choice: null });
    expect(dots[0]?.x).toBeCloseTo(0.35);
    expect(canPublish(dots)).toBe(false);

    for (let index = 0; index < 8; index += 1) {
      dots = addDot(dots);
    }
    expect(dots).toHaveLength(6);
    expect(new Set(dots.map((dot) => dot.key)).size).toBe(6);
  });

  it('moves a dot by its centre and keeps its box inside the picture', () => {
    const dots = dotsFromProposals([proposal({ id: 'a', x: 0.2, y: 0.2, w: 0.4, h: 0.2 })]);

    const moved = moveDot(dots, 'a', { left: 0.5, top: 0.5 });
    expect(moved[0]).toMatchObject({ x: 0.3, y: 0.4 });

    const pushedOut = moveDot(dots, 'a', { left: 2, top: -1 });
    expect(pushedOut[0]).toMatchObject({ x: 0.6, y: 0 });
  });
});

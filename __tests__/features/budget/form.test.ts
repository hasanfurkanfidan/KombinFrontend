import {
  EMPTY_BUDGET_FORM,
  anonymousBody,
  budgetBand,
  budgetResult,
  dateOptions,
  parseAmount,
  sanitizeAmount,
  signedInBody,
  toAsk,
  validateBudget,
  wardrobeHasShoes,
} from '@/features/budget/form';
import { tr } from '@/i18n/tr';

import { budgetOutfit, budgetOutfits, wardrobeStats } from '../../fixtures';

const filled = { ...EMPTY_BUDGET_FORM, amount: '3000' };

describe('the budget amount', () => {
  it('keeps digits only, drops leading zeros and stops at six digits', () => {
    expect(sanitizeAmount('3.000 ₺')).toBe('3000');
    expect(sanitizeAmount('007')).toBe('7');
    expect(sanitizeAmount('1234567')).toBe('123456');
    expect(sanitizeAmount('abc')).toBe('');
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('2500')).toBe(2500);
  });

  it.each([
    ['', true],
    ['99', true],
    ['100', false],
    ['100000', false],
    ['100001', true],
  ])('amount "%s" is invalid: %s', (amount, invalid) => {
    const errors = validateBudget({ ...filled, amount }, true);
    expect(errors.amount).toBe(invalid ? tr.budgetAmountInvalid : undefined);
  });
});

describe('who is asked for what', () => {
  it('asks a visitor for the audience, and nobody else', () => {
    expect(validateBudget(filled, false).audience).toBe(tr.budgetAudienceRequired);
    expect(validateBudget({ ...filled, audience: 'Men' }, false)).toEqual({});
    expect(validateBudget(filled, true)).toEqual({});
  });

  it('sends a signed-in user the wardrobe, the style and "Ayakkabım var" as includeShoes: false', () => {
    const ask = toAsk(
      { ...filled, occasion: 'office', date: 'tomorrow', haveShoes: true, audience: 'Men' },
      { signedIn: true, personaId: 'pe1', seed: 2 },
    );
    expect(signedInBody(ask)).toEqual({
      budget: 3000,
      occasion: 'office',
      date: 'tomorrow',
      useWardrobe: true,
      seed: 2,
      count: 3,
      personaId: 'pe1',
      includeShoes: false,
    });
  });

  it('never sends a visitor a wardrobe, a style or an audience of a signed-in user', () => {
    const ask = toAsk(
      { ...filled, audience: 'Women', useWardrobe: true },
      { signedIn: false, personaId: 'pe1', seed: 0 },
    );
    expect(ask.useWardrobe).toBe(false);
    expect(ask.personaId).toBeUndefined();
    expect(anonymousBody(ask)).toEqual({
      budget: 3000,
      audience: 'Women',
      occasion: null,
      date: 'today',
      seed: 0,
      count: 3,
      includeShoes: true,
    });
  });
});

describe('analytics values', () => {
  it.each([
    [499, 'under500'],
    [500, '500to1500'],
    [1499, '500to1500'],
    [1500, '1500to5000'],
    [4999, '1500to5000'],
    [5000, 'over5000'],
  ])('a budget of %i is the band %s', (budget, band) => {
    expect(budgetBand(budget)).toBe(band);
  });

  const ask = (haveShoes: boolean) => toAsk({ ...filled, haveShoes }, { signedIn: true, seed: 0 });

  it('tells fits, withoutShoes, overBudget and none apart', () => {
    expect(budgetResult(budgetOutfits(), ask(false))).toBe('fits');
    expect(budgetResult(budgetOutfits({ withoutShoes: true }), ask(false))).toBe('withoutShoes');
    expect(
      budgetResult(budgetOutfits({ overBudget: true, outfits: [budgetOutfit()] }), ask(false)),
    ).toBe('overBudget');
    expect(budgetResult(budgetOutfits({ outfits: [] }), ask(false))).toBe('none');
  });

  it('does not call it "withoutShoes" when the user said they have shoes', () => {
    expect(budgetResult(budgetOutfits({ withoutShoes: true }), ask(true))).toBe('fits');
  });
});

describe('small helpers', () => {
  it('finds shoes by the top-level category of the wardrobe stats', () => {
    expect(wardrobeHasShoes(undefined)).toBe(false);
    expect(
      wardrobeHasShoes(wardrobeStats({ byCategory: [{ slug: 'ust-giyim/blazer', count: 3 }] })),
    ).toBe(false);
    expect(
      wardrobeHasShoes(wardrobeStats({ byCategory: [{ slug: 'ayakkabi/bot', count: 1 }] })),
    ).toBe(true);
    expect(
      wardrobeHasShoes(wardrobeStats({ byCategory: [{ slug: 'ayakkabi/bot', count: 0 }] })),
    ).toBe(false);
  });

  it('offers today, tomorrow and each day up to a week ahead', () => {
    const options = dateOptions(new Date('2026-11-15T09:00:00Z'));
    expect(options.map((option) => option.value)).toEqual([
      'today',
      'tomorrow',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(options[2]).toMatchObject({ label: 'Sal 17', spoken: 'Salı, 17 Kasım' });
  });
});

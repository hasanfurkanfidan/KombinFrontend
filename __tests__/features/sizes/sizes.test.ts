import { sizePill } from '@/features/sizes/sizeHint';
import { measurementsSchema } from '@/features/sizes/measurementsSchema';
import { groupByBrand } from '@/features/sizes/SizeMapScreen';
import { withPossessive } from '@/utils/turkish';

import { sizeEntry } from '../../fixtures';

describe('size pill', () => {
  const base = { group: 'Tops', confidence: null, suggestion: null } as const;

  it('is solid for entered and confirmed sizes', () => {
    expect(sizePill({ ...base, size: 'L', source: 'UserEntered' })).toEqual({
      kind: 'known',
      size: 'L',
    });
    expect(sizePill({ ...base, size: 'M', source: 'Confirmed' })).toEqual({
      kind: 'known',
      size: 'M',
    });
  });

  it('is a guess for stored inferred sizes and for suggestions from other brands', () => {
    expect(sizePill({ ...base, size: 'L', source: 'Inferred' })).toEqual({
      kind: 'inferred',
      size: 'L',
    });
    expect(
      sizePill({
        ...base,
        size: null,
        source: null,
        suggestion: { size: 'M', source: 'Inferred', confidence: 0.6 },
      }),
    ).toEqual({ kind: 'inferred', size: 'M' });
  });

  it('is empty without a hint', () => {
    expect(sizePill(null)).toEqual({ kind: 'none' });
    expect(sizePill({ ...base, size: null, source: null })).toEqual({ kind: 'none' });
  });
});

describe('measurements schema', () => {
  const valid = {
    heightCm: '178',
    weightKg: '76,5',
    chestCm: '100',
    waistCm: '84',
    city: 'Ankara',
  };

  it('turns text into numbers, with a decimal comma for the weight', () => {
    expect(measurementsSchema.parse(valid)).toEqual({
      heightCm: 178,
      weightKg: 76.5,
      chestCm: 100,
      waistCm: 84,
      city: 'Ankara',
    });
  });

  it('trims the city, and a blank one clears it', () => {
    expect(measurementsSchema.parse({ ...valid, city: '  İzmir ' }).city).toBe('İzmir');
    expect(measurementsSchema.parse({ ...valid, city: '   ' }).city).toBeNull();
  });

  it('accepts 80 characters of city and refuses 81', () => {
    expect(measurementsSchema.safeParse({ ...valid, city: 'a'.repeat(80) }).success).toBe(true);
    const long = measurementsSchema.safeParse({ ...valid, city: 'a'.repeat(81) });
    expect(long.error?.issues.map((issue) => issue.message)).toEqual([
      'Şehir en fazla 80 karakter olabilir',
    ]);
  });

  it('treats an empty field as cleared', () => {
    expect(measurementsSchema.parse({ ...valid, chestCm: '' }).chestCm).toBeNull();
  });

  it('enforces the backend ranges', () => {
    const messages = (input: Record<string, string>) =>
      measurementsSchema
        .safeParse({ ...valid, ...input })
        .error?.issues.map((issue) => issue.message);

    expect(messages({ heightCm: '119' })).toEqual(['120 ile 230 arasında olmalı']);
    expect(messages({ heightCm: '231' })).toEqual(['120 ile 230 arasında olmalı']);
    expect(messages({ weightKg: '29' })).toEqual(['30 ile 250 arasında olmalı']);
    expect(messages({ chestCm: '49' })).toEqual(['50 ile 200 arasında olmalı']);
    expect(messages({ waistCm: '201' })).toEqual(['50 ile 200 arasında olmalı']);
    expect(messages({ heightCm: '120', waistCm: '200' })).toBeUndefined();
  });

  it('rejects text and fractional centimetres', () => {
    const result = measurementsSchema.safeParse({ ...valid, heightCm: '178,5', waistCm: 'x' });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Geçerli bir sayı gir',
      'Geçerli bir sayı gir',
    ]);
  });
});

describe('size map grouping', () => {
  it('makes one row per brand with the top, bottom and shoe sizes', () => {
    const rows = groupByBrand([
      sizeEntry({ id: '1', group: 'Tops', size: 'L' }),
      sizeEntry({ id: '2', group: 'Bottoms', size: '32/32' }),
      sizeEntry({ id: '3', group: 'Shoes', size: '43' }),
      sizeEntry({ id: '4', brand: { id: 'b2', name: 'Zara', slug: 'zara' }, size: 'M' }),
    ]);

    expect(rows.map((row) => row.brand)).toEqual(['Mavi', 'Zara']);
    expect(rows[0]?.tops?.size).toBe('L');
    expect(rows[0]?.bottoms?.size).toBe('32/32');
    expect(rows[0]?.shoes?.size).toBe('43');
    expect(rows[1]?.bottoms).toBeUndefined();
  });

  it('shows outerwear in the top column only when there is no top size', () => {
    const [onlyOuterwear] = groupByBrand([sizeEntry({ group: 'Outerwear', size: 'XL' })]);
    expect(onlyOuterwear?.tops?.size).toBe('XL');

    const [both] = groupByBrand([
      sizeEntry({ id: '1', group: 'Outerwear', size: 'XL' }),
      sizeEntry({ id: '2', group: 'Tops', size: 'L' }),
    ]);
    expect(both?.tops?.size).toBe('L');
  });
});

describe('Turkish number possessive', () => {
  it('follows how the number is read', () => {
    expect(withPossessive(0)).toBe("0'ı");
    expect(withPossessive(1)).toBe("1'i");
    expect(withPossessive(2)).toBe("2'si");
    expect(withPossessive(3)).toBe("3'ü");
    expect(withPossessive(4)).toBe("4'ü");
    expect(withPossessive(5)).toBe("5'i");
    expect(withPossessive(6)).toBe("6'sı");
    expect(withPossessive(7)).toBe("7'si");
    expect(withPossessive(8)).toBe("8'i");
    expect(withPossessive(9)).toBe("9'u");
    expect(withPossessive(10)).toBe("10'u");
    expect(withPossessive(20)).toBe("20'si");
    expect(withPossessive(40)).toBe("40'ı");
    expect(withPossessive(12)).toBe("12'si");
  });
});

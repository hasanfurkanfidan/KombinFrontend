import { parseAmountInput, prefillTarget, validateTarget } from '@/features/alerts/target';

describe('alert target price', () => {
  it('pre-fills 10 % below the lowest price in whole liras', () => {
    expect(prefillTarget(2149)).toBe(1934);
    expect(prefillTarget(1000)).toBe(900);
    expect(prefillTarget(649.9)).toBe(584);
  });

  it('never pre-fills zero for a very cheap product', () => {
    expect(prefillTarget(1)).toBeGreaterThan(0);
    expect(prefillTarget(1)).toBeLessThan(1);
  });

  it('accepts Turkish and plain number formats', () => {
    expect(parseAmountInput('1934')).toBe(1934);
    expect(parseAmountInput('1.934')).toBe(1934);
    expect(parseAmountInput('1.934,50')).toBe(1934.5);
    expect(parseAmountInput('1934,5 ₺')).toBe(1934.5);
    expect(parseAmountInput('1934.5')).toBe(1934.5);
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('12,345')).toBeNull();
    expect(parseAmountInput('')).toBeNull();
  });

  it('requires a value', () => {
    expect(validateTarget('  ', 2149)).toEqual({ value: null, error: 'required' });
  });

  it('rejects zero, negatives and text', () => {
    expect(validateTarget('0', 2149).error).toBe('invalid');
    expect(validateTarget('-5', 2149).error).toBe('invalid');
    expect(validateTarget('çok ucuz', 2149).error).toBe('invalid');
  });

  it('requires the target to be below the current lowest price', () => {
    expect(validateTarget('2149', 2149).error).toBe('notBelow');
    expect(validateTarget('3000', 2149).error).toBe('notBelow');
    expect(validateTarget('2148,99', 2149)).toEqual({ value: 2148.99, error: null });
    expect(validateTarget('1934', 2149)).toEqual({ value: 1934, error: null });
  });

  it('accepts the pre-filled value as is', () => {
    const lowest = 2149;
    expect(validateTarget(String(prefillTarget(lowest)), lowest).error).toBeNull();
  });
});

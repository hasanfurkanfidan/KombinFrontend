import { tr } from '@/i18n/tr';

/**
 * Enforces `docs/design/glossary.md` on every user-facing string. Function entries are called with sample arguments
 * so their templates are checked too.
 */
const SAMPLE = 'X';

function render(value: unknown): string {
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, () => SAMPLE);
    return String((value as (...input: unknown[]) => unknown)(...args));
  }
  return String(value);
}

const entries = Object.entries(tr).map(([key, value]) => [key, render(value)] as const);

/** A whole word, Turkish letters included (`\b` does not know "ş" or "ı"). */
const word = (stem: string, suffix = '') =>
  new RegExp(`(?<!\\p{L})${stem}${suffix}(?!\\p{L})`, 'iu');

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: 'persona', pattern: /persona/iu },
  // "uyum" alone; "uyumlu" is everyday Turkish and fine.
  { name: 'uyum', pattern: word('uyum') },
  { name: 'komşu', pattern: word('komşu') },
  { name: 'vurgu', pattern: word('vurgu') },
  { name: 'nötr', pattern: word('nötr') },
  { name: 'tonal', pattern: word('tonal') },
  { name: 'eşleş-', pattern: /(?<!\p{L})eşleş/iu },
];

describe('glossary', () => {
  it.each(BANNED)('no string uses "$name"', ({ pattern }) => {
    const offenders = entries.filter(([, text]) => pattern.test(text)).map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('uses "Akış" only as the tab name, never in a sentence', () => {
    const offenders = entries
      .filter(([key, text]) => key !== 'tabFeed' && /akış/iu.test(text))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
    expect(tr.tabFeed).toBe('Akış');
  });

  it('uses "Takip" only for following people', () => {
    // Every "takip" string must be about people: following, followers, followed.
    const aboutPeople = /takip (et|ed|etti)|takipçi|takipler/iu;
    const offenders = entries
      .filter(([, text]) => /takip/iu.test(text) && !aboutPeople.test(text))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('keeps "Keşfet" for the products tab only', () => {
    const offenders = entries
      .filter(([key, text]) => key !== 'tabDiscover' && /keşfet/iu.test(text))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('uses "?" only to end a real question, never as an uncertainty marker ("43?", "L?")', () => {
    // A question mark follows a whole word (three letters or more, or the particle "mı/mi/mu/mü") and ends the sentence.
    const marker = /(?<!\p{L}{3})(?<!\sm[ıiuü])\?|\?(?!["”']?(\s|$))/u;
    const offenders = entries.filter(([, text]) => marker.test(text)).map(([key]) => key);
    expect(offenders).toEqual([]);
    expect(marker.test('43?')).toBe(true);
    expect(marker.test('L? ')).toBe(true);
    expect(marker.test('Neden?')).toBe(false);
  });

  it('puts a noun or verb next to every percentage', () => {
    const offenders = entries
      .filter(([, text]) => text.includes('%') && !/\p{L}{3,}/u.test(text.replace(/%\S*/g, '')))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
    expect(tr.discountBadge(28)).toBe('%28 indirim');
  });

  it('writes the match score as "Sana uygun %N"', () => {
    expect(tr.productMatch(72)).toBe('Sana uygun %72');
    expect(tr.postMatch(72)).toBe('Sana uygun %72');
  });
});

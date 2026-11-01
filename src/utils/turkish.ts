const BACK_VOWELS = 'aıou';
const FRONT_VOWELS = 'eiöü';
const VOICELESS = 'fstkçşhp';

/**
 * Turkish ablative suffix ("dan/den/tan/ten") for a name, following vowel and consonant harmony.
 * Spelling-based: a foreign name that is pronounced differently from how it is written can come out wrong.
 */
export function ablativeSuffix(name: string): string {
  const letters = [...name.toLocaleLowerCase('tr-TR')].filter((char) => /\p{L}/u.test(char));
  const lastVowel = [...letters]
    .reverse()
    .find((char) => BACK_VOWELS.includes(char) || FRONT_VOWELS.includes(char));
  const lastLetter = letters[letters.length - 1] ?? '';
  const consonant = VOICELESS.includes(lastLetter) ? 't' : 'd';
  const vowel = lastVowel && FRONT_VOWELS.includes(lastVowel) ? 'e' : 'a';
  return `${consonant}${vowel}n`;
}

/** "Trendyol" -> "Trendyol'dan". */
export function withAblative(name: string): string {
  return `${name}'${ablativeSuffix(name)}`;
}

const ONES_SUFFIX = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
const TENS_SUFFIX = ['ü', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];

/**
 * Third-person possessive for a number, as in "2'si hedef fiyatın altında": the suffix follows how the
 * number is read (iki → si, altı → sı, on → u). Covers 0–99; larger numbers follow their last two digits.
 */
export function withPossessive(value: number): string {
  const whole = Math.abs(Math.trunc(value));
  const ones = whole % 10;
  const tens = Math.floor(whole / 10) % 10;
  const suffix =
    ones === 0 && whole !== 0 ? (TENS_SUFFIX[tens] ?? 'i') : (ONES_SUFFIX[ones] ?? 'i');
  return `${whole}'${suffix}`;
}

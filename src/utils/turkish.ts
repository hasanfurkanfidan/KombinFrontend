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

/** The word the backend wants in `confirm`; it is sent as is, whatever the user typed. */
export const DELETE_CONFIRM_WORD = 'SİL';

/**
 * Whether the typed text is the confirmation word. Like the backend: "SİL", "sil", "SIL" and "Sil" all count (a phone
 * keyboard in Turkish or English makes any of them), with spaces around. The dotted and dotless i are folded by hand
 * rather than trusting the engine's Turkish casing.
 */
export function matchesDeleteWord(text: string): boolean {
  const folded = [...text.trim()]
    .map((letter) => ('İiıI'.includes(letter) ? 'I' : letter.toUpperCase()))
    .join('');
  return folded === 'SIL';
}

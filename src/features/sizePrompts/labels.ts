import type { SizePrompt, SizePromptAnswer } from '@/api/models';
import { tr } from '@/i18n/tr';

/** The one confirming line after an answer. A confirmed fit names the brand and the size it saved. */
export function confirmationLine(
  prompt: Pick<SizePrompt, 'brand'>,
  answer: SizePromptAnswer,
  size: string | null,
): string {
  switch (answer) {
    case 'BoughtFits':
      return size
        ? tr.sizePromptSavedFits(prompt.brand.name, size)
        : tr.sizePromptSavedNote(prompt.brand.name);
    case 'BoughtTooSmall':
    case 'BoughtTooLarge':
      return tr.sizePromptSavedNote(prompt.brand.name);
    case 'NotBought':
      return tr.sizePromptSavedNotBought;
    case 'NeverAsk':
      return tr.sizePromptSavedNever;
  }
}

/**
 * The size to start the step with: the size map's entry for this brand, when the question can take it. With a list of
 * sizes the entry must be one of them (so the chip is really there to be selected); without a list it fills the field.
 */
export function initialSize(prompt: Pick<SizePrompt, 'knownSize' | 'availableSizes'>): string {
  const known = prompt.knownSize?.size ?? '';
  if (prompt.availableSizes.length === 0) {
    return known;
  }
  return prompt.availableSizes.find((size) => size.toLowerCase() === known.toLowerCase()) ?? '';
}

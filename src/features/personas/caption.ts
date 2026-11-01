import type { Persona } from '@/api/models';
import { styleFamilyLabels } from '@/features/onboarding/labels';
import { tr } from '@/i18n/tr';
import { formatAmount } from '@/utils/money';

/** "800–2.500 ₺", "800 ₺ üzeri", "2.500 ₺ altı"; null when the persona has no budget. */
export function budgetCaption(persona: Pick<Persona, 'budgetMin' | 'budgetMax'>): string | null {
  const { budgetMin, budgetMax } = persona;
  if (budgetMin !== null && budgetMax !== null) {
    return tr.personaBudgetRange(formatAmount(budgetMin), formatAmount(budgetMax));
  }
  if (budgetMin !== null) {
    return tr.personaBudgetFrom(formatAmount(budgetMin));
  }
  if (budgetMax !== null) {
    return tr.personaBudgetUpTo(formatAmount(budgetMax));
  }
  return null;
}

/** "Minimal, Klasik · 800–2.500 ₺": the top style families, then the budget range when one is set. */
export function personaCaption(persona: Persona): string {
  const families = persona.styleSummary.topFamilies.map((family) =>
    Object.hasOwn(styleFamilyLabels, family)
      ? styleFamilyLabels[family as keyof typeof styleFamilyLabels]
      : family,
  );
  const parts = [
    families.length > 0 ? families.join(', ') : tr.personaCaptionNew,
    budgetCaption(persona),
  ];
  return parts.filter((part): part is string => part !== null).join(' · ');
}

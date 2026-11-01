import type { StyleFamily } from '@/api/models';
import { tr } from '@/i18n/tr';

// A Record over the generated union: a new backend family fails the typecheck until it is labelled.
export const styleFamilyLabels: Record<StyleFamily, string> = {
  Minimal: tr.styleFamilyMinimal,
  Classic: tr.styleFamilyClassic,
  Street: tr.styleFamilyStreet,
  Sporty: tr.styleFamilySporty,
  Boho: tr.styleFamilyBoho,
  Formal: tr.styleFamilyFormal,
  Romantic: tr.styleFamilyRomantic,
  Edgy: tr.styleFamilyEdgy,
};

import { tr } from '@/i18n/tr';
import { fetchLegal, legalContact } from '@/features/legal/legal';

/**
 * "Bu hesap kapatıldı. Destek için {contact}": the contact comes from `GET /legal` when the backend publishes one;
 * without it (or when the page cannot be fetched) only the first sentence is shown.
 */
export async function accountDisabledMessage(): Promise<string> {
  try {
    const contact = legalContact(await fetchLegal());
    return contact ? tr.authAccountDisabledContact(contact) : tr.authAccountDisabled;
  } catch {
    return tr.authAccountDisabled;
  }
}

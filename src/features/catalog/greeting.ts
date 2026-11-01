import { tr } from '@/i18n/tr';
import { dayPart } from '@/utils/dates';

const GREETINGS = {
  morning: tr.discoverGreetingMorning,
  afternoon: tr.discoverGreetingAfternoon,
  evening: tr.discoverGreetingEvening,
} as const;

/** "İyi akşamlar, Furkan" by the local hour; just the greeting when there is no name yet. */
export function buildGreeting(now: Date, displayName: string | undefined): string {
  const greeting = GREETINGS[dayPart(now)];
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName ? `${greeting}, ${firstName}` : greeting;
}

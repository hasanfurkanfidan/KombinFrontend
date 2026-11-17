import { dateOptions } from '@/features/budget/form';
import { homeCardDay, istanbulDay, istanbulHour } from '@/features/outfits/homeCard';
import { todayIso } from '@/features/trips/calendar';

/**
 * One clock for the whole app: Europe/Istanbul, whatever the phone's own zone says. The three test files in this folder
 * run these cases with the device in Istanbul, London and Tokyo (see `support/timeZoneEnvironment.js`); nothing here
 * mocks `getHours`, the instants are real and only the zone differs.
 */
const AT = {
  // 17:59 Istanbul: still today's card. In Tokyo that is already 23:59, in London 14:59.
  beforeSwitch: new Date('2026-11-17T14:59:00Z'),
  // 18:00 Istanbul: the card turns to tomorrow. Tokyo reads 00:00 of the next day.
  atSwitch: new Date('2026-11-17T15:00:00Z'),
  // 00:30 Istanbul on the 18th. London and the UTC clock still say the 17th.
  afterMidnight: new Date('2026-11-17T21:30:00Z'),
};

export function describeIstanbulClock(zone: string, offsetMinutes: number): void {
  describe(`one Istanbul clock, device in ${zone}`, () => {
    it('really runs in that zone (the harness works)', () => {
      expect(new Date(AT.atSwitch).getTimezoneOffset()).toBe(offsetMinutes);
    });

    it('reads the hour in Istanbul', () => {
      expect(istanbulHour(AT.beforeSwitch)).toBe(17);
      expect(istanbulHour(AT.atSwitch)).toBe(18);
      expect(istanbulHour(AT.afterMidnight)).toBe(0);
    });

    it('turns the card to tomorrow at 18:00 Istanbul, not at 18:00 on the phone', () => {
      expect(homeCardDay(AT.beforeSwitch)).toBe('today');
      expect(homeCardDay(AT.atSwitch)).toBe('tomorrow');
      // Half past midnight is the start of the new day's card.
      expect(homeCardDay(AT.afterMidnight)).toBe('today');
    });

    it('names the same calendar day for the card, the trip calendar and the budget dates', () => {
      for (const [now, day] of [
        [AT.beforeSwitch, '2026-11-17'],
        [AT.atSwitch, '2026-11-17'],
        [AT.afterMidnight, '2026-11-18'],
      ] as const) {
        expect(istanbulDay(now)).toBe(day);
        expect(todayIso(now)).toBe(day);
      }
    });

    it('starts the budget date chips from the Istanbul day', () => {
      const late = dateOptions(AT.afterMidnight);
      // Tomorrow is the 19th for the backend, so the first dated chip is the 20th and the last the 25th.
      expect(late[2]).toMatchObject({
        value: '2026-11-20',
        label: 'Cum 20',
        spoken: 'Cuma, 20 Kasım',
      });
      expect(late.at(-1)?.value).toBe('2026-11-25');
      expect(dateOptions(AT.atSwitch)[2]?.value).toBe('2026-11-19');
    });
  });
}

import type { Notification, NotificationKind } from '@/api/models';
import { tr } from '@/i18n/tr';

export type NotificationFilter = 'all' | 'price' | 'stock' | 'recommendation';

export const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: tr.notifFilterAll },
  { value: 'price', label: tr.notifFilterPrice },
  { value: 'stock', label: tr.notifFilterStock },
  { value: 'recommendation', label: tr.notifFilterRecommendation },
];

/** Which kinds each chip shows; `all` (null) also includes `System`, which has no chip of its own. */
const FILTER_KINDS: Record<NotificationFilter, readonly NotificationKind[] | null> = {
  all: null,
  price: ['PriceDrop', 'AnyChange'],
  stock: ['BackInStock'],
  recommendation: ['NewMatches'],
};

export function filterNotifications(
  items: readonly Notification[],
  filter: NotificationFilter,
): Notification[] {
  const kinds = FILTER_KINDS[filter];
  return kinds ? items.filter((item) => kinds.includes(item.kind)) : [...items];
}

export type DayKey = 'today' | 'yesterday' | 'earlier';

export interface NotificationSection {
  key: DayKey;
  title: string;
  data: Notification[];
}

const DAY_TITLES: Record<DayKey, string> = {
  today: tr.notifSectionToday,
  yesterday: tr.notifSectionYesterday,
  earlier: tr.notifSectionEarlier,
};

function dayOf(date: Date, now: Date): DayKey {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const time = date.getTime();
  if (time >= startOfToday) {
    return 'today';
  }
  return time >= startOfYesterday ? 'yesterday' : 'earlier';
}

/** Splits a newest-first feed into Bugün / Dün / Daha önce (device-local days); empty sections are left out. */
export function groupByDay(items: readonly Notification[], now: Date): NotificationSection[] {
  const sections: NotificationSection[] = [];
  for (const item of items) {
    const key = dayOf(new Date(item.createdAt), now);
    let section = sections.find((candidate) => candidate.key === key);
    if (!section) {
      section = { key, title: DAY_TITLES[key], data: [] };
      sections.push(section);
    }
    section.data.push(item);
  }
  return sections;
}

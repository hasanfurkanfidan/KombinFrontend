import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import {
  formatDay,
  formatRangeWithDays,
  isComplete,
  isPickable,
  monthCells,
  monthOf,
  monthTitle,
  pickDay,
  shiftMonth,
  todayIso,
  type DateRange,
} from './calendar';

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

interface TripDatesSheetProps {
  visible: boolean;
  onClose: () => void;
  value: DateRange;
  onDone: (range: DateRange) => void;
}

/**
 * One month grid for the whole range: tap the first day, then the last. The limits are drawn, not enforced after the
 * fact: days before today, more than a year ahead, or past the 14th day of the range cannot be tapped, and the line
 * under the grid says why.
 */
export function TripDatesSheet({ visible, onClose, value, onDone }: TripDatesSheetProps) {
  const today = useMemo(() => todayIso(), []);
  const [range, setRange] = useState<DateRange>(value);
  const [month, setMonth] = useState(() => monthOf(value.start ?? today));
  const cells = monthCells(month);
  const thisMonth = monthOf(today);
  const lastMonth = shiftMonth(thisMonth, 12);
  const canGoBack = month.year * 12 + month.month > thisMonth.year * 12 + thisMonth.month;
  const canGoOn = month.year * 12 + month.month < lastMonth.year * 12 + lastMonth.month;

  const hint = isComplete(range)
    ? formatRangeWithDays(range.start, range.end)
    : range.start
      ? tr.tripDatesPickEnd
      : tr.tripDatesPickStart;

  return (
    <BottomSheet visible={visible} title={tr.tripDatesSheetTitle} onClose={onClose}>
      <View style={styles.monthRow}>
        <IconButton
          icon="chevronLeft"
          label={tr.tripDatesPrevMonth}
          onPress={() => canGoBack && setMonth(shiftMonth(month, -1))}
          testID="trip-month-prev"
        />
        <Text style={styles.monthTitle} accessibilityRole="header" testID="trip-month-title">
          {monthTitle(month)}
        </Text>
        <IconButton
          icon="chevronRight"
          label={tr.tripDatesNextMonth}
          onPress={() => canGoOn && setMonth(shiftMonth(month, 1))}
          testID="trip-month-next"
        />
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((weekday) => (
          <View key={weekday} style={styles.cell} accessible={false}>
            <Text style={styles.weekday}>{weekday}</Text>
          </View>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }
          const pickable = isPickable(day, range, today);
          const isStart = day === range.start;
          const isEnd = day === range.end;
          const inside = isComplete(range) && day > range.start && day < range.end;
          const selected = isStart || isEnd;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={formatDay(day)}
              accessibilityState={{ selected, disabled: !pickable }}
              disabled={!pickable}
              onPress={() => setRange((current) => pickDay(current, day))}
              style={[
                styles.cell,
                styles.day,
                inside && styles.inside,
                selected && styles.selected,
              ]}
              testID={`trip-day-${day}`}
            >
              <Text
                style={[
                  styles.dayText,
                  !pickable && styles.dayDisabled,
                  selected && styles.daySelected,
                ]}
              >
                {Number(day.slice(8))}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint} accessibilityLiveRegion="polite" testID="trip-dates-hint">
        {hint}
      </Text>
      <Text style={styles.limit}>{tr.tripDatesLimit}</Text>
      <Button
        label={tr.tripDatesDone}
        onPress={() => onDone(range)}
        disabled={!isComplete(range)}
        testID="trip-dates-done"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Seven equal columns.
  cell: {
    width: `${100 / 7}%`,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    ...theme.typography.captionStrong,
    color: theme.colors.muted,
  },
  day: {
    borderRadius: theme.radius.control,
  },
  inside: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 0,
  },
  selected: {
    backgroundColor: theme.colors.primary,
  },
  dayText: {
    ...theme.typography.bodyMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.ink,
  },
  dayDisabled: {
    color: theme.colors.control,
  },
  daySelected: {
    color: theme.colors.onPrimary,
  },
  hint: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  limit: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});

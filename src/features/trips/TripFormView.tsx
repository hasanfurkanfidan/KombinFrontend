import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { ToggleRow } from '@/components/ToggleRow';
import { OptionSheet, type Option } from '@/features/catalog/OptionSheet';
import { OCCASIONS, parseOccasion } from '@/features/outfits/labels';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { daysOf, formatDay, formatRangeWithDays, isComplete } from './calendar';
import { MAX_CITY_LENGTH, MAX_PIECES, MIN_PIECES, type TripErrors, type TripForm } from './form';
import { TripDatesSheet } from './TripDatesSheet';
import { LiveText } from '@/components/LiveText';

const ANY = 'any';
const OCCASION_OPTIONS: Option<string>[] = [
  { value: ANY, label: tr.tripOccasionAny },
  ...OCCASIONS.map((occasion) => ({ value: occasion.value, label: occasion.label })),
];

interface TripFormViewProps {
  form: TripForm;
  errors: TripErrors;
  onChange: (patch: Partial<TripForm>) => void;
}

/**
 * The trip form: city and dates are the whole required part; the day-by-day plan, the piece limit and the two
 * switches have defaults and sit below. The date limits are in the picker itself.
 */
export function TripFormView({ form, errors, onChange }: TripFormViewProps) {
  const [datesOpen, setDatesOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [pickingDay, setPickingDay] = useState<string | null>(null);
  const { range } = form;
  const days = isComplete(range) ? daysOf(range.start, range.end) : [];
  const planned = days.filter((day) => form.occasions[day] !== undefined).length;

  return (
    <View style={styles.form}>
      <TextField
        label={tr.tripCityLabel}
        value={form.city}
        onChangeText={(city) => onChange({ city })}
        placeholder={tr.tripCityPlaceholder}
        maxLength={MAX_CITY_LENGTH}
        autoCapitalize="words"
        error={errors.city}
        testID="trip-city"
      />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{tr.tripDatesLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr.tripDatesLabel}: ${
            isComplete(range)
              ? formatRangeWithDays(range.start, range.end)
              : tr.tripDatesPlaceholder
          }`}
          onPress={() => setDatesOpen(true)}
          style={[styles.dateField, errors.dates ? styles.dateFieldError : null]}
          testID="trip-dates"
        >
          <Text style={isComplete(range) ? styles.dateValue : styles.datePlaceholder}>
            {isComplete(range)
              ? formatRangeWithDays(range.start, range.end)
              : tr.tripDatesPlaceholder}
          </Text>
          <Icon name="chevronDown" size={18} color={theme.colors.muted} />
        </Pressable>
        {errors.dates ? (
          <LiveText style={styles.error} testID="trip-dates-error">
            {errors.dates}
          </LiveText>
        ) : null}
      </View>

      {days.length > 0 ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: plansOpen }}
            onPress={() => setPlansOpen((open) => !open)}
            style={styles.disclosure}
            testID="trip-plans-toggle"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{tr.tripOccasionsTitle}</Text>
              <Text style={styles.rowCaption}>
                {planned > 0 ? tr.tripOccasionsSome(planned) : tr.tripOccasionsNone}
              </Text>
            </View>
            <View style={plansOpen ? styles.flipped : undefined}>
              <Icon name="chevronDown" size={18} color={theme.colors.muted} />
            </View>
          </Pressable>
          {plansOpen
            ? days.map((day) => {
                const occasion = form.occasions[day];
                const label =
                  OCCASIONS.find((entry) => entry.value === occasion)?.label ?? tr.tripOccasionAny;
                return (
                  <View key={day} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{formatDay(day)}</Text>
                    <Chip
                      label={label}
                      accessibilityLabel={`${formatDay(day)}: ${label}`}
                      selected={occasion !== undefined}
                      dropdown
                      onPress={() => setPickingDay(day)}
                      testID={`trip-plan-${day}`}
                    />
                  </View>
                );
              })
            : null}
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{tr.tripMaxPieces}</Text>
          <Text style={styles.rowCaption}>{tr.tripMaxPiecesCaption}</Text>
        </View>
        <Stepper
          value={form.maxPieces}
          onChange={(maxPieces) => onChange({ maxPieces })}
          min={MIN_PIECES}
          max={MAX_PIECES}
          format={tr.tripRowPieces}
          label={tr.tripMaxPieces}
          testID="trip-max-pieces"
        />
      </View>
      <ToggleRow
        title={tr.tripRepeatShoes}
        value={form.allowRepeatShoes}
        onChange={(allowRepeatShoes) => onChange({ allowRepeatShoes })}
        testID="trip-repeat-shoes"
      />
      <ToggleRow
        title={tr.tripLaundry}
        value={form.laundry}
        onChange={(laundry) => onChange({ laundry })}
        testID="trip-laundry"
      />

      <TripDatesSheet
        key={`${range.start}-${range.end}-${datesOpen}`}
        visible={datesOpen}
        onClose={() => setDatesOpen(false)}
        value={range}
        onDone={(next) => {
          setDatesOpen(false);
          onChange({ range: next });
        }}
      />
      <OptionSheet
        visible={pickingDay !== null}
        title={pickingDay ? formatDay(pickingDay) : ''}
        options={OCCASION_OPTIONS}
        selected={(pickingDay && form.occasions[pickingDay]) || ANY}
        onSelect={(value) => {
          if (pickingDay) {
            const next = { ...form.occasions };
            const occasion = parseOccasion(value);
            if (occasion) {
              next[pickingDay] = occasion;
            } else {
              delete next[pickingDay];
            }
            onChange({ occasions: next });
          }
          setPickingDay(null);
        }}
        onClose={() => setPickingDay(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg,
  },
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  dateField: {
    height: theme.sizes.fieldHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
  },
  dateFieldError: {
    borderColor: theme.colors.danger,
    borderWidth: 2,
  },
  dateValue: {
    ...theme.typography.body,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  datePlaceholder: {
    ...theme.typography.body,
    color: theme.colors.muted,
    flexShrink: 1,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  disclosure: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  dayRow: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  dayLabel: {
    ...theme.typography.body,
    color: theme.colors.ink2,
    flexShrink: 1,
  },
  row: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  rowCaption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});

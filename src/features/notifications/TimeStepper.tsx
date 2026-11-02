import { StyleSheet, Text, View } from 'react-native';

import { Stepper } from '@/components/Stepper';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/** Quiet hours are set in quarter hours. */
const MINUTE_STEP = 15;

const pad = (value: number) => String(value).padStart(2, '0');

/** "22:30" -> [22, 30]; anything unreadable falls back to midnight. */
export function parseTime(time: string): [number, number] {
  const [hours, minutes] = time.split(':').map(Number);
  return [Number.isFinite(hours) ? (hours ?? 0) : 0, Number.isFinite(minutes) ? (minutes ?? 0) : 0];
}

interface TimeStepperProps {
  label: string;
  /** `HH:mm`, the format the backend uses. */
  value: string;
  onChange: (value: string) => void;
  testID: string;
}

/**
 * A time of day as two steppers (hours, quarter-hour minutes). A native time picker would need an extra package for one
 * setting; this stays inside the app's own components.
 */
export function TimeStepper({ label, value, onChange, testID }: TimeStepperProps) {
  const [hours, minutes] = parseTime(value);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickers}>
        <Stepper
          value={hours}
          min={0}
          max={23}
          wrap
          format={pad}
          label={`${label} ${tr.prefsHour}`}
          onChange={(next) => onChange(`${pad(next)}:${pad(minutes)}`)}
          testID={`${testID}-hours`}
        />
        <Text style={styles.colon}>:</Text>
        <Stepper
          value={minutes}
          min={0}
          max={45}
          step={MINUTE_STEP}
          wrap
          format={pad}
          label={`${label} ${tr.prefsMinute}`}
          onChange={(next) => onChange(`${pad(hours)}:${pad(next)}`)}
          testID={`${testID}-minutes`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
  },
  pickers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  colon: {
    ...theme.typography.bodyStrong,
    color: theme.colors.inkMuted,
  },
});

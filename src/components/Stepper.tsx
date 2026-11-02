import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { Icon } from './Icon';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Past either end the value continues at the other one (hours, minutes) instead of stopping. */
  wrap?: boolean;
  format?: (value: number) => string;
  /** Spoken name of what is being stepped; the buttons read "{label}: Azalt" / "{label}: Artır". */
  label: string;
  testID?: string;
}

/** A − value + control for a small bounded number (weekly limit, hours, minutes). */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  wrap = false,
  format = String,
  label,
  testID,
}: StepperProps) {
  const move = (direction: 1 | -1) => {
    const next = value + direction * step;
    if (next > max) {
      onChange(wrap ? min : max);
    } else if (next < min) {
      onChange(wrap ? max - ((max - min) % step) : min);
    } else {
      onChange(next);
    }
  };
  const atMin = !wrap && value <= min;
  const atMax = !wrap && value >= max;

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${tr.prefsDecrease}`}
        disabled={atMin}
        onPress={() => move(-1)}
        style={[styles.button, atMin && styles.disabled]}
        testID={testID ? `${testID}-dec` : undefined}
      >
        <Icon name="minus" size={18} />
      </Pressable>
      <Text style={styles.value} testID={testID ? `${testID}-value` : undefined}>
        {format(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${tr.prefsIncrease}`}
        disabled={atMax}
        onPress={() => move(1)}
        style={[styles.button, atMax && styles.disabled]}
        testID={testID ? `${testID}-inc` : undefined}
      >
        <Icon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  button: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  value: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
    minWidth: 28,
    textAlign: 'center',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Two-or-three-way switch under the Takip stats (Alarmlar / Kaydedilenler). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
            testID={`segment-${option.value}`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  segment: {
    flex: 1,
    minHeight: theme.sizes.touch - theme.spacing.sm,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: theme.colors.ink,
  },
  label: {
    ...theme.typography.bodyMedium,
    color: theme.colors.inkMuted,
  },
  labelSelected: {
    color: theme.colors.onInk,
  },
});

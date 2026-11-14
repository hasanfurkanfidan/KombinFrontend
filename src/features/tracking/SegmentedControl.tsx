import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Two-or-three-way switch (Fiyatlar's lists, Akış's Herkes / Takip ettiklerim). The segments wear the chip's two
 * states, so there is one selected look across the app.
 */
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
    gap: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: theme.sizes.touch,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  label: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  labelSelected: {
    color: theme.colors.primary,
  },
});

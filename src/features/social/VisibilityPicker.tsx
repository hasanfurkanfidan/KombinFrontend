import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PostVisibility } from '@/api/models';
import { theme } from '@/theme';

import { VISIBILITY_OPTIONS } from './labels';

interface VisibilityPickerProps {
  value: PostVisibility;
  onChange: (value: PostVisibility) => void;
}

/** "Sadece ben / Takipçilerime / Herkese açık". The screen starts it on `Private`: nothing is shared by default. */
export function VisibilityPicker({ value, onChange }: VisibilityPickerProps) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {VISIBILITY_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
            testID={`visibility-${option.value}`}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioCore} /> : null}
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>{option.label}</Text>
              <Text style={styles.hint}>{option.hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const RADIO = 22;

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  option: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderColor: theme.colors.control,
  },
  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 2,
    borderColor: theme.colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: theme.colors.primary,
  },
  radioCore: {
    width: RADIO / 2,
    height: RADIO / 2,
    borderRadius: RADIO / 4,
    backgroundColor: theme.colors.primary,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});

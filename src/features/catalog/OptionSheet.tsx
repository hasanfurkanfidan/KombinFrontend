import { Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { theme } from '@/theme';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: readonly Option<T>[];
  selected: T | undefined;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/** Bottom sheet with a single-choice list; used by the colour, audience and sort chips. */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps<T>) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={styles.option}
            testID={`option-${option.value}`}
          >
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {option.label}
            </Text>
            {active ? <Icon name="check" size={20} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
  optionLabelActive: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
});

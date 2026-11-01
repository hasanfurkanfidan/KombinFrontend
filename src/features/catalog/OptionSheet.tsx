import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityLabel={tr.close}
        accessibilityRole="button"
      />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    maxHeight: '65%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
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

import { Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { OCCASIONS, type OccasionValue } from './labels';

interface OccasionSheetProps {
  visible: boolean;
  /** The occasion the user chose, or `undefined` while the backend is choosing. */
  value: OccasionValue | undefined;
  onSelect: (value: OccasionValue | undefined) => void;
  onClose: () => void;
}

/**
 * "Nereye gidiyorsun?": the five occasions and "Otomatik", which clears the choice so the backend picks again. The same
 * option-row sheet as the style switcher; a tap closes it.
 */
export function OccasionSheet({ visible, value, onSelect, onClose }: OccasionSheetProps) {
  const rows = [
    { key: 'auto', label: tr.homeCardOccasionAuto, occasion: undefined },
    ...OCCASIONS.map((entry) => ({ key: entry.value, label: entry.label, occasion: entry.value })),
  ];
  return (
    <BottomSheet visible={visible} title={tr.homeCardOccasionSheetTitle} onClose={onClose}>
      {rows.map((row) => {
        const selected = row.occasion === value;
        return (
          <Pressable
            key={row.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              onSelect(row.occasion);
              onClose();
            }}
            style={styles.option}
            testID={`home-occasion-${row.key}`}
          >
            <Text style={[styles.optionText, selected && styles.optionTextActive]}>
              {row.label}
            </Text>
            {selected ? <Icon name="check" size={20} color={theme.colors.primary} /> : null}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  optionText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  optionTextActive: {
    fontFamily: theme.fontFamilies.semibold,
    color: theme.colors.primary,
  },
});

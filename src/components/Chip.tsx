import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './Icon';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Draws a small chevron, for chips that open a picker. */
  dropdown?: boolean;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  dropdown = false,
  testID,
}: ChipProps) {
  const foreground = selected ? theme.colors.onInk : theme.colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      // The chip is 36 high; the hit slop brings the touch target up to 44.
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      style={[
        styles.base,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
      {dropdown ? <Icon name="chevronDown" size={14} color={foreground} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: theme.sizes.chipHeight,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  selected: {
    backgroundColor: theme.colors.ink,
  },
  unselected: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...theme.typography.bodyMedium,
  },
});

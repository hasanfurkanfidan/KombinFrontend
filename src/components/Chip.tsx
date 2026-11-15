import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './Icon';

interface ChipProps {
  label: string;
  /** Spoken name when the visible label is short ("Cum 20" is read as "Cuma, 20 Kasım"). */
  accessibilityLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Draws a small chevron, for chips that open a picker. */
  dropdown?: boolean;
  /** Drawn before the label (a colour dot). */
  leading?: ReactNode;
  testID?: string;
}

/**
 * The one chip. Two states: unselected (bg, control border, ink text) and selected (primarySoft fill, primary border
 * and text). Filters, choices and toggles all use it; there is no dark or pill variant.
 */
export function Chip({
  label,
  accessibilityLabel,
  selected = false,
  onPress,
  disabled = false,
  dropdown = false,
  leading,
  testID,
}: ChipProps) {
  const foreground = selected ? theme.colors.primary : theme.colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
      {leading}
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
    borderRadius: theme.radius.control,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  selected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  unselected: {
    backgroundColor: theme.colors.bg,
    borderColor: theme.colors.control,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...theme.typography.bodyMedium,
  },
});

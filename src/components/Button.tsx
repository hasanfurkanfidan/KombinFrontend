import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

interface ButtonProps {
  label: string;
  /** Spoken name when the visible label needs its object ("Satın al: Siyah bot, Trendyol, 2.499 ₺"); starts with `label`. */
  accessibilityLabel?: string;
  /** What happens beyond the tap ("Satıcının sitesi açılır"), or why the button is off. */
  accessibilityHint?: string;
  onPress: () => void;
  /**
   * `primary` is the screen's one filled green action; `secondary` is outlined (bg + control border, ink text);
   * `quiet` is text only, in the link colour; `danger` is the filled red action that cannot be undone
   * (deleting the account), the only filled action on its screen.
   */
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  trailingIcon?: IconName;
  /** Drawn before the label (a brand mark); the caller owns its colour. */
  leading?: ReactNode;
  /**
   * Every button grows past its minimum height and wraps its label: large text must never cut one (the buy button
   * carries the price). `wrap` only trades side padding for room, for buttons that share a row.
   */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FOREGROUND = {
  primary: theme.colors.onPrimary,
  secondary: theme.colors.ink,
  quiet: theme.colors.primary,
  danger: theme.colors.onDanger,
} as const;

export function Button({
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  trailingIcon,
  leading,
  wrap = false,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;
  const foreground = FOREGROUND[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      // The spinner replaces the label while loading: the name must not go with it.
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={[
        styles.base,
        styles[variant],
        wrap && styles.wrap,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={foreground}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <>
          {leading}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
          {trailingIcon ? <Icon name={trailingIcon} size={18} color={foreground} /> : null}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.sizes.buttonHeight,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.cta,
  },
  danger: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.cta,
  },
  secondary: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
  },
  quiet: {
    minHeight: theme.sizes.touch,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.control,
  },
  wrap: {
    paddingHorizontal: theme.spacing.md,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...theme.typography.label,
    flexShrink: 1,
    textAlign: 'center',
  },
});

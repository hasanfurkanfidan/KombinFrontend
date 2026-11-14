import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/theme';

interface CardProps {
  children: ReactNode;
  /** `surface` is a filled panel (the default); `outline` is the page colour with a hairline, for a quieter box. */
  tone?: 'surface' | 'outline';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A panel: depth comes from `surface` on `bg` (or a hairline), never from a shadow or a dark fill. */
export function Card({ children, tone = 'surface', style, testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.base, styles[tone], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.panel,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  surface: {
    backgroundColor: theme.colors.surface,
  },
  outline: {
    backgroundColor: theme.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
  },
});

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { announce } from '@/utils/a11y';

interface RootErrorFallbackProps {
  onRetry: () => void;
}

/** A typography token in the system font: the boundary may show before Archivo is loaded (or after it failed to). */
function systemFont({ fontFamily: _fontFamily, ...rest }: TextStyle): TextStyle {
  return rest;
}

/**
 * What the root error boundary shows. It renders outside `AppProviders` (no query client, no gesture root, fonts
 * maybe not loaded), so it is `ErrorState`'s layout and `Button variant="secondary"`'s look rebuilt from the theme
 * tokens with a plain `Pressable` and the system font. It never shows the error itself.
 */
export function RootErrorFallback({ onRetry }: RootErrorFallbackProps) {
  // The screen the user was on is gone: say so once, with what to do.
  useEffect(() => {
    announce(`${tr.errorTitle}. ${tr.rootErrorBody}`);
  }, []);

  return (
    <View style={styles.root} testID="root-error">
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {tr.errorTitle}
        </Text>
        <Text style={styles.body}>{tr.rootErrorBody}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.action}
          testID="root-error-retry"
        >
          <Text style={styles.actionLabel}>{tr.retry}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
  },
  content: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
  },
  title: {
    ...systemFont(theme.typography.subhead),
    fontWeight: '600',
    color: theme.colors.ink,
    textAlign: 'center',
  },
  body: {
    ...systemFont(theme.typography.body),
    color: theme.colors.muted,
    textAlign: 'center',
  },
  action: {
    marginTop: theme.spacing.md,
    alignSelf: 'stretch',
    minHeight: theme.sizes.buttonHeight,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
  },
  actionLabel: {
    ...systemFont(theme.typography.label),
    fontWeight: '600',
    color: theme.colors.ink,
    textAlign: 'center',
  },
});

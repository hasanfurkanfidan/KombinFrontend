import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';
import { announce, useReadingTime } from '@/utils/a11y';

import { useToastStore } from './toastStore';

/** How long a toast stays; one with a button ("Geri al") stays longer. Longer again with a screen reader or large text. */
const VISIBLE_MS = 4000;
const VISIBLE_WITH_ACTION_MS = 8000;

/** Renders the current toast above the tab bar; mounted once in `AppProviders`. */
export function ToastHost() {
  const message = useToastStore((state) => state.message);
  const action = useToastStore((state) => state.action);
  const id = useToastStore((state) => state.id);
  const hide = useToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();
  const visibleMs = useReadingTime(action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(hide, visibleMs);
    return () => clearTimeout(timer);
  }, [message, id, hide, visibleMs]);

  // Android speaks the live region below; iOS has none.
  useEffect(() => {
    if (message) {
      announce(action ? `${message}. ${action.label}` : message, 'ios');
    }
  }, [message, id, action]);

  if (!message) {
    return null;
  }
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: theme.sizes.tabBarHeight + insets.bottom }]}
    >
      <View style={styles.toast} accessibilityLiveRegion="polite" testID="toast">
        <Text style={styles.text}>{message}</Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            // The text is 20 high: the slop makes the target 44.
            hitSlop={theme.spacing.md}
            onPress={() => {
              hide();
              action.onPress();
            }}
            testID="toast-action"
          >
            <Text style={styles.action}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: theme.screenPaddingX,
    right: theme.screenPaddingX,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.control,
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  text: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  action: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
});

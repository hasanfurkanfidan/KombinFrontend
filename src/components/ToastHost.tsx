import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { useToastStore } from './toastStore';

const VISIBLE_MS = 2800;

/** Renders the current toast above the tab bar; mounted once in `AppProviders`. */
export function ToastHost() {
  const message = useToastStore((state) => state.message);
  const action = useToastStore((state) => state.action);
  const id = useToastStore((state) => state.id);
  const hide = useToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, id, hide]);

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
            hitSlop={theme.spacing.sm}
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
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  text: {
    ...theme.typography.bodyMedium,
    color: theme.colors.onInk,
    flexShrink: 1,
  },
  action: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
    textDecorationLine: 'underline',
  },
});

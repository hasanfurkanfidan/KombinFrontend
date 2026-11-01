import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';
import { getPushPermission, requestPushPermission } from '@/push';
import { usePrefsStore } from '@/session/prefsStore';
import { theme } from '@/theme';

/**
 * Contextual push prompt: shown once, right after the user's first alert, and only when the OS has not been asked yet.
 * The OS prompt itself only appears after the user agrees here; nothing is asked on app start.
 */
export function usePushPrimer() {
  const [visible, setVisible] = useState(false);

  const maybePrompt = useCallback(async () => {
    const prefs = usePrefsStore.getState();
    if (prefs.pushPromptShown) {
      return;
    }
    if ((await getPushPermission()) === 'undetermined') {
      prefs.markPushPromptShown();
      setVisible(true);
    }
  }, []);

  const allow = useCallback(async () => {
    setVisible(false);
    await requestPushPermission();
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return { visible, maybePrompt, allow, dismiss };
}

interface PushPrimerSheetProps {
  visible: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export function PushPrimerSheet({ visible, onAllow, onDismiss }: PushPrimerSheetProps) {
  return (
    <BottomSheet visible={visible} title={tr.pushPrimerTitle} onClose={onDismiss}>
      <Text style={styles.body}>{tr.pushPrimerBody}</Text>
      <Button label={tr.pushPrimerAllow} onPress={onAllow} testID="push-primer-allow" />
      <Button
        label={tr.pushPrimerLater}
        variant="secondary"
        onPress={onDismiss}
        testID="push-primer-later"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
});

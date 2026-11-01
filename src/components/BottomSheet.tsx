import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Modal sheet that slides up from the bottom; tapping the scrim closes it. */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityLabel={tr.close}
          accessibilityRole="button"
        />
        <View style={styles.sheet}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    maxHeight: '80%',
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
    marginBottom: theme.spacing.md,
  },
  content: {
    gap: theme.spacing.md,
  },
});

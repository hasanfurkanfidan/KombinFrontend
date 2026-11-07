import { StyleSheet, Text, View } from 'react-native';

import type { Consent } from '@/api/models';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

interface ConsentStepProps {
  consent: Consent;
  accepting: boolean;
  onAccept: () => void;
}

/**
 * The posting consent: the backend's own versioned text, shown as is, and a single accept button. Nothing can be
 * uploaded before this is accepted; accepting stores the exact text that was shown, with its version.
 */
export function ConsentStep({ consent, accepting, onAccept }: ConsentStepProps) {
  return (
    <View style={styles.root} testID="consent-step">
      <Text style={styles.title}>{tr.consentTitle}</Text>
      <Text style={styles.text} testID="consent-text">
        {consent.text}
      </Text>
      <Button
        label={tr.consentAccept}
        onPress={onAccept}
        loading={accepting}
        testID="consent-accept"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.lg,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
});

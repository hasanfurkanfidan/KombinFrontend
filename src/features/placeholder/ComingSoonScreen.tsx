import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

interface ComingSoonScreenProps {
  title: string;
}

/** Stand-in for tabs whose features do not exist yet. Carries no logic. */
export function ComingSoonScreen({ title }: ComingSoonScreenProps) {
  return (
    <Screen contentStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{tr.comingSoon}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
});

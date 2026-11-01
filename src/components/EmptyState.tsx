import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxxl * 2,
    paddingHorizontal: theme.spacing.xxl,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: theme.spacing.md,
    alignSelf: 'stretch',
  },
});

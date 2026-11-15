import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/**
 * Keşfet's one way into "Bütçene göre kombin", under the daily card. A bordered row rather than a second surface panel,
 * so it reads as a place to go next to the card that shows today's outfit. Visitors see it too: the screen asks them
 * for the audience instead of using a wardrobe.
 */
export function BudgetEntry() {
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${tr.budgetEntryTitle}. ${tr.budgetEntryBody}`}
      onPress={() => router.push('/outfits/budget')}
      style={styles.row}
      testID="budget-entry"
    >
      <View style={styles.icon}>
        <Icon name="tag" size={20} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{tr.budgetEntryTitle}</Text>
        <Text style={styles.body}>{tr.budgetEntryBody}</Text>
      </View>
      <Icon name="chevronRight" size={20} color={theme.colors.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.sizes.touch,
    marginHorizontal: theme.screenPaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bg,
  },
  icon: {
    width: theme.sizes.notificationIcon,
    height: theme.sizes.notificationIcon,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});

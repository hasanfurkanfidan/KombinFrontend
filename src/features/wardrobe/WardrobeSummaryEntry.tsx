import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/**
 * Dolap's way into "Dolap özeti", at the top under the title. A bordered row (the budget entry's look) rather than a
 * second panel, so "Parça ekle" stays the screen's one filled action.
 */
export function WardrobeSummaryEntry() {
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${tr.wardrobeSummaryEntryTitle}. ${tr.wardrobeSummaryEntryBody}`}
      onPress={() => router.push('/wardrobe/summary')}
      style={styles.row}
      testID="wardrobe-summary-entry"
    >
      <View style={styles.icon}>
        <Icon name="box" size={20} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{tr.wardrobeSummaryEntryTitle}</Text>
        <Text style={styles.body}>{tr.wardrobeSummaryEntryBody}</Text>
      </View>
      <Icon name="chevronRight" size={20} color={theme.colors.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.sizes.touch,
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

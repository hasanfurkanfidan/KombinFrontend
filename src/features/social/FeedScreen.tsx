import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { FeedMode } from '@/api/endpoints/social';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { FeedSection } from './FeedSection';

/**
 * The Akış tab: the title with its one primary action, "Paylaş", then the mode toggle and the posts. The mode lives in
 * the URL param `mode=following`, so the back stack restores it.
 */
export function FeedScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const feedMode: FeedMode = mode === 'following' ? 'following' : 'forYou';

  const header = (
    <View style={styles.titleRow}>
      <Text style={styles.title} accessibilityRole="header">
        {tr.tabFeed}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/posts/new')}
        style={styles.share}
        testID="feed-share"
      >
        <Icon name="plus" size={18} color={theme.colors.onInk} />
        <Text style={styles.shareText}>{tr.feedShare}</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen padded={false}>
      <FeedSection
        header={header}
        mode={feedMode}
        onModeChange={(next) => router.setParams({ mode: next === 'following' ? 'following' : '' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  share: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  shareText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
});

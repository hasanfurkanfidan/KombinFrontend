import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { useBlocks, useUnblockUser } from './hooks';
import { SocialHeader } from './SocialHeader';

/** "Engellenenler": the people the user blocked, each with a way to undo it. */
export function BlockedUsersScreen() {
  const blocks = useBlocks();
  const unblock = useUnblockUser();

  return (
    <Screen padded={false}>
      <SocialHeader title={tr.blocksTitle} fallback="/profile" />
      {blocks.isPending ? (
        <View style={styles.skeleton} testID="blocks-skeleton">
          <Skeleton height={theme.sizes.touch} radius={theme.radius.tile} />
        </View>
      ) : blocks.isError ? (
        <ErrorState
          title={tr.blocksLoadFailed}
          error={blocks.error}
          onRetry={() => void blocks.refetch()}
        />
      ) : (
        <FlatList
          data={blocks.data}
          keyExtractor={(user) => user.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<EmptyState title={tr.blocksEmpty} />}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`blocked-${item.id}`}>
              <Avatar name={item.displayName} testID={`blocked-avatar-${item.id}`} />
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              <Button
                label={tr.blocksUnblock}
                variant="secondary"
                onPress={() => unblock.mutate(item.id)}
                loading={unblock.isPending && unblock.variables === item.id}
                style={styles.button}
                testID={`unblock-${item.id}`}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    paddingHorizontal: theme.screenPaddingX,
  },
  content: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.md,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  name: {
    flex: 1,
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  button: {
    height: theme.sizes.touch,
    paddingHorizontal: theme.spacing.lg,
  },
});

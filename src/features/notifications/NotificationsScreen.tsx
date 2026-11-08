import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { FILTERS, filterNotifications, groupByDay, type NotificationFilter } from './grouping';
import { useMarkAllRead, useNotifications, useOpenNotification } from './hooks';
import { NotificationRow } from './NotificationRow';
import { PreferencesSheet } from './PreferencesSheet';

/** Design screen 06: the feed by day, filter chips, a header menu and the preferences sheet. */
export function NotificationsScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const feed = useNotifications();
  const open = useOpenNotification();
  const markAll = useMarkAllRead();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const now = new Date();
  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const sections = useMemo(
    () => groupByDay(filterNotifications(items, filter), new Date()),
    [items, filter],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <IconButton
          icon="arrowLeft"
          label={tr.back}
          tone="tinted"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="notifications-back"
        />
        <Text style={styles.title}>{tr.notifTitle}</Text>
        {isSignedIn ? (
          <View style={styles.actions}>
            <IconButton
              icon="more"
              label={tr.notifMenuButton}
              tone="tinted"
              onPress={() => setMenuOpen(true)}
              testID="notifications-menu"
            />
            <IconButton
              icon="sliders"
              label={tr.notifPreferencesButton}
              tone="tinted"
              onPress={() => setPreferencesOpen(true)}
              testID="notifications-preferences"
            />
          </View>
        ) : null}
      </View>
      {isSignedIn ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              selected={filter === item.value}
              onPress={() => setFilter(item.value)}
              testID={`notifications-filter-${item.value}`}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  if (!isSignedIn) {
    return (
      <Screen padded={false}>
        {header}
        <EmptyState
          title={tr.notifSignedOutTitle}
          body={tr.notifSignedOutBody}
          action={{ label: tr.login, onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  let placeholder;
  if (feed.isPending) {
    placeholder = (
      <View style={styles.skeletons}>
        <Skeleton height={96} radius={theme.radius.xl} />
        <Skeleton height={96} radius={theme.radius.xl} />
        <Skeleton height={96} radius={theme.radius.xl} />
      </View>
    );
  } else if (feed.isError && items.length === 0) {
    placeholder = <ErrorState body={tr.notifLoadFailed} onRetry={() => void feed.refetch()} />;
  } else if (sections.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.notifEmptyTitle}
        body={filter === 'all' ? tr.notifEmptyBody : tr.notifEmptyFilterBody}
        action={
          filter === 'all'
            ? { label: tr.notifBrowse, onPress: () => router.navigate('/') }
            : { label: tr.notifShowAll, onPress: () => setFilter('all') }
        }
      />
    );
  }

  return (
    <Screen padded={false}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={placeholder}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title.toLocaleUpperCase('tr-TR')}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <NotificationRow notification={item} now={now} onPress={open} />
          </View>
        )}
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) {
            void feed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        onRefresh={() => void feed.refetch()}
        testID="notifications-list"
      />

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Button
          label={tr.notifMarkAllRead}
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            markAll.mutate();
          }}
          testID="notifications-mark-all"
        />
      </BottomSheet>
      <PreferencesSheet visible={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.screenPaddingX,
  },
  list: {
    paddingBottom: theme.spacing.xxxl,
  },
  sectionTitle: {
    ...theme.typography.overline,
    color: theme.colors.inkMuted,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  row: {
    paddingHorizontal: theme.screenPaddingX,
  },
  separator: {
    height: theme.spacing.md,
  },
  skeletons: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.xl,
  },
});

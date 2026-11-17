import type { ReactElement } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { TripSummary } from '@/api/models';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { formatRange } from './calendar';
import { useDeleteTrip, useSavedTrips } from './hooks';
import { coverageSentence } from './labels';
import { TripHeader } from './TripHeader';
import { lines } from '@/utils/a11y';

/** The saved trips: open one, or delete it after a confirmation. */
export function SavedTripsScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const trips = useSavedTrips();
  const remove = useDeleteTrip();
  const items = trips.data?.items ?? [];

  const confirmDelete = (trip: TripSummary) => {
    Alert.alert(tr.tripDeleteTitle, tr.tripDeleteBody(trip.name), [
      { text: tr.close, style: 'cancel' },
      {
        text: tr.tripDelete,
        style: 'destructive',
        onPress: () =>
          remove.mutate(trip.id, {
            onSuccess: () => showToast(tr.tripDeleted),
            onError: () => showToast(tr.tripDeleteFailed),
          }),
      },
    ]);
  };

  let placeholder: ReactElement | null = null;
  if (!isSignedIn) {
    placeholder = (
      <EmptyState
        title={tr.tripSignedOutTitle}
        body={tr.tripSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (trips.isPending) {
    placeholder = (
      <View style={styles.loading} testID="trips-loading">
        <Text style={styles.loadingText}>{tr.tripPlanning}</Text>
        <Skeleton height={theme.sizes.thumbHeight} />
        <Skeleton height={theme.sizes.thumbHeight} />
      </View>
    );
  } else if (trips.isError) {
    placeholder = (
      <ErrorState
        title={tr.tripListLoadFailed}
        error={trips.error}
        onRetry={() => void trips.refetch()}
      />
    );
  } else if (items.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.tripListEmptyTitle}
        body={tr.tripListEmptyBody}
        action={{ label: tr.tripEntry, onPress: () => router.replace('/trips') }}
      />
    );
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <TripHeader
        title={tr.tripListTitle}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/wardrobe'))}
      />
      {placeholder ?? (
        <FlatList
          data={items}
          keyExtractor={(trip) => trip.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`trip-row-${item.id}`}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/trips/${item.id}`)}
                style={styles.rowMain}
                testID={`trip-open-${item.id}`}
              >
                <Text style={styles.name} numberOfLines={lines(2)}>
                  {item.name}
                </Text>
                <Text style={styles.muted}>
                  {tr.tripRowMeta(item.city, formatRange(item.startDate, item.endDate))}
                </Text>
                <Text style={styles.muted}>
                  {`${coverageSentence(item.coverage)} · ${tr.tripRowPieces(toNumber(item.pieceCount))}`}
                </Text>
              </Pressable>
              <IconButton
                icon="trash"
                label={tr.tripDeleteLabel(item.name)}
                onPress={() => confirmDelete(item)}
                testID={`trip-delete-${item.id}`}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
  },
  loading: {
    paddingHorizontal: theme.screenPaddingX,
    gap: theme.spacing.lg,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  rowMain: {
    flex: 1,
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
    gap: 2,
  },
  name: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  muted: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});

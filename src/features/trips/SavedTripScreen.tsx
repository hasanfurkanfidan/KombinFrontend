import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatDayMonthYear } from '@/utils/dates';

import { formatRangeWithDays, todayIso } from './calendar';
import { useDeleteTrip, useReplanTrip, useTrip } from './hooks';
import { TripHeader } from './TripHeader';
import { tripErrorMessage } from './TripPlannerScreen';
import { TripPlanView } from './TripPlanView';

/** One saved trip: the same two views as a fresh plan, with "Yeniden planla" and delete. */
export function SavedTripScreen({ id }: { id: string }) {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const query = useTrip(id);
  const replan = useReplanTrip();
  const remove = useDeleteTrip();
  const [replanError, setReplanError] = useState<string | null>(null);
  const trip = query.data;

  // One `trip_plan_view` per opened trip, not per refresh.
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (trip && viewed.current !== trip.id) {
      viewed.current = trip.id;
      track('trip_plan_view', { days: trip.plan.days.length, source: 'saved' });
    }
  }, [trip]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/trips/saved'));

  const confirmDelete = () => {
    if (!trip) {
      return;
    }
    Alert.alert(tr.tripDeleteTitle, tr.tripDeleteBody(trip.name), [
      { text: tr.close, style: 'cancel' },
      {
        text: tr.tripDelete,
        style: 'destructive',
        onPress: () =>
          remove.mutate(trip.id, {
            onSuccess: () => {
              showToast(tr.tripDeleted);
              back();
            },
            onError: () => showToast(tr.tripDeleteFailed),
          }),
      },
    ]);
  };

  let body: ReactElement;
  if (!isSignedIn) {
    body = (
      <EmptyState
        title={tr.tripSignedOutTitle}
        body={tr.tripSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (query.isPending) {
    body = (
      <View style={styles.loading} testID="trip-loading">
        <Text style={styles.loadingText}>{tr.tripPlanning}</Text>
        <Skeleton height={theme.sizes.touch} />
        <Skeleton height={theme.sizes.thumbHeight} />
      </View>
    );
  } else if (query.isError) {
    body =
      query.error instanceof ApiError && query.error.status === 404 ? (
        <EmptyState
          title={tr.tripNotFound}
          action={{ label: tr.tripSavedList, onPress: () => router.replace('/trips/saved') }}
        />
      ) : (
        <ErrorState
          title={tr.tripLoadFailed}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TripPlanView
          plan={query.data.plan}
          canReplan={query.data.plan.endDate >= todayIso()}
          replanning={replan.isPending}
          onReplan={() => {
            setReplanError(null);
            replan.mutate(id, {
              onSuccess: () => showToast(tr.tripReplanned),
              onError: (error) => setReplanError(tripErrorMessage(error, tr.tripReplanFailed)),
            });
          }}
          replanError={replanError}
        />
        <Text style={styles.planned}>
          {tr.tripPlannedAt(formatDayMonthYear(query.data.plannedAt))}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={confirmDelete}
          style={styles.delete}
          testID="trip-delete"
        >
          <Text style={styles.deleteText}>{tr.tripDelete}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <TripHeader
        title={trip?.name ?? tr.tripTitle}
        subtitle={
          trip
            ? `${trip.plan.city} · ${formatRangeWithDays(trip.plan.startDate, trip.plan.endDate)}`
            : null
        }
        onBack={back}
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  loading: {
    paddingHorizontal: theme.screenPaddingX,
    gap: theme.spacing.lg,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  planned: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  delete: {
    minHeight: theme.sizes.touch,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  deleteText: {
    ...theme.typography.label,
    color: theme.colors.danger,
  },
});

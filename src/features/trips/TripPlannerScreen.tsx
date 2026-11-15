import { useState, type ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { TripPlan, TripPlanRequest } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { useActivePersona } from '@/features/personas/hooks';
import { useProfile } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { rateLimitedText } from '@/utils/rateLimit';

import { formatRangeWithDays, todayIso } from './calendar';
import {
  buildTripRequest,
  defaultTripForm,
  MAX_NAME_LENGTH,
  validateTrip,
  type TripErrors,
  type TripForm,
} from './form';
import { usePlanTrip, useReplanTrip, useSaveTrip } from './hooks';
import { TripFormView } from './TripFormView';
import { TripHeader } from './TripHeader';
import { TripPlanView } from './TripPlanView';

interface PlanResult {
  plan: TripPlan;
  request: TripPlanRequest;
  /** Set once the plan is saved; "Yeniden planla" then plans that saved trip. */
  savedId: string | null;
}

/** Why a request failed, in a sentence the user can act on. */
export function tripErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.errorCode === 'Recommendation.TripOver') {
    return tr.tripOver;
  }
  if (error instanceof ApiError && error.isNetworkError) {
    return tr.errorNetwork;
  }
  return rateLimitedText(error) ?? fallback;
}

export function TripPlannerScreen() {
  const { isSignedIn } = useSession();
  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      {isSignedIn ? <Planner /> : <SignedOut />}
    </Screen>
  );
}

function SignedOut() {
  const router = useRouter();
  return (
    <>
      <TripHeader title={tr.tripTitle} onBack={() => goBack(router)} />
      <EmptyState
        title={tr.tripSignedOutTitle}
        body={tr.tripSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    </>
  );
}

function goBack(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/wardrobe');
  }
}

function Planner() {
  const router = useRouter();
  const profile = useProfile();
  const personaId = useActivePersona()?.id;
  const [form, setForm] = useState<TripForm>(() => defaultTripForm());
  // The profile's city is the starting point until the user types one.
  const [cityEdited, setCityEdited] = useState(false);
  const [errors, setErrors] = useState<TripErrors>({});
  const [result, setResult] = useState<PlanResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ text: string; limit: boolean } | null>(null);
  const [replanError, setReplanError] = useState<string | null>(null);

  const plan = usePlanTrip();
  const redo = usePlanTrip();
  const save = useSaveTrip();
  const replan = useReplanTrip();

  const effective: TripForm = {
    ...form,
    city: cityEdited ? form.city : (profile.data?.city ?? ''),
  };

  const change = (patch: Partial<TripForm>) => {
    if (patch.city !== undefined) {
      setCityEdited(true);
    }
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
    plan.reset();
  };

  const show = (next: PlanResult, source: 'plan') => {
    setResult(next);
    track('trip_plan_view', { days: next.plan.days.length, source });
  };

  const submit = () => {
    const found = validateTrip(effective);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    const request = buildTripRequest(effective, personaId);
    plan.mutate(request, {
      onSuccess: (planned) => {
        track('trip_plan_create', {
          days: planned.days.length,
          pieceCount: Math.min(Number(planned.pieceCount), 60),
          coveragePercent: Number(planned.coverage.percent),
          gapCount: Math.min(planned.gaps.length, 20),
        });
        setReplanError(null);
        show({ plan: planned, request, savedId: null }, 'plan');
      },
    });
  };

  const planAgain = () => {
    if (!result) {
      return;
    }
    setReplanError(null);
    if (result.savedId) {
      replan.mutate(result.savedId, {
        onSuccess: (trip) => {
          setResult({ ...result, plan: trip.plan });
          showToast(tr.tripReplanned);
        },
        onError: (error) => setReplanError(tripErrorMessage(error, tr.tripReplanFailed)),
      });
    } else {
      redo.mutate(result.request, {
        onSuccess: (planned) => {
          setResult({ ...result, plan: planned });
          showToast(tr.tripReplanned);
        },
        onError: (error) => setReplanError(tripErrorMessage(error, tr.tripReplanFailed)),
      });
    }
  };

  const openSave = () => {
    if (!result) {
      return;
    }
    setName(tr.tripDefaultName(result.plan.city).slice(0, MAX_NAME_LENGTH));
    setNameError(null);
    setSaveError(null);
    setSaveOpen(true);
  };

  const submitSave = () => {
    if (!result) {
      return;
    }
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError(tr.tripNameRequired);
      return;
    }
    setSaveError(null);
    save.mutate(
      { name: trimmed, request: result.request },
      {
        onSuccess: (trip) => {
          setResult({ ...result, savedId: trip.id });
          setSaveOpen(false);
          showToast(tr.tripSavedToast);
        },
        onError: (error) =>
          setSaveError({
            text:
              error instanceof ApiError && error.errorCode === 'Recommendation.TooManyTrips'
                ? tr.tripSaveLimit
                : tripErrorMessage(error, tr.tripSaveFailed),
            limit: error instanceof ApiError && error.errorCode === 'Recommendation.TooManyTrips',
          }),
      },
    );
  };

  let body: ReactElement;
  if (plan.isPending) {
    body = (
      <>
        <TripHeader title={tr.tripTitle} onBack={() => goBack(router)} />
        <View style={styles.loading} testID="trip-loading">
          <Text style={styles.loadingText}>{tr.tripPlanning}</Text>
          <Skeleton height={theme.sizes.touch} />
          <Skeleton height={theme.sizes.thumbHeight} />
          <Skeleton height={theme.sizes.thumbHeight} />
        </View>
      </>
    );
  } else if (result) {
    const over = result.request.endDate !== null && result.request.endDate < todayIso();
    body = (
      <>
        <TripHeader
          title={result.plan.city}
          subtitle={formatRangeWithDays(result.plan.startDate, result.plan.endDate)}
          onBack={() => setResult(null)}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TripPlanView
            plan={result.plan}
            canReplan={!over}
            replanning={redo.isPending || replan.isPending}
            onReplan={planAgain}
            replanError={replanError}
          />
        </ScrollView>
        <View style={styles.bar}>
          <Button
            label={result.savedId ? tr.outfitSaved : tr.tripSave}
            onPress={openSave}
            disabled={result.savedId !== null}
            testID="trip-save"
          />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <TripHeader
          title={tr.tripTitle}
          onBack={() => goBack(router)}
          right={
            <Button
              label={tr.tripSavedList}
              variant="quiet"
              onPress={() => router.push('/trips/saved')}
              testID="trip-saved-link"
            />
          }
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TripFormView form={effective} errors={errors} onChange={change} />
        </ScrollView>
        <View style={styles.bar}>
          {plan.isError ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" testID="trip-plan-error">
              {tripErrorMessage(plan.error, tr.tripPlanFailed)}
            </Text>
          ) : null}
          <Button label={tr.tripSubmit} onPress={submit} testID="trip-submit" />
        </View>
      </>
    );
  }

  return (
    <>
      {body}
      <BottomSheet
        visible={saveOpen}
        title={tr.tripSaveSheetTitle}
        onClose={() => setSaveOpen(false)}
      >
        <TextField
          label={tr.tripNameLabel}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setNameError(null);
          }}
          maxLength={MAX_NAME_LENGTH}
          error={nameError ?? undefined}
          testID="trip-name"
        />
        {saveError ? (
          <Text style={styles.error} accessibilityLiveRegion="polite" testID="trip-save-error">
            {saveError.text}
          </Text>
        ) : null}
        {saveError?.limit ? (
          <Button
            label={tr.tripSavedList}
            variant="secondary"
            onPress={() => {
              setSaveOpen(false);
              router.push('/trips/saved');
            }}
            testID="trip-save-open-list"
          />
        ) : null}
        <Button
          label={save.isPending ? tr.saving : tr.tripSaveConfirm}
          onPress={submitSave}
          disabled={save.isPending}
          testID="trip-save-confirm"
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
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
  bar: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.screenPaddingX,
    paddingVertical: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.bg,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
});

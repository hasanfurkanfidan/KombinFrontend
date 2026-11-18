import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { track } from '@/analytics';
import { Button } from '@/components/Button';
import { LiveText } from '@/components/LiveText';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { rateLimitedText } from '@/utils/rateLimit';

import { ArenaHeader, ArenaMessage, ArenaScreen } from './ArenaScreen';
import { useJoinLeague, useLeagueMe } from './hooks';

/** What the join answered with, as a sentence: the server's own message where it has one, ours otherwise. */
function joinErrorMessage(error: unknown): string {
  const limited = rateLimitedText(error);
  if (limited) {
    return limited;
  }
  if (error instanceof ApiError) {
    if (error.errorCode === 'League.ConsentVersionInvalid') {
      return tr.leagueConsentChanged;
    }
    if (error.errorCode === 'League.AgeRestricted' || (error.status === 403 && error.detail)) {
      return error.detail ?? tr.leagueLineAgeRestricted;
    }
    if (error.detail && error.status < 500 && error.status !== 0) {
      return error.detail;
    }
  }
  return tr.leagueJoinFailed;
}

/**
 * Join (design 01). The consent text and its version come from `GET /league/me`: nothing here is hard-coded, and "Lige
 * katıl" sends the version that is on screen. A player who joined under an older text sees the same screen, asking to
 * accept the new one ("Yeniden onayla").
 */
export function JoinScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useLeagueMe();
  const join = useJoinLeague();
  const [error, setError] = useState<string | null>(null);

  const me = meQuery.data ?? undefined;
  const reconsent = Boolean(me?.joined && me.consentRequired);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (meQuery.data === null) {
    // No league (the server has it switched off): nothing to join.
    return (
      <ArenaScreen>
        <ArenaHeader leading="close" onLeading={close} />
        <ArenaMessage
          title={tr.errorTitle}
          body={tr.errorBody}
          actions={<Button label={tr.close} variant="chalk" onPress={close} />}
        />
      </ArenaScreen>
    );
  }
  if (!me) {
    return (
      <ArenaScreen>
        <ArenaHeader leading="close" onLeading={close} />
        {meQuery.isError ? (
          <ArenaMessage
            title={tr.errorTitle}
            body={rateLimitedText(meQuery.error) ?? tr.errorBody}
            actions={
              <Button
                label={tr.retry}
                variant="chalk"
                onPress={() => void meQuery.refetch()}
                testID="join-retry"
              />
            }
          />
        ) : null}
      </ArenaScreen>
    );
  }

  // Already in with the current text: nothing to accept (a stale screen, or a deep link).
  if (me.joined && !me.consentRequired) {
    return (
      <ArenaScreen>
        <ArenaHeader leading="close" onLeading={close} />
        <ArenaMessage
          title={tr.leagueTitle}
          actions={
            <Button
              label={tr.leagueStart}
              variant="chalk"
              onPress={() => router.replace('/league')}
              testID="join-already"
            />
          }
        />
      </ArenaScreen>
    );
  }

  const submit = () => {
    setError(null);
    join.mutate(me.consent.version, {
      onSuccess: () => {
        track('league_join', {});
        showToast(tr.leagueJoined);
        router.replace('/league');
      },
      onError: (cause) => {
        setError(joinErrorMessage(cause));
        if (cause instanceof ApiError && cause.errorCode === 'League.ConsentVersionInvalid') {
          // The text moved on while this screen was open: show the new one.
          void queryClient.invalidateQueries({ queryKey: queryKeys.leagueMe });
        }
      },
    });
  };

  return (
    <ArenaScreen
      scroll
      contentStyle={styles.content}
      footer={
        <>
          <Button
            label={reconsent ? tr.leagueReconsent : tr.leagueJoin}
            variant="chalk"
            loading={join.isPending}
            onPress={submit}
            testID="join-submit"
          />
          <Button label={tr.leagueNotNow} variant="onArena" onPress={close} testID="join-later" />
        </>
      }
    >
      <ArenaHeader leading="close" onLeading={close} />
      <View style={styles.body}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>
            {reconsent ? tr.leagueReconsentTitle : tr.leagueJoinTitle}
          </Text>
          <Text style={styles.lead}>{reconsent ? tr.leagueReconsentLead : tr.leagueJoinLead}</Text>
        </View>
        {reconsent ? null : (
          <View style={styles.steps}>
            {tr.leagueJoinSteps.map((step, index) => (
              <View key={step} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
        <View
          style={styles.consent}
          accessible
          accessibilityLabel={`${tr.leagueConsentLabel}. ${me.consent.text}`}
        >
          <Text style={styles.consentText} testID="join-consent">
            {me.consent.text}
          </Text>
        </View>
        {error ? (
          <LiveText style={styles.error} testID="join-error">
            {error}
          </LiveText>
        ) : null}
      </View>
    </ArenaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  intro: {
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.display,
    color: theme.arena.text,
  },
  lead: {
    ...theme.typography.body,
    color: theme.arena.textSoft,
  },
  steps: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.arena.track,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.arena.track,
  },
  stepNumber: {
    ...theme.typography.numeric,
    width: theme.sizes.arenaStepNumber,
    color: theme.colors.chalk,
  },
  stepText: {
    ...theme.typography.body,
    flex: 1,
    color: theme.arena.text,
  },
  consent: {
    backgroundColor: theme.arena.raised,
    borderRadius: theme.radius.tile,
    padding: theme.spacing.xl,
  },
  consentText: {
    ...theme.typography.body,
    color: theme.arena.text,
  },
  error: {
    ...theme.typography.bodyMedium,
    color: theme.colors.chalk,
  },
});

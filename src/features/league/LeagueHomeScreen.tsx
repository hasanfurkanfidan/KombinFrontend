import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { announce } from '@/utils/a11y';
import { toNumber } from '@/utils/money';
import { rateLimitedText } from '@/utils/rateLimit';

import { ArenaHeader, ArenaMessage, ArenaScreen } from './ArenaScreen';
import { useLeagueMe, useLeagueTable, useNow } from './hooks';
import { isActivePlayer, istanbulClock, istanbulWeekday, tierName, weekTimeLeft } from './labels';
import { LeagueSettings } from './LeagueSettings';
import { LeagueTable } from './LeagueTable';

/**
 * League home and table (design 05): the player's league, the time left in the week, today's points (marked "şimdilik"
 * until the day is closed), the group table, and the one action: "Oy vermeye başla" (after the day's closing time, the
 * evening result). A player who is not in the league is sent to the join screen; before the group exists (it is formed on
 * Monday) the table gives way to a calm note, and voting is still open.
 */
export function LeagueHomeScreen() {
  const router = useRouter();
  const meQuery = useLeagueMe();
  const me = meQuery.data ?? undefined;
  const now = useNow(60_000);
  const [settings, setSettings] = useState(false);

  const joined = me?.joined ?? false;
  const table = useLeagueTable(joined);

  useEffect(() => {
    if (meQuery.data === null) {
      router.replace('/');
    } else if (me && !me.joined) {
      router.replace('/league/join');
    }
  }, [meQuery.data, me, router]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!me || !joined) {
    return (
      <ArenaScreen>
        <ArenaHeader leading="back" onLeading={back} />
        {meQuery.isError ? (
          <ArenaMessage
            title={tr.errorTitle}
            body={rateLimitedText(meQuery.error) ?? tr.errorBody}
            actions={
              <Button
                label={tr.retry}
                variant="chalk"
                onPress={() => void meQuery.refetch()}
                testID="league-retry"
              />
            }
          />
        ) : null}
      </ArenaScreen>
    );
  }

  const closed = new Date(me.today.closesAt).getTime() <= now.getTime();
  const player = isActivePlayer(me);
  const data = table.data;

  const header = (
    <ArenaHeader
      leading="back"
      onLeading={back}
      trailing={
        <IconButton
          icon="sliders"
          label={tr.leagueSettings}
          tone="arena"
          onPress={() => setSettings(true)}
          testID="league-settings"
        />
      }
    />
  );

  let content;
  if (table.isPending) {
    content = <View style={styles.skeleton} accessibilityElementsHidden testID="league-loading" />;
  } else if (table.isError) {
    content = (
      <ArenaMessage
        title={tr.errorTitle}
        body={rateLimitedText(table.error) ?? tr.errorBody}
        actions={
          <Button
            label={tr.retry}
            variant="chalk"
            onPress={() => void table.refetch()}
            testID="league-table-retry"
          />
        }
      />
    );
  } else if (data) {
    content = (
      <>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text accessibilityRole="header" style={styles.title} testID="league-title">
              {tr.leagueHomeTitle(tierName(data.tier))}
            </Text>
            <Text style={styles.subtitle} testID="league-ends">
              {tr.leagueEndsAt(
                `${istanbulWeekday(data.endsAt)} ${istanbulClock(data.endsAt)}'de`,
                weekTimeLeft(data.endsAt, now),
              )}
            </Text>
          </View>
          <View
            style={styles.today}
            accessible
            accessibilityLabel={`${tr.leagueTodayPoints}${data.todayIsFinal ? '' : `, ${tr.leagueTodayProvisional}`}: ${toNumber(data.todayPoints)}`}
            testID="league-today"
          >
            <Text style={styles.todayLabel}>{tr.leagueTodayPoints}</Text>
            <Text style={styles.todayValue}>{toNumber(data.todayPoints)}</Text>
            {data.todayIsFinal ? null : (
              <Text style={styles.todayLabel} testID="league-today-provisional">
                {tr.leagueTodayProvisional}
              </Text>
            )}
          </View>
        </View>
        <LeagueTable table={data} />
      </>
    );
  } else {
    // No group yet (404 `League.NoGroup`): the week's groups are formed on Monday.
    content = (
      <>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text accessibilityRole="header" style={styles.title} testID="league-title">
              {tr.leagueHomeTitle(tierName(me.tier))}
            </Text>
          </View>
        </View>
        <ArenaMessage title={tr.leagueNoGroupTitle} body={tr.leagueNoGroupBody} />
      </>
    );
  }

  return (
    <ArenaScreen
      scroll
      contentStyle={styles.screen}
      footer={
        <>
          <Button
            label={closed ? tr.leagueLatestResult : tr.leagueStart}
            variant="chalk"
            onPress={() => router.push(closed ? '/league/results' : '/league/vote')}
            testID="league-primary"
          />
          {closed ? null : (
            <Button
              label={tr.leagueLatestResult}
              variant="onArena"
              onPress={() => router.push('/league/results')}
              testID="league-results"
            />
          )}
        </>
      }
    >
      {header}
      <AnnounceNote show={!player} />
      <View style={styles.body}>{content}</View>
      <LeagueSettings
        visible={settings}
        onClose={() => setSettings(false)}
        entry={me.today.entry}
      />
    </ArenaScreen>
  );
}

/** A player who must accept the new text still sees the table and can vote; the join screen is one tap away. */
function AnnounceNote({ show }: { show: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (show) {
      announce(tr.leagueEntryConsentBody);
    }
  }, [show]);
  if (!show) {
    return null;
  }
  return (
    <View style={styles.note}>
      <Button
        label={tr.leagueReconsent}
        variant="onArena"
        onPress={() => router.push('/league/join')}
        testID="league-reconsent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  note: {
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  skeleton: {
    height: theme.sizes.arenaResultFigureHeight,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.arena.raised,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  titleText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.display,
    color: theme.arena.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.arena.textSoft,
  },
  today: {
    alignItems: 'flex-end',
  },
  todayLabel: {
    ...theme.typography.caption,
    color: theme.arena.textSoft,
  },
  todayValue: {
    ...theme.typography.priceHero,
    color: theme.colors.chalk,
  },
});

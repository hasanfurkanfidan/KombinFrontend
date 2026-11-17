import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { LeagueMe } from '@/api/models';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { useLeagueState, useNow } from './hooks';
import { isActivePlayer, tierName } from './labels';

/** The row's body for a player who is in: "Altın · 7. sırada · 3/10 oy", or the results once the day has closed. */
export function joinedRowBody(me: LeagueMe, closed: boolean): string {
  const rank = me.week ? toNumber(me.week.groupRank) : null;
  const rest = closed
    ? tr.leagueEntryResultsReady
    : tr.leagueEntryVotes(
        Math.min(toNumber(me.today.target), toNumber(me.today.countedVotes)),
        toNumber(me.today.target),
      );
  return tr.leagueEntryStatus(tierName(me.tier), rank, rest);
}

/**
 * Keşfet's one way into the league, under the morning card: one compact row, **shown only when the league exists** (the
 * server answers 404 while it is switched off, and then there is nothing here, not even an error). Not joined: the offer
 * ("Bugünkü kombinin yarışsın") opens the join screen. Joined: the tier, the place in the group and today's votes open the
 * league home; once the day has closed it opens the result instead.
 */
export function LeagueEntry() {
  const me = useLeagueState();
  if (!me) {
    return null;
  }
  return isActivePlayer(me) ? <JoinedRow me={me} /> : <JoinRow reconsent={me.joined} />;
}

function JoinRow({ reconsent }: { reconsent: boolean }) {
  const router = useRouter();
  const body = reconsent ? tr.leagueEntryConsentBody : tr.leagueEntryJoinBody;
  return (
    <EntryRow body={body} onPress={() => router.push('/league/join')} testID="league-entry-join" />
  );
}

function JoinedRow({ me }: { me: LeagueMe }) {
  const router = useRouter();
  const now = useNow(60_000);
  const closed = new Date(me.today.closesAt).getTime() <= now.getTime();
  return (
    <EntryRow
      body={joinedRowBody(me, closed)}
      onPress={() => router.push(closed ? '/league/results' : '/league')}
      testID="league-entry-joined"
    />
  );
}

function EntryRow({
  body,
  onPress,
  testID,
}: {
  body: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${tr.leagueTitle}. ${body}`}
      onPress={onPress}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.icon}>
        <Icon name="trophy" size={20} color={theme.colors.chalk} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{tr.leagueTitle}</Text>
        <Text style={styles.body}>{body}</Text>
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
  // The league's own ground, so the row reads as the way into that zone.
  icon: {
    width: theme.sizes.arenaEntryIcon,
    height: theme.sizes.arenaEntryIcon,
    borderRadius: theme.radius.control,
    backgroundColor: theme.arena.ground,
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

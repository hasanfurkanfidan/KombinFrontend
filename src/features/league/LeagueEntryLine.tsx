import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { theme } from '@/theme';

import { useLeagueMe } from './hooks';
import { entryNote, isActivePlayer } from './labels';

/**
 * One line under "Bugün giyiyorsun" on the morning card: what today's worn outfit is doing in the league. Competing:
 * "Kombinin ligde yarışıyor"; not competing: the server's message (the repeat rule) or the reason in words; pending: "Lige
 * hazırlanıyor". Nothing for someone who is not in the league (or when there is no league at all). The card has just
 * settled, so the state is asked for again when the line appears.
 */
export function LeagueEntryLine() {
  const me = useLeagueMe({ refetchOnMount: 'always' }).data;
  const note = me && isActivePlayer(me) ? entryNote(me.today.entry) : null;
  if (!note) {
    return null;
  }
  return (
    <View style={styles.row} testID="league-line">
      <Icon name="trophy" size={14} color={theme.colors.ink2} />
      <Text style={styles.text}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  text: {
    ...theme.typography.caption,
    flex: 1,
    color: theme.colors.ink2,
  },
});

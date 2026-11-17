import { StyleSheet, View } from 'react-native';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

const MAX_STEPS = 30;

interface VoteProgressProps {
  /** Counted votes today. */
  counted: number;
  /** Votes that earn the day's voting points (10). */
  target: number;
}

/** One step per vote the day asks for, chalk for the ones counted; the words ("3/10 oy") are in the header and the value. */
export function VoteProgress({ counted, target }: VoteProgressProps) {
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.round(target)));
  const done = Math.min(steps, Math.max(0, Math.round(counted)));
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tr.leagueProgress}
      accessibilityValue={{ min: 0, max: steps, now: done, text: tr.leagueEntryVotes(done, steps) }}
      testID="vote-progress"
    >
      {Array.from({ length: steps }, (_, index) => (
        <View key={index} style={[styles.step, index < done && styles.stepDone]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  step: {
    flex: 1,
    height: theme.sizes.arenaProgress,
    borderRadius: theme.sizes.arenaProgress / 2,
    backgroundColor: theme.arena.track,
  },
  stepDone: {
    backgroundColor: theme.colors.chalk,
  },
});

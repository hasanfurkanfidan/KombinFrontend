import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LeaguePiece } from '@/api/models';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { LeagueFigure } from './LeagueFigure';
import { spokenSlots } from './labels';
import { Reveal } from './Reveal';

export type Side = 'left' | 'right';

export const SIDE_NAMES: Record<Side, string> = {
  left: tr.leagueSideLeft,
  right: tr.leagueSideRight,
};

interface VoteCardProps {
  side: Side;
  pieces: readonly LeaguePiece[];
  /** Votes are not accepted yet (a picture is still loading) or a vote is on its way. */
  disabled: boolean;
  /** This side was tapped and the answer is not in yet: it already looks chosen. */
  pending: boolean;
  onVote: () => void;
  onMenu: () => void;
  onImageSettled: () => void;
}

/**
 * One side of a pair, before the vote: the whole card is the button; its report menu is a **sibling** of that button (an
 * accessible parent would hide it from VoiceOver).
 */
export function VoteCard({
  side,
  pieces,
  disabled,
  pending,
  onVote,
  onMenu,
  onImageSettled,
}: VoteCardProps) {
  const name = SIDE_NAMES[side];
  return (
    <View style={styles.slot}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={tr.leagueVoteCard(name, spokenSlots(pieces))}
        accessibilityState={{ disabled, busy: pending }}
        disabled={disabled}
        onPress={onVote}
        style={[styles.card, pending && styles.chosen]}
        testID={`vote-${side}`}
      >
        <LeagueFigure pieces={pieces} onImageSettled={onImageSettled} testID={`figure-${side}`} />
      </PressableScale>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.leagueMenuLabel(name)}
        onPress={onMenu}
        style={styles.menu}
        testID={`menu-${side}`}
      >
        <Icon name="more" size={20} color={theme.colors.ink2} />
      </Pressable>
    </View>
  );
}

interface ResultCardProps {
  pieces: readonly LeaguePiece[];
  /** The side the player picked: chalk edge and "Senin seçimin". */
  chosen: boolean;
  side: Side;
}

/** One side after the vote: the chosen one keeps its place with a chalk edge and a word, the other steps back. */
export function ResultCard({ pieces, chosen, side }: ResultCardProps) {
  return (
    <Reveal style={styles.slot}>
      <View
        style={[styles.card, chosen && styles.chosen, !chosen && styles.dimmed]}
        testID={`result-${side}${chosen ? '-chosen' : ''}`}
      >
        {chosen ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tr.leagueYourChoice}</Text>
          </View>
        ) : null}
        <LeagueFigure pieces={pieces} />
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    minHeight: theme.sizes.arenaCardMinHeight,
  },
  // The border is always there (in the card's own colour) so the card does not change size when it is chosen.
  card: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.panel,
    borderWidth: theme.sizes.arenaCardBorder,
    borderColor: theme.colors.bg,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.sizes.arenaCardTop,
  },
  chosen: {
    borderColor: theme.colors.chalk,
  },
  dimmed: {
    opacity: 0.4,
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: theme.colors.chalk,
    borderRadius: theme.radius.tag,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tagText: {
    ...theme.typography.captionStrong,
    color: theme.colors.chalkInk,
  },
});

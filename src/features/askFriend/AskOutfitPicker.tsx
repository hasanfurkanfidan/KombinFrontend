import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Outfit } from '@/api/models';
import { Button } from '@/components/Button';
import { OutfitMiniFigure } from '@/features/outfits/OutfitMiniFigure';
import { useDailyOutfit, useSavedOutfits } from '@/features/outfits/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { lines } from '@/utils/a11y';

interface AskOutfitPickerProps {
  /** The outfit already in the ask: it is not offered again. */
  excludeId: string;
  onPick: (outfit: Outfit) => void;
  onBack: () => void;
}

/** The backend refuses a dismissed outfit; everything else the user owns may be asked about. */
function askable(outfit: Outfit | null | undefined, excludeId: string): outfit is Outfit {
  return Boolean(outfit) && outfit?.id !== excludeId && outfit?.status !== 'Dismissed';
}

/**
 * The "+ İkinci kombin" picker, drawn inside the ask sheet (a second modal over the first is unreliable on iOS):
 * today's outfit first, then the saved ones. Mounted only while picking, so neither list is asked for before.
 */
export function AskOutfitPicker({ excludeId, onPick, onBack }: AskOutfitPickerProps) {
  // Seed 0 without an occasion: the same query key as the home card's first answer, so it usually comes from cache.
  const daily = useDailyOutfit({ date: 'today', seed: 0 });
  const saved = useSavedOutfits();

  const today = daily.data?.outfit;
  const todayShown = askable(today, excludeId) ? today : null;
  // First page only (like the other sheet pickers): a plain map inside the sheet's scroll view stays bounded.
  const savedShown = (saved.data?.pages[0]?.items ?? []).filter(
    (outfit) => askable(outfit, excludeId) && outfit.id !== todayShown?.id,
  );
  const settled = !daily.isPending && !saved.isPending;
  const nothingShown = !todayShown && savedShown.length === 0;
  const loading = !settled && nothingShown;
  const empty = settled && nothingShown;

  return (
    <View style={styles.root} testID="ask-picker">
      {loading ? <ActivityIndicator color={theme.colors.ink} /> : null}

      {todayShown ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{tr.askPickToday}</Text>
          <PickRow outfit={todayShown} onPick={onPick} />
        </View>
      ) : null}

      {savedShown.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{tr.askPickSaved}</Text>
          {savedShown.map((outfit) => (
            <PickRow key={outfit.id} outfit={outfit} onPick={onPick} />
          ))}
        </View>
      ) : null}

      {saved.isError && savedShown.length === 0 ? (
        <Text style={styles.muted}>{tr.outfitSavedLoadFailed}</Text>
      ) : null}
      {empty && !saved.isError ? <Text style={styles.muted}>{tr.askPickEmpty}</Text> : null}

      <Button variant="quiet" label={tr.back} onPress={onBack} testID="ask-picker-back" />
    </View>
  );
}

function PickRow({ outfit, onPick }: { outfit: Outfit; onPick: (outfit: Outfit) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.askPickOutfitA11y(outfit.narration.text)}
      onPress={() => onPick(outfit)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={`ask-pick-${outfit.id}`}
    >
      <View style={styles.thumb}>
        <OutfitMiniFigure pieces={outfit.pieces} />
      </View>
      <Text style={styles.rowText} numberOfLines={lines(3)}>
        {outfit.narration.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.lg,
  },
  group: {
    gap: theme.spacing.sm,
  },
  groupLabel: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  row: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface,
  },
  thumb: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
  rowText: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
});

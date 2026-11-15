import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { track } from '@/analytics';
import type { TripDay, TripGap, TripPackItem, TripPlan } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/features/tracking/SegmentedControl';
import { openOffer } from '@/features/catalog/buy';
import { occasionLabel } from '@/features/outfits/labels';
import { OutfitMiniFigure } from '@/features/outfits/OutfitMiniFigure';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { formatDay } from './calendar';
import {
  coverageSentence,
  dayFigurePieces,
  hasMissingPieces,
  slotGroupLabel,
  tripWeatherText,
} from './labels';

type View_ = 'pack' | 'days';
const VIEWS: readonly { value: View_; label: string }[] = [
  { value: 'pack', label: tr.tripViewPack },
  { value: 'days', label: tr.tripViewDays },
];

interface TripPlanViewProps {
  plan: TripPlan;
  /** Planning again is possible (a trip that is over cannot be). */
  canReplan: boolean;
  replanning: boolean;
  onReplan: () => void;
  /** A sentence under the banner when planning again failed. */
  replanError?: string | null;
}

/**
 * One plan, two views of it: "Valiz" is what goes in the suitcase and how many days each piece is worn, "Günler" is
 * the outfit for each day with its weather. The coverage is a sentence, the gaps (what is missing and what would
 * fill it) come after, and a piece that left the wardrobe since is marked, with the way to plan again.
 */
export function TripPlanView({
  plan,
  canReplan,
  replanning,
  onReplan,
  replanError,
}: TripPlanViewProps) {
  const [view, setView] = useState<View_>('pack');
  const total = toNumber(plan.coverage.total);
  const covered = toNumber(plan.coverage.covered);
  // The backend's partial-coverage message repeats the sentence above; its other messages (thin wardrobe, piece limit) do not.
  const note =
    plan.message && !plan.message.startsWith(`${total} günün ${covered} günü`)
      ? plan.message
      : null;

  return (
    <View style={styles.root}>
      <View style={styles.summary}>
        <Text style={styles.coverage} testID="trip-coverage">
          {coverageSentence(plan.coverage)}
        </Text>
        <Text style={styles.muted}>{tr.tripPieceCount(toNumber(plan.pieceCount))}</Text>
        {note ? (
          <Text style={styles.note} testID="trip-note">
            {note}
          </Text>
        ) : null}
      </View>

      {hasMissingPieces(plan) ? (
        <View style={styles.banner} testID="trip-missing-banner">
          <Text style={styles.bannerText}>{tr.tripMissingBanner}</Text>
          {canReplan ? (
            <Button
              label={replanning ? tr.tripReplanning : tr.tripReplan}
              variant="secondary"
              disabled={replanning}
              onPress={onReplan}
              style={styles.bannerAction}
              testID="trip-replan"
            />
          ) : (
            <Text style={styles.muted} testID="trip-over">
              {tr.tripOver}
            </Text>
          )}
          {replanError ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" testID="trip-replan-error">
              {replanError}
            </Text>
          ) : null}
        </View>
      ) : null}

      <SegmentedControl options={VIEWS} value={view} onChange={setView} />

      {view === 'pack' ? (
        <View testID="trip-pack">
          {plan.pieces.map((group) => (
            <View key={group.slot} style={styles.group}>
              <Text style={styles.groupTitle} accessibilityRole="header">
                {slotGroupLabel(group.slot)}
              </Text>
              {group.items.map((item) => (
                <PackRow key={item.wardrobeItemId} item={item} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View testID="trip-days">
          {plan.days.map((day) => (
            <DayRow key={day.date} day={day} />
          ))}
        </View>
      )}

      {plan.gaps.length > 0 ? (
        <View style={styles.gaps} testID="trip-gaps">
          <Text style={styles.groupTitle} accessibilityRole="header">
            {tr.tripGapsTitle}
          </Text>
          {plan.gaps.map((gap) => (
            <GapRow key={`${gap.slot}-${gap.reason}`} gap={gap} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Thumb({ uri, missing, size }: { uri: string | null; missing: boolean; size: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size }, missing && styles.thumbMissing]}>
      {uri ? (
        <AppImage
          uri={uri}
          style={[styles.thumbImage, missing && styles.ghost]}
          contentFit="contain"
        />
      ) : (
        <Icon name="shirt" size={size / 2.4} color={theme.colors.control} strokeWidth={1.4} />
      )}
    </View>
  );
}

function PackRow({ item }: { item: TripPackItem }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[
        item.name,
        item.missing ? tr.tripMissingTag : tr.tripPackDays(toNumber(item.days)),
      ].join(', ')}
      testID={`trip-pack-${item.wardrobeItemId}`}
    >
      <Thumb uri={item.imageUrl} missing={item.missing} size={theme.sizes.tagThumb} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        {item.missing ? (
          <View style={styles.missingTag} testID={`trip-missing-${item.wardrobeItemId}`}>
            <Text style={styles.missingTagText}>{tr.tripMissingTag}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>{tr.tripPackDays(toNumber(item.days))}</Text>
        )}
      </View>
    </View>
  );
}

function DayRow({ day }: { day: TripDay }) {
  const weather = tripWeatherText(day.weather);
  const occasion = occasionLabel(day.occasion);
  return (
    <View style={styles.dayRow} testID={`trip-day-${day.date}`}>
      <View style={styles.rowText}>
        <Text style={styles.dayTitle} accessibilityRole="header">
          {formatDay(day.date)}
        </Text>
        <Text style={styles.muted}>
          {[weather.text, weather.note, occasion].filter(Boolean).join(' · ')}
        </Text>
        {day.outfit ? (
          <Text style={styles.narration} numberOfLines={3}>
            {day.outfit.narration.text}
          </Text>
        ) : (
          <Text style={styles.noOutfit} testID={`trip-day-empty-${day.date}`}>
            {tr.tripDayNoOutfit}
          </Text>
        )}
      </View>
      {day.outfit ? (
        <OutfitMiniFigure pieces={dayFigurePieces(day.outfit)} testID={`trip-figure-${day.date}`} />
      ) : null}
    </View>
  );
}

/** One gap: the backend's sentence and, when it found one, the catalog piece that would fill it with its buy link. */
function GapRow({ gap }: { gap: TripGap }) {
  const suggestion = gap.suggestion;
  const price = suggestion ? formatTry(toNumber(suggestion.offer.price)) : '';
  const seller = suggestion?.offer.seller?.name ?? '';
  return (
    <View style={styles.gap} testID={`trip-gap-${gap.slot}`}>
      <Text style={styles.gapMessage}>{gap.message}</Text>
      {suggestion ? (
        <View style={styles.row}>
          <Thumb uri={suggestion.imageUrl} missing={false} size={theme.sizes.tagThumb} />
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={2}>
              {suggestion.name}
            </Text>
            <Text style={styles.muted}>{seller ? tr.outfitPieceLine(seller, price) : price}</Text>
          </View>
          <Button
            label={tr.tripGapBuy}
            variant="secondary"
            accessibilityLabel={tr.tripGapBuyLabel(suggestion.name, seller, price)}
            onPress={() => {
              track('trip_gap_click', { slot: gap.slot });
              void openOffer(
                { id: suggestion.offer.offerId, goPath: suggestion.offer.goPath },
                { source: 'trip' },
              );
            }}
            style={styles.buy}
            testID={`trip-gap-buy-${gap.slot}`}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.xl,
  },
  summary: {
    gap: 2,
  },
  coverage: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  muted: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  note: {
    ...theme.typography.body,
    color: theme.colors.ink2,
    marginTop: theme.spacing.xs,
  },
  // Kombin pointing at something: the surface panel with a chalk dashed edge, as on the budget banner.
  banner: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.sizes.dashedBorder,
    borderStyle: 'dashed',
    borderColor: theme.colors.chalkLine,
  },
  bannerText: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  bannerAction: {
    alignSelf: 'flex-start',
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  group: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  groupTitle: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.sizes.touch,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  thumb: {
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbMissing: {
    backgroundColor: 'transparent',
    borderWidth: theme.sizes.dashedBorder,
    borderStyle: 'dashed',
    borderColor: theme.colors.chalkLine,
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.xs,
  },
  ghost: {
    opacity: 0.45,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  missingTag: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.chalk,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  missingTagText: {
    ...theme.typography.captionStrong,
    color: theme.colors.chalkInk,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  dayTitle: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  narration: {
    ...theme.typography.body,
    color: theme.colors.ink2,
    marginTop: theme.spacing.xs,
  },
  noOutfit: {
    ...theme.typography.body,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  gaps: {
    gap: theme.spacing.md,
  },
  gap: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  gapMessage: {
    ...theme.typography.body,
    color: theme.colors.ink,
  },
  buy: {
    paddingHorizontal: theme.spacing.lg,
  },
});

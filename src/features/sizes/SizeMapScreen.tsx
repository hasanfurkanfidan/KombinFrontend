import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { SizeEntry } from '@/api/models';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useProfile } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { useSizes } from './hooks';
import { MeasurementsSheet } from './MeasurementsSheet';
import { SizeSheet } from './SizeSheet';

interface BrandRow {
  brandId: string;
  brand: string;
  tops: SizeEntry | undefined;
  bottoms: SizeEntry | undefined;
  shoes: SizeEntry | undefined;
}

/**
 * One row per brand. The table has three columns: outerwear sizes share the "Üst" column (shown only when the
 * brand has no top size), accessories are not listed. Every entry still feeds the size hint on product detail.
 */
export function groupByBrand(entries: readonly SizeEntry[]): BrandRow[] {
  const rows = new Map<string, BrandRow>();
  for (const entry of entries) {
    const row = rows.get(entry.brand.id) ?? {
      brandId: entry.brand.id,
      brand: entry.brand.name,
      tops: undefined,
      bottoms: undefined,
      shoes: undefined,
    };
    if (entry.group === 'Tops') row.tops = entry;
    else if (entry.group === 'Outerwear') row.tops ??= entry;
    else if (entry.group === 'Bottoms') row.bottoms = entry;
    else if (entry.group === 'Shoes') row.shoes = entry;
    rows.set(entry.brand.id, row);
  }
  return [...rows.values()].sort((a, b) => a.brand.localeCompare(b.brand, 'tr'));
}

/** Screen 08: measurements card, the per-brand size table and the "Marka ekle" action. */
export function SizeMapScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const profile = useProfile();
  const sizes = useSizes();
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const rows = useMemo(() => groupByBrand(sizes.data ?? []), [sizes.data]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <IconButton
          icon="arrowLeft"
          label={tr.back}
          tone="tinted"
          onPress={goBack}
          testID="sizes-back"
        />
        <Text style={styles.title}>{tr.sizeMapTitle}</Text>
      </View>

      {!isSignedIn ? (
        <EmptyState
          title={tr.profileLoggedOutTitle}
          body={tr.profileLoggedOutBody}
          action={{ label: tr.login, onPress: () => router.push('/login') }}
        />
      ) : (
        <>
          <MeasurementsCard
            profile={profile.data}
            loading={profile.isPending}
            onEdit={() => setMeasurementsOpen(true)}
          />

          <View style={styles.headingBlock}>
            <Text style={styles.heading}>{tr.sizeMapHeading}</Text>
            <Text style={styles.subtitle}>{tr.sizeMapSubtitle}</Text>
          </View>

          {sizes.isError ? (
            <ErrorState body={tr.sizeMapLoadFailed} onRetry={() => void sizes.refetch()} />
          ) : sizes.isPending ? (
            <Skeleton height={160} radius={theme.radius.lg} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>{tr.sizeMapEmpty}</Text>
          ) : (
            <View style={styles.table} testID="size-table">
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.headCell, styles.brandCol]}>{tr.sizeMapColBrand}</Text>
                <Text style={[styles.headCell, styles.sizeCol]}>{tr.sizeMapColTops}</Text>
                <Text style={[styles.headCell, styles.sizeCol]}>{tr.sizeMapColBottoms}</Text>
                <Text style={[styles.headCell, styles.sizeCol]}>{tr.sizeMapColShoes}</Text>
              </View>
              {rows.map((row) => (
                <View
                  key={row.brandId}
                  style={[styles.tableRow, styles.tableBody]}
                  testID={`size-row-${row.brandId}`}
                >
                  <Text style={[styles.brandCell, styles.brandCol]} numberOfLines={1}>
                    {row.brand}
                  </Text>
                  <SizeCell entry={row.tops} />
                  <SizeCell entry={row.bottoms} />
                  <SizeCell entry={row.shoes} />
                </View>
              ))}
            </View>
          )}

          <View style={styles.info}>
            <Icon name="info" size={18} color={theme.colors.accent} />
            <Text style={styles.infoText}>{tr.sizeMapInfo}</Text>
          </View>

          <Button
            label={tr.sizeMapAddBrand}
            variant="secondary"
            trailingIcon="plus"
            onPress={() => setSizeOpen(true)}
            testID="size-add-brand"
          />
        </>
      )}

      {profile.data ? (
        <MeasurementsSheet
          visible={measurementsOpen}
          onClose={() => setMeasurementsOpen(false)}
          profile={profile.data}
        />
      ) : null}
      <SizeSheet visible={sizeOpen} onClose={() => setSizeOpen(false)} />
    </Screen>
  );
}

function SizeCell({ entry }: { entry: SizeEntry | undefined }) {
  if (!entry) {
    return <Text style={[styles.emptyCell, styles.sizeCol]}>{tr.measurementEmpty}</Text>;
  }
  const inferred = entry.source === 'Inferred';
  return (
    <Text style={[styles.sizeCell, styles.sizeCol, inferred && styles.sizeInferred]}>
      {inferred ? `${entry.size}?` : entry.size}
    </Text>
  );
}

function MeasurementsCard({
  profile,
  loading,
  onEdit,
}: {
  profile: ReturnType<typeof useProfile>['data'];
  loading: boolean;
  onEdit: () => void;
}) {
  const cells = [
    { label: `${tr.measurementHeight} ${tr.measurementUnitCm}`, value: profile?.heightCm },
    { label: `${tr.measurementWeight} ${tr.measurementUnitKg}`, value: profile?.weightKg },
    { label: `${tr.measurementChest} ${tr.measurementUnitCm}`, value: profile?.chestCm },
    { label: `${tr.measurementWaist} ${tr.measurementUnitCm}`, value: profile?.waistCm },
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{tr.measurementsTitle}</Text>
      <View style={styles.cardRow}>
        {cells.map((cell) => (
          <View key={cell.label} style={styles.cardCell}>
            {loading ? (
              <Skeleton height={22} width={36} radius={theme.radius.sm} />
            ) : (
              <Text style={styles.cardValue}>
                {cell.value === null || cell.value === undefined
                  ? tr.measurementEmpty
                  : String(cell.value).replace('.', ',')}
              </Text>
            )}
            <Text style={styles.cardCaption}>{cell.label}</Text>
          </View>
        ))}
      </View>
      <Button
        label={tr.measurementsUpdate}
        variant="secondary"
        onPress={onEdit}
        style={styles.cardButton}
        testID="measurements-edit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  card: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  cardLabel: {
    ...theme.typography.overline,
    color: theme.colors.borderStrong,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardCell: {
    gap: 2,
  },
  cardValue: {
    ...theme.typography.priceLarge,
    color: theme.colors.onInk,
  },
  cardCaption: {
    ...theme.typography.caption,
    color: theme.colors.borderStrong,
  },
  cardButton: {
    alignSelf: 'flex-start',
    height: theme.sizes.touch,
    backgroundColor: 'transparent',
    borderColor: theme.colors.inkMuted,
  },
  headingBlock: {
    gap: theme.spacing.xs,
  },
  heading: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  empty: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  tableHead: {
    height: 40,
    backgroundColor: theme.colors.surfaceAlt,
  },
  tableBody: {
    minHeight: theme.sizes.touch + theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  brandCol: {
    flex: 1.6,
  },
  sizeCol: {
    flex: 1,
  },
  headCell: {
    ...theme.typography.overline,
    color: theme.colors.inkMuted,
  },
  brandCell: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  sizeCell: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  sizeInferred: {
    color: theme.colors.inkMuted,
  },
  emptyCell: {
    ...theme.typography.body,
    color: theme.colors.borderStrong,
  },
  info: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentSoft,
  },
  infoText: {
    ...theme.typography.caption,
    flex: 1,
    color: theme.colors.accent,
  },
});

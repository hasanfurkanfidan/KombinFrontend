import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import type { LensResult } from '@/api/models';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { showToast } from '@/components/toastStore';
import { productHref } from '@/features/catalog/productLink';
import { audienceLabels } from '@/features/catalog/filters';
import { addPhotos } from '@/features/wardrobe/addItem';
import type { PickedPhoto } from '@/features/wardrobe/addStore';
import { pickPhoto, takePhoto } from '@/features/wardrobe/picker';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { discardTempFile } from '@/utils/tempFiles';

import { useLensSearch, type LensSource } from './hooks';
import { lensErrorKind, regionTitle, similarityBucket } from './labels';
import { LensPhotoView } from './LensPhotoView';
import { cropRegion } from './photo';
import { RegionResults } from './RegionResults';
import { lines } from '@/utils/a11y';

export type LensEntry = 'explore' | 'home' | 'other';

export function parseLensEntry(value: unknown): LensEntry {
  return value === 'explore' || value === 'home' ? value : 'other';
}

interface LensScreenProps {
  /** Where it was opened (`entry` route param): `explore` is the camera in Keşfet's search field; `home` (the old tile) is kept valid. */
  entry?: string;
}

/**
 * "Görselden bul" (design screen 11), one screen in three states: capture (camera or gallery), scanning (the photo
 * under a quiet light band) and results (numbered region outlines on the photo, the selected region's rail under it,
 * "Dolabıma ekle" as the one primary action).
 */
export function LensScreen({ entry }: LensScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useSession();
  const search = useLensSearch();
  const [picked, setPicked] = useState<{ photo: PickedPhoto; source: LensSource } | null>(null);
  const [selected, setSelected] = useState(0);
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set());
  const [adding, setAdding] = useState(false);

  // Every photo this screen put in the cache (the pick and its re-encoded copy) is deleted when it is done with them.
  const tempUris = useRef(new Set<string>());
  useEffect(() => {
    const uris = tempUris.current;
    return () => {
      uris.forEach((uri) => void discardTempFile(uri));
      uris.clear();
    };
  }, []);
  const sentUri = search.data?.photo.uri;
  useEffect(() => {
    if (sentUri) {
      tempUris.current.add(sentUri);
    }
  }, [sentUri]);

  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      track('lens_open', { entry: parseLensEntry(entry) });
    }
  }, [entry]);

  const run = (photo: PickedPhoto, source: LensSource, prepared: boolean, audience?: 'all') => {
    setSelected(0);
    setAdded(new Set());
    search.mutate({ photo, source, prepared, audience });
  };

  const choose = async (source: LensSource) => {
    let photo: PickedPhoto | null;
    if (source === 'camera') {
      const photos = await takePhoto();
      if (photos === 'denied') {
        showToast(tr.lensCameraDenied);
        return;
      }
      photo = photos[0] ?? null;
    } else {
      photo = await pickPhoto();
    }
    if (photo) {
      tempUris.current.add(photo.uri);
      setPicked({ photo, source });
      run(photo, source, false);
    }
  };

  const startOver = () => {
    search.reset();
    setPicked(null);
    tempUris.current.forEach((uri) => void discardTempFile(uri));
    tempUris.current.clear();
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const outcome = search.data;
  const regions = outcome?.result.regions ?? [];
  const wholePhoto = outcome?.result.wholePhoto ?? false;
  const region = regions[selected];
  const showResults = picked !== null && !search.isPending && outcome !== undefined;

  const addSelected = async () => {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    if (!outcome || !region) {
      return;
    }
    setAdding(true);
    try {
      const crop = await cropRegion(outcome.photo, region.box);
      void addPhotos(queryClient, [crop], 'camera');
      track(
        'lens_add_to_wardrobe',
        !wholePhoto && region.family !== null ? { family: region.family } : {},
      );
      const position = selected;
      setAdded((previous) => new Set(previous).add(position));
      showToast(tr.lensAddToast, {
        label: tr.lensAddToastAction,
        onPress: () => router.navigate('/wardrobe'),
      });
    } catch {
      showToast(tr.lensAddFailed);
    } finally {
      setAdding(false);
    }
  };

  const openResult = (result: LensResult, position: number) => {
    track('lens_result_tap', {
      productId: result.product.id,
      position,
      similarity: similarityBucket(result.level),
    });
    router.push(productHref(result.product.id, 'lens'));
  };

  const isAdded = added.has(selected);
  const addButton = {
    label: isAdded ? tr.lensAdded : tr.lensAdd,
    onPress: () => void addSelected(),
    loading: adding,
    disabled: isAdded,
  };

  let body;
  if (picked === null) {
    body = <Capture onChoose={(source) => void choose(source)} />;
  } else if (search.isPending) {
    body = (
      <LensPhotoView
        uri={picked.photo.uri}
        width={picked.photo.width}
        height={picked.photo.height}
        scanning
      />
    );
  } else if (search.isError) {
    body =
      lensErrorKind(search.error) === 'unreadable' ? (
        <EmptyState
          title={tr.lensUnreadable}
          action={{ label: tr.lensNewPhoto, onPress: startOver }}
        />
      ) : (
        <ErrorState
          error={search.error}
          onRetry={() => {
            if (search.variables) {
              search.mutate(search.variables);
            }
          }}
        />
      );
  } else if (outcome) {
    const audience = outcome.result.audience;
    body = (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + theme.sizes.buttonHeight + theme.spacing.xxxl * 2,
        }}
      >
        <LensPhotoView
          uri={outcome.photo.uri}
          width={outcome.photo.width}
          height={outcome.photo.height}
          regions={regions}
          wholePhoto={wholePhoto}
          selected={selected}
          onSelect={setSelected}
        />
        <View style={styles.results}>
          {audience ? (
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr.lensAudienceRemove(audienceLabels[audience])}
                onPress={() => run(outcome.photo, picked.source, true, 'all')}
                hitSlop={{ top: 4, bottom: 4 }}
                style={styles.audienceChip}
                testID="lens-audience"
              >
                <Text style={styles.audienceText}>{audienceLabels[audience]}</Text>
                <Icon name="close" size={14} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : null}
          {region ? (
            <RegionResults
              region={region}
              number={selected + 1}
              title={regionTitle(region, wholePhoto)}
              onOpenProduct={openResult}
              onOpenItem={(itemId) => router.push(`/wardrobe/${itemId}`)}
              addButton={addButton}
            />
          ) : (
            <View style={styles.noRegion}>
              <Text style={styles.noRegionText}>{tr.lensEmptyRail}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="close" label={tr.close} onPress={close} testID="lens-close" />
        <Text accessibilityRole="header" style={styles.title} numberOfLines={lines(1)}>
          {tr.lensTitle}
        </Text>
        {showResults ? (
          <Pressable
            accessibilityRole="button"
            onPress={startOver}
            style={styles.newPhoto}
            testID="lens-new-photo"
          >
            <Text style={styles.newPhotoText}>{tr.lensNewPhoto}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>{body}</View>

      {/* The one primary action; an empty rail carries it itself, so it is never on screen twice. */}
      {showResults && region && region.results.length > 0 ? (
        <View style={[styles.bar, { paddingBottom: theme.spacing.md + insets.bottom }]}>
          <Button
            label={addButton.label}
            onPress={addButton.onPress}
            loading={addButton.loading}
            disabled={addButton.disabled}
            testID="lens-add"
          />
        </View>
      ) : null}
    </View>
  );
}

function Capture({ onChoose }: { onChoose: (source: LensSource) => void }) {
  return (
    <View style={styles.capture} testID="lens-capture">
      <View style={styles.captureSteps}>
        <Card style={styles.stepsPanel} testID="lens-steps">
          {tr.lensSteps.map((step, index) => (
            <View key={step} style={styles.step} testID={`lens-step-${index + 1}`}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>
      </View>
      <View style={styles.captureActions}>
        <Button label={tr.lensCamera} onPress={() => onChoose('camera')} testID="lens-camera" />
        <Button
          label={tr.lensGallery}
          variant="secondary"
          onPress={() => onChoose('gallery')}
          testID="lens-gallery"
        />
        <Text style={styles.captureHint}>{tr.lensCaptureHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingVertical: theme.spacing.sm,
  },
  title: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
    flex: 1,
  },
  newPhoto: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  newPhotoText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  body: {
    flex: 1,
  },
  capture: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
  },
  captureSteps: {
    flex: 1,
    justifyContent: 'center',
  },
  stepsPanel: {
    gap: theme.spacing.xl,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  stepBadge: {
    width: theme.sizes.lensStepBadge,
    height: theme.sizes.lensStepBadge,
    borderRadius: theme.sizes.lensStepBadge / 2,
    backgroundColor: theme.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  stepText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    flex: 1,
  },
  captureActions: {
    gap: theme.spacing.md,
  },
  captureHint: {
    ...theme.typography.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  results: {
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    paddingHorizontal: theme.screenPaddingX,
  },
  audienceChip: {
    // The selected-chip look: the audience is a filter the user can drop.
    height: theme.sizes.chipHeight,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primarySoft,
  },
  audienceText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
  },
  noRegion: {
    paddingHorizontal: theme.screenPaddingX,
  },
  noRegionText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
  },
});

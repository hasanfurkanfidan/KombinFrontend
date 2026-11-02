import { useState, type ReactElement } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import type { Outfit } from '@/api/models';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { useHowToWear } from './hooks';
import { NarrationRow, OutfitFrame } from './OutfitFrame';
import { OutfitPieces } from './OutfitPieces';
import { OutfitPanel } from './OutfitSheet';
import { useTrackOutfitView } from './tracking';

interface HowToWearScreenProps {
  productId?: string;
  wardrobeItemId?: string;
}

/**
 * "Bunu nasıl giyerim?": up to five outfits built around one catalog product or wardrobe item, in a horizontal pager.
 * The anchor piece is highlighted; the sheet under the pager follows the page on screen.
 */
export function HowToWearScreen({ productId, wardrobeItemId }: HowToWearScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isSignedIn } = useSession();
  const query = useHowToWear({ productId, wardrobeItemId });
  const [index, setIndex] = useState(0);
  const outfits: Outfit[] = query.data?.outfits ?? [];
  const current = outfits[index] ?? outfits[0];
  useTrackOutfitView(current);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let body: ReactElement;
  if (!isSignedIn) {
    body = (
      <EmptyState
        title={tr.outfitSignedOutTitle}
        body={tr.outfitSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (query.isPending) {
    body = (
      <View style={styles.skeleton} testID="outfit-skeleton">
        <Skeleton height={width - theme.screenPaddingX * 2} radius={theme.radius.xxl} />
      </View>
    );
  } else if (query.isError) {
    body = <ErrorState title={tr.outfitLoadFailed} onRetry={() => void query.refetch()} />;
  } else if (outfits.length === 0) {
    body = (
      <EmptyState
        title={tr.outfitHowToWearEmpty}
        body={query.data.message ?? tr.outfitNothingBody}
      />
    );
  } else {
    body = (
      <>
        <FlatList
          data={outfits}
          keyExtractor={(outfit) => outfit.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <ScrollView
              style={{ width }}
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}
              testID="outfit-page"
            >
              <OutfitPieces pieces={item.pieces} />
              <NarrationRow text={item.narration.text} />
            </ScrollView>
          )}
        />
        {outfits.length > 1 ? (
          <View style={styles.dots} testID="outfit-dots">
            {outfits.map((outfit, position) => (
              <View key={outfit.id} style={[styles.dot, position === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <OutfitFrame
      title={tr.outfitHowToWearTitle}
      subtitle={outfits.length > 0 ? tr.outfitPage(index + 1, outfits.length) : null}
      onClose={close}
      sheet={current ? <OutfitPanel key={current.id} outfit={current} /> : undefined}
    >
      {body}
    </OutfitFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.lg,
  },
  skeleton: {
    paddingHorizontal: theme.screenPaddingX,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
  dot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
  },
  dotActive: {
    width: theme.spacing.xl,
    backgroundColor: theme.colors.ink,
  },
});

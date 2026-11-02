import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { useOutfit } from './hooks';
import { outfitSubtitle, outfitTitle } from './labels';
import { NarrationRow, OutfitFrame } from './OutfitFrame';
import { OutfitPieces } from './OutfitPieces';
import { OutfitPanel } from './OutfitSheet';
import { useTrackOutfitView } from './tracking';

/** One stored outfit (opened from the saved list): the same view as the daily one, without shuffling or dismissing. */
export function OutfitDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const query = useOutfit(id);
  const outfit = query.data;
  useTrackOutfitView(outfit);

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
      <View style={styles.padded}>
        <Skeleton height={320} radius={theme.radius.xxl} />
      </View>
    );
  } else if (query.isError) {
    body =
      query.error instanceof ApiError && query.error.status === 404 ? (
        <ErrorState title={tr.outfitNotFound} />
      ) : (
        <ErrorState title={tr.outfitLoadFailed} onRetry={() => void query.refetch()} />
      );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.padded} showsVerticalScrollIndicator={false}>
        <OutfitPieces pieces={query.data.pieces} shopping={query.data.kind === 'Shopping'} />
        <NarrationRow text={query.data.narration.text} />
      </ScrollView>
    );
  }

  return (
    <OutfitFrame
      title={outfit ? outfitTitle(outfit, outfit.date) : tr.outfitViewTitle}
      subtitle={outfit ? outfitSubtitle(outfit.weather, undefined) : null}
      onClose={close}
      sheet={outfit ? <OutfitPanel outfit={outfit} /> : undefined}
    >
      {body}
    </OutfitFrame>
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.lg,
  },
});

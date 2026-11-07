import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { createOutfitPost, getPost, publishPost } from '@/api/endpoints/social';
import type { Outfit, Post, PostKind, PostVisibility } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/toastStore';
import { OutfitCollage } from '@/features/outfits/OutfitCollage';
import { useSavedOutfits } from '@/features/outfits/hooks';
import { pickPhotos, takePhoto } from '@/features/wardrobe/picker';
import type { PickedPhoto } from '@/features/wardrobe/addStore';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { ConsentStep } from './ConsentStep';
import { isConsentRequired, uploadPostPhoto, watchPost } from './createPost';
import { useAcceptConsent, useConsent } from './hooks';
import { DEFAULT_VISIBILITY, MAX_CAPTION, statusMessage } from './labels';
import { dotsFromProposals, toPublishTags, type DraftDot } from './tagDraft';
import { TagEditor } from './TagEditor';
import { VisibilityPicker } from './VisibilityPicker';

type Step = 'choose' | 'outfits' | 'working' | 'editor' | 'details' | 'done' | 'ended';

/** The backend takes a duration of at most an hour. */
const MAX_DURATION_MS = 3_600_000;

type DoneStatus = 'Live' | 'Draft' | 'NeedsReview' | 'Blocked' | 'Failed' | 'Cancelled';

interface CreatePostScreenProps {
  /** An unfinished post of the author's ("Gönderilerim" → "Devam et"): the flow picks up where its status says. */
  resumePostId?: string;
}

/**
 * The post flow in one screen: consent (first use) → pick a photo, or a saved outfit → upload and check → tag editor →
 * caption and visibility → publish. Nothing is public until the author confirms the tags and chooses who sees it, and
 * the visibility starts on "Sadece ben".
 */
export function CreatePostScreen({ resumePostId }: CreatePostScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSignedIn } = useSession();
  const consent = useConsent(!resumePostId);
  const accept = useAcceptConsent();

  const [step, setStep] = useState<Step>(resumePostId ? 'working' : 'choose');
  const [consentForced, setConsentForced] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [dots, setDots] = useState<DraftDot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState<'uploading' | 'processing'>('uploading');
  const [outcome, setOutcome] = useState<Post | null>(null);

  const kind = useRef<PostKind>('Photo');
  const startedAt = useRef(0);
  const finished = useRef(false);
  const confirmedCount = useRef(0);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  /** One `post_create_done` per flow: the end state, or "Cancelled" when the screen is left before one. */
  const reportDone = useCallback(
    (status: DoneStatus, tagCount: number, visibility?: PostVisibility) => {
      if (finished.current || startedAt.current === 0) {
        return;
      }
      finished.current = true;
      track('post_create_done', {
        kind: kind.current,
        status,
        tagCount: Math.min(6, tagCount),
        ...(visibility ? { visibility } : {}),
        durationMs: Math.min(MAX_DURATION_MS, Date.now() - startedAt.current),
      });
    },
    [],
  );

  useEffect(
    () => () => {
      reportDone('Cancelled', confirmedCount.current);
    },
    [reportDone],
  );

  const begin = (nextKind: PostKind, source: 'camera' | 'library' | 'outfit') => {
    kind.current = nextKind;
    startedAt.current = Date.now();
    finished.current = false;
    track('post_create_start', { kind: nextKind, source });
  };

  /** Where a post that the backend has finished with goes next. */
  const settle = useCallback(
    (settled: Post) => {
      setPost(settled);
      switch (settled.status) {
        case 'Draft':
          setDots(dotsFromProposals(settled.proposals ?? []));
          setStep('editor');
          break;
        case 'NeedsReview':
          reportDone('NeedsReview', 0);
          setMessage(tr.postNewNeedsReview);
          setStep('ended');
          break;
        case 'Blocked':
          reportDone('Blocked', 0);
          setMessage(settled.statusMessage ?? tr.postNewBlocked);
          setStep('ended');
          break;
        default:
          reportDone('Failed', 0);
          setMessage(statusMessage(settled) ?? tr.postNewFailed);
          setStep('ended');
      }
    },
    [reportDone],
  );

  const watch = useCallback(
    async (postId: string) => {
      setWorking('processing');
      try {
        const result = await watchPost(postId, () => unmounted.current);
        if (result.kind === 'post') {
          settle(result.post);
        } else if (result.kind === 'timeout') {
          reportDone('Failed', 0);
          setMessage(tr.postNewTimeout);
          setStep('ended');
        }
      } catch {
        reportDone('Failed', 0);
        setMessage(tr.postNewFailed);
        setStep('ended');
      }
    },
    [reportDone, settle],
  );

  const sendPhoto = async (photo: PickedPhoto) => {
    setStep('working');
    setWorking('uploading');
    try {
      const postId = await uploadPostPhoto(photo);
      await watch(postId);
    } catch (error) {
      if (isConsentRequired(error)) {
        // The text has a new version (or was never accepted): back to the consent, then the photo can be picked again.
        finished.current = true;
        setConsentForced(true);
        setStep('choose');
        void consent.refetch();
        return;
      }
      reportDone('Failed', 0);
      setMessage(error instanceof ApiError && error.detail ? error.detail : tr.postNewFailed);
      setStep('ended');
    }
  };

  const fromCamera = async () => {
    const photos = await takePhoto();
    if (photos === 'denied') {
      showToast(tr.postNewCameraDenied);
    } else if (photos[0]) {
      begin('Photo', 'camera');
      await sendPhoto(photos[0]);
    }
  };

  const fromLibrary = async () => {
    // The picker hands over several photos; a post is one photo.
    const photos = await pickPhotos();
    if (photos[0]) {
      begin('Photo', 'library');
      await sendPhoto(photos[0]);
    }
  };

  const fromOutfit = async (outfit: Outfit) => {
    begin('Outfit', 'outfit');
    setStep('working');
    setWorking('processing');
    try {
      settle(await createOutfitPost(outfit.id));
    } catch (error) {
      if (isConsentRequired(error)) {
        finished.current = true;
        setConsentForced(true);
        setStep('choose');
        void consent.refetch();
        return;
      }
      reportDone('Failed', 0);
      setMessage(tr.postNewFailed);
      setStep('ended');
    }
  };

  // Picking an unfinished post back up: what its status says decides the step.
  useEffect(() => {
    if (!resumePostId || !isSignedIn) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const existing = await getPost(resumePostId, true);
        if (cancelled) {
          return;
        }
        kind.current = existing.kind;
        startedAt.current = Date.now();
        if (existing.status === 'Processing') {
          await watch(existing.id);
        } else {
          settle(existing);
        }
      } catch {
        if (!cancelled) {
          setMessage(tr.postNotFound);
          setStep('ended');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumePostId, isSignedIn, watch, settle]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let body;
  if (!isSignedIn) {
    body = (
      <EmptyState
        title={tr.postNewSignIn}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (!resumePostId && consent.isPending) {
    body = <ActivityIndicator color={theme.colors.ink} testID="consent-loading" />;
  } else if (!resumePostId && consent.isError && !consent.data) {
    body = <ErrorState title={tr.consentLoadFailed} onRetry={() => void consent.refetch()} />;
  } else if (
    !resumePostId &&
    step === 'choose' &&
    consent.data &&
    (consent.data.acceptedAt === null || consentForced)
  ) {
    body = (
      <ConsentStep
        consent={consent.data}
        accepting={accept.isPending}
        onAccept={() =>
          accept.mutate(consent.data.version, {
            onSuccess: () => setConsentForced(false),
            onError: () => showToast(tr.consentAcceptFailed),
          })
        }
      />
    );
  } else if (step === 'choose') {
    body = (
      <View style={styles.sources} testID="post-sources">
        <Text style={styles.intro}>{tr.postNewIntro}</Text>
        <SourceRow
          icon="camera"
          label={tr.postNewCamera}
          onPress={() => void fromCamera()}
          id="camera"
        />
        <SourceRow
          icon="wardrobe"
          label={tr.postNewLibrary}
          onPress={() => void fromLibrary()}
          id="library"
        />
        <SourceRow
          icon="shirt"
          label={tr.postNewOutfit}
          onPress={() => setStep('outfits')}
          id="outfit"
        />
      </View>
    );
  } else if (step === 'outfits') {
    body = (
      <OutfitPicker onPick={(outfit) => void fromOutfit(outfit)} onBack={() => setStep('choose')} />
    );
  } else if (step === 'working') {
    body = (
      <View style={styles.centered} testID="post-working">
        <ActivityIndicator color={theme.colors.ink} />
        <Text style={styles.title}>
          {working === 'uploading' ? tr.postNewUploading : tr.postNewProcessing}
        </Text>
        {working === 'processing' ? (
          <Text style={styles.muted}>{tr.postNewProcessingHint}</Text>
        ) : null}
      </View>
    );
  } else if (step === 'editor' && post) {
    body = (
      <>
        <Text style={styles.title}>{tr.tagEditorTitle}</Text>
        <TagEditor
          post={post}
          dots={dots}
          onChange={(next) => {
            setDots(next);
            confirmedCount.current = toPublishTags(next).length;
          }}
          onNext={() => setStep('details')}
        />
      </>
    );
  } else if (step === 'details' && post) {
    body = (
      <DetailsStep
        post={post}
        dots={dots}
        onBack={() => setStep('editor')}
        onPublished={(published, tagCount, visibility) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.myPosts });
          void queryClient.invalidateQueries({ queryKey: queryKeys.feedAll });
          reportDone(
            published.status === 'NeedsReview' ? 'NeedsReview' : 'Live',
            tagCount,
            visibility,
          );
          setOutcome(published);
          setStep('done');
        }}
      />
    );
  } else if (step === 'done' && outcome) {
    body = (
      <View style={styles.centered} testID="post-done">
        <Icon name="check" size={32} />
        <Text style={styles.title}>
          {outcome.status === 'NeedsReview'
            ? tr.postNewReviewDone
            : outcome.visibility === 'Private'
              ? tr.postNewDonePrivate
              : tr.postNewDone}
        </Text>
        <Button label={tr.myPostsTitle} onPress={() => router.replace('/posts/mine')} />
        <Button label={tr.close} variant="secondary" onPress={close} />
      </View>
    );
  } else {
    body = (
      <View style={styles.centered} testID="post-ended">
        <Text style={styles.title}>{message ?? tr.postNewFailed}</Text>
        {resumePostId ? null : (
          <Button
            label={tr.postNewAgain}
            onPress={() => {
              setMessage(null);
              setPost(null);
              setStep('choose');
            }}
          />
        )}
        <Button
          label={tr.myPostsTitle}
          variant="secondary"
          onPress={() => router.replace('/posts/mine')}
        />
      </View>
    );
  }

  return (
    <Screen scroll padded contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          icon="close"
          label={tr.close}
          tone="tinted"
          onPress={close}
          testID="post-new-close"
        />
        <Text style={styles.heading}>{tr.postNewTitle}</Text>
      </View>
      {body}
    </Screen>
  );
}

interface DetailsStepProps {
  post: Post;
  dots: readonly DraftDot[];
  onBack: () => void;
  onPublished: (post: Post, tagCount: number, visibility: PostVisibility) => void;
}

/** Caption (up to 300) and who sees the post; the visibility starts on "Sadece ben". */
function DetailsStep({ post, dots, onBack, onPublished }: DetailsStepProps) {
  const [caption, setCaption] = useState(post.caption ?? '');
  const [visibility, setVisibility] = useState<PostVisibility>(DEFAULT_VISIBILITY);
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    // Only what the author confirmed is sent: an unconfirmed dot never leaves this function.
    const tags = toPublishTags(dots);
    setPublishing(true);
    try {
      const published = await publishPost(post.id, {
        caption: caption.trim() || null,
        visibility,
        tags,
      });
      onPublished(published, tags.length, visibility);
    } catch (error) {
      const code = error instanceof ApiError ? error.errorCode : null;
      showToast(
        code === 'Social.PostProcessing'
          ? tr.publishProcessing
          : code === 'Social.InvalidTagTarget'
            ? tr.publishTagInvalid
            : tr.publishFailed,
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.details} testID="post-details">
      <Text style={styles.title}>{tr.publishTitle}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>{tr.publishCaption}</Text>
        <TextInput
          accessibilityLabel={tr.publishCaption}
          value={caption}
          onChangeText={setCaption}
          placeholder={tr.publishCaptionPlaceholder}
          placeholderTextColor={theme.colors.borderStrong}
          maxLength={MAX_CAPTION}
          multiline
          style={styles.captionInput}
          testID="post-caption-input"
        />
        <Text style={styles.counter}>{tr.publishCaptionCount(caption.length, MAX_CAPTION)}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{tr.publishVisibility}</Text>
        <VisibilityPicker value={visibility} onChange={setVisibility} />
      </View>

      <Button
        label={tr.publishAction}
        onPress={() => void publish()}
        loading={publishing}
        testID="post-publish"
      />
      <Button label={tr.publishBack} variant="secondary" onPress={onBack} />
    </View>
  );
}

function SourceRow({
  icon,
  label,
  onPress,
  id,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  id: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.sourceRow}
      testID={`post-source-${id}`}
    >
      <Icon name={icon} size={22} />
      <Text style={styles.sourceLabel}>{label}</Text>
    </Pressable>
  );
}

/** "Kayıtlı kombinden paylaş": the author's saved outfits; a pick becomes a collage post with its pieces as proposals. */
function OutfitPicker({
  onPick,
  onBack,
}: {
  onPick: (outfit: Outfit) => void;
  onBack: () => void;
}) {
  const saved = useSavedOutfits();
  const outfits = saved.data?.pages.flatMap((page) => page.items) ?? [];
  const [open, setOpen] = useState(true);

  return (
    <BottomSheet
      visible={open}
      title={tr.postNewOutfitTitle}
      onClose={() => {
        setOpen(false);
        onBack();
      }}
    >
      {saved.isPending ? <ActivityIndicator color={theme.colors.ink} /> : null}
      {saved.isError ? <Text style={styles.muted}>{tr.outfitSavedLoadFailed}</Text> : null}
      {saved.data && outfits.length === 0 ? (
        <Text style={styles.muted}>{tr.postNewOutfitEmpty}</Text>
      ) : null}
      {outfits.map((outfit) => (
        <Pressable
          key={outfit.id}
          accessibilityRole="button"
          onPress={() => {
            setOpen(false);
            onPick(outfit);
          }}
          style={styles.outfitRow}
          testID={`post-outfit-${outfit.id}`}
        >
          <View style={styles.outfitCollage}>
            <OutfitCollage pieces={outfit.pieces} />
          </View>
          <Text style={styles.outfitText} numberOfLines={2}>
            {outfit.narration.text}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  heading: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  intro: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  sources: {
    gap: theme.spacing.md,
  },
  sourceRow: {
    minHeight: theme.sizes.touch + theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceAlt,
  },
  sourceLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  centered: {
    alignItems: 'stretch',
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  details: {
    gap: theme.spacing.xl,
  },
  field: {
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  captionInput: {
    minHeight: theme.sizes.captionInputHeight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlignVertical: 'top',
    ...theme.typography.body,
    color: theme.colors.ink,
  },
  counter: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    textAlign: 'right',
  },
  outfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  outfitCollage: {
    width: theme.sizes.pickerThumb + theme.spacing.xl,
  },
  outfitText: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
});

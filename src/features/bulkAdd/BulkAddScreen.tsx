import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import {
  cancelBulkBatch,
  confirmBulkBatch,
  createBulkUploadUrl,
  processBulkBatch,
} from '@/api/endpoints/bulkAdd';
import { putPhoto } from '@/api/endpoints/wardrobe';
import type { BulkBatch } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { AppImage } from '@/components/AppImage';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { LiveText } from '@/components/LiveText';
import { Shimmer } from '@/components/Shimmer';
import { showToast } from '@/components/toastStore';
import { AddItemSheet } from '@/features/wardrobe/AddItemSheet';
import { prepareImage } from '@/features/wardrobe/addItem';
import type { AddSource, PickedPhoto } from '@/features/wardrobe/addStore';
import { invalidateWardrobe } from '@/features/wardrobe/cache';
import { pickPhoto, takePhoto } from '@/features/wardrobe/picker';
import { tr } from '@/i18n/tr';
import { userScopeEpoch } from '@/session/userScope';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { lines } from '@/utils/a11y';
import { discardTempFile } from '@/utils/tempFiles';

import { AdviceDrawing } from './AdviceDrawing';
import { BulkPieceTile } from './BulkPieceTile';
import { useBulkStore } from './bulkStore';
import {
  WAIT_LIMIT_MS,
  WAIT_LONG_MS,
  confirmEntries,
  confirmStats,
  initialDrafts,
  problemFromBatch,
  pollErrorKind,
  problemFromError,
  resultEvent,
  tickedCount,
  type PieceDraft,
  type PieceEdits,
  type Problem,
  type RequestStage,
} from './flow';
import { markBulkUnavailable, useBulkBatch } from './hooks';
import { PieceSheet } from './PieceSheet';

const GRID_COLUMNS = 2;
const noop = () => undefined;

type Stage =
  | { kind: 'capture' }
  | { kind: 'uploading' }
  /** Waiting or reviewing: which one is read from the status answer. */
  | { kind: 'tracking' }
  | { kind: 'problem'; problem: Problem; retry: 'upload' | 'process' };

function isWaiting(batch: BulkBatch | undefined): boolean {
  return !batch || batch.status === 'Created' || batch.status === 'Processing';
}

/**
 * "Toplu ekle": one photo of garments laid apart → the pieces in a grid → the ticked ones become wardrobe items. One
 * screen with phases (capture with the advice, waiting on the user's own photo, review, a problem), so leaving it at any
 * point is one event: the batch is cancelled. Design: `docs/design/bulk-add-mobile.md`.
 */
export function BulkAddScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isSignedIn } = useSession();
  const adviceSeen = useBulkStore((state) => state.adviceSeen);

  const [adviceOpen, setAdviceOpen] = useState(!adviceSeen);
  const [stage, setStage] = useState<Stage>({ kind: 'capture' });
  const [photo, setPhoto] = useState<{ photo: PickedPhoto; source: AddSource } | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const [waitRound, setWaitRound] = useState(0);
  const [edits, setEdits] = useState<PieceEdits>({});
  const [openPieceId, setOpenPieceId] = useState<string | null>(null);
  const [singleOpen, setSingleOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const mounted = useRef(true);
  /** The batch the server holds for this screen; cancelled when the screen is left before confirming. */
  const openBatch = useRef<string | null>(null);
  /** What a leave counts as in `bulk_add_cancel`; `null` once the batch has settled into a problem. */
  const cancelStage = useRef<'Processing' | 'Review' | null>(null);
  const resultSent = useRef(false);
  /** A confirm or a re-process is on its way: a second tap (before the button shows it) sends nothing. */
  const busy = useRef(false);
  const startedAt = useRef(0);
  const photoUri = useRef<string | null>(null);

  const tracking = stage.kind === 'tracking';
  const batch = useBulkBatch(tracking ? batchId : null, timedOut);
  const data = tracking ? batch.data : undefined;

  // What a refused poll means: a 429 only slows the poll down (the waiting view stays); any other 4xx is a problem
  // derived from it (no state of its own), and the batch is let go of below.
  const pollError = tracking ? batch.error : null;
  const pollFailure =
    pollErrorKind(pollError) === 'stop' ? problemFromError(pollError, 'poll') : null;
  const waiting = tracking && isWaiting(data) && pollFailure === null;

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/wardrobe');
  }, [router]);

  /** Lets go of the server's batch without a word (a new photo replaces it, or it ended in a problem). */
  const dropBatch = useCallback(() => {
    const id = openBatch.current;
    openBatch.current = null;
    cancelStage.current = null;
    if (id) void cancelBulkBatch(id).catch(noop);
  }, []);

  const closeDisabled = useCallback(() => {
    markBulkUnavailable(queryClient);
    openBatch.current = null;
    cancelStage.current = null;
    close();
  }, [close, queryClient]);

  const sendResult = useCallback(
    (status: 'Ready' | 'Refused' | 'Failed' | 'Timeout', answer: BulkBatch | undefined) => {
      if (resultSent.current) return;
      resultSent.current = true;
      track('bulk_add_result', resultEvent(answer, status, Date.now() - startedAt.current));
    },
    [],
  );

  const showProblem = useCallback(
    (problem: Problem, retry: 'upload' | 'process') => {
      // Daily limit and the like: the batch stays `Created` on the server, so it is let go of at once.
      if (problem.action !== 'retry') dropBatch();
      cancelStage.current = null;
      setStage({ kind: 'problem', problem, retry });
    },
    [dropBatch],
  );

  const fail = useCallback(
    (error: unknown, at: RequestStage) => {
      const problem = problemFromError(error, at);
      if (problem === 'disabled') closeDisabled();
      else showProblem(problem, at === 'process' || at === 'poll' ? 'process' : 'upload');
    },
    [closeDisabled, showProblem],
  );

  // Leaving the screen (✕, back, a gesture, sign-out) cancels a batch that was not confirmed; the photo leaves the disk.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const id = openBatch.current;
      if (id) {
        if (cancelStage.current) track('bulk_add_cancel', { stage: cancelStage.current });
        void cancelBulkBatch(id).catch(noop);
      }
      void discardTempFile(photoUri.current);
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn) close();
  }, [close, isSignedIn]);

  const drafts = useMemo(() => initialDrafts(data?.pieces ?? [], edits), [data, edits]);

  // What the status answer means: a problem derived from it, plus the side effects that go with it (analytics,
  // letting go of a batch the server has given up on).
  const batchProblem = data ? problemFromBatch(data) : null;

  useEffect(() => {
    if (pollFailure === 'disabled') {
      closeDisabled();
    } else if (pollFailure) {
      dropBatch();
    }
  }, [closeDisabled, dropBatch, pollFailure]);

  useEffect(() => {
    if (!data) return;
    if (data.status === 'Ready') {
      cancelStage.current = 'Review';
      sendResult('Ready', data);
    } else if (data.status === 'Refused' || data.status === 'Failed') {
      sendResult(data.status, data);
      cancelStage.current = null;
      if (data.status === 'Refused' || data.failure?.retryable === false) dropBatch();
    } else if (data.status === 'Cancelled' || data.status === 'Expired') {
      dropBatch();
    } else if (data.status === 'Confirmed') {
      // Already added (a confirm whose answer was lost, then asked again): nothing to review, back to Dolap.
      openBatch.current = null;
      cancelStage.current = null;
      void invalidateWardrobe(queryClient);
      close();
    }
  }, [close, data, dropBatch, queryClient, sendResult]);

  // The calm second line after a while, and the wait limit after which the poll stops and the user decides.
  useEffect(() => {
    if (!waiting) return;
    const long = setTimeout(() => setWaitedLong(true), WAIT_LONG_MS);
    const limit = setTimeout(() => setTimedOut(true), WAIT_LIMIT_MS);
    return () => {
      clearTimeout(long);
      clearTimeout(limit);
    };
  }, [waiting, waitRound]);

  useEffect(() => {
    if (timedOut && waiting) sendResult('Timeout', undefined);
  }, [sendResult, timedOut, waiting]);

  const start = useCallback(
    async (picked: PickedPhoto, source: AddSource) => {
      dropBatch();
      resultSent.current = false;
      setEdits({});
      setTimedOut(false);
      setWaitedLong(false);
      setConfirmError(null);
      setBatchId(null);
      setStage({ kind: 'uploading' });
      startedAt.current = Date.now();
      track('bulk_add_start', { source });
      const epoch = userScopeEpoch();
      const alive = () => mounted.current && userScopeEpoch() === epoch;
      let prepared: string | null = null;
      let at: RequestStage = 'upload';
      try {
        const image = await prepareImage(picked);
        prepared = image.uri;
        const upload = await createBulkUploadUrl({
          contentType: image.contentType,
          sizeBytes: image.sizeBytes,
        });
        if (!alive()) {
          void cancelBulkBatch(upload.batchId).catch(noop);
          return;
        }
        openBatch.current = upload.batchId;
        await putPhoto(upload, image.uri);
        // Left during the upload: the batch is being cancelled, so it must not take a processing slot.
        if (!alive()) return;
        at = 'process';
        await processBulkBatch(upload.batchId);
        if (!alive()) return;
        cancelStage.current = 'Processing';
        setBatchId(upload.batchId);
        setWaitRound((round) => round + 1);
        setStage({ kind: 'tracking' });
      } catch (error) {
        if (alive()) fail(error, at);
      } finally {
        // The re-encoded copy only existed to be uploaded.
        void discardTempFile(prepared);
      }
    },
    [dropBatch, fail],
  );

  const choose = async (source: AddSource) => {
    const picked = source === 'camera' ? await takePhoto() : await pickPhoto();
    if (picked === 'denied') {
      showToast(tr.wardrobeCameraDenied);
      return;
    }
    const chosen = Array.isArray(picked) ? picked[0] : picked;
    if (!chosen || !mounted.current) return;
    void discardTempFile(photoUri.current);
    photoUri.current = chosen.uri;
    setPhoto({ photo: chosen, source });
    void start(chosen, source);
  };

  /** "Tekrar dene" after a retryable failure: `process` again, no second upload (the server kept the photo). */
  const reprocess = async () => {
    const id = openBatch.current ?? batchId;
    if (!id || busy.current) return;
    busy.current = true;
    resultSent.current = false;
    startedAt.current = Date.now();
    setStage({ kind: 'uploading' });
    try {
      await processBulkBatch(id);
      if (!mounted.current) return;
      openBatch.current = id;
      cancelStage.current = 'Processing';
      // The old `Failed` answer must not show again: the status is asked afresh.
      queryClient.removeQueries({ queryKey: queryKeys.bulkBatch(id), exact: true });
      setTimedOut(false);
      setWaitedLong(false);
      setWaitRound((round) => round + 1);
      setStage({ kind: 'tracking' });
    } catch (error) {
      if (mounted.current) fail(error, 'process');
    } finally {
      busy.current = false;
    }
  };

  const keepWaiting = () => {
    resultSent.current = false;
    setTimedOut(false);
    setWaitedLong(false);
    setWaitRound((round) => round + 1);
    void batch.refetch();
  };

  const newPhoto = () => {
    dropBatch();
    setStage({ kind: 'capture' });
  };

  const onProblemAction = (problem: Problem, retry: 'upload' | 'process') => {
    if (problem.action === 'single') setSingleOpen(true);
    else if (problem.action === 'newPhoto') newPhoto();
    else if (retry === 'process') void reprocess();
    else if (photo) void start(photo.photo, photo.source);
  };

  const openPiece = useCallback((id: string) => setOpenPieceId(id), []);
  const changePiece = useCallback(
    (id: string, patch: Partial<PieceDraft>) =>
      setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } })),
    [],
  );

  const confirm = async () => {
    if (!data || busy.current) return;
    const entries = confirmEntries(data.pieces, drafts);
    if (entries.length === 0) return;
    busy.current = true;
    setConfirming(true);
    setConfirmError(null);
    try {
      const confirmed = await confirmBulkBatch(data.id, { pieces: entries });
      openBatch.current = null;
      cancelStage.current = null;
      track('bulk_add_confirm', {
        ...confirmStats(data.pieces, drafts),
        durationMs: Math.max(0, Date.now() - startedAt.current),
      });
      useBulkStore.getState().markAdviceSeen();
      // The answer is the confirmed batch (its items give the count); the wardrobe is still asked again so they show in Dolap.
      void invalidateWardrobe(queryClient);
      showToast(tr.bulkAdded(confirmed.items?.length ?? entries.length));
      close();
    } catch (error) {
      busy.current = false;
      if (!mounted.current) return;
      setConfirming(false);
      const problem = problemFromError(error, 'confirm');
      if (problem === 'disabled') closeDisabled();
      else if (problem.action === 'newPhoto') showProblem(problem, 'upload');
      else setConfirmError(problem.message);
    }
  };

  const gridGap = theme.spacing.lg;
  const tileWidth =
    (width - theme.screenPaddingX * 2 - gridGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const photoHeight = height * theme.sizes.bulkPhotoMaxRatio;

  const shownProblem: Problem | null =
    stage.kind === 'problem'
      ? stage.problem
      : tracking
        ? ((pollFailure === 'disabled' ? null : pollFailure) ??
          batchProblem ??
          (waiting && timedOut ? { message: tr.bulkTimeout, action: 'wait' } : null))
        : null;

  let body: ReactNode;
  let footer: ReactNode = null;

  if (stage.kind === 'capture') {
    body = (
      <ScrollView contentContainerStyle={styles.content} testID="bulk-capture">
        <Text style={styles.lead}>{tr.bulkLead}</Text>
        <AdviceDrawing />
        {adviceOpen ? (
          <View style={styles.advice} testID="bulk-advice">
            {tr.bulkAdvice.map((line, index) => (
              <View key={line} style={styles.adviceRow}>
                <View style={styles.adviceBadge}>
                  <Text style={styles.adviceNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.adviceText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Button
            label={tr.bulkAdviceShow}
            variant="quiet"
            onPress={() => setAdviceOpen(true)}
            testID="bulk-advice-show"
          />
        )}
      </ScrollView>
    );
    // On the web export there is no camera step: the library pick is the way in (review runs on web).
    footer =
      Platform.OS === 'web' ? (
        <Button
          label={tr.bulkLibrary}
          onPress={() => void choose('library')}
          testID="bulk-library"
        />
      ) : (
        <>
          <Button
            label={tr.bulkCamera}
            onPress={() => void choose('camera')}
            testID="bulk-camera"
          />
          <Button
            label={tr.bulkLibrary}
            variant="quiet"
            onPress={() => void choose('library')}
            testID="bulk-library"
          />
        </>
      );
  } else if (shownProblem) {
    const problem = shownProblem;
    const label = {
      newPhoto: tr.bulkNewPhoto,
      retry: tr.retry,
      single: tr.bulkSingleAdd,
      wait: tr.bulkKeepWaiting,
    }[problem.action];
    body = (
      <ScrollView contentContainerStyle={styles.content} testID="bulk-problem">
        {photo ? (
          <View style={[styles.photo, styles.photoSmall]}>
            <AppImage uri={photo.photo.uri} style={styles.fill} contentFit="contain" private />
          </View>
        ) : null}
        <LiveText style={styles.problemText} testID="bulk-problem-message">
          {problem.message}
        </LiveText>
      </ScrollView>
    );
    footer = (
      <Button
        label={label}
        onPress={() =>
          problem.action === 'wait'
            ? keepWaiting()
            : onProblemAction(problem, stage.kind === 'problem' ? stage.retry : 'process')
        }
        testID="bulk-problem-action"
      />
    );
  } else if (stage.kind === 'uploading' || waiting) {
    body = (
      <ScrollView contentContainerStyle={styles.content} testID="bulk-waiting">
        {photo ? (
          <View style={[styles.photo, { height: photoHeight }]}>
            <AppImage uri={photo.photo.uri} style={styles.fill} contentFit="contain" private />
            <Shimmer />
          </View>
        ) : null}
        <LiveText style={styles.waitingTitle} testID="bulk-waiting-status">
          {stage.kind === 'uploading' ? tr.bulkUploading : tr.bulkWaiting}
        </LiveText>
        {waitedLong ? <LiveText style={styles.muted}>{tr.bulkWaitingLong}</LiveText> : null}
        <Text style={styles.muted}>{tr.bulkWaitingLeave}</Text>
      </ScrollView>
    );
  } else if (data) {
    const pieces = data.pieces;
    const ticked = tickedCount(pieces, drafts);
    const notes = [data.unseparated?.message, data.cutOff?.message].filter((note): note is string =>
      Boolean(note),
    );
    body = (
      <ScrollView contentContainerStyle={styles.content} testID="bulk-review">
        {pieces.length > 0 ? (
          <Text style={styles.lead}>{tr.bulkReviewLead(pieces.length)}</Text>
        ) : notes.length === 0 ? (
          <LiveText style={styles.problemText}>{tr.bulkNothing}</LiveText>
        ) : null}
        {notes.length > 0 ? (
          <View style={styles.notes} testID="bulk-notes">
            {notes.map((note) => (
              <Text key={note} style={styles.noteText}>
                {note}
              </Text>
            ))}
            <Button
              label={tr.bulkSingleAdd}
              variant="quiet"
              onPress={() => setSingleOpen(true)}
              testID="bulk-single-add"
            />
          </View>
        ) : null}
        <View style={[styles.grid, { gap: gridGap }]}>
          {pieces.map((piece) => {
            const draft = drafts[piece.id];
            return draft ? (
              <BulkPieceTile
                key={piece.id}
                piece={piece}
                draft={draft}
                width={tileWidth}
                onChange={changePiece}
                onOpen={openPiece}
              />
            ) : null;
          })}
        </View>
      </ScrollView>
    );
    footer =
      pieces.length > 0 ? (
        <>
          {confirmError ? (
            <LiveText style={styles.error} testID="bulk-confirm-error">
              {confirmError}
            </LiveText>
          ) : null}
          <Button
            label={tr.bulkConfirm(ticked)}
            onPress={() => void confirm()}
            disabled={ticked === 0}
            loading={confirming}
            testID="bulk-confirm"
          />
        </>
      ) : (
        <Button label={tr.bulkNewPhoto} onPress={newPhoto} testID="bulk-problem-action" />
      );
  }

  const openPieceData = data?.pieces.find((piece) => piece.id === openPieceId) ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="close" label={tr.bulkClose} onPress={close} testID="bulk-close" />
        <Text accessibilityRole="header" style={styles.title} numberOfLines={lines(1)}>
          {tr.bulkTitle}
        </Text>
      </View>
      <View style={styles.body}>{body}</View>
      {footer ? (
        <View style={[styles.bar, { paddingBottom: theme.spacing.md + insets.bottom }]}>
          {footer}
        </View>
      ) : null}
      <PieceSheet
        piece={openPieceData}
        draft={openPieceData ? (drafts[openPieceData.id] ?? null) : null}
        onChange={changePiece}
        onClose={() => setOpenPieceId(null)}
      />
      {/* Mounted only when asked for: its catalog picker would otherwise ask for products on every bulk add. */}
      {singleOpen ? <AddItemSheet visible onClose={() => setSingleOpen(false)} /> : null}
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
  body: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  lead: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  advice: {
    gap: theme.spacing.md,
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  adviceBadge: {
    width: theme.sizes.statusBadge,
    height: theme.sizes.statusBadge,
    borderRadius: theme.sizes.statusBadge / 2,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceNumber: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  adviceText: {
    ...theme.typography.body,
    color: theme.colors.ink2,
    flex: 1,
  },
  photo: {
    width: '100%',
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  photoSmall: {
    height: theme.sizes.itemCutoutHeight,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  waitingTitle: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  problemText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  notes: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.sizes.dashedBorder,
    borderStyle: 'dashed',
    borderColor: theme.colors.chalkLine,
  },
  noteText: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bar: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
});

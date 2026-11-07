import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { Post } from '@/api/models';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { colorLabels } from '@/features/catalog/filters';
import { useCategoryName } from '@/features/wardrobe/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { stableImageUrl } from './imageUrl';
import { dotCenter, MAX_TAGS, pct } from './labels';
import {
  addDot,
  canPublish,
  chooseDot,
  moveDot,
  removeDot,
  unconfirmedCount,
  type DotChoice,
  type DraftDot,
} from './tagDraft';
import { TagPickerSheet, type PickKind } from './TagPickerSheet';

interface TagEditorProps {
  post: Pick<Post, 'id' | 'image' | 'kind'>;
  dots: readonly DraftDot[];
  onChange: (dots: DraftDot[]) => void;
  onNext: () => void;
}

const KINDS: readonly { kind: PickKind; label: string }[] = [
  { kind: 'Wardrobe', label: tr.tagKindWardrobe },
  { kind: 'Product', label: tr.tagKindProduct },
  { kind: 'Unknown', label: tr.tagKindUnknown },
];

/**
 * The tag editor: the dots the backend proposed (and any the author adds) over the photo, draggable and deletable.
 * Each one waits until the author says what it is; "Devam" stays off while any dot is unconfirmed, and the publish
 * step only ever sends confirmed dots (`toPublishTags`).
 */
export function TagEditor({ post, dots, onChange, onNext }: TagEditorProps) {
  const [picking, setPicking] = useState<{ dot: DraftDot; kind: PickKind } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const pending = unconfirmedCount(dots);
  const hasPhoto = post.image !== null;

  return (
    <View style={styles.root} testID="tag-editor">
      <Text style={styles.hint}>{hasPhoto ? tr.tagEditorHint : tr.tagEditorOutfitHint}</Text>

      {post.image ? (
        <DotPhoto
          postId={post.id}
          image={post.image}
          dots={dots}
          selected={selected}
          onSelect={setSelected}
          onMove={(key, center) => onChange(moveDot(dots, key, center))}
        />
      ) : null}

      <View style={styles.rows}>
        {dots.map((dot, index) => (
          <DotRow
            key={dot.key}
            dot={dot}
            index={index}
            selected={dot.key === selected}
            onPick={(kind) => {
              setSelected(dot.key);
              setPicking({ dot, kind });
            }}
            onConfirmSuggestion={() =>
              dot.suggestion && onChange(chooseDot(dots, dot.key, dot.suggestion))
            }
            onRemove={() => onChange(removeDot(dots, dot.key))}
          />
        ))}
      </View>

      {hasPhoto ? (
        <Button
          label={dots.length >= MAX_TAGS ? tr.tagEditorMax : tr.tagEditorAdd}
          variant="secondary"
          disabled={dots.length >= MAX_TAGS}
          onPress={() => onChange(addDot(dots))}
          testID="tag-add"
        />
      ) : null}

      {pending > 0 ? (
        <Text style={styles.pending} testID="tag-pending">
          {tr.tagEditorPending(pending)}
        </Text>
      ) : null}
      <Button
        label={tr.tagEditorNext}
        onPress={onNext}
        disabled={!canPublish(dots)}
        testID="tag-next"
      />

      <TagPickerSheet
        target={picking}
        onClose={() => setPicking(null)}
        onChoose={(key: string, choice: DotChoice) => {
          onChange(chooseDot(dots, key, choice));
          setPicking(null);
        }}
      />
    </View>
  );
}

interface DotPhotoProps {
  postId: string;
  image: NonNullable<Post['image']>;
  dots: readonly DraftDot[];
  selected: string | null;
  onSelect: (key: string) => void;
  onMove: (key: string, center: { left: number; top: number }) => void;
}

function DotPhoto({ postId, image, dots, selected, onSelect, onMove }: DotPhotoProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const aspect = image.aspect ? toNumber(image.aspect) : 4 / 5;
  const onLayout = (event: LayoutChangeEvent) => setSize(event.nativeEvent.layout);

  return (
    <View style={[styles.photo, { aspectRatio: aspect }]} onLayout={onLayout} testID="tag-photo">
      <Image
        source={{ uri: stableImageUrl(postId, image.url) }}
        style={styles.fill}
        resizeMode="cover"
      />
      {dots.map((dot, index) => (
        <DraggableDot
          key={dot.key}
          dot={dot}
          index={index}
          width={size.width}
          height={size.height}
          selected={dot.key === selected}
          onSelect={onSelect}
          onMove={onMove}
        />
      ))}
    </View>
  );
}

interface DraggableDotProps {
  dot: DraftDot;
  index: number;
  width: number;
  height: number;
  selected: boolean;
  onSelect: (key: string) => void;
  onMove: (key: string, center: { left: number; top: number }) => void;
}

/** Dragging moves the dot's centre; a dot that has not been confirmed has a dashed ring. Needs a device to check. */
function DraggableDot({
  dot,
  index,
  width,
  height,
  selected,
  onSelect,
  onMove,
}: DraggableDotProps) {
  const center = dotCenter(dot);
  // The responder is made once per dot; what changes between renders is read from this ref, inside its callbacks only.
  const live = useRef({ center, width, height, onMove, onSelect });
  useEffect(() => {
    live.current = { center, width, height, onMove, onSelect };
  });
  const origin = useRef(center);

  const pan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- the refs are only read when a gesture event arrives
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          origin.current = live.current.center;
          live.current.onSelect(dot.key);
        },
        onPanResponderMove: (_event, gesture) => {
          const { width: w, height: h } = live.current;
          if (w > 0 && h > 0) {
            live.current.onMove(dot.key, {
              left: origin.current.left + gesture.dx / w,
              top: origin.current.top + gesture.dy / h,
            });
          }
        },
      }),
    [dot.key],
  );

  const half = theme.sizes.tagDot / 2;
  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel={tr.tagEditorDot(index + 1)}
      testID={`edit-dot-${dot.key}`}
      style={[
        styles.dot,
        {
          left: pct(center.left),
          top: pct(center.top),
          marginLeft: -half,
          marginTop: -half,
        },
        dot.choice === null && styles.dotPending,
        selected && styles.dotSelected,
      ]}
    >
      <Text style={styles.dotNumber}>{index + 1}</Text>
    </View>
  );
}

interface DotRowProps {
  dot: DraftDot;
  index: number;
  selected: boolean;
  onPick: (kind: PickKind) => void;
  onConfirmSuggestion: () => void;
  onRemove: () => void;
}

function DotRow({ dot, index, selected, onPick, onConfirmSuggestion, onRemove }: DotRowProps) {
  const category = useCategoryName(dot.categorySlug);
  const description = [category, dot.color ? colorLabels[dot.color] : null]
    .filter(Boolean)
    .join(' · ');
  const choice = dot.choice;

  return (
    <View
      style={[styles.row, selected && styles.rowSelected]}
      testID={`dot-row-${index}`}
      accessibilityState={{ selected }}
    >
      <View style={styles.rowHead}>
        <View style={[styles.badge, choice === null && styles.badgePending]}>
          {choice === null ? (
            <Text style={styles.badgeText}>{index + 1}</Text>
          ) : (
            <Icon name="check" size={14} color={theme.colors.onInk} />
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {description || tr.tagEditorDot(index + 1)}
          </Text>
          <Text style={choice === null ? styles.rowPending : styles.rowChosen} numberOfLines={1}>
            {choice === null
              ? tr.tagEditorUnconfirmed
              : choice.kind === 'Unknown'
                ? choice.label || tr.tagKindUnknown
                : choice.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.tagEditorRemove}
          onPress={onRemove}
          style={styles.remove}
          testID={`dot-remove-${index}`}
        >
          <Icon name="trash" size={20} />
        </Pressable>
      </View>
      <View style={styles.kinds}>
        {KINDS.map(({ kind, label }) => (
          <Chip
            key={kind}
            label={label}
            selected={choice?.kind === kind}
            onPress={() => onPick(kind)}
            testID={`dot-${index}-${kind}`}
          />
        ))}
        {choice === null && dot.suggestion ? (
          <Chip
            label={tr.tagEditorConfirmSuggestion}
            onPress={onConfirmSuggestion}
            testID={`dot-${index}-suggestion`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.lg,
  },
  hint: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  photo: {
    width: '100%',
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  dot: {
    position: 'absolute',
    width: theme.sizes.tagDot,
    height: theme.sizes.tagDot,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPending: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.ink,
    borderStyle: 'dashed',
  },
  dotSelected: {
    borderColor: theme.colors.accent,
  },
  dotNumber: {
    ...theme.typography.overline,
    color: theme.colors.inkSoft,
  },
  rows: {
    gap: theme.spacing.md,
  },
  row: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowSelected: {
    borderColor: theme.colors.ink,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  badge: {
    width: theme.sizes.statusBadge,
    height: theme.sizes.statusBadge,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePending: {
    backgroundColor: theme.colors.surfaceAlt2,
  },
  badgeText: {
    ...theme.typography.overline,
    color: theme.colors.inkSoft,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  rowPending: {
    ...theme.typography.caption,
    color: theme.colors.warning,
  },
  rowChosen: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  remove: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pending: {
    ...theme.typography.captionMedium,
    color: theme.colors.warning,
    textAlign: 'center',
  },
});

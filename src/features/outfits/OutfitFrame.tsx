import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { IconButton } from '@/components/IconButton';

interface OutfitFrameProps {
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  /** Header buttons on the right (shuffle, previous). */
  right?: ReactNode;
  /** Chips or other controls under the header. */
  controls?: ReactNode;
  /** The white panel pinned to the bottom. */
  sheet?: ReactNode;
  children: ReactNode;
}

/** The look shared by daily, how-to-wear and saved outfits (design screen 05): warm ground, header, grid, white sheet. */
export function OutfitFrame({
  title,
  subtitle,
  onClose,
  right,
  controls,
  sheet,
  children,
}: OutfitFrameProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <IconButton icon="close" label={tr.outfitClose} onPress={onClose} testID="outfit-close" />
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1} testID="outfit-title">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1} testID="outfit-subtitle">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
      {controls}
      <View style={styles.body}>{children}</View>
      {sheet}
    </SafeAreaView>
  );
}

/** The small muted line under the grid: a green dot and the narration. */
export function NarrationRow({ text }: { text: string }) {
  return (
    <View style={styles.narration} testID="outfit-narration">
      <View style={styles.dot} />
      <Text style={styles.narrationText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  right: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    // Keeps the title centred while the close button on the left is one button wide.
    minWidth: theme.sizes.outfitHeaderButton,
    gap: theme.spacing.sm,
  },
  body: {
    flex: 1,
  },
  narration: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  dot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    marginTop: theme.spacing.xs + 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  narrationText: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    flexShrink: 1,
  },
});

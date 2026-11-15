import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

interface TripHeaderProps {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  /** What the back arrow does, when it is not leaving the screen ("Düzenle" semantics are the arrow itself). */
  backLabel?: string;
  right?: ReactNode;
}

/** Back arrow, title and an optional right-hand action; the trip screens' only chrome. */
export function TripHeader({ title, subtitle, onBack, backLabel, right }: TripHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton
        icon="arrowLeft"
        label={backLabel ?? tr.back}
        onPress={onBack}
        testID="trip-back"
      />
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header" testID="trip-title">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} testID="trip-subtitle">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 2,
  },
  title: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: theme.sizes.touch,
  },
});

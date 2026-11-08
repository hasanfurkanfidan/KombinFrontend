import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/** The camera button in the Keşfet header, before the bell. */
export function LensHeaderButton() {
  const router = useRouter();
  return (
    <IconButton
      icon="camera"
      label={tr.lensTitle}
      tone="tinted"
      onPress={() => router.push('/lens?entry=explore')}
      testID="lens-header-button"
    />
  );
}

/** The small tile under the daily card on Keşfet. */
export function LensEntryTile() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/lens?entry=home')}
      style={styles.tile}
      testID="lens-tile"
    >
      <View style={styles.icon}>
        <Icon name="camera" size={22} />
      </View>
      <Text style={styles.text}>{tr.lensTile}</Text>
      <Icon name="chevronRight" size={20} color={theme.colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginHorizontal: theme.screenPaddingX,
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  icon: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    flex: 1,
  },
});

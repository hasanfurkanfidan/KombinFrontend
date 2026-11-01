import { Pressable, StyleSheet } from 'react-native';

import { theme } from '@/theme';

import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  /** Spoken label; icon-only controls need one. */
  label: string;
  onPress?: () => void;
  /** `plain` is white (used over images), `tinted` uses the card background. */
  tone?: 'plain' | 'tinted';
  /** Fills the icon (e.g. a bell that already has an alert). */
  filled?: boolean;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  filled = false,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        tone === 'plain' ? styles.plain : styles.tinted,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={22} filled={filled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    backgroundColor: theme.colors.surface,
  },
  tinted: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  pressed: {
    opacity: 0.7,
  },
});

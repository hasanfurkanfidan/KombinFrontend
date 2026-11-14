import { StyleSheet } from 'react-native';

import { theme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

interface IconButtonProps {
  icon: IconName;
  /** Spoken label; icon-only controls need one. */
  label: string;
  onPress?: () => void;
  /** `surface` sits on the page (the default); `onImage` is white, for a button drawn over a photo. */
  tone?: 'surface' | 'onImage';
  /** Fills the icon (e.g. a bell that already has an alert). */
  filled?: boolean;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'surface',
  filled = false,
  testID,
}: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={[styles.base, tone === 'surface' ? styles.surface : styles.onImage]}
    >
      <Icon name={icon} size={22} filled={filled} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    borderRadius: theme.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: {
    backgroundColor: theme.colors.surface,
  },
  onImage: {
    backgroundColor: theme.colors.bg,
  },
});

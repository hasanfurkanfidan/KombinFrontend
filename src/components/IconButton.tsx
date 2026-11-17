import { StyleSheet } from 'react-native';

import { theme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

interface IconButtonProps {
  icon: IconName;
  /** Spoken label; icon-only controls need one. */
  label: string;
  onPress?: () => void;
  /**
   * `surface` sits on the page (the default); `onImage` is white, for a button drawn over a photo; `arena` is the
   * raised green of the league's dark zone with a white icon.
   */
  tone?: 'surface' | 'onImage' | 'arena';
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
      style={[styles.base, styles[tone]]}
    >
      <Icon
        name={icon}
        size={22}
        filled={filled}
        color={tone === 'arena' ? theme.arena.text : undefined}
      />
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
  arena: {
    backgroundColor: theme.arena.raised,
  },
});

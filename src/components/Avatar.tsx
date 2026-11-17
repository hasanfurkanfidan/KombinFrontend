import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './Icon';

interface AvatarProps {
  name: string;
  /** `md` is the post author's avatar, `lg` the one on Profil and the user/creator pages. */
  size?: 'md' | 'lg';
  testID?: string;
}

/** The first letter of a name; an empty name has none. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('tr-TR');
}

/** The one avatar: the person's initial on a `surface` circle (a person icon when there is no name). */
export function Avatar({ name, size = 'md', testID }: AvatarProps) {
  const diameter = size === 'lg' ? theme.sizes.avatar : theme.sizes.postAvatar;
  const initial = initialOf(name);

  return (
    <View
      testID={testID}
      // The name always sits beside an avatar: the initial would be read as a stray letter.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}
    >
      {initial ? (
        <Text style={size === 'lg' ? styles.initialLarge : styles.initial}>{initial}</Text>
      ) : (
        <Icon name="user" size={diameter / 2} color={theme.colors.ink2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  initialLarge: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
});

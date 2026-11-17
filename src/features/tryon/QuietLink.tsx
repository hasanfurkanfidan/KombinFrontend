import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/theme';

/** A text-only action in the link colour: "Manken üstünde gör" in a sheet header, "Yanlış görünüyor", "Ölçüleri güncelle". */
export function QuietLink({
  label,
  onPress,
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, style]}
      testID={testID}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  label: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
  },
});

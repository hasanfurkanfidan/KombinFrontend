import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { useSavedToggle } from './hooks';

interface SaveButtonProps {
  productId: string;
  /** `card`: 32 px round white button over a product image. `bar`: the outlined square in the detail bar. */
  variant: 'card' | 'bar';
  style?: StyleProp<ViewStyle>;
}

/** The bookmark: toggles `PUT/DELETE /me/saved/{id}` optimistically, or opens login when logged out. */
export function SaveButton({ productId, variant, style }: SaveButtonProps) {
  const { saved, toggle } = useSavedToggle(productId);
  const card = variant === 'card';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? tr.saveRemove : tr.saveAdd}
      accessibilityState={{ selected: saved }}
      onPress={toggle}
      hitSlop={card ? theme.spacing.sm : undefined}
      style={[card ? styles.card : styles.bar, style]}
      testID={`save-${productId}-${variant}`}
    >
      <Icon name="bookmark" size={card ? 16 : 22} filled={saved} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: theme.sizes.bookmarkButton,
    height: theme.sizes.bookmarkButton,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: theme.sizes.buttonHeight,
    height: theme.sizes.buttonHeight,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

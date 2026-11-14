import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/** Longest term the field takes; the `search` event allows up to 200. */
export const SEARCH_MAX_LENGTH = 100;

/**
 * Keşfet's search field. It only looks like a field: a tap opens `/search`, where the real input is. The camera
 * inside it on the right is Keşfet's one way into "Görselden bul".
 */
export function SearchEntry() {
  const router = useRouter();
  return (
    <View style={[styles.field, styles.entry]}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={tr.searchPlaceholder}
        onPress={() => router.push('/search')}
        style={styles.entryPress}
        testID="search-entry"
      >
        <Icon name="search" size={20} color={theme.colors.muted} />
        <Text style={styles.placeholder} numberOfLines={1}>
          {tr.searchPlaceholder}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.lensTitle}
        onPress={() => router.push('/lens?entry=explore')}
        style={styles.trailing}
        testID="search-camera"
      >
        <Icon name="camera" size={22} />
      </Pressable>
    </View>
  );
}

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

/** The search screen's input: focused on open, a search key on the keyboard, ✕ while there is text. */
export function SearchInput({ value, onChangeText, onSubmit, onClear }: SearchInputProps) {
  return (
    <View style={[styles.field, styles.input]}>
      <Icon name="search" size={20} color={theme.colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={tr.searchPlaceholder}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={tr.searchPlaceholder}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxLength={SEARCH_MAX_LENGTH}
        style={styles.text}
        testID="search-input"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.searchClearText}
          onPress={onClear}
          style={styles.trailing}
          testID="search-clear"
        >
          <Icon name="close" size={18} color={theme.colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: theme.sizes.fieldHeight,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  entry: {
    marginHorizontal: theme.screenPaddingX,
  },
  entryPress: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
  },
  input: {
    flex: 1,
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
  },
  placeholder: {
    ...theme.typography.body,
    color: theme.colors.muted,
    flex: 1,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.ink,
    flex: 1,
    alignSelf: 'stretch',
  },
  trailing: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    marginRight: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

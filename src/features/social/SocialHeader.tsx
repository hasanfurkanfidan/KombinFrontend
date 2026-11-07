import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

interface SocialHeaderProps {
  title: string;
  /** Where "back" goes when there is no history (a link opened cold). */
  fallback?: string;
  testID?: string;
}

/** Back button and title row of the social screens (a post, a person, a creator, "Gönderilerim", …). */
export function SocialHeader({ title, fallback = '/', testID }: SocialHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconButton
        icon="arrowLeft"
        label={tr.back}
        tone="tinted"
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
        testID={testID ?? 'social-back'}
      />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    flex: 1,
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
});

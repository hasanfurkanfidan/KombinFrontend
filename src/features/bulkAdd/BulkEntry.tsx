import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { PressableScale } from '@/components/PressableScale';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { useBulkAvailable } from './hooks';

/**
 * "Toplu ekle" beside Dolap's green "Parça ekle": outlined, because the screen keeps one filled action. Absent (no
 * entry, no error, no space) unless the server has bulk add switched on.
 */
export function BulkEntry() {
  const router = useRouter();
  const available = useBulkAvailable();
  if (!available) {
    return null;
  }
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={() => router.push('/wardrobe/bulk')}
      style={styles.button}
      testID="wardrobe-bulk-add"
    >
      <Text style={styles.label}>{tr.bulkEntry}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
});

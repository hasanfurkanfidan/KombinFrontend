import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/** Dolap's way into "Valiz hazırla": a quiet link under the summary, so "Parça ekle" stays the one filled action. */
export function TripEntry() {
  const router = useRouter();
  return (
    <Button
      label={tr.tripEntry}
      variant="quiet"
      trailingIcon="arrowRight"
      onPress={() => router.push('/trips')}
      style={styles.link}
      testID="trip-entry"
    />
  );
}

const styles = StyleSheet.create({
  // The quiet button pads its text by `sm`; pull it back so the text lines up with the summary above.
  link: {
    alignSelf: 'flex-start',
    marginLeft: -theme.spacing.sm,
  },
});

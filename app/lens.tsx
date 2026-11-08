import { useLocalSearchParams } from 'expo-router';

import { LensScreen } from '@/features/lens/LensScreen';

export default function LensRoute() {
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  return <LensScreen entry={entry} />;
}

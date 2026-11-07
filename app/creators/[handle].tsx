import { useLocalSearchParams } from 'expo-router';

import { CreatorScreen } from '@/features/social/ProfileScreens';

export default function CreatorRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <CreatorScreen handle={handle} />;
}

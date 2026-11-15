import { Redirect, useLocalSearchParams } from 'expo-router';

import { CreatorScreen } from '@/features/social/ProfileScreens';
import { handleParam } from '@/utils/routeParams';

export default function CreatorRoute() {
  const handle = handleParam(useLocalSearchParams<{ handle: string }>().handle);
  return handle ? <CreatorScreen handle={handle} /> : <Redirect href="/" />;
}

import { Redirect, useLocalSearchParams } from 'expo-router';

import { UserProfileScreen } from '@/features/social/ProfileScreens';
import { uuidParam } from '@/utils/routeParams';

export default function UserRoute() {
  const id = uuidParam(useLocalSearchParams<{ id: string }>().id);
  return id ? <UserProfileScreen id={id} /> : <Redirect href="/" />;
}

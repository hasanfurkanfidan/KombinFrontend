import { useLocalSearchParams } from 'expo-router';

import { UserProfileScreen } from '@/features/social/ProfileScreens';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserProfileScreen id={id} />;
}

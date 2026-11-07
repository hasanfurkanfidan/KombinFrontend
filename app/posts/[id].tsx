import { useLocalSearchParams } from 'expo-router';

import { PostScreen } from '@/features/social/PostScreen';

export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostScreen id={id} />;
}

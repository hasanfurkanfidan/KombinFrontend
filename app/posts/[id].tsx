import { Redirect, useLocalSearchParams } from 'expo-router';

import { PostScreen } from '@/features/social/PostScreen';
import { uuidParam } from '@/utils/routeParams';

export default function PostRoute() {
  const id = uuidParam(useLocalSearchParams<{ id: string }>().id);
  return id ? <PostScreen id={id} /> : <Redirect href="/" />;
}

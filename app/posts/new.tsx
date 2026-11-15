import { useLocalSearchParams } from 'expo-router';

import { CreatePostScreen } from '@/features/social/CreatePostScreen';
import { uuidParam } from '@/utils/routeParams';

export default function NewPostRoute() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  return <CreatePostScreen resumePostId={uuidParam(postId) ?? undefined} />;
}

import { useLocalSearchParams } from 'expo-router';

import { CreatePostScreen } from '@/features/social/CreatePostScreen';

export default function NewPostRoute() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  return <CreatePostScreen resumePostId={postId} />;
}

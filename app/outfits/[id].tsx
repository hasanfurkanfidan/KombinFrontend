import { useLocalSearchParams } from 'expo-router';

import { OutfitDetailScreen } from '@/features/outfits/OutfitDetailScreen';

export default function OutfitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OutfitDetailScreen id={id} />;
}

import { useLocalSearchParams } from 'expo-router';

import { WardrobeItemScreen } from '@/features/wardrobe/WardrobeItemScreen';

export default function WardrobeItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WardrobeItemScreen id={id} />;
}

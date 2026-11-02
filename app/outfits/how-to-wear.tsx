import { useLocalSearchParams } from 'expo-router';

import { HowToWearScreen } from '@/features/outfits/HowToWearScreen';

export default function HowToWearRoute() {
  const { productId, wardrobeItemId } = useLocalSearchParams<{
    productId?: string;
    wardrobeItemId?: string;
  }>();
  return <HowToWearScreen productId={productId} wardrobeItemId={wardrobeItemId} />;
}

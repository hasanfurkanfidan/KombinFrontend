import { useLocalSearchParams } from 'expo-router';

import { HowToWearScreen } from '@/features/outfits/HowToWearScreen';
import { uuidParam } from '@/utils/routeParams';

export default function HowToWearRoute() {
  const { productId, wardrobeItemId } = useLocalSearchParams<{
    productId?: string;
    wardrobeItemId?: string;
  }>();
  return (
    <HowToWearScreen
      productId={uuidParam(productId) ?? undefined}
      wardrobeItemId={uuidParam(wardrobeItemId) ?? undefined}
    />
  );
}

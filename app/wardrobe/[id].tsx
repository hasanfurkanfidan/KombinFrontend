import { Redirect, useLocalSearchParams } from 'expo-router';

import { WardrobeItemScreen } from '@/features/wardrobe/WardrobeItemScreen';
import { uuidParam } from '@/utils/routeParams';

export default function WardrobeItemRoute() {
  const id = uuidParam(useLocalSearchParams<{ id: string }>().id);
  return id ? <WardrobeItemScreen id={id} /> : <Redirect href="/" />;
}

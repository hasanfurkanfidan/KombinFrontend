import { Redirect, useLocalSearchParams } from 'expo-router';

import { OutfitDetailScreen } from '@/features/outfits/OutfitDetailScreen';
import { uuidParam } from '@/utils/routeParams';

export default function OutfitRoute() {
  const id = uuidParam(useLocalSearchParams<{ id: string }>().id);
  return id ? <OutfitDetailScreen id={id} /> : <Redirect href="/" />;
}

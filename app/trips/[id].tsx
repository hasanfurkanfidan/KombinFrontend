import { Redirect, useLocalSearchParams } from 'expo-router';

import { SavedTripScreen } from '@/features/trips/SavedTripScreen';
import { uuidParam } from '@/utils/routeParams';

export default function TripRoute() {
  const id = uuidParam(useLocalSearchParams<{ id: string }>().id);
  return id ? <SavedTripScreen id={id} /> : <Redirect href="/" />;
}

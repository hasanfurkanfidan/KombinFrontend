import { Redirect } from 'expo-router';

/** The price tab was called "Takip" before 15b; an old link lands on "Fiyatlar". */
export default function TrackingRoute() {
  return <Redirect href="/prices" />;
}

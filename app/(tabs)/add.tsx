import { Redirect } from 'expo-router';

/** The old raised "+" route (removed in 15b): an old link still lands on the daily outfit. */
export default function AddRoute() {
  return <Redirect href="/outfits/daily" />;
}

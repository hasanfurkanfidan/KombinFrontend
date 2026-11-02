import { Redirect } from 'expo-router';

/** The raised "+" is not a screen: a press opens the daily outfit (see the tab listener). This is only a deep-link fallback. */
export default function AddRoute() {
  return <Redirect href="/outfits/daily" />;
}

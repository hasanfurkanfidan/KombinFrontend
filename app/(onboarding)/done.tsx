import { Redirect } from 'expo-router';

/** The summary step was removed in 15b (onboarding lands on Keşfet); an old link still gets there. */
export default function DoneRoute() {
  return <Redirect href="/" />;
}

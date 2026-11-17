import { useLocalSearchParams } from 'expo-router';

import { ResultsScreen } from '@/features/league/ResultsScreen';
import { parseResultsDay } from '@/features/league/labels';

/** `?day=yyyy-MM-dd` comes from a link (a push): only a real date is used, anything else shows the latest result. */
export default function ResultsRoute() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  return <ResultsScreen day={parseResultsDay(day)} />;
}

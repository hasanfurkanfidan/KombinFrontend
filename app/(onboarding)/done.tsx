import { useLocalSearchParams } from 'expo-router';

import { DoneScreen } from '@/features/onboarding/DoneScreen';

export default function DoneRoute() {
  const { personaId } = useLocalSearchParams<{ personaId: string }>();
  return <DoneScreen personaId={personaId} />;
}

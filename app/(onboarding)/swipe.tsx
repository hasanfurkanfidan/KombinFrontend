import { useLocalSearchParams } from 'expo-router';

import { parseFlow } from '@/features/onboarding/flow';
import { SwipeScreen } from '@/features/onboarding/SwipeScreen';

export default function SwipeRoute() {
  const { personaId, flow, returnTo } = useLocalSearchParams<{
    personaId: string;
    flow?: string;
    returnTo?: string;
  }>();
  return <SwipeScreen personaId={personaId} flow={parseFlow(flow)} returnTo={returnTo} />;
}

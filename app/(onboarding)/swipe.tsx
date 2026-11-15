import { Redirect, useLocalSearchParams } from 'expo-router';

import { parseFlow } from '@/features/onboarding/flow';
import { SwipeScreen } from '@/features/onboarding/SwipeScreen';
import { inAppPath, uuidParam } from '@/utils/routeParams';

export default function SwipeRoute() {
  const params = useLocalSearchParams<{
    personaId: string;
    flow?: string;
    returnTo?: string;
  }>();
  const personaId = uuidParam(params.personaId);
  return personaId ? (
    <SwipeScreen
      personaId={personaId}
      flow={parseFlow(params.flow)}
      returnTo={inAppPath(params.returnTo)}
    />
  ) : (
    <Redirect href="/" />
  );
}

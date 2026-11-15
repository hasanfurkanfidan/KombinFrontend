import { useLocalSearchParams } from 'expo-router';

import { parseFlow } from '@/features/onboarding/flow';
import { PersonaNameScreen } from '@/features/onboarding/PersonaNameScreen';
import { inAppPath } from '@/utils/routeParams';

export default function PersonaRoute() {
  const { flow, returnTo } = useLocalSearchParams<{ flow?: string; returnTo?: string }>();
  return <PersonaNameScreen flow={parseFlow(flow)} returnTo={inAppPath(returnTo)} />;
}

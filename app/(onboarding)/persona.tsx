import { useLocalSearchParams } from 'expo-router';

import { parseFlow } from '@/features/onboarding/flow';
import { PersonaNameScreen } from '@/features/onboarding/PersonaNameScreen';

export default function PersonaRoute() {
  const { flow, returnTo } = useLocalSearchParams<{ flow?: string; returnTo?: string }>();
  return <PersonaNameScreen flow={parseFlow(flow)} returnTo={returnTo} />;
}

import { Stack } from 'expo-router';

import { AppProviders } from '@/components/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile/sizes" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="(onboarding)"
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
      </Stack>
    </AppProviders>
  );
}

import { Stack } from 'expo-router';

import { AppProviders } from '@/components/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
      </Stack>
    </AppProviders>
  );
}

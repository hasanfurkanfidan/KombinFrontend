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
        <Stack.Screen name="wardrobe/[id]" />
        <Stack.Screen name="outfits/daily" />
        <Stack.Screen name="outfits/how-to-wear" />
        <Stack.Screen name="outfits/saved" />
        <Stack.Screen name="outfits/[id]" />
        <Stack.Screen name="posts/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="posts/mine" />
        <Stack.Screen name="posts/[id]" />
        <Stack.Screen name="users/[id]" />
        <Stack.Screen name="creators/[handle]" />
        <Stack.Screen name="profile/creator" />
        <Stack.Screen name="profile/blocks" />
        <Stack.Screen name="lens" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="(onboarding)"
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
      </Stack>
    </AppProviders>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/api/queryClient';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { useSessionStore } from '@/session/sessionStore';
import { useBootstrapSession } from '@/session/useSession';

import { ToastHost } from './ToastHost';

// Keep the native splash up until fonts and the session are ready, so a logged-in user never sees the login screen.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Sends the user to the login screen when a signed-in session is lost (refresh token rejected). */
function SessionExpiryRedirect() {
  const router = useRouter();
  const endReason = useSessionStore((state) => state.endReason);
  const clearEndReason = useSessionStore((state) => state.clearEndReason);

  useEffect(() => {
    if (endReason === 'expired') {
      clearEndReason();
      router.push('/login');
    }
  }, [endReason, clearEndReason, router]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const sessionReady = useBootstrapSession();
  // A font failure falls back to system fonts rather than blocking the app.
  const ready = (fontsLoaded || fontError !== null) && sessionReady;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <SessionExpiryRedirect />
        <OnboardingGate />
        {children}
        <ToastHost />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

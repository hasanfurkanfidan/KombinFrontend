import { useEffect, type ReactNode } from 'react';
// One subpath per weight: the package root requires all 18 faces, which would all land in the bundle.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnalyticsTracker } from '@/analytics/AnalyticsTracker';
import { queryClient } from '@/api/queryClient';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { NotificationHandler, PushRegistration } from '@/push/PushLifecycle';
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
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    // The package ships the normal width only; these two are static instances of Google Fonts' variable Archivo
    // (wdth 87.5 and 75, wght 700), bundled under assets/fonts and loaded at runtime (no native build needed).
    ArchivoSemiCondensed_700Bold: require('../../assets/fonts/Archivo_SemiCondensed-Bold.ttf'),
    ArchivoCondensed_700Bold: require('../../assets/fonts/Archivo_Condensed-Bold.ttf'),
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
        <AnalyticsTracker />
        <PushRegistration />
        <NotificationHandler />
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

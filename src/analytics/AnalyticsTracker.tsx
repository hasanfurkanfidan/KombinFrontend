import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';

import { flushAnalytics, track } from './index';
import { screenName } from './screenName';

/**
 * Emits the lifecycle events: `app_open` (cold start and every return from the background), `app_background` (which
 * also flushes the queue) and `screen_view` for every route change. Renders nothing.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastScreen = useRef<string | null>(null);

  useEffect(() => {
    const screen = screenName(pathname);
    if (screen !== lastScreen.current) {
      lastScreen.current = screen;
      track('screen_view', { screen });
    }
  }, [pathname]);

  useEffect(() => {
    track('app_open', {});
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background' && previous !== 'background') {
        track('app_background', {});
        void flushAnalytics();
      } else if (next === 'active' && previous === 'background') {
        track('app_open', {});
      }
      previous = next;
    });
    return () => subscription.remove();
  }, []);

  return null;
}

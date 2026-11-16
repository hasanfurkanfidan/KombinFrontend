import { useEffect, useState } from 'react';
import { AccessibilityInfo, Dimensions, Platform } from 'react-native';

/** From this text scale on, lines that were capped may grow, so a name or a price is never cut. */
export const LARGE_TEXT_SCALE = 1.3;

/** The OS text scale (Settings > Display > Font size), as the layout sees it right now. */
export function currentFontScale(): number {
  return Dimensions.get('window').fontScale;
}

/**
 * `numberOfLines` that gives way to large text: the cap holds at the default size (the layouts are drawn for it) and
 * is lifted from scale 1.3, where an ellipsis would hide the one word that says what a thing is.
 */
export function lines(count: number): number | undefined {
  return currentFontScale() >= LARGE_TEXT_SCALE ? undefined : count;
}

const REPEAT_WINDOW_MS = 1500;
let lastMessage = '';
let lastAt = 0;

/**
 * Speaks a message through the screen reader without moving focus. `ios` limits it to iOS, for text that already
 * sits in an `accessibilityLiveRegion` (which only Android honours): both platforms then say it exactly once. The same
 * message within 1.5 s is spoken once (several skeletons mount together).
 */
export function announce(message: string, platforms: 'all' | 'ios' = 'all'): void {
  if (!message || (platforms === 'ios' && Platform.OS !== 'ios')) {
    return;
  }
  const now = Date.now();
  if (message === lastMessage && now - lastAt < REPEAT_WINDOW_MS) {
    return;
  }
  lastMessage = message;
  lastAt = now;
  AccessibilityInfo.announceForAccessibility(message);
}

/** Forgets the last announcement (tests). */
export function resetAnnouncements(): void {
  lastMessage = '';
  lastAt = 0;
}

/** Whether TalkBack or VoiceOver is running. `false` until the OS has answered. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (active && value) {
        setEnabled(true);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

/**
 * How long something that leaves on a timer stays: as is for most people, twice as long at large text, four times as
 * long with a screen reader (it reads the message first, and moves to the action afterwards).
 */
export function readingTime(baseMs: number, screenReader: boolean, fontScale: number): number {
  if (screenReader) {
    return baseMs * 4;
  }
  return fontScale >= LARGE_TEXT_SCALE ? baseMs * 2 : baseMs;
}

/** `readingTime` for the current OS settings. */
export function useReadingTime(baseMs: number): number {
  const screenReader = useScreenReaderEnabled();
  return readingTime(baseMs, screenReader, currentFontScale());
}

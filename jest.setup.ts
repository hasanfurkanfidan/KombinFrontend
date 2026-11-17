// Gesture handler's own mocks for its native module and components.
import 'react-native-gesture-handler/jestSetup';

import { installLeakGuard } from './__tests__/support/leakGuard';

// In-memory stand-in for the OS keystore.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

// "Manken üstünde gör" asks the backend once an outfit sheet has stood still; unless a test gives it an answer, the backend
// says `Unavailable` and the action stays hidden (the tryon tests set their own answers).
jest.mock('@/api/endpoints/tryon', () => ({
  getTryOn: jest.fn(async () => ({
    status: 'Unavailable',
    imageUrl: null,
    garments: [],
    defaultedMeasurements: [],
    reason: 'RendererRefused',
  })),
  reportTryOn: jest.fn(async () => undefined),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    dismissTo: jest.fn(),
    setParams: jest.fn(),
    navigate: jest.fn(),
  };
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Redirect: () => null,
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => '/'),
    // Runs the effect once on mount, like a screen that is focused from the start.
    useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, []),
  };
});

// Native camera/photo picker and image re-encoder: tests drive the add flow through its own seams instead.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  manipulateAsync: jest.fn(async (uri: string) => ({ uri: `${uri}#resized`, width: 1, height: 1 })),
}));

// Native file access for the photo upload: tests give `getInfoAsync`/`uploadAsync` their own answers. The document
// folder is an in-memory map (the remembered worn outfit is the one thing the app writes there).
jest.mock('expo-file-system/legacy', () => {
  const files = new Map<string, string>();
  return {
    FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
    cacheDirectory: 'file:///cache/',
    documentDirectory: 'file:///documents/',
    readAsStringAsync: jest.fn(async (uri: string) => {
      const content = files.get(uri);
      if (content === undefined) {
        throw new Error(`File ${uri} could not be read`);
      }
      return content;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      files.set(uri, content);
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      files.delete(uri);
    }),
    getInfoAsync: jest.fn(async (uri: string) => ({
      exists: true,
      uri,
      size: 321_000,
      isDirectory: false,
      modificationTime: 0,
    })),
    uploadAsync: jest.fn(async () => ({ status: 200, headers: {}, mimeType: null, body: '' })),
  };
});

// The new file API: the Lens upload appends a `File` (a Blob that `expo/fetch` reads through `bytes()`) to its FormData.
jest.mock('expo-file-system', () => ({
  File: class {
    readonly uri: string;
    readonly name: string;
    readonly type: string;
    constructor(uri: string) {
      this.uri = uri;
      this.name = uri.split('/').pop() ?? '';
      this.type = uri.endsWith('.jpg') ? 'image/jpeg' : '';
    }
  },
}));

jest.mock('expo-device', () => ({ isDevice: true, deviceName: 'Test Phone' }));

// Screens only report events; the real queue (and its flush timer) is exercised in __tests__/analytics via
// `jest.requireActual('@/analytics')`.
jest.mock('@/analytics', () => ({
  track: jest.fn(),
  flushAnalytics: jest.fn(async () => undefined),
  getAnonymousId: jest.fn(async () => 'anon-test'),
  rotateAnonymousId: jest.fn(async () => undefined),
}));

// The league is switched off on the server by default (every route answers 404, which the endpoints turn into `null`): so
// every screen that asks for it, Keşfet's row and the morning card's line included, sees "no league" unless a test says
// otherwise (`__tests__/features/league`).
jest.mock('@/api/endpoints/league', () => ({
  getLeagueMe: jest.fn(async () => null),
  getLeagueResults: jest.fn(async () => null),
  getLeagueTable: jest.fn(async () => null),
  getNextPair: jest.fn(),
  joinLeague: jest.fn(),
  leaveLeague: jest.fn(),
  reportPair: jest.fn(),
  voteOnPair: jest.fn(),
  withdrawLeagueEntry: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test-token]' })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: jest.fn(() => null),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

// Reanimated's own jest mock: no native runtime, animations resolve immediately. The deck is driven through
// its buttons in tests; the drag gesture itself needs a device.
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// Worklets runs its JS (web) implementation under Jest, which has no UI runtime: the two calls that need one are
// stubbed (gesture-handler asks for the runtime holder, the deck schedules callbacks back to the JS thread).
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

// The swipe-to-reveal wrapper is driven by shared values; in tests the actions are simply always rendered.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  function Swipeable(props: { children?: unknown; renderRightActions?: () => unknown }) {
    return createElement(View, null, props.children, props.renderRightActions?.());
  }
  return { __esModule: true, default: Swipeable };
});

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

installLeakGuard();

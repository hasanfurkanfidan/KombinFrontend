import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { deleteAsync } from 'expo-file-system/legacy';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { rotateAnonymousId } from '@/analytics';
import { listCategories, listProducts } from '@/api/endpoints/catalog';
import { listSavedIds } from '@/api/endpoints/engagement';
import { getDailyOutfit } from '@/api/endpoints/outfits';
import { getWardrobeGaps, getWardrobeStats, listWardrobeItems } from '@/api/endpoints/wardrobe';
import type { WardrobeItemPage } from '@/api/models';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { usePendingDeletionStore } from '@/features/auth/pendingDeletion';
import { resetImageUrls, stableImageUrl } from '@/features/social/imageUrl';
import { useAddStore } from '@/features/wardrobe/addStore';
import { WardrobeScreen } from '@/features/wardrobe/WardrobeScreen';
import { usePrefsStore } from '@/session/prefsStore';
import { readStoredWornOutfit } from '@/session/wornOutfitStorage';
import { endSession } from '@/session/sessionStore';
import { installUserScopeReset, userScopeEpoch } from '@/session/userScope';

import {
  categories,
  dailyOutfit,
  page,
  wardrobeGaps,
  wardrobeStats,
  wardrobeSummary,
} from '../fixtures';
import { resetSession, signedInSession } from '../testUtils';

jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');

const listItemsMock = jest.mocked(listWardrobeItems);

function itemsPage(ids: string[]): WardrobeItemPage {
  const items = ids.map((id) => wardrobeSummary({ id, name: `Parça ${id}` }));
  return {
    items,
    page: 1,
    pageSize: 24,
    totalCount: items.length,
    totalPages: 1,
  } as WardrobeItemPage;
}

/** The app's own query client, as `AppProviders` provides it: the one the reset clears. */
function renderInApp() {
  return render(
    <GestureHandlerRootView>
      <QueryClientProvider client={queryClient}>
        <WardrobeScreen />
      </QueryClientProvider>
    </GestureHandlerRootView>,
  );
}

let uninstall: () => void = () => undefined;

beforeAll(() => {
  // The app client's 5-minute GC timers would keep the Jest worker alive after the last test.
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, retry: false, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
});

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  await resetSession();
  usePrefsStore.getState().reset();
  useAddStore.getState().reset();
  resetImageUrls();
  jest.mocked(getWardrobeStats).mockResolvedValue(wardrobeStats());
  jest.mocked(getWardrobeGaps).mockResolvedValue(wardrobeGaps());
  jest.mocked(listCategories).mockResolvedValue(categories);
  jest.mocked(listProducts).mockResolvedValue(page([]));
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
  jest.mocked(getDailyOutfit).mockResolvedValue(dailyOutfit());
  uninstall = installUserScopeReset();
});

afterEach(() => {
  uninstall();
  queryClient.clear();
});

describe('signing out forgets the account that left', () => {
  it("never shows the previous user's wardrobe to the next user, not even while the next one loads", async () => {
    await signedInSession('a');
    listItemsMock.mockResolvedValue(itemsPage(['a1a1a1a1-0000-4000-8000-000000000001']));
    await renderInApp();
    expect(
      await screen.findByTestId('wardrobe-item-a1a1a1a1-0000-4000-8000-000000000001'),
    ).toBeTruthy();

    await act(async () => {
      await endSession();
    });

    // B's list is still on its way: nothing of A's may fill the gap.
    let answerB!: (value: WardrobeItemPage) => void;
    listItemsMock.mockReturnValue(new Promise((resolve) => (answerB = resolve)));
    await act(async () => {
      await signedInSession('b');
    });
    expect(screen.queryByTestId('wardrobe-item-a1a1a1a1-0000-4000-8000-000000000001')).toBeNull();

    await act(async () => answerB(itemsPage(['b2b2b2b2-0000-4000-8000-000000000002'])));
    expect(
      await screen.findByTestId('wardrobe-item-b2b2b2b2-0000-4000-8000-000000000002'),
    ).toBeTruthy();
    expect(screen.queryByTestId('wardrobe-item-a1a1a1a1-0000-4000-8000-000000000001')).toBeNull();
  });

  it('clears the query cache, the in-memory stores, the photo URL map, temp photos and the anonymous id', async () => {
    await signedInSession('a');
    queryClient.setQueryData(queryKeys.personas, [{ id: 'persona-a' }]);
    queryClient.setQueryData(queryKeys.me, { id: 'user-a' });
    usePrefsStore.getState().addRecentSearch('siyah bot');
    usePrefsStore.getState().skipOnboarding();
    usePrefsStore.getState().setPushToken('ExponentPushToken[a]');
    usePrefsStore.getState().markHomeCardWorn({ day: '2026-11-08', outfitId: 'worn-a' });
    useAddStore.getState().setLocalUri('local-1', 'file:///cache/ImagePicker/a.jpg');
    usePendingDeletionStore
      .getState()
      .begin('2026-11-22T00:00:00Z', { kind: 'password', email: 'a@kombin.test', password: 'x' });
    stableImageUrl('post-a', 'https://storage.test/a.jpg?sig=1');
    const epoch = userScopeEpoch();

    await endSession();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(usePrefsStore.getState()).toMatchObject({
      recentSearches: [],
      onboardingSkipped: false,
      pushToken: null,
      homeCardWorn: null,
    });
    // The remembered worn outfit is on disk too: the next person must not inherit it.
    await waitFor(async () => expect(await readStoredWornOutfit()).toBeNull());
    expect(useAddStore.getState().localUris).toEqual({});
    expect(usePendingDeletionStore.getState().credentials).toBeNull();
    // The map forgot A's URL: the next post with that id starts from its own.
    expect(stableImageUrl('post-a', 'https://storage.test/b.jpg?sig=2')).toBe(
      'https://storage.test/b.jpg?sig=2',
    );
    expect(userScopeEpoch()).toBe(epoch + 1);
    expect(rotateAnonymousId).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(jest.mocked(deleteAsync)).toHaveBeenCalledWith('file:///cache/ImagePicker', {
        idempotent: true,
      }),
    );
    expect(jest.mocked(deleteAsync)).toHaveBeenCalledWith('file:///cache/ImageManipulator', {
      idempotent: true,
    });
  });

  it('does nothing when a session that was never signed in settles (cold start, signed out)', async () => {
    queryClient.setQueryData(queryKeys.categories, categories);

    await endSession();

    expect(queryClient.getQueryData(queryKeys.categories)).toEqual(categories);
    expect(rotateAnonymousId).not.toHaveBeenCalled();
  });
});

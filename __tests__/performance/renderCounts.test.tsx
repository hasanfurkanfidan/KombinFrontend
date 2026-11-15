import { Text, View } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getMe } from '@/api/endpoints/auth';
import { listSavedIds } from '@/api/endpoints/engagement';
import type { Me } from '@/api/models';
import { matchBadgeScore } from '@/features/catalog/matchBadge';
import type { CardProduct } from '@/features/catalog/ProductCard';
import { ProductGrid } from '@/features/catalog/ProductGrid';
import { matchText } from '@/features/social/labels';
import { PostCard } from '@/features/social/PostCard';

import { listItem, post } from '../fixtures';
import { resetSession } from '../testUtils';

// Each card calls one of these exactly once per render: counting calls counts renders.
jest.mock('@/features/catalog/matchBadge', () => {
  const actual = jest.requireActual('@/features/catalog/matchBadge');
  return { ...actual, matchBadgeScore: jest.fn(actual.matchBadgeScore) };
});
jest.mock('@/features/social/labels', () => {
  const actual = jest.requireActual('@/features/social/labels');
  return { ...actual, matchText: jest.fn(actual.matchText) };
});
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/social');

const cardRenders = jest.mocked(matchBadgeScore);
const postRenders = jest.mocked(matchText);

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
});

function wrap(ui: ReactElement) {
  return (
    <GestureHandlerRootView>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  client.clear();
  await resetSession();
  jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
  jest.mocked(getMe).mockResolvedValue({ id: 'me-1', displayName: 'Ben' } as unknown as Me);
});

describe('Keşfet grid cards re-render only when their own props change', () => {
  const a = listItem({ id: 'a' }) as CardProduct;
  const b = listItem({ id: 'b' }) as CardProduct;

  function grid(items: CardProduct[], label: string) {
    // A new header element and a new `onPressItem` arrow on every call, exactly like a screen re-rendering.
    return wrap(
      <ProductGrid
        items={items}
        onPressItem={(id) => void id}
        header={<Text>{label}</Text>}
        placeholder={<View />}
        isFetchingNextPage={false}
        onEndReached={() => undefined}
        refreshing={false}
        onRefresh={() => undefined}
      />,
    );
  }

  it('a parent re-render (a keystroke, a page arriving) does not re-render the cards; a changed product does', async () => {
    const view = await render(grid([a, b], 'ilk'));
    expect(await screen.findByTestId('product-card-b')).toBeTruthy();
    const settled = cardRenders.mock.calls.length;
    expect(settled).toBeGreaterThanOrEqual(2);

    await view.rerender(grid([a, b], 'ikinci'));
    expect(screen.getByText('ikinci')).toBeTruthy();
    expect(cardRenders.mock.calls.length).toBe(settled);

    // Only the card whose product object changed renders again.
    await view.rerender(grid([{ ...a, name: 'Yeni ad' }, b], 'üçüncü'));
    expect(screen.getByText('Yeni ad')).toBeTruthy();
    expect(cardRenders.mock.calls.length).toBe(settled + 1);
  });
});

describe('Akış cards re-render only when their own post changes', () => {
  function Feed({ value, tick }: { value: ReturnType<typeof post>; tick: number }) {
    return (
      <View>
        <Text>{`tick ${tick}`}</Text>
        <PostCard post={value} />
      </View>
    );
  }

  it('a parent re-render with the same post does not re-render the card; a patched post does', async () => {
    const first = post({ id: 'p1' });
    const view = await render(wrap(<Feed value={first} tick={1} />));
    expect(await screen.findByTestId('post-photo-p1')).toBeTruthy();
    // Let the card's own queries settle first: those re-renders are its own business.
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const settled = postRenders.mock.calls.length;

    await view.rerender(wrap(<Feed value={first} tick={2} />));
    expect(screen.getByText('tick 2')).toBeTruthy();
    expect(postRenders.mock.calls.length).toBe(settled);

    await view.rerender(wrap(<Feed value={{ ...first, likeCount: 99 }} tick={3} />));
    expect(postRenders.mock.calls.length).toBe(settled + 1);
  });
});

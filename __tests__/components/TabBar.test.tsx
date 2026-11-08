import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TabBar } from '@/components/TabBar';

type Props = ComponentProps<typeof TabBar>;

/** The routes of `app/(tabs)` in layout order, including the two redirects that keep old links working. */
const ROUTES = ['index', 'feed', 'wardrobe', 'prices', 'profile', 'tracking', 'add'];

async function renderBar(index = 0) {
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  const props = {
    state: { index, routes: ROUTES.map((name) => ({ key: `${name}-key`, name })) },
    emitter,
    navigateToTab,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as Props;
  await render(<TabBar {...props} />);
  return { navigateToTab };
}

describe('TabBar', () => {
  it('shows five labelled tabs in order and no floating button', async () => {
    await renderBar();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Keşfet',
      'Akış',
      'Dolap',
      'Fiyatlar',
      'Profil',
    ]);
    for (const label of ['Keşfet', 'Akış', 'Dolap', 'Fiyatlar', 'Profil']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // The old raised "+" and the redirect routes have no button.
    expect(screen.queryByTestId('tab-add')).toBeNull();
    expect(screen.queryByTestId('tab-tracking')).toBeNull();
    expect(screen.queryByText('Takip')).toBeNull();
  });

  it('switches to a tab that is not focused', async () => {
    const { navigateToTab } = await renderBar(0);

    await fireEvent.press(screen.getByTestId('tab-prices'));

    expect(navigateToTab).toHaveBeenCalledWith('prices-key');
  });
});

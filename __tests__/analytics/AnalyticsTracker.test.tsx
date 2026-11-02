import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';

import { flushAnalytics, track } from '@/analytics';
import { AnalyticsTracker } from '@/analytics/AnalyticsTracker';

type Listener = (state: 'active' | 'inactive' | 'background') => void;

describe('AnalyticsTracker', () => {
  let emit: Listener;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePathname).mockReturnValue('/');
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: Listener,
    ) => {
      emit = listener;
      return { remove };
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const names = () => jest.mocked(track).mock.calls.map(([name]) => name);

  it('reports app_open and the first screen on a cold start', async () => {
    await render(<AnalyticsTracker />);

    expect(track).toHaveBeenCalledWith('app_open', {});
    expect(track).toHaveBeenCalledWith('screen_view', { screen: 'home' });
  });

  it('reports a screen_view for every route change, without ids, and not twice for the same route', async () => {
    const screen = await render(<AnalyticsTracker />);

    jest.mocked(usePathname).mockReturnValue('/product/6f1c2a8e-1b2c-4d3e-8f90-123456789abc');
    await screen.rerender(<AnalyticsTracker />);
    await screen.rerender(<AnalyticsTracker />);
    jest.mocked(usePathname).mockReturnValue('/notifications');
    await screen.rerender(<AnalyticsTracker />);

    const views = jest.mocked(track).mock.calls.filter(([name]) => name === 'screen_view');
    expect(views.map(([, props]) => props)).toEqual([
      { screen: 'home' },
      { screen: 'product/:id' },
      { screen: 'notifications' },
    ]);
  });

  it('reports app_background and flushes the queue when the app goes to the background', async () => {
    await render(<AnalyticsTracker />);

    emit('background');

    expect(track).toHaveBeenLastCalledWith('app_background', {});
    expect(flushAnalytics).toHaveBeenCalledTimes(1);
  });

  it('reports app_open again on return to the foreground, but not for an inactive blip', async () => {
    await render(<AnalyticsTracker />);
    jest.mocked(track).mockClear();

    emit('inactive');
    emit('active');
    expect(names()).toEqual([]);

    emit('inactive');
    emit('background');
    emit('active');
    expect(names()).toEqual(['app_background', 'app_open']);
  });

  it('stops listening when it unmounts', async () => {
    const screen = await render(<AnalyticsTracker />);
    await screen.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

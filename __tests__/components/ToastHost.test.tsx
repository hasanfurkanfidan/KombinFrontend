import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ToastHost } from '@/components/ToastHost';
import { showToast, useToastStore } from '@/components/toastStore';

beforeEach(() => {
  useToastStore.getState().hide();
});

describe('ToastHost', () => {
  it('shows a plain toast without a button', async () => {
    await render(<ToastHost />);

    await act(async () => showToast('Kaydedildi'));

    expect(screen.getByText('Kaydedildi')).toBeTruthy();
    expect(screen.queryByTestId('toast-action')).toBeNull();
  });

  it('shows an action button that runs the action and hides the toast', async () => {
    const onPress = jest.fn();
    await render(<ToastHost />);

    await act(async () => showToast('Bugün giydin', { label: 'Geri al', onPress }));
    await fireEvent.press(screen.getByTestId('toast-action'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Bugün giydin')).toBeNull();
  });

  it('forgets the action when the next toast has none', async () => {
    await act(async () => showToast('A', { label: 'Geri al', onPress: jest.fn() }));
    await act(async () => showToast('B'));

    expect(useToastStore.getState().action).toBeNull();
  });
});

import { screen } from '@testing-library/react-native';

import { Avatar, initialOf } from '@/components/Avatar';
import { theme } from '@/theme';

import { renderWithQuery } from '../testUtils';

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]));

describe('Avatar', () => {
  it('draws the initial on a surface circle', async () => {
    await renderWithQuery(<Avatar name="ışıl Demir" testID="avatar" />);

    const circle = flat(screen.getByTestId('avatar').props.style);
    expect(circle.backgroundColor).toBe(theme.colors.surface);
    expect(circle.width).toBe(theme.sizes.postAvatar);
    expect(circle.borderRadius).toBe(theme.sizes.postAvatar / 2);
    expect(screen.getByText('I')).toBeTruthy();
  });

  it('has a large size for profiles', async () => {
    await renderWithQuery(<Avatar name="Ali" size="lg" testID="avatar" />);

    const circle = flat(screen.getByTestId('avatar').props.style);
    expect(circle.width).toBe(theme.sizes.avatar);
    expect(circle.backgroundColor).toBe(theme.colors.surface);
  });

  it('folds the initial like Turkish and never invents a "?" for an empty name', async () => {
    expect(initialOf('ışıl')).toBe('I');
    expect(initialOf('  ilke')).toBe('İ');
    expect(initialOf('')).toBe('');

    await renderWithQuery(<Avatar name="" testID="avatar" />);
    expect(screen.queryByText('?')).toBeNull();
  });
});

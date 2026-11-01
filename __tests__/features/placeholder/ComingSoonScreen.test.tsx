import { screen } from '@testing-library/react-native';

import { ComingSoonScreen } from '@/features/placeholder/ComingSoonScreen';

import { renderWithQuery } from '../../testUtils';

describe('ComingSoonScreen', () => {
  it('shows the tab name and "Yakında"', async () => {
    await renderWithQuery(<ComingSoonScreen title="Dolap" />);

    expect(screen.getByText('Dolap')).toBeTruthy();
    expect(screen.getByText('Yakında')).toBeTruthy();
  });
});

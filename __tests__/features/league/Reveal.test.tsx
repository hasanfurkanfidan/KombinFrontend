import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Reveal } from '@/features/league/Reveal';

/** The mocked `useReducedMotion` answers for the whole file; each test sets it. */
const reanimated = jest.requireMock('react-native-reanimated') as {
  useReducedMotion: () => boolean;
};

afterEach(() => jest.restoreAllMocks());

describe('Reveal (what appears after a vote)', () => {
  it('rises a little and fades in', async () => {
    jest.spyOn(reanimated, 'useReducedMotion').mockReturnValue(false);
    await render(
      <Reveal>
        <Text>%72</Text>
      </Reveal>,
    );

    // The mock's builders return themselves from `.duration()`, so the prop is the very animation that was chosen.
    expect(screen.root?.props.entering).toBe(FadeInDown);
  });

  it('only cross-fades under reduced motion: nothing flies', async () => {
    jest.spyOn(reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(
      <Reveal>
        <Text>%72</Text>
      </Reveal>,
    );

    const entering = screen.root?.props.entering;
    expect(entering).toBe(FadeIn);
    expect(entering).not.toBe(FadeInDown);
  });
});

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useSegments } from 'expo-router';

import { track } from '@/analytics';
import {
  activatePersona,
  createPersona,
  getProfile,
  getStyleCards,
  listPersonas,
  submitSwipes,
  updateProfile,
} from '@/api/endpoints/profile';
import { AudienceScreen } from '@/features/onboarding/AudienceScreen';
import { DoneScreen } from '@/features/onboarding/DoneScreen';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { PersonaNameScreen } from '@/features/onboarding/PersonaNameScreen';
import { SwipeScreen } from '@/features/onboarding/SwipeScreen';
import { usePrefsStore } from '@/session/prefsStore';

import { persona, profile, styleCard } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/catalog');

const getProfileMock = jest.mocked(getProfile);
const updateProfileMock = jest.mocked(updateProfile);
const createPersonaMock = jest.mocked(createPersona);
const getStyleCardsMock = jest.mocked(getStyleCards);
const submitSwipesMock = jest.mocked(submitSwipes);
const listPersonasMock = jest.mocked(listPersonas);

const summary = {
  confidence: 0.5,
  likeCount: 3,
  topColors: ['Green'],
  formalityMean: 3,
  topFamilies: ['Minimal'],
};

beforeEach(async () => {
  jest.clearAllMocks();
  usePrefsStore.getState().reset();
  await resetSession();
  await signedInSession();
});

describe('OnboardingGate (entry rule)', () => {
  it('sends a signed-in user without personas to the audience step', async () => {
    getProfileMock.mockResolvedValue(profile({ personaCount: 0, activePersona: null }));

    await renderWithQuery(<OnboardingGate />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/audience'));
  });

  it('leaves users with a persona alone', async () => {
    getProfileMock.mockResolvedValue(profile({ personaCount: 2 }));

    await renderWithQuery(<OnboardingGate />);
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled());

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not ask again after "Atla"', async () => {
    usePrefsStore.getState().skipOnboarding();
    getProfileMock.mockResolvedValue(profile({ personaCount: 0, activePersona: null }));

    await renderWithQuery(<OnboardingGate />);
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled());

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not redirect while already inside onboarding', async () => {
    jest.mocked(useSegments).mockReturnValue(['(onboarding)', 'persona'] as never);
    getProfileMock.mockResolvedValue(profile({ personaCount: 0, activePersona: null }));

    await renderWithQuery(<OnboardingGate />);
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled());

    expect(router.replace).not.toHaveBeenCalled();
    jest.mocked(useSegments).mockReturnValue([] as never);
  });

  it('does nothing while logged out', async () => {
    await resetSession();
    await renderWithQuery(<OnboardingGate />);

    expect(getProfileMock).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('step 1: audience', () => {
  it('saves the audience with the measurements kept, then goes to the name step', async () => {
    getProfileMock.mockResolvedValue(profile({ audience: 'Unisex', heightCm: 178 }));
    updateProfileMock.mockResolvedValue(profile({ audience: 'Men' }));

    await renderWithQuery(<AudienceScreen />);
    await fireEvent.press(await screen.findByTestId('audience-Men'));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalled());
    // The backend clears measurements that are left out, so the current ones travel along.
    expect(updateProfileMock.mock.calls[0]?.[0]).toMatchObject({
      audience: 'Men',
      heightCm: 178,
      weightKg: 76,
      chestCm: 100,
      waistCm: 84,
    });
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/persona', params: { flow: 'first' } }),
    );
  });

  it('reports the step as next, and a skip as skip', async () => {
    getProfileMock.mockResolvedValue(profile());
    updateProfileMock.mockResolvedValue(profile({ audience: 'Women' }));

    await renderWithQuery(<AudienceScreen />);
    await fireEvent.press(await screen.findByTestId('audience-Women'));
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('onboarding_step', { step: 'audience', action: 'next' }),
    );

    await fireEvent.press(screen.getByTestId('onboarding-skip'));
    expect(track).toHaveBeenCalledWith('onboarding_step', { step: 'audience', action: 'skip' });
  });

  it('offers Kadın, Erkek and Hepsi, and "Atla" skips without creating anything', async () => {
    getProfileMock.mockResolvedValue(profile());

    await renderWithQuery(<AudienceScreen />);

    expect(await screen.findByText('Kadın')).toBeTruthy();
    expect(screen.getByText('Erkek')).toBeTruthy();
    expect(screen.getByText('Hepsi')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('onboarding-skip'));

    expect(usePrefsStore.getState().onboardingSkipped).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(createPersonaMock).not.toHaveBeenCalled();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });
});

describe('step 2: persona name', () => {
  it('creates the persona from a suggested chip, using the chip key as icon', async () => {
    createPersonaMock.mockResolvedValue(persona({ id: 'new1', name: 'Ofis' }));

    await renderWithQuery(<PersonaNameScreen flow="first" />);
    await fireEvent.press(screen.getByTestId('persona-preset-office'));
    await fireEvent.press(screen.getByTestId('persona-submit'));

    await waitFor(() =>
      expect(createPersonaMock).toHaveBeenCalledWith({ name: 'Ofis', icon: 'office' }),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/swipe',
        params: { personaId: 'new1', flow: 'first', returnTo: undefined },
      }),
    );
  });

  it('makes a new persona the active one, then goes on to train it', async () => {
    createPersonaMock.mockResolvedValue(persona({ id: 'new3', name: 'Gece', isActive: false }));
    jest.mocked(activatePersona).mockResolvedValue(undefined);

    await renderWithQuery(<PersonaNameScreen flow="new" returnTo="/" />);
    await fireEvent.changeText(screen.getByTestId('persona-name'), 'Gece');
    await fireEvent.press(screen.getByTestId('persona-submit'));

    await waitFor(() => expect(jest.mocked(activatePersona)).toHaveBeenCalledWith('new3'));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    // Only the first run is onboarding proper: a second persona does not report a step.
    expect(track).not.toHaveBeenCalledWith('onboarding_step', expect.anything());
  });

  it('does not activate a persona the backend already activated (the first one)', async () => {
    createPersonaMock.mockResolvedValue(persona({ id: 'first1', name: 'Ofis', isActive: true }));

    await renderWithQuery(<PersonaNameScreen flow="first" />);
    await fireEvent.changeText(screen.getByTestId('persona-name'), 'Ofis');
    await fireEvent.press(screen.getByTestId('persona-submit'));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(jest.mocked(activatePersona)).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('onboarding_step', { step: 'persona', action: 'next' });
  });

  it('still goes on when the activation fails: the chip row can switch later', async () => {
    createPersonaMock.mockResolvedValue(persona({ id: 'new4', name: 'Tatil', isActive: false }));
    jest.mocked(activatePersona).mockRejectedValue(new Error('offline'));

    await renderWithQuery(<PersonaNameScreen flow="new" returnTo="/" />);
    await fireEvent.changeText(screen.getByTestId('persona-name'), 'Tatil');
    await fireEvent.press(screen.getByTestId('persona-submit'));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });

  it('uses the "custom" icon for free text and trims it', async () => {
    createPersonaMock.mockResolvedValue(persona({ id: 'new2', name: 'Tatil' }));

    await renderWithQuery(<PersonaNameScreen flow="new" returnTo="/" />);
    await fireEvent.changeText(screen.getByTestId('persona-name'), '  Tatil  ');
    await fireEvent.press(screen.getByTestId('persona-submit'));

    await waitFor(() =>
      expect(createPersonaMock).toHaveBeenCalledWith({ name: 'Tatil', icon: 'custom' }),
    );
  });

  it('switches to "custom" when a chip text is edited', async () => {
    createPersonaMock.mockResolvedValue(persona());

    await renderWithQuery(<PersonaNameScreen flow="first" />);
    await fireEvent.press(screen.getByTestId('persona-preset-night'));
    await fireEvent.changeText(screen.getByTestId('persona-name'), 'Gece kulübü');
    await fireEvent.press(screen.getByTestId('persona-submit'));

    await waitFor(() =>
      expect(createPersonaMock).toHaveBeenCalledWith({ name: 'Gece kulübü', icon: 'custom' }),
    );
  });

  it('validates 2 to 40 characters in Turkish', async () => {
    await renderWithQuery(<PersonaNameScreen flow="first" />);

    await fireEvent.changeText(screen.getByTestId('persona-name'), 'A');
    await fireEvent.press(screen.getByTestId('persona-submit'));
    expect(await screen.findByText('Ad 2 ile 40 karakter arasında olmalı')).toBeTruthy();
    expect(createPersonaMock).not.toHaveBeenCalled();
  });

  it('shows the duplicate-name error on the field', async () => {
    const { ApiError } = jest.requireActual('@/api/client');
    createPersonaMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Profile.PersonaNameTaken', correlationId: 'c' }),
    );

    await renderWithQuery(<PersonaNameScreen flow="first" />);
    await fireEvent.changeText(screen.getByTestId('persona-name'), 'Ofis');
    await fireEvent.press(screen.getByTestId('persona-submit'));

    expect(await screen.findByText('Bu isimde bir tarzın zaten var')).toBeTruthy();
  });
});

describe('step 3: swipe (buttons only)', () => {
  const cards = Array.from({ length: 7 }, (_, index) => styleCard(`c${index + 1}`));

  beforeEach(() => {
    getStyleCardsMock.mockResolvedValue({ items: cards, remaining: 0 });
    submitSwipesMock.mockResolvedValue({ styleSummary: summary, onboardingCompleted: false });
    listPersonasMock.mockResolvedValue({ items: [persona({ id: 'pe1' })] });
  });

  it('fetches 20 cards and shows the progress pill', async () => {
    await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);

    expect(await screen.findByTestId('swipe-card-c1')).toBeTruthy();
    expect(getStyleCardsMock.mock.calls[0]?.[0]).toBe('pe1');
    expect(getStyleCardsMock.mock.calls[0]?.[1]).toBe(20);
    expect(screen.getByText('1 / 7')).toBeTruthy();
  });

  it('maps the buttons to Dislike / Skip / Like and batches every 5 swipes', async () => {
    await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);
    await screen.findByTestId('swipe-card-c1');

    await fireEvent.press(screen.getByTestId('swipe-like'));
    await fireEvent.press(screen.getByTestId('swipe-dislike'));
    await fireEvent.press(screen.getByTestId('swipe-skip'));
    await fireEvent.press(screen.getByTestId('swipe-like'));
    expect(submitSwipesMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('swipe-like'));

    await waitFor(() => expect(submitSwipesMock).toHaveBeenCalledTimes(1));
    expect(submitSwipesMock).toHaveBeenCalledWith('pe1', [
      { styleCardId: 'c1', decision: 'Like' },
      { styleCardId: 'c2', decision: 'Dislike' },
      { styleCardId: 'c3', decision: 'Skip' },
      { styleCardId: 'c4', decision: 'Like' },
      { styleCardId: 'c5', decision: 'Like' },
    ]);
    expect(await screen.findByText('6 / 7')).toBeTruthy();
  });

  it('reports every swipe with the persona and the decision', async () => {
    await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);
    await screen.findByTestId('swipe-card-c1');

    await fireEvent.press(screen.getByTestId('swipe-like'));
    await fireEvent.press(screen.getByTestId('swipe-dislike'));
    await fireEvent.press(screen.getByTestId('swipe-skip'));

    const swipes = jest.mocked(track).mock.calls.filter(([name]) => name === 'swipe');
    expect(swipes).toEqual([
      ['swipe', { personaId: 'pe1', decision: 'Like' }],
      ['swipe', { personaId: 'pe1', decision: 'Dislike' }],
      ['swipe', { personaId: 'pe1', decision: 'Skip' }],
    ]);
  });

  it('sends the remainder and goes to the done step when the stack is empty', async () => {
    await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);
    await screen.findByTestId('swipe-card-c1');

    for (let swipe = 0; swipe < 7; swipe += 1) {
      await fireEvent.press(screen.getByTestId('swipe-like'));
    }

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/done',
        params: { personaId: 'pe1' },
      }),
    );
    const sent = submitSwipesMock.mock.calls.flatMap(([, swipes]) => swipes);
    expect(sent).toHaveLength(7);
  });

  it('moves on as soon as the backend says onboarding is completed', async () => {
    submitSwipesMock.mockResolvedValue({ styleSummary: summary, onboardingCompleted: true });

    await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);
    await screen.findByTestId('swipe-card-c1');
    for (let swipe = 0; swipe < 5; swipe += 1) {
      await fireEvent.press(screen.getByTestId('swipe-like'));
    }

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/done',
        params: { personaId: 'pe1' },
      }),
    );
  });

  it('keeps going for a persona that is only being re-trained, then dismisses', async () => {
    submitSwipesMock.mockResolvedValue({ styleSummary: summary, onboardingCompleted: true });

    await renderWithQuery(<SwipeScreen personaId="pe1" flow="retrain" returnTo="/profile" />);
    await screen.findByTestId('swipe-card-c1');
    for (let swipe = 0; swipe < 5; swipe += 1) {
      await fireEvent.press(screen.getByTestId('swipe-like'));
    }
    await waitFor(() => expect(submitSwipesMock).toHaveBeenCalled());
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(screen.getByText('6 / 7')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('swipe-like'));
    await fireEvent.press(screen.getByTestId('swipe-like'));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/profile'));
  });

  it('flushes queued swipes when the screen is left', async () => {
    const view = await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);
    await screen.findByTestId('swipe-card-c1');
    await fireEvent.press(screen.getByTestId('swipe-like'));
    await fireEvent.press(screen.getByTestId('swipe-dislike'));
    expect(submitSwipesMock).not.toHaveBeenCalled();

    await act(async () => {
      view.unmount();
    });

    await waitFor(() => expect(submitSwipesMock).toHaveBeenCalledTimes(1));
    expect(submitSwipesMock.mock.calls[0]?.[1]).toHaveLength(2);
  });

  it('shows an error with retry when the cards cannot be loaded', async () => {
    getStyleCardsMock.mockRejectedValueOnce(new Error('boom'));

    await renderWithQuery(<SwipeScreen personaId="pe1" flow="first" />);

    expect(await screen.findByText('Kartlar yüklenemedi')).toBeTruthy();
  });
});

describe('step 4: done', () => {
  it('shows colours as swatches, formality as five dots and the families as chips', async () => {
    listPersonasMock.mockResolvedValue({
      items: [
        persona({
          id: 'pe1',
          styleSummary: {
            confidence: 0.9,
            likeCount: 8,
            topColors: ['Green', 'Beige', 'Black'],
            formalityMean: 3.4,
            topFamilies: ['Minimal', 'Classic'],
          },
        }),
      ],
    });

    await renderWithQuery(<DoneScreen personaId="pe1" />);

    expect(await screen.findByTestId('summary-swatch-Green')).toBeTruthy();
    expect(screen.getByTestId('summary-swatch-Beige')).toBeTruthy();
    expect(screen.getByTestId('summary-swatch-Black')).toBeTruthy();
    expect(screen.getByTestId('formality-scale').children).toHaveLength(5);
    expect(screen.getByText('Minimal')).toBeTruthy();
    expect(screen.getByText('Klasik')).toBeTruthy();
  });

  it('warms the profile and the product list for the active persona, then opens Keşfet', async () => {
    const { listProducts } = jest.requireMock('@/api/endpoints/catalog');
    listProducts.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    });
    listPersonasMock.mockResolvedValue({ items: [persona({ id: 'pe1' })] });
    getProfileMock.mockResolvedValue(profile());

    await renderWithQuery(<DoneScreen personaId="pe1" />);
    await fireEvent.press(await screen.findByTestId('done-cta'));

    expect(track).toHaveBeenCalledWith('onboarding_step', { step: 'done', action: 'done' });
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled());
    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    expect(listProducts.mock.calls[0]?.[0]).toMatchObject({ PersonaId: 'pe1', Sort: 'match' });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('explains when nothing was learned yet', async () => {
    listPersonasMock.mockResolvedValue({
      items: [
        persona({
          styleSummary: {
            confidence: 0,
            likeCount: 0,
            topColors: [],
            formalityMean: 3,
            topFamilies: [],
          },
        }),
      ],
    });

    await renderWithQuery(<DoneScreen personaId="pe1" />);

    expect(
      await screen.findByText('Henüz yeterince beğeni yok; kullandıkça öğreneceğiz.'),
    ).toBeTruthy();
  });
});

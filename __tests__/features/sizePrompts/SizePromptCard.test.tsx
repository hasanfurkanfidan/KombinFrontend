import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getMe } from '@/api/endpoints/auth';
import { listSavedIds } from '@/api/endpoints/engagement';
import { getProfile, listPersonas, listSizes, updateProfile } from '@/api/endpoints/profile';
import { answerSizePrompt, listSizePrompts } from '@/api/endpoints/sizePrompts';
import { getCreatorStats } from '@/api/endpoints/social';
import { useToastStore } from '@/components/toastStore';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { CONFIRMATION_MS, SizePromptCard } from '@/features/sizePrompts/SizePromptCard';
import { theme } from '@/theme';

import { persona, profile, sizePrompt } from '../../fixtures';
import { heldOpen, renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/sizePrompts');
jest.mock('@/api/endpoints/social');

const listMock = jest.mocked(listSizePrompts);
const answerMock = jest.mocked(answerSizePrompt);
const profileMock = jest.mocked(getProfile);
const updateMock = jest.mocked(updateProfile);
const trackMock = jest.mocked(track);

const first = sizePrompt({ id: 'sp1' });
const second = sizePrompt({
  id: 'sp2',
  product: { id: 'p2', name: 'Kargo pantolon', imageUrl: null },
  brand: { id: 'b2', name: 'Zara', slug: 'zara' },
  seller: { name: 'Hepsiburada', slug: 'hepsiburada' },
  knownSize: null,
  availableSizes: [],
});

const toast = () => useToastStore.getState().message;
const confirmation = () => screen.queryByTestId('size-prompt-confirmation');

/** The confirming line stays for a moment; this lets it go. */
async function letConfirmationGo() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(CONFIRMATION_MS);
  });
}

beforeEach(async () => {
  // The confirming line is a timer: fake ones, so a test decides when it ends.
  jest.useFakeTimers();
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  profileMock.mockResolvedValue(profile());
  listMock.mockResolvedValue({ prompts: [first, second] });
  answerMock.mockResolvedValue({ answer: 'BoughtFits', sizeEntry: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the collapsed row', () => {
  it('is one slim row: the product, "aldın mı?" and two answers, no brand or seller', async () => {
    await renderWithQuery(<SizePromptCard />);

    expect(await screen.findByTestId('size-prompt-card')).toBeTruthy();
    expect(screen.getByTestId('size-prompt-product')).toHaveTextContent('Slim fit gömlek');
    expect(screen.getByLabelText('Slim fit gömlek — aldın mı?')).toBeTruthy();
    expect(screen.getByText('Aldım')).toBeTruthy();
    expect(screen.getByText('Almadım')).toBeTruthy();
    // The brand and the seller are left for the later steps; the second step does not exist yet.
    expect(screen.queryByText(/Mavi/)).toBeNull();
    expect(screen.queryByText(/Trendyol/)).toBeNull();
    expect(screen.queryByText('Oldu mu?')).toBeNull();
    // The second question waits its turn.
    expect(screen.queryByText('Kargo pantolon')).toBeNull();
  });

  // Jest's window reports an enlarged font scale of its own, so each size is set explicitly.
  it.each([
    [1, 1],
    [2, undefined],
  ])('at font scale %s the product name has numberOfLines %s', async (fontScale, lines) => {
    const before = Dimensions.get('window');
    try {
      Dimensions.set({ window: { ...before, fontScale } });
      await renderWithQuery(<SizePromptCard />);
      expect((await screen.findByTestId('size-prompt-product')).props.numberOfLines).toBe(lines);
    } finally {
      // The mounted card listens to the window: put it back inside act.
      await act(async () => Dimensions.set({ window: before }));
    }
  });

  it('gives every control a name and a 44 pt target', async () => {
    await renderWithQuery(<SizePromptCard />);
    await screen.findByTestId('size-prompt-card');

    const close = screen.getByLabelText('Bu ürün için sorma');
    expect(close.props.accessibilityRole).toBe('button');
    const closeStyle = StyleSheet.flatten(close.props.style);
    expect(closeStyle.width).toBeGreaterThanOrEqual(theme.sizes.touch);
    expect(closeStyle.height).toBeGreaterThanOrEqual(theme.sizes.touch);

    for (const id of ['size-prompt-bought', 'size-prompt-not-bought']) {
      const button = screen.getByTestId(id);
      expect(button.props.accessibilityRole).toBe('button');
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(
        theme.sizes.touch,
      );
    }
  });

  it('reports each question once when it is shown', async () => {
    await renderWithQuery(<SizePromptCard />);
    await screen.findByTestId('size-prompt-card');

    const views = trackMock.mock.calls.filter(([name]) => name === 'size_prompt_view');
    expect(views).toEqual([['size_prompt_view', { promptId: 'sp1' }]]);
  });
});

describe('nothing to show', () => {
  it('shows nothing, and keeps no room, when there is no question', async () => {
    listMock.mockResolvedValue({ prompts: [] });
    await renderWithQuery(<SizePromptCard />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
    expect(screen.queryByText('Aldım')).toBeNull();
    expect(trackMock).not.toHaveBeenCalledWith('size_prompt_view', expect.anything());
  });

  it('shows nothing to a visitor and asks for nothing', async () => {
    await resetSession();
    await renderWithQuery(<SizePromptCard />);

    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
    expect(profileMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('asks for nothing while the user has the questions turned off', async () => {
    profileMock.mockResolvedValue(profile({ sizePromptsEnabled: false }));
    await renderWithQuery(<SizePromptCard />);
    await waitFor(() => expect(profileMock).toHaveBeenCalled());

    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe('"Almadım" and "kapat" answer at once', () => {
  it('"Almadım" sends NotBought with no size, then the confirming line, then the next question', async () => {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'NotBought', size: null }),
    );
    expect(await screen.findByTestId('size-prompt-confirmation')).toHaveTextContent(
      'Tamam, teşekkürler',
    );
    expect(trackMock).toHaveBeenCalledWith('size_prompt_answer', {
      promptId: 'sp1',
      answer: 'NotBought',
    });
    // The line replaces the row: no card, no second question yet.
    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
    expect(screen.queryByText('Kargo pantolon')).toBeNull();

    await letConfirmationGo();
    expect(confirmation()).toBeNull();
    expect(await screen.findByText('Kargo pantolon')).toBeTruthy();
    expect(screen.getByText('Aldım')).toBeTruthy();
  });

  it('leaves nothing behind when it was the last question', async () => {
    listMock.mockResolvedValue({ prompts: [first] });
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));
    await screen.findByTestId('size-prompt-confirmation');

    await letConfirmationGo();
    expect(confirmation()).toBeNull();
    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
  });

  it('"kapat" is "Bu ürün için sorma": it sends NeverAsk at once', async () => {
    listMock.mockResolvedValue({ prompts: [first] });
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByLabelText('Bu ürün için sorma'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'NeverAsk', size: null }),
    );
    expect(await screen.findByTestId('size-prompt-confirmation')).toHaveTextContent(
      'Tamam, bu ürün için bir daha sormayacağız',
    );
    expect(trackMock).toHaveBeenCalledWith('size_prompt_answer', {
      promptId: 'sp1',
      answer: 'NeverAsk',
    });
    await letConfirmationGo();
  });
});

describe('"Aldım" opens "Oldu mu?" in place', () => {
  it('shows the three answers and sends nothing yet', async () => {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-bought'));

    expect(screen.getByTestId('size-prompt-card')).toBeTruthy();
    expect(screen.getByTestId('size-prompt-question')).toHaveTextContent('Oldu mu?');
    expect(screen.getByText('Oldu')).toBeTruthy();
    expect(screen.getByText('Küçük geldi')).toBeTruthy();
    expect(screen.getByText('Büyük geldi')).toBeTruthy();
    // The collapsed answers are gone; the corner control stays.
    expect(screen.queryByText('Aldım')).toBeNull();
    expect(screen.getByLabelText('Bu ürün için sorma')).toBeTruthy();
    expect(answerMock).not.toHaveBeenCalled();
  });

  it.each([
    ['size-prompt-small', 'BoughtTooSmall'],
    ['size-prompt-large', 'BoughtTooLarge'],
  ])('%s sends %s at once, with no size', async (testID, answer) => {
    listMock.mockResolvedValue({ prompts: [first] });
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-bought'));
    await fireEvent.press(screen.getByTestId(testID));

    await waitFor(() => expect(answerMock).toHaveBeenCalledWith('sp1', { answer, size: null }));
    expect(await screen.findByTestId('size-prompt-confirmation')).toHaveTextContent(
      'Teşekkürler, Mavi için not aldık',
    );
    expect(trackMock).toHaveBeenCalledWith('size_prompt_answer', { promptId: 'sp1', answer });
    await letConfirmationGo();
    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
  });
});

describe('"Oldu" asks for the size in the same card', () => {
  async function openSizeStep() {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-bought'));
    await fireEvent.press(screen.getByTestId('size-prompt-fits'));
  }

  it('offers the sizes of the clicked offer, with the known one selected', async () => {
    await openSizeStep();

    expect(screen.getByText('Mavi için hangi bedeni aldın?')).toBeTruthy();
    expect(screen.getByTestId('size-prompt-size-M').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('size-prompt-size-S').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('size-prompt-size-L')).toBeTruthy();
    expect(screen.getByLabelText('L beden')).toBeTruthy();
    expect(answerMock).not.toHaveBeenCalled();
  });

  it('saves the chosen size, confirms it with the brand, then shows the next question', async () => {
    await openSizeStep();
    await fireEvent.press(screen.getByTestId('size-prompt-size-L'));
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'BoughtFits', size: 'L' }),
    );
    expect(await screen.findByTestId('size-prompt-confirmation')).toHaveTextContent(
      'Mavi için bedenin L olarak kaydedildi',
    );
    expect(trackMock).toHaveBeenCalledWith('size_prompt_answer', {
      promptId: 'sp1',
      answer: 'BoughtFits',
    });
    expect(toast()).toBeNull();

    await letConfirmationGo();
    // The next question takes the card's place, on its first step.
    expect(await screen.findByText('Kargo pantolon')).toBeTruthy();
    expect(screen.getByText('Aldım')).toBeTruthy();
    expect(screen.queryByText('Slim fit gömlek')).toBeNull();
  });

  it('sends the known size when it is left selected', async () => {
    await openSizeStep();
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'BoughtFits', size: 'M' }),
    );
    await screen.findByTestId('size-prompt-confirmation');
    await letConfirmationGo();
  });

  it('starts with no size when the known one is not among the offered sizes', async () => {
    listMock.mockResolvedValue({
      prompts: [sizePrompt({ knownSize: { size: 'XXL', source: 'UserEntered', confidence: 1 } })],
    });
    await openSizeStep();

    for (const size of ['S', 'M', 'L']) {
      expect(screen.getByTestId(`size-prompt-size-${size}`).props.accessibilityState.selected).toBe(
        false,
      );
    }
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));
    expect(screen.getByTestId('size-prompt-size-error')).toHaveTextContent('Aldığın bedeni yaz');
    expect(answerMock).not.toHaveBeenCalled();
  });

  it('falls back to a text field, filled with the known size, when the offer listed none', async () => {
    listMock.mockResolvedValue({
      prompts: [
        sizePrompt({
          availableSizes: [],
          knownSize: { size: 'M', source: 'Inferred', confidence: 0.5 },
        }),
      ],
    });
    await openSizeStep();

    const field = screen.getByTestId('size-prompt-size-field');
    expect(field.props.value).toBe('M');
    expect(screen.queryByTestId('size-prompt-sizes')).toBeNull();

    await fireEvent.changeText(field, '');
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));
    expect(screen.getByTestId('size-prompt-size-error')).toBeTruthy();
    expect(answerMock).not.toHaveBeenCalled();

    await fireEvent.changeText(field, '  42 ');
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));
    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'BoughtFits', size: '42' }),
    );
    await screen.findByTestId('size-prompt-confirmation');
    await letConfirmationGo();
  });

  it('"Vazgeç" goes back to "Oldu mu?" without sending anything', async () => {
    await openSizeStep();
    await fireEvent.press(screen.getByTestId('size-prompt-size-back'));

    expect(screen.getByTestId('size-prompt-question')).toHaveTextContent('Oldu mu?');
    expect(answerMock).not.toHaveBeenCalled();
  });

  it('"kapat" is still there on this step and never asks again', async () => {
    listMock.mockResolvedValue({ prompts: [first] });
    await openSizeStep();
    await fireEvent.press(screen.getByLabelText('Bu ürün için sorma'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'NeverAsk', size: null }),
    );
    await screen.findByTestId('size-prompt-confirmation');
    await letConfirmationGo();
  });
});

describe('when the answer does not go through', () => {
  it.each([409, 404])('drops the card silently and asks again on a %i', async (status) => {
    listMock.mockResolvedValueOnce({ prompts: [first] }).mockResolvedValue({ prompts: [] });
    answerMock.mockRejectedValue(
      new ApiError({ status, errorCode: 'Profile.SizePromptAnswered', correlationId: 'c' }),
    );
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));

    await waitFor(() => expect(screen.queryByTestId('size-prompt-card')).toBeNull());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    // No confirming line and no message of any kind.
    expect(confirmation()).toBeNull();
    expect(toast()).toBeNull();
    expect(screen.queryByTestId('size-prompt-error')).toBeNull();
    expect(trackMock).not.toHaveBeenCalledWith('size_prompt_answer', expect.anything());
  });

  it('keeps the card and shows the error line on any other error, then lets the user try again', async () => {
    answerMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));

    expect(await screen.findByTestId('size-prompt-error')).toHaveTextContent(
      'Lütfen biraz sonra tekrar dene.',
    );
    expect(screen.getByTestId('size-prompt-card')).toBeTruthy();
    expect(screen.getByText('Slim fit gömlek')).toBeTruthy();
    expect(confirmation()).toBeNull();

    await fireEvent.press(screen.getByTestId('size-prompt-not-bought'));
    expect(await screen.findByTestId('size-prompt-confirmation')).toBeTruthy();
    expect(answerMock).toHaveBeenCalledTimes(2);
    await letConfirmationGo();
  });

  it('says so when the server cannot be reached', async () => {
    answerMock.mockRejectedValueOnce(new ApiError({ status: 0, correlationId: 'c' }));
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));

    expect(await screen.findByTestId('size-prompt-error')).toHaveTextContent(
      'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',
    );
  });
});

describe('the Profil switch', () => {
  beforeEach(() => {
    jest.mocked(getMe).mockResolvedValue({
      id: 'u1',
      email: 'ayse@example.com',
      displayName: 'Ayşe Yılmaz',
      createdAt: '2026-11-01T10:00:00',
    });
    jest
      .mocked(getCreatorStats)
      .mockRejectedValue(
        new ApiError({ status: 403, errorCode: 'Social.NotACreator', correlationId: 'c' }),
      );
    jest.mocked(listPersonas).mockResolvedValue({ items: [persona({ id: 'pe1' })] });
    jest.mocked(listSavedIds).mockResolvedValue({ productIds: [] });
    jest.mocked(listSizes).mockResolvedValue({ items: [] });
  });

  function Both() {
    return (
      <>
        <SizePromptCard />
        <ProfileScreen />
      </>
    );
  }

  it('is on by default, and turning it off hides the card at once', async () => {
    updateMock.mockReturnValue(heldOpen());
    await renderWithQuery(<Both />);

    const toggle = await screen.findByTestId('profile-size-prompts');
    expect(toggle.props.value).toBe(true);
    expect(screen.getByText('Beden sorularını göster')).toBeTruthy();
    expect(await screen.findByTestId('size-prompt-card')).toBeTruthy();

    await fireEvent(toggle, 'valueChange', false);

    // Before the server has answered (it is held open): the card does not wait for it.
    await waitFor(() => expect(screen.queryByTestId('size-prompt-card')).toBeNull());
    expect(screen.getByTestId('profile-size-prompts').props.value).toBe(false);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ sizePromptsEnabled: false }));
  });

  it('goes back, with a message, when the setting could not be saved', async () => {
    updateMock.mockRejectedValue(new ApiError({ status: 500, correlationId: 'c' }));
    await renderWithQuery(<Both />);

    await fireEvent(await screen.findByTestId('profile-size-prompts'), 'valueChange', false);

    await waitFor(() => expect(toast()).toBe('Ayar kaydedilemedi, tekrar dene'));
    expect(screen.getByTestId('profile-size-prompts').props.value).toBe(true);
    expect(await screen.findByTestId('size-prompt-card')).toBeTruthy();
  });

  it('hides a confirming line that is still showing when the switch is turned off', async () => {
    updateMock.mockReturnValue(heldOpen());
    await renderWithQuery(<Both />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));
    await screen.findByTestId('size-prompt-confirmation');

    await fireEvent(screen.getByTestId('profile-size-prompts'), 'valueChange', false);

    await waitFor(() => expect(confirmation()).toBeNull());
  });

  it('shows a visitor no switch', async () => {
    await resetSession();
    await renderWithQuery(<ProfileScreen />);

    await screen.findByTestId('profile-sign-in');
    expect(screen.queryByTestId('profile-size-prompts')).toBeNull();
  });
});

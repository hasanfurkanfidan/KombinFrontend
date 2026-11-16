import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { getMe } from '@/api/endpoints/auth';
import { listSavedIds } from '@/api/endpoints/engagement';
import { getProfile, listPersonas, listSizes, updateProfile } from '@/api/endpoints/profile';
import { answerSizePrompt, listSizePrompts } from '@/api/endpoints/sizePrompts';
import { getCreatorStats } from '@/api/endpoints/social';
import { useToastStore } from '@/components/toastStore';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { SizePromptCard } from '@/features/sizePrompts/SizePromptCard';

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

beforeEach(async () => {
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  profileMock.mockResolvedValue(profile());
  listMock.mockResolvedValue({ prompts: [first, second] });
  answerMock.mockResolvedValue({ answer: 'BoughtFits', sizeEntry: null });
});

describe('what is shown', () => {
  it('shows only the first question, with the product, the brand and the five choices', async () => {
    await renderWithQuery(<SizePromptCard />);

    expect(await screen.findByTestId('size-prompt-card')).toBeTruthy();
    expect(screen.getByTestId('size-prompt-product')).toHaveTextContent('Slim fit gömlek');
    expect(screen.getByTestId('size-prompt-brand')).toHaveTextContent('Mavi · Trendyol');
    expect(screen.getByText('Bunu aldın mı?')).toBeTruthy();
    expect(screen.getByText('Aldım, oldu')).toBeTruthy();
    expect(screen.getByText('Aldım, küçük geldi')).toBeTruthy();
    expect(screen.getByText('Aldım, büyük geldi')).toBeTruthy();
    expect(screen.getByText('Almadım')).toBeTruthy();
    expect(screen.getByText('Bu ürün için sorma')).toBeTruthy();
    // The second question waits its turn.
    expect(screen.queryByText('Kargo pantolon')).toBeNull();
  });

  it('reports each question once when it is shown', async () => {
    await renderWithQuery(<SizePromptCard />);
    await screen.findByTestId('size-prompt-card');

    const views = trackMock.mock.calls.filter(([name]) => name === 'size_prompt_view');
    expect(views).toEqual([['size_prompt_view', { promptId: 'sp1' }]]);
  });

  it('shows nothing, and keeps no room, when there is no question', async () => {
    listMock.mockResolvedValue({ prompts: [] });
    const view = await renderWithQuery(<SizePromptCard />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
    expect(screen.queryByText('Bunu aldın mı?')).toBeNull();
    expect(trackMock).not.toHaveBeenCalledWith('size_prompt_view', expect.anything());
    view.unmount();
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

describe('"Aldım, oldu" asks for the size in the same card', () => {
  it('offers the sizes of the clicked offer, with the known one selected', async () => {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-fits'));

    expect(screen.getByText('Mavi için hangi bedeni aldın?')).toBeTruthy();
    expect(screen.getByTestId('size-prompt-size-M').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('size-prompt-size-S').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('size-prompt-size-L')).toBeTruthy();
    // Nothing is sent until the size is saved.
    expect(answerMock).not.toHaveBeenCalled();
  });

  it('saves the chosen size, confirms it with the brand, then shows the next question', async () => {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-fits'));
    await fireEvent.press(screen.getByTestId('size-prompt-size-L'));
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'BoughtFits', size: 'L' }),
    );
    await waitFor(() => expect(toast()).toBe('Mavi için bedenin L olarak kaydedildi'));
    expect(trackMock).toHaveBeenCalledWith('size_prompt_answer', {
      promptId: 'sp1',
      answer: 'BoughtFits',
    });
    // The next question takes the card's place, on its first step.
    expect(await screen.findByText('Kargo pantolon')).toBeTruthy();
    expect(screen.getByText('Bunu aldın mı?')).toBeTruthy();
    expect(screen.queryByText('Slim fit gömlek')).toBeNull();
  });

  it('sends the known size when it is left selected', async () => {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-fits'));
    await fireEvent.press(screen.getByTestId('size-prompt-size-save'));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith('sp1', { answer: 'BoughtFits', size: 'M' }),
    );
  });

  it('starts with no size when the known one is not among the offered sizes', async () => {
    listMock.mockResolvedValue({
      prompts: [sizePrompt({ knownSize: { size: 'XXL', source: 'UserEntered', confidence: 1 } })],
    });
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-fits'));

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
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-fits'));

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
  });

  it('goes back to the answers without sending anything', async () => {
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-fits'));
    await fireEvent.press(screen.getByTestId('size-prompt-size-back'));

    expect(screen.getByText('Bunu aldın mı?')).toBeTruthy();
    expect(answerMock).not.toHaveBeenCalled();
  });
});

describe('the other answers send no size', () => {
  it.each([
    ['size-prompt-small', 'BoughtTooSmall', 'Teşekkürler, Mavi için not aldık'],
    ['size-prompt-large', 'BoughtTooLarge', 'Teşekkürler, Mavi için not aldık'],
    ['size-prompt-not-bought', 'NotBought', 'Tamam, teşekkürler'],
    ['size-prompt-never', 'NeverAsk', 'Tamam, bu ürün için bir daha sormayacağız'],
  ])('%s sends %s at once and confirms it', async (testID, answer, line) => {
    listMock.mockResolvedValue({ prompts: [first] });
    answerMock.mockResolvedValue({ answer: answer as never, sizeEntry: null });
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId(testID));

    await waitFor(() => expect(answerMock).toHaveBeenCalledWith('sp1', { answer, size: null }));
    await waitFor(() => expect(toast()).toBe(line));
    expect(trackMock).toHaveBeenCalledWith('size_prompt_answer', { promptId: 'sp1', answer });
    // Nothing else is open, so the card leaves.
    await waitFor(() => expect(screen.queryByTestId('size-prompt-card')).toBeNull());
  });
});

describe('when the answer does not go through', () => {
  it('drops the card silently and asks again on a 409', async () => {
    listMock.mockResolvedValueOnce({ prompts: [first] }).mockResolvedValue({ prompts: [] });
    answerMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Profile.SizePromptAnswered', correlationId: 'c' }),
    );
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-not-bought'));

    await waitFor(() => expect(screen.queryByTestId('size-prompt-card')).toBeNull());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    // No message of any kind.
    expect(toast()).toBeNull();
    expect(screen.queryByTestId('size-prompt-error')).toBeNull();
    expect(trackMock).not.toHaveBeenCalledWith('size_prompt_answer', expect.anything());
  });

  it('keeps the card and shows the error line on any other error, then lets the user try again', async () => {
    answerMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    await renderWithQuery(<SizePromptCard />);
    await fireEvent.press(await screen.findByTestId('size-prompt-small'));

    expect(await screen.findByTestId('size-prompt-error')).toHaveTextContent(
      'Lütfen biraz sonra tekrar dene.',
    );
    expect(screen.getByTestId('size-prompt-card')).toBeTruthy();
    expect(screen.getByText('Slim fit gömlek')).toBeTruthy();
    expect(toast()).toBeNull();

    await fireEvent.press(screen.getByTestId('size-prompt-small'));
    await waitFor(() => expect(screen.queryByText('Slim fit gömlek')).toBeNull());
    expect(answerMock).toHaveBeenCalledTimes(2);
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

    // Before the server has answered.
    expect(screen.queryByTestId('size-prompt-card')).toBeNull();
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

  it('shows a visitor no switch', async () => {
    await resetSession();
    await renderWithQuery(<ProfileScreen />);

    await screen.findByTestId('profile-sign-in');
    expect(screen.queryByTestId('profile-size-prompts')).toBeNull();
  });
});

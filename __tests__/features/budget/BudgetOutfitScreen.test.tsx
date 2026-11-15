import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { suggestBudgetOutfits, suggestBudgetOutfitsAnonymous } from '@/api/endpoints/budget';
import { dismissOutfit, saveOutfit } from '@/api/endpoints/outfits';
import { listPersonas } from '@/api/endpoints/profile';
import { getWardrobeStats } from '@/api/endpoints/wardrobe';
import { useToastStore } from '@/components/toastStore';
import { BudgetOutfitScreen } from '@/features/budget/BudgetOutfitScreen';

import {
  boughtPiece,
  budgetOutfit,
  budgetOutfits,
  budgetPiece,
  outfit,
  persona,
  wardrobeStats,
} from '../../fixtures';
import { heldOpen, renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/budget');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/profile');
jest.mock('@/api/endpoints/wardrobe');

const signedInMock = jest.mocked(suggestBudgetOutfits);
const anonymousMock = jest.mocked(suggestBudgetOutfitsAnonymous);
const saveMock = jest.mocked(saveOutfit);
const dismissMock = jest.mocked(dismissOutfit);
const statsMock = jest.mocked(getWardrobeStats);
const trackMock = jest.mocked(track);
const openBrowserMock = jest.mocked(WebBrowser.openBrowserAsync);

beforeEach(async () => {
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  jest.mocked(listPersonas).mockResolvedValue({
    items: [persona({ id: 'pe1', name: 'Ofis', isActive: true })],
  });
  statsMock.mockResolvedValue(wardrobeStats());
  signedInMock.mockResolvedValue(budgetOutfits());
  anonymousMock.mockResolvedValue(budgetOutfits());
});

/** Types an amount into the open sheet and presses "Kombinleri göster". */
async function ask(amount: string) {
  await fireEvent.changeText(await screen.findByTestId('budget-amount'), amount);
  await fireEvent.press(screen.getByTestId('budget-submit'));
}

describe('the sheet, as a visitor', () => {
  it('asks for the audience and never shows the wardrobe', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);

    expect(await screen.findByText('Kimin için?')).toBeTruthy();
    expect(screen.getByText('Kadın')).toBeTruthy();
    expect(screen.getByText('Erkek')).toBeTruthy();
    expect(screen.getByText('Unisex')).toBeTruthy();
    expect(screen.queryByText('Dolabımı kullan')).toBeNull();
    // "Ayakkabım var" is a preference, not the wardrobe: a visitor may still say it.
    expect(screen.getByText('Ayakkabım var')).toBeTruthy();
    expect(screen.getByText('Gece')).toBeTruthy();
    expect(screen.queryByText('Akşam')).toBeNull();
  });

  it('says what is wrong next to the field and sends nothing', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await fireEvent.press(await screen.findByTestId('budget-submit'));

    expect(screen.getByText('Bütçe 100 ile 100.000 ₺ arasında olmalı')).toBeTruthy();
    expect(screen.getByTestId('budget-audience-error')).toHaveTextContent(
      'Kimin için olduğunu seç',
    );
    expect(anonymousMock).not.toHaveBeenCalled();
    expect(signedInMock).not.toHaveBeenCalled();
  });

  it('refuses an amount under 100 and over 100.000', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await fireEvent.press(await screen.findByTestId('budget-audience-Women'));

    await ask('99');
    expect(screen.getByText('Bütçe 100 ile 100.000 ₺ arasında olmalı')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('budget-amount'), '100001');
    // Six digits are kept: 100001 is still over the ceiling.
    await fireEvent.press(screen.getByTestId('budget-submit'));
    expect(screen.getByText('Bütçe 100 ile 100.000 ₺ arasında olmalı')).toBeTruthy();
    expect(anonymousMock).not.toHaveBeenCalled();
  });

  it('takes a quick amount and sends the anonymous request without a wardrobe', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await fireEvent.press(await screen.findByTestId('budget-quick-2500'));
    await fireEvent.press(screen.getByTestId('budget-audience-Men'));
    await fireEvent.press(screen.getByTestId('budget-occasion-evening'));
    await fireEvent.press(screen.getByTestId('budget-submit'));

    await waitFor(() => expect(anonymousMock).toHaveBeenCalledTimes(1));
    expect(anonymousMock.mock.calls[0]?.[0]).toEqual({
      budget: 2500,
      audience: 'Men',
      occasion: 'evening',
      date: 'today',
      seed: 0,
      count: 3,
      includeShoes: true,
    });
    expect(signedInMock).not.toHaveBeenCalled();
  });

  it('asks a visitor who taps save to sign in, and stores nothing', async () => {
    anonymousMock.mockResolvedValue(
      budgetOutfits({ outfits: [budgetOutfit({ id: null, status: null })] }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await fireEvent.press(await screen.findByTestId('budget-audience-Women'));
    await ask('3000');

    await fireEvent.press(await screen.findByTestId('budget-save'));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('does not offer the size link to a visitor, who has no size map', async () => {
    anonymousMock.mockResolvedValue(
      budgetOutfits({
        outfits: [
          budgetOutfit({
            id: null,
            pieces: [boughtPiece({ size: null, sizeUnknown: true })],
          }),
        ],
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await fireEvent.press(await screen.findByTestId('budget-audience-Women'));
    await ask('3000');

    expect(await screen.findByText('Beden satıcıda seçilir')).toBeTruthy();
    expect(screen.queryByText('Bedenini ekle')).toBeNull();
  });
});

describe('the sheet, signed in', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('offers the wardrobe, on by default, and no audience', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);

    expect(await screen.findByText('Dolabımı kullan')).toBeTruthy();
    expect(screen.getByTestId('budget-use-wardrobe').props.value).toBe(true);
    expect(screen.queryByText('Kimin için?')).toBeNull();
  });

  it('starts "Ayakkabım var" on when the wardrobe has shoes, and sends includeShoes: false', async () => {
    statsMock.mockResolvedValue(
      wardrobeStats({ byCategory: [{ slug: 'ayakkabi/bot', count: 2 }] }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await waitFor(() => expect(screen.getByTestId('budget-have-shoes').props.value).toBe(true));

    await ask('3000');
    await waitFor(() => expect(signedInMock).toHaveBeenCalledTimes(1));
    expect(signedInMock.mock.calls[0]?.[0]).toMatchObject({
      budget: 3000,
      useWardrobe: true,
      includeShoes: false,
      personaId: 'pe1',
      seed: 0,
      count: 3,
    });
  });

  it('starts "Ayakkabım var" off without shoes, and the user can still turn it on or off', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await screen.findByTestId('budget-have-shoes');
    await waitFor(() => expect(statsMock).toHaveBeenCalled());
    expect(screen.getByTestId('budget-have-shoes').props.value).toBe(false);

    await fireEvent(screen.getByTestId('budget-have-shoes'), 'valueChange', true);
    await fireEvent(screen.getByTestId('budget-use-wardrobe'), 'valueChange', false);
    await ask('3000');
    await waitFor(() => expect(signedInMock).toHaveBeenCalledTimes(1));
    expect(signedInMock.mock.calls[0]?.[0]).toMatchObject({
      useWardrobe: false,
      includeShoes: false,
    });
  });

  it('keeps the shoes choice the user made, even when the wardrobe answers later', async () => {
    let answer: (value: ReturnType<typeof wardrobeStats>) => void = () => undefined;
    statsMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await renderWithQuery(<BudgetOutfitScreen />);
    await fireEvent(await screen.findByTestId('budget-have-shoes'), 'valueChange', false);
    answer(wardrobeStats({ byCategory: [{ slug: 'ayakkabi/bot', count: 2 }] }));

    await waitFor(() => expect(statsMock).toHaveBeenCalled());
    await ask('3000');
    await waitFor(() => expect(signedInMock).toHaveBeenCalledTimes(1));
    expect(signedInMock.mock.calls[0]?.[0]).toMatchObject({ includeShoes: true });
  });
});

describe('the outfits', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('shows the total, what is left, "Dolabında var" or the price with the seller', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    const first = (await screen.findAllByTestId('budget-outfit'))[0]!;
    expect(within(first).getByTestId('budget-total')).toHaveTextContent('899 ₺');
    expect(within(first).getByTestId('budget-remaining')).toHaveTextContent(
      'Bütçenden 2.101 ₺ kalır',
    );
    // Two pieces are owned, one is bought.
    expect(within(first).getAllByText('Dolabında var')).toHaveLength(2);
    const buy = within(first).getByTestId('budget-buy-Bottom');
    expect(within(buy).getByText('899 ₺')).toBeTruthy();
    expect(within(buy).getByText(/Trendyol/)).toBeTruthy();
    expect(within(first).getByTestId('budget-size-Bottom')).toHaveTextContent('Beden M');
    expect(screen.getByTestId('budget-summary')).toHaveTextContent('3.000 ₺ · Bugün');
    expect(trackMock).toHaveBeenCalledWith('budget_outfit_view', {
      budgetBand: '1500to5000',
      outfitCount: 2,
      result: 'fits',
    });
    // Not a withoutShoes answer: no tag, no banner.
    expect(screen.queryByTestId('budget-tag-without-shoes')).toBeNull();
    expect(screen.queryByTestId('budget-banner')).toBeNull();
  });

  it("buys only through the offer's goPath", async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    await fireEvent.press((await screen.findAllByTestId('budget-buy-Bottom'))[0]!);
    await waitFor(() => expect(openBrowserMock).toHaveBeenCalledTimes(1));
    expect(openBrowserMock).toHaveBeenCalledWith(
      'http://api.test/api/v1/go/o-bp1?src=budget&personaId=pe1',
    );
    expect(trackMock).toHaveBeenCalledWith('buy_click', { offerId: 'o-bp1', source: 'budget' });
  });

  it('shows the size hint for a piece whose size is unknown, with a way to add it', async () => {
    signedInMock.mockResolvedValue(
      budgetOutfits({
        outfits: [budgetOutfit({ pieces: [boughtPiece({ size: null, sizeUnknown: true })] })],
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    await fireEvent.press(await screen.findByText('Bedenini ekle'));
    expect(router.push).toHaveBeenCalledWith('/profile/sizes');
    expect(screen.queryByTestId('budget-size-Bottom')).toBeNull();
  });

  it('tags a withoutShoes outfit and explains it in one banner whose action reopens the sheet', async () => {
    const message = 'Bu bütçe ayakkabıya yetmedi; ayakkabısız bir kombin hazırladık.';
    signedInMock.mockResolvedValue(
      budgetOutfits({
        withoutShoes: true,
        message,
        outfits: [budgetOutfit({ withoutShoes: true }), budgetOutfit({ withoutShoes: true })],
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('500');

    expect(await screen.findAllByTestId('budget-tag-without-shoes')).toHaveLength(2);
    expect(screen.getAllByText('Ayakkabısız')).toHaveLength(2);
    // One banner above the list, not one per outfit.
    expect(screen.getAllByTestId('budget-banner')).toHaveLength(1);
    expect(screen.getByText(message)).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith('budget_outfit_view', {
      budgetBand: '500to1500',
      outfitCount: 2,
      result: 'withoutShoes',
    });

    expect(screen.queryByText('Bütçeni yaz')).toBeNull();
    await fireEvent.press(screen.getByTestId('budget-banner-increase'));
    expect(await screen.findByText('Bütçeni yaz')).toBeTruthy();
    // The sheet starts from what was asked.
    expect(screen.getByTestId('budget-amount').props.value).toBe('500');
  });

  it('shows only the tag, no banner, when the user said they have shoes', async () => {
    statsMock.mockResolvedValue(
      wardrobeStats({ byCategory: [{ slug: 'ayakkabi/bot', count: 1 }] }),
    );
    signedInMock.mockResolvedValue(
      budgetOutfits({
        withoutShoes: true,
        message: null,
        outfits: [budgetOutfit({ withoutShoes: true })],
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await waitFor(() => expect(screen.getByTestId('budget-have-shoes').props.value).toBe(true));
    await ask('3000');

    expect(await screen.findByTestId('budget-tag-without-shoes')).toBeTruthy();
    expect(screen.queryByTestId('budget-banner')).toBeNull();
    // Asked for: not the engine falling back.
    expect(trackMock).toHaveBeenCalledWith(
      'budget_outfit_view',
      expect.objectContaining({ result: 'fits' }),
    );
  });

  it('marks the one over-budget outfit and offers to raise the budget, with no banner on top', async () => {
    signedInMock.mockResolvedValue(
      budgetOutfits({
        overBudget: true,
        message: 'Bu bütçeyle tam bir kombin çıkmadı; en yakını 3.320 ₺.',
        outfits: [budgetOutfit({ totalPrice: 3320, remainingBudget: -320, overBudgetBy: 320 })],
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    expect(await screen.findAllByTestId('budget-outfit')).toHaveLength(1);
    expect(screen.getByTestId('budget-over')).toHaveTextContent(/Bütçeni 320 ₺ aşıyor/);
    expect(screen.queryByTestId('budget-remaining')).toBeNull();
    expect(screen.queryByTestId('budget-banner')).toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      'budget_outfit_view',
      expect.objectContaining({ result: 'overBudget', outfitCount: 1 }),
    );

    await fireEvent.press(screen.getByTestId('budget-over-increase'));
    expect(await screen.findByText('Bütçeni yaz')).toBeTruthy();
  });

  it('answers an empty result with a plain sentence and the same action', async () => {
    signedInMock.mockResolvedValue(
      budgetOutfits({
        outfits: [],
        message: 'Bu bütçeyle kombin çıkmadı; bütçeni biraz artırmayı dene.',
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('100');

    expect(await screen.findByText('Bu bütçeyle kombin çıkmadı')).toBeTruthy();
    expect(
      screen.getByText('Bu bütçeyle kombin çıkmadı; bütçeni biraz artırmayı dene.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('budget-shuffle')).toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      'budget_outfit_view',
      expect.objectContaining({ result: 'none', outfitCount: 0, budgetBand: 'under500' }),
    );

    await fireEvent.press(screen.getByText('Bütçeyi artır'));
    expect(await screen.findByText('Bütçeni yaz')).toBeTruthy();
  });

  it('asks for the next seed on "Başka göster" and reports it', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');
    await screen.findAllByTestId('budget-outfit');

    await fireEvent.press(screen.getByTestId('budget-shuffle'));
    await waitFor(() => expect(signedInMock).toHaveBeenCalledTimes(2));
    expect(signedInMock.mock.calls[1]?.[0]).toMatchObject({ seed: 1, budget: 3000 });
    expect(trackMock).toHaveBeenCalledWith('budget_outfit_shuffle', { seed: 1 });
    // The first answer was counted once; the new one is its own view.
    await waitFor(() =>
      expect(trackMock.mock.calls.filter(([name]) => name === 'budget_outfit_view')).toHaveLength(
        2,
      ),
    );
  });

  it('loads with a sentence, not a bare spinner', async () => {
    signedInMock.mockReturnValue(heldOpen());
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    expect(await screen.findByText('Bütçene uygun kombinler hazırlanıyor')).toBeTruthy();
  });
});

describe('when the request fails', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('says how long to wait on a 429', async () => {
    signedInMock.mockRejectedValue(
      new ApiError({
        status: 429,
        errorCode: 'RateLimited',
        correlationId: 'c',
        retryAfterSeconds: 120,
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    expect(await screen.findByText('Kombinler yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Çok fazla deneme yaptın. 2 dakika sonra tekrar dene.')).toBeTruthy();
  });

  it('says when the phone is offline, and retries', async () => {
    signedInMock.mockRejectedValueOnce(new ApiError({ status: 0, correlationId: 'c' }));
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    expect(
      await screen.findByText('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(await screen.findAllByTestId('budget-outfit')).toHaveLength(2);
  });

  it('leaves the idle screen with a way forward when the sheet is closed unanswered', async () => {
    await renderWithQuery(<BudgetOutfitScreen />);
    // The header's close button and the sheet's scrim share a label; the scrim is the later one.
    await screen.findByTestId('budget-amount');
    await fireEvent.press(screen.getAllByLabelText('Kapat').at(-1)!);

    expect(await screen.findByText('Ne kadar harcamak istiyorsun?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Bütçeni yaz'));
    expect(await screen.findByTestId('budget-amount')).toBeTruthy();
  });
});

describe('save and dismiss', () => {
  beforeEach(async () => {
    await signedInSession();
  });

  it('saves a signed-in outfit by its id', async () => {
    const first = budgetOutfit({ id: 'bo-save' });
    signedInMock.mockResolvedValue(budgetOutfits({ outfits: [first] }));
    saveMock.mockResolvedValue(
      outfit({ id: 'bo-save', kind: 'Budget', savedAt: '2026-11-15T09:00:00Z' }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    await fireEvent.press(await screen.findByTestId('budget-save'));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith('bo-save'));
    expect(trackMock).toHaveBeenCalledWith('outfit_feedback', { action: 'Save' });
    await waitFor(() =>
      expect(within(screen.getByTestId('budget-save')).getByText('Kaydedildi')).toBeTruthy(),
    );
  });

  it('asks why on dismiss, tells the backend and takes the outfit away', async () => {
    signedInMock.mockResolvedValue(
      budgetOutfits({ outfits: [budgetOutfit({ id: 'bo-a' }), budgetOutfit({ id: 'bo-b' })] }),
    );
    dismissMock.mockResolvedValue(undefined);
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    await fireEvent.press((await screen.findAllByTestId('budget-dismiss'))[0]!);
    await fireEvent.press(await screen.findByTestId('dismiss-TooFormal'));

    await waitFor(() => expect(dismissMock).toHaveBeenCalledWith('bo-a', 'TooFormal'));
    expect(trackMock).toHaveBeenCalledWith('outfit_feedback', {
      action: 'Dismiss',
      reason: 'TooFormal',
    });
    await waitFor(() => expect(screen.getAllByTestId('budget-outfit')).toHaveLength(1));
  });

  it('points at "Başka göster" when every outfit is gone', async () => {
    signedInMock.mockResolvedValue(budgetOutfits({ outfits: [budgetOutfit({ id: 'bo-only' })] }));
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    await fireEvent.press(await screen.findByTestId('budget-dismiss'));
    await fireEvent.press(await screen.findByTestId('dismiss-close'));

    expect(await screen.findByText('Hepsini kaldırdın')).toBeTruthy();
    // "Sadece kapat" tells the backend nothing.
    expect(dismissMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('budget-shuffle')).toBeTruthy();
  });
});

describe('the owned pieces', () => {
  it('say "Dolabında var" and are not a buy link', async () => {
    await signedInSession();
    signedInMock.mockResolvedValue(
      budgetOutfits({
        outfits: [budgetOutfit({ pieces: [budgetPiece()], totalPrice: 0, remainingBudget: 3000 })],
      }),
    );
    await renderWithQuery(<BudgetOutfitScreen />);
    await ask('3000');

    expect(await screen.findByText('Dolabında var')).toBeTruthy();
    expect(screen.queryByTestId('budget-buy-Top')).toBeNull();
  });
});

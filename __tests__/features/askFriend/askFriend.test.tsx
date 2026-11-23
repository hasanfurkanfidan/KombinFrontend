import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { createAsk, getAskConsent } from '@/api/endpoints/askFriend';
import { getDailyOutfit, listSavedOutfits } from '@/api/endpoints/outfits';
import { AskFriendButton } from '@/features/askFriend/AskFriendButton';
import type { AskConsent, AskResponse } from '@/features/askFriend/types';
import { tr } from '@/i18n/tr';

import { dailyOutfit, outfit } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/outfits');

const consentMock = jest.mocked(getAskConsent);
const createMock = jest.mocked(createAsk);
const savedMock = jest.mocked(listSavedOutfits);
const dailyMock = jest.mocked(getDailyOutfit);
const shareSpy = jest.spyOn(Share, 'share');

const CONSENT_TEXT = 'Linki alan herkes fotoğrafları görebilir. (sunucu metni)';
const consent = (overrides: Partial<AskConsent> = {}): AskConsent => ({
  version: '2026-11-v1',
  text: CONSENT_TEXT,
  accepted: false,
  ...overrides,
});

function ask(overrides: Partial<AskResponse> = {}): AskResponse {
  return {
    id: 'ask-1',
    kind: 'Single',
    status: 'Open',
    statusMessage: null,
    url: 'https://api.example.com/sor/abc123',
    shareText: 'Bu kombin olur mu?',
    createdAt: '2026-11-23T08:00:00Z',
    expiresAt: '2026-11-24T08:00:00Z',
    options: [],
    tally: { yes: 0, no: 0, a: 0, b: 0, total: 0 },
    answers: [],
    ...overrides,
  };
}

const problem = (status: number, errorCode: string) =>
  new ApiError({ status, errorCode, correlationId: '00000000-0000-4000-8000-0000000000cc' });

const mine = outfit({ id: 'mine' });

async function openSheet() {
  await renderWithQuery(<AskFriendButton outfit={mine} />);
  fireEvent.press(await screen.findByTestId('ask-friend-button'));
  await screen.findByTestId('ask-share');
}

/** Waits for the consent answer to be in (the share button is enabled), then taps it. */
async function pressShare() {
  await waitFor(() => expect(screen.getByTestId('ask-share')).toBeEnabled());
  fireEvent.press(screen.getByTestId('ask-share'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  shareSpy.mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  consentMock.mockResolvedValue(consent());
  createMock.mockResolvedValue(ask());
});

describe('Arkadaşına sor: visibility', () => {
  it('is hidden when the consent answers 404 AskFriend.Disabled', async () => {
    consentMock.mockRejectedValue(problem(404, 'AskFriend.Disabled'));
    await renderWithQuery(<AskFriendButton outfit={mine} />);
    await waitFor(() => expect(consentMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText(tr.askFriendButton)).toBeNull();
    expect(consentMock).toHaveBeenCalledTimes(1);
  });

  it('is shown when the consent answers 200', async () => {
    await renderWithQuery(<AskFriendButton outfit={mine} />);
    expect(await screen.findByText(tr.askFriendButton)).toBeTruthy();
  });
});

describe('Arkadaşına sor: consent text', () => {
  it('shows the server text while accepted is false', async () => {
    await openSheet();
    expect(await screen.findByText(CONSENT_TEXT)).toBeTruthy();
  });

  it('does not show the text once accepted is true', async () => {
    consentMock.mockResolvedValue(consent({ accepted: true }));
    await openSheet();
    await waitFor(() => expect(screen.getByTestId('ask-share')).toBeEnabled());
    expect(screen.queryByText(CONSENT_TEXT)).toBeNull();
    expect(screen.queryByTestId('ask-consent-text')).toBeNull();
  });
});

describe('Arkadaşına sor: create and share', () => {
  it('creates the ask with outfitIds and consentVersion, then shares shareText + newline + url', async () => {
    await openSheet();
    await pressShare();

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(createMock).toHaveBeenCalledWith({ outfitIds: ['mine'], consentVersion: '2026-11-v1' });
    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Bu kombin olur mu?\nhttps://api.example.com/sor/abc123',
    });
    expect(track).toHaveBeenCalledWith('ask_create', { askId: 'ask-1', kind: 'Single' });
    await waitFor(() => expect(track).toHaveBeenCalledWith('ask_share', { askId: 'ask-1' }));
  });

  it('tracks ask_create but not ask_share when the share sheet is dismissed', async () => {
    shareSpy.mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await openSheet();
    await pressShare();

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    await act(async () => {});
    expect(track).toHaveBeenCalledWith('ask_create', { askId: 'ask-1', kind: 'Single' });
    expect(track).not.toHaveBeenCalledWith('ask_share', expect.anything());
  });

  it('adding a second outfit makes it "Hangisi?" and sends two outfitIds', async () => {
    const other = outfit({ id: 'other' });
    dailyMock.mockResolvedValue(dailyOutfit({ outfit: mine }));
    savedMock.mockResolvedValue({ items: [other], page: 1, pageSize: 20, totalCount: 1 } as never);
    createMock.mockResolvedValue(ask({ kind: 'Pair', shareText: 'Hangisi?' }));

    await openSheet();
    expect(screen.getByText(tr.askQuestionSingle)).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-add-second'));
    fireEvent.press(await screen.findByTestId('ask-pick-other'));

    expect(await screen.findByText(tr.askQuestionPair)).toBeTruthy();
    await pressShare();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock).toHaveBeenCalledWith({
      outfitIds: ['mine', 'other'],
      consentVersion: '2026-11-v1',
    });
    expect(track).toHaveBeenCalledWith('ask_create', { askId: 'ask-1', kind: 'Pair' });
  });
});

describe('Arkadaşına sor: error lines', () => {
  const cases: [string, number, string, string][] = [
    ['403 AgeRestricted', 403, 'AskFriend.AgeRestricted', tr.askErrorAge],
    ['409 ConsentRequired', 409, 'AskFriend.ConsentRequired', tr.askErrorConsent],
    ['409 NothingToShow', 409, 'AskFriend.NothingToShow', tr.askErrorNothingToShow],
    ['409 DailyLimit', 409, 'AskFriend.DailyLimit', tr.askErrorDailyLimit],
    ['503 StorageUnavailable', 503, 'AskFriend.StorageUnavailable', tr.askErrorStorage],
  ];

  it.each(cases)(
    '%s renders its Turkish line and does not share',
    async (_n, status, code, line) => {
      createMock.mockRejectedValue(problem(status, code));
      await openSheet();
      await pressShare();

      expect(await screen.findByText(line)).toBeTruthy();
      expect(shareSpy).not.toHaveBeenCalled();
      expect(track).not.toHaveBeenCalledWith('ask_create', expect.anything());
    },
  );

  it('409 ConsentRequired fetches the consent again', async () => {
    createMock.mockRejectedValue(problem(409, 'AskFriend.ConsentRequired'));
    await openSheet();
    await pressShare();

    await screen.findByText(tr.askErrorConsent);
    await waitFor(() => expect(consentMock).toHaveBeenCalledTimes(2));
  });
});

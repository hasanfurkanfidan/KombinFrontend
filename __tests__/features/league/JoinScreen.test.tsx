import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { getLeagueMe, joinLeague } from '@/api/endpoints/league';
import { useToastStore } from '@/components/toastStore';
import { JoinScreen } from '@/features/league/JoinScreen';

import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { CONSENT_TEXT, CONSENT_VERSION, leagueMe, notJoined } from './fixtures';

const meMock = jest.mocked(getLeagueMe);
const joinMock = jest.mocked(joinLeague);

beforeEach(async () => {
  jest.clearAllMocks();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  meMock.mockResolvedValue(notJoined());
  joinMock.mockResolvedValue(leagueMe());
});

describe('join (design 01)', () => {
  it('shows the three steps and the consent text exactly as the server sent it', async () => {
    await renderWithQuery(<JoinScreen />);

    expect(await screen.findByText('Bugünkü kombinin yarışsın.')).toBeTruthy();
    expect(screen.getByText('Kombinin isimsiz olarak başkalarına gösterilir.')).toBeTruthy();
    expect(screen.getByText('Sen de on çift kombine oy verirsin.')).toBeTruthy();
    expect(screen.getByText("Akşam 21:00'de kaçıncı olduğunu görürsün.")).toBeTruthy();
    // The text is whatever the server holds: the screen carries none of its own.
    expect(screen.getByTestId('join-consent')).toHaveTextContent(CONSENT_TEXT);
    expect(screen.getByText('Lige katıl')).toBeTruthy();
    expect(screen.getByText('Şimdi değil')).toBeTruthy();
  });

  it('shows a different text when the server has a different one', async () => {
    meMock.mockResolvedValue(
      notJoined({ consent: { version: '2027-01-v3', text: 'Yepyeni bir metin.' } }),
    );
    await renderWithQuery(<JoinScreen />);

    expect(await screen.findByText('Yepyeni bir metin.')).toBeTruthy();
    expect(screen.queryByText(CONSENT_TEXT)).toBeNull();
  });

  it('joins with the version that is on screen, then opens the league home', async () => {
    meMock.mockResolvedValue(notJoined({ consent: { version: '2027-01-v3', text: 'Metin.' } }));
    await renderWithQuery(<JoinScreen />);

    await fireEvent.press(await screen.findByTestId('join-submit'));

    await waitFor(() => expect(joinMock).toHaveBeenCalledTimes(1));
    expect(joinMock.mock.calls[0]?.[0]).toBe('2027-01-v3');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/league'));
    expect(useToastStore.getState().message).toBe("Kombin Ligi'ne katıldın");
  });

  it('"Şimdi değil" closes and joins nothing', async () => {
    await renderWithQuery(<JoinScreen />);

    await fireEvent.press(await screen.findByTestId('join-later'));

    expect(joinMock).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('asks a player who joined under the old text to accept the new one', async () => {
    meMock.mockResolvedValue(
      leagueMe({ consentRequired: true, consent: { version: '2026-11-v3', text: 'Yeni metin.' } }),
    );
    await renderWithQuery(<JoinScreen />);

    expect(await screen.findByText('Katılım metni güncellendi.')).toBeTruthy();
    expect(screen.getByText('Yeni metin.')).toBeTruthy();
    expect(screen.queryByText('Lige katıl')).toBeNull();
    // The three steps are for someone who has never seen the league.
    expect(screen.queryByText('Sen de on çift kombine oy verirsin.')).toBeNull();

    await fireEvent.press(screen.getByText('Yeniden onayla'));

    await waitFor(() => expect(joinMock).toHaveBeenCalledWith('2026-11-v3'));
  });

  it('shows the server’s own message when the player is too young to join, and stays', async () => {
    joinMock.mockRejectedValue(
      new ApiError({
        status: 403,
        errorCode: 'League.AgeRestricted',
        detail: 'Lige yalnızca 18 yaşından büyükler katılabilir.',
        correlationId: 'x',
      }),
    );
    await renderWithQuery(<JoinScreen />);

    await fireEvent.press(await screen.findByTestId('join-submit'));

    expect(await screen.findByTestId('join-error')).toHaveTextContent(
      'Lige yalnızca 18 yaşından büyükler katılabilir.',
    );
    expect(router.replace).not.toHaveBeenCalled();
    // The button is usable again.
    expect(screen.getByTestId('join-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('reloads the text when the version moved on while the screen was open', async () => {
    joinMock.mockRejectedValue(
      new ApiError({ status: 400, errorCode: 'League.ConsentVersionInvalid', correlationId: 'x' }),
    );
    await renderWithQuery(<JoinScreen />);
    const submit = await screen.findByTestId('join-submit');

    // By the time the join is refused, the server already has the newer text.
    meMock.mockResolvedValue(notJoined({ consent: { version: '2026-11-v9', text: 'Daha yeni.' } }));
    await fireEvent.press(submit);

    expect(
      await screen.findByText('Katılım metni güncellendi. Yeni metni oku ve tekrar onayla.'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Daha yeni.')).toBeTruthy());
  });

  it('says it plainly for any other failure, and for a rate limit', async () => {
    joinMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'x' }));
    await renderWithQuery(<JoinScreen />);
    await fireEvent.press(await screen.findByTestId('join-submit'));
    expect(await screen.findByText('Lige katılamadık, tekrar dene.')).toBeTruthy();

    joinMock.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        errorCode: 'RateLimited',
        retryAfterSeconds: 30,
        correlationId: 'x',
      }),
    );
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(
      await screen.findByText('Çok fazla deneme yaptın. 30 saniye sonra tekrar dene.'),
    ).toBeTruthy();
  });

  it('has nothing to join when there is no league', async () => {
    meMock.mockResolvedValue(null);
    await renderWithQuery(<JoinScreen />);

    expect(await screen.findByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(screen.queryByText('Lige katıl')).toBeNull();
  });

  it('knows the version it sends is the one from /league/me', () => {
    expect(CONSENT_VERSION).toBe(leagueMe().consent.version);
  });
});

import { screen } from '@testing-library/react-native';

import { ApiError, request } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { ErrorState } from '@/components/ErrorState';
import { useSessionStore } from '@/session/sessionStore';
import { rateLimitMessage } from '@/utils/rateLimit';

import {
  problem,
  renderWithQuery,
  reply,
  resetSession,
  signedInSession,
  tokens,
} from '../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
});

describe('429 in the client', () => {
  it('carries Retry-After on the ApiError', async () => {
    fetchMock.mockResolvedValue(
      reply(
        429,
        { status: 429, title: 'Too many', detail: 'slow down', errorCode: 'RateLimited' },
        { 'Retry-After': '90' },
      ),
    );

    const error = await request('/api/v1/auth/login', { method: 'POST', body: {} }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, errorCode: 'RateLimited', retryAfterSeconds: 90 });
    expect((error as ApiError).isRateLimited).toBe(true);
  });

  it('has no retryAfterSeconds without the header (or with a date)', async () => {
    fetchMock.mockResolvedValueOnce(problem(429, 'RateLimited'));
    fetchMock.mockResolvedValueOnce(
      reply(429, { errorCode: 'RateLimited' }, { 'Retry-After': 'Fri, 21 Nov 2026 12:00:00 GMT' }),
    );

    const first = (await request('/x').catch((caught: unknown) => caught)) as ApiError;
    const second = (await request('/x').catch((caught: unknown) => caught)) as ApiError;

    expect(first.retryAfterSeconds).toBeNull();
    expect(second.retryAfterSeconds).toBeNull();
    expect(first.isRateLimited).toBe(true);
  });

  it('does not retry a 429: the default query retry gives up at once', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: Error,
    ) => boolean;
    const limited = new ApiError({ status: 429, errorCode: 'RateLimited', correlationId: 'c' });
    const unavailable = new ApiError({ status: 503, correlationId: 'c' });

    expect(retry(0, limited)).toBe(false);
    // A 5xx is still worth another attempt, so the rule above is the 429 and not "never retry".
    expect(retry(0, unavailable)).toBe(true);
  });

  it('sends exactly one request when a 429 comes back', async () => {
    fetchMock.mockResolvedValue(problem(429, 'RateLimited'));

    await expect(request('/x')).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not end the session when the refresh itself is rate limited', async () => {
    await signedInSession('old', 10);
    fetchMock.mockResolvedValueOnce(problem(429, 'RateLimited'));

    await expect(request('/api/v1/me', { auth: true })).rejects.toMatchObject({ status: 429 });

    expect(useSessionStore.getState().status).toBe('signedIn');
    fetchMock.mockResolvedValueOnce(reply(200, tokens('new')));
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    await expect(request('/api/v1/me', { auth: true })).resolves.toEqual({ ok: true });
  });
});

describe('rateLimitMessage', () => {
  it.each([
    [1, 'Çok fazla deneme yaptın. 1 saniye sonra tekrar dene.'],
    [45, 'Çok fazla deneme yaptın. 45 saniye sonra tekrar dene.'],
    [59, 'Çok fazla deneme yaptın. 59 saniye sonra tekrar dene.'],
    [60, 'Çok fazla deneme yaptın. 1 dakika sonra tekrar dene.'],
    [61, 'Çok fazla deneme yaptın. 2 dakika sonra tekrar dene.'],
    [600, 'Çok fazla deneme yaptın. 10 dakika sonra tekrar dene.'],
    [null, 'Çok fazla deneme yaptın. Biraz sonra tekrar dene.'],
  ])('%s s -> %s', (seconds, text) => {
    expect(rateLimitMessage(seconds)).toBe(text);
  });
});

describe('ErrorState with a 429', () => {
  it('replaces the body with the rate-limit sentence and keeps the retry button', async () => {
    const error = new ApiError({
      status: 429,
      errorCode: 'RateLimited',
      retryAfterSeconds: 120,
      correlationId: 'c',
    });

    await renderWithQuery(<ErrorState body="Özel mesaj" error={error} onRetry={jest.fn()} />);

    expect(screen.getByText('Çok fazla deneme yaptın. 2 dakika sonra tekrar dene.')).toBeTruthy();
    expect(screen.queryByText('Özel mesaj')).toBeNull();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('keeps the screen own body for any other error', async () => {
    await renderWithQuery(
      <ErrorState body="Özel mesaj" error={new ApiError({ status: 500, correlationId: 'c' })} />,
    );

    expect(screen.getByText('Özel mesaj')).toBeTruthy();
  });
});

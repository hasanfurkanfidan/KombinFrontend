import { ApiError } from '@/api/client';
import type * as LeagueEndpoints from '@/api/endpoints/league';

import { API, authHeader, problem, reply, resetSession, signedInSession } from '../../testUtils';
import { leagueMe, nextPair, results, table, voteResult, PAIR_ID } from './fixtures';

// The suite mocks the league endpoints globally (see jest.setup.ts); this file tests the real ones.
const league = jest.requireActual<typeof LeagueEndpoints>('@/api/endpoints/league');

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
  await signedInSession();
});

describe('the league is off on the server: 404 means "no league"', () => {
  it('answers null for GET /league/me, whatever the error code, instead of throwing', async () => {
    fetchMock.mockResolvedValue(problem(404, 'League.Disabled'));
    await expect(league.getLeagueMe()).resolves.toBeNull();
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/me`);
    expect(authHeader(lastCall())).toBe('Bearer access-old');

    fetchMock.mockResolvedValue(problem(404, 'Something.Else'));
    await expect(league.getLeagueMe()).resolves.toBeNull();
  });

  it('still throws every other failure (offline, 5xx, 401 is the client’s own business)', async () => {
    fetchMock.mockResolvedValue(problem(500, 'Server.Error'));
    await expect(league.getLeagueMe()).rejects.toBeInstanceOf(ApiError);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(league.getLeagueMe()).rejects.toMatchObject({ status: 0 });
  });

  it('returns the state when the league is on', async () => {
    fetchMock.mockResolvedValue(reply(200, leagueMe()));
    await expect(league.getLeagueMe()).resolves.toMatchObject({ joined: true, tier: 'Gold' });
  });
});

describe('the other routes', () => {
  it('joins with the version that was shown', async () => {
    fetchMock.mockResolvedValue(reply(200, leagueMe()));
    await league.joinLeague('2026-11-v2');
    const [url, init] = lastCall();
    expect(url).toBe(`${API}/api/v1/league/join`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ consentVersion: '2026-11-v2' });
  });

  it('leaves, and withdraws today’s outfit with DELETE /league/me/entry', async () => {
    fetchMock.mockResolvedValue(reply(204));
    await league.leaveLeague();
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/leave`);
    expect(lastCall()[1].method).toBe('POST');
    await league.withdrawLeagueEntry();
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/me/entry`);
    expect(lastCall()[1].method).toBe('DELETE');
  });

  it('asks for the next pair', async () => {
    fetchMock.mockResolvedValue(reply(200, nextPair()));
    await league.getNextPair();
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/pairs/next`);
  });

  it('votes with the choice and the measured time, and reports with the side', async () => {
    fetchMock.mockResolvedValue(reply(200, voteResult()));
    await league.voteOnPair(PAIR_ID, { choice: 'left', decisionMs: 1234 });
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/pairs/${PAIR_ID}/vote`);
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({ choice: 'left', decisionMs: 1234 });

    fetchMock.mockResolvedValue(reply(202, { reported: true }));
    await league.reportPair(PAIR_ID, { side: 'right', reason: 'Inappropriate' });
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/pairs/${PAIR_ID}/report`);
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({
      side: 'right',
      reason: 'Inappropriate',
    });
  });

  it('asks for the latest result, or for one day', async () => {
    fetchMock.mockResolvedValue(reply(200, results()));
    await league.getLeagueResults(null);
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/results/latest`);
    await league.getLeagueResults('2026-11-02');
    expect(lastCall()[0]).toBe(`${API}/api/v1/league/results?day=2026-11-02`);
  });

  it('turns "no result yet" and an invalid day into null, and fails on anything else', async () => {
    fetchMock.mockResolvedValue(problem(404, 'League.ResultsNotReady'));
    await expect(league.getLeagueResults(null)).resolves.toBeNull();
    fetchMock.mockResolvedValue(problem(400, 'League.InvalidDay'));
    await expect(league.getLeagueResults('2026-02-30')).resolves.toBeNull();
    fetchMock.mockResolvedValue(problem(500, 'Server.Error'));
    await expect(league.getLeagueResults(null)).rejects.toBeInstanceOf(ApiError);
  });

  it('turns "no group yet" into null, but not a missing league or a player who is not in', async () => {
    fetchMock.mockResolvedValue(reply(200, table()));
    await expect(league.getLeagueTable()).resolves.toMatchObject({ tier: 'Gold' });
    fetchMock.mockResolvedValue(problem(404, 'League.NoGroup'));
    await expect(league.getLeagueTable()).resolves.toBeNull();
    fetchMock.mockResolvedValue(problem(403, 'League.NotJoined'));
    await expect(league.getLeagueTable()).rejects.toMatchObject({ status: 403 });
    fetchMock.mockResolvedValue(problem(404, 'League.Disabled'));
    await expect(league.getLeagueTable()).rejects.toMatchObject({ status: 404 });
  });
});

import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { resetUserScopedState } from '@/session/userScope';

import { leagueMe, nextPair, results, table } from './fixtures';

describe('the league belongs to the account', () => {
  it('keeps every league query under one root', () => {
    expect(queryKeys.leagueMe[0]).toBe('league');
    expect(queryKeys.leaguePair(3)[0]).toBe('league');
    expect(queryKeys.leagueResults(null)[0]).toBe('league');
    expect(queryKeys.leagueResults('2026-11-02')[0]).toBe('league');
    expect(queryKeys.leagueTable[0]).toBe('league');
    expect(queryKeys.leagueAll).toEqual(['league']);
  });

  it('forgets all of it when the session ends or the account changes', () => {
    queryClient.setQueryData(queryKeys.leagueMe, leagueMe());
    queryClient.setQueryData(queryKeys.leaguePair(0), nextPair());
    queryClient.setQueryData(queryKeys.leagueResults(null), results());
    queryClient.setQueryData(queryKeys.leagueTable, table());
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.leagueAll })).toHaveLength(4);

    resetUserScopedState();

    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.leagueAll })).toHaveLength(0);
    expect(queryClient.getQueryData(queryKeys.leagueMe)).toBeUndefined();
  });

  it('keeps the "no league" answer as data (null), so Keşfet does not ask again at every look', () => {
    queryClient.setQueryData(queryKeys.leagueMe, null);
    expect(queryClient.getQueryData(queryKeys.leagueMe)).toBeNull();
    resetUserScopedState();
    expect(queryClient.getQueryData(queryKeys.leagueMe)).toBeUndefined();
  });
});

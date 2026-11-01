import * as SecureStore from 'expo-secure-store';

import { applyAuthTokens, endSession, useSessionStore } from '@/session/sessionStore';

import { resetSession, tokens } from '../testUtils';

beforeEach(async () => {
  await resetSession();
});

describe('sessionStore', () => {
  it('starts in booting with no credentials', () => {
    expect(useSessionStore.getState()).toMatchObject({
      status: 'booting',
      accessToken: null,
      expiresAt: null,
      endReason: null,
    });
  });

  it('turns expiresIn seconds into an absolute expiry', () => {
    useSessionStore.getState().setSignedIn('token', 900, 1_000_000);

    expect(useSessionStore.getState()).toMatchObject({
      status: 'signedIn',
      accessToken: 'token',
      expiresAt: 1_000_000 + 900_000,
    });
  });

  it('signing out drops the token and records why', () => {
    useSessionStore.getState().setSignedIn('token', 900);
    useSessionStore.getState().setSignedOut('expired');

    expect(useSessionStore.getState()).toMatchObject({
      status: 'signedOut',
      accessToken: null,
      expiresAt: null,
      endReason: 'expired',
    });

    useSessionStore.getState().clearEndReason();
    expect(useSessionStore.getState().endReason).toBeNull();
  });

  it('applyAuthTokens keeps the refresh token in secure storage and the access token in memory', async () => {
    await applyAuthTokens({ ...tokens('a'), expiresIn: '900' });

    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBe('refresh-a');
    const state = useSessionStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.accessToken).toBe('access-a');
    expect(state.expiresAt).toBeGreaterThan(Date.now() + 800_000);
  });

  it('endSession wipes both tokens, with no end reason for a voluntary logout', async () => {
    await applyAuthTokens(tokens('a'));

    await endSession();

    expect(await SecureStore.getItemAsync('kombin.refreshToken')).toBeNull();
    expect(useSessionStore.getState()).toMatchObject({
      status: 'signedOut',
      accessToken: null,
      endReason: null,
    });
  });

  it('never writes the access token to secure storage', async () => {
    await applyAuthTokens(tokens('a'));

    const writes = (SecureStore.setItemAsync as jest.Mock).mock.calls.map(([, value]) => value);
    expect(writes).not.toContain('access-a');
  });
});

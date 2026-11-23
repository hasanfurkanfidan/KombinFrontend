import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { cancelBulkBatch, confirmBulkBatch, probeBulkAvailable } from '@/api/endpoints/bulkAdd';
import { useBulkStore } from '@/features/bulkAdd/bulkStore';
import { BulkEntry } from '@/features/bulkAdd/BulkEntry';
import { markBulkUnavailable } from '@/features/bulkAdd/hooks';
import { queryKeys } from '@/api/queryKeys';
import { resetUserScopedState } from '@/session/userScope';

import {
  API,
  authHeader,
  problem,
  renderWithQuery,
  reply,
  resetSession,
  signedInSession,
} from '../../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

beforeEach(async () => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
});

describe('probeBulkAvailable', () => {
  it('asks for a batch that cannot exist, with the token', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(404, 'Wardrobe.BulkNotFound'));
    await expect(probeBulkAvailable()).resolves.toBe(true);
    const [url] = fetchMock.mock.calls[0] ?? [''];
    expect(url).toBe(`${API}/api/v1/me/wardrobe/bulk/00000000-0000-0000-0000-000000000000`);
    expect(authHeader(fetchMock.mock.calls[0] as unknown[])).toBe('Bearer access-old');
  });

  it('is false for 404 Wardrobe.BulkDisabled', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(404, 'Wardrobe.BulkDisabled'));
    await expect(probeBulkAvailable()).resolves.toBe(false);
  });

  it('is false for a plain 404, a 5xx and a network error, never a throw', async () => {
    await signedInSession();
    fetchMock.mockResolvedValueOnce(reply(404, { status: 404 }));
    await expect(probeBulkAvailable()).resolves.toBe(false);
    fetchMock.mockResolvedValueOnce(problem(500, 'Server.Error'));
    await expect(probeBulkAvailable()).resolves.toBe(false);
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(probeBulkAvailable()).resolves.toBe(false);
  });
});

describe('BulkEntry ("Toplu ekle" in Dolap)', () => {
  it('shows one "Toplu ekle" action that opens the screen when the probe says 404 BulkNotFound', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(404, 'Wardrobe.BulkNotFound'));
    await renderWithQuery(<BulkEntry />);

    const entry = await screen.findByText('Toplu ekle');
    expect(screen.getAllByText('Toplu ekle')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Toplu ekle' })).toBeTruthy();
    await fireEvent.press(entry);
    expect(router.push).toHaveBeenCalledWith('/wardrobe/bulk');
  });

  it('is absent, without an error, when the routes answer 404 Wardrobe.BulkDisabled', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(404, 'Wardrobe.BulkDisabled'));
    await renderWithQuery(<BulkEntry />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Toplu ekle')).toBeNull();
  });

  it('is absent on a 5xx', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(503, 'Server.Unavailable'));
    await renderWithQuery(<BulkEntry />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Toplu ekle')).toBeNull();
  });

  it('is never asked for a visitor', async () => {
    fetchMock.mockResolvedValue(problem(404, 'Wardrobe.BulkNotFound'));
    await renderWithQuery(<BulkEntry />);

    expect(screen.queryByText('Toplu ekle')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disappears at once when a route later answers BulkDisabled', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(404, 'Wardrobe.BulkNotFound'));
    const view = await renderWithQuery(<BulkEntry />);
    await screen.findByText('Toplu ekle');

    markBulkUnavailable(view.client);
    await waitFor(() => expect(screen.queryByText('Toplu ekle')).toBeNull());
    expect(view.client.getQueryData(queryKeys.bulkAvailable)).toBe(false);
  });
});

describe('bulk store', () => {
  it('forgets the advice flag at sign-out (resetUserScopedState)', () => {
    useBulkStore.getState().markAdviceSeen();
    expect(useBulkStore.getState().adviceSeen).toBe(true);
    resetUserScopedState();
    expect(useBulkStore.getState().adviceSeen).toBe(false);
  });
});

describe('confirmBulkBatch and cancelBulkBatch', () => {
  it('POSTs the ticked pieces with the token and returns the confirmed batch', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(reply(200, { id: 'b1', status: 'Confirmed', items: [] }));
    const body = {
      pieces: [
        { id: 'p1', categorySlug: null, primaryColor: 'Red', secondaryColor: null, clear: null },
      ],
    };
    await expect(confirmBulkBatch('b1', body)).resolves.toMatchObject({ status: 'Confirmed' });
    const [url, init] = fetchMock.mock.calls[0] ?? ['', {}];
    expect(url).toBe(`${API}/api/v1/me/wardrobe/bulk/b1/confirm`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(authHeader(fetchMock.mock.calls[0] as unknown[])).toBe('Bearer access-old');
  });

  it('DELETEs the batch and accepts the empty 204', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(reply(204));
    await expect(cancelBulkBatch('b1')).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] ?? ['', {}];
    expect(url).toBe(`${API}/api/v1/me/wardrobe/bulk/b1`);
    expect(init.method).toBe('DELETE');
  });

  it('turns a confirm 409 into an ApiError carrying the code and the sentence', async () => {
    await signedInSession();
    fetchMock.mockResolvedValue(problem(409, 'Wardrobe.BulkNotReady'));
    await expect(confirmBulkBatch('b1', { pieces: [] })).rejects.toMatchObject({
      status: 409,
      errorCode: 'Wardrobe.BulkNotReady',
    });
  });
});

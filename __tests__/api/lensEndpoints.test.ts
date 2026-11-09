import { File as FsFile } from 'expo-file-system';

import { searchLens } from '@/api/endpoints/lens';

import { lensSearch } from '../fixtures';
import { API, authHeader, reply, resetSession, signedInSession } from '../testUtils';

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
const appendSpy = jest.spyOn(FormData.prototype, 'append');

beforeEach(async () => {
  fetchMock.mockReset();
  appendSpy.mockClear();
  fetchMock.mockResolvedValue(reply(200, lensSearch()));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await resetSession();
});

const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];

describe('lens endpoint', () => {
  it('posts the photo as an expo-file-system File in the multipart field "image"', async () => {
    await searchLens({ uri: 'file:///cache/ImageManipulator/abc.jpg', signedIn: false });

    const [url, init] = lastCall();
    expect(url).toBe(`${API}/api/v1/lens/search`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    // Jest's FormData is Node's, which stringifies a non-Blob part, so the appended value is read from `append`.
    // `expo/fetch` (the SDK 58 global fetch) rejects React Native's `{ uri, name, type }` object: the part must be a File.
    const [field, part] = appendSpy.mock.calls.at(-1) as [string, unknown];
    expect(field).toBe('image');
    expect(part).toBeInstanceOf(FsFile);
    expect(part).toMatchObject({
      uri: 'file:///cache/ImageManipulator/abc.jpg',
      name: 'abc.jpg',
      type: 'image/jpeg',
    });
    // No JSON content type: fetch writes the multipart boundary itself.
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(authHeader(lastCall())).toBeUndefined();
  });

  it('sends audience=all and the bearer token when asked', async () => {
    await signedInSession();
    await searchLens({ uri: 'file:///x.jpg', audience: 'all', signedIn: true });

    expect(lastCall()[0]).toBe(`${API}/api/v1/lens/search?audience=all`);
    expect(authHeader(lastCall())).toBe('Bearer access-old');
  });
});

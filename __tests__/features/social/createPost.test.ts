import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { ApiError } from '@/api/client';
import { createPostUploadUrl, getPost, processPost } from '@/api/endpoints/social';
import { putPhoto } from '@/api/endpoints/wardrobe';
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  isConsentRequired,
  uploadPostPhoto,
  watchPost,
} from '@/features/social/createPost';

import { post } from '../../fixtures';

jest.mock('@/api/endpoints/social');
jest.mock('@/api/endpoints/wardrobe');

const uploadUrlMock = jest.mocked(createPostUploadUrl);
const putMock = jest.mocked(putPhoto);
const processMock = jest.mocked(processPost);
const getMock = jest.mocked(getPost);
const manipulate = jest.mocked(ImageManipulator.manipulateAsync);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('uploadPostPhoto', () => {
  it('re-encodes to JPEG on the phone, then upload-url, PUT with exactly the returned headers, then process', async () => {
    uploadUrlMock.mockResolvedValue({
      postId: 'post-7',
      uploadUrl: 'http://storage.test/put?sig=1',
      headers: { 'Content-Type': 'image/jpeg', 'x-amz-meta': 'a' },
      expiresAt: '2026-11-07T10:15:00Z',
    });
    putMock.mockResolvedValue(undefined);
    processMock.mockResolvedValue({ postId: 'post-7', status: 'Processing' });

    const postId = await uploadPostPhoto({ uri: 'file:///photo.heic', width: 4000, height: 3000 });

    expect(postId).toBe('post-7');
    // HEIC in, JPEG out (the re-encode also drops EXIF): the original file is never uploaded.
    expect(manipulate).toHaveBeenCalledWith(
      'file:///photo.heic',
      [{ resize: { width: 1600 } }],
      expect.objectContaining({ format: 'jpeg' }),
    );
    expect(uploadUrlMock).toHaveBeenCalledWith({ contentType: 'image/jpeg', sizeBytes: 321_000 });
    expect(putMock).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadUrl: 'http://storage.test/put?sig=1',
        headers: { 'Content-Type': 'image/jpeg', 'x-amz-meta': 'a' },
      }),
      'file:///photo.heic#resized',
    );
    expect(processMock).toHaveBeenCalledWith('post-7');
    expect(processMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      putMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('stops before the PUT when the consent is missing, and recognises that refusal', async () => {
    const refusal = new ApiError({
      status: 403,
      errorCode: 'Social.ConsentRequired',
      correlationId: 'c',
    });
    uploadUrlMock.mockRejectedValue(refusal);

    await expect(uploadPostPhoto({ uri: 'file:///p.jpg' })).rejects.toBe(refusal);

    expect(putMock).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
    expect(isConsentRequired(refusal)).toBe(true);
    expect(isConsentRequired(new ApiError({ status: 403, correlationId: 'c' }))).toBe(false);
    expect(isConsentRequired(new Error('x'))).toBe(false);
  });

  it('does not upload a file that came out empty', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
      exists: true,
      uri: 'x',
      size: 0,
      isDirectory: false,
      modificationTime: 0,
    });

    await expect(uploadPostPhoto({ uri: 'file:///p.jpg' })).rejects.toThrow('empty');
    expect(uploadUrlMock).not.toHaveBeenCalled();
  });
});

describe('watchPost', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('polls every two seconds until the post leaves Processing', async () => {
    getMock
      .mockResolvedValueOnce(post({ id: 'p', status: 'Processing' }))
      .mockResolvedValueOnce(post({ id: 'p', status: 'Draft' }));

    const watching = watchPost('p');
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(getMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    const outcome = await watching;
    expect(outcome).toMatchObject({ kind: 'post', post: { status: 'Draft' } });
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock).toHaveBeenCalledWith('p', true);
  });

  it('keeps going through a failed poll and gives up with a timeout', async () => {
    getMock.mockRejectedValue(new ApiError({ status: 0, correlationId: 'c' }));

    const watching = watchPost('p');
    await jest.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);

    expect(await watching).toEqual({ kind: 'timeout' });
    expect(getMock.mock.calls.length).toBeGreaterThan(10);
  });

  it('ends at once when the screen asks it to stop', async () => {
    getMock.mockResolvedValue(post({ status: 'Processing' }));

    const watching = watchPost('p', () => true);
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(await watching).toEqual({ kind: 'stopped' });
    expect(getMock).not.toHaveBeenCalled();
  });

  it('fails when the post is gone (404)', async () => {
    getMock.mockRejectedValue(new ApiError({ status: 404, correlationId: 'c' }));

    const watching = watchPost('p');
    const failure = expect(watching).rejects.toMatchObject({ status: 404 });
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await failure;
  });
});

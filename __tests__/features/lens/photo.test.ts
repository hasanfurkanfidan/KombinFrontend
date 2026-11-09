import * as ImageManipulator from 'expo-image-manipulator';

import { ApiError } from '@/api/client';
import { lensErrorKind, levelLabel, similarityBucket } from '@/features/lens/labels';
import { cropRect, cropRegion, prepareLensPhoto } from '@/features/lens/photo';

const manipulate = jest.mocked(ImageManipulator.manipulateAsync);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cropRect', () => {
  it('maps the normalized box to pixels without a margin', () => {
    expect(cropRect({ x: 0.25, y: 0.1, w: 0.5, h: 0.6 }, 1200, 1600, 0)).toEqual({
      originX: 300,
      originY: 160,
      width: 600,
      height: 960,
    });
  });

  it('adds the margin as a share of the box on every side', () => {
    // Box 400×800 px at (400, 400); 5 % of it is 20 px left/right and 40 px top/bottom.
    expect(cropRect({ x: 0.25, y: 0.25, w: 0.25, h: 0.5 }, 1600, 1600)).toEqual({
      originX: 380,
      originY: 360,
      width: 440,
      height: 880,
    });
  });

  it('clamps a box that runs off the photo to its edges', () => {
    expect(cropRect({ x: -0.1, y: 0.8, w: 0.5, h: 0.4 }, 1000, 500, 0)).toEqual({
      originX: 0,
      originY: 400,
      width: 400,
      height: 100,
    });
  });

  it('accepts the contract numbers as strings and rounds outward to whole pixels', () => {
    expect(cropRect({ x: '0.333', y: '0.5', w: '0.333', h: '0.25' }, 1000, 999, 0)).toEqual({
      originX: 333,
      originY: 499,
      width: 333,
      height: 251,
    });
  });

  it('never returns an empty or out-of-bounds crop', () => {
    expect(cropRect({ x: 1, y: 1, w: 0, h: 0 }, 800, 600)).toEqual({
      originX: 799,
      originY: 599,
      width: 1,
      height: 1,
    });
    const whole = cropRect({ x: 0, y: 0, w: 1, h: 1 }, 800, 600);
    expect(whole).toEqual({ originX: 0, originY: 0, width: 800, height: 600 });
  });
});

describe('photo helpers', () => {
  it('downscales the longer edge to 1600 px and re-encodes as JPEG, keeping the real size', async () => {
    manipulate.mockResolvedValueOnce({ uri: 'file://small.jpg', width: 1200, height: 1600 });
    const photo = await prepareLensPhoto({ uri: 'file://big.heic', width: 3000, height: 4000 });
    expect(manipulate).toHaveBeenCalledWith('file://big.heic', [{ resize: { height: 1600 } }], {
      compress: 0.85,
      format: 'jpeg',
    });
    expect(photo).toEqual({ uri: 'file://small.jpg', width: 1200, height: 1600 });
  });

  it('crops the searched photo by the region box', async () => {
    manipulate.mockResolvedValueOnce({ uri: 'file://crop.jpg', width: 440, height: 880 });
    const crop = await cropRegion(
      { uri: 'file://small.jpg', width: 1600, height: 1600 },
      { x: 0.25, y: 0.25, w: 0.25, h: 0.5 },
    );
    expect(manipulate).toHaveBeenCalledWith(
      'file://small.jpg',
      [{ crop: { originX: 380, originY: 360, width: 440, height: 880 } }],
      { compress: 1, format: 'jpeg' },
    );
    expect(crop).toEqual({ uri: 'file://crop.jpg', width: 440, height: 880 });
  });
});

describe('labels', () => {
  it('names the level, never a percentage', () => {
    expect(levelLabel('close')).toBe('Çok benzer');
    expect(levelLabel('similar')).toBe('Benzer');
    expect(similarityBucket('close')).toBe('close');
    expect(similarityBucket('whatever')).toBe('similar');
  });

  it('maps a 400 or an unreadable photo to "another photo", everything else to a retry', () => {
    const problem = (status: number) => new ApiError({ status, correlationId: 'c' });
    expect(lensErrorKind(problem(400))).toBe('unreadable');
    expect(lensErrorKind(new Error('decode failed'))).toBe('unreadable');
    expect(lensErrorKind(problem(503))).toBe('failed');
    expect(lensErrorKind(problem(500))).toBe('failed');
    expect(lensErrorKind(problem(0))).toBe('failed');
  });
});

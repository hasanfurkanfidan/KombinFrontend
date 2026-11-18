import { render, screen } from '@testing-library/react-native';

import { AppImage, IMAGE_TRANSITION_MS } from '@/components/AppImage';

const reanimated = jest.requireMock('react-native-reanimated') as {
  useReducedMotion: () => boolean;
};

afterEach(() => jest.restoreAllMocks());

/** The props `expo-image` hands to its native view. */
async function rendered(ui: React.ReactElement) {
  await render(ui);
  return screen.getByTestId('img', { includeHiddenElements: true }).props;
}

const box = { width: 10, height: 10 };

describe('AppImage (the one image component, over expo-image)', () => {
  it('caches in memory and on disk, and fades in for 120 ms', async () => {
    jest.spyOn(reanimated, 'useReducedMotion').mockReturnValue(false);
    const props = await rendered(
      <AppImage uri="https://img.test/a.jpg" style={box} testID="img" />,
    );

    expect(props.cachePolicy).toBe('memory-disk');
    expect(IMAGE_TRANSITION_MS).toBe(120);
    expect(props.transition).toEqual({ duration: 120 });
    expect(props.source).toEqual([{ uri: 'https://img.test/a.jpg' }]);
  });

  it('keeps a private picture in memory only: it never reaches the disk', async () => {
    const props = await rendered(
      <AppImage uri="https://img.test/a.jpg?sig=1" style={box} private testID="img" />,
    );

    expect(props.cachePolicy).toBe('memory');
  });

  it('does not fade under reduced motion', async () => {
    jest.spyOn(reanimated, 'useReducedMotion').mockReturnValue(true);
    const props = await rendered(
      <AppImage uri="https://img.test/a.jpg" style={box} testID="img" />,
    );

    expect(props.transition).toEqual({ duration: 0 });
  });

  it('keeps the fit it was given and defaults to cover, like resizeMode did', async () => {
    const contain = await rendered(
      <AppImage uri="https://img.test/a.jpg" style={box} contentFit="contain" testID="img" />,
    );
    expect(contain.contentFit).toBe('contain');
  });

  it('defaults to cover', async () => {
    const cover = await rendered(
      <AppImage uri="https://img.test/a.jpg" style={box} testID="img" />,
    );
    expect(cover.contentFit).toBe('cover');
  });

  it('gives a presigned link one cache entry and a recycling key that follows the picture, not the signature', async () => {
    const props = await rendered(
      <AppImage
        uri="https://storage.test/kombin/social/u/p/feed.jpg?X-Amz-Signature=abc&X-Amz-Expires=3600"
        style={box}
        testID="img"
      />,
    );

    expect(props.source).toEqual([
      {
        uri: 'https://storage.test/kombin/social/u/p/feed.jpg?X-Amz-Signature=abc&X-Amz-Expires=3600',
        cacheKey: 'https://storage.test/kombin/social/u/p/feed.jpg',
      },
    ]);
    expect(props.recyclingKey).toBe('https://storage.test/kombin/social/u/p/feed.jpg');
  });

  it('recycles by the address when there is no cache key, and does not key a local file', async () => {
    const props = await rendered(
      <AppImage uri="file:///cache/ImagePicker/a.jpg?v=1" style={box} testID="img" />,
    );

    expect(props.source).toEqual([{ uri: 'file:///cache/ImagePicker/a.jpg?v=1' }]);
    expect(props.recyclingKey).toBe('file:///cache/ImagePicker/a.jpg?v=1');
  });

  it('is decorative without a label and an image with one (unchanged)', async () => {
    await render(
      <>
        <AppImage uri="https://img.test/a.jpg" style={box} testID="plain" />
        <AppImage
          uri="https://img.test/b.jpg"
          style={box}
          accessibilityLabel="Mavi blazer"
          testID="described"
        />
      </>,
    );

    const plain = screen.getByTestId('plain', { includeHiddenElements: true }).props;
    expect(plain.accessible).toBe(false);
    expect(plain.importantForAccessibility).toBe('no');
    const described = screen.getByTestId('described').props;
    expect(described.accessible).toBe(true);
    expect(described.accessibilityRole).toBe('image');
    expect(described.accessibilityLabel).toBe('Mavi blazer');
  });
});

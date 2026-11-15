// Source-level guard: every screen that shows a paged (infinite) list renders it virtualised and tuned for photos.
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- typed by hand; no Node types to import with
const fs = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string, options: { recursive: true }) => string[];
};

const ROOT = `${__dirname}/../../src/features`;

function sources(): { file: string; text: string }[] {
  return fs
    .readdirSync(ROOT, { recursive: true })
    .filter((file) => /\.tsx$/.test(file))
    .map((file) => ({
      file: file.replace(/\\/g, '/'),
      text: fs.readFileSync(`${ROOT}/${file}`, 'utf8'),
    }));
}

/**
 * Pickers that read only the first page of a paged query (they never call `fetchNextPage`), so a plain map inside the
 * sheet's scroll view stays bounded by one page.
 */
const ONE_PAGE_PICKERS = new Set(['social/TagPickerSheet.tsx', 'social/CreatePostScreen.tsx']);

/** Paged lists whose rows have no photos: virtualised, but on React Native's default window. */
const TEXT_ONLY_LISTS = new Set(['notifications/NotificationsScreen.tsx']);

describe('paged lists', () => {
  const pagedScreens = sources().filter(({ text }) => /\.pages\.(flatMap|map)\(/.test(text));

  it('finds the paged screens (the guard is not vacuous)', () => {
    expect(pagedScreens.map(({ file }) => file)).toEqual(
      expect.arrayContaining([
        'catalog/DiscoverScreen.tsx',
        'social/FeedSection.tsx',
        'wardrobe/WardrobeScreen.tsx',
        'search/SearchScreen.tsx',
      ]),
    );
  });

  it.each(
    sources()
      .filter(({ text }) => /\.pages\.(flatMap|map)\(/.test(text))
      .map(({ file }) => [file]),
  )('%s renders its pages in a virtualised list', (file) => {
    const text = sources().find((source) => source.file === file)?.text ?? '';
    if (ONE_PAGE_PICKERS.has(file)) {
      expect(text).not.toMatch(/fetchNextPage/);
      return;
    }
    expect(text).toMatch(/<FlatList|<SectionList|<ProductGrid/);
  });

  it.each([
    'catalog/ProductGrid.tsx',
    'social/FeedSection.tsx',
    'social/ProfileScreens.tsx',
    'social/MyPostsScreen.tsx',
    'wardrobe/WardrobeScreen.tsx',
    'outfits/SavedOutfitsScreen.tsx',
    'tracking/TrackingScreen.tsx',
  ])('%s uses the photo-list tuning', (file) => {
    const text = sources().find((source) => source.file === file)?.text ?? '';
    expect(text).toContain('{...IMAGE_LIST_TUNING}');
  });

  it('keeps the text-only exceptions honest', () => {
    for (const file of TEXT_ONLY_LISTS) {
      const text = sources().find((source) => source.file === file)?.text ?? '';
      expect(text).toMatch(/<SectionList|<FlatList/);
      expect(text).not.toMatch(/<AppImage/);
    }
  });
});

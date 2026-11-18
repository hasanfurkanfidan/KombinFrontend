declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- typed by hand; no Node types to import with
const fs = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };

/**
 * The pictures that show a body or an unprocessed photo are kept in memory only (`AppImage private`). Everything else
 * stays on memory-disk. This pins which call sites are which, so a new `AppImage` of a photo does not slip onto the disk.
 */
const PRIVATE_SITES: Record<string, number> = {
  'tryon/TryOnPanel.tsx': 1, // the try-on render
  'lens/LensPhotoView.tsx': 1, // the photo that was searched
  'wardrobe/ConfirmItemSheet.tsx': 1, // private only while the picture is the original
  'wardrobe/WardrobeItemScreen.tsx': 1, // same
  'social/PostPhoto.tsx': 1, // the post's own photo (its tag cutouts are not)
  'social/TagEditor.tsx': 1, // the photo being tagged
  'social/MyPostsScreen.tsx': 1, // a post photo's thumbnail
  'social/CreatorStatsScreen.tsx': 1, // a post photo's preview
};

const PUBLIC_SITES = [
  'catalog/ProductCard.tsx',
  'catalog/ProductDetailScreen.tsx',
  'wardrobe/ItemTile.tsx',
  'wardrobe/PairingsSection.tsx',
  'wardrobe/WardrobeSummaryScreen.tsx',
  'outfits/OutfitPieces.tsx',
  'outfits/OutfitMiniFigure.tsx',
  'lens/RegionResults.tsx',
  'trips/TripPlanView.tsx',
  'onboarding/SwipeDeck.tsx',
];

function privateElements(file: string): number {
  const source = fs.readFileSync(`${__dirname}/../../src/features/${file}`, 'utf8');
  const elements = source.match(/<AppImage[\s\S]*?\/>/g) ?? [];
  return elements.filter((element) =>
    /\n\s*private(=\{[^}]*\})?\s*(\n|\/>)|\sprivate\s*\/>/.test(element),
  ).length;
}

describe('which pictures are private (memory only)', () => {
  it.each(Object.entries(PRIVATE_SITES))('%s has %i private picture', (file, count) => {
    expect(privateElements(file)).toBe(count);
  });

  it.each(PUBLIC_SITES)('%s stays on memory-disk', (file) => {
    expect(privateElements(file)).toBe(0);
  });
});

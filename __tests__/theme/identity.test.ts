import { theme } from '@/theme';

// Jest runs in Node, but the app's tsconfig carries no Node types: the little this test needs is typed by hand.
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- typed by hand above; no Node types to import with
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports -- as above
const { join, relative } = require('path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
};

/**
 * Guards the "Prova odası" skin (docs/design/identity.md): no pills, no colour names from the old palette, no
 * shadows, and no colour literal outside the theme. The removed tokens no longer exist (the typecheck fails on
 * them too); this keeps them from coming back as a string, a new alias or a hard-coded value.
 */
const ROOT = join(__dirname, '..', '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(name) && name !== 'types.gen.ts' ? [path] : [];
  });
}

const files = sourceFiles(ROOT).map((path) => ({
  path: relative(ROOT, path).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}));

const REMOVED_COLORS = [
  'borderStrong',
  'accent',
  'accentSoft',
  'onInk',
  'inkMuted',
  'inkSoft',
  'surfaceAlt',
  'surfaceAlt2',
  'border',
  'warning',
];

function offenders(pattern: RegExp, scope = files): string[] {
  return scope.filter((file) => pattern.test(file.text)).map((file) => file.path);
}

describe('identity guard', () => {
  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('uses no pill radius', () => {
    expect(offenders(/radius\.pill\b/)).toEqual([]);
    expect(Object.keys(theme.radius)).toEqual(['tag', 'control', 'cta', 'tile', 'panel']);
  });

  it('uses none of the removed colour names', () => {
    const pattern = new RegExp(`colors\\.(${REMOVED_COLORS.join('|')})\\b`);
    expect(offenders(pattern)).toEqual([]);
    for (const name of REMOVED_COLORS) {
      expect(theme.colors).not.toHaveProperty(name);
    }
  });

  it('has no shadows (depth comes from surface and hairlines)', () => {
    expect(offenders(/\bshadow(Color|Opacity|Radius|Offset)\b|\belevation:/)).toEqual([]);
    expect(theme).not.toHaveProperty('shadows');
  });

  it('keeps colour literals inside the theme', () => {
    const components = files.filter((file) => !file.path.startsWith('theme/'));
    expect(offenders(/['"]#[0-9a-f]{3,8}['"]|rgba?\(/i, components)).toEqual([]);
  });

  it('loads only Archivo', () => {
    expect(offenders(/Inter_|SpaceGrotesk|expo-google-fonts\/(inter|space-grotesk)/)).toEqual([]);
    for (const family of Object.values(theme.fontFamilies)) {
      expect(family).toMatch(/^Archivo/);
    }
  });
});

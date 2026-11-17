// Structural guards for "Manken üstünde gör": who may ask the backend, and what the private image link and the body
// values never touch.
import { resetUserScopedState } from '@/session/userScope';
import {
  isTryOnOff,
  noteTryOnDisabled,
  noteTryOnRateLimited,
  tryOnBlockedUntil,
} from '@/features/tryon/gate';
import { fitLabel, fitRows, outfitPieceNames } from '@/features/tryon/labels';

import { outfitPiece } from '../../fixtures';
import { tryOn } from './support';

declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- typed by hand; no Node types to import with
const fs = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string, options: { recursive: true }) => string[];
};

const SRC = `${__dirname}/../../../src`;
const sources = fs
  .readdirSync(SRC, { recursive: true })
  .map((name) => name.replace(/\\/g, '/'))
  .filter((name) => /\.tsx?$/.test(name) && !name.endsWith('types.gen.ts'))
  .map((name) => ({ name, source: fs.readFileSync(`${SRC}/${name}`, 'utf8') }));

/** Code without comments, so a rule written down in a comment is not mistaken for a use. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('who may ask', () => {
  // A request can make the server draw an image (30 an hour): only a screen that has an outfit sheet (or the product)
  // open asks. Lists, cards, grids and the home card never do; adding a caller here is a decision, not an accident.
  const ASKERS = [
    'api/endpoints/tryon.ts',
    'features/tryon/hooks.ts',
    'features/tryon/TryOnAction.tsx',
    'features/outfits/OutfitSheet.tsx',
    'features/catalog/ProductDetailScreen.tsx',
    'features/social/TrySheet.tsx',
  ];

  it('only the tryon hook reaches the endpoint (the others import its subject type)', () => {
    const callers = sources
      .filter(({ source }) => {
        const body = code(source).replace(/^import type [^;]*;$/gm, '');
        return /endpoints\/tryon'/.test(body) || /getTryOn/.test(body);
      })
      .map(({ name }) => name)
      // The module that defines the call is not a caller.
      .filter((name) => name !== 'api/endpoints/tryon.ts');
    expect(callers).toEqual(['features/tryon/hooks.ts']);
  });

  it('only an outfit sheet, the product detail and "Dolabımla dene" use the hook or the action', () => {
    const files = sources
      .filter(({ source }) => /\b(useTryOn|TryOnAction)\b/.test(code(source)))
      .map(({ name }) => name)
      .filter((name) => !name.startsWith('features/tryon/') || name === 'features/tryon/hooks.ts')
      .sort();
    expect(files).toEqual(
      ASKERS.filter(
        (name) => name !== 'api/endpoints/tryon.ts' && name !== 'features/tryon/TryOnAction.tsx',
      ).sort(),
    );
  });

  it('no list, card or grid is among them', () => {
    const banned = [
      'DailyCard',
      'ProductCard',
      'ProductGrid',
      'OutfitMiniFigure',
      'SavedOutfitsScreen',
      'PostCard',
      'FeedSection',
    ];
    for (const name of banned) {
      const file = sources.find((entry) => entry.name.endsWith(`/${name}.tsx`));
      expect(file).toBeDefined();
      expect(code(file?.source ?? '')).not.toMatch(/useTryOn|TryOnAction|getTryOn|tryon\//);
    }
  });
});

describe('the private image link and the body', () => {
  const tryonSources = sources.filter(
    ({ name }) => name.startsWith('features/tryon/') || name === 'api/endpoints/tryon.ts',
  );

  it('the image link goes to the image component and nowhere else', () => {
    const users = sources
      .filter(({ source }) => /\bimageUrl\b/.test(code(source)) && /tryon|TryOn/.test(source))
      .map(({ name }) => name)
      .filter((name) => name.startsWith('features/tryon/'))
      .sort();
    // The hook only checks that there is one; the panel hands it to `AppImage`.
    expect(users).toEqual(['features/tryon/TryOnPanel.tsx', 'features/tryon/hooks.ts'].sort());
    const hook = code(sources.find(({ name }) => name === 'features/tryon/hooks.ts')?.source ?? '');
    expect(hook.match(/imageUrl/g)).toHaveLength(1);
    expect(hook).toMatch(/answer\.imageUrl\)/);
  });

  it('nothing of it is logged, tracked or stored', () => {
    for (const { name, source } of tryonSources) {
      const body = code(source);
      expect(`${name}: ${/console\./.test(body)}`).toBe(`${name}: false`);
      expect(`${name}: ${/\btrack\(/.test(body)}`).toBe(`${name}: false`);
      expect(
        `${name}: ${/AsyncStorage|SecureStore|writeAsStringAsync|localStorage/.test(body)}`,
      ).toBe(`${name}: false`);
    }
  });

  it('no body value is named on the client', () => {
    for (const { name, source } of tryonSources) {
      expect(`${name}: ${/\b(weight|waist|chest|hip|bmi)\b/i.test(code(source))}`).toBe(
        `${name}: false`,
      );
    }
  });

  it('the user-facing copy never calls it a try-on of the user', () => {
    const copy = code(sources.find(({ name }) => name === 'i18n/tr.ts')?.source ?? '');
    const lines = copy.split('\n').filter((line) => /tryOn/.test(line));
    expect(lines.join('\n')).not.toMatch(/sanal|üstünde dene|deneme/i);
  });
});

describe('the session gate', () => {
  it('forgets "switched off" and the rate-limit wait when the session ends', () => {
    noteTryOnDisabled();
    noteTryOnRateLimited(600);
    expect(isTryOnOff()).toBe(true);
    expect(tryOnBlockedUntil()).toBeGreaterThan(Date.now());

    resetUserScopedState();

    expect(isTryOnOff()).toBe(false);
    expect(tryOnBlockedUntil()).toBe(0);
  });
});

describe('labels', () => {
  it('names each fit level, and says nothing for null', () => {
    expect(fitLabel('Tight')).toBe('Dar gelebilir');
    expect(fitLabel('TrueToSize')).toBe('Tam bedenin');
    expect(fitLabel('Loose')).toBe('Bol gelebilir');
    expect(fitLabel(null)).toBeNull();
  });

  it('keeps rows only for pieces with a name on screen and a fit', () => {
    const names = outfitPieceNames([
      outfitPiece({ wardrobeItemId: 'w1', name: 'Blazer' }),
      outfitPiece({ slot: 'Shoes', wardrobeItemId: null, productId: 'p9', name: 'Bot' }),
    ]);
    const rows = fitRows(
      tryOn({
        garments: [
          { id: 'w1', fitLevel: 'Loose' },
          { id: 'p9', fitLevel: 'TrueToSize' },
          { id: 'unknown', fitLevel: 'Tight' },
          { id: 'w1', fitLevel: null },
        ],
      }),
      names,
    );
    expect(rows).toEqual([
      { id: 'w1', name: 'Blazer', label: 'Bol gelebilir', notable: true },
      { id: 'p9', name: 'Bot', label: 'Tam bedenin', notable: false },
    ]);
  });
});

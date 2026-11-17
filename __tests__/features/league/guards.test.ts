import { tsxFiles } from '../../a11y/sourceScan';

/**
 * What the league must never do, checked on its source: it has no buying (the app sells nothing, and nothing on a league
 * screen is for sale), sends no analytics (the allow-list has no league event, and an id of a pair, an entry or a
 * picture must never leave the phone that way), and keeps nothing of another player on disk.
 */
const FILES = [...tsxFiles('src/features/league'), ...tsxFiles('app/league')];

// The `.ts` files of the feature (labels, hooks) are read as well.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
};
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join } = require('path') as { join: (...parts: string[]) => string };
const ROOT = join(__dirname, '..', '..', '..');
const TS = readdirSync(join(ROOT, 'src/features/league'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({
    path: `src/features/league/${name}`,
    source: readFileSync(join(ROOT, 'src/features/league', name), 'utf8'),
  }));
const ENDPOINT = {
  path: 'src/api/endpoints/league.ts',
  source: readFileSync(join(ROOT, 'src/api/endpoints/league.ts'), 'utf8'),
};
const ALL = [...FILES, ...TS];

const hits = (pattern: RegExp, files = ALL) =>
  files.filter((file) => pattern.test(file.source)).map((file) => file.path);

describe('the league screens', () => {
  it('scan a good number of files', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(15);
  });

  it('sell nothing: no buy link, no seller, no browser', () => {
    expect(
      hits(/openOffer|buildGoUrl|goPath|expo-web-browser|features\/catalog\/buy|Linking/),
    ).toEqual([]);
    expect(hits(/ProductCard|productHref|\.offer\b.*price|seller/i)).toEqual([]);
  });

  it('send no analytics event: none of the league’s facts leaves the phone that way', () => {
    expect(hits(/@\/analytics|\btrack\(/)).toEqual([]);
  });

  it('keep nothing on disk: no storage, no store of pair, entry or picture identifiers', () => {
    expect(hits(/AsyncStorage|SecureStore|expo-file-system|prefsStore|writeStored/)).toEqual([]);
  });

  it('log nothing', () => {
    expect(hits(/console\./, [...ALL, ENDPOINT])).toEqual([]);
  });

  it('show no name of another player: the table’s only text is the alias and "Sen"', () => {
    const table = FILES.find((file) => file.path.endsWith('LeagueTable.tsx'))?.source ?? '';
    expect(table).toContain('row.alias');
    expect(table).not.toMatch(/displayName|handle|email|userId/);
  });

  it('use no colour literal: the dark zone is the theme’s `arena` tokens', () => {
    expect(hits(/['"]#[0-9a-f]{3,8}['"]|rgba?\(/i)).toEqual([]);
  });
});

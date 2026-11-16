import { headingsWithoutRole, jsxUses, reach, tsxFiles } from './sourceScan';

const SRC = tsxFiles('src');
const COMPONENTS = tsxFiles('src/components');
const TOUCHABLES = ['Pressable', 'PressableScale', 'TouchableOpacity'] as const;

describe('every touchable in src/components has a name and a role', () => {
  const uses = jsxUses(COMPONENTS, [...TOUCHABLES, 'Switch', 'TextInput']);

  it('finds the touchables to check', () => {
    expect(uses.length).toBeGreaterThanOrEqual(10);
  });

  it.each(uses.filter((use) => TOUCHABLES.includes(use.tag as (typeof TOUCHABLES)[number])))(
    '$path:$line <$tag> has a role, and a label or a text child',
    (use) => {
      // PressableScale forwards the caller's props: the callers (Button, IconButton) set them.
      const hasRole = 'accessibilityRole' in use.attrs || use.spreads;
      const hasName = 'accessibilityLabel' in use.attrs || use.hasText || use.spreads;
      expect({ role: hasRole, name: hasName }).toEqual({ role: true, name: true });
    },
  );

  it.each(uses.filter((use) => use.tag === 'Switch' || use.tag === 'TextInput'))(
    '$path:$line <$tag> carries an accessibility label',
    (use) => {
      expect('accessibilityLabel' in use.attrs).toBe(true);
    },
  );
});

describe('touch targets', () => {
  // Resolved from the file's own StyleSheet and the theme tokens, hit slop included: nothing below 44 pt.
  const sized = jsxUses(SRC, [...TOUCHABLES, 'Switch']).flatMap((use) => {
    const vertical = reach(use, 'vertical');
    const horizontal = reach(use, 'horizontal');
    return [
      ...(vertical !== null ? [{ use, axis: 'high', value: vertical }] : []),
      ...(horizontal !== null ? [{ use, axis: 'wide', value: horizontal }] : []),
    ];
  });

  it('measures a good number of them', () => {
    expect(sized.length).toBeGreaterThanOrEqual(25);
  });

  it.each(
    sized.map(
      (entry) => [`${entry.use.path}:${entry.use.line} ${entry.axis}`, entry.value] as const,
    ),
  )('%s is at least 44 (%s)', (_name, value) => {
    expect(value).toBeGreaterThanOrEqual(44);
  });
});

describe('text scaling', () => {
  const sources = SRC.map(({ path, source }) => ({ path, lines: source.split('\n') }));

  it('never turns font scaling off', () => {
    const offenders = sources.flatMap(({ path, lines }) =>
      lines.flatMap((text, index) =>
        /allowFontScaling=\{false\}/.test(text) ? [`${path}:${index + 1}`] : [],
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('caps maxFontSizeMultiplier below 2 only with a written reason in the lines before', () => {
    const offenders = sources.flatMap(({ path, lines }) =>
      lines.flatMap((text, index) => {
        const match = /maxFontSizeMultiplier=\{([\d.]+)\}/.exec(text);
        if (!match || Number(match[1]) >= 2) {
          return [];
        }
        const before = lines.slice(Math.max(0, index - 4), index).join(' ');
        return /\{\/\*.*\*\/\}|\/\//.test(before) ? [] : [`${path}:${index + 1}`];
      }),
    );
    expect(offenders).toEqual([]);
  });

  it('never caps lines with a bare number: numberOfLines goes through lines(), which lifts the cap at large text', () => {
    const offenders = sources.flatMap(({ path, lines }) =>
      lines.flatMap((text, index) =>
        /numberOfLines=\{\d+\}/.test(text) ? [`${path}:${index + 1}`] : [],
      ),
    );
    expect(offenders).toEqual([]);
  });
});

describe('headings', () => {
  /** Title-sized texts that are deliberately not headings, each with its reason. */
  const NOT_HEADINGS = [
    // An initial inside an avatar.
    'src/components/Avatar.tsx:initialLarge',
    // The title is a button's label: the button is the element.
    'src/features/outfits/DailyCard.tsx:title',
    'src/features/onboarding/AudienceScreen.tsx:cardLabel',
    // Decoration that fades in during a swipe (hidden from the tree).
    'src/features/onboarding/SwipeDeck.tsx:stampText',
    // A sentence of the plan, not a title; its groups are headings.
    'src/features/trips/TripPlanView.tsx:coverage',
    // A person's name in a row of facts; the screen's header is the title.
    'src/features/profile/ProfileScreen.tsx:name',
    'src/features/social/ProfileScreens.tsx:name',
    // A money figure, not a title.
    'src/features/social/CreatorStatsScreen.tsx:heroAmount',
    // An empty-state word inside a card that already has its own title.
    'src/features/catalog/PriceSummary.tsx:noStock',
  ];

  it('marks every title-sized text as a header, except the listed ones', () => {
    const missing = headingsWithoutRole(SRC).filter((entry) => !NOT_HEADINGS.includes(entry));
    expect([...new Set(missing)]).toEqual([]);
  });
});

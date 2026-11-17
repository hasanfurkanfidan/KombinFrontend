import { theme } from '@/theme';

const c = theme.colors;

/** WCAG 2.2 relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio between two `#RRGGBB` colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

type Pair = [foreground: keyof typeof c, background: keyof typeof c];

/**
 * Every text colour on every ground it is drawn on (`docs/accessibility-audit.md`, section 4). Body text needs 4.5:1.
 * Disabled controls (0.4 opacity) are exempt by WCAG and are not listed.
 */
const TEXT: Pair[] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink', 'primarySoft'],
  ['ink', 'chalk'],
  ['ink2', 'bg'],
  ['ink2', 'surface'],
  ['ink2', 'primarySoft'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'primarySoft'],
  ['muted', 'chalk'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['primary', 'primarySoft'],
  ['chalkInk', 'chalk'],
  ['chalkInk', 'bg'],
  ['chalkInk', 'surface'],
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['danger', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryPressed'],
  ['onDanger', 'danger'],
];

/** Meaningful graphics (borders of controls, dashed edges of Kombin's marks, icons) need 3:1. */
const GRAPHICS: Pair[] = [
  ['control', 'bg'],
  ['chalkLine', 'bg'],
  ['chalkLine', 'surface'],
  ['chalkLine', 'chalk'],
  ['primary', 'primarySoft'],
  ['muted', 'bg'],
  ['ink', 'bg'],
  // Owner's decision 16.11.2026: `control` darkened to `#858C86` so a border on a `surface` panel passes too.
  ['control', 'surface'],
];

describe('contrast of the theme tokens', () => {
  it.each(TEXT)('text %s on %s is at least 4.5:1', (foreground, background) => {
    expect(contrast(c[foreground], c[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHICS)('graphic %s on %s is at least 3:1', (foreground, background) => {
    expect(contrast(c[foreground], c[background])).toBeGreaterThanOrEqual(3);
  });

  it('computes the ratios the audit quotes', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast(c.muted, c.bg)).toBeCloseTo(5.95, 1);
    expect(contrast(c.control, c.bg)).toBeCloseTo(3.45, 1);
    expect(contrast(c.control, c.surface)).toBeCloseTo(3.1, 1);
    expect(contrast(c.chalkInk, c.chalk)).toBeCloseTo(7.55, 1);
  });
});

/**
 * The league's dark zone (`theme.arena`, docs: Kombin Ligi): text and icons drawn straight on the moss-green ground and
 * on its raised step, and chalk on both. Each pair is computed from the tokens, never quoted.
 */
const a = theme.arena;
type ArenaPair = [name: string, foreground: string, background: string];

const ARENA_TEXT: ArenaPair[] = [
  ['text on the ground', a.text, a.ground],
  ['soft text on the ground', a.textSoft, a.ground],
  ['text on the raised step (the consent panel)', a.text, a.raised],
  ['soft text on the raised step', a.textSoft, a.raised],
  ['chalk on the ground (the figures and the votes count)', c.chalk, a.ground],
  ['chalk on the raised step', c.chalk, a.raised],
  // The chalk button, the chosen card's tag and the player's own row.
  ['chalkInk on chalk', c.chalkInk, c.chalk],
  // The white cards of the league carry the ordinary text colours.
  ['ink on a white card', c.ink, c.bg],
  ['muted on a white card', c.muted, c.bg],
  ['ink2 on the surface well', c.ink2, c.surface],
  ['primary on a white card (the promotion label)', c.primary, c.bg],
];

const ARENA_GRAPHICS: ArenaPair[] = [
  ['the cross and the arrow on the raised button', a.text, a.raised],
  ['the trophy on the ground (Keşfet and Profil rows)', c.chalk, a.ground],
  ['a counted step of the progress bar on the ground', c.chalk, a.ground],
  ['the chosen card’s edge on the ground', c.chalk, a.ground],
  ['the promotion line on a white card', c.primary, c.bg],
  ['the relegation line on a white card', c.muted, c.bg],
];

describe('contrast of the league’s dark zone', () => {
  it.each(ARENA_TEXT)('text: %s is at least 4.5:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ARENA_GRAPHICS)('graphic: %s is at least 3:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it('computes the ratios it quotes', () => {
    expect(contrast(a.text, a.ground)).toBeCloseTo(8.4, 0);
    expect(contrast(c.chalk, a.ground)).toBeGreaterThan(7);
  });

  it('keeps the ground the same green as the user’s own colour: one green in the app', () => {
    expect(a.ground).toBe(c.primary);
  });
});

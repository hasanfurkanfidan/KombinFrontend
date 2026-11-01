export const colors = {
  /** Primary text, primary buttons, active navigation. */
  ink: '#141414',
  /** Secondary text, inactive navigation. */
  inkMuted: '#6B6B66',
  /** Body text on tinted cards. */
  inkSoft: '#3A3A36',
  surface: '#FFFFFF',
  /** Cards, chip backgrounds, image placeholders. */
  surfaceAlt: '#F3F2EE',
  surfaceAlt2: '#ECEBE6',
  border: '#E4E2DC',
  borderStrong: '#B5B3AC',
  /** "Good for you": price drops, in stock, savings. Use only for positive price/stock signals. */
  accent: '#0F5C3F',
  accentSoft: '#E3F0E8',
  /** Price increased, size sold out, form errors. */
  warning: '#A14A1E',
  /** Text on `ink` or `accent` backgrounds. */
  onInk: '#FFFFFF',
  /** Scrim behind modals. */
  scrim: 'rgba(20, 20, 20, 0.45)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

export const sizes = {
  /** Minimum touch target. */
  touch: 44,
  chipHeight: 36,
  fieldHeight: 52,
  buttonHeight: 54,
  tabBarHeight: 84,
  tabAddButton: 52,
  productImageHeight: 180,
  detailImageHeight: 300,
  sellerBadge: 32,
  chartMiniWidth: 120,
  chartMiniHeight: 34,
  chartFullHeight: 200,
  /** Round white bookmark button drawn over a product image. */
  bookmarkButton: 32,
  /** Alert row thumbnail (design screen 10). */
  thumbWidth: 64,
  thumbHeight: 72,
  swipeButtonLarge: 64,
  swipeButtonSmall: 48,
  swipeCardHeight: 380,
  personaSwatchWidth: 12,
  personaSwatchHeight: 36,
  avatar: 56,
} as const;

export const shadows = {
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

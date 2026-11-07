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
  /** Unread-count badge on the bell. */
  badge: 18,
  /** Leading icon square of a notification row (design screen 06). */
  notificationIcon: 40,
  /** Drag handle on the outfit sheet. */
  grabberWidth: 36,
  grabberHeight: 4,
  /** Round warning badge on a failed wardrobe card. */
  statusBadge: 24,
  /** Big cutout on the confirm sheet and the wardrobe item detail. */
  itemCutoutHeight: 240,
  /** Colour dot in the confirm sheet's swatch row (hit slop brings it to 44). */
  colorSwatch: 34,
  /** Small fifth tile (accessory) under the outfit grid. */
  outfitAccessoryTile: 72,
  /** Round shuffle / close buttons in the outfit header. */
  outfitHeaderButton: 44,
  /** Weather pill and piece thumbnails on the home card. */
  homeCardThumbHeight: 84,
  /** The pairing screen's cutout takes this share of the window height. */
  itemCutoutRatio: 0.4,
  /** A companion tile in the "Bununla gidenler" rows. */
  pairingTile: 96,
  /** Round white tag dot drawn over a post photo (design screen 09); hit slop brings it to 44. */
  tagDot: 28,
  tagDotCore: 10,
  /** Author avatar on a post card. */
  postAvatar: 40,
  /** Thumbnail in the tag sheet and the tag picker rows. */
  tagThumb: 56,
  /** A wardrobe/product row thumbnail in the tag picker. */
  pickerThumb: 64,
  /** Minimum height of the caption box in the publish step. */
  captionInputHeight: 96,
  /** Preview thumbnail of a post in "Gönderilerim" and the creator's top posts. */
  /** Placeholder height of a post photo while the feed loads. */
  postSkeleton: 320,
  postThumbWidth: 72,
  postThumbHeight: 90,
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

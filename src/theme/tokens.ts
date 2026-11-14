/**
 * The "Prova odası" palette (docs/design/identity.md). Two fixed meanings run through every screen:
 * green (`primary`) is the user and their choices, chalk is Kombin pointing at something. Light only.
 */
export const colors = {
  /** Page background. */
  bg: '#FFFFFF',
  /** Panels, image wells, tiles, icon buttons: depth comes from `surface` on `bg`, never from shadows. */
  surface: '#EFF4F0',
  /** Hairlines and dividers. */
  line: '#DCE1DC',
  /** Borders of unselected controls (chips, secondary buttons, fields). */
  control: '#8D948E',
  /** Primary text. */
  ink: '#131E15',
  /** Body text on panels, secondary emphasis. */
  ink2: '#38433A',
  /** Captions, inactive navigation, placeholders. */
  muted: '#5D665E',
  /** The one filled action per screen, selection, links and "Sana uygun". */
  primary: '#075726',
  primaryPressed: '#00451B',
  /** Fill of a selected chip. */
  primarySoft: '#DFF3E2',
  /** Text and icons on `primary`. */
  onPrimary: '#FFFFFF',
  /**
   * Only for what Kombin marks for attention: a missing piece, a price drop, back in stock.
   * Text on a chalk fill is always `chalkInk`; `chalkLine` draws dashed outlines and underlines.
   */
  chalk: '#F7E9A7',
  chalkInk: '#5B4404',
  chalkLine: '#9D7B19',
  /** Sold out, price up, errors; always next to an icon or a word. */
  danger: '#A8372E',
  /** Text and icons on a `danger` fill. */
  onDanger: '#FFFFFF',
  /** Text and icons drawn straight over a photo or the scrim. */
  onImage: '#FFFFFF',
  /** Scrim behind modals and over a photo being scanned. */
  scrim: 'rgba(19, 30, 21, 0.45)',
} as const;

/** Shape: 6 tags, 12 controls, 14 the primary CTA, 16 tiles, 20 panels. Round things use half their size. */
export const radius = {
  tag: 6,
  control: 12,
  cta: 14,
  tile: 16,
  panel: 20,
} as const;

/** Press feedback and state changes; skipped when the OS asks for reduced motion. */
export const motion = {
  pressScale: 0.96,
  pressMs: 150,
  stateMs: 200,
} as const;

export const sizes = {
  /** Minimum touch target. */
  touch: 44,
  chipHeight: 36,
  fieldHeight: 52,
  /** Every `Button`; the primary CTA is 52 high. */
  buttonHeight: 52,
  tabBarHeight: 84,
  productImageHeight: 180,
  detailImageHeight: 300,
  sellerBadge: 32,
  /** Radio circle in single-choice lists, and its selected dot. */
  radio: 20,
  radioDot: 10,
  /** Carousel dot under a product photo; the current one is wider. */
  carouselDot: 6,
  carouselDotActive: 18,
  chartMiniWidth: 120,
  chartMiniHeight: 34,
  chartFullHeight: 200,
  /** Round white bookmark button drawn over a product image. */
  bookmarkButton: 32,
  /** Alert row thumbnail (design screen 10). */
  thumbWidth: 64,
  thumbHeight: 72,
  /** Step dashes at the top of onboarding. */
  progressDash: 32,
  progressDashHeight: 4,
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
  /** The outfit figure's column takes this share of its panel; the leader labels get the rest. */
  outfitFigureRatio: 0.5,
  /** Small side tile of an accessory beside the outfit figure. */
  outfitAccessoryTile: 56,
  /** Leader line from a piece's well to its label. */
  leaderLine: 16,
  /** Dashed chalk edge of a missing piece (the ghost) and of the unlock card. */
  dashedBorder: 1.5,
  /** Panel-coloured edge between the overlapping wells of a layered torso. */
  layerGap: 3,
  /** Round shuffle / close buttons in the outfit header. */
  outfitHeaderButton: 44,
  /** Loading placeholder of the home card. */
  homeCardThumbHeight: 84,
  /** The small standing figure on the home card: a column of three stacked thumbnails. */
  homeFigureWidth: 76,
  homeFigureTorso: 60,
  homeFigureBottom: 68,
  homeFigureShoes: 34,
  /** Loading placeholder of the outfit figure. */
  outfitFigureSkeleton: 380,
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
  /** The photo on the Lens screen is at most this share of the window height (full width otherwise). */
  lensPhotoMaxRatio: 0.55,
  /** Number badge in a region outline's corner (the whole outline is the touch target). */
  lensRegionBadge: 24,
  /** Outline of a region on the photo, and of the selected one. */
  lensRegionBorder: 1.5,
  lensRegionBorderSelected: 3,
  /** A product card in a region's rail. */
  lensRailCardWidth: 140,
  lensRailImageHeight: 168,
  /** A wardrobe piece in the "Dolabında benzeri var" strip. */
  lensWardrobeThumb: 64,
} as const;

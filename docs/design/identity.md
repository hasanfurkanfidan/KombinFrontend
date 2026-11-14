# Visual identity: "Prova odası" (Task 15b-B)

v1's screens and layouts, v3's skin. The structure, routes, copy and behaviour are those of 15b-A; this file only covers how things look. The tokens live in `src/theme`; `__tests__/theme/identity.test.ts` guards the rules marked **(guarded)**.

## Two fixed meanings

- **Green (`primary`) is you and your choices:** the one filled action per screen, selection (chips, radios, segments, the active tab, a followed person, a liked or saved post), links, "Sana uygun %N", "Dolabında var", your active style, the anchor piece of an outfit.
- **Chalk is Kombin pointing at something:** a missing piece, a price drop, back in stock, below the target price, savings, an unconfirmed tag proposal, the unread-count badge. A chalk fill always carries `chalkInk` text; `chalkLine` draws dashed edges and underlines.
- `danger` is sold out, price up and errors, always next to a word or an icon. Nothing else is coloured.

## Tokens

| Colour                 | Hex                   | Role                                                       |
| ---------------------- | --------------------- | ---------------------------------------------------------- |
| `bg`                   | `#FFFFFF`             | page                                                       |
| `surface`              | `#EFF4F0`             | panels, image wells, tiles, icon buttons                   |
| `line`                 | `#DCE1DC`             | hairlines                                                  |
| `control`              | `#8D948E`             | borders of unselected controls; decorative placeholder art |
| `ink` / `ink2`         | `#131E15` / `#38433A` | text, body text on panels                                  |
| `muted`                | `#5D665E`             | captions, inactive tabs, placeholders                      |
| `primary`              | `#075726`             | see above; `primaryPressed #00451B`, `primarySoft #DFF3E2` |
| `chalk`                | `#F7E9A7`             | with `chalkInk #5B4404` and `chalkLine #9D7B19`            |
| `danger`               | `#A8372E`             | with `onDanger`                                            |
| `onPrimary`, `onImage` | white                 | text on green; text and outlines over a photo or scrim     |

Measured contrast (WCAG): ink on bg 17.2, ink2 on surface 9.3, muted on bg 5.95 and on surface 5.35, primary on bg 8.75 and on primarySoft 7.5, white on primary 8.75, chalkInk on chalk 7.55, danger on bg 6.46; graphics: control on bg 3.11, chalkLine on bg 3.98 and on surface 3.57.

**Radius:** `tag` 6 · `control` 12 (buttons, chips, icon buttons, fields) · `cta` 14 (the filled primary button) · `tile` 16 · `panel` 20. No pills **(guarded)**: round things (avatars, radios, dots, badges, swatches) use half their own size. **No shadows (guarded)**: depth is `surface` on `bg` plus hairlines. Colour literals live only in `src/theme` **(guarded)**.

**Type:** Archivo, one family **(guarded)**. Display 32/35 and title 24/29 in SemiCondensed Bold; heading 20/25 and subhead 17/22 SemiBold; body 15/22 Regular (bodyMedium 15/22); label 15/20 SemiBold; caption 13/18 (captionMedium, captionStrong); tab 12/14; price 17/22, priceLarge 24/29 and match 14/18 in Condensed Bold with tabular figures. Display is for the five tabs, auth and onboarding; title for pushed screens; heading for sheets. Sentence case everywhere: the old all-caps strings ("YARIN İÇİN", "EN DÜŞÜK FİYAT", the size-map columns, the swipe stamps) are now written in sentence case in `tr.ts`.

**Motion:** `PressableScale` scales to 0.96 over 150 ms (ease-out quart) on buttons, icon buttons and tiles; nothing moves when disabled or when the OS asks for reduced motion.

## Components, before → after

- **Button:** black 54 px → `primary` (green, 52 px, radius 14), `secondary` (white, control border, ink, radius 12), `quiet` (text in green, 44 px), `danger` (red fill with `onDanger`, 52 px, radius 14: only the irreversible "Hesabımı kalıcı olarak sil" on its own screen, where it is the one filled button). One filled button per screen: rows of buy buttons (tag sheet with several pieces) and in-card actions ("Dolabımla dene") are outlined.
- **Chip:** black when selected, three look-alikes → one chip: unselected white with control border, selected `primarySoft` with a green border and text. The segmented control (Fiyatlar, Akış) and the Lens audience filter wear the same two states.
- **IconButton:** white circle → 12-radius `surface` square; `tone="onImage"` (white) over photos (product detail, wardrobe item).
- **TextField:** hairline → control border, 2 px green on focus, 2 px danger on error, muted placeholder.
- **Card (new):** the shared panel (surface, radius 20, padding 20). Toast: black → surface with a control border and a green action. BottomSheet: radius 20, heading-size title.
- **Tab bar:** active tab green, hairline top. Unread badge: black → chalk.
- **Product card:** press scale, tile radius, Condensed price, "Sana uygun" as green text, discount as a chalk tag, seller footer muted. **Detail:** black size pill → primarySoft; lowest-price card on surface with a chalk "Son 90 günün en ucuzu" tag; chart's low line chalk-dashed; offer rows lose the black badge.
- **Dolap:** "Parça ekle" is the green action; status labels are tags; the gap phrase has the chalk dashed underline; the unlock card (was black) is a surface panel with a chalk dashed edge and an outlined "İncele".
- **Black panels** (home card, unlock card, size-map measurements, creator earnings, swipe-card label, post price band, Lens letterbox) → surface panels with ink text.
- **Fiyatlar:** savings stat, status lines and the recent-trigger edge are chalk; switches green.
- **Tag editor:** unconfirmed proposals are chalk and dashed, confirmed dots green.

## The one bold element: the outfit as a standing figure

`OutfitPieces` (daily outfit, how-to-wear, saved outfit) draws one head-to-toe column on a surface panel: the torso band (a top, or the outerwear drawn in front of the top, which peeks out on the right, with a panel-coloured gap between the two wells), the bottom, the shoes. The figure column is half the panel (`sizes.outfitFigureRatio`); wells are sized by role (torso 1 × 0.82 of the column, bottom 0.86 × 1, shoes 0.6 × 0.4), each with a leader line and a short label: the name only, plus a status for the exceptions ("Ana parça" for the anchor, the price of a store piece; owned pieces carry no "Dolabında var", the sheet's "Bu kombin dolabından hazır" says it once). Accessories and a second piece of a slot are small side tiles below the labels (`figureBands`). A missing piece is a chalk-dashed ghost of itself (image at 45 %) carrying the "Eksik · price" tag; the label beside it adds "En ucuzu {seller}". The anchor gets a green edge. The outfit screens' background became white so the panel reads. The home card shows the same figure small: three stacked thumbnails (`miniFigurePieces`). The saved-outfit list and the post flow keep the 2×2 collage.

## Where this differs from the brief

- **Fonts:** `@expo-google-fonts/archivo` has the normal width only. SemiCondensed Bold and Condensed Bold are static instances (fontTools instancer, wdth 87.5 / 75, wght 700) of Google Fonts' variable `Archivo[wdth,wght].ttf`, bundled in `assets/fonts` with the OFL and loaded by `expo-font` at runtime: no native build. Same version and metrics as the package faces. Glyph check: ₺, ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü, % and the digits are present and render in all six faces (no fallback needed).
- **Wells are white, not colour-tinted,** in the figure: white-background catalog photos and wardrobe cutouts then look alike, and a 15 % tint over `surface` would vanish on the panel. Wardrobe tiles keep the tint.
- **Chalk dashed underline** uses text decoration: dashed and chalk on iOS; Android has no decoration style or colour, so it shows a solid underline in the text colour.
- **Discount tags are chalk** (a seller's markdown is a price drop), so a discounted grid carries several chalk tags.
- **Apple's sign-in button** uses its white-outline style (no black buttons; the HIG allows it).
- **Outlined controls on a `surface` panel** (home-card prompt, "İncele", "Ölçüleri güncelle", chips) always have a `bg` (white) fill and keep the `control` border (founder's decision after the render review): the border alone measures 2.79:1 against `surface`, the white fill carries the edge.
- **Render review (390 × 844, web build):** the CEO approved the direction; the follow-ups (Keşfet greeting on its own row, owned pieces without status, "Başka öneri" in the outfit header, outerwear in front, prices never cut, a quiet "Takip ediliyor") are in.

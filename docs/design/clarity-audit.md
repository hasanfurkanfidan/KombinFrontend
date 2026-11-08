# Clarity audit (Task 15b-A)

The bar: someone with no context and no patience can use every screen. Five rules, checked per screen:

1. **Five seconds:** the title plus one primary button say what the screen is for.
2. **At most two rows of controls before content** (tabs, segments and chip rows each count).
3. **Everyday Turkish**, one vocabulary (`glossary.md`).
4. **Every number has a noun or verb** that says what it counts.
5. **Say each thing once** per screen.

Method: code read of every screen against the CEO's 390×844 audit notes. Screenshots: **not rendered** (the
project has no `react-native-web`/`react-dom`; adding them only for screenshots breaks the "no package unless
required" rule). Findings are ordered by how much they cost a first-time user.

## Top findings

1. **"Takip" meant three things** (the price tab, the feed toggle, the follow button) and **"Keşfet" meant two**
   (the home tab and the feed's "for you" mode). A new user cannot build a map of the app when its names collide.
2. **The centre "+" had no label and did something nobody would guess** (it opened today's outfit, not "add").
3. **Keşfet stacked four rows of controls** (Ürünler/Akış, persona chips, category chips, then products).
4. **Dolap spoke engine language:** "olası kombin", "parça eşleşmiyor", and colour-theory tags (komşu, vurgu, nötr,
   tonal) under every companion.
5. **Onboarding asked before it gave:** four steps, one of which ("tarzına isim ver") asks a question the user
   cannot answer yet, and a summary screen that sits between them and the app.

## Per screen

### Tab bar

- **Job:** move between the app's five places.
- **Breaks:** rule 1 (unlabelled raised "+"), rule 3 ("Takip" collides with following people).
- **Fix:** tabs **Keşfet · Akış · Dolap · Fiyatlar · Profil**, no FAB. The daily outfit moves to a labelled card.
  `/add` and `/tracking` stay as redirects.

### Keşfet (products)

- **Job:** find a piece at the best price.
- **Breaks:** rule 2 (four rows), rule 5 (persona chips and the "Sana göre" sort both describe personalisation).
- **Fix:** the feed leaves for its own tab (segment gone). Persona chips become one control **"Tarzım: Ofis ▾"**
  that opens a sheet (switch, add a new style); it is not shown at all with one style. Category chips stay the
  single filter row. The daily card on top explains itself: "Bugün için" (today's outfit) until noon,
  "Yarın için" after, with a CTA that says what it opens.

### Akış (feed, new tab)

- **Job:** see what others wear and buy the pieces.
- **Breaks:** rule 3 ("Keşfet / Takip" toggle), the author name truncating before the "Kreatör" chip at 390 px.
- **Fix:** header title "Akış" with the primary action **"Paylaş"**; toggle **Herkes / Takip ettiklerim**. The
  author row puts the name alone on the first line; the chip, handle and match move to the second line, which is
  the one that truncates. Match reads **"Sana uygun %N"**.

### Dolap

- **Job:** keep my clothes and see what goes with what.
- **Breaks:** rule 4 and 3 (three bare stat cards: "12 / parça", "38 / olası kombin", "0 / parça eşleşmiyor").
- **Fix:** one sentence: "12 parçanla 38 kombin çıkıyor; hepsinin eşi var" or "…; 3 parçanın henüz eşi yok" (that
  clause is the filter button it used to be). The daily outfit card sits on top once there are 5+ pieces.

### Dolap: item detail

- **Job:** what can I wear this with?
- **Breaks:** rule 1 (no primary action; "Kombin yap" was a small secondary button next to a count), rule 3
  (komşu / vurgu / nötr / tonal under every tile).
- **Fix:** one heading **"Bununla giyilir"** with rows Üstler / Altlar / Dış giyim / Ayakkabı / Aksesuar; the
  reason shows only after a tap on "Neden?" (one line). Primary button **"Bu parçayla kombin yap"** at the bottom.

### Onboarding

- **Job:** get me to useful suggestions fast.
- **Breaks:** rule 1 (four steps, a naming step the user cannot answer), rule 5 (summary screen repeats what the app
  shows anyway).
- **Fix:** two steps, audience then 8 cards. The style is created silently as **"Tarzım"** (renamable on Profil).
  "Atla" goes straight to Keşfet. No done screen: the swipe lands on Keşfet. `/done` redirects to `/`.

### Daily outfit

- **Job:** what do I wear today?
- **Breaks:** rule 5 ("Dolabında" pill and "Sahip olduğun parça" caption on the same tile), rule 1 (an unlabelled
  shuffle icon is the screen's main action after the outfit itself; unlabelled occasion chips).
- **Fix:** keep the pill, drop the caption. The occasion row gets the label **"Nereye?"**; the shuffle becomes a
  text button **"Başka öneri"** (previous stays an icon next to it).

### Product detail

- **Job:** buy this at the lowest price.
- **Breaks:** rule 5 (a "Git" link inside every seller row plus the bottom buy button), rule 3 ("%58 uyum"),
  rule 4 ("L?").
- **Fix:** rows are tappable, no "Git"; one CTA at the bottom. **"Sana uygun %N"** only from 70 up (everywhere:
  cards, detail, feed). **"Tahmini beden: L"**, with "emin değiliz" under it when confidence is below 0.6.

### Fiyatlar (was Takip)

- **Job:** watch prices of things I want.
- **Breaks:** rule 3 (title "Takip"), empty states with no button.
- **Fix:** title "Fiyatlar"; each empty state gets one button ("Ürünlere göz at").

### Profil

- **Job:** my styles, sizes and settings.
- **Breaks:** rule 3 ("Tarzlarım" is fine; "Aktif" chip fine). Nothing structural.
- **Fix:** none beyond the glossary sweep.

### Notifications

- **Job:** what changed since I last looked.
- **Breaks:** rule 3 (the "any change" kind label read "Takip"). Empty state had no next step.
- **Fix:** kind label "Fiyat değişti"; empty state gets "Ürünlere göz at".

### Post flow

- **Job:** share an outfit safely.
- **Breaks:** rule 3 ("Nokta", "etiket" are fine in context; "Akışta" in sentences is banned).
- **Fix:** copy sweep only; the flow already has one primary per step.

### Creator page

- **Job:** who is this and what do they wear.
- **Breaks:** none structural; empty "Henüz gönderi yok" is fine for someone else's page (nothing for the viewer to do).

## Small visual changes the rules forced

Visual identity (tokens, type, colour) is Task 15b-B. These are the smallest changes that were needed to meet a
rule; no token changed.

- **Dolap:** three stat cards became one sentence (rule 4). The unpaired clause is underlined text that still filters.
- **Dolap gap:** the black gap card became one quiet line under the sentence ("Bej bir üst 15 kombin daha açar ·
  Önerilere bak"), and Dolap shows no daily outfit card (Keşfet has it), so the grid starts on the first screen.
- **Product card:** "Sana uygun %N" moved from the photo (where it overlapped the discount badge) to small text under the
  price.
- **Feed author row:** three lines: the name; the "Kreatör" chip and the handle; "Sana uygun %N". Nothing truncates
  at 390 px.
- **Daily outfit:** the shuffle is a white text pill "Başka öneri" in the occasion row instead of an icon in the header.
- **Item detail:** a bottom bar holds the primary button (same pattern as product detail's buy bar).
- **Product size:** a guess is written out ("Tahmini beden: L") instead of an outlined "L?" pill; a seller row ends in
  a chevron instead of the "Git" link.
- **Tab bar:** the raised round "+" is gone; a new `feed` line icon for Akış.

## Deliberate exceptions

- **Empty states without a button:** Akış "Herkes" (the header's "Paylaş" is right above; a second would repeat it),
  "Başka kombin kalmadı" on the daily screen (points at "Başka öneri" in the row above), "Engellenenler" and another
  person's empty profile (nothing for the viewer to do).
- **Match threshold 70 everywhere,** not only on product detail: one rule for one phrase.

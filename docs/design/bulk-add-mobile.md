# Bulk add on mobile ("Toplu ekle")

Task MB1. Sources: backend `docs/design/bulk-add.md` (a, d, e, f), vision `docs/design/bulk-add-briefs.md`, `identity.md`.
One photo of garments laid apart → a review grid → the ticked pieces become ordinary wardrobe items. Nothing is added unseen.

## Screens

One route, `app/wardrobe/bulk.tsx` → `BulkAddScreen` (a pushed stack screen; ✕ in the header). The screen is a state machine
(`features/bulkAdd/flow.ts`, pure, tested on its own); each phase is one view of the same screen, so leaving it at any point is one
event (cancel), never a half-left flow across routes.

| Phase | What is on screen | The one action |
|---|---|---|
| Entry (Dolap) | an outlined "Toplu ekle" beside the green "Parça ekle" | opens the screen |
| Capture, first time | title, the drawing (three garments apart, seen from above, a chalk dashed span between two), the six advice lines in the brief's order | "Fotoğraf çek" (+ quiet "Galeriden seç") |
| Capture, later | title, the drawing, one line, quiet "İpuçlarını göster" (opens the six lines in place) | "Fotoğraf çek" (+ quiet "Galeriden seç") |
| Waiting | the user's own photo, a still scrim, the shimmer band, "Parçalar ayrılıyor"; after 10 s a second line "Biraz daha sürüyor" | none (✕ cancels) |
| Review | sentences above the grid (unseparated, cut-off) with "Tek tek ekle"; a 2-column grid | "{n} parçayı ekle", disabled at 0 |
| Piece sheet | the larger cut-out, its reasons, the duplicate's thumb, the single add's category chips and colour swatches, a tick row | "Tamam" |
| Problem | the server's sentence (refusal, failure) or the app's line (limits, upload) | "Başka fotoğraf" or "Tekrar dene" |
| Done | back in Dolap, the list refetched, a toast "{n} parça dolabına eklendi" | none |

**Web:** the camera primary becomes "Galeriden seç" (no camera step), so review on web needs no camera.

## States of the status answer (`GET /bulk/{id}`)

`Created`, `Processing` → keep polling every 1 s (TanStack `refetchInterval`), the waiting view; after 60 s the poll stops and the
view says it is taking long with "Beklemeye devam et" (`bulk_add_result` `Timeout`). `Ready` → review (`Ready` with no pieces but an
`unseparated` shows the sentence and "Tek tek ekle"; with neither, "Fotoğrafta kıyafet bulamadık" class: the cut-off/unseparated lines or
a fallback). `Refused` → the refusal's sentence + "Başka fotoğraf". `Failed` → the failure's sentence + "Tekrar dene" when `retryable`
(posts `process` again, no second upload) else "Başka fotoğraf". `Confirmed` (a confirm whose answer was lost) → back to Dolap, wardrobe refetched, no cancel. `Cancelled`, `Expired`, 404 `BulkNotFound` → the
app's "Bu fotoğrafın süresi doldu" + "Başka fotoğraf". 404 `BulkDisabled` on any route → the screen closes and the entry disappears.

## Request errors (section e)

429 `BulkDailyLimit` → "Bugünlük toplu ekleme hakkın doldu; yarın yeniden dene." + "Tek tek ekle"; the `Created` batch is cancelled.
409 `BulkTooManyOpen` → "Yarım kalan toplu eklemelerin var; bir gün içinde kendiliğinden kapanırlar." + "Tek tek ekle". Upload or
network failure → "Fotoğraf yüklenemedi." + "Tekrar dene" (same photo). 400 image errors → the Lens line + "Başka fotoğraf". Other
429 → `rateLimitMessage`. Confirm failure (503, network) → the review stays with a line above the button and the same button.

## Decisions

- **Availability without a new route:** `GET /bulk/{nil uuid}` answers 404 `BulkDisabled` when off and 404 `BulkNotFound` when on.
  `useBulkAvailable` asks it once per session (10 min stale, like the league's `null`); anything but `BulkNotFound` hides the entry.
- **Tap count** for a clean photo, from Dolap: "Toplu ekle" → "Fotoğraf çek" → shutter (and iOS "Use photo") → "{n} parçayı ekle".
  The advice screen is the capture screen, so a first-timer pays no extra tap.
- **Tile:** tap toggles the tick (role `checkbox`, state announced); a long press or the corner "Ayrıntılar" button (a sibling, not
  nested) opens the sheet. A ticked tile has a green 2 pt edge and a filled green check square; unticked a `control` edge and an empty
  square, plus the first reason's sentence under it. Colour never alone: the check mark and the spoken state carry it.
- **Duplicate hint:** "Dolabında benzeri var." under the piece with the existing item's thumb beside it; the tick is left as vision set it.
- **Unticking a wrong pre-tick is one tap**; nothing else changes on that tap.
- **"Tek tek ekle"** opens the single add's own sheet (`AddItemSheet`) on top of the review: single adds run in the background as
  today, so the review is not lost.
- **Leaving** (✕, back, unmount, sign-out) before confirm sends `DELETE` and `bulk_add_cancel` with `Processing` or `Review`.
- **Disk:** the picked and the re-encoded photo are deleted after the upload and on leave (`discardTempFile`); the single add's sheet is mounted only when "Tek tek ekle" is pressed; every staged picture is
  `AppImage private` (memory only). The advice flag is the only thing kept: memory in `bulkStore`, reset at sign-out with the rest.
- **Edits** are kept per piece id; only changed fields are sent (`categorySlug`, `primaryColor`), like the single add's PATCH. A ticked
  piece without a category is allowed (the item then asks for it in Dolap, as a single add's `needsCategory` does).
- **Thumb links expire** at `urlsExpireAt`: the review asks the status again a minute before; ticks and edits are kept by piece id.
- **Contract source:** `docs/openapi.json` is the backend's generated document at BA3 (PR #26, `54278e6`), taken from its
  test host (hence `servers: http://localhost/` and `
` inside descriptions); against the previous copy only the bulk routes
  and the 13 `Bulk*` schemas changed. Nothing in it or in `types.gen.ts` is hand-written (`api:check` passes).
- **Confirm and cancel** are in the contract now (backend BA4, regenerated the same way from its test host: `POST /bulk/{id}/confirm` takes `BulkConfirmRequest`, answers `BulkBatchResponse`; `DELETE /bulk/{id}` answers 204). Both calls live in `api/endpoints/bulkAdd.ts`. After confirm the app reads the answer's `items` for the count and still refetches the wardrobe so the items show in Dolap. A confirm 409 or 503 shows the server's own sentence (409: new photo, 503: same button again).
- **Analytics:** `bulk_add_start`, `bulk_add_result`, `bulk_add_confirm`, `bulk_add_cancel`, counts clamped to 0-12, enums only.

## League follow-up

`state` of the league table and of `week`: `Ending` replaces the "ends at" line with "Hafta bitti, sonuçlar hazırlanıyor";
`Final` labels the table "Geçen haftanın tablosu" (the server is still sending last week's rows).

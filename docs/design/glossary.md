# Glossary

One word per thing, everywhere in the app. Every string in `src/i18n/tr.ts` follows this list;
`__tests__/i18n/glossary.test.ts` fails the build on a banned word.

## Use

| Thing                          | Word in the UI                        | Notes                                                                |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------- |
| Price-tracking tab             | **Fiyatlar**                          | Tracking a price is "izlemek" ("3 ürün izleniyor"), never "takip".   |
| Feed tab                       | **Akış**                              | Only as the tab's name.                                              |
| Feed modes                     | **Herkes** / **Takip ettiklerim**     | Not "Keşfet": that is the products tab.                              |
| Following a person             | **Takip et** / **Takip ediliyor**     | "Takip" is only ever about people.                                   |
| Match score                    | **Sana uygun %N**                     | Shown only from 70 up. Never "uyum" alone.                           |
| Persona                        | **Tarzım** (the first one), **tarz**  | Never "persona" in the UI. A new account's style is called "Tarzım". |
| Pairings                       | **Bununla giyilir**                   | Companion groups: Üstler, Altlar, Dış giyim, Ayakkabı, Aksesuar.     |
| Owned                          | **Dolabında var**                     | One badge per piece; no second caption saying the same.              |
| Lowest price                   | **En düşük fiyat**                    | The seller behind it: "En ucuzu {satıcı}".                           |
| Size guess                     | **Tahmini beden: L**                  | Add "emin değiliz" below 0.6 confidence.                             |
| Creator                        | **Kreatör**                           | Widely understood; keep.                                             |
| Posting                        | **Paylaş**                            | The post itself is a "gönderi" / "paylaşım".                         |
| Garment                        | **Parça**                             |                                                                      |
| Outfit                         | **Kombin**                            |                                                                      |
| A piece with no companion      | **eşi yok**                           | "3 parçanın henüz eşi yok".                                          |
| Removing a piece or a style    | **Dolaptan çıkar** / **Tarzı kaldır** | Not "arşivle".                                                       |
| Something still being prepared | **Hazırlanıyor**                      | Not "işleniyor".                                                     |

## Banned in UI copy

`persona`, `uyum` (alone; "uyumlu" is fine), `komşu`, `vurgu`, `nötr`, `tonal`, `eşleş-` (eşleşmiyor,
eşleşen, eşleşme), `akış` in a sentence (only the tab name "Akış"), and `Takip` for anything that is not a person.

## Every number gets a word

A number never stands alone: "12 parçanla 38 kombin çıkıyor", "3 kişiyi takip ediyor", "2 tarz · 5 kayıtlı ürün".

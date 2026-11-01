# Kombin mobile

Expo (React Native, TypeScript) client for Kombin: learn a user's style, manage a wardrobe, suggest outfits, compare prices across Turkish retailers and send users to buy through affiliate links. The app never sells anything itself. Backend: `../kombin-backend` (.NET Minimal API).

This first milestone ships the shared foundation plus two flows: **Auth** (register, login, session persistence, token refresh, logout) and **Catalog** (Keşfet product list with filters, product detail with offers and price history). Dolap, Takip and "+" are placeholders.

## Getting started

```bash
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL
npm run api:types           # only needed after docs/openapi.json changes
npm start
```

`EXPO_PUBLIC_API_URL` must be reachable from the device: `http://10.0.2.2:8080` on the Android emulator, `http://localhost:8080` on the iOS simulator, the machine's LAN IP on a physical device. Start the backend with `docker compose --file docker/compose.yaml up --build --detach --wait` in `../kombin-backend`. The catalog is empty until offers are ingested through the backend's internal `POST /api/v1/internal/catalog/offers/upsert`.

## Scripts

| Script              | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm start`         | Expo dev server                                            |
| `npm run android`   | Start and open on Android                                  |
| `npm run ios`       | Start and open on iOS                                      |
| `npm run lint`      | ESLint, fails on any warning                               |
| `npm run typecheck` | `tsc --noEmit`                                             |
| `npm test`          | Jest (`jest-expo`) + React Native Testing Library          |
| `npm run api:types` | Regenerate `src/api/types.gen.ts` from `docs/openapi.json` |
| `npm run format`    | Prettier                                                   |

## Structure

See [CLAUDE.md](CLAUDE.md) for the architecture rules (route files in `app/`, everything else in `src/`, theme tokens, session/refresh behaviour, how to add a screen). Design reference: `docs/design/kombin-app-tasarimi.pdf`. API contract: `docs/openapi.json`.

## Notes

- Tokens: access token in memory only; refresh token in `expo-secure-store`.
- Not included yet (by design): push notifications, offline cache, analytics, deep links.

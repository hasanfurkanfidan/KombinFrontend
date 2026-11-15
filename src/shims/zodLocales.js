// Stands in for zod's `v4/locales/index.js` in the app bundle (see metro.config.js). zod re-exports all of its 40+
// locales from its entry points (about 300 KB of source); the app writes its own Turkish messages on every schema and
// never calls `z.locales.*`. English stays: zod registers it as the default itself, straight from `locales/en.js`.
export { default as en } from 'zod/v4/locales/en.js';

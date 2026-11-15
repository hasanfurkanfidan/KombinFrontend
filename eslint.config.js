const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Node scripts and config plugins run on the developer's machine or EAS, never in the app.
    files: ['scripts/**/*.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
  },
  globalIgnores(['dist/*', '.expo/*', 'src/api/types.gen.ts', 'coverage/*', '.claude/**']),
]);

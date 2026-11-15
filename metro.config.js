// Metro configuration: Expo's defaults plus two resolver fixes that keep dead weight out of the app bundle
// (measured in docs/mobile-review.md, "Bundle"). Jest does not use this file.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `@hookform/resolvers` is CommonJS and `require`s react-hook-form, which resolves to its CJS build, while the app's
// own `import`s resolve to the ESM build: two copies of the library (~46 KB) in one bundle. Everyone gets the ESM one.
const REACT_HOOK_FORM = path.join(__dirname, 'node_modules/react-hook-form/dist/index.esm.mjs');

const ZOD_LOCALES_STUB = path.join(__dirname, 'src/shims/zodLocales.js');
const ZOD_DIR = `${path.sep}node_modules${path.sep}zod${path.sep}v4${path.sep}`;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-hook-form') {
    return { type: 'sourceFile', filePath: REACT_HOOK_FORM };
  }
  if (moduleName === '../locales/index.js' && context.originModulePath.includes(ZOD_DIR)) {
    return { type: 'sourceFile', filePath: ZOD_LOCALES_STUB };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

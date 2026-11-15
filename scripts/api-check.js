#!/usr/bin/env node
// Fails when src/api/types.gen.ts is not what `npm run api:types` would generate from docs/openapi.json
// (the contract was updated without regenerating the types, or the types were edited by hand).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const committed = path.join(root, 'src', 'api', 'types.gen.ts');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombin-api-check-'));
const generated = path.join(tmpDir, 'types.gen.ts');

const run = spawnSync('npx', ['openapi-typescript', 'docs/openapi.json', '-o', generated], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: process.platform === 'win32',
});
if (run.status !== 0) {
  console.error('api:check: openapi-typescript failed');
  process.exit(run.status ?? 1);
}

// Line endings differ between checkouts (git's autocrlf on Windows), content must not.
const normalize = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const same = normalize(generated) === normalize(committed);
fs.rmSync(tmpDir, { recursive: true, force: true });

if (!same) {
  console.error(
    'api:check: src/api/types.gen.ts is out of sync with docs/openapi.json. Run `npm run api:types` and commit the result.',
  );
  process.exit(1);
}
console.log('api:check: src/api/types.gen.ts matches docs/openapi.json');

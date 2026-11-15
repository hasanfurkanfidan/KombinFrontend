#!/usr/bin/env node
// Bundle-size budget: exports the Android bundle and fails when its Hermes bytecode grows past the limit in
// scripts/size-budget.json (the size measured when the budget was set + 5 %). `--update` re-measures and resets it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BUDGET_FILE = path.join(__dirname, 'size-budget.json');
const HEADROOM = 1.05;

function exportBundle(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const result = spawnSync(
    'npx',
    ['expo', 'export', '--platform', 'android', '--source-maps', '--output-dir', outDir],
    { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' },
  );
  if (result.status !== 0) {
    console.error('size:check: expo export failed');
    process.exit(result.status ?? 1);
  }
  const dir = path.join(outDir, '_expo', 'static', 'js', 'android');
  const bundle = fs.readdirSync(dir).find((name) => name.endsWith('.hbc'));
  if (!bundle) {
    console.error(`size:check: no .hbc bundle in ${dir}`);
    process.exit(1);
  }
  return fs.statSync(path.join(dir, bundle)).size;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

const outDir = path.join(os.tmpdir(), 'kombin-size-check');
const size = exportBundle(outDir);
const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));

if (process.argv.includes('--update')) {
  budget.measuredOn = new Date().toISOString().slice(0, 10);
  budget.androidHbcBytes = size;
  budget.limitBytes = Math.round(size * HEADROOM);
  fs.writeFileSync(BUDGET_FILE, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`size:check: budget reset to ${kb(budget.limitBytes)} (measured ${kb(size)})`);
  process.exit(0);
}

const delta = size - budget.androidHbcBytes;
console.log(
  `size:check: android bundle ${kb(size)} (budget ${kb(budget.limitBytes)}, ` +
    `${delta >= 0 ? '+' : ''}${kb(delta)} since ${budget.measuredOn})`,
);
if (size > budget.limitBytes) {
  console.error(
    'size:check: over budget. Find what grew (docs/mobile-review.md, "Bundle") before raising it.',
  );
  process.exit(1);
}

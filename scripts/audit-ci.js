#!/usr/bin/env node
// CI gate over `npm audit --omit=dev`. Every advisory must be listed in scripts/audit-allowlist.json at its ROOT package
// (id, reason, review date). `npm audit` also reports each package that merely depends on a vulnerable one (picomatch ->
// micromatch -> metro -> react-native ...): such a package passes when everything it is vulnerable through is allow-listed,
// so the allow-list never names the dependants. Anything with an advisory of its own that is not listed fails the run.
// scripts/size-check.js separately fails when a listed root package is found in the Android bundle.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const allow = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-allowlist.json'), 'utf8'));
const allowed = new Map(allow.advisories.map((entry) => [entry.id, entry]));

const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
  maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error('audit:ci: npm audit did not return JSON');
  console.error(run.stderr);
  process.exit(1);
}
if (report.error) {
  console.error(
    `audit:ci: npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`,
  );
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const seen = new Set();
const unlisted = new Map();

const advisoryId = (via) => /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? String(via.source);

// A package is covered when every path out of it ends in an allow-listed advisory. `visiting` breaks dependency cycles
// (a cycle adds no advisory of its own).
function covered(name, visiting = new Set()) {
  if (visiting.has(name)) return true;
  const entry = vulnerabilities[name];
  if (!entry) return true;
  visiting.add(name);
  let ok = entry.via.length > 0;
  for (const via of entry.via) {
    if (typeof via === 'string') {
      if (!covered(via, visiting)) ok = false;
      continue;
    }
    const id = advisoryId(via);
    const listed = allowed.get(id);
    if (listed && listed.package === via.name) {
      seen.add(id);
    } else {
      ok = false;
      unlisted.set(id, via);
    }
  }
  visiting.delete(name);
  return ok;
}

const names = Object.keys(vulnerabilities);
const blocking = names.filter((name) => !covered(name));

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `audit:ci: ${names.length} vulnerable packages (critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, ` +
    `moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0}) from ${seen.size} allow-listed advisories`,
);
for (const id of allowed.keys()) {
  if (!seen.has(id)) console.log(`audit:ci: note: ${id} is allow-listed but no longer reported; remove it.`);
}
if (blocking.length > 0 || unlisted.size > 0) {
  for (const [id, via] of unlisted) {
    console.error(`  ${String(via.severity).padEnd(8)} ${via.name}  ${id}  ${via.title}`);
  }
  console.error(
    `audit:ci: ${blocking.length} packages are vulnerable through advisories that are not in scripts/audit-allowlist.json.\n` +
      'audit:ci: update to a patched version first; list an advisory only with its reason, and never one whose package ships in the app.',
  );
  process.exit(1);
}

#!/usr/bin/env node
// CI gate over `npm audit --omit=dev`: fails on any high or critical advisory, and on any lower one whose package is
// not in scripts/audit-allowlist.json (build tooling that never reaches the app bundle, each entry with a reason).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const allow = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-allowlist.json'), 'utf8'));

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

const findings = Object.entries(report.vulnerabilities ?? {});
const blocking = findings.filter(
  ([name, entry]) =>
    RANK[entry.severity] > RANK[allow.maxSeverity] || !allow.packages.includes(name),
);

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `audit:ci: ${findings.length} vulnerable packages (critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, ` +
    `moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0}); allow-list reviewed ${allow.reviewedOn}`,
);
if (blocking.length > 0) {
  for (const [name, entry] of blocking) {
    console.error(`  ${entry.severity.padEnd(8)} ${name}`);
  }
  console.error(
    'audit:ci: fix these, or add a build-only package to scripts/audit-allowlist.json with its reason.',
  );
  process.exit(1);
}

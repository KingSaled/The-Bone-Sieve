// Regenerates the extracts, then runs every suite and reports one total.
// `node tools/test/run-all.js` from anywhere in the repo; exits non-zero if
// any suite does, so it works as a pre-commit or CI gate unchanged.
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  'test-meta.js',        // the ledger: load, save, repair, migrate
  'test-gate.js',        // what a run is allowed to draw
  'test-econ.js',        // earning, pricing, depth gates, buying
  'test-gameover.js',    // the payout band on the death screen (jsdom)
  'test-archive-ui.js',  // the Archive screen, driven by clicks (jsdom)
  'test-chalk-wipe.js',  // chalk gating, the deepchalk boon, and the wipe (jsdom)
  'test-oaths.js',       // the four Rite ladders, and what they do to a real run
];

const verbose = process.argv.includes('--verbose');

execFileSync(process.execPath, [path.join(__dirname, 'extract.js')], { stdio: 'inherit' });

let total = 0, failed = [];
for (const s of SUITES) {
  const r = spawnSync(process.execPath, [path.join(__dirname, s)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(?:ALL PASS — |FAILED \d+ \/ )(\d+) assertions/);
  const n = m ? Number(m[1]) : 0;
  total += n;
  const ok = r.status === 0;
  if (!ok) failed.push(s);
  console.log((ok ? '  ok   ' : '  FAIL ') + s.padEnd(20) + n + ' assertions');
  // A failing suite prints its whole log whether asked to or not — a red line
  // with no reason under it is the one thing a test runner must never do.
  if (verbose || !ok) console.log(out.replace(/^/gm, '      '));
}

console.log('\n' + (failed.length
  ? failed.length + ' SUITE(S) FAILED: ' + failed.join(', ')
  : 'ALL PASS') + ' — ' + total + ' assertions across ' + SUITES.length + ' harnesses');
process.exit(failed.length ? 1 : 0);

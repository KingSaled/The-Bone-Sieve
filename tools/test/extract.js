// Re-cuts every test extract from the live index.html, by name rather than by
// line number, so the suites always run against what is actually shipped.
//
// The game is one HTML file with one <script> in it and no module boundaries,
// which is deliberate — but it means a test cannot `require` a function out of
// it. So each suite gets the real source of the part it exercises, sliced out
// by the banner comments and declarations that already delimit the file, and
// evaluated with `new Function`. Cutting by name rather than by line number is
// the whole trick: index.html can grow by a thousand lines and these still
// find their section.
//
// Everything lands in build/, which is gitignored — it is derived from
// index.html and regenerated on every run, so it is never the source of truth.
const fs = require('fs'), path = require('path');

const SRC = path.join(__dirname, '..', '..', 'index.html');
const BUILD = path.join(__dirname, 'build');

const html = fs.readFileSync(SRC, 'utf8');
const L = html.split('\n');
const at = (re, from = 0) => { for (let i = from; i < L.length; i++) if (re.test(L[i])) return i; return -1; };
const fn = startRe => { const a = at(startRe); return L.slice(a, at(/^\}/, a + 1) + 1).join('\n'); };
// `inc` includes the matched end line, which matters for one-line tails like
// `const DIE_ORDER = Object.keys(DIE_TYPES);`
const upto = (startRe, endRe, inc) => { const a = at(startRe); return L.slice(a, at(endRe, a + 1) + (inc ? 1 : 0)).join('\n'); };

fs.mkdirSync(BUILD, { recursive: true });
const out = p => path.join(BUILD, p);

// content tables + the whole meta section + the shop draw
const twEnd = at(/^\}/, at(/^function tierWeight/) + 1);
const econ = [
  upto(/^const GRID = 5;/, /^\/\/=+$/),
  upto(/^const DIE_TYPES = \{/, /^const DIE_ORDER/, true),
  upto(/^const RELICS = \{/, /^const TIER_NAME/),
  L.slice(at(/^const DIE_WARES = \[/), twEnd + 1).join('\n'),
  L.slice(at(/^\/\/ 9b\./), at(/^\/\/ 10\. GAME STATE/) - 1).join('\n'),
  fn(/^function rollOffers\(\)\{/),
].join('\n\n');
fs.writeFileSync(out('econ.js'), econ);
fs.writeFileSync(out('gate.js'), econ);   // the gating suite needs the same surface
fs.writeFileSync(out('meta.js'), econ);   // and so does the ledger suite

fs.writeFileSync(out('arcui.js'),
  L.slice(at(/^\/\/---- THE ARCHIVE ---/), at(/^function openMenu/)).join('\n'));
fs.writeFileSync(out('gameover.js'), fn(/^function gameOver\(\)\{/));
// the wipe block: from its banner down to the Archive's cancel handler
fs.writeFileSync(out('wipe.js'),
  L.slice(at(/^\/\/---- scouring the Archive ---/), at(/^\$\('btnArcCancel'\)\.onclick/)).join('\n'));
// BOONS table + rollBoons(), for the deepchalk-suppression check
fs.writeFileSync(out('boons.js'),
  upto(/^const BOONS = \[/, /^for\(const b of BOONS\)/, true) + '\n' + fn(/^function rollBoons\(\)\{/));
fs.writeFileSync(out('body.html'),
  html.slice(html.indexOf('<body'), html.indexOf('<script>')) + '</body>');

// the shipped file must itself parse
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
console.log('extracts regenerated; index.html parses');

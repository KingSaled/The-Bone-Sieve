# Test harnesses

Six suites, driving the **real** code and the **real** markup out of
`index.html`. Nothing here reimplements game logic — if a test and the game
disagree, the game is what shipped and the test is what caught it.

```
cd tools/test
npm install       # jsdom, once
npm test          # regenerates extracts, runs all six, prints one total
npm run test:verbose
```

A failing suite prints its whole log automatically. `npm test` exits non-zero
if any suite does, so it works as a pre-commit or CI gate unchanged.

## How they get at the code

The game is one HTML file with one `<script>` in it and no module boundaries.
That is deliberate — it is what makes the game a single file you can open from
disk — but it means a test cannot `require` a function out of it.

So `extract.js` slices the real source out of `index.html` **by name**, using
the banner comments and declarations that already delimit the file, and the
suites evaluate those slices with `new Function`. Cutting by name rather than
by line number is the whole trick: `index.html` can grow by a thousand lines
and the extracts still find their section. If a section is ever renamed,
`extract.js` fails loudly rather than silently testing the wrong lines.

Extracts land in `build/`, which is gitignored — they are derived from
`index.html`, regenerated on every run, and never the source of truth.

`extract.js` also parses the whole shipped `<script>` as a last step, so a
syntax error anywhere in the game fails the run even if no suite covers it.

## The suites

| Suite | What it holds down |
|---|---|
| `test-meta.js` | The ledger: load, save, repair, hostile input, migration |
| `test-gate.js` | What a run may draw — 200 simulated runs, 20 descents each |
| `test-econ.js` | The earn formula, pricing, depth gates, buying |
| `test-gameover.js` | The death screen's Marrow payout band (jsdom) |
| `test-archive-ui.js` | The Archive, driven by real clicks (jsdom) |
| `test-chalk-wipe.js` | Chalk gating, the deepchalk boon, SCOUR THE ARCHIVE (jsdom) |
| `test-oaths.js` | The four Rite ladders, and what they do to a real started run (jsdom) |
| `test-loadout.js` | §11 switches: owned content set aside, and gone from shop and boon draws (jsdom) |
| `test-archive-view.js` | The screen itself: panel, tabs, filters, search — with the real CSS loaded |

## Seeing it: `shoot.js`

```
node shoot.js                         # the Archive at 1920x1080 -> shots/
node shoot.js --width 1366 --height 768 --out shots/laptop
```

Drives the **real Chrome already installed on the machine** through
puppeteer-core (which downloads no browser of its own), seeds a career worth
looking at, opens the Archive and screenshots it. It also prints the numbers
that matter for a layout change: whether the panel fits the viewport, whether
the page scrolls when it should not, how many tiles are on a row, and whether
every tile is the same size.

Set `CHROME=/path/to/chrome` if it is somewhere unusual.

Earlier work on this branch recorded that there was no browser here and left
layout unverified for three phases running. That was simply wrong — nobody had
looked. Two of the bugs in the Archive redesign were invisible to jsdom and
obvious in a screenshot.

## What they do not cover

**Paint, motion and feel.** `test-archive-view.js` loads the real stylesheet
into jsdom, so it can answer what a class *does* — but jsdom has no layout
engine, so it will happily report a height for a box that has none. `shoot.js`
covers geometry. Neither covers animation, colour rendering, or whether the
thing looks any good, and nothing here should be read as claiming otherwise.

**A note on class assertions.** Checking `classList.contains('hidden')` proves
the class was applied and nothing else. The tab panes were switched with a
class no CSS rule matched, and every assertion passed while both tabs rendered
on top of each other. Where a class is supposed to *do* something, assert the
computed style instead.

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

## What they do not cover

**Layout and paint.** There is no browser in the dev environment, so jsdom
gives us structure, class names and text — never geometry, never colour,
never whether a thing is actually visible on screen. Anything about how the
game *looks* still has to be checked by opening `index.html`.

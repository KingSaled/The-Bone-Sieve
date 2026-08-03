// Drives the REAL gameOver() against the real death-screen markup in jsdom,
// checking the Marrow payout band and that the ledger is settled exactly once.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const econ = fs.readFileSync(B('econ.js'), 'utf8');
const go   = fs.readFileSync(B('gameover.js'), 'utf8');
const body = fs.readFileSync(B('body.html'), 'utf8');

const { window } = new JSDOM('<!doctype html><html>' + body + '</html>', { url:'https://local.test/' });
const { document } = window;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

const preamble = `
  let S = null, menuMode = false, shake = 0;
  function hasRelic(r){ return !!S && S.relics.includes(r); }
  const $ = id => document.getElementById(id);
  function show(id){ $(id).classList.remove('hidden'); }
  function icon(name, cls){ return '<svg class="ic ' + (cls||'') + '" data-i="' + name + '"></svg>'; }
  function buildBoneFrames(){} function showTally(){} function sfx(){} function syncUI(){}
`;
const run = new Function('window','document','localStorage',
  preamble + econ + '\n' + go + `
  return {Meta, gameOver, closeOutRun, setS: v => { S = v; }, getS: () => S};
`);

const store = {};
const G = run(window, document,
  { getItem:k => (k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=String(v); } });
const $ = id => document.getElementById(id);
G.Meta.load();

const mkRun = (level, total, best, trials) => ({
  level, quota:5000, levelScore:1200, totalScore:total,
  stats:{best, trialsCleared:trials, conduits:41, levelsCleared:level-1},
  relics:[], marrowPaid:false,
});

console.log('\n1. a first run: every component pays, PB included');
G.setS(mkRun(10, 20000, 5000, 2));
G.gameOver();
{
  const t = $('goMarrow').textContent.replace(/\s+/g,' ');
  eq('band is visible', $('goMarrow').style.display, '');
  eq('total shown', /\+99/.test(t), true);
  eq('depth chip',    /DEPTH \+30/.test(t), true);
  eq('blood chip',    /BLOOD \+14/.test(t), true);
  eq('offering chip', /OFFERING \+5/.test(t), true);
  eq('PB chip',       /DEEPER THAN EVER \+50/.test(t), true);
  eq('PB headline',   /A NEW DEEPEST/.test(t), true);
  eq('running total shown', /the Archive holds 99 marrow/.test(t), true);
  eq('PB chip is styled loud', !!$('goMarrow').querySelector('.goMarrowParts span.pb'), true);
  eq('ledger credited', G.Meta.data.marrow, 99);
  eq('the six run slabs are untouched', $('goStats').querySelectorAll('.gslab').length, 6);
}

console.log('\n2. calling gameOver twice cannot pay twice');
G.gameOver();
eq('marrow unchanged', G.Meta.data.marrow, 99);
eq('runs counted once', G.Meta.data.lifetime.runs, 1);
eq('band hidden on the repeat render', $('goMarrow').style.display, 'none');

console.log('\n3. a shallower second run: no PB, band still shows');
G.setS(mkRun(4, 4000, 1200, 0));
G.gameOver();
{
  const t = $('goMarrow').textContent.replace(/\s+/g,' ');
  eq('total is 19', /\+19/.test(t), true);
  eq('no PB chip', /DEEPER THAN EVER/.test(t), false);
  eq('neutral headline', /^THE ARCHIVE PAYS/.test(t.trim()), true);
  eq('zero components are omitted', /OFFERING/.test(t), true);   // roll = 1, still shown
  eq('marrow accumulated', G.Meta.data.marrow, 118);
  eq('deepest did not regress', G.Meta.data.lifetime.deepestLevel, 10);
}

console.log('\n4. a run that dies on level 1 with nothing');
G.setS(mkRun(1, 0, 0, 0));
G.gameOver();
{
  const t = $('goMarrow').textContent.replace(/\s+/g,' ');
  eq('still pays for the depth', /\+3/.test(t), true);
  eq('empty components omitted', /BLOOD/.test(t), false);
  eq('runs counted', G.Meta.data.lifetime.runs, 3);
}

console.log('\n5. the payout is on disk before the player can close the tab');
{
  const saved = JSON.parse(store['boneSieveMeta']);
  eq('marrow persisted at death', saved.marrow, G.Meta.data.marrow);
  eq('lifetime persisted at death', saved.lifetime.runs, 3);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

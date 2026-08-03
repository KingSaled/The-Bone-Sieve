// Drives the REAL Archive screen — the actual markup from index.html plus the
// real renderArchive/arcState/buyUnlock/click handlers — inside jsdom.
// This is the "play through unlocking a few items" pass.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const econ  = fs.readFileSync(B('econ.js'), 'utf8');
const arcui = fs.readFileSync(B('arcui.js'), 'utf8');
const body  = fs.readFileSync(B('body.html'), 'utf8');

const dom = new JSDOM('<!doctype html><html>' + body + '</html>',
                      { url: 'https://local.test/' });
const { window } = dom;
const { document } = window;

let pass = 0, fail = 0, toasts = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

// Everything the Archive block touches that lives elsewhere in the file.
const preamble = `
  let S = null, menuMode = true;
  function hasRelic(r){ return !!S && S.relics.includes(r); }
  const $ = id => document.getElementById(id);
  function show(id){ $(id).classList.remove('hidden'); }
  function hide(id){ $(id).classList.add('hidden'); }
  function icon(name, cls){ return '<svg class="ic ' + (cls||'') + '" data-i="' + name + '"></svg>'; }
  function buildBoneFrames(){}
  function sfx(){}
  function toast(t, i){ __toast(t, i); }
  // verbatim from index.html, defined just above the Archive block
  function menuScreen(id){
    ['menuHome','menuRules','menuArchive'].forEach(s=>$(s).classList.toggle('hidden', s!==id));
  }
`;

const run = new Function('window','document','localStorage','__toast',
  preamble + econ + '\n' + arcui + `
  return {Meta, renderArchive, openArchive, menuScreen, archiveRoster, buyUnlock,
          arcState, runShopPool, rollOffers, marrowFor, closeOutRun,
          setS: v => { S = v; }};
`);

const store = {};
const G = run(window, document,
  { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = String(v); } },
  (t) => toasts.push(t));

const $ = id => document.getElementById(id);
const plaque = (kind, id) => $('arcRoster').querySelector(
  '.arcCard[data-kind="' + kind + '"][data-id="' + id + '"]');
const click = el => el.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
const stateOf = (kind, id) => {
  const c = plaque(kind, id).className;
  return ['owned','gated','buy','locked'].filter(s => c.split(' ').includes(s))[0];
};

G.Meta.load();

console.log('\n1. the screen opens and renders the full roster');
G.openArchive();
eq('archive screen is the visible one', $('menuArchive').classList.contains('hidden'), false);
eq('home screen hidden', $('menuHome').classList.contains('hidden'), true);
eq('52 plaques rendered', $('arcRoster').querySelectorAll('.arcCard').length, 52);
eq('marrow readout present', /MARROW/.test($('arcMarrow').innerHTML), true);
eq('marrow starts at 0', /^0/.test($('arcMarrow').textContent), true);
eq('lifetime stats shown', ['RITES','DEEPEST','BEST OFFERING','TRIALS']
   .every(s => $('arcLife').textContent.includes(s)), true);

console.log('\n2. a fresh save reads correctly at a glance');
eq('bone die owned', stateOf('die','bone'), 'owned');
eq('grave dust owned', stateOf('relic','dust'), 'owned');
eq('runt locked (no marrow)', stateOf('die','runt'), 'locked');
eq('lidless eye locked', stateOf('relic','eye'), 'locked');
eq('ash spine depth-gated', stateOf('relic','spine'), 'gated');
eq('crimson depth-gated', stateOf('die','crimson'), 'gated');
// the owned counts live on the filter chips now — the section headers they
// used to sit on were what made the rack too tall to fit a screen
eq('owned count on the bones chip', /1\/11/.test($('arcGroupChips').innerHTML), true);
eq('owned count on the relics chip', /7\/37/.test($('arcGroupChips').innerHTML), true);

console.log('\n3. locked entries show everything — a shopping list, not a mystery');
{
  const p = plaque('relic','eye');
  eq('name shown',  p.querySelector('.acName').textContent, 'Lidless Eye');
  eq('desc shown',  p.querySelector('.acDesc').textContent, '+0.8 to your Offering Multiplier.');
  eq('price shown', /60/.test(p.querySelector('.acFoot').textContent), true);
  eq('reads as unaffordable', /NOT ENOUGH/.test(p.querySelector('.acFoot').textContent), true);
  eq('rarity named on the tile', p.querySelector('.acTier').textContent, 'UNCOMMON');
  eq('and it carries its art window', !!p.querySelector('.acArt .ic'), true);
  const g = plaque('relic','spine');
  eq('gated entry names its depth', /REACH DESCENT 15/.test(g.querySelector('.acFoot').textContent), true);
  eq('gated entry still shows its desc', g.querySelector('.acDesc').textContent.length > 10, true);
}

console.log('\n4. clicking an unaffordable plaque does nothing');
click(plaque('die','runt'));
eq('no confirm opened', $('arcConfirmOverlay').classList.contains('hidden'), true);

console.log('\n5. play: bank a run, then buy the Runt Die');
G.setS({level:10, totalScore:20000, stats:{best:5000, trialsCleared:2},
        relics:[], chalks:[], dicePool:[], offers:[], selIdx:null, shopRerolls:0,
        wares:G.runShopPool()});
G.closeOutRun();                      // 30 + 14 + 5 + 50 PB = 99
G.renderArchive();
eq('marrow now shows 99', /^99/.test($('arcMarrow').textContent), true);
eq('runt is now buyable', stateOf('die','runt'), 'buy');
eq('lifetime deepest updated on screen', /DEEPEST\s*10/.test($('arcLife').textContent.replace(/\s+/g,' ')), true);

click(plaque('die','runt'));
eq('confirm opened', $('arcConfirmOverlay').classList.contains('hidden'), false);
eq('confirm names the item', $('arcWhat').textContent.trim(), 'Runt Die');
eq('confirm shows hold / cost / what is left', $('arcCost').textContent.replace(/\s+/g,' '),
   'YOU HOLD99THIS COSTS15YOU KEEP84');
eq('cancel spends nothing', (()=>{ click($('btnArcCancel'));
   return [$('arcConfirmOverlay').classList.contains('hidden'), G.Meta.data.marrow]; })(),
   [true, 99]);

click(plaque('die','runt'));
click($('btnArcConfirm'));
eq('marrow spent', G.Meta.data.marrow, 84);
eq('runt now owned on screen', stateOf('die','runt'), 'owned');
eq('confirm closed', $('arcConfirmOverlay').classList.contains('hidden'), true);
eq('a toast announced it', toasts.pop(), 'RUNT DIE JOINS THE POOL');
eq('bones chip now 2/11', /2\/11/.test($('arcGroupChips').innerHTML), true);

console.log('\n6. buy a relic too, then confirm both reach a run');
G.Meta.data.marrow = 500; G.renderArchive();
click(plaque('relic','eye'));
click($('btnArcConfirm'));
eq('lidless eye owned', stateOf('relic','eye'), 'owned');
eq('marrow spent', G.Meta.data.marrow, 440);
{
  const pool = G.runShopPool();
  eq('runt in the next run\'s pool', pool.some(i=>i.die==='runt'), true);
  eq('eye in the next run\'s pool', pool.some(i=>i.relic==='eye'), true);
  const S = {level:8, relics:[], chalks:[], dicePool:[], offers:[], selIdx:null,
             shopRerolls:0, wares:pool};
  G.setS(S);
  const seen = new Set();
  for(let i=0;i<4000;i++){ G.rollOffers(); for(const o of S.offers){ if(o.die) seen.add('die:'+o.die); if(o.relic) seen.add('relic:'+o.relic); } }
  eq('runt is actually offered in play', seen.has('die:runt'), true);
  eq('eye is actually offered in play', seen.has('relic:eye'), true);
  eq('an unbought die is still withheld', seen.has('die:twin'), false);
  eq('a gated relic is still withheld', seen.has('relic:spine'), false);
}

console.log('\n7. the depth gate opens on screen once earned');
eq('spine still gated at deepest 10', stateOf('relic','spine'), 'gated');
G.Meta.data.lifetime.deepestLevel = 15; G.Meta.save();   // as closeOutRun would
G.renderArchive();
eq('spine becomes buyable at 15', stateOf('relic','spine'), 'buy');
eq('crimson (tier 4) still gated at 15', stateOf('die','crimson'), 'gated');
G.Meta.data.lifetime.deepestLevel = 25; G.Meta.save();
G.renderArchive();
eq('crimson buyable at 25', stateOf('die','crimson'), 'buy');

console.log('\n8. it all survives a reload');
{
  const before = {marrow:G.Meta.data.marrow, dice:G.Meta.data.unlockedDice.slice(),
                  relics:G.Meta.data.unlockedRelics.slice(),
                  life:JSON.parse(JSON.stringify(G.Meta.data.lifetime))};
  G.Meta.load();
  eq('marrow persisted', G.Meta.data.marrow, before.marrow);
  eq('unlocked dice persisted', G.Meta.data.unlockedDice.sort(), before.dice.sort());
  eq('unlocked relics persisted', G.Meta.data.unlockedRelics.sort(), before.relics.sort());
  eq('lifetime persisted', G.Meta.data.lifetime, before.life);
}

console.log('\n9. return to the title screen');
G.menuScreen('menuHome');
eq('archive hidden again', $('menuArchive').classList.contains('hidden'), true);
eq('home visible again', $('menuHome').classList.contains('hidden'), false);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

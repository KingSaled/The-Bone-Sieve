// Covers the post-Phase-3 balance pass: chalks gated, Deepen the Sigil
// retiered, the deepchalk boon suppressed when no chalk exists — and the
// SCOUR THE ARCHIVE wipe, driven through the real dialog in jsdom.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const econ  = fs.readFileSync(B('econ.js'), 'utf8');
const arcui = fs.readFileSync(B('arcui.js'), 'utf8');
const wipe  = fs.readFileSync(B('wipe.js'), 'utf8');
const boons = fs.readFileSync(B('boons.js'), 'utf8');
const body  = fs.readFileSync(B('body.html'), 'utf8');

const { window } = new JSDOM('<!doctype html><html>' + body + '</html>', { url:'https://local.test/' });
const { document } = window;

let pass = 0, fail = 0, toasts = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

const preamble = `
  let S = null, menuMode = true;
  function hasRelic(r){ return !!S && S.relics.includes(r); }
  const $ = id => document.getElementById(id);
  function show(id){ $(id).classList.remove('hidden'); }
  function hide(id){ $(id).classList.add('hidden'); }
  function icon(n, c){ return '<svg class="ic ' + (c||'') + '" data-i="' + n + '"></svg>'; }
  function buildBoneFrames(){} function hydrateIcons(){} function sfx(){}
  function toast(t, i){ __toast(t, i); }
  function menuScreen(id){
    ['menuHome','menuRules','menuArchive'].forEach(s=>$(s).classList.toggle('hidden', s!==id));
  }
  function boonTierBias(level){ return 1 + Math.min(3, Math.max(0, level - 5)/8); }
  function boonCount(id){ return S && S.boons ? S.boons.filter(b=>b===id).length : 0; }
  const BOON_TIER_NAME = {1:'A FAVOUR',2:'A BLESSING',3:'A GREAT BOON',4:'AN APOTHEOSIS'};
`;
const run = new Function('window','document','localStorage','__toast',
  preamble + econ + '\n' + boons + '\n' + arcui + '\n' + wipe + `
  return {Meta, renderArchive, openArchive, archiveRoster, buyUnlock, runShopPool,
          rollOffers, rollBoons, openWipe, closeWipe, closeOutRun, CHALK_WARES,
          setS: v => { S = v; }};
`);

const store = {};
const G = run(window, document,
  { getItem:k => (k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=String(v); } },
  t => toasts.push(t));
const $ = id => document.getElementById(id);
const plaque = (kind,id) => $('arcRoster').querySelector('.arcItem[data-kind="'+kind+'"][data-id="'+id+'"]');
const click = el => el.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
const stateOf = (k,i) => ['owned','gated','buy','locked'].filter(s=>plaque(k,i).className.split(' ').includes(s))[0];

G.Meta.load();

console.log('\n1. Deepen the Sigil has moved tier');
{
  const d = G.CHALK_WARES.find(w=>w.id==='chalk_deepen');
  eq('now tier 4', d.tier, 4);
  eq('shard price raised to 30', d.price, 30);
  eq('dearest chalk on the counter', d.price > Math.max(
     ...G.CHALK_WARES.filter(w=>w.id!=='chalk_deepen').map(w=>w.price)), true);
  const cross = G.CHALK_WARES.find(w=>w.id==='chalk_cross');
  eq('a clear step above Crossed Sigil', [d.tier - cross.tier, d.price - cross.price], [1, 8]);
}

console.log('\n2. a fresh save has no chalk at all');
{
  const pool = G.runShopPool();
  eq('no chalk in the run pool', pool.filter(i=>i.kind==='chalk').length, 0);
  eq('opening pool is 1 die + 7 relics', pool.length, 8);
  eq('catalogue still holds all four chalks',
     G.archiveRoster().filter(e=>e.kind==='chalk').length, 4);
}
// and none is ever drawn, however hard the shop is worked
{
  const S = {level:20, relics:[], chalks:[{axis:'row',mult:3}], dicePool:[], offers:[],
             selIdx:null, shopRerolls:0, wares:G.runShopPool()};
  G.setS(S);
  const seen = new Set();
  for(let i=0;i<5000;i++){ G.rollOffers(); for(const o of S.offers) seen.add(o.kind); }
  eq('5,000 shops, zero chalk', seen.has('chalk'), false);
}

console.log('\n3. the deepchalk boon is withheld while no chalk is owned');
{
  const S = {level:25, relics:[], chalks:[], dicePool:[], boons:[], offers:[],
             selIdx:null, shopRerolls:0, wares:G.runShopPool()};
  G.setS(S);
  const seen = new Set();
  for(let i=0;i<4000;i++) for(const b of G.rollBoons()) seen.add(b.id);
  eq('deepchalk never offered', seen.has('deepchalk'), false);
  eq('other boons still offered', seen.size > 10, true);
}
// ...but it must come back for any run where a line CAN exist
{
  const base = () => ({level:25, relics:[], chalks:[], dicePool:[], boons:[], offers:[],
                       selIdx:null, shopRerolls:0, wares:G.runShopPool()});
  const offers = mutate => {
    const S = base(); mutate(S); G.setS(S);
    const seen = new Set();
    for(let i=0;i<4000;i++) for(const b of G.rollBoons()) seen.add(b.id);
    return seen.has('deepchalk');
  };
  eq('live when a line is already scrawled', offers(S=>{ S.chalks.push({axis:'row',mult:3}); }), true);
  eq('live when the Ninth Sigil draws one free', offers(S=>{ S.relics.push('sigil'); }), true);
}

console.log('\n4. the Archive lists chalks, gated like everything else');
G.openArchive();
eq('52 plaques now', $('arcRoster').querySelectorAll('.arcItem').length, 52);
eq('a chalks group exists', /THE CHALKS/.test($('arcRoster').innerHTML), true);
eq('chalks start 0/4', /0\/4/.test($('arcRoster').innerHTML), true);
eq('row chalk locked', stateOf('chalk','chalk_row'), 'locked');
eq('cross chalk depth-gated (tier 3)', stateOf('chalk','chalk_cross'), 'gated');
eq('deepen depth-gated (tier 4)', stateOf('chalk','chalk_deepen'), 'gated');
eq('deepen names descent 25',
   /REACH DESCENT 25/.test(plaque('chalk','chalk_deepen').querySelector('.aFoot').textContent), true);
eq('row chalk shows its marrow price',
   /36/.test(plaque('chalk','chalk_row').querySelector('.aFoot').textContent), true);

console.log('\n5. buying a chalk, and it reaching a run');
G.Meta.data.marrow = 500; G.renderArchive();
eq('row chalk now buyable', stateOf('chalk','chalk_row'), 'buy');
click(plaque('chalk','chalk_row'));
click($('btnArcConfirm'));
eq('chalk recorded in its own list', G.Meta.data.unlockedChalks, ['chalk_row']);
eq('marrow spent', G.Meta.data.marrow, 500 - 36);
eq('shows as owned', stateOf('chalk','chalk_row'), 'owned');
{
  const pool = G.runShopPool();
  eq('row chalk in the next run\'s pool', pool.some(i=>i.id==='chalk_row'), true);
  eq('the other three are still withheld', pool.filter(i=>i.kind==='chalk').length, 1);
  const S = {level:12, relics:[], chalks:[], dicePool:[], boons:[], offers:[],
             selIdx:null, shopRerolls:0, wares:pool};
  G.setS(S);
  const seen = new Set();
  for(let i=0;i<3000;i++){ G.rollOffers(); for(const o of S.offers) if(o.kind==='chalk') seen.add(o.id); }
  eq('row chalk is actually offered', seen.has('chalk_row'), true);
  eq('and nothing else chalk-shaped is', [...seen], ['chalk_row']);
  // owning a chalk brings the boon back
  const bseen = new Set();
  S.level = 25;
  for(let i=0;i<4000;i++) for(const b of G.rollBoons()) bseen.add(b.id);
  eq('deepchalk boon returns once a chalk is owned', bseen.has('deepchalk'), true);
}

console.log('\n6. SCOUR THE ARCHIVE — the dialog');
G.setS({level:18, totalScore:60000, stats:{best:9000, trialsCleared:3},
        relics:[], chalks:[], dicePool:[], offers:[], selIdx:null, shopRerolls:0,
        wares:G.runShopPool()});
G.closeOutRun();
G.buyUnlock('die','runt');
const before = {marrow:G.Meta.data.marrow, runs:G.Meta.data.lifetime.runs};
eq('there is a career to lose', [before.runs > 0, before.marrow > 0], [true, true]);

click($('btnWipe'));
eq('dialog opened', $('wipeOverlay').classList.contains('hidden'), false);
{
  const t = $('wipeWhat').textContent.replace(/\s+/g,' ');
  eq('names the marrow at stake', t.includes(String(before.marrow)), true);
  eq('counts the unlocks', /UNLOCKED/.test(t), true);
  eq('counts the rites run', /RITES RUN/.test(t), true);
  eq('says it cannot be undone',
     /THIS CANNOT BE UNDONE/.test($('wipeWarn').textContent), true);
}
click($('btnWipeCancel'));
eq('cancel closes it', $('wipeOverlay').classList.contains('hidden'), true);
eq('cancel destroys nothing', G.Meta.data.marrow, before.marrow);
eq('unlocks intact', G.Meta.data.unlockedDice.includes('runt'), true);

console.log('\n7. and when it is confirmed');
click($('btnWipe'));
click($('btnWipeConfirm'));
eq('dialog closed', $('wipeOverlay').classList.contains('hidden'), true);
eq('marrow zeroed', G.Meta.data.marrow, 0);
eq('lifetime zeroed', G.Meta.data.lifetime, {runs:0, deepestLevel:0, bestOffering:0, trialsCleared:0});
eq('dice back to bone alone', G.Meta.data.unlockedDice, ['bone']);
eq('chalks back to none', G.Meta.data.unlockedChalks, []);
eq('relics back to the seven tier-1',
   G.Meta.data.unlockedRelics, ['dust','candle','hook','nail','obol','censer','ember']);
eq('story flags cleared', [G.Meta.data.storyBeatsFired, G.Meta.data.storyComplete], [[], false]);
eq('rite ladders back to level 0',
   [G.Meta.data.rites.extraDie, G.Meta.data.rites.extraReroll,
    G.Meta.data.rites.cheapReroll, G.Meta.data.rites.extraShards], [0, 0, 0, 0]);
eq('announced', toasts.pop(), 'THE ARCHIVE IS SCOURED');
eq('the wipe is on disk, not just in memory', JSON.parse(store['boneSieveMeta']).marrow, 0);
eq('run pool is a fresh save\'s again', G.runShopPool().length, 8);

console.log('\n8. it is indistinguishable from a never-played save');
{
  const wiped = JSON.parse(JSON.stringify(G.Meta.data));
  store['boneSieveMeta'] = '';           // as if the key had never been written
  G.Meta.load();
  eq('byte-identical to a brand new ledger', wiped, G.Meta.data);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

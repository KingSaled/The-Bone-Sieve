// THE OATHS (design §3, restructured) — the four permanent ladders.
//
// Two halves. The first drives the real ladder economy and the real Archive
// tab in jsdom. The second starts a REAL run through the real startRun() and
// counts what is actually in the cup, in the purse and on the re-roll pips,
// because the whole point of an Oath is what it does at the mouth of a run and
// a test that only checked the ledger would have proved nothing.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const econ  = fs.readFileSync(B('econ.js'), 'utf8');
const arcui = fs.readFileSync(B('arcui.js'), 'utf8');
const runst = fs.readFileSync(B('runstart.js'), 'utf8');
const body  = fs.readFileSync(B('body.html'), 'utf8');

const { window } = new JSDOM('<!doctype html><html>' + body + '</html>', { url:'https://local.test/' });
const { document } = window;

let pass = 0, fail = 0, toasts = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

// Everything startRun() and the Archive touch that lives elsewhere in the file.
// startLevel is a stub: it is a whole level's worth of machinery and none of it
// is what this suite is about. The one line of it that matters here — it sets
// S.rerollsLeft = rerollsPerCast() — is asserted against the real
// rerollsPerCast() directly instead.
const preamble = `
  let menuMode = true, shake = 0;
  const $ = id => document.getElementById(id);
  function show(id){ $(id).classList.remove('hidden'); }
  function hide(id){ $(id).classList.add('hidden'); }
  function icon(n, c){ return '<svg class="ic ' + (c||'') + '" data-i="' + n + '"></svg>'; }
  function toast(t, i){ __toast(t, i); }
  function sfx(){} function buildBoneFrames(){} function hydrateIcons(){}
  function menuScreen(id){
    ['menuHome','menuRules','menuArchive'].forEach(s=>$(s).classList.toggle('hidden', s!==id));
  }
  const Sound = { unlock(){} };
  function leaveMenu(){} function closeSwap(){} function closeCull(){}
  function hideClearFx(){} function seedEmbers(){} function startLevel(){}
  function boonRerolls(){ return 0; }
`;
const run = new Function('window','document','localStorage','__toast',
  preamble + econ + '\n' + runst + '\n' + arcui + `
  return {Meta, RITES, RITE_BY_KEY, RITE_MAX, RITE_REROLL_FLOOR, RITE_SHARD_STEP,
          STARTING_BONES, riteLevel, ritePrice, riteDepthGate, riteGateMet,
          riteNextLevel, buyRite, oathState, renderArchive, openArchive,
          arcShowTab, closeOutRun, runShopPool, startRun, freshState,
          rerollsPerCast, shopRerollCost, maxPool, runRite,
          setS: v => { S = v; }, getS: () => S};
`);

const store = {};
const G = run(window, document,
  { getItem:k => (k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=String(v); } },
  t => toasts.push(t));

const $ = id => document.getElementById(id);
const row = key => $('arcOaths').querySelector('.oathCard[data-rite="' + key + '"]');
const click = el => el.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
const stateOf = key =>
  ['owned','gated','buy','locked'].filter(s => row(key).className.split(' ').includes(s))[0];

G.Meta.load();
const KEYS = ['extraDie','extraReroll','cheapReroll','extraShards'];

console.log('\n1. the four ladders, and the shape design §3 asked for');
eq('four Oaths', G.RITES.map(r=>r.key), KEYS);
eq('power ladders cap at 3', [G.RITE_MAX.extraDie, G.RITE_MAX.extraReroll], [3, 3]);
eq('economy ladders cap at 5', [G.RITE_MAX.cheapReroll, G.RITE_MAX.extraShards], [5, 5]);
for(const r of G.RITES){
  eq(r.key + ': one price per rung', r.prices.length, G.RITE_MAX[r.key]);
  eq(r.key + ': price climbs every rung',
     r.prices.every((p, i) => i === 0 || p > r.prices[i-1]), true);
}
// the director asked specifically that early rungs of the capped power ladders
// be noticeably cheaper than their last
eq('a power ladder\'s last rung costs well over its first',
   G.RITE_BY_KEY.extraDie.prices[2] >= G.RITE_BY_KEY.extraDie.prices[0] * 4, true);

console.log('\n2. the depth keys sit on the last two rungs of every ladder');
for(const k of KEYS){
  const max = G.RITE_MAX[k];
  eq(k + ': final rung wants descent 25', G.riteDepthGate(k, max), 25);
  eq(k + ': the rung below wants descent 15', G.riteDepthGate(k, max - 1), 15);
  eq(k + ': every earlier rung is ungated',
     Array.from({length:max-2}, (_,i) => G.riteDepthGate(k, i+1)), Array(max-2).fill(0));
}

console.log('\n3. a fresh ledger owns none of it');
G.openArchive();
G.arcShowTab('oaths');
eq('four cards rendered', $('arcOaths').querySelectorAll('.oathCard').length, 4);
eq('all at level 0', KEYS.map(G.riteLevel), [0, 0, 0, 0]);
eq('none sworn', /0\/4 SWORN/.test($('arcOaths').innerHTML), true);
eq('every ladder reads as unaffordable', KEYS.map(stateOf),
   ['locked','locked','locked','locked']);
eq('a card states its per-level rule',
   row('extraReroll').querySelector('.acDesc').textContent, '+1 re-roll on every cast.');
eq('an unsworn card says so', /not yet sworn/.test(row('extraDie').textContent), true);
eq('and its header reads unsworn', row('extraDie').querySelector('.acTier').textContent, 'UNSWORN');
eq('the pips count the rungs', row('cheapReroll').querySelectorAll('.oPip').length, 5);
eq('every pip carries a channel to fill',
   row('cheapReroll').querySelectorAll('.oPip .oPipFill').length, 5);
eq('none of them is filled yet', row('cheapReroll').querySelectorAll('.oPip.on').length, 0);
eq('the two gated rungs are drawn apart from the rest',
   row('cheapReroll').querySelectorAll('.oPip.gated').length, 2);
eq('an Oath carries the same art window as a roster tile',
   !!row('extraDie').querySelector('.acArt .ic'), true);

console.log('\n4. strict progression — a full purse cannot skip a rung');
G.Meta.data.marrow = 99999;
G.Meta.data.lifetime.deepestLevel = 0;
eq('rung 1 is what is on offer', G.riteNextLevel('extraDie'), 1);
eq('buying takes rung 1', G.buyRite('extraDie'), true);
eq('level is 1, not the level the purse could afford', G.riteLevel('extraDie'), 1);
eq('the next offer is rung 2', G.riteNextLevel('extraDie'), 2);
eq('rung 2 is refused — descent 15 not met', G.buyRite('extraDie'), false);
eq('nothing was spent on the refusal', G.Meta.data.marrow, 99999 - 60);
eq('unknown key refused', G.buyRite('nonesuch'), false);

console.log('\n5. the keys open as the descents are actually made');
G.Meta.data.lifetime.deepestLevel = 15;
eq('rung 2 opens at descent 15', G.buyRite('extraDie'), true);
eq('level is 2', G.riteLevel('extraDie'), 2);
eq('rung 3 still shut at 15', G.buyRite('extraDie'), false);
G.Meta.data.lifetime.deepestLevel = 25;
eq('rung 3 opens at descent 25', G.buyRite('extraDie'), true);
eq('ladder topped out', G.riteLevel('extraDie'), G.RITE_MAX.extraDie);
eq('a topped-out ladder offers nothing', G.riteNextLevel('extraDie'), 0);
eq('and cannot be bought again', G.buyRite('extraDie'), false);
G.renderArchive();
eq('it reads as fully sworn', stateOf('extraDie'), 'owned');
eq('and says so', /SWORN IN FULL/.test(row('extraDie').textContent), true);
eq('all three pips filled', row('extraDie').querySelectorAll('.oPip.on').length, 3);
eq('its header counts the rungs', row('extraDie').querySelector('.acTier').textContent,
   'RUNG 3 OF 3');

console.log('\n6. too poor is refused, and costs nothing');
G.Meta.data.marrow = 10;                       // rung 1 of any ladder is 40+
G.renderArchive();
eq('reads as unaffordable', stateOf('extraShards'), 'locked');
eq('refused', G.buyRite('extraShards'), false);
eq('nothing spent', G.Meta.data.marrow, 10);
eq('still level 0', G.riteLevel('extraShards'), 0);

console.log('\n7. buying a rung through the real Archive, by clicking it');
G.Meta.data.marrow = 500; G.renderArchive();
eq('now buyable', stateOf('extraReroll'), 'buy');
click(row('extraReroll'));
eq('confirm opened', $('arcConfirmOverlay').classList.contains('hidden'), false);
eq('it names the rung', /RUNG 1 OF 3/.test($('arcWhat').textContent), true);
eq('it shows hold / cost / keep', $('arcCost').textContent.replace(/\s+/g,' '),
   'YOU HOLD500THIS COSTS60YOU KEEP440');
eq('it says what swearing it will do',
   /Once sworn: \+1 re-roll on every cast/.test($('arcWhatDesc').textContent), true);
click($('btnArcCancel'));
eq('cancel spends nothing', [G.Meta.data.marrow, G.riteLevel('extraReroll')], [500, 0]);

click(row('extraReroll'));
click($('btnArcConfirm'));
eq('marrow spent', G.Meta.data.marrow, 440);
eq('level recorded', G.riteLevel('extraReroll'), 1);
eq('a toast announced the rung', toasts.pop(), 'THE STEADY HAND SWORN — RUNG 1');
eq('the card shows the rung owned', row('extraReroll').querySelector('.acTier').textContent,
   'RUNG 1 OF 3');
eq('one pip filled', row('extraReroll').querySelectorAll('.oPip.on').length, 1);
// the rung just paid for pours rather than simply being full on the next paint
eq('and that pip pours', row('extraReroll').querySelectorAll('.oPip.pour').length, 1);
eq('the card flashes as paid', row('extraReroll').classList.contains('justPaid'), true);
eq('and the standing effect', /\+1 re-roll on every cast/.test(
   row('extraReroll').querySelector('.oathNow').textContent), true);
// two ladders have been touched by now: extraDie was topped out in §5 above,
// and extraReroll has just taken its first rung
eq('the header counts two ladders sworn of four',
   /2\/4 SWORN/.test($('arcOaths').innerHTML), true);
// the flash belongs to the transaction: it must not still be on the card the
// next time anything re-renders
G.renderArchive();
eq('the flash does not persist past its own render',
   row('extraReroll').classList.contains('justPaid'), false);
eq('but the pip stays filled', row('extraReroll').querySelectorAll('.oPip.on').length, 1);
eq('and stops pouring', row('extraReroll').querySelectorAll('.oPip.pour').length, 0);
eq('a purchase does not throw the player back to the roster',
   $('arcOaths').classList.contains('hidden'), false);

console.log('\n8. it survives a reload');
{
  const before = KEYS.map(G.riteLevel);
  G.Meta.load();
  eq('levels persisted', KEYS.map(G.riteLevel), before);
  eq('a v2 ledger keeps them as numbers', typeof G.Meta.data.rites.extraDie, 'number');
}

// ---------------------------------------------------------------------
// What an Oath actually does. Everything below starts a real run.
// ---------------------------------------------------------------------
const swear = (k, n) => { G.Meta.data.rites[k] = n; G.Meta.save(); };
const clearOaths = () => { for(const k of KEYS) swear(k, 0); };

console.log('\n9. the mouth of a run, with nothing sworn');
clearOaths();
G.startRun();
eq('the cup holds the base handful', G.getS().dicePool.length, G.STARTING_BONES);
eq('all of them bone', G.getS().dicePool.every(d=>d.type==='bone'), true);
eq('the purse is empty', G.getS().shards, 0);
eq('two re-rolls a cast', G.rerollsPerCast(), 2);
eq('new wares cost 3', G.shopRerollCost(), 3);

console.log('\n10. one rung of each, and every effect lands');
clearOaths();
for(const k of KEYS) swear(k, 1);
G.startRun();
eq('one more bone in the cup', G.getS().dicePool.length, G.STARTING_BONES + 1);
eq('the purse opens with a level of shards', G.getS().shards, G.RITE_SHARD_STEP);
eq('one more re-roll a cast', G.rerollsPerCast(), 3);
eq('new wares cost 1 less', G.shopRerollCost(), 2);

console.log('\n11. levels STACK — rung 2 is +2 in total, not +2 instead of +1');
clearOaths();
swear('extraDie', 2); swear('extraReroll', 2); swear('extraShards', 2);
G.startRun();
eq('two more bones', G.getS().dicePool.length, G.STARTING_BONES + 2);
eq('two more re-rolls', G.rerollsPerCast(), 4);
eq('two levels of shards', G.getS().shards, G.RITE_SHARD_STEP * 2);
// and at the top of both ladders
clearOaths();
swear('extraDie', 3); swear('extraReroll', 3); swear('extraShards', 5);
G.startRun();
eq('a maxed cup', G.getS().dicePool.length, G.STARTING_BONES + 3);
eq('a maxed re-roll count', G.rerollsPerCast(), 5);
eq('a maxed purse', G.getS().shards, G.RITE_SHARD_STEP * 5);
eq('the cup is still inside its cap', G.getS().dicePool.length <= G.maxPool(), true);

console.log('\n12. the Ossuary\'s Favour, against a shop that escalates');
{
  clearOaths();
  G.startRun();
  const S = G.getS();
  const ladder = () => [0,1,2,3,4].map(n => { S.shopRerolls = n; return G.shopRerollCost(); });
  eq('unsworn, the cost climbs 3,4,5,6,7', ladder(), [3,4,5,6,7]);
  swear('cheapReroll', 2); G.startRun();
  const S2 = G.getS();
  const ladder2 = () => [0,1,2,3,4].map(n => { S2.shopRerolls = n; return G.shopRerollCost(); });
  eq('two rungs take 2 off the whole climb', ladder2(), [2,2,3,4,5]);
  swear('cheapReroll', 5); G.startRun();
  const S3 = G.getS();
  const ladder3 = () => [0,1,2,3,4].map(n => { S3.shopRerolls = n; return G.shopRerollCost(); });
  eq('a maxed ladder still never goes below the floor', ladder3(),
     [G.RITE_REROLL_FLOOR, G.RITE_REROLL_FLOOR, G.RITE_REROLL_FLOOR,
      G.RITE_REROLL_FLOOR, G.RITE_REROLL_FLOOR]);
  eq('the floor is above Skeleton Key\'s flat 1', G.RITE_REROLL_FLOOR > 1, true);
  // ...and the relic still beats it outright, which is the point of the floor
  S3.relics = ['key'];
  eq('Skeleton Key still wins', G.shopRerollCost(), 1);
}

console.log('\n13. a run is played under the Oaths it began with');
{
  clearOaths();
  swear('extraReroll', 1);
  G.startRun();
  const S = G.getS();
  eq('the run started with one rung', G.rerollsPerCast(), 3);
  eq('and snapshotted it', S.rites.extraReroll, 1);
  // bought mid-descent, exactly as S.wares is proof against
  G.Meta.data.marrow = 99999;
  G.Meta.data.lifetime.deepestLevel = 25;
  eq('a rung bought mid-run is banked', G.buyRite('extraReroll'), true);
  eq('the ledger moved', G.riteLevel('extraReroll'), 2);
  eq('the live run did NOT', G.rerollsPerCast(), 3);
  eq('its snapshot is untouched', S.rites.extraReroll, 1);
  // ...and the next run picks it up
  G.startRun();
  eq('the next run begins under it', G.rerollsPerCast(), 4);
}

console.log('\n14. an Oath cannot reach a run through a corrupt ledger');
{
  store['boneSieveMeta'] = JSON.stringify({version:2, rites:{extraDie:999, extraShards:'lots'}});
  G.Meta.load();
  G.startRun();
  eq('an absurd level is clamped to the cap',
     G.getS().dicePool.length, G.STARTING_BONES + G.RITE_MAX.extraDie);
  eq('a junk level reads as none', G.getS().shards, 0);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

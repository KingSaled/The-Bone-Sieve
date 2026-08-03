// Drives the REAL runShopPool()/rollOffers() lifted out of index.html, with a
// stubbed S, through many simulated descents. Asserts that nothing outside the
// design-doc starting set is ever laid on the counter.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'build', 'gate.js'), 'utf8');

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};

// The two run-state hooks rollOffers() needs, verbatim from index.html.
const preamble = `
  let S = null;
  function hasRelic(r){ return !!S && S.relics.includes(r); }
`;
const boot = new Function('localStorage', preamble + src + `
  return {Meta, runShopPool, rollOffers, dieAvailable, relicAvailable,
          SHOP_POOL, RELICS, DIE_TYPES, DIE_ORDER,
          setS: v => { S = v; }, getS: () => S};
`);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

// ---- what the design doc says a fresh save owns -----------------------
const START_DICE  = ['bone'];
const START_RELIC = ['dust','candle','hook','nail','obol','censer','ember'];

const G = boot(localStorage);
G.Meta.load();

console.log('\n1. the gate itself');
eq('bone available', G.dieAvailable('bone'), true);
const lockedDice = G.DIE_ORDER.filter(d => !G.dieAvailable(d));
eq('other 10 dice locked', lockedDice,
   ['ivory','runt','twin','hex','obsidian','rotting','mirror','gilded','thorn','crimson']);
eq('tier-1 relics available', Object.keys(G.RELICS).filter(r => G.relicAvailable(r)), START_RELIC);
eq('other 30 relics locked', Object.keys(G.RELICS).filter(r => !G.relicAvailable(r)).length, 30);

console.log('\n2. the run pool');
const pool = G.runShopPool();
eq('catalogue untouched', G.SHOP_POOL.length, 11 + 4 + 37);  // 37 relics, not the doc's stale 34
eq('run pool = 1 die + 0 chalks + 7 relics', pool.length, 8);
eq('only bone die', pool.filter(i => i.kind === 'die').map(i => i.die), ['bone']);
eq('every chalk is now gated too', pool.filter(i => i.kind === 'chalk').length, 0);
eq('only tier-1 relics', pool.filter(i => i.kind === 'relic').map(i => i.relic), START_RELIC);

// ---- simulate descents ------------------------------------------------
// Mirrors the real flow: startRun snapshots wares, then each level opens the
// Ossuary, rolls offers, and buys whatever is affordable (the greediest
// possible player, to exercise every draw).
function playRun(levels){
  const S = {
    level:1, shards:0, relics:[], chalks:[], dicePool:[], offers:[], selIdx:null,
    shopRerolls:0, wares: G.runShopPool(),
  };
  for(let i=0;i<6;i++) S.dicePool.push({type:'bone'});
  G.setS(S);
  const offered = [];
  for(S.level = 1; S.level <= levels; S.level++){
    for(let reroll = 0; reroll < 4; reroll++){    // reroll hard, see more of the bag
      G.rollOffers();
      for(const o of S.offers){
        offered.push(o);
        // buy it — the greedy player takes everything the counter shows
        if(o.kind === 'die')        S.dicePool.push({type:o.die});
        else if(o.kind === 'relic'){ if(!S.relics.includes(o.relic)) S.relics.push(o.relic); }
        else if(o.kind === 'chalk'){
          if(o.axis === 'row' || o.axis === 'col') S.chalks.push({axis:o.axis, mult:3});
          else if(o.axis === 'cross'){ S.chalks.push({axis:'row',mult:3}); S.chalks.push({axis:'col',mult:3}); }
        }
      }
      // altar overflows in the real game; banish down so relics keep being offered
      while(S.relics.length > 5) S.relics.shift();
      if(S.chalks.length > 8) S.chalks.length = 0;
    }
  }
  return {offered, S};
}

console.log('\n3. 200 simulated runs, 20 descents each, rerolling every shop');
const seenDice = new Set(), seenRelics = new Set(), seenChalks = new Set();
let totalOffers = 0, emptyShops = 0;
for(let r = 0; r < 200; r++){
  const {offered} = playRun(20);
  totalOffers += offered.length;
  for(const o of offered){
    if(o.kind === 'die')   seenDice.add(o.die);
    if(o.kind === 'relic') seenRelics.add(o.relic);
    if(o.kind === 'chalk') seenChalks.add(o.id);
  }
}
console.log('     (' + totalOffers.toLocaleString() + ' individual wares laid out)');
eq('only bone ever offered', [...seenDice].sort(), START_DICE);
eq('only tier-1 relics ever offered', [...seenRelics].sort(), START_RELIC.slice().sort());
eq('no chalk is ever offered on a fresh save', [...seenChalks], []);
eq('no locked die ever slipped through',
   [...seenDice].filter(d => !G.dieAvailable(d)), []);
eq('no locked relic ever slipped through',
   [...seenRelics].filter(r => !G.relicAvailable(r)), []);

console.log('\n4. the shop never comes up empty');
{
  const S = {level:30, shards:0, relics:[], chalks:[], dicePool:[], offers:[], selIdx:null,
             shopRerolls:0, wares:G.runShopPool()};
  G.setS(S);
  // worst case: altar full of tier-1 relics and every chalk line already drawn
  S.relics = START_RELIC.slice(0,7);
  for(let i=0;i<5;i++){ S.chalks.push({axis:'row',mult:3}); S.chalks.push({axis:'col',mult:3}); }
  G.rollOffers();
  eq('starved shop still offers something', S.offers.length > 0, true);
  // only the bone die and 'deepen an existing chalk' survive that state
  eq('starved shop falls back to the bone die alone', S.offers.map(o=>o.id).sort(), ['die_bone']);
}

console.log('\n5. unlocking one thing widens the pool (proves the gate is the only lever)');
G.Meta.data.unlockedDice.push('crimson');
G.Meta.data.unlockedRelics.push('ouro');
{
  const p = G.runShopPool();
  eq('pool grew by exactly 2', p.length, 10);
  eq('crimson now drawable', p.some(i => i.die === 'crimson'), true);
  eq('ouro now drawable', p.some(i => i.relic === 'ouro'), true);
}
// ...and a loadout toggle closes it again without touching the unlock (design §11)
G.Meta.data.disabledDice.push('crimson');
eq('toggled-off die leaves the pool', G.runShopPool().some(i => i.die === 'crimson'), false);
eq('but stays unlocked', G.Meta.data.unlockedDice.includes('crimson'), true);
G.Meta.data.disabledDice.length = 0;
G.Meta.data.unlockedDice.pop(); G.Meta.data.unlockedRelics.pop();

console.log('\n6. the snapshot holds for the life of a run');
{
  const S = {level:1, shards:0, relics:[], chalks:[], dicePool:[], offers:[], selIdx:null,
             shopRerolls:0, wares:G.runShopPool()};
  G.setS(S);
  const before = S.wares.length;
  G.Meta.data.unlockedDice.push('mirror');      // unlocked mid-descent
  G.rollOffers();
  eq('mid-run unlock does not reach the live run', S.wares.length, before);
  eq('mirror not offered this run', S.offers.some(o => o.die === 'mirror'), false);
  eq('but the next run sees it', G.runShopPool().some(i => i.die === 'mirror'), true);
  G.Meta.data.unlockedDice.pop();
}

console.log('\n7. a corrupt ledger cannot un-gate the game');
store['boneSieveMeta'] = JSON.stringify({unlockedDice:null, unlockedRelics:'everything'});
G.Meta.load();
eq('junk unlock lists fall back to the starting set', G.runShopPool().length, 8);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

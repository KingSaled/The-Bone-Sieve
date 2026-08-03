// Exercises the REAL Marrow economy lifted out of index.html: the §5 earn
// formula, run close-out, §10 pricing, §9 depth gates, and buyUnlock.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'build', 'econ.js'), 'utf8');

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
const preamble = `
  let S = null, menuMode = true;
  function hasRelic(r){ return !!S && S.relics.includes(r); }
`;
const boot = new Function('localStorage', preamble + src + `
  return {Meta, marrowFor, closeOutRun, marrowPrice, MARROW_PRICE_MULT,
          archiveRoster, buyUnlock, depthGateFor, depthGateMet,
          runShopPool, rollOffers, DIE_PRICE, RELICS, DIE_ORDER,
          setS: v => { S = v; }};
`);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

const G = boot(localStorage);
G.Meta.load();

console.log('\n1. §5 earn formula vs the design doc\'s own calibration table');
// doc: "Your best runs" L25 / ~300,000 blood / ~26,000 best roll -> 75+55+20 = 150
{
  const a = G.marrowFor(25, 300000, 26000, 99);
  eq('best run  = 75 + 55 + 20', [a.depth, a.blood, a.roll, a.total], [75, 54, 20, 149]);
}
// doc: "A modest early run" L10 / ~20,000 / ~5,000 -> 30+14+5 = 49
{
  const a = G.marrowFor(10, 20000, 5000, 99);
  eq('modest run = 30 + 14 + 5 = 49', [a.depth, a.blood, a.roll, a.total], [30, 14, 5, 49]);
}
// doc: "A rough early run" L4 / ~4,000 / ~1,200 -> 12+6+1 = 19
{
  const a = G.marrowFor(4, 4000, 1200, 99);
  eq('rough run  = 12 + 6 + 1 = 19', [a.depth, a.blood, a.roll, a.total], [12, 6, 1, 19]);
}

console.log('\n2. caps and the personal-best bonus');
eq('blood component caps at 60', G.marrowFor(1, 99e6, 0, 99).blood, 60);
eq('roll component caps at 20',  G.marrowFor(1, 0, 99e6, 99).roll, 20);
eq('depth is uncapped',          G.marrowFor(100, 0, 0, 99).depth, 300);
eq('PB fires when deeper',       G.marrowFor(10, 0, 0, 9).pb, 50);
eq('PB silent when equal',       G.marrowFor(10, 0, 0, 10).pb, 0);
eq('PB silent when shallower',   G.marrowFor(10, 0, 0, 11).pb, 0);
eq('negatives cannot pay',       G.marrowFor(0, -5, -5, 0).total, 0);

console.log('\n3. closeOutRun writes the career');
const mkRun = (level, total, best, trials) => ({
  level, totalScore:total, stats:{best, trialsCleared:trials, conduits:0, levelsCleared:0},
  relics:[], chalks:[], dicePool:[], offers:[], selIdx:null, shopRerolls:0,
  wares:G.runShopPool(),
});
G.setS(mkRun(10, 20000, 5000, 2));
{
  const a = G.closeOutRun();
  eq('award banked', a.total, 49 + 50);            // + PB, deepest was 0
  eq('marrow credited', G.Meta.data.marrow, 99);
  eq('runs incremented', G.Meta.data.lifetime.runs, 1);
  eq('deepest recorded', G.Meta.data.lifetime.deepestLevel, 10);
  eq('best offering recorded', G.Meta.data.lifetime.bestOffering, 5000);
  eq('trials accumulate', G.Meta.data.lifetime.trialsCleared, 2);
}
// a shallower second run: no PB, stats must not regress
G.setS(mkRun(4, 4000, 1200, 1));
{
  const a = G.closeOutRun();
  eq('no PB on a shallower run', a.pb, 0);
  eq('deepest does not regress', G.Meta.data.lifetime.deepestLevel, 10);
  eq('best offering does not regress', G.Meta.data.lifetime.bestOffering, 5000);
  eq('trials are cumulative, not max', G.Meta.data.lifetime.trialsCleared, 3);
  eq('marrow accumulated', G.Meta.data.marrow, 99 + 19);
}
eq('career survives a reload', (()=>{ G.Meta.load(); return G.Meta.data.marrow; })(), 118);

console.log('\n4. §10 pricing');
eq('multiplier applied', G.marrowPrice(9), 9 * G.MARROW_PRICE_MULT);
{
  const r = G.archiveRoster();
  eq('roster covers every die, chalk and relic', r.length, 11 + 4 + 37);
  eq('bone reads as owned', r.find(e=>e.id==='bone').owned, true);
  eq('runt is the cheapest locked thing',
     Math.min(...r.filter(e=>!e.owned).map(e=>e.price)),
     5 * G.MARROW_PRICE_MULT);
  const locked = r.filter(e => !e.owned);
  eq('44 locked items remain', locked.length, (37 - 7) + 10 + 4);
  eq('whole roster costs', locked.reduce((a,e)=>a+e.price,0), 845 * G.MARROW_PRICE_MULT);
}

console.log('\n5. §9 depth gates');
eq('tier 1 ungated', G.depthGateFor(1), 0);
eq('tier 2 ungated', G.depthGateFor(2), 0);
eq('tier 3 wants 15', G.depthGateFor(3), 15);
eq('tier 4 wants 25', G.depthGateFor(4), 25);
eq('deepest 10 fails the tier-3 gate', G.depthGateMet(3), false);
G.Meta.data.marrow = 99999;
eq('a full purse cannot buy a gated relic', G.buyUnlock('relic', 'ouro'), false);
eq('...and nothing was spent', G.Meta.data.marrow, 99999);
eq('...nor a gated die', G.buyUnlock('die', 'mirror'), false);

console.log('\n6. buying');
eq('buys an ungated die', G.buyUnlock('die', 'runt'), true);
eq('marrow deducted', G.Meta.data.marrow, 99999 - 15);
eq('recorded in the ledger', G.Meta.data.unlockedDice.includes('runt'), true);
eq('cannot buy the same thing twice', G.buyUnlock('die', 'runt'), false);
eq('unknown id refused', G.buyUnlock('die', 'nonesuch'), false);
eq('kind mismatch refused', G.buyUnlock('relic', 'runt'), false);
{
  G.Meta.data.marrow = 10;                       // eye costs 20*3 = 60
  eq('too poor is refused', G.buyUnlock('relic', 'eye'), false);
  eq('...and nothing was spent', G.Meta.data.marrow, 10);
}

console.log('\n7. gates open once the depth is actually reached');
G.Meta.data.lifetime.deepestLevel = 15;
eq('tier 3 opens at 15', G.depthGateMet(3), true);
eq('tier 4 still shut at 15', G.depthGateMet(4), false);
G.Meta.data.marrow = 99999;
eq('gated tier-3 relic now buyable', G.buyUnlock('relic', 'ouro'), false);   // ouro is tier 4
eq('tier-3 relic buyable', G.buyUnlock('relic', 'spine'), true);
G.Meta.data.lifetime.deepestLevel = 25;
eq('tier 4 opens at 25', G.buyUnlock('relic', 'ouro'), true);

console.log('\n8. an unlock actually reaches a run');
{
  const before = G.runShopPool();
  eq('runt is in the next run\'s pool', before.some(i=>i.die==='runt'), true);
  eq('spine is in the next run\'s pool', before.some(i=>i.relic==='spine'), true);
  eq('ouro is in the next run\'s pool', before.some(i=>i.relic==='ouro'), true);
  eq('an unbought die is still absent', before.some(i=>i.die==='crimson'), false);
  // and it can actually be drawn
  const S = mkRun(20, 0, 0, 0);
  S.wares = before;
  G.setS(S);
  const seen = new Set();
  for(let i=0;i<3000;i++){ G.rollOffers(); for(const o of S.offers){ if(o.die) seen.add(o.die); if(o.relic) seen.add(o.relic); } }
  eq('runt is offered in play', seen.has('runt'), true);
  eq('spine is offered in play', seen.has('spine'), true);
  eq('crimson is never offered', seen.has('crimson'), false);
}

console.log('\n9. pacing sanity against §6 (first unlocks in 2-3 runs)');
{
  store['boneSieveMeta'] = '';
  const F = boot({getItem:()=>null, setItem:()=>{}});
  F.Meta.load();
  let runs = 0, unlocked = 0;
  // a mediocre player: level 6, 8k blood, 2k best offering, creeping one deeper
  for(let depth = 4; unlocked < 2 && runs < 10; depth++){
    F.setS({level:depth, totalScore:depth*900, stats:{best:depth*260, trialsCleared:0},
            relics:[], chalks:[], dicePool:[], offers:[], selIdx:null, shopRerolls:0, wares:[]});
    F.closeOutRun(); runs++;
    for(const id of ['runt','rotting']) if(F.buyUnlock('die', id)) unlocked++;
  }
  console.log('     (' + runs + ' runs to afford the first two dice, ' +
              F.Meta.data.marrow + ' marrow left over)');
  eq('first two dice inside 3 runs', runs <= 3, true);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

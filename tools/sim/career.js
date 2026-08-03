// ======================================================================
// THE CAREER SIMULATOR
//
// Plays whole CAREERS, not runs: a fresh ledger, runs until death, Marrow
// spent between them, repeat until the Archive is bought out or a cap is hit.
//
// It drives the real model. Every table, the scoring engine, the conduit
// finder, the offering multiplier, the quota curve, chooseSlot(), rollOffers()
// and rollBoons() are lifted out of index.html by tools/test/extract.js and
// called directly. Nothing about scoring or drawing wares is reimplemented
// here, because a second model of the game would only ever tell us about
// itself.
//
// What IS written here, because the game leaves it to the player:
//   · where a bone is thrown is the game's; WHICH bones get re-rolled is not
//   · what is on the counter is the game's; what gets bought is not
//   · what a run pays in Marrow is the game's; what it gets spent on is not
//
// Those three are the decision profiles below, and they are the whole reason
// there is a range of outcomes rather than one number.
//
//   node tools/sim/career.js                    default sweep
//   node tools/sim/career.js --careers 200      more samples
//   node tools/sim/career.js --json out.json    dump raw rows
// ======================================================================
const fs = require('fs'), path = require('path');

const SIM = fs.readFileSync(
  path.join(__dirname, '..', 'test', 'build', 'sim.js'), 'utf8');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i+1] : d; };
const CAREERS  = Number(arg('careers', 120));
const RUN_CAP  = Number(arg('runcap', 200));
const JSON_OUT = arg('json', null);

// ---------------------------------------------------------------- boot
// The model needs a localStorage and a pile of drawing/sound calls stubbed.
// Every stub here is a no-op on purpose: if a stub ever had to DO something,
// that would mean the simulator was standing in for game logic rather than
// for a browser, and the number it produced would stop being trustworthy.
function boot(){
  const store = {};
  const noop = ()=>{};
  const preamble = `
    let menuMode = false, shake = 0, VW = 1920, VH = 1080;
    let _pendingDecree = null, _landTag = null, _relicSig = null, _poolSig = null,
        _boonSig = null, _metShown = false, _lastLevelScore = null, _socketRelic = null;
    const ISO = {cx:960, cy:540, tw:120, th:60};
    const document = undefined, window = undefined;
    function syncUI(){} function msg(){} function toast(){} function sfx(){}
    function showTally(){} function updateTally(){} function kickMult(){}
    function isoPt(){ return {x:0,y:0}; } function addRing(){} function addAsh(){}
    function addShards(){} function showClearFx(){} function showOmenFx(){}
    function renderTrialStrip(){} function buildBoneFrames(){} function icon(){ return ''; }
    function setTip(){} function hydrateIcons(){} function applyUIScale(){}
    function layoutBoard(){} function seedEmbers(){} function clearFx(){}
    function enforcePoolCap(){ return false; } function cullPending(){ return false; }
  `;
  const tail = `
    return {Meta, S:()=>S, setS:v=>{S=v;}, freshState, makeDie, emptyBoard,
      DIE_TYPES, DIE_ORDER, RELICS, DIE_WARES, CHALK_WARES, SHOP_POOL, BOONS,
      TRIALS, DECREES, GRID, BASE_POOL, STARTING_BONES, MIN_POOL, MAX_DECREES,
      RITES, RITE_BY_KEY, RITE_MAX, RITE_SHARD_STEP, RITE_REROLL_FLOOR,
      MARROW_PRICE_MULT, marrowPrice, marrowFor, closeOutRun, archiveRoster,
      buyUnlock, buyRite, riteLevel, riteNextLevel, ritePrice, riteGateMet,
      depthGateFor, depthGateMet, runShopPool, rollOffers, rollBoons,
      quotaFor, castsPerLevel, rerollsPerCast, maxPool, altarSlots, altarFull,
      offeringMult, refreshPreview, computeConduits, clearBoard, chooseSlot,
      activeDice, openTileCount, boardDice, dieAt, addChalk, addDecree,
      isTrialLevel, pickTrial, hasRelic, hasTrial, boonAlms, pick,
      itemDisabled, isSealed, STORY_FIXTURE_OFF:()=>{ STORY_FIXTURE = false; }};
  `;
  const G = new Function('localStorage', preamble + SIM + tail)({
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  });
  G.STORY_FIXTURE_OFF();          // the §12 fixture is not roster content
  G.Meta.load();
  G.Meta.reset();
  return G;
}

// ---------------------------------------------------------------- profiles
//
// SKILL is how well the player works a cast: which bones they pull back, and
// whether they stop once the quota is already met.
//
//   novice   — re-rolls the whole board when nothing is burning, and stops
//              thinking about it after that. No notion of a partial conduit.
//   veteran  — pulls back only the bones that are not in a live conduit, keeps
//              the best board it has seen rather than the last one it rolled,
//              and banks the moment the quota is covered so casts are spared.
//
// BUYING is what they do with shards at the counter, and MARROW is what they
// do with a career's earnings. Those two are separate axes because a player
// can be good at one and careless at the other.
const SKILL = {
  novice: {
    label: 'novice',
    // only bothers when the board is dead, and swings at everything
    reroll(G, ctx){
      if(ctx.score > 0) return null;
      return 'all';
    },
    keepBest: false,
  },
  veteran: {
    label: 'veteran',
    reroll(G, ctx){
      if(ctx.bankedEnough) return null;          // quota covered, stop spending casts
      if(!ctx.deadIds.length) return null;       // everything is already burning
      return ctx.deadIds;
    },
    keepBest: true,
  },
};

// Shop policy. Both respect the altar and the cup; the difference is what they
// reach for when they can afford more than one thing.
const BUYING = {
  thrifty: {
    label: 'thrifty',
    // takes the cheapest thing on the counter it can pay for, every time
    choose(G, offers, shards){
      const can = offers.filter(o => affordable(G, o, shards));
      if(!can.length) return null;
      return can.sort((a,b)=>a.price-b.price)[0];
    },
  },
  greedy: {
    label: 'greedy',
    // reaches for the dearest thing it can pay for, on the game's own reading
    // that price encodes power — and holds its shards otherwise rather than
    // spending them on filler
    choose(G, offers, shards){
      const can = offers.filter(o => affordable(G, o, shards));
      if(!can.length) return null;
      return can.sort((a,b)=>(b.tier-a.tier) || (b.price-a.price))[0];
    },
  },
};

// Marrow policy. This is the axis the brief actually asks about: what does a
// rational player buy first? Rather than assume an answer, three plausible
// readings are simulated and the outcomes compared.
const SPEND = {
  // most things unlocked soonest: always take the cheapest available
  breadth: { label:'breadth', pick(G, opts){
    return opts.slice().sort((a,b)=>a.cost-b.cost)[0]; } },
  // permanent power first: every Oath rung before any content
  oaths:   { label:'oaths',   pick(G, opts){
    const o = opts.filter(x=>x.kind==='rite');
    return (o.length ? o : opts).slice().sort((a,b)=>a.cost-b.cost)[0]; } },
  // content first, Oaths only once the roster is bought out
  content: { label:'content', pick(G, opts){
    const c = opts.filter(x=>x.kind!=='rite');
    return (c.length ? c : opts).slice().sort((a,b)=>a.cost-b.cost)[0]; } },
};

function affordable(G, o, shards){
  if(o.sold || shards < o.price) return false;
  const S = G.S();
  // the Exchange lets a full altar or cup buy anyway, at the price of giving
  // something up; a simulated player simply declines rather than modelling a
  // choice the data would not be able to interpret
  if(o.kind === 'die'   && S.dicePool.length >= G.maxPool()) return false;
  if(o.kind === 'relic' && G.altarFull()) return false;
  if(o.kind === 'relic' && S.relics.includes(o.relic)) return false;
  return true;
}

// ---------------------------------------------------------------- one run
//
// Mirrors GAME FLOW without the animation: castDice() decides where bones land
// and what they show, then hands to onDiceSettled(); here the two happen in one
// breath. Placement is the real chooseSlot(); the face is the real
// pick(DIE_TYPES[type].faces), which is what launchDie() bakes into the anim.
function castHeadless(G){
  const S = G.S();
  S.rerollsLeft = G.rerollsPerCast();
  S.rerolledIds = [];
  const room = G.openTileCount();
  let casting = G.activeDice();
  S.benched = [];
  if(casting.length > room){
    casting = casting.slice().sort(()=>Math.random()-0.5);
    S.benched = casting.slice(room).map(d=>d.id);
    casting = casting.slice(0, room);
  }
  for(const d of casting) place(G, d);
  // litSegments() gates on the phase, and the crimson die's multiplier reads
  // through it — a cast scored in the wrong phase silently loses that relic
  S.phase = 'placed';
  G.refreshPreview();
}
function place(G, d){
  const S = G.S();
  const slot = G.chooseSlot();
  if(!slot) return false;
  d.gx = slot.gx; d.gy = slot.gy;
  S.board[slot.gy][slot.gx] = d;
  d.marked = false;
  d.value = G.pick(G.DIE_TYPES[d.type].faces);
  return true;
}
function rerollSome(G, ids){
  const S = G.S();
  const marked = S.dicePool.filter(d =>
    d.gx >= 0 && !G.DIE_TYPES[d.type].noReroll &&
    (ids === 'all' || ids.includes(d.id)));
  if(!marked.length) return false;
  S.rerollsLeft--;
  for(const d of marked){ S.board[d.gy][d.gx] = null; d.gx = -1; d.gy = -1; }
  for(const d of marked){
    place(G, d);
    if(!S.rerolledIds.includes(d.id)) S.rerolledIds.push(d.id);
  }
  G.refreshPreview();
  return true;
}
// which bones are in nothing that burns
function deadBones(G){
  const S = G.S();
  const live = new Set();
  for(const seg of S.previewSegments)
    if(!seg.dead && seg.pts > 0)
      for(const c of seg.cells){ const d = G.dieAt(c.gx, c.gy); if(d) live.add(d.id); }
  return S.dicePool.filter(d => d.gx >= 0 && !live.has(d.id) &&
                                !G.DIE_TYPES[d.type].noReroll).map(d => d.id);
}
// finishSeal(), minus the tally and the particles
function bank(G){
  const S = G.S();
  let raw = S.previewSegments.reduce((a,s)=>a + (s.dead ? 0 : s.pts), 0);
  const liveConduits = S.previewSegments.filter(s=>!s.dead && !s.bonus && s.pts>0).length;
  if(G.hasTrial('warden') && liveConduits < 3 && raw > 0) raw = 0;
  if(G.hasTrial('toll') && raw > 0){
    if(S.shards >= 5) S.shards -= 5;
    else raw = Math.round(raw * 0.5);
  }
  const banked = Math.round(raw * G.offeringMult());
  if(banked > S.stats.best) S.stats.best = banked;
  S.levelScore += banked; S.totalScore += banked;
  S.stats.conduits += S.previewSegments.filter(s=>!s.dead && s.pts>0).length;

  let coin = 0;
  const scored = S.previewSegments.filter(s=>!s.dead && s.pts>0 && !s.relic);
  if(G.hasRelic('obol')) coin += scored.filter(s=>!s.bonus).length;
  for(const seg of scored){
    if(seg.bonus) continue;
    for(const c of seg.cells){
      const d = G.dieAt(c.gx, c.gy);
      if(!d) continue;
      if(d.type === 'gilded') coin += 3;
      if(d.type === 'runt')   coin += 2;
    }
  }
  if(coin){ if(G.hasTrial('greed')) coin *= 2; S.shards += coin; }

  const rotted = new Set();
  for(const seg of S.previewSegments)
    if(!seg.dead && seg.pts > 0) for(const id of seg.rotting) rotted.add(id);
  if(rotted.size){
    S.dicePool = S.dicePool.filter(d => !rotted.has(d.id));
    S.rotted += rotted.size;
  }
  if(G.hasTrial('brittle')){
    const avail = G.activeDice();
    if(avail.length > G.MIN_POOL) S.withheld.push(G.pick(avail).id);
  }
  return banked;
}
// onQuotaSated(), minus the reveal
function sate(G){
  const S = G.S();
  const wasTrial = !!S.trial;
  const excess = S.levelScore - S.quota;
  const unusedCasts = Math.max(0, G.castsPerLevel() - S.castNum);
  let award = 6 + Math.min(6, Math.floor(S.level/3));
  award += Math.min(4, Math.floor(excess / Math.max(1, S.quota*0.35)));
  award += unusedCasts * 3;
  if(S.shards < 70) award += Math.min(4, Math.floor(S.shards/12));
  if(G.hasRelic('candle')) award += 5;
  if(G.hasRelic('crow'))   award += unusedCasts * 4;
  award += G.boonAlms();
  if(G.hasTrial('greed'))  award *= 2;
  S.shards += award;
  S.stats.levelsCleared++;
  if(G.hasRelic('ouro')) S.ouroStacks++;
  if(wasTrial){
    S.stats.trialsCleared++;
    if(S.level >= 10 && S.decrees.length < G.MAX_DECREES) G.addDecree();
    // the boon screen is a forced one-of-three; a simulated player takes the
    // first, which is as unbiased as picking blind
    const offer = G.rollBoons();
    if(offer.length) S.boons.push(G.pick(offer).id);
  }
  if(_pendingDecreeOf(G)) flushDecreeSim(G);
}
function _pendingDecreeOf(){ return false; }
function flushDecreeSim(){}

// startLevel(), minus the effects
function beginLevel(G){
  const S = G.S();
  S.levelScore = 0; S.castNum = 1;
  S.trial = G.isTrialLevel(S.level) ? G.pickTrial() : null;
  S.withheld = []; S.rerolledIds = [];
  S.quota = G.quotaFor(S.level);
  S.rerollsLeft = G.rerollsPerCast();
  G.clearBoard();
  if(G.hasTrial('famine')){
    const hold = Math.min(3, Math.max(0, S.dicePool.length - 2));
    const sh = S.dicePool.slice().sort(()=>Math.random()-0.5);
    S.withheld = sh.slice(0, hold).map(d=>d.id);
  }
  if(G.hasRelic('sigil')) G.addChalk(Math.random()<0.5 ? 'row' : 'col', true);
}

function shop(G, prof, tally){
  const S = G.S();
  S.shopRerolls = 0;
  G.rollOffers();
  if(tally) for(const o of S.offers)
    tally.offered.push({tier:o.tier||1, kind:o.kind, level:S.level,
                        poolTiers:tally.poolTiers});
  // buy until nothing on the counter is worth or within reach
  for(let guard = 0; guard < 8; guard++){
    const it = prof.buy.choose(G, S.offers, S.shards);
    if(!it) break;
    S.shards -= it.price;
    it.sold = true;
    if(it.kind === 'die') S.dicePool.push(G.makeDie(it.die));
    else if(it.kind === 'relic') S.relics.push(it.relic);
    else if(it.kind === 'chalk'){
      if(it.axis === 'cross'){ G.addChalk('row'); G.addChalk('col'); }
      else if(it.axis === 'deepen'){ if(S.chalks.length) S.chalks[0].mult += 2; }
      else G.addChalk(it.axis);
    }
    if(tally) tally.bought.push(it.id);
  }
}

function playRun(G, prof, tally){
  const S = G.freshState();
  G.setS(S);
  S.board = G.emptyBoard();
  const bones = Math.min(G.maxPool(), G.STARTING_BONES + S.rites.extraDie);
  for(let i=0;i<bones;i++) S.dicePool.push(G.makeDie('bone'));

  for(S.level = 1; S.level <= 400; S.level++){
    beginLevel(G);
    let cleared = false;
    for(S.castNum = 1; S.castNum <= G.castsPerLevel(); S.castNum++){
      G.clearBoard();
      castHeadless(G);
      // work the cast
      let best = null;
      for(let guard = 0; guard < 12; guard++){
        const score = Math.round(S.previewScore * S.previewMult);
        if(prof.skill.keepBest && (!best || score > best.score))
          best = {score, board:snapshot(G)};
        const ctx = {
          score,
          deadIds: deadBones(G),
          bankedEnough: S.levelScore + score >= S.quota,
        };
        if(S.rerollsLeft <= 0) break;
        const want = prof.skill.reroll(G, ctx);
        if(!want) break;
        if(!rerollSome(G, want)) break;
      }
      // a veteran does not throw away a good board for a worse one
      if(prof.skill.keepBest && best){
        const now = Math.round(S.previewScore * S.previewMult);
        if(best.score > now) restore(G, best.board);
      }
      bank(G);
      if(S.levelScore >= S.quota){ cleared = true; break; }
    }
    if(!cleared) break;                       // the run ends the only way it can
    sate(G);
    shop(G, prof, tally);
  }
  const award = G.closeOutRun();
  return {level:S.level, blood:S.totalScore, best:S.stats.best, award};
}
// a board is just where each bone sits and what it shows
function snapshot(G){
  return G.S().dicePool.map(d => ({id:d.id, gx:d.gx, gy:d.gy, v:d.value}));
}
function restore(G, snap){
  const S = G.S();
  S.board = G.emptyBoard();
  const by = new Map(snap.map(s=>[s.id, s]));
  for(const d of S.dicePool){
    const s = by.get(d.id);
    if(!s || s.gx < 0){ d.gx = -1; d.gy = -1; continue; }
    d.gx = s.gx; d.gy = s.gy; d.value = s.v;
    S.board[s.gy][s.gx] = d;
  }
  G.refreshPreview();
}

// ---------------------------------------------------------------- spending
// Everything the ledger could buy right now, with what it costs.
function options(G){
  const out = [];
  for(const e of G.archiveRoster()){
    if(e.owned || G.isSealed(e)) continue;
    if(!G.depthGateMet(e.tier)) continue;
    out.push({kind:e.kind, id:e.id, cost:e.price, tier:e.tier, label:e.name});
  }
  for(const r of G.RITES){
    const next = G.riteNextLevel(r.key);
    if(!next || !G.riteGateMet(r.key, next)) continue;
    out.push({kind:'rite', id:r.key, cost:G.ritePrice(r.key, next), tier:0,
              label:r.name + ' ' + next});
  }
  return out;
}
function spend(G, prof, log){
  for(let guard = 0; guard < 60; guard++){
    const opts = options(G).filter(o => o.cost <= G.Meta.data.marrow);
    if(!opts.length) break;
    const buy = prof.spend.pick(G, opts);
    if(!buy) break;
    const ok = buy.kind === 'rite' ? G.buyRite(buy.id)
                                   : G.buyUnlock(buy.kind, buy.id);
    if(!ok) break;
    log.push(buy.label);
  }
}
// Two different finishes, and design §6's 15-25 target is about the FIRST of
// them: it was written before the Oaths existed and is a statement about
// content. Reporting them together would hide which half the cost is in.
function rosterDone(G){
  return !G.archiveRoster().filter(e => !G.isSealed(e)).some(e => !e.owned);
}
function oathsDone(G){ return G.RITES.every(r => G.riteNextLevel(r.key) === 0); }
function archiveDone(G){ return rosterDone(G) && oathsDone(G); }

// What the run pool actually holds, by tier — the honest denominator for
// "is the counter showing me a fair sample of what I have unlocked?"
function poolTierMix(G){
  const m = [0,0,0,0,0];
  for(const it of G.runShopPool()) m[it.tier || 1]++;
  return m;
}

// ---------------------------------------------------------------- a career
function career(prof){
  const G = boot();
  const runs = [];
  const order = [];
  const tally = {offered:[]};
  let done = null, doneRoster = null, hit15 = null, hit25 = null;
  for(let n = 1; n <= RUN_CAP; n++){
    const t = {offered:[], bought:[], poolTiers:poolTierMix(G)};
    const r = playRun(G, prof, t);
    const before = order.length;
    spend(G, prof, order);
    runs.push({n, level:r.level, blood:r.blood, best:r.best,
               marrow:r.award.total, pb:r.award.pb,
               purse:G.Meta.data.marrow, bought:order.length - before,
               owned:G.archiveRoster().filter(e=>e.owned && !G.isSealed(e)).length,
               rungs:G.RITES.reduce((a,x)=>a+G.riteLevel(x.key),0)});
    tally.offered.push(...t.offered);
    // the depth keys are a second currency, and the one nobody budgeted for
    const deep = G.Meta.data.lifetime.deepestLevel;
    if(!hit15 && deep >= 15) hit15 = n;
    if(!hit25 && deep >= 25) hit25 = n;
    if(!doneRoster && rosterDone(G)) doneRoster = n;
    if(!done && archiveDone(G)){ done = n; break; }
  }
  return {runs, order, tally, done, doneRoster, hit15, hit25,
          purse:G.Meta.data.marrow, stuck:options(G).length === 0 && !done,
          owned:G.archiveRoster().filter(e=>e.owned && !G.isSealed(e)).length, G};
}

// ---------------------------------------------------------------- reporting
const pct = (a,b) => b ? (100*a/b).toFixed(1) + '%' : '—';
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
const med  = a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y);
  return s[Math.floor(s.length/2)]; };
const f1 = n => n.toFixed(1);
// spread-args max blows the stack on a career-sized array
const hi = a => a.reduce((m,x)=>x>m?x:m, -Infinity);
const lo = a => a.reduce((m,x)=>x<m?x:m,  Infinity);
const p90 = a => { const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length*0.9)]; };

const PROFILES = [];
for(const s of ['novice','veteran'])
  for(const b of ['thrifty','greedy'])
    for(const m of ['breadth','oaths','content'])
      PROFILES.push({name:s+'/'+b+'/'+m, skill:SKILL[s], buy:BUYING[b], spend:SPEND[m]});

console.log('THE BONE SIEVE — career simulation');
console.log(CAREERS + ' careers per profile, run cap ' + RUN_CAP + '\n');

const rows = [];
for(const prof of PROFILES){
  const careers = [];
  for(let i = 0; i < CAREERS; i++) careers.push(career(prof));
  const doneAt = careers.map(c => c.done).filter(Boolean);
  const allRuns = careers.flatMap(c => c.runs);
  const depths = allRuns.map(r => r.level);
  const marrows = allRuns.map(r => r.marrow);
  // marrow per run, early vs late in a career
  const early = careers.flatMap(c => c.runs.slice(0, 5).map(r => r.marrow));
  const late  = careers.flatMap(c => c.runs.slice(-5).map(r => r.marrow));
  const firstBuys = {};
  for(const c of careers)
    c.order.slice(0, 6).forEach((label, i)=>{
      firstBuys[label] = firstBuys[label] || [0,0,0,0,0,0];
      firstBuys[label][i]++;
    });
  rows.push({prof:prof.name, careers, doneAt, allRuns, depths, marrows, early, late, firstBuys});

  const rosterAt = careers.map(c => c.doneRoster).filter(Boolean);
  rows[rows.length-1].rosterAt = rosterAt;
  const line = (tag, a) => '   ' + tag + ' ' +
    (a.length ? 'median ' + String(med(a)).padStart(3) + '  mean ' + f1(mean(a)).padStart(5) +
                '  range ' + lo(a) + '-' + hi(a) + '  (' + pct(a.length, CAREERS) + ' got there)'
              : 'never inside ' + RUN_CAP);
  console.log('── ' + prof.name);
  console.log(line('ROSTER only  (design 6 wants 15-25) ', rosterAt));
  console.log(line('ROSTER + all Oath rungs             ', doneAt));
  const h15 = careers.map(c=>c.hit15).filter(Boolean);
  const h25 = careers.map(c=>c.hit25).filter(Boolean);
  console.log('   depth key 15 reached by ' + pct(h15.length, CAREERS).padStart(6) +
              ' of careers' + (h15.length ? ', median run ' + med(h15) : '') +
              '   |   key 25 by ' + pct(h25.length, CAREERS).padStart(6) +
              (h25.length ? ', median run ' + med(h25) : ''));
  const stuck = careers.filter(c=>c.stuck);
  if(stuck.length)
    console.log('   STALLED (nothing left it may buy) ' + pct(stuck.length, CAREERS) +
                ' of careers, holding a mean purse of ' +
                f1(mean(stuck.map(c=>c.purse))) + ' marrow with ' +
                f1(mean(stuck.map(c=>c.owned))) + '/52 owned');
  console.log('   depth   median ' + med(depths) + '  mean ' + f1(mean(depths)) +
              '  p90 ' + p90(depths) + '  deepest ' + hi(depths));
  console.log('   marrow  mean/run ' + f1(mean(marrows)) +
              '   first 5 runs ' + f1(mean(early)) +
              '   last 5 runs ' + f1(mean(late)));
}

console.log('\n\n=== WHAT GETS BOUGHT FIRST ===');
for(const r of rows){
  const top = Object.entries(r.firstBuys)
    .sort((a,b)=>b[1].reduce((x,y)=>x+y,0)-a[1].reduce((x,y)=>x+y,0)).slice(0,6);
  console.log('\n' + r.prof);
  for(const [label, slots] of top)
    console.log('   ' + label.padEnd(24) + ' picks 1-6: ' + slots.join(' '));
}

console.log('\n\n=== MARROW OVER A CAREER (mean per run, by run number) ===');
for(const r of rows.filter(x=>/veteran/.test(x.prof))){
  const bands = [];
  for(let b = 0; b < 6; b++){
    const v = r.careers.flatMap(c => c.runs.slice(b*5, b*5+5).map(x=>x.marrow));
    bands.push(v.length ? f1(mean(v)) : '—');
  }
  console.log('   ' + r.prof.padEnd(26) + ' runs 1-5..26-30: ' + bands.join('  '));
}

console.log('\n\n=== tierWeight() SKEW ===');
console.log('what the counter LAID OUT vs what was IN the pool it drew from');
console.log('(a fair draw would put the two lines on top of each other)\n');
for(const r of rows.filter(x=>/veteran\/greedy/.test(x.prof))){
  const off = [0,0,0,0,0], pool = [0,0,0,0,0];
  for(const o of r.careers.flatMap(c=>c.tally.offered)){
    off[o.tier]++;
    for(let t=1;t<=4;t++) pool[t] += (o.poolTiers[t] || 0);
  }
  const ot = off.reduce((a,b)=>a+b,0), pt = pool.reduce((a,b)=>a+b,0);
  console.log('   ' + r.prof);
  console.log('      offered  t1 ' + pct(off[1],ot).padStart(6) + '  t2 ' + pct(off[2],ot).padStart(6) +
              '  t3 ' + pct(off[3],ot).padStart(6) + '  t4 ' + pct(off[4],ot).padStart(6));
  console.log('      in pool  t1 ' + pct(pool[1],pt).padStart(6) + '  t2 ' + pct(pool[2],pt).padStart(6) +
              '  t3 ' + pct(pool[3],pt).padStart(6) + '  t4 ' + pct(pool[4],pt).padStart(6));
}

console.log('\n   the same thing by DEPTH, for veteran/greedy/breadth');
console.log('   (tierWeight ramps t3 and t4 in with the descent, so this is where');
console.log('    the deep content is supposed to start showing up)\n');
{
  const r = rows.find(x=>x.prof === 'veteran/greedy/breadth');
  const bands = [[1,4],[5,9],[10,14],[15,19],[20,24],[25,99]];
  for(const [a,b] of bands){
    const o = r.careers.flatMap(c=>c.tally.offered).filter(x=>x.level>=a && x.level<=b);
    const t = [0,0,0,0,0];
    for(const x of o) t[x.tier]++;
    const n = o.length;
    console.log('   descent ' + (a + '-' + (b>90?'+':b)).padEnd(6) +
      ' n=' + String(n).padStart(6) +
      '   t1 ' + pct(t[1],n).padStart(6) + '  t2 ' + pct(t[2],n).padStart(6) +
      '  t3 ' + pct(t[3],n).padStart(6) + '  t4 ' + pct(t[4],n).padStart(6));
  }
}

if(JSON_OUT){
  fs.writeFileSync(JSON_OUT, JSON.stringify(rows.map(r=>({
    prof:r.prof, doneAt:r.doneAt, runs:r.allRuns})), null, 1));
  console.log('\nraw rows -> ' + JSON_OUT);
}

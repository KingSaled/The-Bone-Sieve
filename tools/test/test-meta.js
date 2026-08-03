// Harness: fake localStorage, load the extracted Meta module, exercise it.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'build', 'meta.js'), 'utf8');

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const run = new Function('localStorage', src + '\nreturn {Meta, freshMeta, META_KEY, META_VERSION, RITE_MAX, metaIdList, metaInt, hydrateMeta, migrateMeta};');
const M = run(localStorage);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};

console.log('\n1. fresh boot writes a ledger');
const d = M.Meta.load();
eq('key exists after first load', typeof store[M.META_KEY], 'string');
eq('marrow starts 0', d.marrow, 0);
eq('bone die only', d.unlockedDice, ['bone']);
eq('all 7 tier-1 relics', d.unlockedRelics,
   ['dust','candle','hook','nail','obol','censer','ember']);
// The four Rites are ladder levels now, not buy-once flags (design §3's
// restructure). extraAltar stays a reserved boolean — §3 never revisited it.
eq('rite ladders start at level 0',
   [d.rites.extraDie, d.rites.extraReroll, d.rites.cheapReroll, d.rites.extraShards],
   [0, 0, 0, 0]);
eq('extraAltar is still a reserved flag', d.rites.extraAltar, false);
eq('lifetime zeroed', d.lifetime, {runs:0, deepestLevel:0, bestOffering:0, trialsCleared:0});
eq('story empty', [d.storyBeatsFired, d.storyComplete], [[], false]);
eq('tutorial reserved', d.tutorial, {seen:false, skipped:false});
eq('version stamped', d.version, 2);

console.log('\n2. round-trips across a "restart"');
M.Meta.data.marrow = 417;
M.Meta.data.lifetime.deepestLevel = 26;
M.Meta.data.unlockedDice.push('runt', 'crimson');
M.Meta.data.rites.extraDie = 2;
M.Meta.data.storyBeatsFired.push('ledger_found');
M.Meta.save();
const reloaded = M.Meta.load();          // simulates closing + reopening
eq('marrow survives', reloaded.marrow, 417);
eq('deepestLevel survives', reloaded.lifetime.deepestLevel, 26);
eq('unlocks survive', reloaded.unlockedDice, ['bone','runt','crimson']);
eq('rite level survives', reloaded.rites.extraDie, 2);
eq('story beat survives', reloaded.storyBeatsFired, ['ledger_found']);

console.log('\n3. corrupt / hostile ledgers');
store[M.META_KEY] = '{"marrow":4';                       // truncated JSON
eq('unparseable -> fresh', M.Meta.load().marrow, 0);
store[M.META_KEY] = 'null';
eq('null -> fresh', M.Meta.load().unlockedDice, ['bone']);
store[M.META_KEY] = '[1,2,3]';
eq('array -> fresh', M.Meta.load().marrow, 0);
store[M.META_KEY] = JSON.stringify({marrow:'NaN', lifetime:{deepestLevel:'abc'}});
eq('NaN marrow -> 0', M.Meta.load().marrow, 0);
eq('NaN stat -> 0', M.Meta.data.lifetime.deepestLevel, 0);
store[M.META_KEY] = JSON.stringify({marrow:-500, lifetime:{runs:-3}});
eq('negative marrow clamped', M.Meta.load().marrow, 0);
eq('negative stat clamped', M.Meta.data.lifetime.runs, 0);
store[M.META_KEY] = JSON.stringify({marrow:1e400});      // serialises to null
eq('Infinity marrow -> 0', M.Meta.load().marrow, 0);
store[M.META_KEY] = JSON.stringify({marrow:9e99});
eq('absurd marrow capped', M.Meta.load().marrow, 1e9);
store[M.META_KEY] = JSON.stringify({marrow:12.9});
eq('float marrow floored', M.Meta.load().marrow, 12);

console.log('\n4. id-list hygiene');
store[M.META_KEY] = JSON.stringify({unlockedDice:['bone','bone','runt',7,null,'  ','ivory  ']});
eq('dupes/junk stripped, trimmed', M.Meta.load().unlockedDice, ['bone','runt','ivory']);
store[M.META_KEY] = JSON.stringify({unlockedDice:['runt']});
eq('bone floored back in', M.Meta.load().unlockedDice, ['runt','bone']);
store[M.META_KEY] = JSON.stringify({unlockedRelics:[]});
eq('tier-1 relics floored back in', M.Meta.load().unlockedRelics.length, 7);
store[M.META_KEY] = JSON.stringify({unlockedDice:['bone','the_widow_who_died_at_18']});
eq('unknown (story-generated) id kept', M.Meta.load().unlockedDice,
   ['bone','the_widow_who_died_at_18']);
eq('id list capped', M.metaIdList(Array.from({length:2000}, (_, i) => 'd' + i), []).length, 512);
eq('over-long id dropped', M.metaIdList(['x'.repeat(65), 'ok'], []), ['ok']);

console.log('\n5. partial / older-shape ledgers');
store[M.META_KEY] = JSON.stringify({version:2, marrow:88});   // every other key absent
const p = M.Meta.load();
eq('missing keys defaulted', [p.marrow, p.storyComplete, p.tutorial.seen, p.disabledDice],
   [88, false, false, []]);
eq('missing rites defaulted', p.rites.cheapReroll, 0);
store[M.META_KEY] = JSON.stringify({version:2, marrow:5, rites:{extraDie:'yes'}, tutorial:{seen:1}});
eq('non-numeric rite rejected', M.Meta.load().rites.extraDie, 0);
eq('non-bool tutorial rejected', M.Meta.data.tutorial.seen, false);
store[M.META_KEY] = JSON.stringify({marrow:5, unknownFutureKey:'x'});
eq('unknown key dropped', 'unknownFutureKey' in M.Meta.load(), false);

console.log('\n6. load repairs the stored copy in place');
store[M.META_KEY] = JSON.stringify({marrow:-9, unlockedDice:['runt','runt']});
M.Meta.load();
const onDisk = JSON.parse(store[M.META_KEY]);
eq('disk copy repaired', [onDisk.marrow, onDisk.unlockedDice], [0, ['runt','bone']]);

console.log('\n7. reset');
M.Meta.data.marrow = 999; M.Meta.save();
eq('reset zeroes career', M.Meta.reset().marrow, 0);
eq('reset persisted', JSON.parse(store[M.META_KEY]).marrow, 0);

console.log('\n8. save failure is non-fatal');
const M2 = run({getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }});
eq('load survives a dead localStorage', M2.Meta.load().marrow, 0);
eq('save reports false', M2.Meta.save(), false);

// ---------------------------------------------------------------------
// The first real migration. A v1 ledger recorded each Rite as a buy-once
// boolean; design §3's restructure makes them tiered ladders, so `true` has to
// become level 1. A career that already paid for a Rite is precisely the thing
// a shape change must not quietly cost someone.
// ---------------------------------------------------------------------
console.log('\n9. v1 -> v2: buy-once Rite flags become ladder levels');
store[M.META_KEY] = JSON.stringify({
  version: 1, marrow: 300,
  unlockedDice: ['bone','runt'],
  rites: {extraDie:true, extraReroll:false, cheapReroll:true, extraShards:false, extraAltar:false},
  lifetime: {runs:12, deepestLevel:17, bestOffering:8000, trialsCleared:4},
});
{
  const v = M.Meta.load();
  eq('a bought flag becomes level 1', [v.rites.extraDie, v.rites.cheapReroll], [1, 1]);
  eq('an unbought flag becomes level 0', [v.rites.extraReroll, v.rites.extraShards], [0, 0]);
  eq('extraAltar stays a boolean', v.rites.extraAltar, false);
  eq('the rest of the career is untouched',
     [v.marrow, v.unlockedDice, v.lifetime.deepestLevel, v.lifetime.runs],
     [300, ['bone','runt'], 17, 12]);
  eq('restamped to v2', v.version, M.META_VERSION);
  eq('the migration is written back to disk',
     JSON.parse(store[M.META_KEY]).rites.extraDie, 1);
}
// a ledger with no version at all predates the stamp, and migrates the same way
store[M.META_KEY] = JSON.stringify({rites:{extraReroll:true}});
eq('an unversioned ledger migrates too', M.Meta.load().rites.extraReroll, 1);
// and a v2 ledger must pass straight through
store[M.META_KEY] = JSON.stringify({version:2, rites:{extraDie:3}});
eq('v2 is not migrated again', M.Meta.load().rites.extraDie, 3);

console.log('\n10. ladder levels are clamped to design §3\'s caps');
eq('power ladders cap at 3', [M.RITE_MAX.extraDie, M.RITE_MAX.extraReroll], [3, 3]);
eq('economy ladders cap at 5', [M.RITE_MAX.cheapReroll, M.RITE_MAX.extraShards], [5, 5]);
store[M.META_KEY] = JSON.stringify({version:2, rites:{extraDie:99, extraShards:99}});
{
  const v = M.Meta.load();
  eq('an over-claimed power ladder is clamped', v.rites.extraDie, 3);
  eq('an over-claimed economy ladder is clamped', v.rites.extraShards, 5);
}
store[M.META_KEY] = JSON.stringify({version:2, rites:{extraDie:-4}});
eq('a negative level is clamped to 0', M.Meta.load().rites.extraDie, 0);
store[M.META_KEY] = JSON.stringify({version:2, rites:{extraDie:2.7}});
eq('a fractional level is floored', M.Meta.load().rites.extraDie, 2);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

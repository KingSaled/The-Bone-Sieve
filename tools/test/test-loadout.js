// LOADOUT TOGGLES (design §11) — setting owned content aside for a run.
//
// The point of this suite is that a switch in the Archive actually reaches the
// Ossuary's counter and the Trial's boon table, so almost everything below
// ends in a few thousand real rollOffers()/rollBoons() draws rather than in an
// assertion about an array.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const econ  = fs.readFileSync(B('econ.js'), 'utf8');
const arcui = fs.readFileSync(B('arcui.js'), 'utf8');
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
  function toast(t, i){ __toast(t, i); }
  function sfx(){} function buildBoneFrames(){} function hydrateIcons(){}
  function menuScreen(id){
    ['menuHome','menuRules','menuArchive'].forEach(s=>$(s).classList.toggle('hidden', s!==id));
  }
  function boonTierBias(level){ return 1 + Math.min(3, Math.max(0, level - 5)/8); }
  function boonCount(id){ return S && S.boons ? S.boons.filter(b=>b===id).length : 0; }
  const BOON_TIER_NAME = {1:'A FAVOUR',2:'A BLESSING',3:'A GREAT BOON',4:'AN APOTHEOSIS'};
`;
const run = new Function('window','document','localStorage','__toast',
  preamble + econ + '\n' + boons + '\n' + arcui + `
  return {Meta, archiveRoster, toggleItem, itemDisabled, buyUnlock, runShopPool,
          rollOffers, rollBoons, renderArchive, openArchive, arcShowTab,
          setS: v => { S = v; }, getS: () => S,
          setMenuMode: v => { menuMode = v; }};
`);

const store = {};
const G = run(window, document,
  { getItem:k => (k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=String(v); } },
  t => toasts.push(t));

const $ = id => document.getElementById(id);
const plaque = (kind, id) => $('arcRoster').querySelector(
  '.arcCard[data-kind="' + kind + '"][data-id="' + id + '"]');
const switchOf = (kind, id) => plaque(kind, id).querySelector('.aSwitch');
const click = el => el.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
const classesOf = (kind, id) => plaque(kind, id).className.split(' ');

// A run whose pool is taken fresh from the ledger, as startRun would.
const mkRun = (level) => ({
  level, shards:0, relics:[], chalks:[], dicePool:[], boons:[], offers:[],
  selIdx:null, shopRerolls:0, wares:G.runShopPool(),
});
// What the Ossuary will actually lay out over many visits.
const seenInShop = (S, n) => {
  G.setS(S);
  const seen = new Set();
  for(let i=0;i<n;i++){ G.rollOffers();
    for(const o of S.offers) seen.add(o.kind + ':' + (o.die || o.relic || o.id)); }
  return seen;
};

G.Meta.load();
// Give the ledger something worth setting aside: a couple of dice, a chalk and
// a relic beyond the opening seven, granted rather than bought — this suite is
// about the switches, not the purse.
G.Meta.data.unlockedDice.push('runt', 'twin');
G.Meta.data.unlockedChalks.push('chalk_row', 'chalk_col');
G.Meta.data.unlockedRelics.push('eye');
G.Meta.save();

console.log('\n1. a fresh loadout has nothing set aside');
G.openArchive();
eq('the disabled lists start empty',
   [G.Meta.data.disabledDice, G.Meta.data.disabledChalks, G.Meta.data.disabledRelics],
   [[], [], []]);
eq('every owned plaque carries a switch',
   G.archiveRoster().filter(e=>e.owned).every(e => !!switchOf(e.kind, e.id)), true);
eq('and every switch reads on',
   [...$('arcRoster').querySelectorAll('.aSwitch')].every(s => s.classList.contains('on')), true);
eq('a switch says what it is doing', switchOf('relic','dust').textContent, 'IN THE POOL');
eq('and says it to a screen reader too',
   switchOf('relic','dust').getAttribute('aria-pressed'), 'true');

console.log('\n2. nothing unowned has one — there is no state to keep yet');
eq('an unaffordable relic has no switch', plaque('relic','ash').querySelector('.aSwitch'), null);
eq('a depth-gated die has no switch', plaque('die','crimson').querySelector('.aSwitch'), null);
eq('an unowned chalk has no switch', plaque('chalk','chalk_cross').querySelector('.aSwitch'), null);
eq('and toggling one anyway is refused', G.toggleItem('relic','ash'), false);
eq('so the disabled list stays clean', G.Meta.data.disabledRelics, []);
eq('an unknown id is refused too', G.toggleItem('relic','nonesuch'), false);

console.log('\n3. setting one aside, by clicking its switch');
click(switchOf('relic','dust'));
eq('recorded in the ledger', G.Meta.data.disabledRelics, ['dust']);
eq('itemDisabled agrees', G.itemDisabled('relic','dust'), true);
eq('the switch reads off', switchOf('relic','dust').classList.contains('on'), false);
eq('and says so', switchOf('relic','dust').textContent, 'SET ASIDE');
eq('aria follows', switchOf('relic','dust').getAttribute('aria-pressed'), 'false');

console.log('\n4. it still reads as OWNED, not as locked');
{
  const c = classesOf('relic','dust');
  eq('still owned', c.includes('owned'), true);
  eq('marked off', c.includes('off'), true);
  eq('never locked', c.includes('locked'), false);
  eq('never gated', c.includes('gated'), false);
  // the two are different states and must not collapse into one look
  eq('a locked plaque is a different thing entirely',
     classesOf('relic','ash').includes('off'), false);
  // the count lives on the SET ASIDE filter option now, not on a section header
  eq('the filter option counts it',
     /SET ASIDE<\/span><b>1<\/b>/.test($('arcStateList').innerHTML), true);
}

console.log('\n5. it leaves the next run\'s pool, and the Ossuary stops offering it');
eq('gone from the pool', G.runShopPool().some(i=>i.relic==='dust'), false);
eq('the rest of the pool is untouched', G.runShopPool().some(i=>i.relic==='candle'), true);
{
  const seen = seenInShop(mkRun(8), 4000);
  eq('4,000 shops, never once offered', seen.has('relic:dust'), false);
  eq('its neighbours still are', seen.has('relic:candle'), true);
}

console.log('\n6. switching it back on brings it straight back');
click(switchOf('relic','dust'));
eq('off the disabled list', G.Meta.data.disabledRelics, []);
eq('the switch reads on again', switchOf('relic','dust').classList.contains('on'), true);
eq('no longer marked off', classesOf('relic','dust').includes('off'), false);
eq('back in the pool', G.runShopPool().some(i=>i.relic==='dust'), true);
eq('and offered again', seenInShop(mkRun(8), 4000).has('relic:dust'), true);
eq('the filter option stops counting it',
   /SET ASIDE<\/span><b>0<\/b>/.test($('arcStateList').innerHTML), true);

console.log('\n7. it works the same for dice and for chalks');
click(switchOf('die','runt'));
click(switchOf('chalk','chalk_row'));
eq('die recorded', G.Meta.data.disabledDice, ['runt']);
eq('chalk recorded', G.Meta.data.disabledChalks, ['chalk_row']);
{
  const seen = seenInShop(mkRun(12), 4000);
  eq('the set-aside die is never laid out', seen.has('die:runt'), false);
  eq('the die left on still is', seen.has('die:twin'), true);
  eq('the set-aside chalk is never laid out', seen.has('chalk:chalk_row'), false);
  eq('the chalk left on still is', seen.has('chalk:chalk_col'), true);
}

console.log('\n8. unlocking is untouched by any of it');
eq('the die is still unlocked', G.Meta.data.unlockedDice.includes('runt'), true);
eq('the chalk is still unlocked', G.Meta.data.unlockedChalks.includes('chalk_row'), true);
eq('both still read as owned',
   [classesOf('die','runt').includes('owned'), classesOf('chalk','chalk_row').includes('owned')],
   [true, true]);

console.log('\n9. a loadout survives a reload');
{
  G.Meta.load();
  eq('dice list persisted', G.Meta.data.disabledDice, ['runt']);
  eq('chalk list persisted', G.Meta.data.disabledChalks, ['chalk_row']);
  G.renderArchive();
  eq('and the screen agrees', switchOf('die','runt').classList.contains('on'), false);
}

console.log('\n10. the Deep Chalk boon follows the loadout, not the ledger');
// the boon is withheld when no line can exist this descent — which now
// includes "every chalk the player owns has been set aside"
{
  const boonsSeen = S => {
    G.setS(S);
    const seen = new Set();
    for(let i=0;i<4000;i++) for(const b of G.rollBoons()) seen.add(b.id);
    return seen;
  };
  eq('with a chalk still switched on, the boon is live',
     boonsSeen(mkRun(25)).has('deepchalk'), true);
  click(switchOf('chalk','chalk_col'));           // now both are set aside
  eq('both chalks aside', G.Meta.data.disabledChalks.sort(), ['chalk_col','chalk_row']);
  eq('the boon is withheld', boonsSeen(mkRun(25)).has('deepchalk'), false);
  eq('other boons are unaffected', boonsSeen(mkRun(25)).size > 10, true);
  click(switchOf('chalk','chalk_col'));           // and back
  eq('switching one back on revives it', boonsSeen(mkRun(25)).has('deepchalk'), true);
}

console.log('\n11. a live run keeps the loadout it began with');
// menuMode false is what a descent actually looks like. It matters: toggleItem
// re-snapshots S.wares when the player is at the MENU, because there S is only
// a placeholder left over from the last freshState() and the Grimoire reads it.
// Every route into the menu — boot, abandoning, and returning after a death —
// replaces S with a fresh state before openMenu(), so that re-snapshot can
// never land on a run being played. This section is the other half of that:
// with a real descent live, the ledger may move and the run may not.
{
  G.setMenuMode(false);
  const S = mkRun(6);
  G.setS(S);
  const before = S.wares.length;
  eq('the run began with the eye', S.wares.some(i=>i.relic==='eye'), true);
  G.toggleItem('relic','eye');                    // set aside mid-descent
  eq('the ledger moved', G.itemDisabled('relic','eye'), true);
  eq('the live run did not', S.wares.length, before);
  eq('and it is still offered this descent', seenInShop(S, 3000).has('relic:eye'), true);
  eq('but the next run will not see it', G.runShopPool().some(i=>i.relic==='eye'), false);
  G.toggleItem('relic','eye');
  G.setMenuMode(true);
}

console.log('\n12. setting absolutely everything aside is allowed, and says so');
{
  for(const e of G.archiveRoster()) if(e.owned && !e.off) G.toggleItem(e.kind, e.id);
  G.renderArchive();
  eq('the pool is empty', G.runShopPool().length, 0);
  eq('the Archive warns about it', /Everything is set aside/.test($('arcRoster').innerHTML), true);
  // an empty counter must not throw — the shop simply has nothing on it
  const S = mkRun(10);
  G.setS(S);
  G.rollOffers();
  eq('the Ossuary lays out nothing, and survives doing it', S.offers, []);
  eq('every plaque still reads as owned, none as locked',
     G.archiveRoster().filter(e=>e.owned)
      .every(e => classesOf(e.kind, e.id).includes('owned') &&
                  !classesOf(e.kind, e.id).includes('locked')), true);
}

console.log('\n13. and it all comes back');
{
  for(const e of G.archiveRoster()) if(e.off) G.toggleItem(e.kind, e.id);
  G.renderArchive();
  eq('nothing set aside anywhere',
     [G.Meta.data.disabledDice, G.Meta.data.disabledChalks, G.Meta.data.disabledRelics],
     [[], [], []]);
  eq('the warning is gone', /Everything is set aside/.test($('arcRoster').innerHTML), false);
  eq('the pool is whole again', G.runShopPool().length,
     G.archiveRoster().filter(e=>e.owned).length);
}

console.log('\n14. scouring the Archive forgets the loadout too');
{
  G.toggleItem('relic','dust');
  eq('something is set aside', G.Meta.data.disabledRelics, ['dust']);
  G.Meta.reset();
  eq('the disabled lists are cleared',
     [G.Meta.data.disabledDice, G.Meta.data.disabledChalks, G.Meta.data.disabledRelics],
     [[], [], []]);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

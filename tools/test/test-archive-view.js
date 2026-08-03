// THE ARCHIVE, as a screen — the panel, the tabs, the filters and the search.
//
// This suite loads the real stylesheet into jsdom and asks what a class
// actually DOES, not merely whether it was applied. That distinction is the
// reason it exists: the tab panes were switched with a `hidden` class that no
// rule in the file matched (`.hidden` is only ever declared as
// `.overlay.hidden` and `.menuScreen.hidden`), so both tabs rendered on top of
// one another while every className assertion in the suite passed.
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const econ  = fs.readFileSync(B('econ.js'), 'utf8');
const arcui = fs.readFileSync(B('arcui.js'), 'utf8');
const body  = fs.readFileSync(B('body.html'), 'utf8');
const css   = fs.readFileSync(B('style.css'), 'utf8');

// jsdom logs on CSS it cannot parse (clamp(), nested media, -webkit-*). None of
// that affects the handful of display rules under test, so the noise is muted
// rather than left to bury a real failure.
const vc = new VirtualConsole();
const { window } = new JSDOM(
  '<!doctype html><html><head><style>' + css + '</style></head>' + body + '</html>',
  { url:'https://local.test/', virtualConsole: vc });
const { document } = window;

let pass = 0, fail = 0;
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
  function toast(){} function sfx(){} function buildBoneFrames(){}
  function menuScreen(id){
    ['menuHome','menuRules','menuArchive'].forEach(s=>$(s).classList.toggle('hidden', s!==id));
  }
`;
const run = new Function('window','document','localStorage',
  preamble + econ + '\n' + arcui + `
  return {Meta, renderArchive, openArchive, arcShowTab, archiveRoster, buyUnlock,
          toggleItem, RITES, setS: v => { S = v; }};
`);

const store = {};
const G = run(window, document,
  { getItem:k => (k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=String(v); } });

const $ = id => document.getElementById(id);
const cards = () => [...$('arcRoster').querySelectorAll('.arcCard')];
const ids = () => cards().map(c => c.dataset.id);
const click = el => el.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
const shown = el => window.getComputedStyle(el).display !== 'none';
// the two filter menus, driven the way a player drives them: open, then pick
const opt = (listId, v) => $(listId).querySelector('.dropOpt[data-v="' + v + '"]');
const pick = (btnId, listId, v) => { click($(btnId)); click(opt(listId, v)); };
const chosen = (btnId) => $(btnId).querySelector('span').textContent;

G.Meta.load();
G.openArchive();

console.log('\n1. the stylesheet is really loaded, or nothing below means anything');
// a control: a rule that has always existed and must resolve
eq('a known rule resolves', window.getComputedStyle($('menuHome')).display !== '', true);
eq('.menuScreen.hidden actually hides', shown($('menuRules')), false);

console.log('\n2. the panel — its own furniture, not loose content on the fog');
eq('there is a panel', !!$('menuArchive').querySelector('.arcPanel'), true);
eq('the head is outside the scrolling region',
   !!$('menuArchive').querySelector('.arcPanel > .arcTop'), true);
eq('the purse lives in the head', $('arcMarrow').closest('.arcTop') !== null, true);
eq('exactly one scrolling region', $('menuArchive').querySelectorAll('#arcBody').length, 1);
eq('and both panes are inside it',
   [$('arcRoster').closest('#arcBody') !== null, $('arcOaths').closest('#arcBody') !== null],
   [true, true]);
eq('the return button is outside it too',
   $('miArchiveBack').closest('#arcBody'), null);

console.log('\n3. the tabs actually hide each other');
// the bug this suite was written for: className said hidden, the screen did not
eq('roster is showing', shown($('arcRoster')), true);
eq('oaths are not', shown($('arcOaths')), false);
click($('arcTabOaths'));
eq('oaths now showing', shown($('arcOaths')), true);
eq('roster now hidden', shown($('arcRoster')), false);
eq('the filters leave with the roster they belong to', shown($('arcFilters')), false);
click($('arcTabRoster'));
eq('and back again', [shown($('arcRoster')), shown($('arcOaths'))], [true, false]);
eq('filters return', shown($('arcFilters')), true);
eq('the tab counts what it holds', $('arcTabRosterN').textContent, '8/52');
eq('the oaths tab counts rungs', $('arcTabOathsN').textContent, '0/16');

console.log('\n4. every tile is the same tile');
{
  const parts = ['.acTop','.acTier','.acKind','.acArt','.acName','.acDesc','.acFoot'];
  eq('52 tiles', cards().length, 52);
  eq('every one carries every region',
     cards().every(c => parts.every(p => !!c.querySelector(p))), true);
  eq('every one carries exactly one art window',
     cards().every(c => c.querySelectorAll('.acArt').length === 1), true);
  eq('and exactly one icon inside it',
     cards().every(c => c.querySelectorAll('.acArt .ic').length === 1), true);
  eq('every one names its rarity',
     cards().every(c => /^(COMMON|UNCOMMON|RARE|CURSED)$/.test(
       c.querySelector('.acTier').textContent)), true);
  // the requirement is that they AGREE, not that they are any one number —
  // a short viewport brings the whole tile down a size and must bring every
  // tile down together
  eq('one art-window height across the whole rack',
     [...new Set(cards().map(c =>
       window.getComputedStyle(c.querySelector('.acArt')).height))].length, 1);
  eq('one rule-box height across the whole rack',
     [...new Set(cards().map(c =>
       window.getComputedStyle(c.querySelector('.acDesc')).height))].length, 1);
}

console.log('\n5. the filters are one row of menus, not two rows of chips');
eq('exactly one filter row', $('menuArchive').querySelectorAll('#arcFilters').length, 1);
eq('the old chips are gone', $('arcFilters').querySelectorAll('.arcChip').length, 0);
eq('two menus in it', $('arcFilters').querySelectorAll('.drop').length, 2);
eq('and they use the Veil\'s own dropdown component',
   $('arcGroupDrop').classList.contains('drop'), true);
// the wording a player reads: plain, not flavour. "NOT YET" meant nothing.
eq('the state options say what they mean',
   [...$('arcStateList').querySelectorAll('.dropOpt span')].map(s => s.textContent),
   ['ALL','OWNED','AFFORDABLE','LOCKED','SET ASIDE']);
eq('and so do the group options',
   [...$('arcGroupList').querySelectorAll('.dropOpt span')].map(s => s.textContent),
   ['EVERYTHING','DICE','CHALKS','RELICS']);

console.log('\n6. the group filter cuts the rack down');
eq('all 52 to begin with', cards().length, 52);
pick('arcGroupBtn','arcGroupList','die');
eq('dice only', cards().length, 11);
eq('and they really are all dice', cards().every(c => c.dataset.kind === 'die'), true);
eq('the button reports what is chosen', chosen('arcGroupBtn'), 'DICE');
eq('the menu closes behind the choice', $('arcGroupDrop').classList.contains('open'), false);
pick('arcGroupBtn','arcGroupList','chalk');
eq('chalks only', cards().length, 4);
pick('arcGroupBtn','arcGroupList','relic');
eq('relics only', cards().length, 37);
eq('the chosen option is the marked one', opt('arcGroupList','relic').classList.contains('on'), true);
eq('and the others are not', opt('arcGroupList','die').classList.contains('on'), false);
pick('arcGroupBtn','arcGroupList','all');
eq('back to everything', cards().length, 52);

console.log('\n7. the state filter, and its counts');
pick('arcStateBtn','arcStateList','owned');
eq('a fresh save owns eight things', cards().length, 8);
eq('the option said so before it was picked',
   opt('arcStateList','owned').querySelector('b').textContent, '8');
pick('arcStateBtn','arcStateList','buy');
eq('nothing is affordable at 0 marrow', cards().length, 0);
eq('and the rack says so plainly', !!$('arcRoster').querySelector('.arcEmpty'), true);
pick('arcStateBtn','arcStateList','locked');
eq('forty-four are locked', cards().length, 44);
pick('arcStateBtn','arcStateList','all');

console.log('\n8. the two filters compose, and can be cleared');
pick('arcGroupBtn','arcGroupList','die');
pick('arcStateBtn','arcStateList','owned');
eq('owned dice only', ids(), ['bone']);
eq('state counts follow the group, not the whole roster',
   opt('arcStateList','owned').querySelector('b').textContent, '1');
eq('the rack says how much it is hiding', /1<\/b> of 52/.test($('arcShowing').innerHTML), true);
eq('a clear control appears once anything is filtered', shown($('btnArcClearFilters')), true);
click($('btnArcClearFilters'));
eq('and puts everything back', cards().length, 52);
eq('menus reset with it', [chosen('arcGroupBtn'), chosen('arcStateBtn')], ['EVERYTHING','ALL']);
eq('the clear control goes away again', shown($('btnArcClearFilters')), false);
eq('showing reads as the whole roster', /all 52/.test($('arcShowing').textContent), true);

console.log('\n9. search, over names only');
const search = q => { $('arcSearch').value = q;
  $('arcSearch').dispatchEvent(new window.Event('input', {bubbles:true})); };
search('mirror');
eq('finds by name', ids(), ['mirror']);
search('MIRROR');
eq('and does not care about case', ids(), ['mirror']);
// the reason it is names only: "run" is in half the relic table's rule text,
// and searching that buried the die the player was actually typing for
search('run');
eq('typing run finds the Runt Die', ids(), ['runt']);
eq('and nothing else', cards().length, 1);
search('zzzz');
eq('an empty result says so', cards().length, 0);
eq('with a message about the search', /answers to that name/.test($('arcRoster').textContent), true);
eq('the clear button appears with a query', shown($('arcSearchClear')), true);
click($('arcSearchClear'));
eq('clearing restores the rack', cards().length, 52);
eq('and the field with it', $('arcSearch').value, '');
eq('the clear button goes away again', shown($('arcSearchClear')), false);

console.log('\n10. a filtered view survives what happens inside it');
{
  G.Meta.data.marrow = 999; G.renderArchive();
  pick('arcGroupBtn','arcGroupList','die');
  pick('arcStateBtn','arcStateList','buy');
  eq('a rack of affordable dice', cards().length > 0, true);
  // setting one aside re-renders; the view must not reset to everything
  G.toggleItem('die','bone');
  G.renderArchive({fresh:false});
  eq('still on the same group', chosen('arcGroupBtn'), 'DICE');
  eq('still on the same state', chosen('arcStateBtn'), 'AFFORDABLE');
  G.toggleItem('die','bone');
  click($('btnArcClearFilters'));
}

console.log('\n11. the entrance animation is for new racks only');
// replaying fifty-two entrances on every click is the blink the Ossuary's
// cards were fixed for, so a touched rack must not carry the class
G.renderArchive();
eq('a rebuilt rack is fresh', $('arcRoster').classList.contains('fresh'), true);
G.renderArchive({fresh:false});
eq('a touched rack is not', $('arcRoster').classList.contains('fresh'), false);
eq('but the tiles are all still there', cards().length, 52);

console.log('\n12. the panel holds still whatever is in it');
// it used to size to content, so filtering the rack down or swapping tabs
// moved the frame under the pointer on the way to the thing being clicked
{
  const H = () => Math.round($('menuArchive').querySelector('.arcPanel').getBoundingClientRect().height);
  const full = H();
  search('zzzz');                                  // an empty rack
  eq('an empty rack does not shrink the panel', H(), full);
  search('');
  pick('arcGroupBtn','arcGroupList','chalk');      // four cards
  eq('four cards do not shrink it either', H(), full);
  click($('btnArcClearFilters'));
  click($('arcTabOaths'));
  eq('nor does the other tab', H(), full);
  click($('arcTabRoster'));
  eq('and it is the same on the way back', H(), full);
}

console.log('\n13. nothing on the rack moves under the pointer');
// a tile that lifts on hover slides the loadout switch out from under a click
{
  const hoverRules = [...window.document.styleSheets[0].cssRules]
    .filter(r => r.selectorText && /arcCard|oathCard|aSwitch/.test(r.selectorText) &&
                 /:hover/.test(r.selectorText));
  eq('some hover styling exists at all', hoverRules.length > 0, true);
  eq('but none of it translates anything',
     hoverRules.filter(r => /translate/.test(r.style.transform || '')).map(r => r.selectorText), []);
}

console.log('\n14. the Oaths sit in a row, not in four wide bars');
{
  click($('arcTabOaths'));
  eq('one grid holds them', $('arcOaths').querySelectorAll('.oathGrid').length, 1);
  eq('four cards in it', $('arcOaths').querySelectorAll('.oathGrid > .oathCard').length, 4);
  eq('the grid lays them in columns',
     window.getComputedStyle($('arcOaths').querySelector('.oathGrid')).display, 'grid');
  eq('each is built on the same art window as a roster tile',
     [...$('arcOaths').querySelectorAll('.oathCard')]
       .every(c => !!c.querySelector('.acArt .ic')), true);
  eq('and each carries its rungs as pips',
     [...$('arcOaths').querySelectorAll('.oathCard')]
       .every(c => c.querySelectorAll('.oPip').length > 0), true);
  eq('sixteen rungs across the four', $('arcOaths').querySelectorAll('.oPip').length, 16);
  click($('arcTabRoster'));
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

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
const chip = (host, attr, val) =>
  $(host).querySelector('.arcChip[data-' + attr + '="' + val + '"]');

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

console.log('\n5. the group filter cuts the rack down');
eq('all 52 to begin with', cards().length, 52);
click(chip('arcGroupChips','group','die'));
eq('bones only', cards().length, 11);
eq('and they really are all dice', cards().every(c => c.dataset.kind === 'die'), true);
click(chip('arcGroupChips','group','chalk'));
eq('chalks only', cards().length, 4);
click(chip('arcGroupChips','group','relic'));
eq('relics only', cards().length, 37);
eq('the chosen chip is the marked one',
   chip('arcGroupChips','group','relic').classList.contains('on'), true);
eq('and the others are not',
   chip('arcGroupChips','group','die').classList.contains('on'), false);
click(chip('arcGroupChips','group','all'));
eq('back to everything', cards().length, 52);

console.log('\n6. the state filter, and its counts');
click(chip('arcStateChips','filter','owned'));
eq('a fresh save owns eight things', cards().length, 8);
eq('the chip said so before it was clicked',
   chip('arcStateChips','filter','owned').querySelector('b').textContent, '8');
click(chip('arcStateChips','filter','buy'));
eq('nothing is affordable at 0 marrow', cards().length, 0);
eq('and the rack says so plainly', !!$('arcRoster').querySelector('.arcEmpty'), true);
click(chip('arcStateChips','filter','locked'));
eq('forty-four are not yet had', cards().length, 44);
click(chip('arcStateChips','filter','all'));

console.log('\n7. the two filters compose');
click(chip('arcGroupChips','group','die'));
click(chip('arcStateChips','filter','owned'));
eq('owned dice only', ids(), ['bone']);
eq('state counts follow the group, not the whole roster',
   chip('arcStateChips','filter','owned').querySelector('b').textContent, '1');
click(chip('arcStateChips','filter','all'));
click(chip('arcGroupChips','group','all'));

console.log('\n8. search');
const search = q => { $('arcSearch').value = q;
  $('arcSearch').dispatchEvent(new window.Event('input', {bubbles:true})); };
search('mirror');
eq('finds by name', ids(), ['mirror']);
search('MIRROR');
eq('and does not care about case', ids(), ['mirror']);
search('chalk');
eq('finds by what a thing does, not only its name',
   cards().length > 1, true);
search('zzzz');
eq('an empty result says so', cards().length, 0);
eq('with a message about the search', /answers to that name/.test($('arcRoster').textContent), true);
eq('the clear button appears with a query', shown($('arcSearchClear')), true);
click($('arcSearchClear'));
eq('clearing restores the rack', cards().length, 52);
eq('and the field with it', $('arcSearch').value, '');
eq('the clear button goes away again', shown($('arcSearchClear')), false);

console.log('\n9. a filtered view survives what happens inside it');
{
  G.Meta.data.marrow = 999; G.renderArchive();
  click(chip('arcGroupChips','group','die'));
  click(chip('arcStateChips','filter','buy'));
  const before = cards().length;
  eq('a rack of affordable dice', before > 0, true);
  // setting one aside re-renders; the view must not reset to everything
  G.Meta.data.marrow = 999;
  G.toggleItem('die','bone');
  G.renderArchive({fresh:false});
  eq('still on the same filter', chip('arcGroupChips','group','die').classList.contains('on'), true);
  eq('still on the same state', chip('arcStateChips','filter','buy').classList.contains('on'), true);
  G.toggleItem('die','bone');
  click(chip('arcStateChips','filter','all'));
  click(chip('arcGroupChips','group','all'));
}

console.log('\n10. the entrance animation is for new racks only');
// replaying fifty-two entrances on every click is the blink the Ossuary's
// cards were fixed for, so a touched rack must not carry the class
G.renderArchive();
eq('a rebuilt rack is fresh', $('arcRoster').classList.contains('fresh'), true);
G.renderArchive({fresh:false});
eq('a touched rack is not', $('arcRoster').classList.contains('fresh'), false);
eq('but the tiles are all still there', cards().length, 52);

console.log('\n11. the Oaths sit in a row, not in four wide bars');
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

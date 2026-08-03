// THE SHELL — the furniture that is not any one screen: the close button, the
// title screen, and the panels that used to carry the ornamental frame.
//
// Loads the real stylesheet, because most of what is asserted here is about
// what a class DOES rather than whether it was applied.
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const B = p => path.join(__dirname, 'build', p);

const body = fs.readFileSync(B('body.html'), 'utf8');
const css  = fs.readFileSync(B('style.css'), 'utf8');

const vc = new VirtualConsole();
const { window } = new JSDOM(
  '<!doctype html><html><head><style>' + css + '</style></head>' + body + '</html>',
  { url:'https://local.test/', virtualConsole: vc });
const { document } = window;
const $ = id => document.getElementById(id);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n         got  ' + a + '\n         want ' + b); }
};
const rules = () => [...window.document.styleSheets[0].cssRules];

console.log('\n1. one close button for the whole game');
{
  const closers = ['btnLogClose','btnGrimClose','btnVeilX','btnArcX','btnRulesX'];
  eq('the changelog, the Grimoire and the Veil all have one',
     closers.every(id => !!$(id)), true);
  eq('and they all wear the same class',
     closers.every(id => $(id).classList.contains('xClose')), true);
  eq('the Veil has one at all now', !!$('btnVeilX'), true);
  eq('the old bespoke changelog X is gone',
     document.querySelectorAll('.logX').length, 0);
  // it must not move: it is pinned in a corner, and a control that shifts
  // under the pointer on hover is a control you miss
  const moves = rules().filter(r => r.selectorText &&
    /\.xClose/.test(r.selectorText) && /:hover|:active/.test(r.selectorText) &&
    /translate/.test(r.style.transform || ''));
  eq('nothing about it translates on hover or press', moves.map(r => r.selectorText), []);
  const hasNone = rules().filter(r => r.selectorText === '.xClose:hover:not(:disabled)');
  eq('and it explicitly cancels the base button lift',
     hasNone.length === 1 && hasNone[0].style.transform === 'none', true);
  // the full-panel screens have one too now
  eq('the Archive has one', !!$('btnArcX'), true);
  eq('and How To Play', !!$('btnRulesX'), true);
  // drawn in the game's own hand, not the icon set: the Phosphor glyph sat
  // visibly high and left inside the button whatever the button did
  eq('all five use the Hellbone glyph, not the icon',
     closers.every(id => !!$(id).querySelector('.xG') && !$(id).querySelector('.ic')), true);
  eq('and it is a capital X',
     [...new Set(closers.map(id => $(id).querySelector('.xG').textContent))], ['X']);
  // A display face puts its ink where it likes inside the line box, so the
  // glyph needs a measured nudge. It has to be a TRANSFORM: a margin on a
  // centred flex item only moves the box by half of what it asks for.
  const nudge = rules().filter(r => r.selectorText === '.xClose .xG');
  eq('the optical nudge is a transform, not a margin',
     nudge.length === 1 && /translateY/.test(nudge[0].style.transform || '') &&
     !nudge[0].style.marginTop, true);
}

console.log('\n1b. nothing small enough to miss moves under the pointer');
// the switch is a <button>, so it inherited the base lift on hover AND the 3px
// drop on :active — which is why a click on it sometimes produced no event at
// all: the control moved out from under the press before the mouseup
{
  const wanted = ['.aSwitch','.arcTab','#arcSearchClear','#btnArcClearFilters','.menuItem'];
  for(const sel of wanted){
    const cancels = rules().filter(r => r.selectorText &&
      r.selectorText.includes(sel) && /:active/.test(r.selectorText) &&
      r.style.transform === 'none');
    eq(sel + ' cancels the press-drop', cancels.length > 0, true);
  }
  // The knob is exempt and must stay exempt: sliding across its track is the
  // switch's whole job, and it is inside the control rather than the control.
  const lifts = rules().filter(r => r.selectorText &&
    /\.aSwitch|\.arcTab|#arcSearchClear|#btnArcClearFilters/.test(r.selectorText) &&
    !/\.sKnob/.test(r.selectorText) &&
    /translate/.test(r.style.transform || ''));
  eq('and none of the controls themselves translates', lifts.map(r => r.selectorText), []);
  eq('the knob still slides, though',
     rules().some(r => r.selectorText === '.aSwitch.on .sKnob' &&
       /translateX/.test(r.style.transform || '')), true);
}

console.log('\n1c. no visible scrollbars, anywhere');
{
  const bars = rules().filter(r => r.selectorText && /::-webkit-scrollbar/.test(r.selectorText));
  eq('the scrollbar is drawn at zero width',
     bars.some(r => r.style.width === '0px' || r.style.display === 'none'), true);
  eq('no themed track or thumb survives',
     bars.filter(r => /track|thumb/.test(r.selectorText)).map(r => r.selectorText), []);
  eq('and Firefox is told the same thing',
     rules().some(r => r.selectorText === '*' && r.style.getPropertyValue('scrollbar-width') === 'none'), true);
  // scrolling itself must be untouched
  eq('the Archive body still scrolls',
     window.getComputedStyle($('arcBody')).overflowY, 'auto');
  eq('so does the Veil', window.getComputedStyle($('veilBody')).overflowY, 'auto');
}

console.log('\n2. the ornamental frame is off the workbenches');
eq('the Veil has no bone frame',
   $('settingsOverlay').querySelectorAll('.boneFrame').length, 0);
eq('nor does the Archive',
   $('menuArchive').querySelectorAll('.boneFrame').length, 0);
eq('nor does How To Play',
   $('menuRules').querySelectorAll('.boneFrame').length, 0);
// it is still on the screens it was made for — this is a removal, not a purge
eq('but the reveals still have it',
   document.querySelectorAll('.boneFrame').length > 0, true);

console.log('\n3. the title screen');
eq('no Grimoire on the menu', $('miGrim'), null);
eq('the four items that are left',
   [...document.querySelectorAll('#menuHome .menuItem')].map(b => b.id),
   ['miStart','miArchive','miRules','miLog']);
eq('the rules item says what it is',
   $('miRules').querySelector('span').textContent, 'HOW TO PLAY');
eq('the nav buttons are real buttons, not floating text',
   [...document.querySelectorAll('#menuHome .menuItem')].every(b => b.tagName === 'BUTTON'), true);
// the label is the only thing in the slab, so "centred" means centred — an
// icon pinned to one edge with nothing answering it is what read as lopsided
eq('nothing but the inscription is on them',
   [...document.querySelectorAll('#menuHome .menuItem .ic')].length, 0);
eq('and they are cut stone, not a rounded rectangle',
   rules().some(r => r.selectorText === '.menuItem' && /polygon/.test(r.style.clipPath || '')), true);
// The rim is the element and the stone is an inset layer on top of it, so the
// 1px edge turns the chamfered corners. An inset box-shadow ring is a
// rectangle and gets sliced off by the very clip that made the corners.
eq('the stone rides on an inset layer that shares the bevel',
   rules().some(r => r.selectorText === '.menuItem::before' &&
     /polygon/.test(r.style.clipPath || '')), true);
eq('so the slab carries no rectangular inset ring',
   rules().some(r => r.selectorText === '.menuItem' &&
     /inset 0 0 0 1px/.test(r.style.boxShadow || '')), false);
// they used to clear the carved-stone material with !important
{
  const stripped = rules().filter(r => r.selectorText === '.menuItem' &&
    /none/.test(r.style.background || '') && r.style.getPropertyPriority('background') === 'important');
  eq('and none of them refuses the stone material', stripped.length, 0);
}
eq('settings is a corner control', !!$('menuVeilBtn'), true);
eq('it names itself rather than being a bare gear',
   /SETTINGS/.test($('menuVeilBtn').textContent), true);
eq('and advertises its key', /ESC/.test($('menuVeilBtn').textContent), true);
eq('the dead-saint tagline is gone', document.querySelectorAll('.menuFoot').length, 0);
eq('the real one is a banner', !!document.querySelector('.menuBanner'), true);
eq('and it still says what the game is',
   document.querySelector('.menuBanner .mbText').textContent, 'AN OCCULT WAGER');

console.log('\n4. version and studio sit in opposite corners');
{
  const ver = window.getComputedStyle($('menuVer'));
  const std = window.getComputedStyle(document.querySelector('.menuStudio'));
  eq('the version is bottom left', [ver.position, ver.left, ver.bottom],
     ['absolute', '24px', '20px']);
  eq('the studio mark is bottom right', [std.position, std.right, std.bottom],
     ['absolute', '24px', '20px']);
  eq('neither is stretched across the foot any more', std.left, 'auto');
}

console.log('\n5. the menu arrives quickly enough to be used');
// it used to finish at 1.2s, which is a wall every time the player comes back
// to a screen whose buttons they already know the position of
{
  const delays = rules()
    .filter(r => r.selectorText && /#menuHome .menuItem:nth-child/.test(r.selectorText))
    .map(r => parseFloat(r.style.animationDelay));
  eq('every nav item is staged', delays.length, 4);
  eq('and the last one lands inside half a second', Math.max(...delays) <= 0.5, true);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL PASS — ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);

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
  const closers = ['btnLogClose','btnGrimClose','btnVeilX'];
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

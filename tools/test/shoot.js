// Screenshots the real game in the real Chrome already installed on this
// machine, so a layout change can be LOOKED AT rather than inferred from
// class names.
//
// The suites in this directory drive the real code and the real markup, but
// jsdom has no layout engine: it will happily report that a panel is 88px tall
// when nothing on screen is. Everything about size, overflow, wrapping and
// paint has to come from here.
//
// puppeteer-core, not puppeteer: it drives a browser that is already on the
// machine and downloads nothing. If Chrome is somewhere else, set CHROME.
//
//   node shoot.js                      the Archive, at 1920x1080
//   node shoot.js --width 1366 --height 768
//   node shoot.js --out ../../docs/screenshots
const fs = require('fs'), path = require('path'), os = require('os');
const puppeteer = require('puppeteer-core');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const WIDTH  = Number(arg('width', 1920));
const HEIGHT = Number(arg('height', 1080));
const OUT    = path.resolve(__dirname, arg('out', 'shots'));
const GAME   = 'file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/');

const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => p && fs.existsSync(p));

if(!CHROME){ console.error('No Chrome found. Set CHROME=/path/to/chrome.'); process.exit(1); }

// A career worth looking at: enough Marrow to make things affordable, a deep
// enough run to open the tier-3 gates, a few unlocks and one Oath sworn. A
// screenshot of a fresh save shows almost nothing but locked plaques.
const SEEDED = {
  version: 2, marrow: 640,
  unlockedDice: ['bone','runt','rotting','twin','ivory'],
  unlockedChalks: ['chalk_row'],
  unlockedRelics: ['dust','candle','hook','nail','obol','censer','ember','eye','ash','key'],
  disabledDice: ['twin'], disabledChalks: [], disabledRelics: ['hook'],
  rites: { extraDie:1, extraReroll:2, cheapReroll:0, extraShards:3, extraAltar:false },
  lifetime: { runs: 23, deepestLevel: 18, bestOffering: 26480, trialsCleared: 9 },
  storyBeatsFired: [], storyComplete: false, tutorial: { seen:true, skipped:false },
};

(async ()=>{
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--allow-file-access-from-files','--hide-scrollbars','--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  page.on('pageerror', e => console.log('  PAGE ERROR:', e.message));

  // Seed the ledger before the game reads it.
  await page.evaluateOnNewDocument(seed => {
    localStorage.setItem('boneSieveMeta', JSON.stringify(seed));
    localStorage.setItem('boneSieveSeenVersion', 'x');   // no changelog popup
  }, SEEDED);

  await page.goto(GAME, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1200));           // fonts, canvas, intro

  // The release notes open once per version and sit over everything. Shot on
  // the way past, because for a release build this IS the thing to check.
  const shotEarly = async (name)=>{
    const f = path.join(OUT, name + '.png');
    await page.screenshot({ path: f });
    console.log('  ' + name.padEnd(22) + WIDTH + 'x' + HEIGHT + '  -> ' + path.relative(process.cwd(), f));
  };
  if(await page.$('#logOverlay:not(.hidden)')) await shotEarly('changelog');
  await page.evaluate(()=>{ const b = document.getElementById('btnLogOk'); if(b) b.click(); });
  await new Promise(r => setTimeout(r, 400));

  const shot = async (name)=>{
    const f = path.join(OUT, name + '.png');
    await page.screenshot({ path: f });
    console.log('  ' + name.padEnd(22) + WIDTH + 'x' + HEIGHT + '  -> ' + path.relative(process.cwd(), f));
  };

  await shot('menu-home');
  await page.click('#menuVeilBtn');
  await new Promise(r => setTimeout(r, 500));
  await shot('menu-veil');
  await page.evaluate(()=>{ document.getElementById('btnVeilX').click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.click('#miRules');
  await new Promise(r => setTimeout(r, 500));
  await shot('menu-howtoplay');
  await page.click('#miRulesBack');
  await new Promise(r => setTimeout(r, 400));

  await page.click('#miArchive');
  await new Promise(r => setTimeout(r, 700));
  await shot('archive-roster');

  // does the panel actually fit, or is it running off the screen?
  const fit = await page.evaluate(()=>{
    const p = document.querySelector('.arcPanel'), b = document.getElementById('arcBody');
    const r = p.getBoundingClientRect();
    return {
      panelTop: Math.round(r.top), panelBottom: Math.round(r.bottom),
      panelH: Math.round(r.height), viewportH: window.innerHeight,
      fitsVertically: r.top >= 0 && r.bottom <= window.innerHeight + 1,
      bodyScrolls: b.scrollHeight > b.clientHeight + 1,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      cardsPerRow: (()=>{
        const c = [...document.querySelectorAll('.arcCard')].slice(0, 20);
        if(!c.length) return 0;
        const top = c[0].getBoundingClientRect().top;
        return c.filter(x => Math.abs(x.getBoundingClientRect().top - top) < 2).length;
      })(),
      // every tile the same size is the whole point of the rebuild
      uniformTiles: (()=>{
        const c = [...document.querySelectorAll('.arcCard')];
        const h = new Set(c.map(x => Math.round(x.getBoundingClientRect().height)));
        const w = new Set(c.map(x => Math.round(x.getBoundingClientRect().width)));
        return { heights:[...h], widths:[...w] };
      })(),
    };
  });
  console.log('  layout:', JSON.stringify(fit, null, 2).replace(/\n/g, '\n  '));

  await page.click('#arcTabOaths');
  await new Promise(r => setTimeout(r, 600));
  await shot('archive-oaths');

  await page.click('#arcTabRoster');
  await page.evaluate(()=>{
    document.getElementById('arcGroupBtn').click();
    document.querySelector('#arcGroupList .dropOpt[data-v="relic"]').click();
  });
  await new Promise(r => setTimeout(r, 500));
  await shot('archive-filtered-relics');

  // the filter menu open, so the control itself can be looked at
  await page.evaluate(()=>{ document.getElementById('arcStateBtn').click(); });
  await new Promise(r => setTimeout(r, 300));
  await shot('archive-filter-open');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

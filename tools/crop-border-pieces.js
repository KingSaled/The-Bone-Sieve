// Re-cuts assets/img/ornate_corner.png and ornate_edge*.png out of the master
// ornate_border.png. The cut pieces are committed, so this only needs running
// if the master art changes.
//
//   npm i puppeteer && node tools/crop-border-pieces.js
//
// It uses a headless canvas purely to decode and re-encode PNG, so the game
// itself keeps its zero-dependency, single-file shape.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const PROJ = path.join(__dirname, '..', 'assets', 'img') + path.sep;
const IMG = 'data:image/png;base64,' + fs.readFileSync(PROJ + 'ornate_border.png').toString('base64');

const CORNER = 152;      // square cut from (0,0)
const BAND   = 104;      // rows of the painted band to keep on an edge piece

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  await p.goto('about:blank');

  const out = await p.evaluate(async (src, CORNER, BAND) => {
    const img = new Image(); img.src = src; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, W, H).data;
    const A = (x, y) => d[(y * W + x) * 4 + 3];

    // ink depth per column across the top band, 1px resolution
    const depth = [];
    for (let x = 0; x < W; x++) {
      let deep = 0;
      for (let y = 0; y < 200; y++) if (A(x, y) > 24) deep = y + 1;
      depth.push(deep);
    }
    // symmetry check about the mid-line
    let asym = 0;
    for (let x = 160; x < 360; x++) asym += Math.abs(depth[x] - depth[W - 1 - x]);
    // skull centres: the two deepest points either side of the pentagram,
    // searched away from both the corners and the middle medallion
    const peak = (a, b2) => { let best = a, bv = -1;
      for (let x = a; x <= b2; x++) if (depth[x] > bv) { bv = depth[x]; best = x; }
      return { at: best, v: bv }; };
    const L = peak(200, 300), R = peak(420, 520), M = peak(330, 390);

    const cut = (sx, sy, sw, sh, rot) => {
      const c = document.createElement('canvas');
      c.width = rot ? sh : sw; c.height = rot ? sw : sh;
      const g = c.getContext('2d');
      if (rot) { g.translate(sh, 0); g.rotate(Math.PI / 2); }
      g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      return c.toDataURL('image/png');
    };
    return { W, H, depth, asym, L, R, M,
             corner: cut(0, 0, CORNER, CORNER, false) };
  }, IMG, CORNER, BAND);

  const { W, asym, L, R, M } = out;
  console.log(`symmetry error across the top band: ${asym} (0 = perfectly mirrored)`);
  console.log(`left skull peak  x=${L.at} depth=${L.v}`);
  console.log(`right skull peak x=${R.at} depth=${R.v}   (mirror of left = ${W - 1 - L.at})`);
  console.log(`pentagram peak   x=${M.at} depth=${M.v}`);

  // Anchor the tile on the image mid-line, which the symmetry check above
  // confirms is the true axis — the skull peaks sit on a flat plateau of equal
  // depth, so picking their argmax lands a few px off and would break the
  // mirror the seam relies on.
  const axis = W / 2;
  const half = Math.round(axis - L.at);
  const x0 = axis - half, TW = half * 2;
  console.log(`\nedge tile: x ${x0}..${x0 + TW}  (width ${TW}), centred on the ${axis} axis`);
  console.log(`seams land on the skull centres at ${x0} and ${x0 + TW} (mirror pair)`);

  const pieces = await p.evaluate(async (src, x0, TW, BAND) => {
    const img = new Image(); img.src = src; await img.decode();
    const cut = (sx, sy, sw, sh, rot) => {
      const c = document.createElement('canvas');
      c.width = rot ? sh : sw; c.height = rot ? sw : sh;
      const g = c.getContext('2d');
      if (rot) { g.translate(sh, 0); g.rotate(Math.PI / 2); }   // 90deg CW
      g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      return c.toDataURL('image/png');
    };
    return {
      edgeH: cut(x0, 0, TW, BAND, false),
      edgeV: cut(x0, 0, TW, BAND, true),     // same run, stood on end
    };
  }, IMG, x0, TW, BAND);

  const write = (name, uri) => {
    fs.writeFileSync(PROJ + name, Buffer.from(uri.split(',')[1], 'base64'));
    console.log('wrote', name, fs.statSync(PROJ + name).size, 'bytes');
  };
  write('ornate_corner.png', out.corner);
  write('ornate_edge.png', pieces.edgeH);
  write('ornate_edge_v.png', pieces.edgeV);
    await b.close();
})();

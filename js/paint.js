/* Paint: a faithful Win95 MS Paint. Pixel-exact tools (no antialiasing) drawn with fillRect spans, scanline flood fill,
   floating selections with marching ants, 2-click bezier curves, polygons, text, undo/redo, Edit Colors, wallpaper. */
(() => {
  const S = { get: (k, d) => Arcade.store.get('paint.' + k, d), set: (k, v) => Arcade.store.set('paint.' + k, v) };

  /* ---------- wallpaper: re-applied at load (after system.js applies its theme, which knows nothing of '(Paint)') ---------- */
  function applyWallpaper(wp) {
    const r = document.documentElement.style;
    const centered = wp.mode !== 'tiled'; // same rule as system.js: anything but 'tiled' is centered
    r.setProperty('--wallpaper', `url("${wp.url}")`);
    r.setProperty('--wallpaper-size', 'auto');
    r.setProperty('--wallpaper-repeat', centered ? 'no-repeat' : 'repeat');
  }
  function restoreWallpaper() {
    const th = Arcade.store.get('theme', {}), wp = S.get('wallpaper', null);
    if (th && th.wallpaper === '(Paint)' && wp && wp.url) applyWallpaper(wp);
  }
  restoreWallpaper();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreWallpaper);

  /* ---------- pixel icons ---------- */
  const PC = { k: '#000', g: '#808080', w: '#fff', y: '#ffff00', o: '#b07030', b: '#0000ff', r: '#ff0000', s: '#c0c0c0', n: '#008000', p: '#ff00ff' };
  function gridSvg(rows, size = 16) {
    let s = '';
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x]; if (c === '.' || c === ' ') { x++; continue; }
        let e = x; while (e < row.length && row[e] === c) e++;
        s += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${PC[c]}"/>`; x = e;
      }
    });
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">${s}</svg>`;
  }
  const ICON = gridSvg([
    '................', '....kkkkkk......', '..kkwwwwwwkk....', '.kwwrrwwyywwk...', 'kwwwrrwwyywwk...', 'kwbbwwwwwwwk....',
    'kwbbwwwkkkk.....', 'kwwwwwk.........', 'kwnnwwk.....kk..', '.knnwwwk...kook.', '..kwwwwwk.kook..', '...kkkkkkkook...',
    '.........kook...', '........kkk.....', '.......kkk......', '................']);

  const TOOLS = [
    { id: 'free', name: 'Free-Form Select', help: 'Selects a free-form part of the picture to move, copy, or edit.', opt: 'opaque',
      g: ['', '.....k.k.k......', '....k.....k.....', '...k.......k.k..', '..k...........k.', '...k.........k..', '....k.......k...', '...k.........k..', '..k...........k.', '...k.k.......k..', '.......k...k....', '........k.k.....'] },
    { id: 'select', name: 'Select', help: 'Selects a rectangular part of the picture to move, copy, or edit.', opt: 'opaque',
      g: ['', '', '..k.k.k.k.k.k...', '', '..k.........k...', '', '..k.........k...', '', '..k.........k...', '', '..k.........k...', '', '..k.k.k.k.k.k...'] },
    { id: 'eraser', name: 'Eraser/Color Eraser', help: 'Erases a portion of the picture, using the selected eraser shape.', opt: 'eraser',
      g: ['', '', '', '.......kkkkkkk..', '......kyyyyyykk.', '.....kyyyyyykwk.', '....kyyyyyykwwk.', '...kkkkkkkkwwk..', '...kwwwwwwkwk...', '...kwwwwwwkk....', '...kkkkkkkk.....'] },
    { id: 'fill', name: 'Fill With Color', help: 'Fills an area with the current drawing color.', opt: null,
      g: ['', '.....kk.........', '....k..k........', '....k.kkk.......', '....kkwwkk......', '...kkwwwwkk.....', '..kkwwwwwwkk....', '.k.kwwwwwwwkk...', '.k..kwwwwwkkb...', '.k...kwwwkkbb...', '.k....kwkk.bb...', '.......kk..bb...', '...........b....'] },
    { id: 'pick', name: 'Pick Color', help: 'Picks up a color from the picture for drawing.', opt: null,
      g: ['', '............kk..', '...........kkkk.', '..........kkkkk.', '.........kkkkk..', '........kwkkk...', '.......kwwkk....', '......kwwwk.....', '.....kwwwk......', '....kwwwk.......', '...kwwwk........', '..kwwwk.........', '..kwwk..........', '.kkk............'] },
    { id: 'mag', name: 'Magnifier', help: 'Changes the magnification.', opt: 'mag',
      g: ['', '.....kkkk.......', '....kwwwwk......', '...kwkkwwwk.....', '...kwkwwwwk.....', '...kwwwwwwk.....', '...kwwwwwwk.....', '....kwwwwk......', '.....kkkkkk.....', '..........kk....', '...........kk...', '............kk..', '.............k..'] },
    { id: 'pencil', name: 'Pencil', help: 'Draws a free-form line one pixel wide.', opt: null,
      g: ['', '.............k..', '............kyk.', '...........kyyk.', '..........kyykk.', '.........kyyk...', '........kyyk....', '.......kyyk.....', '......kyyk......', '.....kyyk.......', '....kwwk........', '....kkk.........', '....kk..........'] },
    { id: 'brush', name: 'Brush', help: 'Draws using a brush with the selected shape and size.', opt: 'brush',
      g: ['', '.............kk.', '............kook', '...........kook.', '..........kook..', '.........kook...', '........kook....', '.......kkok.....', '......kkkk......', '.....bbkk.......', '....bbbb........', '...bbbb.........', '..bbb...........', '..b.............'] },
    { id: 'air', name: 'Airbrush', help: 'Draws using an airbrush of the selected size.', opt: 'air',
      g: ['', '.b.b............', 'b.b..kkk........', '.b.b.kgk........', 'b.b.kkkkk.......', '.b..kssssk......', '....kssssk......', '....ksbbsk......', '....ksbbsk......', '....kssssk......', '....kssssk......', '....kkkkkk......'] },
    { id: 'text', name: 'Text', help: 'Inserts text into the picture.', opt: 'opaque',
      g: ['', '', '.......kk.......', '......kkkk......', '......k..k......', '.....kk..kk.....', '.....k....k.....', '....kkkkkkkk....', '....k......k....', '...kk......kk...', '..kkkk....kkkk..'] },
    { id: 'line', name: 'Line', help: 'Draws a straight line with the selected line width.', opt: 'width',
      g: ['', '.............k..', '............k...', '...........k....', '..........k.....', '.........k......', '........k.......', '.......k........', '......k.........', '.....k..........', '....k...........', '...k............', '..k.............'] },
    { id: 'curve', name: 'Curve', help: 'Draws a curved line with the selected line width.', opt: 'width',
      g: ['', '', '...........kk...', '..........k.....', '..........k.....', '...........k....', '...........k....', '..........k.....', '.......kkk......', '.....kk.........', '....k...........', '....k...........', '.....k..........', '.....k..........', '...kk...........'] },
    { id: 'rect', name: 'Rectangle', help: 'Draws a rectangle with the selected fill style.', opt: 'fill',
      g: ['', '', '', '..kkkkkkkkkkkk..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..kkkkkkkkkkkk..'] },
    { id: 'poly', name: 'Polygon', help: 'Draws a polygon with the selected fill style.', opt: 'fill',
      g: ['', '', '...kkkkk........', '...k....k.......', '...k.....k......', '...k......kkkkk.', '...k..........k.', '...k..........k.', '...k.........k..', '...k........k...', '...k.......k....', '...kkkkkkkk.....'] },
    { id: 'ellipse', name: 'Ellipse', help: 'Draws an ellipse with the selected fill style.', opt: 'fill',
      g: ['', '', '', '.....kkkkkk.....', '...kk......kk...', '..k..........k..', '.k............k.', '.k............k.', '.k............k.', '..k..........k..', '...kk......kk...', '.....kkkkkk.....'] },
    { id: 'rrect', name: 'Rounded Rectangle', help: 'Draws a rounded rectangle with the selected fill style.', opt: 'fill',
      g: ['', '', '', '...kkkkkkkkkk...', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '...kkkkkkkkkk...'] }
  ];
  const TOOL = Object.fromEntries(TOOLS.map(t => [t.id, t]));
  const DEFAULT_HELP = 'For Help, click Help Topics on the Help Menu.';
  const PALETTE = ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#4000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'];
  const BASIC = ['#ff8080', '#ffff80', '#80ff80', '#00ff80', '#80ffff', '#0080ff', '#ff80c0', '#ff80ff', '#ff0000', '#ffff00', '#80ff00', '#00ff40', '#00ffff', '#0080c0', '#8080c0', '#ff00ff',
    '#804040', '#ff8040', '#00ff00', '#008080', '#004080', '#8080ff', '#800040', '#ff0080', '#800000', '#ff8000', '#008000', '#008040', '#0000ff', '#0000a0', '#800080', '#8000ff',
    '#400000', '#804000', '#004000', '#004040', '#000080', '#000040', '#400040', '#400080', '#000000', '#808000', '#808040', '#808080', '#408080', '#c0c0c0', '#400040', '#ffffff'];
  const FONTS = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Tahoma', 'Comic Sans MS', 'Impact', 'Trebuchet MS'];
  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];
  const ERASER = [4, 6, 8, 10], AIR = [4, 8, 12], MAGS = [1, 2, 6, 8];

  /* ---------- color helpers ---------- */
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const pack = h => { const [r, g, b] = hex2rgb(h); return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; };
  function rgb2hsl(r, g, b) { // Windows 0..240 scale
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
    }
    return [Math.round(h * 240) % 240, Math.round(s * 240), Math.round(l * 240)];
  }
  function hsl2rgb(h, s, l) {
    h /= 240; s /= 240; l /= 240;
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const c2d = c => { const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; return x; };

  /* ---------- raster primitives (all integer fillRect, no antialiasing) ---------- */
  function bres(x0, y0, x1, y1, f) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    for (;;) { f(x0, y0); if ((x0 === x1 && y0 === y1) || ++n > 100000) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  const sq = (c, x, y, w) => c.fillRect(x - (w >> 1), y - (w >> 1), w, w);
  function thickLine(c, x0, y0, x1, y1, w) { bres(x0, y0, x1, y1, (x, y) => sq(c, x, y, w)); }
  function brushPixels(i) {
    const k = Math.floor(i / 3), s = (k === 0 ? [7, 4, 1] : [8, 5, 2])[i % 3], o = s >> 1, px = [];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (k === 0) { const dx = x + .5 - s / 2, dy = y + .5 - s / 2; if (dx * dx + dy * dy <= s * s / 4 + .5) px.push([x - o, y - o]); }
      else if (k === 1) px.push([x - o, y - o]);
      else if (k === 2 && x === s - 1 - y) px.push([x - o, y - o]);
      else if (k === 3 && x === y) px.push([x - o, y - o]);
    }
    return px;
  }
  const BRUSHES = Array.from({ length: 12 }, (_, i) => brushPixels(i));
  const spanRectF = (x0, y0, x1, y1) => y => (y < y0 || y > y1) ? null : [x0, x1];
  function spanEllipseF(x0, y0, x1, y1) {
    const rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2, cx = x0 + rx, cy = y0 + ry;
    return y => { const dy = (y + .5 - cy) / ry; if (Math.abs(dy) > 1) return null; const dx = rx * Math.sqrt(1 - dy * dy), a = Math.round(cx - dx), b = Math.round(cx + dx) - 1; return b < a ? null : [a, b]; };
  }
  function spanRoundF(x0, y0, x1, y1, r) {
    r = Math.max(0, Math.min(r, (x1 - x0 + 1) / 2, (y1 - y0 + 1) / 2));
    return y => {
      if (y < y0 || y > y1) return null;
      const yc = y + .5; let dy = 0;
      if (yc < y0 + r) dy = y0 + r - yc; else if (yc > y1 + 1 - r) dy = yc - (y1 + 1 - r);
      const ins = dy > 0 ? r - Math.sqrt(Math.max(0, r * r - dy * dy)) : 0, a = Math.round(x0 + ins), b = Math.round(x1 + 1 - ins) - 1;
      return b < a ? null : [a, b];
    };
  }
  // mode 0 outline, 1 outline + fill, 2 fill only
  function drawShape(c, kind, x0, y0, x1, y1, lw, mode, stroke, fill) {
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    const R = 8, mk = (a, b, cc, d, r) => kind === 'rect' ? spanRectF(a, b, cc, d) : kind === 'ellipse' ? spanEllipseF(a, b, cc, d) : spanRoundF(a, b, cc, d, r);
    const outer = mk(x0, y0, x1, y1, R);
    const inner = (x1 - lw >= x0 + lw && y1 - lw >= y0 + lw) ? mk(x0 + lw, y0 + lw, x1 - lw, y1 - lw, R - lw) : null;
    const row = (a, b, y, col) => { if (b >= a) { c.fillStyle = col; c.fillRect(a, y, b - a + 1, 1); } };
    for (let y = y0; y <= y1; y++) {
      const o = outer(y); if (!o) continue; const i = inner && inner(y);
      if (mode === 2) { row(o[0], o[1], y, stroke); continue; }
      if (!i) row(o[0], o[1], y, stroke); else { row(o[0], i[0] - 1, y, stroke); row(i[1] + 1, o[1], y, stroke); if (mode === 1) row(i[0], i[1], y, fill); }
    }
  }
  function fillPolygon(c, pts, col) {
    if (pts.length < 3) return;
    let y0 = Infinity, y1 = -Infinity; pts.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    c.fillStyle = col;
    for (let y = y0; y <= y1; y++) {
      const yc = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay + .5 <= yc && by + .5 > yc) || (by + .5 <= yc && ay + .5 > yc)) xs.push(ax + (yc - ay - .5) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) { const a = Math.round(xs[i]), b = Math.round(xs[i + 1]); if (b >= a) c.fillRect(a, y, b - a + 1, 1); }
    }
  }
  function bezier(p0, c1, c2, p3) {
    const len = Math.hypot(c1[0] - p0[0], c1[1] - p0[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p3[0] - c2[0], p3[1] - c2[1]);
    const n = Math.max(2, Math.ceil(len / 3)), out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([Math.round(u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0]),
        Math.round(u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1])]);
    }
    return out;
  }

  /* ---------- styles ---------- */
  Arcade.css(`
    .pt-root { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 2px; }
    .pt-main { display: flex; flex: 1; min-height: 0; gap: 2px; position: relative; }
    .pt-tools { flex: none; width: 54px; display: flex; flex-direction: column; align-items: center; padding: 2px 0; }
    .pt-grid { display: grid; grid-template-columns: 25px 25px; }
    .pt-tool { width: 25px; height: 25px; border: 0; padding: 0; background: var(--face); display: grid; place-items: center; }
    .pt-tool svg { pointer-events: none; }
    .pt-tool.on { background: repeating-conic-gradient(var(--face) 0 25%, var(--hi) 0 50%) 0 0 / 2px 2px;
      box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); }
    .pt-opts { margin-top: 5px; width: 44px; min-height: 66px; padding: 3px 2px; display: flex; flex-direction: column; align-items: stretch; justify-content: space-evenly; gap: 1px; }
    .pt-opts.cols { display: grid; grid-template-columns: repeat(3, 1fr); align-content: space-evenly; }
    .pt-opt { border: 0; padding: 0; background: none; display: grid; place-items: center; min-height: 10px; }
    .pt-opt canvas { image-rendering: pixelated; pointer-events: none; }
    .pt-opt.on { background: var(--sel); }
    .pt-opt.on canvas { filter: invert(1); }
    .pt-opt.on.keep canvas { filter: none; }
    .pt-opt.on.keep { background: none; box-shadow: inset 0 0 0 1px var(--sel); }
    .pt-opt.txt { font: 10px var(--ui); color: var(--ink); }
    .pt-opt.txt.on { color: var(--sel-ink); }
    .pt-ws { flex: 1; min-width: 0; overflow: auto; background: #808080; position: relative; }
    .pt-wrap { position: relative; margin: 3px 10px 10px 3px; touch-action: none; }
    .pt-wrap canvas { display: block; image-rendering: pixelated; position: absolute; left: 0; top: 0; }
    .pt-wrap .pt-ov { pointer-events: none; }
    .pt-grid-ov { position: absolute; left: 0; top: 0; pointer-events: none; }
    .pt-h { position: absolute; width: 5px; height: 5px; background: var(--sel); touch-action: none; }
    .pt-h.coarse { width: 12px; height: 12px; }
    .pt-h[data-h="r"] { cursor: ew-resize; } .pt-h[data-h="b"] { cursor: ns-resize; } .pt-h[data-h="rb"] { cursor: nwse-resize; }
    .pt-rsz { position: absolute; left: 0; top: 0; outline: 1px dotted #000; pointer-events: none; }
    .pt-sel { position: absolute; cursor: move; touch-action: none;
      background-image: linear-gradient(90deg, #000 50%, #fff 50%), linear-gradient(90deg, #000 50%, #fff 50%), linear-gradient(0deg, #000 50%, #fff 50%), linear-gradient(0deg, #000 50%, #fff 50%);
      background-repeat: repeat-x, repeat-x, repeat-y, repeat-y; background-size: 8px 1px, 8px 1px, 1px 8px, 1px 8px;
      background-position: 0 0, 0 100%, 0 0, 100% 0; animation: pt-ants .6s linear infinite; }
    .pt-sel canvas { position: absolute; left: 1px; top: 1px; image-rendering: pixelated; pointer-events: none; }
    @keyframes pt-ants { to { background-position: 8px 0, -8px 100%, 0 -8px, 100% 8px; } }
    @media (prefers-reduced-motion: reduce) { .pt-sel { animation: none; } }
    .pt-text { position: absolute; border: 0; outline: 1px dashed #000; padding: 2px; margin: 0; resize: none; overflow: hidden; background: transparent;
      user-select: text; -webkit-user-select: text; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.2; }
    .pt-font { position: absolute; right: 4px; top: 4px; z-index: 5; background: var(--face); padding: 3px 4px 4px; display: flex; flex-wrap: wrap; gap: 3px; align-items: center; max-width: calc(100% - 8px); }
    .pt-font .pt-ft { width: 100%; font-weight: bold; font-size: 11px; color: var(--ink); }
    .pt-font select { height: 21px; padding: 1px 2px; }
    .pt-font button { width: 22px; height: 21px; min-width: 0; padding: 0; }
    .pt-colors { display: flex; gap: 4px; align-items: center; flex: none; padding: 2px; overflow: hidden; }
    .pt-cur { width: 32px; height: 32px; position: relative; flex: none; background: repeating-conic-gradient(#fff 0 25%, #c0c0c0 0 50%) 0 0 / 2px 2px; }
    .pt-cur span { position: absolute; width: 14px; height: 14px; box-shadow: inset 0 0 0 1px var(--hi), 0 0 0 1px var(--lo); }
    .pt-cur .pt-bgc { right: 5px; bottom: 5px; } .pt-cur .pt-fgc { left: 5px; top: 5px; }
    .pt-pal { display: grid; grid-template-columns: repeat(14, 16px); grid-auto-rows: 16px; }
    .pt-pal button { width: 16px; height: 16px; border: 0; padding: 0; box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk); }
    .pt-dlg .content { display: block; padding: 10px 12px 6px; }
    .pt-dlg label { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
    .pt-dlg .field { width: 64px; }
    .pt-dlg .pt-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start; }
    .pt-files { background: var(--window); color: var(--window-ink); height: 150px; overflow: auto; width: min(300px, 70vw); padding: 2px; }
    .pt-files button { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: none; color: inherit; padding: 2px 4px; text-align: left; }
    .pt-files button.on { background: var(--sel); color: var(--sel-ink); }
    .pt-files img { width: 32px; height: 24px; object-fit: contain; background: #fff; outline: 1px solid var(--lo); image-rendering: pixelated; }
    .pt-ec { display: flex; gap: 12px; flex-wrap: wrap; }
    .pt-ec .sw { display: grid; grid-template-columns: repeat(8, 18px); gap: 4px; margin: 2px 0 8px; }
    .pt-ec .sw button { width: 18px; height: 14px; border: 0; padding: 0; box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk); }
    .pt-ec .sw button.on { outline: 1px dotted var(--ink); outline-offset: 1px; }
    .pt-ec canvas { display: block; touch-action: none; cursor: crosshair; }
    .pt-ec .spec { display: flex; gap: 6px; }
    .pt-ec .prev { width: 60px; height: 34px; }
    .pt-ec .nums { display: grid; grid-template-columns: auto 44px auto 44px; gap: 3px 4px; align-items: center; font-size: 11px; }
    .pt-ec .nums .field { width: 44px; padding: 1px 3px; }
    .pt-view { position: fixed; inset: 0; z-index: 99990; background: var(--desk); overflow: auto; }
    .pt-view img { display: block; image-rendering: pixelated; }
  `);

  /* ---------- program ---------- */
  let C = null, P = null; // ctx, program internals

  function preview(g, w, h, t) {
    g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#808080'; g.fillRect(22, 4, w - 26, h - 26);
    g.fillStyle = '#fff'; g.fillRect(25, 7, w - 40, h - 36);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 4 === Math.floor(t * 2) % 4 ? '#808080' : '#dcdcdc'; g.fillRect(3 + (i % 2) * 9, 5 + Math.floor(i / 2) * 9, 8, 8); }
    PALETTE.forEach((c, i) => { g.fillStyle = c; g.fillRect(30 + (i % 14) * 11, h - 19 + Math.floor(i / 14) * 8, 10, 7); });
    const prog = (t % 6) / 4;
    g.fillStyle = '#0000ff';
    for (let i = 0; i < 160 * Math.min(1, prog); i++) { const x = 34 + i, y = 40 + Math.round(Math.sin(i / 14) * 18); g.fillRect(x, y, 3, 3); }
    if (prog > .4) { const k = Math.min(1, (prog - .4) / .5); drawShape(g, 'ellipse', 120, 22, 120 + Math.round(60 * k), 22 + Math.round(40 * k), 2, 1, '#ff0000', '#ffff00'); }
    if (prog > .9) drawShape(g, 'rect', 40, 62, 90, 82, 1, 1, '#000', '#00ff00');
  }

  Arcade.app({
    id: 'paint', title: 'untitled - Paint', label: 'Paint', icon: ICON, width: 640, height: 480, max: true, folder: 'Accessories', desktop: true, status: true,
    hint: 'Paint, Win95 style: pencil, brush, airbrush, shapes, curves, flood fill, text, selections and your own wallpaper.',
    preview,
    menus: [
      { label: 'File', items: [
        { label: 'New', key: 'Ctrl+N', action: () => P.newImage() },
        { label: 'Open…', key: 'Ctrl+O', action: () => P.openDialog() },
        { label: 'Save', key: 'Ctrl+S', action: () => P.save() },
        { label: 'Save As…', action: () => P.saveAs() },
        { label: 'Save to disk (PNG)', action: () => P.saveDisk() },
        '-',
        { label: 'Set As Wallpaper (Tiled)', action: () => P.setWallpaper('tiled') },
        { label: 'Set As Wallpaper (Centered)', action: () => P.setWallpaper('centered') },
        '-',
        { label: 'Exit', key: 'Alt+F4', action: () => C.close() }
      ] },
      { label: 'Edit', items: [
        { label: 'Undo', key: 'Ctrl+Z', disabled: () => !P.canUndo(), action: () => P.undo() },
        { label: 'Repeat', key: 'F4', disabled: () => !P.canRedo(), action: () => P.redo() },
        '-',
        { label: 'Cut', key: 'Ctrl+X', disabled: () => !P.hasSel(), action: () => P.cut() },
        { label: 'Copy', key: 'Ctrl+C', disabled: () => !P.hasSel(), action: () => P.copy() },
        { label: 'Paste', key: 'Ctrl+V', action: () => P.pasteMenu() },
        { label: 'Clear Selection', key: 'Del', disabled: () => !P.hasSel(), action: () => P.clearSel() },
        { label: 'Select All', key: 'Ctrl+L', action: () => P.selectAll() }
      ] },
      { label: 'View', items: [
        { label: 'Tool Box', key: 'Ctrl+T', checked: () => P.vis.tools, action: () => P.toggle('tools') },
        { label: 'Color Box', key: 'Ctrl+A', checked: () => P.vis.colors, action: () => P.toggle('colors') },
        { label: 'Status Bar', checked: () => P.vis.status, action: () => P.toggle('status') },
        { label: 'Text Toolbar', checked: () => P.vis.font, disabled: () => P.tool() !== 'text', action: () => P.toggle('font') },
        '-',
        { label: 'Zoom: Normal Size', key: 'Ctrl+PgUp', radio: () => P.zoom() === 1, action: () => P.setZoom(1) },
        { label: 'Zoom: Large Size', key: 'Ctrl+PgDn', radio: () => P.zoom() === 4, action: () => P.setZoom(4) },
        { label: 'Zoom: Custom…', action: () => P.zoomDialog() },
        { label: 'Show Grid', key: 'Ctrl+G', checked: () => P.vis.grid, action: () => P.toggle('grid') },
        '-',
        { label: 'View Bitmap', key: 'Ctrl+F', action: () => P.viewBitmap() }
      ] },
      { label: 'Image', items: [
        { label: 'Flip/Rotate…', key: 'Ctrl+R', action: () => P.flipDialog() },
        { label: 'Stretch/Skew…', key: 'Ctrl+W', action: () => P.stretchDialog() },
        { label: 'Invert Colors', key: 'Ctrl+I', action: () => P.invert() },
        { label: 'Attributes…', key: 'Ctrl+E', action: () => P.attrDialog() },
        { label: 'Clear Image', key: 'Ctrl+Shft+N', action: () => P.clearImage() },
        { label: 'Draw Opaque', checked: () => P.opaque(), action: () => P.setOpaque(!P.opaque()) }
      ] },
      { label: 'Colors', items: [
        { label: 'Edit Colors…', action: () => P.editColors() }
      ] },
      { label: 'Help', items: [
        { label: 'Help Topics', action: () => P.help() },
        '-',
        { label: 'About Paint', action: () => Arcade.dialog({ title: 'About Paint', icon: 'info', text: 'Paint for Arcade 95. A re-creation of the Windows 95 bitmap editor: every tool draws real pixels, with no antialiasing. Pictures are saved in this browser; Save to disk downloads a PNG.' }) }
      ] }
    ],
    build(ctx) { C = ctx; P = buildPaint(ctx); }
  });

  function buildPaint(ctx) {
    const el = Arcade.el, coarse = Arcade.coarse;
    let W = 400, H = 300, zoom = 1, tool = 'pencil', prevTool = 'pencil';
    let fg = '#000000', bg = '#ffffff', palette = S.get('palette', null) || PALETTE.slice(), editSlot = 0;
    let custom = S.get('custom', null) || Array(16).fill('#ffffff');
    const opt = { eraser: 1, brush: 1, air: 0, width: 0, fill: 0, opaque: true };
    const font = Object.assign({ family: 'Arial', size: 12, b: false, i: false, u: false }, S.get('font', {}));
    const vis = { tools: true, colors: true, status: true, font: true, grid: false };
    let undoS = [], redoS = [], dirty = false, fileName = null;
    let sel = null, clip = null, txt = null, drag = null, curve = null, poly = null, airT = 0, lastDown = { t: 0, x: -9, y: -9 };

    /* --- DOM --- */
    ctx.body.style.padding = '0';
    const root = el(`<div class="pt-root">
      <div class="pt-main">
        <div class="pt-tools"><div class="pt-grid"></div><div class="pt-opts bevel-thin-in"></div></div>
        <div class="pt-ws bevel-in"><div class="pt-wrap"><canvas class="pt-cv"></canvas><canvas class="pt-ov"></canvas><div class="pt-grid-ov" hidden></div></div></div>
        <div class="pt-font bevel-out" hidden><div class="pt-ft">Fonts</div><select class="field pt-ff"></select><select class="field pt-fs"></select>
          <button class="btn" data-f="b"><b>B</b></button><button class="btn" data-f="i"><i>I</i></button><button class="btn" data-f="u"><u>U</u></button></div>
      </div>
      <div class="pt-colors"><div class="pt-cur bevel-in"><span class="pt-bgc"></span><span class="pt-fgc"></span></div><div class="pt-pal"></div></div>
    </div>`);
    ctx.body.appendChild(root);
    const $ = s => root.querySelector(s);
    const toolsEl = $('.pt-tools'), gridEl = $('.pt-grid'), optsEl = $('.pt-opts'), ws = $('.pt-ws'), wrap = $('.pt-wrap'), colorsEl = $('.pt-colors');
    const cv = $('.pt-cv'), ov = $('.pt-ov'), gridOv = $('.pt-grid-ov'), fontBar = $('.pt-font');
    let g = c2d(cv), og = c2d(ov);
    const handles = ['r', 'b', 'rb'].map(h => { const d = el(`<div class="pt-h${coarse ? ' coarse' : ''}" data-h="${h}"></div>`); wrap.appendChild(d); return d; });

    /* --- status --- */
    let helpText = '', coordText = '', sizeText = '';
    const status = () => ctx.status(helpText || TOOL[tool].help, coordText || ' ', sizeText || ' ');
    const setCoord = p => { coordText = p ? `${p.x},${p.y}` : ''; status(); };
    const setSize = (w, h) => { sizeText = w == null ? '' : `${Math.abs(w)}x${Math.abs(h)}`; status(); };

    /* --- tool palette --- */
    TOOLS.forEach(t => {
      const b = el(`<button class="pt-tool bevel-out" title="${t.name}" aria-label="${t.name}">${gridSvg(t.g)}</button>`);
      b.dataset.t = t.id;
      b.addEventListener('click', () => setTool(t.id));
      b.addEventListener('pointerenter', () => { helpText = t.help; status(); });
      b.addEventListener('pointerleave', () => { helpText = ''; status(); });
      gridEl.appendChild(b);
    });
    function optCanvas(w, h, draw) { const c = mkCanvas(w, h); const x = c2d(c); x.fillStyle = '#000'; draw(x); return c; }
    function renderOpts() {
      optsEl.innerHTML = ''; optsEl.classList.remove('cols');
      const kind = TOOL[tool].opt; if (!kind) return;
      const add = (on, c, fn, extra = '') => { const b = el(`<button class="pt-opt${on ? ' on' : ''} ${extra}"></button>`); if (typeof c === 'string') b.textContent = c; else b.appendChild(c); b.onclick = () => { fn(); renderOpts(); }; optsEl.appendChild(b); };
      if (kind === 'eraser') ERASER.forEach((s, i) => add(opt.eraser === i, optCanvas(12, 12, x => x.fillRect(6 - s / 2, 6 - s / 2, s, s)), () => { opt.eraser = i; }));
      if (kind === 'brush') { optsEl.classList.add('cols'); BRUSHES.forEach((px, i) => add(opt.brush === i, optCanvas(10, 10, x => px.forEach(([a, b]) => x.fillRect(5 + a, 5 + b, 1, 1))), () => { opt.brush = i; })); }
      if (kind === 'air') AIR.forEach((r, i) => add(opt.air === i, optCanvas(26, 20, x => { let s = 7 + i * 11; for (let k = 0; k < 18 + i * 14; k++) { const a = (k * 2.39996) % (Math.PI * 2), d = Math.sqrt((k * 37 % 101) / 101) * (r * .8); x.fillRect(13 + Math.round(Math.cos(a) * d), 10 + Math.round(Math.sin(a) * d), 1, 1); } s += 0; }), () => { opt.air = i; }));
      if (kind === 'width') [1, 2, 3, 4, 5].forEach((w, i) => add(opt.width === i, optCanvas(34, 7, x => x.fillRect(2, 3 - (w >> 1), 30, w)), () => { opt.width = i; }));
      if (kind === 'fill') [0, 1, 2].forEach(m => add(opt.fill === m, optCanvas(32, 16, x => {
        if (m === 1) { x.fillStyle = '#808080'; x.fillRect(4, 3, 24, 10); }
        if (m === 2) { x.fillStyle = '#808080'; x.fillRect(3, 2, 26, 12); }
        if (m !== 2) { x.fillStyle = '#000'; x.fillRect(3, 2, 26, 1); x.fillRect(3, 13, 26, 1); x.fillRect(3, 2, 1, 12); x.fillRect(28, 2, 1, 12); }
      }), () => { opt.fill = m; }));
      if (kind === 'opaque') [true, false].forEach(o => add(opt.opaque === o, optCanvas(34, 24, x => {
        if (o) { x.fillStyle = '#fff'; x.fillRect(6, 4, 22, 16); }
        x.fillStyle = '#ff0000'; x.fillRect(10, 8, 6, 6); x.fillStyle = '#0000ff'; x.fillRect(16, 12, 8, 6);
        x.fillStyle = '#000'; for (let i = 6; i < 28; i += 2) { x.fillRect(i, 4, 1, 1); x.fillRect(i, 19, 1, 1); } for (let i = 4; i < 20; i += 2) { x.fillRect(6, i, 1, 1); x.fillRect(27, i, 1, 1); }
      }), () => setOpaque(o), 'keep'));
      if (kind === 'mag') MAGS.forEach(m => add(zoom === m, m + 'x', () => setZoom(m), 'txt'));
    }
    function setTool(id) {
      if (id === tool && id !== 'mag') return;
      finishOps();
      if (sel && id !== 'select' && id !== 'free') commitSel();
      if ((id === 'pick' || id === 'mag') && tool && tool !== 'pick' && tool !== 'mag') prevTool = tool;
      tool = id; sizeText = '';
      gridEl.querySelectorAll('.pt-tool').forEach(b => b.classList.toggle('on', b.dataset.t === id));
      wrap.style.cursor = id === 'text' ? 'text' : id === 'mag' ? 'zoom-in' : 'crosshair';
      fontBar.hidden = !(id === 'text' && vis.font);
      renderOpts(); status();
    }

    /* --- color box --- */
    const palEl = $('.pt-pal'), fgEl = $('.pt-fgc'), bgEl = $('.pt-bgc');
    function renderColors() {
      fgEl.style.background = fg; bgEl.style.background = bg;
      palEl.innerHTML = '';
      palette.forEach((c, i) => {
        const b = el('<button></button>'); b.style.background = c; b.title = c;
        b.addEventListener('pointerdown', e => { e.preventDefault(); if (e.button === 2) setBg(palette[i]); else { setFg(palette[i]); editSlot = i; } });
        b.addEventListener('dblclick', () => { editSlot = i; editColors(); });
        b.addEventListener('contextmenu', e => e.preventDefault());
        palEl.appendChild(b);
      });
    }
    function setFg(c) { fg = c; fgEl.style.background = c; if (txt) txt.el.style.color = c; }
    function setBg(c) { bg = c; bgEl.style.background = c; if (txt) styleText(); if (sel && sel.float && !opt.opaque) renderSel(); }
    $('.pt-cur').addEventListener('contextmenu', e => e.preventDefault());

    /* --- layout & zoom --- */
    function layout() {
      const w = W * zoom, h = H * zoom;
      wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
      [cv, ov].forEach(c => { c.style.width = w + 'px'; c.style.height = h + 'px'; });
      const hs = coarse ? 12 : 5;
      handles[0].style.left = w + 'px'; handles[0].style.top = (h / 2 - hs / 2) + 'px';
      handles[1].style.left = (w / 2 - hs / 2) + 'px'; handles[1].style.top = h + 'px';
      handles[2].style.left = w + 'px'; handles[2].style.top = h + 'px';
      gridOv.hidden = !(vis.grid && zoom >= 4);
      gridOv.style.width = w + 'px'; gridOv.style.height = h + 'px';
      gridOv.style.background = `linear-gradient(90deg, rgba(128,128,128,.7) 1px, transparent 1px) 0 0 / ${zoom}px ${zoom}px, linear-gradient(rgba(128,128,128,.7) 1px, transparent 1px) 0 0 / ${zoom}px ${zoom}px`;
      if (sel) placeSel();
      if (txt) styleText();
    }
    function setZoom(z, cx, cy) {
      if (cx == null) { cx = (ws.scrollLeft + ws.clientWidth / 2) / zoom; cy = (ws.scrollTop + ws.clientHeight / 2) / zoom; }
      zoom = z; layout();
      ws.scrollLeft = cx * z - ws.clientWidth / 2; ws.scrollTop = cy * z - ws.clientHeight / 2;
      if (TOOL[tool].opt === 'mag') renderOpts();
    }
    function resizeCanvas(w, h, keep = true) {
      w = Math.max(1, Math.min(4000, w | 0)); h = Math.max(1, Math.min(4000, h | 0));
      const old = keep ? copyCanvas(cv) : null;
      cv.width = ov.width = W = w; cv.height = ov.height = H = h;
      g = c2d(cv); og = c2d(ov);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (old) g.drawImage(old, 0, 0);
      layout();
    }
    function copyCanvas(src) { const c = mkCanvas(src.width, src.height); c2d(c).drawImage(src, 0, 0); return c; }

    /* --- undo --- */
    function pushUndo() {
      undoS.push({ w: W, h: H, d: g.getImageData(0, 0, W, H) });
      let bytes = 0; for (let i = undoS.length - 1; i >= 0; i--) { bytes += undoS[i].w * undoS[i].h * 4; if (bytes > 120e6 || undoS.length - i > 50) { undoS.splice(0, i); break; } }
      redoS = []; markDirty();
    }
    function restore(s) { if (s.w !== W || s.h !== H) { cv.width = ov.width = W = s.w; cv.height = ov.height = H = s.h; g = c2d(cv); og = c2d(ov); layout(); } g.putImageData(s.d, 0, 0); }
    function undo() {
      if (txt) { txt.el.remove(); txt = null; }
      curve = poly = null; og.clearRect(0, 0, W, H);
      if (sel) dropSel();
      const s = undoS.pop(); if (!s) return;
      redoS.push({ w: W, h: H, d: g.getImageData(0, 0, W, H) }); restore(s); markDirty();
    }
    function redo() {
      finishOps(); if (sel) commitSel();
      const s = redoS.pop(); if (!s) return;
      undoS.push({ w: W, h: H, d: g.getImageData(0, 0, W, H) }); restore(s); markDirty();
    }
    function markDirty() { dirty = true; }

    /* --- pointer helpers --- */
    const pt = e => { const r = cv.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) }; };
    const inside = p => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
    function constrain(p0, p, kind) {
      const dx = p.x - p0.x, dy = p.y - p0.y;
      if (kind === 'line') {
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
        const ux = Math.round(Math.cos(a) * 1e6) / 1e6, uy = Math.round(Math.sin(a) * 1e6) / 1e6;
        const k = (ux && uy) ? Math.max(Math.abs(dx), Math.abs(dy)) : len;
        return { x: p0.x + Math.round(ux * k), y: p0.y + Math.round(uy * k) };
      }
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: p0.x + Math.sign(dx || 1) * s, y: p0.y + Math.sign(dy || 1) * s };
    }

    /* --- painting ops --- */
    function stampBrush(c, x, y, col) { c.fillStyle = col; BRUSHES[opt.brush].forEach(([a, b]) => c.fillRect(x + a, y + b, 1, 1)); }
    function eraseLine(p0, p1, right) {
      const s = ERASER[opt.eraser];
      if (!right) { g.fillStyle = bg; bres(p0.x, p0.y, p1.x, p1.y, (x, y) => g.fillRect(x - (s >> 1), y - (s >> 1), s, s)); return; }
      const x0 = Math.max(0, Math.min(p0.x, p1.x) - s), y0 = Math.max(0, Math.min(p0.y, p1.y) - s);
      const x1 = Math.min(W, Math.max(p0.x, p1.x) + s), y1 = Math.min(H, Math.max(p0.y, p1.y) + s);
      if (x1 <= x0 || y1 <= y0) return;
      const img = g.getImageData(x0, y0, x1 - x0, y1 - y0), d = new Uint32Array(img.data.buffer), iw = x1 - x0, from = pack(fg), to = pack(bg);
      bres(p0.x, p0.y, p1.x, p1.y, (cx, cy) => {
        for (let y = cy - (s >> 1); y < cy - (s >> 1) + s; y++) for (let x = cx - (s >> 1); x < cx - (s >> 1) + s; x++) {
          const lx = x - x0, ly = y - y0; if (lx < 0 || ly < 0 || lx >= iw || ly >= y1 - y0) continue;
          if (d[ly * iw + lx] === from) d[ly * iw + lx] = to;
        }
      });
      g.putImageData(img, x0, y0);
    }
    function floodFill(x, y, col) {
      const img = g.getImageData(0, 0, W, H), d = new Uint32Array(img.data.buffer), target = d[y * W + x], rep = pack(col);
      if (target === rep) return false;
      const stack = [x, y];
      while (stack.length) {
        const sy = stack.pop(), sx = stack.pop(); let i = sy * W + sx;
        if (d[i] !== target) continue;
        let l = sx, r = sx;
        while (l > 0 && d[i - (sx - l) - 1] === target) l--;
        while (r < W - 1 && d[i + (r - sx) + 1] === target) r++;
        const row = sy * W; d.fill(rep, row + l, row + r + 1);
        for (const ny of [sy - 1, sy + 1]) {
          if (ny < 0 || ny >= H) continue;
          const nr = ny * W; let run = false;
          for (let xx = l; xx <= r; xx++) {
            const m = d[nr + xx] === target;
            if (m && !run) { stack.push(xx, ny); run = true; } else if (!m) run = false;
          }
        }
      }
      g.putImageData(img, 0, 0); return true;
    }
    function spray(p, col) {
      const r = AIR[opt.air], n = Math.round(r * 1.2);
      g.fillStyle = col;
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; g.fillRect(Math.round(p.x + Math.cos(a) * d), Math.round(p.y + Math.sin(a) * d), 1, 1); }
    }
    function pickAt(p, right) {
      if (!inside(p)) return;
      const d = g.getImageData(p.x, p.y, 1, 1).data, c = rgb2hex(d[0], d[1], d[2]);
      if (right) setBg(c); else setFg(c);
    }
    function shapeKind(t) { return t === 'rect' ? 'rect' : t === 'ellipse' ? 'ellipse' : 'rrect'; }
    function drawPoly(c, pts, closed, stroke, fill, lw, mode) {
      if (closed && mode > 0) fillPolygon(c, pts, mode === 2 ? stroke : fill);
      if (mode === 2 && closed) return;
      c.fillStyle = stroke;
      for (let i = 0; i + 1 < pts.length; i++) thickLine(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lw);
      if (closed && pts.length > 2) thickLine(c, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], lw);
    }
    function drawCurve(c, cu) { c.fillStyle = cu.col; const pts = bezier(cu.p0, cu.c1 || cu.p0, cu.c2 || cu.c1 || cu.p3, cu.p3); for (let i = 0; i + 1 < pts.length; i++) thickLine(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], cu.lw); }
    function finishCurve() { if (!curve) return; og.clearRect(0, 0, W, H); if (curve.stage > 0) { pushUndo(); drawCurve(g, curve); } curve = null; }
    function finishPoly() {
      if (!poly) return; og.clearRect(0, 0, W, H);
      const pts = poly.pts.filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
      if (pts.length > 1) { pushUndo(); drawPoly(g, pts, true, poly.stroke, poly.fill, poly.lw, poly.mode); }
      poly = null;
    }
    function finishOps() { commitText(); finishCurve(); finishPoly(); }

    /* --- selection --- */
    let selEl = null, selCv = null;
    function makeSel(x, y, w, h, mask) {
      sel = { x, y, w, h, mask, float: null, view: null };
      selEl = el('<div class="pt-sel"></div>'); selCv = document.createElement('canvas'); selEl.appendChild(selCv); wrap.appendChild(selEl);
      selEl.addEventListener('pointerdown', selDown);
      selEl.addEventListener('contextmenu', e => e.preventDefault());
      placeSel(); setSize(w, h);
    }
    function placeSel() {
      selEl.style.left = (sel.x * zoom - 1) + 'px'; selEl.style.top = (sel.y * zoom - 1) + 'px';
      selEl.style.width = (sel.w * zoom + 2) + 'px'; selEl.style.height = (sel.h * zoom + 2) + 'px';
      selCv.style.width = sel.w * zoom + 'px'; selCv.style.height = sel.h * zoom + 'px';
    }
    function regionCanvas() {
      const c = mkCanvas(sel.w, sel.h), x = c2d(c); x.drawImage(cv, -sel.x, -sel.y);
      if (sel.mask) { x.globalCompositeOperation = 'destination-in'; x.drawImage(sel.mask, 0, 0); }
      return c;
    }
    function clearRegion() {
      if (sel.mask) { const m = copyCanvas(sel.mask), mx = c2d(m); mx.globalCompositeOperation = 'source-in'; mx.fillStyle = bg; mx.fillRect(0, 0, m.width, m.height); g.drawImage(m, sel.x, sel.y); }
      else { g.fillStyle = bg; g.fillRect(sel.x, sel.y, sel.w, sel.h); }
    }
    function lift(clear) {
      if (sel.float) return;
      pushUndo(); sel.float = regionCanvas();
      if (clear) clearRegion();
      renderSel();
    }
    function renderSel() {
      if (!sel) return;
      selCv.width = sel.w; selCv.height = sel.h;
      const x = c2d(selCv); x.clearRect(0, 0, sel.w, sel.h);
      if (!sel.float) { sel.view = null; return; }
      let v = sel.float;
      if (!opt.opaque) {
        v = copyCanvas(sel.float); const vx = c2d(v), img = vx.getImageData(0, 0, v.width, v.height), d = new Uint32Array(img.data.buffer), k = pack(bg);
        for (let i = 0; i < d.length; i++) if (d[i] === k) d[i] = 0;
        vx.putImageData(img, 0, 0);
      }
      sel.view = v; x.drawImage(v, 0, 0);
    }
    function stamp() { g.drawImage(sel.view || sel.float, sel.x, sel.y); markDirty(); }
    function commitSel() { if (!sel) return; if (sel.float) stamp(); dropSel(); }
    function dropSel() { if (selEl) selEl.remove(); sel = null; selEl = selCv = null; setSize(); }
    function selDown(e) {
      if (tool !== 'select' && tool !== 'free') return;
      e.preventDefault(); e.stopPropagation();
      if (e.button === 2) return;
      ctx.focus();
      if (e.ctrlKey || e.metaKey) { if (sel.float) { pushUndo(); stamp(); } else lift(false); }
      else lift(true);
      const p0 = pt(e), sx = sel.x, sy = sel.y, smear = e.shiftKey;
      selEl.setPointerCapture(e.pointerId);
      const move = ev => { const p = pt(ev); sel.x = sx + p.x - p0.x; sel.y = sy + p.y - p0.y; placeSel(); if (smear) stamp(); setCoord(p); };
      const up = () => { selEl.removeEventListener('pointermove', move); selEl.removeEventListener('pointerup', up); selEl.removeEventListener('pointercancel', up); };
      selEl.addEventListener('pointermove', move); selEl.addEventListener('pointerup', up); selEl.addEventListener('pointercancel', up);
    }
    function selectAll() { finishOps(); commitSel(); setTool('select'); makeSel(0, 0, W, H, null); }
    function clearSel() { if (!sel) return; if (sel.float) { dropSel(); markDirty(); return; } pushUndo(); clearRegion(); dropSel(); }
    function copy() {
      if (!sel) return;
      clip = sel.float ? copyCanvas(sel.float) : regionCanvas();
      try { if (navigator.clipboard && window.ClipboardItem) clip.toBlob(b => { try { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}); } catch {} }); } catch {}
    }
    function cut() { if (!sel) return; copy(); clearSel(); }
    async function pasteCanvas(src) {
      finishOps(); commitSel();
      if (src.width > W || src.height > H) {
        const r = await Arcade.dialog({ title: 'Paint', icon: 'warn', text: 'The image in the clipboard is larger than the bitmap. Would you like the bitmap enlarged?', buttons: ['Yes', 'No', 'Cancel'] });
        if (r === 'Cancel' || r === null) return;
        if (r === 'Yes') { pushUndo(); resizeCanvas(Math.max(W, src.width), Math.max(H, src.height)); }
      }
      setTool('select');
      const x = Math.max(0, Math.floor(ws.scrollLeft / zoom)), y = Math.max(0, Math.floor(ws.scrollTop / zoom));
      makeSel(x, y, src.width, src.height, null);
      pushUndo(); sel.float = copyCanvas(src); renderSel();
    }
    function blobToCanvas(blob) {
      return new Promise((res, rej) => {
        const url = URL.createObjectURL(blob), img = new Image();
        img.onload = () => { const c = mkCanvas(img.naturalWidth, img.naturalHeight); const x = c2d(c); x.fillStyle = bg; x.drawImage(img, 0, 0); URL.revokeObjectURL(url); res(c); };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
        img.src = url;
      });
    }
    let pasteSeen = false;
    document.addEventListener('paste', e => {
      if (!ctx.isActive() || document.querySelector('.modal-veil')) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
      pasteSeen = true;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { e.preventDefault(); blobToCanvas(f).then(pasteCanvas).catch(() => {}); return; } }
      if (clip) { e.preventDefault(); pasteCanvas(clip); }
    });
    async function pasteMenu() {
      if (clip) { pasteCanvas(clip); return; }
      try {
        const items = await navigator.clipboard.read();
        for (const it of items) { const t = it.types.find(x => x.startsWith('image/')); if (t) { pasteCanvas(await blobToCanvas(await it.getType(t))); return; } }
      } catch {}
      Arcade.dialog({ title: 'Paint', icon: 'info', text: 'There is no picture on the clipboard. Copy a selection first, or press Ctrl+V to paste an image from another program.' });
    }

    /* --- text tool --- */
    const fontStr = s => `${font.i ? 'italic ' : ''}${font.b ? 'bold ' : ''}${s}px "${font.family}"`;
    function styleText() {
      const t = txt; if (!t) return;
      Object.assign(t.el.style, { left: t.x * zoom + 'px', top: t.y * zoom + 'px', width: t.w * zoom + 'px', minHeight: t.h * zoom + 'px', font: fontStr(font.size * zoom), lineHeight: '1.2',
        padding: 2 * zoom + 'px', color: t.col, background: opt.opaque ? bg : 'transparent', textDecoration: font.u ? 'underline' : 'none' });
      t.el.style.height = 'auto'; t.el.style.height = Math.max(t.h * zoom, t.el.scrollHeight) + 'px';
    }
    function makeText(x, y, w, h, col) {
      const ta = el('<textarea class="pt-text" spellcheck="false"></textarea>');
      txt = { x, y, w: Math.max(w, 24), h: Math.max(h, Math.round(font.size * 1.2) + 4), col, el: ta };
      wrap.appendChild(ta); styleText(); ta.focus();
      ta.addEventListener('input', styleText);
      ta.addEventListener('pointerdown', e => e.stopPropagation());
      ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); commitText(); } });
      setTimeout(() => ta.focus(), 0);
    }
    function wrapLines(c, s, maxW) {
      const out = [];
      s.split('\n').forEach(par => {
        let line = '';
        par.split(/(\s+)/).forEach(tok => {
          if (c.measureText(line + tok).width <= maxW || !line) {
            if (c.measureText(tok).width > maxW && !line.trim()) { for (const ch of tok) { if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ''; } line += ch; } }
            else line += tok;
          } else { out.push(line.replace(/\s+$/, '')); line = tok.replace(/^\s+/, ''); }
        });
        out.push(line);
      });
      return out;
    }
    function commitText() {
      if (!txt) return;
      const t = txt; txt = null;
      const s = t.el.value, hgt = Math.round(Math.max(t.h, t.el.offsetHeight / zoom));
      t.el.remove();
      if (!s.trim()) return;
      pushUndo();
      g.save(); g.beginPath(); g.rect(t.x, t.y, t.w, hgt); g.clip();
      if (opt.opaque) { g.fillStyle = bg; g.fillRect(t.x, t.y, t.w, hgt); }
      g.font = fontStr(font.size); g.textBaseline = 'top'; g.fillStyle = t.col;
      const lh = font.size * 1.2;
      wrapLines(g, s, t.w - 4).forEach((ln, i) => {
        const y = Math.round(t.y + 2 + i * lh + (lh - font.size) / 2);
        g.fillText(ln, t.x + 2, y);
        if (font.u && ln) g.fillRect(t.x + 2, y + Math.round(font.size * .95), Math.ceil(g.measureText(ln).width), Math.max(1, Math.round(font.size / 14)));
      });
      g.restore();
    }
    const ff = $('.pt-ff'), fs = $('.pt-fs');
    FONTS.forEach(f => ff.appendChild(Object.assign(document.createElement('option'), { value: f, textContent: f })));
    SIZES.forEach(s => fs.appendChild(Object.assign(document.createElement('option'), { value: s, textContent: s })));
    function syncFont() {
      ff.value = font.family; fs.value = font.size;
      fontBar.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('pressed', font[b.dataset.f]));
      S.set('font', font); styleText();
    }
    ff.onchange = () => { font.family = ff.value; syncFont(); };
    fs.onchange = () => { font.size = +fs.value; syncFont(); };
    fontBar.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { font[b.dataset.f] = !font[b.dataset.f]; syncFont(); if (txt) txt.el.focus(); }));
    fontBar.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON' || e.target.closest('button')) e.preventDefault(); });

    function setOpaque(o) { opt.opaque = o; renderSel(); styleText(); if (TOOL[tool].opt === 'opaque') renderOpts(); }

    /* --- main pointer handling --- */
    wrap.addEventListener('contextmenu', e => e.preventDefault());
    ws.addEventListener('contextmenu', e => e.preventDefault());
    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('.pt-sel, .pt-text, .pt-h')) return;
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      if (document.activeElement && document.activeElement !== document.body && !wrap.contains(document.activeElement)) document.activeElement.blur();
      const p = pt(e), right = e.button === 2, c1 = right ? bg : fg, c2 = right ? fg : bg;
      const now = performance.now(), dbl = now - lastDown.t < 400 && Math.abs(p.x - lastDown.x) < 4 && Math.abs(p.y - lastDown.y) < 4;
      lastDown = { t: now, x: p.x, y: p.y };
      wrap.setPointerCapture(e.pointerId);
      drag = { p0: p, last: p, right, c1, c2, shift: e.shiftKey };
      switch (tool) {
        case 'select': case 'free':
          commitSel(); if (tool === 'free') drag.path = [[p.x, p.y]]; break;
        case 'text':
          if (txt) { commitText(); drag = null; return; } break;
        case 'eraser': pushUndo(); eraseLine(p, p, right); break;
        case 'fill': if (inside(p)) { pushUndo(); if (!floodFill(p.x, p.y, c1)) undoS.pop(); } drag = null; break;
        case 'pick': pickAt(p, right); drag = null; setTool(prevTool); break;
        case 'mag': setZoom(zoom === 1 ? 4 : 1, p.x, p.y); drag = null; setTool(prevTool); break;
        case 'pencil': pushUndo(); g.fillStyle = c1; g.fillRect(p.x, p.y, 1, 1); break;
        case 'brush': pushUndo(); stampBrush(g, p.x, p.y, c1); break;
        case 'air': pushUndo(); spray(p, c1); clearInterval(airT); airT = setInterval(() => drag && spray(drag.last, c1), 30); break;
        case 'curve':
          if (curve && curve.stage > 0) { if (curve.stage === 1) curve.c1 = curve.c2 = [p.x, p.y]; else curve.c2 = [p.x, p.y]; redrawCurve(); }
          else curve = { p0: [p.x, p.y], p3: [p.x, p.y], col: c1, lw: opt.width + 1, stage: 0 };
          break;
        case 'poly':
          if (!poly) poly = { pts: [[p.x, p.y], [p.x, p.y]], stroke: c1, fill: c2, lw: opt.width + 1, mode: opt.fill };
          else {
            const s = poly.pts[0];
            if (dbl || (Math.abs(p.x - s[0]) <= 3 && Math.abs(p.y - s[1]) <= 3 && poly.pts.length > 2)) { drag = null; finishPoly(); return; }
            poly.pts.push([p.x, p.y]);
          }
          redrawPoly(); break;
      }
    });
    function redrawCurve() { og.clearRect(0, 0, W, H); drawCurve(og, curve); }
    function redrawPoly() { og.clearRect(0, 0, W, H); drawPoly(og, poly.pts, false, poly.stroke, poly.fill, poly.lw, 0); }
    wrap.addEventListener('pointermove', e => {
      if (e.target.closest('.pt-h')) return;
      const p = pt(e);
      setCoord(inside(p) ? p : null);
      if (!drag) return;
      const d = drag, l = d.last;
      switch (tool) {
        case 'select': {
          const q = { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) };
          og.clearRect(0, 0, W, H); og.fillStyle = '#000';
          const x0 = Math.min(d.p0.x, q.x), y0 = Math.min(d.p0.y, q.y), w = Math.abs(q.x - d.p0.x), h = Math.abs(q.y - d.p0.y);
          for (let i = 0; i < w; i += 2) { og.fillRect(x0 + i, y0, 1, 1); og.fillRect(x0 + i, y0 + h, 1, 1); }
          for (let i = 0; i < h; i += 2) { og.fillRect(x0, y0 + i, 1, 1); og.fillRect(x0 + w, y0 + i, 1, 1); }
          setSize(w, h); break;
        }
        case 'free': {
          const q = [Math.max(0, Math.min(W - 1, p.x)), Math.max(0, Math.min(H - 1, p.y))], a = d.path[d.path.length - 1];
          d.path.push(q); og.fillStyle = '#000'; bres(a[0], a[1], q[0], q[1], (x, y) => og.fillRect(x, y, 1, 1)); break;
        }
        case 'text': {
          og.clearRect(0, 0, W, H); og.fillStyle = '#000';
          const x0 = Math.min(d.p0.x, p.x), y0 = Math.min(d.p0.y, p.y), w = Math.abs(p.x - d.p0.x), h = Math.abs(p.y - d.p0.y);
          for (let i = 0; i < w; i += 2) { og.fillRect(x0 + i, y0, 1, 1); og.fillRect(x0 + i, y0 + h, 1, 1); }
          for (let i = 0; i < h; i += 2) { og.fillRect(x0, y0 + i, 1, 1); og.fillRect(x0 + w, y0 + i, 1, 1); }
          setSize(w, h); break;
        }
        case 'eraser': eraseLine(l, p, d.right); break;
        case 'pencil': g.fillStyle = d.c1; bres(l.x, l.y, p.x, p.y, (x, y) => g.fillRect(x, y, 1, 1)); break;
        case 'brush': bres(l.x, l.y, p.x, p.y, (x, y) => stampBrush(g, x, y, d.c1)); break;
        case 'air': spray(p, d.c1); break;
        case 'line': {
          const q = e.shiftKey ? constrain(d.p0, p, 'line') : p;
          og.clearRect(0, 0, W, H); og.fillStyle = d.c1; thickLine(og, d.p0.x, d.p0.y, q.x, q.y, opt.width + 1); d.end = q; break;
        }
        case 'curve':
          if (curve.stage === 0) curve.p3 = [p.x, p.y]; else if (curve.stage === 1) curve.c1 = curve.c2 = [p.x, p.y]; else curve.c2 = [p.x, p.y];
          redrawCurve(); break;
        case 'poly': poly.pts[poly.pts.length - 1] = [p.x, p.y]; redrawPoly(); break;
        case 'rect': case 'ellipse': case 'rrect': {
          const q = e.shiftKey ? constrain(d.p0, p, 'box') : p;
          og.clearRect(0, 0, W, H); drawShape(og, shapeKind(tool), d.p0.x, d.p0.y, q.x, q.y, opt.width + 1, opt.fill, d.c1, d.c2); d.end = q;
          setSize(q.x - d.p0.x + Math.sign(q.x - d.p0.x || 1), q.y - d.p0.y + Math.sign(q.y - d.p0.y || 1)); break;
        }
      }
      d.last = p;
    });
    function endDrag(e) {
      const d = drag; if (!d) return; drag = null; clearInterval(airT);
      const p = e && e.type !== 'pointercancel' ? pt(e) : d.last;
      switch (tool) {
        case 'select': {
          og.clearRect(0, 0, W, H); setSize();
          const q = { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) }, x0 = Math.max(0, Math.min(d.p0.x, q.x)), y0 = Math.max(0, Math.min(d.p0.y, q.y));
          const w = Math.min(W, Math.max(d.p0.x, q.x)) - x0, h = Math.min(H, Math.max(d.p0.y, q.y)) - y0;
          if (w > 0 && h > 0) makeSel(x0, y0, w, h, null);
          break;
        }
        case 'free': {
          og.clearRect(0, 0, W, H);
          const path = d.path; if (path.length < 3) break;
          let x0 = W, y0 = H, x1 = 0, y1 = 0; path.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
          const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 2 || h < 2) break;
          const m = mkCanvas(w, h), mx = c2d(m), rel = path.map(([x, y]) => [x - x0, y - y0]);
          fillPolygon(mx, rel, '#fff'); mx.fillStyle = '#fff'; for (let i = 0; i < rel.length; i++) { const a = rel[i], b = rel[(i + 1) % rel.length]; bres(a[0], a[1], b[0], b[1], (x, y) => mx.fillRect(x, y, 1, 1)); }
          makeSel(x0, y0, w, h, m); break;
        }
        case 'text': {
          og.clearRect(0, 0, W, H); setSize();
          const x0 = Math.min(d.p0.x, p.x), y0 = Math.min(d.p0.y, p.y);
          let w = Math.abs(p.x - d.p0.x), h = Math.abs(p.y - d.p0.y);
          if (w < 8 || h < 6) { w = Math.min(160, W - x0); h = 0; }
          makeText(Math.max(0, x0), Math.max(0, y0), w, h, fg); break;
        }
        case 'line': og.clearRect(0, 0, W, H); pushUndo(); g.fillStyle = d.c1; { const q = d.end || d.p0; thickLine(g, d.p0.x, d.p0.y, q.x, q.y, opt.width + 1); } break;
        case 'curve': curve.stage++; if (curve.stage === 3) finishCurve(); break;
        case 'rect': case 'ellipse': case 'rrect': { og.clearRect(0, 0, W, H); const q = d.end || d.p0; pushUndo(); drawShape(g, shapeKind(tool), d.p0.x, d.p0.y, q.x, q.y, opt.width + 1, opt.fill, d.c1, d.c2); setSize(); break; }
      }
    }
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);
    wrap.addEventListener('pointerleave', () => { if (!drag) setCoord(null); });

    /* --- canvas resize handles --- */
    handles.forEach(hd => hd.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); finishOps(); commitSel();
      const kind = hd.dataset.h, r0 = cv.getBoundingClientRect(), box = el('<div class="pt-rsz"></div>'); wrap.appendChild(box);
      let nw = W, nh = H;
      const show = () => { box.style.width = nw * zoom + 'px'; box.style.height = nh * zoom + 'px'; setSize(nw, nh); };
      hd.setPointerCapture(e.pointerId); show();
      const move = ev => {
        if (kind.includes('r')) nw = Math.max(1, Math.round((ev.clientX - r0.left) / zoom));
        if (kind.includes('b')) nh = Math.max(1, Math.round((ev.clientY - r0.top) / zoom));
        show();
      };
      const up = () => {
        hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
        box.remove(); setSize();
        if (nw !== W || nh !== H) { pushUndo(); resizeCanvas(nw, nh); }
      };
      hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    }));

    /* --- modal dialogs (shell msgbox look) --- */
    function modal(title, body, buttons = ['OK', 'Cancel'], onOk) {
      return new Promise(resolve => {
        const veil = el(`<div class="modal-veil"><div class="win msgbox bevel-out active pt-dlg">
          <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
          <div class="content"></div><div class="actions"></div></div></div>`);
        veil.querySelector('.ttl span').textContent = title;
        veil.querySelector('.content').appendChild(body);
        const done = v => { if (v === buttons[0] && onOk && onOk() === false) return; veil.remove(); resolve(v); };
        buttons.forEach(b => { const bt = el('<button class="btn"></button>'); bt.textContent = b; bt.onclick = () => done(b); veil.querySelector('.actions').appendChild(bt); });
        veil.querySelector('[data-act="close"]').onclick = () => done(null);
        veil.addEventListener('keydown', e => {
          if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') { e.preventDefault(); done(buttons[0]); }
          else if (e.key === 'Escape') done(null);
          e.stopPropagation();
        });
        veil.style.zIndex = 20000;
        document.getElementById('desktop').appendChild(veil);
        setTimeout(() => { const f = body.querySelector('input:not([type=radio]):not([type=checkbox]), button, input') || veil.querySelector('.actions button'); if (f) { f.focus(); if (f.select) f.select(); } }, 0);
      });
    }
    const numField = (v, min, max) => { const i = el(`<input class="field" type="number" inputmode="numeric">`); i.value = v; i.min = min; i.max = max; return i; };
    const clampNum = (i, d, min, max) => { const v = Math.round(+i.value); return isFinite(v) ? Math.max(min, Math.min(max, v)) : d; };

    /* --- image operations (selection if any, else whole picture) --- */
    function applyOp(fn) {
      finishOps();
      if (sel) { lift(true); sel.float = fn(sel.float, true); sel.w = sel.float.width; sel.h = sel.float.height; sel.mask = null; placeSel(); renderSel(); setSize(sel.w, sel.h); return; }
      pushUndo();
      const out = fn(copyCanvas(cv), false);
      cv.width = ov.width = W = out.width; cv.height = ov.height = H = out.height; g = c2d(cv); og = c2d(ov);
      g.fillStyle = bg; g.fillRect(0, 0, W, H); g.drawImage(out, 0, 0); layout();
    }
    const flipX = s => { const c = mkCanvas(s.width, s.height), x = c2d(c); x.translate(s.width, 0); x.scale(-1, 1); x.drawImage(s, 0, 0); return c; };
    const flipY = s => { const c = mkCanvas(s.width, s.height), x = c2d(c); x.translate(0, s.height); x.scale(1, -1); x.drawImage(s, 0, 0); return c; };
    function rotate(s, deg) {
      const sw = deg % 180 ? s.height : s.width, sh = deg % 180 ? s.width : s.height, c = mkCanvas(sw, sh), x = c2d(c);
      x.translate(sw / 2, sh / 2); x.rotate(deg * Math.PI / 180); x.drawImage(s, -s.width / 2, -s.height / 2); return c;
    }
    function stretchSkew(s, sx, sy, kx, ky, isSel) {
      let c = s;
      if (sx !== 100 || sy !== 100) { c = mkCanvas(Math.max(1, Math.round(s.width * sx / 100)), Math.max(1, Math.round(s.height * sy / 100))); c2d(c).drawImage(s, 0, 0, c.width, c.height); }
      if (kx || ky) {
        const tx = Math.tan(kx * Math.PI / 180), ty = Math.tan(ky * Math.PI / 180), w = c.width, h = c.height;
        const nw = Math.round(w + Math.abs(tx) * h), nh = Math.round(h + Math.abs(ty) * w), o = mkCanvas(nw, nh), x = c2d(o);
        if (!isSel) { x.fillStyle = bg; x.fillRect(0, 0, nw, nh); }
        x.setTransform(1, ty, tx, 1, tx < 0 ? -tx * h : 0, ty < 0 ? -ty * w : 0); x.drawImage(c, 0, 0); c = o;
      }
      return c;
    }
    function invertC(s) {
      const c = copyCanvas(s), x = c2d(c), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
      x.putImageData(img, 0, 0); return c;
    }
    function flipDialog() {
      const b = el(`<div><fieldset class="groupbox"><legend>Flip or rotate</legend>
        <label><input type="radio" name="pt-fr" value="h" checked> Flip horizontal</label>
        <label><input type="radio" name="pt-fr" value="v"> Flip vertical</label>
        <label><input type="radio" name="pt-fr" value="r"> Rotate by angle</label>
        <div style="padding-left:22px"><label><input type="radio" name="pt-ra" value="90" checked> 90°</label><label><input type="radio" name="pt-ra" value="180"> 180°</label><label><input type="radio" name="pt-ra" value="270"> 270°</label></div>
      </fieldset></div>`);
      modal('Flip and Rotate', b).then(r => {
        if (r !== 'OK') return;
        const k = b.querySelector('[name=pt-fr]:checked').value, a = +b.querySelector('[name=pt-ra]:checked').value;
        applyOp(s => k === 'h' ? flipX(s) : k === 'v' ? flipY(s) : rotate(s, a));
      });
    }
    function stretchDialog() {
      const sx = numField(100, 1, 500), sy = numField(100, 1, 500), kx = numField(0, -89, 89), ky = numField(0, -89, 89);
      const b = el('<div><fieldset class="groupbox"><legend>Stretch</legend></fieldset><fieldset class="groupbox"><legend>Skew</legend></fieldset></div>');
      const row = (fs, lbl, inp, unit) => { const l = el('<label></label>'); l.append(lbl, inp, unit); b.querySelectorAll('fieldset')[fs].appendChild(l); };
      row(0, 'Horizontal: ', sx, '%'); row(0, 'Vertical: ', sy, '%'); row(1, 'Horizontal: ', kx, 'Degrees'); row(1, 'Vertical: ', ky, 'Degrees');
      modal('Stretch and Skew', b).then(r => {
        if (r !== 'OK') return;
        const a = clampNum(sx, 100, 1, 500), c = clampNum(sy, 100, 1, 500), d = clampNum(kx, 0, -89, 89), e = clampNum(ky, 0, -89, 89);
        if (W * a / 100 > 4000 || H * c / 100 > 4000) return Arcade.dialog({ title: 'Paint', icon: 'error', text: 'That would make the picture too large.' });
        applyOp((s, isSel) => stretchSkew(s, a, c, d, e, isSel));
      });
    }
    function attrDialog() {
      finishOps(); commitSel();
      const wi = numField(W, 1, 4000), hi = numField(H, 1, 4000);
      const b = el(`<div><div class="pt-row"><label>Width: </label><label>Height: </label></div>
        <fieldset class="groupbox"><legend>Units</legend><label><input type="radio" checked> Pels (pixels)</label></fieldset>
        <fieldset class="groupbox"><legend>Colors</legend><label><input type="radio" name="pt-col" value="bw"> Black and white</label><label><input type="radio" name="pt-col" value="c" checked> Colors</label></fieldset></div>`);
      const ls = b.querySelectorAll('.pt-row label'); ls[0].appendChild(wi); ls[1].appendChild(hi);
      modal('Attributes', b, ['OK', 'Cancel', 'Default']).then(r => {
        if (r === 'Default') { pushUndo(); resizeCanvas(400, 300); return; }
        if (r !== 'OK') return;
        const nw = clampNum(wi, W, 1, 4000), nh = clampNum(hi, H, 1, 4000), bw = b.querySelector('[name=pt-col]:checked').value === 'bw';
        if (nw !== W || nh !== H || bw) pushUndo();
        if (nw !== W || nh !== H) resizeCanvas(nw, nh);
        if (bw) { const img = g.getImageData(0, 0, W, H), d = img.data; for (let i = 0; i < d.length; i += 4) { const v = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) >= 128 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; } g.putImageData(img, 0, 0); }
      });
    }
    function clearImage() { finishOps(); if (sel) dropSel(); pushUndo(); g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    function zoomDialog() {
      const b = el('<div><fieldset class="groupbox"><legend>Zoom to</legend></fieldset></div>');
      [1, 2, 4, 6, 8].forEach(z => b.firstChild.appendChild(el(`<label><input type="radio" name="pt-z" value="${z}"${z === zoom ? ' checked' : ''}> ${z * 100}%</label>`)));
      if (![1, 2, 4, 6, 8].includes(zoom)) b.querySelector('input').checked = true;
      modal('Custom Zoom', b).then(r => { if (r === 'OK') setZoom(+b.querySelector('[name=pt-z]:checked').value); });
    }
    function viewBitmap() {
      finishOps(); commitSel();
      const v = el('<div class="pt-view" tabindex="0"></div>'), img = new Image(); img.src = cv.toDataURL(); v.appendChild(img);
      const close = () => v.remove();
      v.addEventListener('pointerdown', close); v.addEventListener('keydown', e => { e.stopPropagation(); close(); });
      document.body.appendChild(v); v.focus();
    }

    /* --- Edit Colors dialog --- */
    function editColors() {
      let cur = palette[editSlot] || fg, [h, s, l] = rgb2hsl(...hex2rgb(cur));
      const b = el(`<div class="pt-ec"><div><div>Basic colors:</div><div class="sw pt-basic"></div><div>Custom colors:</div><div class="sw pt-custom"></div></div>
        <div><div class="spec"><canvas class="pt-hs" width="160" height="120"></canvas><canvas class="pt-lum" width="18" height="120"></canvas></div>
        <div class="pt-row" style="margin-top:6px"><div><canvas class="prev bevel-thin-in" width="60" height="34"></canvas><div style="font-size:11px">Color|Solid</div></div>
        <div class="nums"><span>Hue:</span><input class="field" data-k="h"><span>Red:</span><input class="field" data-k="r">
        <span>Sat:</span><input class="field" data-k="s"><span>Green:</span><input class="field" data-k="g">
        <span>Lum:</span><input class="field" data-k="l"><span>Blue:</span><input class="field" data-k="b"></div></div>
        <button class="btn pt-addc" style="margin-top:6px;width:100%">Add to Custom Colors</button></div></div>`);
      const hs = b.querySelector('.pt-hs'), lum = b.querySelector('.pt-lum'), prev = b.querySelector('.prev'), nums = {};
      b.querySelectorAll('[data-k]').forEach(i => { nums[i.dataset.k] = i; i.type = 'number'; i.inputMode = 'numeric'; });
      const hsImg = (() => { const c = mkCanvas(160, 120), x = c2d(c), img = x.createImageData(160, 120); for (let y = 0; y < 120; y++) for (let xx = 0; xx < 160; xx++) { const [r, gg, bb] = hsl2rgb(xx * 240 / 160, 240 - y * 2, 120), i = (y * 160 + xx) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = bb; img.data[i + 3] = 255; } x.putImageData(img, 0, 0); return c; })();
      function sync(from) {
        if (from === 'hsl') cur = rgb2hex(...hsl2rgb(h, s, l)); else [h, s, l] = rgb2hsl(...hex2rgb(cur));
        const [r, gg, bb] = hex2rgb(cur);
        Object.entries({ h, s, l, r, g: gg, b: bb }).forEach(([k, v]) => { if (document.activeElement !== nums[k]) nums[k].value = Math.round(v); });
        const x = c2d(hs); x.drawImage(hsImg, 0, 0);
        const cx = Math.round(h * 160 / 240), cy = Math.round((240 - s) / 2); x.fillStyle = '#000';
        x.fillRect(cx - 7, cy - 1, 5, 3); x.fillRect(cx + 3, cy - 1, 5, 3); x.fillRect(cx - 1, cy - 7, 3, 5); x.fillRect(cx - 1, cy + 3, 3, 5);
        const lx = c2d(lum); lx.clearRect(0, 0, 18, 120);
        for (let y = 0; y < 120; y++) { lx.fillStyle = rgb2hex(...hsl2rgb(h, s, 240 - y * 2)); lx.fillRect(0, y, 10, 1); }
        const ly = Math.round((240 - l) / 2); lx.fillStyle = '#000'; for (let i = 0; i < 5; i++) lx.fillRect(12 + i, ly - (4 - i), 1, (4 - i) * 2 + 1);
        const px = c2d(prev); px.fillStyle = cur; px.fillRect(0, 0, 60, 34);
      }
      const drag2 = (cvs, fn) => cvs.addEventListener('pointerdown', e => {
        cvs.setPointerCapture(e.pointerId);
        const go = ev => { const r = cvs.getBoundingClientRect(); fn(Math.max(0, Math.min(cvs.width - 1, (ev.clientX - r.left) * cvs.width / r.width)), Math.max(0, Math.min(cvs.height - 1, (ev.clientY - r.top) * cvs.height / r.height))); sync('hsl'); };
        go(e); const up = () => { cvs.removeEventListener('pointermove', go); cvs.removeEventListener('pointerup', up); };
        cvs.addEventListener('pointermove', go); cvs.addEventListener('pointerup', up);
      });
      drag2(hs, (x, y) => { h = Math.round(x * 240 / 160) % 240; s = Math.round(240 - y * 2); if (l === 0 || l === 240) l = 120; });
      drag2(lum, (x, y) => { l = Math.round(240 - y * 2); });
      b.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => {
        const v = k => +nums[k].value || 0, k = i.dataset.k;
        if ('hsl'.includes(k)) { h = Math.max(0, Math.min(239, v('h'))); s = Math.max(0, Math.min(240, v('s'))); l = Math.max(0, Math.min(240, v('l'))); sync('hsl'); }
        else { cur = rgb2hex(v('r'), v('g'), v('b')); sync('rgb'); }
      }));
      const swatches = (box, list, isCustom) => {
        box.innerHTML = '';
        list.forEach((c, i) => { const s2 = el('<button></button>'); s2.style.background = c; s2.onclick = () => { cur = c; if (isCustom) customSlot = i; box.querySelectorAll('button').forEach(x => x.classList.remove('on')); s2.classList.add('on'); sync('rgb'); }; box.appendChild(s2); });
      };
      let customSlot = 0;
      swatches(b.querySelector('.pt-basic'), BASIC, false); swatches(b.querySelector('.pt-custom'), custom, true);
      b.querySelector('.pt-addc').onclick = () => { custom[customSlot] = cur; customSlot = (customSlot + 1) % 16; S.set('custom', custom); swatches(b.querySelector('.pt-custom'), custom, true); };
      sync('rgb');
      modal('Edit Colors', b).then(r => {
        if (r !== 'OK') return;
        palette[editSlot] = cur; S.set('palette', palette); renderColors(); setFg(cur);
      });
    }

    /* --- files --- */
    const files = () => S.get('files', {});
    const displayName = () => fileName || 'untitled';
    function updateTitle() { ctx.setTitle(`${displayName()} - Paint`); }
    async function askSave() {
      if (!dirty) return true;
      const r = await Arcade.dialog({ title: 'Paint', icon: 'warn', text: `Save changes to ${displayName()}?`, buttons: ['Yes', 'No', 'Cancel'] });
      if (r === 'Yes') return save();
      return r === 'No';
    }
    function snapshotURL() { finishOps(); commitSel(); return cv.toDataURL('image/png'); }
    function writeFile(name) {
      const all = files(); all[name] = { url: snapshotURL(), w: W, h: H, t: Date.now() };
      S.set('files', all);
      if (!files()[name]) { Arcade.dialog({ title: 'Paint', icon: 'error', text: 'There is not enough storage space in this browser to save the picture. Try Save to disk instead, or delete old pictures from the Open dialog.' }); return false; }
      fileName = name; dirty = false; updateTitle(); return true;
    }
    async function save() { if (!fileName) return saveAs(); return writeFile(fileName); }
    async function saveAs() {
      const n = await Arcade.dialog({ title: 'Save As', icon: 'info', text: 'File name:', input: fileName || 'untitled', buttons: ['Save', 'Cancel'] });
      if (!n) return false;
      const name = n.replace(/\.(bmp|png)$/i, '').trim(); if (!name) return false;
      if (name !== fileName && files()[name]) {
        const r = await Arcade.dialog({ title: 'Save As', icon: 'warn', text: `${name} already exists. Do you want to replace it?`, buttons: ['Yes', 'No'] });
        if (r !== 'Yes') return false;
      }
      return writeFile(name);
    }
    function saveDisk() {
      try {
        const name = displayName() + '.png';
        snapshotURL();
        cv.toBlob(b => {
          try { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
          catch { Arcade.dialog({ title: 'Paint', icon: 'error', text: 'This browser could not download the picture.' }); }
        }, 'image/png');
      } catch { Arcade.dialog({ title: 'Paint', icon: 'error', text: 'This browser could not download the picture.' }); }
    }
    function loadURL(url, name) {
      const img = new Image();
      img.onload = () => {
        if (sel) dropSel(); if (txt) { txt.el.remove(); txt = null; }
        cv.width = ov.width = W = img.naturalWidth; cv.height = ov.height = H = img.naturalHeight; g = c2d(cv); og = c2d(ov);
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0);
        undoS = []; redoS = []; dirty = false; fileName = name; zoom = 1; layout(); updateTitle(); ws.scrollTop = ws.scrollLeft = 0;
      };
      img.src = url;
    }
    async function openDialog() {
      if (!(await askSave())) return;
      let chosen = null;
      const b = el('<div><div style="margin-bottom:4px">Saved pictures:</div><div class="pt-files bevel-in"></div><label style="margin-top:6px">File name: <input class="field pt-fn" style="flex:1;width:auto"></label></div>');
      const list = b.querySelector('.pt-files'), fn = b.querySelector('.pt-fn');
      const render = () => {
        list.innerHTML = ''; const all = files(), names = Object.keys(all).sort((a, c) => all[c].t - all[a].t);
        if (!names.length) list.appendChild(el('<div style="padding:6px">No saved pictures yet. Use File ▸ Save.</div>'));
        names.forEach(n => {
          const it = el(`<button><img alt=""><span></span></button>`); it.querySelector('img').src = all[n].url; it.querySelector('span').textContent = `${n}  (${all[n].w}x${all[n].h})`;
          it.onclick = () => { chosen = n; fn.value = n; list.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === it)); };
          it.ondblclick = () => { chosen = n; b.closest('.modal-veil').querySelector('.actions button').click(); };
          list.appendChild(it);
        });
      };
      render();
      const r = await modal('Open', b, ['Open', 'Delete', 'Cancel'], () => true);
      const name = (fn.value || chosen || '').trim();
      if (r === 'Delete' && name && files()[name]) {
        const ok = await Arcade.dialog({ title: 'Paint', icon: 'warn', text: `Delete ${name}?`, buttons: ['Yes', 'No'] });
        if (ok === 'Yes') { const all = files(); delete all[name]; S.set('files', all); if (fileName === name) { fileName = null; updateTitle(); } }
        return openDialog();
      }
      if (r !== 'Open' || !name) return;
      const f = files()[name];
      if (!f) return Arcade.dialog({ title: 'Open', icon: 'error', text: `${name}\nFile not found.\nPlease verify the correct file name was given.` });
      loadURL(f.url, name);
    }
    async function newImage() {
      if (!(await askSave())) return;
      finishOps(); if (sel) dropSel();
      cv.width = ov.width = W = 400; cv.height = ov.height = H = 300; g = c2d(cv); og = c2d(ov);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
      undoS = []; redoS = []; dirty = false; fileName = null; zoom = 1; layout(); updateTitle();
    }
    function setWallpaper(mode) {
      const url = snapshotURL(), wp = { url, mode };
      applyWallpaper(wp);
      S.set('wallpaper', wp);
      Arcade.store.set('theme', { ...Arcade.store.get('theme', {}), wallpaper: '(Paint)' });
      const back = S.get('wallpaper', null);
      if (!back || back.url !== url) Arcade.dialog({ title: 'Paint', icon: 'warn', text: 'The wallpaper is set for now, but the picture is too large to remember after a reload.' });
    }
    function help() {
      Arcade.dialog({ title: 'Paint Help', icon: 'info', text: 'Left button draws with the foreground color, right button with the background color. Click a palette color to pick it (right-click for background), double-click to edit it. Curve: drag a line, then click twice to bend it. Polygon: drag the first side, click each corner, double-click to finish. Hold Shift for straight lines, squares and circles. Drag a selection to move it; Ctrl-drag stamps a copy, Shift-drag smears it.' });
    }

    /* --- close prompt --- */
    let closing = false;
    ctx.on('close', () => {
      finishOps(); commitSel(); clearInterval(airT); drag = null;
      if (!dirty || closing) { closing = false; return; }
      setTimeout(async () => {
        Arcade.open('paint');
        const r = await Arcade.dialog({ title: 'Paint', icon: 'warn', text: `Save changes to ${displayName()}?`, buttons: ['Yes', 'No', 'Cancel'] });
        if (r === 'Cancel' || r === null) return;
        if (r === 'Yes' && !(await save())) return;
        if (r === 'No') dirty = false;
        closing = true; ctx.close();
      }, 0);
    });

    /* --- keyboard --- */
    let pasteTimer = 0;
    ctx.onKey(e => {
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && k === 'n') { e.preventDefault(); clearImage(); return; }
      if (mod) {
        const map = { z: undo, y: redo, x: cut, c: copy, l: selectAll, s: save, o: openDialog, e: attrDialog, r: flipDialog, i: invert, g: () => toggle('grid'), f: viewBitmap, t: () => toggle('tools'), a: () => toggle('colors'), w: stretchDialog, n: newImage };
        if (k === 'v') { pasteSeen = false; clearTimeout(pasteTimer); pasteTimer = setTimeout(() => { if (!pasteSeen && clip) pasteCanvas(clip); }, 80); return; }
        if (k === 'pageup') { e.preventDefault(); setZoom(1); return; }
        if (k === 'pagedown') { e.preventDefault(); setZoom(4); return; }
        if (map[k]) { e.preventDefault(); map[k](); }
        return;
      }
      if (k === 'f4') { e.preventDefault(); redo(); }
      else if (k === 'delete') { e.preventDefault(); clearSel(); }
      else if (k === 'escape') {
        if (drag) { drag = null; og.clearRect(0, 0, W, H); clearInterval(airT); }
        else if (curve || poly) { curve = poly = null; og.clearRect(0, 0, W, H); }
        else if (sel) commitSel();
      } else if (k === 'enter' && poly) finishPoly();
    });
    function invert() { applyOp(invertC); }
    function toggle(what) {
      vis[what] = !vis[what];
      toolsEl.hidden = !vis.tools; colorsEl.hidden = !vis.colors;
      const sb = ctx.win.querySelector('.statusbar'); if (sb) sb.hidden = !vis.status;
      fontBar.hidden = !(tool === 'text' && vis.font);
      layout();
    }

    /* --- init --- */
    resizeCanvas(400, 300, false); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    renderColors(); syncFont(); tool = ''; setTool('pencil');

    return {
      vis, tool: () => tool, zoom: () => zoom, opaque: () => opt.opaque, setOpaque: o => setOpaque(o),
      canUndo: () => undoS.length > 0 || !!sel, canRedo: () => redoS.length > 0, hasSel: () => !!sel,
      newImage, openDialog, save, saveAs, saveDisk, setWallpaper, undo, redo, cut, copy, pasteMenu, clearSel, selectAll, toggle,
      setZoom: z => setZoom(z), zoomDialog, viewBitmap, flipDialog, stretchDialog, invert, attrDialog, clearImage, editColors: () => { if (palette.indexOf(fg) >= 0) editSlot = palette.indexOf(fg); editColors(); }, help
    };
  }
})();

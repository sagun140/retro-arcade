/* Cards95: shared playing-card kit for Solitaire and FreeCell.
   Original 71x96 card faces (vector pips, pixel-art court figures), pixel-art card backs,
   seeded shuffles, the classic Microsoft FreeCell deal, a DPR-aware canvas surface,
   pointer input with drag/double-click detection, and a Win95 modal helper.
   Exposes exactly one global: window.Cards95. */
(() => {
  const CW = 71, CH = 96;
  const SUITS = ['C', 'D', 'H', 'S'];            // Microsoft order: clubs, diamonds, hearts, spades
  const SUIT_NAMES = ['Clubs', 'Diamonds', 'Hearts', 'Spades'];
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RED = '#d01c1c', BLACK = '#101014';
  const isRed = c => c.s === 1 || c.s === 2;
  const name = c => RANKS[c.r] + SUITS[c.s];

  Arcade.css(`
    .c95-modal { min-width: 280px; }
    .c95-mbody { padding: 10px 12px 6px; }
    .c95-mbody label { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
    .c95-mbody .groupbox { margin: 0 0 8px; }
    .c95-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .c95-row > * { flex: 1 1 120px; }
    .c95-backs { display: grid; grid-template-columns: repeat(auto-fill, 64px); gap: 8px; justify-content: center; padding: 6px; background: var(--window); max-width: 320px; }
    .c95-backs button { border: 0; padding: 3px; background: none; display: grid; place-items: center; }
    .c95-backs button canvas { width: 50px; height: 68px; display: block; }
    .c95-backs button.on { background: var(--sel); outline: 1px dotted var(--sel-ink); }
    .c95-cap { text-align: center; margin-top: 4px; min-height: 1.4em; }
    .c95-help p { margin: 0 0 7px; max-width: 46ch; }
  `);

  /* ---------- deck, shuffles, deals ---------- */
  const deck = () => { const d = []; for (let r = 1; r <= 13; r++) for (let s = 0; s < 4; s++) d.push({ s, r, up: false }); return d; };
  function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, seed = (Math.random() * 2 ** 32) >>> 0) {
    const r = rng(seed);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  /* The Microsoft FreeCell deal: MSVC rand() LCG, deck 51..0 swapped from the end, dealt row by row into 8 columns. */
  function msDeal(n) {
    let seed = n >>> 0;
    const rnd = () => { seed = (seed * 214013 + 2531011) % 2147483648; return Math.floor(seed / 65536); };
    const cards = []; for (let i = 51; i >= 0; i--) cards.push(i);
    for (let i = 0; i < 52; i++) { const j = 51 - rnd() % (52 - i); const t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    const cols = [[], [], [], [], [], [], [], []];
    cards.forEach((c, i) => cols[i % 8].push({ s: c % 4, r: (c >> 2) + 1, up: true }));
    return cols;
  }

  /* ---------- drawing primitives ---------- */
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  const PATHS = [
    g => { // club
      [[0, -.24], [-.25, .06], [.25, .06]].forEach(([x, y]) => { g.moveTo(x + .23, y); g.arc(x, y, .23, 0, Math.PI * 2); });
      g.moveTo(0, -.05); g.lineTo(.07, .3); g.quadraticCurveTo(.1, .45, .22, .5); g.lineTo(-.22, .5); g.quadraticCurveTo(-.1, .45, -.07, .3); g.closePath();
    },
    g => { // diamond
      g.moveTo(0, -.5); g.quadraticCurveTo(.13, -.15, .4, 0); g.quadraticCurveTo(.13, .15, 0, .5);
      g.quadraticCurveTo(-.13, .15, -.4, 0); g.quadraticCurveTo(-.13, -.15, 0, -.5); g.closePath();
    },
    g => { // heart
      g.moveTo(0, .47); g.bezierCurveTo(-.15, .3, -.5, .1, -.5, -.15); g.bezierCurveTo(-.5, -.36, -.35, -.46, -.22, -.46);
      g.bezierCurveTo(-.1, -.46, -.02, -.38, 0, -.27); g.bezierCurveTo(.02, -.38, .1, -.46, .22, -.46);
      g.bezierCurveTo(.35, -.46, .5, -.36, .5, -.15); g.bezierCurveTo(.5, .1, .15, .3, 0, .47); g.closePath();
    },
    g => { // spade
      g.moveTo(0, -.5); g.bezierCurveTo(-.15, -.32, -.5, -.12, -.5, .1); g.bezierCurveTo(-.5, .28, -.36, .36, -.24, .36);
      g.bezierCurveTo(-.13, .36, -.06, .3, -.03, .22); g.bezierCurveTo(-.04, .35, -.1, .45, -.22, .5); g.lineTo(.22, .5);
      g.bezierCurveTo(.1, .45, .04, .35, .03, .22); g.bezierCurveTo(.06, .3, .13, .36, .24, .36);
      g.bezierCurveTo(.36, .36, .5, .28, .5, .1); g.bezierCurveTo(.5, -.12, .15, -.32, 0, -.5); g.closePath();
    }
  ];
  function pip(g, s, cx, cy, sz, flip, color) {
    g.save(); g.translate(cx, cy); if (flip) g.rotate(Math.PI); g.scale(sz, sz);
    g.fillStyle = color || (s === 1 || s === 2 ? RED : BLACK);
    g.beginPath(); PATHS[s](g); g.fill(); g.restore();
  }

  /* pip layouts in the 71x96 card: L/M/R columns, rows top..bottom; pips below the middle are drawn upside down */
  const L = 23.5, M = 35.5, R = 47.5, T = 19, B = 77, MID = 48;
  const LAYOUT = {
    2: [[M, T], [M, B]], 3: [[M, T], [M, MID], [M, B]],
    4: [[L, T], [R, T], [L, B], [R, B]],
    5: [[L, T], [R, T], [M, MID], [L, B], [R, B]],
    6: [[L, T], [R, T], [L, MID], [R, MID], [L, B], [R, B]],
    7: [[L, T], [R, T], [M, 33.5], [L, MID], [R, MID], [L, B], [R, B]],
    8: [[L, T], [R, T], [M, 33.5], [L, MID], [R, MID], [M, 62.5], [L, B], [R, B]],
    9: [[L, T], [R, T], [L, 38.3], [R, 38.3], [M, MID], [L, 57.7], [R, 57.7], [L, B], [R, B]],
    10: [[L, T], [R, T], [M, 28.7], [L, 38.3], [R, 38.3], [L, 57.7], [R, 57.7], [M, 67.3], [L, B], [R, B]]
  };

  /* court figures: 15x12 half-portraits, mirrored top/bottom like a real double-headed card */
  const COURT = {
    13: ['....y.y.y.y....', '....yyyyyyy....', '....yayayay....', '...hsssssssh...', '...hsksssksh...', '...hsssssssh...',
      '...hwsmmmswh...', '....wwwwwww....', '..aaawwwwwaaa..', '.aaabbwwwbbaaa.', '.aaabbbybbbaaa.', 'yaaabbbybbbaaay'],
    12: ['......yyy......', '.....yayay.....', '....hhhhhhh....', '...hhssssshh...', '...hsksssksh...', '...hsssssssh...',
      '...hssmmmssh...', '...hhhsssshhh..', '..hhaawwwaahh..', '..haaabwbaaah..', '.aaaabbybbaaaa.', 'aaaabbbybbbaaaa'],
    11: ['....bbbbbb.y...', '...bbbbbbbbyy..', '...aaaaaaaa....', '...hsssssssh...', '...hsksssksh...', '...hsssssssh...',
      '....ssmmmss....', '.....sssss.....', '..bbbawwwabbb..', '.bbbaawywaabbb.', '.bbbaaayaaabbb.', 'bbbbaaayaaabbbb']
  };
  const HAIR = { 13: '#9a9aa2', 12: '#e3a800', 11: '#7a4a12' };
  function court(g, c) {
    const red = isRed(c);
    const pal = { y: '#e8b400', k: '#101014', s: '#f6c79a', m: '#c0302a', w: '#f4f4f4',
      a: red ? '#cf2222' : '#1d3fbf', b: red ? '#1d3fbf' : '#cf2222', h: HAIR[c.r] };
    const fx = 13, fy = 11, ps = 3;
    g.fillStyle = '#fffbea'; g.fillRect(fx, fy, 45, 74);
    const half = () => {
      COURT[c.r].forEach((row, y) => { for (let x = 0; x < 15; x++) { const ch = row[x]; if (ch !== '.' && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(fx + x * ps, fy + y * ps, ps + .05, ps + .05); } } });
      pip(g, c.s, fx + 5, fy + 5, 7);
    };
    half();
    g.save(); g.translate(CW, CH); g.rotate(Math.PI); half(); g.restore();
    g.fillStyle = red ? RED : BLACK; g.fillRect(fx, MID - .4, 45, .8);
    g.strokeStyle = red ? RED : '#1d3fbf'; g.lineWidth = .9; g.strokeRect(fx, fy, 45, 74);
  }

  function index(g, c) {
    g.fillStyle = isRed(c) ? RED : BLACK;
    g.font = 'bold 12px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.save(); g.translate(8, 3.5); if (c.r === 10) g.scale(.74, 1); g.fillText(RANKS[c.r], 0, 0); g.restore();
    pip(g, c.s, 8, 22, 8.5);
  }

  function face(g, c) {
    index(g, c);
    g.save(); g.translate(CW, CH); g.rotate(Math.PI); index(g, c); g.restore();
    if (c.r === 1) {
      if (c.s === 3) { pip(g, 3, M, MID, 34); pip(g, 3, M, MID + 1, 11, false, '#fff'); pip(g, 3, M, MID + 1, 7); }
      else pip(g, c.s, M, MID, 22);
    } else if (c.r <= 10) LAYOUT[c.r].forEach(([x, y]) => pip(g, c.s, x, y, 14, y > MID));
    else court(g, c);
  }

  /* ---------- card backs (pixel art on a 32x44 grid, 2 units per pixel) ---------- */
  const BACKS = [
    { id: 'fish', name: 'Fish', draw(p) {
      p(0, 0, 32, 44, '#2a6fd6'); for (let y = 2; y < 42; y += 6) p(0, y, 32, 1, '#3a82e6');
      p(0, 41, 32, 3, '#e8cf8a'); p(5, 42, 2, 1, '#cdb06a'); p(20, 43, 3, 1, '#cdb06a');
      [3, 10, 24, 28].forEach((x, i) => { for (let y = 32 + i % 2 * 2; y < 42; y++) p(x + ((y >> 1) % 2), y, 1, 1, '#1f9e3a'); });
      const fish = (x, y, c, d) => {
        const X = v => d ? x + 9 - v : x + v;
        [[2, 5], [1, 7], [0, 8], [1, 7], [2, 5]].forEach(([a, w], r) => p(d ? X(a + w - 1) : X(a), y + r, w, 1, c));
        p(X(8), y + 1, 1, 3, c); p(X(9), y, 1, 5, c); p(X(5), y + 1, 1, 3, '#fff'); p(X(2), y + 1, 1, 1, '#101014');
      };
      fish(4, 7, '#ff8a1a', 0); fish(17, 17, '#ffd23f', 1); fish(5, 27, '#ff5a6e', 0);
      [[3, 4], [2, 2], [16, 13], [17, 11], [26, 25], [27, 23], [26, 21]].forEach(([x, y]) => p(x, y, 1, 1, '#cfe9ff'));
    } },
    { id: 'castle', name: 'Castle', draw(p) {
      p(0, 0, 32, 44, '#121a52');
      [[2, 3], [7, 7], [12, 2], [18, 6], [29, 9], [4, 12], [27, 15], [1, 20], [30, 22]].forEach(([x, y]) => p(x, y, 1, 1, '#ffe98a'));
      p(23, 2, 4, 4, '#fff6c0'); p(22, 3, 1, 2, '#fff6c0'); p(25, 2, 2, 2, '#121a52');
      p(0, 37, 32, 7, '#1f7a2e'); p(0, 36, 6, 1, '#1f7a2e'); p(26, 36, 6, 1, '#1f7a2e');
      p(9, 22, 14, 15, '#a3a3b0'); p(20, 22, 3, 15, '#80808c');
      p(4, 15, 6, 22, '#b4b4c0'); p(22, 15, 6, 22, '#b4b4c0'); p(8, 15, 2, 22, '#80808c'); p(26, 15, 2, 22, '#80808c');
      [4, 6, 8, 22, 24, 26].forEach(x => p(x, 13, 1, 2, '#b4b4c0'));
      [9, 11, 13, 15, 17, 19, 21].forEach(x => p(x, 20, 1, 2, '#a3a3b0'));
      p(12, 15, 8, 7, '#b4b4c0'); [12, 14, 16, 18].forEach(x => p(x, 13, 1, 2, '#b4b4c0'));
      p(16, 6, 1, 7, '#555'); p(17, 6, 4, 2, '#e02020'); p(17, 8, 2, 1, '#e02020');
      p(6, 19, 2, 3, '#ffd23f'); p(24, 19, 2, 3, '#ffd23f'); p(15, 17, 2, 2, '#ffd23f'); p(11, 25, 2, 2, '#ffd23f'); p(19, 25, 2, 2, '#ffd23f');
      p(14, 30, 4, 7, '#3a2412'); p(15, 29, 2, 1, '#3a2412');
    } },
    { id: 'robot', name: 'Robot', draw(p) {
      p(0, 0, 32, 44, '#5b2a8c'); for (let i = 0; i < 44; i += 4) p(0, i, 32, 1, '#6c38a4'); for (let i = 0; i < 32; i += 4) p(i, 0, 1, 44, '#6c38a4');
      p(15, 3, 2, 4, '#bbbbc4'); p(14, 1, 4, 2, '#ff3d3d');
      p(8, 7, 16, 11, '#c8ccd6'); p(8, 16, 16, 2, '#9aa0ad');
      p(11, 10, 3, 3, '#ff3d3d'); p(18, 10, 3, 3, '#ff3d3d'); p(11, 10, 1, 1, '#ffd0d0'); p(18, 10, 1, 1, '#ffd0d0');
      p(12, 14, 8, 1, '#333340'); [13, 15, 17].forEach(x => p(x, 14, 1, 1, '#c8ccd6'));
      p(14, 18, 4, 2, '#888892');
      p(6, 20, 20, 14, '#c8ccd6'); p(6, 32, 20, 2, '#9aa0ad'); p(10, 23, 12, 7, '#2a2a3a');
      p(11, 24, 2, 2, '#3fe03f'); p(15, 24, 2, 2, '#ffe23f'); p(19, 24, 2, 2, '#ff4a4a'); p(12, 28, 8, 1, '#22d0ff');
      p(2, 21, 4, 10, '#9aa0ad'); p(26, 21, 4, 10, '#9aa0ad'); p(1, 31, 2, 2, '#77777f'); p(4, 31, 2, 2, '#77777f'); p(26, 31, 2, 2, '#77777f'); p(29, 31, 2, 2, '#77777f');
      p(9, 34, 5, 7, '#9aa0ad'); p(18, 34, 5, 7, '#9aa0ad'); p(8, 41, 7, 2, '#5f5f68'); p(17, 41, 7, 2, '#5f5f68');
    } },
    { id: 'beach', name: 'Beach', draw(p) {
      p(0, 0, 32, 22, '#7fd0ff'); p(0, 0, 32, 4, '#62bdf4');
      p(22, 3, 6, 6, '#ffd23f'); p(21, 4, 8, 4, '#ffd23f'); p(23, 2, 4, 8, '#ffd23f');
      p(3, 6, 7, 2, '#fff'); p(5, 5, 3, 1, '#fff'); p(13, 11, 5, 1, '#fff'); p(14, 10, 2, 1, '#fff');
      p(0, 21, 32, 8, '#1f78d6'); [[2, 22], [9, 24], [19, 23], [26, 26], [5, 27], [14, 26]].forEach(([x, y]) => p(x, y, 3, 1, '#bfe6ff'));
      p(0, 29, 32, 15, '#f2d68a'); [[3, 33], [12, 38], [22, 35], [27, 41], [7, 42], [17, 31]].forEach(([x, y]) => p(x, y, 1, 1, '#d4b462'));
      for (let i = 0; i < 24; i++) p(9 + Math.round(Math.sin(i / 8) * 2 + i / 7), 40 - i, 2, 1, i % 3 ? '#8a5a2b' : '#6b431c');
      const tx = 12, ty = 16;
      [[-8, 1], [-6, 0], [-4, -1], [-2, -1], [1, -1], [3, -1], [5, 0], [7, 1], [-7, 2], [8, 2], [-1, -2], [0, -2]].forEach(([dx, dy]) => p(tx + dx, ty + dy, 2, 1, '#1f9e3a'));
      [[-5, -2], [-3, -3], [2, -3], [4, -2], [-9, 3], [9, 3]].forEach(([dx, dy]) => p(tx + dx, ty + dy, 2, 1, '#2fc24f'));
      p(tx, ty, 2, 2, '#6b431c');
      p(20, 30, 9, 1, '#e02020'); p(21, 29, 7, 1, '#fff'); p(23, 28, 3, 1, '#e02020'); p(24, 31, 1, 7, '#555');
      p(5, 34, 3, 3, '#ff6a2a'); p(6, 34, 1, 3, '#fff');
    } },
    { id: 'weave', name: 'Lattice', draw(p) {
      p(0, 0, 32, 44, '#1d3fa8');
      for (let y = 0; y < 44; y++) for (let x = 0; x < 32; x++) if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) p(x, y, 1, 1, (x + y) % 8 === 0 ? '#c8d6ff' : '#6f8fe8');
    } },
    { id: 'plaid', name: 'Tartan', draw(p) {
      p(0, 0, 32, 44, '#b01e1e');
      for (let x = 0; x < 32; x += 8) { p(x + 2, 0, 3, 44, '#7a1010'); p(x + 6, 0, 1, 44, '#1b2a6a'); }
      for (let y = 0; y < 44; y += 8) { p(0, y + 2, 32, 3, 'rgba(60,0,0,.45)'); p(0, y + 6, 32, 1, '#e8c440'); }
    } }
  ];
  const backById = id => BACKS.find(b => b.id === id) || BACKS[0];
  let backId = Arcade.store.get('cards.back', 'fish');
  const backListeners = new Set();

  function back(g, id) {
    g.save(); rrect(g, 4, 4, 63, 88, 2); g.clip();
    const p = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(4 + x * 2 - .5, 4 + y * 2, w * 2 + .05, h * 2 + .05); };
    backById(id).draw(p);
    g.restore();
  }

  /* ---------- cached card images ---------- */
  const cache = new Map();
  function image(c, pw, ph, bid) {
    pw = Math.max(8, Math.round(pw)); ph = Math.max(10, Math.round(ph));
    const up = c && c.up !== false;
    const key = (up ? name(c) : 'back:' + (bid || backId)) + '@' + pw + 'x' + ph;
    let cv = cache.get(key);
    if (cv) return cv;
    if (cache.size > 400) cache.clear();
    cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
    const g = cv.getContext('2d'), sx = pw / CW, sy = ph / CH;
    g.scale(sx, sy);
    const lw = 1 / sx, h = lw / 2;
    rrect(g, h, h, CW - lw, CH - lw, 3.5); g.fillStyle = '#fff'; g.fill();
    if (up) face(g, c); else back(g, bid || backId);
    rrect(g, h, h, CW - lw, CH - lw, 3.5); g.strokeStyle = '#000'; g.lineWidth = lw; g.stroke();
    cache.set(key, cv);
    return cv;
  }

  /* ---------- canvas surface: design units -> device pixels ---------- */
  function surface(host, W, H, maxK = 1.6) {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(cv);
    const S = {
      cv, g: cv.getContext('2d'), W, H, k: 1, ox: 0, oy: 0, dpr: 1, cw: 1, ch: 1, vx0: 0, vx1: W, vy1: H,
      X: x => Math.round((S.ox + x * S.k) * S.dpr),
      Y: y => Math.round((S.oy + y * S.k) * S.dpr),
      D: v => Math.round(v * S.k * S.dpr),
      local(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - S.ox) / S.k, y: (e.clientY - r.top - S.oy) / S.k }; },
      fit() {
        const cw = Math.max(1, host.clientWidth), ch = Math.max(1, host.clientHeight), dpr = Math.min(3, window.devicePixelRatio || 1);
        const k = Math.min(cw / W, ch / H, maxK);
        const changed = cw !== S.cw || ch !== S.ch || dpr !== S.dpr || k !== S.k;
        Object.assign(S, { cw, ch, dpr, k, ox: Math.max(0, (cw - W * k) / 2), oy: 0 });
        S.vx0 = -S.ox / k; S.vx1 = (cw - S.ox) / k; S.vy1 = ch / k;
        if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
        return changed;
      },
      card(c, x, y, bid) { S.g.drawImage(image(c, S.D(CW), S.D(CH), bid), S.X(x), S.Y(y)); },
      fill(color) { S.g.fillStyle = color; S.g.fillRect(0, 0, cv.width, cv.height); }
    };
    S.fit();
    return S;
  }

  /* ---------- pointer input: press / drag (4px threshold) / click / double-click / right-click ---------- */
  function input(S, h) {
    const cv = S.cv; let press = null, last = { t: 0, x: 0, y: 0 };
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (press) return;
      try { cv.setPointerCapture(e.pointerId); } catch {}
      const p = S.local(e);
      press = { id: e.pointerId, sx: e.clientX, sy: e.clientY, p, drag: false, grab: h.down ? h.down(p, e) : null };
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = S.local(e);
      if (h.hover) h.hover(p, e);
      if (!press || press.id !== e.pointerId) return;
      if (!press.drag && press.grab && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 4) { press.drag = true; if (h.dragStart) h.dragStart(press.grab, press.p); }
      if (press.drag && h.drag) h.drag(p, press.grab);
    });
    const up = (e, cancel) => {
      if (!press || press.id !== e.pointerId) return;
      const pr = press; press = null;
      const p = S.local(e);
      if (pr.drag) { if (h.drop) h.drop(p, pr.grab, cancel); return; }
      if (cancel) { if (h.release) h.release(pr.grab); return; }
      if (h.release) h.release(pr.grab);
      const now = e.timeStamp || performance.now(), dbl = now - last.t < 450 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 16;
      last = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
      if (dbl && h.dbl) h.dbl(pr.p, e); else if (h.click) h.click(pr.p, e);
    };
    cv.addEventListener('pointerup', e => up(e, false));
    cv.addEventListener('pointercancel', e => up(e, true));
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (h.context) h.context(S.local(e)); });
  }

  /* ---------- Win95 modal with custom body ---------- */
  function modal({ title = 'Arcade 95', html = '', buttons = ['OK', 'Cancel'], init }) {
    return new Promise(resolve => {
      const veil = Arcade.el(`<div class="modal-veil"><div class="win msgbox bevel-out active c95-modal" role="dialog">
        <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
        <div class="c95-mbody"></div><div class="actions"></div></div></div>`);
      veil.querySelector('.ttl span').textContent = title;
      const body = veil.querySelector('.c95-mbody'); body.innerHTML = html;
      const done = b => { veil.remove(); resolve({ button: b, el: body }); };
      buttons.forEach((b, i) => {
        const bt = Arcade.el('<button class="btn"></button>'); bt.textContent = b; bt.onclick = () => done(b);
        veil.querySelector('.actions').appendChild(bt); if (i === 0) setTimeout(() => bt.focus(), 0);
      });
      veil.querySelector('[data-act="close"]').onclick = () => done(null);
      veil.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !(e.target.tagName === 'BUTTON' && e.target.closest('.actions'))) { e.preventDefault(); done(buttons[0]); }
        else if (e.key === 'Escape') done(null);
        e.stopPropagation();
      });
      veil.style.zIndex = 20000;
      (document.getElementById('desktop') || document.body).appendChild(veil);
      if (init) init(body, done);
    });
  }

  async function pickBack() {
    let sel = backId;
    const r = await modal({
      title: 'Select Card Back', buttons: ['OK', 'Cancel'],
      html: '<div class="c95-backs bevel-in"></div><div class="c95-cap"></div>',
      init(body, done) {
        const grid = body.querySelector('.c95-backs'), cap = body.querySelector('.c95-cap');
        BACKS.forEach(b => {
          const bt = Arcade.el('<button type="button"></button>'); bt.title = b.name; bt.setAttribute('aria-label', b.name);
          const cv = image({ up: false }, 100, 136, b.id); const c2 = document.createElement('canvas'); c2.width = 100; c2.height = 136;
          c2.getContext('2d').drawImage(cv, 0, 0); bt.appendChild(c2);
          const mark = () => { grid.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === bt)); cap.textContent = b.name; sel = b.id; };
          if (b.id === sel) setTimeout(mark, 0);
          bt.onclick = mark; bt.ondblclick = () => { mark(); done('OK'); };
          grid.appendChild(bt);
        });
      }
    });
    if (r.button !== 'OK') return null;
    setBack(sel);
    return sel;
  }
  function setBack(id) { backId = backById(id).id; Arcade.store.set('cards.back', backId); backListeners.forEach(f => f(backId)); }

  window.Cards95 = {
    CW, CH, SUITS, SUIT_NAMES, RANKS, isRed, name, deck, rng, shuffle, msDeal,
    image, pip, rrect, surface, input, modal, pickBack, BACKS,
    getBack: () => backId, setBack, onBack: f => backListeners.add(f)
  };
})();

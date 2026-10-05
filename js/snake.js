/* Snake 98: shareware-style Snake with maze levels, golden bonus food and smooth interpolated movement. */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="0" width="16" height="16" fill="#0e2416"/><rect x="2" y="11" width="9" height="3" fill="#4e9a1e"/><rect x="2" y="11" width="9" height="2" fill="#7bd23a"/><rect x="2" y="6" width="3" height="6" fill="#7bd23a"/><rect x="2" y="5" width="7" height="3" fill="#7bd23a"/><rect x="7" y="2" width="4" height="5" fill="#8ee04a"/><rect x="8" y="3" width="1" height="1" fill="#fff"/><rect x="10" y="3" width="1" height="1" fill="#fff"/><rect x="11" y="5" width="2" height="1" fill="#e8262b"/><rect x="12" y="10" width="3" height="3" fill="#e8262b"/><rect x="12" y="10" width="1" height="1" fill="#fff"/><rect x="13" y="9" width="1" height="1" fill="#5a3a12"/></svg>';
  const W = 30, H = 20, C = 20, B = 8, LW = W * C + 2 * B, LH = H * C + 2 * B, R = 8;
  const APPLES_PER_LEVEL = 8, BONUS_LIFE = 6;
  const SPEEDS = [{ name: 'Slow', ms: 150 }, { name: 'Normal', ms: 115 }, { name: 'Fast', ms: 85 }];
  const PIX = '"Silkscreen", "Courier New", monospace', BIG = '"Press Start 2P", "Courier New", monospace', UI = 'Tahoma, "MS Sans Serif", Verdana, sans-serif';
  const store = { get: (k, d) => Arcade.store.get('snake.' + k, d), set: (k, v) => Arcade.store.set('snake.' + k, v) };
  const COL = { body: '#7bd23a', head: '#8ee04a', mark: '#4e9a1e', line: '#173d0b', hi: '#d8ff9a' };
  const FLASH = { body: '#ffffff', head: '#ffffff', mark: '#ff4040', line: '#7a0000', hi: '#ffffff' };
  const api = {};

  /* Levels: walls given as horizontal/vertical runs or rects; spawn = [x, y, dx, dy]. */
  const LEVELS = [
    { name: 'Open Field', spawn: [8, 10, 1, 0], build() {} },
    { name: 'Two Bars', spawn: [8, 10, 1, 0], build(h) { h(6, 23, 5); h(6, 23, 14); } },
    { name: 'Crossroads', spawn: [6, 1, 1, 0], build(h, v) { v(15, 2, 7); v(15, 12, 17); h(3, 11, 10); h(19, 26, 10); } },
    { name: 'The Box', spawn: [8, 10, 1, 0], build(h, v) { h(5, 12, 4); h(17, 24, 4); h(5, 12, 15); h(17, 24, 15); v(5, 4, 7); v(5, 12, 15); v(24, 4, 7); v(24, 12, 15); } },
    { name: 'Pillars', spawn: [8, 12, 1, 0], build(h, v, r) { for (const x of [5, 11, 17, 23]) for (const y of [4, 9, 14]) r(x, y, 2, 2); } },
    { name: 'Zigzag', spawn: [2, 4, 0, 1], build(h, v) { v(6, 0, 13); v(12, 6, 19); v(18, 0, 13); v(24, 6, 19); } }
  ];
  function wallGrid(i) {
    const g = new Uint8Array(W * H);
    const set = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y * W + x] = 1; };
    LEVELS[i].build((x0, x1, y) => { for (let x = x0; x <= x1; x++) set(x, y); }, (x, y0, y1) => { for (let y = y0; y <= y1; y++) set(x, y); },
      (x, y, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, y + j); });
    return g;
  }

  /* ---------- shared drawing (game + hover preview) ---------- */
  // pts: polyline in pixels, head first. r: body radius.
  function drawSnake(g, pts, r, col, t, tongue) {
    const step = Math.max(1.5, r / 3), smp = [[pts[0][0], pts[0][1], 0]];
    let carry = 0, s = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!len) continue;
      let d = step - carry;
      while (d <= len) { smp.push([a[0] + (b[0] - a[0]) * d / len, a[1] + (b[1] - a[1]) * d / len, s + d]); d += step; }
      carry = len - (d - step); s += len;
    }
    const lp = pts[pts.length - 1]; smp.push([lp[0], lp[1], s]);
    const total = Math.max(s, 1), rad = q => { const u = q / total; return u < .55 ? r : r * (1 - .6 * (u - .55) / .45); };
    const circles = (fill, f) => { g.fillStyle = fill; g.beginPath(); for (let i = smp.length - 1; i >= 0; i--) { const p = smp[i], rr = f(p, rad(p[2])); if (rr > 0) { g.moveTo(p[0] + rr, p[1]); g.arc(p[0], p[1], rr, 0, 6.2832); } } g.fill(); };
    // full-width front as one round-joined stroke, tapered tail as short round-capped strokes
    let cut = smp.findIndex(p => p[2] / total >= .55); if (cut < 1) cut = smp.length - 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const body = (style, extra) => {
      g.strokeStyle = style;
      for (let i = smp.length - 1; i > cut; i--) { const a = smp[i], b = smp[i - 1]; g.lineWidth = 2 * rad(a[2]) + extra; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      g.lineWidth = 2 * r + extra; g.beginPath(); g.moveTo(smp[0][0], smp[0][1]); for (let i = 1; i <= cut; i++) g.lineTo(smp[i][0], smp[i][1]); g.stroke();
    };
    body(col.line, 3); body(col.body, 0);
    const band = r * 2.6;
    circles(col.mark, (p, rr) => (p[2] > r * 2 && (p[2] % band) < band * .32) ? rr * .55 : 0);
    g.globalAlpha = .45; g.save(); g.translate(-r * .32, -r * .32); circles(col.hi, (p, rr) => rr * .28); g.restore(); g.globalAlpha = 1;
    // head
    const [hx, hy] = pts[0]; let dx = 1, dy = 0;
    for (let i = 1; i < pts.length; i++) { const ex = hx - pts[i][0], ey = hy - pts[i][1], m = Math.hypot(ex, ey); if (m > .5) { dx = ex / m; dy = ey / m; break; } }
    const hr = r * 1.12, nx = -dy, ny = dx;
    if (tongue && Math.sin(t * 3.1) > .82) {
      const tx = hx + dx * hr, ty = hy + dy * hr, fl = Math.sin(t * 40) * 1.2;
      g.strokeStyle = '#ff2a4a'; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath();
      g.moveTo(tx, ty); g.lineTo(tx + dx * r * .7, ty + dy * r * .7);
      g.lineTo(tx + dx * r * 1.05 + nx * (2 + fl), ty + dy * r * 1.05 + ny * (2 + fl));
      g.moveTo(tx + dx * r * .7, ty + dy * r * .7); g.lineTo(tx + dx * r * 1.05 - nx * (2 - fl), ty + dy * r * 1.05 - ny * (2 - fl)); g.stroke();
    }
    g.fillStyle = col.line; g.beginPath(); g.arc(hx, hy, hr + 1.5, 0, 6.2832); g.fill();
    g.fillStyle = col.head; g.beginPath(); g.arc(hx, hy, hr, 0, 6.2832); g.fill();
    g.fillStyle = col.hi; g.globalAlpha = .5; g.beginPath(); g.arc(hx - hr * .35, hy - hr * .4, hr * .3, 0, 6.2832); g.fill(); g.globalAlpha = 1;
    for (const sd of [1, -1]) {
      const ex = hx + dx * r * .3 + nx * r * .52 * sd, ey = hy + dy * r * .3 + ny * r * .52 * sd;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, r * .38, 0, 6.2832); g.fill();
      g.fillStyle = '#101014'; g.beginPath(); g.arc(ex + dx * r * .16, ey + dy * r * .16, r * .2, 0, 6.2832); g.fill();
    }
  }
  function drawApple(g, x, y, s, gold) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const gr = g.createRadialGradient(-2, -2, 1, 0, 0, 8);
    if (gold) { gr.addColorStop(0, '#fff7c0'); gr.addColorStop(.5, '#ffd23f'); gr.addColorStop(1, '#b07800'); }
    else { gr.addColorStop(0, '#ff6a5a'); gr.addColorStop(.55, '#e8262b'); gr.addColorStop(1, '#8a0f14'); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(1, 7, 6, 2, 0, 0, 6.2832); g.fill();
    g.fillStyle = gr; g.beginPath(); g.arc(-2.6, 1, 5.6, 0, 6.2832); g.arc(2.6, 1, 5.6, 0, 6.2832); g.fill();
    g.fillStyle = '#5a3a12'; g.fillRect(-.7, -8, 1.6, 4.5);
    g.fillStyle = gold ? '#fff3a0' : '#3fbf3f'; g.beginPath(); g.ellipse(3.4, -6.2, 3.4, 1.6, -.5, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-4, -1.6, 1.4, 2.4, .5, 0, 6.2832); g.fill();
    g.restore();
  }

  /* ---------- hover preview: snake loops a Hamiltonian cycle on a 12x7 grid ---------- */
  const CYCLE = (() => {
    const p = [];
    for (let x = 0; x < 12; x++) p.push([x, 0]);
    for (let x = 11; x >= 1; x--) { const down = (11 - x) % 2 === 0; for (let k = 0; k < 6; k++) p.push([x, down ? 1 + k : 6 - k]); }
    for (let y = 6; y >= 1; y--) p.push([0, y]);
    return p;
  })();
  function preview(g, w, h, t) {
    const c = 16, ox = (w - 12 * c) / 2, oy = (h - 7 * c) / 2, N = CYCLE.length;
    g.fillStyle = '#0b1c11'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 12; x++) { g.fillStyle = (x + y) % 2 ? '#10291a' : '#0e2416'; g.fillRect(ox + x * c, oy + y * c, c, c); }
    const s = t * 7, k = Math.floor(s / 17), len = 4 + (k % 12);
    const at = q => { const i = ((Math.floor(q) % N) + N) % N, j = (i + 1) % N, f = q - Math.floor(q); return [ox + (CYCLE[i][0] + (CYCLE[j][0] - CYCLE[i][0]) * f + .5) * c, oy + (CYCLE[i][1] + (CYCLE[j][1] - CYCLE[i][1]) * f + .5) * c]; };
    const fi = ((k + 1) * 17) % N;
    drawApple(g, ox + (CYCLE[fi][0] + .5) * c, oy + (CYCLE[fi][1] + .5) * c, .8 + Math.sin(t * 6) * .05, k % 4 === 3);
    const pts = [at(s)];
    for (let i = Math.floor(s); i > s - len; i--) pts.push(at(i));
    pts.push(at(s - len));
    drawSnake(g, pts, 6, COL, t, true);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, 11);
    g.font = '8px ' + PIX; g.textBaseline = 'middle'; g.fillStyle = '#ff2a1a'; g.textAlign = 'left'; g.fillText('SCORE ' + String(k * 10).padStart(4, '0'), 4, 6);
    g.textAlign = 'right'; g.fillText('LEN ' + len, w - 4, 6);
  }

  /* ---------- high scores ---------- */
  const hiList = () => store.get('hi', []);
  Arcade.scores.add({
    game: 'Snake 98',
    render() {
      const l = hiList();
      let h = '<tr><th>#</th><th>Name</th><th>Score</th><th>Level</th></tr>';
      if (!l.length) return h + '<tr><td colspan="4">No scores yet.</td></tr>';
      l.forEach((e, i) => { h += `<tr><td>${i + 1}</td><td>${Arcade.esc(e.name)}</td><td class="num">${e.score}</td><td class="num">${e.level}</td></tr>`; });
      return h;
    }
  });

  Arcade.css(`
    .snk-top { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 4px 6px 6px; flex: none; }
    .snk-cell { display: flex; align-items: center; gap: 5px; font-size: 11px; }
    .snk-cell .lcd { font-size: 18px; min-width: 0; }
    .snk-field { background: #000; padding: 3px; flex: none; }
    .snk-field canvas { display: block; width: 100%; aspect-ratio: ${LW} / ${LH}; max-height: calc(100dvh - 190px); object-fit: contain; touch-action: none; background: #000; }
    .win.max .snk-field { flex: 1; min-height: 0; }
    .win.max .snk-field canvas { height: 100%; aspect-ratio: auto; max-height: none; }
    .snk-pad { display: grid; grid-template-columns: repeat(3, 54px); grid-template-rows: repeat(3, 44px); gap: 4px; justify-content: center; padding: 8px 0 4px; flex: none; touch-action: none; }
    .snk-pad button { border: 0; background: var(--face); font: 14px var(--pixel); color: var(--ink); touch-action: none; padding: 0;
      box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi2), inset -2px -2px var(--lo), inset 2px 2px var(--hi); }
    .snk-pad button.on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); }
    .snk-pad [data-d="up"] { grid-area: 1 / 2; } .snk-pad [data-d="left"] { grid-area: 2 / 1; } .snk-pad [data-d="p"] { grid-area: 2 / 2; font-size: 11px; }
    .snk-pad [data-d="right"] { grid-area: 2 / 3; } .snk-pad [data-d="down"] { grid-area: 3 / 2; }
    @media (pointer: coarse) { .snk-field canvas { max-height: calc(100dvh - 330px); } }
  `);

  const doNew = () => api.newGame && api.newGame();
  Arcade.app({
    id: 'snake', title: 'Snake 98', icon: ICON, width: 640, max: true, folder: 'Games', status: true, preview,
    hint: 'Shareware-era Snake: six maze levels, golden bonus apples, smooth moves.',
    menus: [
      { label: 'Game', items: [
        { label: 'New Game', key: 'F2', action: doNew },
        { label: 'Pause', key: 'P', action: () => api.pause && api.pause() },
        '-',
        ...SPEEDS.map((sp, i) => ({ label: 'Speed: ' + sp.name, radio: () => store.get('speed', 1) === i, action: () => api.speed && api.speed(i) })),
        '-',
        { label: 'Walls', checked: () => store.get('walls', true), action: () => api.walls && api.walls() },
        { label: 'Sound', checked: () => !Arcade.isMuted(), action: () => Arcade.setMuted(!Arcade.isMuted()) },
        '-',
        { label: 'Exit', action: () => Arcade.apps.snake.ctx.close() }
      ] },
      { label: 'Help', items: [{ label: 'How to play', action: () => api.help && api.help() }] }
    ],
    build(win) {
      const coarse = Arcade.coarse;
      win.body.innerHTML = `<div class="snk-top">
          <div class="snk-cell">Score <span class="lcd" data-v="score">00000</span></div>
          <div class="snk-cell">Length <span class="lcd" data-v="len">004</span></div>
          <div class="snk-cell">Level <span class="lcd" data-v="lvl">01</span></div>
          <div class="snk-cell">Hi <span class="lcd" data-v="hi">00000</span></div>
        </div>
        <div class="snk-field bevel-in"><canvas width="${LW}" height="${LH}" tabindex="0" aria-label="Snake 98 playfield"></canvas></div>
        ${coarse ? '<div class="snk-pad"><button data-d="up" aria-label="Up">▲</button><button data-d="left" aria-label="Left">◀</button><button data-d="p" aria-label="Pause">II</button><button data-d="right" aria-label="Right">▶</button><button data-d="down" aria-label="Down">▼</button></div>' : ''}`;
      const cv = win.body.querySelector('canvas'), g = cv.getContext('2d');
      const lcd = {}; win.body.querySelectorAll('[data-v]').forEach(e => { lcd[e.dataset.v] = e; });
      const beep = Arcade.beep;
      const sfx = {
        eat: () => { beep(523, .05, 'square', .04); beep(784, .07, 'square', .04, 0, .045); },
        bonusOn: () => { beep(1319, .05, 'triangle', .04); beep(1760, .07, 'triangle', .04, 0, .06); },
        bonus: () => [784, 988, 1175, 1568].forEach((f, i) => beep(f, .08, 'square', .035, 0, i * .055)),
        tick: () => beep(1046, .03, 'triangle', .025),
        level: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, .12, 'square', .035, 0, i * .09)),
        die: () => { beep(440, .5, 'sawtooth', .05, -380); beep(233, .7, 'square', .03, -170, .12); },
        start: () => { beep(392, .06, 'square', .03); beep(587, .08, 'square', .03, 0, .06); }
      };

      /* ---------- state ---------- */
      let state = 'ready', lvl = 0, loop = 0, walls = store.get('walls', true), speed = store.get('speed', 1);
      let grid, body, prevTail, dir, queue = [], grow = 0, food, bonus = null, eaten = null;
      let score = 0, apples = 0, levelApples = 0, acc = 0, t = 0, deathT = 0, levelT = 0, shake = 0, scattered = false;
      let parts = [], layer = null, k = 1;

      const free = (x, y) => !grid[y * W + x] && !body.some(c => c.x === x && c.y === y) && !(food && food.x === x && food.y === y) && !(bonus && bonus.x === x && bonus.y === y);
      function randFree() {
        const cells = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (free(x, y)) cells.push({ x, y });
        return cells.length ? cells[Math.random() * cells.length | 0] : null;
      }
      function loadLevel(i) {
        lvl = i; grid = wallGrid(i);
        const [sx, sy, dx, dy] = LEVELS[i].spawn;
        dir = { x: dx, y: dy }; queue = []; grow = 0; bonus = null; eaten = null; levelApples = 0;
        body = [0, 1, 2, 3].map(n => ({ x: sx - dx * n, y: sy - dy * n }));
        prevTail = { ...body[3] };
        food = null; food = randFree();
        layer = null; hud(); status();
      }
      function newGame() {
        score = 0; apples = 0; loop = 0; parts = []; shake = 0;
        loadLevel(0); state = 'ready'; hud(); status(); win.focus();
      }
      const tickMs = () => SPEEDS[speed].ms * Math.max(.5, 1 - (body.length - 4) * .01 - lvl * .03) * Math.pow(.9, loop);
      const levelNo = () => loop * LEVELS.length + lvl + 1;
      function startPlay() { if (state === 'ready') sfx.start(); state = 'play'; acc = tickMs(); status(); }

      function hud() {
        lcd.score.textContent = String(score).padStart(5, '0');
        lcd.len.textContent = String(body ? body.length : 4).padStart(3, '0');
        lcd.lvl.textContent = String(levelNo()).padStart(2, '0');
        const l = hiList(); lcd.hi.textContent = String(Math.max(score, l.length ? l[0].score : 0)).padStart(5, '0');
      }
      function status() {
        const s = { ready: 'Press an arrow key to start', play: coarse ? 'Swipe or use the pad to steer' : 'Arrows/WASD steer · P pause · F2 new game', paused: 'Paused - press P to resume', level: 'Get ready...', dying: 'Ouch!', over: 'Game over - F2 for a new game' }[state];
        win.status(coarse && state === 'ready' ? 'Swipe or use the pad to start' : s, `Level ${levelNo()}: ${LEVELS[lvl].name}`, SPEEDS[speed].name + (walls ? '' : ' · wrap'));
      }

      /* ---------- input ---------- */
      const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      function turn(name) {
        const d = DIRS[name];
        if (state === 'ready') startPlay();
        if (state !== 'play') { if (state === 'paused') { state = 'play'; status(); } else return; }
        const ref = queue.length ? queue[queue.length - 1] : dir;
        if ((d.x === ref.x && d.y === ref.y) || (d.x === -ref.x && d.y === -ref.y) || queue.length >= 3) return;
        queue.push(d);
      }
      function ok() {
        if (state === 'ready') startPlay();
        else if (state === 'paused') { state = 'play'; status(); }
        else if (state === 'over') newGame();
      }
      function pause() {
        if (state === 'play') { state = 'paused'; status(); }
        else if (state === 'paused') { state = 'play'; status(); }
      }
      const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
      win.onKey(e => {
        if (e.code === 'F2') { e.preventDefault(); newGame(); return; }
        if (KEYS[e.code]) { e.preventDefault(); turn(KEYS[e.code]); return; }
        if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) pause(); return; }
        if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) ok(); }
      });
      // swipe anywhere on the canvas; each 22px of travel registers a turn, so one drag can queue two turns
      let sw = null;
      cv.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch {} });
      cv.addEventListener('pointermove', e => {
        if (!sw) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        sw.x = e.clientX; sw.y = e.clientY; sw.moved = true;
      });
      const endSwipe = () => { if (sw && !sw.moved) ok(); sw = null; };
      cv.addEventListener('pointerup', endSwipe);
      cv.addEventListener('pointercancel', () => { sw = null; });
      win.body.querySelectorAll('.snk-pad button').forEach(b => {
        b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('on'); if (b.dataset.d === 'p') { if (state === 'play' || state === 'paused') pause(); else ok(); } else turn(b.dataset.d); });
        const up = () => b.classList.remove('on');
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      });
      win.on('blur', () => { if (state === 'play') { state = 'paused'; status(); } });
      win.on('close', () => { if (state === 'play') { state = 'paused'; status(); } });
      win.on('minimize', () => { if (state === 'play') { state = 'paused'; status(); } });

      /* ---------- simulation ---------- */
      function burst(cx, cy, n, colors, spd, life, size) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.2832, s = spd * (.3 + Math.random() * .7);
          parts.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 120, life: life * (.6 + Math.random() * .5), max: life, c: colors[i % colors.length], s: size, rot: 0, vr: 0 });
        }
      }
      const px = v => B + (v + .5) * C;
      function tick() {
        eaten = null;
        if (queue.length) dir = queue.shift();
        let nx = body[0].x + dir.x, ny = body[0].y + dir.y;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) {
          if (walls) return die();
          nx = (nx + W) % W; ny = (ny + H) % H;
        }
        if (grid[ny * W + nx]) return die();
        const growing = grow > 0, n = body.length - (growing ? 0 : 1);
        for (let i = 0; i < n; i++) if (body[i].x === nx && body[i].y === ny) return die();
        prevTail = growing ? { ...body[body.length - 1] } : body.pop();
        body.unshift({ x: nx, y: ny });
        if (growing) grow--;
        if (food && food.x === nx && food.y === ny) {
          eaten = food; score += 10 * levelNo(); apples++; levelApples++; grow++;
          sfx.eat(); burst(px(nx), px(ny), 10, ['#ff5a4a', '#ffffff', '#3fbf3f'], 90, .45, 2);
          food = randFree();
          if (!bonus && (apples % 5 === 0 || Math.random() < .12)) { const c = randFree(); if (c) { bonus = { ...c, life: BONUS_LIFE, last: BONUS_LIFE }; sfx.bonusOn(); } }
          hud();
          if (levelApples >= APPLES_PER_LEVEL) return levelUp();
        }
        if (bonus && bonus.x === nx && bonus.y === ny) {
          const pts = (Math.round(bonus.life / BONUS_LIFE * 90) + 10) * levelNo();
          score += pts; grow += 2; sfx.bonus();
          burst(px(nx), px(ny), 22, ['#ffd23f', '#fff7c0', '#ffffff'], 140, .7, 2);
          parts.push({ text: '+' + pts, x: px(nx), y: px(ny) - 8, vx: 0, vy: -30, g: 0, life: 1.1, max: 1.1 });
          bonus = null; hud();
        }
        hud();
      }
      function die() {
        state = 'dying'; deathT = 0; scattered = false; shake = .35; queue = []; sfx.die(); status();
      }
      function levelUp() {
        sfx.level();
        if (lvl + 1 >= LEVELS.length) { loop++; loadLevel(0); } else loadLevel(lvl + 1);
        state = 'level'; levelT = 0; status();
      }
      function scatter() {
        scattered = true;
        body.forEach((c, i) => {
          const a = Math.random() * 6.2832, s = 60 + Math.random() * 160;
          parts.push({ seg: 1, head: i === 0, x: px(c.x), y: px(c.y), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, g: 420, life: 1.1 + Math.random() * .4, max: 1.4, rot: 0, vr: (Math.random() - .5) * 14 });
        });
        shake = .25;
      }
      async function gameOver() {
        state = 'over'; status(); hud();
        const l = hiList();
        if (score <= 0 || (l.length >= 5 && score <= l[l.length - 1].score)) return;
        const name = await Arcade.dialog({ title: 'Snake 98 - Hall of Fame', icon: 'trophy', text: `New high score: ${score}! Enter your name:`, input: store.get('name', ''), buttons: ['OK', 'Cancel'] });
        if (name == null) return;
        store.set('name', name);
        const entry = { name: name || 'Anonymous', score, level: levelNo(), len: body.length };
        const list = hiList(); list.push(entry); list.sort((a, b) => b.score - a.score); store.set('hi', list.slice(0, 5));
        hud(); win.focus();
      }
      function update(dt) {
        for (const q of parts) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.vr) q.rot += q.vr * dt; }
        parts = parts.filter(q => q.life > 0);
        shake = Math.max(0, shake - dt);
        if (state === 'play') {
          if (bonus) {
            bonus.life -= dt;
            if (bonus.life < 2.5 && Math.ceil(bonus.life) < Math.ceil(bonus.last)) sfx.tick();
            bonus.last = bonus.life;
            if (bonus.life <= 0) { burst(px(bonus.x), px(bonus.y), 8, ['#85858c', '#c3c3c6'], 50, .4, 2); bonus = null; }
          }
          acc += dt * 1000;
          let guard = 4;
          while (state === 'play' && acc >= tickMs() && guard--) { acc -= tickMs(); tick(); }
          if (guard < 0) acc = 0;
        } else if (state === 'dying') {
          deathT += dt;
          if (deathT > .65 && !scattered) scatter();
          if (deathT > 2) gameOver();
        } else if (state === 'level') {
          levelT += dt;
          if (levelT > 2.4) startPlay();
        }
      }

      /* ---------- rendering ---------- */
      function fit() {
        const r = cv.getBoundingClientRect(); if (!r.width) return;
        const nk = Math.max(1, Math.min(3, Math.min(r.width / LW, r.height / LH) * (devicePixelRatio || 1)));
        if (Math.abs(nk - k) > .01 || cv.width !== Math.round(LW * k)) { k = nk; cv.width = Math.round(LW * k); cv.height = Math.round(LH * k); layer = null; }
      }
      if (window.ResizeObserver) new ResizeObserver(fit).observe(cv);
      win.on('resize', () => setTimeout(fit, 0));

      function bevelBlock(c, x, y, w, h) {
        c.fillStyle = '#c3c3c6'; c.fillRect(x, y, w, h);
        c.fillStyle = '#ffffff'; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h);
        c.fillStyle = '#85858c'; c.fillRect(x + 1, y + h - 2, w - 1, 2); c.fillRect(x + w - 2, y + 1, 2, h - 1);
        c.fillStyle = '#0c0c10'; c.fillRect(x, y + h - 1, w, 1); c.fillRect(x + w - 1, y, 1, h);
      }
      function buildLayer() {
        layer = document.createElement('canvas'); layer.width = cv.width; layer.height = cv.height;
        const c = layer.getContext('2d'); c.scale(k, k);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { c.fillStyle = (x + y) % 2 ? '#10291a' : '#0e2416'; c.fillRect(B + x * C, B + y * C, C, C); }
        if (walls) {
          c.fillStyle = '#5d5f7a'; c.fillRect(0, 0, LW, B); c.fillRect(0, LH - B, LW, B); c.fillRect(0, 0, B, LH); c.fillRect(LW - B, 0, B, LH);
          for (let x = 0; x < LW; x += 16) { bevelBlock(c, x, 0, 16, B); bevelBlock(c, x + 8, LH - B, 16, B); }
          for (let y = B; y < LH - B; y += 16) { bevelBlock(c, 0, y, B, 16); bevelBlock(c, LW - B, y, B, 16); }
        } else {
          c.fillStyle = '#06103a'; c.fillRect(0, 0, LW, B); c.fillRect(0, LH - B, LW, B); c.fillRect(0, 0, B, LH); c.fillRect(LW - B, 0, B, LH);
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y * W + x]) {
          c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(B + x * C + 3, B + y * C + 3, C, C);
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y * W + x]) bevelBlock(c, B + x * C, B + y * C, C, C);
      }
      function snakePts(p) {
        const wd = (a, b) => { let dx = b.x - a.x, dy = b.y - a.y; if (dx > 1) dx -= W; if (dx < -1) dx += W; if (dy > 1) dy -= H; if (dy < -1) dy += H; return [dx, dy]; };
        const [hx, hy] = wd(body[1], body[0]);
        let cx = body[1].x, cy = body[1].y;
        const pts = [[cx + hx * p, cy + hy * p], [cx, cy]];
        for (let i = 2; i < body.length; i++) { const [dx, dy] = wd(body[i - 1], body[i]); cx += dx; cy += dy; pts.push([cx, cy]); }
        const [tx, ty] = wd(body[body.length - 1], prevTail); pts.push([cx + tx * (1 - p), cy + ty * (1 - p)]);
        return pts.map(q => [px(q[0]), px(q[1])]);
      }
      function drawSnakeWrapped(pts, col, tongue) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        const fw = W * C, fh = H * C, m = C;
        const oxs = [0], oys = [0];
        if (x0 < B + m) oxs.push(fw); if (x1 > B + fw - m) oxs.push(-fw);
        if (y0 < B + m) oys.push(fh); if (y1 > B + fh - m) oys.push(-fh);
        g.save(); g.beginPath(); g.rect(B, B, fw, fh); g.clip();
        for (const ox of oxs) for (const oy of oys) {
          if (ox || oy) { g.save(); g.translate(ox, oy); drawSnake(g, pts, R, col, t, tongue); g.restore(); }
          else drawSnake(g, pts, R, col, t, tongue);
        }
        g.restore();
      }
      function txt(s, x, y, color, font, align = 'left') { g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = color; g.fillText(s, x, y); }
      function winBox(title, lines, footer, w = 320) {
        const lh = 17, h = 50 + lines.length * lh + (footer ? 34 : 0), x = (LW - w) / 2 | 0, y = (LH - h) / 2 | 0;
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 5, y + 5, w, h);
        bevelBlock(g, x, y, w, h);
        const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#0a1a86'); gr.addColorStop(1, '#1d8ad6');
        g.fillStyle = gr; g.fillRect(x + 3, y + 3, w - 6, 18);
        txt(title, x + 8, y + 16, '#fff', 'bold 12px ' + UI);
        bevelBlock(g, x + w - 21, y + 5, 16, 14); txt('×', x + w - 13, y + 16, '#101014', 'bold 12px ' + UI, 'center');
        lines.forEach((l, i) => {
          const [a, b, col] = Array.isArray(l) ? l : [l];
          txt(a, x + 16, y + 44 + i * lh, '#101014', '12px ' + UI);
          if (b != null) txt(String(b), x + w - 16, y + 44 + i * lh, col || '#101014', 'bold 12px ' + UI, 'right');
        });
        if (footer) {
          g.font = '12px ' + UI;
          const bw = Math.min(w - 24, g.measureText(footer).width + 40), bx = x + (w - bw) / 2, by = y + h - 34;
          bevelBlock(g, bx, by, bw, 24);
          if (Math.sin(t * 5) > -.4) { g.strokeStyle = '#101014'; g.lineWidth = 1; g.setLineDash([1, 1]); g.strokeRect(bx + 4.5, by + 4.5, bw - 9, 15); g.setLineDash([]); }
          txt(footer, x + w / 2, by + 16, '#101014', '12px ' + UI, 'center');
        }
      }
      function render() {
        fit();
        if (!layer) buildLayer();
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
        g.drawImage(layer, 0, 0);
        g.setTransform(k, 0, 0, k, 0, 0);
        if (shake > 0) g.translate((Math.random() - .5) * shake * 18, (Math.random() - .5) * shake * 18);
        if (!walls) {
          g.strokeStyle = '#2ad4ff'; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = -t * 24;
          g.strokeRect(B / 2, B / 2, LW - B, LH - B); g.setLineDash([]);
        }
        const tk = tickMs(), p = (state === 'play' || state === 'paused') ? Math.min(1, acc / tk) : 1;
        // food
        if (eaten && state === 'play' && p < .6) drawApple(g, px(eaten.x), px(eaten.y), 1 - p / .6, false);
        if (food) drawApple(g, px(food.x), px(food.y), (1.15 + Math.sin(t * 6) * .06) * (eaten ? Math.min(1, p * 2) : 1), false);
        if (bonus && (bonus.life > 2 || Math.sin(t * 22) > -.2)) {
          const bx = px(bonus.x), by = px(bonus.y);
          g.save(); g.shadowColor = '#ffd23f'; g.shadowBlur = 10 + Math.sin(t * 8) * 4;
          drawApple(g, bx, by, 1.05 + Math.sin(t * 9) * .08, true); g.restore();
          g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by + 1, 11.5, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.max(0, bonus.life) / BONUS_LIFE); g.stroke();
          for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; g.fillStyle = '#fff7c0'; g.fillRect(bx + Math.cos(a) * 14 - 1, by + Math.sin(a) * 14 - 1, 2, 2); }
          const lab = String(Math.ceil(bonus.life)), ly = bonus.y < 2 ? by + 26 : by - 15;
          txt(lab, bx + 1, ly + 1, '#000', '10px ' + PIX, 'center'); txt(lab, bx, ly, '#ffd23f', '10px ' + PIX, 'center');
        }
        // snake
        if (state !== 'dying' || !scattered) {
          const flash = state === 'dying' && Math.floor(deathT * 12) % 2 === 0;
          drawSnakeWrapped(snakePts(p), flash ? FLASH : COL, state === 'play' || state === 'ready');
        }
        // particles
        for (const q of parts) {
          g.globalAlpha = Math.max(0, Math.min(1, q.life / q.max * 1.6));
          if (q.text) txt(q.text, q.x, q.y, '#ffd23f', '11px ' + PIX, 'center');
          else if (q.seg) {
            g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
            g.fillStyle = COL.line; g.fillRect(-R - 1, -R - 1, 2 * R + 2, 2 * R + 2);
            g.fillStyle = Math.floor(q.life * 10) % 2 ? COL.body : '#ffffff'; g.fillRect(-R, -R, 2 * R, 2 * R);
            if (q.head) { g.fillStyle = '#fff'; g.fillRect(-4, -4, 3, 3); g.fillRect(1, -4, 3, 3); }
            g.restore();
          } else { g.fillStyle = q.c; g.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
        }
        g.globalAlpha = 1;
        g.setTransform(k, 0, 0, k, 0, 0);
        // overlays
        if (state === 'ready') winBox('Snake 98', ['Eat apples, grow long, don\'t bite yourself.', 'Golden apples vanish fast - grab them!', `Every ${APPLES_PER_LEVEL} apples opens the next maze.`, ['Speed', SPEEDS[speed].name], ['Walls', walls ? 'On' : 'Off (wrap-around)']], coarse ? 'Swipe to start' : 'Press an arrow key to start');
        else if (state === 'paused') winBox('Paused', ['Snake 98 is paused.', ['Score', score], ['Length', body.length], ['Level', levelNo() + ' - ' + LEVELS[lvl].name]], coarse ? 'Tap to resume' : 'Resume (P)', 280);
        else if (state === 'over') {
          const l = hiList(), best = l.length && l[0].score;
          winBox('Game Over', ['The snake has bitten the dust.', ['Score', score, score && score >= best ? '#b5203a' : null], ['Length', body.length], ['Level reached', levelNo()]], coarse ? 'Tap to play again' : 'Play again (F2)', 290);
        } else if (state === 'level') {
          const a = Math.min(1, levelT * 4, (2.4 - levelT) * 4);
          g.fillStyle = `rgba(0,0,0,${.6 * a})`; g.fillRect(0, 0, LW, LH);
          g.globalAlpha = a;
          const y = LH / 2 - 14 + (1 - a) * 16;
          txt('LEVEL ' + levelNo(), LW / 2 + 3, y + 3, '#0a1a86', '32px ' + BIG, 'center');
          txt('LEVEL ' + levelNo(), LW / 2, y, '#ffd23f', '32px ' + BIG, 'center');
          txt(LEVELS[lvl].name.toUpperCase() + (loop ? '  ·  SPEED +' + loop : ''), LW / 2, y + 30, '#ffffff', '12px ' + PIX, 'center');
          // Win95 progress bar
          const bw = 220, bx = (LW - bw) / 2, by = y + 48;
          g.fillStyle = '#c3c3c6'; g.fillRect(bx - 3, by - 3, bw + 6, 20);
          g.fillStyle = '#fff'; g.fillRect(bx - 3, by + 16, bw + 6, 1); g.fillRect(bx + bw + 2, by - 3, 1, 20);
          g.fillStyle = '#85858c'; g.fillRect(bx - 3, by - 3, bw + 6, 1); g.fillRect(bx - 3, by - 3, 1, 20);
          const nb = Math.floor(Math.min(1, levelT / 2.1) * 18);
          g.fillStyle = '#0a1a86'; for (let i = 0; i < nb; i++) g.fillRect(bx + 1 + i * 12, by + 1, 10, 12);
          g.globalAlpha = 1;
        }
      }

      /* ---------- loop ---------- */
      let last = performance.now();
      function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        if (!win.isVisible()) return;
        t += dt; update(dt); render();
      }

      api.newGame = newGame;
      api.pause = () => { if (state === 'ready') return; pause(); };
      api.speed = i => { speed = i; store.set('speed', i); status(); };
      api.walls = () => { walls = !walls; store.set('walls', walls); layer = null; status(); };
      api.help = () => Arcade.dialog({ title: 'How to play Snake 98', icon: 'info', text: `Steer with the arrow keys or WASD${coarse ? ' (or swipe / use the pad)' : ''}. Eat red apples to grow and score. Golden apples appear for ${BONUS_LIFE} seconds and are worth more the faster you grab them. Every ${APPLES_PER_LEVEL} apples takes you to the next maze; the snake speeds up as it grows. With Walls off, you wrap around the edges (maze blocks still bite). P pauses, F2 starts over.` });
      // test hooks for tools/smoke.mjs
      Arcade.apps.snake.test = {
        get: () => ({ state, lvl, loop, score, len: body.length, head: body[0], dir, queue: queue.length, food, bonus: !!bonus, walls }),
        level(i) { loadLevel(i); state = 'ready'; },
        levelUp() { levelApples = APPLES_PER_LEVEL - 1; food = { x: body[0].x + dir.x, y: body[0].y + dir.y }; if (state !== 'play') startPlay(); },
        bonus() { const c = randFree(); bonus = { ...c, life: BONUS_LIFE, last: BONUS_LIFE }; },
        grow(n) { grow += n; },
        die() { die(); },
        validate() {
          return LEVELS.map((L, i) => {
            const gr = wallGrid(i), [sx, sy, dx, dy] = L.spawn;
            let ahead = 0; for (let n = -3; n <= 6; n++) { const x = sx + dx * n, y = sy + dy * n; if (x >= 0 && x < W && y >= 0 && y < H && !gr[y * W + x]) ahead++; }
            const seen = new Uint8Array(W * H), st = [sy * W + sx]; seen[st[0]] = 1; let reach = 0;
            while (st.length) { const c = st.pop(); reach++; const x = c % W, y = c / W | 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + ax, Y = y + ay; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (!gr[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
            return { name: L.name, spawnClear: ahead === 10, allReachable: reach === gr.reduce((a, v) => a + (v ? 0 : 1), 0) };
          });
        }
      };

      loadLevel(0); hud();
      requestAnimationFrame(frame);
    }
  });
})();

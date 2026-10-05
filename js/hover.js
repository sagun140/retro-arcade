/* Hover!: original tribute to the 1995 hovercraft capture-the-flag maze game.
   Software raycaster (Canvas 2D ImageData): procedural wall/floor textures, per-pixel depth for sprites,
   multi-hit rays so a spring jump lets you see (and fly) over the walls. */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="11" y="1" width="1" height="8" fill="#555"/><rect x="12" y="1" width="3" height="3" fill="#e0202a"/><rect x="2" y="5" width="2" height="4" fill="#1a4aa8"/><rect x="6" y="6" width="4" height="2" fill="#9ef0ff"/><rect x="3" y="8" width="10" height="1" fill="#6aa8ff"/><rect x="2" y="9" width="12" height="3" fill="#2a6ee0"/><rect x="1" y="12" width="14" height="2" fill="#222"/><rect x="2" y="14" width="12" height="1" fill="#7fd8ff"/></svg>';
  const store = { get: (k, d) => Arcade.store.get('hover.' + k, d), set: (k, v) => Arcade.store.set('hover.' + k, v) };
  const api = {};
  const TAU = Math.PI * 2;
  const wrapA = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
  // sounds only after a real user gesture (avoids autoplay warnings)
  const beep = (...a) => { const ua = navigator.userActivation; if (ua && !ua.hasBeenActive) return; Arcade.beep(...a); };

  const LEVELS = [
    { name: 'Brickworks', cells: 7, enemies: 2, espeed: 1.6, aggr: .36, time: 180, pads: 4 },
    { name: 'Circuit Yard', cells: 9, enemies: 3, espeed: 2.0, aggr: .46, time: 210, pads: 6 },
    { name: 'Old Keep', cells: 11, enemies: 3, espeed: 2.4, aggr: .55, time: 240, pads: 8 }
  ];

  Arcade.css(`
    .hov-screen { background: #000; padding: 2px; }
    .hov-screen canvas { display: block; width: 100%; aspect-ratio: 16 / 9; max-height: calc(100dvh - 250px); object-fit: contain; image-rendering: pixelated; background: #000; touch-action: none; outline: none; }
    .win.max .hov-screen canvas { max-height: calc(100dvh - 200px); }
    .hov-dash { display: flex; gap: 4px; padding: 4px 2px 2px; align-items: stretch; flex-wrap: wrap; }
    .hov-radar { background: #000; padding: 3px; flex: none; display: flex; align-items: center; }
    .hov-radar canvas { width: 96px; height: 96px; image-rendering: pixelated; display: block; }
    .hov-panel { flex: 1; min-width: 210px; display: flex; flex-direction: column; gap: 4px; }
    .hov-row { display: flex; gap: 4px; flex-wrap: wrap; }
    .hov-cell { display: flex; flex-direction: column; gap: 3px; padding: 3px 6px 4px; flex: 1 1 auto; box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); }
    .hov-lbl { font: 9px/1 var(--pixel); text-transform: uppercase; letter-spacing: .5px; }
    .hov-flags { display: flex; gap: 3px; height: 18px; align-items: center; }
    .hov-flags svg { width: 15px; height: 18px; }
    .hov-flags .hov-off { opacity: .22; filter: grayscale(1); }
    .hov-flags .hov-carry { animation: hov-blink .5s steps(2) infinite; }
    @keyframes hov-blink { 50% { opacity: .3; } }
    .hov-dash .lcd { font-size: 16px; }
    .hov-slot { position: relative; display: flex; align-items: center; gap: 4px; padding: 3px 6px 5px; flex: 1 1 auto; min-width: 54px; box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
    .hov-slot svg { width: 16px; height: 16px; flex: none; }
    .hov-slot b { font: 13px/1 var(--pixel); }
    .hov-slot small { font: 8px/1 var(--pixel); opacity: .7; margin-left: auto; }
    .hov-slot i { position: absolute; left: 3px; bottom: 2px; height: 2px; background: #0a8a3a; }
    .hov-slot.hov-zero { opacity: .45; }
    .hov-slot.hov-on { background: #ffffe1; }
    .hov-slot.hov-warn { background: #e8c8f0; }
    .hov-touch { display: none; justify-content: space-between; gap: 6px; padding: 6px 2px 2px; touch-action: none; }
    .hov-pad { display: flex; gap: 5px; }
    .hov-touch button { width: 50px; height: 46px; border: 0; background: var(--face); font: 13px var(--pixel); touch-action: none; padding: 0;
      box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi2), inset -2px -2px var(--lo), inset 2px 2px var(--hi); }
    .hov-touch .hov-acts button { width: 42px; font-size: 9px; }
    .hov-touch button.hov-on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); background: #b0b0b6; }
    @media (pointer: coarse) { .hov-touch { display: flex; } .hov-screen canvas { max-height: calc(100dvh - 330px); } }
  `);

  Arcade.scores.add({
    game: 'Hover!',
    render() {
      const list = store.get('scores', []);
      let h = '<tr><th>#</th><th>Pilot</th><th>Score</th><th>Level</th></tr>';
      if (!list.length) return h + '<tr><td colspan="4">No scores yet. Capture some flags!</td></tr>';
      list.forEach((s, i) => { h += `<tr><td>${i + 1}</td><td>${Arcade.esc(s.name)}</td><td class="num">${s.score}</td><td class="num">${s.won ? 'ALL' : s.level}</td></tr>`; });
      return h;
    }
  });

  /* ---------- hover-card preview: a tiny raycast flythrough ---------- */
  const PM = ['########', '#......#', '#.####.#', '#.#..#.#', '#.#..#.#', '#.####.#', '#......#', '########'];
  const PPATH = [[1.5, 1.5], [6.5, 1.5], [6.5, 6.5], [1.5, 6.5]];
  const pAt = s => { s = ((s % 20) + 20) % 20; const k = Math.floor(s / 5), f = (s - k * 5) / 5, a = PPATH[k], b = PPATH[(k + 1) % 4]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
  const pdepth = new Float32Array(128);
  function preview(g, w, h, t) {
    const s = t * 1.8, [x, y] = pAt(s), [lx, ly] = pAt(s + 1.6), a = Math.atan2(ly - y, lx - x);
    const dx = Math.cos(a), dy = Math.sin(a), plx = -dy * .66, ply = dx * .66, hz = h / 2;
    let gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, '#1b1440'); gr.addColorStop(1, '#c87060');
    g.fillStyle = gr; g.fillRect(0, 0, w, hz);
    gr = g.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, '#3a3038'); gr.addColorStop(1, '#6a6670');
    g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    const N = 104, cw = w / N;
    for (let i = 0; i < N; i++) {
      const c = 2 * i / N - 1, rx = dx + plx * c, ry = dy + ply * c;
      let mx = x | 0, my = y | 0; const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
      const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? x - mx : mx + 1 - x) * ddx, sdy = (ry < 0 ? y - my : my + 1 - y) * ddy, side = 0;
      for (let k = 0; k < 20; k++) { if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; } if (PM[my][mx] === '#') break; }
      const d = side ? sdy - ddy : sdx - ddx; pdepth[i] = d;
      const wx = side ? x + d * rx : y + d * ry, fr = (wx * 4) % 1;
      const lh = h * .95 / d, top = hz - lh / 2, f = Math.min(1, d / 9), dim = side ? .78 : 1;
      const r = (170 * dim * (1 - f) + 200 * f) | 0, gg = (70 * dim * (1 - f) + 112 * f) | 0, b = (50 * dim * (1 - f) + 96 * f) | 0;
      g.fillStyle = fr < .08 ? `rgb(${r * .7 | 0},${gg * .7 | 0},${b * .7 | 0})` : `rgb(${r},${gg},${b})`;
      g.fillRect(i * cw, top, cw + .5, lh);
      if (lh > 10) { g.fillStyle = `rgb(${r * .7 | 0},${gg * .7 | 0},${b * .7 | 0})`; for (let k = 1; k < 4; k++) g.fillRect(i * cw, top + lh * k / 4, cw + .5, 1); }
    }
    // red flag billboard
    const fx = 6.5 - x, fy = 4 - y, dep = fx * dx + fy * dy, lat = -fx * dy + fy * dx;
    if (dep > .3) {
      const sxp = w / 2 + lat / .66 / dep * (w / 2), sc = h * .95 / dep;
      const col = Math.round(sxp / cw);
      if (col >= 0 && col < N && pdepth[col] > dep) {
        const base = hz + sc * .5, ph = sc * .7;
        g.fillStyle = '#ddd'; g.fillRect(sxp - 1, base - ph, Math.max(1, sc * .04), ph);
        g.fillStyle = '#e0202a'; g.fillRect(sxp, base - ph, sc * .32, sc * .2 + Math.sin(t * 6) * sc * .02);
      }
    }
  }

  /* ---------- small SVG helpers for the dashboard ---------- */
  const flagSvg = col => `<svg viewBox="0 0 10 12" shape-rendering="crispEdges"><rect x="1" y="0" width="1" height="12" fill="#333"/><rect x="2" y="1" width="7" height="4" fill="${col}"/><rect x="2" y="5" width="5" height="1" fill="${col}"/><rect x="0" y="11" width="4" height="1" fill="#333"/></svg>`;
  const SLOT_ICONS = {
    spring: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="1" width="8" height="2" fill="#bbb"/><rect x="5" y="4" width="7" height="1" fill="#2a9a3a"/><rect x="4" y="6" width="7" height="1" fill="#1a6a2a"/><rect x="5" y="8" width="7" height="1" fill="#2a9a3a"/><rect x="4" y="10" width="7" height="1" fill="#1a6a2a"/><rect x="2" y="13" width="12" height="2" fill="#555"/></svg>',
    wall: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="2" width="12" height="12" fill="#222"/><rect x="3" y="3" width="3" height="3" fill="#f0c81e"/><rect x="9" y="3" width="3" height="3" fill="#f0c81e"/><rect x="6" y="6" width="3" height="3" fill="#f0c81e"/><rect x="3" y="9" width="3" height="3" fill="#f0c81e"/><rect x="9" y="9" width="3" height="3" fill="#f0c81e"/></svg>',
    cloak: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="5" y="2" width="6" height="12" fill="#3ad8ff"/><rect x="3" y="4" width="10" height="8" fill="#3ad8ff"/><rect x="2" y="6" width="12" height="4" fill="#3ad8ff"/><rect x="5" y="5" width="3" height="2" fill="#e8ffff"/><rect x="6" y="8" width="4" height="3" fill="#0a5a7a"/></svg>',
    boost: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="3" width="3" height="2" fill="#ff8a1a"/><rect x="4" y="5" width="3" height="2" fill="#ff8a1a"/><rect x="6" y="7" width="3" height="2" fill="#ff8a1a"/><rect x="4" y="9" width="3" height="2" fill="#ff8a1a"/><rect x="2" y="11" width="3" height="2" fill="#ff8a1a"/><rect x="8" y="3" width="3" height="2" fill="#ffd23f"/><rect x="10" y="5" width="3" height="2" fill="#ffd23f"/><rect x="12" y="7" width="3" height="2" fill="#ffd23f"/><rect x="10" y="9" width="3" height="2" fill="#ffd23f"/><rect x="8" y="11" width="3" height="2" fill="#ffd23f"/></svg>',
    slow: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="1" width="14" height="14" fill="#5a1470"/><rect x="3" y="3" width="10" height="10" fill="#d23cff"/><rect x="5" y="5" width="6" height="6" fill="#5a1470"/><rect x="7" y="7" width="2" height="2" fill="#d23cff"/></svg>'
  };

  Arcade.app({
    id: 'hover', title: 'Hover!', icon: ICON, width: 720, max: true, folder: 'Games', status: true, preview,
    hint: 'First-person hovercraft capture-the-flag in a 3D maze. Grab the 3 red flags first.',
    menus: [
      { label: 'Game', items: [
        { label: 'New Game', key: 'F2', action: () => api.newGame && api.newGame() },
        { label: 'Pause', key: 'P', checked: () => !!(api.isPaused && api.isPaused()), action: () => api.togglePause && api.togglePause() },
        '-',
        { label: 'Sound', key: 'M', checked: () => !Arcade.isMuted(), action: () => Arcade.setMuted(!Arcade.isMuted()) },
        '-',
        { label: 'Exit', action: () => Arcade.apps.hover.ctx.close() }
      ] },
      { label: 'Help', items: [{ label: 'How to play', action: () => api.help && api.help() }] }
    ],
    build(win) {
      const coarse = Arcade.coarse;
      const slot = (k, label, key) => `<div class="hov-slot" data-s="${k}" title="${label}">${SLOT_ICONS[k]}<b>0</b><small>${coarse ? '' : key}</small><i></i></div>`;
      win.body.innerHTML = `<div class="hov-screen bevel-in"><canvas width="320" height="180" tabindex="0" aria-label="Hover! 3D view"></canvas></div>
        <div class="hov-dash">
          <div class="hov-radar bevel-in"><canvas width="96" height="96" aria-label="Radar"></canvas></div>
          <div class="hov-panel">
            <div class="hov-row">
              <div class="hov-cell"><span class="hov-lbl">Captured</span><div class="hov-flags" data-f="red"></div></div>
              <div class="hov-cell"><span class="hov-lbl">Your flags</span><div class="hov-flags" data-f="blue"></div></div>
              <div class="hov-cell"><span class="hov-lbl">Score</span><div class="lcd" data-v="score">000000</div></div>
              <div class="hov-cell"><span class="hov-lbl">Time</span><div class="lcd" data-v="time">3:00</div></div>
            </div>
            <div class="hov-row">
              ${slot('spring', 'Spring: jump over walls', 'SPC')}${slot('wall', 'Wall pod: drop a wall behind you', 'Z')}${slot('cloak', 'Cloak: invisible to enemies', 'X')}${slot('boost', 'Speed boost', '')}${slot('slow', 'Slowed by a hazard pad', '')}
            </div>
          </div>
        </div>
        <div class="hov-touch">
          <div class="hov-pad"><button data-k="left" aria-label="Steer left">◀</button><button data-k="right" aria-label="Steer right">▶</button></div>
          <div class="hov-pad hov-acts"><button data-k="jump" aria-label="Spring">JUMP</button><button data-k="wall" aria-label="Drop wall">WALL</button><button data-k="cloak" aria-label="Cloak">CLOAK</button></div>
          <div class="hov-pad"><button data-k="down" aria-label="Brake">▼</button><button data-k="up" aria-label="Thrust">▲</button></div>
        </div>`;
      const cv = win.body.querySelector('.hov-screen canvas'), g = cv.getContext('2d');
      const rcv = win.body.querySelector('.hov-radar canvas'), rg = rcv.getContext('2d');
      const W = 320, H = 180, HZ = 90, N = W * H;
      const FOV = 66 * Math.PI / 180, TANF = Math.tan(FOV / 2), PROJ = (W / 2) / TANF;
      const img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer), zb = new Float32Array(N);
      const angOff = new Float32Array(W); for (let x = 0; x < W; x++) angOff[x] = Math.atan((2 * x / W - 1) * TANF);
      const SKYW = 1024;

      /* ================= procedural art ================= */
      const R = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let q = s; q = Math.imul(q ^ q >>> 15, q | 1); q ^= q + Math.imul(q ^ q >>> 7, q | 61); return ((q ^ q >>> 14) >>> 0) / 4294967296; }; };
      const hash = (a, b) => { let h = Math.imul((a * 374761393 + b * 668265263) | 0, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1597334677); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
      const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
      const pack = (r, gg, b) => (255 << 24 | cl(b) << 16 | cl(gg) << 8 | cl(r)) >>> 0;
      function mkTex(fn) { const d = new Float32Array(64 * 64 * 3); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const c = fn(x, y), i = (y * 64 + x) * 3; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } return d; }
      // 16 fog levels; walls are stored column-major (u*64+v) so a wall column reads contiguously
      function shade(tex, fog, dim, colMajor) {
        const out = new Uint32Array(16 * 4096);
        for (let l = 0; l < 16; l++) {
          const f = Math.pow(l / 15, 1.15), k = (1 - f) * dim;
          for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const i = (y * 64 + x) * 3;
            out[l * 4096 + (colMajor ? x * 64 + y : y * 64 + x)] = pack(tex[i] * k + fog[0] * f, tex[i + 1] * k + fog[1] * f, tex[i + 2] * k + fog[2] * f);
          }
        }
        return out;
      }
      function texBrick(seed, base, windowed) {
        const r = R(seed);
        return mkTex((x, y) => {
          if (windowed && x >= 20 && x <= 43 && y >= 12 && y <= 54) {
            const inArch = y >= 26 || (x - 31.5) ** 2 + (y - 26) ** 2 < 144;
            const inGlass = (y >= 28 && x >= 23 && x <= 40 && y <= 51) || (x - 31.5) ** 2 + (y - 27) ** 2 < 81;
            if (inGlass) { if (x === 31 || x === 32 || y === 38) return [70, 40, 25]; const gl = 1 - (y - 18) / 40; return [255 * (.75 + gl * .25), 200 * (.6 + gl * .4), 90 + r() * 20]; }
            if (inArch) return [80 + r() * 10, 48, 30];
          }
          const row = y >> 3, off = (row & 1) * 8, bx = (x + off) & 15, bi = ((x + off) >> 4) & 3, ly = y & 7;
          if (ly === 7 || bx === 15) { const v = 150 + r() * 22; return [v, v - 8, v - 18]; }
          const k = .78 + hash(row, bi + seed) * .38, n = r() * 20 - 10;
          const e = ly === 0 || bx === 0 ? 20 : (ly === 6 || bx === 14 ? -18 : 0);
          return [base[0] * k + n + e, base[1] * k + n * .6 + e * .7, base[2] * k + n * .5 + e * .6];
        });
      }
      function texTech(seed, screen) {
        const r = R(seed);
        return mkTex((x, y) => {
          if (screen && x >= 12 && x <= 51 && y >= 9 && y <= 40) {
            if (x <= 13 || x >= 50 || y <= 10 || y >= 39) return [24, 28, 34];
            const line = (y - 12) >> 2, len = 14 + hash(line, seed) * 22;
            if ((y & 3) === 0 && y < 37 && x - 15 < len) return [80, 255, 140];
            return [10, 38 + ((y & 1) * 6), 22];
          }
          const px = x & 31, py = y & 31, id = (x >> 5) + (y >> 5) * 2, n = r() * 10 - 5;
          let c = [92 + n, 106 + n, 124 + n];
          if ((id === 1 || id === 2) && py >= 9 && py <= 22 && (py & 3) < 2 && px >= 6 && px <= 25) c = [26, 30, 36];
          if ((px === 4 || px === 27) && (py === 4 || py === 27)) c = [205, 210, 220];
          else if ((px === 5 || px === 28) && (py === 5 || py === 28)) c = [50, 56, 66];
          if (px === 0 || py === 0) c = [c[0] + 45, c[1] + 45, c[2] + 45];
          else if (px === 31 || py === 31) c = [c[0] - 50, c[1] - 50, c[2] - 50];
          else if (px === 1 || py === 1) c = [c[0] + 15, c[1] + 15, c[2] + 15];
          if (y >= 30 && y <= 33 && !screen) c = y === 30 || y === 33 ? [20, 110, 130] : [60, 235, 255];
          return c;
        });
      }
      function texStone(seed, moss) {
        const r = R(seed), heights = [13, 11, 14, 12, 14], rowOf = [], rowY = [];
        let yy = 0; heights.forEach((hh, i) => { for (let k = 0; k < hh; k++) { rowOf.push(i); rowY.push(yy); } yy += hh; });
        const stones = heights.map((hh, i) => { const xs = []; let x = Math.floor(r() * 10); const x0 = x; while (x < x0 + 64) { xs.push(x); x += 12 + Math.floor(r() * 14); } return { xs, x0, hh }; });
        return mkTex((x, y) => {
          const ri = rowOf[y], st = stones[ri], ly = y - rowY[y];
          let xx = x; if (xx < st.x0) xx += 64;
          let k = st.xs.length - 1; for (let j = 0; j < st.xs.length; j++) if (st.xs[j] > xx) { k = j - 1; break; }
          const sx0 = st.xs[k], sw = (k + 1 < st.xs.length ? st.xs[k + 1] : st.x0 + 64) - sx0, lx = xx - sx0;
          if (lx < 1 || ly < 1) return [46, 46, 50];
          const v = 108 + hash(ri, k + seed) * 44, n = r() * 22 - 11;
          let e = 0; if (lx < 3 || ly < 3) e = 18; else if (lx > sw - 3 || ly > st.hh - 3) e = -22;
          let c = [v + n + e, v + n + e - 2, v + n + e + 4];
          if (moss && ly < 6 && r() < .55 - ly * .08) c = [62 + n, 104 + n, 46 + n * .5];
          if (r() < .02) c = [c[0] - 40, c[1] - 40, c[2] - 40];
          return c;
        });
      }
      const texPod = mkTex((x, y) => {
        const b = Math.min(x, y, 63 - x, 63 - y);
        if (b < 3) return b === 1 ? [200, 255, 255] : [60, 210, 240];
        return ((x + y) >> 3) & 1 ? [242, 200, 30] : [30, 30, 34];
      });
      function texFloor(kind, seed) {
        const r = R(seed);
        return mkTex((x, y) => {
          const n = r();
          if (kind === 0) { // asphalt tiles
            if (x === 0 || y === 0) return [104, 100, 96];
            if (x === 32 || y === 32) return [74, 72, 70];
            const v = 64 + n * 22; return [v, v - 2, v - 4];
          }
          if (kind === 1) { // metal grating
            if (x === 0 || y === 0) return [30, 130, 140];
            if ((x & 7) < 2 || (y & 7) < 2) { const v = 86 + n * 16; return [v, v + 8, v + 16]; }
            return [16 + n * 6, 20 + n * 6, 26 + n * 6];
          }
          // grass with flagstones
          const sx = x & 31, sy = y & 31;
          if (sx > 2 && sx < 29 && sy > 2 && sy < 29 && hash(x >> 5, (y >> 5) + seed) > .3) {
            const e = sx < 5 || sy < 5 ? 14 : (sx > 26 || sy > 26 ? -14 : 0), v = 116 + n * 18 + e; return [v, v - 2, v - 10];
          }
          return [44 + n * 26, 96 + n * 34, 34 + n * 16];
        });
      }
      const texPad = mkTex((x, y) => {
        const b = Math.min(x, y, 63 - x, 63 - y);
        if (b < 5) return ((x + y) >> 2) & 1 ? [250, 210, 30] : [20, 20, 20];
        const d = Math.hypot(x - 31.5, y - 31.5);
        return (d | 0) % 8 < 3 ? [225, 70, 255] : [80, 16, 104];
      });
      function makeSky(kind) {
        const c = document.createElement('canvas'); c.width = SKYW; c.height = HZ; const s = c.getContext('2d'), r = R(77 + kind);
        const th = THEMES[kind], gr = s.createLinearGradient(0, 0, 0, HZ);
        th.sky.forEach((col, i) => gr.addColorStop(i / (th.sky.length - 1), col));
        s.fillStyle = gr; s.fillRect(0, 0, SKYW, HZ);
        const ridge = (amp, base, col, seeds) => {
          s.fillStyle = col; s.beginPath(); s.moveTo(0, HZ);
          for (let x = 0; x <= SKYW; x += 4) { let y = base; seeds.forEach(([k, a, p]) => { y -= Math.sin(x / SKYW * TAU * k + p) * a; }); s.lineTo(x, y - amp); }
          s.lineTo(SKYW, HZ); s.fill();
        };
        if (kind === 0) {
          s.fillStyle = '#ffd890'; s.beginPath(); s.arc(300, HZ - 16, 14, 0, TAU); s.fill();
          ridge(4, HZ - 6, '#5a2a52', [[3, 4, 1], [7, 2, 2]]);
          s.fillStyle = '#2a1430';
          for (let i = 0; i < 70; i++) { const x = r() * SKYW, w = 8 + r() * 22, h = 8 + r() * 26; s.fillRect(x, HZ - h, w, h); if (x + w > SKYW) s.fillRect(x - SKYW, HZ - h, w, h); }
          s.fillStyle = '#ffd25a'; for (let i = 0; i < 160; i++) s.fillRect(r() * SKYW | 0, HZ - 4 - r() * 26 | 0, 1, 1);
        } else if (kind === 1) {
          s.fillStyle = '#fff'; for (let i = 0; i < 220; i++) { s.globalAlpha = .3 + r() * .7; s.fillRect(r() * SKYW | 0, r() * (HZ - 20) | 0, 1, 1); }
          s.globalAlpha = 1; s.fillStyle = '#d8f4ff'; s.beginPath(); s.arc(700, 22, 9, 0, TAU); s.fill();
          s.fillStyle = '#0c3a48'; s.beginPath(); s.arc(704, 20, 8, 0, TAU); s.fill();
          ridge(6, HZ - 4, '#0a2a36', [[2, 6, 0], [5, 4, 1], [11, 2, 3]]);
          s.fillStyle = '#3ae0ff'; for (let x = 0; x < SKYW; x += 32) s.fillRect(x, HZ - 2, 12, 1);
        } else {
          s.fillStyle = 'rgba(255,255,255,.55)';
          for (let i = 0; i < 28; i++) { const x = r() * SKYW, y = 8 + r() * 36, w = 30 + r() * 60; [0, -SKYW, SKYW].forEach(o => { s.beginPath(); s.ellipse(x + o, y, w, 5 + r() * 4, 0, 0, TAU); s.fill(); }); }
          ridge(12, HZ - 2, '#8a9cb4', [[2, 8, 0], [4, 5, 2], [9, 2, 1]]);
          ridge(2, HZ - 2, '#6d7f8e', [[3, 6, 1], [7, 3, 0]]);
        }
        const d = s.getImageData(0, 0, SKYW, HZ); return new Uint32Array(d.data.buffer.slice(0));
      }
      const THEMES = [
        { fog: [176, 104, 96], fogDist: 15, sky: ['#140c34', '#5a2468', '#b0607a', '#b06860'], cap: [118, 60, 46], floor: 0 },
        { fog: [18, 66, 80], fogDist: 14, sky: ['#01040c', '#04121e', '#0a3040', '#124250'], cap: [70, 82, 98], floor: 1 },
        { fog: [182, 196, 208], fogDist: 16, sky: ['#4a6e9a', '#86a4c4', '#b0c2d2', '#b6c4d0'], cap: [104, 104, 98], floor: 2 }
      ];
      THEMES.forEach((th, i) => {
        const main = i === 0 ? texBrick(11, [158, 62, 44], false) : i === 1 ? texTech(21, false) : texStone(31, false);
        const acc = i === 0 ? texBrick(12, [150, 70, 54], true) : i === 1 ? texTech(22, true) : texStone(32, true);
        th.walls = [null, main, acc, texPod].map(t => t && [shade(t, th.fog, 1, true), shade(t, th.fog, .74, true)]);
        th.floorT = shade(texFloor(th.floor, 40 + i), th.fog, 1, false);
        th.padT = shade(texPad, th.fog, 1, false);
        th.caps = [];
        [th.cap, th.cap, th.cap, [235, 196, 40]].forEach((c, k) => { th.caps[k] = []; for (let l = 0; l < 16; l++) { const f = Math.pow(l / 15, 1.15); th.caps[k][l] = pack(c[0] * (1 - f) + th.fog[0] * f, c[1] * (1 - f) + th.fog[1] * f, c[2] * (1 - f) + th.fog[2] * f); } });
        th.skyT = makeSky(i);
      });

      /* ---------- sprites (drawn with Canvas 2D, read back as pixel arrays) ---------- */
      function readSprite(c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height), u = new Uint32Array(d.data.buffer.slice(0)); for (let i = 0; i < u.length; i++) if ((u[i] >>> 24) < 128) u[i] = 0; else u[i] = (u[i] | 0xff000000) >>> 0; return { w: c.width, h: c.height, d: u }; }
      const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      function craftFrames(body, dark) {
        const oct = (a, b) => [[a, 0], [a * .72, b * .82], [0, b], [-a * .8, b * .9], [-a, 0], [-a * .8, -b * .9], [0, -b], [a * .72, -b * .82]];
        const box = (x0, x1, y0, y1) => [[x1, y0], [x1, y1], [x0, y1], [x0, y0]];
        const parts = [
          [oct(.5, .4), 0, .1, '#26262c'],
          [oct(.47, .37), .1, .22, body],
          [[[.3, 0], [.18, .13], [-.06, .13], [-.06, -.13], [.18, -.13]], .22, .35, '#8fe6ff'],
          [box(-.46, -.28, -.035, .035), .22, .48, dark],
          [box(-.5, -.3, .17, .3), .14, .3, '#a0a0aa'],
          [box(-.5, -.3, -.3, -.17), .14, .3, '#a0a0aa']
        ];
        const el = 15 * Math.PI / 180, ce = Math.cos(el), se = Math.sin(el), S = 40, FW = 48, FH = 32, BASE = 25;
        const L = (() => { const v = [-.45, -.5, .75], m = Math.hypot(...v); return v.map(q => q / m); })();
        const rgb = hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
        const frames = [];
        for (let k = 0; k < 8; k++) {
          const rel = k * Math.PI / 4, cr = Math.cos(rel), sr = Math.sin(rel), c = mkc(FW, FH), s = c.getContext('2d');
          s.fillStyle = '#7fd8ff'; s.beginPath(); s.ellipse(FW / 2, BASE + 1.5, 19, 3, 0, 0, TAU); s.fill();
          const faces = [];
          parts.forEach(([fp, z0, z1, col]) => {
            const pts = fp.map(([x, y]) => [x * cr - y * sr, x * sr + y * cr]);
            const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
            faces.push({ v: pts.map(q => [q[0], q[1], z1]), n: [0, 0, 1], col });
            for (let i = 0; i < pts.length; i++) {
              const a = pts[i], b = pts[(i + 1) % pts.length], rear = fp[i][0] < -.45 && fp[(i + 1) % fp.length][0] < -.45; let nx = b[1] - a[1], ny = -(b[0] - a[0]); const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
              if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
              faces.push({ v: [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], n: [nx, ny, 0], col: rear && col === '#a0a0aa' ? '#ff9a2a' : col });
            }
          });
          const vis = faces.filter(f => f.n[0] * ce - f.n[2] * se < 0.001);
          vis.forEach(f => { f.dep = f.v.reduce((a, q) => a + q[0] * ce - q[2] * se, 0) / f.v.length; });
          vis.sort((a, b) => b.dep - a.dep);
          vis.forEach(f => {
            const br = .45 + .55 * Math.max(0, f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]);
            const cc = rgb(f.col);
            const glow = f.col === '#ff9a2a' ? 1.25 : br;
            s.fillStyle = `rgb(${cl(cc[0] * glow)},${cl(cc[1] * glow)},${cl(cc[2] * glow)})`;
            s.beginPath(); f.v.forEach(([x, y, z], i) => { const X = FW / 2 + y * S, Y = BASE - (z * ce + x * se) * S; i ? s.lineTo(X, Y) : s.moveTo(X, Y); }); s.closePath(); s.fill();
          });
          frames.push(readSprite(c));
        }
        return frames;
      }
      const ENEMY_FR = craftFrames('#d8282a', '#801418');
      function flagFrames(col, dark) {
        const out = [];
        for (let f = 0; f < 4; f++) {
          const c = mkc(32, 48), s = c.getContext('2d');
          s.fillStyle = '#3a3a40'; s.fillRect(4, 44, 10, 4); s.fillStyle = '#d0d0d8'; s.fillRect(8, 2, 2, 43); s.fillStyle = '#ffd23f'; s.fillRect(7, 0, 4, 3);
          for (let x = 0; x < 21; x++) {
            const wv = Math.sin(x * .38 - f * Math.PI / 2) * 2.2 * (x / 20), y0 = 4 + wv;
            s.fillStyle = (x + f) % 7 < 1 ? dark : col; s.fillRect(10 + x, y0, 1, 15 - x * .18);
          }
          s.fillStyle = '#fff'; s.fillRect(16, 9, 5, 5);
          out.push(readSprite(c));
        }
        return out;
      }
      const RED_FL = flagFrames('#e3242b', '#8a1218'), BLUE_FL = flagFrames('#2a72ff', '#123a8a');
      function pickupSprite(kind) {
        const c = mkc(24, 24), s = c.getContext('2d');
        if (kind === 'spring') {
          s.fillStyle = '#555'; s.fillRect(2, 20, 20, 4); s.fillStyle = '#ccc'; s.fillRect(4, 1, 16, 3);
          for (let i = 0; i < 4; i++) { s.fillStyle = i & 1 ? '#1a7a2a' : '#3ad04a'; s.fillRect(5 + (i & 1) * 2, 5 + i * 4, 13, 3); }
        } else if (kind === 'wall') {
          s.fillStyle = '#222'; s.fillRect(2, 2, 20, 20); s.fillStyle = '#f2c81e';
          for (let y = 0; y < 20; y += 5) for (let x = 0; x < 20; x += 5) if (((x + y) / 5) & 1) s.fillRect(2 + x, 2 + y, 5, 5);
          s.strokeStyle = '#6ae0ff'; s.lineWidth = 2; s.strokeRect(2, 2, 20, 20);
        } else if (kind === 'boost') {
          s.fillStyle = '#222'; s.beginPath(); s.arc(12, 12, 11, 0, TAU); s.fill();
          s.fillStyle = '#ff8a1a'; [[4, 6], [11, 6]].forEach(([x]) => { s.beginPath(); s.moveTo(x, 5); s.lineTo(x + 6, 12); s.lineTo(x, 19); s.lineTo(x + 3, 12); s.fill(); });
        } else {
          s.fillStyle = '#0a5a7a'; s.beginPath(); s.arc(12, 12, 11, 0, TAU); s.fill();
          s.fillStyle = '#3ad8ff'; s.beginPath(); s.arc(12, 12, 9, 0, TAU); s.fill();
          s.fillStyle = '#e8ffff'; s.fillRect(7, 6, 4, 3); s.fillStyle = '#0a5a7a'; s.fillRect(9, 11, 6, 5);
        }
        return readSprite(c);
      }
      const PICK_SPR = { spring: pickupSprite('spring'), wall: pickupSprite('wall'), boost: pickupSprite('boost'), cloak: pickupSprite('cloak') };

      /* ================= state ================= */
      const EYE = .5, GHOST = 1.25, GRAV = 7.5, JUMPV = 4.3, BOUNCE = .4;
      let L = LEVELS[0], level = 0, theme = THEMES[0], MW = 15, MH = 15, grid = new Uint8Array(1), pads = new Uint8Array(1);
      let flags = [], enemies = [], pickups = [], podWalls = [], msg = null, flash = 0, flashCol = '255,40,40';
      let state = 'title', score = 0, timeLeft = 0, redGot = 0, blueLost = 0, introT = 0, t = 0, clearInfo = null, dialogOpen = false, lastTick = 0;
      const p = { x: 1.5, y: 1.5, vx: 0, vy: 0, a: 0, av: 0, z: EYE, vz: 0, r: .28, slow: 0, boost: 0, cloak: 0, inv: { spring: 0, wall: 0, cloak: 0 } };
      const keys = { up: false, down: false, left: false, right: false }, pressed = {};

      const open = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && grid[y * MW + x] === 0;
      const solidAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return cx < 0 || cy < 0 || cx >= MW || cy >= MH || grid[cy * MW + cx] !== 0; };
      const collides = (x, y, r) => solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
      const cellOf = e => Math.floor(e.y) * MW + Math.floor(e.x);

      function bfs(from) {
        const dist = new Int16Array(MW * MH).fill(-1), prev = new Int32Array(MW * MH).fill(-1), q = new Int32Array(MW * MH);
        let h = 0, tl = 0; dist[from] = 0; q[tl++] = from;
        while (h < tl) {
          const c = q[h++], x = c % MW, y = (c / MW) | 0;
          for (let k = 0; k < 4; k++) {
            const nx = x + (k === 0) - (k === 1), ny = y + (k === 2) - (k === 3);
            if (!open(nx, ny)) continue; const n = ny * MW + nx; if (dist[n] >= 0) continue;
            dist[n] = dist[c] + 1; prev[n] = c; q[tl++] = n;
          }
        }
        return { dist, prev };
      }
      function pathTo(from, to) {
        if (!open(from % MW, (from / MW) | 0)) return [];
        const { dist, prev } = bfs(from); if (dist[to] < 0) return [];
        const path = []; for (let c = to; c !== from && c >= 0; c = prev[c]) path.push(c);
        return path.reverse();
      }

      function genMaze(n) {
        MW = MH = 2 * n + 1; grid = new Uint8Array(MW * MH).fill(1); pads = new Uint8Array(MW * MH);
        const seen = new Uint8Array(n * n), st = [0]; seen[0] = 1; grid[MW + 1] = 0;
        while (st.length) {
          const c = st[st.length - 1], cx = c % n, cy = (c / n) | 0, nb = [];
          if (cx > 0 && !seen[c - 1]) nb.push(c - 1); if (cx < n - 1 && !seen[c + 1]) nb.push(c + 1);
          if (cy > 0 && !seen[c - n]) nb.push(c - n); if (cy < n - 1 && !seen[c + n]) nb.push(c + n);
          if (!nb.length) { st.pop(); continue; }
          const m = nb[Math.random() * nb.length | 0], mx = m % n, my = (m / n) | 0;
          grid[(2 * my + 1) * MW + 2 * mx + 1] = 0; grid[(cy + my + 1) * MW + cx + mx + 1] = 0;
          seen[m] = 1; st.push(m);
        }
        // knock out some walls for loops (multiple paths)
        for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
          if (grid[y * MW + x] !== 1 || ((x + y) & 1) === 0) continue;
          const horiz = open(x - 1, y) && open(x + 1, y), vert = open(x, y - 1) && open(x, y + 1);
          if ((horiz || vert) && Math.random() < .2) grid[y * MW + x] = 0;
        }
        for (let i = 0; i < MW * MH; i++) if (grid[i] === 1 && Math.random() < .09) grid[i] = 2;
      }

      function loadLevel(li) {
        level = li; L = LEVELS[li]; theme = THEMES[li];
        genMaze(L.cells);
        const start = MW + 1, { dist } = bfs(start);
        const cells = []; let maxD = 1;
        for (let i = 0; i < MW * MH; i++) if (dist[i] > 0) { cells.push(i); if (dist[i] > maxD) maxD = dist[i]; }
        const used = new Set([start]);
        const cx = c => c % MW + .5, cy = c => ((c / MW) | 0) + .5;
        const pick = (lo, hi, count, minSep, roomOnly) => {
          const cand = cells.filter(c => !used.has(c) && dist[c] >= lo * maxD && dist[c] <= hi * maxD && (!roomOnly || ((c % MW) & 1 && ((c / MW) | 0) & 1)));
          const out = [];
          for (let k = 0; k < count && cand.length; k++) {
            let best = -1, bs = -1;
            for (let j = 0; j < 30; j++) {
              const c = cand[Math.random() * cand.length | 0]; if (used.has(c)) continue;
              const sep = out.length ? Math.min(...out.map(o => Math.hypot(cx(o) - cx(c), cy(o) - cy(c)))) : 99;
              const sc = Math.min(sep, minSep * 2) + Math.random(); if (sc > bs) { bs = sc; best = c; }
            }
            if (best < 0) break; out.push(best); used.add(best);
          }
          return out;
        };
        const spawn = pick(.85, 1, L.enemies, 1, false);
        flags = [
          ...pick(.12, .45, 3, 3, true).map(c => ({ x: cx(c), y: cy(c), team: 'blue', taken: false })),
          ...pick(.6, 1, 3, 3, true).map(c => ({ x: cx(c), y: cy(c), team: 'red', taken: false }))
        ];
        pick(.15, 1, L.pads, 2, false).forEach(c => { pads[c] = 1; });
        pickups = [];
        [['spring', 3], ['wall', 2], ['boost', 2], ['cloak', 1 + (li > 0)]].forEach(([k, n]) => pick(.08, 1, n, 2, false).forEach(c => pickups.push({ kind: k, x: cx(c), y: cy(c), on: true, respawn: 0, ph: Math.random() * 6 })));
        enemies = spawn.map((c, i) => ({ x: cx(c), y: cy(c), vx: 0, vy: 0, a: Math.random() * TAU, z: 0, path: [], pi: 0, think: .5 + i * .4, mode: 'flag', stuck: 0, stun: 0, slow: 0, bumpCd: 0, r: .28, home: c, carry: null }));
        Object.assign(p, { x: 1.5, y: 1.5, vx: 0, vy: 0, av: 0, z: EYE, vz: 0, slow: 0, boost: 0, cloak: 0 });
        p.a = open(2, 1) ? 0 : Math.PI / 2;
        p.inv = { spring: 1, wall: 1, cloak: 0 };
        podWalls = []; redGot = 0; blueLost = 0; timeLeft = L.time; msg = null; flash = 0; clearInfo = null;
        win.status(`Level ${li + 1}: ${L.name}`, coarse ? 'Arrows steer · JUMP / WALL / CLOAK' : 'Arrows drive · Space spring · Z wall · X cloak · P pause');
        radarDirty = true;
      }
      function startLevel(li) { loadLevel(li); state = 'intro'; introT = 2.6; beep(392, .1, 'square', .03); beep(523, .14, 'square', .03, 0, .1); }
      function newGame() { score = 0; startLevel(0); win.focus(); }
      function say(text, col = '#fff', dur = 2.2) { msg = { text, col, t: dur }; }

      /* ================= simulation ================= */
      function moveEnt(e, dt, ghost) {
        let hit = 0;
        const nx = e.x + e.vx * dt;
        if (!ghost && collides(nx, e.y, e.r)) { hit = Math.abs(e.vx); e.vx = -e.vx * BOUNCE; } else e.x = nx;
        const ny = e.y + e.vy * dt;
        if (!ghost && collides(e.x, ny, e.r)) { hit = Math.max(hit, Math.abs(e.vy)); e.vy = -e.vy * BOUNCE; } else e.y = ny;
        e.x = Math.min(Math.max(e.x, 1 + e.r), MW - 1 - e.r); e.y = Math.min(Math.max(e.y, 1 + e.r), MH - 1 - e.r);
        return hit;
      }
      function damp(e, dt, fwdK, latK) {
        const c = Math.cos(e.a), s = Math.sin(e.a); let f = e.vx * c + e.vy * s, l = -e.vx * s + e.vy * c;
        f *= Math.exp(-fwdK * dt); l *= Math.exp(-latK * dt);
        e.vx = f * c - l * s; e.vy = f * s + l * c;
      }
      function capSpeed(e, max) { const sp = Math.hypot(e.vx, e.vy); if (sp > max) { const k = max / sp; e.vx *= k; e.vy *= k; } return sp; }
      function los(a, b) {
        const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / .25);
        for (let i = 1; i < n; i++) if (solidAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
        return true;
      }
      function think(e) {
        const ec = cellOf(e), pd = Math.hypot(p.x - e.x, p.y - e.y);
        let target = -1;
        if (e.carry) { e.mode = 'home'; e.think = 4; e.path = pathTo(ec, e.home); e.pi = 0; return; }
        if (!p.cloak && p.z < GHOST && pd < 4.5 && Math.random() < .55 * L.aggr && los(e, p)) { e.mode = 'ram'; e.think = 1.2; target = cellOf(p); }
        else if (Math.random() < L.aggr) {
          const { dist } = bfs(ec); let bd = 1e9;
          flags.forEach(f => { if (f.team === 'blue' && !f.taken && !f.carrier) { const c = Math.floor(f.y) * MW + Math.floor(f.x); if (dist[c] >= 0 && dist[c] < bd) { bd = dist[c]; target = c; } } });
          e.mode = 'flag'; e.think = 3 + Math.random() * 2;
        }
        if (target < 0) {
          const cand = []; for (let i = 0; i < MW * MH; i++) if (grid[i] === 0) cand.push(i);
          target = cand[Math.random() * cand.length | 0]; e.mode = 'wander'; e.think = 3 + Math.random() * 3;
        }
        e.path = pathTo(ec, target); e.pi = 0;
      }
      function rethinkAll() { enemies.forEach(e => { e.think = Math.min(e.think, Math.random() * .3); }); }

      function update(dt) {
        timeLeft -= dt;
        if (timeLeft <= 10 && Math.ceil(timeLeft) !== lastTick && timeLeft > 0) { lastTick = Math.ceil(timeLeft); beep(1200, .05, 'square', .025); }
        if (timeLeft <= 0) { timeLeft = 0; endGame(false, "Time's up!"); return; }
        if (msg && (msg.t -= dt) <= 0) msg = null;
        if (flash > 0) flash -= dt;

        // --- player ---
        const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        p.av += (turn * 2.7 - p.av) * Math.min(1, dt * 14); p.a = wrapA(p.a + p.av * dt);
        const thrust = keys.up ? 1 : keys.down ? -.65 : 0, acc = p.boost > 0 ? 10 : 7;
        p.vx += Math.cos(p.a) * thrust * acc * dt; p.vy += Math.sin(p.a) * thrust * acc * dt;
        const onPad = p.z < .7 && pads[cellOf(p)];
        if (onPad && p.slow <= 0) { beep(300, .35, 'sawtooth', .03, -220); say('SLOWED!', '#e070ff', 1.2); }
        if (onPad) p.slow = 2.5;
        damp(p, dt, p.slow > 0 ? 3.2 : .9, p.slow > 0 ? 4 : 1.8);
        capSpeed(p, p.boost > 0 ? 5.4 : p.slow > 0 ? 1.5 : 3.4);
        if (p.z > EYE || p.vz > 0) {
          p.vz -= GRAV * dt; p.z += p.vz * dt;
          if (p.z < GHOST && p.vz < 0 && collides(p.x, p.y, p.r)) {
            p.z = GHOST; p.vz = 0; // hovering on a wall top: drift to the nearest open cell
            let bx = 0, by = 0, bd = 1e9; const cx = Math.floor(p.x), cy = Math.floor(p.y);
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (open(cx + i, cy + j)) { const d = Math.hypot(cx + i + .5 - p.x, cy + j + .5 - p.y); if (d < bd) { bd = d; bx = cx + i + .5; by = cy + j + .5; } }
            if (bd < 1e9) { p.vx += (bx - p.x) / bd * 10 * dt; p.vy += (by - p.y) / bd * 10 * dt; }
          }
          if (p.z <= EYE) { p.z = EYE; p.vz = 0; beep(120, .08, 'triangle', .05); }
        }
        const hit = moveEnt(p, dt, p.z >= GHOST - .02);
        if (hit > 1.2) beep(90 + hit * 10, .07, 'triangle', .05);
        p.slow = Math.max(0, p.slow - dt); p.boost = Math.max(0, p.boost - dt);
        if (p.cloak > 0 && (p.cloak -= dt) <= 0) { p.cloak = 0; beep(500, .2, 'sine', .03, -300); say('Cloak off', '#9ef0ff', 1.2); }

        if (pressed.jump) {
          if (p.inv.spring > 0 && p.z <= EYE + .01) { p.inv.spring--; p.vz = JUMPV; beep(180, .35, 'square', .035, 700); }
          else if (p.inv.spring <= 0) beep(110, .1, 'square', .03);
        }
        if (pressed.wall) dropWall();
        if (pressed.cloak) {
          if (p.inv.cloak > 0 && p.cloak <= 0) { p.inv.cloak--; p.cloak = 10; rethinkAll(); [880, 660, 990, 740].forEach((f, i) => beep(f, .08, 'sine', .03, 0, i * .05)); say('CLOAKED', '#9ef0ff', 1.4); }
          else beep(110, .1, 'square', .03);
        }

        // --- flags & pickups ---
        flags.forEach(f => {
          if (f.taken || f.team !== 'red') return;
          if (Math.hypot(f.x - p.x, f.y - p.y) < .5 && p.z < 1.4) {
            f.taken = true; redGot++; score += 500; flash = .3; flashCol = '255,255,255';
            [523, 659, 784, 1047].forEach((q, i) => beep(q, .12, 'square', .035, 0, i * .08));
            say(`RED FLAG CAPTURED! ${redGot}/3`, '#ffd23f'); radarDirty = true;
          }
        });
        if (redGot >= 3) { levelClear(); return; }
        pickups.forEach(k => {
          if (!k.on) { if ((k.respawn -= dt) <= 0) respawnPickup(k); return; }
          if (Math.hypot(k.x - p.x, k.y - p.y) < .45 && p.z < 1.2) {
            k.on = false; k.respawn = 14 + Math.random() * 8; score += 25;
            if (k.kind === 'boost') { p.boost = 6; beep(300, .4, 'sawtooth', .03, 900); say('SPEED BOOST!', '#ffb040', 1.4); }
            else { p.inv[k.kind] = Math.min(9, p.inv[k.kind] + 1); beep(988, .06, 'square', .03); beep(1480, .1, 'square', .03, 0, .06); say({ spring: '+1 SPRING', wall: '+1 WALL POD', cloak: '+1 CLOAK' }[k.kind], '#c8ffc8', 1.2); }
            radarDirty = true;
          }
        });
        for (let i = podWalls.length - 1; i >= 0; i--) {
          const w = podWalls[i];
          if ((w.t -= dt) <= 0) { grid[w.c] = 0; podWalls.splice(i, 1); radarDirty = true; rethinkAll(); }
        }

        // --- enemies ---
        enemies.forEach(e => {
          e.stun = Math.max(0, e.stun - dt); e.bumpCd = Math.max(0, e.bumpCd - dt); e.slow = Math.max(0, e.slow - dt);
          if (pads[cellOf(e)]) e.slow = 2;
          if ((e.think -= dt) <= 0 || e.pi >= e.path.length) think(e);
          let thr = 0;
          if (e.pi < e.path.length && e.stun <= 0) {
            let wp = e.path[e.pi], wx = wp % MW + .5, wy = ((wp / MW) | 0) + .5;
            if (Math.hypot(wx - e.x, wy - e.y) < .35) { e.pi++; if (e.pi < e.path.length) { wp = e.path[e.pi]; wx = wp % MW + .5; wy = ((wp / MW) | 0) + .5; } }
            const diff = wrapA(Math.atan2(wy - e.y, wx - e.x) - e.a), tr = 3.6 * dt;
            e.a = wrapA(e.a + Math.max(-tr, Math.min(tr, diff)));
            thr = Math.abs(diff) < .6 ? 1 : Math.abs(diff) < 1.4 ? .3 : 0;
          }
          e.vx += Math.cos(e.a) * thr * 6 * dt; e.vy += Math.sin(e.a) * thr * 6 * dt;
          damp(e, dt, e.slow > 0 ? 3 : 1.4, 5);
          const sp = capSpeed(e, L.espeed * (e.slow > 0 ? .45 : 1) * (e.carry ? .85 : 1));
          moveEnt(e, dt, false);
          if (thr > 0 && sp < .25) { if ((e.stuck += dt) > 1.2) { e.stuck = 0; e.think = 0; } } else e.stuck = 0;
          // enemy captures a blue flag
          // enemy grabs a blue flag, then must carry it home; bump the carrier to send the flag back
          e.noGrab = Math.max(0, (e.noGrab || 0) - dt);
          if (!e.carry && e.noGrab <= 0) flags.forEach(f => {
            if (e.carry || f.taken || f.carrier || f.team !== 'blue') return;
            if (Math.hypot(f.x - e.x, f.y - e.y) < .5) {
              f.carrier = e; e.carry = f; e.think = 0;
              [660, 520].forEach((q, i) => beep(q, .12, 'sawtooth', .03, 0, i * .1));
              say('THEY GRABBED A BLUE FLAG! BUMP THEM!', '#ff6a5a'); radarDirty = true;
            }
          });
          else if (e.carry && cellOf(e) === e.home && Math.hypot(e.home % MW + .5 - e.x, ((e.home / MW) | 0) + .5 - e.y) < .55) {
            const f = e.carry; f.taken = true; f.carrier = null; e.carry = null; blueLost++; e.think = 0; flash = .35; flashCol = '255,40,40';
            [440, 349, 262].forEach((q, i) => beep(q, .16, 'sawtooth', .035, 0, i * .12));
            say(`BLUE FLAG LOST! ${3 - blueLost} LEFT`, '#ff6a5a'); rethinkAll(); radarDirty = true;
          }
          // bump the player
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
          if (d < .58 && d > 1e-4 && p.cloak <= 0 && p.z < .9 && e.bumpCd <= 0) {
            const nx = dx / d, ny = dy / d, K = 2.8;
            p.vx -= nx * K; p.vy -= ny * K; e.vx += nx * K; e.vy += ny * K;
            const ov = (.58 - d) / 2;
            if (!collides(p.x - nx * ov, p.y - ny * ov, p.r)) { p.x -= nx * ov; p.y -= ny * ov; }
            if (!collides(e.x + nx * ov, e.y + ny * ov, e.r)) { e.x += nx * ov; e.y += ny * ov; }
            e.stun = .5; e.bumpCd = .35; flash = .2; flashCol = '255,160,40';
            if (e.carry) { e.carry.carrier = null; e.carry = null; e.think = 0; e.noGrab = 4; score += 100; say('FLAG RETURNED! +100', '#7ab8ff'); [523, 784].forEach((q, i) => beep(q, .1, 'square', .03, 0, .15 + i * .08)); }
            beep(70, .18, 'triangle', .08, -30); beep(160, .06, 'square', .03);
          }
        });
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
          const a = enemies[i], b = enemies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < .55 && d > 1e-4) { const k = (.55 - d) / 2 / d; if (!collides(a.x - dx * k, a.y - dy * k, a.r)) { a.x -= dx * k; a.y -= dy * k; } if (!collides(b.x + dx * k, b.y + dy * k, b.r)) { b.x += dx * k; b.y += dy * k; } }
        }
        if (blueLost >= 3) endGame(false, 'All your blue flags are gone!');
      }
      function respawnPickup(k) {
        for (let tries = 0; tries < 40; tries++) {
          const x = 1 + (Math.random() * (MW - 2) | 0), y = 1 + (Math.random() * (MH - 2) | 0);
          if (!open(x, y) || pads[y * MW + x] || Math.hypot(x + .5 - p.x, y + .5 - p.y) < 3) continue;
          if (flags.some(f => Math.floor(f.x) === x && Math.floor(f.y) === y)) continue;
          k.x = x + .5; k.y = y + .5; k.on = true; radarDirty = true; return;
        }
        k.respawn = 3;
      }
      function dropWall() {
        if (p.inv.wall <= 0) { beep(110, .1, 'square', .03); return; }
        const cx = Math.floor(p.x - Math.cos(p.a) * .95), cy = Math.floor(p.y - Math.sin(p.a) * .95), c = cy * MW + cx;
        const occupied = e => e.x + e.r > cx && e.x - e.r < cx + 1 && e.y + e.r > cy && e.y - e.r < cy + 1;
        if (!open(cx, cy) || c === cellOf(p) || occupied(p) || enemies.some(occupied) || flags.some(f => !f.taken && Math.floor(f.x) === cx && Math.floor(f.y) === cy)) {
          beep(110, .1, 'square', .03); say("Can't drop a wall here", '#ddd', 1.2); return;
        }
        p.inv.wall--; grid[c] = 3; podWalls.push({ c, t: 15 }); rethinkAll(); radarDirty = true;
        beep(220, .15, 'square', .04, -120); beep(660, .08, 'square', .02, 0, .1);
      }
      function levelClear() {
        const bonus = Math.ceil(timeLeft) * 10 * (level + 1);
        score += bonus; state = 'clear'; clearInfo = { bonus, time: timeLeft };
        engine(0, 0);
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, .14, 'square', .035, 0, i * .09));
      }
      async function endGame(won, why) {
        state = won ? 'won' : 'over'; clearInfo = Object.assign(clearInfo || {}, { why }); engine(0, 0);
        if (!won) [392, 330, 262, 196].forEach((f, i) => beep(f, .22, 'sawtooth', .035, 0, i * .18));
        const list = store.get('scores', []);
        if (score > 0 && (list.length < 10 || score > list[list.length - 1].score)) {
          dialogOpen = true;
          await new Promise(r => setTimeout(r, 700));
          const name = await Arcade.dialog({ title: 'Hover! High Score', text: `${won ? 'You captured every flag in every maze! ' : ''}Score: ${score}. Enter your name for the High Scores:`, icon: 'trophy', input: store.get('name', 'Pilot'), buttons: ['OK', 'Cancel'] });
          dialogOpen = false;
          if (name) {
            store.set('name', name);
            list.push({ name: name.slice(0, 16), score, level: level + 1, won });
            list.sort((a, b) => b.score - a.score); store.set('scores', list.slice(0, 10));
          }
          win.focus();
        }
      }

      /* ================= rendering ================= */
      const MAXH = 8, hD1 = new Float32Array(MAXH), hD2 = new Float32Array(MAXH), hT = new Int8Array(MAXH), hS = new Uint8Array(MAXH), hU = new Uint8Array(MAXH);
      const skyX = new Int32Array(W);
      let camX = 0, camY = 0, camZ = EYE, dirX = 1, dirY = 0, plX = 0, plY = 1;
      function draw3D(px, py, pa, cz) {
        camX = px; camY = py; camZ = cz; dirX = Math.cos(pa); dirY = Math.sin(pa); plX = -dirY * TANF; plY = dirX * TANF;
        const fogK = 15 / theme.fogDist, sky = theme.skyT;
        // sky
        for (let x = 0; x < W; x++) { let s = ((pa + angOff[x]) / TAU * SKYW) % SKYW; if (s < 0) s += SKYW; skyX[x] = s | 0; }
        for (let y = 0; y < HZ; y++) { const row = y * SKYW, o = y * W; for (let x = 0; x < W; x++) { buf[o + x] = sky[row + skyX[x]]; zb[o + x] = 1e9; } }
        // floor (cast per row)
        const fl = theme.floorT, pd = theme.padT, rx0 = dirX - plX, ry0 = dirY - plY, rx1 = dirX + plX, ry1 = dirY + plY;
        for (let y = HZ; y < H; y++) {
          const rd = cz * PROJ / (y - HZ + .5), lv = Math.min(15, rd * fogK | 0), off = lv * 4096;
          let fx = px + rd * rx0, fy = py + rd * ry0; const sx = rd * (rx1 - rx0) / W, sy = rd * (ry1 - ry0) / W;
          let i = y * W;
          for (let x = 0; x < W; x++, i++, fx += sx, fy += sy) {
            const cx = Math.floor(fx), cy = Math.floor(fy), tx = ((fx - cx) * 64) | 0, ty = ((fy - cy) * 64) | 0;
            const tex = cx >= 0 && cy >= 0 && cx < MW && cy < MH && pads[cy * MW + cx] ? pd : fl;
            buf[i] = tex[off + (ty << 6) + tx]; zb[i] = rd;
          }
        }
        // walls: DDA, multiple hits when the eye is above wall height
        const air = cz > 1.0, mapX0 = Math.floor(px), mapY0 = Math.floor(py), maxD = theme.fogDist + 2;
        for (let x = 0; x < W; x++) {
          const cam = 2 * x / W - 1, rdx = dirX + plX * cam, rdy = dirY + plY * cam;
          let mx = mapX0, my = mapY0;
          const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy), stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
          let sdx = (rdx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (rdy < 0 ? py - my : my + 1 - py) * ddy;
          let n = 0, inWall = false, side = 0;
          if (air && mx >= 0 && my >= 0 && mx < MW && my < MH && grid[my * MW + mx]) { inWall = true; hD1[0] = .05; hT[0] = -1; hS[0] = 0; hU[0] = 0; }
          for (let st = 0; st < 80; st++) {
            if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
            const d = side === 0 ? sdx - ddx : sdy - ddy;
            if (mx < 0 || my < 0 || mx >= MW || my >= MH || d > maxD) { if (inWall) { hD2[n] = d; n++; } break; }
            const cell = grid[my * MW + mx];
            if (cell) {
              if (!inWall) {
                hD1[n] = d; hT[n] = cell; hS[n] = side;
                let wx = side === 0 ? py + d * rdy : px + d * rdx; wx -= Math.floor(wx);
                let u = (wx * 64) | 0; if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) u = 63 - u; hU[n] = u;
                inWall = true;
                if (!air) { n = 1; break; }
              }
            } else if (inWall) { hD2[n] = d; n++; inWall = false; if (n >= MAXH) break; }
          }
          for (let k = n - 1; k >= 0; k--) {
            const d1 = hD1[k], s = PROJ / d1, lv = Math.min(15, d1 * fogK | 0);
            if (hT[k] >= 0) {
              const yT = HZ - (1 - cz) * s, yB = HZ + cz * s, tex = theme.walls[hT[k]][hS[k]], off = lv * 4096 + hU[k] * 64;
              const y0 = Math.max(0, Math.ceil(yT)), y1 = Math.min(H - 1, Math.floor(yB)), vs = 64 / (yB - yT);
              let v = (y0 - yT) * vs, i = y0 * W + x;
              for (let y = y0; y <= y1; y++, i += W, v += vs) { buf[i] = tex[off + ((v | 0) & 63)]; zb[i] = d1; }
            }
            if (air) {
              const ya = HZ + (cz - 1) * s, yc = HZ + (cz - 1) * PROJ / hD2[k], col = theme.caps[hT[k] < 0 ? 1 : hT[k]][lv];
              const y0 = Math.max(0, Math.ceil(yc)), y1 = Math.min(H - 1, Math.floor(ya));
              let i = y0 * W + x; for (let y = y0; y <= y1; y++, i += W) { buf[i] = col; zb[i] = d1; }
            }
          }
        }
      }
      function drawSprite(sp, sx, sy, z0, ww, hh) {
        const dx = sx - camX, dy = sy - camY, dep = dx * dirX + dy * dirY;
        if (dep < .2) return;
        const lat = -dx * dirY + dy * dirX, sc = PROJ / dep, cxs = W / 2 + lat * sc, sw = ww * sc;
        const x0 = cxs - sw / 2, yT = HZ + (camZ - z0 - hh) * sc, yB = HZ + (camZ - z0) * sc, sh = yB - yT;
        const xa = Math.max(0, Math.ceil(x0)), xb = Math.min(W - 1, Math.floor(x0 + sw)), ya = Math.max(0, Math.ceil(yT)), yb = Math.min(H - 1, Math.floor(yB));
        if (xa > xb || ya > yb) return;
        const f = Math.pow(Math.min(15, dep * 15 / theme.fogDist) / 15, 1.15), k = 1 - f, fr = theme.fog[0] * f, fg = theme.fog[1] * f, fb = theme.fog[2] * f;
        const iw = sp.w, ih = sp.h, d = sp.d;
        for (let x = xa; x <= xb; x++) {
          const u = Math.min(iw - 1, ((x - x0) / sw * iw) | 0);
          for (let y = ya; y <= yb; y++) {
            const i = y * W + x; if (dep >= zb[i]) continue;
            const c = d[Math.min(ih - 1, ((y - yT) / sh * ih) | 0) * iw + u]; if (!c) continue;
            buf[i] = (0xff000000 | (((c >> 16 & 255) * k + fb) << 16) | (((c >> 8 & 255) * k + fg) << 8) | ((c & 255) * k + fr)) >>> 0; zb[i] = dep;
          }
        }
      }
      function drawScene(px, py, pa, cz) {
        draw3D(px, py, pa, cz);
        const fi = (t * 8 | 0) & 3;
        flags.forEach(f => {
          if (f.taken) return;
          if (f.carrier) drawSprite(BLUE_FL[fi], f.carrier.x, f.carrier.y, .3, .32, .48);
          else drawSprite((f.team === 'red' ? RED_FL : BLUE_FL)[fi], f.x, f.y, 0, .45, .68);
        });
        pickups.forEach(k => { if (k.on) drawSprite(PICK_SPR[k.kind], k.x, k.y, .12 + Math.sin(t * 3 + k.ph) * .05, .3, .3); });
        enemies.forEach(e => {
          const rel = wrapA(e.a - Math.atan2(e.y - py, e.x - px)), fr = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
          drawSprite(ENEMY_FR[fr], e.x, e.y, .03 + Math.sin(t * 6 + e.x) * .015, .78, .52);
        });
        g.putImageData(img, 0, 0);
      }

      const FONT = s => `${s}px "Press Start 2P", "Courier New", monospace`;
      function text(s, x, y, col, size = 8, align = 'center') {
        g.font = FONT(size); g.textAlign = align; g.textBaseline = 'alphabetic';
        g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
      }
      function box(title, lines, foot, dy = 0) {
        const bw = 252, lh = 12, bh = 24 + lines.length * lh + (foot ? 16 : 4), bx = (W - bw) / 2 | 0, by = ((H - bh) / 2 | 0) + dy;
        g.fillStyle = '#c3c3c6'; g.fillRect(bx, by, bw, bh);
        g.fillStyle = '#fff'; g.fillRect(bx, by, bw, 1); g.fillRect(bx, by, 1, bh);
        g.fillStyle = '#0c0c10'; g.fillRect(bx, by + bh - 1, bw, 1); g.fillRect(bx + bw - 1, by, 1, bh);
        g.fillStyle = '#85858c'; g.fillRect(bx + 1, by + bh - 2, bw - 2, 1); g.fillRect(bx + bw - 2, by + 1, 1, bh - 2);
        const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#0a1a86'); gr.addColorStop(1, '#1d8ad6');
        g.fillStyle = gr; g.fillRect(bx + 3, by + 3, bw - 6, 12);
        g.font = FONT(8); g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(title, bx + 6, by + 13);
        lines.forEach((ln, i) => {
          const y = by + 30 + i * lh;
          g.font = FONT(8);
          if (Array.isArray(ln)) { g.fillStyle = ln[2] || '#101014'; g.textAlign = 'left'; g.fillText(ln[0], bx + 10, y); g.textAlign = 'right'; g.fillText(ln[1], bx + bw - 10, y); }
          else { g.fillStyle = '#101014'; g.textAlign = 'center'; g.fillText(ln, W / 2, y); }
        });
        if (foot && Math.sin(t * 5) > -.3) { g.font = FONT(8); g.textAlign = 'center'; g.fillStyle = '#0a1a86'; g.fillText(foot, W / 2, by + bh - 7); }
      }
      function drawLogo(y) {
        const s = 'HOVER!', cols = ['#ff3d3d', '#ffd23f', '#3ad04a', '#3a8cff', '#d23cff', '#ffffff'];
        g.font = FONT(20); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        const wd = g.measureText(s).width; let x = (W - wd) / 2;
        [...s].forEach((ch, i) => { const yy = y + Math.sin(t * 4 + i * .7) * 3; g.fillStyle = '#000'; g.fillText(ch, x + 2, yy + 2); g.fillStyle = cols[i]; g.fillText(ch, x, yy); x += g.measureText(ch).width; });
      }
      function overlays() {
        // craft nose + effects
        const bob = Math.sin(t * 5) * 1.2, ny = H - 9 + bob;
        g.fillStyle = '#1a3f9a'; g.beginPath(); g.moveTo(92, H); g.lineTo(130, ny); g.lineTo(190, ny); g.lineTo(228, H); g.fill();
        g.fillStyle = '#5a9cff'; g.fillRect(130, ny, 60, 1.5); g.fillStyle = '#9ef0ff'; g.fillRect(150, ny + 2, 20, 3);
        if (p.cloak > 0) { g.fillStyle = `rgba(80,220,255,${.12 + Math.sin(t * 9) * .04})`; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(200,255,255,.12)'; for (let y = (t * 40) % 6 | 0; y < H; y += 6) g.fillRect(0, y, W, 1); }
        if (p.boost > 0) { g.strokeStyle = 'rgba(255,220,140,.55)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * 3, r0 = 70 + (t * 300 + i * 37) % 60; g.moveTo(W / 2 + Math.cos(a) * r0 * 1.6, HZ + Math.sin(a) * r0); g.lineTo(W / 2 + Math.cos(a) * (r0 + 18) * 1.6, HZ + Math.sin(a) * (r0 + 18)); } g.stroke(); }
        if (p.slow > 0) { g.fillStyle = 'rgba(160,40,200,.18)'; g.fillRect(0, 0, W, H); }
        if (flash > 0) { g.fillStyle = `rgba(${flashCol},${Math.min(.5, flash * 1.6)})`; g.fillRect(0, 0, W, H); }
        if (p.z > EYE + .05) text('SPRING!', W / 2, 20, '#7aff8a');
        if (msg) text(msg.text, W / 2, 40, msg.col);
        if (state === 'play' && timeLeft < 10 && Math.sin(t * 10) > 0) text(Math.ceil(timeLeft) + '', W / 2, 60, '#ff4040', 16);
      }
      function render() {
        if (state === 'title') {
          drawScene(p.x, p.y, p.a, EYE + Math.sin(t * 1.3) * .05);
          drawLogo(30);
          box('Hover!', ['Capture the 3 red flags', 'before they take your 3 blue.', coarse ? '' : 'Arrows drive  SPACE spring', coarse ? '' : 'Z drop wall  X cloak  P pause'].filter(Boolean), coarse ? 'TAP TO START' : 'PRESS ENTER TO START', 18);
          return;
        }
        const cz = p.z + (p.z <= EYE + .001 ? Math.sin(t * 5) * .01 : 0);
        drawScene(p.x, p.y, p.a, cz);
        overlays();
        if (state === 'intro') box(`Level ${level + 1}`, [L.name, `${L.enemies} enemy hovercraft`, `Time limit ${fmtT(L.time)}`], coarse ? 'TAP TO GO' : 'ENTER TO GO');
        else if (state === 'paused') box('Paused', ['Your engine is idling.', ['Red flags', `${redGot}/3`], ['Time left', fmtT(timeLeft)]], coarse ? 'TAP TO RESUME' : 'P OR ENTER TO RESUME');
        else if (state === 'clear') box('Level complete!', [['Flags captured', '3/3'], ['Time left', fmtT(clearInfo.time)], ['Time bonus', '+' + clearInfo.bonus, '#0a6a2a'], ['Score', String(score)]], level < LEVELS.length - 1 ? (coarse ? 'TAP FOR NEXT MAZE' : 'ENTER FOR NEXT MAZE') : (coarse ? 'TAP TO FINISH' : 'ENTER TO FINISH'));
        else if (state === 'over') box('Game over', [clearInfo && clearInfo.why || '', ['Level', String(level + 1)], ['Final score', String(score), '#b5203a']], dialogOpen ? '' : (coarse ? 'TAP FOR TITLE' : 'ENTER FOR TITLE'));
        else if (state === 'won') box('You win!', ['All three mazes cleared!', ['Final score', String(score), '#0a6a2a']], dialogOpen ? '' : (coarse ? 'TAP FOR TITLE' : 'ENTER FOR TITLE'));
      }
      const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

      /* ---------- radar + dashboard ---------- */
      let radarDirty = true, radarBase = null;
      function drawRadar() {
        const cs = Math.floor(96 / MW), o = (96 - cs * MW) >> 1;
        if (radarDirty || !radarBase) {
          radarBase = radarBase || mkc(96, 96); const b = radarBase.getContext('2d');
          b.fillStyle = '#001408'; b.fillRect(0, 0, 96, 96);
          for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
            const c = grid[y * MW + x];
            if (c) { b.fillStyle = c === 3 ? '#ffd23f' : '#1f7a40'; b.fillRect(o + x * cs, o + y * cs, cs, cs); }
            else if (pads[y * MW + x]) { b.fillStyle = '#7a1f8a'; b.fillRect(o + x * cs + 1, o + y * cs + 1, cs - 2, cs - 2); }
          }
          radarDirty = false;
        }
        rg.drawImage(radarBase, 0, 0);
        const P = (x, y, col, s) => { rg.fillStyle = col; rg.fillRect(Math.round(o + x * cs - s / 2), Math.round(o + y * cs - s / 2), s, s); };
        pickups.forEach(k => { if (k.on) P(k.x, k.y, '#d8d8d8', 2); });
        const blink = Math.sin(t * 8) > 0;
        flags.forEach(f => { if (f.carrier) { if (blink) P(f.carrier.x, f.carrier.y, '#3a8cff', 5); } else if (!f.taken) P(f.x, f.y, f.team === 'blue' ? '#3a8cff' : (blink ? '#ff3030' : '#ffa0a0'), cs >= 5 ? 4 : 3); });
        enemies.forEach(e => P(e.x, e.y, '#ff6a2a', 3));
        // player arrow
        const X = o + p.x * cs, Y = o + p.y * cs, c = Math.cos(p.a), s = Math.sin(p.a);
        rg.fillStyle = p.cloak > 0 ? '#9ef0ff' : '#fff'; rg.beginPath();
        rg.moveTo(X + c * 4.5, Y + s * 4.5); rg.lineTo(X - c * 3 - s * 3, Y - s * 3 + c * 3); rg.lineTo(X - c * 3 + s * 3, Y - s * 3 - c * 3); rg.fill();
        // sweep
        const sa = t * 2.5; rg.strokeStyle = 'rgba(80,255,120,.35)'; rg.lineWidth = 1; rg.beginPath(); rg.moveTo(48, 48); rg.lineTo(48 + Math.cos(sa) * 70, 48 + Math.sin(sa) * 70); rg.stroke();
      }
      const hudEl = {
        red: win.body.querySelector('[data-f="red"]'), blue: win.body.querySelector('[data-f="blue"]'),
        score: win.body.querySelector('[data-v="score"]'), time: win.body.querySelector('[data-v="time"]'),
        slots: {}
      };
      win.body.querySelectorAll('.hov-slot').forEach(s => { hudEl.slots[s.dataset.s] = { el: s, b: s.querySelector('b'), i: s.querySelector('i'), last: '' }; });
      const hudLast = {};
      function setIf(key, el, val, prop = 'textContent') { if (hudLast[key] !== val) { hudLast[key] = val; el[prop] = val; } }
      function hud() {
        setIf('red', hudEl.red, [0, 1, 2].map(i => i < redGot ? flagSvg('#e3242b') : flagSvg('#e3242b').replace('<svg', '<svg class="hov-off"')).join(''), 'innerHTML');
        setIf('blue', hudEl.blue, flags.filter(f => f.team === 'blue').map(f => flagSvg('#2a72ff').replace('<svg', `<svg class="${f.taken ? 'hov-off' : f.carrier ? 'hov-carry' : ''}"`)).join(''), 'innerHTML');
        setIf('score', hudEl.score, String(score).padStart(6, '0'));
        setIf('time', hudEl.time, fmtT(state === 'title' ? LEVELS[0].time : timeLeft));
        const S = hudEl.slots;
        const slotSet = (k, count, meter, on, warn) => {
          const s = S[k], key = count + '|' + (meter * 20 | 0) + on + warn; if (s.last === key) return; s.last = key;
          s.b.textContent = count; s.i.style.width = meter > 0 ? `calc(${meter * 100}% - 6px)` : '0';
          s.el.classList.toggle('hov-zero', !on && count === '0'); s.el.classList.toggle('hov-on', !!on); s.el.classList.toggle('hov-warn', !!warn);
        };
        slotSet('spring', String(p.inv.spring), 0, p.z > EYE + .02, false);
        slotSet('wall', String(p.inv.wall), 0, false, false);
        slotSet('cloak', String(p.inv.cloak), p.cloak / 10, p.cloak > 0, false);
        slotSet('boost', p.boost > 0 ? Math.ceil(p.boost) + 's' : '0', p.boost / 6, p.boost > 0, false);
        slotSet('slow', p.slow > 0 ? Math.ceil(p.slow) + 's' : '0', p.slow / 2.5, false, p.slow > 0);
      }

      /* ---------- engine hum ---------- */
      let eng = null, engLast = -1;
      function engine(on, speed) {
        const want = on && !Arcade.isMuted() ? .012 + Math.min(speed, 6) * .005 : 0;
        if (!eng && want > 0) {
          const ua = navigator.userActivation; if (ua && !ua.hasBeenActive) return;
          const a = Arcade.audio(); if (!a) return;
          const o = a.createOscillator(), f = a.createBiquadFilter(), gn = a.createGain(), o2 = a.createOscillator();
          o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 380; gn.gain.value = 0;
          o.connect(f); o2.connect(f); f.connect(gn).connect(a.destination); o.start(); o2.start(); eng = { a, o, o2, f, gn };
        }
        if (!eng) return;
        const key = Math.round(want * 1000) + '|' + Math.round(speed * 10); if (key === engLast) return; engLast = key;
        const now = eng.a.currentTime;
        eng.gn.gain.setTargetAtTime(want, now, .06);
        eng.o.frequency.setTargetAtTime(48 + speed * 20 + (p.boost > 0 ? 30 : 0), now, .1);
        eng.o2.frequency.setTargetAtTime(24 + speed * 10, now, .1);
      }
      Arcade.onMute(m => { if (m) engine(0, 0); });

      /* ---------- input ---------- */
      const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
        Space: 'jump', KeyZ: 'wall', KeyE: 'wall', KeyX: 'cloak', KeyQ: 'cloak', KeyP: 'pause', Escape: 'pause', Enter: 'ok', NumpadEnter: 'ok', KeyM: 'mute', F2: 'newgame' };
      function press(k) { if (k in keys) keys[k] = true; pressed[k] = true; if (k === 'jump' && state !== 'play') pressed.ok = true; }
      win.onKey(e => { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); if (e.repeat) return; press(k); });
      win.onKeyUp(e => { const k = KEYMAP[e.code]; if (k && k in keys) keys[k] = false; });
      win.body.querySelectorAll('.hov-touch button').forEach(b => {
        const k = b.dataset.k;
        b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); b.classList.add('hov-on'); });
        const up = () => { if (k in keys) keys[k] = false; b.classList.remove('hov-on'); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      });
      cv.addEventListener('pointerdown', () => { if (state !== 'play') pressed.ok = true; else if (coarse) pressed.pause = true; });
      const clearKeys = () => { for (const k in keys) keys[k] = false; };
      win.on('blur', () => { if (state === 'play') state = 'paused'; clearKeys(); engine(0, 0); });
      win.on('close', () => { if (state === 'play') state = 'paused'; clearKeys(); engine(0, 0); });
      win.on('minimize', () => { if (state === 'play') state = 'paused'; engine(0, 0); });

      api.newGame = newGame;
      api.isPaused = () => state === 'paused';
      api.togglePause = () => { if (state === 'play') state = 'paused'; else if (state === 'paused') { state = 'play'; win.focus(); } };
      api.help = () => {
        if (state === 'play') state = 'paused';
        Arcade.dialog({ title: 'How to play Hover!', icon: 'info', text: 'Drive your blue hovercraft through the maze and touch all 3 red flags before the clock runs out and before the red hovercraft steal your 3 blue flags. A red craft that grabs a blue flag races it back to its base: bump it on the way to send the flag home. ' +
          'Arrows or WASD steer and thrust; the craft drifts, so ease off early. Space uses a Spring to jump over walls. Z drops a Wall Pod behind you to block a chaser. X turns on a Cloak (enemies cannot see or bump you). ' +
          'Orange pods are speed boosts; purple pads slow you down. Bumping an enemy knocks you both back. Faster finishes score more. Watch the radar: blue = your flags, red = theirs, orange = enemies.' });
      };

      /* ---------- loop ---------- */
      const STEP = 1 / 60;
      let last = performance.now(), accum = 0, frameNo = 0;
      function step(dt) {
        t += dt;
        if (pressed.mute) Arcade.setMuted(!Arcade.isMuted());
        if (pressed.newgame) { newGame(); return; }
        if (state === 'title') { p.a = wrapA(p.a + dt * .3); if (pressed.ok) newGame(); }
        else if (state === 'intro') { if (msg && (msg.t -= dt) <= 0) msg = null; if ((introT -= dt) <= 0 || pressed.ok) { state = 'play'; say('GO! Find the red flags', '#ffd23f', 1.8); } }
        else if (state === 'play') { if (pressed.pause) state = 'paused'; else update(dt); }
        else if (state === 'paused') { if (pressed.pause || pressed.ok) state = 'play'; }
        else if (state === 'clear') { if (pressed.ok) { if (level < LEVELS.length - 1) startLevel(level + 1); else endGame(true); } }
        else if ((state === 'over' || state === 'won') && pressed.ok && !dialogOpen) { loadLevel(0); state = 'title'; }
      }
      function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        if (!win.isVisible()) { accum = 0; return; }
        accum += dt; let n = 0;
        while (accum >= STEP && n < 6) { step(STEP); accum -= STEP; n++; for (const k in pressed) delete pressed[k]; }
        if (n === 6) accum = 0;
        render(); hud();
        if ((frameNo++ & 3) === 0) drawRadar();
        engine(state === 'play', Math.hypot(p.vx, p.vy));
      }

      // test hooks for the smoke harness
      Arcade.apps.hover.test = {
        get: () => ({ state, level, score, timeLeft, redGot, blueLost, p: { x: p.x, y: p.y, a: p.a, z: p.z, vx: p.vx, vy: p.vy }, inv: p.inv, MW,
          enemies: enemies.map(e => ({ x: +e.x.toFixed(2), y: +e.y.toFixed(2), mode: e.mode })), flags: flags.map(f => ({ team: f.team, x: f.x, y: f.y, taken: f.taken, carried: !!f.carrier })) }),
        start: li => { score = 0; loadLevel(li || 0); state = 'play'; win.focus(); },
        steps: n => { for (let i = 0; i < n; i++) { step(STEP); for (const k in pressed) delete pressed[k]; } },
        keys: (o) => Object.assign(keys, o),
        face: (x, y) => { // put the player 1.5 cells from (x,y) along an open line and face it
          const tx = Math.floor(x), ty = Math.floor(y);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (open(tx + dx, ty + dy) && open(tx + 2 * dx, ty + 2 * dy)) { p.x = tx + .5 + dx * 1.6; p.y = ty + .5 + dy * 1.6; p.vx = p.vy = 0; p.a = Math.atan2(-dy, -dx); return true; }
          }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(tx + dx, ty + dy)) { p.x = tx + .5 + dx * .9; p.y = ty + .5 + dy * .9; p.a = Math.atan2(-dy, -dx); return true; }
          return false;
        },
        place: (x, y) => { p.x = x; p.y = y; p.vx = p.vy = 0; p.z = EYE; p.vz = 0; },
        give: (k, n) => { if (k in p.inv) p.inv[k] = n; else p[k] = n; },
        draw: () => { render(); hud(); drawRadar(); },
        freeze: () => { enemies.forEach(e => { e.stun = 1e9; }); },
        bench: n => { const t0 = performance.now(); for (let i = 0; i < n; i++) { render(); } return (performance.now() - t0) / n; },
        bench3d: n => { const t0 = performance.now(); for (let i = 0; i < n; i++) drawScene(p.x, p.y, p.a + i * .01, p.z); return (performance.now() - t0) / n; }
      };

      loadLevel(0); state = 'title';
      requestAnimationFrame(frame);
    }
  });
})();

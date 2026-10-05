/* Byte Rush: original 3-level platformer (dash, wall-jump, coyote time). */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="5" y="1" width="1" height="2" fill="#333"/><rect x="5" y="0" width="1" height="1" fill="#ffd23f"/><rect x="3" y="3" width="10" height="9" fill="#f4f4ff"/><rect x="11" y="3" width="2" height="9" fill="#c9c9e6"/><rect x="8" y="5" width="5" height="3" fill="#22e6ff"/><rect x="0" y="7" width="4" height="2" fill="#ff3d6e"/><rect x="4" y="12" width="3" height="2" fill="#2b2b45"/><rect x="9" y="12" width="3" height="2" fill="#2b2b45"/><rect x="0" y="14" width="16" height="2" fill="#00c9b0"/></svg>';
  const NAMES = ['BOOT.EXE', 'WALLS.SYS', 'FINAL.DLL'];
  const store = { get: (k, d) => Arcade.store.get('byterush.' + k, d), set: (k, v) => Arcade.store.set('byterush.' + k, v) };
  const fmt = s => { if (s == null) return '--:--.--'; const m = Math.floor(s / 60), r = s - m * 60; return String(m).padStart(2, '0') + ':' + r.toFixed(2).padStart(5, '0'); };
  const api = {};

  Arcade.css(`
    .br-screen { background: #000; padding: 2px; }
    .br-screen canvas { display: block; width: 100%; aspect-ratio: 16 / 9; max-height: calc(100dvh - 170px); object-fit: contain; image-rendering: pixelated; background: #000; touch-action: none; }
    .win.max .br-screen canvas { max-height: calc(100dvh - 130px); }
    .br-touch { display: none; justify-content: space-between; gap: 8px; padding: 8px 4px 4px; touch-action: none; }
    .br-touch .pad { display: flex; gap: 6px; }
    .br-touch button { width: 56px; height: 48px; border: 0; background: var(--face); font: 14px var(--pixel); touch-action: none; }
    .br-touch button.on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); background: #b0b0b6; }
    @media (pointer: coarse) { .br-touch { display: flex; } .br-screen canvas { max-height: calc(100dvh - 250px); } }
  `);

  Arcade.scores.add({
    game: 'Byte Rush',
    render() {
      const best = store.get('best', {});
      let h = '<tr><th>Level</th><th>Best time</th><th>Bits</th></tr>';
      NAMES.forEach((n, i) => { const b = best[i]; h += `<tr><td>${i + 1}. ${n}</td><td class="num">${fmt(b && b.t)}</td><td class="num">${b ? b.bits + '/' + b.of : '-'}</td></tr>`; });
      return h + `<tr><td><b>Full run</b></td><td class="num"><b>${fmt(store.get('run', null))}</b></td><td></td></tr>`;
    }
  });

  function preview(g, w, h, t) {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0d0828'); sky.addColorStop(.6, '#3a1260'); sky.addColorStop(1, '#c2366e');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd86b'; g.beginPath(); g.arc(w * .72, h * .55, 26, 0, 7); g.fill();
    g.fillStyle = '#c3c3c6'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#00e5c8'; g.fillRect(0, h - 22, w, 3);
    const off = (t * 60) % 32;
    g.fillStyle = '#ffd23f'; for (let i = 0; i < 8; i++) { const x = i * 32 - off + 16; g.fillRect(x, h - 44 - Math.sin(i) * 6, 4, 6); }
    const x = 60, y = h - 22, s = Math.floor(t * 10) % 2;
    g.fillStyle = '#ff3d6e'; g.fillRect(x - 13, y - 10 + s, 8, 2);
    g.fillStyle = '#2b2b45'; g.fillRect(x - 4, y - 2 - s, 3, 2); g.fillRect(x + 1, y - 3 + s, 3, 2);
    g.fillStyle = '#f4f4ff'; g.fillRect(x - 5, y - 12, 10, 10); g.fillStyle = '#22e6ff'; g.fillRect(x, y - 10, 5, 3);
  }

  Arcade.app({
    id: 'byterush', title: 'Byte Rush', icon: ICON, width: 824, max: true, folder: 'Games', status: true, preview,
    hint: 'Original platformer: dash, wall-jump and speedrun three levels.',
    menus: [
      { label: 'Game', items: [
        { label: 'Restart level', key: 'R', action: () => api.restart && api.restart() },
        '-',
        { label: 'CRT effect', key: 'C', checked: () => store.get('crt', true), action: () => api.toggleCrt && api.toggleCrt() },
        { label: 'Sound', key: 'M', checked: () => !Arcade.isMuted(), action: () => Arcade.setMuted(!Arcade.isMuted()) },
        '-',
        { label: 'Exit', action: () => Arcade.apps.byterush.ctx.close() }
      ] },
      { label: 'Help', items: [{ label: 'How to play', action: () => Arcade.open('readme') }] }
    ],
    build(win) {
      win.body.innerHTML = `<div class="br-screen bevel-in"><canvas width="400" height="225" tabindex="0" aria-label="Byte Rush game screen"></canvas></div>
        <div class="br-touch">
          <div class="pad"><button data-k="left" aria-label="Left">◀</button><button data-k="up" aria-label="Up">▲</button><button data-k="down" aria-label="Down">▼</button><button data-k="right" aria-label="Right">▶</button></div>
          <div class="pad"><button data-k="dash" aria-label="Dash">B</button><button data-k="jump" aria-label="Jump">A</button></div>
        </div>`;
      const coarse = Arcade.coarse;
      let crt = store.get('crt', true), restartLevel = null;
      api.toggleCrt = () => { crt = !crt; store.set('crt', crt); };
      const beep = Arcade.beep;
      const sfx = {
        jump: () => beep(300, .13, 'square', .035, 420),
        wall: () => beep(380, .12, 'square', .035, 300),
        coin: () => { beep(988, .06, 'square', .03); beep(1480, .12, 'square', .03, 0, .06); },
        dash: () => beep(520, .18, 'sawtooth', .03, -380),
        stomp: () => beep(180, .14, 'triangle', .08, -120),
        die: () => beep(420, .35, 'sawtooth', .04, -360),
        check: () => { [523, 659, 784].forEach((f, i) => beep(f, .1, 'square', .03, 0, i * .07)); },
        win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, .14, 'square', .035, 0, i * .09)); },
        land: () => beep(110, .05, 'triangle', .05)
      };

    /* ============ Levels ============ */
    const T = 16, VW = 400, VH = 225;
    function build(w, h, fn) {
      const g = [...Array(h)].map(() => Array(w).fill('.'));
      const e = { coins: [], enemies: [], signs: [], checks: [], start: null, goal: null };
      const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; };
      const rect = (x, y, ww, hh, c) => { for (let i = 0; i < ww; i++) for (let j = 0; j < hh; j++) set(x + i, y + j, c); };
      fn({
        ground: (x0, x1, top) => rect(x0, top, x1 - x0 + 1, h - top, '#'),
        block: (x, y, ww, hh) => rect(x, y, ww, hh, '#'),
        plat: (x, y, ww) => rect(x, y, ww, 1, '-'),
        spikes: (x, y, n) => rect(x, y, n, 1, '^'),
        coin: (x, y) => e.coins.push({ x: x * T + 8, y: y * T + 8 }),
        row: (x, y, n) => { for (let i = 0; i < n; i++) e.coins.push({ x: (x + i) * T + 8, y: y * T + 8 }); },
        enemy: (x, y) => e.enemies.push({ x: x * T + 2, y: y * T + 6 }),
        start: (x, y) => e.start = { x: x * T + 3, y: y * T + 2 },
        check: (x, y) => e.checks.push({ x: x * T, y: y * T }),
        goal: (x, y) => e.goal = { x: x * T, y: y * T },
        sign: (x, y, t) => e.signs.push({ x: x * T + 8, y: y * T + 8, t })
      });
      return { w, h, g, e };
    }
    const LEVEL_META = [{ name: 'BOOT.EXE' }, { name: 'WALLS.SYS' }, { name: 'FINAL.DLL' }];
    const LEVELS = [
      () => build(106, 16, b => {
        b.ground(0, 22, 12); b.start(3, 11);
        b.sign(7, 9, 'ARROWS RUN  ·  SPACE JUMPS');
        b.row(10, 9, 4); b.enemy(15, 11);
        b.plat(17, 9, 4); b.row(17, 8, 4);
        b.coin(24, 9);
        b.ground(26, 44, 12);
        b.block(31, 10, 1, 2); b.block(34, 8, 2, 4); b.row(34, 6, 2);
        b.spikes(38, 11, 3); b.coin(38, 8); b.coin(39, 7); b.coin(40, 8);
        b.enemy(42, 11);
        b.sign(41, 7, 'X OR SHIFT DASHES  ·  TRY  JUMP + DASH');
        b.coin(46, 9); b.coin(47, 8); b.coin(48, 8); b.coin(49, 9);
        b.ground(51, 71, 12); b.check(53, 11);
        b.enemy(58, 11); b.plat(60, 8, 3); b.row(60, 7, 3); b.enemy(64, 11);
        b.block(67, 9, 2, 3); b.block(69, 7, 2, 5); b.row(69, 5, 2);
        b.ground(76, 105, 12);
        b.spikes(80, 11, 2); b.row(80, 8, 2); b.spikes(86, 11, 2); b.row(86, 8, 2);
        b.enemy(92, 11); b.goal(99, 11);
      }),
      () => build(92, 24, b => {
        b.ground(0, 34, 20); b.start(3, 19);
        b.sign(6, 16, 'JUMP WHILE TOUCHING A WALL');
        b.block(10, 3, 1, 13); b.block(14, 8, 2, 12);
        b.coin(12, 15); b.coin(12, 12); b.coin(12, 9); b.coin(12, 6);
        b.spikes(16, 19, 15);
        b.plat(18, 10, 3); b.row(18, 9, 3); b.plat(23, 8, 3); b.row(23, 7, 3); b.plat(28, 10, 3); b.row(28, 9, 3);
        b.check(33, 19);
        b.plat(37, 17, 2); b.plat(41, 16, 2); b.plat(45, 17, 2);
        b.row(37, 15, 2); b.row(41, 14, 2); b.row(45, 15, 2);
        b.ground(49, 91, 20); b.check(52, 19);
        b.block(56, 4, 1, 12); b.block(60, 4, 2, 16);
        b.coin(58, 16); b.coin(58, 13); b.coin(58, 10); b.coin(58, 7); b.coin(58, 4);
        b.enemy(66, 19); b.row(66, 16, 3); b.enemy(71, 19);
        b.spikes(74, 19, 2); b.row(74, 16, 2); b.enemy(78, 19);
        b.goal(86, 19);
      }),
      () => build(86, 20, b => {
        b.ground(0, 12, 16); b.start(2, 15);
        b.enemy(8, 15); b.row(6, 13, 3);
        b.plat(15, 13, 2); b.row(15, 12, 2);
        b.ground(19, 30, 16);
        b.spikes(22, 15, 3); b.row(22, 12, 3);
        b.block(26, 12, 2, 4); b.enemy(29, 15);
        b.coin(32, 10); b.coin(34, 9); b.coin(36, 10);
        b.ground(38, 50, 16); b.check(40, 15);
        b.block(45, 2, 1, 11); b.block(49, 4, 2, 12);
        b.coin(47, 11); b.coin(47, 8); b.coin(47, 5);
        b.plat(53, 6, 3); b.row(53, 5, 3); b.plat(58, 7, 3); b.row(58, 6, 3);
        b.ground(62, 85, 16);
        b.enemy(65, 15); b.spikes(68, 15, 2); b.row(68, 12, 2); b.enemy(71, 15);
        b.block(74, 13, 1, 3); b.block(76, 11, 1, 5); b.coin(76, 9);
        b.goal(81, 15);
      })
    ];

    /* ============ Game state ============ */
    const cv = win.body.querySelector('canvas'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const G = 1500, RUN = 165, JUMP = 455, MAXFALL = 430, DASH = 330, DASHT = .14;
    let state = 'title', lvlIdx = 0, lvl, coins, enemies, checks, respawn, tileCv;
    let levelTime = 0, deaths = 0, runTime = 0, runValid = true, deadT = 0, clearInfo = null, t = 0;
    let parts = [], ghosts = [], shake = 0, flash = 0;
    const cam = { x: 0, y: 0 }, p = { w: 10, h: 14 };
    const stars = [...Array(70)].map(() => ({ x: Math.random() * VW, y: Math.random() * VH * .6, s: Math.random() < .2 ? 2 : 1, tw: Math.random() * 6 }));

    function tile(tx, ty) { if (tx < 0 || tx >= lvl.w) return '#'; if (ty < 0 || ty >= lvl.h) return '.'; return lvl.g[ty][tx]; }
    const solid = (tx, ty) => tile(tx, ty) === '#';

    function loadLevel(i) {
      lvlIdx = i; lvl = LEVELS[i]();
      coins = lvl.e.coins.map(c => ({ ...c, got: false, ph: Math.random() * 6 }));
      enemies = lvl.e.enemies.map(e => ({ x: e.x, y: e.y, w: 12, h: 10, vx: -34, vy: 0, alive: true, dead: 0 }));
      checks = lvl.e.checks.map(c => ({ ...c, on: false }));
      respawn = { ...lvl.e.start };
      levelTime = 0; deaths = 0; parts = []; ghosts = [];
      resetPlayer();
      cam.x = Math.max(0, p.x - VW / 2); cam.y = Math.max(0, Math.min(p.y - VH * .55, lvl.h * T - VH));
      prerender();
      win.status('Arrows/WASD run · Space jump · X dash · P pause', `Level ${i + 1} of ${LEVELS.length}`);
    }
    function resetPlayer() {
      Object.assign(p, { x: respawn.x, y: respawn.y, vx: 0, vy: 0, ground: false, coyote: 0, buf: 0, canDash: true, dashT: 0, dvx: 0, dvy: 0,
        face: 1, wall: 0, lock: 0, sx: 1, sy: 1, drop: 0, run: 0, alive: true });
      p.scarf = [...Array(7)].map(() => ({ x: p.x + 5, y: p.y + 5 }));
    }

    /* ============ Input ============ */
    const keys = {}, pressed = {};
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyJ: 'dash',
      Enter: 'ok', KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyC: 'crt', KeyM: 'mute' };
    function press(k) { if (!keys[k]) pressed[k] = true; keys[k] = true; }
    win.onKey(e => {
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault(); if (e.repeat) return;
      press(k);
    });
    win.onKeyUp(e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    win.body.querySelectorAll('.br-touch button').forEach(b => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); b.classList.add('on'); });
      const up = () => { keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    cv.addEventListener('pointerdown', () => { if (state !== 'play') press('ok'); setTimeout(() => keys.ok = false, 50); });
    restartLevel = () => { if (state === 'title' || state === 'end') return; runValid = false; loadLevel(lvlIdx); state = 'play'; win.focus(); };
    win.on('blur', () => { if (state === 'play') state = 'paused'; for (const k in keys) keys[k] = false; });

    /* ============ Physics ============ */
    function moveX(e, dx) {
      e.x += dx;
      const t0 = Math.floor(e.y / T), t1 = Math.floor((e.y + e.h - .01) / T);
      if (dx > 0) { const tx = Math.floor((e.x + e.w - .01) / T); for (let ty = t0; ty <= t1; ty++) if (solid(tx, ty)) { e.x = tx * T - e.w; return true; } }
      else if (dx < 0) { const tx = Math.floor(e.x / T); for (let ty = t0; ty <= t1; ty++) if (solid(tx, ty)) { e.x = (tx + 1) * T; return true; } }
      return false;
    }
    function moveY(e, dy) {
      const prevBottom = e.y + e.h; e.y += dy;
      const t0 = Math.floor(e.x / T), t1 = Math.floor((e.x + e.w - .01) / T);
      if (dy > 0) {
        const ty = Math.floor((e.y + e.h - .01) / T);
        for (let tx = t0; tx <= t1; tx++) { const c = tile(tx, ty); if (c === '#' || (c === '-' && prevBottom <= ty * T + .5 && !(e.drop > 0))) { e.y = ty * T - e.h; return 1; } }
      } else if (dy < 0) {
        const ty = Math.floor(e.y / T);
        for (let tx = t0; tx <= t1; tx++) if (solid(tx, ty)) { e.y = (ty + 1) * T; return -1; }
      }
      return 0;
    }
    function wallDir() {
      const t0 = Math.floor((p.y + 2) / T), t1 = Math.floor((p.y + p.h - 2) / T);
      const l = Math.floor((p.x - 1) / T), r = Math.floor((p.x + p.w) / T);
      for (let ty = t0; ty <= t1; ty++) { if (solid(l, ty)) return -1; if (solid(r, ty)) return 1; }
      return 0;
    }
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    function burst(x, y, n, colors, spd = 90, g = 300, life = .5, size = 2) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = spd * (.3 + Math.random() * .7);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, life: life * (.6 + Math.random() * .6), max: life, c: colors[i % colors.length], s: size }); }
    }

    function killPlayer() {
      if (!p.alive) return;
      p.alive = false; deadT = .7; deaths++; shake = .35; flash = .15; sfx.die();
      burst(p.x + 5, p.y + 7, 28, ['#f4f4ff', '#22e6ff', '#ff3d6e'], 160, 200, .7, 2);
    }

    function updatePlay(dt) {
      levelTime += dt; runTime += dt;
      if (!p.alive) { deadT -= dt; if (deadT <= 0) resetPlayer(); updateWorld(dt); return; }
      const ax = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ay = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (ax) p.face = ax;
      if (pressed.jump) p.buf = .12;
      p.buf -= dt; p.coyote -= dt; p.lock -= dt; p.drop -= dt;
      p.wall = p.ground ? 0 : wallDir();

      // dash
      if (pressed.dash && p.canDash && p.dashT <= 0) {
        let dx = ax, dy = ay; if (!dx && !dy) dx = p.face;
        const m = Math.hypot(dx, dy); p.dvx = dx / m * DASH; p.dvy = dy / m * DASH * .9;
        p.dashT = DASHT; p.canDash = false; shake = Math.max(shake, .12); sfx.dash();
        burst(p.x + 5, p.y + 7, 10, ['#22e6ff', '#ffffff'], 80, 0, .3);
      }
      if (p.dashT > 0) {
        p.dashT -= dt; p.vx = p.dvx; p.vy = p.dvy;
        if (Math.random() < .9) ghosts.push({ x: p.x, y: p.y, face: p.face, life: .22 });
        if (p.dashT <= 0) { p.vx *= .55; p.vy = p.dvy < 0 ? p.vy * .45 : p.vy * .6; }
      } else {
        const target = ax * RUN, acc = p.ground ? 1900 : 1150;
        if (p.lock <= 0) p.vx += Math.sign(target - p.vx) * Math.min(Math.abs(target - p.vx), acc * dt);
        p.vy += G * dt * (p.vy < 0 && !keys.jump ? 2.4 : 1) * (Math.abs(p.vy) < 40 && keys.jump ? .6 : 1);
        if (p.wall && p.vy > 0 && ax === p.wall) { p.vy = Math.min(p.vy, 75); if (Math.random() < .3) parts.push({ x: p.x + (p.wall > 0 ? p.w : 0), y: p.y + 10, vx: -p.wall * 20, vy: -10, g: 100, life: .25, max: .25, c: '#c3c3c6', s: 1 }); }
        p.vy = Math.min(p.vy, MAXFALL);
      }

      // jump / wall jump / drop
      if (p.buf > 0) {
        if (keys.down && p.ground && tile(Math.floor((p.x + 5) / T), Math.floor((p.y + p.h + 1) / T)) === '-') { p.drop = .25; p.buf = 0; p.ground = false; }
        else if (p.coyote > 0) { p.vy = -JUMP; p.coyote = 0; p.buf = 0; p.sx = .7; p.sy = 1.3; sfx.jump(); burst(p.x + 5, p.y + p.h, 6, ['#ffffff', '#c3c3c6'], 50, 100, .3, 1); }
        else if (p.wall) { p.vy = -430; p.vx = -p.wall * 205; p.lock = .16; p.face = -p.wall; p.buf = 0; p.dashT = 0; p.sx = .75; p.sy = 1.25; sfx.wall();
          burst(p.x + (p.wall > 0 ? p.w : 0), p.y + 8, 7, ['#ffffff', '#22e6ff'], 60, 120, .3, 1); }
      }

      const wasGround = p.ground, fallV = p.vy;
      moveX(p, p.vx * dt);
      const hy = moveY(p, p.vy * dt);
      p.ground = hy === 1;
      if (hy) { if (hy === -1 && p.dashT > 0) p.dashT = 0; p.vy = 0; }
      if (p.ground) {
        p.coyote = .1;
        if (p.dashT <= 0) p.canDash = true;
        if (!wasGround && fallV > 200) { p.sx = 1.35; p.sy = .7; sfx.land(); burst(p.x + 5, p.y + p.h, 8, ['#ffffff', '#c3c3c6'], 60, 150, .35, 1); }
      }
      p.sx += (1 - p.sx) * Math.min(1, dt * 12); p.sy += (1 - p.sy) * Math.min(1, dt * 12);
      p.run += Math.abs(p.vx) * dt * .08;

      // hazards
      if (p.y > lvl.h * T + 20) killPlayer();
      const hb = { x: p.x + 2, y: p.y + 3, w: p.w - 4, h: p.h - 3 };
      for (let ty = Math.floor(hb.y / T); ty <= Math.floor((hb.y + hb.h) / T); ty++)
        for (let tx = Math.floor(hb.x / T); tx <= Math.floor((hb.x + hb.w) / T); tx++)
          if (tile(tx, ty) === '^' && hb.y + hb.h > ty * T + 8) killPlayer();

      // pickups
      for (const c of coins) if (!c.got && Math.abs(c.x - (p.x + 5)) < 10 && Math.abs(c.y - (p.y + 7)) < 12) {
        c.got = true; sfx.coin(); burst(c.x, c.y, 8, ['#ffd23f', '#fff3b0'], 70, 60, .35, 1);
      }
      for (const c of checks) if (!c.on && Math.abs(c.x + 8 - (p.x + 5)) < 12 && Math.abs(c.y + 8 - (p.y + 7)) < 16) {
        checks.forEach(o => o.on = false); c.on = true; respawn = { x: c.x + 3, y: c.y + 2 }; sfx.check(); burst(c.x + 8, c.y, 14, ['#00e5c8', '#ffffff'], 90, 120, .5);
      }
      const gl = lvl.e.goal;
      if (gl && overlap(p, { x: gl.x, y: gl.y - 4, w: 16, h: 20 })) levelClear();

      updateWorld(dt);
    }
    function updateWorld(dt) {
      for (const e of enemies) {
        if (!e.alive) { e.dead -= dt; continue; }
        e.vy = Math.min(e.vy + G * dt, MAXFALL);
        const hy = moveY(e, e.vy * dt); if (hy) e.vy = 0;
        if (moveX(e, e.vx * dt)) e.vx *= -1;
        else if (hy === 1) { const ax = e.vx > 0 ? e.x + e.w + 1 : e.x - 1, c = tile(Math.floor(ax / T), Math.floor((e.y + e.h + 2) / T)); if (c !== '#' && c !== '-') e.vx *= -1; }
        if (e.y > lvl.h * T + 40) e.alive = false;
        if (p.alive && overlap(p, e)) {
          if (p.dashT > 0 || (p.vy > 0 && p.y + p.h - e.y < 9)) {
            e.alive = false; e.dead = .5; sfx.stomp(); shake = Math.max(shake, .15);
            burst(e.x + 6, e.y + 5, 14, ['#ff4b5c', '#ffd23f', '#2b1030'], 110, 250, .45);
            if (p.dashT <= 0) { p.vy = keys.jump ? -JUMP * .95 : -300; p.sy = 1.25; p.sx = .8; }
            p.canDash = true;
          } else killPlayer();
        }
      }
      for (const q of parts) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
      parts = parts.filter(q => q.life > 0);
      for (const g of ghosts) g.life -= dt; ghosts = ghosts.filter(g => g.life > 0);
      // scarf
      if (p.scarf) {
        const ax = p.x + p.w / 2 - p.face * 3, ay = p.y + 7;
        p.scarf[0].x = ax; p.scarf[0].y = ay;
        for (let i = 1; i < p.scarf.length; i++) {
          const a = p.scarf[i - 1], b = p.scarf[i];
          b.x += (-p.face * 12 - p.vx * .05) * dt; b.y += (18 + Math.sin(t * 9 + i) * 10) * dt;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
          b.x = a.x + dx / d * 2.6; b.y = a.y + dy / d * 2.6;
        }
      }
      // camera
      const tx = p.x + p.w / 2 - VW / 2 + p.face * 28, ty = p.y - VH * .55;
      cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 5);
      cam.x = Math.max(0, Math.min(cam.x, lvl.w * T - VW)); cam.y = Math.max(0, Math.min(cam.y, lvl.h * T - VH));
      shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
    }

    function levelClear() {
      state = 'clear'; sfx.win();
      const got = coins.filter(c => c.got).length, best = store.get('best', {}), prev = best[lvlIdx];
      const isBest = !prev || levelTime < prev.t;
      if (isBest) { best[lvlIdx] = { t: levelTime, bits: got, of: coins.length }; store.set('best', best); }
      let runBest = false;
      if (lvlIdx === LEVELS.length - 1 && runValid) { const r = store.get('run', null); if (r == null || runTime < r) { store.set('run', runTime); runBest = true; } }
      clearInfo = { got, of: coins.length, time: levelTime, deaths, isBest, prev: prev && prev.t, runBest };
      burst(p.x + 5, p.y, 40, ['#ffd23f', '#22e6ff', '#ff3d6e', '#ffffff'], 200, 150, 1, 2);
    }

    /* ============ Rendering ============ */
    function prerender() {
      tileCv = document.createElement('canvas'); tileCv.width = lvl.w * T; tileCv.height = lvl.h * T;
      const c = tileCv.getContext('2d');
      for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) {
        const ch = lvl.g[y][x], X = x * T, Y = y * T;
        if (ch === '#') {
          const top = tile(x, y - 1) !== '#';
          if (top) {
            c.fillStyle = '#c3c3c6'; c.fillRect(X, Y, T, T);
            c.fillStyle = '#ffffff'; c.fillRect(X, Y, T, 1); c.fillRect(X, Y, 1, T);
            c.fillStyle = '#85858c'; c.fillRect(X, Y + T - 1, T, 1); c.fillRect(X + T - 1, Y, 1, T);
            c.fillStyle = '#00e5c8'; c.fillRect(X, Y, T, 3);
            c.fillStyle = '#8dfff0'; c.fillRect(X, Y, T, 1);
            c.fillStyle = '#9a9aa2'; c.fillRect(X + 4, Y + 8, 2, 2); c.fillRect(X + 10, Y + 11, 2, 2);
          } else {
            c.fillStyle = '#5d5f7a'; c.fillRect(X, Y, T, T);
            c.fillStyle = '#7a7c98'; c.fillRect(X, Y, T, 1); c.fillRect(X, Y, 1, T);
            c.fillStyle = '#44465e'; c.fillRect(X, Y + T - 1, T, 1); c.fillRect(X + T - 1, Y, 1, T);
            if ((x * 7 + y * 13) % 5 === 0) { c.fillStyle = '#6c6e8a'; c.fillRect(X + 5, Y + 5, 3, 3); }
            if ((x * 3 + y * 5) % 7 === 0) { c.fillStyle = '#00e5c8'; c.globalAlpha = .35; c.fillRect(X + 9, Y + 4, 1, 6); c.fillRect(X + 9, Y + 9, 4, 1); c.globalAlpha = 1; }
          }
        } else if (ch === '-') {
          const g = c.createLinearGradient(X, 0, X + T, 0); g.addColorStop(0, '#0a1a86'); g.addColorStop(1, '#1d8ad6');
          c.fillStyle = g; c.fillRect(X, Y, T, 6);
          c.fillStyle = '#7cc4ff'; c.fillRect(X, Y, T, 1);
          c.fillStyle = '#050a40'; c.fillRect(X, Y + 5, T, 1);
          c.fillStyle = '#ffffff'; c.fillRect(X + 7, Y + 2, 2, 2);
        } else if (ch === '^') {
          for (let i = 0; i < 2; i++) {
            const sx = X + i * 8;
            c.fillStyle = '#e8f6ff'; c.beginPath(); c.moveTo(sx, Y + T); c.lineTo(sx + 4, Y + 6); c.lineTo(sx + 8, Y + T); c.fill();
            c.fillStyle = '#7fb5d6'; c.beginPath(); c.moveTo(sx + 4, Y + 6); c.lineTo(sx + 8, Y + T); c.lineTo(sx + 4, Y + T); c.fill();
          }
        }
      }
    }
    function ridge(par, base, amp, seed, fill, line) {
      const pts = [];
      for (let x = -8; x <= VW + 8; x += 6) {
        const wx = x + cam.x * par;
        pts.push([x, base - cam.y * par * .25 + (Math.sin(wx * .011 + seed) * .55 + Math.sin(wx * .029 + seed * 2.3) * .3 + Math.sin(wx * .061 + seed) * .15) * amp]);
      }
      ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-8, VH);
      pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(VW + 8, VH); ctx.fill();
      if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); }
    }
    function drawBg() {
      const g = ctx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, '#0d0828'); g.addColorStop(.5, '#2c0f55'); g.addColorStop(.85, '#7a1f72'); g.addColorStop(1, '#c2366e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      for (const s of stars) {
        ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 1.3 + s.tw));
        ctx.fillStyle = '#fff'; ctx.fillRect(((s.x - cam.x * .04) % VW + VW) % VW | 0, s.y | 0, s.s, s.s);
      }
      ctx.globalAlpha = 1;
      const sx = 300 - cam.x * .015, sy = 128 - cam.y * .04, r = 44;
      const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r); sg.addColorStop(0, '#ffe66b'); sg.addColorStop(1, '#ff3d8a');
      ctx.save(); ctx.shadowColor = '#ff5fa0'; ctx.shadowBlur = 24; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#5a1a68';
      for (let i = 0; i < 6; i++) { const yy = sy + 6 + i * 7, hh = 1 + i * .7; ctx.fillRect(sx - r, yy, r * 2, hh); }
      ridge(.12, 160, 34, 1.7, '#2a1050', null);
      ridge(.3, 182, 26, 4.1, '#170a35', '#ff3d8a');
    }
    function drawPlayer(x, y, face, sx, sy, alpha, tint) {
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(Math.round(x + p.w / 2 - cam.x), Math.round(y + p.h - cam.y)); ctx.scale(face * sx, sy);
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(-5, -14, 10, 14); ctx.restore(); return; }
      const step = p.ground && Math.abs(p.vx) > 20 ? (Math.floor(p.run) % 2) : 0;
      ctx.fillStyle = '#2b2b45'; ctx.fillRect(-4, -2 - (step ? 1 : 0), 3, 2); ctx.fillRect(1, -2 - (step ? 0 : 1), 3, 2);
      ctx.fillStyle = '#f4f4ff'; ctx.fillRect(-5, -12, 10, 10);
      ctx.fillStyle = '#c9c9e6'; ctx.fillRect(3, -12, 2, 10); ctx.fillRect(-5, -3, 10, 1);
      const vc = p.canDash ? '#22e6ff' : '#ff3d9a';
      ctx.shadowColor = vc; ctx.shadowBlur = 6; ctx.fillStyle = vc; ctx.fillRect(0, -10, 5, 3); ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(3, -10, 1, 1);
      ctx.fillStyle = '#333'; ctx.fillRect(-2, -14, 1, 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-2, -15, 1, 1);
      ctx.restore();
    }
    function drawScarf() {
      ctx.strokeStyle = '#ff3d6e'; ctx.lineWidth = 2; ctx.lineCap = 'square'; ctx.beginPath();
      p.scarf.forEach((q, i) => { const X = Math.round(q.x - cam.x), Y = Math.round(q.y - cam.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    }
    function text(s, x, y, color, size = 8, align = 'left', font = 'Silkscreen') {
      ctx.font = `${size}px "${font}", monospace`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.fillText(s, x, y);
    }
    function dialog(title, lines, footer) {
      const w = 236, lh = 12, h = 34 + lines.length * lh + (footer ? 18 : 0), x = (VW - w) / 2 | 0, y = (VH - h) / 2 | 0;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 4, y + 4, w, h);
      ctx.fillStyle = '#c3c3c6'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
      ctx.fillStyle = '#0c0c10'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
      ctx.fillStyle = '#85858c'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#0a1a86'); g.addColorStop(1, '#1d8ad6');
      ctx.fillStyle = g; ctx.fillRect(x + 3, y + 3, w - 6, 13);
      text(title, x + 7, y + 13, '#ffffff');
      lines.forEach((l, i) => { const [a, b, col] = Array.isArray(l) ? l : [l]; text(a, x + 12, y + 30 + i * lh, '#101014'); if (b) text(b, x + w - 12, y + 30 + i * lh, col || '#101014', 8, 'right'); });
      if (footer && Math.sin(t * 5) > -.3) text(footer, x + w / 2, y + h - 9, '#0a1a86', 8, 'center');
    }
    function drawWorld() {
      const sh = shake > 0 ? shake * 14 : 0;
      ctx.save(); ctx.translate(Math.round((Math.random() - .5) * sh), Math.round((Math.random() - .5) * sh));
      drawBg();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(tileCv, -cx, -cy);
      for (const s of lvl.e.signs) {
        ctx.font = '8px "Silkscreen", monospace'; const w = ctx.measureText(s.t).width + 10, X = Math.round(s.x - cx - w / 2), Y = Math.round(s.y - cy - 8);
        if (X > VW || X + w < 0) continue;
        ctx.fillStyle = '#0c0c10'; ctx.fillRect(X - 1, Y - 1, w + 2, 14); ctx.fillStyle = '#ffffe1'; ctx.fillRect(X, Y, w, 12);
        text(s.t, X + 5, Y + 9, '#101014');
      }
      for (const c of checks) {
        const X = c.x - cx, Y = c.y - cy;
        ctx.fillStyle = '#c3c3c6'; ctx.fillRect(X + 3, Y, 2, 16);
        const wave = c.on ? Math.sin(t * 8) * 1.5 : 0;
        ctx.fillStyle = c.on ? '#00e5c8' : '#85858c'; ctx.beginPath(); ctx.moveTo(X + 5, Y + 1); ctx.lineTo(X + 14, Y + 4 + wave); ctx.lineTo(X + 5, Y + 8); ctx.fill();
      }
      const gl = lvl.e.goal;
      if (gl) {
        const X = gl.x - cx, Y = Math.round(gl.y - cy + Math.sin(t * 3) * 2 - 2);
        ctx.save(); ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 12 + Math.sin(t * 4) * 4;
        ctx.fillStyle = '#2a3bd6'; ctx.fillRect(X, Y, 16, 16); ctx.restore();
        ctx.fillStyle = '#c3c3c6'; ctx.fillRect(X + 4, Y, 8, 6); ctx.fillStyle = '#2a3bd6'; ctx.fillRect(X + 9, Y + 1, 2, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(X + 2, Y + 8, 12, 7); ctx.fillStyle = '#ff3d6e'; ctx.fillRect(X + 3, Y + 10, 10, 1); ctx.fillStyle = '#85858c'; ctx.fillRect(X + 3, Y + 12, 7, 1);
      }
      ctx.save(); ctx.shadowColor = '#ffb800'; ctx.shadowBlur = 6;
      for (const c of coins) {
        if (c.got) continue; const X = c.x - cx, Y = c.y - cy + Math.sin(t * 3 + c.ph) * 1.5;
        if (X < -10 || X > VW + 10) continue;
        const w = Math.max(1, Math.abs(Math.cos(t * 3.5 + c.ph)) * 7);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(X - w / 2), Math.round(Y - 4), Math.round(w), 8);
        ctx.fillStyle = '#fff3b0'; ctx.fillRect(Math.round(X - w / 2), Math.round(Y - 4), 1, 3);
      }
      ctx.restore();
      for (const e of enemies) {
        if (!e.alive && e.dead <= 0) continue;
        const X = Math.round(e.x - cx), Y = Math.round(e.y - cy);
        if (!e.alive) { ctx.globalAlpha = Math.max(0, e.dead * 2); ctx.fillStyle = '#ff4b5c'; ctx.fillRect(X, Y + 7, 12, 3); ctx.globalAlpha = 1; continue; }
        const leg = Math.floor(t * 10) % 2, d = e.vx > 0 ? 1 : -1;
        ctx.fillStyle = '#2b1030'; ctx.fillRect(X + 1 + leg, Y + 8, 2, 2); ctx.fillRect(X + 5 - leg, Y + 8, 2, 2); ctx.fillRect(X + 9 + leg, Y + 8, 2, 2);
        ctx.fillStyle = '#ff4b5c'; ctx.fillRect(X + 1, Y + 2, 10, 6); ctx.fillRect(X + 2, Y + 1, 8, 1);
        ctx.fillStyle = '#b5203a'; ctx.fillRect(X + 6, Y + 2, 1, 6);
        ctx.fillStyle = '#2b1030'; ctx.fillRect(d > 0 ? X + 9 : X, Y + 3, 3, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(d > 0 ? X + 10 : X + 1, Y + 4, 1, 1);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(X + 3, Y + 4, 1, 1); ctx.fillRect(X + 8, Y + 3, 1, 1);
      }
      for (const g of ghosts) drawPlayer(g.x, g.y, g.face, 1, 1, g.life * 2.2, '#22e6ff');
      if (p.alive) { drawScarf(); drawPlayer(p.x, p.y, p.face, p.sx, p.sy, 1); }
      for (const q of parts) { ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), q.s, q.s); }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 3})`; ctx.fillRect(0, 0, VW, VH); }
    }
    function drawHud() {
      ctx.fillStyle = 'rgba(8,5,26,.6)'; ctx.fillRect(0, 0, VW, 14);
      const got = coins.filter(c => c.got).length;
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(5, 4, 4, 6);
      text(`${got}/${coins.length}`, 13, 10, '#ffffff');
      text(`DEATHS ${deaths}`, 64, 10, '#ff9ab8');
      text(LEVEL_META[lvlIdx].name, VW / 2 + 20, 10, '#8dfff0', 8, 'center');
      text(fmt(levelTime), VW - 6, 10, '#ffffff', 8, 'right');
    }
    function drawCrt() {
      if (!crt) return;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < VH; y += 2) ctx.fillRect(0, y, VW, 1);
      const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * .35, VW / 2, VH / 2, VW * .65);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
    }
    function drawTitle() {
      cam.x += 1 / 60 * 25; cam.y = 0;
      drawBg();
      ctx.fillStyle = '#c3c3c6'; ctx.fillRect(0, 200, VW, 25); ctx.fillStyle = '#00e5c8'; ctx.fillRect(0, 200, VW, 3); ctx.fillStyle = '#5d5f7a'; ctx.fillRect(0, 210, VW, 15);
      const y = 76 + Math.sin(t * 2) * 3;
      text('BYTE RUSH', VW / 2 + 2, y + 2, '#ff3d8a', 24, 'center', 'Press Start 2P');
      text('BYTE RUSH', VW / 2 - 2, y - 1, '#22e6ff', 24, 'center', 'Press Start 2P');
      text('BYTE RUSH', VW / 2, y, '#ffffff', 24, 'center', 'Press Start 2P');
      text('A STRAY PROCESS. THREE LEVELS. ONE DASH.', VW / 2, y + 22, '#ffd6ea', 8, 'center');
      if (Math.sin(t * 5) > -.2) text(coarse ? 'TAP TO START' : 'PRESS ENTER TO START', VW / 2, 150, '#ffe66b', 8, 'center', 'Press Start 2P');
      text('ARROWS RUN   SPACE JUMP   X DASH', VW / 2, 172, '#ffffff', 8, 'center');
      const run = store.get('run', null);
      if (run != null) text('BEST FULL RUN ' + fmt(run), VW / 2, 186, '#8dfff0', 8, 'center');
      // little Byte running along the floor
      const bx = (t * 60) % (VW + 40) - 20;
      ctx.save(); ctx.translate(Math.round(bx), 200);
      const s = Math.floor(t * 10) % 2;
      ctx.fillStyle = '#ff3d6e'; ctx.fillRect(-12, -9 + s, 7, 2);
      ctx.fillStyle = '#2b2b45'; ctx.fillRect(-4, -2 - s, 3, 2); ctx.fillRect(1, -3 + s, 3, 2);
      ctx.fillStyle = '#f4f4ff'; ctx.fillRect(-5, -12, 10, 10); ctx.fillStyle = '#22e6ff'; ctx.fillRect(0, -10, 5, 3);
      ctx.restore();
    }

    /* ============ Loop ============ */
    let last = performance.now(), acc = 0;
    function frame(now) {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const running = win.isVisible();
      if (running) {
        acc += dt;
        while (acc >= 1 / 60) {
          step(1 / 60); acc -= 1 / 60;
          for (const k in pressed) delete pressed[k];
        }
        render();
      }
      requestAnimationFrame(frame);
    }
    function step(dt) {
      t += dt;
      if (pressed.crt) { crt = !crt; store.set('crt', crt); }
      if (pressed.mute) Arcade.setMuted(!Arcade.isMuted());
      if (state === 'title') { if (pressed.ok || pressed.jump) { runTime = 0; runValid = true; loadLevel(0); state = 'play'; } }
      else if (state === 'play') {
        if (pressed.pause) { state = 'paused'; return; }
        if (pressed.restart) { runValid = false; loadLevel(lvlIdx); return; }
        updatePlay(dt);
      } else if (state === 'paused') { if (pressed.pause || pressed.ok || pressed.jump) state = 'play'; }
      else if (state === 'clear') {
        updateWorld(dt);
        if (pressed.ok || pressed.jump) { if (lvlIdx < LEVELS.length - 1) { loadLevel(lvlIdx + 1); state = 'play'; } else state = 'end'; }
      } else if (state === 'end') { updateWorld(dt); if (pressed.ok || pressed.jump) state = 'title'; }
    }
    function render() {
      if (state === 'title') drawTitle();
      else {
        drawWorld(); drawHud();
        if (state === 'paused') dialog('Paused', ['Byte is waiting.', ['Level', LEVEL_META[lvlIdx].name], ['Time', fmt(levelTime)]], coarse ? 'TAP TO RESUME' : 'P OR ENTER TO RESUME');
        if (state === 'clear' && clearInfo) {
          const c = clearInfo;
          dialog('Level complete', [
            ['Bits collected', `${c.got} / ${c.of}`, c.got === c.of ? '#0a7a3a' : null],
            ['Time', fmt(c.time)],
            ['Deaths', String(c.deaths)],
            c.isBest ? ['New best time!', c.prev ? 'was ' + fmt(c.prev) : 'first clear', '#b5203a'] : ['Best time', fmt(store.get('best', {})[lvlIdx].t)]
          ], lvlIdx < LEVELS.length - 1 ? (coarse ? 'TAP FOR NEXT LEVEL' : 'ENTER FOR NEXT LEVEL') : (coarse ? 'TAP TO FINISH' : 'ENTER TO FINISH'));
        }
        if (state === 'end') dialog('Disk check complete', [
          'Byte made it out. All three levels clear.',
          ['Full run', runValid ? fmt(runTime) : 'restarted, not timed'],
          clearInfo && clearInfo.runBest ? ['New best full run!', '', '#b5203a'] : ['Best full run', fmt(store.get('run', null))]
        ], coarse ? 'TAP FOR TITLE' : 'ENTER FOR TITLE');
      }
      drawCrt();
    }

    loadLevel(0); cam.x = 0;
    requestAnimationFrame(frame);

      api.restart = () => restartLevel && restartLevel();
    }
  });
})();

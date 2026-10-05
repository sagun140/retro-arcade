/* Ski Slope: original downhill skier in the spirit of the 1991 classic.
   8 poses + stops, mouse/touch steering toward the pointer, ramps and tricks, slalom courses, and a snow monster after 2000 m. */
(() => {
  const VW = 320, VH = 240, M = 6, SKY = 84;                 // internal resolution, px per meter, skier screen y
  const START_Y = 60, GATE_Y = 130, FIRST_FLAG = 240, GAP = 100, NFLAGS = 24, FINISH_Y = 2700, MONSTER_M = 2000;
  const LIFT_X = 236, CH = 128, GRAV = 420;
  const LANES = [
    { id: 'slalom', x: -120, label: 'SLALOM', short: 'SLALOM', color: '#e01b24' },
    { id: 'tree', x: -40, label: 'TREE SLALOM', short: 'TREE', color: '#11692a' },
    { id: 'free', x: 40, label: 'FREESTYLE', short: 'FREESTYLE', color: '#7a1fb0' },
    { id: 'endless', x: 120, label: 'ENDLESS', short: 'ENDLESS', color: '#1a3fd6' }
  ];
  const TRICKS = [null, { name: 'SPREAD EAGLE', dur: .45, pts: 20 }, { name: 'HELICOPTER', dur: .6, pts: 40 }, { name: 'BACKFLIP', dur: .7, pts: 60 }, { name: 'DAFFY', dur: .45, pts: 30 }];
  const BOX = { bigTree: [10, 5], smallTree: [7, 4], deadTree: [4, 3], rock: [10, 4], stump: [8, 4], mogul: [14, 4], ramp: [16, 4], tower: [5, 3] };
  const AIR_Z = { bigTree: 12, smallTree: 7, deadTree: 9, rock: 2, stump: 2, tower: 30 };
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="9" width="16" height="7" fill="#eef4ff"/><rect x="5" y="7" width="11" height="2" fill="#eef4ff"/><rect x="2" y="1" width="1" height="2" fill="#11692a"/><rect x="1" y="3" width="3" height="2" fill="#11692a"/><rect x="0" y="5" width="5" height="2" fill="#11692a"/><rect x="0" y="7" width="5" height="2" fill="#0b4a1c"/><rect x="2" y="9" width="1" height="2" fill="#6b3a1a"/><rect x="10" y="0" width="2" height="1" fill="#ffd23f"/><rect x="10" y="1" width="2" height="2" fill="#f2c09a"/><rect x="9" y="3" width="4" height="3" fill="#e01b24"/><rect x="10" y="6" width="1" height="2" fill="#1a3fd6"/><rect x="12" y="6" width="1" height="2" fill="#1a3fd6"/><rect x="13" y="4" width="1" height="5" fill="#555"/><rect x="7" y="8" width="2" height="1" fill="#111"/><rect x="9" y="9" width="2" height="1" fill="#111"/><rect x="11" y="10" width="2" height="1" fill="#111"/><rect x="9" y="8" width="2" height="1" fill="#111"/><rect x="11" y="9" width="2" height="1" fill="#111"/><rect x="13" y="10" width="2" height="1" fill="#111"/></svg>';
  const store = { get: (k, d) => Arcade.store.get('ski.' + k, d), set: (k, v) => Arcade.store.set('ski.' + k, v) };
  const fmt = s => { if (s == null) return '-'; const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s - Math.floor(s / 60) * 60; return h + ':' + String(m).padStart(2, '0') + ':' + r.toFixed(2).padStart(5, '0'); };
  const api = {};

  /* ---------- 3x5 pixel font (each glyph: 5 rows of 3 bits) ---------- */
  const GL = { A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755',
    N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34652', 7: '71222', 8: '25252', 9: '25316',
    ':': '02020', '.': '00002', ',': '00024', '-': '00700', '+': '02720', '!': '22202', '?': '61202', '/': '11244', "'": '22000', '<': '12421', '>': '42124',
    '(': '24442', ')': '21112', '=': '07070', '↓': '22272' };
  function text(g, s, x, y, c, sc = 1, align = 'left') {
    s = String(s).toUpperCase(); const w = s.length * 4 * sc - sc;
    if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
    g.fillStyle = c;
    for (let i = 0; i < s.length; i++) {
      const gl = GL[s[i]]; if (!gl) continue;
      for (let r = 0; r < 5; r++) { const b = +gl[r]; for (let col = 0; col < 3; col++) if (b & (4 >> col)) g.fillRect(x + (i * 4 + col) * sc, y + r * sc, sc, sc); }
    }
    return w;
  }

  /* ---------- pixel sprites (all fillRect) ---------- */
  const P = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function line(g, c, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    g.fillStyle = c;
    for (let n = 0; n < 64; n++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  const PAL = { hat: '#ffd23f', skin: '#f2c09a', coat: '#e01b24', coat2: '#a3121a', pants: '#1a3fd6', ski: '#14141a', pole: '#6b6b78' };
  const NPC_PALS = [
    { hat: '#e01b24', skin: '#f2c09a', coat: '#1d9a3a', coat2: '#11602a', pants: '#3a2a1a', ski: '#7a1fb0', pole: '#6b6b78' },
    { hat: '#1a3fd6', skin: '#d9a07a', coat: '#ff7a1a', coat2: '#b44c00', pants: '#222228', ski: '#1a3fd6', pole: '#6b6b78' },
    { hat: '#ffffff', skin: '#f2c09a', coat: '#9b30d9', coat2: '#5e1a8a', pants: '#1a6bd6', ski: '#e01b24', pole: '#6b6b78' }
  ];

  function drawSkier(g, X, Y, dir, pal, o = {}) {
    const z = Math.round(o.z || 0);
    if (z > 0) { P(g, '#a9b6cc', X - 3, Y - 2, 7, 1); P(g, '#a9b6cc', X - 4, Y - 1, 9, 2); }
    if (o.crash) return drawCrashed(g, X, Y, pal, o.t || 0);
    const y = Y - z, tr = o.trick || 0, p = o.trickP || 0;
    const a = dir * Math.PI / 8;
    const sa = tr === 2 ? a + p * Math.PI * 2 : a;
    const flip = tr === 3 && p > .25 && p < .75;
    if (flip) { g.save(); g.translate(0, (y - 8) * 2); g.scale(1, -1); }
    // skis
    for (const s of [-1, 1]) {
      const as = sa + (tr === 1 ? s * .55 : 0), vx = Math.sin(as), vy = Math.cos(as) * .75;
      const fx = X + Math.round(Math.cos(sa) * 2 * s), fy = y + Math.round(-Math.sin(sa) * 1.5 * s) + (tr === 4 ? s * 3 : 0);
      line(g, pal.ski, fx - vx * 4, fy - vy * 4, fx + vx * 6, fy + vy * 6);
    }
    const side = Math.abs(dir) >= 3 && tr !== 1 ? Math.sign(dir) : 0;
    const tx = X + Math.round(Math.sin(a) * 1.5);
    // poles
    if (tr === 0 || tr === 2 || tr === 3) {
      const back = -Math.sin(a) * 4;
      line(g, pal.pole, tx - 4, y - 7, tx - 4 + back - 1, y);
      line(g, pal.pole, tx + 4, y - 7, tx + 4 + back + 1, y);
    }
    // legs
    if (tr === 1) { P(g, pal.pants, X - 3, y - 5, 2, 5); P(g, pal.pants, X + 2, y - 5, 2, 5); }
    else if (side) { P(g, pal.pants, X - 1, y - 5, 3, 5); P(g, '#10288f', X - 1 + (side > 0 ? 2 : 0), y - 3, 1, 3); }
    else { P(g, pal.pants, X - 2, y - 5, 2, 5); P(g, pal.pants, X + 1, y - 5, 2, 5); }
    // torso + arms
    if (side) { P(g, pal.coat, tx - 2, y - 11, 5, 6); P(g, pal.coat2, tx + (side > 0 ? -2 : 2), y - 11, 1, 6); P(g, pal.coat2, tx + side * 2, y - 8, 2, 2); }
    else { P(g, pal.coat, tx - 3, y - 11, 7, 6); P(g, pal.coat2, tx + 3, y - 11, 1, 6); P(g, pal.coat2, tx - 3, y - 6, 7, 1); }
    if (tr === 1) { P(g, pal.coat, tx - 8, y - 11, 17, 2); P(g, pal.skin, tx - 9, y - 11, 1, 2); P(g, pal.skin, tx + 9, y - 11, 1, 2); }
    if (tr === 4) { P(g, pal.coat, tx - 5, y - 16, 2, 6); P(g, pal.coat, tx + 4, y - 16, 2, 6); }
    // head
    const hx = tx - 2 + side;
    P(g, pal.skin, hx, y - 15, 4, 4); P(g, pal.hat, hx, y - 17, 4, 2); P(g, pal.hat, hx + 1, y - 18, 2, 1);
    if (!side) P(g, '#222', hx, y - 14, 4, 1); else P(g, '#222', side > 0 ? hx + 2 : hx, y - 14, 2, 1);
    if (flip) g.restore();
  }
  function drawCrashed(g, X, Y, pal, t) {
    line(g, pal.ski, X - 6, Y - 3, X + 5, Y + 1); line(g, pal.ski, X - 6, Y + 1, X + 5, Y - 3);
    P(g, pal.pants, X - 4, Y - 3, 8, 2);
    P(g, pal.coat, X - 3, Y - 9, 7, 6); P(g, pal.coat2, X + 3, Y - 9, 1, 6);
    P(g, pal.skin, X - 2, Y - 13, 4, 4); P(g, '#222', X - 2, Y - 12, 4, 1);
    P(g, pal.hat, X + 6, Y - 1, 3, 2);               // hat knocked off
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1, sx = X + Math.round(Math.cos(a) * 6), sy = Y - 16 + Math.round(Math.sin(a) * 2);
      P(g, '#ffb800', sx, sy - 1, 1, 3); P(g, '#ffb800', sx - 1, sy, 3, 1);
    }
  }
  function drawTree(g, X, Y, big) {
    const H = big ? 21 : 12, th = big ? 7 : 6, cap = big ? 9 : 5;
    P(g, '#6b3a1a', X - 1, Y - 4, 3, 4); P(g, '#4a2810', X + 1, Y - 4, 1, 4);
    const top = Y - 4 - H;
    for (let r = 0; r < H; r++) {
      const ti = Math.floor(r / th), j = r - ti * th, hw = Math.min(1 + ti * 2 + Math.floor(j * .9), cap);
      P(g, '#1f8a3a', X - hw, top + r, hw * 2 + 1, 1); P(g, '#0f5a22', X + 1, top + r, hw, 1);
      if (j === th - 1 || r === H - 1) { P(g, '#ffffff', X - hw, top + r, 2, 1); P(g, '#dfe8f5', X + hw - 1, top + r, 1, 1); }
    }
    P(g, '#e6edf7', X - 4, Y, 9, 1);
  }
  function drawDead(g, X, Y) {
    P(g, '#5a3a1a', X, Y - 17, 1, 17); P(g, '#7a5a3a', X - 1, Y - 3, 3, 3);
    line(g, '#5a3a1a', X, Y - 10, X - 4, Y - 14); line(g, '#5a3a1a', X, Y - 7, X + 4, Y - 11); line(g, '#5a3a1a', X, Y - 13, X + 3, Y - 16);
  }
  function drawRock(g, X, Y) {
    P(g, '#dfe6f0', X - 6, Y, 12, 1); P(g, '#6f7480', X - 5, Y - 4, 10, 4); P(g, '#6f7480', X - 3, Y - 6, 6, 2);
    P(g, '#a8adb8', X - 3, Y - 5, 3, 1); P(g, '#4a4e58', X + 2, Y - 3, 3, 3); P(g, '#ffffff', X - 2, Y - 6, 2, 1);
  }
  function drawStump(g, X, Y) {
    P(g, '#7a4a1a', X - 4, Y - 4, 8, 4); P(g, '#c8955a', X - 4, Y - 5, 8, 2); P(g, '#7a4a1a', X - 1, Y - 5, 2, 1); P(g, '#ffffff', X - 3, Y - 6, 4, 1);
  }
  function drawMogul(g, X, Y) { P(g, '#e4ebf6', X - 4, Y - 3, 8, 1); P(g, '#cdd9ea', X - 6, Y - 2, 12, 1); P(g, '#b6c5dc', X - 5, Y - 1, 11, 1); }
  function drawRamp(g, X, Y) {
    P(g, '#7a4a12', X - 9, Y - 2, 18, 2); P(g, '#d79a4a', X - 8, Y - 7, 16, 5); P(g, '#a86a26', X - 8, Y - 5, 16, 1); P(g, '#a86a26', X - 8, Y - 3, 16, 1);
    P(g, '#f0c070', X - 8, Y - 7, 16, 1);
  }
  function drawFlag(g, X, Y, f) {
    P(g, '#333', X, Y - 13, 1, 13);
    const c = f.missed ? '#9a9aa2' : f.pass === 'L' ? '#1a3fd6' : '#e01b24', cx = f.pass === 'L' ? X - 6 : X + 1;
    P(g, c, cx, Y - 13, 6, 5);
    if (f.pass === 'L') { P(g, '#fff', X - 5, Y - 11, 1, 1); P(g, '#fff', X - 4, Y - 12, 1, 3); P(g, '#fff', X - 3, Y - 11, 3, 1); }
    else { P(g, '#fff', X + 6, Y - 11, 1, 1); P(g, '#fff', X + 5, Y - 12, 1, 3); P(g, '#fff', X + 2, Y - 11, 3, 1); }
  }
  function drawGate(g, X, Y, label, color) {
    P(g, '#444', X - 28, Y - 20, 1, 20); P(g, '#444', X + 28, Y - 20, 1, 20);
    P(g, '#000', X - 28, Y - 22, 57, 9); P(g, color, X - 27, Y - 21, 55, 7);
    text(g, label, X, Y - 20, '#ffffff', 1, 'center');
  }
  function drawSign(g, X, Y) {
    P(g, '#5a3a1a', X - 24, Y - 8, 2, 8); P(g, '#5a3a1a', X + 22, Y - 8, 2, 8);
    P(g, '#3a2208', X - 31, Y - 22, 62, 15); P(g, '#a8682a', X - 30, Y - 21, 60, 13);
    text(g, 'PICK A RUN', X, Y - 19, '#ffe66b', 1, 'center'); text(g, '↓ ↓ ↓ ↓', X, Y - 13, '#ffffff', 1, 'center');
  }
  function drawTower(g, X, Y) {
    P(g, '#3a3f4a', X - 2, Y - 2, 5, 2); P(g, '#7a808c', X - 1, Y - 30, 3, 29); P(g, '#5a5f6a', X + 1, Y - 30, 1, 29);
    P(g, '#3a3f4a', X - 11, Y - 31, 23, 2);
  }
  function drawDog(g, X, Y, f, t) {
    const leg = Math.floor(t * 10) % 2, B = '#8a5a2a', D = '#5a3a1a';
    P(g, D, X - 3 + leg, Y - 2, 1, 2); P(g, D, X - 1 - leg, Y - 2, 1, 2); P(g, D, X + 1 + leg, Y - 2, 1, 2); P(g, D, X + 3 - leg, Y - 2, 1, 2);
    P(g, B, X - 4, Y - 5, 8, 3); P(g, '#e8d2b0', X - 2, Y - 3, 4, 1);
    const hx = f > 0 ? X + 3 : X - 6; P(g, B, hx, Y - 8, 4, 3); P(g, D, f > 0 ? hx + 1 : hx + 2, Y - 9, 1, 2); P(g, '#111', f > 0 ? hx + 3 : hx, Y - 7, 1, 1);
    P(g, B, f > 0 ? X - 5 : X + 4, Y - 7 - (Math.floor(t * 8) % 2), 1, 2);
  }
  function drawMonster(g, X, Y, mode, t) {
    const fr = Math.floor(t * 8) % 2, O = '#2d3550', F = '#f2f5fb', S = '#b9c4d9';
    const R = [];
    const r = (x, y, w, h, c) => R.push([x, y, w, h, c]);
    const done = mode === 'full';
    if (mode === 'run') { r(-6, fr ? -9 : -7, 4, fr ? 6 : 7, F); r(2, fr ? -7 : -9, 4, fr ? 7 : 6, F); }
    else { r(-6, -7, 4, 7, F); r(2, -7, 4, 7, F); }
    const up = mode === 'run' ? fr : !done;
    if (up) { r(-12, -34, 4, 14, F); r(8, -34, 4, 14, F); } else { r(-12, -21, 4, 13, F); r(8, -21, 4, 13, F); }
    r(-8, -22, 16, 15, F); r(-6, -29, 12, 8, F); r(-7, -32, 2, 3, '#d9b871'); r(5, -32, 2, 3, '#d9b871');
    P(g, '#d3dbe8', X - 9, Y - 1, 18, 2);
    for (const q of R) P(g, O, X + q[0] - 1, Y + q[1] - 1, q[2] + 2, q[3] + 2);
    for (const q of R) P(g, q[4], X + q[0], Y + q[1], q[2], q[3]);
    P(g, S, X + 4, Y - 22, 4, 15); P(g, '#e1e7f2', X - 4, Y - 16, 8, 7);
    P(g, S, X - 6, Y - 24, 1, 2); P(g, S, X + 9, Y - 30, 3, 9);
    P(g, '#86a9dc', X - 4, Y - 27, 8, 5);
    P(g, '#ff2a2a', X - 3, Y - 26, 2, 1); P(g, '#ff2a2a', X + 1, Y - 26, 2, 1);
    const open = mode === 'run' ? true : mode === 'eat' ? fr === 0 : false;
    if (open) { P(g, '#7a0d18', X - 3, Y - 24, 6, 2); P(g, '#fff', X - 3, Y - 24, 1, 1); P(g, '#fff', X + 2, Y - 24, 1, 1); }
    else P(g, '#7a0d18', X - 3, Y - 23, 6, 1);
    // claws
    if (up) { P(g, O, X - 12, Y - 36, 1, 1); P(g, O, X - 9, Y - 36, 1, 1); P(g, O, X + 8, Y - 36, 1, 1); P(g, O, X + 11, Y - 36, 1, 1); }
  }

  /* ---------- preview thumbnail ---------- */
  function preview(g, w, h, t) {
    g.save(); g.imageSmoothingEnabled = false; g.fillStyle = '#fbfdff'; g.fillRect(0, 0, w, h); g.scale(2, 2);
    const W = 104, scroll = t * 45, items = [];
    for (let i = 0; i < 16; i++) { const y = ((i * 41 + 300 - scroll) % 160 + 160) % 160 - 30, x = (i * 37 + (i % 3) * 11) % (W + 10) - 5; items.push({ y, f: () => drawTree(g, x, y, i % 3 !== 0) }); }
    const ph = t * 1.6, sx = Math.round(W / 2 + Math.sin(ph) * 22), dir = Math.max(-3, Math.min(3, Math.round(Math.cos(ph) * 3)));
    items.push({ y: 22, f: () => drawSkier(g, sx, 22, dir, PAL) });
    const lt = t % 10;
    if (lt > 6) items.push({ y: -40 + (lt - 6) * 14, f: () => drawMonster(g, sx - Math.round(Math.sin(ph - .6) * 10), Math.round(-40 + (lt - 6) * 14), 'run', t) });
    items.sort((a, b) => a.y - b.y).forEach(it => it.f());
    P(g, '#000', 70, 2, 32, 9); P(g, '#fff', 71, 3, 30, 7); text(g, Math.floor(t * 30) + 'M', 99, 4, '#000', 1, 'right');
    g.restore();
  }

  Arcade.css(`
    .ski-screen { background: #000; padding: 2px; }
    .ski-screen canvas { display: block; width: 100%; aspect-ratio: 4 / 3; max-height: calc(100dvh - 170px); object-fit: contain; image-rendering: pixelated; background: #000; touch-action: none; cursor: crosshair; outline: none; }
    .win.max .ski-screen canvas { max-height: calc(100dvh - 130px); }
    .ski-touch { display: none; justify-content: space-between; gap: 6px; padding: 6px 2px 2px; touch-action: none; }
    .ski-touch button { flex: 1; height: 46px; border: 0; background: var(--face); color: var(--ink); font: bold 13px var(--ui); touch-action: none; }
    .ski-touch button.ski-on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); background: var(--hi2); }
    .ski-coarse .ski-touch { display: flex; }
    .ski-coarse .ski-screen canvas { max-height: calc(100dvh - 240px); }
  `);

  Arcade.scores.add({
    game: 'Ski Slope',
    render() {
      const b = store.get('best', {});
      return '<tr><th>Event</th><th>Best</th></tr>' +
        `<tr><td>Slalom</td><td class="num">${b.slalom != null ? fmt(b.slalom) : '-'}</td></tr>` +
        `<tr><td>Tree slalom</td><td class="num">${b.tree != null ? fmt(b.tree) : '-'}</td></tr>` +
        `<tr><td>Freestyle</td><td class="num">${b.free != null ? b.free + ' style' : '-'}</td></tr>` +
        `<tr><td>Longest run</td><td class="num">${b.dist != null ? b.dist + ' m' : '-'}</td></tr>`;
    }
  });

  const def = Arcade.app({
    id: 'ski', title: 'Ski Slope', icon: ICON, width: 660, max: true, folder: 'Games', status: true, preview,
    hint: 'Downhill skiing: slalom, tree slalom, freestyle jumps... and after 2000 m something hungry follows you.',
    menus: [
      { label: 'Game', items: [
        { label: 'New Game', key: 'F2', action: () => api.newGame && api.newGame() },
        { label: 'Pause', key: 'F3', checked: () => !!(api.paused && api.paused()), action: () => api.pause && api.pause() },
        '-',
        { label: 'Fast mode', key: 'F', checked: () => !!(api.fast && api.fast()), action: () => api.toggleFast && api.toggleFast() },
        { label: 'Sound', checked: () => !Arcade.isMuted(), action: () => Arcade.setMuted(!Arcade.isMuted()) },
        '-',
        { label: 'Exit', action: () => Arcade.apps.ski.ctx.close() }
      ] },
      { label: 'Help', items: [{ label: 'How to play', action: () => Arcade.dialog({ title: 'How to play', icon: 'info',
        text: 'Steer with the arrow keys, or point the mouse (or drag a finger) where you want to go: the skier turns toward the pointer, and pointing above him stops. Down goes straight, Up stops. Press F for fast mode. Ski through a gate at the top to pick a run: Slalom and Tree Slalom (pass blue flags on their left and red flags on their right, 5 second penalty per miss), Freestyle (style points for jumps), or Endless. Hit a wooden ramp to jump, then press 1-4 (or click / TRICK) for tricks; land before the trick ends or you crash. Moguls slow you down. Beyond 2000 m, keep moving.' }) }] }
    ],
    build(win) {
      win.body.innerHTML = `<div class="ski-screen bevel-in"><canvas width="${VW}" height="${VH}" tabindex="0" aria-label="Ski Slope game screen"></canvas></div>
        <div class="ski-touch"><button data-k="fast">FAST</button><button data-k="trick">TRICK</button><button data-k="pause">PAUSE</button></div>`;
      if (Arcade.coarse) win.body.classList.add('ski-coarse');
      const cv = win.body.querySelector('canvas'), g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      const beep = Arcade.beep;

      /* ---------- sound ---------- */
      let noiseBuf = null;
      function noise(dur, f0, f1, vol, type = 'bandpass', delay = 0) {
        if (Arcade.isMuted()) return; const a = Arcade.audio(); if (!a) return;
        if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
        s.buffer = noiseBuf; f.type = type; f.Q.value = 1.1;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + dur * .25); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
        s.connect(f).connect(gn).connect(a.destination); s.start(t); s.stop(t + dur + .05);
      }
      const sfx = {
        whoosh: () => noise(.28, 2600, 700, .08),
        thud: () => { noise(.25, 500, 80, .3, 'lowpass'); beep(110, .2, 'triangle', .14, -60); },
        roar: () => { noise(1.3, 380, 110, .35, 'lowpass'); beep(150, 1.2, 'sawtooth', .07, -75); beep(158, 1.2, 'sawtooth', .05, -90, .06); beep(75, 1.2, 'square', .04, -30); },
        chomp: () => { beep(140, .09, 'square', .07, -60); noise(.1, 900, 300, .1); },
        jump: () => beep(330, .16, 'square', .03, 330),
        trick: () => beep(660, .07, 'square', .03, 220),
        land: () => noise(.12, 1400, 400, .07),
        ok: () => beep(1046, .06, 'square', .025),
        miss: () => beep(180, .25, 'sawtooth', .045, -60),
        bark: () => { beep(640, .05, 'square', .04, -260); beep(580, .06, 'square', .04, -260, .13); },
        go: () => { beep(523, .08, 'square', .03); beep(784, .12, 'square', .03, 0, .08); },
        finish: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, .13, 'square', .035, 0, i * .09))
      };

      /* ---------- world ---------- */
      let seed = 1, S = null, course = [], laneFlags = {}, camX = 0, camY = 0, lastWhoosh = 0, statusT = 0;
      const chunks = new Map();
      const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) ^ seed; h = Math.imul(h ^ h >>> 13, 1274126177); return (h ^ h >>> 16) >>> 0; };
      const blocked = (x, y) => (y < 200 && Math.abs(x) < 280) || (y > 90 && y < FINISH_Y + 60 && x > -172 && x < 90) || Math.abs(x - LIFT_X) < 24;
      function chunk(cx, cy) {
        const key = cx + ',' + cy; let c = chunks.get(key); if (c) return c;
        c = []; const r = rng(seed ^ Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663));
        const add = (type, x, y) => { if (!blocked(x, y)) c.push({ type, x: Math.round(x), y: Math.round(y) }); };
        const depth = cy * CH / M, n = 2 + Math.floor(r() * 3) + (depth > 1000) + (depth > 3000);
        for (let i = 0; i < n; i++) {
          const x = cx * CH + r() * CH, y = cy * CH + r() * CH, q = r();
          const type = q < .34 ? 'bigTree' : q < .54 ? 'smallTree' : q < .6 ? 'deadTree' : q < .7 ? 'rock' : q < .78 ? 'stump' : q < .93 ? 'mogul' : 'ramp';
          if (type === 'mogul') { const m = 3 + Math.floor(r() * 4); for (let j = 0; j < m; j++) add('mogul', x + r() * 44 - 22, y + r() * 30 - 15); }
          else add(type, x, y);
        }
        if (LIFT_X >= cx * CH && LIFT_X < (cx + 1) * CH)
          for (let k = Math.max(0, Math.ceil((cy * CH - 300) / 260)); 300 + k * 260 < (cy + 1) * CH; k++) c.push({ type: 'tower', x: LIFT_X, y: 300 + k * 260 });
        chunks.set(key, c); return c;
      }
      function statics(x0, y0, x1, y1, out) {
        for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++)
          for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++)
            for (const o of chunk(cx, cy)) if (o.x > x0 - 20 && o.x < x1 + 20 && o.y > y0 && o.y < y1) out.push(o);
        for (const o of course) if (o.y > y0 && o.y < y1 && o.x > x0 - 40 && o.x < x1 + 40) out.push(o);
        return out;
      }
      function buildCourse() {
        const c = [{ type: 'sign', x: 0, y: 34 }];
        laneFlags = {};
        LANES.forEach(l => { c.push({ type: 'gate', x: l.x, y: GATE_Y, label: l.label, color: l.color }); if (l.id !== 'endless') c.push({ type: 'finish', x: l.x, y: FINISH_Y }); });
        for (const id of ['slalom', 'tree']) {
          const L = LANES.find(l => l.id === id), fl = laneFlags[id] = [];
          for (let i = 0; i < NFLAGS; i++) {
            const left = i % 2 === 0, f = { type: 'flag', lane: id, x: L.x + (left ? -20 : 20), y: FIRST_FLAG + i * GAP, pass: left ? 'L' : 'R', done: false, missed: false };
            c.push(f); fl.push(f);
            if (id === 'tree') {
              c.push({ type: Math.random() < .5 ? 'bigTree' : 'smallTree', x: L.x + Math.round(Math.random() * 6 - 3), y: f.y + 50 });
              if (Math.random() < .6) c.push({ type: 'smallTree', x: L.x + (left ? 26 : -26), y: f.y + 20 + Math.round(Math.random() * 20) });
            }
          }
        }
        const F = LANES.find(l => l.id === 'free').x;
        for (let y = 260; y < FINISH_Y - 120; y += 200) {
          c.push({ type: 'ramp', x: F + Math.round(Math.random() * 30 - 15), y });
          for (let j = 0; j < 5; j++) c.push({ type: 'mogul', x: F + Math.round(Math.random() * 60 - 30), y: y + 90 + Math.round(Math.random() * 40) });
        }
        return c.sort((a, b) => a.y - b.y);
      }
      function newGame() {
        seed = (Math.random() * 1e9) | 0; chunks.clear(); course = buildCourse();
        S = { state: 'play', started: false, t: 0, time: 0, mode: null, courseT: 0, penalty: 0, gatesOk: 0, gatesDone: 0, style: 0, style0: 0, finished: false,
          sk: { x: 0, y: START_Y, dir: 0, v: 0, z: 0, vz: 0, air: false, avx: 0, avy: 0, trick: 0, trickT: 0, done: [], pending: 0, crashT: 0, fast: false, lastSide: 1, bump: 0 },
          npcs: [], dogs: [], monster: null, eatT: 0, tracks: [], toast: null, over: null, shake: 0 };
        camX = -VW / 2; camY = START_Y - SKY; statusT = 0;
        win.focus();
      }
      const dist = () => Math.max(0, Math.floor((S.sk.y - START_Y) / M));
      const toast = (msg, dur = 2.5) => { S.toast = { msg, t: dur }; };

      /* ---------- input ---------- */
      const ptr = { x: 0, y: 0, on: false, down: false };
      function start() { if (S.state === 'play' && !S.started) S.started = true; }
      function setDir(d) {
        const k = S.sk; if (d === k.dir) return;
        if (k.v > 40 && !k.air && S.t - lastWhoosh > .22) { sfx.whoosh(); lastWhoosh = S.t; }
        k.dir = d; if (d) k.lastSide = Math.sign(d);
      }
      function turn(s) {
        const k = S.sk; if (k.crashT > 0) return;
        if (k.dir === 4 * s && k.v < 8 && !k.air) { k.x += 5 * s; return; }   // side-step while stopped
        setDir(Math.max(-4, Math.min(4, k.dir + s)));
      }
      function trick(n) {
        const k = S.sk; if (!k.air || k.trick || k.crashT > 0) return;
        if (!n) { const opts = [1, 2, 3, 4].filter(i => !k.done.includes(i)); n = opts.length ? opts[Math.floor(Math.random() * opts.length)] : 1 + Math.floor(Math.random() * 4); }
        k.trick = n; k.trickT = 0; sfx.trick();
      }
      function pause() {
        if (S.state === 'play') S.state = 'paused';
        else if (S.state === 'paused') S.state = 'play';
      }
      function toggleFast() { const k = S.sk; if (k.crashT > 0) return; k.fast = !k.fast; start(); }
      api.newGame = newGame; api.pause = pause; api.paused = () => S && S.state === 'paused';
      api.fast = () => S && S.sk.fast; api.toggleFast = () => S && toggleFast();

      let lastTurnKey = 0;
      win.onKey(e => {
        const c = e.code;
        if (c === 'F2') { e.preventDefault(); newGame(); return; }
        if (c === 'F3' || c === 'KeyP' || c === 'Escape') { e.preventDefault(); if (!e.repeat) pause(); return; }
        if (S.state === 'over') { if (c === 'Enter' || c === 'Space') { e.preventDefault(); newGame(); } return; }
        if (S.state === 'paused') { if (c === 'Enter' || c === 'Space') { e.preventDefault(); pause(); } return; }
        if (S.state !== 'play') return;
        const k = S.sk;
        if (c === 'ArrowLeft' || c === 'ArrowRight') {
          e.preventDefault(); ptr.on = false;
          const now = performance.now(); if (e.repeat && now - lastTurnKey < 90) return; lastTurnKey = now;
          start(); turn(c === 'ArrowLeft' ? -1 : 1);
        } else if (c === 'ArrowDown') { e.preventDefault(); ptr.on = false; start(); if (k.crashT <= 0) setDir(0); }
        else if (c === 'ArrowUp') {
          e.preventDefault(); ptr.on = false; if (k.crashT > 0) return;
          if (Math.abs(k.dir) === 4 && k.v < 8 && !k.air) { if (!e.repeat || performance.now() - lastTurnKey > 90) { k.y -= 4; lastTurnKey = performance.now(); } }
          else setDir((k.dir ? Math.sign(k.dir) : k.lastSide) * 4);
        } else if (c === 'KeyF') { e.preventDefault(); if (!e.repeat) toggleFast(); }
        else if (/^(Digit|Numpad)[1-4]$/.test(c)) { e.preventDefault(); trick(+c.slice(-1)); }
        else if (c === 'Enter' || c === 'Space') { e.preventDefault(); if (k.air) trick(0); else start(); }
      });
      function toCanvas(e) {
        const r = cv.getBoundingClientRect(), sc = Math.min(r.width / VW, r.height / VH);
        ptr.x = (e.clientX - r.left - (r.width - VW * sc) / 2) / sc; ptr.y = (e.clientY - r.top - (r.height - VH * sc) / 2) / sc;
      }
      let lastMove = null;
      cv.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' && !ptr.down) return;
        if (e.pointerType === 'mouse' && lastMove && Math.abs(e.clientX - lastMove[0]) + Math.abs(e.clientY - lastMove[1]) < 2) return;
        lastMove = [e.clientX, e.clientY]; toCanvas(e); ptr.on = true;
      });
      cv.addEventListener('pointerdown', e => {
        e.preventDefault(); cv.focus({ preventScroll: true });
        toCanvas(e); ptr.on = true; ptr.down = true; lastMove = [e.clientX, e.clientY];
        if (e.pointerType !== 'mouse') try { cv.setPointerCapture(e.pointerId); } catch {}
        if (S.state === 'over') { newGame(); return; }
        if (S.state === 'paused') { pause(); return; }
        if (S.state !== 'play') return;
        if (S.sk.air) trick(0); else start();
      });
      const up = () => { ptr.down = false; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      win.body.querySelectorAll('.ski-touch button').forEach(b => {
        b.addEventListener('pointerdown', e => {
          e.preventDefault(); b.classList.add('ski-on');
          const k = b.dataset.k;
          if (k === 'pause') { if (S.state === 'over') newGame(); else pause(); }
          else if (S.state === 'play') { if (k === 'fast') toggleFast(); else if (S.sk.air) trick(0); else start(); }
        });
        const off = () => b.classList.remove('ski-on');
        b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
      });
      win.on('blur', () => { if (S && S.state === 'play' && S.started) S.state = 'paused'; ptr.down = false; });
      win.on('close', () => { if (S && S.state === 'play' && S.started) S.state = 'paused'; });

      function steerToPointer() {
        const k = S.sk; if (k.crashT > 0) return;
        const dx = ptr.x - (k.x - camX), dy = ptr.y - (k.y - camY - 8);
        if (Math.hypot(dx, dy) < 8) return;
        const d = dy < -4 ? (dx < 0 ? -4 : 4) : Math.max(-4, Math.min(4, Math.round(Math.atan2(dx, Math.max(dy, .001)) / (Math.PI / 8))));
        setDir(d);
      }

      /* ---------- simulation ---------- */
      function near(x, y) { return statics(x - 24, y - 12, x + 24, y + 40, []); }
      function hits(o, x, y) { const b = BOX[o.type]; return b && Math.abs(o.x - x) < b[0] / 2 + 3 && y > o.y - b[1] - 1 && y - 3 < o.y; }
      function crash(o) {
        const k = S.sk;
        if (o) o.hit = true;
        for (const q of near(k.x, k.y)) if (q.type !== 'mogul' && q.type !== 'ramp' && hits(q, k.x, k.y)) q.hit = true;
        k.crashT = 1.3; k.v = 0; k.air = false; k.z = 0; k.vz = 0; k.trick = 0; k.pending = 0; k.fast = false; S.shake = .2;
        sfx.thud();
      }
      function launch(vz, pts) {
        const k = S.sk, a = k.dir * Math.PI / 8;
        k.air = true; k.z = .1; k.vz = vz; k.avx = Math.sin(a) * k.v; k.avy = Math.cos(a) * k.v; k.pending = pts; k.trick = 0; k.done = [];
        sfx.jump();
      }
      function updateSkier(dt) {
        const k = S.sk;
        if (ptr.on && (S.started || !Arcade.coarse)) steerToPointer();
        if (k.crashT > 0) { k.crashT -= dt; if (k.crashT <= 0) { k.crashT = 0; k.dir = 0; } return; }
        if (k.air) {
          k.z += k.vz * dt; k.vz -= GRAV * dt; k.x += k.avx * dt; k.y += k.avy * dt;
          if (k.trick) {
            k.trickT += dt; const T = TRICKS[k.trick];
            if (k.trickT >= T.dur) { k.pending += k.done.includes(k.trick) ? T.pts / 2 : T.pts; k.done.push(k.trick); k.trick = 0; sfx.ok(); }
          }
          for (const o of near(k.x, k.y)) if (!o.hit && AIR_Z[o.type] && k.z < AIR_Z[o.type] && hits(o, k.x, k.y)) { crash(o); return; }
          if (k.z <= 0) {
            k.z = 0; k.air = false; k.vz = 0;
            if (k.trick) { toast('BOTCHED ' + TRICKS[k.trick].name); crash(null); return; }
            if (k.pending) { S.style += k.pending; if (k.done.length) toast(k.done.map(i => TRICKS[i].name).join(' + ') + '  +' + k.pending, 2); }
            k.pending = 0; sfx.land();
          }
          return;
        }
        if (!S.started) return;
        const a = k.dir * Math.PI / 8, stop = Math.abs(k.dir) === 4, top = k.fast ? 235 : 150;
        const target = stop ? 0 : top * Math.pow(Math.cos(a), .8);
        k.v = k.v < target ? Math.min(target, k.v + (k.fast ? 170 : 110) * dt) : Math.max(target, k.v - (stop ? 320 : 200) * dt);
        k.x += Math.sin(a) * k.v * dt; k.y += Math.cos(a) * k.v * dt;
        let mog = false;
        for (const o of near(k.x, k.y)) {
          if (o.hit || !hits(o, k.x, k.y)) continue;
          if (o.type === 'mogul') { mog = true; continue; }
          if (o.type === 'ramp') { if (Math.cos(a) > .3 && k.v > 40) { launch(90 + k.v * .5, 10); return; } continue; }
          crash(o); return;
        }
        if (mog) {
          if (k.fast && k.v > 200) { launch(70, 2); return; }
          k.v = Math.max(Math.min(k.v, 45), k.v - 330 * dt); k.bump += dt;
        } else k.bump = 0;
        const last = S.tracks[S.tracks.length - 1];
        if (k.v > 5 && (!last || Math.abs(last.x - k.x) + Math.abs(last.y - k.y) > 1.5)) { S.tracks.push({ x: k.x, y: k.y, a }); if (S.tracks.length > 600) S.tracks.shift(); }
      }
      function updateCourse(dt) {
        const k = S.sk;
        if (!S.mode && k.y >= GATE_Y) {
          const lane = LANES.find(l => Math.abs(k.x - l.x) <= 28);
          S.mode = lane ? lane.id : 'endless'; S.courseT = 0; S.style0 = S.style;
          toast((lane ? lane.label : 'ENDLESS') + ' - GO!'); sfx.go();
        }
        if (!S.mode || S.mode === 'endless' || S.finished) return;
        S.courseT += dt;
        for (const f of laneFlags[S.mode] || []) {
          if (f.done || k.y < f.y) continue;
          f.done = true; S.gatesDone++;
          const dx = k.x - f.x, ok = (f.pass === 'L' ? dx < 0 : dx > 0) && Math.abs(dx) < 70;
          if (ok) { S.gatesOk++; sfx.ok(); } else { f.missed = true; S.penalty += 5; sfx.miss(); toast('MISSED GATE  +5 SEC', 1.4); }
        }
        if (k.y >= FINISH_Y) finish();
      }
      function finish() {
        S.finished = true;
        const best = store.get('best', {}), L = LANES.find(l => l.id === S.mode);
        let msg, isBest = false;
        if (S.mode === 'free') {
          const pts = S.style - S.style0; isBest = best.free == null || pts > best.free; if (isBest) best.free = pts;
          msg = 'FINISH! ' + pts + ' STYLE';
        } else {
          const tot = S.courseT + S.penalty; isBest = best[S.mode] == null || tot < best[S.mode]; if (isBest) best[S.mode] = tot;
          msg = 'FINISH ' + fmt(tot) + (S.penalty ? ' (+' + S.penalty + 'S)' : '');
        }
        store.set('best', best); sfx.finish();
        toast(L.label + ' ' + msg + (isBest ? '  NEW BEST!' : ''), 5);
      }
      function updateCritters(dt) {
        const k = S.sk;
        if (S.started && S.npcs.length < 3 && Math.random() < dt * .5)
          S.npcs.push({ x: camX + Math.random() * VW, y: camY + VH + 30, dir: Math.floor(Math.random() * 5) - 2, v: 50 + Math.random() * 35, turnT: 1, crashT: 0, hit: false, pal: NPC_PALS[Math.floor(Math.random() * NPC_PALS.length)] });
        if (S.started && dist() > 60 && S.dogs.length < 1 && Math.random() < dt * .12)
          S.dogs.push({ x: camX + Math.random() * VW, y: camY + VH + 20, vx: Math.random() < .5 ? -24 : 24, t: 0, barkT: 0, hit: false });
        const free = k.crashT <= 0 && k.z < 6 && S.state === 'play';
        for (const n of S.npcs) {
          if (n.crashT > 0) { n.crashT -= dt; continue; }
          n.turnT -= dt; if (n.turnT < 0) { n.dir = Math.max(-3, Math.min(3, n.dir + (Math.random() < .5 ? -1 : 1))); n.turnT = .6 + Math.random() * 1.6; }
          const a = n.dir * Math.PI / 8; n.x += Math.sin(a) * n.v * dt; n.y += Math.cos(a) * n.v * dt;
          if (free && !n.hit && Math.abs(n.x - k.x) < 6 && Math.abs(n.y - k.y) < 4) { n.hit = true; n.crashT = 1.6; crash(null); }
        }
        for (const d of S.dogs) {
          d.t += dt; d.barkT -= dt; d.x += d.vx * dt;
          if (Math.random() < dt * .4) d.vx = -d.vx;
          if (d.barkT < 0 && Math.hypot(d.x - k.x, d.y - k.y) < 70) { d.barkT = 2.5; sfx.bark(); }
          if (free && !d.hit && Math.abs(d.x - k.x) < 6 && Math.abs(d.y - k.y) < 4) { d.hit = true; toast('WOOF!', 1.2); crash(null); }
        }
        const keep = o => o.y > camY - 80 && Math.abs(o.x - k.x) < 420;
        S.npcs = S.npcs.filter(keep); S.dogs = S.dogs.filter(keep);
      }
      function updateMonster(dt) {
        const k = S.sk;
        if (!S.monster && dist() >= MONSTER_M) {
          S.monster = { x: k.x + Math.round(Math.random() * 160 - 80), y: camY - 44, t: 0 };
          sfx.roar(); S.shake = .5;
        }
        const m = S.monster; if (!m) return;
        m.t += dt;
        const sp = Math.min(300, 185 + m.t * 2.5), dx = k.x - m.x, dy = k.y - m.y, d = Math.hypot(dx, dy) || 1;
        if (d > 330) { m.x = k.x - dx / d * 300; m.y = k.y - dy / d * 300; }
        m.x += dx / d * Math.min(sp * dt, d); m.y += dy / d * Math.min(sp * dt, d);
        if (d < 9 && k.z < 14) { S.state = 'eaten'; S.eatT = 0; m.x = k.x; m.y = k.y + 1; k.trick = 0; }
      }
      let chompN = 0;
      function step(dt) {
        S.shake = Math.max(0, S.shake - dt);
        if (S.toast) { S.toast.t -= dt; if (S.toast.t <= 0) S.toast = null; }
        if (S.state === 'paused' || S.state === 'over') return;
        S.t += dt;
        if (S.state === 'eaten') {
          S.eatT += dt;
          const n = Math.floor((S.eatT - .5) / .25);
          if (S.eatT > .5 && S.eatT < 2.2 && n !== chompN) { chompN = n; sfx.chomp(); }
          if (S.eatT > 2.6) gameOver();
          return;
        }
        if (S.started) S.time += dt;
        updateSkier(dt); updateCourse(dt); updateCritters(dt); updateMonster(dt);
        if (S.state === 'play') { camX = S.sk.x - VW / 2; camY = S.sk.y - SKY; }
        for (const key of chunks.keys()) { const cy = +key.split(',')[1]; if ((cy + 2) * CH < camY) chunks.delete(key); }
      }
      function gameOver() {
        const d = dist(), best = store.get('best', {}), isBest = best.dist == null || d > best.dist;
        if (isBest) { best.dist = d; store.set('best', best); }
        S.state = 'over'; S.over = { dist: d, isBest, style: S.style };
      }

      /* ---------- rendering ---------- */
      function drawObj(o, X, Y) {
        switch (o.type) {
          case 'bigTree': return drawTree(g, X, Y, true);
          case 'smallTree': return drawTree(g, X, Y, false);
          case 'deadTree': return drawDead(g, X, Y);
          case 'rock': return drawRock(g, X, Y);
          case 'stump': return drawStump(g, X, Y);
          case 'mogul': return drawMogul(g, X, Y);
          case 'ramp': return drawRamp(g, X, Y);
          case 'tower': return drawTower(g, X, Y);
          case 'flag': return drawFlag(g, X, Y, o);
          case 'gate': return drawGate(g, X, Y, o.label, o.color);
          case 'finish': return drawGate(g, X, Y, 'FINISH', '#101014');
          case 'sign': return drawSign(g, X, Y);
        }
      }
      function drawLift(cx, cy) {
        const L = LIFT_X - 10 - cx, R = LIFT_X + 10 - cx;
        if (R < -10 || L > VW + 10) return;
        const gap = 70;
        for (const [X, d] of [[L, -1], [R, 1]]) {
          const base = S.t * 26 * d;
          for (let n = Math.floor((cy - 30 - base) / gap); ; n++) {
            const Y = Math.round(n * gap + base - cy); if (Y > VH + 10) break;
            P(g, '#3a3f4a', X, Y, 1, 6); P(g, '#7a2a1a', X - 3, Y + 6, 7, 2); P(g, '#5a1a10', X - 3, Y + 8, 1, 2); P(g, '#5a1a10', X + 3, Y + 8, 1, 2);
            const h = hash(n, d * 77);
            if (h % 3) { const pal = h % 2 ? PAL : NPC_PALS[h % 3]; P(g, pal.coat, X - 2, Y + 2, 5, 4); P(g, pal.skin, X - 1, Y - 1, 3, 3); P(g, pal.hat, X - 1, Y - 2, 3, 1); }
          }
        }
        P(g, '#2a2f3a', L, 0, 1, VH); P(g, '#2a2f3a', R, 0, 1, VH);
      }
      function box(x, y, w, h) { P(g, '#000', x, y, w, h); P(g, '#fff', x + 1, y + 1, w - 2, h - 2); }
      function winBox(title, lines, footer, y) {
        const w = 212, h = 20 + lines.length * 8 + (footer ? 11 : 0), x = (VW - w) / 2 | 0;
        y = y == null ? (VH - h) / 2 | 0 : y;
        P(g, 'rgba(0,0,0,.35)', x + 3, y + 3, w, h);
        P(g, '#c3c3c6', x, y, w, h); P(g, '#fff', x, y, w, 1); P(g, '#fff', x, y, 1, h);
        P(g, '#0c0c10', x, y + h - 1, w, 1); P(g, '#0c0c10', x + w - 1, y, 1, h); P(g, '#85858c', x + 1, y + h - 2, w - 2, 1); P(g, '#85858c', x + w - 2, y + 1, 1, h - 2);
        P(g, '#0a1a86', x + 3, y + 3, w - 6, 10); text(g, title, x + 6, y + 5, '#fff');
        lines.forEach((l, i) => { const [a, b, c] = Array.isArray(l) ? l : [l]; text(g, a, x + 8, y + 18 + i * 8, '#101014'); if (b != null) text(g, b, x + w - 8, y + 18 + i * 8, c || '#101014', 1, 'right'); });
        if (footer && Math.sin(S.t * 5 + performance.now() / 160) > -.4) text(g, footer, x + w / 2, y + h - 9, '#0a1a86', 1, 'center');
      }
      function render() {
        const k = S.sk, sh = S.shake > 0 ? S.shake * 10 : 0;
        const cx = Math.round(camX + (Math.random() - .5) * sh), cy = Math.round(camY + (Math.random() - .5) * sh);
        P(g, '#fbfdff', 0, 0, VW, VH);
        for (let gx = Math.floor(cx / 24); gx * 24 <= cx + VW; gx++) for (let gy = Math.floor(cy / 24); gy * 24 <= cy + VH; gy++) {
          const h = hash(gx, gy); if (h % 3 === 0) P(g, '#e4ebf5', gx * 24 + (h >>> 3) % 24 - cx, gy * 24 + (h >>> 8) % 24 - cy, 2, 1);
        }
        // finish line checkers
        if (FINISH_Y > cy - 4 && FINISH_Y < cy + VH + 4)
          for (const l of LANES) if (l.id !== 'endless') for (let i = 0; i < 28; i++) P(g, '#101014', l.x - 28 + i * 2 - cx, FINISH_Y + (i % 2) * 2 - cy, 2, 2);
        // ski tracks
        g.fillStyle = '#dfe6f1';
        for (const p of S.tracks) {
          const X = Math.round(p.x - cx), Y = Math.round(p.y - cy); if (Y < -4 || Y > VH + 4) continue;
          const ox = Math.round(Math.cos(p.a) * 2), oy = Math.round(-Math.sin(p.a) * 1.5);
          g.fillRect(X + ox, Y + oy, 1, 1); g.fillRect(X - ox, Y - oy, 1, 1);
        }
        const items = [];
        for (const o of statics(cx - 24, cy - 8, cx + VW + 24, cy + VH + 40, [])) items.push({ y: o.y, f: () => drawObj(o, Math.round(o.x - cx), Math.round(o.y - cy)) });
        for (const n of S.npcs) items.push({ y: n.y, f: () => drawSkier(g, Math.round(n.x - cx), Math.round(n.y - cy), n.dir, n.pal, { crash: n.crashT > 0, t: S.t }) });
        for (const d of S.dogs) items.push({ y: d.y, f: () => drawDog(g, Math.round(d.x - cx), Math.round(d.y - cy), Math.sign(d.vx), d.t) });
        const m = S.monster;
        if (S.state !== 'eaten' && S.state !== 'over')
          items.push({ y: k.y + (k.crashT > 0 ? 40 : 0), f: () => drawSkier(g, Math.round(k.x - cx), Math.round(k.y - cy), k.dir, PAL,
            { z: k.z + (k.bump ? Math.floor(k.bump * 14) % 2 : 0), trick: k.trick, trickP: k.trick ? k.trickT / TRICKS[k.trick].dur : 0, crash: k.crashT > 0, t: S.t }) });
        if (m) {
          const mode = S.state === 'eaten' ? (S.eatT < 2.2 ? 'eat' : 'full') : S.state === 'over' ? 'full' : 'run';
          items.push({ y: m.y + 2, f: () => {
            const X = Math.round(m.x - cx), Y = Math.round(m.y - cy);
            drawMonster(g, X, Y, mode, S.t);
            if (S.state === 'eaten' && S.eatT < .5) drawSkier(g, X, Y - 33, 0, PAL, { trick: 1 });
            else if (mode === 'eat' && S.eatT < 1.4) { line(g, PAL.ski, X - 7, Y - 25, X + 7, Y - 22); line(g, PAL.ski, X - 6, Y - 23, X + 6, Y - 26); }
          } });
        }
        items.sort((a, b) => a.y - b.y).forEach(it => it.f());
        drawLift(cx, cy);
        drawHud();
        if (S.toast) {
          const w = S.toast.msg.length * 4 + 9, x = (VW - w) / 2 | 0, y = VH - 20;
          box(x, y, w, 13); text(g, S.toast.msg, VW / 2, y + 4, '#101014', 1, 'center');
        }
        if (S.state === 'play' && !S.started)
          winBox('SKI SLOPE', [Arcade.coarse ? 'DRAG ON THE SNOW TO STEER' : 'STEER WITH ARROWS OR THE MOUSE', 'F FAST    1-4 TRICKS IN THE AIR', 'SKI THROUGH A GATE TO PICK A RUN'],
            Arcade.coarse ? 'TAP TO START' : 'PRESS AN ARROW OR CLICK TO START', 168);
        if (S.state === 'paused') winBox('PAUSED', ['THE SLOPE WILL WAIT.', ['TIME', fmt(S.time)], ['DIST', dist() + 'M']], Arcade.coarse ? 'TAP TO RESUME' : 'F3, ENTER OR CLICK TO RESUME');
        if (S.state === 'over') {
          const o = S.over, b = store.get('best', {});
          winBox('EATEN!', ['THE SNOW MONSTER GOT YOU.', ['DISTANCE', o.dist + 'M'], ['STYLE', String(o.style)], o.isBest ? ['NEW LONGEST RUN!', '', '#b5203a'] : ['LONGEST RUN', b.dist + 'M']],
            Arcade.coarse ? 'TAP TO SKI AGAIN' : 'F2, ENTER OR CLICK TO SKI AGAIN', 150);
        }
      }
      function modeLine() {
        if (!S.mode) return 'PICK A RUN';
        const L = LANES.find(l => l.id === S.mode);
        if (S.mode === 'endless') return 'ENDLESS';
        if (S.finished) return L.short + ' DONE';
        if (S.mode === 'free') return 'FREESTYLE +' + (S.style - S.style0);
        return L.short + ' ' + S.gatesDone + '/' + NFLAGS + (S.penalty ? ' +' + S.penalty + 'S' : '');
      }
      function drawHud() {
        const k = S.sk, x = VW - 86, y = 3, spd = Math.round((k.air ? Math.hypot(k.avx, k.avy) : k.v) / M);
        box(x, y, 83, 41);
        [['TIME', fmt(S.time)], ['DIST', dist() + 'M'], ['SPEED', spd + 'M/S'], ['STYLE', String(S.style)]].forEach(([a, b], i) => {
          text(g, a, x + 4, y + 4 + i * 7, '#000'); text(g, b, x + 79, y + 4 + i * 7, '#000', 1, 'right');
        });
        P(g, '#000', x + 3, y + 31, 77, 1);
        text(g, modeLine(), x + 4, y + 34, S.penalty && !S.finished && S.mode !== 'free' ? '#b5203a' : '#0a1a86');
        if (k.fast) { box(x + 51, y + 43, 32, 9); text(g, 'FAST', x + 67, y + 45, '#e01b24', 1, 'center'); }
        statusT -= 1 / 60;
        if (statusT <= 0) { statusT = .2; win.status('Time ' + fmt(S.time), 'Dist ' + dist() + ' m', 'Speed ' + spd + ' m/s', 'Style ' + S.style); }
      }

      /* ---------- loop ---------- */
      let last = performance.now(), acc = 0;
      function frame(now) {
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        if (win.isVisible()) {
          acc += dt;
          while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
          render();
        } else acc = 0;
        requestAnimationFrame(frame);
      }
      newGame();
      requestAnimationFrame(frame);

      // test hooks (used by tools/smoke.mjs runs)
      def.test = {
        state: () => ({ state: S.state, started: S.started, mode: S.mode, dist: dist(), x: Math.round(S.sk.x), y: Math.round(S.sk.y), dir: S.sk.dir, v: Math.round(S.sk.v), air: S.sk.air, crash: S.sk.crashT > 0, style: S.style, monster: !!S.monster, gates: S.gatesDone, penalty: S.penalty }),
        warp(m) { S.started = true; S.sk.y = START_Y + m * M; S.sk.x = 400; S.mode = S.mode || 'endless'; S.tracks = []; camX = S.sk.x - VW / 2; camY = S.sk.y - SKY; },
        put(type, dx, dy) { course.push({ type, x: Math.round(S.sk.x + dx), y: Math.round(S.sk.y + dy) }); course.sort((a, b) => a.y - b.y); },
        set(o) { Object.assign(S.sk, o); },
        advance(sec) { for (let i = 0; i < sec * 60; i++) step(1 / 60); render(); return def.test.state(); },
        S: () => S
      };
    }
  });
})();

/* Minesweeper: faithful Win95-style mine clearing. Canvas board + 7-segment LEDs, chording, marks, best times. */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="7" y="1" width="2" height="14" fill="#000"/><rect x="1" y="7" width="14" height="2" fill="#000"/><rect x="5" y="3" width="6" height="10" fill="#000"/><rect x="3" y="5" width="10" height="6" fill="#000"/><rect x="4" y="4" width="8" height="8" fill="#000"/><rect x="3" y="3" width="1" height="1" fill="#000"/><rect x="12" y="3" width="1" height="1" fill="#000"/><rect x="3" y="12" width="1" height="1" fill="#000"/><rect x="12" y="12" width="1" height="1" fill="#000"/><rect x="5" y="5" width="2" height="2" fill="#fff"/></svg>';
  const LEVELS = [
    { key: 'beginner', name: 'Beginner', r: 9, c: 9, m: 10 },
    { key: 'intermediate', name: 'Intermediate', r: 16, c: 16, m: 40 },
    { key: 'expert', name: 'Expert', r: 16, c: 30, m: 99 }
  ];
  const NUM_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080'];
  const store = { get: (k, d) => Arcade.store.get('minesweeper.' + k, d), set: (k, v) => Arcade.store.set('minesweeper.' + k, v) };
  const defaultBest = () => ({ beginner: { t: 999, name: 'Anonymous' }, intermediate: { t: 999, name: 'Anonymous' }, expert: { t: 999, name: 'Anonymous' } });
  const loadBest = () => Object.assign(defaultBest(), store.get('best', {}));
  const cfg = Object.assign({ level: 0, custom: { r: 20, c: 24, m: 80 }, marks: true, tick: false }, store.get('cfg', {}));
  const saveCfg = () => store.set('cfg', cfg);
  const api = {};

  /* ---------- pixel glyphs (8x10, drawn on the 16px cell grid) ---------- */
  const G = {
    1: ['...##...', '..###...', '.####...', '...##...', '...##...', '...##...', '...##...', '...##...', '.######.', '.######.'],
    2: ['#######.', '########', '......##', '......##', '.#######', '#######.', '##......', '##......', '########', '########'],
    3: ['#######.', '########', '......##', '......##', '..######', '..######', '......##', '......##', '########', '#######.'],
    4: ['##...##.', '##...##.', '##...##.', '##...##.', '########', '########', '.....##.', '.....##.', '.....##.', '.....##.'],
    5: ['########', '########', '##......', '##......', '#######.', '########', '......##', '......##', '########', '#######.'],
    6: ['.#######', '########', '##......', '##......', '#######.', '########', '##....##', '##....##', '########', '.######.'],
    7: ['########', '########', '......##', '......##', '.....##.', '....##..', '...##...', '...##...', '...##...', '...##...'],
    8: ['.######.', '########', '##....##', '##....##', '.######.', '.######.', '##....##', '##....##', '########', '.######.'],
    '?': ['.######.', '##....##', '......##', '.....##.', '....##..', '...##...', '...##...', '........', '...##...', '...##...']
  };
  function glyph(g, ch, color, ox = 4, oy = 3) {
    g.fillStyle = color;
    G[ch].forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] === '#') g.fillRect(ox + x, oy + y, 1, 1); });
  }
  function mine(g) {
    g.fillStyle = '#000';
    [[8, 2, 1, 13], [2, 8, 13, 1], [6, 4, 5, 9], [4, 6, 9, 5], [5, 5, 7, 7], [4, 4, 1, 1], [12, 4, 1, 1], [4, 12, 1, 1], [12, 12, 1, 1]].forEach(r => g.fillRect(...r));
    g.fillStyle = '#fff'; g.fillRect(6, 6, 2, 2);
  }
  function flag(g) {
    g.fillStyle = '#ff0000'; g.fillRect(6, 3, 3, 5); g.fillRect(4, 4, 2, 3); g.fillRect(3, 5, 1, 1);
    g.fillStyle = '#000'; g.fillRect(9, 3, 1, 8); g.fillRect(7, 10, 5, 1); g.fillRect(5, 11, 9, 2);
  }

  /* ---------- 7-segment LED (13x23 per digit) ---------- */
  const SEG = {
    a: [[2, 1], [11, 1], [9, 3], [4, 3]], b: [[12, 2], [12, 10.5], [11, 11.5], [10, 10], [10, 4]],
    c: [[12, 12.5], [12, 21], [10, 19], [10, 13], [11, 11.5]], d: [[4, 20], [9, 20], [11, 22], [2, 22]],
    e: [[1, 12.5], [2, 11.5], [3, 13], [3, 19], [1, 21]], f: [[1, 2], [3, 4], [3, 10], [2, 11.5], [1, 10.5]],
    g: [[2.2, 11.5], [3.7, 10.5], [9.3, 10.5], [10.8, 11.5], [9.3, 12.5], [3.7, 12.5]]
  };
  const DIGITS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  function ledText(n) {
    n = Math.max(-99, Math.min(999, n | 0));
    return n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0');
  }
  function drawLed(g, text, x0 = 0, y0 = 0) {
    g.fillStyle = '#000'; g.fillRect(x0, y0, 39, 23);
    [...text].forEach((ch, i) => {
      const on = DIGITS[ch] || '';
      for (const s in SEG) {
        g.fillStyle = on.includes(s) ? '#ff0000' : '#3a0000';
        g.beginPath(); SEG[s].forEach(([x, y], j) => (j ? g.lineTo : g.moveTo).call(g, x0 + i * 13 + x, y0 + y)); g.closePath(); g.fill();
      }
    });
  }

  /* ---------- smiley (26x26) ---------- */
  function drawFace(g, mood, pressed, col) {
    g.clearRect(0, 0, 26, 26);
    g.fillStyle = col.lo; g.fillRect(0, 0, 26, 26);
    g.fillStyle = col.face; g.fillRect(1, 1, 24, 24);
    if (!pressed) {
      g.fillStyle = col.hi; g.fillRect(1, 1, 23, 2); g.fillRect(1, 1, 2, 23);
      g.fillStyle = col.lo; g.fillRect(3, 23, 22, 2); g.fillRect(23, 3, 2, 22);
    } else { g.fillStyle = col.lo; g.fillRect(1, 1, 24, 1); g.fillRect(1, 1, 1, 24); }
    const o = pressed ? 1 : 0, cx = 13 + o, cy = 13 + o;
    g.fillStyle = '#ffff00'; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, 8.5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#000';
    if (mood === 'dead') {
      g.lineWidth = 1.1;
      [[-4, -3], [3, -3]].forEach(([dx, dy]) => {
        g.beginPath(); g.moveTo(cx + dx - 1.5, cy + dy - 1.5); g.lineTo(cx + dx + 1.5, cy + dy + 1.5);
        g.moveTo(cx + dx + 1.5, cy + dy - 1.5); g.lineTo(cx + dx - 1.5, cy + dy + 1.5); g.stroke();
      });
      g.beginPath(); g.arc(cx, cy + 7, 4.5, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    } else if (mood === 'cool') {
      g.beginPath(); g.moveTo(cx - 7.5, cy - 4); g.lineTo(cx + 7.5, cy - 4); g.lineWidth = 1; g.stroke();
      g.beginPath(); g.moveTo(cx - 6.5, cy - 4); g.lineTo(cx - 1, cy - 4); g.lineTo(cx - 2, cy - 1); g.lineTo(cx - 5.5, cy - 1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + 6.5, cy - 4); g.lineTo(cx + 1, cy - 4); g.lineTo(cx + 2, cy - 1); g.lineTo(cx + 5.5, cy - 1); g.closePath(); g.fill();
      g.beginPath(); g.arc(cx, cy + 0.5, 5, Math.PI * 0.2, Math.PI * 0.8); g.lineWidth = 1.1; g.stroke();
    } else if (mood === 'o') {
      g.fillRect(cx - 4.5, cy - 4.5, 2, 3); g.fillRect(cx + 2.5, cy - 4.5, 2, 3);
      g.beginPath(); g.arc(cx, cy + 3.5, 2.2, 0, Math.PI * 2); g.lineWidth = 1.2; g.stroke();
    } else {
      g.fillRect(cx - 4, cy - 4, 2, 2); g.fillRect(cx + 2, cy - 4, 2, 2);
      g.beginPath(); g.arc(cx, cy + 0.5, 5, Math.PI * 0.2, Math.PI * 0.8); g.lineWidth = 1.1; g.stroke();
    }
  }

  /* ---------- sound ---------- */
  function boom() {
    if (Arcade.isMuted()) return;
    const a = Arcade.audio(); if (!a) return;
    const n = a.sampleRate * .7, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = a.createBufferSource(), lp = a.createBiquadFilter(), gn = a.createGain();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, a.currentTime); lp.frequency.exponentialRampToValueAtTime(120, a.currentTime + .6);
    gn.gain.value = .5; src.connect(lp).connect(gn).connect(a.destination); src.start();
    Arcade.beep(90, .5, 'sawtooth', .06, -50);
  }
  const fanfare = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => Arcade.beep(f, i === 5 ? .3 : .12, 'square', .035, 0, i * .1));
  const tick = () => Arcade.beep(1900, .025, 'square', .025);

  /* ---------- High Scores ---------- */
  Arcade.scores.add({
    game: 'Minesweeper',
    render() {
      const b = loadBest();
      return '<tr><th>Level</th><th>Best time</th><th>Name</th></tr>' + LEVELS.map(l =>
        `<tr><td>${l.name}</td><td class="num">${b[l.key].t} s</td><td>${Arcade.esc(b[l.key].name)}</td></tr>`).join('');
    }
  });

  /* ---------- hover-card preview ---------- */
  function preview(g, w, h, t) {
    g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, w, h);
    const C = 11, cols = 17, rows = 7, ox = (w - cols * C) / 2, oy = 30;
    g.fillStyle = '#808080'; g.fillRect(ox - 2, 6, cols * C + 4, 20); g.fillStyle = '#fff'; g.fillRect(ox, 8, cols * C + 2, 18);
    g.fillStyle = '#c0c0c0'; g.fillRect(ox, 8, cols * C, 16);
    g.save(); g.translate(ox + 3, 9); g.scale(.6, .6); drawLed(g, ledText(10 - Math.floor((t % 8) * .8))); g.restore();
    g.save(); g.translate(ox + cols * C - 27, 9); g.scale(.6, .6); drawLed(g, ledText(Math.floor(t % 8) + 1)); g.restore();
    g.save(); g.translate(w / 2 - 8, 8); g.scale(16 / 26, 16 / 26); drawFace(g, (t % 8) > 7 ? 'cool' : (t * 2 % 1 < .15 ? 'o' : 'smile'), false, { face: '#c0c0c0', hi: '#fff', lo: '#808080' }); g.restore();
    const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5; return x - Math.floor(x); };
    const isMine = (x, y) => rnd(y * cols + x) < .11 && !(x > 5 && x < 11 && y > 1 && y < 6);
    const p = (t % 8) / 7;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = ox + x * C, py = oy + y * C, d = Math.hypot(x - 8, (y - 3.5) * 1.6) / 11, open = d < p && !isMine(x, y);
      if (open) {
        g.fillStyle = '#c0c0c0'; g.fillRect(px, py, C, C); g.fillStyle = '#808080'; g.fillRect(px, py, C, 1); g.fillRect(px, py, 1, C);
        let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isMine(x + i, y + j) && x + i >= 0 && x + i < cols && y + j >= 0 && y + j < rows) n++;
        if (n) { g.fillStyle = NUM_COLORS[n]; g.font = 'bold 9px Tahoma, Verdana, sans-serif'; g.textAlign = 'center'; g.fillText(n, px + C / 2 + .5, py + 9); }
      } else {
        g.fillStyle = '#c0c0c0'; g.fillRect(px, py, C, C); g.fillStyle = '#fff'; g.fillRect(px, py, C - 1, 1); g.fillRect(px, py, 1, C - 1);
        g.fillStyle = '#808080'; g.fillRect(px + 1, py + C - 1, C - 1, 1); g.fillRect(px + C - 1, py + 1, 1, C - 1);
        if (isMine(x, y) && d < p - .15) { g.fillStyle = '#f00'; g.fillRect(px + 4, py + 2, 3, 3); g.fillStyle = '#000'; g.fillRect(px + 6, py + 2, 1, 6); g.fillRect(px + 3, py + 8, 6, 1); }
      }
    }
  }

  Arcade.css(`
    .ms-root { display: flex; flex-direction: column; min-width: 0; }
    .ms-frame { background: var(--face); padding: 9px; box-shadow: inset 3px 3px var(--hi), inset -3px -3px var(--lo); min-width: 0; }
    .ms-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 7px; margin-bottom: 9px; box-shadow: inset 2px 2px var(--lo), inset -2px -2px var(--hi); }
    .ms-led { display: block; padding: 1px; box-shadow: inset 1px 1px var(--lo), inset -1px -1px var(--hi); flex: none; }
    .ms-led canvas, .ms-face canvas { display: block; }
    .ms-face { border: 0; padding: 0; background: none; flex: none; cursor: default; touch-action: manipulation; }
    .ms-face:focus-visible { outline: 1px dotted var(--ink); outline-offset: 1px; }
    .ms-sunk { padding: 3px; box-shadow: inset 3px 3px var(--lo), inset -3px -3px var(--hi); min-width: 0; }
    .ms-scroll { overflow-x: auto; overflow-y: hidden; max-width: 100%; -webkit-overflow-scrolling: touch; }
    .ms-board { display: block; margin: 0 auto; touch-action: manipulation; cursor: default; -webkit-touch-callout: none; }
    .ms-tools { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .ms-tools .btn { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; }
    .ms-tools .btn svg { width: 16px; height: 16px; }
    .ms-tools small { color: var(--ink); opacity: .75; line-height: 1.2; }
    .ms-form { display: grid; grid-template-columns: auto 64px; gap: 8px 10px; align-items: center; padding: 14px 16px 8px; }
    .ms-form input { width: 64px; }
    .ms-times { border-collapse: collapse; margin: 14px 16px 8px; font-variant-numeric: tabular-nums; }
    .ms-times td { padding: 3px 10px 3px 0; white-space: nowrap; }
    .ms-times td:nth-child(2) { text-align: right; }
  `);

  const FLAG_SVG = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="6" y="3" width="3" height="5" fill="#f00"/><rect x="4" y="4" width="2" height="3" fill="#f00"/><rect x="3" y="5" width="1" height="1" fill="#f00"/><rect x="9" y="3" width="1" height="8" fill="#000"/><rect x="7" y="10" width="5" height="1" fill="#000"/><rect x="5" y="11" width="9" height="2" fill="#000"/></svg>';

  /* A small Win95 modal built from the shell's message-box styles; resolves with the clicked button label. */
  function modal(title, html, buttons, onOpen) {
    return new Promise(resolve => {
      const veil = Arcade.el(`<div class="modal-veil"><div class="win msgbox bevel-out active">
        <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
        <div class="ms-mbody">${html}</div><div class="actions"></div></div></div>`);
      veil.querySelector('.ttl span').textContent = title;
      const done = v => { veil.remove(); resolve(v); };
      buttons.forEach((b, i) => {
        const bt = Arcade.el('<button class="btn"></button>'); bt.textContent = b; bt.onclick = () => done(b);
        veil.querySelector('.actions').appendChild(bt); if (i === 0) setTimeout(() => bt.focus(), 0);
      });
      veil.querySelector('[data-act="close"]').onclick = () => done(null);
      veil.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(buttons[0]); } else if (e.key === 'Escape') done(null); e.stopPropagation(); });
      veil.style.zIndex = 60000;
      document.getElementById('desktop').appendChild(veil);
      if (onOpen) onOpen(veil);
    });
  }

  const def = Arcade.app({
    id: 'minesweeper', title: 'Minesweeper', icon: ICON, width: 'auto', folder: 'Games', preview,
    hint: 'Clear the minefield. Numbers count the mines next to a square.',
    menus: [
      { label: 'Game', items: [
        { label: 'New', key: 'F2', action: () => api.newGame() },
        '-',
        ...LEVELS.map((l, i) => ({ label: l.name, radio: () => cfg.level === i, action: () => api.setLevel(i) })),
        { label: 'Custom…', radio: () => cfg.level === 3, action: () => api.custom() },
        '-',
        { label: 'Marks (?)', checked: () => cfg.marks, action: () => { cfg.marks = !cfg.marks; saveCfg(); } },
        { label: 'Sound', checked: () => cfg.tick, action: () => { cfg.tick = !cfg.tick; saveCfg(); } },
        '-',
        { label: 'Best Times…', action: () => api.bestTimes() },
        '-',
        { label: 'Exit', action: () => def.ctx.close() }
      ] },
      { label: 'Help', items: [
        { label: 'How to Play', key: 'F1', action: () => api.help() },
        '-',
        { label: 'About Minesweeper…', action: () => Arcade.dialog({ title: 'About Minesweeper', icon: 'info', text: 'Minesweeper for Arcade 95. An original re-creation of the classic mine-clearing puzzle. Find every safe square without touching a mine.' }) }
      ] }
    ],
    build(ctx) {
      const coarse = Arcade.coarse;
      const S = coarse ? 30 : 16;           // board cell size in CSS px
      const HS = coarse ? 1.3 : 1;          // header (LED + face) scale
      ctx.body.innerHTML = `<div class="ms-root"><div class="ms-frame">
          <div class="ms-head">
            <span class="ms-led"><canvas class="ms-mines" aria-label="Mines left"></canvas></span>
            <button class="ms-face" aria-label="New game"><canvas></canvas></button>
            <span class="ms-led"><canvas class="ms-time" aria-label="Seconds"></canvas></span>
          </div>
          <div class="ms-sunk"><div class="ms-scroll"><canvas class="ms-board" aria-label="Minefield"></canvas></div></div>
          ${coarse ? `<div class="ms-tools"><button class="btn ms-flagbtn" aria-pressed="false">${FLAG_SVG}<span>Flag mode</span></button><small>Tap to dig. Long-press to flag.</small></div>` : ''}
        </div></div>`;
      const $ = s => ctx.body.querySelector(s);
      const cvMines = $('.ms-mines'), cvTime = $('.ms-time'), faceBtn = $('.ms-face'), cvFace = faceBtn.firstElementChild, cv = $('.ms-board'), flagBtn = $('.ms-flagbtn');
      const dpr = () => Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      function sizeCanvas(c, w, h, scale) {
        const k = dpr() * scale; c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.style.width = w * scale + 'px'; c.style.height = h * scale + 'px';
        const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); return g;
      }
      const gMines = sizeCanvas(cvMines, 39, 23, HS), gTime = sizeCanvas(cvTime, 39, 23, HS), gFace = sizeCanvas(cvFace, 26, 26, HS);
      let gBoard;
      const colors = () => {
        const cs = getComputedStyle(document.documentElement), v = (n, d) => (cs.getPropertyValue(n).trim() || d);
        return { face: v('--face', '#c0c0c0'), hi: v('--hi', '#fff'), lo: v('--lo', '#808080') };
      };

      /* ----- state ----- */
      let R, Cn, M, mines, st, adj, status, flags, revealed, lostAt, face = 'smile', facePressed = false;
      let press = null;          // {i, chord} cells shown depressed
      let flagMode = false;
      let acc = 0, since = 0, running = false, timerId = 0, lastShown = 0;
      const idx = (x, y) => y * Cn + x;
      const nbrs = i => { const x = i % Cn, y = (i / Cn) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < Cn && ny < R) out.push(idx(nx, ny)); } return out; };
      const dims = () => cfg.level < 3 ? LEVELS[cfg.level] : cfg.custom;

      function newGame() {
        const d = dims(); R = d.r; Cn = d.c; M = d.m;
        mines = new Uint8Array(R * Cn); st = new Uint8Array(R * Cn); adj = new Uint8Array(R * Cn);
        status = 'ready'; flags = 0; revealed = 0; lostAt = -1; face = 'smile'; press = null;
        stopTimer(); acc = 0; lastShown = 0;
        gBoard = sizeCanvas(cv, Cn * 16, R * 16, S / 16);
        drawAll(); keepOnScreen();
      }
      function keepOnScreen() {
        const w = ctx.win, desk = w.parentElement; if (!desk || w.hidden || innerWidth <= 600) return;
        requestAnimationFrame(() => { const over = w.offsetLeft + w.offsetWidth - desk.clientWidth + 8; if (over > 0) w.style.left = Math.max(8, w.offsetLeft - over) + 'px'; });
      }
      function plant(safe) {
        const avoid = new Set([safe]);
        if (R * Cn - M >= 9) nbrs(safe).forEach(n => avoid.add(n));
        const pool = []; for (let i = 0; i < R * Cn; i++) if (!avoid.has(i)) pool.push(i);
        for (let k = 0; k < M && pool.length; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; mines[pool[k]] = 1; }
        for (let i = 0; i < R * Cn; i++) adj[i] = nbrs(i).reduce((s, n) => s + mines[n], 0);
      }

      /* ----- timer (pauses while the window is blurred or minimized) ----- */
      const elapsed = () => acc + (running ? performance.now() - since : 0);
      const shownTime = () => status === 'ready' ? 0 : Math.min(999, Math.floor(elapsed() / 1000) + 1);
      function startTimer() { if (running) return; running = true; since = performance.now(); timerId = setInterval(onTick, 200); }
      function stopTimer() { if (!running) return; acc = elapsed(); running = false; clearInterval(timerId); }
      function onTick() {
        if (!ctx.isVisible()) return;
        const s = shownTime();
        if (s !== lastShown) { lastShown = s; if (cfg.tick && s > 1 && s < 999) tick(); drawLeds(); }
      }

      /* ----- game rules ----- */
      function reveal(i) {
        if (st[i] === 1 || st[i] === 2) return;
        if (mines[i]) { lose(i); return; }
        const stack = [i];
        while (stack.length) {
          const k = stack.pop(); if (st[k] === 1 || st[k] === 2 || mines[k]) continue;
          st[k] = 1; revealed++;
          if (adj[k] === 0) nbrs(k).forEach(n => { if (st[n] !== 1 && st[n] !== 2) stack.push(n); });
        }
        if (revealed === R * Cn - M) win();
      }
      function open(i) {
        if (status === 'won' || status === 'lost') return;
        if (status === 'ready') { plant(i); status = 'playing'; startTimer(); lastShown = 1; if (cfg.tick) tick(); }
        if (st[i] === 1) { chord(i); return; }
        reveal(i);
      }
      function chord(i) {
        if (status !== 'playing' || st[i] !== 1 || !adj[i]) return;
        const ns = nbrs(i);
        if (ns.filter(n => st[n] === 2).length !== adj[i]) return;
        for (const n of ns) { if (status !== 'playing') break; if (st[n] !== 2 && st[n] !== 1) reveal(n); }
      }
      function toggleMark(i) {
        if (status === 'won' || status === 'lost' || st[i] === 1) return;
        if (st[i] === 0) { st[i] = 2; flags++; }
        else if (st[i] === 2) { flags--; st[i] = cfg.marks ? 3 : 0; }
        else st[i] = 0;
        if (navigator.vibrate && coarse) try { navigator.vibrate(12); } catch {}
      }
      function lose(i) {
        status = 'lost'; lostAt = i; face = 'dead'; stopTimer(); boom();
      }
      function win() {
        status = 'won'; face = 'cool'; stopTimer();
        for (let k = 0; k < R * Cn; k++) if (mines[k] && st[k] !== 2) st[k] = 2;
        flags = M; fanfare();
        const t = shownTime();
        if (cfg.level < 3) {
          const lv = LEVELS[cfg.level], best = loadBest();
          if (t < best[lv.key].t) setTimeout(async () => {
            setTimeout(() => { const inp = document.querySelector('.modal-veil .msgbox input'); if (inp) inp.select(); }, 30);
            const name = await Arcade.dialog({ title: 'Minesweeper', icon: 'trophy', text: `You have the fastest time for ${lv.name.toLowerCase()} level. Please type your name:`, input: best[lv.key].name });
            const b = loadBest(); b[lv.key] = { t, name: (name || 'Anonymous').slice(0, 24) }; store.set('best', b);
            bestTimes();
          }, 350);
        }
      }

      /* ----- drawing ----- */
      function drawLeds() { drawLed(gMines, ledText(M - flags)); drawLed(gTime, ledText(shownTime())); }
      function drawFaceNow() { drawFace(gFace, facePressed ? 'smile' : face, facePressed, colors()); }
      function isPressed(i) {
        if (!press || status === 'won' || status === 'lost') return false;
        if (press.i === i) return st[i] === 0 || st[i] === 3;
        return press.chord && (st[i] === 0 || st[i] === 3) && nbrs(press.i).includes(i);
      }
      function drawBoard() {
        const g = gBoard, col = colors(), over = status === 'lost';
        for (let y = 0; y < R; y++) for (let x = 0; x < Cn; x++) {
          const i = idx(x, y), s = st[i];
          g.save(); g.translate(x * 16, y * 16);
          const showMine = over && mines[i] && s !== 2, wrongFlag = over && s === 2 && !mines[i];
          if (s === 1 || showMine || wrongFlag || isPressed(i)) {
            g.fillStyle = i === lostAt ? '#ff0000' : col.face; g.fillRect(0, 0, 16, 16);
            g.fillStyle = col.lo; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
            if (showMine || wrongFlag) {
              mine(g);
              if (wrongFlag) { g.strokeStyle = '#ff0000'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(3, 3); g.lineTo(14, 14); g.moveTo(14, 3); g.lineTo(3, 14); g.stroke(); }
            } else if (s === 1 && adj[i]) glyph(g, adj[i], NUM_COLORS[adj[i]]);
            else if (s === 3) glyph(g, '?', '#000', 5, 3);
          } else {
            g.fillStyle = col.face; g.fillRect(0, 0, 16, 16);
            g.fillStyle = col.hi; g.fillRect(0, 0, 15, 2); g.fillRect(0, 0, 2, 15);
            g.fillStyle = col.lo; g.fillRect(1, 14, 15, 2); g.fillRect(14, 1, 2, 15);
            g.fillStyle = col.hi; g.fillRect(0, 15, 1, 1); g.fillRect(15, 0, 1, 1); g.fillRect(1, 14, 1, 1); g.fillRect(14, 1, 1, 1);
            if (s === 2) flag(g); else if (s === 3) glyph(g, '?', '#000', 4, 3);
          }
          g.restore();
        }
      }
      function drawAll() { drawBoard(); drawLeds(); drawFaceNow(); }

      /* ----- pointer input ----- */
      function cellAt(e) {
        const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / S), y = Math.floor((e.clientY - r.top) / S);
        return x >= 0 && y >= 0 && x < Cn && y < R ? idx(x, y) : -1;
      }
      const live = () => status === 'ready' || status === 'playing';
      let L = false, Rb = false, chordMode = false, swallow = false, lastTouch = 0;
      function setPress(i) {
        press = i < 0 ? (chordMode ? { i: -1, chord: true } : null) : { i, chord: chordMode };
        face = live() && (L || chordMode) ? 'o' : (status === 'won' ? 'cool' : status === 'lost' ? 'dead' : 'smile');
        drawBoard(); drawFaceNow();
      }
      cv.addEventListener('contextmenu', e => e.preventDefault());
      faceBtn.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('mousedown', e => {
        if (performance.now() - lastTouch < 800) return;
        e.preventDefault(); ctx.focus();
        if (!live()) return;
        const i = cellAt(e);
        if (e.button === 0) { L = true; if (Rb) chordMode = true; }
        else if (e.button === 2) { Rb = true; if (L) chordMode = true; else if (i >= 0) { toggleMark(i); drawLeds(); } }
        else if (e.button === 1) chordMode = true;
        swallow = false;
        if (L || chordMode) setPress(i); else drawBoard();
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      });
      function onMove(e) { if ((L || chordMode) && live()) { const i = cellAt(e); if (!press || press.i !== i) setPress(i); } }
      function onUp(e) {
        const i = cellAt(e);
        if (e.button === 0) L = false; else if (e.button === 2) Rb = false;
        if (live() && !swallow) {
          if (chordMode) { if (i >= 0) chord(i); swallow = true; }
          else if (e.button === 0 && i >= 0) open(i);
        }
        if (!L && !Rb) { chordMode = false; swallow = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        press = null; face = status === 'won' ? 'cool' : status === 'lost' ? 'dead' : (L && live() ? 'o' : 'smile'); drawAll();
      }

      /* touch: tap reveals (or flags in flag mode), long-press flags */
      let touch = null;
      cv.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        e.preventDefault(); lastTouch = performance.now(); ctx.focus();
        if (!live() || touch) return;
        const i = cellAt(e); if (i < 0) return;
        touch = { id: e.pointerId, i, x: e.clientX, y: e.clientY, done: false };
        touch.timer = setTimeout(() => {
          if (!touch) return; touch.done = true;
          if (st[touch.i] === 1) chord(touch.i); else toggleMark(touch.i);
          press = null; face = status === 'lost' ? 'dead' : status === 'won' ? 'cool' : 'smile'; drawAll();
        }, 400);
        if (!flagMode && st[i] !== 2) { L = true; setPress(i); L = false; }
      });
      const endTouch = () => { if (touch) clearTimeout(touch.timer); touch = null; press = null; if (live()) face = 'smile'; drawAll(); };
      cv.addEventListener('pointermove', e => {
        if (!touch || e.pointerId !== touch.id) return;
        if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) endTouch();
      });
      cv.addEventListener('pointerup', e => {
        if (!touch || e.pointerId !== touch.id) return;
        lastTouch = performance.now();
        const t = touch;
        if (!t.done && cellAt(e) === t.i) {
          if (st[t.i] === 1) open(t.i);            // chord a satisfied number
          else if (flagMode) toggleMark(t.i);
          else open(t.i);
        }
        endTouch();
      });
      cv.addEventListener('pointercancel', e => { if (touch && e.pointerId === touch.id) endTouch(); });
      if (flagBtn) flagBtn.addEventListener('click', () => { flagMode = !flagMode; flagBtn.classList.toggle('pressed', flagMode); flagBtn.setAttribute('aria-pressed', flagMode); });

      /* face button */
      faceBtn.addEventListener('pointerdown', e => { if (e.button !== 0) return; facePressed = true; drawFaceNow(); faceBtn.setPointerCapture(e.pointerId); });
      faceBtn.addEventListener('pointerup', e => {
        if (!facePressed) return; facePressed = false;
        const r = faceBtn.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) newGame(); else drawFaceNow();
      });
      faceBtn.addEventListener('pointercancel', () => { facePressed = false; drawFaceNow(); });
      faceBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); newGame(); } });

      ctx.onKey(e => {
        if (e.key === 'F2') { e.preventDefault(); newGame(); }
        else if (e.key === 'F1') { e.preventDefault(); help(); }
      });
      const pause = () => stopTimer();
      const resume = () => { if (status === 'playing' && ctx.isVisible()) startTimer(); };
      ctx.on('blur', pause); ctx.on('minimize', pause); ctx.on('focus', () => { resume(); drawAll(); }); ctx.on('restore', resume);
      ctx.on('close', () => { stopTimer(); newGame(); });
      ctx.on('open', keepOnScreen);

      /* ----- menus' dialogs ----- */
      function setLevel(i) { cfg.level = i; saveCfg(); newGame(); }
      async function custom() {
        const c = dims();
        const field = (lbl, k, v) => `<label for="ms-${k}">${lbl}</label><input class="field" id="ms-${k}" type="number" inputmode="numeric" value="${v}">`;
        let vals = null;
        const res = await modal('Custom Field', `<div class="ms-form">${field('Height:', 'h', c.r)}${field('Width:', 'w', c.c)}${field('Mines:', 'm', c.m)}</div>`, ['OK', 'Cancel'], veil => {
          const inputs = [...veil.querySelectorAll('input')];
          const read = () => { vals = inputs.map(x => parseInt(x.value, 10)); };
          inputs.forEach(x => x.addEventListener('input', read)); read();
          setTimeout(() => { inputs[0].focus(); inputs[0].select(); }, 10);
        });
        if (res !== 'OK' || !vals) return;
        const r = Math.max(9, Math.min(24, vals[0] || 9)), cc = Math.max(9, Math.min(30, vals[1] || 9));
        const m = Math.max(10, Math.min((r - 1) * (cc - 1), vals[2] || 10));
        cfg.custom = { r, c: cc, m }; cfg.level = 3; saveCfg(); newGame();
      }
      async function bestTimes() {
        const b = loadBest();
        const rows = LEVELS.map(l => `<tr><td>${l.name}:</td><td>${b[l.key].t} seconds</td><td>${Arcade.esc(b[l.key].name)}</td></tr>`).join('');
        const r = await modal('Fastest Mine Sweepers', `<table class="ms-times">${rows}</table>`, ['OK', 'Reset Scores']);
        if (r === 'Reset Scores') { store.set('best', defaultBest()); bestTimes(); }
      }
      function help() {
        Arcade.dialog({ title: 'Minesweeper Help', icon: 'info', text: coarse
          ? 'Tap a square to uncover it. Long-press (or use Flag mode) to place a flag where you think a mine is. A number tells how many mines touch that square. Tap a number whose mines are all flagged to clear its neighbours. Tap the smiley for a new game.'
          : 'Left-click a square to uncover it. Right-click to flag a suspected mine (again for ?, if Marks is on). A number tells how many mines touch that square. Click a number with both buttons (or the middle button, or just left-click when its flags are all placed) to clear its neighbours. F2 or the smiley starts a new game.' });
      }
      Object.assign(api, { newGame, setLevel, custom, bestTimes, help });
      def._test = { state: () => ({ R, Cn, M, status, flags, revealed, mines: [...mines], st: [...st], time: shownTime() }), S };
      newGame();
    }
  });
})();

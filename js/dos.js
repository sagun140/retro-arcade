/* MS-DOS Prompt: an 80x25 canvas console running a small DOS shell over an in-memory file system
   (persisted in Arcade.store 'dos.fs'), plus an MS-DOS Editor clone.
   Arcade.apps.dos.console(host, opts) builds a console anywhere; boot.js uses it for "MS-DOS mode". */
(() => {
  const COLS = 80, ROWS = 25;
  const PAL = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'];
  const FONT = 'Consolas, "Lucida Console", Menlo, "DejaVu Sans Mono", "Courier New", monospace';
  const BREAK = { brk: 1 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const padL = (s, n) => String(s).padStart(n);
  const commas = n => Math.round(n).toLocaleString('en-US');
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="1" width="16" height="14" fill="#c3c3c6"/><rect x="0" y="14" width="16" height="1" fill="#555"/><rect x="15" y="1" width="1" height="14" fill="#555"/><rect x="1" y="2" width="14" height="2" fill="#0a1a86"/><rect x="12" y="2" width="2" height="2" fill="#c3c3c6"/><rect x="1" y="4" width="14" height="10" fill="#000"/><rect x="2" y="6" width="1" height="4" fill="#ccc"/><rect x="3" y="5" width="2" height="1" fill="#ccc"/><rect x="3" y="10" width="2" height="1" fill="#ccc"/><rect x="6" y="7" width="1" height="1" fill="#ccc"/><rect x="6" y="9" width="1" height="1" fill="#ccc"/><rect x="8" y="5" width="1" height="2" fill="#ccc"/><rect x="9" y="7" width="1" height="2" fill="#ccc"/><rect x="10" y="9" width="1" height="2" fill="#ccc"/><rect x="11" y="10" width="3" height="1" fill="#fff"/></svg>';

  Arcade.css(`
  .dos-con { display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--face); }
  .dos-tb { display: flex; align-items: center; gap: 2px; padding: 1px 2px 3px; flex: none; flex-wrap: wrap; }
  .dos-tb select { height: 22px; padding: 1px 2px; font-size: 11px; width: 64px; }
  .dos-tb button { width: 24px; height: 22px; border: 0; padding: 0; background: var(--face); display: grid; place-items: center; }
  .dos-tb button:hover { box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
  .dos-tb button:active, .dos-tb button.dos-on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo);
    background: repeating-conic-gradient(var(--face) 0 25%, var(--hi) 0 50%) 0 0 / 2px 2px; }
  .dos-tb button svg { width: 16px; height: 16px; }
  .dos-tb .dos-sep { width: 2px; height: 20px; margin: 0 3px; box-shadow: inset 1px 0 var(--lo), inset -1px 0 var(--hi); }
  .dos-screen { position: relative; flex: 1; min-height: 0; background: #000; overflow: auto; display: flex; align-items: center; justify-content: center;
    box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk); padding: 2px; }
  .dos-screen canvas { display: block; width: 100%; height: auto; image-rendering: auto; cursor: text; touch-action: manipulation; }
  .dos-screen.dos-fixed canvas { flex: none; }
  .dos-screen.dos-fixed { align-items: flex-start; justify-content: flex-start; }
  .win.max .dos-screen:not(.dos-fixed) canvas, .dos-full .dos-screen canvas, .dos-screen:fullscreen canvas { width: 100%; height: 100%; object-fit: contain; }
  .dos-screen:fullscreen { padding: 0; box-shadow: none; }
  .dos-full { position: absolute; inset: 0; background: #000; }
  .dos-full .dos-screen { box-shadow: none; padding: 0; }
  .dos-full .dos-screen canvas { object-position: center top; }
  .dos-kb { position: absolute; left: 0; top: 0; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0; font-size: 16px; pointer-events: none; }
  .dos-keys { display: flex; gap: 3px; padding: 3px 2px 1px; flex: none; }
  .dos-keys button { flex: 1; min-width: 0; height: 34px; border: 0; padding: 0; background: var(--face); font-size: 12px;
    box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi2), inset -2px -2px var(--lo), inset 2px 2px var(--hi); touch-action: manipulation; }
  .dos-keys button:active { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); }
  .dos-full .dos-keys { background: #222; }
  `);

  /* ---------- virtual file system ---------- */
  const D95 = new Date(1995, 7, 24, 11, 11).getTime();
  const F = (d, extra) => Object.assign({ t: 'f', d, m: D95 }, extra);
  const B = sz => ({ t: 'f', d: '', m: D95, sz, bin: 1 });
  const DIRN = c => ({ t: 'd', c, m: D95 });
  const README = `ARCADE 95 - README.TXT
======================

Welcome to the MS-DOS Prompt. Everything on drive C: lives in your browser.
Nothing here can hurt your real computer, so poke at it.

Things to try
  DIR                 list the current directory
  CD \\ARCADE\\GAMES    go where the games are
  MINESWEEPER         run a game (or SNAKE.EXE, START SKI, ...)
  EDIT NOTES.TXT      write something in the MS-DOS Editor
  TREE                see the whole drive
  MEM                 ask how much memory you have
  HELP                list every command

Keys
  Up/Down recall earlier commands, Tab completes file names,
  F3 repeats the last command, Ctrl+C stops whatever is running.

Type EXIT to close this window, or WIN to go back to the desktop.
`;
  function defaultFS() {
    return DIRN({
      WINDOWS: DIRN({
        SYSTEM: DIRN({ 'VMM32.VXD': B(1150523), 'KRNL386.EXE': B(75490), 'USER.EXE': B(264016), 'GDI.EXE': B(141072), 'JOYSTICK.DRV': B(4096) }),
        COMMAND: DIRN({ 'EDIT.COM': B(69886), 'FORMAT.COM': B(49543), 'DELTREE.EXE': B(19083), 'MEM.EXE': B(32146) }),
        'WIN.COM': B(22679), 'EXPLORER.EXE': B(204288), 'CLOUDS.BMP': B(307514),
        'WIN.INI': F('[windows]\nload=\nrun=\nBeep=yes\n\n[Desktop]\nWallpaper=(None)\nTileWallpaper=0\n\n[arcade]\nInsertCoin=0\n'),
        'SYSTEM.INI': F('[boot]\nshell=Explorer.exe\nsystem.drv=system.drv\n\n[386Enh]\ndevice=*vmm\ndevice=joystick.drv\n')
      }),
      ARCADE: DIRN({ GAMES: DIRN({}), 'HISCORE.DAT': B(1995) }),
      'COMMAND.COM': B(93880),
      'AUTOEXEC.BAT': F('@ECHO OFF\nPROMPT $P$G\nPATH C:\\WINDOWS;C:\\WINDOWS\\COMMAND;C:\\ARCADE\\GAMES\nSET BLASTER=A220 I5 D1 T4\nECHO Arcade 95 is ready. Insert coin.\n'),
      'CONFIG.SYS': F('DEVICE=C:\\WINDOWS\\HIMEM.SYS\nDOS=HIGH,UMB\nFILES=40\nBUFFERS=30\nLASTDRIVE=Z\n'),
      'README.TXT': F(README)
    });
  }
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const games = () => Arcade.order.filter(id => Arcade.apps[id].folder === 'Games');
  const exeName = id => id.toUpperCase().replace(/[^A-Z0-9]/g, '') + '.EXE';
  let root = null;
  function loadFS() {
    root = Arcade.store.get('dos.fs', null);
    if (!root || root.t !== 'd' || !root.c) root = defaultFS();
    const a = root.c.ARCADE && root.c.ARCADE.t === 'd' ? root.c.ARCADE : null;
    const g = a && a.c.GAMES && a.c.GAMES.t === 'd' ? a.c.GAMES : null;
    if (g) {
      for (const k in g.c) if (g.c[k].g) delete g.c[k];
      games().forEach(id => { g.c[exeName(id)] = { t: 'f', d: '', m: D95, sz: 40960 + hash(id) % 400000, bin: 1, g: id }; });
    }
    return root;
  }
  const saveFS = () => Arcade.store.set('dos.fs', root);
  const sizeOf = n => n.sz != null ? n.sz : n.d.length + (n.d.match(/\n/g) || []).length;
  const BADCH = /[<>|"*?\/]/;

  /* ---------- terminal buffer ---------- */
  function makeTerm() {
    const t = {
      ch: new Array(COLS * ROWS).fill(' '), at: new Uint8Array(COLS * ROWS).fill(7),
      cx: 0, cy: 0, attr: 7, scrolls: 0, cursorOn: true, dirty: true,
      put(x, y, c, a = t.attr) { if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return; const i = y * COLS + x; t.ch[i] = c; t.at[i] = a; t.dirty = true; },
      text(x, y, s, a) { [...s].forEach((c, i) => t.put(x + i, y, c, a)); },
      fill(x, y, w, h, c, a) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) t.put(i, j, c, a); },
      clear() { t.ch.fill(' '); t.at.fill(t.attr); t.cx = t.cy = 0; t.dirty = true; },
      scroll() {
        t.ch.copyWithin(0, COLS); t.at.copyWithin(0, COLS);
        t.ch.fill(' ', COLS * (ROWS - 1)); t.at.fill(t.attr, COLS * (ROWS - 1));
        t.scrolls++; t.dirty = true;
      },
      nl() { t.cx = 0; t.cy++; if (t.cy >= ROWS) { t.scroll(); t.cy = ROWS - 1; } },
      write(s) {
        for (const c of String(s)) {
          if (c === '\n') { t.nl(); continue; }
          if (c === '\r') continue;
          if (c === '\t') { const n = 8 - (t.cx % 8); t.write(' '.repeat(n)); continue; }
          if (t.cx >= COLS) t.nl();
          t.put(t.cx, t.cy, c); t.cx++;
        }
        t.dirty = true;
      },
      snapshot: () => ({ ch: t.ch.slice(), at: t.at.slice(), cx: t.cx, cy: t.cy }),
      restore(s) { t.ch = s.ch; t.at = s.at; t.cx = s.cx; t.cy = s.cy; t.dirty = true; },
      recolor(a) { t.attr = a; t.at.fill(a); t.dirty = true; },
      textAll() { const out = []; for (let y = 0; y < ROWS; y++) out.push(t.ch.slice(y * COLS, y * COLS + COLS).join('').trimEnd()); return out; }
    };
    return t;
  }

  /* ---------- renderer (box-drawing and shade glyphs are drawn, not fonted, so they join) ---------- */
  const BOX = { '─': [0, 0, 1, 1], '│': [1, 1, 0, 0], '┌': [0, 1, 0, 1], '┐': [0, 1, 1, 0], '└': [1, 0, 0, 1], '┘': [1, 0, 1, 0],
    '├': [1, 1, 0, 1], '┤': [1, 1, 1, 0], '┬': [0, 1, 1, 1], '┴': [1, 0, 1, 1], '┼': [1, 1, 1, 1] };
  const SHADE = { '░': .28, '▒': .5, '▓': .75 };
  function drawScreen(cv, term, cw, chh, sel, blinkOn) {
    const g = cv.getContext('2d');
    g.textBaseline = 'alphabetic';
    const probe = 100; g.font = probe + 'px ' + FONT;
    const ratio = g.measureText('M').width / probe;
    const fpx = Math.floor(Math.min(chh * .86, cw / ratio));
    g.font = fpx + 'px ' + FONT;
    const gw = ratio * fpx, base = Math.round(chh * .5 + fpx * .36), lw = Math.max(1, Math.round(chh / 16));
    const inSel = (x, y) => sel && x >= sel.x0 && x <= sel.x1 && y >= sel.y0 && y <= sel.y1;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x; let a = term.at[i];
      const cur = blinkOn && term.cursorOn && x === term.cx && y === term.cy;
      let fg = PAL[a & 15], bg = PAL[(a >> 4) & 15];
      if (inSel(x, y) || cur) { const s = fg; fg = bg; bg = s; }
      const px = x * cw, py = y * chh, c = term.ch[i];
      g.fillStyle = bg; g.fillRect(px, py, cw, chh);
      if (c === ' ') continue;
      g.fillStyle = fg;
      const b = BOX[c];
      if (b) {
        const mx = px + Math.floor(cw / 2), my = py + Math.floor(chh / 2);
        if (b[0]) g.fillRect(mx, py, lw, my - py + lw);
        if (b[1]) g.fillRect(mx, my, lw, py + chh - my);
        if (b[2]) g.fillRect(px, my, mx - px + lw, lw);
        if (b[3]) g.fillRect(mx, my, px + cw - mx, lw);
      } else if (SHADE[c]) { g.globalAlpha = SHADE[c]; g.fillRect(px, py, cw, chh); g.globalAlpha = 1; }
      else if (c === '█') g.fillRect(px, py, cw, chh);
      else if (c === '▀') g.fillRect(px, py, cw, chh / 2);
      else if (c === '▄') g.fillRect(px, py + chh / 2, cw, chh / 2);
      else if (c === '■') g.fillRect(px + cw * .2, py + chh * .35, cw * .6, chh * .3);
      else g.fillText(c, px + (cw - gw) / 2, py + base);
    }
  }

  /* ---------- the console: term + canvas + input + shell ---------- */
  const SIZES = { 'Auto': [8, 16], '7x12': [7, 12], '8x16': [8, 16] };
  const TB_ICONS = {
    mark: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M2 2h2M6 2h2M10 2h2M14 2v2M14 6v2M14 10v2M12 14h2M8 14h2M4 14h2M2 12v2M2 8v2M2 4v2" stroke="#000" fill="none"/></svg>',
    copy: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="1" width="8" height="10" fill="#fff" stroke="#000"/><rect x="6" y="5" width="8" height="10" fill="#fff" stroke="#000"/><rect x="8" y="8" width="4" height="1" fill="#000"/><rect x="8" y="10" width="4" height="1" fill="#000"/></svg>',
    paste: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="3" width="10" height="12" fill="#b07a2a" stroke="#000"/><rect x="5" y="1" width="4" height="3" fill="#888" stroke="#000"/><rect x="7" y="7" width="8" height="8" fill="#fff" stroke="#000"/></svg>',
    full: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="2" width="14" height="11" fill="#000" stroke="#555"/><rect x="3" y="4" width="4" height="1" fill="#fff"/><rect x="3" y="4" width="1" height="3" fill="#fff"/><rect x="9" y="10" width="4" height="1" fill="#fff"/><rect x="12" y="8" width="1" height="3" fill="#fff"/></svg>',
    props: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="1" width="11" height="14" fill="#fff" stroke="#000"/><rect x="4" y="4" width="7" height="1" fill="#000"/><rect x="4" y="7" width="7" height="1" fill="#000"/><rect x="4" y="10" width="5" height="1" fill="#000"/></svg>',
    bg: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="1" width="10" height="8" fill="#fff" stroke="#000"/><rect x="1" y="1" width="10" height="2" fill="#0a1a86"/><rect x="5" y="6" width="10" height="8" fill="#fff" stroke="#000"/><rect x="5" y="6" width="10" height="2" fill="#0a1a86"/></svg>'
  };

  function makeConsole(host, opts = {}) {
    const term = makeTerm();
    const wrap = Arcade.el(`<div class="dos-con${opts.full ? ' dos-full' : ''}">
      ${opts.toolbar ? `<div class="dos-tb"><select class="field" aria-label="Font size"><option>Auto</option><option>7x12</option><option>8x16</option></select><span class="dos-sep"></span>
        <button data-b="mark" title="Mark">${TB_ICONS.mark}</button><button data-b="copy" title="Copy">${TB_ICONS.copy}</button><button data-b="paste" title="Paste">${TB_ICONS.paste}</button><span class="dos-sep"></span>
        <button data-b="full" title="Full screen">${TB_ICONS.full}</button><button data-b="props" title="Properties">${TB_ICONS.props}</button><button data-b="bg" title="Background" class="dos-on">${TB_ICONS.bg}</button></div>` : ''}
      <div class="dos-screen"><canvas></canvas><input class="dos-kb" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Console input"></div>
      ${Arcade.coarse || opts.keys ? `<div class="dos-keys"><button data-k="Escape">Esc</button><button data-k="Tab">Tab</button><button data-k="ArrowLeft">←</button><button data-k="ArrowUp">↑</button><button data-k="ArrowDown">↓</button><button data-k="ArrowRight">→</button><button data-k="F10">F10</button><button data-k="c" data-ctrl="1">^C</button></div>` : ''}
    </div>`);
    host.appendChild(wrap);
    const scr = wrap.querySelector('.dos-screen'), cv = wrap.querySelector('canvas'), kb = wrap.querySelector('.dos-kb');
    let font = Arcade.store.get('dos.font', 'Auto'); if (!SIZES[font]) font = 'Auto';
    let cw = 16, chh = 32, blinkOn = true, sel = null, marking = false, clip = '', dead = false;
    const K = 2;
    function setFont(f) {
      font = f; Arcade.store.set('dos.font', f);
      const [w, h] = SIZES[f]; cw = w * K; chh = h * K;
      cv.width = COLS * cw; cv.height = ROWS * chh;
      scr.classList.toggle('dos-fixed', f !== 'Auto');
      cv.style.width = f === 'Auto' ? '' : COLS * w + 'px'; cv.style.height = f === 'Auto' ? '' : ROWS * h + 'px';
      term.dirty = true;
      const s = wrap.querySelector('select'); if (s) s.value = f;
    }
    setFont(font);
    let raf = 0;
    const frame = () => { raf = 0; if (dead) return; if (term.dirty) { term.dirty = false; drawScreen(cv, term, cw, chh, sel, blinkOn); } };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const blink = setInterval(() => { if (!wrap.isConnected || !wrap.offsetParent) return; blinkOn = !blinkOn; term.dirty = true; kick(); }, 530);
    const origWrite = term.write; term.write = s => { origWrite(s); kick(); };
    const origPut = term.put; term.put = (...a) => { origPut(...a); kick(); };

    /* ----- input plumbing ----- */
    const norm = e => ({ key: e.key, code: e.code || '', ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey });
    function handleKey(e) {
      if (dead || e.metaKey) return false;
      if (/^F(1[1-2]|[1245789])$/.test(e.key)) return false;
      if (e.key === 'Enter' && e.altKey) { fullscreen(); return true; }
      if (['Shift', 'Control', 'Meta', 'CapsLock'].includes(e.key)) return false;
      if (marking) { markKey(e); return true; }
      blinkOn = true; feed(norm(e)); return true;
    }
    kb.value = ' ';
    kb.addEventListener('keydown', e => {
      if (opts.isActive && !opts.isActive()) return;
      if (e.key === 'Unidentified' || e.keyCode === 229) return;
      if (handleKey(e)) { e.preventDefault(); e.stopPropagation(); }
    });
    kb.addEventListener('input', () => {
      const v = kb.value;
      if (v.length < 1) feed({ key: 'Backspace' });
      else for (const c of v.slice(1)) feed(c === '\n' ? { key: 'Enter' } : { key: c });
      kb.value = ' ';
    });
    const focus = () => { try { kb.focus({ preventScroll: true }); } catch {} };
    wrap.querySelectorAll('.dos-keys button').forEach(b => {
      b.addEventListener('pointerdown', e => e.preventDefault());
      b.addEventListener('click', () => { feed({ key: b.dataset.k, ctrl: !!b.dataset.ctrl }); focus(); });
    });

    /* ----- mark / copy / paste ----- */
    const cellAt = e => { const r = cv.getBoundingClientRect();
      // object-fit: contain letterboxes the bitmap; map through the drawn area
      const s = Math.min(r.width / cv.width, r.height / cv.height), ox = (r.width - cv.width * s) / 2, oy = opts.full ? 0 : (r.height - cv.height * s) / 2;
      return { x: Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - r.left - ox) / s / cw))), y: Math.max(0, Math.min(ROWS - 1, Math.floor((e.clientY - r.top - oy) / s / chh))) }; };
    function setMark(on) {
      marking = on; sel = null; term.dirty = true; kick();
      const b = wrap.querySelector('[data-b="mark"]'); if (b) b.classList.toggle('dos-on', on);
      if (opts.title) opts.title(on ? 'Mark - MS-DOS Prompt' : 'MS-DOS Prompt');
    }
    function selText() {
      if (!sel) return term.textAll().join('\n').trimEnd();
      const out = [];
      for (let y = sel.y0; y <= sel.y1; y++) out.push(term.ch.slice(y * COLS + sel.x0, y * COLS + sel.x1 + 1).join('').trimEnd());
      return out.join('\n');
    }
    function copy() { clip = selText(); try { navigator.clipboard.writeText(clip).catch(() => {}); } catch {} setMark(false); }
    async function paste() {
      let s = clip; try { s = (await navigator.clipboard.readText()) || clip; } catch {}
      for (const c of s.replace(/\r/g, '')) feed(c === '\n' ? { key: 'Enter' } : { key: c });
    }
    function markKey(e) { if (e.key === 'Escape') setMark(false); else if (e.key === 'Enter' || (e.ctrlKey && e.key === 'c')) copy(); }
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      if (marking) { drag = cellAt(e); sel = { x0: drag.x, x1: drag.x, y0: drag.y, y1: drag.y }; term.dirty = true; kick(); cv.setPointerCapture(e.pointerId); return; }
      if (editor) editor.click(cellAt(e));
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const c = cellAt(e);
      sel = { x0: Math.min(drag.x, c.x), x1: Math.max(drag.x, c.x), y0: Math.min(drag.y, c.y), y1: Math.max(drag.y, c.y) }; term.dirty = true; kick();
    });
    cv.addEventListener('pointerup', () => { drag = null; focus(); });

    function fullscreen() {
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
      if (scr.requestFullscreen && !Arcade.coarse) scr.requestFullscreen().then(focus).catch(() => opts.toggleMax && opts.toggleMax());
      else if (opts.toggleMax) opts.toggleMax();
    }
    if (opts.toolbar) {
      wrap.querySelector('select').addEventListener('change', e => { setFont(e.target.value); kick(); focus(); });
      const act = {
        mark: () => setMark(!marking), copy, paste: () => paste(), full: fullscreen,
        props: () => Arcade.dialog({ title: 'MS-DOS Prompt Properties', icon: 'info', text: `Program: C:\\COMMAND.COM. Font: ${font}. Screen: 80 x 25, Window. Memory: Auto. Close on exit: yes.` }),
        bg: () => wrap.querySelector('[data-b="bg"]').classList.toggle('dos-on')
      };
      wrap.querySelectorAll('.dos-tb button').forEach(b => b.addEventListener('click', () => { act[b.dataset.b](); if (b.dataset.b !== 'props') focus(); }));
    }

    /* ----- key dispatch: editor > pending read > line editor ----- */
    let editor = null, line = null, keyWaiter = null, busy = false, aborted = false;
    function feed(k) {
      if (editor) { editor.key(k); return; }
      if (keyWaiter) { const w = keyWaiter; keyWaiter = null; w(k); return; }
      if (line) { lineKey(k); return; }
      if (!busy) return;
      if (k.ctrl && (k.key === 'c' || k.key === 'C' || k.key === 'Pause')) { aborted = true; ahead.length = 0; }
      else if (ahead.length < 256) ahead.push(k); // typeahead, like the real keyboard buffer
    }
    const ahead = [];
    const readKey = () => new Promise(r => { if (ahead.length) r(ahead.shift()); else keyWaiter = r; });
    const check = () => { if (aborted) throw BREAK; };
    const out = s => term.write(s);

    /* ----- line editor ----- */
    const history = []; const MAXLEN = 127;
    function readLine(hist) {
      return new Promise(res => {
        line = { buf: '', pos: 0, x0: term.cx, y0: term.cy, hist, hi: history.length, res, tab: null };
        while (line && ahead.length) lineKey(ahead.shift());
      });
    }
    function redraw(oldLen) {
      const L = line; term.cx = L.x0; term.cy = L.y0; const s0 = term.scrolls;
      term.write(L.buf + ' '.repeat(Math.max(0, oldLen - L.buf.length)));
      L.y0 -= term.scrolls - s0;
      const off = L.x0 + L.pos; term.cx = off % COLS; term.cy = L.y0 + Math.floor(off / COLS);
      if (term.cy >= ROWS) { term.scroll(); L.y0--; term.cy = ROWS - 1; }
    }
    function setBuf(s) { const o = line.buf.length; line.buf = s.slice(0, MAXLEN); line.pos = line.buf.length; redraw(o); }
    function lineKey(k) {
      const L = line, o = L.buf.length, key = k.key;
      if (key !== 'Tab') L.tab = null;
      if (k.ctrl && (key === 'c' || key === 'C')) { L.pos = L.buf.length; redraw(o); out('^C\n'); line = null; L.res(null); return; }
      if (k.ctrl && (key === 'z' || key === 'Z') || key === 'F6') { if (L.buf.length < MAXLEN - 1) { L.buf = L.buf.slice(0, L.pos) + '^Z' + L.buf.slice(L.pos); L.pos += 2; redraw(o); } return; }
      if (key === 'Enter') { L.pos = L.buf.length; redraw(o); out('\n'); line = null;
        if (L.hist && L.buf.trim() && history[history.length - 1] !== L.buf) { history.push(L.buf); if (history.length > 50) history.shift(); }
        L.res(L.buf); return; }
      if (key === 'Backspace') { if (L.pos > 0) { L.buf = L.buf.slice(0, L.pos - 1) + L.buf.slice(L.pos); L.pos--; redraw(o); } return; }
      if (key === 'Delete') { L.buf = L.buf.slice(0, L.pos) + L.buf.slice(L.pos + 1); redraw(o); return; }
      if (key === 'ArrowLeft') { L.pos = Math.max(0, L.pos - 1); redraw(o); return; }
      if (key === 'ArrowRight') { L.pos = Math.min(L.buf.length, L.pos + 1); redraw(o); return; }
      if (key === 'Home') { L.pos = 0; redraw(o); return; }
      if (key === 'End') { L.pos = L.buf.length; redraw(o); return; }
      if (key === 'Escape') { setBuf(''); return; }
      if (L.hist && key === 'ArrowUp') { if (L.hi > 0) { L.hi--; setBuf(history[L.hi]); } return; }
      if (L.hist && key === 'ArrowDown') { if (L.hi < history.length - 1) { L.hi++; setBuf(history[L.hi]); } else { L.hi = history.length; setBuf(''); } return; }
      if (L.hist && key === 'F3') { if (history.length) setBuf(history[history.length - 1]); return; }
      if (key === 'Tab') { complete(); return; }
      if (key && key.length === 1 && !k.ctrl && !k.alt && L.buf.length < MAXLEN) { L.buf = L.buf.slice(0, L.pos) + key + L.buf.slice(L.pos); L.pos++; redraw(o); }
    }
    function complete() {
      const L = line;
      if (!L.tab) {
        const before = L.buf.slice(0, L.pos), start = before.lastIndexOf(' ') + 1, word = before.slice(start);
        const cut = word.lastIndexOf('\\') + 1, dirPart = word.slice(0, cut), pre = word.slice(cut).toUpperCase();
        const parts = dirPart ? resolve(dirPart) : cwd.slice(), dir = parts && getNode(parts);
        let names = dir && dir.t === 'd' ? Object.keys(dir.c).filter(n => n.startsWith(pre)).sort() : [];
        if (!start) names = names.concat(Object.keys(CMDS).filter(c => c.startsWith(pre) && !names.includes(c)));
        if (!names.length) return;
        L.tab = { start, dirPart, names, i: -1, tail: L.buf.slice(L.pos) };
      }
      const T = L.tab; T.i = (T.i + 1) % T.names.length;
      const o = L.buf.length, n = T.names[T.i];
      L.buf = (L.buf.slice(0, T.start) + T.dirPart + n + T.tail).slice(0, MAXLEN); L.pos = Math.min(L.buf.length, T.start + T.dirPart.length + n.length); redraw(o);
    }

    /* ----- paths ----- */
    let cwd = ['WINDOWS'];
    function resolve(p) {
      p = String(p).replace(/^"|"$/g, '');
      let parts = null;
      const m = /^([a-z]):/i.exec(p);
      if (m) { if (m[1].toUpperCase() !== 'C') return null; p = p.slice(2); }
      parts = p.startsWith('\\') ? [] : cwd.slice();
      for (const seg of p.split('\\')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') { parts.pop(); continue; }
        if (seg === '...') { parts.pop(); parts.pop(); continue; }
        if (BADCH.test(seg)) return null;
        parts.push(seg.toUpperCase());
      }
      return parts;
    }
    function getNode(parts) { let n = root; for (const s of parts) { if (!n || n.t !== 'd') return null; n = n.c[s]; } return n || null; }
    const pathStr = parts => 'C:\\' + parts.join('\\');
    const touch = () => saveFS();
    const wild = pat => pat === '*.*' || pat === '*' ? /^.*$/ : new RegExp('^' + pat.toUpperCase().replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    // Split "dir\pattern" into a directory node and a matcher.
    function globTarget(arg) {
      const parts = resolve(arg); if (!parts) return null;
      const n = getNode(parts);
      if (n && n.t === 'd') return { dirParts: parts, dir: n, re: /^.*$/, all: true };
      const name = parts.pop(), dir = getNode(parts);
      if (!dir || dir.t !== 'd') return null;
      return { dirParts: parts, dir, re: wild(name), all: name === '*.*' || name === '*', name };
    }
    function fmtDate(ms) {
      const d = new Date(ms), h = d.getHours() % 12 || 12;
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getFullYear() % 100).padStart(2, '0')} ${padL(h, 2)}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'a' : 'p'}`;
    }
    function shortNames(names) {
      const used = {}, out = {};
      names.forEach(n => {
        const dot = n.lastIndexOf('.');
        const b0 = dot > 0 ? n.slice(0, dot) : n, e0 = dot > 0 ? n.slice(dot + 1) : '';
        const b = b0.replace(/[^A-Z0-9_$~!#%&@^-]/g, ''), e = e0.replace(/[^A-Z0-9_$~!#%&@^-]/g, '').slice(0, 3);
        if (b === b0 && e === e0 && b.length <= 8 && b.length) { out[n] = [b, e]; return; }
        const stem = (b || 'FILE').slice(0, 6); let k = 1;
        while (used[stem + '~' + k + '.' + e]) k++;
        used[stem + '~' + k + '.' + e] = 1; out[n] = [stem + '~' + k, e];
      });
      return out;
    }
    const usedBytes = (n = root) => n.t === 'f' ? sizeOf(n) : Object.values(n.c).reduce((s, c) => s + usedBytes(c), 0);
    const freeBytes = () => 1048510464 - usedBytes();
    const isGame = n => n && n.t === 'f' && n.g && Arcade.apps[n.g];

    /* ----- commands ----- */
    function promptText() {
      const d = new Date();
      return prompt.replace(/\$(.)/g, (_, c) => ({ p: pathStr(cwd), g: '>', l: '<', b: '|', q: '=', n: 'C', $: '$', _: '\n', v: 'Arcade 95 [Version 4.00.950]',
        d: d.toLocaleDateString('en-US'), t: d.toTimeString().slice(0, 8), e: '', h: '' }[c.toLowerCase()] ?? ''));
    }
    let prompt = Arcade.store.get('dos.prompt', '$P$G');
    const yesNo = async q => { out(q); for (;;) { const k = await readKey(); const c = (k.key || '').toLowerCase();
      if (k.ctrl && c === 'c') { out('^C\n'); throw BREAK; }
      if (c === 'y' || c === 'n') { out(c.toUpperCase() + '\n'); return c === 'y'; } } };
    function findApp(name) {
      const n = String(name).toLowerCase().replace(/\.(exe|com)$/, '').replace(/[^a-z0-9]/g, '');
      if (!n) return null;
      return Arcade.order.find(id => id !== 'dos' && (id.toLowerCase() === n || Arcade.apps[id].title.toLowerCase().replace(/[^a-z0-9]/g, '') === n
        || exeName(id).toLowerCase() === n + '.exe')) || null;
    }
    const launch = id => (opts.launch ? opts.launch(id) : Arcade.open(id));
    const HELP = [
      ['CD', 'Change directory'], ['CLS', 'Clear the screen'], ['COLOR', 'Set colors, e.g. COLOR 1F'], ['COPY', 'Copy a file'],
      ['DATE', 'Show the date'], ['DEFRAG', 'Defragment drive C:'], ['DEL', 'Delete files'], ['DELTREE', 'Delete a directory tree'],
      ['DIR', 'List files (/W wide)'], ['ECHO', 'Print a message'], ['EDIT', 'MS-DOS Editor'], ['EXIT', 'Close MS-DOS Prompt'],
      ['FORMAT', 'Format a disk'], ['HELP', 'This list'], ['MD', 'Make a directory'], ['MEM', 'Memory report'],
      ['PROMPT', 'Change the prompt'], ['RD', 'Remove a directory'], ['REN', 'Rename a file'], ['SCANDISK', 'Check drive C:'],
      ['START', 'Run a program'], ['TIME', 'Show the time'], ['TREE', 'Show folder tree (/F)'], ['TYPE', 'Show a text file'],
      ['VER', 'Show the version'], ['VOL', 'Show the volume label'], ['WIN', 'Back to the desktop'], ['(name)', 'Run a game: SNAKE, SKI ...']
    ];
    const CMDS = {
      async HELP(a) {
        if (a.trim()) { const h = HELP.find(x => x[0] === a.trim().toUpperCase()); out(h ? `${h[0]} - ${h[1]}\n` : `No help for ${a.trim().toUpperCase()}\n`); return; }
        out('Arcade 95 commands:\n\n');
        const half = Math.ceil(HELP.length / 2);
        for (let i = 0; i < half; i++) out(`  ${pad(HELP[i][0], 9)}${pad(HELP[i][1], 28)}  ${HELP[i + half] ? pad(HELP[i + half][0], 9) + HELP[i + half][1] : ''}\n`);
      },
      async VER() { out('\nArcade 95 [Version 4.00.950]\n'); },
      async VOL() { out(' Volume in drive C is ARCADE95\n Volume Serial Number is 1995-0824\n'); },
      async CLS() { term.clear(); return 'noblank'; },
      async ECHO(a, raw) {
        if (raw.startsWith('.')) { out((raw.slice(1)) + '\n'); return; }
        const s = a.trim(); if (!s) { out(`ECHO is ${echo ? 'on' : 'off'}\n`); return; }
        if (/^(on|off)$/i.test(s)) { echo = /on/i.test(s); return; }
        out(s + '\n');
      },
      async CD(a) {
        a = a.trim(); if (!a) { out(pathStr(cwd) + '\n'); return; }
        if (/^[a-z]:$/i.test(a)) { out(pathStr(cwd) + '\n'); return; }
        const p = resolve(a), n = p && getNode(p);
        if (!n || n.t !== 'd') { out('Invalid directory\n'); return; }
        cwd = p;
      },
      async MD(a) {
        a = a.trim(); if (!a) { out('Required parameter missing\n'); return; }
        const p = resolve(a); if (!p || !p.length) { out('Unable to create directory\n'); return; }
        const name = p.pop(), dir = getNode(p);
        if (!dir || dir.t !== 'd' || dir.c[name]) { out('Unable to create directory\n'); return; }
        dir.c[name] = { t: 'd', c: {}, m: Date.now() }; touch();
      },
      async RD(a) {
        a = a.trim(); if (!a) { out('Required parameter missing\n'); return; }
        const p = resolve(a), n = p && p.length && getNode(p);
        const isCwd = p && p.length <= cwd.length && p.every((s, i) => cwd[i] === s);
        if (!n || n.t !== 'd' || Object.keys(n.c).length || isCwd) { out(isCwd && n ? `Attempt to remove current directory - ${a}\n` : 'Invalid path, not directory,\nor directory not empty\n'); return; }
        const name = p.pop(); delete getNode(p).c[name]; touch();
      },
      async TYPE(a) {
        a = a.trim(); if (!a) { out('Required parameter missing\n'); return; }
        const p = resolve(a), n = p && getNode(p);
        if (!n) { out(`File not found - ${a.toUpperCase()}\n`); return; }
        if (n.t === 'd') { out('Access denied\n'); return; }
        if (n.bin) { out('MZ\u0090 \u0003   \u0004   ÿÿ  ¸       @   ' + '\u0007\u0019\u001b' + ' This program requires Arcade 95.\n$ PE  L\u0001\u0004 ¶\u0015ý/\n'); return; }
        for (const l of n.d.replace(/\n$/, '').split('\n')) { check(); out(l + '\n'); await sleep(0); }
      },
      async COPY(a) {
        const args = a.trim().split(/\s+/).filter(x => !x.startsWith('/'));
        if (!args[0]) { out('Required parameter missing\n'); return; }
        if (args[0].toUpperCase() === 'CON') return copyCon(args[1]);
        const sp = resolve(args[0]), src = sp && getNode(sp);
        if (!src || src.t !== 'f') { out(`File not found - ${args[0].toUpperCase()}\n        0 file(s) copied\n`); return; }
        let dp = resolve(args[1] || '.'); if (!dp) { out('Invalid path\n'); return; }
        let dn = getNode(dp); if (dn && dn.t === 'd') { dp = dp.concat(sp[sp.length - 1]); dn = getNode(dp); }
        if (dn && dn.t === 'd') { out('Access denied\n'); return; }
        const name = dp.pop(), dir = getNode(dp);
        if (!dir || dir.t !== 'd') { out('Invalid path\n        0 file(s) copied\n'); return; }
        if (dir.c[name] && dir.c[name] === src) { out('File cannot be copied onto itself\n        0 file(s) copied\n'); return; }
        if (dir.c[name] && !(await yesNo(`Overwrite ${name} (Yes/No)? `))) { out('        0 file(s) copied\n'); return; }
        dir.c[name] = Object.assign({}, src, { m: Date.now() }); touch();
        out('        1 file(s) copied\n');
      },
      async DEL(a) {
        a = a.trim(); if (!a) { out('Required parameter missing\n'); return; }
        const g = globTarget(a); if (!g) { out('Invalid directory\n'); return; }
        const hits = Object.keys(g.dir.c).filter(n => g.dir.c[n].t === 'f' && g.re.test(n));
        if (!hits.length) { out('File not found\n'); return; }
        if (g.all && !(await yesNo('All files in directory will be deleted!\nAre you sure (Y/N)?'))) return;
        hits.forEach(n => delete g.dir.c[n]); touch();
      },
      async REN(a) {
        const [x, y] = a.trim().split(/\s+/);
        if (!x || !y) { out('Required parameter missing\n'); return; }
        const p = resolve(x), n = p && getNode(p);
        if (!n || y.includes('\\') || BADCH.test(y)) { out('Duplicate file name or file not found\n'); return; }
        const old = p.pop(), dir = getNode(p), nn = y.toUpperCase();
        if (dir.c[nn]) { out('Duplicate file name or file not found\n'); return; }
        dir.c[nn] = n; delete dir.c[old]; touch();
      },
      async DIR(a) {
        const sw = (a.match(/\/\w/g) || []).map(s => s[1].toUpperCase()), arg = a.replace(/\/\w/g, '').trim() || '.';
        const g = globTarget(arg);
        out('\n Volume in drive C is ARCADE95\n Volume Serial Number is 1995-0824\n');
        if (!g) { out(' Directory of ' + pathStr(cwd) + '\n\nFile not found\n'); return; }
        out(` Directory of ${pathStr(g.dirParts)}\n\n`);
        const names = Object.keys(g.dir.c).filter(n => g.re.test(n));
        names.sort((x, y) => (g.dir.c[x].t === 'd' ? 0 : 1) - (g.dir.c[y].t === 'd' ? 0 : 1) || (x < y ? -1 : 1));
        const sn = shortNames(names), dots = g.dirParts.length && g.all ? ['.', '..'] : [];
        let files = 0, dirs = 0, bytes = 0, col = 0;
        const row = s => { check(); out(s); };
        for (const n of dots.concat(names)) {
          const node = dots.includes(n) ? g.dir : g.dir.c[n], isD = node.t === 'd';
          if (isD) dirs++; else { files++; bytes += sizeOf(node); }
          const [b, e] = dots.includes(n) ? [n, ''] : sn[n];
          if (sw.includes('W')) {
            const label = isD ? `[${n.length <= 12 ? n : b}]` : (e ? b + '.' + e : b);
            row(pad(label, 16)); if (++col === 5) { out('\n'); col = 0; }
          } else row(`${pad(b, 8)} ${pad(e, 3)}${isD ? '   <DIR>      ' : padL(commas(sizeOf(node)), 14)}  ${fmtDate(node.m)} ${n}\n`);
          await sleep(0);
        }
        if (col) out('\n');
        if (!files && !dirs) out('File not found\n');
        out(`${padL(files, 10)} file(s)${padL(commas(bytes), 15)} bytes\n${padL(dirs, 10)} dir(s) ${padL(commas(freeBytes()), 15)} bytes free\n`);
      },
      async TREE(a) {
        const showF = /\/f/i.test(a), arg = a.replace(/\/\w/g, '').trim();
        const p = arg ? resolve(arg) : cwd.slice(), n = p && getNode(p);
        out('Directory PATH listing for Volume ARCADE95\nVolume Serial Number is 1995-0824\n');
        if (!n || n.t !== 'd') { out('Invalid path - ' + arg.toUpperCase() + '\nNo subfolders exist\n'); return; }
        out((p.length ? pathStr(p) : 'C:.') + '\n');
        let count = 0;
        const walk = async (node, prefix) => {
          const ks = Object.keys(node.c).sort(), ds = ks.filter(k => node.c[k].t === 'd');
          if (showF) ks.filter(k => node.c[k].t === 'f').forEach(k => out(prefix + (ds.length ? '│   ' : '    ') + k + '\n'));
          if (showF && ks.some(k => node.c[k].t === 'f')) out(prefix + (ds.length ? '│' : '') + '\n');
          for (let i = 0; i < ds.length; i++) {
            check(); count++; const last = i === ds.length - 1;
            out(prefix + (last ? '└───' : '├───') + ds[i] + '\n'); await sleep(0);
            await walk(node.c[ds[i]], prefix + (last ? '    ' : '│   '));
          }
        };
        await walk(n, '');
        if (!count) out('No subfolders exist\n');
      },
      async DATE() {
        const d = new Date();
        out(`Current date is ${d.toLocaleDateString('en-US', { weekday: 'short' })} ${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}\nEnter new date (mm-dd-yy): `);
        const s = await readLine(false); if (s == null) throw BREAK;
        if (s.trim()) out('The system clock belongs to your real computer. Arcade 95 left it alone.\n');
      },
      async TIME() {
        const d = new Date(), h = d.getHours() % 12 || 12;
        out(`Current time is ${padL(h, 2)}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(Math.floor(d.getMilliseconds() / 10)).padStart(2, '0')}${d.getHours() < 12 ? 'a' : 'p'}\nEnter new time: `);
        const s = await readLine(false); if (s == null) throw BREAK;
        if (s.trim()) out('Time is set by your real computer. Arcade 95 left it alone.\n');
      },
      async MEM() {
        const dm = navigator.deviceMemory, totalK = dm ? dm * 1048576 : 16384, ext = totalK - 1024;
        const r = (a, b, c, d) => out(`${pad(a, 16)}${padL(b, 13)}${padL(c, 13)}${padL(d, 13)}\n`);
        out('\n'); r('Memory Type', 'Total', '=   Used', '+   Free'); r('----------------', '-------', '-------', '-------');
        r('Conventional', '640K', '43K', '597K'); r('Upper', '0K', '0K', '0K'); r('Reserved', '384K', '384K', '0K');
        r('Extended (XMS)', commas(ext) + 'K', commas(Math.round(ext * .19)) + 'K', commas(ext - Math.round(ext * .19)) + 'K');
        r('----------------', '-------', '-------', '-------');
        r('Total memory', commas(totalK) + 'K', commas(Math.round(ext * .19) + 427) + 'K', commas(totalK - Math.round(ext * .19) - 427) + 'K');
        out('\n'); r('Total under 1 MB', '640K', '43K', '597K');
        out(`\nLargest executable program size       597K (611,328 bytes)\nLargest free upper memory block         0K       (0 bytes)\nMS-DOS is resident in the high memory area.\n`);
        if (!dm) out('(Your browser keeps its real memory size a secret, so this is a guess.)\n');
      },
      async EDIT(a) {
        a = a.trim(); let p = null, text = '';
        if (a) {
          p = resolve(a); if (!p || !p.length) { out('Invalid path\n'); return; }
          const n = getNode(p);
          if (n && n.t === 'd') { out('Access denied\n'); return; }
          if (n) text = n.bin ? 'MZ This program requires Arcade 95.' : n.d;
        }
        const snap = term.snapshot(), attr = term.attr;
        await new Promise(done => { editor = makeEditor(term, p, text, { save, resolve, getNode, pathStr, done }); editor.draw(); });
        editor = null; term.attr = attr; term.restore(snap); term.cursorOn = true; kick();
      },
      async EXIT() { (opts.exit || (() => {}))(); return 'exit'; },
      async WIN() { (opts.win || (() => {}))(); },
      async START(a) {
        const n = a.trim(); if (!n) { out('Usage: START program\n'); return; }
        const id = findApp(n.split(/[\\]/).pop());
        if (!id) { out(`Cannot find the file '${n}' (or one of its components).\nMake sure the path and filename are correct.\n`); return; }
        launch(id);
      },
      async DELTREE(a) {
        const args = a.trim().split(/\s+/).filter(x => x && !x.startsWith('/')), quiet = /\/y/i.test(a);
        if (!args.length) { out('Required parameter missing\n'); return; }
        for (const arg of args) {
          const p = resolve(arg), n = p && getNode(p);
          if (!p || !p.length) { out('You cannot delete the root directory.\n'); continue; }
          if (!n) { out(`Path not found - ${arg.toUpperCase()}\n`); continue; }
          if (!quiet && !(await yesNo(`Delete ${n.t === 'd' ? 'directory' : 'file'} "${arg.toUpperCase()}"${n.t === 'd' ? ' and all its subdirectories' : ''}? [yn] `))) continue;
          out(`Deleting ${arg.toUpperCase()}...\n`); await sleep(250);
          const name = p.pop(); delete getNode(p).c[name];
          if (cwd.length > p.length && cwd[p.length] === name && p.every((s, i) => cwd[i] === s)) cwd = p;
          touch();
        }
      },
      async FORMAT(a) {
        const d = (a.trim().split(/\s+/)[0] || '').toUpperCase();
        if (!d) { out('Required parameter missing\n'); return; }
        if (d === 'A:' || d === 'B:') { out(`Insert new diskette for drive ${d}\nand press ENTER when ready...`); await readKey(); out(`\n\nNot ready reading drive ${d[0]}. There is no diskette. There was never a diskette.\n`); return; }
        if (d !== 'C:') { out('Invalid drive specification\n'); return; }
        if (!(await yesNo('\nWARNING, ALL DATA ON NON-REMOVABLE DISK\nDRIVE C: WILL BE LOST!\nProceed with Format (Y/N)?'))) return;
        out('\nChecking existing disk format.\nVerifying 2,047.9M\n\n');
        const y = term.cy - 1;
        for (let i = 0; i <= 100; i += 1) {
          check();
          const bar = '█'.repeat(Math.floor(i / 2.5)) + '░'.repeat(40 - Math.floor(i / 2.5));
          term.text(0, y, `${padL(i, 4)} percent completed.  ${bar}`, term.attr);
          if (!Arcade.isMuted() && i % 10 === 0) Arcade.beep(80 + Math.random() * 60, .05, 'square', .03);
          await sleep(i > 90 ? 120 : 35);
        }
        out('Format complete.\n\nVolume label (11 characters, ENTER for none)? ');
        const s = await readLine(false); if (s == null) throw BREAK;
        out('\n   2,147,155,968 bytes total disk space\n   2,147,155,968 bytes available on disk\n\n');
        await sleep(600);
        out('...just kidding. Nothing was formatted. Your files and high scores are\nexactly where you left them. Arcade 95 would never.\n');
      },
      async DEFRAG() { return diskTool('defrag', 'Drive C: is 0% fragmented. You do not need to defragment this drive now.'); },
      async SCANDISK() { return diskTool('scandisk', null); },
      async COLOR(a) {
        const s = a.trim();
        if (!s) { term.recolor(7); Arcade.store.set('dos.color', 7); return; }
        if (!/^[0-9a-f]{1,2}$/i.test(s)) { out('Sets the console colors. COLOR attr, e.g. COLOR 1F (blue background, white text)\n  0=Black 1=Blue 2=Green 3=Aqua 4=Red 5=Purple 6=Yellow 7=White\n  8=Gray 9=Light Blue A=Light Green B=Light Aqua C=Light Red\n  D=Light Purple E=Light Yellow F=Bright White\n'); return; }
        const at = parseInt(s, 16);
        if ((at >> 4) === (at & 15)) { out('Foreground and background must differ.\n'); return; }
        term.recolor(at); Arcade.store.set('dos.color', at);
      },
      async PROMPT(a) { prompt = a.trim() || '$P$G'; Arcade.store.set('dos.prompt', prompt); },
      async XYZZY() { out('Nothing happens.\n'); },
      async PLUGH() { out('A hollow voice says "Fool."\n'); },
      async COFFEE() { out('Error 418: I\'m a teapot.\nInsert mug in drive A: and press any key...'); await readKey(); out('\nNot ready reading drive A. Mug not found.\n'); }
    };
    Object.assign(CMDS, { CHDIR: CMDS.CD, MKDIR: CMDS.MD, RMDIR: CMDS.RD, ERASE: CMDS.DEL, RENAME: CMDS.REN, VERSION: CMDS.VER });
    let echo = true;

    async function diskTool(kind, msg) {
      if (Arcade.apps.defrag) { out(kind === 'defrag' ? 'Starting Disk Defragmenter...\n' : 'Starting ScanDisk (it lives in Disk Defragmenter)...\n'); launch('defrag'); return; }
      if (msg) { out(msg + '\n'); return; }
      out('ScanDisk is now checking drive C:\n\n');
      for (const s of ['Media descriptor', 'File allocation tables', 'Directory structure', 'File system', 'Free space', 'Surface scan']) { check(); out(`   ${s}\n`); await sleep(260); }
      out('\nScanDisk did not find any problems on drive C.\n');
    }
    async function copyCon(dest) {
      if (!dest) { out('Required parameter missing\n'); return; }
      const p = resolve(dest); if (!p || !p.length) { out('Invalid path\n'); return; }
      const lines = [];
      for (;;) {
        const s = await readLine(false); if (s == null) throw BREAK;
        const z = s.indexOf('^Z'); if (z > -1) { if (z) lines.push(s.slice(0, z)); break; }
        lines.push(s);
      }
      const name = p.pop(), dir = getNode(p);
      if (!dir || dir.t !== 'd') { out('Invalid path\n'); return; }
      dir.c[name] = { t: 'f', d: lines.join('\n') + (lines.length ? '\n' : ''), m: Date.now() }; touch();
      out('        1 file(s) copied\n');
    }
    function save(parts, text) {
      const p = parts.slice(), name = p.pop(), dir = getNode(p);
      if (!dir || dir.t !== 'd' || (dir.c[name] && dir.c[name].t === 'd')) return false;
      dir.c[name] = { t: 'f', d: text, m: Date.now() }; touch(); return true;
    }

    async function runBatch(n) {
      for (const raw of n.d.split('\n')) {
        check(); let l = raw.trim(); if (!l || /^rem\b/i.test(l) || l.startsWith('::')) continue;
        const at = l.startsWith('@'); if (at) l = l.slice(1);
        if (echo && !at) out(promptText() + l + '\n');
        const r = await exec(l); if (r === 'exit') return r;
      }
    }
    async function exec(s) {
      s = s.trim(); if (!s) return 'noblank';
      if (/^[a-z]:$/i.test(s)) {
        const d = s[0].toUpperCase();
        if (d === 'C') return;
        for (;;) {
          out(d === 'D' ? `\nCDR101: Not ready reading drive ${d}\nAbort, Retry, Fail?` : `\nNot ready reading drive ${d}\nAbort, Retry, Fail?`);
          const k = ((await readKey()).key || '').toLowerCase(); out(k.toUpperCase() + '\n');
          if (k === 'r') continue;
          if (k === 'f') out('Current drive is no longer valid>... just kidding, still on C:\n');
          return;
        }
      }
      let tok = s.split(/\s+/)[0], rest = s.slice(tok.length);
      const m = /^(CD|CHDIR|MD|RD|DIR|ECHO|TYPE)([.\\\/].*)$/i.exec(tok);
      if (m) { tok = m[1]; rest = m[2] + rest; }
      const U = tok.toUpperCase();
      if (CMDS[U]) return CMDS[U](rest, rest);
      // a program on the PATH?
      const hasPath = tok.includes('\\'), tp = hasPath ? resolve(tok) : null;
      const leaf = hasPath ? (tp && tp.length ? tp[tp.length - 1] : '') : U;
      const xm = /\.(EXE|COM|BAT)$/.exec(leaf), base = xm ? leaf.slice(0, -4) : leaf;
      const dirs = hasPath ? (tp && tp.length ? [tp.slice(0, -1)] : []) : [cwd, [], ['ARCADE', 'GAMES'], ['WINDOWS'], ['WINDOWS', 'COMMAND']];
      for (const dp of dirs) {
        const dir = getNode(dp); if (!dir || dir.t !== 'd') continue;
        for (const ext of xm ? [xm[0]] : ['.COM', '.EXE', '.BAT']) {
          const n = dir.c[base + ext]; if (!n || n.t !== 'f') continue;
          if (isGame(n)) { launch(n.g); return; }
          if (ext === '.BAT') return runBatch(n);
          if (base === 'EXPLORER') return CMDS.WIN('');
          if (CMDS[base]) return CMDS[base](rest, rest);
          out('This program cannot be run in MS-DOS mode.\n'); return;
        }
      }
      const bare = base;
      const id = findApp(bare);
      if (id) { launch(id); return; }
      out('Bad command or file name\n');
    }

    let running = false;
    async function loop() {
      if (running) return; running = true;
      while (!dead) {
        out(promptText());
        const s = await readLine(true);
        if (dead) break;
        if (s == null) continue;
        busy = true; aborted = false; let r;
        try { r = await exec(s); } catch (e) { if (e === BREAK) { if (term.cx) out('\n'); out('^C\n'); } else { console.error(e); out('General failure reading drive C\n'); } }
        busy = false;
        if (r === 'exit') { running = false; return; }
        if (r !== 'noblank') { if (term.cx) out('\n'); out('\n'); }
      }
      running = false;
    }
    function banner() {
      term.recolor(Arcade.store.get('dos.color', 7)); term.clear();
      out(opts.banner != null ? opts.banner : '\nArcade(R) 95\n   (C)Copyright Arcade 95 Team 1981-1995.\n\n');
    }
    function reset() {
      line = null; keyWaiter = null; editor = null; ahead.length = 0; cwd = opts.cwd ? opts.cwd.slice() : ['WINDOWS']; loadFS();
      banner(); loop();
    }
    reset();
    return {
      el: wrap, term, handleKey, focus, reset, fullscreen, setFont, exec: s => exec(s),
      get exited() { return !running; }, get editing() { return !!editor; },
      destroy() { dead = true; clearInterval(blink); cancelAnimationFrame(raf); wrap.remove(); }
    };
  }

  /* ---------- MS-DOS Editor clone ---------- */
  const VH = 21, VW = 78;
  const MENUS = [
    { t: 'File', x: 2, items: [['&New', ''], ['&Open...', ''], ['&Save', 'Ctrl+S'], ['Save &As...', ''], '-', ['E&xit', 'Alt+X']] },
    { t: 'Edit', x: 8, items: [['&Cut Line', 'Ctrl+K'], ['C&opy Line', ''], ['&Paste', 'Ctrl+U'], ['C&lear Line', '']] },
    { t: 'Search', x: 14, items: [['&Find...', 'Ctrl+F'], ['&Repeat Last Find', 'F3']] },
    { t: 'Help', x: 73, items: [['&About...', '']] }
  ];
  // '&' marks each item's hotkey letter, as in the real editor
  const label = it => it[0].replace('&', ''), hot = it => it[0].indexOf('&');
  const hotKey = it => it[0][hot(it) + 1].toLowerCase();
  function makeEditor(term, path, text, io) {
    let lines = text.replace(/\r/g, '').split('\n'); if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    let r = 0, c = 0, top = 0, left = 0, dirty = false, mode = 'text', mi = 0, ii = 0, drop = false, dlg = null, clipLine = null, lastFind = '';
    const name = () => path ? path[path.length - 1] : 'UNTITLED';
    function clamp() {
      r = Math.max(0, Math.min(lines.length - 1, r)); c = Math.max(0, Math.min(lines[r].length, c));
      if (r < top) top = r; if (r >= top + VH) top = r - VH + 1;
      if (c < left) left = c; if (c >= left + VW) left = c - VW + 1;
    }
    function draw() {
      term.attr = 0x17;
      term.fill(0, 0, COLS, 1, ' ', 0x70);
      MENUS.forEach((m, i) => {
        const on = mode === 'menu' && mi === i;
        term.text(m.x - 1, 0, ' ' + m.t + ' ', on ? 0x07 : 0x70);
        if (mode === 'menu') term.put(m.x, 0, m.t[0], on ? 0x0f : 0x7f);
      });
      term.put(0, 1, '┌', 0x17); term.fill(1, 1, 78, 1, '─', 0x17); term.put(79, 1, '┐', 0x17);
      const title = ' ' + name() + ' '; term.text(Math.floor((COLS - title.length) / 2), 1, title, 0x71);
      for (let y = 0; y < VH; y++) {
        term.put(0, 2 + y, '│', 0x17);
        const s = (lines[top + y] || '').slice(left, left + VW);
        term.text(1, 2 + y, pad(s, VW), 0x17);
        term.put(79, 2 + y, y === 0 ? '↑' : y === VH - 1 ? '↓' : '░', 0x70);
      }
      const th = 3 + Math.round((VH - 3) * (lines.length > 1 ? r / (lines.length - 1) : 0)); term.put(79, th - 1 + 0, '█', 0x00);
      term.put(0, 23, '│', 0x17); term.put(1, 23, '←', 0x70); term.fill(2, 23, 76, 1, '░', 0x70); term.put(78, 23, '→', 0x70); term.put(79, 23, '┘', 0x17);
      term.put(2 + Math.min(75, Math.floor(left / 4)), 23, '█', 0x00);
      term.fill(0, 24, COLS, 1, ' ', 0x30);
      term.text(1, 24, mode === 'menu' ? 'F1=Help  Enter=Execute  Esc=Cancel  Arrow=Next Item' : `MS-DOS Editor  <F1=Help> Press ALT or F10 to activate menus${dirty ? ' *' : ''}`, 0x30);
      term.put(62, 24, '│', 0x30); term.text(64, 24, `Line:${r + 1}`.padEnd(10) + `Col:${c + 1}`, 0x30);
      if (mode === 'menu' && drop) drawDrop();
      if (dlg) drawDlg();
      term.cursorOn = !dlg && mode === 'text' || (dlg && dlg.kind === 'ask');
      if (!dlg) { term.cx = 1 + c - left; term.cy = 2 + r - top; }
      term.dirty = true;
    }
    function shadow(x, y, w, h) { for (let j = y + 1; j <= y + h; j++) for (let i = x + 2; i <= x + w + 1; i++) if (i < COLS && j < ROWS && (i >= x + w || j === y + h)) { const k = j * COLS + i; term.at[k] = 0x08; } }
    function box(x, y, w, h, a) {
      term.fill(x, y, w, h, ' ', a);
      term.put(x, y, '┌', a); term.put(x + w - 1, y, '┐', a); term.put(x, y + h - 1, '└', a); term.put(x + w - 1, y + h - 1, '┘', a);
      term.fill(x + 1, y, w - 2, 1, '─', a); term.fill(x + 1, y + h - 1, w - 2, 1, '─', a);
      term.fill(x, y + 1, 1, h - 2, '│', a); term.fill(x + w - 1, y + 1, 1, h - 2, '│', a);
      shadow(x, y, w, h);
    }
    const dropGeom = () => { const m = MENUS[mi], w = 24, x = Math.min(m.x - 2, COLS - w - 2); return { m, x, y: 1, w, h: m.items.length + 2 }; };
    function drawDrop() {
      const { m, x, y, w, h } = dropGeom(); box(x, y, w, h, 0x70);
      m.items.forEach((it, i) => {
        if (it === '-') { term.put(x, y + 1 + i, '├', 0x70); term.fill(x + 1, y + 1 + i, w - 2, 1, '─', 0x70); term.put(x + w - 1, y + 1 + i, '┤', 0x70); return; }
        const on = i === ii, a = on ? 0x07 : 0x70;
        term.text(x + 1, y + 1 + i, ' ' + pad(label(it), w - 12) + padL(it[1], 8) + ' ', a);
        term.put(x + 2 + hot(it), y + 1 + i, label(it)[hot(it)], on ? 0x0f : 0x7f);
      });
    }
    function drawDlg() {
      const d = dlg, w = Math.max(40, ...d.lines.map(l => l.length + 6)), h = d.lines.length + (d.kind === 'ask' ? 6 : 5);
      const x = Math.floor((COLS - w) / 2), y = Math.floor((ROWS - h) / 2) - 1;
      box(x, y, w, h, 0x70);
      const t = ' ' + d.title + ' '; term.text(x + Math.floor((w - t.length) / 2), y, t, 0x70);
      d.lines.forEach((l, i) => term.text(x + 3, y + 2 + i, l, 0x70));
      let by = y + 2 + d.lines.length + 1;
      if (d.kind === 'ask') {
        const fw = w - 6, s = d.value.slice(Math.max(0, d.value.length - fw + 1));
        term.text(x + 3, by - 1, pad(s, fw), 0x07); term.cx = x + 3 + s.length; term.cy = by - 1; by++;
      }
      term.put(x, by - 1, '├', 0x70); term.fill(x + 1, by - 1, w - 2, 1, '─', 0x70); term.put(x + w - 1, by - 1, '┤', 0x70);
      const labels = d.buttons.map(b => `< ${b} >`), total = labels.join('  ').length;
      let bx = x + Math.floor((w - total) / 2); d.hit = [];
      labels.forEach((l, i) => { term.text(bx, by, l, i === d.sel ? 0x7f : 0x70); d.hit.push([bx, by, l.length, i]); bx += l.length + 2; });
    }
    function ask(title, label, value = '') { return new Promise(res => { dlg = { kind: 'ask', title, lines: [label], value, buttons: ['OK', 'Cancel'], sel: 0, res }; draw(); }); }
    function msg(title, text, buttons = ['OK']) { return new Promise(res => { dlg = { kind: 'msg', title, lines: text.split('\n'), buttons, sel: 0, res }; draw(); }); }
    function closeDlg(v) { const d = dlg; dlg = null; draw(); d.res(v); }

    async function doSave(as) {
      let p = path;
      if (as || !p) {
        const s = await ask('Save As', 'File Name:', p ? io.pathStr(p) : ''); if (!s) return false;
        p = io.resolve(s); if (!p || !p.length) { await msg('Error', 'Path not found'); return false; }
      }
      if (!io.save(p, lines.join('\n') + '\n')) { await msg('Error', 'Path not found'); return false; }
      path = p; dirty = false; draw(); return true;
    }
    async function guard() {
      if (!dirty) return true;
      const v = await msg('MS-DOS Editor', 'Loaded file is not saved. Save it now?', ['Yes', 'No', 'Cancel']);
      if (v === 0) return doSave(false); return v === 1;
    }
    function find(again) {
      const go = s => {
        if (!s) return; lastFind = s; const low = s.toLowerCase();
        for (let k = 0; k <= lines.length; k++) {
          const rr = (r + k) % lines.length, from = k === 0 ? c + 1 : 0, at = lines[rr].toLowerCase().indexOf(low, from);
          if (at > -1) { r = rr; c = at; clamp(); draw(); return; }
        }
        msg('MS-DOS Editor', 'Match not found');
      };
      if (again && lastFind) go(lastFind); else ask('Find', 'Find What:', lastFind).then(go);
    }
    async function command(m, i) {
      mode = 'text'; drop = false; draw();
      const k = label(MENUS[m].items[i]);
      if (k === 'New') { if (await guard()) { lines = ['']; path = null; r = c = top = left = 0; dirty = false; draw(); } }
      else if (k === 'Open...') {
        if (!(await guard())) return;
        const s = await ask('Open', 'File Name:'); if (!s) return;
        const p = io.resolve(s), n = p && io.getNode(p);
        if (!p || (n && n.t === 'd')) { await msg('Error', 'Path not found'); return; }
        lines = n ? (n.bin ? 'MZ This program requires Arcade 95.' : n.d).replace(/\r/g, '').split('\n') : [''];
        if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
        path = p; r = c = top = left = 0; dirty = false; draw();
      }
      else if (k === 'Save') doSave(false);
      else if (k === 'Save As...') doSave(true);
      else if (k === 'Exit') { if (await guard()) io.done(); }
      else if (k === 'Cut Line') { clipLine = lines[r]; if (lines.length > 1) lines.splice(r, 1); else lines[0] = ''; dirty = true; clamp(); draw(); }
      else if (k === 'Copy Line') clipLine = lines[r];
      else if (k === 'Paste') { if (clipLine != null) { lines.splice(r, 0, clipLine); dirty = true; clamp(); draw(); } }
      else if (k === 'Clear Line') { lines[r] = ''; c = 0; dirty = true; clamp(); draw(); }
      else if (k === 'Find...') find(false);
      else if (k === 'Repeat Last Find') find(true);
      else if (k === 'About...') msg('About', 'MS-DOS Editor (Arcade 95 edition)\nVersion 2.0.026\n\nFiles are saved to the virtual drive C:.');
    }
    const ALTS = { KeyF: 0, KeyE: 1, KeyS: 2, KeyH: 3 };
    function key(k) {
      const K = k.key;
      // Alt pressed alone highlights the menu bar; Alt+letter arriving next is a shortcut, not a menu pick
      if (mode === 'menu' && !drop && k.alt && /^Key/.test(k.code || '')) mode = 'text';
      if (dlg) {
        const d = dlg;
        if (K === 'Escape') return closeDlg(d.kind === 'ask' ? null : d.buttons.length - 1 === 0 ? 0 : d.buttons.length - 1);
        if (K === 'Enter') return closeDlg(d.kind === 'ask' ? (d.sel === 0 ? d.value : null) : d.sel);
        if (K === 'Tab' || K === 'ArrowRight' && d.kind !== 'ask') { d.sel = (d.sel + 1) % d.buttons.length; draw(); return; }
        if (K === 'ArrowLeft' && d.kind !== 'ask') { d.sel = (d.sel + d.buttons.length - 1) % d.buttons.length; draw(); return; }
        if (d.kind === 'ask') {
          if (K === 'Backspace') d.value = d.value.slice(0, -1);
          else if (K && K.length === 1 && !k.ctrl && d.value.length < 64) d.value += K;
          draw(); return;
        }
        const hk = d.buttons.findIndex(b => b[0].toLowerCase() === (K || '').toLowerCase()); if (hk > -1) closeDlg(hk);
        return;
      }
      if (mode === 'menu') {
        const items = MENUS[mi].items, step = dd => { do { ii = (ii + dd + items.length) % items.length; } while (items[ii] === '-'); };
        if (K === 'Escape' || K === 'Alt' || K === 'F10') { mode = 'text'; drop = false; }
        else if (K === 'ArrowLeft') { mi = (mi + MENUS.length - 1) % MENUS.length; ii = 0; }
        else if (K === 'ArrowRight') { mi = (mi + 1) % MENUS.length; ii = 0; }
        else if (K === 'ArrowDown') { if (!drop) { drop = true; ii = 0; } else step(1); }
        else if (K === 'ArrowUp') { if (drop) step(-1); }
        else if (K === 'Enter') { if (!drop) { drop = true; ii = 0; } else return command(mi, ii); }
        else if (K && K.length === 1) {
          const ch = k.alt && /^Key/.test(k.code || '') ? k.code.slice(3).toLowerCase() : K.toLowerCase();
          if (!drop) { const f = MENUS.findIndex(m => m.t[0].toLowerCase() === ch); if (f > -1) { mi = f; drop = true; ii = 0; } }
          else { const f = items.findIndex(it => it !== '-' && hotKey(it) === ch); if (f > -1) return command(mi, f); }
        }
        draw(); return;
      }
      if (K === 'Alt' || K === 'F10') { mode = 'menu'; mi = 0; ii = 0; drop = false; draw(); return; }
      if (k.alt && ALTS[k.code] != null) { mode = 'menu'; mi = ALTS[k.code]; ii = 0; drop = true; draw(); return; }
      if (k.alt && k.code === 'KeyX' || k.ctrl && (K === 'q' || K === 'Q')) { command(0, 5); return; }
      if (k.ctrl) {
        const lk = (K || '').toLowerCase();
        if (lk === 's') doSave(false); else if (lk === 'f') find(false); else if (lk === 'k') command(1, 0); else if (lk === 'u') command(1, 2);
        else if (K === 'Home') { r = 0; c = 0; } else if (K === 'End') { r = lines.length - 1; c = lines[r].length; }
        clamp(); draw(); return;
      }
      const L = lines[r];
      switch (K) {
        case 'ArrowUp': r--; break; case 'ArrowDown': r++; break;
        case 'ArrowLeft': if (c > 0) c--; else if (r > 0) { r--; c = lines[r].length; } break;
        case 'ArrowRight': if (c < L.length) c++; else if (r < lines.length - 1) { r++; c = 0; } break;
        case 'Home': c = 0; break; case 'End': c = L.length; break;
        case 'PageUp': r -= VH - 1; top = Math.max(0, top - VH + 1); break; case 'PageDown': r += VH - 1; top += VH - 1; break;
        case 'F3': find(true); return; case 'Escape': return;
        case 'Enter': lines.splice(r + 1, 0, L.slice(c)); lines[r] = L.slice(0, c); r++; c = 0; dirty = true; break;
        case 'Backspace': if (c > 0) { lines[r] = L.slice(0, c - 1) + L.slice(c); c--; } else if (r > 0) { c = lines[r - 1].length; lines[r - 1] += L; lines.splice(r, 1); r--; } dirty = true; break;
        case 'Delete': if (c < L.length) lines[r] = L.slice(0, c) + L.slice(c + 1); else if (r < lines.length - 1) { lines[r] += lines[r + 1]; lines.splice(r + 1, 1); } dirty = true; break;
        case 'Tab': { const n = 8 - (c % 8); lines[r] = L.slice(0, c) + ' '.repeat(n) + L.slice(c); c += n; dirty = true; break; }
        default:
          if (K && K.length === 1 && !k.alt) { lines[r] = L.slice(0, c) + K + L.slice(c); c++; dirty = true; } else return;
      }
      top = Math.max(0, Math.min(top, Math.max(0, lines.length - VH)));
      clamp(); draw();
    }
    function click({ x, y }) {
      if (dlg) { const h = dlg.hit && dlg.hit.find(([bx, by, w]) => y === by && x >= bx && x < bx + w); if (h) closeDlg(dlg.kind === 'ask' ? (h[3] === 0 ? dlg.value : null) : h[3]); return; }
      if (y === 0) { const f = MENUS.findIndex(m => x >= m.x - 1 && x < m.x + m.t.length + 1); if (f > -1) { if (mode === 'menu' && drop && mi === f) { mode = 'text'; drop = false; } else { mode = 'menu'; mi = f; ii = 0; drop = true; } } else { mode = 'text'; drop = false; } draw(); return; }
      if (mode === 'menu' && drop) {
        const g = dropGeom(), i = y - g.y - 1;
        if (x >= g.x && x < g.x + g.w && i >= 0 && i < g.m.items.length && g.m.items[i] !== '-') { command(mi, i); return; }
        mode = 'text'; drop = false; draw(); return;
      }
      if (y >= 2 && y < 2 + VH && x >= 1 && x <= VW) { r = top + y - 2; c = left + x - 1; clamp(); draw(); }
      else if (x === 79 && y === 2) key({ key: 'PageUp' }); else if (x === 79 && y === 2 + VH - 1) key({ key: 'PageDown' });
    }
    return { draw, key, click };
  }

  /* ---------- the window ---------- */
  function preview(g, w, h, t) {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.font = '10px ' + FONT; g.fillStyle = '#aaa'; g.textBaseline = 'top';
    const L = ['Arcade(R) 95', '   (C)Copyright Arcade 95 Team 1981-1995.', '', 'C:\\WINDOWS>cd \\arcade\\games', '', 'C:\\ARCADE\\GAMES>'];
    L.forEach((l, i) => g.fillText(l, 6, 8 + i * 13));
    const typed = 'snake'.slice(0, Math.max(0, Math.floor((t % 4) * 3) - 2));
    const x = 6 + g.measureText('C:\\ARCADE\\GAMES>').width;
    g.fillText(typed, x, 8 + 5 * 13);
    if (Math.floor(t * 2) % 2 === 0) g.fillRect(x + g.measureText(typed).width, 8 + 5 * 13, 6, 11);
  }
  const def = Arcade.app({
    id: 'dos', title: 'MS-DOS Prompt', icon: ICON, width: 652, max: true, folder: 'Accessories', desktop: true, preview,
    hint: 'A command prompt for your arcade. Type HELP, DIR, or the name of a game.',
    build(ctx) {
      const con = makeConsole(ctx.body, {
        toolbar: true, isActive: () => ctx.isActive(), title: s => ctx.setTitle(s), toggleMax: () => ctx.toggleMax(),
        exit: () => ctx.close(),
        win: () => { const b = ctx.win.querySelector('[data-act="min"]'); if (b) b.click(); }
      });
      ctx.onKey(e => { if (con.handleKey(e)) e.preventDefault(); });
      ctx.on('open', () => { if (con.exited) con.reset(); setTimeout(con.focus, 0); });
      ctx.on('close', () => { if (document.fullscreenElement && ctx.win.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {}); });
      def.instance = con;
    }
  });
  def.console = makeConsole;
})();

/* Disk Defragmenter + ScanDisk: the Win95 disk tools. The simulated drive C: is laid out from the programs
   actually installed in Arcade 95 (Arcade.order), so the files you watch being moved are this site's programs. */
(() => {
  const FREE = 0, DATA = 1, OPT = 2, FIXED = 3, BAD = 4;
  const COL = { // [fill, edge]
    0: ['#ffffff', '#a8a8a8'], 1: ['#00b8b8', '#006a6a'], 2: ['#0000a8', '#00004c'], 3: ['#0000a8', '#00004c'], 4: ['#000000', '#000000'],
    read: ['#00d200', '#005c00'], write: ['#ff1a1a', '#7a0000']
  };
  const LEGEND = [
    [DATA, 0, 'Unoptimized data (belongs at beginning of drive)'],
    [OPT, 0, 'Optimized (defragmented) data'],
    [FREE, 0, 'Free space'],
    [FIXED, 0, 'Data that will not be moved'],
    [BAD, 0, 'Bad (damaged) area of the disk'],
    [DATA, 1, "Data that's being read"],
    [DATA, 2, "Data that's being written"]
  ];
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="1" width="14" height="14" fill="#000"/><rect x="2" y="2" width="12" height="12" fill="#fff"/>' +
    [['#0000a8', '#0000a8', '#0000a8', '#0000a8'], ['#0000a8', '#0000a8', '#00b8b8', '#ff1a1a'], ['#00b8b8', '#fff', '#00d200', '#00b8b8'], ['#fff', '#00b8b8', '#fff', '#fff']]
      .map((row, y) => row.map((c, x) => c === '#fff' ? `<rect x="${3 + x * 3}" y="${3 + y * 3}" width="2" height="2" fill="#bbb"/><rect x="${3 + x * 3}" y="${3 + y * 3}" width="1" height="1" fill="#fff"/>` : `<rect x="${3 + x * 3}" y="${3 + y * 3}" width="2" height="2" fill="${c}"/>`).join('')).join('') + '</svg>';
  const SD_ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="9" width="14" height="5" fill="#c0c0c0"/><rect x="1" y="9" width="14" height="1" fill="#fff"/><rect x="1" y="13" width="14" height="1" fill="#404040"/><rect x="14" y="9" width="1" height="5" fill="#404040"/><rect x="11" y="11" width="2" height="1" fill="#00e000"/>' +
    '<rect x="3" y="1" width="4" height="1" fill="#000"/><rect x="2" y="2" width="1" height="4" fill="#000"/><rect x="7" y="2" width="1" height="4" fill="#000"/><rect x="3" y="6" width="4" height="1" fill="#000"/><rect x="3" y="2" width="4" height="4" fill="#9cd2ff"/><rect x="3" y="2" width="1" height="1" fill="#fff"/><rect x="7" y="6" width="2" height="2" fill="#000"/><rect x="8" y="7" width="2" height="2" fill="#7a4a12"/><rect x="9" y="8" width="1" height="1" fill="#000"/></svg>';
  const HDD = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="5" width="14" height="7" fill="#c0c0c0"/><rect x="1" y="5" width="14" height="1" fill="#fff"/><rect x="1" y="11" width="14" height="1" fill="#404040"/><rect x="14" y="5" width="1" height="7" fill="#404040"/><rect x="11" y="8" width="2" height="1" fill="#00e000"/><rect x="3" y="8" width="6" height="1" fill="#808080"/></svg>';
  const FLOPPY = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="2" width="12" height="12" fill="#202020"/><rect x="4" y="2" width="8" height="5" fill="#c0c0c0"/><rect x="9" y="3" width="2" height="3" fill="#202020"/><rect x="4" y="9" width="8" height="5" fill="#fff"/><rect x="5" y="10" width="6" height="1" fill="#808080"/></svg>';
  const big = svg => svg.replace('<svg ', '<svg width="32" height="32" class="dfg-big" ');

  /* ---------- the simulated drive C: built from the installed programs ---------- */
  const SIZES = { amp: 66, byterush: 38, cards: 21, cdplayer: 27, freecell: 27, hover: 72, minesweeper: 32, pinball: 50, ski: 47, snake: 37, solitaire: 27 }; // KB of each js/<id>.js
  const dos8 = s => (String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PROGRAM').slice(0, 8);
  function fileList() {
    const out = [], add = (path, kb, o = {}) => out.push(Object.assign({ path, kb }, o));
    add('C:\\IO.SYS', 40, { fixed: true, hidden: true }); add('C:\\MSDOS.SYS', 2, { fixed: true, hidden: true });
    add('C:\\COMMAND.COM', 92); add('C:\\CONFIG.SYS', 1); add('C:\\AUTOEXEC.BAT', 1);
    add('C:\\WINDOWS\\WIN.COM', 22); add('C:\\WINDOWS\\WIN.INI', 4); add('C:\\WINDOWS\\SYSTEM.INI', 2);
    add('C:\\WINDOWS\\SYSTEM.DAT', 512, { hidden: true }); add('C:\\WINDOWS\\USER.DAT', 196, { hidden: true });
    add('C:\\WINDOWS\\SYSTEM\\KRNL386.EXE', 74); add('C:\\WINDOWS\\SYSTEM\\USER.EXE', 70); add('C:\\WINDOWS\\SYSTEM\\GDI.EXE', 140);
    add('C:\\WINDOWS\\EXPLORER.EXE', 200); add('C:\\WINDOWS\\SYSTEM\\DEFRAG.EXE', 24); add('C:\\WINDOWS\\SYSTEM\\SCANDSKW.EXE', 20);
    add('C:\\ARCADE\\ARCADE.EXE', 20); add('C:\\ARCADE\\WIN95.CSS', 16); add('C:\\ARCADE\\INDEX.HTM', 4);
    Arcade.order.forEach(id => {
      const d = Arcade.apps[id]; if (!d || id === 'defrag' || id === 'scandisk') return;
      const name = dos8(id);
      if (d.folder) {
        const dir = d.folder === 'Games' ? 'C:\\ARCADE\\GAMES\\' : 'C:\\ARCADE\\ACCESSOR\\', kb = SIZES[id] || 24;
        add(dir + name + '.EXE', kb, { app: id }); add(dir + name + '.HLP', Math.max(2, Math.round(kb * .3)), { app: id });
        if (d.folder === 'Games') add(dir + name + '.DAT', 3, { app: id });
      } else add('C:\\WINDOWS\\' + name + '.EXE', 6, { app: id });
    });
    for (let i = 0, n = Arcade.store.get('scandisk.chk', 0); i < n; i++) add('C:\\FILE' + String(i).padStart(4, '0') + '.CHK', 96);
    add('C:\\WIN386.SWP', 32768, { fixed: true, hidden: true, swap: true });
    return out;
  }
  const UNIT = 32768, UNITS = 64512, TOTAL = UNIT * UNITS; // 2,113,929,216 bytes, FAT16 with 32 KB clusters
  function diskStats(bad = 0) {
    const files = fileList(), units = kb => Math.max(1, Math.ceil(kb * 1024 / UNIT));
    const dirs = new Set(['C:\\WINDOWS\\COMMAND', 'C:\\WINDOWS\\FONTS', 'C:\\WINDOWS\\TEMP', 'C:\\WINDOWS\\DESKTOP', 'C:\\WINDOWS\\START MENU',
      'C:\\WINDOWS\\START MENU\\PROGRAMS', 'C:\\WINDOWS\\START MENU\\PROGRAMS\\ACCESSORIES', 'C:\\WINDOWS\\START MENU\\PROGRAMS\\GAMES', 'C:\\RECYCLED', 'C:\\MY DOCUMENTS']);
    files.forEach(f => { const p = f.path.split('\\'); for (let k = 2; k < p.length; k++) dirs.add(p.slice(0, k).join('\\')); });
    const hidden = files.filter(f => f.hidden), user = files.filter(f => !f.hidden);
    const hu = hidden.reduce((s, f) => s + units(f.kb), 0), uu = user.reduce((s, f) => s + units(f.kb), 0);
    return { files, dirs: [...dirs].sort(), bad, hidden: hidden.length, hu, user: user.length, uu, avail: UNITS - bad - hu - uu - dirs.size };
  }

  /* Lay the files out with gaps, then scramble short runs so the drive is fragmented. */
  function genLayout(n, files, rnd = Math.random) {
    const type = new Uint8Array(n), file = new Int16Array(n).fill(-1), rand = k => Math.floor(rnd() * k);
    let p = 0;
    files.forEach((f, i) => { if (f.fixed && !f.swap) for (let k = 0, len = Math.max(1, Math.round(n * .004)); k < len && p < n; k++, p++) { type[p] = FIXED; file[p] = i; } });
    const sw = files.findIndex(f => f.swap);
    if (sw >= 0) { const s = Math.floor(n * (.5 + rnd() * .15)); for (let k = 0, len = Math.max(2, Math.round(n * .022)); k < len && s + k < n; k++) { type[s + k] = FIXED; file[s + k] = sw; } }
    for (let k = 0, nb = Math.max(1, Math.round(n / 700)); k < nb; k++) { const i = Math.floor(n * (.2 + rnd() * .75)); if (type[i] === FREE) type[i] = BAD; }
    const movable = files.map((f, i) => i).filter(i => !files[i].fixed), wt = i => Math.pow(files[i].kb, .7);
    const W = movable.reduce((s, i) => s + wt(i), 0);
    const lens = movable.map(i => Math.max(1, Math.round(wt(i) / W * n * .58)));
    const gapAvg = Math.max(0, (n * .96 - p - lens.reduce((s, l) => s + l, 0) - n * .04) / movable.length);
    for (const [k, i] of movable.entries()) {
      let len = lens[k];
      p += Math.floor(rnd() * rnd() * 3 * gapAvg);
      while (len > 0 && p < n) { if (type[p] === FREE) { type[p] = DATA; file[p] = i; len--; } p++; }
    }
    const solid = t => t === FIXED || t === BAD;
    for (let s = 0, S = Math.round(n * .09); s < S; s++) {
      const L = 1 + rand(4), a = rand(n - L), b = rand(n - L);
      if (Math.abs(a - b) < L) continue;
      let ok = true;
      for (let k = 0; k < L && ok; k++) if (solid(type[a + k]) || solid(type[b + k]) || (type[a + k] === FREE && type[b + k] === FREE)) ok = false;
      if (!ok) continue;
      for (let k = 0; k < L; k++) { const t = type[a + k], f = file[a + k]; type[a + k] = type[b + k]; file[a + k] = file[b + k]; type[b + k] = t; file[b + k] = f; }
    }
    return { type, file };
  }

  /* The defragmenter: each tick reads (green) or writes (red) one cluster. method 0 full, 1 files only, 2 consolidate free space. */
  function Disk(type, file, files, method) {
    const n = type.length, nf = files.length, hl = new Uint8Array(n), rem = new Int32Array(nf);
    let total = 0, left = 0, w = 0, cur = 0, e = n - 1, target = -1;
    for (let i = 0; i < n; i++) if (type[i] === DATA || type[i] === OPT) { total++; if (type[i] === DATA) { left++; rem[file[i]]++; } }
    const S = { n, type, file, hl, files, method, dirty: [], full: true, op: null, done: left === 0, moving: -1, at: 0 };
    const set = (i, t, f) => { type[i] = t; if (f !== undefined) file[i] = f; S.dirty.push(i); };
    const markOpt = i => { rem[file[i]]--; left--; set(i, OPT); S.moving = file[i]; S.at = i; };
    const K = () => 2 + Math.floor(Math.random() * 7);
    S.light = (i, h) => { if (hl[i] !== h) { hl[i] = h; S.dirty.push(i); } };
    S.progress = () => total ? (total - left) / total : 1;
    S.left = () => left;
    S.total = () => total;
    S.reset = () => { S.op = null; hl.fill(0); S.full = true; };

    function planFull() {
      while (w < n && type[w] !== DATA && type[w] !== FREE) w++;
      while (cur < nf && rem[cur] === 0) cur++;
      if (w >= n || left === 0) return false;
      const k = K(), src = [], dst = [];
      if (type[w] === DATA) {
        if (file[w] === cur) { markOpt(w); w++; return true; }
        for (let i = w; i < n && src.length < k && type[i] === DATA && file[i] !== cur; i++) src.push(i);
        for (let i = n - 1; i > w + src.length && dst.length < src.length; i--) if (type[i] === FREE) dst.push(i);
        if (!dst.length) { markOpt(w); w++; return true; }
        src.length = dst.length; S.op = { src, dst, opt: false, i: 0, phase: 0 }; return true;
      }
      for (let i = w; i < n && dst.length < k && type[i] === FREE; i++) dst.push(i);
      for (let i = w + 1; i < n && src.length < dst.length; i++) if (type[i] === DATA && file[i] === cur) src.push(i);
      if (!src.length) { rem[cur] = 0; return true; }
      dst.length = src.length; S.op = { src, dst, opt: true, i: 0, phase: 0 }; return true;
    }
    function planConsolidate() {
      while (w < n && type[w] !== FREE) { if (type[w] === DATA) { markOpt(w); w++; return true; } w++; }
      if (w >= n || left === 0) return false;
      const k = K(), src = [], dst = [];
      for (let i = w; i < n && dst.length < k && type[i] === FREE; i++) dst.push(i);
      while (e > w && src.length < dst.length) { if (type[e] === DATA) src.push(e); e--; }
      if (!src.length) return false;
      dst.length = src.length; S.op = { src, dst, opt: true, i: 0, phase: 0 }; return true;
    }
    function planFiles() {
      while (cur < nf && rem[cur] === 0) { cur++; target = -1; }
      if (cur >= nf) return false;
      const mine = [];
      for (let i = 0; i < n; i++) if (type[i] === DATA && file[i] === cur) mine.push(i);
      if (target < 0) {
        let whole = true;
        for (let i = mine[0]; i <= mine[mine.length - 1]; i++) if (!(type[i] === DATA && file[i] === cur) && type[i] !== FIXED && type[i] !== BAD) { whole = false; break; }
        if (!whole) for (let i = 0, run = 0; i < n; i++) { run = type[i] === FREE ? run + 1 : 0; if (run >= mine.length) { target = i - run + 1; break; } }
        if (whole || target < 0) { S.op = { src: mine.slice(0, 24), dst: null, i: 0, phase: 0 }; return true; }
      }
      const k = K(), dst = [];
      while (target < n && dst.length < Math.min(k, mine.length) && type[target] === FREE) dst.push(target++);
      if (!dst.length) { target = -1; S.op = { src: mine.slice(0, 24), dst: null, i: 0, phase: 0 }; return true; }
      S.op = { src: mine.slice(0, dst.length), dst, opt: true, i: 0, phase: 0 }; return true;
    }
    function commit() {
      const op = S.op; S.op = null;
      if (!op.dst) { op.src.forEach(i => { hl[i] = 0; markOpt(i); }); return; }
      op.src.forEach((s, k) => {
        const d = op.dst[k], f = file[s];
        hl[s] = 0; hl[d] = 0; set(s, FREE, -1);
        if (op.opt) { set(d, OPT, f); rem[f]--; left--; } else set(d, DATA, f);
      });
    }
    S.tick = () => {
      if (S.done) return 'done';
      const op = S.op;
      if (!op) {
        const ok = method === 1 ? planFiles() : method === 2 ? planConsolidate() : planFull();
        if (!ok || (left === 0 && !S.op)) { S.done = true; S.moving = -1; return 'done'; }
        if (S.op) { S.moving = file[S.op.src[0]]; return 'seek'; }
        return 'mark';
      }
      if (op.phase === 0) {
        S.at = op.src[op.i]; S.light(op.src[op.i++], 1);
        if (op.i >= op.src.length) { op.i = 0; op.phase = 1; if (!op.dst) { commit(); return 'step'; } return 'seek'; }
        return 'step';
      }
      S.at = op.dst[op.i]; S.light(op.dst[op.i++], 2);
      if (op.i >= op.dst.length) commit();
      return 'step';
    };
    return S;
  }
  const makeDisk = (n, method, rnd) => { const files = fileList(), L = genLayout(n, files, rnd); return Disk(L.type, L.file, files, method); };
  function rebuild(D, n2, method) {
    const t = new Uint8Array(n2), f = new Int16Array(n2);
    for (let i = 0; i < n2; i++) { const j = Math.floor(i * D.n / n2); t[i] = D.type[j]; f[i] = D.file[j]; }
    return Disk(t, f, D.files, method);
  }

  function drawCell(g, x, y, s, t, h) {
    const c = h === 1 ? COL.read : h === 2 ? COL.write : COL[t];
    g.fillStyle = c[1]; g.fillRect(x, y, s, s);
    if (s > 2) { g.fillStyle = c[0]; g.fillRect(x + 1, y + 1, s - 2, s - 2); }
    if (h) return;
    if (t === FIXED && s >= 4) { const d = s >= 7 ? 2 : 1, o = (s - d) >> 1; g.fillStyle = '#ff2020'; g.fillRect(x + o, y + o, d, d); }
    if (t === BAD && s >= 5) { g.fillStyle = '#ff2020'; for (let i = 1; i < s - 1; i++) { g.fillRect(x + i, y + i, 1, 1); g.fillRect(x + s - 1 - i, y + i, 1, 1); } }
  }

  /* ---------- sound: soft hard-disk seek ticks (filtered noise) ---------- */
  let noiseBuf = null, lastClick = 0;
  function seekTick(vol = 1) {
    if (Arcade.isMuted()) return;
    const a = Arcade.audio(); if (!a) return;
    const now = a.currentTime; if (now - lastClick < .04) return; lastClick = now;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * .03), a.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * .003));
    }
    const click = (t, f, v) => {
      const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.4; g.gain.value = v;
      s.connect(bp).connect(g).connect(a.destination); s.start(t);
    };
    click(now, 1600 + Math.random() * 2200, .2 * vol);
    if (Math.random() < .55) click(now + .01 + Math.random() * .025, 700 + Math.random() * 700, .12 * vol);
  }

  /* ---------- small Win95 modal (shell message-box styles) ---------- */
  function modal(title, html, buttons, onOpen) {
    return new Promise(resolve => {
      const veil = Arcade.el(`<div class="modal-veil"><div class="win msgbox bevel-out active dfg-modal">
        <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
        <div class="dfg-mbody">${html}</div><div class="actions"></div></div></div>`);
      veil.querySelector('.ttl span').textContent = title;
      const box = veil.firstElementChild, done = v => { veil.remove(); resolve(v == null ? null : { button: v, box }); };
      buttons.forEach((b, i) => {
        const bt = Arcade.el('<button class="btn"></button>'); bt.textContent = b; bt.onclick = () => done(b);
        veil.querySelector('.actions').appendChild(bt); if (i === 0) setTimeout(() => bt.focus(), 0);
      });
      veil.querySelector('[data-act="close"]').onclick = () => done(null);
      veil.addEventListener('keydown', e => {
        if (e.key === 'Escape') done(null);
        else if (e.key === 'Enter' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') { e.preventDefault(); done(buttons[0]); }
        e.stopPropagation();
      });
      veil.style.zIndex = 60000;
      document.getElementById('desktop').appendChild(veil);
      if (onOpen) onOpen(box);
    });
  }
  function keepOnScreen(win) {
    requestAnimationFrame(() => {
      const desk = win.parentElement; if (!desk || win.classList.contains('max')) return;
      const ox = win.offsetLeft + win.offsetWidth - desk.clientWidth + 8; if (ox > 0) win.style.left = Math.max(8, win.offsetLeft - ox) + 'px';
      const oy = win.offsetTop + win.offsetHeight - desk.clientHeight + 8; if (oy > 0) win.style.top = Math.max(8, win.offsetTop - oy) + 'px';
    });
  }
  const fmt = v => Math.round(v).toLocaleString('en-US');

  Arcade.css(`
    .dfg-root { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .dfg-dlg { padding: 12px 10px 8px; display: flex; flex-direction: column; gap: 12px; }
    .dfg-row { display: flex; gap: 12px; align-items: flex-start; }
    .dfg-big { flex: none; image-rendering: pixelated; }
    .dfg-grow { flex: 1; min-width: 0; }
    .dfg-row p { margin: 0 0 8px; }
    .dfg-dlg select { width: 100%; }
    .dfg-note { color: var(--ink); opacity: .8; margin-top: 8px !important; }
    .dfg-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
    .dfg-view { flex: 1; display: flex; flex-direction: column; min-height: 0; gap: 6px; }
    .dfg-wrap { flex: 1; position: relative; min-height: 110px; background: #fff; overflow: hidden; }
    .dfg-wrap canvas { position: absolute; left: 2px; top: 2px; display: block; touch-action: manipulation; }
    .dfg-tip { position: absolute; right: 10px; bottom: 10px; background: var(--tip); color: #101014; border: 1px solid #000; padding: 3px 8px; font-size: 11px;
      pointer-events: none; transition: opacity .8s; }
    .dfg-bottom { display: flex; gap: 6px 12px; align-items: flex-end; flex-wrap: wrap; padding: 2px 2px 4px; }
    .dfg-info { flex: 1 1 210px; min-width: 0; }
    .dfg-phase, .sd-phase { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; min-height: 16px; }
    .dfg-bar { height: 20px; padding: 3px; background: var(--face); }
    .dfg-fill { height: 100%; width: 0; background: repeating-linear-gradient(90deg, var(--sel) 0 9px, transparent 9px 11px); }
    .dfg-pct { margin-top: 4px; }
    .dfg-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .dfg-btns .btn { min-width: 70px; padding: 4px 8px; }
    .win.dfg-zen { padding: 0; }
    .win.dfg-zen > .titlebar, .win.dfg-zen > .statusbar, .win.dfg-zen .dfg-bottom { display: none; }
    .win.dfg-zen .wbody { padding: 0; }
    .win.dfg-zen .dfg-wrap { box-shadow: none; }
    .dfg-modal { max-width: min(440px, 100%) !important; }
    .dfg-mbody { padding: 10px 12px 6px; display: flex; flex-direction: column; gap: 6px; }
    .dfg-mbody p { margin: 0; }
    .dfg-mbody label { display: flex; gap: 6px; align-items: flex-start; margin: 3px 0; }
    .dfg-mbody input { margin: 1px 0 0; flex: none; }
    .dfg-mbody .groupbox { margin: 4px 0 0; }
    .dfg-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
    .dfg-leg { display: flex; gap: 8px; align-items: center; margin: 2px 0; }
    .dfg-leg canvas { flex: none; }
    .sd-root { padding: 8px; display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; }
    .sd-list { height: 62px; overflow: auto; padding: 3px; }
    .sd-item { display: flex; gap: 6px; align-items: center; padding: 2px 4px; }
    .sd-item svg { width: 16px; height: 16px; flex: none; }
    .sd-item.on { background: var(--sel); color: var(--sel-ink); }
    .sd-test label, .sd-ck { display: flex; gap: 6px; align-items: flex-start; margin: 3px 0; }
    .sd-test input, .sd-ck input { margin: 1px 0 0; flex: none; }
    .sd-thor { display: flex; gap: 8px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
    .sd-thor .btn { min-width: 70px; }
    .sd-grid { height: 124px; position: relative; background: #fff; flex: none; overflow: hidden; }
    .sd-grid canvas { position: absolute; left: 2px; top: 2px; display: block; }
    .sd-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; margin-top: 4px; }
    .sd-res { border-collapse: collapse; font-variant-numeric: tabular-nums; margin-top: 6px; }
    .sd-res td { padding: 1px 0; white-space: nowrap; }
    .sd-res td:first-child { text-align: right; padding-right: 8px; }
  `);

  /* =================================================================== DISK DEFRAGMENTER */
  let pv = null, pvT = 0, pvEnd = 0;
  function preview(g, w, h, t) {
    const s = 6, cols = Math.floor(w / s), rows = Math.floor(h / s), n = cols * rows;
    if (!pv || pv.n !== n || t < pvT) { pv = makeDisk(n, 0); pvT = t; pvEnd = 0; }
    let steps = Math.floor((t - pvT) * 320); pvT += steps / 320;
    while (steps-- > 0 && !pv.done) pv.tick();
    if (pv.done) { if (!pvEnd) pvEnd = t; else if (t - pvEnd > 1.5) { pv = makeDisk(n, 0); pvEnd = 0; } }
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    const ox = (w - cols * s) >> 1, oy = (h - rows * s) >> 1;
    for (let i = 0; i < n; i++) drawCell(g, ox + (i % cols) * s, oy + ((i / cols) | 0) * s, s - 1, pv.type[i], pv.hl[i]);
    pv.dirty.length = 0;
  }

  const cfgDefaults = { method: 0, check: true, speed: 1, sound: true };
  let cfg = Object.assign({}, cfgDefaults, Arcade.store.get('defrag.cfg', {}));
  const METHODS = ['Full defragmentation (both files and free space)', 'Defragment files only', 'Consolidate free space only'];

  const def = Arcade.app({
    id: 'defrag', title: 'Disk Defragmenter', icon: ICON, width: 380, max: true, folder: 'Accessories', desktop: true, status: true, preview,
    hint: 'Watch drive C: get put back in order, one cluster at a time. Double-click the map for zen mode.',
    build(ctx) {
      const root = ctx.body, win = ctx.win; root.classList.add('dfg-root');
      let disk = null, phase = 'idle', paused = false, raf = 0, last = 0, acc = 0, scan = 0, zen = false, wasMax = false, doneAt = 0, details = true;
      let cv = null, g = null, wrap = null, ro = null, cell = 9, cols = 0, ox = 0, oy = 0, cw = 0, ch = 0, uiAt = 0, els = {}, lastTap = 0, zenAt = 0, tipT = 0;
      const DW = '600px', DH = 'min(470px, calc(100dvh - 60px))';
      const setSize = (w, h = '') => { if (win.classList.contains('max')) return; win.style.width = w; win.style.height = h; keepOnScreen(win); };
      const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
      const kick = () => { if (!raf && ctx.isVisible() && wrap) { last = performance.now(); raf = requestAnimationFrame(frame); } };
      const leaveView = () => { stopLoop(); if (ro) ro.disconnect(); ro = null; wrap = cv = g = null; if (disk) disk.reset(); if (zen) setZen(false); };
      const fragPct = () => !disk ? 23 : disk.left() === 0 ? 0 : Math.max(1, Math.round(23 * disk.left() / Math.max(1, disk.total())));

      function showSelect() {
        leaveView(); phase = 'idle';
        ctx.setTitle('Select Drive'); setSize('380px');
        const st = diskStats();
        root.innerHTML = `<div class="dfg-dlg"><div class="dfg-row">${big(ICON)}<div class="dfg-grow">
          <p>Which drive do you want to defragment?</p>
          <select class="field" aria-label="Drive"><option value="C">Drive C: ARCADE95 (physical drive)</option><option value="A">Drive A:</option></select>
          <p class="dfg-note"></p></div></div>
          <div class="dfg-acts"><button class="btn" data-a="ok">OK</button><button class="btn" data-a="exit">Exit</button></div></div>`;
        const sel = root.querySelector('select'), note = root.querySelector('.dfg-note');
        const upd = () => { note.textContent = sel.value === 'C' ? `ARCADE95 (C:) holds ${st.files.length} files for ${Arcade.order.length} programs. ${fmt(TOTAL / 1048576)} MB total, ${fmt(st.avail * UNIT / 1048576)} MB free.` : '3½ Floppy (A:)'; };
        sel.onchange = upd; upd();
        root.querySelector('[data-a="ok"]').onclick = () => {
          if (sel.value === 'A') Arcade.dialog({ title: 'Disk Defragmenter', icon: 'error', text: 'Drive A: is not ready.' });
          else showAnalysis();
        };
        root.querySelector('[data-a="exit"]').onclick = () => ctx.close();
        ctx.status('Select the drive you want to defragment.');
      }

      function showAnalysis() {
        leaveView(); phase = 'idle';
        const pct = fragPct();
        ctx.setTitle('Disk Defragmenter'); setSize('420px');
        root.innerHTML = `<div class="dfg-dlg"><div class="dfg-row">${big(ICON)}<div class="dfg-grow"><p></p><p class="dfg-note"></p></div></div>
          <div class="dfg-acts"><button class="btn" data-a="start">Start</button><button class="btn" data-a="sel">Select Drive…</button><button class="btn" data-a="adv">Advanced…</button><button class="btn" data-a="exit">Exit</button></div></div>`;
        root.querySelector('p').textContent = pct ? `Drive C is ${pct}% fragmented. You should defragment this drive.`
          : "Drive C is 0% fragmented. You don't need to defragment this drive. If you want to defragment it anyway, click Start.";
        const note = root.querySelector('.dfg-note'), upd = () => { note.textContent = 'Method: ' + METHODS[cfg.method] + '.'; };
        upd();
        root.querySelector('[data-a="start"]').onclick = showDetails;
        root.querySelector('[data-a="sel"]').onclick = showSelect;
        root.querySelector('[data-a="adv"]').onclick = () => advanced().then(upd);
        root.querySelector('[data-a="exit"]').onclick = () => ctx.close();
        ctx.status(pct ? `${pct}% fragmented` : 'Not fragmented');
      }

      function advanced() {
        const html = `<fieldset class="groupbox"><legend>Defragmentation method</legend>
            ${METHODS.map((m, i) => `<label><input type="radio" name="dfg-m" value="${i}"${cfg.method === i ? ' checked' : ''}><span>${m}</span></label>`).join('')}</fieldset>
          <label><input type="checkbox" class="dfg-ck"${cfg.check ? ' checked' : ''}><span>Check drive for errors</span></label>
          <fieldset class="groupbox"><legend>When to use these options</legend>
            <label><input type="radio" name="dfg-w" value="0" checked><span>This time only. Next time, use the defaults again.</span></label>
            <label><input type="radio" name="dfg-w" value="1"><span>Save these options and use them every time.</span></label></fieldset>
          <div class="dfg-line"><span>Speed:</span><select class="field dfg-sp" aria-label="Speed">${['Slow', 'Normal', 'Fast', 'Turbo'].map((s, i) => `<option value="${i}"${cfg.speed === i ? ' selected' : ''}>${s}</option>`).join('')}</select>
            <label><input type="checkbox" class="dfg-snd"${cfg.sound ? ' checked' : ''}><span>Disk seek sounds</span></label></div>`;
        return modal('Advanced Options', html, ['OK', 'Cancel']).then(r => {
          if (!r || r.button !== 'OK') return;
          const b = r.box;
          cfg.method = +b.querySelector('[name="dfg-m"]:checked').value; cfg.check = b.querySelector('.dfg-ck').checked;
          cfg.speed = +b.querySelector('.dfg-sp').value; cfg.sound = b.querySelector('.dfg-snd').checked;
          const saved = Object.assign({}, cfgDefaults, Arcade.store.get('defrag.cfg', {}));
          if (b.querySelector('[name="dfg-w"]:checked').value === '1') Object.assign(saved, cfg);
          saved.speed = cfg.speed; saved.sound = cfg.sound;
          Arcade.store.set('defrag.cfg', saved);
        });
      }

      function showDetails() {
        leaveView();
        ctx.setTitle('Defragmenting Drive C'); details = true; setSize(DW, DH);
        root.innerHTML = `<div class="dfg-view"><div class="dfg-wrap bevel-in"><canvas></canvas><div class="dfg-tip" hidden>Zen mode: double-click or Esc to return</div></div>
          <div class="dfg-bottom"><div class="dfg-info"><div class="dfg-phase"></div><div class="dfg-bar bevel-thin-in"><div class="dfg-fill"></div></div><div class="dfg-pct">0% Complete</div></div>
          <div class="dfg-btns"><button class="btn" data-a="stop">Stop</button><button class="btn" data-a="pause">Pause</button><button class="btn" data-a="legend">Legend</button><button class="btn" data-a="hide">Hide Details</button></div></div></div>`;
        wrap = root.querySelector('.dfg-wrap'); cv = wrap.querySelector('canvas'); g = cv.getContext('2d');
        els = { phase: root.querySelector('.dfg-phase'), fill: root.querySelector('.dfg-fill'), pct: root.querySelector('.dfg-pct'), tip: root.querySelector('.dfg-tip'),
          pause: root.querySelector('[data-a="pause"]'), hide: root.querySelector('[data-a="hide"]'), legend: root.querySelector('[data-a="legend"]') };
        els.pause.onclick = () => setPaused(!paused);
        els.legend.onclick = legend;
        els.hide.onclick = () => setDetails(!details);
        root.querySelector('[data-a="stop"]').onclick = stop;
        cv.addEventListener('dblclick', () => toggleZen());
        cv.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') return; const now = performance.now(); if (now - lastTap < 350) { lastTap = 0; toggleZen(); } else lastTap = now; });
        ro = new ResizeObserver(() => layout()); ro.observe(wrap);
        layout();
        if (disk && disk.method !== cfg.method) disk = rebuild(disk, disk.n, cfg.method);
        if (disk) disk.reset();
        phase = cfg.check ? 'check' : 'scan'; scan = 0; paused = false; acc = 0;
        ui(true); kick();
      }

      function layout() {
        if (!wrap || !cv) return;
        const W = wrap.clientWidth - 4, H = wrap.clientHeight - 4;
        if (W < 24 || H < 24) return;
        cell = zen ? 11 : W < 440 ? 7 : 9;
        cols = Math.floor(W / cell); const rows = Math.floor(H / cell), n = cols * rows;
        ox = (W - cols * cell) >> 1; oy = (H - rows * cell) >> 1;
        const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
        if (cw !== W || ch !== H || cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cw = W; ch = H; }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!disk) disk = makeDisk(n, cfg.method);
        else if (disk.n !== n) { const keep = scan / disk.n; disk = rebuild(disk, n, disk.method); scan = keep * n; }
        disk.full = true; draw();
      }
      function draw() {
        if (!g || !disk) return;
        const d = disk.dirty, s = cell;
        if (disk.full) {
          disk.full = false; d.length = 0;
          g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
          for (let i = 0; i < disk.n; i++) drawCell(g, ox + (i % cols) * s, oy + ((i / cols) | 0) * s, s - 1, disk.type[i], disk.hl[i]);
          return;
        }
        for (let k = 0; k < d.length; k++) { const i = d[k]; drawCell(g, ox + (i % cols) * s, oy + ((i / cols) | 0) * s, s - 1, disk.type[i], disk.hl[i]); }
        d.length = 0;
      }

      const stepMs = () => [40, 14, 4, .6][cfg.speed] * Math.min(1, 2400 / disk.n) * (def.debug.slow || 1);
      function advanceScan(dt) {
        const n = disk.n, bw = Math.max(4, Math.round(n / 22)), f = [.6, 1, 1.8, 4][cfg.speed];
        const a = Math.floor(scan), next = Math.min(n + bw, scan + n * dt / (phase === 'check' ? 1700 : 1300) * f), b = Math.floor(next);
        for (let i = Math.max(0, a - bw); i < Math.min(n, b - bw); i++) disk.light(i, 0);
        for (let i = a; i < Math.min(n, b); i++) disk.light(i, 1);
        if (cfg.sound && Math.random() < dt / 90) seekTick(.5);
        scan = next;
        if (scan >= n + bw) { for (let i = Math.max(0, n - bw - 2); i < n; i++) disk.light(i, 0); scan = 0; phase = phase === 'check' ? 'scan' : 'run'; acc = 0; }
      }
      function frame(now) {
        raf = 0;
        if (!ctx.isVisible() || !wrap) return;
        if (!disk) { layout(); if (!disk) { kick(); return; } }
        const dt = Math.max(0, Math.min(100, now - last)); last = now;
        if (!paused) {
          if (phase === 'check' || phase === 'scan') advanceScan(dt);
          else if (phase === 'run') {
            acc += dt; const ms = stepMs(); let steps = Math.floor(acc / ms);
            if (steps > 5000) { steps = 5000; acc = 0; } else acc -= steps * ms;
            while (steps-- > 0) {
              const ev = disk.tick();
              if (ev === 'seek') { if (cfg.sound) seekTick(.7); } else if (ev === 'done') { finish(); break; }
            }
          } else if (phase === 'done' && zen && now - doneAt > 1800) { disk = makeDisk(disk.n, cfg.method); disk.full = true; phase = 'run'; acc = 0; }
        }
        if (details || zen) draw(); else { disk.dirty.length = 0; }
        if (tipT && now > tipT) { els.tip.style.opacity = '0'; tipT = 0; }
        ui(false, now);
        if (!paused && (phase !== 'done' || zen)) kick();
      }

      function ui(force, now = performance.now()) {
        if (!els.pct || !disk || (!force && now - uiAt < 90)) return;
        uiAt = now;
        const p = disk.progress(), pct = Math.floor(p * 100);
        els.fill.style.width = (phase === 'check' || phase === 'scan' ? 0 : p * 100) + '%';
        els.pct.textContent = (phase === 'check' || phase === 'scan' ? 0 : pct) + '% Complete';
        els.phase.textContent = paused ? 'Defragmentation paused.' : phase === 'check' ? 'Checking drive for errors…' : phase === 'scan' ? 'Reading drive information…'
          : phase === 'done' ? 'Defragmentation complete.' : cfg.method === 2 ? 'Consolidating free space…' : 'Defragmenting file system…';
        const f = disk.files[disk.moving];
        ctx.status(phase === 'run' && f ? f.path : phase === 'done' ? 'Drive C: is optimized.' : els.phase.textContent,
          'Cluster ' + fmt(Math.floor(disk.at * UNITS / disk.n)));
      }

      function setPaused(v) {
        paused = v; if (!els.pause) return;
        els.pause.textContent = v ? 'Resume' : 'Pause';
        ctx.setTitle(v ? 'Defragmenting Drive C (Paused)' : 'Defragmenting Drive C');
        ui(true); if (!v) kick();
      }
      function setDetails(v) {
        details = v; if (!wrap) return;
        wrap.hidden = !v; els.legend.hidden = !v; els.hide.textContent = v ? 'Hide Details' : 'Show Details';
        setSize(v ? DW : '360px', v ? DH : '');
        if (v) requestAnimationFrame(layout);
      }
      async function stop() {
        const was = paused; setPaused(true);
        const b = await Arcade.dialog({ title: 'Disk Defragmenter', icon: 'warn', text: 'Defragmentation of drive C has stopped.', buttons: ['Resume', 'Select Drive', 'Exit'] });
        if (b === 'Select Drive') showSelect(); else if (b === 'Exit') ctx.close(); else if (wrap) setPaused(was);
      }
      async function finish() {
        phase = 'done'; doneAt = performance.now(); disk.moving = -1; ui(true);
        if (zen) return;
        if (cfg.sound) seekTick(1);
        const b = await Arcade.dialog({ title: 'Disk Defragmenter', icon: 'info', text: 'Defragmentation of drive C is complete. Do you want to quit Disk Defragmenter?', buttons: ['Yes', 'No'] });
        if (zen) return;
        if (b === 'Yes') ctx.close(); else if (b === 'No' && phase === 'done') showSelect();
      }
      function legend() {
        const html = LEGEND.map(([t, h, label]) => `<div class="dfg-leg"><canvas width="11" height="11" data-t="${t}" data-h="${h}"></canvas><span>${label}</span></div>`).join('') +
          '<p style="margin-top:6px">Each box represents one disk cluster.</p>';
        modal('Defrag Legend', html, ['Close'], box => box.querySelectorAll('canvas').forEach(c => drawCell(c.getContext('2d'), 0, 0, 11, +c.dataset.t, +c.dataset.h)));
      }
      function setZen(on) {
        zen = on; zenAt = performance.now(); win.classList.toggle('dfg-zen', on);
        if (on) {
          wasMax = win.classList.contains('max'); if (!wasMax) ctx.toggleMax();
          if (els.tip) { els.tip.hidden = false; els.tip.style.opacity = '1'; tipT = performance.now() + 2500; }
          if (paused) setPaused(false);
          if (phase === 'done') { disk = makeDisk(disk.n, cfg.method); phase = 'run'; }
          kick();
        } else {
          if (!wasMax && win.classList.contains('max')) ctx.toggleMax();
          if (els.tip) els.tip.hidden = true;
        }
        requestAnimationFrame(layout);
      }
      function toggleZen() { if (performance.now() - zenAt < 450) return; setZen(!zen); }
      ctx.onKey(e => { if (zen && e.key === 'Escape') { e.preventDefault(); setZen(false); } });

      ctx.on('minimize', stopLoop); ctx.on('restore', kick); ctx.on('open', kick);
      ctx.on('close', () => { leaveView(); paused = false; showSelect(); });
      ctx.on('resize', () => requestAnimationFrame(layout));

      /* test hooks for tools/smoke.mjs (no globals: lives on the app definition) */
      Object.assign(def.debug, {
        state: () => ({ phase, paused, zen, n: disk && disk.n, cell, pct: disk ? Math.round(disk.progress() * 1000) / 10 : 0, moving: disk && disk.files[disk.moving] ? disk.files[disk.moving].path : null,
          reading: disk ? disk.hl.reduce((s, h) => s + (h === 1), 0) : 0, writing: disk ? disk.hl.reduce((s, h) => s + (h === 2), 0) : 0 }),
        skipScan: () => { if (disk && (phase === 'check' || phase === 'scan')) { disk.reset(); phase = 'run'; scan = 0; } },
        steps: k => { if (!disk) return; for (let i = 0; i < k && !disk.done; i++) disk.tick(); draw(); ui(true); },
        finish: () => { if (!disk) return; phase = 'run'; let guard = 0; while (!disk.done && guard++ < 5e6) disk.tick(); disk.full = true; draw(); finish(); },
        start: () => { showAnalysis(); showDetails(); }
      });
      showSelect();
    }
  });
  def.debug = {};

  /* =================================================================== SCANDISK */
  function sdPreview(g, w, h, t) {
    g.fillStyle = '#c3c3c6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#101014'; g.font = '10px Tahoma, Verdana, sans-serif'; g.textBaseline = 'top'; g.fillText('Checking surface scan…', 6, 5);
    const s = 7, gx = 6, gy = 19, cols = Math.floor((w - 12) / s), rows = Math.floor((h - 44) / s), n = cols * rows;
    const p = Math.min(1, (t % 9) / 8), k = Math.floor(p * n), bad = [Math.floor(n * .37), Math.floor(n * .71)];
    g.fillStyle = '#fff'; g.fillRect(gx - 1, gy - 1, cols * s + 1, rows * s + 1);
    for (let i = 0; i < n; i++) {
      const x = gx + (i % cols) * s, y = gy + ((i / cols) | 0) * s;
      const isBad = bad.includes(i) && i < k;
      g.fillStyle = isBad ? '#ff1a1a' : i === k ? '#00d200' : i < k ? '#0000a8' : '#e2e2e2'; g.fillRect(x, y, s - 1, s - 1);
      if (isBad) { g.fillStyle = '#fff'; g.fillRect(x + 2, y + 1, 1, 4); g.fillRect(x + 3, y + 1, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); g.fillRect(x + 3, y + 5, 1, 1); g.fillRect(x + 4, y + 2, 1, 1); g.fillRect(x + 4, y + 4, 1, 1); }
    }
    const by = h - 18;
    g.fillStyle = '#85858c'; g.fillRect(6, by, w - 12, 1); g.fillRect(6, by, 1, 12); g.fillStyle = '#fff'; g.fillRect(6, by + 12, w - 12, 1); g.fillRect(w - 7, by, 1, 12);
    g.fillStyle = '#0a1a86'; for (let x = 9, e = 9 + (w - 18) * p; x + 6 <= e; x += 8) g.fillRect(x, by + 2, 6, 9);
  }

  const sdDefaults = { summary: 0, lost: 1, area: 0, noWrite: false, noHidden: false };
  const sdCfg = Object.assign({}, sdDefaults, Arcade.store.get('scandisk.cfg', {}));
  const saveSd = () => Arcade.store.set('scandisk.cfg', sdCfg);

  const sdDef = Arcade.app({
    id: 'scandisk', title: 'ScanDisk', icon: SD_ICON, width: 420, max: true, folder: 'Accessories', desktop: true, preview: sdPreview,
    hint: 'Check drive C: for errors. A Thorough test scans the disk surface block by block.',
    build(ctx) {
      const root = ctx.body;
      root.innerHTML = `<div class="sd-root">
        <div>Select the drive(s) you want to check for errors:</div>
        <div class="sd-list field" role="listbox"><div class="sd-item" data-d="A" role="option">${FLOPPY}<span>3½ Floppy (A:)</span></div><div class="sd-item on" data-d="C" role="option">${HDD}<span>Arcade95 (C:)</span></div></div>
        <fieldset class="groupbox sd-test"><legend>Type of test</legend>
          <label><input type="radio" name="sd-t" value="0" checked><span>Standard<br>(checks files and folders for errors)</span></label>
          <div class="sd-thor"><label><input type="radio" name="sd-t" value="1"><span>Thorough<br>(performs Standard test and scans disk surface for errors)</span></label><button class="btn" data-a="opt" disabled>Options…</button></div>
        </fieldset>
        <label class="sd-ck"><input type="checkbox" class="sd-fix"><span>Automatically fix errors</span></label>
        <div class="sd-grid bevel-in" hidden><canvas></canvas></div>
        <div class="sd-phase">&nbsp;</div>
        <div class="dfg-bar bevel-thin-in"><div class="dfg-fill"></div></div>
        <div class="sd-acts"><button class="btn" data-a="start">Start</button><button class="btn" data-a="close">Close</button><button class="btn" data-a="adv">Advanced…</button></div>
      </div>`;
      const $ = s => root.querySelector(s);
      const phaseEl = $('.sd-phase'), fill = $('.dfg-fill'), startBtn = $('[data-a="start"]'), closeBtn = $('[data-a="close"]'), optBtn = $('[data-a="opt"]'), advBtn = $('[data-a="adv"]');
      const grid = $('.sd-grid'), cv = grid.querySelector('canvas'), g = cv.getContext('2d'), fix = $('.sd-fix');
      let drive = 'C', run = null, raf = 0, last = 0;
      const thorough = () => $('[name="sd-t"]:checked').value === '1';
      root.querySelectorAll('.sd-item').forEach(it => it.addEventListener('click', () => {
        if (run) return; drive = it.dataset.d;
        root.querySelectorAll('.sd-item').forEach(x => x.classList.toggle('on', x === it));
        ctx.setTitle('ScanDisk - ' + (drive === 'C' ? 'Arcade95 (C:)' : '3½ Floppy (A:)'));
      }));
      root.querySelectorAll('[name="sd-t"]').forEach(r => r.addEventListener('change', () => { optBtn.disabled = !thorough(); }));
      const lockUi = on => { root.querySelectorAll('.sd-root input').forEach(i => { i.disabled = on; }); optBtn.disabled = on || !thorough(); advBtn.disabled = on; closeBtn.disabled = on; startBtn.textContent = on ? 'Cancel' : 'Start'; };

      optBtn.onclick = () => modal('Surface Scan Options', `<fieldset class="groupbox"><legend>Areas of the disk to scan</legend>
          ${['System and data areas.', 'System area only.', 'Data area only.'].map((a, i) => `<label><input type="radio" name="sd-a" value="${i}"${sdCfg.area === i ? ' checked' : ''}><span>${a}</span></label>`).join('')}</fieldset>
          <label><input type="checkbox" class="sd-nw"${sdCfg.noWrite ? ' checked' : ''}><span>Do not perform write-testing</span></label>
          <label><input type="checkbox" class="sd-nh"${sdCfg.noHidden ? ' checked' : ''}><span>Do not repair bad sectors in hidden and system files</span></label>`, ['OK', 'Cancel']).then(r => {
        if (!r || r.button !== 'OK') return;
        sdCfg.area = +r.box.querySelector('[name="sd-a"]:checked').value; sdCfg.noWrite = r.box.querySelector('.sd-nw').checked; sdCfg.noHidden = r.box.querySelector('.sd-nh').checked; saveSd();
      });
      advBtn.onclick = () => modal('ScanDisk Advanced Options', `<fieldset class="groupbox"><legend>Display summary</legend>
          ${['Always', 'Never', 'Only if errors found'].map((a, i) => `<label><input type="radio" name="sd-s" value="${i}"${sdCfg.summary === i ? ' checked' : ''}><span>${a}</span></label>`).join('')}</fieldset>
          <fieldset class="groupbox"><legend>Lost file fragments</legend>
          ${['Free', 'Convert to files'].map((a, i) => `<label><input type="radio" name="sd-l" value="${i}"${sdCfg.lost === i ? ' checked' : ''}><span>${a}</span></label>`).join('')}</fieldset>`, ['OK', 'Cancel']).then(r => {
        if (!r || r.button !== 'OK') return;
        sdCfg.summary = +r.box.querySelector('[name="sd-s"]:checked').value; sdCfg.lost = +r.box.querySelector('[name="sd-l"]:checked').value; saveSd();
      });
      closeBtn.onclick = () => ctx.close();
      startBtn.onclick = () => { if (run) cancel(); else start(); };

      function start() {
        if (drive === 'A') { Arcade.dialog({ title: 'ScanDisk', icon: 'error', text: 'Drive A: is not ready. Insert a disk in drive A: and try again.' }); return; }
        const st = diskStats();
        const phases = [
          { text: 'Checking file allocation table…', d: 1.6, items: ['FAT 1', 'FAT 2'], lost: true },
          { text: 'Checking folders…', d: 1.9, items: st.dirs },
          { text: 'Checking file system…', d: 1.5, items: st.files.map(f => f.path) }
        ];
        if (thorough()) phases.push({ text: 'Checking surface scan…', d: sdCfg.noWrite ? 7 : 10, surface: true });
        const forced = sdDef.debug.forceLost;
        run = { phases, i: 0, t: 0, total: phases.reduce((s, p) => s + p.d, 0), doneT: 0, lost: forced != null ? forced : Math.random() < .35, waiting: false,
          lostFrags: 2 + Math.floor(Math.random() * 5), lostResult: null, chk: null, badFound: 0, sk: 0, cur: -1, cells: null };
        run.chains = 1 + Math.floor(Math.random() * Math.min(3, run.lostFrags));
        lockUi(true); grid.hidden = true; kick();
      }
      function cancel() {
        cancelAnimationFrame(raf); raf = 0; run = null; lockUi(false); grid.hidden = true;
        phaseEl.textContent = 'ScanDisk was canceled.'; fill.style.width = '0';
      }
      const kick = () => { if (!raf && run && !run.waiting && ctx.isVisible()) { last = performance.now(); raf = requestAnimationFrame(frame); } };

      function setupSurface() {
        grid.hidden = false;
        const W = grid.clientWidth - 4, H = grid.clientHeight - 4, s = W < 440 ? 7 : 9, cols = Math.floor(W / s), rows = Math.floor(H / s), n = cols * rows;
        const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
        cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const sys = Math.max(4, Math.round(n * .08)), order = [];
        for (let i = 0; i < n; i++) if (sdCfg.area === 0 || (sdCfg.area === 1 ? i < sys : i >= sys)) order.push(i);
        const bad = new Set([Math.floor(n * (.3 + Math.random() * .25)), Math.floor(n * (.62 + Math.random() * .3))]);
        run.cells = { s, cols, n, order, bad, state: new Uint8Array(n), ox: (W - cols * s) >> 1, oy: (H - rows * s) >> 1, W, H };
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < n; i++) sdCell(i, order.length === n || (sdCfg.area === 1 ? i < sys : i >= sys) ? 0 : 4);
      }
      function sdCell(i, st) { // 0 unscanned, 1 ok, 2 reading, 3 bad, 4 outside scan area, 5 writing
        const c = run.cells, s = c.s, x = c.ox + (i % c.cols) * s, y = c.oy + ((i / c.cols) | 0) * s;
        c.state[i] = st;
        g.fillStyle = ['#a8a8a8', '#00004c', '#005c00', '#7a0000', '#d8d8d8', '#7a0000'][st]; g.fillRect(x, y, s - 1, s - 1);
        g.fillStyle = ['#e4e4e4', '#0000a8', '#00d200', '#ff1a1a', '#fff', '#ff1a1a'][st]; g.fillRect(x + 1, y + 1, s - 3, s - 3);
        if (st === 3) { // white pixel "B"
          g.fillStyle = '#fff'; const bx = x + ((s - 1) >> 1) - 2, by = y + ((s - 1) >> 1) - 2;
          ['###.', '#..#', '###.', '#..#', '###.'].forEach((row, r) => { for (let k = 0; k < 4; k++) if (row[k] === '#') g.fillRect(bx + k, by + r, 1, 1); });
        }
      }

      function frame(now) {
        raf = 0;
        if (!run || run.waiting || !ctx.isVisible()) return;
        const dt = Math.max(0, Math.min(.1, (now - last) / 1000)) * (sdDef.debug.speed || 1); last = now;
        const ph = run.phases[run.i];
        if (ph.surface && !run.cells) setupSurface();
        run.t += dt;
        let extra = '';
        if (ph.surface) {
          const c = run.cells, k = Math.min(c.order.length, Math.floor(run.t / ph.d * c.order.length));
          for (; run.sk < k; run.sk++) {
            const i = c.order[run.sk];
            if (c.bad.has(i)) { sdCell(i, 3); run.badFound++; } else sdCell(i, 1);
            if (run.sk % 6 === 0) seekTick(.45);
          }
          if (run.cur >= 0 && run.cur !== c.order[k]) { const st = c.state[run.cur]; if (st === 2 || st === 5) sdCell(run.cur, 0); }
          run.cur = k < c.order.length ? c.order[k] : -1;
          if (run.cur >= 0) sdCell(run.cur, !sdCfg.noWrite && (now / 70 | 0) % 2 ? 5 : 2);
          extra = ' cluster ' + fmt(Math.floor(c.order[Math.min(k, c.order.length - 1)] * UNITS / c.n)) + (run.badFound ? ` (${run.badFound} bad cluster${run.badFound > 1 ? 's' : ''} found, marked B)` : '');
        } else if (ph.items && ph.items.length) extra = ' ' + ph.items[Math.min(ph.items.length - 1, Math.floor(run.t / ph.d * ph.items.length))];
        phaseEl.textContent = ph.text + extra;
        fill.style.width = Math.min(100, (run.doneT + Math.min(run.t, ph.d)) / run.total * 100) + '%';
        if (run.t >= ph.d) {
          if (ph.lost && run.lost && !run.lostResult) { lostFragments(); return; }
          run.doneT += ph.d; run.i++; run.t = 0;
          if (run.i >= run.phases.length) { complete(); return; }
        }
        kick();
      }

      async function lostFragments() {
        run.waiting = true;
        const r0 = run, bytes = r0.lostFrags * UNIT;
        let choice;
        if (fix.checked) choice = sdCfg.lost === 1 ? 'convert' : 'free';
        else {
          const res = await modal('ScanDisk Found Lost File Fragments - Arcade95 (C:)',
            `<div class="dfg-row">${big(SD_ICON)}<div class="dfg-grow"><p>ScanDisk found ${fmt(bytes)} bytes of data in ${r0.lostFrags} lost file fragments in ${r0.chains} chain${r0.chains > 1 ? 's' : ''} on this drive.</p>
             <p style="margin-top:6px">These fragments may contain data you accidentally lost. Do you want to:</p>
             <label><input type="radio" name="sd-lf" value="0"${sdCfg.lost === 0 ? ' checked' : ''}><span>Free</span></label>
             <label><input type="radio" name="sd-lf" value="1"${sdCfg.lost === 1 ? ' checked' : ''}><span>Convert to files</span></label></div></div>`, ['OK', 'Cancel']);
          choice = !res ? 'skip' : res.button === 'OK' ? (res.box.querySelector('[name="sd-lf"]:checked').value === '1' ? 'convert' : 'free') : 'skip';
        }
        if (run !== r0) return; // canceled meanwhile
        if (choice === 'convert') {
          const k = Arcade.store.get('scandisk.chk', 0);
          r0.chk = 'C:\\FILE' + String(k).padStart(4, '0') + '.CHK'; Arcade.store.set('scandisk.chk', k + 1);
        }
        r0.lostResult = choice; r0.waiting = false; kick();
      }

      function complete() {
        const r0 = run; run = null; lockUi(false);
        phaseEl.textContent = 'Complete'; fill.style.width = '100%';
        const errors = r0.lost || r0.badFound > 0;
        if (sdCfg.summary === 1 || (sdCfg.summary === 2 && !errors)) return;
        const st = diskStats(r0.badFound);
        const msg = !errors ? 'ScanDisk did not find any errors on this drive.'
          : r0.lostResult === 'skip' ? 'ScanDisk found errors on this drive. Some errors were not fixed.'
          : 'ScanDisk found errors on this drive and fixed them all.';
        const notes = [];
        if (r0.lost && r0.lostResult === 'convert') notes.push(`${r0.lostFrags} lost file fragments were converted to ${r0.chk}.`);
        if (r0.lost && r0.lostResult === 'free') notes.push(`${fmt(r0.lostFrags * UNIT)} bytes in lost file fragments were freed.`);
        if (r0.badFound) notes.push(`${r0.badFound} bad cluster${r0.badFound > 1 ? 's were' : ' was'} found and marked so it won't be used.`);
        const rows = [
          [TOTAL, 'bytes total disk space'], [st.bad * UNIT, 'bytes in bad sectors'], [st.dirs.length * UNIT, `bytes in ${fmt(st.dirs.length)} folders`],
          [st.hu * UNIT, `bytes in ${fmt(st.hidden)} hidden files`], [st.uu * UNIT, `bytes in ${fmt(st.user)} user files`], [st.avail * UNIT, 'bytes available on disk'],
          [UNIT, 'bytes in each allocation unit'], [UNITS, 'total allocation units on disk'], [st.avail, 'available allocation units']
        ];
        modal('ScanDisk Results - Arcade95 (C:)', `<p>${msg}</p>${notes.map(n => `<p>${Arcade.esc(n)}</p>`).join('')}
          <table class="sd-res">${rows.map(([v, l]) => `<tr><td>${fmt(v)}</td><td>${l}</td></tr>`).join('')}</table>`, ['Close']);
      }

      ctx.setTitle('ScanDisk - Arcade95 (C:)');
      ctx.on('restore', kick); ctx.on('open', kick);
      ctx.on('minimize', () => { cancelAnimationFrame(raf); raf = 0; });
      ctx.on('close', () => { if (run) cancel(); phaseEl.innerHTML = '&nbsp;'; fill.style.width = '0'; });
    }
  });
  sdDef.debug = { speed: 1, forceLost: null };
})();

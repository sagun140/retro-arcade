/* FreeCell: Windows 95 FreeCell with the classic Microsoft numbered deals (1-32000), the watching king, supermoves. */
(() => {
  const C = window.Cards95, CW = C.CW, CH = C.CH;
  const FELT = '#008000';
  const W = 640, H = 340;
  const CELLY = 4, COLY = 116, colX = i => 8 + i * 79, cellX = i => i * 71, homeX = i => 356 + i * 71;
  const KX = 320, KY = 50;
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="0" width="14" height="16" fill="#000"/><rect x="2" y="1" width="12" height="14" fill="#fff"/><rect x="4" y="2" width="1" height="1" fill="#e8b400"/><rect x="7" y="2" width="2" height="1" fill="#e8b400"/><rect x="11" y="2" width="1" height="1" fill="#e8b400"/><rect x="4" y="3" width="8" height="2" fill="#e8b400"/><rect x="6" y="3" width="1" height="1" fill="#d01c1c"/><rect x="9" y="3" width="1" height="1" fill="#1d3fbf"/><rect x="4" y="5" width="8" height="3" fill="#f6c79a"/><rect x="5" y="6" width="1" height="1" fill="#000"/><rect x="10" y="6" width="1" height="1" fill="#000"/><rect x="4" y="8" width="8" height="2" fill="#eee"/><rect x="7" y="7" width="2" height="1" fill="#c0302a"/><rect x="3" y="10" width="10" height="4" fill="#d01c1c"/><rect x="7" y="10" width="2" height="4" fill="#eee"/></svg>';
  const store = { get: (k, d) => Arcade.store.get('freecell.' + k, d), set: (k, v) => Arcade.store.set('freecell.' + k, v) };
  let opts = Object.assign({ msgs: true, quick: false, multi: true }, store.get('opts', {}));
  const getStats = () => Object.assign({ won: 0, lost: 0, cur: 0, bestW: 0, bestL: 0 }, store.get('stats', {}));
  const session = { w: 0, l: 0 };
  const api = {};
  const pct = (w, l) => (w + l ? Math.round(100 * w / (w + l)) : 0) + '%';

  Arcade.css(`
    .fc-felt { position: relative; flex: 1; min-height: 180px; background: ${FELT}; overflow: hidden; touch-action: none; }
    .fc-stats td { padding: 2px 10px 2px 0; }
    .fc-stats td.fc-n { text-align: right; font-variant-numeric: tabular-nums; }
  `);

  Arcade.scores.add({
    game: 'FreeCell',
    render() {
      const s = getStats();
      return '<tr><th>FreeCell</th><th>Record</th></tr>' +
        `<tr><td>Won / lost</td><td class="num">${s.won} / ${s.lost} (${pct(s.won, s.lost)})</td></tr>` +
        `<tr><td>Longest winning streak</td><td class="num">${s.bestW}</td></tr>` +
        `<tr><td>Longest losing streak</td><td class="num">${s.bestL}</td></tr>` +
        `<tr><td>Current streak</td><td class="num">${s.cur > 0 ? s.cur + ' won' : s.cur < 0 ? -s.cur + ' lost' : '-'}</td></tr>`;
    }
  });

  /* the little king: 14x14 sprite, eyes follow the side the pointer is on, smiles on a win */
  const KING = ['...y..y..y....', '...yyyyyyy....', '...yrybyry....', '..hsssssssh...', '..hsEEsEEsh...', '..hsssssssh...',
    '..hssMMMssh...', '..wwwwwwwww...', '...wwwwwww....', '.rrrrwwwrrrr..', 'rrrrrrwrrrrrr.', 'rwrrrrwrrrrwr.', 'rwrrrrrrrrrwr.', 'rrrrrrrrrrrrr.'];
  const KPAL = { y: '#e8b400', r: '#cf2222', b: '#1d3fbf', h: '#9a9aa2', s: '#f6c79a', w: '#f4f4f4' };
  function king(g, ox, oy, ps, dir, smile) {
    KING.forEach((row, y) => {
      for (let x = 0; x < 14; x++) {
        let ch = row[x];
        if (ch === '.') continue;
        let col = KPAL[ch];
        if (ch === 'E') { const second = (x === 5 || x === 8); col = (dir > 0) === second ? '#000' : '#fff'; }
        if (ch === 'M') col = smile ? '#f6c79a' : '#7a2018';
        g.fillStyle = col; g.fillRect(Math.round(ox + x * ps), Math.round(oy + y * ps), Math.ceil(ps), Math.ceil(ps));
      }
    });
    if (smile) { g.fillStyle = '#7a2018'; [[4, 5], [5, 6], [6, 6], [7, 6], [8, 5]].forEach(([x, y]) => g.fillRect(Math.round(ox + x * ps), Math.round(oy + y * ps), Math.ceil(ps), Math.ceil(ps))); }
  }

  let pvCols = null;
  function preview(g, w, h, t) {
    g.fillStyle = FELT; g.fillRect(0, 0, w, h);
    const cw = 21, ch = 28, gap = (w - 8 * cw) / 9;
    if (!pvCols) pvCols = C.msDeal(1);
    g.strokeStyle = '#000'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.strokeRect(2.5 + i * cw, 2.5, cw - 1, ch); g.strokeRect(w - 2.5 - (4 - i) * cw + 1, 2.5, cw - 1, ch); }
    const phase = t % 3, moving = phase > 1 && phase < 2.4;
    king(g, w / 2 - 10, 6, 1.5, Math.sin(t * 1.3) > 0 ? 1 : -1, phase > 2.4);
    pvCols.forEach((col, i) => col.slice(0, 5).forEach((c, j) => { if (i === 3 && j === 4 && (moving || phase > 2.4)) return; g.drawImage(C.image(c, cw, ch), Math.round(gap + i * (cw + gap)), 40 + j * 9); }));
    const c = pvCols[3][4];
    if (moving || phase > 2.4) {
      const k = Math.min(1, (phase - 1) / 1.2), e = 1 - (1 - k) * (1 - k);
      const x0 = gap + 3 * (cw + gap), y0 = 76, x1 = 3 + cw, y1 = 3;
      g.drawImage(C.image(c, cw, ch), Math.round(x0 + (x1 - x0) * e), Math.round(y0 + (y1 - y0) * e));
    }
  }

  async function showOptions() {
    const r = await C.modal({
      title: 'FreeCell Options', buttons: ['OK', 'Cancel'],
      html: `<label><input type="checkbox" data-o="msgs"> Messages on illegal moves</label>
        <label><input type="checkbox" data-o="quick"> Quick play (no animation)</label>
        <label><input type="checkbox" data-o="multi"> Move multiple cards (uses free cells and empty columns)</label>`,
      init(el) { el.querySelectorAll('[data-o]').forEach(i => { i.checked = !!opts[i.dataset.o]; }); }
    });
    if (r.button !== 'OK') return;
    r.el.querySelectorAll('[data-o]').forEach(i => { opts[i.dataset.o] = i.checked; });
    store.set('opts', opts);
  }

  async function showStats() {
    const s = getStats();
    const r = await C.modal({
      title: 'FreeCell Statistics', buttons: ['OK', 'Clear'],
      html: `<table class="fc-stats">
        <tr><td colspan="3"><b>This session</b></td></tr>
        <tr><td>Won</td><td class="fc-n">${session.w}</td><td rowspan="2">${pct(session.w, session.l)}</td></tr><tr><td>Lost</td><td class="fc-n">${session.l}</td></tr>
        <tr><td colspan="3"><b>Total</b></td></tr>
        <tr><td>Won</td><td class="fc-n">${s.won}</td><td rowspan="2">${pct(s.won, s.lost)}</td></tr><tr><td>Lost</td><td class="fc-n">${s.lost}</td></tr>
        <tr><td colspan="3"><b>Streaks</b></td></tr>
        <tr><td>Wins</td><td class="fc-n">${s.bestW}</td><td></td></tr><tr><td>Losses</td><td class="fc-n">${s.bestL}</td><td></td></tr>
        <tr><td>Current</td><td class="fc-n">${Math.abs(s.cur)}</td><td>${s.cur > 0 ? (s.cur === 1 ? 'win' : 'wins') : s.cur < 0 ? (s.cur === -1 ? 'loss' : 'losses') : ''}</td></tr></table>`
    });
    if (r.button === 'Clear') {
      const b = await Arcade.dialog({ title: 'FreeCell', text: 'Clear all statistics?', icon: 'warn', buttons: ['Yes', 'No'] });
      if (b === 'Yes') { store.set('stats', {}); session.w = session.l = 0; }
    }
  }

  function showHelp() {
    C.modal({
      title: 'FreeCell Help', buttons: ['OK'],
      html: `<div class="c95-help">
        <p><b>Goal:</b> move all cards to the four home cells (top right), building each suit up from Ace to King.</p>
        <p><b>Columns:</b> build down in alternating colors. Any card can go into an empty column. The four free cells (top left) each hold one card.</p>
        <p><b>Moving:</b> click a card to select it, then click where it should go. You can also drag cards. Double-click a card to send it to a free cell (or home if it can go there).</p>
        <p><b>Multiple cards:</b> a run can move at once when there are enough free cells and empty columns: (free cells + 1) x 2 per empty column.</p>
        <p>Every deal is numbered; all 32,000 games are believed to be solvable except one. F2 new game, F3 select game, F10 or Ctrl+Z undo.</p></div>`
    });
  }

  Arcade.app({
    id: 'freecell', title: 'FreeCell', icon: ICON, width: 680, height: 'min(540px, calc(100dvh - 60px))', max: true, folder: 'Games', status: true, preview,
    hint: 'The numbered-deal patience game: 4 free cells, 32,000 games and a king who watches you play.',
    menus: [
      { label: 'Game', items: [
        { label: 'New Game', key: 'F2', action: () => api.newGame() },
        { label: 'Select Game…', key: 'F3', action: () => api.selectGame() },
        { label: 'Restart Game', disabled: () => !api.canRestart || !api.canRestart(), action: () => api.restart() },
        '-',
        { label: 'Statistics…', key: 'F4', action: showStats },
        { label: 'Options…', key: 'F5', action: showOptions },
        '-',
        { label: 'Undo', key: 'F10', disabled: () => !api.canUndo || !api.canUndo(), action: () => api.undo() },
        '-',
        { label: 'Exit', action: () => Arcade.apps.freecell.ctx.close() }
      ] },
      { label: 'Help', items: [
        { label: 'Help Topics', key: 'F1', action: showHelp },
        '-',
        { label: 'About FreeCell', action: () => Arcade.dialog({ title: 'About FreeCell', text: 'FreeCell for Arcade 95. Original implementation; deals follow the classic numbered games, so Game #1 is the Game #1 you remember.', icon: 'info' }) }
      ] }
    ],
    build(ctx) {
      ctx.body.innerHTML = '<div class="fc-felt" aria-label="FreeCell table"></div>';
      const host = ctx.body.firstChild;
      const S = C.surface(host, W, H, 1.7), g = S.g;
      let gameNo = 0, st = null, undoStack = [], sel = null, selClick = null, drag = null, busy = false, won = false, over = false, moved = false, raf = 0, look = -1;
      const flying = new Set();
      const beep = Arcade.beep;
      const sfx = {
        pick: () => beep(900, .03, 'square', .02),
        place: () => beep(240, .04, 'triangle', .06),
        home: () => { beep(700, .05, 'square', .025); beep(1050, .07, 'square', .025, 0, .04); },
        bad: () => beep(130, .14, 'square', .03),
        win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, .15, 'square', .03, 0, i * .1))
      };

      /* ---------- model ---------- */
      const top = p => p[p.length - 1];
      const fits = (c, t) => C.isRed(c) !== C.isRed(t) && c.r === t.r - 1;
      function runLen(col) { let n = col.length ? 1 : 0; for (let i = col.length - 1; i > 0 && fits(col[i], col[i - 1]); i--) n++; return n; }
      const freeCount = () => st.cells.filter(c => !c).length;
      const emptyCols = () => st.cols.filter(c => !c.length).length;
      function maxMove(toEmpty) { if (!opts.multi) return 1; return (freeCount() + 1) * 2 ** Math.max(0, emptyCols() - (toEmpty ? 1 : 0)); }
      function homeFor(c) {
        for (let i = 0; i < 4; i++) { const t = top(st.home[i]); if (t ? (t.s === c.s && c.r === t.r + 1) : c.r === 1) return i; }
        return -1;
      }
      const homeRank = s => { for (const h of st.home) if (h.length && h[0].s === s) return h.length; return 0; };
      function safeHome(c) {
        if (homeFor(c) < 0) return false;
        if (c.r <= 2) return true;
        const opp = C.isRed(c) ? [0, 3] : [1, 2];
        return homeRank(opp[0]) >= c.r - 1 && homeRank(opp[1]) >= c.r - 1;
      }
      const srcCards = (src, n) => src.t === 'cell' ? [st.cells[src.i]] : st.cols[src.i].slice(-n);
      const cardsLeft = () => 52 - st.home.reduce((a, h) => a + h.length, 0);

      const enc = c => c ? [c.s, c.r] : null, dec = a => a ? { s: a[0], r: a[1], up: true } : null;
      function pushUndo() { undoStack.push({ cells: st.cells.map(enc), home: st.home.map(h => h.map(enc)), cols: st.cols.map(c => c.map(enc)) }); if (undoStack.length > 500) undoStack.shift(); }
      function undo() {
        if (busy || won || !undoStack.length) return;
        const u = undoStack.pop();
        st = { cells: u.cells.map(dec), home: u.home.map(h => h.map(dec)), cols: u.cols.map(c => c.map(dec)) };
        over = false; sel = null; drag = null; flying.clear(); render(); status();
      }

      function fly(c, x0, y0, dur, delay = 0) { if (opts.quick) return; c.fly = { x0, y0, t0: performance.now() + delay, dur }; flying.add(c); }

      /* move n cards from src ({t:'col'|'cell', i}) to dst ({t:'col'|'cell'|'home', i}); legality already checked */
      function move(src, n, dst, anim = true) {
        pushUndo();
        let cards;
        if (src.t === 'cell') { cards = [st.cells[src.i]]; st.cells[src.i] = null; } else cards = st.cols[src.i].splice(-n, n);
        if (anim) cards.forEach((c, k) => fly(c, c._x, c._y, 200, k * 30));
        if (dst.t === 'cell') st.cells[dst.i] = cards[0];
        else if (dst.t === 'home') st.home[dst.i].push(cards[0]);
        else st.cols[dst.i].push(...cards);
        moved = true; sel = null;
        (dst.t === 'home' ? sfx.home : sfx.place)();
        render(); status(); settle();
      }
      /* auto-move safe cards home one at a time, then check for a win or a dead end */
      function settle() {
        busy = true;
        const step = () => {
          let found = null;
          for (let i = 0; i < 4 && !found; i++) { const c = st.cells[i]; if (c && safeHome(c)) found = { src: { t: 'cell', i }, c }; }
          for (let i = 0; i < 8 && !found; i++) { const c = top(st.cols[i]); if (c && safeHome(c)) found = { src: { t: 'col', i }, c }; }
          if (found) {
            const h = homeFor(found.c);
            if (found.src.t === 'cell') st.cells[found.src.i] = null; else st.cols[found.src.i].pop();
            fly(found.c, found.c._x, found.c._y, 160);
            st.home[h].push(found.c); sfx.home(); render(); status();
            setTimeout(step, opts.quick ? 0 : 90);
            return;
          }
          busy = false; render();
          if (!cardsLeft()) return win();
          if (!anyMove()) lose();
        };
        setTimeout(step, opts.quick ? 0 : 140);
      }
      function anyMove() {
        if (freeCount() || emptyCols()) return true;
        const movers = [...st.cells, ...st.cols.map(top)].filter(Boolean);
        return movers.some(c => homeFor(c) >= 0 || st.cols.some(col => col.length && fits(c, top(col))));
      }

      /* ---------- game lifecycle ---------- */
      function recordLoss() {
        if (!moved || won || over === 'counted') return;
        const s = getStats(); s.lost++; s.cur = s.cur < 0 ? s.cur - 1 : -1; s.bestL = Math.max(s.bestL, -s.cur); store.set('stats', s); session.l++;
        over = 'counted';
      }
      async function confirmResign() {
        if (!moved || won || over || busy) return true;
        const b = await Arcade.dialog({ title: 'FreeCell', text: 'Do you want to resign this game?', icon: 'warn', buttons: ['Yes', 'No'] });
        if (b !== 'Yes') return false;
        recordLoss(); return true;
      }
      function start(n) {
        gameNo = n;
        const cols = C.msDeal(n);
        st = { cells: [null, null, null, null], home: [[], [], [], []], cols };
        undoStack = []; sel = null; drag = null; won = false; over = false; moved = false; busy = false; flying.clear();
        ctx.setTitle('FreeCell Game #' + n);
        layout();
        if (!opts.quick) { let k = 0; for (let r = 0; r < 7; r++) for (let i = 0; i < 8; i++) { const c = cols[i][r]; if (c) fly(c, W / 2 - CW / 2, H + 40, 220, k++ * 12); } }
        render(); status();
      }
      async function newGame(n) { if (!(await confirmResign())) return; start(n || 1 + Math.floor(Math.random() * 32000)); }
      async function selectGame() {
        const v = await Arcade.dialog({ title: 'Game Number', text: 'Select a game number from 1 to 32000:', icon: 'info', input: String(1 + Math.floor(Math.random() * 32000)), buttons: ['OK', 'Cancel'] });
        if (v == null) return;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 32000) { await Arcade.dialog({ title: 'FreeCell', text: 'Please choose a game number between 1 and 32000.', icon: 'warn' }); return; }
        newGame(n);
      }
      function restart() { if (gameNo && !busy) start(gameNo); }
      function win() {
        if (won) return;
        won = true; sel = null;
        const s = getStats(); s.won++; s.cur = s.cur > 0 ? s.cur + 1 : 1; s.bestW = Math.max(s.bestW, s.cur); store.set('stats', s); session.w++;
        sfx.win(); render(); status();
        setTimeout(async () => {
          const b = await Arcade.dialog({ title: 'Game Over', text: 'Congratulations, you win! Do you want to play again?', icon: 'trophy', buttons: ['Yes', 'No'] });
          if (b === 'Yes' && won) start(1 + Math.floor(Math.random() * 32000));
        }, 700);
      }
      async function lose() {
        if (over) return;
        over = true; recordLoss(); sfx.bad();
        const b = await Arcade.dialog({ title: 'Game Over', text: 'Sorry, you lose. There are no more legal moves.', icon: 'info', buttons: ['New Game', 'Same Game', 'Close'] });
        if (b === 'New Game') start(1 + Math.floor(Math.random() * 32000)); else if (b === 'Same Game') start(gameNo);
      }

      /* ---------- move attempts (from clicks and drops) ---------- */
      async function illegal(text = 'That move is not allowed.') {
        sel = null; render(); sfx.bad();
        if (opts.msgs) await Arcade.dialog({ title: 'FreeCell', text, icon: 'info' });
      }
      /* returns true if a move happened; quiet=true for drags (no message box) */
      async function tryMove(src, dst, forceN, quiet) {
        const fail = t => { if (quiet) { sfx.bad(); return false; } illegal(t); return false; };
        const run = src.t === 'cell' ? 1 : runLen(st.cols[src.i]);
        const c1 = srcCards(src, 1)[0];
        if (dst.t === 'cell') {
          if (forceN > 1) return fail();
          if (st.cells[dst.i]) return fail();
          move(src, 1, dst); return true;
        }
        if (dst.t === 'home') {
          if (forceN > 1) return fail();
          const h = homeFor(c1); if (h < 0) return fail();
          move(src, 1, { t: 'home', i: h }); return true;
        }
        const col = st.cols[dst.i];
        if (src.t === 'col' && src.i === dst.i) return false;
        if (!col.length) {
          const max = maxMove(true);
          let n = forceN || 1;
          if (!forceN && src.t === 'col' && run > 1 && max > 1) {
            const b = await Arcade.dialog({ title: 'Move to Empty Column…', text: 'Move the whole column, or just the single card?', icon: 'info', buttons: ['Move column', 'Move single card', 'Cancel'] });
            if (b == null || b === 'Cancel') { sel = null; render(); return false; }
            n = b === 'Move column' ? Math.min(run, max) : 1;
          }
          if (n > max) return fail(`That move needs more free space: you can move ${max} card${max > 1 ? 's' : ''} into an empty column.`);
          move(src, n, dst); return true;
        }
        const t = top(col);
        if (forceN) {
          const head = srcCards(src, forceN)[0];
          if (!fits(head, t)) return fail();
          const max = maxMove(false);
          if (forceN > max) return fail(`That move needs more free space: you can move ${max} card${max > 1 ? 's' : ''} at once.`);
          move(src, forceN, dst); return true;
        }
        const srcCol = src.t === 'cell' ? [st.cells[src.i]] : st.cols[src.i];
        for (let m = 1; m <= run; m++) {
          if (fits(srcCol[srcCol.length - m], t)) {
            const max = maxMove(false);
            if (m > max) return fail(`That move needs more free space: you can move ${max} card${max > 1 ? 's' : ''} at once.`);
            move(src, m, dst); return true;
          }
        }
        return fail();
      }

      /* ---------- layout + paint ---------- */
      function layout() {
        st.cells.forEach((c, i) => { if (c) { c._x = cellX(i); c._y = CELLY; } });
        st.home.forEach((h, i) => h.forEach(c => { c._x = homeX(i); c._y = CELLY; }));
        const avail = S.vy1 - COLY - CH - 4;
        st.cols.forEach((col, i) => {
          const off = col.length > 1 ? Math.max(6, Math.min(19, avail / (col.length - 1))) : 19;
          col.forEach((c, j) => { c._x = colX(i); c._y = COLY + j * off; });
        });
      }
      function cellBox(x, y) {
        const X = S.X(x), Y = S.Y(y), w = S.D(CW), h = S.D(CH), lw = Math.max(1, Math.round(S.dpr));
        g.fillStyle = '#000'; g.fillRect(X, Y, w, lw); g.fillRect(X, Y, lw, h);
        g.fillStyle = '#5fdf5f'; g.fillRect(X, Y + h - lw, w, lw); g.fillRect(X + w - lw, Y, lw, h);
      }
      function invert(x, y) {
        g.save(); g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff';
        C.rrect(g, S.X(x), S.Y(y), S.D(CW), S.D(CH), S.D(3.5)); g.fill(); g.restore();
      }
      const ease = k => 1 - (1 - k) * (1 - k);
      function paint() {
        layout();
        const now = performance.now();
        S.fill(FELT);
        const draw = c => { if (!c.fly && !c.dragging) S.card(c, c._x, c._y); };
        for (let i = 0; i < 4; i++) { cellBox(cellX(i), CELLY); if (st.cells[i]) draw(st.cells[i]); }
        for (let i = 0; i < 4; i++) { cellBox(homeX(i), CELLY); const h = st.home[i]; for (let j = Math.max(0, h.length - 3); j < h.length; j++) draw(h[j]); }
        const ps = S.D(3);
        king(g, S.X(KX) - 7 * ps, S.Y(KY) - 7 * ps, ps, look, won);
        st.cols.forEach(col => col.forEach(draw));
        if (sel && !drag) {
          const c = sel.t === 'cell' ? st.cells[sel.i] : top(st.cols[sel.i]);
          if (c && !c.fly) invert(c._x, c._y);
        }
        for (const c of flying) {
          const k = Math.min(1, Math.max(0, (now - c.fly.t0) / c.fly.dur)), e = ease(k);
          S.card(c, c.fly.x0 + (c._x - c.fly.x0) * e, c.fly.y0 + (c._y - c.fly.y0) * e);
          if (k >= 1) { delete c.fly; flying.delete(c); }
        }
        if (drag) { const c0 = drag.cards[0]; drag.cards.forEach(c => S.card(c, drag.x, drag.y + (c._y - c0._y))); }
        if (flying.size && !raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
      }
      function render() { if (st) paint(); }
      function status() { if (st) ctx.status(gameNo ? 'Game #' + gameNo : '', 'Cards Left: ' + cardsLeft()); }

      /* ---------- input ---------- */
      function hit(p) {
        if (p.y >= CELLY && p.y < CELLY + CH) {
          for (let i = 0; i < 4; i++) if (p.x >= cellX(i) && p.x < cellX(i) + CW) return { t: 'cell', i };
          for (let i = 0; i < 4; i++) if (p.x >= homeX(i) && p.x < homeX(i) + CW) return { t: 'home', i };
          return null;
        }
        if (p.y >= COLY - 6) for (let i = 0; i < 8; i++) if (p.x >= colX(i) - 4 && p.x < colX(i) + CW + 4) return { t: 'col', i };
        return null;
      }
      const same = (a, b) => a && b && a.t === b.t && a.i === b.i;
      function setLook(x) { const d = x < KX ? -1 : 1; if (d !== look) { look = d; render(); } }

      C.input(S, {
        hover(p) { setLook(p.x); },
        down(p) {
          setLook(p.x);
          if (busy || won || !st) return null;
          const h = hit(p); if (!h) return null;
          if (h.t === 'cell' && st.cells[h.i] && !st.cells[h.i].fly) return { src: h, n: 1 };
          if (h.t === 'col') {
            const col = st.cols[h.i]; if (!col.length) return null;
            let idx = -1; for (let j = col.length - 1; j >= 0; j--) if (p.y >= col[j]._y && p.y < col[j]._y + CH) { idx = j; break; }
            if (idx < 0 || col[idx].fly) return null;
            const n = col.length - idx;
            if (n > runLen(col)) return null;
            return { src: h, n };
          }
          return null;
        },
        dragStart(gr, p0) {
          sel = null;
          const cards = srcCards(gr.src, gr.n), c0 = cards[0];
          drag = { cards, src: gr.src, x: c0._x, y: c0._y, dx: p0.x - c0._x, dy: p0.y - c0._y };
          cards.forEach(c => { c.dragging = true; }); sfx.pick();
        },
        drag(p) { if (!drag) return; drag.x = p.x - drag.dx; drag.y = p.y - drag.dy; render(); },
        async drop(p, gr, cancel) {
          const d = drag; drag = null; if (!d) return;
          d.cards.forEach(c => { c.dragging = false; });
          let dst = cancel ? null : hit({ x: d.x + CW / 2, y: d.y + 20 }) || hit(p);
          if (dst && dst.t === 'col' && d.src.t === 'col' && dst.i === d.src.i) dst = null;
          const ok = dst ? await tryMove(d.src, dst, d.cards.length, true) : false;
          if (!ok) { const c0 = d.cards[0]; d.cards.forEach(c => fly(c, d.x, d.y + (c._y - c0._y), 170)); render(); }
        },
        click(p) {
          selClick = null;
          if (busy || won || !st) return;
          const h = hit(p);
          if (!sel) {
            if (h && ((h.t === 'col' && st.cols[h.i].length) || (h.t === 'cell' && st.cells[h.i]))) { sel = h; selClick = h; sfx.pick(); render(); }
            return;
          }
          if (!h) return;
          if (same(h, sel)) { sel = null; render(); return; }
          const src = sel; sel = null;
          tryMove(src, h, 0, false);
        },
        dbl(p) {
          if (busy || won || !st) return;
          const h = hit(p);
          if (!same(h, selClick)) return this.click(p);
          sel = null; selClick = null;
          const c = h.t === 'cell' ? st.cells[h.i] : top(st.cols[h.i]); if (!c) return;
          const hm = homeFor(c);
          if (hm >= 0) return move(h, 1, { t: 'home', i: hm });
          if (h.t === 'col') { const fc = st.cells.findIndex(x => !x); if (fc >= 0) return move(h, 1, { t: 'cell', i: fc }); }
          illegal();
        },
        context() { if (sel) { sel = null; render(); } }
      });

      ctx.onKey(e => {
        const k = e.key;
        if (k === 'F2') { e.preventDefault(); newGame(); }
        else if (k === 'F3') { e.preventDefault(); selectGame(); }
        else if (k === 'F4') { e.preventDefault(); showStats(); }
        else if (k === 'F5') { e.preventDefault(); showOptions(); }
        else if (k === 'F1') { e.preventDefault(); showHelp(); }
        else if (k === 'F10' || ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z')) { e.preventDefault(); undo(); }
        else if (k === 'Escape' && sel) { sel = null; render(); }
      });

      new ResizeObserver(() => { if (S.fit()) render(); }).observe(host);
      ctx.on('open', () => { S.fit(); render(); });
      ctx.on('close', () => { recordLoss(); if (moved && !won) start(gameNo); });

      Object.assign(api, {
        newGame, selectGame, restart, undo,
        canUndo: () => !!undoStack.length && !busy && !won, canRestart: () => !!gameNo && !busy
      });
      /* test hooks for tools/smoke.mjs */
      Arcade.apps.freecell.test = {
        state: () => st, gameNo: () => gameNo, start, tryMove, move, hit, S, runLen, maxMove, anyMove, isWon: () => won, isBusy: () => busy, sel: () => sel,
        opts: () => opts, layout
      };

      start(1 + Math.floor(Math.random() * 32000));
    }
  });
})();

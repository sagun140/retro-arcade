/* Solitaire: Klondike in the style of Windows 95 Solitaire (Draw One/Three, Standard/Vegas scoring, bouncing-card win cascade). */
(() => {
  const C = window.Cards95, CW = C.CW, CH = C.CH;
  const FELT = '#008000';
  const W = 585, H = 330;                       // design units; card is 71x96
  const COLX = i => 11 + i * 82, TOPY = 8, TABY = 120;
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="2" width="9" height="12" fill="#000"/><rect x="1" y="3" width="7" height="10" fill="#1d3fa8"/><rect x="2" y="4" width="1" height="1" fill="#6f8fe8"/><rect x="4" y="6" width="1" height="1" fill="#6f8fe8"/><rect x="2" y="8" width="1" height="1" fill="#6f8fe8"/><rect x="4" y="10" width="1" height="1" fill="#6f8fe8"/><rect x="6" y="1" width="10" height="13" fill="#000"/><rect x="7" y="2" width="8" height="11" fill="#fff"/><rect x="8" y="5" width="2" height="1" fill="#d01c1c"/><rect x="11" y="5" width="2" height="1" fill="#d01c1c"/><rect x="8" y="6" width="5" height="2" fill="#d01c1c"/><rect x="9" y="8" width="3" height="1" fill="#d01c1c"/><rect x="10" y="9" width="1" height="1" fill="#d01c1c"/><rect x="0" y="14" width="16" height="2" fill="#008000"/></svg>';
  const store = { get: (k, d) => Arcade.store.get('solitaire.' + k, d), set: (k, v) => Arcade.store.set('solitaire.' + k, v) };
  const DEF = { draw: 1, scoring: 'standard', timed: true, status: true, outline: false, keep: false };
  let opts = Object.assign({}, DEF, store.get('opts', {}));
  const getStats = () => Object.assign({ played: 0, won: 0, best: 0, bestTime: 0, vegasBest: null }, store.get('stats', {}));
  const api = {};
  const money = v => (v < 0 ? '-$' : '$') + Math.abs(v);

  Arcade.css(`
    .sol-felt { position: relative; flex: 1; min-height: 180px; background: ${FELT}; overflow: hidden; touch-action: none; }
  `);

  Arcade.scores.add({
    game: 'Solitaire',
    render() {
      const s = getStats();
      return '<tr><th>Solitaire</th><th>Record</th></tr>' +
        `<tr><td>Games won</td><td class="num">${s.won} / ${s.played}</td></tr>` +
        `<tr><td>Best score (Standard)</td><td class="num">${s.best || '-'}</td></tr>` +
        `<tr><td>Fastest win</td><td class="num">${s.bestTime ? s.bestTime + ' s' : '-'}</td></tr>` +
        `<tr><td>Best Vegas game</td><td class="num">${s.vegasBest == null ? '-' : money(s.vegasBest)}</td></tr>`;
    }
  });

  /* hover-card preview: the famous bouncing cascade, trails accumulate on the thumbnail canvas */
  let pv = null;
  function preview(g, w, h, t) {
    if (!pv || t < pv.t) { pv = { t: 0, cur: null, n: 0 }; g.fillStyle = FELT; g.fillRect(0, 0, w, h); }
    pv.t = t;
    const cw = 24, ch = 32, fx = i => w - 6 - (4 - i) * (cw + 4);
    for (let k = 0; k < 2; k++) {
      if (!pv.cur) {
        if (pv.n && pv.n % 10 === 0) { g.fillStyle = FELT; g.fillRect(0, 0, w, h); }
        const f = pv.n % 4, r = 13 - Math.floor(pv.n / 4) % 13;
        for (let i = 0; i < 4; i++) g.drawImage(C.image({ s: i, r: i < f ? Math.max(1, r - 1) : r, up: true }, cw, ch), fx(i), 4);
        pv.cur = { c: { s: f, r, up: true }, x: fx(f), y: 4, vx: -(1.4 + Math.random() * 2.2), vy: -Math.random() * 2.5 };
        pv.n++;
      }
      const q = pv.cur; q.x += q.vx; q.vy += .32; q.y += q.vy;
      if (q.y > h - ch) { q.y = h - ch; q.vy = -q.vy * .8; }
      g.drawImage(C.image(q.c, cw, ch), Math.round(q.x), Math.round(q.y));
      if (q.x < -cw) pv.cur = null;
    }
  }

  async function showOptions() {
    const r = await C.modal({
      title: 'Options', buttons: ['OK', 'Cancel'],
      html: `<div class="c95-row">
        <fieldset class="groupbox"><legend>Draw</legend>
          <label><input type="radio" name="sol-draw" value="1"> Draw One</label>
          <label><input type="radio" name="sol-draw" value="3"> Draw Three</label></fieldset>
        <fieldset class="groupbox"><legend>Scoring</legend>
          <label><input type="radio" name="sol-sc" value="standard"> Standard</label>
          <label><input type="radio" name="sol-sc" value="vegas"> Vegas</label>
          <label><input type="radio" name="sol-sc" value="none"> None</label></fieldset></div>
        <div class="c95-row"><div>
          <label><input type="checkbox" data-o="timed"> Timed game</label>
          <label><input type="checkbox" data-o="status"> Status bar</label></div><div>
          <label><input type="checkbox" data-o="outline"> Outline dragging</label>
          <label><input type="checkbox" data-o="keep"> Keep score</label></div></div>`,
      init(el) {
        el.querySelector(`[name="sol-draw"][value="${opts.draw}"]`).checked = true;
        el.querySelector(`[name="sol-sc"][value="${opts.scoring}"]`).checked = true;
        el.querySelectorAll('[data-o]').forEach(i => { i.checked = !!opts[i.dataset.o]; });
        const keep = el.querySelector('[data-o="keep"]');
        const sync = () => { keep.disabled = el.querySelector('[name="sol-sc"]:checked').value !== 'vegas'; };
        el.querySelectorAll('[name="sol-sc"]').forEach(i => i.addEventListener('change', sync)); sync();
      }
    });
    if (r.button !== 'OK') return;
    const el = r.el, next = Object.assign({}, opts);
    next.draw = +el.querySelector('[name="sol-draw"]:checked').value;
    next.scoring = el.querySelector('[name="sol-sc"]:checked').value;
    el.querySelectorAll('[data-o]').forEach(i => { next[i.dataset.o] = i.checked; });
    const redeal = next.draw !== opts.draw || next.scoring !== opts.scoring || (next.keep !== opts.keep && next.scoring === 'vegas');
    opts = next; store.set('opts', opts);
    api.applyOptions(redeal);
  }

  function showHelp() {
    C.modal({
      title: 'Solitaire Help', buttons: ['OK'],
      html: `<div class="c95-help">
        <p><b>Goal:</b> build all four suits up from Ace to King on the four foundations at the top right.</p>
        <p><b>Tableau:</b> stack cards down in alternating colors (red on black). Only a King can fill an empty pile. Drag a face-up card to move it and every card on top of it.</p>
        <p><b>Deck:</b> click the deck to turn cards over (one or three at a time). Click the empty space to turn the deck over again.</p>
        <p><b>Shortcuts:</b> double-click a card to send it to a foundation. Right-click the table to play every card that can go up. F2 deals, Ctrl+Z undoes.</p>
        <p><b>Standard scoring:</b> +10 per card to a foundation, +5 waste to tableau, +5 for turning a card, -15 foundation to tableau, -2 every 10 s when timed, plus a time bonus for a win. <b>Vegas:</b> you pay $52 a game and win $5 per card.</p></div>`
    });
  }

  Arcade.app({
    id: 'solitaire', title: 'Solitaire', icon: ICON, width: 640, height: 'min(540px, calc(100dvh - 60px))', max: true, folder: 'Games', status: true, preview,
    hint: 'Klondike, Windows 95 style: Draw One or Three, Vegas scoring, and the bouncing-card finale.',
    menus: [
      { label: 'Game', items: [
        { label: 'Deal', key: 'F2', action: () => api.deal() },
        '-',
        { label: 'Undo', key: 'Ctrl+Z', disabled: () => !api.canUndo || !api.canUndo(), action: () => api.undo() },
        { label: 'Deck…', action: async () => { if (await C.pickBack()) api.render(); } },
        { label: 'Options…', action: showOptions },
        '-',
        { label: 'Exit', action: () => Arcade.apps.solitaire.ctx.close() }
      ] },
      { label: 'Help', items: [
        { label: 'Help Topics', key: 'F1', action: showHelp },
        '-',
        { label: 'About Solitaire', action: () => Arcade.dialog({ title: 'About Solitaire', text: 'Solitaire for Arcade 95. An original Klondike with Windows 95 rules, scoring and the bouncing-card finale.', icon: 'info' }) }
      ] }
    ],
    build(ctx) {
      ctx.body.innerHTML = '<div class="sol-felt" aria-label="Solitaire table"></div>';
      const host = ctx.body.firstChild;
      const S = C.surface(host, W, H, 1.7), g = S.g;
      let st = null, undoStack = [], drag = null, busy = false, won = false, casc = null, raf = 0, time = 0, started = false, msg = '';
      const flying = new Set();
      const std = () => opts.scoring === 'standard', veg = () => opts.scoring === 'vegas';
      const beep = Arcade.beep;
      const sfx = {
        flip: () => beep(1400, .025, 'square', .02),
        place: () => beep(220, .04, 'triangle', .06),
        found: () => { beep(660, .05, 'square', .025); beep(990, .07, 'square', .025, 0, .04); },
        bad: () => beep(140, .12, 'square', .03),
        win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .16, 'square', .03, 0, i * .1))
      };

      /* ---------- model ---------- */
      const pile = ref => ref.t === 's' ? st.stock : ref.t === 'w' ? st.waste : ref.t === 'f' ? st.found[ref.i] : st.tab[ref.i];
      const top = p => p[p.length - 1];
      function canFound(c, f) { const p = st.found[f]; if (!p.length) return c.r === 1; const t = top(p); return t.s === c.s && c.r === t.r + 1; }
      function canTab(c, t) { const p = st.tab[t]; if (!p.length) return c.r === 13; const tp = top(p); return tp.up && C.isRed(tp) !== C.isRed(c) && c.r === tp.r - 1; }
      function canRecycle() { return veg() ? (opts.draw === 3 && st.passes < 2) : true; }
      function addScore(v) {
        if (!v || opts.scoring === 'none') return;
        st.score += v; if (std()) st.score = Math.max(0, st.score);
        if (veg() && opts.keep) store.set('vegas', st.score);
      }
      const enc = p => p.map(c => [c.s, c.r, c.up ? 1 : 0]);
      const dec = a => a.map(([s, r, u]) => ({ s, r, up: !!u }));
      function pushUndo() {
        undoStack.push({ stock: enc(st.stock), waste: enc(st.waste), found: st.found.map(enc), tab: st.tab.map(enc), score: st.score, passes: st.passes, fan: st.fan });
        if (undoStack.length > 300) undoStack.shift();
      }
      function undo() {
        if (busy || won || !undoStack.length) return;
        const u = undoStack.pop();
        st = { stock: dec(u.stock), waste: dec(u.waste), found: u.found.map(dec), tab: u.tab.map(dec), score: u.score, passes: u.passes, fan: u.fan };
        if (veg() && opts.keep) store.set('vegas', st.score);
        flying.clear(); drag = null; msg = ''; render(); status();
      }

      function deal(seed) {
        stopCascade(); busy = false; won = false; drag = null; flying.clear(); msg = '';
        const d = C.shuffle(C.deck(), seed);
        let score = 0;
        if (veg()) { score = (opts.keep ? store.get('vegas', 0) : 0) - 52; if (opts.keep) store.set('vegas', score); }
        st = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], score, passes: 0, fan: 0 };
        for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) { const c = d.pop(); c.up = j === i; st.tab[j].push(c); }
        d.forEach(c => { c.up = false; }); st.stock = d;
        undoStack = []; time = 0; started = false;
        layout();
        const sx = COLX(0), sy = TOPY; let n = 0;
        for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) fly(st.tab[j][i], sx, sy, 170, n++ * 22);
        render(); status();
      }

      function startClock() {
        if (started) return; started = true;
        const s = getStats(); s.played++; store.set('stats', s);
      }

      function fly(c, x0, y0, dur, delay = 0) { c.fly = { x0, y0, t0: performance.now() + delay, dur }; flying.add(c); }

      function doMove(src, n, dst, anim) {
        pushUndo();
        const sp = pile(src), dp = pile(dst), cards = sp.splice(sp.length - n, n);
        if (anim) cards.forEach(c => fly(c, c._x, c._y, 190));
        dp.push(...cards);
        if (dst.t === 'f' && src.t !== 'f') addScore(std() ? 10 : 5);
        if (src.t === 'w' && dst.t === 't' && std()) addScore(5);
        if (src.t === 'f' && dst.t === 't') addScore(std() ? -15 : -5);
        if (src.t === 'w') st.fan = Math.max(1, st.fan - 1);
        if (src.t === 't') { const t = top(sp); if (t && !t.up) { t.up = true; if (std()) addScore(5); } }
        (dst.t === 'f' ? sfx.found : sfx.place)();
        startClock(); after();
      }
      function after() {
        render(); status();
        if (st.found.every(p => p.length === 13)) win();
        else if (!busy && !st.stock.length && !st.waste.length && st.tab.every(p => p.every(c => c.up))) autoplay(true);
      }
      function clickStock() {
        if (st.stock.length) {
          pushUndo();
          const n = Math.min(opts.draw, st.stock.length), t = top(st.stock), x0 = t._x, y0 = t._y;
          for (let i = 0; i < n; i++) { const c = st.stock.pop(); c.up = true; fly(c, x0, y0, 130, i * 45); st.waste.push(c); }
          st.fan = n; sfx.flip(); startClock(); render(); status();
        } else if (st.waste.length) {
          if (!canRecycle()) { sfx.bad(); return; }
          pushUndo();
          st.stock = st.waste.reverse(); st.stock.forEach(c => { c.up = false; }); st.waste = []; st.passes++; st.fan = 0;
          if (std()) addScore(opts.draw === 1 ? -100 : st.passes >= 3 ? -20 : 0);
          beep(500, .08, 'triangle', .04, -200); render(); status();
        }
      }
      function toFoundation(src) {
        const c = top(pile(src)); if (!c || !c.up) return false;
        for (let f = 0; f < 4; f++) if (canFound(c, f)) { doMove(src, 1, { t: 'f', i: f }, true); return true; }
        return false;
      }
      function findFoundationMove() {
        let best = null;
        const tryIt = src => { const c = top(pile(src)); if (!c || !c.up || c.fly) return; for (let f = 0; f < 4; f++) if (canFound(c, f) && (!best || c.r < best.c.r)) best = { c, src, dst: { t: 'f', i: f } }; };
        tryIt({ t: 'w' }); for (let i = 0; i < 7; i++) tryIt({ t: 't', i });
        return best;
      }
      /* finish=true: auto-complete a solved board; false: right-click "play everything that can go up" */
      function autoplay(finish) {
        if (busy || won) return;
        busy = true; msg = finish ? 'Auto-completing…' : ''; status();
        const step = () => {
          if (!busy || won) return;
          const m = findFoundationMove();
          if (!m) { busy = false; msg = ''; status(); return; }
          doMove(m.src, 1, m.dst, true); if (won) return;
          setTimeout(step, finish ? 75 : 110);
        };
        step();
      }

      /* ---------- layout + paint ---------- */
      function stockLayers() { return Math.min(3, Math.ceil(st.stock.length / 8)); }
      function layout() {
        const so = Math.max(0, stockLayers() - 1) * 2;
        st.stock.forEach(c => { c._x = COLX(0) + so; c._y = TOPY + so; });
        const n = st.waste.length, fan = opts.draw === 3 ? Math.min(Math.max(st.fan, 1), 3, n) : 1;
        st.waste.forEach((c, i) => { const j = i - (n - fan); c._x = COLX(1) + (j > 0 ? j * 15 : 0); c._y = TOPY; });
        st.found.forEach((p, f) => p.forEach(c => { c._x = COLX(3 + f); c._y = TOPY; }));
        const avail = S.vy1 - TABY - CH - 4;
        st.tab.forEach((p, i) => {
          let down = 0, up = 0; p.forEach(c => { if (c.up) up++; else down++; });
          let dOff = 4, uOff = 16;
          if (down * dOff + Math.max(0, up - 1) * uOff > avail && up > 1) uOff = Math.max(6, (avail - down * dOff) / (up - 1));
          let y = TABY; p.forEach(c => { c._x = COLX(i); c._y = y; y += c.up ? uOff : dOff; });
        });
      }
      function slot(x, y) {
        const X = S.X(x) + .5, Y = S.Y(y) + .5, w = S.D(CW) - 1, h = S.D(CH) - 1, r = S.D(3.5);
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(0,0,0,.6)'; C.rrect(g, X, Y, w, h, r); g.stroke();
        g.strokeStyle = 'rgba(140,255,140,.35)'; C.rrect(g, X + 1, Y + 1, w - 2, h - 2, r); g.stroke();
      }
      function stockSymbol() {
        const cx = S.X(COLX(0) + CW / 2), cy = S.Y(TOPY + CH / 2), r = S.D(15);
        g.strokeStyle = '#3fdc3f'; g.lineWidth = Math.max(2, S.D(5)); g.lineCap = 'round';
        g.beginPath();
        if (canRecycle()) g.arc(cx, cy, r, 0, Math.PI * 2);
        else { g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); }
        g.stroke(); g.lineCap = 'butt';
      }
      const ease = k => 1 - (1 - k) * (1 - k);
      function paint() {
        layout();
        const now = performance.now();
        S.fill(FELT);
        const draw = c => { if (!c.fly && !c.dragging) S.card(c, c._x, c._y); };
        slot(COLX(0), TOPY);
        if (!st.stock.length) stockSymbol();
        else for (let j = 0; j < stockLayers(); j++) S.card({ up: false }, COLX(0) + j * 2, TOPY + j * 2);
        if (!st.waste.length || st.waste.every(c => c.fly || c.dragging)) slot(COLX(1), TOPY);
        for (let i = Math.max(0, st.waste.length - 5); i < st.waste.length; i++) draw(st.waste[i]);
        st.found.forEach((p, f) => { slot(COLX(3 + f), TOPY); for (let i = Math.max(0, p.length - 3); i < p.length; i++) draw(p[i]); });
        st.tab.forEach((p, i) => { if (!p.length || p[0].dragging || p[0].fly) slot(COLX(i), TABY); p.forEach(draw); });
        for (const c of flying) {
          const k = Math.min(1, Math.max(0, (now - c.fly.t0) / c.fly.dur)), e = ease(k);
          S.card(c, c.fly.x0 + (c._x - c.fly.x0) * e, c.fly.y0 + (c._y - c.fly.y0) * e);
          if (k >= 1) { delete c.fly; flying.delete(c); }
        }
        if (drag) {
          const c0 = drag.cards[0];
          drag.cards.forEach(c => {
            const x = drag.x, y = drag.y + (c._y - c0._y);
            if (opts.outline) { g.strokeStyle = '#000'; g.lineWidth = Math.max(1, S.D(1.5)); g.setLineDash([S.D(3), S.D(3)]); C.rrect(g, S.X(x) + .5, S.Y(y) + .5, S.D(CW), S.D(CH), S.D(3.5)); g.stroke(); g.setLineDash([]); }
            else S.card(c, x, y);
          });
        }
        if (flying.size && !raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
      }
      function render() { if (!st || casc) return; paint(); }
      function status() {
        if (!st) return;
        const cells = [msg];
        if (opts.scoring !== 'none') cells.push('Score: ' + (veg() ? money(st.score) : st.score));
        if (opts.timed) cells.push('Time: ' + time);
        ctx.status(...cells);
      }
      function applyStatusBar() { const sb = ctx.win.querySelector('.statusbar'); if (sb) sb.hidden = !opts.status; }

      /* ---------- win + cascade ---------- */
      function win() {
        if (won) return;
        won = true; busy = false;
        let bonus = 0;
        if (std() && opts.timed && time >= 30) bonus = Math.round(700000 / time);
        st.score += bonus;
        const s = getStats(); s.won++;
        if (std()) s.best = Math.max(s.best || 0, st.score);
        if (opts.timed && time > 0 && (!s.bestTime || time < s.bestTime)) s.bestTime = time;
        if (veg()) { s.vegasBest = s.vegasBest == null ? st.score : Math.max(s.vegasBest, st.score); if (opts.keep) store.set('vegas', st.score); }
        store.set('stats', s);
        msg = bonus ? 'Bonus: ' + bonus : 'You win!'; status();
        sfx.win();
        setTimeout(startCascade, 420);
      }
      function startCascade() {
        if (!won || casc || !st) return;
        flying.clear(); paint();
        const piles = st.found.map(p => p.slice()), order = [];
        for (let r = 13; r >= 1; r--) for (let f = 0; f < 4; f++) order.push(f);
        casc = { piles, order, i: 0, cur: null, raf: 0, ended: false };
        const step = () => {
          if (!casc) return;
          casc.raf = requestAnimationFrame(step);
          if (!ctx.isVisible()) return;
          for (let k = 0; k < 3; k++) {
            if (!casc.cur) {
              if (casc.i >= casc.order.length) { endCascade(); return; }
              const f = casc.order[casc.i++], p = casc.piles[f], c = p.pop(), x = COLX(3 + f);
              g.fillStyle = FELT; g.fillRect(S.X(x) - 1, S.Y(TOPY) - 1, S.D(CW) + 2, S.D(CH) + 2);
              if (p.length) S.card(top(p), x, TOPY); else slot(x, TOPY);
              const r = Math.random;
              casc.cur = { c, x, y: TOPY, vx: (r() < .5 ? -1 : 1) * (3.6 + r() * 4.8), vy: -r() * 6 };
            }
            const q = casc.cur;
            q.x += q.vx; q.vy += .45; q.y += q.vy;
            const floor = S.vy1 - CH;
            if (q.y > floor) { q.y = floor; q.vy = -q.vy * .8; }
            S.card(q.c, q.x, q.y);
            if (q.x < S.vx0 - CW || q.x > S.vx1) casc.cur = null;
          }
        };
        casc.raf = requestAnimationFrame(step);
      }
      function stopCascade() { if (casc) { cancelAnimationFrame(casc.raf); casc = null; } }
      async function endCascade() {
        if (!casc || casc.ended) return;
        casc.ended = true; cancelAnimationFrame(casc.raf);
        const b = await Arcade.dialog({ title: 'Solitaire', text: 'Deal again?', icon: 'trophy', buttons: ['Yes', 'No'] });
        if (!casc) return;                                   // a Deal happened meanwhile
        casc = null;
        if (b === 'Yes') deal(); else render();
      }

      /* ---------- input ---------- */
      function hit(p) {
        const inR = (x, y, w = CW, h = CH) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
        for (let t = 0; t < 7; t++) {
          const pl = st.tab[t];
          for (let i = pl.length - 1; i >= 0; i--) if (inR(pl[i]._x, pl[i]._y)) return { t: 't', i: t, idx: i };
          if (!pl.length && inR(COLX(t), TABY)) return { t: 't', i: t, idx: -1 };
        }
        const w = top(st.waste);
        if (w && inR(w._x, w._y)) return { t: 'w', idx: st.waste.length - 1 };
        for (let f = 0; f < 4; f++) if (inR(COLX(3 + f), TOPY)) return { t: 'f', i: f, idx: st.found[f].length - 1 };
        if (inR(COLX(0), TOPY, CW + 6, CH + 6)) return { t: 's' };
        return null;
      }
      function grabAt(p) {
        const h = hit(p); if (!h) return null;
        if (h.t === 't' && h.idx >= 0) { const pl = st.tab[h.i], c = pl[h.idx]; if (!c.up || c.fly) return null; return { src: { t: 't', i: h.i }, n: pl.length - h.idx }; }
        if (h.t === 'w' && !top(st.waste).fly) return { src: { t: 'w' }, n: 1 };
        if (h.t === 'f' && h.idx >= 0) return { src: { t: 'f', i: h.i }, n: 1 };
        return null;
      }
      const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
      function dropTarget(d) {
        const c0 = d.cards[0]; let best = null, bestA = 0;
        for (let t = 0; t < 7; t++) {
          if (d.src.t === 't' && d.src.i === t) continue;
          const pl = st.tab[t], tp = top(pl), y1 = tp ? tp._y + CH : TABY + CH;
          const a = overlap(d.x, d.y, CW, CH, COLX(t), TABY, CW, y1 - TABY);
          if (a > bestA && canTab(c0, t)) { best = { t: 't', i: t }; bestA = a; }
        }
        if (d.cards.length === 1) for (let f = 0; f < 4; f++) {
          if (d.src.t === 'f' && d.src.i === f) continue;
          const a = overlap(d.x, d.y, CW, CH, COLX(3 + f), TOPY, CW, CH);
          if (a > bestA && canFound(c0, f)) { best = { t: 'f', i: f }; bestA = a; }
        }
        return best;
      }
      C.input(S, {
        down(p) { if (casc) { endCascade(); return null; } if (busy || won || !st) return null; return grabAt(p); },
        dragStart(gr, p0) {
          const sp = pile(gr.src), cards = sp.slice(sp.length - gr.n), c0 = cards[0];
          drag = { cards, src: gr.src, x: c0._x, y: c0._y, dx: p0.x - c0._x, dy: p0.y - c0._y };
          cards.forEach(c => { c.dragging = true; });
        },
        drag(p, gr) {
          if (!drag) return;
          drag.x = p.x - drag.dx; drag.y = p.y - drag.dy; render();
        },
        drop(p, gr, cancel) {
          const d = drag; drag = null; if (!d) return;
          d.cards.forEach(c => { c.dragging = false; });
          const dst = cancel ? null : dropTarget(d);
          if (dst) doMove(d.src, d.cards.length, dst, false);
          else { const c0 = d.cards[0]; d.cards.forEach(c => fly(c, d.x, d.y + (c._y - c0._y), 170)); render(); }
        },
        click(p) {
          if (busy || won || !st) return;
          const h = hit(p); if (!h) return;
          if (h.t === 's') clickStock();
          else if (h.t === 't' && h.idx >= 0 && h.idx === st.tab[h.i].length - 1 && !st.tab[h.i][h.idx].up) {
            pushUndo(); st.tab[h.i][h.idx].up = true; if (std()) addScore(5); sfx.flip(); startClock(); after();
          }
        },
        dbl(p) {
          if (busy || won || !st) return;
          const h = hit(p); if (!h) return;
          if (h.t === 's') return clickStock();
          if (h.t === 'w') { if (!toFoundation({ t: 'w' })) sfx.bad(); return; }
          if (h.t === 't' && h.idx >= 0 && h.idx === st.tab[h.i].length - 1) {
            if (!st.tab[h.i][h.idx].up) return this.click(p);
            if (!toFoundation({ t: 't', i: h.i })) sfx.bad();
          }
        },
        context() { if (casc) return endCascade(); if (!busy && !won && st) autoplay(false); }
      });

      ctx.onKey(e => {
        if (e.key === 'F2') { e.preventDefault(); deal(); }
        else if (e.key === 'F1') { e.preventDefault(); showHelp(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        else if (e.key === 'Escape' && casc) endCascade();
        else if (casc && e.key === ' ') endCascade();
      });

      setInterval(() => {
        if (!st || !started || won || casc || !ctx.isVisible()) return;
        time++;
        if (opts.timed && std() && time % 10 === 0) addScore(-2);
        status();
      }, 1000);

      const onResize = () => {
        if (!S.fit() && !casc) return;
        if (casc) { S.fill(FELT); casc.piles.forEach((p, f) => { if (p.length) S.card(top(p), COLX(3 + f), TOPY); else slot(COLX(3 + f), TOPY); }); }
        else render();
      };
      new ResizeObserver(onResize).observe(host);
      ctx.on('open', () => { S.fit(); render(); });
      ctx.on('close', () => { stopCascade(); });
      C.onBack(() => render());

      Object.assign(api, {
        deal, undo, render, canUndo: () => !!undoStack.length && !busy && !won,
        applyOptions(redeal) { applyStatusBar(); if (redeal) deal(); else { render(); status(); } }
      });
      /* test hooks for tools/smoke.mjs */
      Arcade.apps.solitaire.test = {
        state: () => st, hit, doMove, clickStock, autoplay, win, deal, opts: () => opts, isWon: () => won, cascading: () => !!casc,
        S, layout, toFoundation,
        /* every card face up on the tableau in perfect descending runs: triggers auto-complete */
        nearWin() {
          deal(1); flying.clear();
          st.stock = []; st.waste = []; st.found = [[], [], [], []]; st.tab = [[], [], [], [], [], [], []];
          let i = 0;
          for (let r = 13; r >= 1; r--) for (let s = 0; s < 4; s++) { const alt = (r % 2) ? s : [2, 3, 0, 1][s]; st.tab[s].push({ s: alt, r, up: true }); i++; }
          started = true; after();
          return st.tab.map(p => p.length);
        }
      };

      applyStatusBar();
      deal();
    }
  });
})();

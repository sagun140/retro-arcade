/* CD Player: a Win95 CD Player look-alike that plays the Tracks95 library (from amp.js) as an audio "disc". */
(() => {
  const T = window.Tracks95;
  if (!T) { console.error('CD Player needs Tracks95 from amp.js'); return; }
  const store = { get: (k, d) => Arcade.store.get('cdplayer.' + k, d), set: (k, v) => Arcade.store.set('cdplayer.' + k, v) };
  const N = T.list.length;
  const mmss = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const two = n => String(n).padStart(2, '0');
  const LED = '#2bffc6', LED_OFF = '#073a2c';

  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="5" y="1" width="6" height="1" fill="#6a6a72"/><rect x="3" y="2" width="10" height="1" fill="#9a9aa4"/><rect x="2" y="3" width="12" height="2" fill="#d8d8e0"/><rect x="1" y="5" width="14" height="6" fill="#e8e8f0"/><rect x="2" y="11" width="12" height="2" fill="#c8c8d0"/><rect x="3" y="13" width="10" height="1" fill="#9a9aa4"/><rect x="5" y="14" width="6" height="1" fill="#6a6a72"/><rect x="3" y="4" width="4" height="1" fill="#ff7ad0"/><rect x="2" y="5" width="3" height="2" fill="#7ad8ff"/><rect x="10" y="10" width="3" height="2" fill="#ffe27a"/><rect x="9" y="12" width="3" height="1" fill="#9aff8a"/><rect x="6" y="6" width="4" height="4" fill="#b0b0b8"/><rect x="7" y="7" width="2" height="2" fill="#008080"/></svg>';

  const G = {
    play: '<svg viewBox="0 0 16 12"><path d="M5 1l7 5-7 5z"/></svg>',
    pause: '<svg viewBox="0 0 16 12"><rect x="4" y="2" width="3" height="8"/><rect x="9" y="2" width="3" height="8"/></svg>',
    stop: '<svg viewBox="0 0 16 12"><rect x="4" y="2" width="8" height="8"/></svg>',
    ptrack: '<svg viewBox="0 0 16 12"><rect x="1" y="2" width="2" height="8"/><path d="M8 2v8L3 6zM14 2v8L9 6z"/></svg>',
    back: '<svg viewBox="0 0 16 12"><path d="M8 2v8L3 6zM13 2v8L8 6z"/></svg>',
    fwd: '<svg viewBox="0 0 16 12"><path d="M3 2v8l5-4zM8 2v8l5-4z"/></svg>',
    ntrack: '<svg viewBox="0 0 16 12"><path d="M2 2v8l5-4zM7 2v8l5-4z"/><rect x="13" y="2" width="2" height="8"/></svg>',
    eject: '<svg viewBox="0 0 16 12"><path d="M8 1l6 6H2z"/><rect x="2" y="8" width="12" height="2"/></svg>'
  };

  Arcade.css(`
    .cd-tool { display: flex; gap: 2px; padding: 2px 2px 4px; margin-bottom: 3px; box-shadow: 0 1px var(--hi), 0 -1px var(--lo) inset; flex-wrap: wrap; }
    .cd-tool button { width: 24px; height: 22px; border: 0; padding: 0; background: var(--face); display: grid; place-items: center; font: bold 10px var(--ui); color: var(--ink); }
    .cd-tool button:hover { box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
    .cd-tool button.on, .cd-tool button:active { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); background: repeating-conic-gradient(var(--face) 0 25%, var(--hi) 0 50%) 0 0 / 2px 2px; }
    .cd-tool i { width: 2px; margin: 1px 3px; box-shadow: inset 1px 0 var(--lo), inset -1px 0 var(--hi); }
    .cd-main { display: flex; gap: 8px; align-items: stretch; padding: 4px 2px; flex-wrap: wrap; justify-content: center; }
    .cd-led { flex: 1 1 150px; min-width: 150px; max-width: 220px; background: #000; padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .cd-led canvas { display: block; width: 100%; height: auto; }
    .cd-btns { display: flex; flex-direction: column; gap: 4px; flex: none; }
    .cd-row { display: flex; gap: 2px; }
    .cd-btns .btn { min-width: 0; width: 27px; height: 24px; padding: 0; display: grid; place-items: center; }
    .cd-btns .btn svg { width: 16px; height: 12px; fill: var(--ink); }
    .cd-btns .btn:disabled svg { fill: var(--lo); filter: drop-shadow(1px 1px 0 var(--hi)); }
    .cd-btns .cd-play { width: 58px; }
    .cd-btns .cd-row:first-child .btn:not(.cd-play) { width: 39px; }
    .cd-btns .btn.on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); }
    .cd-info { display: grid; grid-template-columns: auto 1fr; gap: 4px 6px; align-items: center; padding: 6px 4px 4px; }
    .cd-info label { text-align: right; }
    .cd-info .field { width: 100%; min-width: 0; height: 22px; }
    .cd-info div.field { padding: 3px 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cd-dlg { min-width: min(330px, 100%); }
    .cd-dlg .cd-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .cd-pl { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: start; }
    .cd-pl select { width: 100%; height: 132px; font-size: 11px; }
    .cd-pl .cd-mid { display: flex; flex-direction: column; gap: 4px; padding-top: 16px; }
    .cd-pl .cd-mid .btn { min-width: 64px; padding: 2px 4px; }
    .cd-dlg label.cd-ck { display: flex; gap: 6px; align-items: center; }
    .cd-dlg .cd-row2 { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .cd-dlg input.field[type=number] { width: 56px; }
    @media (max-width: 420px) { .cd-pl { grid-template-columns: 1fr; } .cd-pl .cd-mid { flex-direction: row; flex-wrap: wrap; padding: 0; } .cd-pl select { height: 92px; } }
    @media (pointer: coarse) { .cd-btns .btn { height: 32px; width: 34px; } .cd-btns .cd-play { width: 72px; } .cd-btns .cd-row:first-child .btn:not(.cd-play) { width: 50px; } }
  `);

  /* ---------- 7-segment digits ---------- */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  function seg7(g, x, y, ch, w, h, th, on, off) {
    const m = (h - 3 * th) / 2, segs = SEG[ch] || '';
    const R = { a: [x + th, y, w - 2 * th, th], b: [x + w - th, y + th, th, m], c: [x + w - th, y + 2 * th + m, th, m], d: [x + th, y + h - th, w - 2 * th, th],
      e: [x, y + 2 * th + m, th, m], f: [x, y + th, th, m], g: [x + th, y + th + m, w - 2 * th, th] };
    for (const k in R) { const lit = segs.includes(k); if (!lit && !off) continue; g.fillStyle = lit ? on : off; g.fillRect(...R[k]); }
  }
  /* draws "[01] 00:00" (or "[01]-00:00" when minus) centered on a W x H canvas */
  function drawLed(g, W, H, track, minus, digits, big, show) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const s = big ? 1.62 : 1.42, dw = 18 * s, dh = 32 * s, th = 3.2 * s, gp = 5 * s, bw = 7 * s;
    const total = bw + gp + dw + gp + dw + gp + bw + 4 * s + 12 * s + 4 * dw + 3 * gp + 8 * s;
    let x = Math.round((W - total) / 2); const y = Math.round((H - dh) / 2);
    const seg = (ch, at) => seg7(g, at, y, show ? ch : ' ', dw, dh, th, LED, null);
    g.fillStyle = LED;
    g.fillRect(x, y, th, dh); g.fillRect(x, y, bw, th); g.fillRect(x, y + dh - th, bw, th); x += bw + gp;
    seg(track[0], x); x += dw + gp; seg(track[1], x); x += dw + gp;
    g.fillStyle = LED; g.fillRect(x + bw - th, y, th, dh); g.fillRect(x, y, bw, th); g.fillRect(x, y + dh - th, bw, th); x += bw + 4 * s;
    if (minus && show) { g.fillStyle = LED; g.fillRect(x + s, y + dh / 2 - th / 2, 9 * s, th); }
    x += 12 * s;
    for (let i = 0; i < 4; i++) {
      seg(digits[i], x); x += dw + (i < 3 ? gp : 0);
      if (i === 1) { if (show) { g.fillStyle = LED; g.fillRect(x + 4 * s - th / 2 - gp / 2, y + dh * .28, th, th); g.fillRect(x + 4 * s - th / 2 - gp / 2, y + dh * .66, th, th); } x += 8 * s - gp / 2; }
    }
  }

  function preview(g, w, h, t) {
    g.fillStyle = '#c3c3c6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#000'; g.fillRect(8, 22, 120, 54);
    g.fillStyle = '#fff'; g.fillRect(8, 76, 120, 1); g.fillRect(128, 22, 1, 55);
    g.save(); g.translate(10, 26); g.scale(116 / 300, 46 / 88);
    const sec = Math.floor(t * 2) % 222, trk = 1 + Math.floor(t / 6) % N;
    drawLed(g, 300, 88, two(trk), false, mmss(sec).replace(':', ''), false, true);
    g.restore();
    g.fillStyle = '#101014'; g.font = '10px sans-serif'; g.fillText('Disc  View  Options  Help', 8, 13);
    const btn = (x, y, bw) => { g.fillStyle = '#fff'; g.fillRect(x, y, bw, 1); g.fillRect(x, y, 1, 16); g.fillStyle = '#0c0c10'; g.fillRect(x, y + 16, bw, 1); g.fillRect(x + bw - 1, y, 1, 17); };
    btn(136, 24, 30); btn(167, 24, 17); btn(185, 24, 17);
    for (let i = 0; i < 5; i++) btn(136 + i * 13.5, 46, 13);
    g.fillStyle = '#101014'; g.beginPath(); g.moveTo(147, 28); g.lineTo(155, 32); g.lineTo(147, 36); g.fill();
    g.fillRect(172, 28, 2, 8); g.fillRect(176, 28, 2, 8); g.fillRect(189, 28, 8, 8);
    g.fillStyle = '#fff'; g.fillRect(8, 86, w - 16, 14); g.fillStyle = '#101014'; g.fillText('Artist: Various Artists', 12, 97);
    g.fillStyle = '#85858c'; g.fillRect(0, h - 14, w, 1); g.fillStyle = '#101014'; g.fillText('Total Play: ' + mmss(T.list.reduce((a, s) => a + s.dur, 0)) + ' m:s', 6, h - 3);
  }

  Arcade.app({
    id: 'cdplayer', title: 'CD Player', icon: ICON, width: 340, folder: 'Accessories', desktop: true, status: true, preview,
    hint: 'Win95 CD Player look-alike. The "disc" holds the 8 synthesized Amp 95 tracks.',
    menus: [
      { label: 'Disc', items: [
        { label: 'Edit Play List…', action: () => api.editList() },
        '-',
        { label: 'Exit', action: () => Arcade.apps.cdplayer.ctx.close() }
      ] },
      { label: 'View', items: [
        { label: 'Toolbar', checked: () => api.view('tool'), action: () => api.toggleView('tool') },
        { label: 'Disc/Track Info', checked: () => api.view('info'), action: () => api.toggleView('info') },
        { label: 'Status Bar', checked: () => api.view('status'), action: () => api.toggleView('status') },
        '-',
        { label: 'Track Time Elapsed', radio: () => api.mode() === 0, action: () => api.setMode(0) },
        { label: 'Track Time Remaining', radio: () => api.mode() === 1, action: () => api.setMode(1) },
        { label: 'Disc Time Remaining', radio: () => api.mode() === 2, action: () => api.setMode(2) }
      ] },
      { label: 'Options', items: [
        { label: 'Random Order', checked: () => api.opt('random'), action: () => api.toggleOpt('random') },
        { label: 'Continuous Play', checked: () => api.opt('continuous'), action: () => api.toggleOpt('continuous') },
        { label: 'Intro Play', checked: () => api.opt('intro'), action: () => api.toggleOpt('intro') },
        '-',
        { label: 'Preferences…', action: () => api.prefs() }
      ] },
      { label: 'Help', items: [
        { label: 'Help Topics', action: () => Arcade.dialog({ title: 'CD Player Help', text: 'Click Play to start the disc. The skip buttons seek within a track (hold to keep seeking); the outer buttons change tracks. Click the time display to cycle Track Time Elapsed, Track Time Remaining and Disc Time Remaining. Eject removes the disc; press it again to insert it. Keys: Space play/pause, S stop, ← → seek, PgUp/PgDn change track.' }) },
        '-',
        { label: 'About CD Player', action: () => Arcade.dialog({ title: 'About CD Player', text: `Arcade 95 CD Player\nDisc: "Tracks 95", ${N} tracks, ${mmss(T.list.reduce((a, s) => a + s.dur, 0))} total. Every track is synthesized live; no laser required.` }) }
      ] }
    ],
    build: build
  });
  const api = {};

  function build(ctx) {
    const view = { tool: store.get('tool', false), info: store.get('info', true), status: store.get('status', true) };
    const opts = { random: store.get('random', false), continuous: store.get('continuous', false), intro: store.get('intro', false) };
    const prefs = { introLen: store.get('introLen', 10), stopOnExit: store.get('stopOnExit', true), big: store.get('big', false), tips: store.get('tips', true) };
    let playlist = store.get('list', null);
    if (!Array.isArray(playlist) || !playlist.length || playlist.some(i => !(i >= 0 && i < N))) playlist = [...Array(N).keys()];
    let order = playlist.slice(), pos = 0, mode = 0, loaded = true;
    let ac = null, player = null;

    ctx.body.innerHTML = `
      <div class="cd-tool">
        <button data-t="edit" title="Edit Play List">≡</button><i></i>
        <button data-t="m0" title="Track Time Elapsed">⏱</button><button data-t="m1" title="Track Time Remaining">T-</button><button data-t="m2" title="Disc Time Remaining">D-</button><i></i>
        <button data-t="random" title="Random Track Order">⤨</button><button data-t="continuous" title="Continuous Play">↻</button><button data-t="intro" title="Intro Play">▷|</button>
      </div>
      <div class="cd-main">
        <div class="cd-led bevel-in" title="Click to change the time display"><canvas width="300" height="88" aria-label="Track and time display"></canvas></div>
        <div class="cd-btns">
          <div class="cd-row"><button class="btn cd-play" data-a="play" title="Play" aria-label="Play">${G.play}</button><button class="btn" data-a="pause" title="Pause" aria-label="Pause">${G.pause}</button><button class="btn" data-a="stop" title="Stop" aria-label="Stop">${G.stop}</button></div>
          <div class="cd-row"><button class="btn" data-a="ptrack" title="Previous Track" aria-label="Previous Track">${G.ptrack}</button><button class="btn" data-a="back" title="Skip Backwards" aria-label="Skip Backwards">${G.back}</button><button class="btn" data-a="fwd" title="Skip Forwards" aria-label="Skip Forwards">${G.fwd}</button><button class="btn" data-a="ntrack" title="Next Track" aria-label="Next Track">${G.ntrack}</button><button class="btn" data-a="eject" title="Eject" aria-label="Eject">${G.eject}</button></div>
        </div>
      </div>
      <div class="cd-info">
        <label for="cd-artist">Artist:</label><select class="field cd-artist" id="cd-artist"></select>
        <label>Title:</label><div class="field cd-title"></div>
        <label for="cd-track">Track:</label><select class="field cd-track" id="cd-track"></select>
      </div>`;
    const $ = s => ctx.body.querySelector(s);
    const cv = $('.cd-led canvas'), g = cv.getContext('2d');
    const artistSel = $('.cd-artist'), titleEl = $('.cd-title'), trackSel = $('.cd-track');
    const btn = a => $(`[data-a="${a}"]`);

    function ensureAudio() {
      if (player) { if (ac.state === 'suspended') ac.resume(); return true; }
      ac = Arcade.audio(); if (!ac) return false;
      const master = ac.createGain(), an = ac.createAnalyser();
      an.fftSize = 256; master.connect(an); an.connect(ac.destination);
      master.gain.value = Arcade.isMuted() ? 0 : .9;
      Arcade.onMute(m => master.gain.setTargetAtTime(m ? 0 : .9, ac.currentTime, .02));
      player = T.createPlayer(ac, master);
      player.onend = onEnd;
      api.nodes = { master, an };
      return true;
    }
    const stopForOther = () => { if (player) player.stop(); render(); };
    const curTrack = () => order[pos];
    const state = () => (player && loaded ? player.state() : 'stopped');
    const time = () => (player && player.index === curTrack() ? player.time() : 0);

    function start(fromSec) {
      if (!loaded || !ensureAudio()) return;
      T.claim(stopForOther);
      if (player.index !== curTrack() || player.state() === 'stopped') player.load(curTrack());
      if (fromSec) player.seek(fromSec);
      player.play(); render();
    }
    function play() { if (!loaded) return insert(); if (state() === 'paused') { T.claim(stopForOther); player.play(); render(); } else if (state() !== 'playing') start(0); }
    function pause() { if (state() === 'playing') player.pause(); else if (state() === 'paused') { T.claim(stopForOther); player.play(); } render(); }
    function stop() { if (player) player.stop(); render(); }
    function goto(p, keepPlaying) {
      pos = (p + order.length) % order.length;
      if (keepPlaying) { player.stop(); start(0); } else { if (player) player.stop(); render(); }
    }
    function prevTrack() { if (!loaded) return; const playing = state() === 'playing'; if (time() > 2 && (playing || state() === 'paused')) { goto(pos, playing); return; } goto(pos - 1, playing); }
    function nextTrack() { if (!loaded) return; goto(pos + 1, state() === 'playing'); }
    function skipBy(d) {
      if (!loaded || !ensureAudio()) return;
      if (player.index !== curTrack()) player.load(curTrack());
      player.seek(time() + d); render();
    }
    function onEnd() {
      if (pos < order.length - 1) { pos++; start(0); }
      else if (opts.continuous) { if (opts.random) shuffleOrder(); pos = 0; start(0); }
      else { pos = 0; render(); }
    }
    function shuffleOrder() {
      const keep = curTrack();
      order = playlist.slice();
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const k = order.indexOf(keep); if (k > 0) { order.splice(k, 1); order.unshift(keep); }
      pos = Math.max(0, order.indexOf(keep));
    }
    function eject() {
      if (loaded) { if (player) player.stop(); loaded = false; }
      else return insert();
      Arcade.beep(180, .08, 'square', .03); render();
    }
    function insert() { loaded = true; pos = 0; Arcade.beep(420, .06, 'square', .03); render(); }

    /* ---- rendering ---- */
    function fillSelects() {
      artistSel.innerHTML = loaded ? '<option>Various Artists &lt;D:&gt;</option>' : '<option>Data or no disc loaded</option>';
      titleEl.textContent = loaded ? 'Tracks 95 (Arcade 95 Original Soundtrack)' : 'Please insert an audio compact disc.';
      trackSel.innerHTML = loaded ? order.map((t, i) => `<option value="${i}">${Arcade.esc(T.list[t].artist + ' - ' + T.list[t].title)} &lt;${two(t + 1)}&gt;</option>`).join('') : '<option></option>';
      artistSel.disabled = trackSel.disabled = !loaded;
    }
    let lastSel = '';
    function render() {
      const st = state(), key = loaded + '|' + order.join(',');
      if (key !== lastSel) { fillSelects(); lastSel = key; }
      if (loaded && +trackSel.value !== pos) trackSel.value = pos;
      btn('play').disabled = !loaded ? false : st === 'playing';
      btn('pause').disabled = !loaded || st === 'stopped';
      btn('pause').classList.toggle('on', st === 'paused');
      btn('stop').disabled = !loaded || st === 'stopped';
      ['ptrack', 'back', 'fwd', 'ntrack'].forEach(a => { btn(a).disabled = !loaded; });
      ctx.body.querySelectorAll('.cd-tool [data-t]').forEach(b => {
        const t = b.dataset.t; b.classList.toggle('on', t[0] === 'm' && t.length === 2 ? +t[1] === mode : !!opts[t]);
      });
      $('.cd-tool').hidden = !view.tool; $('.cd-info').hidden = !view.info;
      const sb = ctx.win.querySelector('.statusbar'); if (sb) sb.hidden = !view.status;
      ctx.body.querySelectorAll('[title]').forEach(el => { if (!prefs.tips && el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); } });
      if (prefs.tips) ctx.body.querySelectorAll('[data-tip]').forEach(el => { el.title = el.dataset.tip; delete el.dataset.tip; });
      drawLedNow(performance.now());
      status();
    }
    function status() {
      if (!loaded) { ctx.status('Total Play: 00:00 m:s', 'Track: 00:00 m:s'); return; }
      const total = order.reduce((a, t) => a + T.list[t].dur, 0);
      ctx.status(`Total Play: ${mmss(total)} m:s`, `Track: ${mmss(T.list[curTrack()].dur)} m:s`);
    }
    function drawLedNow(now) {
      if (!loaded) { drawLed(g, 300, 88, '--', false, '----', prefs.big, true); return; }
      const t = time(), d = T.list[curTrack()].dur;
      let v = t, minus = false;
      if (mode === 1) { v = d - t; minus = true; }
      else if (mode === 2) { v = order.slice(pos + 1).reduce((a, k) => a + T.list[k].dur, 0) + d - t; minus = true; }
      const show = !(state() === 'paused' && Math.floor(now / 500) % 2);
      drawLed(g, 300, 88, two(curTrack() + 1), minus, mmss(v).replace(':', '').slice(-4), prefs.big, show);
    }

    /* ---- events ---- */
    const ACT = { play, pause, stop, ptrack: prevTrack, ntrack: nextTrack, eject };
    ctx.body.querySelectorAll('.cd-btns .btn').forEach(b => {
      const a = b.dataset.a;
      if (a === 'back' || a === 'fwd') {
        let rep = 0, delay = 0;
        const d = a === 'back' ? -2 : 2;
        const end = () => { clearTimeout(delay); clearInterval(rep); };
        b.addEventListener('pointerdown', e => { if (b.disabled) return; e.preventDefault(); skipBy(d); delay = setTimeout(() => { rep = setInterval(() => skipBy(d), 140); }, 350); });
        b.addEventListener('pointerup', end); b.addEventListener('pointerleave', end); b.addEventListener('pointercancel', end);
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); skipBy(d); } });
      } else b.addEventListener('click', () => ACT[a]());
    });
    $('.cd-led').addEventListener('click', () => { if (!loaded) return insert(); setMode((mode + 1) % 3); });
    trackSel.addEventListener('change', () => goto(+trackSel.value, state() === 'playing'));
    ctx.body.querySelectorAll('.cd-tool [data-t]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.t;
      if (t === 'edit') editList(); else if (t[0] === 'm' && t.length === 2) setMode(+t[1]); else toggleOpt(t);
    }));
    ctx.onKey(e => {
      const k = e.key;
      const map = { ' ': () => (state() === 'stopped' ? play() : pause()), s: stop, S: stop, ArrowLeft: () => skipBy(-5), ArrowRight: () => skipBy(5), PageUp: prevTrack, PageDown: nextTrack, e: eject, E: eject };
      if (map[k] && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); map[k](); }
    });

    function setMode(m) { mode = m; render(); }
    function toggleOpt(k) {
      opts[k] = !opts[k]; store.set(k, opts[k]);
      if (k === 'random') { if (opts.random) shuffleOrder(); else { const keep = curTrack(); order = playlist.slice(); pos = Math.max(0, order.indexOf(keep)); } }
      render();
    }
    function toggleView(k) { view[k] = !view[k]; store.set(k, view[k]); render(); }

    /* ---- dialogs (built from the shared Win95 message-box chrome) ---- */
    function modal(title, inner, onOk) {
      const veil = Arcade.el(`<div class="modal-veil"><div class="win msgbox bevel-out active cd-dlg" role="dialog">
        <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
        <div class="cd-body">${inner}</div>
        <div class="actions"><button class="btn" data-k="ok">OK</button><button class="btn" data-k="cancel">Cancel</button></div></div></div>`);
      veil.querySelector('.ttl span').textContent = title;
      const close = () => veil.remove();
      veil.querySelector('[data-act="close"]').onclick = close;
      veil.querySelector('[data-k="cancel"]').onclick = close;
      veil.querySelector('[data-k="ok"]').onclick = () => { onOk(veil); close(); };
      veil.addEventListener('keydown', e => { if (e.key === 'Escape') close(); e.stopPropagation(); });
      veil.style.zIndex = 99000;
      document.getElementById('desktop').appendChild(veil);
      setTimeout(() => veil.querySelector('[data-k="ok"]').focus(), 0);
      return veil;
    }
    function editList() {
      let work = playlist.slice();
      const v = modal('Disc Settings', `
        <div>Drive: \\Device\\CdRom0 &lt;D:&gt;<br>Artist: Various Artists<br>Title: Tracks 95</div>
        <div class="cd-pl">
          <div>Play List:<select class="field cd-l" size="8" multiple aria-label="Play list"></select></div>
          <div class="cd-mid"><button class="btn" data-o="add">&lt;- Add</button><button class="btn" data-o="rem">Remove -&gt;</button><button class="btn" data-o="clr">Clear All</button><button class="btn" data-o="rst">Reset</button></div>
          <div>Available Tracks:<select class="field cd-a" size="8" multiple aria-label="Available tracks"></select></div>
        </div>`, () => {
        if (!work.length) work = [...Array(N).keys()];
        playlist = work; store.set('list', playlist);
        const keep = curTrack(); order = playlist.slice(); if (opts.random) shuffleOrder();
        const k = order.indexOf(keep);
        if (k >= 0) pos = k; else { if (player) player.stop(); pos = 0; }
        render();
      });
      const L = v.querySelector('.cd-l'), A = v.querySelector('.cd-a');
      const opt = (t, i) => `<option value="${i}">${two(t + 1)}. ${Arcade.esc(T.list[t].title)}</option>`;
      const draw = () => { L.innerHTML = work.map(opt).join(''); A.innerHTML = T.list.map((s, t) => opt(t, t)).join(''); };
      draw();
      const picked = s => [...s.selectedOptions].map(o => +o.value);
      v.querySelector('[data-o="add"]').onclick = () => { work.push(...picked(A)); draw(); };
      v.querySelector('[data-o="rem"]').onclick = () => { const r = new Set(picked(L)); work = work.filter((_, i) => !r.has(i)); draw(); };
      v.querySelector('[data-o="clr"]').onclick = () => { work = []; draw(); };
      v.querySelector('[data-o="rst"]').onclick = () => { work = [...Array(N).keys()]; draw(); };
      A.addEventListener('dblclick', () => { work.push(...picked(A)); draw(); });
    }
    function prefsDlg() {
      modal('Preferences', `
        <label class="cd-ck"><input type="checkbox" class="cd-p-stop"> Stop CD playing on exit</label>
        <label class="cd-ck"><input type="checkbox" class="cd-p-tips"> Show tool tips</label>
        <div class="cd-row2">Intro play length: <input type="number" class="field cd-p-len" min="5" max="15"> seconds</div>
        <fieldset class="groupbox"><legend>Display font</legend><div class="cd-row2">
          <label class="cd-ck"><input type="radio" name="cd-font" value="0"> Small font</label>
          <label class="cd-ck"><input type="radio" name="cd-font" value="1"> Large font</label></div></fieldset>`, v => {
        prefs.stopOnExit = v.querySelector('.cd-p-stop').checked;
        prefs.tips = v.querySelector('.cd-p-tips').checked;
        prefs.introLen = Math.max(5, Math.min(15, Math.round(+v.querySelector('.cd-p-len').value) || 10));
        prefs.big = v.querySelector('[name="cd-font"][value="1"]').checked;
        for (const k in prefs) store.set(k, prefs[k]);
        render();
      });
      const v = document.querySelector('.cd-dlg');
      v.querySelector('.cd-p-stop').checked = prefs.stopOnExit;
      v.querySelector('.cd-p-tips').checked = prefs.tips;
      v.querySelector('.cd-p-len').value = prefs.introLen;
      v.querySelector(`[name="cd-font"][value="${prefs.big ? 1 : 0}"]`).checked = true;
    }

    Object.assign(api, {
      editList, prefs: prefsDlg, view: k => view[k], toggleView, mode: () => mode, setMode, opt: k => opts[k], toggleOpt,
      play, pause, stop, eject, nextTrack, prevTrack, player: () => player, state, loaded: () => loaded
    });
    Arcade.apps.cdplayer.api = api;

    /* ---- display clock: blink, time, intro play ---- */
    setInterval(() => {
      if (!ctx.isVisible() && state() !== 'playing') return;
      if (opts.intro && state() === 'playing' && time() >= prefs.introLen) { player.stop(); onEnd(); return; }
      if (ctx.isVisible()) drawLedNow(performance.now());
    }, 200);
    ctx.on('close', () => { if (prefs.stopOnExit && player) { player.stop(); T.release(stopForOther); } render(); });
    if (opts.random) shuffleOrder();
    render();
  }
})();

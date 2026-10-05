/* Space Pinball: original pseudo-3D space pinball tribute.
   Own 2D physics: circle vs. segments/circles/capsule flippers, fixed 60 Hz step with 10+ adaptive substeps. */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="0" width="12" height="16" fill="#7a6bff"/><rect x="3" y="1" width="10" height="14" fill="#1a0b4a"/><rect x="5" y="2" width="1" height="1" fill="#fff"/><rect x="11" y="5" width="1" height="1" fill="#fff"/><rect x="4" y="4" width="3" height="3" fill="#ff5fd0"/><rect x="9" y="3" width="3" height="3" fill="#ff5fd0"/><rect x="6" y="7" width="3" height="3" fill="#22e6ff"/><rect x="10" y="9" width="2" height="2" fill="#f4f4ff"/><rect x="4" y="12" width="3" height="1" fill="#ff3d6e"/><rect x="9" y="12" width="3" height="1" fill="#ff3d6e"/><rect x="3" y="11" width="1" height="2" fill="#ffd23f"/><rect x="12" y="11" width="1" height="2" fill="#ffd23f"/></svg>';
  const W = 320, H = 620, ASPECT = W / H;
  const BR = 7, G = 1250, MAXV = 2600, BALL_SAVE = 8, REPLAY = 400000;
  const PL_REST = 556, PL_PULL = 34;
  const RANKS = ['Cadet', 'Ensign', 'Lieutenant', 'Captain', 'Lt. Commander', 'Commander', 'Commodore', 'Rear Admiral', 'Admiral', 'Fleet Admiral'];
  const MISSIONS = [
    { text: 'Hit the pop bumpers 10 times', ev: 'bumper', need: 10 },
    { text: 'Drop all three targets', ev: 'bank', need: 1 },
    { text: 'Light all three lanes', ev: 'lanes', need: 1 },
    { text: 'Shoot the orbit 2 times', ev: 'orbit', need: 2 },
    { text: 'Hit the slingshots 8 times', ev: 'sling', need: 8 }
  ];
  const store = { get: (k, d) => Arcade.store.get('pinball.' + k, d), set: (k, v) => Arcade.store.set('pinball.' + k, v) };
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const api = {};

  Arcade.css(`
    .pb-wrap { display: flex; gap: 3px; background: #000; padding: 2px; min-height: 0; }
    .pb-table { flex: none; display: flex; justify-content: center; align-items: flex-start; background: #07041a; line-height: 0; }
    .pb-table canvas { display: block; touch-action: none; }
    .pb-panel { flex: 0 0 180px; min-width: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px 8px; color: #cfe3ff;
      background: linear-gradient(180deg, #120a3a, #2a0f55 60%, #170a35); font: 11px/1.3 var(--pixel); }
    .pb-logo { font: 15px/1.5 var(--display); text-align: center; color: #ffe66b; text-shadow: 2px 2px 0 #c2366e; padding: 4px 0; letter-spacing: 1px; }
    .pb-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
    .pb-row b { font: 14px var(--display); color: #fff; }
    .pb-row .pb-rk { font: 11px var(--pixel); color: #ffd23f; text-align: right; }
    .pb-score { font: 17px/1 var(--display); color: #5dffb0; background: #000; text-align: right; padding: 10px 6px; text-shadow: 0 0 6px #1aff8a;
      box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk); overflow: hidden; white-space: nowrap; }
    .pb-mission { color: #ffd23f; background: rgba(0,0,0,.35); padding: 5px; min-height: 42px; }
    .pb-msgs { flex: 1; min-height: 80px; overflow: auto; background: #000; color: #8dfff0; padding: 5px; font: 10px/1.45 var(--pixel);
      box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk); user-select: text; -webkit-user-select: text; }
    .pb-msgs div { border-bottom: 1px dotted #1d2a4a; padding: 1px 0; }
    .pb-msgs .pb-hot { color: #ffe66b; }
    .pb-msgs .pb-bad { color: #ff6b8a; }
    @media (max-width: 600px) {
      .pb-wrap { flex-direction: column-reverse; }
      .pb-panel { flex: none; display: grid; grid-template-columns: auto 1fr auto; gap: 4px 8px; padding: 6px; align-items: center; }
      .pb-logo { display: none; }
      .pb-score { font-size: 13px; padding: 6px 4px; }
      .pb-mission { grid-column: 1 / -1; min-height: 0; padding: 3px 5px; }
      .pb-msgs { grid-column: 1 / -1; min-height: 0; height: 34px; }
      .pb-panel .pb-player { display: none; }
    }
  `);

  Arcade.scores.add({
    game: 'Space Pinball',
    render() {
      const hi = store.get('hi', []);
      let h = '<tr><th>#</th><th>Name</th><th>Score</th></tr>';
      for (let i = 0; i < 5; i++) { const r = hi[i]; h += `<tr><td>${i + 1}</td><td>${r ? Arcade.esc(r.n) : '-'}</td><td class="num">${r ? fmt(r.s) : '-'}</td></tr>`; }
      return h;
    }
  });

  function preview(g, w, h, t) {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0b0630'); bg.addColorStop(1, '#2a0f55');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { g.globalAlpha = .3 + .7 * Math.abs(Math.sin(t * 2 + i)); g.fillRect((i * 53) % w, (i * 31) % h, 1, 1); }
    g.globalAlpha = 1;
    g.fillStyle = '#1a0b4a'; g.strokeStyle = '#a99cff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(36, 6); g.lineTo(104, 6); g.lineTo(118, 113); g.lineTo(22, 113); g.closePath(); g.fill(); g.stroke();
    [[58, 34], [82, 34], [70, 52]].forEach(([x, y], i) => {
      const lit = Math.sin(t * 6 + i * 2) > .4;
      g.save(); g.shadowColor = '#ff5fd0'; g.shadowBlur = lit ? 10 : 2;
      g.fillStyle = lit ? '#ffd6f4' : '#c2368e'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.restore();
    });
    const fl = Math.sin(t * 3) > .6 ? -.5 : .5;
    g.strokeStyle = '#ff3d6e'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(46, 98); g.lineTo(46 + Math.cos(fl) * 18, 98 + Math.sin(fl) * 18); g.stroke();
    g.beginPath(); g.moveTo(94, 98); g.lineTo(94 - Math.cos(fl) * 18, 98 + Math.sin(fl) * 18); g.stroke();
    const bx = 70 + Math.sin(t * 1.7) * 30, by = 62 + Math.sin(t * 2.6) * 30;
    g.fillStyle = '#f4f4ff'; g.beginPath(); g.arc(bx, by, 3.5, 0, 7); g.fill();
    g.fillStyle = '#ffe66b'; g.font = '13px "Press Start 2P", monospace'; g.fillText('SPACE', 132, 40); g.fillText('PINBALL', 132, 58);
    g.fillStyle = '#000'; g.fillRect(132, 72, 70, 18);
    g.fillStyle = '#5dffb0'; g.font = '10px "Press Start 2P", monospace'; g.textAlign = 'right'; g.fillText(String(Math.floor(t * 1234) * 10 % 1000000), 199, 86); g.textAlign = 'left';
  }

  const menus = [
    { label: 'Game', items: [
      { label: 'New Game', key: 'F2', action: () => api.newGame && api.newGame() },
      { label: 'Launch Ball', key: 'Space', action: () => api.autoLaunch && api.autoLaunch() },
      '-',
      { label: 'Pause/Resume Game', key: 'F3', action: () => api.togglePause && api.togglePause() },
      '-',
      { label: 'Sound', checked: () => !Arcade.isMuted(), action: () => Arcade.setMuted(!Arcade.isMuted()) },
      '-',
      { label: 'Exit', action: () => Arcade.apps.pinball.ctx.close() }
    ] },
    { label: 'Options', items: [
      { label: 'Player Controls…', action: () => Arcade.dialog({ title: 'Player Controls', icon: 'info', text:
        'Left flipper: Z, Left Shift or Left Arrow.  Right flipper: / (slash), Right Shift or Right Arrow.  Plunger: hold Space (or Down Arrow), release to launch.  Nudge: X (from left), . (from right), Up Arrow (from below).  New game: F2.  Pause/Resume: F3.  Touch: tap the left or right half for the flippers; hold the right half and swipe down, then release, to launch.' }) }
    ] },
    { label: 'Help', items: [
      { label: 'How to play', action: () => Arcade.dialog({ title: 'How to play Space Pinball', icon: 'info', text:
        'Pull the plunger and launch the ball. Keep it in play with the flippers; you have 3 balls. Complete the mission shown in the panel to rank up from Cadet towards Fleet Admiral and raise your bonus multiplier. Light all three top lanes (the flippers rotate the lit lanes) for another multiplier, drop all three targets for a bank bonus, and shoot the top orbit. Nudge carefully: too many nudges and the table tilts. Score ' + fmt(REPLAY) + ' for an extra ball.' }) }
    ] }
  ];

  const def = Arcade.app({
    id: 'pinball', title: 'Space Pinball', icon: ICON, width: 'auto', max: true, folder: 'Games', status: true, preview, menus,
    hint: 'Pseudo-3D space pinball: missions, ranks, bumpers, ramps and a spring plunger.',
    build(win) {
      win.body.innerHTML = `<div class="pb-wrap">
        <div class="pb-table"><canvas aria-label="Space Pinball table"></canvas></div>
        <div class="pb-panel">
          <div class="pb-logo">SPACE<br>PINBALL</div>
          <div class="pb-row"><span>BALL</span><b data-f="ball">1</b></div>
          <div class="pb-row pb-player"><span>PLAYER</span><b>1</b></div>
          <div class="pb-score" data-f="score">0</div>
          <div class="pb-row"><span>RANK</span><span class="pb-rk" data-f="rank">Cadet</span></div>
          <div class="pb-mission" data-f="mission"></div>
          <div class="pb-msgs" data-f="log"></div>
        </div></div>`;
      const F = n => win.body.querySelector(`[data-f="${n}"]`);
      const cv = win.body.querySelector('canvas'), g = cv.getContext('2d'), panel = win.body.querySelector('.pb-panel');
      const logEl = F('log'), coarse = Arcade.coarse, beep = Arcade.beep;

      /* ============ Sound ============ */
      let noiseBuf = null;
      function noise(dur, vol = .05, freq = 900) {
        if (Arcade.isMuted()) return; const a = Arcade.audio(); if (!a) return;
        if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * .6, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        const s = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain(), t0 = a.currentTime;
        s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.frequency.exponentialRampToValueAtTime(freq * 3, t0 + dur);
        gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
        s.connect(f).connect(gn).connect(a.destination); s.start(t0); s.stop(t0 + dur + .02);
      }
      const sfx = {
        flip: () => { beep(150, .05, 'square', .03, -70); noise(.04, .03, 2000); },
        bumper: () => { beep(480 + Math.random() * 120, .09, 'square', .045, -250); beep(1180, .05, 'triangle', .03); },
        sling: () => beep(330, .07, 'sawtooth', .035, -160),
        target: () => beep(880, .09, 'square', .04, -420),
        lane: () => beep(1250, .07, 'triangle', .05),
        launch: p => { beep(140, .35, 'sawtooth', .04, 400 + p * 600); noise(.3, .06, 500); },
        drain: () => { beep(440, .5, 'sawtooth', .05, -380); beep(220, .7, 'triangle', .05, -160, .12); },
        mission: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, .14, 'square', .035, 0, i * .08)),
        bank: () => [784, 988, 1175, 1568].forEach((f, i) => beep(f, .1, 'square', .035, 0, i * .06)),
        lanes: () => [660, 880, 1100, 1320].forEach((f, i) => beep(f, .09, 'triangle', .05, 0, i * .05)),
        orbit: () => { beep(300, .35, 'triangle', .05, 900); noise(.3, .03, 1500); },
        save: () => [880, 660, 880].forEach((f, i) => beep(f, .1, 'square', .035, 0, i * .1)),
        warn: () => { beep(220, .12, 'square', .05); beep(220, .12, 'square', .05, 0, .18); },
        tilt: () => beep(90, .8, 'sawtooth', .06, -40),
        extra: () => [523, 784, 1047, 784, 1047, 1568].forEach((f, i) => beep(f, .12, 'square', .035, 0, i * .09)),
        nudge: () => noise(.08, .05, 200)
      };

      /* ============ Table geometry ============ */
      const SEGS = [], CIRCLES = [], DRAW = [];
      const seg = (a, b, o = {}) => {
        const s = Object.assign({ ax: a[0], ay: a[1], bx: b[0], by: b[1], e: .45, th: 2 }, o);
        s.dx = s.bx - s.ax; s.dy = s.by - s.ay; s.len2 = s.dx * s.dx + s.dy * s.dy || 1;
        SEGS.push(s); return s;
      };
      const poly = (pts, o = {}, draw = true) => { if (draw) DRAW.push(pts); for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], o); };
      const arcPts = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
      const D = Math.PI / 180, arcY = x => 160 - Math.sqrt(122 * 122 - (x - 160) ** 2);
      // outer wall: left side, top arc, plunger-lane outer wall
      const OUTER = [[10, 640], ...arcPts(160, 160, 150, Math.PI, 2 * Math.PI, 40), [310, 606]];
      poly(OUTER);
      poly([[286, 142], [286, 640]]);                                  // plunger lane inner wall / right outlane wall
      seg([286, 606], [310, 606], { th: 3 });                         // lane floor under the plunger
      poly([[45, 178], ...arcPts(160, 160, 122, 200 * D, 340 * D, 24)]); // inner orbit wall
      // one-way gate at the top of the plunger lane: only blocks balls coming from above
      const gate = seg([286, 142], [305.5, 122], { oneWay: true, e: .3 });
      { const l = Math.sqrt(gate.len2); gate.nx = gate.dy / l; gate.ny = -gate.dx / l; if (gate.ny > 0) { gate.nx = -gate.nx; gate.ny = -gate.ny; } }
      const LANE_X = [120, 154, 188];
      [103, 137, 171, 205].forEach(x => poly([[x, arcY(x)], [x, 92]], { th: 2.5 }));
      poly([[10, 325], [36, 365]]); poly([[286, 325], [260, 365]]);    // deflectors above the outlanes
      poly([[28, 392], [28, 450], [84, 492]]); poly([[268, 392], [268, 450], [212, 492]]); // inlane guides
      const slings = [[[54, 390], [54, 440], [88, 462]], [[242, 390], [242, 440], [208, 462]]].map((p, i) => {
        seg(p[0], p[1]); seg(p[1], p[2]);
        const face = seg(p[2], p[0], { e: .5, sling: i });
        return { pts: p, face, flash: 0 };
      });
      slings.forEach(s => { s.face.hit = (o, vn, nx, ny) => slingHit(s, vn, nx, ny); });
      const targets = [[228, 252], [258, 282], [288, 312]].map((r, i) => {
        const t = { y0: r[0], y1: r[1], down: false, flash: 0 };
        t.seg = seg([279, r[0]], [279, r[1]], { th: 3, e: .35, hit: (o, vn) => targetHit(t, i, vn) });
        return t;
      });
      const bumpers = [[122, 175], [182, 175], [152, 222]].map(([x, y]) => {
        const b = { x, y, r: 17, e: .6, flash: 0 }; b.hit = (o, vn, nx, ny) => bumperHit(b, vn, nx, ny); CIRCLES.push(b); return b;
      });
      const plSeg = seg([288, PL_REST], [308, PL_REST], { th: 3, e: .1 });
      const mkFlip = (x, side) => ({ x, y: 500, side, len: 50, r0: 9, r1: 5, rest: side < 0 ? .52 : Math.PI - .52, up: side < 0 ? -.52 : Math.PI + .52, a: 0, w: 0, held: false, prev: null, e: .3 });
      const flips = [mkFlip(90, -1), mkFlip(206, 1)];
      flips.forEach(f => { f.a = f.rest; f.hit = () => { ball.launchPass = false; }; });

      /* ============ State ============ */
      const ball = { x: 298, y: PL_REST - BR, vx: 0, vy: 0, r: BR, live: false, launchPass: false };
      let state = 'attract', paused = false, t = 0;
      let score = 0, ballNum = 1, extra = 0, rank = 0, mult = 1, bonus = 0, replayDone = false;
      let lanes = [false, false, false], laneLock = -1, laneFlash = 0, bankReset = 0;
      let tilt = 0, warned = false, tilted = false, ballSave = 0, saved = false, drainT = 0, pull = 0, swipePull = 0;
      let mission = { i: 0, n: 0, need: 10 }, orbits = 0, prevX = ball.x, lastBonus = 0;
      const banner = { text: '', t: 0 }, shake = { x: 0, y: 0 };
      let tunnels = 0;
      const keys = {};
      let touchL = 0, touchR = 0, touchP = false, ignoreP = false;

      function log(text, cls) {
        const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls;
        logEl.appendChild(d); while (logEl.children.length > 40) logEl.firstChild.remove();
        logEl.scrollTop = logEl.scrollHeight;
      }
      const say = (text, secs = 2.2) => { banner.text = text; banner.t = secs; };
      function addScore(n) {
        score += n;
        if (!replayDone && score >= REPLAY) { replayDone = true; extra++; sfx.extra(); say('EXTRA BALL!'); log('Replay! Extra ball awarded.', 'pb-hot'); }
      }
      const active = () => (state === 'play' || state === 'plunger') && !paused;

      function setMission(i) {
        const m = MISSIONS[i % MISSIONS.length], cyc = Math.floor(i / MISSIONS.length);
        mission = { i, n: 0, need: m.need * (1 + cyc) };
        log('New mission: ' + missionText() + '.', 'pb-hot');
      }
      function missionText() {
        const m = MISSIONS[mission.i % MISSIONS.length];
        if (m.ev === 'bank' && mission.need > 1) return `Drop the target bank ${mission.need} times`;
        if (m.ev === 'lanes' && mission.need > 1) return `Light all lanes ${mission.need} times`;
        return m.text.replace(/\d+/, mission.need);
      }
      function progress(ev) {
        if (state !== 'play' || tilted) return;
        if (MISSIONS[mission.i % MISSIONS.length].ev !== ev) return;
        if (++mission.n >= mission.need) {
          const pts = 25000 * (rank + 1);
          addScore(pts); bonus += 5000;
          rank = Math.min(rank + 1, RANKS.length - 1); mult = Math.min(mult + 1, 10);
          sfx.mission(); say('MISSION COMPLETE', 2.6);
          log(`Mission complete! +${fmt(pts)}. Promoted to ${RANKS[rank]}. Bonus x${mult}.`, 'pb-hot');
          setMission(mission.i + 1);
        }
      }

      /* ============ Scoring hooks ============ */
      function bumperHit(b, vn, nx, ny) {
        ball.launchPass = false;
        if (tilted) return;
        const out = ball.vx * nx + ball.vy * ny;
        if (out < 640) { ball.vx += (640 - out) * nx; ball.vy += (640 - out) * ny; }
        if (b.flash > .06) return;
        b.flash = .18; addScore(500); bonus += 50; sfx.bumper(); progress('bumper');
      }
      function slingHit(s, vn, nx, ny) {
        ball.launchPass = false;
        if (tilted || vn < 40) return;
        ball.vx += nx * 430; ball.vy += ny * 430;
        if (s.flash > .05) return;
        s.flash = .15; addScore(100); bonus += 20; sfx.sling(); progress('sling');
      }
      function targetHit(tg, i, vn) {
        if (tg.down || vn < 40 || tilted) return;
        tg.down = true; tg.seg.off = true; tg.flash = .3; addScore(2500); bonus += 500; sfx.target();
        if (targets.every(x => x.down)) {
          addScore(15000); bonus += 2000; bankReset = 1.2; sfx.bank(); say('TARGET BANK!'); log('All targets down: +15,000.', 'pb-hot'); progress('bank');
        }
      }
      function laneHit(i) {
        if (tilted || laneFlash > 0) return;
        if (!lanes[i]) { lanes[i] = true; addScore(1000); bonus += 250; sfx.lane(); } else addScore(250);
        if (lanes.every(Boolean)) {
          mult = Math.min(mult + 1, 10); addScore(10000); laneFlash = 1.2; sfx.lanes(); say(`LANES LIT  BONUS x${mult}`);
          log(`All lanes lit: +10,000, bonus multiplier x${mult}.`, 'pb-hot'); progress('lanes');
        }
      }
      function orbitHit() {
        orbits++; const pts = 5000 + 2500 * Math.min(orbits - 1, 8);
        addScore(pts); bonus += 1000; sfx.orbit(); say('ORBIT  ' + fmt(pts)); log(`Orbit shot: +${fmt(pts)}.`); progress('orbit');
      }

      /* ============ Game flow ============ */
      function newGame() {
        paused = false; score = 0; ballNum = 1; extra = 0; rank = 0; mult = 1; replayDone = false; orbits = 0;
        lanes = [true, false, false]; targets.forEach(x => { x.down = false; x.seg.off = false; });
        logEl.innerHTML = ''; log('Welcome aboard, Cadet.', 'pb-hot'); setMission(0);
        serve(); Arcade.audio();
      }
      function serve() {
        Object.assign(ball, { x: 298, y: PL_REST - BR, vx: 0, vy: 0, live: true, launchPass: true });
        state = 'plunger'; pull = 0; swipePull = 0; tilt = 0; warned = false; tilted = false; bonus = 0; saved = false; ballSave = 0;
        log(`Ball ${ballNum}: ${coarse ? 'hold and swipe down on the right' : 'hold Space'} to launch.`);
      }
      function launch() {
        if (state !== 'plunger' || !onPlunger()) { pull = 0; return; }
        const p = Math.max(.08, pull), v = 650 + 1600 * p;
        ball.y = PL_REST - BR; ball.vy = -v; ball.vx = 0; pull = 0; swipePull = 0;
        sfx.launch(p);
      }
      const onPlunger = () => ball.live && ball.x > 287 && ball.y > PL_REST - 24;
      function drain() {
        ball.live = false;
        if (ballSave > 0 && !tilted && !saved) {
          saved = true; sfx.save(); say('BALL SAVED'); log('Ball saved! Shoot again.', 'pb-hot');
          Object.assign(ball, { x: 298, y: PL_REST - BR, vx: 0, vy: 0, live: true, launchPass: true }); state = 'plunger'; pull = 0; return;
        }
        sfx.drain();
        lastBonus = tilted ? 0 : bonus * mult;
        if (lastBonus) { addScore(lastBonus); say(`BONUS ${fmt(bonus)} x${mult}`, 2); log(`End of ball bonus: ${fmt(bonus)} x ${mult} = ${fmt(lastBonus)}.`); }
        else log(tilted ? 'Ball lost. No bonus after a tilt.' : 'Ball lost.', 'pb-bad');
        state = 'drain'; drainT = 2.2;
      }
      function nextBall() {
        if (extra > 0) { extra--; say('SHOOT AGAIN'); log('Extra ball: shoot again!', 'pb-hot'); serve(); return; }
        if (ballNum < 3) { ballNum++; serve(); return; }
        gameOver();
      }
      function gameOver() {
        state = 'over'; ball.live = false;
        log(`Game over. Final score ${fmt(score)}. Rank: ${RANKS[rank]}.`, 'pb-hot');
        [392, 330, 262, 196].forEach((f, i) => beep(f, .25, 'triangle', .05, 0, i * .22));
        const hi = store.get('hi', []);
        if (score > 0 && (hi.length < 5 || score > hi[hi.length - 1].s)) {
          const s = score;
          Arcade.dialog({ title: 'Space Pinball', icon: 'trophy', text: `New high score: ${fmt(s)}! Rank ${RANKS[rank]}. Enter your name:`, input: store.get('name', 'Player 1'), buttons: ['OK', 'Cancel'] })
            .then(name => {
              if (name == null) return;
              name = (name || 'Player 1').slice(0, 24); store.set('name', name);
              const list = store.get('hi', []); list.push({ n: name, s }); list.sort((a, b) => b.s - a.s); store.set('hi', list.slice(0, 5));
              log(`${name} entered the hall of fame.`, 'pb-hot');
            });
        }
      }
      function nudge(dx, dy) {
        if (state !== 'play' || paused) return;
        shake.x = dx * 4; shake.y = dy * 4; sfx.nudge();
        if (tilted) return;
        ball.vx += dx * 110; ball.vy += dy * 140;
        tilt += 1;
        if (tilt > 3.2) {
          tilted = true; sfx.tilt(); say('TILT', 4); log('TILT! Flippers dead until the ball drains.', 'pb-bad');
        } else if (tilt > 2 && !warned) { warned = true; sfx.warn(); say('TILT WARNING', 1.6); log('Tilt warning! Easy on the nudges.', 'pb-bad'); }
      }
      function togglePause() {
        if (state === 'attract' || state === 'over') return;
        paused = !paused; releaseAll();
        log(paused ? 'Game paused.' : 'Game resumed.');
      }
      function releaseAll() { for (const k in keys) keys[k] = false; touchL = touchR = 0; touchP = false; touches.clear(); }
      function flipPress(side) {
        if (!active() || tilted) return;
        sfx.flip();
        if (laneFlash > 0) return;
        lanes = side === 'L' ? [lanes[1], lanes[2], lanes[0]] : [lanes[2], lanes[0], lanes[1]];
      }
      function autoLaunch() {
        if (state === 'attract' || state === 'over') { newGame(); return; }
        if (paused) togglePause();
        if (state === 'plunger') { pull = .9; launch(); }
      }

      /* ============ Physics ============ */
      function resolve(b, nx, ny, svx, svy, o) {
        const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
        if (vn >= 0) return;
        const e = Math.abs(vn) < 30 ? 0 : o.e;              // kill micro-bounces so the ball can rest and roll
        b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
        const tx = -ny, ty = nx, vt = (b.vx - svx) * tx + (b.vy - svy) * ty;
        b.vx -= vt * .015 * tx; b.vy -= vt * .015 * ty;
        if (o.hit) o.hit(o, -vn, nx, ny);
      }
      function collideSeg(b, s) {
        let u = ((b.x - s.ax) * s.dx + (b.y - s.ay) * s.dy) / s.len2; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const cx = s.ax + s.dx * u, cy = s.ay + s.dy * u, rr = b.r + s.th;
        let nx = b.x - cx, ny = b.y - cy; const d2 = nx * nx + ny * ny;
        if (d2 >= rr * rr) return;
        if (s.oneWay && (b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny < 0) return;
        const d = Math.sqrt(d2);
        if (d < 1e-6) { nx = -s.dy; ny = s.dx; const l = Math.hypot(nx, ny); nx /= l; ny /= l; } else { nx /= d; ny /= d; }
        b.x += nx * (rr - d); b.y += ny * (rr - d);
        resolve(b, nx, ny, 0, 0, s);
      }
      function collideCircle(b, c) {
        let nx = b.x - c.x, ny = b.y - c.y; const rr = b.r + c.r, d2 = nx * nx + ny * ny;
        if (d2 >= rr * rr) return;
        const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d;
        b.x += nx * (rr - d); b.y += ny * (rr - d);
        resolve(b, nx, ny, 0, 0, c);
      }
      function collideFlip(b, f) {
        const c = Math.cos(f.a), s = Math.sin(f.a), dx = c * f.len, dy = s * f.len;
        let u = ((b.x - f.x) * dx + (b.y - f.y) * dy) / (f.len * f.len); u = u < 0 ? 0 : u > 1 ? 1 : u;
        const px = f.x + dx * u, py = f.y + dy * u, fr = f.r0 + (f.r1 - f.r0) * u, rr = b.r + fr;
        let nx = b.x - px, ny = b.y - py; const d2 = nx * nx + ny * ny;
        if (d2 >= rr * rr) return;
        const d = Math.sqrt(d2);
        if (d < 1e-6) { nx = s; ny = -c; if (ny > 0) { nx = -nx; ny = -ny; } } else { nx /= d; ny /= d; }
        b.x += nx * (rr - d); b.y += ny * (rr - d);
        const qx = px + nx * fr, qy = py + ny * fr;          // contact point on the rubber
        resolve(b, nx, ny, -f.w * (qy - f.y), f.w * (qx - f.x), f);
      }
      function moveFlip(f, h) {
        const target = f.held ? f.up : f.rest, d = target - f.a, sp = (f.held ? 27 : 15) * h;
        if (Math.abs(d) <= sp) { f.w = d / h; f.a = target; } else { f.w = Math.sign(d) * sp / h; f.a += f.w * h; }
      }
      function tunnelCheck(f) {   // debug: did the ball centre cross a flipper's centreline (i.e. pass through it)?
        const c = Math.cos(f.a), s = Math.sin(f.a), rx = ball.x - f.x, ry = ball.y - f.y;
        const along = rx * c + ry * s, side = c * ry - s * rx;
        if (along > 3 && along < f.len - 1 && Math.abs(side) < 30) { if (f.prev != null && Math.sign(side) !== Math.sign(f.prev)) tunnels++; f.prev = side; }
        else f.prev = null;
      }
      function physics(dt) {
        const sp = Math.hypot(ball.vx, ball.vy);
        const n = Math.max(10, Math.ceil(sp * dt / 2.5)), h = dt / n;
        plSeg.ay = plSeg.by = PL_REST + pull * PL_PULL;
        for (let i = 0; i < n; i++) {
          flips.forEach(f => moveFlip(f, h));
          if (!ball.live) continue;
          ball.vy += G * h;
          ball.x += ball.vx * h; ball.y += ball.vy * h;
          for (const s of SEGS) if (!s.off) collideSeg(ball, s);
          for (const c of CIRCLES) collideCircle(ball, c);
          for (const f of flips) { collideFlip(ball, f); tunnelCheck(f); }
          const v = Math.hypot(ball.vx, ball.vy);
          if (v > MAXV) { ball.vx *= MAXV / v; ball.vy *= MAXV / v; }
        }
      }

      /* ============ Step ============ */
      function step(dt) {
        t += dt;
        banner.t = Math.max(0, banner.t - dt);
        shake.x *= .8; shake.y *= .8;
        if (paused) return;
        bumpers.forEach(b => b.flash = Math.max(0, b.flash - dt));
        slings.forEach(s => s.flash = Math.max(0, s.flash - dt));
        targets.forEach(x => x.flash = Math.max(0, x.flash - dt));
        if (laneFlash > 0) { laneFlash -= dt; if (laneFlash <= 0) lanes = [false, false, false]; }
        if (bankReset > 0) { bankReset -= dt; if (bankReset <= 0) targets.forEach(x => { x.down = false; x.seg.off = false; }); }
        tilt = Math.max(0, tilt - dt * .45); if (tilt < 1) warned = false;
        const live = state === 'play' || state === 'plunger';
        flips[0].held = live && !tilted && (keys.L || touchL > 0);
        flips[1].held = live && !tilted && (keys.R || touchR > 0);
        if (state === 'plunger') {
          const holding = (keys.P && !ignoreP) || touchP;
          if (holding) pull = Math.min(1, Math.max(pull + dt * 1.1, swipePull));
          else if (pull > 0) launch();
        }
        if (live) {
          prevX = ball.x;
          physics(dt);
          if (state === 'plunger' && ball.live && (ball.y < 132 || ball.x < 283)) {
            state = 'play'; ballSave = BALL_SAVE; log('Ball in play. Ball save active.');
          }
          if (state === 'play') {
            ballSave = Math.max(0, ballSave - dt);
            if (ball.y > 200) ball.launchPass = false;
            if ((prevX - 160) * (ball.x - 160) <= 0 && prevX !== ball.x && ball.y < 42 && !ball.launchPass) orbitHit();
            if (ball.y > 100) laneLock = -1;
            for (let i = 0; i < 3; i++) if (laneLock !== i && Math.abs(ball.x - LANE_X[i]) < 10 && Math.abs(ball.y - 72) < 12) { laneLock = i; laneHit(i); }
            if (ball.y > 640 || ball.x < -20 || ball.x > W + 20) drain();
          }
        } else flips.forEach(f => moveFlip(f, dt));
        if (state === 'drain') { drainT -= dt; if (drainT <= 0) nextBall(); }
      }

      /* ============ Rendering ============ */
      let S = 1, off = null, oc = null, stat = null;
      function makeLayers(ph) {
        S = ph / H;
        off = document.createElement('canvas'); off.width = Math.round(W * S); off.height = ph; oc = off.getContext('2d');
        stat = document.createElement('canvas'); stat.width = off.width; stat.height = ph;
        drawStatic(stat.getContext('2d'));
      }
      function pathOf(c, pts) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); }
      function strokeWall(c, pts) {
        c.lineJoin = 'round'; c.lineCap = 'round';
        c.save(); c.translate(2.5, 3.5); pathOf(c, pts); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 5; c.stroke(); c.restore();
        pathOf(c, pts); c.strokeStyle = '#3a2c8c'; c.lineWidth = 5; c.stroke();
        c.save(); c.translate(-.6, -.8); pathOf(c, pts); c.shadowColor = '#8a7cff'; c.shadowBlur = 6 * S; c.strokeStyle = '#b5aaff'; c.lineWidth = 1.6; c.stroke(); c.restore();
      }
      function drawStatic(c) {
        c.setTransform(S, 0, 0, S, 0, 0);
        const bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0b0630'); bg.addColorStop(.45, '#1c0c4e'); bg.addColorStop(.8, '#2a0f55'); bg.addColorStop(1, '#120830');
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        const neb = (x, y, r, col) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); };
        neb(70, 330, 160, 'rgba(255,61,138,.22)'); neb(235, 170, 130, 'rgba(34,230,255,.14)'); neb(160, 520, 130, 'rgba(122,60,255,.22)');
        let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
        for (let i = 0; i < 240; i++) { c.globalAlpha = .25 + rnd() * .75; c.fillStyle = rnd() < .15 ? '#9fe8ff' : '#ffffff'; const s = rnd() < .12 ? 1.6 : .8; c.fillRect(rnd() * W, rnd() * H, s, s); }
        c.globalAlpha = 1;
        // ringed planet behind the mid-field
        const px = 150, py = 318;
        c.save(); c.globalAlpha = .55;
        c.strokeStyle = '#ffb86b'; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py, 62, 14, -.25, Math.PI, 2 * Math.PI); c.stroke();
        const pg = c.createRadialGradient(px - 14, py - 14, 4, px, py, 40); pg.addColorStop(0, '#ff9ad5'); pg.addColorStop(.6, '#7a2a9a'); pg.addColorStop(1, '#2a0f55');
        c.fillStyle = pg; c.beginPath(); c.arc(px, py, 38, 0, 7); c.fill();
        c.beginPath(); c.ellipse(px, py, 62, 14, -.25, 0, Math.PI); c.stroke();
        c.restore();
        // perspective grid near the drain
        c.save(); c.strokeStyle = 'rgba(122,107,255,.18)'; c.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const y = 520 + i * i * 3.2; c.beginPath(); c.moveTo(10, y); c.lineTo(286, y); c.stroke(); }
        for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(148 + i * 10, 520); c.lineTo(148 + i * 34, 640); c.stroke(); }
        c.restore();
        c.save(); c.textAlign = 'center'; c.fillStyle = 'rgba(255,230,107,.16)'; c.font = '20px "Press Start 2P", monospace';
        c.fillText('SPACE', 150, 284); c.fillText('PINBALL', 150, 376); c.restore();
        // plunger lane floor
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(286, 142, 24, 470);
        // cabinet outside the playfield
        c.beginPath(); c.rect(0, 0, W, H); pathOf(c, OUTER); c.lineTo(310, H); c.lineTo(10, H); c.closePath();
        const cab = c.createLinearGradient(0, 0, W, 0); cab.addColorStop(0, '#2b1b55'); cab.addColorStop(.5, '#140a30'); cab.addColorStop(1, '#2b1b55');
        c.fillStyle = cab; c.fill('evenodd');
        // inlane chevrons
        c.fillStyle = 'rgba(34,230,255,.35)';
        [[40, 420], [256, 420]].forEach(([x, y]) => { for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(x - 5, y + k * 10); c.lineTo(x, y + 6 + k * 10); c.lineTo(x + 5, y + k * 10); c.lineTo(x, y + 3 + k * 10); c.fill(); } });
        c.fillStyle = 'rgba(255,107,138,.45)'; c.font = '6px "Silkscreen", monospace'; c.textAlign = 'center';
        c.fillText('OUT', 19, 470); c.fillText('OUT', 277, 470);
        DRAW.forEach(p => strokeWall(c, p));
        // lane guide caps
        c.fillStyle = '#d8d0ff'; [103, 137, 171, 205].forEach(x => { c.beginPath(); c.arc(x, 92, 2.5, 0, 7); c.fill(); });
      }
      function glowCircle(c, x, y, r, fill, glow, blur) {
        c.save(); c.shadowColor = glow; c.shadowBlur = blur * S; c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.restore();
      }
      function drawDynamic(c) {
        const blink = Math.sin(t * 10) > 0;
        // plunger: spring + plate
        const py = PL_REST + pull * PL_PULL;
        c.strokeStyle = '#c3c3c6'; c.lineWidth = 1.5; c.beginPath();
        const coils = 9, top = py + 5, bot = 604;
        for (let i = 0; i <= coils * 2; i++) { const y = top + (bot - top) * i / (coils * 2), x = i % 2 ? 304 : 292; i ? c.lineTo(x, y) : c.moveTo(298, y); }
        c.stroke();
        const pg = c.createLinearGradient(288, 0, 308, 0); pg.addColorStop(0, '#85858c'); pg.addColorStop(.5, '#f4f4ff'); pg.addColorStop(1, '#85858c');
        c.fillStyle = pg; c.fillRect(289, py, 18, 5);
        c.fillStyle = pull > 0 ? `rgb(255,${200 - pull * 150 | 0},60)` : '#ff3d6e'; c.fillRect(296, py + 5, 4, 3);
        if (state === 'plunger') { c.fillStyle = 'rgba(255,230,107,.8)'; c.fillRect(312, 600 - 60 * pull, 4, 60 * pull); }
        // top lane lights
        LANE_X.forEach((x, i) => {
          const on = lanes[i] && (laneFlash <= 0 || blink);
          glowCircle(c, x, 62, 5, on ? '#ffe66b' : '#4a3a12', '#ffd23f', on ? 10 : 0);
          c.fillStyle = on ? '#fff8c0' : '#2a2008'; c.beginPath(); c.moveTo(x - 3, 82); c.lineTo(x, 77); c.lineTo(x + 3, 82); c.fill();
        });
        // orbit arrows
        const oa = Math.floor(t * 4) % 3;
        for (let k = 0; k < 3; k++) {
          c.fillStyle = k === oa ? '#22e6ff' : 'rgba(34,230,255,.25)';
          const y = 230 - k * 12; c.beginPath(); c.moveTo(22, y); c.lineTo(28, y - 7); c.lineTo(34, y); c.lineTo(28, y - 3); c.fill();
        }
        // drop targets
        targets.forEach(tg => {
          if (tg.down) { c.fillStyle = '#1a0e08'; c.fillRect(277, tg.y0, 4, tg.y1 - tg.y0); }
          else {
            c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(279, tg.y0 + 3, 6, tg.y1 - tg.y0);
            const gr = c.createLinearGradient(275, 0, 283, 0); gr.addColorStop(0, '#ffd0a0'); gr.addColorStop(.4, '#ff8a3d'); gr.addColorStop(1, '#a8401a');
            c.fillStyle = tg.flash > 0 ? '#ffffff' : gr; c.fillRect(275.5, tg.y0, 7, tg.y1 - tg.y0);
          }
          glowCircle(c, 266, (tg.y0 + tg.y1) / 2, 3, tg.down ? '#ff8a3d' : '#3a1a08', '#ff8a3d', tg.down ? 8 : 0);
        });
        // slingshots
        slings.forEach(s => {
          const p = s.pts;
          c.fillStyle = s.flash > 0 ? 'rgba(255,255,255,.45)' : 'rgba(34,230,255,.16)';
          c.beginPath(); c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.lineTo(p[2][0], p[2][1]); c.closePath(); c.fill();
          c.strokeStyle = '#5a4ad0'; c.lineWidth = 3; c.stroke();
          c.save(); c.shadowColor = '#22e6ff'; c.shadowBlur = (s.flash > 0 ? 14 : 6) * S;
          c.strokeStyle = s.flash > 0 ? '#ffffff' : '#22e6ff'; c.lineWidth = s.flash > 0 ? 3.5 : 2.5;
          c.beginPath(); c.moveTo(p[2][0], p[2][1]); c.lineTo(p[0][0], p[0][1]); c.stroke(); c.restore();
        });
        // pop bumpers (3D: shadow, skirt, cap)
        bumpers.forEach(b => {
          const lit = b.flash > 0;
          c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(b.x + 4, b.y + 6, b.r + 1, b.r * .9, 0, 0, 7); c.fill();
          c.fillStyle = '#3a0f5a'; c.beginPath(); c.arc(b.x, b.y + 4, b.r, 0, 7); c.fill();
          c.fillStyle = '#7a2aa0'; c.beginPath(); c.arc(b.x, b.y + 2, b.r, 0, 7); c.fill();
          const gr = c.createRadialGradient(b.x - 5, b.y - 6, 1, b.x, b.y, b.r);
          if (lit) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#ffd6f4'); gr.addColorStop(1, '#ff5fd0'); }
          else { gr.addColorStop(0, '#ffc2ee'); gr.addColorStop(.55, '#d03a9e'); gr.addColorStop(1, '#5a1060'); }
          c.save(); c.shadowColor = '#ff5fd0'; c.shadowBlur = (lit ? 22 : 8) * S; c.fillStyle = gr; c.beginPath(); c.arc(b.x, b.y - 1, b.r - 2, 0, 7); c.fill(); c.restore();
          c.strokeStyle = lit ? '#ffffff' : '#ffb0e8'; c.lineWidth = 1.2; c.beginPath(); c.arc(b.x, b.y - 1, b.r - 6, 0, 7); c.stroke();
          c.fillStyle = lit ? '#ffffff' : '#ffe6ff';
          c.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 2 : 5; c.lineTo(b.x + Math.cos(a) * r, b.y - 1 + Math.sin(a) * r); } c.fill();
        });
        // rank lights + multiplier + ball save
        for (let i = 0; i < RANKS.length; i++) {
          const a = Math.PI + (i + .5) / RANKS.length * Math.PI, x = 150 + Math.cos(a) * 70, y = 436 + Math.sin(a) * 40;
          const on = i <= rank && state !== 'attract';
          c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
          c.shadowColor = '#5dffb0'; c.shadowBlur = on ? 8 * S : 0; c.fillStyle = on ? '#5dffb0' : '#13402a'; c.fillRect(-3, -3, 6, 6); c.restore();
        }
        c.textAlign = 'center'; c.font = '8px "Press Start 2P", monospace';
        c.fillStyle = state === 'attract' ? '#3a2c5a' : '#ffe66b'; c.fillText(`BONUS x${mult}`, 150, 436);
        c.font = '6px "Press Start 2P", monospace';
        c.fillStyle = state !== 'attract' ? '#9fe8ff' : '#3a2c5a'; c.fillText(RANKS[rank].toUpperCase(), 150, 448);
        const saveOn = (state === 'plunger' && !saved) || (ballSave > 0 && (ballSave > 2 || blink));
        glowCircle(c, 148, 572, 5, saveOn ? '#ff3d6e' : '#3a0f1a', '#ff3d6e', saveOn ? 12 : 0);
        c.fillStyle = saveOn ? '#ffb0c0' : '#4a2030'; c.fillText('SHOOT AGAIN', 148, 590);
        // flippers
        flips.forEach(f => {
          for (const pass of [0, 1]) {
            c.save(); c.translate(f.x + (pass ? 0 : 3), f.y + (pass ? 0 : 4)); c.rotate(f.a);
            c.beginPath(); c.arc(0, 0, f.r0, Math.PI / 2, Math.PI * 1.5); c.lineTo(f.len, -f.r1); c.arc(f.len, 0, f.r1, -Math.PI / 2, Math.PI / 2); c.closePath();
            if (!pass) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fill(); }
            else {
              const gr = c.createLinearGradient(0, -f.r0, 0, f.r0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#c9c9e6'); gr.addColorStop(1, '#6a6a90');
              c.fillStyle = gr; c.fill(); c.strokeStyle = tilted ? '#555' : '#ff3d6e'; c.lineWidth = 2.2; c.stroke();
              c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, 2.5, 0, 7); c.fill();
            }
            c.restore();
          }
        });
        // ball
        if (ball.live) {
          c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(ball.x + 3.5, ball.y + 4.5, BR, BR * .85, 0, 0, 7); c.fill();
          const gr = c.createRadialGradient(ball.x - 2.5, ball.y - 3, .5, ball.x, ball.y, BR);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#d4d7ec'); gr.addColorStop(1, '#4a4f6e');
          c.fillStyle = gr; c.beginPath(); c.arc(ball.x, ball.y, BR, 0, 7); c.fill();
        }
      }
      const TOP = .84, FS = .16, fy = u => u - FS * u + FS * u * u;
      function present() {
        const DW = cv.width, DH = cv.height, OW = off.width, OH = off.height;
        g.setTransform(1, 0, 0, 1, 0, 0);
        const side = g.createLinearGradient(0, 0, DW, 0); side.addColorStop(0, '#1a1040'); side.addColorStop(.5, '#05030f'); side.addColorStop(1, '#1a1040');
        g.fillStyle = side; g.fillRect(0, 0, DW, DH);
        const ox = shake.x * S, oy = shake.y * S, stp = Math.max(1, Math.round(OH / 360));
        for (let sy = 0; sy < OH; sy += stp) {
          const hh = Math.min(stp, OH - sy), u0 = sy / OH, u1 = (sy + hh) / OH;
          const y0 = fy(u0) * DH, y1 = fy(u1) * DH, w = DW * (TOP + (1 - TOP) * (u0 + u1) / 2);
          g.drawImage(off, 0, sy, OW, hh, (DW - w) / 2 + ox, y0 + oy, w, y1 - y0 + .8);
        }
        // chrome side rails along the trapezoid edges
        g.strokeStyle = '#8a8ab0'; g.lineWidth = Math.max(1, S);
        g.beginPath(); g.moveTo(DW * (1 - TOP) / 2 + ox, oy); g.lineTo(ox, DH + oy); g.moveTo(DW - DW * (1 - TOP) / 2 + ox, oy); g.lineTo(DW + ox, DH + oy); g.stroke();
      }
      function overlay() {
        const DW = cv.width, DH = cv.height, fs = Math.max(10, Math.round(DW / 19));
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const box = (lines, col) => {
          const lh = fs * 1.7, bh = lines.length * lh + fs, bw = DW * .82, x = (DW - bw) / 2, y = DH * .42 - bh / 2;
          g.fillStyle = 'rgba(5,3,20,.82)'; g.fillRect(x, y, bw, bh);
          g.strokeStyle = '#7a6bff'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
          lines.forEach((l, i) => { g.font = `${i ? Math.round(fs * .62) : fs}px "Press Start 2P", monospace`; g.fillStyle = i ? '#cfe3ff' : col; g.fillText(l, DW / 2, y + fs * .5 + lh * (i + .5)); });
        };
        if (state === 'attract') box(['SPACE PINBALL', coarse ? 'TAP TO START' : 'PRESS F2 OR SPACE', 'TO START A GAME'], '#ffe66b');
        else if (state === 'over') box(['GAME OVER', 'SCORE ' + fmt(score), coarse ? 'TAP FOR A NEW GAME' : 'F2 FOR A NEW GAME'], '#ff6b8a');
        else if (paused) box(['PAUSED', coarse ? 'TAP TO RESUME' : 'PRESS F3 TO RESUME'], '#8dfff0');
        if (banner.t > 0 && state !== 'attract') {
          const big = banner.text === 'TILT';
          if (!big || Math.sin(t * 12) > -.4) {
            g.font = `${big ? fs * 2 : fs}px "Press Start 2P", monospace`;
            g.save(); g.shadowColor = big ? '#ff2a1a' : '#ff5fd0'; g.shadowBlur = fs;
            g.fillStyle = big ? '#ff3d3d' : '#ffe66b'; g.fillText(banner.text, DW / 2, DH * .2); g.restore();
          }
        }
        g.textBaseline = 'alphabetic';
      }
      const last = {};
      const setF = (k, v) => { if (last[k] !== v) { last[k] = v; F(k).textContent = v; } };
      function updatePanel() {
        setF('ball', state === 'attract' ? '-' : String(ballNum));
        setF('score', fmt(score));
        setF('rank', RANKS[rank]);
        setF('mission', state === 'attract' ? 'Mission: launch a game to receive orders.' : `Mission: ${missionText()} (${Math.min(mission.n, mission.need)}/${mission.need})`);
      }
      function render() {
        if (!off) return;
        oc.setTransform(1, 0, 0, 1, 0, 0); oc.drawImage(stat, 0, 0);
        oc.setTransform(S, 0, 0, S, 0, 0); drawDynamic(oc);
        present(); overlay(); updatePanel();
      }

      /* ============ Layout ============ */
      function fit() {
        const narrow = innerWidth <= 600, maxed = win.win.classList.contains('max');
        const panelH = narrow ? panel.offsetHeight + 4 : 0;
        let aw, ah;
        if (maxed) { aw = win.body.clientWidth - 10 - (narrow ? 0 : 186); ah = win.body.clientHeight - 10 - panelH; }
        else { aw = narrow ? innerWidth - 34 : 2000; ah = innerHeight - 32 - 118 - panelH; }
        const h = Math.floor(Math.max(240, Math.min(ah, aw / ASPECT, maxed ? 3000 : 780))), w = Math.floor(h * ASPECT);
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
        const dpr = Math.min(2, devicePixelRatio || 1), pw = Math.round(w * dpr), ph = Math.round(h * dpr);
        if (cv.width !== pw || cv.height !== ph || !off) { cv.width = pw; cv.height = ph; makeLayers(ph); }
      }
      addEventListener('resize', () => { if (!win.win.hidden) fit(); });
      win.on('resize', () => requestAnimationFrame(fit));
      win.on('open', () => requestAnimationFrame(fit));

      /* ============ Input ============ */
      const KEYS = { KeyZ: 'L', ShiftLeft: 'L', ArrowLeft: 'L', Slash: 'R', ShiftRight: 'R', ArrowRight: 'R', Space: 'P', ArrowDown: 'P', Enter: 'start',
        KeyX: 'nl', Period: 'nr', ArrowUp: 'nu', F2: 'new', F3: 'pause', KeyM: 'mute' };
      win.onKey(e => {
        const k = KEYS[e.code]; if (!k) return;
        e.preventDefault(); if (e.repeat) return;
        if (k === 'L' || k === 'R') { if (!keys[k]) flipPress(k); keys[k] = true; }
        else if (k === 'P') { if (state === 'attract' || state === 'over') { newGame(); ignoreP = true; } else if (paused) togglePause(); keys.P = true; }
        else if (k === 'start') { if (state === 'attract' || state === 'over') newGame(); else if (paused) togglePause(); }
        else if (k === 'new') newGame();
        else if (k === 'pause') togglePause();
        else if (k === 'nl') nudge(1, 0);
        else if (k === 'nr') nudge(-1, 0);
        else if (k === 'nu') nudge(0, -1);
        else if (k === 'mute') Arcade.setMuted(!Arcade.isMuted());
      });
      win.onKeyUp(e => {
        const k = KEYS[e.code]; if (!k) return;
        if (k === 'L' || k === 'R') keys[k] = false;
        if (k === 'P') { keys.P = false; ignoreP = false; }
      });
      const touches = new Map();
      cv.addEventListener('pointerdown', e => {
        e.preventDefault(); win.focus();
        if (paused) { togglePause(); return; }
        if (state === 'attract' || state === 'over') { newGame(); return; }
        const r = cv.getBoundingClientRect(), right = e.clientX > r.left + r.width / 2;
        const role = right && state === 'plunger' && onPlunger() ? 'P' : right ? 'R' : 'L';
        touches.set(e.pointerId, { role, y0: e.clientY, h: r.height });
        try { cv.setPointerCapture(e.pointerId); } catch {}
        if (role === 'P') { touchP = true; swipePull = 0; }
        else { if (role === 'L') touchL++; else touchR++; flipPress(role); }
      });
      cv.addEventListener('pointermove', e => {
        const tc = touches.get(e.pointerId);
        if (tc && tc.role === 'P') swipePull = Math.max(0, Math.min(1, (e.clientY - tc.y0) / (tc.h * .16)));
      });
      const up = e => {
        const tc = touches.get(e.pointerId); if (!tc) return; touches.delete(e.pointerId);
        if (tc.role === 'P') touchP = false; else if (tc.role === 'L') touchL = Math.max(0, touchL - 1); else touchR = Math.max(0, touchR - 1);
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('contextmenu', e => e.preventDefault());
      win.on('blur', () => { if (state === 'play' || state === 'plunger') { if (!paused) log('Game paused.'); paused = true; } releaseAll(); pull = 0; });
      win.on('close', () => { if (state === 'play' || state === 'plunger') paused = true; releaseAll(); });
      win.status(coarse ? 'Tap left/right half: flippers · hold right + swipe down: launch' : 'Z and / flippers · Space plunger · X . ↑ nudge', 'F2 new · F3 pause');

      /* ============ Loop ============ */
      let lastT = performance.now(), acc = 0;
      function frame(now) {
        const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
        if (win.isVisible()) {
          acc += dt;
          while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
          render();
        } else acc = 0;
        requestAnimationFrame(frame);
      }
      log('Welcome to Space Pinball.');
      log(coarse ? 'Tap the table to start a game.' : 'Press F2 or Space to start a game.');
      fit();
      requestAnimationFrame(frame);

      Object.assign(api, { newGame, togglePause, autoLaunch });
      // test hooks (used by tools/smoke.mjs scripted checks)
      def.test = {
        info: () => ({ state, paused, score, ballNum, rank, mult, lanes: lanes.slice(), targets: targets.map(x => x.down), mission: { ...mission, text: missionText() },
          ball: { x: +ball.x.toFixed(1), y: +ball.y.toFixed(1), vx: +ball.vx.toFixed(0), vy: +ball.vy.toFixed(0), live: ball.live },
          flips: flips.map(f => +f.a.toFixed(3)), tunnels, tilted, ballSave: +ballSave.toFixed(2), pull: +pull.toFixed(2), keyP: !!keys.P }),
        newGame,
        place(x, y, vx = 0, vy = 0) { Object.assign(ball, { x, y, vx, vy, live: true, launchPass: false }); state = 'play'; paused = false; flips.forEach(f => f.prev = null); },
        hold(side, on) { keys[side] = on; },
        restFlippers() { flips.forEach(f => { f.a = f.rest; f.w = 0; f.held = false; }); keys.L = keys.R = false; },
        step(n = 1) { for (let i = 0; i < n; i++) step(1 / 60); return def.test.info(); },
        resetTunnels() { tunnels = 0; },
        setScore(s) { score = s; },
        noSave() { ballSave = 0; saved = true; }
      };
    }
  });
})();

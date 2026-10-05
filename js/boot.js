/* Boot + power: POST screen, splash, startup chime, the Shut Down dialog (shut down / restart / MS-DOS mode / log off),
   Ctrl+Alt+Del "Close Program", and the blue screen. Sets Arcade.hooks.shutdown. Uses Arcade.apps.dos.console from dos.js. */
(() => {
  const S = Arcade.store, el = Arcade.el, esc = Arcade.esc;
  const activated = () => !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  const LOGO = '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="6" y="20" width="20" height="8" fill="#2a2a33"/><rect x="5" y="21" width="22" height="6" fill="#2a2a33"/><rect x="7" y="21" width="18" height="2" fill="#5a5a66"/><rect x="6" y="27" width="20" height="1" fill="#111"/><rect x="15" y="9" width="3" height="13" fill="#111"/><rect x="16" y="9" width="1" height="12" fill="#555"/><rect x="12" y="3" width="9" height="8" fill="#d8262b"/><rect x="11" y="4" width="11" height="6" fill="#d8262b"/><rect x="13" y="4" width="3" height="2" fill="#ff8a7a"/><rect x="12" y="10" width="9" height="1" fill="#8a1014"/><rect x="21" y="22" width="3" height="2" fill="#ffd23f"/><rect x="8" y="23" width="3" height="2" fill="#2fb4ff"/></svg>';
  const PC = '<svg width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="1" width="12" height="9" fill="#c3c3c6"/><rect x="2" y="1" width="12" height="1" fill="#fff"/><rect x="3" y="2" width="10" height="7" fill="#000"/><rect x="4" y="3" width="8" height="5" fill="#0b7a78"/><rect x="5" y="10" width="6" height="2" fill="#85858c"/><rect x="1" y="12" width="14" height="3" fill="#c3c3c6"/><rect x="1" y="14" width="14" height="1" fill="#555"/><rect x="11" y="13" width="2" height="1" fill="#2a2"/></svg>';
  const KEY = '<svg width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="4" width="6" height="6" fill="#e0b400"/><rect x="2" y="5" width="4" height="4" fill="#ffd94a"/><rect x="3" y="6" width="2" height="2" fill="#7a5a00"/><rect x="7" y="6" width="8" height="2" fill="#e0b400"/><rect x="11" y="8" width="2" height="2" fill="#e0b400"/><rect x="13" y="8" width="2" height="3" fill="#e0b400"/></svg>';

  Arcade.css(`
  .boot-ov { position: fixed; inset: 0; z-index: 99995; background: #000; color: #aaa; overflow: hidden; cursor: default; transition: opacity .45s; -webkit-user-select: none; user-select: none; }
  .boot-ov.boot-out { opacity: 0; }
  .boot-post { position: absolute; inset: 0; padding: max(14px, 3vh) max(12px, 3vw); font: bold clamp(8px, 2.55vw, 18px)/1.3 "Courier New", Consolas, Menlo, monospace; white-space: pre; }
  .boot-post b { color: #fff; font-weight: bold; }
  .boot-post .boot-foot { position: absolute; left: max(12px, 3vw); bottom: max(14px, 3vh); }
  .boot-star { position: absolute; right: max(12px, 3vw); top: max(14px, 3vh); width: clamp(64px, 17vw, 150px); text-align: center; color: #3fd17a;
    border: 2px solid #3fd17a; padding: 4px 4px 2px; font: bold clamp(7px, 1.5vw, 12px)/1.2 "Courier New", monospace; }
  .boot-star svg { width: 56%; display: block; margin: 0 auto 2px; image-rendering: pixelated; }
  .boot-cur { animation: boot-blink 1s steps(1) infinite; }
  @keyframes boot-blink { 50% { opacity: 0; } }
  .boot-splash { position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden;
    background: linear-gradient(#1f5fcf 0%, #4f8fe6 45%, #9cc6f4 80%, #d6e8fb 100%); }
  .boot-clouds { position: absolute; inset: -10% -20%; animation: boot-drift 14s linear infinite;
    background:
      radial-gradient(ellipse 14% 6% at 18% 22%, rgba(255,255,255,.95), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 10% 5% at 24% 25%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 18% 7% at 72% 16%, rgba(255,255,255,.85), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 12% 5% at 80% 20%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 20% 8% at 40% 72%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 12% 5% at 50% 76%, rgba(255,255,255,.85), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 16% 6% at 88% 62%, rgba(255,255,255,.8), rgba(255,255,255,0) 70%),
      radial-gradient(ellipse 14% 6% at 8% 58%, rgba(255,255,255,.8), rgba(255,255,255,0) 70%); }
  @keyframes boot-drift { from { transform: translateX(0); } to { transform: translateX(6%); } }
  .boot-logo { position: relative; display: flex; align-items: center; gap: clamp(10px, 3vw, 26px); padding: 0 16px; max-width: 100%; }
  .boot-logo svg { width: clamp(64px, 16vw, 132px); height: auto; image-rendering: pixelated; filter: drop-shadow(4px 4px 0 rgba(0,0,40,.35)); flex: none; }
  .boot-word { color: #fff; font: clamp(20px, 6vw, 54px)/1.1 var(--display); text-shadow: 3px 3px 0 #0a1a86, 5px 5px 0 rgba(0,0,40,.25); white-space: nowrap; }
  .boot-word span { display: inline-block; margin-left: .25em; color: #ffd23f; text-shadow: 3px 3px 0 #b13c1a, 5px 5px 0 rgba(0,0,40,.25); }
  .boot-word small { display: block; font: bold clamp(10px, 2vw, 14px) var(--ui); letter-spacing: .3em; margin-top: 10px; text-shadow: 1px 1px 0 #0a1a86; color: #e8f1ff; }
  .boot-bar { position: absolute; left: 0; right: 0; bottom: 0; height: clamp(6px, 1.4vh, 12px); background: linear-gradient(90deg, #1b3dd6, #18a3e6, #3fd17a, #ffd23f, #ff5a36, #b13cd6, #1b3dd6) 0 0 / 50% 100% repeat-x;
    animation: boot-scroll 1.1s linear infinite; }
  @keyframes boot-scroll { to { background-position: -50vw 0, 0 0; } }
  .boot-msg { position: absolute; left: 0; right: 0; bottom: 18%; text-align: center; color: #fff; font: bold clamp(14px, 3.4vw, 26px) var(--ui); text-shadow: 2px 2px 0 #0a1a86; padding: 0 16px; }
  @media (prefers-reduced-motion: reduce) { .boot-clouds, .boot-bar { animation: none; } }
  @media (max-width: 600px) {
    .boot-star { position: static; margin: 0 0 10px auto; width: 72px; }
    .boot-word, .boot-word span { text-shadow: 2px 2px 0 #0a1a86; }
  }

  .boot-veil { position: fixed; inset: 0; z-index: 99990; display: grid; place-items: center; padding: 12px; }
  .boot-dither { background: repeating-conic-gradient(#000 0 25%, transparent 0 50%) 0 0 / 2px 2px; }
  .boot-logon-bg { background: var(--desk); }
  .boot-dlg { position: relative !important; width: min(380px, 100%); max-width: 100%; color: var(--ink); }
  .boot-dlg .tb-btns button { font-size: 11px; }
  .boot-body { display: flex; gap: 14px; padding: 14px 14px 6px; align-items: flex-start; }
  .boot-body > svg { flex: none; image-rendering: pixelated; }
  .boot-body p { margin: 0 0 8px; }
  .boot-radios label { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
  .boot-radios input { margin: 0; accent-color: #000; }
  .boot-actions { display: flex; justify-content: center; gap: 6px; padding: 8px 10px 10px; flex-wrap: wrap; }
  .boot-help { margin: 0 14px 4px 60px; padding: 6px 8px; background: var(--tip); color: #101014; border: 1px solid #000; font-size: 11px; }
  .boot-logon label { display: grid; grid-template-columns: 80px 1fr; align-items: center; gap: 6px; margin-bottom: 8px; }
  .boot-logon .field { width: 100%; min-width: 0; }
  .boot-logon .boot-side { display: flex; flex-direction: column; gap: 6px; }
  .boot-logon .btn { min-width: 70px; }
  .boot-cp { width: min(340px, 100%); }
  .boot-cp .boot-in { padding: 10px 10px 0; }
  .boot-list { height: 132px; overflow: auto; padding: 2px; outline: none; }
  .boot-list div { padding: 2px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .boot-list div.boot-sel { background: var(--sel); color: var(--sel-ink); }
  .boot-list:focus div.boot-sel { outline: 1px dotted var(--sel-ink); outline-offset: -1px; }
  .boot-cp p { margin: 10px 0 0; font-size: 11px; }
  .boot-bsod { position: fixed; inset: 0; z-index: 99998; background: #0000aa; color: #fff; display: grid; place-items: center; padding: 12px; cursor: default;
    font: clamp(8px, 2.15vw, 20px)/1.35 "Courier New", "Lucida Console", Consolas, monospace; }
  .boot-bsod pre { font: inherit; margin: 0; white-space: pre-wrap; max-width: 100%; }
  .boot-bsod .boot-h { display: inline-block; background: #aaa; color: #0000aa; padding: 0 .5ch; }
  .boot-dos { position: fixed; inset: 0; z-index: 99994; background: #000; }
  `);

  /* ---------- sound (original; WebAudio only) ---------- */
  function bus(a, wetAmt) {
    const dry = a.createGain(), wet = a.createGain(); wet.gain.value = wetAmt;
    dry.connect(a.destination); wet.connect(a.destination);
    const nodes = [dry, wet];
    [[.23, .48, 2600], [.37, .4, 1800], [.53, .3, 1200]].forEach(([dt, fb, hz]) => {
      const d = a.createDelay(1), f = a.createGain(), lp = a.createBiquadFilter();
      d.delayTime.value = dt; f.gain.value = fb; lp.type = 'lowpass'; lp.frequency.value = hz;
      dry.connect(d); d.connect(lp); lp.connect(f); f.connect(d); lp.connect(wet); nodes.push(d, f, lp);
    });
    return { dry, done: ms => setTimeout(() => nodes.forEach(n => { try { n.disconnect(); } catch {} }), ms) };
  }
  function tone(a, out, f, t, dur, vol, type = 'sine', att = .03, detune = 0) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
  }
  function chime() {
    if (Arcade.isMuted()) return; const a = Arcade.audio(); if (!a) return;
    const b = bus(a, .38), t = a.currentTime + .06;
    // rising Ebmaj9 arpeggio, then a slow Abmaj7(#11) pad and two bell tones on top
    [311.13, 466.16, 587.33, 698.46, 932.33].forEach((f, i) => {
      tone(a, b.dry, f, t + i * .16, 2.4, .05, 'sine', .02); tone(a, b.dry, f * 2, t + i * .16, .9, .012, 'triangle', .01);
    });
    [207.65, 311.13, 392, 523.25, 587.33].forEach(f => { tone(a, b.dry, f, t + .8, 3.2, .028, 'sine', 1.1, -7); tone(a, b.dry, f, t + .8, 3.2, .028, 'triangle', 1.1, 7); });
    tone(a, b.dry, 1244.51, t + 1.55, 1.9, .03, 'sine', .01); tone(a, b.dry, 1567.98, t + 1.95, 2.1, .022, 'sine', .01);
    tone(a, b.dry, 155.56, t + .8, 3.3, .05, 'sine', .6);
    b.done(7500);
  }
  function jingle() {
    if (Arcade.isMuted()) return; const a = Arcade.audio(); if (!a) return;
    const b = bus(a, .32), t = a.currentTime + .04;
    [932.33, 698.46, 587.33, 466.16, 349.23].forEach((f, i) => tone(a, b.dry, f, t + i * .2, 1.4, .045, i % 2 ? 'triangle' : 'sine', .02));
    [233.08, 349.23, 466.16].forEach(f => tone(a, b.dry, f, t + .9, 1.8, .03, 'sine', .4));
    b.done(5000);
  }

  /* ---------- boot sequence ---------- */
  let booting = null;
  const POST_FOOT = 'Press <b>DEL</b> to enter SETUP\n08/24/95-i430FX-ARCADE95-2A59GA0BC-00';
  function runBoot(full, done) {
    if (booting) booting.finish(false);
    Arcade.closeStart(); Arcade.blurAll();
    const ov = el('<div class="boot-ov" role="img" aria-label="Arcade 95 is starting. Press any key to skip."></div>');
    document.body.appendChild(ov);
    let dead = false, chimed = false;
    const timers = [];
    const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
    const playChime = () => { if (!chimed) { chimed = true; chime(); } };
    function finish(gesture) {
      if (dead) return; dead = true; booting = null;
      timers.forEach(clearTimeout);
      removeEventListener('keydown', skip, true); removeEventListener('pointerdown', skip, true);
      if (activated()) playChime(); // Escape and modifier keys don't count as a gesture, so ask the browser
      ov.classList.add('boot-out');
      setTimeout(() => ov.remove(), gesture ? 220 : 470);
      if (done) done();
    }
    function skip(e) {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); finish(true);
    }
    addEventListener('keydown', skip, true); addEventListener('pointerdown', skip, true);
    booting = { finish };
    (async () => {
      if (full) {
        const cpus = navigator.hardwareConcurrency || 1, dm = navigator.deviceMemory, memK = dm ? Math.round(dm * 1048576) : 16384;
        ov.innerHTML = `<div class="boot-post"><div class="boot-star">${LOGO}ARCADE<br>ALLY</div><div class="boot-txt"></div><div class="boot-foot">${POST_FOOT}</div></div>`;
        const txt = ov.querySelector('.boot-txt');
        const add = html => { txt.insertAdjacentHTML('beforeend', html + '\n'); };
        add('<b>Pixelworks Modular BIOS v4.51PG</b>, An Arcade Power Ally');
        add('Copyright (C) 1984-95, Pixelworks Software, Inc.\n');
        add('ARCADE95 PCI/ISA Mainboard  Rev. 1.2\n');
        await wait(300); if (dead) return;
        add(`Pentium-class processor x ${cpus}  133MHz`);
        add('Memory Test :  <span class="boot-mem">0K</span><span class="boot-cur">_</span>');
        const mem = txt.querySelector('.boot-mem'), cur = txt.querySelector('.boot-cur');
        const t0 = performance.now(), dur = 1500;
        await new Promise(res => {
          const step = () => {
            if (dead) return res();
            const p = Math.min(1, (performance.now() - t0) / dur);
            mem.textContent = Math.round(memK * p) + 'K';
            if (p < 1) requestAnimationFrame(step); else res();
          };
          requestAnimationFrame(step);
        });
        if (dead) return;
        mem.textContent = memK + 'K OK'; cur.remove();
        if (activated()) Arcade.beep(988, .12, 'square', .03);
        await wait(350); if (dead) return;
        add('\nPixelworks Plug and Play BIOS Extension v1.0A');
        add('Copyright (C) 1995, Pixelworks Software, Inc.');
        for (const l of ['Detecting IDE Primary Master   ... <b>ARCADE95 HDD 2048MB</b>', 'Detecting IDE Primary Slave    ... None',
          'Detecting IDE Secondary Master ... <b>ARCADE95 CD-ROM 4X</b>', 'Detecting IDE Secondary Slave  ... None']) {
          await wait(260); if (dead) return; add('    ' + l);
        }
        await wait(600); if (dead) return;
        ov.innerHTML = '<div class="boot-post">Starting Windows 95...\n\n<span class="boot-cur">_</span></div>';
        await wait(1000); if (dead) return;
      }
      ov.innerHTML = `<div class="boot-splash"><div class="boot-clouds"></div><div class="boot-logo">${LOGO}<div class="boot-word">Arcade<span>95</span><small>INSERT COIN TO CONTINUE</small></div></div><div class="boot-bar"></div></div>`;
      await wait(full ? 2600 : 1200); if (dead) return;
      finish(false);
    })();
  }

  /* ---------- modal helpers ---------- */
  function modal(cls, html) {
    Arcade.closeStart(); Arcade.blurAll();
    const v = el(`<div class="boot-veil ${cls}">${html}</div>`);
    document.body.appendChild(v);
    v.addEventListener('keydown', e => e.stopPropagation());
    return v;
  }
  const titlebar = t => `<div class="titlebar"><span class="ttl"><span>${esc(t)}</span></span><div class="tb-btns"><button data-act="help" aria-label="Help">?</button><button data-act="close" aria-label="Close">×</button></div></div>`;

  /* ---------- Shut Down Windows ---------- */
  let sdOpen = null;
  function shutdownDialog() {
    if (sdOpen || booting) return;
    if (cp) cp.close();
    const opts = [['off', 'S', 'hut down the computer?'], ['restart', 'R', 'estart the computer?'], ['dos', '', 'Restart the computer in <u>M</u>S-DOS mode?'], ['logoff', 'C', 'lose all programs and log on as a different user?']];
    const v = modal('boot-dither', `<div class="win bevel-out active boot-dlg" role="dialog" aria-label="Shut Down Windows">${titlebar('Shut Down Windows')}
      <div class="boot-body">${PC}<div><p>Are you sure you want to:</p><div class="boot-radios">
        ${opts.map(([v, k, t], i) => `<label><input type="radio" name="boot-sd" value="${v}"${i ? '' : ' checked'}>${k ? `<span><u>${k}</u>${t}</span>` : `<span>${t}</span>`}</label>`).join('')}
      </div></div></div>
      <div class="boot-help" hidden>Shut down turns Arcade 95 off. Restart plays the boot sequence again. MS-DOS mode gives you a full-screen command prompt (type WIN to come back). The last option changes the name Arcade 95 calls you.</div>
      <div class="boot-actions"><button class="btn" data-b="yes">Yes</button><button class="btn" data-b="no">No</button><button class="btn" data-b="help">Help</button></div></div>`);
    const close = () => { v.remove(); sdOpen = null; };
    sdOpen = { close };
    const help = () => { const h = v.querySelector('.boot-help'); h.hidden = !h.hidden; };
    const yes = () => {
      const choice = v.querySelector('input[name="boot-sd"]:checked').value; close();
      if (choice === 'off') shutDown(); else if (choice === 'restart') { Arcade.closeAll(); runBoot(true); }
      else if (choice === 'dos') { Arcade.closeAll(); dosMode(); } else logon();
    };
    v.querySelector('[data-b="yes"]').onclick = yes;
    v.querySelector('[data-b="no"]').onclick = close;
    v.querySelector('[data-b="help"]').onclick = help;
    v.querySelector('[data-act="help"]').onclick = help;
    v.querySelector('[data-act="close"]').onclick = close;
    v.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); yes(); return; }
      const k = { s: 0, r: 1, m: 2, c: 3 }[(e.key || '').toLowerCase()];
      if (k != null && !e.ctrlKey && !e.altKey) { const r = v.querySelectorAll('input[name="boot-sd"]')[k]; r.checked = true; r.focus(); }
    });
    setTimeout(() => v.querySelector('[data-b="yes"]').focus(), 0);
  }
  function shutDown() {
    Arcade.closeAll(); jingle();
    const ov = el(`<div class="boot-ov"><div class="boot-splash"><div class="boot-clouds"></div><div class="boot-logo">${LOGO}<div class="boot-word">Arcade<span>95</span></div></div><div class="boot-msg">Please wait while your computer shuts down.</div></div></div>`);
    document.body.appendChild(ov);
    setTimeout(() => { Arcade.safeToTurnOff(); ov.remove(); }, 2400);
  }
  // "Click anywhere to boot back up" gets a real boot
  const sdScreen = document.getElementById('shutdown');
  if (sdScreen) sdScreen.addEventListener('click', () => runBoot(true));

  /* ---------- MS-DOS mode ---------- */
  let dos = null;
  function dosMode() {
    const host = el('<div class="boot-dos"></div>'); document.body.appendChild(host);
    Arcade.blurAll();
    const leave = after => {
      if (!dos) return; const d = dos; dos = null;
      removeEventListener('keydown', d.onKey); d.con && d.con.destroy(); host.remove();
      if (after !== 'raw') runBoot(false, typeof after === 'function' ? after : null);
    };
    const make = Arcade.apps.dos && Arcade.apps.dos.console;
    if (!make) {
      host.innerHTML = '<div class="boot-post">Bad or missing command interpreter\nPress any key to return to Arcade 95.</div>';
      const onKey = () => leave(); dos = { onKey, leave }; setTimeout(() => addEventListener('keydown', onKey), 50); host.onclick = onKey; return;
    }
    const con = make(host, {
      full: true, cwd: [],
      banner: '\nArcade(R) 95\n   (C)Copyright Arcade 95 Team 1981-1995.\n\nYou are in MS-DOS mode. Type WIN to return to Arcade 95.\n\n',
      exit: () => leave(), win: () => leave(), launch: id => leave(() => Arcade.open(id))
    });
    const onKey = e => { if (con.handleKey(e)) e.preventDefault(); };
    dos = { con, onKey, leave };
    addEventListener('keydown', onKey);
    host.addEventListener('pointerup', () => con.focus());
    con.focus();
  }

  /* ---------- log on as a different user ---------- */
  function logon() {
    Arcade.closeAll();
    const v = modal('boot-logon-bg', `<div class="win bevel-out active boot-dlg" role="dialog" aria-label="Welcome to Windows" style="width:min(420px,100%)">${titlebar('Welcome to Windows')}
      <div class="boot-body boot-logon">${KEY}<div style="flex:1;min-width:0"><p>Type a user name and password to log on to Windows.</p>
        <label>User name: <input class="field" data-f="user" maxlength="24" autocomplete="off"></label>
        <label>Password: <input class="field" data-f="pw" type="password" autocomplete="off"></label></div>
        <div class="boot-side"><button class="btn" data-b="ok">OK</button><button class="btn" data-b="cancel">Cancel</button></div></div>
      <div class="boot-help" hidden>Any password works. Arcade 95 only remembers the user name, and only to be polite.</div></div>`);
    const user = v.querySelector('[data-f="user"]');
    user.value = S.get('user.name', 'Player 1');
    const done = () => { S.set('user.name', user.value.trim() || 'Player 1'); v.remove(); };
    v.querySelector('[data-b="ok"]').onclick = done;
    v.querySelector('[data-b="cancel"]').onclick = () => v.remove();
    v.querySelector('[data-act="close"]').onclick = () => v.remove();
    v.querySelector('[data-act="help"]').onclick = () => { const h = v.querySelector('.boot-help'); h.hidden = !h.hidden; };
    v.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); done(); } else if (e.key === 'Escape') v.remove(); });
    setTimeout(() => { user.focus(); user.select(); }, 0);
  }

  /* ---------- Ctrl+Alt+Del: Close Program, then the blue screen ---------- */
  let cp = null, bsod = null;
  const topWindow = () => {
    let best = null, z = -1;
    Arcade.openWindows().forEach(w => { const zi = +w.ctx.win.style.zIndex || 0; if (!w.ctx.win.dataset.min && zi > z) { z = zi; best = w; } });
    return best;
  };
  function closeProgram() {
    if (cp || booting) return;
    if (sdOpen) sdOpen.close();
    const victim = topWindow();
    const rows = Arcade.openWindows().map(w => ({ label: w.title, w })).concat([{ label: 'Explorer' }, { label: 'Systray' }]);
    let sel = Math.max(0, victim ? rows.findIndex(r => r.w && r.w.id === victim.id) : 0);
    const v = modal('', `<div class="win bevel-out active boot-dlg boot-cp" role="dialog" aria-label="Close Program">${titlebar('Close Program')}
      <div class="boot-in"><div class="boot-list field" role="listbox" tabindex="0"></div>
      <p>WARNING: Pressing CTRL+ALT+DEL again will restart your computer. You will lose unsaved information in all programs that are running.</p></div>
      <div class="boot-actions"><button class="btn" data-b="end">End Task</button><button class="btn" data-b="shut">Shut Down</button><button class="btn" data-b="cancel">Cancel</button></div></div>`);
    const list = v.querySelector('.boot-list');
    const render = () => {
      list.innerHTML = '';
      rows.forEach((r, i) => {
        const d = el('<div role="option"></div>'); d.textContent = r.label; if (i === sel) { d.className = 'boot-sel'; d.setAttribute('aria-selected', 'true'); }
        d.onclick = () => { sel = i; render(); }; d.ondblclick = endTask; list.appendChild(d);
      });
    };
    const close = () => { v.remove(); cp = null; };
    function endTask() {
      const r = rows[sel]; close();
      if (r.w) r.w.ctx.close();
      else Arcade.dialog({ title: r.label, icon: 'warn', text: `${r.label} is holding Arcade 95 together. Ending it would leave you staring at a teal void, so it stays.` });
    }
    cp = { close, victim };
    render();
    v.querySelector('[data-b="end"]').onclick = endTask;
    v.querySelector('[data-b="shut"]').onclick = () => { close(); shutdownDialog(); };
    v.querySelector('[data-b="cancel"]').onclick = close;
    v.querySelector('[data-act="close"]').onclick = close;
    v.querySelector('[data-act="help"]').onclick = () => Arcade.dialog({ title: 'Close Program', text: 'Pick a program and press End Task to close it. Press Ctrl+Alt+Del again if you are feeling brave.' });
    v.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); endTask(); }
      else if (e.key === 'Escape') close();
    });
    setTimeout(() => list.focus(), 0);
  }
  function blueScreen() {
    const victim = cp ? cp.victim : topWindow();
    if (cp) cp.close();
    const ov = el(`<div class="boot-bsod" role="alert"><pre>${[
      '                              <span class="boot-h">Windows</span>', '',
      '  A fatal exception 0E has occurred at 0028:C0011E36 in VXD VMM(01) +',
      '  00010E36. The current application will be terminated.', '',
      '  *  Press any key to terminate the current application.',
      '  *  Press CTRL+ALT+DEL again to restart your computer. You will',
      '     lose any unsaved information in all applications.', '',
      '                        Press any key to continue <span class="boot-cur">_</span>'].join('\n')}</pre></div>`);
    document.body.appendChild(ov);
    const end = restart => {
      if (!bsod) return; bsod = null;
      removeEventListener('keydown', onKey, true); ov.remove();
      if (restart) { Arcade.closeAll(); runBoot(true); return; }
      const w = victim && Arcade.openWindows().find(x => x.id === victim.id);
      if (w) w.ctx.close();
      Arcade.dialog(w
        ? { title: w.title, icon: 'error', text: `${w.title} was terminated after a fatal exception. Arcade 95 has filed a strongly worded report with itself.` }
        : { title: 'Arcade 95', icon: 'info', text: 'Nothing was running, so nothing was lost. Arcade 95 apologizes for the drama.' });
    };
    const onKey = e => {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); end(false);
    };
    bsod = { end };
    setTimeout(() => { if (bsod) addEventListener('keydown', onKey, true); }, 150);
    ov.addEventListener('pointerdown', e => { e.preventDefault(); end(false); });
  }
  addEventListener('keydown', e => {
    if (!(e.ctrlKey && e.altKey && (e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete' || e.code === 'Backspace'))) return;
    if (booting) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (dos) { dos.leave('raw'); Arcade.closeAll(); runBoot(true); return; }
    if (bsod) { bsod.end(true); return; }
    if (cp) { blueScreen(); return; }
    closeProgram();
  }, true);

  // touch: long-press the Start button for Close Program
  const startBtn = document.getElementById('start');
  if (startBtn) {
    let lp = 0, fired = false;
    startBtn.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return; fired = false; clearTimeout(lp);
      lp = setTimeout(() => { fired = true; Arcade.closeStart(); if (cp) blueScreen(); else closeProgram(); }, 1200);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => startBtn.addEventListener(t, () => clearTimeout(lp)));
    startBtn.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('click', e => { if (fired && e.target.closest && e.target.closest('#start')) { fired = false; e.preventDefault(); e.stopPropagation(); } }, true);
  }

  Arcade.hooks.shutdown = shutdownDialog;

  /* ---------- power on ---------- */
  if (!navigator.webdriver || S.get('boot.forceInTests', false)) {
    const full = !S.get('boot.seen', false) || S.get('boot.full', false);
    S.set('boot.seen', true);
    runBoot(full);
  }
})();

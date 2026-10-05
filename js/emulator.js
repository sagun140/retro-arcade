/* PC Emulator: a real x86 PC in a window, powered by v86 (BSD-2). Boots the free OSes bundled in emu/
   or a disk image the user picks from their own computer (it never leaves the browser).
   v86 itself is loaded lazily from jsDelivr the first time a machine is started. */
(() => {
  const V86_VERSION = '0.5.470';
  const CDN = `https://cdn.jsdelivr.net/npm/v86@${V86_VERSION}/build/`;
  const MB = 1024 * 1024;
  const OSES = [
    { key: 'kolibri', name: 'KolibriOS', drive: 'fda', url: 'emu/images/kolibri.img', size: 1474560, license: 'GPL-2.0',
      kind: '1.44 MB floppy', desc: 'A tiny, fast graphical OS written in assembly: desktop, file manager, games and demos.' },
    { key: 'freedos', name: 'FreeDOS 1.4', drive: 'fda', url: 'emu/images/freedos.img', size: 1474560, license: 'GPL-2.0',
      kind: '1.44 MB floppy', desc: 'A free DOS-compatible operating system. Boots straight to the DOS prompt (type SETUP to run its installer).' }
  ];
  const DRIVES = { fda: 'Floppy disk', hda: 'Hard disk', cdrom: 'CD-ROM' };
  const FLOPPY_SIZES = [163840, 184320, 327680, 368640, 737280, 1228800, 1474560, 1720320, 2949120];
  const store = { get: (k, d) => Arcade.store.get('emulator.' + k, d), set: (k, v) => Arcade.store.set('emulator.' + k, v) };
  const api = {};

  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' +
    '<rect x="0" y="1" width="11" height="9" fill="#d9d0a8"/><rect x="0" y="9" width="11" height="1" fill="#8f8768"/><rect x="10" y="1" width="1" height="9" fill="#8f8768"/>' +
    '<rect x="1" y="2" width="9" height="7" fill="#101828"/><rect x="2" y="3" width="5" height="1" fill="#7fd7ff"/><rect x="2" y="5" width="3" height="1" fill="#7fd7ff"/><rect x="2" y="7" width="1" height="1" fill="#e8e8e8"/>' +
    '<rect x="4" y="10" width="3" height="1" fill="#8f8768"/><rect x="2" y="11" width="7" height="1" fill="#d9d0a8"/><rect x="2" y="12" width="7" height="1" fill="#8f8768"/>' +
    '<rect x="0" y="14" width="10" height="2" fill="#c8bf98"/><rect x="0" y="15" width="10" height="1" fill="#8f8768"/>' +
    '<rect x="11" y="3" width="5" height="13" fill="#d9d0a8"/><rect x="15" y="3" width="1" height="13" fill="#8f8768"/><rect x="11" y="15" width="5" height="1" fill="#8f8768"/>' +
    '<rect x="12" y="5" width="3" height="1" fill="#55524a"/><rect x="12" y="7" width="3" height="1" fill="#55524a"/><rect x="12" y="12" width="1" height="1" fill="#2fd23a"/></svg>';

  Arcade.css(`
    .emu-root { flex: 1; display: flex; flex-direction: column; min-height: 0; gap: 2px; }
    .emu-start { flex: 1; min-height: 0; overflow: auto; background: var(--window); color: var(--window-ink); padding: 10px; box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk); }
    .emu-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; margin-bottom: 8px; }
    .emu-head b { font-size: 14px; }
    .emu-head label { display: flex; align-items: center; gap: 4px; }
    .emu-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; }
    .emu-card { display: flex; flex-direction: column; align-items: stretch; gap: 4px; text-align: left; background: var(--face); color: var(--ink); border: 0; padding: 10px; min-height: 128px; cursor: default; }
    button.emu-card:active { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); }
    button.emu-card:focus-visible { outline: 1px dotted var(--ink); outline-offset: -5px; }
    .emu-card b { font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .emu-card b svg { width: 16px; height: 16px; flex: none; }
    .emu-card small { color: var(--lo); filter: brightness(.7); }
    .emu-card .emu-go { margin-top: auto; align-self: flex-start; }
    .emu-byo { grid-column: 1 / -1; }
    .emu-byo .emu-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .emu-byo input[type=file] { max-width: 100%; font-size: 11px; }
    .emu-byo .emu-note { padding: 4px 6px; background: var(--tip); color: #101014; border: 1px solid #000; }
    .emu-foot { margin: 10px 0 0; font-size: 11px; opacity: .8; }
    .emu-foot a { color: inherit; }
    .emu-run { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 2px; }
    .emu-tools { display: flex; flex-wrap: wrap; gap: 2px; flex: none; }
    .emu-tools .btn { min-width: 0; padding: 2px 7px; min-height: 22px; font-size: 11px; }
    .emu-tools .btn.pressed { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--dk), inset -2px -2px var(--hi2), inset 2px 2px var(--lo); }
    .emu-stage { position: relative; flex: 1; min-height: 120px; background: #000; overflow: hidden; box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); outline: none; }
    .emu-stage:fullscreen { box-shadow: none; }
    .emu-stage.emu-captured { box-shadow: inset 0 0 0 2px #2fd23a; }
    .emu-screen { position: absolute; left: 50%; top: 50%; width: max-content; transform-origin: 50% 50%; line-height: 0; }
    .emu-screen canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
    .emu-screen > div { white-space: pre; font: 14px/14px monospace; color: #ccc; }
    .emu-msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #bfbfbf; font: 12px/1.6 var(--pixel); text-align: center; padding: 16px; pointer-events: none; }
    .emu-msg .btn { pointer-events: auto; font: 12px var(--ui); }
    .emu-keys { display: none; flex-wrap: wrap; gap: 2px; flex: none; }
    .emu-keys .btn { min-width: 0; flex: 1 0 auto; padding: 4px 6px; min-height: 30px; }
    .emu-coarse .emu-keys { display: flex; }
    .emu-kbd { position: absolute; left: 0; bottom: 0; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0; font-size: 16px; }
    @media (max-width: 600px) { .emu-keys { display: flex; } .emu-start { padding: 6px; } }
  `);

  /* ---------- hover-card preview: a tiny CRT booting ---------- */
  const BOOT_LINES = ['SeaBIOS 1.16.2', '', 'Booting from Floppy...', '', 'FreeDOS kernel - 1.4', 'A:\\>_'];
  function preview(g, w, h, t) {
    g.fillStyle = '#0b7a78'; g.fillRect(0, 0, w, h);
    const mx = 30, my = 8, mw = 116, mh = 90;
    g.fillStyle = '#8f8768'; g.fillRect(mx + 2, my + 2, mw, mh);
    g.fillStyle = '#d9d0a8'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = '#8f8768'; g.fillRect(mx + 46, my + mh, 24, 6); g.fillRect(mx + 30, my + mh + 6, 56, 4);
    const sx = mx + 8, sy = my + 8, sw = mw - 16, sh = mh - 22;
    g.fillStyle = '#05070a'; g.fillRect(sx, sy, sw, sh);
    const cyc = t % 7, on = cyc > .4;
    if (on) {
      g.font = '7px monospace'; g.textBaseline = 'top';
      const shown = Math.min(BOOT_LINES.length, Math.floor((cyc - .4) * 2.2));
      for (let i = 0; i < shown; i++) {
        let s = BOOT_LINES[i];
        if (s.endsWith('_') && Math.floor(t * 3) % 2) s = s.slice(0, -1);
        g.fillStyle = i === 0 ? '#ffffff' : '#c0c0c0';
        g.fillText(s, sx + 3, sy + 3 + i * 9);
      }
      g.fillStyle = 'rgba(255,255,255,.05)';
      for (let y = sy; y < sy + sh; y += 2) g.fillRect(sx, y, sw, 1);
    }
    g.fillStyle = on ? '#2fd23a' : '#3a4a3a'; g.fillRect(mx + mw - 14, my + mh - 9, 4, 3);
    const tx = 156, ty = 22;
    g.fillStyle = '#8f8768'; g.fillRect(tx + 2, ty + 2, 34, 84);
    g.fillStyle = '#d9d0a8'; g.fillRect(tx, ty, 34, 84);
    g.fillStyle = '#55524a'; g.fillRect(tx + 6, ty + 10, 22, 4); g.fillRect(tx + 6, ty + 20, 22, 3);
    g.fillStyle = (on && Math.floor(t * 9) % 3) ? '#ffb000' : '#5a4a20'; g.fillRect(tx + 6, ty + 70, 3, 3);
    g.fillStyle = '#2fd23a'; g.fillRect(tx + 12, ty + 70, 3, 3);
  }

  const def = Arcade.app({
    id: 'emulator', title: 'PC Emulator', icon: ICON, width: 760, height: 580, max: true, folder: 'Accessories', desktop: true, status: true,
    hint: 'A real x86 PC in a window. Boot KolibriOS or FreeDOS, or bring your own disk image.',
    preview,
    menus: [
      { label: 'Machine', items: [
        { label: 'Power On/Off', action: () => api.power() },
        { label: 'Reset', disabled: () => !api.on(), action: () => api.reset() },
        { label: 'Send Ctrl+Alt+Del', disabled: () => !api.on(), action: () => api.cad() },
        { label: 'Pause', checked: () => api.paused(), disabled: () => !api.on(), action: () => api.pause() },
        '-',
        { label: 'Save State', disabled: () => !api.on(), action: () => api.save() },
        { label: 'Restore State', disabled: () => !api.on(), action: () => api.restore() },
        '-',
        { label: 'Choose Operating System…', action: () => api.choose() },
        '-',
        { label: 'Exit', action: () => def.ctx.close() }
      ] },
      { label: 'View', items: [
        { label: 'Full Screen', disabled: () => !api.on(), action: () => api.fullscreen() },
        { label: 'Mouse Lock', checked: () => api.lockMode(), action: () => api.toggleLock() },
        '-',
        { label: 'Screenshot', disabled: () => !api.on(), action: () => api.screenshot() }
      ] },
      { label: 'Help', items: [
        { label: 'How to Use', action: () => api.help() },
        '-',
        { label: 'About PC Emulator…', action: () => api.about() }
      ] }
    ],
    build(ctx) {
      const coarse = Arcade.coarse;
      const ramOpts = [32, 64, 128];
      let ram = ramOpts.includes(store.get('ram', 64)) ? store.get('ram', 64) : 64;
      ctx.body.innerHTML = `<div class="emu-root${coarse ? ' emu-coarse' : ''}">
        <div class="emu-start">
          <div class="emu-head"><b>Choose an operating system</b>
            <label>Memory: <select class="field emu-ram">${ramOpts.map(r => `<option value="${r}">${r} MB</option>`).join('')}</select></label></div>
          <div class="emu-cards">
            ${OSES.map(o => `<button class="emu-card bevel-out" data-os="${o.key}"><b>${ICON}${Arcade.esc(o.name)}</b><span>${Arcade.esc(o.desc)}</span>
              <small>${o.kind} · ${o.license} · free software</small><span class="btn emu-go">Start</span></button>`).join('')}
            <div class="emu-card emu-byo bevel-out"><b>${ICON}Bring your own disk image…</b>
              <div class="emu-note">Own a Windows 95 or 98 install? Load your own disk image here — it never leaves your computer.</div>
              <div class="emu-row"><input type="file" class="emu-file" accept=".img,.iso,.ima,.vfd" aria-label="Disk image file"></div>
              <div class="emu-row"><label>Insert as: <select class="field emu-drive"><option value="auto">Automatic</option><option value="fda">Floppy disk</option><option value="hda">Hard disk</option><option value="cdrom">CD-ROM</option></select></label>
                <small class="emu-detect">No file chosen.</small></div>
              <div class="emu-row"><button class="btn emu-byo-go" disabled>Start</button></div>
            </div>
          </div>
          <p class="emu-foot">Emulation by <a href="https://github.com/copy/v86" target="_blank" rel="noopener">v86</a> (BSD-2), BIOS by SeaBIOS (LGPL-3). Bundled systems are free software: <a href="emu/LICENSES.md" target="_blank" rel="noopener">licenses &amp; source</a>.</p>
        </div>
        <div class="emu-run" hidden>
          <div class="emu-tools">
            <button class="btn" data-t="power" title="Power the machine off or on">Power</button>
            <button class="btn" data-t="reset" title="Hard reset">Reset</button>
            <button class="btn" data-t="cad" title="Send Ctrl+Alt+Del">Ctrl+Alt+Del</button>
            <button class="btn" data-t="pause" title="Pause or resume">Pause</button>
            <button class="btn" data-t="lock" title="Lock the mouse pointer to the screen (Esc releases)">Mouse lock</button>
            <button class="btn" data-t="full" title="Full screen">Full screen</button>
            <button class="btn" data-t="save" title="Save the machine state">Save state</button>
            <button class="btn" data-t="restore" title="Restore the saved state">Restore state</button>
            <button class="btn" data-t="shot" title="Download a PNG screenshot">Screenshot</button>
            <button class="btn" data-t="choose" title="Choose another operating system">Change OS…</button>
          </div>
          <div class="emu-stage" tabindex="-1"><div class="emu-screen"></div><div class="emu-msg"></div></div>
          <div class="emu-keys">
            <button class="btn" data-k="kbd">Keyboard</button><button class="btn" data-k="esc">Esc</button><button class="btn" data-k="tab">Tab</button>
            <button class="btn" data-k="ctrl">Ctrl</button><button class="btn" data-k="alt">Alt</button><button class="btn" data-k="enter">Enter</button>
            <button class="btn" data-k="left">←</button><button class="btn" data-k="up">↑</button><button class="btn" data-k="down">↓</button><button class="btn" data-k="right">→</button>
          </div>
          <input class="emu-kbd" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type to the emulated PC">
        </div>
      </div>`;
      const $ = s => ctx.body.querySelector(s);
      const startEl = $('.emu-start'), runEl = $('.emu-run'), stage = $('.emu-stage'), screenEl = $('.emu-screen'), msgEl = $('.emu-msg');
      const ramSel = $('.emu-ram'), fileIn = $('.emu-file'), driveSel = $('.emu-drive'), detectEl = $('.emu-detect'), byoGo = $('.emu-byo-go'), kbdIn = $('.emu-kbd');
      const tool = n => $(`[data-t="${n}"]`);
      ramSel.value = String(ram);

      /* ----- state ----- */
      let emu = null;            // current V86 instance
      let cur = null;            // { key, name, drive, image } of the machine in the window
      let gen = 0;               // bumps on every boot / power-off to cancel stale async work
      let running = false, ready = false, userPaused = false, minPaused = false;
      let captured = false, lockMode = false, dialogOpen = false;
      let memState = null;       // { key, ram, state } most recent in-memory save
      let lastCount = 0, lastTime = 0, speed = '', note = '', noteUntil = 0;
      const latch = { ctrl: false, alt: false };

      /* ----- lazy loading of the v86 core ----- */
      let libPromise = null;
      function loadLib() {
        if (window.V86) return Promise.resolve();
        if (!libPromise) libPromise = new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = CDN + 'libv86.js'; s.async = true; s.crossOrigin = 'anonymous';
          s.onload = () => (window.V86 ? res() : rej(new Error('v86 did not initialise.')));
          s.onerror = () => { libPromise = null; s.remove(); rej(new Error('Could not download the emulator core. Check your internet connection and try again.')); };
          document.head.appendChild(s);
        });
        return libPromise;
      }

      /* ----- message boxes (keyboard stays away from the VM while one is open) ----- */
      async function say(opts) {
        dialogOpen = true; syncInput();
        try { return await Arcade.dialog(Object.assign({ title: 'PC Emulator' }, opts)); }
        finally { dialogOpen = false; syncInput(); }
      }

      /* ----- status bar ----- */
      function hintText() {
        if (!emu) return 'Pick a system to boot';
        if (!ready) return 'Starting…';
        if (document.pointerLockElement) return 'Mouse locked: press Esc to release';
        if (captured && ctx.isActive()) return lockMode ? 'Typing goes to the PC. Click the screen to lock the mouse' : 'Typing goes to the PC';
        return lockMode ? 'Click the screen to type and lock the mouse (Esc releases)' : 'Click the screen to type';
      }
      function updateStatus() {
        if (!cur) { ctx.status('Choose an operating system', ram + ' MB RAM'); return; }
        const st = !emu ? 'Powered off' : !ready ? 'Loading…' : userPaused ? 'Paused' : (speed || 'Running');
        ctx.status(cur.name, (emu ? emu.__ram : ram) + ' MB RAM', st, performance.now() < noteUntil ? note : hintText());
      }
      function updateTools() {
        const on = !!emu;
        ['reset', 'cad', 'pause', 'full', 'save', 'restore', 'shot'].forEach(n => { tool(n).disabled = !on || !ready; });
        tool('pause').textContent = userPaused ? 'Resume' : 'Pause';
        tool('pause').classList.toggle('pressed', userPaused);
        tool('lock').classList.toggle('pressed', lockMode);
        tool('power').classList.toggle('pressed', !on);
        updateStatus();
      }
      function flash(text) { note = text; noteUntil = performance.now() + 4000; updateStatus(); }
      function message(html) { msgEl.innerHTML = html || ''; msgEl.hidden = !html; }

      /* ----- keyboard / mouse routing: only while this window is active and the screen was clicked ----- */
      function syncInput() {
        const active = ctx.isActive() && !dialogOpen;
        if (emu) {
          try { emu.keyboard_set_enabled(captured && active); emu.mouse_set_enabled(active); } catch (e) { /* adapter not ready */ }
        }
        stage.classList.toggle('emu-captured', !!emu && captured && active);
        updateStatus();
      }

      /* ----- screen fitting: scale the native-size v86 screen to the stage, keeping aspect ----- */
      function fit() {
        const w = screenEl.offsetWidth, h = screenEl.offsetHeight, W = stage.clientWidth, H = stage.clientHeight;
        if (!w || !h || !W || !H) return;
        const s = Math.min(W / w, H / h);
        screenEl.style.transform = `translate(-50%, -50%) scale(${s})`;
      }
      if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(stage); ro.observe(screenEl); }
      ctx.on('resize', () => requestAnimationFrame(fit));

      /* ----- machine lifecycle ----- */
      function showStart() {
        cur = null; startEl.hidden = false; runEl.hidden = true; ctx.setTitle('PC Emulator'); updateStatus();
      }
      async function powerOff() {
        gen++;
        const e = emu; emu = null; running = false; ready = false; userPaused = false; minPaused = false; captured = false; speed = '';
        if (document.pointerLockElement) try { document.exitPointerLock(); } catch (err) { /* ignore */ }
        if (document.fullscreenElement === stage) try { document.exitFullscreen(); } catch (err) { /* ignore */ }
        if (e) {
          try { e.keyboard_set_enabled(false); e.mouse_set_enabled(false); } catch (err) { /* ignore */ }
          if (e.__ready) { try { await e.destroy(); } catch (err) { /* ignore */ } }
          else e.add_listener('emulator-ready', () => { e.destroy().catch(() => {}); });   // still downloading: free it once it exists
        }
        screenEl.innerHTML = ''; screenEl.style.transform = '';
        updateTools(); syncInput();
      }
      async function boot(spec) {
        await powerOff();
        const my = gen;
        cur = spec; startEl.hidden = true; runEl.hidden = false;
        ctx.setTitle('PC Emulator - ' + spec.name);
        message('Loading the emulator core…');
        updateTools();
        try { await loadLib(); }
        catch (err) { if (my !== gen) return; message(''); showStart(); say({ icon: 'error', text: err.message }); return; }
        if (my !== gen || !ctx.isVisible()) return;
        screenEl.innerHTML = '<div></div><canvas></canvas>';
        const opts = {
          wasm_path: CDN + 'v86.wasm',
          memory_size: ram * MB,
          vga_memory_size: 8 * MB,
          screen: { container: screenEl, use_graphical_text: true },
          bios: { url: 'emu/bios/seabios.bin' },
          vga_bios: { url: 'emu/bios/vgabios.bin' },
          autostart: true,
          disable_speaker: Arcade.isMuted()
        };
        opts[spec.drive] = Object.assign({}, spec.image);
        let e;
        try { e = new window.V86(opts); }
        catch (err) { message(''); showStart(); say({ icon: 'error', text: 'The emulator could not start: ' + err.message }); return; }
        emu = e; e.__ram = ram; e.__ready = false;
        try { e.keyboard_set_enabled(false); } catch (err) { /* ignore */ }
        e.add_listener('download-progress', p => {
          if (emu !== e || ready) return;
          const pct = p.lengthComputable && p.total ? Math.floor(p.loaded / p.total * 100) + '%' : Math.round(p.loaded / 1024) + ' KB';
          message(`Loading ${Arcade.esc(String(p.file_name || '').split('/').pop() || 'files')}… ${pct}`);
        });
        e.add_listener('download-error', p => {
          if (emu !== e) return;
          message('');
          say({ icon: 'error', text: `Could not download ${p && p.file_name ? p.file_name : 'a file'} for the emulator.` });
        });
        e.add_listener('emulator-ready', () => {
          e.__ready = true;
          if (emu !== e) return;
          ready = true; message(''); lastCount = e.get_instruction_counter(); lastTime = performance.now();
          if (!ctx.isVisible()) { e.stop(); minPaused = true; }
          updateTools(); syncInput(); fit();
        });
        e.add_listener('emulator-started', () => { if (emu === e) { running = true; updateTools(); } });
        e.add_listener('emulator-stopped', () => { if (emu === e) { running = false; updateTools(); } });
        e.add_listener('screen-set-size', () => requestAnimationFrame(fit));
        syncInput();
      }
      function bootBundled(key) {
        const o = OSES.find(x => x.key === key); if (!o) return;
        boot({ key: 'os:' + o.key, name: o.name, drive: o.drive, image: { url: o.url, size: o.size } });
      }

      /* ----- bring your own image ----- */
      function detect(file) {
        const n = file.name.toLowerCase(), ext = n.includes('.') ? n.slice(n.lastIndexOf('.')) : '';
        if (ext === '.iso') return 'cdrom';
        if (ext === '.ima' || ext === '.vfd') return 'fda';
        if (FLOPPY_SIZES.includes(file.size)) return 'fda';
        return 'hda';
      }
      const fmtSize = b => b >= MB ? (b / MB).toFixed(b >= 100 * MB ? 0 : 1) + ' MB' : Math.round(b / 1024) + ' KB';
      function updateDetect() {
        const f = fileIn.files && fileIn.files[0];
        byoGo.disabled = !f;
        if (!f) { detectEl.textContent = 'No file chosen.'; return; }
        const d = driveSel.value === 'auto' ? detect(f) : driveSel.value;
        detectEl.textContent = `${fmtSize(f.size)} → ${DRIVES[d]}${driveSel.value === 'auto' ? ' (detected)' : ''}`;
      }
      fileIn.addEventListener('change', updateDetect);
      driveSel.addEventListener('change', updateDetect);
      byoGo.addEventListener('click', () => {
        const f = fileIn.files && fileIn.files[0]; if (!f) return;
        const drive = driveSel.value === 'auto' ? detect(f) : driveSel.value;
        boot({ key: `byo:${f.name}:${f.size}`, name: f.name, drive, image: { buffer: f } });
      });
      ctx.body.querySelectorAll('[data-os]').forEach(b => b.addEventListener('click', () => bootBundled(b.dataset.os)));
      ramSel.addEventListener('change', () => { ram = +ramSel.value; store.set('ram', ram); updateStatus(); });

      /* ----- toolbar actions ----- */
      async function power() {
        if (emu) { await powerOff(); message('The machine is off. <button class="btn emu-on">Power on</button>'); const b = msgEl.querySelector('.emu-on'); if (b) b.onclick = () => power(); }
        else if (cur) boot(cur);
        else Arcade.dialog({ title: 'PC Emulator', icon: 'info', text: 'Choose an operating system to boot first.' });
      }
      function reset() { if (!emu || !ready) return; emu.restart(); if (userPaused) { userPaused = false; emu.run(); } updateTools(); }
      function cad() { if (!emu || !ready) return; emu.keyboard_send_scancodes([0x1D, 0x38, 0xE0, 0x53, 0xE0, 0xD3, 0xB8, 0x9D]); }
      function pause() {
        if (!emu || !ready) return;
        userPaused = !userPaused;
        if (userPaused) emu.stop(); else if (ctx.isVisible()) emu.run();
        updateTools();
      }
      function toggleLock() { lockMode = !lockMode; if (!lockMode && document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* ignore */ } updateTools(); }
      function fullscreen() {
        try {
          const fn = stage.requestFullscreen || stage.webkitRequestFullscreen;
          if (!fn) throw new Error('unsupported');
          const p = fn.call(stage); if (p && p.catch) p.catch(() => say({ icon: 'warn', text: 'Full screen is not available here.' }));
          captured = true; syncInput();
        } catch (e) { say({ icon: 'warn', text: 'Full screen is not available here.' }); }
      }
      function screenshot() {
        if (!emu || !ready) return;
        try {
          const img = emu.screen_make_screenshot();
          if (!img || !img.src) throw new Error('no image');
          const a = document.createElement('a');
          a.href = img.src; a.download = (cur.name.replace(/[^\w.-]+/g, '_') || 'pc') + '-screenshot.png';
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e) { say({ icon: 'error', text: 'Could not take a screenshot.' }); }
      }

      /* ----- save / restore state (memory, plus IndexedDB per disk image when available) ----- */
      function idb() {
        return new Promise((res, rej) => {
          const r = indexedDB.open('arcade95-emulator', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('states');
          r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        });
      }
      async function idbOp(mode, fn) {
        const db = await idb();
        return new Promise((res, rej) => {
          const t = db.transaction('states', mode), req = fn(t.objectStore('states'));
          t.oncomplete = () => { db.close(); res(req.result); };
          t.onerror = t.onabort = () => { db.close(); rej(t.error); };
        });
      }
      async function save() {
        if (!emu || !ready) return;
        const e = emu, key = cur.key;
        try {
          const state = await e.save_state();
          if (e !== emu) return;
          memState = { key, ram: e.__ram, state };
          let disk = false;
          try { await idbOp('readwrite', s => s.put({ ram: e.__ram, state, at: Date.now() }, key)); disk = true; } catch (err) { /* private mode / quota */ }
          flash(disk ? `State saved: ${fmtSize(state.byteLength)}, kept in this browser` : `State saved: ${fmtSize(state.byteLength)}, until you close the page`);
        } catch (err) { say({ icon: 'error', text: 'Could not save the machine state: ' + (err && err.message || err) }); }
      }
      async function restore() {
        if (!emu || !ready) return;
        const e = emu, key = cur.key;
        let rec = memState && memState.key === key ? memState : null;
        if (!rec) { try { rec = await idbOp('readonly', s => s.get(key)); } catch (err) { rec = null; } }
        if (e !== emu) return;
        if (!rec || !rec.state) { say({ icon: 'info', text: 'There is no saved state for this disk yet. Use Save state first.' }); return; }
        if (rec.ram !== e.__ram) { say({ icon: 'warn', text: `That state was saved with ${rec.ram} MB of memory. Choose ${rec.ram} MB on the start screen and boot this disk again to restore it.` }); return; }
        try {
          await e.restore_state(rec.state);
          if (userPaused) { userPaused = false; e.run(); }
          updateTools();
          flash('State restored');
        } catch (err) { say({ icon: 'error', text: 'Could not restore the machine state: ' + (err && err.message || err) }); }
      }

      async function choose() { await powerOff(); message(''); showStart(); }

      /* ----- screen clicks capture the keyboard (and the mouse in lock mode) ----- */
      stage.addEventListener('pointerdown', () => {
        if (!emu) return;
        captured = true;
        if (Arcade.coarse) { /* phones: typing goes through the Keyboard button */ }
        else try { stage.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        if (lockMode && ready && !document.pointerLockElement) { try { const p = emu.lock_mouse(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
        syncInput();
      });
      document.addEventListener('pointerlockchange', () => { if (emu) updateStatus(); });
      tool('power').onclick = power; tool('reset').onclick = reset; tool('cad').onclick = cad; tool('pause').onclick = pause;
      tool('lock').onclick = toggleLock; tool('full').onclick = fullscreen; tool('save').onclick = save; tool('restore').onclick = restore;
      tool('shot').onclick = screenshot; tool('choose').onclick = choose;

      /* ----- phones: on-screen keys + a hidden input that forwards typed text ----- */
      const SC = { esc: [0x01], tab: [0x0F], enter: [0x1C], left: [0xE0, 0x4B], up: [0xE0, 0x48], down: [0xE0, 0x50], right: [0xE0, 0x4D], back: [0x0E] };
      function tap(code) {
        if (!emu || !ready) return;
        const pre = [], post = [];
        if (latch.ctrl) { pre.push(0x1D); post.unshift(0x9D); }
        if (latch.alt) { pre.push(0x38); post.unshift(0xB8); }
        const up = code.length === 2 ? [0xE0, code[1] | 0x80] : [code[0] | 0x80];
        emu.keyboard_send_scancodes([...pre, ...code, ...up, ...post]);
        latch.ctrl = latch.alt = false; paintLatch();
      }
      function paintLatch() { $('[data-k="ctrl"]').classList.toggle('pressed', latch.ctrl); $('[data-k="alt"]').classList.toggle('pressed', latch.alt); }
      ctx.body.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'kbd') { kbdIn.value = ''; kbdIn.focus(); return; }
        if (k === 'ctrl' || k === 'alt') { latch[k] = !latch[k]; paintLatch(); return; }
        tap(SC[k]);
      }));
      kbdIn.addEventListener('input', e => {
        if (emu && ready) {
          if (e.inputType === 'insertText' && e.data) { if (latch.ctrl || latch.alt) { const c = e.data[0].toLowerCase(); emu.keyboard_send_text(c); latch.ctrl = latch.alt = false; paintLatch(); } else emu.keyboard_send_text(e.data); }
          else if (e.inputType === 'insertLineBreak') tap(SC.enter);
          else if (e.inputType === 'deleteContentBackward') tap(SC.back);
        }
        kbdIn.value = '';
      });
      kbdIn.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); tap(SC.enter); }
        else if (e.key === 'Backspace' && !kbdIn.value) { e.preventDefault(); tap(SC.back); }
      });

      /* ----- window events ----- */
      ctx.on('focus', syncInput);
      ctx.on('blur', () => { captured = false; latch.ctrl = latch.alt = false; paintLatch(); syncInput(); });
      ctx.on('minimize', () => { if (emu && ready && running) { emu.stop(); minPaused = true; } syncInput(); });
      ctx.on('restore', () => { if (emu && ready && minPaused && !userPaused) emu.run(); minPaused = false; syncInput(); requestAnimationFrame(fit); });
      ctx.on('close', async () => { await powerOff(); message(''); showStart(); });
      ctx.on('open', () => { if (!emu) showStart(); });

      /* ----- speed meter ----- */
      setInterval(() => {
        if (!emu || !ready || !ctx.isVisible()) return;
        const now = performance.now(), c = emu.get_instruction_counter();
        if (running && !userPaused && lastTime) {
          const d = (c - lastCount) >>> 0, dt = (now - lastTime) / 1000;
          if (dt > 0) speed = (d / dt / 1e6).toFixed(d / dt >= 1e8 ? 0 : 1) + ' MIPS';
        }
        lastCount = c; lastTime = now; updateStatus();
      }, 1000);

      Object.assign(api, {
        on: () => !!emu && ready, paused: () => userPaused, lockMode: () => lockMode,
        power, reset, cad, pause, save, restore, choose, fullscreen, toggleLock, screenshot,
        help: () => say({ icon: 'info', text: 'Pick a system on the start screen (or load your own .img/.iso). Click the emulated screen to send your keyboard to the PC; click another window to get it back. Mouse lock hides your pointer inside the PC until you press Esc. Save state keeps a snapshot of the running machine in this browser. On phones, use the key row and the Keyboard button.' }),
        about: () => say({ icon: 'info', text: `PC Emulator for Arcade 95. x86 emulation by v86 ${V86_VERSION} (BSD-2-Clause, github.com/copy/v86), BIOS by SeaBIOS 1.16.2 (LGPL-3). Bundled: KolibriOS (GPL-2) and FreeDOS 1.4 (GPL). Disk images you load stay in your browser and are never uploaded.` })
      });
      showStart(); updateTools(); message('');
    }
  });
})();

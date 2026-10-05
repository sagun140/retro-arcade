/* Arcade 95 shell: window manager, menus, message boxes, storage, audio, desktop, Start menu.
   Every program registers itself with Arcade.app({...}); see README.md for the API. */
(() => {
  const $ = s => document.querySelector(s);
  const desktop = $('#desktop'), iconsEl = $('#icons'), tasksEl = $('#tasks');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('arcade95.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('arcade95.' + k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- audio ---------- */
  let ac = null, muted = store.get('muted', false);
  const muteListeners = new Set();
  function audio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch { return null; } }
  function beep(f, dur, type = 'square', vol = .045, slide = 0, delay = 0) {
    if (muted) return; const a = audio(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  function setMuted(m) { muted = m; store.set('muted', m); $('#b-vol').textContent = m ? '🔇' : '🔊'; muteListeners.forEach(f => f(m)); }
  $('#b-vol').onclick = () => setMuted(!muted);

  /* ---------- window manager ---------- */
  const apps = {}, order = [];
  let zTop = 10, active = null, cascade = 0;

  function app(def) {
    const d = Object.assign({ width: 360, max: false, desktop: true, folder: null, menus: null, status: false, hint: '' }, def);
    apps[d.id] = d; order.push(d.id);
    return d;
  }
  function makeWindow(d) {
    const w = el(`<section class="win bevel-out" id="w-${d.id}" hidden>
      <div class="titlebar"><span class="ttl">${d.icon || ''}<span></span></span><div class="tb-btns">
        <button data-act="min" aria-label="Minimize">_</button>${d.max ? '<button data-act="max" aria-label="Maximize">□</button>' : ''}<button data-act="close" aria-label="Close">×</button></div></div>
      ${d.menus ? '<div class="menubar"></div>' : ''}
      <div class="wbody"></div>
      ${d.status ? '<div class="statusbar"></div>' : ''}
    </section>`);
    w.style.width = typeof d.width === 'number' ? d.width + 'px' : d.width;
    if (d.height) w.style.height = typeof d.height === 'number' ? d.height + 'px' : d.height;
    w.querySelector('.ttl > span').textContent = d.title;
    desktop.appendChild(w);
    const handlers = {};
    const ctx = {
      id: d.id, win: w, body: w.querySelector('.wbody'), def: d,
      isVisible: () => !w.hidden && !w.dataset.min,
      isActive: () => active === w && ctx.isVisible(),
      on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return ctx; },
      emit(evt, ...a) { (handlers[evt] || []).forEach(f => f(...a)); },
      onKey(fn) { return ctx.on('key', fn); },
      onKeyUp(fn) { return ctx.on('keyup', fn); },
      status(...texts) {
        const sb = w.querySelector('.statusbar'); if (!sb) return;
        while (sb.children.length < texts.length) sb.appendChild(document.createElement('span'));
        while (sb.children.length > texts.length) sb.lastChild.remove();
        texts.forEach((t, i) => { sb.children[i].textContent = t; });
      },
      setTitle(t) { w.querySelector('.ttl > span').textContent = t; renderTasks(); },
      title: () => w.querySelector('.ttl > span').textContent,
      setMenus(m) { d.menus = m; renderMenubar(ctx); },
      open: () => open(d.id), close: () => closeWin(ctx), focus: () => focusWin(ctx),
      toggleMax() { if (!d.max) return; w.classList.toggle('max'); ctx.emit('resize'); }
    };
    d.ctx = ctx;
    w.addEventListener('pointerdown', () => { if (active !== w) focusWin(ctx); });
    w.querySelectorAll('.tb-btns button').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); const a = b.dataset.act;
      if (a === 'close') closeWin(ctx); else if (a === 'min') minWin(ctx); else ctx.toggleMax();
    }));
    const tb = w.querySelector('.titlebar');
    tb.addEventListener('dblclick', e => { if (!e.target.closest('button')) ctx.toggleMax(); });
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || w.classList.contains('max') || innerWidth <= 600) return;
      const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
      tb.setPointerCapture(e.pointerId);
      const move = ev => {
        w.style.left = Math.min(Math.max(ev.clientX - sx, 40 - w.offsetWidth), desktop.clientWidth - 40) + 'px';
        w.style.top = Math.min(Math.max(ev.clientY - sy, 0), desktop.clientHeight - 24) + 'px';
      };
      const up = () => { tb.removeEventListener('pointermove', move); tb.removeEventListener('pointerup', up); tb.removeEventListener('pointercancel', up); };
      tb.addEventListener('pointermove', move); tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up);
    });
    if (d.menus) renderMenubar(ctx);
    d.build(ctx);
    return ctx;
  }

  function open(id) {
    const d = apps[id]; if (!d) return;
    closeStart();
    const ctx = d.ctx || makeWindow(d), w = ctx.win;
    if (w.hidden) {
      w.hidden = false;
      if (!w.dataset.placed) {
        const dw = desktop.clientWidth, dh = desktop.clientHeight, ww = w.offsetWidth, wh = w.offsetHeight;
        w.style.left = Math.max(8, Math.min((dw - ww) / 2 + cascade - 36, dw - ww - 8)) + 'px';
        w.style.top = Math.max(8, Math.min((dh - wh) / 3 + cascade - 24, dh - wh - 8)) + 'px';
        cascade = (cascade + 24) % 120; w.dataset.placed = '1';
      }
      w.classList.remove('opening'); void w.offsetWidth; w.classList.add('opening');
      ctx.emit('open');
    }
    if (w.dataset.min) { w.dataset.min = ''; w.style.visibility = ''; ctx.emit('restore'); }
    focusWin(ctx);
    return ctx;
  }
  function focusWin(ctx) {
    const w = ctx.win;
    if (active && active !== w) { active.classList.remove('active'); const prev = ctxOf(active); if (prev) prev.emit('blur'); }
    const was = active === w;
    active = w; w.classList.add('active'); w.style.zIndex = ++zTop;
    if (!was) ctx.emit('focus');
    renderTasks();
  }
  function blurAll() { if (!active) return; const c = ctxOf(active); active.classList.remove('active'); active = null; if (c) c.emit('blur'); renderTasks(); }
  function minWin(ctx) { const w = ctx.win; w.dataset.min = '1'; w.style.visibility = 'hidden'; if (active === w) blurAll(); ctx.emit('minimize'); renderTasks(); }
  function closeWin(ctx) {
    const w = ctx.win; if (active === w) blurAll();
    w.hidden = true; w.dataset.min = ''; w.style.visibility = ''; w.classList.remove('max'); ctx.emit('close'); renderTasks();
  }
  const ctxOf = w => { const d = apps[w.id.slice(2)]; return d && d.ctx; };
  function renderTasks() {
    tasksEl.innerHTML = '';
    order.forEach(id => {
      const c = apps[id].ctx; if (!c || c.win.hidden) return;
      const b = el(`<button class="task bevel-out${c.win === active ? ' on' : ''}">${apps[id].icon || ''}<span></span></button>`);
      b.querySelector('span').textContent = c.title();
      b.onclick = () => { if (c.win === active) minWin(c); else open(id); };
      tasksEl.appendChild(b);
    });
  }
  desktop.addEventListener('pointerdown', e => { if (!e.target.closest('.win') && !e.target.closest('.modal-veil')) blurAll(); });

  /* ---------- keyboard routing ---------- */
  addEventListener('keydown', e => {
    if (!active || (e.target.closest && e.target.closest('input, textarea, select')) || document.querySelector('.modal-veil')) return;
    const c = ctxOf(active); if (c) c.emit('key', e);
  });
  addEventListener('keyup', e => { if (!active) return; const c = ctxOf(active); if (c) c.emit('keyup', e); });
  addEventListener('blur', () => { if (active) { const c = ctxOf(active); if (c) c.emit('blur'); } });

  /* ---------- menus ---------- */
  let openMenu = null;
  function closeMenus() { if (openMenu) { openMenu.dd.remove(); openMenu.btn.classList.remove('open'); openMenu = null; } }
  function renderMenubar(ctx) {
    const bar = ctx.win.querySelector('.menubar'); if (!bar) return;
    bar.innerHTML = '';
    (ctx.def.menus || []).forEach(m => {
      const b = el('<button></button>'); b.textContent = m.label;
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (openMenu && openMenu.btn === b) { closeMenus(); return; }
        closeMenus(); focusWin(ctx);
        const dd = el('<div class="dropdown bevel-out"></div>');
        m.items.forEach(it => {
          if (it === '-') { dd.appendChild(el('<hr>')); return; }
          const ib = el('<button><span></span><span></span><span class="key"></span></button>');
          const checked = it.checked && it.checked();
          ib.children[0].textContent = checked ? '✓' : (it.radio && it.radio() ? '•' : '');
          ib.children[1].textContent = it.label; ib.children[2].textContent = it.key || '';
          if (it.disabled && it.disabled()) ib.disabled = true;
          ib.addEventListener('click', ev => { ev.stopPropagation(); closeMenus(); it.action && it.action(); });
          dd.appendChild(ib);
        });
        document.body.appendChild(dd);
        const r = b.getBoundingClientRect();
        dd.style.left = Math.min(r.left, innerWidth - dd.offsetWidth - 4) + 'px'; dd.style.top = r.bottom + 'px';
        b.classList.add('open'); openMenu = { btn: b, dd };
      });
      b.addEventListener('pointerenter', () => { if (openMenu && openMenu.btn !== b && openMenu.btn.parentNode === bar) b.click(); });
      bar.appendChild(b);
    });
  }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.dropdown') && !e.target.closest('.menubar')) closeMenus(); });

  /* ---------- message boxes ---------- */
  const ICONS = {
    info: '<svg width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><circle cx="8" cy="8" r="7" fill="#fff" stroke="#000" stroke-width=".6"/><rect x="7" y="3" width="2" height="2" fill="#1a3fd6"/><rect x="7" y="6" width="2" height="7" fill="#1a3fd6"/></svg>',
    warn: '<svg width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M8 1 15 14H1Z" fill="#ffd400" stroke="#000" stroke-width=".6"/><rect x="7" y="5" width="2" height="5" fill="#000"/><rect x="7" y="11" width="2" height="2" fill="#000"/></svg>',
    error: '<svg width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><circle cx="8" cy="8" r="7" fill="#e01b1b" stroke="#600" stroke-width=".6"/><path d="M5 5 11 11M11 5 5 11" stroke="#fff" stroke-width="2"/></svg>',
    trophy: '<svg width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="2" width="8" height="6" fill="#ffd23f"/><rect x="2" y="3" width="2" height="3" fill="#e0a500"/><rect x="12" y="3" width="2" height="3" fill="#e0a500"/><rect x="6" y="8" width="4" height="2" fill="#e0a500"/><rect x="7" y="10" width="2" height="2" fill="#e0a500"/><rect x="4" y="12" width="8" height="2" fill="#7a4a12"/></svg>'
  };
  function dialog({ title = 'Arcade 95', text = '', icon = 'info', buttons = ['OK'], input = null }) {
    return new Promise(resolve => {
      const veil = el(`<div class="modal-veil"><div class="win msgbox bevel-out active">
        <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
        <div class="content">${ICONS[icon] || ''}<div style="flex:1;min-width:0"><p></p>${input != null ? '<input class="field" maxlength="24">' : ''}</div></div>
        <div class="actions"></div></div></div>`);
      veil.querySelector('.ttl span').textContent = title;
      veil.querySelector('p').textContent = text;
      const inp = veil.querySelector('input'); if (inp) inp.value = input;
      const done = v => { veil.remove(); resolve(inp ? (v === buttons[0] ? inp.value.trim() : null) : v); };
      buttons.forEach((b, i) => { const bt = el('<button class="btn"></button>'); bt.textContent = b; bt.onclick = () => done(b); veil.querySelector('.actions').appendChild(bt); if (i === 0) setTimeout(() => (inp || bt).focus(), 0); });
      veil.querySelector('[data-act="close"]').onclick = () => done(null);
      veil.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(buttons[0]); } else if (e.key === 'Escape') done(null); e.stopPropagation(); });
      veil.style.zIndex = ++zTop + 1000;
      desktop.appendChild(veil);
    });
  }

  /* ---------- styles, scores ---------- */
  function css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); }
  const scoreSections = [];

  /* ---------- desktop icons, folders, hover cards ---------- */
  let hover = null, hoverRaf = 0;
  function showHover(d, anchor) {
    hideHover();
    if (coarse || innerWidth <= 600) return;
    const card = el('<div class="hovercard"></div>');
    let cv = null;
    if (d.preview) { cv = document.createElement('canvas'); cv.width = 208; cv.height = 117; card.appendChild(cv); }
    const b = document.createElement('b'); b.textContent = d.title; card.appendChild(b);
    if (d.hint) { const p = document.createElement('div'); p.textContent = d.hint; card.appendChild(p); }
    const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Double-click to open'; card.appendChild(h);
    document.body.appendChild(card);
    const r = anchor.getBoundingClientRect();
    let x = r.right + 6, y = r.top;
    if (x + 224 > innerWidth) x = r.left - 226;
    card.style.left = Math.max(4, x) + 'px'; card.style.top = Math.max(4, Math.min(y, innerHeight - card.offsetHeight - 40)) + 'px';
    hover = card;
    if (cv) {
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const t0 = performance.now();
      const loop = now => { if (hover !== card) return; try { d.preview(g, cv.width, cv.height, (now - t0) / 1000); } catch (e) { console.error(e); } hoverRaf = requestAnimationFrame(loop); };
      hoverRaf = requestAnimationFrame(loop);
    }
  }
  function hideHover() { if (hover) { hover.remove(); hover = null; cancelAnimationFrame(hoverRaf); } }
  function iconButton(d) {
    const b = el(`<button class="icon">${d.icon || ''}<span></span></button>`);
    b.querySelector('span').textContent = d.label || d.title;
    const go = () => { hideHover(); open(d.id); };
    if (coarse) b.addEventListener('click', go);
    else { b.addEventListener('dblclick', go); b.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
    let ht = 0;
    b.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; clearTimeout(ht); ht = setTimeout(() => showHover(d, b), 350); });
    b.addEventListener('pointerleave', () => { clearTimeout(ht); hideHover(); });
    b.addEventListener('pointerdown', hideHover);
    return b;
  }

  /* ---------- Start menu ---------- */
  const startBtn = $('#start'), startMenu = $('#startmenu');
  let submenu = null;
  function closeSub() { if (submenu) { submenu.el.remove(); submenu.btn.classList.remove('open'); submenu = null; } }
  function closeStart() { startMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); closeSub(); }
  startBtn.onclick = e => { e.stopPropagation(); const o = startMenu.hidden; if (o) { startMenu.hidden = false; startBtn.setAttribute('aria-expanded', 'true'); } else closeStart(); };
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#startmenu') && !e.target.closest('#start') && !e.target.closest('.submenu')) closeStart(); });
  function buildStart() {
    const ul = $('#start-list'); ul.innerHTML = '';
    const folders = [...new Set(order.map(id => apps[id].folder).filter(Boolean))];
    const FOLDER_ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="3" width="6" height="2" fill="#e0b400"/><rect x="1" y="4" width="14" height="10" fill="#ffd94a"/><rect x="1" y="13" width="14" height="1" fill="#b08800"/></svg>';
    folders.forEach(f => {
      const li = el(`<li><button>${FOLDER_ICON}<span></span><span class="arrow">▶</span></button></li>`);
      li.querySelector('span').textContent = f;
      const btn = li.firstChild;
      const show = () => {
        if (submenu && submenu.btn === btn) return; closeSub();
        const sm = el('<div class="submenu bevel-out"><ul></ul></div>');
        order.filter(id => apps[id].folder === f).forEach(id => {
          const it = el(`<li><button>${apps[id].icon || ''}<span></span></button></li>`);
          it.querySelector('span').textContent = apps[id].title;
          it.firstChild.onclick = () => open(id);
          sm.firstChild.appendChild(it);
        });
        document.body.appendChild(sm);
        const r = btn.getBoundingClientRect();
        let left = r.right - 2; if (left + sm.offsetWidth > innerWidth) left = Math.max(2, innerWidth - sm.offsetWidth - 2);
        sm.style.left = left + 'px'; sm.style.top = Math.max(2, Math.min(r.top - 3, innerHeight - sm.offsetHeight - 34)) + 'px';
        btn.classList.add('open'); submenu = { el: sm, btn };
      };
      btn.addEventListener('pointerenter', show); btn.addEventListener('click', e => { e.stopPropagation(); show(); });
      ul.appendChild(li);
    });
    order.filter(id => !apps[id].folder && apps[id].start).forEach(id => {
      const li = el(`<li><button>${apps[id].icon || ''}<span></span></button></li>`);
      li.querySelector('span').textContent = apps[id].title;
      li.firstChild.onclick = () => open(id);
      li.firstChild.addEventListener('pointerenter', closeSub);
      ul.appendChild(li);
    });
    ul.appendChild(el('<li><hr></li>'));
    const sd = el('<li><button><svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="3" width="12" height="9" fill="#333"/><rect x="3" y="4" width="10" height="7" fill="#0b7a78"/><rect x="5" y="12" width="6" height="2" fill="#777"/></svg><span>Shut Down…</span></button></li>');
    sd.firstChild.onclick = () => { closeStart(); order.forEach(id => { const c = apps[id].ctx; if (c && active === c.win) blurAll(); }); $('#shutdown').hidden = false; };
    sd.firstChild.addEventListener('pointerenter', closeSub);
    ul.appendChild(sd);
  }
  $('#shutdown').onclick = () => { $('#shutdown').hidden = true; };

  function tick() { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  tick(); setInterval(tick, 15000);

  function boot(firstOpen) {
    order.filter(id => apps[id].desktop).forEach(id => iconsEl.appendChild(iconButton(apps[id])));
    buildStart();
    setMuted(muted);
    if (firstOpen) open(firstOpen);
  }

  window.Arcade = {
    app, open, boot, store, beep, audio, css, dialog, esc, el, coarse, iconButton, apps, order,
    isMuted: () => muted, setMuted, onMute: f => muteListeners.add(f),
    scores: { add: s => scoreSections.push(s), list: () => scoreSections },
    closeAll: () => order.forEach(id => apps[id].ctx && !apps[id].ctx.win.hidden && closeWin(apps[id].ctx))
  };
})();

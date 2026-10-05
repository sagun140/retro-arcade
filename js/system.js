/* System programs: Display Properties (themes), Games folder, High Scores, Readme, Recycle Bin. Loads last. */
(() => {
  const { store, el, esc } = Arcade;

  /* ================= Color schemes (Appearance tab) ================= */
  // keys: desk face hi hi2 lo dk title1 title2 off1 off2 titleInk ink window windowInk sel selInk iconInk
  const S = (o) => Object.assign({ hi: '#ffffff', hi2: '#e4e4e8', dk: '#0c0c10', titleInk: '#ffffff', ink: '#101014', window: '#ffffff', windowInk: '#101014', selInk: '#ffffff', iconInk: '#ffffff' }, o);
  const SCHEMES = {
    'Windows Standard': S({ desk: '#0b7a78', face: '#c3c3c6', lo: '#85858c', title1: '#0a1a86', title2: '#1d8ad6', off1: '#8a8a92', off2: '#b5b5bb', sel: '#0a1a86' }),
    'Brick': S({ desk: '#6b2a1c', face: '#c2b59b', hi2: '#ddd3bf', lo: '#827559', title1: '#7a1b0e', title2: '#c2552f', off1: '#8f8470', off2: '#b3a78f', sel: '#7a1b0e' }),
    'Desert': S({ desk: '#a88f5c', face: '#d5c7a3', hi2: '#e8dec4', lo: '#9a8a62', title1: '#00787a', title2: '#4ab0a8', off1: '#a99a76', off2: '#c8bb98', sel: '#00787a' }),
    'Eggplant': S({ desk: '#4a2f5c', face: '#a6b3a9', hi2: '#c7d1c9', lo: '#6c7a70', title1: '#4f2a63', title2: '#8a5aa3', off1: '#7e8a80', off2: '#9aa69c', sel: '#4f2a63' }),
    'Marine': S({ desk: '#0d3a5a', face: '#b8c8c8', hi2: '#d6e2e2', lo: '#788a8a', title1: '#004a62', title2: '#2e8eaa', off1: '#889898', off2: '#a8b8b8', sel: '#004a62' }),
    'Plum': S({ desk: '#3e2a3c', face: '#c3b4bc', hi2: '#dcd0d6', lo: '#857480', title1: '#4f2a48', title2: '#93617f', off1: '#94868e', off2: '#b5a7ae', sel: '#4f2a48' }),
    'Pumpkin': S({ desk: '#2a1a08', face: '#e0c08a', hi2: '#efdcb4', lo: '#a07e48', title1: '#2a1a00', title2: '#ce7a12', off1: '#a8916a', off2: '#cbb48a', sel: '#2a1a00', selInk: '#ffd27a' }),
    'Rainy Day': S({ desk: '#4f6478', face: '#b4bcc4', hi2: '#d2d8de', lo: '#76808a', title1: '#3c4f62', title2: '#7e98b0', off1: '#86909a', off2: '#a4adb6', sel: '#3c4f62' }),
    'Rose': S({ desk: '#8a4a5a', face: '#d2b2b8', hi2: '#e6d0d4', lo: '#987078', title1: '#8a2a42', title2: '#cf6a86', off1: '#a68a90', off2: '#c4a8ae', sel: '#8a2a42' }),
    'Slate': S({ desk: '#3a4a58', face: '#a9b4bc', hi2: '#c9d1d7', lo: '#6c7880', title1: '#30475c', title2: '#5f8aa8', off1: '#7c868e', off2: '#9aa4ac', sel: '#30475c' }),
    'Spruce': S({ desk: '#2d4a32', face: '#a8c0a4', hi2: '#c8dac4', lo: '#6a8466', title1: '#1e4a2a', title2: '#4e8a5a', off1: '#7a9276', off2: '#98ae94', sel: '#1e4a2a' }),
    'Storm': S({ desk: '#000000', face: '#a0a0b8', hi2: '#c4c4d6', lo: '#5e5e78', title1: '#40006a', title2: '#8a2ad8', off1: '#6e6e84', off2: '#8e8ea4', sel: '#40006a' }),
    'Wheat': S({ desk: '#8a7a4a', face: '#dcd2a6', hi2: '#ece4c4', lo: '#a09668', title1: '#6a5a00', title2: '#b8a43a', off1: '#aaa07a', off2: '#c8bf98', sel: '#6a5a00' }),
    'High Contrast Black': S({ desk: '#000000', face: '#000000', hi: '#ffffff', hi2: '#ffffff', lo: '#ffffff', dk: '#ffffff', title1: '#800080', title2: '#800080', off1: '#008000', off2: '#008000', ink: '#ffffff', window: '#000000', windowInk: '#ffffff', sel: '#800080', iconInk: '#ffffff' }),
    'Hot Dog Stand': S({ desk: '#ffff00', face: '#ff0000', hi: '#ffffff', hi2: '#ff8080', lo: '#800000', dk: '#000000', title1: '#000000', title2: '#000000', off1: '#ffff00', off2: '#ffff00', titleInk: '#ffffff', ink: '#ffffff', window: '#ffff00', windowInk: '#000000', sel: '#000000', selInk: '#ffffff', iconInk: '#000000' }),
    'Vaporwave': S({ desk: '#2b1650', face: '#d8c4e8', hi2: '#ecdff5', lo: '#9278ab', title1: '#ff3d9a', title2: '#22d3ee', off1: '#a08cb8', off2: '#c2b0d6', sel: '#ff3d9a' })
  };
  function applyScheme(name) {
    const s = SCHEMES[name] || SCHEMES['Windows Standard'], r = document.documentElement.style;
    const map = { desk: '--desk', face: '--face', hi: '--hi', hi2: '--hi2', lo: '--lo', dk: '--dk', title1: '--title1', title2: '--title2', off1: '--title-off1', off2: '--title-off2',
      titleInk: '--title-ink', ink: '--ink', window: '--window', windowInk: '--window-ink', sel: '--sel', selInk: '--sel-ink', iconInk: '--icon-ink' };
    for (const k in map) r.setProperty(map[k], s[k]);
  }

  /* ================= Wallpapers (Background tab), painted procedurally ================= */
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const paint = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c.toDataURL(); };
  const WALLPAPERS = {
    '(None)': null,
    'Clouds': { cover: true, make: () => paint(960, 600, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#3f78d0'); sky.addColorStop(1, '#a9c9f2'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      const r = rnd(7);
      for (let i = 0; i < 26; i++) {
        const cx = r() * w, cy = r() * h * .9, s = 40 + r() * 70;
        for (let j = 0; j < 9; j++) {
          const x = cx + (r() - .5) * s * 2.4, y = cy + (r() - .5) * s * .6, rr = s * (.4 + r() * .5);
          const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
        }
      }
    }) },
    'Space': { cover: true, make: () => paint(960, 600, (g, w, h) => {
      g.fillStyle = '#05041a'; g.fillRect(0, 0, w, h);
      const r = rnd(42);
      [['#5b2a86', .3, .4], ['#1e4a8a', .7, .65], ['#8a2a5b', .55, .2]].forEach(([c, x, y]) => {
        const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, 300); gr.addColorStop(0, c + 'aa'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${.3 + r() * .7})`; const s = r() < .05 ? 2 : 1; g.fillRect(r() * w | 0, r() * h | 0, s, s); }
      const pg = g.createRadialGradient(w * .78 - 30, h * .3 - 30, 10, w * .78, h * .3, 80); pg.addColorStop(0, '#f2b26b'); pg.addColorStop(1, '#6a2e12');
      g.fillStyle = pg; g.beginPath(); g.arc(w * .78, h * .3, 80, 0, 7); g.fill();
      g.strokeStyle = 'rgba(240,210,170,.6)'; g.lineWidth = 3; g.beginPath(); g.ellipse(w * .78, h * .3, 130, 26, -.3, 0, 7); g.stroke();
    }) },
    'Red Bricks': { tile: '64px 32px', make: () => paint(64, 32, (g) => {
      g.fillStyle = '#d9cfc0'; g.fillRect(0, 0, 64, 32);
      const b = (x, y, w) => { g.fillStyle = '#9a3322'; g.fillRect(x + 1, y + 1, w - 2, 14); g.fillStyle = '#b8472f'; g.fillRect(x + 1, y + 1, w - 2, 2); g.fillStyle = '#6e2015'; g.fillRect(x + 1, y + 13, w - 2, 2); };
      b(0, 0, 32); b(32, 0, 32); b(-16, 16, 32); b(16, 16, 32); b(48, 16, 32);
    }) },
    'Circuit Board': { tile: '96px 96px', make: () => paint(96, 96, (g) => {
      g.fillStyle = '#0d4a2a'; g.fillRect(0, 0, 96, 96);
      g.strokeStyle = '#3fbf6a'; g.lineWidth = 2; g.lineCap = 'square';
      [[0, 16, 40, 16, 40, 48, 96, 48], [16, 0, 16, 80, 64, 80, 64, 96], [72, 0, 72, 24, 96, 24], [0, 72, 8, 72], [48, 48, 48, 64, 88, 64, 88, 96]].forEach(p => {
        g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke();
      });
      g.fillStyle = '#d8c46a'; [[40, 16], [16, 80], [72, 24], [48, 64], [88, 64]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.fillStyle = '#0d4a2a'; g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill(); g.fillStyle = '#d8c46a'; });
      g.fillStyle = '#111'; g.fillRect(56, 6, 22, 12); g.fillStyle = '#999'; for (let i = 0; i < 4; i++) { g.fillRect(58 + i * 5, 3, 2, 3); g.fillRect(58 + i * 5, 18, 2, 3); }
    }) },
    'Houndstooth': { tile: '16px 16px', make: () => paint(16, 16, (g) => {
      g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#2a2a2a';
      g.fillRect(0, 0, 8, 8); g.beginPath(); g.moveTo(8, 0); g.lineTo(12, 0); g.lineTo(8, 4); g.fill();
      g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 12); g.lineTo(4, 8); g.fill();
      g.beginPath(); g.moveTo(8, 8); g.lineTo(16, 16); g.lineTo(12, 16); g.lineTo(8, 12); g.fill();
      g.beginPath(); g.moveTo(16, 8); g.lineTo(16, 4); g.lineTo(12, 8); g.fill();
    }) },
    'Flower Power': { tile: '120px 120px', make: () => paint(120, 120, (g) => {
      g.fillStyle = '#f7d046'; g.fillRect(0, 0, 120, 120);
      const flower = (x, y, r, petal, core) => { g.fillStyle = petal; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .45, 0, 7); g.fill(); } g.fillStyle = core; g.beginPath(); g.arc(x, y, r * .35, 0, 7); g.fill(); };
      flower(30, 30, 26, '#e8542e', '#fff3c2'); flower(90, 90, 26, '#d63a8a', '#f7d046'); flower(90, 22, 14, '#2fa4a8', '#fff'); flower(24, 96, 14, '#7a3fb0', '#fff');
    }) },
    'Vaporwave': { cover: true, make: () => paint(960, 600, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * .62); sky.addColorStop(0, '#1a0b3a'); sky.addColorStop(1, '#ff4f9a'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      const sg = g.createLinearGradient(0, h * .2, 0, h * .62); sg.addColorStop(0, '#ffe66b'); sg.addColorStop(1, '#ff3d8a');
      g.fillStyle = sg; g.beginPath(); g.arc(w / 2, h * .62, 170, Math.PI, 0); g.fill();
      g.save(); g.beginPath(); g.arc(w / 2, h * .62, 170, Math.PI, 0); g.clip(); g.fillStyle = '#ff4f9a'; for (let i = 0; i < 7; i++) g.fillRect(w / 2 - 180, h * .62 - 14 - i * 18, 360, 6 - i * .6); g.restore();
      g.fillStyle = '#12062a'; g.fillRect(0, h * .62, w, h);
      g.strokeStyle = '#22d3ee'; g.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { const y = h * .62 + Math.pow(i / 13, 2) * h * .38; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(w / 2 + i * 12, h * .62); g.lineTo(w / 2 + i * 90, h); g.stroke(); }
    }) },
    'Desert Dunes': { cover: true, make: () => paint(960, 600, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * .5); sky.addColorStop(0, '#f2a65a'); sky.addColorStop(1, '#ffe3a8'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(w * .25, h * .32, 40, 0, 7); g.fill();
      [['#d9954a', .5, 40], ['#c27a34', .62, 50], ['#a8612a', .78, 60]].forEach(([c, b, a], k) => {
        g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, h * b + Math.sin(x * .006 + k * 2) * a + Math.sin(x * .017 + k) * a * .3);
        g.lineTo(w, h); g.fill();
      });
    }) },
    'Rain': { tile: '64px 64px', make: () => paint(64, 64, (g) => {
      g.fillStyle = '#4f6478'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(210,225,240,.45)'; g.lineWidth = 1;
      const r = rnd(3); for (let i = 0; i < 18; i++) { const x = r() * 64, y = r() * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 10); g.stroke(); }
    }) },
    'Inside Your Computer': { cover: true, make: () => paint(960, 600, (g, w, h) => {
      g.fillStyle = '#0a2a1a'; g.fillRect(0, 0, w, h);
      const r = rnd(11);
      g.strokeStyle = 'rgba(80,220,140,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 90; i++) { let x = r() * w | 0, y = r() * h | 0; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (r() < .5) x += (r() - .5) * 200 | 0; else y += (r() - .5) * 200 | 0; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 14; i++) { const x = r() * w, y = r() * h, cw = 60 + r() * 80, ch = 30 + r() * 50; g.fillStyle = '#151515'; g.fillRect(x, y, cw, ch); g.fillStyle = '#b8b8b8'; for (let p = 6; p < cw - 4; p += 8) { g.fillRect(x + p, y - 4, 3, 4); g.fillRect(x + p, y + ch, 3, 4); } g.fillStyle = '#444'; g.fillRect(x + 6, y + 6, cw * .4, 4); }
      for (let i = 0; i < 30; i++) { g.fillStyle = ['#c84a2a', '#2a6ac8', '#d8c46a'][i % 3]; const x = r() * w, y = r() * h; g.fillRect(x, y, 14, 6); }
    }) }
  };
  const wpCache = {};
  function wallpaperURL(name) { const wp = WALLPAPERS[name]; if (!wp) return null; return wpCache[name] || (wpCache[name] = wp.make()); }
  function applyWallpaper(name) {
    const r = document.documentElement.style, wp = WALLPAPERS[name], url = wallpaperURL(name);
    if (!url) { r.setProperty('--wallpaper', 'none'); r.setProperty('--wallpaper-size', 'auto'); return; }
    r.setProperty('--wallpaper', `url(${url})`); r.setProperty('--wallpaper-size', wp.cover ? 'cover' : wp.tile);
  }

  /* ================= Theme packs ================= */
  const PACKS = {
    'Windows Default': { scheme: 'Windows Standard', wallpaper: '(None)', blurb: 'Teal desktop, navy title bars. The way it shipped.' },
    'Space Age': { scheme: 'Storm', wallpaper: 'Space', blurb: 'Ringed planets and purple nebulae for late-night sessions.' },
    'Inside Your Computer': { scheme: 'Spruce', wallpaper: 'Inside Your Computer', blurb: 'Chips, traces and resistors, as seen from the motherboard.' },
    'Hot Dog Stand': { scheme: 'Hot Dog Stand', wallpaper: '(None)', blurb: 'The infamous red and yellow scheme. Sunglasses recommended.' },
    'Rainy Day': { scheme: 'Rainy Day', wallpaper: 'Rain', blurb: 'Blue-grey drizzle and calm slate windows.' },
    'Desert Mirage': { scheme: 'Desert', wallpaper: 'Desert Dunes', blurb: 'Sunset dunes with sandstone window chrome.' },
    'Groovy 60s': { scheme: 'Pumpkin', wallpaper: 'Flower Power', blurb: 'Flower power in orange, pink and mustard.' },
    'Blue Skies': { scheme: 'Windows Standard', wallpaper: 'Clouds', blurb: 'Fluffy clouds behind the classic grey.' },
    'Vaporwave 95': { scheme: 'Vaporwave', wallpaper: 'Vaporwave', blurb: 'Neon sun, endless grid, pastel chrome.' },
    'Brick House': { scheme: 'Brick', wallpaper: 'Red Bricks', blurb: 'Red brick tiles and warm sandstone grey.' },
    'Tweed Office': { scheme: 'Slate', wallpaper: 'Houndstooth', blurb: 'Houndstooth and slate, for spreadsheets with gravitas.' }
  };
  let theme = store.get('theme', { scheme: 'Windows Standard', wallpaper: '(None)' });
  function applyTheme(t) { applyScheme(t.scheme); applyWallpaper(t.wallpaper); }
  applyTheme(theme);

  const ICONS = {
    display: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="2" width="14" height="10" fill="#333"/><rect x="2" y="3" width="12" height="8" fill="#0b7a78"/><rect x="3" y="4" width="4" height="3" fill="#ffd94a"/><rect x="8" y="6" width="5" height="4" fill="#ff3d8a"/><rect x="6" y="12" width="4" height="2" fill="#777"/><rect x="4" y="14" width="8" height="1" fill="#555"/></svg>',
    folder: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="3" width="6" height="2" fill="#e0b400"/><rect x="1" y="4" width="14" height="10" fill="#ffd94a"/><rect x="1" y="13" width="14" height="1" fill="#b08800"/><rect x="14" y="5" width="1" height="9" fill="#b08800"/><rect x="5" y="7" width="6" height="4" fill="#c0302a"/><rect x="6" y="8" width="1" height="1" fill="#fff"/><rect x="9" y="9" width="1" height="1" fill="#fff"/></svg>',
    scores: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="2" width="8" height="6" fill="#ffd23f"/><rect x="2" y="3" width="2" height="3" fill="#e0a500"/><rect x="12" y="3" width="2" height="3" fill="#e0a500"/><rect x="6" y="8" width="4" height="2" fill="#e0a500"/><rect x="7" y="10" width="2" height="2" fill="#e0a500"/><rect x="4" y="12" width="8" height="2" fill="#7a4a12"/><rect x="5" y="3" width="2" height="3" fill="#fff3b0"/></svg>',
    readme: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="1" width="10" height="14" fill="#fff"/><rect x="3" y="1" width="10" height="2" fill="#1d8ad6"/><rect x="5" y="5" width="6" height="1" fill="#555"/><rect x="5" y="7" width="6" height="1" fill="#555"/><rect x="5" y="9" width="4" height="1" fill="#555"/><rect x="5" y="11" width="5" height="1" fill="#555"/><rect x="13" y="2" width="1" height="13" fill="#555"/></svg>',
    bin: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="3" width="10" height="2" fill="#9a9aa2"/><rect x="6" y="2" width="4" height="1" fill="#9a9aa2"/><rect x="4" y="5" width="8" height="10" fill="#d4d4da"/><rect x="5" y="6" width="1" height="8" fill="#9a9aa2"/><rect x="7" y="6" width="1" height="8" fill="#9a9aa2"/><rect x="9" y="6" width="1" height="8" fill="#9a9aa2"/><rect x="11" y="5" width="1" height="10" fill="#9a9aa2"/></svg>'
  };

  Arcade.css(`
    .dp-tabs { display: flex; gap: 0; padding: 4px 4px 0; position: relative; z-index: 1; }
    .dp-tabs button { border: 0; background: var(--face); padding: 3px 10px 4px; margin-right: -2px; position: relative; top: 2px;
      box-shadow: inset 1px 1px var(--hi), inset -1px 0 var(--dk), inset -2px 0 var(--lo); border-radius: 3px 3px 0 0; }
    .dp-tabs button[aria-selected="true"] { top: 0; padding-bottom: 6px; z-index: 2; background: var(--face); }
    .dp-page { margin: 0 4px; padding: 12px; box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi), inset -2px -2px var(--lo); display: grid; gap: 10px; }
    .dp-monitor { width: 184px; margin: 0 auto; padding: 10px 10px 18px; background: #c8c8cc; border-radius: 6px 6px 2px 2px; position: relative;
      box-shadow: inset -2px -2px #7a7a80, inset 2px 2px #fff; }
    .dp-monitor::after { content: ''; position: absolute; left: 64px; right: 64px; bottom: -10px; height: 10px; background: #a8a8ae; box-shadow: inset 0 -2px #6a6a70; }
    .dp-screen { height: 116px; background-color: var(--pv-desk, #0b7a78); background-repeat: repeat; position: relative; overflow: hidden; box-shadow: inset 1px 1px #333; }
    .dp-mini { position: absolute; left: 22px; top: 22px; width: 120px; padding: 2px; font: 9px var(--ui); }
    .dp-mini .t { height: 10px; margin-bottom: 2px; padding: 0 3px; font-weight: bold; line-height: 10px; }
    .dp-mini .b { padding: 4px; }
    .dp-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .dp-list { height: 120px; overflow: auto; background: var(--window); color: var(--window-ink); padding: 2px; flex: 1; min-width: 150px; }
    .dp-list button { display: block; width: 100%; text-align: left; border: 0; background: none; color: inherit; padding: 1px 4px; }
    .dp-list button[aria-selected="true"] { background: var(--sel); color: var(--sel-ink); }
    .dp-blurb { min-height: 32px; max-width: 46ch; }
    .dp-actions { display: flex; justify-content: flex-end; gap: 6px; padding: 10px 4px 4px; flex-wrap: wrap; }
  `);

  /* ================= Display Properties ================= */
  Arcade.app({
    id: 'display', title: 'Display Properties', icon: ICONS.display, width: 400, folder: 'Accessories', start: true,
    hint: 'Theme packs, wallpapers and color schemes from the old days.',
    preview(g, w, h, t) {
      const names = Object.keys(PACKS), name = names[Math.floor(t / 1.6) % names.length], p = PACKS[name], s = SCHEMES[p.scheme];
      g.fillStyle = s.desk; g.fillRect(0, 0, w, h);
      const url = wallpaperURL(p.wallpaper);
      if (url) { const img = previewImgs[url] || (previewImgs[url] = Object.assign(new Image(), { src: url })); if (img.complete) { const wp = WALLPAPERS[p.wallpaper]; if (wp.cover) g.drawImage(img, 0, 0, w, h); else { const pat = g.createPattern(img, 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, w, h); } } }
      g.fillStyle = s.face; g.fillRect(40, 26, 128, 66);
      const tg = g.createLinearGradient(42, 0, 166, 0); tg.addColorStop(0, s.title1); tg.addColorStop(1, s.title2); g.fillStyle = tg; g.fillRect(42, 28, 124, 11);
      g.fillStyle = s.titleInk; g.font = 'bold 8px Tahoma, sans-serif'; g.fillText(name, 45, 37);
      g.fillStyle = s.window; g.fillRect(46, 44, 116, 42);
    },
    build(ctx) {
      let draft = { ...theme }, tab = 'Theme Packs';
      ctx.body.innerHTML = `<div class="dp-tabs" role="tablist"></div><div class="dp-page"></div>
        <div class="dp-actions"><button class="btn" data-a="ok">OK</button><button class="btn" data-a="cancel">Cancel</button><button class="btn" data-a="apply">Apply</button></div>`;
      const tabsEl = ctx.body.querySelector('.dp-tabs'), page = ctx.body.querySelector('.dp-page');
      ['Theme Packs', 'Background', 'Appearance'].forEach(n => {
        const b = el('<button role="tab"></button>'); b.textContent = n;
        b.onclick = () => { tab = n; render(); }; tabsEl.appendChild(b);
      });
      const monitor = () => {
        const s = SCHEMES[draft.scheme], url = wallpaperURL(draft.wallpaper), wp = WALLPAPERS[draft.wallpaper];
        return `<div class="dp-monitor"><div class="dp-screen" style="--pv-desk:${s.desk};${url ? `background-image:url(${url});background-size:${wp.cover ? 'cover' : wp.tile.split(' ').map(v => parseInt(v) / 4 + 'px').join(' ')}` : ''}">
          <div class="dp-mini" style="background:${s.face};box-shadow:inset -1px -1px ${s.dk},inset 1px 1px ${s.hi}">
            <div class="t" style="background:linear-gradient(90deg,${s.title1},${s.title2});color:${s.titleInk}">Active Window</div>
            <div class="b" style="background:${s.window};color:${s.windowInk}">Window text<br><span style="background:${s.sel};color:${s.selInk}">Selected</span></div>
          </div></div></div>`;
      };
      const list = (items, current, pick) => {
        const box = el('<div class="dp-list bevel-in" role="listbox"></div>');
        items.forEach(n => { const b = el('<button role="option"></button>'); b.textContent = n; b.setAttribute('aria-selected', String(n === current)); b.onclick = () => pick(n); b.ondblclick = () => { pick(n); commit(); }; box.appendChild(b); });
        setTimeout(() => { const sel = box.querySelector('[aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest' }); }, 0);
        return box;
      };
      function render() {
        tabsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.textContent === tab)));
        page.innerHTML = monitor();
        const row = el('<div class="dp-row"></div>');
        if (tab === 'Theme Packs') {
          const cur = Object.keys(PACKS).find(k => PACKS[k].scheme === draft.scheme && PACKS[k].wallpaper === draft.wallpaper);
          row.appendChild(list(Object.keys(PACKS), cur, n => { draft = { scheme: PACKS[n].scheme, wallpaper: PACKS[n].wallpaper }; render(); }));
          page.appendChild(row);
          const bl = el('<p class="dp-blurb"></p>'); bl.textContent = cur ? PACKS[cur].blurb : 'Custom: your own mix of wallpaper and color scheme.'; page.appendChild(bl);
        } else if (tab === 'Background') {
          const lab = el('<div>Wallpaper:</div>'); page.appendChild(lab);
          row.appendChild(list(Object.keys(WALLPAPERS), draft.wallpaper, n => { draft.wallpaper = n; render(); }));
          page.appendChild(row);
        } else {
          const lab = el('<label class="dp-row">Scheme: <select class="field" id="dp-scheme"></select></label>');
          const sel = lab.querySelector('select');
          Object.keys(SCHEMES).forEach(n => { const o = document.createElement('option'); o.textContent = n; o.selected = n === draft.scheme; sel.appendChild(o); });
          sel.onchange = () => { draft.scheme = sel.value; render(); };
          page.appendChild(lab);
        }
      }
      function commit() { theme = { ...draft }; store.set('theme', theme); applyTheme(theme); Arcade.beep(660, .08, 'square', .03); }
      ctx.body.querySelector('[data-a="ok"]').onclick = () => { commit(); ctx.close(); };
      ctx.body.querySelector('[data-a="apply"]').onclick = commit;
      ctx.body.querySelector('[data-a="cancel"]').onclick = () => ctx.close();
      ctx.on('open', () => { draft = { ...theme }; render(); });
      render();
    }
  });
  const previewImgs = {};

  /* ================= Games folder ================= */
  Arcade.app({
    id: 'gamesfolder', title: 'Games', icon: ICONS.folder, width: 440, height: 330, max: true, status: true,
    hint: 'Every game and accessory in one folder.',
    build(ctx) {
      const box = el('<div class="folder bevel-in"></div>');
      ctx.body.appendChild(box);
      const list = Arcade.order.filter(id => Arcade.apps[id].folder);
      list.forEach(id => box.appendChild(Arcade.iconButton(Arcade.apps[id])));
      ctx.setTitle('C:\\ARCADE\\GAMES');
      ctx.status(`${list.length} object(s)`, 'Hover an icon for a preview');
    }
  });

  /* ================= High Scores ================= */
  Arcade.app({
    id: 'scores', title: 'High Scores', icon: ICONS.scores, width: 380, height: 420, status: true, start: true,
    hint: 'Best times and top scores from every game.',
    build(ctx) {
      const doc = el('<div class="doc bevel-in"></div>'); ctx.body.appendChild(doc);
      const render = () => {
        const secs = Arcade.scores.list();
        doc.innerHTML = secs.length ? '' : '<p>No scores yet. Go play something.</p>';
        secs.forEach(s => {
          let rows = ''; try { rows = s.render(); } catch (e) { rows = '<tr><td>Could not read scores.</td></tr>'; }
          const t = el('<table class="scores"><caption></caption><tbody></tbody></table>');
          t.querySelector('caption').textContent = s.game; t.querySelector('tbody').innerHTML = rows; doc.appendChild(t);
        });
      };
      ctx.on('open', render); ctx.on('focus', render); render();
      ctx.status('Saved in this browser only');
    }
  });

  /* ================= Readme ================= */
  Arcade.app({
    id: 'readme', title: 'Readme.txt - Notepad', label: 'Readme.txt', icon: ICONS.readme, width: 460, height: 440, max: true, start: true,
    hint: 'What is on this computer and how to play.',
    menus: [{ label: 'File', items: [{ label: 'Exit', action: () => Arcade.apps.readme.ctx.close() }] }, { label: 'Help', items: [{ label: 'About Arcade 95', action: () => Arcade.dialog({ title: 'About Arcade 95', text: 'Arcade 95. Every game here is an original remake, drawn and scored in your browser. Nothing is downloaded.' }) }] }],
    build(ctx) {
      ctx.body.innerHTML = `<div class="doc bevel-in">
        <h2>Welcome to Arcade 95</h2>
        <p>A Windows 95 desktop full of games. Double-click an icon to open it, or use the Start menu. Hover over an icon to see a preview. Every window can be dragged, minimized and closed, and the games pause when you click away.</p>
        <p><b>Games</b></p>
        <ul>
          <li><b>Byte Rush</b>: arrows run, Space jumps (hold for higher), X dashes in 8 directions, jump against a wall to wall-jump.</li>
          <li><b>Minesweeper</b>: left-click to reveal, right-click to flag. On a phone, long-press to flag.</li>
          <li><b>Solitaire</b> and <b>FreeCell</b>: drag cards, or double-click to send a card home.</li>
          <li><b>Ski Slope</b>: steer with the arrows or the mouse. Keep skiing and something will come looking for you.</li>
          <li><b>Hover!</b>: capture the three red flags in the maze before the other hovercraft grab yours.</li>
          <li><b>Space Pinball</b>: Z and / are the flippers. Hold Space to pull the plunger.</li>
          <li><b>Snake 98</b>: arrow keys. Eat, grow, don't bite yourself.</li>
        </ul>
        <p><b>Accessories</b></p>
        <ul>
          <li><b>Amp 95</b> and <b>CD Player</b>: original chiptune songs, all synthesized live.</li>
          <li><b>Display Properties</b>: theme packs, wallpapers and color schemes, including Hot Dog Stand.</li>
        </ul>
        <p>Scores and settings are saved in this browser only.</p>
      </div>`;
    }
  });

  /* ================= Recycle Bin ================= */
  Arcade.app({
    id: 'bin', title: 'Recycle Bin', icon: ICONS.bin, width: 320, status: true,
    hint: 'Empty, as always.',
    build(ctx) {
      ctx.body.innerHTML = '<div class="doc bevel-in"><p>The Recycle Bin is empty. Every bug Byte squashes is deleted for good.</p></div>';
      ctx.status('0 object(s)');
    }
  });

  // Desktop order: system shortcuts first, like the real thing
  const firsts = ['gamesfolder', 'display', 'scores', 'readme', 'bin'];
  const ord = Arcade.order; firsts.slice().reverse().forEach(id => { ord.splice(ord.indexOf(id), 1); ord.unshift(id); });
})();

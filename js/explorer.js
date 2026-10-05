/* Arcade Explorer: an IE3/4-style browser with a Time Machine. Plain addresses load from the Internet Archive's
   Wayback Machine for the chosen year (1996–2005); "Live web" loads sites directly (most big sites refuse framing).
   Our own history stack drives Back/Forward because a cross-origin iframe's location and history are unreadable. */
(() => {
  const YEARS = []; for (let y = 1996; y <= 2005; y++) YEARS.push(y);
  const store = { get: (k, d) => Arcade.store.get('explorer.' + k, d), set: (k, v) => Arcade.store.set('explorer.' + k, v) };
  const esc = s => Arcade.esc(s);
  const cfg = Object.assign({ year: 1998, live: false, toolbar: true, address: true, links: true, statusbar: true, favpane: false }, store.get('cfg', {}));
  if (!YEARS.includes(cfg.year)) cfg.year = 1998;
  const saveCfg = () => store.set('cfg', cfg);

  /* Archived sites: each returned HTTP 200 from web.archive.org (or the availability API) for the year shown, Oct 2026.
     Snapshots are "nearest to June 1" of that year, so a few land a month or two off. */
  const COOL = [
    { name: 'Yahoo!', url: 'http://www.yahoo.com/', year: 1998, note: 'the web directory everybody used' },
    { name: 'GeoCities', url: 'http://www.geocities.com/', year: 1998, note: 'free homepages in neighborhoods' },
    { name: 'Space Jam', url: 'http://www.spacejam.com/', year: 1997, note: 'the 1996 movie site, still famous' },
    { name: 'AltaVista', url: 'http://www.altavista.com/', year: 1998, note: 'the fastest search on the planet' },
    { name: 'Lycos', url: 'http://www.lycos.com/', year: 1998, note: 'go get it!' },
    { name: 'Excite', url: 'http://www.excite.com/', year: 1998, note: 'portal with channels' },
    { name: 'Netscape', url: 'http://home.netscape.com/', year: 1998, note: 'Netcenter' },
    { name: 'Amazon.com', url: 'http://www.amazon.com/', year: 1999, note: "Earth's biggest selection" },
    { name: 'CNN.com', url: 'http://www.cnn.com/', year: 2000, note: 'news, updated every day' },
    { name: 'Google!', url: 'http://www.google.com/', year: 1999, note: 'a new search engine in beta' },
    { name: 'eBay', url: 'http://www.ebay.com/', year: 1999, note: 'your personal trading community' },
    { name: 'Ask Jeeves', url: 'http://www.ask.com/', year: 1999, note: 'just ask a question' },
    { name: 'Apple', url: 'http://www.apple.com/', year: 1997, note: 'think different' },
    { name: 'Nintendo', url: 'http://www.nintendo.com/', year: 2001, note: 'GameCube is coming' }
  ];
  /* Live sites that send neither X-Frame-Options nor a CSP frame-ancestors (checked with curl -I). */
  const LIVE_OK = [
    { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
    { name: 'Wikipedia portal', url: 'https://www.wikipedia.org/' },
    { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html' },
    { name: 'Google (embeddable)', url: 'https://www.google.com/webhp?igu=1' },
    { name: 'The first website (CERN)', url: 'https://info.cern.ch/' },
    { name: 'Internet Archive', url: 'https://archive.org/' },
    { name: 'Wiby (search the old web)', url: 'https://wiby.me/' },
    { name: 'example.com', url: 'https://example.com/' }
  ];
  const LIVE_OK_HOSTS = new Set(['en.wikipedia.org', 'www.wikipedia.org', 'en.m.wikipedia.org', 'www.openstreetmap.org', 'www.google.com', 'info.cern.ch', 'archive.org', 'wiby.me', 'example.com']);
  const LINKS = [
    { name: "Yahoo! '98", url: 'http://www.yahoo.com/', year: 1998 },
    { name: "GeoCities '98", url: 'http://www.geocities.com/', year: 1998 },
    { name: 'Space Jam', url: 'http://www.spacejam.com/', year: 1997 },
    { name: "Google '99", url: 'http://www.google.com/', year: 1999 },
    { name: "Apple '97", url: 'http://www.apple.com/', year: 1997 },
    { name: "eBay '99", url: 'http://www.ebay.com/', year: 1999 },
    { name: 'Wikipedia (live)', url: 'https://en.wikipedia.org/wiki/Main_Page', live: true },
    { name: 'Map (live)', url: 'https://www.openstreetmap.org/export/embed.html', live: true }
  ];

  /* ---------- pixel art helpers ---------- */
  // Build a crisp SVG from a pixel predicate: runs of same-colored pixels on a row merge into one rect.
  function pix(size, colorAt) {
    let out = '';
    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        const c = colorAt(x, y);
        if (!c) { x++; continue; }
        let w = 1; while (x + w < size && colorAt(x + w, y) === c) w++;
        out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`; x += w;
      }
    }
    return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${out}</svg>`;
  }
  const land = (lon, lat) => Math.sin(lon * 2 + 1) * Math.cos(lat * 2.2) + Math.sin(lon * 5 + lat * 3) * .45 + Math.cos(lat * 5 - lon) * .3 > .55;
  // Sphere sample shared by the icon, the throbber and the preview: returns a color or null.
  function globeColor(x, y, cx, cy, r, phase) {
    const dx = (x + .5 - cx) / r, dy = (y + .5 - cy) / r, d2 = dx * dx + dy * dy;
    if (d2 > 1) return null;
    if (d2 > .8) return '#0b2470';
    const z = Math.sqrt(1 - d2), lon = Math.atan2(dx, z) + phase, lat = Math.asin(dy);
    const lit = dx * -.5 + dy * -.6 + z * .62 > .55;
    if (land(lon, lat)) return lit ? '#5fd35a' : '#2d9a3a';
    return lit ? '#4a8cff' : '#1f55d8';
  }
  const ICON = pix(16, (x, y) => globeColor(x, y, 8, 8, 7.3, 2.2) || (y === 15 && x > 3 && x < 12 ? '#555' : null));

  const tri = (x, y, tipX, cy, len, dir) => { const dx = (x - tipX) * dir; return dx >= 0 && dx < len && Math.abs(y + .5 - cy) <= dx + .5; };
  const ring = (x, y, cx, cy, r1, r2) => { const d = Math.hypot(x + .5 - cx, y + .5 - cy); return d >= r1 && d < r2; };
  const ICONS = {
    back: pix(20, (x, y) => (tri(x, y, 2, 10, 8, 1) || (x >= 9 && x <= 17 && y >= 7 && y <= 12)) ? ((y > 10 && x > 5) ? '#0f7a1e' : '#2fbf3f') : null),
    fwd: pix(20, (x, y) => (tri(x, y, 17, 10, 8, -1) || (x >= 2 && x <= 10 && y >= 7 && y <= 12)) ? ((y > 10 && x < 14) ? '#0f7a1e' : '#2fbf3f') : null),
    stop: pix(20, (x, y) => {
      const oct = Math.abs(x + .5 - 10) + Math.abs(y + .5 - 10) <= 11 && Math.abs(x + .5 - 10) <= 8 && Math.abs(y + .5 - 10) <= 8;
      if (!oct) return null;
      const u = x - 6, v = y - 6;
      if (u >= 0 && u <= 7 && v >= 0 && v <= 7 && (Math.abs(u - v) <= .5 || Math.abs(u + v - 7) <= .5)) return '#fff';
      return '#d42020';
    }),
    refresh: pix(20, (x, y) => {
      if (ring(x, y, 10, 10, 4.5, 7.5) && !(x >= 10 && y < 10 && x - 10 < 10 - y) && !(x < 10 && y >= 10 && 10 - x < y - 10)) return y < 10 ? '#2fbf3f' : '#1f55d8';
      if (tri(y, x, 1, 15.5, 5, 1) && x >= 13) return '#2fbf3f';
      if (tri(y, x, 18, 4.5, 5, -1) && x <= 6) return '#1f55d8';
      return null;
    }),
    home: pix(20, (x, y) => {
      if (y >= 2 && y <= 9 && Math.abs(x + .5 - 10) <= (y - 2) + 1.5) return y === 9 ? '#7a1010' : '#d42020';
      if (x >= 4 && x <= 15 && y >= 10 && y <= 17) {
        if (x >= 8 && x <= 11 && y >= 12) return '#7a4a12';
        if (x >= 13 && x <= 14 && y >= 11 && y <= 13) return '#4a8cff';
        return '#f2e2b0';
      }
      if (x >= 14 && x <= 15 && y >= 3 && y <= 6) return '#555';
      return null;
    }),
    search: pix(20, (x, y) => {
      if (ring(x, y, 8, 8, 4.5, 6.5)) return '#333';
      if (ring(x, y, 8, 8, 0, 4.5)) return (x < 8 && y < 8) ? '#e8f4ff' : '#9cc8ff';
      const t = x - y; if (x >= 12 && y >= 12 && x <= 18 && y <= 18 && Math.abs(t) <= 1) return '#7a4a12';
      return null;
    }),
    favs: pix(20, (x, y) => {
      const a = Math.atan2(y + .5 - 10.5, x + .5 - 10), d = Math.hypot(y + .5 - 10.5, x + .5 - 10);
      const k = ((a + Math.PI / 2) / (2 * Math.PI / 5) % 1 + 1) % 1, rr = 3.6 + 5.4 * Math.abs(k - .5) * 2;
      if (d < rr * .98) return (y > 11 || x > 13) ? '#e0a500' : '#ffd23f';
      return null;
    }),
    clock: pix(16, (x, y) => {
      if (ring(x, y, 8, 8, 5.6, 7.2)) return '#333';
      if (ring(x, y, 8, 8, 0, 5.6)) return ((x === 7 || x === 8) && y >= 4 && y <= 8) || (y === 8 && x >= 7 && x <= 11) ? '#000' : '#fff';
      return null;
    }),
    live: pix(16, (x, y) => globeColor(x, y, 8, 8, 7, .3)),
    page: pix(16, (x, y) => (x >= 3 && x <= 12 && y >= 1 && y <= 14) ? ((x === 3 || x === 12 || y === 1 || y === 14) ? '#555' : (y % 3 === 0 && x > 4 && x < 11 ? '#8a8a8a' : '#fff')) : null),
    folder: pix(16, (x, y) => (y >= 3 && y <= 4 && x >= 1 && x <= 6) ? '#e0b400' : (y >= 4 && y <= 13 && x >= 1 && x <= 14 ? (y === 13 ? '#b08800' : '#ffd94a') : null))
  };

  /* ---------- throbber (canvas, original spinning globe with an orbiting pixel satellite) ---------- */
  function drawGlobe(g, ox, oy, size, phase) {
    const r = size / 2 - .5;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const c = globeColor(x, y, size / 2, size / 2, r, phase); if (c) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); }
    }
  }

  /* ---------- hover-card preview ---------- */
  function preview(g, w, h, t) {
    g.fillStyle = '#c3c3c6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0a1a86'; g.fillRect(2, 2, w - 4, 10);
    g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.fillText('Arcade Explorer', 6, 10);
    [8, 24, 40, 56].forEach((x, i) => { g.fillStyle = ['#2fbf3f', '#2fbf3f', '#d42020', '#d42020'][i]; g.fillRect(x, 17, 10, 8); });
    const loading = (t % 6) < 4, ph = loading ? t * 3 : 0;
    g.fillStyle = '#000'; g.fillRect(w - 27, 14, 24, 24);
    g.save(); g.translate(w - 25, 16); drawGlobe(g, 0, 0, 20, ph); g.restore();
    g.fillStyle = '#fff'; g.fillRect(8, 30, w - 40, 9); g.fillStyle = '#000'; g.font = '7px monospace';
    g.fillText('http://www.geocities.com/', 11, 37);
    g.fillStyle = '#fff'; g.fillRect(4, 42, w - 8, h - 54);
    if (!loading || (t % 6) > 2) {
      g.fillStyle = '#008080'; g.fillRect(8, 46, w - 16, 12);
      g.fillStyle = '#ff0'; g.font = 'bold 9px serif'; g.fillText('Welcome to my HomePage!!', 14, 55);
      for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${(i * 70 + t * 120) % 360} 80% 45%)`; g.fillRect(12, 63 + i * 7, 60 + ((i * 37) % 90), 3); }
      g.fillStyle = (t * 2 % 1) < .5 ? '#000' : '#ffd400'; g.fillRect(w - 64, 64, 50, 12);
      g.fillStyle = (t * 2 % 1) < .5 ? '#ffd400' : '#000'; g.font = 'bold 6px sans-serif'; g.fillText('UNDER CONSTR.', w - 62, 72);
    }
    g.fillStyle = '#c3c3c6'; g.fillRect(0, h - 11, w, 11); g.fillStyle = '#000'; g.font = '7px sans-serif';
    g.fillText(loading ? 'Opening page http://www.geocities.com/…' : 'Done', 5, h - 3);
    if (loading) { g.fillStyle = '#0a1a86'; for (let i = 0; i < ((t % 4) * 4 | 0); i++) g.fillRect(w - 70 + i * 4, h - 9, 3, 7); }
  }

  /* ---------- styles ---------- */
  Arcade.css(`
  #w-explorer .wbody { padding: 0; overflow: hidden; }
  .ie-root { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .ie-bars { flex: none; display: flex; flex-direction: column; gap: 2px; padding: 1px 1px 3px; }
  .ie-row { display: flex; align-items: center; gap: 2px; min-width: 0; padding: 2px 3px;
    box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
  .ie-row::before { content: ''; flex: none; width: 3px; align-self: stretch; margin: 1px 4px 1px 0;
    box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
  .ie-tools { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .ie-tools::-webkit-scrollbar { display: none; }
  .ie-tb { flex: none; border: 0; background: none; display: flex; flex-direction: column; align-items: center; gap: 1px;
    min-width: 48px; padding: 3px 4px 2px; font-size: 11px; cursor: default; color: var(--ink); }
  .ie-tb svg { width: 20px; height: 20px; image-rendering: pixelated; }
  .ie-tb:hover:not(:disabled) { box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
  .ie-tb:active:not(:disabled), .ie-tb.on { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); }
  .ie-tb:disabled { color: var(--lo); text-shadow: 1px 1px 0 var(--hi); }
  .ie-tb:disabled svg { filter: grayscale(1) opacity(.45); }
  .ie-tb:focus-visible { outline: 1px dotted var(--ink); outline-offset: -3px; }
  .ie-sep { flex: none; width: 2px; align-self: stretch; margin: 2px 3px; box-shadow: inset 1px 0 var(--lo), inset -1px 0 var(--hi); }
  .ie-tm { flex: none; display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 11px; padding: 0 4px; }
  .ie-tm-top { display: flex; align-items: center; gap: 3px; }
  .ie-tm svg { width: 16px; height: 16px; }
  .ie-tm select { font-size: 12px; padding: 1px 2px; }
  .ie-tm.off { opacity: .55; }
  .ie-spacer { flex: 1; min-width: 6px; }
  .ie-throb { flex: none; width: 46px; height: 42px; background: #000; display: grid; place-items: center; margin-left: 2px; }
  .ie-throb canvas { width: 40px; height: 40px; image-rendering: pixelated; }
  .ie-addr label, .ie-links > b { flex: none; padding: 0 4px 0 0; font-weight: normal; color: var(--ink); }
  .ie-combo { flex: 1; min-width: 0; display: flex; position: relative; }
  .ie-combo .field { flex: 1; min-width: 0; padding-left: 22px; font-size: 12px; user-select: text; -webkit-user-select: text; }
  .ie-combo .ie-pg { position: absolute; left: 4px; top: 50%; width: 16px; height: 16px; margin-top: -8px; pointer-events: none; }
  .ie-combo .ie-pg svg { width: 16px; height: 16px; }
  .ie-drop { flex: none; width: 17px; border: 0; padding: 0; background: var(--face); font-size: 8px; margin: 2px 2px 2px -19px; position: relative; z-index: 1;
    box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi2), inset -2px -2px var(--lo), inset 2px 2px var(--hi); }
  .ie-drop:active { box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); }
  .ie-hist { position: absolute; left: 0; right: 0; top: 100%; z-index: 30; background: var(--window); color: var(--window-ink);
    border: 1px solid var(--dk); max-height: 200px; overflow: auto; }
  .ie-hist button { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 2px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; }
  .ie-hist button:hover, .ie-hist button:focus { background: var(--sel); color: var(--sel-ink); outline: none; }
  .ie-go { flex: none; min-width: 0; padding: 2px 10px; min-height: 21px; margin-left: 3px; }
  .ie-links { overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
  .ie-links::-webkit-scrollbar { display: none; }
  .ie-links button { flex: none; border: 0; background: none; padding: 2px 5px; display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--ink); }
  .ie-links button svg { width: 14px; height: 14px; }
  .ie-links button:hover { box-shadow: inset -1px -1px var(--lo), inset 1px 1px var(--hi); }
  .ie-info { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; padding: 4px 8px; margin: 0 2px 2px;
    background: #ffffe1; color: #101014; border: 1px solid #808080; font-size: 11px; }
  .ie-info .ie-ib-txt { flex: 1 1 260px; min-width: 0; }
  .ie-info a, .ie-info button { font-size: 11px; }
  .ie-info a.btn { text-decoration: none; display: inline-flex; align-items: center; min-width: 0; padding: 3px 10px; min-height: 21px; }
  .ie-info .btn { min-width: 0; padding: 3px 10px; min-height: 21px; }
  .ie-info .ie-x { border: 0; background: none; font-weight: bold; padding: 0 4px; color: #101014; }
  .ie-main { flex: 1; min-height: 0; display: flex; margin: 0 2px; position: relative; }
  .ie-favpane { flex: none; width: 190px; background: var(--window); color: var(--window-ink); margin-right: 3px; display: flex; flex-direction: column; min-height: 0; }
  .ie-favpane > header { display: flex; align-items: center; justify-content: space-between; padding: 3px 4px 3px 6px; background: var(--face); color: var(--ink); }
  .ie-favpane > header button { border: 0; background: none; font-weight: bold; padding: 0 4px; color: var(--ink); }
  .ie-favlist { overflow: auto; flex: 1; padding: 4px 2px 8px; }
  .ie-favlist h4 { margin: 8px 4px 3px; font-size: 11px; display: flex; align-items: center; gap: 4px; }
  .ie-favlist h4 svg { width: 16px; height: 16px; }
  .ie-fav { display: flex; align-items: center; }
  .ie-fav > button:first-child { flex: 1; min-width: 0; text-align: left; border: 0; background: none; padding: 2px 4px 2px 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; font-size: 11px; }
  .ie-fav > button:first-child:hover { background: var(--sel); color: var(--sel-ink); }
  .ie-fav .ie-del { flex: none; border: 0; background: none; color: #a00; padding: 0 5px; font-weight: bold; }
  .ie-favlist .ie-empty { padding: 2px 14px; color: #777; font-size: 11px; }
  .ie-view { flex: 1; min-width: 0; position: relative; background: #fff; padding: 2px; display: flex; }
  .ie-view iframe { flex: 1; width: 100%; height: 100%; border: 0; background: #fff; display: block; }
  .ie-status { flex: none; display: flex; gap: 3px; margin: 2px 2px 0; font-size: 11px; }
  .ie-status > span { padding: 2px 6px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); display: flex; align-items: center; gap: 4px; }
  .ie-status .ie-st-text { flex: 1; }
  .ie-status .ie-st-prog { width: 110px; flex: none; padding: 2px; }
  .ie-prog { height: 100%; min-height: 10px; width: 0; background: repeating-linear-gradient(90deg, var(--sel) 0 7px, transparent 7px 9px); }
  .ie-status .ie-st-snap { flex: none; }
  .ie-status .ie-st-zone { flex: none; width: 118px; }
  .ie-status svg { width: 14px; height: 14px; flex: none; }
  .ie-hide { display: none !important; }
  @media (max-width: 600px) {
    .ie-tb { min-width: 30px; padding: 3px; }
    .ie-tb span, .ie-tm > span:last-child, .ie-addr label, .ie-go { display: none; }
    .ie-throb { width: 34px; height: 32px; } .ie-throb canvas { width: 28px; height: 28px; }
    .ie-favpane { position: absolute; left: 0; top: 0; bottom: 0; z-index: 5; box-shadow: 3px 0 0 rgba(0,0,0,.3); }
    .ie-status .ie-st-zone, .ie-status .ie-st-prog { display: none; }
    .ie-row::before { display: none; }
  }
  `);

  /* ---------- URL helpers ---------- */
  const WB = /^(?:https?:\/\/)?web\.archive\.org\/web\/(\d{4})\d*[a-z_]*\/(.+)$/i;
  const looksLikeUrl = s => !/\s/.test(s) && (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^[^/]+\.[a-z]{2,}(?::\d+)?(\/|$)/i.test(s) || /^localhost(:\d+)?(\/|$)/i.test(s));
  function normalize(s, live) {
    s = s.trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = (live ? 'https://' : 'http://') + s;
    try { const u = new URL(s); if (!/^https?:$/.test(u.protocol)) return null; return u.href; } catch { return null; }
  }
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const wayback = (url, year) => `https://web.archive.org/web/${year}0601000000if_/${url}`;
  const engineFor = year => year <= 1998 ? { name: 'AltaVista', url: 'http://www.altavista.com/' } : { name: 'Google', url: 'http://www.google.com/' };

  /* ---------- built-in pages (srcdoc; talk to us with postMessage) ---------- */
  const PAGE_SCRIPT = `<script>
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-u],[data-act]'); if (!a) return; e.preventDefault();
      parent.postMessage({ ie95: 1, act: a.getAttribute('data-act') || 'go', url: a.getAttribute('data-u'), year: +a.getAttribute('data-y') || 0, live: a.hasAttribute('data-live') }, '*');
    });
    document.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, d = { ie95: 1, act: f.getAttribute('data-form') };
      Array.prototype.forEach.call(f.elements, function (el) { if (el.name) d[el.name] = el.value; });
      parent.postMessage(d, '*');
    });
  <\/script>`;
  const PAGE_CSS = `body{margin:0;background:#fffbe8 repeating-linear-gradient(45deg,transparent 0 14px,rgba(0,0,128,.035) 14px 28px);color:#000;font:15px/1.4 "Times New Roman",Times,serif}
    a{color:#00e;cursor:pointer} a:visited{color:#551a8b} .wrap{max-width:760px;margin:0 auto;padding:10px 14px 30px}
    h1{font:bold 30px/1.1 "Comic Sans MS","Comic Sans","Chalkboard SE",cursive;text-align:center;margin:8px 0 2px;color:#c00;text-shadow:2px 2px 0 #ffd400}
    .sub{text-align:center;font-style:italic;margin:0 0 8px}
    .marq{overflow:hidden;white-space:nowrap;background:#000080;color:#ff0;font:bold 13px Arial,sans-serif;padding:3px 0;border:2px ridge #c0c0c0}
    .marq span{display:inline-block;padding-left:100%;animation:mq 22s linear infinite}
    @keyframes mq{to{transform:translateX(-100%)}}
    .uc{display:flex;align-items:center;justify-content:center;gap:10px;margin:10px auto;width:max-content;max-width:100%;padding:5px 12px;font:bold 13px Arial,sans-serif;
      background:repeating-linear-gradient(-45deg,#ffd400 0 12px,#000 12px 24px);background-size:34px 34px;animation:uc 1s linear infinite;border:2px outset #ddd}
    .uc b{background:#ffd400;padding:2px 8px;animation:bl 1s steps(1) infinite}
    .uc i{display:inline-block;width:14px;height:14px;background:#ff7a00;border:2px solid #000;border-radius:2px 2px 7px 7px;animation:dig .5s ease-in-out infinite alternate}
    @keyframes uc{to{background-position:34px 0}} @keyframes bl{50%{color:#c00}} @keyframes dig{to{transform:rotate(-30deg) translateY(-3px)}}
    table.grid{width:100%;border-collapse:separate;border-spacing:8px} td{vertical-align:top}
    .box{border:3px ridge #c0c0c0;background:#fff;padding:6px 10px} .box h3{margin:-6px -10px 6px;padding:3px 8px;background:#008080;color:#fff;font:bold 14px Arial,sans-serif}
    ul{margin:4px 0;padding-left:20px} li{margin:2px 0} .yr{font:11px Arial,sans-serif;color:#777}
    .new{color:#f00;font:bold 10px Arial,sans-serif;animation:bl .8s steps(1) infinite;vertical-align:top}
    .count{display:inline-flex;gap:2px;background:#000;padding:3px;border:2px inset #888;vertical-align:middle}
    .count span{background:#111;color:#3f3;font:bold 18px "Courier New",monospace;padding:0 3px;border:1px solid #333}
    .badges{text-align:center;margin-top:14px} .badge{display:inline-block;width:88px;height:31px;margin:2px;vertical-align:middle;font:bold 9px/1.1 Arial,sans-serif;
      border:1px solid #000;box-sizing:border-box;padding:4px 3px;text-align:center;overflow:hidden}
    form{margin:4px 0} input,textarea{font:13px Arial,sans-serif} .yrs a{display:inline-block;margin:2px 3px;font:bold 12px Arial,sans-serif}
    hr{border:0;height:4px;background:linear-gradient(90deg,red,orange,yellow,lime,cyan,blue,magenta);margin:14px 0}
    .gb{border:2px groove #c0c0c0;background:#fff;padding:6px 10px;margin:8px 0} .gb b{color:#800}
    @media (max-width:560px){table.grid,table.grid tbody,table.grid tr,table.grid td{display:block;width:auto} h1{font-size:24px}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

  function homePage(hits, year) {
    const coolList = COOL.map(c => `<li><a data-u="${esc(c.url)}" data-y="${c.year}">${esc(c.name)}</a> <span class="yr">(${c.year})</span> &mdash; ${esc(c.note)}</li>`).join('');
    const liveList = LIVE_OK.slice(0, 5).map(c => `<li><a data-u="${esc(c.url)}" data-live>${esc(c.name)}</a></li>`).join('');
    const digits = String(hits).padStart(6, '0').split('').map(d => `<span>${d}</span>`).join('');
    const yrs = YEARS.map(y => `<a data-act="year" data-y="${y}">${y === year ? '[' + y + ']' : y}</a>`).join(' ');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Arcade 95 Start Page</title><style>${PAGE_CSS}</style></head><body><div class="wrap">
      <h1>Welcome to the Arcade 95 Start Page!</h1>
      <p class="sub">Your gateway to the World Wide Web &mdash; now with a Time Machine</p>
      <div class="marq"><span>*** NEW! Type any address and Arcade Explorer fetches it from the Internet Archive as it looked in ${year} *** Pick another year in the toolbar *** Tick "Live web" for today's sites *** Sign the guestbook!! ***</span></div>
      <div class="uc"><i></i><b>UNDER CONSTRUCTION</b><i></i></div>
      <table class="grid"><tr><td width="58%">
        <div class="box"><h3>Cool sites of 1998 (and friends)</h3><ul>${coolList}</ul>
        <p class="yr">Pages come from the Internet Archive's Wayback Machine. It can take 10&ndash;40 seconds &mdash; patience, it's 1998!</p></div>
      </td><td>
        <div class="box"><h3>Search the Web</h3>
          <form data-form="search"><input name="q" size="18" placeholder="type words here"> <input type="submit" value="Search!"></form>
          <p class="yr">Time Machine mode opens a ${year <= 1998 ? 'AltaVista' : 'Google'} from ${year}; live mode searches Wikipedia here and offers a real web search in a new window.</p></div>
        <div class="box"><h3>Time Machine</h3><p class="yrs">${yrs}</p></div>
        <div class="box"><h3>Works inside Arcade <span class="new">LIVE</span></h3><ul>${liveList}</ul></div>
        <div class="box"><h3>Guestbook</h3><p><a data-act="guestbook">Sign my guestbook!</a> <span class="new">NEW!</span></p></div>
      </td></tr></table>
      <hr>
      <p style="text-align:center">You are visitor number <span class="count">${digits}</span> <br><span class="yr">(counted on this computer only)</span></p>
      <div class="badges">
        <span class="badge" style="background:#000080;color:#ff0">BEST VIEWED WITH<br>ARCADE EXPLORER</span>
        <span class="badge" style="background:#c0c0c0;color:#000">800 x 600<br>256 COLORS</span>
        <span class="badge" style="background:#008000;color:#fff">100% HAND<br>CODED HTML</span>
        <span class="badge" style="background:#800000;color:#fff">GET THE<br>TIME MACHINE</span>
      </div>
    </div>${PAGE_SCRIPT}</body></html>`;
  }
  function guestbookPage(entries) {
    const list = entries.length ? entries.slice().reverse().map(e => `<div class="gb"><b>${esc(e.name)}</b> <span class="yr">${esc(e.date)}</span><br>${esc(e.msg).replace(/\n/g, '<br>')}</div>`).join('')
      : '<p><i>Nobody has signed yet. Be the first!!</i></p>';
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Guestbook</title><style>${PAGE_CSS}</style></head><body><div class="wrap">
      <h1>~*~ My Guestbook ~*~</h1><p class="sub">Please sign it before you leave! (Entries stay on this computer.)</p>
      <div class="box"><h3>Sign the Guestbook</h3><form data-form="sign">
        <p>Name: <input name="name" maxlength="40" required></p>
        <p>Message:<br><textarea name="msg" rows="3" cols="40" maxlength="400" required style="max-width:100%"></textarea></p>
        <p><input type="submit" value="Sign it!"> <a data-act="home">Back to the Start Page</a></p></form></div>
      <hr>${list}
    </div>${PAGE_SCRIPT}</body></html>`;
  }

  /* ---------- app ---------- */
  Arcade.app({
    id: 'explorer',
    title: 'Arcade Explorer',
    label: 'The Internet',
    icon: ICON,
    width: 760,
    height: 'min(600px, calc(100% - 16px))',
    max: true,
    folder: 'Accessories',
    desktop: true,
    hint: 'Surf the 1990s web: a Time Machine browser that loads any address as the Internet Archive saw it, 1996–2005.',
    preview,
    menus: [],
    build
  });

  function build(ctx) {
    const el = Arcade.el;
    const tbBtn = (id, label, icon) => `<button class="ie-tb" data-cmd="${id}" title="${label}">${icon}<span>${label}</span></button>`;
    const root = el(`<div class="ie-root">
      <div class="ie-bars">
        <div class="ie-row ie-tools">
          ${tbBtn('back', 'Back', ICONS.back)}${tbBtn('fwd', 'Forward', ICONS.fwd)}${tbBtn('stop', 'Stop', ICONS.stop)}${tbBtn('refresh', 'Refresh', ICONS.refresh)}${tbBtn('home', 'Home', ICONS.home)}
          <i class="ie-sep"></i>${tbBtn('search', 'Search', ICONS.search)}${tbBtn('favs', 'Favorites', ICONS.favs)}<i class="ie-sep"></i>
          <label class="ie-tm" title="Time Machine: which year of the web to visit"><span class="ie-tm-top">${ICONS.clock}<select class="field ie-year">${YEARS.map(y => `<option>${y}</option>`).join('')}</select></span><span>Time Machine</span></label>
          ${tbBtn('live', 'Live web', ICONS.live)}
          <i class="ie-spacer"></i>
          <div class="ie-throb" title="Arcade Explorer"><canvas width="20" height="20"></canvas></div>
        </div>
        <div class="ie-row ie-addr">
          <label for="ie-url">Address</label>
          <div class="ie-combo"><i class="ie-pg">${ICONS.page}</i><input id="ie-url" class="field ie-url" spellcheck="false" autocomplete="off" autocapitalize="off" enterkeyhint="go" aria-label="Address"><button class="ie-drop" aria-label="Typed addresses" tabindex="-1">▼</button></div>
          <button class="btn ie-go">Go</button>
        </div>
        <div class="ie-row ie-links"><b>Links</b>${LINKS.map((l, i) => `<button data-link="${i}" title="${esc(l.url)}${l.live ? ' (live)' : ' in ' + l.year}">${l.live ? ICONS.live : ICONS.page}${esc(l.name)}</button>`).join('')}</div>
      </div>
      <div class="ie-info" hidden></div>
      <div class="ie-main">
        <div class="ie-favpane bevel-in" hidden><header><b>Favorites</b><button aria-label="Close Favorites">×</button></header><div class="ie-favlist"></div></div>
        <div class="ie-view bevel-in"></div>
      </div>
      <div class="ie-status"><span class="ie-st-text"></span><span class="ie-st-prog"><i class="ie-prog"></i></span><span class="ie-st-snap"></span><span class="ie-st-zone">${ICONS.live}Internet zone</span></div>
    </div>`);
    ctx.body.appendChild(root);
    const $ = s => root.querySelector(s);
    const urlIn = $('.ie-url'), yearSel = $('.ie-year'), info = $('.ie-info'), view = $('.ie-view'), favPane = $('.ie-favpane'), favList = $('.ie-favlist');
    const stText = $('.ie-st-text'), prog = $('.ie-prog'), stSnap = $('.ie-st-snap');
    const throbCv = $('.ie-throb canvas'), tg = throbCv.getContext('2d');
    const btn = cmd => root.querySelector(`[data-cmd="${cmd}"]`);

    let frame = null, cur = null, drifted = false, loading = false, loadT0 = 0, slowTimer = 0, progress = 0, progHide = 0;
    let stack = [], idx = -1, snapReq = 0, phase = 2.2, raf = 0, lastT = 0;

    /* ----- throbber + progress animation ----- */
    function drawThrob() { tg.fillStyle = '#000'; tg.fillRect(0, 0, 20, 20); drawGlobe(tg, 1, 1, 18, phase); if (loading) { const a = phase * 1.7; tg.fillStyle = '#ffd400'; tg.fillRect(10 + Math.round(Math.cos(a) * 9) - 1, 10 + Math.round(Math.sin(a) * 4) - 1, 2, 2); } }
    function anim(now) {
      raf = 0; if (!loading) { drawThrob(); return; }
      const dt = Math.min(.1, (now - (lastT || now)) / 1000); lastT = now;
      if (ctx.isVisible()) { phase += dt * 3; drawThrob(); progress += (92 - progress) * dt * .12; prog.style.width = progress + '%'; }
      raf = requestAnimationFrame(anim);
    }
    const kick = () => { if (!raf) { lastT = 0; raf = requestAnimationFrame(anim); } };
    drawThrob();

    /* ----- status ----- */
    const status = t => { stText.textContent = t; };
    function setSnap(t) { stSnap.textContent = t; }
    function updateSnap() {
      const r = ++snapReq;
      if (!cur || cur.kind !== 'url') { setSnap(cur && cur.kind ? 'Local page' : ''); return; }
      if (cur.live) { setSnap('Live web'); return; }
      setSnap('Archive · ' + cur.year);
      // Ask the Wayback availability API (CORS-enabled) for the exact snapshot date; purely informational.
      if (typeof fetch !== 'function') return;
      fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(cur.url)}&timestamp=${cur.year}0601`)
        .then(res => res.json()).then(j => {
          if (r !== snapReq) return;
          const s = j && j.archived_snapshots && j.archived_snapshots.closest;
          if (!s || !s.timestamp) return;
          const ts = s.timestamp, d = new Date(Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8)));
          setSnap('Snapshot · ' + d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
        }).catch(() => {});
    }

    /* ----- info bar ----- */
    function showInfo(html, wire) { info.innerHTML = `<span class="ie-ib-txt">${html}</span><button class="ie-x" aria-label="Close" data-ib="close">×</button>`; info.hidden = false; if (wire) wire(info); }
    function hideInfo() { info.hidden = true; info.innerHTML = ''; }
    info.addEventListener('click', e => {
      const b = e.target.closest('[data-ib]'); if (!b) return;
      const a = b.dataset.ib;
      if (a === 'close') hideInfo();
      else if (a === 'archive') { setLive(false); go(cur.url, { live: false }); }
      else if (a === 'stop') stop();
      else if (a === 'wait') hideInfo();
      else if (a === 'wiki') go('https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(b.dataset.q), { live: true });
    });
    const openLink = (href, label) => `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;

    /* ----- address bar ----- */
    function displayFor(e) { return e.kind === 'home' ? 'about:home' : e.kind === 'guestbook' ? 'about:guestbook' : e.url; }
    function setAddress() { urlIn.value = !cur ? '' : drifted ? `${displayFor(cur)}  →  (${cur.live ? 'page inside the site' : 'archived page'})` : displayFor(cur); }
    const typed = () => store.get('typed', []);
    function remember(u) { store.set('typed', [u, ...typed().filter(x => x !== u)].slice(0, 15)); }
    let histEl = null;
    function closeHist() { if (histEl) { histEl.remove(); histEl = null; } }
    $('.ie-drop').addEventListener('click', e => {
      e.stopPropagation(); if (histEl) { closeHist(); return; }
      const list = typed();
      histEl = el(`<div class="ie-hist">${list.length ? list.map(u => `<button>${esc(u)}</button>`).join('') : '<button disabled>(no typed addresses yet)</button>'}</div>`);
      histEl.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b || b.disabled) return; closeHist(); urlIn.value = b.textContent; submit(); });
      $('.ie-combo').appendChild(histEl);
    });
    document.addEventListener('pointerdown', e => { if (histEl && !e.target.closest('.ie-combo')) closeHist(); });
    urlIn.addEventListener('focus', () => urlIn.select());
    urlIn.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); closeHist(); submit(); }
      else if (e.key === 'Escape') { closeHist(); setAddress(); urlIn.blur(); }
      else if (e.key === 'ArrowDown' && e.altKey) $('.ie-drop').click();
    });
    $('.ie-go').addEventListener('click', submit);
    function submit() {
      let s = urlIn.value.trim();
      if (drifted && cur && s.startsWith(displayFor(cur) + '  →')) s = displayFor(cur);
      if (!s) return;
      if (/^about:(home|blank)$|^home$/i.test(s)) { home(); return; }
      if (/^about:guestbook$/i.test(s)) { navigate({ kind: 'guestbook' }); return; }
      const m = s.match(WB);
      if (m) { const y = +m[1]; if (YEARS.includes(y)) setYear(y); setLive(false); s = m[2]; }
      if (!looksLikeUrl(s)) { search(s); return; }
      const u = normalize(s, cfg.live);
      if (!u) { Arcade.dialog({ title: 'Arcade Explorer', icon: 'error', text: `Arcade Explorer cannot open "${s}". Only http:// and https:// addresses work.` }); return; }
      remember(u); go(u);
    }

    /* ----- navigation ----- */
    function makeFrame(setup, local) {
      const f = document.createElement('iframe');
      // No allow-top-navigation: 1990s "break out of frames" scripts can't take over the arcade.
      // Built-in pages run unique-origin (they only postMessage us); web pages keep their own origin so their scripts work.
      f.setAttribute('sandbox', local ? 'allow-scripts allow-forms' : 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
      f.setAttribute('referrerpolicy', 'no-referrer');
      f.setAttribute('title', 'Web page');
      setup(f);
      f.addEventListener('load', () => onLoad(f));
      // A fresh iframe per navigation keeps the iframe out of the real browser's Back history.
      if (frame) frame.replaceWith(f); else view.appendChild(f);
      frame = f;
    }
    function startLoad(label) {
      loading = true; loadT0 = performance.now(); progress = 4; clearTimeout(progHide); prog.style.width = '4%';
      status('Opening page ' + label + '…'); kick();
      clearTimeout(slowTimer);
      slowTimer = setTimeout(() => {
        if (!loading) return;
        const wb = cur && cur.kind === 'url' && !cur.live;
        showInfo(`The page is taking a long time to respond${wb ? ' — the Internet Archive can be slow' : ''}.`,
          () => info.querySelector('.ie-x').insertAdjacentHTML('beforebegin', `<button class="btn" data-ib="wait">Keep waiting</button><button class="btn" data-ib="stop">Stop</button>${openLink(targetOf(cur), 'Open in a new window')}`));
        status('Still waiting for ' + label + '…');
      }, 30000);
    }
    function endLoad(text) {
      loading = false; clearTimeout(slowTimer); progress = 100; prog.style.width = '100%';
      progHide = setTimeout(() => { if (!loading) prog.style.width = '0'; }, 700);
      status(text); kick();
    }
    const targetOf = e => e.kind !== 'url' ? location.href : e.live ? e.url : wayback(e.url, e.year);
    function titleFor(e) {
      if (e.kind === 'home') return 'Arcade 95 Start Page';
      if (e.kind === 'guestbook') return 'Guestbook';
      return hostOf(e.url) + (e.live ? '' : ' (' + e.year + ')');
    }
    function navigate(entry, push = true) {
      if (push) { stack = stack.slice(0, idx + 1); stack.push(entry); idx = stack.length - 1; }
      cur = entry; drifted = false; hideInfo(); closeHist(); setAddress(); updateNav();
      ctx.setTitle(titleFor(entry) + ' - Arcade Explorer');
      updateSnap();
      if (entry.kind === 'home') {
        const hits = store.get('hits', 0) + 1; store.set('hits', hits);
        makeFrame(f => { f.srcdoc = homePage(hits, cfg.year); }, true);
        startLoad('about:home');
      } else if (entry.kind === 'guestbook') {
        makeFrame(f => { f.srcdoc = guestbookPage(store.get('guestbook', [])); }, true);
        startLoad('about:guestbook');
      } else {
        makeFrame(f => { f.src = targetOf(entry); });
        startLoad(entry.live ? entry.url : `${entry.url} from ${entry.year}`);
      }
    }
    function onLoad(f) {
      if (f !== frame) return;
      if (loading) {
        const secs = ((performance.now() - loadT0) / 1000).toFixed(1);
        if (cur.kind !== 'url') { endLoad('Done'); return; }
        if (cur.live) {
          endLoad(`Done (${secs} s)`);
          if (!LIVE_OK_HOSTS.has(new URL(cur.url).hostname)) {
            showInfo(`If this page is blank, the site doesn't allow being shown inside other pages.`,
              () => info.querySelector('.ie-x').insertAdjacentHTML('beforebegin', `${openLink(cur.url, 'Open in a new window')}<button class="btn" data-ib="archive">Try the ${cfg.year} version</button>`));
          }
        } else endLoad(`Done — archived ${cur.year} copy (${secs} s)`);
        return;
      }
      // A load we didn't start: the visitor followed a link (or the page redirected) inside the frame.
      // Its address is cross-origin and unreadable, so say so instead of guessing.
      if (frame.getAttribute('src') === 'about:blank') return;
      drifted = true; setAddress(); updateNav();
      status(cur && !cur.live ? 'Done — followed a link inside the archive (still in the Wayback Machine); its address isn\'t visible to Arcade' : 'Done — the page changed itself; its address isn\'t visible to Arcade');
      ctx.setTitle((cur && !cur.live ? '(archived page)' : '(web page)') + ' - Arcade Explorer');
    }
    function go(url, opt = {}) {
      const live = opt.live != null ? opt.live : cfg.live;
      if (live !== cfg.live) setLive(live);
      navigate({ kind: 'url', url, live, year: opt.year || cfg.year });
    }
    function home() { navigate({ kind: 'home' }); }
    function back() {
      if (drifted) { navigate(cur, false); return; }
      if (idx > 0) { idx--; syncControls(stack[idx]); navigate(stack[idx], false); }
    }
    function fwd() { if (idx < stack.length - 1) { idx++; syncControls(stack[idx]); navigate(stack[idx], false); } }
    function refresh() { if (cur) navigate(cur, false); }
    function stop() {
      if (!loading) { status('Stopped'); return; }
      makeFrame(f => { f.src = 'about:blank'; });
      endLoad('Stopped. Press Refresh to try again.'); hideInfo();
    }
    function syncControls(e) { if (e.kind === 'url') { if (!e.live && YEARS.includes(e.year)) setYear(e.year); setLive(e.live); } }
    function updateNav() {
      btn('back').disabled = !(idx > 0 || drifted);
      btn('fwd').disabled = idx >= stack.length - 1;
    }
    function setYear(y) { cfg.year = y; yearSel.value = String(y); saveCfg(); }
    function setLive(v) { cfg.live = v; saveCfg(); btn('live').classList.toggle('on', v); btn('live').setAttribute('aria-pressed', String(v)); $('.ie-tm').classList.toggle('off', v); }

    function search(q) {
      if (cfg.live) {
        go('https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q), { live: true });
        showInfo(`Showing Wikipedia results for <b>${esc(q)}</b>. Most search engines refuse to appear inside other pages.`,
          () => info.querySelector('.ie-x').insertAdjacentHTML('beforebegin', openLink('https://duckduckgo.com/?q=' + encodeURIComponent(q), 'Search the whole web in a new window')));
        return;
      }
      const eng = engineFor(cfg.year);
      go(eng.url, { live: false });
      showInfo(`${eng.name} from ${cfg.year} can't search today's web, so here is its front page${q ? ` — try typing <b>${esc(q)}</b> into it` : ''}.`,
        () => info.querySelector('.ie-x').insertAdjacentHTML('beforebegin', `${q ? `<button class="btn" data-ib="wiki" data-q="${esc(q)}">Search Wikipedia (live)</button>` + openLink('https://duckduckgo.com/?q=' + encodeURIComponent(q), 'Search the web in a new window') : ''}`));
    }
    function searchCmd() {
      if (!cfg.live) { search(''); return; }
      askText('Search the Web', 'Search for:', '').then(q => { if (q) search(q); });
    }

    // Arcade.dialog caps typed input at 24 characters; addresses are longer, so lift the cap on our own dialogs.
    function askText(title, text, value) {
      const p = Arcade.dialog({ title, text, input: value, buttons: ['OK', 'Cancel'] });
      const veils = document.querySelectorAll('.modal-veil'), inp = veils.length && veils[veils.length - 1].querySelector('input');
      if (inp) { inp.removeAttribute('maxlength'); inp.value = value; }
      return p;
    }

    /* ----- favorites ----- */
    const favs = () => store.get('favs', []);
    function addFav() {
      if (!cur) return;
      const def = titleFor(cur);
      askText('Add to Favorites', `Arcade Explorer will add "${displayFor(cur)}"${cur.kind === 'url' && !cur.live ? ' (' + cur.year + ')' : ''} to your Favorites.${drifted ? ' (Arcade can only save the last address it knows, not links you followed inside the page.)' : ''}\nName:`, def).then(name => {
        if (name == null) return;
        const f = { name: name || def, kind: cur.kind, url: cur.url || null, year: cur.year || null, live: !!cur.live };
        store.set('favs', [...favs(), f]); renderFavs(); ctx.setMenus(makeMenus()); status(`Added "${f.name}" to Favorites`);
      });
    }
    function openFav(f) {
      if (f.kind === 'home') home(); else if (f.kind === 'guestbook') navigate({ kind: 'guestbook' });
      else { if (!f.live && f.year && YEARS.includes(f.year)) setYear(f.year); go(f.url, { live: f.live, year: f.year }); }
    }
    function renderFavs() {
      const mine = favs();
      favList.innerHTML = `<h4>${ICONS.folder}My Favorites</h4>${mine.length ? mine.map((f, i) => `<div class="ie-fav"><button data-mine="${i}" title="${esc(f.url || f.kind)}">${esc(f.name)}</button><button class="ie-del" data-del="${i}" aria-label="Delete ${esc(f.name)}" title="Delete">×</button></div>`).join('') : '<div class="ie-empty">(empty — use Favorites ▸ Add)</div>'}
        <h4>${ICONS.folder}Works inside Arcade</h4>${LIVE_OK.map((f, i) => `<div class="ie-fav"><button data-live="${i}" title="${esc(f.url)}">${esc(f.name)}</button></div>`).join('')}
        <h4>${ICONS.folder}Cool sites of the 90s</h4>${COOL.map((f, i) => `<div class="ie-fav"><button data-cool="${i}" title="${esc(f.url)} in ${f.year}">${esc(f.name)} (${f.year})</button></div>`).join('')}`;
    }
    favList.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.del != null) {
        const list = favs(), f = list[+b.dataset.del];
        Arcade.dialog({ title: 'Delete Favorite', icon: 'warn', text: `Delete "${f.name}" from your Favorites?`, buttons: ['Yes', 'No'] }).then(r => {
          if (r !== 'Yes') return; list.splice(+b.dataset.del, 1); store.set('favs', list); renderFavs(); ctx.setMenus(makeMenus());
        });
      } else if (b.dataset.mine != null) openFav(favs()[+b.dataset.mine]);
      else if (b.dataset.live != null) go(LIVE_OK[+b.dataset.live].url, { live: true });
      else if (b.dataset.cool != null) { const c = COOL[+b.dataset.cool]; setYear(c.year); go(c.url, { live: false, year: c.year }); }
      if (innerWidth <= 600 && b.dataset.del == null) toggleFavPane(false);
    });
    function toggleFavPane(v = favPane.hidden) { favPane.hidden = !v; cfg.favpane = v; saveCfg(); btn('favs').classList.toggle('on', v); if (v) renderFavs(); }
    favPane.querySelector('header button').addEventListener('click', () => toggleFavPane(false));

    /* ----- messages from the built-in pages ----- */
    addEventListener('message', e => {
      if (!frame || e.source !== frame.contentWindow || drifted || !cur || cur.kind === 'url') return;
      const d = e.data; if (!d || d.ie95 !== 1) return;
      if (d.act === 'go' && typeof d.url === 'string') {
        if (d.live) go(d.url, { live: true });
        else { if (YEARS.includes(d.year)) setYear(d.year); go(d.url, { live: false, year: d.year || cfg.year }); }
      } else if (d.act === 'year' && YEARS.includes(d.year)) { setYear(d.year); setLive(false); navigate(cur, false); }
      else if (d.act === 'guestbook') navigate({ kind: 'guestbook' });
      else if (d.act === 'home') home();
      else if (d.act === 'search') search(String(d.q || '').trim());
      else if (d.act === 'sign') {
        const name = String(d.name || '').trim().slice(0, 40), msg = String(d.msg || '').trim().slice(0, 400);
        if (!name || !msg) return;
        store.set('guestbook', [...store.get('guestbook', []), { name, msg, date: new Date().toLocaleDateString() }].slice(-100));
        Arcade.beep(880, .08, 'square', .03); Arcade.beep(1320, .1, 'square', .03, 0, .08);
        navigate({ kind: 'guestbook' }, false);
      }
    });

    /* ----- toolbar, links, year ----- */
    root.querySelector('.ie-tools').addEventListener('click', e => {
      const b = e.target.closest('[data-cmd]'); if (!b || b.disabled) return;
      ({ back, fwd, stop, refresh, home, search: searchCmd, favs: () => toggleFavPane(),
        live: () => { setLive(!cfg.live); if (cur && cur.kind === 'url') go(cur.url, { live: cfg.live }); else status(cfg.live ? 'Live web: addresses load directly from today\'s Internet' : `Time Machine: addresses load from ${cfg.year}`); } })[b.dataset.cmd]();
    });
    root.querySelector('.ie-links').addEventListener('click', e => {
      const b = e.target.closest('[data-link]'); if (!b) return;
      const l = LINKS[+b.dataset.link];
      if (l.live) go(l.url, { live: true }); else { setYear(l.year); go(l.url, { live: false, year: l.year }); }
    });
    yearSel.addEventListener('change', () => {
      setYear(+yearSel.value);
      if (cur && cur.kind === 'url') { setLive(false); go(cur.url, { live: false, year: cfg.year }); }
      else if (cur && cur.kind === 'home') navigate(cur, false);
      else status(`Time Machine set to ${cfg.year}`);
    });

    /* ----- view toggles ----- */
    function applyView() {
      $('.ie-tools').classList.toggle('ie-hide', !cfg.toolbar);
      $('.ie-addr').classList.toggle('ie-hide', !cfg.address);
      $('.ie-links').classList.toggle('ie-hide', !cfg.links);
      $('.ie-status').classList.toggle('ie-hide', !cfg.statusbar);
      ctx.setMenus(makeMenus());
    }
    const toggle = k => () => { cfg[k] = !cfg[k]; saveCfg(); applyView(); };

    function timeMachineDialog() {
      askText('Time Machine', `Visit the web as it was in which year? (${YEARS[0]}–${YEARS[YEARS.length - 1]})`, String(cfg.year)).then(v => {
        if (v == null) return;
        const y = parseInt(v, 10);
        if (!YEARS.includes(y)) { Arcade.dialog({ title: 'Time Machine', icon: 'warn', text: `The Time Machine only goes to ${YEARS[0]}–${YEARS[YEARS.length - 1]}.` }); return; }
        setYear(y); setLive(false);
        if (cur && cur.kind === 'url') go(cur.url, { live: false, year: y }); else if (cur) navigate(cur, false);
      });
    }
    function openDialog() {
      askText('Open', 'Type the Internet address of a document, and Arcade Explorer will open it for you.', cur && cur.kind === 'url' ? cur.url : '').then(v => { if (v) { urlIn.value = v; submit(); } });
    }
    function copyUrl() {
      if (!cur) return;
      const t = cur.kind === 'url' ? (cur.live ? cur.url : wayback(cur.url, cur.year)) : displayFor(cur);
      const ok = () => status('Copied ' + t), fail = () => { urlIn.value = t; urlIn.focus(); urlIn.select(); status('Press Ctrl+C to copy the address'); };
      try { navigator.clipboard.writeText(t).then(ok, fail); } catch { fail(); }
    }
    function newWindow() {
      const a = document.createElement('a'); a.href = cur ? targetOf(cur) : location.href; a.target = '_blank'; a.rel = 'noopener'; a.click();
    }
    function makeMenus() {
      const mine = favs();
      return [
        { label: 'File', items: [
          { label: 'New Window', key: 'Ctrl+N', action: newWindow },
          { label: 'Open…', key: 'Ctrl+O', action: openDialog },
          '-',
          { label: 'Close', action: () => ctx.close() }
        ]},
        { label: 'Edit', items: [{ label: 'Copy URL', action: copyUrl }] },
        { label: 'View', items: [
          { label: 'Toolbar', checked: () => cfg.toolbar, action: toggle('toolbar') },
          { label: 'Address Bar', checked: () => cfg.address, action: toggle('address') },
          { label: 'Links', checked: () => cfg.links, action: toggle('links') },
          { label: 'Status Bar', checked: () => cfg.statusbar, action: toggle('statusbar') },
          { label: 'Favorites Bar', checked: () => !favPane.hidden, action: () => toggleFavPane() },
          '-',
          { label: 'Live web (modern sites)', checked: () => cfg.live, action: () => btn('live').click() },
          '-',
          { label: 'Stop', key: 'Esc', action: stop },
          { label: 'Refresh', key: 'F5', action: refresh }
        ]},
        { label: 'Go', items: [
          { label: 'Back', key: 'Alt+←', disabled: () => !(idx > 0 || drifted), action: back },
          { label: 'Forward', key: 'Alt+→', disabled: () => idx >= stack.length - 1, action: fwd },
          '-',
          { label: 'Home Page', action: home },
          { label: 'Search the Web', action: searchCmd },
          { label: 'Guestbook', action: () => navigate({ kind: 'guestbook' }) },
          '-',
          { label: 'Time Machine…', action: timeMachineDialog }
        ]},
        { label: 'Favorites', items: [
          { label: 'Add to Favorites…', key: 'Ctrl+D', action: addFav },
          { label: 'Organize Favorites…', action: () => toggleFavPane(true) },
          '-',
          ...(mine.length ? mine.map(f => ({ label: f.name, action: () => openFav(f) })) : [{ label: '(No favorites yet)', disabled: () => true }]),
          '-',
          ...LIVE_OK.slice(0, 4).map(f => ({ label: f.name + ' (live)', action: () => go(f.url, { live: true }) }))
        ]},
        { label: 'Help', items: [{ label: 'About Arcade Explorer', action: () => Arcade.dialog({ title: 'About Arcade Explorer', icon: 'info',
          text: 'Arcade Explorer 4.0 for Arcade 95.\n\nTime Machine pages come from the Internet Archive\'s Wayback Machine (web.archive.org); every snapshot is theirs. Pick a year from 1996 to 2005 and type any address.\n\nLive web mode loads today\'s sites directly, but most big sites refuse to be shown inside another page.' }) }] }
      ];
    }

    ctx.onKey(e => {
      const k = e.key;
      if (e.altKey && k === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.altKey && k === 'ArrowRight') { e.preventDefault(); fwd(); }
      else if (k === 'F5') { e.preventDefault(); refresh(); }
      else if (k === 'Escape') stop();
      else if ((e.ctrlKey || e.metaKey) && (k === 'l' || k === 'L')) { e.preventDefault(); urlIn.focus(); }
      else if (e.altKey && (k === 'd' || k === 'D')) { e.preventDefault(); urlIn.focus(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'd' || k === 'D')) { e.preventDefault(); addFav(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'o' || k === 'O')) { e.preventDefault(); openDialog(); }
    });
    ctx.on('close', () => { if (loading) stop(); closeHist(); });
    ctx.on('open', () => { if (!cur) home(); });

    setYear(cfg.year); setLive(cfg.live); applyView();
    if (cfg.favpane) toggleFavPane(true);
    home();
    // Exposed for headless tests only (not a global): Arcade.apps.explorer.ctx.ie
    ctx.ie = { go, back, fwd, home, stop, refresh, addFav, search, setYear, setLive, state: () => ({ cur, idx, depth: stack.length, drifted, loading, year: cfg.year, live: cfg.live, address: urlIn.value, status: stText.textContent, snap: stSnap.textContent }) };
  }
})();

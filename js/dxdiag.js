/* DirectX Diagnostic Tool: a late-90s DxDiag look-alike that reports the visitor's REAL machine as the browser sees it
   (GPU via WebGL, audio via Web Audio, gamepads, MIDI, BroadcastChannel) in DxDiag wording, with runnable tests. */
(() => {
  const esc = Arcade.esc;
  const UA = navigator.userAgent;
  const TITLE = 'DirectX Diagnostic Tool';
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const compName = 'ARCADE-' + hash(UA).toString(16).toUpperCase().padStart(8, '0').slice(-4);
  const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  let ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' + R(2, 1, 12, 14, '#101068') + R(1, 2, 14, 12, '#101068') + R(2, 2, 12, 1, '#4a4ad0') + R(2, 2, 1, 11, '#4a4ad0') + R(3, 14, 11, 1, '#05052e') + R(14, 3, 1, 11, '#05052e');
  for (let i = 0; i < 10; i++) ICON += R(3 + i, 3 + i, 2, 1, '#ff3b2f');
  for (let i = 0; i < 10; i++) ICON += R(11 - i, 3 + i, 2, 1, '#ffd23a');
  ICON += R(7, 7, 2, 2, '#ffffff') + '</svg>';

  Arcade.css(`
.dx-root { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 6px 6px 4px; gap: 6px; }
.dx-tabs { display: flex; flex-wrap: wrap; padding: 0 2px; position: relative; z-index: 1; margin-bottom: -8px; }
.dx-tab { border: 0; background: var(--face); color: var(--ink); padding: 3px 8px 3px; margin: 2px 0 0; border-radius: 3px 3px 0 0; white-space: nowrap;
  box-shadow: inset 1px 1px var(--hi), inset -1px 0 var(--dk), inset -2px 0 var(--lo); }
.dx-tab.on { margin: 0 -2px; padding: 4px 10px 5px; position: relative; z-index: 2; box-shadow: inset 1px 1px var(--hi), inset 2px 2px var(--hi2), inset -1px 0 var(--dk), inset -2px 0 var(--lo); }
.dx-tab:focus-visible { outline: 1px dotted var(--ink); outline-offset: -4px; }
.dx-sheet { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 8px; overflow: auto;
  box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi), inset -2px -2px var(--lo), inset 2px 2px var(--hi2); }
.dx-pane { display: flex; flex-direction: column; flex: 1 0 auto; gap: 4px; }
.dx-pc { display: flex; flex-direction: column; gap: 4px; }
.dx-pane .groupbox { margin-top: 4px; min-width: 0; }
.dx-pane p { margin: 2px 0 4px; }
.dx-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 8px; }
.dx-kv > span:nth-child(odd) { text-align: right; white-space: nowrap; }
.dx-kv > span:nth-child(even) { overflow-wrap: anywhere; }
.dx-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 0 8px; }
.dx-lv { background: var(--window); color: var(--window-ink); overflow: auto; padding: 2px; min-height: 70px; max-height: 210px; user-select: text; -webkit-user-select: text; }
.dx-lv table { border-collapse: collapse; width: 100%; white-space: nowrap; }
.dx-lv th { position: sticky; top: 0; background: var(--face); color: var(--ink); font-weight: normal; text-align: left; padding: 2px 6px;
  box-shadow: inset -1px -1px var(--dk), inset 1px 1px var(--hi), inset -2px -2px var(--lo); }
.dx-lv td { padding: 1px 6px; }
.dx-ok { color: #007a00; } .dx-bad { color: #b00000; }
.dx-notes { margin-top: auto !important; }
.dx-nb { background: var(--window); color: var(--window-ink); min-height: 44px; max-height: 96px; overflow: auto; padding: 3px 6px; user-select: text; -webkit-user-select: text; }
.dx-nb div::before { content: "\\2022  "; }
.dx-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dx-row.end { justify-content: flex-end; }
.dx-feat { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 4px 8px; align-items: center; }
.dx-feat .btn { min-width: 64px; padding: 2px 8px; min-height: 21px; }
.dx-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; flex: none; }
.dx-prog { flex: 1 1 160px; min-width: 0; display: flex; align-items: center; gap: 6px; }
.dx-prog > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.dx-pbar { flex: 1; min-width: 60px; height: 16px; padding: 2px 3px; display: flex; gap: 2px; overflow: hidden; background: var(--face); }
.dx-pbar i { width: 7px; flex: none; background: var(--sel); }
.dx-pop { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 8px; background: rgba(0, 0, 0, .12); }
.dx-pop > .win.dx-pw { position: relative; left: auto; top: auto; max-height: 100%; }
.dx-pwb { padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: auto; }
.dx-pwb p { margin: 0; }
.dx-cv { display: block; width: 100%; aspect-ratio: 8 / 5; background: #000; image-rendering: auto; }
.dx-fs { position: fixed; inset: 0; z-index: 99990; background: #000; touch-action: none; cursor: none; }
.dx-fs canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.dx-fs b { position: absolute; left: 10px; bottom: 10px; color: #8f8; font: 11px var(--pixel); font-weight: normal; text-shadow: 1px 1px #000; }
.dx-meter { display: flex; gap: 6px; align-items: center; }
.dx-meter > span { width: 14px; text-align: center; }
.dx-meter > div { flex: 1; height: 14px; background: #000; padding: 2px; }
.dx-meter i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #2c2, #ee2 70%, #e22); transition: width .08s; }
.dx-live { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0 8px; }
.dx-keys { min-height: 44px; display: flex; flex-wrap: wrap; gap: 3px; align-content: flex-start; background: var(--window); color: var(--window-ink); padding: 4px; }
.dx-led { display: inline-block; width: 10px; height: 10px; margin: 0 2px; border-radius: 50%; background: #3a0606; box-shadow: inset 1px 1px rgba(0, 0, 0, .6), 0 0 0 1px var(--lo); vertical-align: -1px; }
.dx-led.on { background: #ff3030; box-shadow: 0 0 4px #ff5050, 0 0 0 1px var(--dk); }
.dx-axis { height: 12px; background: var(--window); position: relative; margin: 2px 0; }
.dx-axis i { position: absolute; top: 2px; bottom: 2px; left: 50%; width: 0; background: var(--sel); }
.dx-axis::after { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--lo); }
.dx-pad { margin-bottom: 6px; }
.dx-pad b { display: block; font-weight: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dx-wake { color: var(--lo); }
.dx-roll { display: block; width: 100%; height: 96px; background: #000; }
.dx-chat { background: var(--window); color: var(--window-ink); height: 110px; overflow: auto; padding: 3px 5px; user-select: text; -webkit-user-select: text; overflow-wrap: anywhere; }
.dx-chat .sys { color: #707070; }
.dx-in { display: flex; gap: 6px; } .dx-in .field { flex: 1; min-width: 0; }
.dx-txt { width: 100%; height: 300px; max-height: 55vh; resize: none; font: 12px/1.3 "Courier New", monospace; white-space: pre; overflow: auto; user-select: text; -webkit-user-select: text; }
.dx-np { display: flex; gap: 12px; padding: 0 2px; } .dx-np span { text-decoration: underline 1px; text-underline-offset: 2px; }
.dx-sld { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .dx-sld input { flex: 1; min-width: 120px; accent-color: var(--sel); }
.dx-help .dx-row { flex-wrap: nowrap; align-items: flex-start; margin: 6px 0; } .dx-help .btn { flex: none; min-width: 100px; }
@media (max-width: 480px) { .dx-tab { padding: 3px 5px; } .dx-tab.on { padding: 4px 7px 5px; } .dx-bar .btn { min-width: 0; padding: 4px 8px; } }
`);

  /* ---------- reading the real machine ---------- */
  let hi = null; // UA-CH high entropy values
  function browserName() {
    const b = navigator.userAgentData && navigator.userAgentData.brands;
    if (b && b.length) {
      const x = b.find(v => !/Not.?A.?Brand|Chromium/i.test(v.brand)) || b.find(v => /Chromium/.test(v.brand));
      if (x) { const full = hi && hi.fullVersionList && hi.fullVersionList.find(v => v.brand === x.brand); return x.brand.replace(/^Google /, '') + ' ' + (full ? full.version.split('.')[0] : x.version); }
    }
    let m;
    if ((m = UA.match(/Firefox\/(\d+)/))) return 'Firefox ' + m[1];
    if ((m = UA.match(/Edg\/(\d+)/))) return 'Edge ' + m[1];
    if ((m = UA.match(/Chrome\/(\d+)/))) return 'Chrome ' + m[1];
    if ((m = UA.match(/Version\/([\d.]+).*Safari/))) return 'Safari ' + m[1];
    return 'Unknown browser';
  }
  function osName() {
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || '', pv = hi && hi.platformVersion;
    let m;
    if (/Windows/.test(p) || /Windows NT/.test(UA)) { if (pv) return parseInt(pv, 10) >= 13 ? 'Windows 11' : 'Windows 10'; m = UA.match(/Windows NT ([\d.]+)/); return 'Windows NT ' + (m ? m[1] : ''); }
    if (/Android/.test(p) || /Android/.test(UA)) { m = UA.match(/Android ([\d.]+)/); return 'Android ' + (pv ? pv.split('.')[0] : m ? m[1] : ''); }
    if (/iPhone|iPod/.test(UA)) { m = UA.match(/OS (\d+)[_.](\d+)/); return 'iOS ' + (m ? m[1] + '.' + m[2] : ''); }
    if (/iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)) { m = UA.match(/Version\/(\d+(\.\d+)?)/) || UA.match(/OS (\d+)[_.](\d+)/); return 'iPadOS ' + (m ? m[1] : ''); }
    if (/mac/i.test(p) || /Macintosh/.test(UA)) {
      if (pv) { const a = pv.split('.'); return 'macOS ' + (a[1] && a[1] !== '0' ? a[0] + '.' + a[1] : a[0]); }
      m = UA.match(/Mac OS X (\d+)[_.](\d+)/); return 'macOS ' + (m ? m[1] + '.' + m[2] : '');
    }
    if (/CrOS/.test(UA)) return 'ChromeOS';
    if (/Linux/.test(p) || /Linux/.test(UA)) return 'Linux';
    return p || navigator.platform || 'Unknown';
  }
  function maker() {
    if (/Macintosh|iPhone|iPad|iPod/.test(UA)) return ['Apple', /iPhone/.test(UA) ? 'iPhone' : /iPad/.test(UA) || navigator.maxTouchPoints > 1 ? 'iPad' : 'Macintosh'];
    if (/Android/.test(UA)) return ['Unknown', (hi && hi.model) || 'Android device'];
    return ['Unknown', (hi && hi.model) || 'Unknown'];
  }
  function langName() {
    try { return new Intl.DisplayNames([navigator.language], { type: 'language' }).of(navigator.language) + ' (' + navigator.language + ')'; } catch { return navigator.language || 'Unknown'; }
  }

  let GL = null;
  function glInfo() {
    if (GL) return GL;
    GL = { ok: false, webgl2: false, renderer: 'Not available', vendor: 'Not available', version: 'n/a', glsl: 'n/a', maxTex: 0, ext: 0 };
    try {
      const c = document.createElement('canvas');
      let g = c.getContext('webgl2'); GL.webgl2 = !!g;
      if (!g) g = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (g) {
        GL.ok = true;
        const d = /Firefox/.test(UA) ? null : g.getExtension('WEBGL_debug_renderer_info'); // Firefox already unmasks RENDERER and warns on the extension
        GL.renderer = String((d && g.getParameter(d.UNMASKED_RENDERER_WEBGL)) || g.getParameter(g.RENDERER) || 'Unknown');
        GL.vendor = String((d && g.getParameter(d.UNMASKED_VENDOR_WEBGL)) || g.getParameter(g.VENDOR) || 'Unknown');
        GL.version = String(g.getParameter(g.VERSION));
        GL.glsl = String(g.getParameter(g.SHADING_LANGUAGE_VERSION));
        GL.maxTex = g.getParameter(g.MAX_TEXTURE_SIZE) || 0;
        GL.ext = (g.getSupportedExtensions() || []).length;
        const lose = g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    } catch { /* keep defaults */ }
    return GL;
  }

  let hz = 0, measuring = false;
  function measureHz(isOk, done) {
    if (hz || measuring) return; measuring = true;
    const ts = [];
    const step = now => {
      if (!isOk()) { measuring = false; return; }
      ts.push(now);
      if (ts.length < 61) { requestAnimationFrame(step); return; }
      const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b), med = d[d.length >> 1];
      hz = Math.max(1, Math.round(1000 / med)); measuring = false; done();
    };
    requestAnimationFrame(step);
  }

  const has = {};
  const FILES = [
    ['ddraw.dll', '4.05.00.0155', 'Canvas 2D', () => !!document.createElement('canvas').getContext('2d')],
    ['ddrawex.dll', '4.05.00.0155', 'OffscreenCanvas', () => typeof OffscreenCanvas === 'function'],
    ['d3dim.dll', '4.05.00.0155', 'WebGL', () => glInfo().ok],
    ['d3drm.dll', '4.05.00.0155', 'WebGL 2', () => glInfo().webgl2],
    ['d3dxof.dll', '4.05.00.0155', 'WebGPU', () => !!navigator.gpu],
    ['dsound.dll', '4.05.00.0155', 'Web Audio', () => !!(window.AudioContext || window.webkitAudioContext)],
    ['dsound3d.dll', '4.05.00.0155', 'StereoPannerNode', () => typeof StereoPannerNode === 'function'],
    ['dinput.dll', '4.05.00.0155', 'Pointer + Keyboard Events', () => 'PointerEvent' in window],
    ['joyhid.vxd', '4.05.00.0155', 'Gamepad API', () => typeof navigator.getGamepads === 'function'],
    ['dplayx.dll', '4.05.00.0155', 'BroadcastChannel', () => typeof BroadcastChannel === 'function'],
    ['dpwsockx.dll', '4.05.00.0155', 'WebSocket', () => 'WebSocket' in window],
    ['dpmodemx.dll', '4.05.00.0155', 'WebRTC', () => 'RTCPeerConnection' in window],
    ['dmusic.dll', '4.06.00.0318', 'OscillatorNode', () => typeof OscillatorNode === 'function'],
    ['dmsynth.dll', '4.06.00.0318', 'Web MIDI', () => typeof navigator.requestMIDIAccess === 'function'],
    ['amstream.dll', '4.05.00.0155', 'MediaSource', () => 'MediaSource' in window],
    ['quartz.dll', '4.05.00.0155', 'H.264 <video>', () => !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"')],
    ['dxdiagn.dll', '4.05.00.0155', 'UA Client Hints', () => !!navigator.userAgentData]
  ];
  function fileRows() {
    return FILES.map(([n, v, api, test]) => {
      if (!(n in has)) { try { has[n] = !!test(); } catch { has[n] = false; } }
      const size = 20480 + hash(n) % 280000;
      return { n, v, api, ok: has[n], date: (n.startsWith('dm') ? '3/31/1998' : '7/22/1997'), size: size.toLocaleString('en-US') };
    });
  }

  /* ---------- 2D cube (hover preview + software renderer) ---------- */
  const CV = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const CF = [[0, 1, 2, 3, [214, 48, 40]], [4, 5, 6, 7, [48, 170, 64]], [0, 1, 5, 4, [52, 84, 200]], [3, 2, 6, 7, [224, 184, 32]], [1, 2, 6, 5, [170, 64, 180]], [0, 3, 7, 4, [32, 160, 176]]];
  const LIGHT = (() => { const v = [-.45, -.55, -.7], l = Math.hypot(...v); return v.map(x => x / l); })();
  function cube2d(g, cx, cy, s, ax, ay) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay);
    const V = CV.map(([x, y, z]) => { const x1 = x * cb + z * sb, z1 = -x * sb + z * cb; return [x1, y * ca - z1 * sa, y * sa + z1 * ca]; });
    const S = V.map(([x, y, z]) => { const k = s * 3.2 / (z + 4.5); return [cx + x * k, cy + y * k]; });
    const faces = CF.map(f => { const c = [0, 1, 2].map(a => (V[f[0]][a] + V[f[1]][a] + V[f[2]][a] + V[f[3]][a]) / 4); return { f, c }; })
      .filter(o => o.c[2] < -.2).sort((a, b) => b.c[2] - a.c[2]);
    faces.forEach(({ f, c }) => {
      const b = .3 + .7 * Math.max(0, c[0] * LIGHT[0] + c[1] * LIGHT[1] + c[2] * LIGHT[2]);
      g.fillStyle = `rgb(${f[4].map(v => Math.round(v * b)).join(',')})`;
      g.beginPath(); for (let i = 0; i < 4; i++) g[i ? 'lineTo' : 'moveTo'](S[f[i]][0], S[f[i]][1]); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    });
  }

  function preview(g, w, h, t) {
    g.fillStyle = '#c3c3c6'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#0a1a86'); grd.addColorStop(1, '#1d8ad6');
    g.fillStyle = grd; g.fillRect(2, 2, w - 4, 13);
    g.fillStyle = '#fff'; g.font = 'bold 9px Tahoma, sans-serif'; g.textBaseline = 'middle'; g.fillText('DirectX Diagnostic Tool', 6, 9);
    ['System', 'Files', 'Display', 'Sound', 'Input'].forEach((s, i) => {
      const x = 5 + i * 38, on = i === 2;
      g.fillStyle = '#fff'; g.fillRect(x, on ? 18 : 20, 37, 1); g.fillRect(x, on ? 18 : 20, 1, 10);
      g.fillStyle = '#555'; g.fillRect(x + 36, on ? 18 : 20, 1, 10);
      g.fillStyle = '#000'; g.font = '8px Tahoma, sans-serif'; g.fillText(s, x + 4, 24);
    });
    g.fillStyle = '#fff'; g.fillRect(4, 28, w - 8, 1); g.fillRect(4, 28, 1, h - 48);
    g.fillStyle = '#555'; g.fillRect(4, h - 20, w - 8, 1); g.fillRect(w - 5, 28, 1, h - 48);
    const top = 33, bot = h - 25;
    g.fillStyle = '#000'; g.fillRect(9, top, w - 18, bot - top);
    for (let i = 0; i < 24; i++) { const sx = 9 + (hash('s' + i) % (w - 18)), sy = top + (hash('y' + i) % (bot - top)); g.fillStyle = (i + Math.floor(t * 4)) % 5 ? '#445' : '#ccf'; g.fillRect(sx, sy, 1, 1); }
    cube2d(g, w / 2, (top + bot) / 2, 20, t * 1.1, t * 1.7);
    g.fillStyle = '#7f7'; g.font = '8px monospace'; g.fillText(`${(58 + Math.round(Math.sin(t * 3) * 2))} fps`, 13, top + 7);
    ['Help', 'Next', 'Save…', 'Exit'].forEach((s, i) => {
      const x = w - 4 - (4 - i) * 42;
      g.fillStyle = '#fff'; g.fillRect(x, h - 16, 39, 12); g.fillStyle = '#555'; g.fillRect(x + 1, h - 15, 38, 11); g.fillStyle = '#c3c3c6'; g.fillRect(x + 1, h - 15, 37, 10);
      g.fillStyle = '#000'; g.fillText(s, x + 6, h - 10);
    });
  }

  /* ---------- WebGL cube (Direct3D test) ---------- */
  function mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function xTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) & 1 ? '#1c1c7a' : '#2a2aa0'; g.fillRect(x * 8, y * 8, 8, 8); }
    g.lineCap = 'square';
    g.strokeStyle = '#000'; g.lineWidth = 14; g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.moveTo(50, 14); g.lineTo(14, 50); g.stroke();
    g.strokeStyle = '#ff3b2f'; g.lineWidth = 9; g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.stroke();
    g.strokeStyle = '#ffd23a'; g.beginPath(); g.moveTo(50, 14); g.lineTo(14, 50); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(29, 29, 6, 6);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
    return c;
  }
  function glCube(canvas) {
    let g = null;
    try { g = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl'); } catch { g = null; }
    if (!g) return null;
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return s; };
    const pr = g.createProgram();
    g.attachShader(pr, sh(g.VERTEX_SHADER, `attribute vec3 p; attribute vec3 n; attribute vec2 u; uniform mat4 R, P; varying vec2 vu; varying float vl;
      void main() { vec4 w = R * vec4(p, 1.0) + vec4(0.0, 0.0, -4.2, 0.0); gl_Position = P * w; vec3 nn = normalize((R * vec4(n, 0.0)).xyz);
      vl = 0.28 + 0.72 * max(dot(nn, normalize(vec3(-0.4, 0.5, 0.75))), 0.0); vu = u; }`));
    g.attachShader(pr, sh(g.FRAGMENT_SHADER, `precision mediump float; uniform sampler2D T; varying vec2 vu; varying float vl;
      void main() { gl_FragColor = vec4(texture2D(T, vu).rgb * vl, 1.0); }`));
    g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) return null;
    g.useProgram(pr);
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = v => v.map(a => -a);
    const faces = [[X, Y, Z], [neg(X), Z, Y], [Y, Z, X], [neg(Y), X, Z], [Z, X, Y], [neg(Z), Y, X]];
    const data = [], idx = [];
    faces.forEach(([nv, uv, vv], f) => {
      [[-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0], [-1, 1, 0, 0]].forEach(([a, b, tu, tv]) => {
        data.push(...[0, 1, 2].map(i => nv[i] + a * uv[i] + b * vv[i]), ...nv, tu, tv);
      });
      const o = f * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const vb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, vb); g.bufferData(g.ARRAY_BUFFER, new Float32Array(data), g.STATIC_DRAW);
    const ib = g.createBuffer(); g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ib); g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), g.STATIC_DRAW);
    [['p', 3, 0], ['n', 3, 12], ['u', 2, 24]].forEach(([name, size, off]) => { const l = g.getAttribLocation(pr, name); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, size, g.FLOAT, false, 32, off); });
    const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, xTexture());
    g.generateMipmap(g.TEXTURE_2D); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
    const uR = g.getUniformLocation(pr, 'R'), uP = g.getUniformLocation(pr, 'P');
    g.enable(g.DEPTH_TEST); g.enable(g.CULL_FACE);
    return {
      frame(t) {
        const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
        const f = 1 / Math.tan(.42), a = w / h, n = .1, fa = 50;
        g.uniformMatrix4fv(uP, false, [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]);
        const x = t * .9, y = t * 1.3, cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
        g.uniformMatrix4fv(uR, false, mul([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]));
        g.drawElements(g.TRIANGLES, 36, g.UNSIGNED_SHORT, 0);
      },
      destroy() { const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    };
  }

  /* ---------- tune for Test DirectMusic (original) ---------- */
  const TUNE = (() => {
    const N = { B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86, E6: 88, C3: 48, D3: 50, G2: 43, A2: 45, F2: 41 };
    const mel = 'E5 G5 C6 G5 A5 G5 E5 C5 | D5:2 F5 A5 G5:4 | E5 G5 C6 E6 D6 C6 A5 G5 | F5 D5 B4 D5 C5:4';
    const bass = 'C3:4 G2:4 | D3:4 G2:4 | C3:4 A2:4 | F2:2 G2:2 C3:4';
    const parse = (s, ch) => { const out = []; let step = 0; s.replace(/\|/g, ' ').trim().split(/\s+/).forEach(tok => { const [n, l] = tok.split(':'); const len = +(l || 1); out.push({ step, len, m: N[n], ch }); step += len; }); return out; };
    return parse(mel, 0).concat(parse(bass, 1));
  })();
  const TUNE_STEPS = 32, STEP = 60 / 132 / 2;

  /* ---------- the program ---------- */
  const def = Arcade.app({
    id: 'dxdiag', title: TITLE, label: 'DxDiag', icon: ICON, width: 600, height: 540, max: true, folder: 'Accessories', desktop: true,
    hint: 'Reports your real GPU, audio, gamepads and network, DirectX 5 style. Run the DirectDraw, Direct3D and DirectPlay tests.',
    preview,
    build(ctx) {
      const root = Arcade.el('<div class="dx-root"><div class="dx-tabs" role="tablist"></div><div class="dx-sheet"></div><div class="dx-bar"><div class="dx-prog"><span></span><div class="dx-pbar bevel-thin-in"></div></div></div></div>');
      ctx.body.appendChild(root);
      const tabsEl = root.querySelector('.dx-tabs'), sheet = root.querySelector('.dx-sheet'), bar = root.querySelector('.dx-bar');
      const progEl = root.querySelector('.dx-prog'), progTxt = progEl.querySelector('span'), progBar = progEl.querySelector('.dx-pbar');
      try { if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) navigator.userAgentData.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'model', 'fullVersionList']).then(v => { hi = v; if (cur === 0) TABS[0].render(); }).catch(() => {}); } catch { /* no UA-CH */ }

      let cur = 0, token = 0, raf = 0, skip = false, hold = false, curPop = null, fs = null, dp = null;
      const nodes = new Set();
      const disabled = new Set();
      let accel = 3, midiPorts = null, override = 0;
      const notes = {}, noteEls = {};
      const say = (text, icon = 'info', buttons = ['OK']) => Arcade.dialog({ title: TITLE, text, icon, buttons });
      const ask = text => say(text, 'info', ['Yes', 'No']);
      const kv = rows => '<div class="dx-kv">' + rows.map(([k, v]) => `<span>${esc(k)}:</span><span>${esc(v)}</span>`).join('') + '</div>';
      const lv = (cols, rows) => `<div class="dx-lv bevel-in"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => '<tr>' + r.map(c => `<td>${c && c.h != null ? c.h : esc(c)}</td>`).join('') + '</tr>').join('')}</tbody></table></div>`;
      const gb = (legend, html) => `<fieldset class="groupbox"><legend>${esc(legend)}</legend>${html}</fieldset>`;
      const okCell = ok => ({ h: ok ? '<span class="dx-ok">&#10003; OK</span>' : '<span class="dx-bad">not available</span>' });

      function setNote(tab, key, line) { notes[tab] = notes[tab] || {}; if (line == null) delete notes[tab][key]; else notes[tab][key] = line; drawNotes(tab); }
      function noteLines(tab) { const v = Object.values(notes[tab] || {}); return v.length ? v : ['No problems found.']; }
      function drawNotes(tab) { const el = noteEls[tab]; if (el) el.innerHTML = noteLines(tab).map(l => `<div>${esc(l)}</div>`).join(''); }

      /* ---- info rows shared by the tabs and the saved report ---- */
      const sysRows = () => {
        const [man, model] = maker();
        return [
          ['Current Date/Time', new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })],
          ['Computer Name', compName],
          ['Operating System', `${osName()} (${browserName()})`],
          ['Language', langName()],
          ['System Manufacturer', man],
          ['System Model', model],
          ['BIOS', 'Arcade 95 BIOS v1.0 (ECMAScript)'],
          ['Processor', `${navigator.hardwareConcurrency || 'Unknown number of'} logical CPUs` + (hi && hi.architecture ? ` (${hi.architecture}${hi.bitness ? ', ' + hi.bitness + '-bit' : ''})` : '')],
          ['Memory', navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM (rounded by the browser)` : 'Unknown'],
          ['Screen', `${screen.width} x ${screen.height}, ${+(devicePixelRatio || 1).toFixed(2)}x pixel ratio`],
          ['Touch Input', navigator.maxTouchPoints ? `${navigator.maxTouchPoints} touch points` : 'None'],
          ['DirectX Version', 'DirectX 5.0 (Arcade 95 emulation)']
        ];
      };
      const modeStr = () => `${screen.width} x ${screen.height} (${screen.colorDepth} bit) (${hz ? (override || hz) + 'Hz' : 'measuring…'})`;
      const dispRows = () => { const gi = glInfo(); return [['Name', gi.renderer], ['Manufacturer', gi.vendor], ['Chip Type', gi.ok ? (gi.webgl2 ? 'WebGL 2.0 accelerator' : 'WebGL 1.0 accelerator') : 'n/a'], ['DAC Type', 'Integrated RAMDAC'], ['Approx. Total Memory', 'n/a'], ['Current Display Mode', modeStr()], ['Monitor', `Plug and Play Monitor (${+(devicePixelRatio || 1).toFixed(2)}x)`]]; };
      const drvRows = () => { const gi = glInfo(); return [['Main Driver', gi.ok ? (gi.webgl2 ? 'webgl2.drv' : 'webgl.drv') : 'n/a'], ['Version', gi.version], ['Shading Language', gi.glsl], ['Max Texture Size', gi.maxTex ? `${gi.maxTex} x ${gi.maxTex}` : 'n/a'], ['Extensions', String(gi.ext)], ['Refresh Rate', hz ? `${hz} Hz (measured)` + (override ? `, override ${override} Hz` : '') : 'measuring…']]; };
      const feats = () => { const gi = glInfo(); return [['dd', 'DirectDraw Acceleration', has['ddraw.dll'] !== false], ['d3d', 'Direct3D Acceleration', gi.ok], ['agp', 'AGP Texture Acceleration', gi.webgl2]].map(([k, l, ok]) => [k, l, !ok ? 'Not Available' : disabled.has(k) ? 'Disabled' : 'Enabled', ok]); };
      const sndRows = () => {
        const ac = Arcade.audio();
        if (!ac) return [['Description', 'No sound device found (Web Audio not available)']];
        const ms = v => (v ? (v * 1000).toFixed(1) + ' ms' : 'n/a');
        return [['Description', `Web Audio (${ac.sampleRate} Hz, ${ms(ac.baseLatency)})`], ['Default Sound Playback', 'Yes'], ['Channels', `${ac.destination.maxChannelCount} max (${ac.destination.channelCount} in use)`],
          ['Output Latency', ms(ac.outputLatency)], ['State', ac.state], ['Driver Name', 'webaudio.vxd'], ['Muted in Arcade 95', Arcade.isMuted() ? 'Yes' : 'No']];
      };
      const ACCEL = ['No acceleration', 'Basic acceleration', 'Standard acceleration', 'Full acceleration'];
      const portRows = () => [['Arcade 95 Software Synth (default)', 'Software', 'No', 'Output', 'Yes', 'No', 'Yes'], ['Microsoft MIDI Mapper [Emulated]', 'Software', 'No', 'Output', 'No', 'No', 'No']]
        .concat((midiPorts || []).map(p => [p.name, 'External (Web MIDI)', 'No', p.dir, 'No', 'Yes', 'No']));
      const pads = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch { return []; } };
      const padIds = id => { const m = id.match(/Vendor: ([0-9a-f]{4}) Product: ([0-9a-f]{4})/i) || id.match(/^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i); return m ? ['0x' + m[1].toUpperCase(), '0x' + m[2].toUpperCase()] : ['n/a', 'n/a']; };
      const devRows = () => {
        const r = [['Keyboard', 'Attached', 'n/a', 'n/a', 'n/a', 'n/a']];
        if (matchMedia('(any-pointer: fine)').matches) r.push(['Mouse', 'Attached', 'n/a', 'n/a', 'n/a', 'n/a']);
        if (navigator.maxTouchPoints) r.push([`Touch Screen (${navigator.maxTouchPoints} points)`, 'Attached', 'n/a', 'n/a', 'n/a', 'n/a']);
        pads().forEach(p => { const [v, pr] = padIds(p.id); r.push([p.id.replace(/\s*\(.*\)\s*$/, '') || 'Game Controller', 'Attached', String(p.index), v, pr, p.vibrationActuator ? 'Rumble' : 'n/a']); });
        return r;
      };
      const conn = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const netRows = () => { const c = conn(); return [['Online', navigator.onLine ? 'Yes' : 'No'], ['Effective Type', c && c.effectiveType ? c.effectiveType.toUpperCase() : 'Unknown'], ['Downlink', c && c.downlink != null ? c.downlink + ' Mbps' : 'Unknown'], ['Round Trip Time', c && c.rtt != null ? c.rtt + ' ms' : 'Unknown'], ['Data Saver', c && c.saveData != null ? (c.saveData ? 'On' : 'Off') : 'Unknown']]; };
      const spRows = () => { const bc = typeof BroadcastChannel === 'function'; return [['Internet TCP/IP Connection', 'OK', 'dpwsockx.dll', '4.05.00.0155', navigator.onLine ? 'OK' : 'Offline'], ['IPX Connection', 'OK', 'dpwsockx.dll', '4.05.00.0155', 'Emulated'], ['Modem Connection', 'OK', 'dpmodemx.dll', '4.05.00.0155', 'Emulated'], ['Serial Connection', 'OK', 'dpmodemx.dll', '4.05.00.0155', 'Emulated'], ['BroadcastChannel (this browser)', bc ? 'OK' : 'Missing', 'dplayx.dll', '4.05.00.0155', bc ? 'OK' : 'Not available']]; };

      /* ---- tabs ---- */
      const TABS = [
        { id: 'sys', name: 'System', render: renderSys },
        { id: 'files', name: 'DirectX Files', render: renderFiles },
        { id: 'disp', name: 'Display', render: renderDisp },
        { id: 'snd', name: 'Sound', render: renderSnd },
        { id: 'mus', name: 'Music', render: renderMus },
        { id: 'inp', name: 'Input', render: renderInp },
        { id: 'net', name: 'Network', render: renderNet },
        { id: 'help', name: 'More Help', render: renderHelp }
      ];
      TABS.forEach((t, i) => {
        const b = Arcade.el('<button class="dx-tab" role="tab"></button>'); b.textContent = t.name; b.onclick = () => show(i); tabsEl.appendChild(b); t.btn = b;
        t.el = Arcade.el('<div class="dx-pane" hidden><div class="dx-pc"></div><fieldset class="groupbox dx-notes"><legend>Notes</legend><div class="dx-nb bevel-in"></div></fieldset></div>');
        t.pc = t.el.querySelector('.dx-pc'); noteEls[t.id] = t.el.querySelector('.dx-nb'); sheet.appendChild(t.el); drawNotes(t.id);
      });
      const btn = (label, fn) => { const b = Arcade.el('<button class="btn"></button>'); b.textContent = label; b.onclick = fn; return b; };
      bar.append(btn('Help', helpDlg));
      const nextBtn = btn('Next Page', () => show(Math.min(cur + 1, TABS.length - 1)));
      bar.append(nextBtn, btn('Save All Information…', saveAll), btn('Exit', () => ctx.close()));

      function show(i) {
        cur = i;
        TABS.forEach((t, j) => { t.btn.classList.toggle('on', j === i); t.btn.setAttribute('aria-selected', j === i); t.el.hidden = j !== i; });
        nextBtn.disabled = i === TABS.length - 1;
        stopInput();
        TABS[i].render();
        if (TABS[i].id === 'inp') startInput();
        sheet.scrollTop = 0;
      }
      const wire = (t, sel, fn) => { const b = t.pc.querySelector(sel); if (b) b.onclick = fn; };

      function renderSys() {
        const t = TABS[0];
        t.pc.innerHTML = '<p>This tool reports detailed information about the DirectX components and drivers on this system (as your browser sees them). Use the tabs above, or "Next Page" to visit each page in turn.</p>' +
          gb('System Information', `<div class="dx-sysinfo">${kv(sysRows())}</div>`) +
          '<label class="dx-row"><input type="checkbox" checked> Check for WHQL digital signatures</label><div>DxDiag 4.05.00.0155 (Arcade 95 emulation)</div>';
      }
      function renderFiles() {
        const t = TABS[1], rows = fileRows(), bad = rows.filter(r => !r.ok);
        t.pc.innerHTML = gb('DirectX Files', lv(['Name', 'Version', 'Attributes', 'Language', 'Date', 'Size', 'Backed By', 'Status'], rows.map(r => [r.n, r.v, 'Final Retail', 'English', r.date, r.size, r.api, okCell(r.ok)])));
        setNote('files', 'base', bad.length ? `${bad.length} of ${rows.length} components are not available in this browser: ${bad.map(r => `${r.n} (${r.api})`).join(', ')}.` : 'All DirectX files are present and backed by browser APIs.');
        setNote('files', 'ok', bad.length ? 'Programs that need these components will fall back to software.' : 'No problems found.');
      }
      function renderDisp() {
        const t = TABS[2], gi = glInfo();
        t.pc.innerHTML = '<div class="dx-cols">' + gb('Device', kv(dispRows())) + gb('Drivers', kv(drvRows())) + '</div>' +
          gb('DirectX Features', '<div class="dx-feat">' + feats().map(([k, l, st, ok]) => `<span>${esc(l)}:</span><span>${esc(st)}</span><button class="btn" data-k="${k}"${ok ? '' : ' disabled'}>${st === 'Disabled' ? 'Enable' : 'Disable'}</button>`).join('') + '</div>' +
            '<div class="dx-row end" style="margin-top:8px"><button class="btn dx-tdd">Test DirectDraw</button><button class="btn dx-td3">Test Direct3D</button></div>');
        t.pc.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; if (disabled.has(k)) disabled.delete(k); else disabled.add(k); renderDisp(); }; });
        wire(t, '.dx-tdd', testDD); wire(t, '.dx-td3', testD3D);
        if (!gi.ok) setNote('disp', 'gl', 'Direct3D (WebGL) is not available in this browser; 3D programs will use software rendering.');
        if (!hz) measureHz(() => ctx.isVisible() && cur === 2, () => { if (cur === 2 && !curPop) renderDisp(); });
      }
      function renderSnd() {
        const t = TABS[3];
        t.pc.innerHTML = gb('Device', kv(sndRows())) +
          gb('DirectX Features', `<div class="dx-sld"><span>Hardware Sound Acceleration Level:</span><input type="range" min="0" max="3" step="1" value="${accel}" aria-label="Hardware sound acceleration level"><span class="dx-acl">${ACCEL[accel]}</span></div>` +
            '<div class="dx-row end" style="margin-top:8px"><button class="btn dx-tds">Test DirectSound</button></div>');
        const r = t.pc.querySelector('input[type=range]');
        r.oninput = () => { accel = +r.value; t.pc.querySelector('.dx-acl').textContent = ACCEL[accel]; setNote('snd', 'accel', accel < 3 ? `Hardware sound acceleration is set to "${ACCEL[accel]}" (cosmetic: Web Audio always mixes in software).` : null); };
        wire(t, '.dx-tds', testDS);
      }
      function renderMus() {
        const t = TABS[4];
        t.pc.innerHTML = gb('Music Ports', lv(['Description', 'Type', 'Kernel Mode', 'In/Out', 'DLS', 'External', 'Default Port'], portRows())) +
          '<div class="dx-row end"><button class="btn dx-midi">Scan MIDI Ports</button><button class="btn dx-tdm">Test DirectMusic</button></div><canvas class="dx-roll bevel-in" width="480" height="96"></canvas>';
        wire(t, '.dx-midi', scanMidi); wire(t, '.dx-tdm', testDM);
        drawRoll(t.pc.querySelector('canvas'), -1);
      }
      function renderNet() {
        const t = TABS[6];
        t.pc.innerHTML = gb('DirectPlay Service Providers', lv(['Name', 'Registry', 'File', 'Version', 'Status'], spRows())) + gb('Connection', kv(netRows())) +
          '<div class="dx-row end"><button class="btn dx-tdp">Test DirectPlay</button></div>';
        wire(t, '.dx-tdp', testDP);
      }
      function renderHelp() {
        const t = TABS[7];
        t.pc.innerHTML = '<div class="dx-help"><p>If you are still having a problem, the buttons below may help.</p>' +
          '<div class="dx-row"><button class="btn dx-ts">Troubleshoot…</button><span>Start the DirectX Troubleshooter for a guided tour of what might be wrong.</span></div>' +
          '<div class="dx-row"><button class="btn dx-snd">Sound…</button><span>Start the Sound Troubleshooter.</span></div>' +
          '<div class="dx-row"><button class="btn dx-ov">Override…</button><span>Override the display refresh rate reported to DirectDraw.</span></div></div>';
        wire(t, '.dx-ts', async () => {
          const a = await say('DirectX Troubleshooter\n\nStep 1: Is the computer plugged in? Step 2: Have you tried turning it off and on again? Step 3: Blow on the cartridge.\n\nStill stuck? Every test on the Display, Sound and Network tabs runs on your real hardware. Run them to find the part that misbehaves.', 'info', ['Run tests', 'Close']);
          if (a === 'Run tests') show(2);
        });
        wire(t, '.dx-snd', async () => {
          const a = await say(`Sound Troubleshooter\n\nArcade 95 sound is ${Arcade.isMuted() ? 'MUTED (click the speaker in the taskbar tray)' : 'on'}. Check that your device volume is up, and that this browser tab is not muted. Browsers only start audio after you click or tap something on the page.`, 'info', ['Go to Sound tab', 'Close']);
          if (a === 'Go to Sound tab') show(3);
        });
        wire(t, '.dx-ov', overrideDlg);
      }

      /* ---- popups, animation, cleanup ---- */
      function pop(title, w = 460) {
        if (curPop) curPop.close();
        const el = Arcade.el('<div class="dx-pop"><div class="win active dx-pw bevel-out"><div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div><div class="dx-pwb"></div></div></div>');
        el.querySelector('.ttl span').textContent = title;
        el.querySelector('.dx-pw').style.width = `min(${w}px, 100%)`;
        root.appendChild(el);
        const p = { el, body: el.querySelector('.dx-pwb'), onclose: null, close() { if (curPop !== p) return; curPop = null; el.remove(); if (p.onclose) p.onclose(); } };
        el.querySelector('[data-act=close]').onclick = () => { if (p.onX) p.onX(); else p.close(); };
        curPop = p;
        return p;
      }
      function animate(my, ms, draw) {
        skip = false;
        return new Promise(res => {
          let t0 = null, last = 0, frames = 0;
          const step = now => {
            if (my !== token) { res(null); return; }
            if (t0 == null) t0 = now;
            const s = (now - t0) / 1000;
            if (ctx.isVisible()) { draw(s, Math.min(.05, s - last)); frames++; }
            last = s;
            if ((now - t0 >= ms && !hold) || skip) { res({ fps: frames / Math.max(.001, s) }); return; }
            raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        });
      }
      function fsOverlay(label) {
        const el = Arcade.el('<div class="dx-fs"><canvas></canvas><b></b></div>');
        el.querySelector('b').textContent = label + ' - press Esc or tap to stop';
        document.body.appendChild(el);
        const key = e => { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); skip = true; } };
        el.addEventListener('pointerdown', () => { skip = true; });
        addEventListener('keydown', key, true);
        try { const r = document.fullscreenElement ? null : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => {}); } catch { /* fullscreen is optional */ }
        fs = { el, canvas: el.querySelector('canvas'), remove() { if (fs !== this) return; fs = null; el.remove(); removeEventListener('keydown', key, true); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* ignore */ } } };
        return fs;
      }
      function fitCanvas(c, dprCap = 1) { const d = Math.min(devicePixelRatio || 1, dprCap), w = Math.round(c.clientWidth * d), h = Math.round(c.clientHeight * d); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } }
      function stopSound() { nodes.forEach(n => { try { n.stop(); } catch { /* already stopped */ } }); nodes.clear(); }
      function abortTests() {
        token++; cancelAnimationFrame(raf); skip = false;
        stopSound();
        if (fs) fs.remove();
        if (dp) dp.end();
        if (curPop) curPop.close();
      }
      const begin = () => { abortTests(); return token; };

      /* ---- Test DirectDraw ---- */
      async function testDD() {
        const my = begin();
        if (await ask('This will test DirectDraw on this device. Continue?') !== 'Yes' || my !== token) return;
        const p = pop('DirectDraw Test', 400); p.onX = () => { abortTests(); setNote('disp', 'dd', 'DirectDraw test results: Test was cancelled.'); };
        p.body.innerHTML = '<p>Windowed test: DirectDraw is drawing into this window.</p><canvas class="dx-cv" width="320" height="200"></canvas>';
        const g = p.body.querySelector('canvas').getContext('2d');
        let x = 30, y = 24, vx = 120, vy = 85;
        const r1 = await animate(my, 3500, (s, dt) => {
          x += vx * dt; y += vy * dt;
          if (x < 0 || x > 320 - 56) { vx = -vx; x = Math.max(0, Math.min(x, 264)); }
          if (y < 0 || y > 200 - 40) { vy = -vy; y = Math.max(0, Math.min(y, 160)); }
          g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 200);
          g.fillStyle = '#000'; g.fillRect(x, y, 56, 40);
          g.fillStyle = '#808080'; g.font = '10px monospace'; g.fillText('DirectDraw windowed blt test', 6, 194);
        });
        if (!r1) return; p.close();
        const a1 = await ask('Did you see a white rectangle with a black box moving inside it?');
        if (my !== token) return;
        if (a1 !== 'Yes') { setNote('disp', 'dd', 'DirectDraw test results: User reported a problem: the windowed test was not displayed correctly.'); return; }
        if (await say('The next test will use DirectDraw in full-screen mode. The whole screen will turn black for a few seconds. Press Esc or tap the screen to stop early.', 'info', ['OK', 'Cancel']) !== 'OK' || my !== token) { setNote('disp', 'dd', 'DirectDraw test results: Test was cancelled.'); return; }
        const f = fsOverlay('DirectDraw full-screen test'), front = f.canvas.getContext('2d'), back = document.createElement('canvas'), bg = back.getContext('2d');
        const COLORS = ['#ff3030', '#30ff30', '#3070ff', '#ffff30', '#ff30ff', '#30ffff', '#ff9a2e', '#ffffff'];
        const sprites = COLORS.map((c, i) => ({ c, x: 40 + i * 60, y: 40 + (i * 97) % 300, vx: (i % 2 ? 1 : -1) * (140 + i * 25), vy: (i % 3 ? 1 : -1) * (110 + i * 20), s: 26 + (i % 3) * 12 }));
        let flip = 0;
        const r2 = await animate(my, 4500, (s, dt) => {
          fitCanvas(f.canvas); const W = f.canvas.width, H = f.canvas.height;
          if (back.width !== W || back.height !== H) { back.width = W; back.height = H; }
          bg.fillStyle = '#000'; bg.fillRect(0, 0, W, H);
          sprites.forEach(o => {
            o.x += o.vx * dt; o.y += o.vy * dt;
            if (o.x < 0 || o.x > W - o.s) { o.vx = -o.vx; o.x = Math.max(0, Math.min(o.x, W - o.s)); }
            if (o.y < 0 || o.y > H - o.s) { o.vy = -o.vy; o.y = Math.max(0, Math.min(o.y, H - o.s)); }
            bg.fillStyle = o.c; bg.fillRect(o.x, o.y, o.s, o.s); bg.fillStyle = 'rgba(0,0,0,.35)'; bg.fillRect(o.x + o.s / 4, o.y + o.s / 4, o.s / 2, o.s / 2);
          });
          flip++;
          bg.fillStyle = '#fff'; bg.font = '14px monospace';
          bg.fillText(`DirectDraw page flipping test  -  flip #${flip}  -  front buffer: surface ${flip % 2 ? 'A' : 'B'}`, 12, 22);
          front.drawImage(back, 0, 0); // the "flip"
        });
        f.remove();
        if (!r2) return;
        const a2 = await ask('Did you see colored boxes bouncing on a black screen, without flickering?');
        if (my !== token) return;
        setNote('disp', 'dd', a2 === 'Yes' ? `DirectDraw test results: All tests were successful. (${flip} page flips, ${Math.round(r2.fps)} fps)` : 'DirectDraw test results: User reported a problem: the full-screen test was not displayed correctly.');
      }

      /* ---- Test Direct3D ---- */
      async function testD3D() {
        const my = begin();
        if (await ask('This will test Direct3D on this device. Continue?') !== 'Yes' || my !== token) return;
        const res = [];
        const cancelled = () => { abortTests(); setNote('disp', 'd3d', 'Direct3D test results: Test was cancelled.'); };
        let hw = glInfo().ok && !disabled.has('d3d');
        if (hw) {
          const p = pop('Direct3D Test', 400); p.onX = cancelled;
          p.body.innerHTML = '<p>Testing Direct3D hardware acceleration (WebGL) in a window. <span class="dx-fps"></span></p><canvas class="dx-cv"></canvas>';
          const cv = p.body.querySelector('canvas'), fpsEl = p.body.querySelector('.dx-fps'), cube = glCube(cv);
          if (!cube) { hw = false; p.close(); setNote('disp', 'gl', 'Direct3D (WebGL) could not create a device; using software rendering.'); }
          else {
            let fr = 0, ft = 0;
            const r = await animate(my, 4000, s => { cube.frame(s); fr++; if (s - ft > .5) { fpsEl.textContent = Math.round(fr / (s - ft)) + ' fps'; fr = 0; ft = s; } });
            cube.destroy(); if (!r) return; p.close();
            res.push(`Hardware (windowed): ${Math.round(r.fps)} fps`);
            const a = await ask('Did you see a spinning cube with an X on each side?');
            if (my !== token) return;
            if (a !== 'Yes') { setNote('disp', 'd3d', 'Direct3D test results: User reported a problem in the windowed hardware test.'); return; }
            if (await say('The next test will use Direct3D in full-screen mode. Press Esc or tap the screen to stop early.', 'info', ['OK', 'Cancel']) !== 'OK' || my !== token) { setNote('disp', 'd3d', 'Direct3D test results: Test was cancelled.'); return; }
            const f = fsOverlay('Direct3D full-screen test (hardware)'), fc = glCube(f.canvas);
            const r2 = fc ? await animate(my, 4500, s => fc.frame(s)) : { fps: 0 };
            if (fc) fc.destroy(); f.remove();
            if (!r2) return;
            res.push(`Hardware (full screen): ${Math.round(r2.fps)} fps`);
            const a2 = await ask('Did you see a spinning cube fill the screen?');
            if (my !== token) return;
            if (a2 !== 'Yes') { setNote('disp', 'd3d', 'Direct3D test results: User reported a problem in the full-screen hardware test. ' + res.join(', ') + '.'); return; }
          }
        }
        if (!hw) res.push('Hardware: not available');
        const p = pop('Direct3D Test - Software (RGB emulation)', 400); p.onX = cancelled;
        p.body.innerHTML = '<p>Software (RGB emulation): the cube is now drawn by the CPU with Canvas 2D. <span class="dx-fps"></span></p><canvas class="dx-cv"></canvas>';
        const cv = p.body.querySelector('canvas'), g = cv.getContext('2d'), fpsEl = p.body.querySelector('.dx-fps');
        let fr = 0, ft = 0;
        const r3 = await animate(my, 4000, s => {
          fitCanvas(cv, 2); const W = cv.width, H = cv.height;
          g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
          cube2d(g, W / 2, H / 2, Math.min(W, H) * .3, s * .9, s * 1.3);
          g.fillStyle = '#7f7'; g.font = `${Math.round(H / 16)}px monospace`; g.fillText('Software (RGB emulation)', 8, H - 10);
          fr++; if (s - ft > .5) { fpsEl.textContent = Math.round(fr / (s - ft)) + ' fps'; fr = 0; ft = s; }
        });
        if (!r3) return; p.close();
        res.push(`Software (RGB emulation): ${Math.round(r3.fps)} fps`);
        const a3 = await ask('Did you see a flat-shaded spinning cube (software rendering)?');
        if (my !== token) return;
        setNote('disp', 'd3d', (a3 === 'Yes' ? (hw ? 'Direct3D test results: All tests were successful. ' : 'Direct3D test results: Software test was successful; hardware acceleration is not available. ') : 'Direct3D test results: User reported a problem in the software test. ') + res.join(', ') + '.');
      }

      /* ---- Test DirectSound ---- */
      async function soundReady() {
        const ac = Arcade.audio();
        if (!ac) { await say('DirectSound could not be initialized: Web Audio is not available in this browser.', 'error'); return null; }
        if (Arcade.isMuted()) {
          if (await say('Sound is muted in Arcade 95. Turn sound on to run this test?', 'warn', ['Yes', 'No']) !== 'Yes') return null;
          Arcade.setMuted(false);
        }
        return ac;
      }
      function tone(ac, { pan = 0, f = 440, f2 = 0, dur = 1, type = 'sine', vol = .16, at = 0, out = null }) {
        const t = (at || ac.currentTime + .04), o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.setValueAtTime(vol, t + Math.max(.03, dur - .06)); g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g);
        if (out) g.connect(out);
        else if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(ac.destination); }
        else g.connect(ac.destination);
        o.start(t); o.stop(t + dur + .02); nodes.add(o); o.onended = () => nodes.delete(o);
      }
      async function testDS() {
        const my = begin();
        if (await ask('This will test DirectSound on this device. Make sure your speakers or headphones are on. Continue?') !== 'Yes' || my !== token) return;
        const ac = await soundReady(); if (!ac || my !== token) return;
        const steps = [
          ['left', { pan: -1, f: 523.25 }, 'Did you hear a tone from the LEFT speaker only?'],
          ['right', { pan: 1, f: 659.25 }, 'Did you hear a tone from the RIGHT speaker only?'],
          ['center', { pan: 0, f: 587.33 }, 'Did you hear a tone from both speakers equally (center)?'],
          ['sweep', { pan: 0, f: 160, f2: 2400, dur: 2.2, type: 'triangle' }, 'Did you hear a tone sweep from low to high?']
        ];
        const p = pop('DirectSound Test', 340); p.onX = () => { abortTests(); setNote('snd', 'ds', 'DirectSound test results: Test was cancelled.'); };
        p.body.innerHTML = '<p class="dx-st"></p><div class="dx-meter"><span>L</span><div class="bevel-thin-in"><i></i></div></div><div class="dx-meter"><span>R</span><div class="bevel-thin-in"><i></i></div></div>';
        const st = p.body.querySelector('.dx-st'), [ml, mr] = p.body.querySelectorAll('.dx-meter i');
        const bad = [];
        for (const [name, opts, q] of steps) {
          const dur = opts.dur || 1.2;
          st.textContent = `Playing: ${name === 'sweep' ? 'frequency sweep' : name + ' channel'} (${ACCEL[accel].toLowerCase()})…`;
          tone(ac, Object.assign({ dur }, opts));
          const r = await animate(my, dur * 1000 + 150, s => {
            const lv = s < dur ? (.75 + .25 * Math.sin(s * 40)) * 100 : 0, pan = opts.pan;
            ml.style.width = (pan > 0 ? 0 : lv) + '%'; mr.style.width = (pan < 0 ? 0 : lv) + '%';
          });
          if (!r) return;
          ml.style.width = mr.style.width = '0%'; st.textContent = 'Waiting for your answer…';
          const a = await ask(q);
          if (my !== token) return;
          if (a !== 'Yes') bad.push(name);
        }
        p.close();
        setNote('snd', 'ds', bad.length ? `DirectSound test results: User reported a problem with: ${bad.join(', ')}. (${ac.sampleRate} Hz)` : `DirectSound test results: All tests were successful. (${ac.sampleRate} Hz, ${ac.destination.maxChannelCount} channels)`);
      }

      /* ---- Music: Web MIDI scan + Test DirectMusic ---- */
      async function scanMidi() {
        if (typeof navigator.requestMIDIAccess !== 'function') { setNote('mus', 'midi', 'Web MIDI is not available in this browser (dmsynth.dll missing): only the software synth is listed.'); return; }
        setNote('mus', 'midi', 'Scanning for MIDI ports…');
        try {
          const acc = await navigator.requestMIDIAccess({ sysex: false });
          midiPorts = [];
          acc.inputs.forEach(i => midiPorts.push({ name: i.name || 'MIDI Input', dir: 'Input' }));
          acc.outputs.forEach(o => midiPorts.push({ name: o.name || 'MIDI Output', dir: 'Output' }));
          setNote('mus', 'midi', midiPorts.length ? `Web MIDI: found ${midiPorts.length} external port(s).` : 'Web MIDI is available but no external MIDI devices are connected.');
        } catch (e) { setNote('mus', 'midi', 'Web MIDI access was denied or failed: ' + ((e && e.message) || e)); }
        if (cur === 4) renderMus();
      }
      function drawRoll(cv, step) {
        if (!cv) return;
        const g = cv.getContext('2d'), W = cv.width, H = cv.height, lo = 40, hiN = 90, cw = W / TUNE_STEPS, rh = H / (hiN - lo);
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        for (let i = 0; i <= TUNE_STEPS; i++) { g.fillStyle = i % 8 ? '#141428' : '#2a2a50'; g.fillRect(Math.round(i * cw), 0, 1, H); }
        TUNE.forEach(n => {
          const on = step >= n.step && step < n.step + n.len;
          g.fillStyle = on ? '#fff' : n.ch ? '#2c8a3c' : '#c8a020';
          g.fillRect(n.step * cw + 1, H - (n.m - lo + 1) * rh, n.len * cw - 2, Math.max(2, rh - 1));
        });
        if (step >= 0) { g.fillStyle = '#ff3b2f'; g.fillRect(step * cw, 0, 2, H); }
      }
      async function testDM() {
        const my = begin();
        const ac = await soundReady(); if (!ac || my !== token) return;
        const master = ac.createGain(); master.gain.value = .9; master.connect(ac.destination);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
        const t0 = ac.currentTime + .1, hz2 = m => 440 * Math.pow(2, (m - 69) / 12);
        TUNE.forEach(n => tone(ac, { f: hz2(n.m), dur: n.len * STEP * .92, at: t0 + n.step * STEP, type: n.ch ? 'sawtooth' : 'square', vol: n.ch ? .12 : .05, out: n.ch ? lp : master }));
        for (let b = 0; b < TUNE_STEPS; b += 2) tone(ac, { f: 140, f2: 45, dur: .12, at: t0 + b * STEP, type: 'sine', vol: b % 4 ? .1 : .22, out: master });
        setNote('mus', 'dm', 'Playing a General MIDI style test tune through the Arcade 95 Software Synth…');
        const cv = TABS[4].pc.querySelector('canvas');
        const r = await animate(my, (TUNE_STEPS * STEP + .4) * 1000, () => drawRoll(TABS[4].pc.querySelector('canvas'), Math.min(TUNE_STEPS, (ac.currentTime - t0) / STEP)));
        drawRoll(TABS[4].pc.querySelector('canvas') || cv, -1);
        if (!r) return;
        const a = await ask('Did you hear the music play?');
        if (my !== token) return;
        setNote('mus', 'dm', a === 'Yes' ? 'DirectMusic test results: All tests were successful.' : 'DirectMusic test results: User reported a problem.');
      }

      /* ---- Input: live DirectInput readout ---- */
      const keys = new Map(), mouse = { x: 0, y: 0, b: 0, type: '-', seen: false };
      let inRaf = 0, padKey = '', inputOn = false;
      const onKd = e => { keys.set(e.code || e.key, e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key); };
      const onKu = e => { keys.delete(e.code || e.key); };
      const onPm = e => { mouse.x = Math.round(e.clientX); mouse.y = Math.round(e.clientY); mouse.b = e.buttons; mouse.type = e.pointerType || 'mouse'; mouse.seen = true; };
      const onBlur = () => keys.clear();
      const onPad = () => { if (cur === 5) renderInp(); };
      addEventListener('gamepadconnected', onPad); addEventListener('gamepaddisconnected', onPad);
      function renderInp() {
        const t = TABS[5];
        padKey = pads().map(p => p.index + p.id).join('|');
        t.pc.innerHTML = gb('DirectInput Devices', lv(['Device Name', 'Status', 'Controller ID', 'Vendor ID', 'Product ID', 'Force Feedback'], devRows())) +
          gb('Live Input (polled while this page is visible)', '<div class="dx-live">' +
            '<div><div>Keyboard (keys held down):</div><div class="dx-keys bevel-in"></div></div>' +
            '<div><div>Mouse / Pointer:</div><div class="dx-ms">Move the mouse…</div><div style="margin-top:4px">Buttons: L<span class="dx-led" data-b="1"></span> M<span class="dx-led" data-b="4"></span> R<span class="dx-led" data-b="2"></span></div></div>' +
            '<div><div>Game Controllers:</div><div class="dx-pads"></div></div></div>');
        const box = t.pc.querySelector('.dx-pads'), list = pads();
        box.innerHTML = list.length ? list.map(p => `<div class="dx-pad" data-i="${p.index}"><b>${esc(p.index + ': ' + p.id)}</b>` +
          p.axes.map((_, a) => `<div class="dx-axis bevel-thin-in" title="Axis ${a}"><i></i></div>`).join('') +
          '<div>' + p.buttons.map((_, b) => `<span class="dx-led" title="Button ${b}"></span>`).join('') + '</div></div>').join('')
          : '<div class="dx-wake">No game controllers found. Press a button on your gamepad to wake it up.</div>';
        setNote('inp', 'base', list.length ? `${list.length} game controller(s) found. Force feedback is ${list.some(p => p.vibrationActuator) ? 'available' : 'not available'}.` : 'Press a button on your gamepad to wake it up: browsers hide controllers until one is used.');
      }
      function startInput() {
        if (inputOn || !ctx.isVisible()) return; inputOn = true;
        addEventListener('keydown', onKd, true); addEventListener('keyup', onKu, true); addEventListener('pointermove', onPm, true); addEventListener('pointerdown', onPm, true); addEventListener('pointerup', onPm, true); addEventListener('blur', onBlur);
        const loop = () => {
          if (!inputOn) return;
          inRaf = requestAnimationFrame(loop);
          if (!ctx.isVisible() || cur !== 5) return;
          const pc = TABS[5].pc, list = pads();
          if (list.map(p => p.index + p.id).join('|') !== padKey) renderInp();
          const kb = pc.querySelector('.dx-keys'), html = [...keys.values()].map(k => `<kbd>${esc(k)}</kbd>`).join('') || '<span class="dx-wake">(none)</span>';
          if (kb && kb.innerHTML !== html) kb.innerHTML = html;
          const ms = pc.querySelector('.dx-ms'); if (ms && mouse.seen) ms.textContent = `X: ${mouse.x}  Y: ${mouse.y}  (${mouse.type})`;
          pc.querySelectorAll('[data-b]').forEach(l => l.classList.toggle('on', !!(mouse.b & +l.dataset.b)));
          list.forEach(p => {
            const el = pc.querySelector(`.dx-pad[data-i="${p.index}"]`); if (!el) return;
            el.querySelectorAll('.dx-axis i').forEach((bar, a) => { const v = Math.max(-1, Math.min(1, p.axes[a] || 0)); bar.style.left = (50 + Math.min(0, v) * 50) + '%'; bar.style.width = Math.abs(v) * 50 + '%'; });
            el.querySelectorAll('.dx-led').forEach((l, b) => { const btn = p.buttons[b]; const v = btn ? (typeof btn === 'object' ? btn.value : btn) : 0; l.classList.toggle('on', !!(btn && (btn.pressed || v > .5))); l.style.opacity = btn && v > 0 && v < 1 ? .5 + v / 2 : ''; });
          });
        };
        inRaf = requestAnimationFrame(loop);
      }
      function stopInput() {
        if (!inputOn) return; inputOn = false; cancelAnimationFrame(inRaf); keys.clear();
        removeEventListener('keydown', onKd, true); removeEventListener('keyup', onKu, true); removeEventListener('pointermove', onPm, true); removeEventListener('pointerdown', onPm, true); removeEventListener('pointerup', onPm, true); removeEventListener('blur', onBlur);
      }

      /* ---- Test DirectPlay (real, over BroadcastChannel) ---- */
      function testDP() {
        const my = begin();
        if (typeof BroadcastChannel !== 'function') { say('DirectPlay could not be initialized: BroadcastChannel is not available in this browser.', 'error'); setNote('net', 'dp', 'DirectPlay test results: BroadcastChannel is not available.'); return; }
        const id = Math.random().toString(16).slice(2, 6).toUpperCase(), name = `${compName} #${id}`, players = new Map(), started = performance.now();
        const stats = { remote: 0, pings: [], loop: null };
        let role = 'Host', firstSeen = false;
        const p = pop('DirectPlay Test', 440);
        p.body.innerHTML = `<p>Hosting session "Arcade 95 DirectPlay Test" as <b></b> over the BroadcastChannel service provider.</p>
          <p>Open Arcade 95 in another tab and run Test DirectPlay there too: both tabs will find each other.</p>
          ${lv(['Player', 'Status', 'Ping'], [])}
          <div class="dx-chat bevel-in" aria-live="polite"></div>
          <div class="dx-in"><input class="field" maxlength="120" placeholder="Type a chat message" aria-label="Chat message"><button class="btn dx-send">Send</button></div>
          <div class="dx-row"><span class="dx-dps" style="flex:1">Searching for players…</span><button class="btn dx-loop" hidden>Loopback Test</button><button class="btn dx-close">Close</button></div>`;
        p.body.querySelector('b').textContent = name;
        const tbody = p.body.querySelector('tbody'), chat = p.body.querySelector('.dx-chat'), inp = p.body.querySelector('input'), stEl = p.body.querySelector('.dx-dps'), loopBtn = p.body.querySelector('.dx-loop');
        const log = (text, sys) => { const d = document.createElement('div'); if (sys) d.className = 'sys'; d.textContent = text; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; };
        const ch = new BroadcastChannel('arcade95-dplay');
        const post = m => { try { ch.postMessage(Object.assign({ id }, m)); } catch { /* closed */ } };
        const drawPlayers = () => {
          tbody.innerHTML = [[name + ' (you)', role + ', local', '-']].concat([...players.values()].map(q => [q.name, q.loop ? 'Loopback' : 'Remote tab', q.ping == null ? '…' : q.ping + ' ms'])).map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
        };
        const add = (pid, pname, loop) => { if (players.has(pid)) return false; players.set(pid, { name: pname, ping: null, loop }); if (!loop) stats.remote = Math.max(stats.remote, [...players.values()].filter(q => !q.loop).length); log(`* ${pname} joined the session`, true); drawPlayers(); return true; };
        ch.onmessage = e => {
          const m = e.data || {}; if (!m.id || m.id === id || (m.to && m.to !== id)) return;
          if (!m.loop && !firstSeen) { firstSeen = true; if (m.t !== 'hello') role = 'Joined'; }
          if (m.t === 'hello') { add(m.id, m.name, m.loop); post({ t: 'here', name, to: m.id }); }
          else if (m.t === 'here') add(m.id, m.name, m.loop);
          else if (m.t === 'ping') { add(m.id, m.name, m.loop); post({ t: 'pong', to: m.id, ts: m.ts }); }
          else if (m.t === 'pong') { const q = players.get(m.id); if (q) { q.ping = Math.max(0, Math.round((performance.now() - m.ts) * 10) / 10); if (q.loop) stats.loop = q.ping; else stats.pings.push(q.ping); drawPlayers(); } }
          else if (m.t === 'chat') { const q = players.get(m.id); log(`<${q ? q.name : m.name}> ${String(m.text).slice(0, 200)}`); }
          else if (m.t === 'bye') { const q = players.get(m.id); if (q) { players.delete(m.id); log(`* ${q.name} left the session`, true); drawPlayers(); } }
        };
        const send = () => { const text = inp.value.trim(); if (!text) return; post({ t: 'chat', name, text }); log(`<${name}> ${text}`); inp.value = ''; inp.focus(); };
        p.body.querySelector('.dx-send').onclick = send;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
        let lb = null;
        loopBtn.onclick = () => {
          if (lb) return; loopBtn.disabled = true;
          const lid = 'LOOP' + id, lname = 'LOOPBACK (second channel in this tab)';
          lb = new BroadcastChannel('arcade95-dplay');
          const lpost = m => { try { lb.postMessage(Object.assign({ id: lid, loop: 1, name: lname, to: id }, m)); } catch { /* closed */ } };
          lb.onmessage = e => {
            const m = e.data || {}; if (m.id !== id || (m.to && m.to !== lid && m.t !== 'ping' && m.t !== 'chat')) return;
            if (m.t === 'hello' || m.t === 'ping') { if (m.t === 'ping') lpost({ t: 'pong', ts: m.ts }); else lpost({ t: 'here' }); }
            else if (m.t === 'chat') lpost({ t: 'chat', text: 'echo: ' + m.text });
          };
          lpost({ t: 'hello' });
          log('* Loopback: a second BroadcastChannel in this tab joins the session and echoes your messages.', true);
        };
        const pagehide = () => post({ t: 'bye' });
        addEventListener('pagehide', pagehide);
        const timer = setInterval(() => {
          if (my !== token || !ctx.isVisible()) return;
          post({ t: 'ping', name, ts: performance.now() });
          const remote = [...players.values()].filter(q => !q.loop).length;
          stEl.textContent = remote ? `Connected: ${remote} other player(s) in this session.` : lb ? (stats.loop != null ? `Loopback OK: round trip ${stats.loop} ms.` : 'Loopback: waiting for echo…') : 'Searching for players…';
          if (remote && !lb) loopBtn.hidden = true;
          if (!remote && !lb && performance.now() - started > 4000 && loopBtn.hidden) { loopBtn.hidden = false; log('* No other players found. Open Arcade 95 in another tab and run Test DirectPlay there too, or click "Loopback Test".', true); }
        }, 1000);
        dp = {
          end() {
            if (dp !== this) return; dp = null; clearInterval(timer); removeEventListener('pagehide', pagehide); post({ t: 'bye' });
            try { ch.close(); } catch { /* ignore */ } try { if (lb) lb.close(); } catch { /* ignore */ }
            const avg = stats.pings.length ? Math.round(stats.pings.reduce((a, b) => a + b, 0) / stats.pings.length * 10) / 10 : null;
            setNote('net', 'dp', stats.remote ? `DirectPlay test results: All tests were successful. Connected to ${stats.remote} other tab(s); average ping ${avg} ms.`
              : stats.loop != null ? `DirectPlay test results: Loopback test was successful (BroadcastChannel round trip ${stats.loop} ms). No other tabs were found.`
                : 'DirectPlay test results: No other players were found.');
          }
        };
        p.onclose = () => { if (dp) dp.end(); };
        p.body.querySelector('.dx-close').onclick = () => p.close();
        drawPlayers();
        log(`* Session created. Your name is ${name}.`, true);
        post({ t: 'hello', name });
        setTimeout(() => inp.focus(), 0);
      }

      /* ---- More Help / Help / Save ---- */
      function overrideDlg() {
        const p = pop('Override', 320);
        p.body.innerHTML = `<p>Monitor refresh rate:</p><label class="dx-row"><input type="radio" name="dx-ov" value="0"${override ? '' : ' checked'}> Default (measured ${hz || '?'} Hz)</label>
          <label class="dx-row"><input type="radio" name="dx-ov" value="1"${override ? ' checked' : ''}> Override: <input class="field" type="number" min="40" max="240" value="${override || hz || 60}" style="width:70px"> Hz</label>
          <div class="dx-row end"><button class="btn dx-ok-b">OK</button><button class="btn dx-cn">Cancel</button></div>`;
        p.body.querySelector('.dx-cn').onclick = () => p.close();
        p.body.querySelector('.dx-ok-b').onclick = () => {
          const on = p.body.querySelector('input[value="1"]').checked, v = Math.round(+p.body.querySelector('input[type=number]').value);
          override = on && v >= 40 && v <= 240 ? v : 0;
          setNote('help', 'ov', override ? `Refresh rate override set to ${override} Hz (cosmetic: the browser decides the real rate, measured at ${hz || '?'} Hz).` : null);
          p.close();
        };
      }
      function helpDlg() {
        say('DirectX Diagnostic Tool (Arcade 95)\n\nEach tab shows what your real browser and hardware report: the GPU from WebGL, the sound device from Web Audio, gamepads, MIDI and network. Use the Test buttons on the Display, Sound, Music and Network tabs, and "Save All Information…" for a full text report.');
      }
      function report() {
        const L = [];
        const sec = t => L.push('', '-'.repeat(t.length), t, '-'.repeat(t.length));
        const kvt = rows => rows.forEach(([k, v]) => L.push(String(k).padStart(24) + ': ' + v));
        sec('System Information'); L.push('Time of this report'.padStart(24) + ': ' + new Date().toLocaleString()); kvt(sysRows());
        L.push('DxDiag Version'.padStart(24) + ': 4.05.00.0155 (Arcade 95 emulation)');
        sec('DirectX Files'); fileRows().forEach(r => L.push(r.n.padStart(14) + `: ${r.v} English Final Retail ${r.date} ${r.size.padStart(7)} bytes  -> ${r.api}: ${r.ok ? 'OK' : 'not available'}`));
        sec('Display Devices'); kvt(dispRows().concat(drvRows())); feats().forEach(([, l, st]) => L.push(l.padStart(24) + ': ' + st));
        sec('Sound Devices'); kvt(sndRows()); L.push('HW Accel Level'.padStart(24) + ': ' + ACCEL[accel]);
        sec('DirectMusic'); portRows().forEach(r => L.push('  ' + r[0] + ', ' + r[1] + ', ' + r[3] + (r[6] === 'Yes' ? ' (default)' : '')));
        if (!midiPorts) L.push('  (Web MIDI ports not scanned)');
        sec('DirectInput Devices'); devRows().forEach(r => L.push('  ' + r[0] + ': ' + r[1] + (r[3] !== 'n/a' ? `, vendor ${r[3]}, product ${r[4]}` : '')));
        sec('DirectPlay Service Providers'); spRows().forEach(r => L.push('  ' + r[0] + ' - Registry: ' + r[1] + ', File: ' + r[2] + ' ' + r[3] + ', Status: ' + r[4])); kvt(netRows());
        sec('DxDiag Notes'); TABS.filter(t => t.id !== 'help' || notes.help).forEach(t => L.push(('  ' + t.name + ' Tab').padEnd(22) + ': ' + noteLines(t.id).join(' ')));
        return L.join('\n').trim() + '\n';
      }
      function saveAll() {
        if (curPop && dp) return;
        const text = report();
        const p = pop('DxDiag.txt - Notepad', 620);
        p.body.innerHTML = '<div class="dx-np"><span>File</span><span>Edit</span><span>Search</span><span>Help</span></div><textarea class="field dx-txt" readonly spellcheck="false" aria-label="DxDiag report"></textarea><div class="dx-row"><span class="dx-cs" style="flex:1"></span><button class="btn dx-copy">Copy to clipboard</button><button class="btn dx-cl">Close</button></div>';
        const ta = p.body.querySelector('textarea'), cs = p.body.querySelector('.dx-cs'); ta.value = text;
        const selectAll = () => { ta.focus(); ta.select(); cs.textContent = 'Text selected: press Ctrl+C (or Cmd+C) to copy.'; };
        p.body.querySelector('.dx-copy').onclick = () => {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { cs.textContent = 'Copied to clipboard.'; }, selectAll);
            else selectAll();
          } catch { selectAll(); }
        };
        p.body.querySelector('.dx-cl').onclick = () => p.close();
      }

      /* ---- opening progress, clock, lifecycle ---- */
      let progTimer = 0;
      const PHASES = ['Checking DirectX files…', 'Gathering display information…', 'Gathering sound information…', 'Gathering input information…', 'Gathering network information…'];
      function runProgress() {
        clearInterval(progTimer); progEl.style.visibility = ''; progBar.innerHTML = ''; let n = 0;
        const max = 24;
        progTimer = setInterval(() => {
          if (!ctx.isVisible()) return;
          n++; if (progBar.children.length < Math.round(n / 40 * max) && progBar.scrollWidth <= progBar.clientWidth) progBar.appendChild(document.createElement('i'));
          progTxt.textContent = PHASES[Math.min(PHASES.length - 1, Math.floor(n / 8))];
          if (n === 8) fileRows();
          if (n === 16) glInfo();
          if (n >= 40) { clearInterval(progTimer); progTxt.textContent = ''; progEl.style.visibility = 'hidden'; if (cur === 1) renderFiles(); }
        }, 45);
      }
      let clock = 0;
      const tickClock = () => { if (ctx.isVisible() && cur === 0) { const s = TABS[0].pc.querySelector('.dx-kv span:nth-child(2)'); if (s) s.textContent = sysRows()[0][1]; } };
      function stopAll() { abortTests(); stopInput(); }
      ctx.on('open', () => { runProgress(); show(0); clearInterval(clock); clock = setInterval(tickClock, 1000); });
      ctx.on('close', () => { stopAll(); clearInterval(progTimer); clearInterval(clock); });
      ctx.on('minimize', stopAll);
      ctx.on('restore', () => { if (cur === 5) startInput(); });

      def.api = {
        tab: i => show(typeof i === 'number' ? i : TABS.findIndex(t => t.id === i || t.name === i)),
        report, notes: () => JSON.parse(JSON.stringify(notes)), gl: glInfo, hz: () => hz,
        skip: () => { skip = true; }, hold: on => { hold = !!on; }, cur: () => TABS[cur].id
      };
    }
  });
})();

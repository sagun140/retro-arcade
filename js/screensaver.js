/* Arcade 95 screen savers. Defines window.Screensavers95 (names, drawPreview, start, stop, settings) and owns the idle timer.
   Every saver is an original re-creation: 2D canvas, raw WebGL (pipes, flower box) with a 2D fallback, or a raycaster (maze).
   A saver is make(env) -> { frame(dt) }, where env = { g|gl, w, h, opts, preview }. */
(() => {
  const A = window.Arcade;
  const store = A ? A.store : { get: (k, d) => d, set() {} };
  const rmq = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const ri = n => Math.floor(Math.random() * n);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
  const NAMES = ['(None)', 'Blank Screen', '3D Pipes', '3D Maze', 'Starfield Simulation', 'Mystify Your Mind', 'Flying Windows', 'Scrolling Marquee', '3D Flower Box', 'Curves and Colors'];

  if (A) A.css(`
    .ss-veil { position: fixed; inset: 0; z-index: 99990; background: #000; cursor: none; touch-action: none; overflow: hidden; }
    .ss-veil canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .ss-veil.ss-px canvas { image-rendering: pixelated; }
    .ss-pwwrap { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; cursor: default; }
    .ss-pwwrap .msgbox { width: min(340px, 100%); }
    .ss-pwwrap .ss-err { color: #a00000; min-height: 16px; margin-top: 6px; }
    .ss-pwwrap .ss-key { flex: none; }
    .ss-setwin { width: min(330px, 100%); }
    .ss-set { padding: 8px 12px 4px; display: grid; gap: 6px; }
    .ss-set .groupbox { margin: 4px 0 0; display: flex; gap: 4px 14px; flex-wrap: wrap; }
    .ss-set .groupbox label, .ss-row { display: flex; align-items: center; gap: 6px; }
    .ss-row input[type=range] { flex: 1; min-width: 80px; }
    .ss-row > span:first-child { min-width: 92px; }
    .ss-row small { color: var(--lo); }
    .ss-col { display: grid; gap: 3px; }
    .ss-row input[type=color] { width: 44px; height: 22px; padding: 0 2px; border: 0; background: var(--face); box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo); }
  `);

  /* ================= options ================= */
  const R = (k, label, def, min = 1, max = 10, lo = 'Slow', hi = 'Fast') => ({ k, label, type: 'range', def, min, max, lo, hi });
  const SCHEMA = {
    '3D Pipes': { slug: 'pipes', fields: [
      { k: 'mode', label: 'Pipes', type: 'radio', def: 'multi', opts: [['multi', 'Multiple'], ['single', 'Single']] },
      { k: 'joint', label: 'Joint type', type: 'radio', def: 'mixed', opts: [['elbow', 'Elbow'], ['ball', 'Ball'], ['mixed', 'Mixed']] },
      { k: 'tex', label: 'Surface style', type: 'radio', def: 'solid', opts: [['solid', 'Solid'], ['checker', 'Checker']] },
      R('speed', 'Speed', 5)] },
    '3D Maze': { slug: 'maze', fields: [
      { k: 'size', label: 'Maze size', type: 'radio', def: 'medium', opts: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
      R('speed', 'Walk speed', 5),
      { k: 'rats', label: 'Rats run around the maze', type: 'check', def: true }] },
    'Starfield Simulation': { slug: 'starfield', fields: [R('speed', 'Warp speed', 10, 1, 20), R('count', 'Starfield density', 200, 10, 1000, '10', '1000')] },
    'Mystify Your Mind': { slug: 'mystify', fields: [
      { k: 'polys', label: 'Shapes', type: 'radio', def: 2, opts: [[1, 'One polygon'], [2, 'Two polygons']] },
      R('trail', 'Lines per shape', 7, 1, 20, '1', '20'),
      { k: 'clear', label: 'Clear screen (erase old lines)', type: 'check', def: true }] },
    'Flying Windows': { slug: 'flyingwin', fields: [R('speed', 'Warp speed', 5), R('count', 'Number of flags', 20, 5, 60, 'Few', 'Many')] },
    'Scrolling Marquee': { slug: 'marquee', fields: [
      { k: 'text', label: 'Text', type: 'text', def: 'Arcade 95 — insert coin' },
      { k: 'color', label: 'Text color', type: 'color', def: '#ffff00' },
      { k: 'bg', label: 'Background color', type: 'color', def: '#000080' },
      R('speed', 'Speed', 5),
      { k: 'pos', label: 'Position', type: 'radio', def: 'random', opts: [['center', 'Centered'], ['random', 'Random']] }] },
    '3D Flower Box': { slug: 'flowerbox', fields: [R('size', 'Size', 6, 1, 10, 'Small', 'Large'), R('speed', 'Spin speed', 5), { k: 'checker', label: 'Two-tone checkered faces', type: 'check', def: true }] },
    'Curves and Colors': { slug: 'curves', fields: [
      { k: 'mode', label: 'Draw', type: 'radio', def: 'both', opts: [['both', 'Both'], ['bezier', 'Curves'], ['lissa', 'Blooms']] },
      R('count', 'Number of curves', 3, 1, 6, '1', '6'), R('speed', 'Speed', 5)] }
  };
  function getOpts(name) {
    const sc = SCHEMA[name]; if (!sc) return {};
    const saved = store.get('screensaver.' + sc.slug, {}) || {}, o = {};
    sc.fields.forEach(f => { const v = saved[f.k]; o[f.k] = v === undefined || v === null || typeof v !== typeof f.def ? f.def : v; });
    return o;
  }

  /* ================= shared math ================= */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const LIGHT = norm([0.5, 0.7, 0.9]);
  function perspective(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
  }
  function lookZ(m, camZ) { const r = m.slice(); r[14] += -camZ * m[10]; r[15] += -camZ * m[11]; return r; } // proj * translate(0,0,-camZ)
  function rotXYZ(ax, ay, az) {
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
    return [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz, cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz, -sy, sx * cy, cx * cy];
  }
  const m3 = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];

  /* Painter's-algorithm triangle fill for the 2D fallbacks. tris: [{a,b,c,col:[r,g,b]}], camera at (0,0,camZ) looking down -z. */
  function paintTris(g, tris, cx, cy, f, camZ) {
    tris.forEach(t => { t.z = t.a[2] + t.b[2] + t.c[2]; });
    tris.sort((p, q) => p.z - q.z);
    g.lineJoin = 'round'; g.lineWidth = 0.7;
    for (const t of tris) {
      let n = norm(cross(sub(t.b, t.a), sub(t.c, t.a)));
      const cen = mul(add(add(t.a, t.b), t.c), 1 / 3), v = norm(sub([0, 0, camZ], cen));
      if (dot(n, v) < 0) n = mul(n, -1);
      const d = Math.max(0, dot(n, LIGHT)), s = Math.pow(Math.max(0, dot(n, norm(add(LIGHT, v)))), 30) * 90;
      const k = 0.22 + 0.78 * d, c = t.col;
      g.fillStyle = g.strokeStyle = `rgb(${Math.min(255, c[0] * k + s) | 0},${Math.min(255, c[1] * k + s) | 0},${Math.min(255, c[2] * k + s) | 0})`;
      g.beginPath();
      [t.a, t.b, t.c].forEach((p, i) => { const q = f / (camZ - p[2]), x = cx + p[0] * q, y = cy - p[1] * q; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath(); g.fill(); g.stroke();
    }
  }
  function offscreen(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  /* ================= shared WebGL (one context, reused across runs) ================= */
  let GL = null;
  const VS = `attribute vec3 aP, aN, aC; attribute vec2 aT; uniform mat4 uPV; varying vec3 vN, vP, vC; varying vec2 vT;
    void main() { vN = aN; vP = aP; vC = aC; vT = aT; gl_Position = uPV * vec4(aP, 1.0); }`;
  const FS = `precision mediump float; varying vec3 vN, vP, vC; varying vec2 vT; uniform vec3 uEye, uL; uniform float uCheck, uFade, uShin, uSpec;
    void main() {
      vec3 n = normalize(vN), V = normalize(uEye - vP);
      if (dot(n, V) < 0.0) n = -n;
      float d = max(dot(n, uL), 0.0), s = pow(max(dot(n, normalize(uL + V)), 0.0), uShin);
      vec3 base = vC;
      if (uCheck > 0.5) base *= mix(1.0, 0.45, mod(floor(vT.x * 8.0) + floor(vT.y * 4.0), 2.0));
      gl_FragColor = vec4((base * (0.16 + 0.84 * d) + vec3(uSpec) * s) * uFade, 1.0);
    }`;
  function getGL() {
    if (GL !== null) return GL || null;
    GL = false;
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false });
      if (!gl) return null;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
      const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      const loc = {}; ['aP', 'aN', 'aC', 'aT'].forEach(n => { loc[n] = gl.getAttribLocation(prog, n); });
      ['uPV', 'uEye', 'uL', 'uCheck', 'uFade', 'uShin', 'uSpec'].forEach(n => { loc[n] = gl.getUniformLocation(prog, n); });
      const bvs = sh(gl.VERTEX_SHADER, 'attribute vec2 aQ; varying vec2 vU; void main() { vU = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }');
      const bfs = sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D uTex; varying vec2 vU; void main() { gl_FragColor = texture2D(uTex, vU); }');
      if (!bvs || !bfs) return null;
      const blit = gl.createProgram(); gl.attachShader(blit, bvs); gl.attachShader(blit, bfs); gl.linkProgram(blit);
      if (!gl.getProgramParameter(blit, gl.LINK_STATUS)) return null;
      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      GL = { cv, gl, prog, loc, blit, quad, aQ: gl.getAttribLocation(blit, 'aQ'), uTex: gl.getUniformLocation(blit, 'uTex') };
    } catch (e) { GL = false; }
    return GL || null;
  }
  const FL = 11; // floats per vertex: pos3 normal3 color3 uv2
  function glDraw(G, buf, count, pv, camZ, check, fade, shin, spec = 0.85) {
    const { gl, prog, loc } = G;
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    [['aP', 3, 0], ['aN', 3, 12], ['aC', 3, 24], ['aT', 2, 36]].forEach(([n, s, o]) => { gl.enableVertexAttribArray(loc[n]); gl.vertexAttribPointer(loc[n], s, gl.FLOAT, false, FL * 4, o); });
    gl.uniformMatrix4fv(loc.uPV, false, new Float32Array(pv));
    gl.uniform3f(loc.uEye, 0, 0, camZ); gl.uniform3f(loc.uL, LIGHT[0], LIGHT[1], LIGHT[2]);
    gl.uniform1f(loc.uCheck, check ? 1 : 0); gl.uniform1f(loc.uFade, fade); gl.uniform1f(loc.uShin, shin); gl.uniform1f(loc.uSpec, spec);
    if (count > 0) gl.drawArrays(gl.TRIANGLES, 0, count);
    ['aP', 'aN', 'aC', 'aT'].forEach(n => gl.disableVertexAttribArray(loc[n]));
  }
  function glBegin(G, w, h) {
    const gl = G.gl; gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  function Geo(cap) { this.d = new Float32Array(cap * FL); this.n = 0; this.cap = cap; }
  Geo.prototype.v = function (p, n, c, u, t) { if (this.n >= this.cap) return; this.d.set([p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], u, t], this.n++ * FL); };
  Geo.prototype.quad = function (P, N, c, T) { [0, 1, 2, 0, 2, 3].forEach(i => this.v(P[i], N[i], c, T[i][0], T[i][1])); };

  /* ================= Blank Screen ================= */
  function blank(env) { return { frame() { env.g.fillStyle = '#000'; env.g.fillRect(0, 0, env.w, env.h); } }; }

  /* ================= Starfield Simulation ================= */
  function starfield(env) {
    const { g, w, h, opts } = env, u = Math.max(1, Math.min(w, h) / 360);
    const n = env.preview ? Math.max(12, Math.round(opts.count / 4)) : opts.count, v = 0.03 + opts.speed * 0.028;
    const spawn = (s, far) => { s.x = rand(-1, 1); s.y = rand(-1, 1); s.z = far ? 1 : rand(0.04, 1); return s; };
    const stars = Array.from({ length: n }, () => spawn({}, false));
    return { frame(dt) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, f = Math.max(w, h) * 0.5;
      for (const s of stars) {
        s.z -= v * dt;
        let x = cx + s.x / s.z * f, y = cy + s.y / s.z * f;
        if (s.z <= 0.02 || x < -4 || y < -4 || x > w + 4 || y > h + 4) { spawn(s, true); continue; }
        const b = 1 - s.z, sz = Math.max(1, b * b * 3.2 * u), c = 70 + 185 * b | 0;
        g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    } };
  }

  /* ================= Mystify Your Mind ================= */
  function mystify(env) {
    const { g, w, h, opts } = env, buf = offscreen(w, h), bg = buf.getContext('2d');
    const sp = Math.min(w, h) * 0.42, lw = Math.max(1, Math.round(Math.min(w, h) / 450)), STEP = 1 / 22;
    const polys = Array.from({ length: opts.polys }, (_, i) => ({
      v: Array.from({ length: 4 }, () => ({ x: rand(0, w), y: rand(0, h), vx: rand(0.4, 1) * sp * (Math.random() < 0.5 ? -1 : 1), vy: rand(0.4, 1) * sp * (Math.random() < 0.5 ? -1 : 1) })),
      hue: i * 180 + rand(0, 90), dh: rand(25, 60), hist: []
    }));
    let acc = 0, age = 0;
    bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h);
    const outline = (pts, col) => { bg.strokeStyle = col; bg.lineWidth = lw; bg.beginPath(); pts.forEach((p, i) => (i ? bg.lineTo(p[0], p[1]) : bg.moveTo(p[0], p[1]))); bg.closePath(); bg.stroke(); };
    return { frame(dt) {
      acc += dt; age += dt;
      while (acc >= STEP) {
        acc -= STEP;
        for (const p of polys) {
          for (const q of p.v) {
            q.x += q.vx * STEP; q.y += q.vy * STEP;
            if (q.x < 0) { q.x = 0; q.vx = Math.abs(q.vx) * rand(0.85, 1.15); } else if (q.x > w) { q.x = w; q.vx = -Math.abs(q.vx) * rand(0.85, 1.15); }
            if (q.y < 0) { q.y = 0; q.vy = Math.abs(q.vy) * rand(0.85, 1.15); } else if (q.y > h) { q.y = h; q.vy = -Math.abs(q.vy) * rand(0.85, 1.15); }
            q.vx = clamp(q.vx, -sp * 1.3, sp * 1.3); q.vy = clamp(q.vy, -sp * 1.3, sp * 1.3);
          }
          p.hue += p.dh * STEP;
          p.hist.push({ pts: p.v.map(q => [q.x, q.y]), col: hsl(p.hue, 100, 55) });
          if (p.hist.length > opts.trail) p.hist.shift();
          if (!opts.clear) outline(p.hist[p.hist.length - 1].pts, p.hist[p.hist.length - 1].col);
        }
      }
      if (opts.clear) { bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h); polys.forEach(p => p.hist.forEach(e => outline(e.pts, e.col))); }
      else if (age > 40) { age = 0; bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h); }
      g.drawImage(buf, 0, 0);
    } };
  }

  /* ================= Flying Windows (original 4-pane waving flag) ================= */
  const FLAG = ['#ec3b2c', '#f7c614', '#3db83a', '#2d6fea']; // original four-stripe arcade pennant
  function flying(env) {
    const { g, w, h, opts } = env, n = env.preview ? Math.max(6, Math.round(opts.count / 2)) : opts.count, v = 0.06 + opts.speed * 0.04;
    const spawn = (f, far) => { f.x = rand(-1, 1) * 0.55; f.y = rand(-1, 1) * 0.45; f.z = far ? rand(0.9, 1.1) : rand(0.05, 1.1); f.ph = rand(0, TAU); return f; };
    const flags = Array.from({ length: n }, () => spawn({}, false));
    let t = 0;
    return { frame(dt) {
      t += dt;
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, F = Math.min(w, h) * 0.9, S = 0.07, COLS = 8;
      flags.forEach(f => { f.z -= v * dt; if (f.z < 0.03) spawn(f, true); });
      flags.slice().sort((a, b) => b.z - a.z).forEach(f => {
        const k = F / f.z; if (S * k < 1.5) { g.fillStyle = '#555'; g.fillRect(cx + f.x * k, cy + f.y * k, 1, 1); return; }
        const fog = clamp(1.25 - f.z, 0.25, 1);
        const P = (u, vv) => { const wav = Math.sin(u * 4.2 - t * 5 + f.ph) * 0.16 * u; return [cx + (f.x + (u - 0.5) * S * 1.45) * k, cy + (f.y + (vv - 0.5) * S + wav * S) * k]; };
        const quad = (a, b, v0, v1) => { const p1 = P(a, v0), p2 = P(b, v0), p3 = P(b, v1), p4 = P(a, v1); g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.lineTo(p4[0], p4[1]); g.closePath(); };
        for (let c = 0; c < COLS; c++) {
          const a = c / COLS, b = (c + 1) / COLS + 0.004, sl = Math.cos((a + b) * 2.1 - t * 5 + f.ph);
          for (let st = 0; st < 4; st++) { quad(a, b, st / 4, (st + 1) / 4 + 0.004); g.fillStyle = FLAG[st]; g.fill(); }
          const shade = (1 - fog) + (sl < 0 ? -sl * 0.4 : 0);
          quad(a, b, 0, 1);
          if (shade > 0.02) { g.globalAlpha = Math.min(0.85, shade); g.fillStyle = '#000'; g.fill(); }
          else if (sl > 0.6) { g.globalAlpha = (sl - 0.6) * 0.5; g.fillStyle = '#fff'; g.fill(); }
          g.globalAlpha = 1;
        }
      });
    } };
  }

  /* ================= Scrolling Marquee ================= */
  function marquee(env) {
    const { g, w, h, opts } = env, text = String(opts.text || ' ').slice(0, 200), fs = Math.round(h * (env.preview ? 0.28 : 0.14));
    const font = `bold ${fs}px "Times New Roman", Times, serif`;
    g.font = font; const tw = g.measureText(text).width;
    const v = w * (0.04 + opts.speed * 0.035) + fs * 0.5;
    let x = w, y = 0;
    const pickY = () => { y = opts.pos === 'center' ? h / 2 + fs * 0.35 : rand(fs, Math.max(fs, h - fs * 0.35)); };
    pickY();
    return { frame(dt) {
      g.fillStyle = opts.bg; g.fillRect(0, 0, w, h);
      g.font = font; g.fillStyle = opts.color; g.textBaseline = 'alphabetic'; g.fillText(text, x, y);
      x -= v * dt; if (x < -tw) { x = w; pickY(); }
    } };
  }

  /* ================= Curves and Colors ================= */
  function curves(env) {
    const { g, w, h, opts } = env, buf = offscreen(w, h), bg = buf.getContext('2d'), m = Math.min(w, h);
    const spd = 0.4 + opts.speed * 0.12, lw = Math.max(1, m / 380);
    let mode = opts.mode === 'lissa' ? 'lissa' : 'bezier', modeT = 0, hue = rand(0, 360), acc = 0;
    const curvesArr = Array.from({ length: opts.count }, () => Array.from({ length: 4 }, () => ({ x: rand(0, w), y: rand(0, h), vx: rand(-1, 1) * m * 0.5, vy: rand(-1, 1) * m * 0.5 })));
    let L = null;
    const newL = () => { const a = 1 + ri(5); let b = 1 + ri(6); if (b === a) b++; L = { a, b, d: rand(0, TAU), th: 0, rot: rand(0, TAU), hold: 0, last: null }; };
    newL();
    bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h);
    return { frame(dt) {
      modeT += dt; hue += dt * 40 * spd;
      if (opts.mode === 'both' && modeT > (env.preview ? 9 : 16)) { modeT = 0; mode = mode === 'bezier' ? 'lissa' : 'bezier'; newL(); bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h); }
      bg.lineWidth = lw; bg.lineCap = 'round';
      if (mode === 'bezier') {
        bg.fillStyle = `rgba(0,0,0,${clamp(dt * 1.6, 0, 1)})`; bg.fillRect(0, 0, w, h);
        acc += dt;
        while (acc > 1 / 40) {
          acc -= 1 / 40;
          curvesArr.forEach((c, i) => {
            c.forEach(p => { p.x += p.vx * spd / 40; p.y += p.vy * spd / 40; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; p.x = clamp(p.x, 0, w); p.y = clamp(p.y, 0, h); });
            bg.strokeStyle = hsl(hue + i * (360 / opts.count), 100, 60);
            bg.beginPath(); bg.moveTo(c[0].x, c[0].y); bg.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y); bg.stroke();
          });
        }
      } else {
        const RR = m * 0.42, cx = w / 2, cy = h / 2;
        if (L.th < TAU) {
          const steps = 40, end = Math.min(TAU, L.th + dt * spd * 1.1);
          for (let s = 0; s < steps; s++) {
            const th = L.th + (end - L.th) * (s + 1) / steps;
            for (let k = 0; k < opts.count; k++) {
              const sc = 1 - k * 0.16, rt = L.rot + k * 0.35;
              const x0 = Math.sin(L.a * th + L.d) * RR * sc, y0 = Math.sin(L.b * th) * RR * sc;
              const x = cx + x0 * Math.cos(rt) - y0 * Math.sin(rt), y = cy + x0 * Math.sin(rt) + y0 * Math.cos(rt);
              const key = 'p' + k, prev = L[key];
              if (prev) { bg.strokeStyle = hsl(hue + th * 57 + k * 40, 100, 60); bg.beginPath(); bg.moveTo(prev[0], prev[1]); bg.lineTo(x, y); bg.stroke(); }
              L[key] = [x, y];
            }
          }
          L.th = end;
        } else {
          L.hold += dt;
          bg.fillStyle = `rgba(0,0,0,${clamp(dt * (L.hold > 1.5 ? 3 : 0.3), 0, 1)})`; bg.fillRect(0, 0, w, h);
          if (L.hold > 2.6) newL();
        }
      }
      g.drawImage(buf, 0, 0);
    } };
  }

  /* ================= 3D Pipes ================= */
  const PIPE_COLS = [[0.9, 0.1, 0.1], [0.1, 0.75, 0.15], [0.15, 0.35, 0.95], [0.95, 0.85, 0.1], [0.1, 0.85, 0.9], [0.9, 0.2, 0.85], [0.95, 0.5, 0.1], [0.85, 0.85, 0.85]];
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const PR = 0.17, BALL = 0.27;
  function PipeSim(opts, aspect) {
    const GY = 9, GZ = 9, GX = clamp(Math.round(GY * aspect), 6, 20), N = GX * GY * GZ;
    const occ = new Uint8Array(N), idx = (i, j, k) => (i * GY + j) * GZ + k;
    const inside = c => c[0] >= 0 && c[1] >= 0 && c[2] >= 0 && c[0] < GX && c[1] < GY && c[2] < GZ;
    const free = c => inside(c) && !occ[idx(c[0], c[1], c[2])];
    const P = c => [c[0] - (GX - 1) / 2, c[1] - (GY - 1) / 2, c[2] - (GZ - 1) / 2];
    const multi = opts.mode !== 'single', limit = multi ? 22 : 11, rate = 4 + opts.speed * 2.2;
    const sim = { GX, GY, GZ, out: [], fade: 0, resetNow: false, pipes: [], made: 0, filled: 0, acc: 0, colorI: ri(PIPE_COLS.length) };
    function spawn() {
      for (let tries = 0; tries < 60; tries++) {
        const c = [ri(GX), ri(GY), ri(GZ)]; if (!free(c)) continue;
        occ[idx(...c)] = 1; sim.filled++;
        sim.pipes.push({ c, din: null, col: PIPE_COLS[sim.colorI++ % PIPE_COLS.length] }); sim.made++; return;
      }
      sim.made = limit;
    }
    function step(p) {
      const opt = DIRS.filter(d => free(add(p.c, d)));
      const C = P(p.c), col = p.col;
      if (!opt.length) {
        if (p.din) sim.out.push({ t: 'cyl', a: sub(C, mul(p.din, 0.5)), b: C, col }, { t: 'ball', c: C, r: PR, col });
        else sim.out.push({ t: 'ball', c: C, r: BALL, col });
        p.dead = true; return;
      }
      const d = p.din && opt.includes(p.din) && Math.random() < 0.72 ? p.din : opt[ri(opt.length)];
      const h = mul(d, 0.5);
      if (!p.din) sim.out.push({ t: 'ball', c: C, r: BALL, col }, { t: 'cyl', a: C, b: add(C, h), col });
      else if (d === p.din) sim.out.push({ t: 'cyl', a: sub(C, h), b: add(C, h), col });
      else {
        const jt = opts.joint === 'mixed' ? (Math.random() < 0.5 ? 'elbow' : 'ball') : opts.joint;
        if (jt === 'elbow') sim.out.push({ t: 'elbow', c: C, din: p.din, dout: d, col });
        else sim.out.push({ t: 'cyl', a: sub(C, mul(p.din, 0.5)), b: C, col }, { t: 'ball', c: C, r: BALL, col }, { t: 'cyl', a: C, b: add(C, h), col });
      }
      p.c = add(p.c, d); p.din = d; occ[idx(...p.c)] = 1; sim.filled++;
    }
    sim.update = dt => {
      if (sim.fade > 0) { sim.fade -= dt; if (sim.fade <= 0) { occ.fill(0); sim.pipes = []; sim.made = 0; sim.filled = 0; sim.resetNow = true; } return; }
      sim.acc += dt * rate;
      let guard = 0;
      while (sim.acc >= 1 && guard++ < 8) {
        sim.acc -= 1;
        sim.pipes.forEach(step);
        sim.pipes = sim.pipes.filter(p => !p.dead);
        const full = sim.filled > N * 0.42 || sim.made >= limit;
        if (!full && (sim.pipes.length === 0 || (multi && sim.pipes.length < 4 && Math.random() < 0.06))) spawn();
        if (full && sim.pipes.length === 0) { sim.fade = 1.2; return; }
      }
    };
    return sim;
  }
  function pipeCamera(sim, aspect) { const fov = 0.8; return { fov, camZ: (sim.GY / 2 + 0.6) / Math.tan(fov / 2) + sim.GZ / 2 }; }

  function pipesGL(env) {
    const G = getGL(); if (!G) return null;
    const { gl, w, h, opts } = env, aspect = w / h, sim = PipeSim(opts, aspect), cam = pipeCamera(sim, aspect);
    const pv = lookZ(perspective(cam.fov, aspect, 0.5, 80), cam.camZ);
    const geo = new Geo(60000), buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, geo.d.byteLength, gl.DYNAMIC_DRAW);
    // Pipes accumulate in an offscreen framebuffer (color texture + depth), so a frame only draws what grew, then one blit.
    const tex = gl.createTexture(), rb = gl.createRenderbuffer(), fb = gl.createFramebuffer();
    const free3 = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); gl.deleteTexture(tex); gl.deleteBuffer(buf); };
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { free3(); return null; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const S = 14;
    const basis = d => { const e1 = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])); return [e1, cross(d, e1)]; };
    function cyl(a, b, col) {
      const d = norm(sub(b, a)), [e1, e2] = basis(d), len = Math.hypot(...sub(b, a));
      for (let i = 0; i < S; i++) {
        const t0 = i / S * TAU, t1 = (i + 1) / S * TAU, n0 = add(mul(e1, Math.cos(t0)), mul(e2, Math.sin(t0))), n1 = add(mul(e1, Math.cos(t1)), mul(e2, Math.sin(t1)));
        geo.quad([add(a, mul(n0, PR)), add(b, mul(n0, PR)), add(b, mul(n1, PR)), add(a, mul(n1, PR))], [n0, n0, n1, n1], col, [[i / S, 0], [i / S, len], [(i + 1) / S, len], [(i + 1) / S, 0]]);
      }
    }
    function ball(c, r, col) {
      const ST = 8, SL = 14, pt = (i, j) => { const th = j / ST * Math.PI, ph = i / SL * TAU; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };
      for (let j = 0; j < ST; j++) for (let i = 0; i < SL; i++) {
        const N4 = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)];
        geo.quad(N4.map(n => add(c, mul(n, r))), N4, col, [[i / SL, j / ST], [i / SL, (j + 1) / ST], [(i + 1) / SL, (j + 1) / ST], [(i + 1) / SL, j / ST]]);
      }
    }
    function elbow(C, din, dout, col) {
      const O = add(sub(C, mul(din, 0.5)), mul(dout, 0.5)), b = cross(din, dout), K = 7, RB = 0.5;
      const ring = k => { const ph = k / K * Math.PI / 2, q = add(mul(dout, -Math.cos(ph)), mul(din, Math.sin(ph))); return { c: add(O, mul(q, RB)), q }; };
      for (let k = 0; k < K; k++) {
        const r0 = ring(k), r1 = ring(k + 1);
        for (let i = 0; i < S; i++) {
          const t0 = i / S * TAU, t1 = (i + 1) / S * TAU;
          const n00 = add(mul(r0.q, Math.cos(t0)), mul(b, Math.sin(t0))), n01 = add(mul(r0.q, Math.cos(t1)), mul(b, Math.sin(t1)));
          const n10 = add(mul(r1.q, Math.cos(t0)), mul(b, Math.sin(t0))), n11 = add(mul(r1.q, Math.cos(t1)), mul(b, Math.sin(t1)));
          const v0 = k / K * 0.785, v1 = (k + 1) / K * 0.785;
          geo.quad([add(r0.c, mul(n00, PR)), add(r1.c, mul(n10, PR)), add(r1.c, mul(n11, PR)), add(r0.c, mul(n01, PR))], [n00, n10, n11, n01], col, [[i / S, v0], [i / S, v1], [(i + 1) / S, v1], [(i + 1) / S, v0]]);
        }
      }
    }
    // The reset is the NT-style dissolve: random screen blocks are scissor-cleared until the screen is black.
    const BX = 16, BY = 10, order = [];
    let cleared = true, dissolve = 0;
    return { frame(dt) {
      sim.update(dt);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 1);
      if (cleared) { cleared = false; gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
      if (sim.fade > 0) {
        if (!order.length && !dissolve) { for (let i = 0; i < BX * BY; i++) order.push(i); order.sort(() => Math.random() - 0.5); dissolve = order.length; }
        const n = Math.ceil(dissolve * clamp(dt / 1.1, 0, 1));
        gl.enable(gl.SCISSOR_TEST);
        for (let i = 0; i < n && order.length; i++) { const b = order.pop(), bx = b % BX, by = (b / BX) | 0, x0 = Math.floor(bx * w / BX), y0 = Math.floor(by * h / BY); gl.scissor(x0, y0, Math.floor((bx + 1) * w / BX) - x0, Math.floor((by + 1) * h / BY) - y0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
        gl.disable(gl.SCISSOR_TEST);
      }
      if (sim.resetNow) { sim.resetNow = false; order.length = 0; dissolve = 0; cleared = true; }
      geo.n = 0;
      while (sim.out.length) {
        const p = sim.out.shift();
        if (p.t === 'cyl') cyl(p.a, p.b, p.col); else if (p.t === 'ball') ball(p.c, p.r, p.col); else elbow(p.c, p.din, p.dout, p.col);
      }
      if (geo.n) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, geo.d.subarray(0, geo.n * FL)); glDraw(G, buf, geo.n, pv, cam.camZ, opts.tex === 'checker', 1, 60); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(G.blit); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(G.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.quad); gl.enableVertexAttribArray(G.aQ); gl.vertexAttribPointer(G.aQ, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(G.aQ);
    }, dispose: free3 };
  }

  function pipes2d(env) {
    const { g, w, h, opts } = env, aspect = w / h, sim = PipeSim(opts, aspect), cam = pipeCamera(sim, aspect);
    const buf = offscreen(w, h), bg = buf.getContext('2d'), f = h / 2 / Math.tan(cam.fov / 2), cx = w / 2, cy = h / 2;
    const prj = p => { const k = f / (cam.camZ - p[2]); return [cx + p[0] * k, cy - p[1] * k, k]; };
    const rgb = (c, k, add2 = 0) => `rgb(${Math.min(255, c[0] * 255 * k + add2) | 0},${Math.min(255, c[1] * 255 * k + add2) | 0},${Math.min(255, c[2] * 255 * k + add2) | 0})`;
    bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h); bg.lineCap = 'round'; bg.lineJoin = 'round';
    function tube(path, col, wpx) {
      const layers = [[1, 0.35, 0], [0.72, 0.8, 0], [0.32, 1, 70]];
      layers.forEach(([wf, k, a2], li) => {
        bg.strokeStyle = rgb(col, k, a2); bg.lineWidth = Math.max(1, wpx * wf);
        const o = li === 2 ? -wpx * 0.16 : 0;
        bg.beginPath(); path(o); bg.stroke();
      });
    }
    function draw(p) {
      const col = p.col;
      if (p.t === 'ball') {
        const [x, y, k] = prj(p.c), r = Math.max(1, p.r * k);
        const gr = bg.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        gr.addColorStop(0, rgb(col, 1, 120)); gr.addColorStop(0.5, rgb(col, 0.85)); gr.addColorStop(1, rgb(col, 0.3));
        bg.fillStyle = gr; bg.beginPath(); bg.arc(x, y, r, 0, TAU); bg.fill(); return;
      }
      if (p.t === 'cyl') {
        const a = prj(p.a), b = prj(p.b);
        tube(o => { bg.moveTo(a[0] + o, a[1] + o); bg.lineTo(b[0] + o, b[1] + o); }, col, PR * 2 * (a[2] + b[2]) / 2); return;
      }
      const a = prj(sub(p.c, mul(p.din, 0.5))), c = prj(p.c), b = prj(add(p.c, mul(p.dout, 0.5)));
      tube(o => { bg.moveTo(a[0] + o, a[1] + o); bg.quadraticCurveTo(c[0] + o, c[1] + o, b[0] + o, b[1] + o); }, col, PR * 2 * c[2]);
    }
    return { frame(dt) {
      sim.update(dt);
      if (sim.resetNow) { sim.resetNow = false; bg.globalAlpha = 1; bg.fillStyle = '#000'; bg.fillRect(0, 0, w, h); }
      while (sim.out.length) draw(sim.out.shift());
      if (sim.fade > 0) { bg.fillStyle = `rgba(0,0,0,${clamp(dt * 3, 0, 1)})`; bg.fillRect(0, 0, w, h); }
      g.drawImage(buf, 0, 0);
    } };
  }

  /* ================= 3D Flower Box ================= */
  const FACES = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  const FCOL = [[0.95, 0.15, 0.15], [0.15, 0.8, 0.2], [0.2, 0.35, 0.95], [0.95, 0.85, 0.1], [0.9, 0.2, 0.85], [0.1, 0.85, 0.9]];
  function FlowerSim(env) {
    const { opts } = env, spin = 0.3 + opts.speed * 0.13, scale = 0.25 + opts.size * 0.07;
    const st = { t: rand(0, 10), x: 0, y: 0, vx: rand(0.5, 0.9) * (Math.random() < 0.5 ? -1 : 1), vy: rand(0.4, 0.7), ax: 0, ay: 0, az: 0, scale };
    st.update = (dt, halfW, halfH) => {
      st.t += dt; st.ax += dt * spin * 0.7; st.ay += dt * spin; st.az += dt * spin * 0.4;
      const lim = scale * 2.5;
      st.x += st.vx * dt; st.y += st.vy * dt;
      if (Math.abs(st.x) > halfW - lim) { st.x = Math.sign(st.x) * (halfW - lim); st.vx *= -1; }
      if (Math.abs(st.y) > halfH - lim) { st.y = Math.sign(st.y) * (halfH - lim); st.vy *= -1; }
      if (halfW < lim) st.x = 0; if (halfH < lim) st.y = 0;
    };
    st.tris = (N, emit) => {
      const s = Math.sin(st.t * 0.55), a = Math.min(1, Math.abs(s) * 1.4), rot = rotXYZ(st.ax, st.ay, st.az);
      const T = [st.x, st.y, 0];
      FACES.forEach(([n, su, sv], fi) => {
        const grid = [];
        for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
          const u = -1 + 2 * i / N, v = -1 + 2 * j / N, p = add(n, add(mul(su, u), mul(sv, v)));
          const k = Math.pow(1 - Math.max(Math.abs(u), Math.abs(v)), 1.5), d = norm(p);
          const tgt = mul(d, 1.05 + s * 1.25 * k);
          grid.push(add(mul(m3(rot, add(mul(p, 1 - a), mul(tgt, a))), scale), T));
        }
        const c = FCOL[fi], c2 = opts.checker ? c.map(x => x * 0.45 + 0.5) : c;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const q = [grid[j * (N + 1) + i], grid[j * (N + 1) + i + 1], grid[(j + 1) * (N + 1) + i + 1], grid[(j + 1) * (N + 1) + i]];
          const col = (i + j) % 2 ? c2 : c;
          emit(q[0], q[1], q[2], col); emit(q[0], q[2], q[3], col);
        }
      });
    };
    return st;
  }
  function flowerGL(env) {
    const G = getGL(); if (!G) return null;
    const { gl, w, h } = env, aspect = w / h, fov = 0.8, camZ = 6, sim = FlowerSim(env), N = 8;
    const pv = lookZ(perspective(fov, aspect, 0.5, 40), camZ), geo = new Geo(6 * N * N * 6), buf = gl.createBuffer();
    const halfH = Math.tan(fov / 2) * camZ, halfW = halfH * aspect;
    return { frame(dt) {
      sim.update(dt, halfW, halfH); geo.n = 0;
      sim.tris(N, (a, b, c, col) => { const n = norm(cross(sub(b, a), sub(c, a))); geo.v(a, n, col, 0, 0); geo.v(b, n, col, 0, 0); geo.v(c, n, col, 0, 0); });
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, geo.d.subarray(0, geo.n * FL), gl.DYNAMIC_DRAW);
      glBegin(G, w, h); glDraw(G, buf, geo.n, pv, camZ, false, 1, 50, 0.35);
    }, dispose() { gl.deleteBuffer(buf); } };
  }
  function flower2d(env) {
    const { g, w, h } = env, fov = 0.8, camZ = 6, sim = FlowerSim(env), N = env.preview ? 4 : 6;
    const f = h / 2 / Math.tan(fov / 2), halfH = Math.tan(fov / 2) * camZ, halfW = halfH * w / h;
    return { frame(dt) {
      sim.update(dt, halfW, halfH);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const tris = []; sim.tris(N, (a, b, c, col) => tris.push({ a, b, c, col: col.map(x => x * 255) }));
      paintTris(g, tris, w / 2, h / 2, f, camZ);
    } };
  }

  /* ================= 3D Maze (raycaster) ================= */
  let TEX = null;
  function texFrom(draw, noise = 0, S = 64) {
    const c = offscreen(S, S), x = c.getContext('2d'); draw(x, S);
    const id = x.getImageData(0, 0, S, S), d = id.data;
    if (noise) for (let i = 0; i < d.length; i += 4) { const r = (Math.random() - 0.5) * noise; d[i] = clamp(d[i] + r, 0, 255); d[i + 1] = clamp(d[i + 1] + r, 0, 255); d[i + 2] = clamp(d[i + 2] + r, 0, 255); }
    return new Uint32Array(d.buffer.slice(0));
  }
  function textures() {
    if (TEX) return TEX;
    const disc = (x, S, fill, ring) => { x.fillStyle = ring; x.beginPath(); x.arc(S / 2, S / 2, S * 0.46, 0, TAU); x.fill(); x.fillStyle = fill; x.beginPath(); x.arc(S / 2, S / 2, S * 0.4, 0, TAU); x.fill(); };
    TEX = {
      brick: texFrom((x, S) => {
        x.fillStyle = '#8d877c'; x.fillRect(0, 0, S, S);
        for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
          const off = r % 2 ? 16 : 0, l = 30 + ri(40);
          x.fillStyle = `rgb(${150 + l},${52 + l / 3},${36 + l / 4})`; x.fillRect(c * 32 + off + 1, r * 16 + 1, 30, 14);
          x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(c * 32 + off + 1, r * 16 + 13, 30, 2);
          x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(c * 32 + off + 1, r * 16 + 1, 30, 1);
        }
      }, 26),
      floor: texFrom((x, S) => { x.fillStyle = '#5d6170'; x.fillRect(0, 0, S, S); x.fillStyle = '#4e5260'; for (let i = 0; i < S; i += 8) for (let j = (i / 8) % 2 * 8; j < S; j += 16) x.fillRect(i, j, 8, 8); }, 22),
      ceil: texFrom((x, S) => { x.fillStyle = '#c9c6bc'; x.fillRect(0, 0, S, S); x.fillStyle = '#8e8b82'; x.fillRect(0, 0, S, 2); x.fillRect(0, 0, 2, S); x.fillRect(0, 31, S, 2); x.fillRect(31, 0, 2, S); }, 14),
      smiley: texFrom((x, S) => {
        disc(x, S, '#ffd51e', '#1b1b1b');
        x.fillStyle = '#1b1b1b'; x.fillRect(22, 20, 6, 10); x.fillRect(36, 20, 6, 10);
        x.strokeStyle = '#1b1b1b'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 15, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      }),
      rat: texFrom((x) => {
        x.fillStyle = '#d98a8a'; x.lineWidth = 2; x.strokeStyle = '#d98a8a'; x.beginPath(); x.moveTo(12, 52); x.quadraticCurveTo(2, 40, 8, 30); x.stroke();
        x.fillStyle = '#8b8d93'; x.beginPath(); x.ellipse(28, 50, 17, 10, 0, 0, TAU); x.fill();
        x.beginPath(); x.moveTo(40, 42); x.lineTo(58, 52); x.lineTo(40, 58); x.fill();
        x.fillStyle = '#b5b7bd'; x.beginPath(); x.arc(40, 40, 6, 0, TAU); x.fill();
        x.fillStyle = '#e59a9a'; x.beginPath(); x.arc(40, 40, 3, 0, TAU); x.fill();
        x.fillStyle = '#000'; x.fillRect(46, 46, 3, 3); x.fillStyle = '#ff8fa0'; x.fillRect(57, 51, 3, 3);
        x.fillStyle = '#6e7076'; x.fillRect(20, 58, 4, 4); x.fillRect(34, 58, 4, 4);
      }),
      badge: texFrom((x, S) => {
        disc(x, S, '#ffd23f', '#0a1a86');
        x.fillStyle = '#0a1a86'; x.font = 'bold 26px Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('95', S / 2, S / 2 + 1);
      }),
      badgeBack: texFrom((x, S) => {
        disc(x, S, '#1d8ad6', '#ffd23f');
        x.fillStyle = '#ffd23f'; x.fillRect(22, 36, 20, 8); x.fillRect(30, 20, 4, 17); x.fillStyle = '#e33'; x.beginPath(); x.arc(32, 19, 5, 0, TAU); x.fill();
      }),
      exit: texFrom((x, S) => {
        x.fillStyle = '#0f0f0f'; x.fillRect(4, 16, S - 8, 30); x.fillStyle = '#0e9a2e'; x.fillRect(6, 18, S - 12, 26);
        x.fillStyle = '#fff'; x.font = 'bold 15px Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EXIT', S / 2, 31);
        x.fillStyle = '#333'; x.fillRect(14, 0, 2, 16); x.fillRect(S - 16, 0, 2, 16);
      })
    };
    return TEX;
  }
  function genMaze(W, H) {
    const TW = W * 2 + 1, TH = H * 2 + 1, map = new Uint8Array(TW * TH).fill(1), seen = new Uint8Array(W * H);
    const stack = [[0, 0]]; seen[0] = 1; map[TW + 1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H && !seen[y * W + x]);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = nb[ri(nb.length)];
      seen[ny * W + nx] = 1; map[(cy * 2 + 1 + dy) * TW + cx * 2 + 1 + dx] = 0; map[(ny * 2 + 1) * TW + nx * 2 + 1] = 0; stack.push([nx, ny]);
    }
    return { TW, TH, map };
  }
  function maze(env) {
    const { g, w, h, opts } = env, T = textures();
    const RW = env.preview ? Math.max(40, Math.round(w)) : clamp(Math.round(w / 3), 160, 420), RH = Math.max(30, Math.round(RW * h / w));
    const off = offscreen(RW, RH), og = off.getContext('2d'), img = og.createImageData(RW, RH), px = new Uint32Array(img.data.buffer), zb = new Float32Array(RW);
    const CW = env.preview ? 5 : { small: 6, medium: 9, large: 13 }[opts.size] || 9;
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], mv = 0.62 - opts.speed * 0.045, tv = mv * 0.75;
    let M, ag, sprites, rats, flip = 0, flipTo = 0, spin = 0;
    const free = (x, y) => x >= 0 && y >= 0 && x < M.TW && y < M.TH && !M.map[y * M.TW + x];
    function newMaze() {
      M = genMaze(CW, CW);
      const dist = new Int32Array(M.TW * M.TH).fill(-1), q = [[1, 1]]; dist[M.TW + 1] = 0; let far = [1, 1];
      while (q.length) { const [x, y] = q.shift(); far = [x, y]; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (free(nx, ny) && dist[ny * M.TW + nx] < 0) { dist[ny * M.TW + nx] = dist[y * M.TW + x] + 1; q.push([nx, ny]); } } }
      const d0 = [0, 1, 2, 3].find(d => free(1 + DX[d], 1 + DY[d]));
      ag = { tx: 1, ty: 1, d: d0, x: 1.5, y: 1.5, a: d0 * Math.PI / 2, act: null, force: false };
      const cells = []; for (let y = 1; y < M.TH; y += 2) for (let x = 1; x < M.TW; x += 2) if (!(x === 1 && y === 1) && !(x === far[0] && y === far[1])) cells.push([x, y]);
      const take = () => cells.splice(ri(cells.length), 1)[0] || [1, 1];
      sprites = [{ x: far[0] + 0.5, y: far[1] + 0.5, tex: T.exit, sc: 0.55, vo: -0.3, exit: true }];
      for (let i = 0; i < 3; i++) { const c = take(); sprites.push({ x: c[0] + 0.5, y: c[1] + 0.5, tex: T.smiley, sc: 0.6, vo: 0 }); }
      for (let i = 0; i < (env.preview ? 1 : 2); i++) { const c = take(); sprites.push({ x: c[0] + 0.5, y: c[1] + 0.5, tex: T.badge, back: T.badgeBack, sc: 0.5, vo: 0, badge: true, tx: c[0], ty: c[1] }); }
      rats = [];
      if (opts.rats) for (let i = 0; i < 2; i++) { const c = take(); const r = { tx: c[0], ty: c[1], fx: c[0], fy: c[1], t: 1, d: 0, tex: T.rat, sc: 0.36, vo: 0.32, x: c[0] + 0.5, y: c[1] + 0.5 }; rats.push(r); sprites.push(r); }
      if (env.preview) { flip = 0; flipTo = 0; }
    }
    newMaze();
    const ease = t => t * t * (3 - 2 * t);
    function think() {
      const r = (ag.d + 1) & 3, f = ag.d;
      if (ag.force || (!free(ag.tx + DX[r], ag.ty + DY[r]) && free(ag.tx + DX[f], ag.ty + DY[f]))) { ag.force = false; ag.act = { k: 'm', t: 0, fx: ag.tx, fy: ag.ty, nx: ag.tx + DX[f], ny: ag.ty + DY[f] }; }
      else if (free(ag.tx + DX[r], ag.ty + DY[r])) { ag.act = { k: 't', t: 0, a0: ag.a, a1: ag.a + Math.PI / 2, d: r }; ag.force = true; }
      else ag.act = { k: 't', t: 0, a0: ag.a, a1: ag.a - Math.PI / 2, d: (ag.d + 3) & 3 };
    }
    function update(dt) {
      spin += dt * 2.6;
      flip += clamp(flipTo - flip, -dt * 2.4, dt * 2.4);
      if (!ag.act) think();
      const a = ag.act; a.t += dt / (a.k === 'm' ? mv : tv);
      const k = Math.min(1, a.t);
      if (a.k === 'm') { ag.x = a.fx + 0.5 + (a.nx - a.fx) * k; ag.y = a.fy + 0.5 + (a.ny - a.fy) * k; }
      else ag.a = a.a0 + (a.a1 - a.a0) * ease(k);
      if (a.t >= 1) {
        ag.act = null;
        if (a.k === 't') ag.d = a.d;
        else {
          ag.tx = a.nx; ag.ty = a.ny;
          const b = sprites.find(s => s.badge && s.tx === ag.tx && s.ty === ag.ty);
          if (b) { sprites.splice(sprites.indexOf(b), 1); flipTo = flipTo ? 0 : Math.PI; }
          if (sprites.some(s => s.exit && Math.floor(s.x) === ag.tx && Math.floor(s.y) === ag.ty)) { newMaze(); return; }
        }
      }
      for (const r of rats) {
        r.t += dt * 1.3;
        if (r.t >= 1) {
          r.fx = r.tx; r.fy = r.ty;
          let opt = [0, 1, 2, 3].filter(d => free(r.tx + DX[d], r.ty + DY[d]) && d !== ((r.d + 2) & 3));
          if (!opt.length) opt = [(r.d + 2) & 3];
          r.d = opt[ri(opt.length)]; r.tx += DX[r.d]; r.ty += DY[r.d]; r.t = 0;
        }
        r.x = r.fx + 0.5 + (r.tx - r.fx) * r.t; r.y = r.fy + 0.5 + (r.ty - r.fy) * r.t;
      }
    }
    const shade = (c, f) => 0xff000000 | (((c >>> 16) & 255) * f) << 16 | (((c >>> 8) & 255) * f) << 8 | ((c & 255) * f);
    const fog = d => clamp(1.15 - d * 0.085, 0.18, 1);
    function render() {
      const dirX = Math.cos(ag.a), dirY = Math.sin(ag.a), plX = -dirY * 0.66, plY = dirX * 0.66, H2 = RH / 2;
      const rx0 = dirX - plX, ry0 = dirY - plY, rx1 = dirX + plX, ry1 = dirY + plY;
      for (let y = Math.floor(H2) + 1; y < RH; y++) {
        const rd = H2 / (y - H2), sx = rd * (rx1 - rx0) / RW, sy = rd * (ry1 - ry0) / RW, f = fog(rd);
        let fx = ag.x + rd * rx0, fy = ag.y + rd * ry0;
        const ro = y * RW, co = (RH - 1 - y) * RW;
        for (let x = 0; x < RW; x++, fx += sx, fy += sy) {
          const ti = (((fy * 64) & 63) << 6) | ((fx * 64) & 63);
          px[ro + x] = shade(T.floor[ti], f); px[co + x] = shade(T.ceil[ti], f);
        }
      }
      for (let x = 0; x < RW; x++) {
        const cam = 2 * x / RW - 1, rdx = dirX + plX * cam, rdy = dirY + plY * cam;
        let mx = Math.floor(ag.x), my = Math.floor(ag.y);
        const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy), stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
        let sdx = rdx < 0 ? (ag.x - mx) * ddx : (mx + 1 - ag.x) * ddx, sdy = rdy < 0 ? (ag.y - my) * ddy : (my + 1 - ag.y) * ddy, side = 0, n = 0;
        while (n++ < 64) { if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; } if (!free(mx, my)) break; }
        const pd = Math.max(0.05, side ? sdy - ddy : sdx - ddx); zb[x] = pd;
        let wx = side ? ag.x + pd * rdx : ag.y + pd * rdy; wx -= Math.floor(wx);
        let tx = (wx * 64) | 0; if ((!side && rdx > 0) || (side && rdy < 0)) tx = 63 - tx;
        const lh = RH / pd, y0 = Math.max(0, Math.floor(H2 - lh / 2)), y1 = Math.min(RH - 1, Math.floor(H2 + lh / 2)), st = 64 / lh, f = fog(pd) * (side ? 0.72 : 1);
        let tp = (y0 - H2 + lh / 2) * st;
        for (let y = y0; y <= y1; y++, tp += st) px[y * RW + x] = shade(T.brick[(((tp | 0) & 63) << 6) | tx], f);
      }
      const inv = 1 / (plX * dirY - dirX * plY);
      sprites.map(s => ({ s, d: (s.x - ag.x) ** 2 + (s.y - ag.y) ** 2 })).sort((a, b) => b.d - a.d).forEach(({ s }) => {
        const sx = s.x - ag.x, sy = s.y - ag.y, tX = inv * (dirY * sx - dirX * sy), tY = inv * (-plY * sx + plX * sy);
        if (tY < 0.15) return;
        const scx = RW / 2 * (1 + tX / tY), shh = Math.abs(RH / tY) * s.sc;
        let swf = 1, tex = s.tex, mirror = false;
        if (s.badge) { const c = Math.cos(spin); swf = Math.max(0.06, Math.abs(c)); if (c < 0) { tex = s.back; mirror = true; } }
        const sw = shh * swf, top = H2 - shh / 2 + s.vo * RH / tY, left = scx - sw / 2, f = fog(tY);
        const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(RW - 1, Math.floor(scx + sw / 2)), y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(RH - 1, Math.floor(top + shh));
        for (let x = x0; x <= x1; x++) {
          if (tY >= zb[x]) continue;
          let tx = ((x - left) * 64 / sw) | 0; if (mirror) tx = 63 - tx; tx = clamp(tx, 0, 63);
          for (let y = y0; y <= y1; y++) { const c = tex[(clamp(((y - top) * 64 / shh) | 0, 0, 63) << 6) | tx]; if ((c >>> 24) > 128) px[y * RW + x] = shade(c, f); }
        }
      });
      og.putImageData(img, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h / 2); g.rotate(flip);
      const sc = 1 + (Math.hypot(w, h) / Math.min(w, h) - 1) * Math.abs(Math.sin(flip)); g.scale(sc, sc);
      g.imageSmoothingEnabled = false; g.drawImage(off, -w / 2, -h / 2, w, h); g.restore();
    }
    return { frame(dt) { update(Math.min(dt, 0.25)); render(); }, _maze: () => ({ ag, flipTo, sprites: sprites.length }) };
  }

  /* ================= registry ================= */
  const SAVERS = {
    'Blank Screen': { make: blank },
    '3D Pipes': { make: pipes2d, gl: pipesGL },
    '3D Maze': { make: maze, px: true },
    'Starfield Simulation': { make: starfield },
    'Mystify Your Mind': { make: mystify },
    'Flying Windows': { make: flying },
    'Scrolling Marquee': { make: marquee },
    '3D Flower Box': { make: flower2d, gl: flowerGL },
    'Curves and Colors': { make: curves }
  };

  /* ================= previews ================= */
  const previews = new WeakMap();
  function drawPreview(name, g, w, h, t) {
    if (!g) return;
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (!SAVERS[name]) {
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--desk').trim() || '#0b7a78'; g.fillRect(0, 0, w, h); return;
    }
    const key = name + '|' + w + 'x' + h + '|' + JSON.stringify(getOpts(name));
    let st = previews.get(g);
    if (!st || st.key !== key || t < st.t - 0.5) {
      try { st = { key, t, inst: SAVERS[name].make({ g, w, h, opts: getOpts(name), preview: true }) }; } catch (e) { console.error(e); return; }
      previews.set(g, st);
    }
    const dt = clamp(t - st.t, 0, 0.1); st.t = t;
    g.save();
    try { st.inst.frame(dt * (rmq.matches ? 0.5 : 1)); } catch (e) { console.error(e); }
    g.restore();
  }

  /* ================= fullscreen run ================= */
  let run = null, lastAct = performance.now(), lastXY = null, swallowUntil = 0;
  function build() {
    const r = run, def = SAVERS[r.name], opts = getOpts(r.name);
    if (r.inst && r.inst.dispose) try { r.inst.dispose(); } catch (e) { /* ignore */ }
    r.inst = null;
    if (r.cv) r.cv.remove();
    const W = innerWidth, H = innerHeight;
    if (def.gl && !api._noGL) {
      const G = getGL();
      if (G) {
        const dpr = Math.min(devicePixelRatio || 1, 1.5);
        G.cv.width = Math.round(W * dpr); G.cv.height = Math.round(H * dpr);
        try { r.inst = def.gl({ gl: G.gl, w: G.cv.width, h: G.cv.height, opts }); } catch (e) { r.inst = null; }
        if (r.inst) { r.cv = G.cv; r.veil.prepend(G.cv); r.veil.classList.remove('ss-px'); return; }
      }
    }
    const cv = document.createElement('canvas'), dpr = def.px ? 1 : Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    r.veil.classList.toggle('ss-px', !!def.px);
    r.cv = cv; r.veil.prepend(cv);
    r.inst = def.make({ g: cv.getContext('2d'), w: cv.width, h: cv.height, opts, preview: false });
  }
  function frame(dt) {
    if (!run) return;
    try { run.inst.frame(dt * (rmq.matches ? 0.5 : 1)); } catch (e) { console.error(e); stop(); }
  }
  function tick(now) {
    if (!run) return;
    const dt = Math.min(0.1, Math.max(0, (now - run.last) / 1000)); run.last = now;
    frame(dt);
    if (run) run.raf = requestAnimationFrame(tick);
  }
  function start(name, idle = false) {
    stop();
    if (!SAVERS[name]) return false;
    const veil = document.createElement('div'); veil.className = 'ss-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
    run = { name, idle: !!idle, veil, cv: null, inst: null, t0: performance.now(), last: performance.now(), base: lastXY ? lastXY.slice() : null };
    try { build(); } catch (e) { console.error(e); stop(); return false; }
    frame(0);
    if (run) run.raf = requestAnimationFrame(tick);
    return true;
  }
  function stop() {
    if (!run) return;
    const r = run; run = null;
    cancelAnimationFrame(r.raf);
    if (r.inst && r.inst.dispose) try { r.inst.dispose(); } catch (e) { /* ignore */ }
    if (r.cv && GL && r.cv === GL.cv) r.cv.remove();
    r.veil.remove();
    lastAct = performance.now();
  }
  addEventListener('resize', () => { if (!run) return; clearTimeout(run.rz); run.rz = setTimeout(() => { if (run) try { build(); } catch (e) { console.error(e); stop(); } }, 150); });

  /* ---------- password ---------- */
  function showPassword() {
    const r = run; if (!r || r.pw) return;
    const wrap = document.createElement('div'); wrap.className = 'ss-pwwrap';
    wrap.innerHTML = `<div class="win msgbox bevel-out active" role="dialog" aria-label="Windows Screen Saver">
      <div class="titlebar"><span class="ttl"><span>Windows Screen Saver</span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
      <div class="content"><svg class="ss-key" width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="5" width="6" height="6" fill="#ffd23f"/><rect x="3" y="7" width="2" height="2" fill="#7a5a00"/><rect x="7" y="7" width="8" height="2" fill="#ffd23f"/><rect x="12" y="9" width="2" height="2" fill="#ffd23f"/><rect x="10" y="9" width="1" height="2" fill="#ffd23f"/></svg>
        <div style="flex:1;min-width:0"><p>Type your password:</p><input class="field" type="password" autocomplete="off" maxlength="64"><div class="ss-err"></div></div></div>
      <div class="actions"><button class="btn" data-b="ok">OK</button><button class="btn" data-b="cancel">Cancel</button></div></div>`;
    r.veil.appendChild(wrap); r.pw = wrap; r.pwLast = performance.now();
    const inp = wrap.querySelector('input'), err = wrap.querySelector('.ss-err');
    const close = () => { wrap.remove(); if (run === r) { r.pw = null; r.base = null; r.t0 = performance.now(); } clearInterval(r.pwTimer); };
    const ok = () => {
      if (inp.value === String(store.get('screensaver.password', ''))) { clearInterval(r.pwTimer); stop(); }
      else { err.textContent = 'The password you typed is incorrect.'; inp.value = ''; inp.focus(); if (A) A.beep(220, 0.2, 'square', 0.04); }
    };
    wrap.querySelector('[data-b="ok"]').onclick = ok;
    wrap.querySelector('[data-b="cancel"]').onclick = close;
    wrap.querySelector('[data-act="close"]').onclick = close;
    wrap.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ok(); } else if (e.key === 'Escape') close(); });
    wrap.addEventListener('keyup', e => e.stopPropagation());
    r.pwTimer = setInterval(() => { if (run !== r) { clearInterval(r.pwTimer); return; } if (performance.now() - r.pwLast > 20000) close(); }, 1000);
    setTimeout(() => inp.focus(), 0);
  }
  function dismiss() {
    if (!run) return;
    if (run.idle && String(store.get('screensaver.password', '') || '')) showPassword(); else stop();
  }

  /* ---------- input + idle ---------- */
  const kill = e => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
  function onInput(e) {
    const now = performance.now(), mv = e.type === 'pointermove' || e.type === 'mousemove';
    if (run && run.pw && run.pw.contains(e.target)) { run.pwLast = now; return; }
    if (!mv && now < swallowUntil) { kill(e); return; }
    if (!run) { lastAct = now; if (mv) lastXY = [e.clientX, e.clientY]; return; }
    if (run.pw) { if (!mv) { kill(e); run.pwLast = now; const i = run.pw.querySelector('input'); if (i) i.focus(); } return; }
    if (mv) {
      const p = [e.clientX, e.clientY];
      if (!run.base || now - run.t0 < 350) { run.base = p; return; }
      if (Math.hypot(p[0] - run.base[0], p[1] - run.base[1]) < 6) return;
    } else {
      kill(e); swallowUntil = now + 700;
      if (now - run.t0 < 350) return;
    }
    if (mv) swallowUntil = now + 300;
    lastXY = mv ? [e.clientX, e.clientY] : lastXY;
    dismiss();
  }
  ['pointermove', 'mousemove', 'pointerdown', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, onInput, { capture: true, passive: false }));
  ['pointerup', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'keyup', 'keypress', 'touchend'].forEach(t => addEventListener(t, e => {
    if (run && run.pw && run.pw.contains(e.target)) return;
    if (performance.now() < swallowUntil || (run && !run.pw)) kill(e);
  }, { capture: true, passive: false }));
  document.addEventListener('visibilitychange', () => { lastAct = performance.now(); });
  const MEDIA = ['emulator', 'explorer', 'amp', 'cdplayer', 'defrag'];
  function inhibited() {
    if (!A) return false;
    try {
      const inh = A.idleInhibit;
      if (typeof inh === 'function' ? inh() : inh) return true;
      if (A.activeId && MEDIA.includes(A.activeId())) return true;
      const em = A.apps && A.apps.emulator;
      return !!(em && em.ctx && em.ctx.isVisible());
    } catch (e) { return false; }
  }
  function check() {
    const now = performance.now();
    if (run) return;
    if (document.hidden || document.fullscreenElement || document.webkitFullscreenElement || inhibited()) { lastAct = now; return; }
    const name = store.get('screensaver.name', rmq.matches ? 'Blank Screen' : 'Starfield Simulation'), wait = +store.get('screensaver.wait', 3);
    if (!(wait > 0) || !SAVERS[name]) return;
    if (now - lastAct >= wait * 60000) start(name, true);
  }
  setInterval(check, 500);

  /* ================= settings dialog ================= */
  function settings(name) {
    const sc = SCHEMA[name];
    if (!sc) return A ? A.dialog({ title: name && name !== '(None)' ? name + ' Setup' : 'Display Properties', text: 'This screen saver has no options that you can set.', icon: 'info' }) : Promise.resolve(null);
    return new Promise(resolve => {
      const o = getOpts(name);
      const veil = document.createElement('div'); veil.className = 'modal-veil ss-modal';
      veil.innerHTML = `<div class="win msgbox bevel-out active ss-setwin" role="dialog">
        <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
        <div class="ss-set"></div>
        <div class="actions"><button class="btn" data-b="ok">OK</button><button class="btn" data-b="cancel">Cancel</button></div></div>`;
      veil.querySelector('.ttl span').textContent = name + ' Setup';
      const box = veil.querySelector('.ss-set'), get = {};
      sc.fields.forEach(f => {
        let node;
        if (f.type === 'radio') {
          node = document.createElement('fieldset'); node.className = 'groupbox';
          const lg = document.createElement('legend'); lg.textContent = f.label; node.appendChild(lg);
          f.opts.forEach(([v, l]) => {
            const lab = document.createElement('label'), r = document.createElement('input');
            r.type = 'radio'; r.name = 'ss-' + sc.slug + '-' + f.k; r.checked = v === o[f.k]; r.dataset.v = JSON.stringify(v);
            lab.append(r, document.createTextNode(l)); node.appendChild(lab);
          });
          get[f.k] = () => { const c = node.querySelector('input:checked'); return c ? JSON.parse(c.dataset.v) : f.def; };
        } else if (f.type === 'range') {
          node = document.createElement('label'); node.className = 'ss-row';
          node.innerHTML = '<span></span><small></small><input type="range"><small></small>';
          node.children[0].textContent = f.label; node.children[1].textContent = f.lo; node.children[3].textContent = f.hi;
          const inp = node.children[2]; inp.min = f.min; inp.max = f.max; inp.step = f.max - f.min > 50 ? 10 : 1; inp.value = o[f.k];
          get[f.k] = () => clamp(+inp.value, f.min, f.max);
        } else if (f.type === 'check') {
          node = document.createElement('label'); node.className = 'ss-row';
          const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!o[f.k];
          node.append(c, document.createTextNode(f.label));
          get[f.k] = () => c.checked;
        } else if (f.type === 'text') {
          node = document.createElement('label'); node.className = 'ss-col';
          const s = document.createElement('span'), i = document.createElement('input');
          s.textContent = f.label + ':'; i.className = 'field'; i.maxLength = 120; i.value = o[f.k];
          node.append(s, i);
          get[f.k] = () => i.value.trim() || f.def;
        } else {
          node = document.createElement('label'); node.className = 'ss-row';
          const s = document.createElement('span'), i = document.createElement('input');
          s.textContent = f.label + ':'; i.type = 'color'; i.value = o[f.k];
          node.append(s, i);
          get[f.k] = () => (/^#[0-9a-f]{6}$/i.test(i.value) ? i.value : f.def);
        }
        box.appendChild(node);
      });
      const done = save => {
        if (save) { const out = {}; Object.keys(get).forEach(k => { out[k] = get[k](); }); store.set('screensaver.' + sc.slug, out); if (A) A.beep(660, 0.08, 'square', 0.03); }
        veil.remove(); resolve(!!save);
      };
      veil.querySelector('[data-b="ok"]').onclick = () => done(true);
      veil.querySelector('[data-b="cancel"]').onclick = () => done(false);
      veil.querySelector('[data-act="close"]').onclick = () => done(false);
      veil.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !(e.target.type === 'color')) { e.preventDefault(); done(true); } else if (e.key === 'Escape') done(false); });
      veil.style.zIndex = 9650;
      (document.getElementById('desktop') || document.body).appendChild(veil);
      setTimeout(() => { const first = veil.querySelector('input'); if (first) first.focus(); }, 0);
    });
  }

  const api = window.Screensavers95 = {
    names: NAMES.slice(),
    drawPreview, start: name => start(name, false), stop, settings,
    _step(dt = 1 / 30) { frame(dt); return !!run; },
    _state: () => ({ running: run ? run.name : null, idle: run ? run.idle : false, password: !!(run && run.pw), gl: !!(run && GL && run.cv === GL.cv), maze: run && run.inst && run.inst._maze ? run.inst._maze() : null }),
    _start: start, _noGL: false
  };
})();

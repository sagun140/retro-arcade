/* Calculator: Win95 Calculator, Standard and Scientific views.
   Standard view evaluates immediately left to right (2 + 3 * 4 = 20); Scientific view uses operator precedence (2 + 3 * 4 = 14), like the original.
   Integer modes (Hex/Oct/Bin) work on two's-complement integers of the chosen width (Dword 32 / Word 16 / Byte 8 bits) via BigInt. */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="0" width="12" height="16" fill="#000"/><rect x="3" y="1" width="10" height="14" fill="#c3c3c6"/><rect x="4" y="2" width="8" height="3" fill="#fff"/><rect x="9" y="3" width="2" height="1" fill="#000"/><rect x="4" y="6" width="2" height="2" fill="#00f"/><rect x="7" y="6" width="2" height="2" fill="#00f"/><rect x="10" y="6" width="2" height="2" fill="#f00"/><rect x="4" y="9" width="2" height="2" fill="#00f"/><rect x="7" y="9" width="2" height="2" fill="#00f"/><rect x="10" y="9" width="2" height="2" fill="#f00"/><rect x="4" y="12" width="2" height="2" fill="#00f"/><rect x="7" y="12" width="2" height="2" fill="#00f"/><rect x="10" y="12" width="2" height="2" fill="#f00"/></svg>';
  const store = { get: (k, d) => Arcade.store.get('calc.' + k, d), set: (k, v) => Arcade.store.set('calc.' + k, v) };

  Arcade.css(`
    .calc-root { align-self: center; padding: 4px 6px 6px; display: flex; flex-direction: column; gap: 6px; align-items: stretch; --bw: 36px; --bh: 29px; }
    .calc-root .btn { min-width: 0; min-height: 0; padding: 0; height: var(--bh); width: 100%; font-size: 12px; white-space: nowrap; overflow: hidden; }
    .calc-root .btn:disabled { color: var(--lo) !important; }
    .calc-disp { text-align: right; font: 14px/1 "Courier New", monospace; height: 24px; padding: 5px 6px; white-space: nowrap; overflow: hidden; user-select: text; -webkit-user-select: text; }
    .calc-ind { height: var(--bh); width: var(--bw); display: grid; place-items: center; flex: none; font-weight: bold; }
    .calc-b { color: #0000ff !important; } .calc-r { color: #ff0000 !important; } .calc-p { color: #800080 !important; } .calc-s { color: #0000a8 !important; }
    .calc-row { display: flex; gap: 6px; align-items: stretch; }
    .calc-wide { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .calc-col { display: grid; grid-template-columns: var(--bw); grid-auto-rows: var(--bh); gap: 5px; flex: none; }
    .calc-grid { display: grid; grid-auto-rows: var(--bh); gap: 5px; }
    .calc-std .calc-grid { grid-template-columns: repeat(5, var(--bw)); }
    .calc-sci .calc-fn { grid-template-columns: repeat(3, var(--bw)); }
    .calc-sci .calc-main { grid-template-columns: repeat(6, var(--bw)); }
    .calc-sci .groupbox { margin: 0; padding: 4px 6px; display: flex; flex-wrap: wrap; gap: 2px 8px; align-items: center; flex: 1; }
    .calc-sci .groupbox label { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
    .calc-sci .groupbox input { margin: 0; }
    .calc-pad { display: flex; gap: 8px; justify-content: center; }
    @media (max-width: 600px) {
      .calc-sci { --bw: calc((100vw - 92px) / 11); --bh: 26px; }
      .calc-sci .btn { font-size: 10px; }
      .calc-sci .calc-pad { gap: 4px; }
      .calc-sci .calc-grid, .calc-sci .calc-col { gap: 3px; }
      .calc-sci .groupbox { gap: 0 4px; padding: 3px 4px; font-size: 11px; }
    }
  `);

  const BIN = ['add', 'sub', 'mul', 'div', 'mod', 'pow', 'root', 'and', 'or', 'xor', 'lsh', 'rsh'];
  const SCI_PREC = { or: 1, xor: 2, and: 3, lsh: 4, rsh: 4, add: 5, sub: 5, mul: 6, div: 6, mod: 6, pow: 7, root: 7 };

  /* ---------- engine ---------- */
  const S = {
    view: store.get('view', 'standard'), grouping: store.get('grouping', false),
    base: 10, angle: 'deg', width: 32, inv: false, hyp: false, fe: false,
    disp: '0', cur: 0, entering: false, expMode: false,
    frames: [{ vals: [], ops: [] }], justOp: false, lastOp: null, lastArg: null,
    mem: 0, err: null
  };
  const fail = m => { throw new Error(m); };
  const INVALID = 'Invalid input for function.', DIV0 = 'Cannot divide by zero.';
  const prec = op => S.view === 'scientific' ? SCI_PREC[op] : 1;
  const wrapInt = v => { if (!isFinite(v)) fail(INVALID); return Number(BigInt.asIntN(S.width, BigInt(Math.trunc(v)))); };
  const BIG = v => BigInt(wrapInt(v));

  function parse(s) {
    if (S.base === 10) { const v = Number(s); return isNaN(v) ? 0 : v; }
    const p = { 16: '0x', 8: '0o', 2: '0b' }[S.base];
    return Number(BigInt.asIntN(S.width, BigInt(p + (s || '0'))));
  }
  function fmt(v) {
    if (!isFinite(v)) fail(INVALID);
    if (S.base !== 10) return BigInt.asUintN(S.width, BigInt(Math.trunc(v))).toString(S.base).toUpperCase();
    if (v === 0) return '0';
    if (S.fe) { const [m, e] = Number(v.toPrecision(15)).toExponential().split('e'); return (m.includes('.') ? m : m + '.') + 'e' + e; }
    const s = String(Number(v.toPrecision(15)));
    if (s.includes('e')) { const [m, e] = s.split('e'); return (m.includes('.') ? m : m + '.') + 'e' + e; }
    return s;
  }
  const val = () => S.entering ? parse(S.disp) : S.cur;
  function setVal(v) {
    if (typeof v !== 'number' || !isFinite(v)) fail(INVALID);
    if (S.base !== 10) v = wrapInt(v);
    if (Math.abs(v) < 1e-300) v = 0;
    S.cur = v; S.disp = fmt(v); S.entering = false; S.expMode = false;
  }
  function pretty() {
    if (S.err) return S.err;
    let s = S.disp;
    if (S.base !== 10) {
      if (!S.grouping) return s;
      const n = S.base === 8 ? 3 : 4; let out = '';
      for (let i = s.length; i > 0; i -= n) out = s.slice(Math.max(0, i - n), i) + (out ? ' ' + out : '');
      return out;
    }
    let sign = '', exp = '';
    if (s[0] === '-') { sign = '-'; s = s.slice(1); }
    const ei = s.indexOf('e'); if (ei > -1) { exp = s.slice(ei); s = s.slice(0, ei); }
    let [ip, fp] = s.split('.');
    if (S.grouping) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + ip + (fp !== undefined ? '.' + fp : exp ? '' : '.') + exp;
  }

  function apply(op, a, b) {
    let r;
    switch (op) {
      case 'add': r = a + b; break;
      case 'sub': r = a - b; break;
      case 'mul': r = a * b; break;
      case 'div': if (b === 0) fail(DIV0); r = a / b; break;
      case 'mod': if (b === 0) fail(DIV0); r = a % b; break;
      case 'pow': r = Math.pow(a, b); break;
      case 'root': if (b === 0) fail(INVALID); r = a < 0 && Math.abs(b % 2) === 1 ? -Math.pow(-a, 1 / b) : Math.pow(a, 1 / b); break;
      case 'and': r = Number(BigInt.asIntN(S.width, BIG(a) & BIG(b))); break;
      case 'or': r = Number(BigInt.asIntN(S.width, BIG(a) | BIG(b))); break;
      case 'xor': r = Number(BigInt.asIntN(S.width, BIG(a) ^ BIG(b))); break;
      case 'lsh': r = Number(BigInt.asIntN(S.width, BIG(a) << BigInt(Math.max(0, Math.min(64, Math.trunc(b)))))); break;
      case 'rsh': r = Number(BigInt.asIntN(S.width, BIG(a) >> BigInt(Math.max(0, Math.min(64, Math.trunc(b)))))); break;
    }
    if (!isFinite(r)) fail(INVALID);
    return S.base !== 10 ? wrapInt(r) : r;
  }
  function reduce(f) { const b = f.vals.pop(), a = f.vals.pop(), op = f.ops.pop(); f.vals.push(apply(op, a, b)); }
  function binary(op) {
    if (S.inv) { if (op === 'pow') op = 'root'; if (op === 'lsh') op = 'rsh'; S.inv = S.hyp = false; }
    const f = S.frames[S.frames.length - 1];
    if (S.justOp && f.ops.length) { f.ops[f.ops.length - 1] = op; S.lastOp = op; return; }
    f.vals.push(val());
    while (f.ops.length && prec(f.ops[f.ops.length - 1]) >= prec(op)) reduce(f);
    setVal(f.vals[f.vals.length - 1]);
    f.ops.push(op); S.lastOp = op; S.justOp = true;
  }
  function equals() {
    const pending = S.frames.some(f => f.ops.length) || S.frames.length > 1;
    if (pending) {
      const x = val();
      S.frames[S.frames.length - 1].vals.push(x);
      let r;
      for (;;) {
        const f = S.frames[S.frames.length - 1];
        while (f.ops.length) reduce(f);
        r = f.vals.pop();
        if (S.frames.length > 1) { S.frames.pop(); S.frames[S.frames.length - 1].vals.push(r); } else break;
      }
      S.lastArg = x; S.frames = [{ vals: [], ops: [] }];
      setVal(r);
    } else if (S.lastOp) setVal(apply(S.lastOp, val(), S.lastArg));
    else setVal(val());
    S.justOp = false;
  }
  function toRad(x) { return S.angle === 'deg' ? x * Math.PI / 180 : S.angle === 'grad' ? x * Math.PI / 200 : x; }
  function fromRad(x) { return S.angle === 'deg' ? x * 180 / Math.PI : S.angle === 'grad' ? x * 200 / Math.PI : x; }
  const snap = v => Math.abs(v) < 1e-15 ? 0 : v;
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    const c = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    z -= 1; let x = 0.99999999999980993; c.forEach((ci, i) => { x += ci / (z + i + 1); });
    const t = z + c.length - 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  function unary(k, x) {
    const inv = S.inv, hyp = S.hyp;
    switch (k) {
      case 'sqrt': if (x < 0) fail(INVALID); return Math.sqrt(x);
      case 'recip': if (x === 0) fail(DIV0); return 1 / x;
      case 'neg': return -x;
      case 'sin': case 'cos': case 'tan': {
        if (hyp) return inv ? { sin: Math.asinh, cos: Math.acosh, tan: Math.atanh }[k](x) : Math[k + 'h'](x);
        if (inv) { if (k !== 'tan' && Math.abs(x) > 1) fail(INVALID); return snap(fromRad(Math['a' + k](x))); }
        const r = toRad(x);
        if (k === 'tan' && Math.abs(Math.cos(r)) < 1e-12) fail(INVALID);
        return snap(Math[k](r));
      }
      case 'x2': if (inv) { if (x < 0) fail(INVALID); return Math.sqrt(x); } return x * x;
      case 'x3': return inv ? Math.cbrt(x) : x * x * x;
      case 'ln': if (inv) return Math.exp(x); if (x <= 0) fail(INVALID); return Math.log(x);
      case 'log': if (inv) return Math.pow(10, x); if (x <= 0) fail(INVALID); return Math.log10(x);
      case 'fact': {
        if (x < 0 && Number.isInteger(x)) fail(INVALID);
        if (Number.isInteger(x)) { if (x > 170) fail(INVALID); let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; }
        return gamma(x + 1);
      }
      case 'pi': return inv ? 2 * Math.PI : Math.PI;
      case 'int': return inv ? x - Math.trunc(x) : Math.trunc(x);
      case 'not': return Number(BigInt.asIntN(S.width, ~BIG(x)));
      case 'dms': {
        if (inv) { const d = Math.trunc(x), r = (x - d) * 100, m = Math.trunc(r), s = (r - m) * 100; return d + m / 60 + s / 3600; }
        const d = Math.trunc(x), m = (x - d) * 60, mi = Math.trunc(m), s = (m - mi) * 60; return d + mi / 100 + s / 10000;
      }
    }
  }
  const UNARY = ['sqrt', 'recip', 'sin', 'cos', 'tan', 'x2', 'x3', 'ln', 'log', 'fact', 'pi', 'int', 'not', 'dms'];

  function clearAll() { Object.assign(S, { disp: '0', cur: 0, entering: false, expMode: false, frames: [{ vals: [], ops: [] }], justOp: false, lastOp: null, lastArg: null, err: null, inv: false, hyp: false }); }
  const maxLen = () => ({ 16: S.width / 4, 8: Math.ceil(S.width / 3), 2: S.width, 10: 32 }[S.base]);

  function digit(d) {
    if (parseInt(d, 16) >= S.base) return;
    if (!S.entering) { S.disp = '0'; S.entering = true; S.expMode = false; }
    S.justOp = false;
    if (S.expMode) {
      const i = S.disp.indexOf('e'), e = S.disp.slice(i + 2);
      if (e.length >= 4) return;
      S.disp = S.disp.slice(0, i + 2) + (e === '0' ? d : e + d); return;
    }
    const digits = S.disp.replace(/[-.]/g, '');
    if (digits.length >= maxLen() && S.disp !== '0') return;
    if (S.disp === '0') S.disp = d; else if (S.disp === '-0') S.disp = '-' + d; else S.disp += d;
  }

  function press(k) {
    if (S.err && !(k === 'c' || k === 'ce' || /^[0-9A-F]$/.test(k) || k === '.')) return;
    if (S.err) clearAll();
    try {
      if (/^[0-9A-F]$/.test(k)) digit(k);
      else if (k === '.') {
        if (S.base !== 10) return;
        if (!S.entering) { S.disp = '0.'; S.entering = true; S.expMode = false; S.justOp = false; }
        else if (!S.expMode && !S.disp.includes('.')) S.disp += '.';
      } else if (k === 'back') {
        if (!S.entering) return;
        if (S.expMode) {
          const i = S.disp.indexOf('e'), e = S.disp.slice(i + 2);
          if (e.length > 1) S.disp = S.disp.slice(0, -1); else if (e !== '0') S.disp = S.disp.slice(0, i + 2) + '0'; else { S.disp = S.disp.slice(0, i); S.expMode = false; }
        } else { S.disp = S.disp.slice(0, -1); if (S.disp === '' || S.disp === '-') S.disp = '0'; }
      } else if (k === 'ce') { S.disp = '0'; S.cur = 0; S.entering = true; S.expMode = false; S.err = null; }
      else if (k === 'c') clearAll();
      else if (k === 'neg') {
        if (S.entering && S.base === 10) {
          if (S.expMode) { const i = S.disp.indexOf('e'); S.disp = S.disp.slice(0, i + 1) + (S.disp[i + 1] === '+' ? '-' : '+') + S.disp.slice(i + 2); }
          else S.disp = S.disp[0] === '-' ? S.disp.slice(1) : (S.disp === '0' ? '0' : '-' + S.disp);
        } else { setVal(-val()); S.justOp = false; }
      } else if (BIN.includes(k)) binary(k);
      else if (k === '=') equals();
      else if (k === 'pct') {
        const f = S.frames[S.frames.length - 1], a = f.vals.length ? f.vals[f.vals.length - 1] : 0;
        setVal(a * val() / 100); S.justOp = false;
      } else if (UNARY.includes(k)) { setVal(unary(k, val())); S.inv = S.hyp = false; S.justOp = false; }
      else if (k === 'exp') {
        if (S.base !== 10) return;
        if (!S.entering) { S.disp = fmt(val()); S.entering = true; S.justOp = false; }
        if (S.disp.includes('e')) { S.expMode = true; return; }
        S.disp += 'e+0'; S.expMode = true;
      } else if (k === '(') {
        if (S.frames.length > 25) return;
        const v = val(); S.frames.push({ vals: [], ops: [] }); S.justOp = false; S.cur = v; S.entering = false;
      } else if (k === ')') {
        if (S.frames.length < 2) return;
        const f = S.frames[S.frames.length - 1];
        f.vals.push(val());
        while (f.ops.length) reduce(f);
        const r = f.vals.pop(); S.frames.pop(); setVal(r); S.justOp = false;
      } else if (k === 'mc') S.mem = 0;
      else if (k === 'mr') { setVal(S.mem); S.justOp = false; }
      else if (k === 'ms') { S.mem = val(); S.entering = false; S.cur = S.mem; }
      else if (k === 'mp') { S.mem += val(); S.cur = val(); S.entering = false; }
      else if (k === 'fe') { S.fe = !S.fe; if (!S.entering) S.disp = fmt(S.cur); }
      else if (k === 'kinv') S.inv = !S.inv;
      else if (k === 'khyp') S.hyp = !S.hyp;
      else if (['hex', 'dec', 'oct', 'bin'].includes(k)) setBase({ hex: 16, dec: 10, oct: 8, bin: 2 }[k]);
      else if (['deg', 'rad', 'grad'].includes(k)) S.angle = k;
      else if (['dword', 'word', 'byte'].includes(k)) { const v = val(); S.width = { dword: 32, word: 16, byte: 8 }[k]; setVal(v); }
    } catch (e) {
      S.err = e.message || INVALID; S.frames = [{ vals: [], ops: [] }]; S.entering = false; S.expMode = false; S.justOp = false; S.inv = S.hyp = false;
    }
    render();
  }
  function setBase(b) {
    if (b === S.base) return;
    const v = val(); S.base = b; if (b === 10) S.width = 32;
    setVal(b === 10 ? v : Math.trunc(v));
  }

  /* ---------- view ---------- */
  let root = null, ctxRef = null, clip = '';
  const B = (k, label, cls = 'calc-b') => `<button class="btn ${cls}" data-k="${k}" tabindex="-1">${label}</button>`;
  const DIG = d => B(d, d, 'calc-b');
  function stdHTML() {
    return `<div class="calc-root calc-std">
      <div class="calc-disp field"></div>
      <div class="calc-row"><div class="calc-ind calc-mem bevel-thin-in"></div><div class="calc-wide">${B('back', 'Backspace', 'calc-r')}${B('ce', 'CE', 'calc-r')}${B('c', 'C', 'calc-r')}</div></div>
      <div class="calc-pad">
        <div class="calc-col">${B('mc', 'MC', 'calc-r')}${B('mr', 'MR', 'calc-r')}${B('ms', 'MS', 'calc-r')}${B('mp', 'M+', 'calc-r')}</div>
        <div class="calc-grid">
          ${DIG('7')}${DIG('8')}${DIG('9')}${B('div', '/', 'calc-r')}${B('sqrt', 'sqrt', 'calc-b')}
          ${DIG('4')}${DIG('5')}${DIG('6')}${B('mul', '*', 'calc-r')}${B('pct', '%', 'calc-b')}
          ${DIG('1')}${DIG('2')}${DIG('3')}${B('sub', '-', 'calc-r')}${B('recip', '1/x', 'calc-b')}
          ${DIG('0')}${B('neg', '+/-', 'calc-b')}${B('.', '.', 'calc-b')}${B('add', '+', 'calc-r')}${B('=', '=', 'calc-r')}
        </div>
      </div></div>`;
  }
  function sciHTML() {
    const R = (name, k, label) => `<label><input type="radio" name="calc-${name}" data-k="${k}">${label}</label>`;
    return `<div class="calc-root calc-sci">
      <div class="calc-disp field"></div>
      <div class="calc-row">
        <fieldset class="groupbox">${R('base', 'hex', 'Hex')}${R('base', 'dec', 'Dec')}${R('base', 'oct', 'Oct')}${R('base', 'bin', 'Bin')}</fieldset>
        <fieldset class="groupbox calc-ang">${R('ang', 'deg', 'Deg')}${R('ang', 'rad', 'Rad')}${R('ang', 'grad', 'Grad')}</fieldset>
        <fieldset class="groupbox calc-wid" hidden>${R('wid', 'dword', 'Dword')}${R('wid', 'word', 'Word')}${R('wid', 'byte', 'Byte')}</fieldset>
      </div>
      <div class="calc-row">
        <fieldset class="groupbox" style="flex:0 0 auto"><label><input type="checkbox" data-k="kinv">Inv</label><label><input type="checkbox" data-k="khyp">Hyp</label></fieldset>
        <div class="calc-ind calc-par bevel-thin-in"></div><div class="calc-ind calc-mem bevel-thin-in"></div>
        <div class="calc-wide">${B('back', 'Backspace', 'calc-r')}${B('ce', 'CE', 'calc-r')}${B('c', 'C', 'calc-r')}</div>
      </div>
      <div class="calc-pad">
        <div class="calc-col">${B('sta', 'Sta', 'calc-s')}${B('ave', 'Ave', 'calc-s')}${B('sum', 'Sum', 'calc-s')}${B('s', 's', 'calc-s')}${B('dat', 'Dat', 'calc-s')}</div>
        <div class="calc-grid calc-fn">
          ${B('fe', 'F-E', 'calc-p')}${B('(', '(', 'calc-p')}${B(')', ')', 'calc-p')}
          ${B('dms', 'dms', 'calc-p')}${B('exp', 'Exp', 'calc-p')}${B('ln', 'ln', 'calc-p')}
          ${B('sin', 'sin', 'calc-p')}${B('pow', 'x^y', 'calc-p')}${B('log', 'log', 'calc-p')}
          ${B('cos', 'cos', 'calc-p')}${B('x3', 'x^3', 'calc-p')}${B('fact', 'n!', 'calc-p')}
          ${B('tan', 'tan', 'calc-p')}${B('x2', 'x^2', 'calc-p')}${B('recip', '1/x', 'calc-p')}
        </div>
        <div class="calc-col">${B('mc', 'MC', 'calc-r')}${B('mr', 'MR', 'calc-r')}${B('ms', 'MS', 'calc-r')}${B('mp', 'M+', 'calc-r')}${B('pi', 'PI', 'calc-b')}</div>
        <div class="calc-grid calc-main">
          ${DIG('7')}${DIG('8')}${DIG('9')}${B('div', '/', 'calc-r')}${B('mod', 'Mod', 'calc-r')}${B('and', 'And', 'calc-r')}
          ${DIG('4')}${DIG('5')}${DIG('6')}${B('mul', '*', 'calc-r')}${B('or', 'Or', 'calc-r')}${B('xor', 'Xor', 'calc-r')}
          ${DIG('1')}${DIG('2')}${DIG('3')}${B('sub', '-', 'calc-r')}${B('lsh', 'Lsh', 'calc-r')}${B('not', 'Not', 'calc-r')}
          ${DIG('0')}${B('neg', '+/-', 'calc-b')}${B('.', '.', 'calc-b')}${B('add', '+', 'calc-r')}${B('=', '=', 'calc-r')}${B('int', 'Int', 'calc-r')}
          ${DIG('A')}${DIG('B')}${DIG('C')}${DIG('D')}${DIG('E')}${DIG('F')}
        </div>
      </div></div>`;
  }
  const DEC_ONLY = ['.', 'exp', 'fe', 'dms', 'sin', 'cos', 'tan', 'ln', 'log', 'pi'];
  function disabled(k) {
    if (['sta', 'ave', 'sum', 's', 'dat'].includes(k)) return true;
    if (/^[0-9A-F]$/.test(k)) return parseInt(k, 16) >= S.base;
    return S.base !== 10 && DEC_ONLY.includes(k);
  }
  function render() {
    if (!root) return;
    root.querySelector('.calc-disp').textContent = pretty();
    root.querySelector('.calc-mem').textContent = S.mem !== 0 ? 'M' : '';
    const par = root.querySelector('.calc-par'); if (par) par.textContent = S.frames.length > 1 ? '(=' + (S.frames.length - 1) : '';
    root.querySelectorAll('button[data-k]').forEach(b => { b.disabled = disabled(b.dataset.k); });
    const baseK = { 16: 'hex', 10: 'dec', 8: 'oct', 2: 'bin' }[S.base], widK = { 32: 'dword', 16: 'word', 8: 'byte' }[S.width];
    root.querySelectorAll('input[data-k]').forEach(i => {
      const k = i.dataset.k;
      i.checked = k === baseK || k === S.angle || k === widK || (k === 'kinv' && S.inv) || (k === 'khyp' && S.hyp);
    });
    const ang = root.querySelector('.calc-ang'), wid = root.querySelector('.calc-wid');
    if (ang) { ang.hidden = S.base !== 10; wid.hidden = S.base === 10; }
  }
  function mount() {
    const body = ctxRef.body;
    body.innerHTML = S.view === 'scientific' ? sciHTML() : stdHTML();
    root = body.firstElementChild;
    root.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    root.addEventListener('click', e => {
      const b = e.target.closest('button[data-k]'); if (b && !b.disabled) press(b.dataset.k);
    });
    root.addEventListener('change', e => {
      const i = e.target.closest('input[data-k]'); if (!i) return;
      press(i.dataset.k); i.blur();
    });
    render();
  }
  function setView(v) {
    if (S.view === v) return;
    S.view = v; store.set('view', v);
    if (v === 'standard') { setBase(10); S.inv = S.hyp = false; }
    S.frames = [{ vals: [], ops: [] }]; S.justOp = false;
    mount();
  }
  function flash(k) {
    const b = root && root.querySelector(`button[data-k="${CSS.escape(k)}"]`);
    if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 90); }
  }

  /* ---------- keyboard / clipboard ---------- */
  function keyAction(key) {
    const sci = S.view === 'scientific';
    if (/^[0-9]$/.test(key)) return key;
    if (S.base === 16 && /^[a-fA-F]$/.test(key)) return key.toUpperCase();
    const m = { '.': '.', ',': '.', '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '=': '=', Enter: '=', Escape: 'c', Backspace: 'back', Delete: 'ce',
      r: 'recip', R: 'recip', F9: 'neg', '%': sci ? 'mod' : 'pct', '@': sci ? 'x2' : 'sqrt' }[key];
    if (m) return m;
    if (!sci) return null;
    return { s: 'sin', o: 'cos', t: 'tan', y: 'pow', '#': 'x3', n: 'ln', l: 'log', '!': 'fact', p: 'pi', x: 'exp', '(': '(', ')': ')', '&': 'and', '|': 'or', '^': 'xor', '~': 'not',
      ';': 'int', '<': 'lsh', i: 'kinv', h: 'khyp', m: 'dms', v: 'fe', F5: 'hex', F6: 'dec', F7: 'oct', F8: 'bin',
      F2: S.base === 10 ? 'deg' : 'dword', F3: S.base === 10 ? 'rad' : 'word', F4: S.base === 10 ? 'grad' : 'byte' }[key] || null;
  }
  function copy() {
    const t = S.err ? '' : S.disp; clip = t;
    try { const p = navigator.clipboard && navigator.clipboard.writeText(t); if (p) p.catch(() => {}); } catch {}
  }
  async function paste() {
    let t = null;
    try { if (navigator.clipboard && navigator.clipboard.readText) t = await Promise.race([navigator.clipboard.readText(), new Promise(r => setTimeout(() => r(null), 400))]); } catch { t = null; }
    if (t == null || t === '') t = clip;
    for (const ch of String(t)) {
      if (ch === '\n' || ch === '\r') { press('='); continue; }
      if (/[cC]/.test(ch) && S.base !== 16) { press('c'); continue; }
      const a = keyAction(ch); if (a && !disabled(a)) press(a);
    }
  }

  /* ---------- hover preview ---------- */
  function preview(g, w, h, t) {
    g.fillStyle = '#0b7a78'; g.fillRect(0, 0, w, h);
    const x0 = 64, y0 = 6, cw = 80, ch = 105;
    g.fillStyle = '#c3c3c6'; g.fillRect(x0, y0, cw, ch);
    g.fillStyle = '#fff'; g.fillRect(x0, y0, cw, 1); g.fillRect(x0, y0, 1, ch);
    g.fillStyle = '#000'; g.fillRect(x0, y0 + ch - 1, cw, 1); g.fillRect(x0 + cw - 1, y0, 1, ch);
    g.fillStyle = '#0a1a86'; g.fillRect(x0 + 2, y0 + 2, cw - 4, 8);
    g.fillStyle = '#fff'; g.fillRect(x0 + 5, y0 + 14, cw - 10, 12);
    const seq = ['0.', '2.', '2.', '3.', '5.', '4.', '20.', '23.', '26.'], s = seq[Math.floor(t * 1.5) % seq.length];
    g.fillStyle = '#000'; g.font = '10px monospace'; g.textAlign = 'right'; g.fillText(s, x0 + cw - 8, y0 + 24);
    const hot = Math.floor(t * 3) % 20;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const bx = x0 + 6 + c * 14, by = y0 + 34 + r * 17, i = r * 5 + c;
      g.fillStyle = i === hot ? '#85858c' : '#fff'; g.fillRect(bx, by, 12, 14);
      g.fillStyle = i === hot ? '#fff' : '#85858c'; g.fillRect(bx + 1, by + 1, 11, 13);
      g.fillStyle = '#c3c3c6'; g.fillRect(bx + 1, by + 1, 10, 12);
      g.fillStyle = c >= 3 ? '#f00' : '#00f'; g.fillRect(bx + 5, by + 5, 3, 4);
    }
  }

  Arcade.app({
    id: 'calc', title: 'Calculator', icon: ICON, width: 'auto', folder: 'Accessories', desktop: true, preview,
    hint: 'Standard and Scientific views, memory, hex/oct/bin, and the keyboard shortcuts you remember.',
    menus: [
      { label: 'Edit', items: [
        { label: 'Copy', key: 'Ctrl+C', action: copy },
        { label: 'Paste', key: 'Ctrl+V', action: paste }
      ]},
      { label: 'View', items: [
        { label: 'Scientific', radio: () => S.view === 'scientific', action: () => setView('scientific') },
        { label: 'Standard', radio: () => S.view === 'standard', action: () => setView('standard') },
        '-',
        { label: 'Digit grouping', checked: () => S.grouping, action: () => { S.grouping = !S.grouping; store.set('grouping', S.grouping); render(); } }
      ]},
      { label: 'Help', items: [
        { label: 'Help Topics', action: () => Arcade.dialog({ title: 'Calculator Help', icon: 'info', text: 'Keys: 0-9, + - * /, Enter or = equals, Esc clears (C), Delete clears the entry (CE), Backspace deletes a digit, R = 1/x, @ = sqrt, F9 = +/-, Ctrl+C/Ctrl+V copy and paste. Memory: Ctrl+L MC, Ctrl+R MR, Ctrl+M MS, Ctrl+P M+. Scientific: S sin, O cos, T tan, Y x^y, # x^3, @ x^2, N ln, L log, ! n!, P pi, X Exp, % Mod, & And, | Or, ^ Xor, ~ Not, ; Int, < Lsh, I Inv, H Hyp, ( ), F5-F8 Hex/Dec/Oct/Bin, F2-F4 Deg/Rad/Grad. Standard view calculates left to right; Scientific view follows operator precedence.' }) },
        '-',
        { label: 'About Calculator', action: () => Arcade.dialog({ title: 'About Calculator', icon: 'info', text: 'Calculator for Arcade 95. A re-creation of the Windows 95 Calculator with Standard and Scientific views.' }) }
      ]}
    ],
    build(ctx) {
      ctxRef = ctx;
      mount();
      ctx.onKey(e => {
        if (e.ctrlKey || e.metaKey) {
          const k = e.key.toLowerCase();
          const map = { c: copy, v: paste, l: () => press('mc'), r: () => press('mr'), m: () => press('ms'), p: () => press('mp') };
          if (map[k] && !e.altKey) { e.preventDefault(); map[k](); flash({ l: 'mc', r: 'mr', m: 'ms', p: 'mp' }[k] || ''); }
          return;
        }
        if (e.altKey) return;
        const a = keyAction(e.key);
        if (!a) return;
        e.preventDefault();
        if (disabled(a)) return;
        press(a); flash(a);
      });
    }
  });
})();

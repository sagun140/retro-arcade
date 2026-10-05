/* Notepad: Win95 plain-text editor. Files live in Arcade.store 'notepad.files' ({name: text}).
   Win95 file Open/Save As dialog, modeless Find, Time/Date (F5), Word Wrap, the ".LOG" easter egg, save-changes prompt. */
(() => {
  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="2" width="11" height="13" fill="#000"/><rect x="2" y="1" width="11" height="13" fill="#fff"/><rect x="2" y="1" width="11" height="1" fill="#000"/><rect x="2" y="1" width="1" height="13" fill="#000"/><rect x="12" y="1" width="1" height="13" fill="#000"/><rect x="2" y="13" width="11" height="1" fill="#000"/><rect x="3" y="2" width="9" height="2" fill="#1a3fd6"/><rect x="4" y="0" width="1" height="3" fill="#808080"/><rect x="7" y="0" width="1" height="3" fill="#808080"/><rect x="10" y="0" width="1" height="3" fill="#808080"/><rect x="4" y="5" width="7" height="1" fill="#808080"/><rect x="4" y="7" width="6" height="1" fill="#808080"/><rect x="4" y="9" width="7" height="1" fill="#808080"/><rect x="4" y="11" width="4" height="1" fill="#808080"/></svg>';
  const FILE_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges"><rect x="3" y="1" width="10" height="14" fill="#000"/><rect x="4" y="2" width="8" height="12" fill="#fff"/><rect x="5" y="4" width="6" height="1" fill="#808080"/><rect x="5" y="6" width="5" height="1" fill="#808080"/><rect x="5" y="8" width="6" height="1" fill="#808080"/><rect x="5" y="10" width="4" height="1" fill="#808080"/></svg>';
  const FOLDER_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges"><rect x="1" y="3" width="6" height="2" fill="#e0b400"/><rect x="1" y="4" width="14" height="10" fill="#ffd94a"/><rect x="1" y="13" width="14" height="1" fill="#b08800"/></svg>';

  Arcade.css(`
    .np-wrap { position: relative; flex: 1; display: flex; min-height: 0; }
    .np-text { flex: 1; min-width: 0; min-height: 0; resize: none; border: 0; padding: 2px 4px; margin: 0; outline: none;
      background: var(--window); color: var(--window-ink); font: 13px/1.3 "Fixedsys", "Lucida Console", "Courier New", monospace;
      box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk);
      -webkit-user-select: text; user-select: text; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 8; }
    .np-text.np-nowrap { white-space: pre; overflow-wrap: normal; overflow-x: scroll; }
    .np-text::selection { background: var(--sel); color: var(--sel-ink); }
    .np-veil { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 6px; }
    .np-veil.np-modeless { pointer-events: none; }
    .np-dlg { pointer-events: auto; position: relative; width: min(360px, 100%); max-height: 100%; overflow: auto; }
    .np-dlg .np-body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
    .np-row { display: flex; align-items: center; gap: 6px; }
    .np-row > label:first-child { width: 72px; flex: none; }
    .np-row .field { flex: 1; min-width: 0; }
    .np-list { background: var(--window); color: var(--window-ink); height: 110px; overflow: auto; padding: 3px;
      box-shadow: inset -1px -1px var(--hi), inset 1px 1px var(--lo), inset -2px -2px var(--hi2), inset 2px 2px var(--dk);
      display: flex; flex-direction: column; flex-wrap: wrap; align-content: flex-start; gap: 1px 10px; }
    .np-list button { display: flex; align-items: center; gap: 4px; border: 0; background: none; padding: 1px 2px; color: inherit; text-align: left; max-width: 150px; }
    .np-list button span { padding: 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .np-list button.np-on span { background: var(--sel); color: var(--sel-ink); outline: 1px dotted var(--sel-ink); }
    .np-list .np-empty { color: var(--lo); padding: 4px; }
    .np-btns { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
    .np-find { display: flex; gap: 8px; }
    .np-find .np-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .np-find .np-right { display: flex; flex-direction: column; gap: 6px; }
    .np-find .groupbox { margin: 0; padding: 8px 6px 4px; display: flex; gap: 8px; }
    .np-find .np-opts { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .np-dlg label { display: inline-flex; align-items: center; gap: 3px; }
  `);

  const store = { get: (k, d) => Arcade.store.get('notepad.' + k, d), set: (k, v) => Arcade.store.set('notepad.' + k, v) };
  const files = () => store.get('files', {});
  let ta = null, ctxRef = null, fileName = null, savedText = '', clip = '', wrap = store.get('wrap', true);
  let findText = '', matchCase = false, findUp = false, findDlg = null, modal = null, closingOK = false;

  const pad2 = n => String(n).padStart(2, '0');
  function stamp(d = new Date()) {
    const h = d.getHours() % 12 || 12;
    return `${h}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'} ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
  const docName = () => fileName || 'Untitled';
  const dirty = () => ta && ta.value !== savedText;
  const hasSel = () => ta && ta.selectionStart !== ta.selectionEnd;
  function setTitle() { if (ctxRef) ctxRef.setTitle(`${docName()} - Notepad`); }

  function load(name, text) {
    fileName = name; savedText = text;
    if (text.startsWith('.LOG')) text += '\n' + stamp() + '\n';   // the original's diary trick
    ta.value = text; setTitle();
    ta.focus();
    const end = text.startsWith('.LOG') ? text.length : 0;
    ta.setSelectionRange(end, end); ta.scrollTop = text.startsWith('.LOG') ? ta.scrollHeight : 0;
  }
  function insert(s) {
    ta.focus();
    if (!document.execCommand('insertText', false, s)) ta.setRangeText(s, ta.selectionStart, ta.selectionEnd, 'end');
  }

  /* ---------- files ---------- */
  function writeFile(name) {
    const all = files(); all[name] = ta.value; store.set('files', all);
    fileName = name; savedText = ta.value; setTitle();
    return true;
  }
  async function save() { return fileName ? writeFile(fileName) : saveAs(); }
  async function saveAs() {
    const name = await fileDialog('save');
    if (!name) return false;
    if (files()[name] != null && name !== fileName) {
      const r = await Arcade.dialog({ title: 'Save As', icon: 'warn', text: `${name} already exists. Do you want to replace it?`, buttons: ['Yes', 'No'] });
      if (r !== 'Yes') return saveAs();
    }
    return writeFile(name);
  }
  /* true = carry on (saved or discarded), false = cancelled */
  async function askSave() {
    if (!dirty()) return true;
    const r = await Arcade.dialog({ title: 'Notepad', icon: 'warn', text: `The text in the ${docName()} file has changed. Do you want to save the changes?`, buttons: ['Yes', 'No', 'Cancel'] });
    if (r === 'Yes') return save();
    return r === 'No';
  }
  async function newDoc() { if (await askSave()) { load(null, ''); } }
  async function openDoc() {
    if (!(await askSave())) return;
    const name = await fileDialog('open');
    if (!name) { ta.focus(); return; }
    const text = files()[name];
    if (text == null) { await Arcade.dialog({ title: 'Open', icon: 'error', text: `${name}\nFile not found. Please verify the correct file name was given.` }); return openDoc(); }
    load(name, text);
  }

  /* ---------- in-window dialogs ---------- */
  function dlgShell(title, modeless) {
    const veil = Arcade.el(`<div class="np-veil${modeless ? ' np-modeless' : ''}"><div class="win np-dlg bevel-out active">
      <div class="titlebar"><span class="ttl"><span></span></span><div class="tb-btns"><button data-act="close" aria-label="Close">×</button></div></div>
      <div class="np-body"></div></div></div>`);
    veil.querySelector('.ttl span').textContent = title;
    ctxRef.win.appendChild(veil);
    return { veil, body: veil.querySelector('.np-body'), x: veil.querySelector('[data-act="close"]') };
  }
  function fileDialog(mode) {
    return new Promise(resolve => {
      if (modal) modal.remove();
      const open = mode === 'open';
      const d = dlgShell(open ? 'Open' : 'Save As');
      modal = d.veil;
      d.body.innerHTML = `
        <div class="np-row"><label>${open ? 'Look in:' : 'Save in:'}</label><span class="field" style="display:flex;align-items:center;gap:4px">${FOLDER_ICON}My Documents</span></div>
        <div class="np-list" role="listbox"></div>
        <div class="np-row"><label for="np-fn">File name:</label><input class="field" id="np-fn" autocomplete="off" spellcheck="false"></div>
        <div class="np-row"><label>Save as type:</label><span class="field">Text Documents (*.txt)</span></div>
        <div class="np-btns"><button class="btn np-ok">${open ? 'Open' : 'Save'}</button><button class="btn np-cancel">Cancel</button></div>`;
      if (open) d.body.querySelectorAll('.np-row label')[2].textContent = 'Files of type:';
      const list = d.body.querySelector('.np-list'), fn = d.body.querySelector('#np-fn');
      const names = Object.keys(files()).sort((a, b) => a.localeCompare(b));
      if (!names.length) list.innerHTML = '<div class="np-empty">(no files)</div>';
      names.forEach(n => {
        const b = Arcade.el(`<button type="button" role="option">${FILE_ICON}<span></span></button>`);
        b.querySelector('span').textContent = n;
        b.onclick = () => { list.querySelectorAll('.np-on').forEach(x => x.classList.remove('np-on')); b.classList.add('np-on'); fn.value = n; };
        b.ondblclick = () => { fn.value = n; ok(); };
        list.appendChild(b);
      });
      fn.value = open ? '' : (fileName || '*.txt');
      const done = v => { d.veil.remove(); if (modal === d.veil) modal = null; resolve(v); };
      function ok() {
        let v = fn.value.trim();
        if (!v || v.includes('*')) { fn.focus(); fn.select(); return; }
        if (!/\.[^.\s]+$/.test(v)) v += '.txt';
        done(v);
      }
      d.body.querySelector('.np-ok').onclick = ok;
      d.body.querySelector('.np-cancel').onclick = () => done(null);
      d.x.onclick = () => done(null);
      d.veil.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); ok(); } else if (e.key === 'Escape') { e.preventDefault(); done(null); }
        e.stopPropagation();
      });
      setTimeout(() => { fn.focus(); fn.select(); }, 0);
    });
  }

  function showFind() {
    if (findDlg) { findDlg.querySelector('.np-what').focus(); return; }
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (sel && !sel.includes('\n')) findText = sel;
    const d = dlgShell('Find', true);
    findDlg = d.veil;
    d.veil.style.placeItems = 'start end';
    d.body.innerHTML = `<div class="np-find"><div class="np-left">
        <div class="np-row"><label for="np-what" style="width:auto">Fi<u>n</u>d what:</label><input class="field np-what" id="np-what" autocomplete="off" spellcheck="false"></div>
        <div class="np-opts"><label><input type="checkbox" class="np-case"> Match <u>c</u>ase</label>
          <fieldset class="groupbox"><legend>Direction</legend><label><input type="radio" name="np-dir" value="up"> <u>U</u>p</label><label><input type="radio" name="np-dir" value="down"> <u>D</u>own</label></fieldset></div>
      </div><div class="np-right"><button class="btn np-next"><u>F</u>ind Next</button><button class="btn np-cancel">Cancel</button></div></div>`;
    const what = d.body.querySelector('.np-what'), next = d.body.querySelector('.np-next'), cs = d.body.querySelector('.np-case');
    what.value = findText; cs.checked = matchCase;
    d.body.querySelector(`input[value="${findUp ? 'up' : 'down'}"]`).checked = true;
    const sync = () => { findText = what.value; matchCase = cs.checked; findUp = d.body.querySelector('input[value="up"]').checked; next.disabled = !findText; };
    d.body.addEventListener('input', sync); d.body.addEventListener('change', sync); sync();
    const close = () => { d.veil.remove(); findDlg = null; ta.focus(); };
    next.onclick = () => { sync(); findNext(true); };
    d.body.querySelector('.np-cancel').onclick = close; d.x.onclick = close;
    d.veil.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (findText) next.click(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'F3') { e.preventDefault(); sync(); findNext(true); }
      e.stopPropagation();
    });
    setTimeout(() => { what.focus(); what.select(); }, 0);
  }
  function findNext(keepDialogFocus) {
    if (!findText) { showFind(); return; }
    const hay = matchCase ? ta.value : ta.value.toLowerCase(), needle = matchCase ? findText : findText.toLowerCase();
    const i = findUp ? (ta.selectionStart > 0 ? hay.lastIndexOf(needle, ta.selectionStart - 1) : -1) : hay.indexOf(needle, ta.selectionEnd);
    if (i < 0) { Arcade.dialog({ title: 'Notepad', icon: 'info', text: `Cannot find "${findText}"` }).then(() => (findDlg ? findDlg.querySelector('.np-what') : ta).focus()); return; }
    ta.focus(); ta.setSelectionRange(i, i + findText.length);
    // scroll the match into view: measure with a mirror of the text up to the match
    const lines = ta.value.slice(0, i).split('\n').length - 1, lh = parseFloat(getComputedStyle(ta).lineHeight) || 17;
    if (!wrap) { const y = lines * lh; if (y < ta.scrollTop || y > ta.scrollTop + ta.clientHeight - lh) ta.scrollTop = Math.max(0, y - ta.clientHeight / 2); }
    if (keepDialogFocus && findDlg) findDlg.querySelector('.np-next').focus();
  }

  /* ---------- edit commands ---------- */
  function cut() { if (!hasSel()) return; clip = ta.value.slice(ta.selectionStart, ta.selectionEnd); ta.focus(); if (!document.execCommand('cut')) insert(''); }
  function copy() { if (!hasSel()) return; clip = ta.value.slice(ta.selectionStart, ta.selectionEnd); ta.focus(); document.execCommand('copy'); }
  async function paste() {
    let t = null;
    try { if (navigator.clipboard && navigator.clipboard.readText) t = await navigator.clipboard.readText(); } catch {}
    if (t == null || t === '') t = clip;
    if (t) insert(t); else ta.focus();
  }
  function del() { ta.focus(); document.execCommand(hasSel() ? 'delete' : 'forwardDelete') || ta.setRangeText('', ta.selectionStart, Math.max(ta.selectionEnd, ta.selectionStart + 1), 'end'); }
  function undo() { ta.focus(); document.execCommand('undo'); }
  function selectAll() { ta.focus(); ta.select(); }
  function setWrap(v) { wrap = v; store.set('wrap', v); if (ta) { ta.classList.toggle('np-nowrap', !v); ta.wrap = v ? 'soft' : 'off'; } }

  function shortcut(e) {
    const k = e.key, c = e.ctrlKey || e.metaKey;
    let f = null;
    if (k === 'F5') f = () => insert(stamp());
    else if (k === 'F3') f = () => findNext();
    else if (c && !e.shiftKey && !e.altKey) {
      const l = k.toLowerCase();
      if (l === 's') f = save; else if (l === 'o') f = openDoc; else if (l === 'n') f = newDoc; else if (l === 'f') f = showFind;
      else if (!e.target.closest || !e.target.closest('textarea')) {   // when focus is elsewhere in the window
        if (l === 'a') f = selectAll; else if (l === 'z') f = undo; else if (l === 'x') f = cut; else if (l === 'c') f = copy; else if (l === 'v') f = paste;
      }
    }
    if (f) { e.preventDefault(); f(); }
  }

  /* ---------- hover preview ---------- */
  function preview(g, w, h, t) {
    g.fillStyle = '#0b7a78'; g.fillRect(0, 0, w, h);
    const x = 18, y = 10, W = w - 36, H = h - 20;
    g.fillStyle = '#c3c3c6'; g.fillRect(x, y, W, H);
    g.fillStyle = '#fff'; g.fillRect(x, y, W, 1); g.fillRect(x, y, 1, H);
    g.fillStyle = '#000'; g.fillRect(x, y + H - 1, W, 1); g.fillRect(x + W - 1, y, 1, H);
    const gr = g.createLinearGradient(x, 0, x + W, 0); gr.addColorStop(0, '#0a1a86'); gr.addColorStop(1, '#1d8ad6');
    g.fillStyle = gr; g.fillRect(x + 3, y + 3, W - 6, 11);
    g.fillStyle = '#fff'; g.font = 'bold 8px Tahoma, sans-serif'; g.textBaseline = 'middle'; g.fillText('Untitled - Notepad', x + 6, y + 9);
    g.fillStyle = '#101014'; g.font = '8px Tahoma, sans-serif'; g.fillText('File  Edit  Search  Help', x + 5, y + 21);
    g.fillStyle = '#fff'; g.fillRect(x + 4, y + 27, W - 8, H - 31);
    g.fillStyle = '#808080'; g.fillRect(x + 4, y + 27, W - 8, 1); g.fillRect(x + 4, y + 27, 1, H - 31);
    const lines = ['.LOG', '', stamp(new Date(2026, 9, 4, 21, 5)), 'Dear diary,', 'Beat Minesweeper on', 'Expert. 142 seconds!'];
    const total = lines.join('\n').length, n = Math.floor((t * 14) % (total + 30));
    let left = n; g.fillStyle = '#000'; g.font = '9px "Courier New", monospace'; g.textBaseline = 'top';
    let cx = x + 7, cy = y + 30;
    for (const ln of lines) {
      const s = ln.slice(0, Math.max(0, left)); g.fillText(s, x + 7, cy);
      if (left <= ln.length) { cx = x + 7 + g.measureText(s).width; break; }
      left -= ln.length + 1; cy += 11;
    }
    if (Math.floor(t * 2) % 2 === 0) g.fillRect(cx, cy, 1, 9);
  }

  const app = Arcade.app({
    id: 'notepad', title: 'Untitled - Notepad', icon: ICON, width: 440, height: 320, max: true,
    folder: 'Accessories', desktop: true, preview, label: 'Notepad',
    hint: 'Plain text editor. Start a file with .LOG and it keeps a diary for you.',
    menus: [
      { label: 'File', items: [
        { label: 'New', key: 'Ctrl+N', action: () => newDoc() },
        { label: 'Open…', key: 'Ctrl+O', action: () => openDoc() },
        { label: 'Save', key: 'Ctrl+S', action: () => save() },
        { label: 'Save As…', action: () => saveAs() },
        '-',
        { label: 'Exit', action: () => app.ctx.close() }
      ]},
      { label: 'Edit', items: [
        { label: 'Undo', key: 'Ctrl+Z', action: undo },
        '-',
        { label: 'Cut', key: 'Ctrl+X', disabled: () => !hasSel(), action: cut },
        { label: 'Copy', key: 'Ctrl+C', disabled: () => !hasSel(), action: copy },
        { label: 'Paste', key: 'Ctrl+V', action: paste },
        { label: 'Delete', key: 'Del', action: del },
        '-',
        { label: 'Select All', action: selectAll },
        { label: 'Time/Date', key: 'F5', action: () => insert(stamp()) },
        '-',
        { label: 'Word Wrap', checked: () => wrap, action: () => { setWrap(!wrap); ta.focus(); } }
      ]},
      { label: 'Search', items: [
        { label: 'Find…', action: showFind },
        { label: 'Find Next', key: 'F3', action: () => findNext() }
      ]},
      { label: 'Help', items: [
        { label: 'Help Topics', action: () => Arcade.dialog({ title: 'Notepad Help', icon: 'info', text: 'Type to edit. File > Save keeps your text in this browser. F5 inserts the time and date. Search > Find (F3 for the next match). Tip: a file whose first line is .LOG gets the time and date added each time you open it.' }) },
        '-',
        { label: 'About Notepad', action: () => Arcade.dialog({ title: 'About Notepad', icon: 'info', text: 'Notepad for Arcade 95. A re-creation of the Windows 95 text editor. Files are saved in your browser.' }) }
      ]}
    ],
    build(ctx) {
      ctxRef = ctx;
      const wrapEl = Arcade.el('<div class="np-wrap"><textarea class="np-text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Notepad text"></textarea></div>');
      ctx.body.appendChild(wrapEl);
      ta = wrapEl.firstChild;
      setWrap(wrap);
      ta.addEventListener('keydown', e => { shortcut(e); if (e.key === 'Tab') { e.preventDefault(); insert('\t'); } });
      ctx.onKey(shortcut);
      ctx.on('open', () => setTimeout(() => ta.focus(), 0));
      ctx.on('focus', () => { if (!modal && !findDlg) setTimeout(() => ta.focus(), 0); });
      ctx.on('close', () => {
        if (closingOK) { closingOK = false; return; }
        if (modal) { modal.remove(); modal = null; }
        if (!dirty()) { reset(); return; }
        Arcade.open('notepad');               // the shell can't veto a close, so come back and ask
        askSave().then(go => { if (go) { closingOK = true; reset(); ctx.close(); } });
      });
      function reset() { if (findDlg) { findDlg.remove(); findDlg = null; } fileName = null; savedText = ''; ta.value = ''; setTitle(); }
      setTitle();
    }
  });
})();

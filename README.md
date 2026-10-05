# Arcade 95

A Windows 95–style arcade in the browser. Static files only: open `index.html` or serve the folder.

Live: https://sagun140.github.io/retro-arcade/

## Layout

```
index.html        shell markup + <script> list (load order matters: arcade.js first, system.js last)
css/win95.css     desktop, window chrome, shared controls (.btn .field .lcd .groupbox .doc .scores .folder)
js/arcade.js      window manager, menus, message boxes, storage, audio, Start menu, hover cards
js/<program>.js   one file per program; each calls Arcade.app({...})
js/system.js      Readme, High Scores, Games folder, Recycle Bin, Display Properties (themes)
```

Run locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Program API

Each program is a self-contained IIFE in `js/<id>.js`:

```js
(() => {
  Arcade.css(`/* styles, every selector prefixed with a program-specific class, e.g. .ms- */`);
  Arcade.app({
    id: 'minesweeper',          // window element id becomes w-minesweeper
    title: 'Minesweeper',       // title bar, taskbar, desktop icon label
    icon: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">…</svg>', // 16x16 pixel art, rects only
    width: 300,                 // px number or CSS string; height optional
    max: false,                 // true adds a Maximize button (window gets class .max)
    folder: 'Games',            // Start > Programs submenu + Games folder ('Games' or 'Accessories')
    desktop: true,              // desktop icon
    status: true,               // adds a status bar; set cells with ctx.status('a', 'b')
    hint: 'One line for the hover card.',
    preview(g, w, h, t) {},     // optional: draws an animated thumbnail (208x117 canvas 2D ctx, t seconds) in the desktop hover card
    menus: [                    // optional Win95 menu bar
      { label: 'Game', items: [
        { label: 'New', key: 'F2', action: () => {} },
        '-',
        { label: 'Beginner', radio: () => level === 0, action: () => {} },
        { label: 'Sound', checked: () => !Arcade.isMuted(), action: () => Arcade.setMuted(!Arcade.isMuted()) },
        { label: 'Exit', action: () => Arcade.apps.minesweeper.ctx.close() }
      ]}
    ],
    build(ctx) { /* called once, the first time the window opens */ }
  });
})();
```

`ctx` (passed to `build`, also at `Arcade.apps[id].ctx`):

| member | meaning |
|---|---|
| `ctx.body` | the window's content element (flex column). Fill it. |
| `ctx.win` | the `<section class="win">` element |
| `ctx.isVisible()` / `ctx.isActive()` | open and not minimized / also focused. Game loops must skip work when not visible. |
| `ctx.onKey(fn)` / `ctx.onKeyUp(fn)` | keyboard events, delivered only while this window is focused. Call `e.preventDefault()` for keys you use. |
| `ctx.on(evt, fn)` | `'focus' 'blur' 'open' 'close' 'minimize' 'restore' 'resize'`. Pause real-time games on `blur`. |
| `ctx.status(...cells)` | set status bar text |
| `ctx.setTitle(s)`, `ctx.close()`, `ctx.focus()`, `ctx.setMenus(menus)` | |

Shared helpers on `window.Arcade`:

| helper | meaning |
|---|---|
| `Arcade.store.get(key, default)` / `.set(key, value)` | JSON in localStorage, namespaced, never throws. Prefix keys with your id: `'minesweeper.best'`. |
| `Arcade.beep(freq, dur, type, vol, slide, delay)` | one-shot synth blip, respects mute |
| `Arcade.audio()` | the shared AudioContext (or null). Check `Arcade.isMuted()` / `Arcade.onMute(fn)` for long-running audio. |
| `Arcade.dialog({title, text, icon: 'info'/'warn'/'error'/'trophy', buttons: ['OK'], input: ''})` | Win95 message box, returns a Promise of the clicked label (or the typed text when `input` is set, null on cancel). Never use alert/confirm/prompt. |
| `Arcade.scores.add({game, render: () => '<tr>…</tr>'})` | add a section to the High Scores window (rows for a table with `<th>` header row) |
| `Arcade.esc(s)` | HTML-escape |
| `Arcade.coarse` | true on touch devices; provide touch controls when it is |

Rules: no external assets or network calls (draw everything with canvas/CSS/SVG, synthesize sound with WebAudio), no globals besides your `Arcade.app` call, and everything must work at phone width.
Exceptions by design: `emulator.js` loads the v86 emulator from jsDelivr and disk images from `emu/`; `explorer.js` frames web.archive.org and sites that allow framing.

## Programs

Games: Byte Rush, Minesweeper, Solitaire, FreeCell, Ski Slope, Hover!, Space Pinball, Snake 98.
Accessories: Amp 95, CD Player, PC Emulator (v86: KolibriOS, FreeDOS, bring-your-own image), Arcade Explorer (Wayback time machine browser), DxDiag (real hardware readout + DirectX-style tests), Paint, Notepad, Calculator, Disk Defragmenter, ScanDisk, MS-DOS Prompt, Display Properties (theme packs, wallpapers, schemes, screen savers).
System: boot sequence (`js/boot.js`), Shut Down dialog, Ctrl+Alt+Del / Ctrl+Alt+Backspace Close Program + blue screen, screen savers (`js/screensaver.js`, `window.Screensavers95`), Flip 3D (tray ▦ button or Ctrl+Shift+F).

Licenses for bundled emulator files: `emu/LICENSES.md`. No Microsoft software is included.

Shared globals besides `Arcade`: `Cards95` (cards.js), `Tracks95` (amp.js), `Screensavers95` (screensaver.js).
Store keys used across programs: `theme`, `paint.wallpaper`, `screensaver.name|wait|password`, `boot.full`, `boot.forceInTests` (tests only; boot is skipped under webdriver), `user.name`, `dos.fs`.
`Arcade.apps.dos.console(host, opts)` creates a DOS console (used by MS-DOS mode). `Arcade.idleInhibit` (value or function) stops the screen saver from auto-starting.

### Shell hooks (for system-level programs)

| helper | meaning |
|---|---|
| `Arcade.hooks.shutdown = fn` | replaces what Start ▸ Shut Down… does (default: `Arcade.safeToTurnOff()`) |
| `Arcade.safeToTurnOff()` | shows the "It's now safe to turn off your computer" screen |
| `Arcade.openWindows()` | `[{id, title, ctx}]` for every open window (for Close Program / End Task) |
| `Arcade.activeId()`, `Arcade.blurAll()`, `Arcade.closeStart()` | focus helpers |

Testing: `node tools/smoke.mjs <id> out.png --eval "<js>"`. Dispatch synthetic keys on `document.body` (bubbling) or `window`.

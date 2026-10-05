/* Amp 95: an original late-90s skinnable music player tribute.
   Also defines window.Tracks95 (song library + look-ahead sequencer), reused by the CD Player.
   All music is synthesized live with WebAudio from the compact pattern data below. */
(() => {
  /* ================= Tracks95: song data ================= */
  /* Song format (16 steps per bar):
     ins   per-channel synth overrides (see DEF)      dr    drum patterns: k kick, s snare, c clap, r rim, h hat, o open hat
                                                            chars: x hit, X accent, g ghost, . none
     bass  rhythm strings: x root, o octave, 5 fifth, 3 third, - hold, . rest
     arp   rhythm strings: digits = chord tone index (wraps up an octave), x = full chord stab; built-ins up/down/updown/up8
     mel   melodies: NOTE:len tokens (len in steps, default 2), r = rest, | = bar line (ignored)
     sec   sections: bars, ch (one chord per bar, cycled), dr, fill (last bar), bass, arp, pad, lead, lo (lead transpose), sweep [cutoff from, to]
     order section names in play order */
  const SONGS = [
    { artist: 'Neon Vector', title: 'Midnight Overdrive', genre: 'Synthwave', bpm: 100, kbps: 192, echo: .3,
      ins: { lead: { w: 'sawtooth', det: 9, cut: 2600, q: 2, vol: .06, vib: 5, vd: 14 }, bass: { cut: 450, fenv: 1300 }, arp: { vol: .028 }, pad: { vol: .03 } },
      dr: { a: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
            b: { k: 'x.......x.x.....', s: '....x.......x...', h: 'xgxgxgxgxgxgxgxg', o: '..............x.' },
            f: { k: 'x.......x.......', s: '....x...x.xxXXXX', h: 'x.x.x.x.........' } },
      bass: { a: 'x.x.o.x.x.x.o.x.' },
      mel: { v: 'A4:4 C5:2 E5:4 D5:2 C5:2 B4:2 | A4:6 G4:2 F4:4 A4:4 | G4:4 C5:2 E5:4 G5:2 E5:2 D5:2 | D5:8 B4:4 G4:4',
             c: 'A4:6 G4:2 F4:4 C5:4 | G4:6 A4:2 B4:4 D5:4 | E5:6 D5:2 B4:4 G4:4 | A4:12 r:4' },
      sec: { i: { bars: 4, ch: 'Am F C G', arp: 'up', pad: 1 },
             v: { bars: 8, ch: 'Am F C G', dr: 'a', bass: 'a', arp: 'up', lead: 'v' },
             c: { bars: 8, ch: 'F G Em Am', dr: 'b', fill: 'f', bass: 'a', arp: 'up', pad: 1, lead: 'c' },
             k: { bars: 4, ch: 'F G Em Am', arp: 'updown', pad: 1 },
             C: { bars: 8, ch: 'F G Em Am', dr: 'b', fill: 'f', bass: 'a', arp: 'up', pad: 1, lead: 'c', lo: 12 },
             o: { bars: 4, ch: 'Am F C G', arp: 'up', pad: 1, dr: 'a' } },
      order: ['i', 'v', 'c', 'k', 'C', 'o'] },

    { artist: 'DJ Polaris feat. Mira', title: 'Feel the Heartbeat', genre: 'Eurodance', bpm: 140, kbps: 160,
      ins: { lead: { w: 'square', det: 12, cut: 3800, vol: .045, vib: 0, a: .005, d: .1, s: .5 }, bass: { cut: 600, fenv: 1500, fd: .08 }, arp: { w: 'sawtooth', vol: .022, cut: 2500 }, pad: { vol: .028 } },
      dr: { n: { k: 'x...x...x...x...', h: 'x.xxx.xxx.xxx.xx' },
            a: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'x...x...x...x...' },
            b: { c: '....x.......x...', o: '..x...x...x...x.', h: 'xgxgxgxgxgxgxgxg' },
            f: { k: 'x...x...x...x...', s: '....x...x.x.xxXX', o: '..x...x.........' } },
      bass: { a: 'x.o.x.o.x.o.x.o.' },
      mel: { r: 'F5 F5 Ab5 F5 C6 F5 Eb5 F5 | F5 F5 Ab5 F5 Db6 C6 Ab5 F5 | Eb5 Eb5 Ab5 Eb5 C6 Ab5 Eb5 C5 | Eb5 G5 Bb5 G5 Eb5:4 Bb4:4',
             v: 'C5:4 C5:2 Eb5:2 F5:4 Eb5:2 C5:2 | Db5:4 C5:2 Ab4:2 F4:8 | Eb5:4 Eb5:2 F5:2 Ab5:4 G5:2 F5:2 | G5:6 F5:2 Eb5:8' },
      sec: { i: { bars: 8, ch: 'Fm Db Ab Eb', dr: 'n', bass: 'a', arp: 'up8' },
             r: { bars: 8, ch: 'Fm Db Ab Eb', dr: 'a', fill: 'f', bass: 'a', arp: 'up8', lead: 'r' },
             v: { bars: 8, ch: 'Fm Db Ab Eb', dr: 'a', fill: 'f', bass: 'a', pad: 1, lead: 'v' },
             b: { bars: 8, ch: 'Fm Db Ab Eb', dr: 'b', pad: 1, arp: 'up', lead: 'v', lo: 12 },
             R: { bars: 8, ch: 'Fm Db Ab Eb', dr: 'a', fill: 'f', bass: 'a', pad: 1, arp: 'up8', lead: 'r' },
             o: { bars: 4, ch: 'Fm Db Ab Eb', dr: 'n', bass: 'a' } },
      order: ['i', 'r', 'v', 'r', 'b', 'R', 'o'] },

    { artist: 'Lumen Drift', title: 'Polar Lights', genre: 'Chillout', bpm: 84, kbps: 128,
      ins: { lead: { w: 'triangle', vol: .12, a: .03, vib: 5, vd: 20, cut: 3000 }, bass: { w: 'triangle', cut: 900, fenv: 0, vol: .2, s: .8 },
             arp: { w: 'triangle', vol: .05, d: .25, s: .1, r: .3 }, pad: { vol: .022, cut: 900, a: 1, r: 1.5 } },
      dr: { a: { k: 'x.........x.....', r: '....x.......x...', h: '..x...x...x...x.' },
            b: { k: 'x.........x..x..', r: '....x.......x...', h: 'x.x.x.x.x.x.xgx.', o: '..............x.' } },
      bass: { a: 'x-------x---5---' },
      arp: { p: '0.1.2.3.4.3.2.1.' },
      mel: { a: 'F#5:6 E5:2 D5:4 A4:4 | B4:6 C#5:2 D5:4 F#5:4 | E5:8 D5:4 B4:4 | C#5:12 r:4',
             b: 'A5:4 F#5:4 E5:4 D5:4 | D5:4 C#5:4 B4:8 | B4:4 D5:4 G5:6 F#5:2 | E5:16' },
      sec: { i: { bars: 4, ch: 'Dmaj7 Bm7 Gmaj7 A', pad: 1, arp: 'p' },
             a: { bars: 8, ch: 'Dmaj7 Bm7 Gmaj7 A', pad: 1, arp: 'p', bass: 'a', dr: 'a', lead: 'a' },
             b: { bars: 8, ch: 'Dmaj7 Bm7 Gmaj7 A', pad: 1, arp: 'p', bass: 'a', dr: 'b', lead: 'b' },
             A: { bars: 8, ch: 'Dmaj7 Bm7 Gmaj7 A', pad: 1, arp: 'p', bass: 'a', dr: 'b', lead: 'a', lo: 12 },
             o: { bars: 4, ch: 'Dmaj7 Bm7 Gmaj7 Dmaj7', pad: 1, arp: 'p' } },
      order: ['i', 'a', 'b', 'A', 'b', 'o'] },

    { artist: 'Pixel Knights', title: 'Quest of the Crystal Keep', genre: '8-bit Adventure', bpm: 150, kbps: 128,
      ins: { lead: { w: 'square', vol: .05, cut: 8000, q: .5, vib: 6, vd: 12, a: .002, d: .05, s: .8, r: .04 },
             bass: { w: 'triangle', cut: 4000, fenv: 0, q: .5, vol: .24, s: 1, r: .02 }, arp: { w: 'square', vol: .022, cut: 6000 } },
      dr: { a: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
            b: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
            f: { k: 'x.......x.......', s: '....x.....x.xxxx', h: 'x.x.x.x.x.......' } },
      bass: { a: 'x.o.x.o.x.o.x.o.' },
      mel: { a: 'E5 G5 C6:4 B5 A5 G5:4 | D5 G5 B5:4 A5 G5 D5:4 | C5 E5 A5:4 G5 E5 C5:4 | F5:4 A5:4 G5 F5 E5 D5 | E5 G5 C6:4 D6 E6 C6:4 | A5:4 F5:4 A5 C6 F6:4 | D6:4 B5 G5 D6 B5 G5:4 | C6:8 G5:4 C5:4',
             b: 'A4:4 C5:4 E5:4 A5:4 | G5:4 E5:4 B4:8 | C5:4 F5:4 A5:4 C6:4 | B5:4 G5:4 D5:4 B4:4',
             e: 'E5:4 G5:4 C6:8 | A5:4 F5:4 C5:8 | B4:4 D5:4 G5:8 | C6:16' },
      sec: { i: { bars: 4, ch: 'C G Am F', dr: 'a', bass: 'a', arp: 'up' },
             a: { bars: 8, ch: 'C G Am F C F G C', dr: 'a', fill: 'f', bass: 'a', arp: 'up', lead: 'a' },
             A: { bars: 8, ch: 'C G Am F C F G C', dr: 'b', fill: 'f', bass: 'a', arp: 'down', lead: 'a', lo: -12 },
             b: { bars: 8, ch: 'Am Em F G', dr: 'b', fill: 'f', bass: 'a', arp: 'up', lead: 'b' },
             e: { bars: 4, ch: 'C F G C', dr: 'a', bass: 'a', lead: 'e' } },
      order: ['i', 'a', 'A', 'b', 'a', 'b', 'e'] },

    { artist: 'Sublevel', title: 'Concrete Jungle', genre: "Drum'n'Bass", bpm: 174, kbps: 192,
      ins: { lead: { w: 'sawtooth', det: 6, vol: .045, cut: 2200, a: .05, vib: 5, vd: 10, r: .3 }, bass: { det: 14, cut: 300, fenv: 400, fd: .3, vol: .18, q: 2, s: .9 },
             arp: { vol: .02, cut: 2000 }, pad: { vol: .03, cut: 1100, a: 1 } },
      dr: { n: { h: 'x.x.x.x.x.x.x.x.' },
            a: { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
            b: { k: 'x.........x.....', s: '....x..g.g..x..g', h: 'x.xgx.xgx.xgx.xg' },
            c: { k: 'x.x.......x.....', s: '....x.......x.g.', h: 'x.x.x.xgx.x.x.xg', o: '..............x.' },
            f: { k: 'x.........x.....', s: '....x.x.x.xxxxXX' } },
      bass: { a: 'x-----x---x-----x-------x-----5-' },
      mel: { a: 'B5:8 A5:4 G5:4 | E5:16 | G5:8 E5:4 B4:4 | C5:16 | C6:8 B5:4 A5:4 | E5:16 | D5:8 F#5:4 A5:4 | F#5:12 r:4' },
      sec: { i: { bars: 8, ch: 'Em7 Em7 Cmaj7 Cmaj7 Am7 Am7 Bm7 Bm7', pad: 1, dr: 'n' },
             d: { bars: 16, ch: 'Em7 Em7 Cmaj7 Cmaj7 Am7 Am7 Bm7 Bm7', pad: 1, dr: 'b', fill: 'f', bass: 'a', lead: 'a' },
             k: { bars: 8, ch: 'Em7 Em7 Cmaj7 Cmaj7 Am7 Am7 Bm7 Bm7', pad: 1, arp: 'up' },
             D: { bars: 16, ch: 'Em7 Em7 Cmaj7 Cmaj7 Am7 Am7 Bm7 Bm7', dr: 'c', fill: 'f', bass: 'a', arp: 'up', lead: 'a', lo: -12 },
             o: { bars: 8, ch: 'Em7 Em7 Cmaj7 Cmaj7 Am7 Am7 Bm7 Em7', pad: 1, dr: 'a' } },
      order: ['i', 'd', 'k', 'D', 'o'] },

    { artist: 'Cassette Kid', title: 'Rainy Window', genre: 'Lo-fi', bpm: 76, kbps: 128, swing: .22, crackle: 1,
      ins: { lead: { w: 'triangle', vol: .11, cut: 2000, a: .02, vib: 4.5, vd: 16 }, bass: { w: 'sine', vol: .28, cut: 800, fenv: 0, s: .7, d: .4 },
             arp: { w: 'triangle', vol: .045, d: .4, s: .2, r: .4, cut: 1800, oct: 0 }, pad: { w: 'triangle', vol: .035, cut: 1200, a: .08, d: 1.5, s: .4, r: .6, det: 5 } },
      dr: { a: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xg' } },
      bass: { a: 'x-------x-5-----' },
      arp: { k: '..x...x...x.x...' },
      mel: { a: 'A4:3 C5:3 E5:4 G5:2 E5:4 | D5:6 B4:2 G4:8 | F4:3 A4:3 C5:4 E5:2 D5:4 | B4:6 G4:2 E4:8',
             b: 'C5:4 D5:2 E5:6 r:4 | G5:4 E5:4 D5:8 | F5:4 E5:2 D5:6 A4:4 | B4:16' },
      sec: { i: { bars: 4, ch: 'Fmaj7 Em7 Dm7 Cmaj7', pad: 1, arp: 'k' },
             a: { bars: 8, ch: 'Fmaj7 Em7 Dm7 Cmaj7', pad: 1, arp: 'k', bass: 'a', dr: 'a', lead: 'a' },
             b: { bars: 8, ch: 'Fmaj7 Em7 Dm7 Cmaj7', pad: 1, arp: 'k', bass: 'a', dr: 'a', lead: 'b' },
             o: { bars: 2, ch: 'Fmaj7 Cmaj7', pad: 1 } },
      order: ['i', 'a', 'b', 'a', 'o'] },

    { artist: 'Ctrl+Alt+Dance', title: 'Mainframe', genre: 'Techno', bpm: 130, kbps: 160, echo: .18,
      ins: { lead: { w: 'sawtooth', vol: .06, cut: 600, q: 12, fenv: 1800, fd: .09, a: .002, d: .1, s: .4, r: .03, vib: 0 },
             arp: { vol: .03, cut: 1800, d: .12, s: 0, r: .1, oct: 0 }, pad: { vol: .025 } },
      dr: { n: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
            a: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'xgxgxgxgxgxgxgxg' },
            b: { c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
            f: { k: 'x...x...x...x...', s: '........x.x.xxxx', o: '..x...x.........' } },
      arp: { s: '...x.....x....x.' },
      mel: { a: 'A2:1 A2:1 A3:1 A2:1 r:1 A2:1 C3:1 A2:1 G3:1 A2:1 r:1 E3:1 A2:1 A3:1 G2:1 C3:1 | A2:1 A2:1 A3:1 A2:1 r:1 A2:1 C3:1 A2:1 D3:1 D3:1 r:1 E3:1 G3:1 A3:1 C4:1 E3:1' },
      sec: { i: { bars: 8, ch: 'Am', dr: 'n' },
             u: { bars: 8, ch: 'Am', dr: 'n', lead: 'a', sweep: [250, 900] },
             m: { bars: 16, ch: 'Am Am Am Am F F G G', dr: 'a', fill: 'f', lead: 'a', arp: 's', sweep: [700, 2600] },
             b: { bars: 8, ch: 'Am Am F G', dr: 'b', pad: 1, arp: 's', lead: 'a', sweep: [2000, 400] },
             M: { bars: 8, ch: 'Am Am F G', dr: 'a', fill: 'f', lead: 'a', arp: 's', pad: 1, sweep: [1200, 3500] },
             o: { bars: 4, ch: 'Am', dr: 'n' } },
      order: ['i', 'u', 'm', 'b', 'M', 'o'] },

    { artist: 'Velvet Horizon', title: 'Letters I Never Sent', genre: 'Ballad', bpm: 72, kbps: 128,
      ins: { lead: { w: 'triangle', vol: .13, a: .08, vib: 5, vd: 22, cut: 2500, r: .3 }, bass: { w: 'triangle', vol: .2, cut: 700, fenv: 0, s: .8 },
             arp: { w: 'triangle', vol: .045, d: .5, s: .15, r: .5, cut: 2200, oct: 0 }, pad: { vol: .022, cut: 800, a: 1.2, r: 2 } },
      dr: { a: { k: 'x.........x.....', r: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
            f: { k: 'x.........x.....', r: '....x.......x...', s: '............x.xx' } },
      bass: { a: 'x-------5-------' },
      arp: { b: '0.1.2.3.2.1.0.1.' },
      mel: { a: 'B4:4 D5:4 G5:6 F#5:2 | F#5:6 E5:2 D5:8 | E5:4 G5:4 B5:4 A5:2 G5:2 | G5:8 E5:4 D5:4 | C5:4 E5:4 A5:6 G5:2 | F#5:6 E5:2 D5:4 A4:4 | B4:16 | r:16',
             b: 'B5:6 A5:2 G5:8 | E5:4 G5:4 C6:8 | B5:6 A5:2 G5:4 D5:4 | F#5:12 r:4',
             o: 'G5:16 | D5:8 B4:8 | G4:16 | r:16' },
      sec: { i: { bars: 2, ch: 'G C', arp: 'b' },
             a: { bars: 8, ch: 'G D Em C Am D G G', arp: 'b', bass: 'a', pad: 1, lead: 'a' },
             b: { bars: 4, ch: 'Em C G D', arp: 'b', bass: 'a', pad: 1, dr: 'a', lead: 'b' },
             A: { bars: 8, ch: 'G D Em C Am D G G', arp: 'b', bass: 'a', pad: 1, dr: 'a', fill: 'f', lead: 'a' },
             o: { bars: 4, ch: 'C G C G', arp: 'b', pad: 1, lead: 'o' } },
      order: ['i', 'a', 'b', 'A', 'b', 'o'] }
  ];

  /* ================= Tracks95: compiler ================= */
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const acc = a => a === '#' ? 1 : a === 'b' ? -1 : 0;
  function midiOf(s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) throw new Error('bad note ' + s);
    return PC[m[1]] + acc(m[2]) + (+m[3] + 1) * 12;
  }
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], 6: [0, 4, 7, 9] };
  function chord(name) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(name);
    if (!m || !QUAL[m[3]]) throw new Error('bad chord ' + name);
    const root = (PC[m[1]] + acc(m[2]) + 12) % 12, iv = QUAL[m[3]];
    const voice = iv.map(i => { let n = 55 + ((root + i - 55) % 12 + 12) % 12; return n; }).sort((a, b) => a - b); // tones within G3..F#4
    return { root, iv, voice, bass: 36 + root };
  }
  function parseMel(str) {
    const notes = []; let pos = 0;
    for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
      const [n, l] = tok.split(':'), len = l ? +l : 2;
      if (!(len > 0)) throw new Error('bad length ' + tok);
      if (n !== 'r') notes.push([pos, midiOf(n), len]);
      pos += len;
    }
    return { notes, len: pos };
  }
  const ARPS = { up: '0123', down: '3210', updown: '012321', up8: '0.1.2.3.' };
  const DRUM_VEL = { x: .75, X: 1, g: .35 };

  function compile(song) {
    if (song._c) return song._c;
    const ev = []; let step = 0, seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const name of song.order) {
      const sec = song.sec[name]; if (!sec) throw new Error('missing section ' + name);
      const S = sec.bars * 16, chords = sec.ch.trim().split(/\s+/).map(chord);
      for (let i = 0; i < S; i++) ev.push([]);
      const at = (i, e) => ev[step + i].push(e);
      for (let b = 0; b < sec.bars; b++) {
        const ch = chords[b % chords.length], b0 = b * 16;
        if (sec.pad) ch.voice.forEach(n => at(b0, ['pad', n, 16, .8]));
        if (sec.bass) {
          const pat = song.bass[sec.bass];
          for (let i = 0; i < 16; i++) {
            const c = pat[(b0 + i) % pat.length]; if (c === '.' || c === '-') continue;
            let len = 1; while (i + len < 16 && pat[(b0 + i + len) % pat.length] === '-') len++;
            const n = ch.bass + (c === 'o' ? 12 : c === '5' ? 7 : c === '3' ? ch.iv[1] : 0);
            at(b0 + i, ['bass', n, len, .9]);
          }
        }
        if (sec.arp) {
          const pat = ARPS[sec.arp] || song.arp[sec.arp], v = ch.voice;
          for (let i = 0; i < 16; i++) {
            const c = pat[(b0 + i) % pat.length];
            if (c === 'x') v.forEach(n => at(b0 + i, ['arp', n, 2, .8]));
            else if (c >= '0' && c <= '9') { const k = +c; at(b0 + i, ['arp', v[k % v.length] + 12 * Math.floor(k / v.length), 1, i % 4 ? .7 : 1]); }
          }
        }
        if (sec.dr) {
          const kit = song.dr[b === sec.bars - 1 && sec.fill ? sec.fill : sec.dr];
          for (const inst in kit) for (let i = 0; i < 16; i++) {
            const v = DRUM_VEL[kit[inst][(b0 + i) % kit[inst].length]]; if (v) at(b0 + i, [inst, 0, 1, v]);
          }
        }
        if (song.crackle) for (let i = 0; i < 16; i++) if (rnd() < .3) at(b0 + i, ['crk', 0, 1, .2 + rnd() * .8]);
      }
      if (sec.lead) {
        const m = song._mel[sec.lead] || (song._mel[sec.lead] = parseMel(song.mel[sec.lead]));
        for (let off = 0; off < S; off += m.len) for (const [p, n, l] of m.notes) {
          const i = off + p; if (i >= S) break;
          const e = ['lead', n + (sec.lo || 0), Math.min(l, S - i), 1];
          if (sec.sweep) e.push(sec.sweep[0] + (sec.sweep[1] - sec.sweep[0]) * i / S);
          at(i, e);
        }
      }
      step += S;
    }
    const sd = 60 / song.bpm / 4;
    return (song._c = { ev, steps: step, sd, dur: step * sd });
  }
  SONGS.forEach(s => { s._mel = {}; s.dur = compile(s).dur; });

  /* ================= Tracks95: synth + look-ahead scheduler ================= */
  const DEF = {
    lead: { w: 'square', a: .01, d: .12, s: .7, r: .1, vol: .08, cut: 5000, q: 1, vib: 5.5, vd: 18, det: 0, echo: 1 },
    bass: { w: 'sawtooth', a: .005, d: .15, s: .6, r: .06, vol: .16, cut: 700, q: 4, fenv: 900, fd: .12 },
    arp: { w: 'square', a: .003, d: .08, s: .25, r: .05, vol: .035, cut: 3500, q: 1, oct: 12 },
    pad: { w: 'sawtooth', a: .5, d: .6, s: .8, r: .8, vol: .025, cut: 1400, q: .7, det: 8, oct: 0 }
  };
  const noiseCache = new WeakMap();
  function noiseBuf(ac) {
    let b = noiseCache.get(ac); if (b) return b;
    b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, b); return b;
  }

  function createPlayer(ac, dest) {
    const out = ac.createGain(), comp = ac.createDynamicsCompressor(); out.gain.value = .8;
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    out.connect(comp); comp.connect(dest);
    const noise = noiseBuf(ac);
    let song = null, c = null, ins = null, bus = null, echoIn = null, state = 'stopped', t0 = 0, off = 0, next = 0, timer = 0;
    const P = { index: -1, scheduled: 0, onend: null };

    function makeBus() {
      bus = ac.createGain(); bus.connect(out);
      const d = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
      d.delayTime.value = Math.min(.9, c.sd * 3); fb.gain.value = .32; wet.gain.value = song.echo == null ? .22 : song.echo;
      echoIn = ac.createGain(); echoIn.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(bus);
    }
    function kill() {
      clearInterval(timer); timer = 0;
      if (bus) { const b = bus; b.gain.setTargetAtTime(0, ac.currentTime, .015); setTimeout(() => b.disconnect(), 250); bus = null; echoIn = null; }
    }
    function tone(I, m, t, dur, vel, cut) {
      const f = 440 * 2 ** ((m - 69) / 12), g = ac.createGain(), flt = ac.createBiquadFilter();
      dur = Math.max(dur, I.a + .02);
      flt.type = 'lowpass'; flt.Q.value = I.q || .7;
      const fc = cut || I.cut;
      if (I.fenv) { flt.frequency.setValueAtTime(fc + I.fenv, t); flt.frequency.exponentialRampToValueAtTime(fc, t + (I.fd || .1)); } else flt.frequency.value = fc;
      const pk = I.vol * vel, end = t + dur, stop = end + I.r * 4 + .05;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + I.a);
      g.gain.setTargetAtTime(pk * I.s, t + I.a, I.d / 3 + .001); g.gain.setTargetAtTime(0, end, I.r / 3 + .001);
      const n = I.det ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const o = ac.createOscillator(); o.type = I.w; o.frequency.value = f;
        if (I.det) o.detune.value = i ? I.det : -I.det;
        if (I.vib && dur > .25) {
          const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = I.vib;
          lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + .15); lg.gain.linearRampToValueAtTime(I.vd, t + .4);
          l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(stop);
        }
        o.connect(flt); o.start(t); o.stop(stop);
      }
      flt.connect(g); g.connect(bus);
      if (I.echo && echoIn) g.connect(echoIn);
      P.scheduled++;
    }
    function hit(kind, t, v) {
      const g = ac.createGain(); g.connect(bus);
      if (kind === 'k') {
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(44, t + .13);
        g.gain.setValueAtTime(.9 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
        o.connect(g); o.start(t); o.stop(t + .35);
      } else {
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(); s.buffer = noise;
        let len = .05, vol = .2, q = .7;
        if (kind === 's') { f.type = 'bandpass'; f.frequency.value = 1800; len = .18; vol = .45; q = .8;
          const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + .08);
          og.gain.setValueAtTime(.25 * v, t); og.gain.exponentialRampToValueAtTime(.001, t + .1); o.connect(og); og.connect(bus); o.start(t); o.stop(t + .12); }
        else if (kind === 'c') { f.type = 'bandpass'; f.frequency.value = 1200; len = .16; vol = .5; q = 1.2; }
        else if (kind === 'r') { f.type = 'bandpass'; f.frequency.value = 3200; len = .035; vol = .4; q = 3; }
        else if (kind === 'h') { f.type = 'highpass'; f.frequency.value = 7500; len = .04; vol = .14; }
        else if (kind === 'o') { f.type = 'highpass'; f.frequency.value = 6500; len = .26; vol = .11; }
        else { f.type = 'highpass'; f.frequency.value = 2500; len = .006; vol = .05; } // crackle
        f.Q.value = q;
        if (kind === 'c') { // three quick bursts
          g.gain.setValueAtTime(0, t);
          [0, .012, .024].forEach(d => { g.gain.setValueAtTime(vol * v, t + d); g.gain.exponentialRampToValueAtTime(vol * v * .2, t + d + .01); });
          g.gain.exponentialRampToValueAtTime(.001, t + .034 + len);
        } else { g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(.001, t + len); }
        s.connect(f); f.connect(g); s.start(t, Math.random() * .5); s.stop(t + len + .2);
      }
      P.scheduled++;
    }
    function fire(e, t) {
      const ch = e[0];
      if (ch === 'lead' || ch === 'bass' || ch === 'arp' || ch === 'pad') {
        const I = ins[ch], m = e[1] + (I.oct || 0);
        tone(I, m, t, e[2] * c.sd * (ch === 'arp' ? .9 : ch === 'pad' ? 1 : .95), e[3], e[4]);
      } else hit(ch, t, e[3]);
    }
    function stepTime(k) { return t0 + k * c.sd - off + (k & 1 ? c.sd * (song.swing || 0) : 0); }
    function tick() {
      if (state !== 'playing') return;
      const now = ac.currentTime, until = now + (document.hidden ? 1.5 : .12);
      if (next < c.steps && stepTime(next) < now - .08) t0 += now - stepTime(next) + .02; // clock jumped or timer stalled: resume, don't skip
      while (next < c.steps) {
        const t = stepTime(next); if (t > until) break;
        if (t >= now - .03) for (const e of c.ev[next]) fire(e, Math.max(t, now));
        next++;
      }
      if (next >= c.steps && now >= t0 + c.dur - off + .05) { kill(); state = 'stopped'; off = 0; if (P.onend) P.onend(); }
    }
    P.load = i => { P.stop(); P.index = i; song = SONGS[i]; c = compile(song);
      ins = {}; for (const k in DEF) ins[k] = Object.assign({}, DEF[k], song.ins && song.ins[k]); };
    P.play = () => {
      if (!song || state === 'playing') return;
      if (ac.state === 'suspended') ac.resume();
      makeBus(); state = 'playing'; t0 = ac.currentTime + .1;
      next = Math.max(0, Math.ceil(off / c.sd - 1e-6));
      timer = setInterval(tick, 25); tick();
    };
    P.pause = () => { if (state !== 'playing') return; off = P.time(); kill(); state = 'paused'; };
    P.stop = () => { kill(); state = 'stopped'; off = 0; };
    P.seek = s => {
      if (!c) return; const was = state === 'playing';
      if (was) kill();
      off = Math.max(0, Math.min(c.dur - .05, s));
      if (was) { state = 'paused'; P.play(); } else if (state === 'stopped' && off > 0) state = 'paused';
    };
    P.time = () => !c ? 0 : state === 'playing' ? Math.max(0, Math.min(c.dur, off + ac.currentTime - t0)) : off;
    P.duration = () => c ? c.dur : 0;
    P.state = () => state;
    P.step = () => next;
    P.song = () => song;
    return P;
  }

  /* one sound source at a time: claim(stopFn) stops whoever held the speakers before */
  let holder = null;
  window.Tracks95 = {
    list: SONGS, compile, createPlayer, parseMel, chord,
    claim(fn) { if (holder && holder !== fn) { const h = holder; holder = null; try { h(); } catch (e) { console.error(e); } } holder = fn; },
    release(fn) { if (holder === fn) holder = null; },
    fmt: s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  };

  /* ================= Amp 95 UI ================= */
  const T = window.Tracks95, fmt = T.fmt;
  const store = { get: (k, d) => Arcade.store.get('amp.' + k, d), set: (k, v) => Arcade.store.set('amp.' + k, v) };
  const SKINS = {
    classic: { name: 'Classic Steel', bg: '#40404f', bg2: '#202029', edge: '#6a6a80', dark: '#0c0c12', strip1: '#4a4a5e', strip2: '#262632', stxt: '#d4d4e4', groove: '#e0b030',
      lcd: '#000', fg: '#14e83c', dim: '#0b2e12', txt: '#b8bcd0', btn: '#55556a', btn2: '#30303c', acc: '#ffcc33', vis: ['#18c828', '#90e010', '#f0d000', '#ff3010'], peak: '#d0d0d8', osc: '#40ff70', sel: '#1840a0' },
    bento: { name: 'Bento Amber', bg: '#5a4532', bg2: '#2a1e14', edge: '#8a6c50', dark: '#140c06', strip1: '#6a5038', strip2: '#3a2a1c', stxt: '#f6dfb8', groove: '#ff8a3a',
      lcd: '#110902', fg: '#ffb030', dim: '#3a2408', txt: '#ead2ae', btn: '#6a5340', btn2: '#3c2c20', acc: '#ff7a40', vis: ['#ffd060', '#ffa830', '#ff6820', '#ff2810'], peak: '#fff2c8', osc: '#ffc848', sel: '#8a3c10' },
    ice: { name: 'Ice Blue', bg: '#3f5874', bg2: '#1a283a', edge: '#7090b4', dark: '#08101a', strip1: '#4a6684', strip2: '#22344a', stxt: '#e0f0ff', groove: '#9ae8ff',
      lcd: '#020a14', fg: '#5ee0ff', dim: '#0c2a3a', txt: '#cce2f8', btn: '#506c8c', btn2: '#2a3e56', acc: '#b0f4ff', vis: ['#3090ff', '#50c8ff', '#a0ecff', '#ffffff'], peak: '#ffffff', osc: '#a8f4ff', sel: '#1c6ab0' },
    plum: { name: 'Plum Rave', bg: '#4c3058', bg2: '#22122a', edge: '#80589a', dark: '#100614', strip1: '#5c3a6a', strip2: '#2c1838', stxt: '#f4dcff', groove: '#ff4fd0',
      lcd: '#0a020e', fg: '#ff5ce0', dim: '#3a0c34', txt: '#e8cff4', btn: '#64447a', btn2: '#341f42', acc: '#5cffe8', vis: ['#8040ff', '#c040ff', '#ff40d0', '#ff80a0'], peak: '#ffffff', osc: '#5cffe8', sel: '#7a1c8a' }
  };
  const BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const BLBL = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
  const PRESETS = { Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], Rock: [5, 3, -3, -5, -2, 2, 5, 6, 6, 6], Pop: [-1, 3, 4, 5, 3, -1, -2, -2, -1, -1],
    Techno: [5, 4, 0, -4, -3, 0, 5, 6, 6, 5], Dance: [7, 5, 2, 0, 0, -3, -4, -4, 0, 0], Classical: [0, 0, 0, 0, 0, 0, -4, -4, -4, -6] };

  const ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="2" width="16" height="12" fill="#1c1c26"/><rect x="0" y="2" width="16" height="2" fill="#e0b030"/><rect x="1" y="3" width="14" height="1" fill="#4a4a5e"/><rect x="1" y="5" width="9" height="6" fill="#000"/><rect x="2" y="8" width="1" height="2" fill="#18c828"/><rect x="4" y="6" width="1" height="4" fill="#90e010"/><rect x="6" y="7" width="1" height="3" fill="#18c828"/><rect x="8" y="9" width="1" height="1" fill="#18c828"/><rect x="11" y="5" width="4" height="1" fill="#6a6a80"/><rect x="11" y="7" width="4" height="1" fill="#6a6a80"/><rect x="11" y="9" width="2" height="2" fill="#ffcc33"/><rect x="1" y="12" width="2" height="1" fill="#9a9ab0"/><rect x="4" y="12" width="2" height="1" fill="#9a9ab0"/><rect x="7" y="12" width="2" height="1" fill="#9a9ab0"/><rect x="10" y="12" width="2" height="1" fill="#9a9ab0"/><rect x="13" y="12" width="2" height="1" fill="#9a9ab0"/></svg>';

  const SVG = {
    prev: '<svg viewBox="0 0 12 10"><rect x="1" y="1" width="2" height="8"/><path d="M7 1v8L3 5zM11 1v8L7 5z"/></svg>',
    play: '<svg viewBox="0 0 12 10"><path d="M3 1l7 4-7 4z"/></svg>',
    pause: '<svg viewBox="0 0 12 10"><rect x="3" y="1" width="2" height="8"/><rect x="7" y="1" width="2" height="8"/></svg>',
    stop: '<svg viewBox="0 0 12 10"><rect x="2" y="1" width="8" height="8"/></svg>',
    next: '<svg viewBox="0 0 12 10"><path d="M1 1v8l4-4zM5 1v8l4-4z"/><rect x="9" y="1" width="2" height="8"/></svg>',
    eject: '<svg viewBox="0 0 12 10"><path d="M6 1l5 5H1z"/><rect x="1" y="7" width="10" height="2"/></svg>'
  };

  Arcade.css(`
    .amp-root { --z: 1; zoom: var(--z); width: 275px; margin: 0 auto; font: 9px/1 var(--pixel); color: var(--a-txt); -webkit-user-select: none; user-select: none; touch-action: manipulation; }
    .amp-panel { background: linear-gradient(180deg, var(--a-bg) 0%, var(--a-bg2) 100%); box-shadow: inset 1px 1px var(--a-edge), inset -1px -1px var(--a-dark); padding: 0 4px 4px; position: relative; }
    .amp-panel + .amp-panel { margin-top: 1px; }
    .amp-strip { height: 14px; display: flex; align-items: center; gap: 4px; margin: 0 -4px 3px; padding: 0 3px; background: linear-gradient(180deg, var(--a-strip1), var(--a-strip2)); box-shadow: inset 0 1px var(--a-edge), inset 0 -1px var(--a-dark); }
    .amp-strip i { flex: 1; height: 5px; background: repeating-linear-gradient(180deg, var(--a-groove) 0 1px, transparent 1px 2px); opacity: .55; }
    .amp-strip b { color: var(--a-stxt); font: bold 8px/1 var(--pixel); letter-spacing: 2px; white-space: nowrap; }
    .amp-sb { width: 10px; height: 9px; padding: 0; border: 0; background: var(--a-btn); box-shadow: inset 1px 1px var(--a-edge), inset -1px -1px var(--a-dark); color: var(--a-stxt); font: 7px/9px var(--pixel); display: grid; place-items: center; cursor: pointer; }
    .amp-sb:active { box-shadow: inset -1px -1px var(--a-edge), inset 1px 1px var(--a-dark); }
    .amp-top { display: flex; gap: 4px; }
    .amp-scr { width: 93px; height: 42px; background: var(--a-lcd); box-shadow: inset 1px 1px var(--a-dark), inset -1px -1px var(--a-edge); display: block; image-rendering: pixelated; cursor: pointer; flex: none; }
    .amp-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .amp-marq { height: 13px; background: var(--a-lcd); color: var(--a-fg); box-shadow: inset 1px 1px var(--a-dark), inset -1px -1px var(--a-edge); padding: 2px 3px 0; overflow: hidden; white-space: pre; font: 9px/11px var(--pixel); text-shadow: 0 0 3px var(--a-fg); }
    .amp-info { display: flex; align-items: center; gap: 3px; font-size: 7px; letter-spacing: .5px; height: 11px; }
    .amp-info .amp-n { background: var(--a-lcd); color: var(--a-fg); padding: 1px 2px; min-width: 17px; text-align: right; font-size: 8px; box-shadow: inset 1px 1px var(--a-dark); }
    .amp-info .amp-led { margin-left: auto; color: var(--a-dim); }
    .amp-info .amp-led + .amp-led { margin-left: 2px; }
    .amp-info .amp-led.on { color: var(--a-fg); text-shadow: 0 0 3px var(--a-fg); }
    .amp-sl { display: flex; align-items: center; gap: 4px; height: 13px; }
    .amp-range { -webkit-appearance: none; appearance: none; height: 6px; margin: 0; padding: 0; border-radius: 0; background: var(--a-dark); box-shadow: inset 1px 1px #000, 0 1px var(--a-edge); cursor: pointer; outline: none; }
    .amp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 10px; background: linear-gradient(180deg, var(--a-edge), var(--a-btn2)); border: 0; box-shadow: inset 1px 1px rgba(255,255,255,.45), inset -1px -1px rgba(0,0,0,.6); }
    .amp-range::-moz-range-thumb { width: 12px; height: 10px; border: 0; border-radius: 0; background: linear-gradient(180deg, var(--a-edge), var(--a-btn2)); box-shadow: inset 1px 1px rgba(255,255,255,.45), inset -1px -1px rgba(0,0,0,.6); }
    .amp-range:focus-visible::-webkit-slider-thumb { outline: 1px dotted var(--a-acc); }
    .amp-vol { width: 68px; } .amp-bal { width: 38px; }
    .amp-tb { height: 12px; padding: 0 3px; border: 0; background: linear-gradient(180deg, var(--a-btn), var(--a-btn2)); box-shadow: inset 1px 1px var(--a-edge), inset -1px -1px var(--a-dark); color: var(--a-txt); opacity: .75; font: 7px/12px var(--pixel); cursor: pointer; display: flex; align-items: center; gap: 2px; }
    .amp-tb::before { content: ''; width: 3px; height: 3px; background: var(--a-dark); }
    .amp-tb.on { color: var(--a-stxt); opacity: 1; } .amp-tb.on::before { background: var(--a-fg); box-shadow: 0 0 3px var(--a-fg); }
    .amp-tb:active { box-shadow: inset -1px -1px var(--a-edge), inset 1px 1px var(--a-dark); }
    .amp-seek { display: block; width: 100%; margin: 5px 0 4px; height: 8px; }
    .amp-seek::-webkit-slider-thumb { width: 28px; height: 10px; }
    .amp-seek::-moz-range-thumb { width: 28px; height: 10px; }
    .amp-trans { display: flex; align-items: center; gap: 0; }
    .amp-trans .amp-b { width: 23px; height: 18px; border: 0; padding: 0; background: linear-gradient(180deg, var(--a-btn), var(--a-btn2)); box-shadow: inset 1px 1px var(--a-edge), inset -1px -1px var(--a-dark); color: var(--a-stxt); display: grid; place-items: center; cursor: pointer; }
    .amp-trans .amp-b svg { width: 11px; height: 9px; fill: currentColor; }
    .amp-trans .amp-b:active { box-shadow: inset -1px -1px var(--a-edge), inset 1px 1px var(--a-dark); background: var(--a-btn2); }
    .amp-trans .amp-b.amp-ej { width: 22px; height: 16px; margin-left: 6px; }
    .amp-trans .amp-tb { height: 14px; margin-left: 6px; }
    .amp-trans .amp-tb + .amp-tb { margin-left: 2px; }
    .amp-trans .amp-logo { margin-left: auto; font: bold 9px/1 var(--pixel); color: var(--a-groove); letter-spacing: 1px; opacity: .8; }
    .amp-eqtop { display: flex; align-items: center; gap: 3px; margin-bottom: 4px; }
    .amp-sel { height: 13px; font: 8px var(--pixel); background: var(--a-lcd); color: var(--a-fg); border: 0; box-shadow: inset 1px 1px var(--a-dark), inset -1px -1px var(--a-edge); padding: 0 1px; outline: none; }
    .amp-eqg { width: 113px; height: 19px; margin-left: auto; background: var(--a-lcd); box-shadow: inset 1px 1px var(--a-dark), inset -1px -1px var(--a-edge); display: block; image-rendering: pixelated; }
    .amp-eqs { display: flex; gap: 0; align-items: flex-start; }
    .amp-eqc { width: 20px; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 6px; letter-spacing: 0; }
    .amp-eqc.amp-pre { width: 28px; margin-right: 6px; }
    .amp-scale { display: flex; flex-direction: column; justify-content: space-between; height: 62px; font-size: 6px; margin-right: 4px; color: var(--a-txt); opacity: .8; text-align: right; }
    .amp-vs { width: 11px; height: 62px; position: relative; background: var(--a-dark); box-shadow: inset 1px 1px #000, 1px 0 var(--a-edge); cursor: pointer; touch-action: none; outline: none; }
    .amp-vs::before { content: ''; position: absolute; left: 4px; width: 3px; top: 3px; bottom: 3px; background: linear-gradient(180deg, var(--a-vis3), var(--a-vis1) 50%, var(--a-vis0)); opacity: .55; }
    .amp-vs b { position: absolute; left: -1px; width: 13px; height: 7px; background: linear-gradient(180deg, var(--a-edge), var(--a-btn2)); box-shadow: inset 1px 1px rgba(255,255,255,.45), inset -1px -1px rgba(0,0,0,.6); }
    .amp-vs:focus-visible b { outline: 1px dotted var(--a-acc); }
    .amp-list { height: 116px; overflow-y: auto; background: var(--a-lcd); box-shadow: inset 1px 1px var(--a-dark), inset -1px -1px var(--a-edge); padding: 2px 0; font: 9px/13px var(--pixel); color: var(--a-fg); scrollbar-width: thin; scrollbar-color: var(--a-btn) var(--a-dark); }
    .amp-row { display: flex; gap: 4px; padding: 0 4px; cursor: pointer; white-space: nowrap; }
    .amp-row span:first-child { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .amp-row.sel { background: var(--a-sel); }
    .amp-row.cur { color: #fff; text-shadow: 0 0 3px var(--a-fg); }
    .amp-plf { display: flex; align-items: center; gap: 3px; margin-top: 4px; font-size: 7px; }
    .amp-plf .amp-n { margin-left: auto; background: var(--a-lcd); color: var(--a-fg); padding: 2px 3px; font-size: 8px; box-shadow: inset 1px 1px var(--a-dark); }
    .amp-pop { z-index: 99990; }
    @media (pointer: coarse) { .amp-trans .amp-b { height: 22px; } .amp-tb { height: 14px; } }
  `);

  /* ---------- 7-segment digits ---------- */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  function seg7(g, x, y, ch, w, h, on, off, th = 2) {
    const m = (h - 3 * th) / 2, segs = SEG[ch] || '';
    const R = { a: [x + th, y, w - 2 * th, th], b: [x + w - th, y + th, th, m], c: [x + w - th, y + 2 * th + m, th, m], d: [x + th, y + h - th, w - 2 * th, th],
      e: [x, y + 2 * th + m, th, m], f: [x, y + th, th, m], g: [x + th, y + th + m, w - 2 * th, th] };
    for (const k in R) { if (!segs.includes(k) && !off) continue; g.fillStyle = segs.includes(k) ? on : off; g.fillRect(...R[k]); }
  }

  /* ---------- hover-card preview ---------- */
  function preview(g, w, h, t) {
    const S = SKINS.classic;
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, S.bg); bg.addColorStop(1, S.bg2);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = S.strip1; g.fillRect(0, 0, w, 12);
    g.fillStyle = S.groove; for (let y = 3; y < 9; y += 2) { g.fillRect(4, y, 70, 1); g.fillRect(w - 74, y, 70, 1); }
    g.fillStyle = S.stxt; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText('AMP 95', w / 2, 9);
    g.fillStyle = '#000'; g.fillRect(6, 18, 90, 56); g.fillRect(102, 18, w - 108, 14);
    const sec = Math.floor(t) % 600;
    const s = String(Math.floor(sec / 60)).padStart(2, '0') + String(sec % 60).padStart(2, '0');
    g.fillStyle = S.fg; g.beginPath(); g.moveTo(10, 23); g.lineTo(16, 27); g.lineTo(10, 31); g.fill();
    [...s].forEach((d, i) => seg7(g, 22 + i * 17 + (i > 1 ? 8 : 0), 22, d, 12, 20, S.fg, S.dim, 2));
    g.fillStyle = S.fg; g.fillRect(56, 27, 2, 2); g.fillRect(56, 35, 2, 2);
    for (let i = 0; i < 19; i++) {
      const v = Math.abs(Math.sin(t * 3 + i * .7) * Math.cos(t * 1.3 + i * .23)) * (1 - i / 30);
      const bh = Math.max(1, Math.round(v * 26));
      for (let y = 0; y < bh; y++) { g.fillStyle = S.vis[Math.min(3, Math.floor(y / 7))]; g.fillRect(9 + i * 4.5, 72 - y, 3, 1); }
    }
    const title = '  1. NEON VECTOR - MIDNIGHT OVERDRIVE (1:26)  ***';
    const off = Math.floor(t * 6) % title.length;
    g.fillStyle = S.fg; g.font = '9px monospace'; g.textAlign = 'left';
    g.save(); g.beginPath(); g.rect(104, 18, w - 112, 14); g.clip(); g.fillText((title.slice(off) + title).slice(0, 30), 105, 28); g.restore();
    g.fillStyle = S.txt; g.font = '7px monospace'; g.fillText('192 kbps  44 kHz  stereo', 104, 44);
    g.fillStyle = '#000'; g.fillRect(104, 52, 50, 4); g.fillStyle = S.edge; g.fillRect(104 + 30 + Math.sin(t) * 4, 50, 9, 8);
    g.fillStyle = '#000'; g.fillRect(6, 82, w - 12, 4); g.fillStyle = S.edge; g.fillRect(6 + ((t * 8) % (w - 30)), 80, 18, 8);
    g.fillStyle = S.btn; for (let i = 0; i < 5; i++) g.fillRect(6 + i * 22, 94, 21, 16);
    g.fillStyle = S.stxt; [0, 1, 2, 3, 4].forEach(i => g.fillRect(14 + i * 22, 99, 5, 6));
  }

  Arcade.app({
    id: 'amp', title: 'Amp 95', icon: ICON, width: 287, folder: 'Accessories', desktop: true, preview,
    hint: 'Skinnable late-90s music player: 8 original synthesized tracks, 10-band EQ, spectrum analyzer.',
    build(ctx) {
      let skin = store.get('skin', 'classic'); if (!SKINS[skin]) skin = 'classic';
      let eq = store.get('eq', PRESETS.Flat.slice()), pre = store.get('pre', 0), eqOn = store.get('eqOn', true), preset = store.get('preset', 'Flat');
      let vol = store.get('vol', 80), bal = store.get('bal', 0), shuffle = store.get('shuffle', false), repeat = store.get('repeat', true);
      let showEq = store.get('showEq', true), showPl = store.get('showPl', true), visMode = store.get('vis', 0), remain = false, dbl = store.get('dbl', false);
      let cur = 0, sel = 0;
      let ac = null, player = null, nodes = null, raf = 0;

      ctx.body.style.padding = '0';
      const root = Arcade.el(`<div class="amp-root">
        <div class="amp-panel amp-main">
          <div class="amp-strip"><button class="amp-sb amp-opt" title="Options menu" aria-label="Options menu">≡</button><i></i><b>AMP 95</b><i></i><button class="amp-sb amp-dbl" title="Double size" aria-label="Double size">D</button></div>
          <div class="amp-top">
            <canvas class="amp-scr" width="93" height="42" title="Click time: elapsed/remaining. Click analyzer: change mode" aria-label="Time and visualizer"></canvas>
            <div class="amp-right">
              <div class="amp-marq" aria-live="off"></div>
              <div class="amp-info"><span class="amp-n amp-kbps">128</span>kbps <span class="amp-n">44</span>kHz <span class="amp-led amp-mono">mono</span><span class="amp-led amp-st on">stereo</span></div>
              <div class="amp-sl"><input type="range" class="amp-range amp-vol" min="0" max="100" aria-label="Volume" title="Volume">
                <input type="range" class="amp-range amp-bal" min="-100" max="100" aria-label="Balance" title="Balance">
                <button class="amp-tb amp-teq" title="Toggle equalizer">EQ</button><button class="amp-tb amp-tpl" title="Toggle playlist">PL</button></div>
            </div>
          </div>
          <input type="range" class="amp-range amp-seek" min="0" max="1000" value="0" aria-label="Seek" title="Seek">
          <div class="amp-trans">
            <button class="amp-b" data-a="prev" title="Previous (Z)" aria-label="Previous">${SVG.prev}</button><button class="amp-b" data-a="play" title="Play (X)" aria-label="Play">${SVG.play}</button><button class="amp-b" data-a="pause" title="Pause (C)" aria-label="Pause">${SVG.pause}</button><button class="amp-b" data-a="stop" title="Stop (V)" aria-label="Stop">${SVG.stop}</button><button class="amp-b" data-a="next" title="Next (B)" aria-label="Next">${SVG.next}</button><button class="amp-b amp-ej" data-a="eject" title="Open (playlist)" aria-label="Eject">${SVG.eject}</button>
            <button class="amp-tb amp-shuf" title="Shuffle (S)">SHUF</button><button class="amp-tb amp-rep" title="Repeat (R)">REP</button>
            <span class="amp-logo">◆</span>
          </div>
        </div>
        <div class="amp-panel amp-eq">
          <div class="amp-strip"><i></i><b>EQUALIZER</b><i></i><button class="amp-sb amp-xeq" title="Close equalizer" aria-label="Close equalizer">×</button></div>
          <div class="amp-eqtop"><button class="amp-tb amp-eqon">ON</button><select class="amp-sel" aria-label="Equalizer preset"><option value="" hidden>Custom</option>${Object.keys(PRESETS).map(p => `<option>${p}</option>`).join('')}</select><canvas class="amp-eqg" width="113" height="19" aria-hidden="true"></canvas></div>
          <div class="amp-eqs"></div>
        </div>
        <div class="amp-panel amp-pl">
          <div class="amp-strip"><i></i><b>PLAYLIST</b><i></i><button class="amp-sb amp-xpl" title="Close playlist" aria-label="Close playlist">×</button></div>
          <div class="amp-list" role="listbox" aria-label="Playlist" tabindex="0"></div>
          <div class="amp-plf"><button class="amp-tb amp-plshuf">SHUF</button><button class="amp-tb amp-plrep">REP</button><span class="amp-n amp-tot"></span></div>
        </div>
      </div>`);
      ctx.body.appendChild(root);
      const $ = s => root.querySelector(s);
      const scr = $('.amp-scr'), sg = scr.getContext('2d'), marq = $('.amp-marq'), seek = $('.amp-seek'), volEl = $('.amp-vol'), balEl = $('.amp-bal');
      const eqg = $('.amp-eqg').getContext('2d'), list = $('.amp-list'), sels = $('.amp-sel');

      /* ---- sizing ---- */
      function applyZoom() {
        const want = dbl ? 2 : Arcade.coarse ? 1.35 : 1;
        const z = Math.max(1, Math.min(want, (innerWidth - 30) / 275));
        root.style.setProperty('--z', z);
        ctx.win.style.width = Math.round(275 * z + 12) + 'px';
      }
      applyZoom(); addEventListener('resize', applyZoom);

      /* ---- skins ---- */
      function applySkin() {
        const S = SKINS[skin];
        for (const k of ['bg', 'bg2', 'edge', 'dark', 'strip1', 'strip2', 'stxt', 'groove', 'lcd', 'fg', 'dim', 'txt', 'btn', 'btn2', 'acc', 'sel']) root.style.setProperty('--a-' + k, S[k]);
        S.vis.forEach((c, i) => root.style.setProperty('--a-vis' + i, c));
        updateVol(); drawEqGraph();
      }

      /* ---- audio graph (built lazily on the first user gesture) ---- */
      function ensureAudio() {
        if (player) { if (ac.state === 'suspended') ac.resume(); return true; }
        ac = Arcade.audio(); if (!ac) return false;
        const input = ac.createGain(), preG = ac.createGain();
        const filters = BANDS.map(f => { const b = ac.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = 1.4; return b; });
        const pan = ac.createStereoPanner ? ac.createStereoPanner() : null, volG = ac.createGain(), master = ac.createGain(), an = ac.createAnalyser();
        an.fftSize = 1024; an.smoothingTimeConstant = .55; an.minDecibels = -92; an.maxDecibels = -18;
        let n = input; n.connect(preG); n = preG; filters.forEach(f => { n.connect(f); n = f; });
        if (pan) { n.connect(pan); n = pan; } n.connect(volG); volG.connect(master); master.connect(an); an.connect(ac.destination);
        nodes = { input, preG, filters, pan, volG, master, an, freq: new Uint8Array(an.frequencyBinCount), wave: new Uint8Array(an.fftSize) };
        master.gain.value = Arcade.isMuted() ? 0 : 1;
        Arcade.onMute(m => nodes.master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, .02));
        player = T.createPlayer(ac, input);
        player.onend = onEnd;
        applyEq(); applyVol();
        return true;
      }
      const stopForOther = () => { if (player) player.stop(); render(); };

      /* ---- transport ---- */
      function playTrack(i) {
        cur = (i + T.list.length) % T.list.length; sel = cur;
        if (!ensureAudio()) return;
        T.claim(stopForOther);
        player.load(cur); player.play(); remainMarq(); render();
      }
      function play() {
        if (!ensureAudio()) return;
        const st = player.state();
        if (st === 'paused' && player.index === cur) { T.claim(stopForOther); player.play(); }
        else playTrack(cur);
        render();
      }
      function pause() { if (!player) return; const st = player.state(); if (st === 'playing') player.pause(); else if (st === 'paused') { T.claim(stopForOther); player.play(); } render(); }
      function stop() { if (player) player.stop(); render(); }
      const isPlaying = () => player && player.state() === 'playing';
      function pick(dir) {
        if (shuffle && T.list.length > 1) { let n; do n = Math.floor(Math.random() * T.list.length); while (n === cur); return n; }
        return (cur + dir + T.list.length) % T.list.length;
      }
      function skip(dir) {
        const n = pick(dir);
        if (isPlaying()) playTrack(n);
        else { cur = sel = n; if (player) player.stop(); remainMarq(); render(); }
      }
      function onEnd() {
        if (shuffle) return playTrack(pick(1));
        if (cur < T.list.length - 1) return playTrack(cur + 1);
        if (repeat) return playTrack(0);
        render();
      }
      function eject() {
        showPl = true; store.set('showPl', true); layout();
        flash = 'LOAD: DOUBLE-CLICK A TRACK IN THE PLAYLIST';
        flashUntil = performance.now() + 3500; marqPos = 0;
        list.focus();
      }

      /* ---- marquee ---- */
      let marqPos = 0, marqT = 0, flash = '', flashUntil = 0;
      const songLabel = i => `${i + 1}. ${T.list[i].artist} - ${T.list[i].title} (${fmt(T.list[i].dur)})`;
      function remainMarq() { marqPos = 0; }
      function tickMarq(now) {
        if (now - marqT < 160) return; marqT = now;
        const txt = (now < flashUntil ? flash : songLabel(cur)).toUpperCase() + '  ***  ';
        const n = 26;
        if (txt.length - 7 <= n) { marq.textContent = txt.slice(0, -7); return; }
        marqPos = (marqPos + 1) % txt.length;
        marq.textContent = (txt.slice(marqPos) + txt).slice(0, n + 2);
      }

      /* ---- the LCD: state glyph, 7-seg time, spectrum / oscilloscope ---- */
      const bars = new Float32Array(19), peaks = new Float32Array(19), peakV = new Float32Array(19);
      let blink = 0;
      function drawScreen(now) {
        const S = SKINS[skin], g = sg;
        g.fillStyle = S.lcd; g.fillRect(0, 0, 93, 42);
        const st = player ? player.state() : 'stopped';
        // state glyph
        g.fillStyle = S.fg;
        if (st === 'playing') { for (let i = 0; i < 4; i++) g.fillRect(4 + i, 5 + i, 1, 9 - 2 * i); }
        else if (st === 'paused') { g.fillRect(4, 5, 2, 8); g.fillRect(7, 5, 2, 8); }
        else g.fillRect(4, 6, 6, 6);
        // time
        const t = player && player.index === cur ? player.time() : 0, d = T.list[cur].dur;
        let v = remain ? Math.max(0, d - t) : t; v = Math.floor(v);
        const mm = String(Math.min(99, Math.floor(v / 60))).padStart(2, '0'), ss = String(v % 60).padStart(2, '0');
        const show = !(st === 'paused' && Math.floor(now / 500) % 2);
        if (remain && show) g.fillRect(14, 11, 5, 2);
        const digits = mm + ss;
        for (let i = 0; i < 4; i++) seg7(g, 22 + i * 12 + (i > 1 ? 7 : 0), 3, show ? digits[i] : ' ', 9, 15, S.fg, S.dim, 2);
        if (show) { g.fillStyle = S.fg; g.fillRect(46, 7, 2, 2); g.fillRect(46, 13, 2, 2); }
        // visualizer: 76x16 at (9,23)
        const vx = 9, vy = 23, vw = 76, vh = 16;
        const live = nodes && st === 'playing';
        if (visMode === 0) {
          if (live) nodes.an.getByteFrequencyData(nodes.freq);
          const binHz = ac ? ac.sampleRate / nodes.an.fftSize : 0;
          for (let i = 0; i < 19; i++) {
            let val = 0;
            if (live) {
              const f0 = 50 * Math.pow(16000 / 50, i / 19), f1 = 50 * Math.pow(16000 / 50, (i + 1) / 19);
              const a = Math.max(1, Math.floor(f0 / binHz)), b = Math.max(a + 1, Math.ceil(f1 / binHz));
              for (let k = a; k < b && k < nodes.freq.length; k++) val = Math.max(val, nodes.freq[k]);
              val = val / 255;
            }
            bars[i] = val > bars[i] ? val : Math.max(0, bars[i] - .045);
            if (bars[i] >= peaks[i]) { peaks[i] = bars[i]; peakV[i] = 0; } else { peakV[i] += .0018; peaks[i] = Math.max(0, peaks[i] - peakV[i]); }
            const bh = Math.round(bars[i] * vh), x = vx + i * 4;
            for (let y = 0; y < bh; y++) { g.fillStyle = S.vis[Math.min(3, Math.floor(y / vh * 4))]; g.fillRect(x, vy + vh - 1 - y, 3, 1); }
            const py = Math.round(peaks[i] * vh);
            if (py > 0) { g.fillStyle = S.peak; g.fillRect(x, vy + vh - 1 - Math.min(vh - 1, py), 3, 1); }
          }
        } else if (visMode === 1) {
          g.fillStyle = S.dim; for (let x = 0; x < vw; x += 2) g.fillRect(vx + x, vy + vh / 2, 1, 1);
          if (live) {
            nodes.an.getByteTimeDomainData(nodes.wave);
            // find a rising zero crossing so the trace holds still
            let s0 = 0; for (let k = 1; k < 400; k++) if (nodes.wave[k - 1] < 128 && nodes.wave[k] >= 128) { s0 = k; break; }
            g.fillStyle = S.osc; let py = null;
            for (let x = 0; x < vw; x++) {
              const w = nodes.wave[s0 + x * 3] || 128, y = Math.max(0, Math.min(vh - 1, Math.round((w - 128) / 128 * vh * 1.4 + vh / 2)));
              const y0 = py == null ? y : py; g.fillRect(vx + x, vy + Math.min(y, y0), 1, Math.abs(y - y0) + 1); py = y;
            }
          }
        }
        blink++;
      }

      /* ---- render state into the controls ---- */
      function render() {
        $('.amp-shuf').classList.toggle('on', shuffle); $('.amp-plshuf').classList.toggle('on', shuffle);
        $('.amp-rep').classList.toggle('on', repeat); $('.amp-plrep').classList.toggle('on', repeat);
        $('.amp-teq').classList.toggle('on', showEq); $('.amp-tpl').classList.toggle('on', showPl);
        $('.amp-eqon').classList.toggle('on', eqOn);
        $('.amp-kbps').textContent = T.list[cur].kbps;
        [...list.children].forEach((r, i) => { r.classList.toggle('cur', i === cur); r.classList.toggle('sel', i === sel); r.setAttribute('aria-selected', i === sel); });
      }
      function layout() { $('.amp-eq').hidden = !showEq; $('.amp-pl').hidden = !showPl; render(); }

      /* ---- volume / balance ---- */
      function updateVol() {
        const S = SKINS[skin], p = vol;
        volEl.style.background = `linear-gradient(90deg, ${S.vis[0]} 0%, ${p > 60 ? S.vis[2] : S.vis[1]} ${p}%, ${S.dark} ${p}%)`;
        const bp = (bal + 100) / 2;
        balEl.style.background = `linear-gradient(90deg, ${S.dark} ${Math.min(50, bp)}%, ${S.vis[0]} ${Math.min(50, bp)}%, ${S.vis[0]} ${Math.max(50, bp)}%, ${S.dark} ${Math.max(50, bp)}%)`;
      }
      function applyVol() {
        updateVol();
        if (!nodes) return;
        nodes.volG.gain.setTargetAtTime((vol / 100) ** 2 * 1.2, ac.currentTime, .02);
        if (nodes.pan) nodes.pan.pan.setTargetAtTime(bal / 100, ac.currentTime, .02);
      }
      function showMsg(m) { flash = m; flashUntil = performance.now() + 1200; marqPos = 0; marqT = 0; }
      volEl.value = vol; balEl.value = bal;
      volEl.addEventListener('input', () => { vol = +volEl.value; store.set('vol', vol); applyVol(); showMsg('VOLUME: ' + vol + '%'); });
      balEl.addEventListener('input', () => { bal = +balEl.value; if (Math.abs(bal) < 12) bal = 0; store.set('bal', bal); applyVol(); showMsg('BALANCE: ' + (bal === 0 ? 'CENTER' : Math.abs(bal) + '% ' + (bal < 0 ? 'LEFT' : 'RIGHT'))); });

      /* ---- seek ---- */
      let dragging = false;
      seek.addEventListener('input', () => { dragging = true; showMsg('SEEK TO: ' + fmt(seek.value / 1000 * T.list[cur].dur) + '/' + fmt(T.list[cur].dur)); });
      seek.addEventListener('change', () => {
        dragging = false;
        if (!ensureAudio()) return;
        if (player.index !== cur) player.load(cur);
        player.seek(seek.value / 1000 * T.list[cur].dur);
      });

      /* ---- equalizer ---- */
      const eqs = $('.amp-eqs');
      eqs.innerHTML = `<div class="amp-eqc amp-pre"><div class="amp-vs" data-b="-1" role="slider" tabindex="0" aria-label="Preamp" aria-valuemin="-12" aria-valuemax="12"><b></b></div>PREAMP</div>
        <div class="amp-scale"><span>+12</span><span>+0</span><span>-12</span></div>` +
        BANDS.map((f, i) => `<div class="amp-eqc"><div class="amp-vs" data-b="${i}" role="slider" tabindex="0" aria-label="${BLBL[i]} Hz" aria-valuemin="-12" aria-valuemax="12"><b></b></div>${BLBL[i]}</div>`).join('');
      const vsl = [...eqs.querySelectorAll('.amp-vs')];
      const getB = i => i < 0 ? pre : eq[i];
      function setB(i, v, quiet) {
        v = Math.max(-12, Math.min(12, Math.round(v * 2) / 2));
        if (i < 0) pre = v; else eq[i] = v;
        if (!quiet) { preset = ''; sels.value = ''; store.set('preset', ''); }
        store.set('eq', eq); store.set('pre', pre);
        posB(i); applyEq(); drawEqGraph();
      }
      function posB(i) { const el = vsl[i + 1], v = getB(i); el.firstChild.style.top = ((12 - v) / 24 * 55) + 'px'; el.setAttribute('aria-valuenow', v); }
      function applyEq() {
        if (!nodes) return;
        const t = ac.currentTime;
        nodes.filters.forEach((f, i) => f.gain.setTargetAtTime(eqOn ? eq[i] : 0, t, .03));
        nodes.preG.gain.setTargetAtTime(eqOn ? 10 ** (pre / 20) : 1, t, .03);
      }
      vsl.forEach(el => {
        const i = +el.dataset.b;
        const fromY = e => { const r = el.getBoundingClientRect(); return 12 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 24; };
        el.addEventListener('pointerdown', e => {
          e.preventDefault(); el.focus(); el.setPointerCapture(e.pointerId); setB(i, fromY(e));
          const mv = ev => setB(i, fromY(ev)), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        });
        el.addEventListener('dblclick', () => setB(i, 0));
        el.addEventListener('keydown', e => {
          const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4 }[e.key];
          if (d) { e.preventDefault(); e.stopPropagation(); setB(i, getB(i) + d); } else if (e.key === 'Home' || e.key === '0') { e.preventDefault(); setB(i, 0); }
        });
      });
      function loadPreset(name) { preset = name; store.set('preset', name); PRESETS[name].forEach((v, i) => setB(i, v, true)); sels.value = name; showMsg('EQ PRESET: ' + name); }
      sels.addEventListener('change', () => { if (sels.value) loadPreset(sels.value); sels.blur(); });
      $('.amp-eqon').onclick = () => { eqOn = !eqOn; store.set('eqOn', eqOn); applyEq(); drawEqGraph(); render(); };
      function drawEqGraph() {
        const S = SKINS[skin], g = eqg, W = 113, H = 19;
        g.fillStyle = S.lcd; g.fillRect(0, 0, W, H);
        g.fillStyle = S.dim; for (let x = 0; x < W; x += 2) g.fillRect(x, 9, 1, 1);
        g.fillStyle = S.dim; g.fillRect(0, Math.round(9 - pre / 12 * 8), W, 1);
        const pts = eq.map((v, i) => [3 + i * (W - 7) / 9, 9 - v / 12 * 8]);
        let py = null;
        for (let x = 0; x < W; x++) {
          const fx = Math.max(0, Math.min(9, (x - 3) / ((W - 7) / 9))), i0 = Math.min(8, Math.floor(fx)), u = fx - i0;
          const s = u * u * (3 - 2 * u), y = Math.round(pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * s);
          g.fillStyle = eqOn ? S.vis[Math.min(3, Math.round(Math.abs(y - 9) / 3))] : S.dim;
          const y0 = py == null ? y : py; g.fillRect(x, Math.min(y, y0), 1, Math.abs(y - y0) + 1); py = y;
        }
      }
      sels.value = PRESETS[preset] ? preset : '';
      vsl.forEach((_, k) => posB(k - 1));

      /* ---- playlist ---- */
      list.innerHTML = T.list.map((s, i) => `<div class="amp-row" role="option" data-i="${i}"><span>${i + 1}. ${Arcade.esc(s.artist)} - ${Arcade.esc(s.title)}</span><span>${fmt(s.dur)}</span></div>`).join('');
      const total = T.list.reduce((a, s) => a + s.dur, 0);
      $('.amp-tot').textContent = `${T.list.length} TRACKS  ${fmt(total)}`;
      list.addEventListener('click', e => { const r = e.target.closest('.amp-row'); if (!r) return; sel = +r.dataset.i; if (Arcade.coarse) playTrack(sel); else render(); });
      list.addEventListener('dblclick', e => { const r = e.target.closest('.amp-row'); if (r) playTrack(+r.dataset.i); });
      list.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + T.list.length) % T.list.length; render(); list.children[sel].scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); playTrack(sel); }
      });

      /* ---- buttons ---- */
      const ACT = { prev: () => skip(-1), play, pause, stop, next: () => skip(1), eject };
      root.querySelectorAll('.amp-b').forEach(b => b.addEventListener('click', () => ACT[b.dataset.a]()));
      const togShuf = () => { shuffle = !shuffle; store.set('shuffle', shuffle); showMsg('SHUFFLE: ' + (shuffle ? 'ON' : 'OFF')); render(); };
      const togRep = () => { repeat = !repeat; store.set('repeat', repeat); showMsg('REPEAT: ' + (repeat ? 'ON' : 'OFF')); render(); };
      $('.amp-shuf').onclick = togShuf; $('.amp-plshuf').onclick = togShuf; $('.amp-rep').onclick = togRep; $('.amp-plrep').onclick = togRep;
      const togEq = () => { showEq = !showEq; store.set('showEq', showEq); layout(); };
      const togPl = () => { showPl = !showPl; store.set('showPl', showPl); layout(); };
      $('.amp-teq').onclick = togEq; $('.amp-xeq').onclick = togEq; $('.amp-tpl').onclick = togPl; $('.amp-xpl').onclick = togPl;
      const togDbl = () => { dbl = !dbl; store.set('dbl', dbl); applyZoom(); };
      $('.amp-dbl').onclick = togDbl;
      scr.addEventListener('click', e => {
        const r = scr.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
        if (y < .5) remain = !remain; else { visMode = (visMode + 1) % 3; store.set('vis', visMode); bars.fill(0); peaks.fill(0); showMsg('VISUALIZATION: ' + ['SPECTRUM', 'OSCILLOSCOPE', 'OFF'][visMode]); }
      });

      /* ---- options / right-click menu ---- */
      let pop = null;
      const closePop = () => { if (pop) { pop.remove(); pop = null; } };
      document.addEventListener('pointerdown', e => { if (pop && !e.target.closest('.amp-pop')) closePop(); });
      function menuItems() {
        return [
          ...Object.keys(SKINS).map(k => ({ label: 'Skin: ' + SKINS[k].name, radio: () => skin === k, action: () => { skin = k; store.set('skin', k); applySkin(); showMsg('SKIN: ' + SKINS[k].name); } })),
          '-',
          { label: 'Spectrum analyzer', radio: () => visMode === 0, action: () => { visMode = 0; store.set('vis', 0); } },
          { label: 'Oscilloscope', radio: () => visMode === 1, action: () => { visMode = 1; store.set('vis', 1); } },
          { label: 'Visualization off', radio: () => visMode === 2, action: () => { visMode = 2; store.set('vis', 2); } },
          '-',
          { label: 'Time remaining', checked: () => remain, action: () => { remain = !remain; } },
          { label: 'Double size', checked: () => dbl, action: togDbl },
          { label: 'Equalizer', key: 'Alt+G', checked: () => showEq, action: togEq },
          { label: 'Playlist editor', key: 'Alt+E', checked: () => showPl, action: togPl },
          { label: 'Shuffle', key: 'S', checked: () => shuffle, action: togShuf },
          { label: 'Repeat', key: 'R', checked: () => repeat, action: togRep },
          '-',
          { label: 'Keyboard shortcuts…', action: () => Arcade.dialog({ title: 'Amp 95', text: 'Z previous · X play · C pause · V stop · B next · ←/→ seek 5 s · ↑/↓ volume · S shuffle · R repeat · Click the time to show remaining time; click the analyzer to switch spectrum / oscilloscope / off. Right-click anywhere on the player for skins.' }) },
          { label: 'About Amp 95…', action: () => Arcade.dialog({ title: 'About Amp 95', text: `Amp 95 v2.95, a late-90s player tribute. Every note is synthesized live in your browser: ${T.list.length} original tracks, ${fmt(total)} of music, zero bytes of MP3.` }) }
        ];
      }
      function openPop(x, y) {
        closePop();
        const dd = Arcade.el('<div class="dropdown bevel-out amp-pop" role="menu"></div>');
        menuItems().forEach(it => {
          if (it === '-') { dd.appendChild(document.createElement('hr')); return; }
          const b = Arcade.el('<button role="menuitem"><span></span><span></span><span class="key"></span></button>');
          b.children[0].textContent = it.checked && it.checked() ? '✓' : it.radio && it.radio() ? '•' : '';
          b.children[1].textContent = it.label; b.children[2].textContent = it.key || '';
          b.addEventListener('click', e => { e.stopPropagation(); closePop(); it.action(); render(); });
          dd.appendChild(b);
        });
        document.body.appendChild(dd); pop = dd;
        dd.style.left = Math.max(2, Math.min(x, innerWidth - dd.offsetWidth - 2)) + 'px';
        dd.style.top = Math.max(2, Math.min(y, innerHeight - dd.offsetHeight - 2)) + 'px';
      }
      root.addEventListener('contextmenu', e => { if (e.target.closest('select')) return; e.preventDefault(); openPop(e.clientX, e.clientY); });
      $('.amp-opt').addEventListener('click', e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); openPop(r.left, r.bottom + 1); });

      /* ---- keyboard ---- */
      ctx.onKey(e => {
        if (e.ctrlKey || e.metaKey) return;
        const k = e.key.toLowerCase();
        if (e.altKey) { if (k === 'g') { e.preventDefault(); togEq(); } else if (k === 'e') { e.preventDefault(); togPl(); } return; }
        const map = { z: () => skip(-1), x: play, c: pause, v: stop, b: () => skip(1), s: togShuf, r: togRep, l: eject,
          arrowleft: () => player && player.index === cur && player.seek(player.time() - 5), arrowright: () => player && player.index === cur && player.seek(player.time() + 5),
          arrowup: () => { volEl.value = vol = Math.min(100, vol + 5); store.set('vol', vol); applyVol(); showMsg('VOLUME: ' + vol + '%'); },
          arrowdown: () => { volEl.value = vol = Math.max(0, vol - 5); store.set('vol', vol); applyVol(); showMsg('VOLUME: ' + vol + '%'); } };
        if (map[k]) { e.preventDefault(); map[k](); }
      });

      /* ---- animation loop (only while visible) ---- */
      function frame(now) {
        raf = 0; if (!ctx.isVisible()) return;
        drawScreen(now); tickMarq(now);
        if (!dragging) {
          const t = player && player.index === cur ? player.time() : 0;
          seek.value = Math.round(t / T.list[cur].dur * 1000);
        }
        raf = requestAnimationFrame(frame);
      }
      const kick = () => { if (!raf && ctx.isVisible()) raf = requestAnimationFrame(frame); };
      ctx.on('open', kick); ctx.on('restore', kick);
      ctx.on('close', () => { closePop(); if (player) { player.stop(); T.release(stopForOther); } render(); });

      applySkin(); layout(); kick();
      Arcade.apps.amp.api = { play, pause, stop, next: () => skip(1), prev: () => skip(-1), playTrack, player: () => player, nodes: () => nodes, state: () => ({ cur, eq, pre, eqOn, skin, visMode, shuffle, repeat }) };
    }
  });
})();

// MORE MUSIC THAN THE ONE THEME (src/audio/pieces.ts MUSIC.pieces; music.ts deals the pieces): is the theme untouched with the switch off, does every newer piece play at
// every tension, are they different pieces, and does the deal hand them round? The sequencer is driven here over a recording backend on a made-up clock (no audio device,
// no browser): what is held is WHICH NOTES ARE ASKED FOR AND WHEN. What they sound like is tools/qa/music-page.cjs (levels, measured in Chromium) and a listener's ears.
//   bun run tools/qa/music-check.ts                exit 0 = all pass, 1 = a line failed          (also `probes.ts music`)
//   MUSIC_BREAK=1 bun run tools/qa/music-check.ts  the red path: every newer piece is the first one over again, no table is the visit's own, nobody says the menu is up or which level it is, a level loses its row, a string in tune is called out of it — 'different', 'foundation', 'a tape', 'the menu', 'every level', "the level's music" and 'acoustic' must FAIL
//   run it on BOTH stands (TPS_PROFILE=shipped in front): the 'stand' line says which one it found
// WHAT IS HELD:
//   stand       the switch is off on the frozen stand and on on the shipped one (TPS_MUSIC=1 raises it), has its FROZEN_HOLDS row and its word, and ?onetheme puts it off
//   the theme   switch off: two minutes of the score at calm, suspicious and firefight ask for the notes they asked for before pieces.ts existed (digests pinned from the
//               tree before it), call nothing of the newer voices, and never change piece; a backend WITHOUT the newer voices plays the same with the switch on
//   each piece  on its own for ninety seconds at each tension: it plays, in time (no note in the past, none more than the look-ahead late), within sane pitch and level,
//               not a machine gun; the kit is silent at calm and there in a firefight; it uses voices the theme does not have
//   different   no two pieces (the theme among them) ask for the same notes at any tension, and no two share tempo and metre
//   foundation  Cold Storage and Wire Act stand on a bass line and a break: the line at rest, the break under it once anyone is uneasy, whole in a firefight
//   the deal    an hour of calm on four seeds: the visit opens on a newer piece, every newer one is heard before the theme comes round, none twice running, a
//   every level each mission's level (and the solo night's) has two pieces written for it (audio/setlist.ts), never the theme; no row for a level that is not there
//   the level's music   MUSIC.byLevel: the score plays the level's list in its order whatever the page's die says, its first piece off the menu; a restart keeps it; ?shuffle = the bag
//   the menu    while the main menu is up (Music.menu) the score asks for the theme's own notes and deals nothing; a piece begins when play does; back on the menu, the theme
//   a tape      a run tape's player (replay/engineplay.ts) writes the tape's knob tables over the page's and leaves MUSIC as the viewer's page has it
//               bar-long swell leads each handover and ends on the new piece's first note; a piece picked by hand is not dealt straight back; a firefight holds a piece to twice its minutes and no longer; a mission that starts early keeps its piece, one that starts late moves on
import { ROOT } from './headless.ts';
import type { Piece } from '../../src/audio/pieces';
const { Music } = await import(`${ROOT}/src/audio/music.ts`);
const { MUSIC, PIECES, PIECE_NAMES, THEME } = await import(`${ROOT}/src/audio/pieces.ts`);
const { hashStr, mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { pageSwitches, FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
const { STRUCK, TUNED, struck, tuned, tunedSecs, struckAt, tunedAt } = await import(`${ROOT}/src/audio/acoustic.ts`);

/** the theme's note streams as they were before pieces.ts (120 s at 25 ms a tick; events and a hash of them), taken from the tree at 179fddd1 */
const PIN: Record<string, [number, string]> = { '0': [130, '6f3e1702'], '0.5': [870, '48593b95'], '1': [1279, '249f6194'] };
const NEWER = ['pluck', 'keys', 'strings', 'wind', 'perc', 'cymbalRoll', 'padTone', 'echo', 'setMore', 'warmTuned'];
const KIT = ['kick', 'snare'], SYNTH_KIT = ['kick', 'snare', 'hat', 'reverseNoise'], THEME_TEX = ['metal', 'swell'];   // (the theme's own drums are oscillators and noise: no newer piece plays them. Its struck metal and its swell stay in Paper Walls, as he heard it)

interface Ev { name: string; t: number; now: number; a: unknown[] }
interface Run { ev: Ev[]; digest: string; music: InstanceType<typeof Music>; step(secs: number, each?: (now: number) => void): void }
const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(5) : Array.isArray(v) ? '[' + v.map(fmt).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => k + ':' + fmt((v as Record<string, unknown>)[k])).join(',') + '}' : String(v);
/** a score over a recording backend on its own clock; `themeOnly` = a backend without the newer voices */
function score(x: number, themeOnly = false): Run {
  let now = 0, tick: (() => void) | null = null; const ev: Ev[] = [];
  const be = new Proxy({}, { get: (_t, name: string) => name === 'now' ? () => now : themeOnly && NEWER.includes(name) ? undefined
    : (...a: unknown[]) => { if (name !== 'setLevels' && name !== 'setMaster') ev.push({ name, t: typeof a[0] === 'number' ? a[0] : now, now, a }); } });
  const si = globalThis.setInterval; (globalThis as { setInterval: unknown }).setInterval = (fn: () => void) => { tick = fn; return 0; };
  let music: InstanceType<typeof Music>; try { music = new Music(be); } finally { globalThis.setInterval = si; }
  music.intensity = x;
  const run: Run = { ev, music, get digest() { return hashStr(ev.map(e => e.name + '(' + e.a.map(fmt).join(',') + ')').join('\n')).toString(16); },
    step(secs, each) { for (let i = 0; i < secs * 40; i++) { now += 0.025; tick!(); each?.(now); } } };
  return run;
}
/** a handover's lead-out, as 'the deal' reads it: a swell a bar long that ends on the first pad chord of the piece that began at `now` */
const ledTo = (r: Run, now: number) => { const T = r.ev.find(e => e.name === 'padChord' && e.now >= now - 1e-9)?.t ?? -1; return r.ev.some(e => e.name === 'swell' && (e.a[1] as number) >= 1.3 && Math.abs(e.t + (e.a[1] as number) - T) < 1e-6); };
const nums = (v: unknown): number[] => typeof v === 'number' ? [v] : Array.isArray(v) ? v.flatMap(nums) : v && typeof v === 'object' ? Object.values(v).flatMap(nums) : [];

export async function musicCheck(): Promise<boolean> {
  let bad = 0; const line = (ok: boolean, what: string, detail = '') => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!ok) bad++; };
  const stand = MUSIC.pieces as boolean, keep = { ...MUSIC }, sys = Math.random;
  if (process.env.MUSIC_BREAK === '1') (PIECES as Piece[]).fill(PIECES[0]);   // the red path: every newer piece is the first one
  try {
    // ---- stand
    const want = process.env.TPS_MUSIC !== undefined ? process.env.TPS_MUSIC === '1' : harnessProfile() === 'shipped';
    pageSwitches(new URLSearchParams('')); const page = MUSIC.pieces, pageL = MUSIC.byLevel; pageSwitches(new URLSearchParams('onetheme')); const off = MUSIC.pieces; pageSwitches(new URLSearchParams('shuffle')); const offL = MUSIC.byLevel, onL = MUSIC.pieces; MUSIC.pieces = stand; MUSIC.byLevel = keep.byLevel;
    line(stand === want && page === true && off === false && /TPS_MUSIC=1/.test(FROZEN_HOLDS['MUSIC.pieces'] ?? '') && STAND_ENV.includes('TPS_MUSIC'),
      `stand: the ${harnessProfile()} stand has the pieces ${stand ? 'ON' : 'OFF'}; the page has them on, ?onetheme off`, `stand ${stand} (expected ${want}) · page ${page} · ?onetheme ${off} · row ${FROZEN_HOLDS['MUSIC.pieces']}`);
    line(keep.byLevel === want && pageL === true && offL === false && onL === true && /TPS_MUSIC=1/.test(FROZEN_HOLDS['MUSIC.byLevel'] ?? ''),
      `stand: the ${harnessProfile()} stand has the level's own music ${keep.byLevel ? 'ON' : 'OFF'}; the page has it on, ?shuffle off (and the pieces still on)`, `stand ${keep.byLevel} (expected ${want}) · page ${pageL} · ?shuffle ${offL}, pieces ${onL} · row ${FROZEN_HOLDS['MUSIC.byLevel']}`);

    // ---- the theme, switch off — and on a backend without the newer voices, switch on
    for (const themeOnly of [false, true]) {
      MUSIC.pieces = themeOnly; const got: string[] = []; let ok = true;
      for (const x of [0, 0.5, 1]) {
        const r = score(x, themeOnly); r.step(120); const [n, h] = PIN[String(x)];
        got.push(`x ${x}: ${r.ev.length} events ${r.digest}`);
        ok &&= r.ev.length === n && r.digest === h && r.music.piece === 0 && r.music.changes === 0 && !r.ev.some(e => NEWER.includes(e.name));
      }
      line(ok, themeOnly ? 'the theme: a backend without the newer voices plays it note for note, switch on' : 'the theme: switch off, the score asks for the notes it always did', got.join(' · '));
    }
    { MUSIC.pieces = false; const r = score(0); r.step(40 * 60); line(r.music.piece === 0 && r.music.changes === 0, 'the theme: switch off, forty minutes never leave it', `piece ${r.music.piece} · changes ${r.music.changes}`); }

    // ---- each piece on its own, and against the others
    MUSIC.pieces = true; MUSIC.minutes = 1e6;   // (no handover while a piece is heard alone)
    const backbeats: Record<string, number> = {}, gaps: Record<string, number> = {};
    const digests: Record<string, string[]> = {}; const meter: string[] = [`${THEME.bpm}/${THEME.steps}`];
    for (let i = 0; i < PIECE_NAMES.length; i++) {
      const name = PIECE_NAMES[i] as string, why: string[] = [], said: string[] = []; digests[name] = [];
      if (i) meter.push(`${(PIECES[i - 1] as Piece).bpm}/${(PIECES[i - 1] as Piece).steps}`);
      const counts: number[] = [], band = new Set<string>();
      for (const x of [0, 0.5, 1]) {
        const r = score(x); r.music.setPiece(i, true); r.step(90);
        const notes = r.ev.filter(e => !['padTone', 'echo', 'setMore', 'padChord', 'warmTuned'].includes(e.name)), rate = notes.length / 90, by = new Set(notes.map(e => e.name));
        digests[name].push(r.digest); counts.push(notes.length); said.push(`x ${x}: ${notes.length} notes (${rate.toFixed(1)}/s) ${[...by].sort().join(' ')}`);
        if (r.music.piece !== i) why.push(`x ${x}: piece ${r.music.piece} playing`);
        if (rate < (x ? 1.5 : 0.4)) why.push(`x ${x}: nearly silent`);
        if (rate > 40) why.push(`x ${x}: ${rate.toFixed(0)} notes a second`);
        const late = notes.filter(e => e.t < e.now - 1e-6 || e.t > e.now + 0.6); if (late.length) why.push(`x ${x}: ${late.length} notes out of time (first ${late[0].name} t ${late[0].t.toFixed(3)} at ${late[0].now.toFixed(3)})`);
        const wild = r.ev.filter(e => nums(e.a).some(n => !Number.isFinite(n))); if (wild.length) why.push(`x ${x}: ${wild.length} calls with a number that is not one (${wild[0].name})`);
        const pitch = notes.filter(e => ['sub', 'reese', 'pluck', 'keys', 'wind'].includes(e.name) && !((e.a[1] as number) >= 20 && (e.a[1] as number) <= 4000)); if (pitch.length) why.push(`x ${x}: ${pitch.length} notes out of range (${pitch[0].name} ${pitch[0].a[1]} Hz)`);
        const loud = notes.filter(e => ['kick', 'snare', 'hat', 'metal'].includes(e.name) ? (e.a[1] as number) > 1.2 : ['pluck', 'keys', 'wind', 'strings'].includes(e.name) ? (e.a[3] as number) > 1 : e.name === 'perc' ? (e.a[2] as number) > 1.2 : false); if (loud.length) why.push(`x ${x}: ${loud.length} notes too loud (${loud[0].name})`);
        const kit = notes.filter(e => KIT.includes(e.name) || (e.name === 'perc' && KIT.includes(e.a[1] as string))).length;
        if (i) { const synth = notes.filter(e => SYNTH_KIT.includes(e.name) || (name !== 'Paper Walls' && THEME_TEX.includes(e.name))); if (synth.length) why.push(`x ${x}: ${synth.length} hits of the theme's synth kit (${synth[0].name})`);
          const unknown = notes.filter(e => e.name === 'perc' ? !STRUCK.includes(e.a[1]) : e.name === 'keys' ? !['vibes', 'rhodes', 'bell', ...TUNED].includes(e.a[5]) : false); if (unknown.length) why.push(`x ${x}: a voice nobody makes (${unknown[0].a[unknown[0].name === 'perc' ? 1 : 5]})`);
          for (const e of notes) if (e.name === 'perc') band.add(e.a[1] as string); else if (e.name === 'keys') band.add(e.a[5] as string); else if (e.name === 'wind') band.add(e.a[4] as string); else if (e.name === 'strings') band.add(`strings ${e.a[5]}`); else if (e.name === 'pluck') band.add('bass');
          if (x === 1) { const hits = notes.filter(e => e.name === 'perc' && e.a[1] === 'snare').map(e => [e.t, e.a[2] as number]); const spb = 60 / (PIECES[i - 1] as Piece).bpm / 4;
            backbeats[name] = hits.filter(h => h[1] > 0.6).length / (90 / (spb * (PIECES[i - 1] as Piece).steps)); let gap = 9; for (let k = 1; k < hits.length; k++) gap = Math.min(gap, (hits[k][0] - hits[k - 1][0]) / spb); gaps[name] = gap; } }
        if (x === 0 && kit) why.push(`calm: ${kit} kit hits`); if (x === 1 && kit < 60) why.push(`firefight: only ${kit} kit hits`);
        if (i && !notes.some(e => NEWER.includes(e.name))) why.push(`x ${x}: none of the newer voices`);
      }
      if (!(counts[2] > counts[0])) why.push(`a firefight (${counts[2]} notes) is no busier than calm (${counts[0]})`);
      if (i && band.size < 8) why.push(`a band of ${band.size}`);
      line(!why.length, `${name}: plays at calm, suspicious and firefight`, why.length ? why.join(' · ') : said.join('\n    ') + (i ? `\n    the band (${band.size}): ${[...band].sort().join(' ')}` : ''));
    }
    { const names = PIECE_NAMES as string[], same: string[] = [];
      for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
        for (let k = 0; k < 3; k++) if (digests[names[a]][k] === digests[names[b]][k]) same.push(`${names[a]} = ${names[b]} at x ${[0, 0.5, 1][k]}`);
        if (meter[a] === meter[b]) same.push(`${names[a]} and ${names[b]} share ${meter[a]}`);
      }
      line(!same.length, `different: ${names.length} pieces, no two the same notes, no two the same tempo and metre`, same.length ? same.slice(0, 6).join(' · ') : names.map((n, i) => `${n} ${meter[i]}`).join(' · ')); }

    // ---- his notes of 10-14, held: Dead Freight is four in a bar with no stroke of the snare crowding the last (no roll, no stutter); Undertow's kit doubles in a firefight
    { const df = (PIECES.find((p: Piece) => p.name === 'Dead Freight') ?? PIECES[0]) as Piece, ut = (PIECES.find((p: Piece) => p.name === 'Undertow') ?? PIECES[0]) as Piece;   // (the red path has one piece under every name: these two lines fail on it, they do not die)
      const half = (() => { const r = score(0.5); r.music.setPiece(PIECE_NAMES.indexOf('Undertow'), true); r.step(90); return r.ev.filter(e => e.name === 'perc' && e.a[1] === 'snare' && (e.a[2] as number) > 0.6).length / (90 / (60 / ut.bpm * 4)); })();
      line(df.steps === 16 && gaps['Dead Freight'] > 0.8 && backbeats['Dead Freight'] > 1.6, 'smooth: Dead Freight is four in a bar, two backbeats to it, and no two snare strokes closer than a sixteenth', `${df.steps} steps · ${backbeats['Dead Freight']?.toFixed(2)} backbeats a bar · closest strokes ${gaps['Dead Freight']?.toFixed(2)} of a sixteenth apart`);
      line(half > 0.8 && half < 1.2 && backbeats.Undertow > 3.2, 'double time: Undertow has one backbeat a bar when uneasy and four in a firefight', `uneasy ${half.toFixed(2)} a bar · firefight ${backbeats.Undertow?.toFixed(2)} a bar`); }
    // ---- the break and the bass (the maintainer, 10-14: "the jazzy breakbeats and phenomenal bass work as the foundation are really what pull me in"): in the two pieces
    //      built on them the bass line is there at rest (its bones, most of three notes to a bar of the band's — Cold Storage's band is in half time over its kit — and no kit), the break is in once anyone is uneasy (a ride, ghost notes on
    //      the snare, a stick on the rim for the backbeat) and whole in a firefight (two backbeats a bar on the snare), and the bass slides into some of its notes
    { const why: string[] = [], said: string[] = [];
      for (const name of ['Cold Storage', 'Wire Act']) {
        const i = PIECE_NAMES.indexOf(name), p = (PIECES[i - 1] ?? PIECES[0]) as Piece, bars = 90 / (60 / p.bpm / 4 * p.steps);
        const at = (x: number) => { const r = score(x); r.music.setPiece(Math.max(1, i), true); r.step(90); const perc = (k: string, lo = 0, hi = 9) => r.ev.filter(e => e.name === 'perc' && e.a[1] === k && (e.a[2] as number) > lo && (e.a[2] as number) <= hi).length / bars;
          return { bass: r.ev.filter(e => e.name === 'pluck').length / bars, slides: r.ev.filter(e => e.name === 'pluck' && (e.a[4] as number) > 0).length, kit: perc('kick') + perc('snare'), ghosts: perc('snare', 0, 0.3), ride: perc('ride') + perc('rideBell'), rim: perc('rim'), back: perc('snare', 0.75) }; };   // (a backbeat: over anything a push or a ghost can be, whatever the die gives it)
        const c = at(0), u = at(0.5), f = at(1);
        said.push(`${name}: at rest ${c.bass.toFixed(1)} bass notes a bar; uneasy ${u.bass.toFixed(1)}, ${u.ghosts.toFixed(1)} ghosts, ${u.ride.toFixed(1)} on the ride, ${u.rim.toFixed(1)} on the rim; firefight ${f.back.toFixed(1)} backbeats, ${f.slides} slides`);
        if (i < 1) why.push(`${name} is not in the score`);
        if (c.bass < (p.bpm > 150 ? 1.25 : 2.5) || c.kit > 0) why.push(`${name} at rest: ${c.bass.toFixed(1)} bass notes a bar, ${c.kit.toFixed(1)} kit hits`);
        if (u.bass <= c.bass || u.ghosts < 1 || u.ride < 3 || u.rim < 1.2) why.push(`${name} uneasy: no break under the line`);
        if (f.back < 1.5 || f.back > 2.6 || f.ride < 2 || f.slides < 10) why.push(`${name} in a firefight: ${f.back.toFixed(1)} backbeats a bar, ${f.slides} slides`);
      }
      line(!why.length, 'the foundation: in Cold Storage and Wire Act the bass line is there at rest, the break under it once anyone is uneasy, whole in a firefight', why.length ? why.join(' · ') : said.join(' · ')); }
    // ---- the acoustic voices themselves (src/audio/acoustic.ts, made here as the page makes them): every one is a finite sound that starts at once, dies by its end, and — a
    //      string — is in tune
    { const sr = 48000, bad: string[] = []; let made = 0, worst = 0;
      const look = (name: string, a: Float32Array, secs: number, struckNow = true) => { made++; let pk = 0, at = 0, e = 0; for (let k = 0; k < a.length; k++) { const v = Math.abs(a[k]); if (!Number.isFinite(v)) { bad.push(`${name}: not a number`); return; } if (v > pk) { pk = v; at = k; } e += v * v; }
        let tail = 0; for (let k = a.length - 240; k < a.length; k++) tail = Math.max(tail, Math.abs(a[k]));
        if (Math.abs(pk - 0.9) > 0.01) bad.push(`${name}: peak ${pk.toFixed(2)}`); if (tail > 0.01) bad.push(`${name}: still sounding at its end (${tail.toFixed(3)})`); if (struckNow && at / sr > 0.06) bad.push(`${name}: its peak is ${(at / sr * 1000).toFixed(0)} ms in`);
        if (Math.sqrt(e / a.length) < 0.01) bad.push(`${name}: next to silent`); if (Math.abs(a.length / sr - secs) > 0.01) bad.push(`${name}: ${(a.length / sr).toFixed(2)} s long`); };
      const cents = (a: Float32Array, f: number) => { const s0 = Math.floor(sr * 0.12), n = Math.floor(sr * 0.25), cor = (l: number) => { let c = 0; for (let k = 0; k < n; k++) c += a[s0 + k] * a[s0 + k + l]; return c; };
        let best = -1, bl = 0; for (let l = Math.floor(sr / (f * 1.1)); l <= Math.ceil(sr / (f / 1.1)); l++) { const c = cor(l); if (c > best) { best = c; bl = l; } }
        const y0 = cor(bl - 1), y1 = cor(bl), y2 = cor(bl + 1); return 1200 * Math.log2(sr / (bl + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)) / f); };
      for (const k of STRUCK) for (const take of [0, 1]) { const a = struck(sr, k, take); look(`${k} ${take}`, a, a.length / sr, k !== 'roll' && k !== 'brush' && k !== 'gong'); }
      { const a = struck(sr, 'roll', 0), w = sr / 5; let best = 0, at = 0; for (let k = 0; k + w < a.length; k += sr / 50) { let e = 0; for (let q = 0; q < w; q++) e += a[k + q] * a[k + q]; if (e > best) { best = e; at = k + w / 2; } } if (Math.abs(at / sr - 3) > 0.3) bad.push(`roll: loudest at ${(at / sr).toFixed(2)} s, not 3`); }
      for (const k of TUNED) for (const note of k === 'bass' || k === 'timp' ? [28, 34, 43] : [50, 62, 74, 86]) { const f = 440 * 2 ** ((note - 69) / 12), a = tuned(sr, k, f); look(`${k} ${note}`, a, tunedSecs(k, f));
        if (['bass', 'koto', 'harp', 'guitar', 'dulcimer', 'piano', 'pizz'].includes(k)) { const c = cents(a, f); worst = Math.max(worst, Math.abs(c)); if (process.env.MUSIC_BREAK === '1' ? Math.abs(c) < 12 : Math.abs(c) > 12) bad.push(`${k} ${note}: ${c.toFixed(1)} cents off`); } }
      { const a = struckAt(sr, 'kick', 0), b = struckAt(sr, 'kick', 0), c = tunedAt(sr, 'koto', 441); if (a.data !== b.data || a.rate !== sr / 2 || Math.abs(c.f - 440) > 1e-9) bad.push('a voice is made twice, or a low drum at the full rate, or a note off the keys'); }
      line(!bad.length, `acoustic: ${made} struck and tuned voices are whole sounds, and every string is in tune`, bad.length ? bad.slice(0, 6).join(' · ') : `${STRUCK.length} struck kinds (two takes each) · ${TUNED.length} tuned kinds · strings within ${worst.toFixed(1)} cents`); }
    // ---- the deal
    MUSIC.minutes = keep.minutes;
    const opened = new Set<number>();
    for (const seed of [1, 4, 6, 7]) {   // (four seeds, four different pieces to open on)
      Math.random = mulberry32(seed);
      const r = score(0); const heard: number[] = [], at: number[] = []; let last = -1;
      const N = PIECES.length; r.step((8 * N + 4) * 60, now => { if (r.music.piece !== last) { last = r.music.piece; heard.push(last); at.push(now); } });
      // a handover's lead-out: a swell a whole bar long (1.3 s at the least) that ends on the first note of the piece it leads to (its first pad chord)
      const led = at.slice(1).filter(now => { const T = r.ev.find(e => e.name === 'padChord' && e.now >= now - 1e-9)?.t ?? -1; return r.ev.some(e => e.name === 'swell' && (e.a[1] as number) >= 1.3 && Math.abs(e.t + (e.a[1] as number) - T) < 1e-6); }).length;
      const first = heard.slice(0, N), why: string[] = []; opened.add(heard[0]);
      if (heard[0] === 0) why.push('the visit opens on the theme');
      if (new Set(first).size !== N || first.includes(0)) why.push(`the first ${N} are not the ${N} newer pieces`);
      if (!heard.slice(N, 2 * N).includes(0)) why.push(`the theme does not come round in the second ${N}`);
      if (heard.some((p, k) => k > 0 && p === heard[k - 1])) why.push('a piece twice running');
      if (heard.length < 2 * N || heard.length > 2 * N + 2) why.push(`${heard.length} pieces in ${8 * N + 4} minutes`);
      if (led !== heard.length - 1) why.push(`${led} lead-out swells for ${heard.length - 1} handovers`);
      line(!why.length, `the deal, seed ${seed}: an hour of calm hands every piece round`, why.length ? why.join(' · ') : heard.map(p => PIECE_NAMES[p]).join(' → '));
    }
    line(opened.size >= 3, 'the deal: the seeds open on different pieces', [...opened].map(p => PIECE_NAMES[p]).join(' · '));
    { Math.random = mulberry32(5); const r = score(0); r.step(30); const a = r.music.piece; r.music.setPiece(a === 2 ? 3 : 2); const shown = r.music.picked; r.music.setPiece(a); r.step(30); const off = r.music.piece === a && r.music.changes === 1;
      const b = a === 2 ? 3 : 2; r.music.setPiece(b); r.step(10); const seen: number[] = []; let last = b; r.step(30 * 60, () => { if (r.music.piece !== last) { last = r.music.piece; seen.push(last); } });
      line(shown !== a && off && r.music.changes > 3 && !seen.slice(0, 4).includes(b), 'the deal: a piece picked by hand shows as picked, picking the playing one calls it off, and the deal does not hand a picked piece straight back', `picked shown ${shown !== a} · called off ${off} · after ${PIECE_NAMES[b]}: ${seen.slice(0, 4).map(p => PIECE_NAMES[p]).join(' → ')}`); }
    { Math.random = mulberry32(7); const r = score(1); let at = -1; const p0 = { v: -1 };
      r.step(20 * 60, now => { if (p0.v < 0) p0.v = r.music.piece; else if (at < 0 && r.music.piece !== p0.v) at = now; });
      line(at > MUSIC.minutes * 120 && at < MUSIC.minutes * 120 + 30, `the deal: a firefight holds a piece ${MUSIC.minutes * 2} minutes, then it moves on at a phrase end`, `handover at ${(at / 60).toFixed(2)} min`); }
    { Math.random = mulberry32(9); const r = score(0); r.step(MUSIC.missionAfter - 15); const a = r.music.piece; r.music.mission(); r.step(15); const kept = r.music.piece === a && r.music.changes === 1;
      r.step(10); r.music.mission(); r.step(15); const moved = r.music.piece !== a && r.music.changes === 2;
      MUSIC.pieces = false; const t = score(0); t.step(120); t.music.mission(); t.step(30);
      line(kept && moved && t.music.piece === 0, `the deal: a mission ${MUSIC.missionAfter - 15} s in keeps its piece, one past ${MUSIC.missionAfter} s gets the next; switch off, none`, `kept ${kept} · moved ${moved} · switch off: piece ${t.music.piece}`); }
    // ---- the main menu (the maintainer, 10-14: "we should only have the main theme on the main menu"): the theme and nothing dealt while it is up, a piece when play
    //      begins, the theme again on coming back
    { MUSIC.pieces = true; MUSIC.minutes = keep.minutes; Math.random = mulberry32(3);
      const BREAK = process.env.MUSIC_BREAK === '1', up = (r: Run, v: boolean) => { r.music.menu = v && !BREAK; };   // (the red path: nobody tells the score the menu is up)
      const newer = (r: Run, from = 0) => r.ev.slice(from).some(e => NEWER.includes(e.name) && e.name !== 'padTone');
      const r = score(0); up(r, true); r.step(120);
      const [n, pin] = PIN['0'], theme = r.ev.length === n && r.digest === pin && r.music.piece === 0;
      r.step(12 * 60); const stays = r.music.piece === 0 && r.music.changes === 0 && !r.ev.some(e => NEWER.includes(e.name));
      up(r, false); let at = -1; r.step(12, now => { if (at < 0 && r.music.piece !== 0) at = now; }); const first = r.music.piece, led = at > 0 && ledTo(r, at);
      r.step(60); up(r, true); let back = -1, t1 = -1; const t0 = r.ev[r.ev.length - 1].now; r.step(12, now => { if (back < 0 && r.music.piece === 0) { back = now - t0; t1 = now; } }); const ledBack = t1 > 0 && ledTo(r, t1);
      r.step(12 * 60); const held = r.music.piece === 0 && r.music.changes === 2;
      up(r, false); r.step(12); const again = r.music.piece !== 0 && r.music.piece !== first;
      line(theme && stays && first !== 0 && led && back > 0 && back < 9 && ledBack && held && again, 'the menu: only the theme while the main menu is up, a piece when play begins, the theme again on coming back to it',
        `two minutes of menu = the theme's own notes ${theme} · twelve more minutes never leave it ${stays} · play begins: ${PIECE_NAMES[first]} behind its lead-out ${led} · back on the menu: the theme ${back.toFixed(1)} s on behind its lead-out ${ledBack}, and held ${held} · play again: ${PIECE_NAMES[r.music.piece]}`);
      // the edges: a visit that is back on the menu before the handover, a mission dealt on the frame the menu opens, a piece picked by hand, a quick way out and back
      { const why: string[] = [];
        { const q = score(0); up(q, true); q.step(20); up(q, false); q.step(0.025); up(q, true); const from = q.ev.length; q.step(60);   // play for one tick: the handover was on its way
          if (q.music.piece !== 0 || q.music.changes !== 0 || newer(q, from)) why.push(`a tick of play, then the menu: ${PIECE_NAMES[q.music.piece]}, ${q.music.changes} begun`); }
        { const q = score(0); q.step(MUSIC.missionAfter + 15); const a = q.music.piece; up(q, true); q.music.mission(); q.step(12); const b = q.music.piece, c = q.music.changes; q.step(60);   // (main.ts: the menu's flag, then the mission, before the score's next turn)
          if (a === 0 || b !== 0 || c !== 2 || q.music.changes !== 2) why.push(`a mission on the frame the menu opens: ${PIECE_NAMES[a]} → ${PIECE_NAMES[b]}, ${q.music.changes} begun`); }
        { const q = score(0); q.step(20); q.music.setPiece(2); q.step(20); const a = q.music.piece; up(q, true); q.step(12); const b = q.music.piece; q.step(6 * 60);   // picked in play: the menu still takes it back
          if (a !== 2 || b !== 0 || q.music.piece !== 0) why.push(`picked by hand in play, then the menu: ${PIECE_NAMES[a]} → ${PIECE_NAMES[b]} → ${PIECE_NAMES[q.music.piece]}`);
          up(q, true); q.music.setPiece(3); q.step(20); const d = q.music.piece, k = q.music.changes; up(q, false); q.step(20);   // picked on the menu: left alone there, and it plays on into play
          if (!BREAK && (d !== 3 || q.music.piece !== 3 || q.music.changes !== k)) why.push(`picked by hand on the menu: ${PIECE_NAMES[d]}, then ${PIECE_NAMES[q.music.piece]} in play`); }
        { const q = score(0); q.step(20); const a = q.music.piece; up(q, true); q.step(0.5); up(q, false); q.step(20);   // out to the menu and straight back: the piece never left, so it plays on
          if (q.music.piece !== a || q.music.changes !== 1) why.push(`half a second of menu: ${PIECE_NAMES[a]} → ${PIECE_NAMES[q.music.piece]}, ${q.music.changes} begun`); }
        { let q = score(0), seed = 3; for (;;) { Math.random = mulberry32(seed++); q = score(0); q.step(MUSIC.missionAfter + 5); if (PIECE_NAMES[q.music.piece] !== 'Paper Walls') break; }   // (Paper Walls has a swell of its own)
          q.music.mission(); const from = q.ev.length; let on = false; q.step(8, () => { if (!on && q.ev.slice(from).some(e => e.name === 'swell')) { on = true; up(q, true); } });   // the menu opens under a lead-out already sounding
          const swells = q.ev.slice(from).filter(e => e.name === 'swell').length;
          if (!BREAK && (!on || q.music.piece !== 0 || swells !== 1)) why.push(`the menu under a lead-out: ${swells} swells, then ${PIECE_NAMES[q.music.piece]}`);
          if (BREAK && q.music.piece === 0) why.push('the menu under a lead-out: the theme with nobody saying the menu is up'); }
        line(!why.length && !BREAK, 'the menu, at its edges: back before the handover, a mission on the frame it opens, a piece picked by hand, half a second of it, under a lead-out', why.join(' · ') || (BREAK ? 'nobody says the menu is up' : 'the theme each time it should be, the piece each time it should not')); } }
    // ---- the level's own music (the maintainer, 10-15: "we should curate the music for each level, not do it randomly"): every mission's level has a list written for it,
    //      and the score plays that list in its order whatever the page's die says
    { const S: any = await import(`${ROOT}/src/audio/setlist.ts`), L: any = await import(`${ROOT}/src/scene/scenarioList.ts`), BREAK = process.env.MUSIC_BREAK === '1';
      const rows = { ...S.SETLISTS }; if (BREAK) delete S.SETLISTS.records;   // (the red path: a level loses its row, and nobody tells the score its level)
      try {
        const why: string[] = [], KINDS = ['roomclear', 'nightbreach', 'rescue', 'quiet'], leads = new Set<string>();
        const sound = (key: string, names: readonly string[]) => { if (names.length !== 2) why.push(`${key}: ${names.length} pieces, not the two (the one that opens it, the one that follows)`); if (new Set(names).size !== names.length) why.push(`${key}: a piece twice`);
          for (const n of names) { const i = PIECE_NAMES.indexOf(n); if (i < 0) why.push(`${key}: no piece named ${n}`); else if (i === 0) why.push(`${key}: the theme is the menu's`); } };
        for (const e of L.ALL_MISSIONS) { const k = S.setlistKey(L.pickSearch(e)), r = S.setlistNames(k.level, k.kind);
          if (k.level !== L.levelWords(e) || k.kind !== e.kind) why.push(`${e.id} is read as ${k.level}:${k.kind}`); else if (!r.own) why.push(`${e.id} (${k.level}) has no row`); else leads.add(r.names[0]); }
        { const k = S.setlistKey('?solo'); if (k.level !== 'office' || k.kind !== null || S.setlistNames(k.level, k.kind).names !== S.SETLISTS.office) why.push('the solo night is not the office row'); }
        if (S.setlistKey('?roomclear&levelFile=records-gwot.json').level !== 'records') why.push("a level's look file is not read as the level");
        if (S.setlistNames('no-such-level', 'quiet').own || S.setlistOf('no-such-level').length < 2) why.push('a level with no row has no music');
        { const k = S.setlistKey('?roomclear&levelFile=office-t20.json'); if (S.setlistNames(k.level, k.kind).key !== 'office:roomclear') why.push('a file of the office family is not read as the office'); }
        for (const odd of ['constructor', 'toString', '__proto__']) { let got = ''; try { const r = S.setlistNames(odd, 'quiet'); got = r.own || S.setlistOf(odd).length !== 2 ? 'a row' : ''; } catch (e) { got = String(e); } if (got) why.push(`a level named ${odd}: ${got}`); }   // (the level's name comes off a URL)
        for (const [key, names] of Object.entries(S.SETLISTS as Record<string, readonly string[]>)) { const [lv, kind] = key.split(':');
          if (lv !== 'office' && !(await Bun.file(`${ROOT}/levels/${lv}.json`).exists())) why.push(`${key}: no such level`);
          if (kind !== undefined && !KINDS.includes(kind)) why.push(`${key}: no such kind`);
          sound(key, names); if (S.setlistOf(lv, kind ?? null).length !== names.length) why.push(`${key}: not every name is played`); }
        sound('the rest', S.SETLIST_ELSE);
        const never = PIECE_NAMES.slice(1).filter((n: string) => !leads.has(n)); if (never.length) why.push(`opens no level: ${never.join(', ')}`);
        line(!why.length, `every level: each of the ${L.ALL_MISSIONS.length} missions and the solo night has music written for its level, two pieces, never the theme, and every piece opens some level`,
          why.slice(0, 6).join(' · ') || `${Object.keys(S.SETLISTS).length} rows · leads: ${PIECE_NAMES.slice(1).map((n: string) => `${n} ${Object.values(S.SETLISTS as Record<string, readonly string[]>).filter(r => r[0] === n).length}`).join(', ')}`);
      } finally { for (const k of Object.keys(S.SETLISTS)) delete S.SETLISTS[k]; Object.assign(S.SETLISTS, rows); }
      MUSIC.pieces = true; MUSIC.byLevel = true; MUSIC.minutes = keep.minutes;
      const list = S.setlistOf('records') as number[], tell = (r: Run, l: readonly number[] = list) => { if (!BREAK) r.music.setlist = l; };
      const why: string[] = [], orders = new Set<string>(); let said = '';
      for (const seed of [1, 4, 6, 7]) { Math.random = mulberry32(seed);   // (the seeds 'the deal' opens four different pieces on)
        const r = score(0); tell(r); const heard: number[] = [], at: number[] = []; let last = -1; r.step(MUSIC.minutes * 3.5 * 60, now => { if (r.music.piece !== last) { last = r.music.piece; heard.push(last); at.push(now); } });
        orders.add(heard.join()); said = heard.map(p => PIECE_NAMES[p]).join(' → ');
        if (heard.join() !== [list[0], list[1], list[0], list[1]].slice(0, heard.length).join() || heard.length < 3) why.push(`seed ${seed}: ${said}`);
        else if (at.slice(1).filter(now => ledTo(r, now)).length !== heard.length - 1) why.push(`seed ${seed}: a handover with no lead-out`); }
      if (orders.size !== 1) why.push(`${orders.size} orders on four seeds`);
      { Math.random = mulberry32(2); const r = score(0); tell(r); r.music.menu = true; r.step(40); const a = r.music.piece; r.music.menu = false; r.step(12); if (a !== 0 || r.music.piece !== list[0]) why.push(`off the menu: ${PIECE_NAMES[a]} → ${PIECE_NAMES[r.music.piece]}`);   // off the menu's theme onto the level's first piece
        r.step(MUSIC.missionAfter + 30); r.music.mission(); r.step(20); if (r.music.piece !== list[0] || r.music.changes !== 1) why.push(`a restart ${MUSIC.missionAfter + 42} s in moved on to ${PIECE_NAMES[r.music.piece]}`);   // a new mission on the level keeps its music
        const other = PIECE_NAMES.findIndex((_: string, i: number) => i > 0 && !list.includes(i)); r.music.setPiece(other); r.step(20); const b = r.music.piece; r.step((MUSIC.minutes + 0.5) * 60);   // a piece picked by hand plays its minutes, then the level's first
        if (b !== other || r.music.piece !== list[0]) why.push(`picked by hand: ${PIECE_NAMES[b]}, then ${PIECE_NAMES[r.music.piece]}`); }
      { Math.random = mulberry32(3); const r = score(0); tell(r, [list[0]]); r.step(MUSIC.minutes * 2.5 * 60); if (r.music.piece !== list[0] || r.music.changes !== 1) why.push(`a list of one: ${r.music.changes} begun`); }   // (a list of one plays on: no lead-out into itself)
      { Math.random = mulberry32(8); const r = score(0); tell(r); r.step(30); const to = S.setlistOf('office', 'rescue') as number[]; tell(r, to); let at = -1; r.step(12, now => { if (at < 0 && r.music.piece !== list[0]) at = now; });   // another kind of mission started in the page: its first piece at the next bar line
        if (r.music.piece !== to[0] || at < 0 || !ledTo(r, at)) why.push(`another list said in play: ${PIECE_NAMES[r.music.piece]}${at < 0 ? '' : `, lead-out ${ledTo(r, at)}`}`);
        tell(r, to.slice()); r.step(20); if (r.music.changes !== 2) why.push('the same list said again began a piece'); }
      { const main = await Bun.file(`${ROOT}/src/main.ts`).text(), au = await Bun.file(`${ROOT}/src/audio/audio.ts`).text();   // the wiring this file cannot play: the page says the list at boot and at each new mission, and the mixer hands it to the score it makes
        if (!/audio\.scoreSet = setlistOfQuery\(location\.search\)/.test(main) || !/audio\.scoreSet = setlistOf\(setlistLevel\(levelFileQ\), runningScenario\(game, levelFileQ\)\?\.kind/.test(main) || !/this\.music\.setlist = this\.levelSet/.test(au) || !/if \(this\.music\) this\.music\.setlist = v/.test(au)) why.push('the page no longer says the list to the score (main.ts pageAudio and its frame loop, audio.ts scoreSet)'); }
      { MUSIC.byLevel = false; const opened = new Set<number>(); for (const seed of [1, 4, 6, 7]) { Math.random = mulberry32(seed); const r = score(0); tell(r); r.step(20); opened.add(r.music.piece); }   // ?shuffle: the bag, as it was
        MUSIC.byLevel = true; if (opened.size < 3) why.push(`switch off: the four seeds open on ${opened.size} pieces`); }
      line(!why.length, `the level's music: its list in its order on any seed, behind a lead-out each time; its first piece off the menu; a restart keeps it; a piece picked by hand gives way to it; another list said in play comes in at the next bar; ?shuffle deals as before`,
        why.slice(0, 5).join(' · ') || `the records office, ${MUSIC.minutes * 3.5} minutes of calm: ${said}`);
    }
    // ---- a tape: the run tape carries every registry table and its player puts each over the page's — the score's switch is the viewer's own (knobs.ts VISIT_OWN)
    { const K: any = await import(`${ROOT}/src/game/knobs.ts`), E: any = await import(`${ROOT}/src/replay/engineplay.ts`), R = K.knobRegistry() as { MUSIC: typeof MUSIC; PACE: { max: number } }, pace = R.PACE.max, own = [...K.VISIT_OWN];
      if (process.env.MUSIC_BREAK === '1') K.VISIT_OWN.length = 0;   // the red path: the player writes every table the tape has
      try {
        const got: boolean[] = [];
        for (const mine of [true, false]) { MUSIC.pieces = mine;
          E.TapePlay.prototype.tables.call({ tape: { recipe: { knobs: null, tables: { MUSIC: { pieces: !mine, minutes: 99 }, PACE: { max: pace + 0.5 } } } }, kitOf() {} });
          got.push(MUSIC.pieces === mine && MUSIC.minutes === keep.minutes && R.PACE.max === pace + 0.5); R.PACE.max = pace; }
        const src = await Bun.file(`${ROOT}/src/replay/engineplay.ts`).text(), sites = (src.match(/K\.knobsPlayed\(\)/g) ?? []).length, whole = /K\.(knobsNamed|knobRegistry)\(\)/.test(src);
        line(R.MUSIC === MUSIC && got.every(Boolean) && sites === 2 && !whole && !('MUSIC' in K.knobsPlayed()) && !K.JOURNAL_KNOBS.includes('MUSIC'),
          "a tape: its player puts the tape's tables over the page's and leaves the score's switch as the viewer has it, on or off (?onetheme holds on a tape made without it)",
          `pieces on kept ${got[0]} · off kept ${got[1]} · the player's table puts through knobsPlayed ${sites} of 2${whole ? ' · and one over the whole registry' : ''} · a recording carries MUSIC ${K.JOURNAL_KNOBS.includes('MUSIC')}`);
      } finally { R.PACE.max = pace; K.VISIT_OWN.length = 0; K.VISIT_OWN.push(...own); }
    }
  } finally { Object.assign(MUSIC, keep); MUSIC.pieces = stand; Math.random = sys; }
  console.log(bad ? `=== music-check: ${bad} FAILED ===` : '=== music-check: ALL PASS ===');
  return !bad;
}
if (import.meta.main) process.exit((await musicCheck()) ? 0 : 1);

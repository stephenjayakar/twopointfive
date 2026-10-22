// 'attentionway' — A GUARD'S ATTENTION THREAD RUNS THE WAY HE WILL WALK (ATTENTION.way, attention.ts attentionWay, ui/attentionviz.ts threadPoints). The
// maintainer, off the stealth tutorial mission, of a dotted thread drawn from a man in a hut straight through its wall to a ring in the yard: "weird that the
// line here is a straight line, not a pathed one. i'd expected pathed from squad commands".
//   bun run tools/qa/attentionway-check.ts        (also `probes.ts attentionway`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   straight  (the flaw, kept behind the key) on each level a man is found with a place a knock takes his attention to that the straight line from his feet
//             reaches only through blocked floor: with the key off the thread is exactly that line.
//   way       the key on, the same men: the thread starts at his feet, ends at the place, has corners, and no step of it is on blocked floor.
//   walk      he then walks it: until he is at the thing he is never a metre from the thread drawn when he set off, no thread drawn on the way is on
//             blocked floor past his next corner (the leg from his feet to that corner may clip the margin the nav grid keeps round one as he rounds
//             it: printed, not asked), and standing at the thing (only looking) the thread is the straight one.
//   source    where the thread comes from on that walk: on his own path it is his feet and then his next corner; with the nav grid asked all the way
//             (a stand-in for a man with no path of his own) the grid is asked once in half a second and the thread never grows by over 0.3 m in a
//             frame — no kink back to a corner he has passed.
//   pieces    the overlay's half-metre pieces of a way: off his feet by the head, short of the place by the ring, no piece over half a metre, every piece
//             on the way; nothing for a man all but at the ring.
//   picture   a run that asks for the way every frame digests as the same run that never asks; the key is on on both stands, and the page's boot writes it
//             (`?straightthread` = off).
// ATTENTIONWAY_BREAK=1 = the key left off where `way` asks for it on: way must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no overlay: what is read is the list of points the overlay is handed and the pieces it cuts them into, not a drawn line.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const { ATTENTION, attentionMarks, attentionWay, attentionOf } = await import(`${ROOT}/src/game/attention.ts`);
const { threadPoints } = await import(`${ROOT}/src/ui/attentionviz.ts`);
const { RING } = await import(`${ROOT}/src/game/launcher.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);

type P = [number, number, number];
const BREAK = process.env.ATTENTIONWAY_BREAK === '1', DT = 1 / 60, LEVELS: (string | null)[] = ['tut-quiet.json', null, 'lights-out.json'];
const f2 = (n: number) => n.toFixed(2), flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
let allPass = true, found = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

const lenOf = (w: ArrayLike<number>[]) => { let l = 0; for (let i = 1; i < w.length; i++) l += flat(w[i - 1], w[i]); return l; };
/** how many 0.1 m steps of the polyline stand on blocked floor (its two ends left out: a man's feet and the thing can be at a wall's foot) */
const blockedOn = (nav: any, w: ArrayLike<number>[]) => { let n = 0; const L = lenOf(w); let s = 0;
  for (let i = 1; i < w.length; i++) { const a = w[i - 1], b = w[i], l = flat(a, b); for (let d = 0; d < l; d += 0.1) { const at = s + d; if (at > 0.5 && at < L - 0.5 && nav.isBlocked(a[0] + (b[0] - a[0]) * d / l, a[2] + (b[2] - a[2]) * d / l)) n++; } s += l; }
  return n; };
/** how many legs of the polyline pass through something solid at knee height (a wall, a desk; a door's leaf is not in this) */
const wallLegs = (g: any, w: ArrayLike<number>[]) => { let n = 0; for (let i = 1; i < w.length; i++) if (g.col.solidBlocked([w[i - 1][0], 0.5, w[i - 1][2]], [w[i][0], 0.5, w[i][2]])) n++; return n; };
const distTo = (w: ArrayLike<number>[], p: ArrayLike<number>) => { let best = Infinity; for (let i = 1; i < w.length; i++) { const a = w[i - 1], b = w[i], dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2)); best = Math.min(best, Math.hypot(p[0] - a[0] - dx * u, p[2] - a[2] - dz * u)); } return best; };

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function world(file: string | null) {
  Math.random = seeded(7); const W: any = await quiet(() => standUp(file ? { uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${file}`, 'utf8'))) } : { uploadEvery: 4 })), g = W.game;
  ATTENTION.on = true; ATTENTION.marks = true; g.godMode = true; g.playerInvisible = true;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0; W.step(DT); } };
  step(60); return { W, g, step };
}
/** a calm man and a place 5‥9 m from him that a walk reaches and the straight line does not; a knock there; on to the first frame his attention is walking
 *  him to it. `ask` = the run asks for every thread's way each frame (and the nav grid's answer for it, his own path set aside); `frames` > 0 = run on that
 *  many frames more, a digest every thirty. */
async function taken(file: string | null, ask = false, frames = 0): Promise<{ g: any; step: (n?: number) => void; A: any; at: P; M: any; d: string } | null> {
  const probe = await world(file), nav = probe.g.col.nav, cands: { i: number; at: P }[] = [];
  probe.g.guards.forEach((A: any, i: number) => {
    if (A.state === 'dead' || A.awareness > 0.2) return; const p = A.char.pos; let n = 0;
    for (let r = 5; r <= 9 && n < 3; r += 1) for (let k = 0; k < 16 && n < 3; k++) {
      const a = k / 16 * Math.PI * 2, at: P = [p[0] + Math.sin(a) * r, 0, p[2] + Math.cos(a) * r]; if (nav.isBlocked(at[0], at[2])) continue;
      const line: P[] = [[p[0], 0, p[2]], at]; if (blockedOn(nav, line) < 4) continue;
      const path = nav.findPath(p, at, 3000); if (!path || lenOf([p, ...path, at]) > 22) continue;
      cands.push({ i, at }); n++;
    }
  });
  const asked = (g: any) => { for (const m of attentionMarks(g)) { attentionWay(g, m); attentionWay(g, { ...m, gd: Object.assign(Object.create(m.gd), { pathGoal: null }) }); } };
  for (const c of cands.slice(0, 16)) {
    const s = await world(file), g = s.g, A = g.guards[c.i];
    g.events.push({ kind: 'prop', pos: [c.at[0], 0, c.at[2]], time: g.time, loud: false, level: RING.clackNoise, who: 0, lure: true });
    for (let f = 0; f < 90; f++) {
      s.step(); if (ask) asked(g);
      const M = attentionMarks(g).find((m: any) => m.gd === A); if (!M || !M.walking || flat(M.at, c.at) > 0.6 || flat(M.from, M.at) < 3) continue;
      let d = ''; for (let k = 0; k < frames; k++) { s.step(); if (ask) asked(g); if (k % 30 === 29) d += hashDigest(digestGame(g, true)) + ' '; }
      return { g, step: s.step, A, at: c.at, M, d };
    }
  }
  return null;
}

async function ways() {
  console.log('\n=== straight · way · walk: the thread of a man going over to a knock, level by level ===');
  const rowsS: string[] = [], rowsW: string[] = [], rowsK: string[] = [], rowsG: string[] = []; let badS = 0, badW = 0, badK = 0, badG = 0, got = 0;
  for (const file of LEVELS) {
    const name = file ?? 'the office', T = await taken(file); if (!T) { rowsS.push(`${name}: (staging) no man with a place behind a wall took a knock`); continue; }
    got++; const { g, A, M, step } = T, nav = g.col.nav;
    ATTENTION.way = false; const st: P[] = attentionWay(g, M); const sB = blockedOn(nav, st), sW = wallLegs(g, st);
    if (!(st.length === 2 && flat(st[0], M.from) < 1e-6 && flat(st[1], M.at) < 1e-6 && sB >= 4)) badS++;
    rowsS.push(`${name}: ${A.callsign}, the place ${f2(flat(M.from, M.at))} m off: the key off = ${st.length} points, ${sB} steps of it on blocked floor, ${sW ? 'through something solid' : 'through nothing solid'}`);
    ATTENTION.way = !BREAK; const way: P[] = attentionWay(g, M), wB = blockedOn(nav, way), wW = wallLegs(g, way), L = lenOf(way);
    if (!(way.length >= 3 && flat(way[0], A.char.pos) < 0.05 && flat(way[way.length - 1], M.at) < 0.05 && wB === 0 && L > flat(M.from, M.at) + 0.3)) badW++;
    rowsW.push(`${name}: ${way.length} points, ${f2(L)} m of walk for ${f2(flat(M.from, M.at))} m straight, ${wB} steps on blocked floor, ${wW} legs through something solid at knee height (a shut door on his way is one) (his own path: ${A.pathGoal && flat(A.pathGoal, M.at) < 0.9 ? 'yes' : 'no, the grid was asked'})`);
    // walk: he goes; the thread he set off with is the way he goes
    ATTENTION.way = true; const way0: P[] = attentionWay(g, M); let far = 0, blocked = 0, walls = 0, threads = 0, frames = 0, arrived = false, atThing: P[] | null = null;
    // …and beside it the same walk with the nav grid asked all the way (a stand-in for him with no path of his own): how often it is asked, and whether the thread ever grows
    const ghost = Object.assign(Object.create(A), { pathGoal: null }), fp = nav.findPath; let asks = 0, inWay = false, grew = 0, lastL = -1, ownN = 0, ownBad = 0, gridN = 0;
    nav.findPath = function (this: any, ...a: any[]) { if (inWay) asks++; return fp.apply(this, a); };
    for (let f = 0; f < 60 * 40 && !arrived; f++) {
      step(); const m = attentionMarks(g).find((x: any) => x.gd === A); if (!m) break; frames++;
      if (m.walking) { far = Math.max(far, distTo(way0, A.char.pos)); if (f % 6 === 0) { const w: P[] = attentionWay(g, m); threads++; blocked = Math.max(blocked, blockedOn(nav, w)); walls += blockedOn(nav, w.slice(1)); }
        const Pth = A.path, own = !!A.pathGoal && A.pathI < Pth.length && flat(A.pathGoal, m.at) < 0.9 && flat(Pth[Pth.length - 1], A.pathGoal) < 1.2;
        if (own) { const w: P[] = attentionWay(g, m), next = Pth.slice(A.pathI).find((q: P) => flat(q, A.char.pos) > 0.05); ownN++; if (!next || flat(w[1], next) > 1e-6 || flat(w[0], A.char.pos) > 1e-6) ownBad++; }
        inWay = true; const gw: P[] = attentionWay(g, { ...m, gd: ghost }); inWay = false; gridN++; const L = lenOf(gw); if (lastL >= 0) grew = Math.max(grew, L - lastL); lastL = L; }
      else { arrived = true; atThing = attentionWay(g, m); }
    }
    const H = attentionOf(g, A); nav.findPath = fp;
    const most = Math.ceil(gridN * DT / ATTENTION.wayReask) + 2;
    if (!(ownN >= 20 && ownBad === 0 && gridN >= 60 && asks >= 2 && asks <= most && grew <= 0.3)) badG++;
    rowsG.push(`${name}: his own path on ${ownN} frames, ${ownBad} of them not started at his next corner · the grid asked all the way: ${asks} asks in ${gridN} frames (${most} at most), the thread never ${f2(grew)} m longer than the frame before`);
    if (!(arrived && far <= 1.0 && walls === 0 && threads > 10 && atThing && atThing.length === 2)) badK++;
    rowsK.push(`${name}: ${arrived ? `at the thing after ${f2(frames * DT)} s` : `NEVER AT IT (${frames} frames, state ${A.state}, hold ${H ? H.mode : 'none'})`}; at most ${f2(far)} m off the thread he set off with; of ${threads} later threads ${walls} steps on blocked floor past his next corner, at most ${blocked} of the leg from his feet to it (a corner's margin clipped as he rounds it); standing at it the thread has ${atThing ? atThing.length : '-'} points`);
  }
  verdict(got === LEVELS.length && badS === 0, 'the flaw, with the key off: a man whose attention a knock took to a place behind a wall has the straight thread, through blocked floor', rowsS.join('\n    '));
  verdict(got === LEVELS.length && badW === 0, 'the key on: the same thread starts at his feet, ends at the place, has corners, and no step of it is on blocked floor', rowsW.join('\n    '));
  verdict(got === LEVELS.length && badK === 0, 'he walks it: never over a metre from the thread he set off with, no later thread on blocked floor past his next corner, and standing at the thing the thread is the straight one', rowsK.join('\n    '));
  verdict(got === LEVELS.length && badG === 0, 'where the thread comes from: on his own path it starts at his feet and his next corner; with the nav grid asked all the way it is asked once in half a second, not every frame, and the thread never grows by over 0.3 m in a frame (no kink back to a corner he has passed)', rowsG.join('\n    '));
}
function pieces() {
  console.log('\n=== pieces: what the overlay cuts a way into ===');
  const way: P[] = [[0, 0, 0], [3, 0, 0], [3, 0, 4], [5.2, 0, 4]], head = 0.35, tail = 0.42, pts: P[] = threadPoints(way, head, tail), L = lenOf(way);
  let gap = 0, off = 0; for (let i = 1; i < pts.length; i++) gap = Math.max(gap, flat(pts[i - 1], pts[i])); for (const p of pts) off = Math.max(off, distTo(way, p));
  const corners = [way[1], way[2]].every(c => pts.some(p => flat(p, c) < 1e-6)), short: P[] = threadPoints([[0, 0, 0], [0.8, 0, 0]], head, tail);
  verdict(pts.length > 10 && Math.abs(flat(pts[0], way[0]) - head) < 1e-6 && Math.abs(flat(pts[pts.length - 1], way[3]) - tail) < 1e-6 && gap <= 0.5 + 1e-6 && off < 1e-6 && corners && Math.abs(lenOf(pts) - (L - head - tail)) < 1e-6 && short.length === 0,
    'a way of three legs: the pieces start the head off his feet, stop the ring short of the place, none is over half a metre, all are on the way, both corners are kept; a man all but at the ring gets none',
    `${pts.length} points, ${f2(lenOf(pts))} m of ${f2(L)} · longest piece ${f2(gap)} m · furthest off the way ${off.toExponential(1)} · corners kept ${corners} · the short way ${short.length} points`);
}
async function picture() {
  console.log('\n=== picture: asking changes nothing; on on both stands ===');
  ATTENTION.way = true; const a = await taken(null, true, 240), b = await taken(null, false, 240);
  const read = (q: string) => { ATTENTION.way = !ATTENTION.way; PR.pageSwitches(new URLSearchParams(q)); return ATTENTION.way; }, plain = read(''), off = read('straightthread'); read('');
  verdict(!!a && !!b && a.d === b.d && a.d.length > 8 && found === true && plain === true && off === false,
    'a run that asks for every thread\'s way each frame digests as the run that never asks; the card found the key on; the page\'s boot writes it on for a plain address and off for ?straightthread',
    `digests ${a && b ? (a.d === b.d ? 'equal' : 'DIFFER') : 'no run'} (${a?.d.trim() ?? '-'}) · found ${found} · plain ${plain} · ?straightthread ${off}`);
}

/** the whole card (probes.ts 'attentionway'): true = every check passed. The knobs are put back as they were found. */
export async function attentionWayCheck(): Promise<boolean> {
  const was = { ...ATTENTION }, rnd = Math.random; allPass = true;
  try { await quiet(() => standUp({ uploadEvery: 4 })); found = ATTENTION.way; await ways(); pieces(); await picture(); }
  finally { Object.assign(ATTENTION, was); Math.random = rnd; }
  console.log(`\n=== attentionway: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await attentionWayCheck() ? 0 : 1);

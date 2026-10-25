// A WINDOW'S BAR BREAKS FROM ONE ROUND — the maintainer, of The Pass's windows: 'for gameplay it'd be nice if they broke off with the glass and just as fast.
// so each bar breaks up with just a single bullet?'
//
// The upright the level kit stands between a window's bays (scene/bars.ts: what a bar is, marked BoxFlag.Bar as a level is stood up) was a static box like a
// wall: every round that met one stopped in it, a man whose line of fire crossed one had no shot, and it stood on in a window whose glass was long gone.
// Behind ONE switch, `WINBARS.on` (OFF here and on the frozen stand, `TPS_WINBARS=1` raises it there; ON in the page — src/host/profile.ts pageSwitches —
// `?winbars=0` = a bar is the piece of wall it was): off — or a showcase running (Game.touring) — = every entry point answers on its first line and the game
// is the base's, digest for digest.
//
//   THE RULE (one for Sam, the squad and the defenders — fireWeapon asks nobody whose round it is):
//   • A ROUND THAT MEETS A BAR BREAKS IT AND FLIES ON: no toll, no turn, any gun, a pellet of buck as much as a rifle round. combat.ts fireWeapon asks where
//     the round would stop; while that is a standing bar the bar is taken out of its way (barMeet) and the flight asked again, glass and thin walls and all —
//     and once the round's end is known every bar it REACHED is broken, every one it did not (a man or a chair on the near side) stands as it stood
//     (barsSettle). No hit points: one round, one bar.
//   • A LINE OF FIRE PASSES A STANDING BAR (collision.ts StaticCollision.shotBlocked, `firePass`): a man shoots at what is behind a bar exactly when his round
//     would get there, and his first round through it takes it.
//   • A BROKEN BAR IS GONE the way the destruction lane hides everything (flags |= NoPrimary | NoShadow): the picture, every ray, sight, the fog's eye, rounds,
//     sound and feet drop it at query time. It leaves as pieces — the bar cut across into a few lengths, thrown the way the round went as the pool's rigid
//     debris (they land, are heard as debris is, hurt nobody and stop nothing) — and a burst of chips.
//   • A BLAST the destruction lane judges (a wall charge, a frag, a 40 mm: Destruction.blast's call list) takes every bar inside its breaking radius that it
//     has a clear line to, before the wall round them is judged.
//   • Eyes, feet, sound, a thrown thing and a gun held against one: a standing bar is what it was.
//
// DETERMINISTIC: every choice hashes the bar's index and where it was struck (debris.ts hash01) — never Math.random, no wall clock. RESET with the level
// (Game.resetLevelState → resetBars: every bar stands again). CHECKPOINTS carry which bars are gone (savestate.ts files the slice `bars` beside the walls'
// and re-applies it after the restart, silently; the pieces on the floor are not filed — no debris is); nothing broken = no slice, the file byte for byte
// what it was. The switch rides in session journals (knobs.ts JOURNAL_KNOBS; a recording from before the table replays with it off — journal.ts applyKnobs).
import { SideMap } from '../math/side';
import { Vec3, v3, lerp, clamp } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import { gpuFx } from './particleFx';
import { hash01 } from './debris';
import { FURN_BREAK, breakClassOf } from './furnblast';   // (read inside breakBar only: src/game is one import cycle)
import { NOBODY_ID } from './consts';
import type { Game } from './game';
import type { BlastEvent } from './wallbreak';

/** the numbers (constants until somebody has played it) */
export const WINBARS = {
  on: false,
  /** bars one round can take on its way (a round down a row of windows): the one after is the wall it was to that round */
  perRound: 4,
  /** the lengths a bar is cut into, and how uneven the cuts are (0 = equal lengths) */
  pieces: 3, uneven: 0.5,
  /** the pieces: speed along the round's way, m/s (the struck length at the top of it, the others at `restK` of theirs) · up · sideways either way · spin, rad/s */
  fly: [1.6, 3.4] as [number, number], restK: 0.45, up: [0.2, 1.3] as [number, number], side: 0.8, spin: 7,
  /** the chips off it (GPU particles: nothing without them): how many, how fast */
  chips: 18, chipV: 2.8,
  /** a blast takes the bars within its breaking radius × this (0 = a blast leaves them standing) */
  blastK: 1,
};
/** bars broken · of them by a round · by a blast · pieces thrown as rigid debris · pieces the pool refused (chips instead) · bars a round met and did not reach */
export const WINBARS_STATS = { broken: 0, byRound: 0, byBlast: 0, chunks: 0, demoted: 0, spared: 0 };
const LOG: string[] = [];
/** the check's own break word (tools/qa/winbars-check.ts): the switch reads on and the rule does nothing */
const WINBARS_BREAK = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.WINBARS_BREAK === '1';
const HIDE = BoxFlag.NoPrimary | BoxFlag.NoShadow;

/** which bars are gone: the static's index → its flags as it stood */
interface BarState { gone: Map<number, number>; /** bars out of the way of the round being flown right now (barMeet → barsSettle): empty between rounds */ met: BarMet[] }
const STATE = new SideMap<Game, BarState>('winbars.STATE');
function stateOf(g: Game): BarState { let S = STATE.get(g); if (!S) STATE.set(g, S = { gone: new Map(), met: [] }); return S; }

/** the one gate: the switch, and no showcase running (their choreography was laid with a bar the wall it was) */
export function barsLive(g: Game): boolean { return WINBARS.on && !WINBARS_BREAK && !g.touring; }
/** is static `index` (as col.raycast reports it) a window's bar that still stands? */
export function barAt(g: Game, index: number): boolean { const b = index < 1e6 ? g.col.boxes[index] : undefined; return !!b && (b.flags & (BoxFlag.Bar | HIDE)) === BoxFlag.Bar; }
/** every bar of this level that still stands (the statics' indices, ascending) */
export function barsStanding(g: Game): number[] { const out: number[] = [], B = g.col.boxes, n = Math.min(B.length, g.level.boxes.length); for (let i = 0; i < n; i++) if ((B[i].flags & (BoxFlag.Bar | HIDE)) === BoxFlag.Bar) out.push(i); return out; }
/** the bars a round or a blast has taken (ascending) */
export function barsGone(g: Game): number[] { return [...stateOf(g).gone.keys()].sort((p, q) => p - q); }
/** the flags a bar this rule took was AUTHORED with, or undefined: it took no such static (destruction.ts flags0 — whoever indexes the level after a bar went
 *  reads it as it was built, not as it stands) */
export function barFlags0(g: Game, index: number): number | undefined { return STATE.get(g)?.gone.get(index); }

/** Game constructor, once: the line of fire's question (collision.ts shotBlocked) and the blasts' call list. Nothing here does anything while the switch is off. */
export function bootBars(g: Game) {
  g.col.firePass = () => barsLive(g) ? BoxFlag.Bar : 0;
  g.destr.onBlast(ev => barsBlast(g, ev));
}

// ---------------------------------------------------------------- a round
/** one bar a round would stop in: out of its way for the rest of that round's own flight, nothing more until barsSettle */
export interface BarMet { index: number; /** metres of the round's path to it */ t: number; at: Vec3; dir: Vec3; /** its flags as it stood */ flags: number }
/** fireWeapon: the round would stop in bar `index`, `t` metres along its path at `at` flying `dir` — the bar is hidden from the rest of this round's flight.
 *  PROVISIONAL: no piece, no sound, no row; barsSettle breaks it or stands it up again before fireWeapon returns. */
export function barMeet(g: Game, index: number, t: number, at: Vec3, dir: Vec3): BarMet {
  const b = g.col.boxes[index], m: BarMet = { index, t, at, dir, flags: b.flags }; b.flags |= HIDE; stateOf(g).met.push(m); return m;
}
/** fireWeapon's way out, whatever happened in between: a bar still out of a round's way stands as it stood (a throw between barMeet and barsSettle must not
 *  leave a bar hidden that no book knows of). Nothing to do = one lookup. */
export function barsUnmeet(g: Game) { const S = STATE.get(g); if (!S || !S.met.length) return; for (const m of S.met) g.col.boxes[m.index].flags = m.flags; S.met.length = 0; }
/** fireWeapon, the round's end known (`tHit` metres of path): every bar it reached is broken, every other stands as it stood. `lead`: fireWeapon's own (a
 *  shell's later pellets are quiet). Returns how many it broke. */
export function barsSettle(g: Game, met: BarMet[], tHit: number, who: number, lead: boolean): number {
  let n = 0; stateOf(g).met.length = 0;
  for (const m of met) g.col.boxes[m.index].flags = m.flags;
  for (const m of met) {
    if (m.t > tHit + 1e-6) { WINBARS_STATS.spared++; continue; }   // (a man, a prop on the near side: the round never reached this bar)
    if (breakBar(g, m.index, m.at, m.dir, who, 'round')) { n++; if (lead) g.audio.play('bulletImpact', m.at, 0.8); }
  }
  return n;
}

// ---------------------------------------------------------------- the break
/** Bar `index` goes: hidden to every question, its pieces thrown the way `dir` (the round's, or out from a blast) from where it was struck. false = it was
 *  gone already or is no standing bar. */
function breakBar(g: Game, index: number, at: Vec3, dir: Vec3, who: number, cause: 'round' | 'blast'): boolean {
  const S = stateOf(g), b = g.col.boxes[index]; if (!b || S.gone.has(index) || !barAt(g, index)) return false;
  S.gone.set(index, b.flags); b.flags |= HIDE;
  changed(g, b);
  WINBARS_STATS.broken++; if (cause === 'round') WINBARS_STATS.byRound++; else WINBARS_STATS.byBlast++;
  // the pieces: the bar cut across into uneven lengths, the struck one thrown hardest
  const K = WINBARS, n = Math.max(1, Math.round(K.pieces)), y0 = b.c[1] - b.h[1], H = 2 * b.h[1], cls = breakClassOf(b.albedo), land = FURN_BREAK[cls].land;
  const seed = index * 977 + 131 + Math.floor(clamp((at[1] - y0) / H, 0, 1) * 16) * 31, R = (k: number) => hash01((seed + k) * 2654435761);
  const cuts = [0]; for (let j = 1; j < n; j++) cuts.push((j + (R(10 + j) - 0.5) * K.uneven) / n); cuts.push(1);
  let dx = dir[0], dz = dir[2]; { const l = Math.hypot(dx, dz); if (l < 0.2) { const c = Math.cos(b.yaw), s = Math.sin(b.yaw); [dx, dz] = b.h[0] > b.h[2] ? [c, -s] : [s, c]; } else { dx /= l; dz /= l; } }   // (a round straight down a bar still sends it out through its wall)
  const P = gpuFx(g), hitU = clamp((at[1] - y0) / H, 0, 1); let k = 100;
  for (let j = 0; j < n; j++) {
    const u0 = cuts[j], u1 = cuts[j + 1], struck = hitU >= u0 && hitU <= u1, r1 = R(k++), r2 = R(k++), r3 = R(k++);
    const f: Box = { ...b, c: [b.c[0], y0 + (u0 + u1) / 2 * H, b.c[2]], h: [b.h[0], (u1 - u0) / 2 * H, b.h[2]], flags: BoxFlag.Dynamic, marks: undefined };
    const sp = lerp(K.fly[0], K.fly[1], r1) * (struck ? 1 : K.restK), sd = (r2 - 0.5) * 2 * K.side;
    const v: Vec3 = [dx * sp - dz * sd, lerp(K.up[0], K.up[1], r3), dz * sp + dx * sd], w: Vec3 = [(r1 - 0.5) * K.spin, (r2 - 0.5) * 0.5 * K.spin, (r3 - 0.5) * K.spin];
    const got = g.destr.debris.spawn('chunk', f, v, w, who);
    if (got) { WINBARS_STATS.chunks++; got.level = land.level; got.sfx = land.sfx; if (cls === 'wood' || cls === 'metal') g.destr.breaks.retag(got, cls); g.destr.breaks.dress(got); }   // (a steel bar's lengths are steel, a wooden one's wood: breakTable.ts)
    else { WINBARS_STATS.demoted++; if (P) P.emit('debris', f.c, v3.normalize([v[0], Math.max(0.3, v[1]), v[2]]), 10, { speed: 2.2, speedJit: 0.7, spread: 1.1, life: 18, lifeJit: 0.3, size: 0.006, sizeJit: 0.6, aspect: 3, color: v3.copy(b.albedo), owner: who }); }
  }
  if (P) P.emit('debris', [b.c[0], clamp(at[1], y0, y0 + H), b.c[2]], v3.normalize([dx, 0.25, dz]), K.chips, { speed: K.chipV, speedJit: 0.7, spread: 1.0, life: 18, lifeJit: 0.3, size: 0.007, sizeJit: 0.6, aspect: 4, color: v3.copy(b.albedo), owner: who });
  LOG.push(`${g.time.toFixed(1)}s bar ${index} broken by a ${cause} (who ${who})`); if (LOG.length > 24) LOG.shift();
  return true;
}
/** the level changed where bar `b` stands: whoever keeps an answer about the level's boxes asks again (the fog's thin bits, a switch's wall, the sound routes, the smoke's obstacles) */
function changed(g: Game, b: Box) {
  const w = g.engine.world as { geomSerial?: number }; w.geomSerial = (w.geomSerial ?? 0) + 1;
  g.col.sound.invalidate(); g.smoke.obstaclesChanged?.(b.c, Math.hypot(b.h[0], b.h[1], b.h[2]) + 0.6);
}

// ---------------------------------------------------------------- a blast
/** Destruction.blast's call list: every standing bar with a point of its length inside the blast's breaking radius × WINBARS.blastK and nothing solid between
 *  the blast and that point goes, thrown out from the blast. Before the walls are judged: the wall round a window can go in the same blast, and its bars do
 *  not hang in the hole. ALL the bars in reach are judged first, each as if the others were not there (a bar is no shield for the bar behind it, and which
 *  goes does not depend on the order they stand in the level file), then the ones the blast reaches are broken. A bar is asked at three heights — a burst on
 *  the floor at the wall's foot has no line to a bar's foot past its own sill, and has one to its middle. */
function barsBlast(g: Game, ev: BlastEvent) {
  if (!barsLive(g) || WINBARS.blastK <= 0) return;
  const R = ev.radius * WINBARS.blastK, from: Vec3 = [ev.at[0], Math.max(0.3, ev.at[1]), ev.at[2]], B = g.col.boxes;
  const near = barsStanding(g).filter(i => { const b = B[i]; return Math.hypot(b.c[0] - from[0], b.c[2] - from[2]) <= R + Math.max(b.h[0], b.h[2]); });
  if (!near.length) return;
  const took: { i: number; at: Vec3 }[] = [], was = near.map(i => B[i].flags);
  for (const i of near) B[i].flags |= HIDE;
  for (const i of near) {
    const b = B[i];
    for (const u of [0, 0.6, -0.6]) {
      const q: Vec3 = [b.c[0], b.c[1] + u * b.h[1], b.c[2]]; if (v3.dist(from, q) > R + Math.max(b.h[0], b.h[2])) continue;
      if (g.col.solidBlocked(from, q)) continue;
      took.push({ i, at: q }); break;
    }
  }
  near.forEach((i, k) => { B[i].flags = was[k]; });
  for (const t of took) { const b = B[t.i], dx = b.c[0] - from[0], dz = b.c[2] - from[2], l = Math.hypot(dx, dz); breakBar(g, t.i, t.at, l > 1e-3 ? [dx / l, 0, dz / l] : [0, 0, 0], ev.who || NOBODY_ID, 'blast'); }
}

// ---------------------------------------------------------------- reset, checkpoints
/** Game.resetLevelState: every bar stands again (before the destruction's own reset: the walls' re-bake in there sees the level whole) */
export function resetBars(g: Game) {
  const S = STATE.get(g); if (!S) return; S.met.length = 0; if (!S.gone.size) return;
  for (const [i, f] of S.gone) { const b = g.col.boxes[i]; if (b) { b.flags = f; changed(g, b); } }
  S.gone.clear();
}
/** a checkpoint's slice: the bars that are gone (ascending). undefined = none — the file is then byte for byte what it was before this slice existed */
export interface BarsSave { v: 1; s: number[] }
export function barsSnapshot(g: Game): BarsSave | undefined { const s = barsGone(g); return s.length ? { v: 1, s } : undefined; }
/** can this file's slice be applied to this level (savestate.ts canLoad)? null = yes */
export function barsCheck(g: Game, s: BarsSave | undefined): string | null {
  if (!s) return null; if (s.v !== 1 || !Array.isArray(s.s)) return 'window bars: unknown slice';
  const n = Math.min(g.col.boxes.length, g.level.boxes.length);
  for (const i of s.s) if (!Number.isInteger(i) || i < 0 || i >= n || !(g.col.boxes[i].flags & BoxFlag.Bar)) return `window bars: static ${i} is not a window's bar of this level`;
  return null;
}
/** apply a checkpoint's slice on the freshly reset level: the same bars gone again, silently (no pieces, no chips, no sound) */
export function barsRestore(g: Game, s: BarsSave | undefined) {
  if (!s) return; const S = stateOf(g);
  for (const i of s.s) { const b = g.col.boxes[i]; if (!b || S.gone.has(i) || !barAt(g, i)) continue; S.gone.set(i, b.flags); b.flags |= HIDE; changed(g, b); }
}

/** panel / console line */
export function winBarsSummary(g: Game): string {
  const st = WINBARS_STATS, up = barsStanding(g).length, gone = stateOf(g).gone.size;
  return `window bars ${WINBARS.on ? (barsLive(g) ? 'ON' : 'on — inert while a showcase runs') : 'off (a bar stops a round like a wall)'} ▸ ${up} standing, ${gone} gone · ${st.byRound} by a round, ${st.byBlast} by a blast · ${st.chunks} pieces (+${st.demoted} as chips)${LOG.length ? ` · last: ${LOG[LOG.length - 1]}` : ''}`;
}
/** QA: the last breaks filed, oldest first */
export function winBarsLog(): readonly string[] { return LOG; }

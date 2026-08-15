// GLASS — the game's half of E3 (the renderer's half: boxes.ts BoxFlag.Glass, common.wgsl glassTrace, fgather.wgsl glassShade, composite.wgsl): what a pane
// IS to the floor. A static box flagged Glass is a wall to feet and to sound (collision.ts: collideCircle / solidBlocked / SoundPaths), nothing to eyes
// (segmentBlocked passes it: sight, torch cones, the light between a man and a lamp, the dazzle), and a wall again to a line of FIRE (shotBlocked: guards.ts
// clearShot and the tactics' corners — the men see you through it and know they have no shot from there) — and it does NOT shatter (unless GLASS BREAKING is switched on:
// game/glassbreak.ts then takes cells out of a pane where the rounds went, through the two hooks below — everything in this file still happens first). Our glazing is laminated: a
// round that reaches a pane STOPS in it (combat.ts fireWeapon → glassHit; the next round stops in it too — bullets never pass), leaves a hole the size of
// a pea with a frosted collar and a star of cracks round it (a decal of kind 'glassHit' — render/decals.ts — that composite.wgsl draws ON the pane where the
// view ray crosses it: darker and more reflective along the crack lines, an opaque-ish frosted disc at the core, the pattern randomised per hit off a seed
// hashed from WHERE it hit, so a capture repeats), sounds a sharp crack ('glassCrack') and puts a 'glass' event on the floor's ears (guards.ts hearingCheck:
// everyone within GLASS.hearM places it and comes to look, calm men bark). A stun charge going off beside the glazing stars the panes near it (updateGlass
// reads this frame's 'bang' events once each; a kicked door does nothing to glass). Cracks accumulate — several hits on one pane overlap — and go with the
// encounter: they are decals, and resetLevelState clears the decal list. Tab ▸ Renderer — glass has the knobs and a 'crack test' button; window.__glass the
// console handles; tools/qa/glass-probes.ts the numbers.
import { Vec3, v3, clamp } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import { PLAYER_ID } from './consts';
import type { Game } from './game';

/** the numbers (Tab ▸ Renderer — glass edits the renderer's three live; these are the game's) */
export const GLASS = {
  hearM: 30,          // straight-line horizon of a round smacking a pane (m): inside it the usual propagation decides how much arrives
  hearLevel: 0.85,    // event level: a bullet into glass is a report of its own (guards.ts: awareness toward min(0.85, …) × carry)
  bangM: 2.5,         // a stun charge within this of a pane's nearest point stars it (overpressure) …
  bangCracks: 2,      // … with this many impact stars per pane, at points seeded off where the charge went off
  rMin: 0.075, rMax: 0.2,   // a hit's crack star reaches 7.5‥20 cm from the hole (15‥40 cm across), drawn off the seed
};

/** per-Game glass bookkeeping (a WeakMap, like the whistle's: nothing on Game itself but the hooks) */
interface GlassState { panes: number[]; seen: WeakSet<object>; hits: number; lastHitT: number; log: string[]; }
const states = new WeakMap<Game, GlassState>();
export function glassState(g: Game): GlassState {
  let s = states.get(g);
  if (!s) { const panes: number[] = []; g.level.boxes.forEach((b, i) => { if (b.flags & BoxFlag.Glass) panes.push(i); }); s = { panes, seen: new WeakSet(), hits: 0, lastHitT: -100, log: [] }; states.set(g, s); }
  return s;
}

/** Game.resetLevelState, beside decals.clear(): the crack stars have just gone with every other mark, so the encounter's hit count, last-hit clock and log go too
 *  ('N hits this encounter' on the panel meant every encounter since boot — review U9.10). The pane list and the seen-set stand (statics; a WeakSet). */
export function resetGlass(g: Game) { const s = states.get(g); if (!s) return; s.hits = 0; s.lastHitT = -100; s.log.length = 0; }

/** every static Glass box index of this level: level.boxes[i] ≡ world.statics[i], and nothing gains or loses the Glass bit at runtime */
export function glassPanes(g: Game): number[] { return glassState(g).panes; }
export const isPane = (b: Box | undefined | null): b is Box => !!b && (b.flags & BoxFlag.Glass) !== 0;
/** a Glass box thicker than this across its thin axis is SOLID glass, not a sheet: it takes no crack decals (glassHit) */
export const THICK_GLASS_HALF = 0.05;
/** a SHEET of glass = a pane that can craze (thin); the solid bottle is glass but no sheet */
export const isSheet = (b: Box | undefined | null): b is Box => isPane(b) && Math.min(b.h[0], b.h[2]) <= THICK_GLASS_HALF;

/** the pane's unit normal (world direction of its thin axis; sign arbitrary) */
function paneNormal(b: Box): Vec3 {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  return b.h[0] < b.h[2] ? [cs, 0, -sn] : [sn, 0, cs];   // local +x → (cos, 0, −sin), local +z → (sin, 0, cos)
}
/** nearest point of box b (yawed, no rot — panes never tilt) to p, and the distance */
function nearestOnBox(b: Box, p: Vec3): { q: Vec3; d: number } {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const dx = p[0] - b.c[0], dy = p[1] - b.c[1], dz = p[2] - b.c[2];
  const lx = clamp(cs * dx - sn * dz, -b.h[0], b.h[0]), ly = clamp(dy, -b.h[1], b.h[1]), lz = clamp(sn * dx + cs * dz, -b.h[2], b.h[2]);
  const q: Vec3 = [b.c[0] + cs * lx + sn * lz, b.c[1] + ly, b.c[2] - sn * lx + cs * lz];
  return { q, d: v3.dist(p, q) };
}
/** a 32-bit hash of where a pane was hit (pane index + the point to the millimetre): the crack pattern's seed — the same shot at the same spot draws the same star whatever else has happened */
export function hitSeed(bi: number, p: Vec3): number {
  let h = Math.imul(bi + 1, 0x9E3779B1) >>> 0;
  for (const x of p) { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 0x85EBCA77) >>> 0; h = (h ^ (h >>> 13)) >>> 0; }
  return Math.imul(h, 0xC2B2AE3D) >>> 0;
}

/** A round (or anything else that stars glass) met pane `bi` (a level box index) at `hitP` flying `dir`: the crack decal on the face it came at, the crack heard,
 *  the event on the floor's ears. `who` = whose doing (PLAYER_ID, a guard id, 0 = nobody's in particular). Returns false if `bi` is not a pane. The pane stays
 *  exactly what it was to every ray, foot and sound path: laminated glazing holds. `quiet` (a blast's secondary stars): decal only — the bang was the noise. */
export function glassHit(g: Game, bi: number, hitP: Vec3, dir: Vec3 | null, who: number, cause: 'shot' | 'bang' | 'hand' = 'shot', quiet = false): boolean {
  const b = g.level.boxes[bi]; if (!isPane(b)) return false;
  if (Math.min(b.h[0], b.h[2]) > THICK_GLASS_HALF) return true;   // THICK glass (the water-cooler bottle, 08-12): the round stops in it like in a pane, but no star, no crack, no 'glass' event — solid glass does not craze like a sheet
  const S = glassState(g);
  const seed = hitSeed(bi, hitP);
  // the decal: centred where it hit, on the pane's mid-plane (composite finds it from either face), its normal toward the side the blow came from, its reach and
  // its look drawn off the seed; restricted to THIS pane on the GPU (cracks stop at the frame). Nothing when decals are off — the sound and the event still happen.
  let n = paneNormal(b);
  if (dir ? v3.dot(n, dir) > 0 : v3.dot(n, v3.sub(hitP, b.c)) < 0) n = v3.scale(n, -1);
  const off = v3.dot(v3.sub(hitP, b.c), n);
  const pos = v3.mad(hitP, n, -off);                                   // onto the mid-plane
  const u = (seed & 0xffff) / 65535, w = (seed >>> 16) / 65535;
  const radius = GLASS.rMin + (GLASS.rMax - GLASS.rMin) * u;
  const ang = w * Math.PI * 2; const up: Vec3 = [0, 1, 0]; const side = v3.normalize(v3.cross(up, n));
  const tangent: Vec3 = v3.add(v3.scale(side, Math.cos(ang)), v3.scale(up, Math.sin(ang)));   // the star's orientation in the pane's plane
  g.decals.add('glassHit', pos, n, radius, { tangent, seed: (seed >>> 8) & 0xfff, pane: bi, param: cause === 'bang' ? 0.6 : 1 });
  S.hits++; S.lastHitT = g.time;
  if (cause !== 'bang') g.glassBreak?.hit(bi, hitP, dir, who);   // GLASS BREAKING (glassbreak.ts; inert with tune.glassBreak off / chaos 0 / the tour): the impact filed on the pane's Voronoi — cells may fall (a blast files its own through blast(); ?. for fixtures that build a bare Game-like)
  S.log.push(`${g.time.toFixed(1)}s pane ${bi} ${cause === 'bang' ? 'starred by a blast' : 'hit'}${who ? ` (who ${who})` : ''} r ${radius.toFixed(2)}`); if (S.log.length > 24) S.log.shift();
  if (quiet) return true;
  // the crack: at the hole, on the floor's ears as its own kind
  const area = 4 * b.h[1] * Math.max(b.h[0], b.h[2]);
  g.audio.play('glassCrack', hitP, 0.9, { rate: 0.94 + Math.min(0.22, 0.4 / Math.max(0.5, area)) + 0.08 * u });   // small panes ring higher; no two hits quite alike
  g.events.push({ kind: 'glass', pos: [hitP[0], 0, hitP[2]], time: g.time, loud: true, level: GLASS.hearLevel, who });
  if (who === PLAYER_ID) g.player.noise = Math.max(g.player.noise, GLASS.hearLevel);
  return true;
}

/** Star every pane whose nearest point is within `radius` of `at` (a stun charge's overpressure): GLASS.bangCracks quiet hits each, at points on the pane seeded
 *  off the blast's position (never Math.random). Returns how many panes took it. */
export function crackNear(g: Game, at: Vec3, radius: number, who: number): number {
  let n = 0;
  for (const bi of glassPanes(g)) {
    const b = g.level.boxes[bi]; if (!isSheet(b)) continue;   // solid glass (the bottle) does not craze
    const { q, d } = nearestOnBox(b, at); if (d > radius) continue;
    let s = hitSeed(bi, at);
    const wide = b.h[0] < b.h[2] ? 2 : 0;                              // the pane's long horizontal local axis
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const axis: Vec3 = wide === 0 ? [cs, 0, -sn] : [sn, 0, cs];
    for (let k = 0; k < GLASS.bangCracks; k++) {
      s = (Math.imul(s ^ (s >>> 15), 0x2C1B3C6D) + 0x297A2D39) >>> 0;
      const fu = ((s & 0xffff) / 65535) * 2 - 1, fv = ((s >>> 16) / 65535) * 2 - 1;
      const anywhere: Vec3 = v3.mad(v3.mad([b.c[0], b.c[1], b.c[2]], axis, fu * 0.9 * b.h[wide]), [0, 1, 0], fv * 0.9 * b.h[1]);   // a point on the pane's face (inside its frame by a tenth) …
      const c = v3.lerp(anywhere, q, 0.35);                            // … pulled a third of the way toward where the blast was nearest (convex: still on the pane)
      glassHit(g, bi, c, v3.sub(c, at), who, 'bang', true);
    }
    n++;
  }
  return n;
}

/** Game.update, once a frame: a stun charge beside the glazing stars the panes near it (each 'bang' event looked at once). Kicked doors leave glass alone. */
export function updateGlass(g: Game) {
  const S = glassState(g);
  for (const e of g.events) {
    if (e.kind !== 'bang' || S.seen.has(e)) continue; S.seen.add(e);
    crackNear(g, [e.pos[0], Math.max(0.3, e.pos[1]), e.pos[2]], GLASS.bangM, e.who ?? 0);
    g.glassBreak?.blast([e.pos[0], Math.max(0.3, e.pos[1]), e.pos[2]], e.who ?? 0);   // GLASS BREAKING: the overpressure takes cells out of the annealed panes it reaches and dices tempered ones (its first two seeded impacts sit on the stars just drawn)
  }
}

/** The panel's / console's 'crack test': star the pane on the line from Sam's chest to the cursor's aim point (and 6 m beyond) if one is met, else the pane
 *  nearest the aim point within 4 m, as a round from his side would. Returns the pane index or −1. */
export function crackTest(g: Game): number {
  const aim = g.aimPoint; const from: Vec3 = v3.add(g.player.char.pos, [0, 1.3, 0]);
  const d = v3.sub(aim, from); const L = v3.len(d);
  if (L > 1e-3) {
    const rd = v3.scale(d, 1 / L); const h = g.col.raycast(from, rd, L + 6);
    if (h && h.index < 1e6 && isSheet(g.level.boxes[h.index])) { glassHit(g, h.index, v3.mad(from, rd, h.t), rd, 0, 'hand'); return h.index; }   // (a sheet only: the crack test reports what it actually starred)
  }
  let best = -1, bestD = 4, bestQ: Vec3 | null = null;
  for (const bi of glassPanes(g)) { const { q, d: dd } = nearestOnBox(g.level.boxes[bi], aim); if (dd < bestD) { bestD = dd; best = bi; bestQ = q; } }
  if (best >= 0 && bestQ) glassHit(g, best, bestQ, v3.sub(bestQ, from), 0, 'hand');
  return best;
}

/** how many crack decals are live (the decal list is the one memory of them) */
export function crackCount(g: Game): number { let n = 0; for (const d of g.decals.list) if (d.kind === 'glassHit') n++; return n; }

/** panel line */
export function glassSummary(g: Game): string {
  const S = glassState(g); const panes = glassPanes(g);
  return `${panes.length} panes (laminated: rounds stop, glass stays) · ${crackCount(g)} crack stars live, ${S.hits} hits this encounter · listed to GPU ${g.engine.world.glassList?.length ?? 0}${S.log.length ? ` · last: ${S.log[S.log.length - 1]}` : ''}`;
}

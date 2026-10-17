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
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3, clamp } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import { PLAYER_ID } from './consts';
import type { Game, GameEvent } from './game';
import type { GlassImpact } from './glassbreak';

/** the numbers (Tab ▸ Renderer — glass edits the renderer's three live; these are the game's) */
export const GLASS = {
  hearM: 30,          // straight-line horizon of a round smacking a pane (m): inside it the usual propagation decides how much arrives
  hearLevel: 0.85,    // event level: a bullet into glass is a report of its own (guards.ts: awareness toward min(0.85, …) × carry)
  bangM: 2.5,         // a stun charge within this of a pane's nearest point stars it (overpressure) …
  bangCracks: 2,      // … with this many impact stars per pane, at points seeded off where the charge went off
  rMin: 0.075, rMax: 0.2,   // a hit's crack star reaches 7.5‥20 cm from the hole (15‥40 cm across), drawn off the seed
  crackGap: 0.045,    // s, ONLY while live: across the whole floor no two hit cracks START closer than this (the hearing event is unaffected); 0 = every one sounds
  liveGap: 0.2,       // s, ONLY while glass breaking is live: one 'glass' hearing event per pane per SHOOTER per gap (the crack itself still sounds per round, softer inside it); 0 = every hit its own event
  bothFaces: false,   // A PANE'S CRASH IS HEARD FROM BOTH ITS FACES (glassEvent below, guards.ts glassHeard): ON in the page (?glassears=0), off here and on the frozen stand (TPS_GLASSEARS=1). Off = heard only from where the round met it, i.e. the shooter's side of a sheet that is a wall to sound: a window shot out from the yard reached the men in the room behind it only round by the front door
  earOff: 0.55,       // m off each face of the pane those two points stand: past one 0.5 m walk-grid cell, because a routed sound is searched — and kept for half a second — per CELL (collision.ts propagate), and a point sharing the struck point's cell would be handed that point's answer
};

/** THE ONE SWITCH over everything that makes glass more than a starred wall (rebuild/glass/tuning.md): panes that crack and come apart (glassbreak.ts, its own
 *  switch tune.glassBreak), rounds that go on through a sheet (glasspen.ts, GLASSPEN.on) and the glass that falls (shards.ts, tune.glassShards). ON as shipped;
 *  off = every one of them answers on its first line and the game is the one before any of it, run digest for run digest — whatever the parts' own switches say
 *  (they stay for A/B: ?glassbreak=0, ?glasspen=0, their Tab rows). `?glassfx=0|1` for a visit, env GLASSFX=on|off under bun, Tab ▸ Destruction ▸ Glass keeps the
 *  choice per machine. The QA harness leaves this up and stands the PARTS at off (src/host/standup.ts: every frozen digest was recorded with a pane a starred
 *  wall) unless the run says GLASSFX=on. The fracture's picture is a boot-time shader const (main.ts reads glassFxBoot()), so a flip SHOWS after a reload. */
export const GLASS_DEFAULTS = { crackGap: GLASS.crackGap, liveGap: GLASS.liveGap };
export const GLASSFX = { on: true };
let fxForced: boolean | null = null;
const FX_OFF = /^(0|off|false|no)$/i, FX_KEY = 'twopointsix.glassfx';
try { const q = new URLSearchParams(location.search); if (q.has('glassfx')) GLASSFX.on = fxForced = !FX_OFF.test(q.get('glassfx') ?? ''); } catch { /* no page */ }
try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GLASSFX; if (e) GLASSFX.on = fxForced = !FX_OFF.test(e); } catch { /* */ }
/** what a URL / env word said for this run (null: nothing — the stored choice, else on) */
export function glassFxForced(): boolean | null { return fxForced; }
/** Game constructor: the choice kept on this machine (a URL / env word wins for the visit) */
export function loadGlassFx() { if (fxForced !== null) return; try { const raw = localStorage.getItem(FX_KEY); if (raw) { const o = JSON.parse(raw); if (typeof o.on === 'boolean') GLASSFX.on = o.on; if (typeof o.crackGap === 'number' && isFinite(o.crackGap)) GLASS.crackGap = Math.max(0, Math.min(0.2, o.crackGap)); } } catch { /* no storage / bad JSON: the default */ } }
export function saveGlassFx() { try { localStorage.setItem(FX_KEY, JSON.stringify({ on: GLASSFX.on, crackGap: GLASS.crackGap })); } catch { /* */ } }
/** main.ts, before a Game or an Engine exists: the switch as this boot will have it */
export function glassFxBoot(): boolean { loadGlassFx(); return GLASSFX.on; }

/** per-Game glass bookkeeping (a WeakMap, like the whistle's: nothing on Game itself but the hooks) */
interface GlassState { panes: number[]; seen: WeakSet<object>; hits: number; lastHitT: number; log: string[]; eventAt: Map<number, number>; crackAt: number; }
const states = new SideMap<Game, GlassState>('glass.states');
export function glassState(g: Game): GlassState {
  let s = states.get(g);
  if (!s) { const panes: number[] = []; g.level.boxes.forEach((b, i) => { if (b.flags & BoxFlag.Glass) panes.push(i); }); s = { panes, seen: new SideSet(), hits: 0, lastHitT: -100, log: [], eventAt: new Map(), crackAt: -1e9 }; states.set(g, s); }
  return s;
}

/** Game.resetLevelState, beside decals.clear(): the crack stars have just gone with every other mark, so the encounter's hit count, last-hit clock and log go too
 *  ('N hits this encounter' on the panel meant every encounter since boot — review U9.10). The pane list and the seen-set stand (statics; a WeakSet). */
export function resetGlass(g: Game) { const s = states.get(g); if (!s) return; s.hits = 0; s.lastHitT = -100; s.log.length = 0; s.eventAt.clear(); s.crackAt = -1e9; }

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
/** FILE A PANE'S CRASH FOR THE FLOOR'S EARS — the one place a 'glass' hearing event is made (glassImpact below, glassbreak.ts emit). With GLASS.bothFaces the event
 *  also carries `ears`: a point GLASS.earOff off EACH face of the pane, level with where it was struck. A pane rings on both its faces; the point a round met it at
 *  is on the shooter's side of a sheet that blocks sound (collision.ts propagate), so by itself it puts the crash outside the room the window belongs to. */
export function glassEvent(g: Game, b: Box, at: Vec3, level: number, who: number): void {
  const e: GameEvent = { kind: 'glass', pos: [at[0], 0, at[2]], time: g.time, loud: true, level, who };
  if (GLASS.bothFaces) {
    const n = paneNormal(b); const off = v3.dot(v3.sub(at, b.c), n); const r = Math.min(b.h[0], b.h[2]) + GLASS.earOff;
    e.ears = [[at[0] + n[0] * (r - off), 0, at[2] + n[2] * (r - off)], [at[0] - n[0] * (r + off), 0, at[2] - n[2] * (r + off)]];
  }
  g.events.push(e);
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

/** THE IMPACT ENTRY POINT (rebuild/glass/fracture.md): a blow of `energy` met pane `pane` (a level box index) at `point` flying `dir` — the crack decal on the face it
 *  came at, the fracture filed (glassbreak.ts impact(): inert with tune.glassBreak off / chaos 0 / the tour — then the pane stays exactly what it was to every ray, foot
 *  and sound path), the crack heard, the event on the floor's ears. `energy` 1 = one pistol round square on (a rifle round 1.6‥2, a buckshot pellet 0.4, a thrown
 *  thing 0.3; under GLASSBREAK.punchE cracks annealed glass without punching it). `who` = whose doing (PLAYER_ID, a guard id, 0 = nobody's in particular). `quiet` (a
 *  blast's secondary stars): decal only — the bang was the noise. `opts.through` (optional) = the caller's own verdict on the round when it decided one before calling: true opens the glass where the round passed,
 *  false keeps it whole there, undefined lets the energy decide (glassbreak.ts impact()). The answer says what the glass did; what the round does next is the caller's. */
export function glassImpact(g: Game, pane: number, point: Vec3, dir: Vec3 | null, energy: number, who: number, cause: 'shot' | 'bang' | 'hand' = 'shot', quiet = false, opts?: { through?: boolean }): GlassImpact {
  const b = g.level.boxes[pane];
  const res: GlassImpact = { pane: isPane(b), live: false, type: 'laminated', thickness: 0, wasOpen: false, punched: false, diced: false, released: 0, cracked: false };
  if (!res.pane) return res;
  res.thickness = 2 * Math.min(b.h[0], b.h[2]);
  if (Math.min(b.h[0], b.h[2]) > THICK_GLASS_HALF) return res;   // THICK glass (the water-cooler bottle, 08-12): the round stops in it like in a pane, but no star, no crack, no 'glass' event — solid glass does not craze like a sheet
  // GLASS BREAKING first (it files nothing and draws nothing from any dice when it is not live, so with the switch off the order below is the base's): a blow through a
  // hole stars nothing, a pane that dices takes no star. A blast files its own through GlassBreak.blast(); ?. for fixtures that build a bare Game-like.
  const gb = g.glassBreak;
  if (gb) { if (cause !== 'bang') Object.assign(res, gb.impact(pane, point, dir, energy, who, opts?.through)); else res.type = gb.typeOfPane(pane) ?? 'laminated'; }
  if (res.wasOpen) return res;
  const S = glassState(g);
  const seed = hitSeed(pane, point);
  // the decal: centred where it hit, on the pane's mid-plane (composite finds it from either face), its normal toward the side the blow came from, its reach and
  // its look drawn off the seed; restricted to THIS pane on the GPU (cracks stop at the frame). Nothing when decals are off — the sound and the event still happen.
  let n = paneNormal(b);
  if (dir ? v3.dot(n, dir) > 0 : v3.dot(n, v3.sub(point, b.c)) < 0) n = v3.scale(n, -1);
  if (res.live && cause === 'shot' && !res.diced && res.released === 0) g.shards?.spall?.(point, n, dir, res.thickness, b.albedo, seed, opts?.through !== true);   // the sheet spits even when no piece leaves (a laminated web, a soft hit); nothing unless the falling-glass model is live
  const off = v3.dot(v3.sub(point, b.c), n);
  const pos = v3.mad(point, n, -off);                                   // onto the mid-plane
  const u = (seed & 0xffff) / 65535, w = (seed >>> 16) / 65535;
  const radius = GLASS.rMin + (GLASS.rMax - GLASS.rMin) * u;
  const ang = w * Math.PI * 2; const up: Vec3 = [0, 1, 0]; const side = v3.normalize(v3.cross(up, n));
  const tangent: Vec3 = v3.add(v3.scale(side, Math.cos(ang)), v3.scale(up, Math.sin(ang)));   // the star's orientation in the pane's plane
  if (!res.live || !res.cracked || g.engine.glassFracture !== true) g.decals.add('glassHit', pos, n, radius, { tangent, seed: (seed >>> 8) & 0xfff, pane, param: cause === 'bang' ? 0.6 : 1 });   // (a blow the fracture model filed draws its own cracks from its site — composite gbCracks: a second, unrelated star over them would be a lie; a blow that only fed an old star, toughened glass that has not yet gone, and a page whose shaders were compiled without the cracks keep the star)
  S.hits++; S.lastHitT = g.time;
  S.log.push(`${g.time.toFixed(1)}s pane ${pane} ${cause === 'bang' ? 'starred by a blast' : 'hit'}${who ? ` (who ${who})` : ''} r ${radius.toFixed(2)}`); if (S.log.length > 24) S.log.shift();
  if (quiet) return res;
  // (tuning round two) with the fracture model live a pane is hit by BURSTS: the crack still sounds per round, softer inside GLASS.liveGap of the last on this pane, but
  // the floor's ears get ONE 'glass' event per pane per gap — thirty rounds into a laminated web were thirty propagations a man. Not live = every hit its own, as it was.
  if (res.live) {
    // (round three) across the FLOOR no two hit cracks start inside crackGap of each other: two guns on a glazed wall were eight crack voices in a tenth of a second
    const sinceAny = g.time - S.crackAt; const sound = !(GLASS.crackGap > 0 && sinceAny >= 0 && sinceAny < GLASS.crackGap);
    if (sound) S.crackAt = g.time;
    // … and the floor's ears get one event per pane PER SHOOTER per liveGap (a second gun on the same pane is its own noise, under its own id)
    const key = pane * 1024 + (who & 1023); const last = S.eventAt.get(key); const since = last === undefined ? 1e9 : g.time - last;
    if (GLASS.liveGap > 0 && since >= 0 && since < GLASS.liveGap) {
      if (sound) g.audio.play('glassCrack', point, 0.5, { rate: 0.94 + 0.08 * u + 0.3 * w });
      if (who === PLAYER_ID) g.player.noise = Math.max(g.player.noise, GLASS.hearLevel);
      return res;
    }
    if (GLASS.liveGap > 0) S.eventAt.set(key, g.time);
    if (!sound) {   // the event is the floor's, the voice is skipped
      glassEvent(g, b, point, GLASS.hearLevel, who);
      if (who === PLAYER_ID) g.player.noise = Math.max(g.player.noise, GLASS.hearLevel);
      return res;
    }
  }
  // the crack: at the hole, on the floor's ears as its own kind (what the blow leaves FALLING afterwards is heard through glassbreak.ts emit)
  const area = 4 * b.h[1] * Math.max(b.h[0], b.h[2]);
  g.audio.play('glassCrack', point, 0.9, { rate: 0.94 + Math.min(0.22, 0.4 / Math.max(0.5, area)) + 0.08 * u });   // small panes ring higher; no two hits quite alike
  glassEvent(g, b, point, GLASS.hearLevel, who);
  if (who === PLAYER_ID) g.player.noise = Math.max(g.player.noise, GLASS.hearLevel);
  return res;
}
/** A round (or anything else that stars glass) met pane `bi` at `hitP` flying `dir` = glassImpact at energy 1. Returns false if `bi` is not a pane. */
export function glassHit(g: Game, bi: number, hitP: Vec3, dir: Vec3 | null, who: number, cause: 'shot' | 'bang' | 'hand' = 'shot', quiet = false): boolean {
  return glassImpact(g, bi, hitP, dir, 1, who, cause, quiet).pane;
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
    g.glassBreak?.bang([e.pos[0], Math.max(0.3, e.pos[1]), e.pos[2]], e.who ?? 0);   // GLASS BREAKING: a stun charge's overpressure at GLASSBREAK.bangPower — a tempered pane beside it dices, an annealed one is starred and loses the pieces nearest it (a real charge comes through destruction's blast entry point → GlassBreak.blast at full power)
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

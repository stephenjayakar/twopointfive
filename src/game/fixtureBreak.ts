// A LIGHT FIXTURE SEEN TO BREAK, AND SEEN BROKEN AFTERWARDS — picture only (the look of the destruction lane's dead lights).
//
// The ceiling panels are NoPrimary: the play camera looks down through the ceiling, so a panel is never drawn, lit or dead — a blast that killed one read as "the picture
// went dark". With the destruction switch on, a panel whose light target is `broken` now shows it:
//   · THE BEAT (the frames after it dies): the fixture lets go at the end nearer the blast and swings down on the other, its diffuser and glass come down, and the torn
//     lead at its free end arcs — a few spurts of sparks falling from the fixture itself, each with a pop of glow at the lead; two seconds on the other end tears
//     out too and the fixture comes down;
//   · AFTERWARDS: the tray lies on the floor (or the furniture) under where it hung, skewed, a tube beside it, the cracked diffuser and glass round it, and the lead
//     keeps spitting now and then for a while, ever more rarely. (Nothing is left hanging between the camera and the men: FIXLOOK.hangSecs = Infinity leaves it hanging.)
// A lamp that is not a ceiling panel (a street lamp's head, a desk lamp) gets the sparks only.
//
// LOOK ONLY, by construction:
//   · nothing here decides anything: it READS LightTarget.broken once a frame (whoever broke it — a blast, a shaken ceiling, a round, a wall that fell with it) and draws;
//   · every box is Dynamic | NoShadow and exists only in the frame's dynamic list: no ray, no collision query, no nav cell, no reach mask, no smoke obstacle sees one;
//   · the glow is the EMISSIVE of such a box: it shows on screen (and blooms) and lights nothing — no light is added, the cascades and the light meter cannot find it;
//   · sparks and glass are GPU particles (nothing without them); no decal, no sound, no smoke, no debris-pool chunk, no GameEvent;
//   · every choice hashes the fixture's own position — never Math.random, never the lane's counters or rate caps.
// Nothing is saved: after a restart every target is unbroken and the records go; after a checkpoint load a broken panel is simply drawn fallen (no beat).
import { SideMap } from '../math/side';
import { Vec3, Quat, v3, quat } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import { DESTRUCTION } from './destructionSwitch';
import { gpuFx } from './particleFx';
import type { Game, LightTarget } from './game';

/** the look's numbers (no switch of its own: it rides the destruction switch; `on` is for the proofs and the probe) */
export const FIXLOOK = {
  on: true,
  maxPanels: 12,                    // panels drawn broken at once (past it a dying fixture still sparks; the oldest keep their boxes)
  restDeg: [55, 65] as [number, number],   // where the tray comes to hang, from the ceiling's plane (steep: a small footprint from above, its low end still over a standing man's head)
  swingK: 30, swingC: 2.2, kick: 3.4,      // the swing: stiffness and damping about the rest angle (1/s², 1/s), the rate it lets go at (rad/s)
  hangSecs: 1.9, slide: 0.35, skew: 0.5,   // seconds it hangs by one end before that tears out too (±15 %; Infinity = it stays hanging), then how far to the side (m) and how skewed (rad) it comes to lie
  pops: [0.62, 1.0, 1.5, 2.2, 3.1],        // seconds after the light died: the lead arcs (each ±15 % by the fixture's own dice) — the first, the big one, as a charge's own sparks thin
  popSparks: [30, 22, 13, 9, 6], popGain: [1, 0.8, 0.55, 0.4, 0.3], popTau: 0.07,
  glowTip: 12,                      // emitted radiance of the lead at a pop's peak (screen only: it lights nothing)
  // the arc's sparks (the maintainer, 10-10: "sparks from lights that are out look too fat"): a spark is drawn as its own streak — speed × the shutter, never thinner than a
  // pixel and a half — so at 2.6 m/s, thrown straight down under a camera that looks down, each was a round dot three pixels across, alight for a second. Now thrown fast
  // and sideways (a streak four times as long on screen), thinner (dimmer: less bloom round it) and gone in half the time; and the lead that glows is the bare end of the
  // wire, not a block the size of a fist
  spark: { speed: 6, speedJit: 0.6, spread: 1.15, life: 0.42, lifeJit: 0.5, size: 0.002 },
  sparkAside: 0.9, sparkDown: 0.55, sparkUp: 0.5,   // which way: along the fixture's own line (× sparkAside) and down from where it hangs (× sparkDown) / up off where it lies (× sparkUp)
  lead: [0.018, 0.008, 0.012] as Vec3,       // the torn lead's bare end, half extents (m): along the fixture, through it, across it
  spitFrom: 3.6, spitSecs: 45, spitTau: 16, spitRate: 0.22, spitGain: 0.2,   // afterwards: the lead spits now and then, ever more rarely, never after spitSecs (what shows where the wreck lies in a room it left dark)
  glass: 26, glassSize: 0.013, glassAt: 0.15,   // the tube's glass coming down with the diffuser (particles), born once a charge's own burst has had its frames of the birth cap
  shards: 5,                        // glass lying on the floor afterwards (boxes)
  tray: [0.4, 0.41, 0.42] as Vec3, cover: [0.55, 0.55, 0.56] as Vec3, face: [0.78, 0.78, 0.75] as Vec3, tube: [0.8, 0.8, 0.78] as Vec3, soot: [0.06, 0.055, 0.05] as Vec3,
  diffuser: [0.8, 0.83, 0.86] as Vec3, shard: [0.85, 0.9, 0.9] as Vec3,
};
export const FIXLOOK_STATS = { panels: 0, lamps: 0, beats: 0, boxes: 0, sparks: 0 };

interface Piece { box: Box; v: Vec3; axis: Vec3; rate: number; ang: number; q0: Quat; floorY: number; yaw: number; delay: number; rest: boolean; bounced: boolean; glass: boolean; on: Box | null; onX: number; onZ: number }
interface Rec {
  t: LightTarget; kind: 1 | 2; born: number; seed: number; seen: number;
  hinge: Vec3; uh: Vec3; L: number; W: number; th: number; om: number; rest: number; still: boolean;
  hang: Box[]; pieces: Piece[]; pop: number; lastSlot: number; glassOut: boolean; tip: Vec3; emits: number;
  /** the fall: 0 hanging, 1 coming down, 2 lying; when it tears out (s after it broke), where it hung from, the angle and time it fell from, where it comes to lie */
  phase: 0 | 1 | 2; fallAt: number; h0: Vec3; th0: number; t0: number; lie: Vec3; uh0: Vec3; skew: number;
  /** how far the loose tube has slid out beside the tray (0 in its clips ‥ 1 beside it on the floor) */
  lay: number;
}
interface State { recs: Rec[]; by: Map<LightTarget, Rec>; prev: WeakMap<LightTarget, boolean>; kind: WeakMap<LightTarget, 0 | 1 | 2>; lastT: number; scan: number; keys: number }
const STATE = new SideMap<Game, State>('fixtureBreak.STATE');

/** integer hash → [0, 1) (the module's own dice, keyed by the fixture's place) */
function h01(x: number): number { x = Math.imul((x ^ 0x68E31DA4) >>> 0, 0x9E3779B1) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA77) >>> 0; x ^= x >>> 13; return (x >>> 8) / 16777216; }
const LOOK = BoxFlag.Dynamic | BoxFlag.NoShadow;
const DOWN: Vec3 = [0, -1, 0];

/** 1 = a ceiling panel (a flat NoPrimary emissive slab under the ceiling: the full look), 2 = a lamp with a light of its own (sparks only), 0 = not ours (screens, LEDs, beacons, the breaker, devices) */
function kindOf(g: Game, t: LightTarget): 0 | 1 | 2 {
  if (!t.interactive) return 0;
  if (t.kind === 'analytic') return t.light ? 2 : 0;
  if (t.kind !== 'emissive' || !t.boxes.length) return 0;
  const b = g.engine.world.statics[t.boxes[0]]; if (!b) return 0;
  const long = Math.max(b.h[0], b.h[2]), short = Math.min(b.h[0], b.h[2]);
  return (b.flags & BoxFlag.NoPrimary) && b.h[1] <= 0.06 && b.c[1] > 2.2 && long >= 0.25 && long <= 1.2 && short >= 0.1 ? 1 : 0;
}

/** the top of whatever lies under (x, z): the level's statics by one ray down, the furniture by its boxes' footprints (a read; nothing is asked that play asks differently for it) */
function floorAt(g: Game, x: number, z: number, from: number): number {
  let y = 0; const hit = g.col.raycast([x, from, z], DOWN, from + 0.5); if (hit && hit.index < 1e6) y = Math.max(0, from - hit.t);   // (a door leaf's top edge is no floor)
  FLOOR.on = null;
  for (const p of g.props.props) for (const b of p.boxes) {
    if (b.flags & BoxFlag.NoShadow) continue; const top = b.c[1] + b.h[1]; if (top <= y || top > from) continue;
    const dx = x - b.c[0], dz = z - b.c[2], cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    if (Math.abs(lx) <= b.h[0] && Math.abs(lz) <= b.h[2]) { y = top; FLOOR.on = b; }
  }
  return y;
}
const FLOOR: { on: Box | null } = { on: null };
/** what a fixture lying from (x, z) along (ux, uz) rests on: the highest of three samples down its length, and whether that is flat bare floor (all three level, no furniture under any) */
function restOn(g: Game, x: number, z: number, ux: number, uz: number, L: number, from: number): { y: number; flat: boolean } {
  let y = 0, lo = 1e9, prop = false;
  for (const a of REST_AT) { const f = floorAt(g, x + ux * L * a, z + uz * L * a, from); if (FLOOR.on) prop = true; if (f > y) y = f; if (f < lo) lo = f; }
  return { y, flat: y - lo < 0.05 && !prop };
}
const REST_AT = [0.15, 0.5, 0.85];   // the furniture box floorAt's answer was the top of (a piece lying on it drops to the floor when it is moved away)

/** where the blast or the round that just killed it came from, if this frame's events say (a read of the hearing events: the end of the fixture nearer to it lets go) */
function causeOf(g: Game, at: Vec3): Vec3 | null {
  const ev = g.events; let best: Vec3 | null = null, bd = 12;
  for (let i = ev.length - 1; i >= 0 && i >= ev.length - 48; i--) { const e = ev[i]; if (g.time - e.time > 0.3) continue;
    if (e.kind !== 'bang' && e.kind !== 'shot' && e.kind !== 'guardShot') continue; const d = v3.dist(e.pos, at); if (d < bd) { bd = d; best = e.pos; } }
  return best;
}

function add(S: State, g: Game, t: LightTarget, kind: 1 | 2, born: number): Rec {
  const b = kind === 1 ? g.engine.world.statics[t.boxes[0]] : null; const c = b ? b.c : t.pos;
  const seed = (Math.round(c[0] * 100) * 73856093) ^ (Math.round(c[2] * 100) * 19349663) ^ (Math.round(c[1] * 100) * 83492791);
  const r: Rec = { t, kind, born, seed, seen: S.scan, hinge: v3.copy(c), uh: [1, 0, 0], L: 0, W: 0, th: 0, om: 0, rest: 0, still: false, hang: [], pieces: [], pop: 0, lastSlot: -1, glassOut: false, tip: v3.copy(c), emits: 0, phase: 0, fallAt: Infinity, h0: v3.copy(c), th0: 0, t0: 0, lie: v3.copy(c), uh0: [1, 0, 0], skew: 0, lay: 0 };
  const beat = born > -1e8; if (!beat) { r.pop = FIXLOOK.pops.length; r.glassOut = true; }
  if (beat) FIXLOOK_STATS.beats++;
  if (!b) { const a = h01(seed + 7) * 2 * Math.PI; r.uh = [Math.cos(a), 0, Math.sin(a)]; FIXLOOK_STATS.lamps++; return r; }   // (a lamp has no line of its own: its sparks lean a bearing of its own, not the world's +x)
  const q = quat.yaw(b.yaw), long = b.h[0] >= b.h[2]; const u = quat.rotate(q, long ? [1, 0, 0] : [0, 0, 1]);
  if (S.recs.reduce((n, x) => n + (x.hang.length ? 1 : 0), 0) >= FIXLOOK.maxPanels) { r.uh = v3.scale(u, h01(seed + 7) < 0.5 ? -1 : 1); return r; }   // (over the cap: this one sparks along its own line, nothing hangs)
  FIXLOOK_STATS.panels++;
  const L = r.L = 2 * (long ? b.h[0] : b.h[2]), W = r.W = 2 * (long ? b.h[2] : b.h[0]);
  const from = beat ? causeOf(g, c) : null; const dn = from ? v3.dot(u, v3.sub(c, from)) : 0;
  const side = Math.abs(dn) > 0.05 ? Math.sign(dn) : h01(seed) < 0.5 ? -1 : 1;   // the hinge is the end AWAY from what hit it
  r.hinge = [c[0] + u[0] * side * L / 2, c[1] - 0.02, c[2] + u[2] * side * L / 2]; r.uh = v3.scale(u, -side);
  r.rest = (FIXLOOK.restDeg[0] + (FIXLOOK.restDeg[1] - FIXLOOK.restDeg[0]) * h01(seed + 1)) * Math.PI / 180;
  r.h0 = v3.copy(r.hinge); r.lie = v3.copy(r.hinge); r.uh0 = v3.copy(r.uh); r.fallAt = FIXLOOK.hangSecs * (0.85 + 0.3 * h01(seed + 3));
  if (isFinite(r.fallAt)) {   // where it comes to lie: under where it hung, slid to one side and skewed, face down on the floor or on what stands there
    // — the first slide / skew that keeps all four corners (and the tube beside it) this side of every wall AND lies flat on the bare floor; else the first that clears the walls; else straight under where it hung
    const w0: Vec3 = [-r.uh[2], 0, r.uh[0]], s0 = h01(seed + 4) < 0.5 ? -1 : 1, sk0 = (h01(seed + 5) - 0.5) * 2 * FIXLOOK.skew;
    const eye: Vec3 = [c[0], 1.4, c[2]], half = W / 2 + 0.1; let rank = -1;
    for (const k of [s0, -s0, 0]) for (const sk of [sk0, -sk0, 0]) { if (rank === 3) break;
      const sl = k * Math.max(FIXLOOK.slide, W * 0.6); const x = r.hinge[0] + w0[0] * sl, z = r.hinge[2] + w0[2] * sl;
      const cs = Math.cos(sk), sn = Math.sin(sk); const ux = r.uh[0] * cs - r.uh[2] * sn, uz = r.uh[0] * sn + r.uh[2] * cs;   // (land()'s own turn)
      let clear = true; for (const a of [0, 1]) for (const e of [-half, half]) if (clear && g.col.solidBlocked(eye, [x + ux * L * a - uz * e, 1.4, z + uz * L * a + ux * e])) clear = false;
      const f = restOn(g, x, z, ux, uz, L, c[1] - 0.1); const q = clear ? (f.flat ? 3 : 2) : 0;
      if (q > rank || q === 0 && rank === 0) { rank = q; r.skew = sk; r.lie = [x, Math.min(f.y, c[1] - 0.3) + 0.046, z]; }
    }
  }
  if (beat) { r.th = 0.02; r.om = FIXLOOK.kick * (0.85 + 0.3 * h01(seed + 2)); } else if (isFinite(r.fallAt)) { r.phase = 2; r.th = 0; r.still = true; r.lay = 1; land(r, 1); } else { r.th = r.rest; r.still = true; }
  const key = MKEY.test + 0x5000 + ((S.keys++ & 0xff) << 5); let part = 0;
  const mk = (h: Vec3, albedo: Vec3, rough?: number): Box => { const x = makeBox({ c: v3.copy(c), h, albedo: v3.copy(albedo), flags: LOOK, rot: quat.ident(), name: 'fixtureLook' }); x.mkey = key + part++; if (rough !== undefined) x.rough = rough; return x; };
  // the fixture hanging: tray, the ballast cover on its back, the white face, a tube slid part way out of its clips past the free end (what says 'light' from above, where only the tray's back shows), the stub of the one that burst, the torn lead at the free end (the glow)
  r.hang = [mk([L / 2, 0.02, W / 2], FIXLOOK.tray), mk([L * 0.15, 0.03, Math.min(0.06, W * 0.22)], FIXLOOK.cover), mk([L / 2 - 0.015, 0.003, W / 2 - 0.02], FIXLOOK.face),
    mk([L / 2 - 0.07, 0.014, 0.014], FIXLOOK.tube), mk([L * 0.15, 0.014, 0.014], FIXLOOK.tube), mk([...FIXLOOK.lead] as Vec3, FIXLOOK.soot)];
  r.hang[5].flags |= BoxFlag.AreaLit;   // (belt and braces: were a ray ever to meet it, its glow would still count for nothing)
  // what comes down: the diffuser in two unequal pieces, and a few shards of the tube
  const w: Vec3 = [-r.uh0[2], 0, r.uh0[0]]; const y0 = c[1] - 0.06;
  const piece = (h: Vec3, a: number, s: number, albedo: Vec3, glass: boolean, k: number): Piece => {
    const hs = (n: number) => h01(seed + 97 * k + n); const box = mk(h, albedo, glass ? 0.15 : 0.3);
    const p: Vec3 = [r.h0[0] + r.uh0[0] * a + w[0] * s, y0, r.h0[2] + r.uh0[2] * a + w[2] * s];
    const v: Vec3 = [r.uh0[0] * (0.2 + 0.7 * hs(1)) + w[0] * (hs(2) - 0.5) * (glass ? 2.6 : 0.8), 0, r.uh0[2] * (0.2 + 0.7 * hs(1)) + w[2] * (hs(2) - 0.5) * (glass ? 2.6 : 0.8)];
    if (glass) { v[0] += r.uh0[0] * (hs(6) - 0.4) * 1.6; v[2] += r.uh0[2] * (hs(6) - 0.4) * 1.6; }
    const yaw = b.yaw + (hs(3) - 0.5) * (glass ? 6.28 : 0.9); const q0 = quat.yaw(yaw); const axis = v3.normalize([w[0] + (hs(4) - 0.5) * 0.8, (hs(5) - 0.5) * 0.4, w[2] + (hs(4) - 0.5) * 0.8]);
    const fall = Math.sqrt(2 * y0 / 9.8); const floorY = floorAt(g, p[0] + v[0] * fall, p[2] + v[2] * fall, y0); const on = FLOOR.on;
    box.c = p; box.yaw = yaw; box.rot = q0;
    const P: Piece = { box, v, axis, rate: (glass ? 9 : 3.2) * (0.6 + 0.8 * hs(7)), ang: 0, q0, floorY, yaw, delay: glass ? 0.02 + 0.2 * hs(8) : k * 0.11, rest: false, bounced: false, glass, on, onX: on ? on.c[0] : 0, onZ: on ? on.c[2] : 0 };
    if (!beat) { const tf = Math.sqrt(2 * Math.max(0, y0 - floorY) / 9.8); box.c = [p[0] + v[0] * tf, floorY + h[1] + 0.002, p[2] + v[2] * tf]; P.rest = true; }
    return P;
  };
  r.pieces.push(piece([L * 0.3, 0.005, W * 0.46], L * 0.36, 0, FIXLOOK.diffuser, false, 0), piece([L * 0.17, 0.005, W * 0.44], L * 0.8, 0.02, FIXLOOK.diffuser, false, 1));
  for (let k = 0; k < FIXLOOK.shards; k++) { const hs = (n: number) => h01(seed + 977 * (k + 1) + n);
    r.pieces.push(piece([0.018 + 0.035 * hs(1), 0.003, 0.008 + 0.02 * hs(2)], L * (0.15 + 0.7 * hs(3)), (hs(4) - 0.5) * W * 0.5, FIXLOOK.shard, true, k + 2)); }
  pose(r);
  return r;
}

/** the hanging fixture's boxes at the swing's angle `th` (0 = flat under the ceiling, the free end coming down as it grows) */
function pose(r: Rec) {
  if (!r.hang.length) return;
  const cs = Math.cos(r.th), sn = Math.sin(r.th), uh = r.uh;
  const d: Vec3 = [uh[0] * cs, -sn, uh[2] * cs];            // hinge → free end
  const n: Vec3 = [-uh[0] * sn, -cs, -uh[2] * sn];          // the face's normal (straight down while it was up)
  const up: Vec3 = [-n[0], -n[1], -n[2]]; const z = v3.cross(d, up); const q = quat.fromBasis(d, up, z);
  const L = r.L, W = r.W; const yaw = Math.atan2(-d[2], d[0]);
  const at = (i: number, a: number, off: number, s: number) => { const x = r.hang[i]; x.c = [r.hinge[0] + d[0] * a + n[0] * off + z[0] * s, r.hinge[1] + d[1] * a + n[1] * off + z[1] * s, r.hinge[2] + d[2] * a + n[2] * off + z[2] * s]; x.rot = q; x.yaw = yaw; };
  at(0, L / 2, -0.02, 0); at(1, L * 0.3, -0.07, 0); at(2, L / 2, 0.003, 0); at(3, L * (0.62 - 0.06 * r.lay), 0.03, W * 0.2 + (W * 0.3 + 0.07) * r.lay); at(4, 0.07 + L * 0.15, 0.03, -W * 0.2); at(5, L + 0.012, -0.005, -W * 0.2);
  r.tip = r.hang[5].c;
}

/** the fixture `s` (0‥1) of the way from where it hung to where it lies: the hinge end comes down (a free fall) and across, the long axis skews */
function land(r: Rec, s: number) {
  r.hinge = [r.h0[0] + (r.lie[0] - r.h0[0]) * s, r.h0[1] + (r.lie[1] - r.h0[1]) * s * s, r.h0[2] + (r.lie[2] - r.h0[2]) * s];
  const a = r.skew * s, cs = Math.cos(a), sn = Math.sin(a); r.uh = [r.uh0[0] * cs - r.uh0[2] * sn, 0, r.uh0[0] * sn + r.uh0[2] * cs];
}

/** the arc at the torn lead `a` seconds after the light died: 0‥1 (a pop's peak = its gain), and whether a pop or a spit STARTS inside this frame (→ sparks) */
function glowAt(r: Rec, a: number, out: { sparks: number }): number {
  const F = FIXLOOK; let gl = 0; out.sparks = 0;
  for (let k = 0; k < F.pops.length; k++) { const tk = F.pops[k] * (0.85 + 0.3 * h01(r.seed + 11 * k + 5)); if (a < tk) break; gl += F.popGain[k] * Math.exp(-(a - tk) / F.popTau); if (k >= r.pop) { r.pop = k + 1; out.sparks += F.popSparks[k]; } }
  if (a > F.spitFrom && a < F.spitSecs) { const slot = Math.floor(a / 0.11); const h = h01(r.seed + slot * 31 + 7), p = F.spitRate * Math.exp(-a / F.spitTau);
    if (h < p) { gl += F.spitGain * (0.5 + h01(r.seed + slot * 17 + 3)); if (slot !== r.lastSlot && h < p * 0.4) out.sparks += 4; } r.lastSlot = slot; }
  return gl;
}
const SPARKS = { sparks: 0 };
/** the seed of the fixture's next emit (its own count, hashed with its place) */
function seedOf(r: Rec): number { return (Math.imul((r.seed ^ 0x51ED270B) + r.emits++ * 7919, 0x9E3779B1) >>> 0) || 1; }

/** Once a frame (game.ts, with the other dynamic boxes): notice fixtures that broke or were repaired, move what is moving, hand the frame the look's boxes. */
export function fixtureBreakBoxes(g: Game, out: Box[], dt: number) {
  let S = STATE.get(g);
  if (!DESTRUCTION.on || !FIXLOOK.on) { if (S) { S.recs.length = 0; S.by.clear(); S.lastT = -1; } return; }
  if (!S) STATE.set(g, S = { recs: [], by: new Map(), prev: new SideMap(), kind: new SideMap(), lastT: -1, scan: 0, keys: 0 });
  const now = g.time; const running = S.lastT >= 0 && now >= S.lastT && now - S.lastT < 0.5;   // (the clock ran on from the last frame: a target broken since then BROKE — after a load or a restart it is just found broken)
  if (!running && S.recs.length) { S.recs.length = 0; S.by.clear(); }   // (the clock jumped — a checkpoint load: whatever is broken now is found broken, hanging at rest)
  S.lastT = now; S.scan++;
  for (const t of g.targets) {
    let k = S.kind.get(t); if (k === undefined) S.kind.set(t, k = kindOf(g, t)); if (!k) continue;
    const was = S.prev.get(t); if (was !== t.broken) S.prev.set(t, t.broken);
    const r = S.by.get(t);
    if (r) { if (t.broken) r.seen = S.scan; continue; }
    if (t.broken) { const n = add(S, g, t, k, running && was === false ? now : -1e9); S.recs.push(n); S.by.set(t, n); }
  }
  if (!S.recs.length) return;
  let dropped = false; for (const r of S.recs) if (r.seen !== S.scan) { S.by.delete(r.t); dropped = true; }   // repaired (a restart, the panel's 'repair lights') or no longer a target: gone
  if (dropped) S.recs = S.recs.filter(r => r.seen === S!.scan);
  const P = gpuFx(g); const F = FIXLOOK; let boxes = 0;
  for (const r of S.recs) {
    const a = now - r.born;
    if (r.hang.length && r.phase === 2 && ((S.scan + (r.seed & 63)) & 63) === 0) {   // about once a second: is what it lies on still there? (furniture shoved away, a thing on a desk knocked off: it drops to what is under it now)
      const y = restOn(g, r.hinge[0], r.hinge[2], r.uh[0], r.uh[2], r.L, r.lie[1] + 0.05).y + 0.046;
      if (y < r.lie[1] - 0.03) { r.h0 = v3.copy(r.hinge); r.uh0 = v3.copy(r.uh); r.skew = 0; r.th0 = 0; r.t0 = a; r.lie = [r.hinge[0], y, r.hinge[2]]; r.phase = 1; r.still = false; }
    }
    if (r.hang.length && r.phase === 0 && a >= r.fallAt) { r.phase = 1; r.th0 = r.th; r.t0 = a; r.still = false; }   // the other end tears out
    if (r.hang.length && r.phase === 1) {   // coming down: the hinge end in free fall, the tray flattening out as it goes, flat as it lands
      const T = Math.sqrt(2 * Math.max(0.1, r.h0[1] - r.lie[1]) / 9.8), s = Math.min(1, Math.max(0, a - r.t0) / T);
      r.th = r.th0 * (1 - s); if (s > r.lay) r.lay = s; land(r, s);
      if (s >= 1) { r.phase = 2; r.still = true;
        if (P) P.emit('debris', [r.hinge[0] + r.uh[0] * r.L / 2, r.lie[1], r.hinge[2] + r.uh[2] * r.L / 2], [0, 1, 0], 10, { speed: 1.2, speedJit: 0.7, spread: 1.4, life: 25, lifeJit: 0.3, size: 0.012, sizeJit: 0.6, aspect: 1.6, posJit: Math.min(0.3, r.L * 0.3), color: [0.88, 0.92, 0.92], seed: seedOf(r) }); }
      pose(r);
    } else if (r.hang.length && !r.still) {   // the swing: a damped spring about the rest angle, the ceiling its stop
      const h = Math.min(dt, 1 / 30); r.om += (-F.swingK * (r.th - r.rest) - F.swingC * r.om) * h; r.th += r.om * h;
      if (r.th < 0) { r.th = 0; r.om = Math.abs(r.om) * 0.3; } if (r.th > 1.45) { r.th = 1.45; r.om = -Math.abs(r.om) * 0.3; }
      if (a > 3 && Math.abs(r.th - r.rest) < 0.004 && Math.abs(r.om) < 0.02) { r.th = r.rest; r.still = true; }
      pose(r);
    }
    if (a < F.spitSecs) {
      const gl = glowAt(r, Math.max(0, a), SPARKS); const warm = Math.min(1, Math.max(0, a) / 1.5);
      if (r.hang.length) { const e = F.glowTip * gl; r.hang[5].emissive = [e * (0.8 + 0.2 * warm), e * (0.9 - 0.25 * warm), e * (1 - 0.8 * warm)]; }
      // (every emit carries a seed of the fixture's own, so the particles' serial — what every other effect's births hash — is never advanced by the look)
      if (P && SPARKS.sparks > 0) { const d: Vec3 = r.phase === 2 ? [r.uh[0] * F.sparkAside, F.sparkUp, r.uh[2] * F.sparkAside] : r.hang.length ? [r.uh[0] * F.sparkAside, -F.sparkDown, r.uh[2] * F.sparkAside] : [r.uh[0] * F.sparkAside * 0.5, -1, r.uh[2] * F.sparkAside * 0.5];   // (out past its free end and down from where it hangs, out and up off where it lies; a lamp's or a panel past the cap: down, leaning a little along its own line)
        P.emit('spark', r.tip, v3.normalize(d), SPARKS.sparks, { ...F.spark, seed: seedOf(r) }); FIXLOOK_STATS.sparks += SPARKS.sparks; }
      if (P && !r.glassOut && a >= F.glassAt && r.hang.length) { r.glassOut = true;   // born well under the ceiling, in two lots along the fixture
        for (const k of [0.3, 0.7]) P.emit('debris', [r.hinge[0] + r.uh[0] * r.L * k, r.hinge[1] - 0.3, r.hinge[2] + r.uh[2] * r.L * k], DOWN, F.glass >> 1,
          { speed: 1.3, speedJit: 0.8, spread: 1.25, life: 25, lifeJit: 0.3, size: F.glassSize, sizeJit: 0.6, aspect: 1.7, posJit: Math.min(0.2, r.L * 0.2), color: [0.88, 0.92, 0.92], seed: seedOf(r) }); }
    } else if (r.hang.length && r.hang[5].emissive[0] > 0) r.hang[5].emissive = [0, 0, 0];
    for (const p of r.pieces) {
      if (p.rest && p.on && (p.on.c[0] !== p.onX || p.on.c[2] !== p.onZ)) { p.on = null; p.rest = false; p.bounced = true; p.floorY = floorAt(g, p.box.c[0], p.box.c[2], p.box.c[1] - 0.05); p.v = [0, 0, 0]; p.rate = 0; }   // what it lay on was moved away: down to what is under it now
      if (!p.rest) {
        if (a < p.delay) continue;   // (still in the fixture: not drawn yet)
        const h = Math.min(dt, 1 / 30), b = p.box; p.v[1] -= 9.8 * h; b.c = [b.c[0] + p.v[0] * h, b.c[1] + p.v[1] * h, b.c[2] + p.v[2] * h]; p.ang += p.rate * h; b.rot = quat.mul(quat.axisAngle(p.axis, p.ang), p.q0);
        const lie = p.floorY + b.h[1] + 0.002;
        if (b.c[1] <= lie + (p.bounced ? 0 : Math.max(b.h[0], b.h[2]) * 0.5)) {   // down: one dead bounce for a diffuser piece, then flat where it stopped
          if (!p.bounced && !p.glass) { p.bounced = true; p.v = [p.v[0] * 0.4, 1.1, p.v[2] * 0.4]; p.rate *= 0.5; b.c[1] = lie + Math.max(b.h[0], b.h[2]) * 0.5;
            if (P) P.emit('debris', [b.c[0], p.floorY + 0.03, b.c[2]], [0, 1, 0], 8, { speed: 1.4, speedJit: 0.7, spread: 1.3, life: 25, lifeJit: 0.3, size: 0.012, sizeJit: 0.6, aspect: 1.6, posJit: 0.15, color: [0.88, 0.92, 0.92], seed: seedOf(r) }); }
          else { p.rest = true; b.c[1] = lie; b.rot = quat.yaw(p.yaw + p.ang * 0.3); b.yaw = p.yaw + p.ang * 0.3; }
        }
      }
      out.push(p.box); boxes++;
    }
    for (const b of r.hang) out.push(b); boxes += r.hang.length;
  }
  FIXLOOK_STATS.boxes = boxes;
}

/** QA: what the look holds for this game (the probe and the page's console) */
export function fixtureLookState(g: Game): { recs: number; hanging: number; boxes: number; moving: number; trays: { from: Vec3; y: number; corners: Vec3[] }[] } {
  const S = STATE.get(g); if (!S) return { recs: 0, hanging: 0, boxes: 0, moving: 0, trays: [] };
  let hanging = 0, boxes = 0, moving = 0; const trays: { from: Vec3; y: number; corners: Vec3[] }[] = [];
  for (const r of S.recs) { if (r.hang.length) hanging++; boxes += r.hang.length + r.pieces.length; if (r.hang.length && !r.still) moving++; for (const p of r.pieces) if (!p.rest) moving++;
    if (r.hang.length) { const w: Vec3 = [-r.uh[2], 0, r.uh[0]], e = r.W / 2 + 0.085; const from = g.engine.world.statics[r.t.boxes[0]].c;   // (the tray's corners where it is now, the side the loose tube lies on taken out to the tube)
      trays.push({ from, y: r.hinge[1], corners: [0, 1].flatMap(k => [-e, e].map((x): Vec3 => [r.hinge[0] + r.uh[0] * r.L * k + w[0] * x, r.hinge[1], r.hinge[2] + r.uh[2] * r.L * k + w[2] * x])) }); } }
  return { recs: S.recs.length, hanging, boxes, moving, trays };
}

// THE AIR AS ONE SIMULATED FIELD (the maintainer, 10-14: "can we make the wind sim be a general system we always run? we already have wind hooked up to the
// other systems, this would just be an improvement on it"; before it: "the nice thing of integrating with the fluid system is that you'll naturally get neat
// interactions where the wind hits a wall", "like vortices past the edge of the door"). render/airField.ts is a small fluid simulation of the air over the whole
// level floor (WORLD's 40 × 28 m at AIR_CELLS cells a metre); THIS file is what the game tells it, once a frame, on every level:
//   • THE MAP: one byte a cell — SOLID where a wall, a piece of furniture or a door leaf stands in the wind (the level's static boxes that reach from under
//     AIR_SIM.maxFoot to over AIR_SIM.minTop, glass until most of the pane is out, whatever destruction has hidden left out; every door's leaf where it hangs
//     now), and otherwise the share of the ambient wind forced there: all of it under the sky, AIR_SIM.roofShare under one of the level's own ceiling slabs
//     (weather.ts roofsOf — the level's roofs as built, whichever rule the rain is drawn by). Rebuilt only when a box, a pane or a leaf has changed.
//   • THE WIND: wind.ts's sources as they blow THIS frame (its update has just run: cycling, the mains, the gusting, the master) — the storm's vector, at its
//     ground share, as the ambient; every vent, every gust through an open outside door or a shot-out pane as a local source (a ceiling diffuser's down-jet as
//     air spreading across the floor under it: the field is a floor plan, height is a profile its readers lay on it).
// wind.ts's analytic field stays what every CPU reader asks (the moths, the debugger's arrows, `at`) and what the smoke solver and the loose particles are pulled
// toward: the simulation is a GPU texture, and game code reads no GPU value. A PICTURE ONLY until a reader that guards see through is moved onto it — today
// its readers are the blown snow's grains and wisps (snowFx.ts). Nothing here rolls a die, files a particle or writes a field the simulation reads: a run's
// digest is the same with it on and off (tools/qa airsim-check).
// IT IS STEPPED WHILE SOMETHING READS IT: the field is there on every level, and a reader says so each frame it wants the air (airWant — the grains do, on a
// level in snow). A frame nobody asked for encodes nothing and draws no map: a level whose air nothing rides yet pays nothing for it. Still air (no source
// blowing for AIR_SIM.settle seconds) is not stepped either.
// SWITCH: AIR_SIM.on — ON in the page (`?air=0` = no field is built: the build as it was), OFF here and on the frozen stand (TPS_AIR=1).
import { SideMap } from '../math/side';
import type { Game } from './game';
import type { Box } from '../scene/boxes';
import { BoxFlag } from '../scene/boxes';
import { WORLD } from '../scene/world';
import { roofsOf } from './weather';
import { snowPaintOf } from '../render/snowField';
import { AirField } from '../render/airField';

/** cells a metre — render/airField.ts AIR_RES and particles.wgsl AIR_CELLS_PER_M say the same (airsim-check compares) */
export const AIR_CELLS = 5;
/** local sources a frame — render/airField.ts AIR_SRC_MAX */
export const AIR_SOURCES = 16;
export const AIR_SIM = {
  on: false,
  ground: 0.55,      // the storm's vector at the ground, as a share (wind_field.wgsl's height profile at y = 0)
  minTop: 0.5,       // m over the floor a box must top to stand in the wind …
  maxFoot: 0.45,     // … and m it must reach down to (a lintel, a canopy, a wall light: air passes under)
  roofShare: 0,      // share of the ambient forced under a roof (0: indoors the air moves only as it is driven in)
  glassOpen: 0.5,    // a pane more than this much out lets the air through
  leafStep: 0.04,    // rad: a leaf must have swung this far to be drawn again
  ventOut: 0.5,      // of a ceiling diffuser's speed where its jet meets the floor: how fast the air spreads out across the floor
  gustK: 0.7,        // × a door's / pane's / wall vent's own speed, as driven air at the ground
  rate: 5,           // 1/s: how hard a source pulls the air at its centre
  sigmaMin: 0.35, sigmaMax: 2.5,   // m: a source's footprint
  puffRate: 14,      // 1/s: … and a puff (airPuff: a blast's shove) pulls harder — it is over in a third of a second
  settle: 6,         // s the field goes on being stepped after the last source has stopped (it must come to rest; after that nothing is encoded: still air costs nothing)
};
export interface AirSimStats { active: boolean; why: string; w: number; h: number; solid: number; roofed: number; open: number; leaves: number; rebuilt: number; restamped: number; sources: number; wind: [number, number]; speed: number; calm: number }

interface AirHandle { setCells(mask: Uint8Array, rect?: readonly [number, number, number, number]): void; setSources?(recs: Float32Array, n: number): void; reset(): void; readonly w: number; readonly h: number }
const CAND = 8;   // floats a candidate source: distance from the view, x, z, vx, vz, sigma, out, rate
interface AirState { w: number; h: number; base: Uint8Array; mask: Uint8Array; roof: Uint8Array; key: number; leafKey: number; sent: boolean; lastT: number; quiet: number; fresh: boolean; want: boolean; src: Float32Array; cand: Float32Array; stats: AirSimStats;
  /** short radial shoves filed by the game (airPuff below: a blast) — each a source of its own until its time is up */
  puffs: { x: number; z: number; out: number; sigma: number; rate: number; t: number; secs: number }[] }
const states = new SideMap<Game, AirState>('airSim.states');
const blankStats = (w: number, h: number, why: string): AirSimStats => ({ active: false, why, w, h, solid: 0, roofed: 0, open: 0, leaves: 0, rebuilt: 0, restamped: 0, sources: 0, wind: [0, 0], speed: 0, calm: 0 });
function stateOf(g: Game): AirState {
  let s = states.get(g);
  if (!s) {
    const w = Math.round((WORLD.max[0] - WORLD.min[0]) * AIR_CELLS), h = Math.round((WORLD.max[2] - WORLD.min[2]) * AIR_CELLS);
    s = { w, h, base: new Uint8Array(w * h), mask: new Uint8Array(w * h), roof: new Uint8Array(w * h), key: NaN, leafKey: NaN, sent: false, lastT: -1, quiet: 1e9, fresh: true, want: false, src: new Float32Array(AIR_SOURCES * 8), cand: new Float32Array(32 * CAND),
      stats: blankStats(w, h, 'not run'), puffs: [] };
    states.set(g, s);
  }
  return s;
}
let offStats: AirSimStats | null = null;
/** what the game last handed the field. (With the switch down nothing is kept for a game: every one is told the same "switched off".) */
export function airSimStats(g: Game): AirSimStats { return states.get(g)?.stats ?? (AIR_SIM.on ? stateOf(g).stats : (offStats ??= blankStats(0, 0, 'switched off'))); }
/** the map as last drawn (row-major, j * w + i; 255 = solid, else the ambient's share × 254) — the checks' and the debugger's view of it */
export function airMask(g: Game): { mask: Uint8Array; w: number; h: number } { const s = stateOf(g); if (redraw(g, s)) s.sent = false; return { mask: s.mask, w: s.w, h: s.h }; }
/** is there a field on this page for anything to ride: the switch up, the engine holding one, and its setting (`airSim`) not turned off — the three things
 *  without which the field is not stepped, and a reader must fall back on the wind as a formula rather than ride air that stands still */
export function airLive(g: Game): boolean { const E = g.engine as unknown as { air?: unknown; settings?: { airSim?: boolean } }; return AIR_SIM.on && !!E.air && E.settings?.airSim !== false; }
/** a READER asks for the air this frame (once a frame, every frame it reads the field): the frame after, the map is drawn and the field stepped */
export function airWant(g: Game): void { if (AIR_SIM.on) stateOf(g).want = true; }
/** A PUFF: the air at (x, z) is driven OUTWARD for `secs` — `out` m/s at one `sigma` from its middle, running down to nothing over that time (a blast's shove:
 *  snowBlast.ts). A local source like a vent's, among the sixteen nearest the view; what it does to the field after that is the solver's — a ring that spreads,
 *  meets walls, rolls up. Picture only, as the field is. With the switch down nothing is kept. */
export function airPuff(g: Game, x: number, z: number, out: number, sigma: number, secs: number, rate = AIR_SIM.puffRate): void {
  if (!AIR_SIM.on || !(out > 0) || !(secs > 0)) return;
  const P = stateOf(g).puffs; if (P.length >= AIR_SOURCES) P.shift();
  P.push({ x, z, out, sigma, rate, t: 0, secs });
}
/** the puffs still blowing (a check's view) */
export function airPuffs(g: Game): number { return states.get(g)?.puffs.length ?? 0; }

const HIDDEN = BoxFlag.NoPrimary | BoxFlag.NoShadow;
/** does this static box stand in the wind at the ground */
function stands(g: Game, b: Box, bi: number): boolean {
  if (b.rot || (b.flags & BoxFlag.Dynamic) !== 0 || (b.flags & HIDDEN) === HIDDEN || (b.flags & BoxFlag.NoShadow) !== 0) return false;   // (tilted props, proxies, what a blast took, decals and glow cards)
  const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1];   // (m over y = 0: the floor every level is built on)
  if (!(y1 >= AIR_SIM.minTop) || !(y0 <= AIR_SIM.maxFoot)) return false;
  if ((b.flags & BoxFlag.Glass) !== 0) { const G = (g as unknown as { glassBreak?: { openFraction(bi: number): number } }).glassBreak; return !(G && G.openFraction(bi) > AIR_SIM.glassOpen); }
  return snowPaintOf(b) === null;   // (placed snow is ground the wind runs over, however high the bank)
}
/** draw one box's footprint solid into `m`. A box thinner than a cell is padded to one — a hair over half a cell either side of its middle, so one lying exactly on a
 *  cell edge takes both neighbours rather than, by rounding, neither (a wall must not leak); a yawed one to a line whose cells share edges. */
function stamp(m: Uint8Array, w: number, h: number, cx: number, cz: number, hx: number, hz: number, yaw: number): void {
  const cell = 1 / AIR_CELLS, c = Math.cos(yaw), s = Math.sin(yaw); const square = Math.abs(c * s) < 0.02;
  const need = cell * (square ? 0.5 : 0.75) + 1e-4; const ex = Math.max(hx, need), ez = Math.max(hz, need);
  const rx = Math.abs(c) * ex + Math.abs(s) * ez, rz = Math.abs(s) * ex + Math.abs(c) * ez;
  const ox = WORLD.min[0], oz = WORLD.min[2];
  const i0 = Math.max(0, Math.floor((cx - rx - ox) * AIR_CELLS)), i1 = Math.min(w - 1, Math.floor((cx + rx - ox) * AIR_CELLS));
  const j0 = Math.max(0, Math.floor((cz - rz - oz) * AIR_CELLS)), j1 = Math.min(h - 1, Math.floor((cz + rz - oz) * AIR_CELLS));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = ox + (i + 0.5) * cell - cx, pz = oz + (j + 0.5) * cell - cz;
    const lx = c * px - s * pz, lz = s * px + c * pz;   // (a box's yaw turns +x toward −z: boxes.ts)
    if (Math.abs(lx) <= ex && Math.abs(lz) <= ez) m[j * w + i] = 255;
  }
}
function redraw(g: Game, st: AirState): boolean {
  const boxes = g.col.boxes, K = AIR_SIM; const G = (g as unknown as { glassBreak?: { openSig(): number } }).glassBreak;
  let key = boxes.length * 31 + (G ? G.openSig() : 0) | 0;
  const READ = BoxFlag.Dynamic | BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Glass;   // (the flags `stands` reads — a box that only changes its gloss or its glow redraws nothing)
  for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; key = (Math.imul(key, 33) + (b.flags & READ) + (b.rot ? 7919 : 0) + Math.round((b.c[0] + b.h[0] * 3 + b.c[2] * 7 + b.h[2] * 13 + b.c[1] * 17 + b.h[1] * 19 + b.yaw * 23) * 50)) | 0; }
  key = (key + Math.round((K.minTop * 7 + K.maxFoot * 13 + K.roofShare * 254 + K.glassOpen * 31) * 100)) | 0;
  let changed = false;
  if (key !== st.key) {
    st.key = key; st.leafKey = NaN; changed = true; st.stats.rebuilt++;
    const { w, h, base } = st; const roofs = roofsOf(boxes); const ox = WORLD.min[0], oz = WORLD.min[2], cell = 1 / AIR_CELLS;
    const under = Math.max(0, Math.min(254, Math.round(K.roofShare * 254)));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = ox + (i + 0.5) * cell, z = oz + (j + 0.5) * cell; let r = false;
      for (const R of roofs) if (x > R[0] && z > R[1] && x < R[2] && z < R[3]) { r = true; break; }
      base[j * w + i] = r ? under : 254; st.roof[j * w + i] = r ? 1 : 0;
    }
    for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (stands(g, b, i)) stamp(base, w, h, b.c[0], b.c[2], b.h[0], b.h[2], b.yaw); }
  }
  const doors = g.doors?.list ?? []; let lk = doors.length;
  for (const d of doors) lk = (Math.imul(lk, 33) + Math.round(d.angle / K.leafStep) + ((d as unknown as { off?: boolean }).off ? 977 : 0)) | 0;
  if (lk !== st.leafKey) {
    st.leafKey = lk; changed = true; st.stats.restamped++;
    st.mask.set(st.base); let leaves = 0;
    for (const d of doors) {
      const b = d.box; if ((d as unknown as { off?: boolean }).off || b.rot || !(b.c[1] + b.h[1] >= K.minTop)) continue;   // (a leaf off its hinges lies on the floor: the doorway is open)
      stamp(st.mask, st.w, st.h, b.c[0], b.c[2], b.h[0], b.h[2], b.yaw); leaves++;
    }
    let solid = 0, roofed = 0; for (let i = 0; i < st.mask.length; i++) { if (st.mask[i] === 255) solid++; else if (st.roof[i]) roofed++; }   // (roofed = air under a roof; open = air under the sky)
    st.stats.leaves = leaves; st.stats.solid = solid; st.stats.roofed = roofed; st.stats.open = st.mask.length - solid - roofed;
  }
  return changed;
}

/** wind.ts's live sources as the field's local ones (≤ AIR_SOURCES records of 8: x, z, vx, vz, sigma, out, rate, 0), nearest the view first; returns how many */
function sources(g: Game, st: AirState, ambient: [number, number]): number {
  const K = AIR_SIM, out = st.src; ambient[0] = 0; ambient[1] = 0;
  const act = g.wind?.active ?? []; const E = g.engine as unknown as { viewFocus?: readonly number[] }; const fx = E.viewFocus?.[0] ?? (WORLD.min[0] + WORLD.max[0]) / 2, fz = E.viewFocus?.[2] ?? (WORLD.min[2] + WORLD.max[2]) / 2;
  let cand = st.cand, m = 0;
  const push = (d: number, x: number, z: number, vx: number, vz: number, sg: number, o: number, rate = K.rate) => {
    if ((m + 1) * CAND > cand.length) { const big = new Float32Array(cand.length * 2); big.set(cand); cand = st.cand = big; }
    const k = m++ * CAND; cand[k] = d; cand[k + 1] = x; cand[k + 2] = z; cand[k + 3] = vx; cand[k + 4] = vz; cand[k + 5] = sg; cand[k + 6] = o; cand[k + 7] = rate;
  };
  for (const s of act) {
    if (!(s.speed > 0)) continue;
    if (s.kind === 'storm') { ambient[0] += s.dir[0] * s.speed * K.ground; ambient[1] += s.dir[2] * s.speed * K.ground; continue; }
    const floorY = s.floorY !== undefined && s.floorY > -100 ? s.floorY : 0, up = s.pos[1] - floorY;
    if (s.dir[1] < -0.5) {   // a ceiling diffuser: where its axis meets the floor, the air spreads out
      const t = up / -s.dir[1]; if (!(t < s.dMax)) continue;
      const x = s.pos[0] + s.dir[0] * t, z = s.pos[2] + s.dir[2] * t, q = t / Math.max(s.reach, 1e-3), sp = s.speed / (1 + q * q);
      const sg = Math.max(K.sigmaMin, Math.min(K.sigmaMax, s.r0 + t * s.tanSpread));
      push(Math.hypot(x - fx, z - fz), x, z, s.dir[0] * sp * K.gustK, s.dir[2] * sp * K.gustK, sg, sp * K.ventOut);
    } else {                 // a gust through a door or a pane, a wall vent: driven air along its heading, less the higher over the ground it blows
      const hl = Math.hypot(s.dir[0], s.dir[2]); if (hl < 0.2) continue;
      const sg = Math.max(K.sigmaMin, Math.min(K.sigmaMax, s.r0 + 0.35 * s.reach * s.tanSpread)), k = K.gustK * Math.max(0.2, Math.min(1, 1 - (up - 1.5) / 1.5));
      const x = s.pos[0] + s.dir[0] / hl * sg, z = s.pos[2] + s.dir[2] / hl * sg;
      push(Math.hypot(x - fx, z - fz), x, z, s.dir[0] * s.speed * k, s.dir[2] * s.speed * k, sg, 0);
    }
  }
  for (const p of st.puffs) { const k = 1 - p.t / p.secs; if (k > 0) push(Math.hypot(p.x - fx, p.z - fz), p.x, p.z, 0, 0, Math.max(K.sigmaMin, Math.min(K.sigmaMax, p.sigma)), p.out * k, p.rate); }
  const n = Math.min(m, AIR_SOURCES);
  for (let i = 0; i < n; i++) {
    let best = i;   // (more than the field takes: the nearest the view, picked one at a time — a level has a few dozen at most)
    if (m > AIR_SOURCES) { for (let j = i + 1; j < m; j++) if (cand[j * CAND] < cand[best * CAND]) best = j; if (best !== i) for (let q = 0; q < CAND; q++) { const t = cand[i * CAND + q]; cand[i * CAND + q] = cand[best * CAND + q]; cand[best * CAND + q] = t; } }
    const k = i * CAND, o = i * 8; out[o] = cand[k + 1]; out[o + 1] = cand[k + 2]; out[o + 2] = cand[k + 3]; out[o + 3] = cand[k + 4]; out[o + 4] = cand[k + 5]; out[o + 5] = cand[k + 6]; out[o + 6] = cand[k + 7]; out[o + 7] = 0;
  }
  return n;
}

/** the page's engine gets its field (game.ts, beside the particle system: a real device only — the harness's stand-in has no `setParticles` and gets none).
 *  With the switch down at boot none is built: `?air=0` is the build as it was. A device that cannot build it (the constructor throws, or the device reports
 *  a validation or memory error from inside it, which arrives a moment later) leaves the engine without one — and every reader back on the wind as a formula. */
export function attachAir(g: Game): void {
  const E = g.engine as unknown as { setParticles?: unknown; device?: GPUDevice; air?: unknown };
  if (!AIR_SIM.on || !E.setParticles || !E.device || E.air) return;
  const dev = E.device; const scoped = typeof dev.pushErrorScope === 'function' && typeof dev.popErrorScope === 'function';
  try {
    if (scoped) { dev.pushErrorScope('validation'); dev.pushErrorScope('out-of-memory'); }
    const field = new AirField(dev, WORLD.max[0] - WORLD.min[0], WORLD.max[2] - WORLD.min[2]); E.air = field;
    if (scoped) {
      const drop = (err: GPUError | null) => { if (err && E.air === field) { E.air = null; console.warn('air field: not built on this device', err.message); } };
      Promise.resolve(dev.popErrorScope()).then(drop, () => {}); Promise.resolve(dev.popErrorScope()).then(drop, () => {});
    }
  } catch (err) { if (scoped) { try { void dev.popErrorScope(); void dev.popErrorScope(); } catch { /* the scopes went with the throw */ } } console.warn('air field: not built on this device', err); }
}

/** once a frame, after wind.update: this frame's wind, and — while a reader asks for the air (airWant) — the map (when it has changed) and the sources, handed
 *  to the engine's field. With the switch down, or on a page with no field (the harness; `?air=0`; the setting off), nothing is drawn and nothing is sent. */
export function updateAirSim(g: Game, dt: number): void {
  const E = g.engine as unknown as { air?: AirHandle | null; airWind?: [number, number]; airOn?: boolean };
  const air = E.air ?? null;
  if (!airLive(g) || !air) {
    const st = states.get(g);
    if (st) { const S = st.stats; S.active = false; S.why = !AIR_SIM.on ? 'switched off' : !air ? 'this page has no air field' : 'the wind sim is off in the settings'; S.sources = 0; S.wind[0] = S.wind[1] = 0; S.speed = 0; S.calm = 0; st.sent = false; st.want = false; st.fresh = true; }
    if (st) st.puffs.length = 0;
    if (E.airWind) { E.airWind[0] = 0; E.airWind[1] = 0; } if ('airOn' in E) E.airOn = false; return;
  }
  const st = stateOf(g), S = st.stats;
  if (air.w !== st.w || air.h !== st.h) { S.active = false; S.why = `the field is ${air.w} × ${air.h} cells, the map ${st.w} × ${st.h}`; E.airOn = false; return; }
  if (st.fresh || g.time < st.lastT) { air.reset(); st.fresh = false; st.sent = false; st.quiet = 1e9; st.puffs.length = 0; }   // (a new game on this engine, or a restart: still air, and the map as the level stands again)
  st.lastT = g.time;
  const wanted = st.want; st.want = false;
  const n = sources(g, st, S.wind);
  if (st.puffs.length) { for (const p of st.puffs) p.t += Math.max(0, dt); st.puffs = st.puffs.filter(p => p.t < p.secs); }   // (this frame's share is in the sources above: a puff filed since the last frame blows from its first one)
  // the ambient before its gusting: what a reader calls "the wind's own speed" (the grains' pick-up threshold)
  let calm = 0; for (const s of g.wind?.active ?? []) if (s.kind === 'storm' && s.speed > 0) calm = Math.max(calm, s.speed / Math.max((s as { gust?: number }).gust ?? 1, 0.2) * AIR_SIM.ground);   // (the sources BLOWING this frame: with the wind's master at 0 the storm's record keeps its last speed, and is not among them)
  S.calm = calm; S.sources = n; S.speed = Math.hypot(S.wind[0], S.wind[1]);
  st.quiet = S.speed > 0 || n > 0 ? 0 : st.quiet + Math.max(0, dt);
  if (!wanted) { E.airOn = false; S.active = false; S.why = 'nothing is reading it: not stepped'; return; }
  if (redraw(g, st) || !st.sent) { air.setCells(st.mask); st.sent = true; }
  air.setSources?.(st.src, n);
  if (E.airWind) { E.airWind[0] = S.wind[0]; E.airWind[1] = S.wind[1]; }
  E.airOn = st.quiet < AIR_SIM.settle; S.active = E.airOn; S.why = st.quiet === 0 ? 'blowing' : E.airOn ? 'coming to rest' : 'still air: not stepped';
}

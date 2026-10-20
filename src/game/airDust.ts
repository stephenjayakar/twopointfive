// THE WEATHER'S DUST IN THE ROOMS — where a picked weather's dust / fog stands under the level's roofs, and how it gets there.
//
// Out of doors the air carries the weather's whole density. Under a roof it carried a fixed share of it (the preset's `leak`), the same in the cupboard at the
// back as on the threshold of an open door — so the picture had a line at every wall. Here the share is a FIELD over the plan (scene/airGrid.ts: one number a
// half-metre cell, 1 = the open air's density): the open air is held at 1, a room's air is carried toward its neighbours' through every OPENING between two cells
// (a doorway with its leaf swung clear, a window without its glass, a hole blown in a wall) and settles back toward the leak wherever nothing feeds it:
//
//     ds∕dt = D · Σ open neighbours (s_n − s) ∕ h²  −  k · (s − leak)                    D = AIRDUST.diffuse, k = AIRDUST.settle
//
// A shut room stays at the leak EXACTLY (no neighbour differs, nothing to settle). Open its door and the dust comes in over a few seconds, thick on the
// threshold and thinning over √(D∕k) ≈ 3.5 m; shut it and the room clears again over 1∕k ≈ 8 s. Blow the wall out and it comes in across the whole breach.
//
// ONE FIELD, two readers: the picture (BoxWorld.setAirGrid → common.wgsl wxIndoor → the volumetric pass's march and the lamps' haze) and the men's eyes
// (weather.ts airTrans: the fog's optical depth along a sight line × the mean share along it). The second is a rule of the game, so it sits behind a switch of
// this module — AIRDUST.on: ON in the page (host/profile.ts pageSwitches; ?flatfog = off, with the picture's flat veil), held OFF on the frozen QA stand
// (host/standup.ts; TPS_AIRDUST=1), carried by a recording (knobs.ts). Off = airTrans as it was, and the grid holds the leak under every roof.
//
// WHAT AN OPENING IS. Between two neighbouring cells the way is open when a straight line between their centres is clear of every SOLID static — walls, intact
// glass, tall furniture — at ankle, chest or head-of-door height, asked both ways (StaticCollision.solidBlocked with the leaves taken out: a cell whose centre is
// inside a wall is shut off on every side) — and no door LEAF stands across it (the leaves' own rectangles on the plan, re-read whenever one has moved).
// The statics' half is asked of every edge once, when the field is seeded; after that only the SHUT edges are asked again, a few each step, the whole list
// every AIRDUST.recheckSecs — which is how a wall that breaks or a pane that falls out is noticed, without this file knowing who breaks walls.
// KNOWN: an opening is whole 0.5 m edges, so a 0.9 m doorway lets in one cell's width or two by where it sits on the lattice (no part-open edge).
//
// DETERMINISM. No dice, no clock but the game's dt: fixed steps of AIRDUST.step off an accumulator. A checkpoint carries the field, the statics' half of the
// openings, the re-check's cursor and the accumulator (snapshot / restore below); the leaves' half is re-read from the doors as the file put them back.
// restartEncounter → resetLevelState seeds it afresh (reset()).
import type { Game } from './game';
import type { Vec3 } from '../math/vec';
import type { Box } from '../scene/boxes';
import { WORLD } from '../scene/world';
import { AIR_CELL, AIR_W, AIR_H, AIR_ROWS } from '../scene/airGrid';

export const AIRDUST = {
  /** the men's eyes read the field (and the dust moves through openings). The module's own default is the frozen stand's; the page raises it (host/profile.ts) */
  on: false,
  /** how fast the dust spreads through open air indoors (m²/s) */
  diffuse: 1.5,
  /** how fast a room's air settles back to the weather's leak (1/s) */
  settle: 0.12,
  /** the fixed step (s): D · step ∕ h² must stay under ¼ (0.2 at these numbers) */
  step: 1 / 30,
  /** every shut edge is asked again within this long (s) */
  recheckSecs: 3,
};

/** the heights a way between two cells is asked at (m): under a sill, a man's chest, over the furniture but under a door's head */
const PROBE_Y = [1.6, 0.4, 2.05];
const N = AIR_W * AIR_H;
/** a share this close to the leak IS the leak (the tail of a settling room: no denormals, and a checkpoint lists only the cells that differ) */
const SNAP = 1e-6;
/** the renderer's copy is sent again once the cells have moved this far (summed over the steps since it last was): the picture never stands further than this from the men's eyes */
const SEND = 2e-4;

export interface AirDustSnap { acc: number; cur: number; /** [cell, share, cell, share …] for the roofed cells off the leak */ s: number[]; /** the statics' half of the openings, a bit an edge of `edges`, as hex */ stat: string }

export class AirDust {
  /** the field: the share of the open air's density at each cell (scene/airGrid.ts order). The sim's own numbers (doubles); `gpu` is the copy the renderer takes */
  readonly s = new Float64Array(N).fill(1);
  /** the men's eyes read the field this run (AIRDUST.on, a weather with fog in) */
  get live(): boolean { this.ensure(); return this.on; }
  private on = false; private dirty = true; private drift = 0;
  private indoor = new Uint8Array(N);
  private cells = new Int32Array(0);          // the roofed cells
  private edges = new Int32Array(0);          // the edges with a roofed cell at either end: id = cell × 2 + dir (0: to +x, 1: to +z)
  private stat = new Uint8Array(N * 2);       // by edge id: 1 = no static stands across it
  private leaf = new Uint8Array(N * 2);       // by edge id: how many leaves stand across it
  private next = new Float64Array(N);
  private gpu = new Float32Array(AIR_ROWS * 4);
  private leak = 1; private acc = 0; private cur = 0; private leafSig = NaN; private seeded = false;
  private pa: Vec3 = [0, 0, 0]; private pb: Vec3 = [0, 0, 0];
  stats = { steps: 0, probes: 0, sends: 0, roofed: 0, edges: 0, open: 0 };

  constructor(private g: Game) { this.ensure(); }

  /** the share at a spot of the plan (the cell it stands in; off the grid = the open air) */
  shareAt(x: number, z: number): number {
    if (this.dirty) this.ensure();
    const ix = Math.floor((x - WORLD.min[0]) / AIR_CELL), iz = Math.floor((z - WORLD.min[2]) / AIR_CELL);
    return ix < 0 || iz < 0 || ix >= AIR_W || iz >= AIR_H ? 1 : this.s[ix + iz * AIR_W];
  }

  /** the roofs or the weather changed (weather.ts setKind), or the level was put back as authored (game.ts resetLevelState): the field from nothing — every roofed
   *  cell at the leak, every opening asked, then (the switch on) run on until it stands still: the level opens with the dust already in its open doorways. LAZY: the
   *  call only marks the field stale, the first reader builds it (a checkpoint's load asks three times — the level put back, the weather set, the file's slice — and pays once) */
  reseed() { this.dirty = true; }
  private ensure() { if (this.dirty) { this.dirty = false; this.build(); } }
  private build() {
    const g = this.g, W = g.weather, f = W?.fog ?? null, has = !!W?.kind && !!f;
    this.on = has && AIRDUST.on; this.acc = 0; this.drift = 0; this.cur = 0; this.leafSig = NaN; this.leaf.fill(0); this.stat.fill(0);
    if (!has) { if (this.seeded) { this.seeded = false; this.s.fill(1); this.indoor.fill(0); this.cells = new Int32Array(0); this.edges = new Int32Array(0); } return; }
    this.seeded = true; this.leak = f!.leak;
    const cells: number[] = [], edges: number[] = [];
    for (let iz = 0, i = 0; iz < AIR_H; iz++) for (let ix = 0; ix < AIR_W; ix++, i++) {
      const r = W!.underRoof(WORLD.min[0] + (ix + 0.5) * AIR_CELL, WORLD.min[2] + (iz + 0.5) * AIR_CELL);
      this.indoor[i] = r ? 1 : 0; this.s[i] = r ? this.leak : 1; if (r) cells.push(i);
    }
    for (let iz = 0, i = 0; iz < AIR_H; iz++) for (let ix = 0; ix < AIR_W; ix++, i++) {
      if (ix + 1 < AIR_W && (this.indoor[i] || this.indoor[i + 1])) edges.push(i * 2);
      if (iz + 1 < AIR_H && (this.indoor[i] || this.indoor[i + AIR_W])) edges.push(i * 2 + 1);
    }
    this.cells = Int32Array.from(cells); this.edges = Int32Array.from(edges);
    this.stats.roofed = cells.length; this.stats.edges = edges.length;
    if (this.on) {
      this.clearOfLeaves(() => { for (const e of this.edges) this.stat[e] = this.ask(e) ? 1 : 0; });
      this.leaves();
      for (let k = 0; k < 1500 && this.stepOnce(stepSecs()) > 1e-4; k++);
    }
    this.send();
  }
  /** the level as authored again (game.ts resetLevelState, after the doors and the walls are back) */
  reset() { this.reseed(); }

  /** once a frame, after the doors and whatever breaks have moved (game.ts) */
  update(dt: number) {
    this.ensure(); if (!this.on) return;
    const h = stepSecs(); this.acc += dt; let n = 0;
    while (this.acc >= h && n++ < 4) {
      this.acc -= h;
      this.recheck(h); this.leaves();
      this.drift += this.stepOnce(h);
    }
    if (this.acc > h) this.acc = h;   // (a long frame: the rest of it is dropped, not owed)
    if (this.drift > SEND) this.send();
  }

  // ---- the openings
  private clearOfLeaves(fn: () => void) { const col = this.g.col, dyn = col.dynamicBoxes; col.dynamicBoxes = []; try { fn(); } finally { col.dynamicBoxes = dyn; } }
  /** is the way along edge e clear of every static (call inside clearOfLeaves) */
  private ask(e: number): boolean {
    const i = e >> 1, j = e & 1 ? i + AIR_W : i + 1, col = this.g.col, a = this.pa, b = this.pb;
    a[0] = WORLD.min[0] + (i % AIR_W + 0.5) * AIR_CELL; a[2] = WORLD.min[2] + (((i / AIR_W) | 0) + 0.5) * AIR_CELL;
    b[0] = WORLD.min[0] + (j % AIR_W + 0.5) * AIR_CELL; b[2] = WORLD.min[2] + (((j / AIR_W) | 0) + 0.5) * AIR_CELL;
    for (const y of PROBE_Y) { a[1] = b[1] = y; this.stats.probes++; if (!col.solidBlocked(a, b) && !col.solidBlocked(b, a)) return true; }
    return false;
  }
  /** the shut edges asked again, a share of the list each step (a wall that broke, a pane that fell out) */
  private recheck(h: number) {
    const E = this.edges; if (!E.length) return;
    const per = Math.min(E.length, Math.max(1, Math.ceil(E.length * h / Math.max(0.25, +AIRDUST.recheckSecs || 0))));
    this.clearOfLeaves(() => { for (let k = 0; k < per; k++) { const e = E[this.cur]; this.cur = (this.cur + 1) % E.length; if (!this.stat[e] && this.ask(e)) this.stat[e] = 1; } });
  }
  /** which edges the door leaves stand across — re-read only when a leaf has moved since the last look */
  private leaves() {
    const dyn = this.g.col.dynamicBoxes as Box[]; let sig = dyn.length | 0;   // (a 32-bit hash of every leaf's pose to the millimetre / milliradian: any number of leaves)
    for (const b of dyn) { sig = Math.imul(sig ^ Math.round(b.c[0] * 1000), 16777619); sig = Math.imul(sig ^ Math.round(b.c[2] * 1000), 16777619); sig = Math.imul(sig ^ Math.round(b.yaw * 1000), 16777619); sig = Math.imul(sig ^ Math.round(b.c[1] * 1000) ^ (b.rot ? 0x5bd1e995 : 0), 16777619); }
    if (sig === this.leafSig) return;
    this.leafSig = sig; this.leaf.fill(0);
    const x0 = WORLD.min[0], z0 = WORLD.min[2];
    for (const b of dyn) {
      if (b.rot || b.c[1] - b.h[1] > 1.0 || b.c[1] + b.h[1] < 1.0) continue;   // (a leaf off its hinges lies where it fell: nothing to the air)
      const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), hx = b.h[0] + 0.02, hz = b.h[2] + 0.02, R = Math.hypot(b.h[0], b.h[2]) + AIR_CELL;
      const ix0 = Math.max(0, Math.floor((b.c[0] - R - x0) / AIR_CELL - 0.5)), ix1 = Math.min(AIR_W - 1, Math.ceil((b.c[0] + R - x0) / AIR_CELL - 0.5));
      const iz0 = Math.max(0, Math.floor((b.c[2] - R - z0) / AIR_CELL - 0.5)), iz1 = Math.min(AIR_H - 1, Math.ceil((b.c[2] + R - z0) / AIR_CELL - 0.5));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const px = x0 + (ix + 0.5) * AIR_CELL - b.c[0], pz = z0 + (iz + 0.5) * AIR_CELL - b.c[2];
        const lx = cs * px - sn * pz, lz = sn * px + cs * pz, i = ix + iz * AIR_W;
        // the edge to +x is the local segment (lx, lz) → (lx + cs·h, lz + sn·h); to +z: → (lx − sn·h, lz + cs·h)
        if (ix + 1 < AIR_W && crosses(lx, lz, cs * AIR_CELL, sn * AIR_CELL, hx, hz)) this.leaf[i * 2]++;
        if (iz + 1 < AIR_H && crosses(lx, lz, -sn * AIR_CELL, cs * AIR_CELL, hx, hz)) this.leaf[i * 2 + 1]++;
      }
    }
  }

  // ---- the field
  /** one step of the equation at the head of the file → the most any cell moved */
  private stepOnce(dt: number): number {
    const s = this.s, nx = this.next, C = this.cells, st = this.stat, lf = this.leaf, leak = this.leak;
    const k = Math.min(0.2, Math.max(0, +AIRDUST.diffuse || 0) * dt / (AIR_CELL * AIR_CELL)), r = Math.min(0.5, Math.max(0, +AIRDUST.settle || 0) * dt); let moved = 0, open = 0;   // (the explicit step stands under ¼ whatever the knobs say)
    for (let q = 0; q < C.length; q++) {
      const i = C[q], v = s[i], ix = i % AIR_W; let a = 0, e: number;
      if (ix > 0) { e = (i - 1) * 2; if (st[e] && !lf[e]) { a += s[i - 1] - v; open++; } }
      if (ix + 1 < AIR_W) { e = i * 2; if (st[e] && !lf[e]) { a += s[i + 1] - v; open++; } }
      if (i >= AIR_W) { e = (i - AIR_W) * 2 + 1; if (st[e] && !lf[e]) { a += s[i - AIR_W] - v; open++; } }
      if (i + AIR_W < N) { e = i * 2 + 1; if (st[e] && !lf[e]) { a += s[i + AIR_W] - v; open++; } }
      let w = v + k * a - r * (v - leak);
      if (Math.abs(w - leak) < SNAP) w = leak;
      const d = Math.abs(w - v); if (d > moved) moved = d;
      nx[i] = w;
    }
    for (let q = 0; q < C.length; q++) { const i = C[q]; s[i] = nx[i]; }
    this.stats.steps++; this.stats.open = open;
    return moved;
  }
  /** the field as it stands, written again (host/putback.ts: a save put back in memory took the field back, not the GPU's copy of it); no book of this module moves */
  resend() { if (!this.on) return; const s = this.s, o = this.gpu; for (let i = 0; i < N; i++) o[i] = s[i]; this.g.engine.world.setAirGrid(o); }
  private send() {
    const s = this.s, o = this.gpu; for (let i = 0; i < N; i++) o[i] = s[i];
    this.g.engine.world.setAirGrid(o); this.stats.sends++; this.drift = 0;
  }

  // ---- checkpoints (savestate.ts)
  snapshot(): AirDustSnap | null {
    if (!this.live) return null;
    const out: number[] = [], C = this.cells, E = this.edges;
    for (let q = 0; q < C.length; q++) { const i = C[q]; if (this.s[i] !== this.leak) out.push(i, this.s[i]); }
    let hex = ''; for (let k = 0; k < E.length; k += 4) { let nib = 0; for (let b = 0; b < 4 && k + b < E.length; b++) if (this.stat[E[k + b]]) nib |= 1 << b; hex += nib.toString(16); }
    return { acc: this.acc, cur: this.cur, s: out, stat: hex };
  }
  /** the file's field over the one just seeded (savestate.ts loadState: after the weather, the walls, the doors and the glass are the file's). A file without the
   *  slice, malformed, or of another plan: the seeded field stands. An opening is the file's only where the level as loaded still has it (a pane that was shot out
   *  is whole again after a load: its edge is shut, whatever the file says). */
  restore(sn: AirDustSnap | null | undefined) {
    this.dirty = true; this.ensure();
    if (!sn || !this.on) return;
    const E = this.edges; if (typeof sn.stat !== 'string' || sn.stat.length !== Math.ceil(E.length / 4) || !Array.isArray(sn.s)) return;
    for (let k = 0; k < E.length; k++) this.stat[E[k]] &= (parseInt(sn.stat[k >> 2], 16) >> (k & 3)) & 1;
    for (let q = 0; q < this.cells.length; q++) this.s[this.cells[q]] = this.leak;
    for (let k = 0; k + 1 < sn.s.length; k += 2) { const i = sn.s[k] | 0; if (i >= 0 && i < N && this.indoor[i]) this.s[i] = +sn.s[k + 1]; }
    this.acc = +sn.acc || 0; this.cur = E.length ? ((sn.cur | 0) % E.length + E.length) % E.length : 0;
    this.leafSig = NaN; this.leaves(); this.send();
  }

  summary(): string {
    this.ensure(); if (!this.seeded) return 'no weather in the air';
    let mx = 0, sum = 0; for (const i of this.cells) { sum += this.s[i]; if (this.s[i] > mx) mx = this.s[i]; }
    return `${this.on ? 'moving' : 'still (switch off)'} · ${this.cells.length} roofed cells · mean share ${(sum / Math.max(1, this.cells.length)).toFixed(3)} (leak ${this.leak.toFixed(3)}, max ${mx.toFixed(3)}) · ${this.stats.open} open ways`;
  }
}

/** does the plan segment from (x, z) along (dx, dz) — t in [0, 1], a leaf's own frame — enter the rectangle |x| ≤ hx, |z| ≤ hz */
function crosses(x: number, z: number, dx: number, dz: number, hx: number, hz: number): boolean {
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (Math.abs(x) > hx) return false; }
  else { let a = (-hx - x) / dx, b = (hx - x) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false; }
  if (Math.abs(dz) < 1e-9) { if (Math.abs(z) > hz) return false; }
  else { let a = (-hz - z) / dz, b = (hz - z) / dz; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false; }
  return true;
}

/** the fixed step in use: AIRDUST.step held to what the explicit scheme and a frame can take */
function stepSecs(): number { const h = +AIRDUST.step; return h >= 1 / 240 && h <= 0.1 ? h : 1 / 30; }

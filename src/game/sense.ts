// THE SENSES ON THE CPU (`SENSE.cpu`; DEFAULT OFF — the page's `?cpusense`, the harness's `TPS_CPUSENSE=1`): everything the simulation takes off the renderer
// (sensors.ts: the light meters, the smoke along a sight line) worked out by the game itself instead, in the step that asks, from nothing but the game's own state.
// WHY: a value off the GPU arrives a drawn frame or two after it was asked and is the renderer's — so a fight on the page is its seed, its inputs AND a stream of
// readbacks (the run tape keeps them: a re-run needs the file). With this on, a fight is its seed and its inputs and nothing else: a machine with no GPU plays the
// very same one, which is what a server that will not trust its clients has to do. Engine groundwork; nothing networked.
//
// What stands in:
//   light   — nothing is asked of the probe and no answer is served, so every meter falls to the estimate it already had for 'no answer yet' (guards.ts
//             lightEstimateAt: the direct light of every lamp with the walls between, the hour's sun and sky, a stroke of lightning) — what the harness has always
//             run on. Sam's own meter, which had no stand-in (headless it never moved), reads the same estimate at his chest and head (game.ts lightMeter).
//             NOT in the estimate: bounced light, and smoke's own shadow. A place lit only by bounce reads darker to the men than the picture shows it.
//   smoke   — `CpuSmoke` below: every emitter the game hands the solver also feeds a blob here (what was let out, spreading and thinning at the solver's own decay),
//             and a sight line's transmittance is the blobs' sum along it, answered in the step that asks. It is a MODEL of the solver's picture, not a copy: a
//             canister shuts a doorway and a room as the picture's does, the edges and the minute-old wisps will not match cell for cell.
//   the solver's CPU-side fact the game reads to decide how much MORE to emit (`budget`: its emitter list ages by the drawn frame) is answered from a count of
//             the game's own, aged by the step — the page at any frame rate and a machine with no solver at all let out the same puffs.
//   A solver the picture has turned off or frozen takes no emitter; the game's own smoke does not ask: with this on, the fight is the same whatever is drawn.
// One model for presentation and AI is what this trades against: OFF, the men see by the renderer's own values; ON, by the stand-ins above. Whether the page plays
// on them is the maintainer's call — the switch ships off, and tools/qa/sense-check.ts holds it either way.
// (src/game is one import cycle: nothing here is built from another game module's export as the file loads.)
import type { Vec3 } from '../math/vec';
import type { SmokeEmitter, SmokeSystemLike } from '../smoke/types';

export const SENSE = {
  /** the senses worked out by the game itself (see the head). Off = the renderer's values through Game.sensors, as ever. */
  cpu: false,
  smoke: {
    /** extinction per metre per unit of density (the renderer's: σt = 6/m per unit) */
    sigma: 6,
    /** what the smoke loses a second (the solver's densDecay) */
    decay: 0.14,
    /** how fast a blob widens: its width² grows by 2·spread·age (m²/s), up to `widest` metres */
    spread: 0.2, widest: 3.5,
    /** how far a blob's middle rises above where it was let out (m), and how fast (m/s) */
    rise: 1, riseRate: 0.3,
    /** an emitter that lets out less than this in its whole life (density × volume, unit·m³) is no blob: a muzzle's wisp, a spark's trail hide nobody */
    least: 0.05,
    /** a blob thinner than this (unit·m³) after its emitter has stopped is gone */
    gone: 0.02,
    /** the most blobs kept (the one with the least in it and still to come goes first) */
    cap: 48,
    /** the emitters a solver holds at once, and how many of those it keeps back from `budget` (smoke.ts MAX_EMITTERS, and its budget()'s reserve) */
    emitters: 64, reserve: 12,
  },
};

interface Blob { x: number; y0: number; z: number; r2: number; rate: number; ttl: number; age: number; mass: number; }
const PI15 = 5.568327996831708;   // π^1.5: a gaussian exp(−ρ²/r²) holds this much × r³

/** erf(x), Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7) — on the game's own exp, so the same bits wherever it runs */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1, a = x < 0 ? -x : x, t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}

/** THE SMOKE AS THE GAME KNOWS IT (see the head): plain numbers, stepped with the game, nothing of the renderer's */
export class CpuSmoke {
  blobs: Blob[] = [];
  /** the seconds each emitter handed over has left to run, small or not: what `budget` counts */
  lives: number[] = [];
  /** an emitter handed to the solver: what it will let out, as one blob where it stands (a tracked source is taken where it was born) */
  emit(e: SmokeEmitter): void {
    if (e.look) return;   // (a look-only source — a man's breath in the cold, snowBreath.ts: it hides nobody and is no emitter `budget` counts)
    const K = SENSE.smoke, r = Math.max(e.radius, 0.05), rate = e.density * PI15 * r * r * r;
    if (e.ttl > 0) { this.lives.push(e.ttl); if (this.lives.length > 2 * K.emitters) this.lives.shift(); }
    if (!(rate * e.ttl >= K.least)) return;
    if (this.blobs.length >= K.cap) {   // full: the one worth least goes — what it holds and what it has still to let out — and that may be the newcomer
      const worth = (b: Blob) => b.mass + b.rate * Math.max(0, b.ttl - b.age);
      let k = 0; for (let i = 1; i < this.blobs.length; i++) if (worth(this.blobs[i]) < worth(this.blobs[k])) k = i;
      if (worth(this.blobs[k]) >= rate * e.ttl) return;
      this.blobs.splice(k, 1);
    }
    this.blobs.push({ x: e.pos[0], y0: e.pos[1], z: e.pos[2], r2: r * r, rate, ttl: e.ttl, age: 0, mass: 0 });
  }
  /** how many more emitters there is room for, as the solver counts it (smoke.ts budget) — off the game's own count */
  budget(): number { const K = SENSE.smoke; return Math.max(0, K.emitters - K.reserve - this.lives.length); }
  step(dt: number): void {
    const K = SENSE.smoke, keep = Math.exp(-K.decay * dt);
    { const L = this.lives; let w = 0; for (let i = 0; i < L.length; i++) { const t = L[i] - dt; if (t > 0) L[w++] = t; } L.length = w; }
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.mass *= keep; if (b.age < b.ttl) b.mass += b.rate * Math.min(dt, b.ttl - b.age);
      b.age += dt;
      if (b.age >= b.ttl && b.mass < K.gone) this.blobs.splice(i, 1);
    }
  }
  clear(): void { this.blobs.length = 0; this.lives.length = 0; }
  /** how much of the light along a → b comes through (1 = clear air). `blocked(p, q)`: is there a wall between the two points (the smoke of the next room is not
   *  in this one's sight lines) */
  trans(a: Vec3, b: Vec3, blocked: (p: Vec3, q: Vec3) => boolean): number {
    if (!this.blobs.length) return 1;
    const K = SENSE.smoke, dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 1e-6) return 1;
    const ux = dx / L, uy = dy / L, uz = dz / L; let tau = 0;
    for (const bl of this.blobs) {
      if (bl.mass <= 0) continue;
      const s2 = Math.min(bl.r2 + 2 * K.spread * bl.age, K.widest * K.widest), s = Math.sqrt(s2), cy = bl.y0 + Math.min(K.rise, K.riseRate * bl.age);
      const px = bl.x - a[0], py = cy - a[1], pz = bl.z - a[2], t = px * ux + py * uy + pz * uz;   // the blob's middle, along the line
      const d2 = px * px + py * py + pz * pz - t * t;
      if (d2 > 9 * s2 || t < -3 * s || t > L + 3 * s) continue;
      const tc = t < 0 ? 0 : t > L ? L : t;
      if (blocked([bl.x, cy, bl.z], [a[0] + ux * tc, a[1] + uy * tc, a[2] + uz * tc])) continue;
      tau += K.sigma * bl.mass / (Math.PI * s2) * Math.exp(-Math.max(d2, 0) / s2) * 0.5 * (erf((L - t) / s) - erf(-t / s));
    }
    return tau <= 0 ? 1 : Math.exp(-tau);
  }
}

/** THE GAME'S OWN SMOKE PUT IN FRONT OF THE SOLVER under SENSE.cpu: every emitter the solver is handed — by the game or by anything else that holds it (a panel
 *  button, the page's warm-up) — also feeds `own`, a clear clears both, and what the game asks back to decide how much more to emit is `own`'s answer. Done on the
 *  solver object itself, so nobody is left holding an unwatched one; the solver's own working is called as it was. Returns the undo. */
export function ownSmoke(real: SmokeSystemLike, own: CpuSmoke): () => void {
  const R = real as unknown as Record<string, unknown>, had: [string, PropertyDescriptor | undefined][] = [];
  const emit = real.emit, clearAll = real.clearAll;
  const set = (k: string, f: unknown) => { had.push([k, Object.getOwnPropertyDescriptor(R, k)]); Object.defineProperty(R, k, { value: f, writable: true, configurable: true, enumerable: false }); };
  set('emit', (e: SmokeEmitter) => { own.emit(e); emit.call(real, e); });
  set('clearAll', () => { own.clear(); clearAll?.call(real); });
  set('budget', () => own.budget());
  return () => { for (const [k, d] of had) { if (d) Object.defineProperty(R, k, d); else delete R[k]; } };
}

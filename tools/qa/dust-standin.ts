// A CPU STAND-IN FOR DESTRUCTION'S DUST, for the headless harness only (the page never loads this). The harness has no smoke solver and its probe never answers, so
// every AI sight line reads 'no smoke' there — which makes the one thing the dust does to a fight (it is SMOKE: guards.ts / roomfight.ts gate and scale sight by the
// transmittance the probe's segment query returns) invisible to a seeded tally. This file gives the harness that answer from a MODEL instead of the GPU field:
//   - every dust puff destruction.ts emits (smoke.emit kind 'puff') becomes a Gaussian blob: thrown a little along its emit direction, spreading diffusively, fading;
//   - every transmittance SEGMENT the game asks of the probe (Sensors.askSegment → probe.querySegment: guard → Sam, AI ↔ AI in a room fight, a body, a camera, a
//     civilian) is answered a frame later with exp(−Σ optical depth of the blobs along it), a blob counting only if nothing solid stands between it and the line.
// It changes NO game rule: the game reads the answer through the same Sensors query, by the same thresholds, as it reads the real field's. Canister smoke, gun gas
// and the smoke's own obstacles / wind are NOT modelled (dropped as the null smoke drops them) — the stand-in exists to isolate the dust. With no puff alive it answers
// nothing at all (the key reads undefined, as on the bare harness), so a run that raises no dust is the bare harness's run.
// THE NUMBERS (DUST below) are fitted to the real solver measured on a software adapter — tools/qa/dust-fit.ts against the table in
// rebuild/destruction/chaos-calib/dust-transmittance.json; chaos.md says how close the fit is. A model, labelled as one wherever its tallies are quoted.
type Vec3 = [number, number, number];

export const DUST = {
  // FITTED (tools/qa/dust-fit.ts, 12000 trials, seed 1) to the real solver measured on the software adapter: four scenes, 792 (time, sight line) rows, rms error in T 0.079;
  // lines the solver blinds (T < 0.3): 118 measured, 110 by the model, 100 the same rows. One puff barely dims a line; a 16-puff burst blinds lines within ~1 m of the wall for ~8 s.
  kappa: 0.109,      // optical depth per unit of (emitter density × m² of Gaussian column): the one scale
  sigma0: 0.123,     // m: the blob's spread when the emitter stops (× the puff's own radius ÷ 0.2)
  spread: 0.0285,    // m²/s: diffusive growth, σ² = σ0² + 2·spread·age
  sigmaMax: 0.572,   // m: …up to this (a 64³ domain's plume does not fill the building)
  tau: 5.65,         // s: the density's fast e-folding (the thin puff mixing out) …
  tau2: 5.84,        // s: … and the slow one (the solver's dissipation + the outer-band fade) — the fit found one rate …
  slow: 0.674,       // … so this share means little
  throwM: 0.337,     // m: how far along its emit direction the blob's centre ends up (× the emitter's speed ÷ 0.55)
  throwSecs: 3.5,    // s: over this long
  rise: 0.0127,      // m/s: drift of the centre in y afterwards
  life: 45,          // s: a blob is dropped after this
  maxBlobs: 400,
};
export type DustParams = typeof DUST;

export interface Blob { p: Vec3; dir: Vec3; t0: number; dens: number; r: number; speed: number }
export interface DustStandin { blobs: Blob[]; stats: { puffs: number; asked: number; answered: number; minT: number; dimFrames: number }; tick(): void; transmittance(a: Vec3, b: Vec3): number; live(): number }

const erf = (x: number) => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
export const blobCentre = (b: Blob, age: number, P: DustParams = DUST): Vec3 => { const k = P.throwM * (b.speed / 0.55) * (1 - Math.exp(-3 * age / P.throwSecs)); const up = P.rise * age; return [b.p[0] + b.dir[0] * k, Math.max(0.1, b.p[1] + b.dir[1] * k + up), b.p[2] + b.dir[2] * k]; };
const sigmaOf = (b: Blob, age: number, P: DustParams) => Math.min(P.sigmaMax, Math.sqrt((P.sigma0 * b.r / 0.2) ** 2 + 2 * P.spread * age));
/** THE MODEL: the optical depth of the blobs along a → b at time `now` (`blocked(c, near)`: something solid stands between a blob's centre and the line — it is not in it) */
export function dustDepth(blobs: Blob[], a: Vec3, bq: Vec3, now: number, P: DustParams = DUST, blocked?: (c: Vec3, near: Vec3) => boolean): number {
  const dx = bq[0] - a[0], dy = bq[1] - a[1], dz = bq[2] - a[2]; const L = Math.hypot(dx, dy, dz); if (L < 1e-4) return 0;
  const ux = dx / L, uy = dy / L, uz = dz / L; let od = 0;
  for (const b of blobs) {
    const age = now - b.t0; if (age < 0) continue;
    const c = blobCentre(b, age, P), s = sigmaOf(b, age, P);
    const px = c[0] - a[0], py = c[1] - a[1], pz = c[2] - a[2]; const along = px * ux + py * uy + pz * uz;
    const qx = px - ux * along, qy = py - uy * along, qz = pz - uz * along; const d2 = qx * qx + qy * qy + qz * qz;
    if (d2 > 9 * s * s || along < -3 * s || along > L + 3 * s) continue;
    const frac = 0.5 * (erf((L - along) / (s * Math.SQRT2)) - erf(-along / (s * Math.SQRT2))); if (frac < 1e-3) continue;
    const fade = (1 - P.slow) * Math.exp(-age / P.tau) + P.slow * Math.exp(-age / P.tau2);
    const col = P.kappa * b.dens * fade * Math.exp(-d2 / (2 * s * s)) / (2 * Math.PI * s * s) * frac; if (col < 1e-4) continue;
    if (blocked && d2 > 0.01) { const tc = Math.max(0, Math.min(L, along)); if (blocked(c, [a[0] + ux * tc, a[1] + uy * tc, a[2] + uz * tc])) continue; }
    od += col;
  }
  return od;
}

/** Swap the harness game's null smoke and never-answering probe for the stand-in. Call once after standUp(); call `tick()` once a frame BEFORE game.update (the answers
 *  a frame's asks get are then read the frame after — the real readback's latency, give or take a frame). */
export function installDustStandin(W: { game: any }): DustStandin {
  const g = W.game; const blobs: Blob[] = []; const pending = new Map<string, [Vec3, Vec3]>();
  const stats = { puffs: 0, asked: 0, answered: 0, minT: 1, dimFrames: 0 };
  const centre = (b: Blob, age: number) => blobCentre(b, age);
  const transmittance = (a: Vec3, bq: Vec3) => Math.exp(-dustDepth(blobs, a, bq, g.time, DUST, (c, near) => g.col.solidBlocked(c, near)));
  // the smoke object: the null one's contract, plus the puffs kept
  const smoke = g.smoke; const emit0 = smoke.emit?.bind(smoke);
  smoke.emit = (e: any) => { emit0?.(e); if (e?.kind !== 'puff') return; stats.puffs++; blobs.push({ p: [e.pos[0], e.pos[1], e.pos[2]], dir: [e.dir[0], e.dir[1], e.dir[2]], t0: g.time, dens: e.density, r: e.radius, speed: e.speed }); if (blobs.length > DUST.maxBlobs) blobs.shift(); };
  smoke.inSmokeDomain = (p: Vec3) => { const now = g.time; for (const b of blobs) { const c = centre(b, now - b.t0); if (Math.abs(c[0] - p[0]) < 2 && Math.abs(c[2] - p[2]) < 2) return true; } return false; };
  /** how many places hold dust: the puffs' distinct 4 m squares (no rule of the game reads it since the box solver, and the dust gate that counted its domains, went) */
  const live = () => { const s = new Set<number>(); for (const b of blobs) s.add(Math.floor(b.p[0] / 4) * 64 + Math.floor(b.p[2] / 4)); return Math.min(8, s.size); };
  smoke.stats = { get live() { return live(); } };
  const clear0 = smoke.clearAll?.bind(smoke); smoke.clearAll = () => { clear0?.(); blobs.length = 0; };
  // the probe: segments answered from the model; everything else (the light meter's point queries) left never answering, as on the bare harness
  const P = g.probe;
  P.querySegment = (key: string, a: Vec3, b: Vec3) => { stats.asked++; pending.set(key, [[a[0], a[1], a[2]], [b[0], b[1], b[2]]]); };
  function tick() {
    const now = g.time; while (blobs.length && now - blobs[0].t0 > DUST.life) blobs.shift();
    let dim = false;
    for (const [key, [a, b]] of pending) {
      const T = blobs.length ? transmittance(a, b) : 1;
      if (T < 0.999) { P.results.set(key, [T, T, T]); stats.answered++; if (T < stats.minT) stats.minT = T; if (T < 0.8) dim = true; } else P.results.delete(key);
    }
    pending.clear(); if (dim) stats.dimFrames++;
  }
  return { blobs, stats, tick, transmittance, live };
}

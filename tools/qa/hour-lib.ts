// WHAT HOUR AND WEATHER DO TO A FIGHT — the shared half of the measuring tools (hour-measure.ts: the static tables of one map under one hour / weather;
// sight-watch.ts: the bystander on a scripted run, playthrough.ts PT_SIGHT=1; hour-tally.ts: the tables over many runs). Nothing here is game code and nothing
// here changes a rule: it reads the game's own tables and functions, and — one thing, opt-in — ANSWERS THE LIGHT METER where the harness has nobody to.
//
// THE METER STAND-IN (PT_METER=sky; hour-measure.ts prints both). The harness has no GPU, so the light meter of every AI man falls back to guards.ts
// lightEstimateAt — and that estimate SKIPS every directional light (kind 2: the moon, a sun, a stroke of lightning). The page's meter (render/shaders/probe.wgsl)
// does not: it sums every light, the directional ones through common.wgsl evalLight (colour × intensity × the receiving cosine, one shadow ray to the sky). So
// under an open sky the harness plays a darker floor than the page shows, at night already (the moon), and by day it would play the night. meterAt() is
// lightEstimateAt's own arithmetic with the directional lights put back the way the shader has them; installSkyMeter() hands it to the game through the hooks
// the game keeps for exactly this (Game.lightQuery / lightAt — the Sensors seam), so a run can be played AS THE PAGE'S METER WOULD LIGHT IT. What it still has
// not got, named: no bounce (the page adds the radiance cache's — a room lit only through its windows reads darker here than on the page), no bodies' shadows,
// no smoke or haze between a light and a man, no fixture flicker. Sam's own meter is never answered (the scripted commander is unseen by design).
// With `sky` off meterAt IS lightEstimateAt, and selfCheck() holds that to the last bit on a spread of points.
import { ROOT } from './headless.ts';
const GU: any = await import(`${ROOT}/src/game/guards.ts`);
const NV: any = await import(`${ROOT}/src/game/nvg.ts`);
const { lightFromDef }: any = await import(`${ROOT}/src/render/lights.ts`);

export type Vec3 = [number, number, number];
const DEG = Math.PI / 180;
const AXES: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function lightWindow(d: number, range: number): number { const x = d / range; const w = clamp(1 - x * x * x * x, 0, 1); return w * w; }
/** how far up the sky's way a directional light's shadow ray is walked (nvg.ts nvgPlaceLight walks the same 60 m) */
const SKY_M = 60;

export interface MeterOpts {
  /** count the directional lights (moon, sun, lightning) as the page's meter does. false = guards.ts lightEstimateAt exactly */
  sky: boolean;
  /** leave out every light somebody carries (owner ≠ 0): the PLACE's light — LIGHTS.litAt's and NVG.darkAt's question */
  placeOnly?: boolean;
  /** leave out flashes, tracers, beacons and lightning: the steady light of the place */
  steady?: boolean;
}
/** The light meter at world point P (W/m², the best of the six axis normals — probe.wgsl), direct light only. See the head. */
export function meterAt(g: any, P: Vec3, o: MeterOpts): number {
  const acc = [0, 0, 0, 0, 0, 0];
  const lights = g.engine.lights.lights;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    if (!l.enabled || l.intensity <= 0 || (o.placeOnly && l.owner)) continue;
    if (o.steady && (l.ttl >= 0 || l.transient || g.beacons.some((b: any) => b.light === l))) continue;
    if (l.kind === 2) {
      if (!o.sky) continue;
      const Lx = -l.dir[0], Ly = -l.dir[1], Lz = -l.dir[2];
      if (g.col.segmentBlocked(P, [P[0] + Lx * SKY_M, P[1] + Ly * SKY_M, P[2] + Lz * SKY_M])) continue;
      const E = lum(l.color) * l.intensity;
      for (let k = 0; k < 6; k++) { const N = AXES[k]; const cs = N[0] * Lx + N[1] * Ly + N[2] * Lz; if (cs > 0) acc[k] += E * cs; }
      continue;
    }
    const sp = o.steady ? l.steady : undefined, lp = sp ? sp.pos : l.pos, lr = sp ? sp.radius : l.radius;   // (a fixture somebody flickers, an open fire: its authored self to who asks for the steady light — guards.ts)
    const dx = lp[0] - P[0], dy = lp[1] - P[1], dz = lp[2] - P[2]; const dist2 = dx * dx + dy * dy + dz * dz; const dist = Math.sqrt(dist2);
    if (dist > l.range || dist < 1e-3) continue;
    const Lx = dx / dist, Ly = dy / dist, Lz = dz / dist;
    let att = lightWindow(dist, l.range) / Math.max(dist2, lr * lr);
    if (l.kind === 1) {
      const cd = -(Lx * l.dir[0] + Ly * l.dir[1] + Lz * l.dir[2]); const cosOuter = Math.cos(l.outerDeg * DEG), cosInner = Math.cos(Math.min(l.innerDeg, l.outerDeg - 0.5) * DEG);
      if (cd < cosOuter) continue;
      att *= smoothstep(cosOuter, cosInner, cd);
    } else if (l.kind === 3) {
      const ce = -(Lx * l.dir[0] + Ly * l.dir[1] + Lz * l.dir[2]);
      if (ce <= 0) continue;
      att *= ce;
    }
    if (att <= 0) continue;
    const c = l.color, I = sp ? sp.intensity : l.intensity;
    if (Math.max(c[0], c[1], c[2]) * I * att < 0.002) continue;
    const L = lum(c) * I * att;
    const tmax = dist - lr - 0.02;
    if (tmax > 0.05 && g.col.segmentBlocked(P, [P[0] + Lx * tmax, P[1] + Ly * tmax, P[2] + Lz * tmax])) continue;
    for (let k = 0; k < 6; k++) { const N = AXES[k]; const cs = N[0] * Lx + N[1] * Ly + N[2] * Lz; if (cs > 0) acc[k] += L * cs; }
  }
  return Math.max(acc[0], acc[1], acc[2], acc[3], acc[4], acc[5]);
}
/** meterAt with the sky off must be guards.ts lightEstimateAt, to the bit, in all three of its modes: [points checked, points that differ] */
export function selfCheck(g: any, pts: Vec3[]): [number, number] {
  let bad = 0;
  for (const p of pts) {
    if (meterAt(g, p, { sky: false }) !== GU.lightEstimateAt(g, p)) bad++;
    if (meterAt(g, p, { sky: false, placeOnly: true }) !== GU.lightEstimateAt(g, p, () => true)) bad++;
    if (meterAt(g, p, { sky: false, placeOnly: true, steady: true }) !== GU.lightEstimateAt(g, p, () => true, true)) bad++;
  }
  return [pts.length * 3, bad];
}
/** Answer the game's light meter as the page's would for direct light (see the head) — for exactly the keys the harness already has a reading for (a man's
 *  meter, a held man's, a civilian's, the light on a body: each falls back to guards.ts lightEstimateAt when the hook has no answer), so a run with it differs
 *  from a run without it by THE SKY ALONE. Left unanswered, as headless: Sam's own meter, and the searchers' spot readings (`srch:` — headless nobody answers
 *  them and every spot scores a flat half-dark; answering them would switch a second thing on). Returns how many readings it has given. */
export function installSkyMeter(g: any): { reads: number } {
  const at = new Map<string, Vec3>(), S = { reads: 0 };
  g.lightQuery = (key: string, pos: Vec3) => { if (!key.startsWith('player') && !key.startsWith('srch:')) at.set(key, [pos[0], pos[1], pos[2]]); };
  g.lightAt = (key: string) => { const p = at.get(key); if (!p) return undefined; S.reads++; return meterAt(g, p, { sky: true }); };
  g.lightForget = (key: string) => { at.delete(key); };
  return S;
}
/** is the sky open straight above this point (no static over a standing man's head): what the tables call OUTDOORS */
export function openSky(g: any, x: number, z: number): boolean { return !g.col.segmentBlocked([x, 1.9, z], [x, 40, z]); }

/** A WHAT-IF SUN, the tool's own and nobody's hour (PT_WHATIF=sun[:intensity[:elevDeg]]): the moon switched off and one directional light in its place — by
 *  default the office's own daylight sun (levels/office.json daylight.sun: intensity 8, colour 1 / 0.95 / 0.86) from the moon's bearing at 33° up — with the
 *  exposure the office's day uses. Nothing else of a day: every fixture stays as the level has it, no sky, no haze. It exists so the page can say what
 *  DAYLIGHT ON THE METER does to a fight before any hour is authored; an authored hour replaces it. Only means anything with the sky meter on. */
export function whatIfSun(g: any, spec: string): string {
  const [, iS, eS] = spec.split(':'); const I = iS ? Number(iS) : 8, elev = (eS ? Number(eS) : 33.5) * DEG;
  const L = g.engine.lights.lights; const moon = L.find((l: any) => l.kind === 2 && !l.transient && l.ttl < 0);
  const az = moon ? Math.atan2(moon.dir[0], moon.dir[2]) : 2.6; if (moon) moon.enabled = false;
  const dir: Vec3 = [Math.sin(az) * Math.cos(elev), -Math.sin(elev), Math.cos(az) * Math.cos(elev)];
  g.engine.lights.add(lightFromDef({ name: 'whatif_sun', kind: 'dir', pos: [0, 0, 0], dir, color: [1, 0.95, 0.86], intensity: I, range: 1e6, innerDeg: 0, outerDeg: 0, group: 'daylight', enabled: true, volumetric: 0, radius: 0.02, mains: false }));
  g.engine.settings.exposure = 2.4;
  return `what-if sun: intensity ${I}, ${(elev / DEG).toFixed(1)}° up${moon ? ', the moon off' : ''}, exposure 2.4`;
}

/** every nav cell a man can walk to from `from` (the grid's own flood: doorways are floor, leaves and locks are not in it), as cell centres */
export function reachable(g: any, from: number[]): { x: number; z: number }[] {
  const nav = g.col.nav, W = nav.W, H = nav.H, cs = nav.cell;
  let sx = Math.floor(from[0] / cs), sz = Math.floor(from[2] / cs);
  if (nav.blocked[sz * W + sx]) { const p = nav.nearestFreePoint?.(from) ?? from; sx = Math.floor(p[0] / cs); sz = Math.floor(p[2] / cs); }
  const seen = new Uint8Array(W * H), q = [sz * W + sx], out: { x: number; z: number }[] = []; seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % W, z = (c - x) / W; out.push({ x: (x + 0.5) * cs, z: (z + 0.5) * cs });
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, nz = z + az; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const n = nz * W + nx; if (seen[n] || nav.blocked[n]) continue; seen[n] = 1; q.push(n); }
  }
  return out;
}

/** THE GAME'S OWN SIGHT RATE for a target under light `vis` (the meter's 0‥1) at `dist`, walking across the eye's view at `speed` m/s (0 = standing still):
 *  guards.ts sightGainOn on two stand-in men — nothing of the formula is repeated here. `hot`: the room fight's ×2.2 for a roused eye (roomfight.ts rateOn) — the eye itself stays a 'patrol' eye, so a STANDING man is understated for a hunting
 *  defender (guards.ts motionCore gives an alert / searching eye a higher floor for a still target); the walking columns are exact. */
export function sightRate(g: any, vis: number, dist: number, speed: number, hot: boolean): number {
  const eye: any = { state: 'patrol', team: 'hostile', char: { pos: [0, 0, 0], id: -1, bones: {}, chestDir: [0, 0, 1], aimYaw: 0 } };
  const tgt: any = { state: 'patrol', team: 'operative', visibility: vis, irradiance: 0, flashlight: null, char: { pos: [0, 0, dist], vel: [speed, 0, 0], id: -2, bones: {}, anim: { crouch: 0 } } };
  const r = GU.sightGainOn(g, eye, tgt, dist);
  return hot ? r * 2.2 : r;
}
/** the farthest a man under light `vis` is a REAL SIGHTING (rate over 0.25: the licence to shoot) inside the eye's 16 m, to the half metre. Never under
 *  POINT_BLANK: inside 1.8 m the game's rate has a floor of 3.5 whatever the light (guards.ts sightGainOn) — a man in the pitch dark is still seen at arm's length. */
export const POINT_BLANK = 1.8;
export function sightReach(g: any, vis: number, speed: number, hot: boolean): number {
  for (let d = GU.GUARD_EYE.range - 0.25; d >= 2; d -= 0.5) if (sightRate(g, vis, d, speed, hot) > 0.25) return Math.round(d * 2) / 2;
  return POINT_BLANK;
}
/** what a goggled eye reads for a man standing under irradiance E: the better of the bare meter and the tube (guards.ts sightGainOn's max; nvg.ts tubeVis) */
export function tubeLight(g: any, E: number): number { return Math.max(g.visibilityOf(E), NV.tubeVis(g, E)); }

export const quant = (a: number[], q: number) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
export const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
/** mulberry32 */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the paired difference b − a over the same seeds with a bootstrap interval (2000 resamples of the seeds, 2.5 % and 97.5 %): [sum of differences, lo, hi] */
export function pairedBoot(a: number[], b: number[], seed = 12345): [number, number, number] {
  const n = Math.min(a.length, b.length), d = Array.from({ length: n }, (_, i) => b[i] - a[i]), tot = d.reduce((x, y) => x + y, 0), R = rng(seed), sums: number[] = [];
  for (let k = 0; k < 2000; k++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(R() * n)]; sums.push(s); }
  return [tot, quant(sums, 0.025), quant(sums, 0.975)];
}

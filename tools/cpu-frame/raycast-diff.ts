// raycast-diff.ts — the differential proof for BoxWorld.raycast's grid walk (docs/internal/cpu-frame.md): the harness's Game stood up and stepped (dynamics in the list, doors
// moving, a static hidden then restored, one Glass pane 'holed' through the glassOpen hook), then RAYS by the hundred thousand — random origins in and around the world, random
// directions, tmax from a hand's length to unbounded, every skipFlags / skipOwner shape the game uses, plus axis-aligned rays from integer coordinates along cell lines and
// exactly onto box faces — each answered by BoxWorld.raycast() AND by the pre-lane brute force (re-implemented here verbatim over rayBox); the hit index, t and normal must
// be IDENTICAL (===, so a NaN differs from a NaN only if one side has it). Exit 1 on the first difference, with the ray printed.
//   bun run tools/cpu-frame/raycast-diff.ts [--rays 100000] [--seed 1] [--quiet]
import { standUp, ROOT } from '../qa/headless.ts';
const { BoxFlag, MKEY, rayBox } = await import(`${ROOT}/src/scene/boxes.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const RAYS = Number(opt('rays', '100000')), SEED = Number(opt('seed', '1')), QUIET = args.includes('--quiet');
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
Math.random = mulberry32(SEED * 7919 + 13);
const W = await standUp();
const { game, engine, input, cam, canvas } = W; const world = engine.world;
const rng = mulberry32(SEED * 104729 + 7);
type V3 = [number, number, number];

/** the brute force exactly as boxes.ts had it before the grid (over world.all, rayBox with the running best, first index wins a tie, the glassOpen hook) — less the
 *  blown wall look's pieces (keyed MKEY.look), which raycast() passes whatever their flags say */
function brute(ro: V3, rd: V3, tmax: number, skipFlags: number, skipOwner: number): { t: number; index: number; n: V3 } | null {
  let best = tmax, bi = -1; let bn: V3 = [0, 1, 0]; const all = world.all;
  for (let i = 0; i < all.length; i++) {
    const b = all[i]; if (b.flags & skipFlags) continue; if (skipOwner && b.owner === skipOwner) continue; if (b.mkey !== undefined && b.mkey >>> 24 === MKEY.look >>> 24) continue;
    const r = rayBox(ro, rd, b, best);
    if (r && r.t < best) {
      if (world.glassOpen && (b.flags & BoxFlag.Glass) && i < world.statics.length && world.glassOpen(i, [ro[0] + rd[0] * r.t, ro[1] + rd[1] * r.t, ro[2] + rd[2] * r.t])) continue;
      best = r.t; bi = i; bn = r.n;
    }
  }
  return bi >= 0 ? { t: best, index: bi, n: bn } : null;
}
/** rayBox as boxes.ts had it before the lane scalarised it (the array form, verbatim) — the per-box reference for the new one: same t, same n, on every candidate of a sample of rays */
function rayBoxRef(ro: V3, rd: V3, b: any, tmax: number): { t: number; n: V3 } | null {
  if (b.rot) return rayBoxRotRef(ro, rd, b, tmax);
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const px = ro[0] - b.c[0], py = ro[1] - b.c[1], pz = ro[2] - b.c[2];
  const lx = cs * px - sn * pz, lz = sn * px + cs * pz, ly = py;
  const dx = cs * rd[0] - sn * rd[2], dz = sn * rd[0] + cs * rd[2], dy = rd[1];
  const inv = [1 / (dx || 1e-20), 1 / (dy || 1e-20), 1 / (dz || 1e-20)];
  const o = [lx, ly, lz]; let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  for (let a = 0; a < 3; a++) {
    let ta = (-b.h[a] - o[a]) * inv[a], tb = (b.h[a] - o[a]) * inv[a]; let s = -1;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
    if (ta > t0) { t0 = ta; axis = a; sgn = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (axis < 0) return null;
  const ln: V3 = [0, 0, 0]; ln[axis] = sgn;
  const n: V3 = [cs * ln[0] + sn * ln[2], ln[1], -sn * ln[0] + cs * ln[2]];
  return { t: t0, n };
}
const { quat, v3 } = await import(`${ROOT}/src/math/vec.ts`);
function rayBoxRotRef(ro: V3, rd: V3, b: any, tmax: number): { t: number; n: V3 } | null {
  const qi = quat.conj(b.rot!); const o = quat.rotate(qi, v3.sub(ro, b.c)); const d = quat.rotate(qi, rd);
  let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (d[a] || 1e-20);
    let ta = (-b.h[a] - o[a]) * inv, tb = (b.h[a] - o[a]) * inv; let s = -1;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
    if (ta > t0) { t0 = ta; axis = a; sgn = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (axis < 0) return null;
  const ln: V3 = [0, 0, 0]; ln[axis] = sgn;
  return { t: t0, n: quat.rotate(b.rot!, ln) };
}
let boxTests = 0;
function checkBoxes(ro: V3, rd: V3, tmax: number, tag: string) {   // every 8th ray: 40 candidates (the rotated ones every time — they are few) through both rayBox forms
  const all = world.all;
  for (let k = 0; k < 40; k++) {
    const b = k < 8 ? all[Math.floor(rng() * all.length)] : (rotBoxes.length ? rotBoxes[Math.floor(rng() * rotBoxes.length)] : all[Math.floor(rng() * all.length)]);
    const a = rayBox(ro, rd, b, tmax), r = rayBoxRef(ro, rd, b, tmax); boxTests++;
    const why = (!a && !r) ? null : (!a || !r) ? `hit ${!!a} vs ${!!r}` : a.t !== r.t ? `t ${a.t} vs ${r.t}` : (a.n[0] !== r.n[0] || a.n[1] !== r.n[1] || a.n[2] !== r.n[2]) ? `n ${a.n} vs ${r.n}` : null;
    if (why) { console.log(`rayBox DIFFERS from its array form (${tag}): ${why}\n  ro ${JSON.stringify(ro)} rd ${JSON.stringify(rd)} tmax ${tmax} box ${JSON.stringify({ c: b.c, h: b.h, yaw: b.yaw, rot: b.rot })}`); process.exit(1); }
  }
}
let rotBoxes: any[] = [];
const FLAG_SETS = [BoxFlag.NoShadow | BoxFlag.NoPrimary, BoxFlag.NoShadow, BoxFlag.NoShadow | BoxFlag.Glass, 0, BoxFlag.NoPrimary | BoxFlag.Glass];
const OWNERS = [0, PLAYER_ID, 2, 3];
const TMAX = [1e9, 200, 30, 8, 1.5, 0.3];
let compared = 0, hits = 0;
function same(a: any, b: any): string | null {
  if (!a && !b) return null; if (!a || !b) return `hit ${!!a} vs ${!!b}`;
  if (a.index !== b.index) return `index ${a.index} vs ${b.index}`;
  if (a.t !== b.t) return `t ${a.t} vs ${b.t}`;
  if (a.n[0] !== b.n[0] || a.n[1] !== b.n[1] || a.n[2] !== b.n[2]) return `n ${a.n} vs ${b.n}`;
  return null;
}
function check(ro: V3, rd: V3, tmax: number, sf: number, so: number, tag: string) {
  const a = world.raycast(ro, rd, tmax, sf, so), b = brute(ro, rd, tmax, sf, so); compared++; if (b) hits++;
  const why = same(a, b);
  if (why) { console.log(`DIFFERS (${tag}): ${why}\n  ro ${JSON.stringify(ro)} rd ${JSON.stringify(rd)} tmax ${tmax} skipFlags ${sf} skipOwner ${so}\n  grid ${JSON.stringify(a)}\n  brute ${JSON.stringify(b)}`); process.exit(1); }
}
const rnd = (a: number, b: number) => a + (b - a) * rng();
const unit = (): V3 => { const z = rnd(-1, 1), th = rnd(0, 2 * Math.PI), r = Math.sqrt(Math.max(0, 1 - z * z)); return [r * Math.cos(th), z, r * Math.sin(th)]; };
function batch(n: number, tag: string) {
  for (let k = 0; k < n; k++) {
    const kind = rng();
    let ro: V3, rd: V3;
    if (kind < 0.7) { ro = [rnd(-3, 43), rnd(-1, 9), rnd(-3, 31)]; rd = unit(); }                                   // anywhere in and about the world
    else if (kind < 0.85) { ro = [rnd(0, 40), rnd(0.2, 2.2), rnd(0, 28)]; rd = unit(); rd[1] *= 0.15; }                 // near-horizontal at body height (the lasers, the aim)
    else if (kind < 0.93) { ro = [Math.floor(rnd(0, 41)), rnd(0, 3), Math.floor(rnd(0, 29))]; const ax = Math.floor(rnd(0, 6)); rd = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][ax] as V3; }   // axis-aligned from integer coordinates: along cell lines, onto faces
    else if (kind < 0.97) { const b = world.all[Math.floor(rnd(0, world.all.length))]; ro = [b.c[0] + rnd(-3, 3), b.c[1] + rnd(-2, 2), b.c[2] + rnd(-3, 3)]; rd = unit(); }   // aimed about a box
    else { const b = world.all[Math.floor(rnd(0, world.all.length))]; const f: V3 = [b.c[0] + b.h[0], b.c[1], b.c[2]]; ro = [f[0] + 2, f[1], f[2]]; rd = [-1, 0, 0]; }   // exactly onto a +x face
    if (rng() < 0.3) { const l = Math.hypot(rd[0], rd[1], rd[2]) || 1; const s = rnd(0.5, 3) / l; rd = [rd[0] * s, rd[1] * s, rd[2] * s]; }   // (unnormalised directions too — t is in units of rd)
    const tm = TMAX[Math.floor(rng() * TMAX.length)];
    check(ro, rd, tm, FLAG_SETS[Math.floor(rng() * FLAG_SETS.length)], OWNERS[Math.floor(rng() * OWNERS.length)], tag);
    if ((k & 7) === 0) { if ((k & 63) === 0) rotBoxes = world.all.filter((b: any) => b.rot); checkBoxes(ro, rd, tm, tag); }
  }
}
const dt = 1 / 60; const step = () => { game.update(dt, input, cam, canvas); cam.update(dt, game.followPos(), game.aimPoint); engine.lights.update(dt, game.time); world.dynamics = game.dynBoxes; world.upload(); input.endFrame(); };
for (let f = 0; f < 30; f++) step();
if (!QUIET) console.log(`ray grid: ${JSON.stringify(world.rayGridStats)} · ${world.all.length} boxes (${world.statics.length} statics)`);
const per = Math.floor(RAYS / 5);
batch(per, 'calm');
// a door flung open, Sam walking: dynamics moving under the list
const door = game.doors.list[0]; if (door) door.vel = 4; input.keys.add('KeyW'); for (let f = 0; f < 20; f++) step();
batch(per, 'door-open');
// a static hidden the way destruction hides one (a query-time flag change under an unchanged grid) — and a pane holed through the hook
const st = world.statics as any[]; const hideIdx = st.findIndex((b: any) => !(b.flags & (BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass)) && b.h[1] < 0.05 && b.c[1] > 0.6 && b.c[1] < 1.2);
const paneIdx = st.findIndex((b: any) => b.flags & BoxFlag.Glass);
const wasFlags = hideIdx >= 0 ? st[hideIdx].flags : 0; if (hideIdx >= 0) st[hideIdx].flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow;
world.glassOpen = (i: number, p: V3) => i === paneIdx && p[1] > 1.0;   // the pane's upper half is gone
for (let f = 0; f < 5; f++) step();
batch(per, 'hidden+holed');
if (hideIdx >= 0) st[hideIdx].flags = wasFlags; world.glassOpen = null; if (door) door.vel = -4;
for (let f = 0; f < 40; f++) step();
batch(per, 'restored');
// the raycast BETWEEN uploads (as the game calls it: `all` a frame old, dynamics moved since) and after a frame with no upload at all
game.update(dt, input, cam, canvas); batch(Math.floor(per / 2), 'between-uploads');
world.dynamics = game.dynBoxes; batch(per - Math.floor(per / 2), 'stale-list');
console.log(`raycast-diff: ${compared} rays compared, ${hits} hits (${(100 * hits / compared).toFixed(1)} %) — grid ≡ brute force; ${boxTests} single-box tests — rayBox ≡ its array form`);

// WHERE A 'MOVE THERE' PUTS THE MEN, drawn — src/game/roomfit.ts's deal against the line abreast it replaces, on any level, with no frame stepped:
//   bun run tools/qa/roomfit-map.ts [--level levels/consulate.json] [--men 4] [--at x,z] [--from x,z] [--known] [--quiet]
// With no --at: every room of the level (cleared.ts's rooms, the point = the free cell nearest each room's middle; --from defaults to the player's start).
// Each point prints a plan of the floor round it (# wall or furniture · D a door's frame · g a leafless way's line · * the point · 1‥4 the fitted marks ·
// a‥d the line abreast's · arrows from nothing: the words under the plan say what each man watches) and one line of counts for each of the two deals; the
// last lines are the level's totals. --known: every room counts as stood in (nothing is uncleared). The same counts are the roomfit probes' verdicts
// (roomfit-probes.ts imports `measure`).
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { spawnUnit, doorCells } = await import(`${ROOT}/src/game/guards.ts`);
const { ROOMFIT, fitSpots } = await import(`${ROOT}/src/game/roomfit.ts`);
const { roomRead } = await import(`${ROOT}/src/game/roomread.ts`);
const { doorwayInWay } = await import(`${ROOT}/src/game/doorway.ts`);

type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const yawTo = (a: V, b: V) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const wrap = (x: number) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
const offLine = (p: V, a: V, b: V) => { const bx = b[0] - a[0], bz = b[2] - a[2], L2 = bx * bx + bz * bz; if (L2 < 1e-6) return Infinity; const k = ((p[0] - a[0]) * bx + (p[2] - a[2]) * bz) / L2; if (k < 0.08 || k > 1) return Infinity; return Math.hypot(a[0] + bx * k - p[0], a[2] + bz * k - p[2]); };

/** One deal's marks, as the counts want them: where, which way the gun points, what it is on (null: nothing named). */
export interface Mark { pos: V; yaw: number; watch: V | null; key: string | null; words: string }
/** The counts for one deal of `marks` round `at`. */
export interface Counts { men: number; minGap: number; far: number; inFrame: number; inFunnel: number; inFunnelUncleared: number; backed: number; lanes: number; ways: number; waysSeen: number; waysWatched: number; unclearedWays: number; unclearedWatched: number; sameWay: number; blind: number }
export function measure(g: any, at: V, from: V, marks: Mark[]): Counts {
  const nav = g.col.nav, R = roomRead(g, at, ROOMFIT.reach, from), K = ROOMFIT;
  const funnel = (q: V, W: any) => { const x = q[0] - W.o.at[0], z = q[2] - W.o.at[2], dn = x * W.inN[0] + z * W.inN[1]; return dn > -0.2 && dn < K.funnelM && Math.abs(x * W.inN[1] - z * W.inN[0]) < W.o.half + K.funnelPad + K.funnelFlare * Math.max(0, dn) && !g.col.solidBlocked([q[0], 1.3, q[2]], [W.o.at[0] + W.inN[0] * 0.4, 1.3, W.o.at[2] + W.inN[1] * 0.4]); };
  /** is this way inside the cone of his gun, with a line to it (to just short of a frame) */
  const on = (m: Mark, W: any) => { const d = flat(m.pos, W.o.at); if (d > K.reach) return false; if (Math.abs(wrap(yawTo(m.pos, W.o.at) - m.yaw)) > 25 * Math.PI / 180) return false;
    const k = Math.max(0, 1 - 0.7 / d); return !g.col.segmentBlocked([m.pos[0], 1.55, m.pos[2]], [m.pos[0] + (W.o.at[0] - m.pos[0]) * k, 1.1, m.pos[2] + (W.o.at[2] - m.pos[2]) * k]); };
  const ways = R.ways.filter((W: any) => W.dist <= K.reach && !W.locked);
  const seen = ways.filter((W: any) => marks.some(m => { const d = flat(m.pos, W.o.at), k = Math.max(0, 1 - 0.7 / d); return !g.col.segmentBlocked([m.pos[0], 1.55, m.pos[2]], [m.pos[0] + (W.o.at[0] - m.pos[0]) * k, 1.1, m.pos[2] + (W.o.at[2] - m.pos[2]) * k]); }));
  const C: Counts = { men: marks.length, minGap: Infinity, far: 0, inFrame: 0, inFunnel: 0, inFunnelUncleared: 0, backed: 0, lanes: 0, ways: ways.length, waysSeen: seen.length, waysWatched: 0, unclearedWays: 0, unclearedWatched: 0, sameWay: 0, blind: 0 };
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) C.minGap = Math.min(C.minGap, flat(marks[i].pos, marks[j].pos));
  for (const m of marks) {
    C.far = Math.max(C.far, flat(m.pos, at));
    if (doorwayInWay(g, m.pos) || nav.isBlocked(m.pos[0], m.pos[2])) C.inFrame++;
    const fs = R.ways.filter((W: any) => funnel(m.pos, W)); if (fs.length) C.inFunnel++; if (fs.some((W: any) => !W.farKnown && !W.shut)) C.inFunnelUncleared++;
    const back = m.yaw + Math.PI; if (nav.isBlocked(m.pos[0] + Math.sin(back) * 0.55, m.pos[2] + Math.cos(back) * 0.55) || nav.isBlocked(m.pos[0] + Math.sin(back) * 0.9, m.pos[2] + Math.cos(back) * 0.9)) C.backed++;
    const tip: V = m.watch ?? [m.pos[0] + Math.sin(m.yaw) * 5, 0, m.pos[2] + Math.cos(m.yaw) * 5]; if (marks.some(o => o !== m && offLine(o.pos, m.pos, tip) < K.laneM)) C.lanes++;
    const hit = g.col.raycast([m.pos[0], 1.55, m.pos[2]], [Math.sin(m.yaw), 0, Math.cos(m.yaw)], 3); if (hit && hit.t < 1.2 && !ways.some((W: any) => on(m, W))) C.blind++;   // (his gun a stride from a wall with no way in front of him)
  }
  for (const W of seen) { const k = marks.filter(m => on(m, W)).length; if (k) C.waysWatched++; if (k > 1) C.sameWay += k - 1; if (!W.farKnown) { C.unclearedWays++; if (k) C.unclearedWatched++; } }
  return C;
}
export const ZERO = (): Counts => ({ men: 0, minGap: Infinity, far: 0, inFrame: 0, inFunnel: 0, inFunnelUncleared: 0, backed: 0, lanes: 0, ways: 0, waysSeen: 0, waysWatched: 0, unclearedWays: 0, unclearedWatched: 0, sameWay: 0, blind: 0 });
export function add(T: Counts, C: Counts): Counts { for (const k of Object.keys(T) as (keyof Counts)[]) T[k] = k === 'minGap' ? Math.min(T[k], C[k]) : k === 'far' ? Math.max(T[k], C[k]) : T[k] + C[k]; return T; }
export const line = (C: Counts) => `men ${C.men} · nearest two ${f1(C.minGap)} m · furthest from the point ${f1(C.far)} m · in a frame ${C.inFrame} · in a funnel ${C.inFunnel} (an open uncleared way's ${C.inFunnelUncleared}) · wall at his back ${C.backed} · a mate in his line ${C.lanes} · gun on a bare wall ${C.blind} · ways in sight ${C.waysSeen} of ${C.ways}, watched ${C.waysWatched} (uncleared ${C.unclearedWatched} of ${C.unclearedWays}) · doubled up ${C.sameWay}`;

/** the two deals for a point: roomfit.ts's, and the line abreast (orders.ts spotsAt, every man facing Sam's way to the point) */
export function deals(g: any, at: V, from: V, n: number): { fit: Mark[] | null; line: Mark[] } {
  const front = flat(from, at) > 0.3 ? yawTo(from, at) : 0, was = ROOMFIT.on; let F: any; ROOMFIT.on = true;
  try { F = fitSpots(g, at, n, front, from); } finally { ROOMFIT.on = was; }
  const L = g.orders.spotsAt(at, front, n).map((p: V) => ({ pos: p, yaw: front, watch: null, key: null, words: '' }));
  return { fit: F ? F.map((f: any) => ({ pos: f.pos, yaw: f.watch ? yawTo(f.pos, f.watch) : f.face, watch: f.watch, key: f.key, words: f.words })) : null, line: L };
}
/** a plan of the floor round `at`, `r` metres each way */
export function plan(g: any, at: V, from: V, fit: Mark[] | null, lineUp: Mark[], r = 7): string {
  const nav = g.col.nav, cs = nav.cell, dc = doorCells(g), R = roomRead(g, at, ROOMFIT.reach, from), x0 = Math.floor((at[0] - r) / cs), z0 = Math.floor((at[2] - r) / cs), n = Math.ceil(2 * r / cs);
  const rows: string[][] = [];
  for (let z = 0; z < n; z++) { rows.push([]); for (let x = 0; x < n; x++) { const X = x0 + x, Z = z0 + z, out = X < 0 || Z < 0 || X >= nav.W || Z >= nav.H, i = out ? -1 : nav.idx(X, Z);
    rows[z].push(out || nav.blocked[i] === 1 ? '#' : dc.has(i) ? 'D' : R.steps.has(i) ? '.' : ' '); } }
  const put = (p: V, ch: string) => { const x = Math.floor(p[0] / cs) - x0, z = Math.floor(p[2] / cs) - z0; if (x >= 0 && z >= 0 && x < n && z < n) rows[z][x] = ch; };
  for (const W of R.ways) if (!W.o.door) put(W.o.at, 'g');
  put(from, 'S'); lineUp.forEach((m, i) => put(m.pos, 'abcd'[i])); put(at, '*'); (fit ?? []).forEach((m, i) => put(m.pos, '1234'[i]));
  return rows.map(r => r.join('')).join('\n');
}

/** a level stood up with `n` teammates beside Sam (nobody steps a frame here: the shift stays where the level put it) */
export async function stand(levelFile: string | null, n: number): Promise<any> {
  const log = console.log; console.log = () => {}; let W: any;
  try { W = await standUp({ uploadEvery: 8, ...(levelFile ? { level: loadLevel(parseLevelData(readFileSync(levelFile.startsWith('/') ? levelFile : `${ROOT}/${levelFile}`, 'utf8'))) } : {}) }); } finally { console.log = log; }
  const g = W.game, p = g.player.char.pos; g.godMode = true;
  for (let i = 0; i < n; i++) spawnUnit(g, { team: 'operative', pos: [p[0] + 0.6 * (i + 1), 0, p[2]], name: ['Red One', 'Red Two', 'Blue One', 'Blue Two'][i], pair: i < 2 ? 'red' : 'blue', budget: 16 });
  return W;
}
/** a point in every room of the level: the free cell of the room nearest its middle */
export function roomPoints(g: any): { room: number; at: V; cells: number }[] {
  const nav = g.col.nav, cs = nav.cell, C = g.cleared, sum = new Map<number, { x: number; z: number; n: number }>();
  for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { const r = C.roomAt([(x + 0.5) * cs, 0, (z + 0.5) * cs]); if (!r) continue; const s = sum.get(r) ?? { x: 0, z: 0, n: 0 }; s.x += (x + 0.5) * cs; s.z += (z + 0.5) * cs; s.n++; sum.set(r, s); }
  const out: { room: number; at: V; cells: number }[] = [];
  for (const [room, s] of sum) { if (s.n < 12) continue; const mid: V = [s.x / s.n, 0, s.z / s.n]; let best: V | null = null, bd = Infinity;
    for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { const q: V = [(x + 0.5) * cs, 0, (z + 0.5) * cs]; if (C.roomAt(q) !== room) continue; const d = flat(q, mid); if (d < bd) { bd = d; best = q; } }
    if (best) out.push({ room, at: best, cells: s.n }); }
  return out.sort((a, b) => a.room - b.room);
}

if (import.meta.main) {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; }, has = (k: string) => process.argv.includes(k);
  const xz = (s: string | null): V | null => { if (!s) return null; const [x, z] = s.split(',').map(Number); return [x, 0, z]; };
  const n = Number(arg('--men') ?? 4), W = await stand(arg('--level'), n), g = W.game, from = xz(arg('--from')) ?? [...g.player.char.pos];
  if (has('--known')) for (const p of roomPoints(g)) g.cleared.mark(p.at); else g.cleared.mark(from);
  const pts = xz(arg('--at')) ? [{ room: g.cleared.roomAt(xz(arg('--at'))!), at: xz(arg('--at'))!, cells: 0 }] : roomPoints(g);
  const TF = ZERO(), TL = ZERO(); let none = 0;
  for (const P of pts) {
    const D = deals(g, P.at, from, n);
    const cf = D.fit ? measure(g, P.at, from, D.fit) : null, cl = measure(g, P.at, from, D.line);
    if (cf) add(TF, cf); else none++; add(TL, cl);
    if (has('--quiet')) continue;
    console.log(`\n--- room ${P.room} (${P.cells} cells) · the point (${f1(P.at[0])}, ${f1(P.at[2])}) · given from (${f1(from[0])}, ${f1(from[2])}) ---`);
    console.log(plan(g, P.at, from, D.fit, D.line));
    const R = roomRead(g, P.at, ROOMFIT.reach, from);
    console.log(`ways: ${R.ways.map((w: any) => `${w.o.id} ${f1(w.dist)} m${w.farKnown ? ' known' : ' UNCLEARED'}${w.shut ? ' shut' : ''}${w.locked ? ' locked' : ''}`).join(' · ') || 'none'}`);
    (D.fit ?? []).forEach((m, i) => console.log(`  ${i + 1} at (${f1(m.pos[0])}, ${f1(m.pos[2])}) ${m.words || 'facing the way Sam pointed'}`));
    console.log(`  fitted: ${cf ? line(cf) : 'no deal (the line abreast stands)'}\n  abreast: ${line(cl)}`);
  }
  console.log(`\n=== ${arg('--level') ?? 'levels/office.json'} · ${pts.length} points · ${n} men ===\nfitted:  ${line(TF)}${none ? ` · ${none} points with no deal` : ''}\nabreast: ${line(TL)}`);
  process.exit(0);
}

// The 'kickrubble' probe family — MEN KICK RUBBLE ASIDE AS THEY WALK (src/game/debris.ts feet(), behind destructionSwitch.ts RUBBLE.on), run through probes.ts:
//   bun run tools/qa/probes.ts kickrubble | kickrubble-walk | kickrubble-quiet | kickrubble-off | kickrubble-offman | kickrubble-wall | kickrubble-left | kickrubble-edge | kickrubble-pool [--verbose]
// Headless = the Proxy device; what is asserted is every CPU-side promise, in the office's corridor with one of the shift walking it under orders:
//   (walk)    the pieces lying in his path are shoved aside as he walks through and come to rest again; a piece off his path keeps its pose to the bit; the same
//             walk twice lays the same litter (deterministic); Sam, driven by the keys, shoves them too;
//   (quiet)   the shove is SILENT to the simulation: no hearing event of any kind is filed, no landing is counted, the break table is told nothing (nothing snaps
//             underfoot), no furniture is pushed, the impulses' hash stream is not advanced, no piece is spawned — and the game's digest after the walk equals
//             the digest of the same walk with the switch off (the pieces are not in the digest: what it says is that nothing ELSE moved);
//   (off)     the switch off: the same walk moves nothing, counts nothing, draws nothing;
//   (offman)  a plank that came to rest through a man standing still is pushed off him, and he has not moved;
//   (wall)    a piece pinned between a standing man and a wall is never pushed through the wall, and is given up on (bounded tries);
//   (left)    what a boot leaves alone: a piece lying on a desk top beside him (standing in reach of it, and walking past it), a slab too heavy to shift, a glass
//             plate; and a slider never leaves the floor it lies on — pushed toward the edge of a desk top (the floor rule widened for the test) it stops on it;
//   (edge)    the fragments a blown wall sheds at its foot (game/edgeLook.ts — picture only, not pool pieces) are shoved by the same feet: a walker through
//             them moves them, they come to rest on the floor outside every wall, nothing is heard, the pool is not touched — its shove count neither (the heap's kicks
//             are on the look's own books); kicked flakes that overlap do not end with their tops in one plane; a shadow caster slid to a beam casts none; Sam
//             standing in them parts them;
//   (pool)    a piece sliding off a boot is still evictable and is not 'moving' for the mayhem rule; a blast's impulse takes it over (it flies, lands and sounds).
import { standUp, ROOT } from './headless.ts';

const { RUBBLE, DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { makeBox } = await import(`${ROOT}/src/scene/boxes.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) process.exitCode = 1; return ok; } };
}
async function quiet<T>(fn: () => Promise<T> | T): Promise<T> { if (VERBOSE) return await fn(); const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } }

/** the office's corridor: Kowalski stands at its west end; the litter is laid east of him along his line */
interface Stage { W: any; game: any; D: any; gd: any; p0: Vec3; dir: [number, number]; free: number; events: any[]; seen: Set<any>; kicked: number; landedHook: number }
async function stage(on: boolean, seed = 7107): Promise<Stage> {
  Math.random = seeded(seed); RUBBLE.on = on;
  const W: any = await quiet(() => standUp({ uploadEvery: 1 })); const game = W.game; game.godMode = true; game.playerInvisible = true; game.aiEnabled = true;
  const gd = game.guards[0]; gd.hold = true; const p0: Vec3 = [gd.char.pos[0], 0, gd.char.pos[2]];
  let dir: [number, number] = [1, 0], free = 0; for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) { const h = game.col.raycast([p0[0], 0.5, p0[2]], [d[0], 0, d[1]], 12); const t = h ? h.t : 12; if (t > free) { free = t; dir = d; } }
  const D = game.destr.debris; const S: Stage = { W, game, D, gd, p0, dir, free, events: [], seen: new Set(game.events), kicked: 0, landedHook: 0 };
  // spies: every hearing event filed from here on, and every word to the break table
  const k0 = D.breaks.kicked.bind(D.breaks), l0 = D.breaks.landed.bind(D.breaks);
  D.breaks.kicked = (c: any, k: number) => { S.kicked++; return k0(c, k); }; D.breaks.landed = (c: any, sp: number) => { S.landedHook++; return l0(c, sp); };
  return S;
}
// (the game replaces `events` with a filtered copy every frame and an event lives half a second: every OBJECT not seen before is a new one)
const run = (S: Stage, n: number) => { for (let f = 0; f < n; f++) { S.W.step(DT); for (const e of S.game.events) if (!S.seen.has(e)) { S.seen.add(e); S.events.push(e); } } };
/** a point `t` m down his line and `off` m to its left */
const at = (S: Stage, t: number, off: number, y = 0.25): Vec3 => [S.p0[0] + S.dir[0] * t - S.dir[1] * off, y, S.p0[2] + S.dir[1] * t + S.dir[0] * off];
const piece = (S: Stage, c: Vec3, h: Vec3, yaw: number) => S.D.spawnRaw('chunk', makeBox({ c, h, yaw, albedo: [0.7, 0.7, 0.68] }), [0, 0, 0], [0, 0, 0]);
const PLANK: Vec3 = [0.3, 0.012, 0.06], LUMP: Vec3 = [0.09, 0.05, 0.07];
/** six pieces in his path (planks and lumps, a little either side of his line) and one well off it, let fall and settle while he is held */
function litter(S: Stage, far = 0.95): { path: any[]; aside: any } {
  const path: any[] = []; for (let i = 0; i < 6; i++) path.push(piece(S, at(S, 1.5 + i * 0.5, (i % 3 - 1) * 0.18), i % 2 ? PLANK : LUMP, i * 0.7));
  const aside = piece(S, at(S, 2.75, far), LUMP, 0.4); run(S, 120); return { path, aside };
}
const pose = (c: any) => `${c.box.c.map(String).join(',')}|${(c.box.rot ?? [c.box.yaw]).map(String).join(',')}`;   // (every digit: 'to the bit')
const walk = (S: Stage, frames = 600) => { S.gd.hold = false; order(S.gd, { goal: at(S, Math.min(S.free - 0.6, 5.5), 0, 0) as any }); run(S, frames); };
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** how far a piece's middle lies from his line of march (the corridor's axis through p0) */
const offLine = (S: Stage, c: any) => Math.abs(-(c.box.c[0] - S.p0[0]) * S.dir[1] + (c.box.c[2] - S.p0[2]) * S.dir[0]);

async function walkOnce(on: boolean) {
  const S = await stage(on); const L = litter(S); const start = L.path.map(c => [...c.box.c] as Vec3), aside0 = pose(L.aside), settled = L.path.every(c => c.rest) && L.aside.rest;
  const spawned0 = S.D.stats.spawned, landed0 = S.D.stats.landed, imp0 = S.D.impulses, props0 = S.game.props.props.map((p: any) => `${p.x},${p.z},${p.yaw}`).join(' '); S.events.length = 0; S.kicked = 0; S.landedHook = 0;
  const g0: Vec3 = [...S.gd.char.pos] as Vec3; walk(S);
  return { S, L, start, aside0, settled, spawned0, landed0, imp0, props0, walked: flat(g0, S.gd.char.pos) };
}

/** A man walking the corridor shoves the pieces in his path aside; a piece off it is not touched; the same walk twice lays the same litter; Sam's feet do it too. */
export async function kickWalk(): Promise<boolean> {
  const Fm = family('kickrubble-walk: a walking man shoves the pieces in his path aside');
  const A = await walkOnce(true); const { S, L } = A; const moved = L.path.map((c, i) => flat(c.box.c, A.start[i]));
  Fm.verdict(A.settled && A.walked > 4, 'the stage: seven pieces at rest, and he walks the corridor through them', `settled ${A.settled} · he walked ${f2(A.walked)} m at ≤ ${f2(S.game.tune.guardWalk ?? 0)} m/s`);
  Fm.verdict(moved.every(d => d > 0.08) && Math.max(...moved) < 2.5, 'every piece in his path was shoved (and none was thrown)', `moved ${moved.map(f2).join(' · ')} m · shoves: ${JSON.stringify(S.D.feetStats)}`);
  Fm.verdict(L.path.every(c => c.rest && !c.foot), 'they all lie at rest again', `resting ${L.path.filter(c => c.rest).length}/6 · still flagged as a boot's ${L.path.filter(c => c.foot).length}`);
  const off = L.path.map(c => offLine(S, c)); const mean = off.reduce((a, b) => a + b, 0) / off.length;
  Fm.verdict(mean > 0.3 && off.every(d => d > 0.1), 'they were swept ASIDE, not dribbled down the corridor', `off his line by ${off.map(f2).join(' · ')} m, mean ${f2(mean)} (they were laid 0 or 0.18 m off it: mean 0.12)`);
  Fm.verdict(pose(L.aside) === A.aside0, 'the piece 0.95 m off his line was not touched', `pose ${pose(L.aside) === A.aside0 ? 'bit-equal' : 'CHANGED'}`);
  Fm.verdict(S.D.list.every((c: any) => [...c.box.c, ...c.v, ...c.w].every(Number.isFinite)) && L.path.every(c => c.box.c[1] > 0 && c.box.c[1] < 0.2), 'nothing NaN, nothing sunk or left hanging', `heights ${L.path.map(c => c.box.c[1].toFixed(3)).join(' · ')}`);
  const B = await walkOnce(true);
  Fm.verdict(L.path.map(pose).join(' ') === B.L.path.map(pose).join(' '), 'the same walk twice lays the same litter', `second run: ${JSON.stringify(B.S.D.feetStats)}`);
  { // Sam, on the keys, walking east through three pieces
    const P = await stage(true); const g = P.game; const from = at(P, 0.8, 0.45, 0); g.teleportPlayer(from); const pc = [piece(P, at(P, 1.8, 0.45), LUMP, 0.2), piece(P, at(P, 2.4, 0.5), PLANK, 1.1), piece(P, at(P, 3.0, 0.4), LUMP, 0.9)]; run(P, 120);
    const s0 = pc.map(c => [...c.box.c] as Vec3); const ev0 = P.events.length; const key = P.dir[0] > 0 ? 'KeyD' : P.dir[0] < 0 ? 'KeyA' : P.dir[1] > 0 ? 'KeyS' : 'KeyW';
    const p0 = [...g.player.char.pos] as Vec3; for (let f = 0; f < 240; f++) { P.W.input.keys.add(key); run(P, 1); } P.W.input.keys.delete(key); run(P, 120);
    const went = flat(p0, g.player.char.pos); const mv = pc.map((c, i) => flat(c.box.c, s0[i]));
    Fm.verdict(went > 1.5 && mv.filter(d => d > 0.08).length >= 2 && pc.every(c => c.rest), 'Sam, walked on the keys, shoves them too', went > 1.5 ? `he went ${f2(went)} m · moved ${mv.map(f2).join(' · ')} m · ${JSON.stringify(P.D.feetStats)} · 'prop' events ${P.events.slice(ev0).filter((e: any) => e.kind === 'prop').length}` : `NOT ASSERTED: the keys moved him ${f2(went)} m only (the camera's basis is not the corridor's)`);
  }
  return Fm.done();
}

/** The shove is silent to the simulation. */
export async function kickQuiet(): Promise<boolean> {
  const Fm = family('kickrubble-quiet: a boot\'s shove files no hearing event, snaps nothing, pushes no furniture — the digest is the switch-off walk\'s');
  const A = await walkOnce(true); const { S } = A; const shoves = S.D.feetStats.kicked + S.D.feetStats.offMan;
  const kinds = new Map<string, number>(); for (const e of S.events) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  const O = await walkOnce(false); const okinds = new Map<string, number>(); for (const e of O.S.events) okinds.set(e.kind, (okinds.get(e.kind) ?? 0) + 1);
  const show = (m: Map<string, number>) => [...m].map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
  Fm.verdict(shoves >= 6 && !S.events.some((e: any) => e.kind === 'prop') && show(kinds) === show(okinds), 'no hearing event comes of it', `${shoves} shoves · events during the walk: ${show(kinds)} (switch off: ${show(okinds)})`);
  Fm.verdict(S.D.stats.landed === A.landed0 && S.landedHook === 0, 'no landing is counted or sounded', `landings ${S.D.stats.landed - A.landed0} · break table told of a landing ${S.landedHook}×`);
  Fm.verdict(S.kicked === 0 && S.D.stats.spawned === A.spawned0, 'the break table is told of no kick: nothing snaps underfoot, no piece is born', `breaks.kicked calls ${S.kicked} · pieces spawned ${S.D.stats.spawned - A.spawned0}`);
  Fm.verdict(S.D.impulses === A.imp0, 'the impulses\' hash stream is not advanced', `impulses ${A.imp0} → ${S.D.impulses} · the feet's own count ${S.D.shoves}`);
  const propsOf = (G: any) => G.props.props.map((p: any) => `${p.x},${p.z},${p.yaw}`).join(' ');
  Fm.verdict(propsOf(S.game) === propsOf(O.S.game), 'no furniture was pushed by a piece', `${S.game.props.props.length} props: poses bit-equal to the switch-off walk's`);
  const da = JSON.stringify(digestGame(S.game)), db = JSON.stringify(digestGame(O.S.game));
  Fm.verdict(da === db, 'the game\'s digest after the walk equals the switch-off walk\'s', da === db ? `${da.length} chars, equal` : `DIFFERS at char ${[...da].findIndex((ch, i) => ch !== db[i])}: …${da.slice(Math.max(0, [...da].findIndex((ch, i) => ch !== db[i]) - 60), [...da].findIndex((ch, i) => ch !== db[i]) + 60)}…`);
  return Fm.done();
}

/** The switch off: nothing moves, nothing is counted. */
export async function kickOff(): Promise<boolean> {
  const Fm = family('kickrubble-off: the switch off — the same walk moves nothing');
  const S = await stage(false); const L = litter(S); const before = [...L.path, L.aside].map(pose).join(' '); walk(S);
  Fm.verdict([...L.path, L.aside].map(pose).join(' ') === before, 'every piece keeps its pose to the bit', `${L.path.length + 1} pieces, he walked through ${L.path.filter(c => offLine(S, c) < 0.3).length} of them`);
  Fm.verdict(S.D.shoves === 0 && Object.values(S.D.feetStats).every(v => v === 0) && !S.D.list.some((c: any) => c.foot || c.footAt !== undefined), 'nothing counted, nothing drawn, no chunk marked', `${JSON.stringify(S.D.feetStats)} · shoves ${S.D.shoves}`);
  return Fm.done();
}

/** A plank at rest through a standing man is pushed off him. */
export async function kickOffMan(): Promise<boolean> {
  const Fm = family('kickrubble-offman: a piece that came to rest in a man is pushed off him');
  const S = await stage(true); const g = S.game; const here: Vec3 = [...S.gd.char.pos] as Vec3;
  RUBBLE.on = false; const plank = piece(S, [here[0] + 0.05, 0.3, here[2] + 0.03], PLANK, 0.5), lump = piece(S, [here[0] - 0.1, 0.3, here[2] - 0.12], LUMP, 1.2); run(S, 120);   // (they fall and come to rest THROUGH him, as a blast's pieces do)
  const lay = plank.rest && lump.rest && flat(plank.box.c, here) < 0.15 && flat(lump.box.c, here) < 0.25; RUBBLE.on = true; S.events.length = 0; const landed0 = S.D.stats.landed; run(S, 360);
  const clear = (c: any) => flat(c.box.c, S.gd.char.pos);
  /** the nearest he stands to any point of a piece's long axis (11 stations end to end), less its half width: how far its footprint is from his middle */
  const edge = (c: any, h: Vec3) => { const q = c.box.rot, yaw = q ? 2 * Math.atan2(q[1], q[3]) : c.box.yaw; const ax = [Math.cos(yaw), -Math.sin(yaw)]; let m = 9; for (let i = -5; i <= 5; i++) m = Math.min(m, Math.hypot(c.box.c[0] + ax[0] * h[0] * i / 5 - S.gd.char.pos[0], c.box.c[2] + ax[1] * h[0] * i / 5 - S.gd.char.pos[2])); return m - h[2]; };
  Fm.verdict(lay && plank.rest && lump.rest && S.D.feetStats.offMan >= 2 && S.D.feetStats.kicked === 0, 'both were pushed off him (he was not walking: no kick)', `${JSON.stringify(S.D.feetStats)} · plank's middle now ${f2(clear(plank))} m from him, the lump's ${f2(clear(lump))} m`);
  const need = RUBBLE.radius - RUBBLE.inside - 0.02;
  Fm.verdict(edge(lump, LUMP) >= need && edge(plank, PLANK) >= need, 'no part of either lies in him any more', `nearest part of the plank ${f2(edge(plank, PLANK))} m from his middle, of the lump ${f2(edge(lump, LUMP))} m · his circle is ${RUBBLE.radius} m (a piece may rest ${RUBBLE.inside} m into it)`);
  Fm.verdict(flat(here, S.gd.char.pos) < 1e-6 && S.events.length === 0 && S.D.stats.landed === landed0, 'he did not move, and nobody heard it', `he moved ${flat(here, S.gd.char.pos).toFixed(4)} m · hearing events ${S.events.length} · landings ${S.D.stats.landed - landed0}`);
  void g;
  return Fm.done();
}

/** A piece pinned between a man and a wall is not pushed through it and is given up on. */
export async function kickWall(): Promise<boolean> {
  const Fm = family('kickrubble-wall: a piece pinned against a wall is never pushed through it, and is given up on');
  const S = await stage(true); const g = S.game;
  // the corridor's nearer side wall from where he stands
  let wd: [number, number] = [0, 1], wt = 99; for (const d of [[S.dir[1], S.dir[0]], [-S.dir[1], -S.dir[0]]] as [number, number][]) { const h = g.col.raycast([S.p0[0], 0.3, S.p0[2]], [d[0], 0, d[1]], 8); if (h && h.t < wt) { wt = h.t; wd = d; } }
  const wallAt = (p: Vec3) => (p[0] - S.p0[0]) * wd[0] + (p[2] - S.p0[2]) * wd[1];   // metres toward the wall from his first place; the wall's face is at wt
  const stand: Vec3 = [S.p0[0] + wd[0] * (wt - 0.34), 0, S.p0[2] + wd[1] * (wt - 0.34)]; S.gd.char.pos[0] = stand[0]; S.gd.char.pos[2] = stand[2];
  const c = piece(S, [S.p0[0] + wd[0] * (wt - 0.1), 0.2, S.p0[2] + wd[1] * (wt - 0.1)], LUMP, 0); run(S, 600);
  Fm.verdict(wt < 8 && wallAt(c.box.c) < wt - 0.02, 'the piece is still on his side of the wall', `wall face ${f2(wt)} m off · the piece's middle at ${f2(wallAt(c.box.c))} m · ${JSON.stringify(S.D.feetStats)}`);
  const tries = S.D.shoves;
  Fm.verdict(S.D.feetStats.gaveUp >= 1 && tries <= Math.ceil(10 / (RUBBLE.giveUp * RUBBLE.cooldown + RUBBLE.giveUpSecs) + 1) * RUBBLE.giveUp, 'the tries are bounded: it is given up on, then tried again only after a wait', `${tries} tries in 10 s (uncapped: ${Math.round(10 / RUBBLE.cooldown)}) · given up ${S.D.feetStats.gaveUp}× · walled ${S.D.feetStats.walled}`);
  Fm.verdict([...c.box.c, ...c.v, ...c.w].every(Number.isFinite) && c.box.c[1] < 0.2, 'nothing NaN, it lies on the floor', `at ${c.box.c.map(f2).join(', ')} · rest ${c.rest}`);
  { // glancing: a man walking INTO the wall at an angle (the feet called by hand with a walker of our own, the pool's own update sliding the piece) never leaves a corner of a piece in it
    RUBBLE.on = false; let worst = -9, shoved = 0, trials = 0; const rows: string[] = [];
    // a stretch of the corridor where that wall runs unbroken (no doorway, no recess) for the piece's travel
    const wallFrom = (a: number) => { const h = g.col.raycast([S.p0[0] + S.dir[0] * a, 0.05, S.p0[2] + S.dir[1] * a], [wd[0], 0, wd[1]], 8); return h ? h.t : 99; };
    let a0 = -1; for (let a = 1; a < S.free - 2.4 && a0 < 0; a += 0.2) { let even = true; for (let k = -0.8; k <= 2.0; k += 0.1) if (Math.abs(wallFrom(a + k) - wt) > 0.005) even = false; if (even) a0 = a; }
    for (const h of [[0.3, 0.012, 0.2], [0.25, 0.012, 0.25], [0.2, 0.05, 0.15], [0.5, 0.012, 0.06]] as Vec3[]) for (const deg of [15, 30, 50]) for (const gap of [0.05, 0.15]) {
      S.D.clear(); S.gd.char.pos[0] = S.p0[0]; S.gd.char.pos[2] = S.p0[2]; const yaw = (trials * 0.7) % 3;
      const reach = Math.abs(Math.cos(yaw) * wd[0] - Math.sin(yaw) * wd[1]) * h[0] + Math.abs(Math.sin(yaw) * wd[0] + Math.cos(yaw) * wd[1]) * h[2];   // its half width toward the wall
      const along: [number, number] = [S.dir[0], S.dir[1]]; const pc = piece(S, [S.p0[0] + along[0] * a0 + wd[0] * (wt - gap - reach), 0.1, S.p0[2] + along[1] * a0 + wd[1] * (wt - gap - reach)], h, yaw); run(S, 90);
      const a = deg * Math.PI / 180, vx = (along[0] * Math.cos(a) + wd[0] * Math.sin(a)) * 1.5, vz = (along[1] * Math.cos(a) + wd[1] * Math.sin(a)) * 1.5;
      const man = { pos: [pc.box.c[0] - vx * 0.9, 0, pc.box.c[2] - vz * 0.9] as Vec3, vel: [vx, 0, vz] as Vec3 }; const n0 = S.D.shoves;
      for (let f = 0; f < 150; f++) { if (wallAt(man.pos) < wt - 0.3) { man.pos[0] += vx * DT; man.pos[2] += vz * DT; } else man.vel = [0, 0, 0]; S.D.feet([man], RUBBLE); run(S, 1); }
      run(S, 90); const q = pc.box.rot, yw = q ? 2 * Math.atan2(q[1], q[3]) : pc.box.yaw; let deep = -9;
      for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) deep = Math.max(deep, wallAt([pc.box.c[0] + Math.cos(yw) * h[0] * su + Math.sin(yw) * h[2] * sv, 0, pc.box.c[2] - Math.sin(yw) * h[0] * su + Math.cos(yw) * h[2] * sv]) - wt);
      worst = Math.max(worst, deep); shoved += S.D.shoves > n0 ? 1 : 0; trials++; if (deep > 0.02) rows.push(`${h[0]}×${h[2]} at ${deg}° from ${gap} m: ${f2(deep)} m in`);
    }
    Fm.verdict(a0 > 0 && shoved >= trials * 0.75 && worst <= 0.02, 'kicked at the wall at a glancing angle, no corner of any piece ends in it', `wall unbroken from ${f2(a0 - 0.8)} to ${f2(a0 + 2)} m down the corridor · ${trials} trials (four shapes × 15°/30°/50° × 5 and 15 cm clear), ${shoved} shoved · deepest corner ${(worst * 100).toFixed(1)} cm past the wall's face${rows.length ? ' · ' + rows.join('; ') : ''}`);
  }
  return Fm.done();
}

/** What a boot leaves alone, and the floor a slider never leaves. */
export async function kickLeft(): Promise<boolean> {
  const Fm = family('kickrubble-left: a boot leaves alone what is not at his feet, what is too heavy, and glass; a slider never leaves its floor');
  { // a piece on a desk top: he stands in reach of it, then walks past it
    const S = await stage(true); const g = S.game; RUBBLE.on = false;
    // a low static top (0.35‥1.0 m) with open floor beside it: the first the level has
    const topAt = (x: number, z: number) => { const h = g.col.raycast([x, 1.4, z], [0, -1, 0], 1.6); return h ? 1.4 - h.t : -1; };
    let spot: { x: number; z: number; top: number; sx: number; sz: number } | null = null;
    for (let z = 5; z < 23 && !spot; z += 0.25) for (let x = 5; x < 35 && !spot; x += 0.25) { const t = topAt(x, z); if (t < 0.35 || t > 1.0 || Math.abs(topAt(x + 0.1, z) - t) > 0.01 || Math.abs(topAt(x - 0.1, z) - t) > 0.01 || Math.abs(topAt(x, z + 0.1) - t) > 0.01 || Math.abs(topAt(x, z - 0.1) - t) > 0.01) continue;
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let open = true; for (const r of [0.4, 0.6, 0.9, 1.4, 1.9]) if (Math.abs(topAt(x + sx * r, z + sz * r)) > 0.02 || g.props.raycast([x + sx * r, 1.4, z + sz * r], [0, -1, 0], 1.39)) open = false; if (open && !g.props.raycast([x, 1.4, z], [0, -1, 0], 1.39)) { spot = { x, z, top: t, sx, sz }; break; } } }
    if (!spot) { Fm.verdict(false, 'the stage: a low top with open floor beside it', 'none found in the office'); return Fm.done(); }
    // the top's edge on its open side; a plank lying ACROSS it, its middle on the top, 14 cm of it out over the floor where he stands
    let ed = 0; while (ed < 2 && Math.abs(topAt(spot.x + spot.sx * (ed + 0.02), spot.z + spot.sz * (ed + 0.02)) - spot.top) < 0.01) ed += 0.02;
    const SH: Vec3 = [0.2, 0.012, 0.05]; const yaw = Math.atan2(-spot.sz, spot.sx);
    const lay = async (T: Stage) => { RUBBLE.on = false; const c = piece(T, [spot!.x + spot!.sx * (ed - 0.06), spot!.top + 0.1, spot!.z + spot!.sz * (ed - 0.06)], SH, yaw); run(T, 150);
      T.gd.hold = true; T.gd.char.pos[0] = spot!.x + spot!.sx * (ed + 0.3); T.gd.char.pos[2] = spot!.z + spot!.sz * (ed + 0.3); run(T, 2);
      const tip = [c.box.c[0] + spot!.sx * SH[0], c.box.c[2] + spot!.sz * SH[0]]; const into = RUBBLE.radius - Math.hypot(tip[0] - T.gd.char.pos[0], tip[1] - T.gd.char.pos[2]);
      return { c, on: c.rest && Math.abs(c.box.c[1] - spot!.top - SH[1]) < 0.01, into, p0: pose(c) }; };
    // the twin with the floor rule widened: there the same man, standing the same, DOES push it — he is in reach of it in plan, so the rule is what holds
    const T2 = await stage(true); const floor0 = RUBBLE.floor; let twin = 0, twinInto = 0;
    try { const B = await lay(T2); RUBBLE.floor = 5; RUBBLE.on = true; run(T2, 120); twin = T2.D.shoves; twinInto = B.into; } finally { RUBBLE.floor = floor0; }
    const A = await lay(S); const c = A.c; RUBBLE.on = true; S.events.length = 0; const l0 = S.D.stats.landed; run(S, 240);
    Fm.verdict(A.on && A.into > RUBBLE.inside && twin > 0 && pose(c) === A.p0 && S.D.shoves === 0, 'a plank lying on a desk top and out over its edge INTO the man standing there is not at his feet', `top ${f2(spot.top)} m at (${f2(spot.x)}, ${f2(spot.z)}), edge ${f2(ed)} m on · it reaches ${f2(A.into)} m into his circle in plan (pushed off past ${RUBBLE.inside}) · pose ${pose(c) === A.p0 ? 'bit-equal' : 'CHANGED'}, shoves ${S.D.shoves} · the twin with the floor rule widened (in ${f2(twinInto)} m): ${twin} shoves`);
    S.gd.char.pos[0] = spot.x + spot.sx * (ed + 0.3) - spot.sz * 1.2; S.gd.char.pos[2] = spot.z + spot.sz * (ed + 0.3) + spot.sx * 1.2; S.gd.hold = false; const from = [...S.gd.char.pos] as Vec3;
    order(S.gd, { goal: [spot.x + spot.sx * (ed + 0.3) + spot.sz * 1.2, 0, spot.z + spot.sz * (ed + 0.3) - spot.sx * 1.2] as any }); run(S, 360);
    Fm.verdict(flat(from, S.gd.char.pos) > 1.5 && pose(c) === A.p0 && S.D.shoves === 0 && S.D.stats.landed === l0 && !S.events.some((e: any) => e.kind === 'prop'), '…nor of the man walking through its overhang: it does not slide off, fall and bring the shift', `he walked ${f2(flat(from, S.gd.char.pos))} m along the top's edge, 0.3 m off it · pose ${pose(c) === A.p0 ? 'bit-equal' : 'CHANGED'} · shoves ${S.D.shoves} · landings +${S.D.stats.landed - l0}`);
    // a slider never leaves its floor: slid by hand (the mark and a boot's speed set on it) off each of the top's four sides, it stops on the top
    RUBBLE.on = false; S.gd.hold = true; let stayed = 0; const outs: string[] = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { S.D.clear(); const k = piece(S, [spot.x, spot.top + 0.1, spot.z], [0.07, 0.012, 0.05], 0.3); run(S, 120); const y0 = k.box.c[1], at0 = [...k.box.c] as Vec3; const ld = S.D.stats.landed; S.events.length = 0;
      k.rest = false; k.stillT = 0; k.foot = true; k.v = [dx * RUBBLE.vMax, 0, dz * RUBBLE.vMax]; run(S, 180);
      const ok = !S.events.some((e: any) => e.kind === 'prop') && k.rest && Math.abs(k.box.c[1] - y0) < 0.004 && Math.abs(topAt(k.box.c[0], k.box.c[2]) - spot.top) < 0.01 && S.D.stats.landed === ld; stayed += ok ? 1 : 0; outs.push(`${f2(flat(at0, k.box.c))} m`); }
    Fm.verdict(stayed === 4, 'a slider stops where its floor ends: sent off each side of the top at a boot\'s hardest, it is still on it', `${stayed}/4 stayed on the top at their height, no landing, no hearing event (it would go ${f2(RUBBLE.vMax * RUBBLE.vMax / (2 * RUBBLE.slide * 9.81))} m on open floor; went ${outs.join(' · ')})`);
  }
  { // in his path: a slab too heavy for a boot, and a glass plate
    const S = await stage(true); const slab = piece(S, at(S, 2.0, 0.05, 0.3), [0.4, 0.22, 0.2], 0.2), plate = piece(S, at(S, 3.2, -0.05, 0.1), [0.12, 0.004, 0.09], 0.6), lump = piece(S, at(S, 4.0, 0, 0.2), LUMP, 0.1); run(S, 150);
    plate.glass = { pane: -1 }; const p = [pose(slab), pose(plate)], l0 = [...lump.box.c] as Vec3; walk(S);
    Fm.verdict(slab.rest && pose(slab) === p[0] && pose(plate) === p[1] && flat(lump.box.c, l0) > 0.08, 'he walks through a slab too heavy to shift and over a glass plate; the lump beyond them is kicked', `slab ${(0.4 * 0.22 * 0.2 * 8 * 600).toFixed(0)} kg (a boot shifts ≤ ${RUBBLE.heavy}) ${pose(slab) === p[0] ? 'untouched' : 'MOVED'} · plate ${pose(plate) === p[1] ? 'untouched' : 'MOVED'} · lump moved ${f2(flat(lump.box.c, l0))} m · ${JSON.stringify(S.D.feetStats)}`);
  }
  return Fm.done();
}

/** flat pieces at rest whose plans overlap and whose tops lie within 0.2 mm of one plane (drawn, two such tops of different tones share their pixels) */
function onePlane(R: any[]): number {
  const F: { c: Vec3; ax: [number, number]; e: [number, number]; top: number }[] = [];
  for (const r of R) { if (r.t < r.T) continue; const b = r.box, q = b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)]; const [x, y, z, w] = q;
    const A: Vec3[] = [[1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)], [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)], [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]];
    let iu = 0; for (let i = 1; i < 3; i++) if (Math.abs(A[i][1]) > Math.abs(A[iu][1])) iu = i; if (Math.abs(A[iu][1]) < 0.9995) continue;
    const i1 = (iu + 1) % 3, i2 = (iu + 2) % 3; const l = Math.hypot(A[i1][0], A[i1][2]) || 1;
    F.push({ c: b.c, ax: [A[i1][0] / l, A[i1][2] / l], e: [b.h[i1], b.h[i2]], top: b.c[1] + b.h[iu] }); }
  const sep = (P: typeof F[0], Q: typeof F[0]) => { const dx = Q.c[0] - P.c[0], dz = Q.c[2] - P.c[2];
    for (const [ux, uz] of [P.ax, [-P.ax[1], P.ax[0]], Q.ax, [-Q.ax[1], Q.ax[0]]] as [number, number][]) { const rad = (T: typeof F[0]) => Math.abs(ux * T.ax[0] + uz * T.ax[1]) * T.e[0] + Math.abs(-ux * T.ax[1] + uz * T.ax[0]) * T.e[1]; if (Math.abs(dx * ux + dz * uz) > rad(P) + rad(Q)) return true; } return false; };
  let n = 0; for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) if (Math.abs(F[i].top - F[j].top) < 0.0002 && !sep(F[i], F[j])) n++; return n;
}
/** The blown walls' own fragments (edgeLook.ts) under the same feet. */
export async function kickEdge(): Promise<boolean> {
  const Fm = family('kickrubble-edge: the fragments at the foot of a blown wall are shoved by the same feet');
  const d0 = DESTRUCTION.on; DESTRUCTION.on = true;
  try {
    // the stage, and a walker along the wall through its heap. `level` = the twin for the one-plane check: every kicked fragment seated at the pool's own height
    const walked = async (level: boolean) => {
      const S = await stage(false); const g = S.game; g.aiEnabled = false; g.tune.chaos = 0.5; for (const gd of g.guards) { gd.hold = true; gd.heardUpTo = 1e12; }
      if (level) { const l0 = S.D.loose.bind(S.D); S.D.loose = (b: any) => l0(b, 0); }
      const nav = g.col.nav; const free = (x: number, z: number) => !nav.blocked[nav.idx(Math.floor(x / nav.cell), Math.floor(z / nav.cell))];
      // a partition with open floor both sides of its middle
      let pick: { mid: Vec3; n: Vec3; t: Vec3 } | null = null;
      for (const w of g.destr.walls.all()) { if (w.kind !== 'wall' || pick) continue; const b = w.box, ax = b.h[0] >= b.h[2]; if ((ax ? b.h[0] : b.h[2]) < 1.6) continue; const n: Vec3 = ax ? [0, 0, 1] : [1, 0, 0], t: Vec3 = ax ? [1, 0, 0] : [0, 0, 1];
        let ok = true; for (const side of [-1, 1]) for (const u of [-1.2, 0, 1.2]) for (const d of [0.6, 1.1]) if (!free(b.c[0] + n[0] * d * side + t[0] * u, b.c[2] + n[2] * d * side + t[2] * u)) ok = false; if (ok) pick = { mid: [b.c[0], 0, b.c[2]], n, t }; }
      if (!pick) return null;
      const { mid, n, t } = pick; const res = g.destr.blast([mid[0] + n[0] * 0.3, 0.3, mid[2] + n[2] * 0.3], { who: 0, radius: 2.5, power: 1 }); run(S, 300);
      const E = g.destr.edgeLook; const R: any[] = E.rubble; const atRest = R.filter(r => r.t >= r.T); const shedPlane = onePlane(R);
      // the side with more of it, and a line through it along the wall 0.55 m off its face
      const sideOf = (r: any) => Math.sign((r.box.c[0] - mid[0]) * n[0] + (r.box.c[2] - mid[2]) * n[2]) || 1; const side = atRest.filter(r => sideOf(r) > 0).length >= atRest.length / 2 ? 1 : -1;
      const man = { pos: [mid[0] + n[0] * 0.55 * side - t[0] * 2.2, 0, mid[2] + n[2] * 0.55 * side - t[2] * 2.2] as Vec3, vel: [t[0] * 1.3, 0, t[2] * 1.3] as Vec3 };
      // a beam for the test, along his line at shin height (the look's own inBeam is the devices' beams; none runs along this wall): every fragment at rest is
      // made a shadow caster by hand, as the cut switch makes its big slabs — the boots must take the shadow off any they slide to the beam
      const NOSHADOW = 2; const line0: Vec3 = [man.pos[0], 0.05, man.pos[2]]; const inBeam = (p: Vec3, r: number) => { const u = (p[0] - line0[0]) * t[0] + (p[2] - line0[2]) * t[2]; return Math.hypot(p[0] - line0[0] - t[0] * u, p[1] - line0[1], p[2] - line0[2] - t[2] * u) < r + 0.12; };
      const E_inBeam = E.inBeam; E.inBeam = inBeam; for (const r of atRest) r.box.flags &= ~NOSHADOW;
      const start0 = new Map<any, string>(R.map(r => [r, pose(r)])); const c0 = new Map<any, Vec3>(R.map(r => [r, [...r.box.c] as Vec3])); const in0 = new Set<any>(R.filter(r => S.D.footIn(r.box)));
      S.events.length = 0; const st0 = JSON.stringify(S.D.stats), n0 = S.D.list.length, sh0 = S.D.shoves, fs0 = JSON.stringify(S.D.feetStats); const poolPose = S.D.list.map(pose).join(' ');
      for (let f = 0; f < 210; f++) { man.pos[0] += man.vel[0] * DT; man.pos[2] += man.vel[2] * DT; E.feet([man], RUBBLE, DT); run(S, 1); } for (let f = 0; f < 120; f++) { E.feet([], RUBBLE, DT); run(S, 1); }
      E.inBeam = E_inBeam;
      const moved = R.filter(r => pose(r) !== start0.get(r)); const far = moved.map(r => flat(r.box.c, c0.get(r)!));
      const rad = (r: any) => Math.max(r.box.h[0], r.box.h[2]);
      return { S, g, E, R, atRest, res, free, moved, far, in0, st0, n0, sh0, fs0, poolPose, shedPlane, plane: onePlane(R), NOSHADOW,
        castInBeam: moved.filter(r => !(r.box.flags & NOSHADOW) && inBeam(r.box.c, rad(r))).length, shadowOff: moved.filter(r => r.box.flags & NOSHADOW).length,
        stillCast: atRest.filter(r => pose(r) === start0.get(r) && !(r.box.flags & NOSHADOW)).length, unmoved: atRest.filter(r => pose(r) === start0.get(r)).length };
    };
    const A = await walked(false);
    if (!A) { Fm.verdict(false, 'the stage: a partition with open floor both sides', 'none found in the office'); return Fm.done(); }
    const { S, g, E, R, atRest, res, free, moved, far, in0, st0, n0, sh0, fs0, poolPose } = A;
    Fm.verdict(res.opened > 0 && atRest.length >= 10 && moved.length >= 3 && Math.max(0, ...far) < 2.5, 'a walker through the foot of the hole shoves its fragments (none is thrown)', `blast opened ${res.opened} cells · ${R.length} fragments, ${atRest.length} at rest · he walked 4.5 m along the wall 0.55 m off it · ${moved.length} moved, ${f2(Math.min(...far))}‥${f2(Math.max(0, ...far))} m · ${JSON.stringify(E.footBook.stats)}`);
    const recs = R.filter(r => r.foot).map(r => r.foot); const sunk = moved.filter(r => { const sup = r.box.c[1]; return !(sup > 0 && sup < 0.6) || ![...r.box.c].every(Number.isFinite); });
    Fm.verdict(recs.every((c: any) => c.rest && !c.foot) && sunk.length === 0 && moved.every(r => in0.has(r) || !S.D.footIn(r.box)), 'they come to rest again, on the floor, and none that lay clear of the walls has a corner in one', `${recs.length} records, all at rest · ${in0.size} lay with a corner in the wall's stump as shed, ${moved.filter(r => !in0.has(r) && S.D.footIn(r.box)).length} more do now · heights ${moved.slice(0, 6).map(r => r.box.c[1].toFixed(3)).join(' · ')}${moved.length > 6 ? ' …' : ''}`);
    Fm.verdict(S.events.length === 0 && JSON.stringify(S.D.stats) === st0 && S.D.list.length === n0 && S.D.list.map(pose).join(' ') === poolPose && !S.D.list.some((c: any) => recs.includes(c)), 'picture only still: nothing heard, no pool slot taken, no pool piece touched', `hearing events ${S.events.length} · pool ${S.D.list.length} pieces (was ${n0}), stats ${JSON.stringify(S.D.stats) === st0 ? 'unchanged' : 'CHANGED'}`);
    // the pool's pieces are play (a later blast throws them, and they are heard): what they draw must not hang on a picture-only list having been kicked first
    Fm.verdict(E.footBook.shoves > 0 && S.D.shoves === sh0 && JSON.stringify(S.D.feetStats) === fs0, 'the heap\'s kicks are on its own books: the pool\'s shove count (its hash stream) and its counts did not move', `the heap's own count ${E.footBook.shoves} · the pool's ${sh0} → ${S.D.shoves} · the pool's counts ${JSON.stringify(S.D.feetStats) === fs0 ? 'unchanged' : 'CHANGED'}`);
    // laid flat by a boot, the flakes off one wall (one thickness) must not end with their tops in one plane where they overlap: each has its own height
    const B = await walked(true);
    Fm.verdict(!!B && B.plane >= 20 && A.plane <= Math.max(8, B.plane / 4), 'kicked flakes that overlap do not lie with their tops in one plane', `flat overlapping pairs with tops within 0.2 mm: ${A.shedPlane} as shed → ${A.plane} after the walker · the twin with every kicked fragment seated at one height: ${B ? B.plane : '—'}`);
    // a shadow caster the boots slide to a tripwire's beam casts none from then on (a beam ends at the first shadow caster)
    Fm.verdict(A.shadowOff > 0 && A.castInBeam === 0 && A.stillCast === A.unmoved && A.unmoved > 0, 'a shadow-casting piece slid to a beam loses its shadow; one no boot moved keeps it', `every fragment at rest made a caster, a test beam along his line · moved ${moved.length}: ${A.shadowOff} lost the shadow, ${A.castInBeam} still cast it in the beam · not moved ${A.unmoved}: ${A.stillCast} still cast`);
    // the game's own call: Sam set down in the thick of it with the switch on — what lies in him is pushed off him
    const untouched = R.filter(r => r.t >= r.T && !r.foot?.footAt && r.box.c[1] - 0.2 < 0.12); let best: any = null, bn = -1; for (const r of untouched) { const k = untouched.filter(o => flat(o.box.c, r.box.c) < 0.3).length; if (k > bn && free(r.box.c[0], r.box.c[2])) { bn = k; best = r; } }
    if (best) { g.teleportPlayer([best.box.c[0], 0, best.box.c[2]]); const sh1 = E.footBook.shoves; RUBBLE.on = true; S.events.length = 0; run(S, 120); RUBBLE.on = false;
      Fm.verdict(E.footBook.shoves > sh1 && !S.events.some((e: any) => e.kind === 'prop'), 'through the game\'s own frame: Sam set down in the thick of it parts it', `${bn} fragments within 0.3 m of where he stands · ${E.footBook.shoves - sh1} shoves · 'prop' events ${S.events.filter((e: any) => e.kind === 'prop').length}`); }
    else Fm.verdict(false, 'through the game\'s own frame: Sam set down in the thick of it parts it', 'no untouched fragment on open floor to stand in');
  } finally { DESTRUCTION.on = d0; }
  return Fm.done();
}

/** A boot's piece stays evictable and out of `moving`; a blast's impulse takes it over. */
export async function kickPool(): Promise<boolean> {
  const Fm = family('kickrubble-pool: a piece sliding off a boot is evictable, is not "moving", and a blast takes it over');
  const S = await stage(true); const g = S.game; const D = S.D; const cap = D.cap();
  const L = litter(S); for (let i = D.list.length; i < cap; i++) piece(S, at(S, 1 + (i % 8) * 0.45, 0.8 + Math.floor(i / 8) * 0.12 * (i % 2 ? 1 : -1) - 0.4, 0.1), [0.04, 0.03, 0.04], i); run(S, 150);
  const full = D.list.length === cap && D.list.every((c: any) => c.rest);
  S.gd.hold = false; order(S.gd, { goal: at(S, Math.min(S.free - 0.6, 5.5), 0, 0) as any }); let seen = 0, movingMax = 0, f = 0;
  for (; f < 400 && !seen; f++) { run(S, 1); seen = D.list.filter((c: any) => c.foot && !c.rest).length; movingMax = Math.max(movingMax, D.moving); }
  const sliding = D.list.filter((c: any) => c.foot && !c.rest); const refused0 = D.stats.refused, evicted0 = D.stats.evicted;
  Fm.verdict(full && sliding.length >= 1 && D.moving === 0 && movingMax === 0, 'pieces sliding off his boot are not counted as moving', `pool ${D.list.length}/${cap} · ${sliding.length} sliding at frame ${f} · moving ${D.moving}`);
  // a pool whose ONLY non-moving pieces are the sliding ones would still find a slot: wake every resting piece as a blast would, then spawn
  for (const c of D.list) if (c.rest) { c.rest = false; c.stillT = 0; c.v = [0, 2, 0]; }
  const born = piece(S, at(S, 0.5, -0.8, 1.2), LUMP, 0);
  Fm.verdict(!!born && D.stats.refused === refused0 && D.stats.evicted === evicted0 + 1 && D.list.length === cap, 'with every other piece in the air, a new piece takes a sliding one\'s slot', `born ${!!born} · evicted +${D.stats.evicted - evicted0} · refused +${D.stats.refused - refused0}`);
  run(S, 300);
  // a blast's impulse on a piece really sliding off his boot: it is the blast's now — it flies, lands, knocks and is heard
  const B = await stage(true); const LB = litter(B); B.gd.hold = false; order(B.gd, { goal: at(B, Math.min(B.free - 0.6, 5.5), 0, 0) as any }); let c: any = null;
  for (let k = 0; k < 400 && !c; k++) { run(B, 1); c = LB.path.find((x: any) => x.foot && !x.rest) ?? null; }
  const D2 = B.D; const l2 = D2.stats.landed; B.events.length = 0; const slid = !!c;
  if (c) D2.impulse({ pos: [c.box.c[0] - 0.3, 0, c.box.c[2]], radius: 2, strength: 10, up: 1.2, bias: [0, 0, 0] }); const took = !!c && c.foot === false; run(B, 240);
  Fm.verdict(slid && took && D2.stats.landed > l2 && B.events.some((e: any) => e.kind === 'prop'), 'an impulse on a sliding piece clears the mark: it lands with its knock and its hearing event', `a piece sliding off his boot ${slid} · foot cleared ${took} · landings +${D2.stats.landed - l2} · 'prop' events ${B.events.filter((e: any) => e.kind === 'prop').length}`);
  void g; void L;
  return Fm.done();
}

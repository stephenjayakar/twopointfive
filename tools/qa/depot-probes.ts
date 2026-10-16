// The 'depot' family — the depot's own facts (levels/depot.json ← tools/levels/depot.ts: a motor pool at night, three huts round a floodlit yard; its room clear
// structure, team start and second way in are in the file's `scenarios` block — rebuild/scenario-levels/contract.md), run through probes.ts:
//   bun run tools/qa/probes.ts depot | depot-level | depot-stage | depot-doors | depot-openings | depot-walk | depot-run
// PASS / FAIL each, all headless (the Game of headless.ts stood up on the depot's Level — standUp({ level })). The level is ONE PROBLEM — the signals hut and
// the store's hatch hold the lit yard in a crossfire from the dark, and the hut's own door is at its back — and what is pinned here is the geometry that
// problem stands on, asked with the game's own sight test (guards.ts eyeContact: 16 m of reach, the cone, chest and head against the solids), walk grid and
// headless light meter (guards.ts lightEstimateAt: direct light, no moon, no bounce). Nothing here says who wins. The harness draws nothing: what the level
// LOOKS like, how the floodlights fall on a GPU and whether the dark slits read as dark on screen are untested here.
//   depot-level     the file is the generator's level (0 diffs), the validator and the lint are clean on it, and it is inside the renderer's fixed sizes (world
//                   box, boxes, glass panes); its thirteen doors by name (no gate in the north wall: the main gate, west, is an opening), the signals hut's
//                   ONE door (b_n), the mains panel inside the generator room with the three floodlights on it, and a second way in outside the back gate
//   depot-stage     the four squad boots on it: the structure is sound against the level (roomclear.ts checkStructure), four teammates and five defenders stand,
//                   on floor, apart; seed 0 is the HAND PLACEMENT (each held room's first `garrison` marks: crew 1, comms 2 at the slits, store 2 at the hatch);
//                   both starts stand out of every watcher's sight or beyond his eye's reach and ten idle seconds pass without a round; the other way in stages;
//                   the yard and the open park read lit off the mains and dark with them out, the watchers' marks dark either way, the lane behind the
//                   signals shelter darker than the open park
//   depot-doors     stack room: on every door of the structure, from the side it is taken from, four stack marks (and a pair's two) on free floor, apart, out
//                   of the opening, clear of the furniture; the clear wall beside each jamb in metres; then live — the four ordered onto every door in turn
//                   get onto their marks
//   depot-openings  THE PUZZLE. The openings of every held room counted off the walls (a walk-through gap, with or without a leaf; a window = anything the eye
//                   passes at 1.5 m and a body does not): the hut has one door and three windows, the store two doors and its hatch. Then the lines, each man
//                   on his mark facing as written: the west slit and a hatch man onto the stack ground outside the crew room's yard door, the other hatch man
//                   onto the battery room's; the east slit onto a metre or so in the MIDDLE of the walk from the park wall's gap to the generator room's door
//                   (the gap and the door's step unseen, no way round the stretch he sees). The nests cover each other: the west slit sees the lane along the
//                   south bar's yard wall as far as the hatch's jamb, a hatch man the ground under the hut's south window. THE STORES' WAY (main gate → along
//                   the south wall, behind the truck → the workshop's yard door → the bay → the store's bay door): the hatch men see none of it, the west
//                   slit sees the stack ground at the workshop's door (the price), and inside the bay nobody does. The generator room and the hut's own door
//                   are seen by neither hut man looking out of his slit; a man just inside the store's bay door by the hatch's west man not at all and by
//                   its east man at his elbow.
//   DEPOT_BREAK=1   each watcher read off the middle of his room, not his mark: depot-openings AND depot-stage must FAIL
//   depot-walk      Sam walks every room and through every door with the four following: man-frames stuck, frames with two men in one place, man-seconds
//                   stood in a doorway, how far the file strings out — judged against this floor's own measured numbers with a margin
//   depot-run       scripted runs over seeds, the commander a ghost who only gives orders off the menu: the OBVIOUS PLAN (the crew room first, across the lit
//                   yard) by TWO PAIRS, TWO DOORS where a room has two, against ONE STACK through each room's first door. Judged: no run stalls at the cap,
//                   one at least is taken, few orders refused, no teammate down to a teammate. Printed: who wins, teammates lost, seconds, two-door entries
//   depot-home      (by name only, not in the family: it judges nothing) the same runs with ROOMFIGHT.rally off — the defenders kept in their rooms
// The game takes the structure and the team's start from the level it stands on (Level.scenarios.roomClear): nothing here reaches into the game's tables but
// the knobs a probe names, and those are put back.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH, SQUAD4_BUDGET } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR, checkStructure } = await import(`${ROOT}/src/game/roomclear.ts`);
const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData, validateLevelData, structuralDiff } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lintLevel } = await import(`${ROOT}/src/editor/lint.ts`);
const { build: buildDepot, DEPOT_ROOMS } = await import(`${ROOT}/tools/levels/depot.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { GUARD_EYE, eyeContact, lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { BoxFlag, MAX_GLASS } = await import(`${ROOT}/src/scene/boxes.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { MAX_CHARS } = await import(`${ROOT}/src/anim/characters.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x)), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const names = (l: any[]) => l.map((g: any) => g.callsign).join(', ');
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
type Rect = { x0: number; x1: number; z0: number; z1: number };
const inBounds = (b: Rect, p: number[], m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;

// ---------------------------------------------------------------- the two levels
const DEPOT_FILE = `${ROOT}/levels/depot.json`;
const depotText = () => readFileSync(DEPOT_FILE, 'utf8');
const depotLevel = () => loadLevel(parseLevelData(depotText()));
type Where = 'depot' | 'office';
/** the depot's room clear structure, as its file carries it (read when a probe asks: a broken file is depot-level's to name, not this module's import's) */
const depotStructure = (): { name: string; team: any; starts?: any[]; rooms: any[] } => depotLevel().scenarios.roomClear;
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH, samAt: [...NIGHTBREACH.samAt] }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] }, RF_DEFAULTS = { ...ROOMFIGHT };
const restore = () => { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS, { samAt: [...NB_DEFAULTS.samAt] }); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); Object.assign(ROOMFIGHT, RF_DEFAULTS); };
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { restore(); } };

const DEPOT_NAMED: Record<string, Rect> = { 'crew room (A)': DEPOT_ROOMS.a, 'comms room (B)': DEPOT_ROOMS.b, 'store (C)': DEPOT_ROOMS.c, 'duty office': DEPOT_ROOMS.duty, 'wash room': DEPOT_ROOMS.wash, 'battery room': DEPOT_ROOMS.battery, 'generator room': DEPOT_ROOMS.generator, 'tyre store': DEPOT_ROOMS.tyres, bay: DEPOT_ROOMS.bay };

const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const offOf = (d: any, p: number[]) => { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]); };
const inDoorway = (d: any, p: number[]) => { const a = alongOf(d, p); return a > 0 && a < d.def.width && Math.abs(offOf(d, p)) < 0.5; };
/** a floor point `off` metres off the door's frame line on `side`, `along` metres from the hinge */
const doorPoint = (d: any, side: number, off: number, along = d.def.width / 2): number[] => { const th = d.def.closedDir, c = Math.cos(th), s = Math.sin(th); return [d.def.hinge[0] + c * along - s * side * off, 0, d.def.hinge[1] + s * along + c * side * off]; };
/** the side of a door that is OUTSIDE a room (the one the squad takes it from) */
const outsideOf = (d: any, room: Rect): 1 | -1 => (inBounds(room, doorPoint(d, 1, 1.2)) ? -1 : 1);

/** One game under a seed on `where`: the room clear staged with four teammates, Sam in god mode and dark.
 *  `quiet`: the defenders dazzled every frame · `empty`: the defenders stood out on the north verge, out of everybody's sight (a walk is about feet) ·
 *  `ghost`: Sam unseen, unheard and parked outside the wall's south-east corner except for the instant an order is read off where he stands (the tally runner's commander) ·
 *  `fight` / `clear`: ROOMFIGHT / ROOMCLEAR knobs for this game, set before it is staged (restore() puts the tables back). */
const PARK = [38.6, 0, 26.2];
export async function rig(seed: number, where: Where, o: { quiet?: boolean; empty?: boolean; ghost?: boolean; fight?: Record<string, unknown>; clear?: Record<string, unknown>; stage?: boolean } = {}) {
  restore(); Object.assign(NIGHTBREACH, { squad: 4 }); Object.assign(ROOMFIGHT, o.fight ?? {}); Object.assign(ROOMCLEAR, o.clear ?? {});   // (every knob in place BEFORE the staging reads any of them)
  Math.random = seeded(seed);
  const W: any = await standUp(where === 'depot' ? { level: depotLevel() } : {}); const game = W.game; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true; if (o.ghost) game.playerInvisible = true;
  const why = o.stage === false ? null : RC.start(seed);
  const seen = new Set<any>();
  const R = { W, game, RC, NB, O, D, why, quiet: !!o.quiet, downs: [] as { who: any; t: number; by: any }[], rounds: 0, pre: null as null | (() => void), post: null as null | (() => void), stand: [...NIGHTBREACH.samAt] as number[],
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        if (R.quiet || o.empty) for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
        R.pre?.();
        const was = game.guards.map((x: any) => [x, x.state] as const);
        W.step(DT);
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'guardShot') R.rounds++; }
        for (const [x, st] of was) if (st !== 'dead' && x.state === 'dead') R.downs.push({ who: x, t: game.time, by: game.guards.find((k: any) => k.char.id === x.killerId) ?? null });
        R.post?.();
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    men(who: any = 'all', down = false): any[] { return O.men(who, { down }); },
    /** the ghost commander: an order read off `stand`, his body back outside the wall before the frame runs */
    here<T>(fn: () => T): T { if (!o.ghost) return fn(); game.teleportPlayer(R.stand); try { return fn(); } finally { game.teleportPlayer(PARK); } },
    doorT(name: string) { const d = R.door(name); return { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, R.stand) }; },
    give(id: string, name: string, who: any = 'all', opts?: { onWord?: boolean }): string | null { return R.here(() => O.give(id, R.doorT(name), who, opts)); },
    get fratricide(): string[] { return R.downs.filter(x => x.who.team === 'operative' && (x.by?.team === 'operative' || x.who.killerId === game.player.char.id)).map(x => `${x.who.callsign} by ${x.by?.callsign ?? 'Sam'}`); },
  };
  if (o.empty) NB.hostiles.forEach((h: any, i: number) => { h.char.pos[0] = 8 + i * 0.9; h.char.pos[2] = 1.6; h.hold = true; h.pinned = true; });
  if (o.ghost) game.teleportPlayer(PARK);
  R.step(30);
  return R;
}
const minApart = (men: any[]) => { let m = Infinity; for (let a = 0; a < men.length; a++) for (let b = a + 1; b < men.length; b++) m = Math.min(m, dist(men[a].char?.pos ?? men[a], men[b].char?.pos ?? men[b])); return m; };
/** a floor point's distance to a prop's footprint where it RESTS, in the prop's own yawed frame (roomclear.ts propGap, which is not exported; 0 = inside it) */
const propGap = (q: any, p: number[]) => { const dx = p[0] - q.home[0], dz = p[2] - q.home[1], c = Math.cos(q.home[2] ?? 0), sn = Math.sin(q.home[2] ?? 0); return Math.hypot(Math.max(0, Math.abs(c * dx - sn * dz) - q.hx), Math.max(0, Math.abs(sn * dx + c * dz) - q.hz)); };
/** a sight / body line against the level's STATICS alone (the leaves taken out for the one call) */
function statics<T>(g: any, fn: () => T): T { const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = []; try { return fn(); } finally { g.col.dynamicBoxes = leaves; } }

// ---------------------------------------------------------------- the hand placement and its lines
/** THE HAND PLACEMENT as tools/levels/depot.ts writes it (x, z): each held room's first `garrison` marks, in the file's order — five men */
const HAND: Record<string, number[][]> = { crew: [[14.7, 4.9]], comms: [[24.5, 11.9], [28.9, 12.8]], store: [[21.05, 19.45], [20.15, 19.45]] };
const WATCHER_NAMES: Record<string, string[]> = { crew: ['the crew room man'], comms: ['the west slit', 'the east slit'], store: ['the hatch, east end', 'the hatch, west end'] };
interface Watcher { name: string; room: string; pos: number[]; look: number[] }
/** the five, read off the FILE's structure (not off HAND: depot-stage holds the two together): where each stands and the way he faces (pos → aimAt, in plan).
 *  DEPOT_BREAK=1 = each read off the middle of his room's floor instead, facing as written: the lines out of the slits and the hatch must fail, and
 *  depot-stage's hand placement with them. */
const BREAK = process.env.DEPOT_BREAK === '1';
function watchers(): Watcher[] {
  const out: Watcher[] = [];
  for (const r of depotStructure().rooms) r.marks.slice(0, r.garrison).forEach((m: any, i: number) => {
    const pos = BREAK ? [(r.bounds.x0 + r.bounds.x1) / 2, 0, (r.bounds.z0 + r.bounds.z1) / 2] : [m.pos[0], 0, m.pos[2]];
    const dx = m.aimAt[0] - m.pos[0], dz = m.aimAt[2] - m.pos[2], L = Math.hypot(dx, dz) || 1;
    out.push({ name: WATCHER_NAMES[r.id]?.[i] ?? `${r.name} ${i + 1}`, room: r.id, pos, look: [dx / L, 0, dz / L] }); });
  return out;
}
/** THE sight test, the game's own (guards.ts eyeContact: the eye's reach and cone, then his chest and his head against whatever is solid — statics and the
 *  leaves as they stand): a standing eye at `from` on a man standing at `to`. `look` = the way the eye faces (a unit vector in plan); none = turned to face him */
function sees(g: any, from: number[], to: number[], look?: number[]): boolean {
  const dx = to[0] - from[0], dz = to[2] - from[2], L = Math.hypot(dx, dz) || 1;
  const E = { pos: [from[0], 1.6, from[2]], look: look ?? [dx / L, 0, dz / L], range: GUARD_EYE.range, halfDeg: GUARD_EYE.halfDeg, nearM: GUARD_EYE.nearM, nearDeg: GUARD_EYE.nearDeg };
  return eyeContact(g, E, { pos: [to[0], 0, to[2]], bones: {}, alive: true }, false, false, 1).visible;
}
/** a walk on the guards' own grid through `via` in turn, as points a quarter of a metre apart at most (a string = the leg it has no way for) */
function walkOf(g: any, via: number[][]): number[][] | string {
  const pts: number[][] = [];
  for (let k = 1; k < via.length; k++) { const leg = g.col.nav.findPath(via[k - 1], via[k]); if (!leg) return `no way on foot ${at(via[k - 1])} → ${at(via[k])}`;
    const line = [via[k - 1], ...leg, via[k]];
    for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i], n = Math.max(1, Math.ceil(dist(a, b) / 0.25)); for (let s = 0; s < n; s++) pts.push([a[0] + (b[0] - a[0]) * s / n, 0, a[2] + (b[2] - a[2]) * s / n]); } }
  pts.push([...via[via.length - 1]]); return pts;
}
/** the metres of a sampled walk whose samples `pick` takes: each sample stands for the stretch to the next one */
const metresOf = (path: number[][], pick: (p: number[]) => boolean = () => true): number => path.reduce((m, p, i) => m + (i + 1 < path.length && pick(p) ? dist(p, path[i + 1]) : 0), 0);
/** is there a way on foot from `a` to `b` inside `B` over floor `seen` says no (a quarter-metre lattice of the walk grid's free cells, stepped four ways)? */
function unseenWay(g: any, B: Rect, a: number[], b: number[], seen: (p: number[]) => boolean): boolean {
  const S = 0.25, nx = Math.ceil((B.x1 - B.x0) / S), nz = Math.ceil((B.z1 - B.z0) / S), pt = (i: number, j: number) => [B.x0 + (i + 0.5) * S, 0, B.z0 + (j + 0.5) * S];
  const cell = (p: number[]) => [Math.min(nx - 1, Math.max(0, Math.floor((p[0] - B.x0) / S))), Math.min(nz - 1, Math.max(0, Math.floor((p[2] - B.z0) / S)))];
  const free = (i: number, j: number) => { const p = pt(i, j); return !g.col.nav.isBlocked(p[0], p[2]) && !seen(p); };
  const [ai, aj] = cell(a), [bi, bj] = cell(b), done = new Set<number>([ai + nx * aj]), todo = [[ai, aj]];
  while (todo.length) { const [i, j] = todo.pop()!; if (Math.abs(i - bi) <= 1 && Math.abs(j - bj) <= 1) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = i + di, v = j + dj; if (u < 0 || v < 0 || u >= nx || v >= nz || done.has(u + nx * v)) continue; done.add(u + nx * v); if (free(u, v)) todo.push([u, v]); } }
  return false;
}
/** how lit a standing man reads at a floor point, 0‥1, by the headless stand-in of the light meter (direct light, no moon, no bounce), mapped as Sam's meter is */
const litAt = (g: any, p: number[]): number => g.visibilityOf(Math.max(lightEstimateAt(g, [p[0], 1.2, p[2]]), lightEstimateAt(g, [p[0], 1.6, p[2]])));

// ---------------------------------------------------------------- level
export const depotLevelFile = guarded(async () => {
  const { verdict, done } = family('depot-level: the file is the generator\'s level, clean, and inside the renderer\'s sizes');
  const text = depotText(); const data = JSON.parse(text);
  const errs: string[] = validateLevelData(data);
  verdict(errs.length === 0, 'the level validator is clean on levels/depot.json', errs.length ? errs.slice(0, 6).join(' · ') : `0 errors · ${data.boxes.length} boxes · ${data.props.length} props · ${data.doors.length} doors`);
  if (errs.length) return done();   // (nothing below can load it)
  const lint = lintLevel(data, {}), named = lint.findings.filter((x: any) => x.severity !== 'info').slice(0, 4).map((x: any) => `${x.severity} ${x.code}: ${x.message}${x.ids?.length ? ` [${x.ids.slice(0, 3).join(', ')}]` : ''}`);
  verdict(lint.errors === 0 && lint.warnings === 0, 'level-lint is clean on it (no errors, no warnings): spawn → objectives → exit reachable on the nav grid, every door walkable both sides, no overlapping statics', `${lint.errors} errors · ${lint.warnings} warnings${named.length ? ' · ' + named.join(' · ') : ''}`);
  const { level: gen, scenarios, groups } = buildDepot(); gen.scenarios = scenarios; { const DS = await import('../../src/scene/doorSize.ts'); DS.fitDoors(gen.doors); DS.fitWaysOut(gen, scenarios?.quiet); }   // (as tools/levels/export.ts writes it: the leaves and the ways out fitted to the real doors)
  { const FL = await import('../levels/flatLayers.ts'), LV = await import('../../src/scene/lived.ts'); FL.layGeneratedFloor(gen.boxes, groups, LV.isLived, BoxFlag); }   // (… and its floor swept into order, as the export sweeps it before it writes: flatLayers.ts)
  // (the export's DRESSING — tools/levels/dress.ts, the file's last boxes — is not the generator's: the loader leaves it out with the destruction switch off, as
  //  the frozen stand has it, so the switch is lowered for this one load on the shipped stand too. `export.ts depot --check` holds the dressed file)
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`), wasOn = DESTRUCTION.on; let bare: any;
  try { DESTRUCTION.on = false; bare = loadLevel(parseLevelData(text), { lived: true }); } finally { DESTRUCTION.on = wasOn; }   // (the generator builds the lived-in rooms' furniture: src/scene/lived.ts)
  const diffs: string[] = []; const n = structuralDiff(gen, bare, diffs);
  verdict(n === 0, 'the file reloads to the generator\'s Level field for field (not stale: tools/levels/export.ts depot --check)', n ? `${n} diffs · ${diffs.slice(0, 4).join(' · ')}` : '0 diffs');
  const L = depotLevel(); const glass = L.boxes.filter((b: any) => b.flags & BoxFlag.Glass).length;
  const out = L.boxes.filter((b: any) => { const y = b.yaw ?? 0, c = Math.abs(Math.cos(y)), sn = Math.abs(Math.sin(y)), hx = b.h[0] * c + b.h[2] * sn, hz = b.h[0] * sn + b.h[2] * c;   // (a yawed box's own footprint)
    return b.c[0] - hx < WORLD.min[0] - 1e-6 || b.c[0] + hx > WORLD.max[0] + 1e-6 || b.c[2] - hz < WORLD.min[2] - 1e-6 || b.c[2] + hz > WORLD.max[2] + 1e-6 || b.c[1] + b.h[1] > WORLD.max[1] + 1e-6 || b.c[1] - b.h[1] < WORLD.min[1] - 1e-6; }).length;
  verdict(out === 0 && glass <= MAX_GLASS && L.boxes.length <= WORLD.maxBoxes, 'inside the fixed sizes: every box in the 40 × 28 × 8 m world, panes ≤ 32, boxes ≤ 4096', `${out} boxes outside · ${glass} panes · ${L.boxes.length} boxes (the office: 782)`);
  const kit = new Set(['boxes', 'props', 'lights', 'switchables', 'doors', 'devices', 'breaker', 'beacons', 'playerSpawn', 'routes', 'chokepoints', 'clearPlans', 'sky', 'mission', 'scenarios']);
  const extra = Object.keys(L).filter(k => !kit.has(k));
  const scn = Object.keys(L.scenarios ?? {}), scnExtra = scn.filter(k => k !== 'roomClear' && k !== 'places' && k !== 'kitView');   // (places: the level's own names for its floor, read by the radio lines and the debrief — words, no new machinery; kitView: where the Team & kit picture stands the team — the start page's, nothing the level plays)
  verdict(extra.length === 0 && L.routes.length === 0 && L.devices.length === 0 && scn.includes('roomClear') && scnExtra.length === 0, 'only the old level kit: boxes, props, lights, switchables, doors, and the scenarios block (the room clear, and the level\'s own place names) — no routes, devices, vents, civilians, breach plan or script', extra.length ? `also: ${extra.join(', ')}` : scnExtra.length ? `scenarios also holds: ${scnExtra.join(', ')}` : `keys ${Object.keys(L).join(', ')} · scenarios ${scn.join(', ')}`);
  // the floor's own facts, off the file
  const DOORS = ['a_s', 'a_e', 'b_n', 'c_n', 'c_w', 'duty', 'wash_to_battery', 'battery_to_yard', 'battery_to_generator', 'generator_to_park', 'bay_to_yard', 'tyres_to_bay', 'back_gate'];
  const have: string[] = L.doors.map((d: any) => d.name), missing = DOORS.filter(n => !have.includes(n)), unknown = have.filter(n => !DOORS.includes(n));
  verdict(have.length === 13 && !missing.length && !unknown.length, 'thirteen doors, by name, and no other: no gate in the north wall, and none on the main gate (it is an opening)', `${have.join(' ')}${missing.length ? ` · missing ${missing.join(', ')}` : ''}${unknown.length ? ` · not the depot's: ${unknown.join(', ')}` : ''}`);
  const S = L.scenarios.roomClear, hutRoom = S.rooms.find((r: any) => r.id === 'comms'), B = DEPOT_ROOMS.b;
  const mid = (d: any) => [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, 0, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2];
  const onHut: string[] = L.doors.filter((d: any) => inBounds(B, mid(d), 0.4) && !inBounds(B, mid(d), -0.4)).map((d: any) => d.name);
  verdict(onHut.join() === 'b_n' && hutRoom?.doors.map((d: any) => d.id).join() === 'b_n', 'the signals hut (comms) has exactly ONE door, b_n: the only leaf on its walls, and the only door its room names', `leaves on the hut's walls: ${onHut.join(', ') || 'none'} · the structure's: ${hutRoom?.doors.map((d: any) => `${d.id} (from ${d.from})`).join(', ') ?? 'NO ROOM comms'}`);
  const floods = L.lights.filter((l: any) => /^flood_/.test(l.name)), fed = floods.filter((l: any) => l.mains !== false), bp = L.breaker.pos;
  verdict(inBounds(DEPOT_ROOMS.generator, bp) && floods.length === 3 && fed.length === 3, 'the mains panel is INSIDE the generator room, behind the signals hut, and the three floodlights are on the mains', `breaker ${at(bp)} · generator room x ${DEPOT_ROOMS.generator.x0}‥${DEPOT_ROOMS.generator.x1}, z ${DEPOT_ROOMS.generator.z0}‥${DEPOT_ROOMS.generator.z1} · floodlights ${floods.map((l: any) => `${l.name}${l.mains !== false ? '' : ' (NOT on the mains)'}`).join(', ') || 'none'} · off the mains: ${L.lights.filter((l: any) => l.mains === false).map((l: any) => l.name).join(', ') || 'nothing'}`);
  const gateE = L.doors.find((d: any) => d.name === 'back_gate'), second = S.starts?.[0], wall = { x0: 4, x1: 36, z0: 4, z1: 24 };
  verdict(!!second && !!gateE && S.starts.length >= 1 && !inBounds(wall, second.sam) && second.sam[0] > wall.x1 && dist(second.sam, mid(gateE)) < 4 && second.ops?.length === 4 && S.team.sam[0] < wall.x0, 'a second way in: the structure\'s own start is outside the main gate (west), and starts[0] stands outside the back gate, in the east wall', second && gateE ? `team ${at(S.team.sam)} · starts[0] ${at(second.sam)}, ${f1(dist(second.sam, mid(gateE)))} m from the back gate ${at(mid(gateE))}, ${second.ops?.length ?? 0} teammates' marks` : 'no starts[0] or no back_gate');
  return done();
});

// ---------------------------------------------------------------- stage
export const depotStage = guarded(async () => {
  const { verdict, done } = family('depot-stage: the four squad boots on the depot, on the hand placement');
  const R = await rig(0, 'depot'); const { game: g, NB, RC } = R; const ops = NB.ops, hs = NB.hostiles, sam = g.player.char, S = depotStructure();
  const bad: string[] = checkStructure(g);
  verdict(bad.length === 0, 'the depot\'s structure is sound against the level (doors exist, marks on free floor in their rooms, clear of furniture, each with a line to the door it watches; both starts on floor with a way on foot into every room)', bad.length ? bad.join(' · ') : `${S.rooms.map((r: any) => `${r.name}: ${r.doors.length} door${r.doors.length === 1 ? '' : 's'}, ${r.garrison} m${r.garrison === 1 ? 'a' : 'e'}n`).join(' · ')}`);
  verdict(R.why === null && ops.length === 4 && names(ops) === 'Red One, Red Two, Blue One, Blue Two' && ops.every((x: any) => x.state !== 'dead' && x.team === 'operative'), 'the room clear starts with FOUR teammates on the floor', `start → ${R.why} · ${ops.map((x: any) => `${x.callsign} ${at(x.char.pos)}`).join(' · ')} · Sam ${at(sam.pos)}`);
  // the hand placement: seed 0 stands each room's men on its first `garrison` marks, and those are the marks the generator's head says
  const want = Object.entries(HAND).flatMap(([room, l]) => l.map(p => ({ room, p: [p[0], 0, p[1]] })));
  const fileSays = watchers(), onFile = fileSays.length === want.length && want.every((w, i) => fileSays[i].room === w.room && dist(fileSays[i].pos, w.p) < 0.01);
  const stood = want.map(w => { const rm = RC.rooms.find((q: any) => q.def.id === w.room); return rm ? Math.min(...rm.defenders.map((h: any) => dist(h.char.pos, w.p))) : Infinity; });
  verdict(hs.length === 5 && RC.rooms.map((r: any) => `${r.def.id} ${r.defenders.length}`).join() === 'crew 1,comms 2,store 2' && onFile && stood.every(d => d < 0.3), 'seed 0 is the HAND PLACEMENT — five men: the crew room\'s one in its north-east corner, the hut\'s two at its west and east slits, the store\'s two at the hatch — each room\'s first `garrison` marks in the file', `${RC.summary()} · ${want.map((w, i) => `${w.room} ${at(w.p)}: a man ${f2(stood[i])} m off it`).join(' · ')}${onFile ? '' : ' · THE FILE\'S FIRST MARKS ARE NOT THESE'}`);
  const all = [sam, ...ops.map((x: any) => x.char), ...hs.map((x: any) => x.char)];
  const onFloor = all.every((c: any) => !g.col.nav.isBlocked(c.pos[0], c.pos[2])), start = dist(sam.pos, S.team.sam) < 0.5 && ops.every((x: any, i: number) => dist(x.char.pos, S.team.ops[i]) < 0.5 && x.char.pos[0] < 4);
  verdict(onFloor && minApart(all.map((c: any) => c.pos)) > 0.6 && start, 'everybody on floor a man can stand on, nobody in anybody; the team starts on the structure\'s marks, outside the main gate', `nearest two ${f2(minApart(all.map((c: any) => c.pos)))} m · on floor ${onFloor} · on the start's marks ${start}`);
  const chars = 1 + g.guards.length, lights = g.engine?.lights?.lights?.length ?? R.W.engine.lights.lights.length;
  verdict(chars === 10 && chars <= SQUAD4_BUDGET && chars <= MAX_CHARS && lights <= MAX_LIGHTS, 'ten characters (the four squad\'s budget), and the steady lights fit', `${chars} characters (budget ${SQUAD4_BUDGET}, skinned ${MAX_CHARS}) · ${lights} of ${MAX_LIGHTS} lights`);
  // both starts, every man's mark, against every watcher turned to face it — statics alone (a leaf left open hides nobody)
  { const rows: string[] = []; let seen = 0;
    for (const [k, T] of [S.team, ...(S.starts ?? [])].entries()) { let lines = 0, near = Infinity, inSight = 0;
      for (const w of fileSays) for (const p of [T.sam, ...T.ops]) { near = Math.min(near, dist(w.pos, p));
        if (statics(g, () => !g.col.segmentBlocked([w.pos[0], 1.6, w.pos[2]], [p[0], 1.1, p[2]]))) lines++; if (statics(g, () => sees(g, w.pos, p))) inSight++; }
      seen += inSight; rows.push(`${k ? `starts[${k - 1}]` : 'team'} at ${at(T.sam)}: ${inSight} of ${fileSays.length * (1 + T.ops.length)} man-to-mark pairs in sight · ${lines} bare lines, the nearest watcher ${f1(near)} m off (an eye reaches ${GUARD_EYE.range} m)`); }
    verdict(seen === 0 && (S.starts?.length ?? 0) >= 1, 'BOTH starts stand out of every watcher\'s sight: behind a wall, or beyond his eye\'s reach — whichever way he turns, every door open', rows.join('\n    ')); }
  const r0 = R.rounds; R.step(600);
  verdict(R.rounds === r0 && R.downs.length === 0 && RC.state === 'live', 'ten idle seconds at the start pass without a round', `${R.rounds - r0} rounds · ${R.downs.length} down · ${RC.state}`);
  // the light: the yard is the floodlights', the floodlights are the mains' (the headless meter: direct light only — the picture is not asked)
  { const a_s = R.door('a_s'), YARD: [string, number[]][] = [['outside the crew room\'s yard door', a_s ? doorPoint(a_s, outsideOf(a_s, DEPOT_ROOMS.a), 1.0) : [12.4, 0, 10.5]], ['mid yard', [16.0, 0, 13.0]], ['the mouth', [25.8, 0, 16.8]], ['the open park', [33.8, 0, 9.0]]];
    const DARK: [string, number[]][] = fileSays.filter(w => w.room !== 'crew').map((w): [string, number[]] => [w.name, w.pos]);
    // (printed, not judged: where the team stands. Sam's own mark is in the main gate's line, 21 m down the west floodlight's throw, and reads half lit here)
    const STARTS: [string, number[]][] = [S.team, ...(S.starts ?? [])].flatMap((T: any, k: number) => [T.sam, ...T.ops].map((p: number[], i: number): [string, number[]] => [`${k ? `starts[${k - 1}]` : 'team'} ${i ? `mark ${i}` : 'Sam'}`, p]));
    // (the back door's walk: the lane between the signals shelter and the east wall is in the shelter's shadow from the park's floodlight — held DARKER than
    //  the open park, not to a number; the generator room's park door's step is printed)
    const gp = R.door('generator_to_park'), WALKIN: [string, number[]][] = [['the lane behind the shelter', [35.0, 0, 12.5]], ['the generator room\'s park door, its step', gp ? doorPoint(gp, outsideOf(gp, DEPOT_ROOMS.generator), 0.9) : [30.4, 0, 6.9]]];
    const read = (l: [string, number[]][]) => l.map(([n, p]) => ({ n, v: litAt(g, p) })), row = (l: { n: string; v: number }[]) => l.map(x => `${x.n} ${f2(x.v)}`).join(' · ');
    const onFloor = [...YARD, ...WALKIN].every(([, p]) => !g.col.nav.isBlocked(p[0], p[2]));   // (a sample inside a box reads whatever lights the box)
    const litY = read(YARD), litD = read(DARK), litS = read(STARTS), litW = read(WALKIN);
    verdict(onFloor && litY.every(x => x.v > LIT) && litD.every(x => x.v < DIM) && litW[0].v < litY[3].v, `mains on: the ground reads over ${LIT} — the stack ground at the crew room's door, mid yard, the mouth, the open park — the men at the slits and the hatch under ${DIM}, and the lane behind the shelter darker than the open park; every sample on floor a man can stand on`, `${row(litY)} · ${row(litD)}\n    the back door's walk: ${row(litW)} · on floor ${onFloor}\n    the starts (not judged): ${row(litS)}`);
    // (the PLACE's light is what is judged, carried lights left out: under the dark rule a man at a slit who notices the mains go burns his gun lamp across the
    //  ground he watches — his light, not the yard's. What the ground reads with the lamps in is printed beside it.)
    g.setBlackout(86400, 'hand'); R.step(240);
    const place = (l: [string, number[]][]) => l.map(([n, p]) => ({ n, v: g.visibilityOf(Math.max(lightEstimateAt(g, [p[0], 1.2, p[2]], () => true), lightEstimateAt(g, [p[0], 1.6, p[2]], () => true))) }));
    const outY = place(YARD), outD = place(DARK);
    verdict(g.blackout.active && [...outY, ...outD].every(x => x.v < DIM), `mains out (the panel thrown): by the place's own light the yard's ground and the watchers' marks all read under ${DIM}`, `${row(outY)} · ${row(outD)}\n    with whatever the men carry lit (printed, not judged): ${row(read(YARD))}`); }
  // the other way in stages too
  { const Q = await rig(0, 'depot', { clear: { way: 2 } }), T = S.starts?.[0], qs = Q.game.player.char;   // (the knob counts the ways from 1: 2 = starts[0])
    const fine = !!T && Q.why === null && Q.RC.way === 1 && dist(qs.pos, T.sam) < 0.5 && Q.ops.length === 4 && Q.ops.every((x: any, i: number) => dist(x.char.pos, T.ops[i]) < 0.5 && x.char.pos[0] > 36) && Q.hostiles.length === 5;
    verdict(fine, 'the second way in (ROOMCLEAR.way 2) stages the same five against a team stood outside the back gate', T ? `start → ${Q.why} · way ${Q.RC.way} · Sam ${at(qs.pos)} (the mark ${at(T.sam)}) · ${Q.ops.map((x: any) => at(x.char.pos)).join(' ')}` : 'the structure has no starts'); }
  // every seed deals a sound placement
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8]; let ok = 0; const rows: string[] = [];
  for (const s of seeds) { const Q = await rig(s, 'depot'); const hh = Q.NB.hostiles; const fine = Q.why === null && hh.length === 5 && Q.ops.length === 4 && minApart(hh) > 0.8 && hh.every((h: any) => !Q.game.col.nav.isBlocked(h.char.pos[0], h.char.pos[2])); if (fine) ok++; rows.push(`${s}: ${hh.map((h: any) => at(h.char.pos)).join(' ')}${fine ? '' : '  ← bad'}`); }
  verdict(ok === seeds.length, 'eight more seeds: each stages four teammates and five defenders on marks of their rooms, no two defenders within 0.8 m (the hatch\'s two stand 0.9 m apart)', rows.join('\n    '));
  return done();
});
/** the headless meter's bounds. Read on both stands, seed 0: the yard's four places 0.90‥1.00 with the mains on, the slits and the hatch 0.00; all 0.00 with them out */
const LIT = 0.5, DIM = 0.25;

// ---------------------------------------------------------------- doors
/** the clear floor along the wall beside a door, on `side`, past the hinge jamb (dir −1) or the latch jamb (dir +1): how far a man 0.55 m off the wall can
 *  stand, in 0.1 m steps, before a static, a prop at rest or the nav grid's wall stops him (capped at 6 m) */
function wallRun(g: any, d: any, side: number, dir: 1 | -1): number {
  const start = dir > 0 ? d.def.width : 0; let run = 0;
  for (let u = 0.3; u <= 6; u += 0.1) { const p = doorPoint(d, side, ORDERS.jambOut, start + dir * u);
    if (g.col.nav.isBlocked(p[0], p[2])) break;
    if (g.props.props.some((q: any) => propGap(q, p) < 0.42)) break;
    if (statics(g, () => g.col.solidBlocked(doorPoint(d, side, ORDERS.jambOut, start + dir * (u - 0.1)).map((v, i) => i === 1 ? 0.9 : v), [p[0], 0.9, p[2]]))) break;
    run = u; }
  return run;
}
export const depotDoors = guarded(async () => {
  const { verdict, done } = family('depot-doors: stack room for a pair, and for four, on every door');
  const measure = async (S: { rooms: any[] }) => {
    const R = await rig(5, 'depot', { quiet: true, empty: true }); const { game: g, O, D, NB } = R; const men = NB.ops; const rows: string[] = []; let ok = true, sides = 0; const runs: number[] = [], depths: number[] = [];
    for (const room of S.rooms) for (const { id } of room.doors) { const d = R.door(id); if (!d) continue; const side = outsideOf(d, room.bounds);
      const four = D.stackPosts(d, side, men), pair = D.stackPosts(d, side, men.slice(0, 2)); sides++;
      const good = (posts: any[] | null, n: number) => !!posts && posts.length === n && minApart(posts.map((p: any) => p.pos)) > 0.7 && posts.every((p: any) => !g.col.nav.isBlocked(p.pos[0], p.pos[2]) && !inDoorway(d, p.pos) && !inBounds(room.bounds, p.pos)
        && !g.props.props.some((q: any) => propGap(q, p.pos) < 0.3));
      const hinge = wallRun(g, d, side, -1), latch = wallRun(g, d, side, 1), best = Math.max(hinge, latch); runs.push(best);
      let depth = 0; for (let u = 0.5; u <= 14; u += 0.25) { const q = doorPoint(d, -side, u); if (g.col.nav.isBlocked(q[0], q[2])) break; depth = u; } depths.push(depth);   // (floor straight in from the frame: a file of four is 4.6 m long)
      const fine = good(pair, 2) && good(four, 4); if (!fine) ok = false;
      rows.push(`${room.name} · ${id} (from ${room.doors.find((x: any) => x.id === id).from}): pair ${pair ? pair.map((p: any) => at(p.pos)).join(' ') : 'NO ROOM'} · four ${four ? four.map((p: any) => at(p.pos)).join(' ') : 'NO ROOM'} · clear floor along the wall hinge ${f1(hinge)} m / latch ${f1(latch)} m · ${f1(depth)} m of floor straight in (to 14)${fine ? '' : '  ← short'}`); }
    return { R, rows, ok, sides, runs, depths };
  };
  const dep = await measure(depotStructure());
  verdict(dep.ok, 'every door of the depot\'s three held rooms (a_s, a_e, b_n, c_n, c_w), from the side it is taken from: a pair\'s two marks AND four marks, on free floor, apart, out of the opening, outside the room, clear of furniture', dep.rows.join('\n    '));
  // (judged on the yard's two — where the obvious plan stacks; the indoor three are in small rooms, a_e's wash room is 3.4 m wide, and their four marks above are the fact)
  const ids = depotStructure().rooms.flatMap((r: any) => r.doors.map((d: any) => d.id as string)), yard = ['a_s', 'c_n'];
  verdict(yard.every(id => dep.runs[ids.indexOf(id)] >= 1.9), 'beside each of the two yard doors (a_s, c_n) at least one jamb has 1.9 m of clear floor along the wall line (a file of two 0.55 m off the wall, 0.9 m apart, and room to turn); the indoor doors\' are printed', `best jamb per door side: ${ids.map((id: string, i: number) => `${id} ${f1(dep.runs[i])}`).join(' / ')} m`);
  // live: the four onto every door in turn
  { const { R } = dep; const { game: g, O } = R; const men = R.ops; const rows: string[] = []; let all = true;
    // (each stand is the commander's side of its door and more than a file's length — 4.6 m — past any door the four walk through to reach it from the stand
    //  before: a file halted nearer than that leaves its tail standing in the doorway it came through, which is the follow's business and depot-walk's count)
    const STAND: Record<string, number[]> = { a_s: [12.4, 0, 14.6], c_n: [22.9, 0, 14.4], c_w: [13.2, 0, 20.9], b_n: [26.9, 0, 6.6], a_e: [17.3, 0, 7.2] };
    for (const [id, stand] of Object.entries(STAND)) { const d = R.door(id);
      g.teleportPlayer(stand); R.stand = stand; R.step(3); O.give('fallIn', O.targetAt(g.player.char.pos)); R.until(() => men.every((m: any) => O.of(m)?.arrived), 40); R.step(30);
      R.until(() => g.doors.list.every((x: any) => x.latched), 10);   // (the leaves the file walked through swing shut behind it: a stack is called on a shut door)
      const why = R.give('stack', id); const set = R.until(() => men.every((m: any) => O.of(m)?.arrived), 30); R.step(60);
      const off = men.map((m: any) => dist(m.char.pos, O.of(m)?.post ?? [0, 0, 0])), fine = why === null && set && off.every((x: number) => x < 0.45) && minApart(men) > 0.6 && !men.some((m: any) => inDoorway(d, m.char.pos)) && men.every((m: any) => offOf(d, m.char.pos) * sideOf(d, stand) > 0);
      if (!fine) all = false; rows.push(`${id}: give → ${why} · set ${set} · ${men.map((m: any, i: number) => `${at(m.char.pos)} (${f2(off[i])} off)`).join(' ')} · nearest two ${f2(minApart(men))} m${fine ? '' : '  ← FAIL'}`); }
    verdict(all, 'live: the four ordered to stack on each of the five doors in turn get onto their own marks — nobody in the opening, nobody in anybody, everybody on the commander\'s side', rows.join('\n    ')); }
  return done();
});

// ---------------------------------------------------------------- openings
interface Opening { wall: 'n' | 's' | 'w' | 'e'; a: number; b: number; kind: 'walk' | 'window'; leaf: string | null; mid: number[]; inward: number[] }
/** The openings of a rectangular room, read off its walls: 5 cm samples along each wall, a short line across the wall at each (0.3 m inside the inner face to
 *  0.5 m beyond it) against the statics — clear at shin and chest height = a way through on foot; blocked for a body but clear for the eye at 1.5 m = a window. */
function openingsOf(g: any, B: Rect): Opening[] {
  const out: Opening[] = [];
  const walls: { wall: Opening['wall']; lo: number; hi: number; pt: (u: number, d: number) => number[]; inward: number[] }[] = [
    { wall: 'n', lo: B.x0, hi: B.x1, pt: (u, d) => [u, 0, B.z0 + d], inward: [0, 1] }, { wall: 's', lo: B.x0, hi: B.x1, pt: (u, d) => [u, 0, B.z1 - d], inward: [0, -1] },
    { wall: 'w', lo: B.z0, hi: B.z1, pt: (u, d) => [B.x0 + d, 0, u], inward: [1, 0] }, { wall: 'e', lo: B.z0, hi: B.z1, pt: (u, d) => [B.x1 - d, 0, u], inward: [-1, 0] } ];
  statics(g, () => { for (const w of walls) { let run: { a: number; kind: Opening['kind'] } | null = null;
    const close = (b: number) => { if (run && b - run.a >= 0.5) { const m = (run.a + b) / 2, mid = w.pt(m, 0); const leaf = g.doors.list.find((d: any) => dist(d.frameCentre, mid) < 0.8); out.push({ wall: w.wall, a: run.a, b, kind: run.kind, leaf: leaf?.def.name ?? null, mid, inward: w.inward }); } run = null; };
    for (let u = w.lo + 0.025; u < w.hi; u += 0.05) { const i = w.pt(u, 0.3), o = w.pt(u, -0.5), y = (p: number[], h: number) => [p[0], h, p[2]];
      const walk = !g.col.solidBlocked(y(i, 0.4), y(o, 0.4)) && !g.col.solidBlocked(y(i, 1.2), y(o, 1.2)), see = walk || !g.col.segmentBlocked(y(i, 1.5), y(o, 1.5));
      const kind: Opening['kind'] | null = walk ? 'walk' : see ? 'window' : null;
      if (run && run.kind !== kind) close(u - 0.025); if (!run && kind) run = { a: u - 0.025, kind }; }
    close(w.hi); } });
  return out;
}
/** the floor of a room as sample points (a 0.25 m lattice on cells a man can stand on) */
function floorOf(g: any, B: Rect): number[][] { const pts: number[][] = []; for (let x = B.x0 + 0.2; x < B.x1 - 0.1; x += 0.25) for (let z = B.z0 + 0.2; z < B.z1 - 0.1; z += 0.25) if (!g.col.nav.isBlocked(x, z)) pts.push([x, 0, z]); return pts; }
/** which of the floor's points a PAIR standing just inside an opening sees: two heads 1.2 m in, 0.5 m either side of its middle (clamped inside the room), eye
 *  1.6 m to a standing man's chest 1.1 m, statics only */
function seenFrom(g: any, B: Rect, o: Opening, floor: number[][]): boolean[] {
  const al = [o.inward[1], -o.inward[0]]; const eyes = [-0.5, 0.5].map(k => [Math.min(B.x1 - 0.3, Math.max(B.x0 + 0.3, o.mid[0] + o.inward[0] * 1.2 + al[0] * k)), 1.6, Math.min(B.z1 - 0.3, Math.max(B.z0 + 0.3, o.mid[2] + o.inward[1] * 1.2 + al[1] * k))]);
  return statics(g, () => floor.map(p => eyes.some(e => !g.col.segmentBlocked(e, [p[0], 1.1, p[2]]))));
}
function roomSight(g: any, B: Rect) {
  const ops = openingsOf(g, B), walks = ops.filter(o => o.kind === 'walk'), floor = floorOf(g, B), seen = walks.map(o => seenFrom(g, B, o, floor));
  const pct = (m: boolean[]) => 100 * m.filter(Boolean).length / Math.max(1, floor.length);
  return { ops, walks, windows: ops.filter(o => o.kind === 'window'), floor: floor.length, each: seen.map(pct), area: floor.length * 0.0625 };
}
export const depotOpenings = guarded(async () => {
  const { verdict, done } = family('depot-openings: one door on the hut, the slits and the hatch on the lit doors, and the dead ground');
  const table = (g: any, rooms: Record<string, Rect>) => Object.entries(rooms).map(([name, B]) => ({ name, B, ...roomSight(g, B) }));
  const row = (r: any) => `${r.name}: ${r.walks.length} way${r.walks.length === 1 ? '' : 's'} in on foot (${r.walks.map((o: Opening) => `${o.leaf ?? 'OPEN'} ${f1(o.b - o.a)} m`).join(', ')})${r.windows.length ? ` + ${r.windows.length} window bay${r.windows.length > 1 ? 's' : ''} (${r.windows.map((o: Opening) => `${o.wall} ${f1(o.b - o.a)} m`).join(', ')})` : ''} · ${f1(r.area)} m² of floor · a pair inside one door sees ${r.each.map((p: number) => p.toFixed(0)).join(' / ')} %`;
  const R = await rig(0, 'depot', { quiet: true }), g = R.game, D = R.D, dep = table(g, DEPOT_NAMED), [crew, hut, store] = dep;
  const leaves = (r: any) => r.walks.map((o: Opening) => o.leaf ?? 'OPEN').sort().join(), wins = (r: any) => r.windows.map((o: Opening) => o.wall).sort().join();
  verdict(leaves(hut) === 'b_n' && wins(hut) === 'e,s,w', 'the signals hut, read off its walls: ONE way in on foot — b_n, in its north wall — and three windows with no glass, west, east and south', row(hut));
  verdict(leaves(crew) === 'a_e,a_s' && wins(crew) === '' && leaves(store) === 'c_n,c_w' && wins(store) === 'n', 'the crew room has its two doors and no window; the store its two doors and the hatch in its yard wall', `${row(crew)}\n    ${row(store)}`);

  // THE LINES. Each man on his mark, facing as the file writes him (pos → aimAt), the leaves as the level stands them (every door shut)
  const W = watchers(), who = (n: string) => W.find(w => w.name === n)!, [crewMan, west, east, hatchE, hatchW] = W;
  const R_A = DEPOT_ROOMS.a, outside = (d: any, room: Rect) => outsideOf(d, room);
  /** the ground a stack on a door stands on, from `side`: the doorstep a metre out, and the four's own marks there */
  const stackGround = (name: string, side: 1 | -1): number[][] => { const d = R.door(name), posts = D.stackPosts(d, side, R.ops); return [doorPoint(d, side, 1.0), ...(posts ?? []).map((p: any) => [p.pos[0], 0, p.pos[2]])]; };
  const onto = (w: Watcher, pts: number[][]) => pts.filter(p => sees(g, w.pos, p, w.look)).length;
  const a_s = R.door('a_s'), bt_y = R.door('battery_to_yard'), g_p = R.door('generator_to_park'), b_n = R.door('b_n'), c_w = R.door('c_w');
  const gA = stackGround('a_s', outside(a_s, R_A)), gBt = stackGround('battery_to_yard', outside(bt_y, DEPOT_ROOMS.battery));
  const wA = onto(west, gA), hA = onto(hatchE, gA), hBt = onto(hatchW, gBt);
  verdict(gA.length === 5 && wA === 5 && hA === 5, 'THE CROSSFIRE on the crew room\'s yard door: the man at the hut\'s west slit AND a man at the hatch each see the doorstep and all four of a stack\'s marks outside a_s', `${who('the west slit').name} ${at(west.pos)}: ${wA} of ${gA.length} · ${hatchE.name} ${at(hatchE.pos)}: ${hA} of ${gA.length} · the ground: ${gA.map(at).join(' ')} · ${f1(dist(west.pos, gA[0]))} m and ${f1(dist(hatchE.pos, gA[0]))} m off`);
  verdict(gBt.length === 5 && hBt === 5, 'the other hatch man sees the ground outside the battery room\'s yard door: its doorstep and all four stack marks', `${hatchW.name} ${at(hatchW.pos)}: ${hBt} of ${gBt.length} · the ground: ${gBt.map(at).join(' ')} · ${f1(dist(hatchW.pos, gBt[0]))} m off`);
  // the back door's price: the park. The gap in its wall is x 34.3‥35.7 at z 15 and opens on the lane behind the signals shelter; the generator room's door
  // is on the park. The shelter hides the gap and the lane, the slit's own north jamb hides the door's step and the last of the walk: what is left to the
  // slit is a short stretch in the MIDDLE, past the shelter's nose (z MID_Z, measured) — and there is no way round it
  { const gapS = [35.0, 0, 15.9], gapN = [35.0, 0, 14.4], step = doorPoint(g_p, outsideOf(g_p, DEPOT_ROOMS.generator), 0.9), path = walkOf(g, [gapS, gapN, step]);
    const seenBy = (p: number[]) => sees(g, east.pos, p, east.look), park = { x0: DEPOT_ROOMS.aerials.x0, x1: DEPOT_ROOMS.aerials.x1, z0: DEPOT_ROOMS.aerials.z0, z1: 16.4 };
    const seen = typeof path === 'string' ? [] : path.filter(seenBy), m = typeof path === 'string' ? 0 : metresOf(path, seenBy), round = unseenWay(g, park, gapS, step, seenBy);
    const zs = seen.map(p => p[2]), mid = seen.every(p => p[2] > MID_Z[0] && p[2] < MID_Z[1]), last = typeof path === 'string' ? 0 : metresOf(path.slice(path.findLastIndex(seenBy) + 1));
    verdict(typeof path !== 'string' && !seenBy(gapN) && !seenBy(step) && seen.length > 0 && mid && m >= 0.5 && m <= 2.5 && last >= 2 && !round, `the man at the hut's east slit sees a short stretch in the MIDDLE of the walk from the gap in the park's wall to the generator room's door, and neither end of it: a man stepping through the gap is behind the shelter, the door's step and the last two metres and more are behind the slit's own jamb, half a metre to two and a half of the walk — all of it between z ${MID_Z[0]} and ${MID_Z[1]} — are in his sight, and there is NO way on foot from the gap to the door that he does not see`, typeof path === 'string' ? path : `${east.name} ${at(east.pos)} · the walk ${at(gapS)} → ${at(step)}: ${f2(m)} of ${f1(metresOf(path))} m in his sight${seen.length ? `, ${at(seen[0])} → ${at(seen[seen.length - 1])} (z ${f2(Math.min(...zs))}‥${f2(Math.max(...zs))})` : ''} · the last ${f1(last)} m unseen · just inside the gap ${seenBy(gapN) ? 'SEEN' : 'not seen'} · the door's step ${seenBy(step) ? 'SEEN' : 'not seen'} · a way round his sight: ${round ? 'THERE IS ONE' : 'none'}`); }

  // THE NESTS COVER EACH OTHER, each man facing as written: the west slit down the lane along the south bar's yard wall, from the truck's east end to the
  // hatch's west jamb (the ground a man creeping up on the hatch stands on); a hatch man onto the ground under the hut's south window
  { const lane: number[][] = []; for (let x = 15.0; x <= 19.3; x += 0.25) for (const z of [17.6, 17.8, 18.0]) if (!g.col.nav.isBlocked(x, z)) lane.push([x, 0, z]);
    // (the hatch's east jamb cuts the west hatch man's line: of the ground under the window, x 24.2‥25.0, he has the west half close to the wall — a man
    //  stood AT the window — and nothing a metre out; the east hatch man has none of it. Held: the two points at the wall. Printed: the strip's count)
    const sw = [[24.3, 0, 15.6], [24.5, 0, 15.6]], strip: number[][] = []; for (let x = 24.2; x <= 25.01; x += 0.2) for (let z = 15.5; z <= 16.51; z += 0.25) if (!g.col.nav.isBlocked(x, z)) strip.push([x, 0, z]);
    const nL = onto(west, lane), byE = onto(hatchE, sw), byW = onto(hatchW, sw);
    verdict(lane.length >= 30 && nL === lane.length && Math.max(byE, byW) === sw.length, 'the nests cover each other: the west-slit man sees the whole lane along the south bar\'s yard wall (z 17.6‥18.0, x 15‥19.3: up to the hatch\'s west jamb), and a hatch man sees a man stood at the hut\'s south window, half a metre off the wall under its west half', `${west.name} ${at(west.pos)}: ${nL} of ${lane.length} lane points, ${f1(dist(west.pos, [19.25, 0, 17.8]))}‥${f1(dist(west.pos, [15.0, 0, 17.8]))} m off · at the south window ${sw.map(at).join(' ')}: ${hatchE.name} ${byE} of ${sw.length}, ${hatchW.name} ${byW} of ${sw.length} · of the ground under the window out to 1.4 m (x 24.2‥25.0, z 15.5‥16.5), printed: ${hatchW.name} ${onto(hatchW, strip)} of ${strip.length}, ${hatchE.name} ${onto(hatchE, strip)} of ${strip.length}`); }

  // THE STORES' WAY: main gate → along the south wall → the lane between the truck and the wall → the workshop's yard door (bay_to_yard) → the bay → the
  // store's bay door. Whichever way a watcher turns (no cone), the leaves as the level stands them
  { const b_y = R.door('bay_to_yard'), outB = outsideOf(b_y, DEPOT_ROOMS.bay), gB = stackGround('bay_to_yard', outB), hatch = [hatchE, hatchW];
    const via = [[4.0, 0, 14.0], [5.0, 0, 17.6], [12.6, 0, 17.8], doorPoint(b_y, outB, 0.9), doorPoint(b_y, -outB as 1 | -1, 0.9), doorPoint(c_w, outsideOf(c_w, DEPOT_ROOMS.c), 0.9)], path = walkOf(g, via);
    const any = (w: Watcher, pts: number[][]) => pts.filter(p => sees(g, w.pos, p));
    const hits = typeof path === 'string' ? [] : hatch.flatMap(w => [...any(w, path), ...any(w, gB)].map(p => `${w.name} on ${at(p)}`));
    verdict(typeof path !== 'string' && gB.length === 5 && hits.length === 0, 'the stores\' way, (i) the hatch: neither hatch man sees any of the walk main gate → south wall → behind the truck → bay_to_yard → the bay → c_w, nor the stack ground outside bay_to_yard, whichever way he turns (they cannot see along their own wall)', typeof path === 'string' ? path : `${f1(metresOf(path))} m, ${path.length} points + the ${gB.length} of the stack ground ${gB.map(at).join(' ')} · ${hits.length ? `${hits.length} sightings: ${hits.slice(0, 6).join(' · ')}` : 'no sighting'} · via ${via.map(at).join(' ')}`);
    const wB = onto(west, gB), wWalk = typeof path === 'string' ? 0 : metresOf(path, p => sees(g, west.pos, p, west.look));
    verdict(wB >= 3 && sees(g, west.pos, gB[0], west.look), 'the stores\' way, (ii) the price: the west-slit man, facing as written, DOES see the stack ground outside bay_to_yard — its doorstep and most of the four\'s marks', `${west.name} ${at(west.pos)}: ${wB} of ${gB.length}, the doorstep ${f1(dist(west.pos, gB[0]))} m off · of the walk itself ${f1(wWalk)} of ${typeof path === 'string' ? '—' : f1(metresOf(path))} m in his sight (printed)`);
    const bay = floorOf(g, DEPOT_ROOMS.bay), at_c_w = [doorPoint(c_w, outsideOf(c_w, DEPOT_ROOMS.c), 0.5), doorPoint(c_w, outsideOf(c_w, DEPOT_ROOMS.c), 0.9)];
    const inHits = [...bay, ...at_c_w].flatMap(p => W.filter(w => sees(g, w.pos, p)).map(w => `${w.name} on ${at(p)}`)), open = statics(g, () => bay.filter(p => W.some(w => sees(g, w.pos, p))).length);
    verdict(bay.length > 100 && inHits.length === 0, 'the stores\' way, (iii) once inside: the bay\'s floor and the bay side of c_w are seen by NONE of the five, whichever way he turns, the doors as they stand (shut)', `${bay.length} floor points of the bay + ${at_c_w.length} at c_w · ${inHits.length ? `${inHits.length} sightings: ${inHits.slice(0, 6).join(' · ')}` : 'no sighting'} · (printed: with every leaf out of the way, ${open} of ${bay.length} bay points are in somebody's line)`); }
  // the hut's back: its own door open or shut (statics alone), each hut man looking out of his slit
  { const floor = floorOf(g, DEPOT_ROOMS.generator), door = [doorPoint(b_n, 1, 0.5), doorPoint(b_n, -1, 0.5), doorPoint(b_n, outsideOf(b_n, DEPOT_ROOMS.b), 1.0)];
    const cnt = (w: Watcher, pts: number[][]) => statics(g, () => pts.filter(p => sees(g, w.pos, p, w.look)).length), turned = statics(g, () => floor.filter(p => [west, east].some(w => sees(g, w.pos, p))).length);
    const rows = [west, east].map(w => `${w.name}: ${cnt(w, floor)} of ${floor.length} floor points of the generator room, ${cnt(w, door)} of ${door.length} points in and at b_n`);
    verdict(floor.length > 100 && [west, east].every(w => cnt(w, floor) === 0 && cnt(w, door) === 0), 'the hut\'s own door is at the watchers\' backs: the generator room and b_n are seen by NEITHER hut man looking out of his slit — the leaf open or shut', `${rows.join(' · ')} · (an eye has ${GUARD_EYE.nearDeg}° either side inside ${GUARD_EYE.nearM} m, ${GUARD_EYE.halfDeg}° beyond: a point counted here is in that near field through the open doorway · were one to turn round with the leaf open: ${turned} of ${floor.length} points)`); }
  // the store's back is NOT the hut's: the bay door is behind both hatch men, but the east one stands inside an eye's near field of it (tools/levels/depot.ts
  // says so). A man half a metre and a metre inside c_w, each hatch man on his mark facing as written, the leaf out of the way:
  { const inside = -outsideOf(c_w, DEPOT_ROOMS.c) as 1 | -1, pts = [doorPoint(c_w, inside, 0.5), doorPoint(c_w, inside, 1.0)];
    const cnt = (w: Watcher) => statics(g, () => pts.filter(p => sees(g, w.pos, p, w.look)).length), off = (w: Watcher, p: number[]) => Math.acos(Math.max(-1, Math.min(1, ((p[0] - w.pos[0]) * w.look[0] + (p[2] - w.pos[2]) * w.look[2]) / (dist(w.pos, p) || 1)))) * 180 / Math.PI;
    const row = (w: Watcher) => `${w.name} ${at(w.pos)}: ${cnt(w)} of ${pts.length} · ${pts.map(p => `${f2(dist(w.pos, p))} m, ${off(w, p).toFixed(0)}° off his aim`).join(' / ')}`;
    verdict(pts.every(p => inBounds(DEPOT_ROOMS.c, p)) && cnt(hatchW) === 0 && cnt(hatchE) === pts.length, 'the store\'s bay door is at the hatch men\'s backs for ONE of them: a man 0.5 m and 1.0 m inside c_w is not seen by the hatch\'s west man looking out, and IS seen by its east man — at his elbow, inside the eye\'s near field', `${row(hatchW)} · ${row(hatchE)} · the points ${pts.map(at).join(' ')} · (an eye has ${GUARD_EYE.nearDeg}° either side inside ${GUARD_EYE.nearM} m)`); }
  verdict(!!crewMan && inBounds(DEPOT_ROOMS.a, crewMan.pos) && !W.some(w => w.room !== 'crew' && statics(g, () => sees(g, w.pos, crewMan.pos))), 'the crew room\'s man is in nobody else\'s sight (the four guns on the yard do not see into his room)', `${crewMan?.name} ${crewMan ? at(crewMan.pos) : ''}`);

  verdict(true, 'the depot\'s other rooms, printed for the page (not judged)', dep.slice(3).map(row).join('\n    '));
  return done();
});
/** where on the gap → generator room walk the east slit's sight falls (z; measured 8.7‥9.3 on both stands, the bound is that with a margin) */
const MID_Z = [8.0, 10.5];

// ---------------------------------------------------------------- walk
// (a point either side of every door, in the order walked; the guards' own grid finds the legs between them. The workshop's yard door opens IN and is left
//  from inside: the halt before it is back up the bay's lane, not in its leaf's sweep)
const DEPOT_WALK: number[][] = [[6.4, 0, 10.7], [6.4, 0, 8.2], [6.4, 0, 10.7], [12.4, 0, 10.7], [12.4, 0, 8.4], [14.6, 0, 6.9], [16.4, 0, 6.9], [18.2, 0, 6.9], [19.9, 0, 6.9], [23.2, 0, 6.9], [24.9, 0, 6.9], [25.9, 0, 8.5], [25.9, 0, 10.9],
  [25.9, 0, 8.4], [28.6, 0, 6.9], [30.6, 0, 6.9], [35.0, 0, 13.8], [35.0, 0, 16.4], [22.9, 0, 17.4], [22.9, 0, 19.7], [18.9, 0, 20.9], [17.0, 0, 20.9], [9.9, 0, 20.9], [8.1, 0, 20.9], [6.6, 0, 20.9], [8.1, 0, 20.9], [9.9, 0, 20.9],
  [14.6, 0, 20.9], [16.4, 0, 17.4], [21.4, 0, 10.7], [21.4, 0, 8.4], [21.4, 0, 10.9], [28.0, 0, 17.2], [35.0, 0, 17.4], [37.6, 0, 17.4], [38.4, 0, 19.4]];
const DEPOT_WALK_DOORS = ['duty', 'duty', 'a_s', 'a_e', 'wash_to_battery', 'battery_to_generator', 'b_n', 'b_n', 'generator_to_park', 'c_n', 'c_w', 'tyres_to_bay', 'tyres_to_bay', 'bay_to_yard', 'battery_to_yard', 'battery_to_yard', 'back_gate'];
const HALT = 1.5;
/** Sam walked at 1.55 m/s down `legs` (nav paths between them), halting HALT seconds at each, with the four fallen in. Counted over the walk's frames, per man or per frame:
 *  stuck = a follower further than 5.5 m from Sam who has moved less than 0.15 m in the last second, for longer than half a second more (he is left behind and
 *  not coming; shorter than that is the tail of the file slow off the mark after a halt — counted apart as late starts);
 *  jam = a frame with two of the five nearer than 0.5 m centre to centre; doorway = a follower standing in a door's opening who has moved less than 0.15 m in
 *  the last second; strung = a follower further than 6.5 m from Sam (the last man of four files 4.6 m back). */
async function walk(legs: number[][]) {
  const R = await rig(11, 'depot', { quiet: true, empty: true }); const { game: g, O, NB } = R; const men = NB.ops, sam = g.player.char;
  for (const d of g.doors.list) d.locked = false;   // (a walk, not a break-in)
  O.give('fallIn', O.targetAt(sam.pos)); R.until(() => men.every((m: any) => O.of(m)?.arrived), 14); R.step(60);
  const path: number[][] = [[sam.pos[0], 0, sam.pos[2]]]; let noPath = ''; const halts = new Set<number>();   // (he halts HALT seconds at every waypoint: a file that only ever moves never bunches)
  for (const p of legs) { const leg = g.col.nav.findPath(path[path.length - 1], p); if (!leg) { noPath = `no nav path to ${at(p)}`; break; } for (const q of leg) path.push([q[0], 0, q[2]]); path.push(p); halts.add(path.length - 1); }
  let seg = 0, t = 0, halt = 0; const SPEED = 1.55; let walked = 0, frames = 0, stuck = 0, jam = 0, doorway = 0, strung = 0, closest = Infinity; const worst = men.map(() => 0);
  const hist: number[][][] = men.map(() => []); const doors = g.doors.list; type Snag = { i: number; who: string; at: string; sam: string; t: number; t1: number; n: number }; const snags: Snag[] = [], open: (Snag | undefined)[] = [];
  R.pre = () => {
    if (seg >= path.length - 1) return; if (halt > 0) { halt -= DT; return; } let left = SPEED * DT;
    while (left > 0 && seg < path.length - 1) { const a = path[seg], b = path[seg + 1], L = dist(a, b); if (L - t <= left) { left -= L - t; seg++; t = 0; if (halts.has(seg) && seg < path.length - 1) { halt = HALT; break; } } else { t += left; left = 0; } }
    const a = path[seg], b = path[Math.min(seg + 1, path.length - 1)], L = dist(a, b) || 1, f = seg >= path.length - 1 ? 0 : t / L;
    g.teleportPlayer([a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f]); walked += SPEED * DT - left;
  };
  const t0 = g.time;
  while (seg < path.length - 1 && g.time - t0 < 400) { R.step(); frames++;
    const all = [sam.pos, ...men.map((m: any) => m.char.pos)]; const near = minApart(all); closest = Math.min(closest, near); if (near < 0.5) jam++;
    men.forEach((m: any, i: number) => { const p = [m.char.pos[0], 0, m.char.pos[2]], h = hist[i]; h.push(p); if (h.length > 61) h.shift();
      const d = dist(p, sam.pos), still = h.length > 60 && dist(h[0], p) < 0.15; worst[i] = Math.max(worst[i], d);
      if (d > 6.5) strung++; if (d > 5.5 && still) { const last = open[i]; if (!last || g.time - last.t1 > 0.5) snags.push(open[i] = { i, who: m.callsign, at: at(p), sam: at(sam.pos), t: g.time - t0, t1: g.time, n: 1 }); else { last.t1 = g.time; last.n++; } }   // (each man's own streak)
      if (still && doors.some((dr: any) => inDoorway(dr, p))) doorway++; }); }
  R.pre = null; const secs = g.time - t0;
  stuck = snags.filter(w => w.n > 30).reduce((n, w) => n + w.n, 0); const late = snags.filter(w => w.n <= 30).length;   // (under half a second of it = the last man of the file slow off the mark after a halt, not a man left behind)
  R.until(() => men.every((m: any) => O.of(m)?.arrived), 12); R.step(120);
  const end = men.map((m: any) => dist(m.char.pos, sam.pos)), left = men.filter((m: any) => doors.some((dr: any) => inDoorway(dr, m.char.pos))).length;
  return { noPath, late, where: snags.filter(w => w.n > 30).map(w => `${w.who} at ${w.at} for ${w.n} frames, Sam at ${w.sam}`), done: seg >= path.length - 1, walked, secs, frames, stuck, jam, doorway, strung, closest, worst, end, left, endApart: minApart(men), sam: [...sam.pos], alive: men.every((m: any) => m.state !== 'dead') };
}
/** THIS FLOOR'S OWN BOUNDS for the walk, each what the walk measured (both stands, seed 11; the worse of the two) with a margin — not the old floor's and
 *  not the office's: the huts' rooms are small (the wash room is 3.4 m wide, a file of four 4.6 m long) and Sam halts a stride past each of seventeen
 *  doorways, so the file closes up and its tail waits in the door behind.
 *  closest: nearest two of the five on any frame, m (measured 0.24 frozen, 0.25 shipped) · jam: frames with two inside 0.5 m (57 / 33: about twice) ·
 *  doorway: man-seconds stood in a doorway per 100 m walked (8.05 / 0.29: about one and a half times) · stuck: per cent of man-frames (0.25 / 0.60) */
const WALK = { closest: 0.15, jam: 115, doorway: 12, stuck: 1 };
export const depotWalk = guarded(async () => {
  const { verdict, done } = family('depot-walk: every room and every door with four following, against this floor\'s own measured bounds');
  const d = await walk(DEPOT_WALK);
  const per = (n: number, w: any) => 100 * n / (4 * w.frames), dw = d.doorway / 60 / Math.max(1, d.walked) * 100;
  const line = (w: any, doors: string[]) => `${f1(w.walked)} m in ${f1(w.secs)} s through ${doors.length} doorways · stuck ${w.stuck} man-frames (${f2(per(w.stuck, w))} %), late starts ${w.late} · two men in one place ${w.jam} frames (closest ${f2(w.closest)} m) · stood in a doorway ${f1(w.doorway / 60)} man-s · strung out past 6.5 m ${f2(per(w.strung, w))} % of man-frames (furthest ${w.worst.map(f1).join(' / ')} m)`;
  verdict(!d.noPath && d.done && d.alive, 'Sam walks in by the main gate → the duty office and out → the crew room (in a_s, out a_e) → wash room → battery room → generator room → the signals hut and out (b_n) → the aerial park → the gap → the store (in c_n, out c_w) → bay → tyre store and back → the yard by the workshop\'s side door → the battery room and out by its yard door → out of the back gate: all thirteen doors', d.noPath || `${line(d, DEPOT_WALK_DOORS)} · doors: ${DEPOT_WALK_DOORS.join(' → ')}`);
  verdict(d.end.every((x: number) => x < 5.8) && d.left === 0 && d.endApart > 0.5, 'all four end with him, nobody left standing in a doorway, nobody on top of anybody', `${d.end.map(f2).join(' / ')} m from Sam at ${at(d.sam)} · ${d.left} in a doorway · nearest two ${f2(d.endApart)} m`);
  // (1 %, was 0.5: with doorway.ts on no place in the file is in a doorway or a leaf's swing, so when Sam halts just past a door the last man's place is a metre or
  // two further back — past this probe's 5.5 m — and he stands there, at his place, until Sam walks on: a second at a time)
  verdict(per(d.stuck, d) <= WALK.stuck, `nobody is left behind — stuck man-frames at or under ${WALK.stuck} percent`, `${f2(per(d.stuck, d))} % (${d.where.join(' · ') || 'never'})`);
  verdict(d.closest >= WALK.closest && d.jam <= WALK.jam, `the file closes up no worse than this floor measured: never two men nearer than ${WALK.closest} m, at most ${WALK.jam} frames with two inside 0.5 m (bounds = this floor's own numbers with a margin)`, `closest ${f2(d.closest)} m · ${d.jam} frames inside 0.5 m`);
  verdict(dw <= WALK.doorway, `men stand in doorways no longer than this floor measured: at most ${WALK.doorway} man-seconds per 100 m walked (bound = this floor's own number with a margin)`, `${f2(dw)} man-s per 100 m (${f1(d.doorway / 60)} man-s over ${f1(d.walked)} m) · strung out past 6.5 m, printed: ${f2(per(d.strung, d))} % of man-frames`);
  return done();
});

// ---------------------------------------------------------------- runs
/** THE OBVIOUS PLAN, room by room: the crew room first, across the lit yard; then the hut by its one door; then the store. Which door red takes a room by,
 *  which blue takes it by (none: the hut has one door, and all four go through it), and where the commander stands to give both (the squad's side of both
 *  doors: the yard is outside a_s and east of a_e's wall; it is outside c_n and west of c_w's).
 *  `via` / `blueVia`: where everybody / blue is walked first, a 'move' at a time. A stack is dealt on the face of a door the men's own walk reaches (an order
 *  on a_e given from the yard sends them through a_s, into the room, to stack on a_e's inside), so blue is put in the room its door is taken FROM before the
 *  order: the wash room by the battery room's yard door, the bay by the workshop's own yard door. */
const PLAN: { room: string; red: string; blue: string | null; stand: number[]; via?: number[][]; blueVia?: number[][] }[] = [
  { room: 'crew', red: 'a_s', blue: 'a_e', stand: [17.0, 0, 11.6], blueVia: [[21.4, 0, 11.0], [21.4, 0, 7.6], [17.4, 0, 7.0]] },
  { room: 'comms', red: 'b_n', blue: null, stand: [26.9, 0, 6.6], via: [[21.4, 0, 7.6], [26.4, 0, 7.4]] },
  { room: 'store', red: 'c_n', blue: 'c_w', stand: [16.6, 0, 17.4], blueVia: [[16.4, 0, 17.3], [16.4, 0, 19.8], [13.2, 0, 20.9]] },
];
/** the floor between the rooms, as points a commander sends the squad to when a room is empty and its men are not down: the yard's west and east halves, the
 *  mouth, the east yard, the aerial park, the generator room, the bay — and the rooms nobody holds (the wash room, the battery room, the duty office, the tyre
 *  store): a hut man who has left for a fight can end his walk in one, and a sweep that never opened it left the run going at the cap */
const SPACES: number[][] = [[9.0, 0, 13.6], [18.0, 0, 13.0], [26.0, 0, 16.8], [31.0, 0, 19.5], [33.0, 0, 9.0], [26.9, 0, 6.6], [13.2, 0, 20.9], [17.2, 0, 7.4], [21.5, 0, 7.4], [6.5, 0, 7.4], [6.5, 0, 21.2]];
export interface DepotRun { policy: string; seed: number; end: string; t: number; lost: number; rooms: Record<string, boolean>; two: string[]; home: Record<string, string>; fratricide: number; refused: string[]; rallied: number; }
/** One scripted run. `two`: red and blue stack on a door each and go on one word (red with a bang, blue quietly as it bursts) where the room has two doors.
 *  `one`: all four bang and clear through the room's first door. Then, either way, whoever is up sweeps: every room still held, door by door, and the floor between the rooms (a defender who
 *  left his room for a fight is out there, and his room is not clear while he lives) — round and round until the end. Ends 'taken' (every defender down),
 *  'wiped' (all four down) or 'stalled' (`cap` seconds gone). `fight`: ROOMFIGHT knobs for the run, in place before it is staged. */
export async function depotPlay(policy: 'two' | 'one', seed: number, cap = 300, fight: Record<string, unknown> = {}, trace = false): Promise<DepotRun> {
  const R = await rig(seed, 'depot', { ghost: true, fight, clear: { pairOnly: true } }); const { game: g, O, D, RC } = R;
  const t0 = g.time, over = () => !!RC.end || g.time - t0 > cap, room = (id: string) => RC.rooms.find((r: any) => r.def.id === id), up = (who: any) => R.men(who).length > 0;
  const two: string[] = [], refused: string[] = [], home: Record<string, string> = {}; const say = (s: string) => { if (trace) console.log(`  ${f1(g.time - t0).padStart(6)}  ${s}`); };
  const wait = (pred: () => boolean, secs: number) => R.until(() => over() || pred(), secs);
  /** the first of `ids` the menu accepts; a refusal is filed only when none was */
  const order = (ids: string[], door: string, who: any, onWord = false): boolean => { const whys: string[] = [];
    for (const id of ids) { const why = R.give(id, door, who, onWord ? { onWord: true } : undefined); if (!why) { say(`${id} ${door} → ${who}${onWord ? ' (on the word)' : ''}`); return true; } whys.push(`${id}: ${why}`); }
    say(`${door} → ${who} REFUSED (${whys.join(' · ')})`); refused.push(`${door} → ${who}: ${whys.join(' · ')}`); return false; };
  const entry = (): string[] => (D.bangs > 0 ? ['bangClear', 'openClear'] : ['openClear']);
  /** `who` walked through `pts` in turn, a 'move' each, waited on for 25 s */
  const walk = (who: any, pts: number[][] = []) => { for (const p of pts) { if (over() || !up(who)) return; const why = R.here(() => O.give('move', O.targetAt(p), who)); say(`move ${at(p)} → ${who}${why ? ` REFUSED (${why})` : ''}`); if (!why) wait(() => R.men(who).every((m: any) => O.of(m)?.arrived), 25); } };
  for (const P of PLAN) { if (over()) break; R.stand = P.stand; const rm = room(P.room);
    walk('all', P.via); if (policy === 'two' && P.blue) walk('blue', P.blueVia);
    home[P.room] = `${rm.defenders.filter((h: any) => h.state !== 'dead' && inBounds(rm.def.bounds, h.char.pos)).length} of ${rm.def.garrison}`;
    if (policy === 'two' && P.blue && up('red') && up('blue')) {
      const a = order(entry(), P.red, 'red', true), b = order(['openClear'], P.blue, 'blue', true);
      if (a || b) wait(() => D.ops.length > 0 && D.ops.every((op: any) => op.phase === 'ready'), 60);
      // both stacked OUTSIDE the room on a door each when the word is given, and a man of each across his frame line after it: that is a room taken from two
      // entries (read off the orders' own `crossed` sets — a man who crossed and went down still crossed — and not off how an order closed: the last room's
      // orders end with the run)
      const ops = [...D.ops], outside = ops.length === 2 && ops[0].door !== ops[1].door && ops.every((op: any) => op.phase === 'ready' && op.men.every((m: any) => !inBounds(rm.def.bounds, m.char.pos)));
      const said = R.here(() => D.go()); say(`the word → ${said} (${ops.map((op: any) => `${op.door.def.name}: ${op.phase}, ${op.men.map((m: any) => at(m.char.pos)).join(' ')}`).join(' · ')})`);
      const across = () => ops.every((op: any) => op.crossed.size > 0);
      R.until(() => over() || !D.ops.length || across(), 45); const crossed = across(); wait(() => !D.ops.length, 45);
      if (a && b && outside && crossed) two.push(P.room);
    } else if (order(entry(), P.red, 'all')) wait(() => !D.ops.length, 60);
    wait(() => rm.cleared, 12); say(`${P.room}: ${rm.cleared ? 'clear' : 'still held'} · ${R.men().length} up`);
  }
  for (let lap = 0; !over(); lap++) {
    for (const P of PLAN) { if (over()) break; const rm = room(P.room); if (rm.cleared) continue;
      R.stand = P.stand; if (!order(['openClear'], (lap % 2 && P.blue) || P.red, 'all')) { wait(() => false, 3); continue; } wait(() => !D.ops.length, 45); wait(() => rm.cleared, 6); say(`sweep ${P.room}: ${rm.cleared ? 'clear' : 'still held'}`); }
    for (const p of SPACES) { if (over()) break; const why = R.here(() => O.give('move', O.targetAt(p), 'all')); if (why) { wait(() => false, 2); continue; } wait(() => R.men().every((m: any) => O.of(m)?.arrived), 14); wait(() => false, 3); }
    if (!over()) say(`lap ${lap + 1} of the floor done · ${R.hostiles.filter((h: any) => h.state !== 'dead').map((h: any) => `${h.callsign} ${at(h.char.pos)}`).join(' ')}`);
  }
  const end = RC.end ?? 'stalled';
  return { policy, seed, end, t: (RC.end ? RC.endAt : g.time) - t0, lost: R.men('all', true).filter((m: any) => m.state === 'dead').length, rooms: Object.fromEntries(RC.rooms.map((r: any) => [r.def.id, r.cleared])), two, home, fratricide: R.fratricide.length, refused, rallied: g.fight.stats.rallied };
}
const RUN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** the most orders a run may have refused (measured: see depot-run's line; the bound is the most seen on either stand, and one) */
const RUN_REFUSED = 2;
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const runSum = (rs: DepotRun[]) => { const tk = rs.filter(r => r.end === 'taken'); return `${tk.length} of ${rs.length} taken · wiped ${rs.filter(r => r.end === 'wiped').length} · stalled ${rs.filter(r => r.end === 'stalled').length} · teammates lost ${f2(mean(rs.map(r => r.lost)))} a run (runs with nobody lost ${rs.filter(r => r.lost === 0).length}) · ${f1(mean(tk.map(r => r.t)))} s when taken`; };
const runRows = (rs: DepotRun[]) => rs.map(r => `seed ${r.seed}: ${r.end} at ${f1(r.t)} s · lost ${r.lost} · two-door rooms ${r.two.join(', ') || 'none'} · defenders at home when its turn came: ${Object.entries(r.home).map(([k, v]) => `${k} ${v}`).join(', ')} · rallied ${r.rallied}${r.refused.length ? ` · refused ${r.refused.length}` : ''}`).join('\n    ');
const twoDoor = (rs: DepotRun[]) => ['crew', 'store'].map(room => `${room} ${rs.filter(r => r.two.includes(room)).length}`).join(' · ') + ` of ${rs.length}`;
async function runsOf(policy: 'two' | 'one', fight: Record<string, unknown> = {}) { const out: DepotRun[] = []; for (const seed of RUN_SEEDS) { out.push(await depotPlay(policy, seed, 300, fight)); restore(); } return out; }
export const depotRun = guarded(async () => {
  const { verdict, done } = family('depot-run: scripted runs of the obvious plan — two pairs through two doors beside one stack through one (who wins is printed, not judged)');
  const tw = await runsOf('two'), on = await runsOf('one');
  const all = [...tw, ...on], stalled = all.filter(r => r.end === 'stalled'), most = Math.max(...all.map(r => r.refused.length));
  verdict(stalled.length === 0 && all.some(r => r.end === 'taken') && most <= RUN_REFUSED, `the scripted commander's orders work on this floor: no run of the ${all.length} is still going at the cap, one at least ends with every defender down, and no run has more than ${RUN_REFUSED} orders refused (today's most, and one)`, `stalled ${stalled.length}${stalled.length ? ` (${stalled.map(r => `${r.policy} seed ${r.seed}`).join(', ')})` : ''} · taken ${all.filter(r => r.end === 'taken').length} · most refused in a run ${most}${most ? ` — e.g. ${all.find(r => r.refused.length === most)!.refused[0]}` : ''}`);
  verdict(all.every(r => r.fratricide === 0), 'no teammate goes down to a teammate in any run of either policy', `${all.reduce((s, r) => s + r.fratricide, 0)} over ${all.length} runs`);
  verdict(true, 'TWO PAIRS, TWO DOORS on the crew room and the store, all four through the hut\'s one (printed, not judged)', `${runSum(tw)} · rooms entered from two doors on one word: ${twoDoor(tw)}\n    ${runRows(tw)}`);
  verdict(true, 'beside it, ONE STACK through each room\'s first door (printed, not judged)', `${runSum(on)}\n    ${runRows(on)}`);
  return done();
});
/** NOT in the 'depot' family (it judges nothing and takes as long as depot-run): the same two policies with ROOMFIGHT.rally off — nobody leaves his room for a
 *  fight next door. As shipped they do, so the last room is often half empty when its turn comes; this is the table for the page's question about that. */
export const depotHome = guarded(async () => {
  const { verdict, done } = family('depot-home: the same runs with the defenders kept at home (ROOMFIGHT.rally off) — printed, not judged');
  const tw = await runsOf('two', { rally: false }), on = await runsOf('one', { rally: false });
  verdict(true, 'TWO PAIRS, TWO DOORS, defenders at home', `${runSum(tw)} · rooms that got a two-door entry: ${twoDoor(tw)}\n    ${runRows(tw)}`);
  verdict(true, 'ONE STACK, defenders at home', `${runSum(on)}\n    ${runRows(on)}`);
  return done();
});

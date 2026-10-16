#!/usr/bin/env bun
// THE KIT VIEW'S PLAN, CHECKED STATICALLY (src/host/kitViewPlan.ts) — `bun run tools/qa/kitview-plan.ts [level …] [--quiet]`. No browser: the planner over
// the level FILES, seconds for all of them (F alone stands the headless game up, on a set). (The picture itself is tools/qa/kitview-page.cjs's, on the page.)
//   A. THE SEAM IS THE PICTURE'S: KIT_PLAN's numbers are KIT_VIEW_STAGE / _LOOP / _LIGHT's (src/host/kitView.ts), a door's places are kitViewSlots' place
//      for place, and the planner's floor is the game's nav grid cell for cell on every level it is asked about (the level loaded as the page loads it).
//   B. PARITY, the records office's two ways: planned WITHOUT the block's `side` and `slots` (and, for the occluders, without its `hide`), what is worked
//      out agrees with what is authored — the side, the hand, each place within TOL, the lamps where the table hangs them, the parked car's eleven boxes
//      among the front way's occluders and none on the west. Both are printed.
//   C. EVERY LEVEL WITH A BLOCK (`scenarios.kitView`), every way, JUDGED BY THE PLAN THE CHILD MAKES (two passes: what stands in the camera's way is sunk
//      before the places are planned — a place "stepped over" on such a thing in one pass is said, never failed): the plan has no `problems`; five places on free floor, outside every box, the picture's
//      spacing apart, nobody in a wall; the anchor a door of the level, a wall or a real gap; the block passes the level validator.
//      THE CHILD'S TWO PASSES (kitViewPlanChild, the function `?kitview` plans a way with — first with the way's `hide` standing, then with what it sank named
//      as out): on the level's own floor they say of no way that a piece of the building was sunk for the camera. And A LEVEL AND ITS LOOK TWIN CARRY THE
//      SAME BLOCK (scene/look.ts LOOK_LEVELS: the start page reads `X.json`, the picture's page loads `X-gwot.json`) — a pair that disagrees FAILS.
//      EVERY CARD OPEN, EVERY SQUAD SIZE (C3): nobody's place within a body (KIT_PLAN.actClear) of anybody else's — the fourth man's acting place
//      (kitPlanAct4, what the picture stages him on with his card open) on every way as the child plans it, and on bare anchors from a door's width to a
//      yard gate's, where as written it fell 0.39 m from Sam's.
//   D. A BESPOKE SET, held here (not a level file): planned from its own few boxes exactly as a level is, with nothing of the level in reach. THE PANE said
//      is the one the child's gun row tries first (in the anchor's own wall, the nearest along it), never a nearer one in another wall. With a tall post
//      stood between the camera and the men: it is a PROBLEM (not a thing to sink) in one pass and in the child's two; an authored `hide` wins over it outright.
//      A THING'S LOOSE PROPS (the file's `props`) go with it: named by a `hide` (the prop's id, or the group it is of), or standing by a box of their group
//      that was sunk for the camera — `hiddenProps`. A `hide` / `show` naming what the stand left out of the file (lived-in rooms off) is no problem.
//      A GAP'S PORCH LAMP: the set's wall with the leaf and lintel gone — the lamp and its box on the stack end's jamb wall (solid wall under the whole box, that
//      wall's own top), on the other end's where the stack's is too low, no box where neither is tall enough, and an authored offset / fixture still winning.
//   F. THE SET LOADER (src/host/kitViewSet.ts kitViewSetLevel — what `?kitview` builds where the way names a set): D's set laid over two real levels' data (a
//      room clear's second way, a rescue's only one) and as a gate with no leaf: the boxes are the set's index for index and then the two sunk stand-ins, the
//      paint, sky, moon, footsteps and name are the level's, the level validator and the real loadLevel take it, its block still plans with no problems, and
//      the HEADLESS GAME stood on it passes the room clear's own check and stages the team on the plan's places from the mission's own query — the link the
//      start page builds (game/loadout.ts squadSearch over scenarioQuery), never a size written here. THE SET'S MEN ARE THE MISSION'S: every row of the
//      mission list and the solo night, at every size it deploys with, staged on a set has the teammates its own link stages. And WITHOUT a
//      set nothing is touched: every level file, every way, comes back the same object and loads to the same Level byte for byte.
//   E. THE DRY RUN — never a failure: every squad mission's every way in, WITHOUT a block. The anchor is PROPOSED from the level's own way-in data (the
//      nearest door to Sam's start within DOOR_M; else a gap in a wall near it; else the wall he faces) and planned. One row per mission-way: the fan-out's
//      work list, written to a file ONLY where KITPLAN_OUT=<path> names one (a full run). The last column says whether the level's own way in plans cleanly or
//      is a candidate for a set.
//   G. A QUIET MISSION, A LONE SAM (a fixture held here: the counting house given a block on its west gate): the block validates and plans, the headless game
//      stages the quiet mission alone on it with Sam on the plan's side of the gate — and the same mission on a bespoke SET stages as a room clear of Sam alone,
//      both from the mission's own link, which carries NO size key (alone is the kind's own size). And THE SET'S MEN ARE DRESSED AS THE MISSION'S: a quiet
//      mission (alone, as two) and the solo night on a set, with the dress the picture's window says (kitViewSetDress), wear the sneaking suit man for man as
//      the mission itself does, the rifle across the back; a loud mission's link says nothing.
//      And NO DEVICE REPORTS IN A PICTURE: Sam held lit under a lens of the fixture's at the door it looks at — the game as it is calls control and raises
//      the floor; with the child's word said (host/kitView.ts kitViewInert) nothing reports, nothing is raised, no alarm is placed.
//      KITPLAN_FIXTURE=<path>: G's fixture ON THE SET is written there as a level file (the page check's dress row has no level to judge: kitview-levels.cjs).
//      WARNINGS AND NOTES OF C, never a FAIL: `- WARNING —` where a way's `hide` / `show` / `pane.box` names a box by GENERATED id (`box_NNNN`, its place in
//      the file: a change of box order points it elsewhere) · `note —` where a written `hide` takes a box that is in no line of the camera's, and what still
//      stands in those lines (hideNotes; held by a row of D).
//      A WAY'S OWN PIECES (`add`: boxes and lamps on a level's own way, in the picture only): planned like the level's own, laid in once, after the level's
//      boxes; what the page loads validates and builds; the mission never has them; a broken one never breaks the mission. C validates every block's,
//      the bundled office's too (its scenarios attached to its data, as the page attaches them). AN ADDED PIECE IS SHOWN: never an occluder, never sunk
//      for the camera — where it hides a man or stands on the line of places the plan says so BY NAME. Two ways may add a piece under one id (one way is
//      ever laid: the level the page loads carries that way's `add` alone); the added records get the level format's own rule for a box and a light in
//      the validator (what it takes, the picture's loadLevel takes); the child lays nothing (kitPlanWayBuilt: its records are the built level).
//      …and in F: THE WAY THE PAGE LAYS IS THE WAY THE MISSION STAGES (kitViewWayOfLink): a room clear's `way`, every other kind's one start.
//   In D also: THE ROOM BEHIND THE ANCHOR — its lamps go out with the room lights unless the way writes `litInside` (C prints a note where one does).
//      …and in F: a level whose kitView block is BROKEN still parses for a mission to play (parseLevelData `kitView: 'drop'`), and is refused everywhere else.
// Lines are `- PASS — …` / `- FAIL — …` (tools/qa/gate.sh counts them). Exit 0 = all pass · 1 = a row failed · 2 = an unknown level.
// KITPLAN_BREAK=1: what is worked out is spoiled (the derived side flipped, a block's second place moved onto the wall's line; a look twin's block read with
// its first way gone; D's gap read as a wall, its porch lamp back over the opening's middle, the level handed over without its loose props, and without the names its stand left out, its pane out of the wall, the stepped place left to the line and another written, a hole in `slots` filled with a place on the wall's line, a quiet set's dress not said, a way judged by one pass alone, `litInside` not written, the devices left live, a generated id read as an authored name, a way's `add` not planned and laid into the mission, loaded without the loader's `laid` word, the other way's `add` left riding on the block, its records whole where broken ones are asked about, the child's way laid by id, the link's `way` read whatever the kind, a fourth man written on the stack's side not written; the child's plan taken from its second pass alone, an authored `hide` read as not written; the loaded set robbed of a
// stand-in, given a box and a sky that are not its own, a way WITH a set asked to come back untouched, and the size the set's query says for a link that
// carries none dropped) — rows of B, C, D and F must FAIL.
// The first line printed names the levels that carry a block (nothing else lists them).
// Both stands: A to E read no switch (the level is read as the page loads it — lived-in rooms and dressing on); F's game is the stand's, and its rows are the
// same on both (TPS_PROFILE=shipped).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { kitViewPlan, kitViewPlanWay, kitViewPlanChild, kitPlanGeometry, kitPlanWayBuilt, kitPlanAdd, kitPlanFloor, kitPlanSlots, kitPlanAct4, kitPlanStands, kitPlanLitInside, KIT_PLAN, KIT_PLAN_IN_WAY, type KitViewPlanned, type KitPlanLevel, type KitPlanFloor, type KitViewWayIn, type V2 } from '../../src/host/kitViewPlan.ts';

const ROOT = resolve(import.meta.dir, '../..');
/** the dry run's table is written here, and only when this names a file (never by default: a check writes nothing outside its own output) */
const DRY_RUN = process.env.KITPLAN_OUT ?? '', FIXTURE = process.env.KITPLAN_FIXTURE ?? '';
const BREAK = process.env.KITPLAN_BREAK === '1';
/** metres: a worked-out stack place against the authored one · Sam's line (Sam, the fourth man: laid by eye, off the worked-out line on purpose) · a lamp */
const TOL = { stack: 0.15, sam: 0.45, lamp: 0.01 };
/** the dry run's proposals: a door this near Sam's start is the way in · a gap or a faced wall is looked for this far · a gap is this wide */
const DOOR_M = 5.5, SEEK_M = 9, GAP_M: [number, number] = [1, 6.5];
/** the records office's parked car (tools/levels/records.ts CAR), by export id */
const CAR = ['box_0212', 'box_0213', 'box_0214', 'box_0215', 'box_0216', 'box_0217', 'box_0218', 'box_0219', 'box_0220', 'box_0221', 'box_0222'];

const argv = process.argv.slice(2), quiet = argv.includes('--quiet'), asked = argv.filter(a => !a.startsWith('--')).map(a => a.replace(/^levels\//, '').replace(/\.json$/, ''));
let fails = 0, passes = 0;
const row = (ok: boolean, what: string) => { if (ok) passes++; else fails++; if (!ok || !quiet) console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); return ok; };
const say = (s: string) => { if (!quiet) console.log(s); };
const r2g = (v: number) => Math.round(v * 100) / 100;
const f2 = (v: number) => r2g(v).toString();
const pt = (p: readonly number[]) => `(${p.map(f2).join(', ')})`;

/** THE MISSION'S OWN LINK, as the start page asks for the picture (ui/kitView.ts hands the child the loadout's Deploy query: game/loadout.ts squadSearch over
 *  the row's scene/scenarios.ts scenarioQuery — the very two functions): the mission list's row of that kind on that level (none: a row of the kind's own
 *  size), deployed with `n` teammates (absent: the row's own size), on its `way`th way in (1-based; absent: the level's own). NO size is written here that
 *  the page would not write: a quiet mission alone carries no `squad` key at all. */
async function missionQuery(kind: string, level: string, n?: number, way?: number): Promise<string> {
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`), { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`), { squadSearch } = await import(`${ROOT}/src/game/loadout.ts`);
  const file = level === 'office' ? undefined : `${level}.json`, e = (ALL_MISSIONS as any[]).find(x => x.kind === kind && x.level === file) ?? { id: '', title: '', kind, squad: kind === 'quiet' ? 0 : 2, ...(file ? { level: file } : {}) };
  return (squadSearch(scenarioQuery(e), n ?? e.squad, e.squad) as string).replace(/^\?/, '') + (way ? `&way=${way}` : '');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;
/** a level file as plain data ('office' = the bundled office with its scenarios attached, as scene/level.ts attaches them) */
const files = readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !f.includes('.lint.')).map(f => f.replace(/\.json$/, '')).sort();
const cache = new Map<string, { data: Data; floor: KitPlanFloor; text: string }>();
async function levelOf(name: string) {
  let L = cache.get(name); if (L) return L;
  const text = readFileSync(`${ROOT}/levels/${name}.json`, 'utf8'), data = JSON.parse(text);
  if (name === 'office' && !data.scenarios) data.scenarios = (await import(`${ROOT}/levels/office.scenarios.ts`)).OFFICE_SCENARIOS;
  L = { data, floor: kitPlanFloor(data.boxes), text }; cache.set(name, L); return L;
}
const starts = (S: Data, kind: string): Data[] => kind === 'rescue' ? [S?.rescue?.team] : kind === 'nightbreach' ? [S?.nightBreach?.team] : [S?.roomClear?.team ?? S?.nightBreach?.team, ...(S?.roomClear?.starts ?? [])];
const refOf = (st: Data): V2 => [st.sam[0], st.sam[2]];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** THE CHILD'S PLAN of a way, off the level's records alone: kitViewPlanChild on a floor that has every box until `sink` takes what is out of the picture off
 *  it (the game's grid, rebaked as the child sinks them). `sunk` = every index handed to sink */
function childPlan(level: KitPlanLevel, way: KitViewWayIn, ref: V2): { P: KitViewPlanned; sunk: Set<number> } {
  const sunk = new Set<number>(); let F = kitPlanFloor(level.boxes);
  const P = kitViewPlanChild(level, way, ref, (x, z) => !F.blocked(x, z), idx => { const n = sunk.size; for (const i of idx) sunk.add(i); if (sunk.size > n) F = kitPlanFloor(level.boxes, sunk); });
  return { P, sunk };
}

/** WHAT A WAY'S WRITTEN NAMES ARE WORTH — said, never failed (levels write these today):
 *  `warn`: a `hide` / `show` / `pane.box` that names a box by its GENERATED id (`box_NNNN`: scene/levelLoad.ts gives a box with no name of its own its
 *  PLACE in the file) — add a box before it in the level's source and the id is another box's, the name still names "a box", and no check goes red. A
 *  box's own `name` (its id, as written) or a `group` of its own holds.
 *  `notes`, of a WRITTEN `hide` (it wins outright, so nothing else looks at it): a box it takes that stands in NO line from the camera to a man, the anchor
 *  or the stage's floor, and is no part of a thing that does ("hides something not in the way" — a box hidden for another reason reads the same: a note) ·
 *  and what still stands in those lines with the `hide` as written. `P` = the way's plan (its occluders are worked out whether or not `hide` is written). */
const GENERATED = /^box_\d{4,}$/;
function hideNotes(level: KitPlanLevel, Y: Data, P: KitViewPlanned): { warn: string[]; notes: string[] } {
  const B = level.boxes, warn: string[] = [], notes: string[] = [], few = (v: string[]) => v.length > 4 ? `${v.slice(0, 2).join(', ')} … ${v[v.length - 1]}` : v.join(', ');
  const gen = ([['hide', Y.hide ?? []], ['show', Y.show ?? []], ['pane.box', Y.pane && Y.pane.box ? [Y.pane.box] : []]] as [string, string[]][]).map(([k, v]) => [k, v.filter(nm => GENERATED.test(nm) && !B.some(b => b.group === nm))] as [string, string[]]).filter(x => x[1].length);
  if (gen.length) warn.push(`${gen.map(([k, v]) => `\`${k}\` names ${v.length} box${v.length === 1 ? '' : 'es'} by generated id (${few(v)})`).join(', ')}: an id of that kind is the box's place in the file — a box added before it in the level's source and the name is another box's, with nothing red. Give the boxes a \`group\` of their own (or a \`name\`) there and write that`);
  if (Y.hide !== undefined) { const names = new Set<string>(Y.hide), occ = new Set(P.occluders.map(o => o.index)), shown = new Set<string>(Y.show ?? []);
    const idle = P.hidden.filter(i => (names.has(B[i].id) || (B[i].group !== undefined && names.has(B[i].group!))) && !occ.has(i) && B[i].c[1] + B[i].h[1] > KIT_PLAN.lowTop);
    const still = P.occluders.filter(o => !P.hidden.includes(o.index) && !shown.has(o.id) && !shown.has(o.group));
    if (idle.length) notes.push(`\`hide\` takes ${idle.length} box${idle.length === 1 ? '' : 'es'} that stand${idle.length === 1 ? 's' : ''} in no line from the camera to the men, the anchor or the stage's floor (${few(idle.map(i => B[i].id))}): it hides something not in the way`);
    if (still.length) notes.push(`with the \`hide\` as written ${still.length} box${still.length === 1 ? '' : 'es'} still stand${still.length === 1 ? 's' : ''} in the camera's line (${few(still.map(o => o.id))}): a written \`hide\` wins outright`); }
  return { warn, notes };
}
let warnings = 0;
const warned = (w: string, N: { warn: string[]; notes: string[] }) => { for (const x of N.warn) { warnings++; console.log(`- WARNING — ${w}: ${x}`); } for (const x of N.notes) say(`  note — ${w}: ${x}`); };

/** THE PLAN A WAY IS JUDGED BY IS THE CHILD'S: one pass (kitViewPlanWay) plans with every worked-out occluder still standing on the floor, and failed a way
 *  for "a place stepped over" on a thing the child sinks for the camera before it plans the places (kitViewPlanChild's first pass) — a problem the picture
 *  never has. `P` = the child's plan of the way (the one pass where the way's set is missing: its one problem); `only` = what the one pass alone said.
 *  (The break: the one pass, as it was.) */
function judged(level: KitPlanLevel, block: Data, way: KitViewWayIn, ref: V2, floor?: KitPlanFloor): { P: KitViewPlanned & { set: string | null }; only: string[] } {
  const one = kitViewPlanWay(level, block, way, ref, floor ? { floor } : {}), G = kitPlanGeometry(level, block, way, ref); if (!G || BREAK) return { P: one, only: [] };
  const C = childPlan(G.level, way, G.ref).P; return { P: { ...C, set: G.set }, only: one.problems.filter(p => !C.problems.includes(p)) };
}

// ───────────────────────────────────────────── A. the seam is the picture's ─────────────────────────────────────────────
async function seam(names: string[]) {
  say('\n=== A. the planner against the picture and the game');
  try {
    await import('./headless.ts');   // (the game modules are one import cycle: enter it the way every probe does)
    const KV = await import(`${ROOT}/src/host/kitView.ts`), S = KV.KIT_VIEW_STAGE, Lp = KV.KIT_VIEW_LOOP, T = KV.KIT_VIEW_LIGHT, K = KIT_PLAN;
    const pairs: [string, number, number][] = [['gap', K.gap, S.gap], ['jamb', K.jamb, S.jamb], ['offFace + 0.12', K.offFace + 0.12, S.off], ['samOffFace + 0.12', K.samOffFace + 0.12, S.samOff], ['samTurnDeg', K.samTurnDeg, S.samTurnDeg], ['samClear', K.samClear, S.samClear], ['authored', K.authored, S.authored],
      ['yaw', K.yaw, S.yaw], ['pitch', K.pitch, S.pitch], ['dist', K.dist, S.dist], ['distPerM', K.distPerM, S.distPerM], ['apart = 2 × body', K.apart, S.body * 2], ['lane', K.lane, Lp.lane], ['round', K.round, Lp.round], ['act4[0]', K.act4[0], Lp.act4[0]], ['act4[1]', K.act4[1], Lp.act4[1]], ['actClear', K.actClear, Lp.actClear], ['inM', K.inM, Lp.inM[0]], ['inMin', K.inMin, Math.min(...Lp.inM)], ['paneAlong', K.paneAlong, Lp.paneReach],
      ['porchOut + 0.12', K.porchOut + 0.12, T.porch.offset[1]], ['porchUp', K.porchUp, T.porch.offset[2]], ['fixOut + 0.12', K.fixOut + 0.12, T.porch.fixture.at[1]], ['porchUp − fixDown', K.porchUp - K.fixDown, T.porch.fixture.at[2]], ['fillOut + 0.12', K.fillOut + 0.12, T.fill.offset[1]], ['fillUp', K.fillUp, T.fill.offset[2]],
      ...[0, 1, 2].map((i): [string, number, number] => [`porchAim[${i}]`, K.porchAim[i], T.porch.aim[i]]), ...[0, 1, 2].map((i): [string, number, number] => [`fillAim[${i}]`, K.fillAim[i], T.fill.aim[i]])];
    const off = pairs.filter(p => Math.abs(p[1] - p[2]) > 1e-9);
    row(off.length === 0, `KIT_PLAN repeats the picture's own numbers (${pairs.length} of KIT_VIEW_STAGE / _LOOP / _LIGHT)${off.length ? ': ' + off.map(p => `${p[0]} ${p[1]} ≠ ${p[2]}`).join(', ') : ''}`);
    // a door's places, place for place, on every door of the records office, both sides, on the planner's floor
    { const R = await levelOf('records'); let n = 0, worst = 0;
      for (const d of R.data.doors) for (const side of [1, -1] as const) for (const out of [1, -1]) { const t: V2 = [Math.cos(d.closedDir), Math.sin(d.closedDir)], n0: V2 = [-t[1] * out, t[0] * out], mid: V2 = [d.hinge[0] + t[0] * d.width / 2, d.hinge[1] + t[1] * d.width / 2];
        const free = (x: number, z: number) => !R.floor.blocked(x, z), ref: V2 = [mid[0] + n0[0] * 3, mid[1] + n0[1] * 3];
        const a = KV.kitViewSlots(d, ref, 4, side, free), b = kitPlanSlots([d.hinge[0], d.hinge[1]], t, d.width, n0, side, 0.12 + K.offFace, 0.12 + K.samOffFace, free);
        n++; a.slots.forEach((p: number[], i: number) => { worst = Math.max(worst, Math.abs(p[0] - b.slots[i][0]), Math.abs(p[1] - b.slots[i][1]), Math.abs(p[2] - b.slots[i][2]) / 100); }); if (a.blocked !== b.stepped) worst = Math.max(worst, 1); }
      row(worst < 1e-9, `kitPlanSlots is kitViewSlots, place for place: ${n} stagings (the records office's ${R.data.doors.length} doors, both sides of the wall, both sides of the door), worst difference ${worst.toExponential(1)}`); }
    // the floor: the game's nav grid, the level loaded as the page loads it
    const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { StaticCollision } = await import(`${ROOT}/src/scene/collision.ts`);
    let cells = 0, differ = 0; const bad: string[] = [];
    for (const name of names) { const L = await levelOf(name); let data; try { data = parseLevelData(L.text); } catch { data = L.data; }
      const nav = new StaticCollision(loadLevel(data, { lived: true, dressing: true }).boxes).nav; let d = 0;
      for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { cells++; if (nav.isBlocked((x + 0.5) * nav.cell, (z + 0.5) * nav.cell) !== L.floor.blocked((x + 0.5) * 0.5, (z + 0.5) * 0.5)) d++; }
      if (d) { differ += d; bad.push(`${name} ${d}`); } }
    row(differ === 0, `the planner's free floor is the game's nav grid, cell for cell: ${names.length} level files, ${cells} cells, ${differ} differ${bad.length ? ' (' + bad.join(', ') + ')' : ''}`);
  } catch (e) { row(false, `the picture's module or the game's grid could not be read: ${String((e as Error)?.message ?? e).slice(0, 200)}`); }
}

// ───────────────────────────────────────────── B. parity: the records office ─────────────────────────────────────────────
async function parity() {
  say('\n=== B. parity — the records office, both ways: worked out against authored');
  const R = await levelOf('records'), S = R.data.scenarios, ways: Data[] = S.kitView.ways, st = starts(S, 'roomclear');
  ways.forEach((Y, k) => {
    const ref = refOf(st[k]), A = kitViewPlan(R.data, Y, ref, { floor: R.floor });
    const bare: Data = { ...Y }; delete bare.side; delete bare.slots;
    const D0 = kitViewPlan(R.data, bare, ref, { floor: R.floor });
    const D = BREAK ? kitViewPlan(R.data, { ...bare, side: -D0.side }, ref, { floor: R.floor }) : D0;   // (the break: the derived side flipped)
    const nude: Data = { ...bare }; delete nude.hide; const O = kitViewPlan(R.data, nude, ref, { floor: R.floor });
    const w = `records way ${k} (${Y.door})`;
    say(`  ${w}: authored side ${A.side} hand ${A.hand} · ${A.slots.map(pt).join(' ')}\n  ${' '.repeat(w.length)}  derived  side ${D.side} hand ${D.hand} · ${D.slots.map(pt).join(' ')}`);
    row(D.src.side === 'derived' && D.side === A.side, `${w}: the side worked out (${D.side}) is the authored one (${A.side})`);
    row(D.hand === A.hand && A.hand === 'left', `${w}: the hand worked out (${D.hand}) is the authored picture's (${A.hand}: the stack left of the door, the parent's frame)`);
    // (a place the worked-out line had to STEP OVER a box for is not held to the authored one: that box is why the place was authored. It is named.)
    const open = kitPlanSlots(D.anchor.a, D.anchor.t, D.anchor.width, D.anchor.n, D.side, D.wall.face + KIT_PLAN.offFace, D.wall.face + KIT_PLAN.samOffFace, () => true).slots;
    const moved = D.slots.map((p, i) => dist(p, open[i]) > 0.02), shutBy = (i: number) => { const b = (R.data.boxes as Data[]).filter(o => !(o.flags ?? []).includes('NoShadow') && o.c[1] + o.h[1] >= 0.25 && o.c[1] - o.h[1] <= 1.5 && !(Y.hide ?? []).includes(o.id)).map(o => ({ o, d: Math.hypot(Math.max(0, Math.abs(open[i][0] - o.c[0]) - o.h[0]), Math.max(0, Math.abs(open[i][1] - o.c[2]) - o.h[2])) })).sort((x, y) => x.d - y.d)[0]; return b ? `${b.o.id} (${b.o.group})` : '?'; };
    const dd = A.slots.map((p, i) => dist(p, D.slots[i])), tol = (i: number) => i >= 1 && i <= 3 ? TOL.stack : TOL.sam, held = dd.map((_, i) => !moved[i]);
    row(held.filter(Boolean).length >= 4 && dd.every((d, i) => !held[i] || d <= tol(i)), `${w}: each place worked out is where it is authored, the stack within ${TOL.stack} m and Sam's line within ${TOL.sam} m — ${dd.map((d, i) => `${i}: ${f2(d)}${held[i] ? '' : ' (not held)'}`).join(' · ')} m${moved.some(Boolean) ? `; not held: ${moved.map((m, i) => m ? `place ${i}, whose worked-out spot ${pt(open[i])} is shut by ${shutBy(i)} — the line stepped on to ${pt(D.slots[i])}, the file has him at ${pt(A.slots[i])}` : '').filter(Boolean).join('; ')}` : ''}`);
    row(Math.abs(D.wall.face - 0.12) < 0.005 && Math.abs(D.wall.thickness - 0.24) < 0.005 && D.wall.top >= 2.6, `${w}: the wall measured is the level kit's — face ${D.wall.face} m off the line, ${D.wall.thickness} m thick, ${D.wall.top} m tall (the picture assumed 0.12 / a 2.4 m lamp)`);
    const P = D.lamps.porch, lampOk = Math.abs(P.offset[1] - 0.67) <= TOL.lamp && Math.abs(P.offset[2] - 2.4) <= TOL.lamp && !!P.fixture && Math.abs(P.fixture.at[1] - 0.17) <= TOL.lamp && Math.abs(P.fixture.at[2] - 2.27) <= TOL.lamp;
    row(lampOk, `${w}: the porch lamp and its box hang where the table hangs them within ${TOL.lamp} m — lamp ${pt(P.offset)}, box ${P.fixture ? pt(P.fixture.at) : 'none'}`);
    say(`  ${w}: the fill worked out ${pt(D.lamps.fill.offset)} against the table's (0, 6.62, 2) — ${f2(D.out)} m of free floor in front; a pane ${D.pane ? `${D.pane.box} from ${pt(D.pane.stand)}` : 'none'}; ${f2(D.inside)} m behind; lane ${D.lane.free ? 'free' : 'shut'}`);
    const occ = new Set(O.occluders.map(o => o.id)), car = CAR.filter(id => occ.has(id)).length, rest = O.occluders.filter(o => !CAR.includes(o.id));
    if (k === 0) row(car === CAR.length, `${w}: the parked car is among the occluders worked out with no \`hide\` — ${car} of its ${CAR.length} boxes${rest.length ? `; also ${rest.map(o => o.id).join(', ')} (${[...new Set(rest.map(o => o.group))].join(', ')}: not hidden today)` : ''}`);
    else row(O.occluders.length === 0, `${w}: nothing stands in the camera's way (the block hides nothing here) — ${O.occluders.length} occluders${O.occluders.length ? ': ' + O.occluders.map(o => o.id).join(', ') : ''}`);
    if (k === 0) { const H = kitViewPlan(R.data, bare, ref, { floor: R.floor, hiddenStand: true });
      say(`  ${w}: with the hidden car still on the floor (the game's grid until the child rebakes it) the same plan steps over ${H.stepped} place${H.stepped === 1 ? '' : 's'} and Sam is put at ${pt(H.slots[0])}; lane ${H.lane.free ? 'free' : 'shut'}`); }
  });
}

// ───────────────────────────────────────────── C. every level with a block ─────────────────────────────────────────────
async function generic(names: string[]) {
  say('\n=== C. every level with a kitView block');
  const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { kitViewSetLevel, kitViewAddLevel } = await import(`${ROOT}/src/host/kitViewSet.ts`);
  let n = 0;
  for (const name of names) { const L = await levelOf(name), S = L.data.scenarios, KB = S?.kitView; if (!KB) continue; n++;
    // (the bundled office too: its scenarios are code and never pass the validator on the page — here they do, attached to the office's own data as main.ts bootLevel attaches them)
    { const errs: string[] = validateLevelData(L.data).filter((e: string) => e.includes('kitView')); row(errs.length === 0, `${name}: the block passes the level validator${errs.length ? ' — ' + errs.slice(0, 3).join('; ') : ''}`); }
    const st = starts(S, 'roomclear').filter(Boolean); if (!st.length) st.push({ sam: L.data.mission.playerSpawn });   // (a quiet or a solo mission's level: Sam's own start)
    (KB.ways as Data[]).forEach((Y0, k) => { const w = `${name} way ${k} (${Y0.door ?? 'span'}${Y0.set ? ', set ' + Y0.set : ''})`;
      const Y: Data = BREAK && Y0.slots?.[1] ? { ...Y0, slots: Y0.slots.map((p: number[] | null, i: number) => i === 1 && p ? onLine(L.data, Y0, p) : p) } : Y0;   // (the break: the second place moved onto the wall's line)
      const { P, only } = judged(L.data, KB, Y, refOf(st[k] ?? st[0]), L.floor);
      row(P.problems.length === 0, `${w}: the plan has no problems${P.problems.length ? ' — ' + P.problems.join(' · ') : ''}${only.length ? ` (one pass alone, before the child sinks what is in the camera's way, also said: ${only.join(' · ')})` : ''}`);
      // (as the CHILD plans it: two passes on the floor as the game has it — what the first sank for the camera and was no thing is said, kitViewPlanChild)
      { const G = kitPlanGeometry(L.data, KB, Y, refOf(st[k] ?? st[0])); if (G) { const C = childPlan(G.level, Y, G.ref), inWay = C.P.problems.filter(p => p.startsWith(KIT_PLAN_IN_WAY));
          row(inWay.length === 0, `${w}: the child's two passes sink no piece of the building for the camera (${C.P.occluders.length} occluders, ${C.sunk.size} boxes out of the picture)${inWay.length ? ' — ' + inWay.join(' · ') : ''}`); } }
      { const G = kitPlanGeometry(L.data, KB, Y0, refOf(st[k] ?? st[0])); if (G) warned(w, hideNotes(G.level, Y0, P)); }   // (names by generated id, a `hide` against the camera's line: said, never failed)
      // (ONE BLOCK, SEVERAL STARTS: a quiet mission deals Sam's start, and a level with more than one kind of mission starts each team somewhere else — the side
      //  the picture is taken from is then the block's to say, `ref`; a way on a set has the set's own)
      { const kinds = ['roomClear', 'nightBreach', 'rescue'].filter(x => S[x]?.team).length; if ((S.quiet || kinds > 1) && Y0.set === undefined) row(Array.isArray(Y0.ref), `${w}: the level's missions start in more than one place (${S.quiet ? 'a quiet mission deals its start' : kinds + ' kinds of mission'}) and the way writes its \`ref\`, the side the picture is taken from`); }
      row(P.fit === 5 && P.slots.length === 5, `${w}: five places on free floor, outside every box, ${KIT_PLAN.gap} m apart down the stack and ${KIT_PLAN.apart} m from anybody, nobody in the wall — ${P.fit} of 5 fit (${P.slotSrc.filter(x => x === 'authored').length} authored)`);
      row(P.anchor.kind === 'door' ? P.anchor.door !== null && P.wall.boxes.length > 0 : P.wall.boxes.length > 0 || P.anchor.kind === 'gap', `${w}: the anchor is ${P.anchor.kind === 'door' ? `the door '${P.anchor.door}' in a wall` : P.anchor.kind === 'wall' ? 'a stretch of wall' : 'a real gap'} — ${P.wall.boxes.length} wall box${P.wall.boxes.length === 1 ? '' : 'es'} on its line, face ${P.wall.face}, top ${P.wall.top}`);
      // (a way on a SET, loaded as ?kitview loads it — src/host/kitViewSet.ts: the set's doors and lamps get the level format's whole rule there, not the block's shapes alone)
      if (Y0.add !== undefined && Y0.set === undefined) { const out: Data = kitViewAddLevel(L.data, k), errs: string[] = out === L.data ? ['nothing was laid in'] : validateLevelData(out); row(errs.length === 0, `${w}: with the way's \`add\` laid in after the level's own (what ?kitview loads: ${out.boxes.length - L.data.boxes.length} box(es), ${out.lights.length - L.data.lights.length} lamp(s) more) the level validator takes it${errs.length ? ' — ' + errs.slice(0, 3).join('; ') : ''}`); }
      if (Y0.set !== undefined) { const out: Data = kitViewSetLevel(L.data, k), errs: string[] = out === L.data ? ['the loader swapped nothing'] : validateLevelData(out); row(errs.length === 0, `${w}: with the set in the level's place (what ?kitview loads) the level validator takes it${errs.length ? ' — ' + errs.slice(0, 3).join('; ') : ''}`); }
      // THE WAY IN IS WALKABLE: where there is an opening (a door, a gap) with floor behind it, a man walks from Sam's place through it on the nav grid's own cells
      // (four ways, the leaf not counted: it swings) — a set's sill, drift or post in the doorway would shut it, and the rows that go in would stand outside
      if (P.anchor.kind !== 'wall' && P.inside >= 1 && P.slots.length) { const T = Y0.set !== undefined ? KB.sets?.[Y0.set] : null, F = T ? kitPlanFloor(T.boxes) : L.floor, N = KIT_PLAN.nav, cellOf = (x: number, z: number) => [Math.floor(x / N.cell), Math.floor(z / N.cell)], free = (i: number, j: number) => i >= 0 && j >= 0 && i < N.W && j < N.H && !F.blocked((i + 0.5) * N.cell, (j + 0.5) * N.cell);
        const d = Math.min(P.inside - 0.3, 0.75) - P.wall.back + (BREAK ? 60 : 0), goal = cellOf(P.anchor.mid[0] - P.anchor.n[0] * d, P.anchor.mid[1] - P.anchor.n[1] * d), from = cellOf(P.slots[0][0], P.slots[0][1]);
        const seen = new Uint8Array(N.W * N.H), q: number[][] = free(from[0], from[1]) ? [from] : []; let hit = false; if (q.length) seen[from[1] * N.W + from[0]] = 1;
        while (q.length && !hit) { const [i, j] = q.shift()!; if (i === goal[0] && j === goal[1]) { hit = true; break; } for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (free(a, b) && !seen[b * N.W + a]) { seen[b * N.W + a] = 1; q.push([a, b]); } }
        row(hit, `${w}: the way in is walkable — from Sam's place through the ${P.anchor.kind} to ${f2(Math.min(P.inside - 0.3, 0.75))} m behind it, on the nav grid's cells`); }
      if (Y0.set === undefined && !Y0.litInside && !((Y0.roomLights ?? Y0.light?.roomLights ?? 0) > 0)) { const dark = kitPlanLitInside(L.data.lights ?? [], P.anchor.mid, P.anchor.n, P.wall.back).filter((l: Data) => l.group !== 'exterior' && !P.keepLights.includes(l.group));
        if (dark.length) say(`  note — ${w}: ${dark.length} lamp${dark.length === 1 ? '' : 's'} behind the anchor light${dark.length === 1 ? 's' : ''} the wedge the picture shows and go${dark.length === 1 ? 'es' : ''} out with the room lights (${dark.map((l: Data) => `${l.id} of '${l.group}'`).join(', ')}): the way's \`litInside: true\` keeps the room lit`); }
      say(`  ${w}: side ${P.side} (${P.src.side}) hand ${P.hand} · ${f2(P.out)} m in front, ${f2(P.inside)} m behind · pane ${P.pane ? `${P.pane.box}, ${f2(P.pane.along)} m along the wall` : 'none'} · ${P.occluders.length} occluders, ${P.hidden.length} hidden · ${P.indoors ? 'indoors' : 'outdoors'} · lane ${P.lane.free ? 'free' : 'shut'}`); });
  }
  if (!n) say('  (no level asked about carries a block)');
}
/** a place moved onto the anchor's line (the break) */
function onLine(data: Data, Y: Data, p: number[]): number[] { const d = data.doors.find((o: Data) => o.id === Y.door); if (!d) return p; const t = [Math.cos(d.closedDir), Math.sin(d.closedDir)], al = (p[0] - d.hinge[0]) * t[0] + (p[1] - d.hinge[1]) * t[1]; return [d.hinge[0] + t[0] * al, d.hinge[1] + t[1] * al, p[2]]; }

// ───────────────────────────────────────────── D. a bespoke set ─────────────────────────────────────────────
/** A TINY SET, as a level's block would carry one (scenarios.ts KitViewSet): a yard wall with a door in it and a window beside the door, a crate, a lamp.
 *  The level format's own records; materials by the level's names (here the records office's). */
const SET = {
  ref: [20, 14] as [number, number],
  boxes: [
    { id: 'set_ground', c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'asphalt' },
    { id: 'set_wall_a', c: [16.785, 1.4, 10], h: [2.785, 1.4, 0.1], material: 'concrete' },                       // x 14 ‥ 19.57
    { id: 'set_lintel', c: [20, 2.5, 10], h: [0.43, 0.3, 0.1], material: 'concrete' },                              // over the door, 2.2 ‥ 2.8
    { id: 'set_wall_b', c: [20.965, 1.4, 10], h: [0.535, 1.4, 0.1], material: 'concrete' },                        // x 20.43 ‥ 21.5
    { id: 'set_sill', c: [22.1, 0.45, 10], h: [0.6, 0.45, 0.1], material: 'concrete' },                             // under the pane
    { id: 'set_pane', c: [22.1, 1.5, 10], h: [0.6, 0.6, 0.006], material: 'glassExt', flags: ['Glass'] },
    { id: 'set_head', c: [22.1, 2.45, 10], h: [0.6, 0.35, 0.1], material: 'concrete' },
    { id: 'set_wall_c', c: [24.35, 1.4, 10], h: [1.65, 1.4, 0.1], material: 'concrete' },                          // x 22.7 ‥ 26
    { id: 'set_crate', group: 'set.things', c: [24.5, 0.4, 13.2], h: [0.4, 0.4, 0.4], material: 'wood' },
  ],
  doors: [{ id: 'set_door', hinge: [19.57, 10] as [number, number], closedDir: 0, width: 0.86, exterior: true }],
  lights: [{ id: 'set_lamp', kind: 'point', pos: [20, 2.6, 10.6], dir: [0, -1, 0], color: [1, 0.8, 0.5], intensity: 6, range: 8, innerDeg: 0, outerDeg: 90, group: 'set', enabled: true, volumetric: 0 }],
};
async function bespoke() {
  say('\n=== D. a bespoke set (held in this check): planned exactly as a level is');
  const block: Data = { sets: { porch: SET } }, way: KitViewWayIn = { door: 'set_door', set: 'porch' };
  const none: KitPlanLevel = { boxes: [], doors: [] }, R = await levelOf('records');
  const P = kitViewPlanWay(none, block, way, [0, 0]);
  row(P.set === 'porch' && P.problems.length === 0 && P.fit === 5, `the set plans cleanly from its own ${SET.boxes.length} boxes: no problems, ${P.fit} of 5 places${P.problems.length ? ' — ' + P.problems.join(' · ') : ''}`);
  row(P.anchor.door === 'set_door' && Math.abs(P.wall.face - 0.1) < 0.005 && Math.abs(P.wall.thickness - 0.2) < 0.005 && Math.abs(P.wall.top - 2.8) < 0.005, `its wall is measured, not assumed: face ${P.wall.face} m (not 0.12), ${P.wall.thickness} m thick, top ${P.wall.top} m — the lamp at ${pt(P.lamps.porch.offset)}`);
  row(P.pane?.box === 'set_pane' && P.keepLights.join() === 'set' && !P.indoors, `its pane and its lamp are found: ${P.pane ? `${P.pane.box} from ${pt(P.pane.stand)}` : 'no pane'}, lights kept [${P.keepLights.join(', ')}], ${P.indoors ? 'indoors' : 'under the open sky'}`);
  // THE PANE SAID IS THE PANE THE CHILD'S GUN ROW TRIES FIRST (host/kitView.ts fireLine: glass in the anchor's own wall, the nearest along it). A second pane
  // stood free in the yard a stride from Sam — nearer every man than the wall's — is not it; one in the wall but beyond the row's reach along it is not
  // either. WRITTEN ON THE WAY, a pane is put through the same tests — the child's gun row puts it through them and shoots through the doorway when it
  // fails: the wall's own pane is taken as written, with the place written for it; the yard's is a PROBLEM said, and no pane (the row vouched for 'taken as
  // written' of a pane the page never shot through). (The break: the set's own pane taken out of the wall.)
  { const glass = (id: string, c: number[]): Data => ({ id, c, h: [0.6, 0.6, 0.006], material: 'glassExt', flags: ['Glass'] }), yard = glass('set_yard_pane', [P.slots[0][0], 1.5, P.slots[0][1] + 1.2]);
    const L = (more: Data[], less = ''): KitPlanLevel => ({ boxes: [...SET.boxes.filter(b => b.id !== less), ...more] as Data, doors: SET.doors as Data, lights: SET.lights as Data });
    const X = kitViewPlan(L([yard], BREAK ? 'set_pane' : ''), { door: 'set_door' }, SET.ref), Z = kitViewPlan(L([yard], 'set_pane'), { door: 'set_door' }, SET.ref), W = kitViewPlan(L([yard], 'set_pane'), { door: 'set_door', pane: { box: 'set_yard_pane' } }, SET.ref);
    const at: [number, number, number] = [22.1, 11.4, 180], V = kitViewPlan(L([yard], BREAK ? 'set_pane' : ''), { door: 'set_door', pane: { box: 'set_pane', stand: at } }, SET.ref), not = W.problems.filter(p => p.includes("is not one the gun row shoots through"));
    row(X.pane?.box === 'set_pane' && X.pane.onWall && Math.abs(Math.abs(X.pane.along) - 2.1) < 0.01 && X.src.pane === 'derived' && Z.pane === null
      && V.pane?.box === 'set_pane' && V.src.pane === 'authored' && V.pane.stand.join() === at.join() && V.problems.length === 0 && W.pane === null && W.src.pane === 'authored' && not.length === 1 && W.problems.length === 1,
      `the pane worked out is the one the gun row tries first — in the anchor's own wall, the nearest along it: ${X.pane ? `${X.pane.box}, ${f2(X.pane.along)} m along${X.pane.onWall ? ', in the wall' : ', NOT IN THE WALL'}` : 'NONE'} with a second pane free in the yard ${f2(1.2)} m from Sam's place; that yard pane alone: ${Z.pane ? Z.pane.box : 'none'}; the wall's pane written on the way is taken as written (${V.pane ? `${V.pane.box} from ${pt(V.pane.stand)}` : 'NONE'}, ${V.src.pane}, ${V.problems.length} problem(s)); the yard's written is a problem and no pane (${W.pane ? 'NAMED: ' + W.pane.box : 'none'}): '${(not[0] ?? 'NOT SAID').slice(0, 130)}'`); }
  const Q = kitViewPlanWay(R.data, block, way, refOf(starts(R.data.scenarios, 'roomclear')[0]), { floor: R.floor });
  row(JSON.stringify(Q) === JSON.stringify(P), 'handed a whole level beside the set, the plan is the same to the byte: nothing of the level is reached for (its boxes, doors, lights, floor, team start)');
  // A THING THE CHILD SINKS FAILS NO WAY: the crate stood ON the second stack man's place, on the stage's floor. One pass steps over it and says so; the child
  // sinks it for the camera first and plans five places on the floor that leaves — the way is judged by that plan (judged(), C's rows).
  { const L3: KitPlanLevel = { boxes: SET.boxes.map(b => b.id === 'set_crate' ? { ...b, c: [P.slots[2][0], 0.4, P.slots[2][1]] } : b) as Data, doors: SET.doors as Data, lights: SET.lights as Data };
    const one = kitViewPlan(L3, { door: 'set_door' }, SET.ref), J = judged(L3, undefined, { door: 'set_door' }, SET.ref), stepped = (X: KitViewPlanned) => X.problems.filter(p => p.includes('stepped over')).length;
    row(stepped(one) === 1 && J.P.problems.length === 0 && J.P.fit === 5 && J.P.slots[2].join() === P.slots[2].join() && J.only.length === 1,
      `a thing on a man's place that the child sinks for the camera fails no way: one pass says '${one.problems.find(p => p.includes('stepped over')) ?? 'NOTHING'}'; the plan the way is judged by (the child's two passes) has ${J.P.problems.length} problem(s), ${J.P.fit} of 5 places, the second stack man on his own place ${pt(J.P.slots[2])}${J.P.problems.length ? ' — ' + J.P.problems.join(' · ') : ''}`); }
  // ONE PLACE WRITTEN ALONE (`slots` is positional: a `null` holds a place left to the plan — the validator refused a hole, so moving one man meant writing all
  // before him): the second stack man 0.3 m further out, every other place the plan's own to the bit. (The break: the hole filled with a place on the wall's line.)
  { const at: [number, number, number] = [P.slots[2][0] + P.anchor.n[0] * 0.3, P.slots[2][1] + P.anchor.n[1] * 0.3, P.slots[2][2]], Y: Data = { door: 'set_door', set: 'porch', slots: [null, BREAK ? [P.slots[1][0], 10, 0] : null, at] };
    const X = kitViewPlanWay(none, block, Y, [0, 0]), same = [0, 1, 3, 4].every(i => X.slots[i].join() === P.slots[i].join());
    const copy = JSON.parse(R.text); copy.scenarios.kitView = { sets: { porch: SET }, ways: [Y] }; const errs: string[] = (await import(`${ROOT}/src/scene/levelData.ts`)).validateLevelData(copy).filter((e: string) => e.includes('kitView'));
    row(errs.length === 0 && X.problems.length === 0 && X.fit === 5 && same && dist(X.slots[2], at) < 0.011 && X.slotSrc.join() === 'derived,derived,authored,derived,derived',
      `one place can be written alone: \`slots: [null, null, [x, z, yaw]]\` passes the level validator (${errs.length} error(s)${errs.length ? ': ' + errs[0].slice(0, 90) : ''}), the second stack man stands where he is written ${pt(X.slots[2])} and the other four where the plan puts them (${X.slotSrc.join(', ')}), ${X.fit} of 5 fit${X.problems.length ? ' — ' + X.problems.join(' · ') : ''}`); }
  // …AND WRITING THE STEPPED PLACE ALONE CLEARS ITS PROBLEM: the crate stood on the THIRD stack man's place — one pass steps over it and says so. The way then
  // writes that one man where the plan itself put him: he is the way's now, no place left to the line was stepped over, and nothing is said ("N places stepped
  // over" counted the whole worked-out line, written places and all: no `slots` short of all five could clear it). The way holds its `side` — worked out, the stack would cross to the door's free side — and its `hide: []`:
  // the crate stands. (The break: the fourth man written instead.)
  { const L4: KitPlanLevel = { boxes: SET.boxes.map(b => b.id === 'set_crate' ? { ...b, c: [P.slots[3][0], 0.4, P.slots[3][1]] } : b) as Data, doors: SET.doors as Data, lights: SET.lights as Data };
    const way0: KitViewWayIn = { door: 'set_door', side: P.side, hide: [] }, one = kitViewPlan(L4, way0, SET.ref), said = (X: KitViewPlanned) => X.problems.filter(p => p.includes('stepped over'));
    const i = BREAK ? 4 : 3, slots: Data[] = [null, null, null, null, null].slice(0, i + 1); slots[i] = one.slots[i];
    const X = kitViewPlan(L4, { ...way0, slots } as Data, SET.ref);
    row(one.stepped === 1 && said(one).length === 1 && dist(one.slots[3], P.slots[3]) > KIT_PLAN.gap - 0.02 && X.stepped === 0 && X.problems.length === 0 && X.fit === 5 && X.slotSrc[3] === 'authored' && X.slots.every((p, j) => p.join() === one.slots[j].join()),
      `a stepped place written alone clears its problem: a crate on the third stack man's place — worked out, '${said(one)[0] ?? 'NOTHING SAID'}' (he stands ${f2(dist(one.slots[3], P.slots[3]))} m further along); that one place written (\`slots: [null, null, null, [x, z, yaw]]\`, ${X.slotSrc.join(', ')}): ${X.stepped} stepped, ${X.problems.length} problem(s), ${X.fit} of 5 fit, every place where it was${X.problems.length ? ' — ' + X.problems.join(' · ') : ''}`); }
  // THE FOURTH MAN WRITTEN ON THE STACK'S SIDE IS SAID (the card switch walks him round Sam and never across the anchor: host/kitView.ts rotate() assumed him
  // behind Sam and nothing held a level to it): a place for him a stride past the stack's last man. (The break: the way without that place.)
  { const at: [number, number, number] = [P.slots[3][0] + P.s[0] * KIT_PLAN.gap, P.slots[3][1] + P.s[1] * KIT_PLAN.gap, P.slots[3][2]];
    const X = kitViewPlanWay(none, block, { door: 'set_door', set: 'porch', ...(BREAK ? {} : { slots: [null, null, null, null, at] }) }, [0, 0]), said = X.problems.filter(p => p.includes('is not behind Sam'));
    row(said.length === 1 && X.problems.length === 1 && X.fit === 5 && P.problems.length === 0, `a fourth man written on the stack's side of the anchor is a problem said, the place itself free floor (${X.fit} of 5 fit): '${(said[0] ?? 'NOT SAID').slice(0, 150)}' — and worked out he is always behind Sam (the set's own plan: ${P.problems.length} problems)`); }
  const G = kitViewPlanWay(none, block, { span: [[22.9, 10], [24.1, 10]], set: 'porch' }, [0, 0]);
  row(G.anchor.kind === 'wall' && G.anchor.door === null && G.inside === 0 && G.fit === 5, `a span on the set's blank wall is a 'wall' anchor: no leaf, nothing behind for a throw (${G.inside} m), ${G.fit} of 5 places${G.problems.length ? ' — ' + G.problems.join(' · ') : ''}`);
  const M = kitViewPlanWay(none, block, { door: 'set_door', set: 'nowhere' }, [0, 0]);
  row(M.problems.length === 1 && /no set/.test(M.problems[0]), `a way that names a set the block has not is a problem, not the level's geometry: '${M.problems[0] ?? ''}'`);
  // A TALL POST BETWEEN THE CAMERA AND THE MEN (stood 3 m from Sam's place toward the camera, 7 m tall: no thing to sink — and far enough that no place moves)
  { const toCam = [P.cam.pos[0] - P.slots[0][0], P.cam.pos[2] - P.slots[0][1]], l = Math.hypot(toCam[0], toCam[1]) || 1, at = [P.slots[0][0] + toCam[0] / l * 3, P.slots[0][1] + toCam[1] / l * 3];
    const L2: KitPlanLevel = { boxes: [...SET.boxes, { id: 'set_post', group: 'set.post', c: [at[0], 3.5, at[1]], h: [0.2, 3.5, 0.2], material: 'concrete' }] as Data, doors: SET.doors as Data, lights: SET.lights as Data }, iPost = L2.boxes.length - 1, iCrate = L2.boxes.findIndex(b => b.id === 'set_crate');
    const bare: KitViewWayIn = { door: 'set_door' }, said = (X: KitViewPlanned) => X.problems.filter(p => p.startsWith(KIT_PLAN_IN_WAY) && p.includes('set_post'));
    const one = kitViewPlan(L2, bare, SET.ref);
    row(one.occluders.some(o => o.id === 'set_post') && one.hidden.includes(iPost) && said(one).length === 1, `a non-thing occluder is a problem: the 7 m post in the camera's line is among the occluders, goes out of the picture all the same, and is said — '${(said(one)[0] ?? 'NOT SAID').slice(0, 110)}'`);
    // (the planner function the CHILD calls, both passes: the second is told the post is already out and would not say it — the first's word is carried)
    const C = childPlan(L2, bare, SET.ref), two = BREAK ? kitViewPlan(L2, bare, SET.ref, { alsoHide: kitViewPlan(L2, bare, SET.ref, { hiddenStand: true }).occluders.map(o => o.id) }) : C.P;
    row(said(two).length === 1 && C.sunk.has(iPost) && two.hidden.includes(iPost) && two.occluders.some(o => o.id === 'set_post'), `…and it reaches the plan the child exposes (kitViewPlanChild, both passes: the post sunk by the first, named as out to the second): ${said(two).length} problem(s) of it in the child's plan${BREAK ? ' (KITPLAN_BREAK: the second pass alone)' : ''}, ${two.problems.length} in all`);
    // AN AUTHORED `hide` WINS over what is worked out: `[]` = nothing goes, the post stands and is no problem; a named box goes and nothing else
    const none_: KitViewWayIn = BREAK ? bare : { door: 'set_door', hide: [] }, crate: KitViewWayIn = BREAK ? bare : { door: 'set_door', hide: ['set_crate'] };
    const A0 = kitViewPlan(L2, none_, SET.ref), A1 = kitViewPlan(L2, crate, SET.ref), C0 = childPlan(L2, none_, SET.ref), C1 = childPlan(L2, crate, SET.ref);
    const wins = (X: KitViewPlanned, hid: number[]) => X.src.hide === 'authored' && X.occluders.some(o => o.id === 'set_post') && X.hidden.join() === hid.join() && said(X).length === 0;
    row(wins(A0, []) && wins(A1, [iCrate]) && wins(C0.P, []) && C0.sunk.size === 0 && wins(C1.P, [iCrate]) && [...C1.sunk].join() === String(iCrate),
      `an authored \`hide\` wins over the occluders worked out, in one pass and in the child's two: \`hide: []\` hides ${A0.hidden.length} / sinks ${C0.sunk.size}, \`hide: ['set_crate']\` hides [${A1.hidden.map(i => L2.boxes[i].id).join(', ')}] / sinks [${[...C1.sunk].map(i => L2.boxes[i].id).join(', ')}] — the post still in the camera's line (${A0.occluders.length} occluder(s)) and no problem of it (${said(A0).length + said(A1).length + said(C0.P).length + said(C1.P).length})`); }
  // A THING'S LOOSE PROPS GO WITH IT (the file's `props` are no boxes: a `hide` of a group took its table and left its stool standing alone). By NAME: the
  // prop's own id, or the group it is of (`<group>.<tail>`) — less `show`. WORKED OUT (no `hide`): the crate stood on the stage's floor, in the camera's
  // line — the stool of its group beside it goes, the one of its group across the yard and another group's beside it stay. (The break: the level handed
  // over without its props, as the child's was before the rule.)
  { const at = [P.slots[2][0] + P.anchor.n[0] * 1.6, P.slots[2][1] + P.anchor.n[1] * 1.6];
    const props = [{ id: 'set.things.stool0', x: at[0] + 0.7, z: at[1] }, { id: 'set.things.far0', x: 30, z: 20 }, { id: 'set.other.stool0', x: at[0], z: at[1] + 0.7 }, { id: 'stool9', x: at[0] - 0.7, z: at[1] }];
    const L3 = { boxes: SET.boxes.map(b => b.id === 'set_crate' ? { ...b, c: [at[0], 0.4, at[1]] } : b), doors: SET.doors, lights: SET.lights, ...(BREAK ? {} : { props }) } as Data as KitPlanLevel;
    const ids = (X: KitViewPlanned) => (X.hiddenProps ?? []).map(i => props[i].id).join(', '), door = 'set_door', named = (X: KitViewPlanned) => X.problems.filter(p => p.startsWith('hide / show names')).length;
    const H = kitViewPlan(L3, { door, hide: ['set.things'] }, SET.ref), one = kitViewPlan(L3, { door, hide: ['stool9'] }, SET.ref), S = kitViewPlan(L3, { door, hide: ['set.things'], show: ['set.things.far0'] }, SET.ref);
    row(ids(H) === 'set.things.stool0, set.things.far0' && ids(one) === 'stool9' && named(one) === 0 && one.hidden.length === 0 && ids(S) === 'set.things.stool0',
      `a written \`hide\` takes a thing's loose props with its boxes, by name: \`hide: ['set.things']\` → props [${ids(H)}] with ${H.hidden.length} box(es); a prop's own id alone → [${ids(one)}], no "no such name" said (${named(one)}); less \`show: ['set.things.far0']\` → [${ids(S)}]`);
    // A NAME BY GENERATED ID IS A WARNING, AND A `hide` IS READ AGAINST THE CAMERA'S LINE (hideNotes: said in C, never failed). The crate in the camera's
    // line, hidden by its group: nothing said. The same crate under a generated id, hidden by that id: one warning, no note. A box across the yard hidden
    // beside it: the note that it is not in the way. `hide: []` with the crate standing: the note that it still stands. (The break: the id read as a group's.)
    { const gen = (id: string) => ({ ...L3, boxes: [...L3.boxes.map(b => b.id === 'set_crate' ? { ...b, id } : b), { id: 'set_far', c: [34, 0.4, 22], h: [0.4, 0.4, 0.4], material: 'wood' }] }) as Data as KitPlanLevel;
      const N = (Lv: KitPlanLevel, Y: Data) => hideNotes(Lv, Y, childPlan(Lv, Y, SET.ref).P), La = gen('set_crate'), Lb = gen(BREAK ? 'set_crate' : 'box_0008');
      const a = N(La, { door, hide: ['set.things'] }), b = N(Lb, { door, hide: [Lb.boxes.find(x => x.group === 'set.things')!.id] }), c = N(La, { door, hide: ['set.things', 'set_far'] }), e = N(La, { door, hide: [] }), p = N(Lb, { door, pane: { box: 'box_0005' }, show: ['box_0003'] });
      row(a.warn.length + a.notes.length === 0 && b.warn.length === 1 && b.notes.length === 0 && c.warn.length === 0 && c.notes.length === 1 && c.notes[0].includes('set_far') && e.notes.length === 1 && e.notes[0].includes('set_crate') && p.warn.length === 1,
        `a name by generated id is a warning and a written \`hide\` is read against the camera's line (said, never failed): the crate in the line hidden by its group — ${a.warn.length} warning(s), ${a.notes.length} note(s); by a generated id — ${b.warn.length} warning ('${(b.warn[0] ?? '').slice(0, 58)}…'), ${b.notes.length} note(s); a box across the yard hidden with it — '${(c.notes[0] ?? 'NOTHING SAID').slice(0, 96)}…'; \`hide: []\` — '${(e.notes[0] ?? 'NOTHING SAID').slice(0, 80)}…'; a \`show\` and a \`pane.box\` by generated id — ${p.warn.length} warning`); }
    const C = childPlan(L3, { door }, SET.ref);
    row(C.P.occluders.some(o => o.id === 'set_crate') && ids(C.P) === 'set.things.stool0' && C.P.problems.length === 0,
      `…and worked out (no \`hide\`), in the child's two passes: the crate on the stage's floor is sunk for the camera (${C.P.occluders.length} occluder(s)) and the stool of its group within ${KIT_PLAN.propNear} m goes with it — props [${ids(C.P)}]; the one of its group across the yard, another group's beside it and a prop of no group stay${C.P.problems.length ? ' — ' + C.P.problems.join(' · ') : ''}`); }
  // A GAP'S PORCH LAMP (the same wall with the door's leaf and lintel gone: an open gate 0.86 m wide; the wall past `b` cut to 2.3 m so each end has its own
  // top): no wall stands over the opening, so the lamp and its box hang on the jamb's wall at the STACK'S end, on solid wall and under that wall's top
  { const K = KIT_PLAN, span: [V2, V2] = [[19.57, 10], [20.43, 10]], cut = (b: Data, top: number): Data => ({ ...b, c: [b.c[0], top / 2, b.c[2]], h: [b.h[0], top / 2, b.h[2]] });
    const gateOf = (topA: number, topB: number): KitPlanLevel => ({ boxes: SET.boxes.filter(b => b.id !== 'set_lintel').map(b => b.id === 'set_wall_a' ? cut(b, topA) : b.id === 'set_wall_b' ? cut(b, topB) : b) as Data, doors: [], lights: SET.lights as Data });
    const plan = (L: KitPlanLevel, more: Data = {}) => kitViewPlan(L, { span, ...more, ...(BREAK ? { kind: 'wall', light: undefined } : {}) } as Data, SET.ref);   // (the break: the gap read as a wall — the lamp over its middle, as before the rule)
    /** the box of the level the porch lamp's box hangs on: under the fixture's place on the anchor's line, the whole 0.34 m of it, and tall enough */
    const carries = (L: KitPlanLevel, X: KitViewPlanned) => { const F = X.lamps.porch.fixture; if (!F) return null; const on = (al: number) => L.boxes.filter(b => Math.abs(X.anchor.mid[0] + X.s[0] * al - b.c[0]) <= b.h[0] && Math.abs(X.anchor.mid[1] + X.s[1] * al - b.c[2]) <= b.h[2] && b.c[1] + b.h[1] >= F.at[2] && b.c[1] - b.h[1] <= F.at[2]);
      return on(F.at[0]).find(b => on(F.at[0] - 0.17).includes(b) && on(F.at[0] + 0.17).includes(b)) ?? null; };
    const tall = gateOf(2.8, 2.3), jamb = r2g(0.43 + K.porchHand);
    for (const side of [1, -1] as const) { const X = plan(tall, { side }), F = X.lamps.porch.fixture, own = side > 0 ? 2.3 : 2.8, up = Math.min(K.porchUp, own - K.porchUnder), box = carries(tall, X);
      row(X.anchor.kind === 'gap' && X.problems.length === 0 && X.src['porch.offset'] === 'derived' && X.src['porch.fixture'] === 'derived' && !!F && Math.abs(F.at[0] - jamb) < 0.005 && Math.abs(X.lamps.porch.offset[0] - jamb) < 0.005 && box?.id === (side > 0 ? 'set_wall_b' : 'set_wall_a') && Math.abs(X.lamps.porch.offset[2] - up) < 0.005 && Math.abs(F.at[2] - (up - K.fixDown)) < 0.005,
        `a gap with a wall at both ends, the stack past ${side > 0 ? 'b' : 'a'}: the porch lamp and its box hang on the stack end's jamb wall, not over the opening's middle — along ${F ? f2(F.at[0]) : 'NONE'} m (${f2(jamb)}: ${K.porchHand} m past the jamb), on ${box?.id ?? 'NO BOX'} whole, the lamp ${f2(X.lamps.porch.offset[2])} m up under that wall's own ${own} m top (the other end's is ${side > 0 ? 2.8 : 2.3}), worked out (${X.src['porch.fixture']})${X.problems.length ? ' — ' + X.problems.join(' · ') : ''}`); }
    { const far = gateOf(1.2, 2.8), X = plan(far, { side: -1 }), F = X.lamps.porch.fixture, box = carries(far, X);
      row(X.anchor.kind === 'gap' && !!F && Math.abs(F.at[0] + jamb) < 0.005 && box?.id === 'set_wall_b' && Math.abs(X.lamps.porch.offset[0] + jamb) < 0.005, `…the stack's end only 1.2 m tall (under ${K.porchCarry} m: nothing to carry a lamp): they hang on the other end's wall — along ${F ? f2(F.at[0]) : 'NONE'} m, on ${box?.id ?? 'NO BOX'}`); }
    { const low = gateOf(1.2, 1.2), X = plan(low), P = X.lamps.porch;
      row(X.anchor.kind === 'gap' && X.wall.top === 1.2 && P.fixture === null && X.src['porch.fixture'] === 'derived' && P.offset[0] === 0 && P.offset[2] === K.porchUp, `a gap with no wall tall enough at either end (both ${X.wall.top} m): no box — fixture ${P.fixture ? 'at ' + pt(P.fixture.at) : 'none'}; the light alone at ${pt(P.offset)}`); }
    { const light = { porch: { offset: [0.3, 0.9, 2.2], fixture: { at: [-0.6, 0.2, 2.0] } } }, X = plan(tall, { light }), P = X.lamps.porch;
      row(X.anchor.kind === 'gap' && X.src['porch.offset'] === 'authored' && X.src['porch.fixture'] === 'authored' && P.offset.join() === '0.3,0.9,2.2' && P.fixture?.at.join() === '-0.6,0.2,2', `an authored \`light.porch.offset\` / \`fixture.at\` on a gap still wins: lamp ${pt(P.offset)} (${X.src['porch.offset']}), box ${P.fixture ? pt(P.fixture.at) : 'none'} (${X.src['porch.fixture']})`); }
    row(P.lamps.porch.offset[0] === 0 && P.lamps.porch.fixture?.at[0] === 0 && G.lamps.porch.offset[0] === 0 && G.lamps.porch.fixture?.at[0] === 0, `…and a door and a stretch of wall keep theirs over the anchor's middle (along ${P.lamps.porch.offset[0]} and ${G.lamps.porch.offset[0]})`); }
  // A NAME FOR WHAT THE STAND LEFT OUT IS NO PROBLEM (`?lived=0`, the dressing off: the loader leaves those boxes and props out of the file it hands the
  // child — scene/levelLoad.ts levelFileOf — and a `hide` / `show` of a lived group then named nothing: a plan problem on a picture that was right). A copy of
  // the records office's data with one lived box and one lived prop, its way hiding the group and showing the prop, loaded BOTH ways as the page loads it.
  // (The break: the file handed over without `left`, as it was.)
  { const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel, levelFileOf } = await import(`${ROOT}/src/scene/levelLoad.ts`);
    const copy = JSON.parse(R.text), Y: Data = copy.scenarios.kitView.ways[0], ref = refOf(starts(copy.scenarios, 'roomclear')[0]);
    copy.boxes.push({ id: 'kv_lived_box', group: 'lived.kv', c: [ref[0], 0.3, ref[1] + 9], h: [0.3, 0.3, 0.3], material: copy.boxes[0].material });
    copy.props.push({ id: 'lived.kv.stool0', kind: 'chair', x: ref[0] + 0.5, z: ref[1] + 9, mass: 5, parts: [{ off: [0, 0.2, 0], h: [0.15, 0.2, 0.15], albedo: [0.3, 0.3, 0.3] }] });
    const way: Data = { ...Y, hide: [...(Y.hide ?? []), 'lived.kv'], show: ['lived.kv.stool0'] }, data = parseLevelData(JSON.stringify(copy));
    const plan = (lived: boolean, w: Data = way) => { const F: Data = levelFileOf.get(loadLevel(data, { lived, dressing: true })); return { F, P: kitViewPlan(BREAK ? { ...F, left: undefined } : F, w, ref) }; };
    const said = (X: KitViewPlanned) => X.problems.filter(p => p.startsWith('hide / show names')), on = plan(true), off = plan(false), lost = plan(false, { ...way, hide: [...way.hide, 'lived.nowhere'] }), mine = ['kv_lived_box', 'lived.kv', 'lived.kv.stool0'];
    row(on.F.left.length === 0 && mine.every(nm => off.F.left.includes(nm)) && off.F.boxes.length < on.F.boxes.length && on.P.hidden.some((i: number) => on.F.boxes[i].id === mine[0]) && said(on.P).length === 0 && said(off.P).length === 0 && off.P.hidden.length === on.P.hidden.length - 1 && said(lost.P).length === 1,
      `a \`hide\` / \`show\` that names a lived group is no problem on the stand that leaves the lived things out: loaded with them ${on.F.boxes.length} boxes, nothing left out, ${said(on.P).length} said; loaded without ${off.F.boxes.length} boxes, ${off.F.left.length} names left out (${mine.filter(nm => off.F.left.includes(nm)).join(', ')} among them), ${said(off.P).length} said${said(off.P).length ? ` ('${said(off.P)[0]}')` : ''} — and a name that is nowhere in the file is still said (${said(lost.P).length})`); }
  // THE ROOM BEHIND THE ANCHOR (a way's `litInside`): a roofed room behind the set's wall with its own bulb, and a second bulb deep in the building. As the
  // way stands the room's group goes out with the room lights (the wedge behind the wall is black); with the word its group is kept beside the yard's own,
  // the deep one's is not; `keepLights` written is kept WITH it; and the validator takes true / false only. (The break: the word not written.)
  { const lamp = (id: string, group: string, z: number): Data => ({ ...SET.lights[0], id, group, pos: [20, 2.3, z] });
    const L4 = { boxes: [...SET.boxes, { id: 'set_ceiling', c: [20, 2.9, 5], h: [3, 0.1, 5], material: 'concrete' }], doors: SET.doors, lights: [...SET.lights, lamp('set_bulb', 'set_room', 8.2), lamp('set_deep', 'set_far', 1.5)] } as Data as KitPlanLevel;
    const word: Data = BREAK ? {} : { litInside: true }, plain = kitViewPlan(L4, { door: 'set_door' }, SET.ref), lit = kitViewPlan(L4, { door: 'set_door', ...word }, SET.ref), both = kitViewPlan(L4, { door: 'set_door', keepLights: ['set'], ...word }, SET.ref);
    const In = kitPlanLitInside(L4.lights!, plain.anchor.mid, plain.anchor.n, plain.wall.back).map(l => l.id);
    row(plain.keepLights.join() === 'set' && lit.keepLights.join() === 'set,set_room' && both.keepLights.join() === 'set,set_room' && both.src.keepLights === 'authored' && In.join() === 'set_bulb' && lit.problems.length === 0,
      `a room behind the anchor goes out with the room lights and stays lit by the way's one word: as it stands lights kept [${plain.keepLights.join(', ')}], with \`litInside\` [${lit.keepLights.join(', ')}] (the lamp that lights the wedge: ${In.join(', ') || 'none'}; the one ${f2(10 - 1.5)} m in is not it), with \`keepLights\` written beside it [${both.keepLights.join(', ')}]`);
    const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), copy = JSON.parse(R.text), W0 = copy.scenarios.kitView.ways[0];
    const errs = (v: unknown): string[] => { copy.scenarios.kitView.ways[0] = { ...W0, litInside: v }; return validateLevelData(copy).filter((e: string) => e.includes('kitView')); };
    row(errs(true).length === 0 && errs(BREAK ? false : 'yes').length === 1, `the level validator takes \`litInside: true\` and refuses a word that is no true / false (${errs('yes')[0] ?? 'nothing said'})`); }
  // A LEVEL'S OWN WAY WITH A PIECE AND A LAMP MORE (a way's `add`: scenarios.ts KitViewWay.add). THE PLAN counts them like the level's own: laid in after
  // the level's boxes, once (planned again from records that carry them: nothing twice). AN ADDED PIECE IS AUTHORED, SO IT IS SHOWN: never an occluder,
  // never sunk for the camera — a crate added ON a man's place stands, its place is stepped over and the problem NAMES it; a board added between the
  // camera and the men "hides the stack: move it" by name, and stays (with the way's `show` it is the author's word and nothing is said; with the way's
  // `hide` it goes: authored wins); the added lamp's group stays lit with `keepLights` written empty. (The break: planned from the bare level.)
  { const Ls = { boxes: SET.boxes, doors: SET.doors, lights: SET.lights } as Data as KitPlanLevel, door = 'set_door';
    const add = { boxes: [{ id: 'add_crate', group: 'add.things', c: [P.slots[2][0], 0.4, P.slots[2][1]], h: [0.4, 0.4, 0.4], material: 'wood' }], lamps: [{ ...SET.lights[0], id: 'add_lamp', group: 'add_lamps', pos: [20, 2.3, 8] }] };
    const A: Data = { door, keepLights: [], add }, G = kitPlanGeometry(Ls, undefined, A, SET.ref)!, G2 = kitPlanGeometry(G.level, undefined, A, SET.ref)!, n0 = SET.boxes.length;
    const plan = (Y: Data) => BREAK ? kitViewPlan(Ls, Y, SET.ref) : kitViewPlanWay(Ls, undefined, Y, SET.ref, { floor: kitPlanFloor(Ls.boxes) }), X = plan(A), S = plan({ ...A, show: ['add.things'] });
    const named = (Q: KitViewPlanned, id: string, what: string) => Q.problems.filter(p => p.includes(`the added '${id}'`) && p.includes(what)).length;
    row(G.level.boxes.length === n0 + 1 && G.level.boxes[n0].id === 'add_crate' && SET.boxes.every((b, i) => G.level.boxes[i] === (b as Data)) && G.level.lights!.length === SET.lights.length + 1 && G2.level === G.level && kitPlanAdd(Ls, { door, set: 'porch', add } as Data) === Ls
      && !X.occluders.some(o => o.id === 'add_crate') && !X.hidden.includes(n0) && X.stepped === 1 && named(X, 'add_crate', 'stands on the line of places') === 1 && X.keepLights.join() === 'add_lamps' && S.stepped === 1 && S.problems.some(p => p.includes('stepped over')) && !S.hidden.includes(n0),
      `a way's \`add\` is planned like the level's own boxes and lamps: laid in after the level's ${n0} (box ${n0} = ${G.level.boxes[n0]?.id}), ${G.level.lights!.length - SET.lights.length} lamp more, nothing laid twice, nothing on a way with a set — a crate added on place 2 is no occluder and is not sunk (hidden: ${X.hidden.includes(n0)}): it stands, its place is stepped over (${X.stepped}) and the problem names it (${X.problems.find(p => p.includes("the added 'add_crate'"))?.slice(0, 70) ?? 'NOT SAID'}); lights kept [${X.keepLights.join(', ')}] with \`keepLights: []\` written`);
    // (the board: 2 m tall and edge-on to the wall, a tenth of the way from SAM to the camera — half a metre from him, on nobody's place: the set's camera
    //  looks down the stack, so a piece in front of a stack man is on the line of places as well)
    const C0 = kitViewPlan(Ls, { door }, SET.ref), m = C0.slots[0], at = [m[0] + (C0.cam.pos[0] - m[0]) / 10, 1, m[1] + (C0.cam.pos[2] - m[1]) / 10];
    const board = { boxes: [{ id: 'add_board', group: 'add.things', c: at, h: [0.05, 1, 0.6], material: 'wood' }] }, nb = SET.boxes.length;
    const Bd = plan({ door, add: board }), Bs = plan({ door, add: board, show: ['add_board'] }), Bh = plan({ door, add: board, hide: ['add_board'] }), child = BREAK ? null : childPlan(kitPlanGeometry(Ls, undefined, { door, add: board } as Data, SET.ref)!.level, { door, add: board } as Data, SET.ref);
    row(!Bd.hidden.includes(nb) && !Bd.occluders.some(o => o.id === 'add_board') && named(Bd, 'add_board', 'hides the stack: move it') === 1 && Bd.problems.length === 1 && Bd.stepped === 0 && Bd.side === C0.side && Bs.problems.length === 0 && named(Bs, 'add_board', '') === 0 && !Bs.hidden.includes(nb) && Bh.hidden.includes(nb) && named(Bh, 'add_board', '') === 0
      && !!child && !child.sunk.has(nb) && named(child.P, 'add_board', 'hides the stack: move it') === 1,
      `an added piece is never hidden by what is worked out: a board added between the camera and the men stands (hidden: ${Bd.hidden.includes(nb)}, sunk by the child's two passes: ${child ? child.sunk.has(nb) : '?'}) and the plan says so by name (${Bd.problems.find(p => p.includes("the added 'add_board'"))?.slice(0, 48) ?? 'NOT SAID'}); the way's \`show\` with its name: it stays and nothing is said (${named(Bs, 'add_board', '')}); the way's \`hide\` with its name: it goes (${Bh.hidden.includes(nb)}) — authored wins both ways`); }
  // …AND WHAT THE PAGE LOADS (src/host/kitViewSet.ts kitViewAddLevel, in a copy of the records office's data): the level's own boxes index for index and then
  // the way's, its look alternative resolved to the file's paint; the level validator and the real loadLevel take it; the child's records (levelFileOf)
  // carry the piece and plan with nothing laid twice; a way without `add` comes back the same object; THE MISSION NEVER HAS IT (parsed to play, loaded: the
  // level's own box count) and a BROKEN `add` is refused by every tool and left out, with the whole block, of a mission to play; on a set's way and with an
  // id the level has it is refused. (The break: the mission's data put through the picture's loader.)
  { const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel, levelFileOf } = await import(`${ROOT}/src/scene/levelLoad.ts`), { kitViewAddLevel } = await import(`${ROOT}/src/host/kitViewSet.ts`);
    const copy = JSON.parse(R.text), W0: Data = copy.scenarios.kitView.ways[0], ref = refOf(starts(copy.scenarios, 'roomclear')[0]), lamp0 = copy.lights.find((l: Data) => l.kind !== 'dir');
    const add = { boxes: [{ id: 'kv_add_box', group: 'kv.add', c: [ref[0], 0.3, ref[1] + 9], h: [0.3, 0.3, 0.3], material: `kv_no_such_paint|${copy.boxes[0].material}` }], lamps: [{ ...lamp0, id: 'kv_add_lamp', group: 'kv_add', pos: [ref[0], 2.2, ref[1] + 9] }] };
    const withAdd = (a: Data, more: Data = {}) => { const c = JSON.parse(R.text); c.scenarios.kitView.ways[0] = { ...W0, ...more, add: a }; return c; }, kv = (c: Data): string[] => validateLevelData(c).filter((e: string) => e.includes('kitView'));
    // (the break: what the page loads WITHOUT the loader's `laid` word — the records are in the level and the block still says they are to be added)
    const unlaid = (o: Data): Data => ({ ...o, scenarios: { ...o.scenarios, kitView: { ...o.scenarios.kitView, ways: o.scenarios.kitView.ways.map((y: Data) => y.add ? { ...y, add: { ...y.add, laid: undefined } } : y) } } });
    const text = JSON.stringify(withAdd(add)), data: Data = parseLevelData(text), out0: Data = kitViewAddLevel(data, 0), out: Data = BREAK && out0 !== data ? unlaid(out0) : out0, n = data.boxes.length, errs: string[] = out === data ? ['nothing was laid in'] : validateLevelData(out);
    let built: Data = null, F: Data = null; try { built = loadLevel(out); F = levelFileOf.get(built); } catch (e) { errs.push(String((e as Error)?.message ?? e)); }
    const again = F ? kitPlanGeometry(F, out.scenarios.kitView, out.scenarios.kitView.ways[0], ref) : null, byId = F ? kitPlanGeometry(F, data.scenarios.kitView, data.scenarios.kitView.ways[0], ref) : null;
    row(errs.length === 0 && out.boxes.length === n + 1 && data.boxes.every((b: Data, i: number) => out.boxes[i] === b) && out.boxes[n].material === copy.boxes[0].material && out.lights.length === data.lights.length + 1 && kitViewAddLevel(data, 1) === data
      && !!F && F.boxes[F.boxes.length - 1].id === 'kv_add_box' && again?.level === F && byId?.level === F && out.scenarios.kitView.ways[0].add.laid === true && data.scenarios.kitView.ways[0].add.laid === undefined && kitViewAddLevel(out0, 0) === out0,
      `what the page loads for a way with \`add\`: the level's ${n} boxes index for index and then '${out.boxes[n]?.id}' in the file's own paint ('${out.boxes[n]?.material}'), ${out.lights.length - data.lights.length} lamp more; the level validator and loadLevel take it, the child's records end with the piece and plan with nothing laid twice; the way without \`add\` is the same object${errs.length ? ' — ' + errs.slice(0, 3).join('; ') : ''}`);
    // THE CHILD PLANS THE WORLD THAT WAS BUILT, never a box more: a piece of a `lived.*` group with the lived-in rooms off is left out by the loader, and
    // the block the child reads may carry no `laid` word (the bundled office's Level: its scenarios are the script's) — planned as the child plans it
    // (kitPlanWayBuilt: nothing laid) the plan's boxes are the built records, box for box. (The break: the way as the block has it — laid by id, one more.)
    { const lv = withAdd({ boxes: [{ ...add.boxes[0], group: 'lived.kv' }] }), dl: Data = parseLevelData(JSON.stringify(lv)), built = loadLevel(kitViewAddLevel(dl, 0), { lived: false }), Fl: Data = levelFileOf.get(built), Yb: Data = dl.scenarios.kitView.ways[0];
      const Gl = kitPlanGeometry(Fl, dl.scenarios.kitView, BREAK ? Yb : kitPlanWayBuilt(Yb), ref), Gon = kitPlanGeometry(F, data.scenarios.kitView, kitPlanWayBuilt(data.scenarios.kitView.ways[0]), ref);
      row(!!Gl && Gl.level === Fl && !Fl.boxes.some((b: Data) => b.id === 'kv_add_box') && Gon?.level === F && kitPlanWayBuilt(W0) === W0, `the child plans the level that was built and lays nothing: an added piece of a \`lived.*\` group with the lived-in rooms off is in neither the world nor the plan (${Fl.boxes.length} records, ${Gl?.level.boxes.length} planned), under a block with no \`laid\` word; with the piece built in, the records as they are`); }
    // TWO WAYS MAY WRITE THE SAME PIECE (the same drum, under one id, at two doors): the file validates, and EACH way's picture loads — the level the page
    // loads for a way carries that way's `add` alone (laid), no other way's. (The break: the other way's `add` left riding on the block, as it was — the
    // loader's own word for the level then held an id the other way was still to add, and both ways' levels were refused.)
    { const two = () => { const c = withAdd(add); c.scenarios.kitView.ways[1] = { ...c.scenarios.kitView.ways[1], add }; return c; }, fileErrs = kv(two()), d2: Data = parseLevelData(JSON.stringify(two())), said: string[] = []; let loaded = 0, alone = 0;
      for (const w of [0, 1]) { const o0: Data = kitViewAddLevel(d2, w), o: Data = BREAK ? { ...o0, scenarios: { ...o0.scenarios, kitView: { ...o0.scenarios.kitView, ways: o0.scenarios.kitView.ways.map((y: Data, i: number) => i === w ? y : d2.scenarios.kitView.ways[i]) } } } : o0;
        if (o.scenarios.kitView.ways[w].add?.laid === true && o.scenarios.kitView.ways[1 - w].add === undefined) alone++;
        try { const e = validateLevelData(o); if (e.length) throw new Error(e[0]); if (loadLevel(o).boxes.length === loadLevel(d2).boxes.length + 1) loaded++; } catch (e) { said.push(`way ${w}: ${String((e as Error)?.message ?? e).slice(0, 120)}`); } }
      row(fileErrs.length === 0 && loaded === 2 && alone === 2, `two ways that add a piece under the same id: the file validates (${fileErrs.length} errors) and each way's picture loads with its own piece (${loaded} of 2), the other way's \`add\` not riding along (${alone} of 2)${said.length ? ' — ' + said.join('; ') : ''}`); }
    // WHAT THE VALIDATOR TAKES, THE PICTURE'S loadLevel TAKES: a way's added records get the level format's own rule for a box and a light under the
    // block's name — a lamp with only id / pos / group, a box with a flag nobody knows and a yaw that is no number are refused by the file's validator
    // (they passed it, and died at the picture's boot); a lamp whose `fixture` is a box added beside it is taken, and loads. (The break: whole records.)
    { const thin: Data = BREAK ? { ...lamp0, id: 'kv_thin', group: 'kv_add' } : { id: 'kv_thin', pos: [ref[0], 2.2, ref[1] + 9], group: 'kv_add' }, odd: Data = BREAK ? add.boxes[0] : { ...add.boxes[0], flags: ['Nope'], yaw: 'x' };
      const eLamp = kv(withAdd({ lamps: [thin] })), eBox = kv(withAdd({ boxes: [odd] })), fix = withAdd({ boxes: add.boxes, lamps: [{ ...add.lamps[0], fixture: 'kv_add_box' }] }), eFix = kv(fix), under = [...eLamp, ...eBox].every(e => e.startsWith('scenarios.kitView.ways[0].add.'));
      let took = ''; try { const L2 = loadLevel(kitViewAddLevel(parseLevelData(JSON.stringify(fix)), 0)); took = L2.lights[L2.lights.length - 1].fixtureBox === L2.boxes.length - 1 ? 'loaded, the lamp on its box' : 'LOADED WITH THE FIXTURE LOST'; } catch (e) { took = 'REFUSED: ' + String((e as Error)?.message ?? e).slice(0, 120); }
      row(eLamp.some(e => e.includes("kind 'undefined'")) && eLamp.some(e => e.includes('dir must be')) && eLamp.some(e => e.includes('range must be')) && eBox.some(e => e.includes("flag 'Nope'")) && eBox.some(e => e.includes('yaw must be a number')) && under && eFix.length === 0 && took.startsWith('loaded'),
        `a way's added records get the level's own rule for a box and a light, under the block's name: a lamp of id / pos / group alone is refused (${eLamp.length} errors), a box with an unknown flag and a yaw that is no number is refused (${eBox.length}), a lamp fixed to a box added beside it is taken (${eFix.length} errors; ${took})`); }
    const warn = console.warn; let play: Data = null, strict = '', lost: Data = null; console.warn = () => { /* the drop's own line */ };
    try { play = parseLevelData(text, { kitView: 'drop' }); const bad = JSON.stringify(withAdd({ boxes: [{ id: 'kv_bad' }] })); try { parseLevelData(bad); } catch (e) { strict = String((e as Error)?.message ?? e); } try { lost = parseLevelData(bad, { kitView: 'drop' }); } catch { lost = null; } } finally { console.warn = warn; }
    const mission = loadLevel(BREAK ? kitViewAddLevel(play, 0) : play), plain = loadLevel(parseLevelData(R.text));
    const onSet = kv(withAdd(add, { set: 'nowhere' })), clash = kv(withAdd({ boxes: [{ ...add.boxes[0], id: copy.boxes[0].id }] }));
    row(mission.boxes.length === plain.boxes.length && mission.lights.length === plain.lights.length && strict.includes('scenarios.kitView') && !!lost && lost.scenarios?.kitView === undefined && onSet.some(e => e.includes('.add')) && clash.some(e => e.includes('.add.boxes[0].id')),
      `a way's \`add\` is the picture's alone: the mission parsed to play loads ${mission.boxes.length} boxes and ${mission.lights.length} lights (the level's own ${plain.boxes.length} and ${plain.lights.length}); a broken one is refused by every tool (${strict ? 'said' : 'NOT SAID'}) and left out with the whole block of a mission to play (${lost ? (lost.scenarios?.kitView === undefined ? 'the block gone' : 'THE BLOCK KEPT') : 'THE MISSION REFUSED'}); on a way with a set (${onSet.filter(e => e.includes('.add')).length}) and under an id the level has (${clash.filter(e => e.includes('.id')).length}) the validator refuses it`); }
  // …and through the level validator, in a copy of the records office's data (way 1 put on the set)
  const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const copy = JSON.parse(R.text); copy.scenarios.kitView = { sets: { porch: SET }, ways: [copy.scenarios.kitView.ways[0], { door: 'set_door', set: 'porch' }] };
  const e1: string[] = validateLevelData(copy).filter((e: string) => e.includes('kitView'));
  copy.scenarios.kitView.ways[1] = { door: 'records_west', set: 'porch' }; const e2: string[] = validateLevelData(copy).filter((e: string) => e.includes('kitView'));
  copy.scenarios.kitView.ways[1] = { span: [[22.9, 10], [24.1, 10]], set: 'porch', kind: 'wall', inside: 0 }; const e3: string[] = validateLevelData(copy).filter((e: string) => e.includes('kitView'));
  row(e1.length === 0 && e3.length === 0 && e2.length > 0, `the level validator takes a block with a set (a door of the set's, a span on it) and refuses a level's door on a set way${e1.length + e3.length ? ' — ' + [...e1, ...e3].slice(0, 2).join('; ') : ''}${e2.length ? ` ('${e2[0].slice(0, 90)}')` : ''}`);
}

// ───────────────────────────────────────────── F. the set loader ─────────────────────────────────────────────
async function loader(names: string[]) {
  say('\n=== F. the set loader: a set laid over a real level, as ?kitview loads it');
  const { kitViewSetLevel, kitViewSetOf, kitViewWayOfQuery, kitViewWayOfLink, kitViewSetQuery, KIT_SET } = await import(`${ROOT}/src/host/kitViewSet.ts`);
  const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  // WITHOUT A SET: the same object, the same Level — every level file asked about, every way a link can name
  { let asks = 0, same = 0, loads = 0, sets = 0, files = 0; const bad: string[] = [];
    for (const name of names) { const L = await levelOf(name); if (name === 'office') continue; const data = parseLevelData(L.text), a = JSON.stringify(loadLevel(data));
      // (a way whose block names a set is the loader's to swap — another object, counted apart; every other ask, the same one)
      for (let k = 0; k < 4; k++) { const set = !!kitViewSetOf(data, k), out = kitViewSetLevel(data, k); if (set) { sets++; if (out === data) bad.push(`${name} way ${k}: a set, and nothing swapped`); continue; } asks++; if (out === data) same++; else bad.push(`${name} way ${k}`); }
      const k2 = kitViewWayOfQuery('2', data); if (kitViewSetOf(data, k2)) continue;
      files++; if (JSON.stringify(loadLevel(kitViewSetLevel(data, k2))) === a) loads++; else bad.push(`${name} loads another Level`); }
    row(same === asks && loads === files && !bad.length, `a level with no set on the way comes back THE SAME OBJECT: ${same} of ${asks} asks (${names.filter(x => x !== 'office').length} level files, ways 0 to 3; ${sets} more asks name a set and are swapped), and each loads to the same Level byte for byte (${loads} of ${files})${bad.length ? ' — ' + bad.slice(0, 4).join(', ') : ''}`); }
  { const d: Data = { scenarios: { roomClear: { team: {}, starts: [{}, {}] } } }, got = [null, '1', '2', '3', '9', 'any'].map(w => kitViewWayOfQuery(w, d)), solo = kitViewWayOfQuery('2', { scenarios: {} });
    row(got.join() === '0,0,1,2,2,0' && solo === 0, `the way a link names is folded as the game folds it (absent, 1, 2, 3, 9, any on three starts → ${got.join(', ')}; way=2 on a level with one start → ${solo})`); }
  // THE WAY THE PAGE LAYS IS THE WAY THE MISSION STAGES (kitViewWayOfLink — main.ts bootLevel lays a way's set / `add` by it): only a room clear has a way
  // of its own. Every row of the mission list and the solo night, as the start page builds its link, with `way` absent, 2, 9 and any, on three starts: a
  // room clear's (the kind as the page starts it, scenarioList.ts specOfQuery) is its `way` folded, every other kind's is 0 — as the child's stagedWay
  // reads the game (roomClear.way, else 0). (The break: the link's `way` whatever the kind, as it was — a rescue's `way=2` laid the second way.)
  { const { ALL_MISSIONS, specOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`), { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`), d: Data = { scenarios: { roomClear: { team: {}, starts: [{}, {}] } } };
    const links = ['', 'squad4', 'squad4&quiet', ...(ALL_MISSIONS as Data[]).map(e => String(scenarioQuery(e)).replace(/^\?/, ''))], bad: string[] = []; let asks = 0, zero = 0;
    for (const own of links) for (const w of [null, '2', '9', 'any']) { const q = new URLSearchParams(own); if (w !== null) q.set('way', w); asks++;
      const rc = specOfQuery(q)?.kind === 'roomclear', want = rc ? kitViewWayOfQuery(w, d) : 0, got = BREAK ? kitViewWayOfQuery(w, d) : kitViewWayOfLink(q, d); if (!rc) zero++; if (got !== want) bad.push(`'?${q.toString()}' → way ${got}, the mission stages ${want}`); }
    row(bad.length === 0 && zero > 0 && zero < asks, `the way the page lays is the way the mission stages: ${asks - bad.length} of ${asks} links (${links.length} missions' links × way absent, 2, 9, any; ${zero} of no room clear, way 0 whatever \`way\` says)${bad.length ? ' — NOT: ' + bad.slice(0, 3).join(' · ') : ''}`); }
  // THE SET'S MEN ARE THE MISSION'S: every row of the mission list and the solo night, at every size its loadout can deploy it with, asked for as the start
  // page asks (game/loadout.ts squadSearch over scenarioQuery: no size written by hand) — the room clear the set is staged as has exactly the teammates the mission's own link stages. (A quiet
  // mission alone and the solo night carry NO size key: a room clear reads that as Sam and two.)
  { const { ALL_MISSIONS, specOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`), { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`), { squadSearch } = await import(`${ROOT}/src/game/loadout.ts`);
    const links: { id: string; own: string; n: number }[] = [{ id: 'solo-night', own: 'solo', n: 0 }];
    for (const e of ALL_MISSIONS as Data[]) for (const n of e.kind === 'quiet' ? [0, 1] : [0, 1, 2, 3, 4]) links.push({ id: e.id, own: (squadSearch(scenarioQuery(e), n, e.squad) as string).replace(/^\?/, ''), n });
    const bad: string[] = []; let bare = 0;
    for (const L of links) { const q = new URLSearchParams(L.own), set: URLSearchParams = kitViewSetQuery(q), was = specOfQuery(q); if (!q.has('squad') && !q.has('squad4')) bare++;
      if (BREAK && !q.has('squad')) set.delete('squad');   // (the break: the size the loader wrote for a link that carries none is dropped — the query as it was before the rule)
      const want = was ? was.squad : 0, got = specOfQuery(set);
      if (!got || got.kind !== 'roomclear' || got.squad !== want || want !== L.n || ['quiet', 'solo', 'rescue', 'nightbreach'].some(k => set.has(k))) bad.push(`${L.id} with ${L.n} ('?${L.own}' → '?${set.toString()}': Sam and ${got ? got.squad : '?'}, the mission's own Sam and ${want})`); }
    row(bad.length === 0, `the set's men are the mission's: ${links.length - bad.length} of ${links.length} links (every row of the mission list and the solo night, at every size it deploys with, built as the start page builds them; ${bare} carry no size key) stage a room clear of the set with the teammates the mission's own link stages${bad.length ? ' — NOT: ' + bad.slice(0, 4).join(' · ') + (bad.length > 4 ? ` · and ${bad.length - 4} more` : '') : ''}`); }
  const R = await levelOf('records');
  const gate: Data = { ref: SET.ref, boxes: SET.boxes.filter(b => b.id !== 'set_lintel'), lights: SET.lights };   // (the same wall with the door's leaf and lintel gone: an open gate)
  const cases: { level: string; query: string; ways: (base: Data) => Data[]; sets: Data; what: string }[] = [
    { level: 'records', query: await missionQuery('roomclear', 'records', 4, 2), ways: b => [b.scenarios.kitView.ways[0], { door: 'set_door', set: 'porch' }], sets: { porch: SET }, what: 'a room clear\'s second way on a set, its first the level\'s own' },
    { level: 'registry', query: await missionQuery('rescue', 'registry', 4), ways: () => [{ door: 'set_door', set: 'porch' }], sets: { porch: SET }, what: 'a rescue\'s only way on a set' },
    { level: 'records', query: await missionQuery('roomclear', 'records', 2), ways: () => [{ span: [[19.57, 10], [20.43, 10]], set: 'gate' }], sets: { gate }, what: 'a set with no leaf at all (an open gate)' },
  ];
  for (const C of cases) { if (!files.includes(C.level)) continue;
    const L = await levelOf(C.level), base: Data = parseLevelData(L.text), q = new URLSearchParams(C.query);
    const data: Data = { ...base, scenarios: { ...base.scenarios, kitView: { sets: C.sets, ways: C.ways(base) } } }, k = kitViewWayOfQuery(q.get('way'), data), T: Data = kitViewSetOf(data, k)?.set, w = `${C.level} way ${k} (${C.what})`;
    const before = JSON.stringify(data), made: Data = kitViewSetLevel(data, k);
    // (the break: the level's own first box in the set's place, the last stand-in gone, a sky that is nobody's)
    const out: Data = BREAK ? { ...made, boxes: [base.boxes[0], ...made.boxes.slice(1, -1)], sky: { zenith: [1, 1, 1], horizon: [1, 1, 1] } } : made;
    if (!T || made === data) { row(false, `${w}: the way names a set and the loader swapped nothing`); continue; }
    const nS = T.boxes.length, tail: Data[] = out.boxes.slice(nS);
    row(out.boxes.length === nS + 2 && T.boxes.every((b: Data, i: number) => out.boxes[i] === b) && tail.map(b => b.id).join() === `${KIT_SET.panel},${KIT_SET.led}` && tail.every(b => b.c[1] + b.h[1] < -10 && b.flags?.includes('NoPrimary') && b.flags?.includes('NoShadow')),
      `${w}: the boxes are the set's ${nS}, index for index, then the breaker's two stand-ins sunk out of every ray and raster — ${out.boxes.length} boxes, not one of the level's ${base.boxes.length}`);
    const dirs = base.lights.filter((l: Data) => l.kind === 'dir'), doorIds = out.doors.map((d: Data) => d.id).join();
    row(doorIds === (T.doors?.length ? T.doors.map((d: Data) => d.id).join() : KIT_SET.door) && out.lights.length === dirs.length + (T.lights?.length ?? 0) && dirs.every((l: Data) => out.lights.includes(l)) && out.lights.some((l: Data) => l.id === 'moon') && !out.props.length && !out.routes.length && !out.switchables.length && !out.devices.length,
      `${w}: the doors are ${T.doors?.length ? 'the set\'s' : 'the one stand-in leaf'} (${doorIds}), the lamps the set's and the level's ${dirs.length} directional (${dirs.map((l: Data) => l.id).join(', ')}); no prop, route, switchable or device of the level's`);
    const keep = ['version', 'name', 'meta', 'floors', 'materials', 'surfaces', 'sky'], lost = keep.filter(key => out[key] !== base[key]), dayOk = !base.daylight === !out.daylight && (!base.daylight || (out.daylight.sun === base.daylight.sun && out.daylight.sky === base.daylight.sky && out.daylight.haze === base.daylight.haze && out.daylight.exposure === base.daylight.exposure));
    row(!lost.length && dayOk && JSON.stringify(data) === before, `${w}: the look is the level's — ${keep.join(', ')} are the very values (${Object.keys(out.materials).length} materials, sky zenith ${pt(out.sky.zenith)})${base.daylight ? ', the day\'s sun and sky' : ''}; the data handed in is not written to${lost.length ? ' — NOT the level\'s: ' + lost.join(', ') : ''}`);
    const errs: string[] = validateLevelData(out); let level: Data = null, threw = '';
    try { level = loadLevel(out); } catch (e) { threw = String((e as Error)?.message ?? e).split('\n').slice(0, 2).join(' '); }
    row(errs.length === 0 && !!level && level.boxes.length === out.boxes.length && T.boxes.every((b: Data, i: number) => level.boxes[i].c.join() === b.c.join()), `${w}: the level validator and the real loadLevel take it${errs.length ? ' — ' + errs.slice(0, 3).join('; ') : threw ? ' — ' + threw.slice(0, 200) : `: ${level.boxes.length} boxes, ${level.doors.length} door${level.doors.length === 1 ? '' : 's'}, ${level.lights.length} lights`}`);
    const Y: Data = out.scenarios.kitView.ways[k], P = kitViewPlanWay(out, out.scenarios.kitView, Y, [0, 0]), alone = kitViewPlanWay({ boxes: [], doors: [] }, { sets: C.sets }, data.scenarios.kitView.ways[k], [0, 0]);
    row(P.problems.length === 0 && P.fit === 5 && JSON.stringify(P) === JSON.stringify(alone), `${w}: its block still plans, with no problems and five places, the plan of the set alone to the byte${P.problems.length ? ' — ' + P.problems.join(' · ') : ''}`);
    const M = out.scenarios.roomClear?.rooms?.[0]?.marks?.[0], far = M ? Math.min(...P.slots.map(p => dist(p, [M.pos[0], M.pos[2]]))) : 0, leaf = out.doors.find((d: Data) => d.id === KIT_SET.door);
    row(!!M && far >= KIT_SET.apart && (!leaf || dist(leaf.hinge, P.anchor.mid) > 20), `${w}: the stand-in man is ${f2(far)} m from the nearest place of the team (${KIT_SET.apart} at least)${M ? `, at ${pt([M.pos[0], M.pos[2]])}` : ''}${leaf ? `; the stand-in leaf is ${f2(dist(leaf.hinge, P.anchor.mid))} m from the anchor` : ''}`);
    // THE HEADLESS GAME on it: the room clear's own check, then the mission's own query staged
    if (!level) { row(false, `${w}: no level to stand a game on`); continue; }
    try {
      const { standUp } = await import('./headless.ts'), { checkStructure, ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`), { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`), { specOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      const H = await standUp({ level, seed: 1 }), g = H.game, way0 = ROOMCLEAR.way;
      { const v = q.get('way'); ROOMCLEAR.way = v !== null && /^\d+$/.test(v) ? +v : 0; }   // (host/profile.ts, the page's own line)
      const bad: string[] = checkStructure(g), st = startFromQuery(g, kitViewSetQuery(q));
      row(bad.length === 0, `${w}: the room clear's own check (checkStructure) has nothing to say of the stand-in structure${bad.length ? ' — ' + bad.slice(0, 3).join(' · ') : ''}`);
      const size: number = specOfQuery(q)?.squad ?? 0, men: Data[] = [g.player, ...g.nightBreach.ops], off = men.map((m, i) => dist([m.char.pos[0], m.char.pos[2]], P.slots[i] ?? [1e9, 1e9]));
      row(!st.why && g.roomClear.active && g.roomClear.way === k && men.length === size + 1 && g.level.scenarios.kitView.ways[g.roomClear.way]?.set !== undefined && !!(P.anchor.door === null || g.doors.byName(P.anchor.door)),
        `${w}: '?${kitViewSetQuery(q).toString()}' (the mission's own '?${C.query}') stages a room clear on it — way ${g.roomClear.way}, Sam and ${men.length - 1}, the block's way there names the set${P.anchor.door ? `, its door '${P.anchor.door}' is a leaf of the game's` : ''}${st.why ? ' — REFUSED: ' + st.why : ''}`);
      row(off.every(d => d < 0.6), `${w}: the team starts on the plan's places (the set's ref side) — ${off.map(f2).join(', ')} m off them`);
      for (let i = 0; i < 180; i++) H.step(1 / 60);
      row(g.roomClear.active && !g.roomClear.end && !g.player.down && g.guards.length === men.length, `${w}: three seconds on it is still up with nobody down and nobody on the floor but the team and the one stand-in man (${g.guards.length} characters besides Sam: ${g.guards.length - g.nightBreach.ops.length} defender)`);
      ROOMCLEAR.way = way0; if (g.roomClear.active) g.roomClear.stop();
    } catch (e) { row(false, `${w}: the headless game could not be stood on it: ${String((e as Error)?.stack ?? e).slice(0, 300)}`); }
  }
  // A BROKEN BLOCK DOES NOT TAKE THE MISSION DOWN: the level to PLAY parses with the block left out (main.ts bootLevel without ?kitview); the picture's own page
  // and every tool — this one, level-validate — refuse it
  { const base: Data = JSON.parse(R.text), bad: Data = { ...base, scenarios: { ...base.scenarios, kitView: { sets: { porch: { ...SET, boxes: SET.boxes.map((b: Data, i: number) => i ? b : { ...b, material: 'no_such_paint' }) } }, ways: [base.scenarios.kitView.ways[0], { door: 'set_door', set: 'porch' }] } } }, text = JSON.stringify(bad);
    let strict = '', play: Data = null; const warn = console.warn, said: string[] = []; console.warn = (...a: unknown[]) => { said.push(a.map(String).join(' ')); };
    try { try { parseLevelData(text); } catch (e) { strict = String((e as Error)?.message ?? e); } try { play = parseLevelData(text, BREAK ? {} : { kitView: 'drop' }); } catch { play = null; } } finally { console.warn = warn; }
    row(/scenarios\.kitView/.test(strict) && !!play && play.scenarios.kitView === undefined && !!play.scenarios.roomClear && said.length === 1 && validateLevelData(bad).some((e: string) => e.startsWith('scenarios.kitView')),
      `a level whose kitView block is broken (a set box painted with a material the file does not have): refused by the strict parse (${strict ? 'yes' : 'NO'}: the ?kitview page, every tool), and parsed for a mission to play with the block left out and the room clear kept (${play ? 'yes' : 'NO'}), said once (${said.length} warning${said.length === 1 ? '' : 's'})`); }
  // (…and a way with NO set in a block that has one elsewhere: the level itself)
  { const base: Data = parseLevelData(R.text), data: Data = { ...base, scenarios: { ...base.scenarios, kitView: { sets: { porch: SET }, ways: [base.scenarios.kitView.ways[0], { door: 'set_door', set: 'porch' }] } } }, k = BREAK ? 1 : 0;
    row(kitViewSetLevel(data, k) === data && kitViewSetLevel(data, 5) === data, `records way ${k}, the level's own in a block whose OTHER way is on a set: untouched, the same object (a way past the block's: the same)`); }
}

// ───────────────────────────────────────────── E. the dry run ─────────────────────────────────────────────
/** an anchor proposed from the level's own way-in data (see the head): the way to plan, and how it was come by */
function propose(L: { data: Data; floor: KitPlanFloor }, st: Data): { way: KitViewWayIn | null; how: string; nearest: string } {
  const B: Data[] = L.data.boxes, ref = refOf(st), F = L.floor;
  const doors = (L.data.doors as Data[]).map(d => ({ d, m: dist([d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2], ref) })).sort((a, b) => a.m - b.m);
  const nearest = doors.length ? `${doors[0].d.id} ${f2(doors[0].m)} m${doors[0].d.exterior ? '' : ' (interior)'}` : 'none';
  if (doors.length && doors[0].m <= DOOR_M) return { way: { door: doors[0].d.id }, how: 'the nearest door', nearest };
  const gapTo = (b: Data, x: number, z: number) => { const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0), dx = x - b.c[0], dz = z - b.c[2], lx = c * dx - s * dz, lz = s * dx + c * dz; return Math.hypot(lx - Math.max(-b.h[0], Math.min(b.h[0], lx)), lz - Math.max(-b.h[2], Math.min(b.h[2], lz))); };
  const tall = B.filter(b => !(b.flags ?? []).includes('NoShadow') && b.c[1] - b.h[1] <= 1.5 && b.c[1] + b.h[1] >= 1.5), inWall = (x: number, z: number) => tall.find(b => gapTo(b, x, z) < 0.02);
  // A GAP: along x or z through a cell near the start, a run of open floor between two tall things with open floor before and behind it
  let best: { span: [V2, V2]; m: number } | null = null;
  for (const ax of [0, 1]) for (let u = -SEEK_M; u <= SEEK_M; u += 0.25) { const fixed = ref[1 - ax] + u, at = (v: number): V2 => ax === 0 ? [v, fixed] : [fixed, v];
    let from: number | null = null;
    for (let v = ref[ax] - SEEK_M; v <= ref[ax] + SEEK_M + 0.05; v += 0.05) { const p = at(v), w = inWall(p[0], p[1]);
      if (w) { if (from !== null && from > -Infinity) { const len = v - from, mid = at((from + v) / 2), nrm: V2 = ax === 0 ? [0, 1] : [1, 0];
          const open = [-2, -1.25, 1.25, 2].every(o => !F.blocked(mid[0] + nrm[0] * o, mid[1] + nrm[1] * o)) && !F.blocked(mid[0], mid[1]);
          const thin = [at(from - 0.1), at(v + 0.1)].every(q => [-1.5, 1.5].every(o => !inWall(q[0] + nrm[0] * o, q[1] + nrm[1] * o)));   // (a wall's end, not a building's flank)
          const m = dist(mid, ref), aDoor = (L.data.doors as Data[]).some(d => dist([d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2], mid) < Math.max(1, len / 2));
          if (len >= GAP_M[0] && len <= GAP_M[1] && open && thin && !aDoor && m <= SEEK_M && (!best || m < best.m - 0.3 || (Math.abs(m - best.m) <= 0.3 && len < dist(best.span[0], best.span[1])))) best = { span: [at(from), at(v)], m }; }
        from = v + 0.05; } else if (from === null) from = -Infinity; } }
  // THE WALL HE FACES: the first tall thing down his own line
  const yaw = st.samYaw ?? 0, dir: V2 = [Math.sin(yaw), Math.cos(yaw)];
  let wall: { span: [V2, V2]; m: number } | null = null, faced = true;
  for (let d = 0.3; d <= SEEK_M && !wall; d += 0.05) { const x = ref[0] + dir[0] * d, z = ref[1] + dir[1] * d, b = inWall(x, z); if (!b) continue;
    const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0), long: V2 = b.h[0] >= b.h[2] ? [c, -s] : [s, c], al = (x - b.c[0]) * long[0] + (z - b.c[2]) * long[1], half = Math.max(b.h[0], b.h[2]), a0 = Math.max(-half, Math.min(half - 1.2, al - 0.6));
    if (half >= 0.6 && Math.min(b.h[0], b.h[2]) <= 0.6) wall = { span: [[b.c[0] + long[0] * a0, b.c[2] + long[1] * a0], [b.c[0] + long[0] * (a0 + 1.2), b.c[2] + long[1] * (a0 + 1.2)]], m: d }; else break; }
  // (…else the nearest stretch of wall to him)
  if (!wall) { const near = tall.filter(b => Math.max(b.h[0], b.h[2]) >= 0.6 && Math.min(b.h[0], b.h[2]) <= 0.6 && b.c[1] + b.h[1] >= 1.8).map(b => ({ b, d: gapTo(b, ref[0], ref[1]) })).filter(o => o.d > 0.3 && o.d <= SEEK_M).sort((p, q) => p.d - q.d)[0];
    if (near) { const b = near.b, c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0), long: V2 = b.h[0] >= b.h[2] ? [c, -s] : [s, c], al = (ref[0] - b.c[0]) * long[0] + (ref[1] - b.c[2]) * long[1], half = Math.max(b.h[0], b.h[2]), a0 = Math.max(-half, Math.min(half - 1.2, al - 0.6));
      wall = { span: [[b.c[0] + long[0] * a0, b.c[2] + long[1] * a0], [b.c[0] + long[0] * (a0 + 1.2), b.c[2] + long[1] * (a0 + 1.2)]], m: near.d }; faced = false; } }
  const charges = L.data.scenarios?.roomClear?.wallCharges > 0;
  const B0 = best as { span: [V2, V2]; m: number } | null;
  if (wall && (charges || !B0)) return { way: { span: wall.span }, how: `the ${faced ? 'wall he faces' : 'nearest wall'}, ${f2(wall.m)} m off${charges ? ' (the level issues wall charges)' : ''}`, nearest };
  if (B0) return { way: { span: B0.span }, how: `a gap ${f2(dist(B0.span[0], B0.span[1]))} m wide, ${f2(B0.m)} m off`, nearest };
  return { way: null, how: 'nothing to stand at within reach', nearest };
}
/** NO DEVICE REPORTS IN A PICTURE (host/kitView.ts kitViewInert, said with every park()). The fixture level's own cameras, each tried at the door nearest
 *  the floor it looks at: a bare way on that door from the lens's side, Sam held on the plan's place for him with the light meter held bright (headless the
 *  meter is the script's: player.visibility), DEVICE_SECS of the game's own steps. THE CONTROL — the game as it is, nothing said: a lens reports (else the
 *  row has no teeth, and FAILS for that). THE PICTURE — the same with the child's word said before every step, as park() says it: no report in the devices'
 *  log, the floor never up, no alarm placed. (The break: the word not said.) */
const DEVICE_SECS = 8, DEVICE_LIT = 0.8;
async function inert(base: Data, link: string, standUp: Data, startFromQuery: Data, loadLevel: Data) {
  const { kitViewInert } = await import(`${ROOT}/src/host/kitView.ts`), floor = kitPlanFloor(base.boxes);
  const cams: Data[] = (base.devices ?? []).filter((d: Data) => d.kind === 'camera'), mid = (d: Data): V2 => [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2];
  const run = async (P: KitViewPlanned, held: boolean) => { const H = await standUp({ level: loadLevel(base), seed: 1 }), g = H.game; startFromQuery(g, new URLSearchParams(link));
    const at: [number, number, number] = [P.slots[0][0], 0, P.slots[0][1]]; let first = -1;
    for (let t = 0; t < DEVICE_SECS; t += 1 / 60) { if (held) kitViewInert(g); g.teleportPlayer(at); g.player.visibility = DEVICE_LIT; H.step(1 / 60); if (first < 0 && (g.devices.log.length || g.escalation > 0)) first = t; }
    const o = { log: g.devices.log.map((r: Data) => `${r.device} ${r.what}`) as string[], level: g.escalation as number, placed: !!g.alarm.placed, first }; if (g.quiet.active) g.quiet.stop(); return o; };
  for (const c of cams) { const yaw = c.sweep ? (c.sweep[0] + c.sweep[1]) / 2 : c.yaw ?? 0, seen: V2 = [c.pos[0] + Math.sin(yaw) * 2.5, c.pos[2] + Math.cos(yaw) * 2.5];
    for (const d of [...base.doors].sort((p: Data, q: Data) => dist(mid(p), seen) - dist(mid(q), seen)).slice(0, 2)) { if (dist(mid(d), seen) > 6) continue;
      const P = kitViewPlan(base, { door: d.id, ref: seen }, seen, { floor }), wild = await run(P, false); if (!wild.log.length) continue;
      const pic = await run(P, !BREAK);
      row(pic.log.length === 0 && pic.level === 0 && !pic.placed, `a device watching the stack reports nothing in a picture: Sam on the plan's place at '${d.id}' ${pt(P.slots[0])} under the lens '${c.id}', the meter held at ${DEVICE_LIT} for ${DEVICE_SECS} s — the game as it is: ${wild.log.join(', ')} (the first at ${wild.first.toFixed(1)} s), the floor at ${wild.level}; with the picture's word said at every step (kitViewInert): ${pic.log.length ? pic.log.join(', ') : 'no report'}, the floor at ${pic.level}, ${pic.placed ? 'AN ALARM PLACED' : 'no alarm placed'}`);
      return; } }
  row(false, `a device watching the stack reports nothing in a picture: NO LENS of the fixture level's ${cams.length} reported on a lit Sam at a door it looks at — the row has no teeth (the fixture lost its cameras, or the devices sense nothing on this stand)`);
}
// ───────────────────────────────────────────── G. a quiet mission, a lone Sam ─────────────────────────────────────────────
async function quietAlone() {
  say('\n=== G. a quiet mission, a lone Sam: the counting house given a block on its west gate (a fixture held here, not the level\'s file)');
  if (!files.includes('vault')) { say('  (no levels/vault.json)'); return; }
  const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { kitViewSetLevel, kitViewSetQuery } = await import(`${ROOT}/src/host/kitViewSet.ts`);
  const L = await levelOf('vault'), base: Data = parseLevelData(L.text), sp = base.mission.playerSpawn, block: Data = { ways: [{ door: 'gate_w', ref: [sp[0], sp[2]] }] }, data: Data = { ...base, scenarios: { ...base.scenarios, kitView: block } };
  const errs: string[] = validateLevelData(data).filter((e: string) => e.includes('kitView')), P = kitViewPlanWay(data, block, block.ways[0], [sp[0], sp[2]], { floor: L.floor });
  row(errs.length === 0 && P.problems.length === 0 && P.anchor.door === 'gate_w' && P.fit === 5, `vault (quiet, alone) on gate_w: the block passes the level validator and plans from Sam's own start with no problems — ${P.fit} of 5 places fit${errs.length ? ' — ' + errs.slice(0, 2).join('; ') : ''}${P.problems.length ? ' — ' + P.problems.join(' · ') : ''}`);
  const want = BREAK ? 1 : 0;   // (the break: a teammate is expected of a mission that is played alone)
  const own = await missionQuery('quiet', 'vault');   // (the counting house's own link, as the start page asks: `levelFile=vault.json&quiet`)
  try { const { standUp } = await import('./headless.ts'), { startFromQuery, teamOf } = await import(`${ROOT}/src/game/scenarioRun.ts`);
    { const H = await standUp({ level: loadLevel(data), seed: 1 }), g = H.game, st = startFromQuery(g, new URLSearchParams(own)), p = g.player.char.pos;
      // (a quiet mission DEALS Sam's start, so the block writes the side the picture is taken from: `ref` — C's row)
      row(!st.why && g.quiet.active && !g.roomClear.active && teamOf(g).length === want && !g.col.nav.isBlocked(P.slots[0][0], P.slots[0][1]) && !!g.doors.byName('gate_w'),
        `vault (quiet, alone) on gate_w: '?${own}' (the mission's own link: no size key — alone is the kind's own size) stages the quiet mission with Sam and ${teamOf(g).length} (the picture's men: a lone Sam; the mission dealt him a start ${f2(dist([p[0], p[2]], P.anchor.mid))} m from the gate — the block's \`ref\` says which side the picture is taken from), his place ${pt(P.slots[0])} free floor on the game's own grid${st.why ? ' — REFUSED: ' + st.why : ''}`);
      if (g.quiet.active) g.quiet.stop(); }
    { const set: Data = { ...base, scenarios: { ...base.scenarios, kitView: { sets: { porch: SET }, ways: [{ door: 'set_door', set: 'porch' }] } } }, q = kitViewSetQuery(new URLSearchParams(own));
      const H = await standUp({ level: loadLevel(kitViewSetLevel(set, 0)), seed: 1 }), g = H.game, st = startFromQuery(g, q);
      row(!st.why && g.roomClear.active && g.nightBreach.ops.length === want, `vault (quiet, alone) on a bespoke set: '?${q.toString()}' (the mission's own '?${own}') stages a room clear of the set with Sam and ${g.nightBreach.ops.length} — a lone Sam, as the mission is played${st.why ? ' — REFUSED: ' + st.why : ''}`);
      if (g.roomClear.active) g.roomClear.stop();
      // (THE PAGE CHECK'S FIXTURE — tools/qa/kitview-levels.cjs's dress row needs a quiet or a solo mission on a set, and no level file stands one: this
      //  very fixture written out as a level file where KITPLAN_FIXTURE=<path> names one — the file's own text with the block put in, parsed as the picture's
      //  page parses it before a byte is written. Never committed: the command is in that tool's head.)
      if (FIXTURE && !BREAK) { try { const raw = JSON.parse(L.text), text = JSON.stringify({ ...raw, scenarios: { ...raw.scenarios, kitView: set.scenarios.kitView } }); parseLevelData(text); if (!existsSync(dirname(resolve(FIXTURE)))) mkdirSync(dirname(resolve(FIXTURE)), { recursive: true }); writeFileSync(FIXTURE, text);
          console.log(`  written: ${FIXTURE} (the quiet fixture on the set, for tools/qa/kitview-levels.cjs LEVEL=<its name> KIND=quiet | solo)`); } catch (err) { console.log(`  (the fixture's file was not written: ${String((err as Error)?.message ?? err).slice(0, 200)})`); } } }
    // THE SET'S MEN ARE DRESSED AS THE MISSION'S ARE (a set is staged as a room clear, which dressed a quiet mission's men in the issue dress with the rifle in
    // front): the mission as itself against the same link on the set with the dress main.ts says in ?kitview's own window (host/kitViewSet.ts kitViewSetDress →
    // scene/look.ts setSuitAs, game/kitanim.ts KITANIM.sling) — who wears the sneaking suit (game/cast.ts sneakSuit, man for man) and where the rifle hangs
    // (kitSlingFront). The look's two switches AND THE KIT'S (KITANIM.on / equip) are held on for the row and everything is put back after it: unsaid, the set's
    // rifle hangs in FRONT on both stands, and the row holds that too — so the suit said without the sling is red. (The break: the dress not said.)
    { const { kitViewSetDress } = await import(`${ROOT}/src/host/kitViewSet.ts`), { LOOK, setSuitAs, suitAs } = await import(`${ROOT}/src/scene/look.ts`), { sneakSuit } = await import(`${ROOT}/src/game/cast.ts`), { KITANIM, kitSlingFront } = await import(`${ROOT}/src/game/kitanim.ts`);
      const was = { on: LOOK.on, suit: LOOK.suit, kit: KITANIM.on, equip: KITANIM.equip, sling: KITANIM.sling, as: suitAs() }, set: Data = { ...base, scenarios: { ...base.scenarios, kitView: { sets: { porch: SET }, ways: [{ door: 'set_door', set: 'porch' }] } } };
      // (the kit's own switch is held at each READING: off — the FROZEN stand, which every standUp puts back — kitSlingFront answers 'on his back' whatever is
      //  said, and the sling half of this row could not fail there)
      const worn = (g: Data) => { KITANIM.on = true; KITANIM.equip = true; return wornNow(g); }, wornNow = (g: Data) => [g.player.char, ...teamOf(g).map((x: Data) => x.char)].map(c => sneakSuit(g, c) ? 'suit' : 'issue').join(' ') + (kitSlingFront(g) ? ' · rifle in front' : ' · rifle on his back');
      const out: string[] = []; let ok = true;
      try { LOOK.on = true; LOOK.suit = true;
        for (const [what, link] of [['a quiet mission alone', own], ['a quiet mission as two', await missionQuery('quiet', 'vault', 1)], ['the solo night', 'solo']] as const) { const q0 = new URLSearchParams(link);
          const A = await standUp({ level: loadLevel(data), seed: 1 }), a = A.game; if (link !== 'solo') startFromQuery(a, q0); const real = worn(a); if (a.quiet.active) a.quiet.stop();
          const B = await standUp({ level: loadLevel(kitViewSetLevel(set, 0)), seed: 1 }), b = B.game, dress = kitViewSetDress(q0); startFromQuery(b, kitViewSetQuery(q0)); const bare = worn(b);
          if (dress && !BREAK) { setSuitAs(dress.suit); KITANIM.sling = dress.sling; } const got = worn(b); setSuitAs(was.as); KITANIM.sling = was.sling; if (b.roomClear.active) b.roomClear.stop();
          if (!(dress && got === real && real.startsWith('suit') && real.endsWith('back') && bare.endsWith('front'))) ok = false; out.push(`${what} ('?${link}'): as itself [${real}], on the set [${got}] (unsaid it was [${bare}])`); }
        const loud = kitViewSetDress(new URLSearchParams(await missionQuery('roomclear', 'records', 2))); if (loud !== null) ok = false; out.push(`a room clear's link: ${loud === null ? 'nothing said' : 'A DRESS SAID'}`);
      } finally { LOOK.on = was.on; LOOK.suit = was.suit; KITANIM.on = was.kit; KITANIM.equip = was.equip; setSuitAs(was.as); KITANIM.sling = was.sling; }
      await inert(base, own, standUp, startFromQuery, loadLevel);
      row(ok && suitAs() === was.as && KITANIM.on === was.kit, `a quiet mission's set dresses its men as the mission does — the sneaking suit on the same men, the rifle across the back — and a loud one's says nothing: ${out.join(' · ')}`); }
  } catch (e) { row(false, `vault (quiet, alone): the headless game could not be stood on it: ${String((e as Error)?.stack ?? e).slice(0, 300)}`); }
}
/** is the level's own way in good for the picture, or a candidate for a set — and why */
function verdict(P: KitViewPlanned | null, how: string): string {
  if (!P) return `SET — ${how}`;
  const why: string[] = [], K = KIT_PLAN;
  if (P.anchor.kind !== 'door') why.push(P.anchor.kind === 'wall' ? 'no door: a blank wall (no leaf for the door tools)' : 'no door: an open gate');
  if (P.fit < 5 || P.stepped > 3) why.push(`no free floor for five (${P.fit} fit, ${P.stepped} stepped over)`);
  if (P.anchor.kind !== 'wall' && P.inside < K.inM) why.push(`no room behind (${f2(P.inside)} m)`);
  if (P.indoors && P.anchor.exterior) why.push('the team starts INSIDE this outside door (the picture would look out)');
  if (P.indoors && P.out < 3) why.push(`indoors with no depth (${f2(P.out)} m in front)`);
  const walls = P.occluders.filter(o => o.why === 'line' && !/^(exterior|lived|dressing)/.test(o.group)).length; if (P.indoors && walls) why.push(`walled from the camera (${walls} boxes)`);
  if (why.length) return why.length === 1 && P.anchor.kind !== 'door' && !P.problems.length ? `SPAN or SET — ${why[0]}; the span itself plans cleanly` : `SET? — ${why.join('; ')}`;
  const block: string[] = []; if (P.stepped) block.push(`slots (${P.stepped} stepped over)`); if (!P.lane.free) block.push('the lane is shut'); const things = P.occluders.filter(o => !walls || /^(exterior|lived|dressing)/.test(o.group)).length; if (things) block.push(`${things} boxes in the camera's way to look at`);
  if (P.wall.top > 0 && P.wall.top < K.porchUp - 0.4) block.push(`a low wall (${P.wall.top} m)`);
  return block.length ? `own way in, with a block: ${block.join(', ')}` : 'own way in';
}
async function dryRun(only: string[]) {
  say('\n=== E. the dry run — every squad mission\'s every way in, with NO block (proposals; never a failure)');
  const { SCENARIOS, TRAINING_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const head = ['mission', 'level', 'way', 'block', 'anchor (proposed)', 'nearest door', 'kind', 'side', 'hand', 'fit', 'in front', 'behind', 'wall face / top', 'pane', 'occl', 'indoors', 'lane', 'problems', 'own way in or a set'];
  const lines: string[][] = []; let clean = 0, blocky = 0, total = 0;
  for (const e of [...SCENARIOS, ...TRAINING_MISSIONS] as Data[]) { if (e.kind === 'quiet') continue;
    const name = (e.level ?? 'office.json').replace(/\.json$/, ''); if (only.length && !only.includes(name)) continue;
    const L = await levelOf(name), S = L.data.scenarios, sts = starts(S, e.kind);
    sts.forEach((st, k) => { total++;
      if (!st?.sam) { lines.push([e.id, name, String(k), '', 'no team start in the file', '', '', '', '', '', '', '', '', '', '', '', '', '', 'SET — no start']); return; }
      const pr = propose(L, st), P = pr.way ? kitViewPlan(L.data, pr.way, refOf(st), { floor: L.floor }) : null, has = e.kind === 'roomclear' && S?.kitView?.ways?.[k] ? 'yes' : '';
      const v = verdict(P, pr.how); if (v === 'own way in') clean++; else if (v.startsWith('own')) blocky++;
      lines.push([e.id, name, `${k}${e.ways?.[k] ? ' ' + e.ways[k] : ''}`, has, pr.way ? `${pr.way.door ?? `span ${pt(pr.way.span![0])}–${pt(pr.way.span![1])}`}: ${pr.how}` : pr.how, pr.nearest,
        ...(P ? [P.anchor.kind + (P.anchor.steel ? ', steel' : '') + (P.anchor.locked ? ', locked' : '') + (P.anchor.kind === 'door' && !P.anchor.exterior ? ', interior' : ''), String(P.side), P.hand, `${P.fit}/5${P.stepped ? ` (${P.stepped} stepped)` : ''}`, f2(P.out), P.anchor.kind === 'wall' ? `0 (${f2(P.beyond)} past the wall)` : f2(P.inside), `${P.wall.face} / ${P.wall.top}`,
          P.pane ? `${P.pane.box} ${f2(P.pane.from)} m${P.pane.onWall ? ', in the wall' : ''}` : 'none', String(P.occluders.length), P.indoors ? 'yes' : 'no', P.lane.free ? 'free' : `shut ${f2(P.lane.clearM)} m`, P.problems.length ? P.problems.join(' · ') : 'none'] : ['', '', '', '', '', '', '', '', '', '', '', '']), v]); });
  }
  const md = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map(l => `| ${l.map(c => c.replace(/\|/g, '/')).join(' | ')} |`)].join('\n');
  say(md);
  const sets = lines.filter(l => l[l.length - 1].startsWith('SET')).length, spans = lines.filter(l => l[l.length - 1].startsWith('SPAN')).length;
  const tail = `${total} mission-ways · ${clean} plan cleanly on the level's own way in from the anchor alone · ${blocky} stand on their own way in but want something written in the block · ${spans} have no door but plan cleanly on a span (a wall to breach, an open gate: no leaf for the door tools, so a set is the other answer) · ${sets} are candidates for a bespoke set (the last column says why).`;
  console.log(`  dry run: ${tail}`);
  if (DRY_RUN && !only.length && !BREAK) { try { if (!existsSync(dirname(DRY_RUN))) mkdirSync(dirname(DRY_RUN), { recursive: true });
    writeFileSync(DRY_RUN, `# The Team & kit picture, per level: the dry run\n\n\`bun run tools/qa/kitview-plan.ts\` (src/host/kitViewPlan.ts over the level files; no block read, no browser, nothing staged). One row per squad\nmission-way: the anchor is PROPOSED (the nearest door to Sam's start within ${DOOR_M} m; else a gap in a wall within ${SEEK_M} m; else the wall he faces) and planned\nwith every other value worked out. \`fit\` = places of five on free floor, clear of boxes and each other; \`in front\` / \`behind\` = metres of free floor either\nside of the anchor; \`occl\` = boxes between the worked-out camera and the stage.\n\n${md}\n\n${tail}\n\nWhat this cannot see: free floor is the nav grid's question asked of the file's boxes (it agrees with the game's grid cell for cell), so loose props, door\nleaves and anything the game adds or takes at run time are not in it; the camera is the worked-out pin before the page's frame slides and scales it; a\nproposal is a guess from the start's position and facing (the right anchor for a level is its owner's call: floodlit's foot gate against the dark corner);\nwhether a row plays (a steel door refuses a charge, a frag beside glass) is the child's. Nothing here has been seen on a GPU.\n`);
      say(`  written: ${DRY_RUN}`); } catch (err) { console.log(`  (the dry run's file was not written: ${String((err as Error)?.message ?? err)})`); } }
}

const unknown = asked.filter(a => !files.includes(a));
if (unknown.length) { console.error(`unknown level${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')} (levels/*.json: ${files.join(', ')})`); process.exit(2); }
const withBlock: string[] = []; for (const f of asked.length ? asked : files) { const L = await levelOf(f); if (L.data.scenarios?.kitView) withBlock.push(f); }
console.log(`levels with a kitView block (${withBlock.length}${asked.length ? ' of those asked about' : ''}): ${withBlock.join(', ') || 'none'}`);
/** A LEVEL AND ITS LOOK TWIN CARRY THE SAME BLOCK: the start page reads `X.json` (ui/missions.ts kitViewWays), the picture's own page loads the look's file
 *  (main.ts, scene/look.ts LOOK_LEVELS) — a block in one and not the other, or two that differ, is a picture the page promises and the child cannot stage (or
 *  stages otherwise). To the byte: a set's paint is already written once for both (`material: 'look|plain'`) */
async function twins(names: string[]) {
  say('\n=== C2. a level and its look twin carry the same block');
  const { LOOK_LEVELS } = await import(`${ROOT}/src/scene/look.ts`) as { LOOK_LEVELS: Record<string, string> }; let n = 0;
  for (const [base, twin] of Object.entries(LOOK_LEVELS).map(([a, b]) => [a.replace(/\.json$/, ''), b.replace(/\.json$/, '')])) {
    if (!names.includes(base) && !names.includes(twin)) continue; if (!files.includes(base) || !files.includes(twin)) continue;
    const A = (await levelOf(base)).data.scenarios?.kitView, B0 = (await levelOf(twin)).data.scenarios?.kitView; if (A === undefined && B0 === undefined) continue; n++;
    const B = BREAK && B0 ? { ...B0, ways: (B0.ways as Data[]).slice(1) } : B0;   // (the break: the twin's first way gone)
    const a = JSON.stringify(A ?? null), b = JSON.stringify(B ?? null), where = (() => { if (!A || !B) return ''; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) { if (k !== 'ways') return ` — they differ in \`${k}\``; const i = (A.ways as Data[]).findIndex((y, j) => JSON.stringify(y) !== JSON.stringify(B.ways?.[j])); return ` — they differ in way ${i < 0 ? (A.ways as Data[]).length : i}`; } return ''; })();
    row(a === b, `${base} and ${twin}: the same \`scenarios.kitView\` in both files${a === b ? '' : !A ? ` — ONLY ${twin}.json has a block (the start page reads ${base}.json: no picture is ever asked for)` : !B ? ` — ONLY ${base}.json has a block (the picture's page loads ${twin}.json: it says \`none\`)` : where}`); }
  if (!n) say('  (no level asked about has a look twin and a block)');
}
/** EVERY CARD OPEN, EVERY SIZE: nobody's place within a body of anybody else's. The stack's card switch only changes who stands on which place; the FOURTH
 *  man's card walks him to a place of its own by Sam's jamb (kitPlanAct4 — what the picture stages him on), and on a wide opening that place as written was
 *  0.39 m from Sam's. Every way of every level with a block, as the page plans it (the child's two passes), and bare anchors of every width on open floor */
async function acting(names: string[]) {
  say('\n=== C3. every card open, every squad size: no man\'s place within a body of another\'s');
  const K = KIT_PLAN, clear = BREAK ? 0 : undefined;   // (the break: the fourth man's place as written, whoever stands there)
  const worst = (slots: readonly (readonly number[])[], a4: V2) => { let m = Infinity, at = '';
    for (let squad = 1; squad <= 4; squad++) for (let card = 1; card <= squad; card++) { const M = kitPlanStands(slots, a4, squad, card);
      for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) { const d = dist(M[i], M[j]); if (d < m) { m = d; at = `a squad of ${squad}, teammate ${card}'s card: places ${i} and ${j}`; } } }
    return { m, at }; };
  const asWritten = (P: { anchor: { mid: V2; n: V2; width: number }; s: V2 }): V2 => { const al = -(P.anchor.width / 2 + K.act4[0]); return [P.anchor.mid[0] + P.s[0] * al + P.anchor.n[0] * K.act4[1], P.anchor.mid[1] + P.s[1] * al + P.anchor.n[1] * K.act4[1]]; };
  for (const name of names) { const L = await levelOf(name), S = L.data.scenarios, KB = S?.kitView; if (!KB) continue;
    const st = starts(S, 'roomclear').filter(Boolean); if (!st.length) st.push({ sam: L.data.mission.playerSpawn });
    (KB.ways as Data[]).forEach((Y, k) => { const w = `${name} way ${k} (${Y.door ?? 'span'}${Y.set ? ', set ' + Y.set : ''})`, G = kitPlanGeometry(L.data, KB, Y, refOf(st[k] ?? st[0])); if (!G) return;
      const C = childPlan(G.level, Y, G.ref), P = C.P, F = kitPlanFloor(G.level.boxes, C.sunk), a4 = kitPlanAct4(P.anchor.mid, P.s, P.anchor.n, P.anchor.width, P.slots, (x, z) => !F.blocked(x, z), clear), W = worst(P.slots, a4), moved = dist(a4, asWritten(P));
      row(P.slots.length === 5 && W.m >= K.actClear - 1e-6 && !F.blocked(a4[0], a4[1]), `${w}: every card open at every size, no two men within ${K.actClear} m — the nearest ${f2(W.m)} m (${W.at}); the fourth man's acting place ${pt(a4)} on free floor, ${moved > 1e-9 ? `SLID ${f2(moved)} m toward the anchor's middle (as written it is ${f2(dist(asWritten(P), P.slots[0]))} m from Sam's)` : 'as written'}`); }); }
  // bare anchors on open floor, the planner's own places: a door's width to a yard gate's
  const widths = [0.86, 1.2, 1.5, 2, 2.56, 2.92, 3, 4, 6], said: string[] = []; let low = Infinity, onOpening = true;
  for (const width of widths) { const mid: V2 = [width / 2, 0], s: V2 = [1, 0], n: V2 = [0, 1], slots = kitPlanSlots([0, 0], [1, 0], width, n, 1, 0.12 + K.offFace, 0.12 + K.samOffFace, () => true).slots;
    const a4 = kitPlanAct4(mid, s, n, width, slots, () => true, clear), W = worst(slots, a4), al = a4[0] - mid[0]; low = Math.min(low, W.m); if (!(al <= 1e-9 && al >= -(width / 2 + K.act4[0]) - 1e-9)) onOpening = false;
    said.push(`${width} m: ${f2(W.m)} m${Math.abs(al + width / 2 + K.act4[0]) > 1e-9 ? ` (slid to ${f2(al + width / 2)} m from Sam's jamb)` : ''}`); }
  row(low >= K.actClear - 1e-6 && onOpening, `a bare anchor of any width (${widths[0]} to ${widths[widths.length - 1]} m, the planner's own places on open floor): no two men within ${K.actClear} m with any card open at any size, the fourth man's acting place between where it is written and the anchor's middle — ${said.join(' · ')}`);
  { const slots = kitPlanSlots([0, 0], [1, 0], 0.86, [0, 1], 1, 0.12 + K.offFace, 0.12 + K.samOffFace, () => true).slots, a = kitPlanAct4([0.43, 0], [1, 0], [0, 1], 0.86, slots), b: V2 = [0.43 - (0.43 + K.act4[0]), K.act4[1]];
    row(a[0] === b[0] && a[1] === b[1], `at a ${0.86} m door the acting place is the one written, to the bit (${pt(a)}): nothing staged on a door moves`); }
}
if (BREAK) console.log('KITPLAN_BREAK=1: the derived side is flipped, a block\'s second place is moved onto the wall, the loaded set is spoiled — rows below must FAIL');
await seam(asked.length ? asked : files);
if (!asked.length || asked.includes('records')) await parity();
await generic(withBlock);
await twins(asked.length ? asked : files);
await acting(withBlock);
await bespoke();
await loader(asked.length ? asked : files);
await dryRun(asked);
if (!asked.length || asked.includes('vault')) await quietAlone();
if (warnings) console.log(`\n${warnings} WARNING line${warnings === 1 ? '' : 's'} above (names by generated id: said, never failed)`);
console.log(`\nkitview-plan: ${passes} PASS, ${fails} FAIL${BREAK ? ' (under KITPLAN_BREAK=1: FAILs are the expected answer)' : ''}`);
process.exit(fails ? 1 : 0);

// The 'handleside' family: THE AI OPENS A DOOR FROM ITS HANDLE SIDE (src/game/handleside.ts HANDLE; the maintainer, 10-08: "open has to be on the handle side for AI").
// Every door of every level a mission is played on (the office and each scenario's own level file), from BOTH faces, with the one-way doors on.
//   bun run tools/qa/probes.ts handleside | handleside-spots | handleside-men | handleside-off
// All headless; nothing here looks at a picture.
//   handleside-spots  the place the rule deals for each face of each door (handleSpot): on that face, in the handle half of the frame, within reach of the
//                     handle (the long reach only where it says so), and on the face the leaf opens into clear of its sweep. The faces with only a long reach
//                     and the faces with no place are printed, not judged: they are the level's corners
//   handleside-men    real men under the AI's own walk (a scripted goal: nav path, their own contacts) — a teammate (operative) and a defender (hostile) — sent
//                     through every door from both faces, started in front of the MIDDLE of the leaf (on the pull face that is inside its sweep). The door's
//                     opening as tools/qa/handle-watch.ts judges it must be AT THE HANDLE: the handle half, within reach, out of the sweep on the pull face —
//                     or, on a face whose only place is the long reach, pulled from the handle half clear of the sweep. The leaf never comes round through
//                     its own opener, and he gets through
//   handleside-off    HANDLE.on off: the same walks on the office open doors from the middle of the leaf as they did (so handleside-men can go red), and the
//                     rule's counters stay at zero
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { HandleWatch, HANDLE_REACH, BODY_R, HANDLE_IN, type HandleRow } from './handle-watch.ts';
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { HANDLE, HANDLE_STATS, handleSpot } = await import(`${ROOT}/src/game/handleside.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { isOfficeFamily, withOfficeScript } = await import(`${ROOT}/src/scene/level.ts`);
const { order, endGuardScript } = await import(`${ROOT}/src/game/squad.ts`);
const { spawnUnit, despawnUnit, frameOf } = await import(`${ROOT}/src/game/guards.ts`);

const DT = 1 / 60, LONG_M = 1.5, WALK_SECS = 12;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
/** (headless.ts stands the harness up on the old double-acting leaves, where the rule is inert: the family turns the shipped doors on and puts back what it found) */
const guarded = (fn: () => Promise<boolean>) => async () => { const was = DOORWAY.oneWay, on = HANDLE.on; try { return await fn(); } finally { DOORWAY.oneWay = was; HANDLE.on = on; } };

const LEVELS: (string | undefined)[] = [undefined, ...new Set<string>(SCENARIOS.map((e: any) => e.level).filter(Boolean))];
const nameOf = (f?: string) => f ? f.replace(/\.json$/, '') : 'office';
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
async function boot(file?: string, rule = true): Promise<any> { DOORWAY.oneWay = true; HANDLE.on = rule; Math.random = seeded(7);
  return quiet(() => standUp({ uploadEvery: 4, ...(file ? { level: levelOfFile(file) } : {}) })); }

/** a point off a door's face: `along` m from the hinge along the closed leaf, `o` m out of face `f` (Doors.side's sign) */
const off = (d: any, f: number, o: number, along = d.def.width * 0.55): [number, number, number] => { const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c); return [d.def.hinge[0] + ux * along - uz * o * f, 0, d.def.hinge[1] + uz * along + ux * o * f]; };
const fresh = (d: any) => { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.locked = false; d.place(); };
const spots = (g: any, d: any, f: number): { from: number[]; to: number[] } | null => { const from = off(d, f, 1.1), to = off(d, -f, 1.5); const nav = g.col.nav; return nav.isBlocked(from[0], from[2]) || nav.isBlocked(to[0], to[2]) || nav.isBlocked(off(d, f, 0.6)[0], off(d, f, 0.6)[2]) ? null : { from, to }; };
function clearFloor(g: any) { g.godMode = true; g.playerInvisible = true; g.tune.civilians = false; for (const gd of [...g.guards]) if (gd.unit) despawnUnit(g, gd); g.guards.length = 0; }   // nobody but who the case stands
/** where p stands against d's frame, in the rule's own terms: its face (+1 = the frame's normal side), metres from the hinge, metres to the handle */
const against = (d: any, p: number[]) => { const F = frameOf(d), rx = p[0] - F.hx, rz = p[2] - F.hz, along = rx * F.ux + rz * F.uz, perp = rx * F.nx + rz * F.nz; return { side: (perp >= 0 ? 1 : -1) as 1 | -1, along, W: F.W as number, reach: Math.hypot(along - (F.W - HANDLE_IN), perp) }; };
const faceWord = (g: any, d: any, p: number[]) => g.doors.pullFace(d, p) ? 'pull face' : 'push face';
/** the watcher's own judgement (handle-watch.ts) of a man at p as d begins to open */
function seen(g: any, d: any, p: number[]): HandleRow { const A = against(d, p), pull = g.doors.pullFace(d, p), sweep = g.doors.swingOf(d).sweeps(p[0], p[2], BODY_R), how = d.pullT > 0 ? 'pull' : 'push';
  const why = A.along < A.W / 2 ? 'hinge' : A.reach > HANDLE_REACH ? 'far' : pull && sweep ? 'sweep' : '';
  return { t: 0, door: d.def.name, who: '', side: 'team', doing: '', how, face: pull ? 'pull' : 'push', along: +A.along.toFixed(2), W: +A.W.toFixed(2), off: 0, reach: +A.reach.toFixed(2), sweep, ok: !why, why }; }
const few = (a: string[], n = 8) => a.slice(0, n).join('\n    ') + (a.length > n ? `\n    … and ${a.length - n} more` : '');

// ---------------------------------------------------------------- handleside-spots
export const handlesideSpots = guarded(async () => {
  const F = family('handleside-spots: the place dealt for each face of each door is at its handle, and on the pull face outside the leaf\'s sweep');
  let faces = 0, far = 0, none = 0;
  for (const file of LEVELS) {
    const W = await boot(file), g = W.game, fails: string[] = [], notes: string[] = []; let n = 0;
    for (const d of g.doors.list) { fresh(d); for (const side of [1, -1] as const) {
      const S = handleSpot(g, d, side); n++; faces++;
      const word = faceWord(g, d, off(d, side, 0.5));   // (which face `side` is does not matter to the checks below: each is made of the place itself)
      if (!S) { none++; notes.push(`${d.def.name} ${side > 0 ? '+' : '−'}: no place`); continue; }
      const A = against(d, S.pos), pull = g.doors.pullFace(d, S.pos), sweep = g.doors.swingOf(d).sweeps(S.pos[0], S.pos[2], BODY_R), why: string[] = [];
      if (A.side !== side) why.push('on the other face');
      if (A.along < A.W / 2) why.push(`in the hinge half (${A.along.toFixed(2)} of ${A.W.toFixed(2)} m)`);
      if (A.reach > (S.far ? LONG_M : HANDLE_REACH) + 0.05) why.push(`${A.reach.toFixed(2)} m from the handle`);
      if (pull !== !!S.pull) why.push(`says ${S.pull ? 'pull' : 'push'}, stands on the ${pull ? 'pull' : 'push'} face`);
      if (pull && sweep) why.push('inside the sweep');
      if (g.col.nav.isBlocked(S.pos[0], S.pos[2]) && !S.far) notes.push(`${d.def.name} ${word}: off the walkers' grid`);
      if (S.far) { far++; notes.push(`${d.def.name} ${word}: the long reach, ${A.reach.toFixed(2)} m`); }
      if (why.length) fails.push(`${d.def.name} ${word}: ${why.join(', ')}`);
    } }
    F.verdict(fails.length === 0 && n > 0, `${nameOf(file)}: ${n} faces`, fails.length ? few(fails) : notes.length ? `all at the handle · ${notes.join(' · ')}` : 'all at the handle, none a long reach');
  }
  F.verdict(none + far <= faces * 0.1, `${faces} faces: ${far} with only a long reach, ${none} with no place`, 'the level\'s corners: at most a tenth of the faces');
  return F.done();
});

// ---------------------------------------------------------------- handleside-men
interface Walk { n: number; skipped: number; ok: number; long: number; free: number; fails: string[]; bad: number }
/** a teammate and a defender on the AI's own walk through every door of the level, both faces; each door's opening judged by the watcher */
async function walks(W: any, teams: readonly ('operative' | 'hostile')[]): Promise<Walk> {
  const g = W.game; clearFloor(g); g.teleportPlayer(g.level?.playerSpawn ?? g.player.char.pos); const out: Walk = { n: 0, skipped: 0, ok: 0, long: 0, free: 0, fails: [], bad: 0 };
  for (const team of teams) for (const d of g.doors.list) for (const f of [1, -1]) {
    const S = spots(g, d, f); if (!S) { out.skipped++; continue; }
    for (const x of g.doors.list) fresh(x); out.n++;
    const side = against(d, S.from).side, place = handleSpot(g, d, side), face = faceWord(g, d, S.from), at = `${d.def.name} ${face} · ${team}`;
    const gd = spawnUnit(g, { team, pos: S.from as any, yaw: 0 }); if (team === 'hostile') { gd.hold = false; gd.pinned = false; W.step(DT); }   // (off the room fight's roster and onto his own feet, as oneway-men stands him)
    order(gd, { goal: S.to as any }); const watch = new HandleWatch(g);
    let t = 0, through = false, first: HandleRow | undefined;
    for (; t < WALK_SECS && !through; t += DT) { W.step(DT); watch.tick(t); through = Math.hypot(gd.char.pos[0] - S.to[0], gd.char.pos[2] - S.to[2]) < 0.5;
      if (!first && !d.latched && d.angle * d.swing > 0.01) first = seen(g, d, gd.char.pos); }   // (a leaf leaned open at a walk starts under the watcher's speed bar and it files no row: the probe reads where he stood itself)
    const row: HandleRow | undefined = watch.rows.find(r => r.door === d.def.name) ?? first, own = watch.passRows.filter(p => p.door === d.def.name && p.opener).length;
    const long = !!row && !row.ok && row.how === 'pull' && row.face === 'pull' && !row.sweep && row.along >= row.W / 2 && row.reach <= LONG_M;
    const stood = row ? `${row.how} from ${row.along} of ${row.W} m, ${row.reach} m to the handle${row.sweep ? ', in the sweep' : ''}` : '';
    if (!through) out.fails.push(`${at}: not through in ${WALK_SECS} s (at ${gd.char.pos[0].toFixed(1)}, ${gd.char.pos[2].toFixed(1)}, leaf ${d.angle.toFixed(2)})`);
    else if (!row) out.fails.push(`${at}: through, and no opening of it was seen`);
    else if (row.how === 'kick') out.fails.push(`${at}: a kick at an unlocked door`);
    else if (!place) out.free++;                                                   // (a face with no place: he opens as he did)
    else if (row.ok && !own) out.ok++;
    else if (place.far && long && !own) out.long++;
    else { out.bad++; out.fails.push(`${at}: ${stood} (${row.why || 'ok'})${own ? ' · the leaf came round THROUGH him' : ''}`); }
    endGuardScript(gd); despawnUnit(g, gd);
  }
  return out;
}
export const handlesideMen = guarded(async () => {
  const F = family('handleside-men: a teammate and a defender on the AI\'s own walk open every door from its handle, both faces');
  for (const k of Object.keys(HANDLE_STATS)) HANDLE_STATS[k] = 0;
  let all = 0;
  for (const file of LEVELS) {
    const R = await walks(await boot(file), ['operative', 'hostile']); all += R.n;
    F.verdict(R.fails.length === 0 && R.n > 0, `${nameOf(file)}: ${R.n} walks (${R.skipped} faces with no floor to stand on)`,
      R.fails.length ? few(R.fails) : `at the handle ${R.ok}${R.long ? ` · the long reach ${R.long}` : ''}${R.free ? ` · a face with no place ${R.free}` : ''} · through every one, never through the leaf`);
  }
  F.verdict(HANDLE_STATS.pulls > 0 && HANDLE_STATS.lined > 0, `the rule did the work over ${all} walks`, Object.entries(HANDLE_STATS).map(([k, v]) => `${k} ${v}`).join(' · '));
  return F.done();
});

// ---------------------------------------------------------------- handleside-off
export const handlesideOff = guarded(async () => {
  const F = family('handleside-off: HANDLE.on off, the doors are opened from the middle of the leaf as they were');
  for (const k of Object.keys(HANDLE_STATS)) HANDLE_STATS[k] = 0;
  const R = await walks(await boot(undefined, false), ['operative']);
  F.verdict(R.bad > 0, `office, the rule off: ${R.bad} of ${R.n} walks open a door away from its handle`, R.bad ? few(R.fails.filter(s => !/not through/.test(s)), 3) : 'none: handleside-men could not go red');
  F.verdict(Object.values(HANDLE_STATS).every(v => v === 0), 'the rule\'s counters stayed at zero', Object.entries(HANDLE_STATS).map(([k, v]) => `${k} ${v}`).join(' · '));
  return F.done();
});

// SCENARIOS ON A LEVEL FILE — does this level carry what the room clear and the hostage rescue need, and do they stage, get walked and END on it?
//   bun run tools/qa/scenario-level-probes.ts levels/<name>.json [--seeds N,…] [--only data,pair,four,rescue] [--cap 240] [--trace]
//       exit 0 = every check passed · 1 = a FAIL line above · 2 = no such file / unknown flag (nothing run)
//   bun run tools/qa/probes.ts scenario-levels        the same on levels/test-rooms.json (the tiny test level — tools/levels/test-rooms.ts), as a family:
//       scenario-levels-data · scenario-levels-pair · scenario-levels-four · scenario-levels-rescue
// A level TASK runs the first line on its own file. Any level file works — the office's too (it gets the office's own scenario data, as in the page; its `data`
// part says four things about the office's rescue marks as shipped — three men stood in chairs, printed as notes, and one in the conference table, a FAIL: exit 1 there) — and
// a scenario the file does not carry is skipped with a line saying so and NO VERDICT for that part (a level made for the rescue need not hold a room clear).
//
// WHAT IS CHECKED
//   data     the file validates; the game stands up on it and idles; checkStructure / checkRescue / the route's check return nothing (every mark on free floor,
//            inside its room, clear of furniture — a rescue mark inside a PUSHABLE prop is printed as a note, not failed — with a line to what it covers; doors exist; the team's start joined on foot to every room); each scenario's
//            own canStart accepts the level.
//   pair     the room clear with two teammates, per seed: STAGED (the teammates on the level's marks, the defenders dealt into their rooms, every structure door
//   four     shut) → WALKED (door by door under a plain scripted commander — the order menu's own calls, as tools/qa/roomclear-tally.ts gives them: 'open and
//            clear' on a cold floor, 'bang and clear' once it is loud, then the room walked, then its other doors; teammates must get INTO a room on their own
//            feet — which rooms were entered over the seeds is printed, not asked: a room emptied from its doorway is never walked into) → FINISHED (the scenario's own end: 'taken' or 'wiped', inside the cap, no exception). `four` is the same with NIGHTBREACH.squad 4.
//   rescue   per seed: STAGED (the pair, the hostages, the captor, the door man, the level's own room guards and its roamers — the game's one, or so many as the level's own cast mans — on the level's marks) → WALKED (Sam on his own feet — keys, the nav
//            grid's path — from the team's start to a post short of the hostage room's door; the clock starts; the route's openings are passed where the level
//            has a flow) → F (the hostage room's entry, the key itself) → FINISHED (the scenario's own result: rescued clean / costly, or lost).
//   Over the seeds each scenario must also come off at least once ('taken' / 'rescued'): a level nobody can win on is a FAIL.
//   THE SEEDS. The room clear plays 0, 1, 2, 3 unless --seeds says otherwise: seed 0 is the level's OWN MARKS, the hand placement the page deals on every
//   load (game/samestart.ts), and 1 to 3 are three dealt floors of the same file. The rescue keeps 1, 2, 3 (its seed is the roamers' and the clock's die).
//   --seeds, when given, is taken by both. A seed is the placement AND the run's die, so the page's floor is ONE run here: 'it can be won' can still pass on a
//   dealt floor alone (the seed lines say which). The page's floor over many dice is a tally's job: PT_SAMEFLOOR=1 tools/qa/playthrough.ts.
//   THE EXCEPTION, by a table of five files (TRAPPED below: depot, block, block-squads, mousehole, pass): floors authored so that the plan this commander walks is the trap. There
//   WALKED asks that the team left its marks (where it fell is printed) and the room clear's 'it can be won' is not asked of this plan.
//   THE FLOOR'S TEAM: 'it can be won' is not asked of the PAIR on a level the mission list plays only with the four (fourManRowsOf below reads the list;
//   the pair's count is still printed, and it still has to stage, walk and finish). A level with a pair row, or with no row, keeps the line.
//
// WHAT THIS IS NOT. A balance tally: the commander is the tally's (unseen, unhurt, giving orders only — ROOMCLEAR.pairOnly: the teammates all down = lost), the
// rescue's Sam walks and presses F and never fires (god mode: the pair and the level's data are what is under test, not his aim), the seeds are few.
// THE HARNESS HAS NO GPU: no light meter (Sam is planted dark; what a man sees of another is guards.ts's direct-light estimate), no smoke sight lines, no picture.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { ROOMCLEAR, checkStructure } = await import(`${ROOT}/src/game/roomclear.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { RESCUE, checkRescue } = await import(`${ROOT}/src/game/rescue.ts`);
const { RESCUEEND } = await import(`${ROOT}/src/game/rescueend.ts`);
const { INTERACT_KEY } = await import(`${ROOT}/src/game/consts.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);

type Vec3 = [number, number, number];
type Rect = { x0: number; x1: number; z0: number; z1: number };
const DT = 1 / 60;
/** where the room clear's commander is kept while time passes (tally: Run.here): a corner of the world's ground that is in none of the structure's rooms */
const CORNERS: Vec3[] = [[1, 0, 1], [39, 0, 1], [1, 0, 27], [39, 0, 27]];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const inRect = (p: number[], b: Rect) => p[0] > b.x0 && p[0] < b.x1 && p[2] > b.z0 && p[2] < b.z1;
const up = (l: any[]) => l.filter(x => x.state !== 'dead');
type Verdict = (ok: boolean, label: string, detail: string) => void;
let CHECKS = 0;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; CHECKS++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

export interface Opts { seeds?: number[]; cap?: number; trace?: boolean }
const RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, RS_DEFAULTS = { ...RESCUE };
/** the knob tables as shipped (they are module state: one process stands many games up) — but for the team-start knobs, which are the staged level's (start() writes them) */
function resetKnobs() {
  const { samAt: _a, samYaw: _b, ...nb } = NB_DEFAULTS, { samAt: _c, samYaw: _d, opsAt: _e, ...rs } = RS_DEFAULTS;
  Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, nb); Object.assign(RESCUE, rs);
}

const pathOf = (file: string) => (existsSync(resolve(file)) ? resolve(file) : resolve(ROOT, file));
const PARSED = new Map<string, { data: any; errs: string[] }>();
/** the file read and validated ONCE (errs: why it is not a level — JSON that does not parse, a validation error; data null then) */
function dataOf(file: string): { data: any; errs: string[] } {
  let d = PARSED.get(file);
  if (!d) { try { const raw = JSON.parse(readFileSync(pathOf(file), 'utf8')), errs: string[] = validateLevelData(raw); d = { data: errs.length ? null : raw, errs }; } catch (e: any) { d = { data: null, errs: [String(e?.message ?? e).split('\n')[0]] }; } PARSED.set(file, d); }
  return d;
}
/** a fresh Level of the file, as the page's ?levelFile= loads it (the office family gets the office's script and scenario data); null = the file is not a level */
export function levelOf(file: string): any | null { const { data } = dataOf(file); return data ? (isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data)) : null; }
async function stand(file: string, seed: number): Promise<any> { Math.random = seeded(0x5ce1 + seed * 7919); resetKnobs(); return standUp({ uploadEvery: 4, level: levelOf(file) }); }
/** a part with nothing to check: said, and no 'ALL PASS' (probes.ts counts check lines: a part that printed none is NO VERDICT). It returns true because a
 *  level that does not carry a scenario has not FAILED it; the command line's closing banner names the parts skipped so its 'ALL PASS' is not read as theirs */
const SKIPPED: string[] = [];
function skipped(title: string, why: string): boolean { SKIPPED.push(title.split(':')[0].replace('scenario-levels-', '')); console.log(`\n=== ${title} ===\n  (${why})\n=== ${title.split(':')[0]}: NO VERDICT — skipped ===`); return true; }
const quiet = async <T>(on: boolean, fn: () => Promise<T>): Promise<T> => { const log = console.log; if (on) console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

// ───────────────────────────────────────────────────────────── data ─────────────────────────────────────────────────────────────
export async function scenarioData(file: string): Promise<boolean> {
  const F = family(`scenario-levels-data: ${file} — the level file and the scenario data it carries, against its own floor`);
  const { data, errs } = dataOf(file), level = levelOf(file);
  if (!level) { F.verdict(false, 'the file validates', `${errs.length} error(s): ${errs.slice(0, 8).join(' · ')}`); return F.done(); }
  const S = level.scenarios ?? {};
  F.verdict(true, 'the file validates', `${data.name}: ${data.boxes.length} boxes · ${data.doors.length} doors · ${data.props.length} props · scenarios ${Object.keys(S).join(', ') || 'none'}${isOfficeFamily(data) ? ' (the office family: its data is levels/office.scenarios.ts)' : ''}`);
  F.verdict(!!(S.roomClear || S.rescue || S.nightBreach), 'it carries scenario data', Object.keys(S).length ? Object.keys(S).map(k => k === 'roomClear' ? `roomClear: ${S.roomClear.rooms.length} rooms, ${S.roomClear.rooms.reduce((n: number, r: any) => n + r.garrison, 0)} defenders, team start ${S.roomClear.team ? `given (${S.roomClear.team.ops?.length ?? 0} teammate marks)` : "the breach plan's"}` : k === 'rescue' ? `rescue: ${S.rescue.hostages.length} hostages in the ${S.rescue.room.name}, ${S.rescue.side ? 'a side door' : 'one door'}, ${S.rescue.flow ? `a route of ${S.rescue.flow.route.length} openings` : 'no flow'}` : `nightBreach: ${level.breach ? 'on the breach plan' : 'NO breach plan'}`).join(' · ') : 'no scenarios block: nothing for a scenario to run on');
  let W: any = null, threw = '';
  try { W = await quiet(true, () => stand(file, 1)); for (let i = 0; i < 120; i++) { W.game.player.visibility = 0.05; W.step(DT); } } catch (e: any) { threw = String(e?.stack ?? e).split('\n').slice(0, 2).join(' | '); }
  if (!W || threw) { F.verdict(false, 'the game stands up on it and idles two seconds', threw); resetKnobs(); return F.done(); }
  const g = W.game, pl = g.player.char.pos;
  F.verdict(pl.every((x: number) => Number.isFinite(x)), 'the game stands up on it and idles two seconds', `Sam at (${f1(pl[0])}, ${f1(pl[2])}) · ${g.guards.length} of the shift · ${g.doors.list.length} doors · nav free at his feet: ${!g.col.nav.isBlocked(pl[0], pl[2])}`);
  if (S.roomClear) {
    const bad: string[] = checkStructure(g); F.verdict(bad.length === 0, "room clear: the structure sits on the floor (checkStructure)", bad.length ? bad.join(' · ') : 'every door exists, every mark on free floor inside its room clear of furniture with a line to what it covers, the team start joined on foot to every room');
    { const why = g.roomClear.canStart(), marks = S.roomClear.team?.ops?.length ?? 0;   // (asked ONCE: canStart reads no squad size, so 'with the four' was the pair's line again — the four's own start is the `four` part's staging check)
      F.verdict(why === null, 'room clear: canStart', why ?? `accepted — the same answer for the pair and the four; the four ${marks >= 4 ? 'have their own four marks' : 'get the second pair stood a stride behind the first'}`); }
  } else { SKIPPED.push('room clear data'); console.log('- (no roomClear block: the room clear is not for this level — skipped)'); }
  if (S.rescue) {
    const said: string[] = checkRescue(g), inProp = (w: string) => /: standing in /.test(w), bad = said.filter(w => !inProp(w)), notes = said.filter(inProp);   // (a mark inside a PUSHABLE prop is checkRescue's own-line note — the staging shoves the two apart, it gates nothing — so it is printed, not failed: the office ships three)
    F.verdict(bad.length === 0, 'rescue: the data sits on the floor (checkRescue, the route included)', bad.length ? bad.join(' · ') : `every mark where a man can be stood${notes.length ? ` (${notes.length} of them in a pushable prop: the note${notes.length > 1 ? 's' : ''} below)` : ' and in no furniture'}, the room's men inside it with a line to what they cover, the hostages inside it, the team start joined on foot to all of it${S.rescue.flow ? ', every opening coverable from its mark' : ''}`);
    for (const w of notes) console.log(`    note (not a failure — the staging shoves them apart): ${w}`);
    const why = g.rescue.canStart(); F.verdict(why === null, 'rescue: canStart', why ?? 'accepted');
  } else { SKIPPED.push('rescue data'); console.log('- (no rescue block: the hostage rescue is not for this level — skipped)'); }
  resetKnobs();
  return F.done();
}

// ───────────────────────────────────────────────────────────── the room clear ─────────────────────────────────────────────────────────────
class Done extends Error { constructor(public end: string, public why = '') { super(end); } }
/** the scripted commander (the tally's Run, without the office in it): a staged room clear and the menu's orders */
class Clear {
  g: any; RC: any; NB: any; O: any; t = 0; orders = 0; refused: string[] = []; trace: string[] = []; lastShotT = -100; lastFallT = -100; fell: string[] = [];
  entered = new Set<string>(); walked = new Map<any, number>(); private from = new Map<any, Vec3>(); private seenEv = new Set<any>(); private fallen = new Set<any>();
  /** where the commander stands for the instant an order is read off it (null: he has not walked anywhere yet), and where his body is kept otherwise */
  stand: Vec3; private placed = false; readonly park: Vec3;
  constructor(public W: any, public cap: number, public verbose: boolean) {
    this.g = W.game; this.RC = this.g.roomClear; this.NB = this.g.nightBreach; this.O = this.g.orders; for (const o of this.NB.ops) this.from.set(o, [...o.char.pos] as Vec3);
    this.park = CORNERS.find(c => !this.RC.rooms.some((r: any) => inRect(c, { x0: r.def.bounds.x0 - 3, x1: r.def.bounds.x1 + 3, z0: r.def.bounds.z0 - 3, z1: r.def.bounds.z1 + 3 }))) ?? CORNERS[0];
    this.stand = [...this.park] as Vec3; this.g.teleportPlayer(this.park);
  }
  say(s: string) { const line = `${f1(this.t).padStart(6)}  ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }
  get ops(): any[] { return up(this.NB.ops); }
  get rooms(): any[] { return this.RC.rooms; }
  room(id: string): any { return this.rooms.find((r: any) => r.def.id === id); }
  door(name: string): any { return this.g.doors.byName(name); }
  step(n = 1) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      g.player.visibility = 0.05; this.W.step(DT); this.t += DT;
      for (const e of g.events) { if (this.seenEv.has(e)) continue; this.seenEv.add(e); if (e.kind === 'guardShot') this.lastShotT = this.t; }
      if (this.seenEv.size > 4000) this.seenEv = new Set(g.events);
      for (const o of this.NB.ops) { if (o.state === 'dead') continue; this.walked.set(o, Math.max(this.walked.get(o) ?? 0, flat(o.char.pos, this.from.get(o)!))); for (const r of this.rooms) if (inRect(o.char.pos, r.def.bounds)) this.entered.add(r.def.id); }
      for (const x of [...this.NB.ops, ...this.NB.hostiles]) if (x.state === 'dead' && !this.fallen.has(x)) { this.fallen.add(x); this.lastFallT = this.t; if (this.NB.ops.includes(x)) this.fell.push(`${x.callsign} (${f1(x.char.pos[0])}, ${f1(x.char.pos[2])}) at ${f1(this.t)} s`); this.say(`DOWN ${x.callsign} (${x.team})`); }
      if (this.RC.end) throw new Done(this.RC.end, this.RC.endWhy);
      if (this.t >= this.cap) throw new Done('stalled', 'time cap');
    }
  }
  wait(secs: number) { this.step(Math.round(secs * 60)); }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }
  here<T>(fn: () => T): T { this.g.teleportPlayer(this.stand); try { return fn(); } finally { this.g.teleportPlayer(this.park); } }
  /** walk the commander there: the seconds a player would take over the ground, then he is there (snapped to free floor) */
  go(p: Vec3) { const d = flat(this.stand, p); if (this.placed && d > 0.5) this.wait(Math.min(12, d * 1.3 / 4)); this.placed = true; this.stand = p; const s = this.here(() => this.O.freeSpot(p)) ?? p; this.stand = [s[0], 0, s[2]]; }
  floorT(p: Vec3) { const s = this.here(() => this.O.freeSpot(p)); return s ? { kind: 'floor', at: s } : null; }
  doorT(name: string) { const d = this.door(name); return { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, this.stand) }; }
  order(id: string, target: any): boolean {
    if (!target) { this.refused.push(`${id}: no floor there`); return false; }
    const why = this.here(() => this.O.give(id, target, 'all')); this.orders++;
    const words = `${id}${target.kind === 'door' ? ` ${target.door.def.name}` : ` (${f1(target.at[0])}, ${f1(target.at[2])})`}`;
    if (why) { this.refused.push(`${words}: ${why}`); this.say(`order REFUSED ${words}: ${why}`); return false; }
    this.say(`order ${words}`); return true;
  }
  set(): boolean { return this.ops.every((m: any) => this.O.of(m)?.arrived ?? true); }
  opOn(name: string): any { const d = this.door(name); return this.g.doorTools.ops.find((o: any) => o.door === d) ?? null; }
  /** a point `d` m out of `room` through `door`, `side` m along the wall */
  outside(R: any, door: string, d: number, side = 0): Vec3 {
    const D = this.door(door), b = R.def.bounds, c = D.frameCentre, th = D.def.closedDir, u = [Math.cos(th), Math.sin(th)]; let n = [-u[1], u[0]];
    if (n[0] * (c[0] - (b.x0 + b.x1) / 2) + n[1] * (c[2] - (b.z0 + b.z1) / 2) < 0) n = [-n[0], -n[1]];
    return [c[0] + n[0] * d + u[0] * side, 0, c[2] + n[1] * d + u[1] * side];
  }
  sweep(R: any): Vec3[] { const b = R.def.bounds, x = (k: number) => b.x0 + (b.x1 - b.x0) * k, z = (k: number) => b.z0 + (b.z1 - b.z0) * k; return [[x(.5), 0, z(.5)], [x(.25), 0, z(.27)], [x(.75), 0, z(.27)], [x(.75), 0, z(.73)], [x(.25), 0, z(.73)]]; }
  /** the door a room is taken by: the first of its doors (the level's order) the team can walk to the outside of from where its first man stands, not steel and locked */
  front(R: any): string | null {
    const lead = this.ops[0]; if (!lead) return null;
    for (const D of R.def.doors) { const d = this.door(D.id); if (!d || (d.def.steel && d.locked && !d.lockBroken)) continue; const out = this.here(() => this.O.freeSpot(this.outside(R, D.id, 1.2))); if (out && this.g.col.nav.findPath(lead.char.pos, out)) return D.id; }
    return null;
  }
  /** one room: its front door by the door tools, then the room walked, then its other doors from inside */
  take(R: any) {
    const id = R.def.id, front = this.front(R); if (!front) { this.say(`${id}: no door the team can get to`); return; }
    const hot = this.lastShotT > -100 || this.lastFallT > -100, tool = hot && this.g.doorTools.bangs > 0 ? 'bangClear' : 'openClear';
    this.go(this.outside(R, front, 3.2, 1.5));
    if (this.order(tool, this.doorT(front)) || (tool === 'bangClear' && this.order('openClear', this.doorT(front)))) this.until(() => R.cleared || !this.opOn(front), 80);
    for (const p of this.sweep(R)) { if (R.cleared || !this.ops.length) return; if (!this.order('move', this.floorT(p))) continue; this.until(() => R.cleared || this.set(), 7); if (!R.cleared) this.wait(0.8); }
    for (const D of R.def.doors) {
      if (R.cleared || !this.ops.length) return; if (D.id === front) continue; const d = this.door(D.id); if (d.def.steel && d.locked && !d.lockBroken) continue;
      this.go(this.sweep(R)[0]); if (this.order('openClear', this.doorT(D.id))) this.until(() => R.cleared || !this.opOn(D.id), 40);
    }
  }
  /** THE HUNT. A room is not called clear while a man dealt to it lives (roomclear.ts tick: `R.defenders.some(alive)`), and a man his squad sent round on a flank
   *  may be left holding a door on floor nobody holds: walking his empty room again does nothing, and three passes of that wait out the cap. So a live defender
   *  of an uncleared room who stands OUTSIDE its bounds is walked to (a plain move order onto his spot): from the second pass, in the place of taking again a
   *  room that every one of its men has left (the first pass, and any room with a man still in it, are played as ever), and once more after the passes for
   *  whoever is left out. THIS READS THE DEFENDER'S TRUE POSITION, WHICH A PLAYER DOES NOT HAVE: the line it serves ('finished: every seed ran to the
   *  scenario's own end inside the cap') is a liveness check — can the run end at all — not a claim that a player finds him. HUNT_BREAK=1 skips it (the stall
   *  is back: barracks, shipped stand, the four's seed 1; compound, frozen stand, the pair's seed 1). */
  hunt(rooms: any[] = this.rooms) {
    if (process.env.HUNT_BREAK === '1') return;
    for (const R of rooms) for (const h of up(R.defenders)) {
      if (R.cleared || !this.ops.length) break; if (inRect(h.char.pos, R.def.bounds)) continue;
      const p = [...h.char.pos] as Vec3; this.say(`hunt ${h.callsign} of the ${R.def.name}`); this.go(p);
      if (this.order('move', this.floorT(p))) this.until(() => h.state === 'dead' || this.set(), 30); this.wait(2);
    }
  }
  /** every man of the room has walked out of it, and nobody else's stands in it (HUNT_BREAK: never — the room is taken again, as it was) */
  left(R: any): boolean { return process.env.HUNT_BREAK !== '1' && !up(this.NB.hostiles).some((h: any) => inRect(h.char.pos, R.def.bounds)); }
  run() {
    for (let pass = 0; pass < 3; pass++) for (const R of this.rooms) if (!R.cleared && this.ops.length) { if (pass > 0 && this.left(R)) this.hunt([R]); else this.take(R); }
    this.hunt(); this.hunt(); this.until(() => false, this.cap);
  }
}
/** THE AUTHORED FLOORS WHOSE OBVIOUS PLAN IS TRAPPED BY DESIGN (the authored-levels goal, 10-13). The commander above walks ONE plan — each room by the first of
 *  its doors the team can reach, in the level's order — and on these floors that plan is the trap: the depot's lit yard, the block's hall doors, Mousehole's wedged single doors, the pass's lit yard. So here, and
 *  nowhere else, "walked" asks only that the team LEFT ITS MARKS (where and when it fell is printed), and "it can be won" is NOT ASKED of this plan: the floors'
 *  answers (the depot round the back with the mains cut, or by the workshop; the block's rooms by their other doors; Mousehole's by their walls; the pass by the kitchen's back door or with the mains cut) are tallied by plan with
 *  tools/qa/playthrough.ts routes (the counts: docs/agents/levels.md), not checked here. They are four-man rows: the pair is not their team. A floor in this
 *  table whose team never leaves its marks is still red, and a floor that is not in it keeps every line as it was. */
const TRAPPED: Record<string, string> = {
  'depot.json': "the lit yard, between the signals hut's slit and the store's hatch",
  'block.json': 'the lit near leg of each held room, its men round the turn',
  'block-squads.json': 'the lit near leg of each held room, its men round the turn',
  'mousehole.json': "the lit corridor every door opens on, under the duty room's hatch gun; ward, exam room and store have one door each, wedged from inside, and are reached by their walls",
  'pass.json': 'the white, lit yard between the lorry and the doors, watched through glass from two sides',
};
const trapOf = (file: string): string | undefined => TRAPPED[basename(file).replace('-gwot.json', '.json')];
/** THE FLOOR'S TEAM, read off the mission list (src/scene/scenarioList.ts), not kept in a table here. A level whose room clear rows are ALL four-man rows was
 *  built for the four: the pair still has to stage, walk and finish on it, but "it can be won" is NOT ASKED of the pair there (the count is printed). A level
 *  with a pair row, or with no row at all, keeps the line. PAIRTEAM_BREAK=1 asks it of every pair again (the compound's pair on the shipped stand must fail). */
async function fourManRowsOf(file: string): Promise<string[]> {
  if (process.env.PAIRTEAM_BREAK === '1') return [];
  const { SCENARIOS } = await import('../../src/scene/scenarioList.ts');
  const rows = SCENARIOS.filter(r => r.kind === 'roomclear' && r.level === basename(file).replace('-gwot.json', '.json'));
  return rows.length && rows.every(r => r.squad === 4) ? rows.map(r => r.id) : [];
}
interface ClearOut { seed: number; staged: string[]; end: string; why: string; t: number; opsUp: number; ops: number; rooms: string; entered: string[]; roomIds: string[]; walked: number; orders: number; refused: string[]; note: string; trace: string[]; fell: string[] }
async function playClear(file: string, squad: 2 | 4, seed: number, cap: number, verbose: boolean): Promise<ClearOut> {
  const out: ClearOut = { seed, staged: [], end: 'error', why: '', t: 0, opsUp: 0, ops: 0, rooms: '', entered: [], roomIds: [], walked: 0, orders: 0, refused: [], note: '', trace: [], fell: [] };
  let C: Clear | null = null;
  try {
    const W: any = await quiet(!verbose, () => stand(file, seed)); const g = W.game, S = g.level.scenarios.roomClear;
    ROOMCLEAR.pairOnly = true; NIGHTBREACH.squad = squad;
    const log = console.log; if (!verbose) console.log = () => {};
    try {
      const why = g.roomClear.start(seed); if (why) throw new Error(`start refused: ${why}`);
      g.playerInvisible = true; g.godMode = true;
      // ── staged? (read before a frame passes) ──
      const NB = g.nightBreach, RC = g.roomClear, T = S.team, bad = out.staged;
      if (NB.ops.length !== squad) bad.push(`${NB.ops.length} teammates, not ${squad}`);
      if (T?.ops) NB.ops.forEach((o: any, i: number) => { const m = T.ops[i]; if (m && flat(o.char.pos, m) > 0.6) bad.push(`${o.callsign} is ${f1(flat(o.char.pos, m))} m off his mark`); });
      const men = S.rooms.reduce((n: number, r: any) => n + r.garrison, 0); if (NB.hostiles.length !== men) bad.push(`${NB.hostiles.length} defenders, not ${men}`);
      for (const r of RC.rooms) { if (r.defenders.length !== r.def.garrison) bad.push(`${r.def.name}: ${r.defenders.length} men, not ${r.def.garrison}`); for (const h of r.defenders) if (!inRect(h.char.pos, r.def.bounds)) bad.push(`${h.callsign} is outside the ${r.def.name}`); }
      for (const id of new Set<string>(S.rooms.flatMap((r: any) => r.doors.map((d: any) => d.id)))) { const d = g.doors.byName(id); if (Math.abs(d.angle) > 0.05) bad.push(`door '${id}' is open at the staging`); }
      if (T && flat(g.player.char.pos, T.sam) > 0.6) bad.push(`Sam is ${f1(flat(g.player.char.pos, T.sam))} m off his mark`);
      out.ops = NB.ops.length; out.roomIds = RC.rooms.map((r: any) => r.def.id);
      C = new Clear(W, cap, verbose);
      try { C.step(30); C.run(); } catch (e) { if (e instanceof Done) { out.end = e.end; out.why = e.why; } else throw e; }
    } finally { console.log = log; }
  } catch (e: any) { out.end = 'error'; out.note = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { resetKnobs(); }   // (pairOnly, the squad's size and the seed are module state: the next probe in this process gets the tables as shipped)
  if (C) { out.t = C.t; out.opsUp = C.ops.length; out.rooms = C.rooms.map((r: any) => `${r.def.id} ${r.cleared ? 'clear' : `${up(r.defenders).length}/${r.defenders.length}`}`).join(' · '); out.entered = [...C.entered]; out.walked = Math.max(0, ...C.walked.values()); out.orders = C.orders; out.refused = C.refused; out.trace = C.trace; out.fell = C.fell; }
  if (out.end === 'taken' && C && !C.ops.length) { out.end = 'wiped'; out.why = 'the last defender and the last teammate in the same moment'; }
  return out;
}
export async function scenarioClear(file: string, squad: 2 | 4, o: Opts = {}): Promise<boolean> {
  const who = squad === 2 ? 'pair' : 'four', title = `scenario-levels-${who}: ${file} — the room clear with the ${who}: staged, walked door by door, finished`;
  if (dataOf(file).data && !levelOf(file).scenarios?.roomClear) return skipped(title, 'no roomClear block: the room clear is not for this level');
  const F = family(title);
  const level = levelOf(file);
  if (!level) { F.verdict(false, 'the file is a level', dataOf(file).errs.slice(0, 4).join(' · ')); return F.done(); }
  const seeds = o.seeds ?? [0, 1, 2, 3], runs: ClearOut[] = [];   // (0 = the level's own marks, what the page deals; 1 to 3 = dealt floors)
  for (const s of seeds) { const r = await playClear(file, squad, s, o.cap ?? 240, !!o.trace); runs.push(r); console.log(`    seed ${s}: ${r.end}${r.why ? ` (${r.why})` : ''} at ${f1(r.t)} s · teammates up ${r.opsUp}/${r.ops} · ${r.rooms} · entered ${r.entered.join(', ') || 'no room'} · ${r.orders} orders${r.refused.length ? ` (${r.refused.length} refused)` : ''}${r.note ? ` · ${r.note}` : ''}`); }
  const n = runs.length, errors = runs.filter(r => r.end === 'error'), unstaged = runs.filter(r => r.staged.length), ended = runs.filter(r => r.end === 'taken' || r.end === 'wiped'), taken = runs.filter(r => r.end === 'taken');
  F.verdict(!errors.length && !unstaged.length, `staged on every seed: ${squad} teammates on the level's marks, the defenders in their rooms, the structure's doors shut`, errors.length ? errors.map(r => `seed ${r.seed}: ${r.note}`).join(' · ') : unstaged.length ? unstaged.map(r => `seed ${r.seed}: ${r.staged.join(', ')}`).join(' · ') : `${n} of ${n} seeds`);
  const ids = runs[0]?.roomIds ?? [], everEntered = ids.filter(id => runs.some(r => r.entered.includes(id))), noWalk = runs.filter(r => r.end !== 'error' && (!r.entered.length || r.walked < 3));
  const fourOnly = squad === 2 ? await fourManRowsOf(file) : [];
  const trap = trapOf(file), still = runs.filter(r => r.end !== 'error' && r.walked < (process.env.TRAPPED_BREAK === '1' ? 1e9 : 3));   // (TRAPPED_BREAK=1: no walk is long enough — the line must fail)
  if (trap) F.verdict(!errors.length && !still.length, `left their marks: on every seed the team walked off its start (the obvious plan is trapped here by design — ${trap} — so getting INTO a room is not asked of it)`, still.length ? still.map(r => `seed ${r.seed}: nobody went further than ${f1(r.walked)} m${r.refused.length ? ` (${r.refused[0]})` : ''}`).join(' · ') : runs.map(r => `seed ${r.seed}: ${f1(r.walked)} m from a mark, into ${r.entered.join(', ') || 'no room'}, ${r.end} at ${f1(r.t)} s${r.fell.length ? ` — fell: ${r.fell.join(' · ')}` : ''}`).join('\n    '));
  else F.verdict(!errors.length && !noWalk.length, "walked: on every seed teammates left their marks and got into a room on their own feet", noWalk.length ? noWalk.map(r => `seed ${r.seed}: ${r.entered.length ? `nobody went further than ${f1(r.walked)} m` : `nobody got into a room${r.refused.length ? ` (${r.refused[0]})` : ''}`}`).join(' · ') : `rooms a teammate set foot in over the seeds: ${everEntered.join(', ') || 'none'} of ${ids.join(', ')} (a room emptied from its doorway is not walked into) · furthest a teammate went from his mark, per seed: ${runs.map(r => f1(r.walked)).join(' / ')} m`);
  F.verdict(ended.length === n, "finished: every seed ran to the scenario's own end inside the cap, no exception", `taken ${taken.length} · wiped ${ended.length - taken.length} · stalled ${runs.filter(r => r.end === 'stalled').length} · error ${errors.length} — seconds: ${runs.map(r => f1(r.t)).join(' / ')}`);
  if (trap) console.log(`- NOT ASKED — it can be won: ${squad === 2 ? "the pair is not this floor's team (a four-man row)" : 'this commander walks only the obvious plan, which this floor traps by design'}; the floor's answers are tallied by plan (tools/qa/playthrough.ts routes; docs/agents/levels.md), not checked here · this plan: taken on ${taken.length} of ${n} seeds`);
  else if (squad === 2 && fourOnly.length) console.log(`- NOT ASKED — it can be won: the pair is not this floor's team (the mission list plays it with the four: ${fourOnly.join(', ')}) · the pair: taken on ${taken.length} of ${n} seeds`);
  else F.verdict(taken.length > 0, 'it can be won: at least one seed ends with every room taken', taken.length ? `seed${taken.length > 1 ? 's' : ''} ${taken.map(r => r.seed).join(', ')} (teammates up at the end: ${taken.map(r => `${r.opsUp}/${r.ops}`).join(', ')})` : 'no seed was taken — a level nobody wins on, or a driver that cannot get the men in: look at --trace');
  return F.done();
}

// ───────────────────────────────────────────────────────────── the hostage rescue ─────────────────────────────────────────────────────────────
/** the scripted player: Sam on his own feet (keys along the nav grid's path), F, and the wait */
class Walk {
  g: any; R: any; O: any; I: any; cam: any; t = 0; goal: Vec3 | null = null; trace: string[] = []; lastF = -100; presses = 0;
  /** every line the scenario's log has had since this player took over, kept here as it grows (Rescue.log trims itself from the front) */
  notes: string[] = []; private lastNote: any = null;
  /** who stopped the last walk that gave up: a living man of theirs in his way, '' when it was the floor (`inWay`) */
  met = '';
  constructor(public W: any, public cap: number, public verbose: boolean) { this.g = W.game; this.R = this.g.rescue; this.O = this.g.orders; this.I = W.input; this.cam = W.cam; }
  say(s: string) { const line = `${f1(this.t).padStart(6)}  ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }
  get pos(): Vec3 { return this.g.player.char.pos; }
  get ops(): any[] { return up(this.R.ops); }
  step(n = 1) {
    const g = this.g, I = this.I;
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      if (this.goal && !g.player.down) { const dx = this.goal[0] - this.pos[0], dz = this.goal[2] - this.pos[2], d = Math.hypot(dx, dz); if (d > 0.2) { const { fwd, right } = this.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      g.player.visibility = 0.05; this.W.step(DT); this.t += DT;
      { const L = this.R.log; let k = L.length; while (k > 0 && L[k - 1] !== this.lastNote) k--; if (this.lastNote === null) k = 0; for (; k < L.length; k++) { this.notes.push(L[k].what); this.say(`   · ${L[k].what}`); } if (L.length) this.lastNote = L[L.length - 1]; }
      if (this.R.result) throw new Done(this.R.result.state, this.R.result.why);
      if (this.t >= this.cap) throw new Done('stalled', 'time cap');
    }
  }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }
  /** walk to `p` along the nav path; a fresh path when he has stopped getting anywhere (the pair in a doorway), given up after `max` seconds */
  go(p: Vec3, max = 40, again = 0): boolean {
    const path: Vec3[] = this.g.col.nav.findPath(this.pos, p) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    const t0 = this.t; let mark = [...this.pos], markT = this.t; if (!again) this.met = '';
    for (const wp of path) {
      this.goal = [wp[0], 0, wp[2]];
      while (flat(this.pos, wp) > (wp === path[path.length - 1] ? 0.35 : 0.6)) {
        this.step(); if (this.t - t0 > max) { this.goal = null; return false; }
        if (flat(this.pos, mark) > 0.25) { mark = [...this.pos]; markT = this.t; } else if (this.t - markT > 1.2) { this.goal = null; if (again < 3) return this.go(p, max - (this.t - t0), again + 1); this.met = this.inWay(wp); return false; }
      }
    }
    this.goal = null; return true;
  }
  /** the living man of theirs who stands in Sam's way — within a metre of him, on the side he is walking to — or '' when it is the floor that stopped him. This
   *  player is never seen and never fires: a defender who walks up to him stands there, and Sam's own body keeps his team's guns off the man. That is not the
   *  level's floor, so WALKED says it as a note and does not fail on it (WALKMET_BREAK=1: nobody ever is in his way — the consulate's second seed on the
   *  shipped stand must fail WALKED). Nothing he does changes: he gives up where he did before, and F is pressed from there. */
  inWay(to: Vec3): string {
    if (process.env.WALKMET_BREAK === '1') return '';
    const o = this.pos, dx = to[0] - o[0], dz = to[2] - o[2], L = Math.hypot(dx, dz) || 1;
    const h = up(this.R.hostiles).filter((x: any) => flat(x.char.pos, o) < 1 && ((x.char.pos[0] - o[0]) * dx + (x.char.pos[2] - o[2]) * dz) / L > 0.2).sort((a: any, b: any) => flat(a.char.pos, o) - flat(b.char.pos, o))[0];
    return h?.callsign ?? '';
  }
  F() { this.I.pressed.add('KeyF'); this.presses++; this.lastF = this.t; this.say('F — the hostage room'); this.step(); }
  /** the room is the team's and the page's ending is up (`RESCUEEND`: holding it ends nothing): Sam walks to the nearest living hostage, takes the row on her
   *  that gets them all on their feet, and walks them to the way out — false when no row came up or he did not get there (asked again by the caller) */
  leadOut(): boolean {
    const R = this.R, nav = this.g.col.nav;
    if (!R.ending.lead) {
      for (const h of up(R.hostages).sort((a: any, b: any) => flat(a.char.pos, this.pos) - flat(b.char.pos, this.pos))) {
        const p = h.char.pos, dx = this.pos[0] - p[0], dz = this.pos[2] - p[2], L = Math.hypot(dx, dz) || 1, q = nav.nearestFreePoint(p[0] + dx / L * 1.1, p[2] + dz / L * 1.1) ?? p;   // (free floor beside her, on his side of her)
        this.go([q[0], 0, q[2]], 4 + flat(this.pos, q) / 1.2);
        if (this.until(() => this.g.selectVerb('guard', 'lead'), 0.8)) { this.I.pressed.add(INTERACT_KEY); this.step(2); }
        if (R.ending.lead) break;
      }
      if (!R.ending.lead) { this.say('(no row on a hostage yet: nobody is led)'); return false; }
      this.say('Sam gets the hostages on their feet and makes for the way in');
    }
    const out = R.ending.out; return !!out && this.go(out, 90);
  }
}
/** the room held this long (s) before Sam leads the hostages out, where the page's ending is up */
const LEAD_AFTER = 8;
interface RescueOut { seed: number; staged: string[]; state: string; grade: string; why: string; t: number; walkedTo: number; walkedM: number; clock: boolean; passed: string[]; route: string[]; order: string; hostages: string; pair: string; presses: number; note: string; met: string }
async function playRescue(file: string, seed: number, cap: number, verbose: boolean): Promise<RescueOut> {
  const out: RescueOut = { seed, staged: [], state: 'error', grade: '', why: '', t: 0, walkedTo: NaN, walkedM: 0, clock: false, passed: [], route: [], order: '', hostages: '', pair: '', presses: 0, note: '', met: '' };
  let P: Walk | null = null, R: any = null;
  try {
    const W: any = await quiet(!verbose, () => stand(file, seed)); const g = W.game, S = g.level.scenarios.rescue; R = g.rescue;
    const log = console.log; if (!verbose) console.log = () => {};
    try {
      g.tune.chaos = 0.5; g.fogOfWar.on = true;   // (the page's own defaults under ?rescue: main.ts)
      const why = R.start(); if (why) throw new Error(`start refused: ${why}`);
      g.godMode = true;
      // ── staged? ──
      const bad = out.staged, B: Rect = R.bounds, near = (who: string, at: number[], m: number[]) => { if (flat(at, m) > 0.6) bad.push(`${who} is ${f1(flat(at, m))} m off the mark`); };
      if (R.state !== 'staged') bad.push(`state '${R.state}', not 'staged'`);
      if (R.ops.length !== 2) bad.push(`${R.ops.length} teammates, not 2`); R.ops.forEach((o: any, i: number) => near(o.callsign, o.char.pos, S.team.ops[i]));
      near('Sam', g.player.char.pos, S.team.sam);
      if (R.hostages.length !== S.hostages.length) bad.push(`${R.hostages.length} hostages, not ${S.hostages.length}`); R.hostages.forEach((h: any, i: number) => { near(`hostage ${i + 1}`, h.char.pos, S.hostages[i].pos); if (!inRect(h.char.pos, B)) bad.push(`hostage ${i + 1} is outside the room`); });
      // (theirs, by role: the captor, the door man, the level's own room guards on their marks in the room, and so many roamers as the level's own cast mans — the
      //  consulate's three of five — or the game's one, each on a roamer mark. STAGECAST_BREAK=1 asks for the old three, and the consulate's line must fail)
      const old = process.env.STAGECAST_BREAK === '1', guards = old ? 0 : S.guards?.length ?? 0, roam = S.cast && !old ? Math.max(0, Math.min(S.roamers.length, Math.round(S.cast.roamers))) : Math.min(RESCUE.roamers, S.roamers.length);
      const of = (role: string) => R.cast().filter((c: any) => c.role === role), want = 2 + guards + roam;
      if (R.hostiles.length !== want) bad.push(`${R.hostiles.length} of theirs, not ${want}`);
      else {
        if (of('guard').length !== guards) bad.push(`${of('guard').length} room guards, not ${guards}`); if (of('roamer').length !== roam) bad.push(`${of('roamer').length} roamers, not ${roam}`);
        of('guard').slice(0, guards).forEach((c: any, i: number) => { near(`room guard ${i + 1}`, c.gd.char.pos, S.guards[i].pos); if (!inRect(c.gd.char.pos, B)) bad.push(`room guard ${i + 1} is outside the room`); });
        for (const c of of('roamer')) if (!S.roamers.some((m: any) => flat(c.gd.char.pos, m.pos) <= 0.6)) bad.push(`${c.gd.callsign} stands on no roamer mark`);
      }
      if (R.hostiles[0]) { near('the captor', R.hostiles[0].char.pos, S.captor.pos); if (!inRect(R.hostiles[0].char.pos, B)) bad.push('the captor is outside the room'); }
      if (R.hostiles[1]) near('the door man', R.hostiles[1].char.pos, (RESCUE.doorMan === 'inside' ? S.doorMan.inside : S.doorMan.outside).pos);
      for (const id of [S.room.door, ...(S.side ? [S.side.door] : [])]) if (Math.abs(g.doors.byName(id).angle) > 0.05) bad.push(`door '${id}' is open at the staging`);
      out.route = (S.flow?.route ?? []).map((o: any) => o.id);
      // ── walked: to a post on the team's side of the main door, short of it (1.3 m out of the door, 2.6 m back along the wall toward the team's start) ──
      const D = g.doors.byName(S.room.door), c = D.frameCentre, th = D.def.closedDir, u = [Math.cos(th), Math.sin(th)]; let n = [-u[1], u[0]];
      if (n[0] * (c[0] - (B.x0 + B.x1) / 2) + n[1] * (c[2] - (B.z0 + B.z1) / 2) < 0) n = [-n[0], -n[1]];
      const sg = Math.sign((S.team.sam[0] - c[0]) * u[0] + (S.team.sam[2] - c[2]) * u[1]) || -1;
      const raw: Vec3 = [c[0] + n[0] * 1.3 + u[0] * sg * 2.6, 0, c[2] + n[1] * 1.3 + u[1] * sg * 2.6], post: Vec3 = g.orders.freeSpot(raw) ?? raw;
      P = new Walk(W, cap, verbose); const from = [...P.pos];
      try {
        P.step(20); P.say(`Sam walks to (${f1(post[0])}, ${f1(post[2])})`); P.go(post, 40); out.met = P.met; out.walkedTo = flat(P.pos, post); out.walkedM = flat(P.pos, from);
        P.F(); out.order = P.notes.filter(w => w.startsWith('order:')).pop() ?? 'none';
        let securedT = NaN, leadT = -1e9;
        for (;;) {   // the end game any player would play with what is left: the room still theirs and nobody on the door → F again; the room empty of them and of us → the pair sent in; the room the team's and the page's ending up (holding it ends nothing) → a few seconds for whoever is coming, then the hostages led out
          const held = up(R.hostiles).some((h: any) => inRect(h.char.pos, B));
          if (R.mode !== 'door' && P.t - P.lastF > 3 && R.state !== 'secured') {
            if (held) P.F();
            else if (!P.ops.some((m: any) => inRect(m.char.pos, B))) { P.lastF = P.t; const at = g.orders.freeSpot([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]); if (at && P.ops.length) { g.orders.give('move', { kind: 'floor', at }, 'all'); P.say('order move → the hostage room'); } else if (!P.ops.length) P.go([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2], 12); }
          }
          if (R.state !== 'secured') securedT = NaN; else if (isNaN(securedT)) securedT = P.t;
          if (RESCUEEND.on && P.t - securedT >= LEAD_AFTER && P.t - leadT >= 5 && !(R.ending.lead && R.ending.out && flat(P.pos, R.ending.out) < 1.5)) { leadT = P.t; P.leadOut(); }
          P.step(6);
        }
      } catch (e) { if (!(e instanceof Done)) throw e; out.state = e.end; out.why = e.why; }
    } finally { console.log = log; }
  } catch (e: any) { out.state = 'error'; out.note = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { resetKnobs(); }
  if (P && R) {
    const L: string[] = P.notes; out.t = P.t; out.presses = P.presses; out.clock = L.some(w => w.startsWith('clock:')); out.passed = L.filter(w => w.startsWith('flow:pass:')).map(w => w.slice(10));
    out.grade = R.result?.grade ?? ''; out.hostages = `${up(R.hostages).length}/${R.hostages.length}`; out.pair = `${up(R.ops).length}/${R.ops.length}`;
  }
  return out;
}
export async function scenarioRescue(file: string, o: Opts = {}): Promise<boolean> {
  const title = `scenario-levels-rescue: ${file} — the hostage rescue: staged, walked to the door, F, finished`;
  if (dataOf(file).data && !levelOf(file).scenarios?.rescue) return skipped(title, 'no rescue block: the hostage rescue is not for this level');
  const F = family(title);
  if (!dataOf(file).data) { F.verdict(false, 'the file is a level', dataOf(file).errs.slice(0, 4).join(' · ')); return F.done(); }
  const seeds = o.seeds ?? [1, 2, 3], runs: RescueOut[] = [];
  for (const s of seeds) { const r = await playRescue(file, s, o.cap ?? 150, !!o.trace); runs.push(r); console.log(`    seed ${s}: ${r.state}${r.grade ? ` (${r.grade})` : ''}${r.why ? ` — ${r.why}` : ''} at ${f1(r.t)} s · hostages ${r.hostages} · pair ${r.pair} · passed ${r.passed.join(', ') || 'nothing'} · ${r.order} · F ×${r.presses}${r.note ? ` · ${r.note}` : ''}`); }
  const n = runs.length, errors = runs.filter(r => r.state === 'error'), unstaged = runs.filter(r => r.staged.length), ended = runs.filter(r => r.state === 'rescued' || r.state === 'lost'), won = runs.filter(r => r.state === 'rescued');
  F.verdict(!errors.length && !unstaged.length, "staged on every seed: the pair, Sam, the hostages, the captor, the door man and the level's own room guards and roamers on the level's marks, the room's doors shut", errors.length ? errors.map(r => `seed ${r.seed}: ${r.note}`).join(' · ') : unstaged.length ? unstaged.map(r => `seed ${r.seed}: ${r.staged.join(', ')}`).join(' · ') : `${n} of ${n} seeds`);
  const far = runs.filter(r => r.state !== 'error' && !(r.walkedTo < 0.8)), short = far.filter(r => !r.met), met = far.filter(r => r.met), noClock = runs.filter(r => r.state !== 'error' && !r.clock), route = runs[0]?.route ?? [], unpassed = runs.filter(r => r.state !== 'error' && route.length > 0 && !r.passed.length);
  F.verdict(!errors.length && !short.length && !noClock.length && !unpassed.length, `walked: Sam reached the post by the door on his own feet, the captor's clock started${route.length ? ', the route saw him pass its openings' : ''}`, short.length ? short.map(r => `seed ${r.seed}: stopped ${f1(r.walkedTo)} m short of the post`).join(' · ') : noClock.length ? `the clock never started on seed ${noClock.map(r => r.seed).join(', ')}` : unpassed.length ? `no opening of the route was passed on seed ${unpassed.map(r => r.seed).join(', ')}` : `metres walked: ${runs.map(r => f1(r.walkedM)).join(' / ')}${route.length ? ` · openings passed: ${runs.map(r => r.passed.join('+') || '—').join(' / ')} of ${route.join(', ')}` : ' · no flow on this level'}${met.length ? ` · NOTE ${met.map(r => `seed ${r.seed}: ${r.met} stood in his way ${f1(r.walkedTo)} m short of the post (this player is never seen and never fires; F was pressed from there)`).join(' · ')}` : ''}`);
  const noOrder = runs.filter(r => r.state !== 'error' && !/^order:(bang|go|stack)/.test(r.order));
  F.verdict(!errors.length && !noOrder.length, 'F is taken as the order on the hostage room', noOrder.length ? noOrder.map(r => `seed ${r.seed}: ${r.order}`).join(' · ') : runs.map(r => r.order).join(' / '));
  F.verdict(ended.length === n, "finished: every seed ran to the scenario's own result inside the cap, no exception", `rescued ${won.length} (${runs.filter(r => r.grade === 'clean').length} clean, ${runs.filter(r => r.grade === 'costly').length} costly) · lost ${ended.length - won.length} · stalled ${runs.filter(r => r.state === 'stalled').length} · error ${errors.length} — seconds: ${runs.map(r => f1(r.t)).join(' / ')}`);
  F.verdict(won.length > 0, 'it can be won: at least one seed ends with a hostage brought out', won.length ? `seed${won.length > 1 ? 's' : ''} ${won.map(r => `${r.seed} (${r.grade}, hostages ${r.hostages}, pair ${r.pair})`).join(', ')}` : 'no seed was rescued — look at --trace');
  return F.done();
}

// ───────────────────────────────────────────────────────────── the command line ─────────────────────────────────────────────────────────────
if (import.meta.main) {
  const argv = process.argv.slice(2), VALUED = ['--seeds', '--only', '--cap'], PARTS = ['data', 'pair', 'four', 'rescue'];
  const usage = (why: string): never => { console.error(`${why}\nusage: bun run tools/qa/scenario-level-probes.ts levels/<name>.json [--seeds N,…] [--only ${PARTS.join(',')}] [--cap SECS] [--trace]`); process.exit(2); };
  const val: Record<string, string> = {}; let file = '', trace = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUED.includes(a)) { const v = argv[++i]; if (v === undefined || v.startsWith('--')) usage(`${a} wants a value`); val[a] = v; }
    else if (a === '--trace') trace = true;
    else if (a.startsWith('--')) usage(`unknown flag ${a}`);
    else if (file) usage(`one level file at a time (got ${file} and ${a})`);
    else file = a;
  }
  if (!file) usage('no level file given');
  if (!existsSync(pathOf(file))) usage(`no such file: ${file}`);
  const whole = (x: string) => /^\d+$/.test(x);
  const only = (val['--only'] ?? PARTS.join(',')).split(','); for (const p of only) if (!PARTS.includes(p)) usage(`--only: no part '${p}'`);
  const seeds = val['--seeds']?.split(','); if (seeds && !seeds.every(whole)) usage(`--seeds: a list of whole numbers (got '${val['--seeds']}')`);
  if (val['--cap'] !== undefined && !(whole(val['--cap']) && Number(val['--cap']) > 0)) usage(`--cap: seconds, a whole number (got '${val['--cap']}')`);
  const o: Opts = { seeds: seeds?.map(Number), cap: val['--cap'] ? Number(val['--cap']) : undefined, trace }; let ok = true;
  if (only.includes('data')) ok = (await scenarioData(file)) && ok;
  if (only.includes('pair')) ok = (await scenarioClear(file, 2, o)) && ok;
  if (only.includes('four')) ok = (await scenarioClear(file, 4, o)) && ok;
  if (only.includes('rescue')) ok = (await scenarioRescue(file, o)) && ok;
  console.log(`\n=== scenario-level-probes ${basename(file)}: ${!ok ? 'FAILURES above' : CHECKS ? 'ALL PASS' : 'NO VERDICT (the file carries no scenario any of these parts checks)'}${SKIPPED.length ? ` · not checked, the file does not carry it: ${SKIPPED.join(', ')}` : ''} ===`);
  process.exit(ok ? 0 : 1);
}

// THE PAIR ROOM CLEAR ON THE RECORDS OFFICE (levels/records.json), played headless with counts — the level's one idea, 'the door is the decision', measured:
//   bun run tools/qa/records-runs.ts runs  [--seeds 1-12] [--policies rush,tools,doors] [--jobs 4] [--json out.json] [--cap 300]
//        whole runs under scripted policies (the hands are roomclear-tally.ts's Run: a list of the orders a player could give from the command menu, at the
//        moments he could give them; Sam commands unseen and does not fight; the team is the pair — ROOMCLEAR.pairOnly). A table per policy, and for every
//        finished run which door tools were USED TO EFFECT in it. Exit 1 unless some policy finishes (all four rooms cleared) on at least three seeds and
//        every one of the four tools was used to effect in some finishing run. (All four in ONE run is printed beside it, not required: after the first loud
//        room the other rooms' men mostly come to the fight — roomfight.ts rally — so later doors seldom have anybody behind them.)
//        --kit charges,bangs = the squad's door tools for the run; --rally off = the defenders kept in their rooms (a what-if: nobody leaves for a fight next door)
//   bun run tools/qa/records-runs.ts doors [--seeds 1-10] [--only records] [--jobs 4] [--json out.json]
//        one door, one tool, one staged situation at a time: who is lost, who goes down, is the room taken. The table the level's page quotes. No verdict.
//   bun run tools/qa/records-runs.ts trace <policy>:<seed>   |   trace-door <experiment id>:<seed>       one run with its timeline printed
//
// THE POLICIES (test drivers, not in the game):
//   rush   open and clear on every room's HALL door (the front office by the front door), one after the other, both men, nothing covered
//   tools  the office tally's careful habit carried over: the plain door while the floor is quiet, after that a charge while one is left, then a bang — every
//          room still by its hall door; one man covering down the hall while a hall door is worked; each room's doors held until six quiet seconds
//   doors  this level's own answer, a tool per room: the front office by the front door, plain; records by a bang on its hall door with one man covering the
//          hall; the strong room by a charge; the staff room worked FROM OUTSIDE its east door, Sam's round having put the street lamp out first, then entered
//   east   the same tools with the back door FIRST of the loud rooms: the lamp shot out, one of Sam's cans thrown into the yard to turn the staff room's man,
//          the room worked from outside its east door while he is still at home; then records by the bang, the strong room by the charge
//   round  no tools: every room by the door its men are not watching (walk round), plain
// USED TO EFFECT (each on the order it was given, with a man of the room going down or being hit by it): open and clear — a man of the room down, the room
// called, nobody of the pair lost; clear from outside — a man of the room down while the pair is still outside, nobody lost; charge — the blast knocks down or
// stuns at least one man; bang and clear — the can thrown, a man of the room down, the room called, nobody lost.
// THE HARNESS HAS NO GPU: what a man sees of another is guards.ts's direct-light estimate, not the light meter; no smoke sight lines; no fog of war; no feel.
import { readFileSync, writeFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { Run, Done, quietFor, sweepRoom } from './roomclear-tally.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { dropThrowable, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);

type Vec3 = [number, number, number];
type Tool = 'open' | 'bang' | 'charge' | 'outside';
const LEVEL_TEXT = readFileSync(`${ROOT}/levels/records.json`, 'utf8');
const RC_DEFAULTS = { ...ROOMCLEAR }, DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RALLY_DEFAULT: number = FIGHT_SKILL.hostile.rallyChance;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (n: number, d: number) => (d ? `${Math.round(100 * n / d)} %` : '—');
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');

/** the tally's hands on THIS level: the same verbs; only where a body lies is named by this building's rooms */
class RRun extends Run {
  zone(p: number[]): string { return this.RC.roomAt(p) ?? (p[0] > 10 && p[0] < 30 && p[2] > 13 && p[2] < 17 ? 'hall' : 'outside'); }
  /** every tool's effect as it happened: 'open' | 'bang' | 'charge' | 'outside' → times used to effect */
  effect: Record<Tool, number> = { open: 0, bang: 0, charge: 0, outside: 0 };
  used: Record<Tool, number> = { open: 0, bang: 0, charge: 0, outside: 0 };
  steps: string[] = [];
  defendersUp(room: string): number { return this.room(room).defenders.filter((h: any) => h.state !== 'dead').length; }
}
/** --kit charges,bangs: the squad's door tools for the run (the shipped counts otherwise — doortools.ts DOORTOOLS.charges / .bangs) */
let KIT: { charges: number; bangs: number } | null = null;
/** --rally off: the defenders kept at home (roomfight.ts FIGHT_SKILL.hostile.rallyChance 0 for the run — a what-if column, the game's file is not touched) */
let RALLY_OFF = false;
async function stage(seed: number, cap: number, verbose: boolean): Promise<RRun> {
  Object.assign(ROOMCLEAR, RC_DEFAULTS, { pairOnly: true }); Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS)), KIT ?? {}); FIGHT_SKILL.hostile.rallyChance = RALLY_OFF ? 0 : RALLY_DEFAULT;
  Math.random = seeded(0x51ed + seed * 7919);
  const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(LEVEL_TEXT)) }); const g = W.game;
  const why = g.roomClear.start(seed); if (why) throw new Error(`start refused: ${why}`);
  g.playerInvisible = true; g.godMode = true;
  const R = new RRun(W, seed, cap, verbose); R.step(30); return R;
}

// ───────────────────────────────────────────────────────────── a room, by a door, with a tool ─────────────────────────────────────────────────────────────
/** where the commander stands to order each door from each of its faces (an order's door side is the side he is on) */
const STAND: Record<string, Vec3> = {
  'front:out': [11.3, 0, 24.3], 'office:hall': [13.6, 0, 15.4], 'records_hall:hall': [17.6, 0, 15.3], 'records_west:out': [7.6, 0, 10.6], 'strong_room:records': [16.4, 0, 11.9],
  'staff_hall:hall': [22.2, 0, 15.3], 'staff_east:out': [32.6, 0, 11.6],
};
interface Take { room: string; door: string; face: string; tool: Tool | 'auto'; /** Sam shoots the east street lamp out first (his own round: the one thing here the pair cannot be ordered to do) */ lampOut?: boolean; /** Sam throws one of his own stun cans here first: a noise that turns the room's man to the door nearest it */ noise?: Vec3; /** man 1 put here with his gun on `watch` while man 0 works the door alone */ cover?: { at: Vec3; from: Vec3; watch: Vec3 }; /** hold its doors until this long is quiet */ hold?: number; }
/** one room taken (or not): the tool on the door, then what a player does next — walk it, and if a man has gone out by another door, that door from inside */
function take(R: RRun, T: Take) {
  R.working = T.room; if (!R.ops.length || R.cleared(T.room)) return;
  const hot = R.lastShotT > -100 || R.lastFallT > -100;
  let tool: Tool = T.tool === 'auto' ? (hot ? (R.DT.charges > 0 && !R.door(T.door).def.steel ? 'charge' : R.DT.bangs > 0 ? 'bang' : 'open') : 'open') : T.tool;
  const others = R.RC.rooms.some((r: any) => r.def.id !== T.room && !r.cleared);
  const flank = !!T.cover && others && R.ops.length === 2;
  const lead: 'all' | number = flank ? (R.up(0) ? 0 : 1) : 'all';
  if (flank) { const C = T.cover!; R.go(C.from); if (R.order('move', R.floorT(C.at), 1)) R.until(() => R.set(1), 14); R.order('cover', R.floorT(C.watch), 1); }
  R.go(STAND[`${T.door}:${T.face}`]);
  if (T.lampOut) lampOut(R);
  if (T.noise && R.defendersUp(T.room)) { dropThrowable(R.g, 'flash', T.noise); R.say(`· Sam throws a stun can to ${T.noise[0]}, ${T.noise[2]}`); R.wait(4); R.until(() => clearEyed(R), 8); }
  const up0 = R.ops.length, def0 = R.defendersUp(T.room), k0 = R.DT.stats.knocked + R.DT.stats.stunned, b0 = R.DT.stats.bangs;
  const mark = (t: Tool, ok: boolean, words: string) => { R.used[t]++; if (ok) R.effect[t]++; R.steps.push(`${T.room} by ${T.door}: ${words}${ok ? '' : ' (no effect)'}`); R.say(`· ${T.room}/${T.door} ${words}${ok ? ' — TO EFFECT' : ''}`); };
  // A run can END inside an order — the last man down ends the scenario on that frame, and the harness leaves by a throw: `pend` is the order then in hand,
  // marked on the way out too (else the tool that finished a run is the one tool never counted).
  let pend: (() => void) | null = null;
  const done = () => { const p = pend; pend = null; p?.(); };
  /** Run.tool, with the order marked as in hand the moment it is accepted */
  const give = (kind: 'openClear' | 'bangClear' | 'charge' | 'outside', inHand: (() => void) | null): boolean => {
    if (!R.order(kind, R.doorT(T.door), lead)) return false;
    pend = inHand;
    R.until(() => { const op = R.opOn(T.door); return !op || (kind === 'outside' && op.phase === 'held') || (kind === 'charge' && op.phase === 'armed'); }, 80);
    return true;
  };
  try {
    if (tool === 'outside') {
      if (give('outside', () => { const down = def0 - R.defendersUp(T.room); mark('outside', down > 0 && R.ops.length === up0, `clear from outside · ${down} down from out there · pair ${R.ops.length}/${up0}`); })) { holdOutside(R, T.room); done(); }
      tool = 'open';
    }
    if (!R.cleared(T.room) && R.ops.length) {
      const up1 = R.ops.length, def1 = R.defendersUp(T.room); let went = false;
      const called = () => `room ${R.cleared(T.room) ? 'called' : 'not called'} · pair ${R.ops.length}/${up1}`;
      if (tool === 'charge' && R.DT.charges > 0 && !R.open(T.door) && give('charge', null)) {   // set and stood off: nothing to mark until it is blown
        pend = () => { const hit = R.DT.stats.knocked + R.DT.stats.stunned - k0; mark('charge', hit > 0, `charge · ${hit} knocked down or stunned · ${called()}`); };
        went = R.blow(T.door); if (went) { R.until(() => R.cleared(T.room), 4); done(); } else pend = null;
      }
      if (!went && tool !== 'open' && R.DT.bangs > 0 && give('bangClear', () => mark('bang', R.DT.stats.bangs > b0 && R.cleared(T.room) && R.ops.length === up1 && R.defendersUp(T.room) < def1, `bang and clear · ${called()}`))) { went = true; R.until(() => R.cleared(T.room), 4); done(); }
      if (!went && give('openClear', () => mark('open', R.cleared(T.room) && R.ops.length === up1 && R.defendersUp(T.room) < def1, `open and clear · ${called()}`))) { R.until(() => R.cleared(T.room), 4); done(); }
    }
  } catch (e) { if (e instanceof Done) done(); throw e; }
  if (!R.cleared(T.room) && R.ops.length) { R.go(STAND[`${T.door}:${T.face}`]); sweepRoom(R, T.room, 7, 'all'); }
  if (!R.cleared(T.room) && R.ops.length) {   // a man of the room has gone out by another door: each other door in turn, from inside
    const mid = R.sweep(T.room)[0];
    for (const D of R.room(T.room).def.doors) { if (R.cleared(T.room) || !R.ops.length) break; if (D.id === T.door || (R.door(D.id).def.steel && R.locked(D.id))) continue; R.go(mid); R.tool('openClear', D.id, 'all', 40); if (!R.cleared(T.room)) R.until(() => R.cleared(T.room) || quietFor(R, 3), 10); }
  }
  if (T.hold && R.ops.length) {   // hold what was taken: a man on each of its doors, until `hold` seconds are quiet
    const mid = R.sweep(T.room)[0], doors: string[] = R.room(T.room).def.doors.map((D: any) => D.id);
    R.go(mid); let k = 0; for (const i of [0, 1]) if (R.up(i)) { R.order('cover', R.doorT(doors[k % doors.length]), i); k++; }
    R.until(() => quietFor(R, T.hold!), 40);
  }
}
/** nobody of the pair still blind from a can of their own side's */
const clearEyed = (R: RRun) => R.ops.every((x: any) => !(x.dazzledUntil > R.g.time));
/** worked from outside, as long as it pays: at least two seconds on the door, then until two seconds pass without a round or a man down — eight at most (a
 *  fight drawn out at a door is what brings the other rooms to it) */
function holdOutside(R: RRun, room: string) { const t0 = R.t; R.until(() => R.cleared(room) || (R.t - t0 >= 2 && quietFor(R, 2)), 8); }
/** the street lamp off the east wall, shot out (LightTarget.broken — combat.ts's fixture rule — and the light event the floor may notice) */
function lampOut(R: RRun) { const g = R.g, t = g.targets.find((x: any) => x.name === 'street_lamp_east'); if (!t) throw new Error('no street_lamp_east target'); if (t.broken) return; t.broken = true; g.lightEvent(t); R.say('· Sam shoots out the east street lamp'); R.wait(1); }
/** the rooms still held when the script has run out: each again by its plan's door, plain, then walked; six laps (no second can: Sam threw his) */
function hunt(R: RRun, plan: Take[]) { for (let lap = 0; lap < 6; lap++) for (const T of plan) if (!R.cleared(T.room)) take(R, { ...T, tool: 'open', cover: undefined, noise: undefined }); }

const HALL_COVER_E = { at: [18.4, 0, 16.2] as Vec3, from: [14.5, 0, 16.0] as Vec3, watch: [24.6, 0, 13.6] as Vec3 };   // by the hall's south wall east of the records door, gun up the hall at the staff room's door
const HALL_COVER_W = { at: [21.4, 0, 16.2] as Vec3, from: [25.0, 0, 16.0] as Vec3, watch: [15.1, 0, 13.6] as Vec3 };   // … and the mirror of it, on the records door
const PLANS: Record<string, { words: string; plan: Take[] }> = {
  rush: { words: 'RUSH — open and clear, hall doors, nothing covered', plan: [
    { room: 'front', door: 'front', face: 'out', tool: 'open' }, { room: 'records', door: 'records_hall', face: 'hall', tool: 'open' },
    { room: 'strong', door: 'strong_room', face: 'records', tool: 'open' }, { room: 'staff', door: 'staff_hall', face: 'hall', tool: 'open' } ] },
  tools: { words: 'TOOLS — the office habit: plain while quiet, then charge, charge, bang, all by hall doors; hall covered; rooms held 6 s', plan: [
    { room: 'front', door: 'front', face: 'out', tool: 'auto', hold: 6 }, { room: 'records', door: 'records_hall', face: 'hall', tool: 'auto', cover: HALL_COVER_E, hold: 6 },
    { room: 'strong', door: 'strong_room', face: 'records', tool: 'auto', hold: 6 }, { room: 'staff', door: 'staff_hall', face: 'hall', tool: 'auto', cover: HALL_COVER_W, hold: 6 } ] },
  doors: { words: 'DOORS — a tool per room, the loud rooms first: front plain · records by a bang on the hall door, the hall covered · strong room by charge · staff room from outside its east door, the lamp shot out first', plan: [
    { room: 'front', door: 'front', face: 'out', tool: 'open', hold: 6 }, { room: 'records', door: 'records_hall', face: 'hall', tool: 'bang', cover: HALL_COVER_E, hold: 6 },
    { room: 'strong', door: 'strong_room', face: 'records', tool: 'charge', hold: 6 }, { room: 'staff', door: 'staff_east', face: 'out', tool: 'outside', lampOut: true } ] },
  east: { words: 'EAST — the back door first: front plain · the lamp shot out and a can thrown into the south-east yard, then the staff room worked from outside its east door while its man is still at home · records by a bang on the hall door · strong room by charge', plan: [
    { room: 'front', door: 'front', face: 'out', tool: 'open', hold: 6 }, { room: 'staff', door: 'staff_east', face: 'out', tool: 'outside', lampOut: true, noise: [33, 0, 22], hold: 6 },
    { room: 'records', door: 'records_hall', face: 'hall', tool: 'bang', hold: 6 }, { room: 'strong', door: 'strong_room', face: 'records', tool: 'charge', hold: 6 } ] },
  round: { words: 'ROUND — no tools at all: every room by the door its men are NOT watching (records by the west door, the staff room by the east door with the lamp shot out), plain', plan: [
    { room: 'front', door: 'front', face: 'out', tool: 'open', hold: 6 }, { room: 'records', door: 'records_west', face: 'out', tool: 'open', hold: 6 },
    { room: 'strong', door: 'strong_room', face: 'records', tool: 'open', hold: 6 }, { room: 'staff', door: 'staff_east', face: 'out', tool: 'open', lampOut: true } ] },
};

interface RunOut { policy: string; seed: number; end: string; t: number; opsUp: number; cleared: string[]; effect: Record<Tool, number>; used: Record<Tool, number>; falls: { who: string; team: string; where: string; by: string; working: string | null }[]; steps: string[]; note: string; trace: string[] }
async function play(policy: string, seed: number, cap: number, verbose = false): Promise<RunOut> {
  const log = console.log; if (!verbose) console.log = () => {};
  let R: RRun | null = null, end = 'error', note = '';
  try {
    R = await stage(seed, cap, verbose);
    try { const P = PLANS[policy].plan; for (const T of P) take(R, T); hunt(R, P); R.until(() => false, cap); } catch (e) { if (e instanceof Done) { end = e.end; note = e.why; } else throw e; }
  } catch (e: any) { end = 'error'; note = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { console.log = log; }
  if (end === 'taken' && R && !R.ops.length) { end = 'wiped'; note = 'the last defender and the last teammate in the same moment'; }
  return { policy, seed, end, t: R?.t ?? 0, opsUp: R ? R.ops.length : 0, cleared: R ? R.RC.rooms.filter((r: any) => r.cleared).map((r: any) => r.def.id) : [], effect: R?.effect ?? { open: 0, bang: 0, charge: 0, outside: 0 }, used: R?.used ?? { open: 0, bang: 0, charge: 0, outside: 0 },
    falls: (R?.falls ?? []).map((f: any) => ({ who: f.who, team: f.team, where: f.where, by: f.by, working: f.working })), steps: R?.steps ?? [], note, trace: R?.trace ?? [] };
}

// ───────────────────────────────────────────────────────────── one door, one tool ─────────────────────────────────────────────────────────────
interface Exp { id: string; group: string; words: string; room: string; door: string; face: string; tool: Tool; /** the floor before the order */ set?: ('frontTaken' | 'recordsTaken' | 'strongTaken' | 'lampOut' | 'noiseFront' | 'noiseHallE' | 'staffDark' | 'hallDark')[]; }
const E = (id: string, group: string, words: string, room: string, door: string, face: string, tool: Tool, set: Exp['set'] = []): Exp => ({ id, group, words, room, door, face, tool, set });
const EXPS: Exp[] = [
  E('front-quiet-open', 'front', 'front office, QUIET floor, front door: open and clear', 'front', 'front', 'out', 'open'),
  E('front-quiet-bang', 'front', 'front office, quiet floor, front door: bang and clear', 'front', 'front', 'out', 'bang'),
  E('front-quiet-outside', 'front', 'front office, quiet floor, front door: clear from outside, then in', 'front', 'front', 'out', 'outside'),
  E('rec-hall-open', 'records', 'records, after the front office (noise from the south), HALL door: open and clear', 'records', 'records_hall', 'hall', 'open', ['frontTaken', 'noiseFront']),
  E('rec-hall-bang', 'records', '… hall door: bang and clear', 'records', 'records_hall', 'hall', 'bang', ['frontTaken', 'noiseFront']),
  E('rec-hall-charge', 'records', '… hall door: charge', 'records', 'records_hall', 'hall', 'charge', ['frontTaken', 'noiseFront']),
  E('rec-hall-outside', 'records', '… hall door: clear from outside, then in', 'records', 'records_hall', 'hall', 'outside', ['frontTaken', 'noiseFront']),
  E('rec-west-open', 'records', '… WEST door, from the dark yard: open and clear', 'records', 'records_west', 'out', 'open', ['frontTaken', 'noiseFront']),
  E('rec-west-outside', 'records', '… west door: clear from outside, then in', 'records', 'records_west', 'out', 'outside', ['frontTaken', 'noiseFront']),
  E('rec-west-bang', 'records', '… west door: bang and clear', 'records', 'records_west', 'out', 'bang', ['frontTaken', 'noiseFront']),
  E('rec-west-quiet-open', 'records', 'records FIRST, on a quiet floor, west door: open and clear', 'records', 'records_west', 'out', 'open'),
  E('rec-west-quiet-outside', 'records', 'records first, quiet floor, west door: clear from outside, then in', 'records', 'records_west', 'out', 'outside'),
  E('strong-open', 'strong', 'strong room, records taken, its one (locked) door: open and clear', 'strong', 'strong_room', 'records', 'open', ['frontTaken', 'recordsTaken', 'noiseFront']),
  E('strong-bang', 'strong', '… bang and clear', 'strong', 'strong_room', 'records', 'bang', ['frontTaken', 'recordsTaken', 'noiseFront']),
  E('strong-charge', 'strong', '… charge', 'strong', 'strong_room', 'records', 'charge', ['frontTaken', 'recordsTaken', 'noiseFront']),
  E('staff-hall-open', 'staff', 'staff room LAST (the other three taken; noise at the hall\'s east end), HALL door: open and clear', 'staff', 'staff_hall', 'hall', 'open', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE']),
  E('staff-hall-bang', 'staff', '… hall door: bang and clear', 'staff', 'staff_hall', 'hall', 'bang', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE']),
  E('staff-hall-charge', 'staff', '… hall door: charge', 'staff', 'staff_hall', 'hall', 'charge', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE']),
  E('staff-east-lamp-open', 'staff', '… EAST door, street lamp LIT: open and clear', 'staff', 'staff_east', 'out', 'open', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE']),
  E('staff-east-dark-open', 'staff', '… east door, lamp SHOT OUT: open and clear', 'staff', 'staff_east', 'out', 'open', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE', 'lampOut']),
  E('staff-east-lamp-outside', 'staff', '… east door, lamp lit: clear from outside, then in', 'staff', 'staff_east', 'out', 'outside', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE']),
  E('staff-east-dark-outside', 'staff', '… east door, lamp out: clear from outside, then in', 'staff', 'staff_east', 'out', 'outside', ['frontTaken', 'recordsTaken', 'strongTaken', 'noiseHallE', 'lampOut']),
];
interface DoorOut { id: string; seed: number; lost: number; down: number; of: number; taken: boolean; outsideDown: number; watched: string[]; rallied: number; note: string; trace: string[] }
async function door(X: Exp, seed: number, verbose = false): Promise<DoorOut> {
  const log = console.log; if (!verbose) console.log = () => {};
  const out: DoorOut = { id: X.id, seed, lost: 0, down: 0, of: 0, taken: false, outsideDown: 0, watched: [], rallied: 0, note: '', trace: [] };
  let R: RRun | null = null;
  try {
    R = await stage(seed, 150, verbose); const g = R.g, room = R.room(X.room);
    const quietKill = (id: string) => { for (const h of R!.room(id).defenders) if (h.state !== 'dead') killGuard(g, h, [1, 0, 0], true, 'struck', 'player'); };
    try {
      if (X.set!.includes('lampOut')) lampOut(R);
      if (X.set!.includes('staffDark')) g.setGroup('staff', false);
      if (X.set!.includes('hallDark')) g.setGroup('hall', false);
      if (X.set!.includes('frontTaken')) quietKill('front');
      if (X.set!.includes('recordsTaken')) quietKill('records');
      if (X.set!.includes('strongTaken')) quietKill('strong');
      const noise: Vec3 | null = X.set!.includes('noiseFront') ? [13.4, 0, 19.9] : X.set!.includes('noiseHallE') ? [27.5, 0, 15.2] : null;
      if (noise) { dropThrowable(g, 'flash', noise); R.wait(4); R.until(() => clearEyed(R!), 8); }
      out.of = room.defenders.filter((h: any) => h.state !== 'dead').length;
      out.watched = room.defenders.filter((h: any) => h.state !== 'dead').map((h: any) => g.fight.watchOf(h)?.settled ?? 'as put');
      const home = new Map<any, string>(); for (const r of R.RC.rooms) for (const h of r.defenders) home.set(h, r.def.id);
      R.sam(STAND[`${X.door}:${X.face}`]); const up0 = R.ops.length, def0 = out.of; let tool = X.tool;
      if (tool === 'outside') { try { if (R.tool('outside', X.door)) holdOutside(R, X.room); } finally { out.outsideDown = def0 - R.defendersUp(X.room); } tool = 'open'; }
      if (!room.cleared && R.ops.length) {
        if (tool === 'charge') { if (R.tool('charge', X.door)) R.blow(X.door); else out.note = 'charge refused'; }
        else if (!R.tool(tool === 'bang' ? 'bangClear' : 'openClear', X.door)) out.note = `${tool} refused: ${R.refused.at(-1) ?? ''}`;
      }
      R.wait(6);
      out.lost = up0 - R.ops.length; out.down = def0 - R.defendersUp(X.room); out.taken = room.cleared;
      out.rallied = [...home.entries()].filter(([h, id]) => id !== X.room && h.state !== 'dead' && R!.RC.roomAt(h.char.pos) !== id).length;
    } catch (e) { if (e instanceof Done) { out.note = `ended: ${e.end}`; out.lost = 2 - R.ops.length; out.down = out.of - R.defendersUp(X.room); out.taken = room.cleared; } else throw e; }
    out.trace = R.trace;
  } catch (e: any) { out.note = 'ERROR ' + String(e?.stack ?? e).split('\n').slice(0, 2).join(' | '); }
  finally { console.log = log; }
  return out;
}

// ───────────────────────────────────────────────────────────── the command line ─────────────────────────────────────────────────────────────
function table(rows: string[][]): string { const w = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length))); return rows.map(r => r.map((x, c) => (c ? x.padStart(w[c]) : x.padEnd(w[c]))).join('  ')).join('\n'); }
function seedsOf(s: string): number[] { const out: number[] = []; for (const part of s.split(',')) { const m = /^(\d+)-(\d+)$/.exec(part); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else if (/^\d+$/.test(part)) out.push(+part); else { console.error(`bad seed list '${s}'`); process.exit(2); } } return out; }
/** workers that died without a result: named, and every table that lost a row to one says so and is red */
const DEAD: string[] = [];
const deadLines = () => { for (const d of DEAD) console.log(`- FAIL — a worker printed no result: ${d}`); return DEAD.length; };
async function farm<T>(jobs: string[][], n: number): Promise<T[]> {
  const out: T[] = []; let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < jobs.length) { const j = jobs[next++];
    const proc = Bun.spawn(['bun', 'run', import.meta.path, ...j], { stdout: 'pipe', stderr: 'pipe' }); const [text, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]); await proc.exited;
    const line = text.split('\n').find(l => l.startsWith('RESULT ')); if (line) out.push(JSON.parse(line.slice(7))); else DEAD.push(`${j.join(' ')}: ${(err || text).trim().split('\n').slice(-3).join(' | ')}`); } }));
  return out;
}
if (import.meta.main) {
  const argv = process.argv.slice(2), mode = argv[0]; const opt = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const FLAGS = ['seeds', 'policies', 'jobs', 'json', 'cap', 'only', 'also', 'kit', 'rally'], SETS = ['frontTaken', 'recordsTaken', 'strongTaken', 'lampOut', 'noiseFront', 'noiseHallE', 'staffDark', 'hallDark'];
  const usage = (why: string): never => { console.error(`${why}\nusage: records-runs.ts runs|doors|trace <policy>:<seed>|trace-door <id>:<seed> [${FLAGS.map(f => `--${f} …`).join(' ')}]`); process.exit(2); };
  for (let i = 1; i < argv.length; i++) if (argv[i].startsWith('--')) { if (!FLAGS.includes(argv[i].slice(2))) usage(`unknown flag ${argv[i]}`); if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) usage(`${argv[i]} wants a value`); i++; }
  if (!['runs', 'doors', 'trace', 'trace-door', 'worker-run', 'worker-door'].includes(mode)) usage(`unknown mode '${mode ?? ''}'`);
  if (mode.startsWith('trace') && !/^[\w-]+:\d+$/.test(argv[1] ?? '')) usage(`${mode} wants <name>:<seed>`);
  const jobs = +opt('jobs', '4'), cap = +opt('cap', '300');
  if (argv.includes('--kit')) { const [c, b] = opt('kit', '').split(',').map(Number); if (!Number.isInteger(c) || !Number.isInteger(b)) usage('--kit charges,bangs'); KIT = { charges: c, bangs: b }; }
  if (argv.includes('--rally')) { const v = opt('rally', ''); if (v !== 'off' && v !== 'on') usage('--rally off|on'); RALLY_OFF = v === 'off'; }
  const kitArgs = [...(KIT ? ['--kit', `${KIT.charges},${KIT.bangs}`] : []), ...(RALLY_OFF ? ['--rally', 'off'] : [])];
  const also = opt('also', '').split(',').filter(Boolean) as NonNullable<Exp['set']>;   // --also staffDark,hallDark: the same situations with these added to each set-up (an A/B of the level's lighting)
  for (const a of also) if (!SETS.includes(a)) usage(`--also: no set-up '${a}' — ${SETS.join(', ')}`);
  if (also.length) for (const X of EXPS) X.set = [...X.set!, ...also];
  if (mode === 'worker-run') { console.log('RESULT ' + JSON.stringify({ ...(await play(argv[1], +argv[2], +argv[3])), trace: [] })); process.exit(0); }
  if (mode === 'worker-door') { console.log('RESULT ' + JSON.stringify({ ...(await door(EXPS.find(x => x.id === argv[1])!, +argv[2])), trace: [] })); process.exit(0); }
  if (mode === 'trace') { const [p, s] = argv[1].split(':'); if (!PLANS[p]) { console.error(`no policy '${p}'`); process.exit(2); } const r = await play(p, +s, cap, true); console.log(`→ ${r.end} at ${f1(r.t)} s · pair ${r.opsUp}/2 · rooms ${r.cleared.join(', ') || 'none'} · ${r.note}\n${r.steps.join('\n')}`); process.exit(0); }
  if (mode === 'trace-door') { const [p, s] = argv[1].split(':'); const X = EXPS.find(x => x.id === p); if (!X) { console.error(`no experiment '${p}' — ${EXPS.map(x => x.id).join(', ')}`); process.exit(2); } const r = await door(X, +s, true); console.log(JSON.stringify({ ...r, trace: undefined })); process.exit(0); }
  if (mode === 'runs') {
    const seeds = seedsOf(opt('seeds', '1-12')), policies = opt('policies', Object.keys(PLANS).join(',')).split(',');
    for (const p of policies) if (!PLANS[p]) { console.error(`no policy '${p}' — ${Object.keys(PLANS).join(', ')}`); process.exit(2); }
    const runs = (await farm<RunOut>(policies.flatMap(p => seeds.map(s => ['worker-run', p, String(s), String(cap), ...kitArgs])), jobs)).sort((a, b) => a.policy.localeCompare(b.policy) || a.seed - b.seed);
    const rows = [['policy', 'runs', 'taken', 'wiped', 'stalled', 'error', 'pair left (taken)', 'time (taken)', 'all 4 tools to effect']];
    let anyFinish = 0, anyAll = 0;
    for (const p of policies) { const r = runs.filter(x => x.policy === p), t = r.filter(x => x.end === 'taken'), all4 = t.filter(x => (['open', 'bang', 'charge', 'outside'] as Tool[]).every(k => x.effect[k] > 0));
      anyFinish = Math.max(anyFinish, t.length); anyAll += all4.length;
      rows.push([p, String(r.length), `${t.length} (${pct(t.length, r.length)})`, String(r.filter(x => x.end === 'wiped').length), String(r.filter(x => x.end === 'stalled').length), String(r.filter(x => x.end === 'error').length),
        t.length ? f1(t.reduce((n, x) => n + x.opsUp, 0) / t.length) : '—', t.length ? `${f1(t.reduce((n, x) => n + x.t, 0) / t.length)} s` : '—', `${all4.length}${all4.length ? ` (seeds ${all4.map(x => x.seed).join(' ')})` : ''}`]); }
    console.log(`=== records-runs: the pair room clear on levels/records.json, seeds ${opt('seeds', '1-12')}${KIT ? ` — the squad carries ${KIT.charges} charge(s), ${KIT.bangs} bang(s)` : ` — ${DT_DEFAULTS.charges} charges, ${DT_DEFAULTS.bangs} bangs as shipped`}${RALLY_OFF ? ' — RALLY OFF (a what-if: the defenders kept in their rooms)' : ''} ===`); for (const p of policies) console.log(`  ${PLANS[p].words}`); console.log(table(rows));
    for (const p of policies) { const r = runs.filter(x => x.policy === p); const eff = (k: Tool) => `${k} ${r.reduce((n, x) => n + x.effect[k], 0)}/${r.reduce((n, x) => n + x.used[k], 0)}`;
      console.log(`\n${p}: tools to effect / used — ${(['open', 'bang', 'charge', 'outside'] as Tool[]).map(eff).join(' · ')}`);
      const where: Record<string, number> = {}; for (const x of r) for (const f of x.falls) if (f.team === 'operative') { const k = `working ${f.working}, fell in ${f.where}`; where[k] = (where[k] ?? 0) + 1; }
      console.log(`  pair's falls: ${Object.entries(where).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}× ${k}`).join(' · ') || 'none'}`);
      for (const x of r) console.log(`  seed ${String(x.seed).padStart(3)}: ${x.end.padEnd(7)} ${f1(x.t).padStart(6)} s  pair ${x.opsUp}/2  rooms ${x.cleared.length}/4  ${x.note}${x.end === 'error' ? '' : ''}`); }
    if (argv.includes('--json')) writeFileSync(opt('json', ''), JSON.stringify(runs));
    const errors = runs.filter(x => x.end === 'error').length + deadLines();
    const TOOLS: Tool[] = ['open', 'bang', 'charge', 'outside'], done = runs.filter(x => x.end === 'taken');
    const per = TOOLS.map(k => done.filter(x => x.effect[k] > 0)), each = per.every(r => r.length > 0);
    const ok = anyFinish >= 3 && each && !errors;
    console.log(`\n- ${anyFinish >= 3 ? 'PASS' : 'FAIL'} — a scripted policy finishes the level (all four rooms cleared) on ${anyFinish} seeds (≥ 3)`);
    console.log(`- ${each ? 'PASS' : 'FAIL'} — each door tool used to effect in a finishing run: ${TOOLS.map((k, i) => `${k} in ${per[i].length} of ${done.length}${per[i].length && per[i].length <= 6 ? ` (${per[i].map(x => `${x.policy}:${x.seed}`).join(' ')})` : ''}`).join(' · ')}`);
    console.log(`  (not required: all four in ONE finishing run — ${anyAll} of ${done.length})`);
    console.log(`- ${errors ? 'FAIL' : 'PASS'} — ${errors} run(s) errored`);
    console.log(ok ? '=== records-runs runs: ALL PASS ===' : '=== records-runs runs: FAILED ==='); process.exit(ok ? 0 : 1);
  }
  if (mode === 'doors') {
    const seeds = seedsOf(opt('seeds', '1-10')), only = opt('only', ''); const exps = EXPS.filter(x => !only || only.split(',').includes(x.group) || only.split(',').includes(x.id));
    const res = await farm<DoorOut>(exps.flatMap(x => seeds.map(s => ['worker-door', x.id, String(s), ...kitArgs, ...(also.length ? ['--also', also.join(',')] : [])])), jobs);
    console.log(`=== records-runs doors: one door, one tool, seeds ${opt('seeds', '1-10')} (the pair alone; Sam commands unseen)${also.length ? ` — WITH ${also.join(' + ')}` : ''} ===`);
    const rows = [['situation', 'n', 'pair lost', 'room\'s men down', 'room taken', 'down from outside', 'others who left their room', 'watching (settled)']];
    for (const X of exps) { const r = res.filter(x => x.id === X.id); const n = r.length, of = r.reduce((a, x) => a + x.of, 0); const w: Record<string, number> = {}; for (const x of r) for (const d of x.watched) w[d] = (w[d] ?? 0) + 1;
      rows.push([X.words, String(n), `${r.reduce((a, x) => a + x.lost, 0)}/${n * 2}`, `${r.reduce((a, x) => a + x.down, 0)}/${of}`, `${r.filter(x => x.taken).length}/${n}`, X.tool === 'outside' ? `${r.reduce((a, x) => a + x.outsideDown, 0)}/${of}` : '', String(r.reduce((a, x) => a + x.rallied, 0)), Object.entries(w).map(([k, v]) => `${k} ${v}`).join(', ')]);
      const notes = r.filter(x => x.note && !/^ended/.test(x.note)); if (notes.length) rows[rows.length - 1][0] += ` [${notes.length} noted: ${notes[0].note.slice(0, 60)}]`; }
    console.log(table(rows));
    if (argv.includes('--json')) writeFileSync(opt('json', ''), JSON.stringify(res));
    if (deadLines()) { console.log('=== records-runs doors: FAILED (rows are missing from the table) ==='); process.exit(1); }
    console.log('=== records-runs doors: NO VERDICT (a table) ==='); process.exit(0);
  }
  console.error('usage: bun run tools/qa/records-runs.ts runs|doors|trace <policy>:<seed>|trace-door <id>:<seed>'); process.exit(2);
}

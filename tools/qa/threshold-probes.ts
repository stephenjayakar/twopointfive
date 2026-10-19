// The 'threshold' family (game/doortools.ts — kind 'threshold': a room worked from the threshold before anybody goes in), run through probes.ts:
//   bun run tools/qa/probes.ts threshold | threshold-pair | threshold-four | threshold-hold | threshold-first | threshold-doors | threshold-leaf | threshold-last | threshold-hand | threshold-play | threshold-identity
// PASS / FAIL each, all headless. Every probe here gives the stage the way a console would (its rows on the door menu are thresholdmenu-probes.ts's) —
// `game.doorTools.thresholdOn(<door name>, 'all')` — on a start-card scenario staged exactly as the page stages it (scenarioList.ts → scenarioRun.ts).
// The harness has no light meter (what a man sees of another is guards.ts's direct-light estimate), no smoke, no picture: nothing here says how it LOOKS.
//   threshold-pair      the pair (the records office, and the office's room clear), a held room's door, three seeds each: the order is taken; when the leaf
//                       moves a man stands on each jamb, outside; the stage's phases come in order — stacked → threshold → held → (toss → bang →) step in →
//                       first man over the line → hand-over → searched → in; NO man of the order is over the frame line, nor on the room's floor, on any frame
//                       before 'step in'; rounds are fired at the room's men from outside it; the blind pockets get a can from a man who is not the first man
//                       in, bursting inside the room, before anybody crosses; every point stepped in to is 2.5 m or less inside; and the order ends as any
//                       entry does — the floor looked over by the entry's own search, the men left holding the room
//   threshold-four      the same with the squad of four (the depot, and the office's four-man room clear) — and the two men who are on neither jamb are outside
//                       with their eyes spare for the squad's back (orders.ts Assignment.spare) for as long as the room is worked
//   threshold-hold      the OTHER order of it — work the room from the threshold and HOLD the jambs until told (thresholdOn(door, who, side, true)) — with the
//                       pair (the records office) and the four (the depot): the door gone quiet, the lead says so and NOBODY goes in, no can is spent, for
//                       ten seconds past the moment the plain order would have gone; then each thing Sam can say, in a run of its own — step in
//                       (thresholdTell('step'): in with no can), bang and step in ('bang': a can bursts inside before anybody crosses), leave it ('leave': the
//                       order over, nobody ever inside, the kit as it was), the word from code (doorTools.go) and the word on its key (F, one frame); a
//                       follow-up that cannot be done is refused in words; and the four on two doors of one room — blue holding a threshold, red on a
//                       plain stack — cross together on one word, behind the last burst
//   threshold-first     DOORTOOLS.thrFirst — the floor gone loud in the team's ears (the stager's fight.hotT): the leaf opened from the jamb, the first of the
//                       stage's cans in, its burst let run dry, and only then the jamb men out onto their diagonals; the switch's three positions
//                       (the second can for a pocket the first left dark is asked without DOORTOOLS.outsidePlain; on a stand that has that rule — the
//                       shipped one — a line more: one can a door at that same door, on the word too)
//   threshold-doors     every door of the levels the seven scenarios play on, both faces: wherever the stack's own test passes (floor at a jamb), the stage
//                       has somewhere shallow to step in to (2.5 m or less inside); the count of faces with a man on EACH jamb and with one jamb only is printed
//   threshold-leaf      DOORTOOLS.thrDoorsLeaf: a man left on another door of the room is not put where that door's own leaf, stood open, hides it from
//                       him — the depot, rule off beside rule on, three seeds (THRDOORSLEAF_BREAK=1: red)
//   threshold-hand      DOORTOOLS.thrHand — a threshold held, every man put off the door from a second before Sam says 'bang, then step in' until a second
//                       after (what a grenade by the stack does to them): with the rule the can waits for a man back at the door — not the lead — and no
//                       longer than thrHandWait in all, past which it goes as it did, from the same man; without it the can leaves a doorway nobody
//                       stands at; nobody put off, the rule changes no beat; a recording from before the key replays with it off. THRHAND_BREAK=1 must fail
//   threshold-play      the scripted commander of playthrough.ts with PT_TOOL=threshold — every held room of all seven scenarios worked from the threshold
//                       instead of banged (the two rescues' F is their own drill: they run as ever) — one seed each: no run throws, none stalls
//   threshold-last      DOORTOOLS.thrLast (the captor's last warning heard at the door): the registry's hostage door staged by hand — the stack goes
//                       without a man still walking up (the far-jamb man: given the lead's wall, never across the door; the lead: the door handed to
//                       the man on his jamb; Sam in the place: the next one), nothing held, one can; off: the stack waits — and the rescue played from
//                       the threshold on two seeds whose clock runs out at the door, with the rule and without: a man across before the clock's round,
//                       both hostages alive, nobody more lost than without it
//   threshold-identity  with the stage NOT ordered the game plays as it did at af55d89: playthrough.ts's digest of the whole game every half second
//                       (PT_DIGEST=1), seven scenarios × two seeds, against the words frozen from that commit (fixtures/threshold-identity.json; THRESHOLD_IDENTITY_WRITE='<why>' re-freezes them after a step that moves the levels' walls)
//                       — asked on the FROZEN stand only: under TPS_PROFILE=shipped it says so and checks nothing (the digests are the frozen stand's)
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS, doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { GLASSPEN } = await import(`${ROOT}/src/game/glasspen.ts`);
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { feelTables } = await import(`${ROOT}/src/game/teamfeel.ts`);
const { SAMSTUN, SAMSTUN_STATS } = await import(`${ROOT}/src/game/samstun.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** every probe leaves the feel tables (teamfeel.ts: DOORTOOLS among them) as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { const T = feelTables(), keep = JSON.parse(JSON.stringify(T)); try { return await fn(); } finally { NO_PLAIN = NODEAL = YARDOUT = false; DOORSLEAF = null; HAND = NOCAN = FRAGHOLD = HANDWAIT = null; for (const n of Object.keys(keep)) Object.assign(T[n], keep[n]); } };
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };

// a door's own frame (doortools.ts keeps these to itself): metres along hinge → latch, and off the frame line on face `side`
const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const offOf = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };

/** threshold-first's two can lines: DOORTOOLS.outsidePlain held off for the runs staged while this is set */
let NO_PLAIN = false;
/** threshold-hand: DOORTOOLS.thrHand as the runs staged while this is set have it (null: the stand's own) — written after each stand-up, as NO_PLAIN is */
let HAND: boolean | null = null;
/** threshold-grenade: DOORTOOLS.thrNoCan and thrFragHold, the same way */
let NOCAN: boolean | null = null, FRAGHOLD: boolean | null = null;
/** DOORTOOLS.wordNoCan as every run staged here has it (true raises the one-order outside clear it acts with). OFF but for threshold-hold's own two runs of it, on both
 *  stands: every other line in this file was written of a word that bangs the blind pockets, and asks what that can does (the kit, who it blinds, Sam behind the door). */
let WORDNOCAN = false;
/** squads from the rooms (SQUADDEAL) held off for the runs staged while this is set, by the stand's own word. threshold-hold: its men hold ten seconds and more
 *  before they are told, and on a dealt floor the room's men are their squad's and have dug in by then (digin.ts) — what the step in then meets is that drill,
 *  not the door. Its lines were written of a room-fight floor and ask what the door tools do there. */
let NODEAL = false;
/** THE YARD'S GUNS OUT OF IT, for the runs staged while this is set: on a door another room watches (the depot's `a_s` on the floodlit yard — heldEntries) every
 *  defender who is not at home in the room behind the door is taken off the floor as the order is given. threshold-four and threshold-first ask what the
 *  THRESHOLD does with the room; with those guns in it who is left on the jambs is the yard fight's dice, and which of three seeds holds a wipe moved with any
 *  change that shifted a walk by half a second (three flips of threshold-four in a day, none of them a door rule's). */
let YARDOUT = false;
/** … and DOORTOOLS.thrDoorsLeaf as given for the runs staged while this is set (null: the stand's own) — threshold-leaf */
let DOORSLEAF: boolean | null = null;
/** … and the order's one wait, DOORTOOLS.thrHandWait, for the runs staged while this is set (null: the table's own) */
let HANDWAIT: number | null = null;
/** a start-card scenario staged as the page stages it, under a seed (the playthrough's own recipe: the page's chaos, Sam in god mode and pinned dark) */
async function stage(scn: string, seed: number) {
  const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) throw new Error(`no scenario '${scn}'`);
  Math.random = seeded(0x9137 + seed * 7919);
  const sd0 = process.env.TPS_SQUADDEAL, noDeal = NODEAL; if (noDeal) process.env.TPS_SQUADDEAL = '0';
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })).finally(() => { if (!noDeal) return; if (sd0 === undefined) delete process.env.TPS_SQUADDEAL; else process.env.TPS_SQUADDEAL = sd0; }); const g = W.game;
  if (DOORSLEAF !== null) DOORTOOLS.thrDoorsLeaf = DOORSLEAF;
  if (NO_PLAIN) DOORTOOLS.outsidePlain = false;   // (after the stand-up, which on a stand that names TPS_OUTSIDEPLAIN writes the rule again every time)
  if (HAND !== null) DOORTOOLS.thrHand = HAND;
  DOORTOOLS.wordNoCan = WORDNOCAN; if (WORDNOCAN) DOORTOOLS.outsidePlain = true;
  if (NOCAN !== null) DOORTOOLS.thrNoCan = NOCAN; if (FRAGHOLD !== null) DOORTOOLS.thrFragHold = FRAGHOLD; if (HANDWAIT !== null) DOORTOOLS.thrHandWait = HANDWAIT;
  g.godMode = true; g.tune.chaos = 0.5;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(q))); if (why) throw new Error(`${scn}: start refused — ${why}`);
  const R = { E, W, g, O: g.orders, D: g.doorTools, post: null as null | (() => void),
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); R.post?.(); } },
    get team(): any[] { return R.O.squad(); }, get hostiles(): any[] { return g.guards.filter((x: any) => x.team === 'hostile'); } };
  await quiet(() => R.step(20));
  return R;
}
type Rig = Awaited<ReturnType<typeof stage>>;

/** the rooms that still hold a living defender at home (the room fight's own model), each with its entries — nearest the team first.
 *  `unwatched`: only the entries a HOLD can be asked of — the door whose only say is the room's behind it:
 *   · no living defender of ANOTHER room has a line, from where he is posted, to the floor the squad works it from (`watchedBy`). On the motor-pool depot the
 *     nearest door, the crew room's `a_s`, is on the floodlit yard under the comms hut's west slit and the store's hatch (tools/levels/depot.ts: 'the obvious
 *     one, and the watched one'): four men stacked on it are in a fire fight across the yard before the room behind the door has said anything, and who is
 *     left on the jambs is that fight's dice — on either stand;
 *   · the order takes it from the face the held room is NOT on (`outFace`): that depot's `a_e` is nearer the team through the crew room itself than round by
 *     the battery room, so an order on it is worked from the crew room's own floor, into the wash room.
 *  What is left there is the store's `c_w`, from the bay. The records office's `front` passes both and is picked as it was. */
function heldEntries(R: Rig, unwatched = false): { room: any; ent: any }[] {
  const g = R.g, rooms = new Set<any>(), mid = R.team[0]?.char.pos ?? g.player.char.pos;
  for (const d of g.fight.defs) if (d.room && d.room.entries.length && d.room.cells.size <= 500 && d.gd.state !== 'dead') rooms.add(d.room);
  const out: { room: any; ent: any }[] = []; for (const room of rooms) for (const ent of room.entries) out.push({ room, ent });
  return out.sort((a, b) => flat(a.ent.at, mid) - flat(b.ent.at, mid)).filter(x => !unwatched || (outFace(R, x.ent) && !watchedBy(R, x.room, x.ent).length));
}
/** the face an order of the whole team takes `ent`'s door from (doortools.ts thresholdOn's own choice, Sam put outside as doorRun puts him) is the entry's outside */
function outFace(R: Rig, ent: any): boolean {
  const d = ent.door, out = offOf(d, [ent.at[0] + ent.out[0], 0, ent.at[2] + ent.out[1]], 1) >= 0 ? 1 : -1, men = R.O.men('all');
  return (R.O.big && men.length ? R.O.sideFor(d, men, out) : out) === out;
}
/** the living defenders at home in a room OTHER than `room` with an open line, from where they stand, to the floor the squad works `ent` from: the opening's
 *  face and the jamb and rear marks either side of it (the ones on open floor in the face's own sight) */
function watchedBy(R: Rig, room: any, ent: any): string[] {
  const g = R.g, nav = g.col.nav, lx = -ent.out[1], lz = ent.out[0], c = [ent.at[0] + ent.out[0] * 0.7, 1.2, ent.at[2] + ent.out[1] * 0.7];
  const pts = [-2.2, -1.3, 0, 1.3, 2.2].map(l => [c[0] + lx * l, 1.2, c[2] + lz * l]).filter(p => !nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked(c, p));
  return g.fight.defs.filter((d: any) => d.room !== room && d.gd.state !== 'dead' && pts.some(p => !g.col.segmentBlocked([d.gd.char.pos[0], 1.5, d.gd.char.pos[2]], p))).map((d: any) => d.gd.callsign ?? 'a man');
}

interface Run {
  scn: string; seed: number; door: string; n: number; why: string | null;
  beats: { t: number; what: string }[]; ended: string; phases: string[];
  /** when the leaf moved: each man's place in the door's frame (along hinge → latch, off the line on the squad's face), who leads */
  atOpen: { who: string; along: number; off: number; lead: boolean; spare: boolean; glass?: number }[]; W: number;
  /** GLASS IS NOT COVER (orders.ts glassEyes; 0 while rounds stop in glass): the room's lines THROUGH GLASS onto each man's place as the leaf moved (atOpen.glass) and
   *  onto the jamb across the opening from the lead's · a can that went in first: was the floor loud in a man of the order's ears as it was dealt (roomfight.ts hotFor) */
  glassJamb?: number; firstHot?: boolean;
  /** the probe's OWN watch, not the module's beats: per man the first frame he was over the frame line, or on the room's floor */
  firstIn: Map<string, number>; inBefore: number;
  /** rounds fired by the order's men, with where the shooter stood · their men who dropped, by whom · every blast */
  shots: { t: number; who: string; outside: boolean }[]; downs: { t: number; who: string; by: string; byOutside: boolean }[]; bangs: { t: number; inside: number }[];
  /** the order's own men lost to a defender who is NOT at home in the room behind the door (another room's, the yard's): who, by whom */
  yard: { who: string; by: string }[];
  bangs0: number; bangs1: number; pods: { who: string; deep: number }[]; holding: number; alive: number; left: number; cells: number; doorMen: { who: string; door: string; arrived: boolean; dist: number; line: boolean; inRoom: boolean; /** that door's own leaf, stood open on its stop, lies across his line to it */ leaf: boolean }[];
  /** man-frames the rear men spent with their eyes spare while the room was worked, of the man-frames they could have */
  spare: number; spareOf: number; secs: number;
  /** the order given to HOLD: when the lead said the door had gone quiet, when Sam said what next and what came back (null: taken), the kit's bangs and the
   *  order's phase on that frame · at the end: each man still up, how far off the frame line on the squad's face, and what he is doing */
  toldT: number; tellT: number; tellR: string | null; tellBangs: number; tellPhase: string; endAt: { who: string; off: number; doing: string }[];
  /** DOORTOOLS.thrFirst: the furthest any man of the order got off his mark on the wall — beyond where he stood as the leaf moved — before the stage sent the jamb men out onto their
   *  diagonals (the beat 'out onto the diagonals …' / 'no can first …'; NaN: the stage never held them back) · the kit's cans on that frame */
  heldBack: number; outBangs: number;
  /** each can as it left: who threw it and how far from the frame's centre he stood on that frame (DOORTOOLS.thrHand) */
  tossAt: { who: string; near: number; lead: string }[];
  /** how long the hold had run when it first ended (with doorRun's `frag`: the first time after the grenade), who of the order was not at the door or on his mark that frame, and who was not the frame 'step in' was said;
   *  doorRun's `frag`: when the grenade was put down (game time) and who ran from it */
  thrEndT: number; offAtEnd?: string[]; offAtStep?: string[]; fragT: number; fragRan: string[];
  /** … and how far into the hold every living man was first back at the door or on his mark with nobody still running (the probe's own look, rule or no rule) */
  backT: number;
}
/** given to hold: what Sam says `after` seconds past the lead's 'holding' — a follow-up by name, the word from code, or the word's key for one frame */
interface Hold { tell: 'step' | 'bang' | 'leave' | 'word' | 'key'; after: number; /** the word given a second time, this long after the first */ again?: number }
const tOf = (r: Run, re: RegExp) => r.beats.find(b => re.test(b.what))?.t ?? NaN;
const idx = (r: Run, re: RegExp) => r.beats.findIndex(b => re.test(b.what));

/** ONE DOOR WORKED FROM THE THRESHOLD: the scenario staged, the commander stood a few metres off the door on the squad's side of it, the stage ordered by the
 *  door's name, and everything watched until the order ends. `door` null: the nearest entry of a held room that takes the order. `away` (with `hold`): from
 *  a second before Sam says what next until that many seconds after, every man of the order is kept RUN OFF THE DOOR — stood on floor beyond a throw of the
 *  frame, as a grenade landing by the stack leaves them (frag.ts fragFlee), and not to be dropped while there; then let go to walk back to his own mark. */
async function doorRun(scn: string, seed: number, door: string | null = null, cap = 90, word = NaN, hold: Hold | null = null, hot = false, unwatched = false, away = 0, frag = NaN): Promise<Run> {
  const R = await stage(scn, seed), g = R.g, D = R.D, men0: any[] = [...R.team];
  const FR: any = isNaN(frag) ? null : await import(`${ROOT}/src/game/frag.ts`); if (FR) FR.FRAG.on = true;   // (`frag`: a defender's grenade is put down — at the lead's feet that many s before Sam speaks to a held door, or at the rear-most man's that far into a hold that steps in by itself; the men get off it by their own rule — frag.ts fragFlee — and are kept from its burst)
  const out: Run = { scn, seed, door: door ?? '', n: men0.length, why: null, beats: [], ended: '', phases: [], atOpen: [], W: 0, firstIn: new Map(), inBefore: 0, shots: [], downs: [], bangs: [], yard: [], bangs0: D.bangs, bangs1: D.bangs, pods: [], doorMen: [], holding: 0, alive: 0, left: NaN, cells: NaN, spare: 0, spareOf: 0, secs: 0, toldT: NaN, tellT: NaN, tellR: null, tellBangs: NaN, tellPhase: '', endAt: [], heldBack: NaN, outBangs: NaN, tossAt: [], fragT: NaN, fragRan: [], thrEndT: NaN, backT: NaN };
  let op: any = null, room: any = null; const stoodAt = new Map<any, number[]>(); let canFirst = false;
  for (const { room: rm, ent } of heldEntries(R, unwatched)) { const d = ent.door; if (door && d.def.name !== door) continue;
    // the commander: off the opening's line, on the face the room is NOT on (a ghost — he is put there, he does not walk)
    const lx = -ent.out[1], lz = ent.out[0]; let sam: number[] | null = null;
    for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [2.6, 0]]) { const p = [ent.at[0] + ent.out[0] * back + lx * lat, 0, ent.at[2] + ent.out[1] * back + lz * lat]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.1, p[2]], [ent.at[0] + ent.out[0] * 0.7, 1.1, ent.at[2] + ent.out[1] * 0.7])) { sam = p; break; } }
    if (!sam) continue; g.teleportPlayer(sam);
    const r = D.thresholdOn(d.def.name, 'all', undefined, !!hold); if (typeof r === 'string') { out.why = `${d.def.name}: ${r}`; continue; }
    op = r; room = rm; out.door = d.def.name; out.why = null;
    if (YARDOUT) for (const h of R.hostiles) if (h.state !== 'dead' && g.fight.defs.find((x: any) => x.gd === h)?.room !== rm) killGuard(g, h, [0, 0, 1], true, 'struck');   // (in the frame the order is given: nobody has moved)
    break; }
  if (!op) { out.why ??= 'no held room with a door the order could be given on'; return out; }
  const d = op.door, side = op.side, W = d.def.width, nav = g.col.nav; out.W = W;
  const sent: any[] = [...op.men], ids = new Map<number, any>(sent.map((m: any) => [m.char.id, m])), seen = new Set<any>(g.events), was = new Map<any, string>(R.hostiles.map((h: any) => [h, h.state]));
  const over = (p: number[]) => (offOf(d, p, side) < -0.15 && alongOf(d, p) > -0.6 && alongOf(d, p) < W + 0.6) || room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell));
  let stepT = NaN, thrT = NaN, told2 = false; const podded = new Set<any>();
  // (`away`: a place for each man beyond a throw of the frame, on the squad's face, with a walk back to the lead's mark that is no tour of the floor)
  const godWas = new Map<any, boolean>(); let awayAt: number[][] | null | undefined; const awaySpots = (): number[][] | null => { const got: number[][] = [], fc = d.frameCentre, back = op.post.get(op.lead)?.pos ?? fc;
    for (let r = DOORTOOLS.throwReach + 1.5; r <= DOORTOOLS.throwReach + 5 && got.length < sent.length; r += 0.75) for (let a = 0; a < 24 && got.length < sent.length; a++) { const th = a / 24 * Math.PI * 2, p = [fc[0] + Math.sin(th) * r, 0, fc[2] + Math.cos(th) * r];
      if (offOf(d, p, side) < 0.8 || nav.isBlocked(p[0], p[2]) || got.some(o => flat(o, p) < 1) || flat(p, g.player.char.pos) < 1) continue;
      const path = nav.findPath(p, back); if (!path?.length || flat(path[path.length - 1], back) > 0.8) continue;
      let L = 0, q = p; for (const w of path) { L += flat(q, w); q = w; } if (L <= 2 * r + 2) got.push(p); }
    return got.length >= sent.length ? got : null; };
  R.post = () => { const t = g.time;
    if (hot && op.phase === 'stack') g.fight.hotT = t;   // (the floor has gone loud in the team's ears: the stager's own mark, kept fresh until the stack is made)
    if (word < 0 && op.thr?.first === 'can' && op.phase === 'fuse') { word = NaN; D.go('all'); }   // (word < 0: the commander's word while the can that went in first is still in the air)
    if (op.phase === 'thr') { if (isNaN(thrT)) thrT = t; if (t - thrT >= word) { word = NaN; D.go('all'); } }   // (the commander's word, that far into the hold)
    if (out.phases[out.phases.length - 1] !== op.phase && D.ops.includes(op)) { out.phases.push(op.phase);
      if (op.phase !== 'stack' && !out.atOpen.length) out.atOpen = sent.filter((m: any) => m.state !== 'dead').map((m: any) => ({ who: m.callsign, along: alongOf(d, m.char.pos), off: offOf(d, m.char.pos, side), lead: m === op.lead, spare: false, glass: g.orders.glassEyes(d, side, m.char.pos) }));
      if (op.phase !== 'stack' && out.glassJamb === undefined) { const L = out.atOpen.find(m => m.lead); out.glassJamb = L ? g.orders.glassEyes(d, side, doorPt(d, W - L.along, L.off, side)) : 0; }   // (the lead's own place, mirrored across the opening: the jamb a pair on one wall left bare)
 }
    if (op.thr && !stoodAt.size) for (const m of sent) if (m.state !== 'dead') stoodAt.set(m, [...m.char.pos]);   // (the frame the stage begins: the leaf moving — a booted door's lead is back on his jamb by his own order, he does not count as having shown)
    if (op.thr?.first === 'can' && !canFirst) out.firstHot = sent.some((m: any) => m.state !== 'dead' && g.fight.hotFor(m));
    if (op.thr?.first === 'can') canFirst = true;
    if (canFirst && stoodAt.size && isNaN(out.outBangs)) { if (op.beats.some((x: any) => /^(out onto the diagonals|no can first)/.test(x.what))) out.outBangs = D.bangs;
      else if (op.thr?.first === 'can' || op.thr?.first === 'burst') for (const [m, p] of stoodAt) { const mark = op.post.get(m)?.pos ?? p; if (m.state !== 'dead') out.heldBack = Math.max(isNaN(out.heldBack) ? 0 : out.heldBack, flat(m.char.pos, mark) - flat(p, mark)); } }   // (off his mark on the wall by more than he was as the leaf moved: the lead who booted it is walking BACK to his)
    if (isNaN(stepT)) { const b = op.beats.find((x: any) => /^step in/.test(x.what)); if (b) stepT = b.t; }
    if (hold && isNaN(out.toldT)) { const b = op.beats.find((x: any) => /^holding · on your word/.test(x.what)); if (b) out.toldT = b.t; }
    if (hold && isNaN(out.tellT) && t - out.toldT >= hold.after) { out.tellT = t; out.tellBangs = D.bangs; out.tellPhase = D.ops.includes(op) ? op.phase : '(over)';
      if (hold.tell === 'key') R.W.input.pressed.add(DOORTOOLS.blowKey); else out.tellR = hold.tell === 'word' ? D.go('all') : D.thresholdTell(hold.tell); }
    if (hold?.again !== undefined && !isNaN(out.tellT) && !told2 && t - out.tellT >= hold.again) { told2 = true; D.go('all'); }
    { const tosses = op.beats.filter((x: any) => /^toss:/.test(x.what)); for (let k = out.tossAt.length; k < tosses.length; k++) { const who = tosses[k].what.slice(5).split(' · ')[0], m = sent.find((x: any) => x.callsign === who); out.tossAt.push({ who, near: m ? flat(m.char.pos, d.frameCentre) : NaN, lead: op.lead.callsign }); } }   // (read BEFORE the men are put back off the door below: where the frame itself left the thrower)
    const back = (m: any) => { const p = m.char.pos, post = op.mine.get(m)?.post; return (flat(p, d.frameCentre) < DOORTOOLS.throwReach && offOf(d, p, side) > 0) || (!!post && flat(p, post) <= 0.6); };
    { if (isNaN(out.thrEndT) && !isNaN(thrT) && (isNaN(frag) || !isNaN(out.fragT)) && (op.phase !== 'thr' || !D.ops.includes(op))) { out.thrEndT = t - thrT; out.offAtEnd = sent.filter((m: any) => m.state !== 'dead' && !back(m)).map((m: any) => `${m.callsign} ${flat(m.char.pos, d.frameCentre).toFixed(1)} m`); }
      if (!isNaN(stepT) && !out.offAtStep) out.offAtStep = sent.filter((m: any) => m.state !== 'dead' && !back(m)).map((m: any) => `${m.callsign} ${flat(m.char.pos, d.frameCentre).toFixed(1)} m`); }
    if (FR) {
      if (isNaN(out.fragT) && op.phase === 'thr' && (hold ? t - out.toldT >= hold.after - frag : t - thrT >= Math.max(0, frag))) { const far = (m: any) => flat(m.char.pos, d.frameCentre), lp = (hold ? op.lead : sent.filter((m: any) => m.state !== 'dead').sort((a: any, b: any) => far(b) - far(a))[0] ?? op.lead).char.pos; out.fragT = t;   // (at the lead's feet before Sam speaks; at the rear-most man's in a hold that ends by itself — the lead's own slice already keeps that hold while HE is off it)
        for (const m of sent) if (m.state !== 'dead') { godWas.set(m, !!m.god); m.god = true; }
        g.items.spawn('frag', [lp[0], 0.6, lp[2]], [0, 0, 0], { fuse: FRAG_FUSE, who: R.hostiles[0].char.id }); }
      if (!isNaN(out.fragT)) { for (const m of sent) if (m.state !== 'dead' && FR.fragRunning(g, m) && !out.fragRan.includes(m.callsign)) out.fragRan.push(m.callsign);
        if (isNaN(out.backT) && out.fragRan.length && sent.every((m: any) => m.state === 'dead' || (!FR.fragRunning(g, m) && back(m)))) out.backT = t - thrT;
        if (godWas.size && t - out.fragT > FRAG_FUSE + 0.5) { for (const [m, was] of godWas) m.god = was; godWas.clear(); }
 } }
    if (away > 0 && hold && t - out.toldT >= hold.after - 1) {   // (run off a second BEFORE Sam speaks — the thrower is picked with nobody at the door, as under a grenade — and until `away` s after)
      const off = isNaN(out.tellT) || t - out.tellT < away;
      if (off) { if (awayAt === undefined) { awayAt = awaySpots(); if (!awayAt) out.why ??= 'no floor beyond a throw of the door to run the men off to'; }
        if (awayAt) sent.forEach((m: any, k: number) => { if (m.state === 'dead') return; if (!godWas.has(m)) godWas.set(m, !!m.god); m.god = true; const q = [awayAt![k][0], 0, awayAt![k][2]]; m.char.pos = q; m.char.vel = [0, 0, 0]; m.path = []; m.pathGoal = null; m.speed = 0; m.lastPos = [q[0], 0, q[2]]; }); }   // (put, as frag-probes.ts puts a man: no stale walk, speed or last place carried over the move)
      else if (godWas.size) { for (const [m, was] of godWas) m.god = was; godWas.clear(); } }   // (let go: each man as mortal as he was)
    for (const [m, p] of op.pod as Map<any, any>) if (!podded.has(m)) { podded.add(m); out.pods.push({ who: m.callsign, deep: -offOf(d, p.pos, side) }); }   // (the point he is FIRST sent to: the search may move him on to dead floor after)
    for (const m of sent) { if (m.state === 'dead') continue;
      if (over(m.char.pos)) { if (!out.firstIn.has(m.callsign)) out.firstIn.set(m.callsign, t); if (isNaN(stepT)) out.inBefore++; }
      if (op.thr && op.phase !== 'enter' && D.ops.includes(op) && op.rear.has(m)) { out.spareOf++; if (R.O.of(m)?.spare) out.spare++; } }
    for (const e of g.events) { if (seen.has(e)) continue; seen.add(e);
      if (e.kind === 'guardShot' && ids.has(e.who)) out.shots.push({ t: e.time, who: ids.get(e.who).callsign, outside: offOf(d, e.pos, side) > 0 });
      if (e.kind === 'bang' && !e.frag) out.bangs.push({ t: e.time, inside: -offOf(d, e.pos, side) }); }   // (the squad's own cans: a defender's grenade — frag.ts, the same event kind with `frag` on it — is no can of the kit's, wherever it bursts)
    for (const h of R.hostiles) { if (was.get(h) !== 'dead' && h.state === 'dead') { const k = ids.get(h.killerId); if (k) out.downs.push({ t, who: h.callsign ?? 'a man', by: k.callsign, byOutside: offOf(d, k.char.pos, side) > 0 }); } was.set(h, h.state); } };
  const t0 = g.time;
  await quiet(() => { for (let i = 0; i < cap * 60 && D.ops.includes(op); i++) R.step(); R.step(hold ? 240 : 30); });   // (told to leave the door: watched four seconds on — nobody drifts in after)
  R.post = null; for (const [m, was] of godWas) m.god = was; godWas.clear();   // (an order over before its men were let go: each as mortal as he was)
  out.endAt = sent.filter((m: any) => m.state !== 'dead').map((m: any) => ({ who: m.callsign, off: offOf(d, m.char.pos, side), doing: R.O.of(m)?.there ?? '(no order)' }));
  out.beats = op.beats.map((b: any) => ({ t: b.t, what: b.what })); out.ended = op.ended ?? '(still under way)'; out.secs = g.time - t0; out.bangs1 = D.bangs;
  out.alive = sent.filter((m: any) => m.state !== 'dead').length; out.holding = sent.filter((m: any) => m.state !== 'dead' && /^holding (the room$|· )/.test(R.O.of(m)?.there ?? '')).length;   // (a man the entry left on one of the room's OTHER doors — DOORTOOLS.thrDoors — holds the room from there: 'holding · <door>')
  if (op.search) { out.left = op.search.left; out.cells = op.search.pts.length; }
  for (const m of sent) { if (m.state !== 'dead') continue; const k = R.hostiles.find((h: any) => h.char.id === m.killerId); if (k && g.fight.defs.find((x: any) => x.gd === k)?.room !== room) out.yard.push({ who: m.callsign, by: k.callsign ?? 'a man' }); }
  // the room's OTHER doors (DOORTOOLS.thrDoors): the men the entry's last act put on them, watched until each is on his mark (a walker has a few metres to go)
  const onDoor = () => sent.filter((m: any) => m.state !== 'dead' && D.held.get(m)?.door && R.O.of(m) === D.held.get(m).A);
  if (onDoor().length) { await quiet(() => { for (let i = 0; i < 15 * 60 && onDoor().some((m: any) => !R.O.of(m).arrived); i++) R.step(); });
    out.doorMen = onDoor().map((m: any) => { const o = D.held.get(m).door, fc = o.frameCentre, p = m.char.pos, l = flat(p, fc) || 1, e = room.entries.find((x: any) => x.door === o);
      // (the line: to the floor a step inside the frame, on the room's face — a point 0.4 m from the frame's middle TOWARD him lies in the jamb for a man
      //  stood down the door's own wall, and read 'no line' of a man who has one. The leaf: the hinge, its tip, his line, with the leaf stood anywhere
      //  from where a leaf pushed open comes to rest (1.45 rad, doors.ts) to its stop — this file's own sum, on where he ended, not the rule's on
      //  where it sent him)
      const at = e ? [fc[0] - e.out[0] * 0.4, 1.2, fc[2] - e.out[1] * 0.4] : [fc[0] + (p[0] - fc[0]) / l * 0.4, 1.2, fc[2] + (p[2] - fc[2]) / l * 0.4];
      const stop = o.swing > 0 ? o.maxA : o.minA, h = o.def.hinge, side = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => Math.sign((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
      const across = (a: number) => { const th = o.def.closedDir + a, tip = [h[0] + Math.cos(th) * (o.def.width + 0.05), h[1] + Math.sin(th) * (o.def.width + 0.05)];
        return side(p[0], p[2], at[0], at[2], h[0], h[1]) !== side(p[0], p[2], at[0], at[2], tip[0], tip[1]) && side(h[0], h[1], tip[0], tip[1], p[0], p[2]) !== side(h[0], h[1], tip[0], tip[1], at[0], at[2]); };
      let leaf = !o.off && across(stop); for (let a = Math.min(1.45, Math.abs(stop)); !o.off && !leaf && a < Math.abs(stop); a += 0.1) leaf = across(Math.sign(stop) * a);
      return { who: m.callsign, door: o.def.name, arrived: !!R.O.of(m).arrived, dist: l, leaf, line: !g.col.segmentBlocked([p[0], 1.5, p[2]], at), inRoom: room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell)) }; }); }
  return out;
}
/** how many men the step in sent (a pair that has lost a man steps in with one: he threw, and he is first) */
/** threshold-grenade: the fuse of the grenade doorRun's `frag` puts down */
const FRAG_FUSE = 2.4;
const stepped = (r: Run) => (r.beats.find(b => /^step in · /.test(b.what))?.what.slice(10).split(', ').length ?? 0);
const line = (r: Run) => `${r.scn}:${r.seed} ${r.door} (${r.n} men)`;
const story = (r: Run) => r.beats.map(b => `${f1(b.t - r.beats[0].t)} ${b.what}`).join(' → ');

/** the checks every run must pass (structure), and what it showed of the two things a run can only show when the room gives it the chance (a defender in
 *  sight from outside; floor nobody could see from the jambs) */
function judge(verdict: Verdict, runs: Run[], four: boolean) {
  const ran = runs.filter(r => !r.why);
  verdict(ran.length === runs.length, 'the order is taken on a held room\'s door in every run (thresholdOn by the door\'s name: the order under way, not a refusal)', runs.map(r => r.why ? `${line(r)}: REFUSED — ${r.why}` : line(r)).join(' · '));
  // the far gun set before the door moves (DOORTOOLS.thrSet), the room's other doors held after (DOORTOOLS.thrDoors)
  if (DOORTOOLS.thrSet) { const set = ran.filter(r => idx(r, /^far gun /) >= 0);
    verdict(set.every(r => idx(r, /^far gun /) < idx(r, /^stacked$/) && (idx(r, /^shove$/) < 0 || idx(r, /^stacked$/) < idx(r, /^shove$/)) && tOf(r, /^stacked$/) - tOf(r, /^far gun /) <= DOORTOOLS.thrSetSecs + 0.1), 'THE FAR GUN IS SET FIRST: where the far jamb\'s man is sent onto his diagonal with the door shut, \'stacked\' is called — and the door shoved — only after, and never more than thrSetSecs after',
      set.length ? set.map(r => `${line(r)}: ${r.beats.find(b => /^far gun /.test(b.what))?.what} · stacked ${f1(tOf(r, /^stacked$/) - tOf(r, /^far gun /))} s later`).join('\n    ') : '(no run sent a far gun: every door stood open, wanted the boot, or had one jamb)'); }
  // (a lone survivor: the walk — thrDoorsStay — sends nobody, 'the last of three or more' is who keeps the way in; the stand-and-hold rule's own beat says his gun
  // went onto the door from where he stood. The rebuilt depot's a_s loses three of four on seed 3: the first floor these runs had such a man on)
  const lone = (r: Run) => r.alive === 1 && r.doorMen.every(m => r.beats.some(b => b.what === `other door · ${m.who} on ${m.door}`));
  if (DOORTOOLS.thrDoors) { const dm = ran.filter(r => r.doorMen.length), farM = Math.max(6.5, DOORTOOLS.otherDoorM ?? 0);   // (otherDoorM: a man with a line to a door from that far holds it where he stands, ahead of anybody being walked up to it)
    verdict(dm.every(r => r.doorMen.every(m => m.arrived && m.line && m.inRoom && m.dist <= farM) && new Set(r.doorMen.map(m => m.door)).size === r.doorMen.length && (DOORTOOLS.thrDoorsStay < 1 || r.doorMen.length < r.alive || lone(r))), 'THE OTHER DOORS ARE HELD: every man the entry left on another door of the room is on his mark inside the room, ' + farM + ' m or less from that door with a line to its frame (6.5 m, or otherDoorM where that is more) — one man a door, and never every man the entry has left (thrDoorsStay: one keeps the way they came in; a LONE survivor has nobody to keep it, and his gun goes onto the other door where he stands — otherDoorM, nobody walks)',
      dm.length ? dm.map(r => `${line(r)}: ${r.doorMen.map(m => `${m.who} on ${m.door} from ${f1(m.dist)} m${m.arrived ? '' : ' · NOT THERE'}${m.line ? '' : ' · NO LINE'}${m.inRoom ? '' : ' · OUTSIDE THE ROOM'}`).join(', ')} · ${r.doorMen.length} of ${r.alive} up sent`).join('\n    ') : '(no room in these runs had another door a man could be put on)'); }
  // a man on each jamb as the leaf moves, everybody outside
  const jambs = (r: Run) => { const hi = r.atOpen.filter(m => m.along > r.W && m.along < r.W + 1.6 && m.off > 0 && m.off < 1.3), lo = r.atOpen.filter(m => m.along < 0 && m.along > -1.6 && m.off > 0 && m.off < 1.3); return { hi, lo, out: r.atOpen.every(m => m.off > 0) }; };
  // GLASS IS NOT COVER (orders.ts stackPosts, GLASSPEN.stackEyes — live in the page, 0 lines while rounds stop in glass): a jamb the room's rifles reach through a
  // sidelight is nobody's place, so at such a door the stack is ONE wall's — the lead on his jamb, the rest filed behind him down it, the stage saying 'no floor at
  // the other jamb'. Where both jambs are in such lines (stackLeast) it is the hand FEWER of them reach. Asked there: the bare jamb is in those lines, every man's
  // own place is in fewer, the places dealt summed are stackLeastK or less of a man on each jamb, and the file is the lead's wall's (each within 1.6 m of the man ahead).
  const edge = (r: Run, m: Run['atOpen'][number]) => m.along > r.W / 2 ? m.along - r.W : -m.along, pane = (r: Run) => GLASSPEN.stackEyes > 0 && (r.glassJamb ?? 0) >= GLASSPEN.stackEyes;
  const oneWall = (r: Run) => { const L = r.atOpen.find(m => m.lead), file = [...r.atOpen].sort((a, b) => edge(r, a) - edge(r, b));
    return !!L && pane(r) && file[0] === L && r.beats.some(b => /^threshold ·/.test(b.what) && b.what.includes('no floor at the other jamb'))
      && file.every((m, k) => (m.along > r.W / 2) === (L.along > r.W / 2) && m.off > 0 && m.off < 1.3 && edge(r, m) - (k ? edge(r, file[k - 1]) : 0) > 0 && edge(r, m) - (k ? edge(r, file[k - 1]) : 0) < 1.6 && (m.glass ?? 0) < r.glassJamb!)
      && file.reduce((s, m) => s + (m.glass ?? 0), 0) <= GLASSPEN.stackLeastK * (r.glassJamb! + (L.glass ?? 0)); };
  verdict(ran.every(r => { const j = jambs(r); return (j.hi.length >= 1 && j.lo.length >= 1 && j.out && j.hi.some(m => m.lead) !== j.lo.some(m => m.lead)) || oneWall(r); }), 'as the leaf moves a man stands on EACH jamb — within 1.6 m of his edge of the opening, on the wall — the lead one of them, and every man of the order is outside the frame line' + (ran.some(pane) ? ' · a jamb the room reaches through glass is left bare (GLASSPEN.stackEyes): there the lead holds his own and the rest file behind him on that wall, every place in fewer such lines' : ''),
    ran.map(r => `${line(r)}: ${r.atOpen.map(m => `${m.who}${m.lead ? ' (lead)' : ''} ${m.along > r.W ? `latch +${f1(m.along - r.W)}` : m.along < 0 ? `hinge +${f1(-m.along)}` : `IN THE OPENING ${f1(m.along)}`} · ${f1(m.off)} off${pane(r) ? ` · ${m.glass ?? 0} through glass` : ''}`).join(', ')}${pane(r) ? ` · the other jamb: ${r.glassJamb} lines through glass` : ''}`).join('\n    '));
  // A RUN SHOT OFF THE DOOR FROM OUTSIDE THE ROOM: every man of the order lost before any step in, each to a defender who is not at home in the room behind the
  // door (the depot's a_s on the floodlit yard — heldEntries: 'who is left on the jambs is that fight's dice, on either stand'). The lines from the phases on
  // ask what the THRESHOLD did with the room; such a run never had a hold to ask of. Passed over there, said here — and never the many, nor a whole floor.
  const shotOff = (r: Run) => r.n > 0 && r.yard.length === r.n && idx(r, /^step in/) < 0 && r.ended === 'nobody left on it', kept = ran.filter(r => !shotOff(r)), off = ran.filter(shotOff);
  if (off.length) verdict(off.length * 3 <= ran.length && new Set(kept.map(r => r.scn)).size === new Set(ran.map(r => r.scn)).size, 'A RUN SHOT OFF THE DOOR FROM OUTSIDE THE ROOM is passed over by the lines below (the phases, the pockets, the step in, the hand-over): every man of the order lost before any step in, each to a defender who is not at home in the room behind the door — a door another room watches, where who is left on the jambs is that fight\'s dice. Never more than one run in three, and never every run of a floor',
    off.map(r => `${line(r)}: ${r.yard.map(y => `${y.who} by ${y.by}`).join(', ')} · ended '${r.ended}' after ${f1(r.secs)} s`).join('\n    '));
  // the phases, in order
  const firstCan = (r: Run) => DOORTOOLS.thrFirst > 0 && r.beats.some(b => /^threshold ·.* · a can first$/.test(b.what));
  const ordered = (r: Run) => { const seq = ['^stacked$', '^threshold ·', '^held ', '^step in', '^cross:', '^handover$', '^searched ·', '^in$'].map(s => idx(r, new RegExp(s))); const toss = idx(r, /^toss:/), bang = idx(r, /^bang ·/), none = idx(r, /^no bang ·/);
    const mono = seq.every((x, i) => x >= 0 && (i === 0 || x > seq[i - 1]));
    const can = toss >= 0 ? toss > seq[2] && bang > toss && bang < seq[3] : none > seq[2] && none < seq[3];
    if (firstCan(r)) {   // (DOORTOOLS.thrFirst, a floor already loud as the leaf moves: the can goes in AHEAD of the hold — its own order, and nothing else out of place)
      const out = idx(r, /^out onto the diagonals behind the can$/), later = r.beats.map((b, k) => /^toss:/.test(b.what) ? k : -1).filter(k => k > toss);
      return mono && (DOORTOOLS.thrFirst >= 2 || r.firstHot === true) && / · first · /.test(r.beats[toss]?.what ?? '') && toss > seq[1] && bang > toss && out > bang && out < seq[2]
        && later.every(k => k > seq[2] && k < seq[3] && r.beats.slice(k, seq[3]).some(b => /^bang ·/.test(b.what))) && (!DOORTOOLS.thrFirstOnly || !later.length)
        && /^stack,(kick,)?pocket,fuse,pocket,thr,pocket,(fuse,pocket,)*(wait,)?enter$/.test(r.phases.join(',')); }
    return mono && can && /^stack,(kick,)?thr,pocket,(fuse,pocket,)*(wait,)?enter$/.test(r.phases.join(',')); };
  verdict(kept.every(ordered), 'the phases come in order: stacked → threshold (the jambs held) → held → the pockets (toss → bang, or \'no bang\' said why) → step in → first man over the line → hand-over → searched → in' + (ran.some(firstCan) ? ' · on a floor already loud a can goes in first (thrFirst): threshold → toss → bang → out onto the diagonals → held, and on as written' : ''),
    kept.map(r => `${line(r)} [${r.phases.join(' ')}]: ${story(r)}`).join('\n    '));
  // nobody in before the step in — by the probe's own watch of every man's feet
  verdict(ran.every(r => r.inBefore === 0 && [...r.firstIn.values()].every(t => t >= tOf(r, /^step in/))), 'NOBODY is over the frame line, nor on the room\'s floor, on any frame before \'step in\' (every man of the order watched every frame — not the module\'s own beats)',
    ran.map(r => `${line(r)}: ${r.inBefore} man-frames inside before the step in at ${f1(tOf(r, /^step in/) - r.beats[0].t)} s · first feet inside ${[...r.firstIn].map(([w, t]) => `${w} ${f1(t - r.beats[0].t)} s`).join(', ') || 'nobody'} · worked from outside for ${f1(tOf(r, /^step in/) - tOf(r, /^threshold ·/))} s`).join('\n    '));
  // engaged from outside
  const outside = (r: Run) => { const ts = tOf(r, /^step in/); return { rounds: r.shots.filter(s => s.t < ts && s.outside).length, in: r.shots.filter(s => s.t < ts && !s.outside).length, down: r.downs.filter(x => x.t < ts && x.byOutside).length, contact: r.beats.filter(b => /^contact:/.test(b.what) && b.t < ts).length }; };
  verdict(ran.some(r => outside(r).rounds > 0 && outside(r).contact > 0) && ran.every(r => outside(r).in === 0), 'the room\'s men are ENGAGED FROM OUTSIDE: in at least one run a man at the door has one of theirs in his sight and rounds go in through the opening before anybody steps in — and no round before the step in is fired from inside, in any run',
    ran.map(r => { const o = outside(r); return `${line(r)}: ${o.contact} at the door with a man in sight · ${o.rounds} rounds from outside · ${o.down} of theirs down from out there`; }).join('\n    '));
  // the blind pockets
  const banged = kept.filter(r => idx(r, /^toss:/) >= 0);
  const pocket = (r: Run) => { const ts = tOf(r, /^step in/), first = r.beats.find(b => /^cross:/.test(b.what))?.what.slice(6), throwers = r.beats.filter(b => /^toss:/.test(b.what)).map(b => b.what.slice(5).split(' · ')[0]);
    return { throwers, first, ok: r.bangs.length === throwers.length && r.bangs.every(b => b.inside > 0.5 && b.t < ts) && r.bangs0 - r.bangs1 === throwers.length && (stepped(r) < 2 || throwers.every(w => w !== first)) && throwers.length <= DOORTOOLS.thrBangs }; };
  verdict(banged.length > 0 && banged.every(r => pocket(r).ok) && kept.every(r => idx(r, /^toss:/) >= 0 || idx(r, /^no bang ·/) >= 0), 'THE BLIND POCKETS ARE BANGED: a can from the kit\'s own count, thrown by a man who is not the first man in (two or more stepping in), bursts inside the room before anybody crosses — in at least one run; a run with no can says why',
    kept.map(r => { const p = pocket(r), lit = r.beats.filter(b => /^pocket banged/.test(b.what)).map(b => b.what.replace('pocket banged · ', '')).join('; '); return `${line(r)}: ${p.throwers.length ? `${p.throwers.join(', ')} threw · ${r.bangs.map(b => `burst ${f1(b.inside)} m inside`).join(', ')} · ${lit || 'no floor model'} · bangs ${r.bangs0} → ${r.bangs1} · first man in ${p.first}` : r.beats.find(b => /^no bang/.test(b.what))?.what}`; }).join('\n    '));
  // the shallow step
  verdict(kept.every(r => r.pods.length > 0 && r.pods.every(p => p.deep > 0.2 && p.deep <= 2.5 + 1e-6) && (idx(r, /^toss:/) < 0 || tOf(r, /^cross:/) >= Math.max(...r.bangs.map(b => b.t)) + DOORTOOLS.afterBang - 0.05)), 'THE STEP IN IS SHALLOW: every point a man is sent to is inside the room and 2.5 m or less from the frame line (the search may send a man on to dead floor after) — and behind a can nobody crosses before the bang\'s own count',
    kept.map(r => `${line(r)}: ${r.pods.map(p => `${p.who} ${f1(p.deep)} m in`).join(', ')}${r.bangs.length ? ` · first over the line ${f1(tOf(r, /^cross:/) - Math.max(...r.bangs.map(b => b.t)))} s after the last burst` : ''}`).join('\n    '));
  // the hand-over
  verdict(kept.every(r => r.ended === 'in' && r.holding === r.alive && (isNaN(r.cells) || idx(r, /^searched ·/) > idx(r, /^handover$/))), 'THE HAND-OVER: from the step in it is the entry\'s own room clear — the floor looked over by its search, the order ended \'in\', every man of it still up left holding the room',
    kept.map(r => `${line(r)}: ended '${r.ended}' after ${f1(r.secs)} s · ${r.holding} of ${r.alive} up holding the room (${r.n - r.alive} lost) · ${isNaN(r.cells) ? 'no floor model' : `${r.left} of ${r.cells} cells left unseen`} · ${r.beats.find(b => /^held /.test(b.what))?.what}`).join('\n    '));
  if (four) verdict(ran.every(r => r.atOpen.length - 2 >= 1 && r.spareOf > 0 && r.spare >= 0.8 * r.spareOf), 'the squad of four: the men on neither jamb keep the squad\'s back — their eyes spare for the way a man could come at it — while the room is worked (until one turns in to throw, and the step in)',
    ran.map(r => `${line(r)}: ${r.atOpen.length - 2} behind the jamb men · eyes spare ${r.spare} of ${r.spareOf} man-frames`).join('\n    '));
}

export const thresholdPair = guarded(async () => {
  const { verdict, done } = family('threshold-pair: the pair works a held room from the threshold — the records office and the office');
  const runs: Run[] = []; for (const scn of ['records-pair', 'room-clear-pair']) for (const seed of [1, 2, 3]) runs.push(await doorRun(scn, seed));
  judge(verdict, runs, false);
  await worded(verdict, 'records-pair');
  return done();
});
/** the word (doorTools.go — F) a second into the hold: the hold is cut short there, and the rest follows as ever */
async function worded(verdict: Verdict, scn: string) {
  const r = await doorRun(scn, 1, null, 90, 1), i = (re: RegExp) => idx(r, re), held = r.beats.find(b => /^held /.test(b.what)), secs = held ? parseFloat(held.what.slice(5)) : NaN;
  verdict(!r.why && i(/^the word$/) > i(/^threshold ·/) && i(/^held /) > i(/^the word$/) && secs < 2 && i(/^step in/) > i(/^held /) && r.inBefore === 0 && r.ended === 'in',
    'THE WORD cuts the hold short: given a second in, the jambs are let go there and then (well under the shortest hold), the pockets and the step in follow, nobody in before it', `${line(r)}: ${story(r)} · ended ${r.ended}`);
}
export const thresholdFour = guarded(async () => {
  const { verdict, done } = family('threshold-four: the squad of four works a held room from the threshold — the depot and the office');
  YARDOUT = true;
  const runs: Run[] = []; for (const scn of ['depot-four', 'room-clear-four']) for (const seed of [1, 2, 3]) runs.push(await doorRun(scn, seed));
  judge(verdict, runs, true);
  await worded(verdict, 'depot-four');
  return done();
});

/** A CAN FIRST ON A HOT DOOR (DOORTOOLS.thrFirst): the same doors with the floor gone loud in the team's ears, and the switch's three positions */
export const thresholdFirst = guarded(async () => {
  const { verdict, done } = family('threshold-first: on a floor that has gone loud a can goes in before anybody shows in the opening (DOORTOOLS.thrFirst)');
  const scns = ['records-pair', 'room-clear-four', 'depot-four'], i = (r: Run, re: RegExp) => idx(r, re), cans = (r: Run) => r.beats.filter(b => /^toss:/.test(b.what)).length;
  const POCKET = ['hall-four', 'block-four'];
  const only0 = DOORTOOLS.thrFirstOnly; DOORTOOLS.thrFirstOnly = true;
  YARDOUT = true;
  const hot: Run[] = []; for (const scn of scns) hot.push(await doorRun(scn, 1, null, 90, NaN, null, true));
  const first = (r: Run) => !r.why && / · a can first$/.test(r.beats.find(b => /^threshold ·/.test(b.what))?.what ?? '');
  verdict(hot.every(first), 'the floor hot, the stage says so as the leaf moves: \'threshold · … · a can first\'', hot.map(r => `${line(r)}: ${r.why ?? r.beats.find(b => /^threshold ·/.test(b.what))?.what}`).join('\n    '));
  const seq = (r: Run) => { const thr = i(r, /^threshold ·/), toss = i(r, /^toss:[^·]+ · first · /), bang = i(r, /^bang ·/), out = i(r, /^out onto the diagonals behind the can$/), held = i(r, /^held /), step = i(r, /^step in/);
    return thr >= 0 && toss > thr && bang > toss && out > bang && held > out && step > held && tOf(r, /^out onto/) - r.bangs[0]?.t >= DOORTOOLS.afterBang - 0.05; };
  verdict(hot.every(seq), 'THE ORDER OF IT: the leaf moves → the first can (toss · first) → its bang → \'out onto the diagonals behind the can\', no sooner than a bang\'s own count after the burst → the hold → step in',
    hot.map(r => `${line(r)} [${r.phases.join(' ')}]: ${story(r)}`).join('\n    '));
  verdict(hot.every(r => r.heldBack <= 0.5 && r.inBefore === 0), 'NOBODY SHOWS IN THE OPENING BEFORE IT: from the leaf moving until they are sent out, no man of the order gets half a metre further off his mark on the wall than he stood as it moved — and nobody is over the frame line before the step in',
    hot.map(r => `${line(r)}: furthest any man got off his mark before 'out' ${f1(r.heldBack)} m · ${r.inBefore} man-frames inside before the step in`).join('\n    '));
  verdict(hot.every(r => r.bangs0 - r.outBangs === 1 && cans(r) <= DOORTOOLS.thrBangs && r.bangs0 - r.bangs1 === cans(r) && r.bangs.length === cans(r) && r.bangs.every(b => b.inside > 0.5)), 'THE CAN IS ONE OF THE STAGE\'S, FROM THE KIT: one spent by the time they step out, never more than thrBangs for the door, every one burst inside the room, the kit down by what was thrown',
    hot.map(r => `${line(r)}: kit ${r.bangs0} → ${r.outBangs} at 'out' → ${r.bangs1} · ${cans(r)} thrown · ${r.bangs.map(b => `burst ${f1(b.inside)} m inside`).join(', ')}`).join('\n    '));
  // thrFirstOnly: a can that went in first is the door's only can · off = the stage's own count
  // (THE STAGE'S OWN COUNT is asked with DOORTOOLS.outsidePlain out of the way: that rule — on as the page ships — is one can a door whatever this switch says
  // and on the word too (thrCans), so under it no pocket ever gets a second and these two lines would be asking for what it forbids. The door with the dark
  // pocket is found without it; what the rule then does AT THAT DOOR is the line after them, asked on a stand that has it)
  const plain0 = DOORTOOLS.outsidePlain; NO_PLAIN = true;
  DOORTOOLS.thrFirstOnly = false; const more: Run[] = []; for (const scn of scns) more.push(await doorRun(scn, 1, null, 90, NaN, null, true));
  // (THE DOOR WITH A DARK POCKET: one of these three had it — the depot's a_s — until the depot was rebuilt; where none of them has, the first of POCKET that
  // does stands in for it, played both ways. A level rebuilt changes which door that is, not what is asked of it)
  let darkScn = scns.find((_, k) => cans(more[k]) > 1) ?? null, dark: Run | null = darkScn ? more[scns.indexOf(darkScn)] : null, darkOn: Run | null = darkScn ? hot[scns.indexOf(darkScn)] : null;
  if (!dark) for (const scn of POCKET) { const r = await doorRun(scn, 1, null, 90, NaN, null, true); if (first(r) && cans(r) > 1) { darkScn = scn; dark = r; break; } }
  DOORTOOLS.thrFirstOnly = true; if (dark && !darkOn) darkOn = await doorRun(darkScn!, 1, null, 90, NaN, null, true);
  verdict(hot.every(r => cans(r) === 1) && more.every(r => first(r) && cans(r) >= 1 && cans(r) <= DOORTOOLS.thrBangs) && !!dark && !!darkOn && cans(dark) <= DOORTOOLS.thrBangs && first(darkOn) && cans(darkOn) === 1,
    'THAT CAN IS THE DOOR\'S CAN (thrFirstOnly): one thrown and no more, pockets or not · off, the stage\'s own count stands, and a pocket the first can left dark gets the second',
    hot.map((r, k) => `${line(r)}: ${cans(r)} thrown as shipped · ${cans(more[k])} with the switch off (${story(more[k])})`).join('\n    ') + `\n    the dark pocket: ${dark && darkOn ? `${line(dark)}: ${cans(darkOn)} thrown as shipped · ${cans(dark)} with the switch off (${story(dark)})` : `NONE of ${[...scns, ...POCKET].join(', ')} leaves a pocket dark on seed 1`}`);
  // … but a can Sam ASKS for is his: the word on that door bangs the pocket the first can left dark, whatever the switch says
  const asked = await doorRun(darkScn ?? 'depot-four', 1, null, 90, -1, null, true);
  verdict(!!dark && first(asked) && i(asked, /^the word$/) >= 0 && cans(asked) === cans(dark) && cans(dark) > 1, 'THE WORD STILL GETS ITS CAN: on a door whose first can left a pocket dark, the word bangs it as it did with the switch off',
    `${line(asked)}: ${cans(asked)} thrown on the word · ${dark ? cans(dark) : '—'} with the switch off: ${story(asked)}`);
  NO_PLAIN = false; DOORTOOLS.outsidePlain = plain0;
  if (plain0) {   // ONE CAN A DOOR (outsidePlain, this stand's own): the same door, the same dark pocket behind the first can — and no second, with thrFirstOnly off and on the word alike
    DOORTOOLS.thrFirstOnly = false; const one = darkScn ? await doorRun(darkScn, 1, null, 90, NaN, null, true) : null, oneWord = darkScn ? await doorRun(darkScn, 1, null, 90, -1, null, true) : null; DOORTOOLS.thrFirstOnly = true;
    verdict(!!dark && !!one && !!oneWord && first(one) && cans(one) === 1 && one.ended === 'in' && first(oneWord) && i(oneWord, /^the word$/) >= 0 && cans(oneWord) === 1 && oneWord.ended === 'in',
      'ONE CAN A DOOR ON THIS STAND (outsidePlain): at the door whose first can leaves a pocket dark, no second is thrown — with thrFirstOnly off, and on the word, which is still taken',
      one && oneWord && dark ? `${line(one)}: ${cans(one)} thrown with thrFirstOnly off (${cans(dark)} without the rule) · ${cans(oneWord)} thrown on the word: ${story(oneWord)}` : 'no door with a dark pocket to ask it at');
  }
  verdict(hot.every(r => r.ended === 'in' && r.holding === r.alive), 'the rest is the stage\'s own: ended \'in\', every man of it still up left holding the room', hot.map(r => `${line(r)}: ended '${r.ended}' after ${f1(r.secs)} s · ${r.holding} of ${r.alive} up holding (${r.n - r.alive} lost)`).join('\n    '));
  // the switch: quiet floor at 1 = the stage as it was · 2 = every door · 0 = never, hot or not · held until told / on a word: the cans are Sam's to call
  const plain = (r: Run) => !r.why && !first(r) && i(r, /^(out onto the diagonals|no can first)/) < 0 && isNaN(r.heldBack);
  const quiet1 = await doorRun('records-pair', 1);
  DOORTOOLS.thrFirst = 2; const quiet2 = await doorRun('records-pair', 1);
  DOORTOOLS.thrFirst = 0; const hot0 = await doorRun('records-pair', 1, null, 90, NaN, null, true);
  DOORTOOLS.thrFirst = 1; const hold = await doorRun('records-pair', 1, null, 120, NaN, { tell: 'step', after: 3 }, true);
  // the word given while that can is in the air: kept, and taken the moment they step out — no hold is sat through first
  const early = await doorRun('records-pair', 1, null, 90, -1, null, true), eOut = tOf(early, /^out onto the diagonals behind the can$/), eWord = tOf(early, /^the word$/);
  verdict(first(early) && eWord >= eOut - 1e-6 && eWord - eOut < 0.05 && i(early, /^held /) > i(early, /^the word$/) && tOf(early, /^held /) - eOut < 0.05 && early.ended === 'in',
    'THE WORD WHILE THE CAN IS IN THE AIR is kept: nobody is on a diagonal yet — it is taken as they step out behind the burst, the hold cut short there and then',
    `hot floor, the word at the toss: ${story(early)}`);
  verdict(plain(quiet1) && first(quiet2) && seq(quiet2) && plain(hot0) && plain(hold), 'THE SWITCH: at 1 a quiet floor gets the stage as it was · at 2 every door gets the can first · at 0 a hot floor gets the stage as it was · an order held until told never spends one unasked',
    [['quiet floor, thrFirst 1', quiet1], ['quiet floor, thrFirst 2', quiet2], ['hot floor, thrFirst 0', hot0], ['hot floor, held until told', hold]].map(([w, r]: any) => `${w}: ${story(r)}`).join('\n    '));
  DOORTOOLS.thrFirstOnly = only0;
  return done();
});

/** THE OTHER ORDER: work it from the threshold and hold until told — and everything Sam can then say */
export const thresholdHold = guarded(async () => {
  const { verdict, done } = family('threshold-hold: worked from the threshold and HELD until told — the pair (the records office) and the four (the depot) — then step in / bang and step in / leave it / the word · room-fight floors (squads from the rooms held off inside these runs: a dealt floor has dug in by the time a hold is told)');
  NODEAL = true;
  const AFTER = 10, scns = ['records-pair', 'depot-four'], tells: Hold['tell'][] = ['step', 'bang', 'leave', 'word', 'key'];
  // (THE WORD as it was — a can for the blind pockets — is asked with DOORTOOLS.wordNoCan out of the way; the rule has its own two runs and its own line below.
  //  WORDNOCAN_BREAK=1: those two are staged with the rule off too, and the line must fail on what it finds)
  const RULE = process.env.WORDNOCAN_BREAK !== '1';
  WORDNOCAN = false;
  const runs = new Map<string, Run>(), quietWord = new Map<string, Run>();
  try { for (const scn of scns) for (const tell of tells) runs.set(`${scn}/${tell}`, await doorRun(scn, 1, null, 120, NaN, { tell, after: AFTER }, false, true));   // (the nearest held door a hold can be asked of: heldEntries' `unwatched`)
    WORDNOCAN = RULE; for (const scn of scns) for (const tell of ['word', 'key'] as const) quietWord.set(`${scn}/${tell}`, await doorRun(scn, 1, null, 120, NaN, { tell, after: AFTER }, false, true));
  } finally { WORDNOCAN = false; }
  const all = [...runs.values()], of = (tell: string) => scns.map(scn => runs.get(`${scn}/${tell}`)!), i = (r: Run, re: RegExp) => idx(r, re), rel = (r: Run, t: number) => f1(t - r.beats[0].t);
  const tossed = (r: Run) => r.beats.filter(b => /^toss:/.test(b.what)).length, feet = (r: Run) => [...r.firstIn].map(([w, t]) => `${w} ${rel(r, t)} s`).join(', ') || 'nobody';
  verdict(all.every(r => !r.why && /· to hold$/.test(r.beats.find(b => /^threshold ·/.test(b.what))?.what ?? '')), 'the order is taken, to hold, in every run (thresholdOn(door, who, side, true))', all.map(r => r.why ? `${line(r)}: REFUSED — ${r.why}` : line(r)).join(' · '));
  // the hold itself: quiet said once, then nothing until told
  verdict(all.every(r => r.toldT > 0 && r.tellT - r.toldT >= AFTER - 0.05 && r.tellPhase === 'thr' && r.tellBangs === r.bangs0 && [...r.firstIn.values()].every(t => t > r.tellT) && r.beats.filter(b => /^holding · on your word/.test(b.what)).length === 1 && !r.beats.some(b => b.t < r.tellT && /^(held |toss:|step in|no bang)/.test(b.what))),
    `THE HOLD: the door gone quiet, the lead says so once ('holding · on your word' — the moment the plain order goes on by itself) and for ${AFTER} s more the order is still on the jambs: nobody over the frame line or on the room's floor, no can spent, no pockets, no step in`,
    all.map(r => `${line(r)}: threshold at ${rel(r, tOf(r, /^threshold ·/))} s · 'holding' at ${rel(r, r.toldT)} s · told at ${rel(r, r.tellT)} s with the order in '${r.tellPhase}', bangs ${r.bangs0} → ${r.tellBangs} · first feet inside: ${feet(r)} · ${r.shots.filter(s => s.t < r.tellT && s.outside).length} rounds from outside while holding`).join('\n    '));
  // step in
  verdict(of('step').every(r => r.tellR === null && i(r, /^told · step in$/) >= 0 && i(r, /^held /) > i(r, /^told ·/) && i(r, /^step in/) > i(r, /^held /) && i(r, /^cross:/) > i(r, /^step in/) && tossed(r) === 0 && r.bangs.length === 0 && r.bangs1 === r.bangs0 && r.inBefore === 0 && r.ended === 'in' && r.pods.every(p => p.deep > 0.2 && p.deep <= 2.5 + 1e-6)),
    'TOLD TO STEP IN (thresholdTell(\'step\')): they step in shallow there and then with no can thrown — the kit as it was — and it ends as any entry does', of('step').map(r => `${line(r)}: ${story(r)} · bangs ${r.bangs0} → ${r.bangs1} · ended '${r.ended}'`).join('\n    '));
  // bang, then step in
  verdict(of('bang').every(r => r.tellR === null && i(r, /^told · bang and step in$/) >= 0 && tossed(r) >= 1 && r.bangs.length === tossed(r) && r.bangs0 - r.bangs1 === tossed(r) && r.bangs.every(b => b.inside > 0.5 && b.t > r.tellT && b.t < tOf(r, /^step in/)) && tOf(r, /^cross:/) >= Math.max(...r.bangs.map(b => b.t)) + DOORTOOLS.afterBang - 0.05 && r.inBefore === 0 && r.ended === 'in'),
    'TOLD TO BANG AND STEP IN (thresholdTell(\'bang\')): a can from the kit goes in and bursts inside the room before anybody crosses — one at the least, blind pocket or not — then the step in behind the bang\'s own count',
    of('bang').map(r => `${line(r)}: ${story(r)} · ${r.bangs.map(b => `burst ${f1(b.inside)} m inside`).join(', ')} · bangs ${r.bangs0} → ${r.bangs1} · ended '${r.ended}'`).join('\n    '));
  // leave it
  verdict(of('leave').every(r => r.tellR === null && i(r, /^told · leave it$/) >= 0 && r.ended === 'stood down' && r.firstIn.size === 0 && r.inBefore === 0 && r.bangs1 === r.bangs0 && r.bangs.length === 0 && i(r, /^step in/) < 0 && r.endAt.length > 0 && r.endAt.every(m => m.off > 0)),
    'TOLD TO LEAVE IT (thresholdTell(\'leave\')): the order is over (\'stood down\'), no man of it was ever over the frame line or on the room\'s floor — watched four seconds on —, no can was spent, every man still up is on the squad\'s side of the door',
    of('leave').map(r => `${line(r)}: ended '${r.ended}' · first feet inside: ${feet(r)} · bangs ${r.bangs0} → ${r.bangs1} · ${r.endAt.map(m => `${m.who} ${f1(m.off)} m off the line (${m.doing})`).join(', ')}`).join('\n    '));
  // the word, both ways of giving it
  for (const [tell, how] of [['word', 'doorTools.go(\'all\')'], ['key', `the ${DOORTOOLS.blowKey.replace('Key', '')} key, one frame, no menu up`]] as const)
    verdict(of(tell).every(r => (tell === 'key' || r.tellR === null) && i(r, /^the word$/) >= 0 && r.beats.find(b => /^the word$/.test(b.what))!.t - r.tellT < 0.1 && i(r, /^held /) > i(r, /^the word$/) && i(r, /^step in/) > i(r, /^held /) && (tossed(r) > 0 || i(r, /^no bang ·/) > 0) && r.inBefore === 0 && r.ended === 'in'),
      `THE WORD while holding (${how}): the blind pockets (a can, or 'no bang' said why), then the step in — nobody in before it`, of(tell).map(r => `${line(r)}: ${story(r)} · ended '${r.ended}'`).join('\n    '));
  // the word under DOORTOOLS.wordNoCan: in with no can — and the same doors, the rule off, spent one or said why not (the lines above), so the line is not empty
  { const qs = [...quietWord.values()], was = [...of('word'), ...of('key')];
    verdict(qs.every(r => !r.why && i(r, /^the word$/) >= 0 && i(r, /^held /) > i(r, /^the word$/) && i(r, /^step in/) > i(r, /^held /) && tossed(r) === 0 && i(r, /^no bang ·/) < 0 && r.bangs.length === 0 && r.bangs1 === r.bangs0 && r.inBefore === 0 && r.ended === 'in') && was.some(r => tossed(r) > 0),
      `THE WORD SPENDS NO CAN (DOORTOOLS.wordNoCan, with the one-order outside clear${RULE ? '' : ' — WORDNOCAN_BREAK: the rule off'}): the word to men holding a door from outside, from code and on its key — the jambs let go, the step in, nobody in before it, and no can thrown, none asked about, the kit as it was`,
      qs.map(r => `${line(r)}: ${story(r)} · bangs ${r.bangs0} → ${r.bangs1} · ended '${r.ended}'`).join('\n    ') + `\n    the rule off, the same doors: ${was.map(r => `${tossed(r)} thrown`).join(', ')}`); }
  // nothing to tell: refused in words
  { const R = await stage('records-pair', 1), D = R.D, a = D.thresholdTell('step'), b = D.canThresholdThen('bang', null, R.team);
    const ent = heldEntries(R)[0].ent; g0: { const lx = -ent.out[1], lz = ent.out[0]; R.g.teleportPlayer([ent.at[0] + ent.out[0] * 3.4 + lx * 1.6, 0, ent.at[2] + ent.out[1] * 3.4 + lz * 1.6]); break g0; }
    const op: any = D.thresholdOn(ent.door.def.name, 'all', undefined, true); await quiet(() => { for (let k = 0; k < 20 * 60 && typeof op !== 'string' && op.phase !== 'thr'; k++) R.step(); });
    const kit = D.bangs; D.bangs = 0; const c = D.canThresholdThen('bang', null, R.team), e = D.thresholdTell('bang'), ph = typeof op === 'string' ? op : op.phase, ok2 = D.canThresholdThen('step', null, R.team); D.bangs = kit;
    verdict(typeof a === 'string' && typeof b === 'string' && c === 'no bangs left.' && e === c && ph === 'thr' && ok2 === true, 'a follow-up that cannot be done is refused in words — what a menu row greys with: nothing being worked from the threshold (thresholdTell → a reason; canThresholdThen → the same); and, holding with an empty kit, \'bang\' is refused, the order left on its jambs, while \'step\' is still offered',
      `nothing held: thresholdTell('step') → '${a}' · canThresholdThen('bang') → '${b}' · holding with no cans: canThresholdThen('bang') → '${c}' · thresholdTell('bang') → '${e}' · the order still in '${ph}' · canThresholdThen('step') → ${ok2}`); }
  // the four, two doors of one room on ONE word: blue holding the threshold of one, red on a plain stack on another
  { const R = await stage('depot-four', 1), g = R.g, D = R.D, O = R.O, room = heldEntries(R).map(x => x.room).find((rm: any) => rm.entries.length >= 2);
    // (which two doors: any two of one held room. Blue's is the crew room's `a_s` where the floor has it — both depots do — and red's is that room's `a_w` on the
    //  corridor depot, else the room's first OTHER door (the motor-pool depot: `a_e`) — never a place in the entries' order, which could be blue's own door)
    const eB = room ? room.entries.find((x: any) => x.door.def.name === 'a_s') ?? room.entries[0] : null;
    const eR = room ? room.entries.find((x: any) => x.door.def.name === 'a_w') ?? room.entries.find((x: any) => x !== eB) ?? null : null;
    let detail = 'no held room with two doors', ok = false;
    if (eB && eR && eB !== eR) { const dB = eB.door, dR = eR.door, lx = -eB.out[1], lz = eB.out[0]; g.teleportPlayer([eB.at[0] + eB.out[0] * 3.4 + lx * 1.6, 0, eB.at[2] + eB.out[1] * 3.4 + lz * 1.6]);
      const red = O.men('red'), blue = O.men('blue'), sam = g.player.char.pos, sideR = O.sideFor(dR, red, offOf(dR, sam, 1) > 0 ? 1 : -1), opB: any = D.thresholdOn(dB.def.name, 'blue', undefined, true);
      const gave = O.give('stack', { kind: 'door', at: [dR.frameCentre[0], 0, dR.frameCentre[2]], door: dR, side: sideR }, 'red');
      const stacked = () => red.every((m: any) => { const A = O.of(m); return A?.order === 'stack' && A.arrived; }), told = () => typeof opB !== 'string' && opB.thr?.told;
      await quiet(() => { for (let k = 0; k < 60 * 60 && !(stacked() && told()); k++) R.step(); });
      const ready = stacked() && told(), sideB = typeof opB === 'string' ? 1 : opB.side, seen = new Set<any>(g.events), bangs: number[] = []; let crossR = NaN, crossB = NaN, inEarly = 0;
      const wide = (d: any, p: number[], side: number) => offOf(d, p, side) < -0.15 && alongOf(d, p) > -0.6 && alongOf(d, p) < d.def.width + 0.6;
      for (const m of [...red, ...blue]) if (wide(dR, m.char.pos, sideR) || wide(dB, m.char.pos, sideB)) inEarly++;
      const word = ready ? D.go('all') : 'not ready', t0 = g.time;
      R.post = () => { const t = g.time; for (const e of g.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'bang') bangs.push(e.time); }
        if (isNaN(crossR) && red.some((m: any) => m.state !== 'dead' && wide(dR, m.char.pos, sideR))) crossR = t; if (isNaN(crossB) && blue.some((m: any) => m.state !== 'dead' && wide(dB, m.char.pos, sideB))) crossB = t; };
      await quiet(() => { for (let k = 0; k < 30 * 60 && (isNaN(crossR) || isNaN(crossB)); k++) R.step(); }); R.post = null;
      const last = bangs.length ? Math.max(...bangs) : NaN, beatsB: string[] = typeof opB === 'string' ? [] : opB.beats.map((b: any) => b.what);
      ok = gave === null && ready && inEarly === 0 && word === null && beatsB.includes('the word') && crossR > 0 && crossB > 0 && Math.abs(crossR - crossB) < 1.5 && (isNaN(last) || (crossR >= last + DOORTOOLS.afterBang - 0.05 && crossB >= last + DOORTOOLS.afterBang - 0.05));
      detail = `depot-four:1 blue holding ${dB.def.name} (${typeof opB === 'string' ? opB : 'held'}), red stacked on ${dR.def.name} (${gave ?? 'stacked'}) · ${ready ? 'both set, nobody inside' : 'NOT SET'} · go('all') → ${word === null ? 'taken' : word} · ${bangs.length} can${bangs.length === 1 ? '' : 's'} burst${bangs.length ? `, the last ${f1(last - t0)} s after the word` : ''} · red's first man over its line ${f1(crossR - t0)} s after the word, blue's ${f1(crossB - t0)} s`; }
    verdict(ok, 'THE FOUR, TWO DOORS, ONE WORD: blue holding the threshold of one door and red on a plain stack on another door of the same room — the word takes both, the pockets are banged first, and NEITHER pair crosses before the last burst\'s own count: they cross together', detail); }
  // DOORTOOLS.behindSam — off a play tape (the floodlit yard, 10-13, 6:47.9): the door held from outside, Sam walked into the room beyond it, the word given.
  // BEHINDSAM_BREAK=1 = the switch left off and the same lines asked: they must fail (the can goes in on him, as on the tape).
  { const BREAK = process.env.BEHINDSAM_BREAK === '1', keep = { b: DOORTOOLS.behindSam, s: SAMSTUN.on };
    interface SamRun { scn: string; why: string | null; at: number[] | null; bangRow: true | string; stepRow: true | string; word: string | null; beats: string[]; tossed: number; bursts: number; kit0: number; kit1: number; crossed: boolean; dazzled: number; /** frames before the can's decision on which the door's own leaf stood across the line from the opening to Sam */ cut?: number; ajar?: number }
    const play = async (scn: string, inside: boolean): Promise<SamRun> => {
      const R = await stage(scn, 1), g = R.g, D = R.D, nav = g.col.nav; DOORTOOLS.behindSam = !BREAK; SAMSTUN.on = true;   // (after the stand-up: the frozen stand pins both off · SAMSTUN on, so a can that reaches him is counted on either stand)
      const out: SamRun = { scn, why: 'no held room with a door the order could be given on', at: null, bangRow: '', stepRow: '', word: '', beats: [], tossed: 0, bursts: 0, kit0: D.bangs, kit1: D.bangs, crossed: false, dazzled: 0 };
      let op: any = null, room: any = null, ent: any = null;
      for (const he of heldEntries(R, true)) { const e = he.ent, lx = -e.out[1], lz = e.out[0]; let sam: number[] | null = null;   // (the commander outside, as doorRun puts him — and the door thresholdHold's own runs hold: heldEntries' `unwatched`)
        for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [2.6, 0]]) { const p = [e.at[0] + e.out[0] * back + lx * lat, 0, e.at[2] + e.out[1] * back + lz * lat]; if (!nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.1, p[2]], [e.at[0] + e.out[0] * 0.7, 1.1, e.at[2] + e.out[1] * 0.7])) { sam = p; break; } }
        if (!sam) continue; g.teleportPlayer(sam);
        const r = D.thresholdOn(e.door.def.name, 'all', undefined, true); if (typeof r === 'string') { out.why = `${e.door.def.name}: ${r}`; continue; }
        op = r; room = he.room; ent = e; out.why = null; break; }
      if (!op) return out;
      await quiet(() => { for (let k = 0; k < 60 * 60 && D.ops.includes(op) && !op.thr?.told; k++) R.step(); });
      if (!op.thr?.told) { out.why = `never held (the order in '${D.ops.includes(op) ? op.phase : 'over'}')`; return out; }
      const d = op.door, side = op.side, inn = doorPt(d, d.def.width / 2, 0.45, -side, 1.1), lx = -ent.out[1], lz = ent.out[0];
      if (inside) {   // … and he walks into the room beyond it: on its floor, a line from the opening, well inside a can's reach
        for (const [deep, lat] of [[2.0, 0], [2.6, 0], [1.6, 0], [2.0, 0.8], [2.0, -0.8], [3.2, 0], [2.6, 1.2], [2.6, -1.2]]) { const p = [ent.at[0] - ent.out[0] * deep + lx * lat, 0, ent.at[2] - ent.out[1] * deep + lz * lat];
          if (!nav.isBlocked(p[0], p[2]) && room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell)) && offOf(d, p, side) < -0.5 && !g.col.solidBlocked(inn, [p[0], 1.1, p[2]])) { out.at = p; break; } }
        if (!out.at) { out.why = 'no floor for Sam inside the room'; return out; }
        g.teleportPlayer(out.at); await quiet(() => R.step(2)); }
      out.bangRow = D.canThresholdThen('bang', null, R.team); out.stepRow = D.canThresholdThen('step', null, R.team);
      const seen = new Set<any>(g.events), men: any[] = [...op.men], n0 = op.beats.length; out.kit0 = D.bangs; SAMSTUN_STATS.dazzled = 0; let crossT = NaN;
      out.word = D.go('all');
      R.post = () => { for (const e of g.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'bang') out.bursts++; }
        if (isNaN(crossT) && men.some((m: any) => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.15)) crossT = g.time; };
      await quiet(() => { for (let k = 0; k < 30 * 60 && !(g.time - crossT >= 3); k++) R.step(); }); R.post = null;   // (three seconds past the first man over the line: a late can would show)
      out.beats = op.beats.slice(n0).map((b: any) => b.what); out.tossed = out.beats.filter(b => /^toss:/.test(b)).length; out.kit1 = D.bangs; out.crossed = crossT > 0; out.dazzled = SAMSTUN_STATS.dazzled;
      return out; };
    // … and A PLAIN BANG AND CLEAR, given with Sam outside (the row asks then, and offers it); he goes in by another way before the can leaves the hand —
    // 'on my word' for the four (the word given from inside), a walk to the stack for the pair. The can is asked about him again at the toss.
    const playPlain = async (scn: string, ajar = 0): Promise<SamRun> => {
      const R = await stage(scn, 1), g = R.g, D: any = R.D, nav = g.col.nav; DOORTOOLS.behindSam = !BREAK; SAMSTUN.on = true;
      const out: SamRun = { scn, why: 'no held room with a door the order could be given on', at: null, bangRow: '', stepRow: true, word: null, beats: [], tossed: 0, bursts: 0, kit0: D.bangs, kit1: D.bangs, crossed: false, dazzled: 0 };
      let op: any = null, room: any = null, ent: any = null;
      for (const he of heldEntries(R)) { const e = he.ent, lx = -e.out[1], lz = e.out[0], d = e.door; let sam: number[] | null = null;
        for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [2.6, 0]]) { const p = [e.at[0] + e.out[0] * back + lx * lat, 0, e.at[2] + e.out[1] * back + lz * lat]; if (!nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.1, p[2]], [e.at[0] + e.out[0] * 0.7, 1.1, e.at[2] + e.out[1] * 0.7])) { sam = p; break; } }
        if (!sam) continue; g.teleportPlayer(sam);
        const men = R.O.men('all'), samSide = offOf(d, sam, 1) >= 0 ? 1 : -1, side = R.O.big ? R.O.sideFor(d, men, samSide) : samSide, t = { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side };
        if (ajar) { if (d.off || d.def.steel) continue; const set = (a: number) => { d.locked = false; d.latched = false; d.angle = a; d.vel = 0; d.closing = false; d.place(); };   // (found standing ajar, swung into the room: the 'open already' path — the leaf is pushed the rest of the way through the line's first point)
          set(ajar); if (offOf(d, d.box.c, side) > 0) set(-ajar); if (offOf(d, d.box.c, side) > 0) continue; out.ajar = d.angle; }
        const can = D.stackable(t, men); if (can !== true) { out.why = `${d.def.name}: ${can || 'no door'}`; continue; }
        const who = D.canBehind(d, side, men); out.bangRow = who ? `${who} is behind that door.` : true;   // (what the row asks, when it is given)
        const r = D.start('bangClear', men, t, true); if (typeof r === 'string') { out.why = `${d.def.name}: ${r}`; continue; }
        op = r; room = he.room; ent = e; out.why = null; break; }
      if (!op) return out;
      const onWord = !!op.onWord;
      if (onWord) { await quiet(() => { for (let k = 0; k < 60 * 60 && D.ops.includes(op) && op.phase !== 'ready'; k++) R.step(); }); if (op.phase !== 'ready') { out.why = `never set (the order in '${D.ops.includes(op) ? op.phase : 'over'}')`; return out; } }
      const d = op.door, side = op.side, inn = doorPt(d, d.def.width / 2, 0.45, -side, 1.1), lx = -ent.out[1], lz = ent.out[0];
      for (const [deep, lat] of [[2.0, 0], [2.6, 0], [1.6, 0], [2.0, 0.8], [2.0, -0.8], [3.2, 0], [2.6, 1.2], [2.6, -1.2]]) { const p = [ent.at[0] - ent.out[0] * deep + lx * lat, 0, ent.at[2] - ent.out[1] * deep + lz * lat];
        if (!nav.isBlocked(p[0], p[2]) && room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell)) && offOf(d, p, side) < -0.5 && !g.col.solidBlocked(inn, [p[0], 1.1, p[2]])) { out.at = p; break; } }
      if (!out.at) { out.why = 'no floor for Sam inside the room'; return out; }
      g.teleportPlayer(out.at); await quiet(() => R.step(2));
      const seen = new Set<any>(g.events), men: any[] = [...op.men]; SAMSTUN_STATS.dazzled = 0; let crossT = NaN; out.cut = 0; const samAt = [out.at[0], 1.1, out.at[2]];
      out.word = onWord ? D.go('all') : null; out.stepRow = onWord ? 'on my word' : 'no word: they were still walking to the stack';
      R.post = () => { for (const e of g.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'bang') out.bursts++; }
        if (!op.beats.some((b: any) => /^(toss:|no bang)/.test(b.what)) && g.col.solidBlocked(inn, samAt)) out.cut!++;
        if (isNaN(crossT) && men.some((m: any) => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.15)) crossT = g.time; };
      await quiet(() => { for (let k = 0; k < 60 * 60 && !(g.time - crossT >= 3); k++) R.step(); }); R.post = null;
      out.beats = op.beats.map((b: any) => b.what); out.tossed = out.beats.filter(b => /^toss:/.test(b)).length; out.kit1 = D.bangs; out.crossed = crossT > 0; out.dazzled = SAMSTUN_STATS.dazzled;
      return out; };
    const sayPlain = (r: SamRun) => r.why ? `${r.scn}: NOT RUN — ${r.why}` : `${r.scn}: ${r.ajar ? `the leaf standing ${Math.abs(r.ajar).toFixed(2)} rad ajar into the room (across the line from the opening to Sam on ${r.cut} frames before the can was decided) · ` : ''}bang and clear given with Sam outside (the row: ${r.bangRow === true ? 'offered' : `'${r.bangRow}'`}; ${r.stepRow}) · then Sam on the room's floor at (${f1(r.at![0])}, ${f1(r.at![2])}) · ${r.beats.filter(b => /^(the word|open already|shove|kick|toss:|bang|no bang|go)/.test(b)).join(' → ') || 'no beat'} · ${r.tossed} thrown, ${r.bursts} burst, kit ${r.kit0} → ${r.kit1} · ${r.crossed ? 'they went in' : 'NOBODY went in'} · Sam dazzled ${r.dazzled}×`;
    const say = (r: SamRun) => r.why ? `${r.scn}: NOT RUN — ${r.why}` : `${r.scn}: Sam ${r.at ? `on the room's floor at (${f1(r.at[0])}, ${f1(r.at[2])})` : 'outside'} · 'bang, then go in' → ${r.bangRow === true ? 'offered' : `'${r.bangRow}'`} · 'go in' → ${r.stepRow === true ? 'offered' : `'${r.stepRow}'`} · the word → ${r.word === null ? 'taken' : r.word} · ${r.beats.filter(b => /^(the word|toss:|bang|no bang|step in)/.test(b)).join(' → ') || 'no beat'} · ${r.tossed} thrown, ${r.bursts} burst, kit ${r.kit0} → ${r.kit1} · ${r.crossed ? 'they stepped in' : 'NOBODY stepped in'} · Sam dazzled ${r.dazzled}×`;
    try {
      const ins: SamRun[] = [], outs: SamRun[] = []; for (const scn of scns) { ins.push(await play(scn, true)); outs.push(await play(scn, false)); }
      verdict(ins.every(r => !r.why && r.bangRow === 'you are behind that door.' && r.stepRow === true && r.word === null && r.beats.includes('the word') && r.beats.includes('no bang · you are in there') && r.tossed === 0 && r.bursts === 0 && r.kit1 === r.kit0 && r.beats.some(b => /^step in/.test(b)) && r.crossed && r.dazzled === 0),
        `SAM IN THE ROOM BEYOND THE HELD DOOR, THEN THE WORD (DOORTOOLS.behindSam${BREAK ? ' — BEHINDSAM_BREAK: left off' : ''}): no can leaves a hand — the kit as it was, nothing bursts —, the beat says why ('no bang · you are in there'), they step in, he is not blinded; and 'bang, then go in' is refused in words while 'go in' is offered`, ins.map(say).join('\n    '));
      verdict(outs.every(r => !r.why && r.bangRow === true && r.word === null && r.tossed >= 1 && r.bursts === r.tossed && r.kit0 - r.kit1 === r.tossed && !r.beats.some(b => /^no bang · you/.test(b)) && r.crossed),
        `CONTROL (the rule changes nothing here: holds${BREAK ? ', as now,' : ''} under BEHINDSAM_BREAK too) … and with Sam OUTSIDE, where the commander stands, the same word bangs the blind pockets as it did: a can from the kit bursts in the room, then the step in`, outs.map(say).join('\n    '));
      const plain: SamRun[] = []; for (const scn of scns) plain.push(await playPlain(scn));
      verdict(plain.every(r => !r.why && r.bangRow === true && r.word === null && r.beats.includes('no bang · you are in there') && r.tossed === 0 && r.bursts === 0 && r.kit1 === r.kit0 && r.crossed && r.dazzled === 0),
        `A PLAIN BANG AND CLEAR, SAM GONE IN SINCE THE ROW WAS GIVEN (DOORTOOLS.behindSam${BREAK ? ' — BEHINDSAM_BREAK: left off' : ''}): the can is asked about him again as it is about to leave the hand — it goes back in the kit ('no bang · you are in there'), nothing bursts, they go in, he is not blinded`, plain.map(sayPlain).join('\n    '));
      const ajar: SamRun[] = []; for (const scn of scns) ajar.push(await playPlain(scn, 1.0));
      verdict(ajar.every(r => !r.why && !!r.ajar && r.bangRow === true && r.word === null && r.beats.includes('no bang · you are in there') && r.beats.filter(b => /^no bang/.test(b)).length === 1 && r.tossed === 0 && r.bursts === 0 && r.kit1 === r.kit0 && r.crossed && r.dazzled === 0),
        `THE SAME WITH THE DOOR FOUND AJAR (about 1 rad, the leaf swung into the room${BREAK ? ' — BEHINDSAM_BREAK: the switch left off' : ''}): the squad's own leaf across the line to Sam is not a wall between him and the can — the can is kept, the beat said once, they go in, he is not blinded`, ajar.map(sayPlain).join('\n    '));
      { const J: any = await import(`${ROOT}/src/game/journal.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`); const g = (await stage(scns[0], 1)).g, snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), all = KN.knobsCopy();   // the switch's carriage: the key rides with a recording's flags, and in its DOORTOOLS table where the recording carries one (applyKnobs writes every table a recording lacks back to 'as it was': the whole registry is put back after)
        try {
        DOORTOOLS.behindSam = true; const old = snap(); delete old.flags.behindSam; if (old.tables.DOORTOOLS) delete old.tables.DOORTOOLS.behindSam; J.applyKnobs(g, old); const before = DOORTOOLS.behindSam;   // (a file from before the key has it in neither place: a recording carries the DOORTOOLS table as well as the flag now)
        DOORTOOLS.behindSam = true; const tab = snap(); delete tab.flags.behindSam; DOORTOOLS.behindSam = false; J.applyKnobs(g, tab); const byTable = DOORTOOLS.behindSam, inTables = 'DOORTOOLS' in tab.tables;   // (…and one that holds the key in its table alone replays its table's word)
        DOORTOOLS.behindSam = true; const recOn = snap(); DOORTOOLS.behindSam = false; J.applyKnobs(g, recOn); const kept = DOORTOOLS.behindSam;
        DOORTOOLS.behindSam = false; const recOff = snap(); DOORTOOLS.behindSam = true; J.applyKnobs(g, recOff); const keptOff = DOORTOOLS.behindSam;
        verdict(before === false && kept === true && keptOff === false && recOn.flags.behindSam === true && byTable === inTables, 'CONTROL (plumbing, not the rule: BEHINDSAM_BREAK does not touch it) — a recording from before the key replays with DOORTOOLS.behindSam off; one made with it on replays on, off off',
          `a recording without the key: ${before} · recorded on: ${kept} · recorded off: ${keptOff} · in the recording's flags: ${recOn.flags.behindSam} · DOORTOOLS in its tables: ${inTables}, and with the key there alone: ${byTable}`);
        } finally { KN.knobsBack(all); } }
    } finally { DOORTOOLS.behindSam = keep.b; SAMSTUN.on = keep.s; } }
  return done();
});

/** DOORTOOLS.thrDoorsLeaf: nobody is left on another door of the room where that door's own leaf, stood open, hides it from him. The depot, the first
 *  held door the yard does not watch (the store from its bay door, as the level stands: each run's line names the door), the yard's guns out, the
 *  one-way doors up, three seeds, played with the rule OFF and ON. THRDOORSLEAF_BREAK=1: the rule left off in the ON runs — red. */
export const thresholdLeaf = guarded(async () => {
  const { verdict, done } = family('threshold-leaf: a man left on another door of the room is never put where that door\'s own leaf, stood open, hides it (DOORTOOLS.thrDoorsLeaf)');
  const BREAK = process.env.THRDOORSLEAF_BREAK === '1'; YARDOUT = true;
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`), oneWay0 = DOORWAY.oneWay; DOORWAY.oneWay = true;   // (the one-way doors, as the headless stand raises them for ONEWAY=1: the rule asks nothing of a double-acting leaf; the shipped stand has them anyway)
  try {
  const play = async (rule: boolean) => { DOORSLEAF = rule && !BREAK; const runs: Run[] = []; for (const seed of [1, 2, 3]) runs.push(await doorRun('depot-four', seed, null, 90, NaN, null, false, true)); return runs; };
  const tell = (rs: Run[]) => rs.map(r => `${r.scn}:${r.seed} ${r.door}: ${r.doorMen.length ? r.doorMen.map(m => `${m.who} on ${m.door} from ${f1(m.dist)} m${m.arrived ? '' : ' · NOT THERE'}${m.line ? '' : ' · NO LINE'}${m.inRoom ? '' : ' · OUTSIDE THE ROOM'}${m.leaf ? ' · BEHIND ITS LEAF' : ''}`).join(', ') : 'nobody on another door'} · ended '${r.ended}'`).join('\n    ');
  const off = await play(false), on = await play(true), men = (rs: Run[]) => rs.flatMap(r => r.doorMen);
  verdict(men(off).some(m => m.leaf), 'the fault is there with the rule off: a man is left on a door from where its leaf, stood open, lies across his line to it', tell(off));
  verdict(men(on).length > 0 && men(on).every(m => m.arrived && m.line && m.inRoom && !m.leaf) && on.filter(r => r.doorMen.length).length >= off.filter(r => r.doorMen.length).length && on.every(r => r.ended === 'in'),
    'with the rule on every man left on another door is on his mark in the room with a line to it that its open leaf does not cross — and the door is held in as many runs', tell(on));
  { const J = await import(`${ROOT}/src/game/journal.ts`), R = await stage('records-pair', 1), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g)));
    DOORTOOLS.thrDoorsLeaf = true; const old = snap(); delete old.tables.DOORTOOLS.thrDoorsLeaf; J.applyKnobs(R.g, old); const before = DOORTOOLS.thrDoorsLeaf;
    DOORTOOLS.thrDoorsLeaf = false; const own = snap(); own.tables.DOORTOOLS.thrDoorsLeaf = true; J.applyKnobs(R.g, own); const carried = DOORTOOLS.thrDoorsLeaf;
    verdict(before === false && carried === true, 'A RECORDING FROM BEFORE THE KEY replays with the rule off (journal.ts applyKnobs) — and a file that carries it keeps its own word', `no key in the file: ${before} · the key in the file, on: ${carried}`); }
  } finally { DOORWAY.oneWay = oneWay0; }
  return done();
});

export const thresholdDoors = guarded(async () => {
  const { verdict, done } = family('threshold-doors: every door of the seven scenarios\' levels, both faces — wherever a stack fits, the stage has shallow floor to step in to');
  const lines: string[] = []; let bad = 0, faces = 0, both = 0, one = 0, none = 0;
  for (const E of SCENARIOS as any[]) {
    const R = await stage(E.id, 1), g = R.g, D = R.D, men = R.team; let f = 0, b2 = 0, o1 = 0, no = 0; const worst: string[] = [];
    for (const d of g.doors.list) for (const side of [1, -1] as const) {
      const posts = D.stackPosts(d, side, men); if (!posts) { no++; continue; } f++;
      const W = d.def.width, lead = posts.filter((P: any) => P.lead), split = lead.some((P: any) => alongOf(d, P.pos) > W / 2) && lead.some((P: any) => alongOf(d, P.pos) < W / 2); if (split) b2++; else o1++;
      const pods = D.shallowPods(d, side, Math.max(2, men.length)), deep = pods.map((p: any) => -offOf(d, p.pos, side));
      if (!pods.length || deep.some((x: number) => x <= 0 || x > 2.5 + 1e-6)) { bad++; worst.push(`${d.def.name}/${side > 0 ? '+' : '−'}: ${pods.length ? deep.map(f1).join(', ') + ' m in' : 'NO FLOOR INSIDE'}`); } }
    faces += f; both += b2; one += o1; none += no;
    lines.push(`${E.id} (${men.length} men, ${g.doors.list.length} doors): ${f} faces take a stack — a man on each jamb on ${b2}, one jamb only on ${o1} — ${no} have no floor at either${worst.length ? ` · BAD: ${worst.join(' · ')}` : ''}`);
  }
  verdict(bad === 0 && faces > 0, 'on every face of every door where the stack\'s own test passes, the stage has points to step in to, all inside the room and 2.5 m or less from the frame line', `${faces} faces over seven scenarios · ${both} with a man on each jamb, ${one} with one jamb only (the lead slices; nobody holds a far jamb that has no floor) · ${none} no stack at all\n    ${lines.join('\n    ')}`);
  return done();
});

/** playthrough.ts in a child process with these env words over the caller's, seeds `seeds` of every scenario: its runs */
async function playthrough(env: Record<string, string>, seeds: string, set?: Record<string, Record<string, unknown>>, scn?: string, drop: string[] = []): Promise<{ runs: any[]; err: string }> {
  const E: Record<string, string | undefined> = { ...process.env, PT_TOOL: '', PT_DIGEST: '', PT_STACKWAIT: '', PT_PAUSE: '', PT_NOISE: '', PT_DESTR: '0', ...env }; for (const k of drop) delete E[k];   // (`drop`: words the run is to have NO say on — the stand's own value plays)
  const file = resolve(tmpdir(), `threshold-probe-${process.pid}-${Object.keys(env).join('-')}${set ? `-${JSON.stringify(set).length}${JSON.stringify(set).replace(/[^a-z0-9]/gi, '').slice(-24)}` : ''}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--seeds', seeds, '--jobs', '4', '--json', file, ...(scn ? ['--scn', scn] : []), ...(set ? ['--set', JSON.stringify(set)] : [])], { stdout: 'ignore', stderr: 'pipe', env: E });   // (PT_DESTR 0: these runs are held against words frozen before the destruction goal — its one switch stays off, as every other switch since is pinned)
  const err = await new Response(pr.stderr).text(); await pr.exited;
  try { const runs = JSON.parse(readFileSync(file, 'utf8')).runs; rmSync(file); return { runs, err }; } catch { return { runs: [], err }; }
}
export const thresholdPlay = guarded(async () => {
  const { verdict, done } = family('threshold-play: the scripted commander works every held room from the threshold, all seven scenarios (playthrough.ts, PT_TOOL=threshold)');
  const { runs, err } = await playthrough({ PT_TOOL: 'threshold' }, '1');
  const bad = runs.filter(r => r.end === 'error' || r.end === 'stalled');
  verdict(runs.length === SCENARIOS.length && bad.length === 0, 'seven runs, each ended by its scenario\'s own rules: none threw, none stalled with an order hanging', runs.length ? runs.map(r => `${r.scn}:${r.seed} ${r.end} at ${r.t} s · team ${r.team}/${r.of} · theirs ${r.hostiles}/${r.hostilesOf} up · ${r.rooms} doors worked${r.end === 'error' ? ` — ${String(r.why).split('\n')[0]}` : ''}`).join('\n    ') : `no result — ${err.trim().split('\n').slice(-3).join(' / ')}`);
  const rooms = runs.filter(r => !/rescue/.test(r.scn)), none = rooms.filter(r => !(r.thr > 0));   // (the two rescues are their own F: playRescue never gives the order)
  verdict(rooms.length === (SCENARIOS as any[]).filter(e => e.kind !== 'rescue').length && none.length === 0, 'the room-clearing runs each had rooms worked from the threshold (the order taken, not refused and swapped for a bang)', rooms.map(r => `${r.scn}: ${r.thr ?? 0} of ${r.rooms} rooms${(r.refused ?? []).filter((x: string) => /^threshold/.test(x)).map((x: string) => ` · refused ${x}`).join('')}`).join(' · '));
  return done();
});
export const thresholdIdentity = guarded(async () => {
  // (NOT ASKED ON THE SHIPPED STAND: the fixture's digests were frozen on the frozen stand, with the switches of its day held at their old values by name — the
  // shipped stand raises rules that list has never named, so no run of it can meet a frozen digest (all 14 read otherwise there) and the line would say nothing
  // of the stage. The question is the frozen stand's: `bun run tools/qa/probes.ts threshold-identity` with no TPS_PROFILE)
  if (harnessProfile() === 'shipped') { console.log('\n=== threshold-identity: NOT ASKED on the shipped stand — its digests are the frozen stand\'s (run it with no TPS_PROFILE) ==='); return true; }
  const { verdict, done } = family('threshold-identity: with the stage not ordered, the team on bare eyes and the later feel rules at their old values, the seven scenarios play as frozen (the whole game\'s digest every half second; frozen at af55d89, and again where a step moved every level\'s walls — the fixture names it)');
  const FIX = resolve(ROOT, 'tools/qa/fixtures/threshold-identity.json');
  const fix = JSON.parse(readFileSync(FIX, 'utf8')) as { commit: string; seeds: string; how: string; runs: { scn: string; seed: number; end: string; t: number; digest: string }[] };
  // (PT_NOLEAF: the frozen runs were played by the commander who gave a walk up at a leaf standing across it; the one who shuts it moved room-clear-pair:1)
  const { runs, err } = await playthrough({ PT_DIGEST: '1', PT_NOLEAF: '1' }, fix.seeds, { CUES: { on: false }, ORDERS: { workOut: false, cleared: false, knownFace: false, ownDoor: false, roundCap: 0, fileHold: false, backEnd: false, inWay: false, walkTries: false, hallFile: false, secondFloor: false }, NVG: { on: false }, SILENT: { on: false }, LIGHTS: { litMan: false }, ENTRY: { offOpenings: false, offMouth: false }, REAR: { settle: false }, REARWATCH: { on: false, room: false }, COVER: { step: false, backKeep: false }, ROOMFIT: { on: false }, ROOMFIGHT: { samTravel: false, samBeside: false, noShotGo: 0, keepTrack: false, sights: false, fallBackIn: false, doorEars: false }, DOORTOOLS: { cornerOwed: false, collapse: false, cornerTurn: false, leadSeen: false, thrFirst: 0, thrLast: false, buddy: false, otherDoorM: 0, ownCan: false, flowOn: false, openAir: false, flowMax: 0, threatFirst: false, bangWay: false, openHand: false, behindSam: false, haltBack: false, thrHand: false }, BUDDY: { on: false }, DOORWAY: { oneWay: false, exitsOut: false }, DOORSTAY: { on: false }, DOORBLAST: { on: false }, HANDLE: { on: false, toolNear: false }, DOORMANNERS: { on: false } }, [...new Set(fix.runs.map(r => r.scn))].join(','));   // (the five door switches: the play-through plays them all on as shipped, so each is off here by name)   // (fallBackIn: a later default-on rule of the room fight — a man leaving a lost room never falls back out of the building — pinned off with the rest)   // (BUDDY: a lone defender's radio call for a buddy, buddy.ts, came later; it ships off and is pinned off here all the same · bare eyes: the fixture is af55d89, which had no goggles — nvg.ts ships them on, and a team on its goggles plays a different game by design; and the room fight's four rescue-with-goggles rules at their old values — they ship on and change who fires when, also by design; RESCUE.holdHot ships off and NVG.huntFrees does nothing on bare eyes; DOORTOOLS.thrFirst — the can that goes in first on a hot door — is pinned off for form: this play-through never orders the threshold stage, so it could not fire here anyway; DOORTOOLS.thrLast — the captor's last warning heard at a hostage door — likewise a rule of that stage, pinned to its old value all the same; its entry points where they were: entrypoints.ts ships them moved; and a gun the cover lets go of back on the order's own watch that frame: cover.ts REAR ships it kept on the opening a moment · and nobody stepping to see through an open door, cover.ts COVER.step: after the fixture too · and the entry's corner and first-man rules, doortools.ts, which came later and ship on, off the same way · and the night breach's hunt rule, LIGHTS.litMan, off the same way: it ships on and changes when a light burns and when a masked man walks)
  if (process.env.THRESHOLD_IDENTITY_WRITE) {   // RE-FREEZE (a step that moves every level's walls moves every run: the words are then this build's, with the same switches held at their old values) — THRESHOLD_IDENTITY_WRITE='<what was frozen and why>' bun run tools/qa/probes.ts threshold-identity, then once more without it: the second run must match
    const kept = fix.runs.map(f => runs.find(x => x.scn === f.scn && x.seed === f.seed));
    if (kept.every(r => !!r)) { writeFileSync(FIX, JSON.stringify({ commit: process.env.THRESHOLD_IDENTITY_WRITE, seeds: fix.seeds, how: fix.how, runs: kept.map(r => ({ scn: r!.scn, seed: r!.seed, end: r!.end, t: r!.t, digest: r!.digest })) }, null, 1) + '\n'); fix.commit = process.env.THRESHOLD_IDENTITY_WRITE; fix.runs = kept.map(r => ({ scn: r!.scn, seed: r!.seed, end: r!.end, t: r!.t, digest: r!.digest })); console.log(`  (re-froze ${fix.runs.length} runs to ${FIX})`); }
    else console.log(`  (NOT re-frozen: ${kept.filter(r => !r).length} of ${fix.runs.length} runs gave no result)`);
  }
  const rows = fix.runs.map(f => { const r = runs.find(x => x.scn === f.scn && x.seed === f.seed); return { f, r, same: !!r && r.digest === f.digest && r.end === f.end && r.t === f.t }; });
  verdict(runs.length === fix.runs.length && rows.every(x => x.same), `${fix.runs.length} runs (seeds ${fix.seeds} of every scenario, the scripted commander banging and opening doors as ever): each ends the same way, at the same second, on the same digest as the run frozen at ${fix.commit}`,
    runs.length ? rows.map(x => `${x.f.scn}:${x.f.seed} ${x.f.end} ${x.f.t} s ${x.f.digest}${x.same ? '' : `  ≠  ${x.r ? `${x.r.end} ${x.r.t} s ${x.r.digest}` : 'no run'}`}`).join('\n    ') : `no result — ${err.trim().split('\n').slice(-3).join(' / ')}`);
  return done();
});

/** NO CAN FROM A HAND THAT IS NOT AT THE DOOR (DOORTOOLS.thrHand). Staged: a threshold given to hold, the men run off the door a second before Sam says
 *  'bang, then step in' (doorRun's `away`: what a grenade landing by the stack does to them — the thrower is then picked with nobody at the door, the
 *  lead by the pick's last case on the shipped stand, as in the traced run), and what the can then does — with the rule, without it, past its wait, and
 *  with nobody run off at all. In the past-the-wait runs the men are held off for longer than the orders' own stuck rule waits, so their marks may have
 *  moved to where they are held: that line asks only that the wait ends and the can goes as it did, not that anybody would have walked back. The rule is
 *  raised by the probe on either stand. THRHAND_BREAK=1: the rule left off where it should be on — red. */
export const thresholdHand = guarded(async () => {
  const { verdict, done } = family('threshold-hand: a threshold\'s can is thrown only by a man within reach of the frame, and waits for one (DOORTOOLS.thrHand)');
  const BREAK = process.env.THRHAND_BREAK === '1', K = DOORTOOLS, reach = K.throwReach, hold: Hold = { tell: 'bang', after: 2 };
  const DOORS: [string, string | null][] = [['depot-four', 'c_w'], ['records-pair', null]];
  const STEP = 0.05;   // (the probe looks at the thrower once the frame is over: a walking man's stride after the rule's own look at him)
  const cans = (r: Run) => r.beats.filter(b => /^toss:/.test(b.what)).length, has = (r: Run, re: RegExp) => idx(r, re) >= 0, firstIn = (r: Run) => r.beats.find(b => /^cross:/.test(b.what))?.what.slice(6);
  const leadOf = (r: Run) => r.beats.find(b => /^ordered · /.test(b.what))?.what.split(' · lead ')[1] ?? '';
  const tell = (r: Run) => `${line(r)}: ${r.why ?? `${r.tossAt.map(x => `${x.who} threw from ${x.near.toFixed(2)} m${x.who === x.lead ? ' (the lead)' : ''}`).join(', ') || 'no can'} · lead ${leadOf(r)} · first man in ${firstIn(r) ?? '—'} · kit ${r.bangs0} → ${r.bangs1} · ${r.alive} of ${r.n} up · ended '${r.ended}' · ${story(r)}`}`;
  const off: Run[] = [], on: Run[] = [], late: Run[] = [], plainOn: Run[] = [], plainOff: Run[] = [];
  NOCAN = FRAGHOLD = false;   // (this probe is thrHand by itself: the two grenade answers, raised by a stand's word, are threshold-grenade's)
  const AWAY = 1;   // (s after Sam speaks that the men are let go: the can is asked for `thrTurn` after he does, so with the rule off it is thrown while they are still off — and with it they have most of the wait to walk back in, on either stand)
  for (const [scn, door] of DOORS) {
    HAND = false; off.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, AWAY)); plainOff.push(await doorRun(scn, 1, door, 120, NaN, hold));
    HAND = !BREAK; on.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, AWAY)); late.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, K.thrHandWait + 3)); plainOn.push(await doorRun(scn, 1, door, 120, NaN, hold));
  }
  HAND = null;
  const WAITS = /^can waits: no hand at the door/, LATE = /^can waited /;   // (the whole prefix: 'can waits: the door has come shut' is bangWay's)
  verdict(off.every(r => !r.why && r.tossAt.length >= 1 && r.tossAt[0].near >= reach && !has(r, WAITS)),
    `THE FAULT, with the rule off: nobody at the door as the can is asked for, and it leaves the doorway with its thrower ${reach} m or more away`, off.map(tell).join('\n    '));
  const waited = (r: Run) => tOf(r, /^toss:/) - tOf(r, WAITS);
  verdict(on.every(r => !r.why && has(r, WAITS) && !has(r, LATE) && r.tossAt.length >= 1 && r.tossAt.every(x => x.near < reach + STEP) && r.bangs.length === cans(r) && r.bangs.every(b => b.inside > 0.5) && (stepped(r) < 2 || r.tossAt.every(x => x.who !== x.lead)) && r.ended === 'in'),
    `WITH THE RULE THE CAN WAITS FOR A HAND AT THE DOOR: 'can waits' is said, nothing is thrown while nobody is within ${reach} m of the frame, and once the men are back it is thrown by a man who is — not the lead while two or more step in — bursts inside the room, and the order ends 'in' (who crosses first, with the men still walking back as they step in, is not this rule's: printed, not asked)`, on.map(r => `waited ${f1(waited(r))} s · ${tell(r)}`).join('\n    '));
  verdict(late.every((r, k) => !r.why && has(r, WAITS) && has(r, LATE) && cans(r) >= 1 && r.tossAt[0].near >= reach - STEP && r.tossAt[0].who === off[k].tossAt[0]?.who && waited(r) >= K.thrHandWait - 0.05 && waited(r) < K.thrHandWait + K.thrHandEvery + 0.1 && r.ended === 'in'),
    `… AND NO LONGER THAN thrHandWait (${K.thrHandWait} s): nobody back by then, the stage is as it was — 'can waited', the can goes from the SAME man as with the rule off, where he is — and the order still ends 'in' (the rule neither hangs an order nor takes its can)`, late.map((r, k) => `waited ${f1(waited(r))} s · rule off: ${off[k].tossAt[0]?.who ?? '—'} · ${tell(r)}`).join('\n    '));
  const same = (a: Run, b: Run) => !a.why && !b.why && a.beats.length === b.beats.length && a.beats.every((x, k) => x.what === b.beats[k].what && Math.abs(x.t - b.beats[k].t) < 1e-6);
  verdict(plainOn.every((r, k) => same(r, plainOff[k]) && cans(r) >= 1 && !has(r, WAITS)),
    'NOBODY RUN OFF, the rule changes nothing: the same door told the same thing plays beat for beat, to the frame, as with the rule off — and the can goes', plainOn.map((r, k) => `${line(r)}: ${r.beats.length} beats with the rule, ${plainOff[k].beats.length} without · ${cans(r)} can(s) · ${story(r)}`).join('\n    '));
  // (a recording or a replay's tape from before the key plays as it was made: journal.ts applyKnobs writes the rule off for a file that does not carry it)
  { const J = await import(`${ROOT}/src/game/journal.ts`), R = await stage('records-pair', 1), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g)));
    DOORTOOLS.thrHand = true; const old = snap(); delete old.tables.DOORTOOLS.thrHand; J.applyKnobs(R.g, old); const before = DOORTOOLS.thrHand;
    DOORTOOLS.thrHand = false; const own = snap(); own.tables.DOORTOOLS.thrHand = true; J.applyKnobs(R.g, own); const carried = DOORTOOLS.thrHand;
    verdict(before === false && carried === true, 'A RECORDING FROM BEFORE THE KEY replays with the rule off (journal.ts applyKnobs) — and a file that carries the key keeps its own word', `no key in the file: thrHand ${before} · the key in the file, on: thrHand ${carried}`); }
  return done();
});

/** DOORTOOLS.thrLast, STAGED BY HAND on the registry's hostage door: the order given, one jamb man put ON his mark and the other 3 m or more down THAT man's
 *  wall (to reach his own jamb he would walk across the opening), the captor's clock put at its last step. `late` 'far' = the far-jamb man is the late one,
 *  'lead' = the man who opens it is; `tucked`: Sam stands in the first place behind the man on his mark (the place a late man would be given). */
async function lastStaged(seed: number, late: 'far' | 'lead', on: boolean, tucked = false) {
  const R = await stage('rescue-registry', seed), g = R.g, D = R.D, RS = g.rescue, K = DOORTOOLS; K.thrLast = on;
  const out = { why: null as string | null, beats: [] as { t: number; what: string }[], t0: 0, late: '', early: '', lead0: '', lead1: '', sameWall: false, samGap: NaN, crossed: false, tossed: 0, held: NaN, stackedAt: NaN, lateOn: NaN, shot: 0, alive: [0, 0], flag: [false, false] };
  const hit = heldEntries(R).find(x => x.ent.door.def.name === RS.data?.room.door); if (!hit) { out.why = 'the hostage room has no entry the room fight knows'; return out; }
  const ent = hit.ent, d = ent.door, W = d.def.width, nav = g.col.nav, lx = -ent.out[1], lz = ent.out[0];
  g.teleportPlayer([ent.at[0] + ent.out[0] * 3.4 + lx * 0.2, 0, ent.at[2] + ent.out[1] * 3.4 + lz * 0.2]);
  // (the door alone is the test: the men of theirs who are not in the hostage room are taken off the floor, and the two at the door cannot be dropped)
  const inRoom = (q: number[]) => hit.room.cells.has(Math.floor(q[2] / nav.cell) * nav.W + Math.floor(q[0] / nav.cell));
  for (const h of R.hostiles) if (h.state !== 'dead' && !inRoom(h.char.pos)) killGuard(g, h, [0, 0, 1], true, 'struck');
  for (const m of R.team) m.god = true;
  const op: any = D.thresholdOn(d.def.name, 'all'); if (typeof op === 'string') { out.why = op; return out; }
  const side = op.side, lead: any = op.lead, far: any = op.men.find((m: any) => m !== lead && op.post.get(m)?.lead && (alongOf(d, op.post.get(m).pos) > W / 2) !== (alongOf(d, op.post.get(lead).pos) > W / 2));
  if (!far) { out.why = 'one jamb only has floor here'; return out; }
  const L: any = late === 'lead' ? lead : far, E: any = late === 'lead' ? far : lead, PE = op.post.get(E).pos, aE = alongOf(d, PE), dir = aE > W / 2 ? 1 : -1, oE = offOf(d, PE, side);
  let from: number[] | null = null;
  for (const back of [4, 3.5, 4.5, 3, 5, 6]) { for (const o of [1.25, 2, 0.8, oE, 2.75]) { const q = doorPt(d, aE + dir * back, o, side); if (!nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([PE[0], 0.45, PE[2]], [q[0], 0.45, q[2]])) { from = q; break; } } if (from) break; }
  if (!from) for (const o of [4, 3.5, 4.5, 3]) { const q = doorPt(d, W / 2, o, side); if (!nav.isBlocked(q[0], q[2])) { from = q; break; } }   // (no run of wall on that side — a nook: he comes from straight out in front)
  if (!from) { out.why = 'no floor to start the late man from'; return out; }
  E.char.pos = [PE[0], 0, PE[2]]; L.char.pos = [from[0], 0, from[2]];
  if (tucked) g.teleportPlayer(doorPt(d, aE + dir * K.bangFile, oE, side));
  if (isNaN(RS.t0)) RS.t0 = g.time; RS.resolve = 0.85;   // (his last step: 'about to' from the next tick, the round `resolveSecs` × 0.15 + his aim away)
  out.late = L.callsign; out.early = E.callsign; out.lead0 = lead.callsign; out.t0 = g.time;
  let inT = NaN;
  R.post = () => { const t = g.time;
    if (isNaN(inT) && op.beats.some((x: any) => /^step in/.test(x.what))) inT = t;
    if (isNaN(out.lateOn) && flat(L.char.pos, op.post.get(L)?.pos ?? L.char.pos) < 0.6) out.lateOn = t - out.t0;
    if (isNaN(inT) && L.state !== 'dead') { const a = alongOf(d, L.char.pos), o = offOf(d, L.char.pos, side); if (a > 0.1 && a < W - 0.1 && o > -0.15 && o < 2.5) out.crossed = true; } };
  await quiet(() => { for (let i = 0; i < 40 * 60 && D.ops.includes(op) && isNaN(inT); i++) R.step(); R.step(30); });
  R.post = null;
  const PL = op.post.get(L)?.pos ?? L.char.pos, sam = g.player.char.pos;
  out.beats = op.beats.map((x: any) => ({ t: x.t - out.t0, what: x.what })); out.lead1 = op.lead.callsign; out.flag = [!!op.lastStack, !!op.lastHold];
  out.sameWall = (alongOf(d, PL) > W / 2) === (aE > W / 2); out.samGap = flat(PL, sam);
  (out as any).fate = [L, E].map((m: any) => `${m.callsign}: ${m.state}, ${op.men.includes(m) ? 'on the order' : 'off it'}, '${R.O.of(m)?.there ?? R.O.of(m)?.order ?? 'no order'}' at ${m.char.pos.map((x: number) => x.toFixed(1)).join(',')}`).join(' · ');
  out.tossed = out.beats.filter(x => /^toss:/.test(x.what)).length; out.held = +(out.beats.find(x => /^held /.test(x.what))?.what.match(/^held ([\d.]+) s/)?.[1] ?? NaN);
  out.stackedAt = out.beats.find(x => x.what === 'stacked')?.t ?? NaN;
  const H = (RS.hostages ?? []).map((h: any) => h.gd ?? h); out.alive = [H.filter((h: any) => h.state !== 'dead').length, H.length]; out.shot = RS.executed.size;
  return out;
}
/** DOORTOOLS.thrLast — THE CAPTOR'S LAST WARNING IS HEARD AT THE DOOR. (1) The door staged by hand (lastStaged): the rule's own geometry, whichever man is the
 *  late one. (2) The registry rescue played from the threshold on the two seeds of its 48 whose clock is dealt shortest among the runs with a man back on
 *  his cover when the order is given (the traced loss: tools/qa/playthrough.ts `clock`) — with the rule against without it, seed for seed. */
export const thresholdLast = guarded(async () => {
  const { verdict, done } = family('threshold-last: a hostage room\'s captor at his last step — the men at its door neither wait for a man still walking up nor hold (DOORTOOLS.thrLast)');
  const f1 = (x: number) => isNaN(x) ? '—' : x.toFixed(1);
  const tell = (r: Awaited<ReturnType<typeof lastStaged>>) => r.why ? `not staged — ${r.why}` : `late ${r.late}, on his mark ${r.early}, lead ${r.lead0}${r.lead1 !== r.lead0 ? ` → ${r.lead1}` : ''} · stacked ${f1(r.stackedAt)} s, held ${f1(r.held)} s, ${r.tossed} can(s) · the late man's place ${r.sameWall ? 'on the same wall' : 'across the opening'}, ${f1(r.samGap)} m from Sam${r.crossed ? ', WALKED ACROSS THE DOOR' : ''} · hostages ${r.alive[0]}/${r.alive[1]}\n      ${(r as any).fate}\n      ${r.beats.filter(x => !/^(contact|down from)/.test(x.what)).slice(0, 9).map(x => `${f1(x.t)} ${x.what}`).join(' → ')}`;
  const A = await lastStaged(3, 'far', true), B = await lastStaged(3, 'lead', true), C = await lastStaged(3, 'far', true, true), Z = await lastStaged(3, 'far', false);
  const went = (r: typeof A) => !r.why && r.flag[0] && r.flag[1] && r.beats.some(x => x.what.startsWith(`last warning · not waiting for ${r.late}`)) && r.stackedAt < 1.5 && r.held < 0.5 && r.tossed === 1;
  verdict(went(A) && A.lead1 === A.lead0 && A.sameWall && !A.crossed,
    'staged, the far-jamb man 3 m or more down the lead\'s wall: the lead opens without him, nothing is held, ONE can — and the late man is given a place behind the lead on that wall, never walking across the door', tell(A));
  verdict(went(B) && B.lead1 === B.early && B.beats.some(x => x.what.includes(`the door is ${B.early}'s`)) && B.beats.some(x => x.what === 'kick'),
    '… the LEAD the late one: the door is handed to the man on his jamb, who opens it (the old lead files in behind him where that wall has floor — at this door\'s nook it has none, and he keeps his jamb)', tell(B));
  verdict(went(C) && C.sameWall && C.samGap >= 0.7 && !C.crossed,
    '… with Sam stood in the first place behind the lead: the late man is given the next one, not Sam\'s', tell(C));
  verdict(!Z.why && !Z.flag[0] && !Z.flag[1] && !Z.beats.some(x => /^last warning/.test(x.what)) && Z.stackedAt > A.stackedAt + 1 && (isNaN(Z.held) || Z.held >= 0.5) && Z.lead1 === Z.lead0,
    'the same door with the rule off: the stack waits for the man walking up, as it did', tell(Z));
  console.log(`  (staged: the captor's round — with it ${A.shot} shot, ${A.alive[0]}/${A.alive[1]} alive · off ${Z.shot} shot, ${Z.alive[0]}/${Z.alive[1]} alive)`);
  const SEEDS = '32,44', scn = 'rescue-registry';
  // (AS THE PAGE OPENS the played arms are the page's own: its destruction on — with it held off, a stand the page never opens on, registry seed 32 loses both
  //  teammates to a roamer at their backs before anybody crosses, rule or no rule — and the captor's clock, which that stand deals to the second (samestart.ts: 35 s,
  //  his last step at 28.4 s, after the entry is over on either seed), set to 24 s: his last step at 19.6 s, while the pair is still walking to the stack, as the
  //  frozen stand's shortest-dealt seeds have it)
  // (… and the cast's guns as they were when these two seeds were picked — every defender the short carbine, gunroles.ts held off: dealt off the table,
  //  registry seed 32 loses one of the pair with the rule and nobody without it; a two-seed pairing says nothing about the guns, and which seeds this
  //  line should stand on with them dealt is its owner's to pick)
  const SHIPPED = process.env.TPS_PROFILE === 'shipped', clock: Record<string, Record<string, unknown>> = SHIPPED ? { RESCUE: { resolveSecs: 24 }, GUNROLES: { on: false } } : {}, drop = SHIPPED ? ['PT_DESTR'] : [];
  const [on, off] = await Promise.all([playthrough({ PT_TOOL: 'threshold' }, SEEDS, { ...clock, DOORTOOLS: { thrLast: true } }, scn, drop), playthrough({ PT_TOOL: 'threshold' }, SEEDS, { ...clock, DOORTOOLS: { thrLast: false } }, scn, drop)]);
  const thr = (r: any) => (r.entries ?? []).find((e: any) => e.tool === 'threshold'), shot = (r: any) => (r.clock?.log ?? []).filter((x: [number, string]) => /^executed/.test(x[1])).length;
  const round = (r: any) => r.clock ? r.clock.t0 + r.clock.secs + RESCUE.aimSecs : NaN, num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const line = (r: any) => { const e = thr(r); return `${r.scn}:${r.seed} ${r.end} at ${r.t} s · team ${r.team}/${r.of} · hostages ${r.hostages?.[0]}/${r.hostages?.[1]} · clock dealt ${r.clock?.secs} s from ${r.clock?.t0} s · ordered ${e?.t0} s, held ${e?.held ?? '—'} s, first man across ${e?.cross ?? '—'} s, ${e?.bangs ?? 0} can(s)${e?.last ? ` · last warning: ${e.last}` : ''}${shot(r) ? ` · ${shot(r)} shot by the captor` : ''}`; };
  const none = `no result — ${(on.err || off.err).trim().split('\n').slice(-3).join(' / ')}`, pair = (r: any) => off.runs.find(o => o.seed === r.seed);
  verdict(on.runs.length === 2 && on.runs.every(r => r.end === 'rescued' && !!thr(r)?.last && num(thr(r)?.held) && thr(r).held < DOORTOOLS.thrMin && thr(r)?.bangs >= 1 && num(thr(r)?.cross)),
    'played, with the rule: on both seeds the last warning is acted on at the hostage door — the hold cut short or never held, a can in, a man across the frame', on.runs.length ? on.runs.map(line).join('\n    ') : none);
  verdict(on.runs.length === 2 && on.runs.every(r => shot(r) === 0 && num(r.hostages?.[0]) && r.hostages[0] === r.hostages[1] && num(thr(r)?.cross) && num(round(r)) && thr(r).cross < round(r)),
    '… the first man is across before the captor\'s clock could have put a round in a hostage (its dealt length, and his aim on her), nobody is shot by him, both hostages live', on.runs.length ? on.runs.map(r => `${r.scn}:${r.seed} across at ${thr(r)?.cross} s · the clock\'s round no sooner than ${f1(round(r))} s · ${((r.clock?.log ?? []) as [number, string][]).map(x => `${x[0]} ${x[1]}`).join(', ')}`).join('\n    ') : none);
  verdict(on.runs.length === 2 && off.runs.length === 2 && on.runs.every(r => r.team >= (pair(r)?.team ?? Infinity) && !(r.smells ?? []).some((x: any) => x.kind === 'friendly' || x.kind === 'stuck' || x.kind === 'hung')),
    '… and it costs nobody: as many of the team up at the end as on the same seed without it, nobody stuck or left on a walk that never ends, no friend shot', on.runs.length ? on.runs.map(r => `${r.scn}:${r.seed} team ${r.team}/${r.of} (without: ${pair(r)?.team ?? '—'}) · ${(r.smells ?? []).map((x: any) => x.kind).join(', ') || 'no smells'}`).join('\n    ') : none);
  verdict(off.runs.length === 2 && off.runs.every(r => !thr(r)?.last),
    'with it off the stage is as it was: no last warning acted on', off.runs.length ? off.runs.map(line).join('\n    ') : none);
  return done();
});

/** A GRENADE AT A HELD DOOR, the two answers (DOORTOOLS.thrFragHold, thrNoCan — on in the page since the maintainer's yes, 10-16): each set by the probe on either stand, and each
 *  shown beside the same run with it off. THRFRAGHOLD_BREAK=1 / THRNOCAN_BREAK=1: that rule left off where it should be on — red. */
export const thresholdGrenade = guarded(async () => {
  const { verdict, done } = family('threshold-grenade: a grenade by a held door — the order waits for its men who ran (DOORTOOLS.thrFragHold); a can nobody is back for stays in the kit (DOORTOOLS.thrNoCan)');
  const FB = process.env.THRFRAGHOLD_BREAK === '1', NB = process.env.THRNOCAN_BREAK === '1', K = DOORTOOLS, reach = K.throwReach, hold: Hold = { tell: 'bang', after: 2 };
  const DOORS: [string, string | null][] = (process.env.THRG_DOORS ? JSON.parse(process.env.THRG_DOORS) : [['depot-four', 'c_w'], ['records-pair', null]]);
  const cans = (r: Run) => r.beats.filter(b => /^toss:/.test(b.what)).length, has = (r: Run, re: RegExp) => idx(r, re) >= 0;
  const same = (a: Run, b: Run) => !a.why && !b.why && a.beats.length === b.beats.length && a.beats.every((x, k) => x.what === b.beats[k].what && Math.abs(x.t - b.beats[k].t) < 1e-6);
  const STEP = 0.05, wait = K.thrHandWait;
  const tellF = (r: Run) => `${line(r)}: ${r.why ?? `ran ${r.fragRan.join(', ') || 'nobody'} · as 'step in' was said ${r.offAtStep?.join(', ') || 'nobody'} off the door · ${r.tossAt.map(x => `${x.who} threw from ${x.near.toFixed(2)} m`).join(', ') || 'no can'} · ${r.alive} of ${r.n} up · ended '${r.ended}' · ${story(r)}`}`;
  const RAN = /^grenade on the stack · /, WAIT = /^the door waits: /, BACK = /^the men are back/, SPENT = /^on without .* · the order's wait is spent$/, LEAD = 1, SHORT = 0.3;   // (the grenade is put down LEAD s before Sam says 'bang, then step in': the men are running as he speaks)
  const fOff: Run[] = [], fOn: Run[] = [], fBoth: Run[] = [], fLate: Run[] = [], pOff: Run[] = [], pOn: Run[] = [];
  for (const [scn, door] of DOORS) {
    HAND = false; FRAGHOLD = false; pOff.push(await doorRun(scn, 1, door, 120, NaN, hold)); fOff.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, 0, LEAD));
    FRAGHOLD = !FB; pOn.push(await doorRun(scn, 1, door, 120, NaN, hold)); fOn.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, 0, LEAD));
    HANDWAIT = SHORT; fLate.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, 0, LEAD)); HANDWAIT = null; K.thrHandWait = wait;   // (… with the order's whole wait cut to less than their run back takes)
    HAND = true; fBoth.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, 0, LEAD));
  }
  FRAGHOLD = HAND = null; K.thrHandWait = wait;
  verdict(fOff.every(r => !r.why && r.fragRan.length >= 1 && !has(r, WAIT) && !has(r, RAN)) && fOff.some(r => (r.offAtStep?.length ?? 0) >= 1),
    'THE FAULT, with both rules off: a grenade lands by the stack, the men run, Sam says bang — and on one of these doors at least \'step in\' is said with a man of the order still off the door and off his mark (a door whose men step off no further than a throw of the frame shows none: printed)', fOff.map(tellF).join('\n    '));
  const held = (r: Run) => !r.why && r.fragRan.length >= 1 && has(r, RAN) && has(r, WAIT) && has(r, BACK) && !has(r, SPENT) && !!r.offAtStep && r.offAtStep.length === 0 && tOf(r, /^toss:|^step in/) >= tOf(r, BACK) && cans(r) >= 1 && r.tossAt.every(x => x.near < reach + STEP) && tOf(r, /^toss:/) - tOf(r, WAIT) < wait + K.thrTurn + 0.5 && r.ended === 'in';
  verdict(fOn.every(held),
    `WITH THE RULE THE DOOR WAITS FOR ITS MEN: 'the door waits' is said, no can goes and nobody steps in until 'the men are back', a can goes within the order's one wait and every can is thrown from within ${reach} m of the frame, 'step in' is said with every living man at the door or on his mark, and the order ends 'in'`, fOn.map(tellF).join('\n    '));
  verdict(fBoth.every(held),
    '… THE SAME WITH THE CAN\'S OWN RULE ON TOO (thrHand, as the page has it)', fBoth.map(tellF).join('\n    '));
  verdict(fLate.every(r => !r.why && has(r, RAN) && has(r, SPENT) && !(tOf(r, BACK) < tOf(r, SPENT)) && has(r, WAIT) && tOf(r, SPENT) - tOf(r, WAIT) >= SHORT - 0.1 && tOf(r, SPENT) - tOf(r, WAIT) < SHORT + 0.3 && cans(r) >= 1 && r.ended === 'in'),
    `… AND NO LONGER THAN THE ORDER'S ONE WAIT (thrHandWait, cut to ${SHORT} s for this line, counted from 'the door waits'): men not back by then do not hang it — 'on without … · the order's wait is spent', the can goes and the order ends 'in'`, fLate.map(r => `waited ${(tOf(r, SPENT) - tOf(r, WAIT)).toFixed(2)} s · ${tellF(r)}`).join('\n    '));
  verdict(pOn.every((r, k) => same(r, pOff[k]) && !has(r, RAN)),
    'NO GRENADE, the rule changes nothing: the same door told the same thing plays beat for beat, to the frame, as with the rule off', pOn.map((r, k) => `${line(r)}: ${r.beats.length} beats with the rule, ${pOff[k].beats.length} without`).join('\n    '));
  // ---- the hold's half: a hold that ends by itself, the grenade put down at the rear-most man's feet AHEAD s before the same hold, with no grenade, ends
  { const AHEAD = 1.2, hOff: Run[] = [], hOn: Run[] = [];
    const tellH = (r: Run) => `${line(r)}: ${r.why ?? `ran ${r.fragRan.join(', ') || 'nobody'} · every man back ${f1(r.backT)} s into the hold · the hold ended at ${f1(r.thrEndT)} s (${f1(r.thrEndT - r.backT)} s after) with ${r.offAtEnd?.join(', ') || 'nobody'} off the door · ${r.alive} of ${r.n} up · ended '${r.ended}'`}`;
    HAND = false;
    for (const [scn, door] of DOORS) {
      FRAGHOLD = false; const at = (await doorRun(scn, 1, door, 120)).thrEndT - AHEAD; hOff.push(await doorRun(scn, 1, door, 120, NaN, null, false, false, 0, at));
      FRAGHOLD = !FB; hOn.push(await doorRun(scn, 1, door, 120, NaN, null, false, false, 0, at)); }
    FRAGHOLD = HAND = null;
    const soon = (r: Run) => !isNaN(r.thrEndT) && !isNaN(r.backT) && r.thrEndT - r.backT < K.thrQuiet - 0.05;   // (the hold ended before its men were back, or less than its own quiet count after)
    verdict(hOff.every(r => !r.why && r.fragRan.length >= 1) && hOff.some(soon) && hOn.every(r => !r.why && r.fragRan.length >= 1 && has(r, RAN) && r.thrEndT - r.backT >= K.thrQuiet - 0.05 && !!r.offAtEnd && r.offAtEnd.length === 0 && r.ended === 'in'),
      `THE HOLD ITSELF, a hold that steps in by itself: with the rule off, on one of these doors at least, it ends before its men are all back or sooner than its quiet count (${K.thrQuiet} s) after; with the rule, on every door, it ends no sooner than that count after every living man is back at the door or on his mark, and the order ends 'in'`, [...hOff.map(r => `off · ${tellH(r)}`), ...hOn.map(r => `on  · ${tellH(r)}`)].join('\n    ')); }
  // ---- thrNoCan (under thrHand): the men run off the door and held off past the order's whole wait
  const tellC = (r: Run) => `${line(r)}: ${r.why ?? `${r.tossAt.map(x => `${x.who} threw from ${x.near.toFixed(2)} m`).join(', ') || 'no can'} · kit ${r.bangs0} → ${r.bangs1} · ${r.alive} of ${r.n} up · ended '${r.ended}' · ${story(r)}`}`;
  const NONE = /^no bang · nobody at the door/, WAITS = /^can waits: no hand at the door/, thrown: Run[] = [], kept: Run[] = [], backOff: Run[] = [], backOn: Run[] = [];
  HAND = true;
  for (const [scn, door] of DOORS) {
    NOCAN = false; thrown.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, K.thrHandWait + 3)); backOff.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, 1));
    NOCAN = !NB; kept.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, K.thrHandWait + 3)); backOn.push(await doorRun(scn, 1, door, 120, NaN, hold, false, false, 1));
  }
  HAND = NOCAN = null;
  verdict(thrown.every(r => !r.why && has(r, WAITS) && cans(r) >= 1 && r.tossAt[0].near >= reach - 0.05 && !has(r, NONE)),
    `AS IT IS, with the rule off: the wait runs out with nobody at the door and the can is thrown from ${reach} m or more away`, thrown.map(tellC).join('\n    '));
  verdict(kept.every(r => !r.why && has(r, WAITS) && has(r, NONE) && cans(r) === 0 && r.bangs.length === 0 && r.bangs1 === r.bangs0 && tOf(r, /^step in/) >= tOf(r, NONE)),
    "WITH THE RULE THE CAN STAYS IN THE KIT: 'no bang · nobody at the door' is said, nothing is thrown, the kit's count is what it was, and the order goes on to its step in (how an entry with no can then ends is the room fight's, and printed: a pair down to one man steps in alone)", kept.map(tellC).join('\n    '));
  verdict(backOn.every((r, k) => same(r, backOff[k]) && cans(r) >= 1 && !has(r, NONE)),
    'A HAND BACK IN TIME, the rule changes nothing: the can waits, is thrown from the door, and the run plays beat for beat as with the rule off', backOn.map((r, k) => `${line(r)}: ${r.beats.length} beats with the rule, ${backOff[k].beats.length} without · ${cans(r)} can(s)`).join('\n    '));
  // ---- THE WORD where it spends no can (DOORTOOLS.wordNoCan, as the page has it): it steps the men in — and with thrFragHold it waits for the men who ran,
  //      as the can's stage does. The first word is owed; the word again (outside the tap window) pays it at once.
  { const word: Hold = { tell: 'word', after: 2 }, AGAIN = 1.5, STEPIN = /^step in/, NOTW = /^on without .* · not waited for$/;
    const wOff: Run[] = [], wOn: Run[] = [], wLate: Run[] = [], wAgain: Run[] = [], qOff: Run[] = [], qOn: Run[] = [];
    WORDNOCAN = true; HAND = true;
    try { for (const [scn, door] of DOORS) {
      FRAGHOLD = false; qOff.push(await doorRun(scn, 1, door, 120, NaN, word)); wOff.push(await doorRun(scn, 1, door, 120, NaN, word, false, false, 0, LEAD));
      FRAGHOLD = !FB; qOn.push(await doorRun(scn, 1, door, 120, NaN, word)); wOn.push(await doorRun(scn, 1, door, 120, NaN, word, false, false, 0, LEAD));
      wAgain.push(await doorRun(scn, 1, door, 120, NaN, { ...word, again: AGAIN }, false, false, 0, LEAD));
      HANDWAIT = SHORT; wLate.push(await doorRun(scn, 1, door, 120, NaN, word, false, false, 0, LEAD)); HANDWAIT = null; K.thrHandWait = wait; } }
    finally { WORDNOCAN = false; FRAGHOLD = HAND = null; HANDWAIT = null; K.thrHandWait = wait; }
    const tellW = (r: Run) => `step in ${f1(tOf(r, STEPIN) - r.tellT)} s after the word · ${tellF(r)}`;
    verdict(wOff.every(r => !r.why && r.fragRan.length >= 1 && !has(r, WAIT) && cans(r) === 0 && tOf(r, STEPIN) - r.tellT < 0.1),
      "THE WORD THAT SPENDS NO CAN, the grenade rule off: a grenade lands by the stack, the men run, Sam gives the word — and 'step in' is said on that frame, whoever is still running", wOff.map(tellW).join('\n    '));
    verdict(wOn.every(r => !r.why && r.fragRan.length >= 1 && has(r, RAN) && has(r, WAIT) && has(r, BACK) && !has(r, SPENT) && tOf(r, STEPIN) >= tOf(r, BACK) && cans(r) === 0 && !!r.offAtStep && r.offAtStep.length === 0),
      "… WITH THE RULE THE WORD WAITS FOR THEM: 'the door waits' is said, nobody steps in until 'the men are back', no can is spent, and 'step in' is said with every living man at the door or on his mark (how the entry with no can then ends is the room fight's, and printed)", wOn.map(tellW).join('\n    '));
    verdict(wLate.every(r => !r.why && has(r, WAIT) && has(r, SPENT) && tOf(r, SPENT) - tOf(r, WAIT) >= SHORT - 0.1 && tOf(r, SPENT) - tOf(r, WAIT) < SHORT + 0.3 && tOf(r, STEPIN) >= tOf(r, SPENT) && tOf(r, STEPIN) - tOf(r, SPENT) < 0.1 && cans(r) === 0),
      `… NO LONGER THAN THE ORDER'S ONE WAIT (thrHandWait, cut to ${SHORT} s for this line): 'on without … · the order's wait is spent', and they step in on that frame`, wLate.map(r => `waited ${(tOf(r, SPENT) - tOf(r, WAIT)).toFixed(2)} s · ${tellW(r)}`).join('\n    '));
    // (a door whose men are back before the second word comes has nothing left to send: it stepped in when they were back, as the line above)
    const early = (r: Run) => tOf(r, BACK) < r.tellT + AGAIN, sent = (r: Run) => has(r, NOTW) && !has(r, SPENT) && Math.abs(tOf(r, STEPIN) - (r.tellT + AGAIN)) < 0.1 && !(tOf(r, BACK) < tOf(r, STEPIN));
    verdict(wAgain.every(r => !r.why && has(r, WAIT) && cans(r) === 0 && (early(r) ? tOf(r, STEPIN) >= tOf(r, BACK) && !has(r, NOTW) : sent(r))) && wAgain.some(r => !early(r)),
      `… AND THE WORD AGAIN SENDS THEM AT ONCE (${AGAIN} s after the first): 'on without … · not waited for', 'step in' on that frame, before anybody is called back — on one of these doors at least; a door whose men were back before the second word stepped in then (which is which: printed)`, wAgain.map(r => `${early(r) ? 'BACK BEFORE THE SECOND WORD' : 'SENT BY THE SECOND WORD'} · ${tellW(r)}`).join('\n    '));
    verdict(qOn.every((r, k) => same(r, qOff[k]) && !has(r, RAN)),
      'NO GRENADE, the word plays beat for beat, to the frame, as with the grenade rule off', qOn.map((r, k) => `${line(r)}: ${r.beats.length} beats with the rule, ${qOff[k].beats.length} without`).join('\n    ')); }
  { const J = await import(`${ROOT}/src/game/journal.ts`), R = await stage('records-pair', 1), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g)));
    DOORTOOLS.thrNoCan = DOORTOOLS.thrFragHold = true; const old = snap(); delete old.tables.DOORTOOLS.thrNoCan; delete old.tables.DOORTOOLS.thrFragHold; J.applyKnobs(R.g, old); const before = [DOORTOOLS.thrNoCan, DOORTOOLS.thrFragHold];
    DOORTOOLS.thrNoCan = DOORTOOLS.thrFragHold = false; const own = snap(); own.tables.DOORTOOLS.thrNoCan = own.tables.DOORTOOLS.thrFragHold = true; J.applyKnobs(R.g, own); const carried = [DOORTOOLS.thrNoCan, DOORTOOLS.thrFragHold];
    verdict(before.every(x => x === false) && carried.every(x => x === true), 'A RECORDING FROM BEFORE THE KEYS replays with both rules off (journal.ts applyKnobs) — and a file that carries them keeps its own word', `no keys in the file: ${before.join(', ')} · the keys in the file, on: ${carried.join(', ')}`); }
  return done();
});

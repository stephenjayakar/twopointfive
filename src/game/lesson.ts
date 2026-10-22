// A LESSON: the Training group's levels (scene/scenarioList.ts rows with `group: 'training'`). A level file carries a `scenarios.lesson` block
// (scene/scenarios.ts LessonData): STEPS, each a line for the HUD's objective row naming the key, and a DONE-TEST read off the game's own state. The step's line
// moves on when the player has DONE the thing — never on a clock.
//
// WHAT IT IS NOT: a script. It moves nobody, spawns nothing, ends nothing and writes nothing the simulation reads (a step done asks for a checkpoint: `advance`) — a lesson is READ-ONLY over the game, so the
// same keys on a lesson level play the same run with it on or off (tools/qa/lesson-gate.ts holds the two digests equal for every Training level). The level under it is a real one of
// its kind — a quiet mission (quiet.ts) or a room clear (roomclear.ts) — with real guards on real routes; the scenario's own objective takes the row back after
// the last step and ends the run as it always does.
//
// LIVE = the switch on (`LESSON.on`; `?nolesson` off) ∧ the level carries the block ∧ a scenario is up on it (so the plain `?levelFile=x&solo` boot of a lesson
// level is that level's plain night, no lines) ∧ no show running. A level without the block: every entry point returns on its first line.
//
// THE TESTS (LESSON_TESTS below): plain records `{ is: '<kind>', … }`. Two families —
//   STATE, true while it holds:  in · near · flag · slot · pace · meter · stage · door · target · men · all · any, and by family —
//     hands: downed · body · calm   kit: reload · launcher · burst   squad: orderTo · stackOn · pairsOn · taken · following   the quiet partner: mate
//   DEEDS, counted from the moment the step came up:  did { what: 'act:<verb>' | 'event:<kind>' | 'chron:<kind>' | 'order:<id>', n?, on?: '<door>' } ·
//     threw (a can, the frag, the launcher's grenade) · word (F, the squad's word, over how many doors) · pair (the quiet pair's log)
// A new kind is one row of that table (its test, and its check against the built floor for checkLesson). Per-player state is asked of `g.player` through one
// accessor here (who()), so a second player is one place to change.
//
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { SideSet } from '../math/side';
import type { Game, Guard, Player } from './game';
import type { LessonData, LessonStep, LessonTest, Rect } from '../scene/scenarios';
import type { Vec3 } from '../math/vec';
import { PLAYER_ID } from './consts';
import { squadSilent } from './silent';
import { PAIR_LOG } from './pairorders';
import { hostileTo } from './teams';
import { WORLD } from '../scene/world';
import { HANDRING } from './handring';
import { CMDRING } from './cmdring';
/** a step's line that names the whistle's old key, and what it says while the whistle is the ring's last wedge (handring.ts): the page's words turn
 *  'Space' into the key the interaction is on */
const WHISTLE_LINE = /\bV whistles\b/g;
/** …and one that names the held list's wheel (the second row of a locked door is its second wedge) */
const WHEEL_LINE = /\bHold Space, wheel to kick, let go\b/g, WHEEL_RING = 'Hold Space, then 2 kicks it';
/** a step's line as the HUD's row says it now */
export const lessonLine = (line: string): string => HANDRING.on ? line.replace(WHISTLE_LINE, `Space held, then ${CMDRING.wedges}, whistles`).replace(WHEEL_LINE, WHEEL_RING) : line;
import { railsFaults, RAILS } from './rails';   // (railsFaults is called inside checkLesson only, the switch read inside `data`)
import { camCap } from '../host/keymap';
import { wallPt } from './wallcharge';   // (called inside a flag only)
import { SLOTSETUP } from './slotsetup';

/** the switch: off = a lesson level plays as its scenario alone, no lines (and nothing here runs) */
export const LESSON = { on: true };
export const LESSON_STATS = { started: 0, steps: 0, finished: 0 };

/** what a step has seen since it came up (the deeds): counts by `what` */
interface StepSeen { t0: number; n: Map<string, number>; chron: number; heard: WeakSet<object>; held: number;
  /** where the step began in the logs that are TRIMMED from the front (orders.log, pairorders.ts PAIR_LOG): the last row there was then, by identity */
  lastOrder: object | null; lastPair: object | null;
  /** the chronicle row the step began at, and the row G was first seen held at (-1: not yet) — the kit's `threw` */
  chron0: number; heldAt: number;
  /** the doors the word (F) has let go since the step came up — the squad's `word` */
  words: Set<object>;
  /** the seat's view as the step found it and how far it has been turned since, radians summed (the rails' `view`) */
  yaw0: number; dist0: number; yawLast: number; turned: number }
type TestFn = (g: Game, t: LessonTest, S: StepSeen) => boolean;
/** a test kind: `ok` = is it true now; `check` = what is wrong with this record on this floor (null: nothing) */
interface TestKind { ok: TestFn; check?: (g: Game, t: LessonTest) => string | null }

/** one test asked, safely: an unknown kind or a record the checker would refuse (a hand-edited file) is never true and never throws into the game's frame */
const BAD = new SideSet<object>('lesson.BAD');
function passes(g: Game, t: LessonTest, S: StepSeen): boolean {
  try { return !!LESSON_TESTS[t?.is]?.ok(g, t, S); }
  catch (x) { if (!BAD.has(t)) { BAD.add(t); console.error(`lesson: test '${String(t?.is)}' threw (${(x as Error).message}) — it never passes; lesson-check names the fault`); } return false; }
}
/** the first row of a front-trimmed log that came after `last` (0: `last` is gone, or there was none) */
function after(log: readonly object[], last: object | null): number { let k = log.length; while (k > 0 && log[k - 1] !== last) k--; return k; }
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const rect = (v: unknown): v is Rect => !!v && typeof v === 'object' && num((v as Rect).x0) && num((v as Rect).x1) && num((v as Rect).z0) && num((v as Rect).z1) && (v as Rect).x0 < (v as Rect).x1 && (v as Rect).z0 < (v as Rect).z1;
const vec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(num);
const inside = (R: Rect, p: Vec3) => p[0] > R.x0 && p[0] < R.x1 && p[2] > R.z0 && p[2] < R.z1;
/** the player a lesson is taught to (one seat today) */
const who = (g: Game): Player => g.player;
type PairSel = 'all' | 'red' | 'blue';
/** the door a teammate is on a plain 'stack up' on (orders.ts Assignment), by name; null: none */
const onStack = (g: Game, m: Guard): string | null => { const A = g.orders.of(m); return A && A.order === 'stack' && A.door ? A.door.def.name : null; };
/** a man who is no longer on his feet: dead, or out cold (the floor keeps both as state 'dead') */
const downed = (x: Guard) => x.state === 'dead';
/** the one partner of a quiet pair (the first operative unit on his feet; null: none) */
const partnerOf = (g: Game): Guard | null => g.guards.find(x => !!x.unit && x.team === 'operative' && x.state !== 'dead') ?? null;
/** what a `pair` test may count (the first words of pairorders.ts PAIR_LOG rows) */
const PAIR_WHATS = ['mark', 'now', 'set', 'go', 'go:F', 'go:hands', 'down'];

/** the flags a `flag` test can read off the player (and the team's posture): each true while it holds */
const FLAGS: Record<string, (g: Game) => boolean> = {
  crouch: g => who(g).crouch,
  sprint: g => who(g).sprinting,
  wall: g => !!who(g).wall,                                   // back to a wall (Q)
  peek: g => (who(g).wall?.peek ?? 0) > 0.5,                  // …and leaning out of its open end
  nv: g => who(g).nv,                                         // night vision down (N)
  light: g => { const p = who(g); return (p.pistolUp && p.pistol.lightOn) || (p.rifleUp && p.rifle.lightOn); },   // the weapon light of the gun in hand (L)
  holstered: g => who(g).holstered,                           // hands empty (E)
  gun: g => !!who(g).gunInHand(),                             // a gun in the hands
  ringsOut: g => who(g).rifle.rings <= 0,                     // the launcher's ring airfoils are spent (the honest other way past a step that asks for one)
  shellsOut: g => who(g).rifle.shells <= 0,                   // …and its 40 mm grenades
  auto: g => who(g).rifle.mode !== 'semi',                              // the rifle's selector on AUTO (Z)
  dragging: g => !!who(g).dragging,
  dark: g => g.blackout.active,                               // the mains are off (the breaker thrown, by whoever threw it)
  chargeSet: g => (g.wallCharge?.set.length ?? 0) > 0,        // a wall charge is on a wall, waiting on the trigger
  // …on the wall the step's mark is on (a step with none: any wall), with nobody of the squad inside its reach (they have stood off)
  chargeClear: g => { const W = g.wallCharge, c = W?.set[0], at = g.lesson?.step?.at; if (!c || W.tooClose(c).length) return false; if (!at) return true;
    const p = wallPt(c.wall, 0, 0); return (c.wall.alongX ? Math.abs(p[2] - at[2]) : Math.abs(p[0] - at[0])) < 0.4 && Math.hypot(p[0] - at[0], p[2] - at[2]) < 4; },
  wallBlown: g => (g.wallCharge?.stats.holes ?? 0) > 0,       // …and one has made its hole this run
  holding: g => !!who(g).holding,                             // a man in his arm
  picking: g => !!who(g).picking,
  coding: g => !!who(g).coding,
  menu: g => !!g.orders?.menu,                                // the order menu is up (X)
  silent: g => squadSilent(g),                                // the squad's posture is SILENT
};

// ---- the test kinds. KEEP each family's rows together and a blank line between families: parts add rows side by side ----
export const LESSON_TESTS: Record<string, TestKind> = {
  // -- where he is
  in: { ok: (g, t) => inside(t.area as Rect, who(g).char.pos), check: (g, t) => !rect(t.area) ? 'area: a rect { x0, x1, z0, z1 }' : freeIn(g, t.area) ? null : 'area: no free floor inside it' },
  near: { ok: (g, t) => { const p = who(g).char.pos, a = t.at as Vec3; return Math.hypot(p[0] - a[0], p[2] - a[2]) < ((t.r as number) ?? 1.2); }, check: (_g, t) => !vec(t.at) ? 'at: a Vec3' : t.r !== undefined && !num(t.r) ? 'r: metres' : null },

  // -- what he is doing / carrying
  flag: { ok: (g, t) => FLAGS[t.flag as string](g) === ((t.value as boolean | undefined) ?? true), check: (_g, t) => FLAGS[t.flag as string] ? null : `flag: one of ${Object.keys(FLAGS).join(', ')}` },
  slot: { ok: (g, t) => { const p = who(g); return p.slot === t.slot && (t.drawn === undefined || !p.holstered === t.drawn); }, check: (_g, t) => ['pistol', 'rifle', 'smoke', 'flash', 'frag'].includes(t.slot as string) ? null : 'slot: pistol, rifle, smoke, flash or frag' },
  pace: { ok: (g, t) => band(who(g).pace, t), check: (_g, t) => bandCheck(t) },
  meter: { ok: (g, t) => band(t.which === 'noise' ? who(g).noise : who(g).visibility, t), check: (_g, t) => t.which !== 'light' && t.which !== 'noise' ? "which: 'light' or 'noise'" : bandCheck(t) },

  // -- the world
  stage: { ok: (g, t) => STAGES.indexOf(g.mission.stage) >= STAGES.indexOf(t.stage as string) && g.mission.stage !== 'failed', check: (_g, t) => STAGES.includes(t.stage as string) && t.stage !== 'infiltrate' ? null : 'stage: drive (the place reached), exfil (the thing taken) or done' },
  door: { ok: (g, t) => { const d = g.doors.byName(t.door as string); if (!d) return false; const s = t.state; return s === 'open' ? !d.isClosed() : s === 'shut' ? d.isClosed() : s === 'unlocked' ? !d.locked || d.lockBroken : d.lockBroken; },
    check: (g, t) => !g.doors.byName(t.door as string) ? `door: no door named '${String(t.door)}'` : ['open', 'shut', 'unlocked', 'broken'].includes(t.state as string) ? null : 'state: open, shut, unlocked or broken' },
  target: { ok: (g, t) => { const x = g.targets.find(y => y.name === t.name); return !!x && (x.on && !x.broken && x.factor > 0.05) === t.on; },   // a fixture / a device as the eye has it: lit, or dark (switched off, shot out, under the OCP's spell, the mains down)
    check: (g, t) => !g.targets.some(y => y.name === t.name) ? `name: no light or device named '${String(t.name)}'` : typeof t.on !== 'boolean' ? 'on: true or false' : null },
  men: { ok: (g, t) => g.guards.filter(x => hostileTo(x, 'player') && downed(x)).length >= ((t.down as number) ?? 1), check: (_g, t) => t.down === undefined || (num(t.down) && t.down >= 1) ? null : 'down: how many, ≥ 1' },

  // -- deeds, counted since the step came up
  // (an order may name the DOOR it was given on: `on: '<door name>'` — "stack up on the first hut's door" is not passed by a stack on another)
  did: { ok: (_g, t, S) => (S.n.get(t.on === undefined ? t.what as string : `${t.what}@door:${t.on}`) ?? 0) >= ((t.n as number) ?? 1),
    check: (g, t) => !(str(t.what) && /^(act|event|chron|order):[\w.-]+$/.test(t.what)) ? "what: 'act:<verb>', 'event:<kind>', 'chron:<kind>' or 'order:<id>'"
      : t.on === undefined ? null : !(t.what as string).startsWith('order:') ? 'on: only with an order' : !str(t.on) || !g.doors.byName(t.on as string) ? `on: no door '${t.on}'` : null },

  // -- (the hands' rows)
  // a man put down BY THE PLAYER'S HAND in this run, by the way it was done (the chronicle's own rows — combat.ts killGuard → chronDown): out cold by the
  // 'takedown' blow, the 'choke', the pistol 'whip' or a 'ring'; dead by the 'knife'
  downed: { ok: (g, t) => g.chronicle.events.filter(e => t.how === 'knife' ? e.kind === 'kill' && e.data?.weapon === 'knife' : e.kind === 'ko' && e.data?.method === t.how).length >= ((t.n as number) ?? 1),
    check: (_g, t) => !HOWS.includes(t.how as string) ? `how: one of ${HOWS.join(', ')}` : t.n === undefined || (num(t.n) && t.n >= 1) ? null : 'n: how many, ≥ 1' },
  // a body (a man down, dead or out cold) LIES inside the area, let go of
  body: { ok: (g, t) => g.guards.some(x => downed(x) && who(g).dragging !== x && inside(t.area as Rect, x.char.bones.hips ?? x.char.pos)), check: (g, t) => !rect(t.area) ? 'area: a rect { x0, x1, z0, z1 }' : freeIn(g, t.area) ? null : 'area: no free floor inside it' },

  // calm: the shift is on its beat — every hostile man still on his feet is in state 'patrol' (nobody looking for a noise, hunting or searching); `route` = only
  // the man of that patrol route (the level's own name for it). A man who is down no longer counts; with nobody left to ask it is true
  calm: { ok: (g, t) => g.guards.every(x => !hostileTo(x, 'player') || downed(x) || (t.route !== undefined && x.route?.name !== t.route) || x.state === 'patrol'),
    check: (g, t) => t.route === undefined || g.level.routes.some(r => r.name === t.route) ? null : `route: no patrol route named '${String(t.route)}'` },

  // -- (the lights', locks' and devices' rows)

  // -- (the guns' and the kit's rows)
  // reload: the gun in his hands is being reloaded (R) — true for the beat's length
  reload: { ok: g => { const p = who(g); return (p.pistolUp && p.pistol.reloading) || (p.rifleUp && p.rifle.reloading); }, check: () => null },
  // launcher: what the rifle's right button fires (2 again, with the rifle up, flips it): on 'ring' | 'he40' ('none' was a selection once: now it is true only of a long gun with no launcher, the shotgun); `fired` = …and the tube has just sent one (true while it cycles)
  launcher: { ok: (g, t) => { const p = who(g), r = p.rifle; return (r.attachment ?? 'none') === t.on && (!t.fired || (p.rifleUp && r.ringCd > 0)); },
    check: (_g, t) => !['ring', 'he40', 'none'].includes(t.on as string) ? "on: 'ring', 'he40' or 'none'" : t.fired !== undefined && typeof t.fired !== 'boolean' ? 'fired: true or false' : t.fired && t.on === 'none' ? 'fired: nothing is fired with no attachment on' : null },
  // burst: a string of n rounds (default 3) under one held trigger with the rifle's selector on AUTO — true while the string is still running
  burst: { ok: (g, t) => { const p = who(g); return p.rifleUp && p.rifle.automatic && p.rifle.autoIdx >= ((t.n as number) ?? 3); }, check: (_g, t) => t.n === undefined || (num(t.n) && t.n >= 2) ? null : 'n: how many rounds in the one string, ≥ 2' },
  // threw: a thing has left his hand since the step came up (the chronicle's 'thrown' row): `kind` 'smoke' | 'flash' (the stun can) | 'frag' | 'he40' (the launcher's
  // grenade) says which; `quick` = by G's quick-throw (G seen held with a can to throw, then a can gone)
  threw: { ok: (g, t, S) => { const ev = g.chronicle.events, from = t.quick ? S.heldAt : S.chron0; if (from < 0) return false;
      for (let i = Math.min(from, ev.length); i < ev.length; i++) if (ev[i].kind === 'thrown' && (t.kind === undefined || ev[i].data.kind === t.kind)) return true;
      return false; },
    check: (_g, t) => t.kind !== undefined && !['smoke', 'flash', 'frag', 'he40'].includes(t.kind as string) ? "kind: 'smoke', 'flash', 'frag' or 'he40'" : t.quick !== undefined && typeof t.quick !== 'boolean' ? 'quick: true or false' : t.quick && (t.kind === 'frag' || t.kind === 'he40') ? 'quick: G throws only smoke and the stun can' : null },

  // -- (the squad's rows: orders, door tools, two pairs): who the orders go to, a pair stacked on a door, the word, a room of the structure taken, the squad falling in
  orderTo: { ok: (g, t) => !!g.orders?.active && g.orders.who === t.who, check: (_g, t) => t.who === 'all' || t.who === 'red' || t.who === 'blue' ? null : "who: 'all', 'red' or 'blue'" },
  stackOn: { ok: (g, t) => { const men = g.orders?.active ? g.orders.men((t.who as PairSel | undefined) ?? 'all') : []; return men.length > 0 && men.every(m => onStack(g, m) === t.door && (!t.set || !!g.orders.of(m)?.arrived)); },   // every living man of them is on a 'stack up' on that door (`set`: and stands on his mark)
    check: (g, t) => !g.doors.byName(t.door as string) ? `door: no door named '${String(t.door)}'` : t.who === undefined || t.who === 'all' || t.who === 'red' || t.who === 'blue' ? null : "who: 'all', 'red' or 'blue'" },
  pairsOn: { ok: (g, t) => { if (!g.orders?.active) return false; const doors = new Set<string>();   // pairs stacked whole, each on its door: how many DIFFERENT doors
      for (const id of g.orders.pairs()) { const men = g.orders.men(id), d = men.length ? onStack(g, men[0]) : null; if (d && men.every(m => onStack(g, m) === d)) doors.add(d); }
      return doors.size >= ((t.doors as number) ?? 2); }, check: (_g, t) => t.doors === undefined || (num(t.doors) && t.doors >= 1) ? null : 'doors: how many different doors, ≥ 1' },
  word: { ok: (_g, t, S) => S.words.size >= ((t.doors as number) ?? 1),   // the word given since the step came up (doortools.ts goMen: its beat on every order it let go), over how many doors — kept once seen: the order it let go ends and leaves the list
    check: (_g, t) => t.doors === undefined || (num(t.doors) && t.doors >= 1) ? null : 'doors: how many doors go on it, ≥ 1' },
  taken: { ok: (g, t) => !!g.roomClear?.active && !!g.roomClear.rooms.find(r => r.def.id === t.room)?.cleared, check: (g, t) => g.level.scenarios?.roomClear?.rooms.some(r => r.id === t.room) ? null : `room: no room '${String(t.room)}' in the level's roomClear block` },
  following: { ok: g => { const men = g.orders?.active ? g.orders.men('all') : []; return men.length > 0 && men.every(m => g.orders.of(m)?.order === 'fallIn'); } },   // every living teammate is on 'fall in'

  // -- (the quiet partner's rows)
  // mate: where the ONE partner is — any of `area` (a rect he stands in), `at` (+ `r`, default 1.5 m), `by` (within that many metres of the player), `away` (further
  // than that from him); all that are given must hold. False with no partner on his feet.
  mate: { ok: (g, t) => { const m = partnerOf(g); if (!m) return false; const p = m.char.pos, s = who(g).char.pos, d = Math.hypot(p[0] - s[0], p[2] - s[2]);
      return (t.area === undefined || inside(t.area as Rect, p)) && (t.at === undefined || Math.hypot(p[0] - (t.at as Vec3)[0], p[2] - (t.at as Vec3)[2]) < ((t.r as number) ?? 1.5)) && (t.by === undefined || d < (t.by as number)) && (t.away === undefined || d > (t.away as number)); },
    check: (g, t) => t.area === undefined && t.at === undefined && t.by === undefined && t.away === undefined ? 'one of area (a rect), at (a Vec3, + r), by (metres from the player), away (metres)'
      : t.area !== undefined && !rect(t.area) ? 'area: a rect { x0, x1, z0, z1 }' : t.area !== undefined && !freeIn(g, t.area as Rect) ? 'area: no free floor inside it' : t.at !== undefined && !vec(t.at) ? 'at: a Vec3'
      : [t.r, t.by, t.away].some(v => v !== undefined && !(num(v) && v > 0)) ? 'r / by / away: metres, > 0' : null },
  // pair: the quiet pair's own deeds since the step came up, read off pairorders.ts's log by the row's first word(s): 'mark' (take him on your mark, given) ·
  // 'now' (take him now, given) · 'set' (he is behind his man, waiting) · 'go' (the mark: 'go:F' the key, 'go:hands' the player's own hands on a man) · 'down' (the partner put a man out)
  pair: { ok: (_g, t, S) => { let n = 0; for (let i = after(PAIR_LOG, S.lastPair); i < PAIR_LOG.length; i++) if (PAIR_LOG[i].what.startsWith(t.what as string)) n++; return n >= ((t.n as number) ?? 1); },
    check: (_g, t) => !PAIR_WHATS.includes(t.what as string) ? `what: one of ${PAIR_WHATS.join(', ')}` : t.n === undefined || (num(t.n) && t.n >= 1) ? null : 'n: how many, ≥ 1' },

  // -- several at once
  // ---- a rails level's (rails.ts) ----
  cue: { ok: (g, t) => !!g.rails?.cued(t.name as string), check: (_g, t) => str(t.name) ? null : 'name: the beat the level\'s script ends with c.signal(\'done:<name>\')' },   // the level's script has played a beat out
  view: { ok: (g, t, S) => (t.turned === undefined || S.turned * 180 / Math.PI >= (t.turned as number)) && (t.zoomed === undefined || Math.abs(Math.log(g.seat.cam.distance / S.dist0)) >= Math.log(t.zoomed as number)) && (t.panned === undefined || (g.rails?.panned() ?? 0) >= (t.panned as number)),   // the seat's own view since the step came up: turned by so many degrees in all, zoomed by this ratio either way, shifted this far off the squad (the sky seat)
    check: (_g, t) => t.turned === undefined && t.zoomed === undefined && t.panned === undefined ? 'turned (degrees), zoomed (a ratio over 1) and / or panned (metres)' : (t.turned !== undefined && !num(t.turned)) || (t.panned !== undefined && !num(t.panned)) || (t.zoomed !== undefined && !(num(t.zoomed) && t.zoomed > 1)) ? 'turned, panned: numbers · zoomed: a ratio over 1' : null },
  // squad: the teammates on their feet stand inside `area`, all of them (or `n` of them): where an order has taken them
  squad: { ok: (g, t) => { const men = g.guards.filter(x => x.unit && x.team === 'operative' && x.state !== 'dead'), inn = men.filter(m => inside(t.area as Rect, m.char.pos)).length; return men.length > 0 && inn >= Math.min(men.length, (t.n as number) ?? men.length); },
    check: (g, t) => !rect(t.area) ? 'area: a rect { x0, x1, z0, z1 }' : !freeIn(g, t.area as Rect) ? 'area: no free floor inside it' : t.n === undefined || (num(t.n) && t.n >= 1) ? null : 'n: how many, ≥ 1' },
  all: { ok: (g, t, S) => (t.of as LessonTest[]).every(u => passes(g, u, S)), check: (g, t) => ofCheck(g, t) },
  any: { ok: (g, t, S) => (t.of as LessonTest[]).some(u => passes(g, u, S)), check: (g, t) => ofCheck(g, t) },
};
const STAGES: string[] = ['infiltrate', 'drive', 'exfil', 'done'];
const HOWS: string[] = ['takedown', 'choke', 'whip', 'ring', 'knife'];
function band(v: number, t: LessonTest): boolean { return (t.below === undefined || v < (t.below as number)) && (t.above === undefined || v > (t.above as number)); }
function bandCheck(t: LessonTest): string | null { return (t.below === undefined && t.above === undefined) || (t.below !== undefined && !num(t.below)) || (t.above !== undefined && !num(t.above)) ? 'below and / or above: numbers' : null; }
function ofCheck(g: Game, t: LessonTest): string | null { if (!Array.isArray(t.of) || !t.of.length) return 'of: a non-empty list of tests'; for (const u of t.of as LessonTest[]) { const why = testFault(g, u); if (why) return why; } return null; }
function freeIn(g: Game, R: Rect): boolean { const nav = g.col.nav; for (let x = R.x0 + 0.2; x < R.x1; x += 0.3) for (let z = R.z0 + 0.2; z < R.z1; z += 0.3) if (!nav.isBlocked(x, z)) return true; return false; }
/** what is wrong with one test record on this floor (null: nothing) */
export function testFault(g: Game, t: LessonTest): string | null {
  if (!t || typeof t !== 'object' || !str(t.is)) return "a test is a record { is: '<kind>', … }";
  const K = LESSON_TESTS[t.is]; if (!K) return `no test kind '${t.is}' (${Object.keys(LESSON_TESTS).join(', ')})`;
  const why = K.check?.(g, t) ?? null; return why ? `${t.is} — ${why}` : null;
}

/** a checkpoint's slice of a lesson */
export interface LessonSnap { i: number; done: [string, number][] }

export class Lesson {
  /** the step that is up (= steps.length once every step is done) */
  i = 0;
  /** game time each step was done at, by id — the scripted run and the probes read it */
  doneAt = new Map<string, number>();
  log: string[] = [];
  private seen: StepSeen | null = null;
  private run: object | null = null;   // the Mission this pass belongs to: a fresh one (restartEncounter) starts the lesson over
  constructor(private g: Game) {}

  /** the lesson in force (null: not live) */
  get data(): LessonData | null {
    const g = this.g; if (!LESSON.on) return null;
    const L = g.level.scenarios?.lesson; if (!L?.steps?.length) return null;
    if (L.rails && !RAILS.on) return null;   // (a tutorial mission's steps are written for the frame — a seat, locks, cues: with its switch off the level is its mission alone)
    if (g.touring || g.quietUtility || g.puppet) return null;
    return g.quiet?.active || g.roomClear?.active || g.nightBreach?.active || g.rescue?.active ? L : null;
  }
  /** the step that is up for THE MISSION THAT IS RUNNING: `i` is the last pass's until tick() has met a fresh Mission (a restart between frames), and that
   *  pass's step is nobody's — not the row's, not a checkpoint's. A fresh run is on its first step. */
  private get at(): number { return this.run === this.g.mission ? this.i : 0; }
  /** the index of the step that is up for the mission that is running (rails.ts asks this, never `i`) */
  get index(): number { return this.at; }
  get step(): LessonStep | null { return this.data?.steps[this.at] ?? null; }
  get finished(): boolean { const L = this.data; return !!L && this.at >= L.steps.length; }

  /** once a frame (game.ts, after updateMission: this frame's Space verb, hearing events, chronicle rows and orders are all in) */
  tick(dt: number) {
    const L = this.data; if (!L) return;   // (switched off or stood down for a frame: its place is kept — only a fresh Mission starts it over)
    const g = this.g;
    if (this.run !== g.mission) { this.run = g.mission; this.i = 0; this.doneAt.clear(); this.seen = null; this.log.length = 0; LESSON_STATS.started++; this.note(`lesson '${L.title}': ${L.steps.length} steps`); }
    if (this.i >= L.steps.length || g.mission.stage === 'failed' || who(g).down) return;
    const S = this.seen ??= this.fresh(1e-6);   // (the run's first step, or the first after a load: this frame's own deeds are in)
    this.count(S);
    const T = L.steps[this.i];
    if (passes(g, T.done, S)) { S.held += dt;   // (an unknown kind never passes: checkLesson names it)
      if (S.held > (T.hold ?? 0) || !(T.hold ?? 0)) this.advance(L, T); } else S.held = 0;
  }
  private advance(L: LessonData, T: LessonStep) {
    const g = this.g; this.doneAt.set(T.id, g.time); this.i++; this.seen = this.fresh(); LESSON_STATS.steps++;   // (the next step counts from THIS frame's end: a deed on its first frame is its own)
    this.note(`done ${this.i}/${L.steps.length} '${T.id}'`);
    if (this.i >= L.steps.length) { LESSON_STATS.finished++; this.note('every step done'); }
    // A STEP DONE ASKS FOR A CHECKPOINT, by the autosave's own road (savestate.ts Checkpoints.request), so its gates decide when and whether: nobody alert or
    // searching, nothing in his hands half done, ten seconds since the last save; steps done inside one wait are one save, labelled with the step then up. The
    // floor's own triggers (the stage, a new room, a body hidden, 90 s of quiet) can all stay silent for minutes of a lesson on one yard, and a down then cost
    // the whole of it. Still read-only over the run: a save writes its chronicle row and nothing else, and the digest leaves that row out (digest.ts).
    if (g.rails?.live) return;   // (a rails level's checkpoints are authored, one a beat: rails.ts asks for them by the step's own key)
    g.saves.request(g, 'lesson', this.i < L.steps.length ? `training ${this.i + 1}/${L.steps.length}` : 'training done');
  }
  private fresh(back = 0): StepSeen { const g = this.g, lg = g.orders?.log ?? [], ev = g.chronicle.events.length;
    return { t0: g.time - back, n: new Map(), chron: ev, chron0: ev, heldAt: -1, lastOrder: lg[lg.length - 1] ?? null, lastPair: PAIR_LOG[PAIR_LOG.length - 1] ?? null, words: new Set(), heard: new SideSet(), held: 0, yaw0: g.seat.cam.yaw, dist0: g.seat.cam.distance, yawLast: g.seat.cam.yaw, turned: 0 }; }
  /** this frame's deeds into the step's counts */
  private count(S: StepSeen) {
    const g = this.g, add = (k: string) => S.n.set(k, (S.n.get(k) ?? 0) + 1);
    if (g.rails?.fresh) { S.yaw0 = S.yawLast = g.seat.cam.yaw; S.dist0 = g.seat.cam.distance; S.turned = 0; }   // (a tutorial mission staged again: its view is set back in the run's first ticks, and that is no turn of the hand's)
    { const y = g.seat.cam.yaw; let d = y - S.yawLast; d = Math.atan2(Math.sin(d), Math.cos(d)); S.turned += Math.abs(d); S.yawLast = y; }   // (the rails' `view`: read off the tick's record, like every other deed)
    if (g.act?.verb && !who(g).down) add(`act:${g.act.verb}`);
    for (const e of g.events) { if (e.who !== PLAYER_ID || e.time <= S.t0 || S.heard.has(e)) continue; S.heard.add(e); add(`event:${e.kind}`); }
    { const ev = g.chronicle.events; if (ev.length < S.chron) S.chron = ev.length; if (ev.length < S.chron0) S.chron0 = ev.length; for (; S.chron < ev.length; S.chron++) add(`chron:${ev[S.chron].kind}`);
      if (S.heldAt < 0 && who(g).throwHeld) S.heldAt = ev.length; }
    { const lg = g.orders?.log ?? [];   // (orders.ts trims this log from the front: the cursor is the last row counted, by identity)
      for (let k = after(lg, S.lastOrder); k < lg.length; k++) { add(`order:${lg[k].order}`); add(`order:${lg[k].order}@${lg[k].target}`); }
      if (lg.length) S.lastOrder = lg[lg.length - 1]; }
    for (const op of g.doorTools?.ops ?? []) if (!S.words.has(op.door) && op.beats.some(b => b.what === 'the word' && b.t > S.t0)) S.words.add(op.door);
  }

  /** a checkpoint's slice (savestate.ts): which step is up and when the ones before it were done. The deeds a step has counted are NOT filed: a loaded step
   *  counts from the load */
  snapshot(): LessonSnap { return { i: this.at, done: this.run === this.g.mission ? [...this.doneAt] : [] }; }   // (a save that lands on a fresh Mission before its first tick files step 1, never the last run's step)
  /** a checkpoint loaded (savestate.ts, after the mission slice): the file's place among the steps — a file without the slice (made with the lesson off)
   *  leaves the lesson stood down for that run: its world is mid-way, and step 1 over it could ask for a deed already done */
  restore(s: LessonSnap | undefined) {
    const L = this.data; if (!L) return;
    this.run = this.g.mission; this.seen = null; this.doneAt.clear(); this.i = L.steps.length;
    if (s && Number.isInteger(s.i) && s.i >= 0 && s.i <= L.steps.length) { this.i = s.i; for (const [id, t] of s.done ?? []) if (typeof id === 'string' && Number.isFinite(t)) this.doneAt.set(id, t); }
    this.note(`checkpoint loaded: step ${Math.min(this.i + 1, L.steps.length)}/${L.steps.length}`);
  }

  /** the run is over, whichever scenario it was: the quiet mission's stage, the player down, a room clear taken or the team wiped (roomclear.ts `end`) */
  private over(): boolean { const g = this.g; return g.mission.stage === 'failed' || g.mission.stage === 'done' || who(g).down || (!!g.roomClear?.active && !!g.roomClear.end); }
  /** The HUD's objective while a step is up (mission.ts objectiveText / objectivePos; null = the scenario's own: no lesson, or every step done) */
  objective(): { text: string; pos: Vec3 | null } | null {
    const L = this.data, i = this.at; if (!L || i >= L.steps.length) return null;
    if (this.over()) return null;   // (the run is over: the row is the scenario's own word on it)
    const T = L.steps[i];
    return { text: `training ${i + 1}/${L.steps.length} ▸ ${lessonLine(lineOf(T)).replace(/\[([^\]]+)\]/g, (_m, k: string) => k === 'Ctrl' ? camCap() : k)}`, pos: T.at ?? null };   // ('[B]': a key a tutorial mission's big line draws as a key — rails.ts; plain here. '[Ctrl]' is the camera's key, whichever it is: host/keymap.ts camCap)
  }
  summary(): string {
    const L = this.data; if (!L) return this.g.level.scenarios?.lesson ? (LESSON.on ? 'off · this level carries one (start its mission)' : 'off · switched off') : 'off · this level carries none';
    const i = this.at;
    return i >= L.steps.length ? `'${L.title}' · every step done (${L.steps.length})` : `'${L.title}' · step ${i + 1}/${L.steps.length} '${L.steps[i].id}': ${lineOf(L.steps[i])}`;
  }
  private note(s: string) { this.log.push(`${this.g.time.toFixed(2)} ${s}`); if (this.log.length > 80) this.log.splice(0, 40); }
}

/** a step's line as the keys stand: the gun's setup on (slotsetup.ts) moves the selector, the launcher's load and the light off their old keys; his own
 *  actions a ring (handring.ts) takes the whistle off its key */
const lineOf = (T: LessonStep): string => HANDRING.on && T.ringLine ? T.ringLine : SLOTSETUP.on && T.setupLine ? T.setupLine : T.line;
/** …and as the page says it: a tutorial mission's one big line (rails.ts prompt) is the same words as the row's */
export const stepLine = (T: LessonStep): string => lessonLine(lineOf(T));

// ---------------------------------------------------------------- the checker (tools/qa/lesson-check.ts; the probes): the block against the BUILT floor
/** Everything the level file's validator cannot say (scene/levelData.ts checks shapes): each test's kind and fields, its doors / lights / areas on this floor,
 *  a marker that is in the world. `g` is a Game stood up on the level. Returns the faults, each a line an author can act on. */
export function checkLesson(g: Game): string[] {
  const L = g.level.scenarios?.lesson, out: string[] = [];
  if (!L) return ['the level carries no scenarios.lesson block'];
  out.push(...railsFaults(L));   // (rails.ts: the frame's own keys — action names, cues)
  if (!g.level.scenarios?.quiet && !g.level.scenarios?.roomClear && !g.level.scenarios?.rescue && !g.level.scenarios?.nightBreach) out.push('the level carries a lesson and no scenario to run it over (scenarios.quiet / roomClear / rescue / nightBreach)');
  L.steps.forEach((T, i) => { const w = `steps[${i}] '${T.id}'`;
    const why = testFault(g, T.done); if (why) out.push(`${w}.done: ${why}`);
    if (T.line.length > 96) out.push(`${w}.line is ${T.line.length} characters: the objective row holds about 96`);
    if (T.setupLine && T.setupLine.length > 96) out.push(`${w}.setupLine is ${T.setupLine.length} characters: the objective row holds about 96`);
    if (T.at && !(T.at[0] > WORLD.min[0] && T.at[0] < WORLD.max[0] && T.at[2] > WORLD.min[2] && T.at[2] < WORLD.max[2])) out.push(`${w}.at (${T.at[0]}, ${T.at[2]}) is outside the world`); });
  return out;
}

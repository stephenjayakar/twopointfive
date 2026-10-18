// The NIGHT BREACH (?nightbreach, native --nightbreach, __nightbreach): a playtest scenario, not a showcase — Sam under the player's hands leads two AI operatives
// against three men barricaded in the break room, at night, with real rounds both ways. The question it exists to answer is whether going loud with a team is
// worth building a game round (SWAT 4 / Door Kickers in feel); it is staged on the old office with what the demo already has and nothing here is polished.
//
// WHAT IT IS MADE OF. The team's half is the daytime showcase's own drill (breach.ts BreachDrill, in its `live` mode): the pair wait on the plan's approach marks,
// run in and stack on Sam's FIRST order, and boot the leaf, put the stun charge in and flow to their corners on his SECOND — F both times. The defenders' half is the
// fight AI (guards.ts): three hostile units on the plan's marks, held and pinned there (they fire from where they stand and never come out), their guns on the door
// while they are calm, left entirely to their own eyes and ears — they hear the boot, are dazzled by the charge like anybody with eyes on it, and shoot back. The
// operatives fire the drill's controlled pairs, but only at a man they have a line to; everybody's rounds are fireWeapon's, and anybody they find goes down. A
// teammate down ends nothing while the other is up. Sam is his own man throughout: follow them in, take the north door, or stand in the aisle and watch.
//
// BLIND FIRE — what makes the default a fight (the `blindFire` knob, on). The demo's stun charge is the stealth game's: a man with eyes on it can neither see nor
// shoot for 2.9 to 5.1 s in this room, and the drill needs 2.5 s, so behind it the breach was a walkover the defenders never fired in; without it the team lost the
// doorway most of the time. With the knob on a dazzled defender does what a man covering a door does when a charge goes off in his face: he keeps his gun on the
// door and empties a burst down it without seeing anything (BLIND below: twelve rounds at the carbine's own cadence, each a real round along his barrel inside a wide
// cone). The pair goes in on the bang, through that, so whether the point man is hit in the funnel is the rounds' own scatter, and a survivor finishes the room
// alone, or does not. The burst is a reflex with its moment: a round whose turn comes while he has his head down under somebody's fire (suppression.ts: pinned),
// is doubled over a ring, is in Sam's arm or has his gun down is never fired — so Sam's covering burst past the man facing the door, as it goes in, costs that man
// his rounds (headless: his and no other's; the two off the door's line still fire). A blind round's report tells his colleagues where the rounds are going,
// not where anybody is (FireOpts.blind). Knob off = the charge as the night game has it (the walkover); `stun` off = boot and go.
//
// THE STAGING, AND GETTING OUT OF IT. start() benches the shift the way the Director benches it for the day showcase (off Game.guards, torches out of the light set:
// the staff are neutral to both sides — teams.ts — and the character budget is eight with bodies) and restarts the encounter; restartEncounter's last act while the
// scenario is up is onEncounterRestart() here, which stages the cast on the fresh floor. So ANY restart under it — Sam down and Enter, the pause card, restage() —
// stages it again with no caller knowing about it, and a bare resetGuards (the panel's, a console's: the cast are units, it despawns them) is noticed by tick() and
// answered with a full restart. While it is up the civilians are not spawned and the response team and the cameras / tripwires are silent (one-line gates on
// `nightBreach.active` in civilians.ts / qrf.ts / devices.ts — no Game.tune switch is written, so nothing a panel row saves can carry the scenario's state onto the
// machine). stop() puts the shift back and restarts the encounter as the night game has it. Checkpoints, the session journal and both showcases refuse while it is
// up (they refuse on any unit standing; savestate.ts canLoad asks this module too).
//
// KNOWN, BY DECISION: the operatives' controlled pairs are the drill's — gated on a line to the man (statics and leaves), not on light or smoke as the defenders'
// eyes are; and once inside they hold their corners (nobody follows Sam on to the next room).
//
// With the flag off none of this runs: Game.update's one call into tick() returns on its first line, and BreachDrill without `live` is the show's drill as it was.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load — the knobs are a plain literal.)
import { rollbackVar } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard, PairId } from './game';
import type { Input } from './input';
import type { FollowCamera } from './camera';
import { BreachDrill, type BreachLive } from './breach';
import { spawnUnit, despawnUnit } from './guards';
import { runnerFled } from './runner';   // (asked inside the ending checks only: false with its switch off)
import { HOLD } from './character';   // (read inside the tick only: HOLD.oneFacing)
import { endGuardScript, order } from './squad';
import { fireWeapon } from './combat';
import { SUPPRESSION } from './suppression';
import { kitStage } from './kit';
import { teamStartsFallenIn } from './startfile';
import { issueStage } from './issue';   // (type-only game imports: a level that issues its own wall charges — scenarios.roomClear.wallCharges)
import { picketMarks, postPicket } from './pressure';
import { gunDeal } from './gunroles';   // (called inside the staging only)
import type { TeamStart } from '../scene/scenarios';
import type { SquadSize } from './loadout';
import { OFFICE_SCENARIOS } from '../../levels/office.scenarios';   // (plain literals with type-only imports: safe at the top of the game's import cycle)
import { holdFireDrill } from './holdfire';   // (called inside order() only)
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)

/** The scenario's knobs (Tab ▸ Sandbox ▸ Night breach, __nightbreach.knobs; read at the next staging — 'restage' applies them). */
export const NIGHTBREACH = {
  /** the break room's own fluorescents (off = the room as the night has it: two vending machines) */
  roomLights: false,
  /** the operatives' weapon lights come on as they take the door */
  opLights: true,
  /** the defenders' weapon lights */
  defLights: false,
  /** #2 puts a stun charge in behind the boot (off = boot and go: the room is taken on speed alone, and it costs men) */
  stun: true,
  /** a dazzled defender empties a burst blind down the door he was covering (BLIND below — off = the charge as the night game has it: dazzled men stand and
   *  stare, and behind the charge the room is taken without a round from them) */
  blindFire: true,
  /** the men inside hear the door go in (off = the drill's boot is silent to them, as the showcase's always was) */
  loudBoot: true,
  /** where Sam stands when it is staged, and the way he faces: the LEVEL's (scene/scenarios.ts TeamStart — start() writes the team start of the level it stages
   *  on here; these are the office's until it has: beside the pair on the approach marks, in the cubicles' south aisle, facing east down it) */
  samAt: [...OFFICE_SCENARIOS.nightBreach.team.sam] as Vec3, samYaw: OFFICE_SCENARIOS.nightBreach.team.samYaw,
  /** how many teammates are staged: 2 = the pair, exactly as it always was · 4 = the FOUR-MAN SQUAD (?squad4): a RED pair and a BLUE pair (SQUAD4 below), each
   *  man's pair in his papers (Guard.unit.pair; orders.ts men() is the one place to ask for the squad, a pair or a man). Red is the first pair: F's drill on the
   *  breach plan's door is theirs, Blue stands by behind them until ordered; the order menu goes to all four, a pair or one man (orders.ts `who`: T).
   *  THE LOADOUT'S OTHER SIZES (game/loadout.ts; the page's ?squad=N): 3 = the four's first three (the red pair and Blue One) · 1 = Blue One alone and 0 = nobody,
   *  both with NO F drill even where the level has a breach plan (the drill takes two men): whoever came is the order menu's from the first frame. */
  squad: 2 as SquadSize,
};
/** The four-man squad's roster, in guard-list order (so in the order T walks it): the callsign, the pair, and the kit's two colours — the suit a shade toward the
 *  pair's colour and the mannequin's joints in it outright, so the pairs tell apart at a glance from above (colours UNSEEN on a GPU as of writing: taste values).
 *  Red's suit tint is a step up in value from where it began (0.13 0.065 0.06): worn — half way to the issue's dark neutral — it sat on the dark floor at night. */
export const SQUAD4: { name: string; pair: PairId; tint: Vec3; tint2: Vec3 }[] = [
  { name: 'Red One', pair: 'red', tint: [0.2, 0.085, 0.075], tint2: [0.55, 0.07, 0.05] },
  { name: 'Red Two', pair: 'red', tint: [0.2, 0.085, 0.075], tint2: [0.55, 0.07, 0.05] },
  { name: 'Blue One', pair: 'blue', tint: [0.06, 0.075, 0.13], tint2: [0.07, 0.2, 0.6] },
  { name: 'Blue Two', pair: 'blue', tint: [0.06, 0.075, 0.13], tint2: [0.07, 0.2, 0.6] },
];
/** With four teammates the floor holds more men than cast shadows: Sam + four + the layout's defenders (five in the room clear) = ten, inside the skinning's
 *  sixteen. spawnUnit is told so (UnitOpts.budget); the men past the eighth drawn go without shadow / reflection proxies, bodies first (game.ts). */
export const SQUAD4_BUDGET = 10;

const NONE: Guard[] = [];
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
/** Blind fire (the knob above): a dazzled defender's burst — `after` seconds from the flash (the flinch; `stagger` more per man, so each muzzle flash owns its
 *  frames), `rounds` turns `every` seconds apart (the AKS-74U's own 600 rpm), each along his barrel as it points that frame inside a cone of `spread` (fireWeapon's
 *  measure: ± half of it per axis — at the west door, four to six metres off, a spray a doorway and a half wide); a turn is lost, not kept, when he cannot take
 *  it — and a barrel pointing further down than `lowGun` (the sine of it: twelve degrees) is a gun that was never on the door. */
export const BLIND = { after: 0.3, stagger: 0.07, rounds: 12, every: 0.1, spread: 0.3, lowGun: 0.21 };

/** one defender's burst: the dazzle it answers (his dazzledUntil when it began), turns gone (fired or lost), next turn due */
export interface BlindBurst { until: number; n: number; next: number }
/** One defender's blind fire this frame (BLIND above; the hostage rescue's set defenders take the same turns — game/rescue.ts): while he is dazzled he keeps `door`,
 *  the entry he was covering, as his fix, and a flinch after the flash takes his burst's turns along his barrel (`k` staggers the men). Returns true when a round
 *  left the barrel. */
export function blindTurn(g: Game, h: Guard, k: number, B: BlindBurst, door: Vec3): boolean {
  if (h.state === 'dead' || g.time >= h.dazzledUntil) return false;
  if (h.dazzledUntil > B.until + 1e-6) { B.until = h.dazzledUntil; B.n = 0; B.next = g.time + BLIND.after + k * BLIND.stagger; }
  if (!h.held) h.lastKnown = [door[0], 0, door[2]];                         // (in Sam's arm his fix is not his own)
  if (B.n >= BLIND.rounds || g.time < B.next) return false;
  B.n++; B.next = g.time + BLIND.every;                                     // the turn is spent whether or not a round leaves the barrel
  const c = h.char;
  if (h.held || g.time < h.staggerUntil || c.gunDir[1] < -BLIND.lowGun) return false;   // in Sam's arm; doubled over a ring; a gun that is not up
  if (g.tune.suppression && (h.sup.v >= SUPPRESSION.pinned || h.sup.latched || h.sup.downT > 0)) return false;   // head down under fire (the alert branch's own crouch, gun lowered — or over the line this frame)
  if (!h.weapon.fire()) return false;                                       // dry or mid-reload (his reload is the fight AI's, at his next sighted pull)
  fireWeapon(g, c, v3.mad(c.muzzle, c.gunDir, 8), false, { steady: true, spread: BLIND.spread, blind: true });
  return true;
}

/** One defender's mark: where he stands, the point he keeps his gun on while he is calm and empties his blind burst at (the door he covers), and whether he is one
 *  of the men behind the DRILL's door (the breach plan's room: the F order's entry works against those — a man of another room is neither the drill's to engage nor
 *  on its list for calling the room). */
export interface NightBreachMark { pos: Vec3; aimAt: Vec3; name?: string; drill?: boolean; /** posted outside this room, his garrison's (pressure.ts PRESSURE.picket) */ picket?: object; }
/** A bigger floor for the same playtest (roomclear.ts — ?roomclear — hands one to start(); it lasts until stop()): what it is called, who the defenders are at
 *  each staging, a call once the cast stands on the fresh encounter, and the line the staging says. A layout calls its own rooms and its own ends, so the drill's
 *  'room clear' / 'failed' lines are left to it. None = the break room's three, off the breach plan, as ever. */
export interface NightBreachLayout { name: string; defenders(): NightBreachMark[]; staged?(): void; stagedLine?(): string;
  /** where the layout starts the team (absent = the level's night-breach start). On a level with NO breach plan a layout must give it with the teammates' marks:
   *  there is no F drill there — everybody is the order menu's from the first frame (roomclear.ts on a level of its own). */
  readonly team?: TeamStart;
  /** the character budget on this layout, where it holds more than five defenders (absent = eight with the pair, SQUAD4_BUDGET with the four) */
  readonly budget?: number; }

/** the team start NIGHTBREACH.samAt / samYaw were last written from (start()) */
let applied: TeamStart | null = OFFICE_SCENARIOS.nightBreach.team;   // (the knobs above ARE the office's: a knob moved by hand before the first start on the office stays moved)
rollbackVar('nightbreach.applied', () => applied, v => { applied = v; });   // (asked again by every staging, a restart inside a tick among them)

export type NightBreachState = 'off' | 'staged' | 'stacking' | 'set' | 'going' | 'inside' | 'clear' | 'failed' | 'recalled';

export class NightBreach {
  active = false;
  /** the knobs above, on the instance for the console (__nightbreach.knobs.stun = false; __nightbreach.restage()) */
  readonly knobs = NIGHTBREACH;
  drill: BreachDrill | null = null;
  ops: Guard[] = []; hostiles: Guard[] = [];
  /** the two men F's drill moves: the pair itself, or — of four — the first (Red) pair. The rest of `ops` are never the drill's: they stand by until ordered. */
  get drillOps(): Guard[] { if (this.noDrill) return NONE; const c = this.drillOf; if (c && c.of === this.ops && c.n === this.ops.length) return c.two; const two = this.ops.slice(0, 2); this.drillOf = { of: this.ops, n: this.ops.length, two }; return two; }
  private drillOf: { of: Guard[]; n: number; two: Guard[] } | null = null;   // (asked several times a frame: the two are found once per staging)
  /** the bigger floor this run was started on (start(layout); roomclear.ts) — null = the break room alone */
  layout: NightBreachLayout | null = null;
  /** every defender's mark as staged, in `hostiles` order (the breach plan's three, or the layout's) */
  marks: NightBreachMark[] = [];
  /** how many times it has been staged since start() (1 = the first; every restart under it adds one) */
  staged = 0;
  /** what happened when, on the game clock: 'staged', 'order:stack', 'order:go', then the drill's own beats as they land — what the probes read */
  log: { t: number; what: string }[] = [];
  private live: BreachLive = { orders: 0, lights: true, loudBoot: true, stun: true };
  /** staged on a level with no breach plan: there is no drill and F orders nothing (a layout brought the team's marks) */
  noDrill = false;
  /** 'go' took the drill's stun canister from the squad's count (doortools.ts) and it has not been called off */
  private bangTaken = false;
  /** blind fire, as staged (the knob) and each defender's burst: the dazzle it answers (his dazzledUntil when it began), turns gone (fired or lost), next turn due */
  private blind = false; private bursts: BlindBurst[] = [];
  /** blind rounds fired since the staging (the probes' count; the panel's line) */
  blindRounds = 0;
  private benched: Guard[] | null = null;
  private beatsSeen = 0; private said = new Set<string>();
  private cut = false;   // staged since the camera last saw it: the follow point is put on Sam at once, not glided there from wherever he was
  constructor(private g: Game) { }

  /** the team start in force: the layout's, else the level's own for the night breach (Level.scenarios.nightBreach) */
  private teamOf(layout: NightBreachLayout | null): TeamStart | undefined { return layout?.team ?? this.g.level.scenarios?.nightBreach?.team; }
  /** Sam's start knobs take the layout's team start — once per team-start OBJECT (a knob moved by hand since stays moved). Asked by start() and again by every
   *  staging: a layout may hand another start from one staging to the next (the room clear's ways in), and another Game's start may have written the knobs since. */
  private applyTeam(layout: NightBreachLayout | null) { const T = this.teamOf(layout); if (T && T !== applied) { applied = T; NIGHTBREACH.samAt = [...T.sam] as Vec3; NIGHTBREACH.samYaw = T.samYaw; } }
  /** why it cannot start right now (null = it can) — `layout`: the bigger floor it would be started on */
  canStart(layout: NightBreachLayout | null = null): string | null {
    const g = this.g, T = this.teamOf(layout);
    if (g.quiet?.active) return 'a quiet mission is up on this floor (quit it first)';   // (quiet.ts refuses the other way round: one scenario a floor)
    if (!T) return 'this level does not say where the team starts (its scenarios block)';
    if (!g.level.breach && !(layout && T.ops && T.ops.length >= 2)) return 'this level has no breach plan';   // (a layout that brings the teammates' marks stages without one: no F drill)
    if (g.level.breach && !g.doors.byName(g.level.breach.door)) return `the plan's door '${g.level.breach.door}' is not in the level`;
    if (!g.tune.teams) return 'sides are switched off (tune.teams)';
    if (!g.aiEnabled) return 'the AI is switched off (sandbox: no AI) — nobody would move';
    if (g.director?.run && !g.director.run.ended) return `the level script's program '${g.director.run.name}' is running`;
    if (g.touring || g.quietUtility || g.puppet) return 'a show is running';
    if (g.guards.some(x => x.unit)) return 'a spawned unit is already on the floor';
    return null;
  }
  /** Start the scenario: the floor cleared of everybody but the cast, a fresh encounter, the cast on its marks — the break room's, or `layout`'s bigger floor.
   *  Returns the reason when refused (or when the staging itself failed — then everything is put back as stop() puts it). */
  start(layout: NightBreachLayout | null = null): string | null {
    if (this.active) return null;
    const why = this.canStart(layout); if (why) return why;
    this.layout = layout;
    this.applyTeam(layout);
    this.bench();
    this.active = true; this.staged = 0; this.log.length = 0; this.failure = null;
    this.g.restartEncounter();   // a clean slate (nothing in the air, the level as authored, a full kit; the benched shift is off the list, so the fresh floor is empty) → onEncounterRestart stages
    return this.active ? null : (this.failure ?? 'the staging failed');
  }
  /** Stop it: the cast gone, the shift back on its routes, a fresh night encounter. */
  stop() {
    if (!this.active) return;
    const g = this.g;
    this.active = false; const was = this.layout?.name ?? 'night breach'; this.layout = null;   // (a layout lasts one run)
    this.drill?.end(); this.drill = null;
    for (const gd of [...this.ops, ...this.hostiles]) despawnUnit(g, gd);
    this.ops = []; this.hostiles = []; this.marks = [];
    if (this.benched) { for (const gd of this.benched) if (!g.engine.lights.lights.includes(gd.flashlight)) g.engine.lights.add(gd.flashlight); g.guards = [...this.benched, ...g.guards]; this.benched = null; }   // (the shift back on the list before the encounter is rebuilt from those very objects — director.ts restore does the same)
    g.restartEncounter();
    g.msg(WORDS.on && !g.level.routes.length ? `${was} off` : `${was} off — the night shift is back`);   // (a level with nobody on a route has no shift to come back)
  }
  /** A man stood on this floor AFTER the staging joins the defenders (stress.ts — extra enemies, off unless asked for): the lists a staged defender is in, so
   *  stop() and a restart take him away with the cast and the blind fire is his too. Nothing calls this in play. */
  adopt(gd: Guard, mark: NightBreachMark) { if (!this.active || this.hostiles.includes(gd)) return; this.hostiles.push(gd); this.marks.push(mark); this.bursts.push({ until: -1, n: 0, next: 0 }); }
  /** Stage it afresh (the knobs re-read): a restart of the encounter, which stages. */
  restage() { if (this.active) this.g.restartEncounter(); }
  /** restartEncounter's last act (game.ts): the scenario, while it is up, stages itself on the fresh encounter. A staging that throws (a budget, a plan the level
   *  lacks a piece of) ends the scenario cleanly rather than leaving it half up to throw again every frame. */
  onEncounterRestart() {
    if (!this.active) return;
    try { this.stage(); }
    catch (e) { const what = this.layout?.name ?? 'night breach'; this.failure = `the staging failed: ${e instanceof Error ? e.message : String(e)}`; console.error(`${what}:`, e); this.stop(); this.g.msg(`${what} — ${this.failure}`); }
  }
  private failure: string | null = null;

  /** the level's own men off the guard list for the scenario's length, torches out of the light set (they hang there otherwise: three steady slots) */
  private bench() {
    const g = this.g; const staff = g.guards.filter(x => !x.unit); if (!staff.length) return;
    for (const gd of staff) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
    this.benched = [...(this.benched ?? []), ...staff]; g.guards = g.guards.filter(x => !!x.unit);
  }
  /** Everybody on his mark, on the fresh encounter restartEncounter has just made (no unit standing, the level as authored, Sam at the spawn): the door (and the
   *  room's other door) shut, two operatives on the approach marks at the low ready, three hostiles inside held and pinned with their guns up, Sam beside the pair
   *  with the rifle in his hands. */
  private stage() {
    this.applyTeam(this.layout);
    const g = this.g, P = g.level.breach ?? null, K = NIGHTBREACH, NB = g.level.scenarios?.nightBreach, T = this.teamOf(this.layout);
    this.drill?.end(); this.drill = null; this.ops = []; this.hostiles = [];
    if (K.roomLights && NB?.lights) g.setGroup(NB.lights, true);   // (off = as authored — the restart has just put the room back as the night has it: the office's break room, two vending machines)
    const n = K.squad, four = n > 2, budget = four ? Math.max(SQUAD4_BUDGET, this.layout?.budget ?? 0) : this.layout?.budget;   // (three is the four less its last man: the same budget, the same roster)
    // where the teammates stand: the layout's own marks (a level whose structure brings its team start), else the breach plan's approach marks — and the way they face
    const mark = (i: number): Vec3 => { const p = this.layout?.team?.ops?.[i] ?? P?.from?.[i] ?? P?.stack[i] ?? T?.ops?.[i]; if (!p) throw new Error(`no mark for teammate ${i + 1} (the level's team start, or its breach plan)`); return p; };
    const yaw = (this.layout?.team ?? T)?.opsYaw ?? Math.PI / 2;
    if (!four) for (const i of [0, 1].slice(0, n)) this.ops.push(spawnUnit(g, { team: 'operative', pos: mark(i), yaw, name: i === 0 ? 'Blue One' : 'Blue Two', light: K.opLights, pair: 'blue' }));
    else {   // the first pair on the approach marks (the drill's), the second on the team start's third and fourth marks — or, with none given, a stride behind them on the nearest free floor
      const at: Vec3[] = [0, 1].map(i => v3.copy(mark(i))), more = this.layout?.team?.ops;
      for (const i of [0, 1].slice(0, n - 2)) at.push(more?.[2 + i] ? v3.copy(more[2 + i]) : this.standBy(at[i], [...at, K.samAt], yaw));
      SQUAD4.slice(0, n).forEach((m, i) => this.ops.push(spawnUnit(g, { team: 'operative', pos: at[i], yaw, name: m.name, light: K.opLights, pair: m.pair, tint: m.tint, tint2: m.tint2, budget })));
    }
    if (!this.layout && !P) throw new Error('no breach plan');
    this.marks = this.layout?.defenders() ?? P!.hostiles.map(h => ({ pos: h.pos, aimAt: h.aimAt }));
    const posted = this.layout ? picketMarks(g, this.marks, K.samAt) : this.marks;   // (hard, a structure of rooms: the first room's two do not share one flash — pressure.ts PRESSURE.picket; the same array when off)
    this.marks = posted;
    posted.forEach((h, i) => { const gd = spawnUnit(g, { team: 'hostile', pos: h.pos, yaw: v3.yawTo(h.pos, h.aimAt), name: h.name ?? `Tango ${i + 1}`, light: K.defLights, budget }); this.hostiles.push(gd); gd.hold = true; gd.pinned = true; if (h.picket) postPicket(gd, h.picket); });
    this.live = { orders: 0, lights: K.opLights, loudBoot: K.loudBoot, stun: K.stun }; this.bangTaken = false;
    this.blind = K.blindFire; this.bursts = this.hostiles.map(() => ({ until: -1, n: 0, next: 0 })); this.blindRounds = 0;
    g.fight.reset(); g.fight.blindFire = K.blindFire;   // the room fight (roomfight.ts) starts this staging with nothing remembered; the blind-fire knob is its to read now
    const drilled = !!P && this.ops.length >= 2;   // (the drill is two men's: one teammate, or none, and there is none — the plan's doors are shut here instead)
    this.noDrill = !drilled;
    if (P && !drilled) for (const id of [P.door, P.next?.door]) { const d = id ? g.doors.byName(id) : undefined; if (d) { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; } }
    if (P && drilled) {
      this.drill = new BreachDrill(g, P, this.ops[0], this.ops[1], this.hostiles.filter((_, i) => this.marks[i].drill !== false), { guaranteeDowns: false, live: this.live });   // (the drill's men: the ones behind ITS door)
      this.drill.start();
    }
    for (const gd of this.ops.slice(drilled ? 2 : 0)) {   // (a level with no breach plan has no drill: all of them stand by like this — the order menu's from the first frame)   // the second pair: stood at the low ready as the drill stands its own two (breach.ts start), on a script with no goal — the room fight's overlay covers them (roomfight.ts tickOp: any scripted operative), the X menu moves them
      gd.state = 'patrol'; gd.awareness = 0; gd.hold = false; gd.pinned = false;
      order(gd, { goal: null, face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false });
    }
    const pl = g.player;
    g.teleportPlayer(v3.copy(K.samAt)); pl.char.bodyYaw = pl.char.aimYaw = K.samYaw;
    if (pl.hasRifle) pl.slot = 'rifle'; pl.holstered = false;
    this.staged++; this.beatsSeen = 0; this.said.clear(); this.cut = true;
    this.layout?.staged?.();
    gunDeal(g, this.hostiles.map((gd, i) => ({ gd, watch: posted[i].aimAt })));   // (gunroles.ts: the cast's guns off the table, once the floor's doors stand as the mission opens with them — nobody is touched and no die is drawn with its switch off)
    kitStage(g, this.ops);   // each member's kit and uniform (kit.ts): the cards onto the men just staged — nothing written on a teammate while every card is as issued (your own four counts are, under the pouches rule: kitPlayer)
    issueStage(g);   // a mission that issues its own wall charges (issue.ts): after the kit, so the cards' own count is known; a level without the field = nothing
    teamStartsFallenIn(g, this.ops);   // the team starts fallen in (startfile.ts): the menu's own 'fall in', unspoken — F's drill takes its pair off it as it always took an ordered man
    this.note('staged');
    g.msg(this.layout?.stagedLine?.() ?? `night breach — ${NUMBER[this.marks.length] ?? this.marks.length} armed men hold the ${NB?.room ?? 'room'}. ${drilled ? 'F: stack up · X: orders' : this.ops.length ? 'X: your orders (door tools on any door)' : 'You are alone'}`);
  }
  /** a place for a man of the second pair: the free floor nearest a stride behind `lead` (the way they face: `yaw` — east on the office, so west of him), a
   *  body's room clear of everybody in `taken` and walkable from him */
  standBy(lead: Vec3, taken: Vec3[], yaw = Math.PI / 2): Vec3 {
    const g = this.g, nav = g.col.nav; let best: Vec3 | null = null, bs = Infinity;
    const want: Vec3 = [lead[0] - 1.2 * Math.sin(yaw), 0, lead[2] - 1.2 * Math.cos(yaw)];
    for (let r = 0; r <= 3.01; r += 0.3) { for (let k = 0; k < (r ? 12 : 1); k++) { const a = k * Math.PI / 6, q: Vec3 = [want[0] + Math.sin(a) * r, 0, want[2] + Math.cos(a) * r];
      if (nav.isBlocked(q[0], q[2]) || taken.some(t => v3.distXZ(t, q) < 0.9) || g.col.solidBlocked([lead[0], 0.45, lead[2]], [q[0], 0.45, q[2]])) continue;
      const s = r + 0.1 * v3.distXZ(q, lead); if (s < bs) { bs = s; best = q; } } if (best) break; }
    if (!best) throw new Error('no free floor behind the approach marks for the second pair');
    return best;
  }
  private note(what: string) { this.log.push({ t: this.g.time, what }); if (this.log.length > 400) this.log.splice(0, 100); }
  private once(key: string, text: string) { if (!this.said.has(key)) { this.said.add(key); this.g.msg(text); } }

  /** Sam's word (F): the first sends the pair to the stack, the second sends them in. Returns what the press did. */
  order(): 'stack' | 'go' | null {
    const D = this.drill; if (!this.active || !D) return null;
    if (this.g.player.down || D.phase === 'done') return null;
    if (this.live.orders === 0) { this.live.orders = 1; this.note('order:stack'); this.g.msg('you: stack up — side door'); return 'stack'; }
    if (this.live.orders === 1) { this.live.orders = 2; this.note('order:go'); holdFireDrill(this.g);   // (holdfire.ts: his word sends them in — the fight has started for everybody)

      if (this.live.stun) { if (this.g.doorTools.take('bang')) this.bangTaken = true; else { this.live.stun = false; this.g.msg('no bangs left — they go in without one'); } }   // (the drill's stun canister is one of the squad's counted ones: doortools.ts)
      this.g.msg(isNaN(D.tSet) ? 'you: go on set' : 'you: go'); return 'go'; }
    return null;
  }

  /** SQUAD ORDERS (orders.ts — the X command menu): is the drill moving the pair right now (from 'stack up' until the room is called or lost)? */
  get ownsPair(): boolean { const D = this.drill; return this.active && !!D && D.phase !== 'wait' && D.phase !== 'done'; }
  /** … and one of Sam's menu orders has come for a man the drill is moving: let go of the pair (null), or say why not. A stack not yet sent in is called off —
   *  the drill back to its wait, the orders back to none, F stacks them again; a pair inside the room is recalled (the drill ends there: 'recalled'); the
   *  seconds between 'go' and the first man through the door are nobody's to interrupt. */
  callOff(): string | null {
    const D = this.drill; if (!this.active || !D) return null;
    switch (this.state) {
      case 'stacking': case 'set': D.phase = 'wait'; D.tStack = D.tSet = NaN; this.live.orders = 0; this.said.delete('set'); this.note('order:off');
        if (this.bangTaken) { this.bangTaken = false; this.g.doorTools.refund('bang'); }   // ('go on set' took the can from the count; called off before the throw, it goes back)
        for (const o of this.drillOps) if (o.state !== 'dead' && o.script) order(o, { goal: null });   // both stop where they are: the man the order was not for does not walk on to the stack alone
        return null;
      case 'going': return 'committed — the breach is going in';
      case 'inside': D.phase = 'done'; D.tDone = D.t; D.beats.push({ t: D.t, what: 'recalled' }); return null;
      default: return null;
    }
  }

  /** Once a frame from Game.update, after the Director and before the guards move: a return on its first line while the scenario is off. */
  tick(dt: number, input: Input, cam: FollowCamera | null) {
    if (!this.active) return;
    const g = this.g;
    if ((!this.drill && !this.noDrill) || [...this.ops, ...this.hostiles].some(x => !g.guards.includes(x) && !runnerFled(x))) {   // the cast was despawned under it by something short of a restart (a bare resetGuards — the panel's reset, a console): a full restart, which stages
      g.restartEncounter(); if (!this.active || (!this.drill && !this.noDrill)) return;
    }
    if (this.cut && cam) { this.cut = false; cam.target = v3.copy(g.followPos()); cam.desired = v3.copy(cam.target); }
    const D = this.drill;
    if (D && input.hit('KeyF')) this.order();
    // the defenders: the fight AI's men, kept on their marks (held: no walking off to look at a noise; pinned: they fire from where they stand), and while they are
    // calm their chests — the gun follows — on the door they were told to watch
    // — with the room fight on (roomfight.ts, the default) none of that is done here: where each man looks, what his burst goes down and whether he stays are his
    // own read of what he has seen and heard, and this only keeps the count. ROOMFIGHT.on false = the branch as it was (plan-forced aims, the burst down the plan's door).
    const own = g.fight.on;
    if (!own) this.hostiles.forEach((h, i) => {
      if (h.state === 'dead') return;
      if (h.script) endGuardScript(h, h.state);
      h.hold = true; h.pinned = true;
      const m = this.marks[i]; if (m && h.state === 'patrol' && h.awareness < 0.3 && !(HOLD.oneFacing && h.held)) h.char.bodyYaw = v3.yawTo(h.char.pos, m.aimAt);
    });
    D?.tick(dt);
    if (own) this.blindRounds = g.fight.blindRounds; else if (this.blind) this.blindFire();
    if (!D) { if (!this.layout && this.hostiles.length && this.hostiles.every(h => h.state === 'dead' || runnerFled(h))) this.once('clear', 'room clear. Shift+Enter stages it again'); return; }   // (no breach plan on this level, or fewer than two teammates: no drill — the team is the order menu's, the layout keeps the score; the break room alone says its own end)
    for (; this.beatsSeen < D.beats.length; this.beatsSeen++) this.note(D.beats[this.beatsSeen].what);
    switch (this.state) {
      case 'set': this.once('set', 'stacked and set. F: go'); break;
      case 'clear': if (!this.layout) this.once('clear', 'room clear. Shift+Enter stages it again'); break;
      case 'recalled':   // (one of Sam's menu orders took a man out of the room mid-clear — orders.ts: the drill is over; a man it did not order is left as below)
      case 'failed':
        for (const o of this.drillOps) if (o.state !== 'dead' && o.script && !g.orders.has(o)) { endGuardScript(o, 'search'); o.hold = true; o.pinned = true; }   // (the drill is over with a man still up — the point man fell before the door went in: he is the fight AI's now, holding where he stands with his own eyes and ears, not a statue on a script)
        if (this.state === 'recalled') this.once('recalled', `breach called off — the ${this.ops.length > 2 ? 'squad' : 'pair'} takes your orders (X). Shift+Enter stages it again`);
        else if (!this.layout) this.once('failed', `${this.drillOps.every(o => o.state === 'dead') ? (this.ops.length > 2 ? 'the red pair down' : 'both men down') : 'point man down at the door'} — the room is yours to take${this.ops.length > 2 && this.ops.some(o => o.state !== 'dead') ? ' (the rest take your orders, X)' : ''}, or Shift+Enter stages it again`);
        break;
    }
  }

  /** BLIND FIRE (the head comment; BLIND above): every defender who is dazzled — the drill's charge, or one of Sam's own — keeps the door he was covering as his
   *  fix (the fight AI points a dazzled man's gun at his fix: left alone that becomes the spot the charge went off) and, a flinch after the flash, takes his burst's
   *  turns along his barrel. A charge that lengthens the dazzle of a man still dazzled is a fresh burst. Nothing from a dead man or one whose dazzle has run out;
   *  a turn that comes while he is held, doubled over a ring, head down under fire, gun down, dry or mid-reload is lost. Off with the sandbox's AI switch. */
  private blindFire() {
    const g = this.g; if (!g.aiEnabled) return;
    this.hostiles.forEach((h, k) => { const B = this.bursts[k], m = this.marks[k]; if (B && m && blindTurn(g, h, k, B, m.aimAt)) this.blindRounds++; });
  }

  /** The HUD's objective while the night breach is up BY ITSELF (mission.ts objectiveText / objectivePos — a layout's scenario, the room clear, words its own
   *  first; null = not this scenario's to say): the held room, a marker on the plan's door until the room is taken. Without it the line read the solo night's
   *  'reach the server room' with its diamond on the server door, all through a scenario about another room. */
  objective(): { text: string; pos: Vec3 | null } | null {
    if (!this.active || this.layout || !this.hostiles.length) return null;
    const g = this.g, P = g.level.breach, room = P?.room ?? 'room';
    const taken = this.hostiles.every(h => h.state === 'dead' || runnerFled(h));
    if (this.objOf && this.objOf.taken === taken) return this.objOf.o;
    const o = { text: taken ? `${room} taken — shift+enter stages it again` : `objective ▸ take the ${room}`, pos: taken ? null : (P ? g.doors.byName(P.door)?.frameCentre ?? null : null) };
    this.objOf = { taken, o }; return o;
  }
  private objOf: { taken: boolean; o: { text: string; pos: Vec3 | null } } | null = null;

  /** where the breach stands, in one word */
  get state(): NightBreachState {
    const D = this.drill; if (!this.active) return 'off';
    if (!D) return this.noDrill ? 'staged' : 'off';   // (a level with no breach plan: staged and never anything else — nothing here is ordered with F)
    if (D.phase === 'done') return D.beats.some(b => b.what === 'clear') ? 'clear' : D.beats.some(b => b.what === 'recalled') ? 'recalled' : 'failed';
    if (D.phase === 'wait') return 'staged';
    if (D.phase === 'approach') return 'stacking';
    if (D.phase === 'stack') return isNaN(D.tSet) ? 'stacking' : this.live.orders >= 2 ? 'going' : 'set';
    if (D.phase === 'enter' || D.phase === 'clear') return 'inside';
    return 'going';
  }
  /** one line for the panel / the console */
  summary(): string {
    if (!this.active) return 'night breach off';
    const up = (l: Guard[]) => l.filter(x => x.state !== 'dead').length;
    return `night breach ${this.state} · orders ${this.live.orders}/2 · team ${up(this.ops)}/${this.ops.length} up · defenders ${up(this.hostiles)}/${this.hostiles.length} up${this.blindRounds ? ` · ${this.blindRounds} blind rounds` : ''} · staged ×${this.staged}`;
  }
}

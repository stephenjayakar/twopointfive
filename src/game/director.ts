// The DIRECTOR: a level's bespoke scripting, run on the game clock (docs/design/level-scripting.md — milestone M1; the notebook is docs/internal/director.md).
// ONE LEVEL HAS A SCRIPT TODAY: the first tutorial mission's (levels/tut-sky.script.ts, attached by scene/levelLoad.ts off scene/levelScripts.ts; its one play
// program 'tutorial' is started by game/rails.ts, and only with that switch on). The office's (the night and day showcases, its programs 'night' and 'breach')
// was removed with the two showcases, so on every other level the Director has no manifest and idles (tick() returns on its first line); the checks stage
// scripts of their own (tools/qa/director-probes.ts).
// A level's script is a plain function `(D: DirectorApi) => void` that imports NOTHING from src/ at run time (`import type` only —
// the API is injected), so the same file can be transpile-served and hot-swapped later (M3) and its define pass runs under bun with no Game (the lint below).
// What it can say:
//   define time  D.mark / door / volume / route / plan / loadout / lightGroup / variant  → HANDLES by name (the script's manifest; resolved against the level
//                at load — a miss is a lint error and the script is not armed, the game stays playable), D.program(name, P => …, { showcase }), D.expect, D.systems
//   per program  triggers  P.onStart / after / onEvent / onSignal / onEnter / when  → start named BEATS  P.beat(name, function* (c) { … yield c.wait(2) … })
//   in a beat    yield c.wait / until / on / done / all / any / frames — flow c.start / cancel / signal / flag / note / finish — reads c.query / c.rand — actors
//                c.spawn / despawn / unit / order / arrived / release / rout / drill.breach|clear|hold|exchange / say / radio / control — world c.lights.* / doors.* /
//                stimulus.charge|burst / objective / chronicle — and, ONLY in programs declared showcase: true, c.stage / puppet / press / click / camera.* / caption /
//                chapters / fade / variant / shift (they throw elsewhere, and scanShowcaseVerbs finds them statically).
// How it runs: Game.director.tick(dt, input, cam) inside Game.update immediately before tacticsTick — orders issued this frame move men this frame; triggers read last
// frame's settled world plus this frame's g.events. Beats are GENERATORS resumed by an explicit scheduler (never async/await: a Promise continuation lands after
// Game.update, a setTimeout wait runs on wall time — both wrong under fixed stepping); each tick: drills tick → triggers → every running beat whose condition now holds
// is resumed synchronously until it yields an unsatisfied one (≤ MAX_RESUMES a beat a tick) → the showcase tail (camera shot, veil, the cut). start(name) is
// SYNCHRONOUS: it stages the world between frames exactly as the old Breach.start() did (onStart beats run their synchronous prefix there and then). Every it.next()
// is try/caught: a throw fails that beat, logs it with its step, releases the men it held to the AI, drops a camera pin it held, and the frame goes on (strict, set by
// the harness, rethrows). Everything is logged: director.log {t, run, program, beat, kind, what, data} — trigger fires, beat start / label / note / end, spawns,
// drill beats (forwarded with the drill's own clock), radio lines, stimuli, camera shots — the probes' substrate and, one day, the panel's timeline. Nothing here
// reads performance.now() or Math.random: a program's dice are its own mulberry32.
// M1's cut (the doc §2.3 / §7): beats are atomic — a checkpoint is refused while any program runs (savestate.ts canSave asks blocksSave()); volumes got their runtime
// slot (Level.volumes) so onEnter is real; loadouts and marks are declared IN the script with literals until LevelData v2 (M3) gives them a home; drill.advance and
// the units[] / director save slices wait for M3; the tour stays demo.ts (M2). With no program running tick() is a return on its first line: the game is the game.
// WHAT THE NIGHT SHOWCASE ADDED (the removed program 'night' — the tour as a story; the verbs stay), all small,
// all documented at their sites: D.device(id) (a handle on a level device — the keypad — linted like the doors); c.learnCode(device, from) (devices.ts learnCode: the
// man in Sam's arm gives the pad's digits and Sam KNOWS them — the code row opens the door a minute later); c.say(unit) is FORCED (a scripted line is deliberate: a
// held man's answer goes up too) and c.say('sam', …) puts a line over Sam (showcase-only); c.press / c.click are QUEUED and injected at the top of the NEXT Game.update
// (injectInput — the tick runs after updatePlayer, so a key added to input.pressed here used to be cleared by endFrame before anybody read it: the tour pressed its
// keys BEFORE the step, a beat now presses them one frame ahead, exactly as deterministic); c.puppet takes the puppet's fixtures / throwAt fields; and, showcase-only
// like the camera: c.select(kind, verb) (= Game.selectVerb: which row the next Space does), c.view (a read model of Sam — where he is, what the highlighted row is,
// the hold's phase, what the reticle has snapped to, the code / key in his pocket, the drive — what the HUD shows of him, never a Guard field), c.weather({storm,
// rain, seed, strike}) (the storm pinned and a stroke on cue; put back at the end), c.mission(on) (Game.missionInTour: the drive's row and stage machine live under
// the puppet, as the tour's drive stop had it), c.handover(caption, sub) (the tour's 'Your turn': its own cast out, a fresh encounter under a WHOLE veil the beat
// then lifts with c.fade, live controls, the follow camera back, the caption up — the program then finishes WITHOUT a second restore), and ProgramOpts.freshEncounter (restartEncounter as the show starts: the shift
// on its marks at t = 0, so a man ordered at 0:29 is where 0:29 finds him every run).
// WHAT THE DAY SHOWCASE'S LOUD HALF ADDED (the removed program 'breach' past the drill's cut; the verbs stay), likewise small and documented at their sites:
// c.chaos(k | null) is SHOWCASE-ONLY — the program's own destruction knob for its length (destruction.ts Destruction.showChaos, read by chaosOf even under `touring`, where the
// player's knob reads 0; nulled here as the program ends, BEFORE the encounter is restored, so nothing it broke outlives the veil); c.doors.kick(door, by, {leg}) is a CAUSE
// like charge / burst — the man throws the animator's kick and at its impact instant doors.ts kickIn does what a boot does (keep torn, leaf flung, the crack the floor hears),
// c.doors.kickSpot(door, by) reads where that kick is thrown from; c.order(u, { aimAt: unit }) now TRACKS that man (his chest re-read every tick into the ordered aim
// point until the next aim order — a muzzle that stays on a moving man), and { flinch: true } lets a choreographed man start at rounds past him (game.ts GuardScript.flinch,
// suppression.ts: the anim alone). Bursts already were real rounds (stimulus.burst); the firefight is those, ordered.
import { SideSet } from '../math/side';
import { openingStart } from './opening';
import { Vec3, v3, DEG, damp, wrapAngle, smoothstep } from '../math/vec';
import { rollOn } from '../math/dice';
import type { Game, Guard, GuardScript, GameEvent, GuardState, Interactable, Verb } from './game';
import type { FollowCamera } from './camera';
import type { Input } from './input';
import type { Team } from './teams';
import type { WeaponId } from './weapons';
import type { Stance } from './character';
import { KICK_IMPACT, TOSS_QUICK } from './character';
import { kickScuff } from './marks';
import type { Level, BreachPlan, RoomClearPlan } from '../scene/level';
import type { Door } from './doors';
import { DOORWAY } from './doors';
import { WEAPONS } from './weapons';
import { order as squadOrder, endGuardScript, RoomClear } from './squad';
import { spawnUnit, despawnUnit, engage, say as guardSay, bubbleSecs } from './guards';
import type { Engagement } from './guards';
import { BreachDrill } from './breach';
import { setDaylight, isDaylight, setGroup } from './lighting';
import { cancelActions, teleportPlayer } from './player';
import { fireWeapon } from './combat';
import { learnCode as devicesLearnCode } from './devices';
import { chronicle, chronRadio, chronObjective, roomOf } from './chronicle';
import { radioHand } from './handwork';
import { runnerBreak, runnerFled, runnerOwns } from './runner';   // (asked inside the drill's ending check and a beat's `rout` / `routed` only: false with its switch off)

// ================================================================================================================================ types a script sees
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export interface MarkRef { readonly kind: 'mark'; readonly id: string }
export interface DoorRef { readonly kind: 'door'; readonly id: string }
export interface VolumeRef { readonly kind: 'volume'; readonly id: string }
export interface RouteRef { readonly kind: 'route'; readonly id: string }
export interface GroupRef { readonly kind: 'group'; readonly id: string }
export interface VariantRef { readonly kind: 'variant'; readonly id: 'daylight' }
export interface LoadoutRef { readonly kind: 'loadout'; readonly id: string }
/** a level device by name (LevelData devices[]: a keypad, a camera, a tripwire) — c.learnCode takes the keypad's */
export interface DeviceRef { readonly kind: 'device'; readonly id: string }
export type PlanKind = 'breach' | 'roomClear';
export interface PlanRef<K extends PlanKind = PlanKind> { readonly kind: 'plan'; readonly id: string; readonly plan: K }
export interface UnitRef { readonly kind: 'unit'; readonly id: number; readonly callsign: string }
/** a place a verb accepts: a named mark, or a literal point (x, 0, z — y is ignored for feet) */
export type Place = MarkRef | Vec3;
/** what a loadout is until LevelData carries loadouts[] (M3): declared in the script with D.loadout(id, spec) */
export interface LoadoutSpec { team: Team; weapon?: WeaponId; tint?: Vec3; tint2?: Vec3; light?: boolean; trained?: boolean;
  /** SHOWCASE casts only (the lint refuses it in a play program): rounds pass through these men (game.ts Guard.god) — the day showcase's two operatives, whose show cannot end on a stray */
  god?: boolean }
export type Upper = NonNullable<GuardScript['upper']>;
export type OrderPatch = Partial<{ goal: Place | null; speed: number; face: number | null; strafe: boolean; aimAt: Place | UnitRef | null; stance: Stance; stackSide: -1 | 1; crouch: boolean; upper: Upper; light: boolean; hot: boolean; flinch: boolean; direct: boolean;
  /** he has a smoke where he stands, once he is there (game/smokebreak.ts; a play program may order it: it is a pose and a picture) */ smoke: boolean }>;
export type EventKind = GameEvent['kind'];
/** what a script sees of a hearing event (never the record itself: it must not write it) */
export interface EventView { readonly kind: EventKind | 'signal'; readonly pos: Vec3; readonly level: number; readonly loud: boolean; readonly who: number; readonly name?: string; readonly data?: Json;
  /** metres from the event to a door's frame / a place */
  near(what: DoorRef | Place, within: number): boolean }
export type EventFilter = (e: EventView) => boolean;

/** A condition a beat yields and the scheduler evaluates once a tick until it holds. */
export type Cond =
  | { readonly k: 'time'; readonly until: number; readonly label?: string }
  | { readonly k: 'frames'; readonly due: number }              // the tick (Run.tickN) it holds from
  | { readonly k: 'pred'; readonly test: (q: Query) => boolean; readonly label: string }
  | { readonly k: 'event'; readonly kind: EventKind | 'signal'; readonly name?: string; readonly filter?: EventFilter; got?: EventView; readonly tick0: number }   // (news of the tick it was yielded on does not count)
  | { readonly k: 'beat'; readonly name: string; readonly state: 'done' | 'started' }
  | { readonly k: 'all' | 'any'; readonly of: readonly Cond[] };
/** what a satisfied yield hands back into the generator: which branch of an any() held (index), the event an on() caught */
export interface CondResult { index: number; event?: EventView }
export type BeatFn = (c: BeatCtx) => Generator<Cond, void, CondResult>;
export type BeatState = 'running' | 'done' | 'failed' | 'cancelled';

/** Read-only questions a script may ask (decision 5: never Guard fields — so the journal stays small and a level grows no AI shortcut the picture lacks). */
export interface Query {
  /** seconds since the program started; the game's own clock */
  readonly t: number; readonly time: number;
  readonly escalation: 0 | 1 | 2; readonly mainsOn: boolean; readonly daylight: boolean;
  alive(u: UnitRef): boolean; arrived(u: UnitRef): boolean; state(u: UnitRef): GuardState | null; room(u: UnitRef | 'sam'): string;
  /** where a unit stands (a place resolved); Sam's own position only in a showcase program */
  pos(u: UnitRef | 'sam' | Place): Vec3;
  /** `swing`: the face the leaf opens onto, in the door's own ± (what a level's `swing` key means); 0 = double-acting (it opens off whoever works it) */
  door(d: DoorRef): { angle: number; open: boolean; latched: boolean; locked: boolean; broken: boolean; swing: 1 | -1 | 0 };
  groupOn(g: GroupRef): boolean;
  /** `'team'`: the player or any of his teammates, standing */
  inside(v: VolumeRef, who: UnitRef | 'sam' | 'team'): boolean;
  /** the authored plan data behind a handle (marks, doors, lines) — data, not AI state */
  plan(p: PlanRef<'breach'>): Readonly<BreachPlan>; plan(p: PlanRef<'roomClear'>): Readonly<RoomClearPlan>; plan(p: PlanRef): Readonly<BreachPlan | RoomClearPlan>;
  flag(name: string): Json | undefined;
  /** has this run been sent the signal (a lesson's cue `lesson:<name>`, a beat's own `done:<name>`) — what a beat that was busy when it came asks afterwards */
  signalled(name: string): boolean;
  /** runner.ts has him: from his shout on he has dropped it and is running (false with that rule off). Alive, and nobody's to fight */
  routed(u: UnitRef): boolean;
}
/** A running drill, as the beat that started it sees it. `beat` is the pseudo-beat name c.done() takes; since(what) = seconds on the DRILL's clock since it first logged `what` (NaN before). */
export interface DrillRef { readonly kind: 'drill'; readonly name: string; readonly beat: string; readonly phase: string; readonly t: number; readonly done: boolean; readonly aborted: boolean; readonly cleared: boolean;
  since(what: string): number; has(what: string): boolean; readonly ops: readonly UnitRef[] }
export interface CameraShotSpec {
  /** the look-at: a place, or a live point re-read every frame (tracked at `track` 1/s when given, else locked to it); lookY = its height (0.8) */
  look: Place | (() => Vec3); lookY?: number; track?: number;
  /** the framing in DEGREES (FollowCamera: yaw 0 looks north, 90 west, −90 east; the eye sits dist back along it, pitch up); yaw / dist ease hold–swing–hold to yawTo / distTo across `dur` */
  yaw: number; yawTo?: number; pitch: number; dist: number; distTo?: number; dur: number;
  /** the chapter this shot is (index into c.chapters), and its title for the log */
  title?: string; chapter?: number;
}
export interface BeatCtx {
  // ---- waiting (yield these)
  wait(secs: number, label?: string): Cond; frames(n?: number): Cond; until(pred: (q: Query) => boolean, label?: string): Cond;
  on(kind: EventKind | 'signal', filterOrName?: EventFilter | string, filter?: EventFilter): Cond; done(beat: string | DrillRef): Cond; started(beat: string): Cond;
  all(...c: Cond[]): Cond; any(...c: Cond[]): Cond;
  // ---- flow
  start(beat: string): void; cancel(beat: string): void; signal(name: string, data?: Json): void; readonly flag: Record<string, Json>;
  note(what: string, data?: Json): void; finish(): void; rand(): number; readonly query: Query; readonly dt: number;
  // ---- actors
  spawn(loadout: LoadoutRef, at: Place, opts?: { callsign?: string; yaw?: number; light?: boolean }): UnitRef;
  despawn(u: UnitRef): void; unit(callsign: string): UnitRef | null;
  order(u: UnitRef, o: OrderPatch): void; arrived(u: UnitRef): boolean; release(u: UnitRef, state?: 'patrol' | 'search' | 'alert'): void;
  /** HE DROPS IT AND RUNS: runner.ts's own sequence started on this man now (his shout, the beat, the weapon on the floor, the run — the seam that file
   *  keeps for it, runnerBreak), out of this beat's hands from here. True too when that file has him already. False, and NOTHING done to him — he is
   *  still this beat's, as he was — where that rule would not take him: its switch or morale's off (the frozen stand, `?norunner`), a man in Sam's arm,
   *  one of the response team's, a show on the floor; and for a man this program SPAWNED (his way out of the level would leave the program's record of
   *  him behind: the level's own men only). A play program may call it: it is the game's own rule, not a showcase verb. */
  rout(u: UnitRef): boolean;
  /** the level's own man put in the picture through the fog of war, or taken out of it again (fogofwar.ts `show`): drawn, not seen — no AI learns
   *  anything and the squad's eyes are their own. For a staged man the lesson is about: he must be there to be looked at. A play program may call it */
  show(u: UnitRef, on?: boolean): void;
  /** a drill this program has begun, by the plan / name it was begun on (null before) — how one beat frames what another set going */
  drillOf(what: PlanRef | string): DrillRef | null;
  drill: {
    breach(plan: PlanRef<'breach'>, ops: [UnitRef, UnitRef], opts: { hostiles: UnitRef[]; guaranteeDowns?: boolean }): DrillRef;
    clear(plan: PlanRef<'roomClear'>, pair: [UnitRef, UnitRef?], opts?: { live?: boolean }): DrillRef;
    hold(units: UnitRef[], at: Place[], face?: (number | null)[]): DrillRef;
    exchange(a: UnitRef[], b: UnitRef[], opts?: { timeout?: number; surprise?: number; pin?: boolean }): DrillRef;
  };
  /** a line from a man (his bubble on screen; `radio` puts it on the net's strip too) — FORCED: a man in Sam's arm says it as well (his scripted answer). 'sam' = a line over Sam
   *  himself, murmured (showcase-only: a play program never speaks for the player). */
  say(u: UnitRef | 'sam', line: string, opts?: { radio?: boolean }): void; radio(callsign: string, line: string): void; control(line: string): void;
  /** Sam LEARNS the code of keypad `dev` (devices.ts learnCode: idempotent, one line in the log, the debrief's row) — from `from`'s mouth if given. The pad's `code` row then opens its door. → was it news */
  learnCode(dev: DeviceRef, from?: UnitRef): boolean;
  // ---- world
  lights: { group(g: GroupRef, on: boolean): void; mains(on: boolean): void; blackout(secs: number): void };
  doors: { lock(d: DoorRef, on: boolean): void;
    /** off its latch and swinging open (or SET at `angle`, still); `hold` = left standing there — its hydraulic closer kept off for the program's length (a leaf on its stay; Door.reset at the restore rearms it) */
    open(d: DoorRef, angle?: number, opts?: { hold?: boolean }): void; fling(d: DoorRef, by: UnitRef): void; shut(d: DoorRef): void; latch(d: DoorRef): void;
    /** a BOOT beside the lock (a cause: character.ts kickDoor now, doors.ts kickIn at the sole's impact — keep torn, leaf flung off it, the crack heard floor-wide like a shot). Stand him on kickSpot first. */
    kick(d: DoorRef, by: UnitRef, opts?: { leg?: 'left' | 'right' }): void;
    /** where `by` throws that kick from on his side of the leaf: square to it three-quarters of a metre off, by the lock (doors.ts kickSpot) */
    kickSpot(d: DoorRef, by: UnitRef): { pos: Vec3; yaw: number } };
  stimulus: { charge(at: Place, opts: { by: UnitRef; kind?: 'flash' | 'smoke'; fuse?: number; /** he is SEEN to throw it: the animator's quick toss, as the squad's own cans (off: the can leaves a still hand, as every script before the word) */ toss?: boolean }): void; burst(u: UnitRef, at: Place | UnitRef, rounds: number, opts?: { cadence?: number; spread?: number }): Cond;
    /** rounds of his that a burst has not put yet are not put (a burst a beat stopped waiting on would otherwise fire them later, whoever stands in its line by then) */
    cease(u: UnitRef): void };
  objective(text: string | null, markAt?: Place | DoorRef): void; chronicle(kind: 'objective', text: string): void;
  // ---- showcase-only (throw in a program not declared showcase: true; scanShowcaseVerbs flags them statically)
  stage(who: UnitRef | 'sam', at: Place, opts?: { yaw?: number }): void;
  /** Sam's strings (Game.puppet, what the tour's beats pulled): walk straight at `goal` (pick goals with a clear line), the cursor put on `aim`, crouched or not, `walk` × his pace,
   *  `fixtures` = the reticle may snap to a light / the breaker (else only to men: a lamp behind a target never steals a shot), `throwAt` = the canister's arc ends there. null = hands off. */
  puppet(p: PuppetSpec | null): void; press(key: string): void; click(button?: number): void;
  /** which row the next Space performs (Game.selectVerb — what holding Space and scrolling to it does by hand): the man's 'grab', the held man's 'choke', a door's 'ease' / 'pick' / 'code', the body's 'drag'… → whether such a row is on offer now */
  select(kind: Interactable['kind'], verb?: Verb): boolean;
  /** what the HUD shows of Sam right now (a fresh snapshot per read; never a Guard field) — the beats' feedback: press Space when the grab row is in reach, wait for the hold to be 'held', … */
  readonly view: SamView;
  camera: { pin(s: CameraShotSpec): void; release(): void; readonly shotT: number };
  caption(title: string, sub?: string): void; chapters(list: { title: string; dur: number }[]): void; fade(to: 0 | 1, secs?: number): void;
  variant(v: VariantRef, on: boolean): void; shift(on: boolean): void;
  /** the storm for the show's length (weather.ts): intensity / rain rate pinned, its dice re-seeded (the strokes then land on the same show seconds every run), a stroke NOW (bearing rad,
   *  elevation °, distance km → the thunder's delay); whatever it changed is put back when the program ends. A level without the storm, or with it switched off, ignores it. */
  weather(o: { storm?: number; rain?: number; seed?: number; strike?: { bearing?: number; elevDeg?: number; distKm?: number; peak?: number } }): void;
  /** the mission's own thread live under the puppet (Game.missionInTour, as the tour's drive stop ran it): the server room announces itself, the rack's row is offered, the pull runs, the
   *  rack drops off its feed and the check errand fires — none of it the player's run (missionLive stays false). Off again before Sam walks out through the exfil door (or the end card would come up). */
  mission(on: boolean): void;
  /** THE HAND-OVER (the tour's 'Your turn'): under a quick veil a fresh encounter, the flags live (mortal unless the player had god mode on, seen, the mission counting), the follow camera
   *  and the controls given back, `caption` / `sub` up as the top card — the program keeps the frame only for that caption and ends WITHOUT its usual restore when a beat calls c.finish(). */
  handover(caption: string, sub?: string): void;
  /** the program's OWN destruction knob for its length (destruction.ts chaosOf reads it — under the show's `touring` too, where the player's tune.chaos reads 0): 0‥1, null = back to the
   *  knob. Put back to null as the program ends, before the restore, whatever the beat did. The day showcase's loud minute runs at 0.8 (docs/design/showcases.md, decision 6). */
  chaos(k: number | null): void;
}
/** Game.puppet as a beat writes it (places resolved to points) */
export interface PuppetSpec { goal?: Place | null; aim?: Place | null; crouch?: boolean; walk?: number; fixtures?: boolean; throwAt?: Place | null }
/** The read model of Sam a SHOWCASE beat may look at (c.view): everything on it is something the player's own HUD shows him. */
export interface SamView {
  readonly pos: Vec3; readonly yaw: number; readonly speed: number; readonly crouch: boolean; readonly holstered: boolean; readonly slot: string; readonly nv: boolean;
  /** the highlighted row (what a Space tap does now): its thing, its verb, whether it is in reach, whose row (a man's callsign / a door's name) */
  readonly hover: { kind: string; verb: string | null; inReach: boolean; who: string | null; running: boolean } | null;
  /** every row on offer, as 'kind:verb' */
  readonly rows: readonly string[];
  /** the man in his arm: who, the hold's phase (grab / held / choke / whip), its variant, seconds in the phase */
  readonly holding: { who: string; phase: string; variant: string; t: number } | null;
  readonly dragging: string | null; readonly takedown: boolean;
  /** the sustained verbs: the leaf he is easing / the lock he is picking / the pad he is keying (door names), the drive's clock (−1 idle) and whether it is out */
  readonly easing: string | null; readonly picking: string | null; readonly coding: string | null; readonly driveT: number; readonly pulled: boolean; readonly stage: string;
  /** what he has learned / taken: keypad codes by pad name, keys by lock id */
  readonly codes: readonly string[]; readonly keys: readonly string[];
  /** the reticle's snap: the fixture (or 'breaker') the OCP / a round would go to, the man it sits on; the OCP's charge 0‥1 (0 just after a burst); cans on the belt */
  readonly aimTarget: string | null; readonly aimGuard: string | null; readonly ocp: number; readonly canisters: number; readonly flashbangs: number;
  /** a leaf under his hand (walking one open) */
  readonly doorPush: string | null;
}
export interface ProgramOpts {
  /** captions / camera / puppet allowed; the show plumbing (flags saved, quiet + touring + god + invisible + AI on, aftermath cleared, doors reset, input locked to P, a fresh
   *  restartEncounter under black at the end) wraps it — decision 4 */
  showcase?: boolean;
  /** the caption is a one-line lower third and the HUD is hidden — carried on director.frame.lowerThird; the page's own style for it (index.html body.breaching) went with the two showcases: a page that wants it draws it off the frame) */
  lowerThird?: boolean;
  /** the cut: seconds the veil takes to come up once a beat calls c.finish(), and how long the end is held before the restore (the breach's 0.35 / 0.5) */
  endVeil?: number; endHold?: number;
  /** showcase: restart the encounter as the program starts (fresh shift on its route starts, doors / lights / props as authored, a full kit, nothing in the air) — a show that ORDERS the
   *  level's own men on cue needs them where t = 0 always has them (the breach benches them instead and does without) */
  freshEncounter?: boolean;
}
export interface ProgramApi {
  onStart(beat: string): void; after(secs: number, beat: string): void;
  onEvent(kind: EventKind, beat: string, filter?: EventFilter): void; onSignal(name: string, beat: string): void;
  onEnter(v: VolumeRef, beat: string, opts?: { who?: 'sam' | 'anyUnit' | UnitRef; once?: boolean }): void;
  when(pred: (q: Query) => boolean, beat: string, opts?: { label?: string }): void;
  beat(name: string, fn: BeatFn, opts?: { atomic?: boolean }): void;
}
export interface DirectorApi {
  mark(id: string, pos?: Vec3, yaw?: number): MarkRef; volume(id: string): VolumeRef; route(id: string): RouteRef; door(id: string): DoorRef; device(id: string): DeviceRef;
  plan(id: 'breach'): PlanRef<'breach'>; plan(id: string): PlanRef; loadout(id: string, spec: LoadoutSpec): LoadoutRef; lightGroup(name: string): GroupRef; variant(id: 'daylight'): VariantRef;
  program(name: string, body: (P: ProgramApi) => void, opts?: ProgramOpts): void;
  expect: { order(program: string, beats: string[]): void; within(program: string, a: string, b: string, maxSecs: number): void; never(what: 'samHit' | 'unitThroughWall'): void };
  systems: { qrf(on: boolean): void; needs(on: boolean): void; civilians(on: boolean): void; autosave(on: boolean): void;
    /** the defenders' own grenades (frag.ts): off = nobody on their side throws one on this level */
    theirFrags(on: boolean): void };
  /** small pure helpers so a script needs no runtime import for arithmetic on places */
  util: { yawTo(from: Vec3, to: Vec3): number; distXZ(a: Vec3, b: Vec3): number; lerp(a: Vec3, b: Vec3, t: number): Vec3; add(a: Vec3, b: Vec3): Vec3; ahead(p: Vec3, yaw: number, dist: number, y?: number): Vec3 };
}
/** the character budget a script's spawn is held to on a tutorial mission (rails.ts): every character the engine skins — Sam, the four and eleven more —
 *  since a beat's men come on top of the men the staging dealt. Anywhere else: none (spawnUnit's own eight) */
function liftedBudget(g: Game): number | undefined { return g.rails?.live ? 16 : undefined; }
/** the module shape of a level script: levels/<name>.script.ts `const script: LevelScriptFn = D => { … }; export default script;` */
export type LevelScriptFn = (D: DirectorApi) => void;

// ================================================================================================================================ the manifest (the define pass) and the lint
export interface Manifest {
  marks: Map<string, { pos: Vec3 | null; yaw?: number }>; volumes: Set<string>; routes: Set<string>; doors: Set<string>; devices: Set<string>; plans: Map<string, PlanKind>; loadouts: Map<string, LoadoutSpec>; groups: Set<string>; variants: Set<string>;
  programs: Map<string, ProgramDef>;
  expects: { kind: 'order' | 'within' | 'never'; program?: string; beats?: string[]; a?: string; b?: string; max?: number; what?: string }[];
  systems: Partial<Record<'qrf' | 'needs' | 'civilians' | 'autosave' | 'theirFrags', boolean>>;
}
interface TriggerDef { kind: 'start' | 'after' | 'event' | 'signal' | 'enter' | 'when'; beat: string; secs?: number; event?: EventKind; name?: string; filter?: EventFilter; volume?: string; who?: 'sam' | 'anyUnit' | UnitRef; once?: boolean; pred?: (q: Query) => boolean; label?: string }
interface ProgramDef { name: string; opts: ProgramOpts; beats: Map<string, { fn: BeatFn; atomic: boolean }>; triggers: TriggerDef[] }
export interface LintProblem { level: 'error' | 'warn'; what: string }

/** Run a script's define pass against a RECORDING api (no Game, no Level needed) → everything it names and declares. Beat bodies are kept, not run. */
export function manifestOf(script: LevelScriptFn): Manifest {
  const M: Manifest = { marks: new Map(), volumes: new Set(), routes: new Set(), doors: new Set(), devices: new Set(), plans: new Map(), loadouts: new Map(), groups: new Set(), variants: new Set(), programs: new Map(), expects: [], systems: {} };
  const D: DirectorApi = {
    mark: (id, pos, yaw) => { if (!M.marks.has(id) || pos) M.marks.set(id, { pos: pos ? v3.copy(pos) : (M.marks.get(id)?.pos ?? null), yaw }); return { kind: 'mark', id }; },
    volume: id => { M.volumes.add(id); return { kind: 'volume', id }; },
    route: id => { M.routes.add(id); return { kind: 'route', id }; },
    door: id => { M.doors.add(id); return { kind: 'door', id }; },
    device: id => { M.devices.add(id); return { kind: 'device', id }; },
    plan: ((id: string) => { const k: PlanKind = id === 'breach' ? 'breach' : 'roomClear'; M.plans.set(id, k); return { kind: 'plan', id, plan: k }; }) as DirectorApi['plan'],
    loadout: (id, spec) => { M.loadouts.set(id, { ...spec, tint: spec.tint && v3.copy(spec.tint), tint2: spec.tint2 && v3.copy(spec.tint2) }); return { kind: 'loadout', id }; },
    lightGroup: id => { M.groups.add(id); return { kind: 'group', id }; },
    variant: id => { M.variants.add(id); return { kind: 'variant', id }; },
    program: (name, body, opts = {}) => {
      if (M.programs.has(name)) throw new Error(`script: program '${name}' declared twice`);
      const P: ProgramDef = { name, opts: { ...opts }, beats: new Map(), triggers: [] };
      const api: ProgramApi = {
        onStart: beat => { P.triggers.push({ kind: 'start', beat }); },
        after: (secs, beat) => { P.triggers.push({ kind: 'after', beat, secs }); },
        onEvent: (event, beat, filter) => { P.triggers.push({ kind: 'event', beat, event, filter }); },
        onSignal: (sig, beat) => { P.triggers.push({ kind: 'signal', beat, name: sig }); },
        onEnter: (v, beat, o = {}) => { P.triggers.push({ kind: 'enter', beat, volume: v.id, who: o.who ?? 'sam', once: o.once ?? true }); },
        when: (pred, beat, o = {}) => { P.triggers.push({ kind: 'when', beat, pred, label: o.label ?? 'when' }); },
        beat: (bn, fn, o = {}) => { if (P.beats.has(bn)) throw new Error(`script: beat '${bn}' declared twice in program '${name}'`); P.beats.set(bn, { fn, atomic: o.atomic ?? true }); },
      };
      body(api);
      M.programs.set(name, P);
    },
    expect: {
      order: (program, beats) => { M.expects.push({ kind: 'order', program, beats: [...beats] }); },
      within: (program, a, b, max) => { M.expects.push({ kind: 'within', program, a, b, max }); },
      never: what => { M.expects.push({ kind: 'never', what }); },
    },
    systems: { qrf: on => { M.systems.qrf = on; }, needs: on => { M.systems.needs = on; }, civilians: on => { M.systems.civilians = on; }, autosave: on => { M.systems.autosave = on; }, theirFrags: on => { M.systems.theirFrags = on; } },
    util: UTIL,
  };
  script(D);
  return M;
}
const UTIL: DirectorApi['util'] = {
  yawTo: (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]), distXZ: (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]),
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  ahead: (p, yaw, d, y = p[1]) => [p[0] + Math.sin(yaw) * d, y, p[2] + Math.cos(yaw) * d],
};
const TEAMS: readonly Team[] = ['guard', 'operative', 'hostile'];
/** The define-time lint (decision 3: no sandbox — our TypeScript — but every NAME checked before anything runs): each door / route / volume / plan / light group / variant the
 *  script names exists in the level, every mark resolves (a level mark once LevelData has marks[]; until then the script's own literal), loadouts name a real weapon and a
 *  spawnable side, every trigger names a declared beat, waits are finite, expectations name declared programs. Errors disarm the script; warnings are printed. */
export function lintManifest(M: Manifest, level: Pick<Level, 'doors' | 'routes' | 'lights' | 'switchables' | 'clearPlans' | 'breach' | 'daylight' | 'volumes' | 'devices'>): LintProblem[] {
  const out: LintProblem[] = []; const err = (what: string) => out.push({ level: 'error', what }), warn = (what: string) => out.push({ level: 'warn', what });
  for (const id of M.doors) if (!level.doors.some(d => d.name === id)) err(`door '${id}' is not in the level (doors: ${level.doors.map(d => d.name).join(', ')})`);
  for (const id of M.devices) if (!(level.devices ?? []).some(d => d.name === id)) err(`device '${id}' is not in the level (devices: ${(level.devices ?? []).map(d => d.name).join(', ') || 'none'})`);
  for (const id of M.routes) if (!level.routes.some(r => r.name === id)) err(`route '${id}' is not in the level`);
  for (const id of M.volumes) if (!(level.volumes ?? []).some(v => v.name === id)) err(`volume '${id}' is not in the level${(level.volumes ?? []).length ? '' : ' (it authors none)'}`);
  for (const [id, k] of M.plans) {
    if (k === 'breach') { const B = level.breach; if (!B) err(`plan 'breach': the level has no breach plan (plans.breach)`); else { for (const dn of [B.door, B.next.door]) if (!level.doors.some(d => d.name === dn)) err(`plan 'breach' names door '${dn}', not in the level`); if (B.hostiles.length < 1) err(`plan 'breach' has no hostiles`); } }
    else if (!(level.clearPlans ?? []).some(p => p.room === id || p.door === id)) err(`plan '${id}': no room-clear plan of that room / door in the level`);
  }
  for (const [id, m] of M.marks) if (!m.pos) err(`mark '${id}' has no position (LevelData has no marks[] yet — declare it with D.mark(id, [x, 0, z]))`); else if (!m.pos.every(Number.isFinite)) err(`mark '${id}' position is not finite`);
  for (const [id, L] of M.loadouts) {
    if (!TEAMS.includes(L.team)) err(`loadout '${id}': team '${L.team}' cannot be spawned (guard / operative / hostile)`);
    if (L.weapon !== undefined && !WEAPONS[L.weapon]) err(`loadout '${id}': no weapon '${L.weapon}' (weapons.ts)`);
    for (const t of [L.tint, L.tint2]) if (t && !(t.length === 3 && t.every(x => Number.isFinite(x) && x >= 0 && x <= 1))) err(`loadout '${id}': tint out of range`);
    if (L.god && [...M.programs.values()].some(P => !P.opts.showcase)) err(`loadout '${id}': god is a showcase cast's net — not in a script that has a play program ('${[...M.programs.values()].find(P => !P.opts.showcase)?.name}')`);
  }
  const groups = new Set<string>([...level.lights.map(l => l.group ?? ''), ...level.switchables.map(s => s.group), ...(level.devices ?? []).map(d => ('group' in d && d.group) || 'security')]);
  for (const id of M.groups) if (!groups.has(id)) err(`light group '${id}' is not in the level (groups: ${[...groups].filter(Boolean).join(', ')})`);
  for (const id of M.variants) if (id !== 'daylight') err(`variant '${id}' unknown`); else if (!level.daylight) err(`variant 'daylight': the level has no daylight block`);
  for (const [pn, P] of M.programs) {
    if (!P.beats.size) warn(`program '${pn}' declares no beats`);
    if (!P.triggers.some(t => t.kind === 'start') && P.triggers.length === 0) warn(`program '${pn}' has no trigger — nothing will ever start a beat`);
    for (const t of P.triggers) {
      if (!P.beats.has(t.beat)) err(`program '${pn}': trigger ${t.kind}${t.kind === 'after' ? ` ${t.secs}s` : t.kind === 'enter' ? ` '${t.volume}'` : t.kind === 'event' ? ` '${t.event}'` : t.kind === 'signal' ? ` '${t.name}'` : ''} → beat '${t.beat}', which is not declared`);
      if (t.kind === 'after' && !(Number.isFinite(t.secs) && t.secs! >= 0)) err(`program '${pn}': after(${t.secs}) is not a finite delay`);
      if (t.kind === 'enter' && !M.volumes.has(t.volume!)) err(`program '${pn}': onEnter names volume '${t.volume}' the script never declared with D.volume`);
    }
    if (P.triggers.filter(t => t.kind === 'when').length > MAX_WHEN) err(`program '${pn}': more than ${MAX_WHEN} when() predicates`);
    if ((P.opts.endVeil !== undefined && !(P.opts.endVeil > 0)) || (P.opts.endHold !== undefined && !(P.opts.endHold >= 0))) err(`program '${pn}': endVeil / endHold must be positive`);
  }
  for (const e of M.expects) {
    if (e.program !== undefined && !M.programs.has(e.program)) err(`expect: program '${e.program}' is not declared`);
    if (e.kind === 'within' && !(e.max! > 0)) err(`expect.within: ${e.max} s`);
  }
  return out;
}
/** the verbs only a showcase program may use (decision 4): a play program throws on them at run time AND this scan finds them by name in its beats' source */
export const SHOWCASE_VERBS = ['stage', 'puppet', 'press', 'click', 'camera', 'caption', 'chapters', 'fade', 'variant', 'shift', 'select', 'view', 'weather', 'mission', 'handover', 'chaos'] as const;
/** The showcase-verb scan: for every program NOT declared showcase, every beat's source text (Function.prototype.toString — a syntactic scan is enough: they are property
 *  names on the context) searched for `.verb(` / `.verb.` of the showcase-only set. Comments are stripped first so a mention in prose is not a use. */
export function scanShowcaseVerbs(M: Manifest): { program: string; beat: string; verb: string }[] {
  const hits: { program: string; beat: string; verb: string }[] = [];
  for (const [pn, P] of M.programs) {
    if (P.opts.showcase) continue;
    for (const [bn, B] of P.beats) {
      const src = String(B.fn).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const verb of SHOWCASE_VERBS) if ((verb === 'view' ? /\.\s*view\b/ : new RegExp(`\\.\\s*${verb}\\s*[.(]`)).test(src)) hits.push({ program: pn, beat: bn, verb });   // (view is a property, read bare: `c.view.hover`, `const V = c.view;`)
    }
  }
  return hits;
}

// ================================================================================================================================ the runtime
/** ≤ this many synchronous resumes of one beat in one tick: a beat that never yields an unsatisfied condition is a runaway — failed and logged, the frame goes on */
export const MAX_RESUMES = 64;
/** the log ring, and when() predicates a program may register */
const LOG_CAP = 2500, MAX_WHEN = 32, MAX_PASSES = 8;   // (LOG_CAP: the day showcase's two minutes of ordered bursts and legs run to ~900 rows — the ring must hold a whole run for the probes that read it back at the end)
export interface LogRow { t: number; run: number; program: string; beat: string; kind: 'program' | 'trigger' | 'beat' | 'yield' | 'note' | 'spawn' | 'drill' | 'radio' | 'stimulus' | 'camera' | 'error'; what: string; data?: Json }
/** what main.ts reads each frame while a SHOWCASE program has the frame (null otherwise): the look-at the camera is pinned on (null once the show has HANDED OVER: the follow camera is the
 *  player's again), the caption, the veil, whether the HUD gives way to a lower third */
export interface DirectorFrame { look: Vec3 | null; caption: string; sub: string; fade: number; lowerThird: boolean; program: string; handedOver: boolean }

interface LiveBeat { name: string; it: Generator<Cond, void, CondResult>; waiting: Cond | null; result: CondResult; t0: number; step: number; state: BeatState; touched: Set<number>; pinnedCamera: boolean; ctx: BeatCtx; flow: { finish: boolean } }
interface UnitRec { ref: UnitRef; gd: Guard; loadout: string; by: string }
type DrillImpl =
  | { kind: 'breach'; d: BreachDrill; forwarded: number }
  | { kind: 'clear'; d: RoomClear; clock: number; lastPhase: string }
  | { kind: 'hold' }
  | { kind: 'exchange'; e: Engagement };
interface DrillRun { ref: DrillRef; impl: DrillImpl; beat: string; owner: string; ops: UnitRef[]; men: Guard[]; times: Map<string, number>; t: number; phase: string; done: boolean; aborted: boolean; cleared: boolean }
interface Shot { spec: CameraShotSpec; t: number; title: string }
interface ShowState { saved: { ai: boolean; god: boolean; invisible: boolean; quiet: boolean; touring: boolean; cam: { yaw: number; pitch: number; dist: number } | null };
  look: Vec3; shot: Shot | null; shotI: number; chapterT0: number; chapters: { title: string; dur: number }[]; caption: string; sub: string; fade: number; fadeTo: number; fadeRate: number; ending: { t: number } | null; benched: Guard[] | null; variantOn: boolean; puppet: boolean;
  /** the night showcase's plumbing: the storm's knobs before c.weather touched them (put back at the end), whether c.mission has the mission thread live, and whether the show has HANDED OVER
   *  (c.handover: the encounter is the player's already — the end restores nothing and raises no veil); the day showcase's: whether c.chaos has the program's own destruction knob set */
  weatherSaved: { storm: number; rain: number } | null; missionOn: boolean; handedOver: boolean; chaosSet: boolean }
interface Run { serial: number; name: string; def: ProgramDef; t: number; dt: number; tickN: number; /** the run's own die: its word on the record, rolled by math/dice.ts rollOn (no closure: a rollback snapshot holds where it stands) */ dice: number; rng: (this: { dice: number }) => number; seed: number; beats: LiveBeat[]; byName: Map<string, LiveBeat>; fired: Set<number>; signals: { name: string; t: number; data?: Json }[]; sigSeen: number; flags: Record<string, Json>;
  units: Map<number, UnitRec>; drills: DrillRun[]; bursts: { u: UnitRef; at: Place | UnitRef; left: number; cadence: number; spread: number; next: number; cond: { k: 'pred'; test: () => boolean; label: string }; fired: number }[];
  /** kicks thrown and not yet landed (c.doors.kick: doors.ts kickIn on the animator's impact frame), and aim points tracking a man (c.order aimAt: unit — his chest re-read into the ordered vector every tick) */
  kicks: { door: Door; gd: Guard; by: string; beat: string }[]; tracks: { gd: Guard; vec: Vec3; tgt: Guard }[];
  show: ShowState | null; objective: { text: string; pos: Vec3 | null } | null; systemsSaved: Partial<Record<'qrf' | 'needs' | 'civilians' | 'autosave', boolean>> | null; ended: boolean; finishing: boolean; failedShow: boolean; query: Query | null }
class BeatFailure extends Error {}

export class Director {
  /** the script's manifest (null: a level with no script — today's game exactly) and what the lint said of it; armed = no lint error: programs may start */
  readonly manifest: Manifest | null; readonly problems: LintProblem[] = []; readonly scan: { program: string; beat: string; verb: string }[] = []; armed = false;
  /** the beat log across runs (a ring of LOG_CAP rows — a whole run's worth and more); `run` = the running program, `lastRun` = the one before (its rows stay in the log for the probes) */
  readonly log: LogRow[] = [];
  run: Run | null = null; lastRun: { serial: number; name: string; t: number; finished: boolean } | null = null;
  /** rethrow a beat's exception instead of failing the beat and going on (tools/qa/headless.ts sets it: a probe must go red, a player's frame must not die) */
  strict = false;
  /** called at the very end of a program's teardown: main.ts puts the start card back after a finished showcase */
  onProgramEnd: ((name: string, finished: boolean) => void) | null = null;
  frame: DirectorFrame | null = null;
  private cam: FollowCamera | null = null; private input: Input | null = null;
  private serial = 0; private seen = new SideSet<GameEvent>(); private exiting = false;
  /** c.press / c.click land here and go into the Input at the top of the NEXT Game.update (injectInput): the tick runs after updatePlayer / updateInteract have read this frame's input, and
   *  main.ts clears the edge sets at the end of the frame — pressed there and then, a beat's key would reach nobody */
  private dueKeys = new Set<string>(); private dueClicks = 0;
  /** Game.update's first business after the journal: the queued synthetic input of a showcase beat becomes this frame's (idempotent with a replayed input stream: a set and an OR) */
  injectInput(input: Input) { if (!this.dueKeys.size && !this.dueClicks) return; for (const k of this.dueKeys) input.pressed.add(k); input.clicked |= this.dueClicks; this.dueKeys.clear(); this.dueClicks = 0; }
  constructor(readonly g: Game, readonly script: LevelScriptFn | null) {
    if (!script) { this.manifest = null; return; }
    try { this.manifest = manifestOf(script); }
    catch (e) { this.manifest = null; this.problems.push({ level: 'error', what: `the script's define pass threw — ${(e as Error).message ?? e}` }); this.report(); return; }
    this.problems.push(...lintManifest(this.manifest, g.level));
    this.scan.push(...scanShowcaseVerbs(this.manifest));
    for (const h of this.scan) this.problems.push({ level: 'error', what: `program '${h.program}' is not a showcase but beat '${h.beat}' calls c.${h.verb}(…) — captions, camera and puppet are showcase-only` });
    this.armed = !this.problems.some(p => p.level === 'error');
    this.report();
  }
  private report() { const errs = this.problems.filter(p => p.level === 'error'); if (errs.length && typeof console !== 'undefined') console.error(`level script NOT armed — ${errs.length} lint error(s):\n  ` + errs.map(p => p.what).join('\n  ')); }
  /** hand the Director the camera and the input before the first tick (main.ts): a program started before any frame can then pin its first shot and lock the keys at once */
  attach(o: { cam?: FollowCamera | null; input?: Input | null }) { if (o.cam) this.cam = o.cam; if (o.input) this.input = o.input; }
  get programs(): string[] { return this.manifest ? [...this.manifest.programs.keys()] : []; }
  /** is a SHOWCASE program holding the frame right now (main.ts: the camera, the listener, the veil, the HUD are its) */
  get showing(): boolean { return !!this.run?.show && !this.run.ended; }
  get lowerThird(): boolean { return this.showing && !!this.run!.def.opts.lowerThird && !this.run!.show!.handedOver; }   // (handed over: the player's HUD is back, the caption is the top card)
  /** has the running showcase handed the encounter to the player already (c.handover): main.ts leaves the follow camera, the listener and the pitch to him */
  get handedOver(): boolean { return this.showing && this.run!.show!.handedOver; }
  /** why `name` cannot start right now (null = it can) */
  canStart(name: string): string | null {
    if (!this.manifest) return 'this level has no script';
    const P = this.manifest.programs.get(name); if (!P) return `no program '${name}' (programs: ${this.programs.join(', ') || 'none'})`;
    if (!this.armed) return 'the script is not armed (lint errors — see the console)';
    if (this.run && !this.run.ended) return `program '${this.run.name}' is running`;
    if (P.opts.showcase && this.g.touring) return 'the tour or attract mode has the floor';   // (a caller stops them first; a bare start() over them would fight their resets — review 08-10 #22)
    if (P.opts.showcase && (this.g.qrf?.state !== undefined && this.g.qrf.state !== 'idle' || this.g.guards.some(x => x.unit))) return 'a response unit is on the floor (the cast would not fit the character budget)';
    if (P.opts.showcase && !this.g.tune.teams && [...this.manifest.loadouts.values()].length && [...P.beats.values()].some(B => /\.\s*spawn\s*\(/.test(String(B.fn)))) return 'sides are switched off (tune.teams) — the cast cannot be spawned';   // (only a program whose beats spawn anybody: the night showcase casts the shift itself and runs with sides off)
    return null;
  }
  /** why a checkpoint cannot be written (savestate.ts canSave): M1 refuses throughout a program — its cursor (fired triggers, flags, live beats, units) has no save slice until M3 */
  blocksSave(): string | null { const R = this.run; return R && !R.ended ? `the level script's program '${R.name}' is running` : null; }
  get running(): string | null { const R = this.run; return R && !R.ended ? R.name : null; }
  /** a tutorial mission's own program is running (roomfight.ts, lanes.ts: a man of the floor's roster that it has in hand is left to it until it lets him go) */
  get lessonRuns(): boolean { const R = this.run; return !!R && !R.ended && !!this.g.rails?.live; }
  /** frag.ts: the level's script put the defenders' own grenades off (`D.systems.theirFrags(false)`): for the level, whatever program is or is not running */
  get theirFragsOff(): boolean { return this.armed && this.manifest?.systems.theirFrags === false; }
  get objective(): { text: string; pos: Vec3 | null } | null { return this.run && !this.run.ended ? this.run.objective : null; }
  /** a signal from OUTSIDE a beat (rails.ts: a lesson step's cue, 'lesson:<cue>'): the running program's onSignal triggers and c.on('signal', name) meet it on its next tick. Nothing with no program running. */
  signal(name: string, data?: Json) { const R = this.run; if (!R || R.ended) return; R.signals.push({ name, t: R.t, data }); this.push({ beat: '', kind: 'note', what: `signal:${name}`, ...(data !== undefined ? { data } : {}) }); }
  /** has the running program raised, or been sent, this signal (rails.ts: a beat's 'done:<name>') */
  signalled(name: string): boolean { const R = this.run; return !!R && !R.ended && R.signals.some(s => s.name === name); }
  chapters(): { list: { title: string; dur: number }[]; i: number; frac: number } | null {
    const R = this.run, S = R?.show; if (!R || !S || !S.chapters.length || S.handedOver) return null;
    const cur = S.chapters[S.shotI]; return { list: S.chapters, i: S.shotI, frac: cur && S.shot ? Math.min(1, (R.t - S.chapterT0) / cur.dur) : 0 };   // (a chapter's clock runs from the shot that ENTERED it: several set-ups inside one chapter do not restart its bar)
  }
  summary(): string {
    if (!this.manifest) return 'director: no script';
    const R = this.run;
    return `director: ${this.armed ? 'armed' : 'NOT armed'} · programs ${this.programs.join('/')}${R && !R.ended ? ` · RUNNING ${R.name} t=${R.t.toFixed(1)} beats ${R.beats.map(b => `${b.name}:${b.state}${b.state === 'running' && b.waiting ? '(' + condLabel(b.waiting) + ')' : ''}`).join(' ')} units ${R.units.size} drills ${R.drills.map(d => d.ref.name + ':' + d.phase).join(' ')}` : this.lastRun ? ` · last ${this.lastRun.name} ${this.lastRun.finished ? 'finished' : 'stopped'} at ${this.lastRun.t.toFixed(1)} s` : ''} · log ${this.log.length}`;
  }

  // ---------------------------------------------------------------- log
  private push(row: Omit<LogRow, 't' | 'run' | 'program'> & { t?: number }) {
    const R = this.run; const full: LogRow = { t: row.t ?? (R ? R.t : this.g.time), run: R ? R.serial : 0, program: R ? R.name : '', beat: row.beat, kind: row.kind, what: row.what, ...(row.data !== undefined ? { data: row.data } : {}) };
    this.log.push(full); if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
  }
  /** the rows of one run (default: the current, else the last) */
  rowsOf(serial = this.run?.serial ?? this.lastRun?.serial ?? -1): LogRow[] { return this.log.filter(r => r.run === serial); }

  // ---------------------------------------------------------------- start / stop
  /** Start program `name` NOW, between frames: showcase plumbing in, onStart beats begun and run to their first unsatisfied yield. Returns the reason when refused. */
  start(name: string, opts: { seed?: number } = {}): string | null {
    const why = this.canStart(name); if (why) return why;
    const def = this.manifest!.programs.get(name)!;
    const seed = (opts.seed ?? 0x2545F491 ^ (this.serial * 0x9E3779B9)) >>> 0;
    const R: Run = { serial: ++this.serial, name, def, t: 0, dt: 0, tickN: 0, dice: seed | 0, rng: rollOn, seed, beats: [], byName: new Map(), fired: new Set(), signals: [], sigSeen: 0, flags: {}, units: new Map(), drills: [], bursts: [], kicks: [], tracks: [], show: null, objective: null, systemsSaved: null, ended: false, finishing: false, failedShow: false, query: null };
    this.run = R; this.frame = null;
    this.push({ beat: '', kind: 'program', what: 'start', data: { seed } });
    if (def.opts.showcase) this.enterShow(R); else this.applySystems(R);
    for (const e of this.g.events) this.seen.add(e);   // nothing already in the air is news to a program that did not exist
    def.triggers.forEach((T, i) => { if (T.kind === 'start') { R.fired.add(i); this.push({ beat: T.beat, kind: 'trigger', what: 'onStart' }); this.startBeat(R, T.beat); } });
    this.resumeAll(R);
    this.tail(R, 0);
    return null;
  }
  /** Stop the running program: everything it holds let go of (drills ended, showcase: cast despawned, shift and night back, a fresh encounter under it; play: units handed to
   *  the AI), the log noted, onProgramEnd told. finished = it reached its own end (c.finish) rather than being cut off. Idempotent. */
  stop(finished = false) {
    const R = this.run; if (!R || R.ended || this.exiting) return;
    this.exiting = true;
    try {
      for (const gd of [...this.shown]) this.showMan(gd, false);
      for (const b of R.beats) if (b.state === 'running') { b.state = 'cancelled'; try { b.it.return(); } catch { /* a finally that throws is nobody's problem now */ } this.push({ beat: b.name, kind: 'beat', what: 'cancelled', data: { step: b.step } }); }
      for (const d of R.drills) this.endDrill(R, d);
      if (R.show) {
        for (const u of [...R.units.values()]) despawnUnit(this.g, u.gd);   // the cast out of the world (lights, meter keys, every hand on them) — before the night comes back, as the show always did it
        R.units.clear();
        this.exitShow(R);
      } else {
        for (const u of R.units.values()) if (u.gd.script && u.gd.state !== 'dead') endGuardScript(u.gd, u.gd.team === 'guard' ? 'search' : 'alert');   // a play program's men are real men now: to the AI, armed men never left frozen
        for (const b of R.beats) for (const id of b.touched) { if (R.units.has(id)) continue; const gd = this.g.guards.find(x => x.char.id === id); if (gd && gd.script && gd.state !== 'dead' && !R.drills.some(d => !d.done && d.men.includes(gd))) endGuardScript(gd, gd.team === 'guard' ? 'search' : 'alert'); }   // … and the STAFF men a beat took in hand (c.unit + c.order) likewise
        this.restoreSystems(R);
      }
      R.ended = true; this.push({ beat: '', kind: 'program', what: finished ? 'finished' : 'stopped' });
      this.lastRun = { serial: R.serial, name: R.name, t: R.t, finished }; this.run = null; this.frame = null;
      this.dueKeys.clear(); this.dueClicks = 0;   // a key a beat queued for the next frame is nobody's now
    } finally { this.exiting = false; }
    this.onProgramEnd?.(R.name, finished);
  }
  /** Game.restartEncounter under a PLAY program (Shift+Enter, the pause card, a checkpoint load): its men are gone with the reset — the program ends where it stood. A showcase's own restore restarts the encounter itself (exiting): not this. */
  onEncounterRestart() { if (this.run && !this.run.ended && !this.exiting && !this.run.show) { this.push({ beat: '', kind: 'program', what: 'reset' }); this.run.units.clear(); this.stop(false); } }

  // ---------------------------------------------------------------- the tick
  /** Once a frame from Game.update, immediately before tacticsTick. A return on its first line when nothing runs. */
  tick(dt: number, input: Input | null, cam: FollowCamera | null) {
    if (input) this.input = input; if (cam) this.cam = cam;
    const R = this.run; if (!R || R.ended) return;
    R.t += dt; R.dt = dt; R.tickN++;
    if (R.show?.shot) R.show.shot.t += dt;
    // drills first: the men are sequenced for this frame before any beat reads where a drill has got to
    for (const d of R.drills) this.tickDrill(R, d, dt);
    this.tickTracks(R, dt); this.tickBursts(R); this.tickKicks(R); this.tickShown();
    // this frame's news: hearing events not seen before (pushed since the last tick — the guards' from the end of last frame, Sam's from this one), signals raised since
    const fresh: EventView[] = [];
    for (const e of this.g.events) { if (this.seen.has(e)) continue; this.seen.add(e); fresh.push(viewOf(this.g, R, e)); }
    for (; R.sigSeen < R.signals.length; R.sigSeen++) { const s = R.signals[R.sigSeen]; fresh.push(signalView(this.g, R, s)); }
    this.fireTriggers(R, fresh);
    this.resumeAll(R, fresh);
    if (this.run === R && !R.ended) this.tail(R, dt);
  }
  private fireTriggers(R: Run, fresh: EventView[]) {
    const T = R.def.triggers;
    for (let i = 0; i < T.length; i++) {
      if (R.fired.has(i)) continue; const t = T[i]; let go = false; let ev: EventView | undefined;
      try {
        switch (t.kind) {
          case 'start': break;
          case 'after': go = R.t >= t.secs!; break;
          case 'event': ev = fresh.find(e => e.kind === t.event && (!t.filter || t.filter(e))); go = !!ev; break;
          case 'signal': ev = fresh.find(e => e.kind === 'signal' && e.name === t.name); go = !!ev; break;
          case 'enter': go = this.insideVolume(R, t.volume!, t.who ?? 'sam'); break;
          case 'when': go = t.pred!(this.queryOf(R)); break;
        }
      } catch (e) { R.fired.add(i); this.push({ beat: t.beat, kind: 'error', what: `trigger ${t.kind} → '${t.beat}' threw and is disarmed — ${(e as Error).message ?? e}` }); if (this.strict) throw e; continue; }
      if (!go) continue;
      R.fired.add(i);   // (M1: every trigger fires at most once a run — once:false re-arming waits for a beat that can be asked whether it may run again)
      this.push({ beat: t.beat, kind: 'trigger', what: t.kind + (t.kind === 'after' ? ` ${t.secs}s` : t.kind === 'event' ? ` ${t.event}` : t.kind === 'signal' ? ` ${t.name}` : t.kind === 'enter' ? ` ${t.volume}` : t.kind === 'when' ? ` ${t.label}` : ''), ...(ev ? { data: { at: [+ev.pos[0].toFixed(2), 0, +ev.pos[2].toFixed(2)] } } : {}) });
      this.startBeat(R, t.beat);
    }
  }
  private startBeat(R: Run, name: string): LiveBeat | null {
    const B = R.def.beats.get(name); if (!B) { this.push({ beat: name, kind: 'error', what: `no beat '${name}'` }); return null; }
    const cur = R.byName.get(name); if (cur && cur.state === 'running') return cur;   // (already running: a second trigger for it is a no-op, not a second copy)
    const flow = { finish: false };
    const lb: LiveBeat = { name, it: null as unknown as LiveBeat['it'], waiting: null, result: { index: 0 }, t0: R.t, step: 0, state: 'running', touched: new Set(), pinnedCamera: false, ctx: null as unknown as BeatCtx, flow };
    lb.ctx = this.ctxOf(R, lb); lb.it = B.fn(lb.ctx);
    if (cur) { const i = R.beats.indexOf(cur); if (i >= 0) R.beats.splice(i, 1); }   // (a beat re-started after it ended REPLACES its spent record: a play program restarting one in a loop must not grow the list every pass walks)
    R.beats.push(lb); R.byName.set(name, lb);
    this.push({ beat: name, kind: 'beat', what: 'start' });
    return lb;
  }
  /** resume every running beat whose condition holds, in start order (a beat started by another this pass is resumed in the same pass, after it) — and pass again while any
   *  beat moved, so a beat waiting on another's end / flag sees it the tick it happens whatever their order (≤ MAX_PASSES; conditions are cheap and mostly false) */
  private resumeAll(R: Run, fresh: EventView[] = []) {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let moved = false;
      for (const b of [...R.beats]) { if (this.run !== R || R.ended) break; if (b.state === 'running' && this.resume(R, b, fresh)) moved = true; }   // (a snapshot: a beat re-started from inside another replaces its record in R.beats — startBeat — and must not shift the pass off a running neighbour; a beat started this pass is picked up by the next pass, which `moved` guarantees)
      if (!moved || this.run !== R || R.ended) break;
    }
  }
  /** → did the beat advance at all */
  private resume(R: Run, b: LiveBeat, fresh: EventView[]): boolean {
    let n = 0;
    while (b.state === 'running') {
      if (b.waiting) { const r = this.holds(R, b.waiting, fresh); if (!r) return n > 0; b.result = r; b.waiting = null; }
      if (++n > MAX_RESUMES) { this.failBeat(R, b, new BeatFailure(`resumed ${MAX_RESUMES} times in one tick without waiting — a runaway loop`)); return true; }
      let out: IteratorResult<Cond, void>;
      try { out = b.it.next(b.result); }
      catch (e) { this.failBeat(R, b, e); return true; }
      if (this.run !== R || R.ended) return true;   // (the beat stopped the program from inside)
      b.step++;
      if ((b.state as LiveBeat['state']) === 'cancelled') { try { b.it.return(); } catch { /* */ } return true; }   // (it cancelled itself during that step: closed here, logged there, never also 'done')
      if (out.done) { b.state = 'done'; this.push({ beat: b.name, kind: 'beat', what: 'done', data: { step: b.step, secs: +(R.t - b.t0).toFixed(3) } }); if (b.flow.finish) this.beginFinish(R); return true; }
      const c = out.value; if (!c || typeof c !== 'object' || !('k' in c)) { this.failBeat(R, b, new BeatFailure(`yielded something that is not a condition (${String(c)}) — yield c.wait(…) / c.until(…) / c.on(…) / c.done(…) / c.any(…) / c.all(…)`)); return true; }
      b.waiting = c; const lab = condLabel(c); if (lab) this.push({ beat: b.name, kind: 'yield', what: lab });
      if (b.flow.finish) { this.beginFinish(R); }
    }
    return n > 0;
  }
  /** does condition `c` hold this tick? → the result handed back into the generator (null = keep waiting) */
  private holds(R: Run, c: Cond, fresh: EventView[]): CondResult | null {
    switch (c.k) {
      case 'time': return R.t >= c.until ? { index: 0 } : null;
      case 'frames': return R.tickN >= c.due ? { index: 0 } : null;   // (frames(1) yielded on tick k holds from tick k+1)
      case 'pred': return c.test(this.queryOf(R)) ? { index: 0 } : null;
      case 'event': { if (c.got) return { index: 0, event: c.got }; if (R.tickN === c.tick0) return null; const ev = fresh.find(e => e.kind === c.kind && (c.kind !== 'signal' || !c.name || e.name === c.name) && (!c.filter || c.filter(e))); if (ev) { c.got = ev; return { index: 0, event: ev }; } return null; }
      case 'beat': { let d: (typeof R.drills)[number] | undefined; for (let i = R.drills.length - 1; i >= 0; i--) if (R.drills[i].ref.beat === c.name) { d = R.drills[i]; break; }   // (the LATEST drill under that pseudo-beat name — a second drill.breach in one run must not read 'done' off the first; drillOf agrees)
        if (d) return (c.state === 'done' ? d.done : true) ? { index: 0 } : null; const lb = R.byName.get(c.name); if (!lb) return null; return c.state === 'started' || lb.state !== 'running' ? { index: 0 } : null; }
      case 'all': { let ok = true, ev: EventView | undefined; for (const x of c.of) { const r = this.holds(R, x, fresh); if (!r) ok = false; else ev = r.event ?? ev; } return ok ? { index: 0, event: ev } : null; }   // (EVERY branch evaluated every tick — an event branch latches what it caught, a wait counts from the yield — and it holds the tick all do at once)
      case 'any': { for (let i = 0; i < c.of.length; i++) { const r = this.holds(R, c.of[i], fresh); if (r) return { index: i, event: r.event }; } return null; }
    }
  }
  private failBeat(R: Run, b: LiveBeat, e: unknown) {
    b.state = 'failed';
    const msg = (e as Error)?.message ?? String(e);
    this.push({ beat: b.name, kind: 'error', what: `threw at step ${b.step}: ${msg}` });
    if (typeof console !== 'undefined') console.error(`director: beat '${R.name}/${b.name}' failed at step ${b.step} — ${msg}`);
    for (const id of b.touched) { const u = R.units.get(id); const gd = u ? u.gd : this.g.guards.find(x => x.char.id === id) ?? null; if (gd && gd.script && gd.state !== 'dead' && !R.drills.some(d => !d.done && d.men.includes(gd))) endGuardScript(gd, gd.team === 'guard' ? 'search' : 'alert'); }   // armed men are never left frozen (a man a live drill still holds stays the drill's)
    if (b.pinnedCamera && this.cam) { this.cam.pin = null; if (R.show) R.show.shot = null; }
    if (this.strict) throw e;
    if (R.show && !R.finishing) { R.failedShow = true; this.beginFinish(R); }   // a broken show does not hold the screen: cut, restore, and report it stopped rather than finished
  }
  private beginFinish(R: Run) {
    if (R.finishing || R.ended) return; R.finishing = true;
    this.push({ beat: '', kind: 'program', what: 'finish' });
    if (R.show) { R.show.ending = { t: 0 }; for (const b of R.beats) if (b.state === 'running') { b.state = 'cancelled'; try { b.it.return(); } catch { /* */ } this.push({ beat: b.name, kind: 'beat', what: 'cancelled', data: { step: b.step } }); } }   // the cut: the shots freeze where they are, the veil comes up in the tail
    else this.stop(true);
  }
  /** the end of every tick (and of start(), with dt 0): scripted bursts' cadence, the showcase's camera shot / veil / cut, the frame main.ts reads */
  private tail(R: Run, dt: number) {
    const S = R.show; if (!S) { this.frame = null; return; }
    if (S.ending && S.handedOver) { this.stop(!R.failedShow); return; }   // handed over already (c.handover): the end is quiet — no veil, no restore, the caption simply goes
    if (S.ending) {   // the veil up over endVeil, held to endHold, then everything back under black (the old Breach.update's ending branch, arithmetic and all)
      S.ending.t += dt; S.fade = Math.min(1, S.fade + dt / (R.def.opts.endVeil ?? 0.35));
      if (S.ending.t > (R.def.opts.endHold ?? 0.5) && S.fade >= 1) { this.stop(!R.failedShow); return; }
    } else {
      if (S.shot && this.cam && !S.handedOver) this.frameShot(S, S.shot, dt);
      if (S.fadeRate > 0 && S.fade !== S.fadeTo) { const step = dt * S.fadeRate; S.fade = S.fade < S.fadeTo ? Math.min(S.fadeTo, S.fade + step) : Math.max(S.fadeTo, S.fade - step); }
    }
    this.frame = { look: S.handedOver ? null : v3.copy(S.look), caption: S.caption, sub: S.sub, fade: S.fade, lowerThird: !!R.def.opts.lowerThird && !S.handedOver, program: R.name, handedOver: S.handedOver };
  }
  /** one camera set-up for this frame — breach.ts's Shot evaluation verbatim: the look-at locked to (or following at `track`) the shot's point, yaw and distance eased hold–swing–hold across the shot, pitch fixed, pinned */
  private frameShot(S: ShowState, shot: Shot, dt: number) {
    const s = shot.spec; const want = this.lookOf(s);
    if (s.track && shot.t > 1e-3) { const k = s.track; S.look = [damp(S.look[0], want[0], k, dt), damp(S.look[1], want[1], k, dt), damp(S.look[2], want[2], k, dt)]; } else S.look = want;
    const u = smoothstep(0.1, 0.9, shot.t / s.dur);
    const yaw = (s.yawTo !== undefined ? s.yaw + wrapAngle((s.yawTo - s.yaw) * DEG) / DEG * u : s.yaw) * DEG;
    const dist = s.distTo !== undefined ? s.dist + (s.distTo - s.dist) * u : s.dist;
    this.cam!.pin = { look: v3.copy(S.look), yaw, pitch: s.pitch * DEG, dist };
  }
  private lookOf(s: CameraShotSpec): Vec3 { const p = typeof s.look === 'function' ? s.look() : this.placeOf(s.look); return [p[0], s.lookY ?? 0.8, p[2]]; }

  // ---------------------------------------------------------------- showcase plumbing (Breach.start / restore, generalised: every show did exactly this by hand)
  private enterShow(R: Run) {
    const g = this.g, cam = this.cam, input = this.input;
    R.show = { saved: { ai: g.aiEnabled, god: g.godMode, invisible: g.playerInvisible, quiet: g.quietUtility, touring: g.touring, cam: cam ? { yaw: cam.yaw, pitch: cam.pitch, dist: cam.desiredDistance } : null },
      look: v3.copy(g.followPos()), shot: null, shotI: -1, chapterT0: 0, chapters: [], caption: '', sub: '', fade: 0, fadeTo: 0, fadeRate: 0, ending: null, benched: null, variantOn: false, puppet: false, weatherSaved: null, missionOn: false, handedOver: false, chaosSet: false };
    g.quietUtility = true; g.touring = true;                        // the tour's terms: nothing here is the mission's, the alarm's or the log's business
    g.clearAftermath(); g.smoke.clearAll?.(); cancelActions(g);
    for (const d of g.doors.list) d.reset();
    if (g.player.down || R.def.opts.freshEncounter) g.restartEncounter();   // (freshEncounter: the shift on its route starts, the level as authored, a full kit — a show that orders the level's own men on cue starts them from t = 0)
    g.aiEnabled = true; g.godMode = true; g.playerInvisible = true;
    g.player.holstered = true; g.player.crouch = false; g.player.nv = false; g.player.nvAmount = 0;   // (a man who had night vision on does not watch a show through the tube — N is locked out for its length)
    if (input) { input.lockExcept = new Set(['KeyP']); input.keys.clear(); input.buttons = 0; }
    this.dueKeys.clear(); this.dueClicks = 0;
    g.msg(`${R.name} — P to stop`);
  }
  private exitShow(R: Run) {
    const g = this.g, S = R.show!, cam = this.cam, input = this.input, sv = S.saved;
    this.restoreWeather(S); this.restoreChaos(S);
    if (S.handedOver) {   // c.handover gave the player the fresh encounter, his flags, his camera and his keys already: only the show's own two flags are left to drop
      g.touring = sv.touring; g.missionInTour = false;
      this.push({ beat: '', kind: 'note', what: 'restore', data: { handedOver: true } });
      return;
    }
    if (S.benched) { for (const gd of S.benched) if (!g.engine.lights.lights.includes(gd.flashlight)) g.engine.lights.add(gd.flashlight); g.guards = [...S.benched, ...g.guards]; S.benched = null; }   // the shift back on the list (ahead of anything left) — their torches back in the light list (benched men's torches LEAVE it: three steady slots of headroom under MAX_LIGHTS for a show's cast; wave-5 review) — before the encounter is rebuilt from those very objects
    if (S.variantOn) { setDaylight(g, false); S.variantOn = false; }
    g.missionInTour = false;
    g.clearAftermath(); g.smoke.clearAll?.(); g.restartEncounter();   // (aftermath first: the fresh shift must not hear the room being taken)
    if (cam) cam.pin = null;
    g.aiEnabled = sv.ai; g.godMode = sv.god; g.playerInvisible = sv.invisible; g.quietUtility = sv.quiet; g.touring = sv.touring;
    openingStart(g);   // (opening.ts: the fresh shift was made under the show's flags — now that they are down it is the player's night, and the card's still view should already show it)
    if (cam && sv.cam) { cam.yaw = sv.cam.yaw; cam.pitch = sv.cam.pitch; cam.distance = cam.desiredDistance = sv.cam.dist; }
    if (cam) { const p = g.followPos(); cam.target = v3.copy(p); cam.desired = v3.copy(p); }
    if (S.puppet) g.puppet = null;
    if (g.blackout.active && !g.blackout.permanent) g.endBlackout();   // a trip the show threw is the show's (restartEncounter mends fixtures, not the mains: the tour ended its own the same way)
    if (input) { input.lockExcept = null; input.keys.clear(); input.buttons = 0; }
    this.push({ beat: '', kind: 'note', what: 'restore' });
  }
  /** the storm's knobs back as c.weather found them (its dice run on: a re-seed is not undone, nor need it be) */
  private restoreWeather(S: ShowState) { const w = S.weatherSaved; if (!w) return; const Wx = this.g.weather; if (Wx) { Wx.storm = w.storm; Wx.rainRate = w.rain; } S.weatherSaved = null; }
  /** the program's own destruction knob dropped (c.chaos): from here chaosOf reads the player's knob again — 0 under the tour — and the restore's destr.reset() puts back what it broke */
  private restoreChaos(S: ShowState) { if (!S.chaosSet) return; if (this.g.destr) this.g.destr.showChaos = null; S.chaosSet = false; }
  /** THE HAND-OVER (c.handover): what the tour's last stop did by hand — under a quick veil a fresh encounter (guards, lights, props, you at the insertion point, nothing in the air), the
   *  player's flags live (seen, mortal unless he had god mode on, the mission counting, his AI setting), the follow camera released onto him at the framing he had, his keys unlocked; the
   *  caption stays up as the top card until the program's last beat finishes; the veil is left WHOLE for the beat to lift (c.fade(0, secs) a beat later). Idempotent. */
  private handOver(R: Run, caption: string, sub: string, caller: LiveBeat | null = null) {
    const g = this.g, S = R.show!, cam = this.cam, input = this.input, sv = S.saved;
    if (S.handedOver) { S.caption = caption; S.sub = sub; return; }
    for (const b of R.beats) if (b.state === 'running' && b !== caller) { b.state = 'cancelled'; try { b.it.return(); } catch { /* */ } this.push({ beat: b.name, kind: 'beat', what: 'cancelled', data: { step: b.step, why: 'handover' } }); }   // (every OTHER beat ends here: the men it held are about to be replaced by the fresh encounter's — resetGuards reuses their ids, so a later c.order / c.say of theirs would land on the player's live shift and freeze a man for good; wave-5 review)
    this.restoreWeather(S); this.restoreChaos(S);
    for (const u of [...R.units.values()]) despawnUnit(g, u.gd);   // a cast this program spawned leaves before the encounter restarts (never restartEncounter with units in the list — the same order stop() keeps)
    R.units.clear(); R.kicks.length = 0; R.tracks.length = 0; R.bursts.length = 0;   // (and everything of theirs in flight: a kick landing after the hand-over would kickIn a live floor's door from a man who has left)
    if (S.benched) { for (const gd of S.benched) if (!g.engine.lights.lights.includes(gd.flashlight)) g.engine.lights.add(gd.flashlight); g.guards = [...S.benched, ...g.guards]; S.benched = null; }
    if (S.variantOn) { setDaylight(g, false); S.variantOn = false; }
    g.puppet = null; S.puppet = false; g.missionInTour = false; S.missionOn = false;
    if (g.blackout.active && !g.blackout.permanent) g.endBlackout();
    g.clearAftermath(); g.smoke.clearAll?.(); g.restartEncounter();
    g.playerInvisible = false; g.godMode = sv.god; g.aiEnabled = sv.ai; g.quietUtility = false;   // live from here: the mission counts, no god mode unless the player had it on
    S.shot = null; for (const b of R.beats) b.pinnedCamera = false;
    if (cam) { cam.pin = null; if (sv.cam) { cam.yaw = sv.cam.yaw; cam.pitch = sv.cam.pitch; cam.distance = cam.desiredDistance = sv.cam.dist; } const p = g.followPos(); cam.target = v3.copy(p); cam.desired = v3.copy(p); }
    if (input) { input.lockExcept = null; input.keys.clear(); input.buttons = 0; }
    this.dueKeys.clear(); this.dueClicks = 0;
    S.caption = caption; S.sub = sub; S.chapters = []; S.handedOver = true;
    S.fade = 1; S.fadeTo = 1; S.fadeRate = 0;   // the cut to the fresh floor happens under a WHOLE veil that stays until the beat lifts it (c.fade(0, secs) a beat later — the tour held its cuts black a tenth of a second the same way); a beat that never does still ends: finish → exitShow drops the veil
    this.push({ beat: '', kind: 'note', what: 'handover' });
  }
  private applySystems(R: Run) {
    const M = this.manifest!.systems; if (M.qrf === undefined && M.needs === undefined && M.civilians === undefined && M.autosave === undefined) return;
    const g = this.g, S: NonNullable<Run['systemsSaved']> = R.systemsSaved = {};   // (only what the script set is kept, so only that is put back: a setting the player changed under the program stays his)
    if (M.qrf !== undefined) S.qrf = g.tune.qrf; if (M.needs !== undefined) S.needs = g.tune.needs; if (M.civilians !== undefined) S.civilians = g.tune.civilians; if (M.autosave !== undefined) S.autosave = g.saves.enabled;
    if (M.qrf !== undefined) g.tune.qrf = M.qrf; if (M.needs !== undefined) g.tune.needs = M.needs; if (M.civilians !== undefined) g.tune.civilians = M.civilians; if (M.autosave !== undefined) g.saves.enabled = M.autosave;
  }
  private restoreSystems(R: Run) { const s = R.systemsSaved; if (!s) return; const g = this.g; if (s.qrf !== undefined) g.tune.qrf = s.qrf; if (s.needs !== undefined) g.tune.needs = s.needs; if (s.civilians !== undefined) g.tune.civilians = s.civilians; if (s.autosave !== undefined) g.saves.enabled = s.autosave; R.systemsSaved = null; }

  // ---------------------------------------------------------------- drills
  private tickDrill(R: Run, D: DrillRun, dt: number) {
    const I = D.impl;
    if (I.kind === 'breach') {   // (ticked past its own 'done' too, as the show always ticked it: its clock runs on for since('done'), its men keep settling on the stack)
      I.d.tick(dt); D.t = I.d.t; D.phase = I.d.phase;
      for (; I.forwarded < I.d.beats.length; I.forwarded++) { const b = I.d.beats[I.forwarded]; if (!D.times.has(b.what)) D.times.set(b.what, b.t); this.push({ t: b.t, beat: D.owner, kind: 'drill', what: b.what }); if (b.what === 'abort') D.aborted = true; }
      if (I.d.phase === 'done' && !D.done) { D.done = true; D.cleared = !D.aborted && I.d.hostiles.every(h => h.state === 'dead' || runnerFled(h)); }
      return;
    }
    if (D.done) return;
    if (I.kind === 'clear') {
      I.clock += dt; D.t = I.clock; I.d.tick(I.clock, dt);
      if (I.d.phase !== I.lastPhase) { I.lastPhase = I.d.phase; D.phase = I.d.phase; D.times.set(I.d.phase, I.clock); this.push({ t: I.clock, beat: D.owner, kind: 'drill', what: `${D.ref.name}:${I.d.phase}` }); }
      if (!I.d.intact) { D.done = true; D.aborted = true; this.push({ beat: D.owner, kind: 'drill', what: `${D.ref.name}:broken` }); }
      else if (I.d.complete) { D.done = true; D.cleared = true; this.push({ beat: D.owner, kind: 'drill', what: `${D.ref.name}:complete` }); }
    } else if (I.kind === 'hold') {
      D.t += dt; if (!D.done && D.men.every(m => m.state === 'dead' || !!m.script?.arrived)) { D.done = true; D.cleared = true; D.phase = 'set'; this.push({ beat: D.owner, kind: 'drill', what: `${D.ref.name}:set` }); }
    } else {
      D.t += dt; if (I.e.done && !D.done) { D.done = true; D.phase = I.e.result?.outcome ?? 'done'; D.cleared = D.phase === 'cleared'; D.aborted = D.phase === 'wiped' || D.phase === 'reset'; this.push({ beat: D.owner, kind: 'drill', what: `${D.ref.name}:${D.phase}`, data: I.e.result ? { secs: +I.e.result.secs.toFixed(2), kills: I.e.result.kills.length } : undefined }); }
    }
  }
  private endDrill(R: Run, D: DrillRun) {
    const I = D.impl;
    if (I.kind === 'breach') I.d.end();
    else if (I.kind === 'clear') I.d.end(R.show ? 'patrol' : 'search');
    else if (I.kind === 'hold') { for (const m of D.men) if (m.script && m.state !== 'dead') endGuardScript(m, R.show ? 'patrol' : m.team === 'guard' ? 'search' : 'alert'); }
    D.done = true;
  }
  /** men a beat has put in the picture through the fog (c.show). A man is shown only while a script holds him: let go by his beat, handed back by a beat that
   *  failed or was cancelled, taken out of its hand by the game (a door thrown into him), or the program stopped, he is the fog's own again */
  private shown = new Set<Guard>();
  private showMan(gd: Guard, on: boolean) { if (on) this.shown.add(gd); else if (!this.shown.delete(gd)) return; this.g.fogOfWar.show(gd, on); }
  private tickShown() { for (const gd of [...this.shown]) if (!gd.script || gd.state === 'dead') this.showMan(gd, false); }
  private tickBursts(R: Run) {
    for (const B of R.bursts) {
      if (B.left <= 0) continue;
      const gd = R.units.get(B.u.id)?.gd ?? this.g.guards.find(x => x.char.id === B.u.id);   // (a man the program spawned, or one of the level's own it took in hand: c.unit)
      const u = gd ? { gd, ref: B.u } : null; if (!u || u.gd.state === 'dead') { B.left = 0; continue; }
      if (R.t < B.next || u.gd.weapon.reloading) continue;
      const at = 'kind' in B.at && B.at.kind === 'unit' ? (() => { const id = (B.at as UnitRef).id, v = R.units.get(id)?.gd ?? this.g.guards.find(x => x.char.id === id); return v ? (v.char.bones.chest ?? v3.add(v.char.pos, [0, 1.1, 0])) : null; })() : (() => { const p = this.placeOf(B.at as Place); return [p[0], (B.at as Vec3)[1] || 1.1, p[2]] as Vec3; })();
      if (!at) { B.left = 0; continue; }
      if (u.gd.weapon.fire()) { fireWeapon(this.g, u.gd.char, at, false, { steady: true, spread: B.spread }); B.left--; B.fired++; B.next = R.t + B.cadence; }   // a scripted round is a REAL round: hits, suppression, marks, heat, glass, hearing all follow from combat.ts
      else u.gd.weapon.rearm();
      if (B.left <= 0) this.push({ beat: '', kind: 'stimulus', what: 'burst:done', data: { by: u.ref.callsign, rounds: B.fired } });
    }
    if (R.bursts.some(B => B.left <= 0)) R.bursts = R.bursts.filter(B => B.left > 0);   // (a beat's cond holds its own record, not the list: the finished leave it — a long program fires hundreds)
  }
  /** aim points ordered onto a MAN (c.order aimAt: unit): his chest re-read into the very vector the runner points the gun along, eased at 14/s (the breach drill's own muzzle snap) — dropped
   *  the moment the tracker is dead, off his script, or has been handed another aim point (the vector is no longer his script's) */
  private tickTracks(R: Run, dt: number) {
    if (!R.tracks.length) return;
    R.tracks = R.tracks.filter(T => T.gd.state !== 'dead' && T.gd.script && T.gd.script.aimAt === T.vec);
    for (const T of R.tracks) { const ch = T.tgt.char.bones.chest ?? v3.add(T.tgt.char.pos, [0, T.tgt.state === 'dead' ? 0.3 : 1.1, 0]); T.vec[0] = damp(T.vec[0], ch[0], 14, dt); T.vec[1] = damp(T.vec[1], ch[1], 14, dt); T.vec[2] = damp(T.vec[2], ch[2], 14, dt); }
  }
  /** kicks in the air (c.doors.kick): on the animator's impact frame (or the instant the clip is somehow over) doors.ts kickIn does the boot's work from where he stands — squad.ts RoomClear's own test */
  private tickKicks(R: Run) {
    if (!R.kicks.length) return;
    R.kicks = R.kicks.filter(K => {
      const an = K.gd.char.anim; if (K.gd.state === 'dead') return false;
      if (!(an.kickImpact || an.kickTime >= KICK_IMPACT || !an.kicking)) return true;
      const g = this.g, c = K.gd.char, d = K.door;
      g.doors.kickIn(d, c.pos, c.id); kickScuff(g, d, c.pos);   // (kickIn's DoorEvent 'kick' → game.ts puffs the jamb, splinters the keep, files the thud — as for any kick; the sole's scuff on the leaf is the caller's, as in player.ts)
      this.push({ beat: K.beat, kind: 'stimulus', what: `kick ${d.def.name}`, data: { by: K.by, angle: +d.angle.toFixed(2) } });
      return false;
    });
  }

  // ---------------------------------------------------------------- resolving handles
  placeOf(p: Place): Vec3 {
    if (Array.isArray(p)) return p as Vec3;
    const lm = (this.g.level.marks ?? []).find(m => m.name === p.id); if (lm) return lm.pos;
    const m = this.manifest?.marks.get(p.id); if (m?.pos) return m.pos;
    throw new BeatFailure(`mark '${p.id}' does not resolve`);
  }
  private doorOf(d: DoorRef): Door { const door = this.g.doors.byName(d.id); if (!door) throw new BeatFailure(`door '${d.id}' does not resolve`); return door; }
  private guardOf(R: Run, u: UnitRef): Guard {
    const rec = R.units.get(u.id); if (rec) return rec.gd;
    if (R.show?.handedOver) throw new BeatFailure(`unit ${u.callsign} (#${u.id}) belongs to the live floor after the hand-over`);   // (belt and braces with handOver cancelling the other beats)
    const gd = this.g.guards.find(x => x.char.id === u.id) ?? R.show?.benched?.find(x => x.char.id === u.id); if (gd) return gd;
    throw new BeatFailure(`unit ${u.callsign} (#${u.id}) is not in the world`);
  }
  private planOf(p: PlanRef): BreachPlan | RoomClearPlan {
    if (p.plan === 'breach') { const B = this.g.level.breach; if (!B) throw new BeatFailure(`the level has no breach plan`); return B; }
    const P = (this.g.level.clearPlans ?? []).find(x => x.room === p.id || x.door === p.id); if (!P) throw new BeatFailure(`no room-clear plan '${p.id}'`); return P;
  }
  private insideVolume(R: Run, id: string, who: 'sam' | 'anyUnit' | 'team' | UnitRef): boolean {
    const V = (this.g.level.volumes ?? []).find(v => v.name === id); if (!V) return false;
    const test = (p: Vec3) => { const px = p[0] - V.c[0], pz = p[2] - V.c[2]; const cs = Math.cos(V.yaw ?? 0), sn = Math.sin(V.yaw ?? 0); const lx = cs * px - sn * pz, lz = sn * px + cs * pz; return Math.abs(lx) <= V.h[0] && Math.abs(lz) <= V.h[2] && p[1] >= V.c[1] - V.h[1] - 0.1 && p[1] <= V.c[1] + V.h[1] + 2; };   // (world → the volume's local frame with the boxes' own convention — scene/collision.ts rayBox — feet anywhere from its floor to head height inside count)
    if (who === 'sam') return !this.g.player.down && test(this.g.player.char.pos);
    if (who === 'team') { if (!this.g.player.down && test(this.g.player.char.pos)) return true; for (const gd of this.g.guards) if (gd.team === 'operative' && gd.state !== 'dead' && test(gd.char.pos)) return true; return false; }
    if (who === 'anyUnit') { for (const u of R.units.values()) if (u.gd.state !== 'dead' && test(u.gd.char.pos)) return true; return false; }
    const gd = R.units.get(who.id)?.gd; return !!gd && gd.state !== 'dead' && test(gd.char.pos);
  }
  private queryOf(R: Run): Query {
    if (R.query) return R.query;
    const g = this.g, self = this;
    return R.query = {
      get t() { return R.t; }, get time() { return g.time; }, get escalation() { return g.escalation; }, get mainsOn() { return !g.blackout.active; }, get daylight() { return isDaylight(g); },
      alive: u => { const rec = R.units.get(u.id) ?? null; const gd = rec?.gd ?? g.guards.find(x => x.char.id === u.id); return !!gd && gd.state !== 'dead'; },
      arrived: u => !!self.guardOf(R, u).script?.arrived,
      state: u => { try { return self.guardOf(R, u).state; } catch { return null; } },
      room: u => roomOf(u === 'sam' ? g.player.char.pos : self.guardOf(R, u).char.pos, g.level),
      pos: u => { if (u === 'sam') { if (!R.show) throw new BeatFailure(`query.pos('sam') is showcase-only`); return v3.copy(g.player.char.pos); } if ('kind' in u && u.kind === 'unit') return v3.copy(self.guardOf(R, u).char.pos); return v3.copy(self.placeOf(u as Place)); },
      door: d => { const D = self.doorOf(d); return { angle: D.angle, open: !D.isClosed(), latched: D.latched, locked: D.locked, broken: D.lockBroken, swing: DOORWAY.oneWay ? D.swing : 0 }; },
      groupOn: gr => g.targets.some(t => t.group === gr.id && t.on),
      inside: (v, who) => self.insideVolume(R, v.id, who),
      plan: ((p: PlanRef) => self.planOf(p)) as Query['plan'],
      flag: n => R.flags[n],
      signalled: n => R.signals.some(s => s.name === n),
      routed: u => { try { return runnerOwns(self.guardOf(R, u)); } catch { return false; } },
    };
  }

  // ---------------------------------------------------------------- the context a beat is handed
  private ctxOf(R: Run, b: LiveBeat): BeatCtx {
    const g = this.g, self = this;
    const showOnly = (verb: string): ShowState => { if (!R.show) throw new BeatFailure(`c.${verb}(…) is showcase-only — declare the program { showcase: true } (decision 4: a play program never frames a shot or touches the player)`); return R.show; };
    const unitRefOf = (gd: Guard): UnitRef => ({ kind: 'unit', id: gd.char.id, callsign: gd.callsign });
    const touch = (u: UnitRef) => { b.touched.add(u.id); };
    const orderNow = (u: UnitRef, o: OrderPatch) => {
      const gd = this.guardOf(R, u); touch(u);
      const patch: Partial<GuardScript> = {};
      if (o.goal !== undefined) patch.goal = o.goal === null ? null : v3.copy(this.placeOf(o.goal));
      if (o.aimAt !== undefined) {
        R.tracks = R.tracks.filter(T => T.gd !== gd);   // any earlier man he was tracking: let go
        if (o.aimAt === null) patch.aimAt = null;
        else if ('kind' in o.aimAt && o.aimAt.kind === 'unit') { const tgt = this.guardOf(R, o.aimAt); const vec = v3.copy(tgt.char.bones.chest ?? v3.add(tgt.char.pos, [0, 1.1, 0])); patch.aimAt = vec; R.tracks.push({ gd, vec, tgt }); }   // a MAN: the point follows his chest from here (tickTracks) until this man is handed another aim
        else patch.aimAt = v3.copy(this.placeOf(o.aimAt as Place));
      }
      for (const k of ['speed', 'face', 'strafe', 'stance', 'stackSide', 'crouch', 'upper', 'light', 'hot', 'flinch', 'direct', 'smoke'] as const) if (o[k] !== undefined) (patch as Record<string, unknown>)[k] = o[k];
      gd.hold = false; squadOrder(gd, patch);
    };
    const mkDrill = (name: string, impl: DrillImpl, ops: UnitRef[], men: Guard[]): DrillRun => {
      const beatName = `drill:${name}`;
      const D: DrillRun = { ref: null as unknown as DrillRef, impl, beat: beatName, owner: b.name, ops, men, times: new Map(), t: 0, phase: impl.kind === 'breach' ? impl.d.phase : impl.kind === 'clear' ? impl.d.phase : impl.kind, done: false, aborted: false, cleared: false };
      D.ref = { kind: 'drill', name, beat: beatName, get phase() { return D.phase; }, get t() { return D.t; }, get done() { return D.done; }, get aborted() { return D.aborted; }, get cleared() { return D.cleared; }, since: w => { const t0 = D.times.get(w); return t0 === undefined ? NaN : D.t - t0; }, has: w => D.times.has(w), ops };
      R.drills.push(D); this.push({ beat: b.name, kind: 'note', what: `drill ${name} begun`, data: { men: men.map(m => m.callsign) } });
      return D;
    };
    const ctx: BeatCtx = {
      // ---- waiting
      wait: (secs, label) => { if (!Number.isFinite(secs)) throw new BeatFailure(`wait(${secs}): not a finite number of seconds`); return { k: 'time', until: R.t + Math.max(0, secs), label }; },
      frames: (n = 1) => ({ k: 'frames', due: R.tickN + Math.max(1, Math.floor(n)) }),
      until: (test, label = 'until') => ({ k: 'pred', test, label }),
      on: (kind, a, f) => ({ k: 'event', kind, name: typeof a === 'string' ? a : undefined, filter: typeof a === 'function' ? a : f, tick0: R.tickN }),
      done: what => ({ k: 'beat', name: typeof what === 'string' ? what : what.beat, state: 'done' }),
      started: what => ({ k: 'beat', name: what, state: 'started' }),
      all: (...of) => ({ k: 'all', of }), any: (...of) => ({ k: 'any', of }),
      // ---- flow
      start: name => { this.push({ beat: b.name, kind: 'trigger', what: `start ${name}` }); this.startBeat(R, name); },
      cancel: name => { const lb = R.byName.get(name); if (lb && lb.state === 'running') { lb.state = 'cancelled'; if (lb !== b) { try { lb.it.return(); } catch { /* */ } } this.push({ beat: name, kind: 'beat', what: 'cancelled', data: { by: b.name, step: lb.step } }); } },   // (a beat cancelling ITSELF is mid-resume: its generator cannot be returned from inside — resume() sees the state and closes it)
      signal: (name, data) => { R.signals.push({ name, t: R.t, data }); this.push({ beat: b.name, kind: 'note', what: `signal:${name}`, ...(data !== undefined ? { data } : {}) }); },
      flag: R.flags,
      note: (what, data) => this.push({ beat: b.name, kind: 'note', what, ...(data !== undefined ? { data } : {}) }),
      finish: () => { b.flow.finish = true; },
      rand: () => R.rng(),
      query: this.queryOf(R),
      get dt() { return R.dt; },
      // ---- actors
      spawn: (L, at, o = {}) => {
        const spec = this.manifest!.loadouts.get(L.id); if (!spec) throw new BeatFailure(`no loadout '${L.id}'`);
        const p = this.placeOf(at);
        const gd = spawnUnit(g, { team: spec.team, pos: [p[0], 0, p[2]], yaw: o.yaw ?? (Array.isArray(at) ? 0 : this.manifest!.marks.get(at.id)?.yaw ?? 0), weapon: spec.weapon, tint: spec.tint, tint2: spec.tint2, name: o.callsign, light: o.light ?? spec.light, budget: liftedBudget(g) });
        if ((o.light ?? spec.light) === false) gd.flashlight.enabled = false;   // dark from the first frame (attachFlashlight would leave a fresh unit's light on until his script says otherwise)
        if (spec.trained) gd.trained = true; if (spec.god && R.show) gd.god = true;   // (structural besides the lint: only a SHOWCASE run's cast can carry the net — a play program's spawn of the same loadout is mortal)
        const ref = unitRefOf(gd); R.units.set(ref.id, { ref, gd, loadout: L.id, by: b.name }); touch(ref);
        this.push({ beat: b.name, kind: 'spawn', what: gd.callsign, data: { id: ref.id, loadout: L.id, team: spec.team, at: [+p[0].toFixed(2), 0, +p[2].toFixed(2)] } });
        return ref;
      },
      despawn: u => { const rec = R.units.get(u.id); if (!rec) return; despawnUnit(g, rec.gd); R.units.delete(u.id); this.push({ beat: b.name, kind: 'spawn', what: `despawn ${u.callsign}` }); },
      unit: callsign => { const gd = g.guards.find(x => x.callsign === callsign) ?? R.show?.benched?.find(x => x.callsign === callsign); return gd ? unitRefOf(gd) : null; },
      order: orderNow,
      drillOf: what => { const name = typeof what === 'string' ? what : what.id; for (let i = R.drills.length - 1; i >= 0; i--) if (R.drills[i].ref.name === name) return R.drills[i].ref; return null; },
      arrived: u => !!this.guardOf(R, u).script?.arrived,
      show: (u, on = true) => { this.showMan(this.guardOf(R, u), on); this.push({ beat: b.name, kind: 'note', what: `${on ? 'show' : 'unshow'} ${u.callsign}` }); },
      rout: u => {
        if (R.units.has(u.id)) return false;
        const gd = this.guardOf(R, u); if (gd.state === 'dead') return false;
        if (runnerOwns(gd)) return true;
        if (!runnerBreak(g, gd)) return false;   // (asked while he is still in this beat's hand: refused, he is exactly as he was)
        if (gd.script) endGuardScript(gd, 'alert'); gd.hold = false; this.showMan(gd, false); b.touched.delete(u.id);
        this.push({ beat: b.name, kind: 'note', what: `rout ${u.callsign}` }); return true;
      },
      release: (u, state = 'search') => { const gd = this.guardOf(R, u); if (gd.script) endGuardScript(gd, state); gd.hold = false; this.showMan(gd, false); b.touched.delete(u.id); this.push({ beat: b.name, kind: 'note', what: `release ${u.callsign}`, data: { state } }); },
      drill: {
        breach: (plan, ops, o) => {
          const P = this.planOf(plan) as BreachPlan; const A = this.guardOf(R, ops[0]), B2 = this.guardOf(R, ops[1]); const H = o.hostiles.map(h => this.guardOf(R, h));
          for (const u of [...ops, ...o.hostiles]) touch(u);
          const d = new BreachDrill(g, P, A, B2, H, { guaranteeDowns: o.guaranteeDowns ?? true }); d.start();
          return mkDrill(plan.id, { kind: 'breach', d, forwarded: 0 }, [...ops], [A, B2, ...H]).ref;
        },
        clear: (plan, pair, o = {}) => {
          const P = this.planOf(plan) as RoomClearPlan; const A = this.guardOf(R, pair[0]), B2 = pair[1] ? this.guardOf(R, pair[1]) : null;
          for (const u of pair) if (u) touch(u);
          if (!o.live) { const door = g.doors.byName(P.door); if (door) { door.reset(); door.angle = 0; door.vel = 0; door.latched = true; door.closing = false; } }   // staged: something shut to breach (the plans are authored with their leaves standing open)
          const d = new RoomClear(g, P, A, B2, { live: !!o.live }); d.start();
          return mkDrill(plan.id, { kind: 'clear', d, clock: 0, lastPhase: '' }, pair.filter(Boolean) as UnitRef[], B2 ? [A, B2] : [A]).ref;
        },
        hold: (units, at, face = []) => {
          const men = units.map(u => this.guardOf(R, u));
          units.forEach((u, i) => orderNow(u, { goal: at[i] ?? at[at.length - 1], face: face[i] ?? null, stance: 'none', upper: 'aim', speed: 1.6 }));
          return mkDrill(`hold:${b.name}:${R.drills.length}`, { kind: 'hold' }, [...units], men).ref;
        },
        exchange: (a, bb, o = {}) => {
          const A = a.map(u => this.guardOf(R, u)), Bs = bb.map(u => this.guardOf(R, u)); for (const u of [...a, ...bb]) b.touched.delete(u.id);   // handed to the fight: the AI's from here, nothing of ours to release
          const e = engage(g, A, Bs, o);
          return mkDrill(`exchange:${R.drills.length}`, { kind: 'exchange', e }, [...a], [...A, ...Bs]).ref;
        },
      },
      say: (u, line, o = {}) => {
        if (u === 'sam') {   // a line over Sam (his bubble, the murmur of it, the log's 'you ▸' like his questions) — showcase-only: a play program never speaks for the player
          showOnly('say(sam)'); if (!line || g.player.down) return;
          g.player.bubble = { text: line, t: g.time, dur: Math.min(4, Math.max(1.6, 0.9 + line.length * 0.05)), radio: !!o.radio };
          g.audio.play('murmur', v3.add(g.player.char.pos, [0, 1.6, 0]), 0.2); g.note(`you ▸ ${line}`); this.push({ beat: b.name, kind: 'radio', what: `PLAYER: ${line}` }); return;
        }
        const gd = this.guardOf(R, u); if (line && gd.state !== 'dead') { guardSay(g, gd, line, !!o.radio, true); this.push({ beat: b.name, kind: 'radio', what: `${gd.callsign}${o.radio ? '' : ' (says)'}: ${line}` }); }   // (forced: a scripted line is deliberate — the man in Sam's arm answers with it too, where guards.ts say drops a held man's every other word)
      },
      learnCode: (dev, from) => {
        const K = g.devices?.keypads.find(k => k.def.name === dev.id); if (!K) throw new BeatFailure(`device '${dev.id}' is not a keypad`);
        const gd = from ? this.guardOf(R, from) : null;
        const news = devicesLearnCode(g, dev.id, 'told', gd);
        this.push({ beat: b.name, kind: 'note', what: `code ${dev.id}`, data: { from: gd?.callsign ?? null, news } });
        return news;
      },
      radio: (callsign, line) => {   // a line on the net under a name, said by that man if he stands in the world (his bubble on screen), else by the voice alone — the HUD's strip keys on 'radio: '
        const gd = g.guards.find(x => x.callsign === callsign && x.state !== 'dead');
        if (gd) { gd.bubble = { text: line, t: g.time, dur: bubbleSecs(line), radio: true }; radioHand(gd, gd.bubble.dur); chronRadio(g, gd, line); }
        g.msg(`radio: ${callsign} — ${line}`); g.audio.play('radio', gd ? (gd.char.bones.head ?? gd.char.pos) : null, gd ? 0.7 : 0.55);
        this.push({ beat: b.name, kind: 'radio', what: `${callsign}: ${line}` });
      },
      control: line => { g.msg('radio: CONTROL — ' + line); g.audio.play('radio', null, 0.55); this.push({ beat: b.name, kind: 'radio', what: `CONTROL: ${line}` }); },
      // ---- world
      lights: {
        group: (gr, on) => { setGroup(g, gr.id, on); this.push({ beat: b.name, kind: 'stimulus', what: `group ${gr.id} ${on ? 'on' : 'off'}` }); },
        mains: on => { if (on) g.endBlackout(); else g.setBlackout(1e6, 'hand'); this.push({ beat: b.name, kind: 'stimulus', what: `mains ${on ? 'on' : 'off'}` }); },
        blackout: secs => { g.setBlackout(secs, 'hand'); this.push({ beat: b.name, kind: 'stimulus', what: `blackout ${secs}s` }); },
      },
      doors: {
        lock: (d, on) => { const D = this.doorOf(d); D.locked = on; if (on) D.lockBroken = false; },
        open: (d, angle, o = {}) => { const D = this.doorOf(d); D.latched = false; D.closing = false; if (angle !== undefined) { D.angle = angle; D.vel = 0; D.place(); } else D.vel = (Math.sign(D.def.angle ?? 1) || 1) * 3.2; if (o.hold) D.quietT = -3600; },   // (hold: doors.ts wakes the closer after two seconds without a hand on the leaf — an hour of quiet is a leaf on its stay; the restore's Door.reset puts quietT back)
        fling: (d, by) => { const D = this.doorOf(d), gd = this.guardOf(R, by); if (Math.abs(D.angle) > 1.0) return; const side = g.doors.side(D, gd.char.pos); D.latched = false; D.closing = false; D.vel = -side * 7.5; D.sinceBash = 0; D.quietT = -0.5; D.creakArmed = false; D.lastWho = gd.char.id; g.audio.play('doorBash', D.pos, 0.9, { rate: 0.85 }); this.push({ beat: b.name, kind: 'stimulus', what: `fling ${d.id}`, data: { by: by.callsign } }); },   // (qrf.ts flingOpen: the crash-bar side, the bolt as it was)
        shut: d => { const D = this.doorOf(d); if (!D.latched) { D.closing = true; D.vel = -Math.sign(D.angle) * 1.2; } },
        latch: d => { const D = this.doorOf(d); D.reset(); D.angle = 0; D.vel = 0; D.latched = true; D.closing = false; D.place(); },
        kick: (d, by, o = {}) => {   // a CAUSE: the animator's kick now, doors.ts kickIn on its impact frame (tickKicks) — the keep, the leaf off the boot, the crack the floor hears, the jamb's plaster
          const D = this.doorOf(d), gd = this.guardOf(R, by); touch(by);
          if (gd.state === 'dead' || R.kicks.some(K => K.gd === gd)) return;
          squadOrder(gd, { goal: null, aimAt: null }); gd.char.anim.kickDoor({ leg: o.leg ?? 'right' });
          R.kicks.push({ door: D, gd, by: by.callsign, beat: b.name });
          this.push({ beat: b.name, kind: 'stimulus', what: `kick:start ${d.id}`, data: { by: by.callsign, leg: o.leg ?? 'right' } });
        },
        kickSpot: (d, by) => { const D = this.doorOf(d), gd = this.guardOf(R, by); const s = g.doors.kickSpot(D, gd.char.pos); return { pos: v3.copy(s.pos), yaw: s.yaw }; },
      },
      stimulus: {
        charge: (at, o) => {   // a CAUSE, never a result: the item's own fuse detonates it (combat.ts detonateStun / a plume) — the daze, the flash, the bang the floor hears, the heat destruction reads
          const gd = this.guardOf(R, o.by); const hand = gd.char.jointUnder('handL') ?? v3.add(gd.char.pos, [0, 1.3, 0]); const from: Vec3 = [hand[0], Math.max(1.0, hand[1]), hand[2]];
          const to = this.placeOf(at); const sol = g.items.solve(from, [to[0], 0, to[2]], 9);
          const it = g.items.spawn(o.kind ?? 'flash', from, sol.v0, { fuse: o.fuse ?? 1.2, who: gd.char.id, heading: v3.yawOf(sol.v0) });
          it.onBounce = (sp, p, g) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4)); g.audio.play('throw', from, 0.7);
          if (o.toss) gd.char.anim.tossItem(TOSS_QUICK);
          this.push({ beat: b.name, kind: 'stimulus', what: `charge ${o.kind ?? 'flash'}`, data: { by: o.by.callsign, at: [+to[0].toFixed(2), 0, +to[2].toFixed(2)] } });
        },
        cease: u => { for (const B of R.bursts) if (B.u.id === u.id) B.left = 0; },
        burst: (u, at, rounds, o = {}) => {
          this.guardOf(R, u); touch(u);
          const B = { u, at, left: Math.max(0, Math.floor(rounds)), cadence: Math.max(0.05, o.cadence ?? 0.16), spread: o.spread ?? 0.01, next: R.t, fired: 0, cond: { k: 'pred' as const, test: () => B.left <= 0, label: `burst ${u.callsign} ×${rounds}` } };
          R.bursts.push(B); this.push({ beat: b.name, kind: 'stimulus', what: `burst ×${rounds}`, data: { by: u.callsign } });
          return { k: 'pred', test: () => B.left <= 0, label: B.cond.label };
        },
      },
      objective: (text, markAt) => {
        if (text === null) { R.objective = null; return; }
        const pos = markAt === undefined ? null : ('kind' in markAt && markAt.kind === 'door') ? v3.copy(this.doorOf(markAt).frameCentre) : v3.copy(this.placeOf(markAt as Place));
        R.objective = { text, pos }; chronObjective(g, text, pos ?? undefined); g.msg(text); this.push({ beat: b.name, kind: 'note', what: `objective: ${text}` });
      },
      chronicle: (kind, text) => { chronicle(g, kind, { text }); },
      // ---- showcase-only
      stage: (who, at, o = {}) => {
        showOnly('stage'); const p = this.placeOf(at);
        if (who === 'sam') { teleportPlayer(g, [p[0], 0, p[2]]); if (o.yaw !== undefined) { g.player.char.bodyYaw = g.player.char.aimYaw = o.yaw; } g.player.char.update(0); }
        else { const gd = this.guardOf(R, who); const c = gd.char; c.pos = [p[0], 0, p[2]]; c.vel = [0, 0, 0]; if (o.yaw !== undefined) c.bodyYaw = c.aimYaw = o.yaw; gd.speed = 0; gd.path = []; gd.pathGoal = null; c.update(0); }
      },
      puppet: p => { const S = showOnly('puppet'); if (!p) { g.puppet = null; S.puppet = false; return; } g.puppet = { goal: p.goal ? v3.copy(this.placeOf(p.goal)) : null, aim: p.aim ? v3.copy(this.placeOf(p.aim)) : null, crouch: p.crouch, walk: p.walk, fixtures: p.fixtures, throwAt: p.throwAt ? v3.copy(this.placeOf(p.throwAt)) : null }; S.puppet = true; },
      press: key => { showOnly('press'); this.dueKeys.add(key); },                       // (queued: injectInput puts it into the NEXT frame's input, ahead of updateInteract / updatePlayer — see the field)
      click: (button = 0) => { showOnly('click'); this.dueClicks |= 1 << button; },
      select: (kind, verb) => { showOnly('select'); return g.selectVerb(kind, verb); },
      get view() { showOnly('view'); return samViewOf(g); },
      weather: o => {
        const S = showOnly('weather'); const Wx = g.weather; if (!Wx) return;
        if (!S.weatherSaved) S.weatherSaved = { storm: Wx.storm, rain: Wx.rainRate };
        if (o.storm !== undefined && Number.isFinite(o.storm)) Wx.storm = Math.max(0, Math.min(1, o.storm));
        if (o.rain !== undefined && Number.isFinite(o.rain)) Wx.rainRate = Math.max(0, Math.min(1, o.rain));
        if (o.seed !== undefined) Wx.seed(o.seed | 0);
        const f = o.strike ? Wx.strike(o.strike) : null;
        this.push({ beat: b.name, kind: 'stimulus', what: o.strike ? `stroke${f ? '' : ' (no storm)'}` : 'weather', data: { storm: +Wx.storm.toFixed(2), rain: +Wx.rainRate.toFixed(2), ...(o.seed !== undefined ? { seed: o.seed | 0 } : {}), ...(o.strike && f ? { distKm: +f.distKm.toFixed(2) } : {}) } });
      },
      mission: on => { const S = showOnly('mission'); g.missionInTour = !!on; S.missionOn = !!on; if (on) { g.mission.sweepAt = -1; g.mission.debrief = false; } this.push({ beat: b.name, kind: 'note', what: `mission ${on ? 'live' : 'off'}` }); },
      handover: (caption, sub = '') => { showOnly('handover'); this.handOver(R, caption, sub, b); },
      chaos: k => {   // the program's own destruction knob (destruction.ts Destruction.showChaos): read under the show's touring flag where the player's reads 0; restoreChaos nulls it as the program ends
        const S = showOnly('chaos'); if (!g.destr) return;
        const v = k === null || !Number.isFinite(k) ? null : Math.max(0, Math.min(1, k));
        g.destr.showChaos = v; S.chaosSet = v !== null;
        this.push({ beat: b.name, kind: 'stimulus', what: `chaos ${v === null ? 'off' : v.toFixed(2)}` });
      },
      camera: {
        pin: s => {   // a CUT: the look-at, yaw, pitch and distance land together, verbatim, this frame
          const S = showOnly('camera.pin');
          if (S.handedOver) return;   // (the follow camera is the player's now)
          if (!(s.dur > 0) || ![s.yaw, s.pitch, s.dist].every(Number.isFinite)) throw new BeatFailure('camera.pin: yaw / pitch / dist must be finite and dur > 0');
          const title = s.title ?? `shot ${S.shotI + 2}`;
          const prevI = S.shotI;
          S.shot = { spec: { ...s }, t: 0, title }; S.shotI = s.chapter ?? (S.shotI + 1); b.pinnedCamera = true;
          if (S.shotI !== prevI) S.chapterT0 = R.t;
          S.look = this.lookOf(s);
          if (this.cam) this.cam.pin = { look: v3.copy(S.look), yaw: s.yaw * DEG, pitch: s.pitch * DEG, dist: s.dist };
          this.push({ beat: b.name, kind: 'camera', what: title });
        },
        release: () => { const S = showOnly('camera.release'); S.shot = null; b.pinnedCamera = false; if (this.cam) this.cam.pin = null; },
        get shotT() { return R.show?.shot?.t ?? 0; },
      },
      caption: (title, sub = '') => { const S = showOnly('caption'); S.caption = title; S.sub = sub; },
      chapters: list => { const S = showOnly('chapters'); S.chapters = list.map(x => ({ title: x.title, dur: x.dur })); },
      fade: (to, secs = 0) => { const S = showOnly('fade'); S.fadeTo = to; if (secs <= 0) { S.fade = to; S.fadeRate = 0; } else S.fadeRate = 1 / secs; },
      variant: (v, on) => { const S = showOnly('variant'); if (v.id === 'daylight') { setDaylight(g, on); S.variantOn = isDaylight(g); this.push({ beat: b.name, kind: 'note', what: on ? 'daylight' : 'night' }); } },
      shift: on => {   // the level's own men benched for the show's length (torches out — they hang in the light set) and back: units are never benched
        const S = showOnly('shift');
        if (!on) { if (S.benched) return; const staff = g.guards.filter(x => !x.unit); for (const gd of staff) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); } S.benched = staff; g.guards = g.guards.filter(x => !!x.unit); this.push({ beat: b.name, kind: 'note', what: 'shift benched', data: { n: staff.length } }); }
        else if (S.benched) { for (const gd of S.benched) if (!g.engine.lights.lights.includes(gd.flashlight)) g.engine.lights.add(gd.flashlight); g.guards = [...S.benched, ...g.guards]; S.benched = null; this.push({ beat: b.name, kind: 'note', what: 'shift back' }); }
      },
    };
    void self;
    return ctx;
  }
}

// ================================================================================================================================ small helpers
function condLabel(c: Cond): string {
  switch (c.k) {
    case 'time': return c.label ?? '';
    case 'frames': return '';
    case 'pred': return c.label === 'until' ? '' : c.label;
    case 'event': return `on ${c.kind}${c.name ? ':' + c.name : ''}`;
    case 'beat': return `${c.state === 'done' ? 'done' : 'started'} ${c.name}`;
    case 'all': case 'any': { const parts = c.of.map(condLabel).filter(Boolean); return parts.length ? `${c.k}(${parts.join(', ')})` : ''; }
  }
}
function nearOf(g: Game, self: Director, pos: Vec3) {
  return (what: DoorRef | Place, within: number): boolean => {
    const p = 'kind' in (what as object) && (what as DoorRef).kind === 'door' ? (g.doors.byName((what as DoorRef).id)?.frameCentre ?? null) : self.placeOf(what as Place);
    return !!p && Math.hypot(p[0] - pos[0], p[2] - pos[2]) <= within;
  };
}
/** the read model of Sam (c.view): a fresh snapshot of what his own HUD shows — position, pace, the highlighted row and the rows on offer, the hold, the sustained verbs, the mission's stage
 *  and the drive, codes and keys in his pocket, the reticle's snap, the OCP's charge, the belt */
export function samViewOf(g: Game): SamView {
  const pl = g.player, c = pl.char, hv = g.hover, H = pl.holding, m = g.mission;
  const whoOf = (r: Interactable | null) => r ? (r.guard?.callsign ?? r.door?.def.name ?? r.target?.name ?? null) : null;
  return {
    pos: v3.copy(c.pos), yaw: c.bodyYaw, speed: Math.hypot(c.vel[0], c.vel[2]), crouch: pl.crouch, holstered: pl.holstered, slot: pl.slot, nv: pl.nv,
    hover: hv ? { kind: hv.kind, verb: hv.verb ?? null, inReach: hv.inReach, who: whoOf(hv), running: !!hv.running } : null,
    rows: g.nearby.map(r => `${r.kind}:${r.verb ?? ''}${r.inReach ? '' : '(far)'}`),
    holding: H ? { who: H.g.callsign, phase: H.phase, variant: H.variant, t: H.t } : null,
    dragging: pl.dragging?.callsign ?? null, takedown: !!pl.takedown,
    easing: pl.easing?.def.name ?? null, picking: pl.picking?.def.name ?? null, coding: pl.coding?.def.name ?? null, driveT: m.driveT, pulled: m.pulled, stage: m.stage,
    codes: [...pl.codes], keys: [...pl.keys],
    aimTarget: g.aimTarget?.name ?? null, aimGuard: g.aimGuard?.callsign ?? null, ocp: pl.ocp.charge, canisters: pl.canisters, flashbangs: pl.flashbangs,
    doorPush: c.anim.doorPush && c.anim.doorPush.w > 0 ? 'leaf' : null,
  };
}
function viewOf(g: Game, R: Run, e: GameEvent): EventView { void R; return { kind: e.kind, pos: v3.copy(e.pos), level: e.level ?? (e.loud ? 1 : 0.3), loud: e.loud, who: e.who ?? -1, near: nearOf(g, g.director, e.pos) }; }
function signalView(g: Game, R: Run, s: { name: string; t: number; data?: Json }): EventView { void R; const pos = v3.copy(g.player.char.pos); return { kind: 'signal', name: s.name, data: s.data, pos, level: 0, loud: false, who: -1, near: nearOf(g, g.director, pos) }; }

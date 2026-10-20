// Long randomized headless soak of the gameplay layer: the real Game (see headless.ts for what is real and what is stubbed) stepped at a fixed rate for tens of
// simulated minutes per seed under a seeded random schedule of stimuli — gunshot / kick / bang events, kills, the player teleported onto guards, lit in their
// cones, bumping them, doors picked / kicked / slammed, blackouts, restarts and guard resets, escalation raised / stood down, forced room clears interrupted at
// whatever phase they are in, AI and tour toggles — while a set of invariants is asserted every frame and softer smells are counted.
//
//   bun run tools/qa/soak.ts [--seeds 1,2,3] [--minutes 20] [--hz 60] [--quiet] [--json out.json] [--logdir dir] [--grab-per-min 2.4] [--sup-per-min 1.5] [--carbines none|reyes|all] [--aim on|off|flip] [--rifle-per-min N] [--whistle-per-min 1.5] [--loud-at MIN] [--needs-rate K|off] [--checkpoint-at MIN] [--chaos K]
//
// Everything random goes through one seeded PRNG per stream (the game's own Math.random included), so a violation is reproducible from its seed + frame
// (re-running the same seed replays the same frames exactly; ~1 s of wall clock per simulated minute). Invariants checked every frame: no exception; nothing
// NaN / out of the world; guard state / awareness / speed sane; no dead man scripted, no orphan script, no clearing while the tour flag or AI-off is up;
// escalation level and clock consistent, no lockdown duty below lockdown; doors never latched-open / locked-and-broken / out of range; pick ∈ [0,1];
// followers' leaders alive; nobody stuck (ordered to move 4 s, went nowhere — reported with the doors / props / nav facts around him), planted on a nav-blocked
// cell with somewhere to be (1.5 s if no plan can leave it, 5 s otherwise — 'blocked-cell-stuck': the stranding a hold ending in a nook used to leave, guards.ts un-stick), overlapping a colleague
// > 2 s, popping > 0.3 m in a frame (bar the un-stick's own logged snap), or standing inside static geometry; no alert man rooted at a doorway 6 s with nothing he fires reaching Sam; the
// player's wall hold (Q, pressed at random with the wander keys) only ever on a free man, on its plane and inside its run, bladed, peeking only at an
// open end, and nothing of it left once he is off; the rounds Sam carries (chamber + mag + spares) never rise within one life and no interaction row is ever
// about a gun on the floor (dropped weapons are set dressing, not pickups); mission stages only forward; every downed man carries how he went down (and no living man does),
// a witness record only ever names a man who IS down (found bodies as breathing exactly when they are), and no witness record changes in a frame stepped
// with the AI off; the interrogation engine (dialogue.ts, leaned on at random through Game.interrogate or the bare engine): no exception, no unresolved
// {token} in anything said, no line written for a knowledge level other than the man's own, one stage forward per press and never back for that man;
// the grab / hold (player.ts Hold, driven at random through the real rows — a Space tap on 'grab him', or Space held so the list opens and the grab lands on the
// release — and the held man's rows, holstered or drawn: grab the nearest calm man from behind, question him (his top row, tapped), walk him about, now and then
// draw / holster on him with E (player.ts swapHold, either way, sometimes back again), then choke him out (arm: the choke's row chosen and tapped, sometimes
// stopped by a second tap) or fire past him / pistol-whip him / check the whip (gun); the takedown likewise through its click with the hands empty; the Space
// selector's own shape asserted throughout — open only under a held key, a running verb alone in the list with its bar, no second verb over a running one):
// Player.holding and
// the one Guard.held always agree both ways (phase and variant), the held man alive, unscripted, pathless, within a hand of his station HOLD.dist ahead of Sam
// once held, never perceiving Sam and never barking, no hold while Sam is down / mid-takedown / on a wall, the choke only in the arm variant and the whip only
// in the gun one, the variant always what the hands say (drawn in slot 1 ⇔ gun), the pistol in the hand exactly when it is the gun variant and the knife's
// boxes in the fist exactly when it is the arm one (both once a hand-over has had its beat; no knife with nobody held), rounds past him never his and never
// closer than the cadence, nothing of a hold left on the animators once it is over, and — muzzle discipline (tune.muzzleDiscipline, on) — not one guard
// round of anybody's while a living man is up in Sam's arm ('shield-fired-on'); the carbine's tracers (tracers.ts, lane R6): streaks alive ≤ the pool, lit
// heads ≤ their light budget and = the LightSet's 'tracer' lights, every head between its muzzle and its impact, born only on a frame a tracer-row round flew,
// none with the flag off; leaks; and everything authored restored by a restart.
// Softer smells are counted (barks/min and repeats, path re-plans, clear outcomes by phase, time per alarm level, deaths). tools/qa/probes.ts has the
// deterministic single-situation repros for what this found.
import { standUp, ROOT, Headless } from './headless.ts';
const IK = 'Space';   // the game's interact key (src/game/consts.ts INTERACT_KEY)

const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const DESTR_X = process.env.SOAK_DESTR === '1' ? { W: (await import(`${ROOT}/src/game/wallbreak.ts`)).WALL_STATS, B: (await import(`${ROOT}/src/game/breakTable.ts`)).BREAK_STATS } : null;   // SOAK_DESTR=1: the walls' and the break table's counters beside the destruction smells
const { startPicking, startKick, startTakedown, startGrab, RIFLE_EQUIP_SECS, playerBodyR } = await import(`${ROOT}/src/game/player.ts`);
const { KITANIM, kitLockMax } = await import(`${ROOT}/src/game/kitanim.ts`);
const { runningVerb } = await import(`${ROOT}/src/game/interact.ts`);   // (which sustained verb is running: the selector invariants, and the door / grab stimuli that must not step on one)
const { HOLD, KIT } = await import(`${ROOT}/src/game/character.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { GUNHOLD, gunHoldStats } = await import(`${ROOT}/src/game/gunhold.ts`);   // (the pistol in a hold: a man on the clean line at Sam's back fires once Sam has — the shield invariant below lets that round go)
const { AIM_DEBUG } = await import(`${ROOT}/src/game/aim.ts`);   // (--trace also opens the aim model's log for its window)
const { planClears, escalationOf, nearKnownBody, bodyPos, rollcallState, stillLooking, searchSummary, witnessSummary, LINE_DEBUG } = guardsMod;
const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);   // (the wall hold's feel pass: the rifle stack and its step-out, for the wall invariants)
/** the un-stick's QA counters + the stranded-cell test (guards.ts UNSTICK / strandedAt) — absent on a tree from before it: the smells read 0 and the invariant works the stranded test itself */
const UNSTICK: { legs: number; snaps: number; lastSnapT: number; lastSnapWho: any } = guardsMod.UNSTICK ?? { legs: 0, snaps: 0, lastSnapT: -1, lastSnapWho: null };
const strandedAt: ((g: any, x: number, z: number) => boolean) | null = guardsMod.strandedAt ?? null;
const { isBreathing } = await import(`${ROOT}/src/game/game.ts`);
const Dlg = await import(`${ROOT}/src/game/dialogue.ts`);
const { Clearing } = await import(`${ROOT}/src/game/squad.ts`);
const { Doors } = await import(`${ROOT}/src/game/doors.ts`);
const { PLAYER_ID, DRIVE_SECS } = await import(`${ROOT}/src/game/consts.ts`);
const { KNIFE_TAG, SC20K_TAG, M4_BOXES } = await import(`${ROOT}/src/game/rigProps.ts`);
const { GEAR } = await import(`${ROOT}/src/game/gear.ts`);   // (which rifle is drawn: the 2010s carbine is three boxes more)
const { fireRing, staggerLines, RING } = await import(`${ROOT}/src/game/launcher.ts`);   // (lane R5: the ring airfoil — a stimulus fires one at a man's hips through the API, the stagger lines are their own smell)
const { LAUNCHER, LAUNCHER40 } = await import(`${ROOT}/src/game/weapons.ts`);
const { HE40, fireShell } = await import(`${ROOT}/src/game/he40.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);   // (a blast's fold is longer than a ring's: the stagger bound below)
const { SUPPRESSION, suppressionLines } = await import(`${ROOT}/src/game/suppression.ts`);
const { tracerFx } = await import(`${ROOT}/src/game/effects.ts`);
const { DECAL_CAP, DECAL_LIST_CAP } = await import(`${ROOT}/src/render/decals.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);   // (experiment E1: the decal ring's caps the invariants hold it to)   // (lane R6: the tracer pool / light caps the invariants hold the streaks to)
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { AIM } = await import(`${ROOT}/src/game/aim.ts`);   // (the aim-settle model: the gate its guard rounds must have passed, the ranges its state must stay in)
const { WHISTLE, WHISTLE_STATS, whistleMem, whistleLines, whistleReadyIn } = await import(`${ROOT}/src/game/whistle.ts`);
/** the pursuit tactics (game/tactics.ts) — absent on a tree from before it: the role reads null, the danger list empty, the counters 0, and the invariants below hold vacuously */
let tacMod: any = null; try { tacMod = await import(`${ROOT}/src/game/tactics.ts`); } catch { tacMod = null; }
const tacticsRoleOf = (g: any, gd: any): string | null => tacMod ? tacMod.tacticsRoleOf(g, gd) : null;
const TACTICS_STATS: Record<string, number> = tacMod?.TACTICS_STATS ?? {};   // (Sam's low whistle, V: its knobs, the module's counters, each man's memory of it, its lines — a smell of their own)
const WHISTLE_POOL: Set<string> = new Set(whistleLines());
/** the night's opening (game/opening.ts) — absent on a tree from before it, off on the frozen stand (TPS_OPENING=1 or the shipped profile turns it on): a man whose
 *  first waypoint is on top of the way in is then put down his own beat, on a restart too, and the restore check below expects him there */
let openMod: any = null; try { openMod = await import(`${ROOT}/src/game/opening.ts`); } catch { openMod = null; }
/** the needs-driven patrol variation (game/needs.ts) — absent on a tree from before it: no trip ever reads, the counters 0, the invariants below hold vacuously */
let needsMod: any = null; try { needsMod = await import(`${ROOT}/src/game/needs.ts`); } catch { needsMod = null; }
const needsTrip = (gd: any): any => needsMod ? needsMod.needsTrip(gd) : null;
const NEEDS_STATS: Record<string, number> = needsMod?.NEEDS_STATS ?? {};
let NEEDS_POOL: Set<string> = new Set(); try { const D = await import(`${ROOT}/src/game/dialogue.ts`); if (D.needsLines) NEEDS_POOL = new Set(D.needsLines(['Kowalski', 'Novak', 'Reyes', 'Okafor', 'Lindqvist', 'Brandt'])); } catch { /* no pool on this tree */ }
/** the civilians (game/civilians.ts) — the cleaner and the late worker; absent on a tree from before them: no stimulus dealt, the counters 0, the invariants vacuous */
let civMod: any = null; try { civMod = await import(`${ROOT}/src/game/civilians.ts`); } catch { civMod = null; }
const CIV_STATS: Record<string, number> = civMod?.CIV_STATS ?? {};
let CIV_POOL: Set<string> = new Set(); try { const D = await import(`${ROOT}/src/game/dialogue.ts`); if (D.civilianLines) CIV_POOL = new Set(D.civilianLines()); } catch { /* older tree */ }
/** the debrief's chronicle caps (game/chronicle.ts) — absent on a tree from before it: the leak invariant then has nothing to hold */
const chronMod = await import(`${ROOT}/src/game/chronicle.ts`).catch(() => null); const CHRON_MAX = chronMod?.MAX_EVENTS ?? Infinity, CHRON_PATH = chronMod?.PATH_CAP ?? Infinity;
const WEAPON_TRACER: Set<string> = new Set(Object.values(WEAPONS as Record<string, any>).filter(d => d.tracer).map(d => d.id));   // rows whose rounds may trace (the carbine and its data-only cousins)
const SUP_POOL: Set<string> = new Set([...suppressionLines(), 'he\'s got us pinned!', 'they\'ve got us pinned!']); const SUP_RECOVER: Set<string> = new Set(suppressionLines('recover'));   // (lane R3: the suppression barks, counted as a smell; the hard man's 'that all you've got?' is the one line said once it has drained)
const STAGGER_POOL: Set<string> = new Set(staggerLines());   // (lane R5: the yelp of a man a ring airfoil doubled over)
/** wounds (game/wounds.ts): --wounds on|off */
const woundMod = await import(`${ROOT}/src/game/wounds.ts`);
/** glass (E3: rounds star panes, panes never break) — absent on a tree from before it: the stimulus is not dealt and the invariant holds nothing */
const glassMod2 = await import(`${ROOT}/src/game/glass.ts`).catch(() => null);
/** checkpoints (game/savestate.ts, STATUS G5) — absent on a tree from before it: no autosave to watch, --checkpoint-at does nothing */
const saveMod2 = await import(`${ROOT}/src/game/savestate.ts`).catch(() => null);
/** destruction (game/destruction.ts, STATUS stage 3b) — absent on a tree from before it: --chaos does nothing and its invariants hold nothing */
const destrMod2 = await import(`${ROOT}/src/game/destruction.ts`).catch(() => null);

type Vec3 = [number, number, number];

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
// Every flag the soak understands (name → takes a value). Anything else on the command line is refused up front with the list — a mistyped `--seed 5` used to
// run the default three seeds for twenty minutes and report on a run nobody asked for (review T4.4).
const FLAGS: Record<string, boolean> = { seeds: true, minutes: true, hz: true, quiet: false, json: true, logdir: true, 'grab-per-min': true, carbines: true, 'sup-per-min': true, 'rifle-per-min': true,
  trace: true, aim: true, 'whistle-per-min': true, 'loud-at': true, 'doorway-kills-per-min': true, civilians: true, 'civ-rate': true, 'needs-rate': true, 'checkpoint-at': true, chaos: true, tactics: true , 'body-light': true, wounds: true };
{ const bad: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { bad.push(`unexpected argument '${a}'`); continue; }
    const k = a.slice(2);
    if (!(k in FLAGS)) { bad.push(`unknown flag '${a}'`); continue; }
    if (FLAGS[k]) { if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) bad.push(`'${a}' needs a value`); else i++; }
  }
  if (bad.length) {
    console.error(`error: ${bad.join('; ')}\nvalid flags: ${Object.entries(FLAGS).map(([k, v]) => `--${k}${v ? ' <value>' : ''}`).join(' ')}`);
    process.exit(2);
  } }
const arg = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '1,2,3').split(',').map(Number);
const MINUTES = Number(arg('minutes', '20'));
const HZ = Number(arg('hz', '60'));
const QUIET = argv.includes('--quiet');
const JSON_OUT = arg('json', '');
const LOG_DIR = arg('logdir', '');   // per-seed full timeline files (stimuli, clears, smells, violations in order)
const GRAB_PER_MIN = Number(arg('grab-per-min', '2.4'));   // the grab stimulus's rate (raise it to lean on the hold's paths: `--grab-per-min 8`)
const CARBINES = arg('carbines', 'none');   // rifles (lane R1): tune.carbineGuards for the run — 'none' (the default: today's floor), 'reyes', 'all' (every man on the long-gun rig + poses; R2 adds its own armAll stimulus and burst invariants)
const SUP_PER_MIN = Number(arg('sup-per-min', '1.5'));   // suppression (lane R3): the rate of the 'suppress-guard' stimulus — rounds put past a man on purpose (`--sup-per-min 6` leans on the head-down / shift branches)
const RIFLE_PER_MIN = Number(arg('rifle-per-min', '0'));   // Sam's FN2000 (lane R5): 0 = the schedule exactly as it was (the rifle rides his back, inert, and the invariants below still watch it); N = per minute, each of: a burst of its keys (2 / 2 again / E / Z / L / R / the other digits), a string at a wall on SEMI or AUTO, one at a man (god on), a ring at a man off the right button (`--rifle-per-min 3` leans on it)
const TRACE = arg('trace', '');      // 'route:t0:t1[:everyFrames]' — every quarter second (or every N frames) in [t0, t1] that guard's state / duty / fix / path + the doors go to the log file (chasing one violation), and through the window every alert man's footwork round a colleague in his line, frame by frame (guards.ts LINE_DEBUG: lineStep's candidates and verdicts, the branch taken, the push-backs); 'player:t0:t1' traces Sam instead
const AIM_MODE = arg('aim', 'on');   // the aim-settle model (aim.ts, Game.tune.aimModel): 'on' (the default), 'off' (today's rounds), 'flip' (toggled every 90 s of game time — off the clock, not the dice, so the schedule is the one it always was)
const WHISTLE_PER_MIN = Number(arg('whistle-per-min', '1.5'));   // Sam's low whistle (whistle.ts): the 'whistle' stimulus's rate — V pressed at random moments, mostly from a few metres behind a living man, now and then twice running (`--whistle-per-min 6` leans on it; 0 = no whistles and the schedule byte for byte as it was)
const LOUD_AT = Number(arg('loud-at', '-1'));   // the response to going loud (lane qrf, src/game/qrf.ts): −1 = the schedule exactly as it was (the QRF only ever comes if the dice lock the floor down over Sam's own level-1 rounds — the rifle stimuli — which the default schedule never fires); N = at that sim-minute Sam empties three FN2000 rounds into the corridor wall beside the living men and the floor is put at lockdown, then the resets / stand-downs hold off three minutes so the response plays out — the qrf invariants below watch it either way
const DOORKILL_PER_MIN = Number(arg('doorway-kills-per-min', '0'));
const CIVILIANS_ARG = arg('civilians', 'on');
const CIV_RATE = Math.max(0, Number(arg('civ-rate', '1')) || 0);   // × the civ-panic / civ-grab stimulus rates ('4' leans on them; the invariants watch either way)   // the civilians (civilians.ts): 'on' (as shipped: the cleaner and the late worker on the floor, the panic / grab-comply stimuli dealt) | 'off' (tune.civilians false: nobody but the shift — the A/B); the civilian invariants below watch either way
const NEEDS_RATE = arg('needs-rate', '1');   // the needs (needs.ts): × every man's fill rate for the run — '1' = as shipped (a first trip two to four minutes into a quiet stretch), '6' leans on it (a man over his line every minute or so; the send-for-a-need stimulus is dealt too), 'off' = tune.needs false (the A/B: the patrol as it was); the needs invariants below watch either way
const CHECKPOINT_AT = Number(arg('checkpoint-at', '-1'));   // checkpoints (game/savestate.ts): −1 = nothing of it beyond the autosaves the game writes by itself (watched by the invariants); N = at that sim-minute the encounter is SAVED (forced) and LOADED back into the same game on the spot, thirty seconds on the same file is loaded a second time, and everything after is the loaded world under every invariant — plus the 'load-newest-checkpoint' stimulus (an autosave slot loaded mid-run now and then) is dealt
const CHAOS_ARG = arg('chaos', '0.5');   // destruction (destruction.ts): tune.chaos for the run — the harness stands the game up at 0 (the game as it was), the SOAK runs the shipped default 0.5 unless told; 'K' 0‥1 (`--loud-at 1 --chaos 1` leans on it: the loud burst + the firefight it draws + the response team's carbines wreck the corridor and the cubicles); the destruction invariants below watch either way
const WOUNDS_ARG = /^(on|1|true)$/.test(arg('wounds', String(process.env.TPS_WOUNDS ?? '') === '1' ? 'on' : 'off')) ? 'on' : 'off';   // wounds (src/game/wounds.ts WOUND.on): 'off' (as shipped: every round that finds a man kills him) | 'on' (where it lands decides: dead, or down wounded) — the wounded-man invariants below run either way
const BODY_LIGHT_ARG = arg('body-light', 'on');   // bodies found by the light on them (guards.ts bodyLit, tune.bodyLight — review A6.2): 'on' (as shipped) | 'off' (range / cone / line alone, the old rule) — the same seed both ways is the A/B; the smells count bodies down vs FOUND either way
const TACTICS_ARG = arg('tactics', 'on');   // pursuit tactics: 'on' (the default: tune.tactics as shipped) | 'off' (pinned off for the run — the A/B: the same seed with and without them)   // pursuit tactics (tactics.ts, the kill-zone doorway): the 'kill-in-doorway' stimulus's rate — a living man stood in a doorway and struck down there, as often as not under a colleague's eyes turned onto him first (`--doorway-kills-per-min 3` leans on the gate: stack, call, summon, slice / bang, cross; 0 = the schedule byte for byte as it was)   // Sam's low whistle (whistle.ts): the 'whistle' stimulus's rate — V pressed at random moments, mostly from a few metres behind a living man, now and then twice running (`--whistle-per-min 6` leans on it; 0 = no whistles and the schedule byte for byte as it was)
const DT = 1 / HZ;

// ---------------------------------------------------------------- rng
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- clearing outcome tap (class-level, once)
type ClearOutcome = 'complete' | 'complete-with-skips' | 'cap-timeout' | 'muster-giveup' | 'interrupted' | 'death' | 'dissolved' | 'reset' | 'broken';
let clearTap: ((o: ClearOutcome, c: any, phase: string) => void) | null = null;
let roomTap: ((how: string, c: any) => void) | null = null;
{
  const proto = Clearing.prototype as any; const orig = proto.tick; const origNext = proto.nextRoom;
  proto.nextRoom = function (...args: unknown[]) {   // why is this room being left: walked away from (approach ETA blown), the drill capped, or properly done
    const how = this.stage === 'approach' ? 'approach-giveup' : this.stage === 'drill' && this.drill && !this.drill.complete ? 'drill-cap' : 'room-done';
    this.__skips = (this.__skips ?? 0) + (how === 'room-done' ? 0 : 1); roomTap?.(how, this);
    return origNext.apply(this, args);
  };
  proto.tick = function (dt: number) {
    const stageBefore = this.stage, phaseBefore = this.stage === 'drill' && this.drill ? `drill:${this.drill.phase}` : this.stage;
    const alive = orig.call(this, dt);
    if (!alive && clearTap) {
      const g = this.g; let o: ClearOutcome;
      if (!g.guards.includes(this.a) || (this.b && !g.guards.includes(this.b))) o = 'reset';
      else if (stageBefore === 'muster' && this.stage === 'done' && this.roomI === 0 && !(g.quietUtility || !g.aiEnabled || escalationOf(g) < 2 || g.player.down)) o = 'muster-giveup';
      else if (this.roomI >= this.rooms.length) o = this.__skips ? 'complete-with-skips' : 'complete';
      else if (this.a.state === 'dead' || (this.b && this.b.state === 'dead')) o = 'death';
      else if (g.quietUtility || !g.aiEnabled || escalationOf(g) < 2 || g.player.down) o = 'dissolved';
      else if (this.total > this.cap) o = 'cap-timeout';
      else if (this.a.state !== 'search' || (this.b && this.b.state !== 'search')) o = 'interrupted';   // breakOff put them on patrol/suspicious with something on their minds
      else o = 'broken';
      clearTap(o, this, phaseBefore);
    }
    return alive;
  };
}

// ---------------------------------------------------------------- one seed
interface Violation { seed: number; frame: number; time: number; kind: string; key: string; msg: string; dump?: unknown; }
interface SeedReport {
  seed: number; frames: number; simSeconds: number; wallSeconds: number; exceptions: number;
  violations: Violation[]; violationCounts: Record<string, number>;
  smells: Record<string, unknown>; stimuli: Record<string, number>; timelineTail: string[];
}

async function runSeed(seed: number): Promise<SeedReport> {
  const rngGame = mulberry32(seed * 7919 + 13);      // the game's own dice (reactT jitter, spread, ragdoll twist…)
  const rng = mulberry32(seed * 104729 + 71);       // the schedule's
  Math.random = rngGame;
  if (process.env.SOAK_DESTR === '1') (await import(`${ROOT}/src/game/destructionSwitch.ts`)).DESTRUCTION.on = true;   // SOAK_DESTR=1: THE destruction switch as the page has it (walls and cover come apart, charges throw the furniture) — off, the soak as it always ran
  if (process.env.SOAK_DESTR === '0') (await import(`${ROOT}/src/game/destructionSwitch.ts`)).DESTRUCTION.on = false;   // SOAK_DESTR=0: … and held OFF where the stand raised it (TPS_PROFILE=shipped): the page under ?nodestruction
  const W = await standUp();
  const { game, level, input } = W;
  if (CARBINES !== 'none') game.tune.carbineGuards = CARBINES;
  if (TACTICS_ARG === 'off') game.tune.tactics = false;   // (--tactics off: the chase as it was, for an A/B against the same seed)
  woundMod.WOUND.on = WOUNDS_ARG === 'on';
  game.tune.bodyLight = BODY_LIGHT_ARG !== 'off';        // (--body-light off: bodies found in the dark as before, for the A/B against the same seed)
  if (NEEDS_RATE === 'off') game.tune.needs = false; else if (needsMod && Number(NEEDS_RATE) > 0) needsMod.NEEDS.rateK = Number(NEEDS_RATE);   // (--needs-rate: off / ×K)
  if (civMod && CIVILIANS_ARG === 'off') civMod.setCivilians(game, false);   // (--civilians off: nobody but the shift)
  game.tune.aimModel = AIM_MODE !== 'off';
  if (destrMod2 && Number.isFinite(Number(CHAOS_ARG))) { game.tune.chaos = Math.max(0, Math.min(1, Number(CHAOS_ARG))); for (const k of Object.keys(destrMod2.DESTR_STATS)) (destrMod2.DESTR_STATS as any)[k] = 0; destrMod2.DESTR_LOG.length = 0; }   // (--chaos: 0 = the game as it was; the harness's own pin is 0, the soak's default the shipped 0.5)
  const col = game.col, nav = col.nav, doors = game.doors;
  const t0wall = performance.now();
  const FRAMES = Math.round(MINUTES * 60 * HZ);
  const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length) % a.length];
  const rr = (a: number, b: number) => a + rng() * (b - a);
  const routeName = (gd: any) => level.routes[gd.routeI]?.name ?? `g${gd.char.id}`;
  const living = () => game.guards.filter((g: any) => g.state !== 'dead');
  const f2 = (x: number) => (Number.isFinite(x) ? Number(x.toFixed(2)) : x);
  const p2 = (p: Vec3 | null | undefined) => p ? [f2(p[0]), f2(p[2])] : null;

  // -------- logging
  const timeline: string[] = []; const fullLog: string[] = [];
  const stimCounts: Record<string, number> = {};
  let frame = 0;
  const tl = (s: string) => { const line = `${game.time.toFixed(2)}s f${frame} ${s}`; timeline.push(line); fullLog.push(line); if (timeline.length > 4000) timeline.splice(0, 1000); if (!QUIET) console.log(`  [seed ${seed}] ${line}`); };
  const violations: Violation[] = []; const vCounts: Record<string, number> = {}; const vSeen = new Map<string, number>();
  const dump = () => ({
    t: f2(game.time), frame, esc: game.escalationSummary(), escT: f2(game.escalationT), episode: game.alarm.episode, placed: game.alarm.placed, alarmPos: p2(game.alarm.pos),
    clearing: game.clearingSummary() || null, quiet: game.quietUtility, ai: game.aiEnabled, god: game.godMode, invisible: game.playerInvisible, blackout: game.blackout.active,
    rollcall: (() => { const R = rollcallState(game); return { stage: R.stage, nextIn: f2(R.nextAt - game.time), missing: R.missing ? routeName(R.missing) : null, caller: R.caller ? routeName(R.caller) : null, checks: R.checks }; })(),
    player: { pos: p2(game.player.char.pos), down: game.player.down, crouch: game.player.crouch, sprint: game.player.sprinting, picking: game.player.picking?.def.name ?? null, kick: game.player.kick?.door.def.name ?? null, takedown: !!game.player.takedown, dragging: !!game.player.dragging, holding: game.player.holding ? `${routeName(game.player.holding.g)}:${game.player.holding.phase} ${f2(game.player.holding.t)}s` : null, vis: f2(game.player.visibility) },
    guards: game.guards.map((gd: any) => ({ name: routeName(gd), state: gd.state, pos: p2(gd.char.pos), yaw: f2(gd.char.bodyYaw), speed: f2(gd.speed), aw: f2(gd.awareness), reactT: f2(gd.reactT), searchT: f2(gd.searchT), wp: gd.wp, wait: f2(gd.wait),
      path: `${gd.pathI}/${gd.path.length}`, pathGoal: p2(gd.pathGoal), lastKnown: p2(gd.lastKnown), stuckT: f2(gd.stuckT), hold: gd.hold, pinned: gd.pinned, drawn: gd.drawn, task: gd.task ? (gd.task.kind === 'checkOn' ? `checkOn:${routeName(gd.task.who)} wp${gd.task.wp} left${gd.task.left}` : gd.task.kind) : null,
      track: f2(gd.aim?.track ?? -1), aimYaw: f2(gd.char.aimYaw), trunkBrg: (() => { const pc = game.player.char; const tr = pc.bones?.spine2 ?? pc.pos; return f2(Math.atan2(tr[0] - gd.char.pos[0], tr[2] - gd.char.pos[2])); })(), posBrg: f2(Math.atan2(game.player.char.pos[0] - gd.char.pos[0], game.player.char.pos[2] - gd.char.pos[2])), lastSeen: f2(game.time - gd.lastSeenT), fireCd: f2(gd.fireCd), reloadT: f2(gd.reloadT), rounds: gd.weapon?.roundsReady ?? null,   // (the aim model's state: chasing 'alert-planted-at-door')
      muzzleDown: gd.muzzleDown, standoff: gd.standoff ? `${routeName(gd.standoff.pair)} side${gd.standoff.side} ${gd.standoff.orbitGoal ? 'to ' + p2(gd.standoff.orbitGoal) : gd.standoff.cornered ? 'cornered' : 'planted'} shots${gd.standoff.shots} ${f2(gd.standoff.orbitM)}m seen${f2(game.time - gd.standoff.seenT)}` : null, missedAt: f2(gd.missedAt), missingRaised: gd.missingRaised, down: gd.downKind ? `${gd.downKind}/${gd.downBy}` : null, witness: witnessSummary(game, gd) || null, talk: gd.talk?.stage ? `s${gd.talk.stage} said${gd.talk.said.size}${gd.talk.given.size ? ' gave ' + [...gd.talk.given].join('/') : ''}` : null, held: gd.held ? `${gd.held.phase} since ${f2(gd.held.since)}` : null,
      search: searchSummary(game, gd) || null, pie: gd.pieing ? `${gd.pieing.door.def.name}:${gd.pieing.phase}` : null,
      leader: gd.leader ? routeName(gd.leader) : null, post: gd.post?.name ?? null, dazzled: game.time < gd.dazzledUntil,
      bodyDuty: gd.bodyDuty ? { body: routeName(gd.bodyDuty.body), role: gd.bodyDuty.role, stage: gd.bodyDuty.stage, t: f2(gd.bodyDuty.t), age: f2(game.time - gd.bodyDuty.t0), spot: p2(gd.bodyDuty.spot), stallT: f2(gd.stallT) } : null,
      script: gd.script ? { goal: p2(gd.script.goal), arrived: !!gd.script.arrived, face: f2(gd.script.face ?? NaN), stance: gd.script.stance ?? null, upper: gd.script.upper ?? null, speed: gd.script.speed ?? null, strafe: !!gd.script.strafe } : null,
      anim: { stance: gd.char.anim.stance, upper: gd.char.anim.upper, kicking: gd.char.anim.kicking, crouch: f2(gd.char.anim.crouch) } })),
    doors: doors.list.map((d: any) => `${d.def.name}:${f2(d.angle)}${d.latched ? 'L' : ''}${d.locked ? 'k' : ''}${d.lockBroken ? 'B' : ''}${d.pick > 0 ? ` pick${f2(d.pick)}` : ''}${d.closing ? 'c' : ''}`).join(' '),
    mission: { stage: game.mission.stage, driveT: f2(game.mission.driveT), stats: game.mission.stats },
    lastStimuli: timeline.slice(-10), lastMsgs: game.messages.map((m: any) => `${f2(m.t)} ${m.text}`),
  });
  const MAX_PER_KEY = 3;
  function violate(kind: string, key: string, msg: string, withDump = true) {
    vCounts[kind] = (vCounts[kind] ?? 0) + 1;
    const k = `${kind}|${key}`; const n = (vSeen.get(k) ?? 0) + 1; vSeen.set(k, n);
    if (n > MAX_PER_KEY) return;
    const v: Violation = { seed, frame, time: f2(game.time), kind, key, msg, dump: withDump && n === 1 ? dump() : undefined };
    violations.push(v);
    console.log(`!! [seed ${seed}] ${game.time.toFixed(2)}s f${frame} ${kind} (${key}): ${msg}`);
    fullLog.push(`${game.time.toFixed(2)}s f${frame} !! VIOLATION ${kind} (${key}): ${msg}${v.dump ? '\n' + JSON.stringify(v.dump) : ''}`);
  }

  // -------- instrumentation: barks, messages, clears, replans
  const barkLog: { t: number; who: string; text: string }[] = []; let barkRepeats = 0; const barkTexts: Record<string, number> = {};
  let inInterrogation = false;   // up while the interrogate stimulus presses a man (his lines are held speech, not barks)
  const origSay = game.say.bind(game);
  game.say = (gd: any, text: string, radio = false) => {
    const who = routeName(gd);
    if (!inInterrogation) for (let i = barkLog.length - 1; i >= 0 && game.time - barkLog[i].t < 5; i--) if (barkLog[i].who === who && barkLog[i].text === text) { barkRepeats++; if (barkRepeats <= 12) tl(`SMELL bark repeat <5s ${who}: "${text}"`); break; }   // (interrogation lines are out of the repeat smell: a man leaned on past his last stage repeats his exhausted pool by design)
    barkLog.push({ t: game.time, who, text }); if (!inInterrogation) barkTexts[text] = (barkTexts[text] ?? 0) + 1;
    if (/[{}]/.test(text)) violate('unresolved-token', who, `${who} says "${text}" — a {token} left in (${inInterrogation ? 'interrogation' : 'bark'})`);
    fullLog.push(`${game.time.toFixed(2)}s f${frame}   ${radio ? 'RADIO' : 'SAY'} ${who} (${gd.script ? 'scripted' : gd.state}${gd.bodyDuty ? ' ' + gd.bodyDuty.role + ':' + gd.bodyDuty.stage : ''} @${f2(gd.char.pos[0])},${f2(gd.char.pos[2])}): ${text}`);   // (the per-seed log file gets every line said; the console timeline only the smells)
    if (gd.state === 'dead' && !gd.wound) violate('dead-speaks', text, `${who} is dead but says "${text}"`);
    const wasHeld = !!gd.held; const r = origSay(gd, text, radio);
    if (wasHeld && !inInterrogation && gd.bubble && gd.bubble.t === game.time && gd.bubble.text === text) violate('held-speaks', who, `${who} is held in Sam's arm but barked "${text}" (guards.ts say should drop everything but his answers)`);
    if (!inInterrogation && /sound off|radio check|not at his post|check on him|going round his route/.test(text)) { smells.rollcallLines = (smells.rollcallLines ?? 0) + 1; if (game.quietUtility) violate('rollcall-under-tour', who, `${who} says "${text}" while quietUtility is up (the net's radio check must not run under the tour)`); if (!game.aiEnabled) violate('rollcall-ai-off', who, `${who} says "${text}" with the AI off`); }   // (held speech may mention the radio check by design: only barks count as the net's own lines)
    if (/radioing it in$/.test(text)) { const k = /out cold/.test(text) ? 'bodyCallsOutCold' : 'bodyCallsDead'; smells[k] = (smells[k] ?? 0) + 1; }   // the finder's call, by what he found (a takedown / choke leaves a breathing man; a round a corpse)
    if (/^he's got .* hold your fire/.test(text)) { smells.hostageCalls = (smells.hostageCalls ?? 0) + 1; if (!radio) violate('hostage-call-not-radio', who, `"${text}" said off the net`); if (!game.player.holding) violate('hostage-call-no-hold', who, `${who} called "${text}" with nobody held`); }   // the standoff's one call per hold
    if (/one of ours/.test(text)) smells.hostageOrders = (smells.hostageOrders ?? 0) + 1;
    if (gd.standoff && !radio) smells.standoffBarks = (smells.standoffBarks ?? 0) + 1;
    if (/I hit him/.test(text)) smells.friendlyFireBarks = (smells.friendlyFireBarks ?? 0) + 1;
    if (STAGGER_POOL.has(text)) { smells.staggerLines = (smells.staggerLines ?? 0) + 1; if (!(gd.staggerUntil > game.time - 1e-6)) violate('stagger-line-unstaggered', who, `${who} says "${text}" with no stagger on him (staggerUntil ${gd.staggerUntil.toFixed(2)} at ${game.time.toFixed(2)})`); }   // (lane R5: only a man a ring has just taken in the body yelps)
    if (NEEDS_POOL.has(text)) {   // the needs (needs.ts): an announcement only from a man telegraphing a trip (or its radio words over the net), an answer only from the partner he told, 'where was I' only from a man back on his waypoint THIS frame
      smells.needsLines = (smells.needsLines ?? 0) + 1;
      const T = needsTrip(gd); const asPartner = game.guards.some((o: any) => { const t = needsTrip(o); return t && t.partner === gd && t.phase === 'telegraph'; }); const M = needsMod?.needsMem(gd); const justBack = !!M && Math.abs(M.lastBackAt - game.time) < 1e-6;
      if (!(T && T.phase === 'telegraph') && !asPartner && !justBack) violate('needs-line-astray', who, `${who} says "${text}" with no trip telegraphing (${T ? T.phase : 'none'}), nobody telling him, and not just back`);
      if (!game.tune.needs) violate('needs-line-flag-off', who, `${who} says "${text}" with tune.needs off`);
    }
    if (CIV_POOL.has(text) && !/^copy, control — on my way$/.test(text)) { smells.civLines = (smells.civLines ?? 0) + 1; if (!gd.civ && !game.civilians.some((c: any) => c.civ && (c.civ.reportTo === gd || c.civ.foundBy === gd || c.civ.told?.get?.(gd) !== undefined || Math.hypot(c.char.pos[0] - gd.char.pos[0], c.char.pos[2] - gd.char.pos[2]) < 20))) violate('civ-line-astray', who, `${who} says a civilians' line "${text}" with no civilian within twenty metres or telling him`); }   // (a civilians' line only ever from a civilian's mouth or a man one is dealing with)
    if (WHISTLE_POOL.has(text)) { smells.whistleLines = (smells.whistleLines ?? 0) + 1; const m = whistleMem(gd); if (!m || m.respondedAt !== game.time) violate('whistle-line-unanswered', who, `${who} says "${text}" without answering a whistle this frame (last answered ${m ? m.respondedAt.toFixed(2) : 'never'})`); if (radio) violate('whistle-line-radio', who, `"${text}" went out over the net`); }   // (Sam's whistle: its lines only ever from the man answering one, and never on the radio)
    if (SUP_POOL.has(text)) { smells.supLines = (smells.supLines ?? 0) + 1; if (!game.tune.suppression) violate('sup-line-flag-off', who, `${who} says "${text}" with tune.suppression off`); if (gd.sup.v < SUPPRESSION.flinch - 0.06 && !SUP_RECOVER.has(text)) violate('sup-line-unrattled', who, `${who} says "${text}" at suppression ${gd.sup.v.toFixed(2)} (under the flinch line)`); }   // (lane R3: a suppression line only from a rattled man with the flag on — bar the hard man's word once it has drained off him)
    if ((text === 'clear here — staying on it' || text === 'must have been nothing') && nearKnownBody(game, gd.char.pos, 4)) { const b = nearKnownBody(game, gd.char.pos, 4); violate('line-over-body', who, `${who} says "${text}" ${v3.distXZ(gd.char.pos, bodyPos(b)).toFixed(1)} m from ${routeName(b)}'s found body (duty ${gd.bodyDuty ? gd.bodyDuty.role + ':' + gd.bodyDuty.stage : 'none'})`); }
    return r;
  };
  let msgCount = 0; const origMsg = game.msg.bind(game); game.msg = (t: string) => { msgCount++; return origMsg(t); };
  const clearOutcomes: Record<string, number> = {}; const clearInterruptPhases: Record<string, number> = {}; let clearsStarted = 0; let lastClearingRef: any = null;
  clearTap = (o, c, phase) => { clearOutcomes[o] = (clearOutcomes[o] ?? 0) + 1; if (o !== 'complete') clearInterruptPhases[`${o}@${phase}`] = (clearInterruptPhases[`${o}@${phase}`] ?? 0) + 1; tl(`CLEAR ended: ${o} at ${phase} (room ${c.roomI + 1}/${c.rooms.length}, ${c.total.toFixed(0)} s)`); };
  const roomEnds: Record<string, number> = {};
  roomTap = (how, c) => { roomEnds[how] = (roomEnds[how] ?? 0) + 1; tl(`CLEAR room ${c.roomI + 1} (${c.cur?.room ?? '?'}) left: ${how}${how === 'drill-cap' && c.drill ? ` in phase ${c.drill.phase} — A ${routeName(c.a)} at (${c.a.char.pos[0].toFixed(2)}, ${c.a.char.pos[2].toFixed(2)}) arrived=${c.a.script?.arrived}${c.b ? `, B ${routeName(c.b)} at (${c.b.char.pos[0].toFixed(2)}, ${c.b.char.pos[2].toFixed(2)}) arrived=${c.b.script?.arrived}` : ''}` : how === 'approach-giveup' ? ` — A at (${c.a.char.pos[0].toFixed(2)}, ${c.a.char.pos[2].toFixed(2)}) → stack (${c.cur?.stack[0][0]}, ${c.cur?.stack[0][2]})${c.b ? `, B at (${c.b.char.pos[0].toFixed(2)}, ${c.b.char.pos[2].toFixed(2)})` : ''}` : ''}`); };
  const lastPathRef = new Map<any, any>(); let replans = 0; const replanWindow = new Map<any, number[]>(); let maxReplansPerSec = 0; let maxReplansWho = '';
  const escTime = [0, 0, 0]; let escChanges = 0; let lastEsc = 0;
  const stateTime: Record<string, number> = {};

  // -------- helpers
  const randomFloorPoint = (): Vec3 => { for (let i = 0; i < 200; i++) { const p: Vec3 = [rr(1, 39), 0, rr(1, 27)]; if (!nav.isBlocked(p[0], p[2])) return p; } return [20, 0, 11]; };
  const nearGuardPoint = (gd: any, dmin: number, dmax: number, inFront: boolean | null): Vec3 | null => {
    const gp = gd.char.pos;
    for (let i = 0; i < 40; i++) {
      const a = inFront === null ? rr(-Math.PI, Math.PI) : gd.char.bodyYaw + (inFront ? rr(-0.7, 0.7) : Math.PI + rr(-0.6, 0.6));
      const d = rr(dmin, dmax); const p: Vec3 = [gp[0] + Math.sin(a) * d, 0, gp[2] + Math.cos(a) * d];
      if (!nav.isBlocked(p[0], p[2]) && nav.walkable(gp, p)) return p;
    }
    return null;
  };
  const pushEvent = (kind: string, pos: Vec3, extra: Record<string, unknown> = {}) => game.events.push({ kind, pos: [pos[0], 0, pos[2]], time: game.time, loud: true, level: 1, ...extra });
  /** a point on the keyed (corridor) face of a door, just off the doorway's middle — the side the lock is against the player from */
  const keySideOf = (d: any): Vec3 => { const alongX = Math.abs(Math.sin(d.def.closedDir)) < 0.5; return alongX ? [d.frameCentre[0], 0, d.def.hinge[1] + d.keySide * 0.9] : [d.def.hinge[0] - d.keySide * 0.9, 0, d.frameCentre[2]]; };
  /** a free spot near an arbitrary floor point (a corpse's hips) with a clear knee-height line to it */
  const nearPoint = (c: Vec3, dmin: number, dmax: number): Vec3 | null => { for (let i = 0; i < 40; i++) { const a = rr(-Math.PI, Math.PI), d = rr(dmin, dmax); const p: Vec3 = [c[0] + Math.sin(a) * d, 0, c[2] + Math.cos(a) * d]; if (!nav.isBlocked(p[0], p[2]) && !col.segmentBlocked([c[0], 0.5, c[2]], [p[0], 0.5, p[2]])) return p; } return null; };

  // -------- ongoing behaviours
  let qrfHoldOff = -1; let loudDone = LOUD_AT < 0;   // (lane qrf: the resets hold off while the response plays out; the loud burst is dealt once)
  // checkpoints: every state the game writes (autosaves included) lands here — the invariants below judge the frame it was written on; --checkpoint-at keeps its file to load twice
  let ckDone = CHECKPOINT_AT < 0, ckJson: string | null = null, ckReloadAt = -1, ckRetryAt = -1; let autoWritten = 0, ckLoads = 0; const savedThisFrame: { kind: string; slot: string | null; mem: boolean }[] = [];
  if (saveMod2 && game.saves) game.saves.onSaved = (st: any, info: any) => { savedThisFrame.push({ kind: st?.kind ?? info?.slot, slot: info?.slot ?? null, mem: !!info?.mem }); if (info?.slot === 'auto') autoWritten++; };   // (st null: a save kept in memory — savestate.ts SAVETIMELINE, a unit on the floor)
  /** after a load (any path): the harness's own handles onto the old encounter let go of, the run's trackers re-based, and the loaded world's basic sanity */
  const afterLoad = (how: string) => {
    releaseKeys(); cursorDoor = null; rackJob = null; holdF = null; gunSpaceUntil = -1; if (grabJob) { grabEnds['cut by a load'] = (grabEnds['cut by a load'] ?? 0) + 1; grabJob = null; } rifleJob = null; missionRef = game.mission; stageIdx = STAGE_ORDER[game.mission.stage] ?? 0; teleportedThisFrame = true; ckLoads++;
    const bad: string[] = [];
    if (game.guards.length !== level.routes.length || game.guards.some((x: any) => x.unit || x.script || x.held || x.hold || x.pinned)) bad.push(`guards ${game.guards.length}: ${game.guards.map((x: any) => `${x.callsign}${x.unit ? '+unit' : ''}${x.script ? '+script' : ''}${x.held ? '+held' : ''}${x.hold ? '+hold' : ''}`).join('/')}`);
    { const pl = game.player; if (pl.down || pl.holding || pl.dragging || pl.picking || pl.kick || pl.takedown || pl.coding || pl.easing || pl.pendingThrow) bad.push(`player down=${pl.down} holding=${!!pl.holding} drag=${!!pl.dragging} pick=${!!pl.picking} kick=${!!pl.kick}`); }
    if (game.items.items.some((it: any) => !it.settled) || game.rings.length || game.shells.length || game.clearing || game.qrf?.state !== 'idle') bad.push(`air: ${game.items.items.filter((it: any) => !it.settled).length} items, ${game.rings.length} rings, clearing ${!!game.clearing}, qrf ${game.qrf?.state}`);
    if (game.mission.stage === 'failed' || game.mission.driveT !== -1) bad.push(`mission ${game.mission.stage} driveT ${game.mission.driveT}`);
    for (const gd of game.guards) { if (gd.state === 'dead' && ((!gd.char.ragdoll && !gd.wound) || !gd.downKind)) bad.push(`${gd.callsign} dead without a ragdoll / downKind`); if (gd.state !== 'dead' && gd.char.ragdoll) bad.push(`${gd.callsign} alive on a ragdoll`); if (gd.leader && !game.guards.includes(gd.leader)) bad.push(`${gd.callsign} follows a stranger`); /* (a leader down but not yet KNOWN down keeps the role by design — guards.ts superviseLockdown) */ if (gd.bodyDuty && !game.guards.includes(gd.bodyDuty.body)) bad.push(`${gd.callsign} on duty over a stranger's body`); if (gd.dropped && !game.items.items.includes(gd.dropped)) bad.push(`${gd.callsign}'s dropped item is not in the list`); }
    for (const gd of game.guards) heldCount.set(gd, gd.witness?.wasHeld ?? 0);   // (the loaded men carry the run's witness records: the harness's per-object grab count starts from what they remember)
    if (bad.length) violate('checkpoint-load', how, bad.slice(0, 5).join(' · '));
  };
  let wander: { until: number; keys: string[] } = { until: 0, keys: [] };
  let holdF: { until: number; door: any; full: boolean } | null = null as any;   // a pick / an ease under way that the schedule means to stop early (partial) or see through (full): at `until` a Space tap breaks a partial one off if it is still running
  let gunSpaceUntil = -1;   // 'space-on-dropped-gun': Space kept down over a dropped pistol until this game time (−1 = not held by that stimulus)
  let cursorDoor: { until: number; door: any; verb?: string; pressed: boolean } | null = null as any;   // the cursor kept on this leaf until `until`; `verb`: tap that row of it once it is on offer (Game.selectVerb + a one-frame Space), else its top row
  let visUntil = 0; let downSince = -1; let aiOffUntil = -1; let tour: { until: number; saved: any } | null = null as any; let godFlipAt = rr(60, 240);
  let restartCheck: { source: string } | null = null; let missionRef = game.mission; let stageIdx = 0;
  const STAGE_ORDER: Record<string, number> = { infiltrate: 0, drive: 1, exfil: 2, done: 3, failed: 3 };

  const lastPos = new Map<any, Vec3>(); let teleportedThisFrame = false; let stimFrame = false; let runPrev = '';   // stimFrame: a stimulus ran this frame (its direct calls may start / stop verbs the player never could in one frame); runPrev: last frame's running verb
  let qPresses = 0, wallTime = 0, wallPeekPrev = 0;   // back to the wall: Q presses dealt, seconds spent holding a wall, last frame's peek (it may only rise at an open end)
  function releaseKeys() { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', IK, 'AltLeft']) input.keys.delete(k); wander = { until: game.time + rr(1, 4), keys: [] }; holdF = null; gunSpaceUntil = -1; }
  function teleport(p: Vec3, why: string) { releaseKeys(); game.teleportPlayer(p); game.player.fHeld = false; teleportedThisFrame = true; tl(`teleport player → (${p[0].toFixed(1)}, ${p[2].toFixed(1)}) ${why}`); }   // (teleportPlayer breaks off a kick / pick / ease / takedown / drag itself and marks a still-held Space as spent; the harness's Space came up in releaseKeys, between frames, so that mark is cleared here or a tap dealt this same frame would never register)

  // -------- restore check after a restart
  function checkRestored(source: string) {
    const bad: string[] = [];
    for (const d of doors.list) {
      const a0 = Math.max(d.minA, Math.min(d.maxA, d.sided(d.def.angle ?? 0)));
      if (Math.abs(d.angle - a0) > 1e-6) bad.push(`${d.def.name} angle ${d.angle.toFixed(3)}≠${a0}`);
      if (d.locked !== !!d.def.locked || d.lockBroken || d.pick !== 0 || d.noticed || d.picking) bad.push(`${d.def.name} lock state locked=${d.locked} broken=${d.lockBroken} pick=${d.pick}`);
      if (d.latched !== (Math.abs(a0) < 1e-3)) bad.push(`${d.def.name} latched=${d.latched}`);
    }
    if (game.escalation !== 0 || game.escalationT !== -1 || game.alarm.episode || game.alarm.placed || game.clearing) bad.push(`escalation ${game.escalationSummary()} T=${game.escalationT} clearing=${!!game.clearing}`);
    game.guards.forEach((gd: any, i: number) => {
      const r0 = level.routes[gd.routeI].points[0];
      if (gd.state !== 'patrol' || gd.script || gd.leader || gd.post || gd.task || gd.hold || gd.pinned || gd.held || gd.standoff || gd.awareness !== 0) bad.push(`guard ${i} state=${gd.state} script=${!!gd.script} leader=${!!gd.leader} post=${!!gd.post} held=${!!gd.held} standoff=${!!gd.standoff} aw=${gd.awareness}`);
      const show = game.quietUtility || (game.touring && !game.director?.handedOver);   // (opening.ts openingStart's own gate: an encounter made under a show's flag — the tour-blip — starts every man on his first waypoint)
      const o = openMod?.OPENING.on && !show && !gd.unit && gd.team === 'guard' ? openMod.openingSpot(game, gd) : null, at0 = o ? o.pos : r0, wp0 = o ? o.wp : 0;   // (the opening, where the stand has it on: his spot down his beat and the waypoint he walks to)
      if (v3.distXZ(gd.char.pos, at0) > 0.01 || gd.wp !== wp0) bad.push(`guard ${i} not at ${o ? 'his opening spot' : 'route start'} (${p2(gd.char.pos)} vs ${p2(at0)}, wp ${gd.wp} vs ${wp0})`);
    });
    for (const [t, on] of game.initialOn) if (t.on !== on) bad.push(`light ${t.name} on=${t.on}≠${on}`);
    if (game.targets.some((t: any) => t.broken || t.disabledUntil !== -1)) bad.push('a fixture still broken/disabled');
    if (game.blackout.active) bad.push('blackout still active');
    if (game.mission.stage !== 'infiltrate' || game.mission.pulled || game.mission.driveT !== -1) bad.push(`mission ${game.mission.stage}`);
    { const pl = game.player; if (pl.down || v3.distXZ(pl.char.pos, level.playerSpawn) > 0.01 || pl.picking || pl.kick || pl.dragging || pl.takedown || pl.holding || !pl.holstered || pl.char.anim.holdPose || pl.pendingThrow || pl.throwHeld || pl.fHeld || pl.easing || pl.sel.open || pl.sel.downT >= 0 || pl.crouch || pl.sprinting || pl.char.anim.lockpick || pl.char.anim.kicking || pl.hitsLeft !== 1 || pl.slot !== 'pistol' || pl.wall || pl.char.anim.stance !== 'none') bad.push(`player pos ${p2(pl.char.pos)} down=${pl.down} picking=${!!pl.picking} kick=${!!pl.kick} drag=${!!pl.dragging} takedown=${!!pl.takedown} holding=${!!pl.holding} holstered=${pl.holstered} throw=${!!pl.pendingThrow}/${pl.throwHeld} fHeld=${pl.fHeld} easing=${!!pl.easing} sel=${JSON.stringify(pl.sel)} crouch=${pl.crouch} sprint=${pl.sprinting} lockpick=${pl.char.anim.lockpick} kicking=${pl.char.anim.kicking} hits=${pl.hitsLeft} slot=${pl.slot} wall=${!!pl.wall} stance=${pl.char.anim.stance}`); }
    if (game.events.length || game.items.items.length) bad.push(`aftermath: ${game.events.length} events, ${game.items.items.length} items`);
    if (game.qrf && (game.qrf.state !== 'idle' || game.qrf.men.length || game.qrf.perim || game.guards.some((x: any) => x.unit))) bad.push(`qrf ${game.qrf.state} men ${game.qrf.men.length} perim ${!!game.qrf.perim} units ${game.guards.filter((x: any) => x.unit).length}`);   // the response to going loud goes with the guards (Game.resetGuards → resetQrf; its men are units)
    if (game.props.props.some((p: any) => Math.hypot(p.x - p.home[0], p.z - p.home[1]) > 0.01)) bad.push('props not home');
    if (game.player.keys.size || game.guards.some((gd: any) => !(gd.keys instanceof Set) || gd.keys.size === 0)) bad.push(`keys: Sam's pocket [${[...game.player.keys].join(',')}], belts [${game.guards.map((gd: any) => [...(gd.keys ?? [])].join('+') || 'EMPTY').join(' ')}] (want empty / a key each)`);   // a fresh Player carries nothing; fresh men their floor key (player.ts takeKey moves one to the other)
    if (bad.length) violate('restart-restore', source, bad.slice(0, 6).join(' · '));
  }
  /** game time the harness itself last poked this leaf's state directly (door-fiddle's fling): the 'lock-bypassed' invariant lets that frame be */
  const harnessDoorT = new Map<any, number>();
  let soakGlassN = -1;   // (glass invariant: the pane count at the first check)

  // -------- stimuli
  /** mild: may also fire during a respite (a stretch left quiet on purpose so alarm episodes can lapse, the floor can escalate by itself and clears can run deep) */
  interface Stim { name: string; perMin: number; mild?: boolean; when?: () => boolean; run: () => string | null | void; }
  const lockedDoors = () => doors.list.filter((d: any) => d.locked && !d.lockBroken);
  const stims: Stim[] = [
    { name: 'shot-event', perMin: 1.2, run: () => { const p = randomFloorPoint(); pushEvent('shot', p); return `at (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`; } },
    { name: 'kick-event', perMin: 0.3, run: () => { const d = pick(doors.list) as any; pushEvent('kick', d.pos, { who: PLAYER_ID }); return d.def.name; } },
    { name: 'bang-event', perMin: 0.3, run: () => { const p = randomFloorPoint(); pushEvent('bang', p); return `at (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`; } },
    { name: 'crack-glass', perMin: 0.35, when: () => !!glassMod2, run: () => { const panes = glassMod2.glassPanes(game); const bi = panes[Math.floor(rng() * panes.length)]; const b = game.level.boxes[bi]; const wide = b.h[0] < b.h[2] ? 2 : 0; const p: Vec3 = [b.c[0], b.c[1] + (rng() * 2 - 1) * 0.8 * b.h[1], b.c[2]]; p[wide] += (rng() * 2 - 1) * 0.8 * b.h[wide]; const ok = glassMod2.glassHit(game, bi, p, null, rng() < 0.5 ? PLAYER_ID : 0, 'hand'); return `pane ${bi} ${ok ? 'starred' : 'refused'} (${glassMod2.crackCount(game)} stars live)`; } },   // glass (E3): a round's star on a pane by hand now and then — the crack on the floor's ears, a glassHit decal in the ring (the decal invariants below watch the list; the glass invariant that the pane count listed never changes)
    { name: 'door-noise-event', perMin: 0.5, mild: true, run: () => { const d = pick(doors.list) as any; game.events.push({ kind: 'door', pos: [d.pos[0], 0, d.pos[2]], time: game.time, loud: rng() < 0.3, level: rr(0.1, 1), who: rng() < 0.5 ? PLAYER_ID : 0 }); return d.def.name; } },
    { name: 'kill-guard', perMin: 0.45, when: () => living().length > 0, run: () => {   // every call shape killGuard takes: the two old ones (a round / the takedown, defaults) and the explicit how / by of the shield and the choke-out to come
      const gd = pick(living()) as any; const was = gd.script ? 'scripted' : gd.state; const quiet = rng() < 0.35; const a = rr(-Math.PI, Math.PI); const dir: Vec3 = [Math.sin(a), 0, Math.cos(a)]; const r = rng(); stimKilled.add(gd);
      let shape: string;
      if (r < 0.5) { killGuard(game, gd, dir, quiet); shape = quiet ? 'takedown (default → struck)' : 'round (default → shot)'; }
      else if (quiet) { const how = rng() < 0.5 ? 'struck' : 'choked'; killGuard(game, gd, dir, true, how); shape = how; }
      else { const by = pick(['player', 'player', 'guard', 'world']); killGuard(game, gd, dir, false, 'shot', by); shape = `shot by ${by}`; }
      return `${routeName(gd)} (${was}, ${shape})`;
    } },
    { name: 'space-on-dropped-gun', perMin: 0.4, mild: true, when: () => !game.player.down && !game.player.holding && !holdF && !cursorDoor && !rackJob && !grabJob && game.items.items.some((x: any) => (x.kind === 'pistol' || x.kind === 'rifle') && x.settled), run: () => {   // stand over a gun a dead hand let go of — sidearm or a rifleman's carbine — cursor on it, Space (tap or hold): it is set dressing — the 'ammo-rose' / 'interact-row' invariants say nothing came of it
      const it = pick(game.items.items.filter((x: any) => (x.kind === 'pistol' || x.kind === 'rifle') && x.settled)) as any; const p = nearPoint(it.pos, 0.25, 0.6); if (!p) return 'no spot beside it';
      const what = it.kind === 'rifle' ? 'a carbine' : it.fill ? 'his own Five-seveN' : 'a sidearm';
      if (rng() < 0.5) game.player.holstered = !game.player.holstered; teleport(p, `onto a dropped ${it.kind === 'rifle' ? 'carbine' : it.fill ? 'Five-seveN' : 'sidearm'}`); game.player.crouch = rng() < 0.5; W.cursorAt(it.pos);
      const held = rng() < 0.4; input.pressed.add(IK); if (held) { input.keys.add(IK); gunSpaceUntil = game.time + rr(0.3, 1.5); }   // a tap, or Space kept down a random stretch (let up in the frame loop)
      return `${what} at (${it.pos[0].toFixed(1)}, ${it.pos[2].toFixed(1)}), Space ${held ? 'held' : 'tapped'}, ${game.player.holstered ? 'holstered' : 'drawn'}${game.player.crouch ? ', crouched' : ''}`;
    } },
    { name: 'player-shoots-guard', perMin: 0.2, when: () => living().length > 0 && !game.player.down, run: () => { const gd = pick(living()) as any; fireWeapon(game, game.player.char, v3.add(gd.char.pos, [0, 1.25, 0]), true); return routeName(gd); } },
    { name: 'player-shoots-wall', perMin: 0.25, when: () => !game.player.down, run: () => { const p = randomFloorPoint(); fireWeapon(game, game.player.char, [p[0], 1.2, p[2]], true); return null; } },
    { name: 'teleport-near-guard', perMin: 0.6, when: () => !civGrabJob && living().length > 0 && !game.player.down, run: () => { const gd = pick(living()) as any; const p = nearGuardPoint(gd, 0.8, 3.5, null); if (!p) return 'no spot'; teleport(p, `near ${routeName(gd)}`); return null; } },
    { name: 'bump-guard', perMin: 0.35, when: () => !civGrabJob && living().length > 0 && !game.player.down, run: () => { const gd = pick(living()) as any; const p = nearGuardPoint(gd, 0.35, 0.6, null); if (!p) return 'no spot'; teleport(p, `bumping ${routeName(gd)} (${gd.script ? 'scripted' : gd.state})`); return null; } },
    { name: 'lit-in-cone', perMin: 0.45, when: () => !civGrabJob && living().length > 0 && !game.player.down, run: () => { const gd = pick(living()) as any; const p = nearGuardPoint(gd, 2, 7, true); if (!p) return 'no spot'; teleport(p, `in front of ${routeName(gd)}`); game.player.visibility = rr(0.6, 1); visUntil = game.time + rr(3, 10); return `vis ${game.player.visibility.toFixed(2)}`; } },
    { name: 'sneak-behind', perMin: 0.3, when: () => living().length > 0 && !game.player.down, run: () => {   // behind a man, and mostly act on it: a grab (the call, or a Space TAP with the cursor on him — the press is the grab) or the takedown (the call, or its one real input: a click with the hands empty)
      const gd = pick(living()) as any; const p = nearGuardPoint(gd, 0.7, 0.95, false); if (!p) return 'no spot'; teleport(p, `behind ${routeName(gd)}`);
      if (rng() < 0.7 && gd.state !== 'alert') {
        if (rng() < 0.4 && !game.player.holding && !grabJob) { if (rng() < 0.5) { startGrab(game, gd); return 'grab via call (left to whatever ends it)'; } W.cursorAt(v3.add(gd.char.pos, [0, 1.35, 0])); input.pressed.add(IK); return 'grab via a Space tap (left to whatever ends it)'; }
        // (hands empty first, as the page has it: game.ts takes the takedown's click only while he is holstered, and the beat poses him with no long gun — called with the rifle up it
        //  was a state no player reaches, and 'rifle-anim' said so for the length of the lunge. A rifle string under way ends with the sling: its clicks would be takedown clicks now)
        if (rng() < 0.5) { const pl = game.player, slung = pl.rifleUp; if (rifleJob) { input.buttons &= ~5; rifleJob = null; } if (slung) pl.equipT = RIFLE_EQUIP_SECS; pl.holstered = true; startTakedown(game, gd); return `takedown via call${slung ? ', rifle slung first' : ''}`; }
        game.player.slot = 'pistol'; game.player.holstered = true; input.clicked |= 1; return 'takedown via click, holstered';
      } return null; } },
    { name: 'pick-door', perMin: 0.45, when: () => !game.player.down && !grabJob && !runningVerb(game) && lockedDoors().some((d: any) => d.latched), run: () => {   // (never on top of a running verb: the pick would replace it in the harness's hand, not the player's — the 'verb-overlap' invariant's own rule)
      const d = pick(lockedDoors().filter((x: any) => x.latched)) as any; const from = keySideOf(d);
      const spot = doors.workSpot(d, from); teleport([spot.pos[0] + rr(-0.3, 0.3), 0, spot.pos[2] + rr(-0.3, 0.3)], `to pick ${d.def.name}`);
      const full = rng() < 0.7; const secs = full ? Doors.PICK_SECS + rr(1.5, 3) : rr(0.8, 3.5);
      const keyed = game.player.keys.has(d.lockId);   // its key in his pocket (player.ts takeKey): the game never plants him at that cylinder (startPicking sits behind Doors.lockedOut with his keys) — the row path then eases it open instead, which is the thing to exercise
      if (rng() < 0.5 && !keyed) { startPicking(game, d); if (rng() < 0.5) input.keys.add(IK); holdF = { until: game.time + secs, door: d, full }; return `${d.def.name} direct ${full ? 'full' : 'partial'} ${secs.toFixed(1)}s`; }   // (a Space held into it without an edge, half the time: it must count for nothing)
      cursorDoor = { until: game.time + secs + 0.5, door: d, verb: keyed ? 'ease' : 'pick', pressed: false }; holdF = { until: game.time + secs, door: d, full }; return `${d.def.name} via its ${keyed ? "'ease' row (KEYED)" : "'pick' row"} ${full ? 'full' : 'partial'} ${secs.toFixed(1)}s`;
    } },
    { name: 'kick-door', perMin: 0.35, when: () => !game.player.down && !grabJob && !runningVerb(game), run: () => {
      const cands = lockedDoors().filter((x: any) => x.latched); const d = (cands.length && rng() < 0.8 ? pick(cands) : pick(doors.list)) as any;
      const spot = doors.kickSpot(d, keySideOf(d)); teleport([spot.pos[0] + rr(-0.2, 0.2), 0, spot.pos[2] + rr(-0.2, 0.2)], `to kick ${d.def.name}`);
      const keyed = game.player.keys.has(d.lockId);   // (as pick-door: no direct boot at a lock he has the key to — the row then just unlocks it)
      if (rng() < 0.5 && !keyed) { startKick(game, d); return `${d.def.name} direct`; }
      game.player.crouch = false; const locked = doors.lockedOut(d, game.player.char.pos, game.player.keys); cursorDoor = { until: game.time + 1.0, door: d, verb: keyed ? 'unlock' : locked ? 'kick' : undefined, pressed: false }; return `${d.def.name} via its ${keyed ? "'unlock'" : locked ? "'kick'" : 'top'} row (lockedOut=${locked}${keyed ? ', KEYED' : ''})`;   // (an unlocked leaf: whatever its top row is — push it open / pull it shut)
    } },
    { name: 'door-fiddle', perMin: 0.5, mild: true, run: () => { const d = pick(doors.list) as any; const r = rng(); const from = randomFloorPoint();
      if (r < 0.25) { doors.kickIn(d, from, PLAYER_ID); return `kickIn ${d.def.name}`; } if (r < 0.6) { doors.use(d, from, rng() < 0.5 ? PLAYER_ID : 10); harnessDoorT.set(d, game.time); return `use ${d.def.name}`; }
      if (r < 0.8) { doors.pullTo(d, 10); return `pullTo ${d.def.name}`; } d.latched = false; d.vel = rr(-8, 8); d.lastWho = PLAYER_ID; harnessDoorT.set(d, game.time); return `fling ${d.def.name} ${d.vel.toFixed(1)}`; } },
    { name: 'blackout', perMin: 0.25, run: () => { if (game.blackout.active && rng() < 0.6) { game.endBlackout(); return 'end'; } const r = rng(); game.setBlackout(r < 0.2 ? Infinity : rr(5, 40), r < 0.2 ? 'shot' : r < 0.6 ? 'ocp' : 'debug'); return r < 0.2 ? 'permanent' : 'timed'; } },
    { name: 'restart', perMin: 0.18, when: () => game.time >= qrfHoldOff, run: () => { releaseKeys(); cursorDoor = null; game.restartEncounter(); teleportedThisFrame = true; game.godMode = rng() < 0.4; missionRef = game.mission; stageIdx = 0; checkRestored('restartEncounter()'); return `god=${game.godMode}`; } },
    { name: 'reset-guards', perMin: 0.15, when: () => game.time >= qrfHoldOff, run: () => { game.clearAftermath(); game.resetGuards(); return null; } },
    { name: 'escalate', perMin: 0.4, run: () => { game.escalate(); return game.escalationSummary(); } },
    { name: 'stand-down', perMin: 0.15, when: () => game.time >= qrfHoldOff, run: () => { game.standDown(); return null; } },
    { name: 'force-clear', perMin: 0.5, run: () => { if (rng() < 0.7) game.clearNearestRoom(); else planClears(game, true); return game.clearingSummary() || 'no clear'; } },
    { name: 'interrupt-clear', perMin: 0.4, mild: true, when: () => !!game.clearing && game.clearing.stage !== 'done', run: () => interruptClear() },
  ];
  function interruptClear(): string {
      const C = game.clearing; const phase = C.stage === 'drill' && C.drill ? `drill:${C.drill.phase}` : C.stage; const r = rng(); let what: string;
      interruptPhases[phase] = (interruptPhases[phase] ?? 0) + 1;
      if (r < 0.16) { pushEvent('shot', randomFloorPoint()); what = 'shot event'; }
      else if (r < 0.26) { const gd = rng() < 0.5 || !C.b ? C.a : C.b; stimKilled.add(gd); killGuard(game, gd, [1, 0, 0], rng() < 0.5); what = `killed ${routeName(gd)}`; }
      else if (r < 0.34) { const third = living().find((x: any) => x !== C.a && x !== C.b); if (third) { stimKilled.add(third); killGuard(game, third, [0, 0, 1], true); what = 'killed third man quietly'; } else what = 'no third'; }
      else if (r < 0.42) { game.standDown(); what = 'standDown'; }
      else if (r < 0.50) { game.aiEnabled = false; aiOffUntil = game.time + rr(0.5, 4); what = 'ai off'; }
      else if (r < 0.58) { game.setBlackout(rr(6, 20), 'ocp'); what = 'blackout'; }
      else if (r < 0.70) { const p = nearGuardPoint(C.a, 0.35, 0.55, null); if (p && !game.player.down) { teleport(p, 'bump point man'); what = 'bump #1'; } else what = 'bump: no spot'; }
      else if (r < 0.80) { const p = nearGuardPoint(C.b ?? C.a, 2, 6, true); if (p && !game.player.down) { teleport(p, 'lit before the pair'); game.player.visibility = 0.9; visUntil = game.time + 6; what = 'lit in cone'; } else what = 'lit: no spot'; }
      else if (r < 0.86) { releaseKeys(); cursorDoor = null; game.restartEncounter(); teleportedThisFrame = true; missionRef = game.mission; stageIdx = 0; checkRestored('restart mid-clear'); what = 'restart'; }
      else if (r < 0.92) { const d = C.cur ? doors.byName(C.cur.door) : null; if (d) { doors.kickIn(d, randomFloorPoint(), PLAYER_ID); what = `kicked their door ${d.def.name}`; } else what = 'no door'; }
      else { game.events.push({ kind: 'step', pos: v3.copy(C.a.char.pos), time: game.time, loud: false, level: 1, who: PLAYER_ID }); game.events.push({ kind: 'step', pos: v3.copy(C.a.char.pos), time: game.time, loud: false, level: 1, who: PLAYER_ID }); what = 'loud steps at #1'; }
      return `${what} @ ${phase}`;
  }
  const interruptPhases: Record<string, number> = {};
  let rackJob: { until: number; pressed: boolean } | null = null as any; const missionSeen: Record<string, number> = {};
  const moreStims: Stim[] = [
    { name: 'mission-step', perMin: 0.35, mild: true, when: () => !game.player.down && !game.quietUtility && !game.player.picking && !game.player.kick, run: () => {   // walk the mission thread a stage at a time through its real triggers
      const m = game.mission, M = level.mission;
      if (m.stage === 'infiltrate') { teleport([18.0 + rr(-1, 1), 0, 8.9], 'into the server room (mission)'); return 'infiltrate → expect drive'; }
      if (m.stage === 'drive') { teleport([M.rack.front[0] + rr(-0.2, 0.2), 0, M.rack.front[2] + 0.65], 'to the mission rack'); game.player.crouch = false; rackJob = { until: game.time + DRIVE_SECS + 3, pressed: false }; wander = { until: rackJob.until + 1, keys: [] }; return 'drive: F on the rack'; }
      if (m.stage === 'exfil') { teleport([M.exfilX + 0.8, 0, M.exfilZ + rr(-1, 1)], 'out past the fire exit'); return 'exfil → expect done'; }
      return `stage ${m.stage} (nothing to do)`;
    } },
    { name: 'ai-toggle', perMin: 0.1, run: () => { game.aiEnabled = false; aiOffUntil = game.time + rr(1, 8); return `off for ${(aiOffUntil - game.time).toFixed(1)}s`; } },
    { name: 'tour-blip', perMin: 0.1, when: () => !tour, run: () => {   // what Demo.start / stop do to the game, minus the beats
      const saved = { ai: game.aiEnabled, god: game.godMode, invisible: game.playerInvisible, pos: v3.copy(game.player.char.pos) };
      game.quietUtility = true; game.clearAftermath(); releaseKeys(); cursorDoor = null;
      if (game.player.down) { game.restartEncounter(); teleportedThisFrame = true; missionRef = game.mission; stageIdx = 0; } else game.resetGuards();
      game.aiEnabled = true; game.godMode = true; game.playerInvisible = true; if (game.blackout.active) game.endBlackout();
      tour = { until: game.time + rr(5, 40), saved }; return `for ${(tour.until - game.time).toFixed(0)}s`;
    } },
    { name: 'drop-throwable', perMin: 0.25, run: () => { const p = rng() < 0.5 && living().length ? (nearGuardPoint(pick(living()), 1, 4, null) ?? randomFloorPoint()) : randomFloorPoint(); const kind = rng() < 0.5 ? 'smoke' : 'flash'; game.dropThrowable(kind, p); return `${kind} at (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`; } },
    { name: 'toggle-invisible', perMin: 0.15, run: () => { game.playerInvisible = !game.playerInvisible; return String(game.playerInvisible); } },
    { name: 'drag-body', perMin: 0.3, when: () => !civGrabJob && !game.player.down && game.guards.some((g: any) => g.state === 'dead'), run: () => { const b = pick(game.guards.filter((g: any) => g.state === 'dead')) as any; const hips = b.char.bones.hips ?? b.char.pos; const p = nearPoint([hips[0], 0, hips[2]], 0.5, 1.0); if (!p) return 'no spot'; teleport(p, 'to a body'); game.toggleDrag(b); wander = { until: game.time + rr(2, 6), keys: [pick(['KeyW', 'KeyS', 'KeyA', 'KeyD'])] }; for (const k of wander.keys) input.keys.add(k); return routeName(b); } },
    { name: 'interrogate', perMin: 1.5, mild: true, when: () => !civGrabJob && living().length > 0 && !game.player.down, run: () => {   // lean on a random living man one to three presses: mostly through Game.interrogate with Sam put behind him (the reach gate, the bubble), else the bare engine from wherever Sam is (alert / scripted / far-off men get exercised too)
      const gd = pick(living()) as any; const presses = 1 + Math.floor(rng() * 3); const out: string[] = []; let via = 'engine';
      if (rng() < 0.7) { const p = nearGuardPoint(gd, 0.7, 1.6, false) ?? nearGuardPoint(gd, 0.7, 1.8, null); if (p) { teleport(p, `to lean on ${routeName(gd)}`); via = 'game'; } }
      inInterrogation = true; if (game.player.holding?.g !== gd) inSandboxTalk.add(gd);   // (a man nobody holds: the engine stamps his heldSince itself — the sandbox stand-in, no leftover)
      try {
        for (let i = 0; i < presses; i++) {
          const kNow = Dlg.knowledgeOf(game, gd), stageBefore = gd.talk.stage;
          const r = via === 'game' ? game.interrogate(gd, rng) : Dlg.interrogate(game, gd, rng);
          if (!r) { out.push(`null (${v3.distXZ(gd.char.pos, game.player.char.pos).toFixed(1)} m)`); if (via === 'engine') violate('dialogue-null', routeName(gd), `the bare engine returned null for a living man (${gd.callsign} ${gd.state})`); break; }
          checkPick(gd, r, kNow, stageBefore);
          out.push(`s${String(r.stage)} ${r.kind ? 'INTEL ' + r.kind : r.id}${r.widened ? '~' + r.widened : ''}`);
        }
      } finally { inInterrogation = false; }
      return `${gd.callsign} (${gd.script ? 'scripted' : gd.state}, ${Dlg.knowledgeOf(game, gd)}/${Dlg.bandOf(Dlg.agitationOf(game, gd))}/${Dlg.temperamentOf(gd)}) via ${via} ×${presses}: ${out.join(' | ')}`;
    } },
  ];
  // rifles (lane R2): under --carbines, stand Sam upright and lit in a living man's line at burst range (6–16 m off him, in front, an eye-line to Sam's chest) for a
  // few seconds, god mode dealt at random — the opening burst laid wide, the aimed ones after it, the reload beat and the box on the floor all get exercised, and
  // the burst invariants above watch every round of it. Only dealt when somebody carries a carbine, so a flag-off run's schedule is the one it always was.
  if (CARBINES !== 'none') moreStims.push({ name: 'stand-in-fire', perMin: 0.8, when: () => living().some((x: any) => !x.held) && !game.player.down && !game.player.holding && !grabJob, run: () => {
    const gd = pick(living().filter((x: any) => !x.held)) as any; const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]);
    let p: Vec3 | null = null;
    for (let i = 0; i < 12 && !p; i++) { const q = nearGuardPoint(gd, 6, 16, true); if (q && !col.segmentBlocked(eye, [q[0], 1.2, q[2]])) p = q; }
    if (!p) return `no open spot in front of ${routeName(gd)}`;
    teleport(p, `into ${routeName(gd)}'s line (${gd.weapon.def.id})`); game.player.crouch = false; if (rng() < 0.6) game.godMode = true;
    game.player.visibility = rr(0.7, 1); visUntil = game.time + rr(3, 7);
    return `${v3.distXZ(p, gd.char.pos).toFixed(1)} m off ${routeName(gd)} (${gd.script ? 'scripted' : gd.state}), vis ${game.player.visibility.toFixed(2)}, god ${game.godMode}`;
  } });
  // tracers (lane R6): under --carbines, flip tune.tracers now and then — off must leave nothing in flight and let nothing be born (the tracer invariants), on again
  // must pick the rule straight back up. (Only when somebody carries a carbine: a flag-off run's schedule stays the one it always was.)
  if (CARBINES !== 'none') moreStims.push({ name: 'toggle-tracers', perMin: 0.3, run: () => { game.tune.tracers = !game.tune.tracers; return `tracers ${game.tune.tracers ? 'on' : 'off'} (${game.tracers.spawned} streaks so far, ${game.tracers.live} in flight)`; } });
  /** The grab (player.ts startGrab / updateHold): behind the nearest suitable man, the pistol first HOLSTERED or DRAWN at random (which decides the hold: the arm
   *  variant or the gun-to-his-head one — player.ts grabVariant), grabbed through the real rows (a Space tap on 'grab him'; or Space held a random stretch, the list
   *  opening on it and the grab landing on the release — if he has not walked out of reach by then, which is the tap's point over the hold) or the call; once
   *  held, one to three taps on his top row at random spacings (his question in the arm — some too soon on purpose: they only cut his line; the whip in the gun
   *  hold — chosen and, when the deal is not to end him yet, un-chosen again the next frame), a few seconds' walk on the wander keys (whatever they press — Q, C,
   *  Shift included — the pair just walks), in about half the holds an E somewhere in the talk or the walk (player.ts swapHold: he draws the pistol to the man's
   *  head, or holsters it and the knife is back — the end is re-dealt for the new variant; sometimes a second E later swaps back), then an end dealt for the
   *  variant it is by then, through the rows (Game.selectVerb + a one-frame Space, as the tour does it): arm — choke him out (its row, run through), start a choke
   *  and stop it with a second tap (then keep him, or choke him after all), or just keep him; gun — pistol-whip him (its row, run through), cock it and check it,
   *  fire a few rounds past him at whoever / whatever the cursor lands on and THEN whip or keep, or keep. There is no letting him go. grabTick drives it a frame
   *  at a time off Player.holding; the invariants watch the rest. */
  moreStims.push({ name: 'grab', perMin: GRAB_PER_MIN, when: () => !game.player.down && !grabJob && !holdF && !cursorDoor && !rackJob && !game.player.holding && living().some((x: any) => x.state !== 'alert' && !x.held), run: () => {
    const gd = pick(living().filter((x: any) => x.state !== 'alert' && !x.held)) as any;
    const p = nearGuardPoint(gd, 0.7, 0.9, false); if (!p) return `no spot behind ${routeName(gd)}`;
    teleport(p, `to grab ${routeName(gd)} (${gd.script ? 'scripted' : gd.state})`); game.player.crouch = rng() < 0.5;
    const drawn = rng() < 0.55; game.player.slot = 'pistol'; game.player.holstered = !drawn; if (drawn && rng() < 0.4) game.player.pistol.lightOn = !game.player.pistol.lightOn;
    const via = rng() < 0.4 ? 'tap' : rng() < 0.5 ? 'hold' : 'call';   // a one-frame Space on his row (dealt next frame, once the row is on offer: grabTick), or Space held a random stretch (the list opens on it past a tap; the grab lands when it comes up — or does not, if he has walked on: 'never took'), or the call
    const end = endFor(drawn ? 'gun' : 'arm');
    grabJob = { gd, via, stage: 'grabbing', t0: game.time, nextAt: 0, presses: 1 + Math.floor(rng() * 3), end, spaceUpAt: -1, stopAt: -1, swapSentAt: -1, asked: 0, variant: drawn ? 'gun' : 'arm', shotsLeft: 0, fired: 0, lastShotT: -1, swapAt: rng() < 0.5 ? rr(0.3, 6) : -1, swaps: 0, pressed: via === 'call' };   // (swapAt: seconds into the hold proper at which an E goes in, if the hold is still in its talk / walk by then; −1 none this hold)
    if (via === 'call') startGrab(game, gd);
    else if (via === 'hold') { W.cursorAt(v3.add(gd.char.pos, [0, 1.35, 0])); input.keys.add(IK); input.pressed.add(IK); grabJob.spaceUpAt = game.time + rr(0.05, 1.2); grabJob.pressed = true; }
    return `${routeName(gd)} ${drawn ? 'DRAWN (gun)' : 'holstered (arm)'} via ${via}, ×${grabJob.presses} questions, then ${end}`;
  } });
  /** The human shield (guards.ts standoffPerceive / standoffAlert): the same grab, but of a man who has a living, free colleague within a dozen metres — so somebody
   *  walks in on it, calls it, and the floor plays the standoff round the pair — and mostly KEPT (or walked about, then choked in front of them) long enough for the
   *  ring, the flank and the fire rule to get exercised; Sam turns the pair now and then (a new cursor spot). The standoff's own invariants watch the rest. */
  moreStims.push({ name: 'grab-in-view', perMin: GRAB_PER_MIN * 0.5, when: () => !game.player.down && !grabJob && !holdF && !cursorDoor && !rackJob && !game.player.holding && game.aiEnabled && !game.quietUtility && living().filter((x: any) => !x.held).length >= 2 && living().some((x: any) => x.state !== 'alert' && !x.held && !x.script), run: () => {
    const cands = living().filter((x: any) => x.state !== 'alert' && !x.held && !x.script && living().some((o: any) => o !== x && !o.held && v3.distXZ(o.char.pos, x.char.pos) < 12));
    const gd = (cands.length ? pick(cands) : pick(living().filter((x: any) => x.state !== 'alert' && !x.held))) as any; if (!gd) return 'nobody';
    const p = nearGuardPoint(gd, 0.7, 0.9, false); if (!p) return `no spot behind ${routeName(gd)}`;
    teleport(p, `to grab ${routeName(gd)} in company (${gd.script ? 'scripted' : gd.state})`); game.player.crouch = false;
    const end = pick(['keep', 'keep', 'choke', 'keep', 'walk-choke']);
    grabJob = { gd, via: 'call', stage: 'grabbing', t0: game.time, nextAt: 0, presses: Math.floor(rng() * 2), end: end === 'walk-choke' ? 'choke' : end, spaceUpAt: -1, stopAt: -1, swapSentAt: -1, asked: 0, variant: game.player.pistolUp ? 'gun' : 'arm', shotsLeft: 0, fired: 0, lastShotT: -1, swapAt: rng() < 0.3 ? rr(1, 8) : -1, swaps: 0, pressed: true };
    startGrab(game, gd);
    const near = living().filter((o: any) => o !== gd).map((o: any) => `${routeName(o)} ${o.state} ${v3.distXZ(o.char.pos, gd.char.pos).toFixed(0)} m`).join(', ');
    return `${routeName(gd)} (${near}), then ${end}`;
  } });
  /** the civilian in Sam's arm from the civ-grab stimulus: which end was dealt (comply / choke / questions only), when the next row is tapped, questions put so far */
  let civGrabJob: { cv: any; end: string; nextAt: number; asked: number } | null = null as any;
  let grabJob: { gd: any; via: string; stage: 'grabbing' | 'talk' | 'walk' | 'firing' | 'ending' | 'keep'; t0: number; nextAt: number; presses: number; end: string; spaceUpAt: number; stopAt: number; swapSentAt: number; asked: number; variant: 'arm' | 'gun'; shotsLeft: number; fired: number; lastShotT: number; swapAt: number; swaps: number; pressed: boolean } | null = null;   // (stopAt: game time a second tap stops the choke / whip just chosen — the deal's 'abort'; pressed: the grabbing tap has been dealt)
  const grabEnds: Record<string, number> = {};
  /** ends that MUST put him on the floor (choke / whip, incl. the whip after a checked one) as dealt vs as they actually ended the hold — a dealt end that silently
   *  did nothing (its Space swallowed by the swap lockout, review #10) shows here as dealt > completed long before the 12 s 'grab-stuck' net says anything */
  const holdEnds = { dealt: {} as Record<string, number>, completed: {} as Record<string, number>, cut: {} as Record<string, number> };   // cut: the hold ended under a dealt end with the man still up (Sam shot, a teleporting stimulus, the run's end) — honest, and named in the timeline
  /** the end dealt for a hold by the variant it is (or has just become): arm — choke / abort / keep; gun — whip / whip-abort / fire / keep */
  function endFor(variant: 'arm' | 'gun'): string { return variant === 'gun' ? pick(['whip', 'whip', 'whip-abort', 'fire', 'fire', 'keep', 'keep']) : pick(['choke', 'choke', 'keep', 'keep', 'abort', 'keep']); }
  /** choose the held man's end on its row and tap it (the arm's choke / the gun's whip): false while it is not on offer (the hand between tools after an E, the grab still settling) */
  const tapEnd = (): boolean => { const H = game.player.holding; if (!H || !game.selectVerb('held', H.variant === 'gun' ? 'whip' : 'choke')) return false; input.pressed.add(IK); return true; };
  function grabTick() {
    const J = grabJob; if (!J) return; const t = game.time, H = game.player.holding;
    if (J.spaceUpAt >= 0 && t >= J.spaceUpAt) { input.keys.delete(IK); J.spaceUpAt = -1; }
    if (J.stopAt >= 0 && t >= J.stopAt) { J.stopAt = -1; if (H && (H.phase === 'choke' || H.phase === 'whip' || H.windT >= 0)) { input.pressed.add(IK); tl(`grab: the stopping tap (${H.phase}, t ${H.t.toFixed(2)})`); } }   // the second tap: he breathes again / the pistol goes back to his head
    if (!J.pressed && J.via === 'tap') { W.cursorAt(v3.add(J.gd.char.pos, [0, 1.35, 0])); if (game.nearby.some((r: any) => r.guard === J.gd && r.verb === 'grab') && game.selectVerb('guard', 'grab')) { input.pressed.add(IK); J.pressed = true; } else if (t - J.t0 > 0.5) J.pressed = true; }   // (his row never came on offer in half a second — he turned, walked on: let 'never took' book it)
    const over = (how: string) => {
      grabEnds[how] = (grabEnds[how] ?? 0) + 1; tl(`grab over: ${how} (${routeName(J.gd)} ${J.gd.state}${J.gd.downKind ? '/' + J.gd.downKind : ''}, ${J.variant}${J.swaps ? ` after ${J.swaps} swap(s)` : ''}, asked ${J.asked}${J.fired ? `, fired ${J.fired}` : ''}, ${(t - J.t0).toFixed(1)} s)`);
      if (J.stage === 'ending') { const b = how === `ended:${J.end}` && J.gd.state === 'dead' ? holdEnds.completed : holdEnds.cut; b[J.end] = (b[J.end] ?? 0) + 1; }   // the dealt end put him down — or the hold went from under it with him still up (dealt = completed + cut, else an end vanished)
      if (J.gd.state === 'dead' && J.gd.downKind === 'shot' && J.gd.downBy === 'player' && J.stage !== 'grabbing' && Math.abs(game.player.lastFireT - J.gd.diedAt) < DT) violate('held-shot-by-sam', routeName(J.gd), `${routeName(J.gd)} died of Sam's own round while in his arm`);   // (fireWeapon skips the held man: a round past him is never his — the kill-guard stimulus's player 'shot' shape never coincides with a real round to the frame)
      if (J.spaceUpAt >= 0) input.keys.delete(IK); grabJob = null;
    };
    if (!H) {   // not (or no longer) holding: the press never took (he turned, walked off, was alert), or it ended — by our end or anything else's
      if (J.stage === 'grabbing' && t - J.t0 < 0.8) return;
      return over(J.stage === 'grabbing' ? `never took (${J.via})` : J.stage === 'ending' ? `ended:${J.end}` : `ended early at ${J.stage}`);
    }
    if (H.g !== J.gd) return over('holding somebody else?!');
    if (J.stage !== 'grabbing' && H.variant !== J.variant) { violate('grab-variant', routeName(J.gd), `grabbed / swapped to ${J.variant} but the hold is '${H.variant}'`); J.variant = H.variant; }
    // E with him in the arm (player.ts swapHold): due, the hold in its talk / walk (nothing of ours holding Space down), the phase 'held' and the last swap's lockout
    // over — then the key MUST take: the variant flips this coming frame (checked above next tick), the end is re-dealt for what he now holds, and now and then a
    // second E is booked to swap back later in the hold
    if (J.swapAt >= 0 && (J.stage === 'talk' || J.stage === 'walk') && t - J.t0 >= J.swapAt && H.phase === 'held' && H.windT < 0 && H.swapT >= HOLD.secs.swap && J.spaceUpAt < 0 && J.stopAt < 0 && !input.keys.has(IK) && !input.pressed.has(IK)) {
      input.pressed.add('KeyE'); J.variant = J.variant === 'gun' ? 'arm' : 'gun'; J.swaps++; smells[`holdSwaps:${J.variant}`] = (smells[`holdSwaps:${J.variant}`] ?? 0) + 1;
      if (J.end !== 'keep' || rng() < 0.5) J.end = endFor(J.variant);
      J.swapAt = rng() < 0.4 ? (t - J.t0) + rr(HOLD.secs.swap + 0.05, 4) : -1;   // (some of the second ones land right on the lockout's edge on purpose)
      tl(`grab: E → ${J.variant} on ${routeName(J.gd)} (swap ${J.swaps}), end now ${J.end}`);
    }
    // The swap's lockout (player.ts updateHold: HOLD.secs.swap after an E the row starts nothing — a Space begun under it counts from when the hand is back on him):
    // a question or an end dealt inside it would go down up to 0.3 s late while spaceUpAt was reckoned from now, so Space came up mid-choke, the game rightly eased
    // off, and 12 s on the harness cried 'grab-stuck' at player.ts (review #10, about one hold in a few hundred). Our own E's stamp covers the tick it goes in
    // (the game has not seen it yet: H.swapT still reads the old value); H.swapT covers the rest of the window. The deal simply waits — nextAt stays due.
    const lockedOut = (J.swapSentAt >= 0 && t - J.swapSentAt < HOLD.secs.swap + 0.05) || H.swapT < HOLD.secs.swap;
    const dealEnd = (kind: string) => { input.keys.add(IK); input.pressed.add(IK); (J as any).dealtAt = t; (J as any).noop = false; if (kind === 'choke' || kind === 'whip' || kind === 'whip-after-abort') holdEnds.dealt[kind] = (holdEnds.dealt[kind] ?? 0) + 1; };   // Space goes down for it (an end that must land is booked as dealt: holdEnds)
    switch (J.stage) {
      case 'grabbing': if (H.phase === 'held') { J.stage = 'talk'; J.variant = H.variant; J.nextAt = Math.max(t + rr(0.3, 2), J.spaceUpAt + 0.1); if (rng() < 0.5) { input.mouseX = rr(200, 1400); input.mouseY = rr(150, 850); } } break;   // (a new cursor spot: the pair comes round to it; the first question waits for the grab's own Space to come up — a finger cannot tap a key it is holding)
      case 'talk':   // his top row tapped: the question in the arm; in the gun hold that row is the whip — chosen by the tap and un-chosen by another the next frame (nothing comes of it), which is what a player poking Space over the gun gets
        if (t < J.nextAt) break;
        if (J.presses > 0) { input.pressed.add(IK); if (H.variant === 'gun' && H.phase === 'held' && H.swapT >= HOLD.secs.swap) J.stopAt = t + DT; J.presses--; J.asked++; J.nextAt = t + (rng() < 0.35 ? rr(0.15, 0.9) : rr(1.3, 4)); smells.holdQuestions = (smells.holdQuestions ?? 0) + 1; }
        else { J.stage = 'walk'; const secs = rr(1.5, 6); J.nextAt = t + secs; for (const k of wander.keys) input.keys.delete(k); const keys = [pick(['KeyW', 'KeyS', 'KeyA', 'KeyD'])]; if (rng() < 0.4) keys.push(pick(['KeyW', 'KeyS', 'KeyA', 'KeyD'])); if (rng() < 0.3) keys.push('ShiftLeft'); wander = { until: t + secs, keys }; for (const k of keys) input.keys.add(k); if (rng() < 0.3) input.pressed.add('KeyQ'); if (rng() < 0.3) input.pressed.add('KeyC'); if (J.variant === 'gun' && rng() < 0.3) input.pressed.add('KeyL'); }
        break;
      case 'walk':   // the end goes in through its row — the wander keys let up first (a key held INTO a choke does not stop it, but the schedule swaps keys about and a fresh one would); not on offer this frame (an E's hand-over, 0.3 s): try again next frame
        if (t < J.nextAt) break;
        if (J.end !== 'keep' && J.end !== 'fire') { for (const k of wander.keys) input.keys.delete(k); wander = { until: t + 20, keys: [] }; if (!tapEnd()) { J.nextAt = t + DT; break; } }
        J.stage = J.end === 'keep' ? 'keep' : 'ending'; J.nextAt = t + 12;
        if (J.end === 'choke') { smells.holdChokes = (smells.holdChokes ?? 0) + 1; }
        else if (J.end === 'abort') { J.stopAt = t + HOLD.secs.chokeHold + rr(0.3, HOLD.secs.choke - 0.4); J.end = rng() < 0.5 ? 'choke' : 'keep'; J.stage = 'walk'; J.nextAt = J.stopAt + rr(0.5, 2); smells.holdAborts = (smells.holdAborts ?? 0) + 1; }   // (eased off: keep him, or put him out after all — there is no letting him go)
        else if (J.end === 'whip') { smells.holdWhips = (smells.holdWhips ?? 0) + 1; }
        else if (J.end === 'whip-abort') { J.stopAt = t + HOLD.secs.chokeHold + rr(0.08, HOLD.secs.whip - 0.12); J.end = pick(['keep', 'whip-after-abort', 'keep']); J.stage = 'walk'; J.nextAt = J.stopAt + rr(0.5, 2); smells.holdWhipAborts = (smells.holdWhipAborts ?? 0) + 1; }
        else if (J.end === 'whip-after-abort') { smells.holdWhips = (smells.holdWhips ?? 0) + 1; }
        else if (J.end === 'fire') { J.stage = 'firing'; J.shotsLeft = 2 + Math.floor(rng() * 4); J.nextAt = t; for (const k of wander.keys) input.keys.delete(k); }   // rounds past him first (some clicks inside the cadence on purpose), then an end
        break;
      case 'firing':   // a click now and then — mostly on a colleague's chest (the auto-aim's snap), else anywhere on the screen; some inside the cadence on purpose (they must not fire)
        if (t < J.nextAt) break;
        if (J.shotsLeft > 0) {
          const others = living().filter((x: any) => x !== J.gd);
          if (others.length && rng() < 0.7) { const o = pick(others) as any; W.cursorAt((o.char.bones.chest ?? v3.add(o.char.pos, [0, 1.2, 0])) as Vec3); } else { input.mouseX = rr(200, 1400); input.mouseY = rr(150, 850); }
          input.clicked |= 1; J.shotsLeft--; J.nextAt = t + (rng() < 0.3 ? rr(0.1, 0.5) : rr(0.75, 1.6)); smells.holdClicks = (smells.holdClicks ?? 0) + 1;
        } else { J.end = pick(['whip', 'whip', 'keep', 'keep']); J.stage = 'walk'; J.nextAt = t + rr(0.3, 1.5); }
        break;
      case 'ending':
        if (t > J.nextAt) { violate('grab-stuck', `${J.end}`, `the hold on ${routeName(J.gd)} is still up ${(t - J.nextAt + 12).toFixed(0)} s after '${J.end}' went in (phase ${H.phase} t ${H.t.toFixed(2)} windT ${H.windT.toFixed(2)}, variant ${H.variant}, fHeld ${game.player.fHeld}, rows [${game.nearby.map((r: any) => (r.verb ?? r.kind) + (r.running ? '*' : '')).join(',')}])`); over('stuck'); }
        break;
      case 'keep': if (t > J.nextAt + 20) over('kept 30 s'); else if (rng() < DT / 3) { input.mouseX = rr(200, 1400); input.mouseY = rr(150, 850); } break;   // (Sam swings the pair round to a new facing every few seconds: whoever is circling has to keep circling)
    }
    if (H.shotT >= 0 && H.shotT !== J.lastShotT) { J.fired++; smells.holdShots = (smells.holdShots ?? 0) + 1; if (J.lastShotT >= 0 && H.shotT - J.lastShotT < 0.7 - 1e-6) violate('hold-cadence', routeName(J.gd), `two rounds past him ${(H.shotT - J.lastShotT).toFixed(3)} s apart (HOLD_FIRE_CD 0.7)`); J.lastShotT = H.shotT; }   // rounds that actually left (Hold.shotT stamps each)
  }
  /** the interrogation invariants on one pick: the cell's K is the man's knowledge as it stood, the line is his K's or floor colour (never another level's), the text
   *  is resolved, non-empty and inside the bubble limit, and the stage went exactly one forward */
  function checkPick(gd: any, r: any, kNow: string, stageBefore: number) {
    const who = `${gd.callsign}`;
    smells.interrogations = (smells.interrogations ?? 0) + 1; smells[`dialogueCell:${r.k}`] = (smells[`dialogueCell:${r.k}`] ?? 0) + 1; if (r.kind) smells[`dialogueGave:${r.kind}`] = (smells[`dialogueGave:${r.kind}`] ?? 0) + 1; if (r.widened) smells[`dialogueWidened:${r.widened}`] = (smells[`dialogueWidened:${r.widened}`] ?? 0) + 1;
    if (r.k !== kNow) violate('dialogue-k-mismatch', who, `${who}'s pick was made for K '${r.k}' but knowledgeOf said '${kNow}' the same frame`);
    if (r.lineK !== '*' && r.lineK !== r.k) violate('dialogue-k-leak', `${who}:${r.id}`, `${who} (K ${r.k}) said ${r.id}, a line written for '${r.lineK}': "${r.text}"`);
    if (/[{}]/.test(r.text) || !String(r.text).trim() || r.text === '…') violate('dialogue-text', `${who}:${r.id}`, `${who} got "${r.text}" (${r.id}, cell ${r.cell}, widened '${r.widened}')`);
    if (r.text.length > Dlg.MAX_CHARS) violate('dialogue-long', r.id, `${r.id} is ${r.text.length} chars: "${r.text}"`);
    if (r.stageN !== stageBefore + 1 || gd.talk.stage !== r.stageN) violate('dialogue-stage', who, `${who}: stage ${stageBefore} → pick stageN ${r.stageN}, talk.stage now ${gd.talk.stage}`);
    const wantKey = r.stageN <= 3 ? r.stageN : 'x'; if (r.stage !== wantKey) violate('dialogue-stage-key', who, `${who}: stageN ${r.stageN} keyed '${String(r.stage)}'`);
    if (r.kind && !gd.talk.given.has(r.kind)) violate('dialogue-given', who, `${who} gave ${r.kind} but talk.given lacks it`);
    fullLog.push(`${game.time.toFixed(2)}s f${frame}   TALK ${who} ${r.cell} s${String(r.stage)} [${r.id}${r.widened ? '~' + r.widened : ''}] ${r.text}`);
  }
  // ---- lane R3 (suppression, docs/internal/sc20k-design.md §4): rounds put PAST men on purpose from wherever Sam stands (the flinch / head-down / shift branches
  //      get walked in whatever state the floor is in — scripted, calm, mid-standoff, mid-clear), and Sam stood lit in a man's cone at pistol-miss range so their
  //      rounds go past HIM (his scalar; the invariants below watch everybody's)
  moreStims.push({ name: 'suppress-guard', perMin: SUP_PER_MIN, when: () => living().length > 0 && !game.player.down, run: () => {
    const gd = pick(living()) as any; let how = 'from where he stood';
    if (rng() < 0.6) { const p = nearGuardPoint(gd, 6, 14, null); if (p) { teleport(p, `to put rounds past ${routeName(gd)}`); game.player.char.update(0); how = 'off open floor'; } }   // (mostly from a spot with the floor open between them, 6–14 m off: the rounds actually reach him; the rest through whatever stands between — a round into the wall this side of him is nothing to him, rightly)
    const n = 2 + Math.floor(rng() * 4); const ax = gd.char.bones.hips ?? gd.char.pos; const hd = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]); const m = game.player.char.muzzle;
    const dx = ax[0] - m[0], dz = ax[2] - m[2]; const L = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < n; i++) { const side = (rng() < 0.5 ? -1 : 1) * rr(0.4, 1.2); fireWeapon(game, game.player.char, [ax[0] - dz / L * side, hd[1] - rr(0, 0.4), ax[2] + dx / L * side], true); }   // (square off Sam's line to his body axis: past him, not into him — walls permitting)
    return `${n} past ${routeName(gd)} (${gd.script ? 'scripted' : gd.state}) ${how}, ${L.toFixed(0)} m → his suppression ${gd.sup.v.toFixed(2)}`;
  } });
  moreStims.push({ name: 'stand-in-fire', perMin: 0.5, when: () => living().length > 0 && !game.player.down, run: () => { const gd = pick(living()) as any; const p = nearGuardPoint(gd, 9, 16, true) ?? nearGuardPoint(gd, 6, 10, true); if (!p) return 'no spot'; teleport(p, `into ${routeName(gd)}'s fire`); game.godMode = true; game.player.crouch = false; game.player.visibility = rr(0.7, 1); visUntil = game.time + rr(4, 9); return `${v3.distXZ(p, gd.char.pos).toFixed(0)} m in front of ${routeName(gd)} (${gd.script ? 'scripted' : gd.state}), god on, vis ${game.player.visibility.toFixed(2)}`; } });
  // ---- lane R5 (Sam's FN2000, docs/internal/sc20k-design.md §5): only dealt under --rifle-per-min (0 = the schedule byte for byte as it was; the rifle then just rides
  //      his back through everything above and the invariants still watch it). Its keys worked at random wherever he is (2 — select, or with it up cycle the
  //      attachment — 1 / 3 / 4 / E / Z / L / R: the union widening's every branch, on the wall, mid-reload, mid-hold), a string put into a wall from where he
  //      stands — SEMI clicks or an AUTO hold (braced always: there is no brace button any more) — the same at a living man with god on, and a ring at a man:
  //      the RING attachment selected with 2, the reticle on him and a RIGHT click, else at his hips through the API (the stagger). rifleJob is the held trigger /
  //      cursor for the string's seconds (rifleTick, in the frame loop beside grabTick).
  let rifleJob: { until: number; target: () => Vec3 | null; auto: boolean; ring: boolean; clicks: number } | null = null;
  const rifleReady = () => { const pl = game.player; if (!pl.hasRifle) return false; if (pl.holding || pl.takedown || pl.kick || pl.picking || pl.down) return false; if (pl.wall) input.pressed.add('KeyQ'); if (pl.slot !== 'rifle' || pl.holstered) input.pressed.add(pl.slot === 'rifle' ? 'KeyE' : 'Digit2'); return true; };   // bring it round the player's way (off the wall first); the equip beat is the job's first half second
  function rifleTick() {
    const J = rifleJob; if (!J) return; const pl = game.player;
    if (game.time >= J.until || pl.down || pl.holding || !pl.hasRifle) { input.buttons &= ~5; rifleJob = null; return; }
    const tgt = J.target(); if (!tgt) { input.buttons &= ~5; rifleJob = null; return; }
    W.cursorAt(tgt);
    if (J.ring) { if (pl.rifleUp && pl.equipT <= 0 && pl.rifle.attachment !== 'ring' && pl.rifle.rings > 0) input.pressed.add('Digit2'); if (pl.rifle.attachment === 'ring' && frame % 20 === 0) { input.clicked |= 4; J.clicks++; } return; }   // (2 with it up flips the launcher back to RING; a right click lets one go)
    input.buttons = (input.buttons & ~5) | (J.auto ? 1 : 0);
    if (J.auto ? J.clicks === 0 : frame % 13 === 0) { input.clicked |= 1; J.clicks++; }
  }
  if (RIFLE_PER_MIN > 0) {
    moreStims.push({ name: 'rifle-keys', perMin: RIFLE_PER_MIN, mild: true, when: () => !game.player.down && !game.player.holding && !grabJob, run: () => { const keys: string[] = []; const n = 1 + Math.floor(rng() * 3); for (let i = 0; i < n; i++) keys.push(pick(['Digit2', 'Digit2', 'KeyE', 'KeyZ', 'Digit1', 'KeyL', 'KeyR', 'Digit2', 'Digit3', 'Digit4'])); for (const k of keys) input.pressed.add(k); const pl = game.player; return `${keys.join(' ')} (slot ${pl.slot}${pl.holstered ? ' holstered' : ''}${pl.wall ? ', on the wall' : ''}${pl.holding ? ', holding' : ''} · ${pl.rifle.mode}${pl.rifle.attachment ? ' ' + pl.rifle.attachment : ''} · rings ${pl.rifle.rings})`; } });   // (not with a man in the arm, nor while the grab job runs: E there is the hold's own draw / holster, and the job owns those presses and their bookkeeping)
    moreStims.push({ name: 'rifle-fire-wall', perMin: RIFLE_PER_MIN, when: () => !rifleJob && !grabJob && !rackJob && !holdF && !cursorDoor && rifleReady(), run: () => {
      const pl = game.player; const p = randomFloorPoint(); const tgt: Vec3 = [p[0], rr(0.4, 2.2), p[2]]; const auto = rng() < 0.5;
      if (auto !== (pl.rifle.mode === 'auto')) input.pressed.add('KeyZ');
      rifleJob = { until: game.time + rr(1, 3), target: () => tgt, auto, ring: false, clicks: 0 };
      return `${auto ? 'AUTO held' : 'SEMI clicks'} at (${tgt[0].toFixed(1)}, ${tgt[1].toFixed(1)}, ${tgt[2].toFixed(1)}) from (${pl.char.pos[0].toFixed(1)}, ${pl.char.pos[2].toFixed(1)}) · ${pl.rifle.roundsReady} ready`; } });
    moreStims.push({ name: 'rifle-fire-guard', perMin: RIFLE_PER_MIN * 0.6, when: () => !rifleJob && !grabJob && !rackJob && !holdF && !cursorDoor && living().some((x: any) => !x.held) && rifleReady(), run: () => {
      const pl = game.player; const gd = pick(living().filter((x: any) => !x.held)) as any; const auto = rng() < 0.4;
      if (rng() < 0.6) { const p = nearGuardPoint(gd, 5, 12, null); if (p) { teleport(p, `to put rifle rounds on ${routeName(gd)}`); game.player.char.update(0); } }
      if (auto !== (pl.rifle.mode === 'auto')) input.pressed.add('KeyZ');
      game.godMode = true; rifleJob = { until: game.time + rr(0.8, 2.5), target: () => gd.state === 'dead' ? null : (gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.2, 0])), auto, ring: false, clicks: 0 };
      return `${auto ? 'AUTO' : 'SEMI'} at ${routeName(gd)} (${gd.script ? 'scripted' : gd.state}) ${v3.distXZ(gd.char.pos, pl.char.pos).toFixed(0)} m off, god on`; } });
    moreStims.push({ name: 'he40', perMin: RIFLE_PER_MIN * 0.4, when: () => !rifleJob && !grabJob && !rackJob && !holdF && !cursorDoor && !game.player.down && !game.shells.length, run: () => {   // (gear: a 40 mm through the API at a spot on the floor — armed past HE40.armM, a dud nearer; the blast is frag.ts's and judges whoever stands there)
      const pl = game.player, rf = pl.rifle; if (rf.shells <= 0) { rf.shells = LAUNCHER40.rounds; return 'refilled the 40 mm rounds — next time'; }
      const p = randomFloorPoint(); const from = v3.add(pl.char.pos, [0, 1.3, 0]); const d = v3.distXZ(p, pl.char.pos);
      game.godMode = true; fireShell(game, pl.char, from, [p[0], 0.05, p[2]]); rf.shells--;
      return `API 40 mm at the floor ${d.toFixed(0)} m off, god on · rounds ${rf.shells}`; } });
    moreStims.push({ name: 'ring-guard', perMin: RIFLE_PER_MIN * 0.8, when: () => !rifleJob && !grabJob && !rackJob && !holdF && !cursorDoor && living().some((x: any) => !x.held) && rifleReady(), run: () => {
      const pl = game.player, rf = pl.rifle; const gd = pick(living().filter((x: any) => !x.held)) as any;
      if (rf.rings <= 0) { rf.rings = LAUNCHER.rings; ringBaseline = null; return `refilled the rings (they never come back on their own) — next time`; }   // (the sandbox refill; the rings-rose invariant re-baselines)
      if (rng() < 0.5) { const p = nearGuardPoint(gd, 4, 12, null); if (p) { teleport(p, `to put a ring on ${routeName(gd)}`); game.player.char.update(0); } }
      if (rng() < 0.4) {   // the body shot, through the API from wherever the launcher's tube would be: the stagger
        const from = v3.add(pl.char.pos, [0, 1.3, 0]); const hips = gd.char.bones.hips ?? v3.add(gd.char.pos, [0, 0.95, 0]);
        fireRing(game, pl.char, from, v3.copy(hips)); rf.rings = Math.max(0, rf.rings - 1); apiRings++;
        return `API ring at ${routeName(gd)}'s hips (${gd.script ? 'scripted' : gd.state}) from ${v3.distXZ(gd.char.pos, pl.char.pos).toFixed(0)} m · rings ${rf.rings}`;
      }
      rifleJob = { until: game.time + rr(0.9, 1.8), target: () => gd.state === 'dead' ? null : v3.add(gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]), [0, 0.03, 0]), auto: false, ring: true, clicks: 0 };
      return `RING + reticle + right click on ${routeName(gd)}'s head (${gd.script ? 'scripted' : gd.state}) ${v3.distXZ(gd.char.pos, pl.char.pos).toFixed(0)} m off · rings ${rf.rings}`; } });
  }
  let ringBaseline: { pl: any; n: number } | null = null; let apiRings = 0; let bracedOffFrames = 0; let rifleAnimOff = 0, rifleWrongPlace = 0; const ringKoSeen = new WeakSet<any>();
  // ---- Sam's low whistle (V, whistle.ts): pressed wherever he happens to be — and, more often than chance would have it, from a few metres BEHIND a living man
  //      (calm or not: an alert man's cue path and a searcher's re-dealt plan want exercising too), sometimes twice a few seconds apart (the twice rule). The
  //      key goes in through input.pressed like the player's; the invariants below watch who answers. --whistle-per-min 0 = the schedule byte for byte as it was.
  let whistleAgainAt = -1;   // game time a follow-up V is due (−1 none): dealt by the stimulus, pressed in the frame loop
  // ---- pursuit tactics: a man down IN a doorway (tactics.ts kill zone). A living free man is stood a hand off a random doorway's middle on one side of it and
  //      struck down (Sam's takedown, quiet); as often as not another living man is first turned to face him from where he stands so the drop is SEEN (the
  //      'drop' trigger) — else whoever finds him later marks it ('body'). Now and then the watcher is also handed a stun charge (the bang branch). The gate's own
  //      invariants and the walk-in smell watch what the floor then does about that doorway. --doorway-kills-per-min 0 = nothing of it, the schedule as it was.
  if (DOORKILL_PER_MIN > 0 && tacMod) {
    moreStims.push({ name: 'kill-in-doorway', perMin: DOORKILL_PER_MIN, when: () => living().filter((x: any) => !x.script && !x.held).length >= 1, run: () => {
      const men = living().filter((x: any) => !x.script && !x.held); const gd = pick(men) as any; const d = pick(doors.list) as any;
      const ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir); const side = rng() < 0.5 ? 1 : -1;
      const p: Vec3 = [d.def.hinge[0] + ux * d.def.width * 0.5 - uz * side * 0.45, 0, d.def.hinge[1] + uz * d.def.width * 0.5 + ux * side * 0.45];
      if (nav.isBlocked(p[0], p[2])) return `skipped: the ${d.def.name} doorway's ${side > 0 ? '+' : '−'} side is not floor`;
      gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); stimKilled.add(gd);
      let seen = 'unseen';
      const others = men.filter((x: any) => x !== gd);
      if (others.length && rng() < 0.6) { const o = pick(others) as any; const yaw = Math.atan2(p[0] - o.char.pos[0], p[2] - o.char.pos[2]); o.char.bodyYaw = o.char.aimYaw = yaw; o.char.update(0); seen = `${routeName(o)} turned onto him from ${v3.distXZ(o.char.pos, p).toFixed(0)} m`; if (rng() < 0.3) { tacMod.giveStuns(o, 1); seen += ' (+1 stun)'; } }
      killGuard(game, gd, [0, 0, 1], true);
      const rec = tacMod.dangerAt(game, d, gd.team);
      return `${routeName(gd)} struck down in the ${d.def.name} doorway (${seen}) → ${rec ? `dangerous for ${rec.team} (${rec.why}) ${(rec.until - game.time).toFixed(0)} s` : 'not marked (nobody saw)'}`; } });
  }
  if (needsMod && NEEDS_RATE !== 'off' && Number(NEEDS_RATE) > 1) {   // the needs, leaned on: the panel's 'send him' now and then — a random living staff man on his fullest need (or a coffee) from wherever he stands, the note saying why not when he would not go (up, busy, the tour…); the forced trip rides over the floor's slot by design, the invariants count it apart
    moreStims.push({ name: 'needs-quiet-spell', perMin: 0.5, when: () => game.time >= qrfHoldOff && !game.quietUtility, run: () => {   // a calm level-0 stretch long enough for a full need to be walked there and back under the mild stimuli only: the floor stood down, the men talked calm, a respite of two minutes or so
      game.standDown(); for (const x of living()) { if (x.script || x.held) continue; x.awareness = 0; x.state = 'patrol'; x.path = []; x.pathGoal = null; x.bodyDuty = null; x.task = null; }
      startRespite(rr(100, 170), 'a quiet spell for the needs'); return game.needsSummary?.() ?? null;
    } });
    moreStims.push({ name: 'send-for-need', perMin: 0.6, mild: true, when: () => living().some((x: any) => !x.unit && x.team === 'guard'), run: () => {
      const gd = pick(living().filter((x: any) => !x.unit && x.team === 'guard')) as any; const M = needsMod.needsMem(gd);
      const kinds = ['coffee', 'smoke', 'water', 'stretch']; const kind = M?.needs?.length && rng() < 0.7 ? [...M.needs].sort((a: any, b: any) => b.level - a.level)[0].kind : pick(kinds);
      return `${gd.callsign} → ${kind}: ${needsMod.needsSend(game, gd, kind)}`;
    } });
  }
  if (civMod && CIVILIANS_ARG !== 'off') {   // the civilians: frighten one where she stands (as if she had seen Sam where he stands — the beat, the scream, the run, the telling), send one to a phone,
                                             // and the grab from behind with its three rows (a question, then 'stay down' or the choke) — the invariants below watch what she and the men then do
    const civs = () => game.civilians.filter((c: any) => c.state !== 'dead' && !c.held && c.civ.state !== 'gone' && c.civ.state !== 'evacuate');
    moreStims.push({ name: 'civ-panic', perMin: 0.5 * CIV_RATE, when: () => civs().length > 0 && civMod.civiliansOnFloor(game), run: () => { const cv = pick(civs()) as any; const what = rng() < 0.7 ? 'panic' : 'phone'; return `${cv.callsign} (${cv.civ.state}) → ${what}: ${civMod.civPanic(game, cv, what)}`; } });
    moreStims.push({ name: 'civ-grab', perMin: 0.4 * CIV_RATE, when: () => !game.player.down && !game.player.holding && !grabJob && !holdF && !cursorDoor && !rackJob && civMod.civiliansOnFloor(game) && civs().some((c: any) => c.civ.state === 'work' || c.civ.state === 'cower'), run: () => {
      const cv = pick(civs().filter((c: any) => c.civ.state === 'work' || c.civ.state === 'cower')) as any; const f = cv.char.forward();
      teleport([cv.char.pos[0] - f[0] * 0.7, 0, cv.char.pos[2] - f[2] * 0.7], `behind ${cv.callsign} (${cv.civ.state})`); game.player.char.bodyYaw = cv.char.bodyYaw; game.player.holstered = rng() < 0.75; game.player.crouch = false;
      startGrab(game, cv); if (!game.player.holding) return `${cv.callsign}: the grab did not take`;
      const end = pick(['comply', 'comply', 'choke', 'questions']); civGrabJob = { cv, end, nextAt: game.time + rr(1.0, 1.8), asked: 3 - Math.floor(rng() * 3) };   // (asked counts UP to 3: start at 1‥3 = two, one or no questions before the end)
      smells.civGrabs = (smells.civGrabs ?? 0) + 1; return `${cv.callsign} in the arm (${game.player.holding.variant}) → ${end}`;
    } });
  }
  if (WHISTLE_PER_MIN > 0) {
    moreStims.push({ name: 'whistle', perMin: WHISTLE_PER_MIN, when: () => !game.player.down && !civGrabJob, run: () => {   // (not in a respite: a man sent searching keeps an alarm episode from lapsing, which is what the respite is for)
      let where = 'where he stands';
      if (rng() < 0.6 && living().length) { const gd = pick(living()) as any; const p = nearGuardPoint(gd, 2.5, 7.5, false) ?? nearGuardPoint(gd, 2.5, 7.5, null); if (p) { teleport(p, `to whistle at ${routeName(gd)}`); where = `${v3.distXZ(p, gd.char.pos).toFixed(1)} m off ${routeName(gd)} (${gd.script ? 'scripted' : gd.state})`; } }
      input.pressed.add('KeyV');
      if (rng() < 0.35) whistleAgainAt = game.time + rr(WHISTLE.cooldown + 0.2, 6);   // and again shortly, from wherever he has got to
      return `${where} · ready in ${whistleReadyIn(game).toFixed(1)} s · ${WHISTLE_STATS.blown} blown so far`;
    } });
  }
  if (CHECKPOINT_AT >= 0 && saveMod2) moreStims.push({ name: 'load-newest-checkpoint', perMin: 0.15, when: () => game.time >= qrfHoldOff && !tour && !game.quietUtility && !game.touring && !!game.saves?.newest(false), run: () => {   // (--checkpoint-at only, LAST in the list: the default schedule stays byte for byte what it was) an autosave slot loaded back mid-run (the down card's path, by hand): refused with the reason or the loaded world sane
    const info = game.saves.newest(false); const why = game.saves.load(game, info.key); if (why) return `refused: ${why}`; afterLoad('stimulus'); return `loaded ${info.key.replace('twopointsix.save.', '')} '${info.label}' (${(info.bytes / 1024).toFixed(0)} KB, ${game.saves.ageWords(game, info)})`; } });
  stims.push(...moreStims);
  /** respite: aggressive stimuli off, the player parked out of the way with the meter low — so an alarm episode can actually lapse (the floor escalates on its own,
   *  a natural lockdown deals its own clear) and a clear can reach its late phases before the scheduled interrupt (if any) lands */
  let respiteUntil = -1; let interruptAt = -1; let alertSince = -1;
  function startRespite(secs: number, why: string) {
    respiteUntil = game.time + secs;
    if (!game.player.down) { const far: Vec3[] = [[5.1, 0, 15.2], [4.9, 0, 23.2], [37.5, 0, 26.5], [2.0, 0, 2.0]]; let best = far[0], bd = -1; for (const p of far) { const d = Math.min(...living().map((g: any) => v3.distXZ(g.char.pos, p)), 99); if (d > bd) { bd = d; best = p; } } teleport(best, `(respite: ${why})`); }
    game.player.visibility = 0.02; visUntil = respiteUntil; tl(`RESPITE ${secs.toFixed(0)} s — ${why}`);
  }

  // -------- per-frame invariant state
  const stuck = new Map<any, { t0: number; p0: Vec3; last: Vec3; ground: number; reach: number; want: number; lastReport: number }>();
  const cellStuck = new Map<any, { t: number; p0: Vec3; lastReport: number }>();   // 'blocked-cell-stuck': seconds a free-to-move man with somewhere to be has stood on a nav-blocked cell without shifting (guards.ts un-stick should have him off it inside a second and a half)
  const unstick0 = { legs: UNSTICK.legs, snaps: UNSTICK.snaps };   // (the un-stick's counters are the module's, across seeds: this run's share is the difference — smells unstickLegs / unstickSnaps)
  const whistle0 = { ...WHISTLE_STATS };                            // (likewise the whistle's: blown / resolved / heardBy / answered / searched / cued / glanced / unanswered across seeds — smell whistleStats)
  const tactics0 = { ...TACTICS_STATS };                            // (likewise the tactics': plans dealt / flankers / seconds / goes / lone holds / doorways marked / gates / bangs / entries … — smell tacticsStats)
  const civ0 = { ...CIV_STATS }; const civStateTime: Record<string, number> = {}; const civPhoneLog = new Map<string, number>(); const civPhonedSeen = new Set<string>();   // (the civilians' counters across seeds — this run's share is the difference — seconds per state, and calls per fright)
  const needs0 = { ...NEEDS_STATS };                                // (likewise the needs': dealt / scheduled / forced / departed / arrived / completed / cancelled / radioed / told / replies / stuck — smell needsStats)
  const needsFrozenT = new Map<any, number>(), needsOffPatrolT = new Map<any, number>(); let needsLogI = needsMod ? needsMod.NEEDS_LOG.length : 0; const needsPhase = new Map<any, string>();   // per-man clocks for 'a trip while the needs must be frozen' / 'a trip on a man not patrolling', how far the module's log has been read, each man's phase last frame
  const alertStill = new Map<any, { t: number; p0: Vec3; lastReport: number }>();   // 'alert-frozen-with-fix': an alert man with a fix, free to move, covering < 0.3 m in 12 s running with no role to hold — a stall the tactics must never introduce
  const doorSidePrev = new Map<any, Map<any, number>>();            // each living man's side of every doorway last frame (the walk-in smell reads the crossing)
  const noprog = new Map<any, { t0: number; p0: Vec3; lastReport: number }>();
  const closeT = new Map<string, number>(); const closeReported = new Map<string, number>();
  const dutyBad = new Map<any, number>(); const lingerT = new Map<any, number>(); const lingerRep = new Map<any, number>();
  const doorPlant = new Map<any, { t: number; lastReport: number }>(); let lastPlayerHitT = -100;   // 'aim stuck in the door': an alert man rooted by a doorway with nothing he fires reaching Sam
  const aimBraking = new Map<any, boolean>();   // the aim model: who was braking for a shot last frame (a bout is the rising edge)
  const checkOnStale = new Map<any, number>();   // seconds a man has carried a checkOn errand for somebody already found / alive (guards.ts checkOnTick drops it the next suspicious frame; alert/search may hold it — that is fine — so only counted while suspicious)
  const planSeen = new Map<any, any>(), planVisits = new WeakMap<any, number>(), pieSeen = new Map<any, any>(), pieCrossed = new WeakSet<any>();   // search plans / pies already counted (smells)
  const witnessSnap = new Map<any, string>(), sawActSeen = new Map<any, any>(), sawHeldSeen = new WeakSet<any>(); let steppedAiOff = false;   // each man's witness record as JSON going into an AI-off frame (the no-write invariant) / sawAct records already counted / whether the frame just stepped ran with the AI off
  const talkStage = new WeakMap<any, number>();   // each Guard object's interrogation stage last frame (it may only go forward; weak: reset men go with their objects)
  const LOCK_IDS = new Set<string>(doors.list.filter((d: any) => d.def.locked).map((d: any) => d.lockId));   // every lock a key could be to on this floor
  let qrfPrevState = 'idle'; let qrfLogI = 0; const qrfCalm = new Map<any, number>(); const qrfRadio: number[] = [];
  let devLogI = 0; const devRadio: number[] = [];   // lane G4: the highest report seq read off the devices' log (monotonic past its cap and restarts), control's device lines inside the last minute   // lane qrf: the response's state last frame, how far its beat log has been read, per-man seconds spent below the hunt, its radio lines inside the last minute
  const latchedPrev = new Map<any, boolean>(); let keysPl: any = null, keysN = 0; let keyPrevPos: Vec3 | null = null;   // each leaf's latch last frame (the key invariants watch keyed leaves come off it), Sam's pocket size per Player object, and where he stood a frame ago
  const heldCount = new WeakMap<any, number>(); let heldPrev = new Set<any>(); let holdDeadFrames = 0; let variantHandsFrames = 0;   // grabs the harness has SEEN begin per Guard object (witness.wasHeld may not outrun it), who was held last frame, frames a corpse has stayed in the arm, frames the hold's variant and the hands have disagreed
  const standoffSeen = new WeakSet<any>(), standoffOrbit = new WeakMap<any, number>(), standoffFar = new Map<any, number>(), standoffNear = new Map<any, number>(), standoffNoHold = new Map<any, number>();   // the human shield: records counted, metres walked per record, per-man clocks for 'too far and idle' / 'on top of them' / 'nobody held'
  let heldLastFrame = new Set<any>(); let heldGoingIn: any = null; let downGoingIn = false; const stimKilled = new WeakSet<any>();   // who was in Sam's arm going into this frame (the set for the friendly-fire check, the one man for the round geometry) and whether Sam was already down; men the harness itself put down (killGuard pokes are nobody's round)
  const lastRoundF = new WeakMap<any, number>(), burstsSeen = new WeakSet<any>(), gunItemsSeen = new WeakSet<any>(), reloadingPrev = new WeakMap<any, boolean>();   // rifles (lane R2): each man's last round's frame (the burst interval), burst records / dropped guns already counted, who was mid-reload last frame
  let tracersSpawnedPrev = 0;   // tracers (lane R6): game.tracers.spawned as it stood after the last frame (streaks born this frame = the difference)
  const inSandboxTalk = new WeakSet<any>();   // men leaned on through the sandbox path (Game.interrogate / the bare engine on a man nobody holds): the engine stamps talk.heldSince itself for those, so it is no leftover on them
  const supAstray = new Map<any, number>(), supDisplaces = new WeakMap<any, number>();   // suppression (lane R3): frames a man has carried head-down clocks he should not; shifts already counted per Guard object
  let leaderBad = 0, heldRole = 0; let exceptions = 0; let consecutiveExc = 0; let overdueFrames = 0;
  let ammoPl: any = null, ammoTotal = 0;   // the Player object whose rounds were counted last frame, and the count: within one life it may only fall (nothing on the floor tops him up — a dead man's 9 mm magazines do not fit the Five-seveN)
  const INTERACT_KINDS = new Set(['light', 'door', 'body', 'guard', 'objective', 'held', 'breaker', 'wall', 'cancel']);   // ('breaker': the mains panel by hand — player.ts buildInteractables; 'wall': a partition a charge can go on, wallcharge.ts samRows; 'cancel': the selector's bottom row while the list is open)
  const finiteChar = (c: any) => Number.isFinite(c.pos[0]) && Number.isFinite(c.pos[1]) && Number.isFinite(c.pos[2]) && Number.isFinite(c.bodyYaw) && Number.isFinite(c.aimYaw) && Number.isFinite(c.aimPitch) && Number.isFinite(c.vel[0]) && Number.isFinite(c.vel[2]);

  function invariants() {
    // ---- checkpoints (game/savestate.ts): an AUTOSAVE written this frame was written on a frame its own rules allow — a live run, the AI on, nobody alert /
    //      searching / over the line, Sam up and free-handed, nothing on a fuse, no unit, the QRF idle, nobody scripted; the counts agree; the store holds ≤ 3 + 1 (under SAVETIMELINE five and five, and as many again in memory)
    if (saveMod2 && game.saves) {
      const S = game.saves;
      for (const w of savedThisFrame) if (w.slot === 'auto') {
        const bad: string[] = [];
        const st = game.mission.stage; if (game.quietUtility || game.puppet || game.touring || st === 'done' || st === 'failed') bad.push(`not live (quiet ${game.quietUtility} touring ${game.touring} stage ${st})`);
        if (!game.aiEnabled) bad.push('AI off');
        for (const x of game.guards) { if (x.state === 'dead') continue; if (x.state === 'alert' || x.state === 'search') bad.push(`${routeName(x)} ${x.state}`); else if (x.awareness > saveMod2.CKPT.awareMax + 1e-9) bad.push(`${routeName(x)} aw ${x.awareness.toFixed(2)}`); if (x.script) bad.push(`${routeName(x)} scripted`); if (x.unit) bad.push('a unit'); }
        const busy = w.mem ? null : saveMod2.playerBusy(game); if (busy) bad.push(`Sam ${busy}`); if (game.player.down) bad.push('Sam down');   // (a save kept in memory holds his hands and the air as they are: only a FILE lets go of them)
        if (game.qrf && game.qrf.state !== 'idle') bad.push(`qrf ${game.qrf.state}`); if (game.clearing && !w.mem) bad.push('clearing');
        if (!w.mem && (game.items.items.some((it: any) => !it.settled || ((it.kind === 'smoke' || it.kind === 'flash') && !it.fired)) || game.rings.length || game.shells.length)) bad.push('a thing in the air / on its fuse');
        if (bad.length) violate('autosave-while-compromised', bad[0], `an autosave was written with: ${bad.join(' · ')}`);
      }
      if (S.stats.autosaves !== autoWritten) violate('autosave-count', 'stats', `stats.autosaves ${S.stats.autosaves} ≠ ${autoWritten} handed to onSaved`);
      const nSlots = S.slots().length, TL = saveMod2.SAVETIMELINE, cap = TL.on ? 2 * (TL.auto + TL.manual) : saveMod2.CKPT.autoSlots + 1; if (nSlots > cap) violate('checkpoint-slots', String(nSlots), `${nSlots} slots stored (want ≤ ${TL.on ? `${TL.auto} auto + ${TL.manual} by hand, in the store and again in memory` : `${saveMod2.CKPT.autoSlots} auto + 1 manual`})`);
      if (S.pending && !S.enabled) violate('autosave-pending-off', 'pending', 'a request is pending with autosave off');
    }
    const t = game.time;
    // decals (experiment E1): the ring never holds more than its cap, a mark riding a box that is in the frame's list is never left hidden after a sync, and the
    // packed list stays inside its cap; how full it got is a smell (peak) — a soak fires hundreds of rounds and a few stun charges, so it fills
    if (game.decals) {
      const dc = game.decals; smells.decalsPeak = Math.max(smells.decalsPeak ?? 0, dc.count);
      if (dc.count > DECAL_CAP) violate('decals-unbounded', 'decals', `${dc.count} live decals (cap ${DECAL_CAP})`);
      if (frame % (HZ * 5) === 0) {   // every five seconds: sync + build by hand (headless has no renderer to do it) and check the packing
        dc.sync(W.engine.world); dc.build();
        if (dc.stats.listLen > DECAL_LIST_CAP) violate('decals-list-overflow', 'decals', `${dc.stats.listLen} cell entries (cap ${DECAL_LIST_CAP})`);
        const strayHidden = dc.list.filter((d: any) => d.hidden && d.box && W.engine.world.dynamics.includes(d.box)).length;
        if (strayHidden) violate('decals-hidden', 'decals', `${strayHidden} riding mark(s) hidden though their box is in this frame's list`);
        for (const d of dc.list) if (!d.pos.every(Number.isFinite) || !d.n.every(Number.isFinite)) { violate('decals-nan', 'decals', `a ${d.kind} with a non-finite placement ${JSON.stringify(d.pos)} / ${JSON.stringify(d.n)}`); break; }
        smells.decalKinds = dc.list.reduce((m: any, d: any) => { m[d.kind] = (m[d.kind] ?? 0) + 1; return m; }, {});
      }
    }
    if (glassMod2) { const n = glassMod2.glassPanes(game).length; if (soakGlassN < 0) soakGlassN = n; if (n !== soakGlassN) violate('glass-pane-count', 'glass', `${n} panes now, ${soakGlassN} at the start (panes never break or vanish)`); for (const bi of glassMod2.glassPanes(game)) { const b = game.level.boxes[bi]; if (!(b.flags & BoxFlag.Glass) || (b.flags >>> 18) !== 0) { violate('glass-flags', 'glass', `pane ${bi} flags 0x${b.flags.toString(16)} (Glass dropped, or a bit above it set)`); break; } } smells.glassHits = glassMod2.glassState(game).hits; smells.glassStarsLive = glassMod2.crackCount(game); }   // glass (E3): the level's panes are panes for the whole run — nothing clears the bit, nothing sets a bit above it (there is no Broken); how many rounds starred glass is a smell
    // destruction (stage 3b): the rigid pool never passes its tier cap, nothing hidden that was never indexed, the log capped, every chunk finite, the heat finite; the counters are smells
    if (destrMod2 && game.destr) {
      const dz = game.destr, deb = dz.debris; const cap = deb.cap();
      if (deb.list.length > cap) violate('debris-unbounded', 'destruction', `${deb.list.length} chunks (cap ${cap})`);
      smells.debrisPeak = Math.max((smells.debrisPeak as number) ?? 0, deb.list.length); smells.debrisMovingPeak = Math.max((smells.debrisMovingPeak as number) ?? 0, deb.moving);
      if (destrMod2.DESTR_LOG.length > 200) violate('destr-log-unbounded', 'destruction', `${destrMod2.DESTR_LOG.length} log lines (cap 200)`);
      if (frame % (HZ * 2) === 0) {
        const inv = dz.inventory(); const indexed = (inv.paper ?? 0) + (inv.screen ?? 0) + (inv.housing ?? 0) + (inv.clutter ?? 0) + (inv.binder ?? 0) + (inv.tv ?? 0);
        if (inv.hidden > indexed) violate('destr-hidden', 'destruction', `${inv.hidden} hidden statics > ${indexed} indexed`);
        for (const c of deb.list) if (!c.box.c.every(Number.isFinite) || !c.v.every(Number.isFinite) || (c.box.rot && !c.box.rot.every(Number.isFinite))) { violate('debris-nan', 'destruction', `a ${c.kind} chunk with a non-finite pose / velocity`); break; }
        const h = dz.heatAt(game.player.char.pos); if (!Number.isFinite(h) || h > 200) violate('destr-heat', 'destruction', `heat ${h} at Sam's feet (finite, ≤ 200: 20 rounds/s cannot pass 40)`);
        if (game.tune.chaos === 0 && Object.values(destrMod2.DESTR_STATS).some((v: any) => v !== 0)) violate('destr-chaos0', 'destruction', `the module counted something at chaos 0: ${JSON.stringify(destrMod2.DESTR_STATS)}`);
        if (game.touring && deb.moving > 0 && !(smells.destrTourMovers)) { smells.destrTourMovers = 1; violate('destr-under-tour', 'destruction', `${deb.moving} chunks moving under the tour (chaosOf must be 0 while touring)`); }
        smells.destrStats = { ...destrMod2.DESTR_STATS }; smells.debrisStats = { ...deb.stats };
        if (DESTR_X) { smells.wallStats = { ...DESTR_X.W }; smells.breakStats = { ...DESTR_X.B }; }   // (module counters: they run on from seed to seed)
      }
    }
    if (game.player.hitFlash > 1 - 3.5 * DT) lastPlayerHitT = t;   // (set to 1 by a round that reached him, decayed by 3·dt at the end of the same update)
    { const now = new Set<any>(); for (const gd of game.guards) if (gd.held) { now.add(gd); if (!heldPrev.has(gd)) { heldCount.set(gd, (heldCount.get(gd) ?? 0) + 1); smells.holdsBegun = (smells.holdsBegun ?? 0) + 1; } } heldPrev = now; }   // a hold that began this frame (by the stimulus or the press)
    // muzzle discipline: every guard round fired this frame (a guardShot event stamped now, placed at the shooter's feet) — its muzzle → Sam's-chest segment against
    // every OTHER living guard's body axis: inside 0.3 m of one is a round through (or a hand off) a colleague, which guards.ts muzzleCheck exists to make impossible.
    // The man in Sam's arm is the exception with his own, tighter rule (the human shield, guards.ts flankShot): the segment to where the round STOPS — Sam's near
    // side, 0.28 short of his axis — must pass at least 0.45 m (less a whisker for the muzzle's offset from the shoulder line the rule is worked on) from his axis:
    // only a round from behind the pair does that
    for (const e of game.events) {
      if (e.kind !== 'guardShot' || e.time !== t) continue;
      const shooter = game.guards.find((x: any) => x.state !== 'dead' && v3.distXZ(x.char.pos, e.pos) < 0.05); if (!shooter) continue;
      smells.guardRounds = (smells.guardRounds ?? 0) + 1; if (shooter.standoff) smells.standoffShots = (smells.standoffShots ?? 0) + 1;
      // muzzle discipline round the shield (guards.ts SHIELD_RELEASE_BEAT_*, tune.muzzleDiscipline on): a man held going into this frame AND still up in the arm
      // coming out of it was a shield for every instant of it — no round of anybody's may have left meanwhile (the fold / the whip / a death in the arm all happen
      // in updatePlayer ahead of the guards, so a hold that ended this frame is out of this test, and the beat after it is the probes' business)
      // — or the round that put Sam down with the man still in his arm (hitPlayer lets the man go inside the step, so holding reads null after it: told by Sam up
      // going in, down coming out, the man alive — nothing but a guard's round downs Sam)
      { const Hn = game.player.holding; const stillHeld = !!Hn && heldGoingIn === Hn.g && Hn.g.state !== 'dead' && !game.player.down; const downedHolding = !!heldGoingIn && heldGoingIn.state !== 'dead' && !downGoingIn && game.player.down;
        if (game.tune.muzzleDiscipline && (stillHeld || downedHolding) && !(GUNHOLD.on && shooter.standoff && game.time - gunHoldStats(game).freeT < 0.05)) violate('shield-fired-on', routeName(shooter), `${routeName(shooter)} (${shooter.standoff ? 'standoff' : shooter.state}${shooter.pinned ? ', pinned' : ''}${shooter.script ? ', scripted' : ''}) fired with ${routeName(heldGoingIn)} alive in Sam's arm (${Hn ? Hn.phase : 'and that round put Sam down'}) and muzzle discipline on; shooter at ${p2(shooter.char.pos)}, Sam at ${p2(game.player.char.pos)}, seen ${f2(t - shooter.lastSeenT)} s ago`); }
      const heldMan = game.player.holding?.g ?? heldGoingIn;   // (a hold this very round ended — Sam shot down from behind — still had the man on his station when it flew)
      const trunk = game.player.char.bones.spine2 ?? game.player.char.pos;   // the segment the AI fires and checks along (guards.ts: the alert branch aims at Sam's TRUNK where it is — spine2, a crouch or a wall lean carries it a hand or two off his root — and roundPastColleague looks down this frame's muzzle): the muzzle the round LEFT (the event carries it; by the end of the frame the recoil has moved it centimetres) to the trunk point at the aim height
      const from = e.from ?? shooter.char.muzzle; const to: Vec3 = [trunk[0], game.player.char.pos[1] + (game.player.crouch ? 0.8 : 1.25), trunk[2]];
      const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; const L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
      for (const o of game.guards) {
        if (o === shooter || o.state !== 'dead' && !o.char.alive || o.state === 'dead') continue;
        const h = o.char.bones.hips ?? o.char.pos;
        if (o === heldMan) {   // the shield: clearance off the segment muzzle → Sam's near side (his hit cylinder, 0.28 about his pelvis, at the standoff's aim height)
          const sh = game.player.char.bones.hips ?? game.player.char.pos; const ax = sh[0] - from[0], az = sh[2] - from[2], ay = (game.player.char.pos[1] + 1.42) - from[1]; const L = Math.hypot(ax, ay, az);
          const k = L > 0.33 ? (L - 0.28) / L : 1; const ix = ax * k, iz = az * k; const I2 = ix * ix + iz * iz;
          const tt = I2 > 1e-6 ? Math.max(0, Math.min(1, ((h[0] - from[0]) * ix + (h[2] - from[2]) * iz) / I2)) : 0;
          const d = Math.hypot(from[0] + ix * tt - h[0], from[2] + iz * tt - h[2]);
          smells.roundsPastHostageMin = Math.min(smells.roundsPastHostageMin ?? 99, f2(d));
          if (d < 0.45 - 0.02) violate('round-near-hostage', `${routeName(shooter)}→${routeName(o)}`, `${routeName(shooter)} (${shooter.standoff ? 'standoff' : shooter.state}) fired with the held man ${routeName(o)} only ${d.toFixed(2)} m off the round's segment to Sam's near side (want ≥ 0.45); shooter at ${p2(shooter.char.pos)}, Sam at ${p2(game.player.char.pos)} facing ${f2(game.player.char.bodyYaw)}, hold ${game.player.holding?.phase}`);
          continue;
        }
        const tt = Math.max(0, Math.min(1, ((h[0] - from[0]) * dx + (h[2] - from[2]) * dz) / L2));
        const px = from[0] + dx * tt, py = from[1] + dy * tt, pz = from[2] + dz * tt; const y0 = o.char.pos[1] + 0.05, y1 = o.char.bones.headTop?.[1] ?? 1.75; const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
        const d = Math.hypot(px - h[0], pz - h[2], ddy);
        if (d < 0.3) violate('round-past-colleague', `${routeName(shooter)}→${routeName(o)}`, `${routeName(shooter)} (${shooter.pinned ? 'pinned ' : ''}${shooter.state}${shooter.standoff ? '/standoff' : ''}, muzzleDown ${shooter.muzzleDown}) fired with ${routeName(o)} (${o.script ? 'scripted' : o.state}) ${d.toFixed(2)} m off the muzzle→Sam segment at ${p2(o.char.pos)}; shooter at ${p2(shooter.char.pos)}, Sam at ${p2(game.player.char.pos)}`);
      }
      // suppression (lane R3): a man whose head is down, or who is shifting to cover, fires nothing — the alert branch's head-down sub-branch sits above the round
      // and never reaches it (suppression.ts headDown; the clocks it keeps only change in there, so a man pinned by a LATER round this frame still reads up here)
      { const Ss = shooter.sup; if (game.tune.suppression && (Ss.downT > 0 || Ss.latched || Ss.cover)) violate('sup-fired-down', routeName(shooter), `${routeName(shooter)} fired with his head down (suppression ${Ss.v.toFixed(2)}, downT ${Ss.downT.toFixed(2)}, latched ${Ss.latched}, shifting ${!!Ss.cover}; ${shooter.standoff ? 'standoff' : shooter.state}${shooter.pinned ? ', pinned' : ''}) at ${p2(shooter.char.pos)}`); }
    }
    // suppression (lane R3, suppression.ts): everybody's scalar finite and inside [0, cap], the pulse envelope too; nothing left on a corpse a frame after he
    // died (updateSuppression zeroes the dead and the held at the top of the frame — a man grabbed or shot this frame keeps his number till the next); the
    // reaction clocks (head down, the shift) only ever on a living alert free man with the flag on (three frames' grace: a man talked out of 'alert' mid-frame is
    // cleared at the top of the next); the cover spot a shift heads for is a free nav cell; and the smells — pinned edges, shifts, seconds head-down, Sam's peak
    {
      const cap = SUPPRESSION.cap + 1e-9; const P = game.player.sup;
      if (!Number.isFinite(P.v) || P.v < 0 || P.v > cap || !Number.isFinite(P.kick) || P.kick < 0) violate('sup-range', 'player', `Sam's suppression ${P.v} kick ${P.kick} (down ${game.player.down})`);
      if (game.player.down && P.v !== 0 && downGoingIn) violate('sup-down', 'player', `Sam is down (since before this frame) but carries suppression ${P.v}`);
      smells.supSamPeak = Math.max((smells.supSamPeak as number) ?? 0, f2(P.v) as number); if (P.v >= SUPPRESSION.pinned) smells.supSamPinnedSeconds = f2(((smells.supSamPinnedSeconds as number) ?? 0) + DT);
      for (const gd of game.guards) {
        const S = gd.sup, name = routeName(gd);
        if (!Number.isFinite(S.v) || S.v < 0 || S.v > cap || !Number.isFinite(S.kick) || S.kick < 0 || !Number.isFinite(S.downT) || S.downT < 0 || !Number.isFinite(S.pinnedT) || S.pinnedT < 0) violate('sup-range', name, `${name}'s suppression ${S.v} kick ${S.kick} downT ${S.downT} pinnedT ${S.pinnedT} (${gd.state}${gd.held ? ', held' : ''})`);
        if (gd.state === 'dead' && S.v !== 0 && t - gd.diedAt > 2 * DT) violate('sup-dead', name, `${name} is dead ${(t - gd.diedAt).toFixed(2)} s but carries suppression ${S.v}`);
        const clocks = S.downT > 0 || S.latched || !!S.cover;
        const astray = clocks && (gd.state !== 'alert' || !game.tune.suppression || !game.aiEnabled || !!gd.held || !!gd.script);
        const acc = astray ? (supAstray.get(gd) ?? 0) + 1 : 0; supAstray.set(gd, acc);
        if (acc > 3) violate('sup-clocks-astray', name, `${name} carries head-down clocks (downT ${S.downT.toFixed(2)}, latched ${S.latched}, cover ${p2(S.cover)}) for ${acc} frames while ${gd.state}${gd.held ? '/held' : ''}${gd.script ? '/scripted' : ''}, flag ${game.tune.suppression}, AI ${game.aiEnabled}`);
        if (S.cover && (nav.isBlocked(S.cover[0], S.cover[2]) || !Number.isFinite(S.cover[0]) || !Number.isFinite(S.cover[2]))) violate('sup-cover-blocked', name, `${name} shifts to cover at ${p2(S.cover)} — not a free nav cell`);
        if (S.pinnedAt === t) { smells.supPinnedEdges = ((smells.supPinnedEdges as number) ?? 0) + 1; if ((smells.supPinnedEdges as number) <= 8) tl(`SUP ${name} pinned (${S.v.toFixed(2)}, by #${S.srcId}${S.srcId === PLAYER_ID ? ' Sam' : ''}) — ${gd.script ? 'scripted' : gd.state}${gd.standoff ? '/standoff' : ''} at ${p2(gd.char.pos)}`); }
        const dn = supDisplaces.get(gd) ?? 0; if (S.displaces > dn) { supDisplaces.set(gd, S.displaces); smells.supShifts = ((smells.supShifts as number) ?? 0) + (S.displaces - dn); if ((smells.supShifts as number) <= 8) tl(`SUP ${name} shifts to cover ${p2(S.cover)} from ${p2(gd.char.pos)} (${S.displaces}× this life)`); }
        if (gd.state !== 'dead' && (S.downT > 0 || S.latched)) smells.supHeadDownSeconds = f2(((smells.supHeadDownSeconds as number) ?? 0) + DT);
        if (gd.state !== 'dead' && S.v >= SUPPRESSION.flinch) smells.supRattledSeconds = f2(((smells.supRattledSeconds as number) ?? 0) + DT);
      }
    }
    // the aim-settle model (aim.ts): every track inside [0, 1] and the bearing / feet bookkeeping finite, Sam's too; with the model on, every guard round that the
    // first-shot gate stood in front of (a single round, the first of a burst — aim.lastShot.gated, stamped by guardRound the frame it flew) left with track ≥
    // acquireMin unless the man is pinned (lined up from his mark), and its cone is finite, non-negative and short of absurd; with it off nothing is ever stamped.
    // Smells: rounds let go short of settled, brake bouts, seconds a man had Sam lined up (◎)
    {
      const G = AIM.guard;
      const rangeOk = (A: any) => Number.isFinite(A.track) && A.track >= 0 && A.track <= 1 + 1e-9 && Number.isFinite(A.bearingRate) && A.bearingRate >= 0 && Number.isFinite(A.speedSm) && A.speedSm >= 0;
      if (!rangeOk(game.player.aim)) violate('aim-range', 'player', `Sam's aim state ${JSON.stringify(game.player.aim)}`);
      for (const gd of game.guards) {
        const A = gd.aim, name = routeName(gd);
        if (!rangeOk(A)) violate('aim-range', name, `${name}'s aim state track ${A.track} brg ${A.bearingRate} feet ${A.speedSm} (${gd.state}${gd.pinned ? ', pinned' : ''}${gd.held ? ', held' : ''})`);
        if (!game.tune.aimModel && (A.track !== 0 || A.lastShot && A.lastShot.t === t)) violate('aim-off-leak', name, `model off but ${name} carries track ${A.track} / a round stamped this frame`);
        if (gd.state !== 'dead' && game.tune.aimModel && gd.state === 'alert' && A.track >= G.acquireMin) smells.aimLinedUpSeconds = f2(((smells.aimLinedUpSeconds as number) ?? 0) + DT);
        const wasBraking = aimBraking.get(gd) ?? false; if (A.braking && !wasBraking) smells.aimBrakeBouts = ((smells.aimBrakeBouts as number) ?? 0) + 1; aimBraking.set(gd, A.braking);
        if (A.braking && (gd.state !== 'alert' || gd.pinned || !game.tune.aimModel)) violate('aim-brake-astray', name, `${name} braking for a shot while ${gd.state}${gd.pinned ? '/pinned' : ''}, model ${game.tune.aimModel}`);
        const ls = A.lastShot;
        if (ls && ls.t === t) {
          smells.aimRounds = ((smells.aimRounds as number) ?? 0) + 1; if (ls.track < 0.7) smells.aimRoundsUnsettled = ((smells.aimRoundsUnsettled as number) ?? 0) + 1; if (ls.speed > G.stopToShoot) smells.aimRoundsOnTheRun = ((smells.aimRoundsOnTheRun as number) ?? 0) + 1;
          if (!Number.isFinite(ls.spread) || ls.spread < 0 || ls.spread > 1.5) violate('aim-spread', name, `${name}'s round left with a cone of ${ls.spread} rad (${JSON.stringify(ls)})`);
          if (ls.gated && ls.track < G.acquireMin - 1e-6 && !gd.pinned) violate('aim-ungated', name, `${name} (${gd.standoff ? 'standoff' : gd.state}, ${gd.weapon.def.id}) let a gated round go at track ${ls.track.toFixed(3)} < acquireMin ${G.acquireMin} — ${JSON.stringify(ls)}`);
        }
      }
      if (!game.tune.aimModel && (game.player.aim.track !== 0)) violate('aim-off-leak', 'player', `model off but Sam carries track ${game.player.aim.track}`);
    }
    // rifles (lane R2, guards.ts burstTrigger / tickReloadBeat, weapons.ts Firearm): every round says which row fired it and carries the segment it flew; no man lets
    // two rounds go nearer than 5 frames apart at 60 Hz (600 rpm = every 6th; the sidearm's cadence is half a second) and never two in a frame; a burst record only
    // ever hangs off a burst-capable row on a living man, its counts inside the row's spec, and never through a reload; the magazine and chamber never go negative
    // or past the box; the reload beat never runs past the row's dur, and when it ends the box is full; a 'rifle' on the floor only ever came out of a rifleman's
    // hands (his gd.dropped, his row's drop kind), a thirty-round box (a 'mag' with fill 2) only ever out of a rifleman's reload
    {
      const perShooter = new Map<any, number>();
      for (const e of game.events) {
        if ((e.kind !== 'guardShot' && e.kind !== 'shot') || e.time !== t) continue;
        if (e.kind === 'shot' && !e.weapon) continue;   // (a 'shot' the harness pushed by hand, or a canister's pop: not a round)
        if (!e.weapon || !e.from || !e.to || ![...e.from, ...e.to].every(Number.isFinite)) { violate('round-untagged', e.kind, `a ${e.kind} event without its row / segment: ${JSON.stringify({ weapon: e.weapon, from: e.from, to: e.to })}`); continue; }
        smells[`rounds:${e.weapon}`] = (smells[`rounds:${e.weapon}`] ?? 0) + 1;
        if (e.kind !== 'guardShot') continue;
        const shooter = game.guards.find((x: any) => v3.distXZ(x.char.pos, e.pos) < 0.05); if (!shooter) continue;
        perShooter.set(shooter, (perShooter.get(shooter) ?? 0) + 1);
        if (e.weapon !== shooter.weapon.def.id) violate('round-wrong-row', routeName(shooter), `${routeName(shooter)} carries ${shooter.weapon.def.id} but the round says ${e.weapon}`);
        const lf = lastRoundF.get(shooter); if (lf !== undefined && frame - lf < 5 && frame !== lf) violate('burst-interval', routeName(shooter), `${routeName(shooter)} (${shooter.weapon.def.id}) fired ${frame - lf} frames after his last round (want ≥ 5)`);
        lastRoundF.set(shooter, frame);
      }
      for (const [s, n] of perShooter) if (n > 1) violate('two-rounds-a-frame', routeName(s), `${routeName(s)} (${s.weapon.def.id}) let ${n} rounds go in one frame`);
      for (const gd of game.guards) {
        const w = gd.weapon, D = w.def, name = routeName(gd);
        if (w.mag !== null && (w.mag < 0 || w.mag > D.magCapacity) || (w.chamber !== 0 && w.chamber !== 1) || w.roundsReady > D.magCapacity + (D.topUp ? 1 : 0)) violate('mag-range', name, `${name}'s ${D.id}: chamber ${w.chamber} mag ${w.mag} (box ${D.magCapacity})`);
        if (gd.reloadT > D.reload.dur + 1e-6) violate('reload-overrun', name, `${name}'s reload beat at ${gd.reloadT.toFixed(3)} s (dur ${D.reload.dur})`);
        const rel = gd.reloadT >= 0, was = reloadingPrev.get(gd) ?? false; reloadingPrev.set(gd, rel);
        if (rel && !was) smells[`reloads:${D.id}`] = (smells[`reloads:${D.id}`] ?? 0) + 1;
        if (!rel && was && gd.state !== 'dead' && w.roundsReady !== D.magCapacity + (D.topUp ? 1 : 0)) violate('reload-incomplete', name, `${name}'s reload beat ended with ${w.roundsReady} ready (box ${D.magCapacity}${D.topUp ? ' + 1' : ''})`);   // (the beat ends → rearm: a full box, the round up the pipe racked out of it or on top as the row has it — and no round leaves the frame the beat ends)
        const b = w.burst;
        if (b) {
          if (!D.burst) violate('burst-on-pistol', name, `${name} carries a burst record on ${D.id}`);
          else {
            if (!burstsSeen.has(b)) { burstsSeen.add(b); smells.burstsBegun = (smells.burstsBegun ?? 0) + 1; if (b.off) smells.burstsWide = (smells.burstsWide ?? 0) + 1; }
            if (!(b.left >= 0 && b.left <= D.burst.max && b.n >= D.burst.min && b.n <= D.burst.max && b.idx >= 0 && b.idx <= D.burst.max && Number.isFinite(b.nextT) && b.nextT <= D.burst.interval + 1e-6)) violate('burst-range', name, `${name}'s burst ${JSON.stringify(b)} against ${JSON.stringify(D.burst)}`);
            if (b.off && (![...b.off].every(Number.isFinite) || Math.hypot(b.off[0], b.off[2]) > 1.0 + 1e-6 || Math.hypot(b.off[0], b.off[2]) < 0.6 - 1e-6)) violate('burst-offset', name, `${name}'s opening burst offset ${JSON.stringify(b.off)} (want 0.6–1.0 m flat)`);
            if (gd.reloadT >= 0) violate('burst-in-reload', name, `${name} carries a burst record ${JSON.stringify(b)} through his reload beat (${gd.reloadT.toFixed(2)} s left)`);
          }
        }
        const dealt = gd.carbine ? 'aks74u' : (gd.route?.weapon ?? level.routes[gd.routeI]?.weapon ?? 'guard9mm');   // what Game.update deals a living man: the carbine by the knob, else his route's row (Guard.route: the level's for staff, a spawned unit's own one-point route — the response team's carbines, lane qrf)
        if (gd.state !== 'dead' && D.id !== dealt) violate('deal-mismatch', name, `${name}: carbine ${gd.carbine}, route row ${gd.route?.weapon ?? level.routes[gd.routeI]?.weapon ?? 'guard9mm'}, but carries ${D.id} (deal '${game.tune.carbineGuards}')`);
      }
      for (const it of game.items.items) {
        if (it.kind === 'rifle' && ![...it.pos, ...it.vel, it.yaw, it.tumble].every(Number.isFinite)) violate('nan', `rifle-item-${it.who}`, `rifle item ${JSON.stringify({ pos: it.pos, vel: it.vel })}`);
        if (gunItemsSeen.has(it)) continue; gunItemsSeen.add(it);   // provenance is asked the frame it appears (the men it names are this encounter's)
        if (it.kind === 'rifle' && it.who === PLAYER_ID) {   // (lane R5: Sam's own FN2000 out of his hands as he went down — combat.ts hitPlayer, fill 1 = its own body)
          smells.samRifleDropped = (smells.samRifleDropped ?? 0) + 1;
          if (it.fill !== 1 || !game.player.down || !game.player.rifleGone) violate('rifle-provenance', 'player', `a 'rifle' item from Sam: fill ${it.fill}, down ${game.player.down}, rifleGone ${game.player.rifleGone}`);
        } else if (it.kind === 'rifle') {
          smells.riflesDropped = (smells.riflesDropped ?? 0) + 1;
          const owner = game.guards.find((x: any) => x.char.id === it.who);
          if (!owner || owner.dropped !== it || owner.weapon.def.drop !== 'rifle' || owner.state !== 'dead') violate('rifle-provenance', String(it.who), `a 'rifle' item from who ${it.who}: ${owner ? `${routeName(owner)} (${owner.state}) carries ${owner.weapon.def.id} (drop ${owner.weapon.def.drop}), his dropped is ${owner.dropped?.kind ?? 'null'}` : 'not a guard'}`);
        } else if (it.kind === 'mag' && it.fill > 1 && it.who === PLAYER_ID) {   // (lane R5: Sam's black thirty out of HIS reload — player.ts, fill 3)
          smells.samBoxesDropped = (smells.samBoxesDropped ?? 0) + 1;
          if (it.fill !== 3 || !game.player.rifle.reloading) violate('box-provenance', 'player', `a box fill ${it.fill} from Sam with his rifle ${game.player.rifle.reloading ? '' : 'NOT '}reloading`);
        } else if (it.kind === 'mag' && it.fill > 1) {
          smells.boxesDropped = (smells.boxesDropped ?? 0) + 1;
          const owner = game.guards.find((x: any) => x.char.id === it.who);
          if (!owner || owner.weapon.def.reload.out === undefined || owner.reloadT < 0) violate('box-provenance', String(it.who), `a thirty-round box from who ${it.who} (${owner ? `${routeName(owner)} with ${owner.weapon.def.id}, reloadT ${owner.reloadT.toFixed(2)}` : 'not a guard'})`);
        } else if ((it.kind === 'pistol' || it.kind === 'torch') && it.age < DT + 1e-9) {
          const owner = game.guards.find((x: any) => x.char.id === it.who);
          if (owner && owner.weapon.def.drop === 'rifle' && it.kind === 'pistol') violate('rifleman-dropped-pistol', routeName(owner), `${routeName(owner)} carries the carbine but a 'pistol' item left his hand`);
          if (owner && owner.weapon.def.rig === 'carbine' && it.kind === 'torch') violate('rifleman-dropped-torch', routeName(owner), `${routeName(owner)} carries the carbine (no hand torch) but a 'torch' item left his hand`);
        }
      }
    }
    // tracers (lane R6, tracers.ts, behind tune.tracers): never more streaks alive than the pool holds nor more heads lit than the light budget, every live head
    // between its muzzle and its impact (0 ≤ s ≤ L) on a finite unit segment no longer than the 60 m a round is traced, the LightSet's 'tracer' lights exactly the
    // lit heads (none orphaned, none missing), a streak only ever born on a frame a carbine round flew (a guardShot / shot event off a row with a tracer, this
    // frame) — and with the flag off, nothing at all
    {
      const T = game.tracers, P = tracerFx;
      const setLights = game.engine.lights.lights.filter((l: any) => l.group === 'tracer').length;
      let n = 0, lit = 0;
      for (const tr of T.each()) {
        n++; if (tr.light) lit++;
        if (!(tr.s >= 0 && tr.s <= tr.L + 1e-6) || !(tr.L > 0 && tr.L <= 60 + 1e-6) || ![...tr.from, ...tr.dir, tr.v, tr.age].every(Number.isFinite) || Math.abs(Math.hypot(tr.dir[0], tr.dir[1], tr.dir[2]) - 1) > 1e-6) violate('tracer-range', 'tracers', `a streak with s ${tr.s} / L ${tr.L}, v ${tr.v}, from ${p2(tr.from)}, |dir| ${Math.hypot(tr.dir[0], tr.dir[1], tr.dir[2]).toFixed(6)}`);
        if (tr.light && (!(tr.light.ttl >= 0) || tr.light.owner !== tr.owner)) violate('tracer-light', 'tracers', `a head light with ttl ${tr.light.ttl} (transient bit needs ≥ 0) / owner ${tr.light.owner} vs the streak's ${tr.owner}`);
      }
      if (n !== T.live || n > P.maxLive) violate('tracer-count', 'tracers', `${n} streaks alive by each(), live says ${T.live}, pool ${P.maxLive}`);
      if (lit > P.maxLights || lit !== T.lit || setLights !== lit) violate('tracer-lights', 'tracers', `${lit} lit heads (T.lit ${T.lit}, max ${P.maxLights}) but ${setLights} 'tracer' lights in the LightSet`);
      const born = T.spawned - tracersSpawnedPrev; tracersSpawnedPrev = T.spawned;
      if (born > 0) {
        smells.tracers = (smells.tracers ?? 0) + born;
        const carbineRounds = game.events.filter((e: any) => (e.kind === 'guardShot' || e.kind === 'shot') && e.time === t && e.weapon && WEAPON_TRACER.has(e.weapon)).length;
        if (born > carbineRounds) violate('tracer-unfired', 'tracers', `${born} streak(s) born this frame but ${carbineRounds} round(s) off a tracer row flew`);
        if (!game.tune.tracers) violate('tracer-flag-off', 'tracers', `${born} streak(s) born with tune.tracers off`);
      }
      if (!game.tune.tracers && (n || setLights)) violate('tracer-flag-off', 'tracers', `${n} streaks / ${setLights} tracer lights alive with tune.tracers off`);
    }
    // the human shield's standoff (guards.ts Guard.standoff): only ever on a living, free, ALERT man while somebody IS held (a frame's grace for a hold that ended
    // under a later man's round this frame), never under the tour flag; the record names the held man; and a man in it is at the ring (inside 7.5 m of the pair) or
    // on his way to it — three seconds' standing further off than that (not reacting, not dazzled) is the old 'planted and staring' back under a new name. A held
    // man dropped by a colleague's ROUND (downBy 'guard' out of fireWeapon, not the harness's own killGuard poke) is the shield failing: the AI's fire rule exists so
    // that never happens.
    {
      const H = game.player.holding; const heldNow = H ? H.g : null;
      let anyStandoff = false;
      for (const gd of game.guards) {
        const S = gd.standoff; if (!S) { standoffFar.delete(gd); continue; }
        anyStandoff = true; const name = routeName(gd);
        if (!standoffSeen.has(S)) { standoffSeen.add(S); smells.standoffsEntered = (smells.standoffsEntered ?? 0) + 1; tl(`STANDOFF ${name} on ${routeName(S.pair)} held (side ${S.side > 0 ? '+' : '−'}, ${v3.distXZ(gd.char.pos, S.pair.char.pos).toFixed(1)} m)`); }
        const om = standoffOrbit.get(S) ?? 0; if (S.orbitM > om) { smells.standoffOrbitMetres = f2((smells.standoffOrbitMetres ?? 0) + (S.orbitM - om)); standoffOrbit.set(S, S.orbitM); }
        if (gd.state !== 'alert' || gd.held || gd.script || !gd.char.alive) violate('standoff-bad-holder', name, `${name} carries a standoff record while ${gd.state}${gd.held ? '/held' : ''}${gd.script ? '/scripted' : ''}`);
        if (game.quietUtility) violate('standoff-under-tour', name, `${name} in a standoff with quietUtility up`);
        if (!heldNow) { const acc = (standoffNoHold.get(gd) ?? 0) + 1; standoffNoHold.set(gd, acc); if (acc > 1) violate('standoff-no-hold', name, `${name} in a standoff on ${routeName(S.pair)} but nobody is held (holding ${H ? routeName(H.g) + ':' + H.phase : 'null'}) for ${acc} frames`); }
        else { standoffNoHold.set(gd, 0); if (S.pair !== heldNow) violate('standoff-wrong-pair', name, `${name}'s standoff names ${routeName(S.pair)} but ${routeName(heldNow)} is the man held`); }
        if (heldNow) {
          const d = v3.distXZ(gd.char.pos, game.player.char.pos); const going = (gd.path.length > 0 && gd.pathI < gd.path.length && gd.speed > 0.3) || gd.reactT > 0 || t < gd.dazzledUntil;
          const acc = d > 7.5 && !going ? (standoffFar.get(gd) ?? 0) + DT : 0; standoffFar.set(gd, acc);
          if (acc > 3) { standoffFar.set(gd, -30); violate('standoff-far', name, `${name} in the standoff ${d.toFixed(1)} m from the pair and going nowhere for 3 s (goal ${p2(S.orbitGoal)}, cornered ${S.cornered}, rest ${f2(S.restT)}, path ${gd.pathI}/${gd.path.length}, speed ${f2(gd.speed)}) at ${p2(gd.char.pos)}, pair at ${p2(game.player.char.pos)}`); }
          if (d < 2.6 && gd.reactT <= 0 && !(S.backing && gd.speed > 0.8)) {   // well inside the ring for two seconds running and not backing off at pace: fine if the walls (and Sam driving the pair at him) leave him nowhere a stride or two off that gains a metre — else he is just standing there
            const acc2 = (standoffNear.get(gd) ?? 0) + DT; standoffNear.set(gd, acc2);
            if (acc2 > 2) {
              standoffNear.set(gd, -30);
              let room: Vec3 | null = null; const gp = gd.char.pos;
              for (let i = 0; i < 16 && !room; i++) for (const s of [2.0, 1.2]) { const a = i * Math.PI / 8; const q: Vec3 = [gp[0] + Math.sin(a) * s, 0, gp[2] + Math.cos(a) * s]; if (!nav.isBlocked(q[0], q[2]) && nav.walkable(gp, q) && !col.segmentBlocked([gp[0], 0.5, gp[2]], [q[0], 0.5, q[2]]) && v3.distXZ(q, game.player.char.pos) > d + 0.8) { room = q; break; } }
              if (room) violate('standoff-on-top', name, `${name} in the standoff only ${d.toFixed(2)} m from Sam for 2 s with open floor to back onto at ${p2(room)} (goal ${p2(S.orbitGoal)}, backing ${S.backing}, speed ${f2(gd.speed)}, path ${gd.pathI}/${gd.path.length}) at ${p2(gp)}, Sam at ${p2(game.player.char.pos)}`);
              else { smells.standoffBoxedIn = (smells.standoffBoxedIn ?? 0) + 1; tl(`SMELL standoff boxed in: ${name} ${d.toFixed(2)} m from Sam with nowhere to back off to at ${p2(gp)}`); }
            }
          } else standoffNear.set(gd, 0);
        }
      }
      if (anyStandoff) smells.standoffSeconds2 = f2((smells.standoffSeconds2 ?? 0) + DT);
      for (const gd of game.guards) if (gd.state === 'dead' && gd.downBy === 'guard' && gd.downKind === 'shot' && heldLastFrame.has(gd) && !stimKilled.has(gd)) violate('hostage-shot', routeName(gd), `${routeName(gd)} was shot dead by a colleague's round while held in Sam's arm (the fire rule failed) at ${p2(gd.char.pos)}; shooters about: ${game.guards.filter((x: any) => x !== gd && x.state !== 'dead').map((x: any) => `${routeName(x)} ${x.standoff ? 'standoff' : x.state} @${p2(x.char.pos)}`).join(', ')}`);
      heldLastFrame = new Set(game.guards.filter((x: any) => x.held));
    }
    for (const gd of game.guards) if (gd.state !== 'dead' && gd.muzzleDown) { smells.muzzleDownSeconds = f2((smells.muzzleDownSeconds ?? 0) + DT); if (gd.char.anim.stance !== 'lowReady' && !gd.char.anim.kicking) violate('muzzle-down-not-lowered', routeName(gd), `${routeName(gd)} muzzleDown but posed ${gd.char.anim.stance}/${gd.char.anim.upper} (${gd.script ? 'scripted' : gd.state})`); }
    // the search that reads the light (guards.ts searchPlanFor / searchProbes): its queries stay inside the frame's budget, a plan only ever hangs off a searching man,
    // every spot it deals stands on walkable floor, its cursor points at a real spot in the walking / looking phases; threshold discipline (guards.ts pieDoorway):
    // a pie only ever on a free hunting man — never under the tour flag, never pinned or scripted, never in patrol / suspicion
    if (game.searchProbeN > 8) violate('search-probe-budget', String(game.searchProbeN), `${game.searchProbeN} searchers' light queries queued this frame (budget 8)`);
    smells.searchProbeMax = Math.max(smells.searchProbeMax ?? 0, game.searchProbeN);
    for (const gd of game.guards) {
      const name = routeName(gd), P = gd.searchPlan;
      if (P) {
        if (gd.state !== 'search' || gd.script) violate('search-plan-leak', name, `${name} carries a search plan in state ${gd.state}${gd.script ? ' (scripted)' : ''}`);
        if (!['sweep', 'walk', 'look', 'done'].includes(P.phase)) violate('search-plan-phase', name, `phase ${P.phase}`);
        if ((P.phase === 'walk' || P.phase === 'look') && !(P.current >= 0 && P.current < P.spots.length)) violate('search-plan-cursor', name, `${name} in phase ${P.phase} with current ${P.current} of ${P.spots.length}`);
        if (P.spots.length > 16) violate('search-plan-size', name, `${P.spots.length} spots dealt (≤ 16)`);
        for (const s of P.spots) { if (nav.isBlocked(s.pos[0], s.pos[2])) { violate('search-spot-blocked', `${name}:${s.pos[0]},${s.pos[2]}`, `${name}'s ${s.kind} spot at (${s.pos[0]}, ${s.pos[2]}) is not on walkable floor`); break; } if (!(s.dark >= 0 && s.dark <= 1 && s.cover >= 0 && s.cover <= 1 && s.plaus >= 0 && s.plaus <= 1 && Number.isFinite(s.score))) { violate('search-spot-range', name, `spot ${JSON.stringify({ ...s, samples: s.samples.length })}`); break; } }
        if (planSeen.get(gd) !== P) { planSeen.set(gd, P); smells.searchPlans = (smells.searchPlans ?? 0) + 1; smells.searchSpotsDealt = (smells.searchSpotsDealt ?? 0) + P.spots.length; }
        const vis = P.visits; const pv = planVisits.get(P) ?? 0; if (vis > pv) { smells.searchSpotsLooked = (smells.searchSpotsLooked ?? 0) + (vis - pv); planVisits.set(P, vis); }
      }
      if (gd.pieing) {
        if (game.quietUtility) violate('pie-under-tour', name, `${name} pieing the ${gd.pieing.door.def.name} door with quietUtility up`);
        if (gd.pinned || gd.script || gd.state === 'dead') violate('pie-not-free', name, `${name} pieing the ${gd.pieing.door.def.name} door while ${gd.pinned ? 'pinned' : gd.script ? 'scripted' : gd.state}`);
        if (gd.state !== 'alert' && gd.state !== 'search') violate('pie-state', name, `${name} pieing the ${gd.pieing.door.def.name} door in state ${gd.state}`);
        if (!['approach', 'slice', 'cross'].includes(gd.pieing.phase)) violate('pie-phase', name, `phase ${gd.pieing.phase}`);
        if (pieSeen.get(gd) !== gd.pieing) { pieSeen.set(gd, gd.pieing); smells.piesBegun = (smells.piesBegun ?? 0) + 1; }
        if (gd.pieing.phase === 'cross' && !pieCrossed.has(gd.pieing)) { pieCrossed.add(gd.pieing); smells.piesCrossed = (smells.piesCrossed ?? 0) + 1; smells[`pies:${gd.pieing.door.def.name}`] = (smells[`pies:${gd.pieing.door.def.name}`] ?? 0) + 1; }
      }
    }
    for (const gd of game.guards) if (gd.state !== 'dead' && gd.task?.kind === 'checkOn') { smells.checkOnSeconds = f2((smells.checkOnSeconds ?? 0) + DT); const M = gd.task.who; if (!M || !game.guards.includes(M)) violate('checkon-orphan', routeName(gd), `${routeName(gd)} walks the route of a man not in the guard list`); else if (gd.state === 'suspicious' && game.aiEnabled && (M.state !== 'dead' || M.found)) { const acc = (checkOnStale.get(gd) ?? 0) + DT; checkOnStale.set(gd, acc); if (acc > 0.1) violate('checkon-stale', routeName(gd), `${routeName(gd)} still on checkOn for ${routeName(M)} who is ${M.state}${M.found ? ' (found)' : ''} for ${acc.toFixed(2)} s`); } else checkOnStale.set(gd, 0); }
    // NaN / range
    if (!finiteChar(game.player.char)) violate('nan', 'player', `player pos/yaw not finite: ${game.player.char.pos} yaw ${game.player.char.bodyYaw} aim ${game.player.char.aimYaw}/${game.player.char.aimPitch}`);
    for (const b of ['hips', 'head', 'handR']) { const q = game.player.char.bones[b]; if (q && !(Number.isFinite(q[0]) && Number.isFinite(q[1]) && Number.isFinite(q[2]))) { violate('nan', `player-bone-${b}`, `player bone ${b} = ${q}`); break; } }
    const pp = game.player.char.pos; if (pp[0] < -0.5 || pp[0] > 40.5 || pp[2] < -0.5 || pp[2] > 28.5) violate('out-of-world', 'player', `player at ${p2(pp)}`);
    if (!game.player.down && (pp[0] < 0.42 - 1e-3 || pp[0] > 39.58 + 1e-3 || pp[2] < 0.42 - 1e-3 || pp[2] > 27.58 + 1e-3)) violate('off-the-slab', 'player', `player's circle over the world edge at (${pp[0].toFixed(3)}, ${pp[2].toFixed(3)}) (picking ${!!game.player.picking} kick ${!!game.player.kick} takedown ${!!game.player.takedown} sprint ${game.player.sprinting})`);   // player.ts collidePlayer clamps a live player's 0.42 m circle onto the 40 × 28 slab every frame
    game.guards.forEach((gd: any, i: number) => {
      const c = gd.char; const name = routeName(gd);
      if (!finiteChar(c) || !Number.isFinite(gd.speed) || !Number.isFinite(gd.awareness)) violate('nan', `guard-${name}`, `guard ${name} pos ${c.pos} yaw ${c.bodyYaw} aim ${c.aimYaw}/${c.aimPitch} speed ${gd.speed} aw ${gd.awareness}`);
      const hb = c.bones.hips; if (hb && !(Number.isFinite(hb[0]) && Number.isFinite(hb[1]) && Number.isFinite(hb[2]))) violate('nan', `guard-bones-${name}`, `guard ${name} hips bone ${hb} (state ${gd.state})`);
      if (c.pos[0] < -0.5 || c.pos[0] > 40.5 || c.pos[2] < -0.5 || c.pos[2] > 28.5) violate('out-of-world', `guard-${name}`, `guard ${name} at ${p2(c.pos)} (${gd.state})`);
      if (!['patrol', 'suspicious', 'alert', 'search', 'dead'].includes(gd.state)) violate('bad-state', name, `state ${gd.state}`);
      if (gd.awareness < -1e-6 || gd.awareness > 1 + 1e-6) violate('awareness-range', name, `awareness ${gd.awareness}`);
      if (Math.abs(gd.speed) > 6) violate('speed-range', name, `speed ${gd.speed}`);
      // ---- pursuit tactics (game/tactics.ts): a role only ever on a living free man; an alert man with a fix never rooted 12 s without a role that has him
      //      hold (presser / flanker at his corner, second behind him, the lone man's angle, a doorway drill); nobody walks through a doorway that is a live kill
      //      zone for his side without having taken it as a drill (the smell that must stay 0: 'walk-in over a body at a dangerous door')
      {
        const role = tacticsRoleOf(game, gd);
        if (role && (gd.state === 'dead' || gd.held)) violate('tactics-role-on-unfit', name, `${name} carries tactics role ${role} while ${gd.state}${gd.held ? '/held' : ''}`);
        if (role) smells[`tacticsRoleSeconds:${role}`] = f2(((smells[`tacticsRoleSeconds:${role}`] as number) ?? 0) + DT);
        const freeToMove = gd.state === 'alert' && !!gd.lastKnown && !gd.script && !gd.pinned && !gd.hold && !gd.held && gd.reactT <= 0 && !(t < gd.dazzledUntil) && !(t < (gd.staggerUntil ?? -1)) && game.aiEnabled && !game.player.down && !gd.standoff && t - gd.lastSeenT > 0.6 && !(gd.sup && (gd.sup.latched || gd.sup.downT > 0 || t < gd.sup.coverUntil)) && gd.reloadT < 0;
        let as = alertStill.get(gd);
        if (!freeToMove || role || !as) { as = { t: 0, p0: v3.copy(c.pos), lastReport: as?.lastReport ?? -100 }; alertStill.set(gd, as); }
        else if (v3.distXZ(c.pos, as.p0) > 0.3) { as.t = 0; as.p0 = v3.copy(c.pos); }
        else if ((as.t += DT) > 12 && t - as.lastReport > 30) { as.lastReport = t; violate('alert-frozen-with-fix', name, `${name} alert with a fix ${p2(gd.lastKnown)} (${v3.distXZ(c.pos, gd.lastKnown).toFixed(1)} m off), free to move and holding no role, has covered under 0.3 m in ${as.t.toFixed(0)} s at ${p2(c.pos)} — path ${gd.pathI}/${gd.path.length}, speed ${f2(gd.speed)}, muzzleDown ${gd.muzzleDown}, ${game.tacticsSummary?.() || 'no tactics up'}`); }
        if (tacMod && gd.state !== 'dead') {
          let sides = doorSidePrev.get(gd); if (!sides) { sides = new Map(); doorSidePrev.set(gd, sides); }
          for (const d of doors.list) {
            const hx = d.def.hinge[0], hz = d.def.hinge[1], ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir);
            const a = (c.pos[0] - hx) * ux + (c.pos[2] - hz) * uz, b = (c.pos[0] - hx) * -uz + (c.pos[2] - hz) * ux;
            const side = b >= 0 ? 1 : -1; const prev = sides.get(d); sides.set(d, side);
            if (prev === undefined || prev === side || teleportedThisFrame || a < -0.1 || a > d.def.width + 0.1 || Math.abs(b) > 1.0) continue;   // crossed its frame line inside the opening this frame
            const rec = tacMod.dangerAt(game, d, gd.team); if (!rec) continue;
            smells.dangerDoorCrossings = ((smells.dangerDoorCrossings as number) ?? 0) + 1;
            const G = tacMod.gateRecord(game, gd); const drilled = (G && G.door === d) || tacMod.tacticsCleared?.(game, gd, d) || !!gd.script;   // (the drill's own cross, a man who has taken it already, the clearing pair's choreography)
            if (!drilled) { smells.walkInAtDangerDoor = ((smells.walkInAtDangerDoor as number) ?? 0) + 1; tl(`SMELL walk-in at a dangerous door: ${name} (${gd.state}, speed ${f2(gd.speed)}) through the ${d.def.name} doorway, a kill zone for ${gd.team} (${rec.why}${rec.victim ? ' ' + rec.victim : ''}, ${(rec.until - t).toFixed(0)} s left) — role ${tacticsRoleOf(game, gd) ?? 'none'}`); }
          }
        }
      }
      if (gd.script && gd.state === 'dead') violate('dead-scripted', name, `guard ${name} is dead but still carries a script (goal ${p2(gd.script.goal)}, stance ${gd.script.stance}); clearing=${game.clearingSummary() || 'none'}`);
      if ((gd.state === 'dead' && !gd.wound) !== !c.alive) violate('alive-mismatch', name, `state ${gd.state} alive ${c.alive}`);
      // WOUNDS (wounds.ts): a man down wounded is exactly that — down ('dead' to the floor), breathing, posed (never a ragdoll), nothing in his hands, nothing ordering him about;
      // and nobody carries the kind without the record or the record with the switch never having been on
      if (gd.wound) {
        if (gd.state !== 'dead' || gd.downKind !== 'wounded' || c.ragdoll || !c.alive || !c.anim.wound) violate('wounded-bad-state', name, `${name} wounded but state ${gd.state} downKind ${gd.downKind} ragdoll ${!!c.ragdoll} alive ${c.alive} pose ${!!c.anim.wound}`);
        if (gd.script || gd.held || gd.speed !== 0 || game.time < gd.staggerUntil) violate('wounded-busy', name, `${name} wounded but script ${!!gd.script} held ${!!gd.held} speed ${gd.speed}`);
        if (WOUNDS_ARG !== 'on') violate('wounded-switch-off', name, `${name} went down wounded with the switch off`);
      } else if (gd.downKind === 'wounded' || c.anim.wound) violate('wounded-no-record', name, `${name} downKind ${gd.downKind} / a wound pose without the record`);
      if (gd.state !== 'dead' && gd.leader && (gd.leader === gd || (gd.leader.state === 'dead' && (gd.leader.found || game.alarm.episode)) || !game.guards.includes(gd.leader)))   /* a leader nobody knows is dead keeps the role by design (superviseLockdown) */ { leaderBad++; if (leaderBad >= 2) violate('bad-leader', name, `follower ${name}'s leader is ${gd.leader === gd ? 'himself' : gd.leader.state === 'dead' ? 'dead' : 'not in the guard list'} for ${leaderBad} frames (esc ${game.escalation}, quiet ${game.quietUtility})`); }
      if (gd.held && (gd.leader || gd.post) && game.escalation >= 2 && !game.quietUtility) { heldRole++; if (heldRole >= 2) violate('held-role', name, `${name} is in Sam's arm yet still ${gd.leader ? `paired to ${routeName(gd.leader)}${gd.leader.state === 'dead' ? ' (dead)' : ''}` : `holding the ${gd.post.name}`} for ${heldRole} frames — a held man holds no lockdown role (guards.ts superviseLockdown)`); }   // (one frame's grace: a grab dealt by direct call lands after the frame's superviseLockdown)
      if (gd.state === 'dead' && (gd.leader || gd.post)) smells.staleDutyOnCorpse = (smells.staleDutyOnCorpse ?? 0) + DT;   // harmless (everything skips the dead) but note it
      if (gd.post && gd.leader) violate('post-and-leader', name, `both a post (${gd.post.name}) and a leader`);
      // KO vs dead (combat.ts killGuard's side record): every downed man says how and by whom, no living man does; the witness record (game.ts Witness) only ever
      // names a man who IS down — as the kind he went down by — and a found / called-in body is remembered breathing exactly when he is (isBreathing)
      if (gd.state === 'dead' && (!gd.downKind || !gd.downBy)) violate('down-kind-missing', name, `${name} is down but downKind ${gd.downKind} / downBy ${gd.downBy}`);
      if (gd.state !== 'dead' && (gd.downKind || gd.downBy)) violate('down-kind-on-living', name, `${name} is ${gd.state} but carries downKind ${gd.downKind} / downBy ${gd.downBy}`);
      {
        const Wt = gd.witness;
        if (!Wt || !Wt.heard) violate('witness-missing', name, `${name} has no witness record`);
        else {
          const byCall = (cs: string) => game.guards.find((x: any) => x.callsign === cs) ?? (game.civilians ?? []).find((x: any) => x.callsign === cs);   // (a body found may be a civilian's: civilians.ts foundDown writes the same records)
          // the knife (player.ts startTakedown's lethal blow and killOut, the knife from the hold): he is dead — downKind 'shot', the model's word for it — and both rewrite a
          // watcher's 'shot' to 'struck' (he saw a man DROPPED: no noise, no gun). Allowed for exactly that man: the one whose 'kill' row on the chronicle says the knife
          // (chronicle.ts chronDown) — struck-for-shot of a man who took a round is still the smell
          const knifed = (v: any) => !!game.chronicle?.events.some((e: any) => e.kind === 'kill' && e.data?.who === v.callsign && e.data?.weapon === 'knife');
          if (Wt.sawAct) { const v = byCall(Wt.sawAct.victim); if (!v || v.state !== 'dead') violate('witness-sawact-not-down', name, `${name} remembers Sam ${Wt.sawAct.kind} ${Wt.sawAct.victim}, who is ${v ? v.state : 'not on the roster'}`); else if (v.downKind !== Wt.sawAct.kind && !(v.downKind === 'wounded' && Wt.sawAct.kind === 'shot') && !(v.downKind === 'shot' && Wt.sawAct.kind === 'struck' && knifed(v))) violate('witness-sawact-kind', name, `${name} remembers ${Wt.sawAct.victim} ${Wt.sawAct.kind} but he went down ${v.downKind}`); if (v === gd) violate('witness-sawact-self', name, `${name} remembers his own end`); if (Wt.sawAct.t > t + 1e-6) violate('witness-time', name, `sawAct in the future (${Wt.sawAct.t} > ${t})`); }
          for (const k of ['sawBody', 'calledToBody'] as const) { const r = Wt[k]; if (!r) continue; const v = byCall(r.victim); if (!v || v.state !== 'dead' || !v.found) violate(`witness-${k}-bad`, name, `${name}'s ${k} names ${r.victim}: ${v ? `${v.state} found=${v.found}` : 'not on the roster'}`); else if (r.breathing !== isBreathing(v)) violate(`witness-${k}-breathing`, name, `${name}'s ${k} says ${r.victim} breathing=${r.breathing} but isBreathing=${isBreathing(v)} (${v.downKind})`); }
          const H = Wt.heard; if (H.shots < 0 || H.kick < 0 || H.bang < 0 || H.small < 0 || Wt.dazzled < 0 || Wt.wasHeld < 0 || !(Wt.peakAwareness >= 0 && Wt.peakAwareness <= 1 + 1e-6)) violate('witness-range', name, `${name}: ${JSON.stringify({ ...Wt, heard: H })}`);
          if (Wt.alertedBy && !['sight', 'sound', 'radio', 'body', 'held'].includes(Wt.alertedBy)) violate('witness-alertedby', name, `alertedBy ${Wt.alertedBy}`);
          if (Wt.sawHeld && (!byCall(Wt.sawHeld.who) || Wt.sawHeld.t > t + 1e-6 || byCall(Wt.sawHeld.who) === gd)) violate('witness-sawheld-bad', name, `${name}: sawHeld ${JSON.stringify(Wt.sawHeld)} — not a colleague on the roster, or in the future`);
          if (Wt.sawHeld && !sawHeldSeen.has(Wt.sawHeld)) { sawHeldSeen.add(Wt.sawHeld); smells.witnessSawHeld = (smells.witnessSawHeld ?? 0) + 1; }
          if (Wt.wasHeld > (heldCount.get(gd) ?? 0)) violate('witness-washeld-uncounted', name, `${name}: wasHeld ${Wt.wasHeld} but the harness saw him grabbed ${heldCount.get(gd) ?? 0}×`);
          if (Wt.sawAct && sawActSeen.get(gd) !== Wt.sawAct) { sawActSeen.set(gd, Wt.sawAct); smells.witnessSawAct = (smells.witnessSawAct ?? 0) + 1; smells[`witnessSaw:${Wt.sawAct.kind}`] = (smells[`witnessSaw:${Wt.sawAct.kind}`] ?? 0) + 1; }
          // nothing is remembered with the AI off: the record as it stood just before a step taken with aiEnabled=false must come out of it unchanged (snapshots per Guard
          // object taken right before the step, so a stimulus that wrote legitimately while the AI was still on, or fresh men after a reset, cannot false-alarm)
          if (steppedAiOff) { const pre = witnessSnap.get(gd); const now = JSON.stringify(Wt); if (pre !== undefined && pre !== now) violate('witness-under-ai-off', name, `${name}'s witness record changed in a frame stepped with the AI off: ${pre} → ${now}`); }
        }
      }
      // the interrogation's progress (game.ts Talk): present on every man, its stage only ever forward for the same Guard object, presses ≥ stage, heldSince never in the future
      {
        const Tk = gd.talk;
        if (!Tk || !(Tk.said instanceof Set)) violate('talk-missing', name, `${name} has no talk record`);
        else {
          const prevS = talkStage.get(gd); if (prevS !== undefined && Tk.stage < prevS) violate('talk-stage-back', name, `${name}'s interrogation stage went ${prevS} → ${Tk.stage}`); talkStage.set(gd, Tk.stage);
          if (Tk.presses < Tk.stage || Tk.stage < 0 || Tk.heldSince > t + 1e-6 || Tk.lastT > t + 1e-6) violate('talk-range', name, `${name}: stage ${Tk.stage} presses ${Tk.presses} heldSince ${Tk.heldSince} lastT ${Tk.lastT} at t ${t.toFixed(2)}`);
        }
      }
      // the found-body script: a living man's duty must point at a corpse still on the floor, and only a suspicious (or about-to-be: patrol with the news, scripted about to break off) man carries one
      if (gd.state !== 'dead' && gd.bodyDuty) {
        const B = gd.bodyDuty.body;
        if (!B || B.state !== 'dead' || !game.guards.includes(B)) violate('bad-body-duty', name, `${name}'s body duty points at ${B ? routeName(B) + ' (' + B.state + (game.guards.includes(B) ? '' : ', not in the guard list') + ')' : 'nothing'}`);
        if (gd.state === 'alert' || gd.state === 'search' && !gd.script) { const acc = (dutyBad.get(gd) ?? 0) + DT; dutyBad.set(gd, acc); if (acc > 0.5) violate('body-duty-state', name, `${name} carries a body duty (${gd.bodyDuty.role}:${gd.bodyDuty.stage}) in state ${gd.state} for ${acc.toFixed(1)} s`); } else dutyBad.set(gd, 0);
        if (game.time - gd.bodyDuty.t0 > 60) violate('body-duty-stale', name, `${name}'s body duty is ${(game.time - gd.bodyDuty.t0).toFixed(0)} s old (${gd.bodyDuty.role}:${gd.bodyDuty.stage}, state ${gd.state})`);
      }
      // lingering on a found body: a calm-ish living man planted within 1.2 m of a called-in corpse for 8 s running reads as milling on it (smell, not a violation: a drill mark may sit by a
      // body, and the finder covering him from arm's length because the walls left no better spot is doing his job)
      if (gd.state !== 'dead' && gd.state !== 'alert' && !game.player.down && !(gd.bodyDuty?.role === 'finder' && gd.bodyDuty.stage === 'cover')) {
        const B = nearKnownBody(game, c.pos, 1.2); const acc = B ? (lingerT.get(gd) ?? 0) + DT : 0; lingerT.set(gd, acc);
        if (acc > 8 && t - (lingerRep.get(gd) ?? -100) > 30) { lingerRep.set(gd, t); smells.lingerOnBody = (smells.lingerOnBody ?? 0) + 1; if (smells.lingerOnBody <= 6) tl(`SMELL linger-on-body ${name}: ${acc.toFixed(0)} s within 1.2 m of ${routeName(B)}'s body (${gd.script ? 'scripted ' + (game.clearingSummary() || '') : gd.state}${gd.bodyDuty ? ' duty ' + gd.bodyDuty.role + ':' + gd.bodyDuty.stage : ''})`); }
      }
      // planted at a doorway: alert, free to move (not pinned / reacting / dazzled / scripted), covering < 0.25 m/s within 1.5 m of a doorway's middle for 6 s running,
      // and in all that time not one round of anybody's reaching Sam — the playtest's man rooted at the door with his muzzle through the frame (a jamb or the leaf in
      // his line of fire but not his line of sight, or a fix on the threshold he would neither walk through nor give up). Firing and hitting (god mode keeps Sam
      // up) is a fight, not a plant; a man whose target is down is covering a body; and one holding fire because the colleague in Sam's arm stands in his line
      // (guards.ts muzzleCheck counts the held man — the human shield's standoff, which the AI does not yet play out: docs/internal/grab-interrogate-design.md
      // §2.2, slice 3) is standing on purpose, like a pinned man.
      if (gd.state === 'alert' && !gd.script && !gd.pinned && gd.reactT <= 0 && !(t < gd.dazzledUntil) && !game.player.down && game.aiEnabled && gd.speed < 0.25) {
        const dp = doorPlant.get(gd) ?? { t: 0, lastReport: -100 };
        const nearDoor = doors.list.find((d: any) => v3.distXZ(c.pos, d.frameCentre) < 1.5);
        const Hh = game.player.holding; const shield = !!gd.standoff || (!!Hh && gd.muzzleDown && v3.distXZ(Hh.g.char.pos, game.player.char.pos) < 0.8) || (!!Hh && game.tune.muzzleDiscipline && Hh.g.state !== 'dead' && t - gd.lastSeenT < 0.5);   // (in the standoff round the pair — its own invariants watch that — or his gun down for the man in the arm, or holding his round on a pair he is actually covering while the man is up: muzzle discipline)
        if (shield) smells.standoffSeconds = f2((smells.standoffSeconds ?? 0) + DT);
        const tacRole = tacticsRoleOf(game, gd);   // (a man kneeling at a jamb corner as presser / flanker / lone, or stacked on a kill-zone doorway, stands there on purpose — the tactics' own clocks end it; counted as a smell by role instead)
        if (nearDoor && tacRole) smells[`plantedAtDoorOnRole:${tacRole}`] = f2(((smells[`plantedAtDoorOnRole:${tacRole}`] as number) ?? 0) + DT);
        dp.t = nearDoor && !shield && !tacRole && t - lastPlayerHitT > 0.5 ? dp.t + DT : 0; doorPlant.set(gd, dp);
        if (dp.t > 6 && t - dp.lastReport > 30) { dp.lastReport = t; violate('alert-planted-at-door', `${name}:${nearDoor.def.name}`, `guard ${name} alert and rooted ${v3.distXZ(c.pos, nearDoor.frameCentre).toFixed(2)} m from the ${nearDoor.def.name} doorway (leaf ${nearDoor.angle.toFixed(2)}${nearDoor.latched ? 'L' : ''}${nearDoor.locked ? 'k' : ''}) for ${dp.t.toFixed(1)} s with nothing reaching Sam — Sam ${v3.distXZ(c.pos, game.player.char.pos).toFixed(1)} m off at ${p2(game.player.char.pos)} vis ${game.player.visibility.toFixed(2)}, seen this frame ${gd.sawPlayerThisFrame}, last seen ${(t - gd.lastSeenT).toFixed(1)} s ago, fix ${p2(gd.lastKnown)}, path ${gd.pathI}/${gd.path.length}, shotBlockedT ${(gd.shotBlockedT ?? 0).toFixed(1)}, stallT ${gd.alertStallT.toFixed(1)}`); }
      } else doorPlant.delete(gd);
      // stuck: wanted to move (speed > 0.3) essentially the whole 4 s window while scripted / pathing, and ended it within a hand's breadth of where it began (the
      // report carries his biggest excursion and the ground he covered in the window: ~0 / ~0 is a wedge, metres of either is a man sent out and straight back)
      if (gd.state !== 'dead') {
        const pathing = (gd.path.length > 0 && gd.pathI < gd.path.length) || (gd.script && gd.script.goal && !gd.script.arrived);
        let s = stuck.get(gd); if (!s) { s = { t0: t, p0: v3.copy(c.pos), last: v3.copy(c.pos), ground: 0, reach: 0, want: 0, lastReport: -100 }; stuck.set(gd, s); }
        if (gd.speed > 0.3 && pathing) s.want += DT;
        s.ground += v3.distXZ(c.pos, s.last); s.last = v3.copy(c.pos); s.reach = Math.max(s.reach, v3.distXZ(c.pos, s.p0));
        if (t - s.t0 >= 4) {
          const moved = v3.distXZ(c.pos, s.p0);   // net: where the window ends against where it began (a wedged man see-sawing on followPath's sidestep still ends about where he started; the excursion and the ground he covered go in the report to tell that from an out-and-back errand)
          if (s.want >= 3.8 && moved < 0.05 && s.reach >= 1.0 && t - s.lastReport > 20) { s.lastReport = t; smells.outAndBack = (smells.outAndBack ?? 0) + 1; }   // sent out ≥ 1 m and straight back inside 4 s: an errand / re-plan, not a wedge (a see-sawing wedged man never gets a metre away) — counted, not a violation
          else if (s.want >= 3.8 && moved < 0.05 && t - s.lastReport > 20) {
            s.lastReport = t;
            const nearDoors = doors.list.filter((d: any) => Math.hypot(d.def.hinge[0] - c.pos[0], d.def.hinge[1] - c.pos[2]) < d.def.width + 0.8).map((d: any) => `${d.def.name}@${d.angle.toFixed(2)}${Math.abs(d.angle - d.maxA) < 0.02 || Math.abs(d.angle - d.minA) < 0.02 ? '(AT STOP)' : ''}${d.latched ? 'L' : ''}`).join(',') || 'none';
            const q = v3.copy(c.pos); const inStatic = col.collideCircle(q, c.radius, 0.2, 1.5, 1) ? v3.distXZ(q, c.pos).toFixed(2) : '0';
            const nearProps = game.props.props.filter((p: any) => Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < Math.max(p.def.half[0], p.def.half[1]) + 0.75).map((p: any) => `${p.def.name}(${p.def.kind} ${p.def.mass}kg)@${p.x.toFixed(2)},${p.z.toFixed(2)}${Math.hypot(p.x - p.home[0], p.z - p.home[1]) > 0.05 ? ' moved ' + Math.hypot(p.x - p.home[0], p.z - p.home[1]).toFixed(2) + 'm' : ''}`).join(',') || 'none';
            violate('stuck', `${name}:${gd.script ? 'script' : gd.state}`, `guard ${name} ordered at ${gd.speed.toFixed(2)} m/s for ${s.want.toFixed(1)} of 4 s but ended it ${moved.toFixed(3)} m from where it began (excursion ${s.reach.toFixed(2)} m, ground covered ${s.ground.toFixed(2)} m) at ${p2(c.pos)} — ${gd.script ? `scripted goal ${p2(gd.script.goal)} stance ${gd.script.stance} (${game.clearingSummary() || 'no clearing'})` : `${gd.state} path ${gd.pathI}/${gd.path.length} next wp ${p2(gd.path[gd.pathI])} → ${p2(gd.pathGoal)}`} stuckT ${gd.stuckT.toFixed(2)}; doors in reach: ${nearDoors}; props in reach: ${nearProps}; static overlap ${inStatic} m; nav cell blocked: ${nav.isBlocked(c.pos[0], c.pos[2])}; path to goal exists: ${gd.pathGoal ? !!nav.findPath(c.pos, gd.pathGoal) : 'n/a'}`);
          }
          s.t0 = t; s.p0 = v3.copy(c.pos); s.want = 0; s.ground = 0; s.reach = 0;
        }
        // blocked-cell-stuck: the seed-6 stranding, caught where it starts instead of by whichever branch happens to grind visibly later — a living man, AI on,
        // out of the arm and nobody's mark (not the scripted hold, not pinned, not dazzled / doubled over, not the alert man covering or the suspicious one
        // taking a noise in: those stand where they stand on purpose), with somewhere to be (a path leg ahead of him, a script mark still a stride off, or a plan's
        // goal more than a stride off), standing on a nav-BLOCKED cell and not shifting a hand's breadth off it — for 1.5 s if the cell is STRANDED (all four
        // neighbours shut too: no plan can ever leave it, nothing but the un-stick gets him off, and that should have inside a second), for 5 s if it is merely
        // blocked (a plan from there works; a man wedged on a leaf or inching through a doorway's slice is the game's own 3–4 s watchdogs' to free, and only
        // their failure is news). Before the un-stick a hold ended by a teleport could leave him stranded and every state read its empty plans as 'arrived'
        // for the rest of the run; guards.ts now side-steps him to the nearest free cell the moment a plan comes back empty from one.
        {
          const hasGoal = gd.script ? !!gd.script.goal && !gd.script.arrived && v3.distXZ(c.pos, gd.script.goal) > 0.7 : (gd.path.length > 0 && gd.pathI < gd.path.length) || (gd.pathGoal && v3.distXZ(c.pos, gd.pathGoal) > 0.75);   // (a scripted man inside the runner's settle reach of his mark is the runner's to ease on by hand, no plan involved — kept off it by a colleague standing on it he waits and retries by design (squad.ts settleWatch); and planted ON it he keeps the nav leg he never needed at 0/1: either way his 'somewhere to be' is a mark still a stride off)
          const onPurpose = gd.hold || gd.pinned || t < gd.dazzledUntil || t < (gd.staggerUntil ?? -1) || (gd.state === 'suspicious' && gd.reactT > 0) || (gd.state === 'alert' && (gd.reactT > 0 || game.player.down || t - gd.lastSeenT < 0.6 || !!gd.standoff));
          const counts = game.aiEnabled && !gd.held && !onPurpose && hasGoal && nav.isBlocked(c.pos[0], c.pos[2]);
          let cs = cellStuck.get(gd);
          if (!counts || !cs || v3.distXZ(c.pos, cs.p0) > 0.15) { cs = { t: 0, p0: v3.copy(c.pos), lastReport: cs?.lastReport ?? -100 }; cellStuck.set(gd, cs); }
          if (counts) {
            const stranded = strandedAt ? strandedAt(game, c.pos[0], c.pos[2]) : nav.isBlocked(c.pos[0] + nav.cell, c.pos[2]) && nav.isBlocked(c.pos[0] - nav.cell, c.pos[2]) && nav.isBlocked(c.pos[0], c.pos[2] + nav.cell) && nav.isBlocked(c.pos[0], c.pos[2] - nav.cell);
            if ((cs.t += DT) > (stranded ? 1.5 : 5) && t - cs.lastReport > 20) {
              cs.lastReport = t;
              violate('blocked-cell-stuck', `${name}:${gd.script ? 'script' : gd.state}`, `guard ${name} (${gd.script ? 'scripted' : gd.state}) has stood ${cs.t.toFixed(1)} s on a ${stranded ? 'STRANDED nav cell (blocked, and all four beside it: no plan can leave it)' : 'nav-blocked cell (a neighbour is free: plans work from it)'} at ${p2(c.pos)} with somewhere to be: ${gd.script ? `mark ${p2(gd.script.goal)}` : `path ${gd.pathI}/${gd.path.length} → ${p2(gd.pathGoal)}${gd.pathGoal ? ` (${v3.distXZ(c.pos, gd.pathGoal).toFixed(1)} m off; path from here exists: ${!!nav.findPath(c.pos, gd.pathGoal)})` : ''}`}, speed ${gd.speed.toFixed(2)}, stuckT ${f2(gd.stuckT)}, wait ${f2(gd.wait)}, reactT ${f2(gd.reactT)}, held ×${gd.witness?.wasHeld ?? '?'}; doors in reach: ${doors.list.filter((d: any) => Math.hypot(d.def.hinge[0] - c.pos[0], d.def.hinge[1] - c.pos[2]) < d.def.width + 0.8).map((d: any) => `${d.def.name}@${d.angle.toFixed(2)}`).join(',') || 'none'}; un-stick legs so far ${UNSTICK.legs}, snaps ${UNSTICK.snaps}`);
            }
          }
        }
        // softer: has somewhere to be but < 0.25 m progress in 8 s (dithering / wedged at low speed)
        let q = noprog.get(gd); if (!q) { q = { t0: t, p0: v3.copy(c.pos), lastReport: -100 }; noprog.set(gd, q); }
        const alertHolding = gd.state === 'alert' && (gd.reactT > 0 || gd.pinned || game.player.down || t - gd.lastSeenT < 0.6);   // covering / shooting from where he stands is not 'going somewhere'
        const wantsToGo = pathing && !(gd.state === 'suspicious' && gd.reactT > 0) && !alertHolding && !(t < gd.dazzledUntil) && !gd.hold && !(gd.state === 'patrol' && gd.wait > 0);
        if (!wantsToGo) { q.t0 = t; q.p0 = v3.copy(c.pos); }
        else if (t - q.t0 >= 8) { const moved = v3.distXZ(c.pos, q.p0); if (moved < 0.25 && t - q.lastReport > 30) { q.lastReport = t; smells.noProgress++; if (smells.noProgress <= 10) tl(`SMELL no-progress ${name}: ${moved.toFixed(2)} m in 8 s, ${gd.script ? `scripted → ${p2(gd.script.goal)} arrived=${gd.script.arrived}` : `${gd.state} path ${gd.pathI}/${gd.path.length} → ${p2(gd.pathGoal)}`} at ${p2(c.pos)} speed ${gd.speed.toFixed(2)}`); } q.t0 = t; q.p0 = v3.copy(c.pos); }
      }
      // pair separation
      for (let j = i + 1; j < game.guards.length; j++) {
        const o = game.guards[j]; if (gd.state === 'dead' || o.state === 'dead') continue;
        const key = `${name}|${routeName(o)}`; const d = v3.distXZ(c.pos, o.char.pos);
        if (d < 0.3) { const acc = (closeT.get(key) ?? 0) + DT; closeT.set(key, acc); if (acc > 2 && t - (closeReported.get(key) ?? -100) > 30) { closeReported.set(key, t); violate('guards-overlap', key, `${key} within ${d.toFixed(2)} m for ${acc.toFixed(1)} s at ${p2(c.pos)} (${gd.script ? 'scripted' : gd.state} / ${o.script ? 'scripted' : o.state}; ${game.clearingSummary() || 'no clearing'})`); } }
        else closeT.set(key, 0);
      }
    });
    if (civMod) {   // the civilians (civilians.ts): never armed, never anybody's foe or hostile to anybody, never in Game.guards; state sane (a known one; gone = off the floor for good; a downed one has how / by);
                    // nothing reported without a cause; at most one phone call per civilian per fright; her record's clocks finite; the module's summary callable
      const known = new Set(['work', 'startled', 'alarmed', 'flee', 'report', 'phone', 'cower', 'held', 'evacuate', 'gone']);
      if (!game.tune.civilians && game.civilians.length) violate('civ-off-but-present', 'civ', `${game.civilians.length} civilians with tune.civilians off`);
      for (const cv of game.civilians) {
        const C = cv.civ; if (!C) { violate('civ-no-record', cv.callsign, 'a Game.civilians entry without .civ'); continue; }
        if (game.guards.includes(cv)) violate('civ-in-guards', C.name, `${C.name} is in Game.guards`);
        if (cv.team !== 'civilian') violate('civ-team', C.name, `${C.name} on side ${cv.team}`);
        if (cv.drawn || cv.weapon.roundsReady < cv.weapon.def.magCapacity || cv.flashlight.enabled) violate('civ-armed', C.name, `${C.name} drawn ${cv.drawn} rounds ${cv.weapon.roundsReady}/${cv.weapon.def.magCapacity} light ${cv.flashlight.enabled}`);   // (the phantom sidearm her Guard record carries never leaves the holster it is not drawn from, never fires; her light record never lights)
        for (const gd of game.guards) if (gd.foe === cv || (gd.standoff?.pair === cv && cv.held?.by !== 'player') || gd.bodyDuty?.body === cv || gd.leader === cv) { violate('civ-targeted', C.name, `${gd.callsign} has ${C.name} as ${gd.foe === cv ? 'foe' : gd.standoff?.pair === cv ? 'standoff pair (and she is not in Sam\'s arm)' : gd.bodyDuty?.body === cv ? 'body duty' : 'leader'}`); break; }   // (a civilian in Sam's arm IS a hostage the men ring and talk to — review A6.1 — for exactly as long as she is held: the standoff record on her is right then and only then)
        if (!known.has(C.state)) violate('civ-state', C.name, `${C.name} in state '${C.state}'`);
        if (cv.state !== 'patrol' && cv.state !== 'dead') violate('civ-guardstate', C.name, `${C.name} Guard.state '${cv.state}' (patrol alive / dead down only)`);
        if (cv.state === 'dead' && (!cv.downKind || !cv.downBy)) violate('civ-down-record', C.name, `${C.name} down without how / by`);
        if (C.reported && !C.cause) violate('civ-report-no-cause', C.name, `${C.name} reported with no cause`);
        if ((C.state === 'flee' || C.state === 'report' || C.state === 'phone' || C.state === 'alarmed') && !C.cause) violate('civ-fright-no-cause', C.name, `${C.name} ${C.state} with no cause`);
        { const k = `${C.name}#${C.alarmN}`; const n = civPhoneLog.get(k) ?? 0; if (C.phoned && !civPhonedSeen.has(k)) { civPhonedSeen.add(k); civPhoneLog.set(k, n + 1); if (n + 1 > 1) violate('civ-phone-twice', C.name, `${C.name} rang fright #${C.alarmN} in ${n + 1} times`); } }
        for (const [k, v] of Object.entries({ stateAt: C.stateAt, causeAt: C.causeAt, aw: cv.awareness, vis: C.vis, x: cv.char.pos[0], z: cv.char.pos[2] })) if (!Number.isFinite(v as number)) violate('nan', `civ-${C.name}`, `${C.name} ${k} ${v}`);
        if (cv.held && cv.held.by !== 'player') violate('civ-held-by', C.name, `${C.name} held by ${cv.held.by}`);
        if (C.state === 'gone' && cv.held) violate('civ-gone-held', C.name, `${C.name} gone but held`);
        civStateTime[C.state] = (civStateTime[C.state] ?? 0) + DT;
      }
      if (frame % 300 === 0) { try { game.civiliansSummary(); } catch (e: any) { violate('exception', 'civiliansSummary', `${e?.stack ?? e}`); } }
    }
    if (needsMod) {   // the needs (needs.ts): at most maxAway men on trips of their own (a SENT one is the panel's / the stimulus's, over the cap by design), no trip carried through a frozen floor or by a man
                      // who is not patrolling for more than the frame it takes needsTick to break it off, levels finite, the tells' weights sane; and the smells — phases entered, the log's beats
      let awayFree = 0; const frozen = !game.tune.needs || !game.aiEnabled || game.quietUtility || game.touring || escalationOf(game) > 0 || game.alarm.episode || game.blackout.active || (game.qrf && game.qrf.state !== 'idle') || game.player.down;
      for (const gd of game.guards) {
        const T = needsTrip(gd); const M = needsMod.needsMem(gd);
        if (M) for (const n of M.needs) if (!Number.isFinite(n.level) || n.level < 0 || n.level > 1.6) violate('nan', `needs-${gd.callsign}`, `${gd.callsign} ${n.kind} level ${n.level}`);
        const w = gd.char.anim.tellShown; if (!Number.isFinite(w) || w < -1e-6 || w > 1.001) violate('needs-tell-weight', gd.callsign, `${gd.callsign} tellShown ${w}`);
        if (!T) { needsFrozenT.set(gd, 0); needsOffPatrolT.set(gd, 0); if (needsPhase.get(gd)) { needsPhase.set(gd, ''); } continue; }
        if (!T.forced) awayFree++;
        smells.needsTripSeconds = f2(((smells.needsTripSeconds as number) ?? 0) + DT);
        const ph = `${T.kind}:${T.phase}`; if (needsPhase.get(gd) !== ph) { needsPhase.set(gd, ph); smells[`needs:${T.phase}`] = ((smells[`needs:${T.phase}`] as number) ?? 0) + 1; if (T.phase === 'going') { smells[`needsTrip:${gd.callsign}:${T.kind}`] = ((smells[`needsTrip:${gd.callsign}:${T.kind}`] as number) ?? 0) + 1; } }
        if (frozen) { const acc = (needsFrozenT.get(gd) ?? 0) + DT; needsFrozenT.set(gd, acc); if (acc > 2 * DT + 1e-6) violate('needs-trip-when-frozen', gd.callsign, `${gd.callsign} still on a ${T.kind} trip (${T.phase}) ${acc.toFixed(2)} s into a frozen floor (needs ${game.tune.needs} ai ${game.aiEnabled} quiet ${game.quietUtility} esc ${escalationOf(game)} episode ${game.alarm.episode} blackout ${game.blackout.active} qrf ${game.qrf?.state} down ${game.player.down})`); } else needsFrozenT.set(gd, 0);
        if (gd.state !== 'patrol' || gd.held || gd.script || gd.task || gd.bodyDuty) { const acc = (needsOffPatrolT.get(gd) ?? 0) + DT; needsOffPatrolT.set(gd, acc); if (acc > 2 * DT + 1e-6) violate('needs-trip-not-patrol', gd.callsign, `${gd.callsign} carries a ${T.kind} trip (${T.phase}) while ${gd.state}${gd.held ? ' held' : ''}${gd.script ? ' scripted' : ''}${gd.task ? ' task:' + gd.task.kind : ''}${gd.bodyDuty ? ' bodyDuty' : ''} for ${acc.toFixed(2)} s`); } else needsOffPatrolT.set(gd, 0);
        if (![T.t0, T.departAt, T.outYaw].every(Number.isFinite) || !(T.wp >= 0 && T.wp < gd.route.points.length)) violate('needs-trip-bad', gd.callsign, `${gd.callsign} trip ${JSON.stringify({ kind: T.kind, phase: T.phase, t0: T.t0, departAt: T.departAt, outYaw: T.outYaw, wp: T.wp })}`);
      }
      if (awayFree > Math.max(needsMod.NEEDS.maxAway, 0)) violate('needs-too-many-away', 'needs', `${awayFree} men on trips of their own (maxAway ${needsMod.NEEDS.maxAway}): ${game.needsSummary?.()}`);
      smells.needsAwayPeak = Math.max((smells.needsAwayPeak as number) ?? 0, awayFree);
      const L = needsMod.NEEDS_LOG; if (needsLogI > L.length) needsLogI = Math.max(0, needsLogI - 50);   // (the module trims its log fifty at a time past two hundred)
      for (; needsLogI < L.length; needsLogI++) { const e = L[needsLogI]; if (Math.abs(e.t - t) > 1) continue; if (/schedules|SENT|walks|back on|CANCELLED|no way/.test(e.what)) { const k = /CANCELLED/.test(e.what) ? 'needsCancelLines' : 'needsBeatLines'; smells[k] = ((smells[k] as number) ?? 0) + 1; if (((smells.needsBeatLines as number) ?? 0) + ((smells.needsCancelLines as number) ?? 0) <= 24) tl(`NEEDS ${e.who}: ${e.what}`); } }
    }
    if (tacMod) {   // the tactics' roster against the men: no more roles than living men, every plan's members alive and in the list, no plan under the tour / AI off / the switch off
      const living = game.guards.filter((x: any) => x.state !== 'dead').length; let roles = 0; for (const x of game.guards) if (tacticsRoleOf(game, x)) roles++;
      if (roles > living) violate('tactics-roles-exceed-men', 'tactics', `${roles} roles for ${living} living men: ${game.tacticsSummary?.()}`);
      const plans = tacMod.plansOf(game);
      for (const P of plans) { for (const m of P.members) if (m.state === 'dead' || !game.guards.includes(m)) violate('tactics-plan-member-bad', 'tactics', `plan #${P.id} still lists ${m.callsign} (${game.guards.includes(m) ? m.state : 'not in the guard list'})`); if (![...P.target].every(Number.isFinite)) violate('nan', 'tactics-plan', `plan #${P.id} target ${P.target}`); }
      if (plans.length && (game.quietUtility || !game.aiEnabled || !game.tune.tactics)) violate('tactics-plan-when-off', 'tactics', `${plans.length} plan(s) up with quietUtility ${game.quietUtility} / ai ${game.aiEnabled} / tune.tactics ${game.tune.tactics}`);
      smells.tacticsPlansPeak = Math.max((smells.tacticsPlansPeak as number) ?? 0, plans.length);
    }
    if (!game.guards.some((gd: any) => gd.state !== 'dead' && gd.leader && (gd.leader === gd || gd.leader.state === 'dead'))) leaderBad = 0;
    if (!game.guards.some((gd: any) => gd.held && (gd.leader || gd.post))) heldRole = 0;
    // per-frame displacement: nobody alive moves more than POP in a frame unless the harness teleported them (0.3 m at 60 Hz; a stride plus a leaf's capped shove
    // scale with the frame, so the bar does too at a coarser --hz); through a wall is its own kind
    {
      const POP = Math.max(0.3, 12 * DT + 0.06);
      const plc = game.player.char;
      const prev = lastPos.get('player'); const cur = v3.copy(plc.pos);
      if (prev && !teleportedThisFrame && !game.player.down && game.mission === missionRef) {
        const d = v3.distXZ(prev, cur);
        if (d > POP) { const wall = col.segmentBlocked([prev[0], 0.6, prev[2]], [cur[0], 0.6, cur[2]]) && col.segmentBlocked([prev[0], 1.2, prev[2]], [cur[0], 1.2, cur[2]]); violate(wall ? 'popped-through-wall' : 'popped', 'player', `player jumped ${d.toFixed(2)} m in one frame ${p2(prev)} → ${p2(cur)}${wall ? ' THROUGH static geometry' : ''} (wall ${game.player.wall ? `held u=${game.player.wall.u.toFixed(2)} settle=${game.player.wall.settle.toFixed(2)}` : 'free'}; picking ${!!game.player.picking} kick ${!!game.player.kick} takedown ${!!game.player.takedown}; nearest guard ${Math.min(...living().map((g: any) => v3.distXZ(g.char.pos, cur))).toFixed(2)} m)`); }
        // and however short the move: a STATIC (not a leaf) between where he stood a frame ago and where he stands now, at knee and at hip height, is a wall crossed
        else if (d > 1e-3 && col.segmentBlocked([prev[0], 0.45, prev[2]], [cur[0], 0.45, cur[2]], 0) && col.segmentBlocked([prev[0], 0.9, prev[2]], [cur[0], 0.9, cur[2]], 0) && !col.segmentBlockedDynamic([prev[0], 0.45, prev[2]], [cur[0], 0.45, cur[2]]) && !col.segmentBlockedDynamic([prev[0], 0.9, prev[2]], [cur[0], 0.9, cur[2]])) {
          const nearDoors = doors.list.filter((dd: any) => Math.hypot(dd.def.hinge[0] - cur[0], dd.def.hinge[1] - cur[2]) < dd.def.width + 0.8).map((dd: any) => `${dd.def.name}@${dd.angle.toFixed(2)}`).join(',') || 'none';
          violate('player-crossed-wall', 'player', `player crossed static geometry between frames: ${p2(prev)} → ${p2(cur)} (${d.toFixed(3)} m; crouch ${game.player.crouch} sprint ${game.player.sprinting} picking ${!!game.player.picking} kick ${!!game.player.kick} takedown ${!!game.player.takedown} drag ${!!game.player.dragging}; nearest guard ${Math.min(...living().map((g: any) => v3.distXZ(g.char.pos, cur)), 99).toFixed(2)} m; doors in reach ${nearDoors})`);
        }
      }
      lastPos.set('player', cur);
      for (const gd of game.guards) {
        const p0 = lastPos.get(gd); const c1 = v3.copy(gd.char.pos);
        const snapped = UNSTICK.lastSnapWho === gd && Math.abs(UNSTICK.lastSnapT - t) < 1e-6;   // the un-stick's last resort stood him on a free cell this frame (guards.ts unstickSnap: counted, logged) — the game's own teleport, let through like the harness's; how often it had to is the 'unstickSnaps' smell
        if (snapped) tl(`UNSTICK snap: ${routeName(gd)} ${p0 ? p2(p0) : '?'} → ${p2(c1)} (${gd.script ? 'scripted' : gd.state})`);
        if (p0 && gd.state !== 'dead' && !snapped) { const d = v3.distXZ(p0, c1); if (d > POP) { const wall = col.segmentBlocked([p0[0], 0.6, p0[2]], [c1[0], 0.6, c1[2]]); violate(wall ? 'popped-through-wall' : 'popped', routeName(gd), `guard ${routeName(gd)} jumped ${d.toFixed(2)} m in one frame ${p2(p0)} → ${p2(c1)}${wall ? ' THROUGH static geometry' : ''} (${gd.script ? 'scripted ' + (game.clearingSummary() || '') : gd.state})`); } }
        lastPos.set(gd, c1);
      }
      teleportedThisFrame = false;
    }
    // escalation
    const esc = game.escalation;
    if (![0, 1, 2].includes(esc)) violate('esc-range', String(esc), `escalation ${esc}`);
    if (esc === 0 && game.escalationT !== -1) violate('esc-clock', 'level0-clock', `level 0 but escalationT=${game.escalationT} (t=${t.toFixed(1)})`);
    if (esc > 0 && !(game.escalationT > 0)) violate('esc-clock', 'levelN-noclock', `level ${esc} but escalationT=${game.escalationT}`);
    const hunting = game.guards.some((gd: any) => gd.state === 'alert' || gd.state === 'search');
    if (!game.quietUtility && esc > 0 && t >= game.escalationT && !game.alarm.episode && !hunting && !stillLooking(game)) { if (++overdueFrames >= 2) violate('esc-clock', 'overdue-stepdown', `level ${esc} clock lapsed ${(t - game.escalationT).toFixed(1)} s ago, no episode, nobody hunting or out looking for a silent man, yet no step-down for ${overdueFrames} frames`); } else overdueFrames = 0;   // (one frame is legit: a clear finishing inside updateEscalation puts the pair back on patrol after this frame's step-down check; a route walk for a silent colleague / the net asking after one holds the level by design — guards.ts stillLooking)
    if (!game.quietUtility && game.aiEnabled) { const R = rollcallState(game); if (R.stage !== 'idle' && t - R.t0 > 60) violate('rollcall-stuck', R.stage, `radio check stuck at '${R.stage}' for ${(t - R.t0).toFixed(0)} s (missing ${R.missing ? routeName(R.missing) + ' ' + R.missing.state + (R.missing.found ? ' found' : '') : 'none'}, caller ${R.caller ? routeName(R.caller) + ' ' + R.caller.state : 'none'})`); }
    for (const gd of game.guards) if (gd.state !== 'dead' && gd.task?.kind === 'checkOn' && t - gd.task.t0 > 200) violate('checkon-overlong', routeName(gd), `${routeName(gd)} has walked ${routeName(gd.task.who)}'s route for ${(t - gd.task.t0).toFixed(0)} s (cap 150 + slack; state ${gd.state})`);
    if (game.mission.debrief) { game.mission.debrief = false; smells.debriefs = (smells.debriefs ?? 0) + 1; tl(`DEBRIEF: ${game.objectiveText()}`); }
    if (esc < 2 && !game.quietUtility && game.guards.some((gd: any) => gd.state !== 'dead' && (gd.leader || gd.post))) violate('lockdown-duty-leak', `level${esc}`, `level ${esc} but somebody still has a leader/post: ${game.escalationSummary()}`);
    // the response to going loud (lane qrf, src/game/qrf.ts): the state machine sane, its men only ever hunting or fighting (never talked calm), the character
    // budget held (spawnUnit throws past it: an exception would already be a violation), the wave never called under the tour's flag or with the AI off, its
    // radio traffic bounded — and the smells: requests, deployments, contacts, rooms called, re-forms, men lost, the perimeter
    if (game.qrf) {
      const Q = game.qrf; const QS = ['idle', 'requested', 'inbound', 'arriving', 'deployed'];
      if (!QS.includes(Q.state)) violate('qrf-state', Q.state, `qrf state ${Q.state}`);
      if (Q.state === 'idle' && (Q.men.length || Q.perim)) violate('qrf-idle-leftovers', 'idle', `idle but ${Q.men.length} men / perim ${!!Q.perim}`);
      if (Q.state === 'deployed' && !(Q.deployedAt >= Q.requestedAt && Q.requestedAt >= 0)) violate('qrf-clock', 'deployed', `deployedAt ${Q.deployedAt} requestedAt ${Q.requestedAt}`);
      if (Q.state !== 'idle' && qrfPrevState === 'idle' && (game.quietUtility || game.touring || !game.aiEnabled) && Q.reason !== 'panel') violate('qrf-under-tour', Q.reason ?? '?', `QRF requested (${Q.reason}) with quietUtility ${game.quietUtility} touring ${game.touring} ai ${game.aiEnabled}`);
      if (Q.state !== qrfPrevState) { tl(`QRF ${qrfPrevState} → ${Q.state}${Q.reason ? ' (' + Q.reason + ')' : ''}`); if (Q.state === 'requested') smells.qrfRequests = (smells.qrfRequests ?? 0) + 1; if (Q.state === 'deployed') smells.qrfDeploys = (smells.qrfDeploys ?? 0) + 1; qrfPrevState = Q.state; }
      for (; qrfLogI < Q.log.length; qrfLogI++) { const w = Q.log[qrfLogI].what as string; const k = w.split(':')[0]; if (['contact', 'clear', 'regroup', 'man-down', 'perimeter', 'perimeter-set', 'bang', 'target', 'refused', 'wiped', 'perim-contact', 'found'].includes(k)) { smells[`qrf:${k}`] = (smells[`qrf:${k}`] ?? 0) + 1; if ((smells[`qrf:${k}`] as number) <= 6) tl(`QRF ${w} (${Q.phase})`); } }
      if (qrfLogI > Q.log.length) qrfLogI = Q.log.length;   // (a reset made a fresh log)
      for (const m of [...Q.men, ...(Q.perim?.men.map((x: any) => x.gd) ?? [])]) {
        if (!game.guards.includes(m)) continue;
        if (m.state !== 'dead' && m.state !== 'alert' && m.state !== 'search') { const acc = (qrfCalm.get(m) ?? 0) + DT; qrfCalm.set(m, acc); if (acc > 0.1) violate('qrf-calm', m.callsign, `${m.callsign} of the response is '${m.state}' for ${acc.toFixed(2)} s (they never stand down: alert in the fight, search under the script)`); } else qrfCalm.set(m, 0);
        if (m.team !== 'guard' || !m.unit) violate('qrf-side', m.callsign, `${m.callsign}: team ${m.team} unit ${!!m.unit}`);
      }
      if (1 + game.guards.length > 8) violate('char-budget', String(game.guards.length), `${1 + game.guards.length} characters stand (the shadow-capsule list holds 8)`);
      { const rx = game.messages.filter((m: any) => m.t === t && /^radio: (CONTROL|QRF|GATE)/.test(m.text)).length; if (rx) { qrfRadio.push(...Array(rx).fill(t)); } while (qrfRadio.length && t - qrfRadio[0] > 60) qrfRadio.shift(); smells.qrfRadioPeakPerMin = Math.max((smells.qrfRadioPeakPerMin as number) ?? 0, qrfRadio.length); if (qrfRadio.length > 30) violate('qrf-radio-flood', 'radio', `${qrfRadio.length} response radio lines inside a minute`); }
    }
    // the level-design devices (lane G4, src/game/devices.ts): every camera's integrator finite and inside its cap, its yaw finite and inside its sweep, its state one
    // of the three; every beam's cut inside [0, len]; a report only ever off a live floor (never under the tour / the AI off / the panel switch); control's radio inside
    // the last minute bounded (a camera re-arms after 20 s quiet, a beam after 4 s: a flood means an integrator or a cooldown is broken); the codes Sam holds name real pads
    if (game.devices) {
      const Dv = game.devices; const cap = game.tune.cameraAlarmSecs + 1 + 1e-6;
      for (const c of Dv.cameras) {
        if (!Number.isFinite(c.seen) || c.seen < 0 || c.seen > cap) violate('device-integrator', c.def.name, `${c.def.name} seen ${c.seen} (cap ${cap.toFixed(2)})`);
        if (!Number.isFinite(c.yaw) || (c.def.sweep && (c.yaw < Math.min(c.def.sweep[0], c.def.sweep[1]) - 1e-6 || c.yaw > Math.max(c.def.sweep[0], c.def.sweep[1]) + 1e-6))) violate('device-yaw', c.def.name, `${c.def.name} yaw ${c.yaw} outside its sweep`);
        if (!['idle', 'suspect', 'alarm'].includes(c.state)) violate('device-state', c.def.name, `${c.def.name} state ${c.state}`);
      }
      for (const l of Dv.lasers) if (!Number.isFinite(l.cut) || l.cut < 0 || l.cut > l.len + 1e-6) violate('device-cut', l.def.name, `${l.def.name} cut ${l.cut} of ${l.len}`);
      for (const r of Dv.log) { if (r.seq <= devLogI) continue; devLogI = r.seq; smells[`device:${r.what}`] = ((smells[`device:${r.what}`] as number) ?? 0) + 1; if (['suspicion', 'alarm', 'trip', 'dead'].includes(r.what) && (game.quietUtility || !game.aiEnabled || !game.tune.devices)) violate('device-report-while-off', r.device, `${r.device} reported '${r.what}' with quietUtility ${game.quietUtility} ai ${game.aiEnabled} devices ${game.tune.devices}`); if ((smells[`device:${r.what}`] as number) <= 4) tl(`device ${r.device}: ${r.what} (${r.where}${r.sent ? ', sent ' + r.sent : ''})`); }
      { const rx = game.messages.filter((m: any) => m.t === t && /^radio: CONTROL — (camera|beam|the .* beam)/.test(m.text)).length; if (rx) devRadio.push(...Array(rx).fill(t)); while (devRadio.length && t - devRadio[0] > 60) devRadio.shift(); smells.deviceRadioPeakPerMin = Math.max((smells.deviceRadioPeakPerMin as number) ?? 0, devRadio.length); if (devRadio.length > 24) violate('device-radio-flood', 'radio', `${devRadio.length} control lines about devices inside a minute`); }
      for (const code of game.player.codes) if (!Dv.keypads.some((k: any) => k.def.name === code)) violate('device-code', code, `Player.codes holds '${code}', no such pad`);
    }
    // clearing
    if (game.clearing && (game.quietUtility || !game.aiEnabled)) violate('clearing-while-off', game.quietUtility ? 'quietUtility' : 'aiOff', `clearing active (${game.clearingSummary() || game.clearing.stage}) while ${game.quietUtility ? 'quietUtility' : 'aiEnabled=false'}`);
    if (game.clearing && game.clearing.stage !== 'done' && game.clearing.stage !== 'muster') for (const gd of [game.clearing.a, game.clearing.b]) if (gd && gd.state !== 'dead' && !gd.script && game.guards.includes(gd)) violate('clearing-unscripted', routeName(gd), `clearing at ${game.clearing.stage} but ${routeName(gd)} has no script (state ${gd.state})`);
    for (const gd of game.guards) if (gd.script && !game.clearing && gd.state !== 'dead' && !game.qrf?.owns?.(gd)) violate('orphan-script', routeName(gd), `${routeName(gd)} scripted (goal ${p2(gd.script.goal)}, stance ${gd.script.stance}) but no clearing is running (state ${gd.state})`);
    // doors
    for (const d of doors.list) {
      const n = d.def.name;
      if (!Number.isFinite(d.angle) || !Number.isFinite(d.vel) || !Number.isFinite(d.pick)) violate('nan', `door-${n}`, `door ${n} angle ${d.angle} vel ${d.vel} pick ${d.pick}`);
      if (d.latched && Math.abs(d.angle) > 1e-3) violate('door-latched-open', n, `door ${n} latched at angle ${d.angle.toFixed(4)}`);
      if (d.locked && d.lockBroken) violate('door-locked-and-broken', n, `door ${n} locked && lockBroken`);
      if (d.pick < 0 || d.pick > 1) violate('door-pick-range', n, `door ${n} pick ${d.pick}`);
      if (d.angle < d.minA - 1e-6 || d.angle > d.maxA + 1e-6) violate('door-angle-range', n, `door ${n} angle ${d.angle.toFixed(3)} outside [${d.minA}, ${d.maxA}]`);
      if (Math.abs(d.vel) > 40) violate('door-vel', n, `door ${n} vel ${d.vel.toFixed(1)}`);
    }
    // player
    const pl = game.player;
    if (pl.down !== !pl.char.alive) violate('alive-mismatch', 'player', `down ${pl.down} alive ${pl.char.alive}`);
    if (pl.picking && pl.kick) violate('player-pick-and-kick', 'player', 'picking and kicking at once');
    // the Space selector (interact.ts) and its rows (player.ts buildInteractables): the list is OPEN only under a Space that is down; the cancel row exists exactly
    // while it is open; a running sustained verb (ease / pick / the choke or whip chosen or on / the drive) is ALONE in the list, worded as running with its bar,
    // from the frame after it began; and no sustained verb ever replaces another inside one frame (nothing starts over a running one — a frame of none between,
    // always) unless the harness itself made the call this frame (a stimulus's startPicking / teleport)
    { const S = pl.sel; const run = runningVerb(game); const rows = game.nearby.filter((r: any) => r.kind !== 'cancel');
      if (S.open && !input.keys.has(IK)) violate('selector-open-keyup', 'player', `the list is open with Space up (downT ${S.downT.toFixed(2)}, fHeld ${pl.fHeld})`);
      if (S.open && S.downT < 0) violate('selector-open-unarmed', 'player', `open with no press armed (downT ${S.downT})`);
      if (game.nearby.filter((r: any) => r.kind === 'cancel').length !== (S.open && rows.length ? 1 : 0)) violate('selector-cancel-row', 'player', `open ${S.open}, ${rows.length} rows, ${game.nearby.filter((r: any) => r.kind === 'cancel').length} cancel row(s)`);
      if (!Number.isFinite(pl.nearSel) || (game.nearby.length && (pl.nearSel < 0 || pl.nearSel >= game.nearby.length)) || (game.hover && !game.nearby.includes(game.hover))) violate('selector-highlight', 'player', `nearSel ${pl.nearSel} over ${game.nearby.length} rows, hover ${game.hover ? (game.hover.verb ?? game.hover.kind) : 'null'} ${game.hover && !game.nearby.includes(game.hover) ? 'NOT in the list' : ''}`);
      if (run && run === runPrev && !pl.down && (rows.length !== 1 || !rows[0].running || rows[0].progress === undefined)) violate('running-row', run, `${run} is running but the rows are [${game.nearby.map((r: any) => `${r.verb ?? r.kind}${r.running ? '*' : ''}${r.progress !== undefined ? ' ' + Math.round(r.progress * 100) + '%' : ''}`).join(', ')}]`);
      if (run && runPrev && run !== runPrev && !stimFrame) violate('verb-overlap', run, `${runPrev} → ${run} inside one frame (a sustained verb started over a running one)`);
      if (run) smells[`verbSeconds:${run.split(':')[0]}`] = f2((smells[`verbSeconds:${run.split(':')[0]}`] ?? 0) + DT);
      if (S.open) smells.selectorOpenSeconds = f2((smells.selectorOpenSeconds ?? 0) + DT);
      runPrev = run; }
    // ammunition only ever runs DOWN within one life: rounds carried = chamber + seated mag + every spare (a reload only moves them about, an empty hits the floor);
    // nothing on the floor — a dead man's sidearm, Sam's own dropped gun — is a pickup. A fresh Player (restart) or the sandbox's bottomless magazine re-baselines.
    { const gun = pl.pistol, rf = pl.rifle; const tot = gun.chamber + (gun.mag ?? 0) + gun.spare.reduce((s: number, x: number) => s + x, 0) + rf.chamber + (rf.mag ?? 0) + rf.spare.reduce((s: number, x: number) => s + x, 0);   // (lane R5: the rifle's rounds counted in — nothing on the floor fits it either; the panel's refill button is not pressed by the soak)
      if (pl === ammoPl && !game.infiniteAmmo && !gun.infinite && !rf.infinite && tot > ammoTotal) violate('ammo-rose', 'player', `rounds carried went ${ammoTotal} → ${tot} within one life (pistol chamber ${gun.chamber} mag ${gun.mag} spare [${gun.spare.join(',')}]; rifle ${rf.chamber}/${rf.mag}/[${rf.spare.join(',')}]; hover ${game.hover?.kind ?? 'none'}; ${game.items.items.filter((x: any) => x.kind === 'pistol' || x.kind === 'rifle').length} gun item(s) on the floor)`);
      ammoPl = pl; ammoTotal = tot; }
    // the interaction rows are only ever of the known kinds and never about a gun on the floor (the 'pistol' / take-magazine row is gone: dropped weapons are set dressing)
    for (const r of [...game.interactables, ...game.nearby]) if (!INTERACT_KINDS.has(r.kind) || 'item' in r || /magazine/i.test(r.line2)) { violate('interact-row', r.kind, `row of kind '${r.kind}': "${r.line1} / ${r.line2}"`); break; }
    // back to the wall: holding ⇒ a live, free man (nothing else planted), the animator in its wall hold, and his body where the hold says — on the plane within the shove
    // allowance and inside the traced run (else moveOnWall lets go); free ⇒ nothing of the hold left on the animator or the camera
    if (pl.wall) {
      const w = pl.wall; const p = pl.char.pos; const off = p[0] * w.n[0] + p[2] * w.n[2] - (w.d + 0.45), u = p[0] * w.along[0] + p[2] * w.along[2] - (w.leanOff ?? 0);   // (u = his STATION: the rifle stack's step-out — wallsnap.ts, WallHold.leanOff — stands him past it on purpose, up to leanAlong beyond the wall's end)
      const stack = w.kind === 'stack';   // (the rifle stack: shoulder to the wall in stance 'stack', the rifle in his hands — the back hold's two rules below are the other way round for it)
      if (pl.down || pl.picking || pl.kick || pl.takedown || pl.dragging || pl.sprinting) violate('wall-while-busy', 'player', `holding a wall while down ${pl.down} picking ${!!pl.picking} kick ${!!pl.kick} takedown ${!!pl.takedown} drag ${!!pl.dragging} sprint ${pl.sprinting}`);
      if (![w.n[0], w.n[2], w.d, w.lo, w.hi, w.u, w.v, w.off, w.peek].every(Number.isFinite) || Math.abs(Math.hypot(w.n[0], w.n[2]) - 1) > 1e-6 || w.hi - w.lo < 0.84) violate('wall-bad-hold', 'player', `hold ${JSON.stringify(w)}`);
      if (w.settle >= 1 && (off < -0.07 || off > 0.27 ||   /* −0.07: furniture resting on him may press him a few cm toward the wall inside the static push-out's tolerance — the wall itself is asserted by 'in-geometry' at 3 cm */ u < w.lo + 0.42 - 0.27 || u > w.hi - 0.42 + 0.27)) violate('wall-off-plane', 'player', `holding n (${w.n[0].toFixed(2)}, ${w.n[2].toFixed(2)}) face ${w.d.toFixed(2)} run ${w.lo.toFixed(2)}‥${w.hi.toFixed(2)} but standing ${off.toFixed(3)} m off the plane / at station ${u.toFixed(2)} at ${p2(p)} (settle ${w.settle.toFixed(2)}, off ${w.off.toFixed(2)}; nearest guard ${Math.min(...living().map((g: any) => v3.distXZ(g.char.pos, p)), 99).toFixed(2)} m)`);
      if (pl.char.anim.stance !== (stack ? 'stack' : 'wall')) violate('wall-stance', 'player', `holding a wall${stack ? ' on the rifle stack' : ''} in stance '${pl.char.anim.stance}'`);
      if (!stack && !pl.holstered && w.settle >= 1) violate('wall-drawn', 'player', `holding a wall with the ${pl.slot} in his hand (slot ${pl.slot}; the hold holsters it, moveOnWall re-holsters whatever draws it)`);
      if (stack && !pl.rifleUp) violate('wall-stack', 'player', `on the rifle stack without the rifle in his hands (slot ${pl.slot}, holstered ${pl.holstered})`);
      if (!Number.isFinite(w.leanOff ?? 0) || Math.abs(w.leanOff ?? 0) > WALLSNAP.leanAlong + 0.02) violate('wall-lean', 'player', `stood ${w.leanOff} m out past his station (the step-out is leanAlong ${WALLSNAP.leanAlong} at the most)`);
      if (w.peek > 0 && !w.atEdge && w.peek > wallPeekPrev + 1e-6) violate('wall-peek', 'player', `peek rising (${w.peek.toFixed(2)}) away from an open end (atEdge ${w.atEdge})`);
      wallPeekPrev = w.peek;
    } else { wallPeekPrev = 0; if (!pl.down && !game.quietUtility && (Math.abs(pl.char.anim.lookYawExtra) > 1e-6 || W.cam.peekOffset)) violate('wall-leftover', 'player', `free but neck craned ${pl.char.anim.lookYawExtra.toFixed(2)} / camera peekOffset ${JSON.stringify(W.cam.peekOffset)}`); }
    // a man in his arm (player.ts Hold): Player.holding ⇔ exactly one Guard.held, both naming each other; the man alive (a corpse in the arm is dropped the next
    // frame), unscripted, pathless, blind to Sam; on his station HOLD.dist dead ahead on Sam's facing once held (a hand's slack for a chair shoving him); no hold
    // while down or with the hands / feet in anything else; and nothing of it left on either animator once it is over
    {
      const H = pl.holding; const heldMen = [...game.guards, ...(game.civilians ?? [])].filter((x: any) => x.held);
      if (heldMen.length > 1) violate('held-multiple', 'guards', `${heldMen.length} men carry .held: ${heldMen.map(routeName).join(', ')}`);
      for (const x of heldMen) if (!H || H.g !== x) violate('held-orphan', routeName(x), `${routeName(x)} carries .held (${x.held.phase}) but Player.holding is ${H ? routeName(H.g) : 'null'}`);
      if (H) {
        const gd = H.g, name = routeName(gd);
        smells.holdSeconds = f2((smells.holdSeconds ?? 0) + DT);
        if (!game.guards.includes(gd) && !(game.civilians ?? []).includes(gd)) violate('holding-orphan', name, `Player.holding names ${name}, who is not on the roster (nor a civilian)`);
        else if (gd.state === 'dead') { holdDeadFrames++; if (holdDeadFrames > 1) violate('holding-corpse', name, `holding ${name} who is dead (${gd.downKind}) for ${holdDeadFrames} frames`); }
        else {
          holdDeadFrames = 0;
          if (gd.held?.by !== 'player') violate('holding-mismatch', name, `Player.holding names ${name} but his .held is ${JSON.stringify(gd.held)}`);
          else { if (gd.held.phase !== H.phase) violate('hold-phase-mismatch', name, `holding phase ${H.phase} vs his ${gd.held.phase}`); if (gd.held.variant !== H.variant) violate('hold-variant-mismatch', name, `holding variant ${H.variant} vs his ${gd.held.variant}`); }
          if (!['grab', 'held', 'choke', 'whip'].includes(H.phase) || !(H.t >= 0) || H.t > (H.phase === 'grab' ? HOLD.secs.grab : H.phase === 'choke' ? HOLD.secs.choke : H.phase === 'whip' ? HOLD.secs.whip : Infinity) + 2 * DT + 1e-6) violate('hold-phase', name, `phase ${H.phase} t ${f2(H.t)}`);
          if ((H.phase === 'choke' && H.variant !== 'arm') || (H.phase === 'whip' && H.variant !== 'gun')) violate('hold-phase-variant', name, `phase ${H.phase} in the ${H.variant} variant`);
          if (H.variant !== 'arm' && H.variant !== 'gun') violate('hold-variant', name, `variant ${H.variant}`);
          const swapped = H.swapT > HOLD.secs.swap + 0.25;   // (E mid-hold, player.ts swapHold: the animator hands the fist over behind the man's shoulder inside HOLD.secs.swap — the new tool comes into it half way; give the props that beat and a little)
          if (H.phase === 'held' && H.t > 0.6 && swapped && (H.variant === 'gun') !== !pl.char.anim.hideHeldItem) violate('hold-prop', name, `${H.variant} hold but hideHeldItem ${pl.char.anim.hideHeldItem} (the pistol ${pl.char.anim.hideHeldItem ? 'on the thigh' : 'in the hand'}), ${f2(H.swapT)} s since a swap`);   // the gun variant keeps the pistol drawn up by his head; the arm variant's hands are both on him
          if (H.variant === 'gun' && !pl.pistolUp) violate('gunhold-unarmed', name, `gun hold with slot ${pl.slot} holstered ${pl.holstered}`);
          // the variant is always what the hands say — the Five-seveN drawn in slot 1 ⇔ 'gun' (player.ts grabVariant at the grab, swapHold on E) — but for the one frame a
          // tour stop's exit may draw it under a hold it is about to reset; and the knife's boxes (combat.ts handProps, KNIFE_TAG) are in the fist exactly in the arm hold:
          // never with the gun at his head, all four once a holstering has had its hand-over
          if ((H.variant === 'gun') !== pl.pistolUp) { if (++variantHandsFrames > 1) violate('hold-variant-hands', name, `'${H.variant}' hold with slot ${pl.slot} holstered ${pl.holstered} for ${variantHandsFrames} frames`); } else variantHandsFrames = 0;
          { const kn = game.dynBoxes.filter((b: any) => b.name === KNIFE_TAG).length;
            if (H.variant === 'gun' && kn) violate('knife-in-gunhold', name, `${kn} knife boxes drawn with the gun at his head (${f2(H.swapT)} s since a swap)`);
            if (H.variant === 'arm' && H.t > 0 && !pl.down && swapped && kn !== 4) violate('knife-missing', name, `${kn} knife boxes in the arm hold (want 4), phase ${H.phase} t ${f2(H.t)}, ${f2(H.swapT)} s since a swap, holdGunSide ${pl.char.anim.holdGunSide}`);
            if (kn && kn !== 4) violate('knife-partial', name, `${kn} knife boxes (want 0 or 4)`); }
          if (!(H.swapT >= 0)) violate('hold-swapt', name, `swapT ${H.swapT}`);
          if (!(H.gunOut >= 0 && H.gunOut <= 1 + 1e-6) || (H.variant === 'arm' && swapped && H.gunOut > 0.02)) violate('hold-gunout', name, `gunOut ${H.gunOut} in the ${H.variant} variant`);
          // the exchange (player.ts askHeld / answerHeld): Sam's own line (Player.bubble) resolved, inside SAM_MAX_CHARS, only ever begun in the hold proper, never
          // live together with the man's answer (his bubble stamped at talk.lastT), and a pending answer (H.ask) only while 'held' and never past its beat
          { const sb = pl.bubble; const sbLive = !!sb && game.time - sb.t < sb.dur - 1e-9;
            if (sb && Math.abs(sb.t - game.time) < 1e-9) { smells.samLines = (smells.samLines ?? 0) + 1; if (/[{}]/.test(sb.text) || !sb.text.trim() || sb.text === '…' || sb.text.length > Dlg.SAM_MAX_CHARS) violate('sam-line-text', name, `Sam said "${sb.text}" (${sb.text.length} chars)`); if (H.phase !== 'held') violate('sam-line-phase', name, `Sam's line began in phase ${H.phase}`); fullLog.push(`${game.time.toFixed(2)}s f${frame}   SAM  ${sb.text}`); }
            const ab = gd.bubble && gd.talk.lastT >= 0 && Math.abs(gd.bubble.t - gd.talk.lastT) < 1e-6 && game.time - gd.bubble.t < gd.bubble.dur - 1e-9;
            if (sbLive && ab) violate('sam-line-overlap', name, `Sam's "${sb!.text}" (${f2(game.time - sb!.t)} s in) and ${name}'s answer "${gd.bubble.text}" (${f2(game.time - gd.bubble.t)} s in) both up`);
            if (H.ask && (H.phase !== 'held' || game.time - H.ask.t > H.ask.dur + 2 * DT)) violate('hold-ask-stale', name, `an answer pending ${f2(game.time - H.ask.t)} s (beat ${f2(H.ask.dur)}) in phase ${H.phase}`); }
          if (gd.script) violate('held-scripted', name, `${name} held but scripted (goal ${p2(gd.script.goal)})`);
          if (gd.path.length) violate('held-pathing', name, `${name} held but carries a path ${gd.pathI}/${gd.path.length}`);
          if (gd.sawPlayerThisFrame && H.t > 0) violate('held-perceives', name, `${name} held but sawPlayerThisFrame`);   // (t 0: grabbed inside this very step, after his senses had already run — a searching man may have had Sam in the corner of his eye the frame the arm went round him)
          if (gd.bodyDuty || gd.pieing || gd.searchPlan) violate('held-duty', name, `${name} held but carries ${gd.bodyDuty ? 'a body duty' : gd.pieing ? 'a pie' : 'a search plan'}`);
          const d = v3.distXZ(pl.char.pos, gd.char.pos); const dyaw = Math.abs(Math.atan2(Math.sin(pl.char.bodyYaw - gd.char.bodyYaw), Math.cos(pl.char.bodyYaw - gd.char.bodyYaw)));
          if ((H.phase === 'held' || H.phase === 'choke' || H.phase === 'whip') && (Math.abs(d - HOLD.dist) > 0.12 || dyaw > 0.05)) violate('held-off-station', name, `${name} ${d.toFixed(3)} m from Sam (station ${HOLD.dist}), yaws ${dyaw.toFixed(3)} apart, in phase ${H.phase} at ${p2(gd.char.pos)}; nearest other guard ${Math.min(...living().filter((o: any) => o !== gd).map((o: any) => v3.distXZ(o.char.pos, gd.char.pos)), 99).toFixed(2)} m; doors near ${doors.list.filter((dd: any) => v3.distXZ(dd.frameCentre, gd.char.pos) < 1.5).map((dd: any) => `${dd.def.name}@${dd.angle.toFixed(2)}`).join(',') || 'none'}`);
          if (H.phase === 'grab' && d > 1.4) violate('grab-far', name, `grabbing ${name} from ${d.toFixed(2)} m`);
          if (!gd.char.anim.heldPose && H.phase !== 'grab') violate('held-anim-missing', name, `${name} held (${H.phase}) but his animator has no heldPose`);
        }
        if (pl.down) violate('holding-while-down', 'player', `holding ${name} while down`);
        if (pl.takedown || pl.kick || pl.picking || pl.wall || pl.dragging || pl.sprinting || pl.crouch) violate('holding-while-busy', 'player', `holding ${name} while takedown ${!!pl.takedown} kick ${!!pl.kick} picking ${!!pl.picking} wall ${!!pl.wall} drag ${!!pl.dragging} sprint ${pl.sprinting} crouch ${pl.crouch}`);
        if (!pl.char.anim.holdPose && H.t > 0) violate('hold-anim-missing', 'player', `holding (${H.phase}) but Sam's animator has no holdPose`);   // (t 0: grabbed inside this step's door pass, posed from the next)
        if (game.hover?.kind !== 'held' && !pl.down && H.t > 0) violate('hold-hover', 'player', `holding but the highlighted row is ${game.hover?.kind ?? 'none'}`);   // (t 0: grabbed inside this very step, after the cursor pass — the row comes next frame)
      } else {
        holdDeadFrames = 0; variantHandsFrames = 0;
        if (pl.char.anim.holdPose) violate('hold-anim-leftover', 'player', `free but Sam's animator still has holdPose (${pl.char.anim.holdPose.phase})`);
        { const kn = game.dynBoxes.filter((b: any) => b.name === KNIFE_TAG).length; if (kn && !pl.char.anim.knifeShown && !(KITANIM.on && (pl.char.anim.kitHold === 'knife' || pl.kitWas === 'knife'))) violate('knife-leftover', 'player', `${kn} knife boxes drawn with nobody held`); }   // (kit handling on: the knife rides his hand back to the sheath after a hold · knifeShown: the lethal blow's own blade, out from hilt to hilt — combat.ts handProps draws it on that flag, character.ts strike(kind, true))
      }
      for (const x of game.guards) if (x.state !== 'dead' && !x.held && x.char.anim.heldPose) violate('held-anim-leftover', routeName(x), `${routeName(x)} free but his animator still has heldPose (${x.char.anim.heldPose.phase})`);
      for (const x of game.guards) if (x.state !== 'dead' && !x.held && x.talk.heldSince !== -1 && !inSandboxTalk.has(x)) violate('heldsince-leftover', routeName(x), `${routeName(x)} free but talk.heldSince ${f2(x.talk.heldSince)}`);
    }
    if (pl.picking && !pl.crouch) violate('player-pick-standing', 'player', 'picking but not crouched');
    if (pl.hitsLeft < 0 || pl.canisters < 0 || pl.flashbangs < 0) violate('player-neg-inventory', 'player', `hits ${pl.hitsLeft} cans ${pl.canisters} flash ${pl.flashbangs}`);
    // keys (player.ts takeKey, doors.ts lockedOut / the contact's `keys`): Sam's pocket only ever holds locks this floor has and only ever grows within one life
    // (a fresh Player is empty — checkRestored); every belt is a Set of known locks; he is never planted picking or kicking a lock whose key he holds (those
    // paths sit behind lockedOut with his keys); and a keyed leaf that comes off its latch under HIS hand from its cylinder side while still thrown did so by a
    // key — his own, or the man's in his arm walking the pair through — or with a guard's hands on it too: anything else got through a lock it had no key to
    {
      if (pl !== keysPl) { keysPl = pl; keysN = pl.keys.size; }
      if (!(pl.keys instanceof Set)) violate('keys-missing', 'player', `Player.keys is ${pl.keys}`);
      else {
        for (const k of pl.keys) if (!LOCK_IDS.has(k)) { violate('keys-unknown', String(k), `Sam carries a key '${k}' to no lock on this floor (locks: ${[...LOCK_IDS].join(',')})`); break; }
        if (pl.keys.size < keysN) violate('keys-lost', 'player', `Sam's pocket shrank ${keysN} → ${pl.keys.size} within one life`);
        if (pl.keys.size > keysN) { smells.keysTaken = (smells.keysTaken ?? 0) + (pl.keys.size - keysN); tl(`KEY: Sam's pocket now [${[...pl.keys].join(',')}]${pl.holding ? ` (off ${routeName(pl.holding.g)} in his arm)` : ' (the sandbox exchange)'}`); }
        keysN = pl.keys.size;
        if (pl.picking && pl.keys.has(pl.picking.lockId)) violate('key-but-picking', pl.picking.def.name, `Sam planted picking the ${pl.picking.def.name} lock with its key ('${pl.picking.lockId}') in his pocket`);
        if (pl.kick && pl.kick.door.locked && pl.keys.has(pl.kick.door.lockId) && doors.side(pl.kick.door, pl.char.pos) === pl.kick.door.keySide) violate('key-but-kicking', pl.kick.door.def.name, `Sam kicking in the ${pl.kick.door.def.name} door with its key in his pocket`);
      }
      for (const gd of game.guards) { if (!(gd.keys instanceof Set)) { violate('keys-missing', routeName(gd), `${routeName(gd)} has no key ring (${gd.keys})`); break; } for (const k of gd.keys) if (!LOCK_IDS.has(k)) { violate('keys-unknown', `${routeName(gd)}:${k}`, `${routeName(gd)} carries '${k}', a key to no lock here`); break; } }
      const prev = keyPrevPos ?? pl.char.pos; keyPrevPos = v3.copy(pl.char.pos);   // where he stood going into this frame (the side he came at the leaf from)
      for (const d of doors.list) {
        const was = latchedPrev.get(d); latchedPrev.set(d, d.latched);
        if (!d.def.locked || was !== true || d.latched || !d.locked || d.lockBroken || d.lastWho !== PLAYER_ID || pl.down) continue;
        { const hT = harnessDoorT.get(d); if (hT !== undefined && t - hT < DT * 1.5) continue; }   // the harness flung or used it itself this frame (stamped before the step, read after it)
        if (doors.side(d, prev) !== d.keySide || v3.distXZ(prev, d.frameCentre) > 1.8) continue;   // from the thumb-turn side, or nowhere near it (a fling from across the floor blamed on him)
        const guardOn = game.guards.some((g2: any) => g2.state !== 'dead' && Math.hypot(g2.char.pos[0] - d.def.hinge[0], g2.char.pos[2] - d.def.hinge[1]) < d.def.width + 0.5);
        if (pl.keys.has(d.lockId)) { smells.keyUnlocks = (smells.keyUnlocks ?? 0) + 1; continue; }
        if (pl.holding || guardOn) continue;                                                  // the man in his arm (his belt), or a guard working the same leaf
        violate('lock-bypassed', d.def.name, `the ${d.def.name} leaf came off its latch under Sam's hand from its keyed side while still locked — no key in his pocket ([${[...pl.keys].join(',')}]), nobody in his arm, no guard at it; Sam ${p2(prev)} → ${p2(pl.char.pos)}, picking ${!!pl.picking} kick ${!!pl.kick} easing ${!!pl.easing}`);
      }
    }
    // mission monotonic
    if (game.mission !== missionRef) { missionRef = game.mission; stageIdx = 0; }
    const si = STAGE_ORDER[game.mission.stage]; if (si === undefined) violate('mission-stage', game.mission.stage, `unknown stage ${game.mission.stage}`); else { if (si < stageIdx) violate('mission-backwards', `${stageIdx}->${si}`, `mission stage went back to ${game.mission.stage} without a restart`); stageIdx = Math.max(stageIdx, si); }
    if (game.mission.driveT > 0 && game.mission.stage !== 'drive') violate('mission-drive', game.mission.stage, `driveT ${game.mission.driveT} in stage ${game.mission.stage}`);
    // leaks / bounds
    if (game.items.items.length > 150) violate('leak', 'items', `${game.items.items.length} live items`);
    if (game.engine.lights.lights.length > 150) violate('leak', 'lights', `${game.engine.lights.lights.length} lights`);
    if (game.events.length > 400) violate('leak', 'events', `${game.events.length} events queued`);
    if (game.fx.length > 200) violate('leak', 'fx', `${game.fx.length} fx boxes`);
    if (game.messages.length > 5) violate('leak', 'messages', `${game.messages.length} messages`);
    { const C = game.chronicle; if (C && (C.events.length > CHRON_MAX || C.pathN > CHRON_PATH || !(C.pathEvery >= 0.5))) violate('leak', 'chronicle', `chronicle holds ${C.events.length} rows (cap ${CHRON_MAX}), ${C.pathN} path points (cap ${CHRON_PATH}) every ${C.pathEvery} s`); }   // the debrief's memory stays inside its caps however long the run (rows refused past the cap are counted, the path thins itself)
    // geometry overlap: a living guard noticeably inside a static (every 10th frame); the player's own 0.42 m movement circle more than 3 cm into one at the END of
    // any frame (what gets drawn — his collision is a sweep settled after the leaves and the furniture have moved him, so nothing should be left over)
    if (frame % 10 === 0) {
      for (const gd of game.guards) { if (gd.state === 'dead') continue; const q = v3.copy(gd.char.pos); if (col.collideCircle(q, 0.22, 0.3, 1.4, 1) && v3.distXZ(q, gd.char.pos) > 0.06) violate('in-geometry', routeName(gd), `guard ${routeName(gd)} ${v3.distXZ(q, gd.char.pos).toFixed(2)} m inside static geometry at ${p2(gd.char.pos)} (${gd.script ? 'scripted ' + game.clearingSummary() : gd.state})`); }
    }
    if (!pl.down) { const q = v3.copy(pl.char.pos); if (col.collideCircle(q, playerBodyR(game, pl.char.pos), 0.2, pl.crouch ? 1.0 : 1.7, 1) && v3.distXZ(q, pl.char.pos) > 0.03) violate('in-geometry', 'player', `player's circle ${v3.distXZ(q, pl.char.pos).toFixed(3)} m into static geometry at frame end at ${p2(pl.char.pos)} (crouch ${pl.crouch} sprint ${pl.sprinting} picking ${!!pl.picking} kick ${!!pl.kick} takedown ${!!pl.takedown} drag ${!!pl.dragging}; nearest guard ${Math.min(...living().map((g: any) => v3.distXZ(g.char.pos, pl.char.pos)), 99).toFixed(2)} m)`); }
    // ---- lane R5 (Sam's FN2000, docs/internal/sc20k-design.md §5 — player.ts / launcher.ts / weapons.ts Rifle): the rifle is drawn in exactly ONE place every frame —
    //      its eleven tagged boxes all off the hand or all across the back (their spread under half a metre), finite, owner-stamped, eleven of them whenever the kit
    //      has it (none only with no rifle, or a downed man whose rifle left his hands); its selector on one of the row's positions, the box and chamber in range,
    //      the reload inside its beat, the equip beat inside its length; braced exactly when it is in the hands and he neither sprints nor kicks (Player.braced is
    //      that rule); the attachment index inside its list; the rings a whole number 0‥5 that only ever FALLS within one life (bar the harness's own
    //      refill); the rings in the air finite, few, and young; a man a ring put down is out cold and breathing, never shot; Sam's suppression a number
    {
      const rf = pl.rifle; const D = rf.def; const rb = game.dynBoxes.filter((b: any) => b.name === SC20K_TAG);
      const wantBoxes = pl.hasRifle && !(pl.down && pl.rifleGone) ? (GEAR.on ? M4_BOXES : 11) : 0;
      const kitOn = KITANIM.on, magOut = kitOn && !!pl.char.anim.reloadShow?.out;   // (kitanim.ts: a magazine change shows the magazine OUT of the gun — one tagged box fewer for that long)
      if (rb.length !== wantBoxes && !(magOut && rb.length === wantBoxes - 1)) violate('rifle-boxes', 'player', `${rb.length} FN2000 boxes drawn (want ${wantBoxes}: hasRifle ${pl.hasRifle}, down ${pl.down}, gone ${pl.rifleGone}, slot ${pl.slot}, holstered ${pl.holstered})`);
      else if (rb.length) {
        if (!rb.every((b: any) => b.owner === (pl.char.id & 0xff) && [...b.c, ...b.h, ...(b.rot ?? [])].every(Number.isFinite))) violate('rifle-box-bad', 'player', 'an FN2000 box un-owned or non-finite');
        const mid = [0, 0, 0]; for (const b of rb) { mid[0] += b.c[0] / rb.length; mid[1] += b.c[1] / rb.length; mid[2] += b.c[2] / rb.length; }
        const spread = Math.max(...rb.map((b: any) => Math.hypot(b.c[0] - mid[0], b.c[1] - mid[1], b.c[2] - mid[2])));
        if (spread > 0.5) violate('rifle-two-places', 'player', `FN2000 boxes ${spread.toFixed(2)} m apart (slot ${pl.slot}, holstered ${pl.holstered}, rifleUp ${pl.rifleUp}, busy ${pl.char.anim.hideHeldItem}, dragging ${!!pl.dragging})`);
        const hand = pl.char.bones.handR, chest = pl.char.bones.chest;
        if (hand && chest && !pl.down) { const atHand = Math.hypot(mid[0] - hand[0], mid[1] - hand[1], mid[2] - hand[2]) < Math.hypot(mid[0] - chest[0] + pl.char.chestDir[0] * 0.2, mid[1] - chest[1], mid[2] - chest[2] + pl.char.chestDir[2] * 0.2); const wantHand = pl.rifleUp && !pl.char.anim.hideHeldItem;
          rifleWrongPlace = atHand !== wantHand && !(kitOn && pl.char.anim.kitHold !== undefined) ? rifleWrongPlace + 1 : 0;   // (…nor while a kit errand carries it between the two: kitanim.ts)   // (one frame's grace, as rifleAnimOff below: a grab dealt by direct call — the harness's grab-in-view, or updateDoors — lands AFTER the frame's rig was posed with the rifle up; the sling follows next update)
          if (rifleWrongPlace > 1) violate('rifle-wrong-place', 'player', `FN2000 drawn ${atHand ? 'in the hands' : 'on the back'} but rifleUp ${pl.rifleUp}, hideHeldItem ${pl.char.anim.hideHeldItem} (slot ${pl.slot}, holstered ${pl.holstered}, dragging ${!!pl.dragging}, holding ${!!pl.holding}, picking ${!!pl.picking})`);
          rifleAnimOff = pl.char.anim.longGun !== wantHand && !pl.picking ? rifleAnimOff + 1 : 0;   // (one frame's grace: a drag or a grab begins in updateDoors AFTER updatePlayer armed the animator this frame — the props follow at once, the arms next frame; picking: the hands go to the tools over a few frames and both sides key off hideHeldItem together)
          if (rifleAnimOff > 1) violate('rifle-anim', 'player', `animator longGun ${pl.char.anim.longGun} but the rifle ${wantHand ? 'is' : 'is not'} in the hands for ${rifleAnimOff} frames (slot ${pl.slot}, holstered ${pl.holstered}, dragging ${!!pl.dragging}, kick ${!!pl.kick}, takedown ${!!pl.takedown})`); }
      }
      if (!D.modes.includes(rf.mode)) violate('rifle-mode', 'player', `selector on '${rf.mode}' (row: ${D.modes.join('/')})`);
      if (rf.mag !== null && (rf.mag < 0 || rf.mag > D.magCapacity) || (rf.chamber !== 0 && rf.chamber !== 1) || rf.roundsReady > D.magCapacity + 1 || rf.spare.some((x: number) => x < 0 || x > D.magCapacity) || rf.spare.length > D.spareMags + 1) violate('rifle-mag-range', 'player', `rifle chamber ${rf.chamber} mag ${rf.mag} spare [${rf.spare.join(',')}]`);
      if (rf.reloadT > rf.reloadRow.dur + 1e-6) violate('rifle-reload-overrun', 'player', `rifle reloadT ${rf.reloadT.toFixed(3)} (dur ${rf.reloadRow.dur})`);   // (the beat this reload runs on: the row's, or a kit change's own — kitanim.ts)
      if (!Number.isFinite(pl.equipT) || pl.equipT < 0 || pl.equipT > Math.max(RIFLE_EQUIP_SECS, KITANIM.on ? kitLockMax(KIT) : 0) + 1e-6) violate('rifle-equipT', 'player', `equipT ${pl.equipT}`);   // (with the kit animations on a gun's lock-out is its swap's own length)
      bracedOffFrames = pl.braced !== (pl.rifleUp && !pl.sprinting && !pl.kick) ? bracedOffFrames + 1 : 0; if (bracedOffFrames > 0) violate('braced-rule', 'player', `braced ${pl.braced} with rifleUp ${pl.rifleUp} sprinting ${pl.sprinting} kick ${!!pl.kick} (slot ${pl.slot}, holstered ${pl.holstered}, dragging ${!!pl.dragging})`);
      if (!Number.isInteger(rf.attIdx) || rf.attIdx < -1 || rf.attIdx >= rf.attachments.length || (rf.attIdx >= 0) !== !!rf.attachment || (rf.attIdx < 0) !== !rf.attachments.length) violate('rifle-attachment', 'player', `attIdx ${rf.attIdx} of [${rf.attachments.join(',')}] → ${rf.attachment}`);
      if (pl.launchHeld !== null && (pl.launchHeld !== rf.attachment || !pl.hasRifle)) violate('rifle-launch-held', 'player', `launchHeld ${pl.launchHeld}, up ${rf.attachment}, rifle in the kit ${pl.hasRifle}`);
      if (!Number.isInteger(rf.rings) || rf.rings < 0 || rf.rings > LAUNCHER.rings) violate('rings-range', 'player', `rings ${rf.rings}`);
      if (ringBaseline && ringBaseline.pl === pl && rf.rings > ringBaseline.n) violate('rings-rose', 'player', `rings ${ringBaseline.n} → ${rf.rings} within one life (nothing on the floor is a ring you can have back)`);
      ringBaseline = { pl, n: rf.rings };
      if (!Number.isFinite(rf.ringCd) || rf.ringCd < 0 || rf.ringCd > Math.max(LAUNCHER.cd, LAUNCHER40.cd) + 1e-6) violate('ring-cd', 'player', `ringCd ${rf.ringCd}`);   // (one tube, one clock: the 40 mm's reload is the longer)
      if (!Number.isInteger(rf.shells) || rf.shells < 0 || rf.shells > LAUNCHER40.rounds + 1) violate('shells-range', 'player', `40 mm rounds ${rf.shells}`);
      if (game.shells.length > LAUNCHER40.rounds + 1) violate('shells-in-air', 'shells', `${game.shells.length} 40 mm rounds in flight`);
      for (const r of game.shells) { if (![...r.pos, ...r.vel].every(Number.isFinite) || !Number.isFinite(r.flown)) violate('nan', 'shell', `40 mm ${JSON.stringify({ pos: r.pos, vel: r.vel, flown: r.flown })}`); if (r.age > HE40.life + 2 * DT) violate('shell-old', 'shell', `a 40 mm round ${r.age.toFixed(2)} s in the air (life ${HE40.life})`); }
      const air = game.rings;
      if (air.length > LAUNCHER.rings + 2) violate('rings-in-air', 'rings', `${air.length} rings in flight`);
      for (const r of air) { if (![...r.pos, ...r.vel].every(Number.isFinite)) violate('nan', 'ring', `ring ${JSON.stringify({ pos: r.pos, vel: r.vel })}`); if (r.age > RING.life + 2 * DT) violate('ring-old', 'ring', `a ring ${r.age.toFixed(2)} s in the air (life ${RING.life})`); if (r.pos[1] < -0.5 || r.pos[1] > 12) violate('ring-astray', 'ring', `a ring at height ${r.pos[1].toFixed(1)}`); }
      if (air.length) smells.ringAirFrames = (smells.ringAirFrames ?? 0) + 1;
      for (const gd of game.guards) {   // a ring KO: the log names him the frame he drops ('ring to the head — X is out cold') — he must be struck, breathing, and never a corpse
        if (gd.state !== 'dead' || gd.diedAt !== t || ringKoSeen.has(gd)) continue;
        const byRing = game.messages.some((m: any) => m.t === t && m.text.startsWith('ring to the head') && m.text.includes(gd.callsign));
        if (byRing) { ringKoSeen.add(gd); smells.ringKOs = (smells.ringKOs ?? 0) + 1; if (gd.downKind !== 'struck' || !isBreathing(gd)) violate('ring-lethal', routeName(gd), `${routeName(gd)} put down by a ring is ${gd.downKind} / breathing ${isBreathing(gd)} — a ring is never lethal`); }
      }
      for (const gd of game.guards) if (gd.state !== 'dead' && gd.staggerUntil > t) { smells.staggerSeconds = Number(((smells.staggerSeconds ?? 0) + DT).toFixed(2)); if (gd.staggerUntil - t > Math.max(RING.stagger, FRAG.stagger[0]) + 1e-6) violate('stagger-long', routeName(gd), `${routeName(gd)} staggered for ${(gd.staggerUntil - t).toFixed(2)} s more (max ${Math.max(RING.stagger, FRAG.stagger[0])})`); }
      if (!Number.isFinite(pl.sup.v)) violate('sup-range', 'player', `Sam's suppression ${pl.sup.v}`);
      for (const e of game.events) if (e.kind === 'shot' && e.time === t && e.weapon === 'fn2000') { smells.rifleRounds = (smells.rifleRounds ?? 0) + 1; if (!pl.rifleUp && !pl.down && !(pl.holding)) { /* a scripted fireWeapon with the row named (the probes) — not the soak's */ } }
      if (pl.slot === 'rifle') smells.rifleSelectedSeconds = Number(((smells.rifleSelectedSeconds ?? 0) + DT).toFixed(2)); if (pl.rifleUp) smells.rifleUpSeconds = Number(((smells.rifleUpSeconds ?? 0) + DT).toFixed(2)); if (pl.braced) smells.bracedSeconds = Number(((smells.bracedSeconds ?? 0) + DT).toFixed(2));
    }
    // Sam's low whistle (whistle.ts): a man who ANSWERED one this frame (whistleMem.respondedAt stamped now) is suspicious or searching off it — never alert, never
    // over the radio, never a man in Sam's arm / under a script / with the AI off (their ears do not run) — and he is the ONLY one who did: one whistle, one man
    // (the cooldown keeps two whistles out of one frame). A head turned toward one is turned for glanceSecs at most. Smells: answers, searches, cues, glances,
    // whistles nobody could answer, and the module's own tallies per seed.
    {
      let answeredNow = 0; const who: string[] = [];
      for (const gd of game.guards) {
        const m = whistleMem(gd); if (!m) continue; const name = routeName(gd);
        if (m.respondedAt === t) {
          answeredNow++; who.push(name);
          const searched = gd.state === 'search';
          smells.whistleAnswers = (smells.whistleAnswers ?? 0) + 1; if (searched) smells.whistleSearches = (smells.whistleSearches ?? 0) + 1;
          if ((smells.whistleAnswers as number) <= 10) tl(`WHISTLE ${name} ${searched ? 'SEARCHES' : 'answers'} (${gd.state}, aw ${gd.awareness.toFixed(2)}) "${gd.bubble?.t === t ? gd.bubble.text : '—'}" from ${v3.distXZ(gd.char.pos, game.player.char.pos).toFixed(1)} m · fix ${p2(gd.lastKnown)}`);
          if (gd.state !== 'suspicious' && gd.state !== 'search') violate('whistle-answer-state', name, `${name} answered a whistle and is '${gd.state}' (aw ${gd.awareness.toFixed(2)}) — a whistle is a look or a search, never contact`);
          if (gd.held || gd.script || steppedAiOff) violate('whistle-answer-busy', name, `${name} answered a whistle while ${gd.held ? 'held' : gd.script ? 'scripted' : 'the AI was off'}`);
          if (gd.bubble?.radio && gd.bubble.t === t) violate('whistle-radio', name, `${name}'s answer "${gd.bubble.text}" went out over the net`);
          if (!gd.lastKnown) violate('whistle-no-fix', name, `${name} answered a whistle with no fix to walk to`);
        }
        if (m.glanceUntil > t + WHISTLE.glanceSecs + 1e-6) violate('whistle-glance-long', name, `${name}'s head is turned for ${(m.glanceUntil - t).toFixed(2)} s more (max ${WHISTLE.glanceSecs})`);
        if (!Number.isFinite(m.respondedAt) || m.responses < m.searches || m.responses < 0 || m.cues < 0 || m.glances < 0) violate('whistle-mem', name, `${name}'s whistle memory ${JSON.stringify(m)}`);
      }
      if (answeredNow > 1) violate('whistle-two-answers', who.join('+'), `${answeredNow} men answered one whistle this frame: ${who.join(', ')}`);
      if (whistleReadyIn(game) > WHISTLE.cooldown + 1e-6) violate('whistle-cooldown', 'player', `ready in ${whistleReadyIn(game).toFixed(2)} s (cooldown ${WHISTLE.cooldown})`);
      for (const e of game.events) if (e.kind === 'whistle' && e.time === t && (e.who !== PLAYER_ID || e.level !== WHISTLE.level || e.loud)) violate('whistle-event', 'player', `a whistle event ${JSON.stringify({ who: e.who, level: e.level, loud: e.loud })} (want Sam's, at the level, quiet)`);
    }
  }

  // -------- smells
  const smells: any = { noProgress: 0, playerDeaths: 0, guardDeaths: 0, bodiesFound: 0 };   // bodiesFound: men down whose body somebody FOUND (Guard.found going up — walked onto, watched dropping in a standoff, called in by a civilian), summed over the seed; against guardDeaths it is the share of bodies the floor ever learns of
  let wasDown = false; let lastDead = 0, lastFoundN = 0;

  // -------- main loop
  tl(`--- seed ${seed}: ${MINUTES} min @ ${HZ} Hz`);
  game.godMode = false; game.player.visibility = 0.05;
  for (frame = 0; frame < FRAMES; frame++) {
    const t = game.time;
    // scheduled stimuli (Poisson per stimulus; only the mild ones during a respite)
    const inRespite = t < respiteUntil;
    stimFrame = false;
    for (const s of stims) {
      if (rng() < s.perMin / 60 * DT && (!inRespite || s.mild) && (!s.when || s.when())) {
        stimCounts[s.name] = (stimCounts[s.name] ?? 0) + 1; stimFrame = true;
        let detail: string | null | void = null;
        try { detail = s.run(); } catch (e: any) { exceptions++; violate('exception', `stim:${s.name}`, `${e?.stack ?? e}`); }
        tl(`STIM ${s.name}${detail ? ': ' + detail : ''}`);
      }
    }
    // ongoing behaviours
    if (interruptAt > 0 && t >= interruptAt) { interruptAt = -1; if (game.clearing && game.clearing.stage !== 'done') { stimFrame = true; stimCounts['interrupt-clear(scheduled)'] = (stimCounts['interrupt-clear(scheduled)'] ?? 0) + 1; let d = ''; try { d = interruptClear(); } catch (e: any) { exceptions++; violate('exception', 'stim:interrupt-clear', `${e?.stack ?? e}`); } tl(`STIM interrupt-clear(scheduled): ${d}`); } }
    if (game.guards.some((g: any) => g.state === 'alert')) { if (alertSince < 0) alertSince = t; else if (t - alertSince > 30 && !inRespite) { alertSince = -1; startRespite(rr(45, 110), 'alert for 30 s — the player slips away'); } } else alertSince = -1;
    { const q = game.player.char.pos; if (!game.player.down && (q[0] < -0.3 || q[0] > 40.3 || q[2] < -0.3 || q[2] > 28.3)) { smells.playerLeftWorld = (smells.playerLeftWorld ?? 0) + 1; teleport([5.1, 0, 15.2], 'back from beyond the world edge'); } }
    if (aiOffUntil > 0 && t >= aiOffUntil) { game.aiEnabled = true; aiOffUntil = -1; tl('ai back on'); }
    if (tour && t >= tour.until) { stimFrame = true; const sv = tour.saved; game.quietUtility = false; game.aiEnabled = sv.ai; game.godMode = sv.god; game.playerInvisible = sv.invisible; game.clearAftermath(); game.resetGuards(); if (!game.player.down) { game.teleportPlayer(sv.pos); teleportedThisFrame = true; game.player.crouch = false; } tour = null; tl('tour-blip over (Demo.stop equivalent)'); }
    if (t >= godFlipAt) { game.godMode = !game.godMode; godFlipAt = t + rr(60, 300); tl(`godMode → ${game.godMode}`); }
    if (!loudDone && t >= LOUD_AT * 60 && !game.player.down && living().some((x: any) => !x.unit)) {   // lane qrf: Sam goes LOUD — the rifle up in the corridor a few metres off a living man of the shift, three level-1 rounds into the wall, and the floor at lockdown (two alarm episodes' worth, by hand): the response team is requested off the hearing model's own rule, and everything after is the game's
      loudDone = true; stimFrame = true; stimCounts['go-loud'] = (stimCounts['go-loud'] ?? 0) + 1;
      const gd = pick(living().filter((x: any) => !x.unit)) as any; const p = nearGuardPoint(gd, 3, 6, null) ?? [22, 0, 11.2];
      if (tour) { const sv = tour.saved; game.quietUtility = false; game.aiEnabled = sv.ai; game.playerInvisible = sv.invisible; game.clearAftermath(); game.resetGuards(); tour = null; }
      game.aiEnabled = true; aiOffUntil = -1; game.playerInvisible = false;
      teleport(p as Vec3, `to go loud beside ${routeName(gd)}`); game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
      for (let k = 0; k < 3; k++) fireWeapon(game, game.player.char, [p[0] + 6, 1.2, p[2] + 0.5], true);
      game.player.holstered = true;   // (slung again straight after: the schedule's direct-call stimuli — the takedown, the grab — assume the hands the default schedule leaves him, and the rifle's own paths are --rifle-per-min's to exercise)
      guardsMod.raiseEscalation(game, 2); qrfHoldOff = t + 180; respiteUntil = Math.min(respiteUntil, t);
      tl(`GO LOUD: three FN2000 rounds at (${p[0].toFixed(1)}, ${p[2].toFixed(1)}), floor → lockdown; resets held off till ${qrfHoldOff.toFixed(0)} s`);
    }
    if (!ckDone && saveMod2 && t >= CHECKPOINT_AT * 60 && t >= ckRetryAt) {   // --checkpoint-at: SAVE (forced) and LOAD straight back into this game; refused (a tour blip, Sam down, a unit) → try again in a second
      const why = saveMod2.canSave(game, true);
      if (why) { ckRetryAt = t + 1; if (Math.floor(t) % 15 === 0) tl(`checkpoint-at: waiting (${why})`); }
      else {
        ckDone = true; stimFrame = true; stimCounts['checkpoint-save-load'] = (stimCounts['checkpoint-save-load'] ?? 0) + 1;
        try { const st = saveMod2.saveState(game, { label: `soak ${seed} @ ${t.toFixed(0)} s`, kind: 'harness', force: true }); ckJson = JSON.stringify(st); saveMod2.loadState(game, JSON.parse(ckJson)); afterLoad('checkpoint-at'); ckReloadAt = game.time + 30;
          tl(`CHECKPOINT: saved ${(ckJson.length / 1024).toFixed(1)} KB (${st.guards.filter((x: any) => x.state === 'dead').length} bodies, ${st.items.length} items, ${st.decals.length} decals, ${st.chronicle.events.length} rows, esc ${st.escalation}${st.forced.length ? '; let go of ' + st.forced.join(', ') : ''}) and loaded back — the same file loads again at ${ckReloadAt.toFixed(0)} s`); }
        catch (e: any) { exceptions++; violate('exception', 'checkpoint-at', `${e?.stack ?? e}`); }
      }
    }
    if (ckJson && ckReloadAt > 0 && t >= ckReloadAt && !tour && !game.quietUtility) { ckReloadAt = -1; stimFrame = true; try { saveMod2.loadState(game, JSON.parse(ckJson)); afterLoad('checkpoint-at-reload'); tl('CHECKPOINT: the same file loaded a second time'); } catch (e: any) { exceptions++; violate('exception', 'checkpoint-reload', `${e?.stack ?? e}`); } }
    if (AIM_MODE === 'flip') { const want = Math.floor(t / 90) % 2 === 0; if (game.tune.aimModel !== want) { game.tune.aimModel = want; stimCounts['aim-model-flip'] = (stimCounts['aim-model-flip'] ?? 0) + 1; tl(`aim model → ${want ? 'on' : 'off'}`); } }   // (off the clock, not the dice: the rest of the schedule is untouched)
    if (t >= visUntil) { game.player.visibility = inRespite || rng() < 0.65 ? rr(0, 0.12) : rr(0.3, 1); visUntil = t + rr(3, 12); }
    if (holdF && t >= holdF.until) { input.keys.delete(IK); const running = game.player.picking === holdF.door || game.player.easing === holdF.door; if (running && !holdF.full) input.pressed.add(IK); tl(`${running && !holdF.full ? 'broke off (a Space tap)' : 'let be'} the ${game.player.easing === holdF.door ? 'ease' : 'pick'} on ${holdF.door.def.name}: locked=${holdF.door.locked} pick=${holdF.door.pick.toFixed(2)} angle=${holdF.door.angle.toFixed(2)}`); holdF = null; }
    if (gunSpaceUntil >= 0 && t >= gunSpaceUntil) { if (!holdF) input.keys.delete(IK); gunSpaceUntil = -1; tl('released the Space held over a dropped gun'); }
    if (cursorDoor) {   // the cursor on the leaf; once its rows are on offer (the frame after the teleport) tap the wanted one, once
      if (t >= cursorDoor.until) cursorDoor = null;
      else { W.cursorAt(cursorDoor.door.pos); if (!cursorDoor.pressed && game.nearby.some((r: any) => r.door === cursorDoor!.door) && game.selectVerb('door', cursorDoor.verb)) { input.pressed.add(IK); cursorDoor.pressed = true; tl(`tapped '${game.hover?.verb}' on ${cursorDoor.door.def.name}`); } }
    }
    else if (rackJob) {   // hands on the rack: cursor on its marker, one Space tap on its row once it is on offer, then hold still until the drive is out (or time is up)
      if (t >= rackJob.until || game.mission.stage !== 'drive' || game.player.down) { tl(`rack job over: stage ${game.mission.stage} pulled=${game.mission.pulled} driveT=${game.mission.driveT.toFixed(2)}`); rackJob = null; }
      else { W.cursorAt(level.mission.rack.front); if (!rackJob.pressed && game.selectVerb('objective', 'drive')) { input.pressed.add(IK); rackJob.pressed = true; } }
    }
    else if (frame % 30 === 0) { input.mouseX = rr(200, 1400); input.mouseY = rr(150, 850); }
    grabTick(); rifleTick();
    if (whistleAgainAt > 0 && t >= whistleAgainAt) { whistleAgainAt = -1; if (!game.player.down) { input.pressed.add('KeyV'); tl(`V again (${whistleReadyIn(game) > 0 ? `inside the cooldown, ${whistleReadyIn(game).toFixed(1)} s to go: nothing should sound` : 'the twice rule\'s chance'})`); } }
    missionSeen[game.mission.stage] = (missionSeen[game.mission.stage] ?? 0) + DT;
    if (!holdF && !game.player.picking && !game.player.kick && !game.player.easing && t >= wander.until) {
      for (const k of wander.keys) input.keys.delete(k);
      const r = rng();
      if (r < 0.45 || inRespite) wander = { until: t + rr(1, 6), keys: [] };
      else { const keys = [pick(['KeyW', 'KeyS', 'KeyA', 'KeyD'])]; if (rng() < 0.4) keys.push(pick(['KeyW', 'KeyS', 'KeyA', 'KeyD'])); if (rng() < 0.25) keys.push('ShiftLeft'); else if (rng() < 0.15) input.pressed.add('KeyC'); wander = { until: t + rr(0.8, 3.5), keys }; }
      for (const k of wander.keys) input.keys.add(k);
      if (rng() < 0.3) { input.pressed.add('KeyQ'); qPresses++; }   // back to the wall (or off it) wherever he happens to be: with the wander keys held he sidles, walks off it, or sprints off it
    }
    if (game.player.wall) wallTime += DT;
    let enterCk = false;   // a bare Enter with a checkpoint of this run stored goes back to IT (game/savestate.ts) — judged as a load below, not as a restart
    if (game.player.down) { if (downSince < 0) downSince = t; if (t - downSince > rr(8, 25)) { const nw = game.saves?.newest?.(); const shift = !saveMod2 || rng() < 0.5 || !nw || nw.runId !== game.saves.runId; input.pressed.add('Enter'); if (shift) input.keys.add('ShiftLeft'); else enterCk = true; downSince = -1; restartCheck = shift ? { source: 'Shift+Enter after down' } : null; tl(shift ? 'press Shift+Enter (restart after down)' : `press Enter (down, a checkpoint of this run stored: '${nw.label}')`); } } else downSince = -1;
    // the civilian grab job: a question every couple of seconds until the dealt count, then the dealt end — 'stay down' (comply: she is let go, cowering) or the choke (down, priced) — or nothing more (kept)
    if (civGrabJob) {
      const J = civGrabJob, H = game.player.holding;
      if (!H || H.g !== J.cv) { const how = J.cv.state === 'dead' ? `down (${J.cv.downKind})` : J.cv.civ.state; const key = `civGrabEnds:${how === 'cower' && J.cv.civ.complied ? 'complied' : how === 'held' ? 'cut' : how}`; smells[key] = (smells[key] ?? 0) + 1; civGrabJob = null; }   // ('cut': the hold ended from outside — a teleporting stimulus, Sam down, a reset — before her own update saw it)
      else if (H.phase === 'held' && t >= J.nextAt) {
        if (J.asked < 3 && H.variant === 'arm') { game.selectVerb('held', 'question'); input.pressed.add(IK); J.asked++; J.nextAt = t + rr(1.2, 2.2); smells.civQuestions = (smells.civQuestions ?? 0) + 1; }
        else if (J.end === 'comply') { game.selectVerb('held', 'comply'); input.pressed.add(IK); J.nextAt = t + 5; }
        else if (J.end === 'choke') { game.selectVerb('held', H.variant === 'gun' ? 'whip' : 'choke'); input.pressed.add(IK); J.nextAt = t + 8; }
        else J.nextAt = t + 30;   // 'questions': asked, and kept — whatever else ends it (a teleport, Sam down, a reset)
      }
    }
    // the frame
    const missionBefore = game.mission;
    steppedAiOff = !game.aiEnabled;   // (the stimuli above may have switched it either way; nothing inside the step does)
    heldGoingIn = game.player.holding?.g ?? null; downGoingIn = game.player.down;
    if (steppedAiOff) { witnessSnap.clear(); for (const gd of game.guards) witnessSnap.set(gd, JSON.stringify(gd.witness)); }   // what every witness record holds going INTO an AI-off frame (invariants: it must come out the same)
    if (TRACE) { const [who, a, b] = TRACE.split(':'); LINE_DEBUG.log = who !== 'player' && game.time >= +a - DT && game.time <= +b ? (gd: any, s: string) => fullLog.push(`${game.time.toFixed(3)}s f${frame}   LINE ${routeName(gd)}: ${s}`) : null; AIM_DEBUG.log = LINE_DEBUG.log ? (s: string) => fullLog.push(`${game.time.toFixed(3)}s f${frame}   AIM ${s}`) : null; }   // (+ the aim model's own log through the same window: track resets, bearing jumps, out-of-sight drops)   // the alert branch's footwork round a colleague in the line, for every man, while the traced window is open (guards.ts LINE_DEBUG)
    const loads0 = game.saves?.stats?.loads ?? 0; savedThisFrame.length = 0;
    try { W.step(DT); consecutiveExc = 0; }
    catch (e: any) { exceptions++; consecutiveExc++; violate('exception', String(e?.message ?? e).slice(0, 80), `${e?.stack ?? e}`); if (consecutiveExc > 120) { tl('ABORT: update throws every frame'); break; } }
    if (enterCk) { input.keys.delete('ShiftLeft'); if ((game.saves?.stats?.loads ?? 0) > loads0) { tl('  → the checkpoint loaded'); afterLoad('Enter-after-down'); } else if (game.mission !== missionBefore) tl('  → no load (refused / gone): restarted'); }
    else input.keys.delete('ShiftLeft');
    if (game.mission !== missionBefore) { missionRef = game.mission; stageIdx = 0; teleportedThisFrame = true; if (restartCheck) { /* restarted inside updatePlayer: guards have been stepped once since */ restartCheck = null; game.godMode = rng() < 0.4; if (game.escalation !== 0 || game.clearing || game.guards.some((g: any) => g.script || g.state !== 'patrol') || doors.list.some((d: any) => d.lockBroken || d.locked !== !!d.def.locked)) violate('restart-restore', 'Enter-path', `after Enter restart: ${game.escalationSummary()} clearing=${!!game.clearing} guards=${game.guards.map((g: any) => g.state + (g.script ? '+script' : '')).join('/')} doors=${dump().doors}`); } }
    // bookkeeping
    try { invariants(); } catch (e: any) { exceptions++; violate('exception', 'invariants', `${e?.stack ?? e}`); }
    if (game.escalation !== lastEsc) { escChanges++; tl(`ESC ${lastEsc} → ${game.escalation}: ${game.escalationSummary()}`); lastEsc = game.escalation; }
    if (TRACE) { const [who, a, b, every] = TRACE.split(':'); if (game.time >= +a && game.time <= +b && frame % Math.max(1, Math.round(every ? +every : HZ / 4)) === 0) {
      if (who === 'player') { const pl = game.player, w = pl.wall; fullLog.push(`${game.time.toFixed(3)}s f${frame} TRACE ${JSON.stringify({ pos: p2(pl.char.pos), vel: p2(pl.char.vel), crouch: pl.crouch, sprint: pl.sprinting, keys: [...input.keys].join(''), wall: w ? { u: f2(w.u), v: f2(w.v), off: f2(w.off), settle: f2(w.settle), from: p2(w.from), n: p2(w.n), d: f2(w.d) } : null, guards: game.guards.filter((x: any) => x.state !== 'dead').map((x: any) => `${routeName(x)}@${p2(x.char.pos)} ${f2(v3.distXZ(x.char.pos, pl.char.pos))}m`) })}`); }   // (the player's own line: chasing a pop / a wall-hold oddity)
      else { const gd = game.guards.find((x: any) => routeName(x) === who); if (gd) fullLog.push(`${game.time.toFixed(3)}s f${frame} TRACE ${JSON.stringify({ pos3: [+gd.char.pos[0].toFixed(3), +gd.char.pos[2].toFixed(3)], player3: [+game.player.char.pos[0].toFixed(3), +game.player.char.pos[2].toFixed(3)], others3: game.guards.filter((x: any) => x !== gd && x.state !== 'dead').map((x: any) => `${routeName(x)}@${x.char.pos[0].toFixed(3)},${x.char.pos[2].toFixed(3)}`), ...dump().guards.find((x: any) => x.name === who), doors: dump().doors })}`); }
    } }
    if (game.player.down && !wasDown) { smells.playerDeaths++; tl('player down'); } wasDown = game.player.down;
    { const dead = game.guards.filter((g: any) => g.state === 'dead').length; if (dead > lastDead) smells.guardDeaths += dead - lastDead; lastDead = dead; }
    { const found = game.guards.filter((g: any) => g.state === 'dead' && g.found).length; if (found > lastFoundN) smells.bodiesFound += found - lastFoundN; lastFoundN = found; }   // (a restart empties the floor: the count drops and is followed from there)
    escTime[game.escalation] += DT;
    for (const gd of game.guards) {
      const key = gd.script ? (game.clearing ? 'scripted-clear' : 'scripted') : gd.state; stateTime[key] = (stateTime[key] ?? 0) + DT;
      const ref = gd.path; if (ref !== lastPathRef.get(gd)) { lastPathRef.set(gd, ref); if (ref.length) { replans++; const w = replanWindow.get(gd) ?? []; w.push(game.time); while (w.length && game.time - w[0] > 1) w.shift(); replanWindow.set(gd, w); if (w.length > maxReplansPerSec) { maxReplansPerSec = w.length; maxReplansWho = `${routeName(gd)} @ ${game.time.toFixed(1)}s (${gd.script ? 'scripted ' + (game.clearingSummary() || '') : gd.state})`; } } }
    }
    if (game.clearing !== lastClearingRef) {
      if (game.clearing) {
        clearsStarted++; tl(`CLEAR started: ${game.clearingSummary()}`);
        // most clears get a quiet floor to work on; ~60 % of those get exactly one interrupt at a moment uniform over the whole job (so late phases get hit too)
        if (rng() < 0.75) { startRespite(rr(70, 140), 'let the clear run'); interruptAt = rng() < 0.6 ? game.time + rr(2, 110) : -1; if (interruptAt > 0) tl(`(interrupt scheduled at ${interruptAt.toFixed(0)} s)`); }
      }
      lastClearingRef = game.clearing;
    }
    if (frame % (HZ * 60) === 0 && frame > 0 && QUIET) console.log(`  [seed ${seed}] ${(frame / HZ / 60).toFixed(0)} min sim, ${((performance.now() - t0wall) / 1000).toFixed(0)} s wall, ${violations.length} violations logged, esc ${game.escalation}, guards ${game.guards.map((g: any) => g.state[0] + (g.script ? 's' : '')).join('')}`);
  }
  clearTap = null; roomTap = null;
  const simSeconds = frame * DT; const mins = simSeconds / 60;
  const guardMinutes = Object.values(stateTime).reduce((a, b) => a + b, 0) / 60;
  Object.assign(smells, {
    barksTotal: barkLog.length, barksPerMin: f2(barkLog.length / mins), barkRepeatsWithin5s: barkRepeats,
    topBarks: Object.entries(barkTexts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${n}× ${k}`),
    hudMessagesPerMin: f2(msgCount / mins),
    replansTotal: replans, replansPerGuardSecond: f2(replans / Math.max(1, guardMinutes * 60)), maxReplansInOneSecond: maxReplansPerSec, maxReplansWho,
    clearsStarted, clearOutcomes, clearEndPhases: clearInterruptPhases, roomEnds, interruptsFiredAtPhase: interruptPhases,
    escalationTimeShare: { calm: f2(escTime[0] / simSeconds), heightened: f2(escTime[1] / simSeconds), lockdown: f2(escTime[2] / simSeconds) }, escalationChanges: escChanges,
    guardStateTimeShare: Object.fromEntries(Object.entries(stateTime).map(([k, v]) => [k, f2(v / (guardMinutes * 60))])),
    missionStageSeconds: Object.fromEntries(Object.entries(missionSeen).map(([k, v]) => [k, Math.round(v)])), debriefs: smells.debriefs ?? 0,
    wallQPresses: qPresses, wallSecondsHeld: Math.round(wallTime), grabEnds, holdEnds,   // holdEnds: chokes / whips dealt vs the ones that put him down vs holds that went from under a dealt end (cut: Sam shot, a teleporting stimulus, time up) — dealt = completed + cut + any 'stuck', or an end vanished silently
    unstickLegs: UNSTICK.legs - unstick0.legs, unstickSnaps: UNSTICK.snaps - unstick0.snaps,   // guards.ts un-stick: side-steps off a stranded nav cell begun this run (a hold ending in a nook, mostly) / times it had to stand a man on a free cell outright (should stay 0: each is also a timeline line)
    whistleStats: Object.fromEntries(Object.keys(WHISTLE_STATS).map(k => [k, (WHISTLE_STATS as Record<string, number>)[k] - (whistle0 as Record<string, number>)[k]])),   // whistle.ts: whistles blown this seed, resolved against the floor, men reached, answered (of which searched), hunting men cued, heads turned, whistles nobody could answer
    tacticsStats: Object.fromEntries(Object.keys(TACTICS_STATS).map(k => [k, TACTICS_STATS[k] - ((tactics0 as Record<string, number>)[k] ?? 0)])),
    needsStats: Object.fromEntries(Object.keys(NEEDS_STATS).map(k => [k, NEEDS_STATS[k] - ((needs0 as Record<string, number>)[k] ?? 0)])),   // needs.ts: men dealt, trips scheduled (of which sent), departures, arrivals, completed, cancelled, radioed vs told to a partner, replies, legs given up stuck   // tactics.ts: flanking plans dealt / re-dealt, flankers and second pressers, goes (and how many on the timeout), arrivals, lone holds / calls / releases, doorways marked dangerous, gates, summons, bangs, slices, entries (alone), re-routes
    civStats: Object.fromEntries(Object.keys(CIV_STATS).map(k => [k, CIV_STATS[k] - ((civ0 as Record<string, number>)[k] ?? 0)])), civStateSeconds: Object.fromEntries(Object.entries(civStateTime).map(([k, v]) => [k, Math.round(v)])),   // civilians.ts: startles / frights / runs / reports / calls / cowers / complies / KOs / kills / found / evacuated / greetings — and seconds per state summed over both
    walkInAtDangerDoor: smells.walkInAtDangerDoor ?? 0,   // must stay 0: a man through a live kill-zone doorway of his side's without the drill
    checkpoints: game.saves ? { autosaves: game.saves.stats.autosaves, requests: game.saves.stats.requests, dropped: game.saves.stats.dropped, refused: game.saves.stats.refused, loads: ckLoads, storedAtEnd: game.saves.slots().length } : null,   // game/savestate.ts: what the run wrote by itself (and asked for / let lapse / was refused), the loads this seed made (--checkpoint-at, the stimulus, Enter after down)
    audioTop: [...W.audioCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k} ${n}`),
    finalState: dump(),
  });
  if (LOG_DIR) await Bun.write(`${LOG_DIR}/soak-seed${seed}.log`, fullLog.join('\n') + '\n');
  return { seed, frames: frame, simSeconds: f2(simSeconds), wallSeconds: f2((performance.now() - t0wall) / 1000), exceptions, violations, violationCounts: vCounts, smells, stimuli: stimCounts, timelineTail: timeline.slice(-40) };
}

// ---------------------------------------------------------------- run all seeds
const reports: SeedReport[] = [];
for (const s of SEEDS) {
  console.log(`\n=== seed ${s} ===`);
  const r = await runSeed(s);
  reports.push(r);
  console.log(`--- seed ${s} done: ${r.frames} frames (${(r.simSeconds / 60).toFixed(1)} sim-min) in ${r.wallSeconds} s wall; exceptions ${r.exceptions}; violation kinds ${JSON.stringify(r.violationCounts)}`);
  console.log(`    stimuli: ${JSON.stringify(r.stimuli)}`);
  console.log(`    smells: ${JSON.stringify({ ...r.smells, finalState: undefined, topBarks: undefined, audioTop: undefined })}`);
  console.log(`    top barks: ${(r.smells.topBarks as string[]).join(' | ')}`);
}
console.log('\n=== summary ===');
const total: Record<string, number> = {};
for (const r of reports) for (const [k, n] of Object.entries(r.violationCounts)) total[k] = (total[k] ?? 0) + n;
console.log('violation counts across seeds:', JSON.stringify(total));
console.log('first report of each kind|key:');
const seen = new Set<string>();
for (const r of reports) for (const v of r.violations) { const k = `${v.kind}|${v.key}`; if (seen.has(k)) continue; seen.add(k); console.log(`  seed ${v.seed} f${v.frame} ${v.time}s ${v.kind} (${v.key}): ${v.msg.split('\n')[0].slice(0, 300)}`); }
if (JSON_OUT) { await Bun.write(JSON_OUT, JSON.stringify(reports, null, 1)); console.log(`wrote ${JSON_OUT}`); }
// The exit code is the verdict (review T4.4): any exception or invariant violation on any seed = 1. Smells are reported, never failed on.
{ const nExc = reports.reduce((s, r) => s + r.exceptions, 0), nViol = reports.reduce((s, r) => s + r.violations.length, 0);
  console.log(`\n=== soak: ${nExc || nViol ? `FAIL — ${nExc} exception(s), ${nViol} violation(s) across ${reports.length} seed(s)` : `ALL PASS — no exceptions, no violations across ${reports.length} seed(s)`} ===`);
  process.exitCode = nExc || nViol ? 1 : 0; }

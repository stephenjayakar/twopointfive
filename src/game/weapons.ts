// Weapons as data (docs/internal/sc20k-design.md §2, lane R0). Every firearm on the floor is a row of WEAPONS — what it is called, what it holds, how fast it
// cycles, how it reloads, what its report does to the hearing model and the mixer, what its muzzle shows, how a guard's hands spread it, what it does to loose
// furniture and to a man, where its muzzle and its light sit, what draws it, and what falls out of a dying hand — and a Firearm is one such row being carried:
// chamber + detachable magazines + spares and the staged reload (mag out → fullest spare in → rack if empty). Three rows are in play: Sam's suppressed Five-seveN
// and the guards' 9 mm reproduce, number for number, what the code used to spell out in place (tools/qa/weapons-probes.ts froze those numbers first); the
// guards' AKS-74U-style carbine (docs/internal/sc20k-design.md §3, lane R2) is dealt over a man's sidearm row by the sandbox knob (game.ts tune.carbineGuards):
// short bursts, a 30-round box, the harder report, the rifle that tumbles out of a dying hand; Sam's FN2000 (§5, lane R5) is his second Firearm (game.ts
// Player.rifle, kit slot 2 — a Rifle: the row plus its light switch, its selector on Z, its attachments and the rings left), a row any Character may be handed like the
// others. The AK variants for another setting are rows too, switched off (`enabled: false`, nothing may carry one yet).
// Who reads a row: combat.ts fireWeapon (flash card, light gain, voice, event level, prop kick, a guard's spread) and killGuard / hitPlayer (what leaves the hand);
// guards.ts (cadence, the burst trigger, magazine, the reload beat); player.ts (cadence, the FN2000's AUTO string); ui/overlay.ts (the kit column's name and
// pips); game.ts (who carries which row, Character.muzzleAhead).
import type { Vec3 } from '../math/vec';
import type { MuzzleFxKey } from './effects';
import { GEAR, GEAR_NAMES, GEAR_MAG } from './gear';   // (a leaf: the issue kit's switch — read only inside the getters of Sam's two rows below, never as this module loads)

export type WeaponId = 'fiveseven' | 'guard9mm' | 'aks74u' | 'ak74m' | 'akms' | 'fn2000' | 'm870' | 'mk12' | 'mp7' | 'mk46' | 'm1014' | 'hk45' | 'g18';
export type FireMode = 'semi' | 'auto' | 'burst';
export type WeaponClass = 'pistol' | 'carbine' | 'rifle' | 'shotgun';
/** what leaves a dying (or downed) hand that held it: a throwables.ts ItemKind (combat.ts dropFromHand) — 'rifle' has no body of its own until R2 gives it one */
export type DropKind = 'pistol' | 'rifle';
/** A GUARD's hands on it (combat.ts fireWeapon): ± half of ( base + min(moveCap, Sam's ground speed · moveK) + max(0, range − rangeFrom) · rangeK ) per axis on the unit
 *  direction — wider at a man moving fast or far off, so the first rounds tend to go wide and then they settle. Sam's own rounds go where they are sent. */
export interface AiSpread { base: number; moveK: number; moveCap: number; rangeFrom: number; rangeK: number; }
/** Guard AI bursts (guards.ts burstTrigger; null on a pistol = single shots): rounds per trigger pull (min‥max, drawn per burst off the game's dice), seconds between
 *  them inside the burst (0.1 = 600 rpm: one round every 6 frames at 60 Hz, so each flash owns its frames), the gap drawn after it (gapMin‥gapMax), and how the
 *  cone opens round by round — the first round of a burst at the row's aiSpread, each one after it + spreadPerRound more, that growth capped at spreadCap; a new
 *  burst starts tight again. */
export interface BurstSpec { min: number; max: number; interval: number; gapMin: number; gapMax: number; spreadPerRound: number; spreadCap: number; }
/** A guard's burst in progress (Firearm.burst, driven by guards.ts burstTrigger): rounds still to go of the `n` drawn, seconds to the next, the index of the next
 *  round in this burst (the spread's k), the game time of the last frame the trigger serviced it (a burst nobody serviced last frame — he lost his line, went to
 *  the standoff, was grabbed — is over: no round of it leaks out later), and `off`: the world offset laid on the aim point for the whole burst when it is the
 *  deliberately wide opening burst (suppressFirst) — null for an aimed one. */
export interface BurstState { left: number; n: number; nextT: number; idx: number; t: number; off: Vec3 | null; }
/** Automatic fire under a HELD trigger (the FN2000's AUTO, docs/internal/sc20k-design.md §5 + the maintainer's Z note: "we'll want a way for even the SC20K to be
 *  full auto for suppression" — player.ts reads it for Sam; an operative or a guard handed an fn2000-pattern row may read the same numbers): seconds between rounds
 *  while the trigger stays down (0.1 = 600 rpm, one round every 6th frame at 60 Hz), how much wider each successive round of one held string is drawn
 *  (+ spreadPerRound per round already gone, capped at spreadCap — the guards' burst cone, in the player's hands), and how long after the trigger comes up the
 *  string is forgotten and the next round is a first round again. null on a row that has no automatic sear (the pistols; the guards' AKs fire theirs as BURSTS). */
export interface AutoSpec { interval: number; spreadPerRound: number; spreadCap: number; resetAfter: number; }
/** Streaks (R6 reads it; null = none): every Nth round and the last N of a magazine, in this colour */
export interface TracerSpec { every: number; lastN: number; color: Vec3; }
/** A SHELL OF SHOT (shotgun.ts fireShell; absent on every other row = one round a pull, the fire path exactly as it was): `n` pellets a pull, each a real round
 *  through combat.ts fireWeapon — the first down the bore as the hands hold it, the rest drawn evenly over a disc `cone` (tan of its half angle) round that. What
 *  a pellet does to a man is by the PATTERN, never by a count kept on him: inside `dropM` any one pellet of it puts him down (the whole charge is still a fist
 *  wide); past it he goes down only to `need` or more pellets of ONE shell, and a man caught by fewer is peppered — doubled over a second and a half, alert, on
 *  his feet (launcher.ts staggerGuard). Nothing is remembered from one shell to the next.
 *  `breach` (absent: nothing): what the same shell does to a door's lock — `need` or more pellets into a latched leaf within `latchM` of its latch edge, from a muzzle within
 *  `reachM` of where they land, and the keep is gone and the leaf goes in (doors.ts kickIn: a steel door rings and holds, as it does under a boot). */
export interface PelletSpec { n: number; cone: number; dropM: number; need: number; breach?: { reachM: number; latchM: number; need: number }; }   // (no `breach`: a shell of it opens no lock, and the man who carries it is nobody's door breacher — the M1014)

export interface WeaponDef {
  id: WeaponId;
  /** in play. A false row is data only: Firearm refuses to construct it (the lane that lands its voice / muzzle block / item body flips it) */
  enabled: boolean;
  /** the full name (Firearm.name), the kit column's label, the calibre as printed */
  name: string; short: string; calibre: string;
  /** rig group + pose family (a pistol in one hand; the long guns want the two-handed solve of R1) */
  cls: WeaponClass;
  /** rounds a magazine holds; full spares carried at spawn (Infinity = it never runs dry — the guards: their reload is a beat, not logistics) */
  magCapacity: number; spareMags: number;
  /** carried topped up — a full magazine AND one up the pipe (Sam's 10+1) — or with the chambered round racked out of the magazine (a guard's twelve, all told).
   *  Firearm's constructor and rearm() load it this way, and the staged reload never seats more over a chambered round (Firearm.magRoom). */
  topUp: boolean;
  /** the staged reload, seconds from the R press (Firearm.update): magazine out (an empty drops to the floor, a partial goes back to storage), the fullest spare
   *  in, the slide racked if the chamber was empty, done. A row that gives only `dur` does everything at the end (the guards' beat: 1.7 s of nothing, then full). */
  reload: { dur: number; out?: number; in_?: number; rack?: number };
  /** the sear positions the selector offers, in the order Z cycles them (Firearm.mode starts on the first): 'semi' one round a pull, 'auto' rounds at `auto.interval`
   *  while it is held (needs `auto`), 'burst' the guard AI's trigger (needs `burst`) */
  modes: FireMode[];
  /** seconds the trigger is dead after a round (+ up to `cdJitter` more, drawn per round: the guard AI's 0.55–1.05) */
  cd: number; cdJitter: number;
  burst: BurstSpec | null;
  auto: AutoSpec | null;
  /** the report as the FLOOR hears it — GameEvent level / loud (guards.ts hearingCheck: level ≥ 1 is gunfire, an 80 m straight-line gate = every man indoors and
   *  on the lot goes to high alert; the suppressor buys ambiguity about where, not whether) — and as the mixer plays it (an audio/sfx.ts voice; the guards' rows
   *  to come name voices sfx.ts grows in their lanes) */
  report: { level: number; loud: boolean; voice: string };
  /** suppressed (a can or integrally): the muzzle light is × effects.ts shot.suppressedGain, and the dropped item is drawn with its can (throwables 'pistol' fill 1) */
  suppressed: boolean;
  /** the visible flame + the flash's light gain: a key into effects.ts muzzleFx (authored numbers stay in effects.ts) */
  muzzleFx: MuzzleFxKey;
  /** N·s handed to loose furniture the round stops in (exaggerated over the real round so it reads: cartons hop, chairs twitch and roll) */
  propImpulse: number;
  aiSpread: AiSpread;
  /** how a hit resolves: 'oneShot' — any round that finds a man puts him down (combat.ts killGuard; hitPlayer with Player.MAX_HITS 1). The only model there is,
   *  named so a row cannot quietly mean anything else. */
  damage: 'oneShot';
  /** the muzzle sits this far along the gun axis from the wrist (Character.muzzleAhead: the round, the flash, the laser and armThrough all start there) */
  muzzleAhead: number;
  /** the rigProps group that draws it in the hand: 'pistol' = RIG.pistol (slide, grip, can, rail light), 'guardPistol' = RIG.guardPistol (slide, grip, weapon-light
   *  lens); the long guns' groups arrive with R1 ('carbine') and R5 ('sc20k' — the FN2000's; the rig group keeps the name it was authored under) */
  rig: 'pistol' | 'guardPistol' | 'carbine' | 'sc20k';
  /** HANDLING — how readily it comes round in the hands, 1 = a pistol, lower = longer / heavier (the turn weight: character.ts TURN scales the top rate and the
   *  acceleration of a man's muzzle by it, and half of it his body's). Optional: a row without one takes its class's (handlingOf, below). Never a damage number. */
  handling?: number;
  /** where its light rides: the rail under the Five-seveN / a guard's weapon light in the lens slot, the carbine's on the handguard, none */
  light: 'rail' | 'handguard' | 'none';
  drop: DropKind;
  tracer: TracerSpec | null;
  /** a shotgun: every pull is a shell of this many pellets (PelletSpec) — absent: a single round */
  pellets?: PelletSpec;
  /** YOUR hands on a long gun (player.ts rifleSpread): what this row does to RIFLE_SPREAD's cone standing still, on the move, and crouched (× the common
   *  crouch factor) — absent: 1 each, the FN2000's own hands. The reach a gun has in your hands; a teammate's and a defender's is `aiSpread`. */
  hands?: { still: number; moving: number; crouch?: number };
  /** false: nothing rides under its barrel (Rifle: no ring launcher, no 40 mm, no camera tube) — absent: the FN2000's launcher, as every long gun of yours had */
  launcher?: false;
  /** what it weighs loaded, kilograms, and how much of it there is to hide and to get through a door with (0 a pistol … 4 a belt-fed gun): DATA for the kit's
   *  mobility and concealment score — nothing in this file reads them */
  weightKg: number; bulk: number;
}

/** The service-pistol spread every guard's hands have had since the first firefight (combat.ts fireWeapon's old literal line): 0.05 + min(0.06, v·0.014) + max(0, range − 8)·0.006. */
const AI_PISTOL_SPREAD: AiSpread = { base: 0.05, moveK: 0.014, moveCap: 0.06, rangeFrom: 8, rangeK: 0.006 };

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // Sam's sidearm — every number here is one the code used to carry in place: the Pistol class (10-round magazines, 10+1 and three spares, the 1.6 s reload staged
  // at 0.38 / 1.02 / 1.38), player.ts (0.22 s between rounds), combat.ts fireWeapon (the small dim flash card, the light at × suppressedGain, 'pistolSuppressed',
  // a 'shot' event at level 1, 4 N·s into a carton), hitPlayer (the gun leaves his hand drawn with its can), Character (muzzle 0.26 ahead of the wrist).
  fiveseven: {
    id: 'fiveseven', enabled: true, cls: 'pistol',
    // (gear.ts: the 2010s issue kit renames Sam's two rows where they are READ — every number below is the row's, whichever name it wears, but the magazine's size)
    get name() { return GEAR.on ? GEAR_NAMES.pistolLong : 'FN Five-seveN (suppressed)'; }, get short() { return GEAR.on ? GEAR_NAMES.pistol : 'Five-seveN'; }, get calibre() { return GEAR.on ? GEAR_NAMES.pistolCalibre : '5.7×28 mm'; },
    get magCapacity() { return GEAR.on ? GEAR_MAG.pistol : 10; },   // (the issue kit's Glock holds fifteen, in the gun and in each spare: the maintainer's balance call, the one number the kit changes — read when a gun is loaded, reloaded or drawn on the HUD)
    spareMags: 3, topUp: true, reload: { dur: 1.6, out: 0.38, in_: 1.02, rack: 1.38 },
    modes: ['semi'], cd: 0.22, cdJitter: 0, burst: null, auto: null,
    report: { level: 0.6, loud: false, voice: 'pistolSuppressed' }, suppressed: true, muzzleFx: 'pistolSuppressed', propImpulse: 4,   // (level < 1: an odd noise nearby — a look, suspicion — never 'that was a shot' (guards.ts hearingCheck); the FN2000 keeps level 1: a 5.56, suppressed or not, is unmistakable. Tab ▸ Sandbox has the sliders)
    aiSpread: AI_PISTOL_SPREAD, damage: 'oneShot', muzzleAhead: 0.26, rig: 'pistol', light: 'rail', drop: 'pistol', tracer: null,
    weightKg: 0.9, bulk: 0,
  },
  // The guards' 9 mm — was never modelled at all: Guard.shots counted to 12 and reloadT counted 1.7 s down (guards.ts, both fire sites), the alert branch drew
  // 0.55–1.05 s between rounds, fireWeapon took the loud branch of every `isPlayer ?` (the big bright card, full light, 'pistolLoud', 'guardShot', 6 N·s) and its
  // spread line, killGuard dropped a plain 'pistol'. Bottomless spares: they never run dry, the reload is the beat.
  guard9mm: {
    id: 'guard9mm', enabled: true, name: '9 mm service pistol', short: 'sidearm', calibre: '9×19 mm', cls: 'pistol',
    magCapacity: 12, spareMags: Infinity, topUp: false, reload: { dur: 1.7 },
    modes: ['semi'], cd: 0.55, cdJitter: 0.5, burst: null, auto: null,
    report: { level: 1, loud: true, voice: 'pistolLoud' }, suppressed: false, muzzleFx: 'pistolBare', propImpulse: 6,
    aiSpread: AI_PISTOL_SPREAD, damage: 'oneShot', muzzleAhead: 0.26, rig: 'guardPistol', light: 'rail', drop: 'pistol', tracer: null,
    weightKg: 0.95, bulk: 0,
  },
  // AKS-74U-pattern carbine (5.45×39, 206 mm barrel): the guards' long gun (docs/internal/sc20k-design.md §3), dealt over a man's sidearm row by game.ts
  // tune.carbineGuards ('none' by default: nobody carries it and the floor is exactly what it was). 600 rpm so each flash owns its frames; 2–4 round bursts
  // 0.9–1.6 s apart (guards.ts burstTrigger), the cone opening +0.03 a round; a shouldered long gun beats a pistol at arm's length (base 0.035); thirty to a box
  // and 2.6 s standing there changing it, the empty clattering down at 0.7 s (guards.ts tickReloadBeat → a 'mag' item drawn as the long bakelite box); the report
  // is 'carbineReport' (sfx.ts: pistolLoud's recipe, harder and an octave lower, a longer slap) at level 1 like every gun (finding 1: louder has nowhere to go, and
  // the maintainer said fine); the flame and the light are effects.ts muzzleFx.carbine (twice the bare pistol's card, × 1.7 the light over 10 m — UNTUNED, viewer
  // pass); a dying hand lets the whole rifle go (throwables 'rifle'). RIG.carbine and the long-gun poses are R1's; tracers are R6's to read.
  aks74u: {
    id: 'aks74u', enabled: true, name: 'AKS-74U carbine', short: 'AKS-74U', calibre: '5.45×39 mm', cls: 'carbine',
    magCapacity: 30, spareMags: Infinity, topUp: false, reload: { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 },
    modes: ['auto', 'semi'], cd: 0.1, cdJitter: 0, burst: { min: 2, max: 4, interval: 0.1, gapMin: 0.9, gapMax: 1.6, spreadPerRound: 0.03, spreadCap: 0.16 }, auto: null,
    report: { level: 1, loud: true, voice: 'carbineReport' }, suppressed: false, muzzleFx: 'carbine', propImpulse: 6,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.035 }, damage: 'oneShot', muzzleAhead: 0.50, rig: 'carbine', light: 'handguard', drop: 'rifle',
    tracer: { every: 3, lastN: 3, color: [1.0, 0.42, 0.12] },
    weightKg: 3.0, bulk: 2,
  },
  // Sam's FN2000 (5.56 bullpup, integrally suppressed — "okay if it's not materially louder than the pistol", per the maintainer and per canon; docs/internal/
  // sc20k-design.md §5, lane R5): 30+1 topped up like the Five-seveN and two spare thirties he manages the same way (the empty clatters down out of the well behind
  // the grip at 0.5 s of the 2.4 s reload, player.ts); the selector SEMI (one round a click, 0.2 s dead after it) or AUTO on Z (600 rpm under a held trigger, each
  // round of a held string 0.012 rad wider than the last up to 0.08 — thirty rounds in three seconds, and every one of them puts a man's head down like a pistol
  // round does: suppression.ts noteRound off combat.ts fireWeapon, whatever fired it); level 1 like every gun (finding 1) in its own voice ('rifleSuppressed',
  // sfx.ts: the pistol's thwip with a deeper thump, the action's clack and a longer hiss); the flame and the light are effects.ts muzzleFx.sc20k (a can's worth
  // more flame than the pistol's, × suppressedGain like it — UNTUNED, the viewer's K fires it for grading); Sam's own hands spread it (player.ts RIFLE_SPREAD:
  // still / moving / crouched / braced on the foregrip), aiSpread is for the operative or the guard who is handed one later (a shouldered long gun: the carbine's
  // base); the muzzle 0.52 out along the bore off the drawn prop (rigProps.sc20kMuzzleAhead agrees); its own weapon light on the fore-end (L); down with it in
  // his hands the whole rifle leaves them (throwables 'rifle' with fill 1: the bullpup's own item body). RIG.sc20k draws it in the hands and slung across his back.
  fn2000: {
    id: 'fn2000', enabled: true, get name() { return GEAR.on ? GEAR_NAMES.rifleLong : 'FN2000 (suppressed)'; }, get short() { return GEAR.on ? GEAR_NAMES.rifle : 'FN2000'; }, calibre: '5.56×45 mm', cls: 'rifle',
    magCapacity: 30, spareMags: 2, topUp: true, reload: { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 },
    modes: ['semi', 'auto'], cd: 0.2, cdJitter: 0, burst: null, auto: { interval: 0.1, spreadPerRound: 0.012, spreadCap: 0.08, resetAfter: 0.25 },
    report: { level: 1, loud: true, voice: 'rifleSuppressed' }, suppressed: true, muzzleFx: 'sc20k', propImpulse: 5,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.035 }, damage: 'oneShot', muzzleAhead: 0.52, rig: 'sc20k', light: 'handguard', drop: 'rifle', tracer: null,
    handling: 0.8,   // (a bullpup: a rifle's weight held in close — it comes round nearly like the carbine)
    weightKg: 3.9, bulk: 2,
  },
  // The squad's breaching shotgun (gear, 10-08: a Remington 870-pattern pump, short barrel, stand-off muzzle device) — a row a teammate's loadout card hands him
  // in place of his rifle (kit.ts 'shotgun') and that you may bring in place of the FN2000 (kit slot 2, the same keys). Six in the tube and one up the pipe, a
  // pump's 0.9 s between shells (roomfight.ts keeps an operative's controlled pairs to it), 3.2 s thumbing a tube full back in (one beat: nothing drops out of a
  // tube gun); bare and LOUD — level 1 like every long gun; nine pellets a shell over a wide disc (PelletSpec: tan 0.06 — a metre across at eight metres, wider than
  // a real cylinder bore throws so the fall-off happens inside this floor's rooms and corridors: UNTUNED, a call left on the gear page), any pellet a man's end
  // inside 8 m, four of one shell past it, two metres' reach on a lock. It is carried and drawn as the carbine (rig 'carbine': the long-gun carriage, its light on
  // the handguard — NOT YET A MODEL OF ITS OWN: a teammate's looks like the carbine, yours like the FN2000) and speaks with the carbine's report until somebody with ears gives it
  // its own. Nothing carries one unless a card says so.
  m870: {
    id: 'm870', enabled: true, name: 'M870 breaching shotgun', short: 'M870', calibre: '12 gauge', cls: 'shotgun',
    magCapacity: 6, spareMags: 3, topUp: true, reload: { dur: 3.2, out: 0.4, in_: 2.5, rack: 2.9 },
    modes: ['semi'], cd: 0.9, cdJitter: 0.2, burst: null, auto: null,
    report: { level: 1, loud: true, voice: 'carbineReport' }, suppressed: false, muzzleFx: 'carbine', propImpulse: 2,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.035 }, damage: 'oneShot', muzzleAhead: 0.50, rig: 'carbine', light: 'handguard', drop: 'rifle', tracer: null,
    pellets: { n: 9, cone: 0.06, dropM: 8, need: 4, breach: { reachM: 2, latchM: 0.5, need: 4 } },
    weightKg: 3.4, bulk: 3,
  },
  // ---- THE GUNS A CARD'S TWO SLOTS OFFER BESIDE THE ISSUE PAIR (gunslots.ts PICKS; the maintainer, 10-18: "should we model more firearms?"). Each is set apart
  // by something felt in play — reach, who hears it, how it comes round, how long it runs and how long it takes to feed — and NEVER by what a round does to a
  // man (damage 'oneShot', every row). Nothing constructs one unless a card picks it. Every one of them is drawn and heard as a gun the game already has (its
  // rig, voice and muzzleFx name the stand-in): a model, a report and a reload of its own are owed to each. UNTUNED: nobody has fired one on a GPU.
  // Mk 12 SPR-pattern (5.56, the long barrel, a can, a magnified sight): REACH. Semi only and a slower cadence, twenty to a magazine, tight in the hands
  // standing still (hands.still) and in a teammate's (aiSpread: half the carbine's base, the fall-off starting twice as far out) — and it comes round like the
  // long thing it is (handling 0.62), opens up badly on the move, and has nothing under its barrel.
  mk12: {
    id: 'mk12', enabled: true, name: 'Mk 12 SPR (suppressed)', short: 'Mk 12', calibre: '5.56×45 mm', cls: 'rifle',
    magCapacity: 20, spareMags: 3, topUp: true, reload: { dur: 2.6, out: 0.55, in_: 1.65, rack: 2.2 },
    modes: ['semi'], cd: 0.3, cdJitter: 0.15, burst: null, auto: null,
    report: { level: 1, loud: true, voice: 'rifleSuppressed' }, suppressed: true, muzzleFx: 'sc20k', propImpulse: 5,
    aiSpread: { base: 0.018, moveK: 0.02, moveCap: 0.08, rangeFrom: 16, rangeK: 0.003 }, damage: 'oneShot', muzzleAhead: 0.52, rig: 'sc20k', light: 'handguard', drop: 'rifle', tracer: null,
    handling: 0.62, hands: { still: 0.45, moving: 1.4 }, launcher: false, weightKg: 5.0, bulk: 3,
  },
  // MP7-pattern (4.6×30, a can): QUIET AND QUICK. The one long gun the floor does not hear as gunfire (level 0.8: an odd noise, heard a third farther off than
  // the suppressed pistol's 0.6), forty to a magazine at 900 a minute, in the hands like a pistol (handling 0.95) and the steadiest thing there is on the move
  // — and past a room's length its group is gone (hands.still 1.6; aiSpread opens from 7 m at twice the carbine's rate). Nothing under its barrel.
  mp7: {
    id: 'mp7', enabled: true, name: 'MP7A1 (suppressed)', short: 'MP7', calibre: '4.6×30 mm', cls: 'carbine',
    magCapacity: 40, spareMags: 3, topUp: true, reload: { dur: 2.0, out: 0.4, in_: 1.25, rack: 1.65 },
    modes: ['auto', 'semi'], cd: 0.12, cdJitter: 0, burst: { min: 2, max: 4, interval: 4 / 60, gapMin: 0.5, gapMax: 0.9, spreadPerRound: 0.02, spreadCap: 0.12 }, auto: { interval: 4 / 60, spreadPerRound: 0.008, spreadCap: 0.07, resetAfter: 0.25 },
    report: { level: 0.8, loud: false, voice: 'pistolSuppressed' }, suppressed: true, muzzleFx: 'pistolSuppressed', propImpulse: 3,
    aiSpread: { base: 0.045, moveK: 0.008, moveCap: 0.03, rangeFrom: 7, rangeK: 0.012 }, damage: 'oneShot', muzzleAhead: 0.40, rig: 'sc20k', light: 'handguard', drop: 'rifle', tracer: null,
    handling: 0.95, hands: { still: 1.6, moving: 0.7 }, launcher: false, weightKg: 2.3, bulk: 1,
  },
  // Mk 46-pattern light machine gun (5.56, a hundred on the belt): VOLUME. It runs three times as long as a magazine and a string of it barely opens — a lane
  // held, heads kept down (suppression.ts counts its rounds like any) — and everything else about it is the price: half a pistol's turn (handling 0.5), a wide
  // cone on the feet that only closes kneeling (hands.crouch), six seconds standing there with the feed cover up, one spare belt, bare and loud with a red
  // tracer every fifth round, no launcher.
  mk46: {
    id: 'mk46', enabled: true, name: 'Mk 46 light machine gun', short: 'Mk 46', calibre: '5.56×45 mm', cls: 'rifle',
    magCapacity: 100, spareMags: 1, topUp: true, reload: { dur: 6.0, out: 1.2, in_: 4.4, rack: 5.4 },
    modes: ['auto'], cd: 5 / 60, cdJitter: 0, burst: { min: 5, max: 9, interval: 5 / 60, gapMin: 0.5, gapMax: 1.0, spreadPerRound: 0.012, spreadCap: 0.14 }, auto: { interval: 5 / 60, spreadPerRound: 0.004, spreadCap: 0.06, resetAfter: 0.3 },
    report: { level: 1, loud: true, voice: 'carbineReport' }, suppressed: false, muzzleFx: 'carbine', propImpulse: 6,
    aiSpread: { base: 0.05, moveK: 0.03, moveCap: 0.12, rangeFrom: 10, rangeK: 0.004 }, damage: 'oneShot', muzzleAhead: 0.52, rig: 'sc20k', light: 'none', drop: 'rifle',
    tracer: { every: 5, lastN: 0, color: [1.0, 0.25, 0.12] },
    handling: 0.5, hands: { still: 1.5, moving: 2.4, crouch: 0.5 }, launcher: false, weightKg: 8.0, bulk: 4,
  },
  // M1014-pattern (a gas-operated 12 gauge): THE ROOM. A fighting shotgun, not the big slot's door tool — seven in the tube as fast as the trigger is pulled
  // (0.28 s where the pump takes 0.9), a tighter pattern that carries a man's end two metres farther (dropM 10) — and it opens no lock (no `breach`: the
  // door tools never pick its man for the gun), feeds a shell at a time, is loud, and past the yard's width is a peppering.
  m1014: {
    id: 'm1014', enabled: true, name: 'M1014 shotgun', short: 'M1014', calibre: '12 gauge', cls: 'shotgun',
    magCapacity: 7, spareMags: 3, topUp: true, reload: { dur: 3.6, out: 0.4, in_: 2.9, rack: 3.3 },
    modes: ['semi'], cd: 0.28, cdJitter: 0.1, burst: null, auto: null,
    report: { level: 1, loud: true, voice: 'carbineReport' }, suppressed: false, muzzleFx: 'carbine', propImpulse: 2,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.035 }, damage: 'oneShot', muzzleAhead: 0.50, rig: 'carbine', light: 'handguard', drop: 'rifle', tracer: null,
    pellets: { n: 9, cone: 0.045, dropM: 10, need: 4 },
    handling: 0.72, launcher: false, weightKg: 3.9, bulk: 3,
  },
  // HK45-pattern (.45, subsonic, a can): THE QUIETEST GUN. Heard three quarters as far as the issue pistol (level 0.45 against 0.6) — and eight to a magazine
  // where that holds ten or fifteen, a slower hand between rounds.
  hk45: {
    id: 'hk45', enabled: true, name: 'HK45 (suppressed)', short: 'HK45', calibre: '.45 ACP', cls: 'pistol',
    magCapacity: 8, spareMags: 3, topUp: true, reload: { dur: 1.7, out: 0.4, in_: 1.1, rack: 1.45 },
    modes: ['semi'], cd: 0.3, cdJitter: 0, burst: null, auto: null,
    report: { level: 0.45, loud: false, voice: 'pistolSuppressed' }, suppressed: true, muzzleFx: 'pistolSuppressed', propImpulse: 5,
    aiSpread: AI_PISTOL_SPREAD, damage: 'oneShot', muzzleAhead: 0.26, rig: 'pistol', light: 'rail', drop: 'pistol', tracer: null,
    weightKg: 1.2, bulk: 0,
  },
  // Glock 18-pattern (9 mm, the long magazine, no can): A FIGHT IN THE HOLSTER. Thirty-three rounds at 1200 a minute under a held trigger — the sidearm that
  // finishes a room when the long gun is dry — and it is loud like any bare gun, climbs fast (the string's cone is twice the carbine's), and gives up
  // everything the suppressed pistol is for.
  g18: {
    id: 'g18', enabled: true, name: 'Glock 18', short: 'Glock 18', calibre: '9×19 mm', cls: 'pistol',
    magCapacity: 33, spareMags: 2, topUp: true, reload: { dur: 1.8, out: 0.4, in_: 1.15, rack: 1.5 },
    modes: ['auto', 'semi'], cd: 0.2, cdJitter: 0, burst: { min: 3, max: 5, interval: 3 / 60, gapMin: 0.5, gapMax: 0.9, spreadPerRound: 0.03, spreadCap: 0.18 }, auto: { interval: 3 / 60, spreadPerRound: 0.02, spreadCap: 0.16, resetAfter: 0.25 },
    report: { level: 1, loud: true, voice: 'pistolLoud' }, suppressed: false, muzzleFx: 'pistolBare', propImpulse: 6,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.06 }, damage: 'oneShot', muzzleAhead: 0.26, rig: 'guardPistol', light: 'rail', drop: 'pistol', tracer: null,
    weightKg: 1.0, bulk: 0,
  },
  // ---- switched off: rows from the design (§2 / §3), nothing constructs them. Each names what its lane still owes it. ----
  // AK-74M-pattern rifle (415 mm barrel, brake): tighter, a smaller flash than the shorty (doc: light gain 1.1 — its own muzzleFx block when a setting wants it).
  ak74m: {
    id: 'ak74m', enabled: false, name: 'AK-74M rifle', short: 'AK-74M', calibre: '5.45×39 mm', cls: 'rifle',
    magCapacity: 30, spareMags: Infinity, topUp: false, reload: { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 },
    modes: ['auto', 'semi'], cd: 0.1, cdJitter: 0, burst: { min: 2, max: 4, interval: 0.1, gapMin: 0.9, gapMax: 1.6, spreadPerRound: 0.025, spreadCap: 0.16 }, auto: null,
    report: { level: 1, loud: true, voice: 'carbineReport' }, suppressed: false, muzzleFx: 'carbine' /* stand-in: doc gain 1.1 */, propImpulse: 6,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.03 }, damage: 'oneShot', muzzleAhead: 0.66, rig: 'carbine', light: 'handguard', drop: 'rifle',
    tracer: { every: 3, lastN: 3, color: [1.0, 0.42, 0.12] },
    weightKg: 3.6, bulk: 3,
  },
  // AKMS-pattern (7.62×39): heavier report ('carbineHeavy'), looser, opens faster. Same debts.
  akms: {
    id: 'akms', enabled: false, name: 'AKMS rifle', short: 'AKMS', calibre: '7.62×39 mm', cls: 'rifle',
    magCapacity: 30, spareMags: Infinity, topUp: false, reload: { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 },
    modes: ['auto', 'semi'], cd: 0.1, cdJitter: 0, burst: { min: 2, max: 3, interval: 0.1, gapMin: 0.9, gapMax: 1.6, spreadPerRound: 0.04, spreadCap: 0.16 }, auto: null,
    report: { level: 1, loud: true, voice: 'carbineHeavy' }, suppressed: false, muzzleFx: 'pistolBare' /* stand-in: doc gain 1.3 */, propImpulse: 6,
    aiSpread: { ...AI_PISTOL_SPREAD, base: 0.04 }, damage: 'oneShot', muzzleAhead: 0.62, rig: 'carbine', light: 'none', drop: 'rifle', tracer: null,
    weightKg: 3.5, bulk: 3,
  },
};

/** The ring-airfoil launcher's numbers (docs/internal/sc20k-design.md §5; launcher.ts flies them): how many Sam brings (spent, never retrieved — no scavenging of
 *  anything), and the seconds the launcher takes to hand-cycle between two rings. The rest of the ring — its speed, its arc, what a head or a hip does with it —
 *  lives with its flight in launcher.ts RING. */
export const LAUNCHER = { rings: 5, cd: 0.9 };
/** The 40 mm high-explosive round out of the same tube (he40.ts flies it and sets it off through frag.ts's blast): how many he brings (spent for good), and the
 *  seconds it takes to break the tube, seat the next round and close it — the ring's hand-cycle clock (Rifle.ringCd: there is one tube) set to this after a round. */
export const LAUNCHER40 = { rounds: 3, cd: 2.6 };
/** a row's handling (WeaponDef.handling), or its class's: a pistol 1, a short carbine 0.82, a full rifle 0.7 */
export const HANDLING_BY_CLASS: Record<WeaponClass, number> = { pistol: 1, carbine: 0.82, rifle: 0.7, shotgun: 0.75 };
/** THE one place the turn weight reads what a man carries (game.ts deals it to `Character.turn.h` every frame): the row's own `handling`, else its class's, else a
 *  carbine's (a row cast into a class this table has not met: a new WeaponClass must add its row here, tsc says so). */
export function handlingOf(def: WeaponDef): number { return def.handling ?? HANDLING_BY_CLASS[def.cls] ?? HANDLING_BY_CLASS.carbine; }

/** Callbacks for the beats of the staged reload (player.ts plays the foley and drops the empty on them). */
export interface ReloadEvents { magOut?(rounds: number, dropped: boolean): void; magIn?(rounds: number): void; rack?(): void; done?(): void; }

/** One weapon being carried: its row, a chamber, the seated magazine, the spares, and the staged reload. */
export class Firearm {
  chamber = 1;                       // 0 | 1
  infinite = false;                  // sandbox: the magazine never runs dry (rounds are still cycled so cadence / animation / smoke stay the same)
  mag: number | null;                // rounds in the seated magazine (null = no magazine)
  spare: number[];                   // rounds per spare magazine ("storage") — empty for a bottomless row
  reloadT = -1;                      // seconds into the reload, -1 = idle
  private stage = 0;                 // 0 nothing done, 1 mag out, 2 mag in, 3 racked
  private ev: ReloadEvents = {};
  /** this reload's own beat, when whoever started it handed one (startReload's `beat`: a tactical change keeps the old magazine and takes longer over it, an
   *  empty gun's is the quick one — game/kitanim.ts); null = the row's, as ever */
  private beat: WeaponDef['reload'] | null = null;
  /** the beat the reload under way (or the next plain one) runs on */
  get reloadRow(): WeaponDef['reload'] { return this.beat ?? this.def.reload; }
  shotsFired = 0;
  /** a guard's burst in progress (guards.ts burstTrigger; only ever non-null on a row with a BurstSpec) — see BurstState */
  burst: BurstState | null = null;
  /** bursts this gun has let go, and the game time the last one ended (-100 = never): the deliberately wide OPENING burst of an engagement (guards.ts, tune.suppressFirst)
   *  is the first one, or the first after SUPPRESS_FIRST_LAPSE quiet seconds — a man who lost Sam and finds him again minutes later opens wide again */
  bursts = 0; lastBurstT = -100;
  /** the selector: one of the row's `modes` (Z cycles it, cycleMode; a property of the WEAPON — it stays where it was put whether the gun is in the hands or slung) */
  mode: FireMode;
  /** the held-trigger string in AUTO (player.ts fires it off def.auto): rounds already gone in this string — the next is drawn (spreadPerRound × this) wider, capped —
   *  and the seconds since its last round (past auto.resetAfter with the trigger up the string is over and the count goes back to nought: autoIdle) */
  autoIdx = 0; autoSince = 0;

  constructor(readonly def: WeaponDef) {
    if (!def.enabled) throw new Error(`weapons: '${def.id}' is a data-only row (docs/internal/sc20k-design.md §10) — nothing may carry it until its lane switches it on`);
    this.mag = def.magCapacity - (def.topUp ? 0 : 1);
    this.spare = this.bottomless ? [] : Array.from({ length: def.spareMags }, () => def.magCapacity);
    this.mode = def.modes[0];
  }
  get name() { return this.def.name; }
  /** Z: the selector to its next position (SEMI → AUTO → SEMI on the FN2000); a one-position row just says what it is. Ends any AUTO string. Returns the new mode. */
  cycleMode(): FireMode { const M = this.def.modes; this.mode = M[(M.indexOf(this.mode) + 1) % M.length]; this.autoIdx = 0; return this.mode; }
  /** automatic under a held trigger right now: the selector on AUTO and the row has the sear for it */
  get automatic() { return this.mode === 'auto' && !!this.def.auto; }
  /** the extra cone the NEXT round of the current AUTO string is drawn with (0 for its first round, or in SEMI) */
  get autoSpread() { const A = this.def.auto; return A && this.mode === 'auto' ? Math.min(A.spreadCap, A.spreadPerRound * this.autoIdx) : 0; }
  /** book one round of the string (player.ts, after fire()) / let the string lapse once the trigger has been up auto.resetAfter (called every frame with the trigger's state) */
  autoFired() { this.autoIdx++; this.autoSince = 0; }
  autoIdle(dt: number, triggerDown: boolean) { this.autoSince += dt; if (!triggerDown && this.autoSince > (this.def.auto?.resetAfter ?? 0)) this.autoIdx = 0; }
  /** never runs out of spares (the guards): a reload always has a full magazine to seat */
  get bottomless() { return !Number.isFinite(this.def.spareMags); }
  get reloading() { return this.reloadT >= 0; }
  get roundsReady() { return this.chamber + (this.mag ?? 0); }
  /** rounds gone since the gun was last full — what Guard.shots used to count (twelve and he reloads; nought again once he has) */
  get spent() { return this.def.magCapacity + (this.def.topUp ? 1 : 0) - this.roundsReady; }
  canFire() { return (this.chamber === 1 || (this.infinite && this.mag !== null)) && !this.reloading; }   // (infinite: a dry gun comes back to life when the toggle goes on)
  /** Fullest-first view of the spare mags (for the HUD). */
  spareSorted() { return [...this.spare].sort((a, b) => b - a); }

  fire(): boolean {
    if (!this.canFire()) return false;
    this.chamber = 0; this.shotsFired++;
    if (this.infinite && this.mag !== null) this.chamber = 1;                          // bottomless magazine: always feeds, never empties
    else if (this.mag !== null && this.mag > 0) { this.mag--; this.chamber = 1; }   // slide cycles a fresh round
    return true;
  }

  /** the most a seated magazine may hold right now by the row's rule (rearm's): all of it on a topped-up row (Sam's 10 under the one up the pipe), one short of it
   *  while a round is chambered on a row that racks its chambered round OUT of the magazine (a guard's twelve all told, never thirteen) */
  get magRoom() { return this.def.magCapacity - (this.def.topUp ? 0 : this.chamber); }
  /** Begin a reload if it makes sense (have a spare that improves things). Returns false if refused. */
  startReload(ev: ReloadEvents = {}, beat?: WeaponDef['reload']): boolean {
    if (this.reloading) return false;
    if (this.spare.length === 0 && !this.bottomless) return false;
    const best = Math.min(this.spare.length ? Math.max(...this.spare) : this.def.magCapacity, this.magRoom);
    if (this.mag !== null && this.mag >= best && this.chamber === 1) return false;   // nothing to gain
    this.reloadT = 0; this.stage = 0; this.ev = ev; this.beat = beat ?? null;
    return true;
  }
  cancelReload() { this.reloadT = -1; this.stage = 0; this.beat = null; }
  /** A full magazine seated and a round chambered (the row's way: topped up or racked out of it), any reload or burst forgotten — how a guard's reload beat ends
   *  (guards.ts) and how the QA probes stand a man up with a fresh gun. */
  rearm() { this.cancelReload(); this.burst = null; this.autoIdx = 0; this.chamber = 1; this.mag = this.def.magCapacity - (this.def.topUp ? 0 : 1); }
  /** no magazine holding more than the row's magazine does NOW — for a row whose size is read off a switch (gear.ts: Sam's pistol, 15 under the issue kit, 10
   *  without): thrown off on a running game, the rounds over are put away. Nothing where everything fits, so a row whose size never moves is never touched. */
  fit() { const cap = this.def.magCapacity; if (this.mag !== null && this.mag > this.magRoom) this.mag = this.magRoom; for (let i = 0; i < this.spare.length; i++) if (this.spare[i] > cap) this.spare[i] = cap; }

  update(dt: number) {
    if (!this.reloading) return;
    this.reloadT += dt;
    const t = this.reloadT, R = this.beat ?? this.def.reload;
    if (this.stage < 1 && t >= (R.out ?? R.dur)) {
      // magazine out: empties are dropped on the floor, partials go back to storage (nothing to do if the well is already empty,
      // e.g. a reload that was cancelled by sprinting after the old magazine came out)
      if (this.mag !== null) {
        const out = this.mag; const dropped = out === 0;
        if (!dropped && !this.bottomless) this.spare.push(out);
        this.mag = null; this.ev.magOut?.(out, dropped);
      }
      this.stage = 1;
    }
    if (this.stage < 2 && t >= (R.in_ ?? R.dur)) {
      // fullest spare goes in (a bottomless row always has a full one to hand) — holding no more than the row's rule allows over a chambered round (magRoom: a
      // non-topUp row reloaded with one up the pipe seats one short, exactly what rearm() loads, instead of a thirteenth round and a negative `spent`; the round
      // it cannot seat goes back to storage on a row that counts its spares — none does today, every non-topUp row is bottomless)
      let got: number;
      if (this.spare.length) { let bi = 0; for (let i = 1; i < this.spare.length; i++) if (this.spare[i] > this.spare[bi]) bi = i; got = this.spare.splice(bi, 1)[0] ?? 0; }
      else got = this.bottomless ? this.def.magCapacity : 0;
      this.mag = Math.min(got, this.magRoom);
      if (got > this.mag && !this.bottomless) this.spare.push(got - this.mag);
      this.stage = 2; this.ev.magIn?.(this.mag);
    }
    if (this.stage < 3 && t >= (R.rack ?? R.dur)) {
      if (this.chamber === 0 && this.mag !== null && this.mag > 0) { this.mag--; this.chamber = 1; this.ev.rack?.(); }
      this.stage = 3;
    }
    if (t >= R.dur) { this.reloadT = -1; this.stage = 0; this.beat = null; this.ev.done?.(); }
  }
}

/** Sam's sidearm: the Five-seveN row plus the rail light's switch (L). Every `pl.pistol.*` site reads this. */
export class Pistol extends Firearm {
  lightOn = false;
  constructor(def: WeaponDef = WEAPONS.fiveseven) { super(def); }   // (gunslots.ts: the sidearm your card's secondary slot picks)
}

/** What rides under the FN2000's fore-end for the RIGHT button to fire (the left always fires rounds): the launcher's loads — the ring airfoil and the 40 mm
 *  grenade; the list leaves room for the rest of Chaos Theory's launcher menu (sticky camera, sticky shocker, gas) without another flag apiece. */
export type RifleAttachment = 'ring' | 'he40' | 'cam';   // ('cam': a sticky camera out of the same tube — stickycam.ts; on a rifle's list only once a card or a mission has issued him one)
/** Sam's FN2000 (game.ts Player.rifle, kit slot 2): the fn2000 row being carried, its fore-end light's switch (L with it in the hands), and its attachments —
 *  `attachments` = what this rifle has bolted on (in the order its slot digit steps them), `attIdx` = the one UP on the right button: ALWAYS one of them on a
 *  rifle that has any — there is no 'nothing' to step through in a fight, the digit pressed again flips to the next and round again (−1 only with nothing under
 *  the barrel: the shotgun) —, `rings` left of the LAUNCHER.rings he brought (spent, not retrievable), `ringCd` the seconds the launcher takes
 *  to hand-cycle before the next may go. The selector (Z: SEMI / AUTO) is the Firearm's own `mode`; rounds are always on the left button whatever is up. */
export class Rifle extends Firearm {
  lightOn = false;
  readonly attachments: RifleAttachment[] = ['ring', 'he40'];
  attIdx = 0;
  rings = LAUNCHER.rings; ringCd = 0;
  /** 40 mm high-explosive rounds left of the LAUNCHER40.rounds he brought (the 'he40' attachment: he40.ts) */
  shells = LAUNCHER40.rounds;
  /** sticky cameras left for the tube (stickycam.ts: 0 on every rifle until stickyIssue hands him some — and then 'cam' is the third load 2 steps to) */
  cams = 0;
  constructor(def: WeaponDef = WEAPONS.fn2000) { super(def); if (def.pellets || def.launcher === false) { this.attachments.length = 0; this.attIdx = -1; this.rings = 0; this.shells = 0; } }   // (the breaching shotgun in the rifle's slot — kit.ts: no launcher under its barrel)
  /** the attachment the right button fires now (null: nothing under this barrel) */
  get attachment(): RifleAttachment | null { return this.attIdx >= 0 ? this.attachments[this.attIdx] ?? null : null; }
  /** rounds left of an attachment */
  left(a: RifleAttachment): number { return a === 'ring' ? this.rings : a === 'cam' ? this.cams : this.shells; }
  /** its slot digit pressed again with it in the hands (player.ts): the next attachment goes on the right button, the last back to the first — ring ⇄ 40 mm.
   *  Returns what is up now. */
  cycleAttachment(): RifleAttachment | null { const n = this.attachments.length; this.attIdx = n ? (this.attIdx + 1) % n : -1; return this.attachment; }
}

/** OCP: pistol-mounted emitter that knocks out electronics briefly; recharges. */
export class Ocp {
  charge = 1; readonly rechargePerSec = 0.28; readonly cost = 1;
  ready() { return this.charge >= this.cost - 1e-3; }
  use(): boolean { if (!this.ready()) return false; this.charge = 0; return true; }
  update(dt: number) { this.charge = Math.min(1, this.charge + dt * this.rechargePerSec); }
}

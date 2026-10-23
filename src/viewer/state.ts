// The viewer's one state object (window.__viewer) and the vocabularies its scenes, sheets and the runtime share. Everything a scene variant can
// configure lives here as plain fields, so a variant is a declarative patch over BASE (scenes.ts) and the property sheet binds rows straight to it.
import { Vec3, DEG } from '../math/vec';
import { AnimParams, UpperMode, Stance, HoldPhase, HoldVariant } from '../game/character';

// the game's character tints (game.ts Player / Guard) so the props read against the right suit
export const PLAYER_TINT = { tint: [0.05, 0.06, 0.07] as Vec3, tint2: [0.1, 0.32, 0.18] as Vec3 };
export const GUARD_TINT = { tint: [0.42, 0.36, 0.25] as Vec3, tint2: [0.02, 0.02, 0.025] as Vec3 };
export const CHAR_ID = 1;   // = PLAYER_ID: the rail light / torch are owned by the character so its own capsules never shadow them

/** upper-body layer choices (character.ts UpperMode); 'shoot' = aim + a round every 0.6 s */
export const UPPERS: { name: string; mode: UpperMode; autoFire: boolean }[] = [
  { name: 'none (arms follow legs)', mode: 'none', autoFire: false },
  { name: 'relaxed (pistol idle, two-hand)', mode: 'relaxed', autoFire: false },
  { name: 'aim (two-hand, pitch blend)', mode: 'aim', autoFire: false },
  { name: 'shoot (aim + fire every 0.6 s)', mode: 'aim', autoFire: true },
  { name: 'torch (Idle_Torch_Loop)', mode: 'torch', autoFire: false },
];
/** the animator's procedural vocabulary (character.ts): stances are continuous, the rest are one-shots the loop can keep re-firing */
export const STANCES: Stance[] = ['none', 'highReady', 'lowReady', 'stack', 'wall'];
/** Sam's FN2000 in the viewer (ViewerState.rifle): the game's 4 / X / E as three positions */
export const RIFLE_NAMES = ['0 · not carried', '1 · slung across the back', '2 · in both hands'];
export const STANCE_NAMES = ['none', 'high ready (pieing / covering)', 'low ready (moving)', 'stack (on a door)', 'wall (back to the wall)'];
/** the game's sidle along a wall (player.ts WALL_TURN): the legs turn this far toward the direction of travel and the animator is told the wall is that far round
 *  (anim.wallYaw) — emulated here whenever the 'wall' stance is walked, so the torso staying square to a wall behind the treadmill can be judged */
export const WALL_TURN = 55 * DEG, WALL_PEEK_LOOK = 30 * DEG;
/** loopable one-shots. Indices 0‥5 are the old viewer's TAC_SHOTS (what __tac.loop(on, shot, every) takes); the rest were separate buttons or are the pair /
 *  door beats: reload · a round (K) · the takedown's cross (anim.strike) · the hold's E (arm ↔ gun, the layers ease the hand-over) · letting the man go and
 *  taking him again (the layers' way out and the reach) · the door hand coming off the leaf and going back on · the game's fourth signal, the stack's shoulder
 *  squeeze, and its fifth, 'aside', both ways (character.ts SignalKind; appended: the list is append-only, a script's loop index must keep meaning what it meant) */
export const TAC_SHOTS = ['kick door', 'signal: hold', 'signal: go', 'signal: rally', 'flinch', 'throw', 'reload', 'shoot (K)', 'strike (takedown cross)', 'hold: swap arm ↔ gun (E)', 'hold: let go / re-grab', 'door hand: off / on', 'signal: squeeze', 'signal: aside (off my line)', 'signal: aside, to his right'];
/** root motion: the gait lab's four */
export const PATHS = ['treadmill (in place)', 'walk a 2 m circle', 'back and forth 5 m (starts / stops / turns)', 'turn on the spot (90° every 2 s)'];
/** what the GAME drives (game.ts tune / guards.ts speeds), so what you see is what plays — not the clips' natural speeds */
export const PRESETS: { name: string; speed: number; crouch: number; note: string }[] = [
  { name: 'idle', speed: 0, crouch: 0, note: 'standing: breathing, weight shift after 1.6 s, feet locked to the floor' },
  { name: 'crouch idle', speed: 0, crouch: 1, note: '' },
  { name: 'creep 0.6 (crouched)', speed: 0.6, crouch: 1, note: 'slowest wheel notch' },
  { name: 'crouch walk 1.3', speed: 1.3, crouch: 1, note: 'tune.playerCrouch default' },
  { name: 'guard patrol 1.15', speed: 1.15, crouch: 0, note: 'guards.ts patrol' },
  { name: 'walk 1.55', speed: 1.55, crouch: 0, note: 'tune.playerWalk' },
  { name: 'guard investigate 1.75', speed: 1.75, crouch: 0, note: '' },
  { name: 'jog 2.4', speed: 2.4, crouch: 0, note: 'walk→jog blend region' },
  { name: 'guard chase 2.7', speed: 2.7, crouch: 0, note: 'guards.ts chase = BLEND.jogAt' },
  { name: 'jog 3.3', speed: 3.3, crouch: 0, note: '' },
  { name: 'sprint 4.7', speed: 4.7, crouch: 0, note: 'tune.playerSprint' },
];
/** the old viewer's locomotion states = (natural clip speed, crouch, reverse) — kept for __viewer.drive and as 'clip 1:1' picks in the sheet */
export const DRIVES: { name: string; speed: (p: AnimParams) => number; crouch: number; reverse: boolean }[] = [
  { name: 'idle', speed: () => 0, crouch: 0, reverse: false },
  { name: 'walk (clip 1:1)', speed: p => p.walkSpeed, crouch: 0, reverse: false },
  { name: 'jog (clip 1:1)', speed: p => p.jogSpeed, crouch: 0, reverse: false },
  { name: 'sprint (clip 1:1)', speed: p => p.sprintSpeed, crouch: 0, reverse: false },
  { name: 'crouch idle', speed: () => 0, crouch: 1, reverse: false },
  { name: 'crouch walk (clip 1:1)', speed: p => p.crouchSpeed, crouch: 1, reverse: false },
  { name: 'backpedal (walk)', speed: p => p.walkSpeed, crouch: 0, reverse: true },
  { name: 'backpedal (crouch)', speed: p => p.crouchSpeed, crouch: 1, reverse: true },
];
export const TRACK = ['— (free focus)', 'root + 1 m', 'head', 'right hand', 'chest', 'a bone (outliner)'];
export const DEBUG_VIEWS = ['final', 'albedo', 'normals', 'direct', 'indirect', 'volumetrics', 'depth', 'RC dice', 'lighting only', 'denoise hints', 'specular', 'restir history', 'restir rays', 'denoise state', 'RT reflections', 'material (rough / metal)', 'gi reservoirs', 'RT raw'];   // engine.settings.debugView indices (same order as main.ts debugNames and the game panel's 'debug view' row: all 18)
export const HOLD_PHASES: HoldPhase[] = ['grab', 'held', 'choke', 'whip', 'kill'];
export const HOLD_VARIANTS: HoldVariant[] = ['arm', 'gun'];

/** the grab / human shield: ONE mannequin, so it poses either figure of the pair alone — the holder (anim.holdPose) or the held man (anim.heldPose) — with a
 *  stick-and-cube marker where the invisible partner's root and skull would be (HOLD.dist ahead of the holder / behind the held man) */
/** chain: a grab that runs into the hold instead of looping (the release / re-grab beat: the reach, then held) */
export interface HoldState { on: boolean; who: number; variant: number; phase: number; t: number; auto: boolean; chain: boolean; gunOut: number; gunPitchDeg: number; agitation: number; marker: boolean; shotT: number; knife: boolean; }

export interface ViewerState {
  // ---- which scene / variant is up (scenes.ts) and what the outliner has selected ('rig:<path>' | 'light:<name>' | 'bone:<name>' | 'item:<i>' | 'figure' | 'stage' | null)
  sceneId: string; variantId: string; sel: string | null;
  // ---- locomotion (the gait lab's model): ground speed as the GAME drives it, crouch, backpedal, root path, deliberate (anim.deliberate: threat proximity)
  speed: number; crouch: number; reverse: boolean; path: number; deliberate: number;
  /** compat with the old viewer's __viewer.drive / speedMul (a DRIVES index: setting it writes speed / crouch / reverse) */
  speedMul: number;
  upper: number; aimPitchDeg: number; aimYawDeg: number; lookYawDeg: number;
  /** guards.ts search: the torso sweeps ±63° at 1.1 rad/s and the head hunts on top (emulated on aimYaw / lookYawExtra) */
  sweep: boolean;
  clip: number; rate: number; paused: boolean; turntable: boolean; turnRate: number; bodyYawDeg: number;
  // ---- kit / look
  goggles: boolean; nv: boolean; nvScreen: boolean; lightOn: boolean;
  /** 0 holstered (empty hands, sidearm on the thigh) · 1 Five-seveN drawn · 2 canister in the fist */
  slot: number;
  /** Sam's FN2000 (RIG.sc20k): 0 not carried · 1 slung across the back · 2 in both hands (the long-gun solve with its foregrip point; the pistol then rides the thigh
   *  whatever `slot` says, as the game has it) — the game's 4 / X / E; `longStance` forces its carriage as it forces the carbine's */
  rifle: number;
  guard: boolean; guardTorch: boolean; carbine: boolean; longStance: number;
  /** anim.longSteady (the long gun steadied against the gait — LONG_STEADY × the carriage's `steady`): 0 as the game has it (Sam 1, the guards' riflemen 0) · 1 off · 2 on */
  longSteady: number;
  showProps: boolean; gunSmoke: boolean; emitterGizmos: boolean;
  /** tracers (R6): every K round traces, whatever the kit's row says (grading); off = the game's rule — the carbine's every third + the last three of a box, pistols none */
  tracerAll: boolean;
  // ---- tactical layer
  stance: number; stackSide: -1 | 1; peek: number; lockpick: boolean;
  tacShot: number; tacLoop: boolean; tacEvery: number;
  hold: HoldState;
  /** a hand on a door leaf (anim.doorPush, character.ts doorLayer): intent w (1 push / 0 take it off — the layer eases), which hand */
  doorHand: { on: boolean; w: number; hand: 0 | 1 };
  /** the stage's door leaf marker: a leaf + jambs `dist` ahead of the root, hinged on `hinge` side, flung by a kick's impact */
  door: { show: boolean; dist: number; hinge: -1 | 1; width: number };
  /** throw one-shot: put a real can in the air at THROW_RELEASE (the game's pendingThrow does exactly that) */
  throwSpawn: boolean;
  /** throw one-shot: metres the throw is told it goes (character.ts THROW_BY picks the swing); 0 = told nothing, the one overhand */
  throwDist: number;
  // ---- stage / camera
  track: number; trackBone: string; wall: boolean; marks: boolean;
  cans: { loop: boolean; loopEvery: number; plume: boolean; t: number };
  /** gait lab: every naturalism layer at its identity value, for an instant before / after */
  allOff: boolean;
  // ---- STAGING (the workbench): where the figure stands and walks — the studio's centre mark, or a spot IN THE LEVEL the editor has open
  /** which world the variant lives in: the studio stage, or the level (the workbench renders the level round him; the standalone viewer only has the studio) */
  world: 'studio' | 'level';
  /** the mark the paths are laid about (null = the stage's centre) */
  home: Vec3 | null;
  /** heading of the back-and-forth leg / the circle's start, degrees about +Y (0 = along +z as ever) and the leg's half length (m) */
  legYawDeg: number; legM: number;
}

export function makeState(): ViewerState {
  return {
    sceneId: 'sam', variantId: 'idle', sel: null,
    speed: 0, crouch: 0, reverse: false, path: 0, deliberate: 0, speedMul: 1,
    upper: 1, aimPitchDeg: 0, aimYawDeg: 0, lookYawDeg: 0, sweep: false,
    clip: 0, rate: 1, paused: false, turntable: false, turnRate: 30, bodyYawDeg: 0,
    goggles: true, nv: false, nvScreen: false, lightOn: false, slot: 1, rifle: 0,   // light off by default: facing the default camera it would shine straight into the lens (L toggles); the rifle off by default (the Sam ▸ rifle variants carry it)
    guard: false, guardTorch: true, carbine: false, longStance: 0, longSteady: 0,
    showProps: true, gunSmoke: true, emitterGizmos: true, tracerAll: false,
    stance: 0, stackSide: 1, peek: 0, lockpick: false,
    tacShot: 0, tacLoop: false, tacEvery: 1.5,
    hold: { on: false, who: 0, variant: 1, phase: 1, t: 0, auto: true, chain: false, gunOut: 0, gunPitchDeg: 0, agitation: 0.4, marker: true, shotT: -1, knife: false },
    doorHand: { on: false, w: 1, hand: 0 },
    door: { show: false, dist: 0.75, hinge: 1, width: 0.9 },
    throwSpawn: true, throwDist: 0,
    track: 1, trackBone: 'head', wall: true, marks: false,
    cans: { loop: false, loopEvery: 8, plume: true, t: 0 },
    allOff: false,
    world: 'studio', home: null, legYawDeg: 0, legM: 2.5,
  };
}

// Scenes and their variants: the top bar. A variant is a declarative patch (Cfg) over BASE — which figure and kit, drive / speed / path, stance / upper,
// a one-shot to keep re-firing, the hold's phase, the door marker — plus the property groups its sheet shows and, for the few that need one, a single
// imperative extra (fire a can, toss an item, die). applyVariant() first puts EVERY variant-settable field back to BASE, so nothing a previous variant set
// survives the switch (the camera, the RIG / knob edits and the view preferences are the user's and stay). Only machinery the viewer already had is used:
// nothing here invents animation.
import type { Runtime } from './runtime';
import { ViewerState, HoldState, makeState } from './state';

export interface Cfg {
  guard?: boolean; guardTorch?: boolean; carbine?: boolean; longStance?: number; rifle?: number;
  speed?: number; crouch?: number; reverse?: boolean; path?: number; deliberate?: number;
  upper?: number; slot?: number; goggles?: boolean; nv?: boolean; lightOn?: boolean; sweep?: boolean; tracerAll?: boolean;
  aimPitchDeg?: number; aimYawDeg?: number; lookYawDeg?: number; turntable?: boolean; turnRate?: number;
  stance?: number; stackSide?: -1 | 1; peek?: number; lockpick?: boolean;
  /** keep re-firing TAC_SHOTS[shot] every `every` s (state.ts) */
  loop?: [shot: number, every: number];
  hold?: Partial<HoldState>;
  doorHand?: { on: boolean; w: number; hand: 0 | 1 };
  door?: { show: boolean; dist?: number; hinge?: -1 | 1 };
  cansPlume?: boolean;
  /** STAGING (state.ts): the level instead of the studio, the mark, the leg's heading / half length, the figure's heading */
  world?: 'studio' | 'level'; home?: [number, number, number] | null; legYawDeg?: number; legM?: number; bodyYawDeg?: number;
}
export interface VariantDef {
  id: string; label: string; title: string;
  cfg: Cfg;
  /** property groups for the sheet, top to bottom (sheet.ts GROUPS ids), after the always-on 'figure' block */
  groups: string[];
  /** a locomotion variant: show the live gait strip under the chips and the gait lab's knob groups */
  gait?: boolean;
  /** the one imperative extra some variants need on apply */
  onApply?: (rt: Runtime) => void;
}
export interface SceneDef { id: string; label: string; title: string; variants: VariantDef[]; /** a scene staged IN THE LEVEL (the workbench lists it in every mode; the standalone viewer, which has no level, leaves it out) */ staging?: boolean }

const GAIT = ['locomotion', 'gait.clips', 'gait.blend', 'gait.gaze', 'gait.run', 'gait.softknee', 'gait.life', 'gait.feet', 'gait.sneak'];
const SAM: Cfg = { guard: false, goggles: true, slot: 1, upper: 1 };
const GUARD_P: Cfg = { guard: true, goggles: false, guardTorch: false, upper: 1 };   // pistol drawn (weapon light in the lens slot)
const GUARD_T: Cfg = { guard: true, goggles: false, guardTorch: true, upper: 4 };    // torch carry (Idle_Torch_Loop arms), sidearm on the thigh
const HOLDER = (h: Partial<HoldState>): Cfg => ({ ...SAM, hold: { on: true, who: 0, auto: true, t: 0, ...h } });
const HELD = (h: Partial<HoldState>): Cfg => ({ ...GUARD_T, upper: 1, hold: { on: true, who: 1, auto: true, t: 0, ...h } });

export const SCENES: SceneDef[] = [
  { id: 'sam', label: 'Player', title: 'the player figure: goggles, the Five-seveN with its rail light, canisters — locomotion here IS the gait lab', variants: [
    { id: 'idle', label: 'idle', title: 'standing: breathing, weight shift after 1.6 s, feet locked to the floor (turn him with body yaw: he steps round)', cfg: { ...SAM, speed: 0 }, groups: GAIT, gait: true },
    { id: 'walk', label: 'walk', title: 'tune.playerWalk 1.55 m/s, pistol in the relaxed two-hand carry (slot 0 in the figure block = holstered, arms swing)', cfg: { ...SAM, speed: 1.55 }, groups: GAIT, gait: true },
    { id: 'jog', label: 'jog', title: '3.3 m/s: the run clip stride-warped to a jog, stance linger, soft knee (2.4 / 2.7 = the walk→jog blend: speed presets)', cfg: { ...SAM, speed: 3.3 }, groups: GAIT, gait: true },
    { id: 'sprint', label: 'sprint', title: 'tune.playerSprint 4.7 m/s: Sprint_Loop with its own stride warp (upper none: the game drops the carry to sprint)', cfg: { ...SAM, speed: 4.7, upper: 0 }, groups: GAIT, gait: true },
    { id: 'crouch-walk', label: 'crouch-walk', title: 'tune.playerCrouch 1.3 m/s crouched', cfg: { ...SAM, speed: 1.3, crouch: 1 }, groups: GAIT, gait: true },
    { id: 'creep', label: 'creep (deliberate)', title: '0.6 m/s crouched with anim.deliberate 1 (a guard close who has not clocked him): longer slower stride, linger over each plant, lower, arms in', cfg: { ...SAM, speed: 0.6, crouch: 1, deliberate: 1 }, groups: [...GAIT.slice(0, 1), 'gait.sneak', ...GAIT.slice(1, -1)], gait: true },
    { id: 'wall', label: 'wall hug', title: 'the Q hold: back and seat on a wall square behind him, palms on the plaster, head along it toward "side" (holstered, as the game has it). Crouch in the figure block; walk it with "wall sidle"', cfg: { ...SAM, slot: 0, upper: 0, stance: 4, stackSide: 1, speed: 0 }, groups: ['tactical', 'wallPose'] },
    { id: 'wall-sidle', label: 'wall sidle', title: 'walking the wall hold at WALL_PACE 1.4: the legs turn 55° toward travel (player.ts WALL_TURN, emulated), the torso stays on the wall', cfg: { ...SAM, slot: 0, upper: 0, stance: 4, stackSide: 1, speed: 1.4 }, groups: ['tactical', 'wallPose', 'locomotion'] },
    { id: 'peek', label: 'peek', title: 'wallPeek 1: leaning out past the wall\'s end on "side", the neck craned the game\'s extra 30°', cfg: { ...SAM, slot: 0, upper: 0, stance: 4, stackSide: 1, peek: 1 }, groups: ['tactical', 'wallPose'] },
    { id: 'lockpick', label: 'lockpick', title: 'anim.lockpick: forced crouch, hands on the keyway 0.45 m ahead at 0.96 m; the pistol leaves the hand once they are half way there (hideHeldItem)', cfg: { ...SAM, lockpick: true, door: { show: true, dist: 0.5, hinge: -1 } }, groups: ['tactical', 'door'] },
    { id: 'kick', label: 'kick door', title: 'anim.kickDoor every 2.2 s: the sole meets the leaf at KICK_IMPACT 0.38 s ~0.75 m ahead (the marker leaf is flung on the impact frame)', cfg: { ...SAM, loop: [0, 2.2], door: { show: true, dist: 0.78 } }, groups: ['tactical', 'door'] },
    { id: 'signals', label: 'signals', title: 'left-hand signals every 1.6 s — pick hold / go / rally in Tactical ▸ loop this one-shot', cfg: { ...SAM, loop: [2, 1.6] }, groups: ['tactical'] },
    { id: 'flinch', label: 'flinch / hit', title: 'Hit_Chest recoil every 1.5 s (flinch = hit without the damage)', cfg: { ...SAM, loop: [4, 1.5] }, groups: ['tactical'] },
    { id: 'throw', label: 'throw (canister)', title: 'slot 2 (can in the fist), the overhand throw every 2.5 s: the can leaves the hand at THROW_RELEASE 0.28 s — a real one is put in the air there (Tactical ▸ spawn a can)', cfg: { ...SAM, slot: 2, loop: [5, 2.5] }, groups: ['tactical', 'dropped', 'rig.can'] },
    { id: 'reload', label: 'reload', title: 'Pistol_Reload every 2.6 s over the relaxed carry', cfg: { ...SAM, loop: [6, 2.6] }, groups: ['tactical'] },
    // ---- the FN2000 (rifles, lane R5): the R1 long-gun solve on Sam with RIG.sc20k's foregrip point, the carriages as player.ts forces them (in the hands → shouldered,
    //      the sprint → the low ready, a kick / a leaf → the port; the calm carry is the guards' / the operatives'), steadied against his gait, and the sling
    { id: 'rifle-shoulder', label: 'rifle: shouldered', title: 'LONG.shoulder — how the player carries the FN2000 whenever it is in his hands: stock in the pocket, bore on aimDir (sweep aim pitch), the left fist round the foregrip post, over the aim clip\'s trunk; the fore-end light lit. Walk him (Figure ▸ speed) and flip Long gun ▸ steady for the side-to-side', cfg: { ...SAM, slot: 0, upper: 2, rifle: 2, longStance: 3, lightOn: true }, groups: ['long', 'longCrouch', 'rig.sc20k', 'rig.m4', 'kit'] },
    { id: 'rifle-crouch', label: 'rifle: crouch-walk', title: 'shouldered, crouch-walking at tune.playerCrouch 1.3 (the crouched table on show): the trunk rocks ±6 cm a stride under it — shoulder.steady × LONG_STEADY.tau keep it out of the hands (muzzle side-to-side 15 cm → under 2); "steady against the gait ▸ off" shows the old wag', cfg: { ...SAM, slot: 0, upper: 2, rifle: 2, longStance: 3, crouch: 1, speed: 1.3 }, groups: ['longCrouch', 'long', 'rig.sc20k', 'rig.m4', 'locomotion'] },
    { id: 'rifle-shoulder-crouch', label: 'rifle: shouldered, crouched', title: 'LONG_CROUCH.shoulder — shouldered and crouched STILL (the crouched table fully on show: Long gun carriage, crouched ▸ C· rows; walk him from Figure ▸ speed, or the crouch-walk chip)', cfg: { ...SAM, slot: 0, upper: 2, rifle: 2, longStance: 3, lightOn: true, crouch: 1, speed: 0 }, groups: ['longCrouch', 'long', 'rig.sc20k', 'rig.m4', 'locomotion'] },
    { id: 'rifle-low-crouch', label: 'rifle: low ready, crouched', title: 'LONG_CROUCH.lowLong crouch-walking at 1.3 (speed 0 for still) — the long-gun low ready crouched: a rifleman ducking under fire, muzzle down; the player never crouches with it low (his sprint stands him up)', cfg: { ...SAM, slot: 0, upper: 0, rifle: 2, longStance: 2, crouch: 1, speed: 1.3 }, groups: ['longCrouch', 'long', 'rig.sc20k', 'rig.m4', 'locomotion'] },
    { id: 'rifle-low', label: 'rifle: sprint (low ready)', title: 'LONG.lowLong forced at tune.playerSprint 4.7 — the player\'s sprint with it: both hands on, muzzle 40° down, the shoulder line held to the weapon (LONG_STEADY.runYaw) while the legs run; also a colleague-in-the-line\'s carry for the guards (speed 0 to see it still)', cfg: { ...SAM, slot: 0, upper: 0, rifle: 2, longStance: 2, speed: 4.7 }, groups: ['long', 'longCrouch', 'rig.sc20k', 'rig.m4', 'locomotion'] },
    { id: 'rifle-port', label: 'rifle: port', title: 'LONG.portLong forced — the kick, a leaf under his hand: across the chest, muzzle up past the left shoulder', cfg: { ...SAM, slot: 0, upper: 0, rifle: 2, longStance: 4 }, groups: ['long', 'longCrouch', 'rig.sc20k', 'rig.m4', 'kit'] },
    { id: 'rifle-calm', label: 'rifle: calm carry (guards\')', title: 'LONG.patrolLong forced — the calm slung-low carry the guards\' riflemen and the breach operatives derive on patrol (never the player\'s now): the FN2000 low across the front, the left fist round the foregrip post', cfg: { ...SAM, slot: 0, upper: 0, rifle: 2, longStance: 1 }, groups: ['long', 'longCrouch', 'rig.sc20k', 'rig.m4', 'kit'] },
    { id: 'rifle-slung', label: 'rifle: slung', title: 'RIG.sc20k.slung: flat across his back in the back\'s own frame (spine line × hip / shoulder lines) off the mid-back joint — off / bore / roll / follow rows, or drag the group node; muzzle down-left past the hip, butt up behind the right shoulder blade. Framed from behind and above; walk / crouch / kick him (Figure, Tactical) to see it ride the back', cfg: { ...SAM, rifle: 1 }, groups: ['rig.sc20k', 'rig.m4', 'kit', 'locomotion', 'tactical'], onApply: rt => rt.frame('backTop') },
    { id: 'rifle-fire', label: 'rifle: fire (K)', title: 'shouldered and a round every 0.6 s: effects.ts muzzleFx.sc20k (the card, light gain × suppressedGain — UNTUNED) through spawnShot at the can\'s mouth; grade the flash tiles here', cfg: { ...SAM, slot: 0, upper: 3, rifle: 2, longStance: 3 }, groups: ['effects', 'rig.sc20k', 'rig.m4', 'long'] },
  ] },
  { id: 'guard', label: 'Guard', title: 'the guard kit: tan suit, hand torch or drawn pistol with a weapon light, the carbine (C)', variants: [
    { id: 'patrol', label: 'patrol walk', title: 'guards.ts patrol 1.15 m/s, torch in the swinging hand (torch lit: L), sidearm on the thigh', cfg: { ...GUARD_T, speed: 1.15, lightOn: true }, groups: ['kit', 'locomotion', 'rig.torch'], gait: true },
    { id: 'lowready', label: 'low ready', title: 'pistol drawn, the low ready carry, moving between doors at 1.15 m/s', cfg: { ...GUARD_P, stance: 2, speed: 1.15, lightOn: true }, groups: ['tactical', 'kit', 'rig.guardPistol'] },
    { id: 'aim', label: 'aim (pistol)', title: 'upper aim: the two-hand aim clip blend by aim pitch, weapon light lit', cfg: { ...GUARD_P, upper: 2, lightOn: true }, groups: ['kit', 'rig.guardPistol', 'tactical'] },
    { id: 'stack', label: 'port / stack', title: 'stacked on a door: bladed to the wall on "side", compressed high ready, head on the door', cfg: { ...GUARD_P, stance: 3, stackSide: 1 }, groups: ['tactical', 'kit'] },
    { id: 'sweep', label: 'torch sweep', title: 'a searching guard (guards.ts search state, emulated): the torso sweeps the beam ±63° at 1.1 rad/s and the head hunts on top', cfg: { ...GUARD_T, lightOn: true, sweep: true }, groups: ['kit', 'rig.torch'] },
    { id: 'carbine-patrol', label: 'carbine: calm carry', title: 'LONG.patrolLong forced: both hands on, slung low across the front, muzzle into the floor (walk him: Figure ▸ speed)', cfg: { ...GUARD_P, carbine: true, longStance: 1 }, groups: ['long', 'longCrouch', 'rig.carbine', 'kit'] },
    { id: 'carbine-low', label: 'carbine: low ready', title: 'LONG.lowLong forced: stock up at the shoulder, muzzle 40° down', cfg: { ...GUARD_P, carbine: true, longStance: 2 }, groups: ['long', 'longCrouch', 'rig.carbine', 'kit'] },
    { id: 'carbine-shoulder', label: 'carbine: shouldered', title: 'LONG.shoulder forced + upper aim: bore on the aim (sweep aim pitch), weapon light lit', cfg: { ...GUARD_P, carbine: true, longStance: 3, upper: 2, lightOn: true }, groups: ['long', 'longCrouch', 'rig.carbine', 'kit'] },
    { id: 'carbine-shoulder-crouch', label: 'carbine: shouldered, crouched', title: 'LONG_CROUCH.shoulder on the guard kit: covering a fix crouched (guards.ts ducks a rifleman under fire) — the crouched table\'s C· rows', cfg: { ...GUARD_P, carbine: true, longStance: 3, upper: 2, lightOn: true, crouch: 1 }, groups: ['longCrouch', 'long', 'rig.carbine', 'kit'] },
    { id: 'carbine-low-crouch', label: 'carbine: low ready, crouched', title: 'LONG_CROUCH.lowLong on the guard kit: head down under fire with the muzzle lowered for a colleague', cfg: { ...GUARD_P, carbine: true, longStance: 2, crouch: 1 }, groups: ['longCrouch', 'long', 'rig.carbine', 'kit'] },
    { id: 'carbine-port', label: 'carbine: port', title: 'LONG.portLong forced: high port across the chest (doors, the kick)', cfg: { ...GUARD_P, carbine: true, longStance: 4 }, groups: ['long', 'longCrouch', 'rig.carbine', 'kit'] },
    { id: 'carbine-tracers', label: 'carbine: tracers (K)', title: 'shouldered and firing a round every 0.6 s with EVERY round a tracer (effects.ts tracerFx: the streak, its head light on the floor and the back wall, the ember where it stops) — untick "tracer every round" in Effects for the game\'s rule (every third + the last three of thirty); orbit side-on, turn the haze up in ⚙ Renderer', cfg: { ...GUARD_P, carbine: true, longStance: 3, upper: 3, tracerAll: true, aimPitchDeg: -4 }, groups: ['effects', 'long', 'kit'] },
    { id: 'reload', label: 'reload beat', title: 'Pistol_Reload every 2.6 s, pistol drawn', cfg: { ...GUARD_P, loop: [6, 2.6] }, groups: ['tactical', 'kit'] },
    { id: 'death', label: 'death / ragdoll (X)', title: 'Character.ragdollize shoved along the camera\'s view like a round (X again, or re-click the chip: respawn + die); the weapon light stays with the body, unlit', cfg: { ...GUARD_P }, groups: ['kit', 'dropped'], onApply: rt => rt.die('shot') },
  ] },
  { id: 'hold', label: 'Pair: hold', title: 'the grab / human shield, one figure of the pair at a time (the grey stick + cube mark the other man): the player\'s holdPose or the held man\'s heldPose', variants: [
    { id: 'grab', label: 'grab (the reach)', title: 'phase grab, 0.45 s, looping: the arm round the OUTSIDE of his shoulder onto the throat, the knife hand up behind his right shoulder', cfg: HOLDER({ phase: 0, variant: 0 }), groups: ['hold', 'holdConsts', 'rig.knife'] },
    { id: 'held-arm', label: 'held (arm / knife)', title: 'the arm hold: forearm across the throat, the knife level under his chin (RIG.knife lays it in the fist; HOLD.knife poses the arm)', cfg: HOLDER({ phase: 1, variant: 0 }), groups: ['hold', 'holdConsts', 'rig.knife'] },
    { id: 'held-gun', label: 'held (pistol)', title: 'the gun hold: the Five-seveN along his right temple (HOLD.gun); "gun out" presents it to fire past him, K fires', cfg: HOLDER({ phase: 1, variant: 1 }), groups: ['hold', 'holdConsts', 'rig.pistol'] },
    { id: 'swap', label: 'swap knife ↔ pistol (E)', title: 'held, the variant flipped every 2 s: the right hand goes back over his shoulder, changes tools there and comes in with the other (HOLD.secs.swap)', cfg: { ...HOLDER({ phase: 1, variant: 0 }), loop: [9, 2] }, groups: ['hold', 'holdConsts', 'rig.knife'] },
    { id: 'choke', label: 'choke-out', title: 'phase choke (arm), 2.6 s looping: the elbow closes, the blade comes OFF him onto his shoulder, leaning back to finish', cfg: HOLDER({ phase: 2, variant: 0 }), groups: ['hold', 'holdConsts', 'rig.knife'] },
    { id: 'whip', label: 'pistol-whip', title: 'phase whip (gun): cocked back and brought down behind his right ear, landing AT HOLD.secs.whip 0.6 s; the follow-through plays on the way out', cfg: HOLDER({ phase: 3, variant: 1 }), groups: ['hold', 'holdConsts'] },
    { id: 'release', label: 'release / re-grab', title: 'held (arm), let go and taken again every 2.5 s: the layers\' own way out, then the reach', cfg: { ...HOLDER({ phase: 1, variant: 0 }), loop: [10, 2.5] }, groups: ['hold', 'holdConsts'] },
    { id: 'held-man', label: 'held man', title: 'the other figure: the guard held (heldPose) — arched back onto the arm, chin up, left hand over the forearm, torch hand up (agitation = the struggle)', cfg: HELD({ phase: 1, variant: 0 }), groups: ['hold', 'holdConsts', 'kit'] },
    { id: 'held-man-gun', label: 'held man (gun to head)', title: 'heldPose, gun variant: hands half raised, head tipped off the can at his temple; K = a round past his ear (the duck)', cfg: HELD({ phase: 1, variant: 1 }), groups: ['hold', 'holdConsts', 'kit'] },
    { id: 'held-man-choke', label: 'held man: choked out', title: 'heldPose through the choke, looping: the fight coming on and being spent (HOLD.struggle), knees going, then hanging', cfg: HELD({ phase: 2, variant: 0 }), groups: ['hold', 'holdConsts', 'kit'] },
    { id: 'held-man-whip', label: 'held man: whipped', title: 'heldPose through the whip: the head going with the blow over the strike\'s last 0.1 s (HOLD.gun.knock)', cfg: HELD({ phase: 3, variant: 1 }), groups: ['hold', 'holdConsts', 'kit'] },
  ] },
  { id: 'takedown', label: 'Pair: takedown', title: 'the silent cross from behind (holstered LMB in the game): the striker\'s Punch_Cross layer, or the man folding forward into the ragdoll', variants: [
    { id: 'strike', label: 'strike (player)', title: 'anim.strike() every 2 s: Punch_Cross over the full upper body, hands empty (holstered)', cfg: { ...SAM, slot: 0, upper: 0, loop: [8, 2] }, groups: ['tactical'] },
    { id: 'victim', label: 'victim (guard folds)', title: 'ragdollize(forward, quiet): the taken-down man folds forward where he stands (re-click the chip to go again)', cfg: { ...GUARD_T, lightOn: true }, groups: ['kit', 'dropped'], onApply: rt => rt.die('takedown') },
  ] },
  { id: 'door', label: 'Door', title: 'a marker doorway ahead of the figure (leaf + jambs, flung by a kick): the kick, the pick, a hand on the leaf, the stack', variants: [
    { id: 'kick', label: 'kick in (player)', title: 'anim.kickDoor every 2.2 s; the leaf goes on the impact frame (KICK_IMPACT 0.38 s)', cfg: { ...SAM, loop: [0, 2.2], door: { show: true, dist: 0.78 } }, groups: ['door', 'tactical'] },
    { id: 'kick-guard', label: 'kick in (guard, carbine)', title: 'the rifleman\'s kick: the derived carriage goes to the high port for it (LONG.portLong)', cfg: { ...GUARD_P, carbine: true, longStance: 0, loop: [0, 2.2], door: { show: true, dist: 0.78 } }, groups: ['door', 'long', 'tactical'] },
    { id: 'pick', label: 'pick the lock', title: 'anim.lockpick at the keyway under the lever handle (crouch forced, hands 0.45 m ahead at 0.96 m)', cfg: { ...SAM, lockpick: true, door: { show: true, dist: 0.5, hinge: -1 } }, groups: ['door', 'tactical'] },
    { id: 'push', label: 'push through (hand on the leaf)', title: 'anim.doorPush (character.ts doorLayer): the free hand palm-flat on the leaf in front of its shoulder — holstered: the right; every 3 s the hand comes off (w 0) and goes back (w 1)', cfg: { ...SAM, slot: 0, upper: 0, doorHand: { on: true, w: 1, hand: 1 }, door: { show: true, dist: 0.5, hinge: -1 }, loop: [11, 3] }, groups: ['door', 'tactical'] },
    { id: 'push-walk', label: 'push, walking, gun hand busy', title: 'walking a leaf open at 1.55 m/s with the pistol drawn: the LEFT hand goes up (the layer refuses a full right hand)', cfg: { ...SAM, slot: 1, upper: 1, speed: 1.55, doorHand: { on: true, w: 1, hand: 0 }, door: { show: true, dist: 0.5, hinge: 1 } }, groups: ['door', 'tactical'] },
    { id: 'stack', label: 'stack on it (player)', title: 'stance stack, wall on "side": pelvis bladed to the wall, pistol compressed high, head on the door', cfg: { ...SAM, stance: 3, stackSide: 1, door: { show: true, dist: 0.6 } }, groups: ['tactical', 'door'] },
  ] },
  { id: 'fx', label: 'Props & FX', title: 'the game\'s own effect functions and item models on the stage: canisters, dropped items, the shot, night vision, the rail light', variants: [
    { id: 'smoke-can', label: 'smoke can (plume)', title: 'smoke.spawnCanister on the floor mark 1.6 m ahead (fires on select; "fire" again in the sheet, or loop)', cfg: { ...SAM, cansPlume: true }, groups: ['canisters', 'effects.smoke'], onApply: rt => rt.smokeCan() },
    { id: 'vent-can', label: 'smoke can (floor vent)', title: 'effects.ts spawnVent: the ported floor-hugging vent instead of the plume', cfg: { ...SAM, cansPlume: false }, groups: ['canisters', 'effects.smoke'], onApply: rt => rt.smokeCan() },
    { id: 'stun-can', label: 'stun can', title: 'effects.ts spawnBurst: the flash, the expanding burst, sparks and smoke trails', cfg: { ...SAM }, groups: ['canisters', 'effects.smoke'], onApply: rt => rt.stunCan() },
    { id: 'dropped', label: 'dropped items', title: 'throwables.ts item models + physics tossed from the hand (a pistol on select; the sheet has the rest)', cfg: { ...SAM }, groups: ['dropped'], onApply: rt => rt.toss('pistol') },
    { id: 'muzzle', label: 'muzzle flash / sparks (K)', title: 'upper shoot: a round every 0.6 s — effects.ts spawnShot: flash lights, flame card, bore + port gas, powder sparks; the emitter anchors are gizmo nodes', cfg: { ...SAM, upper: 3 }, groups: ['effects', 'effects.smoke', 'rig.pistol'] },
    { id: 'nv', label: 'night vision (N)', title: 'goggles down over the eyes (the 2010s kit: two dark tubes, RIG.goggles.tubes — the lenses blaze, RIG.goggles.on*, only with ?oldgear); N flips them up; "NV screen effect" runs the game\'s post too', cfg: { ...SAM, nv: true }, groups: ['kit', 'rig.goggles'] },
    { id: 'raillight', label: 'rail light (L)', title: 'the under-barrel light lit, upper aim: the beam leaves the drawn lens (turn haze up in ⚙ Renderer to see it; debug view "lighting only" shows the spot)', cfg: { ...SAM, lightOn: true, upper: 2 }, groups: ['kit', 'rig.pistol'] },
  ] },
  // ---- STAGING: the figure IN THE LEVEL the workbench has open (state world 'level': the editor's scene renders round him, its lights light him) — one tunes the
  //      lino's roughness while a man walks through the reflection, or the desk lamp's cone while Sam kneels in it. Marks are the office's (levels/office.json):
  //      the strip of break-room floor in front of the two vending fronts (x 28.7‥31.9, z 14.5), the manager's chair side of his desk under desk_lamp (27.1, 1.16, 6.1),
  //      the lobby's stone between the reception desk and the waiting corner. The standalone viewer has no level and leaves this scene out of its bar.
  { id: 'staging', label: 'Staging (in the level)', title: 'the figure staged IN THE LEVEL the workbench has open — pick one in any mode: the level keeps rendering, its lights light him, the floor mirrors him', staging: true, variants: [
    { id: 'vending-walk', label: 'guard past the vending machines', title: 'a torch guard walking back and forth along the two vending fronts in the break room (x 28.7 ↔ 31.9 at z 14.5): the lino mirrors him under their glow — Materials ▸ lino ▸ roughness while he walks', cfg: { ...GUARD_T, speed: 1.15, path: 2, lightOn: true, world: 'level', home: [30.3, 0, 14.5], legYawDeg: 90, legM: 1.6 }, groups: ['kit', 'locomotion'] },
    { id: 'vending-idle', label: 'guard at the machines', title: 'the same man stood a metre off the red machine, torch lit, facing along the fronts', cfg: { ...GUARD_T, speed: 0, world: 'level', home: [29.4, 0, 14.3], bodyYawDeg: 90, lightOn: true }, groups: ['kit'] },
    { id: 'desk-lamp', label: 'The player under the desk lamp', title: 'The player crouched at the manager\'s desk on the chair side, in the desk lamp\'s cone (light desk_lamp at 27.1, 1.16, 6.1): goggles, pistol drawn — the lamp\'s penumbra and bounce on a face and a coat', cfg: { ...SAM, speed: 0, crouch: 1, world: 'level', home: [26.6, 0, 7.1], bodyYawDeg: 180 }, groups: ['kit'] },
    { id: 'lobby-walk', label: 'guard across the lobby stone', title: 'a torch guard walking the lobby\'s polished stone north ↔ south between the reception desk and the waiting corner (x 8.6, z 17.4 ↔ 22): the frontage and the exit sign in the floor round his feet', cfg: { ...GUARD_T, speed: 1.15, path: 2, lightOn: true, world: 'level', home: [8.6, 0, 19.7], legYawDeg: 0, legM: 2.3 }, groups: ['kit', 'locomotion'] },
  ] },
];

/** BASE: every field a Cfg can touch, at its neutral value — applied before each variant so a switch fully undoes the last one */
const B = makeState();
export function applyVariant(rt: Runtime, sceneId: string, variantId: string): VariantDef | null {
  const scene = SCENES.find(s => s.id === sceneId) ?? SCENES[0]; const v = scene.variants.find(x => x.id === variantId) ?? scene.variants[0];
  const st: ViewerState = rt.st; const c = v.cfg;
  if (st.path !== 0 || st.turntable || st.world === 'level') st.bodyYawDeg = 0;   // a path / the turntable / a STAGED level variant had the heading: face the camera again (a heading set by hand on the treadmill is kept; `world` here is still the previous variant's — wave-3 review: vending-idle 90° / desk-lamp 180° leaked into every later studio scene)
  Object.assign(st, {
    guard: B.guard, guardTorch: B.guardTorch, carbine: B.carbine, longStance: B.longStance, rifle: B.rifle,
    speed: B.speed, crouch: B.crouch, reverse: B.reverse, path: B.path, deliberate: B.deliberate,
    upper: B.upper, slot: B.slot, goggles: B.goggles, nv: B.nv, lightOn: B.lightOn, sweep: B.sweep, tracerAll: B.tracerAll, longSteady: B.longSteady,   // (longSteady too: a 'steady against the gait ▸ off' A/B must not leak into the next variant — review 08-10 #26)
    aimPitchDeg: B.aimPitchDeg, aimYawDeg: B.aimYawDeg, lookYawDeg: B.lookYawDeg, turntable: B.turntable, turnRate: B.turnRate,
    stance: B.stance, stackSide: B.stackSide, peek: B.peek, lockpick: B.lockpick,
    tacShot: B.tacShot, tacLoop: B.tacLoop, tacEvery: B.tacEvery, clip: 0, paused: false,
    world: B.world, home: B.home, legYawDeg: B.legYawDeg, legM: B.legM,
  } satisfies Partial<ViewerState>);
  st.hold = { ...B.hold, marker: st.hold.marker }; st.doorHand = { ...B.doorHand }; st.door = { ...B.door }; st.cans.plume = B.cans.plume; st.cans.loop = false;
  // the patch
  for (const k of ['world', 'legYawDeg', 'legM', 'bodyYawDeg', 'guard', 'guardTorch', 'carbine', 'longStance', 'rifle', 'speed', 'crouch', 'reverse', 'path', 'deliberate', 'upper', 'slot', 'goggles', 'nv', 'lightOn', 'sweep', 'tracerAll', 'aimPitchDeg', 'aimYawDeg', 'lookYawDeg', 'turntable', 'turnRate', 'stance', 'stackSide', 'peek', 'lockpick'] as const)
    if (c[k] !== undefined) (st as unknown as Record<string, unknown>)[k] = c[k];
  if (c.loop) { st.tacShot = c.loop[0]; st.tacEvery = c.loop[1]; st.tacLoop = true; }
  if (c.hold) Object.assign(st.hold, c.hold);
  if (c.doorHand) st.doorHand = { ...c.doorHand };
  if (c.door) st.door = { ...st.door, ...c.door };
  if (c.cansPlume !== undefined) st.cans.plume = c.cansPlume;
  if (c.home !== undefined) st.home = c.home ? [c.home[0], c.home[1], c.home[2]] : null;
  st.sceneId = scene.id; st.variantId = v.id;
  // the runtime's side: a living figure back on the mark with fresh path clocks, then the variant's one extra
  if (!rt.char.alive) rt.spawn();
  rt.resetMotion();
  if (st.path !== 1) rt.char.bodyYaw = st.bodyYawDeg * (Math.PI / 180);
  v.onApply?.(rt);
  return v;
}
export function findVariant(sceneId: string, variantId: string): { scene: SceneDef; variant: VariantDef } | null {
  const scene = SCENES.find(s => s.id === sceneId); const variant = scene?.variants.find(x => x.id === variantId);
  return scene && variant ? { scene, variant } : null;
}

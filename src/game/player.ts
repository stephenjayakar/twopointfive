// Player controller: movement / crouch / sprint under real or puppet input, back-to-the-wall (Q), the pistol and rail light + its OCP, the FN2000 (kit slot 2: SEMI / AUTO on the left button, its attachment — the ring launcher — on the right, its light), throws, silent takedown and body drag, plus the cursor: what is under it and what Space would do (interactables).
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp, DEG, smoothstep } from '../math/vec';
import { Input } from './input';
import { FollowCamera } from './camera';
import { Doors, Door } from './doors';
import { RAG } from './ragdoll';
import { ThrowSolution } from './throwables';
import * as fx from './effects';
import { rigLightPose, sc20kGrip, sc20kMuzzleAhead, sc20kLightPose, sc20kLauncherMuzzle } from './rigProps';
import { PLAYER_ID, DRIVE_REACH, DRIVE_SECS } from './consts';
import { tread } from './floor';
import { rackDist, tally } from './mission';
import { chronKey, chronDoor, chronThrown, chronGrab } from './chronicle';
import { fireWeapon, killGuard, dropFromHand } from './combat';
import { kickScuff } from './marks';
import { samSpread } from './suppression';
import { fireRing, ringSolve, ringAimPoint } from './launcher';
import { LAUNCHER } from './weapons';
import { samAim, AIM_HOOKS } from './aim';
import { ocpable } from './lighting';
import { THROW_RELEASE, HOLD } from './character';
import type { HoldPhase, HoldVariant, LongStance } from './character';
import type { StaticCollision } from '../scene/collision';
import type { Game, Guard, Player, ThrowKind, Interactable, Verb } from './game';
import { isBreathing } from './game';
import { endGuardScript } from './squad';
import { resetChase, handCarry, inHand } from './guards';
import { whistleKey } from './whistle';
import { wetFootfall } from './wet';
import { padState, stopCoding, spell, CODE_SECS, padDoorName } from './devices';
import { civilianGrabbed, civilianComply, civilianSamLine, civilianBodies, civiliansShown } from './civilians';
import { promptFor, agitationOf, samLineFor, samRemarkFor, samKeyLineFor, CIV_LINES } from './dialogue';

/** the player's movement circle: wider than the body so arms / gun don't clip into walls */
const BODY_R = 0.42;
/** living guards are solid to you out to this (centre to centre) */
const KEEP_OFF = 0.55;

// ------------------------------------------------------------ the grab / hold (docs/internal/grab-interrogate-design.md §1: slice 1 the arm variant, slice 4 the gun variant)
//                                                              the 'grab him' row on a living guard from behind (game.ts updateDoors acts on it) — the silent takedown
//                                                              is a left click with the hands empty, never Space
/** with a man in your arm: m/s forward and sideways, m/s backing the pair up (hauling him), and the rad/s the pair comes round at toward the cursor — slow enough
 *  that a man who commits to your flank gets his half second before the pair faces him */
const HOLD_PACE = 0.85, HOLD_PACE_BACK = 0.65, HOLD_TURN = 2.6;
/** An exchange is Sam's line, then the man's answer when Sam's bubble ends (askHeld / answerHeld). INTERROGATE_GAP: seconds of his answer he always gets out
 *  before the next tap can cut in on it with the next question (a tap sooner only cuts the line short — and once that cut line is gone the next tap asks: there
 *  is nothing of it left to keep); ANSWER_TAIL: the last stretch of an answer that counts as over (the row stops offering to cut in; the tour's beat waits for it).
 *  Sam's own line is never cut: a tap while he speaks does nothing — the answer is coming. */
const INTERROGATE_GAP = 1.2, ANSWER_TAIL = 0.5;
/** how long Sam's line hangs over him before the man answers (s): a beat, stretched a little for a longer line — SAM_MAX_CHARS keeps them to a clause or two */
export function samBeat(chars: number): number { return clamp(0.7 + 0.018 * chars, 0.9, 1.4); }
/** hearing levels ('prop' events at the pair, the room's business not the floor's — the takedown's thud is 0.3): the scuffle of the grab, the choke going on, him
 *  hitting the floor at the end of it, the crack of the pistol on his skull and him going down under it (the loudest of them: a whip is quick, not quiet) */
const GRAB_NOISE = 0.12, CHOKE_NOISE = 0.15, FOLD_NOISE = 0.3, WHIP_NOISE = 0.35;
/** audio only (nothing the AI hears): seconds between grains of the choke's strain — 'chokeStrain' is one 0.6 s grain, retriggered off the beat's own clock while
 *  the arm is closed, so a choke eased off needs nothing stopped (the last grain just dies) */
const CHOKE_GRAIN = 0.4;
/** firing past the man in the arm (the gun variant, LMB): one-handed from beside his jaw — seconds between rounds (single, deliberate shots) and the spread they go
 *  with (combat.ts fireWeapon: ± half of it per axis on the unit direction ≈ ±2.6° — a torso at 6 m mostly, not always) */
export const HOLD_FIRE_CD = 0.7, HOLD_SPREAD = 0.09;
/** Player.holding while Sam has a man from behind. phase / t: the beat (HOLD.secs) — 'grab' easing in behind him and the arm coming round (he is frozen, not yet
 *  turned), 'held' the pair locked HOLD.dist apart on Sam's facing, 'choke' the same with the arm closing (chosen off its row, it runs to HOLD.secs.choke on its
 *  own; a Space tap, a step or Esc sooner = he breathes), 'whip' the pistol coming off his head and down behind his ear (likewise: stopped before HOLD.secs.whip
 *  it never lands). since: game time the hold proper began. windT: the commit beat — seconds since the choke / the whip was chosen (−1 = not chosen): at
 *  HOLD.secs.chokeHold the arm closes / the pistol cocks back (the timing the held key used to have; it does not run while the hand is between tools). variant:
 *  set at the grab by what was in the hand — 'arm' (holstered, or a canister up: both hands on him, the knife at his throat; his rows are the question and the
 *  choke) or 'gun' (the Five-seveN drawn: it goes to his head; a click fires past him, his one row is the whip, and no question is put over a gun) — and
 *  SWAPPED by E once he is held (swapHold: he draws / holsters with the man in the arm). swapT: seconds since that last happened (Infinity = never this hold):
 *  inside HOLD.secs.swap the hand is still changing tools and the row starts nothing. remarked: Sam has already said his piece on drawing this hold (one remark
 *  per hold). gunOut: 0‥1, the pistol presented off his head to fire (eased here, posed by the layer); fireQueued: a click waiting the few frames that takes;
 *  shotT: game time of the last round past him (−1 none: his flinch, and how long the gun stays presented). ask: the exchange in flight — Sam's line went up
 *  at `t` for `dur` (his bubble); the man's answer follows when it ends (updateHold → answerHeld); null between. after: a remark of Sam's waiting for the
 *  man to finish — his word on the key he has just pocketed (takeKey) — put up the first frame the answer is down and no question is going up, dropped by
 *  whatever kills a pending question (cancelAsk) or by the next question beating it to the air (askHeld); null when none waits. */
export interface Hold { g: Guard; variant: HoldVariant; phase: HoldPhase; t: number; since: number; windT: number; swapT: number; remarked: boolean; gunOut: number; fireQueued: boolean; shotT: number; ask: { t: number; dur: number } | null; after: { text: string; id: string } | null; }

/** Longest stride the collision sweep takes in one go: from a settled spot (the circle clear of every face) a stride this short cannot carry the centre past the
 *  middle of the thinnest thing in the level (8 cm cubicle panels: 0.42 + 0.04), so every push-out sends him back the way he came — never out of the far side. */
const SWEEP_STEP = 0.2;
/** The player's own collision: the BODY_R circle pushed out of the statics between shin height and `y1` (standing 1.7 / crouched 1.0 — under a desk top only on
 *  your knees), then held on the world's floor rectangle (the lot has no kerb: guards are kept in by the nav grid, you by this).
 *  It is a SWEEP, not a point test: wherever he has been put since the last time this ran (his own stride at 20 fps, a sprint plus a guard's shoulder, a door leaf
 *  swung into him, a chair driven into him, the takedown / kick / pick easing him onto a spot) he is walked there from the last settled spot (`Player.safe`) in
 *  strides of ≤ SWEEP_STEP, settled against the statics after each — so a displacement of any size slides along the wall it meets instead of resolving to
 *  whichever side of a 12 cm partition the raw position happened to land nearer (which is how he used to come out in the next room). */
function collidePlayer(g: Game, y1: number) {
  const pl = g.player, p = pl.char.pos, col = g.col, s = pl.safe;
  if (s) {
    const dx = p[0] - s[0], dz = p[2] - s[2]; const n = Math.min(32, Math.ceil(Math.hypot(dx, dz) / SWEEP_STEP));
    if (n > 1) { p[0] = s[0]; p[2] = s[2]; for (let i = 1; i < n; i++) { p[0] += dx / n; p[2] += dz / n; col.collideCircle(p, BODY_R, 0.2, y1, 4); col.clampToWorld(p, BODY_R); } p[0] += dx / n; p[2] += dz / n; }
  }
  for (let k = 0; k < 4; k++) { col.collideCircle(p, BODY_R, 0.2, y1, 6); if (!col.clampToWorld(p, BODY_R)) break; }   // (6 passes: three walls and a shelf end meeting in a pocket left him centimetres inside one of them at 3; and where the world edge and a static leave less than his width — the van's corner on the lot's rim — the two are alternated until they agree on the mouth of the wedge instead of each undoing the other)
  if (s) { s[0] = p[0]; s[1] = 0; s[2] = p[2]; } else pl.safe = [p[0], 0, p[2]];
}
/** May he stand up here? Anything static in the column between crouched head height and standing head height (a counter top's overhang, a shelf, a desk he
 *  crept under) says no — otherwise standing switches the collision headroom 1.0 → 1.7 and the sweep would shove him a foot out through the slab in one frame
 *  (the QA soak's 'popped 0.30 m' under the reception counter's north overhang). Non-destructive: settles a COPY of his spot against that band only. */
export function canStand(g: Game): boolean {
  const p = g.player.char.pos; const q: Vec3 = [p[0], p[1], p[2]];
  g.col.collideCircle(q, BODY_R, 1.0, 1.7, 2);
  return Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.01;
}
/** Settle the player against the statics NOW (game.ts, after the door leaves and the furniture have had their say this frame): whatever a leaf or a pinned chair
 *  shoved him into is resolved before anything draws or reads him — swept from where he last stood clear, like every move of his own. */
export function settlePlayer(g: Game) { const pl = g.player, p = pl.char.pos, s = pl.safe; if (pl.down || (s && s[0] === p[0] && s[2] === p[2])) return; collidePlayer(g, pl.crouch ? 1.0 : 1.7); }   // (nothing moved him since the last settle: nothing to do — the statics have not moved either)

/** Walking pace on the wheel: PACE_MIN of the walk / crouch-walk speed at the slowest notch, 1 at the fastest, PACE_STEP a notch. */
export const PACE_MIN = 0.35, PACE_STEP = 0.13;
/** One notch of the wheel on his pace (interact.ts routes the wheel here whenever Space is not down — a hold included: the pair walks at HOLD_PACE × pace): scroll
 *  toward you = slower, like easing off a stick; the kit column shows the ticks for a moment. */
export function wheelPace(g: Game, wheel: number) { const pl = g.player; if (pl.down || !wheel) return; pl.pace = clamp(pl.pace - Math.sign(wheel) * PACE_STEP, PACE_MIN, 1); pl.paceShownT = g.time; }
/** Sam's hands on the FN2000 (docs/internal/sc20k-design.md §5; combat.ts fireWeapon's `spread`: ± half of it per axis on the unit direction): a shouldered long gun
 *  standing still, on the move (any ground speed over `moveAt`), × crouched, × braced on the foregrip — which he now ALWAYS is with it in the hands (Player.braced:
 *  no brace input any more, so braceK is simply the rifle's in-hand steadiness and `still` × braceK the cone a standing round is drawn with) — then + the AUTO string's
 *  own growth off the row (weapons.ts AutoSpec) and + his suppression's (suppression.ts samSpread), as the pistol's rounds get. The pistol stays dead-on. */
export const RIFLE_SPREAD = { still: 0.010, moving: 0.028, moveAt: 0.3, crouchK: 0.7, braceK: 0.45 };
AIM_HOOKS.playerExternalK = (g: Game) => (g.player.braced ? RIFLE_SPREAD.braceK : 1);   // the foregrip brace steadies the aim model's cone too (aim.ts hook), not only the rifle's own hands term
/** seconds the rifle takes coming off the sling into the hands (or going back, or the pistol coming out in its place): no round and no ring inside it */
export const RIFLE_EQUIP_SECS = 0.45;
/** what the selected slot puts in his hand, for the HUD line */
const itemName = (pl: Player) => pl.slot === 'pistol' ? pl.pistol.def.short : pl.slot === 'smoke' ? 'smoke canister' : pl.slot === 'flash' ? 'stun canister' : rifleName(pl);
/** 'FN2000 · SEMI' / '· AUTO' (+ ' · RING ×4' while that attachment is selected) — the rifle as the HUD line names it */
const rifleName = (pl: Player) => `${pl.rifle.def.short} · ${pl.rifle.mode.toUpperCase()}${pl.rifle.attachment === 'ring' ? ` · RING ×${pl.rifle.rings}` : ''}`;
/** Put the selected item away (E; taking hold of a wall) or draw it again (E; stepping off one): a reload in hand is abandoned on holstering, and unless `quiet`
 *  the HUD line says which and the holster sounds. The rig, the rail light, the takedown click and every path of the pistol read Player.holstered itself; with the
 *  rifle selected 'holstered' is SLUNG — across his back — and drawing it is RIFLE_EQUIP_SECS of no fire (equipT). */
function setHolstered(g: Game, on: boolean, quiet = false) {
  const pl = g.player; if (pl.holstered === on) return;
  pl.holstered = on;
  if (on && pl.pistol.reloading) { pl.pistol.cancelReload(); pl.char.anim.cancelReload(); }
  if (on && pl.rifle.reloading) { pl.rifle.cancelReload(); pl.char.anim.cancelReload(); }
  if (pl.slot === 'rifle') pl.equipT = RIFLE_EQUIP_SECS;
  if (!quiet) { g.msg(on ? (pl.rifleSel ? 'slung' : 'holstered') : itemName(pl)); g.audio.play('equip', null, 0.45); }
}
/** every gun's reload in hand abandoned (the takedown, the grab, the lock, the kick: the hands are wanted) */
function cancelReloads(pl: Player) { pl.pistol.cancelReload(); pl.rifle.cancelReload(); pl.char.anim.cancelReload(); }
/** The one weapon light Sam owns as a light (Player.light), posed off whichever gun is in the hand and lit by THAT gun's switch: the Five-seveN's rail light, or the
 *  FN2000's fore-end light. Dark while sprinting (gun down), while the hands are on the lock tools or both round a man (hideHeldItem: the gun is on the thigh / the
 *  back), and on a man who is down. Every path that bakes his pose calls this after it (updatePlayer, the hold's tail, the pick, the kick). */
function poseGunLight(g: Game) {
  const pl = g.player, c = pl.char, L = pl.light;
  const pistolUp = pl.pistolUp, rifleUp = pl.rifleUp;
  L.enabled = ((pistolUp && pl.pistol.lightOn) || (rifleUp && pl.rifle.lightOn)) && !pl.sprinting && !c.anim.hideHeldItem && !pl.down;
  if (L.enabled) { const lp = rifleUp ? sc20kLightPose(c) : rigLightPose(c); L.pos = lp.pos; L.dir = lp.dir; }
}
/** Arm (or disarm) the animator's long gun for the FN2000 each frame: in the hands = the R1 solve with the rifle's own grip point and muzzle, steadied against his gait
 *  (longSteady: the gun rides the shoulders, not the hips), the carriage FORCED to what Sam is doing — in his hands at all (standing, walking, crouched) → SHOULDERED,
 *  aiming it wherever the cursor is like the pistol's two-hand aim; sprinting → the long-gun low ready (both hands on, muzzle down); a kick / a leaf under his hand →
 *  the high port; never the guards' calm carry — off = the pistol's numbers back. */
function armRifle(g: Game, inHands: boolean, carriage: LongStance | null) {
  const pl = g.player, an = pl.char.anim;
  an.longGun = inHands; an.longStance = inHands ? carriage : null; an.longSteady = 1;
  if (inHands) { an.longGrip = sc20kGrip(); pl.char.muzzleAhead = sc20kMuzzleAhead(); }
  else pl.char.muzzleAhead = pl.pistol.def.muzzleAhead;
}
export function updatePlayer(g: Game, dt: number, input: Input, cam: FollowCamera) {
  const pl = g.player; const c = pl.char; const T = g.tune; const gun = pl.pistol;
  cam.peekOffset = null;   // (set again below for the one case that wants it: peeking round the end of a wall)
  if (input.hit('Enter') && (pl.down || g.mission.stage === 'failed' || input.down('ShiftLeft') || input.down('ShiftRight'))) {   // (failed on his feet — a civilian dead by his hand with tune.civilianKillFails — restarts too)   // Shift+Enter restarts the encounter any time; a bare Enter once down goes back to this run's newest CHECKPOINT if one is stored (game/savestate.ts — the down card's default too), else restarts
    const shift = input.down('ShiftLeft') || input.down('ShiftRight'); const ck = !shift && pl.down ? g.saves.newest(true, g.mission.stats.elapsed) : null;
    if (ck && g.saves.isThisRun(ck)) { const why = g.saves.load(g, ck.key); if (!why) return; g.msg(`checkpoint: ${why}`); }
    g.restartEncounter(); return;
  }
  if (pl.down) { releaseWall(g); if (pl.holding) freeHeld(g, 'shot'); c.vel = [0, 0, 0]; pl.light.enabled = false; pl.throwPreview = null; c.anim.lockpick = false; c.anim.longGun = false; c.update(dt); g.bodyThud(c); return; }   // (down with a man in his arm — god mode off, hitPlayer has normally let go already: he goes free; the rifle, in the hands or not, is no longer held: it left them or lies under him on its sling)
  const rifle = pl.rifle;
  gun.update(dt); rifle.update(dt); pl.ocp.update(dt); rifle.ringCd = Math.max(0, rifle.ringCd - dt); pl.equipT = Math.max(0, pl.equipT - dt);
  pl.noise *= Math.exp(-2.2 * dt);   // sound meter decay
  whistleKey(g, input);              // V: a low whistle (whistle.ts) — from the arm lock, the lock, the wall, mid-kick alike: anywhere but down (returned above)
  if (pl.takedown) { updateTakedown(g, dt); c.anim.speed = 0; c.anim.upper = 'none'; armRifle(g, false, null); c.update(dt); pl.light.enabled = false; return; }   // locked into the takedown beat: no movement / aim / fire until it resolves (the takedown is a hands-empty click: the rifle, if he has one, is on his back)
  if (pl.holding) { updateHold(g, dt, input, cam); return; }   // a man in his arm: the pair moves, turns and is posed as one; Space / E on his row are read there
  if (pl.kick) { updateKick(g, dt); return; }              // rooted square to the leaf until the foot is back down (the door goes at KICK_IMPACT)
  if (pl.picking) { updatePicking(g, dt, input); return; }  // planted at the lock, on its own clock (a step / Space / Esc breaks off: interact.ts)
  if (pl.coding) { updateCodingPlant(g, dt); return; }     // at the keypad, feet still, squared to the plate while the code goes in (devices.ts updateCoding times it; a fresh key / Space / Esc breaks off — interact.ts)
  c.anim.lockpick = false;                                   // (whatever ended a pick, the hands come off the tools)
  // equipment selection / toggles — the digits are KIT_ORDER's (1 pistol · 2 rifle · 3 smoke · 4 stun; there is no other way to change items). Pressed to a wall his
  // hands stay empty (wallSnap holstered whatever was up, releaseWall hands it back): there, E and the digits only choose what he steps off it with (WallHold.drawn)
  // and say so — nothing comes into the hand on the wall
  const draw = (name: string) => { if (pl.wall) { pl.wall.drawn = true; g.msg(`${name} — in hand once off the wall`); } else { pl.holstered = false; g.msg(name); } g.audio.play('equip', null, 0.5); };
  const wasIn = pl.gunInHand();
  if (input.hit('Digit1')) { pl.slot = 'pistol'; draw(gun.def.short); }
  if (input.hit('Digit2')) {   // 2: the rifle — off the sling into the hands (selected but slung, or anything else selected); pressed again with it IN the hands: the attachment the right button works (none → RING → none …, remembered while it is away)
    if (!pl.hasRifle) g.msg('no FN2000 in this loadout — the start card / pause menu puts it in the kit');
    else if (pl.rifleUp) {   // (never on the wall: it holstered whatever was up)
      if (pl.equipT <= 0) {   // not while it is still coming round off the sling: a double-tapped 2 draws it, it does not also put the launcher on the button
        const a = rifle.cycleAttachment(); g.audio.play('click', c.muzzle, 0.7);
        g.msg(a === 'ring' ? (rifle.rings > 0 ? `ring airfoil ×${rifle.rings} on the right button — head = out cold, body = staggered, a wall = a noise they go and look at; 2 again takes it off` : 'the ring launcher — but no ring airfoils left (2 again takes it off)') : `${rifle.def.short} · ${rifle.mode.toUpperCase()} — no attachment on the right button`);
      }
    } else { pl.slot = 'rifle'; draw(rifleName(pl)); }
  }
  if (input.hit('KeyE') && !pl.dragging && !pl.takedown) { if (pl.wall) { pl.wall.drawn = !pl.wall.drawn; g.msg(pl.wall.drawn ? `${itemName(pl)} — in hand once off the wall` : `${pl.rifleSel ? 'slung' : 'holstered'} — and staying so off the wall`); } else setHolstered(g, !pl.holstered); }   // E: put it away / draw it (whatever the slot is; the rifle 'away' is on his back)
  // (the wheel — walking pace down / up — is read in interact.ts wheelPace: while Space is down it scrolls the selector instead)
  if (input.hit('Digit3')) { if (pl.canisters > 0) { pl.slot = 'smoke'; pl.throwKind = 'smoke'; draw(`smoke canister ×${pl.canisters}`); } else g.msg('no smoke canisters left'); }
  if (input.hit('Digit4')) { if (pl.flashbangs > 0) { pl.slot = 'flash'; pl.throwKind = 'flash'; draw(`stun canister ×${pl.flashbangs} — goes off ${fx.bang.fuse}s after it lands`); } else g.msg('no stun canisters left'); }
  { const nowIn = pl.gunInHand(); if (nowIn !== wasIn && (nowIn === rifle || wasIn === rifle)) { pl.equipT = RIFLE_EQUIP_SECS; if (wasIn === rifle && rifle.reloading) { rifle.cancelReload(); c.anim.cancelReload(); } if (wasIn === gun && gun.reloading) { gun.cancelReload(); c.anim.cancelReload(); } } }   // the rifle came off the sling or went back on it (a digit / E): the beat with nothing to fire, and a reload in the hand that changed is abandoned
  if (input.hit('KeyL')) { const lit = pl.rifleSel ? rifle : gun; lit.lightOn = !lit.lightOn; g.audio.play('click', c.muzzle, 0.6); }   // the light of the gun the kit has selected (its switch is under the thumb of the hand it is in)
  if (input.hit('KeyZ') && pl.rifleSel) {   // the selector (a property of the rifle: in the hands or slung) — what the LEFT button fires; the attachment on the right is its own thing
    if (rifle.def.modes.length > 1) { const m = rifle.cycleMode(); g.msg(`${rifle.def.short}: ${m.toUpperCase()}${m === 'auto' ? ' — hold the trigger' : ' — one round a click'}`); g.audio.play('click', c.muzzle, 0.7); }
    else g.msg(`${rifle.def.short} is ${rifle.mode.toUpperCase()} only`);
  }
  if (input.hit('KeyN')) { pl.nv = !pl.nv; g.audio.play(pl.nv ? 'nvOn' : 'nvOff', null, 0.7); g.msg(pl.nv ? 'night vision on' : 'night vision off'); }
  pl.nvAmount = damp(pl.nvAmount, pl.nv ? 1 : 0, pl.nv ? 5 : 9, dt);
  const sprintKey = (input.down('ShiftLeft') || input.down('ShiftRight')) && (input.down('KeyW') || input.down('KeyA') || input.down('KeyS') || input.down('KeyD'));
  if (input.hit('KeyR') && pl.pistolUp && !sprintKey && !pl.wall) {   // (on the wall or holstered the pistol is on his thigh: nothing to reload in the hand)
    if (gun.startReload({
      magOut: (rounds, dropped) => { g.audio.play('magOut', c.pos, 0.7); if (dropped) { const h = c.bones.handL ?? c.pos; const it = g.items.spawn('mag', [h[0], Math.max(0.3, h[1]), h[2]], [(Math.random() - 0.5) * 0.6, -0.2, (Math.random() - 0.5) * 0.6], { fill: 0, who: PLAYER_ID }); it.onBounce = (sp, p) => g.audio.play('magDrop', p, Math.min(1, sp / 3)); } },
      magIn: () => g.audio.play('magIn', c.pos, 0.8),
      rack: () => g.audio.play('rack', c.pos, 0.8),
    })) { c.anim.reload(); g.msg('reloading'); } else if (gun.spare.length === 0) g.msg('no spare magazines');
  }
  if (input.hit('KeyR') && pl.rifleUp && !sprintKey && !pl.wall) {   // the rifle in the hands: the same staged beat off its row (2.4 s: the empty out of the well behind the grip at 0.5 — its black thirty, 'mag' fill 3 — the fullest spare in at 1.5, the charging handle at 2.0)
    if (rifle.startReload({
      magOut: (rounds, dropped) => { g.audio.play('magOut', c.pos, 0.75, { rate: 0.85 }); if (dropped) { const h = c.bones.handR ?? c.pos; const it = g.items.spawn('mag', [h[0] - c.gunDir[0] * 0.1, Math.max(0.3, h[1] - 0.05), h[2] - c.gunDir[2] * 0.1], [(Math.random() - 0.5) * 0.6, -0.3, (Math.random() - 0.5) * 0.6], { fill: 3, who: PLAYER_ID }); it.onBounce = (sp, p) => g.audio.play('magDrop', p, Math.min(1, sp / 3), { rate: 0.8 }); } },
      magIn: () => g.audio.play('magIn', c.pos, 0.85, { rate: 0.85 }),
      rack: () => g.audio.play('rack', c.pos, 0.85, { rate: 0.8 }),
    })) { c.anim.reload(rifle.def.reload.dur); g.msg('reloading the FN2000'); } else if (rifle.spare.length === 0) g.msg('no spare magazines for the FN2000');
  }
  // movement input — none while the selector is open (Space held past a tap: he is choosing what to do, feet still; interact.ts)
  const { fwd, right } = cam.planarBasis();
  let mx = 0, mz = 0;
  if (!pl.sel.open) {
    if (input.down('KeyW')) { mx += fwd[0]; mz += fwd[2]; }
    if (input.down('KeyS')) { mx -= fwd[0]; mz -= fwd[2]; }
    if (input.down('KeyD')) { mx += right[0]; mz += right[2]; }
    if (input.down('KeyA')) { mx -= right[0]; mz -= right[2]; }
  }
  if (g.puppet) {   // scripted movement: straight at the goal (the tour picks goals with a clear line), stop within 10 cm
    mx = 0; mz = 0; const gl = g.puppet.goal;
    if (gl) { const dx = gl[0] - c.pos[0], dz = gl[2] - c.pos[2]; const dl = Math.hypot(dx, dz); if (dl > 0.1) { mx = dx / dl; mz = dz / dl; } }
    if (g.puppet.crouch !== undefined && !pl.dragging && (g.puppet.crouch || canStand(g))) pl.crouch = g.puppet.crouch;
  }
  const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
  if (input.hit('KeyC') && !pl.dragging) { if (!pl.crouch) pl.crouch = true; else if (canStand(g)) pl.crouch = false; else g.msg('no room to stand'); }   // crouch is C, only (Ctrl is the camera-orbit modifier now); standing needs the headroom
  const wantSprint = (input.down('ShiftLeft') || input.down('ShiftRight')) && ml > 0;
  // back to the wall (Q): press against the face behind / beside you and sidle along it; Q again, breaking into a run or walking off it steps away (moveOnWall)
  if (input.hit('KeyQ')) { if (pl.wall) releaseWall(g); else if (!wantSprint) { const why = { blocked: false }; if (!wallSnap(g, cam, why)) g.msg(pl.dragging ? 'hands full' : why.blocked ? "can't get to the wall here" : 'nothing to put your back to here'); } }   // (at a run there is no taking hold: Shift is one of the ways off it; blocked: a face in reach but furniture standing against it where he would go)
  if (pl.wall && wantSprint) releaseWall(g);
  const onWall = !!pl.wall && moveOnWall(g, dt, cam, mx, mz, ml);   // false: free (or let go this very frame — then he walks on from where he stands, below)
  if (!onWall) {
    if (wantSprint && pl.dragging) g.toggleDrag();          // breaking into a sprint lets go of the body
    if (wantSprint && pl.crouch && canStand(g)) pl.crouch = false;   // (under a counter top Shift just crouch-walks on: no standing into the slab)
    if (pl.dragging) pl.crouch = true;
    pl.sprinting = wantSprint && !pl.crouch;
    if (pl.sprinting && gun.reloading) { gun.cancelReload(); c.anim.cancelReload(); }
    if (pl.sprinting && rifle.reloading) { rifle.cancelReload(); c.anim.cancelReload(); }
    let maxSpeed = ml === 0 ? 0 : pl.sprinting ? T.playerSprint : pl.dragging ? T.playerCrouch * 0.6 : (pl.crouch ? T.playerCrouch : T.playerWalk) * pl.pace;   // hauling 80 kg along the floor is slow; the wheel-set pace scales the walk and the crouch-walk alike (the rifle in the shoulder costs no pace: the aim model's moving / settle terms are what the move costs him)
    if (g.puppet?.walk !== undefined && ml > 0) maxSpeed *= g.puppet.walk;
    pl.speedSm = damp(pl.speedSm, maxSpeed, maxSpeed > pl.speedSm ? 6 : 12, dt);
    if (ml > 0) { c.vel = [mx * pl.speedSm, 0, mz * pl.speedSm]; } else { c.vel = v3.scale(c.vel, Math.exp(-14 * dt)); }
    c.pos = v3.mad(c.pos, c.vel, dt);
    const headroom = pl.crouch ? 1.0 : 1.7;
    collidePlayer(g, headroom);
    keepOffGuards(g, dt, headroom);
  }
  const speed = Math.hypot(c.vel[0], c.vel[2]);
  // aim
  const ap = g.aimPoint; const toAim: Vec3 = [ap[0] - c.pos[0], 0, ap[2] - c.pos[2]];
  const aimDist = Math.hypot(toAim[0], toAim[2]);
  pl.aimHeld = false;   // (RMB is the OCP now; the gun comes up on firing, with the rail light, or from the ready carry — see `aiming`)
  const recentlyFired = g.time - pl.lastFireT < 1.6;
  const gunUp = pl.pistolUp;      // the pistol actually in the hand
  const rifleUp = pl.rifleUp;     // the FN2000 in both hands (selected, off the sling, in the kit, not hauling a body)
  const aiming = ((gunUp && (recentlyFired || gun.lightOn || pl.aimHeld)) || (rifleUp && pl.braced)) && !pl.sprinting && !pl.dragging;   // light on = weapon up: the rail light is bolted to the gun, so pointing the light at the cursor means pointing the gun there; the rifle is braced in the shoulder whenever it is in the hands (Player.braced) — up, aimed, its arc laid if the ring launcher is selected
  const cursorPitch = () => {   // gun pitch that points AT the world point under the cursor — floor included — unless a fixture or a guard is targeted
    let targetY = ap[1] + 0.03;
    if (g.aimTarget) targetY = clamp(g.aimTarget.pos[1], 0.3, 2.95);
    else if (g.aimGuard) targetY = g.aimGuard.char.pos[1] + 1.2;
    const gunY = c.pos[1] + (pl.crouch ? 0.95 : 1.4);
    return clamp(Math.atan2(targetY - gunY, Math.max(aimDist, 0.5)), -60 * DEG, 70 * DEG);
  };
  if (pl.dragging) {
    // dragging: you have it by the ankles — the ragdoll's two ankle particles are pinned to a point at your hands (DRAG_HANDS ahead, shin height) and the rest
    // of it trails through its own constraints, sliding on the floor with friction, bumping round door jambs and desk legs on its own collision. You face
    // its hips, so moving away from it IS a backward crouch-walk. Torn out of your hands if it wedges (the legs cannot follow the hands any more:
    // Ragdoll.strain) or if it somehow got away from you.
    const body = pl.dragging.char; const rag = body.ragdoll;
    const hips = body.bones.hips ?? body.pos; const dx = hips[0] - c.pos[0], dz = hips[2] - c.pos[2]; const d = Math.hypot(dx, dz);
    if (d > 1e-4) pl.dragYaw = Math.atan2(dx, dz);
    pl.dragStuckT = rag && rag.strain > 0.2 ? pl.dragStuckT + dt : 0;
    if (!rag || d > 2.2 || pl.dragStuckT > 0.25) { const wedged = rag && pl.dragStuckT > 0.25; g.toggleDrag(); if (wedged) g.msg('body dropped — it was wedged'); }
    else {
      const DRAG_HANDS = 0.35, f = c.forward(); const hx = c.pos[0] + f[0] * DRAG_HANDS, hz = c.pos[2] + f[2] * DRAG_HANDS;
      rag.setPin(RAG.ankL, [hx + f[2] * 0.1, 0.42, hz - f[0] * 0.1]); rag.setPin(RAG.ankR, [hx - f[2] * 0.1, 0.42, hz + f[0] * 0.1]);   // an ankle in each hand, 20 cm apart across your facing
      c.aimYaw = pl.dragYaw; c.aimPitch = damp(c.aimPitch, -0.9, 6, dt);
      c.bodyYaw = approachAngle(c.bodyYaw, pl.dragYaw, 10 * dt);
      pl.backpedal = speed > 0.2 && Math.cos(wrapAngle(pl.dragYaw - v3.yawOf(c.vel))) < 0; c.anim.reverse = pl.backpedal;
      // it is not silent: a soft periodic scrape while the body is actually sliding (guards close by will come and look)
      if (speed > 0.3 && !rag.sleeping) { pl.dragNoiseT -= dt; if (pl.dragNoiseT <= 0) { pl.dragNoiseT = 0.55; g.audio.play('propScrape', hips, 0.25, { rate: 0.7 }); g.events.push({ kind: 'prop', pos: [hips[0], 0, hips[2]], time: g.time, loud: false, level: 0.22, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, 0.22); } }
    }
  } else if (pl.sprinting) {
    // CoD-style sprint: gun down, body follows the run direction, no aiming
    const moveYaw = v3.yawOf(c.vel);
    c.bodyYaw = approachAngle(c.bodyYaw, moveYaw, 14 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, -0.3, 6, dt);
    pl.backpedal = false; c.anim.reverse = false;
  } else if (pl.wall) {
    // back to the wall: flat against it when parked — turned toward the way he is going while he sidles (the walk cycle has no sidestep) with the chest twisted
    // back square to the room — eyes coming round toward the open end he is parked at. The pistol is on his thigh for as long as he is on it (wallSnap), so
    // there is no aim here: `aiming` wants the gun in the hand
    const w = pl.wall; const awayYaw = Math.atan2(w.n[0], w.n[2]); const moving = Math.abs(w.v) > 0.3;
    const turnK = smoothstep(0.1, 0.9, Math.abs(w.v) / Math.max(0.3, pl.crouch ? g.tune.playerCrouch : WALL_PACE));   // the legs come round WITH the sidle: nothing at a creep, the full 55° at his sidle pace — no snap from flat to turned the moment he sets off
    c.bodyYaw = approachAngle(c.bodyYaw, awayYaw - w.side * WALL_TURN * turnK, 10 * dt);   // (the rate stays brisk — squaring up to the wall on taking it is quick; it is the AMOUNT of leg turn that now follows the sidle speed)
    const look = awayYaw - w.side * (w.atEdge === w.side ? WALL_LOOK : moving ? 15 * DEG : 8 * DEG);   // (yaw − = to his right; side + = his right)
    c.aimYaw += wrapAngle(look - c.aimYaw) * (1 - Math.exp(-8 * dt)); c.aimPitch = damp(c.aimPitch, 0.05, 6, dt);
    pl.backpedal = false; c.anim.reverse = moving && w.v * w.side < 0;   // (the beat after a change of direction: still coasting the old way with the legs already turned the new one)
  } else {
    if (aimDist > 0.25) c.aimYaw += wrapAngle(v3.yawOf(toAim) - c.aimYaw) * (1 - Math.exp(-16 * dt));   // eased, not snapped: the arms swing through to a new bearing instead of teleporting
    c.aimPitch = damp(c.aimPitch, cursorPitch(), 12, dt);
    // a leaf he is walking open (or about to, or easing by hand: game.ts handsOnDoors feeds anim.doorPush) is taken square on unless the gun is actually up:
    // nobody backs through a door he is pushing, and the free hand only reaches wood in front of him (character.ts doorLayer) — the hips turn INTO the face he
    // pushes (up to 20° off the line of travel), the chest comes round with them (the animator lets the aim twist go while the hand is on), the eyes stay on the aim
    const dp = c.anim.doorPush; const intoDoor = dp && dp.w >= 1 && !aiming && !dp.holdOnly ? Math.atan2(-dp.n[0], -dp.n[2]) : null;   // (a leaf its closer merely rests on him while he stands scanning the room does not turn him round to it)
    if (speed > 0.2) {
      const moveYaw = v3.yawOf(c.vel);
      const d = Math.cos(wrapAngle(c.aimYaw - moveYaw));
      if (intoDoor !== null) pl.backpedal = false;
      else if (pl.backpedal ? d > -0.05 : d < -0.35) pl.backpedal = !pl.backpedal;
      // hips follow the legs' travel direction (or its reverse) but yield up to ~45° toward the aim so the spine twist stays natural
      const base = pl.backpedal ? wrapAngle(moveYaw + Math.PI) : moveYaw;
      const bodyTarget = intoDoor !== null ? base + clamp(wrapAngle(intoDoor - base), -0.35, 0.35) : base + clamp(wrapAngle(c.aimYaw - base), -0.8, 0.8) * (aiming ? 1 : 0.6);   // (square to the leaf, within 20° of his line: it swings as it opens and he is walking through, not round it)
      c.bodyYaw = approachAngle(c.bodyYaw, bodyTarget, (intoDoor !== null ? 12 : 9) * dt);
      c.anim.reverse = pl.backpedal;
    } else {
      pl.backpedal = false; c.anim.reverse = false;
      const off = wrapAngle((intoDoor ?? c.aimYaw) - c.bodyYaw);
      const limit = intoDoor !== null ? 0.25 : aiming ? 0.6 : 1.2;
      if (Math.abs(off) > limit) c.bodyYaw = approachAngle(c.bodyYaw, (intoDoor ?? c.aimYaw) - Math.sign(off) * limit * 0.7, 7 * dt);
    }
  }
  c.anim.speed = speed; c.anim.crouchTarget = pl.crouch ? 1 : 0;
  if (pl.wall) { c.anim.stance = 'wall'; c.anim.stackSide = pl.wall.side; c.anim.wallPeek = pl.wall.peek; c.anim.wallYaw = wrapAngle(Math.atan2(pl.wall.n[0], pl.wall.n[2]) - c.bodyYaw); }   // back flat to the face whatever the legs do (the animator is told which way the wall faces off his front: square behind when parked, 55° round while the legs are turned to sidle), head / hands / lead foot toward the way he last went, leaning out with the peek (character.ts 'wall'; releaseWall takes it off — the tour's beats own the stance the rest of the time)
  c.anim.upper = pl.sprinting || pl.dragging ? 'none' : aiming ? 'aim' : gunUp ? 'relaxed' : 'none';
  { const dp = c.anim.doorPush; const inHands = rifleUp && !c.anim.hideHeldItem; armRifle(g, inHands, !inHands ? null : pl.sprinting ? 'lowLong' : dp && dp.w >= 1 && !aiming ? 'portLong' : 'shoulder'); }   // the FN2000 in both hands = the R1 long-gun solve, its carriage forced by what he is doing (armRifle: shouldered whenever it is in the hands, the low ready for the sprint, the port for a leaf under the hand); slung / no rifle = the pistol's numbers back. hideHeldItem: the lock tools' / a hold's layer still easing out for a few frames after it ended keeps the hands 'busy' — combat.ts handProps draws the rifle on his back by the same flag, so the arms let go of it for exactly those frames too
  // --- slot actions
  pl.fireCd -= dt;
  if (gunUp && !pl.sprinting && !pl.dragging) {
    if (input.lmbHit() && pl.fireCd <= 0 && pl.equipT <= 0) {   // (equipT: the pistol only just came out in the rifle's place — X off the FN2000 — and is not up yet; never non-zero in a kit without the rifle)
      if (gun.fire()) {
        pl.fireCd = gun.def.cd; pl.lastFireT = g.time;   // the row's cadence (the Five-seveN's 0.22 s; no jitter in Sam's hands)
        const pt = g.puppet?.target && g.puppet.target.state !== 'dead' ? g.puppet.target : null;
        const tgt: Vec3 = pt ? v3.add(pt.char.pos, [0, 1.25, 0]) : g.aimTarget ? v3.copy(g.aimTarget.pos) : g.aimGuard ? v3.add(g.aimGuard.char.pos, [0, 1.25, 0]) : [ap[0], ap[1] + 0.03, ap[2]];   // a fixture under the reticle IS the target (that is what 'click: shoot' promises); else a guard under the cursor; else the world point under the cursor (the same point the gun / rail light pitch to)
        fireWeapon(g, c, tgt, true, { spread: samSpread(g) + samAim(g) });   // dead-on — unless rounds are going past his own head: then it opens up with his suppression (suppression.ts samSpread: 0 at rest, 0 with the flag off, 0 for the tour's scripted double-taps) — and by the aim model's cone (aim.ts samAim: unsettled, a man crossing, his own feet; 0 with tune.aimModel off / under the puppet)
        if (gun.roundsReady === 0) g.msg('empty — press R');
      } else { pl.fireCd = 0.25; g.audio.play('dryFire', c.muzzle, 0.7); if (!gun.reloading) g.msg(gun.roundsReady === 0 ? 'click — empty (R to reload)' : 'reloading…'); }
    }
    // right click with the pistol out: the OCP zaps the LIGHT the reticle has snapped to (aimTarget: the auto-aimed fixture or the breaker; or the lit torch / weapon
    // light of the man the ring sits on — his light is electronics too, g.ocp handles both). On a man with no light burning there is nothing for it to do, and it does
    // nothing: no charge spent, no click, no line (the ring shows no right-button affordance there either — overlay.ts / ocpable)
    if (input.rmbHit() && (ocpable(g) || (!g.aimTarget && !g.aimGuard))) g.ocp(g.aimTarget);   // (nothing snapped at all: the OCP's own dry click, as it always gave)
  }
  // the FN2000 in the hands (docs/internal/sc20k-design.md §5): the LEFT button = a round, always — SEMI one a click, AUTO one every auto.interval while it is held, each
  // of a held string wider than the last (weapons.ts Firearm.autoSpread); the RIGHT button = the selected ATTACHMENT (2 again cycles it): RING → a ring airfoil along
  // the arc the overlay is drawing (launcher.ts), none → nothing (the OCP is the pistol's — said once, the first time it is tried over a light); the brace is not a
  // button any more (Player.braced: always, in the hands); nothing at all inside the equip beat (equipT: it is still coming off the sling)
  let ringPreview: ThrowSolution | null = null;
  rifle.autoIdle(dt, rifleUp && input.lmb());   // (the AUTO string lapses a quarter second after the trigger comes up — or the moment the rifle is not being fired as a rifle)
  if (rifleUp && !pl.sprinting) {
    const pull = rifle.automatic ? input.lmb() || input.lmbHit() : input.lmbHit();
    if (pull && pl.fireCd <= 1e-4 && pl.equipT <= 0) {   // (1e-4: 0.1 s is six sixtieths exactly — the float dust of six subtractions must not cost the string a seventh frame; the guards' burst clock does the same)
      const grow = rifle.autoSpread;   // (this round's share of the string's growth, read before it is booked)
      if (rifle.fire()) {
        pl.fireCd = rifle.automatic ? rifle.def.auto!.interval : rifle.def.cd; pl.lastFireT = g.time; rifle.autoFired();
        const pt = g.puppet?.target && g.puppet.target.state !== 'dead' ? g.puppet.target : null;
        const tgt: Vec3 = pt ? v3.add(pt.char.pos, [0, 1.25, 0]) : g.aimTarget ? v3.copy(g.aimTarget.pos) : g.aimGuard ? v3.add(g.aimGuard.char.pos, [0, 1.25, 0]) : [ap[0], ap[1] + 0.03, ap[2]];   // as the pistol's: the fixture, the man, or the world point the reticle has
        fireWeapon(g, c, tgt, true, { weapon: rifle.def, spread: rifleSpread(g, speed) + grow + samSpread(g) + samAim(g) });   // his hands on it (still / moving / crouched, braced), the string's growth, and rounds past his own head — and every one of them feeds everybody else's suppression inside fireWeapon like a pistol round
        if (rifle.roundsReady === 0) g.msg('FN2000 empty — press R');
      } else if (input.lmbHit()) { pl.fireCd = 0.25; g.audio.play('dryFire', c.muzzle, 0.7); if (!rifle.reloading) g.msg(rifle.roundsReady === 0 ? 'click — the FN2000 is empty (R)' : 'reloading…'); }   // (the PRESS clicks dry once; a trigger HELD on auto over an empty or reloading gun is silence, not a metronome — review 08-10 #17)
    }
    if (rifle.attachment === 'ring') {   // the ring launcher on the right button: its arc previewed for as long as it is selected and a ring is left to fly it, one ring per press
      const from = sc20kLauncherMuzzle(c); const at = ringAimPoint(g, from);
      if (rifle.rings > 0) ringPreview = ringSolve(g, from, at);   // the arc, live, from the tube to the first thing it would meet (handed to the overlay below as throwPreview: the canisters' polyline)
      if (input.rmbHit()) {
        if (pl.equipT > 0) { /* still coming off the sling */ }
        else if (rifle.rings <= 0) { g.audio.play('dryFire', c.muzzle, 0.4); g.msg('no ring airfoils left — they are not coming back'); }
        else if (rifle.ringCd > 0) { g.audio.play('dryFire', c.muzzle, 0.4); g.msg('cycling the launcher…'); }
        else { fireRing(g, c, from, at); if (!g.infiniteAmmo) rifle.rings--; rifle.ringCd = LAUNCHER.cd; pl.fireCd = Math.max(pl.fireCd, 0.3); pl.lastFireT = g.time; c.anim.fire(); if (rifle.rings <= 0) g.msg('that was the last ring airfoil'); }   // (the trigger hand worked the tube: a beat before the next round too)
      }
    } else if (input.rmbHit() && g.aimTarget && !pl.ocpHinted) { pl.ocpHinted = true; g.msg(`the OCP is on the pistol — 1 draws it (2 again puts the ring launcher on this button)`); }   // no attachment: the right button is dead with the rifle up — said once, over a light, then never again
  }
  // throwables: preview while a canister slot (3 / 4) is up or G is held; throw on LMB (canister up) or on G release. G throws the throwable selected last
  // (smoke until 4 is pressed), falling back to the other kind when that one has run out
  const gHeld = !pl.wall && (input.down('KeyG') || input.hit('KeyG'));   // hit(): a tap that began and ended inside this frame still counts as held for one frame (so its release next frame throws). Not on the wall: the hands are flat on the plaster there (review finding: G still arced and spent a canister)
  if (gHeld && rifleUp && g.throwCount(pl.throwKind === 'flash' && pl.flashbangs > 0 ? 'flash' : pl.canisters > 0 ? 'smoke' : 'flash') > 0) setHolstered(g, true, true);   // a quick-throw with the rifle in the hands slings it first (the throwing arm is the trigger arm): it stays on his back after — E or 2 brings it round again
  const prevPreview = pl.throwPreview;              // on the release frame G is up, so the arc from the last held frame is the one to throw
  pl.throwPreview = null;
  if (g.throwCount(pl.throwKind) <= 0 && g.throwCount(pl.throwKind === 'flash' ? 'smoke' : 'flash') > 0) pl.throwKind = pl.throwKind === 'flash' ? 'smoke' : 'flash';
  const slotKind: ThrowKind | null = pl.holstered ? null : pl.canisterSel;   // the can in the fist: a canister slot selected AND drawn — the same rule combat.ts handProps draws the fist by (Player.canisterSel), so what is thrown and what is shown cannot disagree
  // a wind-up remembers what it was aimed with: spending the last smoke can on LMB mid-hold flips `throwKind` (and clears the slot) a
  // frame later, and the G release must not then cost a stun charge nobody selected. An explicit 2 / 3 press during the hold still switches it.
  const kind: ThrowKind = slotKind ?? (pl.throwHeld ? pl.heldKind : pl.throwKind);
  pl.heldKind = kind;
  if (!pl.sprinting && g.throwCount(kind) > 0 && (slotKind || gHeld)) {
    const tp = g.puppet?.throwAt ?? ap;
    pl.throwPreview = g.items.solve(throwOrigin(g), [tp[0], Math.max(0.05, Math.min(tp[1], 2.6)), tp[2]]);
    if (slotKind && input.lmbHit() && pl.fireCd <= 0) { doThrow(g, pl.throwPreview, kind); pl.fireCd = 0.6; }
  }
  if (pl.throwHeld && !gHeld && !pl.sprinting) { const sol = pl.throwPreview ?? prevPreview; if (sol) doThrow(g, sol, kind); }   // quick-throw on G release
  pl.throwHeld = gHeld && (pl.throwHeld || g.throwCount(kind) > 0);   // a gesture that ran its kind dry stays this kind until G comes up (it just throws nothing)
  if (!pl.throwPreview && ringPreview && !pl.throwHeld) pl.throwPreview = ringPreview;   // the launcher's arc rides the canisters' polyline (overlay.ts) — a canister being aimed has it instead
  if (pl.pendingThrow) { pl.pendingThrow.t -= dt; if (pl.pendingThrow.t <= 0) {
    const { sol, kind: k2 } = pl.pendingThrow;
    const it = g.items.spawn(k2 === 'flash' ? 'flash' : 'smoke', throwOrigin(g), sol.v0, k2 === 'flash' ? { fuse: fx.bang.fuse, who: PLAYER_ID } : { who: PLAYER_ID });
    it.onBounce = (sp, p) => { g.audio.play('canisterBounce', p, Math.min(1, sp / 4)); g.events.push({ kind: 'shot', pos: v3.copy(p), time: g.time, loud: false }); };
    chronThrown(g, k2); pl.pendingThrow = null; if (g.infiniteAmmo) { if (k2 === 'flash') pl.flashbangs++; else pl.canisters++; }   // unlimited ammo (the start card's sandbox row): the belt refills as the can leaves the hand
    if ((pl.slot === 'smoke' && pl.canisters === 0) || (pl.slot === 'flash' && pl.flashbangs === 0)) pl.slot = 'pistol';   // the last can of the selected kind is away: back onto the pistol (drawn — the hand that threw it is free)
  } }
  c.update(dt);
  // the weapon light: physically mounted under the barrel / on the fore-end — its position and direction ARE the gun's, aiming or not (rigProps.RIG.pistol.light*, RIG.sc20k light / lens)
  gun.infinite = g.infiniteAmmo; rifle.infinite = g.infiniteAmmo;
  const L = pl.light; L.peakIntensity = L.intensity = T.playerLight; L.radius = g.engine.settings.flashlightRadius * 0.7;   // weapon light bezel is a bit smaller than the guards' hand torches
  poseGunLight(g);   // sprinting: gun down, light dark; hands still coming off the lock tools: the gun (and its light) is on the thigh
  // footsteps (for audio + AI hearing): step events from the locomotion phase — walking, crouch-walking, sprinting, the sidle along a wall and the crouched haul of
  // a body all tread here; the level is the gait's × the floor's (floor.ts tread: carpet 0.6, stone 1.1 … — one number for the mixer, the guards and the meter)
  const prevPhase = pl.stepPhase; pl.stepPhase = c.anim.phase;
  if (speed > 0.4 && ((prevPhase < 0.5) !== (pl.stepPhase < 0.5))) {   // either crossing of the half-cycle: the cycle runs backwards while backpedalling
    const base = pl.sprinting ? 1 : pl.crouch ? 0.125 : speed > 2 ? 0.6 : 0.26;   // (crouch / walk per-step levels carry the clips' retiming — 0.72 / 1.06 m/s natural, so ~1.4x the steps per metre — at the old per-SECOND loudness: 0.18 x 0.69, 0.35 x 0.73; what a guard accumulates over a stretch of floor is unchanged)
    const loud = tread(g, c.pos, base, true);
    g.events.push({ kind: 'step', pos: v3.copy(c.pos), time: g.time, loud: false, level: loud }); pl.noise = Math.max(pl.noise, loud);
    wetFootfall(g, pl.stepPhase < 0.5);   // in from the rain: a wet print under the foot that landed, for his next few steps (wet.ts — a decal, seen by the player only; nothing without decals or a dry man)
  }
}

/** The cone Sam's next rifle round is drawn with for how he stands (RIFLE_SPREAD): still or on the move at `speed`, × crouched, × braced. The AUTO string's growth
 *  and his suppression's share are added at the fire site (they are the row's and suppression.ts's, not his stance's). */
export function rifleSpread(g: Game, speed: number): number {
  const pl = g.player, S = RIFLE_SPREAD;
  return (speed > S.moveAt ? S.moving : S.still) * (pl.crouch ? S.crouchK : 1) * (pl.braced ? S.braceK : 1);
}

/** Living guards are solid to you and never step aside (updateGuard / runGuardScript separate guards from each other only — a man must not be blocked or steered by a
 *  player he may not even know is there), so you are the one who yields, and every shove is collided with the statics and the world edge AGAIN, so none ever
 *  leaves you standing in a wall for the frame (or, pinned to a 12 cm partition, popped out of its far side):
 *  - a man who STANDS (or whom you run into): pushed straight back out to KEEP_OFF — capped above sprint speed, so solid to anything you do, while a man a script
 *    drops on top of you eases you off over a few frames instead of popping you half a metre; squeezing between him and a wall you slide along the wall past him;
 *  - a man WALKING into you (you within ~50° of dead ahead of the leg he is on): shouldered SIDEWAYS off his line of travel — to the side of it you are on if the
 *    statics leave your body the room to clear him there, else across it if the other side does, else to whichever side has the more room (he brushes through
 *    what is left of the overlap), and only where neither has any to speak of (a narrow doorway) does he simply walk through you — never straight ahead of him,
 *    which would carry you the length of the corridor; less squarely in front, straight away from him minus the share that is only his stride closing; and
 *    wherever the statics eat the shove (pinned to the wall beside his track) you stay where you stand rather than the leftover feeding you along the wall ahead
 *    of him frame after frame. In live play a man coming on has seen you long before he touches you; this is what the tour's unseen Sam and the sandbox get.
 *  `y1` = the headroom updatePlayer collided you with this frame. */
function keepOffGuards(g: Game, dt: number, y1: number) {
  const p = g.player.char.pos;
  const room = (sx: number, sz: number) => { const hit = g.col.raycast([p[0], 0.45, p[2]], [sx, 0, sz], 1.5); return (hit ? hit.t : 1.5) - BODY_R; };   // how far your centre can travel that way before your circle meets a static (or a leaf) at shin height
  for (const gd of g.guards) {
    if (gd.state === 'dead' || gd.held) continue;   // (the man in his arm is placed off him, not kept off him: updateHold)
    const dx = p[0] - gd.char.pos[0], dz = p[2] - gd.char.pos[2]; const l = Math.hypot(dx, dz);
    if (l >= KEEP_OFF) continue;
    const gv = gd.char.vel; const gs = Math.hypot(gv[0], gv[2]); const walking = gs > 0.2;
    let nx: number, nz: number;   // straight away from him (dead on his centre: to the right of wherever he is heading)
    if (l > 1e-4) { nx = dx / l; nz = dz / l; } else if (gs > 1e-3) { nx = gv[2] / gs; nz = -gv[0] / gs; } else { nx = 1; nz = 0; }
    let cap = 6, fx = 0, fz = 0, ahead = 0;   // his line of travel — the leg to his next waypoint (steady while he pivots onto it through you), else his velocity — and how squarely you are in front on it (cos)
    if (walking) {
      const wp = gd.pathI < gd.path.length ? gd.path[gd.pathI] : null; const wx = wp ? wp[0] - gd.char.pos[0] : 0, wz = wp ? wp[2] - gd.char.pos[2] : 0, wl = Math.hypot(wx, wz);
      if (wl > 0.3) { fx = wx / wl; fz = wz / wl; } else { fx = gv[0] / gs; fz = gv[2] / gs; }
      ahead = nx * fx + nz * fz;
      if (ahead > 0.64) {
        let sx = nx - ahead * fx, sz = nz - ahead * fz; const sl = Math.hypot(sx, sz); let b = l * sl;   // your side of his line, and how far off it you already are
        if (b >= 0.04) { sx /= sl; sz /= sl; } else { sx = fz; sz = -fx; b = 0; }                      // (square in his way: his right)
        const near = b + room(sx, sz), far = room(-sx, -sz) - b;                                        // how far off his line you can get on your side / by crossing to the other
        if (near < KEEP_OFF && (far >= KEEP_OFF || far > near + 0.25)) { if (far < 0.25) continue; sx = -sx; sz = -sz; } else if (near < 0.25) continue;   // (crossing his line only for clearly more room; none worth having either way — a narrow doorway — he walks through you)
        nx = sx; nz = sz; cap = 4; ahead = 0;
      }
    }
    const push = Math.min(KEEP_OFF - l, cap * dt); const bx = p[0], bz = p[2];
    p[0] += nx * push; p[2] += nz * push;
    if (ahead > 0) { const his = ahead * Math.min(push, gs * dt * ahead); p[0] -= fx * his; p[2] -= fz * his; }   // (the forward share of a straight shove that is only his stride closing on you this frame is not yours to travel: half beside him you would still ride along)
    collidePlayer(g, y1);
    if (walking && (p[0] - bx) * nx + (p[2] - bz) * nz < 0.5 * push) { p[0] = bx; p[2] = bz; const s = g.player.safe; if (s) { s[0] = bx; s[2] = bz; } }   // the statics ate it: pinned — stay put (bx, bz is already a settled spot) and let him brush through
  }
}

// ------------------------------------------------------------ back to the wall (Q) — Chaos Theory's wall hug: your back to a wall face, sidling along it, peeking round its end
/** how far beyond the body circle a face may stand for Q to reach it (m) */
const WALL_REACH = 0.7;
/** the sliver of air left between the body circle and the face once he is on it (centre BODY_R + this off the plane) */
const WALL_GAP = 0.03;
/** probe heights: a face must show at the KNEE and at the CHEST (a wall, a 1.4 m cubicle partition, a server rack, a vending machine…) or at the knee and ABOVE DOOR
 *  HEIGHT (glazing: a sill with a header over it) — never a desk edge, a counter, a filing cabinet, the back of the couch */
const KNEE_Y = 0.45, CHEST_Y = 1.35, HIGH_Y = 2.7;
/** two knee-height faces are one wall to slide along if their planes agree to this (a door jamb stands 1.2 cm proud: it ends the face — the doorway is not wall) */
const COPLANAR = 0.01;
/** …while whatever stands over the knee-height face may be set back or proud by this much and still count as wall up there (a notice board, glass in its frame) */
const UPPER_TOL = 0.08;
/** a break between coplanar faces narrower than this is bridged (the 9 cm between two server racks); a doorway or the mouth of an aisle is not */
const WALL_BRIDGE = 0.15;
/** the shortest run of face worth putting your back to: both shoulders on it */
const WALL_MIN_FACE = 2 * BODY_R + 0.06;
/** pace along the wall standing (crouched: tune.playerCrouch) — a sidle, never a run */
const WALL_PACE = 1.4;
/** while sliding, the legs turn this far toward the direction of travel (the walk cycle has no sidestep) and the chest twists back square to the room; parked, he is flat to the wall */
const WALL_TURN = 55 * DEG;
/** parked at an open end (or headed for it), eyes and chest come round toward it this much; at full peek the neck cranes WALL_PEEK_LOOK further */
const WALL_LOOK = 25 * DEG, WALL_PEEK_LOOK = 30 * DEG;
/** let go when something holds him this far off the plane (a guard shouldering through, a leaf swung into him), or when the stick is held AWAY from the wall (more
 *  than half of it square off the face) for this long */
const WALL_SHOVE_OFF = 0.25, WALL_AWAY_SECS = 0.25;
/** seconds over which taking hold eases him onto the face, and over which the peek comes in / goes */
const WALL_SETTLE = 0.22, WALL_PEEK_SECS = 0.3;

/** Player.wall while his back is to a wall. The face is the plane {q · n = d}, n out of the wall into the room, along = [−n.z, 0, n.x] (his right when flat to it);
 *  [lo, hi] is the run of coplanar, tall-enough STATIC face along `along`, traced once when he took hold (statics never move; leaves and furniture are not wall),
 *  openLo / openHi whether the way on past each end is open (an outside corner, a jamb: somewhere to peek round) or walled (an inside corner: he simply stops).
 *  u = his station along it (clamped so the whole body stays on the face), v = signed sidle speed, side = the way he last went (which shoulder leads, which way
 *  the head turns), off = how far something is holding him off the plane right now (eases back to 0 as it lets him), awayT = stick-held-away clock, settle = 0→1
 *  ease onto the face from `from` (where Q found him), peekDir = the end the current (or fading) peek is round. atEdge / peek / crouched are the read-outs game.ts documents. */
export interface WallHold {
  n: Vec3; along: Vec3; d: number; lo: number; hi: number; openLo: boolean; openHi: boolean;
  u: number; v: number; side: -1 | 1; off: number; awayT: number; settle: number; from: Vec3;
  /** the way (±1) something the trace could not see stopped him, and for how long it has: no re-trying it every frame (cleared when the stick lets off that way, or after half a second for another look) */
  blockDir: -1 | 0 | 1; blockT: number;
  /** has his back actually reached the face yet (a read-back found him within the shove allowance of the plane)? Only for the words when he comes off: shoved
   *  off a wall he was on, or never got to it — a carton stack, a chair, a man between him and it that the face trace could not see */
  seated: boolean;
  /** was the selected item in his hand when he took the wall? On it the hands are always empty (wallSnap holsters it: Chaos Theory's wall hug is a hands-on-
   *  the-plaster pose, and nothing is fired from it); the frame he steps off, releaseWall puts it back in his hand if this says so. E on the wall flips it,
   *  1 / 2 / 3 set it (updatePlayer) — choosing what he comes off with. */
  drawn: boolean;
  atEdge: -1 | 0 | 1; peek: number; peekDir: -1 | 1; crouched: boolean;
}

/** The static face lying in the plane (n, d) at station u along t — if there is one there fit to lean on: from a point 0.3 m out in the room, a knee-height ray
 *  straight into the plane must meet a static (never a leaf) within COPLANAR of it, facing back out along n; and so must a chest-height ray or, failing that, one
 *  above door height (those two within UPPER_TOL: what is up there may be a board hung on the wall or glass set back in its frame). Returns that knee-height box's
 *  extent along t. (An origin inside a piece of furniture standing against the wall sees through it to the wall: the body's own collision then stops him at it.) */
function faceAt(col: StaticCollision, n: Vec3, d: number, t: Vec3, u: number): [number, number] | null {
  const OFF = 0.3; const ox = t[0] * u + n[0] * (d + OFF), oz = t[2] * u + n[2] * (d + OFF); const dir: Vec3 = [-n[0], 0, -n[2]];
  const cast = (y: number, tol: number) => { const h = col.raycast([ox, y, oz], dir, OFF + tol + 0.02); return h && h.index < 1e6 && Math.abs(h.t - OFF) <= tol && h.n[0] * n[0] + h.n[2] * n[2] > 0.98 ? h : null; };
  const knee = cast(KNEE_Y, COPLANAR); if (!knee) return null;
  if (!cast(CHEST_Y, UPPER_TOL) && !cast(HIGH_Y, UPPER_TOL)) return null;
  const b = col.boxes[knee.index]; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const hw = Math.abs(t[0] * cs - t[2] * sn) * b.h[0] + Math.abs(t[0] * sn + t[2] * cs) * b.h[2];   // the box's half-width along t (box local X = (cos, 0, −sin), local Z = (sin, 0, cos) in world XZ)
  const uc = b.c[0] * t[0] + b.c[2] * t[2];
  return [uc - hw, uc + hw];
}

/** The whole run of wall through station u0: the face there (or within a body radius either side — he may be level with a jamb or the crack between two racks),
 *  widened both ways across coplanar neighbours and across breaks narrower than WALL_BRIDGE — as far as it goes (taking hold: the run is kept), or only `look`
 *  either side of u0 (asking whether there is one: enough to know the body fits within a sidestep). */
function traceFace(col: StaticCollision, n: Vec3, d: number, t: Vec3, u0: number, look = Infinity): [number, number] | null {
  let seg: [number, number] | null = null;
  for (const du of [0, -0.21, 0.21, -BODY_R, BODY_R]) if ((seg = faceAt(col, n, d, t, u0 + du))) break;
  if (!seg) return null;
  let [lo, hi] = seg;
  for (let i = 0; i < 32 && hi < u0 + look; i++) { const nx = faceAt(col, n, d, t, hi + 0.01) ?? faceAt(col, n, d, t, hi + WALL_BRIDGE); if (!nx || nx[1] <= hi + 1e-4) break; hi = nx[1]; }
  for (let i = 0; i < 32 && lo > u0 - look; i++) { const nx = faceAt(col, n, d, t, lo - 0.01) ?? faceAt(col, n, d, t, lo - WALL_BRIDGE); if (!nx || nx[0] >= lo - 1e-4) break; lo = nx[0]; }
  return [lo, hi];
}

/** Is the way on past an end of the face open (an outside corner, a doorway: something to peek round) or shut off (the other wall of an inside corner, a leaf
 *  standing across it)? Knee- and hip-height rays from the parked station `uEnd` on along ±t, a body radius and a hand. */
function endOpen(col: StaticCollision, n: Vec3, d: number, t: Vec3, uEnd: number, s: -1 | 1): boolean {
  const px = t[0] * uEnd + n[0] * (d + BODY_R + WALL_GAP), pz = t[2] * uEnd + n[2] * (d + BODY_R + WALL_GAP); const dir: Vec3 = [t[0] * s, 0, t[2] * s];
  for (const y of [KNEE_Y, 1.0]) if (col.raycast([px, y, pz], dir, BODY_R + 0.2)) return false;
  return true;
}

/** The radius the prop solver gives a character's circle (game.ts updateProps): loose furniture nearer his centre than this is holding him off. */
const PROP_BODY_R = 0.3;
/** Push the circle (q, r) out of the loose furniture as it stands this frame, as if it were nailed down (props.ts circleContact's measure, prop by prop, a
 *  few passes) — findWall's guess at where the prop solver will hold him: a carton stack or a chair standing against the wall does not yield to a man leaning
 *  back on it (whatever it cannot pass on to the wall it hands straight back to him), so a station inside one is a station he never reaches. Mutates q;
 *  true if anything moved it. */
function clearOfProps(g: Game, q: Vec3, r: number): boolean {
  let moved = false;
  for (let it = 0; it < 3; it++) {
    let any = false;
    for (const pr of g.props.props) {
      const dx = q[0] - pr.x, dz = q[2] - pr.z; if (dx * dx + dz * dz > (pr.radius + r) * (pr.radius + r)) continue;
      const cs = pr.cs, sn = pr.sn; const lx = cs * dx - sn * dz, lz = sn * dx + cs * dz;                     // the centre in the prop's frame
      const qx = clamp(lx, -pr.hx, pr.hx), qz = clamp(lz, -pr.hz, pr.hz); const ex = lx - qx, ez = lz - qz; const d2 = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      let nx: number, nz: number, pen: number;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; pen = r - d; }
      else { const px = pr.hx - Math.abs(lx), pz = pr.hz - Math.abs(lz); if (px < pz) { nx = lx < 0 ? -1 : 1; nz = 0; pen = px + r; } else { nx = 0; nz = lz < 0 ? -1 : 1; pen = pz + r; } }
      q[0] += (cs * nx + sn * nz) * pen; q[2] += (-sn * nx + cs * nz) * pen; any = moved = true;
    }
    if (!any) break;
  }
  return moved;
}

/** What Q would take hold of from here: the nearest static face within WALL_REACH of the body (16 knee-height rays round him; box sides are upright by
 *  construction), tall enough and long enough by traceFace, with room on it for the body within a short sidestep of where he stands — clear of the statics
 *  AND of the furniture standing there — and nothing between him and that spot. u = the station he would take; [lo, hi] the whole run (`quick`: only traced
 *  a metre either side — the answer, not the run, is wanted). null = nothing to press against; `why.blocked` then says a face WAS in reach but furniture
 *  keeps him off it (the words differ). */
function findWall(g: Game, quick = false, why?: { blocked: boolean }): { n: Vec3; t: Vec3; d: number; lo: number; hi: number; u: number } | null {
  const pl = g.player, p = pl.char.pos, col = g.col; const f = pl.char.forward();
  const cands: { n: Vec3; d: number; score: number }[] = [];
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8; const dir: Vec3 = [Math.sin(a), 0, Math.cos(a)];
    const hit = col.raycast([p[0], KNEE_Y, p[2]], dir, BODY_R + WALL_REACH);
    if (!hit || hit.index >= 1e6 || Math.abs(hit.n[1]) > 0.2) continue;                       // nothing there, or a door leaf
    const n = v3.normalize([hit.n[0], 0, hit.n[2]]);
    if (n[0] * dir[0] + n[2] * dir[2] > -0.35) continue;                                       // a face only glanced side-on: the ray square to it finds it if it faces him at all
    const d = (p[0] + dir[0] * hit.t) * n[0] + (p[2] + dir[2] * hit.t) * n[2];
    const dist = p[0] * n[0] + p[2] * n[2] - d;                                                 // how far his centre stands off that plane
    if (dist < BODY_R - 0.06 || dist > BODY_R + WALL_REACH) continue;
    const dup = cands.find(c => c.n[0] * n[0] + c.n[2] * n[2] > 0.99 && Math.abs(c.d - d) < 0.02);
    if (dup) { if (d < dup.d) dup.d = d; continue; }                                            // one plane per face — and of two a centimetre apart (a jamb standing proud of its wall, met first by one ray) the deeper is the wall: traced along the jamb's, the wall a centimetre behind fell outside COPLANAR here and there and Q found 'nothing' a hand from where it held
    cands.push({ n, d, score: dist - 0.12 * Math.max(0, -(f[0] * n[0] + f[2] * n[2])) });     // nearest first; of two much alike (an inside corner), the one he is facing — walking into
  }
  cands.sort((a, b) => a.score - b.score);
  const y1 = pl.crouch ? 1.0 : 1.7;
  for (const c of cands) {
    const n = c.n, t: Vec3 = [-n[2], 0, n[0]]; const u0 = p[0] * t[0] + p[2] * t[2];
    const run = traceFace(col, n, c.d, t, u0, quick ? 1.0 : Infinity); if (!run) continue;
    const [lo, hi] = run; if (hi - lo < WALL_MIN_FACE) continue;
    const u = clamp(u0, lo + BODY_R, hi - BODY_R); if (Math.abs(u - u0) > 0.35) continue;   // a short sidestep onto the end of a wall he is just past, no more
    // room for the body at that station: settle a copy against the statics, and against the furniture as it stands (nailed down, for the guess: clearOfProps),
    // and see that it is still on the plane and on the face — a pot, a bench, the other wall of an inside corner, a carton stack against the wall say no (or
    // 'a step further along, beside it'); a board proud of the wall at chest height merely holds him a few centimetres off it
    const q: Vec3 = [t[0] * u + n[0] * (c.d + BODY_R + WALL_GAP), 0, t[2] * u + n[2] * (c.d + BODY_R + WALL_GAP)];
    col.collideCircle(q, BODY_R, 0.2, y1, 4); col.clampToWorld(q, BODY_R);
    const byProps = clearOfProps(g, q, PROP_BODY_R + 0.02);
    const off = q[0] * n[0] + q[2] * n[2] - (c.d + BODY_R + WALL_GAP), uq = q[0] * t[0] + q[2] * t[2];
    if (Math.abs(off) > 0.1 || uq < lo + BODY_R - 0.02 || uq > hi - BODY_R + 0.02 || Math.abs(uq - u0) > 0.4) { if (byProps && why) why.blocked = true; continue; }
    if (v3.distXZ(p, q) > 0.05 && col.solidBlocked([p[0], KNEE_Y, p[2]], [q[0], KNEE_Y, q[2]])) continue;   // and a clear step there (not round the end of a partition he is level with, not through a shut leaf)
    return { n, t, d: c.d, lo, hi, u: clamp(uq, lo + BODY_R, hi - BODY_R) };
  }
  return null;
}

/** For the HUD / the input pass: is he free to put his back to a wall, and would Q find one from where he stands? (Cheap enough to ask every frame: a ring of
 *  short rays and a metre of face traced either side of him.) */
export function canWallSnap(g: Game): boolean {
  const pl = g.player;
  return !pl.wall && !pl.down && !pl.dragging && !pl.takedown && !pl.holding && !pl.kick && !pl.picking && !pl.sprinting && !!findWall(g, true);
}

/** Q: take hold of the wall findWall offers. The hold is set up here; moveOnWall eases him onto it over the next few frames (through his own collision sweep,
 *  like any move of his) and turns his back to it. Which shoulder leads (WallHold.side) comes from the way he was moving, else the way he was facing, else the
 *  camera's right. Crouched or standing as he was. Whatever was in his hand goes away (the pistol drawn on the thigh like any holstered state, remembered in
 *  WallHold.drawn for releaseWall to hand back): on the wall his palms are on the plaster. false = nothing in reach (or his hands / feet are busy). */
export function wallSnap(g: Game, cam: FollowCamera, why?: { blocked: boolean }): boolean {
  const pl = g.player, c = pl.char;
  if (pl.wall || pl.down || pl.dragging || pl.takedown || pl.holding || pl.kick || pl.picking) return false;
  const f = findWall(g, false, why); if (!f) return false;
  const { n, t } = f;
  const vt = c.vel[0] * t[0] + c.vel[2] * t[2], ft = Math.sin(c.bodyYaw) * t[0] + Math.cos(c.bodyYaw) * t[2], rt = cam.planarBasis().right;
  const side: -1 | 1 = Math.abs(vt) > 0.3 ? (vt > 0 ? 1 : -1) : Math.abs(ft) > 0.4 ? (ft > 0 ? 1 : -1) : rt[0] * t[0] + rt[2] * t[2] >= 0 ? 1 : -1;
  const uLo = f.lo + BODY_R, uHi = f.hi - BODY_R;
  pl.wall = { n, along: t, d: f.d, lo: f.lo, hi: f.hi, openLo: endOpen(g.col, n, f.d, t, uLo, -1), openHi: endOpen(g.col, n, f.d, t, uHi, 1),
    u: f.u, v: 0, side, off: 0, awayT: 0, settle: 0, from: v3.copy(c.pos), blockDir: 0, blockT: 0, seated: false, drawn: !pl.holstered, atEdge: 0, peek: 0, peekDir: side, crouched: pl.crouch };
  pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false; pl.speedSm = 0; c.vel = [0, 0, 0];
  setHolstered(g, true);
  return true;
}

/** Step off the wall — Q again, a sprint, walking away from it, being shoved off it, or anything that plants him elsewhere (takedown, kick, pick, drag, teleport,
 *  going down): the ready stance and the craned neck come off, nothing carries him on along or into it, and what he had in his hand when he took it is back in
 *  it (WallHold.drawn — not for a man going down: hitPlayer has already settled what leaves a falling hand). */
export function releaseWall(g: Game) {
  const pl = g.player, w = pl.wall; if (!w) return;
  pl.wall = null; pl.char.anim.stance = 'none'; pl.char.anim.lookYawExtra = 0; pl.char.vel = [0, 0, 0];
  if (w.drawn && !pl.down) setHolstered(g, false);
}

/** One frame on the wall (updatePlayer runs this in place of free movement); false = he has just come off it (walked away, shoved off) and the caller moves him as
 *  a free man this same frame. The tangential share of the (camera-relative, unit) stick slides him if it is at least as large as the share square to the face —
 *  INTO the wall does nothing, AWAY from it for WALL_AWAY_SECS lets go. His station u advances at WALL_PACE (crouch pace on his knees) and is clamped so the body
 *  stays wholly on the traced face — he stops at its end, he does not go round the corner; he is put on the plane at that station (eased in and out from where Q
 *  found him over WALL_SETTLE), then collided with the statics and kept off the guards like any move. What the face trace could not see is met here: the step is first tried on
 *  a copy of the body, and one that the statics would take straight back (a bench, a plant pot, the post of an inside corner) or that would prise him more than a
 *  hand off the plane is not taken — he stops short, dead, and that way stays shut for a beat (blockDir) instead of being ground at every frame; something merely
 *  proud of the wall (a notice board, an extinguisher) he rides out and round, `off` easing him back after where nothing turns that into a slide. Whatever else
 *  moves him is read back into u / off the same way (`take`): the guards this frame, and — first thing next frame — the leaves and the furniture, which have their
 *  say after the player has moved (game.ts updateDoors / updateProps): a man shouldering past holds him off the plane and he settles back once he is by, a chair he
 *  sidles into holds him where he met it; more than WALL_SHOVE_OFF off the plane (a leaf swung into him) or carried past the face's end, he lets go. Parked at an
 *  OPEN end and still pushed toward it, the peek eases in: the camera's follow point moves out past the corner (FollowCamera.peekOffset) and his neck cranes round
 *  it; it eases out again when he stops pushing or moves off. */
function moveOnWall(g: Game, dt: number, cam: FollowCamera, mx: number, mz: number, ml: number): boolean {
  const pl = g.player, c = pl.char, w = pl.wall!; const n = w.n, t = w.along; const y1 = pl.crouch ? 1.0 : 1.7;
  const uLo = w.lo + BODY_R, uHi = w.hi - BODY_R; const base = w.d + BODY_R + WALL_GAP;
  if (!pl.holstered) { w.drawn = true; setHolstered(g, true, true); }   // (whatever else drew it — a tour beat, the panel — on the wall it goes back on the thigh, and into his hand when he steps off)
  // the stick: along the face (± his right) or square to it (+ away)
  let dir: -1 | 0 | 1 = 0, away = 0;
  if (ml > 0) { const a = mx * t[0] + mz * t[2]; away = mx * n[0] + mz * n[2]; if (Math.abs(a) > 0.2 && Math.abs(a) >= Math.abs(away) - 0.05) dir = a > 0 ? 1 : -1; }
  w.awayT = away > 0.5 ? w.awayT + dt : 0;
  if (w.awayT > WALL_AWAY_SECS) { releaseWall(g); return false; }
  if (dir) w.side = dir;
  /** read where he actually is back into the hold: shoved off it or past its end → let go (false). `firm`: held back against the stick by a man → that way shuts
   *  for a beat (else he would tread on the spot pressing into the man's back); not firm (furniture): just take the station — a bin he keeps pushing along, as a walk does */
  const take = (firm: boolean): boolean => {
    const uReal = c.pos[0] * t[0] + c.pos[2] * t[2], offReal = c.pos[0] * n[0] + c.pos[2] * n[2] - base;
    if (uReal < uLo - 0.25 || uReal > uHi + 0.25 || offReal > WALL_SHOVE_OFF) { g.msg(w.seated ? 'pushed off the wall' : "can't get to the wall here"); releaseWall(g); return false; }
    w.seated = true;
    if (Math.abs(uReal - w.u) > 0.003) {
      if (firm) { if (dir && (uReal - w.u) * dir < 0) { w.v = 0; w.blockDir = dir; w.blockT = 0; } else if ((uReal - w.u) * w.v < 0) w.v = 0; }
      w.u = clamp(uReal, uLo, uHi);
    }
    w.off = Math.max(0, offReal);
    return true;
  };
  if (w.settle >= 1 && !take(false)) return false;   // whatever a leaf or the furniture made of where we left him last frame
  if (w.blockDir && (dir !== w.blockDir || (w.blockT += dt) > 0.5)) { w.blockDir = 0; w.blockT = 0; }   // the stick let off that way, or time for another look (a man may have walked on; a bench says no again at once, unseen)
  pl.sprinting = false; w.crouched = pl.crouch;
  const want = dir === w.blockDir ? 0 : dir * (pl.crouch ? g.tune.playerCrouch : WALL_PACE) * (g.puppet?.walk ?? 1);
  w.v = damp(w.v, want, Math.abs(want) > Math.abs(w.v) && want * w.v >= 0 ? 6 : 12, dt);
  if (!want && Math.abs(w.v) < 0.02) w.v = 0;
  // his station along the face, the whole body kept on it
  let u = w.u + w.v * dt;
  if (u >= uHi) { u = uHi; if (w.v > 0) w.v = 0; } else if (u <= uLo) { u = uLo; if (w.v < 0) w.v = 0; }
  const ePrev = w.settle < 1 ? w.settle * w.settle * (3 - 2 * w.settle) : 1;   // the take-hold ease as it stood (smoothstep of settle): this frame's share of the way in is reckoned from it below
  w.settle = Math.min(1, w.settle + dt / WALL_SETTLE);
  if (w.off > 0 && w.settle >= 1) {   // whatever held him off the plane is let ease him back — unless settling back would push him along it (squeezed off the corner of the thing) or is simply refused
    const offWant = Math.max(0, w.off - 0.8 * dt); const q: Vec3 = [t[0] * w.u + n[0] * (base + offWant), 0, t[2] * w.u + n[2] * (base + offWant)]; g.col.collideCircle(q, BODY_R, 0.2, y1, 4);
    if (Math.abs(q[0] * t[0] + q[2] * t[2] - w.u) < 1e-3 && q[0] * n[0] + q[2] * n[2] - (base + offWant) < 0.5 * (w.off - offWant)) w.off = offWant;
  }
  let stand = base + w.off;
  if (w.settle >= 1 && Math.abs(u - w.u) > 1e-6) {   // the step tried on a copy: taken straight back, or prising him off the wall — stop short of whatever it is; merely deflected — ride it out and round
    const q: Vec3 = [t[0] * u + n[0] * stand, 0, t[2] * u + n[2] * stand]; g.col.collideCircle(q, BODY_R, 0.2, y1, 4);
    const adv = u - w.u, kept = q[0] * t[0] + q[2] * t[2] - w.u, out = q[0] * n[0] + q[2] * n[2] - stand;
    if (kept / adv < 0.3 || w.off + out > 0.12) { u = w.u; w.v = 0; if (dir) { w.blockDir = dir; w.blockT = 0; } }
    else { u = clamp(w.u + kept, uLo, uHi); if (out > 0) { w.off += out; stand = base + w.off; } }
  }
  w.u = u;
  // onto the plane at that station, then his own collision and the guards have their say. Taking hold, he is eased in over WALL_SETTLE (smoothstep, ease in
  // and out) — from where he actually IS each frame, by the share of the remaining way the curve covers this frame, and never by more than the curve's own
  // stride from where Q found him: over open floor that is the same glide to the millimetre, but a carton stack, a chair, a leaf or a man standing between him
  // and the face (none of which the face trace can see; the props and the leaves have their say on him after this, game.ts updateProps / updateDoors) now
  // holds him where they meet, pressed on gently, instead of the ease writing him a stride deeper into the thing every frame regardless — which fired a carton
  // along the wall at metres a second and, the frame it was out of the way, spent the whole saved-up difference at once: 0.4 m in a frame (the soak's
  // 'popped', seed 3 @ 362 s). Still held off the plane when the ease is done, `take` reads it like any shove: let go past WALL_SHOVE_OFF, else `off` eases him in.
  const tx = t[0] * u + n[0] * stand, tz = t[2] * u + n[2] * stand;
  if (ePrev < 1) {
    const e0 = w.settle < 1 ? w.settle * w.settle * (3 - 2 * w.settle) : 1;
    const k = e0 < 1 ? (e0 - ePrev) / (1 - ePrev) : 1;                             // the curve's share of what is LEFT this frame (all of it on the last)
    let sx = (tx - c.pos[0]) * k, sz = (tz - c.pos[2]) * k; const sl = Math.hypot(sx, sz);
    const cap = Math.hypot(tx - w.from[0], tz - w.from[2]) * (e0 - ePrev) + 0.02;   // the unobstructed stride this frame, and a hair
    if (sl > cap) { sx *= cap / sl; sz *= cap / sl; }
    c.pos = [c.pos[0] + sx, c.pos[1], c.pos[2] + sz];
  } else c.pos = [tx, c.pos[1], tz];
  collidePlayer(g, y1); keepOffGuards(g, dt, y1);
  if (w.settle >= 1 && !take(true)) return false;
  c.vel = [t[0] * w.v, 0, t[2] * w.v]; pl.speedSm = Math.abs(w.v);
  // the ends, and peeking round an open one
  w.atEdge = w.u >= uHi - 0.005 && w.openHi ? 1 : w.u <= uLo + 0.005 && w.openLo ? -1 : 0;
  const pushingOn = w.atEdge !== 0 && dir === w.atEdge;
  if (pushingOn) w.peekDir = w.atEdge as -1 | 1;
  w.peek = clamp(w.peek + (pushingOn ? 1 : -1) * dt / WALL_PEEK_SECS, 0, 1);
  const e = w.peek * w.peek * (3 - 2 * w.peek);
  cam.peekOffset = e > 0 ? [(t[0] * w.peekDir * (BODY_R + 0.6) + n[0] * 0.3) * e, 0, (t[2] * w.peekDir * (BODY_R + 0.6) + n[2] * 0.3) * e] : null;   // look-at out past the corner and a little off the wall
  c.anim.lookYawExtra = -w.peekDir * WALL_PEEK_LOOK * e;   // (+ = to his left; peekDir + = the end on his right)
  return true;
}

/** Silent takedown (a left click with the hands empty on the man in reach behind — game.ts updateDoors; the tour and the harness call it too): lock in behind the
 *  guard, throw the cross, he drops with a soft thud only the room hears. */
export function startTakedown(g: Game, gd: Guard) {
  const pl = g.player; if (gd.state === 'dead' || pl.down) return;   // (F + fire in the same frame: the round got there first)
  if (pl.wall) pl.wall.drawn = false;   // offered from the wall: he steps off it into the lunge with the empty hands he had on it — and keeps them empty after, as every takedown leaves him
  releaseWall(g);
  if (pl.dragging) g.toggleDrag();
  pl.takedown = { g: gd, t: 0 }; pl.sprinting = false; pl.char.anim.strike(); cancelReloads(pl);
  pl.throwHeld = false; pl.throwPreview = null; pl.pendingThrow = null;   // a wind-up does not survive the lunge
  gd.speed = 0; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.reactT = Math.max(gd.reactT, 1.0);   // he freezes for the beat it takes
  g.audio.play('bodyHit', v3.add(gd.char.pos, [0, 1.3, 0]), 0.55, { rate: 0.8 });
}

export function updateTakedown(g: Game, dt: number) {
  const pl = g.player; const td = pl.takedown; if (!td) return;
  const gd = td.g; const c = pl.char;
  if (!g.onFloor(gd)) { pl.takedown = null; return; }   // the shift was reset under the lunge (P for the tour, the panel): nobody there to finish on — and never a corpse, a thud and a dropped torch out of a man who no longer exists
  // hold station 0.55 m behind him, facing his back (until he drops: his pos then rides the falling pelvis, and you stand where you struck) — the statics still apply: squeezed behind a man near a wall you strike from as close as the wall allows
  const yaw = gd.char.bodyYaw; c.vel = [0, 0, 0];
  if (gd.state !== 'dead') { const want: Vec3 = [gd.char.pos[0] - Math.sin(yaw) * 0.55, 0, gd.char.pos[2] - Math.cos(yaw) * 0.55]; c.pos = v3.lerp(c.pos, want, 1 - Math.exp(-14 * dt)); collidePlayer(g, pl.crouch ? 1.0 : 1.7); }
  c.bodyYaw = approachAngle(c.bodyYaw, yaw, 14 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0.1, 8, dt);
  td.t += dt;
  if (td.t >= 0.28 && gd.state !== 'dead') {                    // the cross lands
    killGuard(g, gd, [Math.sin(yaw), 0, Math.cos(yaw)], true);
    g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: 0.3, who: PLAYER_ID });   // the fall: a thud the room hears, not the floor
    pl.noise = Math.max(pl.noise, 0.3);
  }
  if (td.t > 0.62) pl.takedown = null;                        // control back as the cross recovers
}

// ------------------------------------------------------------ grab → hold → interrogate → choke out / pistol-whip
/** Which hold a grab made now would be to begin with: the Five-seveN drawn in the hand → it goes to his head ('gun'); holstered, or a canister up → both hands on
 *  him ('arm'). The guard's row says which before you commit (buildInteractables); E changes it once he is held (swapHold) — and keeps this true of the hands
 *  throughout, so it also names the hold Sam is in. */
export function grabVariant(g: Game): HoldVariant { return g.player.pistolUp ? 'gun' : 'arm'; }
/** The 'grab him' row on a living guard from behind (game.ts updateDoors — the takedown's own gate: in reach, in his rear half-space, not alert, nothing solid
 *  between): drop whatever the hands had, and he is frozen where he stands for the beat it takes to get the arm round him (updateHold's 'grab' phase does the
 *  closing in). From here he is `held`: off the AI, off any choreography or body script (a pair clearing rooms loses him — his partner comes off it toward
 *  the spot), off the net, silent but for his answers; a patrolling man's torch is knocked out of his hand and dies on the floor. Which hold it is to begin with
 *  (grabVariant) is decided here; E swaps it later (swapHold). Refused for a man onto you, with your hands already full, or crouched where he cannot stand up
 *  into it (a counter top over his head: the hold stands the pair up and collides them at full height). */
export function startGrab(g: Game, gd: Guard) {
  const pl = g.player, c = pl.char;
  if (gd.state === 'dead' || gd.state === 'alert' || gd.held || pl.down || pl.holding || pl.takedown || pl.kick || pl.picking) return;
  if (pl.crouch && !canStand(g)) { g.msg('no room to stand up behind him here'); return; }
  if (pl.rifleUp) setHolstered(g, true, true);   // the rifle in his hands goes to the sling as the arm goes round the man (Chaos Theory slings it: both hands are for him — the arm variant, the knife in the fist); it stays there when the hold is over
  const variant = grabVariant(g);
  if (pl.wall) pl.wall.drawn = false;   // (grabbed from the wall: with the empty hands he had on it — the arm variant, above — and they stay empty when it is over)
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  pl.sprinting = false; pl.crouch = false; pl.speedSm = 0; c.vel = [0, 0, 0]; pl.backpedal = false; c.anim.reverse = false;   // you rise into it
  cancelReloads(pl);
  if (pl.pendingThrow) { if (pl.pendingThrow.kind === 'flash') pl.flashbangs++; else pl.canisters++; pl.pendingThrow = null; }   // a wind-up does not survive it (the can goes back on the belt)
  pl.throwHeld = false; pl.throwPreview = null; pl.easing = null;
  // him
  if (gd.bubble && g.time - gd.bubble.t < gd.bubble.dur) { if (g.time - gd.bubble.t < 0.8) g.msg('guard: ' + gd.bubble.text); gd.bubble = null; }   // whatever he was saying is cut off (logged if he had barely begun it, as killGuard does)
  const C = g.clearing;
  if (C && C.stage !== 'done' && (C.a === gd || C.b === gd)) {   // one of the pair clearing rooms: the clear is over — his partner comes off the drill toward where he was, on edge (what he then sees is his own senses' business)
    const other = C.a === gd ? C.b : C.a;
    C.cancel(); g.clearing = null;
    if (other && other.state !== 'dead' && !other.held) { other.state = 'suspicious'; other.awareness = Math.max(other.awareness, 0.6); other.lastKnown = v3.copy(gd.char.pos); other.reactT = 0.7; other.searchT = 0; other.path = []; other.pathGoal = null; other.searchPlan = null; other.pieing = null; }   // (a search plan and a half-pied doorway live inside search / alert — guards.ts drops them itself next frame, but he is 'suspicious' from THIS one: the grab lands after the guards' update)
  }
  if (gd.script) endGuardScript(gd, gd.state === 'patrol' ? 'patrol' : gd.state === 'search' ? 'search' : 'suspicious');   // (any other choreography: unhooked where he stands, keeping the state he had)
  gd.speed = 0; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.bodyDuty = null; gd.pieing = null; gd.searchPlan = null; gd.muzzleDown = false; gd.stallRef = null;
  gd.char.anim.lookYawExtra = 0; gd.sweep = 0;
  gd.lightLitAtLoss = gd.flashlight.enabled;   // (the grab: was the torch burning as it left his hand — attachFlashlight's floor sputter shows only what was lit)
  if (inHand(gd) === 'torch') { gd.dropped = dropFromHand(g, gd.char, 'torch', gd.beamDir, [0, 0, 0], false, true); gd.torchLostAt = g.time; }   // the torch is knocked out of his hand as the arm goes round: it clatters down quietly and dies on the floor like a dropped torch does (guards.ts) — his hands come up empty
  gd.held = { by: 'player', since: g.time, variant, phase: 'grab', reverse: false };
  if (gd.civ) civilianGrabbed(g, gd);   // (a civilian: whatever she was doing stops, and she cannot scream with a forearm across her throat — civilians.ts)
  if (g.aiEnabled) gd.witness.wasHeld++; gd.talk.heldSince = g.time;   // his own record of it (the dialogue reads both: how long he has been held, whether this is the second time) — nothing is remembered with the AI off, like every other witness write
  pl.holding = { g: gd, variant, phase: 'grab', t: 0, since: g.time, windT: -1, swapT: Infinity, remarked: false, gunOut: 0, fireQueued: false, shotT: -1, ask: null, after: null };
  pl.fireCd = Math.max(pl.fireCd, HOLD.secs.grab);   // (no round leaves the gun on its way round him)
  g.audio.play('grabScuffle', v3.add(gd.char.pos, [0, 1.4, 0]), 0.4);   // the arm going round him: sleeve over his shoulder, chest into his back, the breath he snatches choked off
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: GRAB_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, GRAB_NOISE); chronGrab(g, gd);   // a scuffle the room hears inside a few metres, not the floor
}

/** One frame with a man in his arm (updatePlayer runs this in place of everything else while Player.holding is set): the beat's clock and its inputs — E (held,
 *  and not inside the last one's HOLD.secs.swap: swapHold — he draws the pistol to the man's head / holsters it for the knife, the other variant from here);
 *  his ROWS, performed through Game.act (interact.ts: a Space tap does the highlighted one, Space held opens the list to choose) — ARM: 'question him' = an
 *  exchange: Sam's line over Sam, then the man's answer through Game.interrogate when it ends — askHeld / answerHeld; while Sam speaks it does nothing, inside
 *  the first INTERROGATE_GAP of the answer it only cuts the line short, after that it cuts in with the next; and 'choke him out' = chosen, the arm closes
 *  HOLD.secs.chokeHold later (windT, the commit beat) and he is out at HOLD.secs.choke unless a tap / a step / Esc stops it first (interact.ts cancelSustained
 *  → easeOffHold: he breathes again); GUN: the one row is the pistol-whip, the same shape (cocked at chokeHold, lands at HOLD.secs.whip, checked sooner) — no
 *  questions over a gun; in the gun variant a click fires one round past him at what the reticle has (HOLD_FIRE_CD apart, HOLD_SPREAD wide, never into
 *  him), right click the OCP, and L works the rail light; and for HOLD.secs.swap after an E none of the rows start (the hand is between tools: a choke chosen
 *  under it waits for the hand) — then the pair's movement (camera-relative WASD at HOLD_PACE × the wheel's pace, slower backing up, no sprint / crouch / wall
 *  / kit, feet still while the selector is open; the pair turns toward the cursor at HOLD_TURN), Sam's own collision and the other guards' solidity, the man
 *  placed rigidly HOLD.dist ahead on Sam's facing with the walls winning (placeHeld), and both animators told the phase. Anything that takes the man away from
 *  under the arm (a reset, a round in him from somebody, the tour) just ends it. */
export function updateHold(g: Game, dt: number, input: Input, cam: FollowCamera) {
  const pl = g.player, c = pl.char, H = pl.holding!, gd = H.g, hc = gd.char; let gun = H.variant === 'gun';
  if (input.hit('KeyN')) { pl.nv = !pl.nv; g.audio.play(pl.nv ? 'nvOn' : 'nvOff', null, 0.7); g.msg(pl.nv ? 'night vision on' : 'night vision off'); }   // (the goggles are a flick of the head; everything else the hands would do waits)
  if (gun && input.hit('KeyL')) { pl.pistol.lightOn = !pl.pistol.lightOn; g.audio.play('click', c.muzzle, 0.6); }                                       // (the light's switch is under the thumb of the hand the gun is in)
  pl.nvAmount = damp(pl.nvAmount, pl.nv ? 1 : 0, pl.nv ? 5 : 9, dt);
  if (!g.onFloor(gd) || gd.state === 'dead' || gd.held?.by !== 'player') { dropHold(g); c.update(dt); return; }   // reset from under the arm (P, the panel), or put down in it by somebody's round: nothing left to hold
  H.t += dt; H.swapT += dt; pl.fireCd -= dt;
  const K = HOLD.secs;
  let speed = 0;
  if (H.phase === 'grab') {
    // easing in to HOLD.dist behind him on HIS facing (he has not been turned yet), squaring up to his back — through Sam's own collision: squeezed behind a man by a
    // wall, the arm goes round him from as close as the wall allows and the hold proper settles the rest
    const yaw = hc.bodyYaw; const want: Vec3 = [hc.pos[0] - Math.sin(yaw) * HOLD.dist, 0, hc.pos[2] - Math.cos(yaw) * HOLD.dist];
    c.vel = [0, 0, 0]; c.pos = v3.lerp(c.pos, want, 1 - Math.exp(-14 * dt)); collidePlayer(g, 1.7);
    c.bodyYaw = approachAngle(c.bodyYaw, yaw, 14 * dt); c.aimYaw = approachAngle(c.aimYaw, c.bodyYaw, 12 * dt); c.aimPitch = damp(c.aimPitch, 0, 8, dt);   // (the chest untwists over the reach, not in a frame)
    gd.speed = 0; hc.vel = [0, 0, 0];
    if (H.t >= K.grab) {
      setPhase(g, 'held'); H.since = g.time; if (gd.held) gd.held.since = g.time; gd.talk.heldSince = g.time; c.bodyYaw = c.aimYaw = hc.bodyYaw;   // (the dialogue's held clock and the hold's are one)
      g.audio.play('heldProtest', v3.add(hc.pos, [0, 1.5, 0]), 0.18);   // his first sound in the arm, muffled under it (the buffer carries its own 0.3 s: it lands as the hold settles)
      if (gd.civ) g.msg(gun ? `got ${gd.callsign} — the ${gd.civ.label}. Space: tell ${gd.civ.her} to stay down and quiet (lets ${gd.civ.her} go) · hold Space for the pistol-whip · E holsters to question ${gd.civ.her}` : `got ${gd.callsign} — the ${gd.civ.label}. Space asks what ${gd.civ.she} knows · hold Space: 'stay down, stay quiet' or the choke · a civilian on the floor costs you`);
      else g.msg(gun ? `got ${gd.callsign}, the pistol at his head — click fires past him, Space pistol-whips him, E holsters it to question him` : `got ${gd.callsign} — Space makes him talk; hold Space for the choke's row; E puts the gun to his head`);
    }
  } else {
    // ---- E: the other hold — draw the pistol to his head / holster it and the knife is back (held only, and not while the hand is still between tools from the last)
    if (H.phase === 'held' && H.swapT >= K.swap && input.hit('KeyE') && !pl.sel.open && pl.sel.downT < 0) { swapHold(g); gun = H.variant === 'gun'; }   // (not while the Space list is open or a press is down: the swap re-opened the list on the gun's rows and the SAME release then chose the pistol-whip — review 08-10 #16)
    const swapping = H.swapT < K.swap;   // the draw / the holstering under way: none of the rows may start (no round, no question; a choke / whip chosen now waits for the hand)
    // ---- his rows, performed this frame (interact.ts → Game.act): the question (arm), the choke (arm) / the whip (gun) — chosen, then run on their own clock.
    //      (No letting him go: once the arm is on, it ends with him on the floor. The tour taps these rows like a player.)
    const act = g.act?.kind === 'held' ? g.act.verb : null;
    if (H.phase === 'held') {
      if (act === 'comply' && gd.civ && !swapping) { if (civilianComply(g)) { holdTail(g, dt, 0); return; } }   // 'stay down, stay quiet': a civilian let go into a crouch where she stands, told (civilians.ts) — the one way out of the arm on your feet by his choice, and hers alone
      if (act === 'question' && !swapping) { if (gun) g.msg(`no questions over a gun — E holsters it, then Space asks ${gd.callsign}`); else askHeld(g); }
      if (!swapping && ((act === 'choke' && !gun) || (act === 'whip' && gun))) H.windT = 0;   // chosen: the arm closes / the pistol comes off his head HOLD.secs.chokeHold from now — the commit beat the held key used to be (the rows are a status line under a swap: nothing is chosen while the hand is between tools)
      if (H.windT >= 0 && !swapping) { H.windT += Math.min(dt, 0.05); if (H.windT >= K.chokeHold) { H.windT = -1; if (gun) startWhip(g); else startChoke(g); } }   // (a frame hitch must not swallow the beat)
    }
    if (H.ask && H.phase === 'held' && g.time + 1e-6 >= H.ask.t + H.ask.dur) { H.ask = null; answerHeld(g); }   // Sam's line has hung its beat: the man answers it (after the row's inputs, so a tap this frame saw Sam still speaking and did nothing)
    if (H.after && H.phase === 'held' && !H.ask && !heldTalk(g, H).speaking) sayAfter(g);                        // a remark that waited for the man to finish (his key pocketed, takeKey): the answer is down and no question is going up — now
    if (H.phase === 'choke' && H.t < K.choke - 0.3 && Math.floor(H.t / CHOKE_GRAIN) > Math.floor((H.t - dt) / CHOKE_GRAIN)) g.audio.play('chokeStrain', v3.add(hc.pos, [0, 1.5, 0]), 0.25);   // the strain of it while the arm is closed: a grain as it goes on (H.t 0) and every CHOKE_GRAIN after, the last one dying as he goes limp; eased off = no more of them, nothing to stop
    if (H.phase === 'choke' && H.t >= K.choke) { chokeOut(g); holdTail(g, dt, 0); return; }
    if (H.phase === 'whip' && H.t >= K.whip) { whipOut(g); holdTail(g, dt, 0); return; }
    // ---- the gun: a click queues one round, the pistol comes off his head (gunOut, a few frames) and it goes — at the fixture / man / point the reticle has, never
    //      the man in the arm; it stays presented while rounds keep coming and settles back on him a moment after the last
    if (gun && H.phase === 'held') {
      if (!swapping && input.lmbHit() && !H.fireQueued && pl.fireCd <= 0) {
        if (pl.pistol.canFire()) H.fireQueued = true;
        else { pl.fireCd = 0.25; g.audio.play('dryFire', c.muzzle, 0.7); g.msg('click — empty, and no hand free to reload'); }
      }
      if (!swapping && input.rmbHit() && (ocpable(g) || (!g.aimTarget && !g.aimGuard))) g.ocp(g.aimTarget);   // (the OCP is on the pistol too: right click zaps the light the reticle has, as it does with the gun out anywhere — and does nothing on a man with no light burning)
      const present = H.fireQueued || (H.shotT >= 0 && g.time - H.shotT < 0.9);
      H.gunOut = damp(H.gunOut, present ? 1 : 0, present ? 30 : 6, dt);
      if (H.fireQueued && H.gunOut > 0.8) {
        H.fireQueued = false;
        if (pl.pistol.fire()) {
          pl.fireCd = HOLD_FIRE_CD; pl.lastFireT = g.time; H.shotT = g.time;
          const ap = g.aimPoint; const ag = g.aimGuard && g.aimGuard !== gd && g.aimGuard.state !== 'dead' ? g.aimGuard : null;
          const tgt: Vec3 = g.aimTarget ? v3.copy(g.aimTarget.pos) : ag ? v3.add(ag.char.pos, [0, 1.25, 0]) : [ap[0], ap[1] + 0.03, ap[2]];
          fireWeapon(g, c, tgt, true, { spread: HOLD_SPREAD + samSpread(g) + samAim(g) });   // (one-handed past the man's jaw — and wider again under fire, suppression.ts, and by the aim model's cone, aim.ts samAim: 0 with it off)
          if (pl.pistol.roundsReady === 0) g.msg('empty — and no hand free to reload');
        }
      }
    } else { H.fireQueued = false; H.gunOut = damp(H.gunOut, 0, 6, dt); }
    // ---- turning: the pair comes round toward the cursor, rate-limited; no chest twist of Sam's own (his arms are where the man is). The gun, when it comes off his
    //      head, is presented at the pitch of what the reticle has (the layer reads aimPitch as HoldPose.gunPitch); otherwise level.
    const ap = g.aimPoint; const tx = ap[0] - c.pos[0], tz = ap[2] - c.pos[2]; const ad = Math.hypot(tx, tz);
    if (ad > 0.6) c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(tx, tz), HOLD_TURN * dt);
    c.aimYaw = c.bodyYaw;
    if (gun) { const ty = g.aimTarget ? clamp(g.aimTarget.pos[1], 0.3, 2.95) : g.aimGuard && g.aimGuard !== gd ? g.aimGuard.char.pos[1] + 1.2 : ap[1] + 0.03; c.aimPitch = damp(c.aimPitch, clamp(Math.atan2(ty - (c.pos[1] + 1.5), Math.max(ad, 0.5)), -45 * DEG, 45 * DEG) * H.gunOut, 12, dt); }
    else c.aimPitch = damp(c.aimPitch, -0.05, 8, dt);
    // ---- the pair's movement (rooted while the choke / the whip is on: you plant to finish it — a step then is what stops it, interact.ts; feet still while the selector is open)
    let mx = 0, mz = 0;
    if (H.phase === 'held') {
      const { fwd, right } = cam.planarBasis();
      if (!pl.sel.open) {
        if (input.down('KeyW')) { mx += fwd[0]; mz += fwd[2]; } if (input.down('KeyS')) { mx -= fwd[0]; mz -= fwd[2]; }
        if (input.down('KeyD')) { mx += right[0]; mz += right[2]; } if (input.down('KeyA')) { mx -= right[0]; mz -= right[2]; }
      }
      if (g.puppet) { mx = 0; mz = 0; const gl = g.puppet.goal; if (gl) { const dx = gl[0] - c.pos[0], dz = gl[2] - c.pos[2]; const dl = Math.hypot(dx, dz); if (dl > 0.1) { mx = dx / dl; mz = dz / dl; } } }
    }
    const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
    const f = c.forward(); const back = ml > 0 && mx * f[0] + mz * f[2] < -0.3;   // into the rear half: hauling him backwards
    const maxSpeed = ml === 0 ? 0 : (back ? HOLD_PACE_BACK : HOLD_PACE) * pl.pace * (g.puppet?.walk ?? 1);
    pl.speedSm = damp(pl.speedSm, maxSpeed, maxSpeed > pl.speedSm ? 6 : 12, dt);
    if (ml > 0) c.vel = [mx * pl.speedSm, 0, mz * pl.speedSm]; else c.vel = v3.scale(c.vel, Math.exp(-14 * dt));
    const bx = c.pos[0], bz = c.pos[2];
    c.pos = v3.mad(c.pos, c.vel, dt);
    collidePlayer(g, 1.7); keepOffGuards(g, dt, 1.7); keepHeldOffGuards(g, dt);
    placeHeld(g);
    speed = Math.min(Math.hypot(c.pos[0] - bx, c.pos[2] - bz) / Math.max(dt, 1e-4), Math.hypot(c.vel[0], c.vel[2]));   // the ground the pair actually covered (pressed to a wall ahead of the man, the legs stand rather than tread on the spot)
    pl.backpedal = speed > 0.2 && (c.vel[0] * f[0] + c.vel[2] * f[2]) / Math.max(1e-4, Math.hypot(c.vel[0], c.vel[2])) < -0.3; c.anim.reverse = pl.backpedal;
    hc.vel = v3.copy(c.vel); gd.speed = speed; hc.bodyYaw = c.bodyYaw;
    if (gd.held) gd.held.reverse = pl.backpedal;
  }
  pl.sprinting = false; pl.crouch = false;
  holdTail(g, dt, speed);
}
/** the end of a hold frame, Sam's side, shared with the frames that end the hold: both animators told the beat (the man's is baked later, in updateGuard's held
 *  branch; Sam's here), the rail light (arm variant: off — the pistol rides the thigh while both hands are on him, hideHeldItem; gun variant: lit if L has it on,
 *  posed off the gun hand up beside his head like any carry), Sam's step events at the pair's pace (his tread is what the room hears of the pair) */
function holdTail(g: Game, dt: number, speed: number) {
  const pl = g.player, c = pl.char, H = pl.holding;
  c.anim.speed = speed; c.anim.crouchTarget = 0; c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.lookYawExtra = 0;
  c.anim.holdPose = H ? { phase: H.phase, t: H.t, variant: H.variant, gunOut: H.gunOut, gunPitch: c.aimPitch } : null;
  if (H) {
    const gd = H.g, hc = gd.char, an = hc.anim;
    an.speed = speed; an.reverse = pl.backpedal; an.crouchTarget = 0; an.upper = 'none'; an.stance = 'none'; an.lookYawExtra = 0; an.deliberate = 0;
    an.heldPose = { phase: H.phase, t: H.t, agitation: agitationOf(g, gd), variant: H.variant, shot: H.shotT >= 0 ? g.time - H.shotT : -1, armed: inHand(gd) === 'weapon' };   // (armed: the pistol is in his hand — combat.ts handProps draws it for anyone not carrying the torch on a calm patrol — so the raised hand stays a fist round it)
    if (gd.held) gd.held.phase = H.phase;
    // where his torch points: nowhere useful — up over Sam's arm at the ceiling, wandering with the struggle (torchCarryDir reads his aim yaw / pitch; the pistol, if
    // that is what he has out, just rides the raised hand). The yaw share stays small and eased — it is also his chest's twist, and his neck must stay on the arm.
    const torch = handCarry(gd) === 'torch'; const tt = g.time - H.since;
    hc.aimYaw = approachAngle(hc.aimYaw, hc.bodyYaw + (torch ? 0.07 * Math.sin(tt * 0.9) + 0.04 * Math.sin(tt * 2.3 + 1) : 0), 4 * dt);
    hc.aimPitch = damp(hc.aimPitch, torch ? 0.55 + 0.25 * Math.sin(tt * 1.3 + 2) + 0.1 * Math.sin(tt * 3.1) : 0, 6, dt);
  }
  armRifle(g, false, null);   // (a hold is hands-on: the rifle went to the sling at the grab and E draws the PISTOL to his head, never the rifle)
  c.update(dt);
  poseGunLight(g);
  const prevPhase = pl.stepPhase; pl.stepPhase = c.anim.phase;
  if (speed > 0.4 && ((prevPhase < 0.5) !== (pl.stepPhase < 0.5))) {
    const loud = tread(g, c.pos, 0.26, true);   // (the dragging shuffle: retimed like the walk, and on the floor it is on like every step)
    g.events.push({ kind: 'step', pos: v3.copy(c.pos), time: g.time, loud: false, level: loud }); pl.noise = Math.max(pl.noise, loud);
  }
}
function setPhase(g: Game, phase: HoldPhase) {
  const pl = g.player, H = pl.holding; if (!H) return;
  H.phase = phase; H.t = 0; H.windT = -1; H.fireQueued = false; if (H.g.held) H.g.held.phase = phase;
  cancelAsk(g);   // the choke / the whip going in over Sam's own question
}
/** Stop the choke / the whip that is under way (interact.ts cancelSustained: a Space tap, a step or Esc while it runs — what letting go of the held key used to
 *  be): mid-choke he drags a breath and the hold goes on; mid-whip the pistol goes back to his head — either way he felt what nearly happened (talk.abortT:
 *  rattled for it, dialogue.ts agitationOf). A choke merely CHOSEN and not yet on (windT inside its commit beat) is simply un-chosen, nothing felt. */
export function easeOffHold(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  if (H.phase !== 'choke' && H.phase !== 'whip') { H.windT = -1; return; }
  const was = H.phase; setPhase(g, 'held'); gd.talk.abortT = g.time;
  g.msg(was === 'whip' ? `checked it — the pistol goes back to ${gd.callsign}'s head` : `eased off — ${gd.callsign} is still with you`); g.audio.play('propScrape', v3.add(gd.char.pos, [0, 1.4, 0]), 0.1, { rate: 2.2 });
}
/** Sam's unfinished question dies in his mouth: no answer is coming (nothing was asked of the engine — the man's stage stands, and the next tap puts it afresh)
 *  and the line is cut to a breath. The choke or the whip going in over it (setPhase), or the gun coming out over it (swapHold) — one rule. An answer the man has
 *  already begun is his: it runs on. A remark still waiting its turn (H.after) goes the same way: the moment for it has passed. */
function cancelAsk(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return;
  H.after = null;
  if (!H.ask) return;
  H.ask = null; if (pl.bubble) pl.bubble.dur = Math.min(pl.bubble.dur, g.time - pl.bubble.t + 0.2);
}
/** The waiting remark goes up over Sam (updateHold: the man's line is down, nothing of Sam's is going up): his beat of a bubble, the murmur of it by the man's ear,
 *  the log's 'you ▸' like his questions. Nobody answers it. */
function sayAfter(g: Game) {
  const pl = g.player, H = pl.holding; if (!H?.after) return;
  const a = H.after; H.after = null;
  pl.bubble = { text: a.text, t: g.time, dur: samBeat(a.text.length), radio: false };
  g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2); g.note(`you ▸ ${a.text}`);
}
/** E with the man already in the arm (updateHold: phase 'held', and not inside the last swap's HOLD.secs.swap): the OTHER hold from here — both records renamed
 *  (Hold / Guard.held: the dialogue's gun-to-his-head term reads his), the hands made to say so exactly as E does anywhere (Player.holstered / slot through
 *  setHolstered — kit line, rig, rail light and grabVariant all follow that), and HOLD.secs.swap of lockout begun (swapT) in which the row starts nothing while
 *  the animator hands the fist over behind the man's shoulder (character.ts holdLayer): the old tool leaves it on the key's frame, the other comes into it half way through, back there (holdGunSide).
 *  arm → gun: a question Sam had not finished dies unanswered (cancelAsk — the rule the choke uses), a click queued for nothing is dropped, and once a hold, if
 *  the man is not mid-answer, Sam marks it with one of his pistol lines (dialogue.ts samRemarkFor — a remark: nobody answers, no stage moves; the log gets it
 *  like his questions). gun → arm: holstered, the knife back at his throat, and his row takes questions again — the man's stage exactly where it was. */
function swapHold(g: Game) {
  const pl = g.player, H = pl.holding; if (!H || H.phase !== 'held') return; const gd = H.g;
  const to: HoldVariant = H.variant === 'gun' ? 'arm' : 'gun';
  H.variant = to; if (gd.held) gd.held.variant = to;
  H.swapT = 0; H.windT = -1; H.fireQueued = false; H.gunOut = 0;   // (a choke / whip chosen and not yet on is un-chosen: the other tool is coming into the hand)
  pl.fireCd = Math.max(pl.fireCd, HOLD.secs.swap);   // (belt and braces with the lockout: no round while the gun is still coming up)
  cancelAsk(g);
  if (to === 'gun') {
    pl.slot = 'pistol'; setHolstered(g, false, true);   // (a canister he grabbed with goes back on the belt, the rifle stays on his back: it is the pistol that comes out)
    if (!H.remarked && !heldTalk(g, H).speaking && !gd.civ) {   // (no pistol line for a terrified cleaner: the men's remarks are about the men)
      const line = samRemarkFor(g, gd);
      if (line) { H.remarked = true; pl.bubble = { text: line.text, t: g.time, dur: samBeat(line.text.length), radio: false }; g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2); g.note(`you ▸ ${line.text}`); }
    }
    g.msg(`the pistol to ${gd.callsign}'s head — click fires past him, Space pistol-whips him; E holsters it again to question him`);
  } else {
    setHolstered(g, true, true);
    g.msg(`holstered, the knife back at ${gd.callsign}'s throat — Space questions him; hold Space for the choke's row`);
  }
  g.audio.play('equip', null, 0.45);
}
/** HOLD.secs.chokeHold after the choke was chosen in the arm variant: the elbow starts to close (updateHold finishes it at HOLD.secs.choke, or easeOffHold comes first) */
function startChoke(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const hc = H.g.char;
  setPhase(g, 'choke');
  g.audio.play('bodyHit', v3.add(hc.pos, [0, 1.4, 0]), 0.3, { rate: 0.55 });
  g.events.push({ kind: 'prop', pos: v3.copy(hc.pos), time: g.time, loud: false, level: CHOKE_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, CHOKE_NOISE);
}
/** HOLD.secs.chokeHold after the whip was chosen in the gun variant: the pistol comes off his head and cocks back (character.ts holdLayer 'whip'); nothing to hear
 *  yet — the crack is whipOut's, at HOLD.secs.whip, unless easeOffHold comes first */
function startWhip(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return;
  setPhase(g, 'whip'); H.gunOut = 0;
  g.audio.play('propScrape', v3.add(pl.char.pos, [0, 1.5, 0]), 0.12, { rate: 2.6 });   // the sleeve going back
}
/** The man rigid in front: HOLD.dist dead ahead of Sam on his facing — then pushed out of the statics and kept on the slab like anybody, and whatever the walls took
 *  off HIS station Sam gives up too (re-settled himself), a couple of rounds of it; so the pair stops at a wall ahead of the man, slides along one beside him, and
 *  in a squeeze he ends up where the walls let him, a hand off his station, never inside one. Other guards are kept off both circles before this (keepOffGuards /
 *  keepHeldOffGuards); door leaves push the pair through their own contacts (game.ts updateDoors — his carries a key). */
function placeHeld(g: Game) {
  const pl = g.player, c = pl.char, H = pl.holding; if (!H) return;
  const hc = H.g.char, hp = hc.pos, col = g.col, r = hc.radius;
  for (let k = 0; k < 3; k++) {
    const f = c.forward(); const wx = c.pos[0] + f[0] * HOLD.dist, wz = c.pos[2] + f[2] * HOLD.dist;
    hp[0] = wx; hp[1] = 0; hp[2] = wz;
    col.collideCircle(hp, r, 0.2, 1.5, 4); col.clampToWorld(hp, r);
    const dx = hp[0] - wx, dz = hp[2] - wz;
    if (dx * dx + dz * dz < 1e-8) break;
    c.pos[0] += dx; c.pos[2] += dz; collidePlayer(g, 1.7);
  }
}
/** living guards are as solid to the man in his arm as to Sam himself: one closer than KEEP_OFF to the held man's centre pushes the PAIR back (Sam moved, re-settled; placeHeld re-places the man) */
function keepHeldOffGuards(g: Game, dt: number) {
  const pl = g.player, c = pl.char, H = pl.holding; if (!H) return;
  const f = c.forward(); const hx = c.pos[0] + f[0] * HOLD.dist, hz = c.pos[2] + f[2] * HOLD.dist;
  for (const o of g.guards) {
    if (o === H.g || o.state === 'dead' || o.held) continue;
    const dx = hx - o.char.pos[0], dz = hz - o.char.pos[2]; const l = Math.hypot(dx, dz);
    if (l >= KEEP_OFF || l < 1e-4) continue;
    const push = Math.min(KEEP_OFF - l, 6 * dt); c.pos[0] += dx / l * push; c.pos[2] += dz / l * push;
    collidePlayer(g, 1.7);
  }
}
/** Where the exchange with the man in his arm stands: `asking` — Sam's own line is up and the answer is on its way (H.ask: a tap does nothing); `samUp` — a line
 *  of Sam's is in the air, question or remark (his word on the key he pocketed, sayAfter; the one as he draws): he is never cut, so a tap does nothing either;
 *  `speaking` — the man's current bubble is his answer this hold (else null); `ready` — a tap now opens the NEXT exchange: not while asking or while Sam speaks,
 *  and only once INTERROGATE_GAP of that answer is out (a tap sooner just cuts the line short) or the answer is gone (cut short already: nothing of it left to
 *  keep — the row must not offer to cut a line nobody can see) — at once if he has said nothing this hold; `settled` — ready AND the answer down to its last
 *  ANSWER_TAIL or gone: nothing would be cut (the row's wording; the tour's beat waits for it). askHeld acts on it, the panel row words itself by it. */
export function heldTalk(g: Game, H: Hold): { asking: boolean; samUp: boolean; ready: boolean; settled: boolean; speaking: Guard['bubble'] } {
  const gd = H.g, T = gd.talk, b = gd.bubble, sb = g.player.bubble;
  const speaking = b && T.lastT >= 0 && Math.abs(b.t - T.lastT) < 1e-6 && g.time - b.t < b.dur ? b : null;
  const fresh = T.lastT < 0 || T.lastT < H.since - 1e-6;   // no answer yet THIS hold (a man grabbed again keeps his stage, not his pacing)
  const asking = !!H.ask; const samUp = asking || (!!sb && sb.t >= H.since - 1e-6 && g.time - sb.t < sb.dur - 1e-9);   // (a line of his from before this hold is not this hold's)
  const ready = !samUp && (fresh || !speaking || g.time + 1e-6 >= T.lastT + INTERROGATE_GAP);
  const settled = ready && (!speaking || g.time + 1e-6 >= speaking.t + speaking.dur - ANSWER_TAIL);
  return { asking, samUp, ready, settled, speaking };
}
/** A tap on his row — one EXCHANGE: Sam's line first (dialogue.ts samLineFor: worded for the exchange that is coming, the hold's variant, the floor and the man),
 *  up over Sam for its beat (samBeat) with the question murmured by the man's ear; the answer follows when it ends (updateHold → answerHeld). While Sam speaks a
 *  tap does nothing; inside the first INTERROGATE_GAP of an answer it only cuts the line short; after that it cuts in — what was left of the answer goes and the
 *  next question is put. Sam's words reach the log too ('you ▸ …', a note: quiet under the tour flag). Nothing on the man's side moves until he answers. */
function askHeld(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const { samUp, ready, speaking } = heldTalk(g, H);
  if (samUp) return;
  if (!ready) { if (speaking) speaking.dur = Math.min(speaking.dur, g.time - speaking.t + 0.3); return; }
  if (speaking) speaking.dur = Math.min(speaking.dur, g.time - speaking.t);   // cutting in: the rest of that answer goes as Sam's next line comes up (it ends this frame — the two are never up together)
  const line = gd.civ ? civilianSamLine(g, gd) : samLineFor(g, gd, H.variant);   // (a civilian gets his quiet, plain questions — civilians.ts)
  const dur = samBeat(line.text.length);
  pl.bubble = { text: line.text, t: g.time, dur, radio: false };
  H.ask = { t: g.time, dur }; H.after = null;   // (a remark that was still waiting for that answer to end has been beaten to the air by the next question: dropped)
  g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2);   // the question under his breath by the man's ear (the answer's muffle comes with the answer: answerHeld)
  g.note(`you ▸ ${line.text}`);
}
/** Sam's line has hung its beat (updateHold): the man answers it — Game.interrogate exactly as it always ran (his stage, what he gives, his bubble with the
 *  interrogation's longer hold, or the log), and the muffled sound of it under the arm. */
function answerHeld(g: Game) {
  const H = g.player.holding; if (!H) return; const gd = H.g;
  const pick = g.interrogate(gd);
  if (pick) g.audio.play('heldProtest', v3.add(gd.char.pos, [0, 1.5, 0]), 0.16);   // (that buffer carries its own 0.3 s of lead: it lands under the bubble, not on its edge)
}
/** The man has just given the keyed door up — dialogue kind 'door', '…we all carry one, mine's on my belt' (game.ts interrogate calls this on that answer, held
 *  or the sandbox's bare exchange alike): Sam takes what is on his belt. Player.keys gains every key the man carried that Sam lacked and Guard.keys empties
 *  (the same man has nothing more to hand over; a second holder of a key already pocketed changes nothing — no sound, no word); for anything new: the small
 *  bright clack of the clip coming off his belt, one for the debrief (mission.ts tally, live runs only), a line in the log, the kit column's KEY tag from this
 *  frame (overlay.ts reads Player.keys) — and, with the man in his arm, Sam's word on it (dialogue.ts samKeyLineFor) queued to follow the man's line down
 *  (Hold.after → sayAfter: the two are never up together). From here his door contact and every lock test carry the key (game.ts updateDoors, Doors.lockedOut). */
export function takeKey(g: Game, gd: Guard, rnd: () => number = Math.random) {
  const pl = g.player, H = pl.holding;
  const fresh = [...gd.keys].filter(k => !pl.keys.has(k)); gd.keys.clear();
  if (!fresh.length) return;
  for (const k of fresh) pl.keys.add(k);
  g.audio.play('lockPick', v3.add(gd.char.pos, [0, 1.0, 0]), 0.45, { rate: 1.6 });   // the key ring unclipped at his hip: the pick's tick, pitched up — small, bright, close
  tally(g, 'keys'); chronKey(g, gd);   // one for the card's count, one for the timeline
  g.msg(`took ${gd.callsign}'s key — the keyed doors open to you now, no pick, no kick`);
  if (H && H.g === gd) { const line = samKeyLineFor(g, gd, H.variant, rnd); if (line) H.after = line; }
}

/** After the door leaves have had their say (game.ts updateDoors, behind settlePlayer): whatever a leaf shoved the held man off his station by, the PAIR gives — Sam
 *  takes the same shove (settled against the statics) and the man goes back on station from there, both re-baked where they ended up. So a leaf at its stop, or a
 *  hinge post, is as solid to the two of them as a wall is (placeHeld), instead of prising him off the arm for a frame. Not during the reach. */
export function settleHeld(g: Game) {
  const pl = g.player, H = pl.holding; if (!H || H.phase === 'grab') return;
  const c = pl.char, hc = H.g.char, hp = hc.pos, f = c.forward();
  const dx = hp[0] - (c.pos[0] + f[0] * HOLD.dist), dz = hp[2] - (c.pos[2] + f[2] * HOLD.dist);
  if (dx * dx + dz * dz < 1e-6) return;
  c.pos[0] += dx; c.pos[2] += dz; collidePlayer(g, 1.7); placeHeld(g);
  hc.update(0); c.update(0);
}
/** The choke run through HOLD.secs.choke: he goes limp in the arm and folds forward at Sam's feet — killGuard's quiet path ('choked': out cold, breathing, a knockout on
 *  the card; the torch leaves his hand and dies), the ragdoll seeded from the slumped pose. The room hears him meet the floor. */
function chokeOut(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const f = pl.char.forward();
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  g.audio.play('chokeLimp', v3.add(gd.char.pos, [0, 1.4, 0]), 0.35);   // the last of his air and his jacket folding over the arm — the floor's thud is the ragdoll's own (Game.bodyThud)
  killGuard(g, gd, f, true, 'choked', 'player');
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: FOLD_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, FOLD_NOISE);
  pl.holding = null;
}
/** The whip run through HOLD.secs.whip in the gun variant: the pistol lands behind his right ear and he drops out of the arm — killGuard's quiet path like the cross
 *  ('struck': out cold, breathing, a knockout on the card; what he held is laid down), the ragdoll folding forward and to his left, the way the blow sent his head
 *  (character.ts heldLayer has already started it that way, so the body carries it). Quick, but the crack of it and the fall are the loudest thing a hold does. */
function whipOut(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const f = pl.char.forward(); const dir = v3.normalize([f[0] + f[2] * 0.45, 0, f[2] - f[0] * 0.45]);   // forward and to his left (left of forward = (f.z, 0, −f.x))
  const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]);
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  killGuard(g, gd, dir, true, 'struck', 'player', 'pistol-whipped — out cold, and that was not quiet');
  g.audio.play('whipThud', head, 0.7);   // steel on bone: the thump of it going through his skull, the frame's click, his collar as the head goes over
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: WHIP_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, WHIP_NOISE);
  pl.holding = null; pl.fireCd = Math.max(pl.fireCd, 0.5);   // (the gun hand is busy following through)
}
/** He comes out of the arm his own man — and an instant witness: he knows exactly who had him and where. Off the hold (held, the animator's pose, the dialogue's
 *  clock), everything the AI reads for 'eyes on Sam right now' seeded (awareness full, the fix on Sam, a fresh real sighting), a stagger of `stagger` seconds
 *  (reactT) before he can act — updateGuard's own transition takes him to alert next frame with its bark and books what did it — and the jolt of it through his
 *  trunk. Back on the net too: nothing about him is missing any more. A man already down is only unhooked. */
function handBack(g: Game, gd: Guard, stagger: number) {
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  gd.speed = 0; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.bodyDuty = null; gd.stallRef = null; gd.char.aimPitch = 0;
  if (gd.state === 'dead') return;
  const pp = g.player.char.pos;
  gd.awareness = 1; gd.lastKnown = v3.copy(pp); gd.lastSeenT = g.time; gd.sightPos = v3.copy(pp); gd.sightVel = [0, 0, 0]; gd.sightT = g.time; gd.ledT = g.time;   // (ledT: nothing to lead — he was not watching Sam walk out of sight, Sam had him by the throat)
  gd.reactT = Math.max(gd.reactT, stagger); gd.heardUpTo = g.eventSeq;   // (nothing stale in the queue is news to him)
  gd.missedAt = -1; gd.missingRaised = false;
  resetChase(gd); gd.searchT = 0;
  gd.char.anim.hit();
}
/** Let go at once — Sam shot down with him in the arm, a teleport / the tour taking the hands (cancelActions): the man is handed straight back (handBack), Sam's side
 *  cleared. The one way a held man comes free on his feet: there is no letting him go. */
export function freeHeld(g: Game, why: 'shot' | 'cancel') {
  const pl = g.player, H = pl.holding; if (!H) return;
  handBack(g, H.g, why === 'shot' ? 0.6 : 0.3);
  pl.holding = null; pl.char.anim.holdPose = null;
  if (why === 'shot') { g.audio.play('shove', v3.add(H.g.char.pos, [0, 1.3, 0]), 0.3); g.msg(`${H.g.callsign} is loose`); }   // he wrenches free of the slackening arm (quieter than a shove: nobody pushed); a cancel — the tour, a teleport — makes no sound
}
/** the hold simply ceases (the man is gone from under it: reset, or dead in the arm): Sam's side cleared, and his if he is still about */
function dropHold(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return;
  const gd = H.g; if (gd.held?.by === 'player') gd.held = null; gd.char.anim.heldPose = null; if (gd.state !== 'dead') gd.talk.heldSince = -1;
  pl.holding = null; pl.char.anim.holdPose = null;
}

// ------------------------------------------------------------ locked doors: pick it (quiet, slow) or kick it in (instant, floor-wide loud)
/** The 'pick the lock' row on a door locked against you (Game.updateDoors): drop whatever the hands were doing and start working the lock — updatePicking runs
 *  the beat on its own from here; a step, a Space tap or Esc breaks off (interact.ts cancelSustained → stopPicking). */
export function startPicking(g: Game, d: Door) {
  const pl = g.player, c = pl.char; if (pl.down || pl.takedown || pl.kick) return;
  if (d.def.steel) { g.msg('no keyway on this side of the stair door — nothing to pick'); return; }   // (the row is never offered for it; a script asking anyway gets the reason)
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  cancelReloads(pl); pl.throwHeld = false; pl.throwPreview = null; pl.sprinting = false; pl.easing = null;
  pl.picking = d; pl.crouch = true;   // you work a lock on your knee — and stay down there afterwards
  if (d.pick <= 0) g.msg('picking the lock — a step or Space breaks off');
}
/** Hands off the tools (the pick broken off — a step, Space, Esc, the tour, a man coming through with his key — or done): the progress stays on the door a couple
 *  of seconds (doors.ts), he stays on his knee. */
export function stopPicking(g: Game, text?: string) {
  const pl = g.player; if (!pl.picking) return;
  pl.picking = null; pl.char.anim.lockpick = false; pl.speedSm = 0; if (text) g.msg(text);
}

/** Working the lock, on its own clock once begun: eased onto the spot square in front of the keyway (Doors.workSpot), crouched and still, body and eyes on
 *  the lock, hands on the tools (anim.lockpick — once they are there hideHeldItem sends the pistol to the thigh and the rail light with it), and only then does
 *  the cylinder advance (Doors.pick: soft clicks the room hears, a louder snap as it goes). A step, a Space tap or Esc break off with the progress kept on the
 *  door for a couple of seconds (interact.ts); the tour taking over, or the leaf unlatching under your hands (a guard and his key coming through) end it here. */
export function updatePicking(g: Game, dt: number, input: Input) {
  const pl = g.player, c = pl.char, d = pl.picking!;
  const stop = (text?: string) => stopPicking(g, text);
  if (g.puppet) stop();
  else if (!g.doors.lockedOut(d, c.pos)) stop(d.locked ? 'someone is coming through' : undefined);   // unlatched from the far side while still locked: a key, not you
  else {
    const spot = g.doors.workSpot(d, c.pos);
    c.vel = [0, 0, 0]; c.pos = v3.lerp(c.pos, spot.pos, 1 - Math.exp(-10 * dt)); collidePlayer(g, 1.0); keepOffGuards(g, dt, 1.0);   // (a guard walking into you shoves you off the spot: the work pauses until you settle back)
    c.bodyYaw = approachAngle(c.bodyYaw, spot.yaw, 12 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0, 8, dt);   // square on, no chest twist: the hands are solved in front of the body
    pl.crouch = true; pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false;
    c.anim.lockpick = true; c.anim.speed = 0; c.anim.crouchTarget = 1; c.anim.upper = 'none';
    const planted = v3.distXZ(c.pos, spot.pos) < 0.12 && c.anim.hideHeldItem;   // there, and the tools are in the keyway
    if (planted && g.doors.pick(d, PLAYER_ID, dt)) { chronDoor(g, 'lockPicked', d); stop('the lock gives — it opens like any other door now'); }
  }
  armRifle(g, pl.rifleUp && !c.anim.hideHeldItem, 'lowLong');   // the rifle stays in the hands, low, until they are on the tools (hideHeldItem — combat.ts handProps swings it onto his back on the same flag), and comes back into them as they come off
  c.update(dt);
  poseGunLight(g);   // the light rides the gun: lit only while the gun is still (or again) in the hand — and in the hand at all (he starts holstered now)
}

/** Keying a code in (Player.coding — devices.ts): stood at the pad with the feet still (a guard walking into him shoves him, as at the lock), turned to face
 *  the plate, nothing in the sights, the rifle low; nothing here reads the movement keys or the buttons (interact.ts stops the verb on a fresh key). */
function updateCodingPlant(g: Game, dt: number) {
  const pl = g.player, c = pl.char; const K = g.devices.padOf(pl.coding!);
  c.vel = [0, 0, 0]; collidePlayer(g, 1.0); keepOffGuards(g, dt, 1.0);
  if (K) { c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(-K.n[0], -K.n[2]), 10 * dt); c.aimYaw = c.bodyYaw; }
  c.aimPitch = damp(c.aimPitch, 0, 8, dt); pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false; c.anim.speed = 0; c.anim.upper = 'none';
  armRifle(g, pl.rifleUp, 'lowLong'); c.update(dt); poseGunLight(g);
}

/** Kick a door in: the 'kick it in' row on a door locked against you, or a sprint straight into one (Game.updateDoors). One committed second: updateKick.
 *  Offered crouched too — it stands him up into it — so not where he cannot stand (canStand: the row is withheld there, and this refuses). */
export function startKick(g: Game, d: Door) {
  const pl = g.player, c = pl.char; if (pl.kick || pl.down || pl.takedown || c.anim.kicking) return;   // (anim.kicking without pl.kick: the leg is still coming down from a kick a teleport broke off — its clock would time this one's impact wrong)
  if (pl.crouch && !canStand(g)) { g.msg('no room to stand for a kick here'); return; }
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  pl.picking = null; c.anim.lockpick = false; pl.easing = null; pl.sprinting = false; pl.crouch = false; pl.throwHeld = false; pl.throwPreview = null; pl.fHeld = true; pl.speedSm = 0;
  cancelReloads(pl);
  const spot = g.doors.kickSpot(d, c.pos);   // taken ONCE, off the leaf as it stands now: a man coming through with his key mid-kick swings the leaf, and a spot re-read off the swinging leaf orbited the hinge with it — reeling the planted kicker through the doorway (or at 20 fps through the wall beside it)
  pl.kick = { door: d, spot: spot.pos, yaw: spot.yaw }; c.anim.kickDoor();
}

/** The kick beat (CharacterAnimator.kickDoor, 1.0 s): eased back / up to the kicking distance square to the leaf by the lock (Doors.kickSpot, fixed when the
 *  kick began) over the wind-up, rooted there; on the impact frame the lock goes (Doors.kickIn: keep torn out, leaf flung to its stop, the crack of it through
 *  the whole floor); control returns when the animator has the foot planted again. The rail light stays on the gun throughout (pulled into the high carry, it sweeps the door). */
export function updateKick(g: Game, dt: number) {
  const pl = g.player, c = pl.char, d = pl.kick!.door;
  const spot = pl.kick!;
  c.vel = [0, 0, 0];
  if (c.anim.kickTime < 0.45) { c.pos = v3.lerp(c.pos, spot.spot, 1 - Math.exp(-12 * dt)); collidePlayer(g, 1.7); }   // set the distance during the chamber; from the strike on, the planted foot stays where it is
  keepOffGuards(g, dt, 1.7);
  c.bodyYaw = approachAngle(c.bodyYaw, spot.yaw, 16 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0, 8, dt);
  pl.sprinting = false; pl.crouch = false; pl.backpedal = false; c.anim.reverse = false; c.anim.lockpick = false;
  c.anim.speed = 0; c.anim.crouchTarget = 0; c.anim.upper = pl.pistolUp ? 'relaxed' : 'none';   // (the carry arms only with the gun actually out: holstered — the default now — the kick keeps the hands free instead of pulling an empty high-ready)
  armRifle(g, pl.rifleUp, 'portLong');   // the rifle across the chest at the high port for the kick, as the rifleman's is
  c.update(dt);
  if (c.anim.kickImpact) { g.doors.kickIn(d, c.pos, PLAYER_ID); kickScuff(g, d, c.pos); if (!d.def.steel) { g.msg('kicked it in — the whole floor heard that'); chronDoor(g, 'doorKicked', d); } }   // the boot's scuff by the lock on his face of the leaf, riding it as it flies (marks.ts) — a steel door takes the scuff too, says its own word (game.ts onDoorEvent 'clang') and stays shut: nothing kicked in to chronicle
  if (!c.anim.kicking) pl.kick = null;
  poseGunLight(g);
}

/** Planar distance from the player to a corpse, wherever the ragdoll left it: the nearer of its ankles (what you take hold of) and its hips. */
export function bodyDist(g: Game, gd: Guard): number {
  const p = g.player.char.pos, b = gd.char.bones;
  const a: Vec3 = [p[0], 0.5, p[2]];
  const reach = (q: Vec3 | undefined) => { if (!q) return 99; const t: Vec3 = [q[0], 0.5, q[2]]; return g.col.solidBlocked(a, t) || g.col.segmentBlockedDynamic(a, t) ? 99 : v3.distXZ(q, p); };   // not through a partition or a shut door
  return Math.min(reach(b.footL), reach(b.footR), reach(b.hips) + 0.3);   // by the hips still means gathering the legs in first: count it a little further
}

/** Throw origin (right hand-ish) */
export function throwOrigin(g: Game): Vec3 { const c = g.player.char; const f = c.forward(); return [c.pos[0] + f[0] * 0.32, c.pos[1] + (g.player.crouch ? 1.05 : 1.5), c.pos[2] + f[2] * 0.32]; }

export function doThrow(g: Game, sol: ThrowSolution, kind: ThrowKind) {
  const pl = g.player; if (g.throwCount(kind) <= 0) { g.msg(kind === 'flash' ? 'no stun canisters left' : 'no smoke canisters left'); return; }
  if (pl.pendingThrow) return;                                   // one in the air per wind-up (double-tap G would otherwise eat a canister)
  if (kind === 'flash') pl.flashbangs--; else pl.canisters--;   // (always counted at the wind-up so a cancel's refund stays exact; under unlimited ammo the can comes BACK at release — the pendingThrow branch in update)
  pl.char.anim.throwItem(); pl.pendingThrow = { t: THROW_RELEASE, sol, kind };   // it leaves the hand as the arm comes over the top (character.ts throwLayer), along the arc previewed at the click
  g.audio.play('throw', throwOrigin(g), 0.7);
}

export function updateAim(g: Game, input: Input, cam: FollowCamera, canvas: HTMLCanvasElement) {
  if (g.puppet?.aim) {   // scripted aim: put the cursor where the point projects (anywhere in front of the eye, on the view or off it)
    const [sx, sy, front] = cam.project(g.puppet.aim, canvas.clientWidth, canvas.clientHeight, Infinity, 1e-3);
    if (front) { input.mouseX = sx; input.mouseY = sy; }
  }
  const u = input.mouseX / Math.max(1, canvas.clientWidth), v = input.mouseY / Math.max(1, canvas.clientHeight);
  const ray = cam.ray(u, v);
  const hit = g.engine.world.raycast(ray.ro, ray.rd, 200, undefined, PLAYER_ID);
  let p: Vec3 | null = hit ? v3.mad(ray.ro, ray.rd, hit.t) : cam.groundPoint(u, v, 0);
  if (!p) p = v3.add(v3.add(g.player.char.pos, g.player.char.forward()), [0, 1.15, 0]);   // cursor ray missed everything: aim level, straight ahead
  if (g.puppet?.aim) p = v3.copy(g.puppet.aim);   // a scripted aim IS the point: the cursor above only places the ring / the snap / the hover — the eye's ray to it can meet a leaf or a man standing between a showcase's lens and Sam, and the arm would follow THAT (a set-up behind him had him aim back over his shoulder at the door he came through)
  g.aimPoint = p;
  buildInteractables(g, cam, input.mouseX, input.mouseY, canvas.clientWidth, canvas.clientHeight);
  // Generous auto-aim (Chaos Theory): the reticle SNAPS to the nearest light or a living guard's centre of mass within SNAP_PX of the cursor —
  // guards win over lights on a near tie, a light behind the man the tour is shooting at never steals the shot (puppet without .fixtures),
  // and the ring on the HUD is drawn at the snapped thing so you can see what a click / right click will do; raw aim when nothing is near.
  const W = canvas.clientWidth, H = canvas.clientHeight, mx = input.mouseX, my = input.mouseY;
  let bestPx = SNAP_PX; g.aimTarget = null; g.aimGuard = null; g.aimSnap = null;
  if (!(g.puppet && !g.puppet.fixtures)) for (const it of g.interactables) {   // lights (still enumerated by buildInteractables for exactly this)
    if (it.kind !== 'light' || !it.target) continue;
    const [sx, sy, front] = cam.project(it.pos, W, H); if (!front) continue;
    const d = Math.hypot(sx - mx, sy - my); if (d < bestPx) { bestPx = d; g.aimTarget = it.target; g.aimSnap = v3.copy(it.pos); }
  }
  const held = g.player.holding?.g ?? null;   // the man in Sam's arm is nobody to draw a line on (a round past him goes to whatever else the reticle has)
  for (const gd of g.guards) {
    if (gd.state === 'dead' || gd === held) continue;
    const com: Vec3 = gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.2, 0]);
    const [sx, sy, front] = cam.project(com, W, H); if (!front) continue;
    const d = Math.hypot(sx - mx, sy - my) - 6;   // (a hair of preference for men over fixtures)
    if (d < bestPx && !g.col.segmentBlocked(v3.add(g.player.char.pos, [0, 1.3, 0]), com)) { bestPx = d; g.aimGuard = gd; g.aimTarget = null; g.aimSnap = com; }   // only a man Sam could actually draw a line on
  }
  // the exact ray still counts when it lands ON a man the loose test missed (a sliver of him showing round cover)
  if (!g.aimGuard) { let bestT = hit ? hit.t : 1e9; for (const gd of g.guards) { if (gd === held) continue; const t = gd.char.rayHit(ray.ro, ray.rd, bestT + 0.5); if (t >= 0 && t < bestT + 0.5) { g.aimGuard = gd; g.aimTarget = null; g.aimSnap = gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.2, 0]); bestT = t; } } }
  if (g.aimSnap && !g.puppet?.aim) g.aimPoint = v3.copy(g.aimSnap);   // the gun follows the snap (rounds already went to aimTarget / aimGuard; this makes the arm and the laser agree with the ring)
}
/** screen-space reach of the auto-aim, CSS px */
export const SNAP_PX = 60;

/** Every marker Space concerns itself with this frame (Game.interactables: one per thing — the dots in the world, the auto-aim's lights) and the ROWS: what Space
 *  can do right now, one verb per row (Game.nearby — the top MAX_NEAR by what matters, the cancel row at the foot while the selector is open), and the highlighted
 *  one (Game.hover: a Space tap does it, Space held opens the list to choose another — interact.ts). Every verb is its own row: a shut door is 'push it open' AND
 *  'ease it open — silent'; a lock is 'pick' and 'kick'; the man in the arm is 'question him' and 'choke him out'. While a sustained verb runs (a leaf easing, a
 *  lock being picked, the choke, the drive) its row is the ONLY row — worded as running, with its progress — and nothing else is on offer until it ends or is stopped. */
export function buildInteractables(g: Game, cam: FollowCamera, mx: number, my: number, w: number, h: number) {
  const pl = g.player; const list: Interactable[] = []; const p = pl.char.pos;
  /** in-reach things with their verb rows, ordered below by interactOrder on the marker; each thing's verbs in the order authored here (the everyday verb first, its deliberate alternative under it — for a lock the quiet pick above the loud kick) */
  const things: { it: Interactable; verbs: Interactable[] }[] = [];
  let rows: Interactable[] = [];
  /** a verb row: the marker's identity, 'Space␠␠<verb>' and any hint lines for the thing's OTHER inputs (overlay.ts parseOpts splits on '  ·  ') */
  const row = (base: Interactable, verb: Verb, text: string, hints = '', over: Partial<Interactable> = {}): Interactable => ({ ...base, verb, running: false, progress: undefined, line2: `Space  ${text}${hints ? '  ·  ' + hints : ''}`, ...over });
  /** the one row of a running sustained verb: worded as running, its bar, and how it stops */
  const running = (base: Interactable, verb: Verb, text: string, progress: number): Interactable => ({ ...base, verb, running: true, line2: text, progress: Math.max(0, Math.min(1, progress)), inReach: true });
  /** a row Space does nothing with (getting hold of him…, kicking it in…): no verb */
  const status = (base: Interactable, text: string): Interactable => ({ ...base, verb: undefined, running: false, line2: text, progress: undefined, inReach: true });
  /** the marker of a thing that has verb rows: its line2 lists them the way the rows word them (probes and the dots read the marker; the panel reads the rows) */
  const offer = (it: Interactable, verbs: Interactable[]) => { if (verbs.length) { it.line2 = verbs.map(v => v.line2).join('  ·  '); things.push({ it, verbs }); } list.push(it); };
  for (const t of g.targets) {
    if (t.broken || !t.interactive) continue;
    list.push({ kind: 'light', pos: t.pos, line1: `${t.name}${t.factor > 0 ? '' : ' (off)'}`, line2: 'right-click  OCP (the pistol\'s)  ·  click  shoot', inReach: true, off: t.factor <= 0, target: t });
  }
  if (!pl.down && pl.holding) {
    // a man in his arm: HIS rows are the only rows. The ARM hold: 'question him' — what the next exchange puts to him (dialogue.ts promptFor: the verb changes as
    // he is leaned on, names the useful thing when he is about to give it, and says so once he is dry; Sam's actual words go up over Sam when it is done) with
    // where the exchange stands (Sam asking · his answer just begun: it cuts it short · far enough in: it cuts in with the next) — and 'choke him out', E to draw
    // as its hint; the GUN hold: the one row is the pistol-whip, with the click past him and E to holster (the way back to questions) as hints. The grab settling,
    // and a choke / whip chosen or under way, are the running row. The doors about the pair are markers only (they are walked into: a shut leaf pushes open ahead
    // of him, a lock turns for HIS key). Nothing else is on offer with both hands on him.
    const H = pl.holding, gd = H.g, gun = H.variant === 'gun', K = HOLD.secs;
    const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]);
    const cv = gd.civ;   // a CIVILIAN in the arm (civilians.ts): her rows — what she knows / 'stay down, stay quiet' (lets her go) / the choke; the whip with the pistol out; every civilian on the floor by his hand costs him
    const base: Interactable = { kind: 'held', pos: [head[0], head[1] + 0.3, head[2]], line1: cv ? `${gd.callsign} · the ${cv.label} · ${gun ? `your pistol at ${cv.her} head` : 'in your arm'}` : `${gd.callsign} · ${gun ? 'your pistol at his head' : 'in your arm'}`, line2: '', inReach: true, off: false, guard: gd };
    if (H.phase === 'grab') rows.push(status(base, cv ? `getting hold of ${cv.her}…` : 'getting hold of him…'));
    else if (H.phase === 'held' && H.swapT < K.swap) rows.push(status(base, gun ? 'the pistol coming up to his head…' : 'holstering it — the knife back at his throat…'));   // E's hand-over: nothing starts while the hand is between tools
    else if (H.phase === 'choke' || (H.windT >= 0 && !gun)) rows.push(running(base, 'choke', 'choking him out… — Space or a step and he breathes again', H.phase === 'choke' ? H.t / K.choke : 0));
    else if (H.phase === 'whip' || (H.windT >= 0 && gun)) rows.push(running(base, 'whip', 'pistol-whip… — Space or a step checks it', H.phase === 'whip' ? H.t / K.whip : 0));
    else if (cv && gun) { rows.push(row(base, 'comply', `“stay down, stay quiet” — lets ${cv.her} go, cowering`)); rows.push(row(base, 'whip', `pistol-whip ${cv.her} — out cold. a CIVILIAN: −10 on the card`, `E  holster — to question ${cv.her}`)); }
    else if (cv) {
      const tk = heldTalk(g, H); const dry = gd.talk.stage >= 1 && cv.intelN >= (CIV_LINES.intel[cv.def.kind]?.length ?? 0);   // (fear first, then the two or three things she knows, then nothing)
      const ask = tk.asking ? `you're asking — ${cv.she} answers in a beat` : tk.samUp ? 'once you have had your say' : !tk.ready ? `${cv.she}'s answering — tap to cut it short` : dry ? `${cv.she}'s told you everything — ask anyway` : gd.talk.stage === 0 ? `ask what ${cv.she} knows — quietly` : `press ${cv.her} — what else`;
      rows.push(row(base, 'question', ask));
      rows.push(row(base, 'comply', `“stay down, stay quiet” — lets ${cv.her} go, cowering; ${cv.she} tells nobody`));
      rows.push(row(base, 'choke', `choke ${cv.her} out — quiet. a CIVILIAN: −10 on the card`, 'E  draw — gun to her head'));
    }
    else if (gun) rows.push(row(base, 'whip', 'pistol-whip him — quick, a thud', `LMB  ${pl.pistol.roundsReady > 0 ? 'fire past him' : 'fire past him (empty)'}  ·  E  holster — to question him`));
    else {
      const q = promptFor(g, gd), tk = heldTalk(g, H); const verb = q.spent ? "he's said his piece — ask anyway" : `“${q.text}”`;
      const ask = tk.asking ? "you're asking — he answers in a beat" : tk.samUp ? `${verb} — once you've had your say` : !tk.ready ? "he's answering — tap to cut it short" : `${verb}${tk.settled ? '' : ' — cuts in'}`;   // (samUp without asking: a remark of Sam's is in the air — his word on the key he has just pocketed — and he is never cut)
      rows.push(row(base, 'question', ask));
      rows.push(row(base, 'choke', 'choke him out — quiet', 'E  draw — gun to his head'));
    }
    list.push({ ...base, line2: rows.map(r => r.line2).join('  ·  '), progress: rows[0]?.progress });   // the marker (the ring sits on it; its text = the rows')
    for (const d of g.doors.list) {
      if (Math.min(v3.distXZ(d.pos, p), v3.distXZ(d.frameCentre, p)) > NEARBY_M) continue;
      const lockedOut = g.doors.lockedOut(d, p);   // (his own pocket aside: it is the man ahead who meets the leaf, and every man on the staff is keyed)
      list.push({ kind: 'door', pos: d.pos, line1: `door · ${lockedOut ? 'locked' : d.isClosed() ? 'shut' : 'open'}`, line2: lockedOut ? 'walk him into it — his key turns the lock' : d.isClosed() ? 'walk him into it — it pushes open' : 'open', inReach: false, off: false, door: d });
    }
  } else if (!pl.down) {
    const busy = !!(pl.takedown || pl.kick || pl.picking || pl.easing || pl.coding || g.mission.driveT >= 0);   // hands or feet spoken for: no fresh verbs this frame (the running verb's row, or a status, stands alone below)
    for (const d of g.doors.list) {
      const dp = d.pos; const near = Math.min(v3.distXZ(dp, p), v3.distXZ(d.frameCentre, p)) < Doors.USE_REACH; const reach = near && !pl.sprinting;
      const shut = d.isClosed(); const pct = `${Math.min(99, Math.round(d.pick * 100))}%`;
      const it: Interactable = { kind: 'door', pos: dp, line1: '', line2: reach ? '' : 'step closer', inReach: reach, off: false, door: d };
      const verbs: Interactable[] = [];
      const pad = padState(g, d, p);   // a KEYPAD door against you (devices.ts): no cylinder to pick, no handle to try — the code if you know it (four keys and it swings like a keyed door), the pad refusing you if you do not, or the boot as ever
      if (pad) {
        it.line1 = pl.coding === d ? 'door · keypad · keying it in' : pad.known ? `door · keypad — you know the code (${spell(pad.pad.def.code)})` : 'door · keypad · locked';
        if (!reach) it.line2 = pl.sprinting && near ? 'run into it  kick it in (LOUD)' : 'step closer';
        else if (!busy) {
          if (pad.known) verbs.push(row(it, 'code', `enter the code — ${spell(pad.pad.def.code)}`)); else verbs.push(row(it, 'nocode', 'keypad — no code', '', { off: true }));
          if (!pl.dragging && (!pl.crouch || canStand(g))) verbs.push(row(it, 'kick', 'kick it in — LOUD', pl.crouch ? '' : 'or sprint into it'));
        }
      } else if (g.doors.lockedOut(d, p, pl.keys)) {   // the lock is against you: pick it (quiet, slow) or kick it in (instant, and the whole floor hears) — crouched you can also just try the handle; hauling a body, no kick
        const steel = !!d.def.steel;   // the stair door (game/qrf.ts): bolted from the far side, a blank plate this side — no keyway to work, and a boot only rings off it
        it.line1 = d.rattleT > 0 ? "door · locked — won't budge" : steel ? 'steel fire door · bolted from the stairs' : pl.picking === d ? 'door · locked · picking it' : d.pick > 0 ? `door · locked · ${pct} picked` : 'door · locked';
        it.progress = d.pick > 0 ? d.pick : undefined;
        if (!reach) it.line2 = pl.sprinting && near ? (steel ? 'run into it  (it will not give)' : 'run into it  kick it in (LOUD)') : 'step closer';
        else if (!busy) {
          if (!steel) verbs.push(row(it, 'pick', d.pick > 0 ? `pick the lock — quiet, ${pct} done` : 'pick the lock — quiet, 4 s'));
          if (pl.crouch || pl.dragging || steel) verbs.push(row(it, 'rattle', steel ? 'try the bar — no keyway this side' : 'try the handle'));
          if (!pl.dragging && (!pl.crouch || canStand(g))) verbs.push(row(it, 'kick', steel ? 'kick it — LOUD, and steel does not give' : 'kick it in — LOUD', pl.crouch ? '' : 'or sprint into it'));
        }
      } else if (g.doors.keyOpens(d, p, pl.keys)) {   // against you but for the key in your pocket (takeKey): it turns like a guard's — a small clack and it swings, or eased round in silence
        it.line1 = 'door · locked — you have the key';
        if (reach && !busy) { verbs.push(row(it, 'unlock', 'unlock — his key')); verbs.push(row(it, 'ease', 'ease it open — silent')); }
      } else {
        it.line1 = `door · ${shut ? 'shut' : 'open'}${d.lockBroken ? ' · lock kicked in' : d.def.locked && !d.locked ? ' · picked' : ''}`;
        if (reach && !busy) {
          if (shut) verbs.push(row(it, 'push', 'push it open')); else verbs.push(row(it, 'pull', 'pull it shut'));   // (Doors.use: shut → it swings away from you with its creak; anything wider → pulled to)
          if (Math.abs(d.angle) < EASE_OFFER) verbs.push(row(it, 'ease', 'ease it open — silent'));                  // shut or a hand ajar: inch it round without a sound (game.ts updateDoors runs it on to EASE_MAX)
        }
      }
      offer(it, verbs);
    }
    for (const gd of g.guards) {
      if (gd.state === 'dead' || pl.takedown) continue;
      // from close behind a guard who has not clocked you (not alert, you in his rear half-space, nothing solid between): the row GRABS him, a LEFT CLICK with the
      // hands empty = the silent takedown (game.ts updateDoors reads both; startGrab / startTakedown) — one gate for the two, so wherever the cross could land the
      // arm can go round him. The row spells out what the hand holds: empty, the click is the takedown; the pistol drawn, the grab puts it to his head and a click
      // would be a round (holster first, E); a canister up, the grab is the arm and the click a throw (holster first too). Crouched under something he cannot
      // stand up out of, no grab (the pair stands): the row says so.
      const gp = gd.char.pos; const dx = p[0] - gp[0], dz = p[2] - gp[2]; const dd = Math.hypot(dx, dz);
      if (dd < 2.4) {
        const behind = Math.cos(wrapAngle(Math.atan2(dx, dz) - gd.char.bodyYaw)) < -0.25;   // you are in his rear half-space
        const could = dd < 1.05 && behind && gd.state !== 'alert' && !pl.sprinting && !g.col.solidBlocked([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]) && !g.col.segmentBlockedDynamic([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]);   // and nothing between you: no takedown through a partition or a shut leaf (the lunge would carry you through it)
        const headroom = !could || !pl.crouch || canStand(g);
        const can = could && headroom;
        const it: Interactable = { kind: 'guard', pos: v3.add(gp, [0, 1.35, 0]), line1: gd.state === 'alert' ? 'guard · alert' : behind ? 'guard' : 'guard · facing you', line2: gd.state === 'alert' ? 'not while he is onto you' : !behind ? 'get behind him' : pl.sprinting ? 'stop sprinting' : !could ? 'get closer' : 'no room to stand up behind him here', inReach: can, off: false, guard: gd };
        const verbs: Interactable[] = [];
        if (can && !busy) verbs.push(pl.holstered ? row(it, 'grab', 'grab him', 'LMB  takedown — silent') : grabVariant(g) === 'gun' ? row(it, 'grab', 'grab him — pistol to his head', 'E  holster for the LMB takedown') : pl.rifleUp ? row(it, 'grab', 'grab him — the rifle goes on your back', 'E  sling it for the LMB takedown') : row(it, 'grab', 'grab him', 'E  holster for the LMB takedown'));
        offer(it, verbs);
      }
    }
    for (const gd of civilianBodies(g)) {   // the CIVILIANS (civilians.ts): the same arm from close behind her — from any side once she is crouched in a corner — and the same click with the hands empty puts her down quiet (a civilian: it costs). Never one running (you would have to catch her first) or already talking to a guard two metres off.
      if (pl.takedown) continue; const cv = gd.civ!;
      const gp = gd.char.pos; const dx = p[0] - gp[0], dz = p[2] - gp[2]; const dd = Math.hypot(dx, dz);
      if (dd >= 2.4) continue;
      const behind = cv.state === 'cower' || Math.cos(wrapAngle(Math.atan2(dx, dz) - gd.char.bodyYaw)) < -0.25;
      const catchable = cv.state !== 'flee' && cv.state !== 'evacuate' && cv.state !== 'report';
      const could = dd < 1.05 && behind && catchable && !pl.sprinting && !g.col.solidBlocked([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]) && !g.col.segmentBlockedDynamic([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]);
      const can = could && (!pl.crouch || canStand(g));
      const it: Interactable = { kind: 'guard', pos: v3.add(gp, [0, 1.35, 0]), line1: `${cv.name} · the ${cv.label}${cv.state === 'cower' ? ' · cowering' : cv.state === 'work' ? '' : ` · ${cv.state}`}`, line2: !catchable ? `not while ${cv.she} is ${cv.state === 'report' ? 'with a guard' : 'running'}` : !behind ? `get behind ${cv.her}` : pl.sprinting ? 'stop sprinting' : !could ? 'get closer' : `no room to stand up behind ${cv.her} here`, inReach: can, off: false, guard: gd };
      const verbs: Interactable[] = [];
      if (can && !busy) verbs.push(pl.holstered ? row(it, 'grab', `grab ${cv.her} — a hand over the mouth`, `LMB  takedown — quiet, and −10`) : grabVariant(g) === 'gun' ? row(it, 'grab', `grab ${cv.her} — pistol to ${cv.her} head`, 'E  holster for the LMB takedown') : row(it, 'grab', `grab ${cv.her}`, 'E  holster for the LMB takedown'));
      offer(it, verbs);
    }
    // (a dead man's sidearm / torch lies where it fell — items, combat.ts dropFromHand — and is nobody's to pick up: his 9 mm magazines do not fit the Five-seveN, so
    // there is no row for it and Space beside it does nothing)
    for (const gd of [...g.guards, ...civiliansShown(g)]) {   // (a civilian on the floor is a body like any: hauled by the ankles, found by the men)
      if (gd.state !== 'dead') continue;
      const hips = gd.char.bones.hips ?? gd.char.pos; const mid: Vec3 = [hips[0], hips[1] + 0.12, hips[2]];   // on the pelvis, wherever the ragdoll left it (over a desk, half through a doorway)
      const dragging = pl.dragging === gd; const reach = dragging || bodyDist(g, gd) < 1.3;
      const nm = gd.civ ? `${gd.callsign} (the ${gd.civ.label})` : gd.callsign;
      const it: Interactable = { kind: 'body', pos: mid, line1: isBreathing(gd) ? `body · ${nm}, out cold — breathing` : `body · ${nm}, dead`, line2: reach ? '' : 'step closer', inReach: reach, off: false, guard: gd };   // what the panel says over him: a man you struck / choked / ringed is asleep, a man you shot is dead (the floor treats both as a body)
      const verbs: Interactable[] = [];
      if (reach && !busy) { if (dragging) verbs.push(row(it, 'drop', 'let go of him', 'sprinting drops him')); else if (!pl.dragging) verbs.push(row(it, 'drag', 'drag him off')); }
      offer(it, verbs);
    }
    // the mission's rack while the drive is still in it: reach = close enough to lay hands on its face, hands free (updateMission runs the pull off Game.act)
    const m = g.mission, M = g.level.mission;
    if (m.stage === 'drive' && (!g.quietUtility || g.missionInTour)) {
      const reach = rackDist(g, p) < DRIVE_REACH && !pl.dragging && !pl.sprinting && !pl.takedown;
      const it: Interactable = { kind: 'objective', pos: M.rack.front, line1: `rack ${M.rack.index + 1} · the drive`, line2: reach ? '' : pl.dragging ? 'hands full' : 'step closer', inReach: reach, off: false, progress: m.driveT >= 0 ? Math.min(1, m.driveT / DRIVE_SECS) : undefined };
      const verbs: Interactable[] = [];
      if (m.driveT >= 0) it.line2 = `pulling… ${Math.min(99, Math.round(m.driveT / DRIVE_SECS * 100))}%  ·  stay on it`;
      else if (reach && !busy) verbs.push(row(it, 'drive', 'pull the drive — stay on it'));
      offer(it, verbs);
    }
    { // the mains breaker panel, by hand (the pistol's OCP trips it from range; this is standing at it): reach = within arm's length of its face, hands free
      const bp = g.level.breaker.pos, bo = g.blackout;
      // in SIGHT of its face (the OCP's own test, lighting.ts ocp): the panel hangs on the storage room's wall and the corridor runs along the other side of it —
      // planar distance alone had the mains thrown through 12 cm of wall from a corridor hug, the locked room never entered (review finding); and nothing while down
      const face: Vec3 = [bp[0], bp[1], bp[2] - 0.18];
      if (!(bo.active && bo.permanent) && v3.distXZ(bp, p) < NEARBY_M && !g.col.solidBlocked([p[0], pl.crouch ? 0.9 : 1.3, p[2]], face)) {
        const reach = v3.distXZ(bp, p) < 1.15 && !pl.dragging && !pl.sprinting && !pl.takedown && !pl.holding;
        const it: Interactable = { kind: 'breaker', pos: [bp[0], bp[1] + 0.35, bp[2]], line1: bo.active ? 'breaker · thrown' : 'breaker · mains', line2: reach ? '' : 'step closer', inReach: reach, off: bo.active };
        const verbs: Interactable[] = [];
        if (reach && !busy) verbs.push(bo.active ? row(it, 'breakerOn', 're-arm the mains') : row(it, 'breakerOff', 'throw it — kill the lights'));
        offer(it, verbs);
      }
    }
    // ---- the rows: the running verb alone (or a status while the feet are committed), else the top MAX_NEAR verbs of the things in reach by what matters
    const marker = (d: Door) => list.find(x => x.door === d) ?? { kind: 'door' as const, pos: d.pos, line1: 'door', line2: '', inReach: true, off: false, door: d };
    if (pl.picking) { const d = pl.picking; rows = [running(marker(d), 'pick', `picking… ${Math.min(99, Math.round(d.pick * 100))}%  ·  Space or a step breaks off (the lock keeps it a moment)`, d.pick)]; }
    else if (pl.coding) { const d = pl.coding; rows = [running(marker(d), 'code', `keying the ${g.devices.padOf(d) ? padDoorName(g.devices.padOf(d)!) : 'door'} code… — Space or a step breaks off`, pl.codeT / CODE_SECS)]; }
    else if (pl.kick) rows = [status(marker(pl.kick.door), 'kicking it in…')];
    else if (pl.easing) { const d = pl.easing; rows = [running(marker(d), 'ease', 'easing it open… — Space or a step stops it where it is', Math.abs(d.angle) / EASE_MAX)]; }
    else if (m.driveT >= 0) { const it = list.find(x => x.kind === 'objective'); if (it) rows = [running(it, 'drive', `pulling… ${Math.min(99, Math.round(m.driveT / DRIVE_SECS * 100))}% — stay on it (Space or a step lets go)`, m.driveT / DRIVE_SECS)]; }
    else if (!pl.takedown) { things.sort((a, b) => interactOrder(p)(a.it, b.it)); rows = things.flatMap(t => t.verbs).slice(0, MAX_NEAR); }
  }
  if (pl.sel.open && rows.some(r => r.verb && !r.running)) rows.push(cancelRow(g));   // the selector is open (Space held past a tap) over something to choose: its way out sits at the foot (interact.ts shuts it if nothing is left to choose)
  g.interactables = list;
  // The highlight (Player.nearSel) rides the list by identity: when the rows change (a man walks into reach, a verb ran and the thing now offers others) it stays
  // on the same row if that row is still there, else goes back to the top; ↑ / ↓ and the wheel-while-Space move it (interact.ts), the order never changes under it.
  // A running verb's row is NOT carried over into the list that comes back when it ends (done or stopped): the highlight returns to the top — the everyday verb —
  // rather than sitting on the choke / the ease that was just deliberately chosen and is over (a plain tap after easing off a choke asks him; it does not choke again).
  const key = rows.map(rowKey).join('|');
  if (key !== pl.nearKey) { pl.nearKey = key; const hv = g.hover; const keep = hv && !hv.running ? rows.findIndex(r => rowKey(r) === rowKey(hv)) : -1; pl.nearSel = keep >= 0 ? keep : 0; }
  g.nearby = rows; pickHover(g);
}
/** identity of a row: the thing and the verb (its wording may change under the highlight — the question row does with the talk — without being another row) */
export function rowKey(r: Interactable): string { return `${r.kind}:${r.door?.def.name ?? r.guard?.callsign ?? ''}:${r.verb ?? '~' + r.line2}`; }
/** Game.hover ← the highlighted row (nearSel wrapped onto the list), Game.useDoor ← its door if it is a door row in reach. interact.ts calls it again after moving the highlight. */
export function pickHover(g: Game) {
  const pl = g.player, rows = g.nearby;
  pl.nearSel = rows.length ? ((pl.nearSel % rows.length) + rows.length) % rows.length : 0;
  const best = rows[pl.nearSel] ?? null;
  g.hover = best; g.useDoor = best?.kind === 'door' && best.inReach && best.door ? best.door : null;
}
/** the selector's bottom row while it is open: letting go of Space on it does nothing (interact.ts) */
export function cancelRow(g: Game): Interactable { const p = g.player.char.pos; return { kind: 'cancel', pos: [p[0], 1.3, p[2]], line1: 'cancel', line2: 'let go here — nothing happens', inReach: true, off: false, verb: 'cancel', running: false }; }
/** The one ordering for 'what is offered near Sam' — the top-left panel (overlay.ts) and the default Space target read the same list in the same order:
 *  in reach before out of reach, then by what MATTERS (a man you could grab is perishable and decisive; a door will still be there), then nearest.
 *  Lower = higher up the list. Within one thing its verbs keep the order buildInteractables gave them; MAX_NEAR rows in all, so a man to grab beside a shut
 *  door reads [grab · push · ease] and the door's third verb (if it had one) would be the row that falls off. */
export const INTERACT_PRIORITY: Record<Interactable['kind'], number> = { guard: 0, held: 0, body: 1, objective: 2, door: 3, light: 9, breaker: 2.5, cancel: 10 };
export function interactOrder(p: Vec3): (a: Interactable, b: Interactable) => number {
  const dd = (it: Interactable) => { let d = v3.distXZ(it.pos, p); if (it.door) d = Math.min(d, v3.distXZ(it.door.frameCentre, p)); return d; };
  return (a, b) => (a.inReach !== b.inReach ? (a.inReach ? -1 : 1) : (INTERACT_PRIORITY[a.kind] - INTERACT_PRIORITY[b.kind]) || dd(a) - dd(b));
}
/** how far off an interaction's marker is still built (its dot, the held pair's door hints) before it is in reach */
export const NEARBY_M = 3.0;
/** the most verb rows the interaction list ever holds (the highest-priority available ones; the cancel row while the selector is open is extra) */
export const MAX_NEAR = 3;
/** Easing a leaf by hand (the 'ease' row — game.ts updateDoors runs it through Doors.crack): the rate it comes round at (rad/s — the crack rate it always had),
 *  how far it goes on its own before it counts as open (where a push would have left it: 3.2 rad/s coasting against the hinge friction ≈ 1.45), and how wide a
 *  leaf may already stand and still offer the row (shut, or a hand ajar). */
export const EASE_RATE = 0.55, EASE_MAX = 1.45, EASE_OFFER = 0.62;

export function throwCount(g: Game, kind: ThrowKind) { return kind === 'flash' ? g.player.flashbangs : g.player.canisters; }

/** F: let go of the body you are dragging (its ankles fall where they are), or take hold of the nearest one within reach. */
export function toggleDrag(g: Game, which?: Guard) {
  const pl = g.player;
  if (pl.dragging) { releaseBody(g); g.msg('body dropped'); return; }
  if (pl.down || pl.sprinting) return;
  let best: Guard | null = which && which.state === 'dead' ? which : null;
  if (!best) { let bd = 1.3; for (const gd of [...g.guards, ...civiliansShown(g)]) { if (gd.state !== 'dead') continue; const d = bodyDist(g, gd); if (d < bd) { bd = d; best = gd; } } }   // (a civilian on the floor is a body to haul like any)
  if (!best || !best.char.ragdoll) { g.msg('no body within reach'); return; }
  releaseWall(g);   // (you take hold of a body off the wall, crouched to it)
  pl.dragging = best; pl.crouch = true; pl.dragNoiseT = 0.3; pl.dragStuckT = 0; best.char.ragdoll.wake(); g.msg('dragging the body — F to let go, sprint drops it');
}

/** Let go of the body in tow: the ankle pins come off and its feet fall where they are (the soft thud of that; the HUD line is the caller's). */
function releaseBody(g: Game) {
  const pl = g.player; if (!pl.dragging) return;
  const b = pl.dragging.char; b.ragdoll?.clearPins(); pl.dragging = null;
  g.audio.play('bodyFall', b.bones.footL ?? b.pos, 0.3);
}

/** Break off whatever the hands and feet are in the middle of that belongs to the SPOT, and stand ready: the kick (its door stays as it is), the pick (its progress
 *  stays on the door), a takedown that has not landed (he was only frozen for the beat: he carries on), a body in tow (dropped where it lies), a wind-up (the
 *  canister goes back on the belt), a door held. What a teleport needs — updateKick / updatePicking would otherwise reel you back to their door at 12 m a frame
 *  through every wall between, the cross would land on a man now rooms away, the body's ankles would come with you. A reload travels with you. The animator's
 *  one-shots (the kicking leg, the cross) play out their last fraction of a second where you arrive; nothing reads them any more (startKick waits for the leg). */
export function cancelActions(g: Game) {
  const pl = g.player, c = pl.char;
  releaseWall(g);                                             // the wall he had his back to is not where he is going
  if (pl.dragging) releaseBody(g);
  if (pl.holding) freeHeld(g, 'cancel');                      // the man in his arm stays where he is — free, and knowing everything
  pl.takedown = null;                                         // (a takedown that has not landed: he was only frozen for the beat — he carries on)
  if (pl.kick || pl.picking || pl.easing || pl.coding || pl.sel.downT >= 0) pl.fHeld = true;   // a Space still down from what he was doing (or a press half made) is spent: it must come up before it arms again where he arrives (interact.ts clears this the first frame it is up)
  pl.kick = null; pl.picking = null; c.anim.lockpick = false; if (pl.coding) stopCoding(g);
  pl.easing = null; pl.sel.downT = -1; pl.sel.open = false; pl.sel.moved = false; c.anim.doorPush = null;   // (the door hand: game.ts drops the record itself once he is carried out of the leaf's reach)
  if (pl.pendingThrow) { if (pl.pendingThrow.kind === 'flash') pl.flashbangs++; else pl.canisters++; pl.pendingThrow = null; }   // not yet out of the hand: keep it
  pl.throwHeld = false; pl.throwPreview = null;
  pl.sprinting = false; pl.speedSm = 0; c.vel = [0, 0, 0];
}

/** Sandbox / tour / harness: stand the player at p (pushed out of whatever is there, snapped to the nearest walkable cell if that is inside something big or off the
 *  map, always inside the world), free of anything he was in the middle of (cancelActions). A body on the floor stays where it fell. */
export function teleportPlayer(g: Game, p: Vec3) {
  const pl = g.player; if (pl.down) return;
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[2])) return;   // a bad target from a debug hook must not poison the position (NaN reaches the audio listener and throws)
  cancelActions(g);
  let q: Vec3 = [p[0], 0, p[2]];
  const settle = () => { g.col.clampToWorld(q, BODY_R); g.col.collideCircle(q, BODY_R, 0.05, 2.2, 6); const t = v3.copy(q); return !g.col.collideCircle(t, BODY_R, 0.05, 2.2, 1) || v3.distXZ(t, q) < 0.005; };   // pushed out of whatever is there — and did that converge (false: a gap the body cannot fit, the pushes just trade him back and forth)
  if (!settle() || g.col.nav.isBlocked(q[0], q[2])) {   // inside something big, in a gap too narrow for him, off the walkable floor: stand him on the nearest walkable cell instead
    const c = g.col.nav.nearestFreePoint(q[0], q[2]); if (c) { q = c; settle(); }
  }
  g.col.clampToWorld(q, BODY_R);
  pl.char.pos = q; pl.safe = [q[0], 0, q[2]];      // (a teleport is the one move the collision sweep must not walk him through: it starts afresh from here)
  pl.char.update(0);                               // bones at the new spot now: the capsules, the light meter query and the cursor's markers this frame must not read the old room
  g.note('teleported');
}

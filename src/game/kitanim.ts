// KIT ANIMATIONS — Sam handles his kit with his hands (the maintainer, 10-10: "we should have better animations for equipping and unequipping kit. like rifle for
// sam goes on his back, pistol in holster, knife, etc. reloads can be more detailed too (and vary based on tactical reload vs. not)" · "the closer than ever
// animation could use some work. sam's hand looks pretty static. and it should be reaching for his knife. one thing chaos theory did well was having sam's
// state vary continuously with his distance to the enemy").
//
// This file is the GAME's half: it decides WHEN, off the game's own state, and hands the animator its inputs. The poses are character.ts (KIT: kitSwap /
// kitLayer, pistolReloadArm, the `keep` variant of reloadArm, closeK in creepLayer / readyLayer); the props are rigProps.ts (KitDraw).
//
//   EQUIP    kitTick() watches what is in Sam's right hand by the game's rules (kitInHand: the pistol, the rifle, a can, the knife of an arm hold, nothing) and
//            on a change starts a swap: the old thing is carried to where it lives (pistol → thigh holster, rifle → over the shoulder onto the sling across his
//            back, can → belt pouch, knife → the sheath on his chest), the hand goes on to the next thing and brings it up. While it runs the drawer shows what
//            the HAND has (kitShow), not what the slot says, and a gun coming up cannot fire until it is up (Player.equipT, the lock-out every fire site already
//            honours — it was 0.45 s for anything involving the rifle and nothing for the pistol; now it is the draw's own length).
//   RELOAD   kitReload() picks the magazine change off the gun's state — EMPTY (dry magazine, nothing chambered: the magazine falls, a fresh one, the slide /
//            handle run), DRY (dry magazine, a round still up: the same without the slide) or TACTICAL (rounds left in the magazine: it is taken out and PUT
//            AWAY, then the fresh one; slower) — and gives the weapon and the animator that change's own beat (KITANIM.beats, scaled to the weapon's row).
//   CLOSE    kitTick() also deals the animator how close the nearest man of the close-in mode is, 0‥1: the carriage deepens and the knife hand travels to the
//            hilt with it, continuously (KIT.close).
//
// WHILE A SWAP RUNS (anim.kitBusy): no reload starts (player.ts reloadInHand), a can not yet in the fist is not thrown by LMB, no checkpoint is written
// (savestate.ts playerBusy), and a gun's light, lit lens and IR laser wait until it is UP (kitGunUp). A gun leaving the hand abandons its magazine change.
// Needs the MOVES' reload layer for the magazine hands (anim.kitHandsOn): without it a reload is the weapon row's, as ever.
//
// SWITCH: KITANIM.on — ON in the page (`?nokitanim` = the build as it was), OFF in the harness's frozen stand (TPS_KITANIM=1 turns it on there): off, nothing in
// this file calls anything and every pose, prop, beat and lock-out is what it was. Sam only (the one Player); nothing under the tour.
// Per-player state lives on the Player (kitWas / kitCan); a fresh Player (a restart, a loaded checkpoint) starts with no swap pending — the kit simply is where
// the game says. No dice, no clocks of its own, nothing read from the renderer.
import type { Game } from './game';
import type { KitItem, ReloadBeat } from './character';
import type { Firearm, WeaponDef } from './weapons';
import type { KitDraw } from './rigProps';
import type { ThrowKind } from './game';
import type { Input } from './input';
import { CLOSE } from './close';   // (read inside functions only — the game's one import cycle)
import { activeScenario } from './scenarioRun';   // (the same)
import { slingRestWant } from './rigProps';   // (the same)
import { feedOf, reloadShow } from './gunreload';   // (the same)
import { samWork } from './handwork';   // (the same: while his hands are at work on a thing the work has them)
import { samBigCarry, bigWeighed } from './bigkit';   // (the same)
import { bigOff, type Character } from './character';   // (the same)

export type ReloadKind = 'empty' | 'dry' | 'tactical';
type BeatRow = { dur: number; out: number; in_: number; rack?: number; keep?: number };
export const KITANIM = {
  /** THE switch (see the head). The three parts can be turned off one by one under it. */
  on: false,
  equip: true, reload: true, close: true,
  /** held things are DRAWN in his hands (rigProps.ts GRIPFIT: the can in the fist, the guns' grips in the palm, the foregrip in the fingers, a magazine across
   *  the palm) and his fingers stand open round a can. Picture only — the muzzle, the bore and the gun light are where they were. Off = every box off the wrist as before. */
  grips: true,
  /** where the rifle lives when it is not in his hands (the maintainer, 10-10: "for "loud builds" … unequipping rifle should be putting it down in a sling, not
   *  over the back, right?"): 0 = by the mission — a squad's loud mission: let down on its sling in FRONT of him (quicker both ways: no trip over the shoulder);
   *  a quiet mission, the plain night: across his BACK, out of the way of his hands — the very test the sneaking suit is worn by (cast.ts sneakSuit, less the
   *  look's own switches) · 1 = always in front · 2 = always on his back. Part of `equip`: with that off (or the switch) it is the back, as the build had it. */
  sling: 0 as 0 | 1 | 2,
  /** the rifle hanging in front rests on a thigh that comes up under it (rigProps SLING_REST): how fast it is pushed up onto one / settles back down, 1/s (an
   *  ease toward what the pose wants — a stride moves that a quarter turn in a few frames, and a hung rifle has weight); 0 = no ease, the pose's own answer */
  slingUp: 18, slingDown: 4,
  /** NIGHT VISION goes down and up by hand or by a nod (the maintainer, 10-10: "if hands are busy it's a nod of the head for flicking on and off. otherwise hand
   *  does it"): N still switches the tube on the key's frame for everything the game reads; the goggles travel (character.ts KIT.nv) and the PICTURE changes as
   *  they cross his eyes. Off = they jump on the key and the picture with them, as the build had it. */
  nv: true,
  /** s before a draw's end at which the gun may already fire (it is up; the support hand is still settling) */
  early: 0.05,
  /** A CLICK MADE WHILE A GUN IS STILL COMING UP IS KEPT: the left button pressed inside the last `clickKeep` s of a kit change's lock-out fires the round on the
   *  frame the gun is up (kitClick — the wall stack's own rule for its rise). 0 = dropped, as the build had it: the click of a drawn pistol did nothing. */
  clickKeep: 0.35,
  /** …and A CLICK MADE WHILE A CAN IS STILL COMING TO THE FIST IS KEPT for the whole fetch ('5, click' in one breath throws as the can arrives — it used to throw
   *  nothing for up to two thirds of a second): the most such a click may wait, s. 0 = dropped, as it was. */
  throwKeep: 1.0,
  /** the most a lock-out may be once no errand is running (= player.ts RIFLE_EQUIP_SECS, the build's own rifle beat; the probes hold the two equal) */
  plainLock: 0.45,
  /** the magazine changes, in seconds on the weapon's clock — written for the pistol's 1.6 s row and the rifle's 2.4 s row and scaled to whatever row the gun in
   *  hand has. out = the old magazine leaves the gun · keep = it is in the dump pouch (tactical only) · in_ = the fresh one is seated · rack = slide / handle */
  beats: {
    pistol: { ref: 1.6, empty: { dur: 1.6, out: 0.25, in_: 0.95, rack: 1.3 } as BeatRow, dry: { dur: 1.45, out: 0.25, in_: 0.95 } as BeatRow, tactical: { dur: 2.0, out: 0.45, keep: 0.95, in_: 1.5 } as BeatRow },
    rifle: { ref: 2.4, empty: { dur: 2.4, out: 0.4, in_: 1.45, rack: 1.95 } as BeatRow, dry: { dur: 1.95, out: 0.4, in_: 1.45 } as BeatRow, tactical: { dur: 2.75, out: 0.55, keep: 1.2, in_: 2.1 } as BeatRow },
  },
  /** m to the close-in mode's man at which closeness is 1 (the knife's reach); it is 0 at the mode's own edge (close.ts CLOSE.modeM) */
  closeNear: 1.1,
};
export const KITANIM_DEFAULTS = JSON.parse(JSON.stringify(KITANIM)) as typeof KITANIM;
/** for the probes and the panel: what has been played */
export const KITANIM_STATS = { swaps: 0, draws: { pistol: 0, rifle: 0, can: 0, knife: 0 }, stows: { pistol: 0, rifle: 0, can: 0, knife: 0 }, reloads: { empty: 0, dry: 0, tactical: 0 }, closeFrames: 0, nv: { hand: 0, nod: 0 }, owed: 0 };
export const KITANIM_LOG: { t: number; what: 'swap' | 'reload'; from?: KitItem | null; to?: KitItem | null; kind?: ReloadKind; secs: number }[] = [];
function note(g: Game, row: Omit<(typeof KITANIM_LOG)[number], 't'>) { KITANIM_LOG.push({ t: g.time, ...row }); if (KITANIM_LOG.length > 200) KITANIM_LOG.shift(); }

function live(g: Game): boolean { return KITANIM.on && !g.touring; }

/** NIGHT VISION (KITANIM.nv): is Sam's LEFT hand free to go up to his goggles? Not with the rifle in his hands, the pistol at the aim (both hands on a gun that
 *  is pointed at something stay on it), a man or a body in his arms, a door / lock / keypad / wall under his hands, a throw, a reload, a kit change, the
 *  close-in reach, a sprint or once he is down — then it is a nod. Free: hands empty, the pistol at its relaxed carry (the support hand lets go for it), a can
 *  in the right fist. */
function nvHandFree(g: Game): boolean {
  const pl = g.player, an = pl.char.anim;
  if (pl.down || pl.holding || pl.takedown || pl.dragging || pl.picking || pl.wanding || pl.coding || pl.easing || pl.doorMove || pl.kick || pl.wall || pl.sprinting || samWork(g) || an.bigTool) return false;   // (bigTool — bigkit.ts: the big slot's tool in his hands or on its way back)
  if (pl.rifleUp || (pl.pistolUp && an.upper === 'aim')) return false;
  if (pl.pendingThrow || pl.throwHeld || an.inThrow || an.reloading || pl.pistol.reloading || pl.rifle.reloading || an.kitBusy || an.ready) return false;
  return true;
}
/** N was pressed and `Player.nv` has changed (player.ts, both of its N sites): the goggles are carried down / up by the left hand, or thrown by a nod when the
 *  hands are busy. Nothing the simulation reads waits for it. */
export function kitNv(g: Game) {
  if (!live(g) || !KITANIM.nv) return;
  const pl = g.player, hand = nvHandFree(g);
  pl.char.anim.nvFlip(pl.nv, hand); KITANIM_STATS.nv[hand ? 'hand' : 'nod']++;
}
/** the tube is at his EYES (what the picture follows — player.ts eases `nvAmount` toward this): from the frame the goggles start down until the frame they start
 *  up; else the switch. A flip still running when the part is no longer live (a show took the stage, the switch went off) is let go of here: the goggles are
 *  where the game says. */
export function kitNvEye(g: Game): boolean {
  const pl = g.player, an = pl.char.anim, k = an.nvShown;
  if (k === undefined) return pl.nv;
  if (!live(g) || !KITANIM.nv) { an.nvCancel(); return pl.nv; }
  return pl.nv ? k > 0 : k >= 1;   // (the picture eases in and out over a few frames of its own: started as the goggles start to move, it turns over about as they land / clear)
}

/** What the game's own rules put in Sam's right hand this frame (the drawer's rules, combat.ts handProps, said once): the pistol up, the rifle in the hands, a
 *  can of the selected kind, the knife of a man held with the hands empty — or nothing. */
/** a pose has his hands off his own gun: the animator's word, as it stood after its last update — and, the big slot's tool with BIGSLOT.weight on
 *  (bigkit.ts), the word it WILL give this frame, read off the beat's record as it stands now (character.ts bigOff): the kit's draw then starts the frame the
 *  tool lets go of his hands, not one later with the gun shown in them for a frame between */
function handsOff(an: Character['anim']): boolean { return an.bigTool && bigWeighed() ? bigOff(an.bigTool) : an.hideHeldItem; }
export function kitInHand(g: Game): KitItem | null {
  const pl = g.player, an = pl.char.anim;
  if (pl.down) return null;
  if (pl.holding) return pl.holding.variant === 'arm' && !an.holdGunSide ? 'knife' : pl.pistolUp ? 'pistol' : null;
  if (handsOff(an)) return null;
  if (samBigCarry(g)) return null;   // (bigkit.ts BIGSLOT.weight: the big slot's tool is asked for — his gun goes to its place by hand before the hand goes for the tool)
  if (pl.pistolUp) return 'pistol';
  if (pl.rifleUp) return 'rifle';
  const k = pl.canisterSel;
  return k && !pl.holstered && !pl.dragging && g.throwCount(k) > 0 ? 'can' : null;
}

/** KIT: the rifle hangs in FRONT of him on its sling when it is not in his hands (KITANIM.sling) — the hand's errands (anim.kitFront) and the drawer
 *  (RigOpts.slingFront / KitDraw.front) both ask here. A fact of the mission, not of the picture: the times of his kit changes hang on it. */
export function kitSlingFront(g: Game): boolean {
  if (!live(g) || !KITANIM.equip) return false;
  if (KITANIM.sling) return KITANIM.sling === 1;
  const k = activeScenario(g); return !!k && k !== 'quiet';
}

/** KIT: how far the rifle hanging in front is swung forward onto his thighs this frame, rad — eased toward what his pose wants (rigProps slingRestWant) on the
 *  game's clock, so asked twice in a frame it answers the same; the state is the Player's (a fresh Player starts on the pose's own answer). undefined = not in front. */
export function kitSlingRest(g: Game): number | undefined {
  if (!kitSlingFront(g)) return undefined;
  const pl = g.player, want = slingRestWant(pl.char), s = pl.slingRest, dt = s ? g.time - s.t : -1;
  if (!s || dt < 0 || dt > 0.25 || !(KITANIM.slingUp > 0)) { pl.slingRest = { a: want, t: g.time }; return want; }
  if (dt > 0) { const k = want > s.a ? KITANIM.slingUp : KITANIM.slingDown > 0 ? KITANIM.slingDown : KITANIM.slingUp; s.a += (want - s.a) * (1 - Math.exp(-k * dt)); s.t = g.time; }
  return s.a;
}

/** how close a man `d` metres off is, 0 (the close-in mode's edge) … 1 (in the knife's reach) */
export function kitCloseness(d: number): number { return Math.max(0, Math.min(1, (CLOSE.modeM - d) / Math.max(0.1, CLOSE.modeM - KITANIM.closeNear))); }

/** Once a frame from updatePlayer, after the rows and the close-in mode are settled and before the animator runs. */
export function kitTick(g: Game, late = false) {
  const pl = g.player, c = pl.char, an = c.anim, on = live(g);
  // ---- closer than ever, by distance
  if (late) { /* (the frame's second look, after everything that can change his hands this frame has run: the equip half alone) */ }
  else if (on && KITANIM.close) {
    if (an.creep && an.creepAt) {
      const d = Math.hypot(an.creepAt[0] - c.pos[0], an.creepAt[2] - c.pos[2]);
      an.closeK = kitCloseness(d);
      KITANIM_STATS.closeFrames++;
    } else if (an.closeK < 0) an.closeK = 0;   // (out of the mode: the last closeness stands while the carriage eases off)
  } else an.closeK = -1;
  // ---- equip / put away
  if (!on || !KITANIM.equip) { if (an.kitBusy) an.kitCancel(); pl.kitWas = undefined; return; }
  an.kitRest = kitSlingRest(g) ?? 0;   // (a rifle hanging in front: the hand's errands go to where it lies this frame — on his thighs in a crouch)
  if (!an.kitBusy && !an.bigTool && pl.equipT > KITANIM.plainLock) pl.equipT = KITANIM.plainLock;   // (an errand something else took the arms from — a hit, a throw: the gun is in his hands at once, and its lock-out is no longer the errand's)
  const cur = kitInHand(g), sel = pl.canisterSel;
  // something else has his arms, or the item is not his to carry about: no errand — the kit is where the game says, and what was in the hand is forgotten
  // (the WALL hold is not on the list: taking a wall with the pistol up, coming off one, E on the stack — the hand carries the gun there as anywhere, the wall's own arms taking over once it is away)
  const carry = samBigCarry(g);   // (bigkit.ts BIGSLOT.weight: the tool's beat begins with this hand's own errand — the gun to its place — and the beat does not take the arm from it)
  const hard = pl.down || !!pl.holding || !!pl.takedown || !!pl.dragging || (!!pl.kick && !carry) || !!pl.picking || !!pl.wanding || !!pl.coding || !!samWork(g) || an.inThrow, quiet = hard || (handsOff(an) && !carry);
  if (pl.kitWas === undefined || quiet) {
    if (quiet && an.kitBusy) an.kitCancel();
    // (a can thrown: the next one is FETCHED once the arm is back; a held man just let go of: the knife stays in the fist while the hold's pose lets go of
    //  the arm — hideHeldItem alone — and is then sheathed by hand; the LAST can thrown hands the slot to the pistol mid-swing: it is drawn afterwards, not found
    //  in the hand that threw)
    if (!(pl.kitWas === 'knife' && !hard)) pl.kitWas = an.inThrow && (cur === 'can' || pl.kitWas === null) ? null : cur;
    if (an.inThrow && pl.kitWas === null && (cur === 'pistol' || cur === 'rifle')) pl.equipT = Math.max(pl.equipT, 0.05);   // (…and until it IS drawn it fires nothing: the lock-out is held a frame at a time through the swing)
    if (cur === 'can' && sel) pl.kitCan = sel;
    return;
  }
  // which can the fist shows: the selected kind — taken up only while no can is in the fist; another kind picked with one in it is a swap of its own
  let same = false;
  if (cur === 'can' && sel) { if (an.kitHold === null || (!an.kitBusy && pl.kitWas !== 'can')) pl.kitCan = sel; else if (!an.kitBusy && pl.kitCan !== sel) same = true; }
  if (cur === pl.kitWas && !same) return;
  // a gun leaving the hand takes its magazine change with it (the rifle's is dropped by updatePlayer's own rule; the pistol's when a can takes its place)
  if (pl.kitWas === 'pistol' && pl.pistol.reloading) { pl.pistol.cancelReload(); an.cancelReload(); }
  an.kitFront = kitSlingFront(g);
  const secs = an.kitSwap(pl.kitWas, cur, { r: c.bones.handR, l: c.bones.handL, ...c.handFrameR(true) }, same);   // (true: the hand as the animator posed it — inhand.ts's look-only turn is not a place an errand starts from)
  if (secs > 0) {
    if (cur === 'pistol' || cur === 'rifle') pl.equipT = Math.max(0, secs - KITANIM.early);   // nothing leaves a gun that is not up yet — and no longer than that (asked back for mid-way, it is up sooner)
    KITANIM_STATS.swaps++; if (pl.kitWas) KITANIM_STATS.stows[pl.kitWas]++; if (cur) KITANIM_STATS.draws[cur]++;
    note(g, { what: 'swap', from: pl.kitWas, to: cur, secs });
  }
  pl.kitWas = cur;
}

/** KIT: the click that came a moment early (KITANIM.clickKeep). Called by updatePlayer right after kitTick, ahead of the fire sites: while a kit change still
 *  holds the gun in hand off its first round, a left click inside the last `clickKeep` s is remembered on the Player (the game time it came); the frame the lock-out is over it is put
 *  back in this tick's input, once, and the gun's own fire site takes it like any click. A can the hand is still fetching: a click any time in the fetch
 *  (`throwKeep`) is thrown the frame it is in the fist. Dropped if the errand is called off, the gun is no longer the thing
 *  in hand, he goes down, or the orders menu is up (a click there puts the menu away). Never saved: no checkpoint is written inside a kit change. */
export function kitClick(g: Game, input: Input) {
  const pl = g.player, an = pl.char.anim;
  const want: KitItem | null = pl.pistolUp ? 'pistol' : pl.rifleUp ? 'rifle' : pl.canisterSel && !pl.holstered ? 'can' : null;   // what the click is for: the gun coming up, or the can coming to the fist
  if (!live(g) || !KITANIM.equip || pl.down || !want || g.orders.menu || pl.holding || pl.dragging) { pl.kitOwed = -1; return; }   // (a man in his arm, a body in his hands: his hands went to something else)
  const what = want === 'can' ? pl.canisterSel : want;   // …and WHICH can: a click for the smoke never throws the frag he changed to while it was coming
  if (pl.kitOwed >= 0 && pl.kitOwedFor !== what) pl.kitOwed = -1;   // (kept for the thing he was fetching THEN: a click for the rifle never fires the pistol he changed to)
  const keep = want === 'can' ? KITANIM.throwKeep : KITANIM.clickKeep; if (!(keep > 0)) { pl.kitOwed = -1; return; }
  if (want === 'can' ? an.kitHold !== undefined && !(an.kitHold === 'can' && pl.kitCan === what) : pl.equipT > 0) {   // not in his hand yet (a can: nor while the fist still shows another kind)
    if (!an.kitBusy) pl.kitOwed = -1; else if (input.lmbHit() && (want === 'can' || pl.equipT <= keep)) { pl.kitOwed = g.time; pl.kitOwedFor = what; }
    return;
  }
  if (pl.kitOwed >= 0) { const age = g.time - pl.kitOwed; pl.kitOwed = -1; if (age >= 0 && age <= keep + 0.05 && !input.lmbHit()) { input.clicked |= 1; KITANIM_STATS.owed++; } }   // (older than the wait it was kept for: something else had his frames meanwhile — a kick, a hold — and the click is stale)
}

/** The longest a kit change can hold a gun's fire (the soak's bound on Player.equipT with the switch on). */
export function kitLockMax(KIT: { stow: Record<KitItem, number>; reach: Record<KitItem, number>; draw: Record<KitItem, number>; far: number; swapK: number; front?: { stow: number; reach: number; draw: number } }): number {
  let m = 0;
  for (const fr of KIT.front ? [false, true] : [false]) {   // (the rifle on its back sling, then on the front one: its own three times — character.ts KIT.front)
    const F = KIT.front, t = (T: Record<KitItem, number>, it: KitItem, f: number) => fr && it === 'rifle' ? f : T[it];
    for (const to of ['pistol', 'rifle'] as const) {
      const reach = t(KIT.reach, to, F?.reach ?? 0), draw = t(KIT.draw, to, F?.draw ?? 0); m = Math.max(m, reach + draw);
      for (const from of ['pistol', 'rifle', 'can', 'knife'] as const) m = Math.max(m, (t(KIT.stow, from, F?.stow ?? 0) + reach + (fr ? 0 : KIT.far) + draw) * KIT.swapK);
    }
  }
  return m;
}

/** What the drawer shows in his hands this frame: `v` is what the game's state says (combat.ts handProps computes it as ever); while a swap runs the HAND's
 *  word replaces it — the pistol is in the fist until the fist is at the holster, the rifle in the hands until it is over his shoulder, and so on — and `kit`
 *  carries the in-between for rigProps. Off / idle: `v` untouched, no `kit`. */
export function kitShow(g: Game, v: { pistolInHand: boolean; rifle: 'hand' | 'slung' | null; held: ThrowKind | null; knife: boolean }): KitDraw | undefined {
  if (!live(g)) return undefined;
  const pl = g.player, an = pl.char.anim, h = an.kitHold;
  if (pl.down) return undefined;   // (down: whatever he carried is where the game says — dropped, or still on him)
  let kit: KitDraw | undefined;
  if (h === undefined && KITANIM.equip && pl.kitWas === 'knife' && !pl.holding && !pl.takedown && !pl.kick && !pl.picking && !pl.wanding && !pl.coding) v.knife = true;
  if (h === undefined && KITANIM.equip && pl.kitWas === null && an.inThrow) v.pistolInHand = false;   // (the last can away: the pistol the slot fell back to is drawn once the arm is home)   // (a hold just ended: the knife has not left the fist yet — kitTick)
  if (h !== undefined && KITANIM.equip) {
    v.pistolInHand = h === 'pistol';
    if (v.rifle) v.rifle = h === 'rifle' ? 'hand' : 'slung';
    v.held = h === 'can' && !pl.sprinting ? pl.kitCan : null;
    if (h === 'knife') v.knife = true;
    kit = { roll: an.kitRoll, pistol: h === 'pistol' ? an.kitStow : 0, rifle: h === 'rifle' ? an.kitStow : 0, front: an.kitFront, rest: an.kitFront ? kitSlingRest(g) : undefined };   // (the sling the errand BEGAN on: the hand's — the row flipped mid-way does not send the rifle one way and the hand the other)
  }
  if (KITANIM.reload) {
    const rs = an.reloadShow, long = v.rifle === 'hand';
    if (rs && (v.pistolInHand || (long && !pl.rifle.def.pellets))) { kit ??= {}; kit.noMag = rs.out && long; kit.magL = rs.hand ? (long ? 'rifle' : 'pistol') : null;
      // (gunreload.ts: a gun with a model of its own carries its OWN thing in the hand — reloadHandBoxes — never the two kinds' box too; and its magazine / belt box is off the gun when ITS feeding says so)
      const def = long ? pl.rifle.def : pl.pistol.def; if (feedOf(def)) { kit.magL = null; kit.noMag = long && (reloadShow(pl.char, def.id)?.noMag ?? false); } }
  }
  return kit;
}
/** no errand has the hands: the gun the light rides is UP (player.ts poseGunLight, the drawer's lit lens: a light shines neither from an empty fist on its way
 *  to the holster nor from a gun still coming round off his back — it comes on as the gun arrives) */
export function kitGunUp(g: Game): boolean { return g.player.char.anim.kitHold === undefined; }

/** The magazine change for the gun in his hands, off its state: which kind, the weapon's beat for it (`row`: Firearm.startReload's) and the animator's
 *  (`beat`: CharacterAnimator.reload's). null = the switch is off / a shell-fed gun: the row's own reload, as ever. */
export function kitReload(g: Game, gun: Firearm, long: boolean): { kind: ReloadKind; row: WeaponDef['reload']; beat: ReloadBeat } | null {
  if (!live(g) || !KITANIM.reload || gun.def.pellets || !g.player.char.anim.kitHandsOn) return null;   // (the hands' magazine work is the MOVES' — without it the beats would be timing with nothing to see: the row's own reload)
  // by what the weapon will DO (weapons.ts Firearm.update): a magazine with rounds in it is kept, an empty one dropped; the slide / handle is run iff nothing is
  // chambered. (Rounds left and nothing chambered — a change a sprint cut short after the fresh magazine went in: the kept change, with the rack on its end.)
  const keeps = gun.mag !== null && gun.mag > 0, racks = gun.chamber === 0;
  const kind: ReloadKind = keeps ? 'tactical' : racks ? 'empty' : 'dry';
  const T = KITANIM.beats[long ? 'rifle' : 'pistol'], b = T[kind], k = gun.def.reload.dur / T.ref, E = T.empty;
  const rack = b.rack !== undefined ? b.rack * k : keeps && racks ? (b.in_ + (E.rack! - E.in_)) * k : undefined;
  // (the animator's own floors — character.ts rlBeat — so the weapon and the hands end together whatever row this was scaled to)
  const dur = Math.max(keeps && racks ? (b.in_ + (E.dur - E.in_)) * k : b.dur * k, rack !== undefined ? rack + 0.25 : b.in_ * k + 0.5);
  const row: WeaponDef['reload'] = { dur, out: b.out * k, in_: b.in_ * k, ...(rack !== undefined ? { rack } : null) };
  const beat: ReloadBeat = { dur, out: row.out, in_: row.in_, rack: rack ?? null, hand: !long, ...(b.keep !== undefined ? { keep: b.keep * k } : null) };
  return { kind, row, beat };
}
/** one line for the panel */
export function kitSummary(): string { const S = KITANIM_STATS, r = S.reloads; return KITANIM.on ? `on · ${S.swaps} swaps · reloads ${r.empty} empty / ${r.dry} dry / ${r.tactical} tactical` : 'off'; }
/** (a reload began on a kitReload plan: counted) */
export function kitReloadNote(g: Game, kind: ReloadKind, secs: number) { KITANIM_STATS.reloads[kind]++; note(g, { what: 'reload', kind, secs }); }

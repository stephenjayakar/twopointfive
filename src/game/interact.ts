// The Space selector — one key over the interaction list (player.ts buildInteractables: every verb its own row, the highest-priority MAX_NEAR of what is in
// reach): a TAP (up again inside TAP_SECS without having scrolled) performs the highlighted row; HELD past that the list OPENS — the panel shows it, a cancel
// row appears at its foot, his feet stop, the wheel and ↑ / ↓ move the highlight — and LETTING GO performs whatever is highlighted then (cancel: nothing);
// Esc while it is open backs out. ↑ / ↓ move the highlight at any time; the wheel is his walking pace whenever Space is not down (a hold included). The
// sustained verbs — ease a leaf open, pick a lock, the choke, the pistol-whip, the drive — start on their row like any other and then run on their own clock:
// a fresh Space press, Esc, or a movement key pressed INTO them (one already down when they began does not count until it has come up) stops them where they
// are, exactly as letting go of the held key used to. What is performed goes out as Game.act for this one frame; game.ts updateDoors, player.ts updateHold and
// mission.ts updateMission act on it where they used to read the key, so the frame's order of business is unchanged.
import type { Game, Interactable } from './game';
import { Input } from './input';
import { INTERACT_KEY } from './consts';
import { backHit } from './backkey';
import { wheelPace, pickHover, cancelRow, easeOffHold, holdKilling, stopPicking, stopWand } from './player';
import { cancelDrive } from './mission';
import { stopCoding } from './devices';
import { samStaggered } from './samstun';

/** a press up again inside this (without having scrolled the list) is a tap; held past it the list opens */
export const TAP_SECS = 0.25;
/** wheel travel (px of deltaY, accumulated while Space is down) that moves the highlight one row: a mouse notch (~100) is one row, a trackpad swipe a few — never
 *  a row per frame of a swipe's stream of small deltas (at most one row a frame, the remainder carried) */
const WHEEL_STEP = 60;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
function moveMask(input: Input): number { let m = 0; for (let i = 0; i < MOVE_KEYS.length; i++) if (input.down(MOVE_KEYS[i])) m |= 1 << i; return m; }

/** Which sustained verb is running right now, as an identity ('' = none): the leaf he is easing, the lock he is picking, the choke / the whip chosen (its
 *  commit beat) or under way, the drive coming out of the rack. While one runs its row is the only row and nothing else starts (buildInteractables). */
export function runningVerb(g: Game): string {
  const pl = g.player, H = pl.holding;
  if (pl.easing) return `ease:${pl.easing.def.name}`;
  if (pl.picking) return `pick:${pl.picking.def.name}`;
  if (pl.wanding) return `wand:${pl.wanding.door.def.name}`;   // the optical wand under a door (wand.ts)
  if (pl.coding) return `code:${pl.coding.def.name}`;   // a keypad's code going in (devices.ts updateCoding)
  if (H && (H.windT >= 0 || H.phase === 'choke' || H.phase === 'whip' || holdKilling(H))) return `hold:${H.g.callsign}`;   // (the knife in the hold — close.ts CLOSE.heldClicks — is the running verb too: no row is on offer under it)
  if (g.mission.driveT >= 0) return 'drive';
  if (pl.breakerMove) return 'breaker';   // his hand on the mains lever (handwork.ts) — a half second COMMITTED like a kick: nothing in cancelSustained stops it, and no other row is on offer under it
  if (pl.charging) return `charge:${pl.charging.door.def.name}`;   // a breaching charge going on a door by hand (doortools.ts samTick)
  if (g.wallCharge?.setting) return 'charge:wall';   // a breaching charge going on a wall by hand (wallcharge.ts)
  if (g.defuse?.working) return 'defuse';   // a hand on a defuse mission's charge (defuse.ts)
  return '';
}
/** Stop the running sustained verb where it is — what letting go of the held key used to do, now on a Space press, Esc, or a step: the leaf stays where it got
 *  to (its closer wakes a few seconds on, as after a crack let go), the pick comes off the tools with the progress kept on the door a moment, the man in the
 *  arm drags a breath / gets the pistol back at his head (rattled for it), the drive is let go of. True if there was anything to stop. */
export function cancelSustained(g: Game): boolean {
  const pl = g.player, H = pl.holding;
  if (pl.easing) { pl.easing = null; return true; }
  if (pl.picking) { stopPicking(g); return true; }
  if (pl.wanding) { stopWand(g); return true; }
  if (pl.coding) { stopCoding(g); return true; }
  if (H && holdKilling(H)) return false;   // the knife in the hold is COMMITTED, like the hand on the breaker's lever: no tap, step or Esc takes a blade back (player.ts killOut ends it)
  if (H && (H.windT >= 0 || H.phase === 'choke' || H.phase === 'whip')) { easeOffHold(g); return true; }
  if (g.mission.driveT >= 0) { cancelDrive(g); return true; }
  if (g.doorTools?.cancelSam()) return true;
  if (g.wallCharge?.cancel()) return true;
  if (g.defuse?.cancel()) return true;
  return false;
}
/** Esc, ahead of the pause menu (main.ts asks this first; the headless harness's Escape lands in updateInteract): the open selector backs out — that press is
 *  spent — else a running sustained verb stops. True = it was used here (no menu). */
export function escapeInteract(g: Game): boolean {
  const pl = g.player, S = pl.sel;
  if (S.open || S.downT >= 0) { closeSelector(g, true); return true; }
  return cancelSustained(g);
}
/** is there anything here the back key would back out of — the open list or a press in hand, a running sustained verb (asked, nothing touched) */
export function backableInteract(g: Game): boolean { const S = g.player.sel; return S.open || S.downT >= 0 || !!runningVerb(g); }
/** anything to CHOOSE in this list: a row with a verb that is not the running one (a status line — getting hold of him, kicking it in — is nothing to open a list over) */
export function choosable(rows: Interactable[]): boolean { return rows.some(r => r.kind !== 'cancel' && !!r.verb && !r.running); }
function openSelector(g: Game) {
  const pl = g.player, S = pl.sel; if (S.open) return;
  S.open = true;
  if (g.nearby.length && g.nearby[g.nearby.length - 1].kind !== 'cancel') g.nearby.push(cancelRow(g));   // (buildInteractables adds it itself from the next frame; this frame's list gets it now so a scroll can already land on it)
  pickHover(g);
}
/** the list shut (the cancel row goes, a highlight left on it returns to the top) — the press itself untouched: shutList alone when the rows empty under an open list, closeSelector when the press is over */
function shutList(g: Game) {
  const pl = g.player; pl.sel.open = false;
  if (g.nearby.some(r => r.kind === 'cancel')) { const hv = g.hover; g.nearby = g.nearby.filter(r => r.kind !== 'cancel'); if (hv?.kind === 'cancel') pl.nearSel = 0; pickHover(g); }
}
/** shut the list AND end the press (`spent`: it must also come up before Space arms again — Esc, a teleport) */
function closeSelector(g: Game, spent: boolean) {
  const pl = g.player, S = pl.sel;
  shutList(g); S.downT = -1; S.moved = false; if (spent) pl.fHeld = true;
}

/** Once a frame, straight after the rows are built (game.ts update → updateAim → buildInteractables, then this): the wheel (the highlight while Space is down,
 *  else his pace), ↑ / ↓, Esc, and the Space press itself — armed on its edge unless spent, timed while down, the list opened past TAP_SECS or on a scroll,
 *  and on its release (or a press that began and ended inside the frame: the tour's and the harness's one-frame taps) the highlighted row goes out as
 *  Game.act. A running sustained verb short-circuits all of it: the press / Esc / a fresh step only stops it. */
export function updateInteract(g: Game, dt: number, input: Input) {
  const pl = g.player, S = pl.sel;
  g.act = null;
  const down = input.down(INTERACT_KEY), hit = input.hit(INTERACT_KEY), esc = backHit(input);
  if (pl.fHeld && !down && !hit) pl.fHeld = false;   // a spent press has come up: Space is live again
  if (input.hit('Paused') && (S.open || S.downT >= 0)) closeSelector(g, true);   // the pause card was up over a held list (backkey.ts 'Paused'): shut, the press spent — Space let go under the card does no row
  // ---- a sustained verb is running: Space (a fresh press), Esc, or a step INTO it stops it; nothing else is on offer meanwhile
  const run = runningVerb(g);
  if (run) {
    const mask = moveMask(input);
    if (run !== S.runKey) { S.runKey = run; S.moveLatch = mask; } else S.moveLatch &= mask;   // begun since last frame: the movement keys held into it do not count until they have come up once
    if (S.open || S.downT >= 0) closeSelector(g, down);
    if (hit && !pl.fHeld) { pl.fHeld = true; cancelSustained(g); }        // (spent: the same press must not arm again on the rows that come back)
    else if (esc) cancelSustained(g);
    else if ((mask & ~S.moveLatch) && !g.puppet) cancelSustained(g);      // a step of his own (the tour's puppet walks by goal, never by key)
    if (input.wheel && !down) wheelPace(g, input.wheel);
    return;
  }
  S.runKey = ''; S.moveLatch = 0;
  if (pl.down) { closeSelector(g, false); if (input.wheel && !down) wheelPace(g, input.wheel); return; }
  // ---- the press edge: armed unless this press is already spent
  if (hit && !pl.fHeld) { S.downT = 0; S.open = false; S.moved = false; }
  const armed = S.downT >= 0;
  const live = choosable(g.nearby);   // anything to choose at all (an open list whose rows have gone — the man walked out of reach — shuts, and opens again if they come back under the same held key)
  if (S.open && !live) shutList(g);
  // ---- the highlight: ↑ / ↓ any time (the tour's arrows step its stops instead), the wheel while an armed press is down; else the wheel is his pace
  let dSel = 0;
  if (!g.puppet) { if (input.hit('ArrowDown')) dSel++; if (input.hit('ArrowUp')) dSel--; }
  if (input.wheel) { if (armed && live) { S.wheelAcc = Math.max(-2 * WHEEL_STEP, Math.min(2 * WHEEL_STEP, S.wheelAcc + input.wheel)); if (Math.abs(S.wheelAcc) >= WHEEL_STEP) { const sg = Math.sign(S.wheelAcc); dSel += sg; S.wheelAcc -= sg * WHEEL_STEP; S.moved = true; } } else if (!down) wheelPace(g, input.wheel); }   // (Space down but spent: the wheel does nothing rather than change his pace under a finger that is choosing)
  if (!armed) S.wheelAcc = 0;
  if (armed && live && !S.open && (S.moved || (down && S.downT >= TAP_SECS - 1e-6))) openSelector(g);
  if (dSel && g.nearby.length > 1) { pl.nearSel += dSel; pickHover(g); }
  // ---- Esc: back out of an open list (or a press not yet a hold): the press is spent, nothing happens on its release
  if (esc && armed) { closeSelector(g, true); return; }
  if (!armed) { if (S.open) closeSelector(g, false); return; }
  if (down) { S.downT += Math.min(dt, 0.05); if (live && !S.open && S.downT >= TAP_SECS - 1e-6) openSelector(g); return; }   // (a frame hitch must not turn a tap into a hold)
  // ---- released this frame (or begun and ended inside it): the highlighted row is what Space does
  const rowNow = g.hover;
  closeSelector(g, false);
  if (rowNow && rowNow.kind !== 'cancel' && rowNow.inReach && rowNow.verb && !rowNow.running && !samStaggered(g)) g.act = rowNow;   // (samstun.ts: folded by a blast, his hands do nothing)
}

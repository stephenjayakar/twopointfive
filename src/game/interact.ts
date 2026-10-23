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
import { Doors } from './doors';
import { wheelPace, pickHover, cancelRow, easeOffHold, holdKilling, stopPicking, stopWand, thingDist, PRESS_THINGS } from './player';
import { cancelDrive } from './mission';
import { stopCoding } from './devices';
import { ownBlowHeld } from './ownblow';
import { samStaggered } from './samstun';
import { CMDRING, ringOpen, ringPin, ringWant, type RingState, type RingView } from './cmdring';
import type { FollowCamera } from './camera';
import { loneKey } from './ringlone';
import { HANDRING, EMPTY_WORD, EMPTY_AGAIN_SECS, EMPTY_NEAR_M, EMPTY_SHY_M, EMPTY_WHY } from './handring';
import type { Vec3 } from '../math/vec';
import { tryWhistle, whistleReadyIn } from './whistle';
import { CLOSE } from './close';
import type { View } from '../host/hud';

/** every row a door can have (player.ts buildInteractables, the tools' rows with it), and those of them an OPEN leaf can: a mission's frame that
 *  offers none of them has no row for that door at any distance. (One that offers some may still have none for this door — a steel one, a lock it
 *  names no pick for: that is known only in reach, where the door's own rows are built) */
const OPEN_ROWS = ['pull', 'ease', 'charge', 'breach', 'hammer', 'wand'], SHUT_ROWS = [...OPEN_ROWS, 'push', 'pick', 'kick', 'rattle', 'unlock', 'code', 'nocode'];
/** THE THING AN EMPTY TAP IS BESIDE (handring.ts `near`), and why the key did nothing on it — only what the game knows exactly:
 *    - a thing worked by hand (player.ts PRESS_THINGS) in reach whose every row the mission's frame kept back (the marker's `framed`);
 *    - a door in his hand's reach with no row while his hands are not his (a leaf already in his hand);
 *    - a door his sprint alone keeps from him;
 *    - a door a step out of reach, within EMPTY_NEAR_M and in sight (the door markers are the whole level's: never one with a wall between).
 *  In that order, the nearest of each. A door of the last two that the frame has no row at all for (SHUT_ROWS / OPEN_ROWS) says that at once, not
 *  'step closer'; a door locked against him answers nothing while he sprints at it (its own line there is the boot's). Nothing where a living man
 *  in sight is nearer (that tap was for him, and his own line says why not); no door out of reach where another thing out of reach is nearer (a
 *  body, a switch: their reach is not a plain distance, and the tap may have been for them); nothing during a takedown. Null: open floor, or the
 *  rule off */
export function emptyThing(g: Game): { it: Interactable; d: number; why: string } | null {
  const pl = g.player; if (!HANDRING.near || pl.takedown) return null;
  const p = pl.char.pos, eye: Vec3 = [p[0], pl.crouch ? 0.9 : 1.3, p[2]];
  // (a level line from his eye to a hand's breadth short of the thing: a shut leaf is no wall of its own)
  const walled = (to: Vec3) => { const dx = to[0] - eye[0], dz = to[2] - eye[2], k = Math.max(0, 1 - EMPTY_SHY_M / Math.max(1e-6, Math.hypot(dx, dz))); return g.col.solidBlocked(eye, [eye[0] + dx * k, eye[1], eye[2] + dz * k]); };
  let best: { it: Interactable; d: number; why: string } | null = null, rank = 3, man = Infinity, other = Infinity;
  for (const it of g.interactables) {
    const d = thingDist(it, p); if (d > EMPTY_NEAR_M) continue;
    if (it.kind === 'guard') { if (d < man && !walled(it.pos)) man = d; continue; }
    if (!PRESS_THINGS.has(it.kind)) continue;
    const D = it.door, r = D ? (d >= Doors.USE_REACH ? 2 : pl.sprinting ? 1 : 0) : it.inReach ? 0 : 3;   // (a door's reach is its distance and his feet: its `inReach` is also the big tool's, from where a stack stands)
    if (r === 3) { other = Math.min(other, d); continue; }
    const why = r === 0 ? (it.framed ? EMPTY_WHY.held : D ? EMPTY_WHY.no : '') : !(D!.isClosed() ? SHUT_ROWS : OPEN_ROWS).some(v => g.rails.offers(v)) ? EMPTY_WHY.held : r === 1 ? EMPTY_WHY.run : EMPTY_WHY.far;
    if (!why) { other = Math.min(other, d); continue; }   // (in reach with no row and no frame to blame — a wounded man)
    if (r > rank || (r === rank && best && d >= best.d)) continue;
    if (r === 2 ? walled(it.pos) && walled(D!.frameCentre) : r === 1 && g.doors.lockedOut(D!, p, pl.keys)) continue;
    best = { it, d, why }; rank = r;
  }
  return best && best.d <= man && (rank === 0 || best.d <= other) ? best : null;
}
/** what a tap that found no row says: 'nothing in reach', or beside a thing its name (the head of its marker's first line) and why */
export function emptyWord(g: Game, T = emptyThing(g)): string { return T ? `${T.it.line1.split(' · ')[0] || T.it.kind} · ${T.why}` : EMPTY_WORD; }

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
/** a row the ring has a wedge for: one with something to do */
const wedged = (r: Interactable) => !!r.verb && !r.running && r.kind !== 'cancel';
/** a row's words as the panel has them, less its key — and less what follows a dash, which the ring keeps for under it */
const rowWords = (r: Interactable) => r.line2.replace(/^Space\s+/, '').split(/\s+·\s+/)[0].trim();
/** … and up to that dash: what its wedge says */
const wedgeWords = (r: Interactable) => rowWords(r).split(/\s+[—–-]\s+/)[0];
/** (HANDRING.onThing) how far up his body his ring stands where no row is about a thing (m) */
const RING_BODY_M = 1.0;
/** (HANDRING.bare) a row's `off` is the THING's (game.ts Interactable: its marker and its panel line are drawn dim by it), and it says two things: on most
 *  rows that the row cannot be given (no code for the keypad, a charge that would kill him), on these kinds how the thing STANDS (the lights are off, the
 *  mains are thrown) — and there the row is the very one that can be given. Their wedge is not drawn faint for it. */
const STATE_OFF: readonly string[] = ['switch', 'breaker'];
/** THE WHISTLE'S WEDGE (handring.ts): the ring's last one, wherever the rows leave it free — no row of the list (nothing that reads the rows or the
 *  highlight meets it), so never what a tap does */
const WHISTLE_WEDGE = 'whistle', WHISTLE_CAPTION = 'whistle — one guard will come to look';
const whistleWedge = (g: Game) => { if (!ringStays(g) || g.player.down || g.player.takedown || g.rails?.locks('whistle')) return false;   // (rails.ts: a tutorial mission that has not taught the whistle has no wedge for it)
  let n = 0; for (const r of g.nearby) if (r.kind !== 'cancel') n++; return n < CMDRING.wedges; };
/** Sam's own ring is on (the prototype beside the squad's ring, or handring.ts) / it is the ring that STAYS (handring.ts) */
const ringMode = (g: Game) => !g.puppet && (HANDRING.on || (CMDRING.on && CMDRING.hands));
const ringStays = (g: Game) => !g.puppet && HANDRING.on;
/** a wedge's digit pressed this frame */
const wedgeDigit = (input: Input) => { for (let d = 1; d <= CMDRING.wedges; d++) if (input.hit(`Digit${d}`)) return true; return false; };
/** a row done by the key, a digit or a click: what updateInteract hands on as Game.act */
function give(g: Game, r: Interactable | null) {
  if (!r || r.kind === 'cancel' || !r.inReach || !r.verb || r.running || samStaggered(g)) return;   // (samstun.ts: folded by a blast, his hands do nothing)
  g.act = r;
}
/** What Sam's own ring shows this frame (null: none — cmdring.ts CMDRING.hands): where it is, how much larger than its px (ringZoom), the lit wedge (0: the
 *  highlight is on a row with no wedge), and a wedge a row on a digit — its words up to a dash, greyed where the row cannot be done; a row with no verb (a
 *  status line) has none. Under it the thing's name and the highlighted row's words in full. ui/cmdring.ts draws it; the simulation never reads it (ringKeys is what it reads). */
export function handRingView(g: Game): RingView | null {
  const pl = g.player, S = pl.sel, R = S.ring; if (!R || !S.open) return null;
  const wedges: RingView['wedges'] = [];
  g.nearby.slice(0, CMDRING.wedges).forEach((r, i) => { if (wedged(r)) wedges.push({ key: i + 1, text: wedgeWords(r), off: (r.off && !(HANDRING.bare && STATE_OFF.includes(r.kind))) || !r.inReach, opens: false }); });
  if (whistleWedge(g)) wedges.push({ key: CMDRING.wedges, text: WHISTLE_WEDGE, off: whistleReadyIn(g) > 0, opens: false });
  const hv = g.hover, lit = R.whistle ? CMDRING.wedges : hv && wedged(hv) && pl.nearSel < CMDRING.wedges ? pl.nearSel + 1 : 0;
  return { x: R.ax, y: R.ay, zoom: R.z, lit, tone: 'hands', caption: HANDRING.bare ? '' : R.whistle ? WHISTLE_CAPTION : hv ? (wedged(hv) ? `${hv.line1} · ${rowWords(hv)}` : hv.line1) : '', wedges };
}
/** the digits his ring has a wedge on, a bit each (bit 1 the first): what handRingView draws, less every word of it — all the game reads of the ring's
 *  picture (cmdring.ts ringWant `lone` and `shapes`) */
function ringKeys(g: Game): number {
  let keys = 0; const n = Math.min(g.nearby.length, CMDRING.wedges);
  for (let i = 0; i < n; i++) if (wedged(g.nearby[i])) keys |= 1 << (i + 1);
  return whistleWedge(g) ? keys | 1 << CMDRING.wedges : keys;
}
/** Esc, ahead of the pause menu (main.ts asks this first; the headless harness's Escape lands in updateInteract): the open selector backs out — that press is
 *  spent — else a running sustained verb stops. True = it was used here (no menu). */
export function escapeInteract(g: Game): boolean {
  const pl = g.player, S = pl.sel;
  if (S.open || S.downT >= 0) { closeSelector(g, true); return true; }
  return cancelSustained(g);
}
/** his hands are on a choice or a verb: a list open or a press in hand — but not a ring that merely STANDS (handring.ts: he walks, saves, takes a wall,
 *  puts his gun away and gives the squad an order under it) — or a sustained verb running */
export function handsBusy(g: Game): boolean { const S = g.player.sel; return (S.open && !S.ring?.free) || S.downT >= 0 || !!runningVerb(g); }
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
  const pl = g.player, ring = !!pl.sel.ring; pl.sel.open = false; pl.sel.ring = null;
  if (ring && ringStays(g) && pl.nearSel) { pl.nearSel = 0; pickHover(g); }   // (handring.ts: a wedge lit and not done is not left as what a tap does: the top row is)
  if (g.nearby.some(r => r.kind === 'cancel')) { const hv = g.hover; g.nearby = g.nearby.filter(r => r.kind !== 'cancel'); if (hv?.kind === 'cancel') pl.nearSel = 0; pickHover(g); }
}
/** shut the list AND end the press (`spent`: it must also come up before Space arms again — Esc, a teleport) */
function closeSelector(g: Game, spent: boolean) {
  const pl = g.player, S = pl.sel;
  shutList(g); S.downT = -1; S.moved = false; if (spent) pl.fHeld = true;
}

/** (HANDRING.onThing) is his ring about no thing — no row of it has one — so that it stands on his own body */
const ringOnBody = (g: Game) => !g.nearby.some(wedged);
/** …the point it stands on: the thing its lit row is about, else his own body */
function ringSpot(g: Game): Vec3 { const h = g.hover && wedged(g.hover) ? g.hover : g.nearby.find(wedged), p = g.player.char.pos; return h ? [h.pos[0], h.pos[1], h.pos[2]] : [p[0], p[1] + RING_BODY_M, p[2]]; }
/** …put there (`at` given: as it opens, and again when its rows change under it — another thing's rows are on another thing), and kept there as the view
 *  moves, whole inside the view's edge; on his body it goes with him. True: the hand has not moved the cursor since the last look */
function ringOnThing(g: Game, R: RingState, input: Input, cam: FollowCamera, view: View, at?: Vec3): boolean {
  if (at) { R.at = at; R.ox = 0; R.oy = 0; R.mx = input.mouseX; R.my = input.mouseY; R.clear = false; }
  if (!R.at) return false;
  if (!at && ringOnBody(g)) { const p = g.player.char.pos; R.at[0] = p[0]; R.at[1] = p[1] + RING_BODY_M; R.at[2] = p[2]; }
  const [sx, sy, front] = cam.project(R.at, view.clientWidth, view.clientHeight); if (front) ringPin(R, sx, sy, view.clientWidth, view.clientHeight);
  if (at) R.armed = Math.hypot(input.mouseX - R.ax, input.mouseY - R.ay) < CMDRING.flickPx * R.z;   // (the cursor counts by direction only from the ring's middle: ringOpen's own rule, asked of where it now stands)
  const still = R.mx === input.mouseX && R.my === input.mouseY; R.mx = input.mouseX; R.my = input.mouseY; return still;
}
/** Once a frame, straight after the rows are built (game.ts update → updateAim → buildInteractables, then this): the wheel (the highlight while Space is down,
 *  else his pace), ↑ / ↓, Esc, and the Space press itself — armed on its edge unless spent, timed while down, the list opened past TAP_SECS or on a scroll,
 *  and on its release (or a press that began and ended inside the frame: the tour's and the harness's one-frame taps) the highlighted row goes out as
 *  Game.act. A running sustained verb short-circuits all of it: the press / Esc / a fresh step only stops it. */
export function updateInteract(g: Game, dt: number, input: Input, view?: View, cam?: FollowCamera) {
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
  const stays = ringStays(g), free = S.open && !!S.ring?.free;   // (handring.ts: a ring standing with no key held — the key again is its own, below)
  if (hit && !pl.fHeld && !free) { S.downT = 0; S.open = false; S.moved = false; S.ring = null; S.word = ''; }   // (…and a fresh press takes down what the last empty tap said)
  const armed = S.downT >= 0;
  const live = choosable(g.nearby) || (stays && whistleWedge(g));   // anything to choose at all (an open list whose rows have gone — the man walked out of reach — shuts, and opens again if they come back under the same held key)
  if (S.open && !live) shutList(g);
  // ---- THE LIST AS A RING (cmdring.ts CMDRING.hands): up at the cursor the moment the press is armed over something to choose — no wait, no cancel row, his
  //      feet his own — the highlighted row lit; a digit, or the cursor out of its middle (cmdring.ts ringWant), lights another row that has a wedge; a
  //      right click gives nothing, and so does a left click (Sam's trigger, as under the squad's ring — but never the knife of the arm hold). The wheel
  //      and ↑ / ↓ move the highlight as they did. The press's end below is the list's own: letting go does the lit row.
  //      WITH handring.ts IT STAYS: it comes up once the key has been down HANDRING.holdSecs (a tap is the tap it was, and never the whistle), the key
  //      let go with the cursor out on a wedge does that wedge, let go in the middle leaves the ring standing; then a digit does its wedge at once, a
  //      left click or the key again does the lit one (the click is not his trigger), a right click or the back key puts it away.
  if (ringMode(g)) {
    if (S.open && S.ring && (g.orders.menu || g.orders.cmdRing)) { closeSelector(g, down); return; }   // (one list at a time: the squad's is up)
    const early = stays && HANDRING.early && down && armed && !S.open && wedgeDigit(input);   // (handring.ts `early`: a digit inside the hold is the ring's, at once)
    if (armed && live && !S.open && !g.orders.cmdRing && (!stays || (down && (early || S.downT >= HANDRING.holdSecs - 1e-6)))) { S.open = true; S.ring = { ...ringOpen(input, view?.clientWidth ?? 0, view?.clientHeight ?? 0, stays ? g.time - CMDRING.tapSecs : g.time, pl.nearSel + 1), key: pl.nearKey }; pickHover(g);
      if (stays && HANDRING.onThing && cam && view) ringOnThing(g, S.ring, input, cam, view, ringSpot(g)); }   // (the ring that stays came up after a hold: the cursor counts at once, as under the squad's — orders.ts ringUp)
    const R = S.ring;
    if (R && S.open) {
      if (input.hit('Blur')) { closeSelector(g, true); return; }   // (the window lost the keys: nothing is done, as under the squad's ring)
      if (input.rmbHit()) { input.clicked &= ~4; closeSelector(g, true); return; }
      const lmb = input.lmbHit();
      if (lmb && !stays) { if (CLOSE.heldClicks && pl.holding?.variant === 'arm') input.clicked &= ~1; closeSelector(g, true); return; }   // (close.ts: with a man in the arm the click is the knife — the click that puts the ring away is not that click as well)
      let digit = 0; for (let d = 1; d <= 9; d++) if (input.pressed.delete(`Digit${d}`) && !digit) digit = d;   // (not his weapon slots while it is up)
      if (R.key !== pl.nearKey) { R.key = pl.nearKey; R.armed = false; R.clear = false; R.whistle = false;   // (the rows changed under it: the cursor lights nothing until it has been back to the middle — and the top row, not the whistle, is lit over rows that have just come)
        if (R.at && cam && view) ringOnThing(g, R, input, cam, view, ringSpot(g)); }   // (HANDRING.onThing: …and it stands on what the rows are now about)
      if (!stays && (input.hit('ArrowDown') || input.hit('ArrowUp') || input.wheel)) R.armed = false;   // (… nor after the highlight was stepped by hand)
      const still = !!R.at && !!cam && !!view && ringOnThing(g, R, input, cam, view);   // (HANDRING.onThing: it stays on its point, and a cursor the hand has not moved lights no other wedge)
      const keys = ringKeys(g), want0 = ringWant(R, input, digit, g.time, loneKey(keys), R.at ? keys : 0), want = still && !digit && want0 !== R.lit ? 0 : want0, wh = stays && whistleWedge(g), toWh = wh && want === CMDRING.wedges, row = want && !toWh ? g.nearby[want - 1] : null, at = row && wedged(row) ? want - 1 : -1;
      if (at >= 0) { R.whistle = false; if (at !== pl.nearSel) { pl.nearSel = at; pickHover(g); } }
      if (stays) {
        if (toWh || (wh && !choosable(g.nearby))) R.whistle = true; else if (!wh) R.whistle = false;   // (the whistle's wedge lit: asked for, or the only one there is)
        R.lit = R.whistle ? CMDRING.wedges : pl.nearSel + 1;
        const lit = !R.whistle && g.hover && wedged(g.hover) ? g.hover : null, pointed = !digit && (at >= 0 || toWh);
        if (lmb) { input.clicked &= ~1; input.buttons &= ~1; if (input === g.seat.input) g.seat.swallow(1); }   // (the click is the ring's: he does not fire — the held button stays taken until he lets go, as under the squad's ring)
        const ask = lmb || (digit > 0 && (toWh || at >= 0)) || (R.free ? hit : !down && pointed), can = R.whistle ? whistleReadyIn(g) <= 0 : !!lit?.inReach;
        if (ask && can) { const whistle = !!R.whistle; closeSelector(g, down); if (whistle) { if (!samStaggered(g)) tryWhistle(g); } else give(g, lit); return; }   // (a wedge that cannot be done now — out of reach, the breath not back — is lit and the ring stays)
        if (input.wheel && !down) wheelPace(g, input.wheel);   // (the wheel is his pace under a ring that stands, as it is with no ring)
        if (!R.free && !down) { R.free = true; S.downT = -1; }   // let go in the middle: the ring stands by itself
        if (esc) closeSelector(g, true);
        else if (down && !R.free) S.downT += Math.min(dt, 0.05);
        return;
      }
    }
  }
  // ---- the highlight: ↑ / ↓ any time (the tour's arrows step its stops instead), the wheel while an armed press is down; else the wheel is his pace
  let dSel = 0;
  if (!g.puppet) { if (input.hit('ArrowDown')) dSel++; if (input.hit('ArrowUp')) dSel--; }
  if (input.wheel) { if (stays) { if (!down) wheelPace(g, input.wheel); } else if (armed && live) { S.wheelAcc = Math.max(-2 * WHEEL_STEP, Math.min(2 * WHEEL_STEP, S.wheelAcc + input.wheel)); if (Math.abs(S.wheelAcc) >= WHEEL_STEP) { const sg = Math.sign(S.wheelAcc); dSel += sg; S.wheelAcc -= sg * WHEEL_STEP; S.moved = true; } } else if (!down) wheelPace(g, input.wheel); }   // (Space down but spent: the wheel does nothing rather than change his pace under a finger that is choosing)
  if (!armed) S.wheelAcc = 0;
  if (!stays && armed && live && !S.open && (S.moved || (down && S.downT >= TAP_SECS - 1e-6))) openSelector(g);
  if (dSel && g.nearby.length > 1) { pl.nearSel += dSel; pickHover(g); }
  if (S.ring) S.ring.lit = pl.nearSel + 1;
  // ---- Esc: back out of an open list (or a press not yet a hold): the press is spent, nothing happens on its release
  if (esc && armed) { closeSelector(g, true); return; }
  if (!armed) { if (S.open) closeSelector(g, false); return; }
  if (down) { S.downT += Math.min(dt, 0.05); if (!stays && live && !S.open && S.downT >= TAP_SECS - 1e-6) openSelector(g); return; }   // (a frame hitch must not turn a tap into a hold)
  // ---- released this frame (or begun and ended inside it): the highlighted row is what Space does
  const rowNow = g.hover, listed = S.open, quick = !S.moved && S.downT < (stays ? HANDRING.holdSecs : TAP_SECS);   // (a tap, whatever was up for it: the ring that does not stay is up from the press's edge)
  closeSelector(g, false);
  // (handring.ts `empty`: a tap with no row to give was silence — the key looked dead. The corner shows the word for a moment, every time (ui/overlay.ts
  // reads it off the selector); the log takes a line of it once in EMPTY_AGAIN_SECS — with `near`, whatever the word, since it now changes as he walks)
  if (!listed && !rowNow && HANDRING.empty && !g.puppet && !samStaggered(g)) { const w = emptyWord(g), m = g.messages[g.messages.length - 1]; S.word = w; S.wordT = g.time;
    if (HANDRING.near ? g.time < S.fileT || g.time - S.fileT > EMPTY_AGAIN_SECS : m?.text !== w || g.time - m.t > EMPTY_AGAIN_SECS) { S.fileT = g.time; g.msg(w); }
    return; }
  if (quick && ownBlowHeld(g, rowNow)) return;   // (ownblow.ts: a bare tap never sets off his own charge with him in its blast — the ring's wedge, or the list's row, does)
  give(g, rowNow);
}

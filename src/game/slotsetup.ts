// THE SLOT IN HAND, PRESSED AGAIN, OPENS ITS SETUP (SLOTSETUP.on: on in the page, ?slotsetup=0; off here and on the frozen stand, TPS_SLOTSETUP=1).
//
// What it answers (the maintainer, 10-22): "repeating the current selection open up a menu for configuring the current one", "can allow us to pick between
// auto/semi (get rid of z)", "also lets us pick attachments better", and of the light: "for L can we move that to the pistol/gun's equipment menu?".
//
//   OPEN     the digit of the gun that is IN HIS HANDS (1 the pistol, 2 the long gun; Player.gunInHand: not holstered, not slung) opens that gun's
//            setup — and so does that digit pressed again while the gun is still coming to his hands (`draw`; the maintainer, 10-22, playing it:
//            "when on pistol, double tapping 2 quickly switches but doesn't open the menu"): 2 2 from the pistol is the rifle and its setup, and a
//            row's digit after them is the row. Only where HIS OWN PRESS of that digit drew the gun, and only while that draw lasts: a gun the
//            game put in his hand (the last can thrown, a grab let go) and a later lock on his hands (a tool going back on his pack, a throw's
//            swing) do not open it for one press. With `draw` off, not in the gun's first `settle` seconds in his hands nor while the rifle is
//            still coming round off its sling: there a double-tapped digit draws the gun and no more, as the first build had it.
//            A can has nothing to set: its digit is as it was.
//   ROWS     what the gun has that can be set in the field, each on a digit of its own that is the same on every gun:
//              1  the selector   (semi / auto: a gun with two positions)
//              2  the load       (what its launcher has on the right button: the next load round the tube that he has any of — one he is out of is
//                                 stepped over, and with nothing else to put up the row has no digit)
//              3  the light      (a kit that carries one)
//            The digit steps its row and the setup shuts (`stay`: it stays up for another). So the two presses are always the same two: 2 1 is the
//            rifle's selector, 2 2 its next load (the '2 again' the build had, one press on), 2 3 its light; 1 3 the pistol's light.
//   SHUT     by a pick; by the back key (backkey.ts); by the trigger, the right button or a reload (none of them is taken: the round goes — and a
//            round that goes later, off a click the kit's handling kept through the draw, shuts it as it leaves); by a digit
//            that is no row (the gun's own shuts it and no more, any other is the slot it always was); when what is in his hands changes or something
//            takes them; when the order menu or the Space list comes up (the digits are theirs). No clock runs on it (`pop`, below): it is a MODE he
//            is in until one of those — the maintainer, 10-22, after playing the first build's second and a half: "the timer is bad. we should just
//            have it switch a mode", "it should be something that pops up above the equipment menu rather than always taking up space". With `pop`
//            off it also shuts by itself `secs` after it opened or was last used (0: never), as that build did.
// His feet, his aim and his trigger are his own throughout: nothing is held, nothing is frozen, and no key is read here but the digits and the back key.
// WHAT THE HUD SHOWS is ui/handbox.ts's: the setup's rows stand above the kit column while it is up and at no other time; the box of the thing in his
// hands says what is set in plain words. (`pop` off: the rows are the box's second line, their digits lit while the setup is up.)
// THE TWO KEYS IT REPLACES (Z the selector, L the light) are the board's to drop, not the game's (host/keymap.ts `setFree`): the game goes on asking for
// 'KeyZ' and 'KeyL' and meaning what it meant, so a recording made before plays, and a player who wants either on a key puts its row on one in Options.
// Off = the build as it was: every function here answers on its first line, 2 again steps the launcher's load in player.ts as it did.
// State: three fields on the Player (`setup`; `setupHand`: which gun the hook last found in his hands, since when, and — where his own press drew
// it — the time that draw is over, `own`; `setupKey`: his last press of a gun's digit that was a draw), null on a fresh one.
// NOTHING IS UP AFTER A LOAD: a file's load builds the player again; a save kept in memory puts him back as he stood, the setup too, so
// savestate.ts drops it there (Checkpoints.loadMem).
// No dice, no clock but the game's.
import type { Game, Player } from './game';
import type { Input } from './input';
import { backTake } from './backkey';
import { kitYouLight } from './kit';
import { samWork } from './handwork';
import { samStaggered } from './samstun';
import { backableInteract } from './interact';

export const SLOTSETUP = {
  on: false,
  /** the setup is a mode that pops up above the kit column: no clock runs on it (`secs` is not read) and its rows are drawn only while it is up
   *  (ui/handbox.ts). Off in the module and on the frozen stand with `on` (`TPS_SLOTSETUP=1` raises both); on in the page (`?setuppop=0`: the rows in
   *  the box and the clock, as the first build had them); a recording from before the key replays with it off */
  pop: false,
  /** with `pop` off: seconds the setup stays up with nothing pressed in it (0: until it is shut) */
  secs: 1.5,
  /** a pick leaves the setup up for another (false: a pick shuts it — the same two presses every time) */
  stay: false,
  /** the gun's digit pressed again while the gun is still coming to his hands opens its setup at once: a double tap off another slot is the draw
   *  and the setup (`settle` and the swap's own time are not waited for, where his own press drew it). Off in the module and on the frozen stand
   *  (`TPS_SETUPDRAW=1`, a word of its own: `TPS_SLOTSETUP=1` alone is the rule with the double tap as the draw); on in the page (`?setupdraw=0`:
   *  a double-tapped digit is the draw and no more); a recording from before the key replays with it off */
  draw: false,
  /** with `draw` off: seconds a gun is in his hands before its digit opens the setup (a double-tapped digit on the draw is the draw and no more) */
  settle: 0.35,
  /** THE BOX COUNTS THE ROUNDS IN THE GUN OVER WHAT ITS MAGAZINE HOLDS, WITH A BOX FOR EACH SPARE MAGAZINE BESIDE IT (ui/handbox.ts: 31/30 and two boxes,
   *  each as full as that magazine is; the maintainer of the box that said 31 / 60: "we should say 31/30 and then two spare magazines on the side"). A gun
   *  fed a shell at a time keeps its two numbers: what it carries is loose shells, and the second number is the count of them. The
   *  box's alone: nothing in the game reads it. Off here and on the frozen stand; on in the page (`?magboxes=0` = rounds in the gun over the rounds in all
   *  the spares, as it was); a recording from before the key replays with it off */
  mags: false,
};
export type SetupGun = 'pistol' | 'rifle';
export type SetupKind = 'mode' | 'load' | 'light';
/** a row of a gun's setup: its digit, and its positions in the order the digit steps them (`left`: how many of a load he has) */
export interface SetupRow { key: number; kind: SetupKind; opts: { id: string; on: boolean; left?: number }[] }
/** the digit of each row, on every gun */
const ROW_KEY: Record<SetupKind, number> = { mode: 1, load: 2, light: 3 };
const SLOT_KEY: Record<SetupGun, number> = { pistol: 1, rifle: 2 };
/** his press of a gun's digit and that gun found in his hands are one draw when no further apart than this (the slot lines act the frame of the press) */
const KEYED = 0.1;
/** his own draw is over this long after its swap's time has run (the two clocks are stepped apart: no press is lost on the swap's last frame) */
const OWN_SLACK = 0.05;
/** the hook was not run for this long (something had his hands: a takedown, a man in his arm, a lock): what was up is not up when it runs again */
const STALE = 0.2;

const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOTSETUP_BREAK ?? '') === '1'; } catch { return false; } })();

/** the gun in his hands, as the setup names it (null: none — holstered, slung, a can, a body) */
export function setupGun(pl: Player): SetupGun | null { const f = pl.gunInHand(); return !f || pl.down ? null : f === pl.rifle ? 'rifle' : f === pl.pistol ? 'pistol' : null; }
/** what can be set on one of his guns, as it stands now ([]: nothing) */
export function setupRows(pl: Player, gun: SetupGun): SetupRow[] {
  const rows: SetupRow[] = [], f = gun === 'rifle' ? pl.rifle : pl.pistol;
  if (f.def.modes.length > 1) rows.push({ key: ROW_KEY.mode, kind: 'mode', opts: f.def.modes.map(m => ({ id: m, on: m === f.mode })) });
  if (gun === 'rifle' && loadSteps(pl) > 0) rows.push({ key: ROW_KEY.load, kind: 'load', opts: pl.rifle.attachments.map(a => ({ id: a, on: a === pl.rifle.attachment, left: pl.rifle.left(a) })) });
  if (kitYouLight(pl)) rows.push({ key: ROW_KEY.light, kind: 'light', opts: [{ id: 'off', on: !f.lightOn }, { id: 'on', on: f.lightOn }] });
  return rows;
}
/** is the setup of the gun in his hands up (asked, nothing touched: the HUD, and the page before Tab's trial choice gets the key) */
export function slotSetupOpen(g: Game): boolean {
  const pl = g.player, S = pl.setup; if (!S || !SLOTSETUP.on || BREAK) return false;
  return S.gun === setupGun(pl) && g.time - S.seen <= STALE && !lapsed(g, S.t);
}
/** how much of its time the open setup has left, 1‥0 (1 with no clock on it; 0 = not up) */
export function slotSetupLeft(g: Game): number { const S = g.player.setup; return !S || !slotSetupOpen(g) ? 0 : clocked() ? Math.max(0, 1 - (g.time - S.t) / SLOTSETUP.secs) : 1; }
/** Esc with the back key's rule off (Game.escape): shut it, and say whether there was one to shut */
export function slotSetupShut(g: Game): boolean { if (!slotSetupOpen(g)) return false; g.player.setup = null; return true; }
/** the presses that put the next load on the launcher, as a line of words names them ('2 again' in the build before) */
export const loadKeys = (): string => SLOTSETUP.on && !BREAK ? 'press 2, then 2' : '2 again';   // ('press' and 'then' before a digit: host/keymap.ts names the key each is on)
/** where a kit's weapon light is worked, as a card's note says it ('on L' in the build before) */
export const lightKeys = (): string => SLOTSETUP.on && !BREAK ? 'its gun\'s key again, then 3' : 'on L';
/** would this key, pressed now, be the setup's own (its gun's digit with the gun in his hands, a row's digit with the setup up)? The page asks before
 *  the tick, of keys that do not read the cursor (host/findme.ts: the aim carried through a turn of the view is not let go by one). Nothing touched. */
export function slotSetupTakes(g: Game, code: string): boolean {
  if (!SLOTSETUP.on || BREAK || !/^Digit[1-5]$/.test(code)) return false;
  const pl = g.player, gun = setupGun(pl); if (!gun) return false;
  return code === `Digit${SLOT_KEY[gun]}` || (slotSetupOpen(g) && setupRows(pl, gun).some(r => code === `Digit${r.key}`));
}
/** does the open setup run down by itself (never as a mode: `pop`) */
const clocked = () => !SLOTSETUP.pop && SLOTSETUP.secs > 0;
const lapsed = (g: Game, t: number) => clocked() && g.time - t >= SLOTSETUP.secs;

/** presses of the launcher's own step from the load that is up to the next one he has any of (0: none but the one that is up) */
function loadSteps(pl: Player): number { const rf = pl.rifle, A = rf.attachments, n = A.length, i0 = rf.attachment ? A.indexOf(rf.attachment) : -1; for (let k = 1; k < n; k++) if (rf.left(A[(i0 + k) % n]) > 0) return k; return 0; }

function stepRow(g: Game, gun: SetupGun, row: SetupRow) {
  const pl = g.player, f = gun === 'rifle' ? pl.rifle : pl.pistol;
  if (row.kind === 'mode') f.cycleMode();
  else if (row.kind === 'load') { for (let k = loadSteps(pl); k > 0; k--) pl.rifle.cycleAttachment(); }
  else f.lightOn = !f.lightOn;
  g.audio.play('click', pl.char.muzzle, row.kind === 'light' ? 0.6 : 0.7);
}

/** a gun's digit still in the frame that is not the gun in his hands: the press the slot lines will draw that gun on (kept for `draw`) */
function drawPress(g: Game, input: Input, inHand: SetupGun | null): void {
  for (const G of ['pistol', 'rifle'] as const) if (G !== inHand && input.hit(`Digit${SLOT_KEY[G]}`)) g.player.setupKey = { gun: G, t: g.time };
}

/** player.ts updatePlayer, ahead of the digits' own lines: the digit of the gun in his hands opens its setup; with it up, a row's digit steps the row.
 *  A digit used here is taken out of the frame, so the slot lines below never see it; every other key is left as it was. */
export function slotSetupKeys(g: Game, input: Input): void {
  const pl = g.player;
  if (!SLOTSETUP.on || BREAK) { if (pl.setup) pl.setup = null; return; }
  const gun = setupGun(pl);
  if (!pl.setupHand || pl.setupHand.gun !== gun || pl.setupHand.t > g.time) {   // (the gun came into his hands now — by his own press of its digit, or not)
    const k = pl.setupKey, mine = !!gun && k?.gun === gun && g.time >= k.t && g.time - k.t <= KEYED;
    pl.setupHand = { gun, t: g.time, own: mine ? g.time + Math.max(pl.equipT, SLOTSETUP.settle) + OWN_SLACK : 0 };   // (his draw lasts the swap it started and no longer: a later lock on his hands is not it)
  }
  let S = pl.setup;
  if (S && (S.gun !== gun || g.time - S.seen > STALE || lapsed(g, S.t) || samWork(g) || samStaggered(g) || !!g.orders.menu || backableInteract(g))) S = pl.setup = null;   // (…or another list has the digits: the order menu, the Space list)
  if (S) {
    S.seen = g.time;
    if (backTake(input) || input.hit('Paused') || input.lmbHit() || input.rmbHit() || input.hit('KeyR') || (SLOTSETUP.draw && pl.lastFireT >= S.t)) { pl.setup = null; if (SLOTSETUP.draw) input.pressed.delete(`Digit${SLOT_KEY[S.gun]}`); drawPress(g, input, gun); return; }   // (the click and the reload are not taken: they do what they do. With `draw`: a round that left since it opened shuts it too — a click kept through the draw, a trigger held — and the gun's own digit on that frame is nothing, not the load's old key)
    const rows = setupRows(pl, S.gun);
    for (let d = 1; d <= 5 && pl.setup; d++) {
      if (!input.hit(`Digit${d}`)) continue;
      const row = rows.find(r => r.key === d);
      if (row) { input.pressed.delete(`Digit${d}`); stepRow(g, S.gun, row); S.t = g.time; if (!SLOTSETUP.stay) pl.setup = null; }
      else { if (d === SLOT_KEY[S.gun]) input.pressed.delete(`Digit${d}`); pl.setup = null; }   // (no row of this gun: its own digit shuts the setup, another is the slot it always was)
    }
    drawPress(g, input, gun); return;
  }
  drawPress(g, input, gun);
  if (!gun) return;
  const code = `Digit${SLOT_KEY[gun]}`;
  if (!input.hit(code)) return;
  input.pressed.delete(code);   // (the gun is in his hands: its digit has nothing to draw, and the launcher's load is the setup's row now)
  const coming = pl.equipT > 0 || g.time - pl.setupHand.t < SLOTSETUP.settle;   // (just drawn, or still coming round off the sling)
  if ((coming && !(SLOTSETUP.draw && g.time < (pl.setupHand.own ?? 0))) || !setupRows(pl, gun).length) return;   // (not his own draw of it, or `draw` off: a double-tapped digit draws it and no more; a gun with nothing to set: nothing)
  pl.setup = { gun, t: g.time, seen: g.time };
  g.audio.play('click', pl.char.muzzle, 0.35);
}

// THE SLOT IN HAND, PRESSED AGAIN, OPENS ITS SETUP (SLOTSETUP.on: on in the page, ?slotsetup=0; off here and on the frozen stand, TPS_SLOTSETUP=1).
//
// What it answers (the maintainer, 10-22): "repeating the current selection open up a menu for configuring the current one", "can allow us to pick between
// auto/semi (get rid of z)", "also lets us pick attachments better", and of the light: "for L can we move that to the pistol/gun's equipment menu?".
//
//   OPEN     the digit of the gun that is IN HIS HANDS (1 the pistol, 2 the long gun; Player.gunInHand: not holstered, not slung) opens that gun's
//            setup. Not in the gun's first `settle` seconds in his hands, nor while the rifle is still coming round off its sling: a double-tapped
//            digit draws the gun and no more, as it did.
//            A can has nothing to set: its digit is as it was.
//   ROWS     what the gun has that can be set in the field, each on a digit of its own that is the same on every gun:
//              1  the selector   (semi / auto: a gun with two positions)
//              2  the load       (what its launcher has on the right button: the next load round the tube that he has any of — one he is out of is
//                                 stepped over, and with nothing else to put up the row has no digit)
//              3  the light      (a kit that carries one)
//            The digit steps its row and the setup shuts (`stay`: it stays up for another). So the two presses are always the same two: 2 1 is the
//            rifle's selector, 2 2 its next load (the '2 again' the build had, one press on), 2 3 its light; 1 3 the pistol's light.
//   SHUT     by a pick; by the back key (backkey.ts); by the trigger, the right button or a reload (none of them is taken: the round goes); by a digit
//            that is no row (the gun's own shuts it and no more, any other is the slot it always was); when what is in his hands changes or something
//            takes them; when the order menu or the Space list comes up (the digits are theirs); and by itself `secs` after it opened or was last used (0: never).
// His feet, his aim and his trigger are his own throughout: nothing is held, nothing is frozen, and no key is read here but the digits and the back key.
// WHAT THE HUD SHOWS is ui/handbox.ts's: the box of the thing in his hands lights its rows' digits while the setup is up.
// THE TWO KEYS IT REPLACES (Z the selector, L the light) are the board's to drop, not the game's (host/keymap.ts `setFree`): the game goes on asking for
// 'KeyZ' and 'KeyL' and meaning what it meant, so a recording made before plays, and a player who wants either on a key puts its row on one in Options.
// Off = the build as it was: every function here answers on its first line, 2 again steps the launcher's load in player.ts as it did.
// State: two fields on the Player (`setup`, and `setupHand`: which gun the hook last found in his hands and since when), null on a fresh one (a
// restart, a load: nothing is up). No dice, no clock but the game's.
import type { Game, Player } from './game';
import type { Input } from './input';
import { backTake } from './backkey';
import { kitYouLight } from './kit';
import { samWork } from './handwork';
import { samStaggered } from './samstun';
import { backableInteract } from './interact';

export const SLOTSETUP = {
  on: false,
  /** seconds the setup stays up with nothing pressed in it (0: until it is shut) */
  secs: 1.5,
  /** a pick leaves the setup up for another (false: a pick shuts it — the same two presses every time) */
  stay: false,
  /** seconds a gun is in his hands before its digit opens the setup (a double-tapped digit on the draw is the draw and no more) */
  settle: 0.35,
};
export type SetupGun = 'pistol' | 'rifle';
export type SetupKind = 'mode' | 'load' | 'light';
/** a row of a gun's setup: its digit, and its positions in the order the digit steps them (`left`: how many of a load he has) */
export interface SetupRow { key: number; kind: SetupKind; opts: { id: string; on: boolean; left?: number }[] }
/** the digit of each row, on every gun */
const ROW_KEY: Record<SetupKind, number> = { mode: 1, load: 2, light: 3 };
const SLOT_KEY: Record<SetupGun, number> = { pistol: 1, rifle: 2 };
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
export function slotSetupLeft(g: Game): number { const S = g.player.setup; return !S || !slotSetupOpen(g) ? 0 : SLOTSETUP.secs > 0 ? Math.max(0, 1 - (g.time - S.t) / SLOTSETUP.secs) : 1; }
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
const lapsed = (g: Game, t: number) => SLOTSETUP.secs > 0 && g.time - t >= SLOTSETUP.secs;

/** presses of the launcher's own step from the load that is up to the next one he has any of (0: none but the one that is up) */
function loadSteps(pl: Player): number { const rf = pl.rifle, A = rf.attachments, n = A.length, i0 = rf.attachment ? A.indexOf(rf.attachment) : -1; for (let k = 1; k < n; k++) if (rf.left(A[(i0 + k) % n]) > 0) return k; return 0; }

function stepRow(g: Game, gun: SetupGun, row: SetupRow) {
  const pl = g.player, f = gun === 'rifle' ? pl.rifle : pl.pistol;
  if (row.kind === 'mode') f.cycleMode();
  else if (row.kind === 'load') { for (let k = loadSteps(pl); k > 0; k--) pl.rifle.cycleAttachment(); }
  else f.lightOn = !f.lightOn;
  g.audio.play('click', pl.char.muzzle, row.kind === 'light' ? 0.6 : 0.7);
}

/** player.ts updatePlayer, ahead of the digits' own lines: the digit of the gun in his hands opens its setup; with it up, a row's digit steps the row.
 *  A digit used here is taken out of the frame, so the slot lines below never see it; every other key is left as it was. */
export function slotSetupKeys(g: Game, input: Input): void {
  const pl = g.player;
  if (!SLOTSETUP.on || BREAK) { if (pl.setup) pl.setup = null; return; }
  const gun = setupGun(pl);
  if (!pl.setupHand || pl.setupHand.gun !== gun || pl.setupHand.t > g.time) pl.setupHand = { gun, t: g.time };   // (the gun came into his hands now)
  let S = pl.setup;
  if (S && (S.gun !== gun || g.time - S.seen > STALE || lapsed(g, S.t) || samWork(g) || samStaggered(g) || !!g.orders.menu || backableInteract(g))) S = pl.setup = null;   // (…or another list has the digits: the order menu, the Space list)
  if (S) {
    S.seen = g.time;
    if (backTake(input) || input.hit('Paused') || input.lmbHit() || input.rmbHit() || input.hit('KeyR')) { pl.setup = null; return; }   // (the click and the reload are not taken: they do what they do)
    const rows = setupRows(pl, S.gun);
    for (let d = 1; d <= 5 && pl.setup; d++) {
      if (!input.hit(`Digit${d}`)) continue;
      const row = rows.find(r => r.key === d);
      if (row) { input.pressed.delete(`Digit${d}`); stepRow(g, S.gun, row); S.t = g.time; if (!SLOTSETUP.stay) pl.setup = null; }
      else { if (d === SLOT_KEY[S.gun]) input.pressed.delete(`Digit${d}`); pl.setup = null; }   // (no row of this gun: its own digit shuts the setup, another is the slot it always was)
    }
    return;
  }
  if (!gun) return;
  const code = `Digit${SLOT_KEY[gun]}`;
  if (!input.hit(code)) return;
  input.pressed.delete(code);   // (the gun is in his hands: its digit has nothing to draw, and the launcher's load is the setup's row now)
  if (pl.equipT > 0 || g.time - pl.setupHand.t < SLOTSETUP.settle || !setupRows(pl, gun).length) return;   // (just drawn or still coming round off the sling: a double-tapped digit draws it and no more; a gun with nothing to set: nothing)
  pl.setup = { gun, t: g.time, seen: g.time };
  g.audio.play('click', pl.char.muzzle, 0.35);
}

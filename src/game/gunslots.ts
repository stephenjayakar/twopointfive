// A PRIMARY AND A SECONDARY FOR EVERY MAN (GUNSLOTS). The maintainer, 10-18: "also should we model more firearms? and separate primary and secondary slots?"
// Until now you carried two guns (the pistol on 1, the long gun on 2) and a teammate ONE: his card had a single Weapon row and the sidearm on his thigh was
// drawn only. With the switch on every card names two guns — `primary` (a long gun, or none: the pistol alone) and `secondary` (a sidearm) — as two rows where
// the one gun row stood (kit.ts), each a PICK of the table below: what the tile says, and the weapons.ts row it is with a suppressor on and with it off. A
// teammate is staged with both (Guard.second: the gun that is NOT in his hands), and with `dry` he goes to his sidearm when the primary runs dry on a man
// close in front of him — `out` seconds, where standing there changing a magazine is the row's whole reload — and takes the primary up again, reloaded, once
// nobody has been in front of him for `lull` seconds (sideTick). You: 1 is your secondary, 2 your primary, the swap as it was — and which two guns they
// are is your card's (kit.ts kitPlayer builds them from the picks; the issue pair is the pair you were built with).
// Off (the module, the frozen stand, `?nogunslots`): the card of the build before — one gun row — and nobody but you has a second gun. `GUNSLOTS_BREAK=1`
// (tools/qa/gunslots-check.ts): a teammate is staged without his second gun and the card keeps its one gun row.
// The picks ride on the big slot's card (kit.ts BIGSLOT: the shotgun is kit there, never a man's gun): with that switch off the card is the build before's too.
import type { Game, Guard } from './game';
import { Firearm, WEAPONS, type WeaponId } from './weapons';
import { feedDeal, feedOf, feedTick } from './gunreload';   // (called inside sideTick only)

export const GUNSLOTS = {
  on: false,
  /** a teammate whose primary runs dry on a man within `near` metres goes to his sidearm (off: he stands and reloads, as he always has) */
  dry: true,
  near: 10,
  /** seconds from the dry click to the sidearm on his man: the long gun let go onto its sling, the pistol out of the holster and up */
  out: 0.7,
  /** seconds with nobody in front of him before the sidearm goes back, and the seconds that takes on top of the primary's own reload */
  lull: 1.6, back: 0.65,   // (as long as your own swap back to the long gun: no quicker hands than yours)
  /** a TEAMMATE's round below the gunshot line (a suppressed pistol, the MP7) is the odd noise yours is to a man of the other side near enough to hear it
   *  (guards.ts hearingCheck). Off: only your own quiet rounds were ever heard — a teammate's reached nobody, however near. */
  heard: true,
  /** a pick with its suppressor off is THE SAME GUN without it (weapons.ts mk18bare, g19bare: its name, magazine, handling and look; the report and flame of
   *  a bare one). Off: the old card's meaning — a carbine with no suppressor was the defenders' AKS-74U row, a pistol with none their sidearm. */
  bare: true,
};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GUNSLOTS_BREAK ?? '') === '1'; } catch { return false; } })();
/** GUNSLOTS_BREAK=1 (the check's break path): the card keeps its one gun row and nobody is handed a second gun */
export const gunsBroken = (): boolean => BREAK;
/** guards.ts hearingCheck: this quiet report from a teammate's gun counts, as yours does */
export const quietHeard = (): boolean => GUNSLOTS.on && GUNSLOTS.heard && !BREAK;
export const GUNSLOTS_STATS = { staged: 0, out: 0, back: 0 };
/** his man counts as in his eyes this long after he last saw him */
const SEEN_SECS = 0.5;

export type GunSlot = 'primary' | 'secondary';
/** One thing a gun row offers: the rows of weapons.ts it is with a suppressor fitted (`can`) and without (`bare`) — null where it cannot be had that way
 *  (the card's Suppressor row then changes nothing on it). */
export interface GunPick { id: string; slot: GunSlot; can: WeaponId | null; bare: WeaponId | null; /** the row `bare` was before the gun had one of its own (GUNSLOTS.bare off) */ bareWas?: WeaponId }
/** (plain words only: nothing of another game module is read as this loads) */
const PICKS: GunPick[] = [
  { id: 'mk18', slot: 'primary', can: 'fn2000', bare: 'mk18bare', bareWas: 'aks74u' },   // (the issue carbine — `bareWas`: the two rows a teammate's Weapon + Suppressor rows had always meant)
  { id: 'mk12', slot: 'primary', can: 'mk12', bare: null },   // reach
  { id: 'mp7', slot: 'primary', can: 'mp7', bare: null },   // quiet and quick
  { id: 'mk46', slot: 'primary', can: null, bare: 'mk46' },   // volume
  { id: 'm1014', slot: 'primary', can: null, bare: 'm1014' },   // the room
  { id: 'g19', slot: 'secondary', can: 'fiveseven', bare: 'g19bare', bareWas: 'guard9mm' },
  { id: 'hk45', slot: 'secondary', can: 'hk45', bare: null },   // the quietest
  { id: 'g18', slot: 'secondary', can: null, bare: 'g18' },   // a fight in the holster
];
/** no long gun: the sidearm is the gun in his hands */
export const NO_PRIMARY = 'none';
export const gunPick = (id: unknown): GunPick | null => PICKS.find(p => p.id === id) ?? null;
/** what a slot's row steps through, in order (a primary may be left at home) — only picks with a row this build may construct */
export function gunPicks(slot: GunSlot): string[] { const ids = PICKS.filter(p => p.slot === slot && [p.can, p.bare].some(w => w && WEAPONS[w].enabled)).map(p => p.id); return slot === 'primary' ? [...ids, NO_PRIMARY] : ids; }
/** the weapons.ts row a pick is on a card with / without the suppressor (the other one where it cannot be had that way, or this build does not hand that row out) */
export function pickRow(id: unknown, suppressed: boolean): WeaponId | null { const p = gunPick(id); if (!p) return null; const bare = GUNSLOTS.bare ? p.bare : p.bareWas ?? p.bare; return (suppressed ? [p.can, bare] : [bare, p.can]).find(w => w && WEAPONS[w].enabled) ?? null; }
/** the pick's name on its tile: its row's short name, as the card would hand it to him */
export function pickWord(id: unknown, suppressed = true): string { if (id === NO_PRIMARY) return 'none'; const w = pickRow(id, suppressed); return w ? WEAPONS[w].short : String(id); }
/** which of the card's gun drawings stands for a pick (ui/kitIcons.ts), by its row's class — null: none carried */
export function pickIcon(id: unknown): 'rifle' | 'pistol' | 'shotgun' | null { const w = pickRow(id, true) ?? pickRow(id, false); if (!w) return null; const c = WEAPONS[w].cls; return c === 'pistol' ? 'pistol' : c === 'shotgun' ? 'shotgun' : 'rifle'; }

// ------------------------------------------------------------ a teammate's second gun
/** kit.ts kitStage: he is handed the gun that is not in his hands (null row: none — the pistol alone is his whole kit) */
export function sideStage(gd: Guard, row: WeaponId | null) {
  gd.second = null; if (!GUNSLOTS.on || BREAK || !row || !WEAPONS[row].enabled || row === gd.weapon.def.id) return;
  gd.second = { gun: new Firearm(WEAPONS[row]), id: row, ahead: WEAPONS[row].muzzleAhead, out: false, t: -100, lock: -100, shots: 0 };
  GUNSLOTS_STATS.staged++;
}
/** the gun in his hands and the one that is not change places (the row is dealt off his route every frame — game.ts — so the route is where it is written) */
function swap(gd: Guard) {
  const s = gd.second!, was = gd.weapon, ahead = gd.char.muzzleAhead;
  gd.route.weapon = s.id; gd.weapon = s.gun; gd.reloadT = -1; gd.char.muzzleAhead = s.ahead;
  s.gun = was; s.id = was.def.id; s.ahead = ahead;
}
/** … on the fight AI's path (guards.ts startReloadBeat: the round that emptied his gun has just gone): his man is where he last had him, while he is on him */
export function sideOutAlert(g: Game, gd: Guard): boolean { const k = gd.lastKnown; return !!gd.second && gd.state === 'alert' && !!k && sideOut(g, gd, Math.hypot(k[0] - gd.char.pos[0], k[2] - gd.char.pos[2])); }
/** DRY ON A MAN (roomfight.ts, where his trigger found nothing to fire): the sidearm comes out instead of the reload — true, and no round
 *  goes for `out` seconds (sideLocked). False: he has none, it is out already or empty, his hands hold the big slot's shotgun, or his man is past `near`. */
export function sideOut(g: Game, gd: Guard, dist: number): boolean {
  const s = gd.second; if (!GUNSLOTS.on || !GUNSLOTS.dry || !s || s.out || !s.gun.roundsReady || gd.slung?.out || gd.bigOut || gd.state === 'dead' || !(dist <= GUNSLOTS.near)) return false;
  swap(gd); s.out = true; s.t = g.time; s.lock = g.time + GUNSLOTS.out; s.shots = gd.weapon.shotsFired; GUNSLOTS_STATS.out++;
  gd.fireCd = 0;   // (the long gun's own beat between rounds is not the sidearm's: `lock` is the whole wait, on both trigger paths — sideLocked)
  g.audio.play('equip', gd.char.pos, 0.45);
  return true;
}
/** he has a man in front of him this frame: the sidearm stays out */
export function sideSeen(g: Game, gd: Guard) { const s = gd.second; if (s?.out) s.t = g.time; }
/** his hands are between guns: no round (asked by every trigger a teammate has: roomfight.ts, coverfire.ts, the fight AI's fire site in guards.ts) */
export const sideLocked = (g: Game, gd: Guard): boolean => !!gd.second && g.time < gd.second.lock;
/** the long gun he let go of hangs down his front (combat.ts guardProps draws it): its rig, while the sidearm is out */
export function sideHung(gd: Guard): 'carbine' | 'sc20k' | null { const s = gd.second; if (!s?.out || gd.state === 'dead') return null; const r = s.gun.def.rig; return r === 'carbine' || r === 'sc20k' ? r : null; }
/** … every frame, each man (game.ts, where his row is dealt): nobody in front of him for `lull` seconds — the sidearm goes back and the primary comes up
 *  reloaded (the sidearm topped off too), his hands busy for its reload and `back` more. A dead man keeps what he fell with. */
export function sideTick(g: Game, gd: Guard, dt = 0) {
  const s = gd.second; if (!s || gd.state === 'dead') return;
  if (!s.out) {   // (the long gun just taken up again, his hands busy for its reload: its own feeding is heard on that beat — gunreload.ts; nothing for a magazine gun)
    if (dt > 0 && g.time < s.lock) { const def = gd.weapon.def, now = g.time - (s.lock - def.reload.dur - GUNSLOTS.back); feedTick(g, gd.char, def, now - dt, now); }
    return;
  }
  if (gd.slung?.out) return;
  if (gd.weapon.shotsFired !== s.shots || (gd.state === 'alert' && g.time - gd.lastSeenT < SEEN_SECS)) { s.shots = gd.weapon.shotsFired; s.t = g.time; }   // (a round from it, or his man in his eyes: somebody is in front of him)
  if (g.time - s.t < GUNSLOTS.lull || g.time < s.lock) return;
  swap(gd); s.out = false; gd.weapon.rearm(); s.gun.rearm(); s.lock = g.time + gd.weapon.def.reload.dur + GUNSLOTS.back; GUNSLOTS_STATS.back++;   // (both topped off in the lull: the sidearm never comes out empty)
  // (gunreload.ts: a long gun with a model of its own is taken up on its row's own beat, the hand at that gun's stations — and a belt or a tube gun's sounds
  //  are its own, each on that beat: the frames above. A magazine gun's one clack is here. As it was with gunlook.ts off)
  const def = gd.weapon.def, F = feedOf(def);
  feedDeal(gd.char.anim, def.cls === 'pistol' ? null : gd.weapon, true);   // (the gun just taken up: the animator's own `longGun` is still the sidearm's this frame)
  gd.char.anim.reload(def.reload.dur, F ? def.reload : undefined); g.audio.play('equip', gd.char.pos, 0.45);
  if (!F || F.kind === 'mag') g.audio.play('magOut', gd.char.pos, 0.5);
}

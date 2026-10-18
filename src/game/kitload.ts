// LIGHTER KIT MOVES FASTER AND HIDES BETTER (the maintainer, 10-18: "we should also model a mobility / concealment score like door kickers 2 does -- there
// should be legitimate reasons to bring less kit"). Until this file more kit was simply better: a pouch filled cost nothing but the pouch. Now what a man
// carries gives him TWO SCORES, each 1 for a man with nothing on him and less for every thing on his card:
//   mobility      what his legs give him — the gun in his hands, every full pouch, the big thing on his back each take a little off
//   concealment   how easily he is noticed — a long gun is a long shape, a hammer on the back is a bigger one, and full pouches rattle
// and the scores change the run (the floor functions below, each a plain `×1` while the switch is off):
//   pace          the speed his legs are asked for is × loadPaceK, ONCE a leg: you (player.ts: walk, crouch-walk, the drag, the hold; your sprint keeps
//                 `sprint` of it) and a teammate (guards.ts teamLegs — followPath, stepAlongPath, a scripted man's strafe and settle; on top of the
//                 caps the squad's legs already have, which so scale with the man; never past `paceTop`: teammates never sprint). A teammate's muzzle
//                 comes round and his legs pick pace up by the same factor (guards.ts teamTurn, teamLean): in a room a heavy man is the slower gun.
//                 The search that reckons how far you can have run (guards.ts floodFrom) and the sneak's price of a crossing (sneak.ts) read it too
//   seen          the notice a visible man builds in an eye is × loadSeenK (guards.ts sightGain and the hold's pairSightRate for you, sightGainOn for a
//                 teammate); the point-blank floor stands whole — a shape at a man's elbow is seen whatever it carries
//   heard         a footfall's level is × loadHeardK before the floor has its say (floor.ts tread: one number for the mixer, the ears and the meter) — and
//                 in the room fight's defenders' ears (pressure.ts teamBoots). Whether a step is a walk's or a run's is read off the pace he was ASKED
//                 for (loadGait): a light man made quicker is not thereby running. Your flat-out sprint is boots on a floor whatever you carry
// THE REFERENCE is each man's OWN CARD AS ISSUED (kit.ts kitIssuedShown: as the kit rules stand, and as a team of three or four is dealt the issue —
// KITDEAL): a card that scores what his issue scores is ×1 on all three,
// exactly — so the game as it was tuned is the game an issued squad plays, by run digest, and "as issued is the kit table off" still holds. Lighter than
// his issue pays, heavier costs; what a heavy card wins is the kit itself. (The price: two men issued differently are ×1 at different scores.)
//
// WHERE A SCORE COMES FROM: the card a staging put on the man, weighed THEN, beside his reference (kit.ts: kitPlayer writes yours on the Player through
// loadWear, `Player.kitLoad`, and it comes off with the card — kitShow; kitStage writes a teammate's through loadMan, the table `manLoad` below). What is
// on a man is his for the run: a rule switched on the page after he was staged, or a replay on another stand, does not re-weigh him. Nobody has a score
// whom a staging put no card on — a defender, a civilian, the plain night's Player as built, a showcase's cast — or whose kit the staging itself chose: a
// lesson's page, a mission that issues its own kit. THE WEIGHT IS THE POUCHES RULE'S (kit.ts SLOTS): with that rule off a card's rows are free counts
// that no table of weights was cut for, and nobody is weighed. Only the ROWS A CARD HAS weigh (kit.ts kitRows): a count kept on a card whose row is
// switched off is carried by nobody.
// GUNS AND SLOTS PLUG IN HERE: a gun weighs by its class (`gun`), and a card's guns are a LIST (gunsOf): the gun in his hands and the sidearm beside a long
// gun. With one gun row the row weighs the list; with a Primary and a Secondary row (gunslots.ts) the long gun is the Primary's and the sidearm the
// Secondary's. A new class of gun is one row of `gun`.
//
// ONE SWITCH, `KITLOAD.on` — ON in the page (host/profile.ts pageSwitches; `?nokitload` = the build before), OFF here and on the frozen harness stand
// (`TPS_KITLOAD=1`; a FROZEN_HOLDS row, in the knob registry and a journal's tables: a recording from before the table replays with it off). Off = nobody's
// pace, notice or footfall is touched: the build as it was. `KITLOAD_BREAK=1` (the check's): the floor ignores the scores with the switch on.
// THE CARD'S FACE (ui/kitCard.ts) reads loadOf / loadShare whatever the switch says, and shows the two bars only while it is on.
//
// (src/game is one import cycle: the table below is plain literals; nothing here is built from another game module's exports at module load.)
import type { Game, Guard } from './game';
import { WEAPONS, type WeaponId } from './weapons';
import { SLOTS, bigOf, kitGun, kitIssuedShown, kitRows, kitSide, type MemberKit } from './kit';
import { clamp } from '../math/vec';
import { SideMap } from '../math/side';

/** a card's two scores, each 0‥1: 1 = nothing on him */
export interface KitLoad { mob: number; con: number }
/** what is ON a man for the run: his card's scores and his reference's, as they were weighed when he was staged */
export interface KitWorn extends KitLoad { refMob: number; refCon: number }
/** what one thing takes off the two scores: [mobility, concealment] */
type Cost = [number, number];
export type GunClass = 'long' | 'shotgun' | 'pistol';

export const KITLOAD = {
  on: false,
  // THE TWO SCORES PULL APART, on purpose: a long gun is mostly SHAPE (it costs hiding, little pace), what fills a pouch is mostly WEIGHT (it costs pace,
  // little hiding), and the big thing on the back is weight first. So "the long gun and empty pouches" is quick but seen, "the pistol and full pouches"
  // is hidden but slow, and neither bar says what the other does.
  /** a gun by its class: a carbine or a rifle in the shoulder, the shotgun as a GUN (only with the big slot off: there it is his weapon row), a pistol */
  gun: { long: [0.12, 0.42], shotgun: [0.12, 0.34], pistol: [0.03, 0.04] } as Record<GunClass, Cost>,
  /** one of each small thing, by the card's field (about its real weight: a smoke can and a door charge are the heavy ones). A man's four pouches full
   *  cost his legs about three times what his long gun does: emptying them is a trade worth making without changing the gun */
  small: { smoke: [0.1, 0.02], bangs: [0.07, 0.02], frags: [0.08, 0.02], shells: [0.07, 0.01], charges: [0.1, 0.02], wand: [0.07, 0.02], cams: [0.04, 0.01] } as Record<string, Cost>,
  /** the big thing on his back, by what the big slot's row calls it (kit.ts bigOf) */
  big: { shotgun: [0.18, 0.1], hammer: [0.3, 0.1], wall: [0.24, 0.06] } as Record<string, Cost>,
  /** how much of a point of mobility is pace: his legs are × 1 + (mobility − his issue's) × pace */
  pace: 0.4,
  /** … of a point of concealment is the notice he builds in an eye: × 1 − (concealment − his issue's) × seen; and a footfall's level, the same way */
  seen: 0.6, heard: 0.7,
  /** how much of his pace factor YOUR SPRINT keeps (a flat-out run is legs more than load: 0.5 = half the walk's gain or loss) */
  sprint: 0.5,
  /** the most a TEAMMATE's legs are ever asked for with a light card (m/s): a purposeful walk still (guards.ts PACE.max is 2.2), well under the sprint clip
   *  (character.ts BLEND: past 2.7) */
  paceTop: 2.4,
};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.KITLOAD_BREAK ?? '') === '1'; } catch { return false; } })();

// ------------------------------------------------------------ a card's scores
const gunClass = (w: WeaponId | null): GunClass | null => { const c = w ? WEAPONS[w]?.cls : null; return !c ? null : c === 'pistol' ? 'pistol' : c === 'shotgun' ? 'shotgun' : 'long'; };
/** the guns a card puts on member i, the one in his hands first: for you the pistol on the thigh beside a long gun; for a teammate the gun his card names
 *  and, where a card has a secondary slot (gunslots.ts), the sidearm beside a long gun */
export function gunsOf(i: number, m: MemberKit): GunClass[] {
  if (i === 0) return m.weapon === 'pistol' ? ['pistol'] : [m.weapon === 'shotgun' ? 'shotgun' : 'long', 'pistol'];
  const hand = gunClass(kitGun(m)) ?? 'long', side = gunClass(kitSide(m)); return side ? [hand, side] : [hand];
}
const add = (a: Cost, b: Cost | undefined, n = 1): Cost => (b ? [a[0] + b[0] * n, a[1] + b[1] * n] : a);
/** what ONE row of member i's card takes off his two scores as the card stands (null: a row that weighs nothing — a fitting, a colour, a count of none) */
export function loadShare(i: number, m: MemberKit, field: string): KitLoad | null {
  const K = KITLOAD; let c: Cost = [0, 0];
  if (field === 'weapon' || field === 'primary' || field === 'secondary') {   // (one gun row: every gun; two — gunslots.ts: the long gun on Primary, the sidearm on Secondary)
    const guns = gunsOf(i, m), long = m.weapon !== 'pistol';
    for (const g of field === 'weapon' ? guns : field === 'primary' ? (long ? guns.slice(0, 1) : []) : long ? guns.slice(1) : guns) c = add(c, K.gun[g]);
  }
  else if (field === 'big') c = add(c, K.big[bigOf(m)]);
  else if (field === 'walls') c = add(c, K.big.wall, Math.max(0, m.walls | 0));   // (the big slot off: its own counted row)
  else if (field === 'wand') c = add(c, m.wand ? K.small.wand : undefined);
  else if (K.small[field]) c = add(c, K.small[field], Math.max(0, Number((m as unknown as Record<string, unknown>)[field]) | 0));
  return c[0] || c[1] ? { mob: c[0], con: c[1] } : null;
}
/** MEMBER i's TWO SCORES for the card `m`: 1 less what every row his card HAS takes (kit.ts kitRows: a count on a row that is switched off weighs nothing) */
export function loadOf(i: number, m: MemberKit): KitLoad {
  let mob = 0, con = 0;
  for (const r of kitRows(i)) { const s = loadShare(i, m, r.field); if (s) { mob += s.mob; con += s.con; } }
  return { mob: clamp(1 - mob, 0, 1), con: clamp(1 - con, 0, 1) };
}
/** THE REFERENCE for member i: his own card AS ISSUED, as the kit rules stand and as a team of `n` is dealt it (kit.ts kitIssuedShown: the issue shared out
 *  over three or four; `n` left out = the team the loadout screen shows) — the man the game was tuned on. A card that scores what his issue scores is ×1
 *  on all three, exactly */
export function loadRef(i: number, n?: number): KitLoad { return loadOf(i, kitIssuedShown(i, n)); }
/** (two sums of the same things in another order may differ in their last bit: a score within a hair of his reference IS it — ×1 exactly) */
const snap = (x: number, r: number): number => (Math.abs(x - r) < 1e-9 ? r : x);
/** what member i wears with the card `m` on him: its scores beside his reference's — null with the pouches rule off (nobody is weighed: the header) */
export function loadWorn(i: number, m: MemberKit, n?: number): KitWorn | null {
  if (!SLOTS.on) return null;
  const L = loadOf(i, m), R = loadRef(i, n); return { mob: snap(L.mob, R.mob), con: snap(L.con, R.con), refMob: R.mob, refCon: R.con };
}
/** what a man wearing `w` is × his reference: his legs' pace, the notice he builds in an eye, his footfall's level */
export function loadPaceK(w: KitWorn): number { return Math.max(0.5, 1 + (w.mob - w.refMob) * KITLOAD.pace); }
export function loadSeenK(w: KitWorn): number { return Math.max(0.25, 1 - (w.con - w.refCon) * KITLOAD.seen); }
export function loadHeardK(w: KitWorn): number { return Math.max(0.25, 1 - (w.con - w.refCon) * KITLOAD.heard); }

// ------------------------------------------------------------ on the floor
/** what each staged teammate wears (kit.ts kitStage, beside the card it puts on him; a man restaged is a new man) */
const manLoad = new SideMap<Guard, KitWorn>('kitload.manLoad');
/** YOUR card has just gone on this run's Player (kit.ts kitPlayer; null: it came off — kitShow — or the staging chose his kit itself): what it weighs is
 *  written on him whatever the switch says (it is his card's; the switch is whether the floor reads it) */
export function loadWear(g: Game, m: MemberKit | null) { g.player.kitLoad = m ? loadWorn(0, m) : null; }
/** member i's card has just gone on this teammate, one of `n` who came (kit.ts kitStage; null: the staging chose his kit itself) */
export function loadMan(gd: Guard, i: number, m: MemberKit | null, n?: number) { const w = m ? loadWorn(i, m, n) : null; if (w) manLoad.set(gd, w); else manLoad.delete(gd); }
/** what the floor reads for this man — you (`'player'`) or a guard: null = nothing of his is touched (the switch off, a show, nothing weighed on him) */
export function loadOn(g: Game, who: Guard | 'player'): KitWorn | null {
  if (!KITLOAD.on || BREAK || g.touring) return null;
  return who === 'player' ? g.player.kitLoad : manLoad.get(who) ?? null;
}
/** × the speed this man's legs may be asked for (1 for a man with nothing weighed on him) */
export function loadPaceOn(g: Game, who: Guard | 'player'): number { const w = loadOn(g, who); return w ? loadPaceK(w) : 1; }
/** × YOUR flat-out run (the pace factor, as much of it as `sprint` keeps; 1 with nothing weighed on you) */
export function loadSprintOn(g: Game): number { const w = loadOn(g, 'player'); return w ? 1 + (loadPaceK(w) - 1) * KITLOAD.sprint : 1; }
/** the speed YOUR legs may be asked for (`sprint`: a flat-out run keeps only part of the factor) */
export function samLoadPace(g: Game, speed: number, sprint = false): number { const w = loadOn(g, 'player'); return !w ? speed : speed * (sprint ? loadSprintOn(g) : loadPaceK(w)); }
/** the speed an AI man's legs may be asked for: a teammate's is his card's, and a light one's is never raised past `paceTop` (anybody else: as asked).
 *  NOT a cap: asked twice it is applied twice — one call a leg (guards.ts teamLegs) */
export function loadPace(g: Game, gd: Guard, speed: number): number {
  const w = loadOn(g, gd); if (!w) return speed;
  return Math.min(speed * loadPaceK(w), Math.max(speed, KITLOAD.paceTop));
}
/** the speed he would be doing with his issue on him, for the question "is this step a walk's or a run's" (asked of the pace he was ASKED for, not of
 *  what his card made of it; a hair under, so that the walk's most times his factor does not read as a run; his speed itself for a man with nothing weighed) */
export function loadGait(g: Game, who: Guard | 'player', speed: number): number { const w = loadOn(g, who); return w ? speed / loadPaceK(w) - 1e-6 : speed; }
/** × the notice this man builds in an eye that has him (`'player'` or a guard: 1 for a man with nothing weighed on him) */
export function loadSeen(g: Game, who: Guard | 'player'): number { const w = loadOn(g, who); return w ? loadSeenK(w) : 1; }
/** × a footfall's level, his */
export function loadHeard(g: Game, who: Guard | 'player'): number { const w = loadOn(g, who); return w ? loadHeardK(w) : 1; }
/** × what a low crossing under an eye costs this man in that eye's notice (sneak.ts crossCost: its price is rate × time — his shape, over his pace) */
export function loadCross(g: Game, who: Guard | 'player'): number { const w = loadOn(g, who); return w ? loadSeenK(w) / loadPaceK(w) : 1; }

// EACH MEMBER'S KIT AND UNIFORM (the maintainer, 10-07: "tweaking their kit and uniform and all that could be cool. think like mgsv did!"): one small table —
// KIT.members[i], 0 = you, 1 to 4 = the teammates in the order a scenario stages them — of what each brings to a run and what he wears, kept per machine
// (localStorage twopointsix.kit), changed on a card per member (ui/kitCard.ts) and put on the men where a scenario stages its team (kitStage: one call at the
// end of nightbreach.ts stage() — the night breach and the room clear — and of rescue.ts's staging).
//
// ONLY WHAT THE GAME ALREADY HAS. Every row is a thing the code could already do, picked per man:
//   weapon + suppressed   the four rows of weapons.ts a man can be handed: rifle = the FN2000 (suppressed) or the AKS-74U (bare); pistol = the Five-seveN
//                         (suppressed — the one gun the hearing model does not take for gunfire: its report is level 0.6) or the 9 mm (bare). You: 'rifle' is
//                         the FN2000 with the Five-seveN on the thigh, 'pistol' the Five-seveN alone (Player.hasRifle); both of yours are suppressed.
//                         'shotgun' (gear, 10-08 — shotgun.ts) is the M870 breaching shotgun in the rifle's place, for a teammate and for you (yours rides in
//                         slot 2 with the Five-seveN on the thigh): nine pellets a shell, a man down at room range, a lock off its door; never suppressed.
//   light                 a weapon light FITTED (teammates). None: his light is never lit, whatever the light rule, an order or the fight would burn it for
//                         (the housing is still drawn on the gun, dark: rigProps.ts has no gun without one).
//   nvg                   night-vision goggles WORN (teammates; nvg.ts). None: no tube, never 'dark' — his light, if he has one, is the light rule's alone.
//   bangs / charges       what a teammate brings to the squad's counted stun canisters and door charges (doortools.ts): the pool is what the men who come
//                         carry (kitPool) — with every card as issued and two or more coming it is DOORTOOLS.bangs / .charges exactly, whatever those knobs
//                         say; one man alone brings his own two and one.
//   smoke (a teammate)    the smoke canisters he brings to the squad's count for the order 'smoke there', on a spot of floor (squadsmoke.ts; kitSmokes).
//                         None as issued: with no card carrying one the order is not on the menu and nothing of it runs.
//   smoke / bangs         you: your own smoke and stun canisters (Player.canisters / .flashbangs), counted rows under the pouches rule (one of each as
//                         issued); with that rule off (?noslots) the one 'Cans' row of the build before it: four fixed splits of six.
//   suit / trim           the mannequin's two colours (Character.tint: the suit; tint2: its joints). Looks only — nobody's eyes read a colour.
// POUCHES (10-08, the maintainer: "door kickers 2 balanced it pretty well where the wall charge took a full slot that could otherwise be used for multiple door
// charges … same goes for flash bangs, smoke grenades, frag grenades, dynamic hammer, etc."): what a man carries of the breaching tools and the throwables
// comes out of HIS pouches — and, where the table sets one, what the teammates carry between them out of the SQUAD's (slots.json v7 sets none: the
// maintainer, 10-11, "feels weird that there's a limit on the whole squad when individuals have free pouches"; `squad.pouches` a number = the shared limit back). The numbers are DATA, in one place: slots.json beside this
// file, the balance's table as it wrote it (SLOTS.table; slotsSet swaps it) — each man's pouches, the squad's, what one of each tool costs, the most a man
// and a squad may carry, the named loadouts. A row cannot be stepped past either budget (kitPeek / kitTry say why), the sets are legal fills (the table's
// own loadouts), a saved kit over the rule gives up what it added over the issued kit until it fits (kitFitAll). What is issued is always a legal fill — a
// table that makes it not one is refused whole — so the rule moves nothing in a run until a card is changed. SLOTS.on false (?noslots) = the free rows of
// the build before. The squad's budget is counted over the teammates WHO COME (`team`, kitTeam): the loadout screen sets it as its size is stepped, the kit preview and a stored kit use all four (legal for the four is legal for any smaller team), and kitStage fits the cards to the men it stages, so no run starts over it.
// 'issued' (and every default) means HANDS OFF: that field is not written, the man is exactly what the scenario staged. So with every card as issued, or with
// KIT.on false (?nokit), nothing here touches anybody and a run digests as it did before this file — BAR YOUR OWN FOUR COUNTS UNDER THE POUCHES RULE (10-10,
// the maintainer: "sam also has an unrealistic number of pouches. we should make him symmetric with the team"): you have a teammate's four pouches and are
// issued one of each of your things — a smoke, a stun, a frag, a round of 40 mm — which is fewer than a Player is built with (BUILT below: the plain night
// with no scenario, the harness, a lesson, and your card with the rule off), so a staging under the rule writes your counts onto you (kitPlayer: whatever
// differs from what a Player is built with) and kitShow puts back what he had.
//
// THE BIG SLOT (10-14, the maintainer, over a shot of a Door Kickers 2 loadout card: "we can change the slot system to be like door kickers. you have a single
// big slot on the bottom that can fit larger kit items and then smaller pouches for other stuff" · "i do think we should change the breaching shotgun to not
// take up a primary weapon slot … since its slugs are only effective on door hinges anyways" · "and then we should also add a dynamic hammer"). ONE SWITCH,
// `BIGSLOT.on` — ON in the page (host/profile.ts pageSwitches; `?nobigslot` = the cards as they were), OFF here and on the frozen harness stand
// (`TPS_BIGSLOT=1`; a FROZEN_HOLDS row, in the knob registry and a journal's tables: a recording from before the table replays with it off). With it on:
//   · every man has ONE BIG SLOT beside his pouches (slots.json: `members[].big`, a tool's `"big": true`): the wall charge, the breaching
//     shotgun, the hammer — one of them, on ONE row of his card ('Big slot', the last: the card's bottom), and none of them costs a pouch any more.
//   · THE BREACHING SHOTGUN IS KIT, not a gun: the weapon row offers the rifle and the pistol, and a card (stored, a table's loadout, a mission's issue)
//     that says weapon 'shotgun' is read as the issued gun with the shotgun in the big slot (bigHome). It is a door tool only — bigkit.ts: yours a row
//     of a door locked against you, a teammate's brought up for the lock on a door order and slung again.
//   · THE DYNAMIC HAMMER (`big: 'hammer'`) is kit for the big slot, yours and a teammate's: bigkit.ts.
// Off = the cards, the rows, the prices and the run of the build before: `big` is kept on a card, inert (no row, no price, nothing on the man).
//
// (src/game is one import cycle: the tables below are plain literals; nothing here is built from another game module's exports at module load.)
import { SideMap, SideSet } from '../math/side';
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import { Firearm, Pistol, Rifle, WEAPONS, type WeaponId } from './weapons';
import { gearText } from './gear';   // (a leaf: the kit's names as issued — applied where a row's words are asked for, never as this module loads)
import { HE40 } from './he40';   // (read inside a row's note only: src/game is one import cycle)
import { DOORTOOLS } from './doortools';   // (read inside kitPool only: nothing of it is touched at load)
import { FRAG } from './frag';             // (likewise: read inside kitPool / kitStage only)
import { WallCharge } from './wallcharge';  // (likewise: its prototype is looked at when a row is built or a team staged, never at load — wallHere)
import { quietWand } from './quietfog';   // (called inside kitPlayer only)
import { STICKY, stickyIssue, stickyVisit } from './stickycam';   // (read inside a row's builder, a card's cost and kitPlayer only — never as this module loads)
import { WAND } from './wand';   // (read inside a row's builder, a card's cost and kitPlayer only — never as this module loads)
import { OWNCHARGE } from './owncharge';   // (your own door and wall charges: read inside a row's builder, the squad's count and a staging only — never as this module loads)
import { SQUADSMOKE, squadSmokeStage } from './squadsmoke';   // (read inside a row's note / called inside kitStage only)
import { squad40Stage } from './squad40';   // (called inside kitStage only)
import { loadWear, loadMan } from './kitload';   // (called inside kitPlayer / kitShow / kitStage only)
import { GUNSLOTS, gunPicks, gunsBroken, pickRow, pickWord, sideStage, NO_PRIMARY } from './gunslots';   // (read inside a row's builder, a card's gun and a staging only — never as this module loads)
import slotsData from './slots.json' with { type: 'json' };   // (plain data: no game module is behind it)

export type KitWeapon = 'rifle' | 'pistol' | 'shotgun';
/** (THE BALLISTIC SHIELD IS GONE — the maintainer, 10-15: "we should also probably just get rid of the ballistic shield, doesn't match the vibes (feels more
 *  like swat)", and 10-18: "we should just remove the riot shield". No card has the field. A stored, pasted or taped card that still says `shield` is read
 *  as a card without one: kitSanitize takes only what a row offers, so the next save of the cards writes the word out of the store.) */
/** what rides in a man's big slot that is not a field of its own (the wall charge is `walls`): nothing while BIGSLOT is off */
export type BigKit = 'none' | 'shotgun' | 'hammer';
/** the big slot's row, by what is in it */
export type BigPick = BigKit | 'wall';
export type SuitId = 'issued' | 'black' | 'grey' | 'navy' | 'olive' | 'jungle' | 'khaki' | 'desert';
export type TrimId = 'issued' | 'black' | 'red' | 'blue' | 'green' | 'amber' | 'white';
export type CanMix = 'issued' | 'smoke' | 'even' | 'stun';
/** One member's card. Every field is plain data; the two the squad's orders may want to read are `light` (a weapon light is fitted) and `suppressed`. */
export interface MemberKit {
  weapon: KitWeapon;
  /** the gun in his hands is suppressed (you: always — both of yours are) */
  suppressed: boolean;
  /** a weapon light is fitted (you: always — yours is on its own switch, L) */
  light: boolean;
  /** night-vision goggles are worn (you: always — yours are on N) */
  nvg: boolean;
  /** stun canisters — teammates: what he brings to the squad's count; you: your own (Player.flashbangs) */
  bangs: number;
  /** teammates: the door charges he brings to the squad's count */
  charges: number;
  /** you: your own smoke canisters (Player.canisters). A teammate: the smoke canisters he brings (0 as issued) — the men who come carry the squad's count for
   *  the order 'smoke there' (squadsmoke.ts, kitSmokes below). */
  smoke: number;
  /** fragmentation grenades (frag.ts) — you: on your own belt (digit 5); teammates: what he brings to the squad's count ('frag and clear'). */
  frags: number;
  /** the wall charge: one or none (a teammate's alone, and only in a build whose wall charge counts what the cards carry — wallHere) */
  walls: number;
  /** you: 40 mm grenades for the FN2000's launcher (he40.ts; weapons.ts LAUNCHER40.rounds as issued). Teammates carry none: the field is 0 and has no row. */
  shells: number;
  suit: SuitId; trim: TrimId;
  /** the optical wand rides in a pouch (wand.ts — a look under a shut door before anybody opens it). A teammate's card has the row only under `WAND.mate`, and he uses it only on your order (wandorder.ts); else false, and no row. */
  wand: boolean;
  /** you: sticky cameras for the rifle's launcher (stickycam.ts — each one sent to a wall is one more eye on the fog of war). None as issued; none without the rifle. Teammates carry none: 0, and no row. */
  cams: number;
  /** the big slot's breaching shotgun or hammer (BIGSLOT, bigkit.ts): kit, a door tool — the man keeps his gun. 'none' as issued; inert with the switch off. */
  big: BigKit;
  /** THE TWO GUN SLOTS (gunslots.ts GUNSLOTS): a pick of its table each — the long gun ('none': the sidearm alone) and the sidearm. With the switch on these
   *  are the card's two gun rows and `weapon` follows the primary ('pistol' with none, else 'rifle'); with it off they are carried, inert. */
  primary: string; secondary: string;
}
export const KIT_MEMBERS = 5;
/** the store's key (JSON { v: 2, members: [...] }; v is written for a reader, never read) */
export const KIT_LS = 'twopointsix.kit';

/** what each member is issued: the build before this file. The teammates' stun canisters and charges are the squad's three and two, written down as carried by
 *  the first two men (so the pair and the four both show three and two between them). */
/** … and the frags: your one, and the squad's two carried one each by the first two men (a man alone brings one). Kept beside the table, not in its rows */
const ISSUED_FRAGS = [1, 1, 1, 0, 0];
/** … and the 40 mm rounds: yours alone, one */
const ISSUED_SHELLS = [1, 0, 0, 0, 0];
export const SHELLS_MAX = 4;
/** the most sticky cameras a card of yours holds (stickycam.ts STICKY.carry is the same three, said there for the rifle; STICKY.max is how many WATCH at once) */
export const CAMS_MAX = 3;
/** (YOUR card is the issue UNDER THE POUCHES RULE: a teammate's four pouches, one of each of your four things — slots.json v6. With the rule off your
 *  card as issued is BUILT below: kitDefault) */
const ISSUED: MemberKit[] = ([
  { weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 1, charges: 0, smoke: 1, suit: 'issued', trim: 'issued' },
  { weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 2, charges: 1, smoke: 0, suit: 'issued', trim: 'issued' },
  { weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 1, charges: 1, smoke: 0, suit: 'issued', trim: 'issued' },
  { weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 0, charges: 0, smoke: 0, suit: 'issued', trim: 'issued' },
  { weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 0, charges: 0, smoke: 0, suit: 'issued', trim: 'issued' },
] as Omit<MemberKit, 'frags' | 'shells' | 'walls' | 'wand' | 'cams' | 'big' | 'primary' | 'secondary'>[]).map((m, i) => ({ ...m, frags: ISSUED_FRAGS[i], shells: ISSUED_SHELLS[i], walls: 0, wand: false, cams: 0, big: 'none' as BigKit, primary: 'mk18', secondary: 'g19' }));   // (the two picks in plain words — gunslots.ts PICKS: nothing of that module is read as this one loads)
export const FRAGS_MAX = 3;
/** WHAT A Player IS BUILT WITH (game.ts Player: canisters 4, flashbangs 2 — CAN_MIXES.issued below, the issued split of six —, frags FRAG.issue, the rifle's
 *  LAUNCHER40.rounds; literals here: src/game is one import cycle): the kit of the plain night with no scenario, of the harness and of a Training lesson, and
 *  YOUR CARD AS ISSUED WITH THE POUCHES RULE OFF (the build before the rule, its six cans) — eleven things, where the rule issues you four (ISSUED[0]). */
const BUILT = { smoke: 4, bangs: 2, frags: 2, shells: 3 };
/** your four counted things: the fields of your card the issue differs in, rule on and off */
const COUNTS0 = ['smoke', 'bangs', 'frags', 'shells'] as const;
/** the pouches rule's switch (SLOTS.on below reads and writes it) */
let ruleOn = true;
/** the big slot's switch (BIGSLOT.on below reads and writes it) */
let bigOn = false;
/** what member i is issued as the rule stands: the table above — and you, with the rule off, what a Player is built with */
const issuedCard = (i: number): MemberKit => (i === 0 && !ruleOn ? { ...ISSUED[0], ...BUILT } : ISSUED[i]);
export function kitDefault(i: number): MemberKit { return { ...issuedCard(i) }; }

/** The table. `on` false (?nokit, or by hand) = every man as issued whatever the cards say. */
export const KIT: { on: boolean; members: MemberKit[] } = { on: true, members: ISSUED.map(m => ({ ...m })) };

/** the suit colours (Character.tint — the scale the game's own tints are on: an operative's black is about 0.07) and the trim (tint2: the mannequin's joints) */
export const SUITS: Record<Exclude<SuitId, 'issued'>, { label: string; tint: Vec3 }> = {
  black: { label: 'black', tint: [0.045, 0.05, 0.055] },
  grey: { label: 'urban grey', tint: [0.16, 0.17, 0.18] },
  navy: { label: 'navy', tint: [0.035, 0.055, 0.13] },
  olive: { label: 'olive drab', tint: [0.1, 0.115, 0.055] },
  jungle: { label: 'jungle green', tint: [0.045, 0.11, 0.055] },
  khaki: { label: 'khaki', tint: [0.3, 0.26, 0.17] },
  desert: { label: 'desert tan', tint: [0.4, 0.32, 0.2] },
};
export const TRIMS: Record<Exclude<TrimId, 'issued'>, { label: string; tint: Vec3 }> = {
  black: { label: 'black', tint: [0.03, 0.03, 0.035] },
  red: { label: 'red', tint: [0.55, 0.07, 0.05] },
  blue: { label: 'blue', tint: [0.07, 0.2, 0.6] },
  green: { label: 'green', tint: [0.1, 0.32, 0.18] },
  amber: { label: 'amber', tint: [0.6, 0.38, 0.05] },
  white: { label: 'white', tint: [0.6, 0.6, 0.58] },
};
/** your six canisters as the four fixed splits of the build before the pouches rule: the 'Cans' row while that rule is off, and what a kit saved by that
 *  build ('cans': one of these) is read as */
export const CAN_MIXES: Record<CanMix, { label: string; smoke: number; stun: number }> = {
  issued: { label: '4 smoke, 2 stun', smoke: 4, stun: 2 },
  smoke: { label: '6 smoke, no stun', smoke: 6, stun: 0 },
  even: { label: '3 smoke, 3 stun', smoke: 3, stun: 3 },
  stun: { label: '2 smoke, 4 stun', smoke: 2, stun: 4 },
};
export const BANGS_MAX = 3, CHARGES_MAX = 2, WALLS_MAX = 2;
/** you: the most smoke / stun canisters of your own a ROW can hold (the widest of the four splits of the rule-off build; under the rule the table's most is
 *  lower — four smoke, all your pouches hold — and the rows end there: slotMax) */
export const SMOKE_MAX = 6, STUN_MAX = 4;
/** a teammate: the most smoke canisters on his card (squadsmoke.ts throws them on order) */
export const SMOKE_MATE_MAX = 2;

/** the weapons.ts row a card's two fields name (you: the long gun's row, or the pistol's when that is all you bring) */
export function kitGun(m: MemberKit): WeaponId {
  if (gunsOn()) { const w = pickRow(m.weapon === 'pistol' ? m.secondary : m.primary, m.suppressed); if (w) return w; }   // (gunslots.ts: his primary's row — his sidearm's with no long gun brought)
  return m.weapon === 'shotgun' ? 'm870' : m.weapon === 'rifle' ? (m.suppressed ? 'fn2000' : 'aks74u') : (m.suppressed ? 'fiveseven' : 'guard9mm'); }

/** the card has two gun rows (gunslots.ts GUNSLOTS, on the big slot's card: the shotgun is kit there, never a man's gun) */
const gunsOn = (): boolean => bigOn && GUNSLOTS.on && !gunsBroken();   // (`bigOn` first: false as this module loads, so nothing of gunslots.ts is asked then — slotsCheck below runs homeShells)
/** the gun a card's man carries that is NOT in his hands — his sidearm's row — or null: no long gun brought (the sidearm is his gun), the switch off */
export function kitSide(m: MemberKit): WeaponId | null { return m.weapon === 'pistol' ? null : kitSecond(m); }
/** the row in a card's secondary slot (null with the switch off: the card has no such slot) */
export function kitSecond(m: MemberKit): WeaponId | null { return gunsOn() ? pickRow(m.secondary, m.suppressed) : null; }
/** the gun on member i's row `field` wears a suppressor (the one gun row, or either slot's: both of yours do) */
export function kitRowCan(i: number, m: MemberKit, field: string): boolean { if (field === 'weapon') return kitGunCan(i, m); const w = field === 'primary' ? (m.weapon === 'pistol' ? null : pickRow(m.primary, i === 0 || m.suppressed)) : field === 'secondary' ? pickRow(m.secondary, i === 0 || m.suppressed) : null; return !!w && WEAPONS[w].suppressed; }
/** a card's two picks are ones the table offers. WHETHER a long gun is brought stays where every rule of the build before reads it — `weapon`
 *  ('pistol': none) — so a set, an issue card or a tool that writes that field alone is still right; `primary` only says WHICH long gun. */
const gunsHome = (m: MemberKit): MemberKit => { const long = gunPicks('primary').filter(p => p !== NO_PRIMARY), side = gunPicks('secondary'); if (!long.includes(m.primary)) m.primary = long[0] ?? ''; if (!side.includes(m.secondary)) m.secondary = side[0] ?? ''; return m; };
// ------------------------------------------------------------ the pouches (slots.json: the one place a cost lives)
/** One priced thing as this file runs it, keyed in the table by the CARD'S field ('shotgun' = the weapon row on the M870): what
 *  ONE costs in pouches (whole; 0 = not a pouch at all), the most member i may carry (`max[i]`: the table's, never over the row's own most; 0 = not his to carry), and
 *  the most the teammates may carry between them (`squadMax`). */
export interface SlotItem { id: string; pouches: number; max: number[]; squadMax?: number; /** a big thing: with BIGSLOT on it rides in the big slot and costs no pouch */ big?: boolean }
/** A named loadout of the table, all five cards: per member the counts by card field (a field not named = none of it) and the other rows it sets (raw: read
 *  through the rows, like a stored card). `missing`: its tools this build has no row for (it cannot be put on here). */
export interface SlotLoadout { id: string; name: string; counts: Record<string, number>[]; cards: Record<string, unknown>[]; missing: string[] }
/** The table as it runs. pouches[i]: how many member i has. squad: what the four teammates may fill BETWEEN them (null = no such limit: each man's own
 *  only). unknown: tools priced that this build has no row for (a hammer; the wall charge before the build that has it) — carried, priced for nobody. */
export interface SlotTable { v: number; pouches: number[]; /** big[i]: member i's big slots (BIGSLOT; a table that names none: one each) */ big: number[]; squad: number | null; items: Record<string, SlotItem>; unknown: string[]; loadouts: SlotLoadout[] }
/** slots.json's tool ids → the card's field */
const SLOT_FIELD: Record<string, string> = { smoke: 'smoke', stun: 'bangs', frag: 'frags', shell40: 'shells', doorCharge: 'charges', wallCharge: 'walls', shotgun: 'shotgun', wand: 'wand', stickyCam: 'cams', hammer: 'hammer' };
/** how much of each priced thing a card carries (a count; the shotgun is one or none) */
const SLOT_AMOUNT: Record<string, (m: MemberKit) => number> = {
  smoke: m => m.smoke, bangs: m => m.bangs, frags: m => m.frags, shells: m => m.shells, charges: m => m.charges, walls: m => m.walls,
  shotgun: m => (bigOn ? (m.big === 'shotgun' ? 1 : 0) : m.weapon === 'shotgun' ? 1 : 0),   // (BIGSLOT: the shotgun is what is in the big slot, never the gun)
  hammer: m => (bigOn && m.big === 'hammer' ? 1 : 0),
  cams: m => (m.cams && STICKY.on ? m.cams : 0),   // (sticky cameras, yours alone: nothing while their switch is off — and an issued card carries none, so this table is never asked the switch as the module loads)
  wand: m => (m.wand && WAND.on ? 1 : 0),   // (the optical wand, yours or a teammate's: nothing while its switch is off; a teammate's card carries one only where its row is — kitLoad never reads one onto it otherwise — and an issued card, which carries none, never asks the switch: this table is read as the module loads)
};
/** … and how a card is put to `n` of one (`d` = what he is issued: a shotgun given up is the issued gun again) */
const SLOT_PUT: Record<string, (m: MemberKit, n: number, d: MemberKit) => void> = {
  smoke: (m, n) => { m.smoke = n; }, bangs: (m, n) => { m.bangs = n; }, frags: (m, n) => { m.frags = n; }, shells: (m, n) => { m.shells = n; }, charges: (m, n) => { m.charges = n; }, walls: (m, n) => { m.walls = n; },
  wand: (m, n) => { m.wand = n > 0; }, cams: (m, n) => { m.cams = n; }, shotgun: (m, n, d) => { if (bigOn) { if (n > 0) m.big = 'shotgun'; else if (m.big === 'shotgun') m.big = 'none'; } else if (n > 0) m.weapon = 'shotgun'; else if (m.weapon === 'shotgun') m.weapon = d.weapon; },
  hammer: (m, n) => { if (!bigOn) return; if (n > 0) m.big = 'hammer'; else if (m.big === 'hammer') m.big = 'none'; },
};
/** one of a thing, in a card's words */
const SLOT_WORD: Record<string, string> = { smoke: 'smoke canister', bangs: 'stun canister', frags: 'frag', shells: 'launcher grenade', charges: 'door charge', walls: 'wall charge', shotgun: 'shotgun', wand: 'optical wand', cams: 'sticky camera', hammer: 'hammer' };
/** the most of each a card's row can hold whatever a table says — [you, a teammate]; 0 = no such row on his card. A table's most-a-man is never read above
 *  these (kitPlayer and the rows would not deliver it). */
const OWN_MAX: Record<string, [number, number]> = { smoke: [SMOKE_MAX, SMOKE_MATE_MAX], bangs: [STUN_MAX, BANGS_MAX], frags: [FRAGS_MAX, FRAGS_MAX - 1], shells: [SHELLS_MAX, 0], charges: [CHARGES_MAX, CHARGES_MAX], walls: [WALLS_MAX, WALLS_MAX], shotgun: [1, 1], wand: [1, 1], cams: [CAMS_MAX, 0], hammer: [1, 1] };
/** what an over-budget kit gives up first (kitFitAll) */
const TRIM = ['shells', 'smoke', 'frags', 'charges', 'bangs', 'cams', 'wand', 'walls', 'shotgun', 'hammer'];
/** … and of the big things on a card over its big slot: what the card does NOT show goes first (bigOf: a wall charge before the rest) */
const BIG_TRIM = ['hammer', 'shotgun', 'walls'];
/** which of the table's loadouts a set's counts are: Quiet is its 'quiet', Loud its 'stun' (stun heavy — one more stun canister on every man, the set of the
 *  build before the rule, is no legal fill). A table with no such loadout: the set carries what is issued. */
const SET_LOADOUT: Record<string, string> = { quiet: 'quiet', loud: 'stun' };
/** THE WALL CHARGE IS A ROW ONLY IN A BUILD THAT HAS IT: one whose wall charge takes the number the cards carry (wallcharge.ts WallCharge.setCarried — the
 *  destruction goal's; this file never writes its fields). A test of the code, not a switch: without it there is no row, a stored wall charge is not read,
 *  the table's loadouts that carry one cannot be put on, and nothing is told to the wall charge at staging. (Asked when a row is built or a team staged,
 *  never at load: src/game is one import cycle.) */
export function wallHere(): boolean { return typeof (WallCharge?.prototype as unknown as { setCarried?: unknown } | undefined)?.setCarried === 'function'; }
/** a loadout's tools this build cannot put on: the table's own list, and the wall charge where the build has none */
export function loadoutMissing(L: SlotLoadout): string[] {
  return L.counts.some(c => (c.walls ?? 0) > 0) && !(SLOTS.on && wallHere()) ? [...L.missing, 'wallCharge'] : L.missing;
}   // (…or the rule is off: the wall charge is a thing of the rule, no free row has it)
/** THE RULE. `on` false (?noslots, or by hand) = the free rows of the build before it. `ok` false: slots.json itself was refused at load (`why`) and the rule
 *  cannot run — `on` stays down whatever the URL says. WHAT YOU ARE ISSUED FOLLOWS THE SWITCH (one of each under the rule, BUILT without it), so `on` set by
 *  hand (the harness, a probe, the knobs put back) carries your card across when its four counts are as issued the way the rule stood: as issued stays as
 *  issued, and with the rule off nothing is written onto a Player. A card of your own is left as it is (bar launcher rounds beside no rifle, which the rule
 *  never lets a card hold: homeShells). */
export const SLOTS: { on: boolean; ok: boolean; why: string; table: SlotTable } = {
  get on() { return ruleOn; },
  set on(v: boolean) { if (v === ruleOn) return; const m = KIT.members[0], was = issuedCard(0), same = COUNTS0.every(k => m[k] === was[k]); ruleOn = v; if (same) { const now = issuedCard(0); KIT.members[0] = { ...m, smoke: now.smoke, bangs: now.bangs, frags: now.frags, shells: now.shells }; } if (v) KIT.members[0] = homeShells({ ...KIT.members[0] }); },   // (a fresh card, as kitLoad makes: one somebody holds is never changed under him. Switched ON, the launcher's rounds go home with the rifle — kitFitAll's first line: a pistol card carried across would else hold a round the rule calls illegal)
  ok: true, why: '', table: { v: 1, pouches: [], big: [], squad: null, items: {}, unknown: [], loadouts: [] } };
/** THE BIG SLOT (the head of this file). `on` set by hand (the page's boot, the harness, the panel, the knobs put back) carries the cards in memory across:
 *  switched ON, a card whose gun is the shotgun gets its issued gun back with the shotgun in the big slot, and a man over his one big slot gives up what
 *  does not fit (bigHome, kitFitAll); switched OFF nothing is written — `big` stays on the card, inert. The hammer's and the kit shotgun's numbers
 *  (bigkit.ts reads them): `swings` blows of the hammer take a lock where the frame holds a boot (one blow where a boot would do), one every `swing` seconds, the first after `windup`; `draw` seconds bring the
 *  shotgun up off its sling before a shell goes; `shells` YOUR shotgun may put into one lock before you give it up. */
/** `shut` (the maintainer, 10-15, having played it: "ah these things should work for unlocked doors too" · "helps also not be directly in front of the door
 *  when opening"): the two tools open ANY shut door that is not steel — a row of yours on an unlocked one beside 'push it open', a teammate's entry order
 *  begun with it — and the door ENDS OPEN from either face (from the face it opens toward the hand that broke the latch pulls it). `beside`: your tool is
 *  worked from beside the latch jamb, out of the opening, wherever there is floor for it (a teammate's always was). Each off = the build of 10-14. */
/** `moves` (the maintainer, 10-15, with Door Kickers 2 footage: "i think the dynamic hammer and shotgun animations / pathing need some work" · "using the
 *  hammer shouldn't require being directly in front of the door?" · "the character should have a hammer on their back, they put away their gun, equip the
 *  hammer, wind up, and then hit the door in one motion"): the tool is CARRIED where it can be seen (the hammer on a man's back), a man's own gun is put
 *  away for it, `equip` seconds bring it into his hands (as he walks onto his spot), the blow is one wound-up swing and `stow` seconds put it back; you
 *  take the row from `reach` metres of the door — where a stack stands — and WALK to a free place beside either jamb (bigkit.ts samBigSpot), never
 *  slid there and never square in the opening while there is floor beside it. Off = the build of 10-15 morning.
 *  `snug` (with the moves): his own gun and the tool each stay IN A HAND while they are off him (character.ts BIGMOVE.snug — the animator is told by the
 *  beat's record). Off = the first-pass shares: the tool drawn part way between his back and a fist that had left, his rifle carried toward his shoulder. */
export const BIGSLOT: { on: boolean; swings: number; swing: number; windup: number; draw: number; shells: number; shut: boolean; beside: boolean; moves: boolean; snug: boolean; weight: boolean; equip: number; stow: number; reach: number; heft: number; equipW: number; drawW: number; stowW: number; flow: number } = {
  get on() { return bigOn; },
  set on(v: boolean) { if (v === bigOn) return; bigOn = v; rowCache.clear(); if (!v) return; for (let i = 0; i < KIT_MEMBERS; i++) KIT.members[i] = bigHome({ ...KIT.members[i] }, i); if (ruleOn && SLOTS.ok) kitFitAll(KIT.members, SLOTS.table, team); },
  swings: 2, swing: 0.7, windup: 0.45, draw: 0.5, shells: 2, shut: true, beside: true, moves: true, snug: true, weight: true, equip: 0.6, stow: 0.45, reach: 2.4, heft: 0.7, equipW: 0.8, drawW: 0.7, stowW: 0.75, flow: 0.2 };   // (`weight`, with the moves: the tool changes hands with the weight of a gun swap — bigkit.ts bigEquip / bigStow: `equipW` / `drawW` / `stowW` s in place of equip / draw / stow, your own gun carried to its place by hand first, and the hammer's wind-up begun `flow` s before the hammer is fully out)   // (`heft`: the hammer's wind-up WITH the moves on, s — the swing is drawn, and wants the footage's anticipation: the hammer held up, clear of him, before it comes down; `windup` is the one with them off)
/** A CARD AS THE BIG SLOT READS IT (only ever called with the switch on): the shotgun is no gun — a card whose weapon row says so (a stored kit, a
 *  table's loadout, a mission's issue block, a probe's hand) is the issued gun, with the shotgun in his big slot unless a wall charge is
 *  already there. */
function bigHome(m: MemberKit, i: number): MemberKit {
  m.big ??= 'none';   // (a card from a hand that knew no big slot)
  if (m.weapon === 'shotgun') { m.weapon = ISSUED[i].weapon; if (!m.walls && m.big === 'none') m.big = 'shotgun'; }
  return m;
}
/** what is in the big slot of a card, as its row words it (BIGSLOT) */
export const bigOf = (m: MemberKit): BigPick => (m.walls ? 'wall' : m.big ?? 'none');   // (a card from a hand that knew no big slot: empty)
/** the pouches ONE of an item fills as the rule stands: a big thing none while it rides in the big slot */
const priceOf = (it: SlotItem | undefined): number => (!it || (bigOn && it.big) ? 0 : it.pouches);
/** how many big things a card carries (0 with the big slot off: there they are pouches) */
function bigUsed(m: MemberKit, t: SlotTable): number { if (!bigOn) return 0; let n = 0; for (const k of Object.keys(SLOT_AMOUNT)) if (t.items[k]?.big) n += SLOT_AMOUNT[k](m); return n; }
const int = (x: unknown, lo: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo;
const pouchWords = (n: number) => (n === 1 ? 'a pouch' : `${n} pouches`);
const kindOf = (i: number) => (i === 0 ? 'you' : 'mate');
/** THE LAUNCHER'S ROUNDS GO HOME WITH THE RIFLE (the table's rule: a count is charged whatever else is on the card, so under the pouches rule a card with no
 *  FN2000 carries none — the row comes to 0 when the rifle goes, and is refused a round until it is back). Only ever called with the rule on. */
/** your card's long gun has the launcher under it (the 40 mm rounds and the cameras go by its tube): the rifle — and, under the two gun slots, a primary
 *  whose row has one (weapons.ts `launcher`: the issue carbine alone) */
const tubed = (m: MemberKit): boolean => m.weapon === 'rifle' && !(gunsOn() && WEAPONS[pickRow(m.primary, true) ?? 'fn2000'].launcher === false);
const homeShells = (m: MemberKit): MemberKit => { if (!tubed(m)) { m.shells = 0; if (m.cams && STICKY.on) m.cams = 0; /* (the cameras go by the same tube; with their switch off the count is inert and kept — and an issued card carries none, so the switch is never asked as this module loads: slotsCheck below runs then) */ } return m; };
/** the pouches a card fills */
function costOf(m: MemberKit, t: SlotTable): number { let used = 0; for (const k of Object.keys(SLOT_AMOUNT)) used += SLOT_AMOUNT[k](m) * priceOf(t.items[k]); return used; }
/** HOW MANY TEAMMATES COME (members 1..team): the men the squad's pouches are counted over — the table's rule. Four until somebody says otherwise (the
 *  loadout screen, as its size is stepped: kitTeam); a read of the store is always held to all four, so a stored kit is legal at any size. */
let team = KIT_MEMBERS - 1;
/** the teammates who come, of five cards */
const coming = (cards: MemberKit[], n: number) => cards.slice(1, 1 + n);
/** THE SQUAD'S KIT IS DEALT OVER THE MEN WHO COME (the maintainer, 10-18, over a team of four as issued: "as issued still has blue team pretty empty").
 *  The issued kit and every named squad kit are written down as the first two teammates carry them, so with three or four coming the others stood there with
 *  a gun and four empty pouches. On: while the teammates' counted small things (door charges, stun, frags, smoke) ARE the issue's or a named kit's, a team of
 *  three or four WEARS them shared out — one at a time to the man with the fewest, a man without that thing first, Red and Blue by turns — so each pair has a
 *  charge and a stun of its own. THE TABLE'S CARDS ARE NEVER REWRITTEN FOR IT: KIT.members and the store stay in the table's layout, and the deal is how they
 *  are worn (kitWorn: what the roster and a card show, and the card a staged man carries). What the squad carries between them is a sum over the men who come
 *  (kitPool), whoever holds what, so a run is the run it was. A change of one of those counts on a teammate's card is made to the cards AS WORN, and they
 *  are then cards of the player's own, kept as they stand at every size (onWorn); any other row — a gun, a look, your own card — leaves the layout alone.
 *  The big things, the wand, the guns and the looks stay on the man the kit names. Off (the module, the frozen stand; `?nokitdeal` in the page,
 *  TPS_KITDEAL=1 raises it headless) = every card shown and staged as the table writes it. */
export const KITDEAL = { on: false };
/** `KITDEAL_BREAK=1` (the check's): the deal hands every thing back to the men the table names */
const DEAL_BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.KITDEAL_BREAK ?? '') === '1'; } catch { return false; } })();
/** what is dealt, in the order it is handed out · who is handed to, in turn (Red One, Blue One, Red Two, Blue Two) */
const DEALT = ['charges', 'bangs', 'frags', 'smoke'] as const, DEAL_TURN = [1, 3, 2, 4];
const dealing = (): boolean => KITDEAL.on && ruleOn && KIT.on;
/** the teammates' counted things, as one word · the issue's and every named kit's, in the table's layout (made once a table) */
const dealWord = (cards: MemberKit[]) => cards.slice(1).map(c => DEALT.map(k => c[k]).join(',')).join('|');
let dealKits: { t: SlotTable; kits: MemberKit[][]; words: Set<string> } | null = null;
function dealTable(): { kits: MemberKit[][]; words: Set<string> } {
  const t = SLOTS.table;
  if (dealKits?.t !== t) { const kits = [ISSUED, ...t.loadouts.map(L => ISSUED.map((m, i) => ({ ...m, ...Object.fromEntries(DEALT.map(k => [k, L.counts[i][k] ?? 0])) })))]; dealKits = { t, kits, words: new Set(kits.map(dealWord)) }; }
  return dealKits;
}
const dealNamed = (cards: MemberKit[]): boolean => dealTable().words.has(dealWord(cards));
/** Five cards as `n` teammates carry them: the same things among the men who come, shared out (fewer than three: as they are; a thing with no room
 *  anywhere: as they are). The sum over the men who come is the sum it was, whatever the cards. */
function deal(cards: MemberKit[], t: SlotTable, n: number): MemberKit[] {
  if (n < 3 || DEAL_BREAK) return cards;
  const out = cards.map(c => ({ ...c })), men = DEAL_TURN.filter(i => i <= n), bag: (typeof DEALT[number])[] = [];
  for (const k of DEALT) for (const i of men) { for (let c = out[i][k]; c > 0; c--) bag.push(k); out[i][k] = 0; }
  const load = (i: number) => DEALT.reduce((x, k) => x + out[i][k], 0);   // (what he has been handed: nothing else of his card moves the deal, so a gun or a big thing changed on one card never shuffles the others)
  for (const k of bag) {
    const can = men.filter(i => out[i][k] < (t.items[k]?.max[i] ?? Infinity) && costOf(out[i], t) + priceOf(t.items[k]) <= t.pouches[i]); if (!can.length) return cards;
    const to = can.reduce((a, b) => (load(b) < load(a) || (load(b) === load(a) && !out[b][k] && out[a][k] > 0) ? b : a));
    out[to][k]++;
  }
  return out;
}
/** THE FIVE CARDS AS THE TEAM WEARS THEM: the table's cards, or — the deal on, three or four coming, the counted things a named kit's — those shared out.
 *  The same array when nothing is dealt. */
export function kitWorn(n = team, cards: MemberKit[] = KIT.members): MemberKit[] { return dealing() && n >= 3 && !(dealOwn && cards === KIT.members) && dealNamed(cards) ? deal(cards, SLOTS.table, n) : cards; }
/** THE TABLE'S CARDS ARE THE PLAYER'S OWN LAYOUT: a counted thing was changed by hand on a team of three or four, so the cards are worn as written even where
 *  they come to read as a named kit's (Blue One's last canister given up on purpose is not the Quiet kit to share out again). Kept with the store; dropped when
 *  a squad kit is put on by name, the cards are reset, or they settle back into a kit (dealSettle). */
let dealOwn = false;
/** … read, or put back as a recording had it (runtape.ts: who wears what moves a run once a card weighs — kitload.ts) */
export function kitOwn(v?: boolean): boolean { if (v !== undefined) dealOwn = v; return dealOwn; }
/** member i's card as he wears it (what the roster and his card show) · and what he is issued, as he would wear that */
export function kitShown(i: number): MemberKit { return kitWorn()[i]; }
export function kitIssuedShown(i: number, n = team): MemberKit { return i > 0 && dealing() && n >= 3 ? deal(ISSUED.map((_m, j) => ({ ...issuedCard(j) })), SLOTS.table, n)[i] : { ...issuedCard(i) }; }   // (`n`: the men who come — a staging's own count, kitload.ts)
/** A CARD IS READ AND CHANGED AS IT IS WORN. `f` runs with the worn cards standing in the table (a teammate's card, while they are dealt), nothing written to
 *  the store. A peek puts the table back. A change that was TAKEN (`taken`) is kept one of two ways: it moved a counted thing — the worn cards are now the
 *  player's own and stay in the table as they stand; or it moved something else (a gun, a look, a big thing) — that is written onto the table's own cards and
 *  their layout stays, so a smaller team still carries the whole kit. Cards of the player's own that come to WEAR as a named kit does (every man put back on
 *  his share) are that kit again, in the table's layout (dealSettle). */
function onWorn<T>(i: number, f: () => T, taken?: (r: T) => boolean): T {
  const w = i > 0 ? kitWorn() : KIT.members;
  if (w === KIT.members) {
    if (!(i > 0 && dealing() && team >= 3)) return f();
    const word = dealWord(KIT.members), s = store; store = null; let r: T; try { r = f(); } finally { store = s; }   // (cards already the player's own, or no kit's: one write, after the mark below)
    if (taken?.(r)) { if (dealWord(KIT.members) !== word) dealOwn = true; if (!dealSettle()) kitSave(); }
    return r;
  }
  const was = KIT.members.slice(), s = store, back = () => { for (let j = 1; j < KIT_MEMBERS; j++) KIT.members[j] = was[j]; store = s; };
  for (let j = 1; j < KIT_MEMBERS; j++) KIT.members[j] = { ...w[j] }; store = null;
  let r: T; try { r = f(); } catch (e) { back(); throw e; }
  if (!taken?.(r)) { back(); return r; }
  store = s;
  if (KIT.members.some((c, j) => j > 0 && DEALT.some(k => c[k] !== w[j][k]))) { dealOwn = true; if (!dealSettle()) kitSave(); }
  else {   // (nothing counted moved: the change goes onto the table's layout — unless it costs a pouch that man's card has not got there, and then the worn cards are kept, as a counted change keeps them)
    const laid = KIT.members.map((c, j) => (j ? { ...c, ...Object.fromEntries(DEALT.map(k => [k, was[j][k]])) } : c));
    if (illegal(laid, SLOTS.table) === null) for (let j = 1; j < KIT_MEMBERS; j++) KIT.members[j] = laid[j]; else dealOwn = true;
    kitSave();
  }
  return r;
}
/** … true: the cards were put back in a named kit's layout, and kept */
function dealSettle(): boolean {
  if (!dealing() || team < 3 || (dealNamed(KIT.members) && !dealOwn)) return false;
  const laid = (kit: MemberKit[]) => KIT.members.map((c, j) => (j ? { ...c, ...Object.fromEntries(DEALT.map(k => [k, kit[j][k]])) } : c));
  const kit = dealTable().kits.map(laid).find(cards => illegal(cards, SLOTS.table) === null && dealWord(deal(cards, SLOTS.table, team)) === dealWord(KIT.members)); if (!kit) return false;   // (…a layout a man's other things leave room for: a wand on Red One and the table's full card are a pouch too many)
  for (let j = 1; j < KIT_MEMBERS; j++) KIT.members[j] = kit[j]; dealOwn = false; kitSave(); return true;
}
/** the pouches the teammates who come fill between them · how many of one thing they carry */
const squadUsed = (cards: MemberKit[], t: SlotTable, n: number) => coming(cards, n).reduce((s, c) => s + costOf(c, t), 0);
const squadHas = (cards: MemberKit[], k: string, n: number) => coming(cards, n).reduce((s, c) => s + SLOT_AMOUNT[k](c), 0);
/** Why five cards are not a legal squad of `n` teammates under a table, or null: each man inside his own pouches and no row over its most-a-man; the cards
 *  of the teammates who come together inside the squad's, and no tool over its most-a-squad. (n = all four: legal at every size.) */
function illegal(cards: MemberKit[], t: SlotTable, n = KIT_MEMBERS - 1): string | null {
  if (cards[0].shells > 0 && cards[0].weapon !== 'rifle') return gearText('member 0 carries launcher grenades and no FN2000 to fire them');
  for (let i = 0; i < KIT_MEMBERS; i++) {
    for (const k of Object.keys(SLOT_AMOUNT)) { const most = t.items[k]?.max[i] ?? Infinity, has = SLOT_AMOUNT[k](cards[i]); if (has > most) return `member ${i} carries ${has} of "${t.items[k].id}", over the most he may (${most})`; }
    const used = costOf(cards[i], t); if (used > t.pouches[i]) return `member ${i} needs ${used} pouches and has ${t.pouches[i]}`;
    const bigs = bigUsed(cards[i], t); if (bigs > (t.big[i] ?? 1)) return `member ${i} carries ${bigs} big things and has ${t.big[i] ?? 1} big slot${(t.big[i] ?? 1) === 1 ? '' : 's'}`;
  }
  const squad = squadUsed(cards, t, n); if (t.squad !== null && squad > t.squad) return `the teammates together need ${squad} pouches and the squad has ${t.squad}`;
  for (const [k, it] of Object.entries(t.items)) { const has = squadHas(cards, k, n); if (it.squadMax !== undefined && has > it.squadMax) return `the teammates carry ${has} of "${it.id}", over the most a squad may (${it.squadMax})`; }
  return null;
}
/** member i's card as a set makes it under a table (null: the rule off — the set of the build before it) */
function setCard(i: number, p: KitPreset, t: SlotTable | null): MemberKit {
  return t && i > 0 && dealing() ? deal(ISSUED.map((_m, j) => setCardBase(j, p, t)), t, team)[i] : setCardBase(i, p, t);
}
/** … in the pair's layout (what the table says; KITDEAL shares it out over a bigger team) */
function setCardBase(i: number, p: KitPreset, t: SlotTable | null): MemberKit {
  const d = kitDefault(i);
  if (p === 'quiet') Object.assign(d, i === 0 ? { weapon: 'pistol', smoke: CAN_MIXES.smoke.smoke, bangs: CAN_MIXES.smoke.stun, suit: 'black', trim: 'black' } : { weapon: 'pistol', suppressed: true, light: false, nvg: true, suit: 'black', trim: 'black' });
  if (p === 'loud') Object.assign(d, i === 0 ? { weapon: 'rifle', smoke: CAN_MIXES.stun.smoke, bangs: CAN_MIXES.stun.stun, suit: 'olive', trim: 'amber' } : { weapon: 'rifle', suppressed: false, light: true, nvg: true, bangs: Math.min(BANGS_MAX, d.bangs + 1), suit: 'olive', trim: 'amber' });
  if (!t || p === 'issued') return d;
  // under the rule the set's guns and looks are the above; what fills his pouches is the table's loadout of that name — or, with none, the issued kit
  const L = t.loadouts.find(l => l.id === SET_LOADOUT[p] && !l.missing.length);
  for (const k of ['smoke', 'bangs', 'frags', 'shells', 'charges']) SLOT_PUT[k](d, L ? L.counts[i][k] ?? 0 : SLOT_AMOUNT[k](ISSUED[i]), ISSUED[i]);
  return homeShells(d);
}
/** slots.json made safe to run, or the reason it cannot be: its shape (the balance part's: members[].pouches, squad.pouches, tools[] with id / pouches / who /
 *  maxPerMan / maxPerSquad / inBuild, loadouts[]), every number whole — and the rules of the balance this file leans on: every ISSUED card a legal fill
 *  (so the rule moves nothing in a run until a card is changed), and the two sets legal fills for all five. */
function slotsCheck(raw: unknown): { table: SlotTable } | { why: string } {
  const r = raw as { v?: unknown; members?: unknown; squad?: { pouches?: unknown } | null; tools?: unknown; loadouts?: unknown; issued?: { members?: unknown } } | null; if (!r || typeof r !== 'object') return { why: 'not a table' };
  if (!Array.isArray(r.members)) return { why: '"members" is missing' };
  const pouches: number[] = [], big: number[] = [];
  for (let i = 0; i < KIT_MEMBERS; i++) { const m = (r.members as { i?: unknown; pouches?: unknown; big?: unknown }[]).find(x => x && x.i === i); if (!m || !int(m.pouches, 0)) return { why: `"members" gives member ${i} his pouches, a whole number (0 = you, 1 to 4 the teammates)` }; pouches.push(m.pouches);
    if (m.big !== undefined && !int(m.big, 0)) return { why: `"members" gives member ${i} his big slots, a whole number` }; big.push(m.big ?? 1); }   // (a table from before the big slot: one each)
  const sq = r.squad?.pouches; if (sq !== undefined && sq !== null && !int(sq, 0)) return { why: '"squad.pouches" is a whole number, or null for no squad limit' };
  if (!Array.isArray(r.tools)) return { why: '"tools" is missing' };
  const items: Record<string, SlotItem> = {}, unknown: string[] = [];
  for (const t of r.tools as { id?: unknown; pouches?: unknown; who?: unknown; maxPerMan?: Record<string, unknown>; maxPerSquad?: unknown; inBuild?: unknown; big?: unknown }[]) {
    if (!t || typeof t.id !== 'string' || !int(t.pouches, 0)) return { why: 'every tool has an "id" and "pouches", a whole number each' };
    const f = SLOT_FIELD[t.id]; if (!f || (t.inBuild === false && f !== 'walls')) { unknown.push(t.id); continue; }   // (the wall charge: the BUILD says whether it is here — wallHere — not the file)
    const who = Array.isArray(t.who) ? t.who : ['you', 'mate'], mx = t.maxPerMan ?? {};
    for (const k of ['you', 'mate']) if (mx[k] !== undefined && !int(mx[k], 0)) return { why: `tool "${t.id}": "maxPerMan.${k}" is a whole number` };
    if (t.maxPerSquad !== undefined && !int(t.maxPerSquad, 0)) return { why: `tool "${t.id}": "maxPerSquad" is a whole number` };
    items[f] = { id: t.id, pouches: t.pouches, max: Array.from({ length: KIT_MEMBERS }, (_x, i) => { const own = OWN_MAX[f][i ? 1 : 0], most = mx[kindOf(i)] as number | undefined; return who.includes(kindOf(i)) ? Math.min(own, most ?? own) : 0; }), ...(t.maxPerSquad !== undefined ? { squadMax: t.maxPerSquad } : {}), ...(t.big === true ? { big: true } : {}) };
  }
  if (!(r.tools as { big?: unknown }[]).some(t => t.big !== undefined)) for (const f of BIG_TRIM) if (items[f]) items[f].big = true;   // (a table from before the big slot marks nothing big: the four things the slot is for are)
  const absent = Object.keys(SLOT_FIELD).filter(id => !items[SLOT_FIELD[id]] && id !== 'wallCharge' && id !== 'wand' && id !== 'stickyCam' && id !== 'hammer'); /* (a table from before the wall charge, the optical wand, the sticky cameras or the hammer prices none: no row) */ if (absent.length) return { why: `"tools" does not price ${absent.join(', ')}: every tool this build carries has a price (0 = not a pouch)` };
  const loadouts: SlotLoadout[] = [];
  for (const L of (Array.isArray(r.loadouts) ? r.loadouts : []) as { id?: unknown; name?: unknown; members?: unknown; cards?: Record<string, unknown> }[]) {
    if (!L || typeof L.id !== 'string' || !Array.isArray(L.members)) return { why: 'every loadout has an "id" and "members": a card of counts for each of the five' };
    const out: SlotLoadout = { id: L.id, name: typeof L.name === 'string' ? L.name : L.id, counts: [], cards: [], missing: [] };
    for (let i = 0; i < KIT_MEMBERS; i++) {
      const c: Record<string, number> = {};
      for (const [id, n] of Object.entries((L.members[i] ?? {}) as Record<string, unknown>)) { if (!int(n, 0)) return { why: `loadout "${L.id}", member ${i}: "${id}" is a whole number` }; const f = SLOT_FIELD[id]; if (f && items[f]) c[f] = n; else if (n > 0 && !out.missing.includes(id)) out.missing.push(id); }
      const card = L.cards?.[String(i)]; out.counts.push(c); out.cards.push(card && typeof card === 'object' ? card as Record<string, unknown> : {});
    }
    loadouts.push(out);
  }
  const table: SlotTable = { v: typeof r.v === 'number' ? r.v : 1, pouches, big, squad: sq ?? null, items, unknown, loadouts };
  // the table's own account of the issued kit, where it gives one, is this build's (a table balanced against another kit is not this one's)
  if (Array.isArray(r.issued?.members)) for (let i = 0; i < KIT_MEMBERS; i++) for (const [id, f] of Object.entries(SLOT_FIELD)) {
    const says = (r.issued.members[i] as Record<string, unknown> | undefined)?.[id] ?? 0, has = SLOT_AMOUNT[f](ISSUED[i]); if (says !== has) return { why: `"issued" gives member ${i} ${String(says)} of "${id}" and this build issues him ${has}` }; }
  // (… BOTH WAYS THE BIG SLOT STANDS: the switch moves no run until a card is changed either)
  const was = bigOn; try { for (const way of [false, true]) { bigOn = way; const word = way ? ' with the big slot on' : '';
    const bad = illegal(ISSUED, table); if (bad) return { why: `${bad}: the issued kit must stay a legal fill${word}` };
    for (const p of ['quiet', 'loud'] as const) { const why = illegal(ISSUED.map((_m, i) => setCardBase(i, p, table)), table); if (why) return { why: `the ${p} set (loadout "${SET_LOADOUT[p]}") is not a legal fill${word}: ${why}` }; } } } finally { bigOn = was; }
  return { table };
}
/** the pouches `n` of one item fill (0 for an item the table does not price) */
export function slotCost(item: string, n: number, t: SlotTable = SLOTS.table): number { return Math.max(0, n) * priceOf(t.items[item]); }
/** Member i's pouches: used of total, and what fills them, a line per thing carried. */
export function kitCost(i: number, m: MemberKit = kitShown(i)): { used: number; total: number; free: number; lines: { item: string; n: number; pouches: number }[]; /** his big slot (BIGSLOT): filled of how many — null with the switch off */ big: { used: number; total: number } | null } {
  const lines: { item: string; n: number; pouches: number }[] = [];
  for (const k of Object.keys(SLOT_AMOUNT)) { const n = SLOT_AMOUNT[k](m), p = slotCost(k, n); if (p) lines.push({ item: k, n, pouches: p }); }
  const used = costOf(m, SLOTS.table), total = SLOTS.table.pouches[i] ?? 0; return { used, total, free: total - used, lines, big: bigOn ? { used: bigUsed(m, SLOTS.table), total: SLOTS.table.big[i] ?? 1 } : null };
}
/** The pouches the teammates who come (kitTeam) fill between them, used of the squad's total; null while the rule is off or the table sets no squad limit. */
export function squadCost(cards: MemberKit[] = KIT.members, n = team): { used: number; total: number; free: number } | null {
  const total = SLOTS.table.squad; if (!SLOTS.on || total === null) return null;
  const used = squadUsed(cards, SLOTS.table, n); return { used, total, free: total - used };
}
/** why the five cards as they stand are not a legal squad of the team that comes under the table in force, or null (a probe's and the page hook's question;
 *  the rule keeps it null) */
export function kitLegal(cards: MemberKit[] = KIT.members, n = team): string | null { return illegal(cards, SLOTS.table, n); }
/** How many teammates come: asked, or SET (the loadout screen, as its size is stepped; 0 = you alone). A team that grew may find the men who now come over
 *  the squad's pouches between them (the cards were cut for a smaller one): they are brought back inside — the last man who added something gives it up
 *  first — and his card says what was left behind. Nothing is written to the store until a row is next changed. */
export function kitTeam(n?: number): number {
  if (n === undefined) return team;
  team = Math.min(KIT_MEMBERS - 1, Math.max(0, Math.round(n)));
  if (SLOTS.on) kitFitAll(KIT.members, SLOTS.table, team).forEach((left, i) => { if (left.length) KIT_NOTE[i] = `${SLOTS.table.squad !== null ? 'No room in the squad\'s pouches' : 'More than a squad may carry'} with this team: ${left.join(', ')} left behind.`; });   // (a table with no squad limit: only a tool's most-a-squad can be over)
  return team;
}
/** the table's tools this build has no row for (carried, priced for nobody) */
export function slotsUnknown(): string[] { return [...SLOTS.table.unknown, ...(SLOTS.table.items.walls && !wallHere() ? ['wallCharge'] : [])]; }
/** the most of a counted row member i may carry: the table's while the rule is on, else (and where the table names none) the row's own */
function slotMax(item: string, i: number, own: number): number { return (SLOTS.on ? SLOTS.table.items[item]?.max[i] : undefined) ?? own; }
/** the wall charge has a row on member i's card: the rule on, a build that counts it (wallHere), a table that prices it and lets him carry one */
const wallRow = (i: number) => SLOTS.on && wallHere() && (i > 0 || OWNCHARGE.on) && (SLOTS.table.items.walls?.max[i] ?? 0) > 0 && (!bigOn || (SLOTS.table.big[i] ?? 1) > 0);   // (yours: only with your own charges switched on — owncharge.ts)
/** door charges have a row on member i's card: a teammate's always; YOURS with your own charges switched on (owncharge.ts) and, under the pouches rule, a
 *  table that lets you carry one */
const chargeRow = (i: number) => i > 0 || (OWNCHARGE.on && slotMax('charges', 0, CHARGES_MAX) > 0);
/** the optical wand has a row on a card: its switch on (wand.ts) — for a teammate's card `WAND.mate` too — and, under the pouches rule, a table that prices it and lets that man carry one */
const wandRow = (i = 0) => WAND.on && (i === 0 || WAND.mate) && (!SLOTS.on || (SLOTS.table.items.wand?.max[i] ?? 0) > 0);   // (a teammate's: only under WAND.mate — he looks on your order alone, wandorder.ts)
/** the sticky cameras have a row on YOUR card: their switch on (stickycam.ts) and, under the pouches rule, a table that prices them and lets you carry one */
const camRow = () => STICKY.on && (!SLOTS.on || (SLOTS.table.items.cams?.max[0] ?? 0) > 0);
/** Five cards brought inside the rule for a squad of `n` teammates (all four: legal at any size), in place: a row over its most comes down to it; a man
 *  over his pouches gives up, in TRIM's order, one at a time of what his card ADDED over his issued kit; then, while the teammates who come are together over
 *  the squad's (or a tool over its most-a-squad), the LAST of them who added something gives one up. Nothing a man is issued is ever taken (bar your launcher rounds on a card with no FN2000 to fire them: homeShells, first of all), and the issued kit
 *  is a legal fill, so this always ends inside the rule. Returns, per member, what was left behind, in words. Cards already inside come back as they were. */
function kitFitAll(cards: MemberKit[], t: SlotTable = SLOTS.table, n = KIT_MEMBERS - 1): string[][] {
  const before = cards.map(c => ({ ...c })), amt = (k: string, i: number) => SLOT_AMOUNT[k](cards[i]), over = (k: string, i: number) => amt(k, i) > SLOT_AMOUNT[k](ISSUED[i]);
  const less = (k: string, i: number) => SLOT_PUT[k](cards[i], amt(k, i) - 1, ISSUED[i]);
  homeShells(cards[0]);   // (a kit saved with the rule off, or by a build before it: launcher rounds beside a pistol)
  if (bigOn) cards.forEach((c, i) => bigHome(c, i));   // (BIGSLOT: a card whose gun is the shotgun — a kit saved by the build before, a probe's hand)
  const give = (i: number): boolean => { const k = TRIM.find(x => priceOf(t.items[x]) > 0 && over(x, i)); if (k) less(k, i); return !!k; };
  /** … and of his big things, while he carries more than his big slot holds (BIGSLOT: a stored wall charge beside a hammer, two wall charges) */
  const giveBig = (i: number): boolean => { const k = BIG_TRIM.find(x => !!t.items[x]?.big && over(x, i)); if (k) less(k, i); return !!k; };
  for (let i = 0; i < KIT_MEMBERS; i++) {
    for (const k of TRIM) { const most = t.items[k]?.max[i] ?? Infinity; while (amt(k, i) > most && over(k, i)) less(k, i); }
    while (costOf(cards[i], t) > t.pouches[i] && give(i)) { /* one fewer */ }
    while (bigUsed(cards[i], t) > (t.big[i] ?? 1) && giveBig(i)) { /* one fewer */ }
  }
  const lastGives = (can: (i: number) => boolean) => { for (let i = n; i >= 1; i--) if (can(i)) return true; return false; };
  while (t.squad !== null && squadUsed(cards, t, n) > t.squad && lastGives(give)) { /* one fewer */ }
  for (const [k, it] of Object.entries(t.items)) while (it.squadMax !== undefined && squadHas(cards, k, n) > it.squadMax && lastGives(i => { if (!over(k, i)) return false; less(k, i); return true; })) { /* one fewer */ }
  return cards.map((c, i) => Object.keys(SLOT_AMOUNT).map(k => { const n = SLOT_AMOUNT[k](before[i]) - SLOT_AMOUNT[k](c); return n > 0 ? (k === 'shotgun' || k === 'wand' || k === 'hammer' ? `the ${SLOT_WORD[k]}` : `${n} ${SLOT_WORD[k]}${n === 1 ? '' : 's'}`) : ''; }).filter(Boolean));
}
/** Swap the table (the balance's numbers, a probe's): null = taken, else why not — a table that makes an issued card illegal is refused whole and the one in
 *  force stands. The cards in memory are brought inside the new rule (not written to the store until a row is next changed). */
export function slotsSet(raw: unknown): string | null {
  const c = slotsCheck(raw); if ('why' in c) return c.why;
  SLOTS.table = c.table; SLOTS.ok = true; SLOTS.why = ''; rowCache.clear();
  if (SLOTS.on) kitFitAll(KIT.members, c.table, team);
  return null;
}
/** Why member i's card may not become `m` with the other four as they stand, in the card's words — or null: it may (always null while the rule is off).
 *  Only what the change ADDS is ever the reason: a card already over (a table swapped under it) can still be stepped down. The squad's pouches are the
 *  teammates' who come (kitTeam): a man who does not is held by his own only. */
function cardWhy(i: number, m: MemberKit): string | null {
  if (!SLOTS.on) return null;
  if (i === 0 && !tubed(m) && (m.shells > KIT.members[0].shells || (STICKY.on && m.cams > KIT.members[0].cams))) return gearText(m.weapon === 'rifle' ? `no launcher under the ${pickWord(m.primary)} to fire them: the ${pickWord(gunPicks('primary')[0])} has one` : 'no FN2000, no launcher to fire them: take the rifle first');
  const t = SLOTS.table, now = kitCost(i), then = kitCost(i, m), need = then.used - now.used, more = (k: string) => SLOT_AMOUNT[k](m) - SLOT_AMOUNT[k](KIT.members[i]);
  for (const [k, it] of Object.entries(t.items)) if (more(k) > 0 && SLOT_AMOUNT[k](m) > it.max[i]) return it.max[i] ? `${it.max[i]} ${SLOT_WORD[k]}${it.max[i] === 1 ? '' : 's'} is the most ${i ? 'he' : 'you'} may carry` : `the ${SLOT_WORD[k]} is not ${i ? 'his' : 'yours'} to carry`;
  if (need > 0 && then.used > then.total) return `needs ${pouchWords(need)}, ${now.free > 0 ? `only ${now.free} free` : 'none free'} (${now.used} of ${now.total} full): give something up first`;
  if (then.big && now.big && then.big.used > now.big.used && then.big.used > then.big.total) return `${i ? 'his' : 'your'} big slot is full: one big thing to a man`;
  if (i === 0 || i > team) return null;
  const sq = squadCost(); if (sq && need > 0 && sq.used + need > sq.total) return `needs ${pouchWords(need)}, the squad has ${sq.free > 0 ? `only ${sq.free} free` : 'none free'} (${sq.used} of ${sq.total} full): take something off a teammate first`;
  for (const [k, it] of Object.entries(t.items)) {
    const all = squadHas(KIT.members, k, team);
    if (it.squadMax !== undefined && more(k) > 0 && all + more(k) > it.squadMax) return `${it.squadMax === 1 ? 'one' : it.squadMax} ${SLOT_WORD[k]}${it.squadMax === 1 ? '' : 's'} to a squad, and a teammate carries ${it.squadMax === 1 ? 'it' : 'them'}`;
  }
  return null;
}
/** the five cards of one of the table's named loadouts ('issued': what is issued), or why they cannot be had here. The rows a loadout does not name are as
 *  issued; the looks (suit, trim) are not a loadout's: `looks` hands each card's on. */
function loadoutCards(id: string, looks?: MemberKit[]): MemberKit[] | string {
  const wear = (c: MemberKit, i: number) => { if (looks) { c.suit = looks[i].suit; c.trim = looks[i].trim; } return c; };
  if (id === 'issued') return ISSUED.map((_m, i) => wear(kitDefault(i), i));
  const L = SLOTS.table.loadouts.find(l => l.id === id); if (!L) return `no loadout "${id}" in the table (${SLOTS.table.loadouts.map(l => l.id).join(', ') || 'it names none'})`;
  const missing = loadoutMissing(L); if (missing.length) return `loadout "${id}" carries ${missing.join(', ')}, which this build has no row for`;
  const cards = ISSUED.map((_m, i) => { const c = kitSanitize(i, L.cards[i]); for (const k of Object.keys(SLOT_AMOUNT)) SLOT_PUT[k](c, L.counts[i][k] ?? 0, ISSUED[i]); return wear(c, i); });
  return illegal(cards, SLOTS.table) ?? cards;
}
/** Put one of the table's named loadouts on all five cards — or 'issued', the issued kit — keeping each man's colours (the tallies; the loadout screen's
 *  squad kit row): null = done and kept, else why not — no such loadout, a tool of it this build has no row for, or (a table edited by hand) not a legal fill. */
export function kitLoadout(id: string): string | null {
  const cards = loadoutCards(id, KIT.members); if (typeof cards === 'string') return cards;
  for (let i = 0; i < KIT_MEMBERS; i++) { KIT.members[i] = cards[i]; KIT_NOTE[i] = ''; } dealOwn = false; kitSave(); return null;
}
/** the squad kits a press can put on, in the order the screen lists them: as issued, then the table's loadouts this build can carry (none while the rule is off) */
export function kitLoadouts(): { id: string; name: string }[] {
  return [{ id: 'issued', name: 'As issued' }, ...(SLOTS.on ? SLOTS.table.loadouts.filter(L => !loadoutMissing(L).length && typeof loadoutCards(L.id) !== 'string').map(L => ({ id: L.id, name: L.name })) : [])];
}
/** which of them the five cards are now, colours aside (null: a mix of your own) */
export function kitLoadoutOf(): string | null {
  const same = (id: string) => { const cards = loadoutCards(id, KIT.members); return typeof cards !== 'string' && cards.every((c, i) => JSON.stringify(c) === JSON.stringify({ ...c, ...KIT.members[i] })); };
  if (dealOwn && dealing() && team >= 3) return null;   // (cards of the player's own layout are no named kit on a team that would wear one shared out)
  return kitLoadouts().find(l => same(l.id))?.id ?? null;
}

// ------------------------------------------------------------ the rows of a card (what ui/kitCard.ts draws and a probe steps: no DOM here)
/** a row's key: the card's field it is — or 'cans', the one row that is two fields (your canisters as a fixed split, while the pouches rule is off) */
export type KitField = keyof MemberKit | 'cans';
type KitValue = string | number | boolean;
export interface KitRow {
  field: KitField; label: string;
  /** the values A / D step through, in order */
  values: KitValue[];
  /** a value in the card's words */
  word(v: KitValue, m?: MemberKit): string;
  /** what the value now set changes in the run, in a line */
  note(m: MemberKit): string;
  /** the slots table's item this row spends pouches on (absent: the row is not a pouch) */
  item?: string;
  /** a row that is not one field of the card reads and writes it itself ('cans') */
  get?(m: MemberKit): KitValue; set?(m: MemberKit, v: KitValue): void;
}
/** a row's value on a card */
export function rowGet(r: KitRow, m: MemberKit): KitValue { return r.get ? r.get(m) : (m as unknown as Record<string, KitValue>)[r.field]; }
function rowSet(r: KitRow, m: MemberKit, v: KitValue) { if (r.set) r.set(m, v); else (m as unknown as Record<string, KitValue>)[r.field] = v; if (SLOTS.on && r.field === 'weapon') homeShells(m); }
const yesNo = (yes: string, no: string) => (v: KitValue) => (v ? yes : no);
const upTo = (max: number) => Array.from({ length: max + 1 }, (_x, n) => n);
const GUN_NOTE: Record<WeaponId, string> = {
  fn2000: 'FN2000: small flash, but every 5.56 is heard as gunfire',
  aks74u: 'AKS-74U: bursts, a bright flash, tracers, the hard report',
  fiveseven: 'Five-seveN: the one gun the floor does not hear as gunfire',
  guard9mm: '9 mm service pistol: loud, single shots',
  m870: 'M870: no suppressor fits it — every shell is heard as gunfire',
  ak74m: '', akms: '',
  // (gunslots.ts: what each pick is FOR, and its price, in a line)
  mk12: 'Mk 12: holds its group across a yard · single shots, slow to come round, no launcher',
  mp7: 'MP7: the floor does not hear it as gunfire · no reach past a room, no launcher',
  mk46: 'Mk 46: a hundred on the belt to hold a lane · slow to come round, long to reload, no launcher',
  m1014: 'M1014: a room, as fast as the trigger is pulled · opens no lock, no reach, no launcher',
  hk45: 'HK45: the quietest gun there is · a short magazine, a slower hand',
  g18: 'Glock 18: a long magazine on automatic · loud, and it climbs',
};
/** the four guns in a card's words */
const GUN_SHORT: Record<WeaponId, string> = { fn2000: 'FN2000', aks74u: 'AKS-74U', fiveseven: 'Five-seveN', guard9mm: '9 mm pistol', m870: 'M870 shotgun', ak74m: '', akms: '', mk12: 'Mk 12', mp7: 'MP7', mk46: 'Mk 46', m1014: 'M1014', hk45: 'HK45', g18: 'Glock 18' };
const suitRow: KitRow = { field: 'suit', label: 'Suit', values: ['issued', ...Object.keys(SUITS)], word: v => v === 'issued' ? 'as issued' : SUITS[v as Exclude<SuitId, 'issued'>].label, note: () => 'looks only: nobody sees a colour' };
const trimRow: KitRow = { field: 'trim', label: 'Trim', values: ['issued', ...Object.keys(TRIMS)], word: v => v === 'issued' ? 'as issued' : TRIMS[v as Exclude<TrimId, 'issued'>].label, note: m => m.trim === 'issued' ? 'the pair colour on a four (red, blue)' : 'the joints: how you tell him from above' };
/** your guns row in the card's words · what the shotgun changes in a run, in a line (yours and a teammate's) */
const YOU_GUNS: Record<KitWeapon, string> = { rifle: 'FN2000 + Five-seveN', pistol: 'Five-seveN only', shotgun: 'M870 shotgun + Five-seveN' };
/** …and where the card shows the suppressor (ui/kitCard.ts KIT_CAN): the pistol carried alone is named for what it is — the one gun the floor does not hear as
 *  gunfire. The rifle's line stays as it is: suppressed too (its can is drawn), and heard as gunfire all the same. */
const YOU_GUNS_CAN: Partial<Record<KitWeapon, string>> = { pistol: 'Suppressed Five-seveN' };
export function youGunsCan(v: KitValue): string | null { const w = YOU_GUNS_CAN[v as KitWeapon]; return w ? gearText(w) : null; }
/** the gun in member i's hands wears a suppressor (weapons.ts `suppressed`): both of yours whatever the card's field says (no row of your card writes it, and
 *  the game hands you the suppressed pair), a teammate's by his Suppressor row, never the shotgun */
export function kitGunCan(i: number, m: MemberKit): boolean { return i === 0 ? m.weapon !== 'shotgun' : WEAPONS[kitGun(m)].suppressed; }
const SHOTGUN_NOTE = 'drops a man across a room, poor down a corridor; shoots a lock off its door';
/** the split of six a card's two canister counts are, if they are one */
const mixOf = (m: MemberKit): CanMix | null => (Object.keys(CAN_MIXES) as CanMix[]).find(k => CAN_MIXES[k].smoke === m.smoke && CAN_MIXES[k].stun === m.bangs) ?? null;
/** YOUR CANISTERS WITH THE POUCHES RULE OFF: the one row of the build before it — four fixed splits of six. (A card whose counts are no split — set under
 *  the rule — reads 'your own split' until the row is stepped onto one.) */
const cansRow: KitRow = { field: 'cans', label: 'Cans', values: ['issued', 'smoke', 'even', 'stun'], word: v => (Object.hasOwn(CAN_MIXES, String(v)) ? CAN_MIXES[v as CanMix].label : 'your own split'), note: () => 'six pouches: smoke to hide in, stun to blind a room',   // (the rule-off build's words, held by the rows fixture: six cans, where the rule gives you four pouches)
  get: m => mixOf(m) ?? 'own', set: (m, v) => { if (Object.hasOwn(CAN_MIXES, String(v))) { const x = CAN_MIXES[v as CanMix]; m.smoke = x.smoke; m.bangs = x.stun; } } };
/** … and with it on: two counted rows, pouches like the rest (also what a stored card's two counts are checked against whichever way the rule stands) */
const youCanRows = (): KitRow[] => [
  { field: 'smoke', item: 'smoke', label: 'Smoke canisters', values: upTo(slotMax('smoke', 0, SMOKE_MAX)), word: v => String(v), note: m => m.smoke ? 'on 3: a cloud to cross a lane in, or to leave a room under' : 'none: nothing to hide in' },
  { field: 'bangs', item: 'bangs', label: 'Stun canisters', values: upTo(slotMax('bangs', 0, STUN_MAX)), word: v => String(v), note: m => m.bangs ? 'on 4: blinds a room before you go in' : 'none of your own: the squad\'s are on the door tools' },
];
/** THE CHARGES' ROWS, the same two on every card that has them — a teammate's always, yours with your own charges switched on (owncharge.ts): what a man
 *  carries goes into the squad's one count, whoever's hands set one (kitPool, kitWalls). A wall charge is a COUNT since the one-a-squad limit went (the
 *  maintainer, 10-12: "we should just remove the max one wall charge per squad limitation. maybe we can say that it takes up two slots"): two pouches each. */
function chargeRows(i: number): KitRow[] {
  return [
    ...(chargeRow(i) ? [{ field: 'charges', item: 'charges', label: 'Door charges', values: upTo(slotMax('charges', i, CHARGES_MAX)), word: (v: KitValue) => String(v), note: () => 'added to the squad count the door tools spend' } as KitRow] : []),
    ...(wallRow(i) && !bigOn ? [{ field: 'walls', item: 'walls', label: 'Wall charges', values: upTo(slotMax('walls', i, WALLS_MAX)), word: (v: KitValue) => String(v), note: (m: MemberKit) => m.walls ? 'a door through a wall, where one is set' : 'none: in by the doors' } as KitRow] : []),
  ];
}
/** THE BIG SLOT'S ROW (BIGSLOT), the last of a man's card: ONE of the big things, or none — the breaching shotgun, the hammer, a wall charge where his card
 *  could carry one (wallRow). A row of choices over two fields of the card (`big`, `walls`): whatever it is set to,
 *  the other is cleared, so no step of it can put two big things on a man. Not a pouch: it has no `item` and no price. */
const BIG_WORD: Record<BigPick, string> = { none: 'empty', shotgun: 'breaching shotgun', hammer: 'dynamic hammer', wall: 'wall charge' };
const BIG_NOTE: Record<BigPick, [you: string, mate: string]> = {
  none: ['', ''],
  shotgun: ['shoots a lock off · heard as gunfire', 'shoots a lock off · heard as gunfire'],
  hammer: ['breaks a lock from either side · loud, not gunfire', 'breaks a lock from either side · loud, not gunfire'],
  wall: ['a door through a wall, where one is set', 'a door through a wall, where one is set'],
};
function bigRow(i: number): KitRow {
  const can = (k: string) => (SLOTS.on ? SLOTS.table.items[k]?.max[i] ?? 0 : OWN_MAX[k][i ? 1 : 0]) > 0 && (!SLOTS.on || (SLOTS.table.big[i] ?? 1) > 0);
  const values: BigPick[] = ['none', ...(can('shotgun') ? ['shotgun' as const] : []), ...(can('hammer') ? ['hammer' as const] : []), ...(wallRow(i) ? ['wall' as const] : [])];
  return { field: 'big', label: 'Big slot', values, word: v => BIG_WORD[v as BigPick] ?? String(v), note: m => BIG_NOTE[bigOf(m)][i ? 1 : 0],
    get: m => bigOf(m), set: (m, v) => { m.walls = v === 'wall' ? 1 : 0; m.big = v === 'shotgun' || v === 'hammer' ? v : 'none'; } };
}
function buildRows(i: number): KitRow[] {
  if (bigOn) return gunsOn() ? buildRowsGuns(i) : buildRowsBig(i);
  if (i === 0) return [
    { field: 'weapon', item: 'shotgun', label: 'Guns', values: ['rifle', 'pistol', 'shotgun'], word: v => gearText(YOU_GUNS[v as KitWeapon]),
      note: m => m.weapon === 'rifle' ? 'the rifle is heard as gunfire; the pistol is not' : (m.weapon === 'shotgun' ? SHOTGUN_NOTE : gearText('no rifle, no ring launcher: nothing you fire reads as gunfire')) + (SLOTS.on ? ' · the 40 mm rounds stay home with the rifle' : '') },
    ...(SLOTS.on ? youCanRows() : [cansRow]),
    { field: 'frags', item: 'frags', label: 'Frag grenades', values: upTo(slotMax('frags', 0, FRAGS_MAX)), word: v => String(v), note: m => m.frags ? 'on 5, then a click: kills what it has a line to — you included' : 'none on your belt' },
    { field: 'shells', item: 'shells', label: '40 mm grenades', values: upTo(slotMax('shells', 0, SHELLS_MAX)), word: v => String(v),
      note: m => !tubed(m) ? gearText(SLOTS.on ? 'no FN2000, no launcher: none carried, and no pouch spent on them' : 'no FN2000, no launcher: these stay home') : m.shells ? '2 again with the rifle up, then the right button: a frag\'s blast where it lands, past ' + HE40.armM + ' m' : gearText('none for the launcher: rings only') },
    ...chargeRows(0),
    ...(camRow() ? [{ field: 'cams', item: 'cams', label: 'Sticky cameras', values: upTo(slotMax('cams', 0, CAMS_MAX)), word: (v: KitValue) => String(v),
      note: (m: MemberKit) => !tubed(m) ? gearText('no FN2000, no launcher: these stay home') : m.cams ? '2 again with the rifle up, then the right button: it sticks where it lands and watches' : 'none for the launcher' } as KitRow] : []),
    ...(wandRow() ? [{ field: 'wand', item: 'wand', label: 'Optical wand', values: [false, true], word: yesNo('carried', 'none'),
      note: (m: MemberKit) => m.wand ? 'at a shut door, Space: a look under it' : 'none in your pouches' } as KitRow] : []),
    suitRow, { ...trimRow, note: m => m.trim === 'issued' ? 'your own green joints' : 'the joints: how you pick yourself out from above' },
  ];
  return [
    { field: 'weapon', item: 'shotgun', label: 'Weapon', values: ['rifle', 'pistol', 'shotgun'], word: v => String(v), note: m => kitGun(m) === 'm870' ? SHOTGUN_NOTE : WEAPONS[kitGun(m)].name },
    { field: 'suppressed', label: 'Suppressor', values: [true, false], word: yesNo('on', 'off'), note: m => gearText(GUN_NOTE[kitGun(m)]) },
    { field: 'light', label: 'Weapon light', values: [true, false], word: yesNo('fitted', 'none'), note: m => m.light ? 'burns when the light rule or the fight wants it' : m.nvg ? 'never lit: nothing gives him away, and black rooms stay black' : 'no light and no goggles: he sees by the room alone' },
    { field: 'nvg', label: 'Night vision', values: [true, false], word: yesNo('goggles', 'none'), note: m => m.nvg ? 'goes dark with you, sees through the tube' : m.light ? 'bare eyes: his light does the seeing' : 'bare eyes, no light' },
    { field: 'bangs', item: 'bangs', label: 'Stun canisters', values: upTo(slotMax('bangs', i, BANGS_MAX)), word: v => String(v), note: () => 'added to the squad count the door tools spend' },
    ...(slotMax('smoke', i, SMOKE_MATE_MAX) > 0 ? [{ field: 'smoke', item: 'smoke', label: 'Smoke canisters', values: upTo(slotMax('smoke', i, SMOKE_MATE_MAX)), word: v => String(v), note: m => m.smoke ? `added to the squad's smoke: X on a spot of floor, then ${SQUADSMOKE.orderKey.replace(/^Key/, '')} — the nearest man with a throw tosses one there` : 'none: the squad has no smoke to throw on order' } as KitRow] : []),   // (no row on a table that gives a teammate none)
    ...chargeRows(i),
    { field: 'frags', item: 'frags', label: 'Frag grenades', values: upTo(slotMax('frags', i, FRAGS_MAX - 1)) /* (a teammate: one fewer than you may carry) */, word: v => String(v), note: () => 'added to the squad count: frag and clear, on the door tools' },
    ...(wandRow(i) ? [{ field: 'wand', item: 'wand', label: 'Optical wand', values: [false, true], word: yesNo('carried', 'none'),
      note: (m: MemberKit) => m.wand ? `X on a shut door, then ${WAND.orderKey.replace(/^Key/, '')}: he looks under it` : 'none in his pouches' } as KitRow] : []),   // (wandorder.ts: used on your order, never by himself)
    suitRow, trimRow,
  ];
}
/** THE ROWS WITH THE BIG SLOT ON: the build before's (buildRows above, asked with the switch held off for the length of the call — every row of it is
 *  written against that) with the shotgun off the weapon row, no wall charge row, and the big slot's one row as the last of the card. */
function buildRowsBig(i: number): KitRow[] {
  bigOn = false; let rows: KitRow[]; try { rows = buildRows(i); } finally { bigOn = true; }
  rows = rows.filter(r => r.field !== 'walls').map(r => {
    if (r.field !== 'weapon') return r;
    const { item: _item, ...gun } = r;   // (no price: the gun row is not the shotgun's shells any more)
    return { ...gun, values: ['rifle', 'pistol'], note: (m: MemberKit) => (i === 0 ? (m.weapon === 'rifle' ? 'the rifle is heard as gunfire; the pistol is not' : gearText('no rifle, no ring launcher: nothing you fire reads as gunfire') + (SLOTS.on ? ' · the 40 mm rounds stay home with the rifle' : '')) : WEAPONS[kitGun(m)].name) };
  });
  rows.push(bigRow(i));   // (the last row, under the two colours: the card's bottom — where the keys and the eye both end)
  return rows;
}
/** THE ROWS WITH THE TWO GUN SLOTS ON (gunslots.ts GUNSLOTS): the big slot's card with its one gun row parted in two — Primary (a long gun of the table, or
 *  none) and Secondary (a sidearm) — where it stood. Each is a row of choices over its own field (get / set: `weapon` is written with the primary, so every
 *  rule of the build before still reads what it read). */
function buildRowsGuns(i: number): KitRow[] {
  const can = (m: MemberKit) => (i === 0 ? true : m.suppressed);   // (you: both of yours wear one — no row of your card writes it)
  const row = (m: MemberKit, f: 'primary' | 'secondary') => pickRow(m[f], can(m));
  const primary: KitRow = { field: 'primary', label: 'Primary', values: gunPicks('primary'), word: (v, m) => gearText(pickWord(v, m ? can(m) : true)),
    note: m => { const w = m.weapon === 'pistol' ? null : row(m, 'primary'); return w ? gearText(GUN_NOTE[w] || WEAPONS[w].name) : gearText(i === 0 ? 'no long gun, no launcher: nothing you fire reads as gunfire' + (SLOTS.on ? ' · the 40 mm rounds stay home with it' : '') : 'no long gun: his sidearm is his gun'); },
    get: m => (m.weapon === 'pistol' ? NO_PRIMARY : gunsHome(m).primary), set: (m, v) => { if (v === NO_PRIMARY) m.weapon = 'pistol'; else { m.primary = String(v); m.weapon = 'rifle'; } if (SLOTS.on) homeShells(m); } };
  const secondary: KitRow = { field: 'secondary', label: 'Secondary', values: gunPicks('secondary'), word: (v, m) => gearText(pickWord(v, m ? can(m) : true)),
    note: m => { const w = row(m, 'secondary'); return w ? gearText(w === 'fiveseven' ? 'Five-seveN: the floor does not hear it as gunfire' /* (not 'the one gun' any more: the row beside it offers two others) */ : GUN_NOTE[w] || WEAPONS[w].name) : ''; },
    get: m => gunsHome(m).secondary, set: (m, v) => { m.secondary = String(v); } };
  return buildRowsBig(i).flatMap(r => (r.field === 'weapon' ? [primary, secondary] : [r]));
}
/** (built once per member, per way the rule stands, per table: a counted row's values are the table's `max`) */
const rowCache = new Map<string, KitRow[]>();
/** the rows of member i's card, top to bottom */
export function kitRows(i: number): KitRow[] { const key = `${i}:${SLOTS.on}:${wallHere()}:${WAND.on}:${WAND.mate}:${OWNCHARGE.on}:${STICKY.on}:${bigOn}:${gunsOn()}`; let r = rowCache.get(key); if (!r) rowCache.set(key, r = buildRows(i)); return r; }
/** What a row costs member i's pouches as his card stands, and its rate in plain words ('a pouch each', 'the wand takes 2 pouches') — null for a row
 *  that is not a pouch (a light, a colour; a shotgun while the table prices it at nothing), and for every row while the rule is off. */
export function kitRowCost(i: number, r: KitRow, m: MemberKit = kitShown(i)): { pouches: number; rate: string } | null {
  const it = r.item ? SLOTS.table.items[r.item] : undefined; if (!SLOTS.on || !r.item || !it || !priceOf(it)) return null;
  const p = it.pouches, rate = r.item === 'wand' ? `the wand takes ${pouchWords(p)}` : r.item === 'shotgun' ? `the shotgun's shells take ${pouchWords(p)}` : p === 1 ? 'a pouch each' : `${p} pouches each`;
  return { pouches: slotCost(r.item, SLOT_AMOUNT[r.item](m)), rate };
}
/** who the card is for: 'You', or the callsigns the man in that place answers to (the four's, and the pair's where he is one of it) */
export function kitName(i: number): { title: string; sub: string } {
  if (i === 0) return { title: 'You', sub: 'point man' };
  const four = ['Red One', 'Red Two', 'Blue One', 'Blue Two'][i - 1], pair = ['Blue One', 'Blue Two'][i - 1];
  return { title: `Teammate ${i}`, sub: pair ? `${four} · ${pair} in a pair` : four };
}
/** a card in a line: 'AKS-74U · no light · goggles · 2 stun, 1 charge, 1 frag · olive drab'. Under the pouches rule the line names what fills a pouch — frags too, and your 40 mm
 *  rounds (none without the rifle: homeShells) — so its counts add up to the pouches shown beside it; with the rule off it is the line the build before had (no frags, no 40 mm: the rows fixture holds it) */
export function kitWords(i: number): string {
  const m = kitShown(i), look = [m.suit !== 'issued' ? SUITS[m.suit].label : '', m.trim !== 'issued' ? `${TRIMS[m.trim].label} trim` : ''].filter(Boolean).join(', ');
  const frags = SLOTS.on && m.frags ? `, ${m.frags} frag${m.frags === 1 ? '' : 's'}` : '';
  if (i === 0) return [gunsOn() ? (m.weapon === 'pistol' ? `${gearText(pickWord(m.secondary))} only` : `${gearText(pickWord(m.primary))} + ${gearText(pickWord(m.secondary))}`) : gearText(YOU_GUNS[m.weapon]), `${m.smoke || 'no'} smoke, ${m.bangs || 'no'} stun${frags}${SLOTS.on && m.shells ? `, ${m.shells}\u00a0×\u00a040\u00a0mm` /* (no-break spaces: the count never parts from '40 mm' where the strip wraps the line) */ : ''}${chargeRow(0) && m.charges ? `, ${m.charges} charge${m.charges === 1 ? '' : 's'}` : ''}${m.cams && camRow() ? `, ${m.cams}\u00a0cam${m.cams === 1 ? '' : 's'}` : ''}${m.wand && wandRow() ? ', wand' : ''}`, wallWords(0, m), bigWords(m), look].filter(Boolean).join(' · ');
  return [gearText(GUN_SHORT[kitGun(m)]) + (kitSide(m) ? ` + ${gearText(GUN_SHORT[kitSide(m)!])}` : ''), m.light ? 'light' : 'no light', m.nvg ? 'goggles' : 'no goggles', `${m.bangs} stun, ${m.charges} charge${m.charges === 1 ? '' : 's'}${frags}${m.smoke ? `, ${m.smoke} smoke` : ''}`, wallWords(i, m), bigWords(m), look].filter(Boolean).join(' · ');
}
/** the big slot's shotgun or hammer of a card's line (BIGSLOT; the wall charge has its own words) */
function bigWords(m: MemberKit): string { return bigOn && !m.walls && m.big !== 'none' ? BIG_WORD[m.big] : ''; }
/** the wall charges of a card's line: 'wall charge', '2 wall charges', or nothing (none carried, or no such row on his card) */
function wallWords(i: number, m: MemberKit): string { return m.walls && wallRow(i) ? (m.walls === 1 ? 'wall charge' : `${m.walls} wall charges`) : ''; }
/** member i's card differs from what he is issued (only the rows his card has) */
export function kitChanged(i: number): boolean { const m = kitShown(i), d = kitIssuedShown(i); return kitRows(i).some(r => rowGet(r, m) !== rowGet(r, d)); }

/** why member i's card with one row set to `v` is refused — no room in his pouches, or in the squad's — or null: it fits (always null while the rule is off) */
function overWhy(i: number, row: KitRow, v: KitValue): string | null { if (!SLOTS.on) return null; const m = { ...KIT.members[i] }; rowSet(row, m, v); return cardWhy(i, m); }
/** a row of member i's card by its key — your canister rows of the OTHER way the rule stands too (a caller, or a card on the page, from before a switch) */
function rowOf(i: number, field: KitField): KitRow | undefined { return kitRows(i).find(r => r.field === field) ?? (i === 0 ? [cansRow, ...youCanRows()].find(r => r.field === field) : undefined); }
/** What a step of one row of member i's card WOULD do, nothing written: the value it lands on — the next (dir +1) or the last (−1), wrapping — or, when that
 *  has no room in the pouches, `why` and the value as it stands. A COUNTED row is simply refused one more; stepped down off none it comes round to the most
 *  that fits. A row of CHOICES (a weapon) walks on past a choice with no room to the next that has, and says what it passed (`passed`). */
export function kitPeek(i: number, field: KitField, dir: 1 | -1): { value: KitValue; why: string; passed: string } { return onWorn(i, () => peek(i, field, dir)); }
function peek(i: number, field: KitField, dir: 1 | -1): { value: KitValue; why: string; passed: string } {
  const row = rowOf(i, field); if (!row) throw new Error(`kit: member ${i} has no '${field}' row`);
  const cur = rowGet(row, KIT.members[i]), n = row.values.length, at = Math.max(0, row.values.indexOf(cur)), counted = typeof row.values[0] === 'number';
  let why = '', passed = '';
  for (let k = 1; k < n; k++) {
    const to = row.values[(((at + dir * k) % n) + n) % n], w = overWhy(i, row, to);
    if (!w) return { value: to, why: '', passed };
    if (counted && dir < 0 && at === 0) { why = w; continue; }   // (down off none: on to the most that fits; with nothing fitting, the reason is one's)
    why ||= w; if (counted) break;
    passed ||= `${row.word(to)}: ${w}`;
  }
  return { value: cur, why, passed: '' };
}
/** Step one row of member i's card; kept. `ok` false: refused (`why`), nothing written. `passed`: a choice the step walked past, and why. */
export function kitTry(i: number, field: KitField, dir: 1 | -1): { ok: boolean; value: KitValue; why: string; passed: string } {
  return onWorn(i, () => {
    const p = peek(i, field, dir); if (p.why) return { ok: false, ...p };
    rowSet(rowOf(i, field)!, KIT.members[i], p.value); KIT_NOTE[i] = ''; kitSave();
    return { ok: true, ...p };
  }, r => r.ok);
}
/** Step one row of member i's card to its next (dir +1) or last (−1) value, wrapping; kept. Returns the value the row now has (a step that would not fit his
 *  pouches is refused and the value is the one it had: kitTry says why). */
export function kitStep(i: number, field: KitField, dir: 1 | -1): KitValue { return kitTry(i, field, dir).value; }
/** Set one row outright (a click on a value); refused — false — for a value the row does not offer, or one his pouches have no room for. ('cans', a split of
 *  six by name, is taken for your card whichever way the rule stands: what the build before it called the row.) */
export function kitSet(i: number, field: KitField, v: KitValue): boolean { return onWorn(i, () => setRow(i, field, v), ok => ok); }
function setRow(i: number, field: KitField, v: KitValue): boolean {
  if (bigOn && (field === 'walls' || (field === 'weapon' && v === 'shotgun'))) {   // (BIGSLOT: a hand that still names the rows of the build before — a tool, a tally — is given the one big row)
    const now = bigOf(KIT.members[i]), mine: BigPick = field === 'walls' ? 'wall' : 'shotgun';
    return setRow(i, 'big', v ? mine : now === mine ? 'none' : now); }
  if (field === 'weapon' && gunsOn() && (v === 'rifle' || v === 'pistol')) return setRow(i, 'primary', v === 'pistol' ? NO_PRIMARY : gunsHome(KIT.members[i]).primary);   // (GUNSLOTS: the same for the one gun row — a long gun or none)
  const row = rowOf(i, field); if (!row || !row.values.includes(v)) return false;
  if (overWhy(i, row, v)) return false;
  rowSet(row, KIT.members[i], v); KIT_NOTE[i] = ''; kitSave(); return true;
}

/** The sets (the MGSV spirit: one press, a whole man): as issued · quiet (suppressed pistols, no white light, goggles, dark clothes — nothing the floor hears as
 *  gunfire) · loud (the bare carbine, a light, the door kit, and no pretending). Looks ride along; the rows stay his to change after. */
export type KitPreset = 'issued' | 'quiet' | 'loud';
export const KIT_PRESETS: { id: KitPreset; label: string; line: string }[] = [
  { id: 'issued', label: 'As issued', line: 'the build as it was' },
  { id: 'quiet', label: 'Quiet set', line: 'suppressed pistol, no white light, black' },
  { id: 'loud', label: 'Loud set', line: 'bare carbine, light, more stun' },
];
/** member i's card as a set makes it. Under the pouches rule its guns and looks are the set's and what fills his pouches is the table's loadout of that
 *  name (Quiet: 'quiet'; Loud: 'stun', stun heavy), a legal fill for all five together — slotsCheck holds the table to it. */
export function kitPresetCard(i: number, p: KitPreset): MemberKit { return setCard(i, p, SLOTS.on ? SLOTS.table : null); }
/** Put a set on member i's card; kept. `ok` false: refused (`why`), nothing written — the squad's pouches have no room for it as the other cards stand (a
 *  teammate's card holds what this one gave up; kitPresetAll puts a set on everybody at once and is never refused). */
export function kitPreset(i: number, p: KitPreset): { ok: boolean; why: string } {
  return onWorn(i, () => {
    const c = kitPresetCard(i, p), why = cardWhy(i, c); if (why) return { ok: false, why };
    KIT.members[i] = c; KIT_NOTE[i] = ''; kitSave(); return { ok: true, why: '' };
  }, r => r.ok);
}
/** why a press of a set on member i's card would be refused as the cards stand ('' = it would be taken) */
export function kitPresetWhy(i: number, p: KitPreset): string { return onWorn(i, () => cardWhy(i, kitPresetCard(i, p)) ?? ''); }
/** a set on all five at once (always a legal fill) */
export function kitPresetAll(p: KitPreset) { for (let i = 0; i < KIT_MEMBERS; i++) { KIT.members[i] = setCardBase(i, p, SLOTS.on ? SLOTS.table : null); KIT_NOTE[i] = ''; } dealOwn = false; kitSave(); }   // (the table's layout: KITDEAL shares it out as it is worn)
/** which set member i's card is, if it is exactly one */
export function kitPresetOf(i: number): KitPreset | null {
  const m = kitShown(i);
  return KIT_PRESETS.find(p => { const c = kitPresetCard(i, p.id); return kitRows(i).every(r => rowGet(r, c) === rowGet(r, m)); })?.id ?? null;
}

/** `KITPASTE_BREAK=1` (the check's): a paste writes the copied card as it is, unfitted and unasked */
const PASTE_BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.KITPASTE_BREAK ?? '') === '1'; } catch { return false; } })();
/** COPY AND PASTE (the maintainer, 10-15: "we should have copy and paste for loadouts"; ui/kitCard.ts holds the copied card and draws the two buttons).
 *  Member i's card as another man's card makes it: every ROW of his own card takes the copied card's value where his row offers it, a count over his row's
 *  most comes down to it, and a row that cannot show the copied value at all (your cans as one of four splits, the pouches rule off)
 *  keeps what it had. His colours stay his own, as under a squad kit: the trim is how the men are told apart from above. A field his card has no row
 *  for is never written, so the card is one his own tiles could have made. */
export function kitPasteCard(i: number, from: MemberKit): MemberKit {
  const m = { ...kitShown(i) };
  if (PASTE_BREAK) return { ...from, suit: m.suit, trim: m.trim };
  for (const r of kitRows(i)) {
    if (r.field === 'suit' || r.field === 'trim') continue;
    const v = rowGet(r, from);
    if (r.values.includes(v)) rowSet(r, m, v);
    else if (typeof v === 'number' && typeof r.values[0] === 'number') rowSet(r, m, Math.max(...(r.values as number[]).filter(x => x <= v), r.values[0]));
  }
  return SLOTS.on ? homeShells(m) : m;
}
/** the rows of member i's card that read differently on two cards of his */
const rowsMoved = (i: number, a: MemberKit, b: MemberKit): KitField[] => kitRows(i).filter(r => rowGet(r, a) !== rowGet(r, b)).map(r => r.field);
/** What a paste of `from` onto member i's card WOULD do, nothing written: the card it would make, the rows of his it would move (none: he wears it
 *  already) and why it would be refused as the cards stand ('' = taken) — cardWhy's reasons, as for a set. */
export function kitPastePeek(i: number, from: MemberKit): { card: MemberKit; changed: KitField[]; why: string } { return onWorn(i, () => pastePeek(i, from)); }
function pastePeek(i: number, from: MemberKit): { card: MemberKit; changed: KitField[]; why: string } {
  const card = kitPasteCard(i, from);
  return { card, changed: rowsMoved(i, KIT.members[i], card), why: PASTE_BREAK ? '' : cardWhy(i, card) ?? '' };
}
/** Paste a copied card onto member i's; kept, in ONE write of his card. `ok` false: refused (`why`), nothing written. `changed`: the rows of his card it moved. */
export function kitPaste(i: number, from: MemberKit): { ok: boolean; why: string; changed: KitField[] } {
  return onWorn(i, () => {
    const p = pastePeek(i, from); if (p.why) return { ok: false, why: p.why, changed: [] };
    if (p.changed.length || PASTE_BREAK) { KIT.members[i] = p.card; KIT_NOTE[i] = ''; kitSave(); }
    return { ok: true, why: '', changed: p.changed };
  }, r => r.ok && (r.changed.length > 0 || PASTE_BREAK));
}
/** member i already wears a copied card: a paste of it would move no row of his */
export function kitWears(i: number, from: MemberKit): boolean { return !kitPastePeek(i, from).changed.length; }

// ------------------------------------------------------------ the store
interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }
let store: Store | null = null;
/** per member: what the last read of the store had to leave behind to fit his pouches, in a line for his card ('' = nothing; gone at his card's next change) */
export const KIT_NOTE: string[] = Array.from({ length: KIT_MEMBERS }, () => '');
/** A stored (or hand-typed) card made safe: every field one of its row's values, anything else the issued one (the pouches are kitLoad's, over all five:
 *  kitFitAll). ONE OF YOUR FOUR COUNTS OVER ITS ROW'S TOP IS NOT JUNK: your rows ended higher before you were cut to a teammate's four pouches (six smoke, the
 *  all-smoke split), so such a count is read as the most a row of yours could ever hold (OWN_MAX) and left to kitFitAll, which brings it inside the table and
 *  the pouches and says on the card what stayed behind — dropped to the issued one here, an old '6 smoke, no stun' card came back with one smoke and not a word
 *  about the other five. (A teammate's count over its row is still hand-typed junk: the issued one.) YOUR card from the build before the rule holds its canisters as `cans`, a split of six by name, and no `smoke`: read as that split (its
 *  `bangs` then meant nothing and is not read). */
export function kitSanitize(i: number, raw: unknown): MemberKit {
  const card = kitDefault(i), out = card as unknown as Record<string, KitValue>; if (!raw || typeof raw !== 'object') return card;
  const R = raw as Record<string, unknown>, old = i === 0 && R.smoke === undefined;
  if (old && typeof R.cans === 'string' && Object.hasOwn(CAN_MIXES, R.cans)) { const x = CAN_MIXES[R.cans as CanMix]; card.smoke = x.smoke; card.bangs = x.stun; }
  const rows = i === 0 && !SLOTS.on ? [...kitRows(0), ...youCanRows()] : kitRows(i);   // (rule off: your two counts have no row of their own, and are still checked)
  for (const r of rows) { if (r.get || (old && (r.field === 'smoke' || r.field === 'bangs'))) continue; const v = R[r.field]; if (r.values.includes(v as KitValue)) out[r.field] = v as KitValue;
    else if (i === 0 && (COUNTS0 as readonly string[]).includes(r.field) && int(v, 0)) out[r.field] = Math.min(v, OWN_MAX[r.field][0]); }   // (a whole count the row does not offer is one over its top)
  if (i === 0 && int(R.cams, 1) && !camRow()) card.cams = Math.min(R.cams, CAMS_MAX);   // (… and sticky cameras on a visit with their row off — ?nosticky: the same)
  // THE BIG SLOT'S TWO FIELDS (BIGSLOT): its row is one of choices over them and is not read by the loop above. On: the stored wall
  // charge and big thing are each taken where his row offers them — a card holding two of them is brought to one by kitFitAll, which says what stayed
  // behind — and a card whose GUN is the shotgun (the build before's) is his issued gun with the shotgun in the big slot. Off: `big` is kept, inert.
  if (R.big === 'shotgun' || R.big === 'hammer') card.big = R.big;
  if (bigOn) { const offers = rows.find(r => r.field === 'big')?.values ?? [];
    if (card.big !== 'none' && !offers.includes(card.big)) card.big = 'none';
    if (int(R.walls, 1) && offers.includes('wall')) card.walls = Math.min(R.walls, WALLS_MAX);
    if (R.weapon === 'shotgun' && offers.includes('shotgun')) { card.weapon = 'shotgun'; bigHome(card, i); } }
  // THE TWO GUN SLOTS (gunslots.ts): rows of choices, not read by the loop above. A stored pick the table offers is taken as it is (off: carried, inert);
  // whether a long gun is brought at all is the `weapon` field the loop above read, as it always was.
  { if (gunsOn() && (R.weapon === 'rifle' || R.weapon === 'pistol')) card.weapon = R.weapon;   // (the loop reads rows, and the gun field has none of its own here)
    if (typeof R.primary === 'string') card.primary = R.primary; if (typeof R.secondary === 'string') card.secondary = R.secondary; gunsHome(card); }
  if (i === 0 && R.wand === true && !wandRow()) card.wand = true;   // (the optical wand on a visit with its row off — ?nowand: kept on the card, inert (no pouch, no words, nothing on him: each of those asks the switch), so the next change of any row does not write the store without it)
  return card;
}
/** Read the table from a store (the page: localStorage, at boot — main.ts) and keep writing changes there. `?nokit` on the URL switches the table off for the
 *  visit; `?noslots` the pouches rule (the free rows of the build before it; the flag rides a Deploy like any of the visitor's own). Without a call nothing is
 *  stored and the table is as issued (the headless harness). A stored kit over a man's pouches is brought inside them here, in memory: the store keeps what
 *  it held until a row is next changed, so a visit with the rule off finds its free kit again.
 *  YOUR FOUR COUNTS AS ISSUED THE OTHER WAY THE RULE STANDS ARE 'AS ISSUED' HERE TOO (kitSave writes all five cards when any row changes, and what you are
 *  issued follows the switch): a store holding the as-built 4 / 2 / 2 / 3 read under the rule — the build before you were cut to four pouches wrote that for a
 *  card nobody touched — is the rule's one of each, with no line about a kit 'over the pouches' you never chose; and the rule's 1 / 1 / 1 / 1 read with the
 *  rule off is the as-built card, not 'your own split'. Read-side only, nothing new in the store. Neither card can be meant: eleven things never fit your four
 *  pouches, and no row of the rule-off card makes one smoke and one stun. Any other card of yours loads as you left it. */
export function kitLoad(s: Store | null, search = '') {
  const q = new URLSearchParams(search);
  store = s; KIT.on = !q.has('nokit'); SLOTS.on = SLOTS.ok && !q.has('noslots'); team = KIT_MEMBERS - 1;
  for (let i = 0; i < KIT_MEMBERS; i++) { KIT.members[i] = kitDefault(i); KIT_NOTE[i] = ''; }
  kept0 = null; keptWand = []; dealOwn = false;
  try { const raw = s?.getItem(KIT_LS); if (raw) { const j = JSON.parse(raw) as { members?: unknown[]; own?: unknown }; dealOwn = j.own === true; for (let i = 0; i < KIT_MEMBERS; i++) KIT.members[i] = kitSanitize(i, j.members?.[i]);
      kept0 = keptOf(j.members?.[0]);
      keptWand = (j.members ?? []).map((r, i) => i > 0 && !!r && typeof r === 'object' && (r as { wand?: unknown }).wand === true);
      { const m = KIT.members[0], other: Record<typeof COUNTS0[number], number> = ruleOn ? BUILT : ISSUED[0], now = issuedCard(0); if (COUNTS0.every(k => m[k] === other[k])) for (const k of COUNTS0) m[k] = now[k]; }   // (as issued the other way the rule stands = as issued)
      if (SLOTS.on) kitFitAll(KIT.members).forEach((left, i) => { if (left.length) KIT_NOTE[i] = i === 0 && KIT.members[0].weapon !== 'rifle' && left.length === 1 && left[0].includes(SLOT_WORD.shells) ? `No FN2000 in your saved kit: ${left[0]} left behind.` : `Your saved kit was over the ${bigOn && !/canister|frag|grenade|door charge|camera|wand/.test(left.join()) ? 'big slot' : 'pouches'}: ${left.join(', ')} left behind.`; }); } }
  catch { /* an unreadable store: as issued */ }
}
/** A PAGE THAT PLAYS THE KIT AS ISSUED (a Training level's load — main.ts, game/loadout.ts kitAsIssued): a lesson's steps ask for the issue kit's own things,
 *  so on such a page every STAGING (kitStage, kitPlayer — a start, a restart, the plain night's fresh Player) puts the ISSUE cards on the men whatever this
 *  machine keeps. The table and its store are left alone: they stay the machine's on every page, so the loadout screen opened from a lesson's page for
 *  another mission shows the kept cards, keeps a change, and its Deploy — a page load — wears them. The issue cards stand in the table only for the length
 *  of the staging call itself (asIssued: the table, the notes, the store and the team size are put back as they were, also when the staging throws).
 *  Not covered: a read of the table by the game OUTSIDE a staging call (today there is none).
 *  YOUR FOUR COUNTS ARE NOT THE ISSUE CARD'S ON SUCH A PAGE: a lesson is taught with what a Player is built with (BUILT: 4 smoke, 2 stun, 2 frags, 3 rounds),
 *  since levels/train-kit.json has you throw a smoke can, a stun can and a frag with nothing to spare for a miss under the one of each the pouches rule issues. kitPlayer
 *  writes no count while `issuing` on such a page (a mission's own issue below, kitIssue, writes them as any card's). */
let issuedPage = false, issuing = false;
export function kitIssuedPage(on = true) { issuedPage = on; }
/** A MISSION'S OWN ISSUE (the level file's `scenarios.issue`, scene/scenarios.ts IssueData): on a level that carries the block every staging puts the ISSUE
 *  cards on the men, as a lesson's page does, with the block's fields written over them (the long hall: the plain issue for every man). The table and its store
 *  stay the machine's (asIssued puts them back), so nothing kept is worn or written. `ISSUE.on` false (?noissue), or a level without the block = the staging
 *  as it was. True = `f` (the staging itself, asked again) has run under the mission's cards. A Training level's page speaks first: a lesson's level that
 *  also carried the block would be played with the plain issue cards, the block unread. */
export const ISSUE = { on: true };
function kitIssue(g: Game, f: () => void): boolean {
  const D = ISSUE.on && !issuing ? g.level.scenarios?.issue : undefined; if (!D) return false;
  asIssued(() => { for (const [k, c] of Object.entries(D.members)) if (KIT.members[+k]) Object.assign(KIT.members[+k], c); f(); });
  return true;
}
function asIssued(f: () => void) {
  const cards = KIT.members.slice(), notes = KIT_NOTE.slice(), s = store, t = team, own = dealOwn;
  issuing = true; store = null; dealOwn = false;   // (the issue is nobody's own layout: it is dealt as the screen shows it, whatever the player's stored cards are)
  for (let i = 0; i < KIT_MEMBERS; i++) { KIT.members[i] = kitDefault(i); KIT_NOTE[i] = ''; }
  try { f(); } finally { for (let i = 0; i < KIT_MEMBERS; i++) { KIT.members[i] = cards[i]; KIT_NOTE[i] = notes[i]; } store = s; team = t; dealOwn = own; issuing = false; }
}
/** YOUR OWN CHARGES ON A VISIT WITH THEIR ROWS OFF (?noowncharge, or a build without the wall charge): the stored card's door and wall charges are not read
 *  onto your card (no row: nothing of them is carried, priced or worded), and are kept here so the next change of any row does not write the store without
 *  them — the wand's rule, for two counts. Read by kitLoad from the store alone (never from a named loadout's card), written back by kitSave only for a
 *  count whose row is still off. */
let kept0: { charges?: number; walls?: number } | null = null;
function keptOf(raw: unknown): typeof kept0 {
  if (!raw || typeof raw !== 'object') return null; const R = raw as Record<string, unknown>, k: NonNullable<typeof kept0> = {};
  if (int(R.charges, 1) && R.charges <= CHARGES_MAX) k.charges = R.charges; if (int(R.walls, 1) && R.walls <= WALLS_MAX) k.walls = R.walls;
  return k.charges || k.walls ? k : null;
}
/** A TEAMMATE'S WAND ON A VISIT WITH ITS ROW OFF (?nowandmate, ?nowand): the stored card's wand is not read onto his card (no row: no pouch, no words, nothing
 *  drawn on him, no order), and is kept here so the next change of any row does not write the store without it. Where the row is on, the card is the truth. */
let keptWand: boolean[] = [];
function keptNow(): { charges?: number; walls?: number } { const k: { charges?: number; walls?: number } = {}; if (kept0?.charges && !chargeRow(0)) k.charges = kept0.charges; if (kept0?.walls && !wallRow(0)) k.walls = kept0.walls; return k; }
/** (your card also carries `cans` — the split of six its two counts are, where they are one — for a build from before the pouches rule reading this store) */
export function kitSave() { try { store?.setItem(KIT_LS, JSON.stringify({ v: 2, ...(dealOwn ? { own: true } : {}), members: KIT.members.map((m, i) => (i === 0 ? { ...m, ...keptNow(), cans: mixOf(m) ?? 'issued' } : wandRow(i) ? (keptWand[i] = m.wand, m) : keptWand[i] ? { ...m, wand: true } : m)) })); } catch { /* a full or forbidden store: the table still holds for this visit */ } }
/** every card back as issued (and the store's copy) */
export function kitReset() { for (let i = 0; i < KIT_MEMBERS; i++) { KIT.members[i] = kitDefault(i); KIT_NOTE[i] = ''; } kept0 = null; keptWand = []; dealOwn = false; kitSave(); }
// slots.json, checked once as this module loads (after the issued table above, which the check reads; nothing of another game module is touched)
{ const c = slotsCheck(slotsData); if ('table' in c) SLOTS.table = c.table; else { SLOTS.ok = SLOTS.on = false; SLOTS.why = c.why; console.error(`kit: slots.json refused — ${c.why}. The pouches rule is off: every row is free.`); } }

// ------------------------------------------------------------ on the floor
/** the men a staging put a card on, and those of them with no goggles (nvg.ts asks kitGoggles) */
const manOf = new SideMap<Guard, { i: number; kit: MemberKit }>('kit.manOf');
const bareEyed = new SideSet<Guard>('kit.bareEyed');
/** the last staging's men, in member order, and how many stagings there have been (the page's __kit hook and the probes read it) */
export const KIT_STAGED: { n: number; ops: Guard[] } = { n: 0, ops: [] };
/** the card a staged teammate was staged WITH — a copy taken then, so what he has, not what the table says now (null: no staging put a card on him: not
 *  one of a staged team, or the table was off) */
export function kitOf(gd: Guard): MemberKit | null { return manOf.get(gd)?.kit ?? null; }
/** which member a staged teammate is (1 to 4), or 0 */
export function kitIndex(gd: Guard): number { return manOf.get(gd)?.i ?? 0; }
/** he wears goggles (nvg.ts isMate / nvgWorn: true for everybody no card has taken them off) */
export function kitGoggles(gd: Guard): boolean { return !bareEyed.has(gd); }
/** he is one of a staged team and his card has him carry a pistol (guards.ts handCarry: an operator's sidearm is in his hand, never a hand torch) */
export function kitPistol(gd: Guard): boolean { return manOf.has(gd) && gd.weapon.def.cls === 'pistol'; }
/** the breaching shotgun or the hammer in a staged teammate's big slot ('none': the switch off, no card on him, a wall charge there) */
export function kitBig(gd: Guard): BigKit { const m = bigOn ? manOf.get(gd)?.kit : undefined; return m && !m.walls ? m.big : 'none'; }

/** what a Player carried before his card went on (kitShow gives it back) */
const issuedPlayer = new SideMap<object, { rifle: boolean; gun: Rifle; side: Pistol; slot: Game['player']['slot']; smoke: number; stun: number; frags: number; shells: number; wand: boolean; big: BigKit; /** sticky cameras for the tube, −1 = that load was not on his rifle */ cams: number; tint: Vec3; tint2: Vec3 }>('kit.issuedPlayer');
/** YOUR card onto the fresh Player (a scenario's staging calls kitStage, which calls this; a plain night's start may call it by itself): the rifle left at
 *  home, your four counts, the two colours. A count is written where the card differs from WHAT A PLAYER IS BUILT WITH (BUILT — not from the issue card:
 *  under the pouches rule you are issued one of each, fewer than a Player's own; and the same literals the build before compared with, so with the rule off
 *  every run is that build's). So with the rule off as issued = nothing written, and with it on as issued = one smoke, one stun, one frag, one round on
 *  him; kitShow puts back what he had. */
export function kitPlayer(g: Game) {
  if (!KIT.on) return;
  if (issuedPage && !issuing) return asIssued(() => kitPlayer(g));   // (a lesson's page: the issue card, whatever the table holds — kitIssuedPage)
  if (kitIssue(g, () => kitPlayer(g))) return;   // (a mission that issues its own kit: kitIssue)
  const m = KIT.members[0], pl = g.player;
  if (!issuedPlayer.has(pl)) issuedPlayer.set(pl, { rifle: pl.hasRifle, gun: pl.rifle, side: pl.pistol, slot: pl.slot, smoke: pl.canisters, stun: pl.flashbangs, frags: pl.frags, shells: pl.rifle.shells, wand: pl.wand, big: pl.bigKit, cams: pl.rifle.attachments.includes('cam') ? pl.rifle.cams : -1, tint: [...pl.char.tint] as Vec3, tint2: [...pl.char.tint2] as Vec3 });
  const counts = !(issuedPage && issuing);   // (a lesson's page: his counts stay the Player's own — kitIssuedPage; a mission's own issue writes them like any card)
  if (bigOn) bigHome(m, 0);   // (BIGSLOT: the shotgun is never your gun — a card set by hand, a mission's issue)
  pl.bigKit = bigOn && !m.walls ? m.big : 'none';   // (the breaching shotgun or the hammer in your big slot: bigkit.ts — a card as issued carries neither, so nothing changes on him)
  if (m.weapon === 'pistol' && pl.hasRifle) { pl.hasRifle = false; if (pl.slot === 'rifle') pl.slot = 'pistol'; }   // (this Player only: Game.fn2000 — what the next plain night's Player is built with — is not ours)
  if (gunsOn()) { const long = pickRow(m.primary, true), side = pickRow(m.secondary, true);   // (gunslots.ts: the two guns your card picks — both of yours wear the can where the pick has one; the issue pair is the pair you were built with: nothing made)
    if (long && pl.hasRifle && pl.rifle.def.id !== long) pl.rifle = new Rifle(WEAPONS[long]);
    if (side && pl.pistol.def.id !== side) pl.pistol = new Pistol(WEAPONS[side]); }
  if (m.weapon === 'shotgun' && pl.hasRifle && pl.rifle.def.id !== 'm870') pl.rifle = new Rifle(WEAPONS.m870);   // (the shotgun rides where the FN2000 did: slot 2, in the hands or slung, the same keys — its row has no ring launcher)
  if (counts && (m.smoke !== BUILT.smoke || m.bangs !== BUILT.bangs)) { pl.canisters = m.smoke; pl.flashbangs = m.bangs; if ((pl.slot === 'smoke' && !pl.canisters) || (pl.slot === 'flash' && !pl.flashbangs)) pl.slot = 'pistol'; }   // (the split of six he is built with — the card as issued with the rule off — nothing is written)
  if (counts && m.frags !== BUILT.frags) { pl.frags = m.frags; if (pl.slot === 'frag' && !pl.frags) pl.slot = 'pistol'; }
  if (counts && m.shells !== BUILT.shells && pl.rifle.attachments.includes('he40')) pl.rifle.shells = Math.min(m.shells, SHELLS_MAX);   // (what the rifle was built with — its own LAUNCHER40.rounds — not written; the shotgun in the rifle's slot has no launcher and takes none)
  if (counts && camRow() && pl.hasRifle) stickyIssue(pl, tubed(m) ? Math.max(m.cams, stickyVisit(g)) : 0);   // (sticky cameras: the launcher's third load, on his rifle only when the card carries one or the mission hands some — stickyVisit; a card as issued carries none, so nothing changes on him)
  pl.wand = (m.wand && wandRow()) || (WAND.on && quietWand(g));   // (the optical wand in a pouch: wand.ts — a card as issued carries none, so nothing changes on him; quietfog.ts: a quiet mission under the fog that hands out cameras hands him one too — even on a card whose gun has no launcher for them)
  if (m.suit !== 'issued') pl.char.tint = [...SUITS[m.suit].tint] as Vec3;
  if (m.trim !== 'issued') pl.char.tint2 = [...TRIMS[m.trim].tint] as Vec3;
  loadWear(g, issuing ? null : m);   // (kitload.ts: what this card weighs — not where the staging chose his kit itself: a lesson's page, a mission's own issue)
  kitAlone(g);
}
/** NOBODY CAME WITH YOU (the plain night, a quiet mission alone, a squad's mission at team size none) and your own charges are switched on (owncharge.ts): the
 *  counts the door tools and the wall charge spend are YOUR CARD'S and nothing else — a man alone used to stand with the door tools' bag of two whatever his
 *  card said (nothing staged it), and the wall charge by hand was paid out of that. Written wherever your card is put on you (kitPlayer: every fresh Player of
 *  the plain night, every staging), never with a teammate on the floor — the squad's count, yours in it, is kitStage's. Switch off = nothing written, as it was. */
function kitAlone(g: Game) {
  if (!OWNCHARGE.on || !g.doorTools || !g.wallCharge || g.guards.some(gd => !!gd.unit && gd.team === 'operative')) return;
  g.wallCharge.raiseCarried(0);   // (the wall charge's own look at the run first: for a fresh Player it hands back what he spent alone last run, which must not land over the count written next)
  g.doorTools.alone(chargeRow(0) ? KIT.members[0].charges : 0);
  if (SLOTS.on && wallHere()) g.wallCharge.setCarried(kitWalls(0));
}
/** THE SOLO NIGHT WEARS YOUR CARD: raised by the page when the plain night was started through the loadout screen (its Deploy: `?solo` — main.ts — or, off
 *  the start card over the plain night, the card's own Start), never by the harness. While it is up every fresh Player of the plain night gets kitPlayer
 *  (game.ts restartEncounter and the start card's Start → kitFresh), so the card outlives a restart like it does in a scenario, whose staging calls kitStage
 *  again. A CHECKPOINT LOAD brings back what the save holds — the rifle, the cans (savestate.ts) — over the card; only the two colours, which no save holds,
 *  stay the card's. A SHOWCASE's player is the show's: kitShow takes the card off as one starts, and nothing puts it on while one runs. Off = the plain
 *  night is nobody's business here: Start on the card is as it ever was. */
export const KIT_SOLO = { on: false, stand: false };
export function kitSolo(g: Game) { KIT_SOLO.on = true; kitPlayer(g); }
/** THE PAGE'S OWN QUESTION, in one place (main.ts asks it at boot with `solo` = its URL has ?solo): the plain night off the loadout screen, or a quiet mission
 *  alone, and no squad scenario up → your card goes on the player and on every fresh one after (kitSolo). */
export function kitSoloIf(g: Game, solo: boolean) { if ((solo || (g.quiet?.active && !g.quiet.squad)) && !g.nightBreach?.active && !g.rescue?.active) kitSolo(g); }
/** … AND THE HARNESS'S SHIPPED STAND ASKS IT TOO (`KIT_SOLO.stand`, raised by src/host/profile.ts shippedBoot and by nothing else: the frozen stand never
 *  comes past the first line, so its Sam is what a Player is built with and nothing is written). A headless game has no URL: stood up plain it IS the solo
 *  night as the mission list deploys it (`?solo`), until a tool starts a scenario on it (scenarioRun.ts startFromQuery: `plain` false) — then the answer is
 *  the page's for that scenario's URL: a quiet mission alone wears your card, a squad's mission leaves it to its own staging (kitStage) and the flag comes
 *  down, as on a page that never had ?solo. Without this the shipped stand's solo Sam carried the eleven things a Player is built with where the page's
 *  carries the four he is issued. A TRAINING level (one that carries a lesson) is left alone: its page plays your counts as built (kitIssuedPage), and with
 *  nothing kept on the machine that is the fresh Player as he stands. */
export function kitSoloStand(g: Game, plain = true) { if (!KIT_SOLO.stand) return; KIT_SOLO.on = false; if (!g.level.scenarios?.lesson?.steps?.length) kitSoloIf(g, plain); }
export function kitFresh(g: Game) { if (KIT_SOLO.on && !g.touring && !g.director?.showing) kitPlayer(g); }
/** a showcase is about to start on this Player (main.ts): his card comes off — what he carried before it is his again */
export function kitShow(g: Game) {
  const pl = g.player, was = issuedPlayer.get(pl); if (!was) return;
  pl.hasRifle = was.rifle; pl.rifle = was.gun; pl.pistol = was.side; pl.slot = was.slot; pl.canisters = was.smoke; pl.flashbangs = was.stun; pl.frags = was.frags; pl.rifle.shells = was.shells; stickyIssue(pl, Math.max(0, was.cams), was.cams >= 0); pl.wand = was.wand; pl.bigKit = was.big; pl.char.tint = [...was.tint] as Vec3; pl.char.tint2 = [...was.tint2] as Vec3; issuedPlayer.delete(pl); loadWear(g, null);
}
/** A SCENARIO HAS JUST STAGED ITS TEAM (`ops` in staging order: member 1 first): each man's card onto him, yours onto you, and the squad's counted stun
 *  canisters and charges moved by what the cards changed. Called once per staging, after the cast stands and Sam is on his mark; every restart stages again
 *  and so calls again. With every card as issued nothing is written on a teammate (but the count, when one man comes alone: kitPool) — and on you only
 *  under the pouches rule, your four counts: kitPlayer. */
export function kitStage(g: Game, ops: Guard[]) {
  if (issuedPage && !issuing) return asIssued(() => kitStage(g, ops));   // (a lesson's page: every man staged with the issue cards — kitIssuedPage)
  if (kitIssue(g, () => kitStage(g, ops))) return;   // (a mission that issues its own kit: kitIssue)
  KIT_STAGED.n++; KIT_STAGED.ops = ops.slice(0, KIT_MEMBERS - 1);
  if (!KIT.on) { squadSmokeStage(g, 0); squad40Stage(g, []); return; }   // (squadsmoke.ts: the squad's smoke is set on EVERY staging — none with the table off; squad40.ts: the teammates' 40 mm rounds likewise)
  if (SLOTS.on) kitTeam(Math.min(ops.length, KIT_MEMBERS - 1));   // (the rule is held for the men who CAME: cards made legal for a smaller team on the loadout screen and then staged on a bigger one give up what does not fit — nothing while they are legal, as the issued kit always is)
  squadSmokeStage(g, kitSmokes(ops.length));   // (squadsmoke.ts: what the men who came carry, after the pouches rule has had its say, is the squad's smoke for this run)
  kitPlayer(g);
  const worn = kitWorn(Math.min(ops.length, KIT_MEMBERS - 1));   // (KITDEAL: the cards as this team carries them — the counts below are sums, the same either way)
  ops.slice(0, KIT_MEMBERS - 1).forEach((gd, k) => {
    const i = k + 1, m = bigOn ? bigHome(worn[i], i) : worn[i], d = ISSUED[i]; manOf.set(gd, { i, kit: { ...m } }); loadMan(gd, i, issuing ? null : m, Math.min(ops.length, KIT_MEMBERS - 1));   // (kitload.ts: what his card weighs beside his issue as this team is dealt it, as yours in kitPlayer)   // (BIGSLOT: the shotgun is never his gun — a card set by hand with the pouches rule off, a mission's issue)
    const gun = kitGun(m);
    // (only a card that CHANGED his gun writes one: as issued, the row the scenario handed him is his, whatever it is. The row is dealt off his route every
    // frame — game.ts — so the route is where it is written)
    if ((m.weapon !== d.weapon || m.suppressed !== d.suppressed || (gunsOn() && m.primary !== d.primary)) && gun !== gd.weapon.def.id && WEAPONS[gun].enabled) {
      gd.route.weapon = gun; gd.weapon = new Firearm(WEAPONS[gun]); gd.reloadT = -1; gd.char.muzzleAhead = WEAPONS[gun].muzzleAhead;
    }
    sideStage(gd, gd.weapon.def.cls === 'pistol' ? null : kitSide(m));   // (gunslots.ts: his card's other slot — the sidearm on his thigh is a gun he can go to; none for a man whose gun is a pistol)
    if (!m.light) gd.lightDeadUntil = Infinity;   // (no light fitted: the one switch every light rule already yields to — guards.ts attachFlashlight)
    if (!m.nvg) bareEyed.add(gd);
    if (m.suit !== 'issued') gd.char.tint = [...SUITS[m.suit].tint] as Vec3;
    if (m.trim !== 'issued') gd.char.tint2 = [...TRIMS[m.trim].tint] as Vec3;
  });
  squad40Stage(g, ops.slice(0, KIT_MEMBERS - 1).map(gd => [gd, manOf.get(gd)?.kit.shells ?? 0] as const));   // (squad40.ts: the 40 mm rounds each teammate's card carries are his to fire on order — none on a card as issued, so nothing is kept)
  // the squad's counted stun canisters and charges: what the men who came carry (kitPool — the number the loadout screen showed before Deploy)
  const n = Math.min(ops.length, KIT_MEMBERS - 1), pool = kitPool(n);
  if (n && (pool.bangs !== DOORTOOLS.bangs || pool.charges !== DOORTOOLS.charges || pool.frags !== FRAG.squad)) {
    g.doorTools.sync();   // (the door tools count a new cast in lazily, and that puts the counts back: have it done now, then set them)
    g.doorTools.bangs = pool.bangs; g.doorTools.charges = pool.charges; g.doorTools.frags = pool.frags;
  }
  // the wall charge (wallcharge.ts, the destruction goal's): under the rule the cards say how many the men who came carry — none as issued — and it is TOLD
  // at every staging with teammates (a restart puts its own count back); with the rule off, or in a build whose wall charge takes no count, it is never told
  // (no teammate came — the solo size of a squad mission: no card is on the floor and the wall charge keeps its own rule, like the bag above)
  if (n && SLOTS.on && wallHere()) (g.wallCharge as unknown as { setCarried(n: number | null): void }).setCarried(kitWalls(n));
}
/** the wall charges you and the `n` teammates who come carry between you (0 with the rule off, the table off, or in a build with no such row; your card
 *  has the row only with owncharge.ts's switch on, so off it is the teammates' alone) */
export function kitWalls(n: number): number { if (!KIT.on) return 0; let w = 0; for (let i = 0; i <= Math.min(n, KIT_MEMBERS - 1); i++) if (wallRow(i)) w += KIT.members[i].walls; return w; }   // (only a card that HAS the row: the rule on, the hook, a table that prices it)
/** THE SQUAD'S COUNTED STUN CANISTERS AND CHARGES WITH `n` TEAMMATES COMING — what those n men carry, and the one number both the loadout screen (before
 *  Deploy) and kitStage (the run) take: the game's own count (`issued`: DOORTOOLS.bangs / .charges, whatever those knobs say) less what the men who stay behind
 *  were issued, moved by what the cards of the men who come changed. The issued three and two ride on members 1 and 2, so with every card as issued a pair, a
 *  three and a four carry exactly the game's count (nothing is written), and one man alone carries his own two and one. Table off (?nokit): the game's count. */
export function kitPool(n: number, issued = { bangs: DOORTOOLS.bangs, charges: DOORTOOLS.charges }): { bangs: number; charges: number; frags: number } {
  let b = issued.bangs, c = issued.charges, f = FRAG.squad;   // (the frags the same way: frag.ts FRAG.squad, one each on members 1 and 2)
  if (KIT.on) for (let i = 1; i < KIT_MEMBERS; i++) {
    if (i <= n) { b += KIT.members[i].bangs - ISSUED[i].bangs; c += KIT.members[i].charges - ISSUED[i].charges; f += KIT.members[i].frags - ISSUED_FRAGS[i]; }
    else { b -= ISSUED[i].bangs; c -= ISSUED[i].charges; f -= ISSUED_FRAGS[i]; }
  }
  if (KIT.on && chargeRow(0)) c += KIT.members[0].charges;   // (what YOU carry is in the squad's one count: owncharge.ts — you are issued none, so a card as issued adds nothing)
  return { bangs: Math.max(0, b), charges: Math.max(0, c), frags: FRAG.on ? Math.max(0, f) : 0 };
}
/** The smoke canisters the squad brings to a run of n teammates: what the cards of the men who come carry (nobody is issued one, so there is no count of the
 *  game's to start from). Its own function, not a key on kitPool: probes compare that one's JSON. Table off: none. (squadsmoke.ts throws them on order.) */
export function kitSmokes(n: number): number {
  let s = 0; if (KIT.on) for (let i = 1; i < KIT_MEMBERS && i <= n; i++) s += KIT.members[i].smoke;
  return s;
}

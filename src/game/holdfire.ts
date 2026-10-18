// HOLDFIRE — a squad nobody has found never fires first.
//
// The play note: "an unfound squad never fires first: your shot or your order starts the fight, walking or sneaking" · "while nobody has found the squad,
// nobody fires until you do or you order it, whatever your posture". Until this file a LOUD squad held its fire on a man who had not noticed it only while
// Sam SNEAKED (unseen.ts's hold); walking in tall with the team behind him, the first teammate with a line shot the first man he saw.
//
// THE RULE: while nobody has FOUND the squad (this file's own test, `found` below: nothing loud in a teammate's ears inside the room fight's hot clock, and no
// defender alert or searching WHO HAS HAD EYES ON THE TEAM — `Guard.lastSeenT`, the stamp perception sets at a real sighting, the licence to shoot. A defender
// who is 'alert' only because he planted at the end of a walk, dug in on boots or stood to on a noise, and has seen nobody, has not found anybody: unseen.ts's
// `squadFound` counts him, this rule does not), a teammate's round at a man who has not noticed anybody is HELD — the gun goes onto him and stays there, the sneak hold's own line — whatever
// Sam's posture. THE FIGHT STARTS, for everybody at once, with
//   his shot      a ROUND from a player's gun, any gun, suppressed too (combat.ts fireWeapon → holdFireShot). NOT his ring / sponge round (launcher.ts
//                 fireRing: his quiet tool, like a takedown — it lifts nothing); the 40 mm HE lifts at its BURST, through the loud event in the team's ears.
//   his order     an order that means fire (LIFT_ORDERS by id: every door tool, the word, a frag / stun thrown on order — orders.ts give → holdFireOrder;
//                 the night breach's F 'go' — nightbreach.ts order), for `liftSecs` after the last of them and for as long as a door order of the squad is
//                 being WORKED (doortools.ts / wallcharge.ts ops, the F drill going in) or a hostage rescue is on the clock (rescue.ts `dynamic`).
//                 AN ORDER THAT WAITS LIFTS NOTHING UNTIL IT GOES: a tool given 'on my word' lifts at the WORD ('go' / F), not at the give, and its op
//                 does not count as worked while it waits; a charge (door or wall) lifts at the BLOW — set, stood off and armed it is a squad waiting.
//                 A plain stack never lifts. A threshold order (the door opened, held from outside) lifts at the give unless it was given on the word.
//                 'GO LOUD', TOLD TO A SILENT SQUAD, IS SUCH AN ORDER (HOLDFIRE.loud; the maintainer, 10-13: "loud" itself means weapons free "only for a squad
//                 that was silent and is told loud"): the menu's row, given by him while they are silent (orders.ts give asks `holdFireSilent` before the row
//                 is issued and says so here). Not a squad that starts loud, not 'loud' told to a loud squad, not silence ended any other way (a loud
//                 tool's row is its own order above; a new cast, the panel: nothing). WHILE THAT LIFT STANDS (`liftSecs` from the order: its own stamp,
//                 `loudT`) THE SNEAK'S HOLD HOLDS NOBODY EITHER (silent.ts asks `holdFireLoud` in front of unseen.ts's answer, plain and through glass):
//                 Sam is usually low when he says it. No other lift touches the sneak's hold.
//   being found   `found`: a shot, a charge or a boot in any teammate's ears, a roused defender who has seen them. FOUND MEANS FOUND: nobody holds a frame longer.
// and one man's round is never held on a man who HAS noticed (the silent order's own bar, awareness ≥ SILENT.noticed), nor while a captor is at his last
// warning. With the floor calm again and the lift run out, the hold is back.
// WITH THIS ON, `?sneakfire` (UNSEEN.hold off) alone no longer makes a sneaking squad shoot on sight — this hold answers when the sneak's does not; it takes
// `?noholdfire` too. And a QUIET gun is held as well (HOLDFIRE.quiet), which the sneak's hold never did.
// NOT here: a SILENT squad (silent.ts's own hold is the silent man's rule — this file answers only for a loud one) · the squad sneaking with Sam under
// UNSEEN.hold (unseen.ts answers first and keeps its own count; only holds that are NEW because of this rule are counted below) · defenders · Sam.
//
// OFF (the module's default and the frozen harness stand; TPS_HOLDFIRE=1 raises it; the page raises it, `?noholdfire` = off for the visit): every function
// returns on its first line and the game is the build before it.
// Habits: no dice · reads no camera, canvas or graphics setting · `leadOf` is the one place that says which player's squad · state is per Game in a WeakMap
// with a snapshot / restore pair below (no checkpoint is taken with a unit on the floor today, so savestate.ts does not carry it yet).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import type { Game, Guard, Player } from './game';
import type { Character } from './character';
import { hostileTo } from './teams';
import { SILENT, silentMan, squadSilent, quietGun, urgent } from './silent';   // (asked inside holdFireOnMan / holdFireSilent / holdFireOrder only)

export const HOLDFIRE = {
  /** THE switch: off = the team shoots on sight unless silent or sneaking, as it did */
  on: false,
  /** how long his shot or his order keeps the hold off after the last of them (s; ROOMFIGHT.teamHot's 45) */
  liftSecs: 45,
  /** … and through standing glass the round is held until the man is alert or searching, as the sneak holds it */
  glass: true,
  /** a quiet gun is held too (off: only a gun the floor would hear, as the sneak's hold has it) */
  quiet: true,
  /** 'go loud' told to a SILENT squad is an order that means fire (off: it ends the silent posture and this hold takes over, until his shot or a door order) */
  loud: true,
  /** a man on his stack mark with his round held on a man counts as arrived, and the lead keeps his hand off the handle while his own is (off: 'stacking' until his gun is the door's, and the handle tried, as it was) */
  stackSet: true,
  /** … and the handle waits while ANY man of that door's stack is so held, by the stamp of the orders' last tick (off: the lead's own fresh answer only; nothing without `stackSet`) */
  stackWait: true,
};
/** the orders that mean fire, by id (doortools.ts, wallcharge.ts, squadthrow.ts — by NAME: a row from a part not in the tree lifts the day it lands) */
export const LIFT_ORDERS: readonly string[] = ['openClear', 'bigClear', 'bangClear', 'fragClear', 'charge', 'threshold', 'thresholdHold', 'outside', 'thrStep', 'thrBang', 'thrWord', 'go', 'wallCharge', 'fragThere', 'stunThere'];
/** … of which these lift when they GO OFF, not when they are given (doortools.ts / wallcharge.ts blow): a set charge is a squad waiting on the trigger */
export const BLOW_ORDERS: readonly string[] = ['charge', 'wallCharge'];
/** … and the posture row that lifts when it takes a SILENT squad out of silent (silent.ts's row, by NAME) */
export const LOUD_ORDER = 'loud';
export type LiftWhy = 'shot' | 'order' | 'drill';
export const HOLDFIRE_STATS = { held: 0, heldGlass: 0, lifts: { shot: 0, order: 0, drill: 0 } };
/** what lifted it and when, newest last (QA) */
export const HOLDFIRE_LOG: { t: number; why: LiftWhy; what: string }[] = [];

interface State { /** when the hold was last lifted (game time; −∞: never) and by what */ liftT: number; why: LiftWhy | null; /** the roster it was lifted for */ cast: Guard[]; /** whose shot or order it was */ by: Player | null;
  /** when 'go loud' to a silent squad last lifted it (−∞: never; never later than liftT, and gone with it) */ loudT: number }
const states = new SideMap<Game, State>('holdfire.states');
const stateOf = (g: Game): State => { let S = states.get(g); if (!S) states.set(g, S = { liftT: -Infinity, why: null, cast: [], by: null, loudT: -Infinity }); return S; };
/** which player's squad this is (one place: with a second player this asks whose) */
const leadOf = (g: Game): Player => g.player;
const mate = (gd: Guard) => gd.team === 'operative' && !!gd.unit;
const living = (g: Game) => g.orders.squad().filter(gd => gd.state !== 'dead');

/** THE SQUAD HAS BEEN FOUND — this rule's own test (unseen.ts's `squadFound` also counts a defender who is 'alert' with nobody seen: roomfight.ts `plant`
 *  sets that state on a man who ends a scripted walk, a dig-in to cover after boots included): something loud in a living squad man's ears inside the room
 *  fight's hot clock (a hostile round at them is that), or a defender alert / searching who has had a REAL sighting (`lastSeenT` ≥ 0: guards.ts stamps it at
 *  sight gain > 0.25 /s, roomfight.ts at contact — the enemy squads' radio call is keyed by such a man). */
export function holdFireFound(g: Game, men: Guard[]): string | null {
  for (const gd of men) if (g.fight.hotFor(gd)) return 'loud';
  const m = men[0]; if (!m) return null;
  for (const h of g.guards) if ((h.state === 'alert' || h.state === 'search') && h.lastSeenT >= 0 && hostileTo(h, m)) return 'a defender has seen them';
  return null;
}
/** a door order of the squad is being WORKED right now: a door tool's men past any wait for the word, a charge blown and its entry on, the F drill going in —
 *  or a rescue's clock is running. Waiting is not working: an op still 'on my word', a charge being set / stood off from / armed. */
function working(g: Game): boolean {
  if (g.doorTools?.ops.some(op => !op.onWord && !(op.kind === 'charge' && WAITS.includes(op.phase)) && op.men.some(m => m.state !== 'dead'))) return true;
  if (g.wallCharge?.ops.some(op => !WAITS.includes(op.phase) && op.men.some(m => m.state !== 'dead'))) return true;
  const nb = g.nightBreach; if (nb?.active && (nb.state === 'going' || nb.state === 'inside')) return true;
  const rs = g.rescue; if (!rs?.active || !rs.dynamic) return false;   // (a rescue ON THE CLOCK: the captor is counting and the flow moves the men with no door order of Sam's — the mission's own start of the fight. Measured without this line, office rescue seed 4: the pair held on the roamers until the captor's last warning, the entry 18 s late)
  const st = rs.state; return st !== 'rescued' && st !== 'lost';
}
const WAITS: readonly string[] = ['place', 'standoff', 'armed'];
/** his shot or his order has started the fight: inside `liftSecs` of the last of them, or a door order still being worked. A stamp from a roster that is
 *  gone, or from AHEAD of the clock (a checkpoint took Game.time back), is no lift. */
export function holdFireLifted(g: Game): boolean {
  if (!HOLDFIRE.on) return false;
  const S = states.get(g);
  if (S && S.liftT > -Infinity) {
    if (g.time < S.liftT || !g.orders.squad().some(gd => S.cast.includes(gd))) { S.liftT = S.loudT = -Infinity; S.why = null; S.cast = []; S.by = null; }   // (the clock went back, or not a man of that squad is left: a new run)
    else if (g.time - S.liftT < HOLDFIRE.liftSecs) return true;
  }
  return working(g);
}
function lift(g: Game, why: LiftWhy, what: string, by: Player, loud = false) {
  if (!g.orders?.active) return;
  holdFireLifted(g); const S = stateOf(g), was = S.liftT > -Infinity && g.time - S.liftT < HOLDFIRE.liftSecs;   // (a stamp still running: this one extends it — one fight, one count; a door order being worked is no stamp)
  S.liftT = g.time; S.why = why; S.cast = g.orders.squad(); S.by = by; if (loud) S.loudT = g.time;
  if (!was) { HOLDFIRE_STATS.lifts[why]++; HOLDFIRE_LOG.push({ t: g.time, why, what }); if (HOLDFIRE_LOG.length > 200) HOLDFIRE_LOG.splice(0, 100); }
}
/** A round has left a gun (combat.ts fireWeapon, once a pull): a PLAYER's starts the fight for his squad. `shooter`: whose round it was. */
export function holdFireShot(g: Game, shooter: Character) {
  if (!HOLDFIRE.on || shooter !== leadOf(g).char) return;
  lift(g, 'shot', 'a round of his own', leadOf(g));
}
/** An order has been given (orders.ts give, by id — and anybody who gives one of LIFT_ORDERS' by another road): one that means fire starts the fight.
 *  `waits`: it was given on Sam's word (it lifts when the word comes: 'go') · a BLOW_ORDERS id lifts only when asked with `blown` (the charge going off).
 *  `by`: which player gave it · `silent`: what `holdFireSilent` answered before the row was issued (LOUD_ORDER lifts only then). */
export function holdFireOrder(g: Game, id: string, o: { waits?: boolean; blown?: boolean; why?: LiftWhy; by?: Player; silent?: boolean } = {}) {
  if (HOLDFIRE.on && HOLDFIRE.loud && o.silent && id === LOUD_ORDER && !squadSilent(g)) { lift(g, o.why ?? 'order', id, o.by ?? leadOf(g), true); return; }   // (the squad WAS silent when he gave it and the row has taken it out: his word for weapons free)
  if (!HOLDFIRE.on || !LIFT_ORDERS.includes(id) || o.waits || (BLOW_ORDERS.includes(id) && !o.blown)) return;
  lift(g, o.why ?? 'order', id, o.by ?? leadOf(g));
}
/** Asked by orders.ts give BEFORE an order's row is issued: is this 'go loud' being told to a squad that is silent right now. False for every other id, a
 *  loud squad, and with either switch off. */
export function holdFireSilent(g: Game, id: string): boolean { return HOLDFIRE.on && HOLDFIRE.loud && id === LOUD_ORDER && squadSilent(g); }
/** THE LIFT THAT STANDS IS HIS 'GO LOUD' (told to a silent squad, inside `liftSecs` of it — a later shot or order runs the hold's own lift on, not this):
 *  silent.ts asks before the sneak's hold (unseen.ts), which would otherwise answer first for a squad whose Sam is low. False with either switch off. */
export function holdFireLoud(g: Game): boolean {
  if (!HOLDFIRE.on || !HOLDFIRE.loud) return false;
  const S = states.get(g); return !!S && S.loudT > -Infinity && holdFireLifted(g) && g.time - S.loudT < HOLDFIRE.liftSecs;   // (holdFireLifted first: it clears a stamp from ahead of the clock or from a roster that is gone)
}
/** the F drill's 'go' (nightbreach.ts: not one of the menu's orders). `by`: which player gave it */
export function holdFireDrill(g: Game, by: Player = leadOf(g)) { if (HOLDFIRE.on) lift(g, 'drill', 'go', by); }

/** is this loud teammate under the hold this frame: the switch, a squad under orders, nobody has started the fight, nobody has found them */
function held(g: Game, gd: Guard): boolean {
  if (!mate(gd) || !g.orders.active || holdFireLifted(g)) return false;
  const men = living(g); return men.length > 0 && !holdFireFound(g, men);
}
/** this rule's own answer for one man's round at `h`, nothing counted: the man has not noticed anybody, the squad is held, no hostage's life is on it */
function holds(g: Game, gd: Guard, h: Guard, noticed: number, quiet: boolean, urgent: () => boolean): boolean {
  if ((quiet && !HOLDFIRE.quiet) || h.state === 'alert' || h.state === 'search' || h.awareness >= noticed) return false;
  return held(g, gd) && !urgent();
}
/** His round at `h` is held: nobody has found the squad, Sam has neither fired nor ordered it, and this man has not noticed anybody (`noticed`: the silent
 *  order's own bar · `quiet`: his gun is a quiet one · `urgent`: a hostage's life is on it). Asked by silent.ts silentHolds for a LOUD man, after unseen.ts. */
export function holdFireHolds(g: Game, gd: Guard, h: Guard, noticed: number, quiet: boolean, urgent: () => boolean): boolean {
  if (!HOLDFIRE.on || !holds(g, gd, h, noticed, quiet, urgent)) return false;
  HOLDFIRE_STATS.held++; return true;
}
/** THE MAN THE ROOM FIGHT HAS HIM ON IS ONE THIS RULE WILL NOT LET HIM SHOOT (orders.ts asks, for a stacked man whose gun is not on his door; doortools.ts,
 *  before he tries a handle): a loud teammate with a living man in his sight who has not noticed anybody, the squad held. The rule's own conditions, asked
 *  afresh — no stamp, nothing counted — so it stands through a change of man, Sam in his line and the sneak's hold answering first (unseen.ts, Sam low).
 *  Never a silent man (silent.ts's hold is his own). False with the switch off. Both askers ask only under HOLDFIRE.stackSet. */
export function holdFireOnMan(g: Game, gd: Guard): boolean {
  if (!HOLDFIRE.on || silentMan(g, gd)) return false;
  const h = g.fight.opOf(gd)?.tgt; return !!h && h.state !== 'dead' && holds(g, gd, h, SILENT.noticed, quietGun(gd), () => urgent(g));
}
/** … and through standing glass the hold is the silent order's own (until the man is alert or searching): is that rule his this frame */
export function holdFireGlass(g: Game, gd: Guard): boolean { return HOLDFIRE.on && HOLDFIRE.glass && held(g, gd); }
/** silent.ts's glass hold held a round under this rule (the count) */
export function holdFireGlassHeld() { HOLDFIRE_STATS.heldGlass++; }

/** a fresh encounter (game.ts restartEncounter): nothing lifted */
export function holdFireReset(g: Game) { states.delete(g); }
export function holdFireSummary(g: Game): string {
  if (!HOLDFIRE.on) return 'off';
  const S = states.get(g), n = g.orders.active ? living(g).length : 0;
  if (!n) return 'no squad';
  const lifted = holdFireLifted(g), found = holdFireFound(g, living(g));
  return `${found ? `found (${found})` : lifted ? `fight started (${S && g.time - S.liftT < HOLDFIRE.liftSecs ? `${S.why}, ${(HOLDFIRE.liftSecs - (g.time - S.liftT)).toFixed(0)} s left` : 'a door order under way'})` : 'holding fire'} · held ${HOLDFIRE_STATS.held} · for glass ${HOLDFIRE_STATS.heldGlass} · started by shot ${HOLDFIRE_STATS.lifts.shot} / order ${HOLDFIRE_STATS.lifts.order} / drill ${HOLDFIRE_STATS.lifts.drill}`;
}
/** what a save would carry (the stamp against Game.time, and 'go loud's own when there is one; the roster is taken again on restore) — and its way back */
export function holdFireSnapshot(g: Game): { liftT: number; why: LiftWhy; loudT?: number } | null { const S = states.get(g); return S && S.why && S.liftT > -Infinity ? { liftT: S.liftT, why: S.why, ...(S.loudT > -Infinity ? { loudT: S.loudT } : {}) } : null; }
export function holdFireRestore(g: Game, s: { liftT: number; why: LiftWhy; loudT?: number } | null | undefined) {
  if (!s || !Number.isFinite(s.liftT)) { states.delete(g); return; }
  states.set(g, { liftT: s.liftT, why: s.why, cast: g.orders.squad(), by: leadOf(g), loudT: typeof s.loudT === 'number' && Number.isFinite(s.loudT) && s.loudT <= s.liftT ? s.loudT : -Infinity });
}

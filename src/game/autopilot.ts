// B IS THE SQUAD'S AUTOPILOT (AUTOPILOT.on; the maintainer, 10-13: '"B" is the "autopilot" mode where the squad does the reasonable thing (and then maybe
// briefly shows their plan and then fades out), while X is the sweatier mode where you can micromanage them a bit').
//
// The quick key (orders.ts ORDERS.quickKey) used to give the target's FIRST ROW and nothing else: move there on floor, stack up on a door, fall in on
// nothing — and 'stack up' again on a door the men were already stacked on. With the switch on it asks `autoPick` instead:
//   · floor / nothing / a teammate / a door nobody of the addressed men waits on = that first row, as ever;
//   · a door they STAND on a plain 'stack up' at (every man on his mark: a second tap while they still walk is 'stack up' again, not an entry) = THEY GO
//     IN, by the entry they pick (below) — only the men stacked on it (GiveOpts.men): a man left elsewhere is left;
//   · a door something else of theirs waits on (an order given on the word, a threshold held, a charge set or being set) = the word, as F gives it, to
//     the men on THAT door (the pair, which has no 'go' order: its held threshold's word, or its set charge blown);
//   · a door with a set charge nobody waits on = it is blown (the tools' own row) — never one that is on a word still gathering (doortools.ts
//     onPendingWord: the key refuses that too).
// THE ENTRY, the first that the row's own `valid` takes, from only what the team knows (ONE MODEL: the far room by cleared.ts — has one of them stood in
// it —, an enemy only while the team's fog has him in sight, the door's lock only once a man has tried it):
//   1. the squad is silent (silent.ts): open and clear, and nothing else — the autopilot never makes the squad loud by itself;
//   2. an enemy in sight in the room beyond the door (the fog's own picture where there is one, else the room fight's meters) and a stun left, or a
//      room none of them has stood in and more than `keepBangs` left: bang and clear;
//   3. open (kick, pick: the row's own verb) and clear;
//   4. none of those, loud, and the door known shut: a charge — set, stood off from, and WAITING (the key, or B on it again, blows it).
// Nothing fits: the first choice is given all the same, so a man says why in the row's own words. It never throws a frag, never goes through a wall,
// never sends a second element to a second door: those need the player's intent and are the menu's.
//
// THE PLAN IT SHOWS: a quick-key order's row in the order book is stamped `auto`, and floorplan.ts draws its men for `showSecs` where the menu's own
// order has PLAN.freshSecs — the player did not pick the entry, so he is given longer to read it. `replan`: the squad's own change of plan with nobody
// asking (doortools.ts haltAt: a door found shut — they stop and stack on it) is drawn the same way (SquadOrders.shows; the module says so the frame it
// re-assigns them). THE HUD'S B LINE (autoHint) is the squad's FIRST choice in the row's own words, asked every frame, so it runs no path search and
// writes nothing: the press itself asks each row's `valid` and may fall back (a mate behind the door: no bang).
//
// PER SEAT, for a second player: the press, its cursor and `who` are the seat's (orders.ts input); nothing here keeps state.
// Off (the module's default, the frozen stand): the quick key is the first row, no row is stamped, nothing more is drawn — the build as it was.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { OrderDef, OrderTarget } from './orders';
import { sideOf } from './orders';   // (these three are called inside functions only: src/game is one import cycle)
import { squadSilent } from './silent';
import { offOf } from './doortools';
import { isHostile } from './teams';

export const AUTOPILOT = {
  /** the quick key on a door the addressed men wait on sends them in by the entry they pick (false: it is the target's first row, as it was) */
  on: false,
  /** seconds the plan of an order the quick key gave is drawn before it has faded (the menu's own order: floorplan.ts PLAN.freshSecs) */
  showSecs: 4,
  /** a room nobody of the team has stood in gets a stun only while MORE than this many are left: the last is kept for a room they know is held */
  keepBangs: 1,
  /** with no model of the room beyond a door, an enemy in sight this near its doorway on the far face is 'behind that door', metres */
  contactM: 9,
  /** the squad's own change of plan (a door found shut: they stop and stack on it) is drawn and fades as a quick-key order's is */
  replan: true,
};
export const AUTOPILOT_STATS = { presses: 0, first: 0, bang: 0, open: 0, charge: 0, blow: 0, word: 0, refused: 0, shows: 0 };

type DoorTarget = OrderTarget & { kind: 'door' };
/** What the quick key would do on a target. `word`: the word, to `men`. `id`: that order — to `men` exactly where it names them (the men on the door),
 *  else to the standing choice. Neither: nothing (a charge on a word still gathering). */
export interface AutoPick { id: string | null; men: Guard[] | null; word: boolean; why: 'first' | 'silent' | 'contact' | 'unknown' | 'known' | 'shut' | 'blow' | 'word' | 'pending'; t: OrderTarget }

const flat = v3.distXZ;

/** an enemy the team has in sight in the room beyond that door (nothing here reads a man nobody of the team sees) */
function contactBehind(g: Game, t: DoorTarget, far: number): boolean {
  const F = g.fogOfWar, c: Vec3 = t.door.frameCentre;
  const seen = (o: Guard) => (F.active ? F.seen(o) : !!g.fight?.teamSees(o));
  const there = (p: Vec3) => (far ? g.cleared.roomAt(p) === far : offOf(t.door, p, t.side) < 0 && flat(p, c) < AUTOPILOT.contactM);
  return g.guards.some(o => o.state !== 'dead' && isHostile('operative', o.team) && there(o.char.pos) && seen(o));
}

/** The entries in the order the squad would take them on a door it is stacked on (`t.side`: the men's face): the first is its choice, the rest what it
 *  falls back to. `shut`: with the charge a door known shut ends on (it asks the door tools what the team knows of the lock — the press; never the HUD). */
export function autoEntries(g: Game, t: DoorTarget, shut = true): { ids: string[]; why: AutoPick['why'] } {
  const DT = g.doorTools;
  if (squadSilent(g)) return { ids: ['openClear'], why: 'silent' };
  const far = g.cleared.roomBy(t.door, t.side > 0 ? -1 : 1), unknown = !!far && !g.cleared.isKnown(far);
  const contact = DT.bangs > 0 && contactBehind(g, t, far), bang = contact || (unknown && DT.bangs > AUTOPILOT.keepBangs);
  const ids = bang ? ['bangClear', 'openClear'] : ['openClear'], known = shut && DT.knownShut(t.door, t.side);
  if (known) ids.push('charge');
  return { ids, why: contact ? 'contact' : bang ? 'unknown' : known ? 'shut' : 'known' };
}

/** What the quick key does on `t` for the men it would go to. `check`: the entry is the first its row's `valid` takes (a path search per man: the press);
 *  without, the first choice unasked (the HUD's line, every frame: no path search, nothing written). */
export function autoPick(g: Game, t: OrderTarget, check = true): AutoPick {
  const S = g.orders, first = (): AutoPick => ({ id: S.defaultFor(t)?.id ?? null, men: null, word: false, why: 'first', t });
  if (t.kind !== 'door') return first();
  const DT = g.doorTools, W = DT.waitsOn(S.recipients(t), t.door);
  if (!W) { const c = DT.chargeOn(t.door); return !c ? first() : DT.wordPending(c) ? { id: null, men: null, word: false, why: 'pending', t } : { id: 'charge', men: null, word: false, why: 'blow', t }; }
  if (W.kind === 'word') {
    if (S.big || DT.thresholdHeld(W.men, t.door).length) return { id: null, men: W.men, word: true, why: 'word', t };
    return DT.chargeOn(t.door) ? { id: 'charge', men: W.men, word: false, why: 'blow', t } : first();   // (the pair has no word but a held threshold's: its own set charge is blown by the row)
  }
  if (!W.set) return first();   // (still walking to their marks: 'stack up' again — a second tap is not an entry)
  // the men's own face of the door, off the marks they stand on (the word's fromStack reads the same): no path search to find it
  const A = S.of(W.men[0]), tm: DoorTarget = A?.post ? { ...t, side: sideOf(t.door, A.post) } : t, E = autoEntries(g, tm, check);
  if (check) for (const id of E.ids) { const d = S.defs.find(x => x.id === id); if (d && S.whyNot(d, tm, W.men) === null) return { id, men: W.men, word: false, why: id === 'charge' ? 'shut' : E.why, t: tm }; }
  return { id: E.ids[0], men: W.men, word: false, why: E.why, t: tm };   // (nothing fits: given all the same — a man says why, in the row's words)
}

/** The quick key, pressed on `t`: true when the press was the autopilot's (an order given and stamped as its own in the order book, or refused aloud, or
 *  a charge left alone on its word). False: nothing was there to give. */
export function autoQuick(g: Game, t: OrderTarget): boolean {
  const S = g.orders, P = autoPick(g, t), K = AUTOPILOT_STATS, tail = S.log[S.log.length - 1]; K.presses++;
  if (P.why === 'pending') return true;
  let no: string | null;
  if (P.word) { const p = g.player.char.pos; no = S.big ? S.give('go', { kind: 'none', at: [p[0], 0, p[2]] }, S.who, { men: P.men ?? undefined }) : g.doorTools.go(S.who); }
  else if (P.id) no = S.give(P.id, t, S.who, { men: P.men ?? undefined });
  else return false;
  if (no !== null) { K.refused++; return true; }
  const row = S.log[S.log.length - 1]; if (row && row !== tail) row.auto = true;   // (floorplan.ts draws its men for showSecs)
  if (P.word) K.word++; else if (P.why === 'first') K.first++; else if (P.why === 'blow') K.blow++; else if (P.id === 'bangClear') K.bang++; else if (P.id === 'charge') K.charge++; else K.open++;
  return true;
}

/** the quick key's line on the HUD: the row's own words for the squad's first choice on what the cursor is on (null: nothing) */
export function autoHint(g: Game, t: OrderTarget): string | null {
  const S = g.orders, P = autoPick(g, t, false);
  if (P.word && !S.big) return 'go';
  const id = P.word ? 'go' : P.id, d: OrderDef | undefined = id ? S.defs.find(x => x.id === id) : undefined;
  return d ? (typeof d.label === 'string' ? d.label : d.label(P.t)) : null;
}

/** seconds the plan of that order-book row is drawn outside the order mode */
export function showSecsOf(row: { auto?: boolean }, fresh: number): number { return row.auto ? Math.max(0.2, AUTOPILOT.showSecs) : fresh; }

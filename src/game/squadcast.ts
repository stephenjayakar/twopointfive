// A SECOND CAST OF THE SQUAD'S OWN CODE. Sam's squad is moved by one SquadOrders (orders.ts: who stands where, the walk onto a mark, the pose on it) and one
// DoorTools (doortools.ts: the stack on a door, the hand on the leaf, the boot, the can, who goes in first, the corner each man slices, the search that flows
// them on through the room) — both written against `g.orders` / `g.doorTools`, and so are the rule modules they call (doorway.ts, stackroom.ts, cover.ts …).
// Men who are NOT Sam's are run through that same code, unedited, by standing a second pair of those two classes up over a VIEW of the game: the Game itself
// in every respect but two fields — `orders` and `doorTools` read as the second cast's own — so that every line that asks "the squad's orders" from inside
// their work gets theirs, and Sam's squad never hears of it. Reads of anything else, and every write, go to the one Game. The cast's roster is whoever its
// `mine` says (orders.ts SquadOrders.mine — the one roster test); nothing of the menu, the HUD or the input ever reaches it (nobody calls its input()).
// Whoever owns the men ticks it: `tools.tick()` then `orders.tick()`, the order Game.update runs the squad's own in. First user: qrf.ts (the response team).
import type { Game } from './game';
import { SquadOrders, type OtherCast } from './orders';
import { DoorTools } from './doortools';

export interface SquadCast { view: Game; orders: SquadOrders; tools: DoorTools; }

/** every lock opens: a cast that carries the building's keys (a ring is only ever asked `has`) */
export const EVERY_KEY: ReadonlySet<string> = Object.freeze({ has: () => true, size: 1 }) as unknown as ReadonlySet<string>;

export function squadCast(g: Game, of: OtherCast): SquadCast {
  const over = new Map<PropertyKey, unknown>();
  const view = new Proxy(g, {
    get: (t, k) => over.has(k) ? over.get(k) : Reflect.get(t, k, t),
    set: (t, k, v) => Reflect.set(t, k, v, t),
  });
  const orders = new SquadOrders(view, of); over.set('orders', orders);
  const tools = new DoorTools(view); over.set('doorTools', tools);
  return { view, orders, tools };
}

// THE TEAM STARTS A MISSION FALLEN IN (the maintainer, 10-10: "team should also start in "fall in" state").
//
// A staging used to leave the teammates with no order of Sam's: the night breach's pair stood on the drill's marks until F, the second pair on a script with no goal
// — so the first thing a mission asked of the player was X, 3. Now every living teammate the night breach or a room clear puts on the floor is handed the menu's own
// 'fall in' as it stages (the quiet mission has always told its partner to follow: quiet.ts, untouched):
//   · it is the SAME assignment X, 3 gives — the fallIn row's own issue(), a fresh group — so everything that reads a man's order (the HUD's 'with you', the file down
//     Sam's trail, the fight seam, F's drill taking the pair off it) meets nothing new;
//   · nobody SAID it: no 'you: … — fall in' line, no 'on you.', no row in orders.log, no word to the squad's posture;
//   · no owner is asked to let go of a man (give() asks; this does not): at staging the night breach's drill is in 'wait' and owns nobody.
// THE HOSTAGE RESCUE IS NOT STAGED THIS WAY, on purpose: its men are held (hold + pinned, out of the room fight) until the hostages' clock starts, and rescue.ts
// startClock has always fallen every idle man in on Sam's first move, order or shot — so there too nobody presses X, 3. Fallen in AT staging they are the room
// fight's from the first frame, and one of them shot a roamer through the conference glazing 0.9 s in, starting the clock before the player had touched a key.
// Nothing here draws a die, reads the camera or keeps state: the men's assignments are the orders' own (and are saved or dropped with them).
// Type-only game imports: nothing here is built from another game module's exports at load (src/game is one import cycle).
import type { Game, Guard } from './game';

/** the switch: off in the module, raised by the page (host/profile.ts pageSwitches; ?nofallin = the men start with no order, as they did) and by the shipped stand;
 *  the harness's frozen stand leaves it off (TPS_FALLIN=1 turns it on) */
export const START = { fallIn: false };

/** Called by a scenario as it stages, after its men are on their marks and Sam is on his: every living one of `men` on 'fall in'. Returns how many took it. */
export function teamStartsFallenIn(g: Game, men: Guard[]): number {
  if (!START.fallIn) return 0;
  const S = g.orders, up = men.filter(m => m.state !== 'dead'); if (!up.length) return 0;
  const def = S.defs.find(d => d.id === 'fallIn'); if (!def) return 0;
  const p = g.player.char.pos;
  S.newGroup();
  return typeof def.issue(S, up, { kind: 'none', at: [p[0], 0, p[2]] }) === 'string' ? 0 : up.filter(m => S.of(m)?.order === 'fallIn').length;
}

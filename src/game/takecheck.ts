// WHO IS TOLD WHEN THE MISSION'S THING IS TAKEN (the maintainer, 10-12: "predictably getting a guard to come by when you pull the objective is a bit contrived.
// makes sense for the server rack in the office but not the officer files").
//
// Seven seconds after the thing comes out of its holder the nearest calm man was sent to look at it (mission.ts sendRackCheck) — on EVERY mission. That is the
// office's story: a rack that drops off the network shows dark on a board, and control sends a man. A case file lifted out of a safe, a ledger out of a trunk,
// shows on nobody's board, so with the rule on a QUIET mission sends that man only where the level says the holder is WIRED (scene/scenarios.ts QuietSpot.wired:
// a thing on a network or an alarm — today the relay station's rack). What is left everywhere is what the take really makes: its clunk goes into the hearing
// model as before, and a man near enough to hear it comes to look by himself.
// The plain night (no quiet mission up: the office's rack) is never asked: it sends its man as it always did.
// Type-only game imports: nothing here is built from another game module's exports at load (src/game is one import cycle).
import type { Game } from './game';

/** the switch: off in the module, raised by the page (host/profile.ts pageSwitches; ?takecheck = a man is sent after every take, as it was) and by the shipped
 *  stand; the harness's frozen stand leaves it off (TPS_TAKECHECK=1 turns it on) */
export const TAKE = { wired: false };

/** is somebody told that the thing is gone (so that a man is sent to look at its holder)? */
export function takeTold(g: Game): boolean {
  if (!TAKE.wired) return true;
  const Q = g.quiet?.active ? g.quiet : null;
  return !Q || !!Q.spot?.wired;
}

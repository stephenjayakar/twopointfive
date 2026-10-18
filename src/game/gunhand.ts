// GUN HAND — a move does not take the hand that is holding something, nor leave the hand that should hold it empty. Three calls the in-hand pass (inhand.ts)
// left for the maintainer (10-18, of each: "fix it", "let's do rifle reload"):
//   · `whistle`: a guard answering a whistle (whistle.ts WHISTLE_SOFT_UPPER 'torch') raised his empty LEFT fist to shoulder height while the torch he carries
//     stayed in the hanging right hand — the torch clip is keyed for the other hand.
//   · `throwFree`: a defender with a carbine threw overhand with the carbine still in the throwing fist.
//   · `longReload`: through a long gun's reload the trigger hand and the body played the pistol's reload clip.
// Each is its own key under the one switch; what each does is said where it is done (character.ts) and in docs/agents.
//
// Off (the module's default, the frozen stand): the build as it was. These change the pose the simulation reads (hit capsules, a torch's light), so unlike IN
// HAND a run with the switch on is not the run with it off.
// A leaf: nothing here is built from another game module's exports (src/game is one import cycle).

/** `on`: the switch · `whistle`: the hand that comes up for a whistle is the one with the torch in it · `throwFree`: a man with a long gun throws with the
 *  hand that is not holding it · `longReload`: a long gun reloads with a move of its own, the trigger hand on the grip */
export const GUNHAND = { on: false, whistle: true, throwFree: true, longReload: true };

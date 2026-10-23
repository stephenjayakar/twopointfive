// AFTER A SAVE KEPT IN MEMORY IS PUT BACK (game/savestate.ts Checkpoints.loadMem → game/rollback.ts restoreSnapshot): the simulation is the saved moment's to the
// bit, and the HOST is still the abandoned moment's. A snapshot reaches the CPU box world, the light set, the decal list and the character renderer's rows — and
// with them their books of WHAT WAS LAST SENT to the GPU, which go back while the buffers do not: left alone, the next upload finds nothing changed and a wall
// blown since the save stays drawn and traced as blown. So every such book is forgotten here and the next frame writes its buffer whole; what lives on the GPU
// alone (smoke in the air, particles) is let go, as a file's load lets it go; the picture's history is cut. One call, by whoever stood the Game up over a real
// device (host/standup.ts wires it; the headless harness has no buffers to be wrong).
import type { Engine } from '../engine';
import type { Game } from '../game/game';

export function hostAfterPutBack(game: Game) {
  const engine = game.engine as unknown as Engine;
  engine.world.forgetSent(); engine.lights.forgetSent(); game.chars.forgetSent();   // statics, the visible list, the glass and marking tables, both grids; the lights' reach rows; every man's material rows and instance words
  game.decals.touch();   // (the ring's list went back; its 'unchanged since the last frame' with it)
  game.smoke?.clearAll?.();   // (the solver's fields are the GPU's: a cloud of the abandoned moment is nobody's — a can that was venting at the save lies there without its smoke, as after a file's load)
  engine.particles?.clear();
  game.engine.breathShown = undefined;   // (the breath's book of whose steam rides whose mouth in that solver and which puffs went to that pool, game/snowBreath.ts: asked for afresh)
  game.engine.hostBooks = undefined;   // (EVERY host book kept in the one bag, host/api.ts HostBooks — today the open fires' book of the smoke filed with that solver and the bed voices asked of the mixer, game/fire.ts: all were the abandoned moment's and are asked for afresh. A book kept there needs no line of its own here and cannot be forgotten)
  game.rehand();   // (lying snow, the wind's map of what stands, the dust under the roofs: each handed over only when it changed, and it changed BACK)
  (game.probe as { putBack?: () => void }).putBack?.();   // (the light meter: answers still out are the abandoned moment's and are dropped as they land. Its buffers and what it last sent never went back — render/probe.ts Plumbing is the host's inside a game object, math/side.ts HostOwned — so there is nothing to forget)
  engine.resetTaa('a save put back'); engine.invalidateWorldCache();
}

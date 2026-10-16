// A MISSION ISSUES ITS OWN WALL CHARGES.
//
// A room clear whose level says so (`scenarios.roomClear.wallCharges`, scene/scenarios.ts StructureData) puts that many wall charges in the squad's bag at every
// staging, whatever the kit cards carry and with no visit to the loadout: the mission is ABOUT walls, and as shipped the cards carry none. It is the wall charge's
// own count (WallCharge.raiseCarried, beside the kit's setCarried), asked right after the kit has staged, so:
//   · the cards and their store are not read and not written: a kept card that carries wall charges of its own keeps them (the larger count stands), and the
//     loadout screen shows and keeps what the machine keeps;
//   · nothing is kept here: WallCharge.reset() puts the count back at every new cast, restart and load, and the staging that follows asks again;
//   · a level without the field returns on the first line — the game as it was.
// Nothing here draws a die or reads the camera. Type-only game imports (src/game is one import cycle).
import type { Game } from './game';

/** Called by the night breach's staging right after kitStage: the structure's own wall charges into the bag. Returns the count now carried (null = not this level's rule). */
export function issueStage(g: Game): number | null {
  const n = g.roomClear.active ? g.roomClear.structure?.wallCharges : undefined;
  if (!(typeof n === 'number' && n > 0)) return null;
  const W = g.wallCharge; W.raiseCarried(n);   // (raiseCarried reads the count only after the run's own reset: a restart with nothing spent is issued again)
  return W.carried;
}

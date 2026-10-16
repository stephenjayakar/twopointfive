// Which way each door of the document opens, as the GAME will deal it at the start of a run (game/doorswing.ts dealSwings: authored →
// folds → a clear plan → a structure's room → hostages → the mission's entry → away from a lock's cylinder → how it stands → the smaller
// floor → the wider stop). A door with no `swing` in the file is dealt when the level starts; this is that deal, run on the document, so the
// sheet and the overlay can show the side before anybody presses play. Loaded as play-from-here loads it (the office family carries the
// office's tables). null = the document does not load (the schema errors are lint's to show).
import type { LevelData } from '../scene/levelData';
import { validateLevelData } from '../scene/levelData';
import { loadLevel } from '../scene/levelLoad';
import { isOfficeFamily, withOfficeScript } from '../scene/level';
import { StaticCollision } from '../scene/collision';
import { Doors } from '../game/doors';
import { dealSwings, swingsNow, SwingDeal } from '../game/doorswing';

export function dealtSwings(data: LevelData): Map<string, SwingDeal> | null {
  if (!data.doors.length) return new Map();
  try {
    if (validateLevelData(data).length) return null;
    const plain = loadLevel(data, { validate: false, lived: true }), level = isOfficeFamily(data) ? withOfficeScript(plain) : plain;
    const col = new StaticCollision(level.boxes);
    const deal = swingsNow(dealSwings(level, new Doors(level.doors, () => {}), col.nav));   // (as the doors stand: an outside door outward while DOORWAY.exitsOut is on)
    return new Map(deal.map(d => [d.door, d]));
  } catch { return null; }
}

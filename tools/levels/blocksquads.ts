// THE BLOCK, THREE SQUADS — tools/levels/block.ts's floor, wall for wall, with ELEVEN defenders in three squads (scene/scenarios.ts SquadData; the worked example
// of rebuild/enemy-squads/squad-format.md; the squads themselves are block.ts's BLOCK_SQUADS, which its own eight stand in too): Alpha 3 in the mess (the first room off staging), Bravo 5 across the workshop and the store, Charlie 3 in the comms
// room with the drive — Charlie never leaves it. Sam, the four and eleven fill the skinning's sixteen. The floor's one problem is block.ts's (every held room
// turns a corner and its men are round it); a room's THIRD man here is its third mark: the near leg's dead corner, on the hall door. Each squad rallies in the
// far leg of a room of its own.
// Of block.ts's two answers the HEEL DOORS answer this file too, at a higher price (measured: Hard, the shipped stand, seeds 1‥12: the hall doors won 3 of 12
// with 5 of 48 up, the heel doors 10 of 12 with 25 of 48 — their men fall in the hall and the frame room). THE MAINS do less here: a room's third man stands
// in the NEAR leg, where no emergency lamp is, on the hall door the dark plan still uses (the dark was not run again on this floor as it stands).
//   bun run tools/levels/export.ts blocksquads [--check]     → levels/block-squads.json
//   page: ?levelFile=block-squads.json&roomclear&squad4       · headless: bun run tools/qa/scenario-level-probes.ts levels/block-squads.json
import type { Vec3 } from '../../src/math/vec';
import type { Level } from '../../src/scene/level';
import type { KitViewWay, LevelScenarios } from '../../src/scene/scenarios';
import { build as buildBlock, BLOCK_SQUADS } from './block';

export const NAME = 'block-squads';
export const NOTES = 'The block (tools/levels/block.ts) held by three squads, eleven men: Alpha the mess, Bravo the workshop and store, Charlie the comms room.';

const GARRISON: Record<string, number> = { mess: 3, comms: 3, shop: 3, store: 2 };
/** the third man of a room: the near leg's dead corner, his gun on the hall door (as many marks as men: every deal is this placement). Each stands CLEAR OF HIS
 *  OWN ROOM'S A, whose gun is on the turn and whose rounds carry on down the near leg: the mess's 1.2 m off that line (as the comms room's is, 1.1 m). The
 *  workshop's hall door opens into the room with its hinge on his side, so his aim is the floor a step INSIDE it, past the open leaf's edge, not the doorway. */
const THIRD: Record<string, { pos: Vec3; watch: string; aimAt: Vec3 }> = {
  mess: { pos: [11.7, 0, 6.5], watch: 'm_s', aimAt: [13.4, 1.1, 11.84] },
  comms: { pos: [35.3, 0, 6.4], watch: 'b_s', aimAt: [33.4, 1.1, 11.84] },
  shop: { pos: [12.2, 0, 16.9], watch: 'w_n', aimAt: [14.8, 1.1, 16.7] },
};

/** THE TEAM & KIT PICTURE, THE SECOND WAY IN (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the start on the tool crib shows the tool
 *  crib's own door from the loading hall, the stack up the hall's wall toward the hall's mouth and the mains. The first way is block.ts's, as it stands there.
 *  `hide` is written, so these go and nothing else: the camera stands outside the building's south side, and looking in over that wall the wall was the picture
 *  (its top and outer face lay under the men). So the south wall goes from the corner to the crib's far end (its seven boxes, found below: the
 *  group is every outer wall), with the pegboard and the tools that hang on it in the crib, the van parked outside it (`lived.street`), and the staging's lived
 *  things (of them the ladder on its trestles lies along the hall's wall, where the stack stands). In the 2010s look the wall's painted dado is the look's own
 *  box and stays: a low strip along the building's edge, the line of the cut. The light is NOT the first way's: the loading hall's own panels are off (the team
 *  starts in its dark), so the picture's lamp over the door and its fill stay, as at a door from a dark yard; the building's own lights stay as they are
 *  (`roomLights` 1: the crib's panel lights the room behind the door). */
const CRIB_WAY = (out: string[]): KitViewWay => ({ door: 'crib_to_loading', side: -1, roomLights: 1, pane: false, hide: ['lived.staging', 'lived.street', ...out] });

/** The boxes that picture takes out one by one, FOUND HERE, not typed: a box with no name has its place in the file for an id (`box_0010`), so a box added
 *  before it in block.ts would turn a typed `hide` onto another box with nothing red (and a name would be a change to the level itself: the file is held to
 *  block.ts's box for box). They are found by where they stand, at every export: the south wall's seven from the west corner to the crib's far end (x under
 *  14.9), and the pegboard with its five tools that hangs on that wall in the crib. A count that is not these throws: block.ts changed there, read the wall
 *  again. (kitview-plan still WARNS of ids of this kind: it cannot see that they are found.) */
function cribWayOut(B: ReturnType<typeof buildBlock>): string[] {
  const take = (what: string, n: number, is: (c: Vec3, h: Vec3, group: string) => boolean): string[] => {
    const at = B.level.boxes.map((b, i) => (b.name === undefined && is(b.c, b.h, B.groups[i]) ? i : -1)).filter(i => i >= 0);
    if (at.length !== n) throw new Error(`block-squads: the gear screen's second way hides ${n} boxes of ${what} and found ${at.length}`);
    return at.map(i => `box_${String(i).padStart(4, '0')}`);
  };
  return [...take('the south wall', 7, (c, h, g) => g === 'walls.exterior' && Math.abs(c[2] - 24) < 0.13 && c[0] + h[0] < 14.95),
    ...take("the crib's pegboard", 6, (c, _h, g) => g === 'lived.crib' && c[2] > 23.8)];
}

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[] } {
  const B = buildBlock(), rc = B.scenarios.roomClear!;
  rc.name = 'the block, three squads'; rc.maxMen = 11;
  for (const r of rc.rooms) r.garrison = GARRISON[r.id] ?? r.garrison;
  for (const r of rc.rooms) { const m = THIRD[r.id]; if (m) r.marks.push(m); }
  rc.squads = BLOCK_SQUADS();   // (block.ts's own three, as they stand there: the same squads over eleven men)
  const kv = B.scenarios.kitView;
  if (kv) B.scenarios.kitView = { ...kv, ways: [kv.ways[0], CRIB_WAY(cribWayOut(B))] };
  return B;
}

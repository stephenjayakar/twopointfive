// THE BLOCK, THREE SQUADS, IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/blocksquads.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says
// what may change and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts blocksquads-gwot` → levels/block-squads-gwot.json.
// THE SAME PLACE as tools/levels/block-gwot.ts (a district telephone exchange: pistachio paint, cable trenches in the floor), by the same SKIN: the floor is the block's
// wall for wall and only the defenders differ, so the two files must not.
import { build as buildPlain, NOTES as PLAIN_NOTES } from './blocksquads';
import { SKIN } from './block-gwot';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { skinLevel, LOOK_NOTE } from './gwotSkin';
import type { Level } from '../../src/scene/level';

export const NAME = 'block-squads-gwot';
export const DRESS_AS = 'blocksquads';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);

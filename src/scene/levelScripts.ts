// THE LEVELS THAT CARRY A SCRIPT (game/director.ts; levels/<name>.script.ts), by the name of the level file. A script is CODE, not level data: it is
// attached to the built Level as the file loads (levelLoad.ts loadLevel → level.ts withScript), so a level file says nothing of it and a level with no
// row here is exactly what it was. Type-only imports from the game: nothing here runs until a Director is stood up on the level.
import type { LevelScriptFn } from '../game/director';
import tutSquad from '../../levels/tut-squad.script';

export const LEVEL_SCRIPTS: Record<string, LevelScriptFn> = { 'tut-squad': tutSquad };

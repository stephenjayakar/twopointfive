// THE LEVELS THAT CARRY A SCRIPT (game/director.ts), by the level file's own name. A script is code, so it is not in the level file: loadLevel hangs it on
// the Level it builds (level.ts withScript) and the Director reads it there like any field. Each script file is `levels/<name>.script.ts`, imports nothing
// from src at run time, and carries one play program named 'tutorial' that game/rails.ts starts with the mission (a level that is not played on rails never
// starts it: with the frame's switch off the level is its scenario alone).
import type { LevelScriptFn } from '../game/director';
import tutSky from '../../levels/tut-sky.script';
import tutSolo from '../../levels/tut-solo.script';
import tutSquad from '../../levels/tut-squad.script';
import tutQuiet from '../../levels/tut-quiet.script';
import tutPair from '../../levels/tut-pair.script';

export const LEVEL_SCRIPTS: Record<string, LevelScriptFn> = { 'tut-sky': tutSky, 'tut-solo': tutSolo, 'tut-squad': tutSquad, 'tut-quiet': tutQuiet, 'tut-pair': tutPair };
